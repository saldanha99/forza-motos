/**
 * Regras de frete — Forza Motos
 *
 * ┌────────────────────────────────────────────────────────┐
 * │  SP  +  pedido ≥ R$ 499  →  Frete Grátis              │
 * │  SP  +  pedido < R$ 499  →  PAC  R$ 19,90 / 5 dias    │
 * │  Outros estados           →  PAC  R$ 29,90 / 7 dias    │
 * │                               SEDEX R$ 49,90 / 3 dias  │
 * └────────────────────────────────────────────────────────┘
 *
 * Sem API externa — calculado localmente a partir do estado
 * e do subtotal do pedido.
 */

export interface OpcaoFrete {
  codigo: string
  servico: string
  valor: number
  prazo: number
  gratis?: boolean
}

const FRETE_GRATIS_MIN = 499          // R$ 499,00
const ESTADO_FRETE_GRATIS = 'SP'

export function calcularRegrasFrete(estado: string, subtotal: number): OpcaoFrete[] {
  const uf = estado.toUpperCase().trim()

  // ── SP com frete grátis ──────────────────────────────────
  if (uf === ESTADO_FRETE_GRATIS && subtotal >= FRETE_GRATIS_MIN) {
    return [
      {
        codigo:  'GRATIS',
        servico: '🎉 Frete Grátis',
        valor:   0,
        prazo:   7,
        gratis:  true,
      },
    ]
  }

  // ── SP abaixo do mínimo ──────────────────────────────────
  if (uf === ESTADO_FRETE_GRATIS) {
    return [
      {
        codigo:  'PAC_SP',
        servico: 'PAC — Correios',
        valor:   19.90,
        prazo:   5,
      },
      {
        codigo:  'SEDEX_SP',
        servico: 'SEDEX — Correios',
        valor:   34.90,
        prazo:   2,
      },
    ]
  }

  // ── Demais estados ───────────────────────────────────────
  return [
    {
      codigo:  'PAC',
      servico: 'PAC — Correios',
      valor:   29.90,
      prazo:   7,
    },
    {
      codigo:  'SEDEX',
      servico: 'SEDEX — Correios',
      valor:   49.90,
      prazo:   3,
    },
  ]
}

/** CEPs do estado de SP ocupam a faixa 01000-000 a 19999-999 */
export function cepEhSP(cep: string): boolean {
  const prefixo = Number(cep.replace(/\D/g, '').slice(0, 5))
  return prefixo >= 1000 && prefixo <= 19999
}

/**
 * Aplica a regra "frete grátis acima de R$499 para SP" sobre uma lista de
 * opções cotadas: zera a opção paga mais barata, mantendo as demais como
 * alternativas mais rápidas. Retorna a lista original se a regra não se aplica.
 */
export function aplicarFreteGratisSP<T extends { preco: number; nome: string }>(
  opcoes: T[],
  cepDestino: string,
  subtotal: number
): T[] {
  if (!cepEhSP(cepDestino) || subtotal < FRETE_GRATIS_MIN) return opcoes

  let idxMaisBarata = -1
  for (let i = 0; i < opcoes.length; i++) {
    if (opcoes[i].preco > 0 && (idxMaisBarata === -1 || opcoes[i].preco < opcoes[idxMaisBarata].preco)) {
      idxMaisBarata = i
    }
  }
  if (idxMaisBarata === -1) return opcoes

  return opcoes.map((op, i) =>
    i === idxMaisBarata ? { ...op, preco: 0, nome: `Frete Grátis — ${op.nome}` } : op
  )
}

/** Quanto falta para ganhar frete grátis (só para SP) */
export function faltaParaFreteGratis(estado: string, subtotal: number): number | null {
  const uf = estado.toUpperCase().trim()
  if (uf !== ESTADO_FRETE_GRATIS) return null
  const falta = FRETE_GRATIS_MIN - subtotal
  return falta > 0 ? falta : 0
}
