/**
 * GET  /api/admin/marketing — slots de banner + imagem atual de cada um
 * PUT  /api/admin/marketing — { chave, imagemUrl | null } (null restaura o padrão)
 *
 * O upload do arquivo em si é feito antes via POST /api/upload (pasta "banners"),
 * que devolve a URL usada aqui.
 */
import { NextResponse } from 'next/server'
import { exigirAcesso } from '@/lib/admin/acesso'
import { prisma } from '@/lib/prisma'
import { BANNER_SLOTS } from '@/lib/marketing'

export const dynamic = 'force-dynamic'


export async function GET() {
  if (!(await exigirAcesso('marketing'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const rows = await prisma.marketingBanner.findMany()
  const porChave = new Map(rows.map((r) => [r.chave, r]))

  const slots = BANNER_SLOTS.map((s) => ({
    ...s,
    imagemUrl: porChave.get(s.chave)?.imagemUrl ?? null,
    atualizadoEm: porChave.get(s.chave)?.updatedAt ?? null,
  }))

  return NextResponse.json({ slots })
}

export async function PUT(req: Request) {
  if (!(await exigirAcesso('marketing'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const chave = String(body.chave ?? '')
  const imagemUrl = body.imagemUrl === null ? null : String(body.imagemUrl ?? '')

  if (!BANNER_SLOTS.some((s) => s.chave === chave)) {
    return NextResponse.json({ error: 'Slot de banner desconhecido' }, { status: 400 })
  }
  // Só aceita URLs do nosso storage ou caminhos locais — evita apontar banner para site externo
  if (imagemUrl && !/^(\/|https:\/\/(www\.)?forzamotos\.com\.br\/)/.test(imagemUrl)) {
    return NextResponse.json({ error: 'URL de imagem inválida — use o upload do painel' }, { status: 400 })
  }

  const banner = await prisma.marketingBanner.upsert({
    where: { chave },
    update: { imagemUrl },
    create: { chave, imagemUrl },
  })

  return NextResponse.json({ ok: true, banner })
}
