import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { GerarTermoForm } from '@/components/glossario/GerarTermoForm'
import { Card, PageHeader } from '@/components/admin/ui/primitives'

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

      <PageHeader
        titulo="Gerar termo via IA"
        descricao="Escolha o modelo de IA, defina o nicho e a IA cria o conteúdo já otimizado para SEO."
      />

      <Card className="p-6 lg:p-8">
        <GerarTermoForm />
      </Card>
    </div>
  )
}
