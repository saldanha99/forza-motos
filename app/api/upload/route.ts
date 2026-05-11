import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const ext = file.name.split('.').pop()
  const filename = `produtos/${Date.now()}.${ext}`

  const blob = await put(filename, file, { access: 'public' })

  return NextResponse.json({ url: blob.url })
}
