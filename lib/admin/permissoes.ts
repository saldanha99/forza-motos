/**
 * Quem enxerga o quê dentro do painel.
 *
 * Duas camadas: o **papel** (ADMIN, MARKETING) dá um conjunto padrão de áreas,
 * e a **lista de permissões do usuário** sobrescreve esse padrão quando algum
 * administrador marca as caixas na tela de Usuários.
 *
 * Este arquivo é puro de propósito — sem Prisma, sem `next-auth` — porque o
 * `proxy.ts` roda no edge e precisa das mesmas regras. A checagem que vale
 * como segurança é a do servidor (`lib/admin/acesso.ts`), que relê o usuário
 * no banco; o proxy é só o primeiro portão.
 */

export type PapelUsuario = 'ADMIN' | 'MARKETING' | 'CUSTOMER'

export type ChaveArea =
  | 'dashboard'
  | 'pedidos'
  | 'agendamentos'
  | 'eventos'
  | 'evento-pirelli'
  | 'cupons'
  | 'crm'
  | 'clientes'
  | 'produtos'
  | 'motos'
  | 'pneus-segmentos'
  | 'curadoria'
  | 'fotos'
  | 'sincronizacao'
  | 'blog'
  | 'glossario'
  | 'seo'
  | 'marketing'
  | 'usuarios'
  | 'configuracoes'

export interface AreaAdmin {
  chave: ChaveArea
  label: string
  /** O que a pessoa passa a conseguir fazer — texto da tela de Usuários */
  descricao: string
  /** Prefixos de rota cobertos pela área: páginas do painel e APIs */
  rotas: string[]
  /**
   * Área que só ADMIN abre, e que nem aparece para marcar em outro papel.
   *
   * Hoje quase tudo está aqui: as APIs dessas áreas checam `role === 'ADMIN'`
   * cada uma no seu arquivo. Liberar a página sem liberar a API entregaria
   * uma tela que dá 403 em qualquer clique — pior do que não liberar. Para
   * tirar uma área daqui, troque o guarda da API dela por `exigirAcesso`.
   */
  somenteAdmin?: boolean
}

export const AREAS_ADMIN: AreaAdmin[] = [
  {
    chave: 'marketing',
    label: 'Marketing — imagens do site',
    descricao: 'Trocar as imagens de banners, categorias, serviços e fotos da loja.',
    rotas: ['/admin/marketing', '/api/admin/marketing', '/api/upload'],
  },
  {
    chave: 'blog',
    label: 'Blog',
    descricao: 'Escrever, editar e publicar posts do blog.',
    rotas: ['/admin/blog', '/api/blog'],
  },
  {
    chave: 'dashboard',
    label: 'Dashboard',
    descricao: 'Painel inicial com os números de venda.',
    rotas: ['/admin/dashboard'],
    somenteAdmin: true,
  },
  {
    chave: 'pedidos',
    label: 'Pedidos',
    descricao: 'Pedidos, status, etiquetas e notas fiscais.',
    rotas: ['/admin/pedidos', '/api/admin/pedidos', '/api/pedidos'],
    somenteAdmin: true,
  },
  {
    chave: 'agendamentos',
    label: 'Agendamentos',
    descricao: 'Agenda do box rápido e reservas.',
    rotas: ['/admin/agendamentos', '/api/admin/agendamentos', '/api/agendamentos', '/api/admin/reservas'],
    somenteAdmin: true,
  },
  {
    chave: 'eventos',
    label: 'Eventos',
    descricao: 'Passeios e inscrições.',
    rotas: ['/admin/eventos', '/api/admin/eventos'],
    somenteAdmin: true,
  },
  {
    chave: 'evento-pirelli',
    label: 'Evento Pirelli',
    descricao: 'Quiz, canecas, caixa e leads da campanha.',
    rotas: ['/admin/evento-pirelli', '/api/admin/evento-pirelli'],
    somenteAdmin: true,
  },
  {
    chave: 'cupons',
    label: 'Cupons',
    descricao: 'Criar e desativar cupons de desconto.',
    rotas: ['/admin/cupons', '/api/admin/cupons'],
    somenteAdmin: true,
  },
  {
    chave: 'crm',
    label: 'Funil de leads',
    descricao: 'Kanban de leads e disparos de WhatsApp.',
    rotas: ['/admin/crm', '/api/admin/crm', '/api/crm', '/api/admin/whatsapp', '/api/evolution'],
    somenteAdmin: true,
  },
  {
    chave: 'clientes',
    label: 'Clientes',
    descricao: 'Cadastro e histórico dos clientes.',
    rotas: ['/admin/clientes', '/api/clientes'],
    somenteAdmin: true,
  },
  {
    chave: 'produtos',
    label: 'Produtos',
    descricao: 'Catálogo, preços, estoque e classificação de pneu.',
    rotas: ['/admin/produtos', '/api/admin/produtos', '/api/produtos'],
    somenteAdmin: true,
  },
  {
    chave: 'motos',
    label: 'Motos',
    descricao: 'Modelos de moto e compatibilidade.',
    rotas: ['/admin/motos', '/api/admin/motos'],
    somenteAdmin: true,
  },
  {
    chave: 'pneus-segmentos',
    label: 'Categorias de pneu',
    descricao: 'Custom, Big Trail, Esportivo/Street, Scooter.',
    rotas: ['/admin/pneus-segmentos', '/api/admin/pneus-segmentos'],
    somenteAdmin: true,
  },
  {
    chave: 'curadoria',
    label: 'Curadoria',
    descricao: 'Decidir o que aparece na loja.',
    rotas: ['/admin/curadoria'],
    somenteAdmin: true,
  },
  {
    chave: 'fotos',
    label: 'Fotos de produto',
    descricao: 'Grade de fotos do catálogo.',
    rotas: ['/admin/fotos'],
    somenteAdmin: true,
  },
  {
    chave: 'sincronizacao',
    label: 'Sincronização',
    descricao: 'Saúde do robô que conversa com o Olist.',
    rotas: ['/admin/sincronizacao', '/admin/sync-categoria', '/api/admin/sync'],
    somenteAdmin: true,
  },
  {
    chave: 'glossario',
    label: 'Glossário',
    descricao: 'Termos do glossário e geração por IA (gasta crédito).',
    rotas: ['/admin/glossario', '/api/glossario'],
    somenteAdmin: true,
  },
  {
    chave: 'seo',
    label: 'SEO',
    descricao: 'Redirects, 404 e indexação.',
    rotas: ['/admin/seo', '/api/admin/seo', '/api/seo'],
    somenteAdmin: true,
  },
  {
    chave: 'usuarios',
    label: 'Usuários e acessos',
    descricao: 'Criar usuários do painel e definir o que cada um enxerga.',
    rotas: ['/admin/usuarios', '/api/admin/usuarios'],
    somenteAdmin: true,
  },
  {
    chave: 'configuracoes',
    label: 'Configurações',
    descricao: 'Ajustes gerais da loja.',
    rotas: ['/admin/configuracoes', '/api/admin/configuracoes'],
    somenteAdmin: true,
  },
]

/** Áreas que um administrador pode conceder a quem não é ADMIN. */
export const AREAS_CONCEDIVEIS = AREAS_ADMIN.filter((a) => !a.somenteAdmin)

const TODAS: ChaveArea[] = AREAS_ADMIN.map((a) => a.chave)

/** Conjunto de áreas que cada papel enxerga quando ninguém personalizou nada. */
export const PERMISSOES_PADRAO: Record<PapelUsuario, ChaveArea[]> = {
  ADMIN: TODAS,
  MARKETING: ['marketing'],
  CUSTOMER: [],
}

export function ehChaveArea(valor: unknown): valor is ChaveArea {
  return typeof valor === 'string' && (TODAS as string[]).includes(valor)
}

/**
 * O que o usuário enxerga de fato.
 *
 * ADMIN recebe tudo, sempre: ninguém consegue se trancar do lado de fora
 * removendo as próprias caixas. Para os demais, a lista salva manda; vazia,
 * vale o padrão do papel. Área `somenteAdmin` nunca passa.
 */
export function permissoesEfetivas(
  papel: string | null | undefined,
  permissoesSalvas?: unknown,
): ChaveArea[] {
  if (papel === 'ADMIN') return [...TODAS]
  // Quem não é do painel não enxerga nada, mesmo com lista salva no registro:
  // um CUSTOMER com permissão gravada por engano não pode virar meio-admin.
  if (papel !== 'MARKETING') return []

  const salvas = Array.isArray(permissoesSalvas) ? permissoesSalvas.filter(ehChaveArea) : []
  const base = salvas.length
    ? salvas
    : PERMISSOES_PADRAO[(papel as PapelUsuario) ?? 'CUSTOMER'] ?? []

  const concediveis = new Set(AREAS_CONCEDIVEIS.map((a) => a.chave))
  return [...new Set(base)].filter((chave) => concediveis.has(chave))
}

/**
 * Área dona de uma rota. Ganha o prefixo mais longo, para
 * `/api/admin/seo/redirects` não cair na área de outra `/api/admin/...`.
 */
export function areaDaRota(pathname: string): AreaAdmin | null {
  let escolhida: AreaAdmin | null = null
  let tamanho = -1

  for (const area of AREAS_ADMIN) {
    for (const rota of area.rotas) {
      if ((pathname === rota || pathname.startsWith(`${rota}/`)) && rota.length > tamanho) {
        escolhida = area
        tamanho = rota.length
      }
    }
  }
  return escolhida
}

/**
 * Fecha por padrão: rota do painel que nenhuma área reivindica só abre para
 * ADMIN. Assim, uma tela nova entra protegida mesmo que alguém esqueça de
 * cadastrá-la aqui.
 */
export function podeAcessarRota(permissoes: ChaveArea[], pathname: string): boolean {
  const area = areaDaRota(pathname)
  if (!area) return false
  return permissoes.includes(area.chave)
}

/** Para onde mandar a pessoa depois do login, respeitando o que ela enxerga. */
export function rotaInicial(permissoes: ChaveArea[]): string {
  if (permissoes.includes('dashboard')) return '/admin/dashboard'
  const primeira = AREAS_ADMIN.find((a) => permissoes.includes(a.chave))
  return primeira?.rotas[0] ?? '/login'
}
