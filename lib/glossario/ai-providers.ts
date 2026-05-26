/**
 * Camada de abstração para gerar conteúdo de glossário via IA.
 * Suporta Gemini e OpenAI — modelo escolhido via catálogo `ai-models.ts`.
 *
 * Configuração (.env):
 *   AI_PROVIDER=gemini          # default quando não passado
 *   GEMINI_API_KEY=...
 *   OPENAI_API_KEY=...
 *   GEMINI_MODEL=gemini-2.0-flash    # modelo default do Gemini
 *   OPENAI_MODEL=gpt-4o-mini         # modelo default do OpenAI
 *
 * Validação: se o usuário passar um `modelo` que não existe no catálogo
 * `AI_MODELS`, a função lança erro antes de gastar tokens.
 */

import { modeloExiste, obterModelo, modeloRecomendado, type AIProvider } from './ai-models'
export type { AIProvider } from './ai-models'

export interface GenerateInput {
  /** Título/termo a ser definido */
  termo: string
  /** Nicho/segmento. Ex: "peças de moto" */
  nicho: string
  /** Idioma do conteúdo */
  idioma?: string
  /** Tom/estilo */
  estilo?: string
  /** Tokens máximos */
  maxTokens?: number
  /** Prompt extra concatenado */
  promptExtra?: string
  /** Override de provider */
  provider?: AIProvider
  /** Override de modelo */
  modelo?: string
}

export interface GenerateOutput {
  /** HTML pronto para inserção (com <h2>, <p>, <strong> etc.) */
  conteudo: string
  /** Resumo de até 160 chars para meta description */
  resumo: string
  /** Provider efetivamente usado */
  provider: AIProvider
  /** Modelo efetivamente usado */
  modelo: string
}

// ============================================================
// Prompt base (adaptado do Glossário Ninja, otimizado para SEO)
// ============================================================

function buildPrompt(input: GenerateInput): string {
  const {
    termo,
    nicho,
    idioma = 'pt-BR',
    estilo = 'informativo, técnico e acessível',
    promptExtra = '',
  } = input

  return `Você é um especialista em SEO e criação de glossários otimizados para ranqueamento no Google.

Crie um verbete de glossário para o termo "${termo}" no nicho de "${nicho}".

REGRAS OBRIGATÓRIAS:
- Idioma: ${idioma}
- Tom: ${estilo}
- Use TAGs HTML <h2> para subtítulos (3 a 5 subtítulos)
- Use <p> para parágrafos e <strong> para destacar termos-chave
- Estrutura: definição direta no primeiro parágrafo, depois aprofundamento
- 6 a 10 parágrafos bem desenvolvidos
- Use sinônimos e LSI (Latent Semantic Indexing) do termo "${termo}"
- NÃO escreva introdução genérica nem conclusão/considerações finais
- NÃO repita o título no início do conteúdo
- Inicie já com a definição

RESPONDA EM JSON ESTRITO neste formato (sem markdown, sem \`\`\`):
{
  "conteudo": "<h2>...</h2><p>...</p>...",
  "resumo": "Resumo direto em até 160 caracteres para meta description"
}

${promptExtra ? `Instruções extras: ${promptExtra}` : ''}`.trim()
}

// ============================================================
// Provider: Google Gemini
// ============================================================

async function generateGemini(input: GenerateInput): Promise<GenerateOutput> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  const modelo = input.modelo! // já resolvido por resolverModelo()
  const prompt = buildPrompt(input)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: input.maxTokens || 2000,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini API erro ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini retornou resposta vazia')

  const parsed = JSON.parse(text)
  return {
    conteudo: parsed.conteudo,
    resumo: parsed.resumo,
    provider: 'gemini',
    modelo,
  }
}

// ============================================================
// Provider: OpenAI
// ============================================================

async function generateOpenAI(input: GenerateInput): Promise<GenerateOutput> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada')

  const modelo = input.modelo! // já resolvido por resolverModelo()
  const prompt = buildPrompt(input)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: input.maxTokens || 2000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API erro ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = await res.json()
  const text = json?.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenAI retornou resposta vazia')

  const parsed = JSON.parse(text)
  return {
    conteudo: parsed.conteudo,
    resumo: parsed.resumo,
    provider: 'openai',
    modelo,
  }
}

// ============================================================
// Função pública — escolhe provider e gera
// ============================================================

/**
 * Resolve o modelo a usar com base nos inputs.
 *
 * Ordem de prioridade:
 *   1. `input.modelo` (se passado E existir no catálogo) — provider derivado dele
 *   2. `input.provider` + env var do default (GEMINI_MODEL / OPENAI_MODEL)
 *   3. Modelo "recomendado" do provider no catálogo
 */
function resolverModelo(input: GenerateInput): { modelo: string; provider: AIProvider } {
  // 1. Modelo passado explicitamente — valida no catálogo
  if (input.modelo) {
    if (!modeloExiste(input.modelo)) {
      throw new Error(
        `Modelo "${input.modelo}" não está no catálogo AI_MODELS. ` +
          `Verifique lib/glossario/ai-models.ts.`
      )
    }
    const m = obterModelo(input.modelo)!
    // Se passou um provider conflitante, prevalece o do catálogo
    return { modelo: m.id, provider: m.provider }
  }

  // 2. Resolve via provider + env
  const provider =
    input.provider || (process.env.AI_PROVIDER as AIProvider) || 'gemini'

  const envModel =
    provider === 'openai' ? process.env.OPENAI_MODEL : process.env.GEMINI_MODEL

  if (envModel && modeloExiste(envModel)) {
    return { modelo: envModel, provider }
  }

  // 3. Fallback para modelo recomendado do provider
  return { modelo: modeloRecomendado(provider).id, provider }
}

export async function generateGlossaryTerm(input: GenerateInput): Promise<GenerateOutput> {
  const { modelo, provider } = resolverModelo(input)
  const inputResolvido: GenerateInput = { ...input, modelo, provider }

  if (provider === 'openai') return generateOpenAI(inputResolvido)
  return generateGemini(inputResolvido)
}
