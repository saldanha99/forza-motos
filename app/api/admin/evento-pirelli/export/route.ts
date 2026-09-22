import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAdmin, linhasCsvCompras, linhasCsvLeads, montarCsv, obterEventoPirelli } from '@/lib/evento-pirelli'
import { compararResultadosQuiz, formatarDuracaoQuiz } from '@/lib/eventos/quiz-pirelli'

export async function GET(request: Request) {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const tipo = new URL(request.url).searchParams.get('tipo') ?? 'leads'
  const evento = await obterEventoPirelli()
  let conteudo = ''
  if (tipo === 'canecas') {
    const itens = await prisma.eventoPirelliCaneca.findMany({ where: { visitante: { eventoId: evento.id } }, include: { visitante: true, elegibilidades: { where: { revogadoEm: null } } }, orderBy: { createdAt: 'asc' } })
    conteudo = montarCsv([['nome_gravacao', 'nome_completo', 'whatsapp', 'status', 'motivos', 'forma_pagamento_compra_pneus', 'pagamento_confirmado_em', 'pagamento_confirmado_por', 'referencia_pagamento', 'entregue_em', 'entregue_por'], ...itens.map((item) => {
      const compraPneus = item.elegibilidades.find((e) => e.origem === 'COMPRA_PNEUS')
      return [item.nomeGravacaoSnapshot, item.visitante.nomeCompleto, item.visitante.whatsapp, item.status, item.elegibilidades.map((e) => e.origem).join(', '), compraPneus?.formaPagamento, compraPneus?.pagamentoConfirmadoEm?.toISOString(), compraPneus?.pagamentoConfirmadoPor, compraPneus?.referenciaPagamento, item.entregueEm?.toISOString(), item.entreguePor]
    })])
  } else if (tipo === 'quiz') {
    const itens = await prisma.eventoPirelliQuizTentativa.findMany({ where: { visitante: { eventoId: evento.id } }, include: { visitante: true, respostas: true }, orderBy: { concluidaEm: 'desc' } })
    const perfeitos = itens.filter((item) => item.acertouTodas && item.duracaoMs != null && item.concluidaEm != null)
      .sort(compararResultadosQuiz)
    const posicoes = new Map(perfeitos.map((item, indice) => [item.id, indice + 1]))
    conteudo = montarCsv([
      ['posicao', 'nome', 'whatsapp', 'pontuacao', 'pontuacao_maxima', 'acertou_todas', 'iniciada_em', 'concluida_em', 'duracao_ms', 'duracao_formatada', 'resposta_final', 'resposta_final_correta'],
      ...itens.map((item) => {
        const final = item.respostas.find((resposta) => resposta.respostaTexto)
        return [posicoes.get(item.id), item.visitante.nomeCompleto, item.visitante.whatsapp, item.pontuacao, item.pontuacaoMaxima, item.acertouTodas ? 'sim' : 'não', item.iniciadaEm.toISOString(), item.concluidaEm?.toISOString(), item.duracaoMs, formatarDuracaoQuiz(item.duracaoMs), final?.respostaTexto, final ? (final.corretaSnapshot ? 'sim' : 'não') : null]
      }),
    ])
  } else if (tipo === 'fotos') {
    const itens = await prisma.eventoPirelliParticipacaoFoto.findMany({ where: { visitante: { eventoId: evento.id } }, include: { visitante: true }, orderBy: { declarouPublicacaoEm: 'desc' } })
    conteudo = montarCsv([
      ['nome', 'instagram', 'marcacoes_confirmadas', 'hashtag_confirmada', 'perfil_publico_confirmado', 'status', 'curtidas_apuradas', 'apurado_em'],
      ...itens.map((item) => [item.visitante.nomeCompleto, item.instagram, item.declarouMarcacoes ? 'sim' : 'não', item.declarouHashtag ? 'sim' : 'não', item.declarouPerfilPublico ? 'sim' : 'não', item.status, item.curtidasApuradas, item.apuradoEm?.toISOString()]),
    ])
  } else if (tipo === 'operacao') {
    const itens = await prisma.eventoPirelliVisitante.findMany({
      where: { eventoId: evento.id },
      include: {
        tentativaQuiz: true,
        participacaoFoto: true,
        balanceamento: true,
        canecaBrinde: true,
        elegibilidadesCaneca: { where: { revogadoEm: null } },
        comprasCaneca: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    conteudo = montarCsv([
      ['nome', 'whatsapp', 'email', 'moto', 'origens_direito_caneca', 'compra_pneus_valor', 'compra_pneus_forma_pagamento', 'compra_pneus_referencia', 'compra_pneus_confirmada_em', 'compra_pneus_confirmada_por', 'nome_gravacao', 'caneca_status', 'caneca_pronta_em', 'caneca_entregue_em', 'caneca_entregue_por', 'canecas_avulsas_compradas', 'kit_entregue', 'quiz_pontuacao', 'quiz_perfeito', 'foto_status', 'balanceamento_status'],
      ...itens.map((item) => {
        const compraPneus = item.elegibilidadesCaneca.find((direito) => direito.origem === 'COMPRA_PNEUS')
        return [
          item.nomeCompleto,
          item.whatsapp,
          item.email,
          [item.motoMarca, item.motoModelo, item.motoAno].filter(Boolean).join(' '),
          item.elegibilidadesCaneca.map((direito) => direito.origem).join(', '),
          compraPneus?.valorPneus ? Number(compraPneus.valorPneus) : null,
          compraPneus?.formaPagamento,
          compraPneus?.referenciaPagamento ?? compraPneus?.referenciaVenda,
          compraPneus?.pagamentoConfirmadoEm?.toISOString(),
          compraPneus?.pagamentoConfirmadoPor ?? compraPneus?.validadoPor,
          item.nomeGravacao,
          item.canecaBrinde?.status,
          item.canecaBrinde?.prontaEm?.toISOString(),
          item.canecaBrinde?.entregueEm?.toISOString(),
          item.canecaBrinde?.entreguePor,
          item.comprasCaneca.reduce((total, compra) => total + compra.quantidade, 0),
          item.kitParticipacaoEntregueEm ? 'sim' : 'não',
          item.tentativaQuiz ? `${item.tentativaQuiz.pontuacao}/${item.tentativaQuiz.pontuacaoMaxima}` : null,
          item.tentativaQuiz?.acertouTodas ? 'sim' : 'não',
          item.participacaoFoto?.status,
          item.balanceamento?.status,
        ]
      }),
    ])
  } else if (tipo === 'compras') {
    conteudo = montarCsv(await linhasCsvCompras(evento.id))
  } else if (tipo === 'caixa') {
    const itens = await prisma.eventoPirelliLancamentoCaixa.findMany({
      where: { eventoId: evento.id },
      include: { visitante: { select: { nomeCompleto: true, whatsapp: true } } },
      orderBy: { confirmadoEm: 'asc' },
    })
    conteudo = montarCsv([
      ['tipo', 'origem', 'nome', 'whatsapp', 'quantidade', 'valor_unitario', 'valor_total', 'forma_pagamento', 'referencia_pagamento', 'referencia_venda', 'confirmado_em', 'confirmado_por', 'estornado_em', 'estornado_por', 'estorno_motivo'],
      ...itens.map((item) => [
        item.tipo, item.origem, item.visitante.nomeCompleto, item.visitante.whatsapp,
        item.quantidade, item.valorUnitario ? Number(item.valorUnitario) : null, Number(item.valorTotal), item.formaPagamento,
        item.referenciaPagamento, item.referenciaVenda, item.confirmadoEm.toISOString(),
        item.confirmadoPor, item.estornadoEm?.toISOString(), item.estornadoPor,
        item.estornoMotivo,
      ]),
    ])
  } else {
    conteudo = montarCsv(await linhasCsvLeads(evento.id))
  }
  return new NextResponse('﻿' + conteudo, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="evento-pirelli-${tipo}.csv"` } })
}
