/**
 * Interpretação dos formatos reais enviados pela Olist/Tiny.
 *
 * Esta parte é deliberadamente pura: os fixtures capturados em produção podem
 * ser testados sem banco, credenciais ou chamadas externas.
 */

export type StatusPedidoInterno =
  | 'AGUARDANDO_PAGAMENTO'
  | 'CONFIRMADO'
  | 'SEPARANDO'
  | 'ENVIADO'
  | 'ENTREGUE'
  | 'CANCELADO'

export type EventoLogisticaOlist =
  | {
      tipo: 'nota_fiscal'
      idNotaFiscal: string
      chaveAcesso: string | null
    }
  | {
      tipo: 'atualizacao_pedido'
      olistOrderId: string
      situacao: string
      statusInterno: StatusPedidoInterno | null
      idNotaFiscal: string | null
    }

export interface NotaFiscalOlist {
  id: string
  idVenda: string
  numeroEcommerce: string | null
  chaveAcesso: string
  valorNota: number | null
  situacao: string
  autorizada: boolean
}

export interface PedidoOlistFiscal {
  id: string
  idNotaFiscal: string | null
  situacao: string
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : null
}

function texto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor).trim()
}

function idValido(valor: unknown): string | null {
  const id = texto(valor)
  return id && id !== '0' ? id : null
}

export function normalizarSituacaoOlist(valor: unknown): string {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function statusInternoDaSituacaoOlist(valor: unknown): StatusPedidoInterno | null {
  const situacao = normalizarSituacaoOlist(valor)
  const mapa: Record<string, StatusPedidoInterno> = {
    'em aberto': 'AGUARDANDO_PAGAMENTO',
    new: 'CONFIRMADO',
    novo: 'CONFIRMADO',
    approved: 'CONFIRMADO',
    aprovado: 'CONFIRMADO',
    invoiced: 'SEPARANDO',
    faturado: 'SEPARANDO',
    'preparando envio': 'SEPARANDO',
    'em separacao': 'SEPARANDO',
    'pronto para envio': 'SEPARANDO',
    shipped: 'ENVIADO',
    enviado: 'ENVIADO',
    delivered: 'ENTREGUE',
    entregue: 'ENTREGUE',
    canceled: 'CANCELADO',
    cancelled: 'CANCELADO',
    cancelado: 'CANCELADO',
    devolvido: 'CANCELADO',
  }
  return mapa[situacao] ?? null
}

/** Reconhece, entre outros, os payloads `atualizacao_pedido` e `nota_fiscal`. */
export function interpretarEventoLogisticaOlist(body: unknown): EventoLogisticaOlist | null {
  const raiz = objeto(body)
  if (!raiz) return null

  const dados = objeto(raiz.dados) ?? objeto(raiz.data) ?? raiz
  const tipo = normalizarSituacaoOlist(raiz.tipo)
  const evento = normalizarSituacaoOlist(raiz.evento ?? raiz.event)

  if (tipo === 'nota fiscal') {
    const idNotaFiscal = idValido(
      dados.idNotaFiscalTiny ?? dados.idNotaFiscal ?? dados.id_nota_fiscal ?? dados.id,
    )
    if (!idNotaFiscal) return null
    return {
      tipo: 'nota_fiscal',
      idNotaFiscal,
      chaveAcesso: texto(dados.chaveAcesso ?? dados.chave_acesso) || null,
    }
  }

  const atualizacaoPedido =
    tipo === 'atualizacao pedido' ||
    tipo === 'pedido' ||
    evento === 'order.updated' ||
    evento === 'pedido.atualizado'
  if (!atualizacaoPedido) return null

  const olistOrderId = idValido(dados.id ?? dados.idPedido ?? dados.id_pedido)
  if (!olistOrderId) return null
  const situacao = texto(
    dados.codigoSituacao ?? dados.descricaoSituacao ?? dados.situacao ?? dados.status,
  )
  return {
    tipo: 'atualizacao_pedido',
    olistOrderId,
    situacao,
    statusInterno: statusInternoDaSituacaoOlist(situacao),
    idNotaFiscal: idValido(
      dados.idNotaFiscal ?? dados.id_nota_fiscal ?? dados.idNotaFiscalTiny,
    ),
  }
}

function numeroMonetario(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const original = texto(valor)
  if (!original) return null
  const normalizado = original.includes(',')
    ? original.replace(/\./g, '').replace(',', '.')
    : original
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : null
}

/** Interpreta `nota.fiscal.obter.php`, cuja situação 6 significa autorizada. */
export function interpretarNotaFiscalOlist(resposta: unknown): NotaFiscalOlist | null {
  const raiz = objeto(resposta)
  const retorno = objeto(raiz?.retorno) ?? raiz
  const nota = objeto(retorno?.nota_fiscal) ?? objeto(retorno?.notaFiscal) ?? retorno
  if (!nota) return null

  const id = idValido(nota.id ?? nota.idNotaFiscal ?? nota.id_nota_fiscal)
  const idVenda = idValido(nota.id_venda ?? nota.idVenda ?? nota.id_pedido ?? nota.idPedido)
  const chaveAcesso = texto(nota.chave_acesso ?? nota.chaveAcesso)
  if (!id || !idVenda || !chaveAcesso) return null

  const situacao = texto(nota.situacao ?? nota.status)
  const situacaoNormalizada = normalizarSituacaoOlist(situacao)
  return {
    id,
    idVenda,
    numeroEcommerce: texto(
      nota.numero_ecommerce ?? nota.numeroEcommerce ?? nota.numero_pedido_ecommerce,
    ) || null,
    chaveAcesso,
    valorNota: numeroMonetario(nota.valor_nota ?? nota.valorNota ?? nota.valor),
    situacao,
    autorizada: situacaoNormalizada === '6' ||
      situacaoNormalizada === 'autorizada' ||
      situacaoNormalizada === 'autorizado',
  }
}

/** Interpreta `pedido.obter.php` para a reconciliação de segurança. */
export function interpretarPedidoOlistFiscal(resposta: unknown): PedidoOlistFiscal | null {
  const raiz = objeto(resposta)
  const retorno = objeto(raiz?.retorno) ?? raiz
  const pedido = objeto(retorno?.pedido) ?? retorno
  if (!pedido) return null

  const id = idValido(pedido.id ?? pedido.idPedido ?? pedido.id_pedido)
  if (!id) return null
  return {
    id,
    idNotaFiscal: idValido(
      pedido.id_nota_fiscal ?? pedido.idNotaFiscal ?? pedido.idNotaFiscalTiny,
    ),
    situacao: texto(pedido.situacao ?? pedido.status),
  }
}
