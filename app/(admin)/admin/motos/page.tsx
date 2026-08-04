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
    medidaDianteira: m.medidaDianteira, medidaTraseira: m.medidaTraseira,
    medidasConferidas: m.medidasConferidas, fonteMedidas: m.fonteMedidas,
  }))

  const aConferir = motosSerial.filter((m) => !m.medidasConferidas && m.medidaDianteira).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Motos & Compatibilidade</h1>
        <p className="text-brand-muted text-sm mt-1">
          Cadastre motos por faixa de ano, confira as medidas de fábrica e vincule os produtos que servem em cada uma.
          Aparece em <strong>/moto/[slug]</strong> e na busca por placa.
        </p>
      </div>

      {aConferir > 0 && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-brand-text">
            <strong>{aConferir} moto{aConferir === 1 ? '' : 's'} com medida pré-preenchida aguardando conferência.</strong>{' '}
            Confira a medida e clique em <em>Conferir</em> — só as conferidas aparecem para o cliente na busca por placa.
          </p>
          <p className="text-[13px] text-brand-muted mt-1.5">
            Informe só os números (ex.: <strong>120/70-19</strong>). Não precisa dizer se é radial ou
            diagonal: a mesma moto aceita os dois, e o cliente escolhe na hora da compra.
          </p>
        </div>
      )}

      <MotosManager motosIniciais={motosSerial} />
    </div>
  )
}
