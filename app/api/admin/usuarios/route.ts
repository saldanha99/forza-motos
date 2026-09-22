/**
 * GET  /api/admin/usuarios — usuários com acesso ao painel
 * POST /api/admin/usuarios — cria um usuário do painel
 *
 * Só quem tem a área "usuarios" (hoje, só ADMIN) mexe aqui: é a tela que
 * distribui acesso, então ela não pode ser delegável por engano.
 *
 * A senha é digitada por quem cria e sai daqui já como hash bcrypt — nenhuma
 * rota devolve senha, nem em texto nem em hash.
 */
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { exigirAcesso } from '@/lib/admin/acesso'
import { ehChaveArea, permissoesEfetivas, AREAS_CONCEDIVEIS } from '@/lib/admin/permissoes'

export const dynamic = 'force-dynamic'

const PAPEIS_PAINEL = ['ADMIN', 'MARKETING'] as const
const SENHA_MINIMA = 8

const CAMPOS_PUBLICOS = {
  id: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  permissoes: true,
  createdAt: true,
} as const

export async function GET() {
  if (!(await exigirAcesso('usuarios'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const usuarios = await prisma.user.findMany({
    where: { role: { in: [...PAPEIS_PAINEL] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: CAMPOS_PUBLICOS,
  })

  return NextResponse.json(
    usuarios.map((u) => ({
      ...u,
      permissoes: permissoesEfetivas(u.role, u.permissoes),
      permissoesSalvas: Array.isArray(u.permissoes) ? u.permissoes : [],
    })),
  )
}

export async function POST(req: Request) {
  if (!(await exigirAcesso('usuarios'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const nome = String(body.nome ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const senha = String(body.senha ?? '')
  const role = PAPEIS_PAINEL.includes(body.role) ? (body.role as 'ADMIN' | 'MARKETING') : 'MARKETING'

  if (!nome) return NextResponse.json({ error: 'Informe o nome.' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }
  if (senha.length < SENHA_MINIMA) {
    return NextResponse.json(
      { error: `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.` },
      { status: 400 },
    )
  }

  const existente = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existente) {
    return NextResponse.json({ error: 'Já existe um usuário com esse e-mail.' }, { status: 409 })
  }

  // Permissão só faz sentido para quem não é ADMIN — o ADMIN enxerga tudo.
  const permissoes =
    role === 'ADMIN'
      ? []
      : (Array.isArray(body.permissoes) ? body.permissoes : [])
          .filter(ehChaveArea)
          .filter((c: string) => AREAS_CONCEDIVEIS.some((a) => a.chave === c))

  const usuario = await prisma.user.create({
    data: {
      nome,
      email,
      senha: await bcrypt.hash(senha, 12),
      role,
      origem: 'MANUAL',
      permissoes,
      ativo: body.ativo !== false,
    },
    select: CAMPOS_PUBLICOS,
  })

  return NextResponse.json(
    {
      ...usuario,
      permissoes: permissoesEfetivas(usuario.role, usuario.permissoes),
      permissoesSalvas: permissoes,
    },
    { status: 201 },
  )
}
