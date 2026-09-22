export type CanalListagemEventoPirelli = 'home' | 'eventos'

type EventoPirelliPublicavel = {
  id: string
  titulo: string
  descricao: string | null
  dataInicio: Date | null
  dataFim: Date | null
  local: string | null
  ativo: boolean
  publicado: boolean
  exibirNaHome: boolean
  exibirEmEventos: boolean
}

export type EventoPirelliListagem = {
  id: string
  titulo: string
  descricao: string
  dataInicio: Date
  dataFim: Date | null
  local: string
  imagemUrl: string
  preco: number
  etiquetaPreco: string
  categoria: string
  vagas: null
  destaque: boolean
  href: string
}

const IMAGEM_EVENTO_PIRELLI = '/images/evento-pirelli/rodeo-hero.webp'

/**
 * Converte a campanha independente da Pirelli para o formato usado pelas
 * vitrines públicas. A data é obrigatória porque ambas ordenam por evento.
 */
export function eventoPirelliParaListagem(
  evento: EventoPirelliPublicavel | null,
  canal: CanalListagemEventoPirelli,
  agora = new Date(),
): EventoPirelliListagem | null {
  if (!evento || !evento.ativo || !evento.publicado || !evento.dataInicio) return null

  const canalHabilitado = canal === 'home'
    ? evento.exibirNaHome
    : evento.exibirEmEventos
  if (!canalHabilitado) return null

  // A home anuncia eventos futuros ou ainda em andamento. O calendário mantém
  // também os eventos passados, como já faz com os eventos comuns.
  if (canal === 'home' && (evento.dataFim ?? evento.dataInicio) < agora) return null

  return {
    id: `pirelli-${evento.id}`,
    titulo: evento.titulo,
    descricao: evento.descricao ?? 'Experiência Pirelli + Forza Motos com atrações e condições especiais.',
    dataInicio: evento.dataInicio,
    dataFim: evento.dataFim,
    local: evento.local ?? 'Local a confirmar',
    imagemUrl: IMAGEM_EVENTO_PIRELLI,
    preco: 0,
    etiquetaPreco: 'Ação especial',
    categoria: 'Evento Pirelli',
    vagas: null,
    destaque: true,
    href: '/evento-pirelli',
  }
}
