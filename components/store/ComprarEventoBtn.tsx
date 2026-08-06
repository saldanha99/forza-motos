'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ShoppingBag, Loader2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { useTravarScrollDeFundo } from '@/components/SmoothScroll'

interface OpcaoVaga {
  label: string
  preco: number
}

interface Props {
  slug: string
  preco: number
  titulo: string
  gratuito: boolean
  opcoesVaga?: OpcaoVaga[]
}

export function ComprarEventoBtn({ slug, preco, titulo, gratuito, opcoesVaga = [] }: Props) {
  const [aberto, setAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [mounted, setMounted] = useState(false)
  const temOpcoes = opcoesVaga.length > 0
  const [vagaIdx, setVagaIdx] = useState(0)

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

  useEffect(() => {
    setMounted(true)
  }, [])

  // Trava o scroll do fundo (nativo + Lenis) enquanto o modal está aberto
  useTravarScrollDeFundo(aberto)

  // Detecta o par "só piloto" × "piloto + garupa" nas opções de vaga do evento.
  // Quando o par existe, a pergunta "vai com garupa?" já define a vaga: o bloco
  // de opções vira redundante e some do formulário. Eventos com outras
  // combinações (3+ opções, rótulos diferentes) continuam com a lista visível.
  const parVagas = (() => {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

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
      if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
        setErro('Por favor, informe um CPF válido (para reserva do hotel/seguro).')
        return
      }
      if (!form.cep.trim() || !form.numeroResidencia.trim()) {
        setErro('CEP e Número Residencial são obrigatórios para a reserva da viagem.')
        return
      }
    }

    setLoading(true)
    try {
      const acomodacaoFinal = gratisEfetivo
        ? null
        : form.temGarupa
        ? 'Quarto Casal'
        : form.tipoAcomodacao

      const res = await fetch(`/api/eventos/${slug}/comprar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tipoAcomodacao: acomodacaoFinal,
          // Uma inscrição por formulário: solo = 1 vaga, com garupa = a vaga
          // "piloto + garupa" já cobre as duas pessoas
          quantidade: 1,
          ...(temOpcoes && { opcaoVagaLabel: opcoesVaga[vagaAtiva].label }),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
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
    } catch {
      setErro('Erro de conexão. Tente novamente.')
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
            <h3 className="text-white font-barlow font-bold text-lg leading-tight mt-0.5 line-clamp-1">{titulo}</h3>
          </div>
          <button
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
                onClick={() => update('temGarupa', false)}
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
                onClick={() => update('temGarupa', true)}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-semibold border transition-all ${
                  form.temGarupa
                    ? 'bg-[#d42b2b] text-white border-[#d42b2b]'
                    : 'bg-white text-[#555] border-[#ddd] hover:border-[#bbb]'
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
          {!gratisEfetivo && (
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
              <label className="block text-xs font-bold text-[#444] uppercase tracking-wider mb-1.5">Opção de Ingresso / Vaga</label>
              <div className="space-y-2">
                {opcoesVaga.map((op, idx) => (
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
                        onChange={() => setVagaIdx(idx)}
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
                ))}
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
            <p className="text-red-600 text-xs font-medium text-center bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{erro}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#d42b2b] hover:bg-red-700 disabled:opacity-60 text-white font-barlow font-bold uppercase text-sm tracking-wider py-3.5 rounded-xl transition-all shadow-md active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {gratisEfetivo ? 'Confirmando...' : 'Redirecionando para pagamento...'}
              </>
            ) : (
              gratisEfetivo ? 'Confirmar inscrição' : `Pagar ${formatPrice(total)} no Mercado Pago`
            )}
          </button>

          {!gratisEfetivo && (
            <p className="text-center text-[11px] text-[#aaa]">
              Pagamento 100% seguro via Mercado Pago · Cartão, Pix ou boleto
            </p>
          )}
        </form>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center justify-center gap-2 w-full bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase text-sm tracking-wider px-6 py-4 rounded-xl transition-colors shadow-md"
      >
        <ShoppingBag size={16} />
        {gratuito ? 'Garantir minha vaga' : 'Comprar ingresso'}
      </button>

      {mounted && modalJSX ? createPortal(modalJSX, document.body) : null}
    </>
  )
}
