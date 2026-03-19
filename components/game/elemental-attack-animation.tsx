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

// ─── 5-stage phase system ────────────────────────────────────────────────────
// charge → release → strike → impact → aftermath
// Totals ~940ms to sync with PROJECTILE_DURATION in duel-screen.tsx
type Phase = "charge" | "release" | "strike" | "impact" | "aftermath"

const T = {
  CHARGE:   160,  // energy buildup, tension
  RELEASE:   40,  // explosive transition snap
  STRIKE:   260,  // projectile travels
  IMPACT:    80,  // hero frame — flash, compression
  AFTERMATH: 400, // particles, residual, dissipation
  get TOTAL() { return this.CHARGE + this.RELEASE + this.STRIKE + this.IMPACT + this.AFTERMATH }
}

// ─── Seeded organic variation (each attack slightly different) ────────────────
const seed = (id: string, i: number): number => {
  let h = (i + 1) * 2654435761
  for (const c of id) h = (h ^ c.charCodeAt(0) * 1000003) >>> 0
  return h / 4294967295
}
const rv = (a: number, b: number, v: number) => a + v * (b - a)

const mkP = (n: number, spread: number, sMin: number, sMax: number, id: string) =>
  Array.from({ length: n }).map((_, i) => ({
    id: i,
    angle: rv(-spread/2, spread/2, seed(id,i))   * (Math.PI/180),
    spd:   rv(sMin, sMax,          seed(id,i+100)),
    sz:    rv(2, 7.5,              seed(id,i+200)),
    life:  rv(0.38, 1,             seed(id,i+300)),
    del:   rv(0, 72,               seed(id,i+400)),
    jx:    rv(-3, 3,               seed(id,i+500)),
    jy:    rv(-3, 3,               seed(id,i+600)),
    spin:  rv(0, 360,              seed(id,i+700)),
  }))

const ss = (s: React.CSSProperties) => s

// ─── Reusable ring ────────────────────────────────────────────────────────────
const Ring = ({ d, bw="2px", bc, bg, glow, anim, op=1, delay }: {
  d:number; bw?:string; bc?:string; bg?:string; glow?:string; anim?:string; op?:number; delay?:number
}) => (
  <div style={ss({
    position:"absolute", width:d, height:d, marginLeft:-d/2, marginTop:-d/2,
    borderRadius:"50%",
    border: bc ? `${bw} solid ${bc}` : undefined,
    background: bg, boxShadow:glow, opacity:op, animation:anim,
    animationDelay: delay ? `${delay}ms` : undefined,
  })} />
)

export function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY,
  element, attackerImage, attackerName,
  portalTarget, onImpact, onComplete,
}: AttackAnimationProps) {
  const [phase, setPhase] = useState<Phase>("charge")
  const [mounted, setMounted] = useState(false)

  const dist  = Math.hypot(targetX-startX, targetY-startY)
  const aRad  = Math.atan2(targetY-startY, targetX-startX)
  const aDeg  = aRad * (180/Math.PI)
  const el    = element?.toLowerCase().trim() || "neutral"

  const isUller  = /ullr|uller/i.test(attackerName || "")
  const isFehnon = /fehnon/i.test(attackerName || "")

  // Per-element particle tables [count, spread, speedMin, speedMax]
  const pts = useMemo(() => {
    const tbl: Record<string,[number,number,number,number]> = {
      pyrus:[20,112,36,84],    fire:[20,112,36,84],
      aquos:[16,108,30,76],    aquo:[16,108,30,76],    water:[16,108,30,76],
      terra:[15,104,28,70],    subterra:[15,104,28,70],
      haos:[24,160,34,80],     light:[24,160,34,80],   lightness:[24,160,34,80],
      darkus:[18,108,26,72],   darkness:[18,108,26,72], dark:[18,108,26,72],
      ventus:[22,140,30,76],   wind:[22,140,30,76],
      void:[24,360,24,68],
    }
    const [n,sp,mn,mx] = tbl[el] ?? [16,110,30,76]
    return mkP(n,sp,mn,mx,id)
  }, [el, id])

  const doneRef = useRef(onComplete)
  useEffect(() => { doneRef.current = onComplete }, [onComplete])

  useEffect(() => {
    setMounted(true)
    const timers = [
      setTimeout(() => setPhase("release"),                             T.CHARGE),
      setTimeout(() => setPhase("strike"),                              T.CHARGE + T.RELEASE),
      setTimeout(() => { setPhase("impact"); onImpact?.(id,targetX,targetY,el) },
                                                                        T.CHARGE + T.RELEASE + T.STRIKE),
      setTimeout(() => setPhase("aftermath"),                           T.CHARGE + T.RELEASE + T.STRIKE + T.IMPACT),
      setTimeout(() => doneRef.current(id),                             T.TOTAL),
    ]
    return () => timers.forEach(clearTimeout)
  }, [id])

  if (!mounted) return null

  // Container repositions at target during impact/aftermath
  const inFlight = phase === "charge" || phase === "release" || phase === "strike"
  const ctr: React.CSSProperties = inFlight
    ? { position:"absolute", left:startX, top:startY, width:dist, height:60, marginTop:-30,
        pointerEvents:"none", zIndex:10000, transformOrigin:"0 50%", transform:`rotate(${aDeg}deg)` }
    : { position:"absolute", left:targetX, top:targetY, width:0, height:60, marginTop:-30,
        pointerEvents:"none", zIndex:10000, transformOrigin:"0 50%", transform:`rotate(${aDeg}deg)` }

  // ══════════════════════════════════════════════════════════════════════════
  //  ① CHARGE  — energy building with secondary life
  // ══════════════════════════════════════════════════════════════════════════
  const Charge = () => {
    const hub = (sz=96, children: React.ReactNode) => (
      <div style={ss({ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
        width:sz, height:sz, display:"flex", alignItems:"center", justifyContent:"center" })}>
        {children}
      </div>
    )

    switch (el) {
      case "pyrus": case "fire": return hub(100, <>
        {/* Outer fire corona — 3 rings at chaotic speeds → unstable, volatile */}
        <Ring d={90} bc="#f97316" bw="2px" glow="0 0 20px 9px rgba(249,115,22,0.74)" anim="a-spin 0.16s linear infinite" op={0.88} />
        <Ring d={68} bc="#fbbf24" bw="3px" glow="0 0 14px 6px rgba(251,191,36,0.72)" anim="a-spin 0.11s linear reverse infinite" op={0.78} />
        <Ring d={46} bc="#ef4444" bw="2px" glow="0 0 12px 6px rgba(239,68,68,0.8)"   anim="a-spin 0.07s linear infinite" op={0.68} />
        {/* Pulsing magma core */}
        <div style={ss({ position:"absolute", width:30, height:30, borderRadius:"50%",
          background:"radial-gradient(circle,white 7%,#fb923c 32%,#dc2626 64%,#7f1d1d 100%)",
          boxShadow:"0 0 0 4px #f97316,0 0 30px 15px rgba(251,146,60,1),0 0 60px 24px rgba(220,38,38,0.68)",
          animation:"a-pulse-fire 0.08s ease-in-out infinite" })} />
        {/* Heat shimmer rings bursting outward */}
        <Ring d={94} bc="rgba(251,146,60,0.44)" bw="1px" anim="a-burst 0.13s ease-out infinite" />
        <Ring d={94} bc="rgba(251,146,60,0.28)" bw="1px" anim="a-burst 0.13s ease-out 0.065s infinite" />
        {/* Outer ember glow */}
        <Ring d={100} bg="radial-gradient(circle,rgba(251,146,60,0.2) 0%,transparent 70%)" anim="a-pulse-fire 0.1s ease-in-out infinite" />
      </>)

      case "aquos": case "aquo": case "water":
        if (isFehnon) return hub(108, <>
          {/* Fehnon: 4 holo rings contracting → compressed blade energy */}
          {[96,76,58,42].map((d,i) => (
            <div key={i} style={ss({ position:"absolute", width:d, height:d,
              marginLeft:-d/2, marginTop:-d/2, borderRadius:"50%",
              border:`${i===0?"2px":"1px"} solid rgba(56,189,248,${0.82-i*0.16})`,
              boxShadow: i===0 ? "0 0 20px 8px rgba(56,189,248,0.58)" : undefined,
              animation:`a-fehnon-contract 0.18s cubic-bezier(.44,0,1,1) ${i*26}ms forwards` })} />
          ))}
          {/* 9 horizontal scan lines — holographic blade forming */}
          {[-26,-18,-11,-5,0,6,12,19,26].map((y,i) => (
            <div key={i} style={ss({ position:"absolute", height:"1.5px",
              width:`${80-Math.abs(y)*1.6}px`,
              background:`linear-gradient(to right,transparent,rgba(56,189,248,${.24+Math.abs(i-4)*.12}),rgba(255,255,255,${.5+Math.abs(i-4)*.09}),rgba(56,189,248,${.24+Math.abs(i-4)*.12}),transparent)`,
              borderRadius:"9999px",
              top:`calc(50% + ${y}px)`, left:"50%", transform:"translateX(-50%)",
              animation:`a-fehnon-scan 0.18s ease-out ${i*8}ms forwards` })} />
          ))}
          {/* Diamond blade core */}
          <div style={ss({ position:"absolute", width:22, height:22, borderRadius:"3px",
            transform:"rotate(45deg)",
            background:"radial-gradient(circle,white 7%,#7dd3fc 34%,#0ea5e9 80%)",
            boxShadow:"0 0 0 2px #38bdf8,0 0 28px 14px rgba(56,189,248,1),0 0 54px 24px rgba(14,165,233,0.74)",
            animation:"a-pulse-fire 0.08s ease-in-out infinite" })} />
          <Ring d={104} bg="radial-gradient(circle,rgba(56,189,248,0.18) 0%,transparent 68%)" anim="a-pulse-fire 0.13s ease-in-out infinite" />
        </>)
        return hub(96, <>
          <Ring d={84} bc="#38bdf8" bw="2px" glow="0 0 16px 7px rgba(56,189,248,0.64)" anim="a-spin 0.28s linear infinite" op={0.78} />
          <Ring d={62} bc="#7dd3fc" bw="2px" glow="0 0 11px 5px rgba(125,211,252,0.54)" anim="a-spin 0.21s linear reverse infinite" op={0.62} />
          <Ring d={42} bc="#bae6fd" bw="1px" anim="a-spin 0.14s linear infinite" op={0.46} />
          <div style={ss({ position:"absolute", width:22, height:22, borderRadius:"50%",
            background:"radial-gradient(circle,white 12%,#38bdf8 46%,#0284c7 88%)",
            boxShadow:"0 0 0 2px #7dd3fc,0 0 24px 12px rgba(56,189,248,0.92),0 0 48px 20px rgba(14,165,233,0.54)",
            animation:"a-pulse-fire 0.11s ease-in-out infinite" })} />
          <Ring d={92} bg="radial-gradient(circle,rgba(56,189,248,0.14) 0%,transparent 70%)" anim="a-pulse-fire 0.14s ease-in-out infinite" />
          <Ring d={92} bc="rgba(56,189,248,0.36)" bw="1px" anim="a-burst 0.18s ease-out infinite" />
        </>)

      case "terra": case "subterra": return hub(96, <>
        {/* Ground fracture lines — rock splitting */}
        {[0,40,80,120,160,200,240,280,320].map((a,i) => (
          <div key={a} style={ss({ position:"absolute", width:"30px", height:"2.5px",
            background:"linear-gradient(to right,rgba(180,83,9,0.9),rgba(217,119,6,0.4),transparent)",
            borderRadius:"2px", transformOrigin:"left center",
            transform:`rotate(${a}deg) translateX(14px)`,
            animation:`a-terra-crack 0.16s ease-out ${i*10}ms both` })} />
        ))}
        <Ring d={76} bc="#92400e" bw="2px" glow="0 0 14px 6px rgba(146,64,14,0.58)" anim="a-spin 0.3s linear infinite" op={0.66} />
        <div style={ss({ position:"absolute", width:26, height:26, borderRadius:"3px",
          transform:"rotate(45deg)",
          background:"radial-gradient(circle,#fbbf24 9%,#b45309 40%,#7c2d12 82%)",
          boxShadow:"0 0 0 3px #92400e,0 0 26px 13px rgba(180,83,9,0.95),0 0 54px 22px rgba(120,53,15,0.58)",
          animation:"a-terra-pulse 0.12s ease-in-out infinite" })} />
        <Ring d={90} bc="rgba(180,83,9,0.48)" bw="1px" anim="a-burst 0.17s ease-out infinite" />
        <Ring d={90} bc="rgba(146,64,14,0.30)" bw="1px" anim="a-burst 0.17s ease-out 0.085s infinite" />
        <Ring d={96} bg="radial-gradient(circle,rgba(120,53,15,0.26) 0%,transparent 70%)" anim="a-terra-pulse 0.15s ease-in-out infinite" />
      </>)

      case "haos": case "light": case "lightness": return hub(108, <>
        {/* 16 divine rays — 3 lengths, staggered phase */}
        {Array.from({length:16},(_,i)=>i*22.5).map((a,i) => (
          <div key={a} style={ss({ position:"absolute", width:"2px",
            height: i%4===0 ? "30px" : i%2===0 ? "21px" : "13px",
            background:"linear-gradient(to top,transparent,rgba(254,249,195,0.8),white)",
            borderRadius:"9999px", transformOrigin:"50% 100%",
            transform:`rotate(${a}deg) translateY(-${i%4===0?26:i%2===0?18:12}px)`,
            opacity: i%4===0 ? 1 : i%2===0 ? 0.72 : 0.48,
            animation:`a-haos-ray 0.1s ease-in-out ${i%3===0?0:i%3===1?33:66}ms infinite` })} />
        ))}
        <div style={ss({ position:"absolute", width:32, height:32, borderRadius:"50%",
          background:"white",
          boxShadow:"0 0 0 5px #fef08a,0 0 0 10px rgba(253,224,71,0.44),0 0 52px 26px rgba(254,240,138,1),0 0 100px 40px rgba(253,224,71,0.44)",
          animation:"a-pulse-fire 0.08s ease-in-out infinite" })} />
        <Ring d={102} bg="radial-gradient(circle,rgba(254,240,138,0.36) 0%,transparent 65%)" anim="a-haos-halo 0.1s ease-in-out infinite" />
        <Ring d={108} bc="rgba(254,240,138,0.46)" bw="1px" anim="a-burst 0.12s ease-out infinite" />
      </>)

      case "darkus": case "darkness": case "dark": return hub(96, <>
        {/* Void rings collapsing inward — weight, gravity pull */}
        <Ring d={92} bc="#7e22ce" bw="2px" glow="0 0 24px 10px rgba(88,28,135,0.78)" anim="a-dark-consume 0.22s ease-in infinite" op={0.86} />
        <Ring d={70} bc="#a855f7" bw="2px" glow="0 0 16px 7px rgba(168,85,247,0.64)" anim="a-spin 0.28s linear reverse infinite" op={0.68} />
        <Ring d={50} bc="#c084fc" bw="1px" anim="a-spin 0.18s linear infinite" op={0.5} />
        {/* 7 shadow tendrils reaching inward */}
        {[0,51,103,154,206,257,308].map((a,i) => (
          <div key={a} style={ss({ position:"absolute", width:"26px", height:"2px",
            background:"linear-gradient(to right,rgba(88,28,135,0.92),rgba(88,28,135,0.28),transparent)",
            borderRadius:"9999px", transformOrigin:"left center",
            transform:`rotate(${a}deg) translateX(10px)`, opacity:.82,
            animation:`a-dark-tendril 0.22s ease-in-out ${i*22}ms infinite` })} />
        ))}
        {/* Singularity core */}
        <div style={ss({ position:"absolute", width:22, height:22, borderRadius:"50%",
          background:"radial-gradient(circle,#0f0a1e 18%,black 58%)",
          boxShadow:"0 0 0 3px #581c87,0 0 0 8px rgba(88,28,135,0.52),0 0 38px 19px rgba(88,28,135,1),0 0 80px 32px rgba(88,28,135,0.58)" })} />
        <Ring d={94} bg="radial-gradient(circle,rgba(88,28,135,0.46) 0%,transparent 70%)" anim="a-dark-consume 0.14s ease-in infinite" />
      </>)

      case "ventus": case "wind":
        if (isUller) return hub(96, <>
          {[0,36,72,108,144,180,216,252,288,324].map((a,i) => (
            <div key={a} style={ss({ position:"absolute", width:"26px", height:"2px",
              background:"linear-gradient(to right,rgba(52,211,153,0),#6ee7b7)",
              borderRadius:"9999px", transformOrigin:"left center",
              transform:`rotate(${a}deg) translateX(12px)`, opacity:.84,
              animation:`a-gather 0.18s ease-in ${i*14}ms both` })} />
          ))}
          <div style={ss({ position:"absolute", width:22, height:22, borderRadius:"50%",
            background:"radial-gradient(circle,white 16%,#6ee7b7 52%,#059669 88%)",
            boxShadow:"0 0 0 2px #34d399,0 0 28px 14px rgba(52,211,153,0.96),0 0 58px 24px rgba(16,185,129,0.58)",
            animation:"a-pulse-fire 0.1s ease-in-out infinite" })} />
          <Ring d={86} bc="rgba(52,211,153,0.54)" bw="1px" anim="a-burst 0.14s ease-out infinite" op={0.62} />
          <Ring d={94} bg="radial-gradient(circle,rgba(52,211,153,0.18) 0%,transparent 70%)" anim="a-pulse-fire 0.12s ease-in-out infinite" />
        </>)
        return hub(96, <>
          <Ring d={86} bc="#34d399" bw="2px" glow="0 0 16px 7px rgba(52,211,153,0.62)" anim="a-spin 0.22s linear infinite" op={0.78} />
          <Ring d={64} bc="#6ee7b7" bw="2px" glow="0 0 11px 5px rgba(110,231,183,0.54)" anim="a-spin 0.16s linear reverse infinite" op={0.64} />
          <Ring d={44} bc="#a7f3d0" bw="1px" anim="a-spin 0.11s linear infinite" op={0.48} />
          <div style={ss({ position:"absolute", width:22, height:22, borderRadius:"50%",
            background:"radial-gradient(circle,white 16%,#6ee7b7 52%,#059669 88%)",
            boxShadow:"0 0 0 2px #34d399,0 0 24px 12px rgba(110,231,183,0.96),0 0 50px 22px rgba(5,150,105,0.54)",
            animation:"a-pulse-fire 0.1s ease-in-out infinite" })} />
          <Ring d={92} bg="radial-gradient(circle,rgba(110,231,183,0.17) 0%,transparent 70%)" anim="a-pulse-fire 0.12s ease-in-out infinite" />
          <Ring d={92} bc="rgba(52,211,153,0.37)" bw="1px" anim="a-burst 0.16s ease-out infinite" />
        </>)

      case "void": return hub(96, <>
        <Ring d={92} bc="rgba(203,213,225,0.82)" bw="1.5px" glow="0 0 20px 8px rgba(203,213,225,0.54)" anim="a-spin 0.5s linear infinite" op={0.7} />
        <Ring d={70} bc="rgba(226,232,240,0.72)"  bw="1.5px" glow="0 0 14px 6px rgba(226,232,240,0.44)" anim="a-spin 0.34s linear reverse infinite" op={0.58} />
        <Ring d={50} bc="white" bw="1px" anim="a-spin 0.2s linear infinite" op={0.46} />
        <div style={ss({ position:"absolute", width:24, height:24, borderRadius:"50%",
          background:"radial-gradient(circle,white 14%,#e2e8f0 44%,#94a3b8 80%)",
          boxShadow:"0 0 0 3px #cbd5e1,0 0 0 7px rgba(148,163,184,0.52),0 0 36px 18px rgba(203,213,225,1),0 0 72px 28px rgba(148,163,184,0.54)",
          animation:"a-pulse-fire 0.1s ease-in-out infinite" })} />
        <Ring d={94} bc="rgba(203,213,225,0.38)" bw="1px" anim="a-burst 0.16s ease-out infinite" />
        <Ring d={94} bc="rgba(203,213,225,0.22)" bw="1px" anim="a-burst 0.16s ease-out 0.08s infinite" />
        <Ring d={98} bg="radial-gradient(circle,rgba(203,213,225,0.24) 0%,transparent 70%)" anim="a-pulse-fire 0.12s ease-in-out infinite" />
      </>)

      default: return hub(80, <>
        <div style={ss({ position:"absolute", width:26, height:26, borderRadius:"50%",
          background:"white", boxShadow:"0 0 32px 16px rgba(255,255,255,0.82)",
          animation:"a-pulse-fire 0.1s ease-in-out infinite" })} />
      </>)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ② RELEASE (40ms) — explosive snap from charge → projectile
  //  This phase renders the same as the end of charge but with a burst effect
  // ══════════════════════════════════════════════════════════════════════════
  const Release = () => (
    <div style={ss({ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
      width:80, height:80, marginTop:-40, display:"flex", alignItems:"center", justifyContent:"center" })}>
      {/* Explosive snap burst */}
      <Ring d={80} bc="white" bw="3px" anim="a-release-burst 40ms ease-out forwards" glow="0 0 30px 15px rgba(255,255,255,0.9)" />
      <Ring d={60} bc="white" bw="2px" anim="a-release-burst 40ms ease-out 10ms forwards" op={0.7} />
      <div style={ss({ position:"absolute", width:16, height:16, borderRadius:"50%",
        background:"white", boxShadow:"0 0 40px 20px rgba(255,255,255,1)",
        animation:"a-release-core 40ms ease-out forwards" })} />
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  //  ③ STRIKE — projectile with full personality
  // ══════════════════════════════════════════════════════════════════════════
  const Strike = () => {
    // Each element has unique easing that defines its "character"
    const ease: Record<string,string> = {
      pyrus:"cubic-bezier(0.08,0,0.05,1)",     fire:"cubic-bezier(0.08,0,0.05,1)",
      aquos:"cubic-bezier(0.1,0,0.06,1)",      aquo:"cubic-bezier(0.1,0,0.06,1)",   water:"cubic-bezier(0.1,0,0.06,1)",
      terra:"cubic-bezier(0.26,0,0.06,1)",     subterra:"cubic-bezier(0.26,0,0.06,1)",
      haos:"cubic-bezier(0.04,0,0.04,1)",      light:"cubic-bezier(0.04,0,0.04,1)", lightness:"cubic-bezier(0.04,0,0.04,1)",
      darkus:"cubic-bezier(0.46,0,0.06,1)",    darkness:"cubic-bezier(0.46,0,0.06,1)", dark:"cubic-bezier(0.46,0,0.06,1)",
      ventus:"cubic-bezier(0.1,0,0.05,1)",     wind:"cubic-bezier(0.1,0,0.05,1)",
      void:"cubic-bezier(0.03,0,0.03,1)",
    }
    const mv = { animation:`a-move ${T.STRIKE}ms ${ease[el]??"cubic-bezier(0.1,0,0.06,1)"} forwards` } as React.CSSProperties

    switch (el) {
      case "pyrus": case "fire": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          {/* Deep flame trail — 3 layers of varying width/opacity */}
          <div style={ss({ position:"absolute",width:"145px",height:"11px",
            background:"linear-gradient(to right,transparent,rgba(127,29,29,0.3),rgba(220,38,38,0.6),#f97316,rgba(251,146,60,0.62))",
            borderRadius:"9999px",filter:"blur(2.5px)",opacity:.92 })} />
          <div style={ss({ position:"absolute",width:"100px",height:"5px",
            background:"linear-gradient(to right,transparent,#fbbf24,rgba(251,191,36,0.4))",
            top:"-7px",left:"24px",borderRadius:"9999px",filter:"blur(1px)",opacity:.68 })} />
          <div style={ss({ position:"absolute",width:"68px",height:"4px",
            background:"linear-gradient(to right,transparent,rgba(251,146,60,0.4))",
            top:"8px",left:"44px",borderRadius:"9999px",filter:"blur(1px)",opacity:.52 })} />
          {/* 3 organic ember sparks at varied positions */}
          {[{x:54,y:-10,s:11},{x:78,y:7,s:9},{x:68,y:-7,s:7}].map((e,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${e.s}px`,height:`${e.s}px`,
              borderRadius:"50%",background:"radial-gradient(circle,white,#fbbf24)",
              boxShadow:`0 0 8px 4px rgba(251,191,36,0.9)`,
              left:`${e.x}px`,top:`${e.y}px`,opacity:.75-i*.1 })} />
          ))}
          {/* Core fireball */}
          <div style={ss({ width:"33px",height:"33px",flexShrink:0,borderRadius:"50%",
            background:"radial-gradient(circle,white 6%,#fb923c 30%,#dc2626 62%,#7f1d1d 100%)",
            boxShadow:"0 0 0 3px rgba(249,115,22,0.6),0 0 24px 12px rgba(251,146,60,1),0 0 50px 20px rgba(220,38,38,0.64)" })} />
          <div style={ss({ position:"absolute",width:"13px",height:"13px",right:"-5px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 16px 8px rgba(255,255,255,1)" })} />
        </div>
      )

      case "aquos": case "aquo": case "water":
        if (isFehnon) return (
          <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-4px" })}>
            {/* Main slash beam */}
            <div style={ss({ width:`${dist}px`,height:"8px",
              background:"linear-gradient(to right,rgba(14,165,233,0) 0%,rgba(56,189,248,0.46) 8%,white 43%,rgba(125,211,252,0.92) 72%,rgba(56,189,248,0.24) 94%,transparent 100%)",
              borderRadius:"9999px",
              boxShadow:"0 0 22px 10px rgba(56,189,248,0.92),0 0 44px 18px rgba(14,165,233,0.58),0 0 72px 28px rgba(56,189,248,0.22)",
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) forwards` })} />
            {/* 2nd slash +up */}
            <div style={ss({ width:`${dist*.82}px`,height:"3px",
              background:"linear-gradient(to right,transparent,rgba(125,211,252,0.72) 13%,rgba(255,255,255,0.96) 50%,rgba(186,230,253,0.64) 85%,transparent)",
              borderRadius:"9999px",position:"absolute",top:"-13px",left:`${dist*.05}px`,
              boxShadow:"0 0 11px 3px rgba(56,189,248,0.72)",
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) 17ms forwards` })} />
            {/* 3rd slash -down */}
            <div style={ss({ width:`${dist*.62}px`,height:"2px",
              background:"linear-gradient(to right,transparent,rgba(186,230,253,0.7) 19%,rgba(255,255,255,0.82) 56%,transparent)",
              borderRadius:"9999px",position:"absolute",top:"12px",left:`${dist*.12}px`,
              boxShadow:"0 0 8px 2px rgba(56,189,248,0.58)",
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) 32ms forwards` })} />
            {/* Holo micro-edges */}
            <div style={ss({ width:`${dist*.4}px`,height:"1px",
              background:"linear-gradient(to right,transparent,rgba(224,242,254,0.58),transparent)",
              position:"absolute",top:"-24px",left:`${dist*.18}px`,
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) 46ms forwards` })} />
            <div style={ss({ width:`${dist*.32}px`,height:"1px",
              background:"linear-gradient(to right,transparent,rgba(224,242,254,0.48),transparent)",
              position:"absolute",top:"21px",left:`${dist*.24}px`,
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) 54ms forwards` })} />
            {/* Tip orb */}
            <div style={ss({ position:"absolute",width:"26px",height:"26px",borderRadius:"50%",
              right:"-3px",top:"-11px",
              background:"radial-gradient(circle,white 14%,#7dd3fc 48%,#0ea5e9 88%)",
              boxShadow:"0 0 30px 15px rgba(56,189,248,1),0 0 64px 26px rgba(14,165,233,0.72)",
              animation:`a-fehnon-tip ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) forwards` })} />
            {/* Oval ripple */}
            <div style={ss({ position:"absolute",width:"18px",height:"46px",borderRadius:"50%",
              right:"-5px",top:"-21px",
              border:"2px solid rgba(56,189,248,0.78)",
              boxShadow:"0 0 13px 5px rgba(56,189,248,0.68)",
              animation:"a-burst 0.22s ease-out forwards" })} />
          </div>
        )
        return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv })}>
            <div style={ss({ position:"absolute",width:"110px",height:"6px",
              background:"linear-gradient(to right,transparent,rgba(14,165,233,0.38),#0ea5e9,#38bdf8)",
              borderRadius:"9999px",filter:"blur(2px)",opacity:.86 })} />
            {[62,78,92].map((x,i)=>(
              <div key={i} style={ss({ position:"absolute",width:`${10-i*2}px`,height:`${10-i*2}px`,
                borderRadius:"50%",border:`1px solid rgba(125,211,252,${0.64-i*0.14})`,
                left:`${x}px`,top:`${i%2===0?-6:5}px`,opacity:.6 })} />
            ))}
            <div style={ss({ width:"30px",height:"30px",flexShrink:0,borderRadius:"50%",
              background:"radial-gradient(circle,white 9%,#38bdf8 43%,#0284c7 84%)",
              boxShadow:"0 0 0 2px #7dd3fc,0 0 20px 10px rgba(56,189,248,0.96),0 0 42px 17px rgba(14,165,233,0.54)" })} />
          </div>
        )

      case "terra": case "subterra": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          <div style={ss({ position:"absolute",width:"95px",height:"12px",
            background:"linear-gradient(to right,transparent,rgba(120,53,15,0.42),#92400e,#b45309)",
            borderRadius:"4px",filter:"blur(2.5px)",opacity:.86 })} />
          {[{x:22,y:-8,sz:8,r:0},{x:40,y:6,sz:7,r:22},{x:56,y:-6,sz:6,r:45},{x:70,y:5,sz:5,r:15}].map((c,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${c.sz}px`,height:`${c.sz}px`,
              background:"radial-gradient(circle,#d97706,#92400e)",
              borderRadius:"2px",transform:`rotate(${c.r}deg)`,
              left:`${c.x}px`,top:`${c.y}px`,opacity:.76-i*.1 })} />
          ))}
          <div style={ss({ width:"32px",height:"32px",flexShrink:0,borderRadius:"4px",
            transform:"rotate(42deg)",
            background:"radial-gradient(circle,#d97706 13%,#92400e 50%,#451a03 88%)",
            boxShadow:"0 0 0 2px #7c2d12,0 0 20px 10px rgba(146,64,14,0.96),0 0 42px 17px rgba(120,53,15,0.54)" })} />
        </div>
      )

      case "haos": case "light": case "lightness": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-4px" })}>
          <div style={ss({ width:`${dist}px`,height:"9px",
            background:"linear-gradient(to right,rgba(254,240,138,0) 0%,rgba(253,224,71,0.5) 12%,white 46%,rgba(254,249,195,0.92) 78%,rgba(254,240,138,0) 100%)",
            borderRadius:"9999px",
            boxShadow:"0 0 18px 8px rgba(254,240,138,0.96),0 0 38px 16px rgba(253,224,71,0.64),0 0 68px 26px rgba(254,240,138,0.28)",
            animation:`a-laser ${T.STRIKE}ms ease-out forwards` })} />
          <div style={ss({ width:`${dist*.88}px`,height:"4px",
            background:"linear-gradient(to right,transparent,rgba(254,249,195,0.66) 14%,white 52%,transparent)",
            borderRadius:"9999px",position:"absolute",top:"-9px",left:`${dist*.04}px`,
            boxShadow:"0 0 9px 3px rgba(254,240,138,0.76)",
            animation:`a-laser ${T.STRIKE}ms ease-out 12ms forwards` })} />
          <div style={ss({ position:"absolute",right:0,top:"-13px",width:"30px",height:"30px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 30px 15px rgba(254,240,138,1),0 0 66px 28px rgba(253,224,71,0.72)" })} />
        </div>
      )

      case "darkus": case "darkness": case "dark": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          <div style={ss({ position:"absolute",width:"132px",height:"5px",
            background:"linear-gradient(to right,transparent,rgba(88,28,135,0.34),#7e22ce,#a855f7)",
            borderRadius:"9999px",filter:"blur(1.5px)",opacity:.9 })} />
          {[{w:62,y:-10,l:46},{w:50,y:10,l:62},{w:36,y:-16,l:80}].map((t,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${t.w}px`,height:"2px",
              background:"linear-gradient(to right,transparent,rgba(76,29,149,0.58))",
              borderRadius:"9999px",top:`${t.y}px`,left:`${t.l}px` })} />
          ))}
          <div style={ss({ width:"12px",height:"40px",flexShrink:0,borderRadius:"3px",
            background:"linear-gradient(to bottom,#c084fc 0%,#581c87 34%,black 64%,#581c87 100%)",
            boxShadow:"0 0 0 1px rgba(88,28,135,0.82),0 0 20px 10px rgba(88,28,135,0.96),0 0 46px 20px rgba(88,28,135,0.54)" })} />
        </div>
      )

      case "ventus": case "wind":
        if (isUller) return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv })}>
            <div style={ss({ position:"absolute",
              width:`${Math.max(dist*.55,72)}px`,height:"3px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.52),#34d399)",
              borderRadius:"9999px",boxShadow:"0 0 6px 2px rgba(52,211,153,0.54)" })} />
            <div style={ss({ position:"absolute",width:"22px",height:"2.5px",
              background:"rgba(110,231,183,0.74)",borderRadius:"9999px",
              left:"5px",top:"-6px",transformOrigin:"left center",transform:"rotate(-30deg)",
              animation:"a-feather 0.2s ease-in-out infinite" })} />
            <div style={ss({ position:"absolute",width:"22px",height:"2.5px",
              background:"rgba(110,231,183,0.74)",borderRadius:"9999px",
              left:"5px",top:"4px",transformOrigin:"left center",transform:"rotate(30deg)",
              animation:"a-feather 0.2s ease-in-out 0.1s infinite" })} />
            <div style={ss({ position:"absolute",width:"52px",height:"10px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.3))",
              top:"-5px",left:"20px",filter:"blur(3px)" })} />
            <div style={ss({ width:0,height:0,flexShrink:0,
              borderTop:"12px solid transparent",borderBottom:"12px solid transparent",
              borderLeft:"26px solid #34d399",
              filter:"drop-shadow(0 0 10px rgba(52,211,153,0.96)) drop-shadow(0 0 22px rgba(16,185,129,0.64))" })} />
            <div style={ss({ position:"absolute",right:"-6px",width:"12px",height:"12px",
              background:"white",borderRadius:"50%",
              boxShadow:"0 0 15px 8px rgba(52,211,153,1)" })} />
          </div>
        )
        return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv })}>
            <div style={ss({ position:"absolute",width:"110px",height:"27px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.1),rgba(110,231,183,0.27))",
              top:"-13px",borderRadius:"0 50% 50% 0",filter:"blur(4.5px)",opacity:.76 })} />
            <div style={ss({ position:"absolute",width:"76px",height:"38px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.19))",
              top:"-19px",left:"16px",borderRadius:"0 50% 50% 0",filter:"blur(3px)",opacity:.58 })} />
            <div style={ss({ width:"30px",height:"42px",flexShrink:0,borderRadius:"50%",
              border:"3px solid #34d399",
              boxShadow:"0 0 17px 8px rgba(52,211,153,0.92),0 0 36px 15px rgba(16,185,129,0.48)",
              animation:"a-spin 0.1s linear infinite",filter:"blur(0.5px)" })} />
            <div style={ss({ position:"absolute",right:"3px",width:"18px",height:"28px",
              borderRadius:"50%",border:"2px solid #6ee7b7",opacity:.66,
              animation:"a-spin 0.07s linear reverse infinite" })} />
          </div>
        )

      case "void": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-3px",...mv })}>
          <div style={ss({ position:"absolute",
            width:`${Math.min(dist*.65,122)}px`,height:"3px",
            background:"linear-gradient(to right,transparent,rgba(203,213,225,0.36),rgba(255,255,255,0.98))",
            borderRadius:"9999px",boxShadow:"0 0 8px 3px rgba(203,213,225,0.74)",
            animation:`a-laser ${T.STRIKE}ms ease-out forwards` })} />
          {[{x:28,y:-8,s:15,d:0},{x:50,y:6,s:12,d:28},{x:68,y:-5,s:9,d:52}].map((r,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${r.s}px`,height:`${r.s}px`,
              borderRadius:"50%",border:"1px solid rgba(203,213,225,0.52)",
              left:`${r.x}%`,top:`${r.y}px`,opacity:.52,
              animation:`a-burst 0.18s ease-out ${r.d}ms forwards` })} />
          ))}
          <div style={ss({ position:"absolute",right:0,top:"-13px",width:"28px",height:"28px",
            background:"radial-gradient(circle,white 14%,#e2e8f0 50%,#94a3b8 88%)",
            borderRadius:"50%",
            boxShadow:"0 0 22px 11px rgba(203,213,225,0.96),0 0 50px 20px rgba(148,163,184,0.58)" })} />
        </div>
      )

      default: return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          <div style={ss({ position:"absolute",width:"76px",height:"4px",
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.9))",
            borderRadius:"9999px",filter:"blur(1px)" })} />
          <div style={ss({ width:"26px",height:"26px",flexShrink:0,borderRadius:"50%",
            background:"white",boxShadow:"0 0 20px 10px rgba(255,255,255,0.82)" })} />
        </div>
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ④ IMPACT (80ms) — hero frame: flash + compression
  // ══════════════════════════════════════════════════════════════════════════
  const Impact = () => {
    const flashColors: Record<string,string> = {
      pyrus:"rgba(255,120,0,0.6)",    fire:"rgba(255,120,0,0.6)",
      aquos:"rgba(56,189,248,0.5)",   aquo:"rgba(56,189,248,0.5)",   water:"rgba(56,189,248,0.5)",
      terra:"rgba(120,53,15,0.5)",    subterra:"rgba(120,53,15,0.5)",
      haos:"rgba(255,255,180,0.65)",  light:"rgba(255,255,180,0.65)", lightness:"rgba(255,255,180,0.65)",
      darkus:"rgba(88,28,135,0.55)",  darkness:"rgba(88,28,135,0.55)", dark:"rgba(88,28,135,0.55)",
      ventus:"rgba(52,211,153,0.5)",  wind:"rgba(52,211,153,0.5)",
      void:"rgba(203,213,225,0.55)",
    }
    const glowColors: Record<string,string> = {
      pyrus:"rgba(249,115,22,1)",    aquos:"rgba(56,189,248,1)",
      aquos_fehnon:"rgba(56,189,248,1)", terra:"rgba(180,83,9,1)",
      haos:"rgba(254,240,138,1)",    darkus:"rgba(88,28,135,1)",
      ventus:"rgba(52,211,153,1)",   ventus_uller:"rgba(52,211,153,1)",
      void:"rgba(203,213,225,1)",
    }
    const resolveKey = (e:string) => {
      const m:{[k:string]:string}={fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",
        light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus"}
      const base = m[e]??e
      if(base==="aquos"&&isFehnon) return "aquos_fehnon"
      if(base==="ventus"&&isUller) return "ventus_uller"
      return base
    }
    const key = resolveKey(el)
    const flash = flashColors[el] ?? "rgba(255,255,255,0.5)"
    const glow  = glowColors[key] ?? "rgba(255,255,255,1)"

    return (
      <div style={ss({ position:"absolute",left:0,top:0,width:0,height:0,
        transform:`rotate(${-aDeg}deg)` })}>
        {/* Full-screen flash — brief, powerful */}
        <div style={ss({ position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",
          background:flash,animation:"a-hero-flash 80ms linear forwards",pointerEvents:"none" })} />
        {/* Localized impact compression */}
        <div style={ss({ position:"absolute",left:"-60px",top:"-60px",width:"120px",height:"120px",
          borderRadius:"50%",background:glow,filter:"blur(20px)",
          animation:"a-hero-compress 80ms ease-out forwards" })} />
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ⑤ AFTERMATH — particles + residuals + distortion
  // ══════════════════════════════════════════════════════════════════════════
  const Aftermath = () => {
    type C = {r1:string;r2:string;r3:string;core:string;cg:string;gw:string;pc:string[];res:string}

    const resolveKey = (e:string): string => {
      const m:{[k:string]:string}={fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",
        light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus"}
      const base = m[e]??e
      if(base==="aquos"&&isFehnon) return "aquos_fehnon"
      if(base==="ventus"&&isUller) return "ventus_uller"
      return base
    }

    const cfgs: Record<string,C> = {
      pyrus:{r1:"#f97316",r2:"#fbbf24",r3:"#ef4444",
        core:"radial-gradient(circle,white 5%,#fb923c 26%,#dc2626 56%,#7f1d1d 88%)",
        cg:"rgba(249,115,22,0.96)",gw:"rgba(220,38,38,0.56)",
        pc:["#7f1d1d","#991b1b","#dc2626","#ea580c","#f97316","#fb923c","#fbbf24","#fef3c7","white"],
        res:"rgba(220,38,38,0.18)"},
      aquos:{r1:"#38bdf8",r2:"#7dd3fc",r3:"#0ea5e9",
        core:"radial-gradient(circle,white 5%,#38bdf8 30%,#0284c7 62%,#0c4a6e 90%)",
        cg:"rgba(56,189,248,0.92)",gw:"rgba(14,165,233,0.46)",
        pc:["#082f49","#0c4a6e","#0284c7","#0ea5e9","#38bdf8","#7dd3fc","#bae6fd","white"],
        res:"rgba(56,189,248,0.14)"},
      aquos_fehnon:{r1:"#38bdf8",r2:"white",r3:"#7dd3fc",
        core:"radial-gradient(circle,white 7%,#bae6fd 22%,#38bdf8 46%,#0284c7 72%,#075985 93%)",
        cg:"rgba(56,189,248,1)",gw:"rgba(14,165,233,0.72)",
        pc:["white","#f0f9ff","#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9"],
        res:"rgba(56,189,248,0.2)"},
      terra:{r1:"#b45309",r2:"#d97706",r3:"#92400e",
        core:"radial-gradient(circle,#fbbf24 5%,#b45309 30%,#7c2d12 60%,#431407 90%)",
        cg:"rgba(180,83,9,0.96)",gw:"rgba(120,53,15,0.56)",
        pc:["#1c0a04","#431407","#7c2d12","#92400e","#b45309","#d97706","#fbbf24"],
        res:"rgba(120,53,15,0.16)"},
      haos:{r1:"#fde047",r2:"white",r3:"#fef08a",
        core:"radial-gradient(circle,white 8%,#fef9c3 28%,#fef08a 54%,#fde047 80%)",
        cg:"rgba(254,240,138,1)",gw:"rgba(253,224,71,0.66)",
        pc:["white","#fefce8","#fef9c3","#fef08a","#fde047","#fbbf24","#f59e0b","#ffd700"],
        res:"rgba(253,224,71,0.22)"},
      darkus:{r1:"#7e22ce",r2:"#a855f7",r3:"#4c1d95",
        core:"radial-gradient(circle,#e879f9 5%,#a855f7 26%,#7e22ce 50%,#1e1b4b 80%,#0f0a1e 95%)",
        cg:"rgba(88,28,135,0.98)",gw:"rgba(88,28,135,0.66)",
        pc:["#030712","#0f0a1e","#1e1b4b","#4c1d95","#7e22ce","#a855f7","#c084fc","#e879f9"],
        res:"rgba(88,28,135,0.18)"},
      ventus:{r1:"#34d399",r2:"#6ee7b7",r3:"#059669",
        core:"radial-gradient(circle,white 5%,#6ee7b7 28%,#10b981 56%,#064e3b 88%)",
        cg:"rgba(52,211,153,0.96)",gw:"rgba(5,150,105,0.5)",
        pc:["#022c22","#064e3b","#059669","#34d399","#6ee7b7","#a7f3d0","white"],
        res:"rgba(52,211,153,0.14)"},
      ventus_uller:{r1:"#34d399",r2:"white",r3:"#a7f3d0",
        core:"radial-gradient(circle,white 9%,#a7f3d0 26%,#34d399 50%,#059669 78%)",
        cg:"rgba(52,211,153,1)",gw:"rgba(16,185,129,0.56)",
        pc:["white","#f0fdf4","#dcfce7","#a7f3d0","#6ee7b7","#34d399","#10b981"],
        res:"rgba(52,211,153,0.16)"},
      void:{r1:"#cbd5e1",r2:"white",r3:"#94a3b8",
        core:"radial-gradient(circle,white 9%,#f1f5f9 26%,#e2e8f0 50%,#94a3b8 76%)",
        cg:"rgba(203,213,225,1)",gw:"rgba(148,163,184,0.56)",
        pc:["white","#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8","#64748b"],
        res:"rgba(148,163,184,0.16)"},
    }

    const c       = cfgs[resolveKey(el)] ?? cfgs.void
    const iBase   = aRad + Math.PI
    const isTerra = el==="terra"||el==="subterra"
    const isFeh   = isFehnon&&(el==="aquos"||el==="aquo"||el==="water")
    const isDark  = el==="darkus"||el==="darkness"||el==="dark"
    const isVoid  = el==="void"

    return (
      <div style={ss({ position:"absolute",left:0,top:0,width:0,height:0,
        transform:`rotate(${-aDeg}deg)` })}>

        {/* ── Localized micro shake (160×160px box, not full screen) ── */}
        <div style={ss({ position:"absolute",left:"-80px",top:"-80px",width:"160px",height:"160px",
          animation:"a-local-shake 0.2s cubic-bezier(.36,.07,.19,.97) both" })}>

          {/* 4 shockwave rings — rolling wave */}
          {[{s:148,bw:3,d:0,op:1},{s:116,bw:2,d:26,op:.66},{s:84,bw:2,d:50,op:.46},{s:58,bw:1,d:0,op:.32}].map(({s,bw,d,op},i)=>(
            <div key={i} style={ss({ position:"absolute",
              left:`${80-s/2}px`,top:`${80-s/2}px`,width:s,height:s,
              borderRadius:"50%",
              border:`${bw}px solid ${i===1?c.r2:i===2?c.r3:c.r1}`,
              boxShadow: i===0 ? `0 0 26px 11px ${c.cg}` : undefined,
              opacity:op,
              animation:`a-ring ${T.AFTERMATH}ms ease-out ${d}ms forwards` })} />
          ))}

          {/* Core explosion — 3-stage */}
          <div style={ss({ position:"absolute",left:"20px",top:"20px",width:"120px",height:"120px",
            borderRadius:"50%",background:c.core,
            boxShadow:`0 0 64px 28px ${c.cg},0 0 130px 52px ${c.gw}`,
            animation:`a-core ${T.AFTERMATH}ms cubic-bezier(0.04,0.92,0.11,1) forwards` })} />

          {/* Residual glow lingering */}
          <div style={ss({ position:"absolute",left:"28px",top:"28px",width:"104px",height:"104px",
            borderRadius:"50%",background:c.res,filter:"blur(10px)",
            animation:`a-residual ${T.AFTERMATH}ms ease-out forwards` })} />

          {/* VOID ONLY: spatial distortion rings (glitch) */}
          {isVoid && [50,70,90].map((s,i)=>(
            <div key={i} style={ss({ position:"absolute",
              left:`${80-s/2}px`,top:`${80-s/2}px`,width:s,height:s,
              borderRadius:"50%",border:"1px solid rgba(203,213,225,0.5)",
              animation:`a-void-glitch ${T.AFTERMATH*.4}ms ease-out ${i*40}ms forwards` })} />
          ))}

        </div>

        {/* ── FEHNON: scar lines (outside shake wrapper) ── */}
        {isFeh && [
          {w:140,r:0,  t:-3,d:0 },{w:108,r:-20,t:-3,d:8 },
          {w:108,r:20, t:-3,d:8 },{w:80, r:-40,t:-2,d:18},
          {w:80, r:40, t:-2,d:18},{w:56, r:-60,t:-1,d:30},
          {w:56, r:60, t:-1,d:30},{w:38, r:-78,t:0, d:42},
          {w:38, r:78, t:0, d:42},
        ].map((s,i)=>(
          <div key={i} style={ss({ position:"absolute",height:"2.5px",width:`${s.w}px`,
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.96),rgba(125,211,252,0.78),transparent)",
            borderRadius:"9999px",top:`${s.t}px`,left:0,
            transform:`rotate(${s.r}deg)`,transformOrigin:"left center",
            boxShadow:"0 0 9px 2px rgba(56,189,248,0.8)",
            animation:`a-slash ${T.AFTERMATH*.65}ms cubic-bezier(0,0,0.13,1) ${s.d}ms forwards` })} />
        ))}
        {isFeh && [-21,-13,-6,1,8,15].map((y,i)=>(
          <div key={`sc${i}`} style={ss({ position:"absolute",height:"1px",
            width:`${90-Math.abs(y)*2}px`,
            background:`linear-gradient(to right,transparent,rgba(186,230,253,${.42+Math.abs(i-2.5)*.09}),transparent)`,
            borderRadius:"9999px",top:`${y}px`,left:"50%",transform:"translateX(-50%)",
            animation:`a-slash ${T.AFTERMATH*.48}ms ease-out ${i*10}ms forwards` })} />
        ))}

        {/* ── DARKUS: void absorption tendrils (linger outward) ── */}
        {isDark && [0,60,120,180,240,300].map((a,i)=>(
          <div key={i} style={ss({ position:"absolute",height:"2px",
            width:"56px",borderRadius:"9999px",
            background:"linear-gradient(to right,rgba(88,28,135,0.72),transparent)",
            transformOrigin:"right center",
            transform:`rotate(${a}deg) translateX(-56px)`,
            animation:`a-dark-abs ${T.AFTERMATH*.75}ms ease-in ${i*16}ms forwards` })} />
        ))}

        {/* ── Particles ── */}
        {pts.map(p => {
          const a   = iBase + p.angle * .82
          const d   = p.spd * p.life
          const px  = Math.cos(a)*d + p.jx
          const py  = Math.sin(a)*d + p.jy
          const col = c.pc[p.id % c.pc.length]
          const rot = isFeh ? Math.atan2(py,px)*180/Math.PI : isDark ? p.spin : 0
          return (
            <div key={p.id} style={ss({
              position:"absolute",
              width:`${p.sz}px`,
              height:`${isFeh?p.sz*.34:isTerra?p.sz*.64:isDark?p.sz*1.5:p.sz}px`,
              borderRadius: isTerra||isFeh ? "2px" : isDark ? "1px 5px 1px 5px" : "50%",
              background:col,
              boxShadow:`0 0 5px 2px ${col}96`,
              transform: rot ? `rotate(${rot}deg)` : undefined,
              animation:`a-particle ${T.AFTERMATH}ms cubic-bezier(0.02,0.56,0.12,1) ${p.del}ms forwards`,
              "--px":`${px}px`,"--py":`${py}px`,opacity:0,
            } as React.CSSProperties)} />
          )
        })}
      </div>
    )
  }

  // ── Render phase ──────────────────────────────────────────────────────────
  let content: React.ReactNode = null
  if      (phase==="charge")   content = <Charge />
  else if (phase==="release")  content = <Release />
  else if (phase==="strike")   content = <Strike />
  else if (phase==="impact")   content = <Impact />
  else if (phase==="aftermath") content = <Aftermath />

  const output = (
    <>
      <style>{`
        /* ── Charge ──────────────────────────────────────────────────── */
        @keyframes a-spin           { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
        @keyframes a-burst          { 0%{transform:scale(.25);opacity:1} 100%{transform:scale(1.78);opacity:0} }
        @keyframes a-pulse-fire     { 0%,100%{opacity:.74;transform:scale(1)} 50%{opacity:1;transform:scale(1.22)} }
        @keyframes a-terra-pulse    { 0%,100%{opacity:.72;transform:scale(1) rotate(45deg)} 50%{opacity:1;transform:scale(1.2) rotate(45deg)} }
        @keyframes a-haos-halo      { 0%,100%{opacity:.64;transform:scale(1)} 50%{opacity:1;transform:scale(1.36)} }
        @keyframes a-haos-ray       { 0%,100%{opacity:.6;transform-origin:50% 100%;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.42)} }
        @keyframes a-dark-consume   { 0%{transform:scale(1.46);opacity:.86} 100%{transform:scale(.44);opacity:.22} }
        @keyframes a-dark-tendril   { 0%,100%{opacity:.64;transform-origin:left center;transform:scaleX(1)} 50%{opacity:1;transform:scaleX(1.42)} }
        @keyframes a-gather         { 0%{opacity:0;transform-origin:left center;transform:translateX(12px) scaleX(0)} 100%{opacity:.84;transform:translateX(12px) scaleX(1)} }
        @keyframes a-terra-crack    { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 100%{opacity:.84;transform:scaleX(1)} }
        @keyframes a-fehnon-contract{ 0%{transform:scale(1.58);opacity:0} 50%{opacity:1} 100%{transform:scale(.18);opacity:0} }
        @keyframes a-fehnon-scan    { 0%{opacity:0;transform:translateX(-50%) scaleX(0)} 42%{opacity:1} 100%{opacity:0;transform:translateX(-50%) scaleX(1)} }
        /* ── Release ─────────────────────────────────────────────────── */
        @keyframes a-release-burst  { 0%{transform:scale(.3);opacity:1;border-width:8px} 100%{transform:scale(2.4);opacity:0;border-width:1px} }
        @keyframes a-release-core   { 0%{opacity:1;transform:scale(1.5)} 100%{opacity:0;transform:scale(3)} }
        /* ── Strike ──────────────────────────────────────────────────── */
        @keyframes a-move           { 0%{transform:translateX(0)} 100%{transform:translateX(${dist}px)} }
        @keyframes a-laser          { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 6%{opacity:1} 70%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes a-slash          { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 5%{opacity:1} 64%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes a-fehnon-tip     { 0%{transform:translateX(${-dist}px);opacity:0} 6%{opacity:1} 100%{transform:translateX(0);opacity:1} }
        @keyframes a-feather        { 0%,100%{transform:rotate(-30deg);opacity:.74} 50%{transform:rotate(-22deg);opacity:1} }
        /* ── Impact ──────────────────────────────────────────────────── */
        @keyframes a-hero-flash     { 0%{opacity:1} 50%{opacity:.7} 100%{opacity:0} }
        @keyframes a-hero-compress  { 0%{transform:scale(.1);opacity:1} 50%{transform:scale(1.4);opacity:.9} 100%{transform:scale(2);opacity:0} }
        /* ── Aftermath ───────────────────────────────────────────────── */
        @keyframes a-local-shake    {
          0%  {transform:translate(0,0)}
          10% {transform:translate(-5px,-2px)}
          22% {transform:translate(5px,3px)}
          34% {transform:translate(-4px,1px)}
          46% {transform:translate(3px,-2px)}
          58% {transform:translate(-2px,1px)}
          74% {transform:translate(1px,1px)}
          100%{transform:translate(0,0)}
        }
        @keyframes a-ring           { 0%{transform:scale(.07);opacity:1;border-width:8px} 44%{opacity:.62} 100%{transform:scale(2.9);opacity:0;border-width:1px} }
        @keyframes a-core           { 0%{transform:scale(.03);opacity:1} 16%{transform:scale(1.38);opacity:1} 46%{transform:scale(1.06);opacity:.78} 100%{transform:scale(0);opacity:0} }
        @keyframes a-residual       { 0%{opacity:0} 16%{opacity:1} 58%{opacity:.52} 100%{opacity:0;transform:scale(1.5)} }
        @keyframes a-particle       { 0%{transform:translate(0,0) scale(2);opacity:1} 100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0} }
        @keyframes a-dark-abs       { 0%{opacity:0;transform-origin:right center;transform:scaleX(0)} 28%{opacity:.72} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes a-void-glitch    { 0%{transform:scale(.2) skewX(0deg);opacity:.8} 40%{transform:scale(1.2) skewX(3deg);opacity:.5} 70%{transform:scale(1.6) skewX(-2deg);opacity:.2} 100%{transform:scale(2.2) skewX(0deg);opacity:0} }
        /* ── Afterimage ──────────────────────────────────────────────── */
        @keyframes afterimage-fade  { 0%{opacity:.22} 100%{opacity:0} }
      `}</style>

      {/* Attacker ghost */}
      {attackerImage && (phase==="charge"||phase==="release"||phase==="strike") && (
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
