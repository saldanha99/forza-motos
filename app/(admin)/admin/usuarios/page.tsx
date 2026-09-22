export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { usuarioDoPainel } from '@/lib/admin/acesso'
import { permissoesEfetivas, type ChaveArea } from '@/lib/admin/permissoes'
import { UsuariosManager, type UsuarioPainel } from '@/components/admin/UsuariosManager'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Usuários e acessos' }

export default async function UsuariosPage() {
  const eu = await usuarioDoPainel()
  // O layout já barra quem não tem a área; esta checagem existe para a página
  // não depender só dele caso alguém a renderize fora do layout do admin.
  if (!eu?.permissoes.includes('usuarios')) redirect('/admin')

  const usuarios = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MARKETING'] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, nome: true, email: true, role: true, ativo: true, permissoes: true },
  })

  const lista: UsuarioPainel[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role as 'ADMIN' | 'MARKETING',
    ativo: u.ativo,
    permissoes: permissoesEfetivas(u.role, u.permissoes),
    permissoesSalvas: (Array.isArray(u.permissoes) ? u.permissoes : []) as ChaveArea[],
  }))

  return (
    <div>
      <PageHeader
        titulo="Usuários e acessos"
        descricao="Quem entra no painel e o que cada um enxerga. Administrador vê tudo; os demais só as áreas marcadas."
      />

      <UsuariosManager usuariosIniciais={lista} meuId={eu.id} />
    </div>
  )
}
