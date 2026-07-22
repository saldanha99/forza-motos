/**
 * Assessoria de estoque/agenda — IA conversacional (Fase 3).
 *
 * A IA responde perguntas do grupo de WhatsApp consultando agenda, estoque e
 * conflitos de reserva. É SOMENTE LEITURA: as ferramentas só consultam o banco,
 * nunca escrevem/alteram nada. Usa a Claude API (Anthropic) com tool use.
 */
import {
  consultarAgenda,
  consultarEstoque,
  conflitosReserva,
  agendamentosPendentes,
} from '@/lib/estoque/assessoria'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-opus-4-8'

const SYSTEM = `Você é a assessora de estoque e agenda da Forza Motos (loja/oficina de motos em Campinas/SP), respondendo no grupo de WhatsApp da equipe.
- Responda em português do Brasil, de forma curta e direta (é WhatsApp).
- Use APENAS as ferramentas para obter dados reais; nunca invente números.
- Você é somente leitura: não agenda, não reserva, não altera estoque. Se pedirem uma ação dessas, oriente a equipe a fazer no painel.
- Se não houver dados, diga claramente. Formate valores e datas de forma legível.`

// Ferramentas expostas à IA (todas somente leitura)
const TOOLS = [
  {
    name: 'consultar_agenda',
    description: 'Lista os agendamentos de um dia (padrão: hoje). Retorna nome, serviço, moto e horário.',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data no formato AAAA-MM-DD. Omita para hoje.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'consultar_estoque',
    description: 'Busca produtos por nome ou SKU e retorna estoque, reservado e disponível.',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Nome ou parte do nome/SKU do produto (ex.: "Angel GT 160").' },
      },
      required: ['termo'],
      additionalProperties: false,
    },
  },
  {
    name: 'conflitos_reserva',
    description: 'Lista produtos onde as reservas de agendamento alcançam ou passam o estoque (risco de dois clientes disputando o mesmo item).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'agendamentos_pendentes',
    description: 'Lista agendamentos ainda pendentes de confirmação, de hoje em diante.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
] as const

async function executarFerramenta(nome: string, input: any): Promise<unknown> {
  switch (nome) {
    case 'consultar_agenda':
      return consultarAgenda(input?.data ? new Date(`${input.data}T12:00:00`) : undefined)
    case 'consultar_estoque':
      return consultarEstoque(String(input?.termo ?? ''))
    case 'conflitos_reserva':
      return conflitosReserva()
    case 'agendamentos_pendentes':
      return agendamentosPendentes()
    default:
      return { erro: 'ferramenta desconhecida' }
  }
}

async function chamarClaude(messages: any[]): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages }),
  })
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return res.json()
}

/**
 * Responde a uma pergunta do grupo. Roda o loop de tool use até a resposta
 * final. Limite de rodadas para não travar. Retorna o texto para enviar.
 */
export async function responderAssessoria(pergunta: string): Promise<string> {
  const messages: any[] = [{ role: 'user', content: pergunta }]

  for (let rodada = 0; rodada < 5; rodada++) {
    const resp = await chamarClaude(messages)

    if (resp.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: resp.content })
      const resultados = []
      for (const bloco of resp.content) {
        if (bloco.type === 'tool_use') {
          const out = await executarFerramenta(bloco.name, bloco.input).catch((e) => ({ erro: String(e) }))
          resultados.push({
            type: 'tool_result',
            tool_use_id: bloco.id,
            content: JSON.stringify(out),
          })
        }
      }
      messages.push({ role: 'user', content: resultados })
      continue
    }

    // Resposta final — junta os blocos de texto
    const texto = (resp.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim()
    return texto || 'Não consegui montar uma resposta agora.'
  }

  return 'A consulta ficou longa demais. Reformule a pergunta, por favor.'
}
