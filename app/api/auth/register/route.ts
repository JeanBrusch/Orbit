import { NextRequest, NextResponse } from "next/server"
import { registerUser, setSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }
    
    if (password.length < 6) {
      return NextResponse.json({ error: "Senha deve ter pelo menos 6 caracteres" }, { status: 400 })
    }
    
    const user = await registerUser(email, password, name)
    await setSession(user)
    
    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error("Register error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
