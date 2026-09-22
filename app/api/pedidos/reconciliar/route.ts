/**
 * GET /api/pedidos/reconciliar — converge o checkout.
 *
 * Faz o que nenhuma requisição de usuário consegue fazer sozinha:
 *   - fecha pedidos cujo resultado de pagamento ficou incerto;
 *   - devolve estoque e cupom de reservas vencidas;
 *   - insiste nos estornos pendentes até resultado conclusivo.
 *   - confirma postagem e entrega do Melhor Envio mesmo se o webhook falhar.
 *
 * Agendar a cada 5 minutos:
 *   curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.forzamotos.com.br/api/pedidos/reconciliar
 */

import { NextResponse } from 'next/server'
import { reconciliarCheckout } from '@/lib/checkout/reconciliacao'
import { reconciliarStatusEnviosMelhorEnvio } from '@/lib/frete/reconciliacao-status'
import { repararNotificacoesEtapasPedidos } from '@/lib/checkout/notificacoes-etapas-pedido'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  // Fail-closed: sem CRON_SECRET configurado, endpoint fica bloqueado
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [resumo, envios, notificacoesEtapas] = await Promise.all([
      reconciliarCheckout(),
      reconciliarStatusEnviosMelhorEnvio(),
      repararNotificacoesEtapasPedidos(),
    ])
    console.log(
      `[pedidos/reconciliar] analisados=${resumo.analisados} reconciliados=${resumo.reconciliados} ` +
        `confirmados=${resumo.confirmados} expirados=${resumo.expirados} indeterminados=${resumo.indeterminados} ` +
        `notificacoesReparadas=${resumo.notificacoesReparadas} ` +
        `estornos=${JSON.stringify(resumo.estornos)} envios=${JSON.stringify(envios)} ` +
        `notificacoesEtapas=${JSON.stringify(notificacoesEtapas)}`,
    )
    return NextResponse.json({ ok: true, ...resumo, envios, notificacoesEtapas })
  } catch (e) {
    console.error('[pedidos/reconciliar]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'falha na reconciliação' },
      { status: 500 },
    )
  }
}
