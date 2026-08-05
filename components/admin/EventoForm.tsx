'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Upload, X, Plus, ImagePlus } from 'lucide-react'
import { cn, gerarSlug } from '@/lib/utils'
import { Card, CardHeader, Botao } from '@/components/admin/ui/primitives'
import { Campo, Input, Textarea, Select, Switch, AcoesFormulario } from '@/components/admin/ui/form'

const CATEGORIAS = ['Curso', 'Passeio', 'Viagem', 'Evento', 'Corrida', 'Encontro', 'Workshop']

interface Evento {
  id?: string
  titulo?: string
  slug?: string
  descricao?: string
  conteudo?: string
  dataInicio?: string
  dataFim?: string | null
  local?: string
  endereco?: string | null
  imagemUrl?: string | null
  galeria?: string[] | null
  opcoesVaga?: { label: string; preco: number }[] | null
  preco?: number | string
  categoria?: string
  vagas?: number | null
  linkExterno?: string | null
  ativo?: boolean
  publicado?: boolean
  destaque?: boolean
}

function toInputDate(val?: string | null) {
  if (!val) return ''
  return new Date(val).toISOString().slice(0, 16)
}

/** Botão de upload disfarçado de secundário — dispara o input de arquivo escondido. */
const BOTAO_UPLOAD =
  'inline-flex cursor-pointer select-none items-center gap-2 rounded-xl border border-brand-border bg-brand-surface-2 px-4 py-2.5 text-sm font-semibold text-brand-text transition hover:border-brand-border-strong hover:bg-brand-elevated'

/** Botão redondo de remoção sobre miniatura de imagem. */
const BOTAO_REMOVER_IMG =
  'absolute right-2 top-2 rounded-lg border border-brand-border bg-brand-surface p-1.5 text-brand-muted transition-colors hover:border-brand-danger hover:bg-brand-danger-soft hover:text-brand-danger'

export function EventoForm({ evento }: { evento?: Evento }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    titulo: evento?.titulo ?? '',
    slug: evento?.slug ?? '',
    descricao: evento?.descricao ?? '',
    conteudo: evento?.conteudo ?? '',
    dataInicio: toInputDate(evento?.dataInicio),
    dataFim: toInputDate(evento?.dataFim),
    local: evento?.local ?? '',
    endereco: evento?.endereco ?? '',
    imagemUrl: evento?.imagemUrl ?? '',
    galeria: (evento?.galeria ?? []) as string[],
    opcoesVaga: (evento?.opcoesVaga ?? []) as { label: string; preco: number }[],
    preco: String(evento?.preco ?? '0'),
    categoria: evento?.categoria ?? 'Evento',
    vagas: String(evento?.vagas ?? ''),
    linkExterno: evento?.linkExterno ?? '',
    ativo: evento?.ativo ?? true,
    publicado: evento?.publicado ?? false,
    destaque: evento?.destaque ?? false,
  })

  function update(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }))
    if (field === 'titulo') {
      setForm((f) => ({ ...f, slug: gerarSlug(value), titulo: value }))
    }
  }

  async function uploadImagem(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('pasta', 'eventos')
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      const data = await res.json()
      update('imagemUrl', data.url)
      toast.success('Imagem enviada!')
    } catch {
      toast.error('Erro ao enviar imagem')
    }
  }

  async function uploadGaleria(files: FileList) {
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pasta', 'eventos')
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setForm((f) => ({ ...f, galeria: [...f.galeria, data.url] }))
      } catch {
        toast.error(`Erro ao enviar ${file.name}`)
      }
    }
    toast.success('Fotos adicionadas à galeria!')
  }

  function removerDaGaleria(idx: number) {
    setForm((f) => ({ ...f, galeria: f.galeria.filter((_, i) => i !== idx) }))
  }

  function addOpcaoVaga() {
    setForm((f) => ({ ...f, opcoesVaga: [...f.opcoesVaga, { label: '', preco: Number(f.preco) || 0 }] }))
  }
  function updateOpcaoVaga(idx: number, campo: 'label' | 'preco', valor: string) {
    setForm((f) => ({
      ...f,
      opcoesVaga: f.opcoesVaga.map((o, i) => (i === idx ? { ...o, [campo]: campo === 'preco' ? Number(valor) || 0 : valor } : o)),
    }))
  }
  function removerOpcaoVaga(idx: number) {
    setForm((f) => ({ ...f, opcoesVaga: f.opcoesVaga.filter((_, i) => i !== idx) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url = evento?.id ? `/api/admin/eventos/${evento.id}` : '/api/admin/eventos'
      const method = evento?.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          preco: parseFloat(form.preco) || 0,
          vagas: form.vagas ? parseInt(form.vagas) : null,
          dataFim: form.dataFim || null,
          endereco: form.endereco || null,
          imagemUrl: form.imagemUrl || null,
          galeria: form.galeria,
          opcoesVaga: form.opcoesVaga.filter((o) => o.label.trim()),
          linkExterno: form.linkExterno || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(evento?.id ? 'Evento atualizado!' : 'Evento criado!')
      router.push('/admin/eventos')
      router.refresh()
    } catch {
      toast.error('Erro ao salvar evento')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!evento?.id) return
    if (!confirm('Excluir este evento? Esta ação não pode ser desfeita.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/eventos/${evento.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Evento excluído!')
      router.push('/admin/eventos')
      router.refresh()
    } catch {
      toast.error('Erro ao excluir evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dados principais */}
      <Card>
        <CardHeader titulo="Dados do evento" />
        <div className="space-y-5 p-5">
          <Campo label="Título" obrigatorio htmlFor="evt-titulo">
            <Input id="evt-titulo" value={form.titulo} onChange={(e) => update('titulo', e.target.value)} required />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Slug" htmlFor="evt-slug">
              <Input id="evt-slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
            </Campo>
            <Campo label="Categoria" htmlFor="evt-categoria">
              <Select id="evt-categoria" value={form.categoria} onChange={(e) => update('categoria', e.target.value)}>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Campo>
          </div>

          <Campo label="Descrição curta" obrigatorio dica="Aparece na listagem pública de eventos." htmlFor="evt-descricao">
            <Textarea
              id="evt-descricao"
              value={form.descricao}
              onChange={(e) => update('descricao', e.target.value)}
              rows={3}
              required
              placeholder="Breve descrição do evento (aparece na listagem)"
            />
          </Campo>
        </div>
      </Card>

      {/* Data e local */}
      <Card>
        <CardHeader titulo="Data e local" />
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Data de início" obrigatorio htmlFor="evt-data-inicio">
              <Input
                id="evt-data-inicio"
                type="datetime-local"
                value={form.dataInicio}
                onChange={(e) => update('dataInicio', e.target.value)}
                required
              />
            </Campo>
            <Campo label="Data de término" htmlFor="evt-data-fim">
              <Input
                id="evt-data-fim"
                type="datetime-local"
                value={form.dataFim}
                onChange={(e) => update('dataFim', e.target.value)}
              />
            </Campo>
          </div>

          <Campo label="Local" obrigatorio htmlFor="evt-local">
            <Input
              id="evt-local"
              value={form.local}
              onChange={(e) => update('local', e.target.value)}
              required
              placeholder="Ex: Kartódromo Granja Viana"
            />
          </Campo>
          <Campo label="Endereço completo" htmlFor="evt-endereco">
            <Input
              id="evt-endereco"
              value={form.endereco}
              onChange={(e) => update('endereco', e.target.value)}
              placeholder="Rua, número, cidade, estado"
            />
          </Campo>
        </div>
      </Card>

      {/* Preço e inscrição */}
      <Card>
        <CardHeader titulo="Preço e inscrição" />
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Preço (R$)" dica="0 = gratuito" htmlFor="evt-preco">
              <Input
                id="evt-preco"
                type="number"
                min="0"
                step="0.01"
                value={form.preco}
                onChange={(e) => update('preco', e.target.value)}
              />
            </Campo>
            <Campo label="Vagas disponíveis" dica="Deixe vazio = sem limite" htmlFor="evt-vagas">
              <Input
                id="evt-vagas"
                type="number"
                min="1"
                value={form.vagas}
                onChange={(e) => update('vagas', e.target.value)}
              />
            </Campo>
          </div>

          <Campo label="Link de inscrição externo (opcional)" htmlFor="evt-link">
            <Input
              id="evt-link"
              value={form.linkExterno}
              onChange={(e) => update('linkExterno', e.target.value)}
              placeholder="https://..."
            />
          </Campo>
        </div>
      </Card>

      {/* Imagem */}
      <Card>
        <CardHeader titulo="Imagem de capa" />
        <div className="space-y-5 p-5">
          {form.imagemUrl && (
            <div className="relative overflow-hidden rounded-xl border border-brand-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- altura variável (max-h sem contêiner com dimensão fixa); next/image exigiria fill com altura fixa, mudando o layout */}
              <img src={form.imagemUrl} alt="capa" className="max-h-56 w-full object-cover" />
              <button type="button" onClick={() => update('imagemUrl', '')} className={BOTAO_REMOVER_IMG}>
                <X size={14} />
              </button>
            </div>
          )}
          <label className={BOTAO_UPLOAD}>
            <Upload size={16} />
            Enviar imagem
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImagem(e.target.files[0])} />
          </label>
        </div>
      </Card>

      {/* Galeria / carrossel */}
      <Card>
        <CardHeader titulo="Galeria (carrossel)" />
        <div className="space-y-5 p-5">
          <p className="text-xs text-brand-dim">
            Fotos de passeios anteriores, roteiro e pontos que serão visitados — aparecem em carrossel na página do evento.
          </p>

          {form.galeria.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {form.galeria.map((url, idx) => (
                <div key={url + idx} className="group/img relative aspect-square overflow-hidden rounded-xl border border-brand-border">
                  <Image src={url} alt={`Foto ${idx + 1}`} fill sizes="(max-width: 640px) 33vw, 25vw" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => removerDaGaleria(idx)}
                    className={cn(BOTAO_REMOVER_IMG, 'right-1.5 top-1.5 p-1 opacity-0 group-hover/img:opacity-100')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className={BOTAO_UPLOAD}>
            <ImagePlus size={16} />
            Adicionar fotos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && e.target.files.length > 0 && uploadGaleria(e.target.files)}
            />
          </label>
        </div>
      </Card>

      {/* Opções de vaga */}
      <Card>
        <CardHeader titulo="Opções de vaga (evento pago)" />
        <div className="space-y-5 p-5">
          <p className="text-xs text-brand-dim">
            Ex: "Sozinho" (piloto só), "Com garupa" (+1 pessoa), "Quarto dividido em 4" (preço por pessoa).
            Se deixar vazio, o cliente só escolhe a quantidade pelo preço base.
          </p>

          {form.opcoesVaga.map((op, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Input
                aria-label={`Rótulo da opção de vaga ${idx + 1}`}
                value={op.label}
                onChange={(e) => updateOpcaoVaga(idx, 'label', e.target.value)}
                placeholder="Ex: Com garupa"
                className="flex-1"
              />
              <div className="relative w-40">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-dim">R$</span>
                <Input
                  aria-label={`Preço da opção de vaga ${idx + 1}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={op.preco}
                  onChange={(e) => updateOpcaoVaga(idx, 'preco', e.target.value)}
                  className="pl-9"
                />
              </div>
              <button
                type="button"
                onClick={() => removerOpcaoVaga(idx)}
                className="rounded-xl p-2.5 text-brand-muted transition-colors hover:bg-brand-danger-soft hover:text-brand-danger"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addOpcaoVaga}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-accent transition-colors hover:text-brand-accent-hover"
          >
            <Plus size={15} /> Adicionar opção de vaga
          </button>
        </div>
      </Card>

      {/* Conteúdo */}
      <Card>
        <CardHeader titulo="Conteúdo completo (HTML)" />
        <div className="p-5">
          <Textarea
            aria-label="Conteúdo completo em HTML"
            value={form.conteudo}
            onChange={(e) => update('conteudo', e.target.value)}
            rows={14}
            className="font-mono"
            placeholder="<p>Programação, roteiro, inclui e não inclui...</p>"
          />
        </div>
      </Card>

      {/* Flags */}
      <Card>
        <CardHeader titulo="Configurações" />
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
          <Switch
            checked={form.publicado}
            onChange={(v) => update('publicado', v)}
            label="Publicar no site"
            descricao="Fica visível na página pública de eventos."
          />
          <Switch
            checked={form.destaque}
            onChange={(v) => update('destaque', v)}
            label="Destacar na home"
            descricao="Aparece em posição de destaque."
          />
          <Switch
            checked={form.ativo}
            onChange={(v) => update('ativo', v)}
            label="Ativo"
            descricao="Desative para tirar de circulação sem excluir."
          />
        </div>
      </Card>

      <AcoesFormulario>
        {evento?.id && (
          <Botao type="button" variante="perigo" tamanho="lg" onClick={handleDelete} disabled={loading}>
            Excluir
          </Botao>
        )}
        <Botao type="button" variante="fantasma" tamanho="lg" onClick={() => router.back()}>
          Cancelar
        </Botao>
        <Botao type="submit" variante="primario" tamanho="lg" disabled={loading}>
          {loading ? 'Salvando…' : evento?.id ? 'Salvar alterações' : 'Criar evento'}
        </Botao>
      </AcoesFormulario>
    </form>
  )
}
