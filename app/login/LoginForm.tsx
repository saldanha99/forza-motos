'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'
import toast from 'react-hot-toast'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/'
  const [tab, setTab] = useState<'login' | 'cadastro'>('login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmar: '' })

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const result = await signIn('credentials', {
      email: form.email,
      senha: form.senha,
      redirect: false,
    })
    setLoading(false)

    if (result?.error) {
      toast.error('E-mail ou senha incorretos')
    } else {
      router.push(callbackUrl)
    }
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    if (form.senha !== form.confirmar) {
      toast.error('As senhas não coincidem')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.nome, email: form.email, senha: form.senha }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      await signIn('credentials', { email: form.email, senha: form.senha, redirect: false })
      router.push(callbackUrl)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <Link href="/" className="font-rajdhani font-bold text-3xl mb-10">
        <span className="text-white">FORZA</span>
        <span className="text-vermelho"> MOTOS</span>
      </Link>

      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex border-b border-zinc-800">
          {(['login', 'cadastro'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'text-white border-b-2 border-vermelho' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input label="E-mail" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
              <Input label="Senha" type="password" value={form.senha} onChange={(e) => update('senha', e.target.value)} required />
              <Button type="submit" loading={loading} className="w-full" size="lg">Entrar</Button>
            </form>
          ) : (
            <form onSubmit={handleCadastro} className="space-y-4">
              <Input label="Nome" value={form.nome} onChange={(e) => update('nome', e.target.value)} required />
              <Input label="E-mail" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
              <Input label="Senha" type="password" value={form.senha} onChange={(e) => update('senha', e.target.value)} required />
              <Input label="Confirmar senha" type="password" value={form.confirmar} onChange={(e) => update('confirmar', e.target.value)} required />
              <Button type="submit" loading={loading} className="w-full" size="lg">Criar conta</Button>
            </form>
          )}

          <div className="mt-4 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-zinc-900 px-3 text-xs text-zinc-600">ou</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => signIn('google', { callbackUrl })}
          >
            Continuar com Google
          </Button>
        </div>
      </div>
    </div>
  )
}
