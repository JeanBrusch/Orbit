import { NextResponse } from 'next/server'
import { disconnect } from '@/lib/zapi/client'

export async function POST() {
  try {
    await disconnect()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
