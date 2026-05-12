import type { Metadata } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-barlow',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
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
    <html lang="pt-BR" className={`${barlowCondensed.variable} ${inter.variable}`}>
      <body className="bg-white text-[#111] font-inter antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#fff',
                color: '#111',
                border: '1px solid #eee',
                fontFamily: 'var(--font-inter)',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
