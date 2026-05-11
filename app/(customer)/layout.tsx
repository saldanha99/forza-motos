import { Header } from '@/components/store/Header'
import { Footer } from '@/components/store/Footer'
import { WhatsappButton } from '@/components/store/WhatsappButton'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {children}
      </main>
      <Footer />
      <WhatsappButton />
    </div>
  )
}
