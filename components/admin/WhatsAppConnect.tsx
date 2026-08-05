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
  AlertTriangle, MessageCircle, Smartphone,
} from 'lucide-react'
import { Card, CardHeader, Botao, Badge } from '@/components/admin/ui/primitives'
import type { TomStatus } from '@/lib/admin/status'

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

/** Tom de cor por estado — o estado precisa dar pra ler só pela cor. */
const STATE_TOM: Record<ConnectionState, TomStatus> = {
  connected:      'success',
  connecting:     'warning',
  disconnected:   'danger',
  not_found:      'danger',
  error:          'danger',
  not_configured: 'neutro',
  loading:        'neutro',
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

  return (
    <Card>
      <CardHeader
        titulo={
          <span className="flex items-center gap-2">
            <MessageCircle size={18} className="text-brand-success" />
            Conexão WhatsApp
          </span>
        }
        acao={
          <div className="flex items-center gap-2">
            <Badge tom={STATE_TOM[connState]}>{STATE_LABELS[connState] ?? connState}</Badge>
            {isConnected && (
              <button
                onClick={handleDisconnect}
                title="Desconectar"
                className="flex items-center gap-1.5 rounded-lg border border-brand-danger bg-brand-danger-soft px-3 py-1.5 text-xs font-medium text-brand-danger transition-all hover:brightness-95"
              >
                <LogOut size={13} />
                Desconectar
              </button>
            )}
            {!isConnected && !notConfigured && (
              <Botao
                variante="secundario"
                tamanho="sm"
                onClick={handleRestart}
                title="Reiniciar instância"
              >
                <RefreshCw size={13} />
                Reiniciar
              </Botao>
            )}
          </div>
        }
      />

      {/* Body */}
      <div className="p-5">
        {/* Ação em progresso */}
        {actionMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand-hair bg-brand-surface-2 px-3 py-2 text-xs text-brand-muted">
            <Loader2 size={12} className="shrink-0 animate-spin" />
            {actionMsg}
          </div>
        )}

        {/* ─ CONECTADO ─ */}
        {isConnected && (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-success-soft">
                <Wifi size={22} className="text-brand-success" />
                <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-brand-surface bg-brand-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-brand-text">WhatsApp conectado!</p>
                <p className="text-xs text-brand-muted">
                  Instância: <code className="text-brand-accent">{instance}</code>
                </p>
              </div>
            </div>
            <div className="text-xs text-brand-dim sm:ml-auto">
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
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brand-warning" />
            <div>
              <p className="mb-1 text-sm font-medium text-brand-text">Evolution API não configurada</p>
              <p className="text-xs leading-relaxed text-brand-muted">
                Adicione as variáveis <code className="text-brand-accent">EVOLUTION_API_URL</code>,{' '}
                <code className="text-brand-accent">EVOLUTION_API_KEY</code> e{' '}
                <code className="text-brand-accent">EVOLUTION_INSTANCE</code> no Vercel e faça um novo deploy.
              </p>
            </div>
          </div>
        )}

        {/* ─ QR CODE ─ */}
        {(connState === 'disconnected' || connState === 'not_found' || connState === 'connecting') && (
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            {/* QR */}
            <div className="shrink-0">
              {/* Fundo branco fixo nos dois temas: a câmera do celular precisa de alto
                  contraste preto-sobre-branco pra ler o código — isso não muda com o tema. */}
              <div className="relative flex h-48 w-48 items-center justify-center overflow-hidden rounded-xl border-2 border-brand-success bg-white shadow-card">
                {loadingQr || !qrBase64 ? (
                  <div className="flex flex-col items-center gap-2 text-brand-dim">
                    <QrCode size={32} className={loadingQr ? 'animate-pulse' : ''} />
                    <span className="text-[10px]">{loadingQr ? 'Gerando QR…' : 'Aguardando…'}</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrBase64}
                    alt="QR Code WhatsApp"
                    className="h-full w-full object-contain p-2"
                  />
                )}
              </div>

              {/* Refresh manual */}
              {qrBase64 && (
                <button
                  onClick={handleRefreshQr}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 text-[10px] text-brand-muted transition-colors hover:text-brand-text"
                >
                  <RefreshCw size={10} />
                  Atualizar QR code
                </button>
              )}
            </div>

            {/* Instruções */}
            <div className="flex-1">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-text">
                <Smartphone size={15} className="text-brand-success" />
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
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brand-success bg-brand-success-soft text-[9px] font-bold text-brand-success">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-3 flex items-center gap-1 text-[10px] text-brand-dim">
                <RefreshCw size={9} />
                QR atualizado automaticamente a cada 45s
              </p>
            </div>
          </div>
        )}

        {/* ─ ERRO ─ */}
        {connState === 'error' && (
          <div className="flex items-start gap-3">
            <WifiOff size={18} className="mt-0.5 shrink-0 text-brand-danger" />
            <div>
              <p className="mb-1 text-sm font-medium text-brand-text">Erro ao conectar com Evolution API</p>
              <p className="text-xs text-brand-muted">
                Verifique se a URL da API está acessível e a API key está correta.
              </p>
              <button
                onClick={fetchStatus}
                className="mt-2 flex items-center gap-1 text-xs text-brand-accent hover:underline"
              >
                <RefreshCw size={10} /> Tentar novamente
              </button>
            </div>
          </div>
        )}

        {/* Instância + webhook info (rodapé) */}
        {!notConfigured && (
          <div className="mt-4 grid gap-2 border-t border-brand-hair pt-4 text-[10px] text-brand-dim sm:grid-cols-2">
            <div>
              <span className="mb-0.5 block text-brand-dim">Instância</span>
              <code className="text-brand-accent">{instance}</code>
            </div>
            <div>
              <span className="mb-0.5 block text-brand-dim">Webhook configurado em</span>
              <code className="break-all text-brand-accent">/api/evolution/webhook</code>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
