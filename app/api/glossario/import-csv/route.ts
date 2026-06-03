import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertLicense, LicenseError } from '@/lib/license'
import { importarCSVParaFila } from '@/lib/glossario/csv-import'

/**
 * POST /api/glossario/import-csv
 *
 * FormData multipart:
 *   - csv: File  (titulo,letra,categoria)
 *   - nicho: string
 *   - provider: 'AI_GEMINI' | 'AI_OPENAI'
 *   - modelo: string
 *   - agendamento: 'imediato' | 'diario' | 'semanal'
 *   - promptExtra: string (opcional)
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Trava de licenca 2time SEO
  try {
    await assertLicense(req.headers.get('host'))
  } catch (e) {
    if (e instanceof LicenseError) return NextResponse.json({ error: e.message }, { status: 403 })
    throw e
  }

  const form = await req.formData()
  const file = form.get('csv') as File | null
  const nicho = form.get('nicho') as string | null
  const modelo = form.get('modelo') as string | null
  const provider = (form.get('provider') as 'AI_GEMINI' | 'AI_OPENAI') || 'AI_GEMINI'
  const agendamento =
    (form.get('agendamento') as 'imediato' | 'diario' | 'semanal') || 'imediato'
  const promptExtra = (form.get('promptExtra') as string) || undefined

  if (!file || !nicho || !modelo) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: csv, nicho, modelo' },
      { status: 400 }
    )
  }

  try {
    const csv = await file.text()
    const resultado = await importarCSVParaFila(csv, {
      nicho,
      provider,
      modelo,
      agendamento,
      promptExtra,
    })
    return NextResponse.json({ enfileirados: resultado.count })
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    )
  }
}
