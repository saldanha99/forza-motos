/**
 * Modelos de moto para SEO long-tail
 * Cada modelo vira uma URL /pneus/[slug] com filtro de produtos compatíveis
 */
export type EstiloMoto = 'urbana' | 'scooter' | 'trail' | 'naked' | 'esportiva'

export const ESTILOS: { id: EstiloMoto; label: string; desc: string }[] = [
  { id: 'urbana', label: 'Urbana / Street', desc: 'CG, Titan, Fan, Factor, Biz, Pop' },
  { id: 'scooter', label: 'Scooter', desc: 'PCX, NMax, Burgman' },
  { id: 'trail', label: 'Trail / Aventura', desc: 'XRE, Bros, Lander' },
  { id: 'naked', label: 'Naked', desc: 'CB, MT, XJ6, Z400' },
  { id: 'esportiva', label: 'Esportiva', desc: 'Ninja, R3' },
]

export interface ModeloMoto {
  slug: string
  marca: string
  nome: string
  cilindradas: number
  /** Estilo da moto (filtro na página de pneus) */
  estilo: EstiloMoto
  /** Termos de busca usados para casar produtos compatíveis no banco */
  termosCompativeis: string[]
}

export const MODELOS_MOTOS: ModeloMoto[] = [
  // Honda
  { slug: 'honda-cg-160', marca: 'Honda', nome: 'CG 160', cilindradas: 160, estilo: 'urbana', termosCompativeis: ['CG 160', 'CG160', 'Honda CG'] },
  { slug: 'honda-titan-160', marca: 'Honda', nome: 'Titan 160', cilindradas: 160, estilo: 'urbana', termosCompativeis: ['Titan', 'CG 160'] },
  { slug: 'honda-fan-160', marca: 'Honda', nome: 'Fan 160', cilindradas: 160, estilo: 'urbana', termosCompativeis: ['Fan', 'CG 160'] },
  { slug: 'honda-cb-300', marca: 'Honda', nome: 'CB 300', cilindradas: 300, estilo: 'naked', termosCompativeis: ['CB 300', 'CB300'] },
  { slug: 'honda-cb-500', marca: 'Honda', nome: 'CB 500', cilindradas: 500, estilo: 'naked', termosCompativeis: ['CB 500', 'CB500'] },
  { slug: 'honda-xre-300', marca: 'Honda', nome: 'XRE 300', cilindradas: 300, estilo: 'trail', termosCompativeis: ['XRE'] },
  { slug: 'honda-biz-125', marca: 'Honda', nome: 'Biz 125', cilindradas: 125, estilo: 'urbana', termosCompativeis: ['Biz'] },
  { slug: 'honda-pop-110', marca: 'Honda', nome: 'Pop 110', cilindradas: 110, estilo: 'urbana', termosCompativeis: ['Pop'] },
  { slug: 'honda-bros-160', marca: 'Honda', nome: 'NXR 160 Bros', cilindradas: 160, estilo: 'trail', termosCompativeis: ['Bros', 'NXR'] },
  { slug: 'honda-pcx-160', marca: 'Honda', nome: 'PCX 160', cilindradas: 160, estilo: 'scooter', termosCompativeis: ['PCX'] },
  // Yamaha
  { slug: 'yamaha-fazer-250', marca: 'Yamaha', nome: 'Fazer 250', cilindradas: 250, estilo: 'naked', termosCompativeis: ['Fazer 250', 'Fazer250'] },
  { slug: 'yamaha-fazer-150', marca: 'Yamaha', nome: 'Factor 150', cilindradas: 150, estilo: 'urbana', termosCompativeis: ['Factor', 'YBR'] },
  { slug: 'yamaha-mt-03', marca: 'Yamaha', nome: 'MT-03', cilindradas: 300, estilo: 'naked', termosCompativeis: ['MT-03', 'MT03'] },
  { slug: 'yamaha-mt-07', marca: 'Yamaha', nome: 'MT-07', cilindradas: 700, estilo: 'naked', termosCompativeis: ['MT-07', 'MT07'] },
  { slug: 'yamaha-xj6', marca: 'Yamaha', nome: 'XJ6', cilindradas: 600, estilo: 'naked', termosCompativeis: ['XJ6'] },
  { slug: 'yamaha-r3', marca: 'Yamaha', nome: 'YZF-R3', cilindradas: 300, estilo: 'esportiva', termosCompativeis: ['R3', 'YZF'] },
  // Kawasaki
  { slug: 'kawasaki-z400', marca: 'Kawasaki', nome: 'Z400', cilindradas: 400, estilo: 'naked', termosCompativeis: ['Z400'] },
  { slug: 'kawasaki-ninja-400', marca: 'Kawasaki', nome: 'Ninja 400', cilindradas: 400, estilo: 'esportiva', termosCompativeis: ['Ninja 400'] },
  // BMW
  { slug: 'bmw-g310', marca: 'BMW', nome: 'G 310 R', cilindradas: 310, estilo: 'naked', termosCompativeis: ['G310', 'G 310'] },
  // Suzuki
  { slug: 'suzuki-gsx-s750', marca: 'Suzuki', nome: 'GSX-S750', cilindradas: 750, estilo: 'naked', termosCompativeis: ['GSX', 'GSXS'] },
]

export function getModelo(slug: string): ModeloMoto | undefined {
  return MODELOS_MOTOS.find((m) => m.slug === slug)
}

export function getModelosPorMarca(modelos: ModeloMoto[] = MODELOS_MOTOS) {
  const map = new Map<string, ModeloMoto[]>()
  for (const m of modelos) {
    if (!map.has(m.marca)) map.set(m.marca, [])
    map.get(m.marca)!.push(m)
  }
  return map
}

/**
 * Casa o retorno de uma consulta de placa (MARCA + MODELO do Denatran)
 * com um modelo do catálogo. Ex.: "HONDA/CG 160 TITAN S" → honda-titan-160.
 */
export function casarModeloPorNome(marcaModelo: string): ModeloMoto | undefined {
  const alvo = marcaModelo.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  let melhor: { modelo: ModeloMoto; pontos: number } | undefined
  for (const m of MODELOS_MOTOS) {
    let pontos = 0
    for (const termo of m.termosCompativeis) {
      const t = termo.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim()
      if (t && alvo.includes(t)) pontos += t.length
    }
    if (alvo.includes(m.marca.toUpperCase())) pontos += 2
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { modelo: m, pontos }
  }
  return melhor?.modelo
}
