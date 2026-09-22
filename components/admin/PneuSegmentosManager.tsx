'use client'

/**
 * Categorias de pneu (Custom, Big Trail, Esportivo/Street, Scooter) exibidas
 * em /pneus. A loja cria, renomeia, reordena e desativa sem deploy.
 *
 * Classificar cada pneu é feito na ficha do produto — aqui só existem as
 * categorias e a ordem em que aparecem na vitrine.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Layers, Plus, Trash2, Power, ArrowUp, ArrowDown, Pencil, Check, X } from 'lucide-react'
import { Card, Botao, Badge, EmptyState } from '@/components/admin/ui/primitives'
import { Campo, Input, Modal } from '@/components/admin/ui/form'

export interface Segmento {
  id: string
  nome: string
  slug: string
  descricao: string | null
  ordem: number
  ativo: boolean
  produtos: number
}

const FORM_VAZIO = { nome: '', descricao: '' }

export function PneuSegmentosManager({ segmentosIniciais }: { segmentosIniciais: Segmento[] }) {
  const [segmentos, setSegmentos] = useState(segmentosIniciais)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState(FORM_VAZIO)

  function ordenar(lista: Segmento[]) {
    return [...lista].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const res = await fetch('/api/admin/pneus-segmentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar categoria')
      setSegmentos((s) => ordenar([...s, data]))
      setForm(FORM_VAZIO)
      setModalAberto(false)
      toast.success('Categoria criada!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function salvarCampos(id: string, campos: Record<string, unknown>) {
    const res = await fetch(`/api/admin/pneus-segmentos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar categoria')
    setSegmentos((s) => ordenar(s.map((x) => (x.id === id ? { ...x, ...data } : x))))
    return data
  }

  async function alternarAtivo(seg: Segmento) {
    try {
      await salvarCampos(seg.id, { ativo: !seg.ativo })
      toast.success(seg.ativo ? 'Categoria oculta na loja.' : 'Categoria publicada.')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function mover(seg: Segmento, direcao: -1 | 1) {
    const lista = ordenar(segmentos)
    const i = lista.findIndex((s) => s.id === seg.id)
    const vizinho = lista[i + direcao]
    if (!vizinho) return

    // Troca a ordem com o vizinho. Salva os dois, senão a lista volta ao
    // recarregar a página com a ordem antiga.
    try {
      await Promise.all([
        salvarCampos(seg.id, { ordem: vizinho.ordem }),
        salvarCampos(vizinho.id, { ordem: seg.ordem }),
      ])
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function renomear(id: string) {
    if (!rascunho.nome.trim()) return
    try {
      await salvarCampos(id, { nome: rascunho.nome, descricao: rascunho.descricao })
      setEditando(null)
      toast.success('Categoria atualizada — o link da vitrine acompanhou o novo nome.')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function remover(seg: Segmento) {
    if (!confirm(`Apagar a categoria "${seg.nome}"?`)) return
    try {
      const res = await fetch(`/api/admin/pneus-segmentos/${seg.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao apagar categoria')
      setSegmentos((s) => s.filter((x) => x.id !== seg.id))
      toast.success('Categoria apagada.')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const lista = ordenar(segmentos)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-brand-muted">
          Estas categorias aparecem em <strong className="text-brand-text">/pneus</strong>. Cada pneu
          é classificado na ficha do produto, em Produtos.
        </p>
        <Botao type="button" onClick={() => setModalAberto(true)}>
          <Plus size={14} /> Nova categoria
        </Botao>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icone={Layers}
          titulo="Nenhuma categoria de pneu"
          descricao="Crie categorias como Custom, Big Trail, Esportivo/Street e Scooter para organizar a vitrine."
        />
      ) : (
        <div className="space-y-3">
          {lista.map((seg, i) => (
            <Card key={seg.id} className="px-5 py-4">
              {editando === seg.id ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Campo label="Nome" className="flex-1">
                    <Input
                      value={rascunho.nome}
                      onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
                      autoFocus
                    />
                  </Campo>
                  <Campo label="Descrição (opcional)" className="flex-1">
                    <Input
                      value={rascunho.descricao}
                      onChange={(e) => setRascunho((r) => ({ ...r, descricao: e.target.value }))}
                    />
                  </Campo>
                  <div className="flex gap-2">
                    <Botao type="button" tamanho="sm" onClick={() => renomear(seg.id)}>
                      <Check size={13} /> Salvar
                    </Botao>
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      onClick={() => setEditando(null)}
                    >
                      <X size={13} /> Cancelar
                    </Botao>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-barlow text-[16px] font-bold text-brand-text">{seg.nome}</p>
                      {seg.ativo ? (
                        <Badge tom="success">Na loja</Badge>
                      ) : (
                        <Badge tom="info">Oculta</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-brand-muted">
                      /pneus/categoria/{seg.slug} · {seg.produtos}{' '}
                      {seg.produtos === 1 ? 'pneu classificado' : 'pneus classificados'}
                      {seg.descricao ? ` · ${seg.descricao}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      disabled={i === 0}
                      onClick={() => mover(seg, -1)}
                      title="Subir na vitrine"
                    >
                      <ArrowUp size={13} />
                    </Botao>
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      disabled={i === lista.length - 1}
                      onClick={() => mover(seg, 1)}
                      title="Descer na vitrine"
                    >
                      <ArrowDown size={13} />
                    </Botao>
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      onClick={() => {
                        setEditando(seg.id)
                        setRascunho({ nome: seg.nome, descricao: seg.descricao ?? '' })
                      }}
                    >
                      <Pencil size={13} /> Renomear
                    </Botao>
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      onClick={() => alternarAtivo(seg)}
                    >
                      <Power size={13} /> {seg.ativo ? 'Ocultar' : 'Publicar'}
                    </Botao>
                    <Botao
                      type="button"
                      variante="perigo"
                      tamanho="sm"
                      onClick={() => remover(seg)}
                    >
                      <Trash2 size={13} />
                    </Botao>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo="Nova categoria de pneu">
        <form onSubmit={criar} className="space-y-4">
          <Campo label="Nome">
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Big Trail"
              required
              autoFocus
            />
          </Campo>
          <Campo label="Descrição (opcional)">
            <Input
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Aparece embaixo do nome no card da vitrine"
            />
          </Campo>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setModalAberto(false)}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={salvando}>
              {salvando ? 'Criando…' : 'Criar categoria'}
            </Botao>
          </div>
        </form>
      </Modal>
    </div>
  )
}
