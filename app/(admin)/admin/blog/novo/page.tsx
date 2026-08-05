import { BlogForm } from '@/components/admin/BlogForm'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Novo Post — Forza Admin' }

export default function NovoBlogPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        titulo="Novo Post"
        descricao="Preencha o conteúdo e publique quando estiver pronto."
      />
      <BlogForm />
    </div>
  )
}
