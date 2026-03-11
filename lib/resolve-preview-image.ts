import { createHash } from 'crypto'
import sharp from 'sharp'

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106"

const MAX_WIDTH = 800
const MAX_SIZE_BYTES = 500 * 1024
const TIMEOUT_MS = 5000

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string
  objectName: string
  method: "GET" | "PUT" | "DELETE" | "HEAD"
  ttlSec: number
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  }
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }
  )
  if (!response.ok) {
    throw new Error(`Failed to sign object URL: ${response.status}`)
  }
  const { signed_url: signedURL } = await response.json()
  return signedURL
}

function getPrivateObjectDir(): string {
  return process.env.PRIVATE_OBJECT_DIR || ""
}

function parseObjectDir(dir: string): { bucketName: string; objectPath: string } {
  const cleaned = dir.startsWith('/') ? dir.slice(1) : dir
  const parts = cleaned.split('/')
  return {
    bucketName: parts[0],
    objectPath: parts.slice(1).join('/'),
  }
}

function hashSourceLink(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

function extractOgImage(html: string): string | null {
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
  if (ogImageMatch) return ogImageMatch[1]
  
  const ogImageAlt = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  if (ogImageAlt) return ogImageAlt[1]
  
  const twitterImage = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
  if (twitterImage) return twitterImage[1]
  
  const imgWithSize = html.match(/<img[^>]*(?:width|height)=["']?\d+["']?[^>]*src=["']([^"']+)["']/gi)
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

export async function resolvePreviewImage(
  sourceUrl: string,
  propertyId: string
): Promise<string | null> {
  try {
    console.log(`[resolvePreviewImage] Starting for ${sourceUrl}`)
    
    const htmlResponse = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ORBIT/1.0; +https://orbit.app)',
        'Accept': 'text/html,application/xhtml+xml',
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ORBIT/1.0)',
      },
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
    const objectName = `atlas/${urlHash}.webp`
    
    const privateDir = getPrivateObjectDir()
    if (!privateDir) {
      console.error('[resolvePreviewImage] PRIVATE_OBJECT_DIR not set')
      return null
    }
    
    const { bucketName, objectPath } = parseObjectDir(privateDir)
    const fullObjectName = objectPath ? `${objectPath}/${objectName}` : objectName
    
    const uploadUrl = await signObjectURL({
      bucketName,
      objectName: fullObjectName,
      method: 'PUT',
      ttlSec: 900,
    })
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(processedImage),
      headers: {
        'Content-Type': 'image/webp',
      },
    })
    
    if (!uploadResponse.ok) {
      console.error(`[resolvePreviewImage] Failed to upload to storage: ${uploadResponse.status}`)
      return null
    }
    
    const publicUrl = `/api/objects/${objectName}`
    console.log(`[resolvePreviewImage] Success: ${publicUrl}`)
    
    return publicUrl
  } catch (error) {
    console.error('[resolvePreviewImage] Error:', error)
    return null
  }
}
