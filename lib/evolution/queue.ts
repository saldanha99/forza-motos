/**
 * Fila de mensagens WhatsApp
 *
 * Enfileirar: adiciona à tabela CrmMensagem com status PENDENTE
 * Processar: o cron chama processarFila() e envia via Evolution API dentro do
 * limite global reservado no banco. Chamadas imediatas respeitam o mesmo teto.
 */

import { Prisma, type CrmMensagem } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { enviarMensagem } from './client'
import {
  msgBoasVindas,
  msgAgendamento,
  msgPedidoConfirmado,
  msgPedidoEnviado,
  msgPedidoEntregue,
  msgCarrinhoAbandonado,
  msgPosVenda,
  msgReativacao,
  msgIngressoConfirmado,
} from './templates'

type MensagemTipo =
  | 'BOAS_VINDAS'
  | 'AGENDAMENTO'
  | 'PEDIDO_CONFIRMADO'
  | 'PEDIDO_ENVIADO'
  | 'PEDIDO_ENTREGUE'
  | 'CARRINHO_ABANDONADO'
  | 'POS_VENDA'
  | 'REATIVACAO'
  | 'INGRESSO_CONFIRMADO'
  | 'MANUAL'

export interface EnfileirarParams {
  /** Chave funcional das mensagens transacionais. Repetir a chave devolve a
   * mesma linha, sem criar outro envio. */
  chaveIdempotencia?: string
  whatsapp: string
  nome: string
  tipo: MensagemTipo
  leadId?: string
  userId?: string
  payload?: Record<string, unknown>
  agendadoPara?: Date // default: agora
}

/** Gera o texto da mensagem a partir do tipo e payload */
function gerarConteudo(tipo: MensagemTipo, nome: string, payload: Record<string, unknown>): string {
  switch (tipo) {
    case 'BOAS_VINDAS':
      return msgBoasVindas(nome)
    case 'AGENDAMENTO':
      return msgAgendamento(
        nome,
        String(payload.servico ?? ''),
        String(payload.data ?? ''),
        String(payload.horario ?? ''),
        String(payload.moto ?? ''),
      )
    case 'PEDIDO_CONFIRMADO':
      return msgPedidoConfirmado(nome, String(payload.numeroPedido ?? ''), {
        preVenda: payload.preVenda === true,
        prazoPreVendaDias: Number.isFinite(Number(payload.prazoPreVendaDias))
          ? Number(payload.prazoPreVendaDias)
          : null,
        prazoTotalDias: Number.isFinite(Number(payload.prazoTotalDias))
          ? Number(payload.prazoTotalDias)
          : null,
        retirada: payload.retirada === true,
        nomeCampanha: payload.nomeCampanha ? String(payload.nomeCampanha) : null,
        canecaEventoPirelli: payload.canecaEventoPirelli === true,
        nomeGravacao: payload.nomeGravacao ? String(payload.nomeGravacao) : null,
        quantidadeCanecas: Number.isInteger(Number(payload.quantidadeCanecas))
          ? Number(payload.quantidadeCanecas)
          : null,
        linkConfirmacaoCaneca: payload.linkConfirmacaoCaneca
          ? String(payload.linkConfirmacaoCaneca)
          : null,
      })
    case 'PEDIDO_ENVIADO':
      return msgPedidoEnviado(
        nome,
        String(payload.numeroPedido ?? ''),
        String(payload.rastreio ?? ''),
        String(payload.transportadora ?? 'Transportadora'),
      )
    case 'PEDIDO_ENTREGUE':
      return msgPedidoEntregue(nome, String(payload.numeroPedido ?? ''))
    case 'CARRINHO_ABANDONADO':
      return msgCarrinhoAbandonado(nome, (payload.produtos as string[]) ?? [])
    case 'POS_VENDA':
      return msgPosVenda(nome)
    case 'REATIVACAO':
      return msgReativacao(nome)
    case 'INGRESSO_CONFIRMADO':
      return msgIngressoConfirmado(
        nome,
        String(payload.tituloEvento ?? ''),
        Number(payload.quantidade ?? 1),
        String(payload.total ?? ''),
      )
    case 'MANUAL':
      return String(payload.conteudo ?? '')
    default:
      return `Olá ${nome}! Aqui é a Forza Motos. 🏍️`
  }
}

/** Adiciona mensagem na fila */
/**
 * Cliente do Prisma ou a transação em curso — permite enfileirar a mensagem
 * dentro da mesma transação que criou o lead, para não sobrar mensagem
 * apontando para um lead que acabou revertido.
 */
type ClientePrisma = Pick<typeof prisma, 'crmMensagem'> & Partial<Pick<typeof prisma, 'crmLead'>>

export async function enfileirarMensagem(
  params: EnfileirarParams,
  db: ClientePrisma = prisma,
) {
  const conteudo = gerarConteudo(params.tipo, params.nome, params.payload ?? {})
  const leadSuprimido = db.crmLead
    ? params.leadId
      ? await db.crmLead.findFirst({
          where: { id: params.leadId, whatsappOptOutEm: { not: null } },
          select: { id: true },
        })
      : await db.crmLead.findFirst({
          where: { whatsapp: params.whatsapp, whatsappOptOutEm: { not: null } },
          select: { id: true },
        })
    : null

  const data = {
    chaveIdempotencia: params.chaveIdempotencia,
    whatsapp: params.whatsapp,
    nome: params.nome,
    tipo: params.tipo,
    conteudo,
    leadId: params.leadId,
    userId: params.userId,
    payload: (params.payload ?? {}) as any,
    agendadoPara: params.agendadoPara ?? new Date(),
    status: leadSuprimido ? 'CANCELADA' as const : 'PENDENTE' as const,
  }
  return params.chaveIdempotencia
    ? db.crmMensagem.upsert({
        where: { chaveIdempotencia: params.chaveIdempotencia },
        create: data,
        update: {},
      })
    : db.crmMensagem.create({ data })
}

const MAX_TENTATIVAS = 8
const LEASE_MS = 2 * 60_000
const LIMITE_PADRAO_POR_MINUTO = 5
const LIMITE_MAXIMO_POR_MINUTO = 10
const INTERVALO_PADRAO_MS = 2_500
const JITTER_PADRAO_MS = 1_000
const ORCAMENTO_PADRAO_MS = 22_000

function inteiroConfigurado(
  valor: string | undefined,
  padrao: number,
  minimo: number,
  maximo: number,
): number {
  const numero = Number.parseInt(valor ?? '', 10)
  if (!Number.isFinite(numero)) return padrao
  return Math.max(minimo, Math.min(maximo, numero))
}

/**
 * Teto compartilhado por todos os workers. O valor pode ser reduzido ou
 * aumentado com cuidado, mas nunca passa do limite de proteção da aplicação.
 */
export function limiteWhatsAppPorMinuto(): number {
  return inteiroConfigurado(
    process.env.WHATSAPP_MAX_POR_MINUTO,
    LIMITE_PADRAO_POR_MINUTO,
    1,
    LIMITE_MAXIMO_POR_MINUTO,
  )
}

export function intervaloWhatsAppMs(): number {
  return inteiroConfigurado(
    process.env.WHATSAPP_INTERVALO_MS,
    INTERVALO_PADRAO_MS,
    1_500,
    15_000,
  )
}

function jitterWhatsAppMs(): number {
  const maximo = inteiroConfigurado(
    process.env.WHATSAPP_JITTER_MS,
    JITTER_PADRAO_MS,
    0,
    3_000,
  )
  return maximo > 0 ? Math.floor(Math.random() * (maximo + 1)) : 0
}

function orcamentoFilaWhatsAppMs(): number {
  return inteiroConfigurado(
    process.env.WHATSAPP_ORCAMENTO_MS,
    ORCAMENTO_PADRAO_MS,
    5_000,
    25_000,
  )
}

export function atrasoRetryWhatsAppMs(tentativas: number): number {
  return Math.min(6 * 60 * 60_000, 30_000 * (2 ** Math.max(0, tentativas - 1)))
}

async function reivindicarMensagem(id?: string): Promise<CrmMensagem | null> {
  const filtroId = id ? Prisma.sql`AND "id" = ${id}` : Prisma.empty
  const leaseSegundos = Math.ceil(LEASE_MS / 1000)
  const limitePorMinuto = limiteWhatsAppPorMinuto()
  const intervaloMs = intervaloWhatsAppMs()
  const linhas = await prisma.$queryRaw<CrmMensagem[]>(Prisma.sql`
    WITH trava_global AS (
      -- Uma única transação por vez reserva capacidade. Sem esta trava,
      -- vários webhooks simultâneos poderiam todos observar a mesma vaga.
      SELECT pg_try_advisory_xact_lock(731945201) AS obtida
    ), capacidade AS (
      SELECT
        (SELECT obtida FROM trava_global)
        AND (
          SELECT COUNT(*)
          FROM "CrmMensagem"
          WHERE
            ("enviadaEm" >= NOW() - INTERVAL '1 minute')
            OR (
              "status" = 'ENVIANDO'
              AND "updatedAt" >= NOW() - INTERVAL '1 minute'
            )
            OR (
              "status" IN ('PENDENTE', 'FALHA')
              AND "erro" IS NOT NULL
              AND "tentativas" > 0
              AND "updatedAt" >= NOW() - INTERVAL '1 minute'
            )
        ) < ${limitePorMinuto}
        AND NOT EXISTS (
          SELECT 1
          FROM "CrmMensagem"
          WHERE
            ("enviadaEm" > NOW() - (${intervaloMs} * INTERVAL '1 millisecond'))
            OR (
              "status" = 'ENVIANDO'
              AND "updatedAt" > NOW() - (${intervaloMs} * INTERVAL '1 millisecond')
            )
            OR (
              "status" IN ('PENDENTE', 'FALHA')
              AND "erro" IS NOT NULL
              AND "tentativas" > 0
              AND "updatedAt" > NOW() - (${intervaloMs} * INTERVAL '1 millisecond')
            )
        ) AS disponivel
    ), candidata AS (
      SELECT "id"
      FROM "CrmMensagem"
      WHERE (SELECT disponivel FROM capacidade)
        AND "tentativas" < ${MAX_TENTATIVAS}
        ${filtroId}
        AND (
          ("status" = 'PENDENTE' AND "agendadoPara" <= NOW())
          OR (
            "status" = 'ENVIANDO'
            AND ("leaseExpiraEm" IS NULL OR "leaseExpiraEm" <= NOW())
          )
        )
      ORDER BY "agendadoPara" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "CrmMensagem" AS mensagem
    SET "status" = 'ENVIANDO',
        "tentativas" = mensagem."tentativas" + 1,
        "leaseExpiraEm" = NOW() + (${leaseSegundos} * INTERVAL '1 second'),
        "updatedAt" = NOW()
    FROM candidata
    WHERE mensagem."id" = candidata."id"
    RETURNING mensagem.*
  `)
  return linhas[0] ?? null
}

async function enviarReivindicada(msg: CrmMensagem): Promise<{ enviada: boolean; status: string }> {
  // O cliente pode ter enviado PARE depois que a mensagem entrou na fila.
  // Esta segunda checagem fecha a janela entre o enqueue e o envio externo.
  const optOut = await prisma.crmLead.findFirst({
    where: { whatsapp: msg.whatsapp, whatsappOptOutEm: { not: null } },
    select: { id: true },
  })
  if (optOut) {
    await prisma.crmMensagem.updateMany({
      where: { id: msg.id, status: 'ENVIANDO', tentativas: msg.tentativas },
      data: { status: 'CANCELADA', erro: null, leaseExpiraEm: null },
    })
    return { enviada: false, status: 'CANCELADA' }
  }

  const result = await enviarMensagem({ whatsapp: msg.whatsapp, mensagem: msg.conteudo })

  if (result.ok) {
    await prisma.crmMensagem.updateMany({
      // CAS pelo número da tentativa: um worker cujo lease expirou não pode
      // sobrescrever o resultado de outro worker que retomou a linha.
      where: { id: msg.id, status: 'ENVIANDO', tentativas: msg.tentativas },
      data: {
        status: 'ENVIADA',
        evolutionId: result.id,
        enviadaEm: new Date(),
        erro: null,
        leaseExpiraEm: null,
      },
    })
    if (msg.leadId) {
      await prisma.crmLead.update({
        where: { id: msg.leadId },
        data: { etapa: 'CONTATADO' },
      }).catch(() => {})
    }
    return { enviada: true, status: 'ENVIADA' }
  }

  const esgotou = msg.tentativas >= MAX_TENTATIVAS
  await prisma.crmMensagem.updateMany({
    where: { id: msg.id, status: 'ENVIANDO', tentativas: msg.tentativas },
    data: {
      status: esgotou ? 'FALHA' : 'PENDENTE',
      erro: String(result.erro ?? 'Falha desconhecida').slice(0, 4000),
      leaseExpiraEm: null,
      agendadoPara: esgotou
        ? msg.agendadoPara
        : new Date(Date.now() + atrasoRetryWhatsAppMs(msg.tentativas)),
    },
  })
  return { enviada: false, status: esgotou ? 'FALHA' : 'PENDENTE' }
}

/** Tenta entregar uma linha imediatamente. Se falhar, ela continua na outbox. */
export async function processarMensagem(id: string): Promise<{
  processada: boolean
  enviada: boolean
  status: string
}> {
  const msg = await reivindicarMensagem(id)
  if (!msg) {
    const atual = await prisma.crmMensagem.findUnique({ where: { id }, select: { status: true } })
    return {
      processada: false,
      enviada: atual ? ['ENVIADA', 'ENTREGUE', 'LIDA'].includes(atual.status) : false,
      status: atual?.status ?? 'NAO_ENCONTRADA',
    }
  }
  const resultado = await enviarReivindicada(msg)
  return { processada: true, ...resultado }
}

/** Processa a fila com claim atômico; workers concorrentes não pegam a mesma linha. */
export async function processarFila(limite = 20): Promise<{ enviadas: number; falhas: number }> {
  const limiteSeguro = Math.max(1, Math.min(limite, limiteWhatsAppPorMinuto()))
  const inicio = Date.now()
  const orcamentoMs = orcamentoFilaWhatsAppMs()
  let enviadas = 0
  let falhas = 0
  for (let i = 0; i < limiteSeguro; i += 1) {
    if (Date.now() - inicio >= orcamentoMs) break
    const msg = await reivindicarMensagem()
    if (!msg) break
    const resultado = await enviarReivindicada(msg)
    if (resultado.enviada) enviadas += 1
    else if (resultado.status === 'FALHA') falhas += 1
    if (i + 1 < limiteSeguro) {
      const pausaMs = intervaloWhatsAppMs() + jitterWhatsAppMs()
      if (Date.now() - inicio + pausaMs >= orcamentoMs) break
      await new Promise((resolve) => setTimeout(resolve, pausaMs))
    }
  }
  return { enviadas, falhas }
}
