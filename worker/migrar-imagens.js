/**
 * Migração one-shot: Vercel Blob → disco da VPS (/imagens).
 * Baixa cada imagem hospedada no Blob, grava em /imagens/produtos/<sku>/<i>.<ext>
 * e regrava a URL no banco como https://www.forzamotos.com.br/imagens/...
 * Idempotente: URLs já locais são mantidas; produto só é atualizado se
 * TODAS as imagens do Blob baixarem (não deixa produto pela metade).
 */
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const IMG_DIR = '/imagens'
const IMG_BASE = process.env.IMG_BASE_URL ?? 'https://www.forzamotos.com.br/imagens'
const BLOB_HOST = 'blob.vercel-storage.com'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString(), ...a)

async function baixar(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) return null
    const ext =
      { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[ct] ??
      (url.match(/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i)?.[1]?.toLowerCase() ?? 'jpg')
    return { buf, ext }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  const produtos = await prisma.$queryRaw`
    SELECT id, sku, imagens FROM "Product"
    WHERE imagens::text LIKE ${'%' + BLOB_HOST + '%'}
  `
  log(`${produtos.length} produtos com imagens no Blob para migrar`)

  let migrados = 0, falhas = 0, imgsBaixadas = 0
  for (const p of produtos) {
    const urls = Array.isArray(p.imagens) ? p.imagens : []
    const novas = []
    let ok = true
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      if (typeof url !== 'string' || !url.includes(BLOB_HOST)) {
        novas.push(url) // já local ou externa — mantém
        continue
      }
      const img = await baixar(url)
      if (!img) { ok = false; break }
      const dir = path.join(IMG_DIR, 'produtos', p.sku)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, `${i}.${img.ext}`), img.buf)
      novas.push(`${IMG_BASE}/produtos/${encodeURIComponent(p.sku)}/${i}.${img.ext}`)
      imgsBaixadas++
      await sleep(60)
    }
    if (ok && novas.length) {
      await prisma.product.update({ where: { id: p.id }, data: { imagens: novas } })
      migrados++
    } else {
      falhas++
      log(`[falha] ${p.sku} — alguma imagem do Blob não baixou; mantido no Blob`)
    }
    if ((migrados + falhas) % 100 === 0) log(`progresso: ${migrados + falhas}/${produtos.length} (${imgsBaixadas} imgs)`)
  }
  log(`FIM: ${migrados} produtos migrados, ${falhas} falhas, ${imgsBaixadas} imagens baixadas`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
