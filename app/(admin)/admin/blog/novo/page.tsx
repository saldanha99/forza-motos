import { BlogForm } from '@/components/admin/BlogForm'

export const metadata = { title: 'Novo Post — Forza Admin' }

export default function NovoBlogPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight mb-8">Novo Post</h1>
      <BlogForm />
    </div>
  )
}
