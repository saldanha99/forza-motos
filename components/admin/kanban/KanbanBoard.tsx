'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  closestCorners, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'
import { GripVertical, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TomStatus } from '@/lib/admin/status'
import { TOM_PONTO, TOM_TEXTO, EmptyState } from '@/components/admin/ui/primitives'

/* ═══════════════════════════════════════════════════════════════════
   Contrato
   ═══════════════════════════════════════════════════════════════════ */

export type ColunaKanban = {
  /** Valor do status que esta coluna representa. */
  id: string
  /** Nome em linguagem de operação ("Pago — separar"), não o enum cru. */
  titulo: string
  tom: TomStatus
  /** O que faz um card cair aqui — vira o texto do estado vazio. */
  vazio?: string
  /** Coluna derivada/somente leitura: mostra, mas não aceita card. */
  bloqueada?: boolean
}

export type ItemKanban = {
  id: string
  coluna: string
  /** Usado no rodapé da coluna (soma de valores, por ex.). */
  valor?: number
  /** Texto curto que identifica o card nos avisos ("Pedido FM-2026-0042"). */
  rotulo: string
}

type Props<T extends ItemKanban> = {
  colunas: ColunaKanban[]
  itens: T[]
  renderCard: (item: T, estado: { arrastando: boolean; overlay: boolean }) => React.ReactNode
  /** Faz a mudança no servidor. Se lançar erro, o card volta sozinho. */
  onMover: (item: T, paraColuna: string) => Promise<void>
  /** Rodapé da coluna — ex.: total em R$. */
  resumoColuna?: (itens: T[], coluna: ColunaKanban) => React.ReactNode
  /** Cards por coluna antes de virar rolagem interna. */
  alturaColuna?: string
  className?: string
}

/* ═══════════════════════════════════════════════════════════════════
   Card arrastável
   ═══════════════════════════════════════════════════════════════════ */

function CardArrastavel<T extends ItemKanban>({
  item, renderCard, movendo, novo, colunas, onMoverManual,
}: {
  item: T
  renderCard: Props<T>['renderCard']
  movendo: boolean
  novo: boolean
  colunas: ColunaKanban[]
  onMoverManual: (item: T, para: string) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
    disabled: movendo,
  })

  const destinos = colunas.filter((c) => !c.bloqueada && c.id !== item.coluna)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative rounded-xl border border-brand-border bg-brand-surface p-3 transition-colors',
        'hover:border-brand-accent',
        isDragging && 'kanban-card-arrastando',
        novo && 'kanban-card-novo',
        movendo && 'pointer-events-none opacity-60',
      )}
    >
      {/* A alça é o único ponto de arraste: o resto do card continua clicável
          (links para o detalhe, botões de ação). */}
      <div className="flex items-start gap-2">
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label={`Arrastar ${item.rotulo}`}
          className={cn(
            'mt-0.5 shrink-0 cursor-grab touch-none rounded-md p-0.5 text-brand-dim opacity-0 transition-opacity',
            'hover:bg-brand-tint-2 hover:text-brand-text focus-visible:opacity-100 group-hover:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
          )}
        >
          {movendo ? <Loader2 size={14} className="animate-spin" /> : <GripVertical size={14} />}
        </button>

        <div className="min-w-0 flex-1">{renderCard(item, { arrastando: isDragging, overlay: false })}</div>
      </div>

      {/* Alternativa ao arraste — no celular e no teclado é por aqui */}
      {destinos.length > 0 && (
        <label className="mt-2.5 flex items-center gap-2 border-t border-brand-hair pt-2.5">
          <span className="sr-only">Mover {item.rotulo} para</span>
          <select
            value=""
            disabled={movendo}
            onChange={(e) => e.target.value && onMoverManual(item, e.target.value)}
            className={cn(
              'w-full rounded-lg border border-brand-border bg-brand-surface-2 px-2 py-1.5',
              'text-[11px] font-semibold uppercase tracking-wide text-brand-muted',
              'focus:border-brand-accent focus:outline-none disabled:opacity-50',
            )}
          >
            <option value="">Mover para…</option>
            {destinos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Coluna
   ═══════════════════════════════════════════════════════════════════ */

function Coluna<T extends ItemKanban>({
  coluna, itens, children, resumo,
}: {
  coluna: ColunaKanban
  itens: T[]
  children: React.ReactNode
  resumo?: React.ReactNode
}) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: coluna.id,
    disabled: coluna.bloqueada,
  })

  const arrastandoDeFora =
    !!active && !coluna.bloqueada && (active.data.current as any)?.item?.coluna !== coluna.id

  return (
    <section className="flex w-[290px] shrink-0 snap-start flex-col sm:w-[300px]">
      <header className="mb-2.5 flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2.5">
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TOM_PONTO[coluna.tom])} />
        <h3 className="min-w-0 flex-1 truncate font-barlow text-[13px] font-bold uppercase tracking-wide text-brand-text">
          {coluna.titulo}
        </h3>
        <span className="shrink-0 rounded-full bg-brand-tint-2 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-brand-muted">
          {itens.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        aria-label={coluna.titulo}
        className={cn(
          'admin-scroll flex max-h-[calc(100vh-330px)] min-h-[132px] flex-col gap-2.5 overflow-y-auto rounded-xl',
          'border border-dashed border-transparent p-1 transition-all',
          arrastandoDeFora && 'border-brand-border-strong bg-brand-tint-1',
          isOver && arrastandoDeFora && 'kanban-coluna-alvo',
        )}
      >
        {itens.length === 0 ? (
          <EmptyState
            compacto
            titulo="Nada aqui"
            descricao={coluna.vazio}
            className="my-auto border-brand-hair"
          />
        ) : (
          children
        )}
      </div>

      {resumo && (
        <p className="mt-2 px-1 text-[11px] font-semibold tabular-nums text-brand-dim">{resumo}</p>
      )}
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Board
   ═══════════════════════════════════════════════════════════════════ */

export function KanbanBoard<T extends ItemKanban>({
  colunas, itens, renderCard, onMover, resumoColuna, className,
}: Props<T>) {
  const router = useRouter()

  // Espelho local para o movimento aparecer na hora; o servidor confirma depois.
  const [local, setLocal] = useState<T[]>(itens)
  const [movendo, setMovendo] = useState<Set<string>>(new Set())
  const [recemMovido, setRecemMovido] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<T | null>(null)

  // Props mandam: toda revalidação do servidor sobrescreve o espelho.
  const assinatura = useMemo(
    () => itens.map((i) => `${i.id}:${i.coluna}`).join('|'),
    [itens],
  )
  useEffect(() => setLocal(itens), [assinatura]) // eslint-disable-line react-hooks/exhaustive-deps

  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const sensores = useSensors(
    // 6px de folga para não confundir clique com arraste
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // No toque, segurar 180ms evita arrastar sem querer ao rolar a tela
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const mover = useCallback(
    async (item: T, para: string, { avisar = true } = {}) => {
      const de = item.coluna
      if (de === para) return

      const colunaDestino = colunas.find((c) => c.id === para)
      if (!colunaDestino || colunaDestino.bloqueada) return

      // 1. Move na tela imediatamente
      setLocal((l) => l.map((i) => (i.id === item.id ? { ...i, coluna: para } : i)))
      setMovendo((m) => new Set(m).add(item.id))
      setRecemMovido(item.id)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setRecemMovido(null), 400)

      try {
        // 2. Confirma no servidor
        await onMover(item, para)

        if (avisar) {
          toast.success(
            (t) => (
              <span className="flex items-center gap-3">
                <span>
                  {item.rotulo} → <b>{colunaDestino.titulo}</b>
                </span>
                <button
                  onClick={() => {
                    toast.dismiss(t.id)
                    mover({ ...item, coluna: para }, de, { avisar: false })
                  }}
                  className="shrink-0 rounded-lg bg-brand-tint-2 px-2 py-1 text-xs font-bold text-brand-accent"
                >
                  Desfazer
                </button>
              </span>
            ),
            { duration: 6000 },
          )
        }

        router.refresh()
      } catch (e: any) {
        // 3. Falhou: o card volta pra onde estava
        setLocal((l) => l.map((i) => (i.id === item.id ? { ...i, coluna: de } : i)))
        toast.error(e?.message || `Não consegui mover ${item.rotulo}. O card voltou.`)
      } finally {
        setMovendo((m) => {
          const n = new Set(m)
          n.delete(item.id)
          return n
        })
      }
    },
    [colunas, onMover, router],
  )

  function onDragStart(e: DragStartEvent) {
    setArrastando((e.active.data.current as any)?.item ?? null)
  }

  function onDragEnd(e: DragEndEvent) {
    setArrastando(null)
    const item = (e.active.data.current as any)?.item as T | undefined
    const destino = e.over?.id
    if (item && typeof destino === 'string') mover(item, destino)
  }

  const porColuna = useMemo(() => {
    const mapa = new Map<string, T[]>()
    colunas.forEach((c) => mapa.set(c.id, []))
    local.forEach((i) => mapa.get(i.coluna)?.push(i))
    return mapa
  }, [colunas, local])

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setArrastando(null)}
    >
      <div className={cn('admin-scroll -mx-1 snap-x overflow-x-auto px-1 pb-3', className)}>
        <div className="flex min-w-max gap-4">
          {colunas.map((coluna) => {
            const daColuna = porColuna.get(coluna.id) ?? []
            return (
              <Coluna
                key={coluna.id}
                coluna={coluna}
                itens={daColuna}
                resumo={resumoColuna?.(daColuna, coluna)}
              >
                {daColuna.map((item) => (
                  <CardArrastavel
                    key={item.id}
                    item={item}
                    renderCard={renderCard}
                    colunas={colunas}
                    movendo={movendo.has(item.id)}
                    novo={recemMovido === item.id}
                    onMoverManual={mover}
                  />
                ))}
              </Coluna>
            )
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
        {arrastando && (
          <div className="kanban-overlay w-[276px] rounded-xl border border-brand-accent bg-brand-surface p-3">
            {renderCard(arrastando, { arrastando: true, overlay: true })}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** Cabeçalho de card padrão — mantém os 4 boards com a mesma leitura. */
export function CardKanbanTopo({
  titulo, href, direita, tom,
}: {
  titulo: React.ReactNode
  href?: string
  direita?: React.ReactNode
  tom?: TomStatus
}) {
  const conteudo = (
    <span className={cn('truncate font-semibold', tom ? TOM_TEXTO[tom] : 'text-brand-text')}>
      {titulo}
    </span>
  )
  return (
    <div className="flex items-start justify-between gap-2">
      {href ? (
        <a href={href} className="min-w-0 truncate hover:underline">
          {conteudo}
        </a>
      ) : (
        <span className="min-w-0 truncate">{conteudo}</span>
      )}
      {direita && <span className="shrink-0 text-xs text-brand-muted">{direita}</span>}
    </div>
  )
}
