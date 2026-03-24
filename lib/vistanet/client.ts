// lib/vistanet/client.ts
// Handles decoding of the VistaNet public link format and fetching full property data.

const VISTANET_HOST = 'novovista-rest.vistahost.com.br'

const FIELDS = JSON.stringify({
  fields: [
    'Codigo', 'Cidade', 'Bairro', 'BairroComercial',
    'ValorVenda', 'Dormitorios', 'Suites',
    'AreaTotal', 'AreaPrivativa',
    'DescricaoWeb', 'FotoDestaque',
    'TipoImovel', 'Status',
    { Foto: ['Foto', 'FotoPequena', 'Destaque'] },
    { Corretor: ['Nome', 'Fone', 'Email', 'Foto'] },
    'Caracteristicas',
  ]
})

export interface VistaNetParams {
  key: string
  cod: string
  d: string
  cs: string
  cod_em: string
}

/** Decodes the base64 v2 query string into structured params */
export function decodeShortLink(v2: string): VistaNetParams {
  const decoded = Buffer.from(v2.trim(), 'base64').toString('utf-8')
  return Object.fromEntries(new URLSearchParams(decoded)) as unknown as VistaNetParams
}

/** Extracts the v2 param from a full novovista URL */
export function extractV2FromUrl(input: string): string | null {
  try {
    const u = new URL(input)
    return u.searchParams.get('v2')
  } catch {
    return null
  }
}

/** Fetches full property data from the VistaNet REST API */
export async function fetchVistaNetProperty(key: string, cod: string): Promise<Record<string, any>> {
  const url =
    `http://${VISTANET_HOST}/imoveis/detalhes` +
    `?key=${encodeURIComponent(key)}` +
    `&pesquisa=${encodeURIComponent(FIELDS)}` +
    `&imovel=${encodeURIComponent(cod)}`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`VistaNet API respondeu com status ${res.status}`)
  }

  const json = await res.json()

  // API returns an array for list, or object for single
  if (Array.isArray(json)) {
    if (json.length === 0) throw new Error('VistaNet: imóvel não encontrado')
    return json[0]
  }

  return json
}

/** Parses a Brazilian price string "1.234.567,89" → number */
export function parseBRL(value: string | null | undefined): number | null {
  if (!value) return null
  const n = parseFloat(value.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : Math.round(n)
}
