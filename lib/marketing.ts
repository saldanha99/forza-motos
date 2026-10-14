/**
 * Módulo de marketing — todas as imagens do site, trocáveis pelo admin.
 *
 * Cada "slot" é um ponto fixo da loja que aceita troca de imagem em
 * /admin/marketing. A imagem enviada vai para o storage da VPS (/imagens)
 * e a URL fica em MarketingBanner.
 *
 * `fallback: null` é o normal: o slot começa VAZIO e a página desenha a arte
 * dela (gradiente da marca, ícone, faixa vermelha). As fotos de catálogo que
 * ocupavam esses lugares eram geradas por IA e saíram a pedido da loja — no
 * lugar delas entra foto de verdade, enviada pelo admin. Só sobra `fallback`
 * onde existe foto real da loja versionada no repositório.
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
  /**
   * Foto real versionada no repositório, usada enquanto o admin não envia
   * outra. `null` = sem imagem; a página desenha a própria arte.
   */
  fallback: string | null
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
    fallback: null,
  },
  {
    chave: 'home-slide-servicos',
    nome: 'Slide 2 — Serviços',
    grupo: GRUPO.carrossel,
    dica: 'Segunda tela da home. A arte recebe texto branco por cima, do lado esquerdo.',
    dimensao: '1920 × 960 px (2:1) · arte escura',
    proporcao: '2/1',
    fallback: null,
  },
  {
    chave: 'home-slide-entrega',
    nome: 'Slide 3 — Entrega',
    grupo: GRUPO.carrossel,
    dica: 'Terceira tela da home. A arte recebe texto branco por cima, do lado esquerdo.',
    dimensao: '1920 × 960 px (2:1) · arte escura',
    proporcao: '2/1',
    fallback: null,
  },

  // ── Home — atalhos de serviço sobre o carrossel ───────────────────────
  {
    chave: 'home-atalho-pneu',
    nome: 'Atalho — Pneu',
    grupo: GRUPO.atalhos,
    dica: 'Quadradinho sobre o carrossel. Aparece pequeno: use foto bem fechada.',
    dimensao: '600 × 600 px (1:1)',
    proporcao: '1/1',
    fallback: null,
  },
  {
    chave: 'home-atalho-freio',
    nome: 'Atalho — Freio',
    grupo: GRUPO.atalhos,
    dica: 'Quadradinho sobre o carrossel. Aparece pequeno: use foto bem fechada.',
    dimensao: '600 × 600 px (1:1)',
    proporcao: '1/1',
    fallback: null,
  },
  {
    chave: 'home-atalho-oleo',
    nome: 'Atalho — Óleo',
    grupo: GRUPO.atalhos,
    dica: 'Quadradinho sobre o carrossel. Aparece pequeno: use foto bem fechada.',
    dimensao: '600 × 600 px (1:1)',
    proporcao: '1/1',
    fallback: null,
  },
  {
    chave: 'home-atalho-transmissao',
    nome: 'Atalho — Transmissão',
    grupo: GRUPO.atalhos,
    dica: 'Quadradinho sobre o carrossel. Aparece pequeno: use foto bem fechada.',
    dimensao: '600 × 600 px (1:1)',
    proporcao: '1/1',
    fallback: null,
  },

  // ── Home — categorias populares ───────────────────────────────────────
  {
    chave: 'home-categoria-pneus',
    nome: 'Categoria — Pneus Premium',
    grupo: GRUPO.categorias,
    dica: 'Card vertical. O nome da categoria entra por cima, embaixo.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: null,
  },
  {
    chave: 'home-categoria-oleos',
    nome: 'Categoria — Óleos e Lubrificantes',
    grupo: GRUPO.categorias,
    dica: 'Card vertical. O nome da categoria entra por cima, embaixo.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: null,
  },
  {
    chave: 'home-categoria-freios',
    nome: 'Categoria — Freios e Segurança',
    grupo: GRUPO.categorias,
    dica: 'Card vertical. O nome da categoria entra por cima, embaixo.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: null,
  },
  {
    chave: 'home-categoria-transmissao',
    nome: 'Categoria — Kit Transmissão',
    grupo: GRUPO.categorias,
    dica: 'Card vertical. O nome da categoria entra por cima, embaixo.',
    dimensao: '900 × 1200 px (3:4) · retrato',
    proporcao: '3/4',
    fallback: null,
  },

  // ── Home — serviços com agendamento ───────────────────────────────────
  {
    chave: 'home-servico-pneu',
    nome: 'Serviço — Troca de Pneu',
    grupo: GRUPO.servicos,
    dica: 'Card quadrado do box rápido. Foto real da oficina funciona melhor que arte.',
    dimensao: '1000 × 1000 px (1:1)',
    proporcao: '1/1',
    fallback: null,
  },
  {
    chave: 'home-servico-freio',
    nome: 'Serviço — Pastilha de Freio',
    grupo: GRUPO.servicos,
    dica: 'Card quadrado do box rápido. Foto real da oficina funciona melhor que arte.',
    dimensao: '1000 × 1000 px (1:1)',
    proporcao: '1/1',
    fallback: null,
  },
  {
    chave: 'home-servico-oleo',
    nome: 'Serviço — Troca de Óleo',
    grupo: GRUPO.servicos,
    dica: 'Card quadrado do box rápido. Foto real da oficina funciona melhor que arte.',
    dimensao: '1000 × 1000 px (1:1)',
    proporcao: '1/1',
    fallback: null,
  },
  {
    chave: 'home-servico-transmissao',
    nome: 'Serviço — Kit Transmissão',
    grupo: GRUPO.servicos,
    dica: 'Card quadrado do box rápido. Foto real da oficina funciona melhor que arte.',
    dimensao: '1000 × 1000 px (1:1)',
    proporcao: '1/1',
    fallback: null,
  },

  // ── Home — chamada e fotos da loja ────────────────────────────────────
  {
    chave: 'home-cta-banner',
    nome: 'Faixa vermelha — "Peças originais"',
    grupo: GRUPO.loja,
    dica: 'Faixa larga no meio da home. Leva overlay vermelho forte por cima — a foto aparece só como textura.',
    dimensao: '1920 × 600 px (16:5)',
    proporcao: '16/5',
    fallback: null,
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
    fallback: null,
  },
  {
    chave: 'hero-servicos',
    nome: 'Topo da página de Serviços',
    grupo: GRUPO.internas,
    dica: 'Topo de /servicos. Recebe overlay vermelho por cima.',
    dimensao: '1800 × 700 px',
    proporcao: '18/7',
    fallback: null,
  },
  {
    chave: 'hero-oleos',
    nome: 'Topo da página de Óleos',
    grupo: GRUPO.internas,
    dica: 'Topo de /oleos.',
    dimensao: '1800 × 700 px',
    proporcao: '18/7',
    fallback: null,
  },
  {
    chave: 'hero-pastilhas',
    nome: 'Topo da página de Pastilhas',
    grupo: GRUPO.internas,
    dica: 'Topo de /pastilhas.',
    dimensao: '1800 × 700 px',
    proporcao: '18/7',
    fallback: null,
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

/**
 * Chave → URL. Slot sem imagem nenhuma simplesmente não aparece no mapa, e a
 * página desenha a própria arte no lugar — por isso `undefined` no tipo.
 */
export type BannerUrls = Record<string, string | undefined>

/**
 * URLs efetivas de todos os slots (imagem do admin ou foto padrão).
 * Nunca lança: com o banco fora (ou tabela ainda não migrada) devolve os padrões.
 */
export async function getBannerUrls(): Promise<BannerUrls> {
  const urls: BannerUrls = {}
  for (const slot of BANNER_SLOTS) {
    if (slot.fallback) urls[slot.chave] = slot.fallback
  }
  try {
    const rows = await prisma.marketingBanner.findMany({
      where: { imagemUrl: { not: null } },
      select: { chave: true, imagemUrl: true },
    })
    const conhecidas = new Set(BANNER_SLOTS.map((s) => s.chave))
    for (const row of rows) {
      if (row.imagemUrl && conhecidas.has(row.chave)) urls[row.chave] = row.imagemUrl
    }
  } catch (e) {
    console.warn('[marketing] usando banners padrão:', (e as Error)?.message)
  }
  return urls
}
