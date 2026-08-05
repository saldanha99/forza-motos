'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Bike, Trash2, Link2, X, Search, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, SectionTitle, Botao, Badge, EmptyState } from '@/components/admin/ui/primitives'
import { Campo, Input, Modal } from '@/components/admin/ui/form'

interface Moto {
  id: string
  marca: string
  modelo: string
  anoDe: number
  anoAte: number | null
  slug: string
  produtos: number
  medidaDianteira: string | null
  medidaTraseira: string | null
  medidasConferidas: boolean
  fonteMedidas: string | null
}

interface ProdutoLite {
  id: string
  nome: string
  sku: string
  categoria: string
}

function faixa(anoDe: number, anoAte: number | null) {
  if (!anoAte) return `${anoDe} em diante`
  if (anoDe === anoAte) return `${anoDe}`
  return `${anoDe}–${anoAte}`
}

const FORM_VAZIO = { marca: '', modelo: '', anoDe: '', anoAte: '' }

export function MotosManager({ motosIniciais }: { motosIniciais: Moto[] }) {
  const [motos, setMotos] = useState(motosIniciais)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [vinculando, setVinculando] = useState<Moto | null>(null)
  const [filtro, setFiltro] = useState('')
  const [soAConferir, setSoAConferir] = useState(false)

  const visiveis = motos.filter((m) => {
    if (soAConferir && m.medidasConferidas) return false
    if (!filtro.trim()) return true
    const alvo = `${m.marca} ${m.modelo}`.toLowerCase()
    return alvo.includes(filtro.trim().toLowerCase())
  })

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const res = await fetch('/api/admin/motos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar moto')
      setMotos((m) => [data, ...m])
      setForm(FORM_VAZIO)
      toast.success('Moto cadastrada!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function remover(moto: Moto) {
    if (!confirm(`Excluir ${moto.marca} ${moto.modelo} (${faixa(moto.anoDe, moto.anoAte)})?`)) return
    const res = await fetch(`/api/admin/motos/${moto.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMotos((m) => m.filter((x) => x.id !== moto.id))
      toast.success('Moto excluída')
    } else toast.error('Erro ao excluir')
  }

  function onVinculado(motoId: string, total: number) {
    setMotos((m) => m.map((x) => (x.id === motoId ? { ...x, produtos: total } : x)))
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
      {/* Form criar moto */}
      <Card className="h-fit space-y-4 p-5">
        <SectionTitle>Nova moto</SectionTitle>
        <form onSubmit={criar} className="space-y-4">
          <Campo label="Marca" obrigatorio htmlFor="moto-marca">
            <Input
              id="moto-marca"
              value={form.marca}
              onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
              required
              placeholder="Honda, BMW, Yamaha…"
            />
          </Campo>
          <Campo label="Modelo" obrigatorio htmlFor="moto-modelo">
            <Input
              id="moto-modelo"
              value={form.modelo}
              onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
              required
              placeholder="CG 160, R 1200 GS…"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Ano de" obrigatorio htmlFor="moto-anode">
              <Input
                id="moto-anode"
                type="number"
                value={form.anoDe}
                onChange={(e) => setForm((f) => ({ ...f, anoDe: e.target.value }))}
                required
                placeholder="2016"
              />
            </Campo>
            <Campo label="Ano até" htmlFor="moto-anoate">
              <Input
                id="moto-anoate"
                type="number"
                value={form.anoAte}
                onChange={(e) => setForm((f) => ({ ...f, anoAte: e.target.value }))}
                placeholder="em diante"
              />
            </Campo>
          </div>
          <p className="text-xs text-brand-muted">
            Cada faixa de ano é um registro (ex.: GS 1200 <strong>até 2012</strong>, <strong>2013–2018</strong>, <strong>2019+</strong>).
          </p>
          <Botao type="submit" tamanho="lg" disabled={salvando} className="w-full">
            {salvando ? 'Cadastrando…' : 'Cadastrar moto'}
          </Botao>
        </form>
      </Card>

      {/* Lista */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dim" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por marca ou modelo…"
              className="pl-9"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-brand-muted">
            <input
              type="checkbox"
              checked={soAConferir}
              onChange={(e) => setSoAConferir(e.target.checked)}
              className="h-4 w-4 rounded border-brand-border accent-brand-accent"
            />
            Só as que faltam conferir
          </label>
          <span className="whitespace-nowrap text-xs text-brand-muted">
            {visiveis.length} de {motos.length}
          </span>
        </div>

        {motos.length === 0 && (
          <EmptyState
            icone={Bike}
            titulo="Nenhuma moto cadastrada"
            descricao="Uma moto aparece aqui assim que for cadastrada ao lado — com faixa de ano, medidas de pneu e produtos vinculados."
          />
        )}
        {visiveis.map((m) => (
          <LinhaMoto
            key={m.id}
            moto={m}
            onVincular={() => setVinculando(m)}
            onRemover={() => remover(m)}
            onAtualizar={(dados) =>
              setMotos((lista) => lista.map((x) => (x.id === m.id ? { ...x, ...dados } : x)))
            }
          />
        ))}
      </div>

      {vinculando && (
        <VincularModal
          moto={vinculando}
          onClose={() => setVinculando(null)}
          onSaved={(total) => { onVinculado(vinculando.id, total); setVinculando(null) }}
        />
      )}
    </div>
  )
}

// ── Linha da lista: dados da moto + medidas de fábrica ─────────────────────
function LinhaMoto({
  moto,
  onVincular,
  onRemover,
  onAtualizar,
}: {
  moto: Moto
  onVincular: () => void
  onRemover: () => void
  onAtualizar: (dados: Partial<Moto>) => void
}) {
  const [dianteira, setDianteira] = useState(moto.medidaDianteira ?? '')
  const [traseira, setTraseira] = useState(moto.medidaTraseira ?? '')
  const [salvando, setSalvando] = useState(false)

  const sujo =
    dianteira !== (moto.medidaDianteira ?? '') || traseira !== (moto.medidaTraseira ?? '')

  async function patch(corpo: Record<string, unknown>, msg: string) {
    setSalvando(true)
    try {
      const res = await fetch(`/api/admin/motos/${moto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      onAtualizar({
        medidaDianteira: data.medidaDianteira,
        medidaTraseira: data.medidaTraseira,
        medidasConferidas: data.medidasConferidas,
        fonteMedidas: data.fonteMedidas,
      })
      setDianteira(data.medidaDianteira ?? '')
      setTraseira(data.medidaTraseira ?? '')
      toast.success(msg)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-barlow font-bold text-brand-text">
            {moto.marca} {moto.modelo}
            <span className="font-normal text-brand-muted">· {faixa(moto.anoDe, moto.anoAte)}</span>
            {moto.medidasConferidas ? (
              <Badge tom="success">
                <Check size={11} /> Conferida
              </Badge>
            ) : moto.medidaDianteira ? (
              <Badge tom="info">A conferir{moto.fonteMedidas ? ` · ${moto.fonteMedidas}` : ''}</Badge>
            ) : (
              // Sem medida de fábrica quebra a busca por placa — precisa saltar aos olhos.
              <Badge tom="warning">Sem medida</Badge>
            )}
          </p>
          <p className="mt-0.5 text-xs text-brand-muted">
            {moto.produtos} produto{moto.produtos === 1 ? '' : 's'} vinculado{moto.produtos === 1 ? '' : 's'} ·{' '}
            <span className="text-brand-dim">/moto/{moto.slug}</span>
          </p>
        </div>
        <Botao type="button" variante="secundario" tamanho="sm" onClick={onVincular}>
          <Link2 size={14} /> Vincular produtos
        </Botao>
        <Botao
          type="button"
          variante="fantasma"
          tamanho="sm"
          onClick={onRemover}
          title="Excluir"
          className="text-brand-danger hover:bg-brand-danger-soft hover:text-brand-danger"
        >
          <Trash2 size={16} />
        </Botao>
      </div>

      {/* Medidas de fábrica — só os números; a moto aceita radial e diagonal */}
      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-brand-hair pt-3">
        <Campo label="Pneu dianteiro" htmlFor={`dianteira-${moto.id}`} className="w-[130px]">
          <Input
            id={`dianteira-${moto.id}`}
            value={dianteira}
            onChange={(e) => setDianteira(e.target.value)}
            placeholder="120/70-19"
            className="font-mono"
          />
        </Campo>
        <Campo label="Pneu traseiro" htmlFor={`traseira-${moto.id}`} className="w-[130px]">
          <Input
            id={`traseira-${moto.id}`}
            value={traseira}
            onChange={(e) => setTraseira(e.target.value)}
            placeholder="170/60-17"
            className="font-mono"
          />
        </Campo>

        {sujo && (
          <Botao
            type="button"
            variante="secundario"
            onClick={() => patch({ medidaDianteira: dianteira, medidaTraseira: traseira }, 'Medidas salvas')}
            disabled={salvando}
          >
            Salvar
          </Botao>
        )}

        {moto.medidasConferidas ? (
          <Botao
            type="button"
            variante="secundario"
            onClick={() => patch({ medidasConferidas: false }, 'Voltou para conferência')}
            disabled={salvando}
          >
            Desfazer conferência
          </Botao>
        ) : (
          <Botao
            type="button"
            onClick={() =>
              patch(
                { medidaDianteira: dianteira, medidaTraseira: traseira, medidasConferidas: true },
                'Medidas conferidas — já valem na busca por placa',
              )
            }
            title="Só os números da medida — quem escolhe radial ou diagonal é o cliente"
            disabled={salvando || !dianteira || !traseira}
            className="bg-brand-success text-brand-on-accent hover:brightness-95"
          >
            <Check size={14} /> Conferir
          </Botao>
        )}
      </div>
    </Card>
  )
}

// ── Modal de vinculação ────────────────────────────────────────────────────
function VincularModal({ moto, onClose, onSaved }: {
  moto: Moto
  onClose: () => void
  onSaved: (total: number) => void
}) {
  const [selecionados, setSelecionados] = useState<Map<string, ProdutoLite>>(new Map())
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ProdutoLite[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Carrega os já vinculados
  useEffect(() => {
    fetch(`/api/admin/motos/${moto.id}/produtos`)
      .then((r) => r.json())
      .then((lista: ProdutoLite[]) => {
        const map = new Map<string, ProdutoLite>()
        lista.forEach((p) => map.set(p.id, p))
        setSelecionados(map)
      })
      .catch(() => {})
  }, [moto.id])

  // Busca com debounce
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (busca.trim().length < 2) { setResultados([]); return }
    setCarregando(true)
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/produtos/buscar?q=${encodeURIComponent(busca.trim())}`)
        setResultados(await r.json())
      } finally {
        setCarregando(false)
      }
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [busca])

  function toggle(p: ProdutoLite) {
    setSelecionados((prev) => {
      const next = new Map(prev)
      if (next.has(p.id)) next.delete(p.id)
      else next.set(p.id, p)
      return next
    })
  }

  async function salvar() {
    setSalvando(true)
    try {
      const res = await fetch(`/api/admin/motos/${moto.id}/produtos`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selecionados.keys()) }),
      })
      if (!res.ok) throw new Error()
      toast.success('Vínculos salvos!')
      onSaved(selecionados.size)
    } catch {
      toast.error('Erro ao salvar vínculos')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      aberto
      aoFechar={onClose}
      titulo={`${moto.marca} ${moto.modelo} · ${faixa(moto.anoDe, moto.anoAte)}`}
      descricao={`${selecionados.size} produto(s) selecionado(s)`}
      largura="max-w-2xl"
      rodape={
        <>
          <Botao type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Botao>
          <Botao type="button" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar vínculos'}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        {selecionados.size > 0 && (
          <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
            {Array.from(selecionados.values()).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p)}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent-soft py-1 pl-3 pr-2 text-xs text-brand-accent hover:brightness-95"
              >
                <span className="max-w-[220px] truncate">{p.nome}</span>
                <X size={12} />
              </button>
            ))}
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dim" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
            placeholder="Buscar produto por nome, SKU ou categoria…"
            className="pl-9"
          />
        </div>

        {/* Resultados */}
        <div className="min-h-[120px]">
          {carregando && <p className="py-4 text-center text-sm text-brand-muted">Buscando…</p>}
          {!carregando && busca.trim().length >= 2 && resultados.length === 0 && (
            <p className="py-4 text-center text-sm text-brand-muted">Nenhum produto encontrado.</p>
          )}
          {resultados.map((p) => {
            const marcado = selecionados.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-brand-tint-2"
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    marcado
                      ? 'border-brand-accent bg-brand-accent text-brand-on-accent'
                      : 'border-brand-border',
                  )}
                >
                  {marcado && <Check size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-brand-text">{p.nome}</span>
                  <span className="block text-xs text-brand-muted">{p.sku} · {p.categoria}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
