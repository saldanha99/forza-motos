'use client'

import { useState, useEffect, useRef } from 'react'
import { useCartStore } from '@/store/cart'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Check, Gift, QrCode, Truck, Zap } from 'lucide-react'
import {
  calcularDescontoAvista,
  DESCONTO_AVISTA_PERCENTUAL,
  type MeioPagamentoCheckout,
} from '@/lib/checkout/desconto-avista'
import { novaChaveIdempotenciaCliente } from '@/lib/checkout/chave-idempotencia-cliente'
import { cpfValido } from '@/lib/checkout/entrada'

type Etapa = 'dados' | 'frete' | 'pagamento'

const TEMPO_LIMITE_CHECKOUT_MS = 70_000

function mensagemErroCheckout(error: unknown) {
  if (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name)) {
    return 'O pagamento demorou mais que o esperado. Seu carrinho foi preservado; tente novamente.'
  }
  return error instanceof Error ? error.message : 'Erro ao processar pedido'
}

interface OpcaoFrete {
  id:             string
  nome:           string
  transportadora: string
  preco:          number
  prazo:          number
  gratis?:        boolean
}

export default function CheckoutPage() {
  const { data: session } = useSession()
  const { items, subtotal, limpar, _hasHydrated } = useCartStore()
  const router = useRouter()
  const checkoutTentativaId = useRef<string | null>(null)

  const [etapa, setEtapa]                   = useState<Etapa>('dados')
  const [loading, setLoading]               = useState(false)
  const [loadingFrete, setLoadingFrete]     = useState(false)
  const [freteOpcoes, setFreteOpcoes]       = useState<OpcaoFrete[]>([])
  const [freteSelecionado, setFreteSelecionado] = useState<OpcaoFrete | null>(null)

  const [cupomInput, setCupomInput]         = useState('')
  const [cupom, setCupom]                   = useState<{ codigo: string; desconto: number; descricao: string | null } | null>(null)
  const [loadingCupom, setLoadingCupom]     = useState(false)
  const [nomeGravacaoEvento, setNomeGravacaoEvento] = useState('')
  const meioPagamento: MeioPagamentoCheckout = 'PIX'

  const [form, setForm] = useState({
    nome:        session?.user?.name  ?? '',
    email:       session?.user?.email ?? '',
    telefone:    '',
    cpf:         '',
    cep:         '',
    rua:         '',
    numero:      '',
    complemento: '',
    bairro:      '',
    cidade:      '',
    estado:      '',
    whatsappTransacionalAutorizado: false,
  })

  const chaveCarrinho = items
    .map((item) => `${item.id}:${item.quantidade}`)
    .sort()
    .join('|')

  // Uma opção só é válida para o CEP e o carrinho exatos usados na cotação.
  // Mudou qualquer um deles, o cliente precisa cotar e escolher novamente.
  useEffect(() => {
    setFreteOpcoes([])
    setFreteSelecionado(null)
    setCupom(null)
    setEtapa((atual) => (atual === 'dados' ? atual : 'dados'))
  }, [form.cep, chaveCarrinho])

  // Só redireciona após o store ter hidratado do localStorage.
  // Sem este guard, o useEffect disparava antes da hidratação e
  // redirecionava erroneamente carrinho → checkout → carrinho.
  useEffect(() => {
    if (_hasHydrated && items.length === 0) router.replace('/carrinho')
  }, [_hasHydrated, items.length, router])

  if (!_hasHydrated) return null
  if (items.length === 0) return null

  function updateForm(
    field: Exclude<keyof typeof form, 'whatsappTransacionalAutorizado'>,
    value: string,
  ) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function buscarCEP() {
    const cep = form.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const d = await r.json()
      if (!d.erro) {
        setForm((f) => ({
          ...f,
          rua:    d.logradouro,
          bairro: d.bairro,
          cidade: d.localidade,
          estado: d.uf,
        }))
      }
    } catch {}
  }

  async function avancarParaFrete() {
    if (
      !form.nome || !form.email || !form.telefone || !form.cep || !form.rua ||
      !form.numero || !form.bairro || !form.cidade || !form.estado
    ) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Informe um e-mail válido.')
      return
    }
    const telefone = form.telefone.replace(/\D/g, '')
    if (telefone.length < 10 || telefone.length > 13) {
      toast.error('Informe um telefone ou WhatsApp válido para a entrega.')
      return
    }
    if (!cpfValido(form.cpf)) {
      toast.error('Informe um CPF válido para a nota fiscal.')
      return
    }
    if (!form.estado) {
      toast.error('CEP não encontrado. Preencha o estado manualmente.')
      return
    }
    setLoadingFrete(true)
    setFreteOpcoes([])
    setFreteSelecionado(null)
    try {
      const cepLimpo = form.cep.replace(/\D/g, '')
      const res = await fetch('/api/frete/cotar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cepDestino: cepLimpo,
          items: items.map((item) => ({
            productId: item.id,
            quantidade: item.quantidade,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const opcoes: OpcaoFrete[] = (data.opcoes ?? []).map((op: any) => ({
        ...op,
        gratis: op.preco === 0,
      }))

      if (opcoes.length === 0) throw new Error('Nenhuma opção de entrega disponível para este CEP')

      setFreteOpcoes(opcoes)
      // Auto-seleciona se grátis ou única opção
      if (opcoes.length === 1) setFreteSelecionado(opcoes[0])
      setEtapa('frete')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao calcular frete. Tente novamente.')
    } finally {
      setLoadingFrete(false)
    }
  }

  async function aplicarCupom() {
    const codigo = cupomInput.trim()
    if (!codigo) return
    setLoadingCupom(true)
    try {
      const res = await fetch('/api/cupom/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, subtotal: subtotal() }),
      })
      const data = await res.json()
      if (data.erro) {
        setCupom(null)
        toast.error(data.erro)
        return
      }
      setCupom({ codigo: data.codigo, desconto: data.desconto, descricao: data.descricao })
      toast.success(`Cupom aplicado: −${formatPrice(data.desconto)}`)
    } catch {
      toast.error('Não foi possível validar o cupom.')
    } finally {
      setLoadingCupom(false)
    }
  }

  function removerCupom() {
    setCupom(null)
    setCupomInput('')
  }

  function avancarParaPagamento() {
    if (!freteSelecionado) {
      toast.error('Selecione uma opção de frete para continuar.')
      return
    }
    setEtapa('pagamento')
  }

  async function finalizarPedido() {
    if (!freteSelecionado) return
    if (ganhaCanecaEvento && !nomeGravacaoEvento.trim()) {
      toast.error('Informe o nome que será gravado na caneca do evento.')
      return
    }
    // Pix no Checkout Pro é assíncrono e o Mercado Pago não garante retorno
    // automático para a loja. Abrimos a cobrança em outra aba ainda dentro do
    // clique do usuário (evita bloqueio de popup) e mantemos a aba da Forza na
    // tela segura que consulta o webhook/cron até a confirmação oficial.
    const abaPagamento = window.open('about:blank', '_blank')
    if (abaPagamento) {
      abaPagamento.opener = null
      abaPagamento.document.title = 'Abrindo pagamento seguro…'
      abaPagamento.document.body.textContent = 'Abrindo o Pix no Mercado Pago…'
    }
    setLoading(true)
    try {
      const tentativaId = checkoutTentativaId.current ?? novaChaveIdempotenciaCliente()
      checkoutTentativaId.current = tentativaId
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        signal: AbortSignal.timeout(TEMPO_LIMITE_CHECKOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': tentativaId,
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId:  i.id,
            quantidade: i.quantidade,
          })),
          enderecoEntrega: form,
          cpf: form.cpf,
          // O servidor recota este ID e ignora preço/prazo do navegador.
          freteServico: freteSelecionado.id,
          cupomCodigo: cupom?.codigo,
          meioPagamento,
          checkoutTentativaId: tentativaId,
          eventoPirelliNomeGravacao: ganhaCanecaEvento ? nomeGravacaoEvento.trim().replace(/\s+/g, ' ') : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.retrySafe) checkoutTentativaId.current = null
        throw new Error(data.error)
      }

      if (data.init_point) {
        // Não limpe o store antes de sair: a mudança reativa para `items=[]`
        // dispara o redirect de carrinho vazio. O carrinho só é limpo quando
        // o servidor confirmar o pagamento oficial.
        if (abaPagamento && !abaPagamento.closed) {
          abaPagamento.location.replace(data.init_point)
          window.location.assign(`/checkout/sucesso?token=${encodeURIComponent(tentativaId)}`)
        } else {
          // Fallback para navegadores que bloqueiam a nova aba. Nesse caso o
          // botão "Voltar ao site" do Mercado Pago continua funcionando.
          window.location.assign(data.init_point)
        }
      } else if (data.pagamentoPendente && data.orderNumber) {
        abaPagamento?.close()
        limpar()
        toast(data.message || 'Pedido recebido. Estamos confirmando o pagamento.', {
          duration: 9000,
          icon: '⏳',
        })
        router.push(`/rastrear?pedido=${encodeURIComponent(data.orderNumber)}`)
      } else {
        throw new Error('Não foi possível iniciar o pagamento. Seu carrinho foi preservado.')
      }
    } catch (error) {
      abaPagamento?.close()
      toast.error(mensagemErroCheckout(error))
    } finally {
      setLoading(false)
    }
  }

  const itensEvento = items.filter((item) => item.eventoPirelli)
  const regraEvento = itensEvento[0]
  const subtotalPneusEvento = itensEvento.reduce((totalPneus, item) => {
    const categoria = (item.categoria ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    return /^PNEUS?(?:\s|$)/.test(categoria) ? totalPneus + item.preco * item.quantidade : totalPneus
  }, 0)
  const minimoEvento = regraEvento?.valorMinimoBrindeEvento
  const ganhaCanecaEvento = typeof minimoEvento === 'number' && (
    regraEvento.operadorValorMinimoBrindeEvento === 'MAIOR_OU_IGUAL'
      ? subtotalPneusEvento >= minimoEvento
      : subtotalPneusEvento > minimoEvento
  )
  const limiteNomeEvento = regraEvento?.limiteNomeGravacaoEvento ?? 20
  const subtotalProdutos = subtotal()
  const descontoCupom = cupom?.desconto ?? 0
  const descontoAvista = calcularDescontoAvista(subtotalProdutos, descontoCupom, meioPagamento)
  const totalSemDescontoAvista = Math.max(0, subtotalProdutos + (freteSelecionado?.preco ?? 0) - descontoCupom)
  const total = Math.max(0, totalSemDescontoAvista - descontoAvista)
  const etapas: Etapa[] = ['dados', 'frete', 'pagamento']
  const etapaIdx   = etapas.indexOf(etapa)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-grotesk font-bold text-3xl text-ink mb-8">Checkout</h1>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-10">
        {etapas.map((e, i) => (
          <div key={e} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < etapaIdx
                  ? 'bg-green-500 text-white'
                  : i === etapaIdx
                  ? 'bg-vermelho text-white shadow-md'
                  : 'bg-surface border border-line text-faint'
              }`}>
                {i < etapaIdx ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-sm font-medium capitalize hidden sm:inline ${
                i === etapaIdx ? 'text-ink' : i < etapaIdx ? 'text-dim' : 'text-faint'
              }`}>
                {e === 'dados' ? 'Dados' : e === 'frete' ? 'Frete' : 'Pagamento'}
              </span>
            </div>
            {i < 2 && <div className="w-12 sm:w-16 h-px bg-line mx-3" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">

          {/* ── Etapa 1: Dados ── */}
          {etapa === 'dados' && (
            <div className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="font-grotesk font-semibold text-xl text-ink">Dados pessoais e entrega</h2>
              <Input label="Nome completo *" value={form.nome}
                onChange={(e) => updateForm('nome', e.target.value)} />
              <Input label="E-mail *" type="email" value={form.email}
                onChange={(e) => updateForm('email', e.target.value)} />
              <Input label={itensEvento.length > 0 ? 'WhatsApp *' : 'Telefone / WhatsApp *'} value={form.telefone}
                onChange={(e) => updateForm('telefone', e.target.value)} placeholder="(19) 99999-9999" />
              <label className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-dim cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.whatsappTransacionalAutorizado}
                  onChange={(e) => setForm((atual) => ({
                    ...atual,
                    whatsappTransacionalAutorizado: e.target.checked,
                  }))}
                  className="mt-0.5 h-4 w-4 accent-red-600"
                />
                <span>
                  Quero receber no WhatsApp apenas atualizações deste pedido, como pagamento,
                  postagem e entrega. Posso cancelar quando quiser respondendo PARE.
                </span>
              </label>
              <Input label="CPF *" value={form.cpf}
                onChange={(e) => updateForm('cpf', e.target.value)} placeholder="000.000.000-00"
                maxLength={14} />
              <Input label="CEP *" value={form.cep}
                onChange={(e) => updateForm('cep', e.target.value)}
                onBlur={buscarCEP} placeholder="00000-000" />
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input label="Rua *" value={form.rua}
                    onChange={(e) => updateForm('rua', e.target.value)} />
                </div>
                <Input label="Número *" value={form.numero}
                  onChange={(e) => updateForm('numero', e.target.value)} />
                <Input label="Complemento" value={form.complemento}
                  onChange={(e) => updateForm('complemento', e.target.value)} />
                <Input label="Bairro *" value={form.bairro}
                  onChange={(e) => updateForm('bairro', e.target.value)} />
                <Input label="Cidade *" value={form.cidade}
                  onChange={(e) => updateForm('cidade', e.target.value)} />
                <div className="col-span-2 sm:col-span-1">
                  <Input label="Estado *" value={form.estado}
                    onChange={(e) => updateForm('estado', e.target.value.toUpperCase())}
                    placeholder="SP" maxLength={2} />
                </div>
              </div>
              <Button onClick={avancarParaFrete} loading={loadingFrete} className="w-full" size="lg">
                Continuar para o Frete
              </Button>
            </div>
          )}

          {/* ── Etapa 2: Frete ── */}
          {etapa === 'frete' && (
            <div className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="font-grotesk font-semibold text-xl text-ink">Escolha o frete</h2>
              <p className="text-sm text-dim">
                Entregando em <strong className="text-ink">{form.cidade} — {form.estado}</strong>
              </p>

              {freteOpcoes.map((op) => (
                <label
                  key={op.id}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    freteSelecionado?.id === op.id
                      ? 'border-vermelho bg-[var(--vermelho-light)]'
                      : 'border-line hover:border-line-hi'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="frete"
                      checked={freteSelecionado?.id === op.id}
                      onChange={() => setFreteSelecionado(op)}
                      className="accent-vermelho"
                    />
                    <div>
                      <p className="font-semibold text-ink text-sm flex items-center gap-1.5">
                        {op.gratis
                          ? <Gift size={14} className="text-green-500" />
                          : op.prazo <= 3
                          ? <Zap size={14} className="text-amber-500" />
                          : <Truck size={14} className="text-dim" />
                        }
                        {op.nome}
                        {op.transportadora && (
                          <span className="text-faint font-normal text-[11px]">· {op.transportadora}</span>
                        )}
                      </p>
                      <p className="text-xs text-faint">
                        {op.id === 'retirada'
                          ? op.prazo > 0
                            ? `Retirada após disponibilidade — até ${op.prazo} dias úteis`
                            : 'Retire hoje mesmo — horário comercial'
                          : `Prazo: até ${op.prazo} dias úteis`}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold text-base ${op.gratis ? 'text-green-600' : 'text-ink'}`}>
                    {op.preco === 0 ? 'Grátis 🎉' : formatPrice(op.preco)}
                  </span>
                </label>
              ))}

              <div className="flex gap-3 pt-2">
                <Button variant="surface" onClick={() => setEtapa('dados')} className="flex-1">
                  Voltar
                </Button>
                <Button
                  onClick={avancarParaPagamento}
                  className="flex-1"
                  size="lg"
                >
                  Ir para Pagamento
                </Button>
              </div>
              {!freteSelecionado ? (
                <p role="status" className="text-center text-xs font-medium text-amber-700">
                  Selecione uma opção de frete acima para continuar.
                </p>
              ) : null}
            </div>
          )}

          {/* ── Etapa 3: Pagamento ── */}
          {etapa === 'pagamento' && (
            <div className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="font-grotesk font-semibold text-xl text-ink">Pagamento</h2>
              {ganhaCanecaEvento && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
                  <p className="font-bold text-amber-950">Você ganhou uma caneca personalizada</p>
                  <p className="mt-1 text-sm text-amber-900/70">Informe agora exatamente o nome que deve ser gravado.</p>
                  <Input label="Nome para gravar *" value={nomeGravacaoEvento} onChange={(e) => setNomeGravacaoEvento(e.target.value)} maxLength={limiteNomeEvento} placeholder="Ex.: Maria Fernanda" />
                  <p className="mt-1 text-xs text-amber-900/55">{nomeGravacaoEvento.trim().length}/{limiteNomeEvento} caracteres. Sem emojis.</p>
                </div>
              )}
              <section aria-labelledby="forma-pagamento-pix" className="space-y-3">
                <h3 id="forma-pagamento-pix" className="text-sm font-semibold text-ink">Forma de pagamento</h3>
                <div className="flex items-center gap-3 rounded-xl border border-vermelho bg-[var(--vermelho-light)] p-4">
                  <QrCode size={22} className="shrink-0 text-vermelho" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">Pix</span>
                    <span className="block text-xs font-medium text-green-600">
                      Pagamento à vista · {DESCONTO_AVISTA_PERCENTUAL}% de desconto
                    </span>
                  </span>
                  <strong className="shrink-0 text-sm text-ink">{formatPrice(total)}</strong>
                </div>
              </section>
              <div className="bg-surface border border-line rounded-xl p-5 text-sm text-dim">
                <p>
                  Você será redirecionado para o{' '}
                  <strong className="text-ink">Mercado Pago</strong> para gerar e concluir o pagamento via Pix.
                </p>
                <p className="mt-2 text-xs text-faint">
                  Cartão e boleto estão desativados. A confirmação do Pix acontece automaticamente após o pagamento.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="surface" onClick={() => setEtapa('frete')} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={finalizarPedido} loading={loading} className="flex-1" size="lg">
                  Pagar {formatPrice(total)} via Pix
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Resumo lateral ── */}
        <div>
          <div className="bg-card border border-line rounded-xl p-5 sticky top-24">
            <h3 className="font-grotesk font-semibold text-base text-ink mb-4">Resumo do pedido</h3>
            <div className="space-y-2 text-sm text-dim mb-4">
              {items.map((i) => (
                <div key={i.id} className="flex justify-between gap-2">
                  <span className="truncate">{i.nome} ×{i.quantidade}</span>
                  <span className="text-ink shrink-0 font-medium">
                    {formatPrice(i.preco * i.quantidade)}
                  </span>
                </div>
              ))}
              <div className="border-t border-line pt-2 flex justify-between">
                <span>Frete</span>
                <span className={freteSelecionado?.gratis ? 'text-green-600 font-semibold' : 'text-ink'}>
                  {freteSelecionado
                    ? freteSelecionado.preco === 0
                      ? 'Grátis 🎉'
                      : formatPrice(freteSelecionado.preco)
                    : '–'
                  }
                </span>
              </div>
              {cupom && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Cupom {cupom.codigo}</span>
                  <span>−{formatPrice(cupom.desconto)}</span>
                </div>
              )}
              {descontoAvista > 0 && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Desconto à vista ({DESCONTO_AVISTA_PERCENTUAL}%)</span>
                  <span>−{formatPrice(descontoAvista)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-ink text-base pt-1">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {/* Cupom de desconto */}
            <div className="mb-4">
              {cupom ? (
                <button
                  onClick={removerCupom}
                  className="text-xs text-faint hover:text-red-500 transition-colors underline"
                >
                  Remover cupom
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={cupomInput}
                    onChange={(e) => setCupomInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') aplicarCupom() }}
                    placeholder="Cupom de desconto"
                    className="flex-1 min-w-0 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink uppercase outline-none focus:border-vermelho transition-colors"
                  />
                  <Button variant="surface" onClick={aplicarCupom} loading={loadingCupom} className="shrink-0">
                    Aplicar
                  </Button>
                </div>
              )}
            </div>

            {/* Badge frete grátis no resumo */}
            {freteSelecionado?.gratis && (
              <div className="text-xs text-center py-2 rounded-lg font-semibold"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#15803d' }}>
                🎉 Frete Grátis aplicado!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
