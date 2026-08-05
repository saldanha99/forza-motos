'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, Globe, Key, RefreshCw, Save, Search, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Botao, Card } from '@/components/admin/ui/primitives'
import { Campo, Input } from '@/components/admin/ui/form'

interface CampoConfig {
  key: string
  label: string
  placeholder: string
  help: string
  icon: React.ReactNode
  tipo?: 'text' | 'password'
}

const CAMPOS: CampoConfig[] = [
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
    <Card className="overflow-hidden">
      {/* Header — clicável para expandir */}
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-brand-tint-1"
      >
        <div className="flex items-center gap-3">
          <Settings size={16} className="text-brand-accent" />
          <span className="text-sm font-semibold text-brand-text">Configurações SEO</span>
          <span className="rounded-full border border-brand-border bg-brand-surface-2 px-2 py-0.5 text-xs text-brand-muted">
            token GSC · URL · IndexNow
          </span>
        </div>
        <ChevronDown
          size={16}
          className={cn('text-brand-dim transition-transform', aberto && 'rotate-180')}
        />
      </button>

      {aberto && (
        <div className="border-t border-brand-hair px-5 pb-5">
          {/* Instrução GSC destacada */}
          <div className="mb-4 mt-4 rounded-xl border border-brand-border bg-brand-info-soft p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-brand-info">
              <Search size={12} /> Como verificar no Google Search Console
            </p>
            <ol className="list-inside list-decimal space-y-1 text-xs text-brand-muted">
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
              <div key={c.key} className="rounded-xl border border-brand-border bg-brand-surface-2 p-4">
                <Campo
                  label={c.label}
                  dica={c.help}
                  htmlFor={`seo-config-${c.key}`}
                >
                  <div className="flex gap-2">
                    <Input
                      id={`seo-config-${c.key}`}
                      type={c.tipo ?? 'text'}
                      value={valores[c.key] ?? ''}
                      onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                      placeholder={c.placeholder}
                      className="font-mono"
                    />
                    <Botao
                      type="button"
                      tamanho="sm"
                      onClick={() => salvar(c.key)}
                      disabled={salvando === c.key}
                      className="shrink-0"
                    >
                      {salvando === c.key ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      Salvar
                    </Botao>
                  </div>
                </Campo>
                {salvos.has(c.key) && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-brand-success">
                    <CheckCircle2 size={11} /> salvo
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
