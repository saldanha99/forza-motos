/**
 * One-shot: re-verifica no Tiny TODOS os produtos com estoque=999 (o placeholder
 * "dropship" extinto em 09/07 — Caio: "tudo que tiver 999 tá errado") e grava
 * o saldo REAL somado dos depósitos (Eurolaqui ignorado). Sem 999 mágico.
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const BASE_URL = 'https://api.tiny.com.br/api2'
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
  let saldoLoja = 0, saldoFdrop = 0, saldoEuro = 0, saldoOutros = 0
  for (const item of lista) {
    const dep = item.deposito ?? item
    const nome = (dep.nome ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const saldo = Number(dep.saldo ?? dep.quantidade ?? 0)
    if (DROPSHIP_BLOQUEADO.some((d) => nome.includes(d))) { saldoEuro += saldo; continue }
    if (nome === 'loja') { saldoLoja += saldo; continue }
    if (nome.includes('drop')) { saldoFdrop += saldo; continue }
    saldoOutros += saldo
  }
  const total = Math.max(0, saldoLoja + saldoFdrop + saldoOutros)
  const fornecedor =
    saldoLoja > 0 ? 'loja' : saldoFdrop > 0 ? 'f_drop' : saldoEuro > 0 ? 'eurolaqui' : 'outro'
  return { estoque: fornecedor === 'eurolaqui' ? 0 : total, fornecedor }
}

async function main() {
  const produtos = await prisma.product.findMany({
    where: { estoque: 999, ehPai: false, tinyId: { not: null } },
    select: { id: true, tinyId: true, sku: true, temImagem: true, ativo: true, mantidoManual: true, ocultoManual: true },
    orderBy: { ativo: 'desc' }, // ativos primeiro (os que o cliente vê)
  })
  log(`${produtos.length} produtos com 999 para re-verificar`)

  let ok = 0, comEstoqueReal = 0, zerados = 0, erros = 0
  for (const p of produtos) {
    try {
      const data = await tinyFetch('produto.obter.estoque.php', { id: String(p.tinyId) })
      const raw = data.retorno?.produto?.depositos ?? []
      const lista = Array.isArray(raw) ? raw : raw.deposito ? [raw.deposito].flat() : []
      const { estoque: base, fornecedor } = classificar(lista)
      const novo = fornecedor === 'eurolaqui' && p.mantidoManual ? 10 : base
      if (novo > 0) comEstoqueReal++; else zerados++
      await prisma.product.update({
        where: { id: p.id },
        data: { estoque: novo, fornecedor, ativo: !p.ocultoManual && p.temImagem && novo > 0 },
      })
      ok++
      if (ok % 100 === 0) log(`progresso: ${ok}/${produtos.length} · com estoque real: ${comEstoqueReal} · zerados: ${zerados}`)
    } catch (e) {
      if (/localizado|encontrado|inválido/i.test(e.tinyMsg ?? '')) {
        await prisma.product.update({ where: { id: p.id }, data: { ativo: false, estoque: 0, fornecedor: 'inexistente' } }).catch(() => {})
        zerados++
      } else { erros++; log(`erro ${p.sku}:`, e.message) }
    }
  }
  log(`FIM: ${ok} verificados · ${comEstoqueReal} com estoque real · ${zerados} zerados/desativados · ${erros} erros`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
