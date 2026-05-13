/**
 * POST /api/admin/limpar-imgs-duplicadas
 * Detecta URLs de imagem repetidas em muitos produtos (provavelmente imagem padrão errada)
 * e reseta esses produtos para re-sincronização.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // Conta quantas vezes cada URL de imagem (primeira do array) aparece no banco
  const result = await prisma.$queryRaw<{ url: string; total: bigint }[]>`
    SELECT
      imagens->>0 AS url,
      COUNT(*) AS total
    FROM "Product"
    WHERE "temImagem" = true
      AND imagens IS NOT NULL
      AND imagens::text != '[]'
    GROUP BY imagens->>0
    ORDER BY total DESC
    LIMIT 20
  `

  // Total de produtos com imagem para calcular percentual
  const totalComImagem = await prisma.product.count({ where: { temImagem: true } })

  if (totalComImagem === 0) {
    return NextResponse.json({ resetados: 0, info: 'Nenhum produto com imagem' })
  }

  // Considera suspeita qualquer URL que aparece em >5% dos produtos com imagem
  // OU que aparece em mais de 50 produtos
  const threshold = Math.max(50, Math.floor(totalComImagem * 0.05))

  const urlsSuspeitas = result
    .filter(r => Number(r.total) > threshold)
    .map(r => r.url)

  if (urlsSuspeitas.length === 0) {
    return NextResponse.json({
      resetados: 0,
      info: 'Nenhuma URL suspeita encontrada',
      topUrls: result.slice(0, 5).map(r => ({ url: r.url?.slice(0, 80), total: Number(r.total) })),
    })
  }

  // Reseta os produtos cuja primeira imagem é uma URL suspeita
  const result2 = await prisma.$executeRaw`
    UPDATE "Product"
    SET
      imagens = '[]'::jsonb,
      "temImagem" = false,
      "imagensVerificadas" = false
    WHERE "temImagem" = true
      AND imagens IS NOT NULL
      AND imagens::text != '[]'
      AND imagens->>0 = ANY(${urlsSuspeitas}::text[])
  `

  const resetados = Number(result2)

  return NextResponse.json({
    resetados,
    urlsSuspeitasEncontradas: urlsSuspeitas.length,
    urlsSuspeitas: urlsSuspeitas.map(u => u?.slice(0, 100)),
    info: `${resetados} produtos resetados. Execute "Buscar imagens" novamente para re-sincronizar.`,
  })
}
