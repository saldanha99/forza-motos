export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { SITE_URL } from '@/lib/schema'
import { Tag, Truck, ShieldCheck, QrCode } from 'lucide-react'

const PAGE_URL = `${SITE_URL}/sorocaba`

export const metadata: Metadata = {
  title: 'Pré-venda Custom Sorocaba — Forza Motos',
  description:
    'Pré-venda exclusiva de pneus Pirelli no evento custom de Sorocaba. Preço promocional, compra online e entrega para todo o Brasil.',
  alternates: { canonical: PAGE_URL },
  openGraph: { title: 'Pré-venda Custom Sorocaba — Forza Motos', url: PAGE_URL },
}

async function getDados() {
  const [produtos, cupom, qrSvg] = await Promise.all([
    prisma.product.findMany({
      where: { ativo: true, preVenda: true },
      orderBy: { updatedAt: 'desc' },
      take: 60,
    }),
    // Cupom do evento por convenção: código começa com "SOROCABA", ativo e no prazo
    prisma.cupom.findFirst({
      where: {
        ativo: true,
        codigo: { startsWith: 'SOROCABA' },
        OR: [{ validadeAte: null }, { validadeAte: { gte: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    }).catch(() => null),
    QRCode.toString(PAGE_URL, { type: 'svg', margin: 1, width: 200 }).catch(() => ''),
  ])
  return { produtos, cupom, qrSvg }
}

export default async function SorocabaPage() {
  const { produtos, cupom, qrSvg } = await getDados()

  const cupomLabel = cupom
    ? cupom.tipo === 'PERCENTUAL'
      ? `${Number(cupom.valor)}% OFF`
      : `R$ ${Number(cupom.valor).toFixed(2)} OFF`
    : null

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0b0b12] text-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-14 grid lg:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-[#d42b2b] text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              <Tag size={12} /> Pré-venda exclusiva do evento
            </span>
            <h1 className="font-barlow font-black text-4xl md:text-5xl lg:text-[56px] leading-[1.02] mb-4" style={{ letterSpacing: '-1.5px' }}>
              Custom Sorocaba<br /><span className="text-[#d42b2b]">Pneus Pirelli em pré-venda</span>
            </h1>
            <p className="text-white/70 text-lg font-inter max-w-[520px] mb-6">
              Garanta seu pneu com preço de evento. Você compra agora e a gente entrega
              na sua casa, em todo o Brasil. Estoque limitado à pré-venda.
            </p>
            <div className="flex flex-wrap gap-5 text-[13px] text-white/70 font-inter">
              <span className="flex items-center gap-1.5"><Truck size={15} className="text-emerald-400" /> Entrega para todo o Brasil</span>
              <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-400" /> Pagamento seguro Mercado Pago</span>
            </div>
          </div>

          {/* QR + cupom para a banca */}
          <div className="bg-white rounded-2xl p-5 text-center shrink-0 w-[240px] mx-auto">
            {qrSvg
              ? <div className="w-[200px] h-[200px] mx-auto [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              : <div className="w-[200px] h-[200px] mx-auto flex items-center justify-center text-[#999]"><QrCode size={80} /></div>}
            <p className="text-[#111] text-xs font-semibold mt-3">Aponte a câmera e compre pelo celular</p>
            {cupomLabel && (
              <div className="mt-3 border-t border-[#eee] pt-3">
                <p className="text-[10px] text-[#888] uppercase tracking-wider">Cupom do evento</p>
                <p className="font-barlow font-black text-2xl text-[#d42b2b] tracking-wide">{cupom!.codigo}</p>
                <p className="text-xs text-[#111] font-bold">{cupomLabel}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Faixa do cupom (também no corpo, para quem entra pelo link) */}
      {cupom && (
        <div className="bg-[#d42b2b] text-white text-center py-3 px-4 font-inter text-sm">
          Use o cupom <strong className="font-barlow font-black tracking-wide">{cupom.codigo}</strong> no checkout e ganhe <strong>{cupomLabel}</strong>
          {cupom.minSubtotal ? ` em compras acima de R$ ${Number(cupom.minSubtotal).toFixed(2)}` : ''}.
        </div>
      )}

      {/* Vitrine */}
      <section className="py-12 bg-[#fafafa]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-2xl md:text-3xl text-[#111] mb-6">
            Produtos em pré-venda
          </h2>
          {produtos.length === 0 ? (
            <div className="bg-white border border-[#eee] rounded-xl p-10 text-center text-[#888]">
              Nenhum produto de pré-venda publicado ainda. Cadastre produtos com a opção
              <strong> Pré-venda</strong> ligada no admin para eles aparecerem aqui.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {produtos.map((p) => (
                <ProductCard key={p.id} produto={p as any} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
