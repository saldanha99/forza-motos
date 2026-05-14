/**
 * Gera imagens de categoria para o e-commerce Forza Motos
 *
 * Usa fal-ai/flux/schnell se FAL_KEY estiver configurado,
 * caso contrário usa OpenAI DALL-E 3.
 *
 * Uso:
 *   FAL_KEY=xxx npx ts-node scripts/generate-images.ts
 *   OPENAI_API_KEY=xxx npx ts-node scripts/generate-images.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'

const OUT_DIR = path.join(process.cwd(), 'public/images/categories')

const IMAGES: { key: string; prompt: string }[] = [
  {
    key: 'hero',
    prompt:
      'cinematic motorcycle speeding on wet night highway, motion blur, orange-red light trails, deep blacks, ultra wide angle, no text',
  },
  {
    key: 'pneus',
    prompt:
      'premium motorcycle tires Pirelli Michelin on dark workshop floor, dramatic side lighting, rubber texture close-up, no text',
  },
  {
    key: 'oleos',
    prompt:
      'Motul Castrol oil bottles on dark metal surface, golden amber liquid reflections, dramatic lighting, studio product shot, no text',
  },
  {
    key: 'freios',
    prompt:
      'motorcycle brake disc rotor and pads on carbon fiber background, metallic silver, red accent glow, macro sharp focus, no text',
  },
  {
    key: 'transmissao',
    prompt:
      'motorcycle chain and sprocket kit polished steel golden o-rings, dramatic side lighting, dark background, no text',
  },
  {
    key: 'capacetes',
    prompt:
      'matte black full-face motorcycle helmet floating above dark reflective surface, studio lighting, dramatic shadows, no text',
  },
]

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

// ── OpenAI DALL-E 3 ────────────────────────────────────────────────────────
async function generateWithOpenAI(apiKey: string) {
  console.log('📡 Usando OpenAI DALL-E 3...\n')

  for (const img of IMAGES) {
    const outPath = path.join(OUT_DIR, `${img.key}.jpg`)
    console.log(`🎨 Gerando: ${img.key}...`)

    const body = JSON.stringify({
      model: 'gpt-image-1',
      prompt: img.prompt,
      n: 1,
      size: '1536x1024',
      quality: 'medium',
      output_format: 'jpeg',
    })

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`  ❌ Erro: ${err}`)
      continue
    }

    const json = await res.json() as any
    // gpt-image-1 retorna base64, dall-e-3 retorna url
    const item = json.data?.[0]
    if (!item) { console.error('  ❌ Sem dados na resposta:', JSON.stringify(json).slice(0, 200)); continue }

    if (item.b64_json) {
      // base64 → arquivo
      const buf = Buffer.from(item.b64_json, 'base64')
      fs.writeFileSync(outPath, buf)
    } else if (item.url) {
      await downloadFile(item.url, outPath)
    } else {
      console.error('  ❌ Formato desconhecido:', JSON.stringify(item).slice(0, 200))
      continue
    }
    console.log(`  ✅ Salvo em public/images/categories/${img.key}.jpg`)
  }
}

// ── fal-ai Flux Schnell ────────────────────────────────────────────────────
async function generateWithFal(apiKey: string) {
  console.log('📡 Usando fal-ai/flux/schnell...\n')

  // Import dinâmico para não quebrar se o pacote não estiver instalado
  const { fal } = await import('@fal-ai/client')
  fal.config({ credentials: apiKey })

  for (const img of IMAGES) {
    const outPath = path.join(OUT_DIR, `${img.key}.jpg`)
    console.log(`🎨 Gerando: ${img.key}...`)

    try {
      const result = await fal.subscribe('fal-ai/flux/schnell', {
        input: {
          prompt: img.prompt,
          image_size: 'landscape_16_9',
          num_inference_steps: 4,
          num_images: 1,
        },
      }) as any

      const url = result?.images?.[0]?.url
      if (!url) { console.error('  ❌ Sem URL na resposta'); continue }

      await downloadFile(url, outPath)
      console.log(`  ✅ Salvo em public/images/categories/${img.key}.jpg`)
    } catch (e: any) {
      console.error(`  ❌ Erro: ${e.message}`)
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const falKey = process.env.FAL_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (falKey) {
    await generateWithFal(falKey)
  } else if (openaiKey) {
    await generateWithOpenAI(openaiKey)
  } else {
    console.error('❌ Configure FAL_KEY ou OPENAI_API_KEY como variável de ambiente')
    console.error('   Exemplo: OPENAI_API_KEY=sk-xxx npx ts-node scripts/generate-images.ts')
    process.exit(1)
  }

  console.log('\n✅ Todas as imagens geradas em public/images/categories/')
}

main().catch(console.error)
