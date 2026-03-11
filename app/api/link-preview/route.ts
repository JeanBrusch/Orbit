import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    const sourceDomain = parsedUrl.hostname.replace('www.', '')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OrbitBot/1.0)',
          'Accept': 'text/html',
        },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        return NextResponse.json({
          title: null,
          description: null,
          image: null,
          sourceDomain,
          sourceLink: url,
        })
      }

      const html = await response.text()
      
      const ogTitle = extractMeta(html, 'og:title')
      const title = ogTitle || extractTitle(html)
      const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')
      const image = extractMeta(html, 'og:image')

      let resolvedImage = image
      if (image && !image.startsWith('http')) {
        resolvedImage = new URL(image, url).href
      }

      const price = extractPrice(html)

      return NextResponse.json({
        title: title || null,
        description: description || null,
        image: resolvedImage || null,
        price: price || null,
        sourceDomain,
        sourceLink: url,
      })

    } catch (fetchError) {
      clearTimeout(timeout)
      return NextResponse.json({
        title: null,
        description: null,
        image: null,
        price: null,
        sourceDomain,
        sourceLink: url,
      })
    }

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch link preview' },
      { status: 500 }
    )
  }
}

function extractMeta(html: string, property: string): string | null {
  const ogPattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  )
  const ogMatch = html.match(ogPattern)
  if (ogMatch) return ogMatch[1]

  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i'
  )
  const reverseMatch = html.match(reversePattern)
  if (reverseMatch) return reverseMatch[1]

  return null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match ? match[1].trim() : null
}

function extractPrice(html: string): number | null {
  // Regex heurística para procurar R$ seguido de números e pontos
  const pricePattern = /R\$\s*([\d{1,3}(?:\.\d{3})*(?:,\d{2})?])/i
  const match = html.match(pricePattern)
  if (!match) return null
  
  // Limpar a string e converter pra numero puro
  const rawNumber = match[1].replace(/\./g, '').replace(',', '.')
  const num = parseFloat(rawNumber)
  return isNaN(num) ? null : num
}
