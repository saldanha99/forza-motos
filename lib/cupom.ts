/**
 * Cupons de desconto — validação e cálculo SEMPRE no servidor.
 * Nunca confie no desconto enviado pelo cliente: o checkout recalcula aqui.
 */
import { prisma } from '@/lib/prisma'

export interface CupomAplicado {
  codigo: string
  desconto: number   // em reais, já calculado sobre o subtotal
  descricao: string | null
}

export interface CupomErro {
  erro: string
}

/** Normaliza o código como é salvo/comparado (maiúsculas, sem espaços) */
export function normalizarCodigoCupom(codigo: string): string {
  return String(codigo ?? '').trim().toUpperCase()
}

/**
 * Valida um cupom para um dado subtotal e retorna o desconto em reais.
 * Não incrementa uso — isso só acontece quando o pedido é efetivado.
 */
export async function validarCupom(
  codigoRaw: string,
  subtotal: number,
): Promise<CupomAplicado | CupomErro> {
  const codigo = normalizarCodigoCupom(codigoRaw)
  if (!codigo) return { erro: 'Informe um código de cupom.' }

  const cupom = await prisma.cupom.findUnique({ where: { codigo } })
  if (!cupom || !cupom.ativo) return { erro: 'Cupom inválido ou inativo.' }

  if (cupom.validadeAte && cupom.validadeAte < new Date()) {
    return { erro: 'Cupom expirado.' }
  }
  if (cupom.usoMaximo != null && cupom.usados >= cupom.usoMaximo) {
    return { erro: 'Cupom esgotado.' }
  }
  const minSubtotal = cupom.minSubtotal ? Number(cupom.minSubtotal) : 0
  if (subtotal < minSubtotal) {
    return { erro: `Este cupom vale para compras a partir de R$ ${minSubtotal.toFixed(2)}.` }
  }

  // Calcula o desconto e limita ao subtotal (nunca desconto maior que a compra)
  const valor = Number(cupom.valor)
  const bruto = cupom.tipo === 'PERCENTUAL' ? (subtotal * valor) / 100 : valor
  const desconto = Math.min(Math.round(bruto * 100) / 100, subtotal)

  return { codigo: cupom.codigo, desconto, descricao: cupom.descricao }
}

/**
 * Marca um uso do cupom (chamar só quando o pedido é criado com sucesso).
 * Condicional em usoMaximo para não estourar o limite em corridas.
 */
export async function consumirCupom(codigo: string): Promise<void> {
  const cod = normalizarCodigoCupom(codigo)
  if (!cod) return
  await prisma.cupom.updateMany({
    where: {
      codigo: cod,
      OR: [{ usoMaximo: null }, { usoMaximo: { gt: prisma.cupom.fields.usados } }],
    },
    data: { usados: { increment: 1 } },
  }).catch(() => {})
}
