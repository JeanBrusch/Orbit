import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string || 'whatsapp-media'
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    
    // Create a unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${fileExt}`
    const filePath = fileName

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('[UPLOAD] Storage error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    console.log('[UPLOAD] Success:', publicUrl)

    return NextResponse.json({ 
      url: publicUrl,
      path: filePath,
      size: file.size,
      type: file.type
    })
  } catch (err: any) {
    console.error('[UPLOAD] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
