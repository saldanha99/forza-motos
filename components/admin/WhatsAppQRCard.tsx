'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Wifi, WifiOff, Smartphone, LogOut, Plus, Check, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'

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
  error?: string
}

export function WhatsAppQRCard() {
  const [data, setData]             = useState<WaStatus | null>(null)
  const [loading, setLoading]       = useState(true)
  const [restarting, setRestarting] = useState(false)
  const [showInstancias, setShowInstancias] = useState(false)
  const [novaInstancia, setNovaInstancia]   = useState('')
  const [criando, setCriando]               = useState(false)
  const [selecionando, setSelecionando]     = useState<string | null>(null)

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
  const qrSrc = data?.qr
    ? data.qr.startsWith('data:') ? data.qr : `data:image/png;base64,${data.qr}`
    : null

  function stateColor(state: string) {
    if (state === 'open') return 'text-green-400'
    if (state === 'connecting') return 'text-yellow-400'
    return 'text-red-400'
  }
  function stateDot(state: string) {
    if (state === 'open') return 'bg-green-400'
    if (state === 'connecting') return 'bg-yellow-400 animate-pulse'
    return 'bg-red-400'
  }

  return (
    <div className="bg-white/5 border border-brand-border/30 rounded-2xl p-5 space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-brand-muted" />
          <span className="text-brand-text font-semibold text-sm">WhatsApp — Evolution API</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            isConnected ? 'bg-green-500/20 text-green-400'
            : isConnecting ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-red-500/20 text-red-400'
          }`}>
            {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {loading ? 'Verificando...' : isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
          </span>
          <button onClick={fetchStatus} disabled={loading} title="Atualizar"
            className="p-1.5 rounded-lg hover:bg-white/10 text-brand-muted hover:text-brand-text transition-all disabled:opacity-40">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Instância ativa ────────────────────────────────────── */}
      {data?.instance && (
        <p className="text-xs text-brand-muted -mt-2">
          Instância ativa: <code className="text-indigo-400">{data.instance}</code>
        </p>
      )}

      {/* ── Estado: CONECTADO ──────────────────────────────────── */}
      {isConnected && (
        <div className="text-center py-3">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Wifi size={22} className="text-green-400" />
          </div>
          <p className="text-green-400 font-semibold text-sm">WhatsApp conectado</p>
          <p className="text-brand-muted text-xs mt-1">Mensagens automáticas ativas</p>
          <button onClick={desconectar}
            className="mt-4 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 mx-auto transition-colors">
            <LogOut size={12} /> Desconectar
          </button>
        </div>
      )}

      {/* ── Estado: QR CODE ────────────────────────────────────── */}
      {!isConnected && qrSrc && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-brand-muted text-xs text-center">
            Abra o WhatsApp → <strong className="text-brand-text">Dispositivos Conectados</strong> → <strong className="text-brand-text">Conectar dispositivo</strong>
          </p>
          <div className="bg-white p-3 rounded-xl">
            <Image src={qrSrc} alt="QR Code WhatsApp" width={220} height={220} unoptimized className="rounded-lg" />
          </div>
          <p className="text-brand-muted text-[11px]">Atualiza automaticamente a cada 8 s</p>
          <button onClick={() => reiniciar()} disabled={restarting}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-40">
            <RefreshCw size={12} className={restarting ? 'animate-spin' : ''} />
            {restarting ? 'Reiniciando...' : 'Reiniciar instância'}
          </button>
        </div>
      )}

      {/* ── Estado: sem QR ─────────────────────────────────────── */}
      {!isConnected && !qrSrc && !loading && (
        <div className="text-center py-3">
          <p className="text-brand-muted text-sm mb-3">
            {data?.error ?? (isConnecting ? 'Aguardando QR Code...' : 'Instância desconectada')}
          </p>
          <button onClick={() => reiniciar()} disabled={restarting}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <RefreshCw size={14} className={restarting ? 'animate-spin' : ''} />
            {restarting ? 'Reiniciando...' : 'Gerar QR Code'}
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={20} className="animate-spin text-brand-muted" />
        </div>
      )}

      {/* ── Criar nova instância ────────────────────────────────── */}
      <div className="border-t border-brand-border/20 pt-4">
        <p className="text-brand-text text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Plus size={12} /> Nova instância
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={novaInstancia}
            onChange={e => setNovaInstancia(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && criar()}
            placeholder="ex: forza-motos"
            className="flex-1 bg-black/30 border border-brand-border/40 rounded-xl px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/40 focus:outline-none focus:border-indigo-500/60"
          />
          <button onClick={criar} disabled={criando || !novaInstancia.trim()}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap">
            {criando ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
            {criando ? 'Criando...' : 'Criar'}
          </button>
        </div>
        <p className="text-brand-muted text-[11px] mt-1.5">
          Cria a instância na Evolution API e já a seleciona como ativa.
        </p>
      </div>

      {/* ── Lista de instâncias existentes ─────────────────────── */}
      {(data?.instancias?.length ?? 0) > 0 && (
        <div className="border-t border-brand-border/20 pt-4">
          <button
            onClick={() => setShowInstancias(v => !v)}
            className="flex items-center justify-between w-full text-xs font-semibold text-brand-text mb-2"
          >
            <span>Instâncias existentes ({data!.instancias.length})</span>
            {showInstancias ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showInstancias && (
            <div className="space-y-1.5 mt-2">
              {data!.instancias.map(inst => {
                const isActive = inst.name === data?.instance
                return (
                  <div key={inst.name}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                      isActive
                        ? 'border-indigo-500/40 bg-indigo-500/10'
                        : 'border-brand-border/20 bg-black/20'
                    }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${stateDot(inst.state)}`} />
                      <span className="text-brand-text text-xs font-medium truncate">{inst.name}</span>
                      <span className={`text-[10px] ${stateColor(inst.state)}`}>{inst.state}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isActive ? (
                        <span className="flex items-center gap-1 text-[10px] text-indigo-400">
                          <Check size={10} /> ativa
                        </span>
                      ) : (
                        <button
                          onClick={() => selecionar(inst.name)}
                          disabled={selecionando === inst.name}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors"
                        >
                          {selecionando === inst.name ? 'Selecionando...' : 'Usar esta'}
                        </button>
                      )}
                      {inst.state !== 'open' && (
                        <button
                          onClick={() => reiniciar(inst.name)}
                          className="text-[10px] text-brand-muted hover:text-brand-text transition-colors"
                          title="Reiniciar"
                        >
                          <RefreshCw size={10} />
                        </button>
                      )}
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
