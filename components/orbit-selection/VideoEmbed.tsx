"use client"

import React from "react"

interface VideoEmbedProps {
  url: string
  className?: string
}

export const VideoEmbed: React.FC<VideoEmbedProps> = ({ url, className = "" }) => {
  const getEmbedInfo = (url: string) => {
    // YouTube Shorts — must be checked before generic YouTube regex
    const shortsRegex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^&?/\s]+)/
    const shortsMatch = url.match(shortsRegex)
    if (shortsMatch && shortsMatch[1]) {
      return { type: "youtube-shorts", id: shortsMatch[1] }
    }

    // YouTube generic (watch/embed/v/youtu.be)
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([^&?/\s]+)/
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
      {/* YouTube Shorts: portrait 9:16 */}
      {info.type === "youtube-shorts" && (
        <div className="w-full flex justify-center bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${info.id}?rel=0&modestbranding=1`}
            className="border-0"
            style={{ width: "min(100%, 340px)", aspectRatio: "9/16" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube Shorts Player"
          />
        </div>
      )}
      {/* YouTube standard: landscape 16:9 */}
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
      {info.type === "loom" && (
        <div style={{ position: "relative", paddingBottom: "62.5%", height: 0 }}>
          <iframe
            src={`https://www.loom.com/embed/${info.id}?hide_owner=true&hide_share=true&hide_title=true&hide_embed_talk=true`}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            frameBorder="0"
            allowFullScreen
            title="Loom Video Player"
          />
        </div>
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
