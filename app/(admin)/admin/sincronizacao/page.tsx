export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { FadeIn } from '@/components/admin/FadeIn'
import { RefreshButton } from '@/components/admin/RefreshButton'
import Link from 'next/link'
import {
  Activity, PackageSearch, ImageOff, CloudUpload, Ghost,
  CircleCheck, CircleAlert, Wrench, Import,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Badge, Card, PageHeader, SectionTitle,
  TOM_FUNDO, TOM_TEXTO,
} from '@/components/admin/ui/primitives'
import type { TomStatus } from '@/lib/admin/status'

export const metadata = { title: 'Sincronização — Forza Admin' }

type JobStatus = {
  fim: string
  duracaoSeg: number
  resumo: Record<string, number> | null
  erro: string | null
}

type WorkerStatus = {
  iniciadoEm: string
  heartbeat: string | null
  jobAtual: string | null
  ciclos: number
  jobs: Record<string, JobStatus>
}

const JOB_INFO: Record<string, { titulo: string; desc: string; icon: any }> = {
  catalogo: { titulo: 'Catálogo', desc: 'Importa produtos novos do Olist e desativa fantasmas (1x/dia)', icon: Import },
  imagens: { titulo: 'Imagens pendentes', desc: 'Busca fotos, peso e dimensões de produtos não verificados', icon: ImageOff },
  espelhar: { titulo: 'Espelhamento de imagens', desc: 'Re-hospeda as fotos no storage próprio (fim das imagens quebradas)', icon: CloudUpload },
  estoque: { titulo: 'Estoque real', desc: 'Confere o saldo de todo o catálogo no Olist (depósito Loja)', icon: PackageSearch },
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return 'nunca'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h${min % 60 ? ` ${min % 60}min` : ''}`
  return `há ${Math.floor(h / 24)}d`
}

export default async function SincronizacaoPage() {
  const [statusRow, total, ativos, dropship999, imgPendentes, semFotoNoTiny, espelhadasRaw] =
    await Promise.all([
      prisma.setting.findUnique({ where: { key: 'sync_worker_status' } }),
      prisma.product.count(),
      prisma.product.count({ where: { ativo: true } }),
      prisma.product.count({ where: { estoque: 999, ativo: true } }),
      prisma.product.count({ where: { temImagem: false, imagensVerificadas: false, tinyId: { not: null } } }),
      prisma.product.count({ where: { temImagem: false, imagensVerificadas: true, tinyId: { not: null } } }),
      prisma.$queryRaw<[{ n: bigint }]>`
        SELECT COUNT(*)::bigint AS n FROM "Product"
        WHERE "temImagem" = true AND imagens::text LIKE '%blob.vercel-storage.com%'
      `,
    ])

  const espelhadas = Number(espelhadasRaw[0]?.n ?? 0)
  const comImagem = await prisma.product.count({ where: { temImagem: true } })

  let status: WorkerStatus | null = null
  try {
    status = statusRow ? (JSON.parse(statusRow.value) as WorkerStatus) : null
  } catch {
    status = null
  }

  const heartbeatMin = status?.heartbeat
    ? (Date.now() - new Date(status.heartbeat).getTime()) / 60000
    : Infinity
  const online = heartbeatMin < 45
  const tomWorker: TomStatus = online ? 'success' : 'danger'

  return (
    <div>
      <PageHeader
        titulo="Sincronização"
        descricao="O robô confere estoque, fotos e catálogo com o Olist 24h por dia — aqui você acompanha a saúde dele."
        acoes={<RefreshButton />}
      />

      {/* Saúde do worker */}
      <FadeIn delay={0} className="mb-8">
        <Card className="flex items-center gap-4 px-6 py-5">
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
              TOM_FUNDO[tomWorker],
              TOM_TEXTO[tomWorker],
            )}
          >
            {online ? <CircleCheck size={28} /> : <CircleAlert size={28} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-barlow text-lg font-bold text-brand-text">Robô de sincronização</p>
              <Badge tom={tomWorker}>{online ? 'Online' : 'Sem sinal'}</Badge>
            </div>
            <p className="mt-1 text-sm text-brand-muted">
              {status
                ? online
                  ? status.jobAtual
                    ? `Rodando agora: ${JOB_INFO[status.jobAtual]?.titulo ?? status.jobAtual} · último sinal ${tempoRelativo(status.heartbeat)} · ${status.ciclos} ciclos completos`
                    : `Em espera entre ciclos · último sinal ${tempoRelativo(status.heartbeat)} · ${status.ciclos} ciclos completos`
                  : `Último sinal ${tempoRelativo(status.heartbeat)} — verificar VPS (docker logs forza-worker)`
                : 'Nenhum status registrado ainda — o robô grava o primeiro status ao iniciar.'}
            </p>
          </div>
          <Activity size={20} className={cn(TOM_TEXTO[tomWorker], online && 'animate-pulse')} />
        </Card>
      </FadeIn>

      {/* Números do catálogo */}
      <FadeIn delay={80} className="mb-8">
        <SectionTitle>Catálogo agora</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { v: total, l: 'produtos no site' },
            { v: ativos, l: 'ativos (à venda)' },
            { v: dropship999, l: 'dropship (999)' },
            { v: imgPendentes, l: 'aguardando verificação de foto' },
            { v: `${espelhadas}/${comImagem}`, l: 'fotos no storage próprio' },
          ].map((k) => (
            <Card key={k.l} className="px-4 py-4">
              <p className="font-barlow text-2xl font-black text-brand-text">{k.v}</p>
              <p className="mt-1 text-xs text-brand-muted">{k.l}</p>
            </Card>
          ))}
        </div>
        {semFotoNoTiny > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-brand-warning">
            <Ghost size={13} />
            {semFotoNoTiny} produtos estão fora do ar porque não têm nenhuma foto cadastrada no Olist —
            suba as fotos lá (ou em Fotos aqui no admin) que o robô ativa sozinho.
          </p>
        )}
      </FadeIn>

      {/* Últimas execuções */}
      <FadeIn delay={160} className="mb-8">
        <SectionTitle>Últimas execuções</SectionTitle>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Object.entries(JOB_INFO).map(([key, info]) => {
            const job = status?.jobs?.[key]
            const rodandoAgora = status?.jobAtual === key
            return (
              <div
                key={key}
                className={cn(
                  'rounded-2xl border bg-brand-surface px-5 py-4 shadow-card',
                  job?.erro ? 'border-brand-danger' : rodandoAgora ? 'border-brand-accent' : 'border-brand-border',
                )}
              >
                <div className="mb-1.5 flex items-center gap-3">
                  <info.icon size={17} className={cn(rodandoAgora ? 'animate-pulse text-brand-accent' : 'text-brand-muted')} />
                  <p className="font-barlow font-bold text-brand-text">{info.titulo}</p>
                  <span className="ml-auto text-xs text-brand-muted">
                    {rodandoAgora ? '⏳ rodando agora…' : job ? tempoRelativo(job.fim) : 'aguardando 1ª execução'}
                  </span>
                </div>
                <p className="mb-2 text-xs text-brand-muted">{info.desc}</p>
                {job?.erro ? (
                  <p className="text-xs text-brand-danger">Erro: {job.erro}</p>
                ) : job?.resumo ? (
                  <p className="font-mono text-xs text-brand-text">
                    {Object.entries(job.resumo)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                    {job.duracaoSeg ? ` · ${Math.round(job.duracaoSeg / 60)}min` : ''}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </FadeIn>

      {/* Ferramentas manuais (legado) */}
      <FadeIn delay={240}>
        <Card className="flex flex-wrap items-center gap-3 px-5 py-4">
          <Wrench size={16} className="text-brand-muted" />
          <p className="flex-1 text-sm text-brand-muted">
            O robô cuida de tudo sozinho. As ferramentas manuais antigas continuam disponíveis para casos pontuais:
          </p>
          <Link
            href="/admin/sync-categoria"
            className="text-xs font-semibold text-brand-accent transition-colors hover:text-brand-accent-hover"
          >
            Sync por categoria →
          </Link>
        </Card>
      </FadeIn>
    </div>
  )
}
