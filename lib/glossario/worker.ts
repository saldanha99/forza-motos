import { prisma } from '@/lib/prisma'
import { generateGlossaryTerm } from './ai-providers'
import { criarTermo, listarJobsPendentes } from './queries'
import { triggerIndexing } from '@/lib/seo/indexing'
import { SEO_CONFIG } from '@/lib/seo/config'

/**
 * Worker que processa jobs pendentes da tabela GlossaryJob.
 *
 * Chame em uma route handler protegida por CRON_SECRET:
 *
 *   // app/api/cron/glossario/route.ts
 *   import { processarJobsPendentes } from '@/lib/glossario/worker'
 *
 *   export async function GET(req: Request) {
 *     const auth = req.headers.get('authorization')
 *     if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
 *       return new Response('Unauthorized', { status: 401 })
 *     }
 *     const resultado = await processarJobsPendentes(5)
 *     return Response.json(resultado)
 *   }
 *
 * E configure no vercel.json:
 *
 *   "crons": [
 *     { "path": "/api/cron/glossario", "schedule": "0 * * * *" }
 *   ]
 */

export async function processarJobsPendentes(limite = 5) {
  const jobs = await listarJobsPendentes(limite)
  const resultados: Array<{ jobId: string; sucesso: boolean; erro?: string }> = []

  for (const job of jobs) {
    // Marca como processando para evitar duplicação
    await prisma.glossaryJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSANDO', tentativas: { increment: 1 } },
    })

    try {
      const provider = job.provider === 'AI_OPENAI' ? 'openai' : 'gemini'
      const gerado = await generateGlossaryTerm({
        termo: job.titulo,
        nicho: job.nicho,
        idioma: job.idioma,
        estilo: job.estilo,
        maxTokens: job.maxTokens,
        promptExtra: job.promptExtra || undefined,
        provider,
        modelo: job.modelo,
      })

      const termo = await criarTermo({
        termo: job.titulo,
        conteudo: gerado.conteudo,
        resumo: gerado.resumo,
        origem: job.provider,
        // Publicado automaticamente — defina como `false` se preferir revisar antes
        publicado: true,
      })

      await prisma.glossaryJob.update({
        where: { id: job.id },
        data: { status: 'CONCLUIDO', termoId: termo.id, erro: null },
      })

      // 🚀 Notifica Google + Bing IMEDIATAMENTE após publicar (fire-and-forget)
      // O cron diário em /api/seo/reindex-cron faz uma re-varredura de segurança.
      if (termo.publicado) {
        triggerIndexing(`${SEO_CONFIG.siteUrl}/glossario/${termo.slug}`, {
          action: 'URL_UPDATED',
          origem: 'glossario-worker',
        })
      }

      resultados.push({ jobId: job.id, sucesso: true })
    } catch (e: any) {
      const erro = String(e?.message || e)
      await prisma.glossaryJob.update({
        where: { id: job.id },
        data: {
          status: job.tentativas >= 2 ? 'ERRO' : 'PENDENTE',
          erro,
        },
      })
      resultados.push({ jobId: job.id, sucesso: false, erro })
    }
  }

  return { processados: resultados.length, resultados }
}
