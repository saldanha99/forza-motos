'use client'

/**
 * WhatsAppConnect — Painel de conexão WhatsApp via QR Code
 *
 * - Polling de status a cada 3s enquanto desconectado, 30s quando conectado
 * - QR code atualizado automaticamente a cada 45s (antes do expirar em 60s)
 * - Auto-detecção de conexão bem-sucedida → UI muda sem reload
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Wifi, WifiOff, QrCode, RefreshCw, LogOut, Loader2,
  CheckCircle2, AlertTriangle, MessageCircle, Smartphone,
} from 'lucide-react'

type ConnectionState = 'loading' | 'connected' | 'disconnected' | 'connecting' | 'not_configured' | 'not_found' | 'error'

interface StatusResponse { state: string; instance?: string; error?: string }
interface QrResponse    { qr?: string; connected?: boolean; error?: string }

const STATE_LABELS: Record<string, string> = {
  open:           'Conectado',
  close:          'Desconectado',
  connecting:     'Conectando…',
  not_configured: 'Não configurado',
  not_found:      'Instância não encontrada',
  error:          'Erro de conexão',
  loading:        'Verificando…',
}

const POLL_CONNECTED    = 30_000   // 30s quando conectado
const POLL_DISCONNECTED =  3_000   // 3s enquanto aguarda scan
const QR_REFRESH_EVERY  = 45_000   // 45s (QR expira em ~60s)

export function WhatsAppConnect() {
  const [connState, setConnState]     = useState<ConnectionState>('loading')
  const [qrBase64,  setQrBase64]      = useState<string | null>(null)
  const [loadingQr, setLoadingQr]     = useState(false)
  const [actionMsg, setActionMsg]     = useState<string | null>(null)
  const [instance,  setInstance]      = useState('forza-motos')
  const [qrCounter, setQrCounter]     = useState(0)   // força re-fetch do QR

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const qrTimRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Busca status de conexão ─────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/evolution/status', { cache: 'no-store' })
      const data: StatusResponse = await res.json()
      setInstance(data.instance ?? 'forza-motos')

      const st = data.state ?? 'error'

      if (st === 'open') {
        setConnState('connected')
        setQrBase64(null)
      } else if (st === 'connecting') {
        setConnState('connecting')
      } else if (st === 'not_configured') {
        setConnState('not_configured')
      } else if (st === 'not_found') {
        setConnState('not_found')
      } else {
        setConnState('disconnected')
      }
    } catch {
      setConnState('error')
    }
  }, [])

  // ─── Busca QR code ────────────────────────────────────────────────────────
  const fetchQr = useCallback(async () => {
    setLoadingQr(true)
    try {
      const res  = await fetch('/api/evolution/qrcode', { cache: 'no-store' })
      const data: QrResponse = await res.json()

      if (data.connected) {
        setConnState('connected')
        setQrBase64(null)
      } else if (data.qr) {
        setQrBase64(data.qr)
        setConnState('disconnected')
      } else {
        setActionMsg(data.error ?? 'QR não disponível')
      }
    } catch (e) {
      setActionMsg(String(e))
    } finally {
      setLoadingQr(false)
    }
  }, [])

  // ─── Reinicia instância ───────────────────────────────────────────────────
  const handleRestart = async () => {
    setActionMsg('Reiniciando instância…')
    await fetch('/api/evolution/restart', { method: 'POST' })
    await new Promise(r => setTimeout(r, 2000))
    setQrBase64(null)
    setConnState('loading')
    await fetchStatus()
    setActionMsg(null)
  }

  // ─── Desconecta ───────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp? Você precisará escanear o QR code novamente.')) return
    setActionMsg('Desconectando…')
    await fetch('/api/evolution/disconnect', { method: 'POST' })
    await new Promise(r => setTimeout(r, 1000))
    setConnState('disconnected')
    setQrBase64(null)
    setActionMsg(null)
    fetchQr()
  }

  // ─── Força novo QR ────────────────────────────────────────────────────────
  const handleRefreshQr = () => {
    setQrBase64(null)
    setQrCounter(c => c + 1)
  }

  // ─── Setup polling de status ──────────────────────────────────────────────
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const interval = connState === 'connected' ? POLL_CONNECTED : POLL_DISCONNECTED
    pollRef.current = setInterval(fetchStatus, interval)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [connState, fetchStatus])

  // ─── Busca QR quando desconectado ────────────────────────────────────────
  useEffect(() => {
    if (connState === 'disconnected' || connState === 'not_found') {
      fetchQr()
    }
  }, [connState, qrCounter, fetchQr])

  // ─── Auto-refresh do QR a cada 45s ───────────────────────────────────────
  useEffect(() => {
    if (qrTimRef.current) clearInterval(qrTimRef.current)
    if (connState !== 'connected' && connState !== 'loading') {
      qrTimRef.current = setInterval(() => {
        setQrBase64(null)
        fetchQr()
      }, QR_REFRESH_EVERY)
    }
    return () => { if (qrTimRef.current) clearInterval(qrTimRef.current) }
  }, [connState, fetchQr])

  // ─── Render helpers ───────────────────────────────────────────────────────
  const isConnected    = connState === 'connected'
  const isLoading      = connState === 'loading'
  const notConfigured  = connState === 'not_configured'

  const statusColor = isConnected
    ? '#22c55e'
    : connState === 'connecting'
    ? '#f59e0b'
    : connState === 'error' || connState === 'not_configured'
    ? '#6b7280'
    : '#ef4444'

  return (
    <div className="admin-glass rounded-xl border border-brand-border/20 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-brand-border/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} style={{ color: '#25d366' }} />
          <h2 className="font-bold text-brand-text">Conexão WhatsApp</h2>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
            style={{
              background: `${statusColor}22`,
              color:       statusColor,
              borderColor: `${statusColor}44`,
            }}
          >
            {STATE_LABELS[connState] ?? connState}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={handleDisconnect}
              title="Desconectar"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
            >
              <LogOut size={13} />
              Desconectar
            </button>
          )}
          {!isConnected && !notConfigured && (
            <button
              onClick={handleRestart}
              title="Reiniciar instância"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-muted hover:text-brand-text hover:bg-white/5 border border-brand-border/20 transition-all"
            >
              <RefreshCw size={13} />
              Reiniciar
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Ação em progresso */}
        {actionMsg && (
          <div className="mb-4 flex items-center gap-2 text-xs text-brand-muted bg-white/5 rounded-lg px-3 py-2 border border-brand-border/10">
            <Loader2 size={12} className="animate-spin shrink-0" />
            {actionMsg}
          </div>
        )}

        {/* ─ CONECTADO ─ */}
        {isConnected && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full bg-[#25d366]/10 border border-[#25d366]/30 flex items-center justify-center shrink-0">
                <Wifi size={22} style={{ color: '#25d366' }} />
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#22c55e] rounded-full border-2 border-black animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-brand-text text-sm">WhatsApp conectado! 🟢</p>
                <p className="text-xs text-brand-muted">Instância: <code className="text-brand-accent">{instance}</code></p>
              </div>
            </div>
            <div className="sm:ml-auto text-xs text-brand-muted/60">
              Status verificado a cada 30s
            </div>
          </div>
        )}

        {/* ─ CARREGANDO ─ */}
        {isLoading && (
          <div className="flex items-center gap-3 text-brand-muted">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Verificando conexão…</span>
          </div>
        )}

        {/* ─ NÃO CONFIGURADO ─ */}
        {notConfigured && (
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-brand-text text-sm mb-1">Evolution API não configurada</p>
              <p className="text-xs text-brand-muted leading-relaxed">
                Adicione as variáveis <code className="text-brand-accent">EVOLUTION_API_URL</code>,{' '}
                <code className="text-brand-accent">EVOLUTION_API_KEY</code> e{' '}
                <code className="text-brand-accent">EVOLUTION_INSTANCE</code> no Vercel e faça um novo deploy.
              </p>
            </div>
          </div>
        )}

        {/* ─ QR CODE ─ */}
        {(connState === 'disconnected' || connState === 'not_found' || connState === 'connecting') && (
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* QR */}
            <div className="shrink-0">
              <div className="w-48 h-48 rounded-xl bg-white border-2 border-[#25d366]/30 flex items-center justify-center overflow-hidden relative shadow-lg shadow-black/30">
                {loadingQr || !qrBase64 ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <QrCode size={32} className={loadingQr ? 'animate-pulse' : ''} />
                    <span className="text-[10px]">{loadingQr ? 'Gerando QR…' : 'Aguardando…'}</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrBase64}
                    alt="QR Code WhatsApp"
                    className="w-full h-full object-contain p-2"
                  />
                )}
              </div>

              {/* Refresh manual */}
              {qrBase64 && (
                <button
                  onClick={handleRefreshQr}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] text-brand-muted hover:text-brand-text transition-colors"
                >
                  <RefreshCw size={10} />
                  Atualizar QR code
                </button>
              )}
            </div>

            {/* Instruções */}
            <div className="flex-1">
              <p className="font-semibold text-brand-text text-sm mb-3 flex items-center gap-2">
                <Smartphone size={15} className="text-[#25d366]" />
                Como conectar:
              </p>
              <ol className="space-y-2.5 text-xs text-brand-muted">
                {[
                  'Abra o WhatsApp no seu celular',
                  'Toque em Menu (⋮) ou Configurações',
                  'Selecione "Dispositivos conectados"',
                  'Toque em "Conectar dispositivo"',
                  'Aponte a câmera para o QR code ao lado',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/25 flex items-center justify-center font-bold text-[9px]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[10px] text-brand-muted/50 flex items-center gap-1">
                <RefreshCw size={9} />
                QR atualizado automaticamente a cada 45s
              </p>
            </div>
          </div>
        )}

        {/* ─ ERRO ─ */}
        {connState === 'error' && (
          <div className="flex items-start gap-3">
            <WifiOff size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-brand-text text-sm mb-1">Erro ao conectar com Evolution API</p>
              <p className="text-xs text-brand-muted">
                Verifique se a URL da API está acessível e a API key está correta.
              </p>
              <button
                onClick={fetchStatus}
                className="mt-2 text-xs text-brand-accent hover:underline flex items-center gap-1"
              >
                <RefreshCw size={10} /> Tentar novamente
              </button>
            </div>
          </div>
        )}

        {/* Instância + webhook info (rodapé) */}
        {!notConfigured && (
          <div className="mt-4 pt-4 border-t border-brand-border/10 grid sm:grid-cols-2 gap-2 text-[10px] text-brand-muted/60">
            <div>
              <span className="text-brand-muted/40 block mb-0.5">Instância</span>
              <code className="text-brand-accent/70">{instance}</code>
            </div>
            <div>
              <span className="text-brand-muted/40 block mb-0.5">Webhook configurado em</span>
              <code className="text-brand-accent/70 break-all">/api/evolution/webhook</code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
