import { Header } from '@/components/store/Header'
import { Footer } from '@/components/store/Footer'
import { WhatsappButton } from '@/components/store/WhatsappButton'
import { AnnouncementBar } from '@/components/store/AnnouncementBar'
import { SmoothScroll } from '@/components/SmoothScroll'
import { LeadCaptureModal } from '@/components/store/LeadCaptureModal'
import { CartDrawer } from '@/components/store/CartDrawer'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <div className="min-h-screen flex flex-col">
        <AnnouncementBar />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsappButton />
        <LeadCaptureModal />
        <CartDrawer />
      </div>
    </SmoothScroll>
  )
}
