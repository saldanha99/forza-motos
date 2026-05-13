/**
 * Modelos de moto para SEO long-tail
 * Cada modelo vira uma URL /pneus/[slug] com filtro de produtos compatíveis
 */
export interface ModeloMoto {
  slug: string
  marca: string
  nome: string
  cilindradas: number
  /** Termos de busca usados para casar produtos compatíveis no banco */
  termosCompativeis: string[]
}

export const MODELOS_MOTOS: ModeloMoto[] = [
  // Honda
  { slug: 'honda-cg-160', marca: 'Honda', nome: 'CG 160', cilindradas: 160, termosCompativeis: ['CG 160', 'CG160', 'Honda CG'] },
  { slug: 'honda-titan-160', marca: 'Honda', nome: 'Titan 160', cilindradas: 160, termosCompativeis: ['Titan', 'CG 160'] },
  { slug: 'honda-fan-160', marca: 'Honda', nome: 'Fan 160', cilindradas: 160, termosCompativeis: ['Fan', 'CG 160'] },
  { slug: 'honda-cb-300', marca: 'Honda', nome: 'CB 300', cilindradas: 300, termosCompativeis: ['CB 300', 'CB300'] },
  { slug: 'honda-cb-500', marca: 'Honda', nome: 'CB 500', cilindradas: 500, termosCompativeis: ['CB 500', 'CB500'] },
  { slug: 'honda-xre-300', marca: 'Honda', nome: 'XRE 300', cilindradas: 300, termosCompativeis: ['XRE'] },
  { slug: 'honda-biz-125', marca: 'Honda', nome: 'Biz 125', cilindradas: 125, termosCompativeis: ['Biz'] },
  { slug: 'honda-pop-110', marca: 'Honda', nome: 'Pop 110', cilindradas: 110, termosCompativeis: ['Pop'] },
  { slug: 'honda-bros-160', marca: 'Honda', nome: 'NXR 160 Bros', cilindradas: 160, termosCompativeis: ['Bros', 'NXR'] },
  { slug: 'honda-pcx-160', marca: 'Honda', nome: 'PCX 160', cilindradas: 160, termosCompativeis: ['PCX'] },
  // Yamaha
  { slug: 'yamaha-fazer-250', marca: 'Yamaha', nome: 'Fazer 250', cilindradas: 250, termosCompativeis: ['Fazer 250', 'Fazer250'] },
  { slug: 'yamaha-fazer-150', marca: 'Yamaha', nome: 'Factor 150', cilindradas: 150, termosCompativeis: ['Factor', 'YBR'] },
  { slug: 'yamaha-mt-03', marca: 'Yamaha', nome: 'MT-03', cilindradas: 300, termosCompativeis: ['MT-03', 'MT03'] },
  { slug: 'yamaha-mt-07', marca: 'Yamaha', nome: 'MT-07', cilindradas: 700, termosCompativeis: ['MT-07', 'MT07'] },
  { slug: 'yamaha-xj6', marca: 'Yamaha', nome: 'XJ6', cilindradas: 600, termosCompativeis: ['XJ6'] },
  { slug: 'yamaha-r3', marca: 'Yamaha', nome: 'YZF-R3', cilindradas: 300, termosCompativeis: ['R3', 'YZF'] },
  // Kawasaki
  { slug: 'kawasaki-z400', marca: 'Kawasaki', nome: 'Z400', cilindradas: 400, termosCompativeis: ['Z400'] },
  { slug: 'kawasaki-ninja-400', marca: 'Kawasaki', nome: 'Ninja 400', cilindradas: 400, termosCompativeis: ['Ninja 400'] },
  // BMW
  { slug: 'bmw-g310', marca: 'BMW', nome: 'G 310 R', cilindradas: 310, termosCompativeis: ['G310', 'G 310'] },
  // Suzuki
  { slug: 'suzuki-gsx-s750', marca: 'Suzuki', nome: 'GSX-S750', cilindradas: 750, termosCompativeis: ['GSX', 'GSXS'] },
]

export function getModelo(slug: string): ModeloMoto | undefined {
  return MODELOS_MOTOS.find((m) => m.slug === slug)
}

export function getModelosPorMarca() {
  const map = new Map<string, ModeloMoto[]>()
  for (const m of MODELOS_MOTOS) {
    if (!map.has(m.marca)) map.set(m.marca, [])
    map.get(m.marca)!.push(m)
  }
  return map
}
