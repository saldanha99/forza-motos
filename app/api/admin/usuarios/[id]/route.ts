/**
 * PATCH  /api/admin/usuarios/[id] — papel, permissões, nome, senha, ativo
 * DELETE /api/admin/usuarios/[id] — remove o usuário do painel
 *
 * Duas travas que existem para o painel não ficar sem dono:
 * 1. ninguém rebaixa, desliga ou apaga a si mesmo;
 * 2. o último ADMIN ativo não pode ser rebaixado, desligado nem apagado.
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

/** Sobraria algum ADMIN ativo depois desta mudança? */
async function continuariaComAdmin(idAlterado: string): Promise<boolean> {
  const outros = await prisma.user.count({
    where: { id: { not: idAlterado }, role: 'ADMIN', ativo: true },
  })
  return outros > 0
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const autor = await exigirAcesso('usuarios')
  if (!autor) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const alvo = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, ativo: true },
  })
  if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: {
    nome?: string
    role?: 'ADMIN' | 'MARKETING'
    permissoes?: string[]
    ativo?: boolean
    senha?: string
  } = {}

  if (typeof body.nome === 'string') {
    const nome = body.nome.trim()
    if (!nome) return NextResponse.json({ error: 'Informe o nome.' }, { status: 400 })
    data.nome = nome
  }

  if (body.role !== undefined) {
    if (!PAPEIS_PAINEL.includes(body.role)) {
      return NextResponse.json({ error: 'Papel inválido.' }, { status: 400 })
    }
    if (body.role !== alvo.role && alvo.id === autor.id) {
      return NextResponse.json({ error: 'Você não pode trocar o próprio papel.' }, { status: 409 })
    }
    if (alvo.role === 'ADMIN' && body.role !== 'ADMIN' && !(await continuariaComAdmin(alvo.id))) {
      return NextResponse.json(
        { error: 'Este é o último administrador ativo. Promova outra pessoa antes.' },
        { status: 409 },
      )
    }
    data.role = body.role
  }

  if (typeof body.ativo === 'boolean' && body.ativo !== alvo.ativo) {
    if (alvo.id === autor.id) {
      return NextResponse.json({ error: 'Você não pode desligar o próprio acesso.' }, { status: 409 })
    }
    if (!body.ativo && alvo.role === 'ADMIN' && !(await continuariaComAdmin(alvo.id))) {
      return NextResponse.json(
        { error: 'Este é o último administrador ativo. Promova outra pessoa antes.' },
        { status: 409 },
      )
    }
    data.ativo = body.ativo
  }

  if (Array.isArray(body.permissoes)) {
    data.permissoes = body.permissoes
      .filter(ehChaveArea)
      .filter((c: string) => AREAS_CONCEDIVEIS.some((a) => a.chave === c))
  }

  if (body.senha !== undefined) {
    const senha = String(body.senha)
    if (senha.length < SENHA_MINIMA) {
      return NextResponse.json(
        { error: `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.` },
        { status: 400 },
      )
    }
    data.senha = await bcrypt.hash(senha, 12)
  }

  // O papel final manda: promover alguém a ADMIN zera a lista, que passa a não
  // significar nada (ADMIN enxerga tudo).
  const papelFinal = data.role ?? alvo.role
  if (papelFinal === 'ADMIN') data.permissoes = []

  const usuario = await prisma.user.update({ where: { id }, data, select: CAMPOS_PUBLICOS })

  return NextResponse.json({
    ...usuario,
    permissoes: permissoesEfetivas(usuario.role, usuario.permissoes),
    permissoesSalvas: Array.isArray(usuario.permissoes) ? usuario.permissoes : [],
  })
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const autor = await exigirAcesso('usuarios')
  if (!autor) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const alvo = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, _count: { select: { orders: true, appointments: true } } },
  })
  if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  if (alvo.id === autor.id) {
    return NextResponse.json({ error: 'Você não pode apagar o próprio acesso.' }, { status: 409 })
  }
  if (alvo.role === 'ADMIN' && !(await continuariaComAdmin(alvo.id))) {
    return NextResponse.json(
      { error: 'Este é o último administrador ativo. Promova outra pessoa antes.' },
      { status: 409 },
    )
  }

  // Apagar levaria junto pedido e agendamento ligados à pessoa. Nesse caso o
  // caminho é desligar o acesso, que preserva o histórico.
  if (alvo._count.orders > 0 || alvo._count.appointments > 0) {
    return NextResponse.json(
      {
        error:
          'Este usuário tem pedidos ou agendamentos no histórico. Desligue o acesso em vez de apagar.',
      },
      { status: 409 },
    )
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
