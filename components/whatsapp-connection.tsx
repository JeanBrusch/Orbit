"use client"

import { useState, useEffect, useCallback } from "react"
import { Smartphone, Wifi, WifiOff, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type WhatsAppStatus = 'disconnected' | 'connecting' | 'connected'

interface WhatsAppConnectionProps {
  compact?: boolean
}

export function WhatsAppConnection({ compact = false }: WhatsAppConnectionProps) {
  const [status, setStatus] = useState<WhatsAppStatus>('disconnected')
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status')
      const data = await res.json()
      setStatus(data.connected ? 'connected' : 'disconnected')
      setError(data.error || null)
    } catch {
      setStatus('disconnected')
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    await checkStatus()
    setIsLoading(false)
  }, [checkStatus])

  const handleDisconnect = useCallback(async () => {
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'POST' })
      setStatus('disconnected')
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  useEffect(() => {
    if (status === 'connected' && showModal) {
      setTimeout(() => setShowModal(false), 1500)
    }
  }, [status, showModal])

  const statusConfig = {
    disconnected: { color: 'text-zinc-500', bg: 'bg-zinc-500/20', label: 'Desconectado' },
    connecting: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Verificando...' },
    connected: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Conectado' }
  }

  const config = statusConfig[status]

  if (compact) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${config.bg} ${config.color} hover:opacity-80`}
      >
        {status === 'connected' ? (
          <Wifi className="w-3 h-3" />
        ) : status === 'connecting' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <WifiOff className="w-3 h-3" />
        )}
        <span className="hidden sm:inline">WhatsApp</span>
      </button>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg}`}>
          {status === 'connected' ? (
            <Wifi className={`w-4 h-4 ${config.color}`} />
          ) : (
            <WifiOff className={`w-4 h-4 ${config.color}`} />
          )}
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
        </div>

        {status === 'connected' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="text-zinc-400 hover:text-red-400"
          >
            Desconectar
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowModal(true)}
            className="border-zinc-700"
          >
            <Smartphone className="w-4 h-4 mr-2" />
            Verificar
          </Button>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 z-[100]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Status do WhatsApp (Z-API)
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center py-6 gap-4">
            {status === 'connected' ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Wifi className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-emerald-400 font-medium">Conectado com sucesso!</p>
                <p className="text-zinc-500 text-sm text-center">
                  O WhatsApp está conectado via Z-API
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-zinc-500/20 flex items-center justify-center">
                  <WifiOff className="w-8 h-8 text-zinc-400" />
                </div>
                <p className="text-zinc-300 font-medium">Não conectado</p>
                <p className="text-zinc-500 text-sm text-center max-w-xs">
                  Acesse o painel da Z-API para conectar seu WhatsApp escaneando o QR code
                </p>
                {error && (
                  <p className="text-red-400 text-xs">{error}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="border-zinc-700"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Verificar novamente
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => window.open('https://app.z-api.io', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir Z-API
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function WhatsAppStatusIndicator() {
  const [status, setStatus] = useState<WhatsAppStatus>('disconnected')

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status')
        const data = await res.json()
        setStatus(data.connected ? 'connected' : 'disconnected')
      } catch {
        setStatus('disconnected')
      }
    }

    checkStatus()
  }, [])

  if (status !== 'connected') return null

  return (
    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-zinc-900 animate-pulse" />
  )
}
