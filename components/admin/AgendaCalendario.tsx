'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Plus, X, MessageCircle, Trash2, Clock, Bike, Wrench } from 'lucide-react'
import { cn, whatsappLink } from '@/lib/utils'
import { STATUS_AGENDAMENTO, definicaoStatus } from '@/lib/admin/status'
import { Card, StatusPill, TOM_PONTO, EmptyState, Botao } from '@/components/admin/ui/primitives'
import { Modal, Campo, Input, Select, Textarea } from '@/components/admin/ui/form'
import { ReservaAgendamento } from '@/components/admin/ReservaAgendamento'

const SERVICOS = [
  'Troca de Pneu Dianteiro',
  'Troca de Pneu Traseiro',
  'Troca de Pneu (Par)',
  'Troca de Pastilha de Freio',
  'Troca de Óleo',
  'Kit de Transmissão (corrente + coroa + pinhão)',
  'Manutenção Preventiva',
  'Outro serviço',
]

// Admin vê todos os slots possíveis (semana 9h–17h + sábado a partir das 8h)
const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']

/** Ponto de status para as marcações do dia — vocabulário único em lib/admin/status. */
function pontoDoStatus(status: string) {
  return TOM_PONTO[definicaoStatus(status).tom]
}

type Appointment = {
  id: string
  nome: string
  telefone: string
  servico: string
  motoModelo: string
  dataPreferida: string
  horarioPreferido: string
  status: string
  notas?: string | null
}

type Props = {
  agendamentos: Appointment[]
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function AgendaCalendario({ agendamentos: initial }: Props) {
  const router = useRouter()
  const [agendamentos, setAgendamentos] = useState(initial)

  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())

  const [diaAberto, setDiaAberto] = useState<string | null>(null)
  const [showNovo, setShowNovo] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const [novoForm, setNovoForm] = useState({
    nome: '', telefone: '', servico: '', motoModelo: '',
    dataPreferida: '', horarioPreferido: '', notas: '', status: 'confirmado',
  })

  // Agrupar agendamentos por dia ISO
  const porDia = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    for (const a of agendamentos) {
      const key = isoDate(new Date(a.dataPreferida))
      if (!map[key]) map[key] = []
      map[key].push(a)
    }
    return map
  }, [agendamentos])

  // Calcular dias do mês
  const primeiroDia = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function navMes(delta: number) {
    let m = mes + delta
    let a = ano
    if (m < 0) { m = 11; a-- }
    if (m > 11) { m = 0; a++ }
    setMes(m)
    setAno(a)
    setDiaAberto(null)
  }

  function dayKey(dia: number) {
    return `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
  }

  async function alterarStatus(id: string, status: string) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/agendamentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      toast.success('Status atualizado')
    } catch {
      toast.error('Erro ao atualizar')
    } finally {
      setLoadingId(null)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este agendamento?')) return
    setLoadingId(id)
    try {
      const res = await fetch(`/api/agendamentos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAgendamentos(prev => prev.filter(a => a.id !== id))
      if (diaAberto) {
        const remaining = (porDia[diaAberto] || []).filter(a => a.id !== id)
        if (remaining.length === 0) setDiaAberto(null)
      }
      toast.success('Excluído')
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setLoadingId(null)
    }
  }

  async function criarAgendamento() {
    const { nome, telefone, servico, motoModelo, dataPreferida, horarioPreferido } = novoForm
    if (!nome || !telefone || !servico || !motoModelo || !dataPreferida || !horarioPreferido) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setLoadingId('novo')
    try {
      const res = await fetch('/api/admin/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoForm),
      })
      if (!res.ok) throw new Error()
      const novo: Appointment = await res.json()
      setAgendamentos(prev => [...prev, { ...novo, dataPreferida: novo.dataPreferida }])
      setShowNovo(false)
      setNovoForm({ nome: '', telefone: '', servico: '', motoModelo: '', dataPreferida: '', horarioPreferido: '', notas: '', status: 'confirmado' })
      toast.success('Agendamento criado!')
      const key = isoDate(new Date(novo.dataPreferida))
      setDiaAberto(key)
      // navegar para o mês do agendamento
      const d = new Date(novo.dataPreferida)
      setAno(d.getFullYear())
      setMes(d.getMonth())
    } catch {
      toast.error('Erro ao criar agendamento')
    } finally {
      setLoadingId(null)
    }
  }

  const diaAbertoAgendamentos = diaAberto ? (porDia[diaAberto] || []) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navMes(-1)} className="p-2 rounded-xl border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-accent transition-all">
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-barlow font-bold text-xl text-brand-text min-w-[160px] text-center">
            {MESES[mes]} {ano}
          </h2>
          <button onClick={() => navMes(1)} className="p-2 rounded-xl border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-accent transition-all">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => { setAno(hoje.getFullYear()); setMes(hoje.getMonth()) }}
            className="text-xs text-brand-muted border border-brand-border px-3 py-1.5 rounded-lg hover:border-brand-accent transition-all ml-1"
          >
            Hoje
          </button>
        </div>
        <Botao onClick={() => setShowNovo(true)}>
          <Plus size={16} />
          Novo Agendamento
        </Botao>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(STATUS_AGENDAMENTO).map(([k, def]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-brand-muted">
            <span className={cn('w-2.5 h-2.5 rounded-full', TOM_PONTO[def.tom])} />
            {def.label}
          </div>
        ))}
      </div>

      <div className="flex gap-4 flex-col xl:flex-row">
        {/* Calendário */}
        <Card className="flex-1 p-4">
          {/* Cabeçalho dias semana */}
          <div className="grid grid-cols-7 mb-2">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-brand-muted uppercase py-2">{d}</div>
            ))}
          </div>
          {/* Células */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((dia, idx) => {
              if (!dia) return <div key={idx} />
              const key = dayKey(dia)
              const eventos = porDia[key] || []
              const ehHoje = key === isoDate(hoje)
              const selecionado = diaAberto === key
              return (
                <button
                  key={idx}
                  onClick={() => setDiaAberto(selecionado ? null : key)}
                  className={cn(
                    'relative flex flex-col items-center rounded-xl py-2 px-1 min-h-[56px] transition-all duration-150',
                    selecionado
                      ? 'bg-brand-accent text-brand-on-accent shadow-cta'
                      : ehHoje
                        ? 'bg-brand-accent-soft border border-brand-accent text-brand-accent font-bold'
                        : 'border border-transparent hover:bg-brand-tint-1 hover:border-brand-border text-brand-text',
                  )}
                >
                  <span className="text-sm font-medium">{dia}</span>
                  {eventos.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[40px]">
                      {eventos.slice(0, 4).map((a, i) => (
                        <span key={i} className={cn('w-1.5 h-1.5 rounded-full', pontoDoStatus(a.status))} />
                      ))}
                      {eventos.length > 4 && (
                        <span className="text-[9px] text-brand-dim">+{eventos.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Painel lateral do dia */}
        {diaAberto && (
          <Card className="xl:w-[380px] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-brand-muted uppercase tracking-wide">Agendamentos</p>
                <p className="font-barlow font-bold text-brand-text text-lg">
                  {new Date(diaAberto + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
              </div>
              <button onClick={() => setDiaAberto(null)} className="text-brand-muted hover:text-brand-text transition-colors p-1">
                <X size={18} />
              </button>
            </div>

            {diaAbertoAgendamentos.length === 0 ? (
              <EmptyState
                compacto
                titulo="Nenhum agendamento neste dia"
                acao={
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    onClick={() => { setNovoForm(f => ({ ...f, dataPreferida: diaAberto })); setShowNovo(true) }}
                  >
                    <Plus size={14} /> Criar agendamento
                  </Botao>
                }
              />
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 -mr-1">
                {diaAbertoAgendamentos
                  .sort((a, b) => a.horarioPreferido.localeCompare(b.horarioPreferido))
                  .map(a => {
                    const tel = a.telefone.replace(/\D/g, '')
                    const whatsMsg = `Olá ${a.nome}! Confirmamos seu agendamento para ${a.servico} às ${a.horarioPreferido}. Forza Motos.`
                    return (
                      <div key={a.id} className="bg-brand-surface-2 border border-brand-border rounded-xl p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-brand-text text-sm">{a.nome}</p>
                            <p className="text-xs text-brand-muted">{a.telefone}</p>
                          </div>
                          <StatusPill status={a.status} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-brand-muted">
                          <Clock size={11} className="shrink-0" />
                          <span>{a.horarioPreferido}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-brand-muted">
                          <Wrench size={11} className="shrink-0" />
                          <span className="line-clamp-1">{a.servico}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-brand-muted">
                          <Bike size={11} className="shrink-0" />
                          <span>{a.motoModelo}</span>
                        </div>
                        {a.notas && (
                          <p className="text-xs text-brand-muted italic border-l-2 border-brand-accent pl-2">{a.notas}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <Select
                            value={a.status}
                            disabled={loadingId === a.id}
                            onChange={(e) => alterarStatus(a.id, e.target.value)}
                            className="flex-1 py-1.5 text-xs"
                          >
                            {Object.entries(STATUS_AGENDAMENTO).map(([k, def]) => (
                              <option key={k} value={k}>{def.label}</option>
                            ))}
                          </Select>
                          <a
                            href={whatsappLink(tel, whatsMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-brand-success text-brand-on-accent hover:brightness-95 rounded-lg transition-colors"
                            title="Abrir WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </a>
                          <button
                            onClick={() => excluir(a.id)}
                            disabled={loadingId === a.id}
                            className="p-1.5 bg-brand-danger-soft hover:brightness-95 border border-brand-danger rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={14} className="text-brand-danger" />
                          </button>
                        </div>
                        {/* Reserva de estoque (assessoria) */}
                        <ReservaAgendamento appointmentId={a.id} />
                      </div>
                    )
                  })}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Modal Novo Agendamento */}
      <Modal
        aberto={showNovo}
        aoFechar={() => setShowNovo(false)}
        titulo="Novo Agendamento"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setShowNovo(false)}>
              Cancelar
            </Botao>
            <Botao onClick={criarAgendamento} disabled={loadingId === 'novo'}>
              {loadingId === 'novo' ? 'Salvando…' : 'Salvar'}
            </Botao>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome" obrigatorio>
              <Input
                value={novoForm.nome}
                onChange={e => setNovoForm(f => ({ ...f, nome: e.target.value }))}
              />
            </Campo>
            <Campo label="Telefone" obrigatorio>
              <Input
                value={novoForm.telefone}
                onChange={e => setNovoForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(19) 99999-9999"
              />
            </Campo>
          </div>
          <Campo label="Serviço" obrigatorio>
            <Select
              value={novoForm.servico}
              onChange={e => setNovoForm(f => ({ ...f, servico: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {SERVICOS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Campo>
          <Campo label="Modelo da moto" obrigatorio>
            <Input
              value={novoForm.motoModelo}
              onChange={e => setNovoForm(f => ({ ...f, motoModelo: e.target.value }))}
              placeholder="Ex: Honda CB 300R 2023"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Data" obrigatorio>
              <Input
                type="date"
                value={novoForm.dataPreferida}
                onChange={e => setNovoForm(f => ({ ...f, dataPreferida: e.target.value }))}
              />
            </Campo>
            <Campo label="Horário" obrigatorio>
              <Select
                value={novoForm.horarioPreferido}
                onChange={e => setNovoForm(f => ({ ...f, horarioPreferido: e.target.value }))}
              >
                <option value="">Selecione...</option>
                {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Campo>
          </div>
          <Campo label="Status">
            <Select
              value={novoForm.status}
              onChange={e => setNovoForm(f => ({ ...f, status: e.target.value }))}
            >
              {Object.entries(STATUS_AGENDAMENTO).map(([k, def]) => (
                <option key={k} value={k}>{def.label}</option>
              ))}
            </Select>
          </Campo>
          <Campo label="Observações">
            <Textarea
              value={novoForm.notas}
              onChange={e => setNovoForm(f => ({ ...f, notas: e.target.value }))}
              rows={2}
            />
          </Campo>
        </div>
      </Modal>
    </div>
  )
}
