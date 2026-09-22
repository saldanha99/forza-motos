'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BadgeCheck, LockKeyhole, Minus, Plus, ShoppingBag } from 'lucide-react'
import { carregarEMigrarAcessoEventoPirelli } from '@/lib/evento-pirelli/storage'
import { novaChaveIdempotenciaCliente } from '@/lib/checkout/chave-idempotencia-cliente'

const brl = (valor: number) => valor.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const TEMPO_LIMITE_CHECKOUT_MS = 70_000

function mensagemErroCheckout(error: unknown) {
  if (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name)) {
    return 'O pagamento demorou mais que o esperado. Sua tentativa foi preservada; tente novamente.'
  }
  return error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.'
}

type CadastroSalvo = {
  nomeCompleto?: string
  whatsapp?: string
  email?: string
}

export function CheckoutCanecaEventoPirelli(props: {
  tituloEvento: string
  local: string | null
  valorUnitario: number
  vendasAbertas: boolean
  limiteNomeGravacao: number
}) {
  const router = useRouter()
  const [pronto, setPronto] = useState(false)
  const [codigoQr, setCodigoQr] = useState('')
  const [cadastro, setCadastro] = useState<CadastroSalvo>({})
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [nomeGravacao, setNomeGravacao] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const tentativa = useRef<string | null>(null)

  useEffect(() => {
    try {
      const acesso = carregarEMigrarAcessoEventoPirelli(localStorage)
      setCodigoQr(acesso.codigoQr)
      const dados = acesso.cadastro as CadastroSalvo
      setCadastro(dados)
      setEmail(dados.email ?? '')
    } catch {
      // Safari privado/armazenamento bloqueado: mantém a tela utilizável e
      // orienta o participante a refazer o cadastro neste navegador.
    }
    setPronto(true)
  }, [])

  async function iniciarPagamento(event: FormEvent) {
    event.preventDefault()
    if (!codigoQr || enviando || !props.vendasAbertas) return
    setErro('')
    setEnviando(true)
    try {
      const id = tentativa.current ?? novaChaveIdempotenciaCliente()
      tentativa.current = id
      const resposta = await fetch('/api/evento-pirelli/caneca/checkout', {
        method: 'POST',
        signal: AbortSignal.timeout(TEMPO_LIMITE_CHECKOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': id,
        },
        body: JSON.stringify({
          codigoQr,
          email: email.trim(),
          cpf: cpf.replace(/\D/g, ''),
          nomeGravacao: nomeGravacao.trim().replace(/\s+/g, ' '),
          quantidade,
          checkoutTentativaId: id,
        }),
      })
      const dados = await resposta.json()
      if (!resposta.ok && resposta.status !== 202) {
        if (dados.retrySafe) tentativa.current = null
        throw new Error(dados.error || 'Não foi possível iniciar o pagamento.')
      }
      if (dados.init_point) {
        window.location.assign(dados.init_point)
        return
      }
      if (dados.pagamentoPendente) {
        router.push(`/evento-pirelli/caneca/pendente?token=${encodeURIComponent(id)}`)
        return
      }
      throw new Error('O Mercado Pago não devolveu o link de pagamento.')
    } catch (error) {
      setErro(mensagemErroCheckout(error))
    } finally {
      setEnviando(false)
    }
  }

  if (!pronto) return <div className="min-h-[70vh] bg-[#09090a]" />

  return (
    <main className="min-h-screen bg-[#09090a] px-5 py-10 text-white sm:py-16">
      <div className="mx-auto max-w-5xl">
        <Link href="/evento-pirelli" className="inline-flex items-center gap-2 text-sm font-bold text-white/55 transition hover:text-white">
          <ArrowLeft size={17} /> Voltar à experiência
        </Link>

        <div className="mt-7 grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#111114] shadow-2xl lg:grid-cols-[0.86fr_1.14fr]">
          <div className="relative min-h-80 bg-[#eee9df]">
            <Image
              src="/images/evento-pirelli/caneca-premium.webp"
              alt="Caneca preta premium personalizada da Forza Motos"
              fill
              sizes="(max-width: 1024px) 100vw, 42vw"
              className="object-cover"
              priority
            />
          </div>

          <div className="p-6 sm:p-10">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f5b82e]">Checkout exclusivo</p>
            <h1 className="mt-3 font-barlow text-4xl font-black uppercase leading-none sm:text-5xl">Sua caneca. Seu nome.</h1>
            <p className="mt-4 text-sm leading-relaxed text-white/55">Pagamento via Pix processado pelo Mercado Pago, sem cartão ou boleto. Escolha agora exatamente o nome que será gravado na sua caneca.</p>
            <p className="mt-4 inline-flex rounded-full border border-[#f5b82e]/25 bg-[#f5b82e]/10 px-4 py-2 font-barlow text-xl font-black text-[#f5b82e]">{brl(props.valorUnitario)} por unidade</p>

            {!props.vendasAbertas ? (
              <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm font-semibold text-amber-100">As vendas da caneca ainda não estão disponíveis.</div>
            ) : !codigoQr ? (
              <div className="mt-8 rounded-2xl border border-[#f5b82e]/25 bg-[#f5b82e]/10 p-5">
                <p className="font-bold">Faça primeiro seu cadastro gratuito.</p>
                <p className="mt-2 text-sm text-white/55">O acesso seguro vincula a compra ao seu cadastro e evita conferência manual no estande.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/evento-pirelli/cadastro?acao=caneca" className="inline-flex min-h-12 items-center rounded-xl bg-[#f5b82e] px-5 font-barlow text-sm font-black uppercase text-black">Cadastrar e continuar</Link>
                  <Link href="/evento-pirelli/cadastro?acao=caneca&recuperar=1" className="inline-flex min-h-12 items-center rounded-xl border border-white/15 px-5 text-sm font-bold text-white/75">Recuperar meu acesso</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={iniciarPagamento} className="mt-8 space-y-5">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm">
                  <span className="flex items-center gap-2 font-bold text-emerald-300"><BadgeCheck size={18} /> Participante identificado</span>
                  <p className="mt-2 text-white/70">{cadastro.nomeCompleto || 'Cadastro do evento'}</p>
                </div>

                <label className="block text-xs font-black uppercase tracking-wider text-white/55">Nome para gravar na caneca
                  <input required minLength={2} maxLength={props.limiteNomeGravacao} value={nomeGravacao} onChange={(e) => setNomeGravacao(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-4 text-base font-semibold text-white outline-none focus:border-[#f5b82e]" placeholder="Ex.: Maria Fernanda" />
                  <span className="mt-2 block text-[11px] normal-case tracking-normal text-white/38">{nomeGravacao.trim().length}/{props.limiteNomeGravacao} caracteres. Sem emojis.</span>
                </label>

                <label className="block text-xs font-black uppercase tracking-wider text-white/55">E-mail para confirmação
                  <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-4 text-base font-semibold text-white outline-none focus:border-[#f5b82e]" placeholder="voce@email.com" />
                </label>
                <label className="block text-xs font-black uppercase tracking-wider text-white/55">CPF do pagador
                  <input required inputMode="numeric" autoComplete="off" value={cpf} onChange={(e) => setCpf(e.target.value.slice(0, 18))} className="mt-2 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-4 text-base font-semibold text-white outline-none focus:border-[#f5b82e]" placeholder="000.000.000-00" />
                </label>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div><p className="text-xs font-black uppercase tracking-wider text-white/45">Quantidade</p><p className="mt-1 text-sm text-white/60">Até 10 unidades por compra</p></div>
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantidade((q) => Math.max(1, q - 1))} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15"><Minus size={17} /></button>
                    <strong className="min-w-6 text-center text-xl">{quantidade}</strong>
                    <button type="button" aria-label="Aumentar quantidade" onClick={() => setQuantidade((q) => Math.min(10, q + 1))} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15"><Plus size={17} /></button>
                  </div>
                </div>

                <div className="flex items-end justify-between border-t border-white/10 pt-5">
                  <div><p className="text-xs uppercase tracking-wider text-white/40">Total</p><p className="mt-1 font-barlow text-4xl font-black text-[#f5b82e]">{brl(props.valorUnitario * quantidade)}</p></div>
                  <p className="max-w-44 text-right text-xs text-white/38">Retirada e personalização durante a ação em {props.local || props.tituloEvento}.</p>
                </div>

                {erro && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-200">{erro}</p>}
                <button disabled={enviando} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#dc1f26] px-5 font-barlow text-sm font-black uppercase tracking-wider text-white transition hover:bg-[#ef2930] disabled:opacity-50">
                  <ShoppingBag size={18} /> {enviando ? 'Gerando pagamento…' : 'Pagar com Mercado Pago'}
                </button>
                <p className="flex items-center justify-center gap-2 text-xs text-white/38"><LockKeyhole size={14} /> Preço e participante são validados novamente no servidor.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
