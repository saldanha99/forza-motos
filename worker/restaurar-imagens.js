/**
 * Restauração: baixa TODOS os blobs do Vercel Blob para /imagens (volume).
 * Recupera o incidente da migração que gravou em filesystem efêmero.
 * O caminho no Blob (produtos/<sku>/<i>.<ext>) é idêntico ao local, então
 * o banco (já regravado com URLs locais) volta a funcionar sem novo update.
 * Idempotente: pula arquivos que já existem no disco com tamanho > 0.
 */
const fs = require('fs')
const path = require('path')
const { list } = require('@vercel/blob')

const IMG_DIR = '/imagens'
const token = process.env.BLOB_READ_WRITE_TOKEN
const log = (...a) => console.log(new Date().toISOString(), ...a)

async function main() {
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN ausente')
  let cursor
  let total = 0, baixados = 0, pulados = 0, erros = 0
  do {
    const page = await list({ token, cursor, limit: 1000 })
    cursor = page.cursor
    for (const blob of page.blobs) {
      total++
      const destino = path.join(IMG_DIR, blob.pathname)
      try {
        if (fs.existsSync(destino) && fs.statSync(destino).size > 0) { pulados++; continue }
        const res = await fetch(blob.url)
        if (!res.ok) { erros++; log(`[erro] HTTP ${res.status} em ${blob.pathname}`); continue }
        const buf = Buffer.from(await res.arrayBuffer())
        fs.mkdirSync(path.dirname(destino), { recursive: true })
        fs.writeFileSync(destino, buf)
        baixados++
        if (baixados % 250 === 0) log(`progresso: ${baixados} baixados / ${total} vistos`)
      } catch (e) {
        erros++
        log(`[erro] ${blob.pathname}: ${e.message}`)
      }
    }
  } while (cursor)
  log(`FIM: ${total} blobs, ${baixados} baixados, ${pulados} já existiam, ${erros} erros`)
}

main().catch((e) => { console.error(e); process.exit(1) })
