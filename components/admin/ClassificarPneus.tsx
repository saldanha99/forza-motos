'use client'

/**
 * Classificação em massa dos pneus do catálogo.
 *
 * A ficha do produto continua sendo o lugar de ajustar um pneu específico;
 * esta tela existe para a primeira passada, quando são dezenas de uma vez.
 *
 * O palpite vem do nome do produto e aparece como sugestão — nada é gravado
 * sem alguém confirmar. "Aplicar sugestões" só preenche os campos na tela; o
 * botão de salvar é que escreve no banco.
 */
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Wand2, Save, RotateCcw, Filter, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, Botao, Badge, EmptyState } from '@/components/admin/ui/primitives'
import { Input, Select } from '@/components/admin/ui/form'

export interface SegmentoOpcao {
  id: string
  nome: string
  slug: string
  ativo: boolean
}

export interface ProdutoPneu {
  id: string
  nome: string
  marca: string
  sku: string
  temImagem: boolean
  pneuSegmentoId: string | null
  pneuLinha: string | null
  sugestao: {
    linha: string
    termo: string
    segmentoId: string | null
    segmentoNome: string | null
  } | null
}

type Rascunho = Record<string, { segmentoId: string; linha: string }>

function estadoInicial(produtos: ProdutoPneu[]): Rascunho {
  return Object.fromEntries(
    produtos.map((p) => [p.id, { segmentoId: p.pneuSegmentoId ?? '', linha: p.pneuLinha ?? '' }]),
  )
}

export function ClassificarPneus({
  produtos,
  segmentos,
}: {
  produtos: ProdutoPneu[]
  segmentos: SegmentoOpcao[]
}) {
  const [salvos, setSalvos] = useState(() => estadoInicial(produtos))
  const [rascunho, setRascunho] = useState<Rascunho>(() => estadoInicial(produtos))
  const [salvando, setSalvando] = useState(false)
  const [soPendentes, setSoPendentes] = useState(true)

  function mudar(id: string, campo: 'segmentoId' | 'linha', valor: string) {
    setRascunho((r) => ({ ...r, [id]: { ...r[id], [campo]: valor } }))
  }

  const pendentes = useMemo(
    () =>
      produtos.filter((p) => {
        const atual = rascunho[p.id]
        const gravado = salvos[p.id]
        return atual.segmentoId !== gravado.segmentoId || atual.linha !== gravado.linha
      }),
    [produtos, rascunho, salvos],
  )

  const semClassificacao = useMemo(
    () => produtos.filter((p) => !salvos[p.id].segmentoId),
    [produtos, salvos],
  )

  const visiveis = soPendentes
    ? produtos.filter((p) => !salvos[p.id].segmentoId || pendentes.includes(p))
    : produtos

  /** Preenche na tela tudo que está vazio e tem palpite. Não grava nada. */
  function aplicarSugestoes() {
    let aplicadas = 0
    setRascunho((r) => {
      const novo = { ...r }
      for (const p of produtos) {
        if (!p.sugestao?.segmentoId) continue
        // Respeita o que já está classificado ou o que a pessoa digitou.
        if (novo[p.id].segmentoId || novo[p.id].linha) continue
        novo[p.id] = { segmentoId: p.sugestao.segmentoId, linha: p.sugestao.linha }
        aplicadas++
      }
      return novo
    })
    toast.success(
      aplicadas === 0
        ? 'Nada para sugerir — o que estava vazio já foi preenchido.'
        : `${aplicadas} ${aplicadas === 1 ? 'pneu preenchido' : 'pneus preenchidos'}. Confira e salve.`,
    )
  }

  function desfazer() {
    setRascunho(salvos)
    toast.success('Alterações descartadas.')
  }

  async function salvar() {
    if (pendentes.length === 0) return
    setSalvando(true)
    try {
      const res = await fetch('/api/admin/pneus-classificacao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: pendentes.map((p) => ({
            id: p.id,
            pneuSegmentoId: rascunho[p.id].segmentoId || null,
            pneuLinha: rascunho[p.id].linha,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      setSalvos(rascunho)
      toast.success(
        `${data.salvos} ${data.salvos === 1 ? 'pneu classificado' : 'pneus classificados'} — já está na vitrine.`,
      )
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  if (produtos.length === 0) {
    return (
      <EmptyState
        icone={Filter}
        titulo="Nenhum pneu no catálogo"
        descricao="Quando entrar pneu publicado, ele aparece aqui para classificar."
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Botao type="button" variante="secundario" onClick={aplicarSugestoes} disabled={salvando}>
          <Wand2 size={14} /> Aplicar sugestões
        </Botao>
        <Botao type="button" onClick={salvar} disabled={salvando || pendentes.length === 0}>
          <Save size={14} />
          {salvando
            ? 'Salvando…'
            : pendentes.length > 0
              ? `Salvar ${pendentes.length}`
              : 'Nada a salvar'}
        </Botao>
        {pendentes.length > 0 && (
          <Botao type="button" variante="fantasma" onClick={desfazer} disabled={salvando}>
            <RotateCcw size={13} /> Desfazer
          </Botao>
        )}

        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-brand-muted">
          <input
            type="checkbox"
            checked={soPendentes}
            onChange={(e) => setSoPendentes(e.target.checked)}
          />
          Mostrar só o que falta
        </label>
      </div>

      <p className="mb-4 text-sm text-brand-muted">
        {semClassificacao.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-success">
            <CircleCheck size={14} /> Todos os {produtos.length} pneus estão classificados.
          </span>
        ) : (
          <>
            {semClassificacao.length} de {produtos.length}{' '}
            {semClassificacao.length === 1 ? 'pneu ainda sem categoria' : 'pneus ainda sem categoria'}
            . A categoria só aparece em /pneus quando tiver pelo menos um produto dentro.
          </>
        )}
      </p>

      <div className="space-y-2">
        {visiveis.map((p) => {
          const atual = rascunho[p.id]
          const gravado = salvos[p.id]
          const alterado = atual.segmentoId !== gravado.segmentoId || atual.linha !== gravado.linha
          const classificado = Boolean(gravado.segmentoId)

          return (
            <Card
              key={p.id}
              className={cn('px-4 py-3', alterado && 'border-brand-accent')}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="min-w-[240px] flex-1">
                  <p className="text-sm font-semibold leading-tight text-brand-text">{p.nome}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-brand-muted">
                    <span>SKU {p.sku}</span>
                    {classificado && !alterado && <Badge tom="success">Classificado</Badge>}
                    {alterado && <Badge tom="warning">Não salvo</Badge>}
                    {!p.temImagem && <Badge tom="info">Sem foto</Badge>}
                  </p>
                  {p.sugestao && !atual.segmentoId && !atual.linha && (
                    <button
                      type="button"
                      onClick={() =>
                        setRascunho((r) => ({
                          ...r,
                          [p.id]: {
                            segmentoId: p.sugestao?.segmentoId ?? '',
                            linha: p.sugestao?.linha ?? '',
                          },
                        }))
                      }
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-accent hover:underline"
                    >
                      <Wand2 size={11} />
                      Usar sugestão: {p.sugestao.segmentoNome ?? '—'} · {p.sugestao.linha}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:w-[460px]">
                  <Select
                    aria-label={`Categoria de ${p.nome}`}
                    value={atual.segmentoId}
                    onChange={(e) => mudar(p.id, 'segmentoId', e.target.value)}
                    className="sm:w-[220px]"
                  >
                    <option value="">— sem categoria —</option>
                    {segmentos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                        {s.ativo ? '' : ' (oculta)'}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label={`Modelo de ${p.nome}`}
                    value={atual.linha}
                    onChange={(e) => mudar(p.id, 'linha', e.target.value)}
                    placeholder="Modelo (ex.: Angel GT)"
                  />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {visiveis.length === 0 && (
        <EmptyState
          icone={CircleCheck}
          titulo="Nada pendente"
          descricao="Desmarque “mostrar só o que falta” para rever os pneus já classificados."
          compacto
        />
      )}
    </div>
  )
}
