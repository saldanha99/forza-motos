#!/usr/bin/env node
/**
 * scripts/verificar-painel.mjs
 *
 * Guarda estática de pré-deploy para duas classes de bug que já foram pra
 * produção com build e `tsc --noEmit` limpos:
 *
 *   1) Fronteira server/client: um Server Component importando um *valor*
 *      (não um tipo, não um componente) de um módulo `'use client'`. O
 *      Next devolve um proxy de referência em vez do dado — estoura em
 *      runtime (500), não na build. Ver `lib/admin/kanban.ts` pro caso real
 *      que já mordeu o dashboard.
 *
 *   2) `transition-all` e cor fixa dentro do painel admin. `transition-all`
 *      também transiciona custom properties (`--brand-*`); como elas não
 *      são registradas via `@property`, o Chrome congela o valor antigo na
 *      troca de tema em vez de interpolar. Cor fixa (hex, branco/preto,
 *      paleta padrão do Tailwind) quebra um dos dois temas porque não
 *      responde ao token `var(--brand-*)`.
 *
 * Node puro, ESM, sem dependência nova. Uso:
 *   node scripts/verificar-painel.mjs
 *   node scripts/verificar-painel.mjs --apenas-fronteira
 *   node scripts/verificar-painel.mjs --apenas-estilo
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ─────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const apenasFronteira = args.includes('--apenas-fronteira')
const apenasEstilo = args.includes('--apenas-estilo')
const rodarFronteira = !apenasEstilo
const rodarEstilo = !apenasFronteira

// ─────────────────────────────────────────────────────────────────────────
// Utilidades de arquivo
// ─────────────────────────────────────────────────────────────────────────

const IGNORAR_DIRS = new Set(['node_modules', '.next', '.git', '.turbo', 'dist', 'build'])

/** Varre um diretório recursivamente e devolve arquivos com as extensões dadas. */
function listarArquivos(dirAbs, extensoes) {
  const resultado = []
  if (!existsSync(dirAbs)) return resultado
  const pilha = [dirAbs]
  while (pilha.length) {
    const atual = pilha.pop()
    let entradas
    try {
      entradas = readdirSync(atual, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entrada of entradas) {
      if (IGNORAR_DIRS.has(entrada.name)) continue
      const caminho = join(atual, entrada.name)
      if (entrada.isDirectory()) {
        pilha.push(caminho)
      } else if (entrada.isFile() && extensoes.includes(extname(entrada.name))) {
        resultado.push(caminho)
      }
    }
  }
  return resultado
}

const cacheConteudo = new Map()
function lerArquivo(caminhoAbs) {
  if (cacheConteudo.has(caminhoAbs)) return cacheConteudo.get(caminhoAbs)
  let conteudo = null
  try {
    conteudo = readFileSync(caminhoAbs, 'utf8')
  } catch {
    conteudo = null
  }
  cacheConteudo.set(caminhoAbs, conteudo)
  return conteudo
}

function numeroDaLinha(conteudo, indice) {
  let n = 1
  for (let i = 0; i < indice && i < conteudo.length; i++) {
    if (conteudo[i] === '\n') n++
  }
  return n
}

function caminhoRelativo(caminhoAbs) {
  return relative(RAIZ, caminhoAbs).split('\\').join('/')
}

function trecho(texto, max = 140) {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  return limpo.length > max ? limpo.slice(0, max) + '…' : limpo
}

// ─────────────────────────────────────────────────────────────────────────
// CHECAGEM 1 — fronteira server/client (Bug 1)
// ─────────────────────────────────────────────────────────────────────────
//
// Heurística de nomes (documentada porque é uma heurística, não uma prova):
//   - Identificador em PascalCase (começa com MAIÚSCULA e tem pelo menos
//     uma letra minúscula em algum lugar, ex.: 'KpiCard', 'FadeIn') →
//     tratado como componente React. Importar um componente de um módulo
//     'use client' é o uso normal e legítimo (é a própria razão do módulo
//     existir).
//   - Identificador em SCREAMING_SNAKE_CASE (só maiúsculas/dígitos/`_`,
//     ex.: 'COLUNAS_PEDIDO', 'CONST_QUALQUER') ou camelCase (começa com
//     minúscula, ex.: 'algumaCoisa') → tratado como *valor* (constante,
//     função, hook etc.) e é proibido vir de um módulo client sem passar
//     por 'type'. Importante: SCREAMING_SNAKE_CASE também começa com letra
//     MAIÚSCULA — checar só o primeiro caractere não basta (foi exatamente
//     o bug que estourou em produção com 'COLUNAS_PEDIDO'). Por isso a
//     regra exige uma letra minúscula em algum lugar do identificador para
//     considerá-lo PascalCase.
//   - `import type { X }` e specifiers individuais `type X` sempre passam:
//     tipos são apagados na compilação, não cruzam a fronteira em runtime.
//
// É heurística de convenção de nome, não análise semântica — um valor que
// por acidente siga a convenção PascalCase (foge de toda convenção do
// projeto) passaria batido. Aceitável para o custo/benefício de um guard
// estático sem dependências novas.

function pareceComponenteReact(identificador) {
  return /^[A-Z]/.test(identificador) && /[a-z]/.test(identificador)
}

function primeiraDiretiva(conteudo) {
  let i = 0
  const n = conteudo.length
  for (;;) {
    while (i < n && /\s/.test(conteudo[i])) i++
    if (conteudo[i] === '/' && conteudo[i + 1] === '/') {
      const quebra = conteudo.indexOf('\n', i)
      i = quebra === -1 ? n : quebra + 1
      continue
    }
    if (conteudo[i] === '/' && conteudo[i + 1] === '*') {
      const fim = conteudo.indexOf('*/', i + 2)
      i = fim === -1 ? n : fim + 2
      continue
    }
    break
  }
  return /^['"]use client['"]/.test(conteudo.slice(i, i + 20))
}

const EXTENSOES_RESOLVER = ['', '.tsx', '.ts', '.jsx', '.js']

function resolverModuloLocal(especificador, arquivoOrigemAbs) {
  let base
  if (especificador.startsWith('@/')) {
    base = join(RAIZ, especificador.slice(2))
  } else if (especificador.startsWith('.')) {
    base = resolve(dirname(arquivoOrigemAbs), especificador)
  } else {
    return null // pacote de node_modules — fora do escopo desta checagem
  }

  for (const ext of EXTENSOES_RESOLVER) {
    const candidato = base + ext
    if (existsSync(candidato) && statSync(candidato).isFile()) return candidato
  }
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    const candidato = join(base, 'index' + ext)
    if (existsSync(candidato) && statSync(candidato).isFile()) return candidato
  }
  return null
}

const REGEX_IMPORT = /import\s+(type\s+)?([\s\S]*?)\s+from\s+(['"])([^'"]+)\3/g

function extrairNomedosImports(clausula) {
  const m = clausula.match(/\{([\s\S]*?)\}/)
  if (!m) return []
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function checarFronteira() {
  const violacoes = []
  const arquivosApp = listarArquivos(join(RAIZ, 'app'), ['.ts', '.tsx'])

  for (const arquivoAbs of arquivosApp) {
    const conteudo = lerArquivo(arquivoAbs)
    if (conteudo == null) continue
    if (primeiraDiretiva(conteudo)) continue // o próprio arquivo é 'use client' — fora do escopo

    REGEX_IMPORT.lastIndex = 0
    let m
    while ((m = REGEX_IMPORT.exec(conteudo))) {
      const importEhTypeOnly = Boolean(m[1])
      if (importEhTypeOnly) continue

      const clausula = m[2]
      const especificador = m[4]

      const alvoAbs = resolverModuloLocal(especificador, arquivoAbs)
      if (!alvoAbs) continue

      const conteudoAlvo = lerArquivo(alvoAbs)
      if (conteudoAlvo == null) continue
      if (!primeiraDiretiva(conteudoAlvo)) continue // alvo não é módulo client

      const nomeados = extrairNomedosImports(clausula)
      for (const especEntry of nomeados) {
        if (/^type\s+/.test(especEntry)) continue // specifier individual `type X`

        const asMatch = especEntry.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/)
        if (!asMatch) continue // sintaxe inesperada — não arrisca falso positivo
        const local = asMatch[2] || asMatch[1]

        if (pareceComponenteReact(local)) continue // convenção de componente — passa

        violacoes.push({
          arquivo: caminhoRelativo(arquivoAbs),
          linha: numeroDaLinha(conteudo, m.index),
          trecho: trecho(m[0]),
          mensagem:
            `'${local}' não segue a convenção de nome PascalCase de componente React ` +
            `(precisa começar com maiúscula E ter alguma letra minúscula) — é tratado ` +
            `como valor importado do módulo 'use client' '${caminhoRelativo(alvoAbs)}'. ` +
            `Em Server Component isso vira um proxy de referência, não o dado — só ` +
            `'import type' ou o próprio componente React atravessam essa fronteira em ` +
            `segurança. Mova a constante/função para um módulo sem 'use client'.`,
        })
      }
    }
  }

  return violacoes
}

// ─────────────────────────────────────────────────────────────────────────
// CHECAGEM 2 — transition-all / cor fixa no painel (Bug 2)
// ─────────────────────────────────────────────────────────────────────────

const DIRS_ESTILO = [join(RAIZ, 'app', '(admin)'), join(RAIZ, 'components', 'admin')]
const ARQUIVOS_ESTILO_EXTRA = [
  join(RAIZ, 'components', 'glossario', 'GerarTermoForm.tsx'),
  join(RAIZ, 'components', 'glossario', 'ImportarCSVForm.tsx'),
  join(RAIZ, 'components', 'glossario', 'ModeloSelector.tsx'),
]

const PREFIXOS_UTILITARIO =
  '(?:bg|text|border|ring|divide|outline|decoration|placeholder|caret|accent|from|via|to|fill|stroke|shadow)'
const CORES_PALETA_TAILWIND =
  '(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'

const PADROES = [
  {
    id: 'transition-all',
    regex: /\btransition-all\b/g,
    descricao: (t) =>
      `'${t}' transiciona também custom properties (--brand-*), que não são registradas via @property — congela a cor antiga na troca de tema. Use 'transition' (lista propriedades explícitas) ou 'transition-colors'/'transition-transform'.`,
  },
  {
    id: 'cor-fixa-branco-preto',
    regex: new RegExp(`\\b${PREFIXOS_UTILITARIO}-(?:white|black)\\b(?:/\\d{1,3})?`, 'g'),
    descricao: (t) =>
      `'${t}' é uma cor fixa (não usa var(--brand-*)) — quebra um dos dois temas do painel. Use o token de tema equivalente (ex.: brand-surface, brand-text, brand-border).`,
  },
  {
    id: 'admin-glass',
    regex: /\badmin-glass\b/g,
    descricao: (t) => `classe '${t}' encontrada — confirme que não reintroduz cor/efeito fixo fora dos tokens de tema do painel.`,
  },
  {
    id: 'dark-variant',
    regex: /\bdark:/g,
    descricao: () =>
      `variante 'dark:' do Tailwind não faz sentido no painel: o tema claro/escuro do admin é dirigido por '[data-admin-theme]' + tokens 'var(--brand-*)', não pela classe '.dark' do Tailwind. Use o token correspondente em vez de duplicar a cor por variante.`,
  },
  {
    id: 'hex-color',
    regex: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g,
    descricao: (t) => `cor hexadecimal fixa ('${t}') — não responde à troca de tema. Use um token 'brand-*' (ver app/globals.css e tailwind.config.ts).`,
  },
  {
    id: 'paleta-tailwind',
    regex: new RegExp(`\\b${PREFIXOS_UTILITARIO}-${CORES_PALETA_TAILWIND}-\\d{2,3}\\b(?:/\\d{1,3})?`, 'g'),
    descricao: (t) => `'${t}' usa a paleta padrão do Tailwind (cor fixa, sem var()) — quebra um dos dois temas. Use o token 'brand-*' equivalente.`,
  },
]

// Exceções legítimas verificadas no código (não são falsos positivos do
// script — são casos reais em que a cor precisa mesmo ser fixa):
//
//  - components/admin/WhatsAppConnect.tsx:272 e
//    components/admin/WhatsAppQRCard.tsx:178 usam 'bg-white' (sem opacidade)
//    no contêiner do QR Code do WhatsApp. Ambos têm comentário explicando:
//    a câmera do celular precisa de contraste fixo preto-sobre-branco pra
//    ler o código — isso não muda com o tema, de propósito.
const EXCECOES_ESTILO = [
  {
    arquivoRelativo: 'components/admin/WhatsAppConnect.tsx',
    padraoId: 'cor-fixa-branco-preto',
    textoExato: 'bg-white',
  },
  {
    arquivoRelativo: 'components/admin/WhatsAppQRCard.tsx',
    padraoId: 'cor-fixa-branco-preto',
    textoExato: 'bg-white',
  },
]

function ehExcecao(arquivoRelativo, padraoId, textoExato) {
  return EXCECOES_ESTILO.some(
    (e) => e.arquivoRelativo === arquivoRelativo && e.padraoId === padraoId && e.textoExato === textoExato
  )
}

/**
 * Marca (com 1) as regiões do arquivo que são comentário (// ou bloco /* *​/),
 * para não acusar um padrão que só aparece dentro de texto explicativo
 * (ex.: um comentário que menciona a palavra `dark:`). Strings e template
 * literals são preservadas como código normal, porque é exatamente onde as
 * classes do Tailwind moram.
 */
function construirMascaraComentarios(conteudo) {
  const mascara = new Uint8Array(conteudo.length)
  let i = 0
  const n = conteudo.length
  let emString = null
  while (i < n) {
    const c = conteudo[i]
    if (emString) {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === emString) {
        emString = null
      }
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      emString = c
      i++
      continue
    }
    if (c === '/' && conteudo[i + 1] === '/') {
      const inicio = i
      while (i < n && conteudo[i] !== '\n') i++
      mascara.fill(1, inicio, i)
      continue
    }
    if (c === '/' && conteudo[i + 1] === '*') {
      const inicio = i
      const fim = conteudo.indexOf('*/', i + 2)
      const ate = fim === -1 ? n : fim + 2
      mascara.fill(1, inicio, ate)
      i = ate
      continue
    }
    i++
  }
  return mascara
}

function checarEstilo() {
  const violacoes = []
  const arquivos = new Set([
    ...DIRS_ESTILO.flatMap((d) => listarArquivos(d, ['.ts', '.tsx'])),
    ...ARQUIVOS_ESTILO_EXTRA.filter((f) => existsSync(f)),
  ])

  for (const arquivoAbs of arquivos) {
    const conteudo = lerArquivo(arquivoAbs)
    if (conteudo == null) continue
    const mascaraComentario = construirMascaraComentarios(conteudo)
    const arquivoRel = caminhoRelativo(arquivoAbs)

    for (const padrao of PADROES) {
      padrao.regex.lastIndex = 0
      let m
      while ((m = padrao.regex.exec(conteudo))) {
        if (mascaraComentario[m.index] === 1) continue // dentro de comentário — ignora

        const textoEncontrado = m[0]
        if (ehExcecao(arquivoRel, padrao.id, textoEncontrado)) continue

        violacoes.push({
          arquivo: arquivoRel,
          linha: numeroDaLinha(conteudo, m.index),
          trecho: trecho(conteudo.slice(Math.max(0, m.index - 40), m.index + textoEncontrado.length + 40)),
          mensagem: padrao.descricao(textoEncontrado),
        })
      }
    }
  }

  return violacoes.sort((a, b) => a.arquivo.localeCompare(b.arquivo) || a.linha - b.linha)
}

// ─────────────────────────────────────────────────────────────────────────
// Execução + relatório
// ─────────────────────────────────────────────────────────────────────────

function imprimirBloco(titulo, heuristica, violacoes) {
  console.log(`\n=== ${titulo} ===`)
  if (heuristica) console.log(heuristica + '\n')
  if (violacoes.length === 0) {
    console.log('Nenhuma violação encontrada.')
    return
  }
  for (const v of violacoes) {
    console.log(`\n${v.arquivo}:${v.linha}`)
    console.log(`  trecho: ${v.trecho}`)
    console.log(`  ${v.mensagem}`)
  }
}

let violacoesFronteira = []
let violacoesEstilo = []

if (rodarFronteira) {
  violacoesFronteira = checarFronteira()
  imprimirBloco(
    'Checagem 1 — fronteira server/client (Bug 1)',
    "Heurística de nome: PascalCase (maiúscula inicial + alguma minúscula, ex.: KpiCard) = " +
      "componente React (passa); SCREAMING_SNAKE_CASE ou camelCase (ex.: COLUNAS_PEDIDO, algumaCoisa) = " +
      "valor, proibido vir de módulo 'use client' sem 'type'.",
    violacoesFronteira
  )
}

if (rodarEstilo) {
  violacoesEstilo = checarEstilo()
  imprimirBloco(
    'Checagem 2 — transition-all / cor fixa no painel (Bug 2)',
    'Procura transition-all, bg/text/border-white|black (fixos), admin-glass, dark:, hex de cor e ' +
      'classes da paleta padrão do Tailwind em app/(admin), components/admin e nos 3 arquivos admin-only de components/glossario.',
    violacoesEstilo
  )
}

const total = violacoesFronteira.length + violacoesEstilo.length
console.log('')
if (total === 0) {
  const partes = []
  if (rodarFronteira) partes.push('fronteira')
  if (rodarEstilo) partes.push('estilo')
  console.log(`✓ verificar-painel: limpo (${partes.join(' + ')} ok).`)
  process.exit(0)
} else {
  console.log(
    `✗ verificar-painel: ${violacoesFronteira.length} violação(ões) de fronteira, ${violacoesEstilo.length} de estilo. Corrija antes de fazer deploy.`
  )
  process.exit(1)
}
