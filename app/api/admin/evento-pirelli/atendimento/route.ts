import { after, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { bloquearVisitanteEvento, buscarAtendimento, buscarVisitanteAtendimentoPorId, criarElegibilidadeDeCaneca, definirNomeCanecaElegivel, exigirAdmin, limparNomeGravacao, nomeGravacaoValido, normalizarWhatsappEvento, novoCodigoQr, obterEventoPirelli, registrarCompraCaneca, whatsappEventoValido } from '@/lib/evento-pirelli'
import { statusCanecaPirelli, transicaoCanecaPirelliPermitida } from '@/lib/eventos/caneca-pirelli'
import { enfileirarConfirmacaoCanecaPirelli } from '@/lib/eventos/notificacoes-caneca-pirelli'
import { processarMensagem } from '@/lib/evolution/queue'

const FORMAS_PAGAMENTO_PRESENCIAL = [
  'PIX_EXTERNO',
  'DINHEIRO',
  'CARTAO_CREDITO_MAQUININHA',
  'CARTAO_DEBITO_MAQUININHA',
  'OUTRO',
] as const
type FormaPagamentoPresencial = (typeof FORMAS_PAGAMENTO_PRESENCIAL)[number]

function notificarConfirmacaoCaneca(params: Parameters<typeof enfileirarConfirmacaoCanecaPirelli>[0]) {
  after(async () => {
    try {
      const mensagem = await enfileirarConfirmacaoCanecaPirelli(params)
      if (mensagem) await processarMensagem(mensagem.id)
    } catch (error) {
      console.error('[evento-pirelli/atendimento] Falha ao notificar confirmação da caneca:', error)
    }
  })
}

function formaPagamentoPresencial(valor: unknown): FormaPagamentoPresencial | null {
  const forma = String(valor ?? '') as FormaPagamentoPresencial
  return FORMAS_PAGAMENTO_PRESENCIAL.includes(forma) ? forma : null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function textoCurto(valor: unknown, limite: number) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, limite)
}

function vendaPneusElegivel(evento: { operadorValorMinimoPneus: string; valorMinimoPneus: unknown }, valor: number) {
  return evento.operadorValorMinimoPneus === 'MAIOR_QUE'
    ? valor > Number(evento.valorMinimoPneus)
    : valor >= Number(evento.valorMinimoPneus)
}

export async function GET(request: Request) {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const url = new URL(request.url)
  const id = url.searchParams.get('id')?.trim()
  const evento = await obterEventoPirelli()

  if (id) {
    const visitante = await buscarVisitanteAtendimentoPorId(id, evento.id)
    if (!visitante) return NextResponse.json({ error: 'Visitante não encontrado.' }, { status: 404 })
    return NextResponse.json(visitante)
  }

  const busca = url.searchParams.get('codigo')?.trim()
  if (!busca) return NextResponse.json({ error: 'Informe o nome ou telefone do participante.' }, { status: 400 })
  const resultado = await buscarAtendimento(evento.id, busca)
  if (!resultado) return NextResponse.json({ error: 'Visitante não encontrado.' }, { status: 404 })
  if (resultado.tipo === 'multiplos') return NextResponse.json({ multiplos: resultado.candidatos })
  return NextResponse.json(resultado.visitante)
}

export async function POST(request: Request) {
  const session = await exigirAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    const visitanteId = String(body.visitanteId ?? '')
    const operador = session.user.email ?? 'Equipe'
    const chaveIdempotencia = String(body.chaveIdempotencia ?? '').trim().slice(0, 120)
    if (body.acao === 'cadastrar-cliente') {
      const evento = await obterEventoPirelli()
      const nomeCompleto = textoCurto(body.nomeCompleto, 120)
      const whatsapp = normalizarWhatsappEvento(String(body.whatsapp ?? ''))
      const email = textoCurto(body.email, 254).toLowerCase()
      if (!chaveIdempotencia) return NextResponse.json({ error: 'Requisição sem chave de idempotência.' }, { status: 400 })
      if (nomeCompleto.length < 2) return NextResponse.json({ error: 'Informe o nome completo do cliente.' }, { status: 400 })
      if (!whatsappEventoValido(whatsapp)) return NextResponse.json({ error: 'Informe um WhatsApp celular brasileiro válido com DDD.' }, { status: 400 })
      if (email && !EMAIL.test(email)) return NextResponse.json({ error: 'Informe um e-mail válido ou deixe o campo vazio.' }, { status: 400 })

      let visitante = await prisma.eventoPirelliVisitante.findUnique({
        where: { eventoId_whatsapp: { eventoId: evento.id, whatsapp } },
        select: { id: true },
      })
      let reutilizado = Boolean(visitante)
      if (!visitante) {
        try {
          visitante = await prisma.eventoPirelliVisitante.create({
            data: {
              eventoId: evento.id,
              nomeCompleto,
              whatsapp,
              email: email || null,
              consentimentoMarketingEm: body.consentimentoMarketing === true ? new Date() : null,
              chaveSubmissao: `admin-pdv:${chaveIdempotencia}`,
              codigoQr: novoCodigoQr(),
            },
            select: { id: true },
          })
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
          visitante = await prisma.eventoPirelliVisitante.findUnique({
            where: { eventoId_whatsapp: { eventoId: evento.id, whatsapp } },
            select: { id: true },
          })
          reutilizado = true
        }
      }
      if (!visitante) throw new Error('CLIENTE_NAO_LOCALIZADO_APOS_CADASTRO')
      const ficha = await buscarVisitanteAtendimentoPorId(visitante.id, evento.id)
      return NextResponse.json({ visitante: ficha, reutilizado }, { status: reutilizado ? 200 : 201 })
    }
    if (body.acao === 'criar-venda-presencial') {
      const evento = await obterEventoPirelli()
      const visitante = await prisma.eventoPirelliVisitante.findFirst({ where: { id: visitanteId, eventoId: evento.id } })
      if (!visitante) return NextResponse.json({ error: 'Cliente não encontrado neste evento.' }, { status: 404 })
      if (!chaveIdempotencia) return NextResponse.json({ error: 'Requisição sem chave de idempotência.' }, { status: 400 })
      const tipo = body.tipo === 'caneca' ? 'VENDA_CANECA' : body.tipo === 'pneus' ? 'COMPRA_PNEUS' : null
      const formaPagamento = formaPagamentoPresencial(body.formaPagamento)
      const referenciaVenda = textoCurto(body.referenciaVenda, 120)
      if (!tipo) return NextResponse.json({ error: 'Selecione venda de caneca ou compra de pneus.' }, { status: 400 })
      if (!formaPagamento) return NextResponse.json({ error: 'Selecione como o cliente vai pagar.' }, { status: 400 })

      let quantidade: number | null = null
      let valorUnitario: number | null = null
      let valorTotal: number
      if (tipo === 'VENDA_CANECA') {
        quantidade = Math.floor(Number(body.quantidade))
        valorUnitario = Number(evento.valorCanecaAvulsa)
        if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 10) return NextResponse.json({ error: 'A quantidade deve ser de 1 a 10 canecas.' }, { status: 400 })
        if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) return NextResponse.json({ error: 'O preço da caneca está inválido no cadastro do evento.' }, { status: 400 })
        valorTotal = Number((valorUnitario * quantidade).toFixed(2))
      } else {
        valorTotal = Number(Number(body.valorPneus).toFixed(2))
        if (!Number.isFinite(valorTotal) || valorTotal <= 0 || valorTotal > 9_999_999.99) return NextResponse.json({ error: 'Informe o subtotal válido dos pneus.' }, { status: 400 })
      }

      const existente = await prisma.eventoPirelliVendaPresencial.findUnique({ where: { chaveIdempotencia } })
      if (existente) {
        const mesmaOperacao = existente.eventoId === evento.id
          && existente.visitanteId === visitanteId
          && existente.tipo === tipo
          && existente.quantidade === quantidade
          && Number(existente.valorTotal) === valorTotal
          && existente.formaPagamento === formaPagamento
          && (existente.referenciaVenda ?? '') === referenciaVenda
        if (!mesmaOperacao) throw new Error('CHAVE_IDEMPOTENCIA_REUTILIZADA')
        return NextResponse.json(existente)
      }
      const venda = await prisma.eventoPirelliVendaPresencial.create({ data: {
        eventoId: evento.id,
        visitanteId,
        tipo,
        quantidade,
        valorUnitario,
        valorTotal,
        formaPagamento,
        referenciaVenda: referenciaVenda || null,
        criadoPor: operador,
        chaveIdempotencia,
      } })
      return NextResponse.json(venda, { status: 201 })
    }
    if (body.acao === 'confirmar-venda-presencial') {
      const evento = await obterEventoPirelli()
      const vendaId = String(body.vendaId ?? '').trim()
      const referenciaPagamento = textoCurto(body.referenciaPagamento, 120)
      if (!vendaId) return NextResponse.json({ error: 'Venda presencial não informada.' }, { status: 400 })
      const resultado = await prisma.$transaction(async (tx) => {
        const chaveLock = `evento-pirelli-venda-presencial:${vendaId}`
        await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${chaveLock}, 0))`
        const venda = await tx.eventoPirelliVendaPresencial.findFirst({
          where: { id: vendaId, eventoId: evento.id, visitanteId },
          include: { visitante: true, evento: true },
        })
        if (!venda) throw new Error('VENDA_PRESENCIAL_NAO_ENCONTRADA')
        if (venda.status === 'CANCELADO') throw new Error('VENDA_PRESENCIAL_CANCELADA')
        const referenciaFinal = referenciaPagamento || venda.referenciaPagamento || null
        if (venda.status === 'PAGO') {
          const compra = venda.tipo === 'VENDA_CANECA'
            ? await tx.eventoPirelliCompraCaneca.findUnique({ where: { chaveIdempotencia: `pdv:${venda.id}` } })
            : null
          const elegibilidade = venda.tipo === 'COMPRA_PNEUS' && vendaPneusElegivel(venda.evento, Number(venda.valorTotal))
            ? await tx.eventoPirelliElegibilidadeCaneca.findUnique({ where: { visitanteId_origem: { visitanteId, origem: 'COMPRA_PNEUS' } } })
            : null
          return { venda, compra, elegibilidade, repetido: true }
        }

        const [relogio] = await tx.$queryRaw<Array<{ agora: Date }>>`SELECT clock_timestamp() AS "agora"`
        if (!relogio?.agora) throw new Error('RELOGIO_INDISPONIVEL')
        const agora = relogio.agora
        let compra = null
        let elegibilidade = null
        if (venda.tipo === 'VENDA_CANECA') {
          const nomeConfirmado = venda.visitante.nomeGravacaoConfirmadoEm ? venda.visitante.nomeGravacao : null
          compra = await registrarCompraCaneca({
            eventoId: venda.eventoId,
            visitanteId: venda.visitanteId,
            quantidade: venda.quantidade ?? 1,
            nomeGravacaoSnapshot: nomeConfirmado,
            referenciaVenda: venda.referenciaVenda,
            formaPagamento: venda.formaPagamento as FormaPagamentoPresencial,
            valorUnitarioSnapshot: Number(venda.valorUnitario),
            valorPago: Number(venda.valorTotal),
            pagamentoConfirmadoEm: agora,
            pagamentoConfirmadoPor: operador,
            referenciaPagamento: referenciaFinal,
            chaveIdempotencia: `pdv:${venda.id}`,
          }, tx)
        } else if (vendaPneusElegivel(venda.evento, Number(venda.valorTotal))) {
          elegibilidade = await criarElegibilidadeDeCaneca({
            visitanteId: venda.visitanteId,
            origem: 'COMPRA_PNEUS',
            valorPneus: Number(venda.valorTotal),
            referenciaVenda: venda.referenciaVenda,
            formaPagamento: venda.formaPagamento,
            pagamentoConfirmadoEm: agora,
            pagamentoConfirmadoPor: operador,
            referenciaPagamento: referenciaFinal,
            validadoPor: operador,
            observacao: 'Benefício liberado automaticamente após confirmação manual do PDV.',
          }, tx)
        }
        await tx.eventoPirelliLancamentoCaixa.create({ data: {
          eventoId: venda.eventoId,
          visitanteId: venda.visitanteId,
          tipo: venda.tipo,
          origem: 'ADMIN_PRESENCIAL',
          quantidade: venda.quantidade,
          valorUnitario: venda.valorUnitario,
          valorTotal: venda.valorTotal,
          formaPagamento: venda.formaPagamento,
          referenciaPagamento: referenciaFinal,
          referenciaVenda: venda.referenciaVenda,
          confirmadoEm: agora,
          confirmadoPor: operador,
          chaveIdempotencia: `pdv:${venda.id}`,
          observacao: venda.tipo === 'VENDA_CANECA' ? 'Venda presencial de caneca confirmada no PDV.' : 'Compra presencial de pneus confirmada no PDV.',
        } })
        const atualizada = await tx.eventoPirelliVendaPresencial.update({
          where: { id: venda.id },
          data: {
            status: 'PAGO',
            referenciaPagamento: referenciaFinal,
            pagamentoConfirmadoEm: agora,
            pagamentoConfirmadoPor: operador,
          },
        })
        return { venda: atualizada, compra, elegibilidade, repetido: false }
      })
      if (resultado.compra) {
        notificarConfirmacaoCaneca({
          visitanteId,
          motivo: 'COMPRA_CANECA',
          referencia: resultado.compra.id,
          quantidade: resultado.compra.quantidade,
          nomeGravacao: resultado.compra.nomeGravacaoSnapshot,
        })
      } else if (resultado.elegibilidade) {
        notificarConfirmacaoCaneca({
          visitanteId,
          motivo: 'BRINDE_COMPRA_PNEUS',
          referencia: resultado.elegibilidade.id,
          nomeGravacao: null,
        })
      }
      return NextResponse.json(resultado)
    }
    if (body.acao === 'cancelar-venda-presencial') {
      const evento = await obterEventoPirelli()
      const vendaId = String(body.vendaId ?? '').trim()
      const motivo = textoCurto(body.motivo, 300)
      if (!vendaId) return NextResponse.json({ error: 'Venda presencial não informada.' }, { status: 400 })
      if (motivo.length < 3) return NextResponse.json({ error: 'Informe o motivo do cancelamento.' }, { status: 400 })
      const venda = await prisma.$transaction(async (tx) => {
        const chaveLock = `evento-pirelli-venda-presencial:${vendaId}`
        await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${chaveLock}, 0))`
        const atual = await tx.eventoPirelliVendaPresencial.findFirst({ where: { id: vendaId, eventoId: evento.id, visitanteId } })
        if (!atual) throw new Error('VENDA_PRESENCIAL_NAO_ENCONTRADA')
        if (atual.status === 'PAGO') throw new Error('VENDA_PRESENCIAL_JA_PAGA')
        if (atual.status === 'CANCELADO') return atual
        const [relogio] = await tx.$queryRaw<Array<{ agora: Date }>>`SELECT clock_timestamp() AS "agora"`
        if (!relogio?.agora) throw new Error('RELOGIO_INDISPONIVEL')
        return tx.eventoPirelliVendaPresencial.update({
          where: { id: atual.id },
          data: { status: 'CANCELADO', canceladoEm: relogio.agora, canceladoPor: operador, cancelamentoMotivo: motivo },
        })
      })
      return NextResponse.json(venda)
    }
    if (body.acao === 'status-kit-participacao') {
      const entregue = body.entregue === true
      const visitante = await prisma.eventoPirelliVisitante.update({
        where: { id: visitanteId },
        data: {
          kitParticipacaoEntregueEm: entregue ? new Date() : null,
          kitParticipacaoEntreguePor: entregue ? operador : null,
        },
      })
      return NextResponse.json(visitante)
    }
    if (body.acao === 'status-balanceamento') {
      const status = body.status
      if (!['INTERESSE', 'CONFIRMADO', 'PARTICIPOU'].includes(status)) {
        return NextResponse.json({ error: 'Status de balanceamento inválido.' }, { status: 400 })
      }
      const agora = new Date()
      const balanceamento = await prisma.eventoPirelliBalanceamento.update({
        where: { visitanteId },
        data: {
          status,
          confirmadoEm: status === 'INTERESSE' ? null : status === 'CONFIRMADO' ? agora : undefined,
          participouEm: status === 'PARTICIPOU' ? agora : status === 'INTERESSE' ? null : undefined,
          atualizadoPor: operador,
        },
      })
      return NextResponse.json(balanceamento)
    }
    if (body.acao === 'status-caneca') {
      const status = body.status
      if (!statusCanecaPirelli(status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
      // Mesmo lock das decisões de elegibilidade: sem ele, marcar ENTREGUE podia
      // cruzar com uma despromoção de foto e um dos dois escrevia por cima do outro.
      const caneca = await prisma.$transaction(async (tx) => {
        await bloquearVisitanteEvento(tx, visitanteId)
        const atual = await tx.eventoPirelliCaneca.findUnique({
          where: { visitanteId },
          include: { elegibilidades: { where: { revogadoEm: null }, select: { id: true } } },
        })
        if (!atual) throw new Error('CANECA_NAO_ENCONTRADA')
        if (!atual.elegibilidades.length) throw new Error('CANECA_SEM_DIREITO')
        if (atual.status === 'ENTREGUE') throw new Error('CANECA_JA_ENTREGUE')
        if (!transicaoCanecaPirelliPermitida(atual.status, status)) throw new Error('TRANSICAO_CANECA_INVALIDA')
        const [relogio] = await tx.$queryRaw<Array<{ agora: Date }>>`SELECT clock_timestamp() AS "agora"`
        if (!relogio?.agora) throw new Error('RELOGIO_INDISPONIVEL')
        const alterada = await tx.eventoPirelliCaneca.updateMany({
          where: { id: atual.id, status: atual.status },
          data: {
            status,
            gravacaoIniciadaEm: status === 'EM_GRAVACAO' ? relogio.agora : undefined,
            gravadoPor: status === 'EM_GRAVACAO' ? operador : undefined,
            prontaEm: status === 'PRONTA' ? relogio.agora : undefined,
            entregueEm: status === 'ENTREGUE' ? relogio.agora : undefined,
            entreguePor: status === 'ENTREGUE' ? operador : undefined,
          },
        })
        if (alterada.count !== 1) throw new Error('CANECA_ATUALIZADA_POR_OUTRO_OPERADOR')
        return tx.eventoPirelliCaneca.findUniqueOrThrow({ where: { id: atual.id } })
      })
      return NextResponse.json(caneca)
    }
    if (body.acao === 'validar-compra-pneus') {
      const evento = await obterEventoPirelli()
      const valorPneus = Number(body.valorPneus)
      const nomeGravacao = limparNomeGravacao(String(body.nomeGravacao ?? ''))
      const formaPagamento = formaPagamentoPresencial(body.formaPagamento)
      const referenciaPagamento = String(body.referenciaPagamento ?? '').trim().slice(0, 120)
      const referenciaVenda = String(body.referenciaVenda ?? '').trim().slice(0, 120)
      const elegivel = evento.operadorValorMinimoPneus === 'MAIOR_QUE' ? valorPneus > Number(evento.valorMinimoPneus) : valorPneus >= Number(evento.valorMinimoPneus)
      if (!Number.isFinite(valorPneus) || !elegivel) return NextResponse.json({ error: `Subtotal de pneus não atende à promoção (regra atual: ${evento.operadorValorMinimoPneus === 'MAIOR_QUE' ? 'maior que' : 'maior ou igual a'} R$ ${Number(evento.valorMinimoPneus).toFixed(2)}).` }, { status: 400 })
      if (nomeGravacao.length < 2 || nomeGravacao.length > evento.limiteNomeGravacao || !nomeGravacaoValido(nomeGravacao)) return NextResponse.json({ error: 'Informe um nome válido para gravar na caneca.' }, { status: 400 })
      if (!formaPagamento) return NextResponse.json({ error: 'Selecione como a compra presencial foi paga.' }, { status: 400 })
      if (!chaveIdempotencia) return NextResponse.json({ error: 'Requisição sem chave de idempotência.' }, { status: 400 })
      if (body.pagamentoConfirmado !== true) return NextResponse.json({ error: 'Confirme o recebimento antes de liberar a caneca.' }, { status: 400 })
      const agora = new Date()
      const elegibilidade = await prisma.$transaction(async (tx) => {
        const chaveCaixa = `pneus:${chaveIdempotencia}`
        const existente = await tx.eventoPirelliLancamentoCaixa.findUnique({ where: { chaveIdempotencia: chaveCaixa } })
        if (existente) {
          const mesmaOperacao = existente.visitanteId === visitanteId
            && existente.tipo === 'COMPRA_PNEUS'
            && Number(existente.valorTotal) === Number(valorPneus.toFixed(2))
            && existente.formaPagamento === formaPagamento
            && (existente.referenciaPagamento ?? '') === referenciaPagamento
          if (!mesmaOperacao) throw new Error('CHAVE_IDEMPOTENCIA_REUTILIZADA')
          return tx.eventoPirelliElegibilidadeCaneca.findUniqueOrThrow({
            where: { visitanteId_origem: { visitanteId, origem: 'COMPRA_PNEUS' } },
          })
        }
        const direito = await criarElegibilidadeDeCaneca({
          visitanteId,
          origem: 'COMPRA_PNEUS',
          valorPneus,
          referenciaVenda: referenciaVenda || null,
          formaPagamento,
          pagamentoConfirmadoEm: agora,
          pagamentoConfirmadoPor: operador,
          referenciaPagamento: referenciaPagamento || null,
          validadoPor: operador,
          observacao: `Compra presencial conferida. Pagamento: ${formaPagamento}.`,
          nomeGravacao,
        }, tx)
        await tx.eventoPirelliLancamentoCaixa.create({ data: {
          eventoId: evento.id,
          visitanteId,
          tipo: 'COMPRA_PNEUS',
          origem: 'ADMIN_PRESENCIAL',
          valorTotal: valorPneus,
          formaPagamento,
          referenciaPagamento: referenciaPagamento || null,
          referenciaVenda: referenciaVenda || null,
          confirmadoEm: agora,
          confirmadoPor: operador,
          chaveIdempotencia: chaveCaixa,
          observacao: 'Compra presencial de pneus conferida no caixa do evento.',
        } })
        return direito
      })
      notificarConfirmacaoCaneca({
        visitanteId,
        motivo: 'BRINDE_COMPRA_PNEUS',
        referencia: elegibilidade.id,
        nomeGravacao,
      })
      return NextResponse.json(elegibilidade)
    }
    if (body.acao === 'registrar-compra-caneca') {
      if (!chaveIdempotencia) return NextResponse.json({ error: 'Requisição sem chave de idempotência.' }, { status: 400 })
      const visitante = await prisma.eventoPirelliVisitante.findUniqueOrThrow({ where: { id: visitanteId } })
      const quantidade = Math.max(1, Math.floor(Number(body.quantidade ?? 1)))
      const nomeGravacao = limparNomeGravacao(String(body.nomeGravacao ?? ''))
      const evento = await prisma.eventoPirelli.findUniqueOrThrow({ where: { id: visitante.eventoId } })
      const formaPagamento = formaPagamentoPresencial(body.formaPagamento)
      const referenciaPagamento = String(body.referenciaPagamento ?? '').trim().slice(0, 120)
      const referenciaVenda = String(body.referenciaVenda ?? '').trim().slice(0, 120)
      if (nomeGravacao.length < 2 || nomeGravacao.length > evento.limiteNomeGravacao || !nomeGravacaoValido(nomeGravacao)) return NextResponse.json({ error: 'Informe um nome válido para gravar na caneca.' }, { status: 400 })
      if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 10) return NextResponse.json({ error: 'A quantidade deve ser de 1 a 10 canecas.' }, { status: 400 })
      if (!formaPagamento) return NextResponse.json({ error: 'Selecione como a caneca foi paga.' }, { status: 400 })
      if (body.pagamentoConfirmado !== true) return NextResponse.json({ error: 'Confirme o recebimento antes de enviar a caneca para gravação.' }, { status: 400 })
      const valorUnitario = Number(evento.valorCanecaAvulsa)
      if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) return NextResponse.json({ error: 'O preço da caneca está inválido no cadastro do evento.' }, { status: 400 })
      const valorPago = Number((valorUnitario * quantidade).toFixed(2))
      const agora = new Date()
      // Idempotente pela chave gerada no cliente: duplo clique/retry no mesmo pedido não cria uma segunda venda.
      const compra = await prisma.$transaction(async (tx) => {
        await bloquearVisitanteEvento(tx, visitanteId)
        const existente = await tx.eventoPirelliCompraCaneca.findUnique({ where: { chaveIdempotencia } })
        if (existente) {
          const mesmaOperacao = existente.visitanteId === visitanteId
            && existente.eventoId === visitante.eventoId
            && existente.quantidade === quantidade
            && existente.nomeGravacaoSnapshot === nomeGravacao
            && existente.formaPagamento === formaPagamento
            && Number(existente.valorPago) === valorPago
            && (existente.referenciaPagamento ?? '') === referenciaPagamento
          if (!mesmaOperacao) throw new Error('CHAVE_IDEMPOTENCIA_REUTILIZADA')
          return existente
        }
        const venda = await registrarCompraCaneca({
          eventoId: visitante.eventoId,
          visitanteId,
          quantidade,
          nomeGravacaoSnapshot: nomeGravacao,
          referenciaVenda: referenciaVenda || null,
          formaPagamento,
          valorUnitarioSnapshot: valorUnitario,
          valorPago,
          pagamentoConfirmadoEm: agora,
          pagamentoConfirmadoPor: operador,
          referenciaPagamento: referenciaPagamento || null,
          chaveIdempotencia,
        }, tx)
        await tx.eventoPirelliVisitante.update({
          where: { id: visitanteId },
          data: {
            nomeGravacao,
            nomeGravacaoConfirmadoEm: agora,
            nomeGravacaoConfirmadoPor: operador,
          },
        })
        await tx.eventoPirelliLancamentoCaixa.create({ data: {
          eventoId: visitante.eventoId,
          visitanteId,
          tipo: 'VENDA_CANECA',
          origem: 'ADMIN_PRESENCIAL',
          quantidade,
          valorUnitario,
          valorTotal: valorPago,
          formaPagamento,
          referenciaPagamento: referenciaPagamento || null,
          referenciaVenda: referenciaVenda || null,
          confirmadoEm: agora,
          confirmadoPor: operador,
          chaveIdempotencia: `caneca:${chaveIdempotencia}`,
          observacao: 'Venda presencial de caneca conferida no caixa do evento.',
        } })
        return venda
      })
      notificarConfirmacaoCaneca({
        visitanteId,
        motivo: 'COMPRA_CANECA',
        referencia: compra.id,
        quantidade: compra.quantidade,
        nomeGravacao: compra.nomeGravacaoSnapshot,
      })
      return NextResponse.json(compra)
    }
    if (body.acao === 'definir-nome-caneca') {
      const caneca = await definirNomeCanecaElegivel(visitanteId, String(body.nomeGravacao ?? ''), operador)
      return NextResponse.json(caneca)
    }
    if (body.acao === 'status-compra-caneca') {
      const status = body.status
      if (!statusCanecaPirelli(status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
      const compraId = String(body.compraId ?? '')
      const compra = await prisma.$transaction(async (tx) => {
        await bloquearVisitanteEvento(tx, visitanteId)
        const existente = await tx.eventoPirelliCompraCaneca.findFirst({ where: { id: compraId, visitanteId } })
        if (!existente) throw new Error('COMPRA_CANECA_NAO_ENCONTRADA')
        if (!existente.pagamentoConfirmadoEm) throw new Error('COMPRA_CANECA_NAO_PAGA')
        if (!existente.nomeGravacaoSnapshot) throw new Error('COMPRA_CANECA_SEM_NOME')
        if (existente.status === 'ENTREGUE') throw new Error('CANECA_JA_ENTREGUE')
        if (!transicaoCanecaPirelliPermitida(existente.status, status)) throw new Error('TRANSICAO_CANECA_INVALIDA')
        const [relogio] = await tx.$queryRaw<Array<{ agora: Date }>>`SELECT clock_timestamp() AS "agora"`
        if (!relogio?.agora) throw new Error('RELOGIO_INDISPONIVEL')
        const alterada = await tx.eventoPirelliCompraCaneca.updateMany({
          where: { id: compraId, visitanteId, status: existente.status },
          data: { status, entregueEm: status === 'ENTREGUE' ? relogio.agora : undefined, entreguePor: status === 'ENTREGUE' ? operador : undefined },
        })
        if (alterada.count !== 1) throw new Error('CANECA_ATUALIZADA_POR_OUTRO_OPERADOR')
        return tx.eventoPirelliCompraCaneca.findUniqueOrThrow({ where: { id: compraId } })
      })
      return NextResponse.json(compra)
    }
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (error: any) {
    if (error?.message === 'CHAVE_IDEMPOTENCIA_REUTILIZADA') {
      return NextResponse.json({ error: 'Este lançamento já foi usado com outros dados. Feche a tela e inicie a venda novamente.' }, { status: 409 })
    }
    const conflitos: Record<string, string> = {
      CANECA_JA_ENTREGUE: 'Esta caneca já foi entregue e não pode ser liberada novamente.',
      TRANSICAO_CANECA_INVALIDA: 'A caneca precisa seguir a ordem: pendente, em gravação, pronta e entregue.',
      CANECA_ATUALIZADA_POR_OUTRO_OPERADOR: 'Outro operador já atualizou esta caneca. Recarregue a ficha.',
      CANECA_SEM_DIREITO: 'O direito a esta caneca não está mais ativo.',
      COMPRA_CANECA_NAO_PAGA: 'O pagamento desta caneca ainda não foi confirmado.',
      COMPRA_CANECA_SEM_NOME: 'Aguarde o cliente confirmar o nome da gravação antes de iniciar a produção.',
      VENDA_PRESENCIAL_CANCELADA: 'Esta venda foi cancelada e não pode mais ser confirmada.',
      VENDA_PRESENCIAL_JA_PAGA: 'Esta venda já foi confirmada. Para corrigir o caixa, use o fluxo de estorno.',
    }
    if (conflitos[error?.message]) {
      return NextResponse.json({ error: conflitos[error.message] }, { status: 409 })
    }
    if (error?.message === 'CANECA_NAO_ENCONTRADA' || error?.message === 'COMPRA_CANECA_NAO_ENCONTRADA') {
      return NextResponse.json({ error: 'Caneca não encontrada para este participante.' }, { status: 404 })
    }
    if (error?.message === 'VENDA_PRESENCIAL_NAO_ENCONTRADA') {
      return NextResponse.json({ error: 'Venda presencial não encontrada para este cliente.' }, { status: 404 })
    }
    return NextResponse.json({ error: error?.message ?? 'Não foi possível concluir a operação.' }, { status: 400 })
  }
}
