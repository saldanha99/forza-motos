import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const EVENTO_PIRELLI_SLUG = 'pirelli-forza'

type TransactionClient = Prisma.TransactionClient

export function normalizarWhatsappEvento(valor: string) {
  const numeros = valor.replace(/\D/g, '')
  if (numeros.length === 10 || numeros.length === 11) return `55${numeros}`
  return numeros
}

export function limparNomeGravacao(valor: string) {
  return valor.trim().replace(/\s+/g, ' ')
}

/** Formulários enviam booleano como string; `Boolean("false")` seria verdadeiro. */
export function paraBooleano(valor: unknown) {
  return valor === true || valor === 'true'
}

/** Gate único para todas as rotas públicas do evento: respeita ativo/publicado e a janela de datas, se configurada. */
export function eventoDisponivel(evento: { ativo: boolean; publicado: boolean; dataInicio: Date | null; dataFim: Date | null }) {
  if (!evento.ativo || !evento.publicado) return false
  const agora = new Date()
  if (evento.dataInicio && agora < evento.dataInicio) return false
  if (evento.dataFim && agora > evento.dataFim) return false
  return true
}

/** Letras, números, espaços e a pontuação que a gravação aceita com segurança. */
export function nomeGravacaoValido(valor: string) {
  // Restrição intencionalmente conservadora para a gravadora: alfabeto latino
  // (inclusive acentos brasileiros), números e pontuação simples. Isso já
  // elimina emoji e símbolos que não costumam ser reproduzíveis.
  return /^[a-zA-ZÀ-ÿ0-9 .,'-]+$/.test(valor)
}

export function novoCodigoQr() {
  return randomBytes(24).toString('base64url')
}

const perguntasIniciais = [
  {
    enunciado: 'Na medida 150/60R17, o que representa o número 17?',
    explicacao: 'O último número informa o diâmetro do aro em polegadas.',
    opcoes: ['A largura do pneu em milímetros', 'O perfil do pneu', 'O diâmetro do aro em polegadas', 'A pressão máxima'],
    correta: 2,
  },
  {
    enunciado: 'Na medida 120/70-17, o que representa o número 70?',
    explicacao: 'O perfil é a altura da lateral em porcentagem da largura do pneu.',
    opcoes: ['A altura do perfil em % da largura', 'O aro em polegadas', 'A largura em milímetros', 'O índice de velocidade'],
    correta: 0,
  },
  {
    enunciado: 'Em 150/60R17, a letra R indica qual construção?',
    explicacao: 'R e ZR indicam construção radial; não devem ser tratadas como a mesma coisa que pneus diagonais.',
    opcoes: ['Diagonal', 'Radial', 'Remold', 'Reforçada'],
    correta: 1,
  },
]

/** Cria uma configuração neutra para que o admin a complete antes de publicar. */
export async function obterEventoPirelli() {
  let evento = await prisma.eventoPirelli.findUnique({ where: { slug: EVENTO_PIRELLI_SLUG } })
  if (evento) return evento

  evento = await prisma.eventoPirelli.create({
    data: {
      slug: EVENTO_PIRELLI_SLUG,
      perguntasQuiz: {
        create: perguntasIniciais.map((pergunta, ordem) => ({
          enunciado: pergunta.enunciado,
          explicacao: pergunta.explicacao,
          ordem,
          pontos: 1,
          opcoes: {
            create: pergunta.opcoes.map((texto, indice) => ({ texto, ordem: indice, correta: indice === pergunta.correta })),
          },
        })),
      },
    },
  })
  return evento
}

export async function exigirAdmin() {
  const { getServerSession } = await import('next-auth')
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

/**
 * O estado de brinde (elegibilidades + caneca) é POR VISITANTE, então é essa a
 * granularidade do lock. Travar por participação de foto não protege nada: a
 * reconciliação do quiz mexe nas mesmas linhas a partir de outra chave.
 *
 * Toda transação que decide sobre elegibilidade/caneca pega este lock como
 * primeiro passo. É a única chave desses caminhos, e `pg_advisory_xact_lock` é
 * reentrante na mesma transação — não há ciclo possível.
 */
export async function bloquearVisitanteEvento(tx: TransactionClient, visitanteId: string) {
  const chave = `evento-pirelli-visitante:${visitanteId}`
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0))`
}

/**
 * Aceita um cliente de transação existente para participar de uma transação maior
 * (ex.: tentativa de quiz + elegibilidade precisam ser atômicas). Sem ele, abre a sua própria.
 */
export async function criarElegibilidadeDeCaneca(
  args: {
    visitanteId: string
    origem: 'QUIZ_PERFEITO' | 'FOTO_VENCEDORA' | 'COMPRA_PNEUS' | 'MANUAL'
    validadoPor?: string | null
    valorPneus?: number | null
    referenciaVenda?: string | null
    observacao?: string | null
  },
  clienteExistente?: TransactionClient,
) {
  const executar = async (tx: TransactionClient) => {
    await bloquearVisitanteEvento(tx, args.visitanteId)
    const visitante = await tx.eventoPirelliVisitante.findUniqueOrThrow({ where: { id: args.visitanteId } })
    let caneca = await tx.eventoPirelliCaneca.upsert({
      where: { visitanteId: visitante.id },
      create: { visitanteId: visitante.id, nomeGravacaoSnapshot: visitante.nomeGravacao },
      update: {},
    })
    // Uma nova origem não pode reabrir uma caneca já em gravação/pronta/entregue.
    // Se ela havia sido cancelada por falta de elegibilidade, reativa sem permitir
    // uma segunda entrega quando o histórico mostra que a pessoa já recebeu a caneca.
    if (caneca.status === 'CANCELADA') {
      caneca = await tx.eventoPirelliCaneca.update({
        where: { id: caneca.id },
        data: { status: caneca.entregueEm ? 'ENTREGUE' : 'PENDENTE' },
      })
    }
    return tx.eventoPirelliElegibilidadeCaneca.upsert({
      where: { visitanteId_origem: { visitanteId: visitante.id, origem: args.origem } },
      create: { ...args, canecaId: caneca.id },
      // Re-conceder uma origem previamente revogada (ex.: foto marcada VENCEDOR de novo) limpa a revogação.
      update: { canecaId: caneca.id, validadoPor: args.validadoPor ?? undefined, valorPneus: args.valorPneus ?? undefined, referenciaVenda: args.referenciaVenda ?? undefined, observacao: args.observacao ?? undefined, revogadoEm: null, revogadoPor: null, revogadoMotivo: null },
    })
  }
  if (clienteExistente) return executar(clienteExistente)
  return prisma.$transaction(executar)
}

/**
 * Self-heal: se uma tentativa perfeita existir sem a elegibilidade correspondente
 * (ex.: falha no passo 2 antes desta rotina ficar atômica), recria a elegibilidade/caneca.
 * Chamada em toda leitura de tentativa (GET/POST do quiz, lookup de atendimento).
 *
 * Roda inteira sob o lock do visitante. Solta, ela concedia QUIZ_PERFEITO no meio
 * de uma despromoção de foto: a revogação já tinha contado zero elegibilidades
 * vivas e cancelava a caneca depois, deixando brinde negado a quem tinha direito.
 */
export async function reconciliarElegibilidadeQuiz(visitanteId: string) {
  return prisma.$transaction(async (tx) => {
    await bloquearVisitanteEvento(tx, visitanteId)
    const tentativa = await tx.eventoPirelliQuizTentativa.findUnique({ where: { visitanteId } })
    if (!tentativa?.acertouTodas) return
    const existente = await tx.eventoPirelliElegibilidadeCaneca.findUnique({
      where: { visitanteId_origem: { visitanteId, origem: 'QUIZ_PERFEITO' } },
    })
    // Se já existe (mesmo revogada por decisão manual do admin), não sobrescreve.
    if (existente) return
    await criarElegibilidadeDeCaneca({ visitanteId, origem: 'QUIZ_PERFEITO', validadoPor: 'Sistema (reconciliação)' }, tx)
  })
}

/**
 * Corrigir um vencedor de foto (VENCEDOR -> FINALISTA/DESCARTADO) precisa revogar o brinde
 * concedido por essa origem. A linha fica preservada com quem revogou e por quê — a equipe
 * precisa responder isso num evento presencial. A caneca só é cancelada se não restar
 * nenhuma outra elegibilidade válida (ex.: quiz perfeito).
 */
export async function revogarElegibilidadeFotoVencedora(
  visitanteId: string,
  revogadoPor: string,
  motivo: string,
  clienteExistente?: TransactionClient,
) {
  const executar = async (tx: TransactionClient) => {
    await bloquearVisitanteEvento(tx, visitanteId)
    const elegibilidade = await tx.eventoPirelliElegibilidadeCaneca.findUnique({
      where: { visitanteId_origem: { visitanteId, origem: 'FOTO_VENCEDORA' } },
    })
    if (!elegibilidade || elegibilidade.revogadoEm) return
    await tx.eventoPirelliElegibilidadeCaneca.update({
      where: { id: elegibilidade.id },
      data: { revogadoEm: new Date(), revogadoPor, revogadoMotivo: motivo },
    })
    const restantes = await tx.eventoPirelliElegibilidadeCaneca.count({ where: { visitanteId, revogadoEm: null } })
    if (restantes === 0) {
      await tx.eventoPirelliCaneca.updateMany({ where: { visitanteId }, data: { status: 'CANCELADA' } })
    }
  }
  if (clienteExistente) return executar(clienteExistente)
  return prisma.$transaction(executar)
}

export type AtualizacaoFotoEvento = {
  id: string
  status: 'PENDENTE' | 'FINALISTA' | 'VENCEDOR' | 'DESCARTADO'
  curtidasApuradas: number | null
  observacao: string | null
  operador: string
}

/**
 * Serializa toda decisão sobre uma participação. O status e o direito à caneca
 * são derivados dentro do mesmo lock/transação, inclusive quando dois PATCHes
 * opostos chegam ao mesmo tempo.
 *
 * O lock é do VISITANTE, não da participação: o que esta função decide são a
 * elegibilidade e a caneca, que pertencem ao visitante e são mexidas também pela
 * reconciliação do quiz. Como a foto é 1:1 com o visitante, dois PATCHes na mesma
 * participação continuam derivando a mesma chave e serializando entre si.
 */
export async function atualizarFotoEvento(args: AtualizacaoFotoEvento) {
  return prisma.$transaction(async (tx) => {
    // visitanteId é imutável na participação, então lê-lo antes do lock é seguro.
    const alvo = await tx.eventoPirelliParticipacaoFoto.findUniqueOrThrow({ where: { id: args.id }, select: { visitanteId: true } })
    await bloquearVisitanteEvento(tx, alvo.visitanteId)
    const participacao = await tx.eventoPirelliParticipacaoFoto.findUniqueOrThrow({ where: { id: args.id } })
    const atualizada = await tx.eventoPirelliParticipacaoFoto.update({
      where: { id: args.id },
      data: {
        status: args.status,
        curtidasApuradas: args.curtidasApuradas,
        apuradoEm: new Date(),
        apuradoPor: args.operador,
        observacao: args.observacao,
      },
      include: { visitante: true },
    })

    if (args.status === 'VENCEDOR') {
      await criarElegibilidadeDeCaneca({ visitanteId: participacao.visitanteId, origem: 'FOTO_VENCEDORA', validadoPor: args.operador }, tx)
    } else {
      // Não depende do status anterior: também corrige estados legados em que a
      // participação já não era vencedora, mas a elegibilidade continuava ativa.
      await revogarElegibilidadeFotoVencedora(
        participacao.visitanteId,
        args.operador,
        `Foto definida como ${args.status}`,
        tx,
      )
    }
    return atualizada
  })
}

const includeAtendimento = {
  tentativaQuiz: true,
  participacaoFoto: true,
  canecaBrinde: { include: { elegibilidades: { where: { revogadoEm: null } } } },
  elegibilidadesCaneca: { where: { revogadoEm: null } },
  comprasCaneca: true,
} satisfies Prisma.EventoPirelliVisitanteInclude

/** Busca única por id, aplicando o self-heal antes de devolver o estado da caneca. */
export async function buscarVisitanteAtendimentoPorId(id: string, eventoId: string) {
  const visitante = await prisma.eventoPirelliVisitante.findFirst({
    where: { id, eventoId },
    include: includeAtendimento,
  })
  if (!visitante) return null
  if (visitante.tentativaQuiz?.acertouTodas) {
    await reconciliarElegibilidadeQuiz(visitante.id)
    return prisma.eventoPirelliVisitante.findFirst({ where: { id, eventoId }, include: includeAtendimento })
  }
  return visitante
}

export type ResultadoBuscaAtendimento =
  | { tipo: 'unico'; visitante: NonNullable<Awaited<ReturnType<typeof buscarVisitanteAtendimentoPorId>>> }
  | { tipo: 'multiplos'; candidatos: { id: string; nomeCompleto: string; whatsapp: string; instagram: string | null; createdAt: Date }[] }
  | null

/**
 * "Maria" não tem dígitos: incluir o braço de telefone faria `whatsapp contains ''`,
 * que casa com todo mundo. Só entra na busca por telefone quando há dígitos de fato.
 * Mais de um resultado nunca escolhe silenciosamente — devolve a lista para o atendente decidir.
 */
export async function buscarAtendimento(eventoId: string, busca: string): Promise<ResultadoBuscaAtendimento> {
  const digitos = busca.replace(/\D/g, '')
  const or: Prisma.EventoPirelliVisitanteWhereInput[] = [
    { codigoQr: busca },
    { nomeCompleto: { contains: busca, mode: 'insensitive' } },
  ]
  if (digitos) or.push({ whatsapp: { contains: digitos } })

  const candidatos = await prisma.eventoPirelliVisitante.findMany({
    where: { eventoId, OR: or },
    orderBy: { createdAt: 'desc' },
    take: 21,
    select: { id: true, nomeCompleto: true, whatsapp: true, instagram: true, createdAt: true },
  })
  if (!candidatos.length) return null
  if (candidatos.length === 1) {
    const visitante = await buscarVisitanteAtendimentoPorId(candidatos[0].id, eventoId)
    return visitante ? { tipo: 'unico', visitante } : null
  }
  return { tipo: 'multiplos', candidatos: candidatos.slice(0, 20) }
}

/** Idempotente pela chave gerada no cliente: duplo clique/retry no mesmo pedido não cria uma segunda venda. */
export async function registrarCompraCaneca(args: {
  eventoId: string
  visitanteId: string
  quantidade: number
  nomeGravacaoSnapshot: string
  referenciaVenda?: string | null
  chaveIdempotencia: string
}) {
  return prisma.eventoPirelliCompraCaneca.upsert({
    where: { chaveIdempotencia: args.chaveIdempotencia },
    create: {
      eventoId: args.eventoId,
      visitanteId: args.visitanteId,
      quantidade: args.quantidade,
      nomeGravacaoSnapshot: args.nomeGravacaoSnapshot,
      referenciaVenda: args.referenciaVenda ?? null,
      chaveIdempotencia: args.chaveIdempotencia,
    },
    update: {},
  })
}

/** Neutraliza prefixos que o Excel/LibreOffice interpretam como início de fórmula. */
export function escaparCelulaCsv(valor: unknown) {
  const texto = String(valor ?? '')
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto
}

export function montarCsv(linhas: (string | number | null | undefined)[][]) {
  return linhas.map((linha) => linha.map((valor) => `"${escaparCelulaCsv(valor).replace(/"/g, '""')}"`).join(';')).join('\n')
}

export async function linhasCsvLeads(eventoId: string) {
  const itens = await prisma.eventoPirelliVisitante.findMany({ where: { eventoId }, orderBy: { createdAt: 'desc' } })
  return [
    ['nome_completo', 'nome_gravacao', 'whatsapp', 'email', 'instagram', 'consentimento_marketing', 'criado_em'],
    ...itens.map((item) => [
      item.nomeCompleto,
      item.nomeGravacao,
      item.whatsapp,
      item.email,
      item.instagram,
      item.consentimentoMarketingEm ? 'sim' : 'não',
      item.createdAt.toISOString(),
    ]),
  ]
}

export async function linhasCsvCompras(eventoId: string) {
  const itens = await prisma.eventoPirelliCompraCaneca.findMany({
    where: { eventoId },
    include: { visitante: true },
    orderBy: { registradoEm: 'asc' },
  })
  return [
    ['nome_gravacao', 'nome_completo', 'whatsapp', 'quantidade', 'status', 'referencia_venda', 'registrado_em', 'entregue_em', 'entregue_por'],
    ...itens.map((item) => [
      item.nomeGravacaoSnapshot,
      item.visitante?.nomeCompleto,
      item.visitante?.whatsapp,
      item.quantidade,
      item.status,
      item.referenciaVenda,
      item.registradoEm.toISOString(),
      item.entregueEm?.toISOString(),
      item.entreguePor,
    ]),
  ]
}
