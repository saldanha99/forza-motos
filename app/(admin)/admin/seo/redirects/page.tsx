export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Link2, ArrowRight } from 'lucide-react'

export const metadata = { title: 'Redirects 301 — Forza Admin' }

export default async function RedirectsPage() {
  const redirects = await prisma.seoRedirect.findMany({
    orderBy: { hits: 'desc' },
    take: 200,
  })

  return (
    <div>
      <Link
        href="/admin/seo"
        className="inline-flex items-center gap-2 text-sm text-brand-muted hover:text-brand-accent mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Voltar ao SEO Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">
            Redirects 301
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            Redirecionamentos gerenciáveis (de URL antiga para URL nova).
            Cadastre para preservar SEO ao mudar slugs.
          </p>
        </div>
      </div>

      <div className="admin-glass !bg-black/15 border border-brand-border/30 rounded-2xl p-4 mb-4 text-sm text-brand-muted">
        💡 <strong className="text-brand-text">Como ativar:</strong> os redirects ficam no banco mas
        ainda não estão sendo aplicados pelo middleware (Edge Runtime + Prisma exige
        Prisma Accelerate). Veja{' '}
        <code className="text-brand-accent">lib/seo/redirects.ts</code> e o comentário no
        topo do <code className="text-brand-accent">middleware.ts</code> para ativar.
      </div>

      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-border/20 bg-white/[0.01]">
            <tr className="text-xs text-brand-muted uppercase tracking-widest">
              <th className="text-left px-6 py-3 font-medium">De</th>
              <th className="text-left px-4 py-3 font-medium">Para</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Hits</th>
              <th className="text-left px-4 py-3 font-medium">Ativo</th>
              <th className="text-left px-4 py-3 font-medium">Criado</th>
            </tr>
          </thead>
          <tbody>
            {redirects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-brand-muted">
                  <Link2 size={32} className="mx-auto mb-3 opacity-30" />
                  Nenhum redirect cadastrado.
                  <div className="text-xs mt-2 max-w-md mx-auto">
                    Adicione redirects via Prisma Studio ou crie uma UI dedicada quando
                    precisar gerenciar muitos.
                  </div>
                </td>
              </tr>
            )}
            {redirects.map((r) => (
              <tr
                key={r.id}
                className="border-b border-brand-border/10 hover:bg-white/[0.02]"
              >
                <td className="px-6 py-3 font-mono text-brand-text text-xs">{r.from}</td>
                <td className="px-4 py-3 font-mono text-brand-muted text-xs">
                  <ArrowRight size={11} className="inline mr-1" />
                  {r.to}
                </td>
                <td className="px-4 py-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {r.statusCode}
                  </span>
                </td>
                <td className="px-4 py-3 text-brand-muted">{r.hits}</td>
                <td className="px-4 py-3">
                  {r.ativo ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ATIVO
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-brand-muted border border-brand-border/30">
                      OFF
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-brand-muted text-xs">
                  {formatDate(r.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
