import { EventoForm } from '@/components/admin/EventoForm'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Novo Evento — Forza Admin' }

export default function NovoEventoPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        titulo="Novo evento"
        descricao="Preencha os dados e marque “Publicar no site” quando estiver pronto para ficar visível na loja."
      />
      <EventoForm />
    </div>
  )
}
