import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { resolverPublicacaoProduto } from '../lib/produtos/publicacao'

test('publicar remove o ocultamento e respeita foto e disponibilidade', () => {
  assert.deepEqual(resolverPublicacaoProduto({
    ativoSolicitado: true,
    temImagem: true,
    estoque: 8,
    preVenda: false,
  }), { ativo: true, ocultoManual: false })

  assert.deepEqual(resolverPublicacaoProduto({
    ativoSolicitado: false,
    temImagem: true,
    estoque: 8,
    preVenda: false,
  }), { ativo: false, ocultoManual: true })

  assert.deepEqual(resolverPublicacaoProduto({
    ativoSolicitado: true,
    temImagem: false,
    estoque: 8,
    preVenda: false,
  }), { ativo: false, ocultoManual: false })
})

test('painel e produto de teste não voltam ao estado ativo porém oculto', () => {
  const rota = readFileSync('app/api/produtos/[id]/route.ts', 'utf8')
  const formulario = readFileSync('components/admin/ProdutoForm.tsx', 'utf8')
  const listagem = readFileSync('app/(admin)/admin/produtos/page.tsx', 'utf8')
  const curadoria = readFileSync('app/(admin)/admin/curadoria/page.tsx', 'utf8')
  const script = readFileSync('scripts/produto-teste.ts', 'utf8')

  assert.match(rota, /ocultoManual: alterouPublicacao \? publicacao\.ocultoManual : undefined/)
  assert.match(rota, /data: \{ ativo: false, ocultoManual: true \}/)
  assert.match(formulario, /produto\.ativo && !produto\.ocultoManual/)
  assert.match(formulario, /label="Visível na loja"/)
  assert.match(listagem, /p\.ativo && !p\.ocultoManual/)
  assert.match(listagem, />Oculto<\/Badge>/)
  assert.match(curadoria, /where\.ocultoManual = false/)
  assert.match(curadoria, /p\.ativo && !p\.ocultoManual/)
  assert.match(script, /update: \{ ativo: true, ocultoManual: false/)
})
