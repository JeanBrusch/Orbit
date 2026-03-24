const ZAPI_BASE_URL = 'https://api.z-api.io/instances'

function getConfig() {
  const instanceId = process.env.ZAPI_INSTANCE_ID?.trim()
  const token = process.env.ZAPI_TOKEN?.trim()
  const securityToken = process.env.ZAPI_SECURITY_TOKEN?.trim()
  
  if (!instanceId || !token) {
    console.error('[ZAPI] Missing configuration (critical for Vercel):', { 
      hasInstanceId: !!instanceId, 
      hasToken: !!token,
      environment: process.env.NODE_ENV
    })
    throw new Error('ZAPI_INSTANCE_ID and ZAPI_TOKEN are required')
  }
  
  console.log('[ZAPI] Config loaded successfully for instance:', instanceId)
  return { instanceId, token, securityToken }
}

function getBaseUrl() {
  const { instanceId, token } = getConfig()
  return `${ZAPI_BASE_URL}/${instanceId}/token/${token}`
}

/** For profile/contact endpoints: pass LID as NUMBER@lid, phone as digits only. */
function normalizeIdentifier(phoneOrLid: string): string {
  if (!phoneOrLid) return ''
  if (phoneOrLid.includes('@lid')) return phoneOrLid.trim()
  return phoneOrLid.replace(/\D/g, '')
}

export interface ZAPIStatus {
  connected: boolean
  smartphoneConnected?: boolean
  session?: string
  error?: string
}

export interface ZAPISendResult {
  zaapId: string
  messageId: string
  id?: string
}

export interface ZAPIContact {
  phone: string
  name?: string
  profilePicUrl?: string
  isRegistered: boolean
}

export async function getStatus(): Promise<ZAPIStatus> {
  try {
    const { securityToken } = getConfig()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    
    if (securityToken) {
      headers['Client-Token'] = securityToken
    }
    
    const response = await fetch(`${getBaseUrl()}/status`, {
      method: 'GET',
      headers
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Z-API status error:', response.status, errorText)
      return { connected: false, error: `HTTP ${response.status}` }
    }
    
    const data = await response.json()
    console.log('Z-API status response:', data)
    return {
      connected: data.connected === true,
      smartphoneConnected: data.smartphoneConnected === true,
      session: data.session,
      error: data.error
    }
  } catch (error: any) {
    console.error('Z-API status exception:', error.message)
    return { connected: false, error: error.message }
  }
}

export async function sendMessage(phone: string, message: string): Promise<ZAPISendResult> {
  const isLid = phone.includes('@lid')
  // Z-API expects 'NUMBER@lid' for LIDs or 'NUMBER' for phones.
  // We ensure the identifier is clean.
  const cleanPhone = isLid ? phone.trim() : phone.replace(/\D/g, '')
  
  const { securityToken } = getConfig()
  const headers: Record<string, string> = { 
    'Content-Type': 'application/json',
    ...(securityToken ? { 'Client-Token': securityToken } : {})
  }
  
  const url = `${getBaseUrl()}/send-text`
  console.log('[ZAPI] Attempting fetch to:', url.replace(/\/[^/]+$/, '/***'), 'phone:', cleanPhone)
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: cleanPhone,
        message: message
      })
    })
    
    console.log('[ZAPI] Response status:', response.status)
    const responseData = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('[ZAPI] Error response from server:', responseData)
      throw new Error(responseData.error || responseData.message || `Failed to send message: ${response.status}`)
    }
    
    console.log('[ZAPI] Message sent successfully:', responseData.messageId)
    return responseData
  } catch (error: any) {
    console.error('[ZAPI] Fetch exception:', error.message)
    throw error
  }
}

async function sendMedia(phone: string, mediaUrl: string, endpoint: string, extra: Record<string, any> = {}): Promise<ZAPISendResult> {
  const isLid = phone.includes('@lid')
  const cleanPhone = isLid ? phone.trim() : phone.replace(/\D/g, '')
  
  const { securityToken } = getConfig()
  const headers: Record<string, string> = { 
    'Content-Type': 'application/json',
    ...(securityToken ? { 'Client-Token': securityToken } : {})
  }
  
  const url = `${getBaseUrl()}/${endpoint}`
  console.log(`[ZAPI] Attempting media fetch to: ${endpoint}`, 'phone:', cleanPhone)
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: cleanPhone,
        [endpoint.includes('image') ? 'image' : endpoint.includes('audio') ? 'audio' : 'url']: mediaUrl,
        ...extra
      })
    })
    
    const responseData = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error(`[ZAPI] Error sending ${endpoint}:`, responseData)
      throw new Error(responseData.error || responseData.message || `Failed to send ${endpoint}: ${response.status}`)
    }
    
    console.log(`[ZAPI] ${endpoint} sent successfully:`, responseData.messageId)
    return responseData
  } catch (error: any) {
    console.error(`[ZAPI] ${endpoint} exception:`, error.message)
    throw error
  }
}

export async function sendImage(phone: string, imageUrl: string, caption?: string): Promise<ZAPISendResult> {
  return sendMedia(phone, imageUrl, 'send-image', { caption })
}

export async function sendAudio(phone: string, audioUrl: string): Promise<ZAPISendResult> {
  // Z-API expects 'audio' field for send-audio
  return sendMedia(phone, audioUrl, 'send-audio')
}

export async function getContact(phone: string): Promise<ZAPIContact> {
  const cleanPhone = phone.replace(/\D/g, '')
  
  try {
    const response = await fetch(`${getBaseUrl()}/phone-exists/${cleanPhone}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (!response.ok) {
      return { phone: cleanPhone, isRegistered: false }
    }
    
    const data = await response.json()
    return {
      phone: cleanPhone,
      isRegistered: data.exists === true
    }
  } catch {
    return { phone: cleanPhone, isRegistered: false }
  }
}

export interface ZAPIContactMetadata {
  phone: string
  name?: string
  pushName?: string
  profilePicUrl?: string
}

export async function getContactMetadata(phone: string): Promise<ZAPIContactMetadata> {
  const identifier = normalizeIdentifier(phone)
  const { securityToken } = getConfig()
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (securityToken) {
    headers['Client-Token'] = securityToken
  }
  
  try {
    const response = await fetch(`${getBaseUrl()}/contact-metadata?phone=${encodeURIComponent(identifier)}`, {
      method: 'GET',
      headers
    })
    
    if (!response.ok) {
      console.log('Z-API contact-metadata failed:', response.status)
      return { phone: identifier }
    }
    
    const data = await response.json()
    console.log('Z-API contact-metadata response:', JSON.stringify(data))
    return {
      phone: identifier,
      name: data.displayName || data.name || data.pushname,
      pushName: data.pushname,
      profilePicUrl: data.imgUrl || data.profilePic
    }
  } catch (error) {
    console.error('Z-API contact-metadata error:', error)
    return { phone: identifier }
  }
}

export async function getContactProfile(phone: string): Promise<{ name?: string; photoUrl?: string }> {
  const identifier = normalizeIdentifier(phone)
  
  // Fetch metadata and profile picture in parallel
  const [metadata, profilePicUrl] = await Promise.all([
    getContactMetadata(identifier),
    getProfilePicture(identifier)
  ])
  
  return {
    name: metadata.name || metadata.pushName,
    photoUrl: profilePicUrl || metadata.profilePicUrl || undefined
  }
}

export async function getProfilePicture(phone: string): Promise<string | null> {
  const identifier = normalizeIdentifier(phone)
  const { securityToken } = getConfig()
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (securityToken) {
    headers['Client-Token'] = securityToken
  }
  
  try {
    const response = await fetch(`${getBaseUrl()}/profile-picture?phone=${encodeURIComponent(identifier)}`, {
      method: 'GET',
      headers
    })
    
    if (!response.ok) {
      console.log('Z-API profile-picture failed:', response.status)
      return null
    }
    
    const data = await response.json()
    console.log('Z-API profile-picture response:', JSON.stringify(data))
    return data.url || data.link || null
  } catch (error) {
    console.error('Z-API profile-picture error:', error)
    return null
  }
}

export interface CarouselCard {
  text: string
  image: string
  buttons?: {
    id?: string
    label: string
    type: 'URL' | 'REPLY' | 'CALL'
    url?: string
    phone?: string
  }[]
}

export async function sendCarousel(
  phone: string,
  message: string,
  carousel: CarouselCard[]
): Promise<ZAPISendResult> {
  const isLid = phone.includes('@lid')
  const cleanPhone = isLid ? phone.trim() : phone.replace(/\D/g, '')
  const { securityToken } = getConfig()

  const url = `${getBaseUrl()}/send-carousel`
  console.log('[ZAPI] Attempting carousel fetch, phone:', cleanPhone, 'cards:', carousel.length)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(securityToken ? { 'Client-Token': securityToken } : {})
      },
      body: JSON.stringify({ phone: cleanPhone, message, carousel })
    })

    const responseData = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('[ZAPI] Error sending carousel:', responseData)
      throw new Error(responseData.error || responseData.message || `Failed to send carousel: ${response.status}`)
    }

    console.log('[ZAPI] Carousel sent successfully:', responseData.messageId)
    return responseData
  } catch (error: any) {
    console.error('[ZAPI] sendCarousel exception:', error.message)
    throw error
  }
}

export async function disconnect(): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error disconnecting Z-API:', error)
  }
}
