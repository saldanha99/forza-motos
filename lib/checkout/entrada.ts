const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function somenteDigitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '')
}

function texto(
  valor: unknown,
  campo: string,
  opts: { min?: number; max?: number; opcional?: boolean } = {},
): string {
  const { min = 1, max = 120, opcional = false } = opts
  if (typeof valor !== 'string') {
    if (opcional && (valor === undefined || valor === null)) return ''
    throw new Error('ENDERECO_INVALIDO')
  }
  const normalizado = valor
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  if (!normalizado && opcional) return ''
  if (normalizado.length < min || normalizado.length > max) {
    console.warn(`[checkout] Campo ${campo} fora do limite permitido`)
    throw new Error('ENDERECO_INVALIDO')
  }
  return normalizado
}

function digitoCpf(base: string, tamanho: number): number {
  let soma = 0
  for (let i = 0; i < tamanho; i += 1) soma += Number(base[i]) * (tamanho + 1 - i)
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

export function cpfValido(valor: unknown): boolean {
  const cpf = somenteDigitos(valor)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  return digitoCpf(cpf, 9) === Number(cpf[9]) && digitoCpf(cpf, 10) === Number(cpf[10])
}

function digitoCnpj(base: string, pesos: number[]): number {
  const soma = pesos.reduce((total, peso, indice) => total + Number(base[indice]) * peso, 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function cnpjValido(valor: unknown): boolean {
  const cnpj = somenteDigitos(valor)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const primeiro = digitoCnpj(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = digitoCnpj(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return primeiro === Number(cnpj[12]) && segundo === Number(cnpj[13])
}

export function documentoFiscalValido(valor: unknown): boolean {
  const documento = somenteDigitos(valor)
  return documento.length === 11 ? cpfValido(documento) : cnpjValido(documento)
}

export function normalizarEnderecoCheckout(entrada: unknown, documentoRaw: unknown) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new Error('ENDERECO_INVALIDO')
  }
  const dados = entrada as Record<string, unknown>
  const cpf = somenteDigitos(documentoRaw ?? dados.cpf)
  if (!documentoFiscalValido(cpf)) throw new Error('CPF_INVALIDO')

  const nome = texto(dados.nome, 'nome', { min: 3, max: 120 })
  const email = texto(dados.email, 'email', { min: 5, max: 254 }).toLowerCase()
  if (!EMAIL.test(email)) throw new Error('EMAIL_INVALIDO')

  const telefone = somenteDigitos(dados.telefone)
  if (telefone.length < 10 || telefone.length > 13) {
    throw new Error('TELEFONE_INVALIDO')
  }

  const cep = somenteDigitos(dados.cep)
  if (cep.length !== 8) throw new Error('CEP_INVALIDO')
  const estado = texto(dados.estado, 'estado', { min: 2, max: 2 }).toUpperCase()
  if (!/^[A-Z]{2}$/.test(estado)) throw new Error('ENDERECO_INVALIDO')

  return {
    nome,
    email,
    telefone,
    cpf,
    cep,
    rua: texto(dados.rua, 'rua', { min: 2, max: 150 }),
    numero: texto(dados.numero, 'numero', { max: 30 }),
    complemento: texto(dados.complemento, 'complemento', { max: 100, opcional: true }),
    bairro: texto(dados.bairro, 'bairro', { min: 2, max: 100 }),
    cidade: texto(dados.cidade, 'cidade', { min: 2, max: 100 }),
    estado,
    // Consentimento específico e auditável para avisos transacionais no
    // WhatsApp. Não autoriza promoções e valores truthy forjados ("true", 1)
    // não são aceitos.
    whatsappTransacionalAutorizado: dados.whatsappTransacionalAutorizado === true,
  }
}
