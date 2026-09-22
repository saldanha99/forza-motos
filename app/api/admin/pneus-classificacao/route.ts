/**
 * GET /api/admin/pneus-classificacao — pneus do catálogo com a classificação
 *   atual e o palpite tirado do nome do produto
 * PUT /api/admin/pneus-classificacao — grava várias classificações de uma vez
 *
 * Existe para não obrigar ninguém a abrir 49 fichas de produto uma a uma. O
 * palpite nunca é gravado sozinho: ele chega marcado como sugestão e só vira
 * dado quando o operador confirma.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAcesso } from '@/lib/admin/acesso'
import { sugerirClassificacao } from '@/lib/pneus/sugestao'

export const dynamic = 'force-dynamic'

/** Um produto é candidato a pneu se o ERP disse que é, ou se tem medida de pneu. */
const FILTRO_PNEUS = {
  ativo: true,
  ocultoManual: false,
  eventoPirelliId: null,
  OR: [
    { categoria: { contains: 'pneu', mode: 'insensitive' as const } },
    { medidaAro: { not: null } },
  ],
}

export async function GET() {
  if (!(await exigirAcesso('pneus-segmentos'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const [produtos, segmentos] = await Promise.all([
    prisma.product.findMany({
      where: FILTRO_PNEUS,
      orderBy: [{ marca: 'asc' }, { nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        marca: true,
        sku: true,
        temImagem: true,
        pneuSegmentoId: true,
        pneuLinha: true,
      },
    }),
    prisma.pneuSegmento.findMany({
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: { id: true, nome: true, slug: true, ativo: true },
    }),
  ])

  const porSlug = new Map(segmentos.map((s) => [s.slug, s]))

  return NextResponse.json({
    segmentos,
    produtos: produtos.map((p) => {
      const palpite = sugerirClassificacao(p.nome)
      const segmentoSugerido = palpite ? porSlug.get(palpite.segmento) : undefined
      return {
        ...p,
        // Sem categoria correspondente cadastrada (alguém renomeou o slug), a
        // sugestão de linha ainda serve — só não vem com segmento.
        sugestao: palpite
          ? {
              linha: palpite.linha,
              termo: palpite.termo,
              segmentoId: segmentoSugerido?.id ?? null,
              segmentoNome: segmentoSugerido?.nome ?? null,
            }
          : null,
      }
    }),
  })
}

export async function PUT(req: Request) {
  if (!(await exigirAcesso('pneus-segmentos'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const itens = Array.isArray(body.itens) ? body.itens : []
  if (itens.length === 0) {
    return NextResponse.json({ error: 'Nada para salvar.' }, { status: 400 })
  }
  if (itens.length > 500) {
    return NextResponse.json({ error: 'Muitos itens de uma vez.' }, { status: 400 })
  }

  const ids: string[] = []
  const alteracoes: { id: string; pneuSegmentoId: string | null; pneuLinha: string | null }[] = []

  for (const item of itens) {
    const id = String(item?.id ?? '')
    if (!id) return NextResponse.json({ error: 'Item sem id de produto.' }, { status: 400 })
    ids.push(id)
    alteracoes.push({
      id,
      pneuSegmentoId: item?.pneuSegmentoId ? String(item.pneuSegmentoId) : null,
      pneuLinha: String(item?.pneuLinha ?? '').trim() || null,
    })
  }

  // Confere antes de gravar: produto de evento tem catálogo próprio, e
  // segmento inexistente estouraria a chave estrangeira no meio do lote.
  const [produtos, segmentos] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, eventoPirelliId: true },
    }),
    prisma.pneuSegmento.findMany({ select: { id: true } }),
  ])

  const conhecidos = new Map(produtos.map((p) => [p.id, p]))
  const segmentosValidos = new Set(segmentos.map((s) => s.id))

  for (const alteracao of alteracoes) {
    const produto = conhecidos.get(alteracao.id)
    if (!produto) {
      return NextResponse.json({ error: 'Produto não encontrado no lote.' }, { status: 404 })
    }
    if (produto.eventoPirelliId) {
      return NextResponse.json(
        { error: 'Produto exclusivo do evento não entra na vitrine de pneus.' },
        { status: 409 },
      )
    }
    if (alteracao.pneuSegmentoId && !segmentosValidos.has(alteracao.pneuSegmentoId)) {
      return NextResponse.json({ error: 'Categoria de pneu inexistente.' }, { status: 400 })
    }
  }

  // Tudo ou nada: meia classificação gravada deixaria a vitrine incoerente e
  // ninguém saberia onde parou.
  await prisma.$transaction(
    alteracoes.map((a) =>
      prisma.product.update({
        where: { id: a.id },
        data: { pneuSegmentoId: a.pneuSegmentoId, pneuLinha: a.pneuLinha },
      }),
    ),
  )

  return NextResponse.json({ ok: true, salvos: alteracoes.length })
}
