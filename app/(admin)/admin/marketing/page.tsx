export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { BANNER_SLOTS } from '@/lib/marketing'
import { MarketingBanners } from '@/components/admin/MarketingBanners'

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
      <div className="mb-6">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Marketing</h1>
        <p className="text-brand-muted text-sm mt-1">
          Troque as imagens dos banners e heros do site · A troca vale na hora, sem deploy · &quot;Restaurar padrão&quot; volta à arte original
        </p>
      </div>

      <MarketingBanners slots={slots} />
    </div>
  )
}
