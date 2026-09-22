/**
 * Guarda de acesso do lado do servidor — a checagem que vale.
 *
 * O papel e as permissões vêm do banco a cada chamada, e não do token: assim,
 * tirar uma permissão de alguém tem efeito imediato, sem esperar a pessoa
 * deslogar. É uma consulta por id em tabela pequena.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  permissoesEfetivas,
  type ChaveArea,
} from '@/lib/admin/permissoes'

export interface UsuarioPainel {
  id: string
  nome: string | null
  email: string
  role: string
  permissoes: ChaveArea[]
}

/** Usuário logado com as permissões atuais, ou null se não houver acesso. */
export async function usuarioDoPainel(): Promise<UsuarioPainel | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const user = await prisma.user
    .findUnique({
      where: { id: session.user.id },
      select: { id: true, nome: true, email: true, role: true, ativo: true, permissoes: true },
    })
    .catch(() => null)

  if (!user || !user.ativo) return null
  if (user.role === 'CUSTOMER') return null

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    permissoes: permissoesEfetivas(user.role, user.permissoes),
  }
}

/** True quando o usuário logado pode mexer na área. */
export async function podeAcessar(area: ChaveArea): Promise<boolean> {
  const user = await usuarioDoPainel()
  return Boolean(user?.permissoes.includes(area))
}

/**
 * Versão para rotas de API: devolve o usuário ou null. O chamador responde
 * 401/403 — cada rota já tem a sua mensagem.
 */
export async function exigirAcesso(area: ChaveArea): Promise<UsuarioPainel | null> {
  const user = await usuarioDoPainel()
  if (!user || !user.permissoes.includes(area)) return null
  return user
}
