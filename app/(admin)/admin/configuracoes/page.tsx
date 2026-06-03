'use client'

import { useState } from 'react'
import { Save, Globe, Search, RefreshCw, Key } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const [salvando, setSalvando] = useState<string | null>(null)

  async function salvar(key: string) {
    setSalvando(key)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: valores[key] ?? '' }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast.success('Salvo com sucesso!')
    } catch {
      toast.error('Erro ao salvar configuração.')
    } finally {
      setSalvando(null)
    }
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

      <div className="space-y-4">
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
  )
}
