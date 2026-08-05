import Link from 'next/link'
import { ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { ImportarCSVForm } from '@/components/glossario/ImportarCSVForm'
import { Card, PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Importar CSV — Forza Admin' }

export default function ImportarPage() {
  return (
    <div>
      <Link
        href="/admin/glossario"
        className="inline-flex items-center gap-2 text-sm text-brand-muted hover:text-brand-accent mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Voltar ao glossário
      </Link>

      <PageHeader
        titulo="Importar CSV"
        descricao="Suba um arquivo CSV com a lista de termos — cada linha vira um job na fila, gerado via IA pelo cron (1 por hora)."
      />

      {/* Card de instruções de formato */}
      <Card className="p-5 mb-6">
        <div className="flex items-start gap-3">
          <FileSpreadsheet
            size={20}
            className="text-brand-accent flex-shrink-0 mt-0.5"
          />
          <div className="flex-1">
            <h3 className="font-semibold text-brand-text mb-1">
              Formato esperado do CSV
            </h3>
            <p className="text-xs text-brand-muted mb-3">
              Header obrigatório. Apenas <code>titulo</code> é obrigatório — as outras
              colunas são opcionais.
            </p>
            <pre className="text-[11px] bg-brand-elevated border border-brand-border rounded-lg p-3 overflow-x-auto text-brand-muted">
{`titulo,letra,categoria
"Pneu Radial",P,Pneus
"Pneu Diagonal",P,Pneus
"Óleo Mineral",O,Óleos
"Carburador",C,Motor`}
            </pre>
          </div>
        </div>
      </Card>

      <Card className="p-6 lg:p-8">
        <ImportarCSVForm />
      </Card>
    </div>
  )
}
