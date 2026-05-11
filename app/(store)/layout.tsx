import { Header } from '@/components/store/Header'
import { Footer } from '@/components/store/Footer'
import { WhatsappButton } from '@/components/store/WhatsappButton'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsappButton />
    </div>
  )
}
