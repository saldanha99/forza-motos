import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { extrairCodigoQrEvento } from '@/lib/eventos/qr-pirelli'
import { transicaoCanecaPirelliPermitida } from '@/lib/eventos/caneca-pirelli'

const codigo = 'AbCdEfGhIjKlMnOpQrStUvWxYz_12345'

test('QR aceita token puro, URL do celular e leitura USB da URL completa', () => {
  assert.equal(extrairCodigoQrEvento(codigo), codigo)
  assert.equal(
    extrairCodigoQrEvento(`https://forzamotos.com.br/admin/evento-pirelli/atendimento?codigo=${codigo}`),
    codigo,
  )
  assert.equal(extrairCodigoQrEvento('https://forzamotos.com.br/admin/evento-pirelli/atendimento'), null)
  assert.equal(extrairCodigoQrEvento('codigo inválido'), null)
})

test('resgate segue a fila e não permite reabrir uma caneca entregue', () => {
  assert.equal(transicaoCanecaPirelliPermitida('PENDENTE', 'EM_GRAVACAO'), true)
  assert.equal(transicaoCanecaPirelliPermitida('EM_GRAVACAO', 'PRONTA'), true)
  assert.equal(transicaoCanecaPirelliPermitida('PRONTA', 'ENTREGUE'), true)
  assert.equal(transicaoCanecaPirelliPermitida('PENDENTE', 'ENTREGUE'), false)
  assert.equal(transicaoCanecaPirelliPermitida('ENTREGUE', 'EM_GRAVACAO'), false)
  assert.equal(transicaoCanecaPirelliPermitida('CANCELADA', 'PENDENTE'), false)
})

test('API consome a entrega com elegibilidade, lock e compare-and-set', () => {
  const rota = readFileSync('app/api/admin/evento-pirelli/atendimento/route.ts', 'utf8')
  assert.match(rota, /bloquearVisitanteEvento\(tx, visitanteId\)/)
  assert.match(rota, /elegibilidades: \{ where: \{ revogadoEm: null \}/)
  assert.match(rota, /updateMany\(\{[\s\S]*where: \{ id: atual\.id, status: atual\.status \}/)
  assert.match(rota, /CANECA_JA_ENTREGUE/)
})
