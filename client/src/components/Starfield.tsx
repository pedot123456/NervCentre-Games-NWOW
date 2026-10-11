import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  phase: number
  speed: number
  tint: string
}

/**
 * Animated night sky: twinkling stars drifting slowly, an occasional shooting star, and soft
 * blue / purple nebula glows. Runs at ~30 fps, pauses in background tabs, still for reduced motion.
 */
export function Starfield({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let stars: Star[] = []
    let w = 0
    let h = 0
    let dpr = 1
    const tints = ['255,255,255', '255,255,255', '207,222,255', '207,174,234', '191,215,48']

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(((w * h) / 5200) * density)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() < 0.08 ? 1.2 + Math.random() * 1.1 : 0.35 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.4,
        tint: tints[Math.floor(Math.random() * tints.length)],
      }))
    }
    resize()
    window.addEventListener('resize', resize)

    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null
    let raf = 0
    let last = 0
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (document.hidden || t - last < 33) return
      last = t
      ctx.clearRect(0, 0, w, h)
      const time = t / 1000
      for (const s of stars) {
        if (!reduced) {
          s.x -= 0.02 * s.speed
          if (s.x < -2) s.x = w + 2
        }
        const a = reduced ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase))
        ctx.beginPath()
        ctx.fillStyle = `rgba(${s.tint},${a.toFixed(3)})`
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
        if (s.r > 1.3) {
          ctx.fillStyle = `rgba(${s.tint},${(a * 0.18).toFixed(3)})`
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (!reduced) {
        if (!shooting && Math.random() < 0.004) {
          shooting = { x: Math.random() * w * 0.8 + w * 0.2, y: Math.random() * h * 0.4, vx: -9 - Math.random() * 5, vy: 3 + Math.random() * 2, life: 1 }
        }
        if (shooting) {
          const s = shooting
          const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9)
          grad.addColorStop(0, `rgba(255,255,255,${s.life})`)
          grad.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(s.x, s.y)
          ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9)
          ctx.stroke()
          s.x += s.vx
          s.y += s.vy
          s.life -= 0.025
          if (s.life <= 0 || s.x < -100 || s.y > h + 100) shooting = null
        }
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [density])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      {/* Brand Blue sky: #20419A at the top fading to a deep Blue, with a Purple glow (multiplayer) and a hint of Green. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_30%_-10%,#20419a_0%,#13286a_45%,#0b1a47_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_88%_88%,rgb(118_63_152/0.42),transparent_70%),radial-gradient(ellipse_40%_35%_at_5%_80%,rgb(0_161_156/0.16),transparent_70%)]" />
      <div className="grid-lines absolute inset-0" />
      <canvas ref={ref} className="absolute inset-0 size-full" />
    </div>
  )
}
