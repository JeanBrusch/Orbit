export function normalizePhone(phone: string): string {
  if (!phone) return ''
  
  let digits = phone.replace(/\D/g, '')
  
  if (digits.startsWith('0')) {
    digits = digits.substring(1)
  }
  
  if (!digits.startsWith('55')) {
    digits = '55' + digits
  }
  
  if (digits.length === 14 && digits.startsWith('559')) {
    digits = digits.slice(0, 4) + digits.slice(5)
  }
  
  return digits
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone)
  
  if (normalized.length === 13) {
    return `+${normalized.slice(0, 2)} (${normalized.slice(2, 4)}) ${normalized.slice(4, 9)}-${normalized.slice(9)}`
  }
  if (normalized.length === 12) {
    return `+${normalized.slice(0, 2)} (${normalized.slice(2, 4)}) ${normalized.slice(4, 8)}-${normalized.slice(8)}`
  }
  
  return `+${normalized}`
}

export function validateBrazilianPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  if (normalized.length < 12 || normalized.length > 13) {
    return false
  }
  if (!normalized.startsWith('55')) {
    return false
  }
  const ddd = normalized.slice(2, 4)
  const dddNum = parseInt(ddd, 10)
  if (dddNum < 11 || dddNum > 99) {
    return false
  }
  return true
}

export function isValidPhoneFormat(phone: string): { valid: boolean; reason?: string } {
  if (!phone) {
    return { valid: false, reason: 'empty' }
  }
  
  if (isLidFormat(phone)) {
    return { valid: false, reason: 'is_lid_format' }
  }
  
  const digits = phone.replace(/\D/g, '')
  
  if (digits.length > 15) {
    return { valid: false, reason: 'too_long_likely_whatsapp_id' }
  }
  
  if (digits.length < 10) {
    return { valid: false, reason: 'too_short' }
  }
  
  const normalized = normalizePhone(phone)
  
  if (normalized.length < 12 || normalized.length > 13) {
    return { valid: false, reason: 'invalid_length_after_normalization' }
  }
  
  return { valid: true }
}

export function isLidFormat(value: string): boolean {
  if (!value) return false
  return value.includes('@lid')
}

export function extractLid(senderLid?: string, chatLid?: string): string | null {
  const lid = senderLid || chatLid
  if (!lid) return null
  return lid.replace('@lid', '').trim()
}

export function hasRealPhone(phone: string): boolean {
  if (!phone) return false
  if (isLidFormat(phone)) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}
