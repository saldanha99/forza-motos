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
        setForm((f) => ({
          ...f,
          rua: d.logradouro,
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-rajdhani font-bold text-4xl text-white mb-8 uppercase tracking-wide">
        Checkout
      </h1>

      {/* Etapas */}
      <div className="flex items-center gap-3 mb-10 text-sm">
        {(['dados', 'frete', 'pagamento'] as Etapa[]).map((e, i) => (
          <div key={e} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              etapa === e ? 'bg-vermelho text-white' :
              i < ['dados','frete','pagamento'].indexOf(etapa) ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {i + 1}
            </div>
            <span className={etapa === e ? 'text-white font-medium capitalize' : 'text-zinc-500 capitalize'}>
              {e === 'dados' ? 'Dados' : e === 'frete' ? 'Frete' : 'Pagamento'}
            </span>
            {i < 2 && <div className="w-8 h-px bg-zinc-700" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* Etapa 1: Dados */}
          {etapa === 'dados' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
              <h2 className="font-rajdhani font-semibold text-xl text-white">Dados pessoais e entrega</h2>
              <Input label="Nome completo *" value={form.nome} onChange={(e) => updateForm('nome', e.target.value)} />
              <Input label="E-mail *" type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} />
              <Input label="Telefone" value={form.telefone} onChange={(e) => updateForm('telefone', e.target.value)} placeholder="(19) 99999-9999" />
              <Input
                label="CEP *"
                value={form.cep}
                onChange={(e) => updateForm('cep', e.target.value)}
                onBlur={buscarCEP}
                placeholder="00000-000"
              />
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
                Calcular frete
              </Button>
            </div>
          )}

          {/* Etapa 2: Frete */}
          {etapa === 'frete' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
              <h2 className="font-rajdhani font-semibold text-xl text-white">Escolha o frete</h2>
              {freteOpcoes.map((op) => (
                <label key={op.codigo} className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                  freteSelecionado?.codigo === op.codigo ? 'border-vermelho bg-vermelho/5' : 'border-zinc-700 hover:border-zinc-600'
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
                      <p className="font-semibold text-white">{op.servico}</p>
                      <p className="text-xs text-zinc-500">Prazo: até {op.prazo} dias úteis</p>
                    </div>
                  </div>
                  <span className="font-bold text-white">{formatPrice(op.valor)}</span>
                </label>
              ))}
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setEtapa('dados')} className="flex-1">Voltar</Button>
                <Button onClick={() => freteSelecionado && setEtapa('pagamento')} disabled={!freteSelecionado} className="flex-1" size="lg">
                  Ir para Pagamento
                </Button>
              </div>
            </div>
          )}

          {/* Etapa 3: Pagamento */}
          {etapa === 'pagamento' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
              <h2 className="font-rajdhani font-semibold text-xl text-white">Pagamento</h2>
              <div className="bg-zinc-800 rounded-lg p-4 text-sm text-zinc-400">
                <p>Você será redirecionado para o <strong className="text-white">Mercado Pago</strong> para concluir o pagamento com segurança.</p>
                <p className="mt-2 text-xs">Aceitamos: PIX, cartão de crédito/débito e boleto bancário.</p>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setEtapa('frete')} className="flex-1">Voltar</Button>
                <Button onClick={finalizarPedido} loading={loading} className="flex-1" size="lg">
                  Pagar {formatPrice(total)}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 sticky top-24">
            <h3 className="font-rajdhani font-semibold text-lg text-white mb-4">Resumo</h3>
            <div className="space-y-2 text-sm text-zinc-400 mb-4">
              {items.map((i) => (
                <div key={i.id} className="flex justify-between gap-2">
                  <span className="truncate">{i.nome} x{i.quantidade}</span>
                  <span className="text-white shrink-0">{formatPrice(i.preco * i.quantidade)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-700 pt-2 flex justify-between">
                <span>Frete</span>
                <span className="text-white">{freteSelecionado ? formatPrice(freteSelecionado.valor) : '-'}</span>
              </div>
              <div className="flex justify-between font-bold text-white text-base">
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
