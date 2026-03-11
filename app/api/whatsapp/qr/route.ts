import { NextResponse } from 'next/server'
import { getStatus } from '@/lib/zapi/client'

export async function GET() {
  try {
    const status = await getStatus()
    
    return NextResponse.json({
      status: status.connected ? 'connected' : 'disconnected',
      qrDataUrl: null,
      message: 'Z-API não requer QR code no servidor. Configure o QR code no painel da Z-API.'
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
