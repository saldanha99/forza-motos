'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowRight, Link2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
  Badge, Botao, EmptyState, Tabela,
  TD_CELULA, THEAD_TH, TR_LINHA,
} from '@/components/admin/ui/primitives'
import { Campo, Input, Modal, Select } from '@/components/admin/ui/form'

interface RedirectItem {
  id: string
  from: string
  to: string
  statusCode: number
  hits: number
  ativo: boolean
  notas: string | null
  createdAt: string | Date
}

const STATUS_CODES = [
  { valor: 301, label: '301 — Permanente', dica: 'O Google memoriza e transfere o valor de SEO para o destino. Use na maioria dos casos (slug alterado, produto renomeado, página removida em definitivo).' },
  { valor: 302, label: '302 — Temporário', dica: 'O Google não transfere o SEO de forma definitiva — revisita a origem depois. Use só para desvios curtos (promoção sazonal, manutenção).' },
  { valor: 307, label: '307 — Temporário (preserva método)', dica: 'Como o 302, mas garante que POST continue POST no destino. Uso raro fora de fluxos de formulário/checkout.' },
  { valor: 308, label: '308 — Permanente (preserva método)', dica: 'Como o 301, mas garante que POST continue POST no destino. Uso raro fora de fluxos de formulário/checkout.' },
] as const

const FORM_VAZIO = {
  from: '',
  to: '',
  statusCode: 301 as number,
  notas: '',
}

/** Gerencia a lista de redirects 301: criar, editar, ativar/desativar e excluir. */
export function RedirectsManager({ redirectsIniciais }: { redirectsIniciais: RedirectItem[] }) {
  const [redirects, setRedirects] = useState(redirectsIniciais)
  const [form, setForm] = useState(FORM_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<RedirectItem | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [pendentes, setPendentes] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()
  const router = useRouter()

  function up<K extends keyof typeof FORM_VAZIO>(campo: K, v: (typeof FORM_VAZIO)[K]) {
    setForm((f) => ({ ...f, [campo]: v }))
  }

  function abrirCriacao() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErroForm(null)
    setModalAberto(true)
  }

  function abrirEdicao(r: RedirectItem) {
    setEditandoId(r.id)
    setForm({ from: r.from, to: r.to, statusCode: r.statusCode, notas: r.notas ?? '' })
    setErroForm(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErroForm(null)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErroForm(null)

    const payload = {
      from: form.from.trim(),
      to: form.to.trim(),
      statusCode: Number(form.statusCode),
      notas: form.notas.trim() || null,
    }

    try {
      const url = editandoId ? `/api/admin/seo/redirects/${editandoId}` : '/api/admin/seo/redirects'
      const res = await fetch(url, {
        method: editandoId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar redirect')

      if (editandoId) {
        setRedirects((lista) => lista.map((r) => (r.id === editandoId ? { ...r, ...data } : r)))
        toast.success('Redirect atualizado')
      } else {
        setRedirects((lista) => [data, ...lista])
        toast.success('Redirect criado')
      }
      fecharModal()
      router.refresh()
    } catch (err: any) {
      setErroForm(err.message)
    } finally {
      setSalvando(false)
    }
  }

  function alternarAtivo(r: RedirectItem) {
    const novoValor = !r.ativo
    setRedirects((lista) => lista.map((x) => (x.id === r.id ? { ...x, ativo: novoValor } : x)))
    setPendentes((p) => ({ ...p, [r.id]: true }))

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/seo/redirects/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativo: novoValor }),
        })
        if (!res.ok) throw new Error()
        toast.success(novoValor ? 'Redirect ativado' : 'Redirect desativado')
        router.refresh()
      } catch {
        setRedirects((lista) => lista.map((x) => (x.id === r.id ? { ...x, ativo: !novoValor } : x)))
        toast.error('Não foi possível atualizar. Tente novamente.')
      } finally {
        setPendentes((p) => ({ ...p, [r.id]: false }))
      }
    })
  }

  async function confirmarExclusao() {
    if (!excluindo) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/admin/seo/redirects/${excluindo.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao excluir redirect')
      }
      setRedirects((lista) => lista.filter((x) => x.id !== excluindo.id))
      toast.success('Redirect excluído')
      setExcluindo(null)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-brand-muted">
          {redirects.length} redirect{redirects.length !== 1 ? 's' : ''} cadastrado{redirects.length !== 1 ? 's' : ''}
        </p>
        <Botao type="button" onClick={abrirCriacao}>
          <Plus size={16} /> Novo redirect
        </Botao>
      </div>

      {redirects.length === 0 ? (
        <EmptyState
          icone={Link2}
          titulo="Nenhum redirect cadastrado"
          descricao='Clique em "Novo redirect" para cadastrar um redirecionamento de URL antiga para URL nova.'
          acao={
            <Botao type="button" onClick={abrirCriacao}>
              <Plus size={16} /> Novo redirect
            </Botao>
          }
        />
      ) : (
        <Tabela
          cabecalho={
            <>
              <th className={THEAD_TH}>De</th>
              <th className={THEAD_TH}>Para</th>
              <th className={THEAD_TH}>Status</th>
              <th className={THEAD_TH}>Hits</th>
              <th className={THEAD_TH}>Ativo</th>
              <th className={THEAD_TH}>Criado</th>
              <th className={THEAD_TH}>Ações</th>
            </>
          }
        >
          {redirects.map((r) => (
            <tr key={r.id} className={cn(TR_LINHA, !r.ativo && 'opacity-70')}>
              <td className={cn(TD_CELULA, 'font-mono text-xs text-brand-text')}>{r.from}</td>
              <td className={cn(TD_CELULA, 'font-mono text-xs text-brand-muted')}>
                <ArrowRight size={11} className="mr-1 inline" />
                {r.to}
              </td>
              <td className={TD_CELULA}>
                <Badge tom="info">{r.statusCode}</Badge>
              </td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>{r.hits}</td>
              <td className={TD_CELULA}>
                <button
                  type="button"
                  onClick={() => alternarAtivo(r)}
                  disabled={!!pendentes[r.id]}
                  className="disabled:opacity-50"
                  title={r.ativo ? 'Clique para desativar' : 'Clique para ativar'}
                >
                  <Badge tom={r.ativo ? 'success' : 'neutro'}>{r.ativo ? 'Ativo' : 'Off'}</Badge>
                </button>
              </td>
              <td className={cn(TD_CELULA, 'text-xs text-brand-muted')}>{formatDate(r.createdAt)}</td>
              <td className={TD_CELULA}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => abrirEdicao(r)}
                    title="Editar"
                    className="rounded-lg p-1.5 text-brand-muted transition-colors hover:bg-brand-tint-2 hover:text-brand-text"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcluindo(r)}
                    title="Excluir"
                    className="rounded-lg p-1.5 text-brand-muted transition-colors hover:bg-brand-danger-soft hover:text-brand-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Tabela>
      )}

      {/* Modal de criação/edição */}
      <Modal
        aberto={modalAberto}
        aoFechar={fecharModal}
        titulo={editandoId ? 'Editar redirect' : 'Novo redirect'}
        descricao="Redireciona uma URL antiga para uma URL nova, preservando o SEO acumulado."
        rodape={
          <>
            <Botao type="button" variante="fantasma" onClick={fecharModal}>
              Cancelar
            </Botao>
            <Botao type="submit" form="form-redirect" disabled={salvando}>
              {salvando ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Criar redirect'}
            </Botao>
          </>
        }
      >
        <form id="form-redirect" onSubmit={salvar} className="space-y-4">
          <Campo
            label="De (URL antiga)"
            dica='Path da página antiga, começando com "/". Ex.: /produto-antigo'
            obrigatorio
            htmlFor="rd-from"
            erro={erroForm && erroForm.toLowerCase().includes('from') ? erroForm : undefined}
          >
            <Input
              id="rd-from"
              value={form.from}
              onChange={(e) => up('from', e.target.value)}
              placeholder="/produto-antigo"
              required
            />
          </Campo>

          <Campo
            label="Para (URL nova)"
            dica='Path novo começando com "/" ou uma URL absoluta (http:// ou https://).'
            obrigatorio
            htmlFor="rd-to"
          >
            <Input
              id="rd-to"
              value={form.to}
              onChange={(e) => up('to', e.target.value)}
              placeholder="/produto-novo"
              required
            />
          </Campo>

          <Campo
            label="Tipo de redirecionamento"
            dica={STATUS_CODES.find((s) => s.valor === Number(form.statusCode))?.dica}
            obrigatorio
            htmlFor="rd-status"
          >
            <Select
              id="rd-status"
              value={form.statusCode}
              onChange={(e) => up('statusCode', Number(e.target.value))}
            >
              {STATUS_CODES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Notas internas" dica="Opcional — motivo do redirect, útil pra quem revisar depois." htmlFor="rd-notas">
            <Input
              id="rd-notas"
              value={form.notas}
              onChange={(e) => up('notas', e.target.value)}
              placeholder="Ex.: produto descontinuado, migrado para o kit"
            />
          </Campo>

          {erroForm && !erroForm.toLowerCase().includes('from') && (
            <p className="text-xs font-medium text-brand-danger">{erroForm}</p>
          )}
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal
        aberto={!!excluindo}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir redirect?"
        descricao={excluindo ? `"${excluindo.from}" deixará de redirecionar para "${excluindo.to}". Essa ação não pode ser desfeita.` : undefined}
        largura="max-w-sm"
        rodape={
          <>
            <Botao type="button" variante="fantasma" onClick={() => setExcluindo(null)}>
              Cancelar
            </Botao>
            <Botao type="button" variante="perigo" onClick={confirmarExclusao} disabled={salvando}>
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Excluir
            </Botao>
          </>
        }
      >
        <p className="text-sm text-brand-muted">
          Se este redirect ainda tiver tráfego (veja a coluna Hits), considere desativá-lo em vez de excluir.
        </p>
      </Modal>
    </div>
  )
}
