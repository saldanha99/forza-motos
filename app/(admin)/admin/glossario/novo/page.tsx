import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { GerarTermoForm } from '@/components/glossario/GerarTermoForm'

export const metadata = { title: 'Gerar termo via IA — Forza Admin' }

export default function NovoTermoPage() {
  return (
    <div>
      <Link
        href="/admin/glossario"
        className="inline-flex items-center gap-2 text-sm text-brand-muted hover:text-brand-accent mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Voltar ao glossário
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">
            Gerar termo via IA
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            Escolha o modelo de IA, defina o nicho e a IA cria o conteúdo
            otimizado para SEO automaticamente.
          </p>
        </div>
      </div>

      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 lg:p-8 shadow-xl">
        <GerarTermoForm />
      </div>
    </div>
  )
}
