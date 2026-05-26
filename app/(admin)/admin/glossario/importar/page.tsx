import Link from 'next/link'
import { ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { ImportarCSVForm } from '@/components/glossario/ImportarCSVForm'

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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">
            Importar CSV
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            Suba um arquivo CSV com lista de termos. Cada linha vira um job na
            fila — geração via IA acontece automaticamente (1 por hora pelo cron).
          </p>
        </div>
      </div>

      {/* Card de instruções de formato */}
      <div className="admin-glass !bg-black/15 border border-brand-border/30 rounded-2xl p-5 mb-6 shadow-lg">
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
            <pre className="text-[11px] bg-black/40 border border-brand-border/30 rounded-lg p-3 overflow-x-auto text-brand-muted">
{`titulo,letra,categoria
"Pneu Radial",P,Pneus
"Pneu Diagonal",P,Pneus
"Óleo Mineral",O,Óleos
"Carburador",C,Motor`}
            </pre>
          </div>
        </div>
      </div>

      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 lg:p-8 shadow-xl">
        <ImportarCSVForm />
      </div>
    </div>
  )
}
