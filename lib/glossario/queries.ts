import { prisma } from '@/lib/prisma'
import slugify from 'slugify'
import { triggerIndexing } from '@/lib/seo/indexing'
import { SEO_CONFIG } from '@/lib/seo/config'

/**
 * Queries Prisma para o módulo Glossário.
 * Centraliza toda a lógica de banco em um único arquivo.
 */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function letrasDisponiveis() {
  return [...ALFABETO, '0-9']
}

export function extrairLetra(termo: string): string {
  const t = termo.trim().toUpperCase()
  const primeira = t.charAt(0)
  if (/[A-Z]/.test(primeira)) return primeira
  if (/[0-9]/.test(primeira)) return '0-9'
  // Remove acentos
  const sem = primeira.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return /[A-Z]/.test(sem) ? sem : '0-9'
}

export function gerarSlug(termo: string): string {
  return slugify(termo, { lower: true, strict: true, locale: 'pt' })
}

// ============================================================
// READ — listagens públicas
// ============================================================

export async function listarTermosPublicados() {
  return prisma.glossaryTerm.findMany({
    where: { publicado: true },
    select: {
      id: true,
      termo: true,
      slug: true,
      letra: true,
      resumo: true,
      categoria: true,
      updatedAt: true,
    },
    orderBy: [{ letra: 'asc' }, { termo: 'asc' }],
  })
}

export async function listarPorLetra() {
  const termos = await listarTermosPublicados()
  const porLetra: Record<string, typeof termos> = {}
  for (const letra of letrasDisponiveis()) porLetra[letra] = []
  for (const t of termos) {
    if (!porLetra[t.letra]) porLetra[t.letra] = []
    porLetra[t.letra].push(t)
  }
  return porLetra
}

export async function buscarTermoPorSlug(slug: string) {
  return prisma.glossaryTerm.findUnique({ where: { slug } })
}

export async function termosRelacionados(slug: string, categoria?: string | null, limit = 6) {
  return prisma.glossaryTerm.findMany({
    where: {
      publicado: true,
      slug: { not: slug },
      ...(categoria ? { categoria } : {}),
    },
    select: { termo: true, slug: true, resumo: true },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })
}

// ============================================================
// WRITE — admin
// ============================================================

export interface CriarTermoInput {
  termo: string
  conteudo: string
  resumo?: string
  imagem?: string
  categoria?: string
  autor?: string
  publicado?: boolean
  origem?: 'MANUAL' | 'AI_GEMINI' | 'AI_OPENAI' | 'CSV_IMPORT'
}

export async function criarTermo(input: CriarTermoInput) {
  const slug = gerarSlug(input.termo)
  const letra = extrairLetra(input.termo)
  return prisma.glossaryTerm.create({
    data: {
      termo: input.termo,
      slug,
      letra,
      conteudo: input.conteudo,
      resumo: input.resumo,
      imagem: input.imagem,
      categoria: input.categoria,
      autor: input.autor || 'Equipe Forza',
      origem: input.origem || 'MANUAL',
      publicado: input.publicado ?? false,
    },
  })
}

export async function atualizarTermo(id: string, data: Partial<CriarTermoInput>) {
  return prisma.glossaryTerm.update({
    where: { id },
    data: {
      ...data,
      ...(data.termo && {
        slug: gerarSlug(data.termo),
        letra: extrairLetra(data.termo),
      }),
    },
  })
}

export async function publicarTermo(id: string) {
  const termo = await prisma.glossaryTerm.update({
    where: { id },
    data: { publicado: true, revisado: true },
  })

  // 🚀 Notifica Google + Bing imediatamente após publicar
  triggerIndexing(`${SEO_CONFIG.siteUrl}/glossario/${termo.slug}`, {
    action: 'URL_UPDATED',
    origem: 'publicarTermo',
  })

  return termo
}

export async function deletarTermo(id: string) {
  const termo = await prisma.glossaryTerm.findUnique({ where: { id }, select: { slug: true, publicado: true } })
  const deletado = await prisma.glossaryTerm.delete({ where: { id } })

  // 🚀 Notifica Google de remoção se estava publicado
  if (termo?.publicado) {
    triggerIndexing(`${SEO_CONFIG.siteUrl}/glossario/${termo.slug}`, {
      action: 'URL_DELETED',
      origem: 'deletarTermo',
    })
  }

  return deletado
}

export async function incrementarViews(slug: string) {
  // Não-bloqueante — use fire-and-forget
  return prisma.glossaryTerm.update({
    where: { slug },
    data: { views: { increment: 1 } },
  }).catch(() => null)
}

// ============================================================
// JOBS — fila de geração via IA
// ============================================================

export async function listarJobsPendentes(limit = 10) {
  return prisma.glossaryJob.findMany({
    where: {
      status: 'PENDENTE',
      OR: [{ agendadoPara: null }, { agendadoPara: { lte: new Date() } }],
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
  })
}

export async function criarJobEmMassa(
  termos: Array<{ titulo: string; letra?: string }>,
  opcoes: {
    nicho: string
    provider?: 'AI_GEMINI' | 'AI_OPENAI'
    modelo: string
    idioma?: string
    estilo?: string
    maxTokens?: number
    promptExtra?: string
    /** Intervalo entre publicações: 'imediato' | 'diario' | 'semanal' */
    agendamento?: 'imediato' | 'diario' | 'semanal'
  }
) {
  const agora = new Date()
  const proximaData = new Date(agora)

  const dados = termos.map((t, idx) => {
    let agendadoPara: Date | null = null
    if (opcoes.agendamento === 'diario') {
      agendadoPara = new Date(agora.getTime() + idx * 24 * 60 * 60 * 1000)
    } else if (opcoes.agendamento === 'semanal') {
      agendadoPara = new Date(agora.getTime() + idx * 7 * 24 * 60 * 60 * 1000)
    }
    return {
      titulo: t.titulo,
      letra: t.letra || extrairLetra(t.titulo),
      nicho: opcoes.nicho,
      provider: opcoes.provider || 'AI_GEMINI',
      modelo: opcoes.modelo,
      idioma: opcoes.idioma || 'pt-BR',
      estilo: opcoes.estilo || 'informativo e técnico',
      maxTokens: opcoes.maxTokens || 2000,
      promptExtra: opcoes.promptExtra,
      agendadoPara,
    }
  })

  return prisma.glossaryJob.createMany({ data: dados, skipDuplicates: true })
}
