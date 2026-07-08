'use client'

import { useState, useEffect } from 'react'
import { Save, Globe, Search, RefreshCw, Key, CreditCard, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { WhatsAppQRCard } from '@/components/admin/WhatsAppQRCard'

// Configurações editáveis do painel admin.
// Os valores são salvos no banco (model Setting) e lidos dinamicamente pelo layout.

interface Campo {
  key: string
  label: string
  placeholder: string
  help: string
  icon: React.ReactNode
  tipo?: 'text' | 'password'
}

const campos: Campo[] = [
  {
    key: 'google_site_verification',
    label: 'Google Site Verification',
    placeholder: 'dmGEEQvLRduatz...',
    help: 'Token do Google Search Console. Vá em Configurações → Verificação de propriedade → Tag HTML → copie só o valor do atributo "content".',
    icon: <Search size={16} />,
  },
  {
    key: 'site_name',
    label: 'Nome do site',
    placeholder: 'Forza Motos',
    help: 'Aparece nos títulos de SEO e schema.org.',
    icon: <Globe size={16} />,
  },
  {
    key: 'site_url',
    label: 'URL do site',
    placeholder: 'https://forzamotos.com.br',
    help: 'URL base de produção usada no sitemap e canonical.',
    icon: <Globe size={16} />,
  },
  {
    key: 'indexnow_key',
    label: 'IndexNow Key (Bing)',
    placeholder: '32+ caracteres',
    help: 'Chave para notificação instantânea ao Bing/Yandex. Crie o arquivo public/{chave}.txt com o mesmo valor.',
    icon: <Key size={16} />,
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

  if (loadingConfig) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <RefreshCw className="animate-spin text-indigo-500 mx-auto mb-4" size={32} />
        <p className="text-brand-muted text-sm">Carregando configurações...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">
          Configurações
        </h1>
        <p className="text-brand-muted text-sm mt-1">
          Configurações de SEO e integração — salvas no banco, sem redeploy.
        </p>
      </div>

      <div className="space-y-6">
        {/* Seção Geral e SEO */}
        <div className="space-y-4">
          <h2 className="text-brand-text font-semibold text-lg flex items-center gap-2 border-b border-brand-border/20 pb-2">
            <Globe size={18} className="text-brand-accent" /> Geral & SEO
          </h2>
          {campos.map((c) => (
            <div
              key={c.key}
              className="bg-white/5 border border-brand-border/30 rounded-2xl p-5"
            >
              <label className="flex items-center gap-2 text-brand-text font-semibold text-sm mb-1">
                {c.icon}
                {c.label}
              </label>
              <p className="text-brand-muted text-xs mb-3">{c.help}</p>
              <div className="flex gap-2">
                <input
                  type={c.tipo ?? 'text'}
                  value={valores[c.key] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                  placeholder={c.placeholder}
                  className="flex-1 bg-black/30 border border-brand-border/40 rounded-xl px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/40 focus:outline-none focus:border-indigo-500/60"
                />
                <button
                  onClick={() => salvar(c.key)}
                  disabled={salvando === c.key}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  {salvando === c.key ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Seção Mercado Pago Checkout Pro */}
        <div className="space-y-4 pt-4 border-t border-brand-border/20">
          <h2 className="text-brand-text font-semibold text-lg flex items-center gap-2 border-b border-brand-border/20 pb-2">
            <CreditCard size={18} className="text-indigo-400" /> Mercado Pago (Checkout Pro)
          </h2>

          <div className="bg-white/5 border border-brand-border/30 rounded-2xl p-5 space-y-5">
            {/* 1. Ativar Experiência */}
            <div className="space-y-2">
              <label className="text-brand-text font-semibold text-sm block">
                Ativar Mercado Pago no Checkout
              </label>
              <p className="text-brand-muted text-xs">
                Selecione se deseja ativar a experiência do Mercado Pago Checkout Pro na loja.
              </p>
              <div className="flex gap-2">
                <select
                  value={valores['mp_checkout_pro_enabled'] ?? 'true'}
                  onChange={(e) => setValores((v) => ({ ...v, mp_checkout_pro_enabled: e.target.value }))}
                  className="flex-1 bg-black/30 border border-brand-border/40 rounded-xl px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-indigo-500/60 font-medium"
                >
                  <option value="true" className="bg-neutral-900 text-brand-text">Sim (Ativado)</option>
                  <option value="false" className="bg-neutral-900 text-brand-text">Não (Desativado)</option>
                </select>
                <button
                  onClick={() => salvar('mp_checkout_pro_enabled')}
                  disabled={salvando === 'mp_checkout_pro_enabled'}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  {salvando === 'mp_checkout_pro_enabled' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </div>

            {/* 2. Meios de Pagamento & Chave Pix */}
            <div className="space-y-3 pt-2 border-t border-brand-border/10">
              <label className="text-brand-text font-semibold text-sm block">
                Meios de Pagamento Aceitos
              </label>
              <p className="text-brand-muted text-xs">
                Escolha os meios de pagamento que deseja oferecer no ambiente do Mercado Pago.
              </p>
              
              <div className="space-y-2 bg-black/20 p-3.5 rounded-xl border border-brand-border/20">
                {/* Cartões */}
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span className="text-sm text-brand-text">Cartões de crédito e débito</span>
                  <input
                    type="checkbox"
                    checked={(valores['mp_accept_cards'] ?? 'true') === 'true'}
                    onChange={(e) => salvar('mp_accept_cards', e.target.checked ? 'true' : 'false')}
                    className="accent-indigo-600 w-4 h-4 rounded border-brand-border"
                  />
                </label>
                {/* Boleto / Dinheiro */}
                <label className="flex items-center justify-between cursor-pointer py-1 border-t border-brand-border/10">
                  <span className="text-sm text-brand-text">Dinheiro (Saldo Mercado Pago ou Boleto Bancário)</span>
                  <input
                    type="checkbox"
                    checked={(valores['mp_accept_ticket'] ?? 'true') === 'true'}
                    onChange={(e) => salvar('mp_accept_ticket', e.target.checked ? 'true' : 'false')}
                    className="accent-indigo-600 w-4 h-4 rounded border-brand-border"
                  />
                </label>
                {/* Pix */}
                <label className="flex items-center justify-between cursor-pointer py-1 border-t border-brand-border/10">
                  <div className="flex flex-col">
                    <span className="text-sm text-brand-text font-medium flex items-center gap-1.5">
                      Transferência bancária (Pix) 
                      <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/20 font-bold">Recomendado</span>
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={(valores['mp_accept_pix'] ?? 'true') === 'true'}
                    onChange={(e) => salvar('mp_accept_pix', e.target.checked ? 'true' : 'false')}
                    className="accent-indigo-600 w-4 h-4 rounded border-brand-border"
                  />
                </label>
              </div>

              {/* Informação sobre Chave Pix */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3">
                <AlertCircle className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-brand-muted leading-relaxed">
                  <strong className="text-brand-text font-semibold">Importante:</strong> A opção de pagamento com Pix só será exibida se houver uma Chave Pix cadastrada na sua conta do Mercado Pago.
                  <br />
                  <a
                    href="https://www.youtube.com/watch?v=60tApKYVnkA"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold underline inline-flex items-center gap-1 mt-1"
                  >
                    Clique aqui e veja o passo a passo de como cadastrar a chave <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>

            {/* 3. Máximo de Parcelas */}
            <div className="space-y-2 pt-2 border-t border-brand-border/10">
              <label className="text-brand-text font-semibold text-sm block">
                Máximo de Parcelas
              </label>
              <p className="text-brand-muted text-xs">
                Selecione o número máximo de parcelas que deseja oferecer em sua loja.
              </p>
              <div className="flex gap-2">
                <select
                  value={valores['mp_max_installments'] ?? '12'}
                  onChange={(e) => setValores((v) => ({ ...v, mp_max_installments: e.target.value }))}
                  className="flex-1 bg-black/30 border border-brand-border/40 rounded-xl px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-indigo-500/60 font-medium"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={String(n)} className="bg-neutral-900 text-brand-text">
                      {n}x {n === 1 ? '(Sem parcelamento)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => salvar('mp_max_installments')}
                  disabled={salvando === 'mp_max_installments'}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  {salvando === 'mp_max_installments' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </div>

            {/* 4. Tarifa e Parcelas sem Acréscimo (Atalho) */}
            <div className="space-y-2 pt-2 border-t border-brand-border/10">
              <label className="text-brand-text font-semibold text-sm block">
                Tarifas e Parcelamento sem Juros
              </label>
              <p className="text-brand-muted text-xs">
                As taxas cobradas por transação e a oferta de parcelas sem acréscimo para os seus clientes devem ser configuradas diretamente na sua conta do Mercado Pago.
              </p>
              <a
                href="https://www.mercadopago.com.br/costs-section#from-section=menu"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-brand-border/40 text-brand-text px-4 py-2.5 rounded-xl text-xs font-semibold transition-all mt-1"
              >
                <ExternalLink size={13} className="text-indigo-400" /> Configurar Tarifas no Mercado Pago
              </a>
            </div>

            {/* 5. Retorno Automático */}
            <div className="space-y-2 pt-2 border-t border-brand-border/10">
              <label className="text-brand-text font-semibold text-sm block">
                Retorno Automático do Cliente
              </label>
              <p className="text-brand-muted text-xs">
                Selecione se deseja que o cliente retorne automaticamente à sua loja após concluir o pagamento.
              </p>
              <div className="flex gap-2">
                <select
                  value={valores['mp_auto_return'] ?? 'approved'}
                  onChange={(e) => setValores((v) => ({ ...v, mp_auto_return: e.target.value }))}
                  className="flex-1 bg-black/30 border border-brand-border/40 rounded-xl px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-indigo-500/60 font-medium"
                >
                  <option value="approved" className="bg-neutral-900 text-brand-text">Retornar apenas em pagamentos Aprovados (Recomendado)</option>
                  <option value="all" className="bg-neutral-900 text-brand-text">Retornar em todos os casos (Aprovado, Pendente, Erro)</option>
                  <option value="off" className="bg-neutral-900 text-brand-text">Não retornar automaticamente (Desativado)</option>
                </select>
                <button
                  onClick={() => salvar('mp_auto_return')}
                  disabled={salvando === 'mp_auto_return'}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  {salvando === 'mp_auto_return' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </div>

            {/* 6. Modo Binário */}
            <div className="space-y-2 pt-2 border-t border-brand-border/10">
              <label className="text-brand-text font-semibold text-sm block">
                Modo Binário
              </label>
              <p className="text-brand-muted text-xs">
                Quando ativado, os pagamentos serão aceitos ou recusados automaticamente. Não haverá análise manual de risco (pagamento pendente para revisão).
              </p>
              <div className="flex gap-2">
                <select
                  value={valores['mp_binary_mode'] ?? 'false'}
                  onChange={(e) => setValores((v) => ({ ...v, mp_binary_mode: e.target.value }))}
                  className="flex-1 bg-black/30 border border-brand-border/40 rounded-xl px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-indigo-500/60 font-medium"
                >
                  <option value="false" className="bg-neutral-900 text-brand-text">Desativado (Permite pagamentos pendentes em revisão)</option>
                  <option value="true" className="bg-neutral-900 text-brand-text">Ativado (Aprovação ou recusa imediata)</option>
                </select>
                <button
                  onClick={() => salvar('mp_binary_mode')}
                  disabled={salvando === 'mp_binary_mode'}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  {salvando === 'mp_binary_mode' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </div>

            {/* 7. Validade das Preferências */}
            <div className="space-y-2 pt-2 border-t border-brand-border/10">
              <label className="text-brand-text font-semibold text-sm block">
                Validade do Link de Pagamento (Minutos)
              </label>
              <p className="text-brand-muted text-xs">
                Indique por quantos minutos a preferência de pagamento ficará ativa antes de expirar (deixe em branco para sem expiração). Recomendado: 60 minutos para evitar abandono com boleto/Pix pendentes.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="5"
                  max="43200"
                  value={valores['mp_preference_expiration_minutes'] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, mp_preference_expiration_minutes: e.target.value }))}
                  placeholder="Ex: 60"
                  className="flex-1 bg-black/30 border border-brand-border/40 rounded-xl px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/40 focus:outline-none focus:border-indigo-500/60"
                />
                <button
                  onClick={() => salvar('mp_preference_expiration_minutes')}
                  disabled={salvando === 'mp_preference_expiration_minutes'}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  {salvando === 'mp_preference_expiration_minutes' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* WhatsApp / Evolution API */}
        <div className="mt-8 pt-4 border-t border-brand-border/20">
          <h2 className="text-brand-text font-semibold text-sm mb-3 flex items-center gap-2">
            <span className="text-green-400">●</span> WhatsApp
          </h2>
          <WhatsAppQRCard />
        </div>

        {/* Instrução Google Search Console */}
        <div className="mt-8 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5">
          <h2 className="text-indigo-300 font-semibold text-sm mb-2 flex items-center gap-2">
            <Search size={14} /> Como verificar no Google Search Console
          </h2>
          <ol className="text-brand-muted text-xs space-y-1.5 list-decimal list-inside">
            <li>Acesse <strong className="text-brand-text">search.google.com/search-console</strong></li>
            <li>Clique em <strong className="text-brand-text">Adicionar propriedade</strong> → URL Prefix</li>
            <li>Escolha verificação por <strong className="text-brand-text">Tag HTML</strong></li>
            <li>Copie <strong className="text-brand-text">apenas o valor</strong> do atributo <code>content</code></li>
            <li>Cole no campo <strong className="text-brand-text">Google Site Verification</strong> acima e salve</li>
            <li>Volte ao GSC e clique em <strong className="text-brand-text">Verificar</strong></li>
            <li>Depois vá em <strong className="text-brand-text">Sitemaps</strong> → adicione <code>seusite.com/sitemap.xml</code></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
