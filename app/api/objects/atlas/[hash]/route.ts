import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

const STORAGE_BUCKET = 'atlas'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params

    if (!hash || !/^[a-f0-9]+\.webp$/i.test(hash)) {
      return NextResponse.json(
        { error: 'Invalid object hash' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    // Gera URL assinada com 1h de validade (imagens privadas)
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(hash, 3600)

    if (error || !data?.signedUrl) {
      console.error('[GET /api/objects/atlas] Signed URL error:', error?.message)
      return NextResponse.json({ error: 'Object not found' }, { status: 404 })
    }

    // Faz proxy da imagem para não expor a URL assinada do Supabase ao cliente
    const imageResponse = await fetch(data.signedUrl)

    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Object not found' }, { status: 404 })
    }

    const imageBuffer = await imageResponse.arrayBuffer()

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (error) {
    console.error('[GET /api/objects/atlas] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
