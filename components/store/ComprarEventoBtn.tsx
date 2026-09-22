'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Clock3, RefreshCw, X, ShoppingBag, Loader2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { useTravarScrollDeFundo } from '@/components/SmoothScroll'
import {
  opcaoAcomodacaoAceitaGarupa,
  opcoesDefinemAcomodacao,
  tipoAcomodacaoDaOpcao,
} from '@/lib/eventos/acomodacao'
import {
  lerTentativaCheckoutEvento,
  limparTentativaCheckoutEvento,
  salvarTentativaCheckoutEvento,
} from '@/lib/eventos/retomada-checkout'
import { novaChaveIdempotenciaCliente } from '@/lib/checkout/chave-idempotencia-cliente'

interface OpcaoVaga {
  label: string
  preco: number
}

const SEM_OPCOES_VAGA: OpcaoVaga[] = []

interface Props {
  slug: string
  preco: number
  titulo: string
  gratuito: boolean
  opcoesVaga?: OpcaoVaga[]
  vagasRestantes?: number | null
}

interface RetomadaCheckoutEvento {
  status: 'PENDENTE' | 'PAGO' | 'CANCELADO'
  pagamento: string | null
  statusUrl: string
  initPoint: string | null
  processando: boolean
  podeRetomarPagamento: boolean
}

type ResultadoConsultaRetomada =
  | { encontrada: true; dados: RetomadaCheckoutEvento }
  | { encontrada: false; status: number }

function aguardarConsultaRetomada(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Consulta cancelada.', 'AbortError'))
      return
    }
    const cancelar = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Consulta cancelada.', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', cancelar)
      resolve()
    }, ms)
    signal?.addEventListener('abort', cancelar, { once: true })
  })
}

async function consultarRetomadaCheckoutEvento(
  slug: string,
  checkoutTentativaId: string,
  signal?: AbortSignal,
): Promise<ResultadoConsultaRetomada> {
  const resposta = await fetch(`/api/eventos/${slug}/retomar`, {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': checkoutTentativaId,
    },
    body: JSON.stringify({ checkoutTentativaId }),
  })
  const dados = await resposta.json().catch(() => null)
  if (!resposta.ok || !dados) return { encontrada: false, status: resposta.status }
  return { encontrada: true, dados: dados as RetomadaCheckoutEvento }
}

export function ComprarEventoBtn({ slug, preco, titulo, gratuito, opcoesVaga = SEM_OPCOES_VAGA, vagasRestantes = null }: Props) {
  const [aberto, setAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [mounted, setMounted] = useState(false)
  const [checandoRetomada, setChecandoRetomada] = useState(false)
  const [tentativaSalva, setTentativaSalva] = useState<string | null>(null)
  const [retomada, setRetomada] = useState<RetomadaCheckoutEvento | null>(null)
  const [erroRetomada, setErroRetomada] = useState('')
  const [precisaSuporte, setPrecisaSuporte] = useState(false)
  const temOpcoes = opcoesVaga.length > 0
  const [vagaIdx, setVagaIdx] = useState(0)
  const tentativaRef = useRef('')
  const esgotado = vagasRestantes !== null && vagasRestantes <= 0
  const opcoesDeAcomodacao = opcoesDefinemAcomodacao(opcoesVaga)
  const indiceAcomodacaoGarupa = opcoesDeAcomodacao
    ? opcoesVaga.findIndex((opcao) => opcaoAcomodacaoAceitaGarupa(opcao.label))
    : -1

  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    cep: '',
    numeroResidencia: '',
    motoModelo: '',
    temGarupa: false,
    nomeGarupa: '',
    tipoAcomodacao: 'Quarto Compartilhado',
  })

  const limparCredencialDaTentativa = useCallback(() => {
    tentativaRef.current = ''
    setTentativaSalva(null)
    try {
      limparTentativaCheckoutEvento(window.localStorage, slug)
    } catch {
      // O checkout continua utilizável em navegadores que bloqueiam storage.
    }
  }, [slug])

  const carregarRetomada = useCallback(async (checkoutTentativaId: string, signal?: AbortSignal) => {
    setChecandoRetomada(true)
    setErroRetomada('')
    try {
      let resultado: ResultadoConsultaRetomada = { encontrada: false, status: 404 }
      // Um reload pode chegar enquanto o POST anterior ainda está concluindo no
      // servidor. Damos uma janela curta antes de declarar a credencial órfã.
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        resultado = await consultarRetomadaCheckoutEvento(slug, checkoutTentativaId, signal)
        if (resultado.encontrada || resultado.status !== 404 || tentativa === 3) break
        await aguardarConsultaRetomada(500 + tentativa * 250, signal)
      }
      if (!resultado.encontrada) {
        if (resultado.status === 404) {
          limparCredencialDaTentativa()
          setRetomada(null)
          return
        }
        throw new Error('consulta_indisponivel')
      }

      setRetomada(resultado.dados)
      if (resultado.dados.status === 'CANCELADO') limparCredencialDaTentativa()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setErroRetomada('Não foi possível consultar sua inscrição agora. Sua tentativa continua salva com segurança.')
    } finally {
      setChecandoRetomada(false)
    }
  }, [limparCredencialDaTentativa, slug])

  useEffect(() => {
    setMounted(true)
    let salva = null
    try {
      salva = lerTentativaCheckoutEvento(window.localStorage, slug)
    } catch {
      // Alguns modos privados bloqueiam localStorage; o checkout ainda funciona.
    }
    if (!salva) return

    const controller = new AbortController()
    tentativaRef.current = salva.checkoutTentativaId
    setTentativaSalva(salva.checkoutTentativaId)
    void carregarRetomada(salva.checkoutTentativaId, controller.signal)
    return () => controller.abort()
  }, [carregarRetomada, slug])

  // Trava o scroll do fundo (nativo + Lenis) enquanto o modal está aberto
  useTravarScrollDeFundo(aberto)

  // Detecta o par "só piloto" × "piloto + garupa" nas opções de vaga do evento.
  // Quando o par existe, a pergunta "vai com garupa?" já define a vaga: o bloco
  // de opções vira redundante e some do formulário. Eventos com outras
  // combinações (3+ opções, rótulos diferentes) continuam com a lista visível.
  const parVagas = (() => {
    if (opcoesDeAcomodacao) return null
    if (opcoesVaga.length !== 2) return null
    const ehGarupa = (label: string) => /garupa|acompanhante|casal|dupla|duplo|2\s*pessoas|\+\s*1/i.test(label)
    const garupa = opcoesVaga.findIndex((o) => ehGarupa(o.label))
    if (garupa === -1) return null
    const solo = garupa === 0 ? 1 : 0
    if (ehGarupa(opcoesVaga[solo].label)) return null
    return { solo, garupa }
  })()

  // Com o par detectado, a vaga acompanha o toggle de garupa
  const vagaAtiva = parVagas ? (form.temGarupa ? parVagas.garupa : parVagas.solo) : vagaIdx

  const precoUnitario = temOpcoes ? opcoesVaga[vagaAtiva].preco : preco
  // Com opções de vaga, quem define se é pago é a opção escolhida
  const gratisEfetivo = precoUnitario === 0

  const rotuloPreco = (valor: number) => (valor > 0 ? formatPrice(valor) : 'Gratuito')

  function update(field: string, value: any) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      // Se marcou que vai com garupa em evento pago, o quarto é obrigatoriamente Quarto Casal
      if (field === 'temGarupa' && value === true) {
        next.tipoAcomodacao = 'Quarto Casal'
      }
      return next
    })
  }

  function selecionarGarupa(temGarupa: boolean) {
    update('temGarupa', temGarupa)
    if (temGarupa && indiceAcomodacaoGarupa >= 0) {
      selecionarVaga(indiceAcomodacaoGarupa)
    }
  }

  function selecionarVaga(idx: number) {
    setVagaIdx(idx)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setPrecisaSuporte(false)

    if (!form.nome.trim() || !form.email.trim() || !form.telefone.trim()) {
      setErro('Nome, e-mail e WhatsApp são obrigatórios.')
      return
    }

    if (!form.motoModelo.trim()) {
      setErro('Por favor, informe o modelo da sua moto.')
      return
    }

    if (form.temGarupa && !form.nomeGarupa.trim()) {
      setErro('Por favor, informe o nome completo da garupa.')
      return
    }

    // Validações exclusivas para eventos pagos (reserva de hotel/seguro)
    if (!gratisEfetivo) {
      const cpfLimpo = form.cpf.replace(/\D/g, '')
      if (cpfLimpo.length !== 11) {
        setErro('Por favor, informe um CPF válido (para reserva do hotel/seguro).')
        return
      }
      if (form.cep.replace(/\D/g, '').length !== 8 || !form.numeroResidencia.trim()) {
        setErro('CEP e Número Residencial são obrigatórios para a reserva da viagem.')
        return
      }
    }

    setLoading(true)
    try {
      if (!tentativaRef.current) tentativaRef.current = novaChaveIdempotenciaCliente()
      const checkoutTentativaId = tentativaRef.current
      setTentativaSalva(checkoutTentativaId)
      setRetomada(null)
      setErroRetomada('')
      try {
        salvarTentativaCheckoutEvento(window.localStorage, slug, checkoutTentativaId)
      } catch {
        // A requisição mantém a idempotência mesmo se o navegador bloquear storage.
      }
      const acomodacaoFinal = gratisEfetivo
        ? null
        : opcoesDeAcomodacao
        ? tipoAcomodacaoDaOpcao(opcoesVaga[vagaAtiva].label, form.temGarupa)
        : form.temGarupa
        ? 'Quarto Casal'
        : form.tipoAcomodacao

      let res: Response | null = null
      let data: any = null
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        res = await fetch(`/api/eventos/${slug}/comprar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': checkoutTentativaId,
          },
          body: JSON.stringify({
            ...form,
            checkoutTentativaId,
            tipoAcomodacao: acomodacaoFinal,
            ...(temOpcoes && { opcaoVagaLabel: opcoesVaga[vagaAtiva].label }),
          }),
        })
        data = await res.json().catch(() => ({}))
        if (res.status !== 202 || !data.processando) break
        await new Promise((resolve) => setTimeout(resolve, Number(data.retry_after_ms) || 1200))
      }

      if (!res) throw new Error('Resposta ausente')

      if (res.status === 202 && data.processando) {
        setRetomada({
          status: 'PENDENTE',
          pagamento: null,
          statusUrl: typeof data.statusUrl === 'string' ? data.statusUrl : '',
          initPoint: null,
          processando: true,
          podeRetomarPagamento: false,
        })
        setAberto(false)
        return
      }

      if (!res.ok) {
        if (data.code === 'idempotency_key_reutilizada' || data.code === 'tentativa_em_processamento') {
          setAberto(false)
          await carregarRetomada(checkoutTentativaId)
          return
        }
        limparCredencialDaTentativa()
        if (data.code === 'participante_ja_inscrito') setPrecisaSuporte(true)
        setErro(data.error || 'Erro ao processar inscrição')
        return
      }

      // Gratuito → redirect direto para sucesso
      if (data.gratuito) {
        window.location.href = data.redirectUrl
        return
      }

      // Pago → redirect para Mercado Pago
      if (data.init_point) {
        window.location.href = data.init_point
        return
      }

      setErro('O pagamento não foi aberto. Tente novamente sem fechar esta janela.')
    } catch {
      setAberto(false)
      await carregarRetomada(tentativaRef.current)
    } finally {
      setLoading(false)
    }
  }

  const total = precoUnitario

  const modalJSX = aberto ? (
    // data-lenis-prevent: o scroll suave (Lenis) sequestra a roda do mouse no
    // documento inteiro — sem isso a página de trás rolava com o modal aberto,
    // mesmo com body overflow hidden
    <div
      data-lenis-prevent
      role="dialog"
      aria-modal="true"
      aria-labelledby={`evento-checkout-${slug}`}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => !loading && setAberto(false)}
      />

      {/* Modal Container */}
      <div className="relative z-[100000] w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[85vh] sm:max-h-[90vh] flex flex-col border border-gray-100">
        {/* Header */}
        <div className="bg-[#1a1a2e] px-6 py-4.5 flex items-center justify-between shrink-0 border-b border-white/10">
          <div>
            <p className="text-[11px] text-red-400 font-bold uppercase tracking-widest">
              {gratuito ? 'Inscrição no passeio' : 'Garantir vaga / Reserva da Viagem'}
            </p>
            <h3 id={`evento-checkout-${slug}`} className="text-white font-barlow font-bold text-lg leading-tight mt-0.5 line-clamp-1">{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={() => setAberto(false)}
            disabled={loading}
            className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto font-inter text-sm">
          {/* Dados Pessoais */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#444] uppercase tracking-wider mb-1">
                Seu Nome Completo *
              </label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => update('nome', e.target.value)}
                placeholder="Nome completo do piloto"
                className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-2.5 text-sm text-[#222] bg-white outline-none transition-all focus:ring-2 focus:ring-red-500/10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#444] uppercase tracking-wider mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-2.5 text-sm text-[#222] bg-white outline-none transition-all focus:ring-2 focus:ring-red-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#444] uppercase tracking-wider mb-1">
                  WhatsApp (com DDD) *
                </label>
                <input
                  type="tel"
                  required
                  value={form.telefone}
                  onChange={(e) => update('telefone', e.target.value)}
                  placeholder="(19) 99999-9999"
                  className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-2.5 text-sm text-[#222] bg-white outline-none transition-all focus:ring-2 focus:ring-red-500/10"
                />
              </div>
            </div>

            {/* Campos adicionais para eventos pagos (reserva de hotel e seguro) */}
            {!gratisEfetivo && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#444] uppercase tracking-wider mb-1">
                    CPF (obrigatório para hotel e seguro) *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.cpf}
                    onChange={(e) => update('cpf', e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-2.5 text-sm text-[#222] bg-white outline-none transition-all focus:ring-2 focus:ring-red-500/10"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#444] uppercase tracking-wider mb-1">
                      CEP Residencial *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.cep}
                      onChange={(e) => update('cep', e.target.value)}
                      placeholder="13000-000"
                      className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-2.5 text-sm text-[#222] bg-white outline-none transition-all focus:ring-2 focus:ring-red-500/10"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#444] uppercase tracking-wider mb-1">
                      Nº da Residência *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.numeroResidencia}
                      onChange={(e) => update('numeroResidencia', e.target.value)}
                      placeholder="Ex: 120, Apto 42"
                      className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-2.5 text-sm text-[#222] bg-white outline-none transition-all focus:ring-2 focus:ring-red-500/10"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Modelo da Moto (obrigatório) */}
          <div>
            <label className="block text-xs font-bold text-[#444] uppercase tracking-wider mb-1">
              Modelo da sua Moto *
            </label>
            <input
              type="text"
              required
              value={form.motoModelo}
              onChange={(e) => update('motoModelo', e.target.value)}
              placeholder="Ex: BMW R1250 GS, Tiger 900, Horizon 250"
              className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-2.5 text-sm text-[#222] bg-white outline-none transition-all focus:ring-2 focus:ring-red-500/10"
            />
          </div>

          {/* Seção Garupa */}
          <div className="bg-[#f9f9fc] border border-[#e5e5f0] rounded-xl p-4 space-y-3">
            <label className="block text-xs font-bold text-[#333] uppercase tracking-wider">
              Vai com Garupa (Acompanhante)?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selecionarGarupa(false)}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-semibold border transition-all ${
                  !form.temGarupa
                    ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                    : 'bg-white text-[#555] border-[#ddd] hover:border-[#bbb]'
                }`}
              >
                🏍️ Não (Vou Solo)
                {/* Valor direto no botão — dispensa o bloco de opção de vaga */}
                {parVagas && (
                  <span
                    className={`block font-barlow font-bold text-[13px] mt-1 ${
                      !form.temGarupa
                        ? 'text-white/85'
                        : opcoesVaga[parVagas.solo].preco > 0
                        ? 'text-[#d42b2b]'
                        : 'text-emerald-600'
                    }`}
                  >
                    {rotuloPreco(opcoesVaga[parVagas.solo].preco)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => selecionarGarupa(true)}
                disabled={opcoesDeAcomodacao && indiceAcomodacaoGarupa === -1}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-semibold border transition-all ${
                  form.temGarupa
                    ? 'bg-[#d42b2b] text-white border-[#d42b2b]'
                    : 'bg-white text-[#555] border-[#ddd] hover:border-[#bbb] disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                👥 Sim (Vou com Garupa)
                {parVagas && (
                  <span
                    className={`block font-barlow font-bold text-[13px] mt-1 ${
                      form.temGarupa
                        ? 'text-white/90'
                        : opcoesVaga[parVagas.garupa].preco > 0
                        ? 'text-[#d42b2b]'
                        : 'text-emerald-600'
                    }`}
                  >
                    {rotuloPreco(opcoesVaga[parVagas.garupa].preco)}
                  </span>
                )}
              </button>
            </div>

            {form.temGarupa && (
              <div className="pt-1">
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1">
                  Nome completo da Garupa *
                </label>
                <input
                  type="text"
                  required={form.temGarupa}
                  value={form.nomeGarupa}
                  onChange={(e) => update('nomeGarupa', e.target.value)}
                  placeholder="Nome completo do(a) acompanhante"
                  className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-2.5 text-sm text-[#222] outline-none bg-white transition-all focus:ring-2 focus:ring-red-500/10"
                />
              </div>
            )}
          </div>

          {/* Preferência de Quarto / Acomodação (somente em eventos pagos / viagens) */}
          {!gratisEfetivo && !opcoesDeAcomodacao && (
            <div className="bg-[#f9f9fc] border border-[#e5e5f0] rounded-xl p-4 space-y-2">
              <label className="block text-xs font-bold text-[#333] uppercase tracking-wider">
                Opção de Quarto (Hotel):
              </label>

              {form.temGarupa ? (
                /* Caso vá com garupa ➔ Quarto Casal Travado */
                <div className="border border-[#d42b2b] bg-red-50/60 rounded-xl p-3.5">
                  <p className="text-xs font-bold text-[#222]">🛏️ Quarto Casal (Piloto + Garupa)</p>
                  <p className="text-[11px] text-[#666] leading-tight mt-0.5">
                    Quarto exclusivo de casal reservado para você e sua garupa.
                  </p>
                </div>
              ) : (
                /* Caso vá solo ➔ Escolhe entre Quarto Single (Preço Casal) ou Quarto Compartilhado */
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-2.5 border rounded-xl p-3.5 cursor-pointer transition-colors ${
                      form.tipoAcomodacao === 'Quarto Single / Casal (Individual)'
                        ? 'border-[#d42b2b] bg-red-50/60'
                        : 'border-[#ddd] bg-white hover:border-[#ccc]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoAcomodacao"
                      checked={form.tipoAcomodacao === 'Quarto Single / Casal (Individual)'}
                      onChange={() => update('tipoAcomodacao', 'Quarto Single / Casal (Individual)')}
                      className="mt-0.5 accent-[#d42b2b]"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#222]">👤 Quarto Single / Casal (Individual)</p>
                      <p className="text-[11px] text-[#666] leading-tight mt-0.5">
                        Quarto exclusivo só para você (mesmo valor do quarto de casal).
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 border rounded-xl p-3.5 cursor-pointer transition-colors ${
                      form.tipoAcomodacao === 'Quarto Compartilhado'
                        ? 'border-[#d42b2b] bg-red-50/60'
                        : 'border-[#ddd] bg-white hover:border-[#ccc]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoAcomodacao"
                      checked={form.tipoAcomodacao === 'Quarto Compartilhado'}
                      onChange={() => update('tipoAcomodacao', 'Quarto Compartilhado')}
                      className="mt-0.5 accent-[#d42b2b]"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#222]">👥 Quarto Compartilhado</p>
                      <p className="text-[11px] text-[#666] leading-tight mt-0.5">
                        Dividir quarto duplo (duas camas de solteiro) com outro integrante solo do grupo.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Opções de vaga — só aparecem quando não dá para deduzir da garupa */}
          {temOpcoes && !parVagas && (
            <div>
              <label className="block text-xs font-bold text-[#444] uppercase tracking-wider mb-1.5">
                {opcoesDeAcomodacao ? 'Opção de quarto / hospedagem' : 'Opção de ingresso / vaga'}
              </label>
              <div className="space-y-2">
                {opcoesVaga.map((op, idx) => {
                  if (opcoesDeAcomodacao && form.temGarupa && !opcaoAcomodacaoAceitaGarupa(op.label)) return null
                  return (
                  <label
                    key={idx}
                    className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                      vagaIdx === idx ? 'border-[#d42b2b] bg-red-50/60' : 'border-[#ddd] hover:border-[#ccc]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 text-xs text-[#333]">
                      <input
                        type="radio"
                        name="vaga"
                        checked={vagaIdx === idx}
                        onChange={() => selecionarVaga(idx)}
                        className="accent-[#d42b2b]"
                      />
                      {op.label}
                    </span>
                    {op.preco > 0 ? (
                      <span className="font-barlow font-bold text-[#d42b2b] text-sm shrink-0">{formatPrice(op.preco)}</span>
                    ) : (
                      <span className="font-barlow font-bold text-emerald-600 text-sm shrink-0">Gratuito</span>
                    )}
                  </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Resumo de valor */}
          {!gratisEfetivo && (
            <div className="bg-[#f8f9fa] border border-[#eee] rounded-xl px-4 py-3.5 flex justify-between items-center">
              <span className="text-xs font-semibold text-[#666] uppercase tracking-wider">Total da inscrição</span>
              <span className="font-barlow font-black text-xl text-[#d42b2b]">
                {formatPrice(total)}
              </span>
            </div>
          )}

          {erro && (
            <div role="alert" className="text-red-700 text-xs font-medium text-center bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <p>{erro}</p>
              {precisaSuporte && (
                <a
                  href={`https://wa.me/5519974049445?text=${encodeURIComponent(`Olá, preciso recuperar minha inscrição no evento ${titulo}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex mt-2 font-bold underline underline-offset-2"
                >
                  Recuperar inscrição pelo atendimento
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || esgotado}
            aria-busy={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#d42b2b] hover:bg-red-700 disabled:opacity-60 text-white font-barlow font-bold uppercase text-sm tracking-wider py-3.5 rounded-xl transition-all shadow-md active:scale-[0.99]"
          >
            {esgotado ? (
              'Vagas esgotadas'
            ) : loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {gratisEfetivo ? 'Confirmando...' : 'Redirecionando para pagamento...'}
              </>
            ) : (
              gratisEfetivo ? 'Confirmar inscrição' : `Pagar ${formatPrice(total)} via Pix`
            )}
          </button>

          {!gratisEfetivo && (
            <p className="text-center text-[11px] text-[#aaa]">
              Pagamento via Pix processado pelo Mercado Pago
            </p>
          )}
        </form>
      </div>
    </div>
  ) : null

  const tentativaEmAberto = Boolean(
    checandoRetomada ||
    (tentativaSalva && (!retomada || retomada.status !== 'CANCELADO')),
  )

  return (
    <>
      {checandoRetomada && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center" role="status">
          <Loader2 size={18} className="mx-auto mb-2 animate-spin text-amber-700" />
          <p className="text-sm font-semibold text-amber-900">Verificando sua inscrição em andamento…</p>
        </div>
      )}

      {!checandoRetomada && retomada?.status === 'PAGO' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
          <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-700" />
          <p className="font-barlow font-bold text-emerald-950">Sua inscrição já está confirmada</p>
          <p className="mt-1 text-xs text-emerald-800">Você pode abrir novamente o comprovante e os detalhes do evento.</p>
          <a
            href={retomada.statusUrl}
            className="mt-3 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-800"
          >
            Ver confirmação
          </a>
        </div>
      )}

      {!checandoRetomada && retomada?.status === 'PENDENTE' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center">
          <Clock3 size={22} className="mx-auto mb-2 text-amber-700" />
          <p className="font-barlow font-bold text-amber-950">
            {retomada.initPoint ? 'Sua vaga está reservada' : 'Seu pagamento está sendo verificado'}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {retomada.initPoint
              ? 'Continue o pagamento sem preencher o cadastro novamente.'
              : 'Acompanhe o status; não faça outra inscrição enquanto a confirmação estiver em andamento.'}
          </p>
          <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
            {retomada.initPoint && (
              <a
                href={retomada.initPoint}
                className="inline-flex justify-center rounded-lg bg-[#d42b2b] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-700"
              >
                Retomar pagamento
              </a>
            )}
            {retomada.statusUrl && (
              <a
                href={retomada.statusUrl}
                className="inline-flex justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-900 hover:border-amber-400"
              >
                Ver status
              </a>
            )}
          </div>
        </div>
      )}

      {!checandoRetomada && erroRetomada && tentativaSalva && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center" role="alert">
          <p className="text-sm font-semibold text-amber-950">{erroRetomada}</p>
          <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void carregarRetomada(tentativaSalva)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-amber-900"
            >
              <RefreshCw size={13} />
              Tentar consultar novamente
            </button>
            <a
              href={`https://wa.me/5519974049445?text=${encodeURIComponent(`Olá, preciso recuperar minha inscrição no evento ${titulo}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-900"
            >
              Falar com o atendimento
            </a>
          </div>
        </div>
      )}

      {!tentativaEmAberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          disabled={esgotado || !mounted}
          className="flex items-center justify-center gap-2 w-full bg-[#d42b2b] hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-barlow font-bold uppercase text-sm tracking-wider px-6 py-4 rounded-xl transition-colors shadow-md"
        >
          <ShoppingBag size={16} />
          {esgotado ? 'Vagas esgotadas' : gratuito ? 'Garantir minha vaga' : 'Comprar ingresso'}
        </button>
      )}

      {mounted && modalJSX ? createPortal(modalJSX, document.body) : null}
    </>
  )
}
