'use client'

import { useState, useEffect } from 'react'
import { useCartStore } from '@/store/cart'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Check, Truck, Zap, Gift } from 'lucide-react'

type Etapa = 'dados' | 'frete' | 'pagamento'

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

  const [etapa, setEtapa]                   = useState<Etapa>('dados')
  const [loading, setLoading]               = useState(false)
  const [loadingFrete, setLoadingFrete]     = useState(false)
  const [freteOpcoes, setFreteOpcoes]       = useState<OpcaoFrete[]>([])
  const [freteSelecionado, setFreteSelecionado] = useState<OpcaoFrete | null>(null)

  const [cupomInput, setCupomInput]         = useState('')
  const [cupom, setCupom]                   = useState<{ codigo: string; desconto: number; descricao: string | null } | null>(null)
  const [loadingCupom, setLoadingCupom]     = useState(false)

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
  })

  // Só redireciona após o store ter hidratado do localStorage.
  // Sem este guard, o useEffect disparava antes da hidratação e
  // redirecionava erroneamente carrinho → checkout → carrinho.
  useEffect(() => {
    if (_hasHydrated && items.length === 0) router.replace('/carrinho')
  }, [_hasHydrated, items.length, router])

  if (!_hasHydrated) return null
  if (items.length === 0) return null

  function updateForm(field: string, value: string) {
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
    if (!form.nome || !form.email || !form.cep || !form.rua || !form.numero) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    if (form.cpf.replace(/\D/g, '').length !== 11) {
      toast.error('Informe um CPF válido (11 dígitos) para a nota fiscal')
      return
    }
    if (!form.estado) {
      toast.error('CEP não encontrado. Preencha o estado manualmente.')
      return
    }

    setLoadingFrete(true)
    try {
      const cepLimpo = form.cep.replace(/\D/g, '')
      const res = await fetch(
        `/api/frete/calcular?cep=${cepLimpo}&subtotal=${subtotal()}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const opcoes: OpcaoFrete[] = (data.opcoes ?? []).map((op: any) => ({
        ...op,
        gratis: op.preco === 0,
      }))

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

  async function finalizarPedido() {
    if (!freteSelecionado) return
    setLoading(true)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId:     i.id,
            quantidade:    i.quantidade,
            precoUnitario: i.preco,
          })),
          enderecoEntrega: form,
          cpf:      form.cpf,
          frete:    freteSelecionado.preco,
          freteServico:        freteSelecionado.id,
          freteTransportadora: freteSelecionado.transportadora,
          fretePrazo:          freteSelecionado.prazo,
          subtotal: subtotal(),
          cupomCodigo: cupom?.codigo,
          total:    subtotal() + freteSelecionado.preco - (cupom?.desconto ?? 0),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.init_point) {
        limpar()
        window.location.href = data.init_point
      } else {
        router.push(`/checkout/sucesso?pedido=${data.orderNumber}`)
        limpar()
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar pedido')
    } finally {
      setLoading(false)
    }
  }

  const total      = Math.max(0, subtotal() + (freteSelecionado?.preco ?? 0) - (cupom?.desconto ?? 0))
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
              <Input label="Telefone" value={form.telefone}
                onChange={(e) => updateForm('telefone', e.target.value)} placeholder="(19) 99999-9999" />
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
                <Input label="Bairro" value={form.bairro}
                  onChange={(e) => updateForm('bairro', e.target.value)} />
                <Input label="Cidade" value={form.cidade}
                  onChange={(e) => updateForm('cidade', e.target.value)} />
                <div className="col-span-2 sm:col-span-1">
                  <Input label="Estado" value={form.estado}
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
                          ? 'Retire hoje mesmo — horário comercial'
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
                  onClick={() => freteSelecionado && setEtapa('pagamento')}
                  disabled={!freteSelecionado}
                  className="flex-1"
                  size="lg"
                >
                  Ir para Pagamento
                </Button>
              </div>
            </div>
          )}

          {/* ── Etapa 3: Pagamento ── */}
          {etapa === 'pagamento' && (
            <div className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="font-grotesk font-semibold text-xl text-ink">Pagamento</h2>
              <div className="bg-surface border border-line rounded-xl p-5 text-sm text-dim">
                <p>
                  Você será redirecionado para o{' '}
                  <strong className="text-ink">Mercado Pago</strong> para concluir o pagamento com segurança.
                </p>
                <p className="mt-2 text-xs text-faint">
                  Aceitamos: PIX, cartão de crédito/débito e boleto bancário.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="surface" onClick={() => setEtapa('frete')} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={finalizarPedido} loading={loading} className="flex-1" size="lg">
                  Pagar {formatPrice(total)}
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
