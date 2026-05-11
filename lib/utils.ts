import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(value: number | string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value))
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function gerarSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function gerarOrderNumber(sequencia: number, ano = new Date().getFullYear()) {
  return `FM-${ano}-${String(sequencia).padStart(4, '0')}`
}

export function mascaraCEP(cep: string) {
  return cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2')
}

export function mascaraTelefone(tel: string) {
  const nums = tel.replace(/\D/g, '')
  if (nums.length === 11) return nums.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  return nums.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}

export function whatsappLink(numero: string, mensagem: string) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}

export function mascaraEndereco(endereco: string) {
  const partes = endereco.split(',')
  if (partes.length < 2) return `${endereco.slice(0, 10)}...`
  return `${partes[0]}, ${partes[1].trim().replace(/\d/g, '*')}`
}
