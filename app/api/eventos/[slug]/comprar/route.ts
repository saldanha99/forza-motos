import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import {
  ErroPreferenciaPagamento,
  chaveIdempotenciaMP,
  criarPreferencia,
  montarPayer,
  obterPreferencia,
  reconciliarPreferencia,
} from '@/lib/mercadopago'
import { prisma } from '@/lib/prisma'
import {
  criarTokenConsultaEvento,
  DURACAO_RESERVA_EVENTO_MINUTOS,
  EntradaCheckoutEvento,
  EventoCheckoutError,
  normalizarCheckoutEvento,
  validarIdempotencyKey,
} from '@/lib/eventos/checkout'
import { travarCapacidadeEvento } from '@/lib/eventos/lock'
import {
  agendarNotificacoesAprovacaoEvento,
  notificarAprovacaoEvento,
} from '@/lib/eventos/notificacoes'

export const dynamic = 'force-dynamic'

const MAX_PAYLOAD_BYTES = 16 * 1024
const CAMPOS_CHECKOUT = new Set([
  'nome',
  'email',
  'telefone',
  'cpf',
  'cep',
  'numeroResidencia',
  'motoModelo',
  'temGarupa',
  'nomeGarupa',
  'tipoAcomodacao',
  'opcaoVagaLabel',
  'checkoutTentativaId',
])

type InscricaoReservada = Awaited<ReturnType<typeof reservarInscricao>>['inscricao']

function mesmaTentativa(inscricao: InscricaoReservada, entrada: EntradaCheckoutEvento, eventoId: string) {
  return (
    inscricao.eventoId === eventoId &&
    inscricao.nome === entrada.nome &&
    inscricao.email === entrada.email &&
    inscricao.telefone === entrada.telefone &&
    inscricao.cpf === entrada.cpf &&
    inscricao.cep === entrada.cep &&
    inscricao.numeroResidencia === entrada.numeroResidencia &&
    inscricao.motoModelo === entrada.motoModelo &&
    inscricao.temGarupa === entrada.temGarupa &&
    inscricao.nomeGarupa === entrada.nomeGarupa &&
    inscricao.tipoAcomodacao === entrada.tipoAcomodacao &&
    inscricao.quantidade === entrada.quantidadeVagas &&
    inscricao.opcaoVagaLabel === (entrada.opcaoVaga?.label ?? null) &&
    Number(inscricao.total) === entrada.total
  )
}

async function reservarInscricao(input: {
  evento: {
    id: string
    vagas: number | null
    titulo: string
    dataInicio: Date
    local: string
  }
  entrada: EntradaCheckoutEvento
  checkoutTentativaId: string
  agora: Date
}) {
  const { evento, entrada, checkoutTentativaId, agora } = input
  const gratuito = entrada.total === 0
  const reservaExpiraEm = gratuito
    ? null
    : new Date(agora.getTime() + DURACAO_RESERVA_EVENTO_MINUTOS * 60_000)

  return prisma.$transaction(
    async (tx) => {
      // Serializa toda alteração de capacidade do evento, inclusive quando duas
      // instâncias do app recebem o último lugar ao mesmo tempo.
      await travarCapacidadeEvento(tx, evento.id)

      await tx.eventoInscricao.updateMany({
        where: {
          eventoId: evento.id,
          status: 'PENDENTE',
          pagamentoResultadoIncerto: false,
          reservaExpiraEm: { lte: agora },
        },
        data: {
          status: 'CANCELADO',
          mpStatus: 'expired',
          reservaExpiraEm: null,
        },
      })

      const existente = await tx.eventoInscricao.findUnique({
        where: { checkoutTentativaId },
      })
      if (existente) {
        if (!mesmaTentativa(existente, entrada, evento.id)) {
          throw new EventoCheckoutError(
            'Esta tentativa já foi utilizada com outros dados. Tente novamente.',
            409,
            'idempotency_key_reutilizada',
          )
        }
        if (existente.status === 'CANCELADO') {
          throw new EventoCheckoutError(
            'Esta tentativa expirou ou foi cancelada. Inicie uma nova inscrição.',
            409,
            'tentativa_cancelada',
          )
        }
        return { inscricao: existente, criada: false }
      }

      const inscricaoDaMesmaPessoa = await tx.eventoInscricao.findFirst({
        where: {
          eventoId: evento.id,
          ...(entrada.cpf ? { cpf: entrada.cpf } : { telefone: entrada.telefone }),
          OR: [
            { status: 'PAGO' },
            {
              status: 'PENDENTE',
              OR: [
                { reservaExpiraEm: { gt: agora } },
                { pagamentoResultadoIncerto: true },
              ],
            },
          ],
        },
        select: { status: true },
      })
      if (inscricaoDaMesmaPessoa) {
        throw new EventoCheckoutError(
          inscricaoDaMesmaPessoa.status === 'PAGO'
            ? 'Já existe uma inscrição confirmada para este participante.'
            : 'Já existe uma reserva ativa para este participante. Use o link do pagamento já iniciado ou aguarde a expiração.',
          409,
          'participante_ja_inscrito',
        )
      }

      if (evento.vagas !== null) {
        const ocupacao = await tx.eventoInscricao.aggregate({
          where: {
            eventoId: evento.id,
            OR: [
              { status: 'PAGO' },
              {
                status: 'PENDENTE',
                OR: [
                  { reservaExpiraEm: { gt: agora } },
                  { pagamentoResultadoIncerto: true },
                ],
              },
            ],
          },
          _sum: { quantidade: true },
        })
        const ocupadas = ocupacao._sum.quantidade ?? 0
        if (ocupadas + entrada.quantidadeVagas > evento.vagas) {
          const restantes = Math.max(0, evento.vagas - ocupadas)
          throw new EventoCheckoutError(
            restantes === 0
              ? 'As vagas deste evento estão esgotadas.'
              : `Restam apenas ${restantes} vaga${restantes === 1 ? '' : 's'} neste evento.`,
            409,
            'evento_sem_vagas',
          )
        }
      }

      const inscricao = await tx.eventoInscricao.create({
        data: {
          eventoId: evento.id,
          nome: entrada.nome,
          email: entrada.email,
          telefone: entrada.telefone,
          cpf: entrada.cpf,
          cep: entrada.cep,
          numeroResidencia: entrada.numeroResidencia,
          quantidade: entrada.quantidadeVagas,
          temGarupa: entrada.temGarupa,
          nomeGarupa: entrada.nomeGarupa,
          tipoAcomodacao: entrada.tipoAcomodacao,
          motoModelo: entrada.motoModelo,
          total: entrada.total,
          opcaoVagaLabel: entrada.opcaoVaga?.label,
          opcaoVagaPreco: entrada.opcaoVaga?.preco,
          status: gratuito ? 'PAGO' : 'PENDENTE',
          mpStatus: gratuito ? 'free' : 'preference_pending',
          checkoutTentativaId,
          consultaToken: criarTokenConsultaEvento(),
          reservaExpiraEm,
        },
      })

      if (gratuito) {
        // Gratuito também é uma confirmação: e-mail e WhatsApp são obrigações
        // do mesmo commit que ocupa a vaga.
        await agendarNotificacoesAprovacaoEvento({ ...inscricao, evento }, tx)
      }

      return { inscricao, criada: true }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    },
  )
}

function baseUrlPublica() {
  const configurada = process.env.NEXTAUTH_URL || 'https://www.forzamotos.com.br'
  const url = new URL(configurada)
  if (url.hostname === 'forzamotos.com.br') url.hostname = 'www.forzamotos.com.br'
  return url.origin
}

function urlImagem(imagemUrl: string | null, baseUrl: string) {
  if (!imagemUrl) return undefined
  try {
    return new URL(imagemUrl, baseUrl).toString()
  } catch {
    return undefined
  }
}

function respostaErro(error: unknown) {
  if (error instanceof EventoCheckoutError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return NextResponse.json(
      { error: 'Esta tentativa já está sendo processada. Aguarde e tente novamente.', code: 'tentativa_em_processamento' },
      { status: 409 },
    )
  }
  console.error('[eventos/comprar] Erro não tratado:', error)
  return NextResponse.json({ error: 'Não foi possível concluir a inscrição.' }, { status: 500 })
}

async function lerBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new EventoCheckoutError('Envie os dados em formato JSON.', 415, 'content_type_invalido')
  }
  const tamanhoDeclarado = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > MAX_PAYLOAD_BYTES) {
    throw new EventoCheckoutError('Dados da inscrição muito grandes.', 413, 'payload_muito_grande')
  }

  const texto = await request.text()
  if (new TextEncoder().encode(texto).byteLength > MAX_PAYLOAD_BYTES) {
    throw new EventoCheckoutError('Dados da inscrição muito grandes.', 413, 'payload_muito_grande')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(texto)
  } catch {
    throw new EventoCheckoutError('O corpo da requisição não contém um JSON válido.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new EventoCheckoutError('Dados da inscrição inválidos.')
  }
  if (Object.keys(parsed).some((campo) => !CAMPOS_CHECKOUT.has(campo))) {
    throw new EventoCheckoutError('A inscrição contém campos não permitidos.')
  }
  return parsed as Record<string, unknown>
}

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  let body: Record<string, unknown>
  try {
    body = await lerBody(request)
  } catch (error) {
    return respostaErro(error)
  }

  try {
    const evento = await prisma.evento.findUnique({
      where: { slug: params.slug, publicado: true, ativo: true },
    })
    if (!evento) throw new EventoCheckoutError('Evento não encontrado.', 404, 'evento_nao_encontrado')

    const checkoutTentativaId = validarIdempotencyKey(
      request.headers.get('idempotency-key'),
      body.checkoutTentativaId,
    )
    const entrada = normalizarCheckoutEvento(evento, body)
    const agora = new Date()
    const reserva = await reservarInscricao({
      evento: {
        id: evento.id,
        vagas: evento.vagas,
        titulo: evento.titulo,
        dataInicio: evento.dataInicio,
        local: evento.local,
      },
      entrada,
      checkoutTentativaId,
      agora,
    })
    const { inscricao } = reserva
    const baseUrl = baseUrlPublica()
    const statusUrl = `${baseUrl}/eventos/sucesso?token=${encodeURIComponent(inscricao.consultaToken!)}`

    if (inscricao.status === 'PAGO') {
      // O UPSERT não duplica; aqui drenamos imediatamente as obrigações que já
      // foram gravadas na mesma transação da inscrição gratuita/aprovação.
      await notificarAprovacaoEvento({ ...inscricao, evento }).catch((error) => {
        console.error('[eventos/comprar] Confirmação ficou na outbox para retry:', error)
      })
      return NextResponse.json({
        sucesso: true,
        gratuito: entrada.total === 0,
        redirectUrl: statusUrl,
        statusUrl,
      })
    }

    if (!reserva.criada) {
      if (!inscricao.mpPreferenciaId) {
        if (inscricao.pagamentoResultadoIncerto) {
          const reconciliada = await reconciliarPreferencia(`evento_${inscricao.id}`).catch(() => null)
          if (reconciliada) {
            await prisma.eventoInscricao.updateMany({
              where: { id: inscricao.id, status: 'PENDENTE', mpPreferenciaId: null },
              data: {
                mpPreferenciaId: reconciliada.id,
                mpStatus: 'pending',
                pagamentoResultadoIncerto: false,
              },
            })
            return NextResponse.json({
              sucesso: true,
              gratuito: false,
              init_point: reconciliada.init_point,
              statusUrl,
            })
          }
        }
        return NextResponse.json(
          {
            sucesso: false,
            processando: true,
            retry_after_ms: 1200,
            error: 'O Mercado Pago ainda está confirmando a abertura do pagamento. Aguarde alguns segundos e tente novamente.',
            statusUrl,
          },
          { status: 202, headers: { 'Retry-After': '1' } },
        )
      }
      const preferencia = await obterPreferencia(inscricao.mpPreferenciaId)
      return NextResponse.json({
        sucesso: true,
        gratuito: false,
        init_point: preferencia.init_point,
        statusUrl,
      })
    }

    try {
      const preferencia = await criarPreferencia({
        items: [
          {
            id: evento.id,
            title: `Ingresso — ${evento.titulo}${entrada.opcaoVaga ? ` (${entrada.opcaoVaga.label})` : ''}`,
            quantity: 1,
            unit_price: entrada.total,
            picture_url: urlImagem(evento.imagemUrl, baseUrl),
          },
        ],
        payer: montarPayer({
          email: entrada.email,
          nome: entrada.nome,
          telefone: entrada.telefone,
          cpf: entrada.cpf,
          cep: entrada.cep,
          numero: entrada.numeroResidencia,
        }),
        external_reference: `evento_${inscricao.id}`,
        back_urls: {
          success: statusUrl,
          failure: statusUrl,
          pending: statusUrl,
        },
        idempotencyKey: chaveIdempotenciaMP(`evento:${checkoutTentativaId}`),
        expirationDateTo: inscricao.reservaExpiraEm!,
        somentePix: true,
      })

      if (!preferencia.init_point) throw new Error('Preferência sem URL de pagamento')
      const atualizada = await prisma.eventoInscricao.updateMany({
        where: {
          id: inscricao.id,
          status: 'PENDENTE',
          mpPreferenciaId: null,
        },
        data: {
          mpPreferenciaId: preferencia.id,
          mpStatus: 'pending',
          pagamentoResultadoIncerto: false,
        },
      })
      if (atualizada.count !== 1) throw new Error('Inscrição deixou de estar pendente')

      return NextResponse.json({
        sucesso: true,
        gratuito: false,
        init_point: preferencia.init_point,
        statusUrl,
      })
    } catch (error) {
      const resultadoIncerto =
        error instanceof ErroPreferenciaPagamento ? error.resultadoIncerto : true
      await prisma.eventoInscricao.updateMany({
        where: { id: inscricao.id, status: 'PENDENTE', mpPreferenciaId: null },
        data: resultadoIncerto
          ? {
              mpStatus: 'preference_uncertain',
              pagamentoResultadoIncerto: true,
            }
          : {
              status: 'CANCELADO',
              reservaExpiraEm: null,
              mpStatus: 'preference_error',
              pagamentoResultadoIncerto: false,
            },
      }).catch((compensacaoError) => {
        console.error('[eventos/comprar] Falha ao compensar reserva:', compensacaoError)
      })
      console.error('[eventos/comprar] Falha ao criar preferência:', error)
      if (resultadoIncerto) {
        return NextResponse.json(
          {
            sucesso: false,
            processando: true,
            retry_after_ms: 1200,
            error: 'O Mercado Pago ainda está confirmando a abertura do pagamento. Aguarde alguns segundos e tente novamente.',
            statusUrl,
          },
          { status: 202, headers: { 'Retry-After': '1' } },
        )
      }
      return NextResponse.json(
        {
          error: 'Não foi possível abrir o pagamento. A reserva foi liberada; tente novamente.',
          code: 'preferencia_falhou',
        },
        { status: 502 },
      )
    }
  } catch (error) {
    return respostaErro(error)
  }
}
