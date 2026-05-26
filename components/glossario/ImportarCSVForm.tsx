'use client'

import { useState, useRef } from 'react'
import { ModeloSelector } from './ModeloSelector'

/**
 * Formulário de importação CSV em massa — réplica modernizada do
 * upload de CSV do Glossário Ninja.
 *
 * Permite enfileirar centenas/milhares de termos de uma vez,
 * escolhendo modelo de IA, agendamento e prompt customizado.
 *
 * Mostra estimativa de custo em BRL ANTES de subir, com base no
 * número de linhas do CSV × preço do modelo selecionado.
 */
export function ImportarCSVForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [linhasCSV, setLinhasCSV] = useState<number>(0)

  const [nicho, setNicho] = useState('peças e acessórios de moto')
  const [estilo, setEstilo] = useState('informativo, técnico e acessível')
  const [idioma, setIdioma] = useState('pt-BR')
  const [maxTokens, setMaxTokens] = useState(2000)
  const [promptExtra, setPromptExtra] = useState('')
  const [modeloId, setModeloId] = useState('gemini-2.0-flash')
  const [agendamento, setAgendamento] = useState<'imediato' | 'diario' | 'semanal'>(
    'diario'
  )

  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ enfileirados: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArquivo(file)
    const texto = await file.text()
    // Conta linhas não-vazias menos o header
    const linhas = texto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean).length
    setLinhasCSV(Math.max(0, linhas - 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!arquivo) {
      setErro('Selecione um arquivo CSV')
      return
    }
    setErro(null)
    setResultado(null)
    setEnviando(true)

    // Identifica provider a partir do modelo selecionado
    const providerEnum = modeloId.startsWith('gpt') ? 'AI_OPENAI' : 'AI_GEMINI'

    const fd = new FormData()
    fd.append('csv', arquivo)
    fd.append('nicho', nicho)
    fd.append('modelo', modeloId)
    fd.append('provider', providerEnum)
    fd.append('idioma', idioma)
    fd.append('estilo', estilo)
    fd.append('maxTokens', String(maxTokens))
    fd.append('agendamento', agendamento)
    if (promptExtra) fd.append('promptExtra', promptExtra)

    try {
      const res = await fetch('/api/glossario/import-csv', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao importar')
      setResultado(json)
      // Limpa o input
      setArquivo(null)
      setLinhasCSV(0)
      if (inputRef.current) inputRef.current.value = ''
    } catch (e: any) {
      setErro(String(e?.message || e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Upload CSV */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Arquivo CSV <span className="text-red-500">*</span>
        </label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleArquivo}
          className="w-full text-sm"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Formato esperado: <code className="font-mono">titulo,letra,categoria</code>{' '}
          (header obrigatório).{' '}
          {linhasCSV > 0 && (
            <span className="text-foreground font-medium">
              {linhasCSV} termos detectados.
            </span>
          )}
        </p>
      </div>

      {/* Modelo */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Modelo de IA</label>
        <ModeloSelector
          value={modeloId}
          onChange={setModeloId}
          quantidadeTermos={linhasCSV}
        />
        {linhasCSV > 100 && (
          <p className="mt-2 text-xs text-amber-600">
            ⚠️ Você está enfileirando {linhasCSV} termos. Confira a estimativa de
            custo antes de prosseguir, especialmente em modelos premium.
          </p>
        )}
      </div>

      {/* Resto dos campos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nicho / Segmento" required>
          <input
            type="text"
            value={nicho}
            onChange={(e) => setNicho(e.target.value)}
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
            <option value="en-US">Inglês (EUA)</option>
            <option value="es-ES">Espanhol</option>
          </select>
        </Field>

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
            <option value="educativo, didático">Educativo, didático</option>
          </select>
        </Field>

        <Field label="Tokens máximos por termo">
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

      <Field
        label="Agendamento de publicação"
        hint="Espalha as publicações no tempo (mais natural aos olhos do Google)"
      >
        <select
          value={agendamento}
          onChange={(e) =>
            setAgendamento(e.target.value as 'imediato' | 'diario' | 'semanal')
          }
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="imediato">Imediato (no próximo tick do cron)</option>
          <option value="diario">1 por dia</option>
          <option value="semanal">1 por semana</option>
        </select>
      </Field>

      <Field
        label="Prompt extra (opcional)"
        hint="Instruções adicionais aplicadas a TODOS os termos do lote"
      >
        <textarea
          value={promptExtra}
          onChange={(e) => setPromptExtra(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-md resize-y"
        />
      </Field>

      <div className="flex items-center gap-3 pt-4 border-t">
        <button
          type="submit"
          disabled={enviando || !arquivo}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : `📤 Enfileirar ${linhasCSV || ''} termos`}
        </button>
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </div>

      {resultado && (
        <div className="p-4 border-2 border-green-500 bg-green-50 dark:bg-green-950 rounded-md">
          <p className="text-green-900 dark:text-green-100">
            ✅ <strong>{resultado.enfileirados} termos enfileirados.</strong> O cron
            de geração processa até 5 por hora — acompanhe o progresso em{' '}
            <a href="/admin/glossario/jobs" className="underline">
              /admin/glossario/jobs
            </a>
            .
          </p>
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
      <label className="block text-sm font-medium mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
