/**
 * One-shot: classifica o fornecedor de cada produto ativo e remove Eurolaqui.
 * Popula Product.fornecedor + aplica a regra (Eurolaqui → estoque 0/desativado,
 * exceto mantidoManual). Roda uma vez, em background, pra não esperar o ciclo
 * completo do worker. Processa categorias de vestuário (Eurolaqui) primeiro.
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const BASE_URL = 'https://api.tiny.com.br/api2'
const DROPSHIP_OK = ['f_drop', 'fdrop']
const DROPSHIP_BLOQUEADO = ['eurolaqui']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString(), ...a)

async function tinyFetch(endpoint, params) {
  for (let t = 1; t <= 5; t++) {
    await sleep(1300)
    let res
    try {
      res = await fetch(`${BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: process.env.OLIST_TOKEN, formato: 'JSON', ...params }).toString(),
      })
    } catch { await sleep(15000 * t); continue }
    if (res.status === 429 || res.status >= 500) { await sleep(60000 * t); continue }
    const data = await res.json()
    if (data.retorno?.status === 'Erro') {
      const msg = data.retorno.erro || ''
      if (/bloqueada|muitas requisi/i.test(msg)) { await sleep(90000 * t); continue }
      const e = new Error(msg); e.tinyMsg = msg; throw e
    }
    return data
  }
  throw new Error('Tiny: tentativas esgotadas')
}

function classificar(lista) {
  let saldoLoja = 0, saldoOutros = 0, temEurolaqui = false
  const temDropshipOk = lista.some((item) => {
    const nome = ((item.deposito ?? item).nome ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return DROPSHIP_OK.some((d) => nome.includes(d))
  })
  for (const item of lista) {
    const dep = item.deposito ?? item
    const nome = (dep.nome ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const saldo = Number(dep.saldo ?? dep.quantidade ?? 0)
    if (DROPSHIP_BLOQUEADO.some((d) => nome.includes(d))) { if (saldo > 0) temEurolaqui = true; continue }
    if (nome === 'loja') { saldoLoja += saldo; continue }
    if (DROPSHIP_OK.some((d) => nome.includes(d))) continue
    saldoOutros += saldo
  }
  if (saldoLoja > 0) return { estoque: saldoLoja, fornecedor: 'loja' }
  if (temDropshipOk) return { estoque: 999, fornecedor: 'f_drop' }
  if (saldoOutros > 0) return { estoque: saldoOutros, fornecedor: 'outro' }
  if (temEurolaqui) return { estoque: 0, fornecedor: 'eurolaqui' }
  return { estoque: 0, fornecedor: 'outro' }
}

async function main() {
  // Vestuário (Eurolaqui confirmado) primeiro; depois o resto do catálogo
  const produtos = await prisma.product.findMany({
    where: { tinyId: { not: null }, ehPai: false, fornecedor: null },
    select: { id: true, tinyId: true, sku: true, categoria: true, temImagem: true, mantidoManual: true },
  })
  const peso = (c) => (/jaqueta|luva|calc|macac|capacete/i.test(c ?? '') ? 0 : 1)
  produtos.sort((a, b) => peso(a.categoria) - peso(b.categoria))

  log(`${produtos.length} produtos para classificar`)
  let ok = 0, euro = 0, erros = 0
  for (const p of produtos) {
    try {
      const data = await tinyFetch('produto.obter.estoque.php', { id: String(p.tinyId) })
      const raw = data.retorno?.produto?.depositos ?? []
      const lista = Array.isArray(raw) ? raw : raw.deposito ? [raw.deposito].flat() : []
      const { estoque: base, fornecedor } = classificar(lista)
      const novo = fornecedor === 'eurolaqui' && p.mantidoManual ? 999 : base
      if (fornecedor === 'eurolaqui') euro++
      await prisma.product.update({
        where: { id: p.id },
        data: { fornecedor, estoque: novo, ativo: p.temImagem && novo > 0 },
      })
      ok++
      if (ok % 100 === 0) log(`progresso: ${ok}/${produtos.length} · eurolaqui até agora: ${euro}`)
    } catch (e) {
      if (/localizado|encontrado|inválido/i.test(e.tinyMsg ?? '')) {
        await prisma.product.update({ where: { id: p.id }, data: { ativo: false, estoque: 0, fornecedor: 'inexistente' } }).catch(() => {})
      } else { erros++; log(`erro ${p.sku}:`, e.message) }
    }
  }
  log(`FIM: ${ok} classificados, ${euro} Eurolaqui removidos, ${erros} erros`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
