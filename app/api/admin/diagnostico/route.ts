import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const [
    total,
    ativos,
    inativos,
    ativosComImagem,
    ativosSemImagem,
    naoVerificados,
    emEstoque,
    semEstoque,
    comPreco,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { ativo: true } }),
    prisma.product.count({ where: { ativo: false } }),
    prisma.product.count({ where: { ativo: true, temImagem: true } }),
    prisma.product.count({ where: { ativo: true, temImagem: false } }),
    prisma.product.count({ where: { ativo: true, imagensVerificadas: false } }),
    prisma.product.count({ where: { ativo: true, estoque: { gt: 0 } } }),
    prisma.product.count({ where: { ativo: true, estoque: 0 } }),
    prisma.product.count({ where: { ativo: true, preco: { gt: 0 } } }),
  ])

  return NextResponse.json({
    total,
    ativos,
    inativos,
    ativosComImagem,
    ativosSemImagem,
    naoVerificados,
    emEstoque,
    semEstoque,
    comPreco,
    pctComImagem: ativos > 0 ? Math.round((ativosComImagem / ativos) * 100) : 0,
    pctEmEstoque: ativos > 0 ? Math.round((emEstoque / ativos) * 100) : 0,
  })
}
