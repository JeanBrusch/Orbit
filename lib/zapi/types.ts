export interface ZAPIWebhookMessage {
  phone: string
  chatName?: string
  senderPhoto?: string
  senderName?: string
  connectedPhone?: string
  senderLid?: string
  chatLid?: string
  text?: {
    message: string
  }
  image?: {
    imageUrl: string
    caption?: string
    mimeType?: string
  }
  document?: {
    documentUrl: string
    caption?: string
    fileName?: string
    mimeType?: string
  }
  audio?: {
    audioUrl: string
    mimeType?: string
    ptt?: boolean
  }
  video?: {
    videoUrl: string
    caption?: string
    mimeType?: string
  }
  sticker?: {
    stickerUrl: string
    mimeType?: string
  }
  messageId: string
  momment: number
  status: string
  fromMe?: boolean
  isFromMe?: boolean
  isGroup: boolean
  isBroadcast?: boolean
  broadcast?: boolean
  type?: string
  instanceId?: string
}

export interface ZAPIStatusWebhook {
  phone: string
  messageId: string
  status: 'SENT' | 'RECEIVED' | 'READ' | 'PLAYED'
  momment: number
}

export interface ZAPIConnectionWebhook {
  connected: boolean
  error?: string
}
