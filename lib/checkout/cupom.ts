import type { Prisma } from '@prisma/client'

export interface CupomAutorizado {
  codigo: string
  desconto: number
}

function normalizarCodigo(codigo: unknown): string {
  return String(codigo ?? '').trim().toUpperCase()
}

/**
 * Autoriza e consome o cupom na mesma transação que reserva o estoque e cria
 * o pedido. O compare-and-swap em `usados` impede que duas compras consumam o
 * último uso simultaneamente.
 */
export async function autorizarCupomCheckout(
  tx: Prisma.TransactionClient,
  codigoRaw: unknown,
  subtotal: number,
): Promise<CupomAutorizado> {
  const codigo = normalizarCodigo(codigoRaw)
  if (!codigo) throw new Error('CUPOM:Informe um código de cupom.')

  const agora = new Date()
  const cupom = await tx.cupom.findUnique({ where: { codigo } })
  if (!cupom || !cupom.ativo) throw new Error('CUPOM:Cupom inválido ou inativo.')
  if (cupom.validadeAte && cupom.validadeAte < agora) throw new Error('CUPOM:Cupom expirado.')
  if (cupom.usoMaximo != null && cupom.usados >= cupom.usoMaximo) {
    throw new Error('CUPOM:Cupom esgotado.')
  }

  const minimo = Number(cupom.minSubtotal ?? 0)
  if (subtotal < minimo) {
    throw new Error(`CUPOM:Este cupom vale para compras a partir de R$ ${minimo.toFixed(2)}.`)
  }

  const consumido = await tx.cupom.updateMany({
    where: {
      id: cupom.id,
      ativo: true,
      usados: cupom.usados,
      OR: [{ validadeAte: null }, { validadeAte: { gte: agora } }],
    },
    data: { usados: { increment: 1 } },
  })
  if (!consumido.count) throw new Error('CUPOM:Cupom esgotado.')

  const valor = Number(cupom.valor)
  const bruto = cupom.tipo === 'PERCENTUAL' ? (subtotal * valor) / 100 : valor
  const desconto = Math.min(Math.round(bruto * 100) / 100, subtotal)
  return { codigo: cupom.codigo, desconto }
}
