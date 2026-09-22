/**
 * Sugestão de classificação de pneu a partir do nome do produto.
 *
 * O nome que vem do ERP carrega a linha do pneu ("PNEU PIRELLI SCORPION RALLY
 * STR 150/70R17 69V"), e a linha diz o uso da moto. Isto é um palpite para o
 * operador confirmar com um clique — nunca grava sozinho: quem decide o que é
 * Custom ou Big Trail é a loja, e há linha que vive na fronteira (sport-touring
 * como Angel GT atende tanto esportiva quanto estradeira).
 *
 * Para ensinar uma linha nova, acrescente uma regra: `termo` é o que se procura
 * no nome, `linha` é o rótulo que vai para o produto e `segmento` é o slug da
 * categoria.
 */

export interface RegraLinha {
  /** Trecho procurado no nome, já sem acento e em minúsculas */
  termo: string
  /** Rótulo da linha — vira a subcategoria em /pneus */
  linha: string
  /** Slug do segmento sugerido */
  segmento: 'custom' | 'big-trail' | 'esportivo-street' | 'scooter'
}

/**
 * A ordem aqui não importa: vence sempre o termo mais longo que casar, para
 * "diablo rosso iv corsa" não ser capturado por "diablo rosso".
 */
export const REGRAS_LINHA: RegraLinha[] = [
  // ── Big trail / adventure ───────────────────────────────────────────
  { termo: 'scorpion rally str', linha: 'Scorpion Rally STR', segmento: 'big-trail' },
  { termo: 'scorpion rally', linha: 'Scorpion Rally', segmento: 'big-trail' },
  { termo: 'scorpion trail ii', linha: 'Scorpion Trail II', segmento: 'big-trail' },
  { termo: 'scorpion trail', linha: 'Scorpion Trail', segmento: 'big-trail' },
  { termo: 'tourance next ii', linha: 'Tourance Next II', segmento: 'big-trail' },
  { termo: 'tourance next', linha: 'Tourance Next', segmento: 'big-trail' },
  { termo: 'tourance', linha: 'Tourance', segmento: 'big-trail' },
  { termo: 'anakee adventure', linha: 'Anakee Adventure', segmento: 'big-trail' },
  { termo: 'anakee road', linha: 'Anakee Road', segmento: 'big-trail' },
  { termo: 'anakee', linha: 'Anakee', segmento: 'big-trail' },
  { termo: 'trailmax mixtour', linha: 'Trailmax Mixtour', segmento: 'big-trail' },
  { termo: 'trailmax', linha: 'Trailmax', segmento: 'big-trail' },
  { termo: 'enduro trail', linha: 'Enduro Trail+ E-07+', segmento: 'big-trail' },
  { termo: 'e-07', linha: 'Enduro Trail+ E-07+', segmento: 'big-trail' },
  { termo: 'karoo', linha: 'Karoo', segmento: 'big-trail' },
  { termo: 'tkc', linha: 'TKC', segmento: 'big-trail' },

  // ── Esportivo / street ──────────────────────────────────────────────
  { termo: 'diablo rosso iv corsa', linha: 'Diablo Rosso IV Corsa', segmento: 'esportivo-street' },
  { termo: 'diablo rosso iv', linha: 'Diablo Rosso IV', segmento: 'esportivo-street' },
  { termo: 'diablo rosso iii', linha: 'Diablo Rosso III', segmento: 'esportivo-street' },
  { termo: 'diablo rosso ii', linha: 'Diablo Rosso II', segmento: 'esportivo-street' },
  { termo: 'diablo rosso', linha: 'Diablo Rosso', segmento: 'esportivo-street' },
  { termo: 'rosso iii', linha: 'Diablo Rosso III', segmento: 'esportivo-street' },
  { termo: 'rosso ii', linha: 'Diablo Rosso II', segmento: 'esportivo-street' },
  { termo: 'supercorsa', linha: 'Diablo Supercorsa', segmento: 'esportivo-street' },
  { termo: 'angel gt ii', linha: 'Angel GT II', segmento: 'esportivo-street' },
  { termo: 'angel gt', linha: 'Angel GT', segmento: 'esportivo-street' },
  { termo: 'angel st', linha: 'Angel ST', segmento: 'esportivo-street' },
  { termo: 'sport demon', linha: 'Sport Demon', segmento: 'esportivo-street' },
  { termo: 'sportec m9rr', linha: 'Sportec M9RR', segmento: 'esportivo-street' },
  { termo: 'sportec m7rr', linha: 'Sportec M7RR', segmento: 'esportivo-street' },
  { termo: 'sportec m3', linha: 'Sportec M3', segmento: 'esportivo-street' },
  { termo: 'sportec', linha: 'Sportec', segmento: 'esportivo-street' },
  { termo: 'roadtec', linha: 'Roadtec', segmento: 'esportivo-street' },
  { termo: 'me street', linha: 'ME Street', segmento: 'esportivo-street' },
  { termo: 'pilot road', linha: 'Pilot Road', segmento: 'esportivo-street' },
  { termo: 'pilot power', linha: 'Pilot Power', segmento: 'esportivo-street' },
  { termo: 'road 6', linha: 'Road 6', segmento: 'esportivo-street' },
  { termo: 'road 5', linha: 'Road 5', segmento: 'esportivo-street' },

  // ── Custom ──────────────────────────────────────────────────────────
  { termo: 'cruisetec', linha: 'Cruisetec', segmento: 'custom' },
  { termo: 'marathon me888', linha: 'Marathon ME888', segmento: 'custom' },
  { termo: 'me888', linha: 'Marathon ME888', segmento: 'custom' },
  { termo: 'scorcher', linha: 'Scorcher', segmento: 'custom' },
  { termo: 'commander', linha: 'Commander', segmento: 'custom' },
  { termo: 'exedra', linha: 'Exedra', segmento: 'custom' },
  { termo: 'night dragon', linha: 'Night Dragon', segmento: 'custom' },

  // ── Scooter ─────────────────────────────────────────────────────────
  { termo: 'city grip 2', linha: 'City Grip 2', segmento: 'scooter' },
  { termo: 'city grip', linha: 'City Grip', segmento: 'scooter' },
  { termo: 'diablo scooter', linha: 'Diablo Scooter', segmento: 'scooter' },
  { termo: 'angel scooter', linha: 'Angel Scooter', segmento: 'scooter' },
  { termo: 'sc300', linha: 'SC300', segmento: 'scooter' },
]

export interface SugestaoPneu {
  linha: string
  segmento: RegraLinha['segmento']
  /** Trecho do nome que disparou a sugestão — mostrado no painel */
  termo: string
}

/** Tira acento e baixa a caixa para o termo casar com qualquer grafia do ERP. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Melhor palpite para um nome de produto, ou null quando nenhuma linha
 * conhecida aparece — aí o operador classifica na mão, e vale acrescentar a
 * regra aqui se for uma linha recorrente.
 */
export function sugerirClassificacao(nome: string): SugestaoPneu | null {
  const alvo = normalizar(nome)

  let melhor: RegraLinha | null = null
  for (const regra of REGRAS_LINHA) {
    if (!alvo.includes(regra.termo)) continue
    if (!melhor || regra.termo.length > melhor.termo.length) melhor = regra
  }

  if (!melhor) return null
  return { linha: melhor.linha, segmento: melhor.segmento, termo: melhor.termo }
}
