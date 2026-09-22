export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { BANNER_SLOTS, GRUPOS_BANNER } from '@/lib/marketing'
import { MarketingBanners } from '@/components/admin/MarketingBanners'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Marketing — Banners' }

export default async function MarketingAdminPage() {
  const rows = await prisma.marketingBanner.findMany().catch(() => [])
  const porChave = new Map(rows.map((r) => [r.chave, r]))

  const slots = BANNER_SLOTS.map((s) => ({
    chave: s.chave,
    nome: s.nome,
    grupo: s.grupo,
    dica: s.dica,
    dimensao: s.dimensao,
    proporcao: s.proporcao,
    fallback: s.fallback,
    imagemUrl: porChave.get(s.chave)?.imagemUrl ?? null,
  }))

  return (
    <div>
      <PageHeader
        titulo="Marketing"
        descricao="Todas as imagens da loja ficam aqui. Troque na hora, sem deploy — cada campo mostra o tamanho recomendado, e “restaurar padrão” volta à imagem original."
      />

      <MarketingBanners slots={slots} grupos={GRUPOS_BANNER} />
    </div>
  )
}
