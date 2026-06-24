'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Wifi, WifiOff, Smartphone, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'

interface WaStatus {
  state: 'open' | 'close' | 'connecting' | 'unknown'
  qr: string | null
  instance: string
  error?: string
}

export function WhatsAppQRCard() {
  const [data, setData]       = useState<WaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/whatsapp')
      const json: WaStatus = await res.json()
      setData(json)
    } catch {
      setData({ state: 'unknown', qr: null, instance: '', error: 'Sem resposta da API' })
    } finally {
      setLoading(false)
    }
  }, [])

  // Polling: a cada 8s quando desconectado, a cada 30s quando conectado
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(
      fetchStatus,
      data?.state === 'open' ? 30_000 : 8_000,
    )
    return () => clearInterval(interval)
  }, [fetchStatus, data?.state])

  async function reiniciar() {
    setRestarting(true)
    try {
      await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      })
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
    try {
      await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
      toast.success('WhatsApp desconectado.')
      setTimeout(fetchStatus, 2000)
    } catch {
      toast.error('Falha ao desconectar.')
    }
  }

  const isConnected = data?.state === 'open'
  const isConnecting = data?.state === 'connecting'

  // Normaliza base64: remove prefixo data:image se já existir
  const qrSrc = data?.qr
    ? data.qr.startsWith('data:')
      ? data.qr
      : `data:image/png;base64,${data.qr}`
    : null

  return (
    <div className="bg-white/5 border border-brand-border/30 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-brand-muted" />
          <span className="text-brand-text font-semibold text-sm">WhatsApp — Evolution API</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge de status */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            isConnected
              ? 'bg-green-500/20 text-green-400'
              : isConnecting
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {loading ? 'Verificando...' : isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
          </span>

          {/* Botão atualizar */}
          <button
            onClick={fetchStatus}
            disabled={loading}
            title="Atualizar status"
            className="p-1.5 rounded-lg hover:bg-white/10 text-brand-muted hover:text-brand-text transition-all disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Instância */}
      {data?.instance && (
        <p className="text-xs text-brand-muted mb-4">
          Instância: <code className="text-indigo-400">{data.instance}</code>
        </p>
      )}

      {/* Estado: CONECTADO */}
      {isConnected && (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Wifi size={22} className="text-green-400" />
          </div>
          <p className="text-green-400 font-semibold text-sm">WhatsApp conectado</p>
          <p className="text-brand-muted text-xs mt-1">Mensagens automáticas ativas</p>
          <button
            onClick={desconectar}
            className="mt-4 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 mx-auto transition-colors"
          >
            <LogOut size={12} /> Desconectar
          </button>
        </div>
      )}

      {/* Estado: QR CODE disponível */}
      {!isConnected && qrSrc && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-brand-muted text-xs text-center">
            Abra o WhatsApp no celular → <strong className="text-brand-text">Dispositivos Conectados</strong> → <strong className="text-brand-text">Conectar dispositivo</strong> → escaneie:
          </p>
          <div className="bg-white p-3 rounded-xl">
            <Image
              src={qrSrc}
              alt="QR Code WhatsApp"
              width={220}
              height={220}
              unoptimized
              className="rounded-lg"
            />
          </div>
          <p className="text-brand-muted text-[11px]">QR atualiza automaticamente a cada 8 segundos</p>
          <button
            onClick={reiniciar}
            disabled={restarting}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={restarting ? 'animate-spin' : ''} />
            {restarting ? 'Reiniciando...' : 'Reiniciar instância'}
          </button>
        </div>
      )}

      {/* Estado: conectando ou sem QR ainda */}
      {!isConnected && !qrSrc && !loading && (
        <div className="text-center py-4">
          <p className="text-brand-muted text-sm mb-3">
            {data?.error ?? (isConnecting ? 'Aguardando QR Code...' : 'Instância desconectada')}
          </p>
          <button
            onClick={reiniciar}
            disabled={restarting}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            <RefreshCw size={14} className={restarting ? 'animate-spin' : ''} />
            {restarting ? 'Reiniciando...' : 'Gerar QR Code'}
          </button>
        </div>
      )}

      {/* Loading inicial */}
      {loading && !data && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={20} className="animate-spin text-brand-muted" />
        </div>
      )}
    </div>
  )
}
