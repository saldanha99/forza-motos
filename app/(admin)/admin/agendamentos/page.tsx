export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CalendarDays, KanbanSquare, Rows3 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn, formatDate } from '@/lib/utils'
import {
  PageHeader, StatusPill, Tabela, EmptyState,
  THEAD_TH, TR_LINHA, TD_CELULA,
} from '@/components/admin/ui/primitives'
import { AgendamentosKanban, type AgendamentoKanban } from '@/components/admin/kanban/AgendamentosKanban'
import { AgendaCalendario } from '@/components/admin/AgendaCalendario'

export const metadata = { title: 'Agendamentos — Forza Admin' }

/** Fora do quadro só entra o que ainda pode virar trabalho — o histórico mais antigo some. */
const JANELA_DIAS = 30

function AlternadorVista({ vista }: { vista: 'quadro' | 'agenda' | 'lista' }) {
  const opcoes = [
    { id: 'quadro', label: 'Quadro', icone: KanbanSquare },
    { id: 'agenda', label: 'Agenda', icone: CalendarDays },
    { id: 'lista',  label: 'Lista',  icone: Rows3 },
  ] as const

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-brand-border bg-brand-surface-2 p-0.5">
      {opcoes.map((o) => (
        <Link
          key={o.id}
          href={`/admin/agendamentos?vista=${o.id}`}
          aria-current={vista === o.id ? 'page' : undefined}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
            vista === o.id
              ? 'bg-brand-accent text-brand-on-accent shadow-cta'
              : 'text-brand-muted hover:text-brand-text',
          )}
        >
          <o.icone size={13} />
          {o.label}
        </Link>
      ))}
    </div>
  )
}

function diaISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function AgendamentosAdminPage({
  searchParams,
}: {
  searchParams: { vista?: string }
}) {
  const vista = searchParams.vista === 'agenda' ? 'agenda' : searchParams.vista === 'lista' ? 'lista' : 'quadro'

  /* ── Agenda (calendário) — comportamento inalterado ──────────────── */
  if (vista === 'agenda') {
    const agendamentos = await prisma.appointment.findMany({
      orderBy: { dataPreferida: 'asc' },
      take: 200,
    })

    const agendamentosSerial = agendamentos.map((a) => ({
      id: a.id,
      nome: a.nome,
      telefone: a.telefone,
      servico: a.servico,
      motoModelo: a.motoModelo,
      dataPreferida: a.dataPreferida.toISOString(),
      horarioPreferido: a.horarioPreferido,
      status: a.status,
      notas: a.notas,
    }))

    return (
      <div>
        <PageHeader
          titulo="Agendamentos"
          descricao="Visão em calendário — clique num dia para ver, criar ou alterar os agendamentos."
          acoes={<AlternadorVista vista="agenda" />}
        />
        <AgendaCalendario agendamentos={agendamentosSerial} />
      </div>
    )
  }

  /* ── Quadro e Lista compartilham a mesma janela de dados ─────────── */
  const hoje = new Date()
  const hojeISO = diaISO(hoje)
  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000)

  const agendamentos = await prisma.appointment.findMany({
    where: { dataPreferida: { gte: desde } },
    orderBy: { dataPreferida: 'asc' },
    take: 300,
  })

  if (vista === 'quadro') {
    const itens: AgendamentoKanban[] = agendamentos.map((a) => {
      const dataISO = diaISO(a.dataPreferida)
      return {
        id: a.id,
        coluna: a.status,
        rotulo: `Agendamento de ${a.nome}`,
        nome: a.nome,
        telefone: a.telefone,
        servico: a.servico,
        motoModelo: a.motoModelo,
        dataPreferida: a.dataPreferida.toISOString(),
        horarioPreferido: a.horarioPreferido,
        atrasado: dataISO < hojeISO,
        hoje: dataISO === hojeISO,
      }
    })

    return (
      <div>
        <PageHeader
          titulo="Agendamentos"
          descricao="Arraste o card pela alça para mudar a etapa. No celular, use “Mover para…”."
          acoes={<AlternadorVista vista="quadro" />}
        />

        {itens.length === 0 ? (
          <EmptyState
            titulo="Nenhum agendamento no período"
            descricao="Quando alguém marcar um horário pelo site, o agendamento aparece aqui na primeira coluna."
          />
        ) : (
          <AgendamentosKanban agendamentos={itens} />
        )}
      </div>
    )
  }

  /* ── Lista ────────────────────────────────────────────────────── */
  return (
    <div>
      <PageHeader
        titulo="Agendamentos"
        descricao="Histórico dos últimos 30 dias em diante, em ordem cronológica."
        acoes={<AlternadorVista vista="lista" />}
      />

      {agendamentos.length === 0 ? (
        <EmptyState
          titulo="Nenhum agendamento no período"
          descricao="Quando alguém marcar um horário pelo site, o agendamento aparece aqui."
        />
      ) : (
        <Tabela
          cabecalho={
            <>
              <th className={THEAD_TH}>Cliente</th>
              <th className={THEAD_TH}>Serviço</th>
              <th className={THEAD_TH}>Moto</th>
              <th className={THEAD_TH}>Data</th>
              <th className={THEAD_TH}>Horário</th>
              <th className={THEAD_TH}>Etapa</th>
            </>
          }
          rodape={<span>{agendamentos.length} agendamento(s)</span>}
        >
          {agendamentos.map((a) => (
            <tr key={a.id} className={TR_LINHA}>
              <td className={TD_CELULA}>
                <div className="text-brand-text">{a.nome}</div>
                <div className="text-xs text-brand-dim">{a.telefone}</div>
              </td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>{a.servico}</td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>{a.motoModelo}</td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>{formatDate(a.dataPreferida)}</td>
              <td className={cn(TD_CELULA, 'tabular-nums text-brand-muted')}>{a.horarioPreferido}</td>
              <td className={TD_CELULA}>
                <StatusPill status={a.status} />
              </td>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  )
}
