import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { linkConfirmacaoCanecaPirelli } from '@/lib/eventos/notificacoes-caneca-pirelli'

test('link da caneca usa token opaco e não exige QR do participante', () => {
  const token = 'abcdefghijklmnopqrstuvwx12345678'
  const link = linkConfirmacaoCanecaPirelli(token)
  assert.match(link, /\/evento-pirelli\/caneca\/confirmar\?token=/)
  assert.match(link, new RegExp(token))

  const landing = readFileSync('components/evento-pirelli/EventoPirelliLanding.tsx', 'utf8')
  const resultado = readFileSync('components/evento-pirelli/QuizPublicoEventoPirelli.tsx', 'utf8')
  assert.doesNotMatch(landing, /QRCode\.toDataURL/)
  assert.doesNotMatch(resultado, /<img|qrDataUrl/)
  assert.match(resultado, /Confirmar nome da caneca/)
})

test('confirmação pública valida direito no servidor antes de aceitar o nome', () => {
  const pagina = readFileSync('app/evento-pirelli/caneca/confirmar/page.tsx', 'utf8')
  const acao = readFileSync('app/evento-pirelli/caneca/confirmar/actions.ts', 'utf8')

  assert.match(pagina, /pagamentoConfirmadoEm: \{ not: null \}/)
  assert.match(pagina, /elegibilidadesCaneca/)
  assert.match(acao, /where: \{ codigoQr: token \}/)
  assert.match(acao, /where: \{ revogadoEm: null \}/)
  assert.match(acao, /comprasCaneca/)
  assert.match(acao, /pagamentoConfirmadoEm: \{ not: null \}/)
  assert.match(acao, /definirNomeCanecaElegivel\(visitante\.id, nomeGravacao, 'Cliente pelo link seguro'\)/)
})

test('vencedor e vendas presenciais agendam WhatsApp idempotente com link', () => {
  const quiz = readFileSync('app/api/admin/evento-pirelli/quiz/route.ts', 'utf8')
  const atendimento = readFileSync('app/api/admin/evento-pirelli/atendimento/route.ts', 'utf8')
  const notificacoes = readFileSync('lib/eventos/notificacoes-caneca-pirelli.ts', 'utf8')

  assert.match(quiz, /motivo: 'PREMIO_QUIZ'/)
  assert.match(atendimento, /motivo: 'BRINDE_COMPRA_PNEUS'/)
  assert.match(atendimento, /motivo: 'COMPRA_CANECA'/)
  assert.match(notificacoes, /chaveIdempotencia:/)
  assert.match(notificacoes, /caneca\/confirmar\?token=/)
  assert.match(notificacoes, /tipo: 'MANUAL'/)
})

test('painel separa prêmios e compras pagas com nomes de gravação', () => {
  const servidor = readFileSync('app/(admin)/admin/evento-pirelli/canecas/page.tsx', 'utf8')
  const painel = readFileSync('components/evento-pirelli/CanecasEventoPirelli.tsx', 'utf8')

  assert.match(servidor, /pagamentoConfirmadoEm: \{ not: null \}/)
  assert.match(servidor, /canecaBrinde: null/)
  assert.match(painel, /Prêmios e brindes confirmados/)
  assert.match(painel, /Compras confirmadas/)
  assert.match(painel, /nomeGravacaoSnapshot/)
  assert.match(painel, /atendimento\?id=/)
})

test('PDV presencial separa pedido pendente de pagamento confirmado', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8')
  const migration = readFileSync('prisma/migrations/20260901120000_evento_pirelli_pdv_presencial/migration.sql', 'utf8')
  const migrationSemNsu = readFileSync('prisma/migrations/20260901170000_evento_pirelli_pdv_sem_nsu/migration.sql', 'utf8')
  const rota = readFileSync('app/api/admin/evento-pirelli/atendimento/route.ts', 'utf8')
  const painel = readFileSync('components/evento-pirelli/AtendimentoEventoPirelli.tsx', 'utf8')

  assert.match(schema, /enum EventoPirelliVendaPresencialStatus/)
  assert.match(schema, /AGUARDANDO_PAGAMENTO/)
  assert.match(schema, /model EventoPirelliVendaPresencial/)
  assert.match(schema, /nomeGravacaoSnapshot\s+String\?/)
  assert.match(migration, /EventoPirelliVendaPresencial_status_check/)
  assert.match(migration, /EventoPirelliVendaPresencial_referencia_pagamento_check/)
  assert.match(migrationSemNsu, /DROP CONSTRAINT IF EXISTS "EventoPirelliLancamentoCaixa_referenciaPagamento_check"/)
  assert.match(migrationSemNsu, /DROP CONSTRAINT IF EXISTS "EventoPirelliVendaPresencial_referencia_pagamento_check"/)

  assert.match(rota, /body\.acao === 'cadastrar-cliente'/)
  assert.match(rota, /body\.acao === 'criar-venda-presencial'/)
  assert.match(rota, /body\.acao === 'confirmar-venda-presencial'/)
  assert.match(rota, /body\.acao === 'cancelar-venda-presencial'/)
  assert.match(rota, /pg_advisory_xact_lock/)
  assert.match(rota, /eventoPirelliLancamentoCaixa\.create/)
  assert.match(rota, /vendaPneusElegivel/)
  assert.match(rota, /chaveIdempotencia: `pdv:\$\{venda\.id\}`/)

  assert.match(painel, /Novo cliente/)
  assert.match(painel, /Criar venda pendente/)
  assert.match(painel, /Confirmar pagamento/)
  assert.doesNotMatch(painel, /NSU, autorização ou referência/)
  assert.match(painel, /Nada entra no caixa, na fila de gravação ou nos brindes enquanto o pagamento estiver pendente/)
  assert.match(painel, /Confirmar nome manualmente/)
  assert.match(painel, /Contingência para WhatsApp indisponível/)
  assert.match(rota, /nomeGravacaoConfirmadoPor: operador/)
})
