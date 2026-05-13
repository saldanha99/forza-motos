/**
 * Diagnóstico: mostra JSON bruto do produto.obter.php do Tiny
 * GET /api/admin/debug-tiny?tinyId=123
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tinyFetch, extrairImagensTiny } from '@/lib/olist/client'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const tinyId = searchParams.get('tinyId')

  if (!tinyId) {
    // Se não passar tinyId, retorna o primeiro produto com tinyId do banco
    const primeiro = await prisma.product.findFirst({
      where: { tinyId: { not: null } },
      select: { id: true, nome: true, tinyId: true, sku: true, imagens: true },
    })
    return NextResponse.json({
      info: 'Passe ?tinyId=XXX para buscar um produto específico. Exemplo abaixo:',
      exemplo: primeiro,
    })
  }

  try {
    // Busca o produto no banco para comparar
    const dbProduto = await prisma.product.findFirst({
      where: { tinyId },
      select: { id: true, nome: true, sku: true, imagens: true },
    })

    // Busca o produto bruto no Tiny
    const data = await tinyFetch('produto.obter.php', { id: String(tinyId) }, 0)
    const produto = data.retorno?.produto ?? null

    // Tenta extrair imagens com nossa função atual
    const imagensExtraidas = produto ? extrairImagensTiny(produto) : []

    // Mapeia todas as chaves do produto para diagnóstico
    const chavesDoObjeto = produto ? Object.keys(produto) : []

    // Extrai campos específicos relacionados a imagens
    const camposImagem = {
      foto: produto?.foto,
      fotos: produto?.fotos,
      imagens: produto?.imagens,
      imagem_principal: produto?.imagem_principal,
      imagens_externas: produto?.imagens_externas,
      // campos alternativos que o Tiny às vezes usa
      url_imagem: produto?.url_imagem,
      imagem: produto?.imagem,
      anexos: produto?.anexos,
      galeria: produto?.galeria,
    }

    return NextResponse.json({
      tinyId,
      db: dbProduto,
      imagensExtraidas,
      totalImagensEncontradas: imagensExtraidas.length,
      chavesDoObjeto,
      camposImagem,
      // Retorna o produto completo para análise total
      produtoBruto: produto,
    }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
