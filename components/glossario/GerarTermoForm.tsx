'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { ModeloSelector } from './ModeloSelector'
import { Card, SectionTitle, Botao } from '@/components/admin/ui/primitives'
import { Campo, Input, Textarea, Select, Switch, AcoesFormulario } from '@/components/admin/ui/form'

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
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      {/* Termo */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Termo</SectionTitle>
        <Campo label="Termo a ser definido" obrigatorio htmlFor="termo-nome">
          <Input
            id="termo-nome"
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Ex: Pneu Radial"
            required
          />
        </Campo>
      </Card>

      {/* Modelo (DESTAQUE) */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Modelo de IA</SectionTitle>
        <Campo label="Modelo de IA" dica="Escolha conforme o custo/qualidade desejado">
          <ModeloSelector value={modeloId} onChange={setModeloId} quantidadeTermos={1} />
        </Campo>
      </Card>

      {/* Configuração do texto */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Configuração do texto</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo label="Nicho / Segmento" obrigatorio htmlFor="termo-nicho">
            <Input
              id="termo-nicho"
              type="text"
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              placeholder="Ex: peças de moto"
              required
            />
          </Campo>

          <Campo label="Idioma" htmlFor="termo-idioma">
            <Select id="termo-idioma" value={idioma} onChange={(e) => setIdioma(e.target.value)}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="pt-PT">Português (Portugal)</option>
              <option value="en-US">Inglês (EUA)</option>
              <option value="es-ES">Espanhol</option>
            </Select>
          </Campo>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo label="Estilo / Tom" htmlFor="termo-estilo">
            <Select id="termo-estilo" value={estilo} onChange={(e) => setEstilo(e.target.value)}>
              <option value="informativo, técnico e acessível">
                Informativo, técnico e acessível
              </option>
              <option value="profissional e formal">Profissional e formal</option>
              <option value="amigável e descontraído">Amigável e descontraído</option>
              <option value="educativo, didático">Educativo, didático</option>
              <option value="entusiasmado, motivacional">Entusiasmado, motivacional</option>
            </Select>
          </Campo>

          <Campo
            label="Tokens máximos"
            htmlFor="termo-tokens"
            dica="~750 = artigo curto · ~2000 = padrão · ~4000 = artigo longo"
          >
            <Input
              id="termo-tokens"
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
          label="Prompt extra (opcional)"
          htmlFor="termo-prompt-extra"
          dica="Instruções adicionais que serão concatenadas ao prompt base. Ex: 'Mencione marcas Pirelli e Michelin' ou 'Foque em motos sport'"
        >
          <Textarea
            id="termo-prompt-extra"
            value={promptExtra}
            onChange={(e) => setPromptExtra(e.target.value)}
            rows={3}
          />
        </Campo>

        <Switch
          checked={publicar}
          onChange={setPublicar}
          label="Publicar imediatamente"
          descricao="Já notifica Google + Bing. Se desmarcado, o termo fica em rascunho para revisão."
        />
      </Card>

      {/* Resultado */}
      {resultado && (
        <Card className="space-y-2 border-brand-success bg-brand-success-soft p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-success">
            <CheckCircle2 size={16} />
            Termo gerado com sucesso!
          </p>
          <ul className="space-y-1 text-sm text-brand-text">
            <li>
              <strong>ID:</strong> <code className="font-mono">{resultado.id}</code>
            </li>
            <li>
              <strong>Slug:</strong>{' '}
              <a
                href={`/glossario/${resultado.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-brand-accent underline"
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
        </Card>
      )}

      <AcoesFormulario>
        {erro && <span className="mr-auto text-sm font-medium text-brand-danger">{erro}</span>}
        <Botao type="submit" tamanho="lg" disabled={gerando || !termo}>
          {gerando ? 'Gerando…' : '✨ Gerar termo'}
        </Botao>
      </AcoesFormulario>
    </form>
  )
}
