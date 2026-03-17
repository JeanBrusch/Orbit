import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename using timestamp and original name
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'tmp'
    const filename = `${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`

    const supabase = getSupabaseServer()

    // Upload to Supabase Storage bucket 'atlas'
    const { data, error } = await supabase
      .storage
      .from('atlas')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('Storage upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return the proxy path for the uploaded file
    // Assumes GET /api/objects/atlas/[hash] handles the serving
    return NextResponse.json({ 
      url: `/api/objects/atlas/${filename}`,
      originalUrl: data.path
    })

  } catch (error) {
    console.error('Upload route error:', error)
    return NextResponse.json(
      { error: 'Falha ao processar o upload' },
      { status: 500 }
    )
  }
}
