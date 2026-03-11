"use client"

import { useEffect, useRef } from "react"

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const drawStaticBackground = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const isDark = document.documentElement.classList.contains("dark")

      const centerX = canvas.width * 0.42
      const centerY = canvas.height * 0.5
      const gridRings = [260, 360, 460, 560]
      const gridOpacity = isDark ? 0.06 : 0.04

      gridRings.forEach((radius, i) => {
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.strokeStyle = isDark
          ? `rgba(46, 197, 255, ${gridOpacity - i * 0.008})`
          : `rgba(14, 165, 233, ${gridOpacity - i * 0.006})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      })

      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(centerX + Math.cos(angle) * 500, centerY + Math.sin(angle) * 500)
        ctx.strokeStyle = isDark ? `rgba(46, 197, 255, 0.03)` : `rgba(14, 165, 233, 0.02)`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      const streamOpacity = isDark ? 0.015 : 0.008
      for (let i = 0; i < 5; i++) {
        const y = canvas.height * (0.2 + i * 0.15)
        const gradient = ctx.createLinearGradient(0, y, canvas.width, y)
        gradient.addColorStop(0, `rgba(46, 197, 255, 0)`)
        gradient.addColorStop(0.3, `rgba(46, 197, 255, ${streamOpacity})`)
        gradient.addColorStop(0.7, `rgba(46, 197, 255, ${streamOpacity})`)
        gradient.addColorStop(1, `rgba(46, 197, 255, 0)`)
        ctx.fillStyle = gradient
        ctx.fillRect(0, y - 1, canvas.width, 2)
      }

      const blueParticle = isDark ? [46, 197, 255] : [14, 165, 233]
      const starCount = 30
      for (let i = 0; i < starCount; i++) {
        const starX = (Math.sin(i * 0.5) * 0.5 + 0.5) * canvas.width
        const starY = (Math.cos(i * 0.7) * 0.5 + 0.5) * canvas.height
        const starSize = 0.5
        const starOpacity = isDark ? 0.15 : 0.08

        ctx.beginPath()
        ctx.arc(starX, starY, starSize, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${blueParticle[0]}, ${blueParticle[1]}, ${blueParticle[2]}, ${starOpacity})`
        ctx.fill()
      }
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      drawStaticBackground()
    }
    
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    const observer = new MutationObserver(() => {
      drawStaticBackground()
    })
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    })

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0" />
}
