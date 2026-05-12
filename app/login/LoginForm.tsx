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
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', senha: '' })

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

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <Link href="/" className="font-grotesk font-bold text-3xl mb-10">
        <span className="text-ink">FORZA</span>
        <span className="text-vermelho"> MOTOS</span>
      </Link>

      <div className="w-full max-w-md bg-card border border-line rounded-xl overflow-hidden shadow-lg">
        <div className="p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <Input label="E-mail" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
            <Input label="Senha" type="password" value={form.senha} onChange={(e) => update('senha', e.target.value)} required />
            <Button type="submit" loading={loading} className="w-full" size="lg">Entrar</Button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-xs text-faint text-center">
        Ao continuar, você concorda com nossos termos de uso.
      </p>
    </div>
  )
}
