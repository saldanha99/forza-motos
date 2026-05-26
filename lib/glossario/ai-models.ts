/**
 * Catálogo de modelos de IA disponíveis para gerar glossário.
 *
 * Inspirado no seletor de modelo do plugin Glossário Ninja, mas com preços
 * reais por 1M tokens para você escolher conscientemente e economizar.
 *
 * ⚠️ Preços em USD por 1M tokens (atualizados em 2026-05).
 * Verifique sempre antes de processar lotes grandes:
 *   - Gemini: https://ai.google.dev/pricing
 *   - OpenAI: https://platform.openai.com/docs/pricing
 *
 * Para adicionar um novo modelo, basta acrescentar ao array AI_MODELS.
 * A validação automática garante que apenas modelos do catálogo sejam usados.
 */

export type AIProvider = 'gemini' | 'openai'
export type CostTier = 'economico' | 'medio' | 'premium'
export type SpeedTier = 'rapido' | 'medio' | 'lento'
export type QualityTier = 'basica' | 'boa' | 'excelente'

export interface AIModel {
  /** ID enviado para a API do provedor. Ex: "gemini-2.0-flash" */
  id: string
  provider: AIProvider
  /** Nome exibido na UI. Ex: "Gemini 2.0 Flash" */
  label: string
  /** Descrição curta para o usuário escolher */
  description: string
  /** Preço por 1M de tokens (USD) */
  pricing: {
    inputPer1M: number
    outputPer1M: number
  }
  /** Janela de contexto em tokens */
  contextWindow: number
  /** Tokens máximos de saída por request */
  maxOutputTokens: number
  speed: SpeedTier
  quality: QualityTier
  costTier: CostTier
  /** Marca true para destacar como recomendado para uso geral (custo×benefício) */
  recommended?: boolean
  /** Marca true para legado/depreciado (manter por compatibilidade) */
  legacy?: boolean
  /** Use case ideal */
  ideal: string
}

// ============================================================
// CATÁLOGO — atualize aqui ao surgirem novos modelos
// ============================================================

export const AI_MODELS: AIModel[] = [
  // ----- GEMINI (geralmente mais barato) -----
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    label: 'Gemini 2.0 Flash',
    description: 'Rápido, barato e ótima qualidade para textos curtos/médios.',
    pricing: { inputPer1M: 0.1, outputPer1M: 0.4 },
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    speed: 'rapido',
    quality: 'boa',
    costTier: 'economico',
    recommended: true,
    ideal: 'Geração em massa de glossário (centenas/milhares de termos)',
  },
  {
    id: 'gemini-2.0-flash-lite',
    provider: 'gemini',
    label: 'Gemini 2.0 Flash Lite',
    description: 'Variante ainda mais barata do Flash. Boa para textos simples.',
    pricing: { inputPer1M: 0.075, outputPer1M: 0.3 },
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    speed: 'rapido',
    quality: 'basica',
    costTier: 'economico',
    ideal: 'Glossários técnicos curtos onde qualidade não é crítica',
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    label: 'Gemini 2.5 Flash',
    description: 'Geração seguinte do Flash com melhor raciocínio.',
    pricing: { inputPer1M: 0.3, outputPer1M: 2.5 },
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    speed: 'rapido',
    quality: 'excelente',
    costTier: 'medio',
    ideal: 'Conteúdo com raciocínio técnico (motor, química do óleo, etc)',
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    label: 'Gemini 2.5 Pro',
    description: 'Top de linha do Google. Melhor para textos longos e SEO-pesados.',
    pricing: { inputPer1M: 1.25, outputPer1M: 10.0 },
    contextWindow: 2_097_152,
    maxOutputTokens: 65_536,
    speed: 'medio',
    quality: 'excelente',
    costTier: 'premium',
    ideal: 'Conteúdo pilar / artigos de blog longos (3000+ palavras)',
  },
  {
    id: 'gemini-1.5-flash',
    provider: 'gemini',
    label: 'Gemini 1.5 Flash',
    description: 'Geração anterior. Mantido para compatibilidade.',
    pricing: { inputPer1M: 0.075, outputPer1M: 0.3 },
    contextWindow: 1_048_576,
    maxOutputTokens: 8192,
    speed: 'rapido',
    quality: 'boa',
    costTier: 'economico',
    legacy: true,
    ideal: 'Projetos legados',
  },

  // ----- OPENAI (mais caro, mas familiar) -----
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o Mini',
    description: 'Versão econômica do GPT-4o. Boa qualidade por preço baixo.',
    pricing: { inputPer1M: 0.15, outputPer1M: 0.6 },
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    speed: 'rapido',
    quality: 'boa',
    costTier: 'economico',
    recommended: true,
    ideal: 'Alternativa OpenAI ao Gemini Flash — geração em massa',
  },
  {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    label: 'GPT-4.1 Mini',
    description: 'Sucessor do 4o-mini, melhor seguimento de instruções.',
    pricing: { inputPer1M: 0.4, outputPer1M: 1.6 },
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    speed: 'rapido',
    quality: 'boa',
    costTier: 'medio',
    ideal: 'Conteúdo que exige seguir prompts complexos com muitas regras',
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o',
    description: 'Modelo flagship multimodal da OpenAI.',
    pricing: { inputPer1M: 2.5, outputPer1M: 10.0 },
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    speed: 'medio',
    quality: 'excelente',
    costTier: 'premium',
    ideal: 'Quando qualidade > custo, ex: páginas pilares do site',
  },
  {
    id: 'gpt-4.1',
    provider: 'openai',
    label: 'GPT-4.1',
    description: 'Premium da OpenAI para tarefas complexas de redação.',
    pricing: { inputPer1M: 2.0, outputPer1M: 8.0 },
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    speed: 'medio',
    quality: 'excelente',
    costTier: 'premium',
    ideal: 'Glossário técnico avançado, textos longos com várias seções',
  },
  {
    id: 'gpt-3.5-turbo',
    provider: 'openai',
    label: 'GPT-3.5 Turbo',
    description: 'Legado. Mantido por compatibilidade com plugins antigos.',
    pricing: { inputPer1M: 0.5, outputPer1M: 1.5 },
    contextWindow: 16_385,
    maxOutputTokens: 4096,
    speed: 'rapido',
    quality: 'basica',
    costTier: 'economico',
    legacy: true,
    ideal: 'Compatibilidade com Glossário Ninja antigo',
  },
]

// ============================================================
// Utilitários públicos
// ============================================================

export function listarModelos(opcoes: {
  provider?: AIProvider
  incluirLegacy?: boolean
} = {}): AIModel[] {
  const { provider, incluirLegacy = false } = opcoes
  return AI_MODELS.filter((m) => {
    if (provider && m.provider !== provider) return false
    if (!incluirLegacy && m.legacy) return false
    return true
  })
}

export function obterModelo(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id)
}

export function modeloExiste(id: string): boolean {
  return AI_MODELS.some((m) => m.id === id)
}

export function modeloRecomendado(provider: AIProvider): AIModel {
  return (
    AI_MODELS.find((m) => m.provider === provider && m.recommended) ||
    AI_MODELS.find((m) => m.provider === provider)!
  )
}

// ============================================================
// Estimativa de custo
// ============================================================

export interface EstimativaCustoInput {
  modeloId: string
  /** Número de termos a gerar */
  quantidade: number
  /** Tokens médios estimados de entrada por termo (prompt + contexto). Default: 350 */
  inputTokensPorTermo?: number
  /** Tokens médios estimados de saída por termo. Default: 1800 (~1000 palavras) */
  outputTokensPorTermo?: number
}

export interface EstimativaCustoResult {
  modelo: AIModel
  quantidade: number
  custoEntradaUSD: number
  custoSaidaUSD: number
  custoTotalUSD: number
  custoTotalBRL: number
  custoPorTermoUSD: number
  custoPorTermoBRL: number
  /** Cotação USD→BRL usada no cálculo */
  cotacaoUSD: number
}

/**
 * Estima custo aproximado de gerar N termos com um modelo específico.
 * Útil para mostrar preview ANTES do usuário enfileirar 500 termos.
 *
 * Cotação USD padrão = 5.50. Para precisão maior, busque cotação live
 * de uma API externa e passe via `cotacaoUSD`.
 */
export function estimarCusto(
  input: EstimativaCustoInput,
  cotacaoUSD = 5.5
): EstimativaCustoResult {
  const modelo = obterModelo(input.modeloId)
  if (!modelo) {
    throw new Error(`Modelo desconhecido: ${input.modeloId}`)
  }

  const inputTokens = (input.inputTokensPorTermo ?? 350) * input.quantidade
  const outputTokens = (input.outputTokensPorTermo ?? 1800) * input.quantidade

  const custoEntradaUSD = (inputTokens / 1_000_000) * modelo.pricing.inputPer1M
  const custoSaidaUSD = (outputTokens / 1_000_000) * modelo.pricing.outputPer1M
  const custoTotalUSD = custoEntradaUSD + custoSaidaUSD

  return {
    modelo,
    quantidade: input.quantidade,
    custoEntradaUSD,
    custoSaidaUSD,
    custoTotalUSD,
    custoTotalBRL: custoTotalUSD * cotacaoUSD,
    custoPorTermoUSD: custoTotalUSD / input.quantidade,
    custoPorTermoBRL: (custoTotalUSD / input.quantidade) * cotacaoUSD,
    cotacaoUSD,
  }
}

/**
 * Compara o custo de gerar a mesma quantidade de termos em vários modelos.
 * Retorna ordenado do mais barato ao mais caro.
 */
export function compararCustos(
  quantidade: number,
  cotacaoUSD = 5.5
): EstimativaCustoResult[] {
  return listarModelos({ incluirLegacy: false })
    .map((m) => estimarCusto({ modeloId: m.id, quantidade }, cotacaoUSD))
    .sort((a, b) => a.custoTotalUSD - b.custoTotalUSD)
}
