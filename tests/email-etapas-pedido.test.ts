import assert from 'node:assert/strict'
import test from 'node:test'
import { htmlNfeAutorizada, htmlPedidoEntregue } from '@/lib/email/templates'
import {
  extrairXmlNfeDaRespostaOlist,
  validarLinkDanfeOlist,
  xmlNfeCorrespondeAChave,
} from '@/lib/olist/documentos-nfe'

test('extrai a NF-e real do envelope XML da Olist', () => {
  const xml = extrairXmlNfeDaRespostaOlist(`<?xml version="1.0"?>
    <retorno><status>OK</status><xml_nfe>
      <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe123"/></NFe></nfeProc>
    </xml_nfe></retorno>`)

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<nfeProc/)
  assert.doesNotMatch(xml, /<retorno>/)
  assert.doesNotMatch(xml, /<xml_nfe>/)
})

test('decodifica NF-e escapada e recusa DTD/entidades', () => {
  const xml = extrairXmlNfeDaRespostaOlist(
    '<retorno><status>OK</status><xml_nfe>&lt;nfeProc&gt;&lt;NFe&gt;&lt;infNFe Id=&quot;NFe123&quot;/&gt;&lt;/NFe&gt;&lt;/nfeProc&gt;</xml_nfe></retorno>',
  )
  assert.match(xml, /<infNFe Id="NFe123"\/>/)

  assert.throws(
    () => extrairXmlNfeDaRespostaOlist(
      '<retorno><status>OK</status><xml_nfe><![CDATA[<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><nfeProc><NFe/></nfeProc>]]></xml_nfe></retorno>',
    ),
    /declaração não permitida/,
  )
})

test('aceita apenas link DANFE HTTPS do host oficial erp.olist.com', () => {
  assert.equal(
    validarLinkDanfeOlist('https://erp.olist.com/doc.view.php?id=abc'),
    'https://erp.olist.com/doc.view.php?id=abc',
  )
  assert.equal(validarLinkDanfeOlist('http://erp.olist.com/doc.view.php?id=abc'), null)
  assert.equal(validarLinkDanfeOlist('https://erp.olist.com.evil.test/doc.view.php'), null)
  assert.equal(validarLinkDanfeOlist('https://user:pass@erp.olist.com/doc.view.php'), null)
})

test('documento fiscal precisa corresponder à chave registrada no pedido', () => {
  const chave = '35260800857031000163550010000032281433790697'
  const xml = `<nfeProc><NFe><infNFe Id="NFe${chave}"/></NFe></nfeProc>`
  assert.equal(xmlNfeCorrespondeAChave(xml, chave), true)
  assert.equal(xmlNfeCorrespondeAChave(xml, `${chave.slice(0, 43)}0`), false)
})

test('templates escapam conteúdo e não publicam link DANFE externo', () => {
  const htmlNfe = htmlNfeAutorizada({
    nomeCliente: '<img src=x onerror=alert(1)>',
    numeroPedido: 'FM-1',
    chaveNfe: '1'.repeat(44),
    danfeUrl: 'https://erp.olist.com.evil.test/falsa',
    xmlAnexado: true,
  })
  assert.doesNotMatch(htmlNfe, /<img src=x/)
  assert.doesNotMatch(htmlNfe, /olist\.com\.evil/)
  assert.match(htmlNfe, /arquivo XML oficial/)

  const htmlEntrega = htmlPedidoEntregue({
    nomeCliente: 'Cliente & Filhos',
    numeroPedido: 'FM-2',
    rastreio: 'AB123',
    transportadora: 'Correios',
  })
  assert.match(htmlEntrega, /Cliente &amp; Filhos/)
  assert.match(htmlEntrega, /Entrega concluída com sucesso/)
})
