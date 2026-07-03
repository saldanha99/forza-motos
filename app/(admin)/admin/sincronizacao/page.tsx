export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { FadeIn } from '@/components/admin/FadeIn'
import { RefreshButton } from '@/components/admin/RefreshButton'
import Link from 'next/link'
import {
  Activity, PackageSearch, ImageOff, CloudUpload, Ghost,
  CircleCheck, CircleAlert, Wrench, Import,
} from 'lucide-react'

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

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">
            Sincronização
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            O robô confere estoque, fotos e catálogo com o Olist 24h por dia — aqui você acompanha a saúde dele.
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Saúde do worker */}
      <FadeIn delay={0} className="mb-8">
        <div
          className={`flex items-center gap-4 rounded-2xl border px-6 py-5 ${
            online
              ? 'bg-emerald-500/[0.06] border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/40'
          }`}
        >
          {online ? (
            <CircleCheck size={32} className="text-emerald-400" />
          ) : (
            <CircleAlert size={32} className="text-red-400" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-barlow font-bold text-lg ${online ? 'text-emerald-300' : 'text-red-300'}`}>
              {online ? 'Robô de sincronização ONLINE' : 'Robô de sincronização SEM SINAL'}
            </p>
            <p className="text-sm text-brand-muted">
              {status
                ? online
                  ? status.jobAtual
                    ? `Rodando agora: ${JOB_INFO[status.jobAtual]?.titulo ?? status.jobAtual} · último sinal ${tempoRelativo(status.heartbeat)} · ${status.ciclos} ciclos completos`
                    : `Em espera entre ciclos · último sinal ${tempoRelativo(status.heartbeat)} · ${status.ciclos} ciclos completos`
                  : `Último sinal ${tempoRelativo(status.heartbeat)} — verificar VPS (docker logs forza-worker)`
                : 'Nenhum status registrado ainda — o robô grava o primeiro status ao iniciar.'}
            </p>
          </div>
          <Activity size={20} className={online ? 'text-emerald-500/60 animate-pulse' : 'text-red-500/60'} />
        </div>
      </FadeIn>

      {/* Números do catálogo */}
      <FadeIn delay={80} className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted/70 mb-2">
          Catálogo agora
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { v: total, l: 'produtos no site' },
            { v: ativos, l: 'ativos (à venda)' },
            { v: dropship999, l: 'dropship (999)' },
            { v: imgPendentes, l: 'aguardando verificação de foto' },
            { v: `${espelhadas}/${comImagem}`, l: 'fotos no storage próprio' },
          ].map((k) => (
            <div key={k.l} className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl px-4 py-4">
              <p className="font-barlow font-black text-2xl text-brand-text">{k.v}</p>
              <p className="text-xs text-brand-muted mt-1">{k.l}</p>
            </div>
          ))}
        </div>
        {semFotoNoTiny > 0 && (
          <p className="flex items-center gap-2 text-xs text-amber-400/80 mt-3">
            <Ghost size={13} />
            {semFotoNoTiny} produtos estão fora do ar porque não têm nenhuma foto cadastrada no Olist —
            suba as fotos lá (ou em Fotos aqui no admin) que o robô ativa sozinho.
          </p>
        )}
      </FadeIn>

      {/* Últimas execuções */}
      <FadeIn delay={160} className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted/70 mb-2">
          Últimas execuções
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Object.entries(JOB_INFO).map(([key, info]) => {
            const job = status?.jobs?.[key]
            const rodandoAgora = status?.jobAtual === key
            return (
              <div
                key={key}
                className={`admin-glass !bg-black/20 border rounded-2xl px-5 py-4 ${
                  job?.erro ? 'border-red-500/40' : rodandoAgora ? 'border-brand-accent/50' : 'border-brand-border/30'
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <info.icon size={17} className={rodandoAgora ? 'text-brand-accent animate-pulse' : 'text-brand-muted'} />
                  <p className="font-barlow font-bold text-brand-text">{info.titulo}</p>
                  <span className="ml-auto text-xs text-brand-muted">
                    {rodandoAgora ? '⏳ rodando agora…' : job ? tempoRelativo(job.fim) : 'aguardando 1ª execução'}
                  </span>
                </div>
                <p className="text-xs text-brand-muted mb-2">{info.desc}</p>
                {job?.erro ? (
                  <p className="text-xs text-red-400">Erro: {job.erro}</p>
                ) : job?.resumo ? (
                  <p className="text-xs text-brand-text/80 font-mono">
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
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3">
          <Wrench size={16} className="text-brand-muted" />
          <p className="text-sm text-brand-muted flex-1">
            O robô cuida de tudo sozinho. As ferramentas manuais antigas continuam disponíveis para casos pontuais:
          </p>
          <Link
            href="/admin/sync-categoria"
            className="text-xs font-semibold text-brand-accent hover:text-brand-accent-hover transition-colors"
          >
            Sync por categoria →
          </Link>
        </div>
      </FadeIn>
    </div>
  )
}
