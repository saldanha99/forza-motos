import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { enfileirarMensagem } from '@/lib/evolution/queue'

type Db = Prisma.TransactionClient | typeof prisma
type MotivoConfirmacaoCaneca = 'PREMIO_QUIZ' | 'BRINDE_COMPRA_PNEUS' | 'COMPRA_CANECA'

function urlBasePublica() {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://forzamotos.com.br'
  try {
    const url = new URL(configurada)
    if (!['http:', 'https:'].includes(url.protocol)) return 'https://forzamotos.com.br'
    return url.origin
  } catch {
    return 'https://forzamotos.com.br'
  }
}

export function linkConfirmacaoCanecaPirelli(codigoAcesso: string) {
  return `${urlBasePublica()}/evento-pirelli/caneca/confirmar?token=${encodeURIComponent(codigoAcesso)}`
}

function conteudoConfirmacao(params: {
  motivo: MotivoConfirmacaoCaneca
  nome: string
  link: string
  quantidade?: number
  nomeGravacao?: string | null
}) {
  if (params.motivo === 'PREMIO_QUIZ') {
    return `Oi *${params.nome}*! 🏆 Você foi confirmado como vencedor do quiz Pirelli × Forza Motos!

Você acertou todas as perguntas no menor tempo oficial e ganhou uma caneca personalizada.

Confirme o nome que será gravado:
👉 ${params.link}

Seu prêmio e o andamento da gravação também ficam disponíveis nesse link.`
  }

  if (params.motivo === 'BRINDE_COMPRA_PNEUS') {
    return `Oi *${params.nome}*! ✅ Sua compra de pneus foi confirmada e sua caneca personalizada foi liberada.

Nome informado para gravação: *${params.nomeGravacao || 'aguardando confirmação'}*.

Confira a confirmação e acompanhe o andamento:
👉 ${params.link}

*Forza Motos × Pirelli* 🏁`
  }

  const quantidade = Math.max(1, params.quantidade ?? 1)
  return `Oi *${params.nome}*! ✅ A compra da sua ${quantidade === 1 ? 'caneca foi confirmada' : `${quantidade} canecas foi confirmada`}!

${params.nomeGravacao ? `Nome informado para gravação: *${params.nomeGravacao}*.` : 'O nome da gravação ainda precisa ser confirmado.'}

Confirme o nome, confira a compra e acompanhe o andamento:
👉 ${params.link}

*Forza Motos × Pirelli* 🏁`
}

export async function enfileirarConfirmacaoCanecaPirelli(params: {
  visitanteId: string
  motivo: MotivoConfirmacaoCaneca
  referencia: string
  quantidade?: number
  nomeGravacao?: string | null
}, db: Db = prisma) {
  const visitante = await db.eventoPirelliVisitante.findUnique({
    where: { id: params.visitanteId },
    select: { nomeCompleto: true, whatsapp: true, codigoQr: true },
  })
  if (!visitante) return null

  const link = linkConfirmacaoCanecaPirelli(visitante.codigoQr)
  return enfileirarMensagem({
    chaveIdempotencia: `evento-pirelli:${params.visitanteId}:caneca:${params.motivo}:${params.referencia}`.slice(0, 190),
    whatsapp: visitante.whatsapp,
    nome: visitante.nomeCompleto,
    tipo: 'MANUAL',
    payload: {
      conteudo: conteudoConfirmacao({
        motivo: params.motivo,
        nome: visitante.nomeCompleto,
        link,
        quantidade: params.quantidade,
        nomeGravacao: params.nomeGravacao,
      }),
      eventoPirelli: true,
      motivo: params.motivo,
    },
  }, db)
}
