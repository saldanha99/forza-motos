/**
 * POST /api/crm/lead
 * Captura lead (nome + whatsapp) e enfileira mensagem de boas-vindas
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enfileirarMensagem } from '@/lib/evolution/queue'
import { normalizarWhatsApp } from '@/lib/evolution/client'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { nome, whatsapp, origem = 'POPUP', produtoSlug, utmSource, utmMedium, utmCampaign } = body

    if (!nome?.trim() || !whatsapp?.trim()) {
      return NextResponse.json({ error: 'Nome e WhatsApp são obrigatórios' }, { status: 400 })
    }

    const wa = normalizarWhatsApp(whatsapp)
    if (wa.length < 12) {
      return NextResponse.json({ error: 'WhatsApp inválido' }, { status: 400 })
    }

    // Evita duplicatas — se já existe lead com esse número, atualiza etapa
    const existente = await prisma.crmLead.findFirst({ where: { whatsapp: wa } })

    let lead
    if (existente) {
      lead = existente
      // Não envia boas-vindas de novo para o mesmo número
    } else {
      lead = await prisma.crmLead.create({
        data: {
          nome:        nome.trim(),
          whatsapp:    wa,
          origem,
          produtoSlug,
          utmSource,
          utmMedium,
          utmCampaign,
          etapa:       'NOVO',
        },
      })

      // Enfileira boas-vindas (delay de 30s para parecer natural)
      await enfileirarMensagem({
        whatsapp:    wa,
        nome:        nome.trim(),
        tipo:        'BOAS_VINDAS',
        leadId:      lead.id,
        agendadoPara: new Date(Date.now() + 30_000),
      })
    }

    return NextResponse.json({ ok: true, leadId: lead.id })
  } catch (e: any) {
    console.error('[crm/lead]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
