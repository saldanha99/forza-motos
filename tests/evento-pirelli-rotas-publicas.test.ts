import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ler = (caminho: string) => readFileSync(caminho, 'utf8')

test('evento separa landing, cadastro, experiências e ofertas em rotas próprias', () => {
  for (const caminho of [
    'app/evento-pirelli/cadastro/page.tsx',
    'app/evento-pirelli/quiz/page.tsx',
    'app/evento-pirelli/foto/page.tsx',
    'app/evento-pirelli/balanceamento/page.tsx',
    'app/evento-pirelli/ofertas/page.tsx',
  ]) assert.equal(existsSync(caminho), true, `${caminho} deve existir`)

  assert.match(ler('app/evento-pirelli/quiz/page.tsx'), /pagina="experiencia" acao="quiz"/)
  assert.match(ler('app/evento-pirelli/foto/page.tsx'), /redirect\('\/evento-pirelli'\)/)
  assert.match(ler('app/evento-pirelli/balanceamento/page.tsx'), /pagina="experiencia" acao="balanceamento"/)
  assert.match(ler('app/evento-pirelli/ofertas/page.tsx'), /pagina="ofertas"/)
})

test('landing funciona como menu e não incorpora mais cadastro ou painéis de ação', () => {
  const landing = ler('components/evento-pirelli/EventoPirelliLanding.tsx')

  assert.match(landing, /\/evento-pirelli\/cadastro\?acao=quiz/)
  assert.match(landing, /\/evento-pirelli\/cadastro\?acao=balanceamento/)
  assert.match(landing, /\/evento-pirelli\/cadastro\?acao=caneca/)
  assert.match(landing, /href="\/evento-pirelli\/ofertas"/)
  assert.doesNotMatch(landing, /desafio da foto/i)
  assert.doesNotMatch(landing, /acao=foto/)
  assert.doesNotMatch(landing, /#cadastro/)
  assert.doesNotMatch(landing, /painel ===/)
})

test('landing oferece cadastro, entrada por código e atalhos para acesso reconhecido', () => {
  const landing = ler('components/evento-pirelli/EventoPirelliLanding.tsx')

  assert.match(landing, /Fazer cadastro/)
  assert.match(landing, /Já tenho cadastro/)
  assert.match(landing, /href="\/evento-pirelli\/cadastro\?recuperar=1"/)
  assert.match(landing, /Você já está identificado/)
  assert.match(landing, /Acesso reconhecido neste aparelho/)
  assert.match(landing, /codigo \? '\/evento-pirelli\/quiz' : '\/evento-pirelli\/cadastro\?acao=quiz'/)
  assert.match(landing, /codigo \? '\/evento-pirelli\/balanceamento' : '\/evento-pirelli\/cadastro\?acao=balanceamento'/)
  assert.match(landing, /carregarEMigrarAcessoEventoPirelli\(localStorage\)/)
})

test('quiz só chama a API a partir do gesto explícito do participante', () => {
  const publico = ler('components/evento-pirelli/EventoPirelliLanding.tsx')

  assert.match(publico, /Iniciar tentativa oficial/)
  assert.match(publico, /O cronômetro oficial só começa quando você tocar no botão abaixo/)
  assert.match(publico, /onClick=\{\(\) => void carregarQuiz\(\)\}/)
  assert.match(publico, /quizCarregandoEmMemoria\.current/)
  assert.doesNotMatch(publico, /acaoAplicada/)
  assert.doesNotMatch(publico, /if \(acao === 'quiz'\) void carregarQuiz/)
})

test('links antigos passam por allowlist e seguem para as novas páginas', () => {
  const pagina = ler('app/evento-pirelli/page.tsx')

  assert.match(pagina, /new Set\(\['quiz', 'balanceamento', 'caneca'\]\)/)
  assert.doesNotMatch(pagina, /'foto'/)
  assert.match(pagina, /redirect\(`\/evento-pirelli\/cadastro\?\$\{destino\}`\)/)
  assert.match(pagina, /redirect\(`\/evento-pirelli\/ofertas/)
  assert.match(pagina, /if \(recuperar\) redirect\('\/evento-pirelli\/cadastro\?recuperar=1'\)/)
  assert.doesNotMatch(pagina, /redirect\(acao\)/)
})

test('catálogo só é consultado na página dedicada de ofertas', () => {
  const conteudo = ler('app/evento-pirelli/_components/ConteudoEventoPirelli.tsx')
  const principal = ler('app/evento-pirelli/page.tsx')

  assert.match(conteudo, /const produtosEvento = pagina === 'ofertas'/)
  assert.doesNotMatch(principal, /prisma\.product\.findMany/)
  assert.match(conteudo, /pagina === 'ofertas' \? <CartDrawer \/>/)
})
