import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enfileirarMensagem } from '@/lib/evolution/queue'
import { normalizarWhatsApp } from '@/lib/evolution/client'
import { horarioValido } from '@/lib/agendamento/horarios'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()

    if (!horarioValido(body.dataPreferida, body.horarioPreferido)) {
      return NextResponse.json(
        { error: 'Horário fora do funcionamento: seg–sex 9h às 18h, sábado 8h às 12h, domingo fechado.' },
        { status: 400 }
      )
    }

    const agendamento = await prisma.appointment.create({
      data: {
        userId: session?.user?.id,
        nome: body.nome,
        telefone: body.telefone,
        servico: body.servico,
        motoModelo: body.motoModelo,
        dataPreferida: new Date(body.dataPreferida),
        horarioPreferido: body.horarioPreferido,
        notas: body.notas,
      },
    })

    // Atualiza CRM como ORCAMENTO se for novo cliente
    if (session?.user?.id) {
      await prisma.customerCRM.upsert({
        where: { userId: session.user.id },
        update: { etapaFunil: 'ORCAMENTO' },
        create: { userId: session.user.id, etapaFunil: 'ORCAMENTO' },
      })
    }

    // Enfileira mensagem de confirmação no WhatsApp
    if (body.telefone) {
      const dataFormatada = new Date(body.dataPreferida).toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      })

      // Captura lead (ou atualiza se já existir)
      const wa = normalizarWhatsApp(body.telefone)
      const leadExistente = await prisma.crmLead.findFirst({ where: { whatsapp: wa } })
      const lead = leadExistente ?? await prisma.crmLead.create({
        data: { nome: body.nome, whatsapp: wa, origem: 'AGENDAMENTO', etapa: 'NOVO' },
      })

      await enfileirarMensagem({
        whatsapp: wa,
        nome: body.nome,
        tipo: 'AGENDAMENTO',
        leadId: lead.id,
        payload: {
          servico: body.servico,
          data: dataFormatada,
          horario: body.horarioPreferido,
          moto: body.motoModelo,
        },
      })
    }

    return NextResponse.json(agendamento, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
