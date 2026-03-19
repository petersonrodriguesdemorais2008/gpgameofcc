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

type AnimPhase = "charge" | "travel" | "impact"

// ─── Timing ──────────────────────────────────────────────────────────────────
// Total must stay ~940ms to sync with game logic
const CHARGE   = 170
const TRAVEL   = 330
const IMPACT   = 440
const TOTAL    = CHARGE + TRAVEL + IMPACT

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rng = (a: number, b: number) => a + Math.random() * (b - a)

const mkPart = (n: number, spread = 105, speedMin = 32, speedMax = 78) =>
  Array.from({ length: n }).map((_, i) => ({
    id: i,
    angle: rng(-spread / 2, spread / 2) * (Math.PI / 180),
    speed: rng(speedMin, speedMax),
    size:  rng(2.5, 7.5),
    life:  rng(0.42, 1),
    delay: rng(0, 70),
    rot:   rng(0, 360),
  }))

const S = (style: React.CSSProperties) => style  // type helper

// Div shorthand
const D = ({ s, children }: { s: React.CSSProperties; children?: React.ReactNode }) => (
  <div style={s}>{children}</div>
)

export function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY,
  element, attackerImage, attackerName,
  portalTarget, onImpact, onComplete,
}: AttackAnimationProps) {
  const [phase, setPhase] = useState<AnimPhase>("charge")
  const [mounted, setMounted] = useState(false)

  const dist    = Math.hypot(targetX - startX, targetY - startY)
  const angleR  = Math.atan2(targetY - startY, targetX - startX)
  const angleD  = angleR * (180 / Math.PI)
  const el      = element?.toLowerCase().trim() || "neutral"

  const isUller  = /ullr|uller/i.test(attackerName || "")
  const isFehnon = /fehnon/i.test(attackerName || "")

  // Per-element particle configs
  const parts = useMemo(() => {
    const cfg: Record<string,[number,number,number,number]> = {
      // [count, spread, speedMin, speedMax]
      pyrus:16, fire:16,
      aquos:14, aquo:14, water:14,
      terra:12, subterra:12,
      haos:20,  light:20, lightness:20,
      darkus:16,darkness:16, dark:16,
      ventus:18,wind:18,
      void:20,
    } as any
    const sp: Record<string,number> = { void:360,haos:155,light:155,lightness:155,ventus:135,wind:135 }
    const c = (cfg[el] as unknown as number) ?? 14
    return mkPart(c, sp[el] ?? 108, 30, 80)
  }, [el])

  const doneRef = useRef(onComplete)
  useEffect(() => { doneRef.current = onComplete }, [onComplete])

  useEffect(() => {
    setMounted(true)
    const t1 = setTimeout(() => setPhase("travel"), CHARGE)
    const t2 = setTimeout(() => {
      setPhase("impact")
      onImpact?.(id, targetX, targetY, el)
    }, CHARGE + TRAVEL)
    const t3 = setTimeout(() => doneRef.current(id), TOTAL)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [id])

  if (!mounted) return null

  const container: React.CSSProperties = phase === "impact"
    ? { position:"absolute",left:targetX,top:targetY,width:0,height:60,marginTop:-30,
        pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${angleD}deg)` }
    : { position:"absolute",left:startX,top:startY,width:dist,height:60,marginTop:-30,
        pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${angleD}deg)` }

  // ══════════════════════════════════════════════════════════════════════════
  //  CHARGE  — anticipation & energy buildup
  // ══════════════════════════════════════════════════════════════════════════
  const Charge = () => {
    const hub = (w=96,h=96): React.CSSProperties => ({
      position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
      width:w,height:h,display:"flex",alignItems:"center",justifyContent:"center"
    })

    switch (el) {

      // ── 🔥 FIRE — aggressive, boiling energy ────────────────────────────
      case "pyrus": case "fire": return (
        <div style={hub()}>
          {/* Outer corona — erratic, alive */}
          <div style={S({ position:"absolute",width:88,height:88,borderRadius:"50%",
            border:"2px solid #f97316",filter:"blur(1px)",opacity:.85,
            animation:"ep-spin 0.18s linear infinite",
            boxShadow:"0 0 18px 7px rgba(249,115,22,0.65)" })} />
          {/* Mid ring counter-rotating faster */}
          <div style={S({ position:"absolute",width:64,height:64,borderRadius:"50%",
            border:"3px solid #fbbf24",opacity:.8,
            animation:"ep-spin 0.12s linear reverse infinite",
            boxShadow:"0 0 12px 5px rgba(251,191,36,0.7)" })} />
          {/* Inner hot ring */}
          <div style={S({ position:"absolute",width:42,height:42,borderRadius:"50%",
            border:"2px solid #ef4444",opacity:.7,
            animation:"ep-spin 0.09s linear infinite",
            boxShadow:"0 0 10px 5px rgba(239,68,68,0.8)" })} />
          {/* Erupting core */}
          <div style={S({ position:"absolute",width:28,height:28,borderRadius:"50%",
            background:"radial-gradient(circle,white 10%,#fb923c 38%,#dc2626 72%,#7f1d1d 100%)",
            boxShadow:"0 0 0 4px #f97316,0 0 28px 14px rgba(251,146,60,1),0 0 56px 22px rgba(220,38,38,0.65)",
            animation:"ep-fire-core 0.08s ease-in-out infinite" })} />
          {/* Heat shimmer rings bursting outward */}
          <div style={S({ position:"absolute",width:92,height:92,borderRadius:"50%",
            border:"1px solid rgba(251,146,60,0.45)",
            animation:"ep-ring-burst 0.14s ease-out infinite" })} />
          <div style={S({ position:"absolute",width:92,height:92,borderRadius:"50%",
            border:"1px solid rgba(251,146,60,0.3)",
            animation:"ep-ring-burst 0.14s ease-out 0.07s infinite" })} />
          {/* Radial glow */}
          <div style={S({ position:"absolute",width:96,height:96,borderRadius:"50%",
            background:"radial-gradient(circle,rgba(251,146,60,0.22) 0%,transparent 70%)",
            animation:"ep-fire-core 0.1s ease-in-out infinite" })} />
        </div>
      )

      // ── 💧 AQUOS (Fehnon) — holographic blade forming ──────────────────
      case "aquos": case "aquo": case "water":
        if (isFehnon) return (
          <div style={hub(104,104)}>
            {/* Three contracting holo rings — creating sense of compression */}
            {[92,72,54].map((s,i) => (
              <div key={i} style={S({ position:"absolute",width:s,height:s,
                borderRadius:"50%",
                border:`${i===0?"2px":"1px"} solid rgba(56,189,248,${0.8-i*0.15})`,
                boxShadow: i===0 ? "0 0 16px 6px rgba(56,189,248,0.55)" : undefined,
                animation:`ep-fehnon-contract 0.17s cubic-bezier(0.4,0,1,1) ${i*30}ms forwards` })} />
            ))}
            {/* Holographic scan lines — 9 horizontal, varying width/opacity */}
            {[-24,-16,-9,-3,3,9,16,24].map((y,i) => (
              <div key={i} style={S({ position:"absolute",height:"1.5px",
                width:`${76-Math.abs(y)*2}px`,
                background:`linear-gradient(to right,transparent,rgba(56,189,248,${.28+Math.abs(i-3.5)*.1}),rgba(255,255,255,${.52+Math.abs(i-3.5)*.08}),rgba(56,189,248,${.28+Math.abs(i-3.5)*.1}),transparent)`,
                borderRadius:"9999px",
                top:`calc(50% + ${y}px)`,left:"50%",transform:"translateX(-50%)",
                animation:`ep-fehnon-scan 0.17s ease-out ${i*8}ms forwards` })} />
            ))}
            {/* Diamond blade core */}
            <div style={S({ position:"absolute",width:22,height:22,borderRadius:"3px",
              transform:"rotate(45deg)",
              background:"radial-gradient(circle,white 8%,#7dd3fc 38%,#0ea5e9 80%)",
              boxShadow:"0 0 0 2px #38bdf8,0 0 24px 12px rgba(56,189,248,1),0 0 48px 20px rgba(14,165,233,0.7)",
              animation:"ep-fire-core 0.08s ease-in-out infinite" })} />
            <div style={S({ position:"absolute",width:100,height:100,borderRadius:"50%",
              background:"radial-gradient(circle,rgba(56,189,248,0.18) 0%,transparent 68%)",
              animation:"ep-fire-core 0.13s ease-in-out infinite" })} />
          </div>
        )
        // Normal Aquos — water vortex
        return (
          <div style={hub()}>
            <div style={S({ position:"absolute",width:82,height:82,borderRadius:"50%",
              border:"2px solid #38bdf8",opacity:.78,
              animation:"ep-spin 0.32s linear infinite",
              boxShadow:"0 0 14px 6px rgba(56,189,248,0.6)" })} />
            <div style={S({ position:"absolute",width:60,height:60,borderRadius:"50%",
              border:"2px solid #7dd3fc",opacity:.62,
              animation:"ep-spin 0.24s linear reverse infinite",
              boxShadow:"0 0 10px 4px rgba(125,211,252,0.5)" })} />
            <div style={S({ position:"absolute",width:40,height:40,borderRadius:"50%",
              border:"1px solid #bae6fd",opacity:.45,
              animation:"ep-spin 0.17s linear infinite" })} />
            <div style={S({ position:"absolute",width:20,height:20,borderRadius:"50%",
              background:"radial-gradient(circle,white 14%,#38bdf8 48%,#0284c7 88%)",
              boxShadow:"0 0 0 2px #7dd3fc,0 0 22px 11px rgba(56,189,248,0.9),0 0 44px 18px rgba(14,165,233,0.5)",
              animation:"ep-fire-core 0.11s ease-in-out infinite" })} />
            <div style={S({ position:"absolute",width:90,height:90,borderRadius:"50%",
              background:"radial-gradient(circle,rgba(56,189,248,0.15) 0%,transparent 70%)",
              animation:"ep-fire-core 0.14s ease-in-out infinite" })} />
            <div style={S({ position:"absolute",width:90,height:90,borderRadius:"50%",
              border:"1px solid rgba(56,189,248,0.38)",
              animation:"ep-ring-burst 0.19s ease-out infinite" })} />
          </div>
        )

      // ── 🪨 TERRA — heavy, ground-splitting energy ────────────────────────
      case "terra": case "subterra": return (
        <div style={hub()}>
          {/* 9 radiating crack lines */}
          {[0,40,80,120,160,200,240,280,320].map(a => (
            <div key={a} style={S({ position:"absolute",width:"28px",height:"2.5px",
              background:`linear-gradient(to right,rgba(180,83,9,0.9),rgba(217,119,6,0.5),transparent)`,
              borderRadius:"2px",transformOrigin:"left center",
              transform:`rotate(${a}deg) translateX(14px)`,opacity:.8,
              animation:`ep-terra-crack 0.14s ease-out ${(a/40)*12}ms forwards` })} />
          ))}
          {/* Rotating stone ring */}
          <div style={S({ position:"absolute",width:72,height:72,borderRadius:"50%",
            border:"2px solid #92400e",opacity:.65,
            animation:"ep-spin 0.35s linear infinite",filter:"blur(0.5px)",
            boxShadow:"0 0 12px 5px rgba(146,64,14,0.55)" })} />
          {/* Diamond core — rock shard shape */}
          <div style={S({ position:"absolute",width:26,height:26,borderRadius:"3px",
            transform:"rotate(45deg)",
            background:"radial-gradient(circle,#fbbf24 10%,#b45309 42%,#7c2d12 82%)",
            boxShadow:"0 0 0 3px #92400e,0 0 24px 12px rgba(180,83,9,0.95),0 0 48px 20px rgba(120,53,15,0.55)",
            animation:"ep-terra-pulse 0.12s ease-in-out infinite" })} />
          {/* Ground tremor rings */}
          <div style={S({ position:"absolute",width:88,height:88,borderRadius:"50%",
            border:"1px solid rgba(180,83,9,0.5)",
            animation:"ep-ring-burst 0.18s ease-out infinite" })} />
          <div style={S({ position:"absolute",width:88,height:88,borderRadius:"50%",
            border:"1px solid rgba(146,64,14,0.35)",
            animation:"ep-ring-burst 0.18s ease-out 0.09s infinite" })} />
          <div style={S({ position:"absolute",width:92,height:92,borderRadius:"50%",
            background:"radial-gradient(circle,rgba(120,53,15,0.28) 0%,transparent 70%)",
            animation:"ep-terra-pulse 0.15s ease-in-out infinite" })} />
        </div>
      )

      // ── ✨ HAOS — radiant, divine, fast ─────────────────────────────────
      case "haos": case "light": case "lightness": return (
        <div style={hub(104,104)}>
          {/* 16 divine light rays — 3 sizes, alternating delays */}
          {[0,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,270,292.5,315,337.5].map((a,i) => (
            <div key={a} style={S({ position:"absolute",width:"2px",
              height: i%4===0 ? "28px" : i%2===0 ? "19px" : "13px",
              background:"linear-gradient(to top,transparent,rgba(254,249,195,0.8),white)",
              borderRadius:"9999px",
              transformOrigin:"50% 100%",
              transform:`rotate(${a}deg) translateY(-${i%4===0?24:i%2===0?16:11}px)`,
              opacity: i%4===0 ? 1 : i%2===0 ? 0.72 : 0.48,
              animation:`ep-haos-ray 0.11s ease-in-out ${i%3===0?0:i%3===1?36:72}ms infinite` })} />
          ))}
          {/* Blazing core */}
          <div style={S({ position:"absolute",width:30,height:30,borderRadius:"50%",
            background:"white",
            boxShadow:"0 0 0 5px #fef08a,0 0 0 10px rgba(253,224,71,0.45),0 0 48px 22px rgba(254,240,138,1),0 0 80px 32px rgba(253,224,71,0.45)",
            animation:"ep-fire-core 0.08s ease-in-out infinite" })} />
          <div style={S({ position:"absolute",width:96,height:96,borderRadius:"50%",
            background:"radial-gradient(circle,rgba(254,240,138,0.38) 0%,transparent 65%)",
            animation:"ep-haos-halo 0.1s ease-in-out infinite" })} />
          <div style={S({ position:"absolute",width:100,height:100,borderRadius:"50%",
            border:"1px solid rgba(254,240,138,0.48)",
            animation:"ep-ring-burst 0.13s ease-out infinite" })} />
        </div>
      )

      // ── 🌑 DARKUS — slow, oppressive, void-consuming ────────────────────
      case "darkus": case "darkness": case "dark": return (
        <div style={hub()}>
          {/* Outer void ring slowly collapsing inward */}
          <div style={S({ position:"absolute",width:90,height:90,borderRadius:"50%",
            border:"2px solid #7e22ce",opacity:.82,
            animation:"ep-dark-consume 0.22s ease-in infinite",
            boxShadow:"0 0 20px 8px rgba(88,28,135,0.75)" })} />
          <div style={S({ position:"absolute",width:68,height:68,borderRadius:"50%",
            border:"2px solid #a855f7",opacity:.65,
            animation:"ep-spin 0.28s linear reverse infinite",
            boxShadow:"0 0 12px 5px rgba(168,85,247,0.6)" })} />
          <div style={S({ position:"absolute",width:48,height:48,borderRadius:"50%",
            border:"1px solid #c084fc",opacity:.5,
            animation:"ep-spin 0.2s linear infinite" })} />
          {/* 7 shadow tendrils */}
          {[0,51,103,154,206,257,308].map(a => (
            <div key={a} style={S({ position:"absolute",width:"24px",height:"2px",
              background:`linear-gradient(to right,rgba(88,28,135,0.9),transparent)`,
              borderRadius:"9999px",transformOrigin:"left center",
              transform:`rotate(${a}deg) translateX(10px)`,opacity:.78,
              animation:`ep-dark-tendril 0.2s ease-in-out ${a/308*80}ms infinite` })} />
          ))}
          {/* Singularity core — absolute black center */}
          <div style={S({ position:"absolute",width:20,height:20,borderRadius:"50%",
            background:"radial-gradient(circle,#0f0a1e 20%,black 60%)",
            boxShadow:"0 0 0 3px #581c87,0 0 0 7px rgba(88,28,135,0.5),0 0 34px 16px rgba(88,28,135,1),0 0 68px 28px rgba(88,28,135,0.55)" })} />
          <div style={S({ position:"absolute",width:92,height:92,borderRadius:"50%",
            background:"radial-gradient(circle,rgba(88,28,135,0.42) 0%,transparent 70%)",
            animation:"ep-dark-consume 0.14s ease-in infinite" })} />
        </div>
      )

      // ── 🌿 VENTUS / ULLER ────────────────────────────────────────────────
      case "ventus": case "wind":
        if (isUller) return (
          // Uller: arrow tip forming — energy lines converging
          <div style={hub()}>
            {[0,36,72,108,144,180,216,252,288,324].map(a => (
              <div key={a} style={S({ position:"absolute",width:"24px",height:"2px",
                background:`linear-gradient(to right,rgba(52,211,153,0),#6ee7b7)`,
                borderRadius:"9999px",transformOrigin:"left center",
                transform:`rotate(${a}deg) translateX(12px)`,opacity:.8,
                animation:`ep-vent-gather 0.17s ease-in ${(a/36)*10}ms forwards` })} />
            ))}
            <div style={S({ position:"absolute",width:20,height:20,borderRadius:"50%",
              background:"radial-gradient(circle,white 16%,#6ee7b7 52%,#059669 88%)",
              boxShadow:"0 0 0 2px #34d399,0 0 24px 12px rgba(52,211,153,0.95),0 0 48px 20px rgba(16,185,129,0.55)",
              animation:"ep-fire-core 0.1s ease-in-out infinite" })} />
            <div style={S({ position:"absolute",width:82,height:82,borderRadius:"50%",
              border:"1px solid rgba(52,211,153,0.55)",
              animation:"ep-ring-burst 0.15s ease-out infinite",opacity:.6 })} />
            <div style={S({ position:"absolute",width:90,height:90,borderRadius:"50%",
              background:"radial-gradient(circle,rgba(52,211,153,0.2) 0%,transparent 70%)",
              animation:"ep-fire-core 0.12s ease-in-out infinite" })} />
          </div>
        )
        // Regular Ventus: dual counter-rotating vortex
        return (
          <div style={hub()}>
            <div style={S({ position:"absolute",width:84,height:84,borderRadius:"50%",
              border:"2px solid #34d399",opacity:.76,
              animation:"ep-spin 0.26s linear infinite",
              boxShadow:"0 0 14px 5px rgba(52,211,153,0.58)" })} />
            <div style={S({ position:"absolute",width:62,height:62,borderRadius:"50%",
              border:"2px solid #6ee7b7",opacity:.62,
              animation:"ep-spin 0.2s linear reverse infinite",
              boxShadow:"0 0 10px 4px rgba(110,231,183,0.5)" })} />
            <div style={S({ position:"absolute",width:42,height:42,borderRadius:"50%",
              border:"1px solid #a7f3d0",opacity:.45,
              animation:"ep-spin 0.14s linear infinite" })} />
            <div style={S({ position:"absolute",width:20,height:20,borderRadius:"50%",
              background:"radial-gradient(circle,white 16%,#6ee7b7 52%,#059669 88%)",
              boxShadow:"0 0 0 2px #34d399,0 0 22px 11px rgba(110,231,183,0.95),0 0 44px 18px rgba(5,150,105,0.5)",
              animation:"ep-fire-core 0.1s ease-in-out infinite" })} />
            <div style={S({ position:"absolute",width:90,height:90,borderRadius:"50%",
              background:"radial-gradient(circle,rgba(110,231,183,0.18) 0%,transparent 70%)",
              animation:"ep-fire-core 0.12s ease-in-out infinite" })} />
            <div style={S({ position:"absolute",width:90,height:90,borderRadius:"50%",
              border:"1px solid rgba(52,211,153,0.38)",
              animation:"ep-ring-burst 0.17s ease-out infinite" })} />
          </div>
        )

      // ── ⚪ VOID — fast, disorienting, silver energy ───────────────────────
      case "void": return (
        <div style={hub()}>
          {/* 3 silver rings at different speeds — creates sense of chaos */}
          <div style={S({ position:"absolute",width:90,height:90,borderRadius:"50%",
            border:"1.5px solid rgba(203,213,225,0.8)",opacity:.68,
            animation:"ep-spin 0.55s linear infinite",
            boxShadow:"0 0 16px 6px rgba(203,213,225,0.5)" })} />
          <div style={S({ position:"absolute",width:68,height:68,borderRadius:"50%",
            border:"1.5px solid rgba(226,232,240,0.7)",opacity:.56,
            animation:"ep-spin 0.38s linear reverse infinite",
            boxShadow:"0 0 10px 4px rgba(226,232,240,0.4)" })} />
          <div style={S({ position:"absolute",width:48,height:48,borderRadius:"50%",
            border:"1px solid white",opacity:.45,
            animation:"ep-spin 0.24s linear infinite" })} />
          {/* Void core — crisp white */}
          <div style={S({ position:"absolute",width:22,height:22,borderRadius:"50%",
            background:"radial-gradient(circle,white 14%,#e2e8f0 44%,#94a3b8 80%)",
            boxShadow:"0 0 0 3px #cbd5e1,0 0 0 6px rgba(148,163,184,0.5),0 0 32px 16px rgba(203,213,225,1),0 0 60px 24px rgba(148,163,184,0.5)",
            animation:"ep-fire-core 0.1s ease-in-out infinite" })} />
          {/* Ripple outward bursts */}
          <div style={S({ position:"absolute",width:92,height:92,borderRadius:"50%",
            border:"1px solid rgba(203,213,225,0.4)",
            animation:"ep-ring-burst 0.17s ease-out infinite" })} />
          <div style={S({ position:"absolute",width:92,height:92,borderRadius:"50%",
            border:"1px solid rgba(203,213,225,0.25)",
            animation:"ep-ring-burst 0.17s ease-out 0.085s infinite" })} />
          <div style={S({ position:"absolute",width:96,height:96,borderRadius:"50%",
            background:"radial-gradient(circle,rgba(203,213,225,0.26) 0%,transparent 70%)",
            animation:"ep-fire-core 0.12s ease-in-out infinite" })} />
        </div>
      )

      default: return (
        <div style={hub(80,80)}>
          <div style={S({ position:"absolute",width:24,height:24,borderRadius:"50%",
            background:"white",boxShadow:"0 0 28px 14px rgba(255,255,255,0.8)",
            animation:"ep-fire-core 0.1s ease-in-out infinite" })} />
        </div>
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TRAVEL  — projectile personality
  // ══════════════════════════════════════════════════════════════════════════
  const Travel = () => {
    // Default travel easing: fast acceleration, smooth decel
    const mv: React.CSSProperties = { animation:`ep-move ${TRAVEL}ms cubic-bezier(0.08,0,0.06,1) forwards` }

    switch (el) {

      // ── 🔥 FIRE — fireball with organic flame trail ──────────────────────
      case "pyrus": case "fire": return (
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv }}>
          {/* Long degradé tail — 3 layers for depth */}
          <div style={S({ position:"absolute",width:"135px",height:"9px",
            background:"linear-gradient(to right,transparent,rgba(127,29,29,0.35),rgba(220,38,38,0.65),#f97316,rgba(251,146,60,0.7))",
            borderRadius:"9999px",filter:"blur(2px)",opacity:.88 })} />
          <div style={S({ position:"absolute",width:"95px",height:"5px",
            background:"linear-gradient(to right,transparent,#fbbf24,rgba(251,191,36,0.5))",
            top:"-6px",left:"20px",borderRadius:"9999px",filter:"blur(1px)",opacity:.65 })} />
          <div style={S({ position:"absolute",width:"65px",height:"4px",
            background:"linear-gradient(to right,transparent,rgba(251,146,60,0.45))",
            top:"7px",left:"38px",borderRadius:"9999px",filter:"blur(1px)",opacity:.5 })} />
          {/* Floating ember */}
          <div style={S({ position:"absolute",width:"9px",height:"9px",borderRadius:"50%",
            background:"radial-gradient(circle,white,#fbbf24)",
            boxShadow:"0 0 7px 3px rgba(251,191,36,0.9)",
            left:"65px",top:"-8px",opacity:.7 })} />
          {/* Core fireball */}
          <div style={S({ width:"30px",height:"30px",flexShrink:0,borderRadius:"50%",
            background:"radial-gradient(circle,white 7%,#fb923c 35%,#dc2626 68%,#7f1d1d 100%)",
            boxShadow:"0 0 0 3px rgba(249,115,22,0.6),0 0 20px 9px rgba(251,146,60,1),0 0 40px 16px rgba(220,38,38,0.6)" })} />
          {/* Leading white flare */}
          <div style={S({ position:"absolute",width:"11px",height:"11px",right:"-4px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 12px 6px rgba(255,255,255,1)" })} />
        </div>
      )

      // ── 💧 AQUOS (Fehnon) — multi-layer holographic laceration ──────────
      case "aquos": case "aquo": case "water":
        if (isFehnon) return (
          <div style={{ position:"absolute",left:0,top:"50%",marginTop:"-4px" }}>
            {/* Main beam */}
            <div style={S({ width:`${dist}px`,height:"7px",
              background:"linear-gradient(to right,rgba(14,165,233,0) 0%,rgba(56,189,248,0.5) 10%,white 46%,rgba(125,211,252,0.88) 72%,rgba(56,189,248,0.28) 92%,transparent 100%)",
              borderRadius:"9999px",
              boxShadow:"0 0 18px 8px rgba(56,189,248,0.9),0 0 36px 14px rgba(14,165,233,0.55),0 0 60px 24px rgba(56,189,248,0.22)",
              animation:`ep-slash-reveal ${TRAVEL}ms cubic-bezier(0.03,0,0.07,1) forwards` })} />
            {/* Secondary slash +offset */}
            <div style={S({ width:`${dist*.82}px`,height:"3px",
              background:"linear-gradient(to right,transparent,rgba(125,211,252,0.7) 16%,rgba(255,255,255,0.92) 50%,rgba(186,230,253,0.6) 82%,transparent)",
              borderRadius:"9999px",position:"absolute",top:"-12px",
              left:`${dist*.055}px`,
              boxShadow:"0 0 9px 3px rgba(56,189,248,0.7)",
              animation:`ep-slash-reveal ${TRAVEL}ms cubic-bezier(0.03,0,0.07,1) 18ms forwards` })} />
            {/* Third slash -offset */}
            <div style={S({ width:`${dist*.62}px`,height:"2px",
              background:"linear-gradient(to right,transparent,rgba(186,230,253,0.65) 22%,rgba(255,255,255,0.78) 55%,transparent)",
              borderRadius:"9999px",position:"absolute",top:"11px",
              left:`${dist*.12}px`,
              boxShadow:"0 0 6px 2px rgba(56,189,248,0.55)",
              animation:`ep-slash-reveal ${TRAVEL}ms cubic-bezier(0.03,0,0.07,1) 33ms forwards` })} />
            {/* Holo micro-edges */}
            <div style={S({ width:`${dist*.4}px`,height:"1px",
              background:"linear-gradient(to right,transparent,rgba(224,242,254,0.55),transparent)",
              position:"absolute",top:"-22px",left:`${dist*.18}px`,
              animation:`ep-slash-reveal ${TRAVEL}ms cubic-bezier(0.03,0,0.07,1) 48ms forwards` })} />
            <div style={S({ width:`${dist*.32}px`,height:"1px",
              background:"linear-gradient(to right,transparent,rgba(224,242,254,0.45),transparent)",
              position:"absolute",top:"20px",left:`${dist*.24}px`,
              animation:`ep-slash-reveal ${TRAVEL}ms cubic-bezier(0.03,0,0.07,1) 56ms forwards` })} />
            {/* Tip tracking orb */}
            <div style={S({ position:"absolute",width:"24px",height:"24px",borderRadius:"50%",
              right:"-3px",top:"-10px",
              background:"radial-gradient(circle,white 16%,#7dd3fc 50%,#0ea5e9 88%)",
              boxShadow:"0 0 26px 13px rgba(56,189,248,1),0 0 54px 22px rgba(14,165,233,0.7)",
              animation:`ep-fehnon-tip ${TRAVEL}ms cubic-bezier(0.03,0,0.07,1) forwards` })} />
            {/* Oval holo ripple at leading edge */}
            <div style={S({ position:"absolute",width:"16px",height:"42px",borderRadius:"50%",
              right:"-4px",top:"-19px",
              border:"2px solid rgba(56,189,248,0.75)",
              boxShadow:"0 0 12px 4px rgba(56,189,248,0.65)",
              animation:`ep-ring-burst 0.22s ease-out forwards` })} />
          </div>
        )
        // Normal Aquos — water torpedo
        return (
          <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv }}>
            <div style={S({ position:"absolute",width:"105px",height:"5px",
              background:"linear-gradient(to right,transparent,rgba(14,165,233,0.42),#0ea5e9,#38bdf8)",
              borderRadius:"9999px",filter:"blur(2px)",opacity:.82 })} />
            {[58,75,89].map((x,i) => (
              <div key={i} style={S({ position:"absolute",width:`${9-i*2}px`,height:`${9-i*2}px`,
                borderRadius:"50%",
                border:`1px solid rgba(125,211,252,${0.62-i*0.14})`,
                left:`${x}px`,top:`${i%2===0?-5:4}px`,opacity:.56 })} />
            ))}
            <div style={S({ width:"28px",height:"28px",flexShrink:0,borderRadius:"50%",
              background:"radial-gradient(circle,white 9%,#38bdf8 44%,#0284c7 84%)",
              boxShadow:"0 0 0 2px #7dd3fc,0 0 18px 9px rgba(56,189,248,0.95),0 0 36px 14px rgba(14,165,233,0.5)" })} />
          </div>
        )

      // ── 🪨 TERRA — heavy boulder, rock debris ────────────────────────────
      case "terra": case "subterra": return (
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",
          // Heavier cubic-bezier — slow start, hard stop
          animation:`ep-move ${TRAVEL}ms cubic-bezier(0.22,0,0.06,1) forwards` }}>
          <div style={S({ position:"absolute",width:"90px",height:"10px",
            background:"linear-gradient(to right,transparent,rgba(120,53,15,0.45),#92400e,#b45309)",
            borderRadius:"4px",filter:"blur(2.5px)",opacity:.82 })} />
          {/* Rock chunks in wake */}
          {[0,1,2,3].map(i => (
            <div key={i} style={S({ position:"absolute",
              width:`${7-i}px`,height:`${7-i}px`,
              background:"#92400e",borderRadius:"2px",
              transform:`rotate(${i*22}deg)`,
              left:`${20+i*17}px`,top:`${i%2===0?-6:5}px`,
              opacity:.72-i*.12 })} />
          ))}
          {/* Spinning boulder */}
          <div style={S({ width:"30px",height:"30px",flexShrink:0,borderRadius:"4px",
            transform:"rotate(40deg)",
            background:"radial-gradient(circle,#d97706 16%,#92400e 50%,#451a03 88%)",
            boxShadow:"0 0 0 2px #7c2d12,0 0 16px 7px rgba(146,64,14,0.95),0 0 32px 12px rgba(120,53,15,0.5)" })} />
        </div>
      )

      // ── ✨ HAOS — instant laser, divine and fast ─────────────────────────
      case "haos": case "light": case "lightness": return (
        <div style={{ position:"absolute",left:0,top:"50%",marginTop:"-4px" }}>
          {/* Main laser — instant reveal */}
          <div style={S({ width:`${dist}px`,height:"7px",
            background:"linear-gradient(to right,rgba(254,240,138,0) 0%,rgba(253,224,71,0.55) 14%,white 48%,rgba(254,249,195,0.88) 78%,rgba(254,240,138,0) 100%)",
            borderRadius:"9999px",
            boxShadow:"0 0 14px 6px rgba(254,240,138,0.95),0 0 30px 12px rgba(253,224,71,0.6),0 0 55px 22px rgba(254,240,138,0.28)",
            animation:`ep-laser ${TRAVEL}ms ease-out forwards` })} />
          {/* Sub-laser */}
          <div style={S({ width:`${dist*.88}px`,height:"3px",
            background:"linear-gradient(to right,transparent,rgba(254,249,195,0.62) 18%,white 52%,transparent)",
            borderRadius:"9999px",position:"absolute",top:"-7px",
            left:`${dist*.04}px`,
            boxShadow:"0 0 7px 2px rgba(254,240,138,0.72)",
            animation:`ep-laser ${TRAVEL}ms ease-out 14ms forwards` })} />
          {/* Tip burst */}
          <div style={S({ position:"absolute",right:0,top:"-11px",width:"26px",height:"26px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 24px 12px rgba(254,240,138,1),0 0 50px 22px rgba(253,224,71,0.7)" })} />
        </div>
      )

      // ── 🌑 DARKUS — slow heavy dark blade ────────────────────────────────
      case "darkus": case "darkness": case "dark": return (
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",
          // Very heavy easing — maximum slow start = weight
          animation:`ep-move ${TRAVEL}ms cubic-bezier(0.4,0,0.06,1) forwards` }}>
          <div style={S({ position:"absolute",width:"125px",height:"5px",
            background:"linear-gradient(to right,transparent,rgba(88,28,135,0.38),#7e22ce,#a855f7)",
            borderRadius:"9999px",filter:"blur(1.5px)",opacity:.87 })} />
          {/* Shadow tendrils */}
          <div style={S({ position:"absolute",width:"58px",height:"2px",
            background:"linear-gradient(to right,transparent,rgba(76,29,149,0.55))",
            borderRadius:"9999px",top:"-8px",left:"42px" })} />
          <div style={S({ position:"absolute",width:"46px",height:"2px",
            background:"linear-gradient(to right,transparent,rgba(76,29,149,0.45))",
            borderRadius:"9999px",top:"8px",left:"58px" })} />
          <div style={S({ position:"absolute",width:"32px",height:"1px",
            background:"linear-gradient(to right,transparent,rgba(167,139,250,0.4))",
            borderRadius:"9999px",top:"-14px",left:"74px" })} />
          {/* Dark blade — tall thin rectangle */}
          <div style={S({ width:"11px",height:"36px",flexShrink:0,borderRadius:"3px",
            background:"linear-gradient(to bottom,#c084fc 0%,#581c87 38%,black 68%,#581c87 100%)",
            boxShadow:"0 0 0 1px rgba(88,28,135,0.8),0 0 16px 8px rgba(88,28,135,0.95),0 0 36px 16px rgba(88,28,135,0.5)" })} />
        </div>
      )

      // ── 🌿 VENTUS / ULLER ────────────────────────────────────────────────
      case "ventus": case "wind":
        if (isUller) return (
          // Uller: precision arrow with wind trail
          <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv }}>
            {/* Arrow shaft */}
            <div style={S({ position:"absolute",
              width:`${Math.max(dist*.55,72)}px`,height:"3px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.5),#34d399)",
              borderRadius:"9999px",
              boxShadow:"0 0 5px 2px rgba(52,211,153,0.5)" })} />
            {/* Fletching — two angled feathers */}
            <div style={S({ position:"absolute",width:"20px",height:"2.5px",
              background:"rgba(110,231,183,0.72)",borderRadius:"9999px",
              left:"5px",top:"-5px",transformOrigin:"left center",transform:"rotate(-28deg)" })} />
            <div style={S({ position:"absolute",width:"20px",height:"2.5px",
              background:"rgba(110,231,183,0.72)",borderRadius:"9999px",
              left:"5px",top:"4px",transformOrigin:"left center",transform:"rotate(28deg)" })} />
            {/* Arrowhead */}
            <div style={S({ width:0,height:0,flexShrink:0,
              borderTop:"11px solid transparent",borderBottom:"11px solid transparent",
              borderLeft:"24px solid #34d399",
              filter:"drop-shadow(0 0 8px rgba(52,211,153,0.95)) drop-shadow(0 0 18px rgba(16,185,129,0.6))" })} />
            {/* Tip spark */}
            <div style={S({ position:"absolute",right:"-6px",width:"10px",height:"10px",
              background:"white",borderRadius:"50%",
              boxShadow:"0 0 12px 6px rgba(52,211,153,1)" })} />
          </div>
        )
        // Regular Ventus: whirlwind tornado slice
        return (
          <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv }}>
            {/* Wind funnel trail */}
            <div style={S({ position:"absolute",width:"105px",height:"24px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.1),rgba(110,231,183,0.24))",
              top:"-12px",borderRadius:"0 50% 50% 0",filter:"blur(4px)",opacity:.72 })} />
            <div style={S({ position:"absolute",width:"72px",height:"34px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.16))",
              top:"-17px",left:"14px",borderRadius:"0 50% 50% 0",filter:"blur(3px)",opacity:.55 })} />
            {/* Spinning vortex core */}
            <div style={S({ width:"28px",height:"38px",flexShrink:0,borderRadius:"50%",
              border:"3px solid #34d399",
              boxShadow:"0 0 14px 6px rgba(52,211,153,0.88),0 0 30px 12px rgba(16,185,129,0.45)",
              animation:"ep-spin 0.12s linear infinite",filter:"blur(0.5px)" })} />
            <div style={S({ position:"absolute",right:"3px",width:"17px",height:"26px",
              borderRadius:"50%",border:"2px solid #6ee7b7",opacity:.62,
              animation:"ep-spin 0.09s linear reverse infinite" })} />
          </div>
        )

      // ── ⚪ VOID — fast silver rift ────────────────────────────────────────
      case "void": return (
        <div style={{ position:"absolute",left:0,top:"50%",marginTop:"-3px",
          // Fast: minimal easing, near instant
          animation:`ep-move ${TRAVEL}ms cubic-bezier(0.05,0,0.05,1) forwards` }}>
          {/* Silver rift streak */}
          <div style={S({ position:"absolute",
            width:`${Math.min(dist*.65,118)}px`,height:"3px",
            background:"linear-gradient(to right,transparent,rgba(203,213,225,0.4),rgba(255,255,255,0.95))",
            borderRadius:"9999px",
            boxShadow:"0 0 6px 2px rgba(203,213,225,0.7)",
            animation:`ep-laser ${TRAVEL}ms ease-out forwards` })} />
          {/* Distortion ripples along path */}
          {[32,52,70].map((x,i) => (
            <div key={i} style={S({ position:"absolute",
              width:`${13-i*3}px`,height:`${13-i*3}px`,borderRadius:"50%",
              border:"1px solid rgba(203,213,225,0.52)",
              left:`${x}%`,top:`${-6+i*2}px`,opacity:.5 })} />
          ))}
          {/* Void orb */}
          <div style={S({ position:"absolute",right:0,top:"-11px",width:"26px",height:"26px",
            background:"radial-gradient(circle,white 16%,#e2e8f0 50%,#94a3b8 88%)",
            borderRadius:"50%",
            boxShadow:"0 0 18px 9px rgba(203,213,225,0.95),0 0 40px 16px rgba(148,163,184,0.55)" })} />
        </div>
      )

      default: return (
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv }}>
          <div style={S({ position:"absolute",width:"72px",height:"4px",
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.88))",
            borderRadius:"9999px",filter:"blur(1px)" })} />
          <div style={S({ width:"22px",height:"22px",flexShrink:0,borderRadius:"50%",
            background:"white",boxShadow:"0 0 16px 8px rgba(255,255,255,0.78)" })} />
        </div>
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  IMPACT  — cinematic conclusion
  // ══════════════════════════════════════════════════════════════════════════
  const Impact = () => {
    type C = { r1:string;r2:string;r3:string;core:string;cg:string;gw:string;pc:string[];flash:string }

    const resolveEl = (e:string): string => {
      const m:{[k:string]:string}={fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",
        light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus"}
      const base = m[e]??e
      if(base==="aquos"&&isFehnon) return "aquos_fehnon"
      if(base==="ventus"&&isUller) return "ventus_uller"
      return base
    }

    const cfgs:Record<string,C> = {
      pyrus:       {r1:"#f97316",r2:"#fbbf24",r3:"#ef4444",
        core:"radial-gradient(circle,white 5%,#fb923c 28%,#dc2626 58%,#7f1d1d 88%)",
        cg:"rgba(249,115,22,0.95)",gw:"rgba(220,38,38,0.52)",
        pc:["#7f1d1d","#991b1b","#dc2626","#ea580c","#f97316","#fb923c","#fbbf24","#fef3c7","white"],
        flash:"rgba(255,110,0,0.26)"},

      aquos:       {r1:"#38bdf8",r2:"#7dd3fc",r3:"#0ea5e9",
        core:"radial-gradient(circle,white 5%,#38bdf8 32%,#0284c7 65%,#0c4a6e 90%)",
        cg:"rgba(56,189,248,0.9)",gw:"rgba(14,165,233,0.42)",
        pc:["#082f49","#0c4a6e","#0284c7","#0ea5e9","#38bdf8","#7dd3fc","#bae6fd","white"],
        flash:"rgba(56,189,248,0.22)"},

      aquos_fehnon:{r1:"#38bdf8",r2:"white",r3:"#7dd3fc",
        core:"radial-gradient(circle,white 7%,#bae6fd 24%,#38bdf8 48%,#0284c7 74%,#075985 93%)",
        cg:"rgba(56,189,248,1)",gw:"rgba(14,165,233,0.68)",
        pc:["white","#f0f9ff","#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9"],
        flash:"rgba(56,189,248,0.38)"},

      terra:       {r1:"#b45309",r2:"#d97706",r3:"#92400e",
        core:"radial-gradient(circle,#fbbf24 5%,#b45309 32%,#7c2d12 62%,#431407 90%)",
        cg:"rgba(180,83,9,0.95)",gw:"rgba(120,53,15,0.52)",
        pc:["#1c0a04","#431407","#7c2d12","#92400e","#b45309","#d97706","#fbbf24"],
        flash:"rgba(120,53,15,0.3)"},

      haos:        {r1:"#fde047",r2:"white",r3:"#fef08a",
        core:"radial-gradient(circle,white 9%,#fef9c3 30%,#fef08a 56%,#fde047 80%)",
        cg:"rgba(254,240,138,1)",gw:"rgba(253,224,71,0.62)",
        pc:["white","#fefce8","#fef9c3","#fef08a","#fde047","#fbbf24","#f59e0b"],
        flash:"rgba(255,255,170,0.38)"},

      darkus:      {r1:"#7e22ce",r2:"#a855f7",r3:"#4c1d95",
        core:"radial-gradient(circle,#e879f9 5%,#a855f7 28%,#7e22ce 52%,#1e1b4b 80%,#0f0a1e 95%)",
        cg:"rgba(88,28,135,0.98)",gw:"rgba(88,28,135,0.62)",
        pc:["#030712","#0f0a1e","#1e1b4b","#4c1d95","#7e22ce","#a855f7","#c084fc","#e879f9"],
        flash:"rgba(88,28,135,0.28)"},

      ventus:      {r1:"#34d399",r2:"#6ee7b7",r3:"#059669",
        core:"radial-gradient(circle,white 5%,#6ee7b7 30%,#10b981 58%,#064e3b 88%)",
        cg:"rgba(52,211,153,0.95)",gw:"rgba(5,150,105,0.47)",
        pc:["#022c22","#064e3b","#059669","#34d399","#6ee7b7","#a7f3d0","white"],
        flash:"rgba(52,211,153,0.22)"},

      ventus_uller:{r1:"#34d399",r2:"white",r3:"#a7f3d0",
        core:"radial-gradient(circle,white 9%,#a7f3d0 28%,#34d399 52%,#059669 78%)",
        cg:"rgba(52,211,153,1)",gw:"rgba(16,185,129,0.52)",
        pc:["white","#f0fdf4","#dcfce7","#a7f3d0","#6ee7b7","#34d399","#10b981"],
        flash:"rgba(52,211,153,0.28)"},

      void:        {r1:"#cbd5e1",r2:"white",r3:"#94a3b8",
        core:"radial-gradient(circle,white 9%,#f1f5f9 28%,#e2e8f0 50%,#94a3b8 76%)",
        cg:"rgba(203,213,225,1)",gw:"rgba(148,163,184,0.52)",
        pc:["white","#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8","#64748b"],
        flash:"rgba(203,213,225,0.28)"},
    }

    const c     = cfgs[resolveEl(el)] ?? cfgs.void
    const iBase = angleR + Math.PI
    const isTerra  = el==="terra"||el==="subterra"
    const isFehImp = isFehnon&&(el==="aquos"||el==="aquo"||el==="water")

    // Ring sizes and timings — 4 rings for all elements
    const rings = [
      {s:144,bw:3,del:0,   op:1   },
      {s:112,bw:2,del:30,  op:.62 },
      {s:82, bw:2,del:58,  op:.42 },
      {s:58, bw:1,del:0,   op:.28 },
    ]

    return (
      <div style={{ position:"absolute",left:0,top:0,width:0,height:0,
        transform:`rotate(${-angleD}deg)` }}>

        {/* ── Flash — brief, element-colored ── */}
        <div style={S({ position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",
          background:c.flash,animation:"ep-flash 0.14s linear forwards",pointerEvents:"none" })} />

        {/* ── Shockwave rings ── */}
        {rings.map(({s,bw,del,op},i) => (
          <div key={i} style={S({ position:"absolute",
            left:`-${s/2}px`,top:`-${s/2}px`,width:s,height:s,
            borderRadius:"50%",
            border:`${bw}px solid ${i===1?c.r2:i===2?c.r3:c.r1}`,
            boxShadow: i===0 ? `0 0 22px 8px ${c.cg}` : undefined,
            opacity:op,
            animation:`ep-ring-expand ${IMPACT}ms ${i===3?"cubic-bezier(0.1,0,0.2,1)":"ease-out"} ${del}ms forwards` })} />
        ))}

        {/* ── Core burst — 3-stage life ── */}
        <div style={S({ position:"absolute",left:"-58px",top:"-58px",width:"116px",height:"116px",
          borderRadius:"50%",background:c.core,
          boxShadow:`0 0 56px 24px ${c.cg},0 0 110px 44px ${c.gw}`,
          animation:`ep-core ${IMPACT}ms cubic-bezier(0.05,0.88,0.12,1) forwards` })} />

        {/* ── FEHNON: laceration scars ── */}
        {isFehImp && [
          {w:136,rot:0,   top:-3, del:0 },{w:104,rot:-20,top:-3,del:10},
          {w:104,rot:20,  top:-3, del:10},{w:76, rot:-40,top:-2,del:22},
          {w:76, rot:40,  top:-2, del:22},{w:52, rot:-60,top:-1,del:34},
          {w:52, rot:60,  top:-1, del:34},{w:34, rot:-78,top:0, del:46},
          {w:34, rot:78,  top:0,  del:46},
        ].map((s,i) => (
          <div key={i} style={S({ position:"absolute",height:"2.5px",width:`${s.w}px`,
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.94),rgba(125,211,252,0.76),transparent)",
            borderRadius:"9999px",top:`${s.top}px`,left:0,
            transform:`rotate(${s.rot}deg)`,transformOrigin:"left center",
            boxShadow:"0 0 8px 2px rgba(56,189,248,0.78)",
            animation:`ep-slash-reveal ${IMPACT*.66}ms cubic-bezier(0,0,0.15,1) ${s.del}ms forwards` })} />
        ))}
        {isFehImp && [-19,-11,-4,3,10,17].map((y,i) => (
          <div key={`sc${i}`} style={S({ position:"absolute",height:"1px",
            width:`${86-Math.abs(y)*2}px`,
            background:`linear-gradient(to right,transparent,rgba(186,230,253,${.46+Math.abs(i-2.5)*.08}),transparent)`,
            borderRadius:"9999px",top:`${y}px`,left:"50%",transform:"translateX(-50%)",
            animation:`ep-slash-reveal ${IMPACT*.5}ms ease-out ${i*10}ms forwards` })} />
        ))}

        {/* ── Particles ── */}
        {parts.map(p => {
          const a   = iBase + p.angle * .84
          const d   = p.speed * p.life
          const px  = Math.cos(a)*d
          const py  = Math.sin(a)*d
          const col = c.pc[p.id % c.pc.length]
          const rot = isFehImp ? Math.atan2(py,px)*180/Math.PI : 0
          return (
            <div key={p.id} style={S({
              position:"absolute",
              width:`${p.size}px`,
              height:`${isFehImp?p.size*.36:isTerra?p.size*.65:p.size}px`,
              borderRadius: isTerra||isFehImp ? "2px" : "50%",
              background:col,
              boxShadow:`0 0 5px 2px ${col}92`,
              transform: rot ? `rotate(${rot}deg)` : undefined,
              animation:`ep-particle ${IMPACT}ms cubic-bezier(0.02,0.52,0.14,1) ${p.delay}ms forwards`,
              "--px":`${px}px`,"--py":`${py}px`,opacity:0,
            } as React.CSSProperties)} />
          )
        })}
      </div>
    )
  }

  let content: React.ReactNode = null
  if(phase==="charge") content = <Charge />
  else if(phase==="travel") content = <Travel />
  else if(phase==="impact") content = <Impact />

  const output = (
    <>
      <style>{`
        /* ── Core animations ─────────────────────────────────────────── */
        @keyframes ep-fire-core   { 0%,100%{opacity:.74;transform:scale(1)}     50%{opacity:1;transform:scale(1.2)} }
        @keyframes ep-terra-pulse { 0%,100%{opacity:.72;transform:scale(1) rotate(45deg)} 50%{opacity:1;transform:scale(1.18) rotate(45deg)} }
        @keyframes ep-haos-halo   { 0%,100%{opacity:.64;transform:scale(1)}     50%{opacity:1;transform:scale(1.32)} }
        @keyframes ep-haos-ray    { 0%,100%{opacity:.6;transform-origin:50% 100%;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.35)} }
        @keyframes ep-ring-burst  { 0%{transform:scale(.28);opacity:1}          100%{transform:scale(1.72);opacity:0} }
        @keyframes ep-spin        { from{transform:rotate(0deg)}                to{transform:rotate(360deg)} }
        @keyframes ep-dark-consume{ 0%{transform:scale(1.42);opacity:.82}       100%{transform:scale(.52);opacity:.28} }
        @keyframes ep-dark-tendril{ 0%,100%{opacity:.62;transform-origin:left center;transform:scaleX(1)} 50%{opacity:1;transform:scaleX(1.35)} }
        @keyframes ep-vent-gather { 0%{opacity:0;transform-origin:left center;transform:translateX(14px) scaleX(0)} 100%{opacity:.8;transform:translateX(14px) scaleX(1)} }
        @keyframes ep-terra-crack { 0%{transform-origin:left center;transform:rotate(var(--r,0deg)) translateX(14px) scaleX(0);opacity:0} 100%{opacity:.8;transform:rotate(var(--r,0deg)) translateX(14px) scaleX(1)} }

        /* ── Travel ──────────────────────────────────────────────────── */
        @keyframes ep-move        { 0%{transform:translateX(0)}                 100%{transform:translateX(${dist}px)} }
        @keyframes ep-laser       { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 6%{opacity:1} 70%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes ep-slash-reveal{ 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 5%{opacity:1} 66%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes ep-fehnon-tip  { 0%{transform:translateX(${-dist}px);opacity:0} 6%{opacity:1} 100%{transform:translateX(0);opacity:1} }

        /* ── Impact ──────────────────────────────────────────────────── */
        @keyframes ep-flash       { 0%{opacity:1} 28%{opacity:.62} 100%{opacity:0} }
        @keyframes ep-ring-expand { 0%{transform:scale(.07);opacity:1;border-width:8px} 48%{opacity:.58} 100%{transform:scale(2.7);opacity:0;border-width:1px} }
        @keyframes ep-core        { 0%{transform:scale(.03);opacity:1} 18%{transform:scale(1.32);opacity:1} 50%{transform:scale(1.02);opacity:.74} 100%{transform:scale(0);opacity:0} }
        @keyframes ep-particle    { 0%{transform:translate(0,0) scale(1.8);opacity:1} 100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0} }

        /* ── Fehnon charge ───────────────────────────────────────────── */
        @keyframes ep-fehnon-contract { 0%{transform:scale(1.52);opacity:0} 52%{opacity:1} 100%{transform:scale(.22);opacity:0} }
        @keyframes ep-fehnon-scan     { 0%{opacity:0;transform:translateX(-50%) scaleX(0)} 42%{opacity:1} 100%{opacity:0;transform:translateX(-50%) scaleX(1)} }

        /* ── Afterimage ──────────────────────────────────────────────── */
        @keyframes afterimage-fade { 0%{opacity:.24} 100%{opacity:0} }
      `}</style>

      {/* Attacker afterimage */}
      {attackerImage && phase!=="impact" && (
        <div style={S({ position:"absolute",left:startX-40,top:startY-56,
          width:"80px",height:"112px",
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:.2,filter:"blur(2px)",
          animation:"afterimage-fade 200ms ease-out forwards",
          pointerEvents:"none",zIndex:5 })} />
      )}

      <div style={container} suppressHydrationWarning>{content}</div>
    </>
  )

  if(portalTarget) return createPortal(output, portalTarget)
  if(typeof document!=="undefined") return createPortal(output, document.body)
  return null
}
