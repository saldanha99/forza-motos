import { after, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  normalizarWhatsappEvento,
  obterEventoPirelli,
  whatsappEventoValido,
} from '@/lib/evento-pirelli'
import {
  CODIGO_RECUPERACAO,
  entregarCodigoRecuperacaoNosCanais,
  expiracaoCodigoRecuperacao,
  hashCodigoRecuperacao,
  identificadorRecuperacao,
  mensagemCodigoRecuperacao,
  novoCodigoRecuperacao,
  PREFIXO_IDENTIFICADOR_RECUPERACAO,
  segredoRecuperacaoEventoPirelli,
} from '@/lib/evento-pirelli/recuperacao'
import {
  consumirLimiteRecuperacao,
  ipDoRegistro,
  limparJanelasAntigasDaRecuperacao,
} from '@/lib/evento-pirelli/rate-limit'
import { enviarMensagem } from '@/lib/evolution/client'
import { enviarEmailRecuperacaoEventoPirelli } from '@/lib/email/send'

export const dynamic = 'force-dynamic'

const MAX_PAYLOAD_BYTES = 2 * 1024
const LIMITE_SOLICITAR_POR_IP = 10
const LIMITE_SOLICITAR_POR_WHATSAPP = 3
const LIMITE_CONFIRMAR_POR_IP = 30
const LIMITE_CONFIRMAR_POR_WHATSAPP = 6
const RESPOSTA_NEUTRA = 'Se este WhatsApp estiver cadastrado, enviaremos o mesmo código pelo WhatsApp e pelo e-mail vinculado, quando disponíveis.'

type Entrada =
  | { acao: 'solicitar'; whatsapp: string }
  | { acao: 'confirmar'; whatsapp: string; codigo: string }

async function lerEntrada(request: Request): Promise<Entrada | null> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null
  const tamanhoDeclarado = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > MAX_PAYLOAD_BYTES) return null
  const texto = await request.text()
  if (new TextEncoder().encode(texto).byteLength > MAX_PAYLOAD_BYTES) return null

  let corpo: unknown
  try { corpo = JSON.parse(texto) } catch { return null }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return null
  const registro = corpo as Record<string, unknown>
  const acao = registro.acao
  const whatsappBruto = typeof registro.whatsapp === 'string' ? registro.whatsapp : ''
  const whatsapp = normalizarWhatsappEvento(whatsappBruto)
  if (!whatsappEventoValido(whatsapp)) return null

  if (acao === 'solicitar') {
    if (Object.keys(registro).some((campo) => campo !== 'acao' && campo !== 'whatsapp')) return null
    return { acao, whatsapp }
  }
  if (acao === 'confirmar') {
    if (Object.keys(registro).some((campo) => !['acao', 'whatsapp', 'codigo'].includes(campo))) return null
    const codigo = typeof registro.codigo === 'string' ? registro.codigo.trim() : ''
    if (!CODIGO_RECUPERACAO.test(codigo)) return null
    return { acao, whatsapp, codigo }
  }
  return null
}

async function aguardarRespostaNeutra(inicio: number) {
  const restante = 650 - (Date.now() - inicio)
  if (restante > 0) await new Promise((resolve) => setTimeout(resolve, restante))
}

async function prepararEEntregarCodigo(whatsapp: string) {
  try {
    const evento = await obterEventoPirelli()
    const visitante = await prisma.eventoPirelliVisitante.findUnique({
      where: { eventoId_whatsapp: { eventoId: evento.id, whatsapp } },
      select: { email: true },
    })

    if (visitante) {
      const codigo = novoCodigoRecuperacao()
      const identificador = identificadorRecuperacao(evento.id, whatsapp)
      const token = hashCodigoRecuperacao(
        identificador,
        codigo,
        segredoRecuperacaoEventoPirelli(),
      )
      await prisma.$transaction(async (tx) => {
        // Serializa solicitações do mesmo cadastro: sob concorrência, a segunda
        // invalida a primeira antes de gravar e nunca restam dois OTPs válidos.
        await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${identificador}, 0))`
        await tx.verificationToken.deleteMany({ where: { identifier: identificador } })
        await tx.verificationToken.create({
          data: { identifier: identificador, token, expires: expiracaoCodigoRecuperacao() },
        })
      })

      const entrega = await entregarCodigoRecuperacaoNosCanais({
        whatsapp,
        email: visitante.email,
        codigo,
      }, {
        enviarWhatsapp: ({ whatsapp: numero, codigo: otp }) => enviarMensagem({
          whatsapp: numero,
          mensagem: mensagemCodigoRecuperacao(otp),
          delay: 0,
        }),
        enviarEmail: ({ email, codigo: otp }) => enviarEmailRecuperacaoEventoPirelli({
          para: email,
          codigo: otp,
        }, { idempotencyKey: `evento-pirelli-recuperacao-${token}` }),
      })

      if (!entrega.algumCanalEntregue) {
        await prisma.verificationToken.deleteMany({ where: { identifier: identificador, token } })
        console.error('[evento-pirelli/recuperacao] Nenhum canal confirmou a entrega do código')
      } else {
        if (!entrega.whatsappEntregue) {
          console.warn('[evento-pirelli/recuperacao] WhatsApp não confirmou a entrega do código')
        }
        if (!entrega.emailEntregue) {
          console.warn('[evento-pirelli/recuperacao] E-mail não confirmou a entrega do código')
        }
      }
    }
  } catch {
    // Solicitar é deliberadamente neutro: nem falha interna, nem ausência do
    // cadastro podem produzir uma resposta observavelmente diferente.
    console.error('[evento-pirelli/recuperacao] Não foi possível preparar o código')
  }
}

async function solicitarCodigo(whatsapp: string, inicio: number) {
  // Toda consulta dependente do cadastro e os dois provedores rodam depois da
  // resposta. Assim nem a existência do cadastro nem a latência de um canal
  // podem ser inferidas pelo tempo desta requisição.
  after(() => prepararEEntregarCodigo(whatsapp))
  await aguardarRespostaNeutra(inicio)
  return NextResponse.json({ ok: true, message: RESPOSTA_NEUTRA }, { status: 202 })
}

async function confirmarCodigo(whatsapp: string, codigo: string) {
  const evento = await obterEventoPirelli()
  const identificador = identificadorRecuperacao(evento.id, whatsapp)
  const token = hashCodigoRecuperacao(
    identificador,
    codigo,
    segredoRecuperacaoEventoPirelli(),
  )
  const consumido = await prisma.verificationToken.deleteMany({
    where: { identifier: identificador, token, expires: { gt: new Date() } },
  })
  if (consumido.count !== 1) {
    return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 400 })
  }

  const visitante = await prisma.eventoPirelliVisitante.findUnique({
    where: { eventoId_whatsapp: { eventoId: evento.id, whatsapp } },
    select: { codigoQr: true, nomeCompleto: true, whatsapp: true, email: true },
  })
  if (!visitante) {
    return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, visitante })
}

export async function POST(request: Request) {
  const inicio = Date.now()
  try {
    // Falha fechada antes da consulta de participante: configuração ausente não
    // pode transformar a rota em recuperação por WhatsApp sem prova de posse.
    segredoRecuperacaoEventoPirelli()
    const entrada = await lerEntrada(request)
    if (!entrada) return NextResponse.json({ error: 'Dados de recuperação inválidos.' }, { status: 400 })

    const escopoIp = entrada.acao === 'solicitar' ? 'solicitar-ip' : 'confirmar-ip'
    const escopoWhatsapp = entrada.acao === 'solicitar'
      ? 'solicitar-whatsapp'
      : 'confirmar-whatsapp'
    const limiteIp = entrada.acao === 'solicitar' ? LIMITE_SOLICITAR_POR_IP : LIMITE_CONFIRMAR_POR_IP
    const limiteWhatsapp = entrada.acao === 'solicitar'
      ? LIMITE_SOLICITAR_POR_WHATSAPP
      : LIMITE_CONFIRMAR_POR_WHATSAPP
    const ip = ipDoRegistro(request)
    const [ipPermitido, whatsappPermitido] = await Promise.all([
      consumirLimiteRecuperacao(escopoIp, ip, limiteIp),
      consumirLimiteRecuperacao(escopoWhatsapp, entrada.whatsapp, limiteWhatsapp),
    ])
    if (!ipPermitido || !whatsappPermitido) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })
    }

    if (entrada.acao === 'solicitar') return solicitarCodigo(entrada.whatsapp, inicio)
    return confirmarCodigo(entrada.whatsapp, entrada.codigo)
  } catch (error) {
    console.error('[evento-pirelli/recuperacao]', error)
    return NextResponse.json({ error: 'Não foi possível recuperar o acesso agora.' }, { status: 503 })
  } finally {
    await Promise.all([
      limparJanelasAntigasDaRecuperacao(),
      prisma.verificationToken.deleteMany({
        where: {
          identifier: { startsWith: PREFIXO_IDENTIFICADOR_RECUPERACAO },
          expires: { lt: new Date() },
        },
      }).catch((error) => console.error('[evento-pirelli/recuperacao] limpeza de códigos falhou:', error)),
    ])
  }
}
