import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { usuarioDoPainel } from '@/lib/admin/acesso'
import { lerTemaAdmin } from '@/lib/admin/tema'
import { AdminThemeProvider } from '@/components/admin/ui/AdminTheme'
import { AdminSidebar, type BadgesNav } from '@/components/admin/AdminSidebar'
import { AdminTopbar } from '@/components/admin/AdminTopbar'
import { CommandPalette } from '@/components/admin/CommandPalette'

export const dynamic = 'force-dynamic'

/**
 * Contadores do menu. A sidebar em si já é um painel de status: dá para ver
 * o que está pendente sem abrir a seção.
 */
async function contarPendencias(): Promise<BadgesNav> {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  try {
    const [pedidos, agendamentos, leads, curadoria] = await Promise.all([
      prisma.order.count({ where: { status: { in: ['CONFIRMADO', 'SEPARANDO'] } } }),
      prisma.appointment.count({ where: { status: 'pendente', dataPreferida: { gte: hoje } } }),
      prisma.crmLead.count({ where: { etapa: { in: ['NOVO', 'RESPONDEU'] } } }),
      prisma.product.count({
        where: { tinyId: { not: null }, ehPai: false, ativo: false, ocultoManual: false, temImagem: true, estoque: { gt: 0 } },
      }),
    ])
    return { pedidos, agendamentos, leads, curadoria }
  } catch {
    // Contador é enfeite: se o banco tossir, o menu continua funcionando
    return {}
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Permissões relidas do banco a cada navegação: tirar acesso de alguém vale
  // na hora, sem depender de a pessoa deslogar.
  const usuario = await usuarioDoPainel()
  if (!usuario) redirect('/login')

  const [tema, badges] = await Promise.all([
    lerTemaAdmin(),
    // Contadores são de pedidos, agenda e CRM: quem não enxerga essas áreas
    // também não precisa da contagem.
    usuario.role === 'ADMIN' ? contarPendencias() : Promise.resolve({} as BadgesNav),
  ])

  return (
    <AdminThemeProvider temaInicial={tema}>
      <div className="flex min-h-screen bg-brand-bg text-brand-text">
        <AdminSidebar user={usuario} badges={badges} permissoes={usuario.permissoes} />

        {/* Busca global ⌘K */}
        <CommandPalette />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar user={usuario} />
          <main className="admin-scroll flex-1 p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </AdminThemeProvider>
  )
}
