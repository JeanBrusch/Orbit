import { cookies } from "next/headers"
import crypto from "crypto"
import { getSupabaseServer } from "@/lib/supabase-server"

const SESSION_COOKIE = "orbit_session"
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000 // 1 week

export interface AuthUser {
  id: string
  email: string
  name?: string | null
}

interface SessionData {
  userId: string
  email: string
  name?: string | null
  expiresAt: number
}

interface DbUser {
  id: string
  email: string
  name: string | null
  password_hash: string
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex")
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export async function registerUser(email: string, password: string, name?: string): Promise<AuthUser> {
  const supabase = getSupabaseServer()
  
  const { data: existing } = await supabase
    .from('app_users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  
  if (existing) {
    throw new Error("Email já cadastrado")
  }
  
  const passwordHash = hashPassword(password)
  
  const { data: user, error } = await supabase
    .from('app_users')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name: name || null
    })
    .select('id, email, name')
    .single()
  
  if (error || !user) {
    console.error("Error creating user:", error)
    throw new Error("Erro ao criar usuário")
  }
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
  console.log("Login attempt for:", email.toLowerCase())
  
  const supabase = getSupabaseServer()
  
  const { data: user, error } = await supabase
    .from('app_users')
    .select('id, email, name, password_hash')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  
  console.log("DB login response:", { user: user ? "found" : "not found", error: error?.message })
  
  if (error) {
    console.error("Login query error:", error)
    throw new Error("Erro ao verificar credenciais")
  }
  
  if (!user) {
    throw new Error("Email ou senha incorretos")
  }
  
  if (!verifyPassword(password, user.password_hash)) {
    throw new Error("Email ou senha incorretos")
  }
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}

export async function setSession(user: AuthUser): Promise<void> {
  const cookieStore = await cookies()
  const session: SessionData = {
    userId: user.id,
    email: user.email,
    name: user.name,
    expiresAt: Date.now() + SESSION_TTL,
  }
  
  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_TTL / 1000,
    path: "/",
  })
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE)
  
  if (!sessionCookie) return null
  
  try {
    const session = JSON.parse(sessionCookie.value) as SessionData
    
    if (session.expiresAt && Date.now() > session.expiresAt) {
      await clearSession()
      return null
    }
    
    return session
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession()
  
  if (!session) return null
  
  return {
    id: session.userId,
    email: session.email,
    name: session.name,
  }
}
