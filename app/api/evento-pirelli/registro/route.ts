import { NextResponse } from 'next/server'
import { Prisma, type EventoPirelliVisitante } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { capturarLead } from '@/lib/crm/leads'
import {
  inscricaoEventoPirelliDisponivel,
  mensagemEventoPirelliIndisponivel,
  normalizarWhatsappEvento,
  novoCodigoQr,
  obterEventoPirelli,
  paraBooleano,
  whatsappEventoValido,
} from '@/lib/evento-pirelli'
import {
  LIMITE_REGISTRO_POR_IP,
  LIMITE_REGISTRO_POR_WHATSAPP,
  consumirLimiteRegistro,
  ipDoRegistro,
  limparJanelasAntigasDoRegistro,
} from '@/lib/evento-pirelli/rate-limit'

export const dynamic = 'force-dynamic'

/** Cadastro completo do evento, ainda pequeno mesmo com endereço e moto. */
const MAX_PAYLOAD_BYTES = 16 * 1024
const CAMPOS = new Set([
  'nomeCompleto',
  'whatsapp',
  'email',
  'enderecoCep',
  'enderecoRua',
  'enderecoNumero',
  'enderecoComplemento',
  'enderecoBairro',
  'enderecoCidade',
  'enderecoEstado',
  'motoMarca',
  'motoModelo',
  'motoAno',
  'consentimentoMarketing',
  'chaveSubmissao',
])
/**
 * A chave é um token opaco gerado no dispositivo (`crypto.randomUUID` quando
 * existe). Não exigimos formato UUID: navegador antigo ou contexto sem
 * `crypto.randomUUID` cai no fallback do cliente, e um 400 aqui deixaria a
 * pessoa sem conseguir se cadastrar no meio do evento.
 */
const CHAVE_SUBMISSAO = /^[A-Za-z0-9._:-]{16,100}$/

type EntradaRegistro = {
  nomeCompleto: string
  whatsapp: string
  email: string
  enderecoCep: string
  enderecoRua: string
  enderecoNumero: string
  enderecoComplemento: string | null
  enderecoBairro: string
  enderecoCidade: string
  enderecoEstado: string
  motoMarca: string
  motoModelo: string
  motoAno: number
  consentimentoMarketing: boolean
  chaveSubmissao: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function textoObrigatorio(registro: Record<string, unknown>, campo: string, limite: number) {
  if (typeof registro[campo] !== 'string') return null
  const valor = registro[campo].trim().replace(/\s+/g, ' ')
  return valor && valor.length <= limite ? valor : null
}

/**
 * Validação estrita e barata antes de qualquer escrita: tipo de cada campo,
 * conjunto fechado de chaves e teto de bytes. O nome da caneca não pertence a
 * esta etapa e por isso nem é aceito no contrato público.
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
  // O opt-in continua tolerando a string que alguns formulários enviam.
  if (registro.consentimentoMarketing !== undefined && registro.consentimentoMarketing !== null
      && typeof registro.consentimentoMarketing !== 'boolean' && typeof registro.consentimentoMarketing !== 'string') return null

  const camposTexto = [
    'nomeCompleto', 'whatsapp', 'email', 'enderecoCep', 'enderecoRua',
    'enderecoNumero', 'enderecoBairro', 'enderecoCidade', 'enderecoEstado',
    'motoMarca', 'motoModelo', 'chaveSubmissao',
  ] as const
  if (camposTexto.some((campo) => typeof registro[campo] !== 'string')) return null
  if (registro.enderecoComplemento !== undefined && registro.enderecoComplemento !== null && typeof registro.enderecoComplemento !== 'string') return null
  if (typeof registro.motoAno !== 'string' && typeof registro.motoAno !== 'number') return null

  const nomeCompleto = textoObrigatorio(registro, 'nomeCompleto', 120)
  const email = textoObrigatorio(registro, 'email', 254)?.toLocaleLowerCase('pt-BR') ?? null
  const enderecoRua = textoObrigatorio(registro, 'enderecoRua', 160)
  const enderecoNumero = textoObrigatorio(registro, 'enderecoNumero', 30)
  const enderecoBairro = textoObrigatorio(registro, 'enderecoBairro', 100)
  const enderecoCidade = textoObrigatorio(registro, 'enderecoCidade', 100)
  const motoMarca = textoObrigatorio(registro, 'motoMarca', 80)
  const motoModelo = textoObrigatorio(registro, 'motoModelo', 100)
  const whatsappBruto = registro.whatsapp as string
  const chaveSubmissao = (registro.chaveSubmissao as string).trim()
  const enderecoCep = String(registro.enderecoCep).replace(/\D/g, '')
  const enderecoEstado = String(registro.enderecoEstado).trim().toUpperCase()
  const enderecoComplemento = String(registro.enderecoComplemento ?? '').trim().replace(/\s+/g, ' ')
  const motoAno = Number(registro.motoAno)
  const maiorAnoAceito = new Date().getFullYear() + 1

  if (!nomeCompleto || !email || !EMAIL.test(email) || whatsappBruto.length > 32) return null
  if (!enderecoRua || !enderecoNumero || !enderecoBairro || !enderecoCidade) return null
  if (!/^\d{8}$/.test(enderecoCep) || !/^[A-Z]{2}$/.test(enderecoEstado) || enderecoComplemento.length > 120) return null
  if (!motoMarca || !motoModelo || !Number.isInteger(motoAno) || motoAno < 1900 || motoAno > maiorAnoAceito) return null
  if (!CHAVE_SUBMISSAO.test(chaveSubmissao)) return null

  return {
    nomeCompleto,
    whatsapp: normalizarWhatsappEvento(whatsappBruto),
    email,
    enderecoCep,
    enderecoRua,
    enderecoNumero,
    enderecoComplemento: enderecoComplemento || null,
    enderecoBairro,
    enderecoCidade,
    enderecoEstado,
    motoMarca,
    motoModelo,
    motoAno,
    consentimentoMarketing: paraBooleano(registro.consentimentoMarketing),
    chaveSubmissao,
  }
}

function respostaVisitante(visitante: { id: string; codigoQr: string; nomeCompleto: string }, repetido = false) {
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
        whatsapp: entrada.whatsapp,
        email: entrada.email,
        enderecoCep: entrada.enderecoCep,
        enderecoRua: entrada.enderecoRua,
        enderecoNumero: entrada.enderecoNumero,
        enderecoComplemento: entrada.enderecoComplemento,
        enderecoBairro: entrada.enderecoBairro,
        enderecoCidade: entrada.enderecoCidade,
        enderecoEstado: entrada.enderecoEstado,
        motoMarca: entrada.motoMarca,
        motoModelo: entrada.motoModelo,
        motoAno: entrada.motoAno,
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
    if (!inscricaoEventoPirelliDisponivel(evento)) {
      return NextResponse.json({ error: mensagemEventoPirelliIndisponivel(evento) }, { status: 404 })
    }
    if (!whatsappEventoValido(entrada.whatsapp)) {
      return NextResponse.json({ error: 'Informe um WhatsApp celular brasileiro válido com DDD.' }, { status: 400 })
    }

    const consentimentoMarketingEm = entrada.consentimentoMarketing ? new Date() : null
    const resultado = await reservarVisitante(evento.id, entrada, consentimentoMarketingEm)
    if (resultado.tipo === 'conflito') {
      return NextResponse.json({
        error: 'Este WhatsApp já está cadastrado. Use “Recuperar meu acesso” para receber um código seguro.',
        recuperavel: true,
      }, { status: 409 })
    }
    if (resultado.tipo === 'criado') await vincularLead(resultado.visitante, entrada, consentimentoMarketingEm)
    else await reconciliarLeadDoVisitante(resultado.visitante, entrada)

    return respostaVisitante(
      { id: resultado.visitante.id, codigoQr: resultado.visitante.codigoQr, nomeCompleto: resultado.visitante.nomeCompleto },
      resultado.tipo === 'repetido',
    )
  } catch (error) {
    console.error('[evento-pirelli/registro]', error)
    return NextResponse.json({ error: 'Não foi possível salvar agora. Seus dados continuam no formulário; tente novamente.' }, { status: 500 })
  } finally {
    await limparJanelasAntigasDoRegistro()
  }
}
