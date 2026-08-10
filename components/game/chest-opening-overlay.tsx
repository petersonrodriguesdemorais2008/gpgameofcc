"use client"

/**
 * CHEST OPENING OVERLAY — animação de abertura de Baú.
 *
 * Fluxo: baú flutuando → toque para abrir → explosão de partículas na cor
 * do elemento → revela Gear Coins + Gacha Coins e, com chance, 1 carta nova.
 * As recompensas já foram creditadas pelo GameContext (openChest) antes desta
 * tela aparecer; aqui só exibimos o resultado.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { CHESTS, type ChestId, type ChestOpenResult } from "@/lib/chests"

interface ChestOpeningOverlayProps {
  chestId: ChestId
  result: ChestOpenResult & { cardName?: string }
  onClose: () => void
}

type Phase = "idle" | "shaking" | "burst" | "revealed"

export function ChestOpeningOverlay({ chestId, result, onClose }: ChestOpeningOverlayProps) {
  const def = CHESTS[chestId]
  const [phase, setPhase] = useState<Phase>("idle")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const handleTap = useCallback(() => {
    if (phase !== "idle") return
    setPhase("shaking")
  }, [phase])

  useEffect(() => {
    if (phase === "shaking") {
      const t = setTimeout(() => setPhase("burst"), 650)
      return () => clearTimeout(t)
    }
    if (phase === "burst") {
      const t = setTimeout(() => setPhase("revealed"), 550)
      return () => clearTimeout(t)
    }
  }, [phase])

  // Particle burst on the "burst" phase
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener("resize", resize)
    const ctx = canvas.getContext("2d")!

    type P = { x:number; y:number; vx:number; vy:number; size:number; alpha:number; decay:number; color:string; gravity:number }
    const particles: P[] = []
    const cols = [def.color, "#ffffff", `${def.color}`]

    function burst(cx: number, cy: number, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 10
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          size: 4 + Math.random() * 8,
          alpha: 1,
          decay: 0.008 + Math.random() * 0.01,
          color: cols[Math.floor(Math.random() * cols.length)],
          gravity: 0.18,
        })
      }
    }

    if (phase === "burst") {
      burst(window.innerWidth / 2, window.innerHeight / 2, 90)
      setTimeout(() => burst(window.innerWidth / 2, window.innerHeight / 2, 40), 120)
    }

    function tick() {
      rafRef.current = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx; p.y += p.vy
        p.vy += p.gravity; p.vx *= 0.98
        p.alpha -= p.decay
        if (p.alpha <= 0) { particles.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
    tick()

    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize) }
  }, [phase, def.color])

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        overflow: "hidden", background: "rgba(2,0,10,0.94)", backdropFilter: "blur(6px)",
      }}
    >
      <style>{`
        @keyframes chest-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes chest-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes chest-shake {
          0%,100% { transform: translate(0,0) rotate(0deg) }
          20% { transform: translate(-6px,2px) rotate(-3deg) }
          40% { transform: translate(6px,-2px) rotate(3deg) }
          60% { transform: translate(-8px,1px) rotate(-4deg) }
          80% { transform: translate(8px,-1px) rotate(4deg) }
        }
        @keyframes chest-pop-out { 0% { transform: scale(1) } 50% { transform: scale(1.25) } 100% { transform: scale(0.001) } }
        @keyframes chest-flash { 0% { opacity: 0 } 30% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes chest-up { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes chest-pop-in { 0% { transform: scale(0.3); opacity: 0 } 70% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes chest-pulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
      `}</style>

      {/* Ambient glow */}
      <div style={{
        position: "absolute", width: 620, height: 620, borderRadius: "50%",
        background: `radial-gradient(circle, ${def.color}33 0%, transparent 70%)`,
        animation: "chest-pulse 2.4s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }} />

      {/* Flash on burst */}
      {phase === "burst" && (
        <div style={{
          position: "absolute", inset: 0, background: "#fff",
          animation: "chest-flash 550ms ease-out forwards", pointerEvents: "none",
        }} />
      )}

      {(phase === "idle" || phase === "shaking" || phase === "burst") && (
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <p style={{
            color: def.color, fontWeight: 900, fontSize: 14, letterSpacing: "3px",
            textTransform: "uppercase", animation: "chest-fade 400ms ease-out both",
            textShadow: `0 0 12px ${def.color}99`,
          }}>
            {def.name}
          </p>

          <button
            onClick={handleTap}
            aria-label={`Abrir ${def.name}`}
            disabled={phase !== "idle"}
            style={{
              background: "none", border: "none", padding: 0, cursor: phase === "idle" ? "pointer" : "default",
              width: 220, height: 220, position: "relative",
              animation: phase === "idle" ? "chest-float 2.2s ease-in-out infinite"
                : phase === "shaking" ? "chest-shake 0.09s ease-in-out infinite"
                : "chest-pop-out 550ms cubic-bezier(.36,0,.66,-0.56) forwards",
              filter: `drop-shadow(0 0 30px ${def.color}88)`,
            }}
          >
            <Image src={def.image || "/placeholder.svg"} alt={def.name} fill sizes="220px" className="object-contain" />
          </button>

          {phase === "idle" && (
            <p style={{
              color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700,
              letterSpacing: "1.5px", textTransform: "uppercase",
              animation: "chest-fade 500ms ease-out 200ms both",
            }}>
              Toque para abrir
            </p>
          )}
        </div>
      )}

      {phase === "revealed" && (
        <div style={{
          position: "relative", zIndex: 2, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 22, padding: "0 24px", textAlign: "center",
          animation: "chest-up 450ms ease-out both",
        }}>
          <p style={{
            color: def.color, fontWeight: 900, fontSize: 15, letterSpacing: "3px",
            textTransform: "uppercase", textShadow: `0 0 14px ${def.color}aa`,
          }}>
            {def.name} aberto!
          </p>

          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            background: "rgba(0,0,0,0.55)", border: `1px solid ${def.color}44`,
            borderRadius: 16, padding: "14px 26px",
            animation: "chest-pop-in 500ms cubic-bezier(.34,1.56,.64,1) 100ms both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/images/gear-coin.png" alt="Gear Coin" style={{ width: 34, height: 34, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(253,224,71,0.7))" }} />
              <span style={{ fontWeight: 900, fontSize: 18, color: "#FDE047", textShadow: "0 0 10px rgba(253,224,71,0.5)" }}>+{result.gear}</span>
            </div>
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.2)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/images/Gacha_Coin.png" alt="Gacha Coin" style={{ width: 34, height: 34, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(252,211,77,0.7))" }} />
              <span style={{ fontWeight: 900, fontSize: 18, color: "#FCD34D", textShadow: "0 0 10px rgba(252,211,77,0.5)" }}>+{result.gacha}</span>
            </div>
          </div>

          {result.cardName && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: `linear-gradient(135deg, ${def.color}26, ${def.color}0d)`,
              border: `1px solid ${def.color}55`, borderRadius: 14, padding: "10px 20px",
              animation: "chest-pop-in 500ms cubic-bezier(.34,1.56,.64,1) 260ms both",
            }}>
              <span style={{ fontSize: 18 }}>✦</span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
                Nova carta: <span style={{ color: def.color }}>{result.cardName}</span>
              </span>
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              marginTop: 6, padding: "13px 44px", borderRadius: 12, fontWeight: 800,
              fontSize: 14, letterSpacing: "1.5px", textTransform: "uppercase", cursor: "pointer",
              border: `2px solid ${def.color}99`, background: `linear-gradient(135deg, ${def.color}26, ${def.color}0d)`,
              color: def.color, animation: "chest-up 450ms ease-out 320ms both",
              transition: "transform 120ms, box-shadow 180ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = `0 0 22px ${def.color}55` }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none" }}
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  )
}
