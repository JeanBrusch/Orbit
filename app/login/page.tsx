"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Orbit, Loader2, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, register } = useAuth()
  const router = useRouter()
  
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, isLoading, router])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    
    try {
      if (mode === "login") {
        const result = await login(email, password)
        if (result.success) {
          router.push("/")
        } else {
          setError(result.error || "Erro ao fazer login")
        }
      } else {
        const result = await register(email, password, name || undefined)
        if (result.success) {
          router.push("/")
        } else {
          setError(result.error || "Erro ao criar conta")
        }
      }
    } finally {
      setSubmitting(false)
    }
  }
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    )
  }
  
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/20 ring-1 ring-cyan-400/50">
            <Orbit className="h-5 w-5 text-cyan-400" />
          </div>
          <span className="text-xl font-light tracking-widest text-white">ORBIT</span>
        </div>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-light leading-tight text-white">
            Campo Cognitivo para
            <br />
            <span className="text-cyan-400">Gestão de Leads</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-md">
            Visualize seus leads como planetas em órbita. Acompanhe jornadas de decisão, 
            envie capsulas de imóveis e mantenha conexões via WhatsApp.
          </p>
        </div>
        
        <p className="text-sm text-slate-500">
          © 2026 ORBIT. Todos os direitos reservados.
        </p>
      </div>
      
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-slate-950 p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/20 ring-1 ring-cyan-400/50">
              <Orbit className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="text-xl font-light tracking-widest text-white">ORBIT</span>
          </div>
          
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-light text-white">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h2>
            <p className="text-slate-400">
              {mode === "login" 
                ? "Entre com suas credenciais" 
                : "Preencha os dados para criar sua conta"}
            </p>
          </div>
          
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            )}
            
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-medium"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>
          
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login")
                setError("")
              }}
              className="text-sm text-cyan-400 hover:text-cyan-300"
            >
              {mode === "login" 
                ? "Não tem conta? Criar uma" 
                : "Já tem conta? Fazer login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
