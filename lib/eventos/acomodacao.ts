export interface OpcaoComRotulo {
  label: string
}

const ROTULO_ACOMODACAO = /\bquarto\b|hotel|hospedagem|acomoda[cç][aã]o/i
const ROTULO_COMPARTILHADO = /compartilh|\bdivid/i
const ROTULO_CASAL = /casal|dupl[oa]|2\s*(?:pessoas|participantes)|garupa|acompanhante/i

export function opcoesDefinemAcomodacao(opcoes: OpcaoComRotulo[]): boolean {
  return opcoes.length > 0 && opcoes.every((opcao) => ROTULO_ACOMODACAO.test(opcao.label))
}

export function opcaoAcomodacaoAceitaGarupa(label: string): boolean {
  return !ROTULO_COMPARTILHADO.test(label) && ROTULO_CASAL.test(label)
}

export function tipoAcomodacaoDaOpcao(label: string, temGarupa: boolean): string {
  if (temGarupa) return 'Quarto Casal'
  if (ROTULO_COMPARTILHADO.test(label)) return 'Quarto Compartilhado'
  return 'Quarto Single / Casal (Individual)'
}
