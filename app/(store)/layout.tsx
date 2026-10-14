import { Header } from '@/components/store/Header'
import { Footer } from '@/components/store/Footer'
import { WhatsappButton } from '@/components/store/WhatsappButton'
import { AnnouncementBar } from '@/components/store/AnnouncementBar'
import { SmoothScroll } from '@/components/SmoothScroll'
import { LeadCaptureModal } from '@/components/store/LeadCaptureModal'
import { CartDrawer } from '@/components/store/CartDrawer'
import { listarSegmentos } from '@/lib/pneus/segmentos'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Categorias de pneu do menu — as mesmas de /pneus, editáveis em
  // /admin/pneus-segmentos. Categoria sem produto publicado fica de fora para
  // o menu não levar a uma vitrine vazia.
  const segmentosPneu = await listarSegmentos()

  return (
    <SmoothScroll>
      <div className="min-h-screen flex flex-col">
        <AnnouncementBar />
        <Header
          segmentosPneu={segmentosPneu.map((s) => ({ nome: s.nome, slug: s.slug, produtos: s.produtos }))}
        />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsappButton />
        <LeadCaptureModal />
        <CartDrawer />
      </div>
    </SmoothScroll>
  )
}
