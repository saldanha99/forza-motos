'use client'

import { useState } from 'react'
import { ModeloSelector } from './ModeloSelector'

/**
 * Formulário de geração de termo via IA — réplica modernizada do
 * "Gerador via ChatGPT" do plugin Glossário Ninja.
 *
 * Campos espelhados do plugin original:
 *   - Modelo (catálogo Gemini + OpenAI com preços)
 *   - Nicho / Segmento
 *   - Idioma
 *   - Estilo / Tom
 *   - Tokens máximos
 *   - Prompt extra (instruções adicionais)
 *
 * Diferenças (melhorias) sobre o plugin original:
 *   - Cards visuais ao invés de dropdown
 *   - Preço estimado em BRL antes de gerar
 *   - Validação automática do modelo
 *   - Suporta Gemini E OpenAI
 *
 * Uso:
 *
 *   import { GerarTermoForm } from '@/components/glossario/GerarTermoForm'
 *
 *   <GerarTermoForm onSucesso={(termoId) => router.push(`/admin/glossario/${termoId}`)} />
 */

interface Props {
  onSucesso?: (termoId: string, slug: string) => void
}

export function GerarTermoForm({ onSucesso }: Props) {
  const [termo, setTermo] = useState('')
  const [nicho, setNicho] = useState('peças e acessórios de moto')
  const [idioma, setIdioma] = useState('pt-BR')
  const [estilo, setEstilo] = useState('informativo, técnico e acessível')
  const [maxTokens, setMaxTokens] = useState(2000)
  const [promptExtra, setPromptExtra] = useState('')
  const [modeloId, setModeloId] = useState('gemini-2.0-flash')
  const [publicar, setPublicar] = useState(false)

  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{
    id: string
    slug: string
    preview: string
    provider: string
    modelo: string
  } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setResultado(null)
    setGerando(true)

    try {
      const res = await fetch('/api/glossario/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termo,
          nicho,
          idioma,
          estilo,
          maxTokens,
          promptExtra: promptExtra || undefined,
          modelo: modeloId,
          publicar,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar')

      setResultado(json)
      onSucesso?.(json.id, json.slug)
    } catch (e: any) {
      setErro(String(e?.message || e))
    } finally {
      setGerando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Termo */}
      <Field label="Termo a ser definido" required>
        <input
          type="text"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Ex: Pneu Radial"
          required
          className="w-full px-3 py-2 border rounded-md"
        />
      </Field>

      {/* Modelo (DESTAQUE) */}
      <Field label="Modelo de IA" hint="Escolha conforme o custo/qualidade desejado">
        <ModeloSelector value={modeloId} onChange={setModeloId} quantidadeTermos={1} />
      </Field>

      {/* Linha: nicho + idioma */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nicho / Segmento" required>
          <input
            type="text"
            value={nicho}
            onChange={(e) => setNicho(e.target.value)}
            placeholder="Ex: peças de moto"
            required
            className="w-full px-3 py-2 border rounded-md"
          />
        </Field>

        <Field label="Idioma">
          <select
            value={idioma}
            onChange={(e) => setIdioma(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="pt-PT">Português (Portugal)</option>
            <option value="en-US">Inglês (EUA)</option>
            <option value="es-ES">Espanhol</option>
          </select>
        </Field>
      </div>

      {/* Linha: estilo + maxTokens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Estilo / Tom">
          <select
            value={estilo}
            onChange={(e) => setEstilo(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="informativo, técnico e acessível">
              Informativo, técnico e acessível
            </option>
            <option value="profissional e formal">Profissional e formal</option>
            <option value="amigável e descontraído">Amigável e descontraído</option>
            <option value="educativo, didático">Educativo, didático</option>
            <option value="entusiasmado, motivacional">Entusiasmado, motivacional</option>
          </select>
        </Field>

        <Field label="Tokens máximos" hint="~750 = artigo curto · ~2000 = padrão · ~4000 = artigo longo">
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            min={500}
            max={8000}
            step={250}
            className="w-full px-3 py-2 border rounded-md"
          />
        </Field>
      </div>

      {/* Prompt extra */}
      <Field
        label="Prompt extra (opcional)"
        hint="Instruções adicionais que serão concatenadas ao prompt base. Ex: 'Mencione marcas Pirelli e Michelin' ou 'Foque em motos sport'"
      >
        <textarea
          value={promptExtra}
          onChange={(e) => setPromptExtra(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-md resize-y"
        />
      </Field>

      {/* Publicar */}
      <Field label="">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={publicar}
            onChange={(e) => setPublicar(e.target.checked)}
          />
          Publicar imediatamente (já notifica Google + Bing). Se desmarcado, o
          termo fica em rascunho para revisão.
        </label>
      </Field>

      {/* Botões */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <button
          type="submit"
          disabled={gerando || !termo}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50"
        >
          {gerando ? 'Gerando...' : '✨ Gerar termo'}
        </button>
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="p-4 border-2 border-green-500 bg-green-50 dark:bg-green-950 rounded-md">
          <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
            ✅ Termo gerado com sucesso!
          </h3>
          <ul className="text-sm space-y-1 text-green-900 dark:text-green-100">
            <li>
              <strong>ID:</strong> <code className="font-mono">{resultado.id}</code>
            </li>
            <li>
              <strong>Slug:</strong>{' '}
              <a
                href={`/glossario/${resultado.slug}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                /glossario/{resultado.slug}
              </a>
            </li>
            <li>
              <strong>Provider:</strong> {resultado.provider} ({resultado.modelo})
            </li>
            <li>
              <strong>Resumo:</strong> {resultado.preview}
            </li>
          </ul>
        </div>
      )}
    </form>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
