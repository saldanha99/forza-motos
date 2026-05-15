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

  // ─── Teste 1: GET real no download para ver o content-type e se é imagem ──
  const urlDownload = `https://erp.olist.com/download?idAnexo=${ID_ANEXO_TESTE}&nomeAnexo=${NOME_ANEXO_TESTE}`
  try {
    const r = await fetch(urlDownload, { redirect: 'follow' })
    const contentType = r.headers.get('content-type') ?? ''
    const isImage = contentType.startsWith('image/')
    results.download_get = {
      status: r.status,
      ok: r.ok,
      contentType,
      isImage,
      finalUrl: r.url,
      // Se for imagem, pega os primeiros bytes para confirmar
      preview: isImage ? 'É uma imagem! URL direta funciona.' : (await r.text()).slice(0, 200),
    }
  } catch (e: any) {
    results.download_get = { error: e.message }
  }

  // ─── Teste 2: produto.obter.php do PAR TOURANCE (id=884628311) ───────────
  // Esse produto foi encontrado no Tiny com foto no Olist
  try {
    const body = new URLSearchParams({ token, formato: 'JSON', id: '884628311' })
    const r = await fetch('https://api.tiny.com.br/api2/produto.obter.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await r.json()
    const produto = data.retorno?.produto ?? null
    results.tiny_par_tourance = {
      nome: produto?.nome,
      anexos: produto?.anexos,
      imagens_externas: produto?.imagens_externas,
      fotos: produto?.fotos,
      // Todos os campos de imagem possíveis
      todosOsCampos: produto ? Object.keys(produto) : [],
    }
  } catch (e: any) {
    results.tiny_par_tourance = { error: e.message }
  }

  // ─── Teste 3: Construir URL da imagem a partir do anexo ─────────────────
  // Se o produto.obter.php retornar idAnexo no campo anexos, a URL fica:
  // erp.olist.com/download?idAnexo={id}&nomeAnexo={nome}
  // Este teste confirma se a URL é pública ou precisa de auth
  results.url_formula = `https://erp.olist.com/download?idAnexo={idAnexo}&nomeAnexo={nomeAnexo}`

  return NextResponse.json(results, { status: 200 })
}
