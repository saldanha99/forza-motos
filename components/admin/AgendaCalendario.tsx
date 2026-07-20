'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Plus, X, MessageCircle, Trash2, Clock, Bike, Wrench } from 'lucide-react'
import { whatsappLink } from '@/lib/utils'

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

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const STATUS_COLORS: Record<string, string> = {
  pendente: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  confirmado: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  concluido: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  cancelado: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const DOT_COLORS: Record<string, string> = {
  pendente: 'bg-yellow-400',
  confirmado: 'bg-blue-400',
  concluido: 'bg-emerald-400',
  cancelado: 'bg-red-400',
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
          <button onClick={() => navMes(-1)} className="p-2 rounded-xl border border-brand-border/30 text-brand-muted hover:text-brand-text hover:border-brand-accent/40 transition-all">
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-barlow font-bold text-xl text-brand-text min-w-[160px] text-center">
            {MESES[mes]} {ano}
          </h2>
          <button onClick={() => navMes(1)} className="p-2 rounded-xl border border-brand-border/30 text-brand-muted hover:text-brand-text hover:border-brand-accent/40 transition-all">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => { setAno(hoje.getFullYear()); setMes(hoje.getMonth()) }}
            className="text-xs text-brand-muted border border-brand-border/30 px-3 py-1.5 rounded-lg hover:border-brand-accent/40 transition-all ml-1"
          >
            Hoje
          </button>
        </div>
        <button
          onClick={() => setShowNovo(true)}
          className="flex items-center gap-2 bg-brand-accent hover:bg-brand-accent/80 text-white text-sm px-4 py-2 rounded-xl font-semibold transition-all shadow-lg shadow-brand-accent/20"
        >
          <Plus size={16} />
          Novo Agendamento
        </button>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(STATUS_LABELS).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-brand-muted">
            <span className={`w-2.5 h-2.5 rounded-full ${DOT_COLORS[k]}`} />
            {label}
          </div>
        ))}
      </div>

      <div className="flex gap-4 flex-col xl:flex-row">
        {/* Calendário */}
        <div className="flex-1 admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-4 shadow-xl">
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
                  className={[
                    'relative flex flex-col items-center rounded-xl py-2 px-1 min-h-[56px] transition-all duration-150',
                    selecionado
                      ? 'bg-brand-accent/20 border border-brand-accent/50 text-brand-text'
                      : ehHoje
                        ? 'bg-white/5 border border-brand-accent/20 text-brand-accent font-bold'
                        : 'border border-transparent hover:bg-white/5 hover:border-brand-border/30 text-brand-text',
                  ].join(' ')}
                >
                  <span className="text-sm font-medium">{dia}</span>
                  {eventos.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[40px]">
                      {eventos.slice(0, 4).map((a, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[a.status] || 'bg-gray-400'}`} />
                      ))}
                      {eventos.length > 4 && (
                        <span className="text-[9px] text-brand-muted">+{eventos.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Painel lateral do dia */}
        {diaAberto && (
          <div className="xl:w-[380px] admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-5 shadow-xl">
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
              <div className="text-center py-8 text-brand-muted text-sm">
                <p>Nenhum agendamento neste dia.</p>
                <button onClick={() => { setNovoForm(f => ({ ...f, dataPreferida: diaAberto })); setShowNovo(true) }}
                  className="mt-3 text-brand-accent hover:underline text-sm font-medium">
                  + Criar agendamento
                </button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 -mr-1">
                {diaAbertoAgendamentos
                  .sort((a, b) => a.horarioPreferido.localeCompare(b.horarioPreferido))
                  .map(a => {
                    const tel = a.telefone.replace(/\D/g, '')
                    const whatsMsg = `Olá ${a.nome}! Confirmamos seu agendamento para ${a.servico} às ${a.horarioPreferido}. Forza Motos.`
                    return (
                      <div key={a.id} className="bg-white/5 border border-brand-border/20 rounded-xl p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-brand-text text-sm">{a.nome}</p>
                            <p className="text-xs text-brand-muted">{a.telefone}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[a.status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
                            {STATUS_LABELS[a.status] || a.status}
                          </span>
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
                          <p className="text-xs text-brand-muted italic border-l-2 border-brand-accent/30 pl-2">{a.notas}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <select
                            value={a.status}
                            disabled={loadingId === a.id}
                            onChange={(e) => alterarStatus(a.id, e.target.value)}
                            className="flex-1 bg-brand-surface-2 border border-brand-border text-brand-text text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-accent transition-colors"
                          >
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                          <a
                            href={whatsappLink(tel, whatsMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-600/80 hover:bg-emerald-600 rounded-lg transition-colors"
                            title="Abrir WhatsApp"
                          >
                            <MessageCircle size={14} className="text-white" />
                          </a>
                          <button
                            onClick={() => excluir(a.id)}
                            disabled={loadingId === a.id}
                            className="p-1.5 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Novo Agendamento */}
      {showNovo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="admin-glass !bg-[#0e0e0e] border border-brand-border/40 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-barlow font-bold text-brand-text text-lg">Novo Agendamento</h3>
              <button onClick={() => setShowNovo(false)} className="text-brand-muted hover:text-brand-text transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted block mb-1">Nome *</label>
                  <input
                    value={novoForm.nome}
                    onChange={e => setNovoForm(f => ({ ...f, nome: e.target.value }))}
                    className="w-full bg-black/30 border border-brand-border/30 rounded-lg px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-brand-muted block mb-1">Telefone *</label>
                  <input
                    value={novoForm.telefone}
                    onChange={e => setNovoForm(f => ({ ...f, telefone: e.target.value }))}
                    placeholder="(19) 99999-9999"
                    className="w-full bg-black/30 border border-brand-border/30 rounded-lg px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-muted block mb-1">Serviço *</label>
                <select
                  value={novoForm.servico}
                  onChange={e => setNovoForm(f => ({ ...f, servico: e.target.value }))}
                  className="w-full bg-black/30 border border-brand-border/30 rounded-lg px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-colors"
                >
                  <option value="">Selecione...</option>
                  {SERVICOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-brand-muted block mb-1">Modelo da moto *</label>
                <input
                  value={novoForm.motoModelo}
                  onChange={e => setNovoForm(f => ({ ...f, motoModelo: e.target.value }))}
                  placeholder="Ex: Honda CB 300R 2023"
                  className="w-full bg-black/30 border border-brand-border/30 rounded-lg px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted block mb-1">Data *</label>
                  <input
                    type="date"
                    value={novoForm.dataPreferida}
                    onChange={e => setNovoForm(f => ({ ...f, dataPreferida: e.target.value }))}
                    className="w-full bg-black/30 border border-brand-border/30 rounded-lg px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-brand-muted block mb-1">Horário *</label>
                  <select
                    value={novoForm.horarioPreferido}
                    onChange={e => setNovoForm(f => ({ ...f, horarioPreferido: e.target.value }))}
                    className="w-full bg-black/30 border border-brand-border/30 rounded-lg px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-colors"
                  >
                    <option value="">Selecione...</option>
                    {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-muted block mb-1">Status</label>
                <select
                  value={novoForm.status}
                  onChange={e => setNovoForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-black/30 border border-brand-border/30 rounded-lg px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-colors"
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-brand-muted block mb-1">Observações</label>
                <textarea
                  value={novoForm.notas}
                  onChange={e => setNovoForm(f => ({ ...f, notas: e.target.value }))}
                  rows={2}
                  className="w-full bg-black/30 border border-brand-border/30 rounded-lg px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent resize-none transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowNovo(false)}
                  className="flex-1 border border-brand-border/30 text-brand-muted hover:text-brand-text py-2.5 rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={criarAgendamento}
                  disabled={loadingId === 'novo'}
                  className="flex-1 bg-brand-accent hover:bg-brand-accent/80 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  {loadingId === 'novo' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
