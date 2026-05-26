export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react'

export const metadata = { title: 'Monitor de 404 — Forza Admin' }

export default async function NotFoundMonitorPage() {
  const [naoResolvidos, resolvidos] = await Promise.all([
    prisma.seoNotFoundLog.findMany({
      where: { resolvido: false },
      orderBy: { hits: 'desc' },
      take: 100,
    }),
    prisma.seoNotFoundLog.count({ where: { resolvido: true } }),
  ])

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
            Monitor de 404
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            URLs quebradas detectadas em produção. Cada path agregado por hits.
            {' '}<strong className="text-brand-text">{resolvidos}</strong> já foram resolvidas com redirect.
          </p>
        </div>
      </div>

      <div className="admin-glass !bg-black/15 border border-brand-border/30 rounded-2xl p-4 mb-4 text-sm text-brand-muted">
        💡 <strong className="text-brand-text">Como resolver:</strong> Para cada 404 frequente,
        crie um redirect 301 em{' '}
        <Link href="/admin/seo/redirects" className="text-brand-accent hover:underline">
          Redirects
        </Link>{' '}
        apontando para a URL correta. Depois marque aqui como resolvido.
      </div>

      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-border/20 bg-white/[0.01]">
            <tr className="text-xs text-brand-muted uppercase tracking-widest">
              <th className="text-left px-6 py-3 font-medium">Path</th>
              <th className="text-left px-4 py-3 font-medium">Hits</th>
              <th className="text-left px-4 py-3 font-medium">Referer</th>
              <th className="text-left px-4 py-3 font-medium">Último acesso</th>
              <th className="text-left px-4 py-3 font-medium">Primeiro</th>
            </tr>
          </thead>
          <tbody>
            {naoResolvidos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-brand-muted">
                  <CheckCircle2
                    size={32}
                    className="mx-auto mb-3 opacity-50 text-emerald-400"
                  />
                  Nenhum 404 não resolvido. Parabéns!
                </td>
              </tr>
            )}
            {naoResolvidos.map((p) => (
              <tr
                key={p.id}
                className="border-b border-brand-border/10 hover:bg-white/[0.02]"
              >
                <td className="px-6 py-3 font-mono text-brand-text text-xs max-w-md truncate" title={p.path}>
                  {p.path}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      p.hits > 20 ? 'text-rose-400' : p.hits > 5 ? 'text-amber-400' : 'text-brand-muted'
                    }`}
                  >
                    <AlertTriangle size={12} />
                    {p.hits}×
                  </span>
                </td>
                <td className="px-4 py-3 text-brand-muted text-xs max-w-xs truncate" title={p.referer || ''}>
                  {p.referer || '—'}
                </td>
                <td className="px-4 py-3 text-brand-muted text-xs">
                  {formatDate(p.ultimoAcesso)}
                </td>
                <td className="px-4 py-3 text-brand-muted text-xs">
                  {formatDate(p.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
