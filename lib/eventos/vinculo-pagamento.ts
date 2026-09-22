import {
  consultarPreferenciaMP,
  validarPagamentoDoPedido,
  type PagamentoMPNormalizado,
} from '@/lib/checkout/mercadopago-webhook'

export interface InscricaoEventoParaVinculo {
  id: string
  total: unknown
  mpPreferenciaId: string | null
}

/**
 * Correlaciona um pagamento oficial à preferência persistida da inscrição.
 *
 * O Checkout Pro pode omitir `preference_id` no pagamento e negar a consulta
 * da merchant order. Nesse caso só aceitamos o vínculo depois de consultar a
 * preferência persistida e cruzar referência, recebedor, moeda e valor. Isso
 * mantém o fallback fail-closed e evita reconhecer um pagamento avulso apenas
 * porque referência e valor coincidem.
 */
export async function vincularPagamentoEvento(
  inscricao: InscricaoEventoParaVinculo,
  payment: PagamentoMPNormalizado,
  deps: { consultarPreferencia?: typeof consultarPreferenciaMP } = {},
): Promise<PagamentoMPNormalizado> {
  const { preferenceId } = await validarPagamentoDoPedido({
    orderId: `evento_${inscricao.id}`,
    total: Number(inscricao.total),
    preferenceId: inscricao.mpPreferenciaId,
    payment,
  }, deps)

  return payment.preference_id === preferenceId
    ? payment
    : { ...payment, preference_id: preferenceId }
}
