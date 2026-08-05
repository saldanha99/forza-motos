import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { enfileirarMensagem } from '@/lib/evolution/queue'
import { normalizarWhatsApp } from '@/lib/evolution/client'

export const LEAD_ORIGENS = ['POPUP', 'WHATSAPP_BTN', 'AGENDAMENTO', 'CHECKOUT', 'MANUAL', 'EVENTO_PIRELLI'] as const
export type LeadOrigemInput = (typeof LEAD_ORIGENS)[number]

type CapturarLeadParams = {
  nome: string
  whatsapp: string
  origem: LeadOrigemInput
  produtoSlug?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  /** Momento do opt-in de marketing; omitido/undefined não altera um valor já gravado. */
  consentimentoMarketingEm?: Date | null
  enfileirarBoasVindas?: boolean
  /** Permite agendar com segurança testes/integrações; o fluxo normal usa +30 s. */
  boasVindasAgendadaPara?: Date
}

function notaDeToque(origem: LeadOrigemInput, produtoSlug?: string | null) {
  const produto = produtoSlug ? ` (produto: ${produtoSlug})` : ''
  return `[${new Date().toISOString()}] Novo toque via ${origem}${produto}`
}

function isUniqueWhatsappViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === 'P2002' &&
    (e.meta?.target as string[] | undefined)?.includes('whatsapp') === true
  )
}

async function atualizarToque(
  whatsapp: string,
  params: CapturarLeadParams,
  nome: string,
) {
  return prisma.$transaction(async (tx) => {
    // Serializa os toques do mesmo WhatsApp. Sem o lock, duas requisições
    // podem ler as mesmas notas e a última substituição apaga o rastro da outra.
    const chave = `crm-lead-toque:${whatsapp}`
    await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT true AS locked FROM pg_advisory_xact_lock(hashtext(${chave}))
    `

    const existente = await tx.crmLead.findUniqueOrThrow({
      where: { whatsapp },
      select: { id: true, notas: true },
    })
    const notas = [existente.notas, notaDeToque(params.origem, params.produtoSlug)]
      .filter(Boolean)
      .join('\n')
      .slice(-4000)

    const lead = await tx.crmLead.update({
      where: { id: existente.id },
      data: {
        nome: nome || undefined,
        origem: params.origem,
        produtoSlug: params.produtoSlug ?? undefined,
        utmSource: params.utmSource ?? undefined,
        utmMedium: params.utmMedium ?? undefined,
        utmCampaign: params.utmCampaign ?? undefined,
        consentimentoMarketingEm: params.consentimentoMarketingEm !== undefined ? params.consentimentoMarketingEm : undefined,
        notas,
      },
    })

    // Um lead já conhecido pode conceder o primeiro opt-in em um novo toque.
    // A mesma trava por WhatsApp serializa a checagem e impede boas-vindas
    // duplicadas em capturas concorrentes.
    if (params.enfileirarBoasVindas !== false && params.consentimentoMarketingEm != null) {
      const jaTemBoasVindas = await tx.crmMensagem.findFirst({
        where: { leadId: lead.id, tipo: 'BOAS_VINDAS' },
        select: { id: true },
      })
      if (!jaTemBoasVindas) {
        await enfileirarMensagem({
          whatsapp,
          nome,
          tipo: 'BOAS_VINDAS',
          leadId: lead.id,
          agendadoPara: params.boasVindasAgendadaPara ?? new Date(Date.now() + 30_000),
        }, tx)
      }
    }

    return lead
  })
}

/**
 * Centraliza a captura para que popup, agendamento e checkout tenham a mesma
 * deduplicação. Um número repetido é atualizado e deixa um rastro do novo
 * toque nas notas. Como BOAS_VINDAS é uma mensagem promocional, ela só é
 * criada quando há opt-in explícito e timestampado; se o opt-in acontecer em
 * um toque posterior, a primeira boas-vindas pode ser criada nesse momento.
 *
 * A checagem findFirst é só um atalho — quem garante que dois cadastros
 * concorrentes não dupliquem o lead é a constraint única em CrmLead.whatsapp
 * (ver migration 20260804210000). Se a corrida acontecer, o create perde e
 * cai no catch abaixo, convergindo para o mesmo lead que a outra requisição
 * criou. Criação do lead + enfileiramento da boas-vindas rodam na mesma
 * transação: se o enqueue falhar, o create também é desfeito, então um retry
 * do cliente tenta de novo do zero em vez de ficar com um lead "mudo" que
 * nunca recebeu a primeira mensagem.
 */
export async function capturarLead(params: CapturarLeadParams) {
  const whatsapp = normalizarWhatsApp(params.whatsapp)
  const nome = params.nome.trim()

  const existente = await prisma.crmLead.findFirst({ where: { whatsapp } })
  if (existente) {
    const lead = await atualizarToque(whatsapp, params, nome)
    return { lead, criado: false }
  }

  try {
    const lead = await prisma.$transaction(async (tx) => {
      const novo = await tx.crmLead.create({
        data: {
          nome,
          whatsapp,
          origem: params.origem,
          produtoSlug: params.produtoSlug ?? undefined,
          utmSource: params.utmSource ?? undefined,
          utmMedium: params.utmMedium ?? undefined,
          utmCampaign: params.utmCampaign ?? undefined,
          consentimentoMarketingEm: params.consentimentoMarketingEm ?? undefined,
          notas: notaDeToque(params.origem, params.produtoSlug),
          etapa: 'NOVO',
        },
      })

      if (params.enfileirarBoasVindas !== false && params.consentimentoMarketingEm != null) {
        await enfileirarMensagem(
          {
            whatsapp,
            nome,
            tipo: 'BOAS_VINDAS',
            leadId: novo.id,
            agendadoPara: params.boasVindasAgendadaPara ?? new Date(Date.now() + 30_000),
          },
          tx,
        )
      }

      return novo
    })

    return { lead, criado: true }
  } catch (e) {
    if (!isUniqueWhatsappViolation(e)) throw e

    // Outra captura venceu a corrida entre o findFirst e este create — ela já
    // criou o lead (e, se pedido, já enfileirou a boas-vindas na mesma
    // transação). Converge para o mesmo lead em vez de duplicar.
    const lead = await atualizarToque(whatsapp, params, nome)
    return { lead, criado: false }
  }
}
