import type { Metadata } from 'next'
import { Inter, Rajdhani } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rajdhani',
})

export const metadata: Metadata = {
  title: { default: 'Forza Motos', template: '%s | Forza Motos' },
  description:
    'Pneus e manutenção de motos em Campinas/SP. Credenciada Pirelli, Metzeler e Michelin. Box rápido: pneu, freio, óleo e transmissão.',
  keywords: ['pneus moto', 'Campinas', 'Pirelli', 'Metzeler', 'Michelin', 'manutenção moto'],
  openGraph: {
    siteName: 'Forza Motos',
    locale: 'pt_BR',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${rajdhani.variable}`}>
      <body className="bg-[#0a0a0a] text-white font-inter antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#1a1a1a', color: '#fff', border: '1px solid #333' },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
