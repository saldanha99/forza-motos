export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { BANNER_SLOTS } from '@/lib/marketing'
import { MarketingBanners } from '@/components/admin/MarketingBanners'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Marketing — Banners' }

export default async function MarketingAdminPage() {
  const rows = await prisma.marketingBanner.findMany().catch(() => [])
  const porChave = new Map(rows.map((r) => [r.chave, r]))

  const slots = BANNER_SLOTS.map((s) => ({
    chave: s.chave,
    nome: s.nome,
    dica: s.dica,
    fallback: s.fallback,
    imagemUrl: porChave.get(s.chave)?.imagemUrl ?? null,
  }))

  return (
    <div>
      <PageHeader
        titulo="Marketing"
        descricao="Troque as imagens dos banners e heros do site na hora, sem deploy — restaurar padrão volta à arte original."
      />

      <MarketingBanners slots={slots} />
    </div>
  )
}
