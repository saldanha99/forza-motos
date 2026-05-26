export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import {
  Search,
  Globe,
  Link2,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  BookOpen,
  FileText,
  Package,
} from 'lucide-react'
import { SEO_CONFIG } from '@/lib/seo/config'
import { ReindexNowButton } from '@/components/admin/seo/ReindexNowButton'

export const metadata = { title: 'SEO Dashboard — Forza Admin' }

export default async function SeoDashboardPage() {
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    indexingStats,
    ultimasNotificacoes,
    totalRedirects,
    total404,
    top404,
    totalGlossario,
    totalBlog,
    totalProdutos,
    falhasRecentes,
  ] = await Promise.all([
    prisma.seoIndexingLog.groupBy({
      by: ['provider', 'status'],
      where: { createdAt: { gte: seteDiasAtras } },
      _count: true,
    }),
    prisma.seoIndexingLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        url: true,
        provider: true,
        status: true,
        action: true,
        erro: true,
        origem: true,
        createdAt: true,
      },
    }),
    prisma.seoRedirect.count({ where: { ativo: true } }),
    prisma.seoNotFoundLog.count({ where: { resolvido: false } }),
    prisma.seoNotFoundLog.findMany({
      where: { resolvido: false },
      orderBy: { hits: 'desc' },
      take: 5,
      select: { path: true, hits: true, ultimoAcesso: true },
    }),
    prisma.glossaryTerm.count({ where: { publicado: true } }),
    prisma.blogPost.count({ where: { publicado: true } }),
    prisma.product.count({ where: { ativo: true, temImagem: true } }),
    prisma.seoIndexingLog.count({
      where: { status: 'FALHA', createdAt: { gte: seteDiasAtras } },
    }),
  ])

  // Reduz stats em mapa para fácil consumo
  const getStat = (provider: string, status: string) =>
    indexingStats.find((s) => s.provider === provider && s.status === status)?._count || 0

  const sucessosGoogle = getStat('GOOGLE', 'SUCESSO')
  const falhasGoogle = getStat('GOOGLE', 'FALHA')
  const sucessosIndexNow = getStat('INDEXNOW', 'SUCESSO')
  const falhasIndexNow = getStat('INDEXNOW', 'FALHA')

  const totalSucesso = sucessosGoogle + sucessosIndexNow
  const totalEnvios = totalSucesso + falhasGoogle + falhasIndexNow
  const taxaSucesso = totalEnvios > 0 ? Math.round((totalSucesso / totalEnvios) * 100) : 100

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">
            SEO Dashboard
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            Indexação, redirects, 404 monitor e status do ranqueamento — substituto do
            Rank Math.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${SEO_CONFIG.siteUrl}/sitemap.xml`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-brand-border/40 text-brand-text px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            <ExternalLink size={14} /> Ver sitemap
          </a>
          <a
            href={`${SEO_CONFIG.siteUrl}/robots.txt`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-brand-border/40 text-brand-text px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            <ExternalLink size={14} /> robots.txt
          </a>
          <ReindexNowButton />
        </div>
      </div>

      {/* KPIs grandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <BigKpi
          icon={<TrendingUp size={20} />}
          label="Taxa sucesso (7d)"
          value={`${taxaSucesso}%`}
          subtitle={`${totalSucesso}/${totalEnvios} envios`}
          tone={taxaSucesso >= 90 ? 'success' : taxaSucesso >= 70 ? 'warning' : 'danger'}
        />
        <BigKpi
          icon={<Globe size={20} />}
          label="Google (7d)"
          value={sucessosGoogle}
          subtitle={`${falhasGoogle} falhas`}
          tone="info"
        />
        <BigKpi
          icon={<Search size={20} />}
          label="IndexNow (7d)"
          value={sucessosIndexNow}
          subtitle={`${falhasIndexNow} falhas`}
          tone="info"
        />
        <BigKpi
          icon={<AlertTriangle size={20} />}
          label="404 não resolvidos"
          value={total404}
          subtitle={`${totalRedirects} redirects ativos`}
          tone={total404 > 10 ? 'danger' : 'success'}
        />
      </div>

      {/* Conteúdo indexável */}
      <h2 className="text-lg font-semibold text-brand-text mb-3">
        Conteúdo no sitemap
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <ContentCard
          icon={<Package size={18} />}
          label="Produtos"
          value={totalProdutos}
          href="/admin/produtos"
        />
        <ContentCard
          icon={<FileText size={18} />}
          label="Posts blog"
          value={totalBlog}
          href="/admin/blog"
        />
        <ContentCard
          icon={<BookOpen size={18} />}
          label="Termos glossário"
          value={totalGlossario}
          href="/admin/glossario"
        />
      </div>

      {/* Duas colunas: notificações + 404 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Últimas notificações de indexação */}
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border/20">
            <h3 className="font-semibold text-brand-text">
              Últimos envios de indexação
            </h3>
            {falhasRecentes > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-rose-400">
                <AlertTriangle size={12} /> {falhasRecentes} falhas
              </span>
            )}
          </div>
          <div className="divide-y divide-brand-border/10 max-h-96 overflow-y-auto">
            {ultimasNotificacoes.length === 0 && (
              <div className="px-5 py-12 text-center text-brand-muted text-sm">
                Nenhum envio ainda. Publique um termo, post ou produto para o sistema
                disparar notificações.
              </div>
            )}
            {ultimasNotificacoes.map((n) => {
              const path = n.url.replace(SEO_CONFIG.siteUrl, '')
              return (
                <div key={n.id} className="px-5 py-3 hover:bg-white/[0.02] text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-brand-text truncate" title={n.url}>
                        {path || '/'}
                      </div>
                      {n.erro && (
                        <div
                          className="text-rose-400 mt-1 text-[11px] truncate"
                          title={n.erro}
                        >
                          {n.erro}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          n.provider === 'GOOGLE'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {n.provider}
                      </span>
                      <IndexingStatusIcon status={n.status} />
                    </div>
                  </div>
                  <div className="text-brand-muted mt-1 text-[10px]">
                    {formatDate(n.createdAt)} · {n.origem || 'sem origem'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top 404 */}
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border/20">
            <h3 className="font-semibold text-brand-text">404 mais frequentes</h3>
            <Link
              href="/admin/seo/404"
              className="text-xs text-brand-accent hover:underline"
            >
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-brand-border/10">
            {top404.length === 0 && (
              <div className="px-5 py-12 text-center text-brand-muted text-sm">
                Nenhum 404 ainda. Quando alguém acessar uma URL quebrada, aparece aqui.
              </div>
            )}
            {top404.map((p) => (
              <div
                key={p.path}
                className="px-5 py-3 flex items-center justify-between text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-brand-text truncate">{p.path}</div>
                  <div className="text-brand-muted mt-0.5 text-[10px]">
                    Último acesso: {formatDate(p.ultimoAcesso)}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                    {p.hits}× hits
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Links rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickLink
          icon={<Link2 size={18} />}
          label="Gerenciar Redirects 301"
          desc={`${totalRedirects} redirects ativos`}
          href="/admin/seo/redirects"
        />
        <QuickLink
          icon={<AlertTriangle size={18} />}
          label="Monitor de 404"
          desc={`${total404} URLs quebradas não resolvidas`}
          href="/admin/seo/404"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ─────────────────────────────────────────────────────────────────────────────

function BigKpi({
  icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  subtitle: string
  tone: 'success' | 'warning' | 'danger' | 'info'
}) {
  const map = {
    success: 'from-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'from-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'from-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'from-sky-500/10 text-sky-400 border-sky-500/20',
  }
  return (
    <div
      className={`admin-glass !bg-black/20 border rounded-2xl p-5 bg-gradient-to-br to-transparent ${map[tone]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-brand-muted text-xs uppercase tracking-widest font-medium">
          {label}
        </span>
        <span className="opacity-70">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-brand-text">{value}</div>
      <div className="text-xs text-brand-muted mt-1">{subtitle}</div>
    </div>
  )
}

function ContentCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: number
  href: string
}) {
  return (
    <Link
      href={href}
      className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-4 hover:border-brand-accent/40 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-brand-muted uppercase tracking-widest mb-1">
            {label}
          </div>
          <div className="text-2xl font-bold text-brand-text">{value}</div>
        </div>
        <span className="text-brand-muted group-hover:text-brand-accent transition-colors">
          {icon}
        </span>
      </div>
    </Link>
  )
}

function QuickLink({
  icon,
  label,
  desc,
  href,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-4 hover:border-brand-accent/40 transition-all group flex items-center gap-4"
    >
      <span className="text-brand-accent">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-brand-text">{label}</div>
        <div className="text-xs text-brand-muted">{desc}</div>
      </div>
      <ExternalLink size={14} className="text-brand-muted group-hover:text-brand-accent" />
    </Link>
  )
}

function IndexingStatusIcon({ status }: { status: string }) {
  if (status === 'SUCESSO') return <CheckCircle2 size={14} className="text-emerald-400" />
  if (status === 'FALHA') return <XCircle size={14} className="text-rose-400" />
  if (status === 'PENDENTE') return <RefreshCw size={14} className="text-amber-400 animate-spin" />
  return <span className="text-brand-muted text-xs">{status}</span>
}
