export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  Package,
  RefreshCw,
  Search,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn, formatDate } from '@/lib/utils'
import { SEO_CONFIG } from '@/lib/seo/config'
import { ReindexNowButton } from '@/components/admin/seo/ReindexNowButton'
import { SeoConfigSection } from '@/components/admin/seo/SeoConfigSection'
import { KpiCard } from '@/components/admin/KpiCard'
import {
  Badge, BotaoLink, Card, CardHeader, EmptyState, PageHeader, SectionTitle,
  TOM_TEXTO,
} from '@/components/admin/ui/primitives'

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
      <PageHeader
        titulo="SEO Dashboard"
        descricao="Indexação, redirects, monitor de 404 e ranqueamento — substituto do Rank Math."
        acoes={
          <>
            <BotaoLink
              href={`${SEO_CONFIG.siteUrl}/sitemap.xml`}
              target="_blank"
              rel="noreferrer"
              variante="secundario"
            >
              <ExternalLink size={14} /> Ver sitemap
            </BotaoLink>
            <BotaoLink
              href={`${SEO_CONFIG.siteUrl}/robots.txt`}
              target="_blank"
              rel="noreferrer"
              variante="secundario"
            >
              <ExternalLink size={14} /> robots.txt
            </BotaoLink>
            <ReindexNowButton />
          </>
        }
      />

      {/* KPIs grandes */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Taxa sucesso (7d)"
          value={taxaSucesso}
          suffix="%"
          icon={TrendingUp}
          tom={taxaSucesso >= 90 ? 'success' : taxaSucesso >= 70 ? 'warning' : 'danger'}
          detalhe={`${totalSucesso}/${totalEnvios} envios`}
        />
        <KpiCard
          label="Google (7d)"
          value={sucessosGoogle}
          icon={Globe}
          tom="info"
          detalhe={`${falhasGoogle} falha(s)`}
        />
        <KpiCard
          label="IndexNow (7d)"
          value={sucessosIndexNow}
          icon={Search}
          tom="info"
          detalhe={`${falhasIndexNow} falha(s)`}
        />
        <KpiCard
          label="404 não resolvidos"
          value={total404}
          icon={AlertTriangle}
          tom={total404 > 10 ? 'danger' : 'success'}
          detalhe={`${totalRedirects} redirects ativos`}
          href="/admin/seo/404"
        />
      </div>

      {/* Conteúdo indexável */}
      <SectionTitle>Conteúdo no sitemap</SectionTitle>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ConteudoCard icon={Package} label="Produtos" value={totalProdutos} href="/admin/produtos" />
        <ConteudoCard icon={FileText} label="Posts blog" value={totalBlog} href="/admin/blog" />
        <ConteudoCard icon={BookOpen} label="Termos glossário" value={totalGlossario} href="/admin/glossario" />
      </div>

      {/* Duas colunas: notificações + 404 */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Últimas notificações de indexação */}
        <Card className="overflow-hidden">
          <CardHeader
            titulo="Últimos envios de indexação"
            acao={
              falhasRecentes > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-danger">
                  <AlertTriangle size={12} /> {falhasRecentes} falhas
                </span>
              )
            }
          />
          {ultimasNotificacoes.length === 0 ? (
            <EmptyState
              compacto
              icone={Search}
              titulo="Nenhum envio ainda"
              descricao="Publique um termo, post ou produto para o sistema disparar notificações de indexação."
              className="m-4 border-0"
            />
          ) : (
            <div className="admin-scroll max-h-96 divide-y divide-brand-hair overflow-y-auto">
              {ultimasNotificacoes.map((n) => {
                const path = n.url.replace(SEO_CONFIG.siteUrl, '')
                return (
                  <div key={n.id} className="px-5 py-3 text-xs transition-colors hover:bg-brand-tint-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-brand-text" title={n.url}>
                          {path || '/'}
                        </div>
                        {n.erro && (
                          <div className="mt-1 truncate text-[11px] text-brand-danger" title={n.erro}>
                            {n.erro}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tom="neutro">{n.provider}</Badge>
                        <IndexingStatusIcon status={n.status} />
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] text-brand-dim">
                      {formatDate(n.createdAt)} · {n.origem || 'sem origem'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Top 404 */}
        <Card className="overflow-hidden">
          <CardHeader
            titulo="404 mais frequentes"
            acao={
              <Link href="/admin/seo/404" className="text-xs font-semibold text-brand-accent hover:underline">
                Ver todos →
              </Link>
            }
          />
          {top404.length === 0 ? (
            <EmptyState
              compacto
              icone={CheckCircle2}
              titulo="Nenhum 404 ainda"
              descricao="Quando alguém acessar uma URL quebrada em produção, ela aparece aqui."
              className="m-4 border-0"
            />
          ) : (
            <div className="divide-y divide-brand-hair">
              {top404.map((p) => (
                <div key={p.path} className="flex items-center justify-between px-5 py-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-brand-text">{p.path}</div>
                    <div className="mt-0.5 text-[10px] text-brand-dim">
                      Último acesso: {formatDate(p.ultimoAcesso)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-danger">
                      {p.hits}× hits
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Links rápidos */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QuickLink
          icon={Link2}
          label="Gerenciar Redirects 301"
          desc={`${totalRedirects} redirects ativos`}
          href="/admin/seo/redirects"
        />
        <QuickLink
          icon={AlertTriangle}
          label="Monitor de 404"
          desc={`${total404} URLs quebradas não resolvidas`}
          href="/admin/seo/404"
        />
      </div>

      {/* Configurações SEO */}
      <SeoConfigSection />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ─────────────────────────────────────────────────────────────────────────────

function ConteudoCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Package
  label: string
  value: number
  href: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-card transition hover:border-brand-accent"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-xs uppercase tracking-widest text-brand-dim">{label}</div>
          <div className="font-barlow text-2xl font-bold text-brand-text">{value}</div>
        </div>
        <span className="text-brand-muted transition-colors group-hover:text-brand-accent">
          <Icon size={18} />
        </span>
      </div>
    </Link>
  )
}

function QuickLink({
  icon: Icon,
  label,
  desc,
  href,
}: {
  icon: typeof Link2
  label: string
  desc: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-card transition hover:border-brand-accent"
    >
      <span className="text-brand-accent">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-brand-text">{label}</div>
        <div className="text-xs text-brand-muted">{desc}</div>
      </div>
      <ExternalLink size={14} className="text-brand-muted transition-colors group-hover:text-brand-accent" />
    </Link>
  )
}

function IndexingStatusIcon({ status }: { status: string }) {
  if (status === 'SUCESSO') return <CheckCircle2 size={14} className={TOM_TEXTO.success} />
  if (status === 'FALHA') return <XCircle size={14} className={TOM_TEXTO.danger} />
  if (status === 'PENDENTE') {
    return <RefreshCw size={14} className={cn(TOM_TEXTO.warning, 'animate-spin')} />
  }
  return <span className="text-xs text-brand-muted">{status}</span>
}
