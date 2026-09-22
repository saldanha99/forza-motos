export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { PneuSegmentosManager } from '@/components/admin/PneuSegmentosManager'
import { ClassificarPneus, type ProdutoPneu } from '@/components/admin/ClassificarPneus'
import { PageHeader, SectionTitle } from '@/components/admin/ui/primitives'
import { sugerirClassificacao } from '@/lib/pneus/sugestao'

export const metadata = { title: 'Categorias de pneu' }

/** Candidato a pneu: o ERP disse que é, ou o produto tem medida de pneu. */
const FILTRO_PNEUS = {
  ativo: true,
  ocultoManual: false,
  eventoPirelliId: null,
  OR: [
    { categoria: { contains: 'pneu', mode: 'insensitive' as const } },
    { medidaAro: { not: null } },
  ],
}

export default async function PneusSegmentosPage() {
  const [segmentos, produtos] = await Promise.all([
    prisma.pneuSegmento
      .findMany({
        orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
        include: { _count: { select: { produtos: true } } },
      })
      .catch(() => []),
    prisma.product
      .findMany({
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
      })
      .catch(() => []),
  ])

  const porSlug = new Map(segmentos.map((s) => [s.slug, s]))

  const paraClassificar: ProdutoPneu[] = produtos.map((p) => {
    const palpite = sugerirClassificacao(p.nome)
    const segmentoSugerido = palpite ? porSlug.get(palpite.segmento) : undefined
    return {
      ...p,
      sugestao: palpite
        ? {
            linha: palpite.linha,
            termo: palpite.termo,
            segmentoId: segmentoSugerido?.id ?? null,
            segmentoNome: segmentoSugerido?.nome ?? null,
          }
        : null,
    }
  })

  return (
    <div>
      <PageHeader
        titulo="Categorias de pneu"
        descricao="Custom, Big Trail, Esportivo/Street, Scooter — o menu de /pneus. Crie e reordene as categorias aqui, e classifique o catálogo logo abaixo."
      />

      <PneuSegmentosManager
        segmentosIniciais={segmentos.map(({ _count, ...s }) => ({ ...s, produtos: _count.produtos }))}
      />

      <div className="mt-10">
        <SectionTitle>Classificar os pneus</SectionTitle>
        <p className="-mt-2 mb-4 text-sm text-brand-muted">
          Passe o catálogo de uma vez. “Aplicar sugestões” preenche pelo nome do produto — nada vai
          para a loja antes de você salvar.
        </p>
        <ClassificarPneus
          produtos={paraClassificar}
          segmentos={segmentos.map((s) => ({ id: s.id, nome: s.nome, slug: s.slug, ativo: s.ativo }))}
        />
      </div>
    </div>
  )
}
