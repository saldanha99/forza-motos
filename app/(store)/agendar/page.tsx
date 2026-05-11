'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { whatsappLink } from '@/lib/utils'
import { CheckCircle } from 'lucide-react'

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
  const [sucesso, setSucesso] = useState(false)
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
      setSucesso(true)
    } catch {
      toast.error('Erro ao enviar agendamento. Tente pelo WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  const data = form.dataPreferida ? new Date(form.dataPreferida).toLocaleDateString('pt-BR') : ''
  const whatsMsg = `Olá! Gostaria de agendar:\n\n*Serviço:* ${form.servico}\n*Moto:* ${form.motoModelo}\n*Data:* ${data}\n*Horário:* ${form.horarioPreferido}\n*Nome:* ${form.nome}`

  if (sucesso) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <CheckCircle size={64} className="mx-auto text-green-500 mb-6" />
        <h1 className="font-rajdhani font-bold text-4xl text-white mb-3">Agendamento enviado!</h1>
        <p className="text-zinc-400 mb-8">
          Recebemos seu pedido. Em breve nossa equipe entrará em contato para confirmar.
          Você também pode confirmar agora pelo WhatsApp:
        </p>
        <a
          href={whatsappLink('5519974049445', whatsMsg)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg" className="bg-green-600 hover:bg-green-700">
            Confirmar no WhatsApp
          </Button>
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-rajdhani font-bold text-4xl text-white mb-2 uppercase tracking-wide">
        Agendar Serviço
      </h1>
      <p className="text-zinc-500 mb-8">
        Preencha o formulário e nossa equipe confirmará seu agendamento via WhatsApp.
      </p>

      <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Seu nome *" value={form.nome} onChange={(e) => update('nome', e.target.value)} />
          <Input label="Telefone / WhatsApp *" value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(19) 99999-9999" />
        </div>

        <div>
          <label className="text-sm text-zinc-400 font-medium block mb-1">Serviço desejado *</label>
          <select
            value={form.servico}
            onChange={(e) => update('servico', e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-vermelho"
          >
            <option value="">Selecione...</option>
            {SERVICOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <Input label="Modelo da moto *" value={form.motoModelo} onChange={(e) => update('motoModelo', e.target.value)} placeholder="Ex: Honda CB 300R 2023" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Data preferida *" type="date" value={form.dataPreferida} onChange={(e) => update('dataPreferida', e.target.value)} min={new Date().toISOString().split('T')[0]} />
          <div>
            <label className="text-sm text-zinc-400 font-medium block mb-1">Horário preferido *</label>
            <select
              value={form.horarioPreferido}
              onChange={(e) => update('horarioPreferido', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-vermelho"
            >
              <option value="">Selecione...</option>
              {HORARIOS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-zinc-400 font-medium block mb-1">Observações</label>
          <textarea
            value={form.notas}
            onChange={(e) => update('notas', e.target.value)}
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-vermelho resize-none"
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
