import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { obterPreferencia } from '@/lib/mercadopago'
import { reconciliarPagamentosEventos } from '@/lib/eventos/reconciliacao'
import {
  checkoutTentativaEventoValida,
  reservaCheckoutEventoAtiva,
  STATUS_PAGAMENTO_EVENTO_EM_PROCESSAMENTO,
} from '@/lib/eventos/retomada-checkout'

export const dynamic = 'force-dynamic'

const SEM_CACHE = { 'Cache-Control': 'private, no-store, max-age=0' }
const MAX_PAYLOAD_BYTES = 1_024

function baseUrlPublica() {
  const configurada = process.env.NEXTAUTH_URL || 'https://www.forzamotos.com.br'
  const url = new URL(configurada)
  if (url.hostname === 'forzamotos.com.br') url.hostname = 'www.forzamotos.com.br'
  return url.origin
}

function naoLocalizada() {
  return NextResponse.json(
    { error: 'Tentativa de inscrição não localizada.' },
    { status: 404, headers: SEM_CACHE },
  )
}

async function localizarInscricao(checkoutTentativaId: string) {
  return prisma.eventoInscricao.findUnique({
    where: { checkoutTentativaId },
    select: {
      id: true,
      status: true,
      mpStatus: true,
      mpPreferenciaId: true,
      consultaToken: true,
      reservaExpiraEm: true,
      pagamentoResultadoIncerto: true,
      evento: { select: { slug: true } },
      tentativasPagamento: {
        where: { status: { in: STATUS_PAGAMENTO_EVENTO_EM_PROCESSAMENTO } },
        select: { id: true },
        take: 1,
      },
    },
  })
}

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json(
      { error: 'Consulta inválida.' },
      { status: 415, headers: SEM_CACHE },
    )
  }

  const tamanhoDeclarado = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Consulta inválida.' }, { status: 413, headers: SEM_CACHE })
  }

  let texto: string
  let body: unknown
  try {
    texto = await request.text()
    if (new TextEncoder().encode(texto).byteLength > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Consulta inválida.' }, { status: 413, headers: SEM_CACHE })
    }
    body = JSON.parse(texto)
  } catch {
    return NextResponse.json({ error: 'Consulta inválida.' }, { status: 400, headers: SEM_CACHE })
  }

  const objeto = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null
  if (!objeto || Object.keys(objeto).some((campo) => campo !== 'checkoutTentativaId')) {
    return naoLocalizada()
  }
  const checkoutTentativaId = objeto.checkoutTentativaId
  const chaveHeader = request.headers.get('idempotency-key')
  if (
    !checkoutTentativaEventoValida(checkoutTentativaId) ||
    !checkoutTentativaEventoValida(chaveHeader) ||
    checkoutTentativaId.toLowerCase() !== chaveHeader.toLowerCase()
  ) {
    return naoLocalizada()
  }

  let inscricao = await localizarInscricao(checkoutTentativaId.toLowerCase())
  if (!inscricao || inscricao.evento.slug !== slug) return naoLocalizada()

  if (inscricao.status === 'PENDENTE') {
    await reconciliarPagamentosEventos({
      inscricaoIds: [inscricao.id],
      limite: 1,
      forcarConsulta: true,
    }).catch((error) => {
      console.warn(`[eventos/retomar] Reconciliação transitória falhou para ${inscricao!.id}`, error)
    })
    inscricao = await localizarInscricao(checkoutTentativaId.toLowerCase())
    if (!inscricao || inscricao.evento.slug !== slug) return naoLocalizada()
  }

  if (!inscricao.consultaToken) return naoLocalizada()

  const statusUrl = `${baseUrlPublica()}/eventos/sucesso?token=${encodeURIComponent(inscricao.consultaToken)}`
  const reservaAtiva = reservaCheckoutEventoAtiva(inscricao)
  const pagamentoEmProcessamento = inscricao.tentativasPagamento.length > 0
  let initPoint: string | null = null

  if (
    inscricao.status === 'PENDENTE' &&
    reservaAtiva &&
    inscricao.mpPreferenciaId &&
    !pagamentoEmProcessamento
  ) {
    initPoint = await obterPreferencia(inscricao.mpPreferenciaId)
      .then((preferencia) => preferencia.init_point)
      .catch((error) => {
        console.warn(`[eventos/retomar] Preferência indisponível para ${inscricao!.id}`, error)
        return null
      })
  }

  const processando = inscricao.status === 'PENDENTE' && !initPoint
  return NextResponse.json(
    {
      status: inscricao.status,
      pagamento: inscricao.mpStatus,
      statusUrl,
      initPoint,
      processando,
      podeRetomarPagamento: Boolean(initPoint),
    },
    {
      status: processando ? 202 : 200,
      headers: {
        ...SEM_CACHE,
        ...(processando ? { 'Retry-After': '2' } : {}),
      },
    },
  )
}
