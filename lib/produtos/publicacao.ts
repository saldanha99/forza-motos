type EstadoPublicacaoProduto = {
  ativoSolicitado: boolean
  temImagem: boolean
  estoque: number
  preVenda: boolean
}

/**
 * Traduz a escolha do painel (visível ou oculto) para os dois campos legados
 * usados pelo catálogo. Um pedido de publicação também remove o bloqueio
 * manual; foto e disponibilidade continuam sendo requisitos independentes.
 */
export function resolverPublicacaoProduto({
  ativoSolicitado,
  temImagem,
  estoque,
  preVenda,
}: EstadoPublicacaoProduto) {
  return {
    ativo: ativoSolicitado && temImagem && (preVenda || estoque > 0),
    ocultoManual: !ativoSolicitado,
  }
}
