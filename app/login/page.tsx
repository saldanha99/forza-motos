import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <LoginForm />
    </Suspense>
  )
}
