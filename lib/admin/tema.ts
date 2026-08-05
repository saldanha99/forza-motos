import { cookies } from 'next/headers'

export type TemaAdmin = 'dark' | 'light'

/** Cookie lido no server para renderizar o painel já no tema certo (sem flash). */
export const COOKIE_TEMA_ADMIN = 'forza_admin_tema'

/** Escuro é o padrão — é a identidade que o painel já tinha. */
export const TEMA_ADMIN_PADRAO: TemaAdmin = 'dark'

export function lerTemaAdmin(): TemaAdmin {
  const valor = cookies().get(COOKIE_TEMA_ADMIN)?.value
  return valor === 'light' || valor === 'dark' ? valor : TEMA_ADMIN_PADRAO
}
