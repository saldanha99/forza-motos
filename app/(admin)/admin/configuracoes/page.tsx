'use client'

import { useState, useEffect } from 'react'
import { Save, Globe, Search, RefreshCw, CreditCard, ExternalLink, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { WhatsAppQRCard } from '@/components/admin/WhatsAppQRCard'
import { Card, CardHeader, PageHeader, Botao, BotaoLink } from '@/components/admin/ui/primitives'
import { Campo, Input, Select, Switch } from '@/components/admin/ui/form'

// Configurações editáveis do painel admin.
// Os valores são salvos no banco (model Setting) e lidos dinamicamente pelo layout.

interface CampoConfig {
  key: string
  label: string
  placeholder: string
  help: string
  tipo?: 'text' | 'password'
}

const camposGeral: CampoConfig[] = [
  {
    key: 'google_site_verification',
    label: 'Google Site Verification',
    placeholder: 'dmGEEQvLRduatz...',
    help: 'Token do Google Search Console. Vá em Configurações → Verificação de propriedade → Tag HTML → copie só o valor do atributo "content".',
  },
  {
    key: 'site_name',
    label: 'Nome do site',
    placeholder: 'Forza Motos',
    help: 'Aparece nos títulos de SEO e schema.org.',
  },
  {
    key: 'site_url',
    label: 'URL do site',
    placeholder: 'https://forzamotos.com.br',
    help: 'URL base de produção usada no sitemap e canonical.',
  },
  {
    key: 'indexnow_key',
    label: 'IndexNow Key (Bing)',
    placeholder: '32+ caracteres',
    help: 'Chave para notificação instantânea ao Bing/Yandex. Crie o arquivo public/{chave}.txt com o mesmo valor.',
    tipo: 'password',
  },
]

export default function ConfiguracoesPage() {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)

  // Carrega as configurações do banco no mount da página
  useEffect(() => {
    async function carregarConfiguracoes() {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.ok) {
          const data = await res.json()
          setValores(data)
        }
      } catch (e) {
        console.error('Erro ao carregar configurações:', e)
        toast.error('Erro ao carregar algumas configurações.')
      } finally {
        setLoadingConfig(false)
      }
    }
    carregarConfiguracoes()
  }, [])

  async function salvar(key: string, valorOverride?: string) {
    const valorASalvar = valorOverride !== undefined ? valorOverride : (valores[key] ?? '')
    setSalvando(key)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: valorASalvar }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')

      // Atualiza estado local caso use valorOverride
      if (valorOverride !== undefined) {
        setValores((v) => ({ ...v, [key]: valorOverride }))
      }

      toast.success('Salvo com sucesso!')
    } catch {
      toast.error('Erro ao salvar configuração.')
    } finally {
      setSalvando(null)
    }
  }

  /** Botão de salvar de um campo isolado — cada configuração salva sozinha, sem formulário único. */
  function BotaoSalvar({ chave }: { chave: string }) {
    return (
      <Botao onClick={() => salvar(chave)} disabled={salvando === chave} className="shrink-0">
        {salvando === chave ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
        Salvar
      </Botao>
    )
  }

  if (loadingConfig) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <RefreshCw className="mx-auto mb-4 animate-spin text-brand-accent" size={32} />
        <p className="text-sm text-brand-muted">Carregando configurações...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        titulo="Configurações"
        descricao="Configurações de SEO, pagamento e integrações — salvas no banco, sem precisar de redeploy."
      />

      <div className="space-y-6">
        {/* ── Geral & SEO ──────────────────────────────────────────── */}
        <Card>
          <CardHeader
            titulo={
              <span className="flex items-center gap-2">
                <Globe size={18} className="text-brand-accent" /> Geral & SEO
              </span>
            }
          />
          <div className="space-y-5 p-5">
            {camposGeral.map((c) => (
              <div key={c.key} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                <Campo label={c.label} dica={c.help} className="flex-1">
                  <Input
                    type={c.tipo ?? 'text'}
                    value={valores[c.key] ?? ''}
                    onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                    placeholder={c.placeholder}
                  />
                </Campo>
                <BotaoSalvar chave={c.key} />
              </div>
            ))}
          </div>
        </Card>

        {/* ── Mercado Pago (Checkout Pro) ──────────────────────────── */}
        <Card>
          <CardHeader
            titulo={
              <span className="flex items-center gap-2">
                <CreditCard size={18} className="text-brand-accent" /> Mercado Pago (Checkout Pro)
              </span>
            }
          />
          <div className="space-y-6 p-5">
            {/* 1. Ativar Experiência */}
            <Campo
              label="Ativar Mercado Pago no Checkout"
              dica="Selecione se deseja ativar a experiência do Mercado Pago Checkout Pro na loja. Desativado, o checkout não oferece Mercado Pago como forma de pagamento."
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Select
                  className="flex-1"
                  value={valores['mp_checkout_pro_enabled'] ?? 'true'}
                  onChange={(e) => setValores((v) => ({ ...v, mp_checkout_pro_enabled: e.target.value }))}
                >
                  <option value="true">Sim (Ativado)</option>
                  <option value="false">Não (Desativado)</option>
                </Select>
                <BotaoSalvar chave="mp_checkout_pro_enabled" />
              </div>
            </Campo>

            {/* 2. Meios de Pagamento & Chave Pix */}
            <div className="space-y-3 border-t border-brand-hair pt-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dim">
                  Meios de Pagamento Aceitos
                </p>
                <p className="mt-1 text-xs text-brand-muted">
                  Escolha os meios de pagamento que deseja oferecer no ambiente do Mercado Pago. Cada opção salva sozinha ao ser alterada.
                </p>
              </div>

              <div className="space-y-2">
                <Switch
                  label="Cartões de crédito e débito"
                  checked={(valores['mp_accept_cards'] ?? 'true') === 'true'}
                  onChange={(v) => salvar('mp_accept_cards', v ? 'true' : 'false')}
                />
                <Switch
                  label="Dinheiro (Saldo Mercado Pago ou Boleto Bancário)"
                  checked={(valores['mp_accept_ticket'] ?? 'true') === 'true'}
                  onChange={(v) => salvar('mp_accept_ticket', v ? 'true' : 'false')}
                />
                <Switch
                  label="Transferência bancária (Pix) — Recomendado"
                  descricao="Só aparece na loja se houver uma Chave Pix cadastrada na sua conta do Mercado Pago."
                  checked={(valores['mp_accept_pix'] ?? 'true') === 'true'}
                  onChange={(v) => salvar('mp_accept_pix', v ? 'true' : 'false')}
                />
              </div>

              {/* Informação sobre Chave Pix */}
              <div className="flex gap-3 rounded-xl border border-brand-success bg-brand-success-soft p-4">
                <AlertCircle className="mt-0.5 shrink-0 text-brand-success" size={18} />
                <div className="text-xs leading-relaxed text-brand-muted">
                  <strong className="font-semibold text-brand-text">Importante:</strong> A opção de pagamento com Pix só será exibida se houver uma Chave Pix cadastrada na sua conta do Mercado Pago.
                  <br />
                  <a
                    href="https://www.youtube.com/watch?v=60tApKYVnkA"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-success underline hover:text-brand-text"
                  >
                    Clique aqui e veja o passo a passo de como cadastrar a chave <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>

            {/* 3. Máximo de Parcelas */}
            <div className="border-t border-brand-hair pt-6">
              <Campo
                label="Máximo de Parcelas"
                dica="Selecione o número máximo de parcelas que deseja oferecer em sua loja."
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Select
                    className="flex-1"
                    value={valores['mp_max_installments'] ?? '12'}
                    onChange={(e) => setValores((v) => ({ ...v, mp_max_installments: e.target.value }))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}x {n === 1 ? '(Sem parcelamento)' : ''}
                      </option>
                    ))}
                  </Select>
                  <BotaoSalvar chave="mp_max_installments" />
                </div>
              </Campo>
            </div>

            {/* 4. Tarifa e Parcelas sem Acréscimo (Atalho) */}
            <div className="space-y-2 border-t border-brand-hair pt-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dim">
                Tarifas e Parcelamento sem Juros
              </p>
              <p className="text-xs text-brand-muted">
                As taxas cobradas por transação e a oferta de parcelas sem acréscimo para os seus clientes devem ser configuradas diretamente na sua conta do Mercado Pago.
              </p>
              <BotaoLink
                href="https://www.mercadopago.com.br/costs-section#from-section=menu"
                target="_blank"
                rel="noreferrer"
                variante="secundario"
                tamanho="sm"
                className="mt-1"
              >
                <ExternalLink size={13} /> Configurar Tarifas no Mercado Pago
              </BotaoLink>
            </div>

            {/* 5. Retorno Automático */}
            <div className="border-t border-brand-hair pt-6">
              <Campo
                label="Retorno Automático do Cliente"
                dica="Selecione se deseja que o cliente retorne automaticamente à sua loja após concluir o pagamento."
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Select
                    className="flex-1"
                    value={valores['mp_auto_return'] ?? 'approved'}
                    onChange={(e) => setValores((v) => ({ ...v, mp_auto_return: e.target.value }))}
                  >
                    <option value="approved">Retornar apenas em pagamentos Aprovados (Recomendado)</option>
                    <option value="all">Retornar em todos os casos (Aprovado, Pendente, Erro)</option>
                    <option value="off">Não retornar automaticamente (Desativado)</option>
                  </Select>
                  <BotaoSalvar chave="mp_auto_return" />
                </div>
              </Campo>
            </div>

            {/* 6. Modo Binário */}
            <div className="border-t border-brand-hair pt-6">
              <Campo
                label="Modo Binário"
                dica="Quando ativado, os pagamentos serão aceitos ou recusados automaticamente. Não haverá análise manual de risco (pagamento pendente para revisão)."
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Select
                    className="flex-1"
                    value={valores['mp_binary_mode'] ?? 'false'}
                    onChange={(e) => setValores((v) => ({ ...v, mp_binary_mode: e.target.value }))}
                  >
                    <option value="false">Desativado (Permite pagamentos pendentes em revisão)</option>
                    <option value="true">Ativado (Aprovação ou recusa imediata)</option>
                  </Select>
                  <BotaoSalvar chave="mp_binary_mode" />
                </div>
              </Campo>
            </div>

            {/* 7. Validade das Preferências */}
            <div className="border-t border-brand-hair pt-6">
              <Campo
                label="Validade do Link de Pagamento (Minutos)"
                dica="Indique por quantos minutos a preferência de pagamento ficará ativa antes de expirar (deixe em branco para sem expiração). Recomendado: 60 minutos para evitar abandono com boleto/Pix pendentes."
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Input
                    type="number"
                    min="5"
                    max="43200"
                    value={valores['mp_preference_expiration_minutes'] ?? ''}
                    onChange={(e) => setValores((v) => ({ ...v, mp_preference_expiration_minutes: e.target.value }))}
                    placeholder="Ex: 60"
                    className="flex-1"
                  />
                  <BotaoSalvar chave="mp_preference_expiration_minutes" />
                </div>
              </Campo>
            </div>
          </div>
        </Card>

        {/* ── WhatsApp / Evolution API ─────────────────────────────── */}
        <Card>
          <CardHeader
            titulo={
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-success" /> WhatsApp
              </span>
            }
          />
          <div className="p-5">
            <WhatsAppQRCard />
          </div>
        </Card>

        {/* Instrução Google Search Console */}
        <Card className="border-brand-info bg-brand-info-soft p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-info">
            <Search size={14} /> Como verificar no Google Search Console
          </h2>
          <ol className="list-inside list-decimal space-y-1.5 text-xs text-brand-muted">
            <li>Acesse <strong className="text-brand-text">search.google.com/search-console</strong></li>
            <li>Clique em <strong className="text-brand-text">Adicionar propriedade</strong> → URL Prefix</li>
            <li>Escolha verificação por <strong className="text-brand-text">Tag HTML</strong></li>
            <li>Copie <strong className="text-brand-text">apenas o valor</strong> do atributo <code>content</code></li>
            <li>Cole no campo <strong className="text-brand-text">Google Site Verification</strong> acima e salve</li>
            <li>Volte ao GSC e clique em <strong className="text-brand-text">Verificar</strong></li>
            <li>Depois vá em <strong className="text-brand-text">Sitemaps</strong> → adicione <code>seusite.com/sitemap.xml</code></li>
          </ol>
        </Card>
      </div>
    </div>
  )
}
