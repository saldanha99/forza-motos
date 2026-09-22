import { CartDrawer } from '@/components/store/CartDrawer'
import {
  EventoPirelliLanding,
  type AcaoCadastroEventoPirelli,
  type AcaoExperienciaEventoPirelli,
  type PaginaEventoPirelli,
} from '@/components/evento-pirelli/EventoPirelliLanding'
import {
  eventoDisponivel,
  inscricaoEventoPirelliDisponivel,
  obterEventoPirelli,
} from '@/lib/evento-pirelli'
import { prisma } from '@/lib/prisma'

type Props = {
  pagina: PaginaEventoPirelli
  acao?: AcaoCadastroEventoPirelli | AcaoExperienciaEventoPirelli
  recuperarAcesso?: boolean
}

export async function ConteudoEventoPirelli({ pagina, acao, recuperarAcesso = false }: Props) {
  const evento = await obterEventoPirelli()
  const produtosEvento = pagina === 'ofertas'
    ? await prisma.product.findMany({
        where: {
          eventoPirelliId: evento.id,
          ativo: true,
          ocultoManual: false,
        },
        orderBy: [
          { destaque: 'desc' },
          { ordemEvento: 'asc' },
          { nome: 'asc' },
        ],
        select: {
          id: true,
          nome: true,
          slug: true,
          descricao: true,
          preco: true,
          precoPromocional: true,
          imagens: true,
          estoque: true,
          marca: true,
          categoria: true,
          destaque: true,
          ehPai: true,
          preVenda: true,
          prazoEntregaDias: true,
          limitePorPedidoEvento: true,
        },
      })
    : []

  const experienciasDisponiveis = eventoDisponivel(evento)
  const inscricoesDisponiveis = inscricaoEventoPirelliDisponivel(evento)
  const agora = new Date()
  const encerrou = Boolean(evento.dataFim && agora > evento.dataFim)
  const vendasDisponiveis = evento.ativo && evento.publicado && !encerrou && (
    evento.vendasAntecipadasAbertas || !evento.dataInicio || agora >= evento.dataInicio
  )
  const statusParticipacao = !inscricoesDisponiveis && evento.dataInicio && agora < evento.dataInicio
    ? 'As inscrições ainda não foram abertas.'
    : encerrou
      ? 'Esta ação já foi encerrada.'
      : !evento.ativo || !evento.publicado
        ? 'Esta ação ainda não está disponível.'
        : null

  return (
    <>
      <EventoPirelliLanding
        pagina={pagina}
        acao={acao}
        recuperarAcesso={recuperarAcesso}
        evento={{
          titulo: evento.titulo,
          descricao: evento.descricao,
          local: evento.local,
          dataInicio: evento.dataInicio?.toISOString() ?? null,
          dataFim: evento.dataFim?.toISOString() ?? null,
          logoForzaUrl: evento.logoForzaUrl,
          logoPirelliUrl: evento.logoPirelliUrl,
          logoCampneusUrl: evento.logoCampneusUrl,
          limiteNomeGravacao: evento.limiteNomeGravacao,
          valorMinimoPneus: Number(evento.valorMinimoPneus),
          valorCanecaAvulsa: Number(evento.valorCanecaAvulsa),
          ativo: evento.ativo,
          publicado: evento.publicado,
          inscricoesAntecipadasAbertas: evento.inscricoesAntecipadasAbertas,
          vendasAntecipadasAbertas: evento.vendasAntecipadasAbertas,
          quizEncerradoEm: evento.quizEncerradoEm?.toISOString() ?? null,
          operadorValorMinimoPneus: evento.operadorValorMinimoPneus,
        }}
        produtos={produtosEvento.map((produto) => ({
          ...produto,
          descricao: produto.descricao || null,
          preco: Number(produto.preco),
          precoPromocional: produto.precoPromocional == null
            ? null
            : Number(produto.precoPromocional),
          imagens: Array.isArray(produto.imagens)
            ? produto.imagens.filter((imagem): imagem is string => typeof imagem === 'string')
            : [],
        }))}
        disponivel={inscricoesDisponiveis}
        experienciasDisponiveis={experienciasDisponiveis}
        vendasDisponiveis={vendasDisponiveis}
        statusParticipacao={statusParticipacao}
      />
      {pagina === 'ofertas' ? <CartDrawer /> : null}
    </>
  )
}
