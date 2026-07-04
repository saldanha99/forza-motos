/**
 * Forza Sync Worker — roda na VPS (Docker), sem limite de timeout.
 *
 * Converge o catálogo do site com o ERP Olist/Tiny (fonte da verdade):
 *   1. jobEstoque    — estoque real de TODOS os produtos (depósito "Loja";
 *                      depósitos dropship → 999 = disponível via fornecedor)
 *   2. jobImagens    — verifica imagens + peso/dimensões/descrição pendentes
 *   3. jobCatalogo   — importa produtos do Tiny que faltam no site e desativa
 *                      fantasmas que sumiram do ERP (não deleta — reversível)
 *   4. jobEspelhar   — re-hospeda as imagens no Vercel Blob (fim das imagens
 *                      quebradas por dependência do CDN do Olist)
 *
 * Ciclo: catálogo (importação+fantasmas) a cada ciclo; estoque + imagens em loop contínuo.
 * Rate limit do Tiny respeitado com delay fixo + retry com backoff em bloqueio.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const BASE_URL = 'https://api.tiny.com.br/api2'
const DELAY_MS = 1300            // delay entre chamadas produto.obter*
const PAUSA_ENTRE_CICLOS_MIN = 30
const CATALOGO_INTERVALO_H = 1 // catálogo (importação+fantasmas) roda a cada ciclo

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString(), ...a)

// ─── Cliente Tiny com retry/backoff (o app na Vercel não tem isso) ──────────
async function tinyFetch(endpoint, params = {}, delayMs = DELAY_MS) {
  const token = process.env.OLIST_TOKEN
  if (!token) throw new Error('OLIST_TOKEN não configurado')

  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    await sleep(delayMs)
    let res
    try {
      res = await fetch(`${BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token, formato: 'JSON',
          ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
        }).toString(),
      })
    } catch (e) {
      log(`[tiny] erro de rede (${tentativa}/5):`, e.message)
      await sleep(15000 * tentativa)
      continue
    }

    if (res.status === 429 || res.status >= 500) {
      log(`[tiny] HTTP ${res.status} (${tentativa}/5) — backoff`)
      await sleep(60000 * tentativa)
      continue
    }
    if (!res.ok) throw new Error(`Tiny HTTP ${res.status}`)

    const data = await res.json()
    if (data.retorno?.status === 'Erro') {
      const msg = data.retorno.erro || JSON.stringify(data.retorno.erros ?? '')
      // Bloqueio de rate limit vem como status Erro com essa mensagem
      if (/bloqueada|bloqueado|muitas requisi/i.test(msg)) {
        log(`[tiny] API bloqueada (${tentativa}/5) — backoff 90s`)
        await sleep(90000 * tentativa)
        continue
      }
      const err = new Error(`Tiny API: ${msg}`)
      err.tinyMsg = msg
      throw err
    }
    return data
  }
  throw new Error(`Tiny: 5 tentativas esgotadas em ${endpoint}`)
}

const naoExisteNoTiny = (e) =>
  /não localizado|nao localizado|não encontrado|nao encontrado|inválido|invalido/i.test(e?.tinyMsg ?? '')

// ─── Estoque real (mesma semântica do app: Loja / dropship=999) ─────────────
const DEPOSITOS_DROPSHIP = ['drop_eurolaqu', 'f_drop', 'eurolaqui', 'drop']

async function buscarEstoqueReal(tinyId) {
  const data = await tinyFetch('produto.obter.estoque.php', { id: String(tinyId) })
  const raw = data.retorno?.produto?.depositos ?? []
  const lista = Array.isArray(raw) ? raw : raw.deposito ? [raw.deposito].flat() : []

  let saldoLoja = 0
  let temDropship = false
  for (const item of lista) {
    const dep = item.deposito ?? item
    const nome = (dep.nome ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const saldo = Number(dep.saldo ?? dep.quantidade ?? 0)
    if (nome === 'loja') saldoLoja += saldo
    else if (DEPOSITOS_DROPSHIP.some((d) => nome.includes(d))) temDropship = true
  }
  if (saldoLoja > 0) return saldoLoja
  if (temDropship) return 999
  const total = lista.reduce((acc, item) => {
    const dep = item.deposito ?? item
    return acc + Number(dep.saldo ?? dep.quantidade ?? 0)
  }, 0)
  return Math.max(0, total)
}

// ─── Extração de imagens (mesma lógica do app) ──────────────────────────────
function extrairImagensTiny(p) {
  if (!p) return []
  const urls = []
  const toUrl = (item) => {
    if (!item) return ''
    if (typeof item === 'string') return item
    const idAnexo = item.idAnexo || item.id || item.anexo?.id || item.anexo?.idAnexo
    const nomeAnexo = item.nomeAnexo || item.nome || item.anexo?.nome || item.anexo?.nomeAnexo
    if (idAnexo && nomeAnexo)
      return `https://erp.olist.com/download?idAnexo=${idAnexo}&nomeAnexo=${encodeURIComponent(nomeAnexo)}`
    if (typeof item.anexo === 'string' && item.anexo) return item.anexo
    return item.url || item.link || item.endereco || item.src || item.path || item.arquivo || item.miniatura || ''
  }
  const extrairArray = (campo) => {
    if (!campo) return []
    const arr = Array.isArray(campo) ? campo : [campo]
    return arr.flatMap((i) => (i?.anexo && typeof i.anexo === 'object' ? [toUrl(i.anexo)] : [toUrl(i)]))
  }
  urls.push(...extrairArray(p.anexos), ...extrairArray(p.imagens_externas))
  return [...new Set(urls.filter((u) => u && u.startsWith('http')))]
}

const parseNum = (v) => {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v)
  return Number.isFinite(n) ? n : null
}

// ─── JOB 1: estoque real de todos os produtos ───────────────────────────────
async function jobEstoque() {
  const produtos = await prisma.product.findMany({
    where: { tinyId: { not: null } },
    select: { id: true, tinyId: true, sku: true, temImagem: true, estoque: true },
    // 999 primeiro (nunca verificados), depois os mais desatualizados
    orderBy: [{ updatedAt: 'asc' }],
  })
  // Prioriza a fila: placeholders 999 na frente
  produtos.sort((a, b) => (b.estoque === 999 ? 1 : 0) - (a.estoque === 999 ? 1 : 0))

  let ok = 0, mudaram = 0, fantasmas = 0, erros = 0
  for (const p of produtos) {
    try {
      const novo = await buscarEstoqueReal(p.tinyId)
      if (novo !== p.estoque) mudaram++
      await prisma.product.update({
        where: { id: p.id },
        data: { estoque: novo, ativo: p.temImagem && novo > 0 },
      })
      ok++
    } catch (e) {
      if (naoExisteNoTiny(e)) {
        await prisma.product.update({
          where: { id: p.id },
          data: { ativo: false, estoque: 0 },
        })
        fantasmas++
        log(`[estoque] fantasma desativado: ${p.sku} (tinyId ${p.tinyId})`)
      } else {
        erros++
        log(`[estoque] erro ${p.sku}:`, e.message)
        if (erros > 30) throw new Error('jobEstoque: excesso de erros, abortando passada')
      }
    }
    if (ok % 200 === 0 && ok > 0) log(`[estoque] progresso: ${ok}/${produtos.length}`)
  }
  log(`[estoque] passada completa: ${ok} verificados, ${mudaram} corrigidos, ${fantasmas} fantasmas, ${erros} erros`)
  return { ok, mudaram, fantasmas, erros }
}

// ─── JOB 2: imagens + peso/dimensões pendentes ──────────────────────────────
async function jobImagens() {
  const seteAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const pendentes = await prisma.product.findMany({
    where: {
      tinyId: { not: null },
      OR: [
        { temImagem: false, imagensVerificadas: false },
        { temImagem: false, imagensVerificadas: true, updatedAt: { lt: seteAtras } },
      ],
    },
    select: { id: true, tinyId: true, sku: true, estoque: true },
    orderBy: { updatedAt: 'asc' },
  })
  if (pendentes.length === 0) { log('[imagens] nada pendente'); return { ok: 0 } }

  let ok = 0, comImagem = 0, fantasmas = 0, erros = 0
  for (const p of pendentes) {
    try {
      const data = await tinyFetch('produto.obter.php', { id: String(p.tinyId) })
      const detalhe = data.retorno?.produto
      if (!detalhe) {
        await prisma.product.update({ where: { id: p.id }, data: { imagensVerificadas: true, ativo: false } })
        fantasmas++
        continue
      }
      let imagens = extrairImagensTiny(detalhe)
      // Espelha no Blob já na descoberta (independência do CDN do Olist)
      if (imagens.length > 0) {
        const espelhadas = await subirParaBlob(p.sku, imagens)
        if (espelhadas.length > 0) imagens = espelhadas
      }
      const temImagem = imagens.length > 0
      if (temImagem) comImagem++
      const tinyAtivo = detalhe.situacao === 'A' || detalhe.situacao === 'Ativo'
      const descricao = detalhe.descricao_complementar || detalhe.obs || detalhe.descricao_curta || ''
      const categoria = detalhe.categoria?.descricao || (typeof detalhe.categoria === 'string' ? detalhe.categoria : '') || undefined
      const peso = parseNum(detalhe.peso_bruto ?? detalhe.peso_liquido ?? detalhe.peso)
      const altura = parseNum(detalhe.altura_embalagem ?? detalhe.altura)
      const largura = parseNum(detalhe.largura_embalagem ?? detalhe.largura)
      const comprimento = parseNum(detalhe.comprimento_embalagem ?? detalhe.comprimento)

      await prisma.product.update({
        where: { id: p.id },
        data: {
          imagens,
          imagensVerificadas: true,
          temImagem,
          ativo: tinyAtivo && temImagem && p.estoque > 0,
          descricao: descricao || undefined,
          ...(categoria && { categoria }),
          ...(detalhe.marca && { marca: detalhe.marca }),
          ...(peso !== null && { peso }),
          ...(altura !== null && { altura }),
          ...(largura !== null && { largura }),
          ...(comprimento !== null && { comprimento }),
        },
      })
      ok++
    } catch (e) {
      if (naoExisteNoTiny(e)) {
        await prisma.product.update({ where: { id: p.id }, data: { imagensVerificadas: true, ativo: false } })
        fantasmas++
      } else {
        erros++
        log(`[imagens] erro ${p.sku}:`, e.message)
        if (erros > 30) throw new Error('jobImagens: excesso de erros, abortando passada')
      }
    }
    if (ok % 100 === 0 && ok > 0) log(`[imagens] progresso: ${ok}/${pendentes.length}`)
  }
  log(`[imagens] passada completa: ${ok} verificados (${comImagem} com foto), ${fantasmas} fantasmas, ${erros} erros`)
  return { ok, comImagem, fantasmas, erros }
}

// ─── JOB 3: catálogo — importa produtos que faltam + desativa fantasmas ─────
const gerarSlug = (nome) =>
  String(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 90)

async function jobCatalogo() {
  const skusTiny = new Set()
  const idsTiny = new Set()
  const payloads = []
  let pagina = 1
  let totalPaginas = 1
  while (pagina <= totalPaginas) {
    const data = await tinyFetch('produtos.pesquisa.php', { pagina, situacao: 'A' }, 400)
    const produtos = (data.retorno?.produtos ?? []).map((x) => x.produto ?? x)
    totalPaginas = Number(data.retorno?.numero_paginas ?? data.retorno?.paginas ?? 1)
    for (const p of produtos) {
      if (p.codigo) skusTiny.add(String(p.codigo).trim())
      if (p.id) idsTiny.add(String(p.id).trim())
      payloads.push(p)
    }
    pagina++
  }
  if (skusTiny.size === 0 && idsTiny.size === 0) {
    log('[catalogo] listagem do Tiny veio vazia — abortando por segurança')
    return { desativados: 0, importados: 0 }
  }

  // IMPORTAÇÃO: produtos do Tiny que não existem no banco
  const skusBanco = new Set(
    (await prisma.product.findMany({ select: { sku: true } })).map((p) => p.sku.trim())
  )
  const idsBanco = new Set(
    (await prisma.product.findMany({ where: { tinyId: { not: null } }, select: { tinyId: true } }))
      .map((p) => (p.tinyId ?? '').trim())
  )
  const faltantes = payloads.filter((p) => {
    const sku = String(p.codigo || p.id || '').trim()
    return sku && !skusBanco.has(sku) && !idsBanco.has(String(p.id ?? '').trim())
  })

  let importados = 0
  for (const p of faltantes) {
    const sku = String(p.codigo || p.id).trim()
    try {
      let slug = gerarSlug(p.nome || `produto-${sku}`)
      if (await prisma.product.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-${sku}`
      await prisma.product.create({
        data: {
          sku,
          nome: p.nome || 'Produto sem nome',
          slug,
          descricao: '',
          preco: parseNum(p.preco ?? p.preco_venda) ?? 0,
          precoPromocional: (() => { const v = parseNum(p.preco_promocional); return v && v > 0 ? v : null })(),
          estoque: 999, // marcador "nunca verificado" — jobEstoque prioriza e corrige
          ativo: false, // só ativa depois de imagem + estoque verificados
          tinyId: String(p.id),
          categoria: p.categoria?.descricao || (typeof p.categoria === 'string' ? p.categoria : '') || 'Geral',
          marca: p.marca || '',
          imagens: [],
          temImagem: false,
          imagensVerificadas: false,
          compatibilidadeMotos: [],
        },
      })
      importados++
      skusBanco.add(sku)
    } catch (e) {
      log(`[catalogo] erro ao importar ${sku}:`, e.message)
    }
  }
  if (importados > 0) log(`[catalogo] ${importados} produtos novos importados do Tiny (de ${faltantes.length} faltantes)`)


  const todos = await prisma.product.findMany({
    where: { tinyId: { not: null }, ativo: true },
    select: { id: true, sku: true, tinyId: true },
  })
  const fantasmas = todos.filter(
    (p) => !skusTiny.has((p.sku ?? '').trim()) && !idsTiny.has((p.tinyId ?? '').trim())
  )
  // Trava de segurança: se >30% do catálogo "sumiu", algo está errado na listagem
  if (fantasmas.length > todos.length * 0.3) {
    log(`[catalogo] ${fantasmas.length}/${todos.length} candidatos a fantasma (>30%) — abortando por segurança`)
    return { desativados: 0, importados, suspeito: fantasmas.length }
  }
  for (const f of fantasmas) {
    await prisma.product.update({ where: { id: f.id }, data: { ativo: false, estoque: 0 } })
    log(`[catalogo] fantasma desativado: ${f.sku} (tinyId ${f.tinyId})`)
  }
  log(`[catalogo] varredura completa: ${todos.length} ativos no banco, ${skusTiny.size} SKUs no Tiny, ${importados} importados, ${fantasmas.length} fantasmas desativados`)
  return { desativados: fantasmas.length, importados }
}

// ─── JOB 4: espelhar imagens no disco da VPS (independência total) ──────────
// Imagens hot-linkadas (erp.olist.com / cdn tiny / S3) quebram se o Olist
// tirar do ar. Baixamos e servimos do nginx local (/imagens → volume).
// Política conservadora: NUNCA rebaixa produto por falha de download —
// só promove quando o download deu certo.
const fs = require('fs')
const path = require('path')
const IMG_DIR = process.env.IMG_DIR ?? '/imagens'
const IMG_BASE = process.env.IMG_BASE_URL ?? 'https://www.forzamotos.com.br/imagens'
const BLOB_HOST = 'blob.vercel-storage.com' // legado: migração one-shot esvaziou

const urlLocal = (u) => typeof u === 'string' && u.startsWith(`${IMG_BASE}/`)

async function baixarImagem(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!ct.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) return null // pixel/placeholder
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[ct] ?? 'jpg'
    return { buf, ct, ext }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Baixa e grava as URLs no disco local. Retorna as URLs finais (ordem preservada). */
async function subirParaBlob(sku, urls) {
  const novas = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    if (typeof url !== 'string' || !url) continue
    if (urlLocal(url)) { novas.push(url); continue } // já está no disco da VPS
    const img = await baixarImagem(url)
    if (!img) continue
    try {
      const dir = path.join(IMG_DIR, 'produtos', sku)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, `${i}.${img.ext}`), img.buf)
      novas.push(`${IMG_BASE}/produtos/${encodeURIComponent(sku)}/${i}.${img.ext}`)
    } catch (e) {
      log(`[imagens-disco] erro gravando ${sku}/${i}:`, e.message)
    }
    await sleep(100)
  }
  return novas
}

async function jobEspelhar() {
  try {
    fs.mkdirSync(IMG_DIR, { recursive: true })
  } catch (e) {
    log('[espelhar] diretório de imagens indisponível — pulando:', e.message)
    return { espelhados: 0 }
  }
  const candidatos = await prisma.product.findMany({
    where: { temImagem: true },
    select: { id: true, sku: true, tinyId: true, imagens: true },
    orderBy: { updatedAt: 'asc' },
  })
  let espelhados = 0, semDownload = 0, jaOk = 0
  for (const p of candidatos) {
    const urls = Array.isArray(p.imagens) ? p.imagens : []
    if (urls.length === 0) continue
    if (urls.every(urlLocal)) { jaOk++; continue }

    let novas = await subirParaBlob(p.sku, urls)

    // Nenhuma imagem baixou → tenta re-extrair URLs frescas do Tiny (1x)
    if (novas.length === 0 && p.tinyId) {
      try {
        const data = await tinyFetch('produto.obter.php', { id: String(p.tinyId) })
        const frescas = extrairImagensTiny(data.retorno?.produto)
        if (frescas.length > 0) novas = await subirParaBlob(p.sku, frescas)
      } catch (e) {
        log(`[espelhar] re-extração falhou ${p.sku}:`, e.message)
      }
    }

    if (novas.length > 0) {
      await prisma.product.update({ where: { id: p.id }, data: { imagens: novas, temImagem: true } })
      espelhados++
    } else {
      // Conservador: mantém como está (pode ser bloqueio temporário do CDN)
      semDownload++
      log(`[espelhar] nenhuma imagem baixável p/ ${p.sku} — mantido como está`)
    }
    if ((espelhados + semDownload) % 100 === 0 && espelhados + semDownload > 0)
      log(`[espelhar] progresso: ${espelhados + semDownload}/${candidatos.length - jaOk}`)
  }
  log(`[espelhar] passada completa: ${espelhados} espelhados no disco, ${jaOk} já estavam, ${semDownload} sem download (mantidos)`)
  return { espelhados, jaOk, semDownload }
}

// ─── Alerta WhatsApp (Evolution API) — avisa o admin quando o sync falha ────
const ALERTA_COOLDOWN_H = 6
const ultimoAlerta = new Map() // chave → timestamp

async function alertarAdmin(chave, mensagem) {
  const base = process.env.EVOLUTION_API_URL
  const apikey = process.env.EVOLUTION_API_KEY
  const numero = (process.env.ADMIN_WHATSAPP ?? '5519974049445').replace(/\D/g, '')
  if (!base || !apikey) return

  // Rate limit: 1 alerta por tipo a cada 6h (evita metralhadora em pane longa)
  const agora = Date.now()
  if (agora - (ultimoAlerta.get(chave) ?? 0) < ALERTA_COOLDOWN_H * 3600_000) return
  ultimoAlerta.set(chave, agora)

  // Instância: Setting do banco tem prioridade (mesma regra do app)
  let instance = process.env.EVOLUTION_INSTANCE || 'forza-motos'
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'evolution_instance' } })
    if (s?.value) instance = s.value
  } catch {}

  try {
    const res = await fetch(`${base}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey },
      body: JSON.stringify({
        number: numero,
        text: `🤖 *Robô de Sync — Forza Motos*\n\n${mensagem}\n\nDetalhes: https://sync.forzamotos.com.br/status`,
        delay: 1200,
      }),
    })
    log(`[alerta] WhatsApp ${chave}: HTTP ${res.status}`)
  } catch (e) {
    log(`[alerta] falha ao enviar WhatsApp:`, e.message)
  }
}

// ─── Status: persistido em Setting (lido pelo admin) + HTTP :3000 ───────────
const http = require('http')

const STATUS = {
  versao: 3,
  iniciadoEm: new Date().toISOString(),
  heartbeat: null,
  jobAtual: null,
  ciclos: 0,
  jobs: {}, // { estoque: { fim, duracaoSeg, resumo, erro } }
}

async function salvarStatus() {
  STATUS.heartbeat = new Date().toISOString()
  try {
    const value = JSON.stringify(STATUS)
    await prisma.setting.upsert({
      where: { key: 'sync_worker_status' },
      update: { value },
      create: { key: 'sync_worker_status', value },
    })
  } catch (e) {
    log('[status] erro ao salvar:', e.message)
  }
}

async function rodarJob(nome, fn) {
  STATUS.jobAtual = nome
  await salvarStatus()
  const t0 = Date.now()
  try {
    const resumo = await fn()
    STATUS.jobs[nome] = {
      fim: new Date().toISOString(),
      duracaoSeg: Math.round((Date.now() - t0) / 1000),
      resumo,
      erro: null,
    }
  } catch (e) {
    STATUS.jobs[nome] = {
      fim: new Date().toISOString(),
      duracaoSeg: Math.round((Date.now() - t0) / 1000),
      resumo: null,
      erro: e.message,
    }
    await alertarAdmin(
      `job-${nome}`,
      `⚠️ O job *${nome}* falhou:\n_${e.message}_\n\nVou tentar de novo no próximo ciclo. Se o alerta repetir, verificar a VPS.`
    )
    throw e
  } finally {
    STATUS.jobAtual = null
    await salvarStatus()
  }
}

http
  .createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200); return res.end('ok') }
    if (req.url === '/' || req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      return res.end(JSON.stringify(STATUS, null, 2))
    }
    res.writeHead(404)
    res.end()
  })
  .listen(3000, () => log('[http] servidor de status na porta 3000'))

// ─── Loop principal ─────────────────────────────────────────────────────────
async function main() {
  log('═══ Forza Sync Worker iniciado ═══')
  await salvarStatus()
  setInterval(salvarStatus, 60_000) // heartbeat p/ o admin detectar worker vivo
  let ultimoCatalogo = 0
  for (;;) {
    try {
      if (Date.now() - ultimoCatalogo > CATALOGO_INTERVALO_H * 3600_000) {
        await rodarJob('catalogo', jobCatalogo) // importa faltantes + desativa fantasmas
        ultimoCatalogo = Date.now()
      }
      await rodarJob('imagens', jobImagens)     // destrava pendentes (já espelha no Blob)
      await rodarJob('espelhar', jobEspelhar)   // migra imagens hot-linkadas pro Blob
      await rodarJob('estoque', jobEstoque)     // converge estoque do catálogo inteiro
      STATUS.ciclos++
    } catch (e) {
      log('[main] erro no ciclo:', e.message, '— aguardando 10min')
      await sleep(600_000)
    }
    log(`[main] ciclo completo — pausa de ${PAUSA_ENTRE_CICLOS_MIN}min`)
    await sleep(PAUSA_ENTRE_CICLOS_MIN * 60_000)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
