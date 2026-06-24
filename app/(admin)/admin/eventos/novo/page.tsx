import { EventoForm } from '@/components/admin/EventoForm'

export const metadata = { title: 'Novo Evento — Forza Admin' }

export default function NovoEventoPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight mb-8">Novo Evento</h1>
      <EventoForm />
    </div>
  )
}
