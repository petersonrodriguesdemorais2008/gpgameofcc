"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { createPortal } from "react-dom"

export interface AttackAnimationProps {
  id: string
  startX: number
  startY: number
  targetX: number
  targetY: number
  element: string
  isDirect?: boolean
  attackerImage?: string
  attackerName?: string
  portalTarget?: HTMLElement | null
  onImpact?: (id: string, x: number, y: number, element: string) => void
  onComplete: (id: string) => void
}

type Phase = "charge" | "travel" | "impact"

// ─── Timing (must total ~940ms to sync with duel-screen.tsx) ─────────────────
const T_CHARGE = 180
const T_TRAVEL = 320
const T_IMPACT = 440
const T_TOTAL  = T_CHARGE + T_TRAVEL + T_IMPACT

// ─── Seeded organic variation per attack ID ───────────────────────────────────
const seed = (s: string, i: number) => {
  let h = i * 2654435761
  for (const c of s) h ^= c.charCodeAt(0) * 1000003
  return ((h >>> 0) / 4294967295)
}

const rng = (a: number, b: number, v = Math.random()) => a + v * (b - a)

const mkParticles = (n: number, spread: number, sMin: number, sMax: number, id: string) =>
  Array.from({ length: n }).map((_, i) => ({
    id: i,
    angle:  rng(-spread / 2, spread / 2, seed(id, i))     * (Math.PI / 180),
    speed:  rng(sMin, sMax,              seed(id, i + 100)),
    size:   rng(2.2, 7.8,               seed(id, i + 200)),
    life:   rng(0.4, 1,                 seed(id, i + 300)),
    delay:  rng(0, 68,                  seed(id, i + 400)),
    jitter: rng(-2, 2,                  seed(id, i + 500)),
  }))

// ─── Inline style helper ──────────────────────────────────────────────────────
const ss = (s: React.CSSProperties) => s

// ─── Centered wrapper ─────────────────────────────────────────────────────────
const Hub = ({ size = 96, children }: { size?: number; children: React.ReactNode }) => (
  <div style={ss({ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
    width:size, height:size, display:"flex", alignItems:"center", justifyContent:"center" })}>
    {children}
  </div>
)

// ─── Ring helper ──────────────────────────────────────────────────────────────
const Rng = ({ d, bw = "2px", bc, glow, anim, op = 1, bg }: {
  d: number; bw?: string; bc?: string; glow?: string; anim?: string; op?: number; bg?: string
}) => (
  <div style={ss({ position:"absolute", width:d, height:d,
    marginLeft:-d/2, marginTop:-d/2,
    borderRadius:"50%",
    border: bc ? `${bw} solid ${bc}` : undefined,
    background: bg,
    boxShadow: glow, opacity: op, animation: anim })} />
)

export function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY,
  element, attackerImage, attackerName,
  portalTarget, onImpact, onComplete,
}: AttackAnimationProps) {
  const [phase, setPhase] = useState<Phase>("charge")
  const [mounted, setMounted] = useState(false)

  const dist   = Math.hypot(targetX - startX, targetY - startY)
  const aRad   = Math.atan2(targetY - startY, targetX - startX)
  const aDeg   = aRad * (180 / Math.PI)
  const el     = element?.toLowerCase().trim() || "neutral"
  const isUller  = /ullr|uller/i.test(attackerName || "")
  const isFehnon = /fehnon/i.test(attackerName || "")

  // Particle sets — seeded per attack so each hit looks slightly different
  const pts = useMemo(() => {
    const cfg: Record<string, [number,number,number,number]> = {
      pyrus:[18,108,35,82],  fire:[18,108,35,82],
      aquos:[15,106,30,76],  aquo:[15,106,30,76],  water:[15,106,30,76],
      terra:[14,100,30,70],  subterra:[14,100,30,70],
      haos:[22,158,32,78],   light:[22,158,32,78],  lightness:[22,158,32,78],
      darkus:[17,105,28,72], darkness:[17,105,28,72], dark:[17,105,28,72],
      ventus:[20,138,30,74], wind:[20,138,30,74],
      void:[22,360,26,70],
    }
    const [n, sp, mn, mx] = cfg[el] ?? [14,108,30,76]
    return mkParticles(n, sp, mn, mx, id)
  }, [el, id])

  const doneRef = useRef(onComplete)
  useEffect(() => { doneRef.current = onComplete }, [onComplete])

  useEffect(() => {
    setMounted(true)
    const t1 = setTimeout(() => setPhase("travel"),                  T_CHARGE)
    const t2 = setTimeout(() => { setPhase("impact"); onImpact?.(id, targetX, targetY, el) },
                                                                      T_CHARGE + T_TRAVEL)
    const t3 = setTimeout(() => doneRef.current(id),                 T_TOTAL)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [id])

  if (!mounted) return null

  const ctr: React.CSSProperties = phase === "impact"
    ? { position:"absolute", left:targetX, top:targetY,   width:0,     height:60, marginTop:-30,
        pointerEvents:"none", zIndex:10000, transformOrigin:"0 50%", transform:`rotate(${aDeg}deg)` }
    : { position:"absolute", left:startX,  top:startY,    width:dist,  height:60, marginTop:-30,
        pointerEvents:"none", zIndex:10000, transformOrigin:"0 50%", transform:`rotate(${aDeg}deg)` }

  // ════════════════════════════════════════════════════════════════════════
  //  ① CHARGE  ─ anticipation, energy buildup
  // ════════════════════════════════════════════════════════════════════════
  const renderCharge = () => {
    switch (el) {

      // ── 🔥 FIRE ──────────────────────────────────────────────────────────
      case "pyrus": case "fire": return (
        <Hub>
          {/* 3 rings, chaotic speeds, simulate unstable fire energy */}
          <Rng d={88} bc="#f97316" bw="2px" glow="0 0 18px 8px rgba(249,115,22,0.72)" anim="ch-spin-a 0.17s linear infinite" op={0.88} />
          <Rng d={65} bc="#fbbf24" bw="3px" glow="0 0 12px 5px rgba(251,191,36,0.7)"  anim="ch-spin-b 0.11s linear reverse infinite" op={0.78} />
          <Rng d={44} bc="#ef4444" bw="2px" glow="0 0 10px 5px rgba(239,68,68,0.78)"  anim="ch-spin-a 0.08s linear infinite" op={0.66} />
          {/* Erupting magma core */}
          <div style={ss({ position:"absolute", width:28, height:28, borderRadius:"50%",
            background:"radial-gradient(circle,white 8%,#fb923c 34%,#dc2626 68%,#7f1d1d 100%)",
            boxShadow:"0 0 0 4px #f97316,0 0 28px 14px rgba(251,146,60,1),0 0 56px 22px rgba(220,38,38,0.66)",
            animation:"ch-core-fire 0.08s ease-in-out infinite" })} />
          {/* Heat shimmer rings */}
          <Rng d={92} bc="rgba(251,146,60,0.44)" bw="1px" anim="ch-burst 0.13s ease-out infinite" />
          <Rng d={92} bc="rgba(251,146,60,0.28)" bw="1px" anim="ch-burst 0.13s ease-out 0.065s infinite" />
          {/* Outer glow haze */}
          <Rng d={96} bg="radial-gradient(circle,rgba(251,146,60,0.2) 0%,transparent 70%)" anim="ch-core-fire 0.1s ease-in-out infinite" />
        </Hub>
      )

      // ── 💧 AQUOS (Fehnon) ────────────────────────────────────────────────
      case "aquos": case "aquo": case "water":
        if (isFehnon) return (
          <Hub size={104}>
            {/* Concentric rings contracting inward — compression before blade release */}
            {[94, 74, 56, 40].map((d, i) => (
              <div key={i} style={ss({ position:"absolute", width:d, height:d,
                marginLeft:-d/2, marginTop:-d/2, borderRadius:"50%",
                border:`${i===0?"2px":"1px"} solid rgba(56,189,248,${0.78-i*0.14})`,
                boxShadow: i===0 ? "0 0 18px 7px rgba(56,189,248,0.56)" : undefined,
                animation:`ch-fehnon-contract 0.18s cubic-bezier(.42,0,1,1) ${i*28}ms forwards` })} />
            ))}
            {/* Holographic scan lines — 9 lines, fade in stagger */}
            {[-25,-17,-10,-4,2,9,16,23].map((y, i) => (
              <div key={i} style={ss({ position:"absolute", height:"1.5px",
                width:`${76 - Math.abs(y)*1.8}px`,
                background:`linear-gradient(to right,transparent,rgba(56,189,248,${.26+Math.abs(i-3.5)*.11}),rgba(255,255,255,${.5+Math.abs(i-3.5)*.09}),rgba(56,189,248,${.26+Math.abs(i-3.5)*.11}),transparent)`,
                borderRadius:"9999px",
                top:`calc(50% + ${y}px)`, left:"50%", transform:"translateX(-50%)",
                animation:`ch-fehnon-scan 0.18s ease-out ${i*9}ms forwards` })} />
            ))}
            {/* Diamond blade core — flat rhombus */}
            <div style={ss({ position:"absolute", width:22, height:22, borderRadius:"3px",
              transform:"rotate(45deg)",
              background:"radial-gradient(circle,white 7%,#7dd3fc 36%,#0ea5e9 80%)",
              boxShadow:"0 0 0 2px #38bdf8,0 0 26px 13px rgba(56,189,248,1),0 0 50px 22px rgba(14,165,233,0.72)",
              animation:"ch-core-fire 0.08s ease-in-out infinite" })} />
            <Rng d={100} bg="radial-gradient(circle,rgba(56,189,248,0.18) 0%,transparent 68%)" anim="ch-core-fire 0.13s ease-in-out infinite" />
          </Hub>
        )
        // Normal Aquos — crystalline vortex
        return (
          <Hub>
            <Rng d={82} bc="#38bdf8" bw="2px" glow="0 0 14px 6px rgba(56,189,248,0.62)" anim="ch-spin-a 0.30s linear infinite" op={0.78} />
            <Rng d={60} bc="#7dd3fc" bw="2px" glow="0 0 10px 4px rgba(125,211,252,0.52)" anim="ch-spin-b 0.22s linear reverse infinite" op={0.62} />
            <Rng d={40} bc="#bae6fd" bw="1px" anim="ch-spin-a 0.15s linear infinite" op={0.46} />
            <div style={ss({ position:"absolute", width:20, height:20, borderRadius:"50%",
              background:"radial-gradient(circle,white 13%,#38bdf8 46%,#0284c7 88%)",
              boxShadow:"0 0 0 2px #7dd3fc,0 0 22px 11px rgba(56,189,248,0.9),0 0 44px 18px rgba(14,165,233,0.52)",
              animation:"ch-core-fire 0.11s ease-in-out infinite" })} />
            <Rng d={90} bg="radial-gradient(circle,rgba(56,189,248,0.14) 0%,transparent 70%)" anim="ch-core-fire 0.14s ease-in-out infinite" />
            <Rng d={90} bc="rgba(56,189,248,0.36)" bw="1px" anim="ch-burst 0.18s ease-out infinite" />
          </Hub>
        )

      // ── 🪨 TERRA ─────────────────────────────────────────────────────────
      case "terra": case "subterra": return (
        <Hub>
          {/* Crack lines radiating outward — ground fracture feel */}
          {[0,40,80,120,160,200,240,280,320].map(a => (
            <div key={a} style={ss({ position:"absolute", width:"30px", height:"2.5px",
              background:"linear-gradient(to right,rgba(180,83,9,0.88),rgba(217,119,6,0.45),transparent)",
              borderRadius:"2px", transformOrigin:"left center",
              transform:`rotate(${a}deg) translateX(14px)`, opacity:.82,
              animation:`ch-terra-crack 0.15s ease-out ${(a/40)*11}ms both` })} />
          ))}
          {/* Ground pulse ring */}
          <Rng d={74} bc="#92400e" bw="2px" glow="0 0 12px 5px rgba(146,64,14,0.56)" anim="ch-spin-a 0.32s linear infinite" op={0.66} />
          {/* Diamond core */}
          <div style={ss({ position:"absolute", width:26, height:26, borderRadius:"3px",
            transform:"rotate(45deg)",
            background:"radial-gradient(circle,#fbbf24 9%,#b45309 40%,#7c2d12 82%)",
            boxShadow:"0 0 0 3px #92400e,0 0 24px 12px rgba(180,83,9,0.95),0 0 50px 20px rgba(120,53,15,0.56)",
            animation:"ch-terra-pulse 0.12s ease-in-out infinite" })} />
          <Rng d={88} bc="rgba(180,83,9,0.48)" bw="1px" anim="ch-burst 0.17s ease-out infinite" />
          <Rng d={88} bc="rgba(146,64,14,0.32)" bw="1px" anim="ch-burst 0.17s ease-out 0.085s infinite" />
          <Rng d={94} bg="radial-gradient(circle,rgba(120,53,15,0.26) 0%,transparent 70%)" anim="ch-terra-pulse 0.15s ease-in-out infinite" />
        </Hub>
      )

      // ── ✨ HAOS ───────────────────────────────────────────────────────────
      case "haos": case "light": case "lightness": return (
        <Hub size={104}>
          {/* 16 divine rays — 3 sizes, staggered pulse */}
          {[0,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,270,292.5,315,337.5].map((a,i) => (
            <div key={a} style={ss({ position:"absolute", width:"2px",
              height: i%4===0 ? "28px" : i%2===0 ? "20px" : "13px",
              background:"linear-gradient(to top,transparent,rgba(254,249,195,0.8),white)",
              borderRadius:"9999px", transformOrigin:"50% 100%",
              transform:`rotate(${a}deg) translateY(-${i%4===0?24:i%2===0?17:11}px)`,
              opacity: i%4===0 ? 1 : i%2===0 ? 0.72 : 0.48,
              animation:`ch-haos-ray 0.1s ease-in-out ${i%3===0?0:i%3===1?33:66}ms infinite` })} />
          ))}
          {/* Blazing core */}
          <div style={ss({ position:"absolute", width:30, height:30, borderRadius:"50%",
            background:"white",
            boxShadow:"0 0 0 5px #fef08a,0 0 0 10px rgba(253,224,71,0.44),0 0 50px 24px rgba(254,240,138,1),0 0 90px 36px rgba(253,224,71,0.44)",
            animation:"ch-core-fire 0.08s ease-in-out infinite" })} />
          <Rng d={98} bg="radial-gradient(circle,rgba(254,240,138,0.36) 0%,transparent 65%)" anim="ch-haos-halo 0.1s ease-in-out infinite" />
          <Rng d={102} bc="rgba(254,240,138,0.46)" bw="1px" anim="ch-burst 0.12s ease-out infinite" />
        </Hub>
      )

      // ── 🌑 DARKUS ────────────────────────────────────────────────────────
      case "darkus": case "darkness": case "dark": return (
        <Hub>
          {/* Outer void ring slowly consuming inward — oppressive, inevitable */}
          <Rng d={90} bc="#7e22ce" bw="2px" glow="0 0 22px 9px rgba(88,28,135,0.76)" anim="ch-dark-consume 0.24s ease-in infinite" op={0.84} />
          <Rng d={68} bc="#a855f7" bw="2px" glow="0 0 14px 6px rgba(168,85,247,0.62)" anim="ch-spin-b 0.3s linear reverse infinite" op={0.66} />
          <Rng d={48} bc="#c084fc" bw="1px" anim="ch-spin-a 0.2s linear infinite" op={0.48} />
          {/* 7 shadow tendrils reaching inward */}
          {[0,51,103,154,206,257,308].map((a,i) => (
            <div key={a} style={ss({ position:"absolute", width:"26px", height:"2px",
              background:"linear-gradient(to right,rgba(88,28,135,0.9),rgba(88,28,135,0.3),transparent)",
              borderRadius:"9999px", transformOrigin:"left center",
              transform:`rotate(${a}deg) translateX(10px)`, opacity:.8,
              animation:`ch-dark-tendril 0.22s ease-in-out ${i*22}ms infinite` })} />
          ))}
          {/* Singularity — absolute dark center */}
          <div style={ss({ position:"absolute", width:20, height:20, borderRadius:"50%",
            background:"radial-gradient(circle,#0f0a1e 18%,black 58%)",
            boxShadow:"0 0 0 3px #581c87,0 0 0 7px rgba(88,28,135,0.5),0 0 36px 18px rgba(88,28,135,1),0 0 72px 30px rgba(88,28,135,0.56)" })} />
          <Rng d={92} bg="radial-gradient(circle,rgba(88,28,135,0.44) 0%,transparent 70%)" anim="ch-dark-consume 0.14s ease-in infinite" />
        </Hub>
      )

      // ── 🌿 VENTUS / ULLER ────────────────────────────────────────────────
      case "ventus": case "wind":
        if (isUller) return (
          <Hub>
            {/* Energy lines converging toward arrowhead tip */}
            {[0,36,72,108,144,180,216,252,288,324].map((a, i) => (
              <div key={a} style={ss({ position:"absolute", width:"26px", height:"2px",
                background:"linear-gradient(to right,rgba(52,211,153,0),#6ee7b7)",
                borderRadius:"9999px", transformOrigin:"left center",
                transform:`rotate(${a}deg) translateX(12px)`, opacity:.82,
                animation:`ch-gather 0.18s ease-in ${i*14}ms both` })} />
            ))}
            <div style={ss({ position:"absolute", width:20, height:20, borderRadius:"50%",
              background:"radial-gradient(circle,white 16%,#6ee7b7 52%,#059669 88%)",
              boxShadow:"0 0 0 2px #34d399,0 0 26px 13px rgba(52,211,153,0.95),0 0 52px 22px rgba(16,185,129,0.56)",
              animation:"ch-core-fire 0.1s ease-in-out infinite" })} />
            <Rng d={84} bc="rgba(52,211,153,0.54)" bw="1px" anim="ch-burst 0.14s ease-out infinite" op={0.62} />
            <Rng d={92} bg="radial-gradient(circle,rgba(52,211,153,0.18) 0%,transparent 70%)" anim="ch-core-fire 0.12s ease-in-out infinite" />
          </Hub>
        )
        return (
          <Hub>
            {/* Dual counter-rotating vortex — lively and fluid */}
            <Rng d={84} bc="#34d399" bw="2px" glow="0 0 14px 6px rgba(52,211,153,0.6)" anim="ch-spin-a 0.24s linear infinite" op={0.76} />
            <Rng d={62} bc="#6ee7b7" bw="2px" glow="0 0 10px 4px rgba(110,231,183,0.52)" anim="ch-spin-b 0.18s linear reverse infinite" op={0.62} />
            <Rng d={42} bc="#a7f3d0" bw="1px" anim="ch-spin-a 0.12s linear infinite" op={0.46} />
            <div style={ss({ position:"absolute", width:20, height:20, borderRadius:"50%",
              background:"radial-gradient(circle,white 16%,#6ee7b7 52%,#059669 88%)",
              boxShadow:"0 0 0 2px #34d399,0 0 22px 11px rgba(110,231,183,0.95),0 0 46px 20px rgba(5,150,105,0.52)",
              animation:"ch-core-fire 0.1s ease-in-out infinite" })} />
            <Rng d={90} bg="radial-gradient(circle,rgba(110,231,183,0.17) 0%,transparent 70%)" anim="ch-core-fire 0.12s ease-in-out infinite" />
            <Rng d={90} bc="rgba(52,211,153,0.37)" bw="1px" anim="ch-burst 0.16s ease-out infinite" />
          </Hub>
        )

      // ── ⚪ VOID ───────────────────────────────────────────────────────────
      case "void": return (
        <Hub>
          {/* 3 silver rings — different speeds → disorienting, fast chaos */}
          <Rng d={90} bc="rgba(203,213,225,0.8)" bw="1.5px" glow="0 0 18px 7px rgba(203,213,225,0.52)" anim="ch-spin-a 0.52s linear infinite" op={0.68} />
          <Rng d={68} bc="rgba(226,232,240,0.7)"  bw="1.5px" glow="0 0 12px 5px rgba(226,232,240,0.42)" anim="ch-spin-b 0.36s linear reverse infinite" op={0.56} />
          <Rng d={48} bc="white" bw="1px" anim="ch-spin-a 0.22s linear infinite" op={0.44} />
          {/* Void core */}
          <div style={ss({ position:"absolute", width:22, height:22, borderRadius:"50%",
            background:"radial-gradient(circle,white 14%,#e2e8f0 44%,#94a3b8 80%)",
            boxShadow:"0 0 0 3px #cbd5e1,0 0 0 6px rgba(148,163,184,0.5),0 0 34px 17px rgba(203,213,225,1),0 0 66px 26px rgba(148,163,184,0.52)",
            animation:"ch-core-fire 0.1s ease-in-out infinite" })} />
          <Rng d={92} bc="rgba(203,213,225,0.38)" bw="1px" anim="ch-burst 0.16s ease-out infinite" />
          <Rng d={92} bc="rgba(203,213,225,0.24)" bw="1px" anim="ch-burst 0.16s ease-out 0.08s infinite" />
          <Rng d={96} bg="radial-gradient(circle,rgba(203,213,225,0.24) 0%,transparent 70%)" anim="ch-core-fire 0.12s ease-in-out infinite" />
        </Hub>
      )

      default: return (
        <Hub size={80}>
          <div style={ss({ position:"absolute", width:24, height:24, borderRadius:"50%",
            background:"white", boxShadow:"0 0 28px 14px rgba(255,255,255,0.8)",
            animation:"ch-core-fire 0.1s ease-in-out infinite" })} />
        </Hub>
      )
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ② TRAVEL  ─ projectile with unique personality per element
  // ════════════════════════════════════════════════════════════════════════
  const renderTravel = () => {
    // Default: fast acceleration
    const mv = (ease = "cubic-bezier(0.08,0,0.06,1)") =>
      ({ animation:`tr-move ${T_TRAVEL}ms ${ease} forwards` } as React.CSSProperties)

    switch (el) {

      // ── 🔥 FIRE ──────────────────────────────────────────────────────────
      case "pyrus": case "fire": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv() })}>
          {/* Long multi-layer flame tail */}
          <div style={ss({ position:"absolute",width:"140px",height:"10px",
            background:"linear-gradient(to right,transparent,rgba(127,29,29,0.32),rgba(220,38,38,0.62),#f97316,rgba(251,146,60,0.66))",
            borderRadius:"9999px",filter:"blur(2.5px)",opacity:.9 })} />
          <div style={ss({ position:"absolute",width:"96px",height:"5px",
            background:"linear-gradient(to right,transparent,#fbbf24,rgba(251,191,36,0.44))",
            top:"-7px",left:"22px",borderRadius:"9999px",filter:"blur(1px)",opacity:.66 })} />
          <div style={ss({ position:"absolute",width:"66px",height:"4px",
            background:"linear-gradient(to right,transparent,rgba(251,146,60,0.42))",
            top:"8px",left:"40px",borderRadius:"9999px",filter:"blur(1px)",opacity:.52 })} />
          {/* Floating ember sparks */}
          {[{x:58,y:-9,s:10},{x:82,y:6,s:8},{x:72,y:-6,s:6}].map((e,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${e.s}px`,height:`${e.s}px`,
              borderRadius:"50%",background:"radial-gradient(circle,white,#fbbf24)",
              boxShadow:"0 0 7px 3px rgba(251,191,36,0.88)",
              left:`${e.x}px`,top:`${e.y}px`,opacity:.72-i*.1 })} />
          ))}
          {/* Core fireball */}
          <div style={ss({ width:"32px",height:"32px",flexShrink:0,borderRadius:"50%",
            background:"radial-gradient(circle,white 7%,#fb923c 32%,#dc2626 65%,#7f1d1d 100%)",
            boxShadow:"0 0 0 3px rgba(249,115,22,0.6),0 0 22px 10px rgba(251,146,60,1),0 0 44px 18px rgba(220,38,38,0.62)" })} />
          {/* Leading white flare */}
          <div style={ss({ position:"absolute",width:"12px",height:"12px",right:"-5px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 14px 7px rgba(255,255,255,1)" })} />
        </div>
      )

      // ── 💧 AQUOS (Fehnon) ────────────────────────────────────────────────
      case "aquos": case "aquo": case "water":
        if (isFehnon) return (
          <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-4px" })}>
            {/* Main slash — wide, bright, instant-reveal */}
            <div style={ss({ width:`${dist}px`,height:"8px",
              background:"linear-gradient(to right,rgba(14,165,233,0) 0%,rgba(56,189,248,0.48) 9%,white 44%,rgba(125,211,252,0.9) 72%,rgba(56,189,248,0.26) 94%,transparent 100%)",
              borderRadius:"9999px",
              boxShadow:"0 0 20px 9px rgba(56,189,248,0.9),0 0 40px 16px rgba(14,165,233,0.56),0 0 66px 26px rgba(56,189,248,0.22)",
              animation:`tr-slash ${T_TRAVEL}ms cubic-bezier(0.03,0,0.07,1) forwards` })} />
            {/* 2nd slash offset up */}
            <div style={ss({ width:`${dist*.82}px`,height:"3px",
              background:"linear-gradient(to right,transparent,rgba(125,211,252,0.7) 14%,rgba(255,255,255,0.94) 50%,rgba(186,230,253,0.62) 84%,transparent)",
              borderRadius:"9999px",position:"absolute",top:"-13px",left:`${dist*.05}px`,
              boxShadow:"0 0 10px 3px rgba(56,189,248,0.7)",
              animation:`tr-slash ${T_TRAVEL}ms cubic-bezier(0.03,0,0.07,1) 18ms forwards` })} />
            {/* 3rd slash offset down */}
            <div style={ss({ width:`${dist*.62}px`,height:"2px",
              background:"linear-gradient(to right,transparent,rgba(186,230,253,0.68) 20%,rgba(255,255,255,0.8) 55%,transparent)",
              borderRadius:"9999px",position:"absolute",top:"12px",left:`${dist*.12}px`,
              boxShadow:"0 0 7px 2px rgba(56,189,248,0.56)",
              animation:`tr-slash ${T_TRAVEL}ms cubic-bezier(0.03,0,0.07,1) 33ms forwards` })} />
            {/* Holo micro-edges */}
            <div style={ss({ width:`${dist*.4}px`,height:"1px",
              background:"linear-gradient(to right,transparent,rgba(224,242,254,0.56),transparent)",
              position:"absolute",top:"-24px",left:`${dist*.18}px`,
              animation:`tr-slash ${T_TRAVEL}ms cubic-bezier(0.03,0,0.07,1) 47ms forwards` })} />
            <div style={ss({ width:`${dist*.32}px`,height:"1px",
              background:"linear-gradient(to right,transparent,rgba(224,242,254,0.46),transparent)",
              position:"absolute",top:"21px",left:`${dist*.24}px`,
              animation:`tr-slash ${T_TRAVEL}ms cubic-bezier(0.03,0,0.07,1) 55ms forwards` })} />
            {/* Tip tracking orb */}
            <div style={ss({ position:"absolute",width:"25px",height:"25px",borderRadius:"50%",
              right:"-3px",top:"-11px",
              background:"radial-gradient(circle,white 15%,#7dd3fc 48%,#0ea5e9 88%)",
              boxShadow:"0 0 28px 14px rgba(56,189,248,1),0 0 58px 24px rgba(14,165,233,0.7)",
              animation:`tr-fehnon-tip ${T_TRAVEL}ms cubic-bezier(0.03,0,0.07,1) forwards` })} />
            {/* Oval holo ripple */}
            <div style={ss({ position:"absolute",width:"17px",height:"44px",borderRadius:"50%",
              right:"-5px",top:"-20px",
              border:"2px solid rgba(56,189,248,0.76)",
              boxShadow:"0 0 12px 4px rgba(56,189,248,0.66)",
              animation:"ch-burst 0.22s ease-out forwards" })} />
          </div>
        )
        // Normal Aquos
        return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv() })}>
            <div style={ss({ position:"absolute",width:"108px",height:"5px",
              background:"linear-gradient(to right,transparent,rgba(14,165,233,0.4),#0ea5e9,#38bdf8)",
              borderRadius:"9999px",filter:"blur(2px)",opacity:.84 })} />
            {[60,76,90].map((x,i)=>(
              <div key={i} style={ss({ position:"absolute",width:`${9-i*2}px`,height:`${9-i*2}px`,
                borderRadius:"50%",border:`1px solid rgba(125,211,252,${0.62-i*0.14})`,
                left:`${x}px`,top:`${i%2===0?-5:4}px`,opacity:.58 })} />
            ))}
            <div style={ss({ width:"28px",height:"28px",flexShrink:0,borderRadius:"50%",
              background:"radial-gradient(circle,white 9%,#38bdf8 44%,#0284c7 84%)",
              boxShadow:"0 0 0 2px #7dd3fc,0 0 18px 9px rgba(56,189,248,0.95),0 0 38px 15px rgba(14,165,233,0.52)" })} />
          </div>
        )

      // ── 🪨 TERRA ─────────────────────────────────────────────────────────
      case "terra": case "subterra": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",
          // Heaviest possible easing: starts like a boulder being pushed
          animation:`tr-move ${T_TRAVEL}ms cubic-bezier(0.24,0,0.06,1) forwards` })}>
          <div style={ss({ position:"absolute",width:"92px",height:"11px",
            background:"linear-gradient(to right,transparent,rgba(120,53,15,0.44),#92400e,#b45309)",
            borderRadius:"4px",filter:"blur(2.5px)",opacity:.84 })} />
          {/* Rock debris chunks */}
          {[{x:22,y:-7,sz:7,r:0},{x:38,y:5,sz:6,r:22},{x:52,y:-5,sz:5,r:45},{x:66,y:4,sz:4,r:15}].map((c,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${c.sz}px`,height:`${c.sz}px`,
              background:`radial-gradient(circle,#d97706,#92400e)`,
              borderRadius:"2px",transform:`rotate(${c.r}deg)`,
              left:`${c.x}px`,top:`${c.y}px`,opacity:.74-i*.1 })} />
          ))}
          {/* Spinning boulder */}
          <div style={ss({ width:"31px",height:"31px",flexShrink:0,borderRadius:"4px",
            transform:"rotate(42deg)",
            background:"radial-gradient(circle,#d97706 14%,#92400e 50%,#451a03 88%)",
            boxShadow:"0 0 0 2px #7c2d12,0 0 18px 8px rgba(146,64,14,0.95),0 0 36px 14px rgba(120,53,15,0.52)" })} />
        </div>
      )

      // ── ✨ HAOS ───────────────────────────────────────────────────────────
      case "haos": case "light": case "lightness": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-4px" })}>
          {/* Main laser — instant divine light */}
          <div style={ss({ width:`${dist}px`,height:"8px",
            background:"linear-gradient(to right,rgba(254,240,138,0) 0%,rgba(253,224,71,0.52) 13%,white 47%,rgba(254,249,195,0.9) 78%,rgba(254,240,138,0) 100%)",
            borderRadius:"9999px",
            boxShadow:"0 0 16px 7px rgba(254,240,138,0.95),0 0 34px 14px rgba(253,224,71,0.62),0 0 60px 24px rgba(254,240,138,0.28)",
            animation:`tr-laser ${T_TRAVEL}ms ease-out forwards` })} />
          {/* Sub laser */}
          <div style={ss({ width:`${dist*.88}px`,height:"3px",
            background:"linear-gradient(to right,transparent,rgba(254,249,195,0.64) 16%,white 52%,transparent)",
            borderRadius:"9999px",position:"absolute",top:"-8px",left:`${dist*.04}px`,
            boxShadow:"0 0 8px 2px rgba(254,240,138,0.74)",
            animation:`tr-laser ${T_TRAVEL}ms ease-out 13ms forwards` })} />
          {/* Tip burst */}
          <div style={ss({ position:"absolute",right:0,top:"-12px",width:"28px",height:"28px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 26px 13px rgba(254,240,138,1),0 0 56px 24px rgba(253,224,71,0.7)" })} />
        </div>
      )

      // ── 🌑 DARKUS ────────────────────────────────────────────────────────
      case "darkus": case "darkness": case "dark": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",
          // Maximum weight — oppressively slow start
          animation:`tr-move ${T_TRAVEL}ms cubic-bezier(0.44,0,0.06,1) forwards` })}>
          <div style={ss({ position:"absolute",width:"128px",height:"5px",
            background:"linear-gradient(to right,transparent,rgba(88,28,135,0.36),#7e22ce,#a855f7)",
            borderRadius:"9999px",filter:"blur(1.5px)",opacity:.88 })} />
          {/* Shadow tendrils growing ahead */}
          {[{w:60,y:-9,l:44},{w:48,y:9,l:60},{w:34,y:-15,l:76}].map((t,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${t.w}px`,height:"2px",
              background:"linear-gradient(to right,transparent,rgba(76,29,149,0.55))",
              borderRadius:"9999px",top:`${t.y}px`,left:`${t.l}px` })} />
          ))}
          {/* Dark blade */}
          <div style={ss({ width:"11px",height:"38px",flexShrink:0,borderRadius:"3px",
            background:"linear-gradient(to bottom,#c084fc 0%,#581c87 36%,black 66%,#581c87 100%)",
            boxShadow:"0 0 0 1px rgba(88,28,135,0.8),0 0 18px 9px rgba(88,28,135,0.95),0 0 40px 18px rgba(88,28,135,0.52)" })} />
        </div>
      )

      // ── 🌿 VENTUS / ULLER ────────────────────────────────────────────────
      case "ventus": case "wind":
        if (isUller) return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv() })}>
            {/* Arrow shaft */}
            <div style={ss({ position:"absolute",
              width:`${Math.max(dist*.55,72)}px`,height:"3px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.5),#34d399)",
              borderRadius:"9999px",boxShadow:"0 0 5px 2px rgba(52,211,153,0.52)" })} />
            {/* Fletching — animated wind feathers */}
            <div style={ss({ position:"absolute",width:"22px",height:"2.5px",
              background:"rgba(110,231,183,0.72)",borderRadius:"9999px",
              left:"5px",top:"-6px",transformOrigin:"left center",transform:"rotate(-30deg)",
              animation:"tr-feather 0.2s ease-in-out infinite" })} />
            <div style={ss({ position:"absolute",width:"22px",height:"2.5px",
              background:"rgba(110,231,183,0.72)",borderRadius:"9999px",
              left:"5px",top:"4px",transformOrigin:"left center",transform:"rotate(30deg)",
              animation:"tr-feather 0.2s ease-in-out 0.1s infinite" })} />
            {/* Green glow trail */}
            <div style={ss({ position:"absolute",width:"50px",height:"8px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.3))",
              top:"-4px",left:"20px",filter:"blur(3px)" })} />
            {/* Arrowhead */}
            <div style={ss({ width:0,height:0,flexShrink:0,
              borderTop:"11px solid transparent",borderBottom:"11px solid transparent",
              borderLeft:"25px solid #34d399",
              filter:"drop-shadow(0 0 9px rgba(52,211,153,0.95)) drop-shadow(0 0 20px rgba(16,185,129,0.62))" })} />
            {/* Tip spark */}
            <div style={ss({ position:"absolute",right:"-6px",width:"11px",height:"11px",
              background:"white",borderRadius:"50%",
              boxShadow:"0 0 13px 7px rgba(52,211,153,1)" })} />
          </div>
        )
        // Regular Ventus — whirlwind tornado
        return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv() })}>
            <div style={ss({ position:"absolute",width:"108px",height:"26px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.1),rgba(110,231,183,0.26))",
              top:"-13px",borderRadius:"0 50% 50% 0",filter:"blur(4.5px)",opacity:.74 })} />
            <div style={ss({ position:"absolute",width:"74px",height:"36px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.18))",
              top:"-18px",left:"15px",borderRadius:"0 50% 50% 0",filter:"blur(3px)",opacity:.56 })} />
            {/* Spinning vortex core */}
            <div style={ss({ width:"28px",height:"40px",flexShrink:0,borderRadius:"50%",
              border:"3px solid #34d399",
              boxShadow:"0 0 15px 7px rgba(52,211,153,0.9),0 0 32px 13px rgba(16,185,129,0.46)",
              animation:"ch-spin-a 0.11s linear infinite",filter:"blur(0.5px)" })} />
            <div style={ss({ position:"absolute",right:"3px",width:"17px",height:"27px",
              borderRadius:"50%",border:"2px solid #6ee7b7",opacity:.64,
              animation:"ch-spin-b 0.08s linear reverse infinite" })} />
          </div>
        )

      // ── ⚪ VOID ───────────────────────────────────────────────────────────
      case "void": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-3px",
          // Near-instant: void crosses distance almost before you see it
          animation:`tr-move ${T_TRAVEL}ms cubic-bezier(0.04,0,0.04,1) forwards` })}>
          {/* Silver rift streak */}
          <div style={ss({ position:"absolute",
            width:`${Math.min(dist*.64,120)}px`,height:"3px",
            background:"linear-gradient(to right,transparent,rgba(203,213,225,0.38),rgba(255,255,255,0.96))",
            borderRadius:"9999px",boxShadow:"0 0 7px 2px rgba(203,213,225,0.72)",
            animation:`tr-laser ${T_TRAVEL}ms ease-out forwards` })} />
          {/* Distortion ripples — non-linear feel */}
          {[{x:30,y:-7,s:14,d:0},{x:52,y:5,s:11,d:30},{x:70,y:-4,s:8,d:55}].map((r,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${r.s}px`,height:`${r.s}px`,
              borderRadius:"50%",border:"1px solid rgba(203,213,225,0.5)",
              left:`${r.x}%`,top:`${r.y}px`,opacity:.5,
              animation:`ch-burst 0.18s ease-out ${r.d}ms forwards` })} />
          ))}
          {/* Leading void orb */}
          <div style={ss({ position:"absolute",right:0,top:"-12px",width:"27px",height:"27px",
            background:"radial-gradient(circle,white 15%,#e2e8f0 50%,#94a3b8 88%)",
            borderRadius:"50%",
            boxShadow:"0 0 20px 10px rgba(203,213,225,0.95),0 0 44px 18px rgba(148,163,184,0.56)" })} />
        </div>
      )

      default: return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv() })}>
          <div style={ss({ position:"absolute",width:"74px",height:"4px",
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.88))",
            borderRadius:"9999px",filter:"blur(1px)" })} />
          <div style={ss({ width:"24px",height:"24px",flexShrink:0,borderRadius:"50%",
            background:"white",boxShadow:"0 0 18px 9px rgba(255,255,255,0.8)" })} />
        </div>
      )
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ③ IMPACT  ─ hit + residuals (4 layers: flash, shockwave, core, particles)
  // ════════════════════════════════════════════════════════════════════════
  const renderImpact = () => {
    type C = { r1:string;r2:string;r3:string;core:string;cg:string;gw:string;pc:string[];fl:string;res:string }

    const resolveKey = (e:string): string => {
      const m:{[k:string]:string} = {fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",
        light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus"}
      const base = m[e] ?? e
      if (base==="aquos"  && isFehnon) return "aquos_fehnon"
      if (base==="ventus" && isUller)  return "ventus_uller"
      return base
    }

    const cfgs: Record<string,C> = {
      pyrus:       {r1:"#f97316",r2:"#fbbf24",r3:"#ef4444",
        core:"radial-gradient(circle,white 5%,#fb923c 26%,#dc2626 56%,#7f1d1d 88%)",
        cg:"rgba(249,115,22,0.95)",gw:"rgba(220,38,38,0.54)",
        pc:["#7f1d1d","#991b1b","#dc2626","#ea580c","#f97316","#fb923c","#fbbf24","#fef3c7","white"],
        fl:"rgba(255,110,0,0.28)",res:"rgba(220,38,38,0.18)"},

      aquos:       {r1:"#38bdf8",r2:"#7dd3fc",r3:"#0ea5e9",
        core:"radial-gradient(circle,white 5%,#38bdf8 30%,#0284c7 62%,#0c4a6e 90%)",
        cg:"rgba(56,189,248,0.9)",gw:"rgba(14,165,233,0.44)",
        pc:["#082f49","#0c4a6e","#0284c7","#0ea5e9","#38bdf8","#7dd3fc","#bae6fd","white"],
        fl:"rgba(56,189,248,0.24)",res:"rgba(56,189,248,0.14)"},

      aquos_fehnon:{r1:"#38bdf8",r2:"white",r3:"#7dd3fc",
        core:"radial-gradient(circle,white 7%,#bae6fd 22%,#38bdf8 46%,#0284c7 72%,#075985 93%)",
        cg:"rgba(56,189,248,1)",gw:"rgba(14,165,233,0.7)",
        pc:["white","#f0f9ff","#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9"],
        fl:"rgba(56,189,248,0.4)",res:"rgba(56,189,248,0.2)"},

      terra:       {r1:"#b45309",r2:"#d97706",r3:"#92400e",
        core:"radial-gradient(circle,#fbbf24 5%,#b45309 30%,#7c2d12 60%,#431407 90%)",
        cg:"rgba(180,83,9,0.95)",gw:"rgba(120,53,15,0.54)",
        pc:["#1c0a04","#431407","#7c2d12","#92400e","#b45309","#d97706","#fbbf24"],
        fl:"rgba(120,53,15,0.32)",res:"rgba(120,53,15,0.16)"},

      haos:        {r1:"#fde047",r2:"white",r3:"#fef08a",
        core:"radial-gradient(circle,white 8%,#fef9c3 28%,#fef08a 54%,#fde047 80%)",
        cg:"rgba(254,240,138,1)",gw:"rgba(253,224,71,0.64)",
        pc:["white","#fefce8","#fef9c3","#fef08a","#fde047","#fbbf24","#f59e0b","#ffd700"],
        fl:"rgba(255,255,165,0.4)",res:"rgba(253,224,71,0.22)"},

      darkus:      {r1:"#7e22ce",r2:"#a855f7",r3:"#4c1d95",
        core:"radial-gradient(circle,#e879f9 5%,#a855f7 26%,#7e22ce 50%,#1e1b4b 80%,#0f0a1e 95%)",
        cg:"rgba(88,28,135,0.98)",gw:"rgba(88,28,135,0.64)",
        pc:["#030712","#0f0a1e","#1e1b4b","#4c1d95","#7e22ce","#a855f7","#c084fc","#e879f9"],
        fl:"rgba(88,28,135,0.3)",res:"rgba(88,28,135,0.18)"},

      ventus:      {r1:"#34d399",r2:"#6ee7b7",r3:"#059669",
        core:"radial-gradient(circle,white 5%,#6ee7b7 28%,#10b981 56%,#064e3b 88%)",
        cg:"rgba(52,211,153,0.95)",gw:"rgba(5,150,105,0.48)",
        pc:["#022c22","#064e3b","#059669","#34d399","#6ee7b7","#a7f3d0","white"],
        fl:"rgba(52,211,153,0.24)",res:"rgba(52,211,153,0.14)"},

      ventus_uller:{r1:"#34d399",r2:"white",r3:"#a7f3d0",
        core:"radial-gradient(circle,white 9%,#a7f3d0 26%,#34d399 50%,#059669 78%)",
        cg:"rgba(52,211,153,1)",gw:"rgba(16,185,129,0.54)",
        pc:["white","#f0fdf4","#dcfce7","#a7f3d0","#6ee7b7","#34d399","#10b981"],
        fl:"rgba(52,211,153,0.3)",res:"rgba(52,211,153,0.16)"},

      void:        {r1:"#cbd5e1",r2:"white",r3:"#94a3b8",
        core:"radial-gradient(circle,white 9%,#f1f5f9 26%,#e2e8f0 50%,#94a3b8 76%)",
        cg:"rgba(203,213,225,1)",gw:"rgba(148,163,184,0.54)",
        pc:["white","#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8","#64748b"],
        fl:"rgba(203,213,225,0.3)",res:"rgba(148,163,184,0.16)"},
    }

    const c       = cfgs[resolveKey(el)] ?? cfgs.void
    const iBase   = aRad + Math.PI
    const isTerra = el==="terra"||el==="subterra"
    const isFeh   = isFehnon&&(el==="aquos"||el==="aquo"||el==="water")
    const isDark  = el==="darkus"||el==="darkness"||el==="dark"

    return (
      <div style={ss({ position:"absolute",left:0,top:0,width:0,height:0,
        transform:`rotate(${-aDeg}deg)` })}>

        {/* ── Layer 1: Element flash ── */}
        <div style={ss({ position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",
          background:c.fl,animation:"imp-flash 0.14s linear forwards",pointerEvents:"none" })} />

        {/* ── Layer 2: Localized micro-shake wrapper ── */}
        <div style={ss({ position:"absolute",left:"-80px",top:"-80px",width:"160px",height:"160px",
          animation:`imp-local-shake 0.18s cubic-bezier(.36,.07,.19,.97) forwards` })}>

          {/* 4 shockwave rings — staggered, creates rolling wave feel */}
          {[{s:148,bw:3,d:0,op:1},{s:116,bw:2,d:28,op:.64},{s:84,bw:2,d:54,op:.44},{s:58,bw:1,d:0,op:.3}].map(({s,bw,d,op},i)=>(
            <div key={i} style={ss({ position:"absolute",
              left:`${80-s/2}px`,top:`${80-s/2}px`,width:s,height:s,
              borderRadius:"50%",
              border:`${bw}px solid ${i===1?c.r2:i===2?c.r3:c.r1}`,
              boxShadow: i===0 ? `0 0 24px 9px ${c.cg}` : undefined,
              opacity:op,
              animation:`imp-ring ${T_IMPACT}ms ease-out ${d}ms forwards` })} />
          ))}

          {/* Core burst — 3-stage life cycle */}
          <div style={ss({ position:"absolute",
            left:"20px",top:"20px",width:"120px",height:"120px",
            borderRadius:"50%",background:c.core,
            boxShadow:`0 0 60px 26px ${c.cg},0 0 120px 48px ${c.gw}`,
            animation:`imp-core ${T_IMPACT}ms cubic-bezier(0.04,0.9,0.12,1) forwards` })} />

          {/* Residual glow (post-impact linger) */}
          <div style={ss({ position:"absolute",
            left:"30px",top:"30px",width:"100px",height:"100px",
            borderRadius:"50%",background:c.res,filter:"blur(8px)",
            animation:`imp-residual ${T_IMPACT}ms ease-out forwards` })} />

        </div>{/* end shake wrapper */}

        {/* ── Layer 3: FEHNON — scar lines (outside shake wrapper for orientation) ── */}
        {isFeh && [
          {w:138,r:0,  t:-3,d:0 },{w:106,r:-20,t:-3,d:9 },
          {w:106,r:20, t:-3,d:9 },{w:78, r:-40,t:-2,d:20},
          {w:78, r:40, t:-2,d:20},{w:54, r:-60,t:-1,d:32},
          {w:54, r:60, t:-1,d:32},{w:36, r:-78,t:0, d:44},
          {w:36, r:78, t:0, d:44},
        ].map((s,i)=>(
          <div key={i} style={ss({ position:"absolute",height:"2.5px",width:`${s.w}px`,
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.94),rgba(125,211,252,0.76),transparent)",
            borderRadius:"9999px",top:`${s.t}px`,left:0,
            transform:`rotate(${s.r}deg)`,transformOrigin:"left center",
            boxShadow:"0 0 8px 2px rgba(56,189,248,0.78)",
            animation:`imp-slash ${T_IMPACT*.66}ms cubic-bezier(0,0,0.14,1) ${s.d}ms forwards` })} />
        ))}
        {isFeh && [-20,-12,-5,2,9,16].map((y,i)=>(
          <div key={`sc${i}`} style={ss({ position:"absolute",height:"1px",
            width:`${88-Math.abs(y)*2}px`,
            background:`linear-gradient(to right,transparent,rgba(186,230,253,${.44+Math.abs(i-2.5)*.08}),transparent)`,
            borderRadius:"9999px",top:`${y}px`,left:"50%",transform:"translateX(-50%)",
            animation:`imp-slash ${T_IMPACT*.5}ms ease-out ${i*10}ms forwards` })} />
        ))}

        {/* ── Layer 3: DARKUS — void absorption tendrils (lingering) ── */}
        {isDark && [0,60,120,180,240,300].map((a,i)=>(
          <div key={i} style={ss({ position:"absolute",height:"1.5px",
            width:"50px",borderRadius:"9999px",
            background:"linear-gradient(to right,rgba(88,28,135,0.7),transparent)",
            transformOrigin:"right center",
            transform:`rotate(${a}deg) translateX(-50px)`,
            animation:`imp-dark-abs ${T_IMPACT*.8}ms ease-in ${i*18}ms forwards` })} />
        ))}

        {/* ── Layer 4: Particles ── */}
        {pts.map(p => {
          const a   = iBase + p.angle * .83
          const d   = p.speed * p.life
          const px  = Math.cos(a)*d + p.jitter
          const py  = Math.sin(a)*d + p.jitter
          const col = c.pc[p.id % c.pc.length]
          const rot = isFeh ? Math.atan2(py,px)*180/Math.PI : 0
          return (
            <div key={p.id} style={ss({
              position:"absolute",
              width:`${p.size}px`,
              height:`${isFeh?p.size*.35:isTerra?p.size*.65:isDark?p.size*1.4:p.size}px`,
              borderRadius: isTerra||isFeh ? "2px" : isDark ? "1px 4px 1px 4px" : "50%",
              background:col,
              boxShadow:`0 0 5px 2px ${col}94`,
              transform: rot ? `rotate(${rot}deg)` : isDark ? `rotate(${p.rot}deg)` : undefined,
              animation:`imp-particle ${T_IMPACT}ms cubic-bezier(0.02,0.54,0.13,1) ${p.delay}ms forwards`,
              "--px":`${px}px`,"--py":`${py}px`,opacity:0,
            } as React.CSSProperties)} />
          )
        })}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Render
  // ════════════════════════════════════════════════════════════════════════
  let content: React.ReactNode = null
  if      (phase==="charge") content = renderCharge()
  else if (phase==="travel") content = renderTravel()
  else if (phase==="impact") content = renderImpact()

  const output = (
    <>
      <style>{`
        /* ── Charge keyframes ─────────────────────────────────────────────── */
        @keyframes ch-spin-a        { from{transform:rotate(0deg)}          to{transform:rotate(360deg)} }
        @keyframes ch-spin-b        { from{transform:rotate(0deg)}          to{transform:rotate(-360deg)} }
        @keyframes ch-burst         { 0%{transform:scale(.26);opacity:1}    100%{transform:scale(1.76);opacity:0} }
        @keyframes ch-core-fire     { 0%,100%{opacity:.74;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes ch-terra-pulse   { 0%,100%{opacity:.72;transform:scale(1) rotate(45deg)} 50%{opacity:1;transform:scale(1.18) rotate(45deg)} }
        @keyframes ch-haos-halo     { 0%,100%{opacity:.64;transform:scale(1)} 50%{opacity:1;transform:scale(1.34)} }
        @keyframes ch-haos-ray      { 0%,100%{opacity:.6;transform-origin:50% 100%;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.38)} }
        @keyframes ch-dark-consume  { 0%{transform:scale(1.44);opacity:.84}  100%{transform:scale(.48);opacity:.24} }
        @keyframes ch-dark-tendril  { 0%,100%{opacity:.62;transform-origin:left center;transform:scaleX(1)} 50%{opacity:1;transform:scaleX(1.38)} }
        @keyframes ch-gather        { 0%{opacity:0;transform-origin:left center;transform:translateX(12px) scaleX(0)} 100%{opacity:.82;transform:translateX(12px) scaleX(1)} }
        @keyframes ch-terra-crack   { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 100%{opacity:.82;transform:scaleX(1)} }
        @keyframes ch-fehnon-contract{ 0%{transform:scale(1.55);opacity:0}  52%{opacity:1} 100%{transform:scale(.2);opacity:0} }
        @keyframes ch-fehnon-scan   { 0%{opacity:0;transform:translateX(-50%) scaleX(0)} 44%{opacity:1} 100%{opacity:0;transform:translateX(-50%) scaleX(1)} }

        /* ── Travel keyframes ─────────────────────────────────────────────── */
        @keyframes tr-move          { 0%{transform:translateX(0)}           100%{transform:translateX(${dist}px)} }
        @keyframes tr-laser         { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 6%{opacity:1} 70%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes tr-slash         { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 5%{opacity:1} 65%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes tr-fehnon-tip    { 0%{transform:translateX(${-dist}px);opacity:0} 6%{opacity:1} 100%{transform:translateX(0);opacity:1} }
        @keyframes tr-feather       { 0%,100%{transform:rotate(-30deg);opacity:.72} 50%{transform:rotate(-22deg);opacity:1} }

        /* ── Impact keyframes ─────────────────────────────────────────────── */
        @keyframes imp-flash        { 0%{opacity:1} 26%{opacity:.64} 100%{opacity:0} }
        @keyframes imp-local-shake  {
          0%  {transform:translate(0,0)}
          12% {transform:translate(-4px,-2px)}
          24% {transform:translate(4px,2px)}
          36% {transform:translate(-3px,1px)}
          48% {transform:translate(3px,-1px)}
          60% {transform:translate(-2px,0px)}
          76% {transform:translate(1px,1px)}
          100%{transform:translate(0,0)}
        }
        @keyframes imp-ring         { 0%{transform:scale(.07);opacity:1;border-width:8px} 46%{opacity:.6} 100%{transform:scale(2.8);opacity:0;border-width:1px} }
        @keyframes imp-core         { 0%{transform:scale(.03);opacity:1} 17%{transform:scale(1.36);opacity:1} 48%{transform:scale(1.04);opacity:.76} 100%{transform:scale(0);opacity:0} }
        @keyframes imp-residual     { 0%{opacity:0} 18%{opacity:1} 60%{opacity:.5} 100%{opacity:0;transform:scale(1.4)} }
        @keyframes imp-particle     { 0%{transform:translate(0,0) scale(1.9);opacity:1} 100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0} }
        @keyframes imp-slash        { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 5%{opacity:1} 65%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes imp-dark-abs     { 0%{opacity:0;transform-origin:right center;transform:rotate(var(--a,0deg)) translateX(-50px) scaleX(0)} 30%{opacity:.7} 100%{opacity:0;transform:rotate(var(--a,0deg)) translateX(-50px) scaleX(1)} }

        /* ── Afterimage ───────────────────────────────────────────────────── */
        @keyframes afterimage-fade  { 0%{opacity:.23} 100%{opacity:0} }
      `}</style>

      {/* Attacker ghost image */}
      {attackerImage && phase!=="impact" && (
        <div style={ss({ position:"absolute",left:startX-40,top:startY-56,
          width:"80px",height:"112px",
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:.2,filter:"blur(2px)",
          animation:"afterimage-fade 200ms ease-out forwards",
          pointerEvents:"none",zIndex:5 })} />
      )}

      <div style={ctr} suppressHydrationWarning>{content}</div>
    </>
  )

  if (portalTarget) return createPortal(output, portalTarget)
  if (typeof document !== "undefined") return createPortal(output, document.body)
  return null
}
