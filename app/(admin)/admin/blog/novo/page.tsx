import { BlogForm } from '@/components/admin/BlogForm'

export const metadata = { title: 'Novo Post' }

export default function NovoBlogPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-8">Novo Post</h1>
      <BlogForm />
    </div>
  )
}
