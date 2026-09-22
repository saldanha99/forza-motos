import { Prisma, type EmailOutbox } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  enviarEmailConfirmacao,
  enviarEmailEntrega,
  enviarEmailIngresso,
  enviarEmailNfeAutorizada,
  enviarEmailRastreio,
} from '@/lib/email/send'
import { obterDocumentosNfeOlist } from '@/lib/olist/documentos-nfe'

export type PayloadEmailPedido = {
  nomeCliente: string
  numeroPedido: string
  itens: Array<{
    nome: string
    quantidade: number
    precoUnitario: number | string
    preVenda?: boolean
    prazoEntregaDias?: number | null
  }>
  subtotal: number
  frete: number
  total: number
  freteTransportadora?: string | null
  fretePrazo?: number | null
  preVenda?: boolean
  prazoPreVendaDias?: number | null
  prazoTotalDias?: number | null
  retirada?: boolean
  nomeCampanha?: string | null
  canecaEventoPirelli?: boolean
  nomeGravacao?: string | null
  quantidadeCanecas?: number | null
  linkConfirmacaoCaneca?: string | null
}

export type PayloadEmailIngresso = {
  nomeCliente: string
  tituloEvento: string
  dataEvento: string
  localEvento: string
  quantidade: number
  total: number
}

export type PayloadEmailNfe = {
  nomeCliente: string
  numeroPedido: string
  chaveNfe: string
  idNotaFiscal?: string | null
}

export type PayloadEmailEnvio = {
  nomeCliente: string
  numeroPedido: string
  rastreio: string
  transportadora: string
  prazo?: number | null
}

export type PayloadEmailEntrega = {
  nomeCliente: string
  numeroPedido: string
  rastreio?: string | null
  transportadora?: string | null
}

export type EnfileirarEmailParams =
  | { chaveIdempotencia: string; tipo: 'PEDIDO_CONFIRMADO'; destinatario: string; payload: PayloadEmailPedido }
  | { chaveIdempotencia: string; tipo: 'INGRESSO_CONFIRMADO'; destinatario: string; payload: PayloadEmailIngresso }
  | { chaveIdempotencia: string; tipo: 'NFE_AUTORIZADA'; destinatario: string; payload: PayloadEmailNfe }
  | { chaveIdempotencia: string; tipo: 'PEDIDO_ENVIADO'; destinatario: string; payload: PayloadEmailEnvio }
  | { chaveIdempotencia: string; tipo: 'PEDIDO_ENTREGUE'; destinatario: string; payload: PayloadEmailEntrega }

type ClientePrisma = Pick<typeof prisma, 'emailOutbox'>

/** UPSERT atômico: reentradas devolvem a mesma obrigação, sem novo e-mail. */
export async function enfileirarEmail(
  params: EnfileirarEmailParams,
  db: ClientePrisma = prisma,
) {
  return db.emailOutbox.upsert({
    where: { chaveIdempotencia: params.chaveIdempotencia },
    create: {
      chaveIdempotencia: params.chaveIdempotencia,
      tipo: params.tipo,
      destinatario: params.destinatario.trim().toLowerCase(),
      payload: params.payload as unknown as Prisma.InputJsonValue,
      proximaTentativaEm: new Date(),
    },
    update: {},
  })
}

const MAX_TENTATIVAS = 8
const LEASE_MS = 2 * 60_000

export function atrasoRetryEmailMs(tentativas: number): number {
  return Math.min(6 * 60 * 60_000, 30_000 * (2 ** Math.max(0, tentativas - 1)))
}

async function reivindicarEmail(id?: string): Promise<EmailOutbox | null> {
  const filtroId = id ? Prisma.sql`AND "id" = ${id}` : Prisma.empty
  const leaseSegundos = Math.ceil(LEASE_MS / 1000)
  const linhas = await prisma.$queryRaw<EmailOutbox[]>(Prisma.sql`
    WITH candidato AS (
      SELECT "id"
      FROM "EmailOutbox"
      WHERE "tentativas" < ${MAX_TENTATIVAS}
        ${filtroId}
        AND (
          ("status" = 'PENDENTE' AND "proximaTentativaEm" <= NOW())
          OR (
            "status" = 'PROCESSANDO'
            AND ("leaseExpiraEm" IS NULL OR "leaseExpiraEm" <= NOW())
          )
        )
      ORDER BY "proximaTentativaEm" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "EmailOutbox" AS email
    SET "status" = 'PROCESSANDO',
        "tentativas" = email."tentativas" + 1,
        "leaseExpiraEm" = NOW() + (${leaseSegundos} * INTERVAL '1 second'),
        "updatedAt" = NOW()
    FROM candidato
    WHERE email."id" = candidato."id"
    RETURNING email.*
  `)
  return linhas[0] ?? null
}

export interface ProcessarEmailDeps {
  enviarPedido?: typeof enviarEmailConfirmacao
  enviarIngresso?: typeof enviarEmailIngresso
  enviarNfe?: typeof enviarEmailNfeAutorizada
  enviarEnvio?: typeof enviarEmailRastreio
  enviarEntrega?: typeof enviarEmailEntrega
  obterDocumentosNfe?: typeof obterDocumentosNfeOlist
}

async function enviarReivindicado(
  email: EmailOutbox,
  deps: ProcessarEmailDeps,
): Promise<{ enviada: boolean; status: string }> {
  try {
    const requestOptions = { idempotencyKey: email.chaveIdempotencia }
    let resultado: { enviado: boolean; id?: string }

    switch (email.tipo) {
      case 'PEDIDO_CONFIRMADO':
        resultado = await (deps.enviarPedido ?? enviarEmailConfirmacao)({
          para: email.destinatario,
          ...(email.payload as PayloadEmailPedido),
        }, requestOptions)
        break
      case 'INGRESSO_CONFIRMADO':
        resultado = await (deps.enviarIngresso ?? enviarEmailIngresso)({
          para: email.destinatario,
          ...(email.payload as PayloadEmailIngresso),
        }, requestOptions)
        break
      case 'NFE_AUTORIZADA': {
        const payload = email.payload as PayloadEmailNfe
        const documentos = payload.idNotaFiscal
          ? await (deps.obterDocumentosNfe ?? obterDocumentosNfeOlist)(
              payload.idNotaFiscal,
              payload.chaveNfe,
            )
          : null
        resultado = await (deps.enviarNfe ?? enviarEmailNfeAutorizada)({
          para: email.destinatario,
          nomeCliente: payload.nomeCliente,
          numeroPedido: payload.numeroPedido,
          chaveNfe: payload.chaveNfe,
          danfeUrl: documentos?.danfeUrl,
          xmlNfe: documentos?.xml,
        }, requestOptions)
        break
      }
      case 'PEDIDO_ENVIADO':
        resultado = await (deps.enviarEnvio ?? enviarEmailRastreio)({
          para: email.destinatario,
          ...(email.payload as PayloadEmailEnvio),
        }, requestOptions)
        break
      case 'PEDIDO_ENTREGUE':
        resultado = await (deps.enviarEntrega ?? enviarEmailEntrega)({
          para: email.destinatario,
          ...(email.payload as PayloadEmailEntrega),
        }, requestOptions)
        break
      default: {
        const tipoNaoSuportado: never = email.tipo
        throw new Error(`Tipo de e-mail não suportado: ${String(tipoNaoSuportado)}`)
      }
    }

    if (resultado.enviado) {
      await prisma.emailOutbox.updateMany({
        // CAS impede que um worker atrasado sobrescreva outro que retomou uma
        // lease expirada da mesma linha.
        where: { id: email.id, status: 'PROCESSANDO', tentativas: email.tentativas },
        data: {
          status: 'ENVIADO',
          providerId: resultado.id,
          enviadaEm: new Date(),
          erro: null,
          leaseExpiraEm: null,
        },
      })
      return { enviada: true, status: 'ENVIADO' }
    }
    throw new Error('Provedor não confirmou o envio')
  } catch (error) {
    const esgotou = email.tentativas >= MAX_TENTATIVAS
    await prisma.emailOutbox.updateMany({
      where: { id: email.id, status: 'PROCESSANDO', tentativas: email.tentativas },
      data: {
        status: esgotou ? 'FALHA' : 'PENDENTE',
        erro: String(error).slice(0, 4000),
        leaseExpiraEm: null,
        proximaTentativaEm: esgotou
          ? email.proximaTentativaEm
          : new Date(Date.now() + atrasoRetryEmailMs(email.tentativas)),
      },
    })
    return { enviada: false, status: esgotou ? 'FALHA' : 'PENDENTE' }
  }
}

/** Tenta enviar agora; qualquer falha permanece durável para o cron. */
export async function processarEmail(id: string, deps: ProcessarEmailDeps = {}) {
  const email = await reivindicarEmail(id)
  if (!email) {
    const atual = await prisma.emailOutbox.findUnique({ where: { id }, select: { status: true } })
    return { processada: false, enviada: atual?.status === 'ENVIADO', status: atual?.status ?? 'NAO_ENCONTRADA' }
  }
  const resultado = await enviarReivindicado(email, deps)
  return { processada: true, ...resultado }
}

export async function processarFilaEmails(
  limite = 20,
  deps: ProcessarEmailDeps = {},
): Promise<{ enviadas: number; falhas: number }> {
  let enviadas = 0
  let falhas = 0
  for (let i = 0; i < limite; i += 1) {
    const email = await reivindicarEmail()
    if (!email) break
    const resultado = await enviarReivindicado(email, deps)
    if (resultado.enviada) enviadas += 1
    else if (resultado.status === 'FALHA') falhas += 1
  }
  return { enviadas, falhas }
}
