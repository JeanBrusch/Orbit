"use client"

import React from "react"

interface VideoEmbedProps {
  url: string
  className?: string
}

export const VideoEmbed: React.FC<VideoEmbedProps> = ({ url, className = "" }) => {
  const getEmbedInfo = (url: string) => {
    // YouTube
    const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/\s]+)/)
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

  if (!info) return null

  return (
    <div className={`video-embed-container overflow-hidden rounded-xl border border-[rgba(28,24,18,0.1)] bg-black/5 ${className}`}>
      {info.type === "youtube" && (
        <iframe
          src={`https://www.youtube.com/embed/${info.id}?rel=0`}
          className="w-full aspect-video border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
      {info.type === "vimeo" && (
        <iframe
          src={`https://player.vimeo.com/video/${info.id}`}
          className="w-full aspect-video border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      )}
      {info.type === "direct" && (
        <video 
          src={info.id} 
          controls 
          className="w-full aspect-video object-cover"
          poster=""
        />
      )}
    </div>
  )
}
