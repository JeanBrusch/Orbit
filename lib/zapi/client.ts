const ZAPI_BASE_URL = 'https://api.z-api.io/instances'

function getConfig() {
  const instanceId = process.env.ZAPI_INSTANCE_ID?.trim()
  const token = process.env.ZAPI_TOKEN?.trim()
  const securityToken = process.env.ZAPI_SECURITY_TOKEN?.trim()
  
  if (!instanceId || !token) {
    console.error('[ZAPI] Missing configuration:', { instanceId: !!instanceId, token: !!token })
    throw new Error('ZAPI_INSTANCE_ID and ZAPI_TOKEN are required')
  }
  
  return { instanceId, token, securityToken }
}

function getBaseUrl() {
  const { instanceId, token } = getConfig()
  return `${ZAPI_BASE_URL}/${instanceId}/token/${token}`
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
  console.log('[ZAPI] Sending to:', cleanPhone, 'url:', url.replace(/\/[^/]+$/, '/***'))
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phone: cleanPhone,
      message: message
    })
  })
  
  const responseData = await response.json().catch(() => ({}))

  if (!response.ok) {
    console.error('[ZAPI] Error sending message:', responseData)
    throw new Error(responseData.error || responseData.message || `Failed to send message: ${response.status}`)
  }
  
  return responseData
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
  const cleanPhone = phone.replace(/\D/g, '')
  const { securityToken } = getConfig()
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (securityToken) {
    headers['Client-Token'] = securityToken
  }
  
  try {
    const response = await fetch(`${getBaseUrl()}/contact-metadata?phone=${cleanPhone}`, {
      method: 'GET',
      headers
    })
    
    if (!response.ok) {
      console.log('Z-API contact-metadata failed:', response.status)
      return { phone: cleanPhone }
    }
    
    const data = await response.json()
    console.log('Z-API contact-metadata response:', JSON.stringify(data))
    return {
      phone: cleanPhone,
      name: data.displayName || data.name || data.pushname,
      pushName: data.pushname,
      profilePicUrl: data.imgUrl || data.profilePic
    }
  } catch (error) {
    console.error('Z-API contact-metadata error:', error)
    return { phone: cleanPhone }
  }
}

export async function getContactProfile(phone: string): Promise<{ name?: string; photoUrl?: string }> {
  const cleanPhone = phone.replace(/\D/g, '')
  
  // Fetch metadata and profile picture in parallel
  const [metadata, profilePicUrl] = await Promise.all([
    getContactMetadata(cleanPhone),
    getProfilePicture(cleanPhone)
  ])
  
  return {
    name: metadata.name || metadata.pushName,
    photoUrl: profilePicUrl || metadata.profilePicUrl || undefined
  }
}

export async function getProfilePicture(phone: string): Promise<string | null> {
  const cleanPhone = phone.replace(/\D/g, '')
  const { securityToken } = getConfig()
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (securityToken) {
    headers['Client-Token'] = securityToken
  }
  
  try {
    const response = await fetch(`${getBaseUrl()}/profile-picture?phone=${cleanPhone}`, {
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
