import { redirect } from 'next/navigation'

export default async function CheckoutPendentePage(
  props: {
    searchParams: Promise<{ token?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const token = searchParams.token
  const destino = token
    ? `/checkout/sucesso?token=${encodeURIComponent(token)}`
    : '/checkout/sucesso'
  redirect(destino)
}
