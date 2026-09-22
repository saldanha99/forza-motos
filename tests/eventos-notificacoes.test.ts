import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { agendarNotificacoesAprovacaoEvento } from '../lib/eventos/notificacoes'

const inscricao = {
  id: 'inscricao-123',
  nome: 'Cliente Evento',
  email: 'CLIENTE@EXAMPLE.COM',
  telefone: '(19) 99999-9999',
  quantidade: 1,
  total: 5,
  temGarupa: false,
  nomeGarupa: null,
  tipoAcomodacao: 'Quarto Compartilhado',
  motoModelo: 'BMW R 1250 GS',
  evento: {
    titulo: 'Passeio Forza',
    dataInicio: new Date('2026-09-10T12:00:00.000Z'),
    local: 'Forza Motos',
  },
}

test('confirmação de evento agenda e-mail e WhatsApps com chaves idempotentes', async () => {
  const anterior = process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS
  delete process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS
  const emails: any[] = []
  const mensagens: any[] = []
  const db = {
    emailOutbox: {
      upsert: async (args: any) => {
        emails.push(args)
        return { id: 'email-1', ...args.create }
      },
    },
    crmMensagem: {
      upsert: async (args: any) => {
        mensagens.push(args)
        return { id: `whatsapp-${mensagens.length}`, ...args.create }
      },
    },
  }

  try {
    const resultado = await agendarNotificacoesAprovacaoEvento(inscricao, db as any)
    assert.deepEqual(resultado, {
      emailId: 'email-1',
      whatsappClienteId: 'whatsapp-1',
      whatsappAdminId: 'whatsapp-2',
    })
    assert.equal(emails[0].where.chaveIdempotencia, 'evento:inscricao-123:email:confirmado')
    assert.equal(emails[0].create.destinatario, 'cliente@example.com')
    assert.equal(mensagens[0].where.chaveIdempotencia, 'evento:inscricao-123:whatsapp:confirmado')
    assert.equal(mensagens[0].create.whatsapp, '5519999999999')
    assert.equal(mensagens[1].where.chaveIdempotencia, 'evento:inscricao-123:whatsapp:admin:confirmado')
  } finally {
    if (anterior === undefined) delete process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS
    else process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS = anterior
  }
})

test('obrigação nasce no commit financeiro de evento pago e também no gratuito', () => {
  const pagamento = readFileSync('lib/eventos/pagamento.ts', 'utf8')
  const comprar = readFileSync('app/api/eventos/[slug]/comprar/route.ts', 'utf8')
  assert.match(
    pagamento,
    /if \(decisao\.notificarAprovacao\)[\s\S]*agendarNotificacoesAprovacaoEvento\(atualizada, tx\)/,
  )
  assert.match(
    comprar,
    /if \(gratuito\)[\s\S]*agendarNotificacoesAprovacaoEvento\(\{ \.\.\.inscricao, evento \}, tx\)/,
  )
})
