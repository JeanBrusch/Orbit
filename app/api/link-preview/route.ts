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
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
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
      const bedrooms = extractNumber(html, ['(?:quartos|quarto|dorms|dormit[oó]rios?)'])
      const suites = extractNumber(html, ['(?:su[ií]tes?)'])
      const parking = extractNumber(html, ['(?:vagas?|garagens|garagem)'])
      const area = extractArea(html)

      return NextResponse.json({
        title: title || null,
        description: description || null,
        image: resolvedImage || null,
        price: price || null,
        bedrooms: bedrooms || null,
        suites: suites || null,
        parking_spots: parking || null,
        area_privativa: area || null,
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
        bedrooms: null,
        suites: null,
        parking_spots: null,
        area_privativa: null,
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
  // Match R$ followed by number with Brazilian formatting (dots as thousands, comma as decimal)
  const pricePattern = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i
  const match = html.match(pricePattern)
  if (!match) return null
  
  const rawNumber = match[1].replace(/\./g, '').replace(',', '.')
  const num = parseFloat(rawNumber)
  return isNaN(num) ? null : num
}

/** Extract a numeric value associated with real estate attribute keywords */
function extractNumber(html: string, keywords: string[]): number | null {
  const cleanHtml = html.replace(/<[^>]+>/g, ' ');
  for (const kw of keywords) {
    // Pattern: "3 quartos" (number before keyword)
    const before = new RegExp(`(\\d+)\\s*${kw}`, 'i')
    const beforeMatch = cleanHtml.match(before)
    if (beforeMatch) return parseInt(beforeMatch[1], 10)

    // Pattern: "quartos: 3" (number after keyword)
    const after = new RegExp(`${kw}[^\\d]{0,15}(\\d+)`, 'i')
    const afterMatch = cleanHtml.match(after)
    if (afterMatch) return parseInt(afterMatch[1], 10)
  }
  return null
}

/** Extract area in m² */
function extractArea(html: string): number | null {
  const cleanHtml = html.replace(/<[^>]+>/g, ' ');
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(?:m|m2|m²)/i,
    /[áa]rea\s*(?:privativa|[úu]til|total)?[^0-9]{0,20}(\d+(?:[.,]\d+)?)/i,
  ]
  for (const p of patterns) {
    const m = cleanHtml.match(p)
    if (m) {
      const num = parseFloat(m[1].replace(',', '.'))
      if (!isNaN(num) && num > 10 && num < 10000) return num
    }
  }
  return null
}
