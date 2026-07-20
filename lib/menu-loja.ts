/**
 * Estrutura do mega menu da loja (reunião de 20/07/2026):
 * pneus navegam por MARCA → MODELO DE PNEU (Angel GT, Anakee Adventure…),
 * não por estilo de pilotagem (custom/offroad) nem por modelo de moto.
 * Serviços entram no menu com link direto para o agendamento.
 */

export interface MarcaPneus {
  marca: string
  /** Link "ver tudo da marca" — filtro real no banco */
  href: string
  /** Modelos de pneu da marca; cada um vira uma busca no catálogo */
  modelos: { nome: string; busca: string }[]
}

export const MARCAS_PNEUS: MarcaPneus[] = [
  {
    marca: 'Pirelli',
    href: '/produtos?categoria=Pneus&marca=Pirelli',
    modelos: [
      { nome: 'Angel GT', busca: 'Angel GT' },
      { nome: 'Angel ST', busca: 'Angel ST' },
      { nome: 'Angel City', busca: 'Angel City' },
      { nome: 'Diablo Rosso', busca: 'Diablo Rosso' },
      { nome: 'Scorpion Trail', busca: 'Scorpion Trail' },
      { nome: 'Scorpion Rally', busca: 'Scorpion Rally' },
      { nome: 'Super City', busca: 'Super City' },
      { nome: 'Phantom', busca: 'Phantom' },
    ],
  },
  {
    marca: 'Metzeler',
    href: '/produtos?categoria=Pneus&marca=Metzeler',
    modelos: [
      { nome: 'Tourance', busca: 'Tourance' },
      { nome: 'Roadtec', busca: 'Roadtec' },
      { nome: 'Sportec', busca: 'Sportec' },
      { nome: 'Karoo', busca: 'Karoo' },
      { nome: 'ME 888', busca: 'ME 888' },
    ],
  },
  {
    marca: 'Michelin',
    href: '/produtos?categoria=Pneus&marca=Michelin',
    modelos: [
      { nome: 'Anakee Adventure', busca: 'Anakee Adventure' },
      { nome: 'Anakee Wild', busca: 'Anakee Wild' },
      { nome: 'Road 6', busca: 'Road 6' },
      { nome: 'Pilot Street', busca: 'Pilot Street' },
      { nome: 'City Pro', busca: 'City Pro' },
      { nome: 'Commander', busca: 'Commander' },
    ],
  },
]

export interface SubmenuItem {
  label: string
  href: string
  /** Destaque visual (ex.: buscas especiais de pneus) */
  destaque?: boolean
}

export interface SubmenuCategoria {
  titulo: string
  itens: SubmenuItem[]
}

/** Submenus simples por categoria do menu principal (id → colunas) */
export const SUBMENUS: Record<string, SubmenuCategoria[]> = {
  oleo: [
    {
      titulo: 'Por marca',
      itens: [
        { label: 'Motul', href: '/produtos?categoria=Lubrificantes&marca=Motul' },
        { label: 'Castrol', href: '/produtos?categoria=Lubrificantes&marca=Castrol' },
        { label: 'Mobil', href: '/produtos?categoria=Lubrificantes&marca=Mobil' },
        { label: 'Todos os óleos', href: '/oleos' },
      ],
    },
  ],
  freios: [
    {
      titulo: 'Freios',
      itens: [
        { label: 'Pastilhas de freio', href: '/pastilhas' },
        { label: 'Discos de freio', href: '/produtos?busca=disco+de+freio' },
        { label: 'Fluido de freio', href: '/produtos?busca=fluido+de+freio' },
        { label: 'Agendar troca de pastilha', href: '/agendar', destaque: true },
      ],
    },
  ],
  correntes: [
    {
      titulo: 'Kit Transmissão',
      itens: [
        { label: 'Kits completos', href: '/produtos?categoria=Transmissão' },
        { label: 'DID', href: '/produtos?marca=DID' },
        { label: 'Correntes', href: '/produtos?busca=corrente' },
        { label: 'Agendar troca do kit', href: '/agendar', destaque: true },
      ],
    },
  ],
  suspensao: [
    {
      titulo: 'Box rápido — agende online',
      itens: [
        { label: 'Troca de Pneu (30 min)', href: '/agendar' },
        { label: 'Troca de Óleo (30 min)', href: '/agendar' },
        { label: 'Pastilhas de Freio (30 min)', href: '/agendar' },
        { label: 'Kit de Transmissão (1h)', href: '/agendar' },
        { label: 'Manutenção Preventiva', href: '/agendar' },
      ],
    },
    {
      titulo: 'Informações',
      itens: [
        { label: 'Todos os serviços', href: '/servicos' },
        { label: 'Agendar horário', href: '/agendar', destaque: true },
      ],
    },
  ],
}
