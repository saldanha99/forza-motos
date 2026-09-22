'use client'

import Link from 'next/link'
import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Clock3,
  ExternalLink,
  ImageIcon,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  ReceiptText,
  Ruler,
  ShoppingBag,
  Star,
  Upload,
  X,
} from 'lucide-react'
import {
  Badge,
  Botao,
  BotaoLink,
  Card,
  EmptyState,
  PageHeader,
  StatusPill,
} from '@/components/admin/ui/primitives'
import { Campo, Input, Modal, Switch, Textarea } from '@/components/admin/ui/form'

export type ProdutoEventoAdmin = {
  id: string
  nome: string
  sku: string
  slug: string
  descricao: string
  categoria: string
  marca: string
  preco: number
  precoPromocional: number | null
  prazoEntregaDias: number | null
  peso: number | null
  altura: number | null
  largura: number | null
  comprimento: number | null
  imagens: string[]
  ativo: boolean
  destaque: boolean
  preVenda: boolean
  estoque: number
  ordemEvento: number
  limitePorPedidoEvento: number | null
  createdAt: string
  updatedAt: string
}

export type PedidoEventoAdmin = {
  id: string
  orderNumber: string
  status: string
  total: number
  createdAt: string
  cliente: { nome: string | null; email: string | null } | null
  items: Array<{
    id: string
    productId: string
    nome: string
    quantidade: number
    precoUnitario: number
    preVendaSnapshot: boolean
    prazoEntregaDiasSnapshot: number | null
  }>
}

type FormularioProduto = {
  nome: string
  sku: string
  descricao: string
  categoria: string
  marca: string
  preco: string
  precoPromocional: string
  prazoEntregaDias: string
  peso: string
  altura: string
  largura: string
  comprimento: string
  imagens: string[]
  ativo: boolean
  destaque: boolean
  ordemEvento: string
  limitePorPedidoEvento: string
}

const STATUS_PAGOS = new Set(['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE'])

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function novoFormulario(): FormularioProduto {
  return {
    nome: '',
    sku: '',
    descricao: '',
    categoria: 'Pneus',
    marca: 'Pirelli',
    preco: '',
    precoPromocional: '',
    prazoEntregaDias: '15',
    peso: '7.5',
    altura: '70',
    largura: '70',
    comprimento: '20',
    imagens: [],
    ativo: false,
    destaque: false,
    ordemEvento: '0',
    limitePorPedidoEvento: '4',
  }
}

function formularioDoProduto(produto: ProdutoEventoAdmin): FormularioProduto {
  return {
    nome: produto.nome,
    sku: produto.sku,
    descricao: produto.descricao,
    categoria: produto.categoria,
    marca: produto.marca,
    preco: String(produto.preco),
    precoPromocional: produto.precoPromocional == null ? '' : String(produto.precoPromocional),
    prazoEntregaDias: produto.prazoEntregaDias == null ? '' : String(produto.prazoEntregaDias),
    peso: produto.peso == null ? '' : String(produto.peso),
    altura: produto.altura == null ? '' : String(produto.altura),
    largura: produto.largura == null ? '' : String(produto.largura),
    comprimento: produto.comprimento == null ? '' : String(produto.comprimento),
    imagens: produto.imagens,
    ativo: produto.ativo,
    destaque: produto.destaque,
    ordemEvento: String(produto.ordemEvento),
    limitePorPedidoEvento: produto.limitePorPedidoEvento == null ? '1' : String(produto.limitePorPedidoEvento),
  }
}

function ordenarProdutos(produtos: ProdutoEventoAdmin[]) {
  return [...produtos].sort((a, b) => a.ordemEvento - b.ordemEvento || b.createdAt.localeCompare(a.createdAt))
}

async function jsonSeguro(resposta: Response) {
  try {
    return await resposta.json()
  } catch {
    return { error: 'O servidor devolveu uma resposta inválida.' }
  }
}

export function ProdutosEventoPirelli({
  produtos: produtosIniciais,
  pedidos,
}: {
  produtos: ProdutoEventoAdmin[]
  pedidos: PedidoEventoAdmin[]
}) {
  const [aba, setAba] = useState<'produtos' | 'pedidos'>('produtos')
  const [produtos, setProdutos] = useState(ordenarProdutos(produtosIniciais))
  const [modalAberto, setModalAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormularioProduto>(novoFormulario)
  const [salvando, setSalvando] = useState(false)
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const [alternandoId, setAlternandoId] = useState<string | null>(null)

  const pedidosPagos = useMemo(() => pedidos.filter((pedido) => STATUS_PAGOS.has(pedido.status)), [pedidos])
  const receita = useMemo(
    () => pedidosPagos.reduce((total, pedido) => total + pedido.total, 0),
    [pedidosPagos],
  )
  const vendidosPorProduto = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const pedido of pedidosPagos) {
      for (const item of pedido.items) {
        mapa.set(item.productId, (mapa.get(item.productId) ?? 0) + item.quantidade)
      }
    }
    return mapa
  }, [pedidosPagos])

  function atualizar<K extends keyof FormularioProduto>(campo: K, valor: FormularioProduto[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function abrirNovo() {
    setEditandoId(null)
    setForm(novoFormulario())
    setModalAberto(true)
  }

  function abrirEdicao(produto: ProdutoEventoAdmin) {
    setEditandoId(produto.id)
    setForm(formularioDoProduto(produto))
    setModalAberto(true)
  }

  function payloadDoFormulario() {
    const numericos = {
      preco: Number(form.preco),
      precoPromocional: Number(form.precoPromocional),
      prazoEntregaDias: Number(form.prazoEntregaDias),
      peso: Number(form.peso),
      altura: Number(form.altura),
      largura: Number(form.largura),
      comprimento: Number(form.comprimento),
      ordemEvento: Number(form.ordemEvento),
      limitePorPedidoEvento: Number(form.limitePorPedidoEvento),
    }
    if (Object.values(numericos).some((valor) => !Number.isFinite(valor))) {
      throw new Error('Revise os valores, prazo, limite e dimensões do produto.')
    }
    if (numericos.precoPromocional >= numericos.preco) {
      throw new Error('O preço especial precisa ser menor que o preço normal.')
    }
    if (form.ativo && form.imagens.length === 0) {
      throw new Error('Envie ao menos uma imagem antes de publicar a oferta.')
    }
    return {
      nome: form.nome,
      sku: form.sku,
      descricao: form.descricao,
      categoria: form.categoria,
      marca: form.marca,
      ...numericos,
      imagens: form.imagens,
      ativo: form.ativo,
      destaque: form.destaque,
    }
  }

  async function salvar(event: FormEvent) {
    event.preventDefault()
    setSalvando(true)
    try {
      const payload = payloadDoFormulario()
      const resposta = await fetch(
        editandoId ? `/api/admin/evento-pirelli/produtos/${editandoId}` : '/api/admin/evento-pirelli/produtos',
        {
          method: editandoId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const dados = await jsonSeguro(resposta)
      if (!resposta.ok) throw new Error(dados.error || 'Não foi possível salvar o produto.')

      setProdutos((atuais) => ordenarProdutos(
        editandoId
          ? atuais.map((produto) => produto.id === editandoId ? dados : produto)
          : [...atuais, dados],
      ))
      toast.success(editandoId ? 'Oferta atualizada.' : 'Produto criado para o evento.')
      setModalAberto(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o produto.')
    } finally {
      setSalvando(false)
    }
  }

  async function enviarImagem(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem.')
      return
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 10 MB.')
      return
    }

    setEnviandoImagem(true)
    try {
      const dadosUpload = new FormData()
      dadosUpload.append('file', arquivo)
      dadosUpload.append('pasta', 'evento-pirelli-produtos')
      const resposta = await fetch('/api/upload', { method: 'POST', body: dadosUpload })
      const dados = await jsonSeguro(resposta)
      if (!resposta.ok || typeof dados.url !== 'string') {
        throw new Error(dados.error || 'Não foi possível enviar a imagem.')
      }
      atualizar('imagens', Array.from(new Set([...form.imagens, dados.url])))
      toast.success('Imagem enviada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    } finally {
      setEnviandoImagem(false)
    }
  }

  async function alternarPublicacao(produto: ProdutoEventoAdmin) {
    setAlternandoId(produto.id)
    try {
      const resposta = await fetch(`/api/admin/evento-pirelli/produtos/${produto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !produto.ativo }),
      })
      const dados = await jsonSeguro(resposta)
      if (!resposta.ok) throw new Error(dados.error || 'Não foi possível alterar a publicação.')
      setProdutos((atuais) => atuais.map((item) => item.id === produto.id ? dados : item))
      toast.success(dados.ativo ? 'Oferta publicada.' : 'Oferta desativada. O histórico foi preservado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a publicação.')
    } finally {
      setAlternandoId(null)
    }
  }

  return (
    <div className="pb-20">
      <PageHeader
        titulo="Produtos do evento Pirelli"
        descricao="Crie ofertas exclusivas em pré-venda. O cliente paga no e-commerce e recebe depois, pelo prazo informado aqui."
        acoes={(
          <>
            <BotaoLink href="/admin/evento-pirelli" variante="fantasma">
              <ArrowLeft size={15} /> Evento
            </BotaoLink>
            <BotaoLink href="/evento-pirelli/ofertas" target="_blank" variante="secundario">
              <ExternalLink size={15} /> Abrir vitrine
            </BotaoLink>
            <Botao onClick={abrirNovo}>
              <PackagePlus size={16} /> Novo produto
            </Botao>
          </>
        )}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Resumo icone={Package} rotulo="Ofertas publicadas" valor={String(produtos.filter((produto) => produto.ativo).length)} />
        <Resumo icone={ReceiptText} rotulo="Pedidos pagos" valor={String(pedidosPagos.length)} />
        <Resumo icone={ShoppingBag} rotulo="Itens vendidos" valor={String(Array.from(vendidosPorProduto.values()).reduce((a, b) => a + b, 0))} />
        <Resumo icone={Star} rotulo="Receita confirmada" valor={moeda.format(receita)} />
      </div>

      <div className="mb-5 inline-flex rounded-xl border border-brand-border bg-brand-surface-2 p-1">
        <button
          type="button"
          onClick={() => setAba('produtos')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${aba === 'produtos' ? 'bg-brand-accent text-brand-on-accent shadow-cta' : 'text-brand-muted hover:text-brand-text'}`}
        >
          Produtos ({produtos.length})
        </button>
        <button
          type="button"
          onClick={() => setAba('pedidos')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${aba === 'pedidos' ? 'bg-brand-accent text-brand-on-accent shadow-cta' : 'text-brand-muted hover:text-brand-text'}`}
        >
          Vendas ({pedidos.length})
        </button>
      </div>

      {aba === 'produtos' ? (
        produtos.length === 0 ? (
          <EmptyState
            icone={PackagePlus}
            titulo="Nenhuma oferta cadastrada"
            descricao="Cadastre o primeiro produto com preço especial, prazo de envio e dimensões para o frete."
            acao={<Botao onClick={abrirNovo}>Criar primeiro produto</Botao>}
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {produtos.map((produto) => {
              const vendidos = vendidosPorProduto.get(produto.id) ?? 0
              return (
                <Card key={produto.id} className="overflow-hidden">
                  <div className="flex min-h-52 flex-col sm:flex-row">
                    <div className="flex h-48 w-full shrink-0 items-center justify-center bg-brand-surface-2 sm:h-auto sm:w-48">
                      {produto.imagens[0] ? (
                        // URL vem do upload autenticado da VPS; <img> também aceita o histórico já cadastrado.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={produto.imagens[0]} alt={produto.nome} className="h-full w-full object-contain p-3" />
                      ) : (
                        <ImageIcon size={38} className="text-brand-dim" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wider text-brand-dim">{produto.marca} · {produto.sku}</p>
                          <h2 className="mt-1 font-barlow text-xl font-black leading-tight text-brand-text">{produto.nome}</h2>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tom={produto.ativo ? 'success' : 'neutro'}>{produto.ativo ? 'Publicado' : 'Rascunho'}</Badge>
                          <Badge tom="warning">Pré-venda</Badge>
                          {produto.destaque && <Badge tom="accent">Destaque</Badge>}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
                        <span className="text-sm text-brand-dim line-through">{moeda.format(produto.preco)}</span>
                        <strong className="font-barlow text-2xl text-brand-accent">{moeda.format(produto.precoPromocional ?? produto.preco)}</strong>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-brand-muted sm:grid-cols-2">
                        <span className="flex items-center gap-1.5"><Clock3 size={14} /> Envio em até {produto.prazoEntregaDias ?? '—'} dias úteis</span>
                        <span className="flex items-center gap-1.5"><ShoppingBag size={14} /> Limite {produto.limitePorPedidoEvento ?? 1} por pedido</span>
                        <span className="flex items-center gap-1.5"><Ruler size={14} /> {produto.altura ?? '—'} × {produto.largura ?? '—'} × {produto.comprimento ?? '—'} cm</span>
                        <span className="flex items-center gap-1.5"><Package size={14} /> {produto.peso ?? '—'} kg · {vendidos} vendido(s)</span>
                      </div>

                      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-5">
                        <Botao variante="fantasma" tamanho="sm" onClick={() => abrirEdicao(produto)}>
                          <Pencil size={14} /> Editar
                        </Botao>
                        <Botao
                          variante={produto.ativo ? 'secundario' : 'primario'}
                          tamanho="sm"
                          disabled={alternandoId === produto.id}
                          onClick={() => alternarPublicacao(produto)}
                        >
                          {alternandoId === produto.id && <Loader2 size={14} className="animate-spin" />}
                          {produto.ativo ? 'Desativar' : 'Publicar'}
                        </Botao>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      ) : pedidos.length === 0 ? (
        <EmptyState
          icone={ReceiptText}
          titulo="Ainda não há pedidos deste evento"
          descricao="As compras feitas pela vitrine exclusiva aparecerão aqui, sem misturar com o catálogo regular."
        />
      ) : (
        <div className="space-y-3">
          {pedidos.map((pedido) => (
            <Card key={pedido.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/pedidos/${pedido.id}`} className="font-barlow text-lg font-black text-brand-text hover:text-brand-accent">
                      Pedido {pedido.orderNumber}
                    </Link>
                    <StatusPill status={pedido.status} />
                  </div>
                  <p className="mt-1 text-xs text-brand-muted">
                    {pedido.cliente?.nome || pedido.cliente?.email || 'Cliente sem cadastro'} · {dataHora.format(new Date(pedido.createdAt))}
                  </p>
                </div>
                <strong className="font-barlow text-xl text-brand-text">{moeda.format(pedido.total)}</strong>
              </div>
              <div className="mt-4 divide-y divide-brand-hair rounded-xl bg-brand-surface-2 px-4">
                {pedido.items.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span className="min-w-0 text-brand-text"><b>{item.quantidade}×</b> {item.nome}</span>
                    <span className="flex flex-wrap items-center gap-3 text-xs text-brand-muted">
                      {item.preVendaSnapshot && <span>Envio prometido: até {item.prazoEntregaDiasSnapshot ?? '—'} dias úteis</span>}
                      <b className="text-brand-text">{moeda.format(item.precoUnitario * item.quantidade)}</b>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        aberto={modalAberto}
        aoFechar={() => !salvando && setModalAberto(false)}
        titulo={editandoId ? 'Editar produto do evento' : 'Novo produto do evento'}
        descricao="Estoque zero e pré-venda são aplicados automaticamente e não podem ser desligados."
        largura="max-w-4xl"
        rodape={(
          <>
            <Botao type="button" variante="fantasma" disabled={salvando} onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao type="submit" form="produto-evento-form" disabled={salvando || enviandoImagem}>
              {salvando && <Loader2 size={15} className="animate-spin" />}
              {salvando ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Criar produto'}
            </Botao>
          </>
        )}
      >
        <form id="produto-evento-form" onSubmit={salvar} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Nome do produto" obrigatorio className="md:col-span-2">
              <Input value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} maxLength={180} required />
            </Campo>
            <Campo label="SKU" obrigatorio dica="Identificador único; letras, números, hífen, barra, ponto ou sublinhado.">
              <Input value={form.sku} onChange={(e) => atualizar('sku', e.target.value)} maxLength={80} required />
            </Campo>
            <Campo label="Marca" obrigatorio>
              <Input value={form.marca} onChange={(e) => atualizar('marca', e.target.value)} maxLength={80} required />
            </Campo>
            <Campo label="Categoria" obrigatorio>
              <Input value={form.categoria} onChange={(e) => atualizar('categoria', e.target.value)} maxLength={80} required />
            </Campo>
            <Campo label="Ordem na vitrine" dica="Menor número aparece primeiro.">
              <Input type="number" min="0" max="9999" step="1" value={form.ordemEvento} onChange={(e) => atualizar('ordemEvento', e.target.value)} required />
            </Campo>
            <Campo label="Descrição e condição da oferta" obrigatorio className="md:col-span-2">
              <Textarea value={form.descricao} onChange={(e) => atualizar('descricao', e.target.value)} minLength={10} maxLength={10000} rows={5} required />
            </Campo>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-dim">Preço e promessa de entrega</p>
            <div className="grid gap-4 md:grid-cols-3">
              <Campo label="Preço normal (R$)" obrigatorio>
                <Input type="number" min="0.01" max="9999999.99" step="0.01" value={form.preco} onChange={(e) => atualizar('preco', e.target.value)} required />
              </Campo>
              <Campo label="Preço especial (R$)" obrigatorio dica="Precisa ser menor que o preço normal.">
                <Input type="number" min="0.01" max="9999999.99" step="0.01" value={form.precoPromocional} onChange={(e) => atualizar('precoPromocional', e.target.value)} required />
              </Campo>
              <Campo label="Envio em até (dias úteis)" obrigatorio>
                <Input type="number" min="1" max="365" step="1" value={form.prazoEntregaDias} onChange={(e) => atualizar('prazoEntregaDias', e.target.value)} required />
              </Campo>
              <Campo label="Limite por pedido" obrigatorio dica="A pré-venda não depende do estoque físico.">
                <Input type="number" min="1" max="100" step="1" value={form.limitePorPedidoEvento} onChange={(e) => atualizar('limitePorPedidoEvento', e.target.value)} required />
              </Campo>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-dim">Frete — embalagem do produto</p>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <Campo label="Peso (kg)" obrigatorio>
                <Input type="number" min="0.001" max="200" step="0.001" value={form.peso} onChange={(e) => atualizar('peso', e.target.value)} required />
              </Campo>
              <Campo label="Altura (cm)" obrigatorio>
                <Input type="number" min="1" max="300" step="0.01" value={form.altura} onChange={(e) => atualizar('altura', e.target.value)} required />
              </Campo>
              <Campo label="Largura (cm)" obrigatorio>
                <Input type="number" min="1" max="300" step="0.01" value={form.largura} onChange={(e) => atualizar('largura', e.target.value)} required />
              </Campo>
              <Campo label="Comprimento (cm)" obrigatorio>
                <Input type="number" min="1" max="300" step="0.01" value={form.comprimento} onChange={(e) => atualizar('comprimento', e.target.value)} required />
              </Campo>
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-dim">Imagens</p>
                <p className="mt-1 text-xs text-brand-muted">A primeira imagem será a capa da oferta.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-brand-border bg-brand-surface-2 px-4 py-2 text-sm font-semibold text-brand-text hover:border-brand-accent">
                {enviandoImagem ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {enviandoImagem ? 'Enviando…' : 'Enviar imagem'}
                <input type="file" accept="image/*" className="sr-only" disabled={enviandoImagem} onChange={enviarImagem} />
              </label>
            </div>
            {form.imagens.length === 0 ? (
              <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-xs text-brand-muted">Nenhuma imagem enviada. Salve como rascunho ou envie uma imagem para publicar.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {form.imagens.map((url, indice) => (
                  <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-brand-border bg-brand-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Imagem ${indice + 1}`} className="h-full w-full object-contain p-2" />
                    {indice === 0 && <Badge tom="accent" className="absolute bottom-2 left-2">Capa</Badge>}
                    <button
                      type="button"
                      aria-label={`Remover imagem ${indice + 1}`}
                      onClick={() => atualizar('imagens', form.imagens.filter((imagem) => imagem !== url))}
                      className="absolute right-2 top-2 rounded-full bg-brand-danger p-1.5 text-white shadow"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Switch
              checked={form.ativo}
              onChange={(valor) => atualizar('ativo', valor)}
              label="Publicar na vitrine"
              descricao="Exige imagem, preço especial, prazo e dimensões válidas."
            />
            <Switch
              checked={form.destaque}
              onChange={(valor) => atualizar('destaque', valor)}
              label="Destacar oferta"
              descricao="Dá prioridade visual a este produto na ação."
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Resumo({ icone: Icone, rotulo, valor }: { icone: typeof Package; rotulo: string; valor: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent-soft text-brand-accent">
        <Icone size={19} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-brand-muted">{rotulo}</span>
        <strong className="font-barlow text-xl text-brand-text">{valor}</strong>
      </span>
    </Card>
  )
}
