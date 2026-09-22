export const STORAGE_EVENTO_PIRELLI = {
  cadastro: 'forza-evento-pirelli-cadastro-v2',
  chaveSubmissao: 'forza-evento-pirelli-submissao-v2',
  codigoQr: 'forza-evento-pirelli-qr-v2',
} as const

const STORAGE_EVENTO_PIRELLI_LEGADO = {
  cadastro: 'forza-evento-pirelli-cadastro-v1',
  chaveSubmissao: 'forza-evento-pirelli-submissao-v1',
  codigoQr: 'forza-evento-pirelli-qr-v1',
} as const

export type CadastroLocalEventoPirelli = {
  nomeCompleto?: string
  whatsapp?: string
  email?: string
  enderecoCep?: string
  enderecoRua?: string
  enderecoNumero?: string
  enderecoComplemento?: string
  enderecoBairro?: string
  enderecoCidade?: string
  enderecoEstado?: string
  motoMarca?: string
  motoModelo?: string
  motoAno?: string
  consentimentoMarketing?: boolean
}

type ArmazenamentoLocal = Pick<Storage, 'getItem' | 'setItem'>

const CAMPOS_TEXTO = [
  'nomeCompleto',
  'whatsapp',
  'email',
  'enderecoCep',
  'enderecoRua',
  'enderecoNumero',
  'enderecoComplemento',
  'enderecoBairro',
  'enderecoCidade',
  'enderecoEstado',
  'motoMarca',
  'motoModelo',
  'motoAno',
] as const satisfies ReadonlyArray<keyof CadastroLocalEventoPirelli>

const TOKEN_LOCAL = /^[A-Za-z0-9._:-]{16,100}$/
const CODIGO_QR = /^[A-Za-z0-9_-]{16,100}$/

function lerCadastro(valor: string | null): CadastroLocalEventoPirelli {
  if (!valor) return {}
  try {
    const bruto = JSON.parse(valor) as unknown
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {}
    const registro = bruto as Record<string, unknown>
    const cadastro: CadastroLocalEventoPirelli = {}
    for (const campo of CAMPOS_TEXTO) {
      const texto = registro[campo]
      if (typeof texto === 'string' && texto.length <= 254) cadastro[campo] = texto
    }
    if (typeof registro.consentimentoMarketing === 'boolean') {
      cadastro.consentimentoMarketing = registro.consentimentoMarketing
    }
    return cadastro
  } catch {
    return {}
  }
}

function tokenValido(valor: string | null, formato: RegExp) {
  return valor && formato.test(valor) ? valor : ''
}

/**
 * Lê o acesso salvo no navegador e copia de v1 para v2 apenas os campos
 * reconhecidos. O QR e a chave de idempotência antigos continuam válidos no
 * servidor; descartá-los faria um participante já cadastrado parecer novo.
 */
export function carregarEMigrarAcessoEventoPirelli(storage: ArmazenamentoLocal) {
  const cadastroV2 = lerCadastro(storage.getItem(STORAGE_EVENTO_PIRELLI.cadastro))
  const cadastroV1 = lerCadastro(storage.getItem(STORAGE_EVENTO_PIRELLI_LEGADO.cadastro))
  const cadastro = { ...cadastroV1, ...cadastroV2 }

  const codigoV2 = tokenValido(storage.getItem(STORAGE_EVENTO_PIRELLI.codigoQr), CODIGO_QR)
  const codigoQr = codigoV2
    || tokenValido(storage.getItem(STORAGE_EVENTO_PIRELLI_LEGADO.codigoQr), CODIGO_QR)

  const submissaoV2 = tokenValido(storage.getItem(STORAGE_EVENTO_PIRELLI.chaveSubmissao), TOKEN_LOCAL)
  const chaveSubmissao = submissaoV2
    || tokenValido(storage.getItem(STORAGE_EVENTO_PIRELLI_LEGADO.chaveSubmissao), TOKEN_LOCAL)

  if (!codigoV2 && codigoQr) storage.setItem(STORAGE_EVENTO_PIRELLI.codigoQr, codigoQr)
  if (!submissaoV2 && chaveSubmissao) {
    storage.setItem(STORAGE_EVENTO_PIRELLI.chaveSubmissao, chaveSubmissao)
  }
  if (Object.keys(cadastro).length > 0) {
    storage.setItem(STORAGE_EVENTO_PIRELLI.cadastro, JSON.stringify(cadastro))
  }

  return { cadastro, codigoQr, chaveSubmissao }
}

export function salvarAcessoRecuperadoEventoPirelli(
  storage: ArmazenamentoLocal,
  visitante: { codigoQr: string; nomeCompleto: string; whatsapp: string; email?: string | null },
) {
  if (!CODIGO_QR.test(visitante.codigoQr)) throw new Error('Código de acesso inválido.')
  const atual = lerCadastro(storage.getItem(STORAGE_EVENTO_PIRELLI.cadastro))
  const cadastro: CadastroLocalEventoPirelli = {
    ...atual,
    nomeCompleto: visitante.nomeCompleto,
    whatsapp: visitante.whatsapp,
    ...(visitante.email ? { email: visitante.email } : {}),
  }
  storage.setItem(STORAGE_EVENTO_PIRELLI.codigoQr, visitante.codigoQr)
  storage.setItem(STORAGE_EVENTO_PIRELLI.cadastro, JSON.stringify(cadastro))
  return cadastro
}

/** Remove apenas o acesso local; o cadastro no servidor continua recuperável por OTP. */
export function limparAcessoLocalEventoPirelli(storage: Pick<Storage, 'removeItem'>) {
  for (const chave of [
    ...Object.values(STORAGE_EVENTO_PIRELLI),
    ...Object.values(STORAGE_EVENTO_PIRELLI_LEGADO),
  ]) storage.removeItem(chave)
}
