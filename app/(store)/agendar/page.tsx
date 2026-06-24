'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { whatsappLink } from '@/lib/utils'
import { Calendar, Clock, Wrench } from 'lucide-react'

const SERVICOS = [
  'Troca de Pneu Dianteiro',
  'Troca de Pneu Traseiro',
  'Troca de Pneu (Par)',
  'Troca de Pastilha de Freio',
  'Troca de Óleo',
  'Kit de Transmissão (corrente + coroa + pinhão)',
  'Revisão Completa',
  'Outro serviço',
]

const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']

export default function AgendarPage() {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    servico: '',
    motoModelo: '',
    dataPreferida: '',
    horarioPreferido: '',
    notas: '',
  })

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.telefone || !form.servico || !form.motoModelo || !form.dataPreferida || !form.horarioPreferido) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()

      // Abre WhatsApp do admin direto com mensagem pré-pronta
      const dataFmt = new Date(form.dataPreferida + 'T00:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      })
      const msg = `Olá! Vi vocês no site e gostaria de agendar um serviço:\n\n*Serviço:* ${form.servico}\n*Moto:* ${form.motoModelo}\n*Data preferida:* ${dataFmt}\n*Horário:* ${form.horarioPreferido}\n*Nome:* ${form.nome}${form.notas ? `\n*Obs:* ${form.notas}` : ''}`
      window.location.href = whatsappLink('5519974049445', msg)
    } catch {
      toast.error('Erro ao enviar agendamento. Tente pelo WhatsApp.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-grotesk font-bold text-4xl text-ink mb-2">
          Agendar Serviço
        </h1>
        <p className="text-dim">
          Preencha o formulário e nossa equipe confirmará seu agendamento via WhatsApp.
        </p>
      </div>

      {/* Cards de info */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: Clock, label: 'Seg–Sex', sub: '8h às 18h' },
          { icon: Calendar, label: 'Sábado', sub: '8h às 13h' },
          { icon: Wrench, label: 'Box rápido', sub: 'Sem fila' },
        ].map((item) => (
          <div key={item.label} className="bg-card border border-line rounded-xl p-4 text-center">
            <item.icon size={20} className="text-vermelho mx-auto mb-2" />
            <p className="font-medium text-sm text-ink">{item.label}</p>
            <p className="text-xs text-faint">{item.sub}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-line rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Seu nome *" value={form.nome} onChange={(e) => update('nome', e.target.value)} />
          <Input label="Telefone / WhatsApp *" value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(19) 99999-9999" />
        </div>

        <div>
          <label className="text-sm text-dim font-medium block mb-1.5">Serviço desejado *</label>
          <select
            value={form.servico}
            onChange={(e) => update('servico', e.target.value)}
            className="w-full bg-card border border-line rounded-md px-3 py-2.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-vermelho/30 focus:border-vermelho transition-colors"
          >
            <option value="">Selecione o serviço...</option>
            {SERVICOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <Input label="Modelo da moto *" value={form.motoModelo} onChange={(e) => update('motoModelo', e.target.value)} placeholder="Ex: Honda CB 300R 2023" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Data preferida *"
            type="date"
            value={form.dataPreferida}
            onChange={(e) => update('dataPreferida', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          <div>
            <label className="text-sm text-dim font-medium block mb-1.5">Horário preferido *</label>
            <select
              value={form.horarioPreferido}
              onChange={(e) => update('horarioPreferido', e.target.value)}
              className="w-full bg-card border border-line rounded-md px-3 py-2.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-vermelho/30 focus:border-vermelho transition-colors"
            >
              <option value="">Selecione...</option>
              {HORARIOS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-dim font-medium block mb-1.5">Observações</label>
          <textarea
            value={form.notas}
            onChange={(e) => update('notas', e.target.value)}
            rows={3}
            className="w-full bg-card border border-line rounded-md px-3 py-2.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-vermelho/30 focus:border-vermelho resize-none transition-colors placeholder-faint"
            placeholder="Alguma informação adicional..."
          />
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Enviar Agendamento
        </Button>
      </form>
    </div>
  )
}
