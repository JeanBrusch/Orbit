import { createHash } from 'crypto'

const TOKEN_SECRET = process.env.LEAD_TOKEN_SECRET || 'orbit-lead-token-v1'

export function generateLeadToken(leadId: string): string {
  const hash = createHash('sha256')
    .update(`${TOKEN_SECRET}:${leadId}`)
    .digest('base64url')
    .slice(0, 24)
  return hash
}

export function verifyLeadToken(token: string, leadId: string): boolean {
  const expectedToken = generateLeadToken(leadId)
  return token === expectedToken
}

export function extractLeadIdFromToken(token: string): string | null {
  return null
}
