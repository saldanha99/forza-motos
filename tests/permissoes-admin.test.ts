import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  AREAS_ADMIN,
  AREAS_CONCEDIVEIS,
  areaDaRota,
  permissoesEfetivas,
  podeAcessarRota,
  rotaInicial,
  type ChaveArea,
} from '../lib/admin/permissoes'
import { GRUPOS_NAV } from '../lib/admin/navegacao'

test('ADMIN enxerga tudo, aconteça o que acontecer com a lista salva', () => {
  // Ninguém pode se trancar do lado de fora desmarcando as próprias caixas.
  const todas = AREAS_ADMIN.map((a) => a.chave).sort()
  for (const salvas of [undefined, [], ['marketing'], ['lixo'], null, 'nada']) {
    assert.deepEqual(permissoesEfetivas('ADMIN', salvas).sort(), todas)
  }
})

test('MARKETING sem personalização cai no padrão do papel', () => {
  assert.deepEqual(permissoesEfetivas('MARKETING', []), ['marketing'])
  assert.deepEqual(permissoesEfetivas('MARKETING', undefined), ['marketing'])
})

test('área exclusiva de admin não pode ser concedida nem por engano', () => {
  // Liberar a página sem liberar a API entregaria uma tela que dá 403 em
  // qualquer clique. Enquanto a API não for migrada, a área não é concedível.
  const efetivas = permissoesEfetivas('MARKETING', ['marketing', 'pedidos', 'usuarios', 'produtos'])
  assert.deepEqual(efetivas, ['marketing'])
  assert.equal(AREAS_ADMIN.find((a) => a.chave === 'usuarios')?.somenteAdmin, true)
  assert.equal(AREAS_ADMIN.find((a) => a.chave === 'configuracoes')?.somenteAdmin, true)
})

test('cliente comum não enxerga nada do painel', () => {
  // Nem com permissão gravada por engano no registro dele: papel fora do
  // painel não vira meio-admin.
  assert.deepEqual(permissoesEfetivas('CUSTOMER', ['marketing']), [])
  assert.deepEqual(permissoesEfetivas(null, undefined), [])
  assert.deepEqual(permissoesEfetivas(undefined, []), [])
  assert.deepEqual(permissoesEfetivas('QUALQUER_COISA', ['marketing']), [])
})

test('rota desconhecida do painel fecha por padrão', () => {
  // Tela nova entra protegida mesmo que alguém esqueça de cadastrá-la.
  const todas = permissoesEfetivas('ADMIN')
  assert.equal(podeAcessarRota(todas, '/admin/tela-que-ainda-nao-existe'), false)
  assert.equal(areaDaRota('/admin/tela-que-ainda-nao-existe'), null)
})

test('a rota casa com a área de prefixo mais longo', () => {
  assert.equal(areaDaRota('/api/admin/seo/redirects')?.chave, 'seo')
  assert.equal(areaDaRota('/admin/evento-pirelli/canecas')?.chave, 'evento-pirelli')
  assert.equal(areaDaRota('/admin/eventos')?.chave, 'eventos')
  assert.equal(areaDaRota('/admin/pneus-segmentos')?.chave, 'pneus-segmentos')
  assert.equal(areaDaRota('/api/admin/usuarios/abc123')?.chave, 'usuarios')
})

test('quem só tem marketing abre marketing e mais nada', () => {
  const perms = permissoesEfetivas('MARKETING', [])
  assert.equal(podeAcessarRota(perms, '/admin/marketing'), true)
  assert.equal(podeAcessarRota(perms, '/api/upload'), true)
  assert.equal(podeAcessarRota(perms, '/admin/pedidos'), false)
  assert.equal(podeAcessarRota(perms, '/admin/usuarios'), false)
  assert.equal(podeAcessarRota(perms, '/admin/produtos/123'), false)
  assert.equal(rotaInicial(perms), '/admin/marketing')
})

test('todo item do menu pertence a alguma área', () => {
  // Item sem área apareceria no menu e o proxy barraria no clique.
  for (const grupo of GRUPOS_NAV) {
    for (const item of grupo.itens) {
      assert.ok(
        areaDaRota(item.href),
        `item "${item.label}" (${item.href}) não está em nenhuma área de lib/admin/permissoes.ts`,
      )
    }
  }
})

test('as APIs das áreas concedíveis passam por exigirAcesso', () => {
  // Se a API ainda exigisse role === 'ADMIN', a área não poderia ser
  // concedida: a tela abriria e o primeiro clique daria 403.
  const rotas: Record<ChaveArea, string[]> = {
    marketing: ['app/api/admin/marketing/route.ts', 'app/api/upload/route.ts'],
    blog: ['app/api/blog/route.ts', 'app/api/blog/[id]/route.ts'],
  } as Record<ChaveArea, string[]>

  for (const area of AREAS_CONCEDIVEIS) {
    const arquivos = rotas[area.chave]
    assert.ok(arquivos?.length, `área concedível "${area.chave}" sem API mapeada no teste`)
    for (const arquivo of arquivos) {
      const fonte = readFileSync(arquivo, 'utf8')
      assert.match(fonte, new RegExp(`exigirAcesso\\('${area.chave}'\\)`), `${arquivo} sem guarda`)
      assert.doesNotMatch(fonte, /role !== 'ADMIN'/, `${arquivo} ainda exige ADMIN`)
    }
  }
})

test('o proxy barra quem não é do painel e respeita a permissão', () => {
  const proxy = readFileSync('proxy.ts', 'utf8')
  assert.match(proxy, /papel !== 'ADMIN' && papel !== 'MARKETING'/)
  assert.match(proxy, /podeAcessarRota\(permissoes, pathname\)/)
})

test('o guarda do servidor relê o banco, e não o token', () => {
  // Tirar permissão de alguém precisa valer na hora, sem esperar a pessoa
  // deslogar — o token só é atualizado em um novo login.
  const acesso = readFileSync('lib/admin/acesso.ts', 'utf8')
  assert.match(acesso, /prisma\.user\s*\n?\s*\.findUnique/)
  assert.match(acesso, /if \(!user \|\| !user\.ativo\) return null/)
  assert.match(acesso, /if \(user\.role === 'CUSTOMER'\) return null/)
})

test('login bloqueado para usuário desligado', () => {
  const auth = readFileSync('lib/auth.ts', 'utf8')
  const checagem = auth.indexOf('if (!user.ativo) return null')
  const comparaSenha = auth.indexOf('bcrypt.compare')
  assert.ok(checagem > 0, 'authorize precisa barrar usuário desligado')
  assert.ok(checagem < comparaSenha, 'a checagem vem antes de comparar a senha')
})
