import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usa SERVICE_ROLE_KEY para leitura no storage (bypass de RLS).
// Fallback para ANON_KEY se não configurado ainda.
function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

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

    const supabase = getStorageClient()

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
