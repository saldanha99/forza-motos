/**
 * Rede de segurança da automação fiscal/logística.
 *
 * Recupera webhooks perdidos e retenta preparos que falharam depois que a
 * chave já foi salva. Criar a remessa no carrinho não compra a etiqueta.
 */

import { NextResponse } from 'next/server'
import { reconciliarNfesEEnvios } from '@/lib/olist/nfe-envio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const resumo = await reconciliarNfesEEnvios(5)
    console.log(
      `[olist/reconciliar-nfe] analisados=${resumo.analisados} ` +
        `preparados=${resumo.preparados} jaPreparados=${resumo.jaPreparados} ` +
        `aguardandoNfe=${resumo.aguardandoNfe} ignorados=${resumo.ignorados} erros=${resumo.erros}`,
    )
    return NextResponse.json({ ok: true, ...resumo })
  } catch (erro) {
    console.error('[olist/reconciliar-nfe]', erro)
    return NextResponse.json(
      { error: erro instanceof Error ? erro.message : 'falha na reconciliação fiscal' },
      { status: 500 },
    )
  }
}
