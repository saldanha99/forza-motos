/**
 * Debug: testa acesso às imagens via Olist ERP API
 * GET /api/admin/debug-olist-imagem
 *
 * Testa:
 * 1. Se o download da imagem funciona com o OLIST_TOKEN
 * 2. Se a API do Olist ERP retorna produtos com idAnexo
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const maxDuration = 30

const ID_ANEXO_TESTE = '884630617'
const NOME_ANEXO_TESTE = 'PAR_TOURANCE.jpg'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const token = process.env.OLIST_TOKEN || ''
  const results: Record<string, any> = { token_presente: !!token }

  // ─── Teste 1: Download direto do anexo com OLIST_TOKEN ───────────────────
  const urlDownload = `https://erp.olist.com/download?idAnexo=${ID_ANEXO_TESTE}&nomeAnexo=${NOME_ANEXO_TESTE}`

  // Tenta sem auth
  try {
    const r = await fetch(urlDownload, { method: 'HEAD', redirect: 'follow' })
    results.download_sem_auth = { status: r.status, ok: r.ok, contentType: r.headers.get('content-type') }
  } catch (e: any) {
    results.download_sem_auth = { error: e.message }
  }

  // Tenta com token como query param
  try {
    const r = await fetch(`${urlDownload}&token=${token}`, { method: 'HEAD', redirect: 'follow' })
    results.download_com_token_query = { status: r.status, ok: r.ok, contentType: r.headers.get('content-type') }
  } catch (e: any) {
    results.download_com_token_query = { error: e.message }
  }

  // Tenta com Authorization Bearer
  try {
    const r = await fetch(urlDownload, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { Authorization: `Bearer ${token}` },
    })
    results.download_com_bearer = { status: r.status, ok: r.ok, contentType: r.headers.get('content-type') }
  } catch (e: any) {
    results.download_com_bearer = { error: e.message }
  }

  // ─── Teste 2: API Olist ERP v1 ───────────────────────────────────────────
  const endpoints = [
    `https://erp.olist.com/api/v1/produtos?token=${token}&pagina=1`,
    `https://erp.olist.com/api/v2/produtos?token=${token}&pagina=1`,
  ]

  for (const url of endpoints) {
    const key = url.includes('v2') ? 'olist_erp_api_v2' : 'olist_erp_api_v1'
    try {
      const r = await fetch(url)
      const body = await r.text()
      results[key] = {
        status: r.status,
        bodySlice: body.slice(0, 300),
      }
    } catch (e: any) {
      results[key] = { error: e.message }
    }
  }

  // ─── Teste 3: Tiny API com produto.obter.php para o produto PAR TOURANCE ─
  // Busca direto no Tiny pelo nome para confirmar se a imagem aparece lá
  try {
    const body = new URLSearchParams({
      token,
      formato: 'JSON',
      pesquisa: 'PAR PNEUS METZELER TOURANCE',
      situacao: 'A',
      pagina: '1',
    })
    const r = await fetch('https://api.tiny.com.br/api2/produtos.pesquisa.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await r.json()
    const produtos = data.retorno?.produtos ?? []
    results.tiny_busca_par_tourance = {
      totalEncontrados: produtos.length,
      primeiros: produtos.slice(0, 3).map((p: any) => ({
        id: p.produto?.id,
        nome: p.produto?.nome,
        codigo: p.produto?.codigo,
      })),
    }
  } catch (e: any) {
    results.tiny_busca_par_tourance = { error: e.message }
  }

  return NextResponse.json(results, { status: 200 })
}
