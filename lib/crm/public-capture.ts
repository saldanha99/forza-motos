import { NextResponse } from 'next/server'
import { capturarLead } from '@/lib/crm/leads'
import { normalizarWhatsApp } from '@/lib/evolution/client'
import { consumirRateLimitCaptura } from '@/lib/crm/rate-limit'

type Capturar = (params: Parameters<typeof capturarLead>[0]) => Promise<{ lead: { id: string }; criado: boolean }>

/** Dependências opcionais permitem validar a rota sem criar fila externa. */
export async function processarCapturaLead(
  req: Request,
  deps: { capturar?: Capturar; limitar?: typeof consumirRateLimitCaptura } = {},
) {
  const capturar = deps.capturar ?? capturarLead
  const limitar = deps.limitar ?? consumirRateLimitCaptura

  try {
    if (!(await limitar(req))) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um instante.' }, { status: 429 })
    }

    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    // Contrato público mínimo: a origem nunca vem do cliente. Campos internos
    // como etapa, notas e origem são deliberadamente ignorados.
    const { nome, whatsapp, produtoSlug, utmSource, utmMedium, utmCampaign, consentimentoMarketing } = body

    if (!nome?.trim() || !whatsapp?.trim()) {
      return NextResponse.json({ error: 'Nome e WhatsApp são obrigatórios' }, { status: 400 })
    }

    // Normaliza (55 + DDD + número) antes de validar — o popup envia 10/11
    // dígitos sem DDI, e exigir 12 antes de normalizar rejeitava todo mundo.
    const numero = normalizarWhatsApp(String(whatsapp))
    if (numero.length < 12 || numero.length > 13) {
      return NextResponse.json({ error: 'WhatsApp inválido' }, { status: 400 })
    }

    const consentimentoMarketingEm = consentimentoMarketing === true ? new Date() : undefined

    const { lead, criado } = await capturar({
      nome: String(nome),
      whatsapp: String(whatsapp),
      origem: 'POPUP',
      produtoSlug: typeof produtoSlug === 'string' ? produtoSlug : undefined,
      utmSource: typeof utmSource === 'string' ? utmSource : undefined,
      utmMedium: typeof utmMedium === 'string' ? utmMedium : undefined,
      utmCampaign: typeof utmCampaign === 'string' ? utmCampaign : undefined,
      ...(consentimentoMarketingEm ? { consentimentoMarketingEm } : {}),
    })
    return NextResponse.json({ ok: true, leadId: lead.id, criado, consentimentoRegistrado: Boolean(consentimentoMarketingEm) })
  } catch (e: any) {
    console.error('[crm/lead]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
