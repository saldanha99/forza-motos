import {
  BookOpen, Bike, Calendar, FileText, ImagePlus, LayoutDashboard, ListChecks,
  Megaphone, MessageCircle, Package, PartyPopper, RefreshCw, Search, Settings, ShoppingBag,
  Ticket, TicketPercent, Users, type LucideIcon,
} from 'lucide-react'

/** Chave do contador que a sidebar mostra ao lado do item. */
export type ChaveBadge = 'pedidos' | 'agendamentos' | 'leads' | 'curadoria'

export type ItemNav = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  badge?: ChaveBadge
  /** Badge vermelho = exige ação; sem isso é só contagem informativa. */
  urgente?: boolean
}

export type GrupoNav = { titulo: string | null; itens: ItemNav[] }

export const GRUPOS_NAV: GrupoNav[] = [
  {
    titulo: null,
    itens: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    titulo: 'Vendas',
    itens: [
      { href: '/admin/pedidos',      label: 'Pedidos',      icon: ShoppingBag,    badge: 'pedidos', urgente: true },
      { href: '/admin/agendamentos', label: 'Agendamentos', icon: Calendar,       badge: 'agendamentos', urgente: true },
      { href: '/admin/eventos',      label: 'Eventos',      icon: Ticket },
      { href: '/admin/evento-pirelli', label: 'Evento Pirelli', icon: PartyPopper },
      { href: '/admin/cupons',       label: 'Cupons',       icon: TicketPercent },
    ],
  },
  {
    titulo: 'Catálogo',
    itens: [
      { href: '/admin/produtos',      label: 'Produtos',      icon: Package },
      { href: '/admin/motos',         label: 'Motos',         icon: Bike },
      { href: '/admin/curadoria',     label: 'Curadoria',     icon: ListChecks, badge: 'curadoria' },
      { href: '/admin/fotos',         label: 'Fotos',         icon: ImagePlus },
      { href: '/admin/sincronizacao', label: 'Sincronização', icon: RefreshCw },
    ],
  },
  {
    titulo: 'Clientes',
    itens: [
      { href: '/admin/crm',      label: 'Funil de leads', icon: MessageCircle, badge: 'leads', urgente: true },
      { href: '/admin/clientes', label: 'Clientes',       icon: Users },
    ],
  },
  {
    titulo: 'Conteúdo & SEO',
    itens: [
      { href: '/admin/blog',      label: 'Blog / CMS', icon: FileText },
      { href: '/admin/glossario', label: 'Glossário',  icon: BookOpen },
      { href: '/admin/seo',       label: 'SEO',        icon: Search },
      { href: '/admin/marketing', label: 'Marketing',  icon: Megaphone },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [{ href: '/admin/configuracoes', label: 'Configurações', icon: Settings }],
  },
]

export const ITENS_NAV = GRUPOS_NAV.flatMap((g) => g.itens)

/** Barra inferior do mobile — 5 destinos mais usados no dia a dia. */
export const NAV_MOBILE = ['/admin/dashboard', '/admin/pedidos', '/admin/agendamentos', '/admin/crm', '/admin/produtos']
  .map((href) => ITENS_NAV.find((i) => i.href === href)!)

/**
 * Título + subtítulo de cada rota.
 *
 * O subtítulo é sempre uma frase de operação — o que se faz aqui —, não uma
 * descrição genérica. É a documentação inline do painel.
 */
export const TITULOS: Record<string, { titulo: string; subtitulo: string }> = {
  '/admin/dashboard':     { titulo: 'Dashboard',      subtitulo: 'O que precisa de você agora e como o dia está indo' },
  '/admin/pedidos':       { titulo: 'Pedidos',        subtitulo: 'Da confirmação do pagamento até a entrega — arraste o card para mudar a etapa' },
  '/admin/agendamentos':  { titulo: 'Agendamentos',   subtitulo: 'Serviços do box rápido: confirmar, executar e concluir' },
  '/admin/eventos':       { titulo: 'Eventos',        subtitulo: 'Encontros e passeios com venda de ingresso' },
  '/admin/evento-pirelli': { titulo: 'Evento Pirelli',  subtitulo: 'Ação presencial: cadastro de visitante, quiz, brinde de caneca e fotos' },
  '/admin/cupons':        { titulo: 'Cupons',         subtitulo: 'Descontos ativos e regras de uso na loja' },
  '/admin/produtos':      { titulo: 'Produtos',       subtitulo: 'Catálogo sincronizado com o Olist' },
  '/admin/motos':         { titulo: 'Motos',          subtitulo: 'Modelos e as medidas de fábrica usadas na busca por placa' },
  '/admin/curadoria':     { titulo: 'Curadoria',      subtitulo: 'Decide o que aparece na loja — arraste entre na loja e oculto' },
  '/admin/fotos':         { titulo: 'Fotos',          subtitulo: 'Imagens dos produtos vindas do ERP e enviadas à mão' },
  '/admin/sincronizacao': { titulo: 'Sincronização',  subtitulo: 'Estado das cargas de produto, estoque e imagem vindas do Olist' },
  '/admin/crm':           { titulo: 'Funil de leads', subtitulo: 'Quem chegou pelo WhatsApp — arraste o card conforme o contato evolui' },
  '/admin/clientes':      { titulo: 'Clientes',       subtitulo: 'Base única de compradores da loja, do ML e do box' },
  '/admin/blog':          { titulo: 'Blog',           subtitulo: 'Conteúdo editorial publicado no site' },
  '/admin/glossario':     { titulo: 'Glossário',      subtitulo: 'Termos técnicos gerados por IA para captar busca orgânica' },
  '/admin/seo':           { titulo: 'SEO',            subtitulo: 'Indexação, redirects e páginas com erro 404' },
  '/admin/marketing':     { titulo: 'Marketing',      subtitulo: 'Banners e campanhas exibidos na loja' },
  '/admin/configuracoes': { titulo: 'Configurações',  subtitulo: 'Integrações, chaves e ajustes gerais do sistema' },
}

export function tituloDaRota(pathname: string) {
  if (TITULOS[pathname]) return TITULOS[pathname]
  // Sub-rotas (/admin/pedidos/123) herdam o título do módulo
  const base = Object.keys(TITULOS)
    .filter((r) => pathname.startsWith(r + '/'))
    .sort((a, b) => b.length - a.length)[0]
  return base ? TITULOS[base] : { titulo: 'Painel', subtitulo: '' }
}
