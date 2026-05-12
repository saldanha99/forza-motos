'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  nome?: string | null
  telefone?: string | null
  cpf?: string | null
}

export function ProfileEditForm({ nome: initialNome, telefone: initialTelefone, cpf: initialCpf }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [nome, setNome] = useState(initialNome ?? '')
  const [telefone, setTelefone] = useState(initialTelefone ?? '')
  const [cpf, setCpf] = useState(initialCpf ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone, cpf }),
      })
      if (!res.ok) throw new Error()
      toast.success('Dados atualizados!')
      setOpen(false)
    } catch {
      toast.error('Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-inter text-[#d42b2b] hover:text-[#b82222] mt-4 transition-colors"
      >
        Editar dados →
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      {[
        { label: 'Nome', value: nome, set: setNome, placeholder: 'Seu nome completo' },
        { label: 'Telefone', value: telefone, set: setTelefone, placeholder: '(19) 99999-0000' },
        { label: 'CPF', value: cpf, set: setCpf, placeholder: '000.000.000-00' },
      ].map(({ label, value, set, placeholder }) => (
        <div key={label}>
          <label className="text-[11px] font-inter text-[#888] block mb-0.5">{label}</label>
          <input
            value={value}
            onChange={(e) => set(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-[#eee] rounded-[4px] px-3 py-2 text-[13px] font-inter text-[#111] outline-none focus:border-[#d42b2b] transition-colors bg-white"
          />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 font-barlow font-bold text-[14px] uppercase tracking-[0.3px] text-white py-2 transition-colors disabled:opacity-50"
          style={{ background: '#d42b2b', borderRadius: 3 }}
        >
          {loading ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 text-[13px] font-inter text-[#888] hover:text-[#111] border border-[#eee] rounded-[4px] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
