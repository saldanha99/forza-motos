import { Header } from '@/components/store/Header'
import { Footer } from '@/components/store/Footer'
import { WhatsappButton } from '@/components/store/WhatsappButton'
import { AnnouncementBar } from '@/components/store/AnnouncementBar'
import { LeadCaptureModal } from '@/components/store/LeadCaptureModal'
import { CartDrawer } from '@/components/store/CartDrawer'

/**
 * Layout do Glossário — herda toda a identidade do e-commerce:
 * announcement bar, header, footer, botão WhatsApp, popup de captura
 * e o drawer lateral do carrinho.
 */
export default function GlossarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsappButton />
      <LeadCaptureModal />
      <CartDrawer />
    </div>
  )
}
