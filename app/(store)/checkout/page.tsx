'use client'

import { useState, useEffect } from 'react'
import { useCartStore } from '@/store/cart'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatPrice } from '@/lib/utils'
import { calcularFrete } from '@/lib/correios'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

type Etapa = 'dados' | 'frete' | 'pagamento'

interface OpcaoFrete {
  codigo: string
  servico: string
  valor: number
  prazo: number
}

export default function CheckoutPage() {
  const { data: session } = useSession()
  const { items, subtotal, limpar } = useCartStore()
  const router = useRouter()

  const [etapa, setEtapa] = useState<Etapa>('dados')
  const [loading, setLoading] = useState(false)
  const [freteOpcoes, setFreteOpcoes] = useState<OpcaoFrete[]>([])
  const [freteSelecionado, setFreteSelecionado] = useState<OpcaoFrete | null>(null)

  const [form, setForm] = useState({
    nome: session?.user?.name ?? '',
    email: session?.user?.email ?? '',
    telefone: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
  })

  useEffect(() => {
    if (items.length === 0) router.replace('/carrinho')
  }, [items.length, router])

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
        setForm((f) => ({ ...f, rua: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }))
      }
    } catch {}
  }

  async function avancarParaFrete() {
    if (!form.nome || !form.email || !form.cep || !form.rua || !form.numero) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setLoading(true)
    try {
      const opcoes = await calcularFrete(form.cep, 1, subtotal())
      setFreteOpcoes(opcoes)
      setEtapa('frete')
    } catch {
      toast.error('Erro ao calcular frete')
    } finally {
      setLoading(false)
    }
  }

  async function finalizarPedido() {
    if (!freteSelecionado) return
    setLoading(true)
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.id, quantidade: i.quantidade, precoUnitario: i.preco })),
          enderecoEntrega: form,
          frete: freteSelecionado.valor,
          subtotal: subtotal(),
          total: subtotal() + freteSelecionado.valor,
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

  const total = subtotal() + (freteSelecionado?.valor ?? 0)
  const etapas: Etapa[] = ['dados', 'frete', 'pagamento']
  const etapaIdx = etapas.indexOf(etapa)

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
          {/* Etapa 1: Dados */}
          {etapa === 'dados' && (
            <div className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="font-grotesk font-semibold text-xl text-ink">Dados pessoais e entrega</h2>
              <Input label="Nome completo *" value={form.nome} onChange={(e) => updateForm('nome', e.target.value)} />
              <Input label="E-mail *" type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} />
              <Input label="Telefone" value={form.telefone} onChange={(e) => updateForm('telefone', e.target.value)} placeholder="(19) 99999-9999" />
              <Input label="CEP *" value={form.cep} onChange={(e) => updateForm('cep', e.target.value)} onBlur={buscarCEP} placeholder="00000-000" />
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input label="Rua *" value={form.rua} onChange={(e) => updateForm('rua', e.target.value)} />
                </div>
                <Input label="Número *" value={form.numero} onChange={(e) => updateForm('numero', e.target.value)} />
                <Input label="Complemento" value={form.complemento} onChange={(e) => updateForm('complemento', e.target.value)} />
                <Input label="Bairro" value={form.bairro} onChange={(e) => updateForm('bairro', e.target.value)} />
                <Input label="Cidade" value={form.cidade} onChange={(e) => updateForm('cidade', e.target.value)} />
              </div>
              <Button onClick={avancarParaFrete} loading={loading} className="w-full" size="lg">
                Calcular Frete
              </Button>
            </div>
          )}

          {/* Etapa 2: Frete */}
          {etapa === 'frete' && (
            <div className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="font-grotesk font-semibold text-xl text-ink">Escolha o frete</h2>
              {freteOpcoes.map((op) => (
                <label key={op.codigo} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${
                  freteSelecionado?.codigo === op.codigo
                    ? 'border-vermelho bg-[var(--vermelho-light)]'
                    : 'border-line hover:border-line-hi'
                }`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="frete"
                      checked={freteSelecionado?.codigo === op.codigo}
                      onChange={() => setFreteSelecionado(op)}
                      className="accent-vermelho"
                    />
                    <div>
                      <p className="font-semibold text-ink text-sm">{op.servico}</p>
                      <p className="text-xs text-faint">Prazo: até {op.prazo} dias úteis</p>
                    </div>
                  </div>
                  <span className="font-bold text-ink">{formatPrice(op.valor)}</span>
                </label>
              ))}
              <div className="flex gap-3 pt-2">
                <Button variant="surface" onClick={() => setEtapa('dados')} className="flex-1">Voltar</Button>
                <Button onClick={() => freteSelecionado && setEtapa('pagamento')} disabled={!freteSelecionado} className="flex-1" size="lg">
                  Ir para Pagamento
                </Button>
              </div>
            </div>
          )}

          {/* Etapa 3: Pagamento */}
          {etapa === 'pagamento' && (
            <div className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="font-grotesk font-semibold text-xl text-ink">Pagamento</h2>
              <div className="bg-surface border border-line rounded-xl p-5 text-sm text-dim">
                <p>Você será redirecionado para o <strong className="text-ink">Mercado Pago</strong> para concluir o pagamento com segurança.</p>
                <p className="mt-2 text-xs text-faint">Aceitamos: PIX, cartão de crédito/débito e boleto bancário.</p>
              </div>
              <div className="flex gap-3">
                <Button variant="surface" onClick={() => setEtapa('frete')} className="flex-1">Voltar</Button>
                <Button onClick={finalizarPedido} loading={loading} className="flex-1" size="lg">
                  Pagar {formatPrice(total)}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div>
          <div className="bg-card border border-line rounded-xl p-5 sticky top-24">
            <h3 className="font-grotesk font-semibold text-base text-ink mb-4">Resumo do pedido</h3>
            <div className="space-y-2 text-sm text-dim mb-4">
              {items.map((i) => (
                <div key={i.id} className="flex justify-between gap-2">
                  <span className="truncate">{i.nome} ×{i.quantidade}</span>
                  <span className="text-ink shrink-0 font-medium">{formatPrice(i.preco * i.quantidade)}</span>
                </div>
              ))}
              <div className="border-t border-line pt-2 flex justify-between">
                <span>Frete</span>
                <span className="text-ink">{freteSelecionado ? formatPrice(freteSelecionado.valor) : '–'}</span>
              </div>
              <div className="flex justify-between font-bold text-ink text-base pt-1">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
