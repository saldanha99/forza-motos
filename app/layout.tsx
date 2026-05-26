import type { Metadata } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  organizationSchema,
  websiteSchema,
  localBusinessSchema,
} from '@/lib/seo/schema'

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

const BASE_URL = 'https://forza-motos-app.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Forza Motos — Pneus e Peças para Moto em Campinas/SP',
    template: '%s | Forza Motos',
  },
  description:
    'Credenciada Pirelli, Metzeler e Michelin em Campinas/SP. Troca de pneu em 30 min sem agendamento. Box rápido: pneu, freio, óleo e transmissão. Loja online com entrega em todo Brasil.',
  keywords: [
    'pneus moto Campinas', 'Pirelli moto', 'Metzeler moto', 'Michelin moto',
    'troca pneu moto Campinas', 'peças moto', 'oficina moto Campinas',
    'manutenção moto', 'box rápido moto', 'loja moto online',
  ],
  authors: [{ name: 'Forza Motos', url: BASE_URL }],
  creator: 'Forza Motos',
  publisher: 'Forza Motos',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    siteName: 'Forza Motos',
    locale: 'pt_BR',
    type: 'website',
    url: BASE_URL,
    title: 'Forza Motos — Pneus e Peças para Moto em Campinas/SP',
    description:
      'Credenciada Pirelli, Metzeler e Michelin. Troca de pneu em 30 min sem agendamento. Entrega em todo Brasil.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Forza Motos' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Forza Motos — Pneus e Peças para Moto',
    description: 'Credenciada Pirelli, Metzeler e Michelin em Campinas/SP.',
    images: ['/og-image.jpg'],
  },
  alternates: { canonical: BASE_URL },
  ...(process.env.GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  }),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${barlowCondensed.variable} ${inter.variable}`}>
      <body className="bg-white text-[#111] font-inter antialiased">
        {/* SEO — JSON-LD global (Organization + WebSite + LocalBusiness) */}
        <JsonLd
          data={[organizationSchema(), websiteSchema(), localBusinessSchema()]}
        />
        <GoogleAnalytics />
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
