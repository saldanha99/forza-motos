export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Plus, Calendar } from 'lucide-react'

export const metadata = { title: 'Eventos / Calendário — Forza Admin' }

function formatData(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

export default async function EventosAdminPage() {
  const eventos = await prisma.evento.findMany({
    orderBy: { dataInicio: 'asc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar size={28} className="text-brand-accent" />
          <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Eventos</h1>
        </div>
        <Link
          href="/admin/eventos/novo"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-brand-accent/20"
        >
          <Plus size={16} /> Novo evento
        </Link>
      </div>

      {eventos.length === 0 ? (
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-16 text-center shadow-xl">
          <Calendar size={40} className="text-brand-muted mx-auto mb-4 opacity-40" />
          <p className="text-brand-muted text-sm mb-4">Nenhum evento cadastrado ainda.</p>
          <Link href="/admin/eventos/novo" className="text-brand-accent hover:underline text-sm font-semibold">
            Criar primeiro evento →
          </Link>
        </div>
      ) : (
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-border/20 bg-white/[0.01]">
              <tr className="text-xs text-brand-muted uppercase tracking-widest">
                <th className="text-left px-6 py-3 font-medium">Evento</th>
                <th className="text-left px-6 py-3 font-medium">Categoria</th>
                <th className="text-left px-6 py-3 font-medium">Data</th>
                <th className="text-left px-6 py-3 font-medium">Local</th>
                <th className="text-left px-6 py-3 font-medium">Preço</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id} className="border-b border-brand-border/10 hover:bg-white/[0.04] transition-colors">
                  <td className="px-6 py-3.5 text-brand-text font-medium max-w-[200px] truncate">{e.titulo}</td>
                  <td className="px-6 py-3.5 text-brand-muted">{e.categoria}</td>
                  <td className="px-6 py-3.5 text-brand-muted text-xs whitespace-nowrap">{formatData(e.dataInicio)}</td>
                  <td className="px-6 py-3.5 text-brand-muted max-w-[140px] truncate">{e.local}</td>
                  <td className="px-6 py-3.5 text-brand-muted">
                    {Number(e.preco) === 0 ? (
                      <span className="text-emerald-400 font-semibold text-xs">Gratuito</span>
                    ) : (
                      <span>R$ {Number(e.preco).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    {e.publicado
                      ? <Badge variant="success">Publicado</Badge>
                      : <Badge variant="warning">Rascunho</Badge>
                    }
                  </td>
                  <td className="px-6 py-3.5">
                    <Link href={`/admin/eventos/${e.id}`} className="text-xs text-brand-muted hover:text-brand-text transition-colors">
                      Editar →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
