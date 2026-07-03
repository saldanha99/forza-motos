/**
 * Forza Sync Worker — roda na VPS (Docker), sem limite de timeout.
 *
 * Converge o catálogo do site com o ERP Olist/Tiny (fonte da verdade):
 *   1. jobEstoque    — estoque real de TODOS os produtos (depósito "Loja";
 *                      depósitos dropship → 999 = disponível via fornecedor)
 *   2. jobImagens    — verifica imagens + peso/dimensões/descrição pendentes
 *   3. jobFantasmas  — varre a listagem do Tiny e desativa produtos que não
 *                      existem mais no ERP (não deleta — reversível)
 *
 * Ciclo: fantasmas 1x/24h; estoque + imagens em loop contínuo com pausa.
 * Rate limit do Tiny respeitado com delay fixo + retry com backoff em bloqueio.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const BASE_URL = 'https://api.tiny.com.br/api2'
const DELAY_MS = 1300            // delay entre chamadas produto.obter*
const PAUSA_ENTRE_CICLOS_MIN = 30
const FANTASMAS_INTERVALO_H = 24

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
      const imagens = extrairImagensTiny(detalhe)
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

// ─── JOB 3: fantasmas — produtos do banco que sumiram da listagem do Tiny ───
async function jobFantasmas() {
  const skusTiny = new Set()
  const idsTiny = new Set()
  let pagina = 1
  let totalPaginas = 1
  while (pagina <= totalPaginas) {
    const data = await tinyFetch('produtos.pesquisa.php', { pagina, situacao: 'A' }, 400)
    const produtos = (data.retorno?.produtos ?? []).map((x) => x.produto ?? x)
    totalPaginas = Number(data.retorno?.numero_paginas ?? data.retorno?.paginas ?? 1)
    for (const p of produtos) {
      if (p.codigo) skusTiny.add(String(p.codigo).trim())
      if (p.id) idsTiny.add(String(p.id).trim())
    }
    pagina++
  }
  if (skusTiny.size === 0 && idsTiny.size === 0) {
    log('[fantasmas] listagem do Tiny veio vazia — abortando por segurança')
    return { desativados: 0 }
  }

  const todos = await prisma.product.findMany({
    where: { tinyId: { not: null }, ativo: true },
    select: { id: true, sku: true, tinyId: true },
  })
  const fantasmas = todos.filter(
    (p) => !skusTiny.has((p.sku ?? '').trim()) && !idsTiny.has((p.tinyId ?? '').trim())
  )
  // Trava de segurança: se >30% do catálogo "sumiu", algo está errado na listagem
  if (fantasmas.length > todos.length * 0.3) {
    log(`[fantasmas] ${fantasmas.length}/${todos.length} candidatos (>30%) — abortando por segurança`)
    return { desativados: 0, suspeito: fantasmas.length }
  }
  for (const f of fantasmas) {
    await prisma.product.update({ where: { id: f.id }, data: { ativo: false, estoque: 0 } })
    log(`[fantasmas] desativado: ${f.sku} (tinyId ${f.tinyId})`)
  }
  log(`[fantasmas] varredura completa: ${todos.length} ativos no banco, ${skusTiny.size} SKUs no Tiny, ${fantasmas.length} desativados`)
  return { desativados: fantasmas.length }
}

// ─── Loop principal ─────────────────────────────────────────────────────────
async function main() {
  log('═══ Forza Sync Worker iniciado ═══')
  let ultimaFantasmas = 0
  for (;;) {
    try {
      if (Date.now() - ultimaFantasmas > FANTASMAS_INTERVALO_H * 3600_000) {
        await jobFantasmas()
        ultimaFantasmas = Date.now()
      }
      await jobImagens()   // primeiro: destrava os 92 invisíveis só por imagem
      await jobEstoque()   // depois: converge estoque do catálogo inteiro
    } catch (e) {
      log('[main] erro no ciclo:', e.message, '— aguardando 10min')
      await sleep(600_000)
    }
    log(`[main] ciclo completo — pausa de ${PAUSA_ENTRE_CICLOS_MIN}min`)
    await sleep(PAUSA_ENTRE_CICLOS_MIN * 60_000)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
