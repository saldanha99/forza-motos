import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const evento = await prisma.evento.findUnique({
      where: { id: params.id },
      include: {
        inscricoes: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!evento) {
      return new NextResponse('Evento não encontrado', { status: 404 })
    }

    const headers = [
      'Nome Piloto',
      'CPF',
      'E-mail',
      'WhatsApp',
      'CEP',
      'Numero Residencia',
      'Modelo Moto',
      'Vai com Garupa',
      'Nome Garupa',
      'Tipo Acomodacao (Quarto)',
      'Opcao Vaga',
      'Qtd Ingressos',
      'Total (R$)',
      'Status',
      'Data Inscricao',
    ]

    const rows = evento.inscricoes.map((i) => [
      `"${(i.nome || '').replace(/"/g, '""')}"`,
      `"${(i.cpf || '').replace(/"/g, '""')}"`,
      `"${(i.email || '').replace(/"/g, '""')}"`,
      `"${(i.telefone || '').replace(/"/g, '""')}"`,
      `"${(i.cep || '').replace(/"/g, '""')}"`,
      `"${(i.numeroResidencia || '').replace(/"/g, '""')}"`,
      `"${(i.motoModelo || '').replace(/"/g, '""')}"`,
      i.temGarupa ? 'Sim' : 'Nao',
      `"${(i.nomeGarupa || '').replace(/"/g, '""')}"`,
      `"${(i.tipoAcomodacao || '').replace(/"/g, '""')}"`,
      `"${(i.opcaoVagaLabel || '').replace(/"/g, '""')}"`,
      i.quantidade,
      Number(i.total).toFixed(2),
      i.status,
      new Date(i.createdAt).toLocaleString('pt-BR'),
    ])

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')

    const filename = `inscricoes_${evento.slug}_${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    return new NextResponse(error.message || 'Erro ao exportar CSV', { status: 500 })
  }
}
