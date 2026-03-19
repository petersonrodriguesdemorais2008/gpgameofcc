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

const CHARGE_DURATION = 150
const TRAVEL_DURATION = 350
const IMPACT_DURATION = 420
const TOTAL_DURATION = CHARGE_DURATION + TRAVEL_DURATION + IMPACT_DURATION

const rng = (min: number, max: number) => min + Math.random() * (max - min)

const generateParticles = (count: number, spread: number = 110) =>
  Array.from({ length: count }).map((_, i) => ({
    id: i,
    angle: (rng(-spread / 2, spread / 2)) * (Math.PI / 180),
    velocity: rng(38, 90),
    size: rng(3, 9),
    life: rng(0.5, 1),
    delay: rng(0, 75),
  }))

export function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY,
  element, attackerImage, attackerName,
  portalTarget, onImpact, onComplete,
}: AttackAnimationProps) {
  const [phase, setPhase] = useState<AnimPhase>("charge")
  const [mounted, setMounted] = useState(false)

  const distance = Math.hypot(targetX - startX, targetY - startY)
  const angleRad = Math.atan2(targetY - startY, targetX - startX)
  const angleDeg = angleRad * (180 / Math.PI)
  const el = element?.toLowerCase().trim() || "neutral"

  // Detect Uller for special Ventus variant
  const isUller = (attackerName || "").toLowerCase().includes("ullr") ||
                  (attackerName || "").toLowerCase().includes("uller")
  const isFehnon = (attackerName || "").toLowerCase().includes("fehnon")

  const particles = useMemo(() => {
    const counts: Record<string, number> = {
      pyrus:20, fire:20, aquos:16, aquo:16, water:16,
      terra:14, subterra:14, haos:22, light:22, lightness:22,
      darkus:18, darkness:18, dark:18, ventus:18, wind:18, void:20,
    }
    const spreads: Record<string, number> = {
      void:360, haos:150, light:150, lightness:150,
      ventus:130, wind:130,
    }
    return generateParticles(counts[el] ?? 14, spreads[el] ?? 110)
  }, [el])

  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    setMounted(true)
    const t1 = setTimeout(() => setPhase("travel"), CHARGE_DURATION)
    const t2 = setTimeout(() => {
      setPhase("impact")
      onImpact?.(id, targetX, targetY, el)
    }, CHARGE_DURATION + TRAVEL_DURATION)
    const t3 = setTimeout(() => onCompleteRef.current(id), TOTAL_DURATION)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [id])

  if (!mounted) return null

  const containerStyle: React.CSSProperties = phase === "impact"
    ? { position:"absolute", left:targetX, top:targetY, width:0, height:60, marginTop:-30, pointerEvents:"none", zIndex:10000, transformOrigin:"0 50%", transform:`rotate(${angleDeg}deg)` }
    : { position:"absolute", left:startX, top:startY, width:distance, height:60, marginTop:-30, pointerEvents:"none", zIndex:10000, transformOrigin:"0 50%", transform:`rotate(${angleDeg}deg)` }

  // ─── CHARGE ───────────────────────────────────────────────────────────────
  const renderCharge = () => {
    switch (el) {

      case "pyrus": case "fire": return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:88, height:88, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {/* Rotating fire ring */}
          <div style={{ position:"absolute", width:72, height:72, borderRadius:"50%", border:"3px solid #fb923c", animation:"ep-spin 0.25s linear infinite", filter:"blur(1px)", opacity:0.8 }} />
          <div style={{ position:"absolute", width:52, height:52, borderRadius:"50%", border:"2px solid #fbbf24", animation:"ep-spin 0.2s linear reverse infinite", opacity:0.6 }} />
          {/* Pulsing core */}
          <div style={{ position:"absolute", width:24, height:24, borderRadius:"50%", background:"radial-gradient(circle,white 20%,#fb923c 60%,#dc2626 100%)", boxShadow:"0 0 20px 10px rgba(251,146,60,0.9),0 0 40px 16px rgba(220,38,38,0.5)", animation:"ep-pulse 0.1s ease-in-out infinite" }} />
          {/* Heat distortion rings */}
          <div style={{ position:"absolute", width:80, height:80, borderRadius:"50%", border:"1px solid rgba(251,146,60,0.4)", animation:"ep-ring-out 0.18s ease-out infinite" }} />
          <div style={{ position:"absolute", width:80, height:80, borderRadius:"50%", border:"1px solid rgba(251,146,60,0.3)", animation:"ep-ring-out 0.18s ease-out 0.09s infinite" }} />
        </div>
      )

      case "aquos": case "aquo": case "water": return (
        isFehnon ? (
          // Fehnon charge: holographic blue energy coiling into a blade
          <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:88, height:88, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ position:"absolute", width:22, height:22, borderRadius:"2px", background:"radial-gradient(circle,white 15%,#38bdf8 50%,#0ea5e9 90%)", transform:"rotate(45deg)", boxShadow:"0 0 0 2px #7dd3fc,0 0 20px 10px rgba(56,189,248,0.95),0 0 40px 16px rgba(14,165,233,0.5)", animation:"ep-pulse 0.09s ease-in-out infinite" }} />
            {/* Holographic scan lines */}
            {[-18,-10,0,10,18].map((y,i) => (
              <div key={i} style={{ position:"absolute", width:`${50-Math.abs(y)*1.2}px`, height:"1.5px", background:`linear-gradient(to right,transparent,rgba(56,189,248,${0.4+i*0.08}),transparent)`, top:`calc(50% + ${y}px)`, left:"50%", transform:"translateX(-50%)", borderRadius:"9999px" }} />
            ))}
            <div style={{ position:"absolute", width:72, height:72, borderRadius:"50%", border:"1px solid rgba(56,189,248,0.4)", animation:"ep-spin 0.35s linear infinite", opacity:0.5 }} />
            <div style={{ position:"absolute", width:80, height:80, borderRadius:"50%", background:"radial-gradient(circle,rgba(56,189,248,0.18) 0%,transparent 70%)", animation:"ep-pulse 0.11s ease-in-out infinite" }} />
          </div>
        ) : (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:80, height:80, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ position:"absolute", width:64, height:64, borderRadius:"50%", border:"2px solid #38bdf8", animation:"ep-spin 0.4s linear infinite", opacity:0.7 }} />
          <div style={{ position:"absolute", width:46, height:46, borderRadius:"50%", border:"2px solid #7dd3fc", animation:"ep-spin 0.35s linear reverse infinite", opacity:0.5 }} />
          <div style={{ position:"absolute", width:18, height:18, borderRadius:"50%", background:"radial-gradient(circle,white 20%,#38bdf8 60%,#0284c7 100%)", boxShadow:"0 0 16px 8px rgba(56,189,248,0.9),0 0 32px 14px rgba(14,165,233,0.4)", animation:"ep-pulse 0.12s ease-in-out infinite" }} />
          <div style={{ position:"absolute", width:72, height:72, borderRadius:"50%", background:"radial-gradient(circle,rgba(56,189,248,0.2) 0%,transparent 70%)", animation:"ep-pulse 0.14s ease-in-out infinite" }} />
        </div>
        )
      )

      case "terra": case "subterra": return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:80, height:80, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ position:"absolute", width:22, height:22, borderRadius:"3px", background:"radial-gradient(circle,#d97706,#92400e,#451a03)", transform:"rotate(45deg)", boxShadow:"0 0 16px 8px rgba(146,64,14,0.9)", animation:"ep-pulse 0.13s ease-in-out infinite" }} />
          {[0,40,80,120,160,200,240,280,320].map(a => (
            <div key={a} style={{ position:"absolute", width:"24px", height:"2px", background:`linear-gradient(to right,transparent,#b45309)`, borderRadius:"9999px", transform:`rotate(${a}deg) translateX(16px)`, opacity:0.75 }} />
          ))}
          <div style={{ position:"absolute", width:72, height:72, borderRadius:"50%", background:"radial-gradient(circle,rgba(120,53,15,0.35) 0%,transparent 70%)", animation:"ep-pulse 0.15s ease-in-out infinite" }} />
        </div>
      )

      case "haos": case "light": case "lightness": return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:96, height:96, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ position:"absolute", width:28, height:28, borderRadius:"50%", background:"white", boxShadow:"0 0 0 4px #fef08a,0 0 0 8px rgba(253,224,71,0.5),0 0 40px 18px rgba(254,240,138,1)", animation:"ep-pulse 0.09s ease-in-out infinite" }} />
          {[0,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,270,292.5,315,337.5].map(a => (
            <div key={a} style={{ position:"absolute", width:"2px", height:`${a % 45 === 0 ? 22 : 14}px`, background:"#fef9c3", borderRadius:"9999px", transform:`rotate(${a}deg) translateY(-22px)`, opacity: a % 45 === 0 ? 1 : 0.5 }} />
          ))}
          <div style={{ position:"absolute", width:88, height:88, borderRadius:"50%", background:"radial-gradient(circle,rgba(254,240,138,0.4) 0%,transparent 70%)", animation:"ep-haos-halo 0.1s ease-in-out infinite" }} />
        </div>
      )

      case "darkus": case "darkness": case "dark": return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:80, height:80, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ position:"absolute", width:18, height:18, borderRadius:"50%", background:"black", boxShadow:"0 0 0 3px #581c87,0 0 0 6px rgba(88,28,135,0.4),0 0 28px 12px rgba(88,28,135,0.95)" }} />
          <div style={{ position:"absolute", width:60, height:60, borderRadius:"50%", border:"2px solid #7e22ce", animation:"ep-spin 0.3s linear infinite", opacity:0.7 }} />
          <div style={{ position:"absolute", width:44, height:44, borderRadius:"50%", border:"1px solid #a855f7", animation:"ep-spin 0.25s linear reverse infinite", opacity:0.45 }} />
          <div style={{ position:"absolute", width:72, height:72, borderRadius:"50%", background:"radial-gradient(circle,rgba(88,28,135,0.5) 0%,transparent 70%)", animation:"ep-suck 0.14s ease-in infinite" }} />
        </div>
      )

      case "ventus": case "wind":
        if (isUller) return (
          // Uller charge: green energy converging into arrow tip
          <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:80, height:80, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ position:"absolute", width:18, height:18, borderRadius:"50%", background:"radial-gradient(circle,white 20%,#34d399 60%,#059669 100%)", boxShadow:"0 0 20px 10px rgba(52,211,153,0.9)", animation:"ep-pulse 0.1s ease-in-out infinite" }} />
            {[0,60,120,180,240,300].map(a => (
              <div key={a} style={{ position:"absolute", width:"20px", height:"2px", background:`linear-gradient(to right,transparent,#6ee7b7)`, borderRadius:"9999px", transform:`rotate(${a}deg) translateX(14px)`, opacity:0.8 }} />
            ))}
            <div style={{ position:"absolute", width:72, height:72, borderRadius:"50%", background:"radial-gradient(circle,rgba(52,211,153,0.3) 0%,transparent 70%)", animation:"ep-pulse 0.12s ease-in-out infinite" }} />
          </div>
        )
        // Other ventus charge: dual counter-rotating rings
        return (
          <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:80, height:80, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ position:"absolute", width:64, height:64, borderRadius:"50%", border:"2px solid #34d399", animation:"ep-spin 0.3s linear infinite", opacity:0.7 }} />
            <div style={{ position:"absolute", width:48, height:48, borderRadius:"50%", border:"2px solid #6ee7b7", animation:"ep-spin 0.25s linear reverse infinite", opacity:0.55 }} />
            <div style={{ position:"absolute", width:16, height:16, borderRadius:"50%", background:"radial-gradient(circle,white 20%,#6ee7b7 60%,#059669 100%)", boxShadow:"0 0 16px 8px rgba(110,231,183,0.9)", animation:"ep-pulse 0.1s ease-in-out infinite" }} />
            <div style={{ position:"absolute", width:72, height:72, borderRadius:"50%", background:"radial-gradient(circle,rgba(110,231,183,0.25) 0%,transparent 70%)", animation:"ep-pulse 0.12s ease-in-out infinite" }} />
          </div>
        )

      case "void": return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:80, height:80, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ position:"absolute", width:20, height:20, borderRadius:"50%", background:"white", boxShadow:"0 0 0 3px #cbd5e1,0 0 0 6px rgba(148,163,184,0.4),0 0 32px 14px rgba(203,213,225,0.95)", animation:"ep-pulse 0.11s ease-in-out infinite" }} />
          <div style={{ position:"absolute", width:60, height:60, borderRadius:"50%", border:"1px solid #cbd5e1", animation:"ep-spin 0.5s linear infinite", opacity:0.55 }} />
          <div style={{ position:"absolute", width:44, height:44, borderRadius:"50%", border:"1px solid white", animation:"ep-spin 0.35s linear reverse infinite", opacity:0.4 }} />
          <div style={{ position:"absolute", width:72, height:72, borderRadius:"50%", background:"radial-gradient(circle,rgba(203,213,225,0.35) 0%,transparent 70%)", animation:"ep-pulse 0.12s ease-in-out infinite" }} />
        </div>
      )

      default: return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:64, height:64, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:20, height:20, borderRadius:"50%", background:"white", boxShadow:"0 0 20px 10px rgba(255,255,255,0.7)", animation:"ep-pulse 0.1s ease-in-out infinite" }} />
        </div>
      )
    }
  }

  // ─── TRAVEL ───────────────────────────────────────────────────────────────
  const renderProjectile = () => {
    const mv: React.CSSProperties = { animation:`ep-move ${TRAVEL_DURATION}ms cubic-bezier(0.12,0,0.08,1) forwards` }

    switch (el) {

      case "pyrus": case "fire": return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center", ...mv }}>
          {/* Long degradé tail */}
          <div style={{ width:"110px", height:"7px", background:"linear-gradient(to right,transparent,rgba(220,38,38,0.4),#dc2626,#fb923c)", borderRadius:"9999px", filter:"blur(2.5px)", opacity:0.85 }} />
          {/* Secondary glow tail */}
          <div style={{ width:"70px", height:"4px", background:"linear-gradient(to right,transparent,#fbbf24)", borderRadius:"9999px", filter:"blur(1px)", opacity:0.5, position:"absolute", top:"-5px", left:"20px" }} />
          {/* Core fireball */}
          <div style={{ width:"26px", height:"26px", background:"radial-gradient(circle,white 10%,#fb923c 45%,#dc2626 80%)", borderRadius:"50%", boxShadow:"0 0 14px 7px rgba(251,146,60,0.95),0 0 30px 12px rgba(220,38,38,0.5)", flexShrink:0 }} />
          {/* Leading flare */}
          <div style={{ width:"8px", height:"8px", background:"white", borderRadius:"50%", boxShadow:"0 0 8px 4px rgba(255,255,255,0.9)", position:"absolute", right:"-4px", flexShrink:0 }} />
        </div>
      )

      case "aquos": case "aquo": case "water": return (
        isFehnon ? (
          <div style={{ position:"absolute", left:0, top:"50%", marginTop:"-3px" }}>
            {/* Main slash beam */}
            <div style={{ width:`${distance}px`, height:"4px", background:"linear-gradient(to right,rgba(56,189,248,0) 0%,rgba(56,189,248,0.6) 15%,white 50%,rgba(125,211,252,0.8) 80%,rgba(56,189,248,0) 100%)", borderRadius:"9999px", boxShadow:"0 0 10px 4px rgba(56,189,248,0.85),0 0 22px 8px rgba(14,165,233,0.45)", animation:`ep-laser ${TRAVEL_DURATION}ms ease-out forwards` }} />
            {/* Secondary diagonal slash */}
            <div style={{ width:`${distance * 0.72}px`, height:"2px", background:"linear-gradient(to right,transparent,rgba(125,211,252,0.55),rgba(255,255,255,0.75),transparent)", borderRadius:"9999px", position:"absolute", top:"-8px", left:`${distance * 0.08}px`, boxShadow:"0 0 6px 2px rgba(56,189,248,0.5)", animation:`ep-laser ${TRAVEL_DURATION}ms ease-out 22ms forwards`, opacity:0.7 }} />
            <div style={{ width:`${distance * 0.5}px`, height:"1.5px", background:"linear-gradient(to right,transparent,rgba(186,230,253,0.5),transparent)", borderRadius:"9999px", position:"absolute", top:"8px", left:`${distance * 0.16}px`, animation:`ep-laser ${TRAVEL_DURATION}ms ease-out 38ms forwards`, opacity:0.45 }} />
            {/* Holographic ripple at tip */}
            <div style={{ width:"16px", height:"32px", borderRadius:"50%", border:"2px solid rgba(56,189,248,0.8)", position:"absolute", right:0, top:"-14px", boxShadow:"0 0 10px 4px rgba(56,189,248,0.7),0 0 20px 8px rgba(14,165,233,0.3)", animation:`ep-ring-out ${TRAVEL_DURATION * 0.5}ms ease-out forwards` }} />
            <div style={{ width:"14px", height:"14px", background:"white", borderRadius:"50%", boxShadow:"0 0 14px 7px rgba(56,189,248,1),0 0 32px 14px rgba(14,165,233,0.6)", position:"absolute", right:0, top:"-6px" }} />
          </div>
        ) : (
          <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center", ...mv }}>
            <div style={{ width:"90px", height:"5px", background:"linear-gradient(to right,transparent,rgba(14,165,233,0.5),#0ea5e9,#38bdf8)", borderRadius:"9999px", filter:"blur(2px)", opacity:0.8 }} />
            <div style={{ width:"10px", height:"10px", borderRadius:"50%", border:"1px solid #7dd3fc", position:"absolute", left:"50px", opacity:0.5 }} />
            <div style={{ width:"7px", height:"7px", borderRadius:"50%", border:"1px solid #bae6fd", position:"absolute", left:"70px", opacity:0.35 }} />
            <div style={{ width:"24px", height:"24px", background:"radial-gradient(circle,white 12%,#38bdf8 50%,#0284c7 88%)", borderRadius:"50%", boxShadow:"0 0 12px 6px rgba(56,189,248,0.9),0 0 28px 10px rgba(14,165,233,0.45)", flexShrink:0 }} />
          </div>
        )
      )

      case "terra": case "subterra": return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center", ...mv }}>
          <div style={{ width:"75px", height:"8px", background:"linear-gradient(to right,transparent,#92400e,#b45309)", borderRadius:"4px", filter:"blur(2px)", opacity:0.8 }} />
          {/* Rock debris trail */}
          {[0,1,2].map(i => (
            <div key={i} style={{ width:`${6-i*1.5}px`, height:`${6-i*1.5}px`, background:"#92400e", borderRadius:"2px", position:"absolute", left:`${30+i*15}px`, top:`${(i%2===0?-4:4)}px`, opacity:0.6, transform:`rotate(${i*30}deg)` }} />
          ))}
          {/* Boulder */}
          <div style={{ width:"26px", height:"26px", background:"radial-gradient(circle,#d97706 20%,#92400e 55%,#451a03 90%)", borderRadius:"4px", transform:"rotate(45deg)", boxShadow:"0 0 12px 5px rgba(146,64,14,0.9),0 0 24px 10px rgba(180,83,9,0.4)", flexShrink:0 }} />
        </div>
      )

      case "haos": case "light": case "lightness": return (
        <div style={{ position:"absolute", left:0, top:"50%", marginTop:"-3px" }}>
          {/* Instant beam laser */}
          <div style={{ width:`${distance}px`, height:"6px", background:"linear-gradient(to right,rgba(254,240,138,0) 0%,rgba(253,224,71,0.7) 20%,white 55%,#fef9c3 80%,rgba(254,240,138,0) 100%)", borderRadius:"9999px", boxShadow:"0 0 10px 4px rgba(254,240,138,0.9),0 0 20px 8px rgba(253,224,71,0.5)", animation:`ep-laser ${TRAVEL_DURATION}ms ease-out forwards` }} />
          {/* Tip burst */}
          <div style={{ width:"22px", height:"22px", background:"white", borderRadius:"50%", boxShadow:"0 0 16px 8px rgba(254,240,138,1),0 0 36px 16px rgba(253,224,71,0.6)", position:"absolute", right:0, top:"-8px" }} />
        </div>
      )

      case "darkus": case "darkness": case "dark": return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center", ...mv }}>
          <div style={{ width:"110px", height:"5px", background:"linear-gradient(to right,transparent,rgba(88,28,135,0.5),#7e22ce)", borderRadius:"9999px", filter:"blur(1.5px)", opacity:0.85 }} />
          {/* Dark tendrils */}
          <div style={{ width:"50px", height:"2px", background:"linear-gradient(to right,transparent,#4c1d95)", borderRadius:"9999px", position:"absolute", top:"-6px", left:"40px", opacity:0.5 }} />
          <div style={{ width:"40px", height:"2px", background:"linear-gradient(to right,transparent,#4c1d95)", borderRadius:"9999px", position:"absolute", top:"6px", left:"50px", opacity:0.4 }} />
          {/* Dark blade */}
          <div style={{ width:"10px", height:"32px", background:"linear-gradient(to bottom,#a855f7,#1e1b4b,#7e22ce)", borderRadius:"3px", boxShadow:"0 0 12px 6px rgba(88,28,135,0.95),0 0 28px 12px rgba(88,28,135,0.4)", flexShrink:0 }} />
        </div>
      )

      case "ventus": case "wind":
        if (isUller) return (
          // Uller: green arrow with fletching
          <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center", ...mv }}>
            {/* Arrow shaft */}
            <div style={{ width:`${Math.max(distance * 0.6, 80)}px`, height:"3px", background:"linear-gradient(to right,transparent,rgba(52,211,153,0.5),#34d399)", borderRadius:"9999px", filter:"blur(0.5px)", opacity:0.8 }} />
            {/* Fletching */}
            <div style={{ width:0, height:0, borderTop:"6px solid transparent", borderBottom:"6px solid transparent", borderRight:"14px solid #6ee7b7", position:"absolute", left:"8px", opacity:0.7 }} />
            <div style={{ width:0, height:0, borderTop:"6px solid transparent", borderBottom:"6px solid transparent", borderRight:"14px solid #a7f3d0", position:"absolute", left:"4px", opacity:0.45 }} />
            {/* Arrowhead */}
            <div style={{ width:0, height:0, borderTop:"9px solid transparent", borderBottom:"9px solid transparent", borderLeft:"20px solid #34d399", flexShrink:0, filter:"drop-shadow(0 0 6px rgba(52,211,153,0.9)) drop-shadow(0 0 12px rgba(16,185,129,0.5))" }} />
            {/* Light tip */}
            <div style={{ width:"8px", height:"8px", background:"white", borderRadius:"50%", boxShadow:"0 0 8px 4px rgba(52,211,153,0.9)", position:"absolute", right:"-4px" }} />
          </div>
        )
        // Other Ventus: tornado spiral
        return (
          <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center", ...mv }}>
            {/* Tornado trail */}
            <div style={{ width:"90px", height:"20px", background:"linear-gradient(to right,transparent,rgba(52,211,153,0.15),rgba(110,231,183,0.3))", borderRadius:"0 50% 50% 0", filter:"blur(3px)", opacity:0.7 }} />
            <div style={{ width:"60px", height:"30px", background:"linear-gradient(to right,transparent,rgba(52,211,153,0.2))", borderRadius:"0 50% 50% 0", position:"absolute", left:"10px", filter:"blur(2px)", opacity:0.5 }} />
            {/* Spinning tornado core */}
            <div style={{ width:"24px", height:"32px", borderRadius:"50%", border:"3px solid #34d399", boxShadow:"0 0 10px 4px rgba(52,211,153,0.8),0 0 20px 8px rgba(16,185,129,0.4)", flexShrink:0, animation:"ep-spin 0.15s linear infinite", filter:"blur(0.5px)" }} />
            <div style={{ width:"14px", height:"20px", borderRadius:"50%", border:"2px solid #6ee7b7", position:"absolute", right:"5px", opacity:0.6, animation:"ep-spin 0.1s linear reverse infinite" }} />
          </div>
        )

      case "void": return (
        <div style={{ position:"absolute", left:0, top:"50%", marginTop:"-3px" }}>
          {/* Silver rift trail */}
          <div style={{ width:`${Math.min(distance * 0.65, 110)}px`, height:"3px", background:"linear-gradient(to right,transparent,rgba(203,213,225,0.45),rgba(255,255,255,0.95))", borderRadius:"9999px", filter:"blur(1px)" }} />
          {/* Distortion ripples */}
          <div style={{ width:"12px", height:"12px", borderRadius:"50%", border:"1px solid rgba(203,213,225,0.6)", position:"absolute", left:"40%", top:"-5px", animation:"ep-ring-out 0.2s ease-out infinite" }} />
          {/* Orb */}
          <div style={{ width:"22px", height:"22px", background:"radial-gradient(circle,white 20%,#e2e8f0 55%,#94a3b8 90%)", borderRadius:"50%", boxShadow:"0 0 12px 6px rgba(203,213,225,0.95),0 0 28px 10px rgba(148,163,184,0.5)", position:"absolute", right:0, top:"-9px" }} />
        </div>
      )

      default: return (
        <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center", ...mv }}>
          <div style={{ width:"65px", height:"4px", background:"linear-gradient(to right,transparent,rgba(255,255,255,0.8))", borderRadius:"9999px", filter:"blur(1px)" }} />
          <div style={{ width:"20px", height:"20px", background:"white", borderRadius:"50%", boxShadow:"0 0 12px 6px rgba(255,255,255,0.7)", flexShrink:0 }} />
        </div>
      )
    }
  }

  // ─── IMPACT ───────────────────────────────────────────────────────────────
  const renderImpact = () => {
    type EC = { ring:string; ring2:string; core:string; coreGlow:string; glow:string; colors:string[]; flash:string }

    const resolve = (e: string) => ({ fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus" }[e] ?? e)
    const key = resolve(el) + 
      (el === "ventus" || el === "wind" ? (isUller ? "_uller" : "") : "") +
      ((el === "aquos" || el === "aquo" || el === "water") && isFehnon ? "_fehnon" : "")

    const cfgMap: Record<string, EC> = {
      pyrus:        { ring:"#fb923c",  ring2:"#fbbf24",  core:"radial-gradient(circle,white 8%,#fb923c 38%,#dc2626 75%)",    coreGlow:"rgba(251,146,60,0.95)",  glow:"rgba(220,38,38,0.4)",    colors:["#dc2626","#ea580c","#fb923c","#fbbf24","#fef3c7","white"],    flash:"rgba(255,130,0,0.2)" },
      aquos:        { ring:"#38bdf8",  ring2:"#7dd3fc",  core:"radial-gradient(circle,white 8%,#38bdf8 40%,#0284c7 78%)",    coreGlow:"rgba(56,189,248,0.9)",   glow:"rgba(14,165,233,0.35)",  colors:["#0284c7","#0ea5e9","#38bdf8","#7dd3fc","#e0f2fe","white"],    flash:"rgba(56,189,248,0.16)" },
      aquos_fehnon: { ring:"#38bdf8",  ring2:"white",    core:"radial-gradient(circle,white 12%,#7dd3fc 38%,#0ea5e9 70%,#0369a1 90%)", coreGlow:"rgba(56,189,248,1)", glow:"rgba(14,165,233,0.5)", colors:["white","#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9"], flash:"rgba(56,189,248,0.25)" },
      terra:        { ring:"#b45309",  ring2:"#d97706",  core:"radial-gradient(circle,#fbbf24 8%,#b45309 40%,#451a03 78%)",  coreGlow:"rgba(180,83,9,0.95)",    glow:"rgba(120,53,15,0.4)",    colors:["#292524","#451a03","#92400e","#b45309","#d97706","#fbbf24"],   flash:"rgba(120,53,15,0.22)" },
      haos:         { ring:"#fde047",  ring2:"#fef9c3",  core:"radial-gradient(circle,white 12%,#fef08a 42%,#fde047 78%)",   coreGlow:"rgba(254,240,138,1)",    glow:"rgba(253,224,71,0.5)",   colors:["white","#fef9c3","#fef08a","#fde047","#fbbf24","#f59e0b"],    flash:"rgba(255,255,180,0.3)" },
      darkus:       { ring:"#7e22ce",  ring2:"#a855f7",  core:"radial-gradient(circle,#c084fc 8%,#7e22ce 38%,#1e1b4b 78%)", coreGlow:"rgba(88,28,135,0.95)",   glow:"rgba(88,28,135,0.5)",    colors:["#0f0a1e","#1e1b4b","#4c1d95","#7e22ce","#a855f7","#c084fc"],  flash:"rgba(88,28,135,0.2)" },
      ventus:       { ring:"#34d399",  ring2:"#6ee7b7",  core:"radial-gradient(circle,white 8%,#6ee7b7 40%,#059669 78%)",   coreGlow:"rgba(110,231,183,0.9)",  glow:"rgba(5,150,105,0.35)",   colors:["#064e3b","#059669","#34d399","#6ee7b7","#a7f3d0","white"],    flash:"rgba(110,231,183,0.16)" },
      ventus_uller: { ring:"#34d399",  ring2:"white",    core:"radial-gradient(circle,white 15%,#6ee7b7 42%,#34d399 78%)",  coreGlow:"rgba(52,211,153,1)",     glow:"rgba(16,185,129,0.4)",   colors:["white","#f0fdf4","#6ee7b7","#34d399","#10b981","#a7f3d0"],    flash:"rgba(52,211,153,0.2)" },
      void:         { ring:"#cbd5e1",  ring2:"white",    core:"radial-gradient(circle,white 12%,#e2e8f0 44%,#94a3b8 78%)",  coreGlow:"rgba(203,213,225,1)",    glow:"rgba(148,163,184,0.4)",  colors:["white","#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8"],   flash:"rgba(203,213,225,0.2)" },
    }

    const c = cfgMap[key] ?? cfgMap["void"]
    const impactBase = angleRad + Math.PI
    const isTerra = el === "terra" || el === "subterra"

    return (
      <div style={{ position:"absolute", left:0, top:0, width:0, height:0, transform:`rotate(${-angleDeg}deg)` }}>
        {/* Screen flash */}
        <div style={{ position:"absolute", left:"-50vw", top:"-50vh", width:"100vw", height:"100vh", background:c.flash, animation:"ep-flash 0.13s linear forwards", pointerEvents:"none" }} />

        {/* Outer shockwave */}
        <div style={{ position:"absolute", left:"-66px", top:"-66px", width:"132px", height:"132px", border:`3px solid ${c.ring}`, borderRadius:"50%", boxShadow:`0 0 14px 5px ${c.coreGlow}`, animation:`ep-ring-expand ${IMPACT_DURATION}ms ease-out forwards` }} />
        {/* Mid ring */}
        <div style={{ position:"absolute", left:"-48px", top:"-48px", width:"96px", height:"96px", border:`2px solid ${c.ring2}`, borderRadius:"50%", opacity:0.5, animation:`ep-ring-expand ${IMPACT_DURATION}ms ease-out 40ms forwards` }} />
        {/* Inner tight ring */}
        <div style={{ position:"absolute", left:"-32px", top:"-32px", width:"64px", height:"64px", border:`2px solid ${c.ring}`, borderRadius:"50%", opacity:0.35, animation:`ep-ring-expand ${IMPACT_DURATION * 0.6}ms ease-out forwards` }} />

        {/* Core explosion */}
        <div style={{ position:"absolute", left:"-52px", top:"-52px", width:"104px", height:"104px", background:c.core, borderRadius:"50%", boxShadow:`0 0 44px 20px ${c.coreGlow},0 0 90px 32px ${c.glow}`, animation:`ep-core ${IMPACT_DURATION}ms cubic-bezier(0.08,0.82,0.17,1) forwards` }} />

        {/* Particles */}
        {particles.map(p => {
          const a = impactBase + p.angle * 0.88
          const dist = p.velocity * p.life
          const px = Math.cos(a) * dist
          const py = Math.sin(a) * dist
          const color = c.colors[p.id % c.colors.length]
          return (
            <div key={p.id} style={{
              position:"absolute",
              width:`${p.size}px`, height:`${p.size}px`,
              borderRadius: isTerra ? "2px" : "50%",
              background: color,
              boxShadow:`0 0 5px 2px ${color}88`,
              animation:`ep-particle ${IMPACT_DURATION}ms cubic-bezier(0.04,0.5,0.18,1) ${p.delay}ms forwards`,
              "--px":`${px}px`, "--py":`${py}px`, opacity:0,
            } as React.CSSProperties} />
          )
        })}
      </div>
    )
  }

  let content = null
  if (phase === "charge") content = renderCharge()
  else if (phase === "travel") content = renderProjectile()
  else if (phase === "impact") content = renderImpact()

  const elementToRender = (
    <>
      <style>{`
        @keyframes ep-pulse      { 0%,100%{opacity:.72;transform:scale(1)}  50%{opacity:1;transform:scale(1.16)} }
        @keyframes ep-haos-halo  { 0%,100%{opacity:.6;transform:scale(1)}   50%{opacity:1;transform:scale(1.28)} }
        @keyframes ep-ring-out   { 0%{transform:scale(.35);opacity:1}       100%{transform:scale(1.6);opacity:0} }
        @keyframes ep-spin       { from{transform:rotate(0deg)}             to{transform:rotate(360deg)} }
        @keyframes ep-suck       { 0%{transform:scale(1.45);opacity:.85}    100%{transform:scale(.55);opacity:.35} }
        @keyframes ep-move       { 0%{transform:translateX(0)}              100%{transform:translateX(${distance}px)} }
        @keyframes ep-laser      { 0%{opacity:0;transform-origin:left;transform:scaleX(0)} 8%{opacity:1} 75%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes ep-flash      { 0%{opacity:1} 35%{opacity:.55} 100%{opacity:0} }
        @keyframes ep-ring-expand{ 0%{transform:scale(.1);opacity:1;border-width:6px} 55%{opacity:.5} 100%{transform:scale(2.4);opacity:0;border-width:1px} }
        @keyframes ep-core       { 0%{transform:scale(.04);opacity:1} 22%{transform:scale(1.25);opacity:1} 55%{transform:scale(.95);opacity:.7} 100%{transform:scale(0);opacity:0} }
        @keyframes ep-particle   { 0%{transform:translate(0,0) scale(1.6);opacity:1} 100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0} }
        @keyframes afterimage-fade { 0%{opacity:.28} 100%{opacity:0} }
      `}</style>
      {attackerImage && phase !== "impact" && (
        <div style={{ position:"absolute", left:startX-40, top:startY-56, width:"80px", height:"112px", backgroundImage:`url(${attackerImage})`, backgroundSize:"cover", backgroundPosition:"center", borderRadius:"8px", opacity:0.22, filter:"blur(2px)", animation:"afterimage-fade 200ms ease-out forwards", pointerEvents:"none", zIndex:5 }} />
      )}
      <div style={containerStyle} suppressHydrationWarning>{content}</div>
    </>
  )

  if (portalTarget) return createPortal(elementToRender, portalTarget)
  if (typeof document !== "undefined") return createPortal(elementToRender, document.body)
  return null
}
