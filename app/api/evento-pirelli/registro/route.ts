import { NextResponse } from 'next/server'
import { Prisma, type EventoPirelliVisitante } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { capturarLead } from '@/lib/crm/leads'
import { eventoDisponivel, limparNomeGravacao, nomeGravacaoValido, normalizarWhatsappEvento, novoCodigoQr, obterEventoPirelli, paraBooleano } from '@/lib/evento-pirelli'
import {
  LIMITE_REGISTRO_POR_IP,
  LIMITE_REGISTRO_POR_WHATSAPP,
  consumirLimiteRegistro,
  ipDoRegistro,
  limparJanelasAntigasDoRegistro,
} from '@/lib/evento-pirelli/rate-limit'

export const dynamic = 'force-dynamic'

/** Cadastro de estande: nome, telefone e dois checkboxes. 8 KB é folga larga. */
const MAX_PAYLOAD_BYTES = 8 * 1024
const CAMPOS = new Set(['nomeCompleto', 'nomeGravacao', 'whatsapp', 'email', 'instagram', 'confirmouNome', 'consentimentoMarketing', 'chaveSubmissao'])
/**
 * A chave é um token opaco gerado no dispositivo (`crypto.randomUUID` quando
 * existe). Não exigimos formato UUID: navegador antigo ou contexto sem
 * `crypto.randomUUID` cai no fallback do cliente, e um 400 aqui deixaria a
 * pessoa sem conseguir se cadastrar no meio do evento.
 */
const CHAVE_SUBMISSAO = /^[A-Za-z0-9._:-]{16,100}$/

type EntradaRegistro = {
  nomeCompleto: string
  nomeGravacao: string
  whatsapp: string
  email: string | null
  instagram: string | null
  consentimentoMarketing: boolean
  chaveSubmissao: string
}

/**
 * Validação estrita e barata antes de qualquer escrita: tipo de cada campo,
 * conjunto fechado de chaves e teto de bytes. `confirmouNome` precisa ser o
 * booleano `true` — a string "false" passava como confirmação e decidia o que
 * ia gravado na caneca.
 */
async function lerEntrada(request: Request): Promise<EntradaRegistro | null> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null
  const tamanhoDeclarado = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > MAX_PAYLOAD_BYTES) return null
  const texto = await request.text()
  if (new TextEncoder().encode(texto).byteLength > MAX_PAYLOAD_BYTES) return null

  let body: unknown
  try { body = JSON.parse(texto) } catch { return null }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const registro = body as Record<string, unknown>
  if (Object.keys(registro).some((campo) => !CAMPOS.has(campo))) return null
  // confirmouNome decide o que vai gravado na caneca: só o booleano `true`
  // confirma. O opt-in de marketing continua tolerando a string que alguns
  // formulários enviam — `paraBooleano` já trata "false" como falso, e um 400
  // aqui deixaria a pessoa sem se cadastrar por causa do checkbox opcional.
  if (registro.confirmouNome !== true) return null
  if (registro.consentimentoMarketing !== undefined && registro.consentimentoMarketing !== null
      && typeof registro.consentimentoMarketing !== 'boolean' && typeof registro.consentimentoMarketing !== 'string') return null

  const camposTexto = ['nomeCompleto', 'nomeGravacao', 'whatsapp', 'chaveSubmissao'] as const
  if (camposTexto.some((campo) => typeof registro[campo] !== 'string')) return null
  if (registro.email !== undefined && registro.email !== null && typeof registro.email !== 'string') return null
  if (registro.instagram !== undefined && registro.instagram !== null && typeof registro.instagram !== 'string') return null

  const nomeCompleto = (registro.nomeCompleto as string).trim()
  const nomeGravacao = limparNomeGravacao(registro.nomeGravacao as string)
  const whatsappBruto = registro.whatsapp as string
  const chaveSubmissao = (registro.chaveSubmissao as string).trim()
  const email = String(registro.email ?? '').trim()
  const instagram = String(registro.instagram ?? '').trim().replace(/^@/, '')
  if (!nomeCompleto || nomeCompleto.length > 120 || whatsappBruto.length > 32) return null
  if (!CHAVE_SUBMISSAO.test(chaveSubmissao)) return null
  if (email.length > 254 || instagram.length > 64 || nomeGravacao.length > 100) return null

  return {
    nomeCompleto,
    nomeGravacao,
    whatsapp: normalizarWhatsappEvento(whatsappBruto),
    email: email || null,
    instagram: instagram || null,
    consentimentoMarketing: paraBooleano(registro.consentimentoMarketing),
    chaveSubmissao,
  }
}

function respostaVisitante(visitante: { id: string; codigoQr: string; nomeGravacao: string }, repetido = false) {
  return NextResponse.json({ ok: true, visitante, ...(repetido ? { repetido: true } : {}) }, { status: repetido ? 200 : 201 })
}

/**
 * O visitante é criado ANTES de qualquer efeito no CRM: quem perde a corrida
 * perde na constraint única (chaveSubmissao ou eventoId+whatsapp) e vai embora
 * sem ter tocado no lead de ninguém — nem sobrescrevendo o nome, nem gravando
 * um toque, nem enfileirando boas-vindas para um número que não é seu.
 */
async function reservarVisitante(eventoId: string, entrada: EntradaRegistro, consentimentoMarketingEm: Date | null) {
  try {
    const visitante = await prisma.eventoPirelliVisitante.create({
      data: {
        eventoId,
        nomeCompleto: entrada.nomeCompleto,
        nomeGravacao: entrada.nomeGravacao,
        nomeGravacaoConfirmadoEm: new Date(),
        whatsapp: entrada.whatsapp,
        email: entrada.email,
        instagram: entrada.instagram,
        consentimentoMarketingEm,
        chaveSubmissao: entrada.chaveSubmissao,
        codigoQr: novoCodigoQr(),
      },
    })
    return { tipo: 'criado' as const, visitante }
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    // Idempotência: só devolve o token de QR a quem prova posse via a mesma
    // chaveSubmissao (mesmo dispositivo reenviando). Um WhatsApp repetido com
    // chave diferente não prova nada — devolver o token aqui deixaria qualquer
    // pessoa com o telefone alheio fazer o quiz e retirar o brinde de outra.
    const pelaChave = await prisma.eventoPirelliVisitante.findUnique({ where: { chaveSubmissao: entrada.chaveSubmissao } })
    if (pelaChave) return { tipo: 'repetido' as const, visitante: pelaChave }
    return { tipo: 'conflito' as const }
  }
}

/** capturarLead abre a própria transação, então o vínculo é um segundo passo — ver `vincularLead`. */
async function capturarLeadDoVisitante(entrada: EntradaRegistro, consentimentoMarketingEm: Date | null) {
  const { lead } = await capturarLead({
    nome: entrada.nomeCompleto,
    whatsapp: entrada.whatsapp,
    origem: 'EVENTO_PIRELLI',
    // Ausência de novo opt-in não revoga um consentimento global anterior
    // do mesmo lead; a recusa deste evento permanece registrada no visitante.
    ...(consentimentoMarketingEm ? { consentimentoMarketingEm } : {}),
    // A mensagem de boas-vindas tem caráter promocional; só entra na fila
    // quando o visitante autorizou marketing no cadastro.
    enfileirarBoasVindas: entrada.consentimentoMarketing,
  })
  return lead
}

/**
 * Vincula o lead ao visitante recém-criado. Se o CRM falhar, a reserva é
 * desfeita para não deixar um cadastro pela metade ocupando o WhatsApp: o
 * visitante reenvia o formulário e a mesma chaveSubmissao volta a valer.
 */
async function vincularLead(visitante: EventoPirelliVisitante, entrada: EntradaRegistro, consentimentoMarketingEm: Date | null) {
  try {
    const lead = await capturarLeadDoVisitante(entrada, consentimentoMarketingEm)
    await prisma.eventoPirelliVisitante.update({ where: { id: visitante.id }, data: { crmLeadId: lead.id } })
  } catch (error) {
    await prisma.eventoPirelliVisitante.delete({ where: { id: visitante.id } }).catch(() => {})
    throw error
  }
}

/** Janela de graça antes de reconciliar: evita disputar com a requisição que acabou de vencer a corrida. */
const IDADE_MINIMA_RECONCILIACAO_MS = 15_000

/** Self-heal do reenvio: processo derrubado entre a reserva e o CRM deixaria o visitante sem lead. */
async function reconciliarLeadDoVisitante(visitante: EventoPirelliVisitante, entrada: EntradaRegistro) {
  if (visitante.crmLeadId) return
  // Duas requisições com a MESMA chave chegam juntas: a perdedora enxerga o
  // visitante da vencedora ainda sem lead. Reconciliar aqui só duplicaria o
  // toque no CRM — a vencedora vai gravar o vínculo em milissegundos.
  if (Date.now() - visitante.createdAt.getTime() < IDADE_MINIMA_RECONCILIACAO_MS) return
  try {
    const lead = await capturarLeadDoVisitante(entrada, visitante.consentimentoMarketingEm)
    await prisma.eventoPirelliVisitante.update({ where: { id: visitante.id }, data: { crmLeadId: lead.id } })
  } catch (error) {
    // O QR já existe e é o que a pessoa precisa agora; o vínculo tenta de novo no próximo reenvio.
    console.error('[evento-pirelli/registro] reconciliação de lead falhou:', error)
  }
}

export async function POST(request: Request) {
  try {
    // Endpoint público de estande: o teto por origem entra antes de qualquer
    // parsing para que rajada de payload inválido também seja barata de recusar.
    if (!await consumirLimiteRegistro('ip', ipDoRegistro(request), LIMITE_REGISTRO_POR_IP)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })
    }
    const entrada = await lerEntrada(request)
    if (!entrada) return NextResponse.json({ error: 'Dados do cadastro inválidos.' }, { status: 400 })
    if (!await consumirLimiteRegistro('whatsapp', entrada.whatsapp, LIMITE_REGISTRO_POR_WHATSAPP)) {
      return NextResponse.json({ error: 'Muitas tentativas para este WhatsApp. Aguarde um minuto.' }, { status: 429 })
    }

    const evento = await obterEventoPirelli()
    if (!eventoDisponivel(evento)) {
      return NextResponse.json({ error: 'Este evento ainda não está disponível.' }, { status: 404 })
    }
    if (entrada.whatsapp.length < 12 || entrada.whatsapp.length > 13) {
      return NextResponse.json({ error: 'Preencha o nome, WhatsApp e confirme o nome de gravação.' }, { status: 400 })
    }
    if (entrada.nomeGravacao.length < 2 || entrada.nomeGravacao.length > evento.limiteNomeGravacao || !nomeGravacaoValido(entrada.nomeGravacao)) {
      return NextResponse.json({ error: `O nome de gravação deve ter entre 2 e ${evento.limiteNomeGravacao} caracteres e não pode ter emoji.` }, { status: 400 })
    }

    const consentimentoMarketingEm = entrada.consentimentoMarketing ? new Date() : null
    const resultado = await reservarVisitante(evento.id, entrada, consentimentoMarketingEm)
    if (resultado.tipo === 'conflito') {
      return NextResponse.json({ error: 'Este WhatsApp já está cadastrado. Procure o atendimento no estande para recuperar seu QR.' }, { status: 409 })
    }
    if (resultado.tipo === 'criado') await vincularLead(resultado.visitante, entrada, consentimentoMarketingEm)
    else await reconciliarLeadDoVisitante(resultado.visitante, entrada)

    return respostaVisitante(
      { id: resultado.visitante.id, codigoQr: resultado.visitante.codigoQr, nomeGravacao: resultado.visitante.nomeGravacao },
      resultado.tipo === 'repetido',
    )
  } catch (error) {
    console.error('[evento-pirelli/registro]', error)
    return NextResponse.json({ error: 'Não foi possível salvar agora. Seus dados continuam no formulário; tente novamente.' }, { status: 500 })
  } finally {
    await limparJanelasAntigasDoRegistro()
  }
}
