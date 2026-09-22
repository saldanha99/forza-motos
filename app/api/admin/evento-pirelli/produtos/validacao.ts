import { z } from 'zod'

export const MAX_PAYLOAD_PRODUTO_EVENTO = 48 * 1024

export class ErroValidacaoProdutoEvento extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErroValidacaoProdutoEvento'
  }
}

const imagemSchema = z.string().trim().min(1).max(2048).refine(
  (valor) => valor.startsWith('/') || /^https:\/\//i.test(valor),
  'Use uma URL HTTPS ou um caminho interno para a imagem.',
)

export const camposProdutoEventoSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do produto.').max(180),
  sku: z.string().trim().min(2, 'Informe o SKU.').max(80)
    .regex(/^[A-Za-z0-9._/-]+$/, 'O SKU aceita apenas letras, números, ponto, hífen, barra e sublinhado.'),
  descricao: z.string().trim().min(10, 'Descreva o produto e a condição da pré-venda.').max(10_000),
  categoria: z.string().trim().min(2, 'Informe a categoria.').max(80),
  marca: z.string().trim().min(2, 'Informe a marca.').max(80),
  preco: z.number().finite().min(0.01).max(9_999_999.99),
  precoPromocional: z.number().finite().min(0.01).max(9_999_999.99),
  prazoEntregaDias: z.number().int().min(1).max(365),
  peso: z.number().finite().min(0.001).max(200),
  altura: z.number().finite().min(1).max(300),
  largura: z.number().finite().min(1).max(300),
  comprimento: z.number().finite().min(1).max(300),
  imagens: z.array(imagemSchema).max(12),
  ativo: z.boolean(),
  destaque: z.boolean(),
  ordemEvento: z.number().int().min(0).max(9_999),
  limitePorPedidoEvento: z.number().int().min(1).max(100),
}).strict()

export type EntradaProdutoEvento = z.infer<typeof camposProdutoEventoSchema>

export const patchProdutoEventoSchema = camposProdutoEventoSchema
  .partial()
  .refine((valor) => Object.keys(valor).length > 0, 'Nenhuma alteração foi informada.')

export function validarProdutoEventoCompleto(entrada: unknown): EntradaProdutoEvento {
  const produto = camposProdutoEventoSchema.parse(entrada)
  if (produto.precoPromocional >= produto.preco) {
    throw new ErroValidacaoProdutoEvento('O preço especial precisa ser menor que o preço normal.')
  }
  if (produto.ativo && produto.imagens.length === 0) {
    throw new ErroValidacaoProdutoEvento('Envie ao menos uma imagem antes de publicar o produto.')
  }
  return {
    ...produto,
    sku: produto.sku.toUpperCase(),
    imagens: Array.from(new Set(produto.imagens)),
  }
}

export async function lerJsonProdutoEvento(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ErroValidacaoProdutoEvento('Envie os dados no formato JSON.')
  }
  const tamanhoDeclarado = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > MAX_PAYLOAD_PRODUTO_EVENTO) {
    throw new ErroValidacaoProdutoEvento('Os dados do produto excedem o limite permitido.')
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).byteLength > MAX_PAYLOAD_PRODUTO_EVENTO) {
    throw new ErroValidacaoProdutoEvento('Os dados do produto excedem o limite permitido.')
  }
  try {
    return JSON.parse(texto)
  } catch {
    throw new ErroValidacaoProdutoEvento('Os dados enviados não são válidos.')
  }
}

export function mensagemErroValidacao(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Revise os campos do produto.'
  return error instanceof Error ? error.message : 'Não foi possível salvar o produto.'
}

export function ehErroValidacaoProdutoEvento(error: unknown) {
  return error instanceof z.ZodError || error instanceof ErroValidacaoProdutoEvento
}

export function serializarProdutoEvento(produto: any) {
  return {
    ...produto,
    preco: Number(produto.preco),
    precoPromocional: produto.precoPromocional == null ? null : Number(produto.precoPromocional),
    peso: produto.peso == null ? null : Number(produto.peso),
    altura: produto.altura == null ? null : Number(produto.altura),
    largura: produto.largura == null ? null : Number(produto.largura),
    comprimento: produto.comprimento == null ? null : Number(produto.comprimento),
    createdAt: produto.createdAt.toISOString(),
    updatedAt: produto.updatedAt.toISOString(),
  }
}
