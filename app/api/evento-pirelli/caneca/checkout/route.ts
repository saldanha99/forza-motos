import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  checkoutCanecaEventoSchema,
  CheckoutCanecaEventoError,
  CheckoutCanecaPagamentoIncertoError,
  criarCheckoutCanecaEvento,
} from '@/lib/checkout/caneca-evento-pirelli'

export const dynamic = 'force-dynamic'

const MAX_PAYLOAD_BYTES = 8 * 1024
const SEM_CACHE = { 'Cache-Control': 'no-store, max-age=0' }

async function lerJsonEstrito(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new CheckoutCanecaEventoError('FORMATO_INVALIDO', 415)
  }
  const declarado = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declarado) && declarado > MAX_PAYLOAD_BYTES) {
    throw new CheckoutCanecaEventoError('PAYLOAD_MUITO_GRANDE', 413)
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).byteLength > MAX_PAYLOAD_BYTES) {
    throw new CheckoutCanecaEventoError('PAYLOAD_MUITO_GRANDE', 413)
  }
  try {
    return JSON.parse(texto) as unknown
  } catch {
    throw new CheckoutCanecaEventoError('DADOS_INVALIDOS', 400)
  }
}

export async function POST(request: Request) {
  try {
    const entrada = checkoutCanecaEventoSchema.parse(await lerJsonEstrito(request))
    const chaveHeader = request.headers.get('x-idempotency-key')?.trim().toLowerCase() ?? ''
    if (!chaveHeader || chaveHeader !== entrada.checkoutTentativaId) {
      throw new CheckoutCanecaEventoError('TENTATIVA_INVALIDA', 400)
    }

    const resultado = await criarCheckoutCanecaEvento(entrada)
    return NextResponse.json({
      id: resultado.pedido.id,
      orderNumber: resultado.pedido.orderNumber,
      init_point: resultado.init_point,
      retomado: resultado.retomado,
    }, {
      status: resultado.retomado ? 200 : 201,
      headers: SEM_CACHE,
    })
  } catch (error) {
    if (error instanceof CheckoutCanecaPagamentoIncertoError) {
      return NextResponse.json({
        id: error.pedido.id,
        orderNumber: error.pedido.orderNumber,
        pagamentoPendente: true,
        message: 'A comunicação com o Mercado Pago está sendo reconciliada. Não refaça a compra; acompanhe esta tentativa.',
      }, { status: 202, headers: SEM_CACHE })
    }
    if (error instanceof CheckoutCanecaEventoError) {
      const mensagens: Record<string, string> = {
        FORMATO_INVALIDO: 'Envie os dados no formato JSON.',
        PAYLOAD_MUITO_GRANDE: 'Os dados enviados excedem o limite permitido.',
        DADOS_INVALIDOS: 'Revise os dados da compra.',
        TENTATIVA_INVALIDA: 'Tentativa de checkout inválida. Atualize a página e tente novamente.',
        TENTATIVA_CONFLITANTE: 'Esta tentativa já pertence a outra compra. Atualize a página.',
        TENTATIVA_ENCERRADA: 'Esta tentativa de pagamento já foi encerrada. Consulte o status antes de iniciar outra.',
        QR_NAO_ENCONTRADO: 'Cadastro do evento não encontrado para este acesso.',
        VENDAS_FECHADAS: 'As vendas do evento não estão abertas neste momento.',
        CANECA_INDISPONIVEL: 'A caneca ainda não está disponível para compra.',
        NOME_GRAVACAO_INVALIDO: 'Informe um nome válido para gravar na caneca.',
        PAGAMENTO_INDISPONIVEL: 'Não foi possível iniciar o pagamento. Tente novamente em alguns instantes.',
      }
      return NextResponse.json({
        error: mensagens[error.code] ?? 'Não foi possível iniciar a compra.',
        retrySafe: error.retrySafe,
      }, { status: error.status, headers: SEM_CACHE })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: error.issues[0]?.message ?? 'Revise os dados da compra.',
      }, { status: 400, headers: SEM_CACHE })
    }
    console.error('[evento-pirelli/caneca/checkout]', error)
    return NextResponse.json({
      error: 'Não foi possível iniciar o pagamento agora. Consulte o status antes de tentar novamente.',
    }, { status: 500, headers: SEM_CACHE })
  }
}
