import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { CommandPalette } from '@/components/admin/CommandPalette'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#120505] relative overflow-hidden text-brand-text">
      {/* Premium ambient glows */}
      <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-200px] right-[-200px] w-[700px] h-[700px] rounded-full bg-brand-accent/3 blur-[150px] pointer-events-none z-0" />
      <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-brand-accent/[0.02] blur-[100px] pointer-events-none z-0" />

      {/* Sidebar */}
      <AdminSidebar user={session.user} />

      {/* Busca global ⌘K */}
      <CommandPalette />

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-auto pb-24 lg:pb-8 relative z-10">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
