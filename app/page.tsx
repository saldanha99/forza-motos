// Redireciona raiz para a home da loja
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/')
}
