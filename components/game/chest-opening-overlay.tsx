"use client"

/**
 * CHEST OPENING OVERLAY — animação cinematográfica de abertura de Baú.
 *
 * Fluxo: baú flutuando com brilho ambiente → toque → tremor crescente com luz
 * vazando das frestas e faíscas → flash + shockwave + god rays + explosão de
 * partículas na cor do elemento → revelação do fragmento com raios girando,
 * contador animado e brilho orbitante. As recompensas já foram creditadas
 * pelo GameContext (openChest) antes desta tela aparecer; aqui só exibimos.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { CHESTS, type ChestId, type ChestOpenResult } from "@/lib/chests"
import { FRAGMENTS } from "@/lib/fragments"

interface ChestOpeningOverlayProps {
  chestId: ChestId
  result: ChestOpenResult
  onClose: () => void
}

type Phase = "idle" | "charging" | "burst" | "revealed"

// ─── Contador animado ────────────────────────────────────────────────────────

function CountUp({ value, delay = 0, duration = 800 }: { value: number; delay?: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf = 0
    let start = 0
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts
        const t = Math.min((ts - start) / duration, 1)
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
        setDisplay(Math.round(eased * value))
        if (t < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [value, delay, duration])
  return <>{display}</>
}

// ─── Componente principal ────────────────────────────────────────────────────

export function ChestOpeningOverlay({ chestId, result, onClose }: ChestOpeningOverlayProps) {
  const def = CHESTS[chestId]
  const frag = FRAGMENTS[result.fragmentId]
  const [phase, setPhase] = useState<Phase>("idle")
  const phaseRef = useRef<Phase>("idle")
  phaseRef.current = phase
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleTap = useCallback(() => {
    if (phase !== "idle") return
    setPhase("charging")
  }, [phase])

  useEffect(() => {
    if (phase === "charging") {
      const t = setTimeout(() => setPhase("burst"), 1050)
      return () => clearTimeout(t)
    }
    if (phase === "burst") {
      const t = setTimeout(() => setPhase("revealed"), 620)
      return () => clearTimeout(t)
    }
  }, [phase])

  // ── Motor de partículas único (roda em todas as fases) ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0, H = 0
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    const COL = def.color
    const COLS = [COL, "#ffffff", COL, COL]

    // Mote ambiente que sobe lentamente
    type Mote = { x: number; y: number; vy: number; size: number; alpha: number; sway: number; swayV: number }
    // Faísca com física
    type Spark = {
      x: number; y: number; vx: number; vy: number; size: number
      alpha: number; decay: number; color: string; gravity: number; drag: number; twinkle: number
    }
    // Risco de luz (streak) da explosão
    type Streak = { x: number; y: number; vx: number; vy: number; len: number; alpha: number; decay: number; w: number }

    const motes: Mote[] = []
    const sparks: Spark[] = []
    const streaks: Streak[] = []

    let exploded = false

    function explode(cx: number, cy: number) {
      // faíscas em anel
      for (let i = 0; i < 110; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 2 + Math.random() * 11
        sparks.push({
          x: cx, y: cy,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
          size: 1.5 + Math.random() * 4,
          alpha: 1, decay: 0.007 + Math.random() * 0.012,
          color: COLS[Math.floor(Math.random() * COLS.length)],
          gravity: 0.12, drag: 0.978,
          twinkle: Math.random() * Math.PI * 2,
        })
      }
      // riscos de luz radiais
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 9 + Math.random() * 16
        streaks.push({
          x: cx, y: cy,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          len: 30 + Math.random() * 70,
          alpha: 1, decay: 0.03 + Math.random() * 0.03,
          w: 1 + Math.random() * 2.2,
        })
      }
    }

    let frame = 0
    let raf = 0
    function tick() {
      raf = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, W, H)
      frame++
      const ph = phaseRef.current
      const cx = W / 2, cy = H / 2

      // ── Motes ambientes (idle/charging/revealed) ──
      if (ph !== "burst" && frame % 8 === 0) {
        motes.push({
          x: cx + (Math.random() - 0.5) * Math.min(W, 560),
          y: H * 0.78 + Math.random() * H * 0.2,
          vy: -(0.3 + Math.random() * 0.7),
          size: 1 + Math.random() * 2.4,
          alpha: 0.15 + Math.random() * 0.4,
          sway: Math.random() * Math.PI * 2, swayV: 0.015 + Math.random() * 0.02,
        })
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i]
        m.sway += m.swayV
        m.x += Math.sin(m.sway) * 0.4
        m.y += m.vy
        m.alpha -= 0.0012
        if (m.alpha <= 0 || m.y < -10) { motes.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = m.alpha
        ctx.fillStyle = COL
        ctx.shadowColor = COL
        ctx.shadowBlur = 6
        ctx.beginPath(); ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }

      // ── Faíscas escapando durante o carregamento ──
      if (ph === "charging" && frame % 3 === 0) {
        const a = Math.random() * Math.PI * 2
        sparks.push({
          x: cx + Math.cos(a) * (40 + Math.random() * 60),
          y: cy + Math.sin(a) * (40 + Math.random() * 50),
          vx: Math.cos(a) * (1 + Math.random() * 2.5),
          vy: Math.sin(a) * (1 + Math.random() * 2.5) - 1,
          size: 1 + Math.random() * 2.4,
          alpha: 1, decay: 0.02 + Math.random() * 0.02,
          color: COLS[Math.floor(Math.random() * COLS.length)],
          gravity: 0.03, drag: 0.99,
          twinkle: Math.random() * Math.PI * 2,
        })
      }

      // ── Explosão (uma vez) ──
      if (ph === "burst" && !exploded) {
        exploded = true
        explode(cx, cy)
        setTimeout(() => explode(cx, cy), 140)
      }

      // ── Brilho suave orbitando o fragmento revelado ──
      if (ph === "revealed" && frame % 10 === 0) {
        const a = Math.random() * Math.PI * 2
        const r = 70 + Math.random() * 60
        sparks.push({
          x: cx + Math.cos(a) * r, y: cy - 40 + Math.sin(a) * r * 0.7,
          vx: (Math.random() - 0.5) * 0.5, vy: -(0.3 + Math.random() * 0.8),
          size: 1 + Math.random() * 2,
          alpha: 0.9, decay: 0.008 + Math.random() * 0.008,
          color: Math.random() < 0.5 ? frag.color : "#ffffff",
          gravity: -0.004, drag: 0.995,
          twinkle: Math.random() * Math.PI * 2,
        })
      }

      // ── Física das faíscas ──
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        p.x += p.vx; p.y += p.vy
        p.vy += p.gravity
        p.vx *= p.drag; p.vy *= p.drag
        p.alpha -= p.decay
        p.twinkle += 0.25
        if (p.alpha <= 0 || p.y > H + 30) { sparks.splice(i, 1); continue }
        const tw = 0.65 + 0.35 * Math.sin(p.twinkle)
        ctx.save()
        ctx.globalAlpha = Math.max(p.alpha * tw, 0)
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 10
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }

      // ── Riscos de luz ──
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i]
        s.x += s.vx; s.y += s.vy
        s.vx *= 0.94; s.vy *= 0.94
        s.alpha -= s.decay
        if (s.alpha <= 0) { streaks.splice(i, 1); continue }
        const mag = Math.hypot(s.vx, s.vy) || 1
        const tx = s.x - (s.vx / mag) * s.len
        const ty = s.y - (s.vy / mag) * s.len
        const grad = ctx.createLinearGradient(s.x, s.y, tx, ty)
        grad.addColorStop(0, `rgba(255,255,255,${s.alpha})`)
        grad.addColorStop(0.4, `${COL}${Math.round(s.alpha * 160).toString(16).padStart(2, "0")}`)
        grad.addColorStop(1, "rgba(0,0,0,0)")
        ctx.save()
        ctx.strokeStyle = grad
        ctx.lineWidth = s.w
        ctx.lineCap = "round"
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke()
        ctx.restore()
      }
    }
    tick()

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [def.color, frag.color])

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        background: "radial-gradient(ellipse at 50% 42%, rgba(10,5,26,0.96) 0%, rgba(2,0,10,0.98) 70%)",
        backdropFilter: "blur(8px)",
        animation: "chx-fade 350ms ease-out both",
      }}
    >
      <style>{`
        @keyframes chx-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes chx-float {
          0%,100% { transform: translateY(0) rotate(-1deg) }
          50% { transform: translateY(-14px) rotate(1deg) }
        }
        @keyframes chx-shadow {
          0%,100% { transform: scaleX(1); opacity: .45 }
          50% { transform: scaleX(.8); opacity: .3 }
        }
        @keyframes chx-charge {
          0%,100% { transform: translate(0,0) rotate(0deg) scale(1) }
          15% { transform: translate(-3px,2px) rotate(-2deg) scale(1.01) }
          30% { transform: translate(4px,-2px) rotate(2deg) scale(1.02) }
          45% { transform: translate(-5px,2px) rotate(-3deg) scale(1.03) }
          60% { transform: translate(6px,-3px) rotate(3deg) scale(1.05) }
          75% { transform: translate(-7px,3px) rotate(-4deg) scale(1.07) }
          90% { transform: translate(8px,-3px) rotate(4deg) scale(1.09) }
        }
        @keyframes chx-pop-out {
          0% { transform: scale(1.1); opacity: 1 }
          40% { transform: scale(1.35); opacity: 1 }
          100% { transform: scale(.001); opacity: 0 }
        }
        @keyframes chx-flash { 0% { opacity: 0 } 15% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes chx-ring {
          0% { transform: translate(-50%,-50%) scale(.05); opacity: .95 }
          100% { transform: translate(-50%,-50%) scale(5.5); opacity: 0 }
        }
        @keyframes chx-rays { from { transform: translate(-50%,-50%) rotate(0deg) } to { transform: translate(-50%,-50%) rotate(360deg) } }
        @keyframes chx-up { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes chx-pop-in {
          0% { transform: scale(.2) rotate(-6deg); opacity: 0; filter: blur(10px) }
          62% { transform: scale(1.09) rotate(2deg); opacity: 1; filter: blur(0) }
          82% { transform: scale(.97) rotate(-1deg) }
          100% { transform: scale(1) rotate(0); opacity: 1 }
        }
        @keyframes chx-pulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
        @keyframes chx-hint { 0%,100% { opacity: .4; transform: translateY(0) } 50% { opacity: .9; transform: translateY(-3px) } }
        @keyframes chx-shine { 0% { left: -90% } 100% { left: 190% } }
        @keyframes chx-frag-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }
        @keyframes chx-glow-build {
          from { opacity: .25; transform: translate(-50%,-50%) scale(.7) }
          to { opacity: 1; transform: translate(-50%,-50%) scale(1.35) }
        }
        @keyframes chx-shake-screen {
          0%,100% { transform: translate(0,0) }
          25% { transform: translate(-6px,4px) }
          50% { transform: translate(5px,-4px) }
          75% { transform: translate(-4px,-3px) }
        }
      `}</style>

      {/* Glow ambiente pulsante */}
      <div style={{
        position: "absolute", left: "50%", top: "50%", width: 680, height: 680, borderRadius: "50%",
        transform: "translate(-50%,-50%)",
        background: `radial-gradient(circle, ${def.color}30 0%, ${def.color}10 40%, transparent 70%)`,
        animation: "chx-pulse 2.6s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Luz crescendo por trás do baú durante o carregamento */}
      {phase === "charging" && (
        <div style={{
          position: "absolute", left: "50%", top: "50%", width: 420, height: 420, borderRadius: "50%",
          background: `radial-gradient(circle, #ffffff55 0%, ${def.color}66 30%, transparent 68%)`,
          animation: "chx-glow-build 1050ms ease-in both",
          pointerEvents: "none", zIndex: 1,
        }} />
      )}

      {/* God rays girando (explosão e revelação) */}
      {(phase === "burst" || phase === "revealed") && (
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          width: "150vmax", height: "150vmax",
          background: `repeating-conic-gradient(from 0deg, ${def.color}14 0deg 6deg, transparent 6deg 22deg)`,
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 58%)",
          maskImage: "radial-gradient(circle, black 0%, transparent 58%)",
          animation: "chx-rays 40s linear infinite, chx-fade 800ms ease-out both",
          pointerEvents: "none", zIndex: 1,
        }} />
      )}

      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />

      {/* Flash + shockwaves na explosão */}
      {phase === "burst" && (
        <>
          <div style={{
            position: "absolute", inset: 0, background: "#fff",
            animation: "chx-flash 620ms ease-out forwards", pointerEvents: "none", zIndex: 4,
          }} />
          {[0, 130, 280].map((delay, i) => (
            <div key={i} style={{
              position: "absolute", left: "50%", top: "50%", borderRadius: "50%",
              width: 180 + i * 50, height: 180 + i * 50,
              border: `${2.5 - i * 0.6}px solid ${def.color}`,
              boxShadow: `0 0 ${34 - i * 8}px ${def.color}88, inset 0 0 ${30 - i * 8}px ${def.color}44`,
              animation: `chx-ring 900ms cubic-bezier(.16,.84,.44,1) ${delay}ms both`,
              pointerEvents: "none", zIndex: 3,
            }} />
          ))}
        </>
      )}

      {/* ── Fase do baú ── */}
      {(phase === "idle" || phase === "charging" || phase === "burst") && (
        <div style={{
          position: "relative", zIndex: 5,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 26,
          animation: phase === "burst" ? "chx-shake-screen 300ms ease-out" : undefined,
        }}>
          <p style={{
            color: def.color, fontWeight: 900, fontSize: 14, letterSpacing: "4px", margin: 0,
            textTransform: "uppercase", animation: "chx-up 500ms ease-out both",
            textShadow: `0 0 14px ${def.color}aa`,
          }}>
            {def.name}
          </p>

          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <button
              onClick={handleTap}
              aria-label={`Abrir ${def.name}`}
              disabled={phase !== "idle"}
              style={{
                background: "none", border: "none", padding: 0,
                cursor: phase === "idle" ? "pointer" : "default",
                width: 230, height: 230, position: "relative", zIndex: 2,
                animation: phase === "idle" ? "chx-float 2.6s ease-in-out infinite"
                  : phase === "charging" ? "chx-charge 1050ms cubic-bezier(.36,.07,.19,.97) both"
                  : "chx-pop-out 480ms cubic-bezier(.36,0,.66,-0.4) forwards",
                filter: phase === "charging"
                  ? `drop-shadow(0 0 46px ${def.color}) drop-shadow(0 0 90px ${def.color}88) brightness(1.25)`
                  : `drop-shadow(0 0 32px ${def.color}88)`,
                transition: "filter 500ms ease",
              }}
            >
              <Image src={def.image || "/placeholder.svg"} alt={def.name} fill sizes="230px" className="object-contain" priority />
            </button>

            {/* Sombra no chão */}
            <div style={{
              width: 150, height: 22, borderRadius: "50%", marginTop: -6,
              background: `radial-gradient(ellipse, ${def.color}44 0%, transparent 70%)`,
              filter: "blur(4px)",
              animation: phase === "idle" ? "chx-shadow 2.6s ease-in-out infinite" : undefined,
              opacity: phase === "burst" ? 0 : undefined,
              transition: "opacity 300ms",
            }} />
          </div>

          {phase === "idle" && (
            <p style={{
              color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 700, margin: 0,
              letterSpacing: "2px", textTransform: "uppercase",
              animation: "chx-hint 1.8s ease-in-out 400ms infinite",
            }}>
              Toque para abrir
            </p>
          )}
        </div>
      )}

      {/* ── Revelação ── */}
      {phase === "revealed" && (
        <div style={{
          position: "relative", zIndex: 5, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 24, padding: "0 24px", textAlign: "center",
        }}>
          <p style={{
            color: def.color, fontWeight: 900, fontSize: 13, letterSpacing: "4px", margin: 0,
            textTransform: "uppercase", textShadow: `0 0 14px ${def.color}aa`,
            animation: "chx-up 450ms ease-out both",
          }}>
            {def.name} aberto!
          </p>

          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            background: `linear-gradient(165deg, ${frag.color}26 0%, rgba(6,2,18,0.85) 55%, ${frag.color}10 100%)`,
            border: `1px solid ${frag.color}66`,
            borderRadius: 22, padding: "28px 44px",
            position: "relative", overflow: "hidden",
            animation: "chx-pop-in 640ms cubic-bezier(.22,1.3,.36,1) 60ms both",
            boxShadow: `0 0 44px ${frag.color}40, 0 18px 50px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.12)`,
          }}>
            {/* Varredura de brilho no cartão */}
            <span style={{
              position: "absolute", top: 0, left: "-90%", width: "50%", height: "100%",
              background: "linear-gradient(105deg, transparent, rgba(255,255,255,.22), transparent)",
              animation: "chx-shine 1.3s ease-in-out 700ms both",
              pointerEvents: "none",
            }} />

            {/* Halo atrás do fragmento */}
            <div style={{ position: "relative", width: 120, height: 120 }}>
              <div style={{
                position: "absolute", left: "50%", top: "50%", width: 170, height: 170,
                transform: "translate(-50%,-50%)", borderRadius: "50%",
                background: `radial-gradient(circle, ${frag.color}4d 0%, transparent 65%)`,
                animation: "chx-pulse 2.2s ease-in-out infinite",
              }} />
              <div style={{
                position: "relative", width: 120, height: 120,
                filter: `drop-shadow(0 0 22px ${frag.color}cc)`,
                animation: "chx-frag-float 2.8s ease-in-out infinite",
              }}>
                <Image src={frag.image || "/placeholder.svg"} alt={frag.name} fill sizes="120px" className="object-contain" />
              </div>
            </div>

            <span style={{
              fontWeight: 900, fontSize: 34, color: frag.color, lineHeight: 1,
              textShadow: `0 0 18px ${frag.color}99`, fontVariantNumeric: "tabular-nums",
            }}>
              +<CountUp value={result.amount} delay={450} />
            </span>

            <span style={{
              color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "1px",
              textTransform: "uppercase",
            }}>
              {frag.name}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              marginTop: 4, padding: "14px 50px", borderRadius: 12, fontWeight: 800,
              fontSize: 14, letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer",
              border: `2px solid ${def.color}99`,
              background: `linear-gradient(135deg, ${def.color}26, ${def.color}0d)`,
              color: def.color, backdropFilter: "blur(10px)",
              animation: "chx-up 500ms cubic-bezier(.22,1.2,.36,1) 550ms both",
              transition: "transform 140ms, box-shadow 200ms, background 180ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)"
              e.currentTarget.style.boxShadow = `0 0 26px ${def.color}55`
              e.currentTarget.style.background = `linear-gradient(135deg, ${def.color}3a, ${def.color}18)`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)"
              e.currentTarget.style.boxShadow = "none"
              e.currentTarget.style.background = `linear-gradient(135deg, ${def.color}26, ${def.color}0d)`
            }}
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  )
}
