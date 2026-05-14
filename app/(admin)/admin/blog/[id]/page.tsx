export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { BlogForm } from '@/components/admin/BlogForm'

export default async function EditarBlogPage({ params }: { params: { id: string } }) {
  const post = await prisma.blogPost.findUnique({ where: { id: params.id } })
  if (!post) notFound()
  return (
    <div className="max-w-3xl">
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-8">Editar Post</h1>
      <BlogForm post={post as any} />
    </div>
  )
}
