import { createHash } from 'crypto'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const MAX_WIDTH = 800
const MAX_SIZE_BYTES = 500 * 1024
const TIMEOUT_MS = 5000

// ─── Supabase Storage client (server-side) ───────────────────────────────────
// Usa SERVICE_ROLE_KEY para bypass de RLS no storage.
// Fallback para ANON_KEY se a service role não estiver configurada ainda.

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

const STORAGE_BUCKET = 'atlas'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashSourceLink(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

function extractOgImage(html: string): string | null {
  const ogImageMatch = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
  )
  if (ogImageMatch) return ogImageMatch[1]

  const ogImageAlt = html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
  )
  if (ogImageAlt) return ogImageAlt[1]

  const twitterImage = html.match(
    /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
  )
  if (twitterImage) return twitterImage[1]

  const imgWithSize = html.match(
    /<img[^>]*(?:width|height)=["']?\d+["']?[^>]*src=["']([^"']+)["']/gi
  )
  if (imgWithSize && imgWithSize.length > 0) {
    const srcMatch = imgWithSize[0].match(/src=["']([^"']+)["']/i)
    if (srcMatch) return srcMatch[1]
  }

  const firstImg = html.match(/<img[^>]*src=["']([^"']+)["']/i)
  if (firstImg) return firstImg[1]

  return null
}

async function processImage(buffer: ArrayBuffer): Promise<Buffer> {
  let image = sharp(Buffer.from(buffer))
  const metadata = await image.metadata()

  if (metadata.width && metadata.width > MAX_WIDTH) {
    image = image.resize(MAX_WIDTH, null, { withoutEnlargement: true })
  }

  let quality = 85
  let result = await image.webp({ quality }).toBuffer()

  while (result.length > MAX_SIZE_BYTES && quality > 30) {
    quality -= 10
    result = await image.webp({ quality }).toBuffer()
  }

  if (result.length > MAX_SIZE_BYTES) {
    const scaleFactor = Math.sqrt(MAX_SIZE_BYTES / result.length)
    const newWidth = Math.floor((metadata.width || MAX_WIDTH) * scaleFactor)
    result = await sharp(Buffer.from(buffer))
      .resize(newWidth, null, { withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer()
  }

  return result
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function resolvePreviewImage(
  sourceUrl: string,
  propertyId: string
): Promise<string | null> {
  try {
    console.log(`[resolvePreviewImage] Starting for ${sourceUrl}`)

    const htmlResponse = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ORBIT/1.0; +https://orbit.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!htmlResponse.ok) {
      console.error(`[resolvePreviewImage] Failed to fetch page: ${htmlResponse.status}`)
      return null
    }

    const html = await htmlResponse.text()
    const imageUrl = extractOgImage(html)

    if (!imageUrl) {
      console.log('[resolvePreviewImage] No og:image found')
      return null
    }

    const absoluteImageUrl = new URL(imageUrl, sourceUrl).href
    console.log(`[resolvePreviewImage] Found image: ${absoluteImageUrl}`)

    const imageResponse = await fetch(absoluteImageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ORBIT/1.0)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!imageResponse.ok) {
      console.error(`[resolvePreviewImage] Failed to download image: ${imageResponse.status}`)
      return null
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const processedImage = await processImage(imageBuffer)
    console.log(`[resolvePreviewImage] Processed image: ${processedImage.length} bytes`)

    const urlHash = hashSourceLink(sourceUrl)
    const objectPath = `${urlHash}.webp`

    const supabase = getStorageClient()
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, processedImage, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('[resolvePreviewImage] Upload failed:', uploadError.message)
      return null
    }

    // Retorna URL via proxy route para manter padrão do app
    const publicUrl = `/api/objects/atlas/${objectPath}`
    console.log(`[resolvePreviewImage] Success: ${publicUrl}`)

    return publicUrl
  } catch (error) {
    console.error('[resolvePreviewImage] Error:', error)
    return null
  }
}
