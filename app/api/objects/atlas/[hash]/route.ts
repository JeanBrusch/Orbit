import { NextResponse } from 'next/server'

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106"

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
    
    const privateDir = getPrivateObjectDir()
    if (!privateDir) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 500 }
      )
    }
    
    const { bucketName, objectPath } = parseObjectDir(privateDir)
    const objectName = `atlas/${hash}`
    const fullObjectName = objectPath ? `${objectPath}/${objectName}` : objectName
    
    const signedUrl = await signObjectURL({
      bucketName,
      objectName: fullObjectName,
      method: 'GET',
      ttlSec: 3600,
    })
    
    const imageResponse = await fetch(signedUrl)
    
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Object not found' },
        { status: 404 }
      )
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
