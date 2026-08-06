import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarPreferencia } from '@/lib/mercadopago'

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const evento = await prisma.evento.findUnique({
      where: { slug: params.slug, publicado: true, ativo: true },
    })

    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { nome, email, telefone, quantidade, opcaoVagaLabel, temGarupa, nomeGarupa, tipoAcomodacao, motoModelo, cpf, cep, numeroResidencia } = body

    if (!nome || !email || !telefone) {
      return NextResponse.json({ error: 'Nome, e-mail e telefone são obrigatórios' }, { status: 400 })
    }

    if (temGarupa && !nomeGarupa?.trim()) {
      return NextResponse.json({ error: 'Informe o nome da garupa' }, { status: 400 })
    }

    const qty = Math.max(1, Number(quantidade) || 1)

    // Preço SEMPRE recalculado no servidor a partir do evento — nunca confia
    // no valor enviado pelo cliente (evita manipulação de preço).
    const opcoesVaga = Array.isArray(evento.opcoesVaga) ? (evento.opcoesVaga as { label: string; preco: number }[]) : []
    const opcaoEscolhida = opcaoVagaLabel ? opcoesVaga.find((o) => o.label === opcaoVagaLabel) : undefined
    if (opcaoVagaLabel && !opcaoEscolhida) {
      return NextResponse.json({ error: 'Opção de vaga inválida' }, { status: 400 })
    }
    const preco = opcaoEscolhida ? opcaoEscolhida.preco : Number(evento.preco)
    const total = preco * qty

    // Se o evento é pago (preco > 0), exige CPF, CEP e Número para hotel/seguro
    if (preco > 0) {
      const cpfLimpo = String(cpf || '').replace(/\D/g, '')
      if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
        return NextResponse.json({ error: 'Informe um CPF válido para a reserva do hotel/seguro' }, { status: 400 })
      }
      if (!cep?.trim() || !numeroResidencia?.trim()) {
        return NextResponse.json({ error: 'CEP e Número Residencial são obrigatórios para eventos pagos' }, { status: 400 })
      }
    }

    // Cria inscrição pendente
    const inscricao = await prisma.eventoInscricao.create({
      data: {
        eventoId: evento.id,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telefone.trim(),
        cpf: cpf ? String(cpf).replace(/\D/g, '') : null,
        cep: cep?.trim() || null,
        numeroResidencia: numeroResidencia?.trim() || null,
        quantidade: qty,
        temGarupa: Boolean(temGarupa),
        nomeGarupa: temGarupa ? nomeGarupa?.trim() : null,
        // Se for gratuito, tipoAcomodacao é nulo
        tipoAcomodacao: preco === 0 ? null : (tipoAcomodacao?.trim() || null),
        motoModelo: motoModelo?.trim() || null,
        total,
        opcaoVagaLabel: opcaoEscolhida?.label,
        opcaoVagaPreco: opcaoEscolhida ? preco : undefined,
        status: 'PENDENTE',
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://forzamotos.com.br'

    // Evento gratuito — confirma direto sem MP
    if (preco === 0) {
      await prisma.eventoInscricao.update({
        where: { id: inscricao.id },
        data: { status: 'PAGO' },
      })
      return NextResponse.json({
        sucesso: true,
        gratuito: true,
        redirectUrl: `${baseUrl}/eventos/sucesso?inscricao=${inscricao.id}`,
      })
    }

    // Cria preferência no Mercado Pago
    // external_reference: "evento_<inscricaoId>" — distingue de pedidos no webhook
    const preferencia = await criarPreferencia({
      items: [
        {
          id: evento.id,
          title: `Ingresso — ${evento.titulo}${opcaoEscolhida ? ` (${opcaoEscolhida.label})` : ''}`,
          quantity: qty,
          unit_price: preco,
          picture_url: evento.imagemUrl ?? undefined,
        },
      ],
      payer: { email, name: nome },
      external_reference: `evento_${inscricao.id}`,
      back_urls: {
        success: `${baseUrl}/eventos/sucesso?inscricao=${inscricao.id}`,
        failure: `${baseUrl}/eventos/${evento.slug}?erro=pagamento`,
        pending: `${baseUrl}/eventos/sucesso?inscricao=${inscricao.id}&pendente=1`,
      },
    })

    // Salva ID da preferência
    await prisma.eventoInscricao.update({
      where: { id: inscricao.id },
      data: { mpPreferenciaId: preferencia.id },
    })

    return NextResponse.json({
      sucesso: true,
      gratuito: false,
      init_point: preferencia.init_point,
    })
  } catch (e: any) {
    console.error('[eventos/comprar]', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
