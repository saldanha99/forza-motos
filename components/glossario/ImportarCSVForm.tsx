'use client'

import { useState, useRef } from 'react'
import { AlertTriangle, CheckCircle2, Upload } from 'lucide-react'
import { ModeloSelector } from './ModeloSelector'
import { obterModelo } from '@/lib/glossario/ai-models'
import { Card, SectionTitle, Botao } from '@/components/admin/ui/primitives'
import { Campo, Input, Textarea, Select, AcoesFormulario } from '@/components/admin/ui/form'

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

    // Identifica provider a partir do catálogo de modelos (não do prefixo do id)
    const providerEnum = obterModelo(modeloId)?.provider === 'openai' ? 'AI_OPENAI' : 'AI_GEMINI'

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
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      {/* Upload CSV */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Arquivo</SectionTitle>
        <Campo
          label="Arquivo CSV"
          obrigatorio
          htmlFor="csv-arquivo"
          dica={
            linhasCSV > 0
              ? `Formato esperado: titulo,letra,categoria (header obrigatório). ${linhasCSV} termos detectados.`
              : 'Formato esperado: titulo,letra,categoria (header obrigatório).'
          }
        >
          <label
            htmlFor="csv-arquivo"
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand-border bg-brand-surface-2 px-4 py-3 text-sm text-brand-muted transition-colors hover:border-brand-accent"
          >
            <Upload size={16} className="shrink-0 text-brand-dim" />
            {arquivo ? arquivo.name : 'Selecione um arquivo .csv'}
          </label>
          <input
            ref={inputRef}
            id="csv-arquivo"
            type="file"
            accept=".csv"
            onChange={handleArquivo}
            className="hidden"
            required
          />
        </Campo>
      </Card>

      {/* Modelo */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Modelo de IA</SectionTitle>
        <Campo label="Modelo de IA">
          <ModeloSelector
            value={modeloId}
            onChange={setModeloId}
            quantidadeTermos={linhasCSV}
          />
        </Campo>
        {linhasCSV > 100 && (
          <p className="flex items-center gap-2 text-xs font-medium text-brand-warning">
            <AlertTriangle size={14} />
            Você está enfileirando {linhasCSV} termos. Confira a estimativa de custo
            antes de prosseguir, especialmente em modelos premium.
          </p>
        )}
      </Card>

      {/* Resto dos campos */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Configuração do texto</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo label="Nicho / Segmento" obrigatorio htmlFor="csv-nicho">
            <Input
              id="csv-nicho"
              type="text"
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              required
            />
          </Campo>

          <Campo label="Idioma" htmlFor="csv-idioma">
            <Select id="csv-idioma" value={idioma} onChange={(e) => setIdioma(e.target.value)}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">Inglês (EUA)</option>
              <option value="es-ES">Espanhol</option>
            </Select>
          </Campo>

          <Campo label="Estilo / Tom" htmlFor="csv-estilo">
            <Select id="csv-estilo" value={estilo} onChange={(e) => setEstilo(e.target.value)}>
              <option value="informativo, técnico e acessível">
                Informativo, técnico e acessível
              </option>
              <option value="profissional e formal">Profissional e formal</option>
              <option value="educativo, didático">Educativo, didático</option>
            </Select>
          </Campo>

          <Campo label="Tokens máximos por termo" htmlFor="csv-tokens">
            <Input
              id="csv-tokens"
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              min={500}
              max={8000}
              step={250}
            />
          </Campo>
        </div>

        <Campo
          label="Agendamento de publicação"
          htmlFor="csv-agendamento"
          dica="Espalha as publicações no tempo (mais natural aos olhos do Google)"
        >
          <Select
            id="csv-agendamento"
            value={agendamento}
            onChange={(e) =>
              setAgendamento(e.target.value as 'imediato' | 'diario' | 'semanal')
            }
          >
            <option value="imediato">Imediato (no próximo tick do cron)</option>
            <option value="diario">1 por dia</option>
            <option value="semanal">1 por semana</option>
          </Select>
        </Campo>

        <Campo
          label="Prompt extra (opcional)"
          htmlFor="csv-prompt-extra"
          dica="Instruções adicionais aplicadas a TODOS os termos do lote"
        >
          <Textarea
            id="csv-prompt-extra"
            value={promptExtra}
            onChange={(e) => setPromptExtra(e.target.value)}
            rows={3}
          />
        </Campo>
      </Card>

      {resultado && (
        <Card className="space-y-2 border-brand-success bg-brand-success-soft p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-success">
            <CheckCircle2 size={16} />
            {resultado.enfileirados} termos enfileirados.
          </p>
          <p className="text-sm text-brand-text">
            O cron de geração processa até 5 por hora — acompanhe o progresso em{' '}
            <a href="/admin/glossario/jobs" className="text-brand-accent underline">
              /admin/glossario/jobs
            </a>
            .
          </p>
        </Card>
      )}

      <AcoesFormulario>
        {erro && <span className="mr-auto text-sm font-medium text-brand-danger">{erro}</span>}
        <Botao type="submit" tamanho="lg" disabled={enviando || !arquivo}>
          {enviando ? 'Enviando…' : `📤 Enfileirar ${linhasCSV || ''} termos`}
        </Botao>
      </AcoesFormulario>
    </form>
  )
}
