"use client"

import { useEffect, useRef } from "react"

/**
 * Efeitos de pulso sincronizados com a música do Title Menu — versão épica.
 *
 * Web Audio API (AnalyserNode) lê 3 bandas de frequência (grave/médio/agudo)
 * em tempo real. Tudo é escrito em CSS custom properties + desenhado num
 * <canvas> — zero re-render do React por frame.
 *
 * Camadas:
 *  - Canvas: espectro luminoso espelhado na base, partículas de energia que
 *    sobem a cada batida e ondas de choque duplas expandindo do centro
 *  - Moldura de luz dupla nas bordas que respira com o grave
 *  - Varredura aurora no topo reagindo aos agudos
 *  - Bloom radial central + glows nos cantos
 *  - Flash de impacto com leve aberração cromática
 *  - Vinheta que "socca" a tela na batida
 */

interface TitleBeatFXProps {
  /** Ref do elemento <audio> da música de fundo. */
  audioRef: React.RefObject<HTMLAudioElement | null>
  /** Só ativa a análise quando a música está tocando. */
  active: boolean
  /** Pausa/esconde tudo durante a transição de saída. */
  leaving: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
}

interface ShockRing {
  born: number
  strength: number
}

const CYAN = "56, 189, 248"
const PURPLE = "168, 85, 247"
const ICE = "224, 242, 254"

export default function TitleBeatFX({ audioRef, active, leaving }: TitleBeatFXProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceCreated = useRef(false)
  const rafRef = useRef<number | null>(null)
  const leavingRef = useRef(leaving)
  leavingRef.current = leaving

  useEffect(() => {
    if (!active) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const audio = audioRef.current
    if (!audio) return

    // Cria o pipeline de análise uma única vez (MediaElementSource só pode
    // ser criado uma vez por elemento <audio>)
    if (!sourceCreated.current) {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext
        const ctx: AudioContext = new Ctx()
        const source = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.65
        source.connect(analyser)
        analyser.connect(ctx.destination)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
        sourceCreated.current = true
      } catch {
        return
      }
    }

    const ctx = audioCtxRef.current
    const analyser = analyserRef.current
    if (!ctx || !analyser) return

    // Autoplay pode deixar o AudioContext suspenso — retoma no primeiro gesto
    const tryResume = () => {
      if (ctx.state === "suspended") void ctx.resume()
    }
    tryResume()
    const gestures = ["pointerdown", "keydown", "touchstart"]
    gestures.forEach((ev) => window.addEventListener(ev, tryResume, { passive: true }))

    // ---- Setup do canvas ----
    const canvas = canvasRef.current
    const c2d = canvas?.getContext("2d")
    let cw = 0
    let ch = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      if (!canvas) return
      const rect = canvas.parentElement?.getBoundingClientRect()
      cw = rect?.width || window.innerWidth
      ch = rect?.height || window.innerHeight
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
      c2d?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas?.parentElement) ro.observe(canvas.parentElement)

    const freqData = new Uint8Array(analyser.frequencyBinCount)

    // ---- Estado da detecção (fora do React) ----
    let smoothBass = 0
    let smoothMid = 0
    let smoothHigh = 0
    let flash = 0
    let punch = 0
    let prevBass = 0
    const history: number[] = []
    let lastBeatAt = 0

    const particles: Particle[] = []
    const rings: ShockRing[] = []

    // Barras do espectro (suavizadas individualmente para fluidez)
    const BAR_COUNT = 56
    const barLevels = new Float32Array(BAR_COUNT)

    const spawnBurst = (strength: number) => {
      const count = Math.round(10 + strength * 14)
      for (let i = 0; i < count; i++) {
        if (particles.length > 90) break
        const fromCenter = Math.random() < 0.4
        const x = fromCenter ? cw / 2 + (Math.random() - 0.5) * cw * 0.3 : Math.random() * cw
        particles.push({
          x,
          y: ch + 6,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -(1.2 + Math.random() * 2.4) * (0.7 + strength * 0.6),
          life: 0,
          maxLife: 60 + Math.random() * 50,
          size: 1 + Math.random() * 2.2,
          hue: Math.random() < 0.65 ? 199 : 271, // ciano ou roxo
        })
      }
    }

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      const root = rootRef.current
      if (!root) return

      if (leavingRef.current) {
        root.style.setProperty("--beat", "0")
        root.style.setProperty("--flash", "0")
        root.style.setProperty("--punch", "0")
        root.style.setProperty("--high", "0")
        if (c2d) c2d.clearRect(0, 0, cw, ch)
        return
      }

      analyser.getByteFrequencyData(freqData)

      // Bandas (fftSize 512 @ 44.1kHz → ~86 Hz por bin)
      let bassSum = 0
      for (let i = 1; i <= 9; i++) bassSum += freqData[i]
      const bass = bassSum / (9 * 255)

      let midSum = 0
      for (let i = 10; i <= 40; i++) midSum += freqData[i]
      const mid = midSum / (31 * 255)

      let highSum = 0
      for (let i = 41; i <= 110; i++) highSum += freqData[i]
      const high = highSum / (70 * 255)

      smoothBass = smoothBass * 0.82 + bass * 0.18
      smoothMid = smoothMid * 0.8 + mid * 0.2
      smoothHigh = smoothHigh * 0.75 + high * 0.25

      // ---- Detecção de batida ----
      history.push(bass)
      if (history.length > 43) history.shift()
      const avg = history.reduce((a, b) => a + b, 0) / history.length
      const now = performance.now()

      const isOnset = bass > 0.2 && bass > avg * 1.05
      const isAttack = bass - prevBass > 0.045 && bass > 0.18
      prevBass = bass

      if ((isOnset || isAttack) && now - lastBeatAt > 240) {
        lastBeatAt = now
        const strength = Math.min(1, Math.max(0.4, (bass - avg) * 6 + 0.5))
        flash = strength
        punch = strength
        rings.push({ born: now, strength })
        if (rings.length > 5) rings.shift()
        spawnBurst(strength)
      }

      flash *= 0.88
      punch *= 0.92

      root.style.setProperty("--beat", smoothBass.toFixed(3))
      root.style.setProperty("--flash", (flash < 0.01 ? 0 : flash).toFixed(3))
      root.style.setProperty("--punch", (punch < 0.01 ? 0 : punch).toFixed(3))
      root.style.setProperty("--high", smoothHigh.toFixed(3))

      // ---- Desenho no canvas ----
      if (!c2d) return
      c2d.clearRect(0, 0, cw, ch)
      c2d.globalCompositeOperation = "lighter"

      // Espectro luminoso espelhado na base
      const half = BAR_COUNT / 2
      const barW = cw / BAR_COUNT
      const maxBarH = ch * 0.26
      for (let i = 0; i < half; i++) {
        // Bins logarítmicos aproximados para distribuir melhor a energia
        const bin = 1 + Math.round(Math.pow(i / half, 1.6) * 100)
        const raw = (freqData[bin] / 255) * (0.5 + smoothBass * 0.9)
        const idxR = half + i
        const idxL = half - 1 - i
        barLevels[idxR] = Math.max(barLevels[idxR] * 0.86, raw)
        barLevels[idxL] = barLevels[idxR]
      }
      for (let i = 0; i < BAR_COUNT; i++) {
        const level = barLevels[i]
        if (level < 0.02) continue
        const h = level * maxBarH
        const x = i * barW
        const centerDist = Math.abs(i - half + 0.5) / half
        const hue = 199 + centerDist * 72 // ciano no centro → roxo nas pontas
        const grad = c2d.createLinearGradient(0, ch, 0, ch - h)
        grad.addColorStop(0, `hsla(${hue}, 95%, 62%, ${0.5 * level + 0.12})`)
        grad.addColorStop(0.7, `hsla(${hue}, 95%, 70%, ${0.22 * level})`)
        grad.addColorStop(1, "hsla(199, 95%, 80%, 0)")
        c2d.fillStyle = grad
        c2d.fillRect(x + barW * 0.15, ch - h, barW * 0.7, h)
        // Ponta brilhante
        c2d.fillStyle = `hsla(${hue}, 100%, 85%, ${0.55 * level})`
        c2d.fillRect(x + barW * 0.15, ch - h - 1.5, barW * 0.7, 2.5)
      }

      // Linha de horizonte pulsante na base
      const hGrad = c2d.createLinearGradient(0, 0, cw, 0)
      hGrad.addColorStop(0, `rgba(${PURPLE}, 0)`)
      hGrad.addColorStop(0.5, `rgba(${CYAN}, ${0.25 + smoothBass * 0.55})`)
      hGrad.addColorStop(1, `rgba(${PURPLE}, 0)`)
      c2d.fillStyle = hGrad
      c2d.fillRect(0, ch - 2 - smoothBass * 3, cw, 2 + smoothBass * 3)

      // Partículas de energia
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++
        p.x += p.vx
        p.y += p.vy
        p.vy *= 0.995
        if (p.life >= p.maxLife || p.y < -10) {
          particles.splice(i, 1)
          continue
        }
        const t = p.life / p.maxLife
        const alpha = (1 - t) * 0.85
        const r = p.size * (1 - t * 0.5)
        c2d.beginPath()
        c2d.arc(p.x, p.y, r, 0, Math.PI * 2)
        c2d.fillStyle = `hsla(${p.hue}, 95%, 72%, ${alpha})`
        c2d.fill()
        // Halo suave
        c2d.beginPath()
        c2d.arc(p.x, p.y, r * 3, 0, Math.PI * 2)
        c2d.fillStyle = `hsla(${p.hue}, 95%, 65%, ${alpha * 0.16})`
        c2d.fill()
      }

      // Ondas de choque duplas
      const cx = cw / 2
      const cy = ch * 0.42
      const maxR = Math.hypot(cw, ch) * 0.62
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i]
        const age = (now - ring.born) / 1100
        if (age >= 1) {
          rings.splice(i, 1)
          continue
        }
        const ease = 1 - Math.pow(1 - age, 3)
        const alpha = (1 - age) * 0.7 * ring.strength

        // Anel principal — ciano brilhante
        c2d.beginPath()
        c2d.arc(cx, cy, 30 + ease * maxR, 0, Math.PI * 2)
        c2d.strokeStyle = `rgba(${ICE}, ${alpha})`
        c2d.lineWidth = 2.5 * (1 - age) + 0.5
        c2d.stroke()
        c2d.beginPath()
        c2d.arc(cx, cy, 30 + ease * maxR, 0, Math.PI * 2)
        c2d.strokeStyle = `rgba(${CYAN}, ${alpha * 0.7})`
        c2d.lineWidth = 9 * (1 - age) + 1
        c2d.stroke()

        // Anel secundário atrasado — roxo
        const ease2 = 1 - Math.pow(1 - Math.max(0, age - 0.12) / 0.88, 3)
        if (age > 0.12) {
          c2d.beginPath()
          c2d.arc(cx, cy, 20 + ease2 * maxR * 0.85, 0, Math.PI * 2)
          c2d.strokeStyle = `rgba(${PURPLE}, ${alpha * 0.55})`
          c2d.lineWidth = 5 * (1 - age) + 0.5
          c2d.stroke()
        }
      }

      c2d.globalCompositeOperation = "source-over"
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      gestures.forEach((ev) => window.removeEventListener(ev, tryResume))
      ro.disconnect()
    }
  }, [active, audioRef])

  // Fecha o AudioContext ao desmontar a tela
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close()
      }
    }
  }, [])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={
        {
          "--beat": 0,
          "--flash": 0,
          "--punch": 0,
          "--high": 0,
          opacity: leaving ? 0 : 1,
          transition: "opacity 0.4s ease-out",
        } as React.CSSProperties
      }
    >
      {/* Bloom radial central — pulsa atrás do logo */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 55% 45% at 50% 42%, rgba(${CYAN}, 0.4) 0%, rgba(${PURPLE}, 0.15) 45%, transparent 72%)`,
          opacity: "calc(0.15 + var(--beat) * 0.85)",
          transform: "scale(calc(0.94 + var(--beat) * 0.14)) translateZ(0)",
          willChange: "opacity, transform",
        }}
      />

      {/* Varredura aurora no topo — reage aos agudos */}
      <div
        className="absolute inset-x-0 top-0 h-[38%]"
        style={{
          background: `linear-gradient(180deg, rgba(${CYAN}, 0.22) 0%, rgba(${PURPLE}, 0.08) 45%, transparent 100%)`,
          opacity: "calc(var(--high) * 1.4)",
          willChange: "opacity",
        }}
      />

      {/* Glows nos cantos inferiores — batida "acende" o chão da cena */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 45% 30% at 0% 100%, rgba(34, 211, 238, 0.45) 0%, transparent 70%), radial-gradient(ellipse 45% 30% at 100% 100%, rgba(${PURPLE}, 0.45) 0%, transparent 70%)`,
          opacity: "calc(var(--beat) * 0.9)",
          willChange: "opacity",
        }}
      />

      {/* Canvas: espectro, partículas e ondas de choque */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Moldura de luz dupla nas bordas — respira com o grave */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 calc(40px + var(--beat) * 220px) rgba(${CYAN}, calc(var(--beat) * 0.85)), inset 0 0 calc(14px + var(--beat) * 90px) rgba(${PURPLE}, calc(var(--beat) * 0.5))`,
          willChange: "box-shadow",
        }}
      />

      {/* Brilho intenso nas bordas no impacto da batida */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 180px rgba(125, 211, 252, 0.85), inset 0 0 60px rgba(${ICE}, 0.55)`,
          opacity: "var(--flash)",
          willChange: "opacity",
        }}
      />

      {/* Aberração cromática sutil nas bordas no impacto */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 6px 0 40px rgba(34, 211, 238, 0.5), inset -6px 0 40px rgba(217, 70, 239, 0.5)",
          opacity: "calc(var(--flash) * 0.8)",
          willChange: "opacity",
        }}
      />

      {/* Flash luminoso fugaz de tela cheia no impacto */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(${ICE}, 0.16) 0%, rgba(${ICE}, 0.05) 55%, transparent 80%)`,
          opacity: "var(--flash)",
          willChange: "opacity",
        }}
      />

      {/* Vinheta que "socca" a tela na batida — sensação de impacto físico */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: "inset 0 0 140px 30px rgba(2, 6, 23, 0.85)",
          opacity: "calc(var(--punch) * 0.7)",
          willChange: "opacity",
        }}
      />
    </div>
  )
}
