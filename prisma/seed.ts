import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const produtos = [
  {
    sku: 'PIR-ANGEL-GT-160-60R17',
    nome: 'Pneu Pirelli Angel GT 160/60R17',
    slug: 'pneu-pirelli-angel-gt-160-60r17',
    descricao: 'Pneu traseiro Pirelli Angel GT para motos esportivas. Alta performance em condições mistas, excelente estabilidade em curvas e longa durabilidade.',
    preco: 649.90,
    precoPromocional: 589.90,
    estoque: 12,
    categoria: 'Pneus',
    marca: 'Pirelli',
    imagens: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
    compatibilidadeMotos: ['Honda CB 500', 'Yamaha MT-07', 'Kawasaki Z650'],
    destaque: true,
  },
  {
    sku: 'PIR-ANGEL-GT-120-70R17',
    nome: 'Pneu Pirelli Angel GT 120/70R17',
    slug: 'pneu-pirelli-angel-gt-120-70r17',
    descricao: 'Pneu dianteiro Pirelli Angel GT para motos esportivas. Par ideal com o traseiro Angel GT. Alta performance e segurança.',
    preco: 579.90,
    precoPromocional: null,
    estoque: 8,
    categoria: 'Pneus',
    marca: 'Pirelli',
    imagens: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
    compatibilidadeMotos: ['Honda CB 500', 'Yamaha MT-07', 'Kawasaki Z650'],
    destaque: false,
  },
  {
    sku: 'MET-ROADTEC-02-190-55R17',
    nome: 'Pneu Metzeler Roadtec 02 190/55R17',
    slug: 'pneu-metzeler-roadtec-02-190-55r17',
    descricao: 'Pneu traseiro Metzeler Roadtec 02 para touring e naked. Tecnologia INTERACT com duplo composto para máxima aderência em clima seco e molhado.',
    preco: 899.90,
    precoPromocional: 799.90,
    estoque: 5,
    categoria: 'Pneus',
    marca: 'Metzeler',
    imagens: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
    compatibilidadeMotos: ['BMW S1000R', 'Ducati Monster', 'Honda CB 1000R'],
    destaque: true,
  },
  {
    sku: 'MIC-PILOT-ROAD-5-180-55R17',
    nome: 'Pneu Michelin Pilot Road 5 180/55R17',
    slug: 'pneu-michelin-pilot-road-5-180-55r17',
    descricao: 'O Michelin Pilot Road 5 oferece a melhor performance em clima molhado da sua categoria. Tecnologia XST Evo para drenagem excepcional.',
    preco: 849.90,
    precoPromocional: null,
    estoque: 9,
    categoria: 'Pneus',
    marca: 'Michelin',
    imagens: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
    compatibilidadeMotos: ['Honda CB 650R', 'Yamaha MT-09', 'Triumph Street Triple'],
    destaque: true,
  },
  {
    sku: 'OLEO-MOTUL-7100-10W40-1L',
    nome: 'Óleo Motul 7100 10W40 4T 1L',
    slug: 'oleo-motul-7100-10w40-1l',
    descricao: 'Óleo sintético de alta performance para motores 4 tempos. Proteção máxima em altas temperaturas. Indicado para motos esportivas e naked.',
    preco: 89.90,
    precoPromocional: 79.90,
    estoque: 30,
    categoria: 'Lubrificantes',
    marca: 'Motul',
    imagens: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
    compatibilidadeMotos: [],
    destaque: false,
  },
  {
    sku: 'PASTILHA-EBC-FA-HONDA-CB500',
    nome: 'Pastilha de Freio EBC FA Honda CB 500F/X',
    slug: 'pastilha-freio-ebc-fa-honda-cb500',
    descricao: 'Pastilha de freio EBC FA (orgânica) para Honda CB 500F e CB 500X. Alta performance freios à frio. Baixo nível de ruído e poeira.',
    preco: 129.90,
    precoPromocional: null,
    estoque: 15,
    categoria: 'Freios',
    marca: 'EBC',
    imagens: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
    compatibilidadeMotos: ['Honda CB 500F', 'Honda CB 500X'],
    destaque: false,
  },
  {
    sku: 'CORRENTE-DID-520-VX2-GOLD',
    nome: 'Kit Relação DID 520 VX2 Gold Honda Titan 160',
    slug: 'kit-relacao-did-520-vx2-gold-titan-160',
    descricao: 'Kit transmissão completo (corrente + coroa + pinhão) DID 520 VX2 série gold para Honda Titan 160. O-ring para maior durabilidade.',
    preco: 299.90,
    precoPromocional: 269.90,
    estoque: 7,
    categoria: 'Transmissão',
    marca: 'DID',
    imagens: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
    compatibilidadeMotos: ['Honda Titan 160', 'Honda Fan 160'],
    destaque: false,
  },
  {
    sku: 'PIR-DIABLO-ROSSO-III-200-55R17',
    nome: 'Pneu Pirelli Diablo Rosso III 200/55R17',
    slug: 'pneu-pirelli-diablo-rosso-iii-200-55r17',
    descricao: 'O pneu mais avançado da linha Diablo. Tecnologia Multi-radius para máxima aderência em curvas. Indicado para superbikes e motos de alta performance.',
    preco: 1099.90,
    precoPromocional: 989.90,
    estoque: 4,
    categoria: 'Pneus',
    marca: 'Pirelli',
    imagens: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
    compatibilidadeMotos: ['Kawasaki ZX-10R', 'BMW S1000RR', 'Ducati Panigale'],
    destaque: true,
  },
]

async function main() {
  console.log('Seeding database...')

  for (const p of produtos) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } })
    if (!existing) {
      await prisma.product.create({
        data: {
          ...p,
          precoPromocional: p.precoPromocional ?? undefined,
        },
      })
      console.log(`Created: ${p.nome}`)
    } else {
      console.log(`Skipped (exists): ${p.nome}`)
    }
  }

  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
