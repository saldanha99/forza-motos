/**
 * POST /api/admin/produtos/[id]/curadoria  { manter: boolean }
 *
 * Curadoria: o admin escolhe manter (ou não) na loja um produto de fornecedor
 * bloqueado (Eurolaqui). manter=true → produto volta a ficar disponível mesmo
 * sendo Eurolaqui; manter=false → volta a ser removido pelo robô.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { manter } = await req.json().catch(() => ({ manter: false }))

  const produto = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true, temImagem: true, fornecedor: true },
  })
  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  // manter=true → disponível (999) e ativo se tiver imagem; manter=false → fora
  const ativo = manter ? produto.temImagem : false
  await prisma.product.update({
    where: { id: params.id },
    data: {
      mantidoManual: !!manter,
      estoque: manter ? 999 : 0,
      ativo,
    },
  })

  return NextResponse.json({ ok: true, mantidoManual: !!manter, ativo })
}
