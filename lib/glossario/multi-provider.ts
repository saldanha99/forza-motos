/**
 * Multi-provider AI — Forza Motos Glossário
 *
 * Suporta: Gemini · OpenAI · OpenRouter · Groq · DeepSeek · Anthropic
 *
 * Ordem de fallback (quando provider não é especificado):
 *   1. GEMINI_API_KEY  → gemini-2.0-flash
 *   2. OPENAI_API_KEY  → gpt-4o-mini
 *   3. Erro
 *
 * Compatível com modelos de raciocínio que emitem blocos <think>…</think>
 * (DeepSeek-R1, QwQ, etc.) — removidos automaticamente antes do parse.
 */

export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'groq' | 'deepseek' | 'anthropic'

interface CallOptions {
  prompt:    string
  maxTokens?: number
  provider?: string
  modelo?:   string
  /** API key passada pelo frontend (sobrescreve a env var) */
  apiKey?:   string
}

// ── Mapeamento de base URLs ────────────────────────────────────────────────────
const PROVIDER_BASES: Record<string, string> = {
  openai:     'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq:       'https://api.groq.com/openai/v1',
  deepseek:   'https://api.deepseek.com/v1',
}

// ── Modelos padrão por provider ───────────────────────────────────────────────
const DEFAULT_MODELS: Record<string, string> = {
  gemini:     'gemini-2.0-flash',
  openai:     'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  groq:       'llama-3.3-70b-versatile',
  deepseek:   'deepseek-chat',
  anthropic:  'claude-3-5-haiku-20241022',
}

// ── OpenAI-compatible call ────────────────────────────────────────────────────
async function callOpenAICompat(
  baseUrl:   string,
  model:     string,
  apiKey:    string,
  prompt:    string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${apiKey}`,
      'HTTP-Referer':  'https://forza-motos-app.vercel.app',
      'X-Title':       'Forza Motos Admin',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`${baseUrl} erro ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ── Gemini call ───────────────────────────────────────────────────────────────
async function callGemini(model: string, apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })
  if (!res.ok) throw new Error(`Gemini erro ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Anthropic call ────────────────────────────────────────────────────────────
async function callAnthropic(model: string, apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic erro ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

/**
 * Limpa a resposta da IA:
 *  - Remove blocos <think>…</think> (DeepSeek-R1, QwQ, etc.)
 *  - Remove markdown fences ```json … ```
 *  - Extrai o primeiro objeto JSON { … }
 */
export function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()

  // Remove blocos <think>
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // Extrai JSON bruto pelo primeiro { e último }
  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.substring(start, end + 1)
  }

  // Fallback: remove fences markdown
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  else if (cleaned.startsWith('```'))  cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)

  return cleaned.trim()
}

/**
 * Chama o provider de IA configurado.
 * Detecta automaticamente pelo env var disponível se provider não for passado.
 */
export async function callAI({ prompt, maxTokens = 2048, provider, modelo, apiKey: apiKeyOverride }: CallOptions): Promise<string> {
  const prov = (provider ?? '').toLowerCase().trim()

  // Helper: usa apiKey do frontend se fornecida, senão cai para env var
  const getKey = (envVar: string) => apiKeyOverride || process.env[envVar] || ''

  // ── Gemini ──────────────────────────────────────────────────────────────────
  if (prov === 'gemini' || (!prov && (apiKeyOverride || process.env.GEMINI_API_KEY))) {
    const key   = getKey('GEMINI_API_KEY')
    if (!key) throw new Error('GEMINI_API_KEY não configurada')
    const model = modelo || process.env.GEMINI_MODEL || DEFAULT_MODELS.gemini
    return callGemini(model, key, prompt, maxTokens)
  }

  // ── Anthropic ───────────────────────────────────────────────────────────────
  if (prov === 'anthropic') {
    const key = getKey('ANTHROPIC_API_KEY')
    if (!key) throw new Error('ANTHROPIC_API_KEY não configurada')
    const model = modelo || DEFAULT_MODELS.anthropic
    return callAnthropic(model, key, prompt, maxTokens)
  }

  // ── OpenRouter ──────────────────────────────────────────────────────────────
  if (prov === 'openrouter') {
    const key = getKey('OPENROUTER_API_KEY')
    if (!key) throw new Error('OPENROUTER_API_KEY não configurada')
    return callOpenAICompat(PROVIDER_BASES.openrouter, modelo || DEFAULT_MODELS.openrouter, key, prompt, maxTokens)
  }

  // ── Groq ────────────────────────────────────────────────────────────────────
  if (prov === 'groq') {
    const key = getKey('GROQ_API_KEY')
    if (!key) throw new Error('GROQ_API_KEY não configurada')
    return callOpenAICompat(PROVIDER_BASES.groq, modelo || DEFAULT_MODELS.groq, key, prompt, maxTokens)
  }

  // ── DeepSeek ────────────────────────────────────────────────────────────────
  if (prov === 'deepseek') {
    const key = getKey('DEEPSEEK_API_KEY')
    if (!key) throw new Error('DEEPSEEK_API_KEY não configurada')
    return callOpenAICompat(PROVIDER_BASES.deepseek, modelo || DEFAULT_MODELS.deepseek, key, prompt, maxTokens)
  }

  // ── OpenAI (default se OPENAI_API_KEY disponível) ──────────────────────────
  if (prov === 'openai' || (!prov && (apiKeyOverride || process.env.OPENAI_API_KEY))) {
    const key   = getKey('OPENAI_API_KEY')
    if (!key) throw new Error('OPENAI_API_KEY não configurada')
    const model = modelo || process.env.OPENAI_MODEL || DEFAULT_MODELS.openai
    return callOpenAICompat(PROVIDER_BASES.openai, model, key, prompt, maxTokens)
  }

  throw new Error('Nenhum provider de IA configurado. Adicione a API Key nas Configurações de IA ou nas variáveis de ambiente.')
}
