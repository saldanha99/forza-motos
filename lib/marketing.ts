/**
 * Módulo de marketing — banners/heros do site gerenciáveis pelo admin.
 *
 * Cada "slot" é um ponto fixo do site que aceita troca de imagem em
 * /admin/marketing. A imagem enviada vai para o storage da VPS (/imagens)
 * e a URL fica em MarketingBanner. Sem registro (ou imagemUrl null),
 * o site usa a imagem padrão versionada em /public.
 */
import { prisma } from '@/lib/prisma'

export interface BannerSlot {
  chave: string
  nome: string
  /** Onde aparece + dica de dimensão para o marketing */
  dica: string
  /** Imagem padrão versionada no repositório */
  fallback: string
}

export const BANNER_SLOTS: BannerSlot[] = [
  {
    chave: 'hero-pneus',
    nome: 'Hero — Página de Pneus',
    dica: 'Topo de /pneus · ideal 1800×880px · arte escura (texto branco fica à esquerda)',
    fallback: '/images/hero/hero-pneus-bg.jpg',
  },
  {
    chave: 'home-slide-pneus',
    nome: 'Home — Slide 1 (Pneus)',
    dica: 'Carrossel da home · ideal 1920×960px · escura (recebe overlay de texto)',
    fallback: '/images/hero/slide-pneus.jpg',
  },
  {
    chave: 'home-slide-servicos',
    nome: 'Home — Slide 2 (Serviços)',
    dica: 'Carrossel da home · ideal 1920×960px · escura (recebe overlay de texto)',
    fallback: '/images/hero/slide-servicos.jpg',
  },
  {
    chave: 'home-slide-entrega',
    nome: 'Home — Slide 3 (Entrega)',
    dica: 'Carrossel da home · ideal 1920×960px · escura (recebe overlay de texto)',
    fallback: '/images/hero/slide-entrega.jpg',
  },
  {
    chave: 'hero-servicos',
    nome: 'Hero — Página de Serviços',
    dica: 'Topo de /servicos · ideal 1800×700px (recebe overlay vermelho)',
    fallback: '/images/hero/hero-servicos.jpg',
  },
  {
    chave: 'hero-oleos',
    nome: 'Hero — Página de Óleos',
    dica: 'Topo de /oleos · ideal 1800×700px',
    fallback: '/images/hero/hero-oleos.jpg',
  },
  {
    chave: 'hero-pastilhas',
    nome: 'Hero — Página de Pastilhas',
    dica: 'Topo de /pastilhas · ideal 1800×700px',
    fallback: '/images/hero/hero-pastilhas.jpg',
  },
]

export type BannerUrls = Record<string, string>

/**
 * URLs efetivas de todos os slots (imagem do admin ou fallback).
 * Nunca lança: com o banco fora (ou tabela ainda não migrada) devolve os padrões.
 */
export async function getBannerUrls(): Promise<BannerUrls> {
  const urls: BannerUrls = {}
  for (const slot of BANNER_SLOTS) urls[slot.chave] = slot.fallback
  try {
    const rows = await prisma.marketingBanner.findMany({
      where: { imagemUrl: { not: null } },
      select: { chave: true, imagemUrl: true },
    })
    for (const row of rows) {
      if (row.imagemUrl && urls[row.chave] !== undefined) urls[row.chave] = row.imagemUrl
    }
  } catch (e) {
    console.warn('[marketing] usando banners padrão:', (e as Error)?.message)
  }
  return urls
}
