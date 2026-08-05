export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { BlogForm } from '@/components/admin/BlogForm'
import { PageHeader } from '@/components/admin/ui/primitives'

export default async function EditarBlogPage({ params }: { params: { id: string } }) {
  const post = await prisma.blogPost.findUnique({ where: { id: params.id } })
  if (!post) notFound()

  return (
    <div className="max-w-3xl">
      <PageHeader
        titulo="Editar Post"
        descricao="Altere o conteúdo e salve para atualizar o post publicado."
      />
      <BlogForm post={post as any} />
    </div>
  )
}
