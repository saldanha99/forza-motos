export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { MotosManager } from '@/components/admin/MotosManager'

export const metadata = { title: 'Motos & Compatibilidade — Forza Admin' }

export default async function MotosAdminPage() {
  const motos = await prisma.moto
    .findMany({
      orderBy: [{ marca: 'asc' }, { modelo: 'asc' }, { anoDe: 'asc' }],
      include: { _count: { select: { produtos: true } } },
    })
    .catch(() => [])

  const motosSerial = motos.map((m) => ({
    id: m.id, marca: m.marca, modelo: m.modelo, anoDe: m.anoDe, anoAte: m.anoAte,
    slug: m.slug, produtos: m._count.produtos,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Motos & Compatibilidade</h1>
        <p className="text-brand-muted text-sm mt-1">
          Cadastre motos por faixa de ano e vincule os produtos que servem em cada uma. Aparece em <strong>/moto/[slug]</strong> e na busca por placa.
        </p>
      </div>
      <MotosManager motosIniciais={motosSerial} />
    </div>
  )
}
