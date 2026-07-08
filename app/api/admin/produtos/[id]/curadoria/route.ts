/**
 * POST /api/admin/produtos/[id]/curadoria  { visivel: boolean }
 *
 * Curadoria unificada: o admin decide se o produto fica na loja.
 * - Produto de fornecedor bloqueado (Eurolaqui): visivel=true → mantidoManual
 *   (volta a aparecer mesmo sendo Eurolaqui).
 * - Produto normal: visivel=false → ocultoManual (some da loja mesmo ativo no
 *   Olist); o sync respeita e não reativa.
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

  const { visivel } = await req.json().catch(() => ({ visivel: true }))

  const produto = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true, temImagem: true, estoque: true, fornecedor: true },
  })
  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  const eurolaqui = produto.fornecedor === 'eurolaqui'

  // Ativo só se: quer visível + tem imagem + (tem estoque OU é eurolaqui mantido)
  const ativo = !!visivel && produto.temImagem && (eurolaqui || produto.estoque > 0)

  await prisma.product.update({
    where: { id: params.id },
    data: {
      mantidoManual: eurolaqui ? !!visivel : undefined,
      ocultoManual: eurolaqui ? undefined : !visivel,
      // Eurolaqui mantido → estoque 999 (fornecedor garante); senão preserva
      ...(eurolaqui && { estoque: visivel ? 999 : 0 }),
      ativo,
    },
  })

  return NextResponse.json({ ok: true, visivel: !!visivel, ativo })
}
