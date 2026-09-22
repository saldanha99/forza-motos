import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { criarPedidoSeguro, PedidoPagamentoIncertoError } from '@/lib/checkout/pedido'

export async function POST(req: Request) {
  try {
    const tamanho = Number(req.headers.get('content-length') ?? 0)
    if (Number.isFinite(tamanho) && tamanho > 32 * 1024) {
      return NextResponse.json({ error: 'Dados do checkout excedem o limite permitido.' }, { status: 413 })
    }
    const [session, body] = await Promise.all([getServerSession(authOptions), req.json()])
    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim().toLowerCase()
    const bodyKey = typeof body?.checkoutTentativaId === 'string'
      ? body.checkoutTentativaId.trim().toLowerCase()
      : null
    if (!idempotencyKey || idempotencyKey !== bodyKey) {
      return NextResponse.json(
        { error: 'Tentativa de checkout inválida. Atualize a página e tente novamente.' },
        { status: 400 },
      )
    }
    body.checkoutTentativaId = idempotencyKey
    const { pedido, init_point } = await criarPedidoSeguro(body, session)
    return NextResponse.json({ id: pedido.id, orderNumber: pedido.orderNumber, init_point }, { status: 201 })
  } catch (e: any) {
    if (e instanceof PedidoPagamentoIncertoError) {
      return NextResponse.json({
        id: e.pedido.id,
        orderNumber: e.pedido.orderNumber,
        pagamentoPendente: true,
        message: 'A comunicação com o Mercado Pago está sendo reconciliada automaticamente. Não refaça o pedido: se o pagamento não for concluído, a reserva é liberada sozinha e você pode comprar de novo. Acompanhe pelo número informado.',
      }, { status: 202 })
    }
    const code = e?.message ?? ''
    const messages: Record<string, string> = {
      CARRINHO_VAZIO: 'Carrinho vazio. Adicione produtos antes de prosseguir.', QUANTIDADE_INVALIDA: 'Quantidade inválida.',
      PRODUTO_INVALIDO: 'Um ou mais produtos não estão disponíveis.', CPF_INVALIDO: 'CPF inválido.', CEP_INVALIDO: 'CEP inválido.',
      EMAIL_INVALIDO: 'E-mail inválido.', TELEFONE_INVALIDO: 'Telefone inválido.', ENDERECO_INVALIDO: 'Endereço inválido ou incompleto.',
      FRETE_INVALIDO: 'Escolha novamente uma opção de frete válida.', ESTOQUE_INSUFICIENTE: 'Produto sem estoque suficiente.',
      CARRINHO_EVENTO_MISTO: 'Os produtos exclusivos do evento devem ser comprados separadamente dos produtos do catálogo normal.',
      CARRINHO_EVENTO_ATUALIZADO: 'A campanha deste produto foi atualizada. Volte à página do evento e refaça o carrinho.',
      CARRINHO_PRECO_ATUALIZADO: 'O preço de um produto foi atualizado. Revise o carrinho e confirme a compra novamente.',
      EVENTO_PIRELLI_INDISPONIVEL: 'As vendas desta campanha não estão disponíveis no momento.',
      EVENTO_PIRELLI_FORA_DA_JANELA: 'A janela de vendas desta campanha ainda não começou ou já terminou.',
      WHATSAPP_EVENTO_PIRELLI_OBRIGATORIO: 'Informe um WhatsApp válido nos dados finais da compra.',
      PRODUTO_EVENTO_INVALIDO: 'Um produto da campanha está com a configuração de pré-venda incompleta.',
      LIMITE_PRODUTO_EVENTO_EXCEDIDO: 'A quantidade escolhida excede o limite por pedido desta oferta.',
      CUPOM_EVENTO_NAO_PERMITIDO: 'As ofertas exclusivas do evento não acumulam com cupons.',
      NOME_GRAVACAO_EVENTO_INVALIDO: 'Informe um nome válido para gravar na caneca conquistada nesta compra.',
      FORMA_PAGAMENTO_INVALIDA: 'Escolha novamente uma forma de pagamento válida.',
      PAGAMENTO_INDISPONIVEL: 'Não foi possível iniciar o pagamento. Estoque e cupom foram liberados; tente novamente mais tarde.',
      TENTATIVA_INVALIDA: 'Tentativa de checkout inválida.',
      TENTATIVA_ENCERRADA: 'Esta tentativa de checkout já foi encerrada. Inicie uma nova tentativa.',
    }
    const retrySafe = code === 'PAGAMENTO_INDISPONIVEL' || code === 'TENTATIVA_ENCERRADA'
    return NextResponse.json({ error: messages[code] ?? (code.startsWith('CUPOM:') ? code.slice(6) : 'Erro ao criar pedido. Verifique em Minha Conta antes de tentar novamente.'), retrySafe }, { status: code === 'PAGAMENTO_INDISPONIVEL' ? 502 : 400 })
  }
}
