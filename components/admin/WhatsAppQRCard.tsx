'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Wifi, WifiOff, Smartphone, LogOut, Plus, Check, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { Badge, Botao, TOM_TEXTO, TOM_PONTO } from '@/components/admin/ui/primitives'
import { Input } from '@/components/admin/ui/form'
import type { TomStatus } from '@/lib/admin/status'

interface Instancia {
  name: string
  state: string
  ownerJid?: string
}

interface WaStatus {
  state: 'open' | 'close' | 'connecting' | 'unknown'
  qr: string | null
  instance: string
  instancias: Instancia[]
  /** Quantas o servidor escondeu por serem de outros clientes. */
  ocultas?: number
  error?: string
}

/** Tom de cor por estado de instância — mesma leitura usada no card de conexão principal. */
function tomEstado(state: string): TomStatus {
  if (state === 'open') return 'success'
  if (state === 'connecting') return 'warning'
  return 'danger'
}

export function WhatsAppQRCard() {
  const [data, setData]             = useState<WaStatus | null>(null)
  const [loading, setLoading]       = useState(true)
  const [restarting, setRestarting] = useState(false)
  const [showInstancias, setShowInstancias] = useState(false)
  const [novaInstancia, setNovaInstancia]   = useState('')
  const [criando, setCriando]               = useState(false)
  const [selecionando, setSelecionando]     = useState<string | null>(null)
  const [excluindo, setExcluindo]           = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/whatsapp')
      const json: WaStatus = await res.json()
      setData(json)
    } catch {
      setData({ state: 'unknown', qr: null, instance: '', instancias: [], error: 'Sem resposta da API' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, data?.state === 'open' ? 30_000 : 8_000)
    return () => clearInterval(interval)
  }, [fetchStatus, data?.state])

  async function post(body: object) {
    return fetch('/api/admin/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function selecionar(nome: string) {
    setSelecionando(nome)
    try {
      const res = await post({ action: 'select', instanceName: nome })
      if (!res.ok) throw new Error()
      toast.success(`Instância "${nome}" selecionada!`)
      setTimeout(fetchStatus, 500)
    } catch {
      toast.error('Erro ao selecionar instância.')
    } finally {
      setSelecionando(null)
    }
  }

  async function criar() {
    const nome = novaInstancia.trim()
    if (!nome) { toast.error('Digite um nome para a instância.'); return }
    setCriando(true)
    try {
      const res = await post({ action: 'create', instanceName: nome })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar')
      toast.success(`Instância "${nome}" criada e selecionada!`)
      setNovaInstancia('')
      setTimeout(fetchStatus, 1500)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao criar instância.')
    } finally {
      setCriando(false)
    }
  }

  async function excluir(nome: string) {
    if (!confirm(
      `Excluir a instância "${nome}" na Evolution API?\n\n` +
      'Ela é desconectada e removida do servidor. Irreversível — para voltar a ' +
      'usar esse número será preciso criar a instância de novo e ler o QR.'
    )) return
    setExcluindo(nome)
    try {
      const res = await post({ action: 'delete', instanceName: nome })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Erro ao excluir')
      toast.success(`Instância "${nome}" excluída.`)
      setTimeout(fetchStatus, 1500)
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao excluir instância.')
    } finally {
      setExcluindo(null)
    }
  }

  async function reiniciar(nome?: string) {
    setRestarting(true)
    try {
      await post({ action: 'restart', instanceName: nome })
      toast.success('Instância reiniciada — aguarde o QR Code...')
      setTimeout(fetchStatus, 3000)
    } catch {
      toast.error('Falha ao reiniciar instância.')
    } finally {
      setRestarting(false)
    }
  }

  async function desconectar() {
    if (!confirm('Desconectar o WhatsApp? Será necessário escanear o QR novamente.')) return
    await post({ action: 'logout' })
    toast.success('WhatsApp desconectado.')
    setTimeout(fetchStatus, 2000)
  }

  const isConnected  = data?.state === 'open'
  const isConnecting = data?.state === 'connecting'
  // O servidor devolve data URI pronto. Se vier outra coisa, não renderiza:
  // prefixar cegamente com `data:image/png;base64,` foi o que produzia o
  // ícone de imagem quebrada quando a Evolution mandava só o payload.
  const qrSrc = data?.qr?.startsWith('data:') ? data.qr : null

  const tomAtual: TomStatus = isConnected ? 'success' : isConnecting ? 'warning' : 'danger'

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-brand-muted" />
          <span className="text-sm font-semibold text-brand-text">WhatsApp — Evolution API</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tom={tomAtual}>
            {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {loading ? 'Verificando...' : isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
          </Badge>
          <button onClick={fetchStatus} disabled={loading} title="Atualizar"
            className="rounded-lg p-1.5 text-brand-muted transition hover:bg-brand-tint-2 hover:text-brand-text disabled:opacity-40">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Instância ativa ────────────────────────────────────── */}
      {data?.instance && (
        <p className="-mt-2 text-xs text-brand-muted">
          Instância ativa: <code className="text-brand-accent">{data.instance}</code>
        </p>
      )}

      {/* ── Estado: CONECTADO ──────────────────────────────────── */}
      {isConnected && (
        <div className="py-3 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-success-soft">
            <Wifi size={22} className="text-brand-success" />
          </div>
          <p className="text-sm font-semibold text-brand-success">WhatsApp conectado</p>
          <p className="mt-1 text-xs text-brand-muted">Mensagens automáticas ativas</p>
          <button onClick={desconectar}
            className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-brand-danger transition-colors hover:brightness-90">
            <LogOut size={12} /> Desconectar
          </button>
        </div>
      )}

      {/* ── Estado: QR CODE ────────────────────────────────────── */}
      {!isConnected && qrSrc && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-xs text-brand-muted">
            Abra o WhatsApp → <strong className="text-brand-text">Dispositivos Conectados</strong> → <strong className="text-brand-text">Conectar dispositivo</strong>
          </p>
          {/* Fundo branco fixo nos dois temas: a câmera do celular precisa de alto
              contraste preto-sobre-branco pra ler o código — isso não muda com o tema. */}
          <div className="rounded-xl bg-white p-3">
            <Image src={qrSrc} alt="QR Code WhatsApp" width={220} height={220} unoptimized className="rounded-lg" />
          </div>
          <p className="text-[11px] text-brand-muted">Atualiza automaticamente a cada 8 s</p>
          <button onClick={() => reiniciar()} disabled={restarting}
            className="flex items-center gap-1.5 text-xs text-brand-accent transition-colors hover:text-brand-accent-hover disabled:opacity-40">
            <RefreshCw size={12} className={restarting ? 'animate-spin' : ''} />
            {restarting ? 'Reiniciando...' : 'Reiniciar instância'}
          </button>
        </div>
      )}

      {/* ── Estado: sem QR ─────────────────────────────────────── */}
      {!isConnected && !qrSrc && !loading && (
        <div className="py-3 text-center">
          <p className="mb-3 text-sm text-brand-muted">
            {data?.error ?? (isConnecting ? 'Aguardando QR Code...' : 'Instância desconectada')}
          </p>
          <Botao variante="primario" tamanho="md" onClick={() => reiniciar()} disabled={restarting}>
            <RefreshCw size={14} className={restarting ? 'animate-spin' : ''} />
            {restarting ? 'Reiniciando...' : 'Gerar QR Code'}
          </Botao>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={20} className="animate-spin text-brand-muted" />
        </div>
      )}

      {/* ── Criar nova instância ────────────────────────────────── */}
      <div className="border-t border-brand-hair pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-text">
          <Plus size={12} /> Nova instância
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            value={novaInstancia}
            onChange={e => setNovaInstancia(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && criar()}
            placeholder="ex: forza-motos"
            className="flex-1"
          />
          <Botao
            variante="primario"
            tamanho="md"
            onClick={criar}
            disabled={criando || !novaInstancia.trim()}
            className="whitespace-nowrap"
          >
            {criando ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
            {criando ? 'Criando...' : 'Criar'}
          </Botao>
        </div>
        <p className="mt-1.5 text-[11px] text-brand-muted">
          Cria a instância na Evolution API e já a seleciona como ativa. O prefixo
          <code className="px-1 text-brand-muted">forza-</code> é aplicado automaticamente.
        </p>
      </div>

      {/* ── Lista de instâncias existentes ─────────────────────── */}
      {(data?.instancias?.length ?? 0) > 0 && (
        <div className="border-t border-brand-hair pt-4">
          <button
            onClick={() => setShowInstancias(v => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold text-brand-text"
          >
            <span>Instâncias deste painel ({data!.instancias.length})</span>
            {showInstancias ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showInstancias && (
            <div className="mt-2 space-y-1.5">
              {!!data?.ocultas && data.ocultas > 0 && (
                <p className="rounded-lg bg-brand-tint-1 px-3 py-2 text-[10px] leading-relaxed text-brand-dim">
                  {data.ocultas} {data.ocultas === 1 ? 'instância pertence' : 'instâncias pertencem'} a
                  outros clientes no mesmo servidor Evolution e {data.ocultas === 1 ? 'foi ocultada' : 'foram ocultadas'}.
                  Este painel só enxerga e opera as do Forza.
                </p>
              )}
              {data!.instancias.map(inst => {
                const isActive = inst.name === data?.instance
                const tomInst = tomEstado(inst.state)
                return (
                  <div key={inst.name}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 transition ${
                      isActive
                        ? 'border-brand-accent bg-brand-accent-soft'
                        : 'border-brand-border bg-brand-surface-2'
                    }`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${TOM_PONTO[tomInst]} ${inst.state === 'connecting' ? 'animate-pulse' : ''}`} />
                      <span className="truncate text-xs font-medium text-brand-text">{inst.name}</span>
                      <span className={`text-[10px] ${TOM_TEXTO[tomInst]}`}>{inst.state}</span>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-1.5">
                      {isActive ? (
                        <span className="flex items-center gap-1 text-[10px] text-brand-accent">
                          <Check size={10} /> ativa
                        </span>
                      ) : (
                        <button
                          onClick={() => selecionar(inst.name)}
                          disabled={selecionando === inst.name}
                          className="text-[10px] text-brand-accent transition-colors hover:text-brand-accent-hover disabled:opacity-40"
                        >
                          {selecionando === inst.name ? 'Selecionando...' : 'Usar esta'}
                        </button>
                      )}
                      {inst.state !== 'open' && (
                        <button
                          onClick={() => reiniciar(inst.name)}
                          className="text-[10px] text-brand-muted transition-colors hover:text-brand-text"
                          title="Reiniciar"
                        >
                          <RefreshCw size={10} />
                        </button>
                      )}
                      <button
                        onClick={() => excluir(inst.name)}
                        disabled={excluindo === inst.name}
                        className="text-[10px] text-brand-muted transition-colors hover:text-brand-danger disabled:opacity-40"
                        title={`Excluir "${inst.name}" da Evolution API`}
                      >
                        {excluindo === inst.name
                          ? <RefreshCw size={10} className="animate-spin" />
                          : <Trash2 size={10} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
