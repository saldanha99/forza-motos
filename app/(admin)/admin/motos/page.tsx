export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { MotosManager } from '@/components/admin/MotosManager'
import { PageHeader } from '@/components/admin/ui/primitives'

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
    medidaDianteira: m.medidaDianteira, medidaTraseira: m.medidaTraseira,
    medidasConferidas: m.medidasConferidas, fonteMedidas: m.fonteMedidas,
  }))

  const aConferir = motosSerial.filter((m) => !m.medidasConferidas && m.medidaDianteira).length

  return (
    <div>
      <PageHeader
        titulo="Motos & Compatibilidade"
        descricao="Cadastre motos por faixa de ano, confira as medidas de pneu e vincule os produtos compatíveis — alimenta a busca por placa e as páginas de moto."
      />

      {aConferir > 0 && (
        <div className="mb-5 rounded-xl bg-brand-warning-soft px-4 py-3">
          <p className="text-sm text-brand-text">
            <strong>{aConferir} moto{aConferir === 1 ? '' : 's'} com medida pré-preenchida aguardando conferência.</strong>{' '}
            Confira a medida e clique em <em>Conferir</em> — só as conferidas aparecem para o cliente na busca por placa.
          </p>
          <p className="mt-1.5 text-[13px] text-brand-muted">
            Informe só os números (ex.: <strong>120/70-19</strong>). Não precisa dizer se é radial ou
            diagonal: a mesma moto aceita os dois, e o cliente escolhe na hora da compra.
          </p>
        </div>
      )}

      <MotosManager motosIniciais={motosSerial} />
    </div>
  )
}
