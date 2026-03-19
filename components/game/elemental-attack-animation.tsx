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
  portalTarget?: HTMLElement | null
  onImpact?: (id: string, x: number, y: number, element: string) => void
  onComplete: (id: string) => void
}

type AnimPhase = "charge" | "travel" | "impact"

const CHARGE_DURATION = 150
const TRAVEL_DURATION = 350
const IMPACT_DURATION = 400
const TOTAL_DURATION = CHARGE_DURATION + TRAVEL_DURATION + IMPACT_DURATION

const generateParticles = (count: number, spread: number = 110) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    angle: (Math.random() * spread - spread / 2) * (Math.PI / 180),
    velocity: 40 + Math.random() * 55,
    size: 3 + Math.random() * 7,
    life: 0.5 + Math.random() * 0.5,
    delay: Math.random() * 70,
  }))
}

export function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY, element,
  attackerImage, portalTarget, onImpact, onComplete,
}: AttackAnimationProps) {
  const [phase, setPhase] = useState<AnimPhase>("charge")
  const [mounted, setMounted] = useState(false)

  const distance = Math.hypot(targetX - startX, targetY - startY)
  const angleRad = Math.atan2(targetY - startY, targetX - startX)
  const angleDeg = angleRad * (180 / Math.PI)
  const el = element?.toLowerCase().trim() || "neutral"

  const particles = useMemo(() => {
    const countMap: Record<string, number> = {
      pyrus:16,fire:16,aquos:14,aquo:14,water:14,
      terra:12,subterra:12,haos:20,light:20,lightness:20,
      darkus:16,darkness:16,dark:16,ventus:16,wind:16,void:18,
    }
    const spreadMap: Record<string, number> = {
      void:360,haos:140,light:140,lightness:140,ventus:100,wind:100,
    }
    return generateParticles(countMap[el] ?? 14, spreadMap[el] ?? 110)
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
    const base = (glow: string, border: string, bg: string, extra?: React.ReactNode) => (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center">
        <div className="absolute w-5 h-5 rounded-full" style={{ background: "white", boxShadow: `0 0 0 3px ${border}, 0 0 0 6px ${glow}40, 0 0 28px 12px ${glow}` }} />
        <div className="absolute w-14 h-14 rounded-full border" style={{ borderColor: border, opacity:0.6, animation:"ep-spin 0.45s linear infinite" }} />
        <div className="absolute w-20 h-20 rounded-full" style={{ background:`radial-gradient(circle, ${bg} 0%, transparent 70%)`, animation:"ep-pulse 0.12s ease-in-out infinite" }} />
        {extra}
      </div>
    )
    switch (el) {
      case "pyrus": case "fire": return base("#fb923c","#dc2626","rgba(251,146,60,0.35)",
        <div className="absolute w-10 h-10 rounded-full border-2 border-orange-400 opacity-50" style={{ animation:"ep-ring-out 0.13s ease-out 0.05s infinite" }} />
      )
      case "aquos": case "aquo": case "water": return base("#38bdf8","#0ea5e9","rgba(56,189,248,0.3)",
        <div className="absolute w-10 h-10 rounded-full border border-sky-200 opacity-40" style={{ animation:"ep-spin 0.45s linear reverse infinite" }} />
      )
      case "terra": case "subterra": return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center">
          <div className="absolute w-6 h-6 rounded-sm bg-amber-800" style={{ transform:"rotate(45deg)", boxShadow:"0 0 0 3px #92400e, 0 0 20px 8px rgba(120,53,15,0.85)" }} />
          {[0,60,120,180,240,300].map(a => (
            <div key={a} style={{ position:"absolute", width:"20px", height:"2px", background:"#92400e", borderRadius:"9999px", transform:`rotate(${a}deg) translateX(12px)`, opacity:0.8 }} />
          ))}
          <div className="absolute w-20 h-20 rounded-full" style={{ background:"radial-gradient(circle,rgba(120,53,15,0.4) 0%,transparent 70%)", animation:"ep-pulse 0.14s ease-in-out infinite" }} />
        </div>
      )
      case "haos": case "light": case "lightness": return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center">
          <div className="absolute w-6 h-6 rounded-full" style={{ background:"white", boxShadow:"0 0 0 4px #fef08a, 0 0 0 8px #fde04760, 0 0 40px 16px rgba(254,240,138,1)" }} />
          {[0,45,90,135,180,225,270,315].map(a => (
            <div key={a} style={{ position:"absolute", width:"2px", height:"20px", background:"#fef9c3", borderRadius:"9999px", transform:`rotate(${a}deg) translateY(-20px)`, opacity:0.9 }} />
          ))}
          <div className="absolute w-24 h-24 rounded-full" style={{ background:"radial-gradient(circle,rgba(254,240,138,0.5) 0%,transparent 70%)", animation:"ep-haos-halo 0.1s ease-in-out infinite" }} />
        </div>
      )
      case "darkus": case "darkness": case "dark": return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center">
          <div className="absolute w-5 h-5 bg-black rounded-full" style={{ boxShadow:"0 0 0 3px #581c87, 0 0 0 6px #3b076440, 0 0 28px 10px rgba(88,28,135,0.9)" }} />
          <div className="absolute w-16 h-16 rounded-full border border-purple-900 opacity-60" style={{ animation:"ep-spin 0.4s linear infinite" }} />
          <div className="absolute w-20 h-20 rounded-full" style={{ background:"radial-gradient(circle,rgba(88,28,135,0.5) 0%,transparent 70%)", animation:"ep-suck 0.14s ease-in infinite" }} />
        </div>
      )
      case "ventus": case "wind": return base("#6ee7b7","#10b981","rgba(110,231,183,0.3)",
        <div className="absolute w-10 h-10 rounded-full border border-emerald-200 opacity-35" style={{ animation:"ep-spin 0.3s linear reverse infinite" }} />
      )
      case "void": return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center">
          <div className="absolute w-5 h-5 rounded-full" style={{ background:"white", boxShadow:"0 0 0 3px #cbd5e1, 0 0 0 6px #94a3b840, 0 0 28px 12px rgba(203,213,225,0.9)" }} />
          <div className="absolute w-16 h-16 rounded-full border border-slate-300 opacity-55" style={{ animation:"ep-spin 0.55s linear infinite" }} />
          <div className="absolute w-11 h-11 rounded-full border border-white opacity-35" style={{ animation:"ep-spin 0.4s linear reverse infinite" }} />
          <div className="absolute w-20 h-20 rounded-full" style={{ background:"radial-gradient(circle,rgba(203,213,225,0.4) 0%,transparent 70%)", animation:"ep-pulse 0.12s ease-in-out infinite" }} />
        </div>
      )
      default: return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center">
          <div className="absolute w-5 h-5 bg-white rounded-full" style={{ boxShadow:"0 0 20px 8px rgba(255,255,255,0.7)", animation:"ep-pulse 0.1s ease-in-out infinite" }} />
        </div>
      )
    }
  }

  // ─── TRAVEL ───────────────────────────────────────────────────────────────
  const renderProjectile = () => {
    const moveStyle: React.CSSProperties = { animation:`ep-move ${TRAVEL_DURATION}ms cubic-bezier(0.15,0,0.1,1) forwards` }

    switch (el) {
      case "pyrus": case "fire": return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center" style={moveStyle}>
          <div style={{ width:"90px", height:"6px", background:"linear-gradient(to right,transparent,#dc2626,#fb923c)", borderRadius:"9999px", filter:"blur(2px)", opacity:0.8 }} />
          <div style={{ width:"6px", height:"10px", background:"linear-gradient(to right,transparent,#fbbf24)", borderRadius:"9999px", filter:"blur(1px)", opacity:0.5, position:"absolute", top:"-6px", left:"40px" }} />
          <div style={{ width:"22px", height:"22px", background:"radial-gradient(circle,white 15%,#fb923c 50%,#dc2626 100%)", borderRadius:"50%", boxShadow:"0 0 12px 6px rgba(251,146,60,0.9),0 0 28px 10px rgba(220,38,38,0.45)", flexShrink:0 }} />
        </div>
      )
      case "aquos": case "aquo": case "water": return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center" style={moveStyle}>
          <div style={{ width:"80px", height:"4px", background:"linear-gradient(to right,transparent,#0ea5e9,#38bdf8)", borderRadius:"9999px", filter:"blur(2px)", opacity:0.7 }} />
          <div style={{ width:"20px", height:"20px", background:"radial-gradient(circle,white 15%,#38bdf8 55%,#0284c7 100%)", borderRadius:"50%", boxShadow:"0 0 10px 5px rgba(56,189,248,0.85),0 0 22px 8px rgba(14,165,233,0.4)", flexShrink:0 }} />
        </div>
      )
      case "terra": case "subterra": return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center" style={moveStyle}>
          <div style={{ width:"70px", height:"7px", background:"linear-gradient(to right,transparent,#92400e,#b45309)", borderRadius:"4px", filter:"blur(2px)", opacity:0.8 }} />
          <div style={{ width:"22px", height:"22px", background:"radial-gradient(circle,#d97706 25%,#92400e 65%,#451a03 100%)", borderRadius:"3px", transform:"rotate(45deg)", boxShadow:"0 0 10px 4px rgba(146,64,14,0.85),0 0 20px 8px rgba(180,83,9,0.4)", flexShrink:0 }} />
        </div>
      )
      case "haos": case "light": case "lightness": return (
        <div className="absolute left-0 top-1/2" style={{ marginTop:"-3px" }}>
          <div style={{ width:`${distance}px`, height:"5px", background:"linear-gradient(to right,rgba(254,240,138,0) 0%,#fde047 30%,white 60%,#fef9c3 100%)", borderRadius:"9999px", boxShadow:"0 0 8px 3px rgba(254,240,138,0.9)", animation:`ep-laser ${TRAVEL_DURATION}ms ease-out forwards` }} />
          <div style={{ width:"18px", height:"18px", background:"white", borderRadius:"50%", boxShadow:"0 0 14px 7px rgba(254,240,138,1),0 0 32px 14px rgba(253,224,71,0.6)", position:"absolute", right:0, top:"-7px" }} />
        </div>
      )
      case "darkus": case "darkness": case "dark": return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center" style={moveStyle}>
          <div style={{ width:"100px", height:"5px", background:"linear-gradient(to right,transparent,#581c87,#7e22ce)", borderRadius:"9999px", filter:"blur(1px)", opacity:0.8 }} />
          <div style={{ width:"8px", height:"28px", background:"linear-gradient(to bottom,#9333ea,black,#7e22ce)", borderRadius:"3px", boxShadow:"0 0 10px 5px rgba(88,28,135,0.9),0 0 24px 10px rgba(88,28,135,0.4)", flexShrink:0 }} />
        </div>
      )
      case "ventus": case "wind": return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center" style={moveStyle}>
          <div style={{ width:"80px", height:"3px", background:"linear-gradient(to right,transparent,#34d399,#6ee7b7)", borderRadius:"9999px", filter:"blur(1px)", opacity:0.6 }} />
          <div style={{ position:"relative", width:"22px", height:"22px", flexShrink:0 }}>
            <div style={{ width:"22px", height:"22px", border:"3px solid #6ee7b7", borderRadius:"50%", position:"absolute", top:0, left:0, clipPath:"polygon(0 0,55% 0,55% 100%,0 100%)", boxShadow:"0 0 8px 3px rgba(110,231,183,0.7)", filter:"blur(0.5px)" }} />
            <div style={{ width:"15px", height:"15px", border:"2px solid #a7f3d0", borderRadius:"50%", position:"absolute", top:"3px", left:"2px", clipPath:"polygon(0 0,55% 0,55% 100%,0 100%)", opacity:0.5 }} />
          </div>
        </div>
      )
      case "void": return (
        <div className="absolute left-0 top-1/2" style={{ marginTop:"-3px" }}>
          <div style={{ width:`${Math.min(distance*0.65,110)}px`, height:"3px", background:"linear-gradient(to right,transparent,rgba(203,213,225,0.5),rgba(255,255,255,0.9))", borderRadius:"9999px", filter:"blur(1px)" }} />
          <div style={{ width:"18px", height:"18px", background:"radial-gradient(circle,white 25%,#cbd5e1 70%)", borderRadius:"50%", boxShadow:"0 0 10px 5px rgba(203,213,225,0.9),0 0 24px 8px rgba(148,163,184,0.5)", position:"absolute", right:0, top:"-8px" }} />
        </div>
      )
      default: return (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center" style={moveStyle}>
          <div style={{ width:"60px", height:"4px", background:"linear-gradient(to right,transparent,rgba(255,255,255,0.8))", borderRadius:"9999px", filter:"blur(1px)" }} />
          <div style={{ width:"18px", height:"18px", background:"white", borderRadius:"50%", boxShadow:"0 0 12px 6px rgba(255,255,255,0.7)", flexShrink:0 }} />
        </div>
      )
    }
  }

  // ─── IMPACT ───────────────────────────────────────────────────────────────
  const renderImpact = () => {
    type EC = { ring:string; core:string; coreGlow:string; glow:string; colors:string[]; flash:string }
    const elKey = (e: string) => ({ fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus" }[e] ?? e)
    const cfgMap: Record<string,EC> = {
      pyrus:   { ring:"#fb923c", core:"radial-gradient(circle,white 10%,#fb923c 40%,#dc2626 80%)", coreGlow:"rgba(251,146,60,0.9)",   glow:"rgba(220,38,38,0.35)",    colors:["#dc2626","#ea580c","#fb923c","#fbbf24","white"],          flash:"rgba(255,140,0,0.18)" },
      aquos:   { ring:"#38bdf8", core:"radial-gradient(circle,white 10%,#38bdf8 45%,#0284c7 80%)", coreGlow:"rgba(56,189,248,0.9)",   glow:"rgba(14,165,233,0.3)",    colors:["#0ea5e9","#38bdf8","#7dd3fc","white","#e0f2fe"],           flash:"rgba(56,189,248,0.15)" },
      terra:   { ring:"#b45309", core:"radial-gradient(circle,#fbbf24 10%,#b45309 45%,#451a03 80%)", coreGlow:"rgba(180,83,9,0.9)",  glow:"rgba(120,53,15,0.35)",    colors:["#451a03","#92400e","#b45309","#d97706","#fbbf24"],         flash:"rgba(120,53,15,0.2)" },
      haos:    { ring:"#fde047", core:"radial-gradient(circle,white 15%,#fef08a 45%,#fde047 80%)", coreGlow:"rgba(254,240,138,1)",    glow:"rgba(253,224,71,0.45)",   colors:["white","#fef9c3","#fef08a","#fde047","#fbbf24"],           flash:"rgba(255,255,200,0.28)" },
      darkus:  { ring:"#7e22ce", core:"radial-gradient(circle,#c084fc 10%,#7e22ce 40%,#1e1b4b 80%)", coreGlow:"rgba(88,28,135,0.95)", glow:"rgba(88,28,135,0.45)",  colors:["#1e1b4b","#4c1d95","#7e22ce","#a855f7","#c084fc"],        flash:"rgba(88,28,135,0.18)" },
      ventus:  { ring:"#34d399", core:"radial-gradient(circle,white 10%,#6ee7b7 45%,#059669 80%)", coreGlow:"rgba(110,231,183,0.9)",  glow:"rgba(5,150,105,0.3)",     colors:["#059669","#34d399","#6ee7b7","#a7f3d0","white"],           flash:"rgba(110,231,183,0.15)" },
      void:    { ring:"#cbd5e1", core:"radial-gradient(circle,white 15%,#e2e8f0 50%,#94a3b8 80%)", coreGlow:"rgba(203,213,225,1)",    glow:"rgba(148,163,184,0.35)",  colors:["white","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8"],           flash:"rgba(203,213,225,0.18)" },
    }
    const c = cfgMap[elKey(el)] ?? { ring:"#ffffff", core:"radial-gradient(circle,white 20%,#e2e8f0 80%)", coreGlow:"rgba(255,255,255,0.9)", glow:"rgba(255,255,255,0.3)", colors:["white","#f1f5f9"], flash:"rgba(255,255,255,0.15)" }
    const impactBase = angleRad + Math.PI
    const isTerra = el === "terra" || el === "subterra"

    return (
      <div style={{ position:"absolute", left:0, top:0, width:0, height:0, transform:`rotate(${-angleDeg}deg)` }}>
        {/* Screen flash */}
        <div style={{ position:"absolute", left:"-50vw", top:"-50vh", width:"100vw", height:"100vh", background:c.flash, animation:"ep-flash 0.12s linear forwards", pointerEvents:"none" }} />
        {/* Outer ring */}
        <div style={{ position:"absolute", left:"-60px", top:"-60px", width:"120px", height:"120px", border:`3px solid ${c.ring}`, borderRadius:"50%", boxShadow:`0 0 12px 4px ${c.coreGlow}`, animation:`ep-ring-expand ${IMPACT_DURATION}ms ease-out forwards` }} />
        {/* Inner ring */}
        <div style={{ position:"absolute", left:"-40px", top:"-40px", width:"80px", height:"80px", border:`2px solid ${c.ring}`, borderRadius:"50%", opacity:0.45, animation:`ep-ring-expand ${IMPACT_DURATION}ms ease-out 45ms forwards` }} />
        {/* Core burst */}
        <div style={{ position:"absolute", left:"-48px", top:"-48px", width:"96px", height:"96px", background:c.core, borderRadius:"50%", boxShadow:`0 0 40px 18px ${c.coreGlow},0 0 80px 28px ${c.glow}`, animation:`ep-core ${IMPACT_DURATION}ms cubic-bezier(0.1,0.8,0.2,1) forwards` }} />
        {/* Particles */}
        {particles.map(p => {
          const a = impactBase + p.angle * 0.85
          const dist = p.velocity * p.life
          const px = Math.cos(a) * dist
          const py = Math.sin(a) * dist
          const color = c.colors[p.id % c.colors.length]
          return (
            <div key={p.id} style={{
              position:"absolute", width:`${p.size}px`, height:`${p.size}px`,
              borderRadius: isTerra ? "2px" : "50%",
              background: color, boxShadow:`0 0 4px 1px ${color}90`,
              animation:`ep-particle ${IMPACT_DURATION}ms cubic-bezier(0.05,0.5,0.2,1) ${p.delay}ms forwards`,
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
        @keyframes ep-pulse { 0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.15)} }
        @keyframes ep-haos-halo { 0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.25)} }
        @keyframes ep-ring-out { 0%{transform:scale(.4);opacity:1}100%{transform:scale(1.5);opacity:0} }
        @keyframes ep-spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        @keyframes ep-suck { 0%{transform:scale(1.4);opacity:.8}100%{transform:scale(.6);opacity:.4} }
        @keyframes ep-move { 0%{transform:translateX(0)}100%{transform:translateX(${distance}px)} }
        @keyframes ep-laser { 0%{opacity:0;transform:scaleX(0);transform-origin:left}10%{opacity:1}80%{opacity:1}100%{opacity:0;transform:scaleX(1);transform-origin:left} }
        @keyframes ep-flash { 0%{opacity:1}40%{opacity:.6}100%{opacity:0} }
        @keyframes ep-ring-expand { 0%{transform:scale(.1);opacity:1;border-width:6px}60%{opacity:.5}100%{transform:scale(2.2);opacity:0;border-width:1px} }
        @keyframes ep-core { 0%{transform:scale(.05);opacity:1}25%{transform:scale(1.2);opacity:1}60%{transform:scale(.9);opacity:.65}100%{transform:scale(0);opacity:0} }
        @keyframes ep-particle { 0%{transform:translate(0,0) scale(1.5);opacity:1}100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0} }
        @keyframes afterimage-fade { 0%{opacity:.3}100%{opacity:0} }
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
