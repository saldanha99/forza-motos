export interface OpcaoFrete {
  codigo: string
  servico: string
  valor: number
  prazo: number
}

// Cálculo de frete via Correios (fallback com tabela local se API offline)
export async function calcularFrete(
  cepDestino: string,
  peso: number = 1,
  valor: number = 0
): Promise<OpcaoFrete[]> {
  try {
    const url = `https://viacep.com.br/ws/${cepDestino.replace(/\D/g, '')}/json/`
    const r = await fetch(url)
    const data = await r.json()
    if (data.erro) throw new Error('CEP inválido')

    // Tabela simplificada enquanto API Correios não está configurada
    const pacPrazo = 8
    const sedexPrazo = 3

    const distancia = calcularDistanciaRegiao(data.uf)

    return [
      {
        codigo: '04510',
        servico: 'PAC',
        valor: calcularValorPAC(peso, distancia, valor),
        prazo: pacPrazo + distancia,
      },
      {
        codigo: '04014',
        servico: 'SEDEX',
        valor: calcularValorSEDEX(peso, distancia, valor),
        prazo: sedexPrazo + Math.floor(distancia / 2),
      },
    ]
  } catch {
    return [
      { codigo: '04510', servico: 'PAC', valor: 18.9, prazo: 12 },
      { codigo: '04014', servico: 'SEDEX', valor: 35.9, prazo: 5 },
    ]
  }
}

function calcularDistanciaRegiao(uf: string): number {
  const regioes: Record<string, number> = {
    SP: 0, RJ: 1, MG: 1, ES: 1,
    PR: 2, SC: 2, RS: 2,
    GO: 2, DF: 2, MS: 2, MT: 3,
    BA: 3, SE: 3, AL: 3, PE: 3, PB: 3, RN: 3, CE: 3, PI: 4, MA: 4,
    PA: 4, AM: 5, RO: 5, AC: 5, RR: 6, AP: 5, TO: 4,
  }
  return regioes[uf] ?? 3
}

function calcularValorPAC(peso: number, distancia: number, valor: number): number {
  const base = 15 + distancia * 3 + peso * 2
  const seguro = valor * 0.002
  return Math.round((base + seguro) * 100) / 100
}

function calcularValorSEDEX(peso: number, distancia: number, valor: number): number {
  const base = 28 + distancia * 5 + peso * 3.5
  const seguro = valor * 0.003
  return Math.round((base + seguro) * 100) / 100
}
