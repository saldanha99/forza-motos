export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Plus, Calendar } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import {
  PageHeader, BotaoLink, Badge, EmptyState, Tabela,
  THEAD_TH, TR_LINHA, TD_CELULA,
} from '@/components/admin/ui/primitives'

export const metadata = { title: 'Eventos / Calendário — Forza Admin' }

function formatData(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

export default async function EventosAdminPage() {
  const eventos = await prisma.evento.findMany({
    orderBy: { dataInicio: 'asc' },
  })

  return (
    <div>
      <PageHeader
        titulo="Eventos"
        descricao="Passeios, cursos e encontros exibidos no site — publique um evento para ele ganhar página própria na loja."
        acoes={
          <BotaoLink href="/admin/eventos/novo">
            <Plus size={16} /> Novo evento
          </BotaoLink>
        }
      />

      {eventos.length === 0 ? (
        <EmptyState
          icone={Calendar}
          titulo="Nenhum evento cadastrado"
          descricao="Um evento aparece aqui assim que é criado. Marque “Publicar no site” para ele ficar visível na página pública."
          acao={<BotaoLink href="/admin/eventos/novo">Criar primeiro evento</BotaoLink>}
        />
      ) : (
        <Tabela
          cabecalho={
            <>
              <th className={THEAD_TH}>Evento</th>
              <th className={THEAD_TH}>Categoria</th>
              <th className={THEAD_TH}>Data</th>
              <th className={THEAD_TH}>Local</th>
              <th className={THEAD_TH}>Preço</th>
              <th className={THEAD_TH}>Status</th>
              <th className={THEAD_TH} />
            </>
          }
        >
          {eventos.map((e) => (
            <tr key={e.id} className={TR_LINHA}>
              <td className={cn(TD_CELULA, 'max-w-[200px] truncate font-medium text-brand-text')}>
                {e.titulo}
              </td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>{e.categoria}</td>
              <td className={cn(TD_CELULA, 'whitespace-nowrap text-xs text-brand-muted')}>
                {formatData(e.dataInicio)}
              </td>
              <td className={cn(TD_CELULA, 'max-w-[140px] truncate text-brand-muted')}>{e.local}</td>
              <td className={TD_CELULA}>
                {Number(e.preco) === 0 ? (
                  <Badge tom="success">Gratuito</Badge>
                ) : (
                  <span className="text-brand-muted">{formatPrice(Number(e.preco))}</span>
                )}
              </td>
              <td className={TD_CELULA}>
                {e.publicado ? <Badge tom="success">Publicado</Badge> : <Badge tom="warning">Rascunho</Badge>}
              </td>
              <td className={TD_CELULA}>
                <Link
                  href={`/admin/eventos/${e.id}`}
                  className="text-xs text-brand-dim transition-colors hover:text-brand-accent"
                >
                  Editar →
                </Link>
              </td>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  )
}
