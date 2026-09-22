import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import {
  buscarAtendimento,
  atualizarFotoEvento,
  criarElegibilidadeDeCaneca,
  eventoDisponivel,
  escaparCelulaCsv,
  linhasCsvLeads,
  montarCsv,
  normalizarRespostaQuizTexto,
  obterEventoPirelli,
  paraBooleano,
  registrarCompraCaneca,
  revogarElegibilidadeFotoVencedora,
} from '@/lib/evento-pirelli'
import { PREFIXO_RATE_LIMIT_REGISTRO_PIRELLI } from '@/lib/evento-pirelli/rate-limit'
import { POST as registroPOST } from '@/app/api/evento-pirelli/registro/route'
import { GET as quizGET, POST as quizPOST } from '@/app/api/evento-pirelli/quiz/route'
import { POST as participacoesPOST } from '@/app/api/evento-pirelli/participacoes/route'

const marcador = Date.now().toString().slice(-7)
function whatsappFixture(i: number) {
  return `19${marcador}${String(i).padStart(2, '0')}`
}
/**
 * Cada requisição sai de um IP sintético distinto: o cadastro do evento tem
 * rate limit por origem e um harness que dispara dezenas de POSTs seria barrado
 * como rajada. No estande cada visitante vem do seu próprio aparelho.
 */
let contadorOrigem = 0
function req(url: string, body?: any, method = 'POST') {
  contadorOrigem += 1
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `203.0.113.${contadorOrigem % 250}` },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const visitanteIds: string[] = []
const whatsapps: string[] = []

async function registrar(nomeCompleto: string, whatsappRaw: string, extra: any = {}) {
  whatsapps.push(whatsappRaw)
  const resposta = await registroPOST(req('http://qa/api/evento-pirelli/registro', {
    nomeCompleto,
    whatsapp: whatsappRaw,
    email: `qa-${randomUUID()}@example.com`,
    enderecoCep: '13010000',
    enderecoRua: 'Rua QA',
    enderecoNumero: '100',
    enderecoComplemento: '',
    enderecoBairro: 'Centro',
    enderecoCidade: 'Campinas',
    enderecoEstado: 'SP',
    motoMarca: 'Honda',
    motoModelo: 'CB 500X',
    motoAno: 2024,
    chaveSubmissao: randomUUID(),
    ...extra,
  }))
  const dados = await resposta.json()
  if (dados?.visitante?.id) visitanteIds.push(dados.visitante.id)
  return { status: resposta.status, dados }
}

function cadastroCompleto(nomeCompleto: string, whatsapp: string, chaveSubmissao = randomUUID()) {
  return {
    nomeCompleto,
    whatsapp,
    email: `qa-${randomUUID()}@example.com`,
    enderecoCep: '13010000',
    enderecoRua: 'Rua QA',
    enderecoNumero: '100',
    enderecoComplemento: '',
    enderecoBairro: 'Centro',
    enderecoCidade: 'Campinas',
    enderecoEstado: 'SP',
    motoMarca: 'Honda',
    motoModelo: 'CB 500X',
    motoAno: 2024,
    chaveSubmissao,
  }
}

async function main() {
  // Bancos descartáveis permitidos. A produção (`forzamotos`) nunca entra aqui —
  // a lista é explícita justamente para não depender de um `!includes`.
  const BANCOS_PERMITIDOS = ['forzamotos_dev', 'forzamotos_r4c']
  const url = process.env.DATABASE_URL ?? ''
  if (!BANCOS_PERMITIDOS.some((banco) => url.includes(`/${banco}`))) {
    throw new Error(`Somente bancos descartáveis: ${BANCOS_PERMITIDOS.join(', ')}`)
  }

  const eventoOriginal = await obterEventoPirelli()
  await prisma.eventoPirelli.update({
    where: { id: eventoOriginal.id },
    data: { ativo: true, publicado: true, dataInicio: null, dataFim: null },
  })
  const evento = await obterEventoPirelli()

  try {
    // ---------- #1 + #7: token não vaza em recadastro por WhatsApp; concorrência não duplica ----------
    {
      const wa = whatsappFixture(1)
      const r1 = await registrar('QA Achado1', wa)
      assert.equal(r1.status, 201)
      const codigoOriginal = r1.dados.visitante.codigoQr

      // Novo POST, MESMO whatsapp, chaveSubmissao DIFERENTE (simula estranho com o telefone).
      const r2 = await registroPOST(req('http://qa/api/evento-pirelli/registro', {
        ...cadastroCompleto('Estranho Tentando', wa),
      }))
      const dados2 = await r2.json()
      assert.equal(r2.status, 409)
      assert.equal('visitante' in dados2, false, 'não deve devolver objeto visitante nem token de outra pessoa')
      assert.equal(JSON.stringify(dados2).includes(codigoOriginal), false, 'token do dono não pode vazar na resposta')
      console.log('OK #1 — WhatsApp repetido com chaveSubmissao diferente não vaza codigoQr')

      // Concorrência: dois POSTs simultâneos, MESMA chaveSubmissao e MESMO whatsapp.
      const waConc = whatsappFixture(2)
      const chaveConc = randomUUID()
      whatsapps.push(waConc)
      const corpo = cadastroCompleto('QA Concorrencia', waConc, chaveConc)
      const [c1, c2] = await Promise.all([
        registroPOST(req('http://qa/api/evento-pirelli/registro', corpo)).then((r) => r.json()),
        registroPOST(req('http://qa/api/evento-pirelli/registro', corpo)).then((r) => r.json()),
      ])
      assert.equal(c1.visitante?.codigoQr, c2.visitante?.codigoQr, 'duas requisições concorrentes com a mesma chave devem devolver o mesmo token')
      if (c1.visitante?.id) visitanteIds.push(c1.visitante.id)
      const totalCriados = await prisma.eventoPirelliVisitante.count({ where: { eventoId: evento.id, whatsapp: `55${waConc}` } })
      assert.equal(totalCriados, 1, 'corrida não pode criar dois visitantes para o mesmo whatsapp')
      console.log('OK #7 — dois POSTs concorrentes com a mesma chaveSubmissao não duplicam visitante')
    }

    // ---------- #6: string "false" não vira consentimento verdadeiro ----------
    {
      assert.equal(paraBooleano('false'), false)
      assert.equal(paraBooleano('true'), true)
      assert.equal(paraBooleano(true), true)
      assert.equal(paraBooleano(false), false)
      assert.equal(paraBooleano(undefined), false)

      const semConsentimento = await registrar('QA Sem Consentimento', whatsappFixture(3), { consentimentoMarketing: 'false' })
      const comConsentimento = await registrar('QA Com Consentimento', whatsappFixture(4), { consentimentoMarketing: true })
      const v1 = await prisma.eventoPirelliVisitante.findUniqueOrThrow({ where: { id: semConsentimento.dados.visitante.id } })
      const v2 = await prisma.eventoPirelliVisitante.findUniqueOrThrow({ where: { id: comConsentimento.dados.visitante.id } })
      assert.equal(v1.consentimentoMarketingEm, null, 'string "false" não pode virar consentimento')
      assert.notEqual(v2.consentimentoMarketingEm, null)
      console.log('OK #6 — paraBooleano trata "false" como falso; registro grava consentimento corretamente')
    }

    // ---------- #2: quiz é cronometrado e classifica sem premiar antes da apuração ----------
    {
      const perguntas = await prisma.eventoPirelliQuizPergunta.findMany({ where: { eventoId: evento.id, ativa: true }, include: { opcoes: { where: { ativa: true } } } })
      assert.ok(perguntas.length > 0, 'evento precisa ter perguntas ativas para este teste')
      const respostasPerfeitas: Record<string, string> = {}
      for (const p of perguntas) {
        if (p.tipo === 'TEXTO') {
          assert.ok(p.respostaCorretaTexto, `pergunta aberta ${p.id} sem gabarito`)
          respostasPerfeitas[p.id] = '  Forza-Motos!  '
          continue
        }
        const certa = p.opcoes.find((o) => o.correta)
        assert.ok(certa, `pergunta ${p.id} sem opção correta`)
        respostasPerfeitas[p.id] = certa!.id
      }

      // Caminho feliz via rota real.
      const feliz = await registrar('QA Quiz Feliz', whatsappFixture(5))
      const codigoFeliz = feliz.dados.visitante.codigoQr
      const aberturaQuiz = await quizGET(req(`http://qa/api/evento-pirelli/quiz?codigo=${codigoFeliz}`, undefined, 'GET'))
      assert.equal(aberturaQuiz.status, 200)
      const respostaQuiz = await quizPOST(req('http://qa/api/evento-pirelli/quiz', { codigo: codigoFeliz, respostas: respostasPerfeitas }))
      const dadosQuiz = await respostaQuiz.json()
      assert.equal(respostaQuiz.status, 200)
      assert.equal(dadosQuiz.classificadoQuiz, true)
      const canecaFeliz = await prisma.eventoPirelliCaneca.findUnique({ where: { visitanteId: feliz.dados.visitante.id } })
      const elegFeliz = await prisma.eventoPirelliElegibilidadeCaneca.count({ where: { visitanteId: feliz.dados.visitante.id, origem: 'QUIZ_PERFEITO' } })
      assert.equal(canecaFeliz, null, 'a apuração ainda não confirmou o vencedor')
      assert.equal(elegFeliz, 0)
      // Retry na tentativa única não reabre o cronômetro.
      const segundaTentativa = await quizPOST(req('http://qa/api/evento-pirelli/quiz', { codigo: codigoFeliz, respostas: respostasPerfeitas }))
      assert.equal(segundaTentativa.status, 409)
      assert.equal(await prisma.eventoPirelliElegibilidadeCaneca.count({ where: { visitanteId: feliz.dados.visitante.id, origem: 'QUIZ_PERFEITO' } }), 0)
      console.log('OK #2a — quiz perfeito entra no ranking; prêmio aguarda apuração e retry não reabre')

      const perguntaAberta = perguntas.find((pergunta) => pergunta.tipo === 'TEXTO')
      assert.ok(perguntaAberta, 'quiz oficial precisa ter a pergunta final aberta')
      assert.equal(normalizarRespostaQuizTexto(' Forza-Motos! '), normalizarRespostaQuizTexto('FORZA MOTOS'))

      const respostaErrada = await registrar('QA Quiz Final Errada', whatsappFixture(15))
      const quasePerfeitas = { ...respostasPerfeitas, [perguntaAberta!.id]: 'Outra loja' }
      await quizGET(req(`http://qa/api/evento-pirelli/quiz?codigo=${respostaErrada.dados.visitante.codigoQr}`, undefined, 'GET'))
      const tentativaErrada = await quizPOST(req('http://qa/api/evento-pirelli/quiz', { codigo: respostaErrada.dados.visitante.codigoQr, respostas: quasePerfeitas }))
      const dadosErrados = await tentativaErrada.json()
      assert.equal(tentativaErrada.status, 200)
      assert.equal(dadosErrados.classificadoQuiz, false)
      assert.equal(await prisma.eventoPirelliCaneca.count({ where: { visitanteId: respostaErrada.dados.visitante.id } }), 0)
      console.log('OK #2d — resposta final aceita variações de escrita; resposta errada não libera caneca')

      // Falha simulada na 2ª etapa: prova que a transação é atômica (rollback da tentativa).
      const falhaVisitante = await registrar('QA Quiz Falha Simulada', whatsappFixture(6))
      const maxima = perguntas.reduce((total, p) => total + p.pontos, 0)
      const respostasCriadas = perguntas.map((p) => {
        if (p.tipo === 'TEXTO') {
          return {
            perguntaId: p.id,
            opcaoId: null,
            respostaTexto: respostasPerfeitas[p.id],
            enunciadoSnapshot: p.enunciado,
            opcaoSnapshot: respostasPerfeitas[p.id],
            corretaSnapshot: true,
            pontosGanhos: p.pontos,
          }
        }
        const opcao = p.opcoes.find((o) => o.id === respostasPerfeitas[p.id])!
        return { perguntaId: p.id, opcaoId: opcao.id, respostaTexto: null, enunciadoSnapshot: p.enunciado, opcaoSnapshot: opcao.texto, corretaSnapshot: opcao.correta, pontosGanhos: opcao.correta ? p.pontos : 0 }
      })
      let falhouComoEsperado = false
      try {
        await prisma.$transaction(async (tx) => {
          await tx.eventoPirelliQuizTentativa.create({ data: { visitanteId: falhaVisitante.dados.visitante.id, pontuacao: maxima, pontuacaoMaxima: maxima, acertouTodas: true, respostas: { create: respostasCriadas } } })
          // Simula a falha da 2ª etapa (elegibilidade/caneca) com um visitanteId inexistente.
          await criarElegibilidadeDeCaneca({ visitanteId: 'nao-existe-simulado', origem: 'QUIZ_PERFEITO' }, tx)
        })
      } catch { falhouComoEsperado = true }
      assert.equal(falhouComoEsperado, true)
      const tentativaOrfa = await prisma.eventoPirelliQuizTentativa.findUnique({ where: { visitanteId: falhaVisitante.dados.visitante.id } })
      assert.equal(tentativaOrfa, null, 'com transação atômica, falha na 2ª etapa também desfaz a tentativa (retry continua possível)')
      console.log('OK #2b — falha simulada na 2ª etapa desfaz a tentativa inteira (nenhum estado órfão)')

    }

    // ---------- #3: busca de atendimento por nome não devolve pessoa arbitrária ----------
    {
      const maria = await registrar('Maria Fixture QA Unica', whatsappFixture(8))
      const zuluA = await registrar('Fixture Zulu Alpha QA', whatsappFixture(9))
      const zuluB = await registrar('Fixture Zulu Bravo QA', whatsappFixture(10))

      const resultadoMaria = await buscarAtendimento(evento.id, 'Maria Fixture QA Unica')
      assert.ok(resultadoMaria && resultadoMaria.tipo === 'unico')
      assert.equal((resultadoMaria as any).visitante.id, maria.dados.visitante.id)
      console.log('OK #3a — busca "Maria..." (sem dígitos) devolve exatamente a Maria, não pessoa arbitrária')

      const resultadoZulu = await buscarAtendimento(evento.id, 'Fixture Zulu')
      assert.ok(resultadoZulu && resultadoZulu.tipo === 'multiplos')
      const idsZulu = (resultadoZulu as any).candidatos.map((c: any) => c.id).sort()
      assert.deepEqual(idsZulu, [zuluA.dados.visitante.id, zuluB.dados.visitante.id].sort())
      console.log('OK #3b — múltiplos resultados devolvem lista para escolha, não seleção silenciosa')

      const resultadoInexistente = await buscarAtendimento(evento.id, 'Nome Que Nao Existe Jamais QA')
      assert.equal(resultadoInexistente, null, 'busca sem dígitos e sem correspondência não pode casar com todo mundo')
      console.log('OK #3c — busca sem dígitos e sem correspondência de nome não retorna ninguém (bug antigo: whatsapp contains "" casava todos)')
    }

    // ---------- #4: venda de caneca idempotente, visível na fila e no export ----------
    {
      const comprador = await registrar('QA Comprador Caneca', whatsappFixture(11))
      const chaveIdemp = randomUUID()
      const dadosCompra = { eventoId: evento.id, visitanteId: comprador.dados.visitante.id, quantidade: 2, nomeGravacaoSnapshot: 'QA Comprador', chaveIdempotencia: chaveIdemp, formaPagamento: 'DINHEIRO' as const, valorUnitarioSnapshot: 89, valorPago: 178, pagamentoConfirmadoEm: new Date(), pagamentoConfirmadoPor: 'QA' }
      const c1 = await registrarCompraCaneca(dadosCompra)
      const c2 = await registrarCompraCaneca(dadosCompra)
      assert.equal(c1.id, c2.id, 'mesma chave de idempotência deve devolver a mesma venda')
      const totalVendas = await prisma.eventoPirelliCompraCaneca.count({ where: { visitanteId: comprador.dados.visitante.id } })
      assert.equal(totalVendas, 1, 'duplo clique/retry não pode criar uma segunda venda')

      const fila = await prisma.eventoPirelliCompraCaneca.findMany({ where: { eventoId: evento.id, visitanteId: comprador.dados.visitante.id } })
      assert.equal(fila.length, 1)
      const linhasCompras = (await import('@/lib/evento-pirelli')).linhasCsvCompras
      const csvCompras = await linhasCompras(evento.id)
      assert.ok(csvCompras.some((linha) => linha[0] === 'QA Comprador'), 'venda deve aparecer no export de compras')
      console.log('OK #4 — venda de caneca idempotente por chave, visível na fila e no export')
    }

    // ---------- #5: corrigir vencedor da foto revoga o brinde (preserva se houver outra origem) ----------
    {
      // Caso A: única origem — revogar cancela a caneca.
      const fotoUnica = await registrar('QA Vencedor Foto Unico', whatsappFixture(12))
      await criarElegibilidadeDeCaneca({ visitanteId: fotoUnica.dados.visitante.id, origem: 'FOTO_VENCEDORA', validadoPor: 'QA' })
      const participacao = await prisma.eventoPirelliParticipacaoFoto.create({
        data: { visitanteId: fotoUnica.dados.visitante.id, instagram: 'qa_foto_unica', declarouMarcacoes: true, declarouHashtag: true, declarouPerfilPublico: true, status: 'VENCEDOR' },
      })
      let elegA = await prisma.eventoPirelliElegibilidadeCaneca.findUniqueOrThrow({ where: { visitanteId_origem: { visitanteId: fotoUnica.dados.visitante.id, origem: 'FOTO_VENCEDORA' } } })
      assert.equal(elegA.revogadoEm, null)
      await prisma.$transaction(async (tx) => {
        await tx.eventoPirelliParticipacaoFoto.update({ where: { id: participacao.id }, data: { status: 'FINALISTA' } })
        await revogarElegibilidadeFotoVencedora(fotoUnica.dados.visitante.id, 'QA Equipe', 'correção de vencedor em teste', tx)
      })
      elegA = await prisma.eventoPirelliElegibilidadeCaneca.findUniqueOrThrow({ where: { visitanteId_origem: { visitanteId: fotoUnica.dados.visitante.id, origem: 'FOTO_VENCEDORA' } } })
      assert.notEqual(elegA.revogadoEm, null, 'elegibilidade deve ficar marcada como revogada (auditoria), não sumir')
      assert.equal(elegA.revogadoPor, 'QA Equipe')
      assert.equal((await prisma.eventoPirelliParticipacaoFoto.findUniqueOrThrow({ where: { id: participacao.id } })).status, 'FINALISTA')
      const canecaA = await prisma.eventoPirelliCaneca.findUniqueOrThrow({ where: { visitanteId: fotoUnica.dados.visitante.id } })
      assert.equal(canecaA.status, 'CANCELADA', 'sem outra elegibilidade válida, a caneca deve ser cancelada')
      console.log('OK #5a — despromoção + revogação atômicas cancelam a caneca e preservam a trilha de auditoria')

      // Caso B: outra origem válida (quiz perfeito) — revogar a foto preserva a caneca.
      const fotoComQuiz = await registrar('QA Vencedor Foto Com Quiz', whatsappFixture(13))
      await criarElegibilidadeDeCaneca({ visitanteId: fotoComQuiz.dados.visitante.id, origem: 'QUIZ_PERFEITO', validadoPor: 'QA' })
      await prisma.eventoPirelliCaneca.update({
        where: { visitanteId: fotoComQuiz.dados.visitante.id },
        data: { status: 'ENTREGUE', entregueEm: new Date(), entreguePor: 'QA' },
      })
      await criarElegibilidadeDeCaneca({ visitanteId: fotoComQuiz.dados.visitante.id, origem: 'FOTO_VENCEDORA', validadoPor: 'QA' })
      const depoisDaSegundaOrigem = await prisma.eventoPirelliCaneca.findUniqueOrThrow({ where: { visitanteId: fotoComQuiz.dados.visitante.id } })
      assert.equal(depoisDaSegundaOrigem.status, 'ENTREGUE', 'nova origem não pode reabrir caneca já entregue e permitir segunda retirada')
      await revogarElegibilidadeFotoVencedora(fotoComQuiz.dados.visitante.id, 'QA Equipe', 'correção de vencedor em teste')
      const canecaB = await prisma.eventoPirelliCaneca.findUniqueOrThrow({ where: { visitanteId: fotoComQuiz.dados.visitante.id } })
      assert.equal(canecaB.status, 'ENTREGUE', 'com outra elegibilidade válida (quiz), a caneca entregue deve permanecer entregue')
      console.log('OK #5b — outra origem não reabre caneca entregue; revogar foto preserva o direito válido do quiz')
    }

    // ---------- #8: evento despublicado encerra as rotas públicas ----------
    {
      const gateVisitante = await registrar('QA Gate Evento', whatsappFixture(14))
      await prisma.eventoPirelli.update({ where: { id: evento.id }, data: { publicado: false } })
      assert.equal(eventoDisponivel({ ...evento, publicado: false }), false)

      const respGet = await quizGET(req(`http://qa/api/evento-pirelli/quiz?codigo=${gateVisitante.dados.visitante.codigoQr}`, undefined, 'GET'))
      assert.equal(respGet.status, 403)
      const respPost = await quizPOST(req('http://qa/api/evento-pirelli/quiz', { codigo: gateVisitante.dados.visitante.codigoQr, respostas: {} }))
      assert.equal(respPost.status, 403)
      const respParticipacao = await participacoesPOST(req('http://qa/api/evento-pirelli/participacoes', { codigo: gateVisitante.dados.visitante.codigoQr, tipo: 'balanceamento', horario: 'manhã' }))
      assert.equal(respParticipacao.status, 403)
      console.log('OK #8 — evento despublicado bloqueia quiz (GET/POST) e participações')

      await prisma.eventoPirelli.update({ where: { id: evento.id }, data: { publicado: true } })
    }

    // ---------- #9: CSV formula injection é neutralizada ----------
    {
      assert.equal(escaparCelulaCsv('=SOMA(1+1)').startsWith("'"), true)
      assert.equal(escaparCelulaCsv('+5551234').startsWith("'"), true)
      assert.equal(escaparCelulaCsv('-1').startsWith("'"), true)
      assert.equal(escaparCelulaCsv('@usuario').startsWith("'"), true)
      assert.equal(escaparCelulaCsv('João da Silva'), 'João da Silva')
      const linha = montarCsv([['=cmd|calc', 'seguro']])
      assert.ok(linha.startsWith('"\'=cmd'), 'célula perigosa deve ficar neutralizada dentro das aspas do CSV')
      console.log('OK #9 — prefixos =/+/-/@ são neutralizados nas células do CSV')
    }

    // ---------- #10: consentimento aparece no export de leads ----------
    {
      const linhas = await linhasCsvLeads(evento.id)
      assert.ok(linhas[0].includes('consentimento_marketing'), 'coluna de consentimento deve existir no export de leads')
      const linhaComConsentimento = linhas.find((l) => l[0] === 'QA Com Consentimento')
      const linhaSemConsentimento = linhas.find((l) => l[0] === 'QA Sem Consentimento')
      assert.equal(linhaComConsentimento?.[5], 'sim')
      assert.equal(linhaSemConsentimento?.[5], 'não')
      console.log('OK #10 — export de leads expõe consentimento de marketing por visitante')
    }

    // ---------- #11: fluxo oficial da foto + balanceamento ----------
    {
      const participanteA = await registrar('QA Foto Ranking A', whatsappFixture(16))
      const participanteB = await registrar('QA Foto Ranking B', whatsappFixture(17))

      const fotoIncompleta = await participacoesPOST(req('http://qa/api/evento-pirelli/participacoes', {
        codigo: participanteA.dados.visitante.codigoQr,
        tipo: 'foto',
        instagram: 'qa_ranking_a',
        declarouMarcacoes: true,
        declarouHashtag: false,
        declarouPerfilPublico: true,
      }))
      assert.equal(fotoIncompleta.status, 400, 'foto sem hashtag deve ser rejeitada')

      for (const [participante, instagram] of [[participanteA, 'qa_ranking_a'], [participanteB, 'qa_ranking_b']] as const) {
        const resposta = await participacoesPOST(req('http://qa/api/evento-pirelli/participacoes', {
          codigo: participante.dados.visitante.codigoQr,
          tipo: 'foto',
          instagram,
          declarouMarcacoes: true,
          declarouHashtag: true,
          declarouPerfilPublico: true,
        }))
        assert.equal(resposta.status, 200)
      }

      const [fotoA, fotoB] = await Promise.all([
        prisma.eventoPirelliParticipacaoFoto.findUniqueOrThrow({ where: { visitanteId: participanteA.dados.visitante.id } }),
        prisma.eventoPirelliParticipacaoFoto.findUniqueOrThrow({ where: { visitanteId: participanteB.dados.visitante.id } }),
      ])
      await atualizarFotoEvento({ id: fotoA.id, status: 'FINALISTA', curtidasApuradas: 20, observacao: null, operador: 'QA' })
      await atualizarFotoEvento({ id: fotoB.id, status: 'FINALISTA', curtidasApuradas: 30, observacao: null, operador: 'QA' })
      await assert.rejects(
        atualizarFotoEvento({ id: fotoA.id, status: 'VENCEDOR', curtidasApuradas: 20, observacao: null, operador: 'QA' }),
        /mais curtidas/,
      )
      await atualizarFotoEvento({ id: fotoB.id, status: 'VENCEDOR', curtidasApuradas: 30, observacao: null, operador: 'QA' })
      await atualizarFotoEvento({ id: fotoA.id, status: 'VENCEDOR', curtidasApuradas: 40, observacao: null, operador: 'QA' })
      const vencedoras = await prisma.eventoPirelliParticipacaoFoto.count({ where: { status: 'VENCEDOR', visitante: { eventoId: evento.id } } })
      assert.equal(vencedoras, 1, 'deve existir somente uma foto vencedora no evento')

      const balanceamento = await participacoesPOST(req('http://qa/api/evento-pirelli/participacoes', {
        codigo: participanteA.dados.visitante.codigoQr,
        tipo: 'balanceamento',
        horario: 'Manhã',
      }))
      assert.equal(balanceamento.status, 200)
      assert.equal((await prisma.eventoPirelliBalanceamento.findUniqueOrThrow({ where: { visitanteId: participanteA.dados.visitante.id } })).status, 'INTERESSE')
      console.log('OK #11 — foto exige regras oficiais, ranking mantém uma vencedora e balanceamento registra o período')
    }

    console.log('\nTODOS OS TESTES PASSARAM')
  } finally {
    // Restaura o evento ao estado original e apaga todas as fixtures criadas.
    await prisma.eventoPirelli.update({
      where: { id: evento.id },
      data: {
        ativo: eventoOriginal.ativo,
        publicado: eventoOriginal.publicado,
        dataInicio: eventoOriginal.dataInicio,
        dataFim: eventoOriginal.dataFim,
      },
    })

    const leads = await prisma.crmLead.findMany({ where: { whatsapp: { in: whatsapps.map((w) => `55${w}`) } }, select: { id: true } })
    const leadIds = leads.map((l) => l.id)
    if (leadIds.length) await prisma.crmMensagem.deleteMany({ where: { leadId: { in: leadIds } } })

    if (visitanteIds.length) {
      await prisma.eventoPirelliCompraCaneca.deleteMany({ where: { visitanteId: { in: visitanteIds } } })
      await prisma.eventoPirelliVisitante.deleteMany({ where: { id: { in: visitanteIds } } })
    }
    if (leadIds.length) await prisma.crmLead.deleteMany({ where: { id: { in: leadIds } } })
    await prisma.setting.deleteMany({ where: { key: { startsWith: PREFIXO_RATE_LIMIT_REGISTRO_PIRELLI } } })
    console.log(`Fixtures removidas: ${visitanteIds.length} visitantes, ${leadIds.length} leads.`)
  }
}

main().finally(() => prisma.$disconnect())
