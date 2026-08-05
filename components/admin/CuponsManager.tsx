'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Ticket, Plus, Trash2, Power } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { Card, Botao, Badge, EmptyState } from '@/components/admin/ui/primitives'
import { Campo, Input, Select, Modal } from '@/components/admin/ui/form'

interface Cupom {
  id: string
  codigo: string
  tipo: 'PERCENTUAL' | 'VALOR'
  valor: number
  minSubtotal: number | null
  validadeAte: string | null
  usoMaximo: number | null
  usados: number
  ativo: boolean
  descricao: string | null
}

const FORM_VAZIO = {
  codigo: '', tipo: 'PERCENTUAL' as 'PERCENTUAL' | 'VALOR', valor: '',
  minSubtotal: '', validadeAte: '', usoMaximo: '', descricao: '',
}

export function CuponsManager({ cuponsIniciais }: { cuponsIniciais: Cupom[] }) {
  const [cupons, setCupons] = useState(cuponsIniciais)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)

  function up(campo: string, v: string) {
    setForm((f) => ({ ...f, [campo]: v }))
  }

  function fecharModal() {
    setModalAberto(false)
    setForm(FORM_VAZIO)
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const res = await fetch('/api/admin/cupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar cupom')
      setCupons((c) => [{ ...data, valor: Number(data.valor), minSubtotal: data.minSubtotal ? Number(data.minSubtotal) : null }, ...c])
      fecharModal()
      toast.success('Cupom criado!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function toggle(cupom: Cupom) {
    const res = await fetch(`/api/admin/cupons/${cupom.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !cupom.ativo }),
    })
    if (res.ok) {
      setCupons((c) => c.map((x) => (x.id === cupom.id ? { ...x, ativo: !x.ativo } : x)))
    } else {
      toast.error('Erro ao alterar cupom')
    }
  }

  async function remover(cupom: Cupom) {
    if (!confirm(`Excluir o cupom ${cupom.codigo}?`)) return
    const res = await fetch(`/api/admin/cupons/${cupom.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCupons((c) => c.filter((x) => x.id !== cupom.id))
      toast.success('Cupom excluído')
    } else {
      toast.error('Erro ao excluir')
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-brand-muted">
          {cupons.length} cupom{cupons.length !== 1 ? 'ns' : ''} cadastrado{cupons.length !== 1 ? 's' : ''}
        </p>
        <Botao type="button" onClick={() => setModalAberto(true)}>
          <Plus size={16} /> Novo cupom
        </Botao>
      </div>

      {cupons.length === 0 ? (
        <EmptyState
          icone={Ticket}
          titulo="Nenhum cupom criado"
          descricao="Crie um cupom para ele aparecer aqui e poder ser aplicado no checkout da loja."
          acao={
            <Botao type="button" onClick={() => setModalAberto(true)}>
              <Plus size={16} /> Criar cupom
            </Botao>
          }
        />
      ) : (
        <div className="space-y-3">
          {cupons.map((c) => {
            const expirado = !!c.validadeAte && new Date(c.validadeAte) < new Date()
            const esgotado = c.usoMaximo != null && c.usados >= c.usoMaximo
            return (
              <Card key={c.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-barlow text-lg font-black tracking-wide text-brand-text">{c.codigo}</span>
                    <Badge tom="accent">{c.tipo === 'PERCENTUAL' ? `${c.valor}%` : formatPrice(c.valor)}</Badge>
                    {!c.ativo && <Badge tom="neutro">Inativo</Badge>}
                    {expirado && <Badge tom="danger">Expirado</Badge>}
                    {esgotado && <Badge tom="warning">Esgotado</Badge>}
                    {c.ativo && !expirado && !esgotado && <Badge tom="success">Ativo</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-brand-muted">
                    {c.descricao ? `${c.descricao} · ` : ''}
                    {c.minSubtotal ? `mín. ${formatPrice(c.minSubtotal)} · ` : ''}
                    usos: {c.usados}{c.usoMaximo != null ? `/${c.usoMaximo}` : ''}
                    {c.validadeAte ? ` · até ${new Date(c.validadeAte).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => toggle(c)}
                  title={c.ativo ? 'Desativar' : 'Ativar'}
                  className={cn(
                    'rounded-lg p-2 transition-colors',
                    c.ativo ? 'text-brand-success hover:bg-brand-success-soft' : 'text-brand-dim hover:bg-brand-tint-2',
                  )}
                >
                  <Power size={16} />
                </button>
                <button
                  onClick={() => remover(c)}
                  title="Excluir"
                  className="rounded-lg p-2 text-brand-muted transition-colors hover:bg-brand-danger-soft hover:text-brand-danger"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        aberto={modalAberto}
        aoFechar={fecharModal}
        titulo="Novo cupom"
        descricao="O desconto é sempre validado no servidor no momento do checkout."
        rodape={
          <>
            <Botao type="button" variante="fantasma" onClick={fecharModal}>
              Cancelar
            </Botao>
            <Botao type="submit" form="form-cupom" disabled={salvando}>
              {salvando ? 'Criando…' : 'Criar cupom'}
            </Botao>
          </>
        }
      >
        <form id="form-cupom" onSubmit={criar} className="space-y-4">
          <Campo label="Código" obrigatorio htmlFor="cup-codigo">
            <Input
              id="cup-codigo"
              value={form.codigo}
              onChange={(e) => up('codigo', e.target.value.toUpperCase())}
              placeholder="SOROCABA10"
              required
              className="uppercase"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Tipo" obrigatorio htmlFor="cup-tipo">
              <Select id="cup-tipo" value={form.tipo} onChange={(e) => up('tipo', e.target.value)}>
                <option value="PERCENTUAL">Percentual (%)</option>
                <option value="VALOR">Valor (R$)</option>
              </Select>
            </Campo>
            <Campo label={form.tipo === 'PERCENTUAL' ? 'Desconto (%)' : 'Desconto (R$)'} obrigatorio htmlFor="cup-valor">
              <Input
                id="cup-valor"
                type="number"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={(e) => up('valor', e.target.value)}
                required
              />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Mín. compra (R$)" htmlFor="cup-min">
              <Input
                id="cup-min"
                type="number"
                step="0.01"
                min="0"
                value={form.minSubtotal}
                onChange={(e) => up('minSubtotal', e.target.value)}
                placeholder="opcional"
              />
            </Campo>
            <Campo label="Máx. usos" htmlFor="cup-max">
              <Input
                id="cup-max"
                type="number"
                min="1"
                value={form.usoMaximo}
                onChange={(e) => up('usoMaximo', e.target.value)}
                placeholder="ilimitado"
              />
            </Campo>
          </div>

          <Campo label="Validade" htmlFor="cup-validade">
            <Input
              id="cup-validade"
              type="date"
              value={form.validadeAte}
              onChange={(e) => up('validadeAte', e.target.value)}
            />
          </Campo>

          <Campo label="Descrição interna" htmlFor="cup-descricao">
            <Input
              id="cup-descricao"
              value={form.descricao}
              onChange={(e) => up('descricao', e.target.value)}
              placeholder="Ex.: Evento custom Sorocaba"
            />
          </Campo>
        </form>
      </Modal>
    </div>
  )
}
