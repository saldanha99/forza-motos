'use client'

/**
 * Quem entra no painel e o que cada um enxerga.
 *
 * O papel dá o conjunto padrão; as caixas marcadas sobrescrevem esse padrão.
 * ADMIN não tem caixas: ele enxerga tudo por definição, e deixar as caixas
 * visíveis daria a impressão de que dá para tirar acesso dele.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, Trash2, Power, KeyRound, ShieldCheck, Check, X, Pencil } from 'lucide-react'
import { Card, Botao, Badge, EmptyState } from '@/components/admin/ui/primitives'
import { Campo, Input, Select, Modal } from '@/components/admin/ui/form'
import { AREAS_CONCEDIVEIS, type ChaveArea } from '@/lib/admin/permissoes'

export interface UsuarioPainel {
  id: string
  nome: string | null
  email: string
  role: 'ADMIN' | 'MARKETING'
  ativo: boolean
  permissoes: ChaveArea[]
  permissoesSalvas: ChaveArea[]
}

const FORM_VAZIO = {
  nome: '',
  email: '',
  senha: '',
  role: 'MARKETING' as 'ADMIN' | 'MARKETING',
  permissoes: ['marketing'] as ChaveArea[],
}

export function UsuariosManager({
  usuariosIniciais,
  meuId,
}: {
  usuariosIniciais: UsuarioPainel[]
  /** Id de quem está logado — trava as ações sobre si mesmo na tela */
  meuId: string
}) {
  const [usuarios, setUsuarios] = useState(usuariosIniciais)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<{ role: 'ADMIN' | 'MARKETING'; permissoes: ChaveArea[] }>({
    role: 'MARKETING',
    permissoes: [],
  })
  const [senhaDe, setSenhaDe] = useState<UsuarioPainel | null>(null)
  const [novaSenha, setNovaSenha] = useState('')

  function alternar(lista: ChaveArea[], chave: ChaveArea): ChaveArea[] {
    return lista.includes(chave) ? lista.filter((c) => c !== chave) : [...lista, chave]
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário')
      setUsuarios((u) => [...u, data])
      setForm(FORM_VAZIO)
      setModalAberto(false)
      toast.success('Usuário criado — já pode entrar com esse e-mail e senha.')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function salvar(id: string, campos: Record<string, unknown>, mensagem: string) {
    setSalvando(true)
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar usuário')
      setUsuarios((u) => u.map((x) => (x.id === id ? data : x)))
      toast.success(mensagem)
      return true
    } catch (err: any) {
      toast.error(err.message)
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function remover(u: UsuarioPainel) {
    if (!confirm(`Apagar o acesso de ${u.nome ?? u.email}?`)) return
    setSalvando(true)
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao apagar usuário')
      setUsuarios((lista) => lista.filter((x) => x.id !== u.id))
      toast.success('Acesso removido.')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!senhaDe) return
    const ok = await salvar(senhaDe.id, { senha: novaSenha }, 'Senha trocada.')
    if (ok) {
      setSenhaDe(null)
      setNovaSenha('')
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[640px] text-sm text-brand-muted">
          Administrador enxerga o painel inteiro. Para os demais, marque as áreas — quem não tem a
          área não vê o item no menu e também não consegue abrir a página pelo link.
        </p>
        <Botao type="button" onClick={() => setModalAberto(true)}>
          <UserPlus size={14} /> Novo usuário
        </Botao>
      </div>

      {usuarios.length === 0 ? (
        <EmptyState
          icone={ShieldCheck}
          titulo="Nenhum usuário do painel"
          descricao="Crie o primeiro acesso para alguém da equipe."
        />
      ) : (
        <div className="space-y-3">
          {usuarios.map((u) => {
            const souEu = u.id === meuId
            const emEdicao = editando === u.id
            return (
              <Card key={u.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-barlow text-[16px] font-bold text-brand-text">
                        {u.nome ?? u.email}
                      </p>
                      <Badge tom={u.role === 'ADMIN' ? 'success' : 'info'}>
                        {u.role === 'ADMIN' ? 'Administrador' : 'Marketing'}
                      </Badge>
                      {!u.ativo && <Badge tom="danger">Desligado</Badge>}
                      {souEu && <Badge tom="info">Você</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-brand-muted">{u.email}</p>
                    <p className="mt-1.5 text-xs text-brand-muted">
                      {u.role === 'ADMIN'
                        ? 'Enxerga todas as áreas do painel.'
                        : u.permissoes.length === 0
                          ? 'Sem área liberada — não consegue abrir nada.'
                          : `Enxerga: ${u.permissoes
                              .map((c) => AREAS_CONCEDIVEIS.find((a) => a.chave === c)?.label ?? c)
                              .join(' · ')}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      disabled={salvando}
                      onClick={() => {
                        setEditando(emEdicao ? null : u.id)
                        setRascunho({ role: u.role, permissoes: u.permissoesSalvas ?? [] })
                      }}
                    >
                      <Pencil size={13} /> Acesso
                    </Botao>
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      disabled={salvando}
                      onClick={() => setSenhaDe(u)}
                    >
                      <KeyRound size={13} /> Senha
                    </Botao>
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="sm"
                      disabled={salvando || souEu}
                      title={souEu ? 'Você não pode desligar o próprio acesso' : undefined}
                      onClick={() =>
                        salvar(
                          u.id,
                          { ativo: !u.ativo },
                          u.ativo ? 'Acesso desligado.' : 'Acesso religado.',
                        )
                      }
                    >
                      <Power size={13} /> {u.ativo ? 'Desligar' : 'Religar'}
                    </Botao>
                    <Botao
                      type="button"
                      variante="perigo"
                      tamanho="sm"
                      disabled={salvando || souEu}
                      title={souEu ? 'Você não pode apagar o próprio acesso' : undefined}
                      onClick={() => remover(u)}
                    >
                      <Trash2 size={13} />
                    </Botao>
                  </div>
                </div>

                {emEdicao && (
                  <div className="mt-4 rounded-xl border border-brand-border bg-brand-surface-2 p-4">
                    <div className="max-w-xs">
                      <Campo label="Papel" htmlFor={`papel-${u.id}`}>
                        <Select
                          id={`papel-${u.id}`}
                          value={rascunho.role}
                          disabled={souEu}
                          onChange={(e) =>
                            setRascunho((r) => ({
                              ...r,
                              role: e.target.value as 'ADMIN' | 'MARKETING',
                            }))
                          }
                        >
                          <option value="MARKETING">Marketing — acesso restrito</option>
                          <option value="ADMIN">Administrador — acesso total</option>
                        </Select>
                      </Campo>
                    </div>

                    {rascunho.role === 'ADMIN' ? (
                      <p className="mt-3 text-xs text-brand-muted">
                        Administrador enxerga o painel inteiro; não há o que marcar.
                      </p>
                    ) : (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-semibold text-brand-text">Áreas liberadas</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {AREAS_CONCEDIVEIS.map((area) => (
                            <label
                              key={area.chave}
                              className="flex cursor-pointer items-start gap-2 rounded-lg border border-brand-border bg-brand-surface p-3"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={rascunho.permissoes.includes(area.chave)}
                                onChange={() =>
                                  setRascunho((r) => ({
                                    ...r,
                                    permissoes: alternar(r.permissoes, area.chave),
                                  }))
                                }
                              />
                              <span>
                                <span className="block text-sm font-semibold text-brand-text">
                                  {area.label}
                                </span>
                                <span className="block text-xs text-brand-muted">
                                  {area.descricao}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-brand-muted">
                          As demais áreas do painel são exclusivas de administrador.
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <Botao
                        type="button"
                        tamanho="sm"
                        disabled={salvando}
                        onClick={async () => {
                          const ok = await salvar(
                            u.id,
                            { role: rascunho.role, permissoes: rascunho.permissoes },
                            'Acesso atualizado — vale na próxima página que a pessoa abrir.',
                          )
                          if (ok) setEditando(null)
                        }}
                      >
                        <Check size={13} /> Salvar acesso
                      </Botao>
                      <Botao
                        type="button"
                        variante="secundario"
                        tamanho="sm"
                        onClick={() => setEditando(null)}
                      >
                        <X size={13} /> Cancelar
                      </Botao>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Criar usuário */}
      <Modal aberto={modalAberto} aoFechar={() => setModalAberto(false)} titulo="Novo usuário do painel">
        <form onSubmit={criar} className="space-y-4">
          <Campo label="Nome">
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Nome de quem vai usar"
              required
              autoFocus
            />
          </Campo>
          <Campo label="E-mail">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="pessoa@forzamotos.com.br"
              required
            />
          </Campo>
          <Campo label="Senha" dica="Mínimo de 8 caracteres. Combine com a pessoa e peça para ela trocar depois.">
            <Input
              type="password"
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
              minLength={8}
              required
            />
          </Campo>
          <Campo label="Papel">
            <Select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as 'ADMIN' | 'MARKETING' }))
              }
            >
              <option value="MARKETING">Marketing — acesso restrito</option>
              <option value="ADMIN">Administrador — acesso total</option>
            </Select>
          </Campo>

          {form.role === 'MARKETING' && (
            <div>
              <p className="mb-2 text-xs font-semibold text-brand-text">Áreas liberadas</p>
              <div className="grid gap-2">
                {AREAS_CONCEDIVEIS.map((area) => (
                  <label
                    key={area.chave}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-brand-border p-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.permissoes.includes(area.chave)}
                      onChange={() =>
                        setForm((f) => ({ ...f, permissoes: alternar(f.permissoes, area.chave) }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-semibold text-brand-text">{area.label}</span>
                      <span className="block text-xs text-brand-muted">{area.descricao}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setModalAberto(false)}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={salvando}>
              {salvando ? 'Criando…' : 'Criar usuário'}
            </Botao>
          </div>
        </form>
      </Modal>

      {/* Trocar senha */}
      <Modal
        aberto={Boolean(senhaDe)}
        aoFechar={() => {
          setSenhaDe(null)
          setNovaSenha('')
        }}
        titulo={`Nova senha — ${senhaDe?.nome ?? senhaDe?.email ?? ''}`}
      >
        <form onSubmit={trocarSenha} className="space-y-4">
          <Campo label="Nova senha" dica="Mínimo de 8 caracteres.">
            <Input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
          </Campo>
          <div className="flex justify-end gap-2">
            <Botao
              type="button"
              variante="secundario"
              onClick={() => {
                setSenhaDe(null)
                setNovaSenha('')
              }}
            >
              Cancelar
            </Botao>
            <Botao type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Trocar senha'}
            </Botao>
          </div>
        </form>
      </Modal>
    </div>
  )
}
