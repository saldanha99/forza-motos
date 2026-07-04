import { redirect } from 'next/navigation'

/** /eventos → /calendario (a listagem oficial de eventos). Mantém /eventos/[slug] funcionando. */
export default function EventosPage() {
  redirect('/calendario')
}
