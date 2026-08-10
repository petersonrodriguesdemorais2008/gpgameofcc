"use client"

/**
 * CHEST OPENING OVERLAY — animação cinematográfica de abertura de Baú.
 *
 * Fluxo: baú flutuando com brilho ambiente e sparkles orbitando → toque para
 * abrir → tremor com intensidade crescente + luz vazando → explosão (flash,
 * ondas de choque, pilar de luz, chuva de partículas, screen shake) → revela
 * os FRAGMENTOS com god rays girando, pop com bounce e contador animado.
 * As recompensas já foram creditadas pelo GameContext (openChest) antes desta
 * tela aparecer; aqui só exibimos.
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

type Phase = "idle" | "shaking" | "burst" | "revealed"

/** Contador animado com easing (ease-out cúbico). */
function CountUpNumber({ value, duration = 850, delay = 0 }: { value: number; duration?: number; delay?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, delay])
  return <>{display}</>
}

export function ChestOpeningOverlay({ chestId, result, onClose }: ChestOpeningOverlayProps) {
  const def = CHESTS[chestId]
  const frag = FRAGMENTS[result.fragmentId]
  const [phase, setPhase] = useState<Phase>("idle")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const phaseRef = useRef<Phase>("idle")
  phaseRef.current = phase

  const handleTap = useCallback(() => {
    if (phase !== "idle") return
    setPhase("shaking")
  }, [phase])

  useEffect(() => {
    if (phase === "shaking") {
      const t = setTimeout(() => setPhase("burst"), 1100)
      return () => clearTimeout(t)
    }
    if (phase === "burst") {
      const t = setTimeout(() => setPhase("revealed"), 620)
      return () => clearTimeout(t)
    }
  }, [phase])

  // ── Sistema de partículas ────────────────────────────────────────────────
  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const canvas: HTMLCanvasElement = canvasEl
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener("resize", resize)
    const ctx = canvas.getContext("2d")!

    type P = {
      x:number; y:number; vx:number; vy:number; size:number; alpha:number
      decay:number; color:string; gravity:number; spin:number; spinV:number
      shape:"circle"|"star"|"spark"
    }
    const particles: P[] = []
    const cols = [def.color, "#ffffff", frag?.color ?? def.color, "#ffe9a8"]

    function drawStar(cx:number, cy:number, r:number, spin:number) {
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = spin + (i/8)*Math.PI*2
        const rad = i%2===0 ? r : r*0.4
        i===0 ? ctx.moveTo(cx+Math.cos(a)*rad, cy+Math.sin(a)*rad)
              : ctx.lineTo(cx+Math.cos(a)*rad, cy+Math.sin(a)*rad)
      }
      ctx.closePath()
    }

    function spawn(cx:number, cy:number, count:number, opts?: Partial<P> & { minSpeed?:number; maxSpeed?:number; up?:number }) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = (opts?.minSpeed ?? 2) + Math.random() * ((opts?.maxSpeed ?? 11) - (opts?.minSpeed ?? 2))
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (opts?.up ?? 3.5),
          size: 3 + Math.random() * 9,
          alpha: 1,
          decay: 0.007 + Math.random() * 0.011,
          color: cols[Math.floor(Math.random() * cols.length)],
          gravity: 0.16,
          spin: Math.random() * Math.PI * 2,
          spinV: (Math.random() - 0.5) * 0.25,
          shape: (["circle","star","spark"] as const)[Math.floor(Math.random()*3)],
          ...opts,
        })
      }
    }

    // Explosão principal em 3 ondas
    if (phase === "burst") {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2
      spawn(cx, cy, 110, { minSpeed: 3, maxSpeed: 14 })
      setTimeout(() => spawn(cx, cy, 60, { minSpeed: 2, maxSpeed: 9 }), 130)
      setTimeout(() => spawn(cx, cy, 40, { minSpeed: 1, maxSpeed: 6 }), 280)
    }

    let frame = 0
    function tick() {
      rafRef.current = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++

      // Vazamento de luz durante o tremor (fagulhas escapando do baú)
      if (phaseRef.current === "shaking" && frame % 5 === 0) {
        spawn(canvas.width/2 + (Math.random()-0.5)*130, canvas.height/2 + (Math.random()-0.5)*90, 2,
          { minSpeed: 0.5, maxSpeed: 2.5, up: 2, gravity: -0.02 })
      }
      // Chuva suave de sparkles na revelação
      if (phaseRef.current === "revealed" && frame % 6 === 0) {
        spawn(Math.random() * canvas.width, -12, 1, { minSpeed: 0, maxSpeed: 0.6, up: -1.2, gravity: 0.015 })
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx; p.y += p.vy
        p.vy += p.gravity; p.vx *= 0.98
        p.spin += p.spinV
        p.alpha -= p.decay
        if (p.alpha <= 0 || p.y > canvas.height + 40) { particles.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 14
        if (p.shape === "star") {
          drawStar(p.x, p.y, p.size/2, p.spin)
          ctx.fill()
        } else if (p.shape === "spark") {
          ctx.translate(p.x, p.y); ctx.rotate(p.spin)
          ctx.fillRect(-p.size/2, -p.size/8, p.size, p.size/4)
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size/2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    }
    tick()

    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize) }
  }, [phase, def.color, frag])

  const rayColor = phase === "revealed" ? (frag?.color ?? def.color) : def.color

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        overflow: "hidden", background: "rgba(2,0,10,0.95)", backdropFilter: "blur(6px)",
        animation: "chest-fade 320ms ease-out both",
      }}
    >
      <style>{`
        @keyframes chest-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes chest-float { 0%,100% { transform: translateY(0) rotate(-1.2deg) } 50% { transform: translateY(-12px) rotate(1.2deg) } }
        @keyframes chest-shake-1 {
          0%,100% { transform: translate(0,0) rotate(0deg) }
          25% { transform: translate(-3px,1px) rotate(-1.5deg) }
          50% { transform: translate(3px,-1px) rotate(1.5deg) }
          75% { transform: translate(-3px,0) rotate(-1.5deg) }
        }
        @keyframes chest-shake-2 {
          0%,100% { transform: translate(0,0) rotate(0deg) scale(1.04) }
          20% { transform: translate(-8px,3px) rotate(-4deg) scale(1.04) }
          40% { transform: translate(8px,-3px) rotate(4deg) scale(1.05) }
          60% { transform: translate(-10px,2px) rotate(-5deg) scale(1.05) }
          80% { transform: translate(10px,-2px) rotate(5deg) scale(1.06) }
        }
        @keyframes chest-pop-out { 0% { transform: scale(1.06) } 45% { transform: scale(1.3) } 100% { transform: scale(0.001) } }
        @keyframes chest-flash { 0% { opacity: 0 } 25% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes chest-shockwave { 0% { transform: translate(-50%,-50%) scale(.1); opacity: .9 } 100% { transform: translate(-50%,-50%) scale(5); opacity: 0 } }
        @keyframes chest-pillar { 0% { opacity: 0; transform: translateX(-50%) scaleY(0) } 35% { opacity: 1; transform: translateX(-50%) scaleY(1) } 100% { opacity: 0; transform: translateX(-50%) scaleY(1.05) } }
        @keyframes chest-screen-shake {
          0%,100% { transform: translate(0,0) }
          15% { transform: translate(-7px,5px) } 30% { transform: translate(6px,-6px) }
          45% { transform: translate(-5px,-4px) } 60% { transform: translate(5px,4px) }
          75% { transform: translate(-3px,2px) } 90% { transform: translate(2px,-2px) }
        }
        @keyframes chest-up { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes chest-pop-in { 0% { transform: scale(.25) rotate(-6deg); opacity: 0 } 55% { transform: scale(1.12) rotate(2deg); opacity: 1 } 78% { transform: scale(.96) rotate(-1deg) } 100% { transform: scale(1) rotate(0deg); opacity: 1 } }
        @keyframes chest-pulse { 0%,100% { opacity: .5; transform: scale(1) } 50% { opacity: 1; transform: scale(1.06) } }
        @keyframes chest-rays { from { transform: translate(-50%,-50%) rotate(0deg) } to { transform: translate(-50%,-50%) rotate(360deg) } }
        @keyframes chest-orbit { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes chest-twinkle { 0%,100% { opacity: .2; transform: scale(.7) } 50% { opacity: 1; transform: scale(1.15) } }
        @keyframes chest-shadow { 0%,100% { transform: translateX(-50%) scaleX(1); opacity: .5 } 50% { transform: translateX(-50%) scaleX(.82); opacity: .32 } }
        @keyframes chest-glow-build { from { filter: drop-shadow(0 0 26px ${def.color}77) } to { filter: drop-shadow(0 0 64px ${def.color}) drop-shadow(0 0 110px ${def.color}aa) } }
        @keyframes chest-shine-loop { 0% { left: -120% } 55% { left: 220% } 100% { left: 220% } }
        @keyframes chest-frag-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
      `}</style>

      {/* Wrapper com screen shake durante a explosão */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        animation: phase === "burst" ? "chest-screen-shake 550ms ease-out both" : undefined,
      }}>

        {/* God rays girando (cor do baú → cor do fragmento na revelação) */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 1000, height: 1000, pointerEvents: "none",
          background: `repeating-conic-gradient(from 0deg, ${rayColor}1c 0deg 6deg, transparent 6deg 24deg)`,
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 60%)",
          maskImage: "radial-gradient(circle, black 0%, transparent 60%)",
          animation: "chest-rays 30s linear infinite",
          opacity: phase === "revealed" ? 1 : 0.65,
          transition: "opacity 600ms ease",
        }} />

        {/* Ambient glow */}
        <div style={{
          position: "absolute", width: 640, height: 640, borderRadius: "50%",
          background: `radial-gradient(circle, ${rayColor}36 0%, transparent 70%)`,
          animation: "chest-pulse 2.4s ease-in-out infinite",
          pointerEvents: "none",
          transition: "background 600ms ease",
        }} />

        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }} />

        {/* Flash + ondas de choque + pilar de luz na explosão */}
        {phase === "burst" && (
          <>
            <div style={{
              position: "absolute", inset: 0, background: "#fff",
              animation: "chest-flash 600ms ease-out forwards", pointerEvents: "none", zIndex: 3,
            }} />
            {[0, 140].map((delay, i) => (
              <div key={i} style={{
                position: "absolute", top: "50%", left: "50%",
                width: 260, height: 260, borderRadius: "50%",
                border: `${3 - i}px solid ${def.color}`,
                boxShadow: `0 0 30px ${def.color}aa, inset 0 0 30px ${def.color}55`,
                animation: `chest-shockwave 850ms cubic-bezier(.16,.84,.44,1) ${delay}ms both`,
                pointerEvents: "none", zIndex: 2,
              }} />
            ))}
            <div style={{
              position: "absolute", top: 0, bottom: "50%", left: "50%", width: 130,
              background: `linear-gradient(to top, ${def.color}cc, ${def.color}22 60%, transparent)`,
              transformOrigin: "bottom center",
              animation: "chest-pillar 620ms ease-out both",
              filter: "blur(10px)", pointerEvents: "none", zIndex: 2,
            }} />
          </>
        )}

        {(phase === "idle" || phase === "shaking" || phase === "burst") && (
          <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
            <p style={{
              color: def.color, fontWeight: 900, fontSize: 14, letterSpacing: "4px",
              textTransform: "uppercase", animation: "chest-up 500ms ease-out both",
              textShadow: `0 0 14px ${def.color}99`,
            }}>
              {def.name}
            </p>

            <div style={{ position: "relative", width: 240, height: 240 }}>
              {/* Sparkles orbitando o baú enquanto aguarda */}
              {phase === "idle" && (
                <div style={{
                  position: "absolute", inset: -34,
                  animation: "chest-orbit 9s linear infinite", pointerEvents: "none",
                }}>
                  {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                    <div key={deg} style={{
                      position: "absolute", top: "50%", left: "50%",
                      transform: `rotate(${deg}deg) translateX(150px)`,
                    }}>
                      <div style={{
                        width: 6 + (i % 3) * 3, height: 6 + (i % 3) * 3, borderRadius: "50%",
                        background: i % 2 === 0 ? "#fff" : def.color,
                        boxShadow: `0 0 10px ${i % 2 === 0 ? "#fff" : def.color}`,
                        animation: `chest-twinkle ${1.6 + i * 0.35}s ease-in-out ${i * 0.28}s infinite`,
                      }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Sombra no chão */}
              <div style={{
                position: "absolute", bottom: -18, left: "50%",
                width: 150, height: 26, borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(0,0,0,.65) 0%, transparent 70%)",
                animation: "chest-shadow 2.2s ease-in-out infinite", pointerEvents: "none",
              }} />

              <button
                onClick={handleTap}
                aria-label={`Abrir ${def.name}`}
                disabled={phase !== "idle"}
                style={{
                  background: "none", border: "none", padding: 0,
                  cursor: phase === "idle" ? "pointer" : "default",
                  width: "100%", height: "100%", position: "relative", display: "block",
                  animation: phase === "idle"
                    ? "chest-float 2.4s ease-in-out infinite"
                    : phase === "shaking"
                      ? "chest-shake-1 .14s ease-in-out 2, chest-shake-2 .09s ease-in-out .28s 10, chest-glow-build 1.1s ease-in forwards"
                      : "chest-pop-out 600ms cubic-bezier(.36,0,.66,-0.56) forwards",
                  filter: `drop-shadow(0 0 26px ${def.color}77)`,
                }}
              >
                <Image src={def.image || "/placeholder.svg"} alt={def.name} fill sizes="240px" className="object-contain" />
              </button>
            </div>

            {phase === "idle" && (
              <p style={{
                color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 700,
                letterSpacing: "2px", textTransform: "uppercase",
                animation: "chest-up 500ms ease-out 250ms both, chest-pulse 1.8s ease-in-out 1s infinite",
              }}>
                Toque para abrir
              </p>
            )}
          </div>
        )}

        {phase === "revealed" && (
          <div style={{
            position: "relative", zIndex: 2, display: "flex", flexDirection: "column",
            alignItems: "center", gap: 24, padding: "0 24px", textAlign: "center",
            animation: "chest-up 450ms ease-out both",
          }}>
            <p style={{
              color: def.color, fontWeight: 900, fontSize: 15, letterSpacing: "4px",
              textTransform: "uppercase", textShadow: `0 0 16px ${def.color}aa`,
              animation: "chest-up 450ms ease-out 80ms both",
            }}>
              {def.name} aberto!
            </p>

            <div style={{
              position: "relative", overflow: "hidden",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
              background: `linear-gradient(160deg, ${frag.color}24, rgba(0,0,0,0.66))`,
              border: `1px solid ${frag.color}66`,
              borderRadius: 22, padding: "26px 40px",
              animation: "chest-pop-in 650ms cubic-bezier(.34,1.56,.64,1) 120ms both",
              boxShadow: `0 0 48px ${frag.color}40, inset 0 1px 0 ${frag.color}33`,
            }}>
              {/* Shine sweep periódico no card */}
              <div style={{
                position: "absolute", top: 0, left: "-120%", width: "45%", height: "100%",
                background: "linear-gradient(105deg, transparent, rgba(255,255,255,.16), transparent)",
                animation: "chest-shine-loop 3.2s ease-in-out 900ms infinite",
                pointerEvents: "none",
              }} />

              <div style={{
                position: "relative", width: 104, height: 104,
                filter: `drop-shadow(0 0 20px ${frag.color}bb)`,
                animation: "chest-frag-float 2.6s ease-in-out infinite",
              }}>
                <Image src={frag.image || "/placeholder.svg"} alt={frag.name} fill sizes="104px" className="object-contain" />
              </div>

              <span style={{
                fontWeight: 900, fontSize: 30, color: frag.color,
                textShadow: `0 0 16px ${frag.color}99`, lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}>
                +<CountUpNumber value={result.amount} delay={450} />
              </span>

              <span style={{
                color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: "1px",
                textTransform: "uppercase",
              }}>
                {frag.name}
              </span>
            </div>

            <button
              onClick={onClose}
              style={{
                marginTop: 6, padding: "13px 46px", borderRadius: 12, fontWeight: 800,
                fontSize: 14, letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer",
                border: `2px solid ${def.color}99`, background: `linear-gradient(135deg, ${def.color}26, ${def.color}0d)`,
                color: def.color, animation: "chest-up 450ms ease-out 500ms both",
                transition: "transform 120ms, box-shadow 180ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = `0 0 24px ${def.color}55` }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none" }}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
