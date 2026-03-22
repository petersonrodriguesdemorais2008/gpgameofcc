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

type Phase = "charge" | "release" | "strike" | "impact" | "aftermath"

// ── Performance rule: NEVER animate filter/width/height/left/top. ──
// Only transform + opacity are GPU-composited and never cause repaints.

const T = {
  CHARGE:   240,
  RELEASE:   50,
  STRIKE:   270,
  IMPACT:   160,
  AFTERMATH: 540,
  get TOTAL() { return this.CHARGE + this.RELEASE + this.STRIKE + this.IMPACT + this.AFTERMATH }
}

const seed = (id: string, i: number): number => {
  let h = (i + 1) * 2654435761
  for (const c of id) h = (h ^ c.charCodeAt(0) * 1000003) >>> 0
  return h / 4294967295
}
const rv = (a: number, b: number, v: number) => a + v * (b - a)

const mkP = (n: number, spread: number, sMin: number, sMax: number, id: string) =>
  Array.from({ length: n }).map((_, i) => ({
    id: i,
    angle: rv(-spread/2, spread/2, seed(id,i)) * (Math.PI/180),
    spd:   rv(sMin, sMax,          seed(id,i+100)),
    sz:    rv(2.5, 8.5,            seed(id,i+200)),
    life:  rv(0.4, 1,              seed(id,i+300)),
    del:   rv(0, 60,               seed(id,i+400)),
    jx:    rv(-3, 3,               seed(id,i+500)),
    jy:    rv(-3, 3,               seed(id,i+600)),
    spin:  rv(0, 360,              seed(id,i+700)),
    riseY: rv(-20, -55,            seed(id,i+800)),
  }))

const ss = (s: React.CSSProperties) => s

// Ring helper — GPU: only opacity/transform animated, never layout props
const Ring = ({ d, bw="2px", bc, bg, glow, anim, op=1, delay }: {
  d:number; bw?:string; bc?:string; bg?:string; glow?:string
  anim?:string; op?:number; delay?:number
}) => (
  <div style={ss({ position:"absolute", width:d, height:d,
    marginLeft:-d/2, marginTop:-d/2, borderRadius:"50%",
    border:bc?`${bw} solid ${bc}`:undefined,
    background:bg, boxShadow:glow, opacity:op, animation:anim,
    animationDelay:delay?`${delay}ms`:undefined,
    willChange:"transform,opacity" })} />
)

export function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY,
  element, attackerImage, attackerName,
  portalTarget, onImpact, onComplete,
}: AttackAnimationProps) {
  const [phase, setPhase] = useState<Phase>("charge")
  const [mounted, setMounted] = useState(false)

  const dist = Math.hypot(targetX-startX, targetY-startY)
  const aRad = Math.atan2(targetY-startY, targetX-startX)
  const aDeg = aRad * (180/Math.PI)
  const el   = element?.toLowerCase().trim() || "neutral"

  const isUller  = /ullr|uller/i.test(attackerName || "")
  const isFehnon = /fehnon/i.test(attackerName || "")

  const pts = useMemo(() => {
    const tbl: Record<string,[number,number,number,number]> = {
      pyrus:[26,125,40,92],   fire:[26,125,40,92],
      aquos:[18,110,30,76],   aquo:[18,110,30,76],  water:[18,110,30,76],
      terra:[18,105,28,70],   subterra:[18,105,28,70],
      haos:[30,170,36,88],    light:[30,170,36,88],  lightness:[30,170,36,88],
      darkus:[22,118,22,64],  darkness:[22,118,22,64], dark:[22,118,22,64],
      ventus:[26,142,30,78],  wind:[26,142,30,78],
      void:[26,355,20,66],
    }
    const [n,sp,mn,mx] = tbl[el] ?? [16,108,28,72]
    return mkP(n, sp, mn, mx, id)
  }, [el, id])

  const doneRef = useRef(onComplete)
  useEffect(() => { doneRef.current = onComplete }, [onComplete])

  useEffect(() => {
    setMounted(true)
    const tm = [
      setTimeout(() => setPhase("release"),   T.CHARGE),
      setTimeout(() => setPhase("strike"),    T.CHARGE + T.RELEASE),
      setTimeout(() => { setPhase("impact"); onImpact?.(id,targetX,targetY,el) },
                                              T.CHARGE + T.RELEASE + T.STRIKE),
      setTimeout(() => setPhase("aftermath"), T.CHARGE + T.RELEASE + T.STRIKE + T.IMPACT),
      setTimeout(() => doneRef.current(id),   T.TOTAL),
    ]
    return () => tm.forEach(clearTimeout)
  }, [id])

  if (!mounted) return null

  const inFlight = phase==="charge"||phase==="release"||phase==="strike"
  const ctr: React.CSSProperties = inFlight
    ? { position:"absolute",left:startX,top:startY,width:dist,height:60,marginTop:-30,
        pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)`,
        contain:"layout style paint",willChange:"transform" }
    : { position:"absolute",left:targetX,top:targetY,width:0,height:60,marginTop:-30,
        pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)`,
        contain:"layout style paint" }

  // ═══════════════════════════════════════════════════════
  //  CHARGE — energy building at attacker
  // ═══════════════════════════════════════════════════════
  const Charge = () => {
    const hub = (sz=96, ch: React.ReactNode) => (
      <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
        width:sz,height:sz,display:"flex",alignItems:"center",justifyContent:"center",
        willChange:"transform" })}>
        {ch}
      </div>
    )
    switch (el) {

      case "pyrus": case "fire": return hub(104, <>
        <Ring d={92} bc="#f97316" bw="2px" glow="0 0 20px 8px rgba(249,115,22,0.7)" anim="a-spin 0.15s linear infinite" op={0.9} />
        <Ring d={70} bc="#fbbf24" bw="3px" glow="0 0 14px 6px rgba(251,191,36,0.7)" anim="a-spin 0.10s linear reverse infinite" op={0.8} />
        <Ring d={48} bc="#ef4444" bw="2px" glow="0 0 12px 6px rgba(239,68,68,0.8)"  anim="a-spin 0.07s linear infinite" op={0.7} />
        {[{r:46,s:6,c:"rgba(251,191,36,0.95)",dur:260,del:0},{r:40,s:5,c:"rgba(249,115,22,0.85)",dur:200,del:86},{r:44,s:4,c:"rgba(255,255,255,0.8)",dur:240,del:44}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*1.5}px ${o.s}px ${o.c}`,
            animation:`a-orbit-${i} ${o.dur}ms linear ${o.del}ms infinite`,
            willChange:"transform" })} />
        ))}
        <div style={ss({ position:"absolute",width:34,height:34,borderRadius:"50%",
          background:"radial-gradient(circle,white 6%,#fb923c 30%,#dc2626 62%,#7f1d1d 100%)",
          boxShadow:"0 0 0 5px #f97316,0 0 30px 15px rgba(251,146,60,1),0 0 60px 24px rgba(220,38,38,0.7)",
          animation:"a-fire-pulse 0.07s ease-in-out infinite",willChange:"transform,opacity" })} />
        <Ring d={96} bg="radial-gradient(circle,rgba(251,146,60,0.20) 0%,transparent 70%)" anim="a-fire-pulse 0.09s ease-in-out infinite" />
      </>)

      case "aquos": case "aquo": case "water":
        if (isFehnon) return hub(110, <>
          {[98,78,60,44].map((d,i) => (
            <div key={i} style={ss({ position:"absolute",width:d,height:d,
              marginLeft:-d/2,marginTop:-d/2,borderRadius:"50%",
              border:`${i===0?"2px":"1px"} solid rgba(56,189,248,${0.84-i*0.16})`,
              boxShadow:i===0?"0 0 20px 8px rgba(56,189,248,0.6)":undefined,
              animation:`a-fehnon-contract 0.19s cubic-bezier(.44,0,1,1) ${i*26}ms forwards`,
              willChange:"transform,opacity" })} />
          ))}
          {[-28,-19,-12,-5,1,8,14,20,27].map((y,i) => (
            <div key={i} style={ss({ position:"absolute",height:"1.5px",
              width:`${82-Math.abs(y)*1.5}px`,
              background:`linear-gradient(to right,transparent,rgba(56,189,248,${.22+Math.abs(i-4)*.13}),rgba(255,255,255,${.52+Math.abs(i-4)*.1}),rgba(56,189,248,${.22+Math.abs(i-4)*.13}),transparent)`,
              borderRadius:"9999px",
              top:`calc(50% + ${y}px)`,left:"50%",transform:"translateX(-50%)",
              animation:`a-fehnon-scan 0.19s ease-out ${i*8}ms forwards`,
              willChange:"transform,opacity" })} />
          ))}
          <div style={ss({ position:"absolute",width:23,height:23,borderRadius:"3px",
            transform:"rotate(45deg)",
            background:"radial-gradient(circle,white 7%,#7dd3fc 32%,#0ea5e9 80%)",
            boxShadow:"0 0 0 2px #38bdf8,0 0 28px 14px rgba(56,189,248,1),0 0 52px 24px rgba(14,165,233,0.7)",
            animation:"a-fire-pulse 0.08s ease-in-out infinite",willChange:"transform,opacity" })} />
          <Ring d={106} bg="radial-gradient(circle,rgba(56,189,248,0.18) 0%,transparent 68%)" anim="a-fire-pulse 0.13s ease-in-out infinite" />
        </>)
        return hub(96, <>
          <Ring d={84} bc="#38bdf8" bw="2px" glow="0 0 16px 7px rgba(56,189,248,0.65)" anim="a-spin 0.26s linear infinite" op={0.8} />
          <Ring d={62} bc="#7dd3fc" bw="2px" glow="0 0 11px 5px rgba(125,211,252,0.55)" anim="a-spin 0.20s linear reverse infinite" op={0.65} />
          <Ring d={42} bc="#bae6fd" bw="1px" anim="a-spin 0.13s linear infinite" op={0.48} />
          {[{r:42,s:5,c:"rgba(56,189,248,0.92)",dur:340,del:0},{r:38,s:4,c:"rgba(125,211,252,0.8)",dur:260,del:120}].map((o,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
              borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*1.5}px ${o.s}px ${o.c}`,
              animation:`a-orbit-aq${i} ${o.dur}ms linear ${o.del}ms infinite`,willChange:"transform" })} />
          ))}
          <div style={ss({ position:"absolute",width:22,height:22,borderRadius:"50%",
            background:"radial-gradient(circle,white 12%,#38bdf8 46%,#0284c7 88%)",
            boxShadow:"0 0 0 2px #7dd3fc,0 0 24px 12px rgba(56,189,248,0.94),0 0 48px 20px rgba(14,165,233,0.55)",
            animation:"a-fire-pulse 0.11s ease-in-out infinite",willChange:"transform,opacity" })} />
          <Ring d={92} bg="radial-gradient(circle,rgba(56,189,248,0.14) 0%,transparent 70%)" anim="a-fire-pulse 0.14s ease-in-out infinite" />
          <Ring d={92} bc="rgba(56,189,248,0.35)" bw="1px" anim="a-burst 0.18s ease-out infinite" />
        </>)

      case "terra": case "subterra": return hub(98, <>
        {[0,40,80,120,160,200,240,280,320].map((a,i) => (
          <div key={a} style={ss({ position:"absolute",width:"30px",height:"3px",
            background:"linear-gradient(to right,rgba(180,83,9,0.9),rgba(217,119,6,0.35),transparent)",
            borderRadius:"3px",transformOrigin:"left center",
            transform:`rotate(${a}deg) translateX(14px)`,
            animation:`a-terra-crack 0.17s ease-out ${i*10}ms both`,willChange:"transform,opacity" })} />
        ))}
        {[{r:44,s:7,c:"rgba(180,83,9,0.82)",dur:520,del:0},{r:40,s:5,c:"rgba(217,119,6,0.72)",dur:440,del:160},{r:46,s:4,c:"rgba(251,191,36,0.62)",dur:480,del:80}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"2px",background:o.c,boxShadow:`0 0 ${o.s}px ${o.s*0.8}px ${o.c}`,
            animation:`a-orbit-tr${i} ${o.dur}ms linear ${o.del}ms infinite`,willChange:"transform" })} />
        ))}
        <Ring d={78} bc="#92400e" bw="2px" glow="0 0 14px 6px rgba(146,64,14,0.6)" anim="a-spin 0.28s linear infinite" op={0.7} />
        <div style={ss({ position:"absolute",width:30,height:30,borderRadius:"3px",
          transform:"rotate(45deg)",
          background:"radial-gradient(circle,#fbbf24 8%,#b45309 38%,#7c2d12 80%)",
          boxShadow:"0 0 0 4px #92400e,0 0 26px 13px rgba(180,83,9,0.95),0 0 54px 22px rgba(120,53,15,0.6)",
          animation:"a-terra-pulse 0.11s ease-in-out infinite",willChange:"transform,opacity" })} />
        <Ring d={92} bc="rgba(180,83,9,0.48)" bw="1px" anim="a-burst 0.17s ease-out infinite" />
        <Ring d={98} bg="radial-gradient(circle,rgba(120,53,15,0.26) 0%,transparent 70%)" anim="a-terra-pulse 0.14s ease-in-out infinite" />
      </>)

      case "haos": case "light": case "lightness": return hub(110, <>
        {Array.from({length:16},(_,i)=>i*22.5).map((a,i) => (
          <div key={a} style={ss({ position:"absolute",width:"2px",
            height:i%4===0?"30px":i%2===0?"20px":"13px",
            background:"linear-gradient(to top,transparent,rgba(254,249,195,0.82),white)",
            borderRadius:"9999px",transformOrigin:"50% 100%",
            transform:`rotate(${a}deg) translateY(-${i%4===0?26:i%2===0?18:12}px)`,
            opacity:i%4===0?1:i%2===0?0.74:0.5,
            animation:`a-haos-ray 0.09s ease-in-out ${i%3===0?0:i%3===1?30:60}ms infinite`,
            willChange:"transform,opacity" })} />
        ))}
        {[{r:52,s:6,c:"rgba(253,224,71,0.98)",dur:185,del:0},{r:48,s:5,c:"rgba(255,255,255,0.92)",dur:150,del:46},{r:52,s:5,c:"rgba(254,240,138,0.88)",dur:200,del:92},{r:48,s:4,c:"rgba(253,224,71,0.82)",dur:170,del:138}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*2}px ${o.s}px ${o.c}`,
            animation:`a-orbit-ha${i} ${o.dur}ms linear ${o.del}ms infinite`,willChange:"transform" })} />
        ))}
        <div style={ss({ position:"absolute",width:34,height:34,borderRadius:"50%",
          background:"white",
          boxShadow:"0 0 0 6px #fef08a,0 0 0 11px rgba(253,224,71,0.44),0 0 52px 26px rgba(254,240,138,1),0 0 100px 40px rgba(253,224,71,0.44)",
          animation:"a-fire-pulse 0.07s ease-in-out infinite",willChange:"transform,opacity" })} />
        <Ring d={104} bg="radial-gradient(circle,rgba(254,240,138,0.35) 0%,transparent 65%)" anim="a-haos-halo 0.09s ease-in-out infinite" />
        <Ring d={110} bc="rgba(254,240,138,0.46)" bw="1px" anim="a-burst 0.11s ease-out infinite" />
      </>)

      case "darkus": case "darkness": case "dark": return hub(98, <>
        <Ring d={94} bc="#7e22ce" bw="2px" glow="0 0 24px 11px rgba(88,28,135,0.78)" anim="a-dark-consume 0.21s ease-in infinite" op={0.88} />
        <Ring d={72} bc="#a855f7" bw="2px" glow="0 0 16px 7px rgba(168,85,247,0.65)" anim="a-spin 0.27s linear reverse infinite" op={0.7} />
        <Ring d={52} bc="#c084fc" bw="1px" anim="a-spin 0.17s linear infinite" op={0.52} />
        {[0,51,103,154,206,257,308].map((a,i) => (
          <div key={a} style={ss({ position:"absolute",width:"28px",height:"2px",
            background:"linear-gradient(to right,rgba(88,28,135,0.94),rgba(88,28,135,0.22),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",
            transform:`rotate(${a}deg) translateX(10px)`,opacity:.84,
            animation:`a-dark-tendril 0.21s ease-in-out ${i*20}ms infinite`,willChange:"transform,opacity" })} />
        ))}
        {[{r:48,s:5,c:"rgba(88,28,135,0.72)",dur:740,del:0},{r:44,s:4,c:"rgba(168,85,247,0.62)",dur:620,del:200},{r:48,s:3,c:"rgba(192,132,252,0.52)",dur:680,del:400}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"50%",background:o.c,
            animation:`a-orbit-dk${i} ${o.dur}ms linear ${o.del}ms infinite reverse`,willChange:"transform" })} />
        ))}
        <div style={ss({ position:"absolute",width:23,height:23,borderRadius:"50%",
          background:"radial-gradient(circle,#0f0a1e 16%,black 55%)",
          boxShadow:"0 0 0 4px #581c87,0 0 0 9px rgba(88,28,135,0.5),0 0 40px 20px rgba(88,28,135,1),0 0 82px 34px rgba(88,28,135,0.58)" })} />
        <Ring d={96} bg="radial-gradient(circle,rgba(88,28,135,0.46) 0%,transparent 70%)" anim="a-dark-consume 0.13s ease-in infinite" />
      </>)

      case "ventus": case "wind":
        if (isUller) return hub(96, <>
          {[0,36,72,108,144,180,216,252,288,324].map((a,i) => (
            <div key={a} style={ss({ position:"absolute",width:"27px",height:"2px",
              background:"linear-gradient(to right,rgba(52,211,153,0),#6ee7b7)",
              borderRadius:"9999px",transformOrigin:"left center",
              transform:`rotate(${a}deg) translateX(12px)`,opacity:.86,
              animation:`a-gather 0.18s ease-in ${i*13}ms both`,willChange:"transform,opacity" })} />
          ))}
          <div style={ss({ position:"absolute",width:23,height:23,borderRadius:"50%",
            background:"radial-gradient(circle,white 15%,#6ee7b7 50%,#059669 87%)",
            boxShadow:"0 0 0 3px #34d399,0 0 28px 14px rgba(52,211,153,0.97),0 0 56px 24px rgba(16,185,129,0.6)",
            animation:"a-fire-pulse 0.1s ease-in-out infinite",willChange:"transform,opacity" })} />
          <Ring d={88} bc="rgba(52,211,153,0.55)" bw="1px" anim="a-burst 0.13s ease-out infinite" op={0.64} />
          <Ring d={96} bg="radial-gradient(circle,rgba(52,211,153,0.18) 0%,transparent 70%)" anim="a-fire-pulse 0.12s ease-in-out infinite" />
        </>)
        return hub(96, <>
          <Ring d={88} bc="#34d399" bw="2px" glow="0 0 16px 7px rgba(52,211,153,0.64)" anim="a-spin 0.20s linear infinite" op={0.8} />
          <Ring d={66} bc="#6ee7b7" bw="2px" glow="0 0 11px 5px rgba(110,231,183,0.55)" anim="a-spin 0.15s linear reverse infinite" op={0.66} />
          <Ring d={46} bc="#a7f3d0" bw="1px" anim="a-spin 0.10s linear infinite" op={0.5} />
          {[{r:44,s:5,c:"rgba(52,211,153,0.88)",dur:280,del:0},{r:40,s:4,c:"rgba(167,243,208,0.72)",dur:220,del:93},{r:44,s:3,c:"rgba(110,231,183,0.78)",dur:260,del:186}].map((o,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
              borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*1.5}px ${o.s}px ${o.c}`,
              animation:`a-orbit-vt${i} ${o.dur}ms linear ${o.del}ms infinite`,willChange:"transform" })} />
          ))}
          <div style={ss({ position:"absolute",width:22,height:22,borderRadius:"50%",
            background:"radial-gradient(circle,white 15%,#6ee7b7 50%,#059669 87%)",
            boxShadow:"0 0 0 2px #34d399,0 0 24px 12px rgba(110,231,183,0.97),0 0 48px 22px rgba(5,150,105,0.55)",
            animation:"a-fire-pulse 0.1s ease-in-out infinite",willChange:"transform,opacity" })} />
          <Ring d={92} bg="radial-gradient(circle,rgba(110,231,183,0.17) 0%,transparent 70%)" anim="a-fire-pulse 0.12s ease-in-out infinite" />
          <Ring d={92} bc="rgba(52,211,153,0.37)" bw="1px" anim="a-burst 0.15s ease-out infinite" />
        </>)

      case "void": return hub(98, <>
        <Ring d={94} bc="rgba(203,213,225,0.84)" bw="1.5px" glow="0 0 20px 8px rgba(203,213,225,0.54)" anim="a-spin 0.48s linear infinite" op={0.72} />
        <Ring d={72} bc="rgba(226,232,240,0.74)" bw="1.5px" glow="0 0 14px 5px rgba(226,232,240,0.44)" anim="a-spin 0.32s linear reverse infinite" op={0.6} />
        <Ring d={52} bc="white" bw="1px" anim="a-spin 0.19s linear infinite" op={0.48} />
        {[{r:47,s:6,c:"rgba(255,255,255,0.92)",dur:420,del:0},{r:42,s:5,c:"rgba(203,213,225,0.82)",dur:340,del:105},{r:48,s:4,c:"rgba(226,232,240,0.72)",dur:380,del:210},{r:40,s:3,c:"rgba(148,163,184,0.72)",dur:300,del:75}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*1.5}px ${o.s}px ${o.c}`,
            animation:`a-orbit-vo${i} ${o.dur}ms linear ${o.del}ms infinite`,willChange:"transform" })} />
        ))}
        <div style={ss({ position:"absolute",width:25,height:25,borderRadius:"50%",
          background:"radial-gradient(circle,white 13%,#e2e8f0 43%,#94a3b8 80%)",
          boxShadow:"0 0 0 3px #cbd5e1,0 0 0 7px rgba(148,163,184,0.52),0 0 36px 18px rgba(203,213,225,1),0 0 72px 28px rgba(148,163,184,0.54)",
          animation:"a-fire-pulse 0.1s ease-in-out infinite",willChange:"transform,opacity" })} />
        <Ring d={96} bc="rgba(203,213,225,0.38)" bw="1px" anim="a-burst 0.15s ease-out infinite" />
        <Ring d={96} bc="rgba(203,213,225,0.22)" bw="1px" anim="a-burst 0.15s ease-out 0.075s infinite" />
        <Ring d={100} bg="radial-gradient(circle,rgba(203,213,225,0.24) 0%,transparent 70%)" anim="a-fire-pulse 0.12s ease-in-out infinite" />
      </>)

      default: return hub(80, <>
        <div style={ss({ position:"absolute",width:27,height:27,borderRadius:"50%",
          background:"white",boxShadow:"0 0 30px 16px rgba(255,255,255,0.82)",
          animation:"a-fire-pulse 0.1s ease-in-out infinite",willChange:"transform,opacity" })} />
      </>)
    }
  }

  // ═══════════════════════════════════════════════════════
  //  RELEASE — snap flash
  // ═══════════════════════════════════════════════════════
  const Release = () => {
    const clr: Record<string,[string,string]> = {
      pyrus:["#f97316","rgba(249,115,22,0.92)"],  fire:["#f97316","rgba(249,115,22,0.92)"],
      aquos:["#38bdf8","rgba(56,189,248,0.92)"],   aquo:["#38bdf8","rgba(56,189,248,0.92)"],  water:["#38bdf8","rgba(56,189,248,0.92)"],
      terra:["#b45309","rgba(180,83,9,0.92)"],     subterra:["#b45309","rgba(180,83,9,0.92)"],
      haos:["#fde047","rgba(253,224,71,1)"],        light:["#fde047","rgba(253,224,71,1)"],    lightness:["#fde047","rgba(253,224,71,1)"],
      darkus:["#a855f7","rgba(88,28,135,0.97)"],   darkness:["#a855f7","rgba(88,28,135,0.97)"],dark:["#a855f7","rgba(88,28,135,0.97)"],
      ventus:["#34d399","rgba(52,211,153,0.92)"],  wind:["#34d399","rgba(52,211,153,0.92)"],
      void:["#e2e8f0","rgba(203,213,225,1)"],
    }
    const [col,glow] = clr[el] ?? ["white","rgba(255,255,255,0.92)"]
    return (
      <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
        width:80,height:80,marginTop:-40,display:"flex",alignItems:"center",justifyContent:"center" })}>
        <Ring d={80} bc={col} bw="3px" anim="a-release-burst 50ms ease-out forwards" glow={`0 0 30px 15px ${glow}`} />
        <Ring d={60} bc={col} bw="2px" anim="a-release-burst 50ms ease-out 10ms forwards" op={0.72} />
        <Ring d={40} bc="white" bw="1px" anim="a-release-burst 50ms ease-out 20ms forwards" op={0.52} />
        <div style={ss({ position:"absolute",width:20,height:20,borderRadius:"50%",
          background:col,boxShadow:`0 0 40px 20px ${glow}`,
          animation:"a-release-core 50ms ease-out forwards",willChange:"transform,opacity" })} />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════
  //  STRIKE — projectile in flight
  //  PERF: no filter:blur on moving elements, no position:fixed
  // ═══════════════════════════════════════════════════════
  const Strike = () => {
    const ease: Record<string,string> = {
      pyrus:"cubic-bezier(0.07,0,0.04,1)",   fire:"cubic-bezier(0.07,0,0.04,1)",
      aquos:"cubic-bezier(0.09,0,0.05,1)",   aquo:"cubic-bezier(0.09,0,0.05,1)",  water:"cubic-bezier(0.09,0,0.05,1)",
      terra:"cubic-bezier(0.30,0,0.05,1)",   subterra:"cubic-bezier(0.30,0,0.05,1)",
      haos:"cubic-bezier(0.03,0,0.03,1)",    light:"cubic-bezier(0.03,0,0.03,1)", lightness:"cubic-bezier(0.03,0,0.03,1)",
      darkus:"cubic-bezier(0.50,0,0.05,1)",  darkness:"cubic-bezier(0.50,0,0.05,1)", dark:"cubic-bezier(0.50,0,0.05,1)",
      ventus:"cubic-bezier(0.09,0,0.04,1)",  wind:"cubic-bezier(0.09,0,0.04,1)",
      void:"cubic-bezier(0.02,0,0.02,1)",
    }
    const mv = { animation:`a-move ${T.STRIKE}ms ${ease[el]??"cubic-bezier(0.09,0,0.05,1)"} forwards`,willChange:"transform" } as React.CSSProperties

    switch (el) {

      case "pyrus": case "fire": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          {/* Trails: NO filter:blur on animated divs — use opacity only */}
          <div style={ss({ position:"absolute",width:"190px",height:"14px",
            background:"linear-gradient(to right,transparent,rgba(127,29,29,0.15),rgba(220,38,38,0.42),#f97316,rgba(251,146,60,0.48))",
            borderRadius:"9999px",opacity:.88,
            animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards`,willChange:"opacity" })} />
          <div style={ss({ position:"absolute",width:"145px",height:"8px",
            background:"linear-gradient(to right,transparent,rgba(220,38,38,0.5),#f97316,rgba(251,146,60,0.55))",
            borderRadius:"9999px",opacity:.92 })} />
          <div style={ss({ position:"absolute",width:"100px",height:"5px",
            background:"linear-gradient(to right,transparent,#fbbf24,rgba(251,191,36,0.35))",
            top:"-8px",left:"28px",borderRadius:"9999px",opacity:.68 })} />
          {[{x:48,y:-10,s:11},{x:72,y:7,s:9},{x:62,y:-7,s:7},{x:88,y:5,s:5}].map((e,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${e.s}px`,height:`${e.s}px`,
              borderRadius:"50%",background:"radial-gradient(circle,white,#fbbf24)",
              boxShadow:`0 0 8px 4px rgba(251,191,36,0.9)`,
              left:`${e.x}px`,top:`${e.y}px`,opacity:.76-i*.1 })} />
          ))}
          <div style={ss({ width:"40px",height:"40px",flexShrink:0,borderRadius:"50%",
            background:"radial-gradient(circle,white 5%,#fff7ed 12%,#fb923c 28%,#dc2626 60%,#7f1d1d 100%)",
            boxShadow:"0 0 0 4px rgba(249,115,22,0.7),0 0 0 9px rgba(220,38,38,0.26),0 0 28px 15px rgba(251,146,60,1),0 0 60px 24px rgba(220,38,38,0.68)",
            willChange:"transform" })} />
          <div style={ss({ position:"absolute",width:"15px",height:"15px",right:"-7px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 20px 10px rgba(255,255,255,1),0 0 40px 16px rgba(251,146,60,0.8)" })} />
        </div>
      )

      case "aquos": case "aquo": case "water":
        if (isFehnon) return (
          <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-4px" })}>
            <div style={ss({ width:`${dist}px`,height:"8px",
              background:`linear-gradient(to right,rgba(14,165,233,0) 0%,rgba(56,189,248,0.4) 7%,white 42%,rgba(125,211,252,0.9) 72%,rgba(56,189,248,0.2) 94%,transparent 100%)`,
              borderRadius:"9999px",
              boxShadow:"0 0 22px 10px rgba(56,189,248,0.9),0 0 44px 18px rgba(14,165,233,0.58)",
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) forwards`,willChange:"transform,opacity" })} />
            <div style={ss({ width:`${dist*.82}px`,height:"3px",
              background:"linear-gradient(to right,transparent,rgba(125,211,252,0.7) 12%,rgba(255,255,255,0.95) 50%,rgba(186,230,253,0.62) 86%,transparent)",
              borderRadius:"9999px",position:"absolute",top:"-13px",left:`${dist*.05}px`,
              boxShadow:"0 0 10px 2px rgba(56,189,248,0.7)",
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) 16ms forwards`,willChange:"transform,opacity" })} />
            <div style={ss({ position:"absolute",width:"28px",height:"28px",borderRadius:"50%",
              right:"-3px",top:"-12px",
              background:"radial-gradient(circle,white 13%,#7dd3fc 46%,#0ea5e9 88%)",
              boxShadow:"0 0 30px 15px rgba(56,189,248,1),0 0 64px 26px rgba(14,165,233,0.72)",
              animation:`a-fehnon-tip ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) forwards`,willChange:"transform,opacity" })} />
          </div>
        )
        return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv })}>
            <div style={ss({ position:"absolute",width:"130px",height:"6px",
              background:"linear-gradient(to right,transparent,rgba(14,165,233,0.26),#0ea5e9,#38bdf8)",
              borderRadius:"9999px",opacity:.86,
              animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards`,willChange:"opacity" })} />
            <div style={ss({ position:"absolute",width:"105px",height:"5px",
              background:"linear-gradient(to right,transparent,rgba(14,165,233,0.38),#0ea5e9,#38bdf8)",
              borderRadius:"9999px",opacity:.82 })} />
            {[62,78,92].map((x,i)=>(
              <div key={i} style={ss({ position:"absolute",width:`${11-i*2}px`,height:`${11-i*2}px`,
                borderRadius:"50%",border:`1px solid rgba(125,211,252,${0.64-i*0.14})`,
                left:`${x}px`,top:`${i%2===0?-6:5}px`,opacity:.6 })} />
            ))}
            <div style={ss({ width:"32px",height:"32px",flexShrink:0,borderRadius:"50%",
              background:"radial-gradient(circle,white 8%,#38bdf8 42%,#0284c7 84%)",
              boxShadow:"0 0 0 2px #7dd3fc,0 0 20px 10px rgba(56,189,248,0.95),0 0 42px 16px rgba(14,165,233,0.55)" })} />
          </div>
        )

      case "terra": case "subterra": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          <div style={ss({ position:"absolute",width:"120px",height:"18px",
            background:"linear-gradient(to right,transparent,rgba(120,53,15,0.22),rgba(146,64,14,0.52),#b45309)",
            borderRadius:"5px",opacity:.82,
            animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards`,willChange:"opacity" })} />
          <div style={ss({ position:"absolute",width:"92px",height:"12px",
            background:"linear-gradient(to right,transparent,rgba(120,53,15,0.4),#92400e,#b45309)",
            borderRadius:"4px",opacity:.86 })} />
          {[{x:20,y:-8,sz:8,r:0},{x:40,y:6,sz:7,r:22},{x:58,y:-6,sz:6,r:45},{x:74,y:5,sz:5,r:15}].map((c,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${c.sz}px`,height:`${c.sz}px`,
              background:"radial-gradient(circle,#d97706,#92400e)",
              borderRadius:"2px",transform:`rotate(${c.r}deg)`,
              left:`${c.x}px`,top:`${c.y}px`,opacity:.76-i*.1 })} />
          ))}
          <div style={ss({ width:"38px",height:"38px",flexShrink:0,borderRadius:"4px",
            transform:"rotate(42deg)",
            background:"radial-gradient(circle,#fbbf24 4%,#d97706 12%,#92400e 48%,#451a03 88%)",
            boxShadow:"0 0 0 3px #7c2d12,0 0 0 7px rgba(120,53,15,0.32),0 0 24px 13px rgba(146,64,14,0.95),0 0 50px 22px rgba(120,53,15,0.58)" })} />
        </div>
      )

      case "haos": case "light": case "lightness": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-5px" })}>
          <div style={ss({ width:`${dist}px`,height:"9px",
            background:`linear-gradient(to right,rgba(254,240,138,0) 0%,rgba(253,224,71,0.50) 11%,white 45%,rgba(254,249,195,0.92) 78%,rgba(254,240,138,0) 100%)`,
            borderRadius:"9999px",
            boxShadow:"0 0 18px 8px rgba(254,240,138,0.95),0 0 38px 16px rgba(253,224,71,0.65)",
            animation:`a-laser ${T.STRIKE}ms ease-out forwards`,willChange:"transform,opacity" })} />
          <div style={ss({ width:`${dist*.88}px`,height:"3px",
            background:"linear-gradient(to right,transparent,rgba(254,249,195,0.65) 13%,white 52%,transparent)",
            borderRadius:"9999px",position:"absolute",top:"-9px",left:`${dist*.04}px`,
            animation:`a-laser ${T.STRIKE}ms ease-out 11ms forwards`,willChange:"transform,opacity" })} />
          <div style={ss({ position:"absolute",right:0,top:"-13px",width:"30px",height:"30px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 32px 16px rgba(254,240,138,1),0 0 68px 28px rgba(253,224,71,0.72)" })} />
          <div style={ss({ position:"absolute",right:"-15px",top:"-22px",width:"62px",height:"62px",
            borderRadius:"50%",border:"1.5px solid rgba(254,240,138,0.50)",
            animation:"a-burst 0.18s ease-out forwards",willChange:"transform,opacity" })} />
        </div>
      )

      case "darkus": case "darkness": case "dark": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          <div style={ss({ position:"absolute",width:"170px",height:"9px",
            background:"linear-gradient(to right,transparent,rgba(88,28,135,0.16),#7e22ce,#a855f7)",
            borderRadius:"9999px",opacity:.88,
            animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards`,willChange:"opacity" })} />
          <div style={ss({ position:"absolute",width:"130px",height:"5px",
            background:"linear-gradient(to right,transparent,rgba(88,28,135,0.34),#7e22ce,#a855f7)",
            borderRadius:"9999px",opacity:.90 })} />
          {[{w:64,y:-10,l:46},{w:52,y:10,l:62},{w:36,y:-16,l:80}].map((t,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${t.w}px`,height:"2px",
              background:"linear-gradient(to right,transparent,rgba(76,29,149,0.58))",
              borderRadius:"9999px",top:`${t.y}px`,left:`${t.l}px` })} />
          ))}
          <div style={ss({ width:"14px",height:"50px",flexShrink:0,borderRadius:"3px",
            background:"linear-gradient(to bottom,#e879f9 0%,#c084fc 15%,#7e22ce 35%,black 60%,#581c87 85%,#1e1b4b 100%)",
            boxShadow:"0 0 0 2px rgba(88,28,135,0.88),0 0 0 5px rgba(168,85,247,0.22),0 0 24px 13px rgba(88,28,135,1),0 0 56px 24px rgba(88,28,135,0.62)" })} />
          <div style={ss({ position:"absolute",right:"-3px",width:"3px",height:"50px",
            background:"linear-gradient(to bottom,transparent,rgba(192,132,252,0.85),black,rgba(192,132,252,0.85),transparent)" })} />
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
              background:"rgba(110,231,183,0.76)",borderRadius:"9999px",
              left:"5px",top:"-6px",transformOrigin:"left center",transform:"rotate(-30deg)",
              animation:"a-feather 0.19s ease-in-out infinite",willChange:"transform,opacity" })} />
            <div style={ss({ position:"absolute",width:"22px",height:"2.5px",
              background:"rgba(110,231,183,0.76)",borderRadius:"9999px",
              left:"5px",top:"4px",transformOrigin:"left center",transform:"rotate(30deg)",
              animation:"a-feather 0.19s ease-in-out 0.095s infinite",willChange:"transform,opacity" })} />
            <div style={ss({ width:0,height:0,flexShrink:0,
              borderTop:"13px solid transparent",borderBottom:"13px solid transparent",
              borderLeft:"28px solid #34d399",
              filter:"drop-shadow(0 0 10px rgba(52,211,153,0.97)) drop-shadow(0 0 22px rgba(16,185,129,0.65))" })} />
            <div style={ss({ position:"absolute",right:"-7px",width:"12px",height:"12px",
              background:"white",borderRadius:"50%",
              boxShadow:"0 0 16px 8px rgba(52,211,153,1)" })} />
          </div>
        )
        return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv })}>
            <div style={ss({ position:"absolute",width:"110px",height:"28px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.10),rgba(110,231,183,0.26))",
              top:"-14px",borderRadius:"0 50% 50% 0",opacity:.76,
              animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards`,willChange:"opacity" })} />
            <div style={ss({ width:"34px",height:"46px",flexShrink:0,borderRadius:"50%",
              border:"3px solid #34d399",
              boxShadow:"0 0 20px 10px rgba(52,211,153,0.94),0 0 42px 16px rgba(16,185,129,0.50)",
              animation:"a-spin 0.09s linear infinite",willChange:"transform" })} />
            <div style={ss({ position:"absolute",right:"7px",width:"18px",height:"28px",
              borderRadius:"50%",border:"2px solid #6ee7b7",opacity:.66,
              animation:"a-spin 0.06s linear reverse infinite",willChange:"transform" })} />
            <div style={ss({ position:"absolute",right:"10px",width:"10px",height:"10px",
              borderRadius:"50%",background:"radial-gradient(circle,white 15%,#6ee7b7 50%,#059669 88%)",
              boxShadow:"0 0 14px 7px rgba(52,211,153,0.9)" })} />
          </div>
        )

      case "void": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-3px",...mv })}>
          <div style={ss({ position:"absolute",
            width:`${Math.min(dist*.65,120)}px`,height:"3px",
            background:"linear-gradient(to right,transparent,rgba(203,213,225,0.32),rgba(255,255,255,0.97))",
            borderRadius:"9999px",boxShadow:"0 0 8px 2px rgba(203,213,225,0.74)",
            animation:`a-laser ${T.STRIKE}ms ease-out forwards`,willChange:"transform,opacity" })} />
          {[{x:25,y:-8,s:15,d:0},{x:46,y:6,s:12,d:26},{x:64,y:-5,s:9,d:50}].map((r,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${r.s}px`,height:`${r.s}px`,
              borderRadius:"50%",border:"1px solid rgba(203,213,225,0.52)",
              left:`${r.x}%`,top:`${r.y}px`,opacity:.52,
              animation:`a-burst 0.17s ease-out ${r.d}ms forwards`,willChange:"transform,opacity" })} />
          ))}
          <div style={ss({ position:"absolute",right:0,top:"-13px",width:"28px",height:"28px",
            background:"radial-gradient(circle,white 13%,#e2e8f0 49%,#94a3b8 87%)",
            borderRadius:"50%",
            boxShadow:"0 0 22px 11px rgba(203,213,225,0.95),0 0 50px 20px rgba(148,163,184,0.58)" })} />
        </div>
      )

      default: return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          <div style={ss({ position:"absolute",width:"70px",height:"4px",
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.88))",
            borderRadius:"9999px",opacity:.8 })} />
          <div style={ss({ width:"26px",height:"26px",flexShrink:0,borderRadius:"50%",
            background:"white",boxShadow:"0 0 20px 10px rgba(255,255,255,0.82)" })} />
        </div>
      )
    }
  }

  // ═══════════════════════════════════════════════════════
  //  IMPACT — freeze frame
  //  PERF: no position:fixed, no 100vw elements, no filter on animated divs
  //  Flash uses a large but bounded absolute div positioned to cover viewport
  // ═══════════════════════════════════════════════════════
  const Impact = () => {
    const fc: Record<string,string> = {
      pyrus:"rgba(255,115,0,0.65)",   fire:"rgba(255,115,0,0.65)",
      aquos:"rgba(56,189,248,0.55)",  aquo:"rgba(56,189,248,0.55)",  water:"rgba(56,189,248,0.55)",
      terra:"rgba(120,53,15,0.58)",   subterra:"rgba(120,53,15,0.58)",
      haos:"rgba(255,255,165,0.72)",  light:"rgba(255,255,165,0.72)",lightness:"rgba(255,255,165,0.72)",
      darkus:"rgba(88,28,135,0.65)",  darkness:"rgba(88,28,135,0.65)",dark:"rgba(88,28,135,0.65)",
      ventus:"rgba(52,211,153,0.55)", wind:"rgba(52,211,153,0.55)",
      void:"rgba(203,213,225,0.60)",
    }
    const gc: Record<string,string> = {
      pyrus:"rgba(249,115,22,1)",   aquos:"rgba(56,189,248,1)",
      terra:"rgba(180,83,9,1)",     haos:"rgba(254,240,138,1)",
      darkus:"rgba(88,28,135,1)",   ventus:"rgba(52,211,153,1)",
      void:"rgba(203,213,225,1)",
    }
    const rk = (e:string) => {
      const m:{[k:string]:string}={fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",
        light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus"}
      return m[e]??e
    }
    const flash = fc[el] ?? "rgba(255,255,255,0.55)"
    const glow  = gc[rk(el)] ?? "rgba(255,255,255,1)"

    return (
      <div style={ss({ position:"absolute",left:0,top:0,width:0,height:0,
        transform:`rotate(${-aDeg}deg)`,contain:"layout style paint" })}>

        {/* Flash — large bounded div, only opacity animated (GPU) */}
        <div style={ss({ position:"absolute",left:"-2000px",top:"-2000px",
          width:"4000px",height:"4000px",
          background:flash,
          animation:`a-hero-flash ${T.IMPACT}ms linear forwards`,
          pointerEvents:"none",willChange:"opacity" })} />

        {/* Compression orb — pre-blurred via box-shadow, scale+opacity only animated */}
        <div style={ss({ position:"absolute",left:"-72px",top:"-72px",width:"144px",height:"144px",
          borderRadius:"50%",background:glow,
          boxShadow:`0 0 0 40px ${glow.replace('1)','0.0)')}`,
          animation:`a-hero-compress ${T.IMPACT}ms ease-out forwards`,willChange:"transform,opacity" })} />

        {/* Shockwave rings — scale+opacity only, no repaint */}
        <div style={ss({ position:"absolute",left:"-58px",top:"-58px",width:"116px",height:"116px",
          borderRadius:"50%",border:"5px solid white",
          boxShadow:`0 0 28px 12px ${glow}`,
          animation:`a-shockwave ${T.IMPACT*1.4}ms cubic-bezier(0.1,0,0.3,1) forwards`,
          willChange:"transform,opacity" })} />
        <div style={ss({ position:"absolute",left:"-38px",top:"-38px",width:"76px",height:"76px",
          borderRadius:"50%",border:"2.5px solid rgba(255,255,255,0.62)",
          animation:`a-shockwave ${T.IMPACT*1.2}ms cubic-bezier(0.1,0,0.3,1) 35ms forwards`,
          willChange:"transform,opacity" })} />

        {/* Impact rings */}
        <div style={ss({ position:"absolute",left:"-42px",top:"-42px",width:"84px",height:"84px",
          borderRadius:"50%",border:"4px solid white",
          boxShadow:`0 0 22px 9px ${glow}`,
          animation:`a-hero-ring ${T.IMPACT}ms ease-out forwards`,willChange:"transform,opacity" })} />
        <div style={ss({ position:"absolute",left:"-24px",top:"-24px",width:"48px",height:"48px",
          borderRadius:"50%",border:"2px solid white",opacity:.7,
          animation:`a-hero-ring ${T.IMPACT}ms ease-out 15ms forwards`,willChange:"transform,opacity" })} />

        {/* Ground wave — scale transform only, no filter */}
        <div style={ss({ position:"absolute",left:"-110px",top:"18px",width:"220px",height:"10px",
          background:`linear-gradient(to right,transparent,${glow},transparent)`,
          borderRadius:"9999px",transformOrigin:"center center",
          animation:`a-ground-wave ${T.IMPACT*1.2}ms ease-out forwards`,willChange:"transform,opacity" })} />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════
  //  AFTERMATH — particles + rings (all GPU: transform+opacity only)
  // ═══════════════════════════════════════════════════════
  const Aftermath = () => {
    type C={r1:string;r2:string;r3:string;core:string;cg:string;gw:string;pc:string[];res:string}

    const rk = (e:string): string => {
      const m:{[k:string]:string}={fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",
        light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus"}
      const b=m[e]??e
      if(b==="aquos"&&isFehnon) return "aquos_fehnon"
      if(b==="ventus"&&isUller) return "ventus_uller"
      return b
    }

    const cfgs: Record<string,C> = {
      pyrus:       {r1:"#f97316",r2:"#fbbf24",r3:"#ef4444",
        core:"radial-gradient(circle,white 4%,#fb923c 24%,#dc2626 54%,#7f1d1d 86%)",
        cg:"rgba(249,115,22,0.97)",gw:"rgba(220,38,38,0.56)",
        pc:["#7f1d1d","#991b1b","#dc2626","#ea580c","#f97316","#fb923c","#fbbf24","#fef3c7","white"],
        res:"rgba(220,38,38,0.18)"},
      aquos:       {r1:"#38bdf8",r2:"#7dd3fc",r3:"#0ea5e9",
        core:"radial-gradient(circle,white 4%,#38bdf8 28%,#0284c7 60%,#0c4a6e 89%)",
        cg:"rgba(56,189,248,0.93)",gw:"rgba(14,165,233,0.46)",
        pc:["#082f49","#0c4a6e","#0284c7","#0ea5e9","#38bdf8","#7dd3fc","#bae6fd","white"],
        res:"rgba(56,189,248,0.14)"},
      aquos_fehnon:{r1:"#38bdf8",r2:"white",r3:"#7dd3fc",
        core:"radial-gradient(circle,white 6%,#bae6fd 21%,#38bdf8 44%,#0284c7 70%,#075985 92%)",
        cg:"rgba(56,189,248,1)",gw:"rgba(14,165,233,0.72)",
        pc:["white","#f0f9ff","#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9"],
        res:"rgba(56,189,248,0.20)"},
      terra:       {r1:"#b45309",r2:"#d97706",r3:"#92400e",
        core:"radial-gradient(circle,#fbbf24 4%,#b45309 28%,#7c2d12 58%,#431407 89%)",
        cg:"rgba(180,83,9,0.97)",gw:"rgba(120,53,15,0.56)",
        pc:["#1c0a04","#431407","#7c2d12","#92400e","#b45309","#d97706","#fbbf24"],
        res:"rgba(120,53,15,0.16)"},
      haos:        {r1:"#fde047",r2:"white",r3:"#fef08a",
        core:"radial-gradient(circle,white 7%,#fef9c3 26%,#fef08a 52%,#fde047 78%)",
        cg:"rgba(254,240,138,1)",gw:"rgba(253,224,71,0.65)",
        pc:["white","#fefce8","#fef9c3","#fef08a","#fde047","#fbbf24","#f59e0b","#ffd700"],
        res:"rgba(253,224,71,0.22)"},
      darkus:      {r1:"#7e22ce",r2:"#a855f7",r3:"#4c1d95",
        core:"radial-gradient(circle,#e879f9 4%,#a855f7 24%,#7e22ce 48%,#1e1b4b 78%,#0f0a1e 94%)",
        cg:"rgba(88,28,135,0.99)",gw:"rgba(88,28,135,0.66)",
        pc:["#030712","#0f0a1e","#1e1b4b","#4c1d95","#7e22ce","#a855f7","#c084fc","#e879f9"],
        res:"rgba(88,28,135,0.18)"},
      ventus:      {r1:"#34d399",r2:"#6ee7b7",r3:"#059669",
        core:"radial-gradient(circle,white 4%,#6ee7b7 26%,#10b981 54%,#064e3b 87%)",
        cg:"rgba(52,211,153,0.97)",gw:"rgba(5,150,105,0.50)",
        pc:["#022c22","#064e3b","#059669","#34d399","#6ee7b7","#a7f3d0","white"],
        res:"rgba(52,211,153,0.14)"},
      ventus_uller:{r1:"#34d399",r2:"white",r3:"#a7f3d0",
        core:"radial-gradient(circle,white 8%,#a7f3d0 24%,#34d399 48%,#059669 76%)",
        cg:"rgba(52,211,153,1)",gw:"rgba(16,185,129,0.56)",
        pc:["white","#f0fdf4","#dcfce7","#a7f3d0","#6ee7b7","#34d399","#10b981"],
        res:"rgba(52,211,153,0.16)"},
      void:        {r1:"#cbd5e1",r2:"white",r3:"#94a3b8",
        core:"radial-gradient(circle,white 8%,#f1f5f9 24%,#e2e8f0 48%,#94a3b8 74%)",
        cg:"rgba(203,213,225,1)",gw:"rgba(148,163,184,0.56)",
        pc:["white","#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8","#64748b"],
        res:"rgba(148,163,184,0.16)"},
    }

    const c       = cfgs[rk(el)] ?? cfgs.void
    const iBase   = aRad + Math.PI
    const isTerra = el==="terra"||el==="subterra"
    const isFeh   = isFehnon&&(el==="aquos"||el==="aquo"||el==="water")
    const isDark  = el==="darkus"||el==="darkness"||el==="dark"
    const isFire  = el==="pyrus"||el==="fire"
    const isVoid  = el==="void"
    const isHaos  = el==="haos"||el==="light"||el==="lightness"
    const isVent  = (el==="ventus"||el==="wind")&&!isUller

    return (
      <div style={ss({ position:"absolute",left:0,top:0,width:0,height:0,
        transform:`rotate(${-aDeg}deg)`,contain:"layout style paint" })}>

        <div style={ss({ position:"absolute",left:"-80px",top:"-80px",width:"160px",height:"160px",
          animation:"a-local-shake 0.18s cubic-bezier(.36,.07,.19,.97) both",willChange:"transform" })}>

          {/* 4 shockwave rings — only transform+opacity animated */}
          {[{s:160,bw:2.5,d:0,op:.55},{s:128,bw:3,d:0,op:1},{s:100,bw:2,d:22,op:.68},{s:72,bw:1.5,d:42,op:.44}].map(({s,bw,d,op},i)=>(
            <div key={i} style={ss({ position:"absolute",
              left:`${80-s/2}px`,top:`${80-s/2}px`,width:s,height:s,
              borderRadius:"50%",
              border:`${bw}px solid ${i===1?c.r1:i===2?c.r2:c.r3}`,
              boxShadow:i===1?`0 0 26px 11px ${c.cg}`:undefined,
              opacity:op,
              animation:`a-ring ${T.AFTERMATH}ms ease-out ${d}ms forwards`,
              willChange:"transform,opacity" })} />
          ))}

          {/* Core burst */}
          <div style={ss({ position:"absolute",left:"18px",top:"18px",width:"124px",height:"124px",
            borderRadius:"50%",background:c.core,
            boxShadow:`0 0 64px 30px ${c.cg},0 0 128px 50px ${c.gw}`,
            animation:`a-core ${T.AFTERMATH}ms cubic-bezier(0.03,0.94,0.10,1) forwards`,
            willChange:"transform,opacity" })} />

          {/* Second wave */}
          <div style={ss({ position:"absolute",left:"36px",top:"36px",width:"88px",height:"88px",
            borderRadius:"50%",border:`2px solid ${c.r2}`,
            boxShadow:`0 0 12px 4px ${c.cg}`,
            animation:`a-ring ${T.AFTERMATH*.62}ms ease-out ${T.AFTERMATH*.28}ms forwards`,
            willChange:"transform,opacity" })} />
          <div style={ss({ position:"absolute",left:"44px",top:"44px",width:"72px",height:"72px",
            borderRadius:"50%",background:c.res,
            animation:`a-second-wave ${T.AFTERMATH*.52}ms ease-out ${T.AFTERMATH*.27}ms forwards`,
            willChange:"transform,opacity" })} />

          {/* Residual glow */}
          <div style={ss({ position:"absolute",left:"24px",top:"24px",width:"112px",height:"112px",
            borderRadius:"50%",background:c.res,
            animation:`a-residual ${T.AFTERMATH}ms ease-out forwards`,willChange:"opacity,transform" })} />

          {/* Element-specific details */}
          {isFire && <div style={ss({ position:"absolute",left:"66px",top:"-18px",width:"28px",height:"56px",
            background:"linear-gradient(to top,rgba(251,146,60,0.55),rgba(249,115,22,0.18),transparent)",
            borderRadius:"9999px",
            animation:`a-fire-rise ${T.AFTERMATH*.7}ms ease-out forwards`,willChange:"transform,opacity" })} />}

          {isTerra && [0,72,144,216,288].map((a,i)=>(
            <div key={i} style={ss({ position:"absolute",left:"80px",top:"80px",
              width:`${52+i*7}px`,height:"2px",
              background:`linear-gradient(to right,${c.r1},transparent)`,
              borderRadius:"9999px",transformOrigin:"left center",
              transform:`rotate(${a}deg)`,opacity:.7,
              animation:`a-terra-crack ${T.AFTERMATH*.6}ms ease-out ${i*20}ms both`,
              willChange:"transform,opacity" })} />
          ))}

          {isHaos && [0,45,90,135].map((a,i)=>(
            <div key={i} style={ss({ position:"absolute",left:"80px",top:"80px",
              width:"72px",height:"2px",
              background:"linear-gradient(to right,white,rgba(254,240,138,0.48),transparent)",
              borderRadius:"9999px",transformOrigin:"left center",
              transform:`rotate(${a}deg)`,opacity:.8,
              animation:`a-terra-crack ${T.AFTERMATH*.5}ms ease-out ${i*15}ms both`,
              willChange:"transform,opacity" })} />
          ))}

          {isVoid && [52,76,100].map((s,i)=>(
            <div key={i} style={ss({ position:"absolute",
              left:`${80-s/2}px`,top:`${80-s/2}px`,width:s,height:s,
              borderRadius:"50%",border:"1px solid rgba(203,213,225,0.52)",
              animation:`a-void-glitch ${T.AFTERMATH*.44}ms ease-out ${i*36}ms forwards`,
              willChange:"transform,opacity" })} />
          ))}

          {isVent && <div style={ss({ position:"absolute",left:"38px",top:"38px",
            width:"84px",height:"84px",borderRadius:"50%",
            border:"2px dashed rgba(52,211,153,0.48)",
            animation:`a-spin 0.4s linear forwards,a-ring ${T.AFTERMATH*.7}ms ease-out forwards`,
            willChange:"transform,opacity" })} />}

        </div>

        {/* Fehnon scar lines */}
        {isFeh && [
          {w:140,r:0,  t:-3,d:0 },{w:108,r:-19,t:-3,d:7},
          {w:108,r:19, t:-3,d:7 },{w:80, r:-39,t:-2,d:17},
          {w:80, r:39, t:-2,d:17},{w:56, r:-59,t:-1,d:28},
          {w:56, r:59, t:-1,d:28},{w:38, r:-77,t:0, d:40},
          {w:38, r:77, t:0, d:40},
        ].map((s,i)=>(
          <div key={i} style={ss({ position:"absolute",height:"2.5px",width:`${s.w}px`,
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.95),rgba(125,211,252,0.76),transparent)",
            borderRadius:"9999px",top:`${s.t}px`,left:0,
            transform:`rotate(${s.r}deg)`,transformOrigin:"left center",
            boxShadow:"0 0 9px 2px rgba(56,189,248,0.8)",
            animation:`a-slash ${T.AFTERMATH*.66}ms cubic-bezier(0,0,0.12,1) ${s.d}ms forwards`,
            willChange:"transform,opacity" })} />
        ))}

        {/* Darkness absorption lines */}
        {isDark && [0,60,120,180,240,300].map((a,i)=>(
          <div key={i} style={ss({ position:"absolute",height:"2px",
            width:"58px",borderRadius:"9999px",
            background:"linear-gradient(to left,rgba(88,28,135,0.76),transparent)",
            transformOrigin:"left center",
            transform:`rotate(${a}deg)`,
            animation:`a-dark-abs ${T.AFTERMATH*.78}ms ease-out ${i*14}ms forwards`,
            willChange:"transform,opacity" })} />
        ))}

        {/* Particles */}
        {pts.map(p => {
          const a   = iBase + p.angle * .82
          const d   = p.spd * p.life
          const px  = Math.cos(a)*d*(isDark?.44:1) + p.jx
          const py  = Math.sin(a)*d*(isDark?.44:1) + p.jy + (isFire?p.riseY*.38:0)
          const col = c.pc[p.id % c.pc.length]
          const rot = isFeh ? Math.atan2(py,px)*180/Math.PI : isDark ? p.spin : 0
          return (
            <div key={p.id} style={ss({
              position:"absolute",
              width:`${p.sz}px`,
              height:`${isFeh?p.sz*.34:isTerra?p.sz*.65:isDark?p.sz*1.6:p.sz}px`,
              borderRadius: isTerra||isFeh?"2px":isDark?"1px 5px 1px 5px":"50%",
              background:col,
              boxShadow:`0 0 5px 2px ${col}98`,
              transform: rot?`rotate(${rot}deg)`:undefined,
              animation:`a-particle ${T.AFTERMATH}ms cubic-bezier(0.02,0.56,0.11,1) ${p.del}ms forwards`,
              willChange:"transform,opacity",
              "--px":`${px}px`,"--py":`${py}px`,opacity:0,
            } as React.CSSProperties)} />
          )
        })}
      </div>
    )
  }

  let content: React.ReactNode = null
  if      (phase==="charge")    content = <Charge />
  else if (phase==="release")   content = <Release />
  else if (phase==="strike")    content = <Strike />
  else if (phase==="impact")    content = <Impact />
  else if (phase==="aftermath") content = <Aftermath />

  const orbitKFs = `
    @keyframes a-orbit-0  { from{transform:rotate(0deg) translateX(-46px)} to{transform:rotate(360deg) translateX(-46px)} }
    @keyframes a-orbit-1  { from{transform:rotate(120deg) translateX(-40px)} to{transform:rotate(480deg) translateX(-40px)} }
    @keyframes a-orbit-2  { from{transform:rotate(240deg) translateX(-44px)} to{transform:rotate(600deg) translateX(-44px)} }
    @keyframes a-orbit-aq0{ from{transform:rotate(60deg) translateX(-42px)} to{transform:rotate(420deg) translateX(-42px)} }
    @keyframes a-orbit-aq1{ from{transform:rotate(200deg) translateX(-38px)} to{transform:rotate(560deg) translateX(-38px)} }
    @keyframes a-orbit-tr0{ from{transform:rotate(30deg) translateX(-44px)} to{transform:rotate(390deg) translateX(-44px)} }
    @keyframes a-orbit-tr1{ from{transform:rotate(150deg) translateX(-40px)} to{transform:rotate(510deg) translateX(-40px)} }
    @keyframes a-orbit-tr2{ from{transform:rotate(270deg) translateX(-46px)} to{transform:rotate(630deg) translateX(-46px)} }
    @keyframes a-orbit-ha0{ from{transform:rotate(0deg) translateX(-52px)} to{transform:rotate(360deg) translateX(-52px)} }
    @keyframes a-orbit-ha1{ from{transform:rotate(90deg) translateX(-48px)} to{transform:rotate(450deg) translateX(-48px)} }
    @keyframes a-orbit-ha2{ from{transform:rotate(180deg) translateX(-52px)} to{transform:rotate(540deg) translateX(-52px)} }
    @keyframes a-orbit-ha3{ from{transform:rotate(270deg) translateX(-48px)} to{transform:rotate(630deg) translateX(-48px)} }
    @keyframes a-orbit-dk0{ from{transform:rotate(45deg) translateX(-48px)} to{transform:rotate(-315deg) translateX(-48px)} }
    @keyframes a-orbit-dk1{ from{transform:rotate(165deg) translateX(-44px)} to{transform:rotate(-195deg) translateX(-44px)} }
    @keyframes a-orbit-dk2{ from{transform:rotate(285deg) translateX(-48px)} to{transform:rotate(-75deg) translateX(-48px)} }
    @keyframes a-orbit-vt0{ from{transform:rotate(0deg) translateX(-44px)} to{transform:rotate(360deg) translateX(-44px)} }
    @keyframes a-orbit-vt1{ from{transform:rotate(130deg) translateX(-40px)} to{transform:rotate(490deg) translateX(-40px)} }
    @keyframes a-orbit-vt2{ from{transform:rotate(250deg) translateX(-44px)} to{transform:rotate(610deg) translateX(-44px)} }
    @keyframes a-orbit-vo0{ from{transform:rotate(20deg) translateX(-47px)} to{transform:rotate(380deg) translateX(-47px)} }
    @keyframes a-orbit-vo1{ from{transform:rotate(140deg) translateX(-42px)} to{transform:rotate(500deg) translateX(-42px)} }
    @keyframes a-orbit-vo2{ from{transform:rotate(260deg) translateX(-48px)} to{transform:rotate(620deg) translateX(-48px)} }
    @keyframes a-orbit-vo3{ from{transform:rotate(80deg) translateX(-40px)} to{transform:rotate(440deg) translateX(-40px)} }
  `

  const output = (
    <>
      <style>{`
        ${orbitKFs}
        @keyframes a-spin           { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes a-burst          { 0%{transform:scale(.24);opacity:1} 100%{transform:scale(1.85);opacity:0} }
        @keyframes a-fire-pulse     { 0%,100%{opacity:.76;transform:scale(1)} 50%{opacity:1;transform:scale(1.22)} }
        @keyframes a-terra-pulse    { 0%,100%{opacity:.74;transform:scale(1) rotate(45deg)} 50%{opacity:1;transform:scale(1.20) rotate(45deg)} }
        @keyframes a-haos-halo      { 0%,100%{opacity:.64;transform:scale(1)} 50%{opacity:1;transform:scale(1.36)} }
        @keyframes a-haos-ray       { 0%,100%{opacity:.60;transform-origin:50% 100%;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.42)} }
        @keyframes a-dark-consume   { 0%{transform:scale(1.45);opacity:.86} 100%{transform:scale(.40);opacity:.18} }
        @keyframes a-dark-tendril   { 0%,100%{opacity:.64;transform-origin:left center;transform:scaleX(1)} 50%{opacity:1;transform:scaleX(1.42)} }
        @keyframes a-gather         { 0%{opacity:0;transform-origin:left center;transform:translateX(12px) scaleX(0)} 100%{opacity:.86;transform:translateX(12px) scaleX(1)} }
        @keyframes a-terra-crack    { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 100%{opacity:.84;transform:scaleX(1)} }
        @keyframes a-fehnon-contract{ 0%{transform:scale(1.6);opacity:0} 50%{opacity:1} 100%{transform:scale(.15);opacity:0} }
        @keyframes a-fehnon-scan    { 0%{opacity:0;transform:translateX(-50%) scaleX(0)} 42%{opacity:1} 100%{opacity:0;transform:translateX(-50%) scaleX(1)} }
        @keyframes a-release-burst  { 0%{transform:scale(.26);opacity:1;border-width:9px} 100%{transform:scale(2.6);opacity:0;border-width:1px} }
        @keyframes a-release-core   { 0%{opacity:1;transform:scale(1.5)} 100%{opacity:0;transform:scale(3.0)} }
        @keyframes a-move           { 0%{transform:translateX(0)} 100%{transform:translateX(${dist}px)} }
        @keyframes a-trail-fade     { 0%{opacity:.88} 100%{opacity:.18} }
        @keyframes a-laser          { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 6%{opacity:1} 70%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes a-slash          { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 5%{opacity:1} 64%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes a-fehnon-tip     { 0%{transform:translateX(${-dist}px);opacity:0} 6%{opacity:1} 100%{transform:translateX(0);opacity:1} }
        @keyframes a-feather        { 0%,100%{transform:rotate(-30deg);opacity:.76} 50%{transform:rotate(-21deg);opacity:1} }
        @keyframes a-hero-flash     { 0%{opacity:1} 40%{opacity:.65} 100%{opacity:0} }
        @keyframes a-hero-compress  { 0%{transform:scale(.06);opacity:1} 42%{transform:scale(1.45);opacity:.90} 100%{transform:scale(2.1);opacity:0} }
        @keyframes a-hero-ring      { 0%{transform:scale(.16);opacity:1;border-width:7px} 100%{transform:scale(2.4);opacity:0;border-width:1px} }
        @keyframes a-shockwave      { 0%{transform:scale(0);opacity:.9;border-width:8px} 70%{opacity:.4} 100%{transform:scale(4.2);opacity:0;border-width:0px} }
        @keyframes a-ground-wave    { 0%{transform:scaleX(0) scaleY(1);opacity:.8} 100%{transform:scaleX(1) scaleY(0.18);opacity:0} }
        @keyframes a-local-shake    { 0%{transform:translate(0,0) scale(1)} 6%{transform:translate(-8px,-3px) scale(1.03)} 14%{transform:translate(8px,4px) scale(0.97)} 24%{transform:translate(-6px,2px) scale(1.02)} 36%{transform:translate(5px,-3px) scale(0.99)} 50%{transform:translate(-3px,2px)} 66%{transform:translate(2px,-1px)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes a-ring           { 0%{transform:scale(.06);opacity:1;border-width:9px} 40%{opacity:.62} 100%{transform:scale(2.8);opacity:0;border-width:1px} }
        @keyframes a-core           { 0%{transform:scale(.02);opacity:1} 14%{transform:scale(1.38);opacity:1} 42%{transform:scale(1.06);opacity:.78} 100%{transform:scale(0);opacity:0} }
        @keyframes a-second-wave    { 0%{transform:scale(.08);opacity:0} 18%{opacity:1} 56%{opacity:.58} 100%{transform:scale(1.8);opacity:0} }
        @keyframes a-residual       { 0%{opacity:0} 14%{opacity:1} 54%{opacity:.50} 100%{opacity:0;transform:scale(1.5)} }
        @keyframes a-particle       { 0%{transform:translate(0,0) scale(2);opacity:1} 100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0} }
        @keyframes a-dark-abs       { 0%{opacity:0;transform-origin:right center;transform:rotate(0deg) scaleX(0)} 26%{opacity:.74} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes a-void-glitch    { 0%{transform:scale(.16) skewX(0deg);opacity:.82} 38%{transform:scale(1.22) skewX(3deg);opacity:.50} 68%{transform:scale(1.65) skewX(-2deg);opacity:.20} 100%{transform:scale(2.2) skewX(0deg);opacity:0} }
        @keyframes a-fire-rise      { 0%{transform:translateY(0) scaleY(0);opacity:0} 20%{opacity:.78} 100%{transform:translateY(-48px) scaleY(1.4);opacity:0} }
        @keyframes afterimage-fade  { 0%{opacity:.32} 100%{opacity:0} }
      `}</style>

      {attackerImage && inFlight && (
        <div style={ss({ position:"absolute",left:startX-40,top:startY-56,
          width:"80px",height:"112px",
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:.32,
          animation:"afterimage-fade 300ms ease-out forwards",
          pointerEvents:"none",zIndex:5,willChange:"opacity" })} />
      )}

      <div style={ctr} suppressHydrationWarning>{content}</div>
    </>
  )

  if (portalTarget) return createPortal(output, portalTarget)
  if (typeof document !== "undefined") return createPortal(output, document.body)
  return null
}
