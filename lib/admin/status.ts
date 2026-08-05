/**
 * Vocabulário único de status do painel.
 *
 * Regra de leitura (a mesma em toda tela, para dar pra varrer a página só
 * pela cor, sem ler texto):
 *   danger  → travou / exige ação agora
 *   warning → em andamento, com a bola no nosso pé
 *   info    → em andamento, esperando terceiro (transportadora, cliente)
 *   success → concluído
 *   neutro  → encerrado sem desfecho (cancelado, perdido)
 */

export type TomStatus = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutro'

export type DefinicaoStatus = { label: string; tom: TomStatus }

/** Pedidos (enum OrderStatus) */
export const STATUS_PEDIDO: Record<string, DefinicaoStatus> = {
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando pagamento', tom: 'warning' },
  CONFIRMADO:           { label: 'Pago — separar',       tom: 'danger'  },
  SEPARANDO:            { label: 'Em separação',         tom: 'warning' },
  ENVIADO:              { label: 'Enviado',              tom: 'info'    },
  ENTREGUE:             { label: 'Entregue',             tom: 'success' },
  CANCELADO:            { label: 'Cancelado',            tom: 'neutro'  },
}

/** Agendamentos (campo string livre no schema) */
export const STATUS_AGENDAMENTO: Record<string, DefinicaoStatus> = {
  pendente:   { label: 'A confirmar', tom: 'danger'  },
  confirmado: { label: 'Confirmado',  tom: 'info'    },
  concluido:  { label: 'Concluído',   tom: 'success' },
  cancelado:  { label: 'Cancelado',   tom: 'neutro'  },
}

/** Funil de leads (enum LeadEtapa) */
export const STATUS_LEAD: Record<string, DefinicaoStatus> = {
  NOVO:       { label: 'Novo',       tom: 'danger'  },
  CONTATADO:  { label: 'Contatado',  tom: 'warning' },
  RESPONDEU:  { label: 'Respondeu',  tom: 'info'    },
  CONVERTIDO: { label: 'Convertido', tom: 'success' },
  PERDIDO:    { label: 'Perdido',    tom: 'neutro'  },
}

/** Fila de mensagens WhatsApp (enum MensagemStatus) */
export const STATUS_MENSAGEM: Record<string, DefinicaoStatus> = {
  PENDENTE:  { label: 'Na fila',   tom: 'warning' },
  ENVIANDO:  { label: 'Enviando',  tom: 'info'    },
  ENVIADA:   { label: 'Enviada',   tom: 'info'    },
  ENTREGUE:  { label: 'Entregue',  tom: 'success' },
  LIDA:      { label: 'Lida',      tom: 'success' },
  FALHA:     { label: 'Falhou',    tom: 'danger'  },
  CANCELADA: { label: 'Cancelada', tom: 'neutro'  },
}

/** Curadoria de catálogo (derivado dos flags do produto) */
export const STATUS_CURADORIA: Record<string, DefinicaoStatus> = {
  loja:      { label: 'Na loja',   tom: 'success' },
  oculto:    { label: 'Oculto',    tom: 'neutro'  },
  bloqueado: { label: 'Bloqueado', tom: 'danger'  },
}

const TODOS = {
  ...STATUS_PEDIDO,
  ...STATUS_AGENDAMENTO,
  ...STATUS_LEAD,
  ...STATUS_MENSAGEM,
  ...STATUS_CURADORIA,
}

/** Fallback seguro: status desconhecido vira rótulo legível em tom neutro. */
export function definicaoStatus(status: string): DefinicaoStatus {
  return (
    TODOS[status] ?? {
      label: status.replace(/_/g, ' ').toLowerCase(),
      tom: 'neutro' as const,
    }
  )
}
