"use client"

import { useEffect, useRef } from "react"

/**
 * Efeito de pulso sincronizado com a música do Title Menu.
 *
 * Usa a Web Audio API (AnalyserNode) para ler a energia dos graves em tempo
 * real e escreve tudo em CSS custom properties direto no DOM — zero
 * re-render do React por frame. Camadas em tela cheia reagem à batida:
 *  - moldura de luz nas bordas (glow interno)
 *  - bloom radial central atrás do logo
 *  - flash branco muito sutil no impacto da batida
 *  - anéis de choque que expandem do centro a cada batida detectada
 */

interface TitleBeatFXProps {
  /** Ref do elemento <audio> da música de fundo. */
  audioRef: React.RefObject<HTMLAudioElement | null>
  /** Só ativa a análise quando a música está tocando. */
  active: boolean
  /** Pausa/esconde tudo durante a transição de saída. */
  leaving: boolean
}

const RING_POOL_SIZE = 3

export default function TitleBeatFX({ audioRef, active, leaving }: TitleBeatFXProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const ringRefs = useRef<(HTMLDivElement | null)[]>([])
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
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.6
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

    const freqData = new Uint8Array(analyser.frequencyBinCount)

    // Estado da detecção de batida (fora do React)
    let smoothBass = 0
    let flash = 0
    let prevBass = 0
    const history: number[] = []
    let lastBeatAt = 0
    let ringIndex = 0

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      const root = rootRef.current
      if (!root) return

      if (leavingRef.current) {
        root.style.setProperty("--beat", "0")
        root.style.setProperty("--flash", "0")
        return
      }

      analyser.getByteFrequencyData(freqData)

      // Energia dos graves: bins 1–9 (~85–770 Hz com fftSize 256 @ 44.1kHz)
      let sum = 0
      for (let i = 1; i <= 9; i++) sum += freqData[i]
      const bass = sum / (9 * 255) // 0..1

      // Suavização para o pulso contínuo
      smoothBass = smoothBass * 0.82 + bass * 0.18

      // Detecção de batida: energia acima da média recente + cooldown
      history.push(bass)
      if (history.length > 43) history.shift() // ~0.7s de histórico
      const avg = history.reduce((a, b) => a + b, 0) / history.length
      const now = performance.now()

      // Batida = energia acima da média recente OU ataque súbito de grave
      const isOnset = bass > 0.2 && bass > avg * 1.05
      const isAttack = bass - prevBass > 0.045 && bass > 0.18
      prevBass = bass

      if ((isOnset || isAttack) && now - lastBeatAt > 240) {
        lastBeatAt = now
        flash = 1

        // Dispara um anel do pool reiniciando sua animação
        const ring = ringRefs.current[ringIndex]
        if (ring) {
          ring.style.animation = "none"
          // Força reflow para reiniciar a animação
          void ring.offsetWidth
          ring.style.animation = "beatRing 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        }
        ringIndex = (ringIndex + 1) % RING_POOL_SIZE
      }

      // Decaimento do flash da batida
      flash *= 0.9

      root.style.setProperty("--beat", smoothBass.toFixed(3))
      root.style.setProperty("--flash", (flash < 0.01 ? 0 : flash).toFixed(3))
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      gestures.forEach((ev) => window.removeEventListener(ev, tryResume))
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
          opacity: leaving ? 0 : 1,
          transition: "opacity 0.4s ease-out",
        } as React.CSSProperties
      }
    >
      {/* Moldura de luz nas bordas — respira com o grave */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 calc(40px + var(--beat) * 220px) rgba(56, 189, 248, calc(var(--beat) * 0.85)), inset 0 0 calc(14px + var(--beat) * 90px) rgba(168, 85, 247, calc(var(--beat) * 0.5))",
          willChange: "box-shadow",
        }}
      />

      {/* Brilho intenso nas bordas no impacto da batida */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 180px rgba(125, 211, 252, 0.85), inset 0 0 60px rgba(224, 242, 254, 0.55)",
          opacity: "var(--flash)",
          willChange: "opacity",
        }}
      />

      {/* Bloom radial central — pulsa atrás do logo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 42%, rgba(56, 189, 248, 0.4) 0%, rgba(168, 85, 247, 0.15) 45%, transparent 72%)",
          opacity: "calc(0.15 + var(--beat) * 0.85)",
          transform: "scale(calc(0.94 + var(--beat) * 0.14)) translateZ(0)",
          willChange: "opacity, transform",
        }}
      />

      {/* Glows nos cantos inferiores — batida "acende" o chão da cena */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 45% 30% at 0% 100%, rgba(34, 211, 238, 0.45) 0%, transparent 70%), radial-gradient(ellipse 45% 30% at 100% 100%, rgba(168, 85, 247, 0.45) 0%, transparent 70%)",
          opacity: "calc(var(--beat) * 0.9)",
          willChange: "opacity",
        }}
      />

      {/* Flash branco fugaz de tela cheia no impacto */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(224, 242, 254, 0.16) 0%, rgba(224, 242, 254, 0.05) 55%, transparent 80%)",
          opacity: "var(--flash)",
          willChange: "opacity",
        }}
      />

      {/* Anéis de choque — pool reciclado, disparados a cada batida */}
      <div className="absolute inset-0 flex items-center justify-center">
        {Array.from({ length: RING_POOL_SIZE }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              ringRefs.current[i] = el
            }}
            className="absolute rounded-full"
            style={{
              width: "120px",
              height: "120px",
              marginTop: "-10vh",
              border: "2px solid rgba(186, 230, 253, 0.9)",
              boxShadow:
                "0 0 40px rgba(56, 189, 248, 0.8), 0 0 80px rgba(56, 189, 248, 0.4), inset 0 0 30px rgba(56, 189, 248, 0.4)",
              opacity: 0,
              willChange: "transform, opacity",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes beatRing {
          0% {
            transform: scale(0.3) translateZ(0);
            opacity: 0.9;
            border-width: 3px;
          }
          100% {
            transform: scale(14) translateZ(0);
            opacity: 0;
            border-width: 0.5px;
          }
        }
      `}</style>
    </div>
  )
}
