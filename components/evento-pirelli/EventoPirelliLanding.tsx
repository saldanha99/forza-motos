'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Gift,
  KeyRound,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  UserPlus,
  Wrench,
} from 'lucide-react'
import {
  QuizPublicoEventoPirelli,
  type QuizPublico,
  type ResultadoQuizPublico,
} from '@/components/evento-pirelli/QuizPublicoEventoPirelli'
import {
  carregarEMigrarAcessoEventoPirelli,
  limparAcessoLocalEventoPirelli,
  salvarAcessoRecuperadoEventoPirelli,
  STORAGE_EVENTO_PIRELLI,
} from '@/lib/evento-pirelli/storage'
import { useCartStore } from '@/store/cart'

const LOGO_FORZA_PADRAO = '/images/logo-forza.png'
const LOGO_PIRELLI_PADRAO = '/images/brands/pirelli.svg'

export type AcaoEventoPirelli = 'quiz' | 'balanceamento' | 'caneca' | 'ofertas'
export type AcaoCadastroEventoPirelli = Exclude<AcaoEventoPirelli, 'ofertas'>
export type AcaoExperienciaEventoPirelli = Extract<AcaoEventoPirelli, 'quiz' | 'balanceamento'>
export type PaginaEventoPirelli = 'landing' | 'cadastro' | 'experiencia' | 'ofertas'

export type EventoPublicoPirelli = {
  titulo: string
  descricao: string | null
  local: string | null
  dataInicio: string | null
  dataFim: string | null
  logoForzaUrl: string | null
  logoPirelliUrl: string | null
  logoCampneusUrl: string | null
  limiteNomeGravacao: number
  valorMinimoPneus: number
  valorCanecaAvulsa: number
  ativo: boolean
  publicado: boolean
  inscricoesAntecipadasAbertas: boolean
  vendasAntecipadasAbertas: boolean
  quizEncerradoEm: string | null
  operadorValorMinimoPneus?: 'MAIOR_QUE' | 'MAIOR_OU_IGUAL'
}

export type ProdutoEventoPirelli = {
  id: string
  nome: string
  slug: string
  descricao: string | null
  preco: number
  precoPromocional: number | null
  imagens: string[]
  estoque: number
  marca: string
  categoria: string
  ehPai: boolean
  preVenda: boolean
  prazoEntregaDias: number | null
  limitePorPedidoEvento: number | null
}

type FormCadastro = {
  nomeCompleto: string
  whatsapp: string
  email: string
  enderecoCep: string
  enderecoRua: string
  enderecoNumero: string
  enderecoComplemento: string
  enderecoBairro: string
  enderecoCidade: string
  enderecoEstado: string
  motoMarca: string
  motoModelo: string
  motoAno: string
  consentimentoMarketing: boolean
}

const FORM_CADASTRO_VAZIO: FormCadastro = {
  nomeCompleto: '',
  whatsapp: '',
  email: '',
  enderecoCep: '',
  enderecoRua: '',
  enderecoNumero: '',
  enderecoComplemento: '',
  enderecoBairro: '',
  enderecoCidade: '',
  enderecoEstado: '',
  motoMarca: '',
  motoModelo: '',
  motoAno: '',
  consentimentoMarketing: false,
}

type VisitanteRecuperado = {
  codigoQr: string
  nomeCompleto: string
  whatsapp: string
  email?: string | null
}

type InicioRecuperacao = {
  chave: string
  whatsapp: string
  solicitado: boolean
  enviando: boolean
  mensagem: string
  erro: string
}

const ACOES: Record<AcaoEventoPirelli, { numero: string; etiqueta: string; titulo: string; descricao: string; cta: string }> = {
  caneca: {
    numero: '01',
    etiqueta: 'Caneca personalizada',
    titulo: 'Compre sua caneca exclusiva.',
    descricao: 'Faça seu cadastro e, no checkout da caneca, escolha exatamente o nome que será gravado.',
    cta: 'Cadastrar e comprar caneca',
  },
  ofertas: {
    numero: '02',
    etiqueta: 'Vitrine exclusiva',
    titulo: 'Compre pneus e ganhe a caneca.',
    descricao: 'Nas compras participantes acima do valor da ação, você escolhe o nome da caneca durante o checkout.',
    cta: 'Ver produtos sem cadastro',
  },
  quiz: {
    numero: '03',
    etiqueta: 'Quiz cronometrado',
    titulo: 'Você entende de pneu?',
    descricao: 'Perguntas e alternativas em ordem aleatória. Quem acertar tudo no menor tempo ganha a caneca.',
    cta: 'Cadastrar e iniciar quiz',
  },
  balanceamento: {
    numero: '04',
    etiqueta: 'Experiência prática',
    titulo: 'Você sabe balancear uma roda?',
    descricao: 'Reserve sua participação e veja como nossos especialistas identificam e corrigem o desequilíbrio.',
    cta: 'Cadastrar e participar',
  },
}

const ROTAS_ACOES: Record<AcaoCadastroEventoPirelli, string> = {
  caneca: '/evento-pirelli/caneca',
  quiz: '/evento-pirelli/quiz',
  balanceamento: '/evento-pirelli/balanceamento',
}

const CTAS_ACOES: Record<AcaoCadastroEventoPirelli, string> = {
  caneca: 'Continuar para comprar a caneca',
  quiz: 'Continuar para o quiz',
  balanceamento: 'Continuar para o balanceamento',
}

function novaChave() {
  const gerador = typeof crypto !== 'undefined' ? crypto : undefined
  if (gerador?.randomUUID) return gerador.randomUUID()
  if (gerador?.getRandomValues) {
    return Array.from(gerador.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

const brl = (valor: number) => valor.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: valor % 1 === 0 ? 0 : 2,
  maximumFractionDigits: 2,
})

export function EventoPirelliLanding({ evento, produtos = [], pagina = 'landing', acao, recuperarAcesso = false, disponivel, experienciasDisponiveis, vendasDisponiveis, statusParticipacao }: {
  evento: EventoPublicoPirelli
  produtos?: ProdutoEventoPirelli[]
  pagina?: PaginaEventoPirelli
  acao?: AcaoCadastroEventoPirelli | AcaoExperienciaEventoPirelli
  recuperarAcesso?: boolean
  disponivel: boolean
  experienciasDisponiveis: boolean
  vendasDisponiveis: boolean
  statusParticipacao: string | null
}) {
  const [form, setForm] = useState<FormCadastro>({ ...FORM_CADASTRO_VAZIO })
  const [storagePronto, setStoragePronto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [quiz, setQuiz] = useState<QuizPublico | null>(null)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<ResultadoQuizPublico | null>(null)
  const [carregandoQuiz, setCarregandoQuiz] = useState(false)
  const [quizSolicitado, setQuizSolicitado] = useState(false)
  const [recuperacaoAberta, setRecuperacaoAberta] = useState(recuperarAcesso)
  const [recuperacaoPorCadastroExistente, setRecuperacaoPorCadastroExistente] = useState(false)
  const [inicioRecuperacao, setInicioRecuperacao] = useState<InicioRecuperacao | null>(null)
  const chaveSubmissaoEmMemoria = useRef('')
  const recuperacaoAutomaticaEmAndamento = useRef(false)
  const quizCarregandoEmMemoria = useRef(false)

  useEffect(() => {
    if (pagina === 'ofertas') {
      setStoragePronto(true)
      return
    }
    try {
      const acesso = carregarEMigrarAcessoEventoPirelli(localStorage)
      setForm((atual) => ({ ...atual, ...acesso.cadastro }))
      if (acesso.codigoQr) setCodigo(acesso.codigoQr)
      if (acesso.chaveSubmissao) chaveSubmissaoEmMemoria.current = acesso.chaveSubmissao
    } catch {
      // Armazenamento pode estar indisponível em navegação privada. A página
      // continua funcional e o cadastro orienta o participante normalmente.
    }
    setStoragePronto(true)
  }, [pagina])

  useEffect(() => {
    if (pagina !== 'cadastro' || !storagePronto) return
    try { localStorage.setItem(STORAGE_EVENTO_PIRELLI.cadastro, JSON.stringify(form)) } catch {}
  }, [form, pagina, storagePronto])

  useEffect(() => {
    if (pagina === 'ofertas' || !codigo) return
    try { localStorage.setItem(STORAGE_EVENTO_PIRELLI.codigoQr, codigo) } catch {}
  }, [codigo, pagina])

  const carregarQuiz = useCallback(async (codigoInformado = codigo) => {
    if (quizCarregandoEmMemoria.current) return
    quizCarregandoEmMemoria.current = true
    setErro('')
    setCarregandoQuiz(true)
    try {
      const resposta = await fetch(`/api/evento-pirelli/quiz?codigo=${encodeURIComponent(codigoInformado)}`)
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.error || 'Não foi possível abrir o quiz.')
      setQuiz(dados)
      if (dados.tentativa?.concluidaEm) {
        setResultado({
          tentativa: dados.tentativa,
          classificadoQuiz: Boolean(dados.classificadoQuiz ?? dados.tentativa.acertouTodas),
          posicaoAtual: dados.posicaoAtual ?? null,
          quizEncerrado: Boolean(dados.quizEncerrado),
          vencedorQuiz: Boolean(dados.vencedorQuiz),
        })
      } else {
        setResultado(null)
      }
      setQuizSolicitado(true)
    } catch (error) {
      setQuiz(null)
      setQuizSolicitado(true)
      setErro(error instanceof Error ? error.message : 'Não foi possível abrir o quiz.')
    } finally {
      quizCarregandoEmMemoria.current = false
      setCarregandoQuiz(false)
    }
  }, [codigo])

  async function cadastrar(event: FormEvent) {
    event.preventDefault()
    setErro('')
    setEnviando(true)
    let chaveSubmissao = chaveSubmissaoEmMemoria.current || novaChave()
    try {
      chaveSubmissao = localStorage.getItem(STORAGE_EVENTO_PIRELLI.chaveSubmissao) ?? chaveSubmissao
      localStorage.setItem(STORAGE_EVENTO_PIRELLI.chaveSubmissao, chaveSubmissao)
    } catch {}
    chaveSubmissaoEmMemoria.current = chaveSubmissao
    try {
      const resposta = await fetch('/api/evento-pirelli/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, chaveSubmissao }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) {
        if (resposta.status === 409 && dados.recuperavel === true) {
          // O envio parte diretamente do gesto de confirmar cadastro. Assim a
          // recuperação abre já na etapa do código, sem um effect que possa
          // duplicar o disparo no Strict Mode do React.
          if (recuperacaoAutomaticaEmAndamento.current) return
          recuperacaoAutomaticaEmAndamento.current = true
          let inicio: InicioRecuperacao = {
            chave: novaChave(),
            whatsapp: form.whatsapp,
            solicitado: true,
            enviando: true,
            mensagem: 'Estamos enviando seu código seguro agora.',
            erro: '',
          }
          setErro('')
          setInicioRecuperacao(inicio)
          setRecuperacaoPorCadastroExistente(true)
          setRecuperacaoAberta(true)
          try {
            const respostaRecuperacao = await fetch('/api/evento-pirelli/recuperacao', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ acao: 'solicitar', whatsapp: form.whatsapp }),
            })
            const dadosRecuperacao = await respostaRecuperacao.json()
            if (!respostaRecuperacao.ok) {
              throw new Error(dadosRecuperacao.error || 'Não foi possível enviar o código.')
            }
            inicio = {
              ...inicio,
              solicitado: true,
              enviando: false,
              mensagem: dadosRecuperacao.message,
            }
          } catch (error) {
            inicio = {
              ...inicio,
              solicitado: false,
              enviando: false,
              mensagem: '',
              erro: error instanceof Error ? error.message : 'Não foi possível enviar o código.',
            }
          } finally {
            recuperacaoAutomaticaEmAndamento.current = false
          }
          setInicioRecuperacao(inicio)
          return
        }
        throw new Error(dados.error)
      }
      setCodigo(dados.visitante.codigoQr)
      chaveSubmissaoEmMemoria.current = ''
      try { localStorage.removeItem(STORAGE_EVENTO_PIRELLI.chaveSubmissao) } catch {}
    } catch (error: any) {
      setErro(error.message || 'A conexão falhou. Seus dados continuam salvos neste aparelho; tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  function aplicarAcessoRecuperado(visitante: VisitanteRecuperado) {
    try { salvarAcessoRecuperadoEventoPirelli(localStorage, visitante) } catch {}
    setForm((atual) => ({
      ...atual,
      nomeCompleto: visitante.nomeCompleto,
      whatsapp: visitante.whatsapp,
      ...(visitante.email ? { email: visitante.email } : {}),
    }))
    setCodigo(visitante.codigoQr)
    setErro('')
    setAviso('Acesso recuperado com segurança. Suas experiências já estão liberadas neste aparelho.')
    setInicioRecuperacao(null)
    setRecuperacaoPorCadastroExistente(false)
    setRecuperacaoAberta(false)
  }

  function trocarParticipanteNesteAparelho() {
    try { limparAcessoLocalEventoPirelli(localStorage) } catch {}
    chaveSubmissaoEmMemoria.current = ''
    setForm({ ...FORM_CADASTRO_VAZIO })
    setCodigo('')
    setErro('')
    setAviso('')
    setQuiz(null)
    setRespostas({})
    setResultado(null)
    setQuizSolicitado(false)
    setInicioRecuperacao(null)
    setRecuperacaoPorCadastroExistente(false)
    setRecuperacaoAberta(false)
  }

  async function enviarQuiz() {
    setErro('')
    const resposta = await fetch('/api/evento-pirelli/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, respostas }),
    })
    const dados = await resposta.json()
    if (resposta.ok) setResultado(dados)
    else setErro(dados.error)
  }

  async function participar(tipo: 'balanceamento', extra: { horario?: string }) {
    setErro('')
    setAviso('')
    const resposta = await fetch('/api/evento-pirelli/participacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, tipo, horario: extra.horario ?? null }),
    })
    const dados = await resposta.json()
    if (resposta.ok) {
      setAviso('Participação registrada. A equipe do estande já consegue visualizar seu nome.')
    } else setErro(dados.error)
  }

  const logoForza = evento.logoForzaUrl || LOGO_FORZA_PADRAO
  const logoPirelli = evento.logoPirelliUrl || LOGO_PIRELLI_PADRAO
  const data = evento.dataInicio ? new Date(evento.dataInicio) : null
  const contexto = acao ? ACOES[acao] : null

  if (pagina === 'cadastro') {
    const destino = acao ? ROTAS_ACOES[acao] : '/evento-pirelli'
    const textoBotao = acao ? CTAS_ACOES[acao] : 'Escolher uma experiência'

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#09090a] px-5 py-5 text-white antialiased sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto max-w-5xl">
          <header className="flex flex-col gap-5 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <Marcas forza={logoForza} pirelli={logoPirelli} campneus={evento.logoCampneusUrl} />
            <Link href="/evento-pirelli" className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-white/12 px-4 text-sm font-bold text-white/60 transition hover:border-white/25 hover:text-white">
              <ChevronLeft size={17} /> Voltar às opções
            </Link>
          </header>

          <section className="py-10 sm:py-14">
            <div className="mx-auto mb-8 max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f5b82e]">{codigo ? 'Acesso confirmado' : recuperacaoAberta ? 'Recuperação de acesso' : 'Cadastro do participante'}</p>
              <h1 className="mt-3 font-barlow text-4xl font-black uppercase leading-none sm:text-6xl">
                {codigo ? 'Tudo pronto para continuar.' : recuperacaoAberta ? 'Entre com seu código seguro.' : 'Primeiro, seus dados.'}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
                {codigo
                  ? acao === 'quiz'
                    ? 'Seu cadastro foi salvo. O quiz ainda não começou; primeiro você verá a tela de preparação.'
                    : 'Seu cadastro vale para todas as experiências. A próxima ação só abre quando você escolher continuar.'
                  : contexto?.descricao || 'Faça um único cadastro para participar das experiências Pirelli × Forza Motos.'}
              </p>
            </div>

            {!storagePronto ? (
              <div className="mx-auto h-80 max-w-4xl animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" aria-label="Carregando seu acesso" />
            ) : !codigo ? (
              <FormularioCadastro
                form={form}
                setForm={setForm}
                enviando={enviando}
                erro={erro}
                onSubmit={cadastrar}
                disponivel={disponivel}
                statusParticipacao={statusParticipacao}
                recuperacaoAberta={recuperacaoAberta}
                recuperacaoPorCadastroExistente={recuperacaoPorCadastroExistente}
                inicioRecuperacao={inicioRecuperacao}
                setRecuperacaoAberta={setRecuperacaoAberta}
                setRecuperacaoPorCadastroExistente={setRecuperacaoPorCadastroExistente}
                setInicioRecuperacao={setInicioRecuperacao}
                onRecuperado={aplicarAcessoRecuperado}
              />
            ) : (
              <section className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#111114] shadow-2xl">
                <div className="p-6 sm:p-9">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-400/10 text-emerald-400"><CheckCircle2 size={30} /></span>
                  <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#f5b82e]">Cadastro confirmado</p>
                  <h2 className="mt-2 font-barlow text-4xl font-black uppercase leading-none">Olá, {form.nomeCompleto}</h2>
                  <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/55">Seu acesso foi vinculado com segurança ao WhatsApp cadastrado. Tentativas, compras e eventuais prêmios serão reconhecidos automaticamente pelo sistema.</p>
                  {aviso ? <p aria-live="polite" className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-300">{aviso}</p> : null}
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <Link href={destino} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#dc1f26] px-5 text-center font-barlow text-sm font-black uppercase tracking-wider text-white transition hover:bg-[#ef2930]">
                      {textoBotao} <ArrowRight size={18} />
                    </Link>
                    <Link href="/evento-pirelli" className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/15 px-5 text-center text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white">Ver todas as opções</Link>
                  </div>
                  <button type="button" onClick={trocarParticipanteNesteAparelho} className="mt-5 inline-flex min-h-11 items-center gap-2 text-xs font-bold text-white/45 transition hover:text-white/75">
                    <KeyRound size={15} /> Usar outro cadastro neste aparelho
                  </button>
                </div>
              </section>
            )}
          </section>
        </div>
      </main>
    )
  }

  if (pagina === 'experiencia') {
    const acaoDedicada = acao === 'quiz' || acao === 'balanceamento' ? acao : null
    const contextoDedicado = acaoDedicada ? ACOES[acaoDedicada] : null
    const quizSomenteConsulta = acaoDedicada === 'quiz' && (!experienciasDisponiveis || Boolean(evento.quizEncerradoEm))

    return (
      <main className="min-h-screen bg-[#09090a] px-5 py-5 text-white antialiased sm:px-8 sm:py-8">
        <div className="mx-auto max-w-4xl">
          <header className="flex flex-col gap-5 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <Marcas forza={logoForza} pirelli={logoPirelli} campneus={evento.logoCampneusUrl} />
            <Link href="/evento-pirelli" className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-white/12 px-4 text-sm font-bold text-white/60 transition hover:border-white/25 hover:text-white">
              <ChevronLeft size={17} /> Voltar às opções
            </Link>
          </header>

          <section className="py-10 sm:py-14">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f5b82e]">{contextoDedicado?.etiqueta || 'Experiência Pirelli × Forza'}</p>
              <h1 className="mt-3 font-barlow text-4xl font-black uppercase leading-none sm:text-6xl">{contextoDedicado?.titulo || 'Escolha uma experiência.'}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">{contextoDedicado?.descricao}</p>
            </div>

            {!storagePronto ? (
              <div className="h-64 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" aria-label="Carregando seu acesso" />
            ) : !acaoDedicada ? (
              <CartaoMensagem titulo="Experiência não encontrada" texto="Volte à página principal e escolha uma das opções disponíveis." href="/evento-pirelli" cta="Ver todas as opções" />
            ) : !codigo ? (
              quizSomenteConsulta ? (
                <CartaoMensagem
                  titulo="Recupere seu acesso"
                  texto="O resultado final fica ligado ao seu cadastro e à tentativa única registrada no servidor. Recupere seu acesso para consultá-lo."
                  href="/evento-pirelli/cadastro?acao=quiz&recuperar=1"
                  cta="Recuperar acesso e ver resultado"
                />
              ) : (
                <CartaoMensagem
                  titulo="Identifique-se para participar"
                  texto="O cadastro acontece em uma tela própria. Depois, você volta para esta experiência sem precisar preencher seus dados novamente."
                  href={`/evento-pirelli/cadastro?acao=${acaoDedicada}`}
                  cta="Fazer meu cadastro"
                  hrefSecundario={`/evento-pirelli/cadastro?acao=${acaoDedicada}&recuperar=1`}
                  ctaSecundario="Já tenho cadastro"
                />
              )
            ) : !experienciasDisponiveis && acaoDedicada !== 'quiz' ? (
              <CartaoMensagem titulo="Experiência ainda indisponível" texto={statusParticipacao || 'Esta experiência ainda não está liberada.'} href="/evento-pirelli" cta="Voltar às opções" />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-3 text-sm text-white/70"><BadgeCheck size={20} className="shrink-0 text-emerald-400" /><span><strong className="block text-white">Participante identificado</strong>{form.nomeCompleto || 'Cadastro do evento'}</span></p>
                  <button type="button" onClick={trocarParticipanteNesteAparelho} className="self-start text-xs font-bold text-white/45 transition hover:text-white/75">Usar outro cadastro</button>
                </div>

                {erro ? <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-200">{erro}</p> : null}

                {acaoDedicada === 'quiz' ? (
                  !quizSolicitado ? (
                    <section className="rounded-[2rem] border border-white/10 bg-[#111114] p-7 text-center shadow-2xl sm:p-10">
                      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#f5b82e]/10 text-[#f5b82e]"><Trophy size={31} /></span>
                      <h2 className="mt-5 font-barlow text-3xl font-black uppercase sm:text-4xl">{quizSomenteConsulta ? 'Consulte seu resultado' : 'Pronto para começar?'}</h2>
                      <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/55">
                        {quizSomenteConsulta
                          ? 'Se você já concluiu a tentativa, abra aqui a apuração final e confira se foi o vencedor.'
                          : 'A tentativa é única. O cronômetro oficial só começa quando você tocar no botão abaixo. Prepare-se antes de iniciar.'}
                      </p>
                      {quizSomenteConsulta && statusParticipacao ? <p role="status" className="mx-auto mt-4 max-w-xl rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">{statusParticipacao}</p> : null}
                      <button type="button" disabled={carregandoQuiz} onClick={() => void carregarQuiz()} className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#dc1f26] px-6 font-barlow text-sm font-black uppercase tracking-wider text-white transition hover:bg-[#ef2930] disabled:opacity-50 sm:w-auto">
                        <Clock3 size={18} /> {carregandoQuiz ? 'Consultando…' : quizSomenteConsulta ? 'Consultar meu resultado' : 'Iniciar tentativa oficial'}
                      </button>
                    </section>
                  ) : carregandoQuiz ? (
                    <CartaoQuiz>Preparando suas perguntas…</CartaoQuiz>
                  ) : quiz ? (
                    <QuizPublicoEventoPirelli
                      quiz={quiz}
                      respostas={respostas}
                      setRespostas={setRespostas}
                      resultado={resultado}
                      onEnviar={enviarQuiz}
                      linkConfirmacaoCaneca={`/evento-pirelli/caneca/confirmar?token=${encodeURIComponent(codigo)}`}
                      onAtualizarResultado={() => carregarQuiz()}
                    />
                  ) : (
                    <CartaoMensagem titulo="Não foi possível abrir o quiz" texto="Sua tentativa continua vinculada ao seu cadastro. Tente abrir novamente." onClick={() => void carregarQuiz()} cta="Tentar novamente" />
                  )
                ) : aviso ? (
                  <CartaoMensagem titulo="Participação confirmada" texto={aviso} href="/evento-pirelli" cta="Voltar às opções" />
                ) : (
                  <FormBalanceamento onEnviar={participar} />
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    )
  }

  if (pagina === 'ofertas') {
    return (
      <main className="min-h-screen overflow-hidden bg-[#09090a] text-white antialiased">
        <div className="mx-auto max-w-7xl px-5 pt-5 sm:px-8 lg:px-12">
          <header className="flex flex-col gap-5 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <Marcas forza={logoForza} pirelli={logoPirelli} campneus={evento.logoCampneusUrl} />
            <Link href="/evento-pirelli" className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-white/12 px-4 text-sm font-bold text-white/60 transition hover:border-white/25 hover:text-white">
              <ChevronLeft size={17} /> Voltar às opções
            </Link>
          </header>
        </div>
        <OfertasEvento produtos={produtos} disponivel={vendasDisponiveis} evento={evento} />
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#09090a] text-white antialiased">
      <section className="relative isolate min-h-[720px] overflow-hidden border-b border-white/10 sm:min-h-[760px]">
        <Image
          src="/images/evento-pirelli/rodeo-hero.webp"
          alt="Motocicleta custom em uma experiência de pneus no estande"
          fill
          priority
          sizes="100vw"
          className="-z-30 object-cover object-[68%_center]"
        />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(6,6,7,0.98)_0%,rgba(6,6,7,0.91)_40%,rgba(6,6,7,0.28)_78%,rgba(6,6,7,0.22)_100%)]" />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(0deg,#09090a_0%,transparent_38%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="mx-auto flex min-h-[720px] max-w-7xl flex-col px-5 pb-16 pt-5 sm:min-h-[760px] sm:px-8 lg:px-12">
          <Marcas forza={logoForza} pirelli={logoPirelli} campneus={evento.logoCampneusUrl} />

          <div className="my-auto max-w-2xl py-14">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#f5b82e] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-black">Rodeo Lucky Friends</span>
              <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70 backdrop-blur">Ação presencial</span>
            </div>

            {contexto && (
              <p className="mt-7 flex items-center gap-3 text-xs font-black uppercase tracking-[0.22em] text-[#f5b82e]">
                <span className="text-3xl leading-none text-white/20">{contexto.numero}</span>{contexto.etiqueta}
              </p>
            )}

            <h1 className="mt-5 max-w-xl font-barlow text-5xl font-black uppercase leading-[0.88] tracking-[-0.035em] text-white sm:text-7xl lg:text-[5.6rem]">
              {contexto?.titulo || 'Escolha sua experiência.'}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/68 sm:text-lg">
              {contexto?.descricao || evento.descricao || 'Caneca personalizada, produtos e ofertas, quiz cronometrado ou balanceamento na prática. Você decide por onde começar.'}
            </p>

            {(data || evento.local) && (
              <p className="mt-5 text-sm font-semibold text-white/78">
                {data && data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
                {data && evento.local ? '  •  ' : ''}{evento.local}
              </p>
            )}

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <a href="#escolher-experiencia" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#dc1f26] px-6 py-4 font-barlow text-sm font-black uppercase tracking-[0.1em] text-white shadow-[0_16px_45px_rgba(220,31,38,0.36)] transition hover:-translate-y-0.5 hover:bg-[#ef2930] sm:w-auto">
                {codigo ? 'Continuar minhas experiências' : 'Ver todas as opções'} <ArrowRight size={18} />
              </a>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/48"><ShieldCheck size={16} className="text-emerald-400" /> {codigo ? 'Acesso reconhecido neste aparelho' : 'Um único acesso para toda a experiência'}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-5 text-[11px] font-bold uppercase tracking-[0.15em] text-white/45">
            <span>Pirelli</span><span>Metzeler</span><span>Forza Motos</span><span>Campneus</span>
          </div>
        </div>
      </section>

      <section id="escolher-experiencia" className="relative z-10 mx-auto -mt-7 max-w-7xl scroll-mt-5 px-5 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111114]/95 shadow-2xl backdrop-blur">
          <div className="grid gap-3 border-b border-white/10 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#f5b82e]">O QR principal trouxe você até aqui</p>
              <h2 className="mt-2 font-barlow text-3xl font-black uppercase leading-none sm:text-4xl">O que você quer fazer?</h2>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-white/48">Escolha uma opção agora. O cadastro é único e aparece somente quando for necessário para participar.</p>
          </div>
          <div className="border-b border-white/10 px-6 py-5 sm:px-8">
            {!storagePronto ? (
              <p className="text-sm font-semibold text-white/45" aria-live="polite">Verificando se você já tem acesso neste aparelho…</p>
            ) : codigo ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-3 text-sm text-white/65"><BadgeCheck size={21} className="shrink-0 text-emerald-400" /><span><strong className="block text-white">Você já está identificado{form.nomeCompleto ? `, ${form.nomeCompleto}` : ''}.</strong>Escolha uma ação abaixo e siga direto, sem novo cadastro.</span></p>
                <Link href="/evento-pirelli/cadastro" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white">Ver meu cadastro</Link>
              </div>
            ) : (
              <div className="flex flex-col gap-4 rounded-2xl border border-[#f5b82e]/20 bg-[#f5b82e]/[0.06] p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-barlow text-xl font-black uppercase text-white">Como você quer entrar?</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/48">Quem já se cadastrou recebe um código seguro pelo WhatsApp e pelo e-mail vinculado.</p>
                </div>
                <div className="grid shrink-0 gap-3 sm:grid-cols-2">
                  <Link href="/evento-pirelli/cadastro" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#dc1f26] px-5 font-barlow text-sm font-black uppercase tracking-wider text-white transition hover:bg-[#ef2930]"><UserPlus size={17} /> Fazer cadastro</Link>
                  <Link href="/evento-pirelli/cadastro?recuperar=1" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-bold text-white/75 transition hover:border-[#f5b82e]/50 hover:text-white"><KeyRound size={17} className="text-[#f5b82e]" /> Já tenho cadastro</Link>
                </div>
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4">
            <Destino numero="01" titulo="Caneca personalizada" texto="Compre a caneca avulsa e escolha o nome que será gravado." href={codigo ? '/evento-pirelli/caneca' : '/evento-pirelli/cadastro?acao=caneca'} icone={<Gift size={21} />} />
            <Destino numero="02" titulo="Produtos e ofertas" texto={`Conheça os produtos da Forza. Compras participantes acima de ${brl(evento.valorMinimoPneus)} ganham caneca.`} href="/evento-pirelli/ofertas" icone={<ShoppingBag size={21} />} />
            <Destino numero="03" titulo="Quiz cronometrado" texto="Teste seus conhecimentos e concorra a uma caneca personalizada." href={codigo ? '/evento-pirelli/quiz' : '/evento-pirelli/cadastro?acao=quiz'} icone={<Trophy size={21} />} />
            <Destino numero="04" titulo="Balanceamento" texto="Participe da demonstração prática com a equipe no estande." href={codigo ? '/evento-pirelli/balanceamento' : '/evento-pirelli/cadastro?acao=balanceamento'} icone={<Wrench size={21} />} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f5b82e]">Lembrança exclusiva</p>
            <h2 className="mt-3 max-w-lg font-barlow text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">Seu nome. Sua caneca. Sua história.</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/58">A gravação a laser acontece no estande. Você confirma o nome pelo celular e a equipe acompanha automaticamente sua posição na fila.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <RegraBrinde titulo="Quiz perfeito e mais rápido" texto="Acerte tudo; o menor tempo vence" />
              <RegraBrinde titulo={`Compra acima de ${brl(evento.valorMinimoPneus)}`} texto="Em pneus participantes" />
              <RegraBrinde titulo={`Caneca avulsa ${brl(evento.valorCanecaAvulsa)}`} texto="Personalizada com seu nome" />
              <RegraBrinde titulo="Cadastro único" texto="Acesse qualquer uma das quatro frentes" />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#151517]">
            <Image src="/images/evento-pirelli/caneca-premium.webp" alt="Caneca preta premium pronta para personalização" width={1448} height={1086} sizes="(max-width: 1024px) 100vw, 54vw" priority className="h-auto w-full" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-6 pt-20">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-white"><Sparkles size={16} className="text-[#f5b82e]" /> Gravação a laser realizada no local</p>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}

function Marcas({ forza, pirelli, campneus }: { forza: string; pirelli: string; campneus: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
      <span className="grid h-14 min-w-24 place-items-center rounded-xl bg-white px-3 shadow-lg"><Image src={forza} alt="Forza Motos" width={160} height={64} sizes="160px" className="h-10 w-auto object-contain" /></span>
      <span className="text-lg font-black text-[#f5b82e]">×</span>
      <span className="grid h-14 min-w-24 place-items-center rounded-xl bg-[#f5b82e] px-3 shadow-lg"><Image src={pirelli} alt="Pirelli" width={160} height={56} sizes="160px" className="h-7 w-auto object-contain" /></span>
      {campneus ? (
        <><span className="text-lg font-black text-[#f5b82e]">×</span><span className="grid h-14 min-w-24 place-items-center rounded-xl border border-white/15 bg-black/50 px-3 backdrop-blur"><Image src={campneus} alt="Campneus" width={160} height={64} sizes="160px" className="h-8 w-auto object-contain" /></span></>
      ) : null}
    </div>
  )
}

function CartaoMensagem({ titulo, texto, href, cta, hrefSecundario, ctaSecundario, onClick }: {
  titulo: string
  texto: string
  href?: string
  cta: string
  hrefSecundario?: string
  ctaSecundario?: string
  onClick?: () => void
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#111114] p-7 text-center shadow-2xl sm:p-10">
      <h2 className="font-barlow text-3xl font-black uppercase sm:text-4xl">{titulo}</h2>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/55">{texto}</p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        {href ? (
          <Link href={href} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#dc1f26] px-6 font-barlow text-sm font-black uppercase tracking-wider text-white transition hover:bg-[#ef2930]">
            {cta} <ArrowRight size={18} />
          </Link>
        ) : (
          <button type="button" onClick={onClick} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#dc1f26] px-6 font-barlow text-sm font-black uppercase tracking-wider text-white transition hover:bg-[#ef2930]">
            {cta} <ArrowRight size={18} />
          </button>
        )}
        {hrefSecundario && ctaSecundario ? (
          <Link href={hrefSecundario} className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/15 px-6 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white">{ctaSecundario}</Link>
        ) : null}
      </div>
    </section>
  )
}

function CartaoQuiz({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[2rem] border border-white/10 bg-[#111114] p-8 text-center text-sm font-medium text-white/65 shadow-2xl">{children}</div>
}

function Destino({ numero, titulo, texto, href, icone }: { numero: string; titulo: string; texto: string; href: string; icone: React.ReactNode }) {
  return (
    <Link href={href} className="group relative min-h-48 border-b border-white/10 p-6 transition hover:bg-white/[0.04] md:border-r md:[&:nth-child(2n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:last:border-r-0">
      <div className="flex items-center justify-between">
        <span className="text-4xl font-black text-white/[0.09]">{numero}</span>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f5b82e]/10 text-[#f5b82e] transition group-hover:bg-[#f5b82e] group-hover:text-black">{icone}</span>
      </div>
      <h3 className="mt-5 font-barlow text-xl font-black uppercase">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{texto}</p>
      <ArrowRight size={17} className="mt-5 text-white/25 transition group-hover:translate-x-1 group-hover:text-[#f5b82e]" />
    </Link>
  )
}

function RegraBrinde({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-white"><BadgeCheck size={16} className="text-[#f5b82e]" /> {titulo}</p>
      <p className="mt-1 pl-6 text-xs text-white/42">{texto}</p>
    </div>
  )
}

function OfertasEvento({ produtos, disponivel, evento }: { produtos: ProdutoEventoPirelli[]; disponivel: boolean; evento: EventoPublicoPirelli }) {
  return (
    <section id="ofertas-evento" className="scroll-mt-5 border-y border-white/10 bg-[#0d0d0f]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f5b82e]">Produtos e condições exclusivas</p>
            <h2 className="mt-3 max-w-3xl font-barlow text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
              Encontre o que sua moto precisa.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/58">
              Confira as ofertas selecionadas para o evento ou acesse o catálogo completo da Forza Motos. Os itens de pré-venda são entregues ou retirados depois do Rodeo.
            </p>
          </div>
          <div className="rounded-2xl border border-[#f5b82e]/20 bg-[#f5b82e]/[0.06] px-5 py-4 text-sm leading-relaxed text-white/62 lg:max-w-xs">
            <span className="flex items-center gap-2 font-bold text-white"><PackageCheck size={18} className="text-[#f5b82e]" /> Compra confirmada na hora</span>
            <span className="mt-1 block text-xs text-white/42">Pagamento seguro e acompanhamento por e-mail. A entrega não acontece no estande.</span>
          </div>
        </div>

        {produtos.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {produtos.map((produto) => <OfertaEventoCard key={produto.id} produto={produto} disponivel={disponivel} evento={evento} />)}
          </div>
        ) : (
          <div className="mt-10 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] px-6 py-14 text-center">
            <ShoppingBag size={32} className="mx-auto text-[#f5b82e]" />
            <h3 className="mt-4 font-barlow text-2xl font-black uppercase">Ofertas em preparação</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-white/45">A equipe está cadastrando as condições exclusivas do evento. Enquanto isso, todo o catálogo da Forza já está disponível.</p>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Link href="/produtos" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#f5b82e] px-6 py-4 font-barlow text-sm font-black uppercase tracking-[0.1em] text-black transition hover:-translate-y-0.5 hover:bg-[#ffd05e]">
            Ver todos os produtos da Forza <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  )
}

function OfertaEventoCard({ produto, disponivel, evento }: { produto: ProdutoEventoPirelli; disponivel: boolean; evento: EventoPublicoPirelli }) {
  const adicionarItem = useCartStore((state) => state.adicionarItem)
  const imagem = produto.imagens[0] || null
  const precoPromocional = produto.precoPromocional != null && produto.precoPromocional > 0 && produto.precoPromocional < produto.preco
    ? produto.precoPromocional
    : null
  const precoFinal = precoPromocional ?? produto.preco
  const desconto = precoPromocional
    ? Math.round((1 - precoPromocional / produto.preco) * 100)
    : null
  const produtoDisponivel = produto.preVenda || produto.estoque > 0
  const podeComprar = disponivel && produtoDisponivel
  const tetoQuantidade = produto.limitePorPedidoEvento ?? (produto.preVenda ? undefined : produto.estoque)

  function adicionarAoCarrinho() {
    // O valor no carrinho serve apenas para a interface. O servidor recalcula
    // preço, disponibilidade e limite pelo ID antes de criar o pagamento.
    adicionarItem({
      id: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      preco: precoFinal,
      imagem: imagem ?? undefined,
      estoque: tetoQuantidade,
      eventoPirelli: true,
      categoria: produto.categoria,
      valorMinimoBrindeEvento: evento.valorMinimoPneus,
      operadorValorMinimoBrindeEvento: evento.operadorValorMinimoPneus ?? 'MAIOR_QUE',
      limiteNomeGravacaoEvento: evento.limiteNomeGravacao,
    })
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#151517] shadow-[0_20px_65px_rgba(0,0,0,0.28)] transition hover:-translate-y-1 hover:border-[#f5b82e]/35">
      <Link href={`/produtos/${produto.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-[#f2efe8]">
        {imagem ? (
          <Image src={imagem} alt={produto.nome} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-contain p-5 transition duration-500 group-hover:scale-[1.035]" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-black/18"><ShoppingBag size={52} /></span>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-[#dc1f26] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">Oferta do evento</span>
        {desconto && desconto > 0 ? <span className="absolute right-4 top-4 rounded-full bg-[#f5b82e] px-3 py-1.5 text-[11px] font-black text-black">-{desconto}%</span> : null}
      </Link>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f5b82e]">{produto.marca || 'Pirelli'}</p>
        <Link href={`/produtos/${produto.slug}`} className="mt-2 font-barlow text-2xl font-black uppercase leading-[1.02] text-white transition hover:text-[#f5b82e]">{produto.nome}</Link>
        {produto.descricao ? <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/45">{produto.descricao}</p> : null}

        <div className="mt-5 border-t border-white/10 pt-5">
          {precoPromocional ? <span className="block text-xs font-semibold text-white/35 line-through">De {brl(produto.preco)}</span> : null}
          <span className="mt-0.5 block font-barlow text-3xl font-black text-white">{brl(precoFinal)}</span>
          <span className="mt-1 block text-xs font-semibold text-emerald-300/75">5% de desconto no Pix</span>
        </div>

        <div className="mt-5 space-y-2 text-xs leading-relaxed text-white/52">
          <p className="flex gap-2"><Clock3 size={16} className="mt-0.5 shrink-0 text-[#f5b82e]" /><span>{produto.prazoEntregaDias ? `Postagem ou retirada em até ${produto.prazoEntregaDias} dias úteis.` : 'Prazo de disponibilidade informado na confirmação da compra.'}</span></p>
          {produto.limitePorPedidoEvento ? <p className="flex gap-2"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-[#f5b82e]" /><span>Limite de {produto.limitePorPedidoEvento} {produto.limitePorPedidoEvento === 1 ? 'unidade' : 'unidades'} por pedido.</span></p> : null}
        </div>

        <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-[11px] leading-relaxed text-white/42">Produto sob encomenda. Não será entregue no estande.</p>

        {produto.ehPai && disponivel ? (
          <Link href={`/produtos/${produto.slug}`} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f5b82e] px-4 font-barlow text-sm font-black uppercase tracking-wider text-black transition hover:bg-[#ffd05e]">Escolher opção <ArrowRight size={17} /></Link>
        ) : produto.ehPai ? (
          <span className="mt-5 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#f5b82e] px-4 text-center font-barlow text-sm font-black uppercase tracking-wider text-black opacity-40">Disponível durante o evento</span>
        ) : (
          <button type="button" disabled={!podeComprar} onClick={adicionarAoCarrinho} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#dc1f26] px-4 font-barlow text-sm font-black uppercase tracking-wider text-white transition hover:bg-[#ef2930] disabled:cursor-not-allowed disabled:opacity-40"><ShoppingBag size={17} /> {podeComprar ? 'Adicionar ao carrinho' : disponivel ? 'Indisponível' : 'Disponível durante o evento'}</button>
        )}
      </div>
    </article>
  )
}

type FormularioProps = {
  form: FormCadastro
  setForm: React.Dispatch<React.SetStateAction<FormCadastro>>
  enviando: boolean
  erro: string
  onSubmit: (event: FormEvent) => Promise<void>
  disponivel: boolean
  statusParticipacao: string | null
  recuperacaoAberta: boolean
  recuperacaoPorCadastroExistente: boolean
  inicioRecuperacao: InicioRecuperacao | null
  setRecuperacaoAberta: React.Dispatch<React.SetStateAction<boolean>>
  setRecuperacaoPorCadastroExistente: React.Dispatch<React.SetStateAction<boolean>>
  setInicioRecuperacao: React.Dispatch<React.SetStateAction<InicioRecuperacao | null>>
  onRecuperado: (visitante: VisitanteRecuperado) => void
}

function FormularioCadastro({
  form,
  setForm,
  enviando,
  erro,
  onSubmit,
  disponivel,
  statusParticipacao,
  recuperacaoAberta,
  recuperacaoPorCadastroExistente,
  inicioRecuperacao,
  setRecuperacaoAberta,
  setRecuperacaoPorCadastroExistente,
  setInicioRecuperacao,
  onRecuperado,
}: FormularioProps) {
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [erroCep, setErroCep] = useState('')
  const campo = 'mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-base font-semibold text-[#171719] outline-none transition focus:border-[#dc1f26] focus:ring-4 focus:ring-[#dc1f26]/10'

  async function buscarCep() {
    const cep = form.enderecoCep.replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCep(true)
    setErroCep('')
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const dados = await resposta.json()
      if (!resposta.ok || dados.erro) throw new Error('CEP não encontrado')
      setForm((atual) => ({
        ...atual,
        enderecoCep: cep,
        enderecoRua: dados.logradouro || atual.enderecoRua,
        enderecoBairro: dados.bairro || atual.enderecoBairro,
        enderecoCidade: dados.localidade || atual.enderecoCidade,
        enderecoEstado: dados.uf || atual.enderecoEstado,
      }))
    } catch {
      setErroCep('Não encontramos o CEP. Confira e preencha o endereço manualmente.')
    } finally {
      setBuscandoCep(false)
    }
  }

  if (recuperacaoAberta) {
    return (
      <div className="space-y-4">
        {recuperacaoPorCadastroExistente ? (
          <p role="status" className="rounded-2xl border border-[#f5b82e]/30 bg-[#f5b82e]/10 p-4 text-sm font-semibold leading-relaxed text-[#ffe3a0]">
            {inicioRecuperacao?.solicitado
              ? inicioRecuperacao.enviando
                ? 'Este WhatsApp já tem cadastro. Estamos enviando um código seguro agora.'
                : 'Este WhatsApp já tem cadastro. Enviamos um código seguro para você continuar sem preencher tudo novamente.'
              : 'Este WhatsApp já tem cadastro. Confirme o número abaixo para receber um novo código seguro.'}
          </p>
        ) : null}
        <RecuperarAcesso
          key={inicioRecuperacao ? `${inicioRecuperacao.chave}:${inicioRecuperacao.enviando ? 'enviando' : inicioRecuperacao.solicitado ? 'codigo' : 'telefone'}` : 'manual'}
          whatsappInicial={form.whatsapp}
          inicio={inicioRecuperacao}
          onCancelar={() => {
            setInicioRecuperacao(null)
            setRecuperacaoPorCadastroExistente(false)
            setRecuperacaoAberta(false)
          }}
          onRecuperado={onRecuperado}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="overflow-hidden rounded-[2rem] bg-[#f2efe8] text-[#171719] shadow-2xl">
        <div className="grid lg:grid-cols-[1fr_0.82fr]">
        <div className="space-y-5 p-6 sm:p-9">
          <div>
            <h3 className="font-barlow text-3xl font-black uppercase">Faça seu cadastro</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/55">Use seus dados reais uma única vez. O nome da caneca só será solicitado se você comprar ou conquistar uma.</p>
          </div>

          {!disponivel && statusParticipacao && <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{statusParticipacao}</p>}

          <label className="block text-xs font-black uppercase tracking-[0.14em] text-black/60">Nome completo
            <input required value={form.nomeCompleto} onChange={(event) => setForm({ ...form, nomeCompleto: event.target.value })} className={campo} placeholder="Nome e sobrenome" autoComplete="name" />
          </label>
          <label className="block text-xs font-black uppercase tracking-[0.14em] text-black/60">WhatsApp com DDD
            <input required inputMode="tel" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} className={campo} placeholder="(19) 99999-9999" autoComplete="tel" />
          </label>
          <label className="block text-xs font-black uppercase tracking-[0.14em] text-black/60">E-mail
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={campo} placeholder="voce@email.com" autoComplete="email" />
          </label>

          <div className="border-t border-black/10 pt-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-black/60">Endereço completo</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
              <label className="block text-xs font-bold text-black/55">CEP
                <input required inputMode="numeric" value={form.enderecoCep} onChange={(event) => setForm({ ...form, enderecoCep: event.target.value })} onBlur={() => void buscarCep()} className={campo} placeholder="00000-000" autoComplete="postal-code" />
              </label>
              <label className="block text-xs font-bold text-black/55">Rua / avenida
                <input required value={form.enderecoRua} onChange={(event) => setForm({ ...form, enderecoRua: event.target.value })} className={campo} autoComplete="address-line1" />
              </label>
            </div>
            {buscandoCep ? <p className="mt-2 text-xs text-black/45">Buscando CEP…</p> : null}
            {erroCep ? <p className="mt-2 text-xs font-semibold text-amber-700">{erroCep}</p> : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-black/55">Número
                <input required value={form.enderecoNumero} onChange={(event) => setForm({ ...form, enderecoNumero: event.target.value })} className={campo} autoComplete="address-line2" />
              </label>
              <label className="block text-xs font-bold text-black/55">Complemento (opcional)
                <input value={form.enderecoComplemento} onChange={(event) => setForm({ ...form, enderecoComplemento: event.target.value })} className={campo} />
              </label>
              <label className="block text-xs font-bold text-black/55">Bairro
                <input required value={form.enderecoBairro} onChange={(event) => setForm({ ...form, enderecoBairro: event.target.value })} className={campo} autoComplete="address-level3" />
              </label>
              <label className="block text-xs font-bold text-black/55">Cidade
                <input required value={form.enderecoCidade} onChange={(event) => setForm({ ...form, enderecoCidade: event.target.value })} className={campo} autoComplete="address-level2" />
              </label>
              <label className="block text-xs font-bold text-black/55 sm:col-span-2">Estado (UF)
                <input required maxLength={2} value={form.enderecoEstado} onChange={(event) => setForm({ ...form, enderecoEstado: event.target.value.toUpperCase() })} className={campo} placeholder="SP" autoComplete="address-level1" />
              </label>
            </div>
          </div>

          <div className="border-t border-black/10 pt-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-black/60">Sua moto</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="block text-xs font-bold text-black/55">Marca
                <input required value={form.motoMarca} onChange={(event) => setForm({ ...form, motoMarca: event.target.value })} className={campo} placeholder="Honda" />
              </label>
              <label className="block text-xs font-bold text-black/55">Modelo
                <input required value={form.motoModelo} onChange={(event) => setForm({ ...form, motoModelo: event.target.value })} className={campo} placeholder="CB 500X" />
              </label>
              <label className="block text-xs font-bold text-black/55">Ano
                <input required inputMode="numeric" min="1900" max={new Date().getFullYear() + 1} value={form.motoAno} onChange={(event) => setForm({ ...form, motoAno: event.target.value })} className={campo} placeholder="2024" />
              </label>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-black/48">
            <input type="checkbox" checked={form.consentimentoMarketing} onChange={(event) => setForm({ ...form, consentimentoMarketing: event.target.checked })} className="mt-0.5 h-4 w-4 shrink-0 accent-[#dc1f26]" />
            Quero receber ofertas e convites da Forza Motos pelo WhatsApp.
          </label>

          {erro && <p role="alert" className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" /> {erro}</p>}

          <button disabled={enviando || !disponivel} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#dc1f26] px-5 py-4 font-barlow text-sm font-black uppercase tracking-[0.08em] text-white shadow-lg transition hover:bg-[#ef2930] disabled:cursor-not-allowed disabled:opacity-45">
            {enviando ? 'Confirmando…' : disponivel ? 'Confirmar cadastro' : 'Inscrições ainda não abertas'} <ArrowRight size={18} />
          </button>
        </div>

        <div className="relative flex min-h-80 flex-col justify-between overflow-hidden bg-[#111114] p-6 text-white sm:p-9">
          <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#dc1f26]/25 blur-[90px]" />
          <div className="relative">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#f5b82e]">Um cadastro, quatro acessos</p>
            <p className="mt-2 text-sm text-white/45">Depois de confirmar, escolha a experiência que quer acessar.</p>
          </div>
          <div className="relative my-8 space-y-3 border-y border-white/10 py-8">
            <p className="flex items-center gap-3 text-sm font-bold"><Gift size={18} className="text-[#f5b82e]" /> Comprar caneca personalizada</p>
            <p className="flex items-center gap-3 text-sm font-bold"><ShoppingBag size={18} className="text-[#f5b82e]" /> Comprar pneus e ganhar caneca</p>
            <p className="flex items-center gap-3 text-sm font-bold"><Trophy size={18} className="text-[#f5b82e]" /> Quiz aleatório e cronometrado</p>
            <p className="flex items-center gap-3 text-sm font-bold"><Wrench size={18} className="text-[#f5b82e]" /> Entender o balanceamento</p>
          </div>
          <p className="relative text-xs leading-relaxed text-white/45">Seus dados ficam ligados ao seu acesso seguro. A gravação só é definida quando existir uma caneca confirmada no seu fluxo.</p>
        </div>
        </div>
      </form>

      <button
        type="button"
        onClick={() => {
          setInicioRecuperacao(null)
          setRecuperacaoPorCadastroExistente(false)
          setRecuperacaoAberta(true)
        }}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 text-sm font-bold text-white/72 transition hover:border-[#f5b82e]/40 hover:text-white"
      >
        <KeyRound size={17} className="text-[#f5b82e]" /> Já se cadastrou? Recuperar meu acesso
      </button>
    </div>
  )
}

function RecuperarAcesso({ whatsappInicial, inicio, onCancelar, onRecuperado }: {
  whatsappInicial: string
  inicio: InicioRecuperacao | null
  onCancelar: () => void
  onRecuperado: (visitante: VisitanteRecuperado) => void
}) {
  const [whatsapp, setWhatsapp] = useState(inicio?.whatsapp ?? whatsappInicial)
  const [codigo, setCodigo] = useState('')
  const [solicitado, setSolicitado] = useState(inicio?.solicitado ?? false)
  const [enviando, setEnviando] = useState(inicio?.enviando ?? false)
  const [erro, setErro] = useState(inicio?.erro ?? '')
  const [mensagem, setMensagem] = useState(inicio?.mensagem ?? '')
  const campo = 'mt-2 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-base font-semibold text-white outline-none transition focus:border-[#f5b82e] focus:ring-4 focus:ring-[#f5b82e]/10'

  async function solicitarCodigo() {
    setErro('')
    setMensagem('')
    setEnviando(true)
    try {
      const resposta = await fetch('/api/evento-pirelli/recuperacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'solicitar', whatsapp }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.error || 'Não foi possível enviar o código.')
      setSolicitado(true)
      setCodigo('')
      setMensagem(dados.message)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar o código.')
    } finally {
      setEnviando(false)
    }
  }

  async function solicitar(event: FormEvent) {
    event.preventDefault()
    await solicitarCodigo()
  }

  async function confirmar(event: FormEvent) {
    event.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const resposta = await fetch('/api/evento-pirelli/recuperacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'confirmar', whatsapp, codigo }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.error || 'Não foi possível validar o código.')
      onRecuperado(dados.visitante)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível validar o código.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="rounded-[2rem] border border-[#f5b82e]/25 bg-[#111114] p-6 shadow-2xl sm:p-8" aria-labelledby="titulo-recuperar-acesso">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f5b82e] text-black"><KeyRound size={20} /></span>
        <div>
          <h3 id="titulo-recuperar-acesso" className="font-barlow text-2xl font-black uppercase">Recuperar meu acesso</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/52">Enviaremos o mesmo código pelo WhatsApp e pelo e-mail vinculado ao cadastro, quando disponíveis. O acesso nunca é liberado somente pelo número informado.</p>
        </div>
      </div>

      {!solicitado ? (
        <form onSubmit={solicitar} className="mt-6 space-y-4">
          <label className="block text-xs font-black uppercase tracking-wider text-white/55">WhatsApp com DDD
            <input autoFocus required inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} className={campo} placeholder="(19) 99999-9999" />
          </label>
          {erro && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-200">{erro}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={onCancelar} className="min-h-12 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/65">Cancelar</button>
            <button disabled={enviando} className="min-h-12 rounded-xl bg-[#f5b82e] px-4 font-barlow text-sm font-black uppercase text-black disabled:opacity-45">{enviando ? 'Enviando…' : 'Enviar código'}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirmar} className="mt-6 space-y-4">
          {mensagem && <p role="status" className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm font-semibold text-sky-100">{mensagem}</p>}
          <label className="block text-xs font-black uppercase tracking-wider text-white/55">Código de 6 dígitos
            <input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={codigo} onChange={(event) => setCodigo(event.target.value.replace(/\D/g, '').slice(0, 6))} className={`${campo} text-center font-mono text-2xl tracking-[0.35em]`} placeholder="000000" />
          </label>
          {erro && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-200">{erro}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={enviando} onClick={() => void solicitarCodigo()} className="min-h-12 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/65 disabled:opacity-45">Reenviar código</button>
            <button disabled={enviando || codigo.length !== 6} className="min-h-12 rounded-xl bg-[#dc1f26] px-4 font-barlow text-sm font-black uppercase text-white disabled:opacity-45">{enviando ? (inicio?.enviando ? 'Enviando código…' : 'Validando…') : 'Validar e abrir meu acesso'}</button>
          </div>
          <button type="button" onClick={onCancelar} className="w-full text-xs font-bold text-white/40 hover:text-white/70">Cancelar recuperação</button>
        </form>
      )}
    </section>
  )
}

type Participar = (
  tipo: 'balanceamento',
  extra: { horario?: string },
) => Promise<void>

function FormBalanceamento({ onEnviar, onCancelar }: { onEnviar: Participar; onCancelar?: () => void }) {
  const [horario, setHorario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const opcoes = ['Manhã', 'Início da tarde', 'Fim da tarde', 'Tanto faz']
  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#111114] p-6 sm:p-8">
      {onCancelar ? <button type="button" onClick={onCancelar} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/45 hover:text-white"><ChevronLeft size={15} /> Voltar</button> : null}
      <p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-[#f5b82e]">Conhecimento na estrada</p>
      <h3 className="mt-2 font-barlow text-4xl font-black uppercase">Balanceamento na prática.</h3>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/52">Escolha o melhor período. A equipe organizará a demonstração conforme a movimentação do estande.</p>
      <p className="mt-3 rounded-2xl border border-[#f5b82e]/20 bg-[#f5b82e]/[0.06] p-4 text-xs leading-relaxed text-white/55">Demonstração de balanceamento estático. Não inclui alinhamento, montagem do pneu ou balanceamento dinâmico.</p>
      <div className="mt-7 grid grid-cols-2 gap-3">
        {opcoes.map((opcao) => <button type="button" key={opcao} onClick={() => setHorario(opcao)} className={`rounded-2xl border px-3 py-4 text-sm font-bold transition ${horario === opcao ? 'border-[#f5b82e] bg-[#f5b82e] text-black' : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25'}`}>{opcao}</button>)}
      </div>
      <button type="button" disabled={!horario || enviando} onClick={async () => { setEnviando(true); try { await onEnviar('balanceamento', { horario }) } finally { setEnviando(false) } }} className="mt-7 min-h-14 w-full rounded-2xl bg-[#dc1f26] px-5 font-barlow text-sm font-black uppercase tracking-wider text-white disabled:opacity-40">{enviando ? 'Confirmando…' : 'Confirmar participação'}</button>
    </section>
  )
}
