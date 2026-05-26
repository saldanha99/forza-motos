/**
 * Camada unificada de indexação — substitui chamadas diretas a
 * notifyGoogleIndexing() e notifyIndexNow().
 *
 * Vantagens sobre chamadas diretas:
 *   - Notifica Google + Bing em paralelo
 *   - Registra cada envio na tabela SeoIndexingLog (auditoria)
 *   - Deduplica: ignora se mesma URL+ação foi enviada há < 1 minuto
 *   - Fire-and-forget por padrão (não bloqueia o request)
 *   - Cron de reindexação noturno usa o mesmo helper
 *
 * Uso típico após publicar conteúdo:
 *
 *   import { triggerIndexing } from '@/lib/seo/indexing'
 *
 *   const post = await prisma.blogPost.update({...})
 *   triggerIndexing(`${SEO_CONFIG.siteUrl}/blog/${post.slug}`, {
 *     action: 'URL_UPDATED',
 *     origem: 'admin-blog-publish',
 *   })
 */

import { prisma } from '@/lib/prisma'
import { notifyGoogleIndexing, notifyIndexNow } from './instant-indexing'

export interface TriggerIndexingOptions {
  /** URL_UPDATED para publicação/atualização, URL_DELETED para remoção */
  action?: 'URL_UPDATED' | 'URL_DELETED'
  /** Identificador da origem do trigger. Ex: "admin-blog-publish", "glossario-worker", "cron-reindex" */
  origem?: string
  /** Se true, aguarda a notificação completar (default: false = fire-and-forget) */
  await?: boolean
  /** Pula a verificação de dedup (use no cron de re-indexação) */
  forcar?: boolean
}

export interface TriggerIndexingResult {
  url: string
  google: { ok: boolean; logId: string; erro?: string }
  indexnow: { ok: boolean; logId: string; erro?: string }
}

const DEDUP_WINDOW_MS = 60 * 1000 // 1 minuto

// ============================================================
// Função principal
// ============================================================

export async function triggerIndexing(
  url: string,
  options: TriggerIndexingOptions = {}
): Promise<TriggerIndexingResult | void> {
  const { action = 'URL_UPDATED', origem, await: aguardar = false, forcar = false } = options

  // Fire-and-forget: dispara em background e retorna imediatamente
  if (!aguardar) {
    void executarIndexacao(url, { action, origem, forcar }).catch(() => null)
    return
  }

  return executarIndexacao(url, { action, origem, forcar })
}

// ============================================================
// Versão em lote — para o cron de reindexação
// ============================================================

export async function triggerIndexingBatch(
  urls: string[],
  options: { action?: 'URL_UPDATED' | 'URL_DELETED'; origem?: string } = {}
): Promise<{ enviadas: number; falhas: number; resultados: TriggerIndexingResult[] }> {
  const { action = 'URL_UPDATED', origem = 'batch' } = options
  const resultados: TriggerIndexingResult[] = []

  // IndexNow aceita até 10.000 URLs por request — envia em lote único
  const logsIndexNow = await criarLogs(urls, 'INDEXNOW', action, origem)
  const respIndexNow = await notifyIndexNow(urls)
  await atualizarLogsLote(logsIndexNow, respIndexNow)

  // Google Indexing API exige 1 request por URL (limite 200/dia)
  for (const url of urls) {
    const logGoogle = await criarLog(url, 'GOOGLE', action, origem)
    const respGoogle = await notifyGoogleIndexing(url, action)
    await atualizarLog(logGoogle.id, respGoogle)
    resultados.push({
      url,
      google: { ok: respGoogle.ok, logId: logGoogle.id, erro: respGoogle.error },
      indexnow: {
        ok: respIndexNow.ok,
        logId: logsIndexNow.find((l) => l.url === url)?.id || '',
        erro: respIndexNow.error,
      },
    })
  }

  const enviadas = resultados.filter((r) => r.google.ok || r.indexnow.ok).length
  return { enviadas, falhas: resultados.length - enviadas, resultados }
}

// ============================================================
// Implementação interna
// ============================================================

async function executarIndexacao(
  url: string,
  opts: { action: 'URL_UPDATED' | 'URL_DELETED'; origem?: string; forcar: boolean }
): Promise<TriggerIndexingResult> {
  // Dedup — verifica se já houve envio recente
  if (!opts.forcar) {
    const recente = await prisma.seoIndexingLog
      .findFirst({
        where: {
          url,
          action: opts.action,
          status: 'SUCESSO',
          createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
        },
        select: { id: true },
      })
      .catch(() => null)

    if (recente) {
      return {
        url,
        google: { ok: true, logId: recente.id, erro: 'IGNORADO (dedup)' },
        indexnow: { ok: true, logId: recente.id, erro: 'IGNORADO (dedup)' },
      }
    }
  }

  // Cria logs PENDENTE
  const [logGoogle, logIndexNow] = await Promise.all([
    criarLog(url, 'GOOGLE', opts.action, opts.origem),
    criarLog(url, 'INDEXNOW', opts.action, opts.origem),
  ])

  // Envia em paralelo
  const [respGoogle, respIndexNow] = await Promise.all([
    notifyGoogleIndexing(url, opts.action),
    notifyIndexNow([url]),
  ])

  // Atualiza logs com resultado
  await Promise.all([
    atualizarLog(logGoogle.id, respGoogle),
    atualizarLog(logIndexNow.id, respIndexNow),
  ])

  return {
    url,
    google: { ok: respGoogle.ok, logId: logGoogle.id, erro: respGoogle.error },
    indexnow: { ok: respIndexNow.ok, logId: logIndexNow.id, erro: respIndexNow.error },
  }
}

// ============================================================
// Helpers de log
// ============================================================

async function criarLog(
  url: string,
  provider: 'GOOGLE' | 'INDEXNOW',
  action: 'URL_UPDATED' | 'URL_DELETED',
  origem?: string
) {
  return prisma.seoIndexingLog.create({
    data: { url, provider, action, origem, status: 'PENDENTE' },
    select: { id: true, url: true },
  })
}

async function criarLogs(
  urls: string[],
  provider: 'GOOGLE' | 'INDEXNOW',
  action: 'URL_UPDATED' | 'URL_DELETED',
  origem?: string
) {
  return Promise.all(urls.map((url) => criarLog(url, provider, action, origem)))
}

async function atualizarLog(
  id: string,
  resp: { ok: boolean; error?: string }
) {
  return prisma.seoIndexingLog
    .update({
      where: { id },
      data: {
        status: resp.ok ? 'SUCESSO' : 'FALHA',
        erro: resp.error || null,
        enviadoEm: new Date(),
        tentativas: { increment: 1 },
      },
    })
    .catch(() => null)
}

async function atualizarLogsLote(
  logs: Array<{ id: string }>,
  resp: { ok: boolean; error?: string }
) {
  return prisma.seoIndexingLog
    .updateMany({
      where: { id: { in: logs.map((l) => l.id) } },
      data: {
        status: resp.ok ? 'SUCESSO' : 'FALHA',
        erro: resp.error || null,
        enviadoEm: new Date(),
        tentativas: { increment: 1 },
      },
    })
    .catch(() => null)
}

// ============================================================
// Utilitários públicos
// ============================================================

/**
 * Estatísticas para o admin: quantos envios nos últimos N dias, taxa de sucesso, etc.
 */
export async function estatisticasIndexacao(diasAtras = 7) {
  const desde = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)
  const grupos = await prisma.seoIndexingLog.groupBy({
    by: ['provider', 'status'],
    where: { createdAt: { gte: desde } },
    _count: true,
  })
  return grupos
}

/**
 * Reenvia URLs que falharam nas últimas 24h (retry manual).
 */
export async function reenviarFalhas(limite = 50) {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const falhas = await prisma.seoIndexingLog.findMany({
    where: { status: 'FALHA', createdAt: { gte: desde }, tentativas: { lt: 3 } },
    distinct: ['url'],
    select: { url: true, action: true },
    take: limite,
  })
  if (falhas.length === 0) return { reenviadas: 0 }

  const urls = falhas.map((f) => f.url)
  const resultado = await triggerIndexingBatch(urls, { origem: 'retry-manual' })
  return { reenviadas: resultado.enviadas, falhas: resultado.falhas }
}
