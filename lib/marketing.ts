/**
 * Módulo de marketing — todas as imagens do site, trocáveis pelo admin.
 *
 * Cada "slot" é um ponto fixo da loja que aceita troca de imagem em
 * /admin/marketing. A imagem enviada vai para o storage da VPS (/imagens)
 * e a URL fica em MarketingBanner. Sem registro (ou imagemUrl null),
 * o site usa a imagem padrão versionada em /public.
 *
 * Ao acrescentar um slot aqui, lembre de consumir `banners['<chave>']` na
 * página correspondente — senão ele aparece no admin sem efeito nenhum.
 */
import { prisma } from '@/lib/prisma'

export interface BannerSlot {
  chave: string
  nome: string
  /** Agrupa os slots na tela do admin */
  grupo: string
  /** Onde a imagem aparece na loja */
  dica: string
  /** Tamanho recomendado, em destaque no admin */
  dimensao: string
  /** aspect-ratio do preview no admin — igual ao recorte que o site faz */
  proporcao: string
  /** Imagem padrão versionada no repositório */
  fallback: string
}

const GRUPO = {
  carrossel: 'Home — Carrossel principal',
  atalhos: 'Home — Atalhos de serviço (sobre o carrossel)',
  categorias: 'Home — Categorias populares',
  servicos: 'Home — Serviços com agendamento',
  loja: 'Home — Chamada e fotos da loja',
  internas: 'Páginas internas',
} as const

export const BANNER_SLOTS: BannerSlot[] = [
  // ── Home — carrossel ──────────────────────────────────────────────────
  {
    chave: 'home-slide-pneus',
    nome: 'Slide 1 — Pneus',
    grupo: GRUPO.carrossel,
    dica: 'Primeira tela da home. A arte recebe texto branco por cima, do lado esquerdo.',
    dimensao: '1920 × 960 px (2:1) · arte escura',
    proporcao: '2/1',
    fallback: '/images/hero/slide-pneus.jpg',
  },
  {
    chave: 'home-slide-servicos',
    nome: 'Slide 2 — Serviços',
    grupo: GRUPO.carrossel,
    dica: 'Segunda tela da home. A arte recebe texto branco por cima, do lado esquerdo.',
    dimensao: '1920 × 960 px (2:1) · arte escura',
    proporcao: '2/1',
    fallback: '/images/hero/slide-servicos.jpg',
  },
  {
    chave: 'home-slide-entrega',
    nome: 'Slide 3 — Entrega',
    grupo: GRUPO.carrossel,
    dica: 'Terceira tela da home. A arte recebe texto branco por cima, do lado esquerdo.',
    dimensao: '1920 × 960 px (2:1) · arte escura',
    proporcao: '2/1',
    fallback: '/images/hero/slide-entrega.jpg',
  },

  // ── Home — atalhos de serviço sobre o carrossel ───────────────────────
  {
    chave: 'home-atalho-pneu',
    nome: 'Atalho — Pneu',
    grupo: GRUPO.atalhos,
    dica: 'Quadradinho sobre o carrossel. Aparece pequeno: use foto bem fechada.',
    dimensao: '600 × 600 px (1:1)',
    proporcao: '1/1',
    fallback: '/images/services/card-pneu.jpg',
  },
  {
    chave: 'home-atalho-freio',
    nome: 'Atalho — Freio',
    grupo: GRUPO.atalhos,
    dica: 'Quadradinho sobre o carrossel. Aparece pequeno: use foto bem fechada.',
    dimensao: '600 × 600 px (1:1)',
    proporcao: '1/1',
    fallback: '/images/services/card-freio.jpg',
  },
  {
    chave: 'home-atalho-oleo',
    nome: 'Atalho — Óleo',
    grupo: GRUPO.atalhos,
    dica: 'Quadradinho sobre o carrossel. Aparece pequeno: use foto bem fechada.',
    dimensao: '600 × 600 px (1:1)',
    proporcao: '1/1',
    fallback: '/images/services/card-oleo.jpg',
  },
  {
    chave: 'home-atalho-transmissao',
    nome: 'Atalho — Transmissão',
    grupo: GRUPO.atalhos,
    dica: 'Quadradinho sobre o carrossel. Aparece pequeno: use foto bem fechada.',
    dimensao: '600 × 600 px (1:1)',
    proporcao: '1/1',
    fallback: '/images/services/card-corrente.jpg',
  },

  // ── Home — categorias populares ───────────────────────────────────────
  {
    chave: 'home-categoria-pneus',
    nome: 'Categoria — Pneus Premium',
    grupo: GRUPO.categorias,
    dica: 'Card vertical. O nome da categoria entra por cima, embaixo.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: '/images/categories/pneus.jpg',
  },
  {
    chave: 'home-categoria-oleos',
    nome: 'Categoria — Óleos e Lubrificantes',
    grupo: GRUPO.categorias,
    dica: 'Card vertical. O nome da categoria entra por cima, embaixo.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: '/images/categories/oleos.jpg',
  },
  {
    chave: 'home-categoria-freios',
    nome: 'Categoria — Freios e Segurança',
    grupo: GRUPO.categorias,
    dica: 'Card vertical. O nome da categoria entra por cima, embaixo.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: '/images/categories/freios.jpg',
  },
  {
    chave: 'home-categoria-transmissao',
    nome: 'Categoria — Kit Transmissão',
    grupo: GRUPO.categorias,
    dica: 'Card vertical. O nome da categoria entra por cima, embaixo.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: '/images/categories/transmissao.jpg',
  },

  // ── Home — serviços com agendamento ───────────────────────────────────
  {
    chave: 'home-servico-pneu',
    nome: 'Serviço — Troca de Pneu',
    grupo: GRUPO.servicos,
    dica: 'Card quadrado do box rápido. Foto real da oficina funciona melhor que arte.',
    dimensao: '1000 × 1000 px (1:1)',
    proporcao: '1/1',
    fallback: '/images/loja-servico-1.jpg',
  },
  {
    chave: 'home-servico-freio',
    nome: 'Serviço — Pastilha de Freio',
    grupo: GRUPO.servicos,
    dica: 'Card quadrado do box rápido. Foto real da oficina funciona melhor que arte.',
    dimensao: '1000 × 1000 px (1:1)',
    proporcao: '1/1',
    fallback: '/images/services/freio.jpg',
  },
  {
    chave: 'home-servico-oleo',
    nome: 'Serviço — Troca de Óleo',
    grupo: GRUPO.servicos,
    dica: 'Card quadrado do box rápido. Foto real da oficina funciona melhor que arte.',
    dimensao: '1000 × 1000 px (1:1)',
    proporcao: '1/1',
    fallback: '/images/services/oleo.jpg',
  },
  {
    chave: 'home-servico-transmissao',
    nome: 'Serviço — Kit Transmissão',
    grupo: GRUPO.servicos,
    dica: 'Card quadrado do box rápido. Foto real da oficina funciona melhor que arte.',
    dimensao: '1000 × 1000 px (1:1)',
    proporcao: '1/1',
    fallback: '/images/services/transmissao.jpg',
  },

  // ── Home — chamada e fotos da loja ────────────────────────────────────
  {
    chave: 'home-cta-banner',
    nome: 'Faixa vermelha — "Peças originais"',
    grupo: GRUPO.loja,
    dica: 'Faixa larga no meio da home. Leva overlay vermelho forte por cima — a foto aparece só como textura.',
    dimensao: '1920 × 600 px (16:5)',
    proporcao: '16/5',
    fallback: '/images/cta-banner.jpg',
  },
  {
    chave: 'home-loja-fachada',
    nome: 'Nossa loja — Fachada',
    grupo: GRUPO.loja,
    dica: 'Primeira das 3 fotos de "Nossa loja em ação". Foto de celular na vertical serve.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: '/images/loja-fachada.jpg',
  },
  {
    chave: 'home-loja-box',
    nome: 'Nossa loja — Box rápido',
    grupo: GRUPO.loja,
    dica: 'Segunda das 3 fotos de "Nossa loja em ação". Foto de celular na vertical serve.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: '/images/loja-servico-1.jpg',
  },
  {
    chave: 'home-loja-equipe',
    nome: 'Nossa loja — Equipe',
    grupo: GRUPO.loja,
    dica: 'Terceira das 3 fotos de "Nossa loja em ação". Foto de celular na vertical serve.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: '/images/loja-servico-2.jpg',
  },

  // ── Páginas internas ──────────────────────────────────────────────────
  {
    chave: 'hero-pneus',
    nome: 'Topo da página de Pneus',
    grupo: GRUPO.internas,
    dica: 'Topo de /pneus. O texto branco fica à esquerda.',
    dimensao: '1800 × 880 px · arte escura',
    proporcao: '2/1',
    fallback: '/images/hero/hero-pneus-bg.jpg',
  },
  {
    chave: 'hero-servicos',
    nome: 'Topo da página de Serviços',
    grupo: GRUPO.internas,
    dica: 'Topo de /servicos. Recebe overlay vermelho por cima.',
    dimensao: '1800 × 700 px',
    proporcao: '18/7',
    fallback: '/images/hero/hero-servicos.jpg',
  },
  {
    chave: 'hero-oleos',
    nome: 'Topo da página de Óleos',
    grupo: GRUPO.internas,
    dica: 'Topo de /oleos.',
    dimensao: '1800 × 700 px',
    proporcao: '18/7',
    fallback: '/images/hero/hero-oleos.jpg',
  },
  {
    chave: 'hero-pastilhas',
    nome: 'Topo da página de Pastilhas',
    grupo: GRUPO.internas,
    dica: 'Topo de /pastilhas.',
    dimensao: '1800 × 700 px',
    proporcao: '18/7',
    fallback: '/images/hero/hero-pastilhas.jpg',
  },
]

/** Ordem dos grupos na tela do admin. */
export const GRUPOS_BANNER: string[] = [
  GRUPO.carrossel,
  GRUPO.atalhos,
  GRUPO.categorias,
  GRUPO.servicos,
  GRUPO.loja,
  GRUPO.internas,
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
