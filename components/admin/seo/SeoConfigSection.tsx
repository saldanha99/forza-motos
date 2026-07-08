'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, RefreshCw, CheckCircle2, Key, Globe, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface Campo {
  key: string
  label: string
  placeholder: string
  help: string
  icon: React.ReactNode
  tipo?: 'text' | 'password'
}

const CAMPOS: Campo[] = [
  {
    key: 'google_site_verification',
    label: 'Google Site Verification',
    placeholder: 'Cole aqui o token do Search Console...',
    help: 'Vá em Search Console → Configurações → Verificação → Tag HTML → copie só o valor do atributo "content".',
    icon: <Search size={14} />,
  },
  {
    key: 'site_url',
    label: 'URL de produção',
    placeholder: 'https://forzamotos.com.br',
    help: 'URL base usada no sitemap e canonical. Deve ser o domínio real (com domínio custom, não Vercel).',
    icon: <Globe size={14} />,
  },
  {
    key: 'indexnow_key',
    label: 'IndexNow Key (Bing/Yandex)',
    placeholder: '32+ caracteres aleatórios',
    help: 'Crie o arquivo public/{chave}.txt com o mesmo valor para validar.',
    icon: <Key size={14} />,
    tipo: 'password',
  },
]

export function SeoConfigSection() {
  const [aberto, setAberto] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [salvos, setSalvos] = useState<Set<string>>(new Set())

  // Carrega configurações quando o painel for aberto
  useEffect(() => {
    if (!aberto) return
    async function carregar() {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.ok) {
          const data = await res.json()
          setValores(data)
        }
      } catch (e) {
        console.error(e)
      }
    }
    carregar()
  }, [aberto])

  async function salvar(key: string) {
    const valor = valores[key]
    if (valor === undefined || valor === '') {
      toast.error('Digite um valor antes de salvar.')
      return
    }
    setSalvando(key)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: valor }),
      })
      if (!res.ok) throw new Error()
      setSalvos((s) => new Set(s).add(key))
      toast.success('Configuração salva! Ativa no próximo deploy ou request.')
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="admin-glass border border-brand-border/30 rounded-2xl overflow-hidden">
      {/* Header — clicável para expandir */}
      <button
        onClick={() => setAberto((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Settings size={16} className="text-brand-accent" />
          <span className="font-semibold text-brand-text text-sm">Configurações SEO</span>
          <span className="text-xs text-brand-muted bg-white/5 px-2 py-0.5 rounded-full border border-brand-border/30">
            token GSC · URL · IndexNow
          </span>
        </div>
        <span className="text-brand-muted text-xs">{aberto ? '▲ fechar' : '▼ abrir'}</span>
      </button>

      {aberto && (
        <div className="px-5 pb-5 border-t border-brand-border/20">

          {/* Instrução GSC destacada */}
          <div className="mt-4 mb-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
            <p className="text-indigo-300 font-semibold text-xs mb-2 flex items-center gap-2">
              <Search size={12} /> Como verificar no Google Search Console
            </p>
            <ol className="text-brand-muted text-xs space-y-1 list-decimal list-inside">
              <li>Acesse <strong className="text-brand-text">search.google.com/search-console</strong></li>
              <li>Adicionar propriedade → <strong className="text-brand-text">URL Prefix</strong></li>
              <li>Verificação por <strong className="text-brand-text">Tag HTML</strong></li>
              <li>Copie <strong className="text-brand-text">só o valor</strong> do atributo <code>content</code></li>
              <li>Cole no campo abaixo e clique <strong className="text-brand-text">Salvar</strong></li>
              <li>Volte ao GSC e clique em <strong className="text-brand-text">Verificar</strong></li>
              <li>Em <strong className="text-brand-text">Sitemaps</strong> → adicione <code>seudominio.com.br/sitemap.xml</code></li>
            </ol>
          </div>

          {/* Campos */}
          <div className="space-y-3">
            {CAMPOS.map((c) => (
              <div key={c.key} className="bg-black/20 border border-brand-border/20 rounded-xl p-4">
                <label className="flex items-center gap-2 text-brand-text font-semibold text-xs mb-1">
                  {c.icon} {c.label}
                  {salvos.has(c.key) && (
                    <span className="ml-auto flex items-center gap-1 text-emerald-400 text-xs">
                      <CheckCircle2 size={11} /> salvo
                    </span>
                  )}
                </label>
                <p className="text-brand-muted text-xs mb-2">{c.help}</p>
                <div className="flex gap-2">
                  <input
                    type={c.tipo ?? 'text'}
                    value={valores[c.key] ?? ''}
                    onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                    placeholder={c.placeholder}
                    className="flex-1 bg-black/40 border border-brand-border/30 rounded-xl px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/40 focus:outline-none focus:border-indigo-500/50 font-mono"
                  />
                  <button
                    onClick={() => salvar(c.key)}
                    disabled={salvando === c.key}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  >
                    {salvando === c.key
                      ? <RefreshCw size={12} className="animate-spin" />
                      : <Save size={12} />}
                    Salvar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
