import { NextResponse } from 'next/server'
import { getStatus } from '@/lib/zapi/client'

export async function GET() {
  try {
    const status = await getStatus()
    return NextResponse.json(status)
  } catch (error: any) {
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 })
  }
}
