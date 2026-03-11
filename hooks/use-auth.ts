"use client"

import { useState, useEffect, useCallback } from "react"

export interface AuthUser {
  id: string
  email: string
  name?: string | null
}

interface UseAuthResult {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refetch: () => Promise<void>
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
      })
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("Error fetching user:", error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  useEffect(() => {
    fetchUser()
  }, [fetchUser])
  
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setUser(data.user)
        return { success: true }
      }
      
      return { success: false, error: data.error || "Erro ao fazer login" }
    } catch (error) {
      return { success: false, error: "Erro de conexão" }
    }
  }, [])
  
  const register = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setUser(data.user)
        return { success: true }
      }
      
      return { success: false, error: data.error || "Erro ao criar conta" }
    } catch (error) {
      return { success: false, error: "Erro de conexão" }
    }
  }, [])
  
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } catch (error) {
      console.error("Error logging out:", error)
    } finally {
      setUser(null)
      window.location.href = "/login"
    }
  }, [])
  
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refetch: fetchUser,
  }
}
