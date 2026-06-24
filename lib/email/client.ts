import { Resend } from 'resend'

// Instância lazy — não instancia no module-level para evitar erro de build
// quando RESEND_API_KEY não está disponível no ambiente de compilação
let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
  }
  return _resend
}

export const EMAIL_FROM = () =>
  process.env.EMAIL_FROM ?? 'Forza Motos <contato@forzamotos.com.br>'
