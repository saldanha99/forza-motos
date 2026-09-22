import { randomBytes } from 'crypto'
import {
  opcaoAcomodacaoAceitaGarupa,
  opcoesDefinemAcomodacao,
  tipoAcomodacaoDaOpcao,
} from './acomodacao'
import { pagamentoEmProcessamento } from '@/lib/checkout/prazos-pagamento'

export const MOEDA_EVENTO = 'BRL'
const duracaoReservaEventoConfigurada = Number(process.env.EVENTO_RESERVA_MINUTOS ?? 120)
export const DURACAO_RESERVA_EVENTO_MINUTOS =
  Number.isFinite(duracaoReservaEventoConfigurada) && duracaoReservaEventoConfigurada > 0
    ? Math.min(Math.max(Math.trunc(duracaoReservaEventoConfigurada), 15), 24 * 60)
    : 120

const ROTULO_GARUPA = /garupa|acompanhante|casal|dupla|duplo|2\s*(?:pessoas|participantes)|\+\s*1/i
const ROTULO_SOLO = /sozinh|\bsolo\b|individual|1\s*(?:pessoa|participante)|apenas\s+(?:o\s+)?piloto/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class EventoCheckoutError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'evento_checkout_invalido',
  ) {
    super(message)
    this.name = 'EventoCheckoutError'
  }
}

export interface OpcaoVagaEvento {
  label: string
  preco: number
}

export interface EventoParaCheckout {
  preco: unknown
  opcoesVaga: unknown
}

export interface EntradaCheckoutEvento {
  nome: string
  email: string
  telefone: string
  cpf: string | null
  cep: string | null
  numeroResidencia: string | null
  motoModelo: string
  temGarupa: boolean
  nomeGarupa: string | null
  tipoAcomodacao: string | null
  quantidadeVagas: number
  opcaoVaga: OpcaoVagaEvento | null
  precoPacote: number
  total: number
}

export interface PagamentoMercadoPagoEvento {
  id: string
  status: string
  status_detail?: string | null
  external_reference: string
  transaction_amount: number | null
  currency_id: string | null
  preference_id?: string | null
  collector_id?: string | number | null
  payment_method_id?: string | null
}

export interface InscricaoParaValidarPagamento {
  id: string
  total: unknown
  status: 'PENDENTE' | 'PAGO' | 'CANCELADO'
  mpPreferenciaId: string | null
  mpPagamentoId: string | null
  mpStatus?: string | null
  reservaExpiraEm?: Date | null
  pagamentoResultadoIncerto?: boolean
}

export type StatusPagamentoEvento =
  | 'approved'
  | 'pending'
  | 'in_process'
  | 'authorized'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back'
  | 'in_mediation'

export interface DecisaoPagamentoEvento {
  status: StatusPagamentoEvento
  statusInscricao: 'PENDENTE' | 'PAGO' | 'CANCELADO'
  alterou: boolean
  notificarAprovacao: boolean
  liberarReserva: boolean
  reembolsoNecessario: boolean
}

function texto(
  value: unknown,
  campo: string,
  { min = 1, max = 120, obrigatorio = true }: { min?: number; max?: number; obrigatorio?: boolean } = {},
): string | null {
  if (typeof value !== 'string') {
    if (!obrigatorio && (value === undefined || value === null)) return null
    throw new EventoCheckoutError(`${campo} é obrigatório.`)
  }

  const normalizado = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().replace(/\s+/g, ' ')
  if (!normalizado && !obrigatorio) return null
  if (normalizado.length < min || normalizado.length > max) {
    throw new EventoCheckoutError(`${campo} inválido.`)
  }
  return normalizado
}

function somenteDigitos(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

export function cpfValido(value: unknown): boolean {
  const cpf = somenteDigitos(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  for (let tamanho = 9; tamanho <= 10; tamanho++) {
    let soma = 0
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i)
    const resto = (soma * 10) % 11
    const digito = resto === 10 ? 0 : resto
    if (digito !== Number(cpf[tamanho])) return false
  }
  return true
}

function opcoesValidas(value: unknown): OpcaoVagaEvento[] {
  if (!Array.isArray(value)) {
    throw new EventoCheckoutError('Configuração de vagas inválida.', 500, 'evento_configuracao_invalida')
  }

  const labels = new Set<string>()
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new EventoCheckoutError('Configuração de vagas inválida.', 500, 'evento_configuracao_invalida')
    }
    const label = texto((item as Record<string, unknown>).label, 'Opção de vaga', { max: 100 })!
    const preco = Number((item as Record<string, unknown>).preco)
    if (
      !Number.isFinite(preco) ||
      preco < 0 ||
      Math.abs(preco * 100 - Math.round(preco * 100)) > 1e-6
    ) {
      throw new EventoCheckoutError('Preço de vaga inválido.', 500, 'evento_configuracao_invalida')
    }
    const chave = label.toLocaleLowerCase('pt-BR')
    if (labels.has(chave)) {
      throw new EventoCheckoutError('Há opções de vaga duplicadas.', 500, 'evento_configuracao_invalida')
    }
    labels.add(chave)
    return { label, preco }
  })
}

function selecionarOpcao(
  opcoes: OpcaoVagaEvento[],
  opcaoSolicitada: unknown,
  temGarupa: boolean,
): OpcaoVagaEvento | null {
  if (!opcoes.length) {
    if (opcaoSolicitada !== undefined && opcaoSolicitada !== null && opcaoSolicitada !== '') {
      throw new EventoCheckoutError('Este evento não possui opções de vaga.')
    }
    return null
  }

  const garupas = opcoes.filter((opcao) => ROTULO_GARUPA.test(opcao.label))
  const solos = opcoes.filter((opcao) => ROTULO_SOLO.test(opcao.label))
  const opcoesDeAcomodacao = opcoesDefinemAcomodacao(opcoes)
  const parPilotoGarupa = !opcoesDeAcomodacao && opcoes.length === 2 && garupas.length === 1
  let escolhida: OpcaoVagaEvento | undefined

  if (parPilotoGarupa) {
    escolhida = temGarupa ? garupas[0] : opcoes.find((opcao) => opcao !== garupas[0])
  } else {
    const label = texto(opcaoSolicitada, 'Opção de vaga', { max: 100 })!
    escolhida = opcoes.find((opcao) => opcao.label === label)
  }

  if (!escolhida) throw new EventoCheckoutError('Opção de vaga inválida.')

  const labelSolicitado = typeof opcaoSolicitada === 'string' ? opcaoSolicitada.trim() : ''
  if (labelSolicitado && labelSolicitado !== escolhida.label) {
    throw new EventoCheckoutError('A opção de vaga não corresponde à escolha de garupa.')
  }
  if (opcoesDeAcomodacao) {
    if (temGarupa && !opcaoAcomodacaoAceitaGarupa(escolhida.label)) {
      throw new EventoCheckoutError('Selecione um quarto compatível com o casal.')
    }
  } else {
    if (temGarupa && solos.length && ROTULO_SOLO.test(escolhida.label)) {
      throw new EventoCheckoutError('Selecione uma opção compatível com garupa.')
    }
    if (!temGarupa && ROTULO_GARUPA.test(escolhida.label)) {
      throw new EventoCheckoutError('A opção com garupa exige os dados do acompanhante.')
    }
  }

  return escolhida
}

function vagasDaOpcao(opcao: OpcaoVagaEvento | null, temGarupa: boolean): number {
  const quantidadeNoRotulo = opcao?.label.match(/\b([1-9])\s*(?:pessoas|participantes|vagas)\b/i)
  const quantidadePacote = quantidadeNoRotulo ? Number(quantidadeNoRotulo[1]) : 1
  return temGarupa ? Math.max(2, quantidadePacote) : quantidadePacote
}

export function validarIdempotencyKey(header: string | null, body: unknown): string {
  const bodyKey = typeof body === 'string' ? body.trim() : ''
  const headerKey = header?.trim() ?? ''
  if (!UUID.test(headerKey) || headerKey !== bodyKey) {
    throw new EventoCheckoutError(
      'A tentativa de inscrição é inválida. Atualize a página e tente novamente.',
      400,
      'idempotency_key_invalida',
    )
  }
  return headerKey.toLowerCase()
}

export function criarTokenConsultaEvento() {
  return randomBytes(32).toString('base64url')
}

export function normalizarCheckoutEvento(evento: EventoParaCheckout, body: unknown): EntradaCheckoutEvento {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new EventoCheckoutError('Dados da inscrição inválidos.')
  }
  const entrada = body as Record<string, unknown>
  if (typeof entrada.temGarupa !== 'boolean') {
    throw new EventoCheckoutError('Informe se haverá garupa.')
  }

  const temGarupa = entrada.temGarupa
  const nome = texto(entrada.nome, 'Nome completo', { min: 3, max: 120 })!
  if (!nome.includes(' ')) throw new EventoCheckoutError('Informe seu nome completo.')

  const email = texto(entrada.email, 'E-mail', { max: 254 })!.toLowerCase()
  if (!EMAIL.test(email)) throw new EventoCheckoutError('Informe um e-mail válido.')

  const telefone = somenteDigitos(entrada.telefone)
  if (telefone.length < 10 || telefone.length > 11) {
    throw new EventoCheckoutError('Informe um WhatsApp válido com DDD.')
  }

  const motoModelo = texto(entrada.motoModelo, 'Modelo da moto', { min: 2, max: 100 })!
  const nomeGarupa = temGarupa
    ? texto(entrada.nomeGarupa, 'Nome completo da garupa', { min: 3, max: 120 })
    : null
  if (nomeGarupa && !nomeGarupa.includes(' ')) {
    throw new EventoCheckoutError('Informe o nome completo da garupa.')
  }

  const opcoes = opcoesValidas(evento.opcoesVaga)
  const opcaoVaga = selecionarOpcao(opcoes, entrada.opcaoVagaLabel, temGarupa)
  const precoBase = Number(evento.preco)
  if (!Number.isFinite(precoBase) || precoBase < 0) {
    throw new EventoCheckoutError('Preço do evento inválido.', 500, 'evento_configuracao_invalida')
  }

  const quantidadeVagas = vagasDaOpcao(opcaoVaga, temGarupa)
  const precoPacote = opcaoVaga?.preco ?? precoBase * quantidadeVagas
  const total = Math.round(precoPacote * 100) / 100
  const pago = total > 0

  let cpf: string | null = null
  let cep: string | null = null
  let numeroResidencia: string | null = null
  let tipoAcomodacao: string | null = null

  if (pago) {
    cpf = somenteDigitos(entrada.cpf)
    if (!cpfValido(cpf)) throw new EventoCheckoutError('Informe um CPF válido.')

    cep = somenteDigitos(entrada.cep)
    if (cep.length !== 8) throw new EventoCheckoutError('Informe um CEP válido com 8 dígitos.')
    numeroResidencia = texto(entrada.numeroResidencia, 'Número residencial', { max: 30 })

    if (opcaoVaga && opcoesDefinemAcomodacao(opcoes)) {
      // Quando as opções com preço já são os tipos de quarto, a mesma escolha
      // determina valor e acomodação. O cliente não consegue enviar combinações
      // divergentes (por exemplo, preço compartilhado + quarto individual).
      tipoAcomodacao = tipoAcomodacaoDaOpcao(opcaoVaga.label, temGarupa)
    } else {
      const acomodacoesSolo = ['Quarto Compartilhado', 'Quarto Single / Casal (Individual)']
      tipoAcomodacao = temGarupa
        ? 'Quarto Casal'
        : texto(entrada.tipoAcomodacao, 'Opção de acomodação', { max: 60 })
      if (!temGarupa && !acomodacoesSolo.includes(tipoAcomodacao!)) {
        throw new EventoCheckoutError('Opção de acomodação inválida.')
      }
    }
  }

  return {
    nome,
    email,
    telefone,
    cpf,
    cep,
    numeroResidencia,
    motoModelo,
    temGarupa,
    nomeGarupa,
    tipoAcomodacao,
    quantidadeVagas,
    opcaoVaga,
    precoPacote,
    total,
  }
}

function centavos(value: unknown): number | null {
  const numero = Number(value)
  return Number.isFinite(numero) ? Math.round(numero * 100) : null
}

export function validarPagamentoEvento(
  inscricao: InscricaoParaValidarPagamento,
  payment: PagamentoMercadoPagoEvento,
  agora = new Date(),
): DecisaoPagamentoEvento {
  const statuses: StatusPagamentoEvento[] = [
    'approved',
    'pending',
    'in_process',
    'authorized',
    'rejected',
    'cancelled',
    'refunded',
    'charged_back',
    'in_mediation',
  ]
  if (!statuses.includes(payment.status as StatusPagamentoEvento)) {
    throw new EventoCheckoutError('Status de pagamento não suportado.', 422, 'pagamento_status_invalido')
  }
  const status = payment.status as StatusPagamentoEvento

  if (payment.external_reference !== `evento_${inscricao.id}`) {
    throw new EventoCheckoutError('Referência do pagamento divergente.', 422, 'pagamento_referencia_divergente')
  }
  if (!inscricao.mpPreferenciaId || payment.preference_id !== inscricao.mpPreferenciaId) {
    throw new EventoCheckoutError('Preferência do pagamento divergente.', 422, 'pagamento_preferencia_divergente')
  }
  if (payment.currency_id !== MOEDA_EVENTO) {
    throw new EventoCheckoutError('Moeda do pagamento divergente.', 422, 'pagamento_moeda_divergente')
  }
  if (
    payment.transaction_amount === null ||
    centavos(payment.transaction_amount) !== centavos(inscricao.total)
  ) {
    throw new EventoCheckoutError('Valor do pagamento divergente.', 422, 'pagamento_valor_divergente')
  }

  const expirou = Boolean(inscricao.reservaExpiraEm && inscricao.reservaExpiraEm <= agora)
  const finalReversao = status === 'refunded' || status === 'charged_back'

  if (status === 'approved' && inscricao.status === 'CANCELADO') {
    return {
      status,
      statusInscricao: 'CANCELADO',
      alterou: false,
      notificarAprovacao: false,
      liberarReserva: true,
      reembolsoNecessario: inscricao.mpPagamentoId !== String(payment.id),
    }
  }

  if (status === 'approved') {
    const primeiroAprovado = inscricao.status !== 'PAGO'
    const outroPagamentoAprovado = Boolean(
      inscricao.mpPagamentoId && inscricao.mpPagamentoId !== String(payment.id),
    )
    return {
      status,
      statusInscricao: outroPagamentoAprovado ? inscricao.status : 'PAGO',
      alterou: primeiroAprovado && !outroPagamentoAprovado,
      notificarAprovacao: primeiroAprovado && !outroPagamentoAprovado,
      liberarReserva: false,
      reembolsoNecessario: outroPagamentoAprovado,
    }
  }

  if (finalReversao) {
    if (inscricao.mpPagamentoId !== String(payment.id)) {
      return {
        status,
        statusInscricao: inscricao.status,
        alterou: false,
        notificarAprovacao: false,
        liberarReserva: false,
        reembolsoNecessario: false,
      }
    }
    return {
      status,
      statusInscricao: 'CANCELADO',
      alterou: inscricao.status !== 'CANCELADO' || inscricao.mpStatus !== status,
      notificarAprovacao: false,
      liberarReserva: true,
      reembolsoNecessario: false,
    }
  }

  if (inscricao.status === 'PAGO') {
    return {
      status,
      statusInscricao: 'PAGO',
      alterou: false,
      notificarAprovacao: false,
      liberarReserva: false,
      reembolsoNecessario: false,
    }
  }

  if (inscricao.status === 'CANCELADO') {
    return {
      status,
      statusInscricao: 'CANCELADO',
      alterou: false,
      notificarAprovacao: false,
      liberarReserva: false,
      reembolsoNecessario: false,
    }
  }

  // Uma preferência pode originar várias tentativas. Uma tentativa rejeitada ou
  // cancelada não invalida uma aprovação posterior enquanto a reserva vigora.
  // Uma tentativa realmente em processamento preserva a vaga mesmo quando o
  // prazo inicial terminou; o webhook prorroga a reserva para a compensação.
  const emProcessamento = pagamentoEmProcessamento(status)
  const podeTentarNovamente = status === 'rejected' || status === 'cancelled'
  const aguardando = emProcessamento || (podeTentarNovamente && !expirou)
  return {
    status,
    statusInscricao: aguardando ? 'PENDENTE' : 'CANCELADO',
    alterou:
      inscricao.status !== (aguardando ? 'PENDENTE' : 'CANCELADO') ||
      inscricao.mpStatus !== status,
    notificarAprovacao: false,
    liberarReserva: !aguardando,
    reembolsoNecessario: false,
  }
}
