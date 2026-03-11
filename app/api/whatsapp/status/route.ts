import { NextResponse } from 'next/server'
import { getStatus } from '@/lib/zapi/client'

export async function GET() {
  try {
    const status = await getStatus()
    
    return NextResponse.json({
      status: status.connected ? 'connected' : 'disconnected',
      connected: status.connected,
      smartphoneConnected: status.smartphoneConnected,
      error: status.error
    })
  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'disconnected',
        connected: false,
        error: error.message 
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const status = await getStatus()
    
    return NextResponse.json({
      status: status.connected ? 'connected' : 'disconnected',
      connected: status.connected,
      smartphoneConnected: status.smartphoneConnected,
      error: status.error
    })
  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'disconnected',
        connected: false,
        error: error.message 
      },
      { status: 500 }
    )
  }
}
