'use client'

import { Package, Timer } from 'lucide-react'
import { KanbanBoard, type ColunaKanban, type ItemKanban } from './KanbanBoard'
import { Badge } from '@/components/admin/ui/primitives'

export type LeadKanban = ItemKanban & {
  nome: string
  whatsapp: string
  origem: string
  produtoSlug: string | null
  /** Dias desde a última atualização (updatedAt) — calculado no server. */
  diasParado: number
}

/**
 * Colunas na ordem do funil. A leitura de tom segue a mesma regra do resto
 * do painel: danger = exige ação agora, warning/info = em andamento, success
 * = concluído, neutro = encerrado sem desfecho.
 */
export const COLUNAS_LEAD: ColunaKanban[] = [
  {
    id: 'NOVO',
    titulo: 'Novo — contatar',
    tom: 'danger',
    vazio: 'Leads caem aqui assim que alguém preenche o pop-up do site, clica no botão de WhatsApp de um produto ou abandona o carrinho.',
  },
  {
    id: 'CONTATADO',
    titulo: 'Contatado',
    tom: 'warning',
    vazio: 'Arraste um lead novo para cá depois de mandar a primeira mensagem.',
  },
  {
    id: 'RESPONDEU',
    titulo: 'Respondeu',
    tom: 'info',
    vazio: 'Quando o cliente responder no WhatsApp, mova o lead para cá.',
  },
  {
    id: 'CONVERTIDO',
    titulo: 'Convertido',
    tom: 'success',
    vazio: 'Fim da linha: lead que comprou ou fechou um agendamento.',
  },
  {
    id: 'PERDIDO',
    titulo: 'Perdido',
    tom: 'neutro',
    vazio: 'Sem resposta ou sem interesse — arraste para cá para tirar da fila ativa.',
  },
]

/** Etapas em que "parado" é o sinal mais importante da tela. */
const ETAPAS_COM_ALERTA_DE_PARADO = new Set(['NOVO', 'RESPONDEU'])
const DIAS_LIMITE_PARADO = 2

const ORIGEM_LABEL: Record<string, string> = {
  POPUP: 'Pop-up do site',
  WHATSAPP_BTN: 'Botão WhatsApp',
  AGENDAMENTO: 'Formulário de agendamento',
  CHECKOUT: 'Carrinho abandonado',
  MANUAL: 'Cadastro manual',
}

/** whatsapp chega normalizado (DDI 55 + DDD + número, só dígitos). */
function formatarWhatsapp(numero: string) {
  const digitos = numero.replace(/\D/g, '')
  const semDDI = digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos
  if (semDDI.length === 11) return semDDI.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (semDDI.length === 10) return semDDI.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return numero
}

function produtoLegivel(slug: string) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

async function alterarEtapa(id: string, etapa: string) {
  const r = await fetch(`/api/admin/crm/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etapa }),
  })
  if (!r.ok) {
    const { error } = await r.json().catch(() => ({ error: '' }))
    throw new Error(error || 'O servidor recusou a mudança de etapa.')
  }
}

export function LeadsKanban({ leads }: { leads: LeadKanban[] }) {
  return (
    <KanbanBoard<LeadKanban>
      colunas={COLUNAS_LEAD}
      itens={leads}
      onMover={(l, para) => alterarEtapa(l.id, para)}
      renderCard={(l, { overlay }) => {
        const parado =
          ETAPAS_COM_ALERTA_DE_PARADO.has(l.coluna) && l.diasParado > DIAS_LIMITE_PARADO

        return (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-brand-text">{l.nome}</span>
              {parado && (
                <Badge tom="danger" className="shrink-0">
                  <Timer size={10} /> Parado {l.diasParado} d
                </Badge>
              )}
            </div>

            {overlay ? (
              <p className="text-xs text-brand-muted">{formatarWhatsapp(l.whatsapp)}</p>
            ) : (
              <a
                href={`https://wa.me/${l.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-brand-accent hover:underline"
              >
                {formatarWhatsapp(l.whatsapp)}
              </a>
            )}

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-brand-dim">
              <span>{ORIGEM_LABEL[l.origem] ?? l.origem}</span>
              {l.produtoSlug && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <Package size={11} className="shrink-0" />
                    <span className="truncate">{produtoLegivel(l.produtoSlug)}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        )
      }}
    />
  )
}
