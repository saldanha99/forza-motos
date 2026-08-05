import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  const [tema, badges] = await Promise.all([
    Promise.resolve(lerTemaAdmin()),
    contarPendencias(),
  ])

  return (
    <AdminThemeProvider temaInicial={tema}>
      <div className="flex min-h-screen bg-brand-bg text-brand-text">
        <AdminSidebar user={session.user} badges={badges} />

        {/* Busca global ⌘K */}
        <CommandPalette />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar user={session.user} />
          <main className="admin-scroll flex-1 p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </AdminThemeProvider>
  )
}
