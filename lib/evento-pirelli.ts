import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extrairCodigoQrEvento } from '@/lib/eventos/qr-pirelli'

export const EVENTO_PIRELLI_SLUG = 'pirelli-forza'

type TransactionClient = Prisma.TransactionClient

export function normalizarWhatsappEvento(valor: string) {
  const numeros = valor.replace(/\D/g, '')
  if (numeros.length === 10 || numeros.length === 11) return `55${numeros}`
  return numeros
}

const DDDS_BRASILEIROS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
])

/** O evento usa exclusivamente WhatsApp celular brasileiro em E.164. */
export function whatsappEventoValido(valor: string) {
  const normalizado = normalizarWhatsappEvento(valor)
  const partes = /^55(\d{2})(9\d{8})$/.exec(normalizado)
  if (!partes || !DDDS_BRASILEIROS.has(Number(partes[1]))) return false
  return !/^(\d)\1{8}$/.test(partes[2])
}

export function limparNomeGravacao(valor: string) {
  return valor.trim().replace(/\s+/g, ' ')
}

/** Formulários enviam booleano como string; `Boolean("false")` seria verdadeiro. */
export function paraBooleano(valor: unknown) {
  return valor === true || valor === 'true'
}

type JanelaEventoPirelli = {
  ativo: boolean
  publicado: boolean
  dataInicio: Date | null
  dataFim: Date | null
  inscricoesAntecipadasAbertas?: boolean
}

function eventoAtivoDentroDoFim(evento: JanelaEventoPirelli, agora: Date) {
  if (!evento.ativo || !evento.publicado) return false
  if (evento.dataFim && agora > evento.dataFim) return false
  return true
}

/** A chave operacional pode abrir o cadastro antes da data física, mas nunca após o fim. */
export function inscricaoEventoPirelliDisponivel(
  evento: JanelaEventoPirelli,
  agora = new Date(),
) {
  if (!eventoAtivoDentroDoFim(evento, agora)) return false
  if (
    evento.dataInicio &&
    agora < evento.dataInicio &&
    !evento.inscricoesAntecipadasAbertas
  ) return false
  return true
}

/** Cadastro, quiz, foto e balanceamento obedecem à mesma chave de abertura. */
export function eventoDisponivel(evento: JanelaEventoPirelli, agora = new Date()) {
  return inscricaoEventoPirelliDisponivel(evento, agora)
}

export function mensagemEventoPirelliIndisponivel(
  evento: Pick<JanelaEventoPirelli, 'dataInicio' | 'dataFim'>,
  agora = new Date(),
) {
  if (evento.dataFim && agora > evento.dataFim) return 'Este evento já foi encerrado.'
  if (evento.dataInicio && agora < evento.dataInicio) return 'Este evento ainda não está disponível.'
  return 'Este evento não está disponível.'
}

/** Letras, números, espaços e a pontuação que a gravação aceita com segurança. */
export function nomeGravacaoValido(valor: string) {
  // Restrição intencionalmente conservadora para a gravadora: alfabeto latino
  // (inclusive acentos brasileiros), números e pontuação simples. Isso já
  // elimina emoji e símbolos que não costumam ser reproduzíveis.
  return /^[a-zA-ZÀ-ÿ0-9 .,'-]+$/.test(valor)
}

export function novoCodigoQr() {
  return randomBytes(24).toString('base64url')
}

/** Comparação tolerante a caixa, acentos, espaços e pontuação para respostas abertas. */
export function normalizarRespostaQuizTexto(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')
    .replace(/[^A-Z0-9]/g, '')
}

export const perguntasIniciais = [
  {
    enunciado: 'O que significa a letra "B" na medida 150/80B16?',
    explicacao: 'A letra B identifica uma construção diagonal cintada (Bias-Belted).',
    tipo: 'MULTIPLA_ESCOLHA' as const,
    opcoes: ['Banda larga', 'Construção diagonal cintada (Bias-Belted)', 'Pneu balanceado', 'Banda de rodagem 16'],
    correta: 1,
  },
  {
    enunciado: 'O que representa a sigla TL?',
    explicacao: 'TL significa Tubeless: pneu projetado para uso sem câmara.',
    tipo: 'MULTIPLA_ESCOLHA' as const,
    opcoes: ['Tube Locked', 'Tire Light', 'Tubeless', 'Trail Line'],
    correta: 2,
  },
  {
    enunciado: 'O índice de velocidade W corresponde a qual velocidade?',
    explicacao: 'O símbolo W corresponde à velocidade máxima de 270 km/h nas condições especificadas pelo fabricante.',
    tipo: 'MULTIPLA_ESCOLHA' as const,
    opcoes: ['270 km/h', '300 km/h', '240 km/h', '210 km/h'],
    correta: 0,
  },
  {
    enunciado: 'Os pneus Pirelli e Metzeler têm altos níveis de sílica em sua composição para:',
    explicacao: 'A sílica contribui para a aderência, especialmente em condições de pista molhada, e favorece o aquecimento do composto.',
    tipo: 'MULTIPLA_ESCOLHA' as const,
    opcoes: ['Deixar o pneu mais leve', 'Facilitar a montagem', 'Aumentar apenas a rigidez', 'Aumentar a aderência'],
    correta: 3,
  },
  {
    enunciado: 'Qual é o mais novo pneu da Pirelli desenvolvido para motocicletas custom e cruiser modernas?',
    explicacao: 'O DIABLO POWERCRUISER combina o DNA esportivo da Pirelli com motos custom e cruiser de alto desempenho.',
    tipo: 'MULTIPLA_ESCOLHA' as const,
    opcoes: ['Diablo Rosso IV', 'Angel GT II', 'Scorpion Trail III', 'Diablo Powercruiser'],
    correta: 3,
  },
  {
    enunciado: 'O que significa a sigla TWI geralmente gravada na lateral do pneu?',
    explicacao: 'TWI significa Tire Wear Indicator e identifica a posição dos indicadores de desgaste da banda de rodagem.',
    tipo: 'MULTIPLA_ESCOLHA' as const,
    opcoes: ['Tire Wear Indicator', 'Traction Wheel Index', 'Tube Wheel Inspection', 'Temperature Warning Indicator'],
    correta: 0,
  },
  {
    enunciado: 'Qual é o primeiro pneu bi-composto do segmento custom?',
    explicacao: 'O Metzeler Cruisetec utiliza tecnologia bi-composto na medida traseira para combinar estabilidade, aquecimento e aderência.',
    tipo: 'MULTIPLA_ESCOLHA' as const,
    opcoes: ['Metzeler Cruisetec', 'Pirelli Night Dragon', 'Metzeler Marathon ME888', 'Pirelli Route MT66'],
    correta: 0,
  },
  {
    enunciado: '🏁 Pergunta Final – Valendo o Brinde!\n\nAgora queremos saber se você prestou atenção!\n\nQual é o nome da loja especialista em pneus para motocicletas, revendedora autorizada Pirelli e Metzeler, que está realizando esta ação no Rodeo Lucky Friends?\n\n✍️ Digite sua resposta:',
    explicacao: 'A ação é realizada pela Forza Motos.',
    tipo: 'TEXTO' as const,
    respostaCorretaTexto: 'FORZA MOTOS',
    opcoes: [],
    correta: -1,
  },
]

/** Cria uma configuração neutra para que o admin a complete antes de publicar. */
export async function obterEventoPirelli() {
  let evento = await prisma.eventoPirelli.findUnique({ where: { slug: EVENTO_PIRELLI_SLUG } })
  if (evento) return evento

  evento = await prisma.eventoPirelli.create({
    data: {
      slug: EVENTO_PIRELLI_SLUG,
      local: 'Lucky Friends Arena — Sorocaba/SP',
      dataInicio: new Date('2026-09-05T14:00:00.000Z'),
      dataFim: new Date('2026-09-07T02:59:59.999Z'),
      perguntasQuiz: {
        create: perguntasIniciais.map((pergunta, ordem) => ({
          enunciado: pergunta.enunciado,
          explicacao: pergunta.explicacao,
          tipo: pergunta.tipo,
          respostaCorretaTexto: 'respostaCorretaTexto' in pergunta ? pergunta.respostaCorretaTexto : null,
          ordem,
          pontos: 1,
          opcoes: {
            create: pergunta.opcoes.map((texto, indice) => ({ texto, ordem: indice, correta: indice === pergunta.correta })),
          },
        })),
      },
    },
  })
  return evento
}

export async function exigirAdmin() {
  const { getServerSession } = await import('next-auth')
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

/**
 * O estado de brinde (elegibilidades + caneca) é POR VISITANTE, então é essa a
 * granularidade do lock. Travar por participação de foto não protege nada: a
 * reconciliação do quiz mexe nas mesmas linhas a partir de outra chave.
 *
 * Toda transação que decide sobre elegibilidade/caneca pega este lock como
 * primeiro passo. É a única chave desses caminhos, e `pg_advisory_xact_lock` é
 * reentrante na mesma transação — não há ciclo possível.
 */
export async function bloquearVisitanteEvento(tx: TransactionClient, visitanteId: string) {
  const chave = `evento-pirelli-visitante:${visitanteId}`
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0))`
}

/** Serializa a escolha do vencedor da foto dentro do evento inteiro. */
async function bloquearApuracaoFotoEvento(tx: TransactionClient, eventoId: string) {
  const chave = `evento-pirelli-foto:${eventoId}`
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0))`
}

/**
 * Lock exclusivo para mudanças estruturais e para o encerramento do quiz.
 * Ele espera as tentativas em curso terminarem e impede que uma nova comece
 * enquanto a apuração está sendo congelada.
 */
export async function bloquearQuizEvento(tx: TransactionClient, eventoId: string) {
  const chave = `evento-pirelli-quiz:${eventoId}`
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0))`
}

/**
 * Lock compartilhado para início e conclusão de tentativas. Participantes não
 * entram em fila entre si, mas continuam coordenados com o lock exclusivo da
 * edição e do encerramento do quiz.
 */
export async function bloquearQuizEventoCompartilhado(tx: TransactionClient, eventoId: string) {
  const chave = `evento-pirelli-quiz:${eventoId}`
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock_shared(hashtextextended(${chave}, 0))`
}

/**
 * Aceita um cliente de transação existente para participar de uma transação maior
 * (ex.: tentativa de quiz + elegibilidade precisam ser atômicas). Sem ele, abre a sua própria.
 */
export async function criarElegibilidadeDeCaneca(
  args: {
    visitanteId: string
    origem: 'QUIZ_PERFEITO' | 'FOTO_VENCEDORA' | 'COMPRA_PNEUS' | 'MANUAL'
    validadoPor?: string | null
    valorPneus?: number | null
    referenciaVenda?: string | null
    formaPagamento?: 'PIX_MERCADO_PAGO' | 'MERCADO_PAGO' | 'PIX_EXTERNO' | 'DINHEIRO' | 'CARTAO_CREDITO_MAQUININHA' | 'CARTAO_DEBITO_MAQUININHA' | 'OUTRO' | null
    pagamentoConfirmadoEm?: Date | null
    pagamentoConfirmadoPor?: string | null
    referenciaPagamento?: string | null
    observacao?: string | null
    nomeGravacao?: string | null
  },
  clienteExistente?: TransactionClient,
) {
  const executar = async (tx: TransactionClient) => {
    await bloquearVisitanteEvento(tx, args.visitanteId)
    const visitante = await tx.eventoPirelliVisitante.findUniqueOrThrow({
      where: { id: args.visitanteId },
      include: { evento: { select: { limiteNomeGravacao: true } } },
    })
    const nomeInformado = args.nomeGravacao ? limparNomeGravacao(args.nomeGravacao) : null
    if (nomeInformado && (
      nomeInformado.length < 2
      || nomeInformado.length > visitante.evento.limiteNomeGravacao
      || !nomeGravacaoValido(nomeInformado)
    )) throw new Error(`O nome da caneca deve ter entre 2 e ${visitante.evento.limiteNomeGravacao} caracteres e não pode ter emoji.`)

    if (nomeInformado) {
      await tx.eventoPirelliVisitante.update({
        where: { id: visitante.id },
        data: {
          nomeGravacao: nomeInformado,
          nomeGravacaoConfirmadoEm: new Date(),
          nomeGravacaoConfirmadoPor: args.validadoPor ?? 'Sistema',
        },
      })
    }

    const nomeDaCaneca = nomeInformado ?? visitante.nomeGravacao
    let caneca = nomeDaCaneca
      ? await tx.eventoPirelliCaneca.upsert({
          where: { visitanteId: visitante.id },
          create: { visitanteId: visitante.id, nomeGravacaoSnapshot: nomeDaCaneca },
          update: {},
        })
      : null
    // Uma nova origem não pode reabrir uma caneca já em gravação/pronta/entregue.
    // Se ela havia sido cancelada por falta de elegibilidade, reativa sem permitir
    // uma segunda entrega quando o histórico mostra que a pessoa já recebeu a caneca.
    if (caneca?.status === 'CANCELADA') {
      caneca = await tx.eventoPirelliCaneca.update({
        where: { id: caneca.id },
        data: { status: caneca.entregueEm ? 'ENTREGUE' : 'PENDENTE' },
      })
    }
    return tx.eventoPirelliElegibilidadeCaneca.upsert({
      where: { visitanteId_origem: { visitanteId: visitante.id, origem: args.origem } },
      create: {
        visitanteId: args.visitanteId,
        origem: args.origem,
        canecaId: caneca?.id ?? null,
        validadoPor: args.validadoPor,
        valorPneus: args.valorPneus,
        referenciaVenda: args.referenciaVenda,
        formaPagamento: args.formaPagamento,
        pagamentoConfirmadoEm: args.pagamentoConfirmadoEm,
        pagamentoConfirmadoPor: args.pagamentoConfirmadoPor,
        referenciaPagamento: args.referenciaPagamento,
        observacao: args.observacao,
      },
      // Re-conceder uma origem previamente revogada (ex.: foto marcada VENCEDOR de novo) limpa a revogação.
      update: { canecaId: caneca?.id ?? undefined, validadoPor: args.validadoPor ?? undefined, valorPneus: args.valorPneus ?? undefined, referenciaVenda: args.referenciaVenda ?? undefined, formaPagamento: args.formaPagamento ?? undefined, pagamentoConfirmadoEm: args.pagamentoConfirmadoEm ?? undefined, pagamentoConfirmadoPor: args.pagamentoConfirmadoPor ?? undefined, referenciaPagamento: args.referenciaPagamento ?? undefined, observacao: args.observacao ?? undefined, revogadoEm: null, revogadoPor: null, revogadoMotivo: null },
    })
  }
  if (clienteExistente) return executar(clienteExistente)
  return prisma.$transaction(executar)
}

/**
 * Materializa a caneca somente depois de o nome ser informado. Uma conquista
 * do quiz pode existir sem caneca física até o vencedor escolher a gravação.
 */
export async function definirNomeCanecaElegivel(
  visitanteId: string,
  nomeGravacao: string,
  confirmadoPor = 'Cliente pelo link seguro',
) {
  return prisma.$transaction(async (tx) => {
    await bloquearVisitanteEvento(tx, visitanteId)
    const visitante = await tx.eventoPirelliVisitante.findUniqueOrThrow({
      where: { id: visitanteId },
      include: {
        evento: { select: { limiteNomeGravacao: true } },
        canecaBrinde: true,
        elegibilidadesCaneca: { where: { revogadoEm: null } },
        comprasCaneca: {
          where: { pagamentoConfirmadoEm: { not: null }, status: 'PENDENTE' },
          select: { id: true },
        },
      },
    })
    const temBrinde = visitante.elegibilidadesCaneca.length > 0
    const temCompraPendente = visitante.comprasCaneca.length > 0
    if (!temBrinde && !temCompraPendente) throw new Error('Este visitante ainda não possui compra ou direito a uma caneca.')
    const brindeEditavel = temBrinde && (!visitante.canecaBrinde || ['PENDENTE', 'CANCELADA'].includes(visitante.canecaBrinde.status))
    if (!brindeEditavel && !temCompraPendente) {
      throw new Error('A gravação já começou e o nome não pode mais ser alterado.')
    }
    const nome = limparNomeGravacao(nomeGravacao)
    if (nome.length < 2 || nome.length > visitante.evento.limiteNomeGravacao || !nomeGravacaoValido(nome)) {
      throw new Error(`O nome da caneca deve ter entre 2 e ${visitante.evento.limiteNomeGravacao} caracteres e não pode ter emoji.`)
    }
    await tx.eventoPirelliVisitante.update({
      where: { id: visitanteId },
      data: {
        nomeGravacao: nome,
        nomeGravacaoConfirmadoEm: new Date(),
        nomeGravacaoConfirmadoPor: confirmadoPor,
      },
    })
    let caneca = visitante.canecaBrinde
    if (brindeEditavel) {
      caneca = await tx.eventoPirelliCaneca.upsert({
        where: { visitanteId },
        create: { visitanteId, nomeGravacaoSnapshot: nome },
        update: { nomeGravacaoSnapshot: nome, status: 'PENDENTE' },
      })
      await tx.eventoPirelliElegibilidadeCaneca.updateMany({
        where: { visitanteId, revogadoEm: null },
        data: { canecaId: caneca.id },
      })
    }
    if (temCompraPendente) {
      await tx.eventoPirelliCompraCaneca.updateMany({
        where: { visitanteId, pagamentoConfirmadoEm: { not: null }, status: 'PENDENTE' },
        data: { nomeGravacaoSnapshot: nome },
      })
    }
    return caneca ?? tx.eventoPirelliVisitante.findUniqueOrThrow({ where: { id: visitanteId } })
  })
}

/**
 * Fecha novas respostas e congela a apuração. Repetir a ação devolve o mesmo
 * resultado: um vencedor já encerrado nunca é trocado por uma tentativa tardia.
 */
export async function encerrarQuizEConfirmarVencedor(eventoId: string, operador: string) {
  return prisma.$transaction(async (tx) => {
    await bloquearQuizEvento(tx, eventoId)
    const evento = await tx.eventoPirelli.findUniqueOrThrow({
      where: { id: eventoId },
      select: { quizEncerradoEm: true, quizVencedorTentativaId: true },
    })
    if (evento.quizEncerradoEm) {
      return evento.quizVencedorTentativaId
        ? tx.eventoPirelliQuizTentativa.findUnique({
            where: { id: evento.quizVencedorTentativaId },
            include: { visitante: true },
          })
        : null
    }

    const [relogio] = await tx.$queryRaw<Array<{ agora: Date }>>`
      SELECT clock_timestamp() AS "agora"
    `
    if (!relogio?.agora) throw new Error('Não foi possível obter o horário oficial da apuração.')
    const encerradoEm = relogio.agora
    const tentativasLegadasSemTempo = await tx.eventoPirelliQuizTentativa.count({
      where: {
        visitante: { eventoId },
        acertouTodas: true,
        concluidaEm: { not: null },
        duracaoMs: null,
      },
    })
    if (tentativasLegadasSemTempo > 0) {
      throw new Error(`Há ${tentativasLegadasSemTempo} tentativa(s) perfeita(s) antiga(s) sem tempo oficial. Revise esses registros antes de encerrar o quiz.`)
    }
    const vencedor = await tx.eventoPirelliQuizTentativa.findFirst({
      where: {
        acertouTodas: true,
        duracaoMs: { not: null },
        concluidaEm: { not: null, lte: encerradoEm },
        visitante: { eventoId },
      },
      orderBy: [{ duracaoMs: 'asc' }, { concluidaEm: 'asc' }, { id: 'asc' }],
      include: { visitante: true },
    })

    const anteriores = await tx.eventoPirelliElegibilidadeCaneca.findMany({
      where: { origem: 'QUIZ_PERFEITO', revogadoEm: null, visitante: { eventoId } },
      select: { id: true, visitanteId: true },
    })
    const idsParaBloquear = [...new Set([
      ...anteriores.map((item) => item.visitanteId),
      ...(vencedor ? [vencedor.visitanteId] : []),
    ])].sort()
    for (const visitanteId of idsParaBloquear) await bloquearVisitanteEvento(tx, visitanteId)

    const anterioresPerdedores = anteriores.filter((item) => item.visitanteId !== vencedor?.visitanteId)
    const canecasLegadasEmProducao = anterioresPerdedores.length
      ? await tx.eventoPirelliCaneca.count({
          where: {
            visitanteId: { in: anterioresPerdedores.map((item) => item.visitanteId) },
            status: { in: ['EM_GRAVACAO', 'PRONTA', 'ENTREGUE'] },
          },
        })
      : 0
    if (anterioresPerdedores.length) {
      const detalheProducao = canecasLegadasEmProducao
        ? `, incluindo ${canecasLegadasEmProducao} caneca(s) em produção, pronta(s) ou entregue(s)`
        : ''
      throw new Error(`Apuração bloqueada: existem ${anterioresPerdedores.length} direito(s) anterior(es) do quiz${detalheProducao}. Nada foi alterado; revise os registros antes de encerrar.`)
    }

    const vencedorJaTinhaDireito = vencedor
      ? anteriores.some((item) => item.visitanteId === vencedor.visitanteId)
      : false
    if (vencedor && !vencedorJaTinhaDireito) {
      await criarElegibilidadeDeCaneca({
        visitanteId: vencedor.visitanteId,
        origem: 'QUIZ_PERFEITO',
        validadoPor: operador,
        observacao: `Vencedor do quiz encerrado por menor tempo: ${vencedor.duracaoMs} ms.`,
      }, tx)
    }
    await tx.eventoPirelli.update({
      where: { id: eventoId },
      data: {
        quizEncerradoEm: encerradoEm,
        quizEncerradoPor: operador,
        quizVencedorTentativaId: vencedor?.id ?? null,
      },
    })
    return vencedor
  })
}

/**
 * Corrigir um vencedor de foto (VENCEDOR -> FINALISTA/DESCARTADO) precisa revogar o brinde
 * concedido por essa origem. A linha fica preservada com quem revogou e por quê — a equipe
 * precisa responder isso num evento presencial. A caneca só é cancelada se não restar
 * nenhuma outra elegibilidade válida (ex.: quiz perfeito).
 */
export async function revogarElegibilidadeFotoVencedora(
  visitanteId: string,
  revogadoPor: string,
  motivo: string,
  clienteExistente?: TransactionClient,
) {
  const executar = async (tx: TransactionClient) => {
    await bloquearVisitanteEvento(tx, visitanteId)
    const elegibilidade = await tx.eventoPirelliElegibilidadeCaneca.findUnique({
      where: { visitanteId_origem: { visitanteId, origem: 'FOTO_VENCEDORA' } },
    })
    if (!elegibilidade || elegibilidade.revogadoEm) return
    await tx.eventoPirelliElegibilidadeCaneca.update({
      where: { id: elegibilidade.id },
      data: { revogadoEm: new Date(), revogadoPor, revogadoMotivo: motivo },
    })
    const restantes = await tx.eventoPirelliElegibilidadeCaneca.count({ where: { visitanteId, revogadoEm: null } })
    if (restantes === 0) {
      await tx.eventoPirelliCaneca.updateMany({
        where: { visitanteId, entregueEm: null, status: { in: ['PENDENTE', 'EM_GRAVACAO', 'PRONTA'] } },
        data: { status: 'CANCELADA' },
      })
    }
  }
  if (clienteExistente) return executar(clienteExistente)
  return prisma.$transaction(executar)
}

export type AtualizacaoFotoEvento = {
  id: string
  status: 'PENDENTE' | 'FINALISTA' | 'VENCEDOR' | 'DESCARTADO'
  curtidasApuradas: number | null
  observacao: string | null
  operador: string
}

/**
 * Serializa toda decisão sobre uma participação. O status e o direito à caneca
 * são derivados dentro do mesmo lock/transação, inclusive quando dois PATCHes
 * opostos chegam ao mesmo tempo.
 *
 * O lock é do VISITANTE, não da participação: o que esta função decide são a
 * elegibilidade e a caneca, que pertencem ao visitante e são mexidas também pela
 * reconciliação do quiz. Como a foto é 1:1 com o visitante, dois PATCHes na mesma
 * participação continuam derivando a mesma chave e serializando entre si.
 */
export async function atualizarFotoEvento(args: AtualizacaoFotoEvento) {
  return prisma.$transaction(async (tx) => {
    const alvo = await tx.eventoPirelliParticipacaoFoto.findUniqueOrThrow({
      where: { id: args.id },
      select: { visitanteId: true, visitante: { select: { eventoId: true } } },
    })
    await bloquearApuracaoFotoEvento(tx, alvo.visitante.eventoId)

    if (args.status === 'VENCEDOR' && args.curtidasApuradas === null) {
      throw new Error('Informe a quantidade de curtidas antes de definir a foto vencedora.')
    }

    const vencedoresAnteriores = args.status === 'VENCEDOR'
      ? await tx.eventoPirelliParticipacaoFoto.findMany({
          where: {
            id: { not: args.id },
            status: 'VENCEDOR',
            visitante: { eventoId: alvo.visitante.eventoId },
          },
          select: { id: true, visitanteId: true },
        })
      : []

    const idsParaBloquear = [alvo.visitanteId, ...vencedoresAnteriores.map((item) => item.visitanteId)].sort()
    for (const visitanteId of idsParaBloquear) await bloquearVisitanteEvento(tx, visitanteId)

    if (args.status === 'VENCEDOR') {
      const fotoComMaisCurtidas = await tx.eventoPirelliParticipacaoFoto.findFirst({
        where: {
          id: { not: args.id },
          status: { not: 'DESCARTADO' },
          curtidasApuradas: { gt: args.curtidasApuradas ?? 0 },
          visitante: { eventoId: alvo.visitante.eventoId },
        },
        select: { curtidasApuradas: true, visitante: { select: { nomeCompleto: true } } },
        orderBy: { curtidasApuradas: 'desc' },
      })
      if (fotoComMaisCurtidas) {
        throw new Error(`Existe uma foto com mais curtidas: ${fotoComMaisCurtidas.visitante.nomeCompleto} (${fotoComMaisCurtidas.curtidasApuradas}).`)
      }
    }

    const participacao = await tx.eventoPirelliParticipacaoFoto.findUniqueOrThrow({ where: { id: args.id } })
    if (
      args.status === 'VENCEDOR'
      && (!participacao.declarouMarcacoes || !participacao.declarouHashtag || !participacao.declarouPerfilPublico)
    ) {
      throw new Error('A participação não confirmou marcações, hashtag e perfil público.')
    }
    const atualizada = await tx.eventoPirelliParticipacaoFoto.update({
      where: { id: args.id },
      data: {
        status: args.status,
        curtidasApuradas: args.curtidasApuradas,
        apuradoEm: new Date(),
        apuradoPor: args.operador,
        observacao: args.observacao,
      },
      include: { visitante: true },
    })

    if (args.status === 'VENCEDOR') {
      for (const anterior of vencedoresAnteriores) {
        await tx.eventoPirelliParticipacaoFoto.update({
          where: { id: anterior.id },
          data: {
            status: 'FINALISTA',
            apuradoEm: new Date(),
            apuradoPor: args.operador,
            observacao: 'Substituída pela foto com maior apuração de curtidas.',
          },
        })
        await revogarElegibilidadeFotoVencedora(
          anterior.visitanteId,
          args.operador,
          'Outra foto foi confirmada como a mais curtida.',
          tx,
        )
      }
      await criarElegibilidadeDeCaneca({ visitanteId: participacao.visitanteId, origem: 'FOTO_VENCEDORA', validadoPor: args.operador }, tx)
    } else {
      // Não depende do status anterior: também corrige estados legados em que a
      // participação já não era vencedora, mas a elegibilidade continuava ativa.
      await revogarElegibilidadeFotoVencedora(
        participacao.visitanteId,
        args.operador,
        `Foto definida como ${args.status}`,
        tx,
      )
    }
    return atualizada
  })
}

const includeAtendimento = {
  evento: { select: {
    valorCanecaAvulsa: true,
    valorMinimoPneus: true,
    operadorValorMinimoPneus: true,
    quizEncerradoEm: true,
    quizVencedorTentativaId: true,
  } },
  tentativaQuiz: true,
  participacaoFoto: true,
  balanceamento: true,
  canecaBrinde: { include: { elegibilidades: { where: { revogadoEm: null } } } },
  elegibilidadesCaneca: { where: { revogadoEm: null } },
  comprasCaneca: true,
  lancamentosCaixa: { orderBy: { confirmadoEm: 'desc' as const } },
  vendasPresenciais: { orderBy: { createdAt: 'desc' as const }, take: 50 },
} satisfies Prisma.EventoPirelliVisitanteInclude

/** Busca única pelo participante para a operação no estande. */
export async function buscarVisitanteAtendimentoPorId(id: string, eventoId: string) {
  return prisma.eventoPirelliVisitante.findFirst({
    where: { id, eventoId },
    include: includeAtendimento,
  })
}

export type ResultadoBuscaAtendimento =
  | { tipo: 'unico'; visitante: NonNullable<Awaited<ReturnType<typeof buscarVisitanteAtendimentoPorId>>> }
  | { tipo: 'multiplos'; candidatos: { id: string; nomeCompleto: string; whatsapp: string; instagram: string | null; createdAt: Date }[] }
  | null

/**
 * "Maria" não tem dígitos: incluir o braço de telefone faria `whatsapp contains ''`,
 * que casa com todo mundo. Só entra na busca por telefone quando há dígitos de fato.
 * Mais de um resultado nunca escolhe silenciosamente — devolve a lista para o atendente decidir.
 */
export async function buscarAtendimento(eventoId: string, busca: string): Promise<ResultadoBuscaAtendimento> {
  const codigoQr = extrairCodigoQrEvento(busca)
  const digitos = busca.replace(/\D/g, '')
  const or: Prisma.EventoPirelliVisitanteWhereInput[] = codigoQr
    ? [{ codigoQr }]
    : [{ nomeCompleto: { contains: busca, mode: 'insensitive' } }]
  if (!codigoQr && digitos) or.push({ whatsapp: { contains: digitos } })

  const candidatos = await prisma.eventoPirelliVisitante.findMany({
    where: { eventoId, OR: or },
    orderBy: { createdAt: 'desc' },
    take: 21,
    select: { id: true, nomeCompleto: true, whatsapp: true, instagram: true, createdAt: true },
  })
  if (!candidatos.length) return null
  if (candidatos.length === 1) {
    const visitante = await buscarVisitanteAtendimentoPorId(candidatos[0].id, eventoId)
    return visitante ? { tipo: 'unico', visitante } : null
  }
  return { tipo: 'multiplos', candidatos: candidatos.slice(0, 20) }
}

/** Idempotente pela chave gerada no cliente: duplo clique/retry no mesmo pedido não cria uma segunda venda. */
export async function registrarCompraCaneca(args: {
  eventoId: string
  visitanteId: string
  quantidade: number
  nomeGravacaoSnapshot: string | null
  referenciaVenda?: string | null
  formaPagamento: 'PIX_EXTERNO' | 'DINHEIRO' | 'CARTAO_CREDITO_MAQUININHA' | 'CARTAO_DEBITO_MAQUININHA' | 'OUTRO'
  valorUnitarioSnapshot: number
  valorPago: number
  pagamentoConfirmadoEm: Date
  pagamentoConfirmadoPor: string
  referenciaPagamento?: string | null
  chaveIdempotencia: string
}, clienteExistente?: TransactionClient) {
  const cliente = clienteExistente ?? prisma
  return cliente.eventoPirelliCompraCaneca.upsert({
    where: { chaveIdempotencia: args.chaveIdempotencia },
    create: {
      eventoId: args.eventoId,
      visitanteId: args.visitanteId,
      quantidade: args.quantidade,
      nomeGravacaoSnapshot: args.nomeGravacaoSnapshot,
      referenciaVenda: args.referenciaVenda ?? null,
      formaPagamento: args.formaPagamento,
      valorUnitarioSnapshot: args.valorUnitarioSnapshot,
      valorPago: args.valorPago,
      pagamentoConfirmadoEm: args.pagamentoConfirmadoEm,
      pagamentoConfirmadoPor: args.pagamentoConfirmadoPor,
      referenciaPagamento: args.referenciaPagamento ?? null,
      chaveIdempotencia: args.chaveIdempotencia,
    },
    update: {},
  })
}

/** Neutraliza prefixos que o Excel/LibreOffice interpretam como início de fórmula. */
export function escaparCelulaCsv(valor: unknown) {
  const texto = String(valor ?? '')
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto
}

export function montarCsv(linhas: (string | number | null | undefined)[][]) {
  return linhas.map((linha) => linha.map((valor) => `"${escaparCelulaCsv(valor).replace(/"/g, '""')}"`).join(';')).join('\n')
}

export async function linhasCsvLeads(eventoId: string) {
  const itens = await prisma.eventoPirelliVisitante.findMany({ where: { eventoId }, orderBy: { createdAt: 'desc' } })
  return [
    ['nome_completo', 'whatsapp', 'email', 'cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'moto_marca', 'moto_modelo', 'moto_ano', 'nome_gravacao_caneca', 'consentimento_marketing', 'criado_em'],
    ...itens.map((item) => [
      item.nomeCompleto,
      item.whatsapp,
      item.email,
      item.enderecoCep,
      item.enderecoRua,
      item.enderecoNumero,
      item.enderecoComplemento,
      item.enderecoBairro,
      item.enderecoCidade,
      item.enderecoEstado,
      item.motoMarca,
      item.motoModelo,
      item.motoAno,
      item.nomeGravacao,
      item.consentimentoMarketingEm ? 'sim' : 'não',
      item.createdAt.toISOString(),
    ]),
  ]
}

export async function linhasCsvCompras(eventoId: string) {
  const itens = await prisma.eventoPirelliCompraCaneca.findMany({
    where: { eventoId },
    include: { visitante: true },
    orderBy: { registradoEm: 'asc' },
  })
  return [
    ['nome_gravacao', 'nome_completo', 'whatsapp', 'quantidade', 'status', 'forma_pagamento', 'valor_unitario', 'valor_pago', 'pagamento_confirmado_em', 'pagamento_confirmado_por', 'referencia_pagamento', 'referencia_venda', 'registrado_em', 'entregue_em', 'entregue_por'],
    ...itens.map((item) => [
      item.nomeGravacaoSnapshot,
      item.visitante?.nomeCompleto,
      item.visitante?.whatsapp,
      item.quantidade,
      item.status,
      item.formaPagamento,
      item.valorUnitarioSnapshot ? Number(item.valorUnitarioSnapshot) : null,
      item.valorPago ? Number(item.valorPago) : null,
      item.pagamentoConfirmadoEm?.toISOString(),
      item.pagamentoConfirmadoPor,
      item.referenciaPagamento,
      item.referenciaVenda,
      item.registradoEm.toISOString(),
      item.entregueEm?.toISOString(),
      item.entreguePor,
    ]),
  ]
}
