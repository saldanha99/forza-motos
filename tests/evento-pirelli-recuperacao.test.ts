import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  mensagemEventoPirelliIndisponivel,
  normalizarWhatsappEvento,
  whatsappEventoValido,
} from '../lib/evento-pirelli'
import {
  CODIGO_RECUPERACAO,
  deveManterCodigoRecuperacao,
  DURACAO_CODIGO_RECUPERACAO_MS,
  expiracaoCodigoRecuperacao,
  entregarCodigoRecuperacaoNosCanais,
  hashCodigoRecuperacao,
  identificadorRecuperacao,
  mensagemCodigoRecuperacao,
  normalizarEmailRecuperacao,
  novoCodigoRecuperacao,
} from '../lib/evento-pirelli/recuperacao'
import { htmlCodigoRecuperacaoEventoPirelli } from '../lib/email/templates'
import {
  carregarEMigrarAcessoEventoPirelli,
  limparAcessoLocalEventoPirelli,
  salvarAcessoRecuperadoEventoPirelli,
  STORAGE_EVENTO_PIRELLI,
} from '../lib/evento-pirelli/storage'

class MemoriaStorage {
  private readonly itens = new Map<string, string>()

  getItem(chave: string) { return this.itens.get(chave) ?? null }
  setItem(chave: string, valor: string) { this.itens.set(chave, valor) }
  removeItem(chave: string) { this.itens.delete(chave) }
}

test('migra cadastro, QR e idempotência v1 para v2 sem copiar campos desconhecidos', () => {
  const storage = new MemoriaStorage()
  const qr = 'A'.repeat(32)
  const chave = 'legacy-submission-key-123456'
  storage.setItem('forza-evento-pirelli-cadastro-v1', JSON.stringify({
    nomeCompleto: 'Maria Teste',
    whatsapp: '(19) 99999-1234',
    email: 'maria@example.com',
    nomeGravacao: 'NÃO COPIAR',
    consentimentoMarketing: true,
    campoInjetado: '<script>',
  }))
  storage.setItem('forza-evento-pirelli-qr-v1', qr)
  storage.setItem('forza-evento-pirelli-submissao-v1', chave)

  const acesso = carregarEMigrarAcessoEventoPirelli(storage as unknown as Storage)
  assert.equal(acesso.codigoQr, qr)
  assert.equal(acesso.chaveSubmissao, chave)
  assert.equal(acesso.cadastro.nomeCompleto, 'Maria Teste')
  assert.equal('nomeGravacao' in acesso.cadastro, false)
  assert.equal('campoInjetado' in acesso.cadastro, false)
  assert.equal(storage.getItem(STORAGE_EVENTO_PIRELLI.codigoQr), qr)
  assert.equal(storage.getItem(STORAGE_EVENTO_PIRELLI.chaveSubmissao), chave)
})

test('dados v2 prevalecem sobre v1 e a recuperação preserva o formulário atual', () => {
  const storage = new MemoriaStorage()
  storage.setItem('forza-evento-pirelli-cadastro-v1', JSON.stringify({ nomeCompleto: 'Nome antigo', whatsapp: '19999999999' }))
  storage.setItem(STORAGE_EVENTO_PIRELLI.cadastro, JSON.stringify({ nomeCompleto: 'Nome atual', enderecoCidade: 'Sorocaba' }))

  const acesso = carregarEMigrarAcessoEventoPirelli(storage as unknown as Storage)
  assert.equal(acesso.cadastro.nomeCompleto, 'Nome atual')
  assert.equal(acesso.cadastro.whatsapp, '19999999999')

  const atualizado = salvarAcessoRecuperadoEventoPirelli(storage as unknown as Storage, {
    codigoQr: 'B'.repeat(32),
    nomeCompleto: 'Nome confirmado',
    whatsapp: '5519999991234',
    email: 'confirmado@example.com',
  })
  assert.equal(atualizado.enderecoCidade, 'Sorocaba')
  assert.equal(atualizado.nomeCompleto, 'Nome confirmado')
  assert.equal(storage.getItem(STORAGE_EVENTO_PIRELLI.codigoQr), 'B'.repeat(32))
})

test('troca de participante limpa somente o acesso local novo e legado', () => {
  const storage = new MemoriaStorage()
  for (const chave of [
    ...Object.values(STORAGE_EVENTO_PIRELLI),
    'forza-evento-pirelli-cadastro-v1',
    'forza-evento-pirelli-submissao-v1',
    'forza-evento-pirelli-qr-v1',
  ]) storage.setItem(chave, 'dado-local')

  limparAcessoLocalEventoPirelli(storage)

  for (const chave of [
    ...Object.values(STORAGE_EVENTO_PIRELLI),
    'forza-evento-pirelli-cadastro-v1',
    'forza-evento-pirelli-submissao-v1',
    'forza-evento-pirelli-qr-v1',
  ]) assert.equal(storage.getItem(chave), null)
})

test('WhatsApp do evento aceita celular brasileiro real e rejeita fixo, DDD inválido e repetição', () => {
  assert.equal(normalizarWhatsappEvento('(19) 98765-4321'), '5519987654321')
  assert.equal(whatsappEventoValido('(19) 98765-4321'), true)
  assert.equal(whatsappEventoValido('5511987654321'), true)
  assert.equal(whatsappEventoValido('(00) 98765-4321'), false)
  assert.equal(whatsappEventoValido('(20) 98765-4321'), false)
  assert.equal(whatsappEventoValido('(19) 3876-5432'), false)
  assert.equal(whatsappEventoValido('(19) 99999-9999'), false)
  assert.equal(whatsappEventoValido('1419987654321'), false)
})

test('código de recuperação tem seis dígitos, hash contextual e validade curta', () => {
  for (let indice = 0; indice < 20; indice += 1) {
    assert.match(novoCodigoRecuperacao(), CODIGO_RECUPERACAO)
  }
  const identificadorA = identificadorRecuperacao('evento-a', '5519987654321')
  const identificadorB = identificadorRecuperacao('evento-b', '5519987654321')
  const segredo = 'segredo-de-teste-com-mais-de-24-caracteres'
  assert.notEqual(identificadorA, identificadorB)
  assert.notEqual(
    hashCodigoRecuperacao(identificadorA, '123456', segredo),
    hashCodigoRecuperacao(identificadorA, '654321', segredo),
  )
  assert.notEqual(
    hashCodigoRecuperacao(identificadorA, '123456', segredo),
    hashCodigoRecuperacao(identificadorB, '123456', segredo),
  )
  const agora = new Date('2026-08-22T12:00:00.000Z')
  assert.equal(expiracaoCodigoRecuperacao(agora).getTime() - agora.getTime(), DURACAO_CODIGO_RECUPERACAO_MS)
})

test('o mesmo OTP é enviado em paralelo por WhatsApp e e-mail sem acoplar as falhas', async () => {
  const iniciados: string[] = []
  const entradas: Array<{ canal: string; codigo: string }> = []
  let liberarWhatsapp!: () => void
  let liberarEmail!: () => void
  const whatsappPendente = new Promise<void>((resolve) => { liberarWhatsapp = resolve })
  const emailPendente = new Promise<void>((resolve) => { liberarEmail = resolve })

  const entregaPendente = entregarCodigoRecuperacaoNosCanais({
    whatsapp: '5519987654321',
    email: ' Pessoa@Example.com ',
    codigo: '123456',
  }, {
    enviarWhatsapp: async ({ codigo }) => {
      iniciados.push('whatsapp')
      entradas.push({ canal: 'whatsapp', codigo })
      await whatsappPendente
      return { ok: false }
    },
    enviarEmail: async ({ email, codigo }) => {
      iniciados.push('email')
      entradas.push({ canal: email, codigo })
      await emailPendente
      return { enviado: true }
    },
  })

  await Promise.resolve()
  assert.deepEqual(iniciados.sort(), ['email', 'whatsapp'])
  liberarWhatsapp()
  liberarEmail()
  const entrega = await entregaPendente
  assert.deepEqual(entradas.map(({ codigo }) => codigo), ['123456', '123456'])
  assert.equal(entrega.whatsappEntregue, false)
  assert.equal(entrega.emailEntregue, true)
  assert.equal(entrega.algumCanalEntregue, true)
})

test('exceção de um provedor não invalida a confirmação do outro', async () => {
  const entrega = await entregarCodigoRecuperacaoNosCanais({
    whatsapp: '5519987654321',
    email: 'pessoa@example.com',
    codigo: '654321',
  }, {
    enviarWhatsapp: async () => { throw new Error('falha simulada sem PII') },
    enviarEmail: async () => ({ enviado: true }),
  })
  assert.equal(entrega.algumCanalEntregue, true)
})

test('OTP permanece com ao menos um canal confirmado e é apagável só se ambos falham', () => {
  assert.equal(deveManterCodigoRecuperacao(true, false), true)
  assert.equal(deveManterCodigoRecuperacao(false, true), true)
  assert.equal(deveManterCodigoRecuperacao(true, true), true)
  assert.equal(deveManterCodigoRecuperacao(false, false), false)
})

test('e-mail de recuperação usa o mesmo código e não aceita conteúdo injetado', () => {
  assert.equal(normalizarEmailRecuperacao(' Pessoa@Example.com '), 'pessoa@example.com')
  assert.equal(normalizarEmailRecuperacao('sem-email'), null)
  assert.match(mensagemCodigoRecuperacao('123456'), /123456/)
  assert.match(htmlCodigoRecuperacaoEventoPirelli('123456'), /123456/)
  assert.throws(() => htmlCodigoRecuperacaoEventoPirelli('<script>'))
})

test('mensagem temporal diferencia evento futuro, encerrado e indisponível', () => {
  const agora = new Date('2026-08-22T12:00:00.000Z')
  assert.equal(mensagemEventoPirelliIndisponivel({ dataInicio: new Date('2026-09-05T12:00:00.000Z'), dataFim: null }, agora), 'Este evento ainda não está disponível.')
  assert.equal(mensagemEventoPirelliIndisponivel({ dataInicio: null, dataFim: new Date('2026-08-21T12:00:00.000Z') }, agora), 'Este evento já foi encerrado.')
  assert.equal(mensagemEventoPirelliIndisponivel({ dataInicio: null, dataFim: null }, agora), 'Este evento não está disponível.')
})

test('rota de recuperação não enumera cadastro e consome OTP de forma atômica', () => {
  const rota = readFileSync('app/api/evento-pirelli/recuperacao/route.ts', 'utf8')
  assert.match(rota, /RESPOSTA_NEUTRA/)
  assert.match(rota, /status: 202/)
  assert.match(rota, /consumirLimiteRecuperacao\(escopoIp/)
  assert.match(rota, /consumirLimiteRecuperacao\(escopoWhatsapp/)
  assert.match(rota, /pg_advisory_xact_lock/)
  assert.match(rota, /deleteMany\(\{ where: \{ identifier: identificador \} \}\)[\s\S]*verificationToken\.create/)
  assert.match(rota, /after\(\(\) => prepararEEntregarCodigo\(whatsapp\)\)/)
  assert.match(rota, /entregarCodigoRecuperacaoNosCanais/)
  assert.match(rota, /enviarEmailRecuperacaoEventoPirelli/)
  assert.match(rota, /if \(!entrega\.algumCanalEntregue\)[\s\S]*verificationToken\.deleteMany/)
  assert.match(rota, /quando disponíveis/)
  assert.match(rota, /return NextResponse\.json\(\{ ok: true, message: RESPOSTA_NEUTRA \}/)
  assert.doesNotMatch(rota, /return NextResponse\.json\(\{ ok: true, message: RESPOSTA_NEUTRA,[\s\S]{0,120}(email|whatsappEntregue|emailEntregue)/)
  assert.match(rota, /verificationToken\.deleteMany\(\{[\s\S]*expires: \{ gt: new Date\(\) \}/)
  assert.doesNotMatch(rota, /findUnique\([\s\S]{0,240}codigoQr[\s\S]{0,240}solicitarCodigo/)
})

test('foto sai da experiência pública e os dois clientes usam a migração compartilhada', () => {
  const landing = readFileSync('components/evento-pirelli/EventoPirelliLanding.tsx', 'utf8')
  const caneca = readFileSync('components/evento-pirelli/CheckoutCanecaEventoPirelli.tsx', 'utf8')
  const pagina = readFileSync('app/evento-pirelli/page.tsx', 'utf8')
  const paginaFoto = readFileSync('app/evento-pirelli/foto/page.tsx', 'utf8')
  assert.doesNotMatch(landing, /acao=foto/)
  assert.doesNotMatch(landing, /acaoDedicada === 'foto'/)
  assert.doesNotMatch(landing, /desafio da foto/i)
  assert.match(paginaFoto, /redirect\('\/evento-pirelli'\)/)
  assert.match(readFileSync('lib/evento-pirelli/config.ts', 'utf8'), /DESAFIO_FOTO_ATIVO = false/)
  assert.doesNotMatch(landing, /declarouHashtag/)
  assert.doesNotMatch(landing, /declarouPerfilPublico/)
  assert.match(landing, /carregarEMigrarAcessoEventoPirelli\(localStorage\)/)
  assert.match(caneca, /carregarEMigrarAcessoEventoPirelli\(localStorage\)/)
  assert.match(caneca, /signal: AbortSignal\.timeout\(TEMPO_LIMITE_CHECKOUT_MS\)/)
  assert.match(caneca, /Sua tentativa foi preservada; tente novamente/)
  assert.match(caneca, /try \{[\s\S]{0,160}novaChaveIdempotenciaCliente\(\)/)
  assert.match(landing, /Usar outro cadastro neste aparelho/)
  assert.match(landing, /limparAcessoLocalEventoPirelli\(localStorage\)/)
  assert.doesNotMatch(pagina, /'foto'/)
})

test('cadastro existente abre diretamente a recuperação inline na etapa do código', () => {
  const landing = readFileSync('components/evento-pirelli/EventoPirelliLanding.tsx', 'utf8')
  const inicio409 = landing.indexOf("resposta.status === 409 && dados.recuperavel === true")
  const fim409 = landing.indexOf('throw new Error(dados.error)', inicio409)
  const fluxo409 = landing.slice(inicio409, fim409)

  assert.ok(inicio409 >= 0, 'o cadastro deve reconhecer a resposta recuperável')
  assert.match(fluxo409, /body: JSON\.stringify\(\{ acao: 'solicitar', whatsapp: form\.whatsapp \}\)/)
  assert.match(fluxo409, /solicitado: true/)
  assert.match(fluxo409, /enviando: true[\s\S]*setInicioRecuperacao\(inicio\)[\s\S]*setRecuperacaoAberta\(true\)[\s\S]*await fetch/)
  assert.doesNotMatch(fluxo409, /useEffect/, 'o envio automático não pode depender de effect')

  assert.match(landing, /if \(recuperacaoAberta\) \{[\s\S]*<RecuperarAcesso/)
  assert.match(landing, /useState\(inicio\?\.solicitado \?\? false\)/)
  assert.match(landing, /autoFocus required inputMode="numeric" autoComplete="one-time-code"/)
})
