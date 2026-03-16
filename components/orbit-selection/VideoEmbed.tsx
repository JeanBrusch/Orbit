"use client"

import React from "react"

interface VideoEmbedProps {
  url: string
  className?: string
}

export const VideoEmbed: React.FC<VideoEmbedProps> = ({ url, className = "" }) => {
  const getEmbedInfo = (url: string) => {
    // YouTube (shorts/embed/watch/v/youtu.be)
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([^&?/\s]+)/
    const ytMatch = url.match(ytRegex)
    if (ytMatch && ytMatch[1]) {
      return { type: "youtube", id: ytMatch[1] }
    }

    // Vimeo
    const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/)
    if (vimeoMatch && vimeoMatch[1]) {
      return { type: "vimeo", id: vimeoMatch[1] }
    }

    // Direct Video
    const isDirect = url.match(/\.(mp4|webm|ogg|mov)(?:\?.*)?$/i)
    if (isDirect) {
      return { type: "direct", id: url }
    }

    return null
  }

  const info = getEmbedInfo(url)

  if (!info) {
    console.warn("VideoEmbed: Unsupported URL", url)
    return null
  }

  return (
    <div className={`video-embed-container overflow-hidden rounded-xl border border-[rgba(28,24,18,0.1)] bg-black/5 ${className}`}>
      {info.type === "youtube" && (
        <iframe
          src={`https://www.youtube.com/embed/${info.id}?rel=0&modestbranding=1`}
          className="w-full aspect-video border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube Video Player"
        />
      )}
      {info.type === "vimeo" && (
        <iframe
          src={`https://player.vimeo.com/video/${info.id}?badge=0&autopause=0&player_id=0&app_id=58479`}
          className="w-full aspect-video border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Vimeo Video Player"
        />
      )}
      {info.type === "direct" && (
        <video 
          src={info.id} 
          controls 
          className="w-full aspect-video object-cover"
          poster=""
        >
          Seu navegador não suporta a reprodução de vídeos.
        </video>
      )}
    </div>
  )
}
