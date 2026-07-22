/**
 * Assessoria de estoque/agenda — IA conversacional (Fase 3).
 *
 * A IA responde perguntas do grupo de WhatsApp consultando agenda, estoque e
 * conflitos de reserva. É SOMENTE LEITURA: as ferramentas só consultam o banco.
 *
 * Usa API OpenAI-compatible (OpenRouter ou OpenAI) com function calling:
 *   OPENROUTER_API_KEY  → OpenRouter (base https://openrouter.ai/api/v1)
 *   OPENAI_API_KEY      → OpenAI (base https://api.openai.com/v1)
 *   ASSESSORIA_AI_MODEL → sobrescreve o modelo (default por provider abaixo)
 *   ASSESSORIA_AI_BASE_URL → sobrescreve a base URL
 *
 * Obs.: nem todo modelo grátis do OpenRouter suporta function calling de forma
 * confiável. gpt-4o-mini suporta. Se a IA ignorar as ferramentas, troque o
 * ASSESSORIA_AI_MODEL para "openai/gpt-4o-mini" (OpenRouter) ou "gpt-4o-mini".
 */
import {
  consultarAgenda,
  consultarEstoque,
  conflitosReserva,
  agendamentosPendentes,
} from '@/lib/estoque/assessoria'

const USANDO_OPENROUTER = Boolean(process.env.OPENROUTER_API_KEY)
const KEY = () => process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || ''
const BASE_URL = () =>
  process.env.ASSESSORIA_AI_BASE_URL ||
  (USANDO_OPENROUTER ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1')
const MODEL = () =>
  process.env.ASSESSORIA_AI_MODEL ||
  (USANDO_OPENROUTER ? 'nvidia/nemotron-nano-9b-v2:free' : 'gpt-4o-mini')

const SYSTEM = `Você é a assessora de estoque e agenda da Forza Motos (loja/oficina de motos em Campinas/SP), respondendo no grupo de WhatsApp da equipe.
- Responda em português do Brasil, de forma curta e direta (é WhatsApp).
- Use SEMPRE as ferramentas para obter dados reais; nunca invente números.
- Você é somente leitura: não agenda, não reserva, não altera estoque. Se pedirem uma ação dessas, oriente a equipe a fazer no painel.
- Se não houver dados, diga claramente. Formate valores e datas de forma legível.`

// Ferramentas (function calling — formato OpenAI), todas somente leitura
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'consultar_agenda',
      description: 'Lista os agendamentos de um dia (padrão: hoje). Retorna nome, serviço, moto e horário.',
      parameters: {
        type: 'object',
        properties: { data: { type: 'string', description: 'Data AAAA-MM-DD. Omita para hoje.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_estoque',
      description: 'Busca produtos por nome ou SKU e retorna estoque, reservado e disponível.',
      parameters: {
        type: 'object',
        properties: { termo: { type: 'string', description: 'Nome ou parte do nome/SKU (ex.: "Angel GT 160").' } },
        required: ['termo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'conflitos_reserva',
      description: 'Lista produtos onde as reservas de agendamento alcançam ou passam o estoque.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendamentos_pendentes',
      description: 'Lista agendamentos ainda pendentes de confirmação, de hoje em diante.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

async function executarFerramenta(nome: string, args: any): Promise<unknown> {
  switch (nome) {
    case 'consultar_agenda':
      return consultarAgenda(args?.data ? new Date(`${args.data}T12:00:00`) : undefined)
    case 'consultar_estoque':
      return consultarEstoque(String(args?.termo ?? ''))
    case 'conflitos_reserva':
      return conflitosReserva()
    case 'agendamentos_pendentes':
      return agendamentosPendentes()
    default:
      return { erro: 'ferramenta desconhecida' }
  }
}

async function chamarModelo(messages: any[]): Promise<any> {
  if (!KEY()) throw new Error('OPENROUTER_API_KEY / OPENAI_API_KEY não configurada')

  const res = await fetch(`${BASE_URL()}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${KEY()}`,
      // OpenRouter recomenda estes cabeçalhos (opcionais)
      ...(USANDO_OPENROUTER
        ? { 'HTTP-Referer': 'https://www.forzamotos.com.br', 'X-Title': 'Forza Assessoria' }
        : {}),
    },
    body: JSON.stringify({ model: MODEL(), messages, tools: TOOLS, temperature: 0.2, max_tokens: 700 }),
  })
  if (!res.ok) throw new Error(`IA ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

/**
 * Responde a uma pergunta do grupo. Loop de function calling até a resposta
 * final (máx. 5 rodadas). Retorna o texto para enviar.
 */
export async function responderAssessoria(pergunta: string): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: pergunta },
  ]

  for (let rodada = 0; rodada < 5; rodada++) {
    const data = await chamarModelo(messages)
    const msg = data?.choices?.[0]?.message
    if (!msg) return 'Não consegui montar uma resposta agora.'

    const toolCalls = msg.tool_calls ?? []
    if (toolCalls.length > 0) {
      messages.push(msg)
      for (const tc of toolCalls) {
        let args: any = {}
        try { args = JSON.parse(tc.function?.arguments || '{}') } catch { /* ignora */ }
        const out = await executarFerramenta(tc.function?.name, args).catch((e) => ({ erro: String(e) }))
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out) })
      }
      continue
    }

    const texto = String(msg.content ?? '').trim()
    return texto || 'Não consegui montar uma resposta agora.'
  }

  return 'A consulta ficou longa demais. Reformule a pergunta, por favor.'
}
