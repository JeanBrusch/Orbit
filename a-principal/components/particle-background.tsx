"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  color: "blue" | "amber"
}

interface EnergyWave {
  y: number
  amplitude: number
  frequency: number
  speed: number
  opacity: number
  color: "blue" | "amber"
}

interface OrbitalGrid {
  centerX: number
  centerY: number
  rings: number[]
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    const particles: Particle[] = []
    const particleCount = 150

    // Initialize particles - 70% blue, 30% amber
    for (let i = 0; i < particleCount; i++) {
      const size = Math.random() * 1.2 + 0.3
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size,
        speedX: (Math.random() - 0.3) * (0.3 / (size + 0.8)),
        speedY: (Math.random() - 0.5) * (0.15 / (size + 0.8)),
        opacity: Math.random() * 0.3 + 0.1,
        color: Math.random() > 0.3 ? "blue" : "amber",
      })
    }

    const energyWaves: EnergyWave[] = [
      { y: 0.35, amplitude: 30, frequency: 0.002, speed: 0.0003, opacity: 0.04, color: "blue" },
      { y: 0.5, amplitude: 40, frequency: 0.003, speed: 0.0004, opacity: 0.03, color: "blue" },
      { y: 0.65, amplitude: 25, frequency: 0.0025, speed: 0.00035, opacity: 0.025, color: "amber" },
    ]

    let animationId: number

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const isDark = document.documentElement.classList.contains("dark")
      const time = Date.now()

      const centerX = canvas.width * 0.42
      const centerY = canvas.height * 0.5
      const gridRings = [120, 200, 280, 360, 450]
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

      // Draw horizontal data stream lines
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

      // Draw energy waves
      energyWaves.forEach((wave) => {
        const waveTime = time * wave.speed
        ctx.beginPath()
        ctx.moveTo(0, canvas.height * wave.y)

        for (let x = 0; x <= canvas.width; x += 8) {
          const y =
            canvas.height * wave.y +
            Math.sin(x * wave.frequency + waveTime) * wave.amplitude +
            Math.sin(x * wave.frequency * 1.5 + waveTime * 1.3) * (wave.amplitude * 0.5)
          ctx.lineTo(x, y)
        }

        const waveColor =
          wave.color === "blue"
            ? isDark
              ? `rgba(46, 197, 255, ${wave.opacity})`
              : `rgba(14, 165, 233, ${wave.opacity * 0.7})`
            : isDark
              ? `rgba(255, 200, 122, ${wave.opacity})`
              : `rgba(245, 158, 11, ${wave.opacity * 0.7})`

        ctx.strokeStyle = waveColor
        ctx.lineWidth = 60
        ctx.stroke()
      })

      const blueParticle = isDark ? [46, 197, 255] : [14, 165, 233]
      const amberParticle = isDark ? [255, 200, 122] : [245, 158, 11]

      // Update and draw particles
      particles.forEach((particle) => {
        particle.x += particle.speedX
        particle.y += particle.speedY

        // Wrap around screen
        if (particle.x < 0) particle.x = canvas.width
        if (particle.x > canvas.width) particle.x = 0
        if (particle.y < 0) particle.y = canvas.height
        if (particle.y > canvas.height) particle.y = 0

        const rgb = particle.color === "blue" ? blueParticle : amberParticle
        const opacityMultiplier = isDark ? 1 : 0.6

        // Draw particle
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${particle.opacity * opacityMultiplier})`
        ctx.fill()

        // Subtle glow around particles
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${particle.opacity * 0.06 * opacityMultiplier})`
        ctx.fill()
      })

      const starCount = 30
      for (let i = 0; i < starCount; i++) {
        const starX = (Math.sin(time * 0.0001 + i * 0.5) * 0.5 + 0.5) * canvas.width
        const starY = (Math.cos(time * 0.00008 + i * 0.7) * 0.5 + 0.5) * canvas.height
        const starSize = 0.5 + Math.sin(time * 0.002 + i) * 0.3
        const starOpacity = isDark ? 0.15 + Math.sin(time * 0.001 + i) * 0.1 : 0.08

        ctx.beginPath()
        ctx.arc(starX, starY, starSize, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${blueParticle[0]}, ${blueParticle[1]}, ${blueParticle[2]}, ${starOpacity})`
        ctx.fill()
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0" />
}
