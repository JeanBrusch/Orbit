import { NextRequest, NextResponse } from "next/server"
import { loginUser, setSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
    }
    
    const user = await loginUser(email, password)
    await setSession(user)
    
    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error("Login error:", error)
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
}
