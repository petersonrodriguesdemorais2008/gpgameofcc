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

const T = {
  CHARGE:   220,   // longer build-up = more anticipation
  RELEASE:   50,
  STRIKE:   270,
  IMPACT:   150,   // heavier freeze frame
  AFTERMATH: 520,  // longer residual = more weight
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
    angle: rv(-spread/2, spread/2, seed(id,i))   * (Math.PI/180),
    spd:   rv(sMin, sMax,          seed(id,i+100)),
    sz:    rv(2, 7.5,              seed(id,i+200)),
    life:  rv(0.38, 1,             seed(id,i+300)),
    del:   rv(0, 68,               seed(id,i+400)),
    jx:    rv(-3, 3,               seed(id,i+500)),
    jy:    rv(-3, 3,               seed(id,i+600)),
    spin:  rv(0, 360,              seed(id,i+700)),
    riseY: rv(-20, -60,            seed(id,i+800)), // fire particles rise up
  }))

const ss = (s: React.CSSProperties) => s

const Ring = ({ d, bw="2px", bc, bg, glow, anim, op=1, delay }: {
  d:number; bw?:string; bc?:string; bg?:string; glow?:string
  anim?:string; op?:number; delay?:number
}) => (
  <div style={ss({ position:"absolute",width:d,height:d,
    marginLeft:-d/2,marginTop:-d/2,borderRadius:"50%",
    border:bc?`${bw} solid ${bc}`:undefined,
    background:bg,boxShadow:glow,opacity:op,animation:anim,
    animationDelay:delay?`${delay}ms`:undefined })} />
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
  const isCalem  = /calem/i.test(attackerName || "")
  const isMorgana = /morgana/i.test(attackerName || "")

  const pts = useMemo(() => {
    const tbl: Record<string,[number,number,number,number]> = {
      pyrus:[24,118,38,88],   fire:[24,118,38,88],
      aquos:[18,112,30,78],   aquo:[18,112,30,78],   water:[18,112,30,78],
      terra:[18,108,28,72],   subterra:[18,108,28,72],
      haos:[28,165,34,84],    light:[28,165,34,84],  lightness:[28,165,34,84],
      darkus:[20,112,20,60],  darkness:[20,112,20,60], dark:[20,112,20,60],
      ventus:[26,145,30,80],  wind:[26,145,30,80],
      void:[28,360,22,68],
    }
    const [n,sp,mn,mx] = tbl[el] ?? [16,110,30,76]
    return mkP(n,sp,mn,mx,id)
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
        pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)` }
    : { position:"absolute",left:targetX,top:targetY,width:0,height:60,marginTop:-30,
        pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)` }

  // ══════════════════════════════════════════════════════════════════════════
  //  CHARGE
  // ══════════════════════════════════════════════════════════════════════════
  const Charge = () => {
    const hub = (sz=96, ch: React.ReactNode) => (
      <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
        width:sz,height:sz,display:"flex",alignItems:"center",justifyContent:"center" })}>
        {ch}
      </div>
    )
    switch (el) {

      case "pyrus": case "fire": return hub(104, <>
        {/* 3 erratic rings — unstable, about to explode */}
        <Ring d={92} bc="#f97316" bw="2px" glow="0 0 22px 10px rgba(249,115,22,0.76)" anim="a-spin 0.15s linear infinite" op={0.9} />
        <Ring d={70} bc="#fbbf24" bw="3px" glow="0 0 16px 7px rgba(251,191,36,0.74)" anim="a-spin 0.10s linear reverse infinite" op={0.8} />
        <Ring d={48} bc="#ef4444" bw="2px" glow="0 0 13px 7px rgba(239,68,68,0.82)"  anim="a-spin 0.07s linear infinite" op={0.7} />
        {/* Orbiting embers */}
        {[{r:46,s:6,c:"rgba(251,191,36,0.95)",dur:260,del:0,a:0},
          {r:40,s:5,c:"rgba(249,115,22,0.85)",dur:200,del:86,a:120},
          {r:44,s:4,c:"rgba(255,255,255,0.8)",dur:240,del:44,a:240}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*1.5}px ${o.s}px ${o.c}`,
            animation:`a-orbit-${i} ${o.dur}ms linear ${o.del}ms infinite` })} />
        ))}
        {/* Pulsing magma core */}
        <div style={ss({ position:"absolute",width:32,height:32,borderRadius:"50%",
          background:"radial-gradient(circle,white 6%,#fb923c 30%,#dc2626 62%,#7f1d1d 100%)",
          boxShadow:"0 0 0 5px #f97316,0 0 32px 16px rgba(251,146,60,1),0 0 64px 26px rgba(220,38,38,0.7)",
          animation:"a-fire-pulse 0.07s ease-in-out infinite" })} />
        <Ring d={96} bc="rgba(251,146,60,0.45)" bw="1px" anim="a-burst 0.12s ease-out infinite" />
        <Ring d={96} bc="rgba(251,146,60,0.26)" bw="1px" anim="a-burst 0.12s ease-out 0.06s infinite" />
        <Ring d={104} bg="radial-gradient(circle,rgba(251,146,60,0.22) 0%,transparent 70%)" anim="a-fire-pulse 0.09s ease-in-out infinite" />
      </>)

      case "aquos": case "aquo": case "water":
        if (isFehnon) return hub(110, <>
          {[98,78,60,44].map((d,i) => (
            <div key={i} style={ss({ position:"absolute",width:d,height:d,
              marginLeft:-d/2,marginTop:-d/2,borderRadius:"50%",
              border:`${i===0?"2px":"1px"} solid rgba(56,189,248,${0.84-i*0.16})`,
              boxShadow: i===0?"0 0 22px 9px rgba(56,189,248,0.6)":undefined,
              animation:`a-fehnon-contract 0.19s cubic-bezier(.44,0,1,1) ${i*26}ms forwards` })} />
          ))}
          {[-28,-19,-12,-5,1,8,14,20,27].map((y,i) => (
            <div key={i} style={ss({ position:"absolute",height:"1.5px",
              width:`${82-Math.abs(y)*1.5}px`,
              background:`linear-gradient(to right,transparent,rgba(56,189,248,${.22+Math.abs(i-4)*.13}),rgba(255,255,255,${.52+Math.abs(i-4)*.1}),rgba(56,189,248,${.22+Math.abs(i-4)*.13}),transparent)`,
              borderRadius:"9999px",
              top:`calc(50% + ${y}px)`,left:"50%",transform:"translateX(-50%)",
              animation:`a-fehnon-scan 0.19s ease-out ${i*8}ms forwards` })} />
          ))}
          <div style={ss({ position:"absolute",width:23,height:23,borderRadius:"3px",
            transform:"rotate(45deg)",
            background:"radial-gradient(circle,white 7%,#7dd3fc 32%,#0ea5e9 80%)",
            boxShadow:"0 0 0 2px #38bdf8,0 0 30px 15px rgba(56,189,248,1),0 0 56px 26px rgba(14,165,233,0.76)",
            animation:"a-fire-pulse 0.08s ease-in-out infinite" })} />
          <Ring d={106} bg="radial-gradient(circle,rgba(56,189,248,0.2) 0%,transparent 68%)" anim="a-fire-pulse 0.13s ease-in-out infinite" />
        </>)
        return hub(96, <>
          <Ring d={84} bc="#38bdf8" bw="2px" glow="0 0 18px 8px rgba(56,189,248,0.66)" anim="a-spin 0.26s linear infinite" op={0.8} />
          <Ring d={62} bc="#7dd3fc" bw="2px" glow="0 0 12px 5px rgba(125,211,252,0.56)" anim="a-spin 0.20s linear reverse infinite" op={0.64} />
          <Ring d={42} bc="#bae6fd" bw="1px" anim="a-spin 0.13s linear infinite" op={0.48} />
          {[{r:42,s:5,c:"rgba(56,189,248,0.92)",dur:340,del:0,a:60},
            {r:38,s:4,c:"rgba(125,211,252,0.8)",dur:260,del:120,a:200}].map((o,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
              borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*1.5}px ${o.s}px ${o.c}`,
              animation:`a-orbit-aq${i} ${o.dur}ms linear ${o.del}ms infinite` })} />
          ))}
          <div style={ss({ position:"absolute",width:22,height:22,borderRadius:"50%",
            background:"radial-gradient(circle,white 12%,#38bdf8 46%,#0284c7 88%)",
            boxShadow:"0 0 0 2px #7dd3fc,0 0 26px 13px rgba(56,189,248,0.94),0 0 50px 22px rgba(14,165,233,0.56)",
            animation:"a-fire-pulse 0.11s ease-in-out infinite" })} />
          <Ring d={92} bg="radial-gradient(circle,rgba(56,189,248,0.15) 0%,transparent 70%)" anim="a-fire-pulse 0.14s ease-in-out infinite" />
          <Ring d={92} bc="rgba(56,189,248,0.36)" bw="1px" anim="a-burst 0.18s ease-out infinite" />
        </>)

      case "terra": case "subterra": return hub(98, <>
        {/* Ground fissure lines */}
        {[0,40,80,120,160,200,240,280,320].map((a,i) => (
          <div key={a} style={ss({ position:"absolute",width:"32px",height:"3px",
            background:"linear-gradient(to right,rgba(180,83,9,0.92),rgba(217,119,6,0.38),transparent)",
            borderRadius:"3px",transformOrigin:"left center",
            transform:`rotate(${a}deg) translateX(14px)`,
            animation:`a-terra-crack 0.17s ease-out ${i*10}ms both` })} />
        ))}
        {/* Heavy rock orbs */}
        {[{r:44,s:7,c:"rgba(180,83,9,0.82)",dur:520,del:0,a:30},
          {r:40,s:5,c:"rgba(217,119,6,0.72)",dur:440,del:160,a:150},
          {r:46,s:4,c:"rgba(251,191,36,0.62)",dur:480,del:80,a:270}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"2px",background:o.c,boxShadow:`0 0 ${o.s}px ${o.s*0.8}px ${o.c}`,
            animation:`a-orbit-tr${i} ${o.dur}ms linear ${o.del}ms infinite` })} />
        ))}
        <Ring d={78} bc="#92400e" bw="2px" glow="0 0 16px 7px rgba(146,64,14,0.6)" anim="a-spin 0.28s linear infinite" op={0.7} />
        <div style={ss({ position:"absolute",width:28,height:28,borderRadius:"3px",
          transform:"rotate(45deg)",
          background:"radial-gradient(circle,#fbbf24 8%,#b45309 38%,#7c2d12 80%)",
          boxShadow:"0 0 0 4px #92400e,0 0 28px 14px rgba(180,83,9,0.96),0 0 58px 24px rgba(120,53,15,0.6)",
          animation:"a-terra-pulse 0.11s ease-in-out infinite" })} />
        <Ring d={92} bc="rgba(180,83,9,0.5)" bw="1px" anim="a-burst 0.17s ease-out infinite" />
        <Ring d={92} bc="rgba(146,64,14,0.32)" bw="1px" anim="a-burst 0.17s ease-out 0.085s infinite" />
        <Ring d={98} bg="radial-gradient(circle,rgba(120,53,15,0.28) 0%,transparent 70%)" anim="a-terra-pulse 0.14s ease-in-out infinite" />
      </>)

      case "haos": case "light": case "lightness": return hub(110, <>
        {Array.from({length:16},(_,i)=>i*22.5).map((a,i) => (
          <div key={a} style={ss({ position:"absolute",width:"2px",
            height:i%4===0?"32px":i%2===0?"22px":"14px",
            background:"linear-gradient(to top,transparent,rgba(254,249,195,0.82),white)",
            borderRadius:"9999px",transformOrigin:"50% 100%",
            transform:`rotate(${a}deg) translateY(-${i%4===0?28:i%2===0?19:13}px)`,
            opacity:i%4===0?1:i%2===0?0.74:0.5,
            animation:`a-haos-ray 0.09s ease-in-out ${i%3===0?0:i%3===1?30:60}ms infinite` })} />
        ))}
        {/* Fast golden orbs */}
        {[{r:52,s:6,c:"rgba(253,224,71,0.98)",dur:185,del:0,a:0},
          {r:48,s:5,c:"rgba(255,255,255,0.92)",dur:150,del:46,a:90},
          {r:52,s:5,c:"rgba(254,240,138,0.88)",dur:200,del:92,a:180},
          {r:48,s:4,c:"rgba(253,224,71,0.82)",dur:170,del:138,a:270}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*2}px ${o.s}px ${o.c}`,
            animation:`a-orbit-ha${i} ${o.dur}ms linear ${o.del}ms infinite` })} />
        ))}
        <div style={ss({ position:"absolute",width:34,height:34,borderRadius:"50%",
          background:"white",
          boxShadow:"0 0 0 6px #fef08a,0 0 0 11px rgba(253,224,71,0.46),0 0 56px 28px rgba(254,240,138,1),0 0 110px 44px rgba(253,224,71,0.46)",
          animation:"a-fire-pulse 0.07s ease-in-out infinite" })} />
        <Ring d={104} bg="radial-gradient(circle,rgba(254,240,138,0.38) 0%,transparent 65%)" anim="a-haos-halo 0.09s ease-in-out infinite" />
        <Ring d={110} bc="rgba(254,240,138,0.48)" bw="1px" anim="a-burst 0.11s ease-out infinite" />
      </>)

      case "darkus": case "darkness": case "dark": return hub(98, <>
        {/* Rings collapsing — oppressive gravity */}
        <Ring d={94} bc="#7e22ce" bw="2px" glow="0 0 26px 12px rgba(88,28,135,0.8)" anim="a-dark-consume 0.21s ease-in infinite" op={0.88} />
        <Ring d={72} bc="#a855f7" bw="2px" glow="0 0 18px 8px rgba(168,85,247,0.66)" anim="a-spin 0.27s linear reverse infinite" op={0.7} />
        <Ring d={52} bc="#c084fc" bw="1px" anim="a-spin 0.17s linear infinite" op={0.52} />
        {[0,51,103,154,206,257,308].map((a,i) => (
          <div key={a} style={ss({ position:"absolute",width:"28px",height:"2px",
            background:"linear-gradient(to right,rgba(88,28,135,0.94),rgba(88,28,135,0.25),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",
            transform:`rotate(${a}deg) translateX(10px)`,opacity:.84,
            animation:`a-dark-tendril 0.21s ease-in-out ${i*20}ms infinite` })} />
        ))}
        {/* Slow counter-orbit shadow orbs */}
        {[{r:48,s:5,c:"rgba(88,28,135,0.72)",dur:740,del:0,a:45},
          {r:44,s:4,c:"rgba(168,85,247,0.62)",dur:620,del:200,a:165},
          {r:48,s:3,c:"rgba(192,132,252,0.52)",dur:680,del:400,a:285}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"50%",background:o.c,
            animation:`a-orbit-dk${i} ${o.dur}ms linear ${o.del}ms infinite reverse` })} />
        ))}
        <div style={ss({ position:"absolute",width:23,height:23,borderRadius:"50%",
          background:"radial-gradient(circle,#0f0a1e 16%,black 55%)",
          boxShadow:"0 0 0 4px #581c87,0 0 0 9px rgba(88,28,135,0.54),0 0 42px 22px rgba(88,28,135,1),0 0 88px 36px rgba(88,28,135,0.6)" })} />
        <Ring d={96} bg="radial-gradient(circle,rgba(88,28,135,0.48) 0%,transparent 70%)" anim="a-dark-consume 0.13s ease-in infinite" />
      </>)

      case "ventus": case "wind":
        if (isUller) return hub(96, <>
          {[0,36,72,108,144,180,216,252,288,324].map((a,i) => (
            <div key={a} style={ss({ position:"absolute",width:"27px",height:"2px",
              background:"linear-gradient(to right,rgba(52,211,153,0),#6ee7b7)",
              borderRadius:"9999px",transformOrigin:"left center",
              transform:`rotate(${a}deg) translateX(12px)`,opacity:.86,
              animation:`a-gather 0.18s ease-in ${i*13}ms both` })} />
          ))}
          <div style={ss({ position:"absolute",width:23,height:23,borderRadius:"50%",
            background:"radial-gradient(circle,white 15%,#6ee7b7 50%,#059669 87%)",
            boxShadow:"0 0 0 3px #34d399,0 0 30px 15px rgba(52,211,153,0.97),0 0 60px 26px rgba(16,185,129,0.6)",
            animation:"a-fire-pulse 0.1s ease-in-out infinite" })} />
          <Ring d={88} bc="rgba(52,211,153,0.56)" bw="1px" anim="a-burst 0.13s ease-out infinite" op={0.64} />
          <Ring d={96} bg="radial-gradient(circle,rgba(52,211,153,0.2) 0%,transparent 70%)" anim="a-fire-pulse 0.12s ease-in-out infinite" />
        </>)
        return hub(96, <>
          <Ring d={88} bc="#34d399" bw="2px" glow="0 0 18px 8px rgba(52,211,153,0.64)" anim="a-spin 0.20s linear infinite" op={0.8} />
          <Ring d={66} bc="#6ee7b7" bw="2px" glow="0 0 12px 5px rgba(110,231,183,0.56)" anim="a-spin 0.15s linear reverse infinite" op={0.66} />
          <Ring d={46} bc="#a7f3d0" bw="1px" anim="a-spin 0.10s linear infinite" op={0.5} />
          {[{r:44,s:5,c:"rgba(52,211,153,0.88)",dur:280,del:0,a:0},
            {r:40,s:4,c:"rgba(167,243,208,0.72)",dur:220,del:93,a:130},
            {r:44,s:3,c:"rgba(110,231,183,0.78)",dur:260,del:186,a:250}].map((o,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
              borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*1.5}px ${o.s}px ${o.c}`,
              animation:`a-orbit-vt${i} ${o.dur}ms linear ${o.del}ms infinite` })} />
          ))}
          <div style={ss({ position:"absolute",width:22,height:22,borderRadius:"50%",
            background:"radial-gradient(circle,white 15%,#6ee7b7 50%,#059669 87%)",
            boxShadow:"0 0 0 2px #34d399,0 0 26px 13px rgba(110,231,183,0.97),0 0 52px 24px rgba(5,150,105,0.56)",
            animation:"a-fire-pulse 0.1s ease-in-out infinite" })} />
          <Ring d={92} bg="radial-gradient(circle,rgba(110,231,183,0.18) 0%,transparent 70%)" anim="a-fire-pulse 0.12s ease-in-out infinite" />
          <Ring d={92} bc="rgba(52,211,153,0.38)" bw="1px" anim="a-burst 0.15s ease-out infinite" />
        </>)

      case "void": return hub(98, <>
        <Ring d={94} bc="rgba(203,213,225,0.84)" bw="1.5px" glow="0 0 22px 9px rgba(203,213,225,0.56)" anim="a-spin 0.48s linear infinite" op={0.72} />
        <Ring d={72} bc="rgba(226,232,240,0.74)"  bw="1.5px" glow="0 0 15px 6px rgba(226,232,240,0.46)" anim="a-spin 0.32s linear reverse infinite" op={0.6} />
        <Ring d={52} bc="white" bw="1px" anim="a-spin 0.19s linear infinite" op={0.48} />
        {[{r:47,s:6,c:"rgba(255,255,255,0.92)",dur:420,del:0,a:20},
          {r:42,s:5,c:"rgba(203,213,225,0.82)",dur:340,del:105,a:140},
          {r:48,s:4,c:"rgba(226,232,240,0.72)",dur:380,del:210,a:260},
          {r:40,s:3,c:"rgba(148,163,184,0.72)",dur:300,del:75,a:80}].map((o,i)=>(
          <div key={i} style={ss({ position:"absolute",width:`${o.s}px`,height:`${o.s}px`,
            borderRadius:"50%",background:o.c,boxShadow:`0 0 ${o.s*1.5}px ${o.s}px ${o.c}`,
            animation:`a-orbit-vo${i} ${o.dur}ms linear ${o.del}ms infinite` })} />
        ))}
        <div style={ss({ position:"absolute",width:25,height:25,borderRadius:"50%",
          background:"radial-gradient(circle,white 13%,#e2e8f0 43%,#94a3b8 80%)",
          boxShadow:"0 0 0 3px #cbd5e1,0 0 0 7px rgba(148,163,184,0.54),0 0 38px 20px rgba(203,213,225,1),0 0 76px 30px rgba(148,163,184,0.56)",
          animation:"a-fire-pulse 0.1s ease-in-out infinite" })} />
        <Ring d={96} bc="rgba(203,213,225,0.4)" bw="1px" anim="a-burst 0.15s ease-out infinite" />
        <Ring d={96} bc="rgba(203,213,225,0.24)" bw="1px" anim="a-burst 0.15s ease-out 0.075s infinite" />
        <Ring d={100} bg="radial-gradient(circle,rgba(203,213,225,0.26) 0%,transparent 70%)" anim="a-fire-pulse 0.12s ease-in-out infinite" />
      </>)

      default: return hub(80, <>
        <div style={ss({ position:"absolute",width:27,height:27,borderRadius:"50%",
          background:"white",boxShadow:"0 0 34px 18px rgba(255,255,255,0.84)",
          animation:"a-fire-pulse 0.1s ease-in-out infinite" })} />
      </>)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RELEASE — element-colored snap
  // ══════════════════════════════════════════════════════════════════════════
  const Release = () => {
    const clr: Record<string,[string,string]> = {
      pyrus:["#f97316","rgba(249,115,22,0.92)"],   fire:["#f97316","rgba(249,115,22,0.92)"],
      aquos:["#38bdf8","rgba(56,189,248,0.92)"],   aquo:["#38bdf8","rgba(56,189,248,0.92)"],   water:["#38bdf8","rgba(56,189,248,0.92)"],
      terra:["#b45309","rgba(180,83,9,0.92)"],     subterra:["#b45309","rgba(180,83,9,0.92)"],
      haos:["#fde047","rgba(253,224,71,1)"],       light:["#fde047","rgba(253,224,71,1)"],     lightness:["#fde047","rgba(253,224,71,1)"],
      darkus:["#a855f7","rgba(88,28,135,0.97)"],   darkness:["#a855f7","rgba(88,28,135,0.97)"], dark:["#a855f7","rgba(88,28,135,0.97)"],
      ventus:["#34d399","rgba(52,211,153,0.92)"],  wind:["#34d399","rgba(52,211,153,0.92)"],
      void:["#e2e8f0","rgba(203,213,225,1)"],
    }
    const [col,glow] = clr[el] ?? ["white","rgba(255,255,255,0.92)"]
    return (
      <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
        width:80,height:80,marginTop:-40,display:"flex",alignItems:"center",justifyContent:"center" })}>
        <Ring d={80} bc={col} bw="3px" anim="a-release-burst 40ms ease-out forwards" glow={`0 0 32px 16px ${glow}`} />
        <Ring d={60} bc={col} bw="2px" anim="a-release-burst 40ms ease-out 10ms forwards" op={0.72} />
        <Ring d={40} bc="white" bw="1px" anim="a-release-burst 40ms ease-out 20ms forwards" op={0.52} />
        <div style={ss({ position:"absolute",width:20,height:20,borderRadius:"50%",
          background:col,boxShadow:`0 0 44px 22px ${glow}`,
          animation:"a-release-core 40ms ease-out forwards" })} />
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STRIKE — animated trails, element personality
  // ══════════════════════════════════════════════════════════════════════════
  const Strike = () => {
    const ease: Record<string,string> = {
      pyrus:"cubic-bezier(0.07,0,0.04,1)",  fire:"cubic-bezier(0.07,0,0.04,1)",
      aquos:"cubic-bezier(0.09,0,0.05,1)",  aquo:"cubic-bezier(0.09,0,0.05,1)",  water:"cubic-bezier(0.09,0,0.05,1)",
      terra:"cubic-bezier(0.30,0,0.05,1)",  subterra:"cubic-bezier(0.30,0,0.05,1)",
      haos:"cubic-bezier(0.03,0,0.03,1)",   light:"cubic-bezier(0.03,0,0.03,1)", lightness:"cubic-bezier(0.03,0,0.03,1)",
      darkus:"cubic-bezier(0.50,0,0.05,1)", darkness:"cubic-bezier(0.50,0,0.05,1)", dark:"cubic-bezier(0.50,0,0.05,1)",
      ventus:"cubic-bezier(0.09,0,0.04,1)", wind:"cubic-bezier(0.09,0,0.04,1)",
      void:"cubic-bezier(0.02,0,0.02,1)",
    }
    const mv = { animation:`a-move ${T.STRIKE}ms ${ease[el]??"cubic-bezier(0.09,0,0.05,1)"} forwards` } as React.CSSProperties

    switch (el) {

      case "pyrus": case "fire": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          {/* Speed lines — horizontal streaks across field */}
          {[-22,-11,0,11,22].map((y,i)=>(
            <div key={`sl${i}`} style={ss({ position:"fixed",left:0,top:`calc(50% + ${y*2}px)`,
              width:"100vw",height:i===2?"2px":"1px",
              background:`linear-gradient(to right,transparent,rgba(249,115,22,${0.22+Math.abs(i-2)*0.08}),transparent)`,
              pointerEvents:"none",
              animation:`a-speed-line ${T.STRIKE}ms cubic-bezier(0.04,0,0.08,1) ${i*8}ms forwards` })} />
          ))}
          <div style={ss({ position:"absolute",width:"200px",height:"16px",
            background:"linear-gradient(to right,transparent,rgba(127,29,29,0.18),rgba(220,38,38,0.45),#f97316,rgba(251,146,60,0.5))",
            borderRadius:"9999px",filter:"blur(3.5px)",opacity:.9,
            animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards` })} />
          <div style={ss({ position:"absolute",width:"155px",height:"9px",
            background:"linear-gradient(to right,transparent,rgba(220,38,38,0.55),#f97316,rgba(251,146,60,0.58))",
            borderRadius:"9999px",filter:"blur(1.5px)",opacity:.94 })} />
          <div style={ss({ position:"absolute",width:"108px",height:"5px",
            background:"linear-gradient(to right,transparent,#fbbf24,rgba(251,191,36,0.38))",
            top:"-9px",left:"30px",borderRadius:"9999px",filter:"blur(1px)",opacity:.7 })} />
          <div style={ss({ position:"absolute",width:"72px",height:"4px",
            background:"linear-gradient(to right,transparent,rgba(251,146,60,0.42))",
            top:"10px",left:"50px",borderRadius:"9999px",filter:"blur(1px)",opacity:.54 })} />
          {[{x:50,y:-11,s:12},{x:74,y:8,s:10},{x:64,y:-8,s:8},{x:90,y:5,s:6}].map((e,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${e.s}px`,height:`${e.s}px`,
              borderRadius:"50%",background:"radial-gradient(circle,white,#fbbf24)",
              boxShadow:`0 0 9px 5px rgba(251,191,36,0.92)`,
              left:`${e.x}px`,top:`${e.y}px`,opacity:.78-i*.1 })} />
          ))}
          <div style={ss({ width:"36px",height:"36px",flexShrink:0,borderRadius:"50%",
            background:"radial-gradient(circle,white 5%,#fb923c 28%,#dc2626 60%,#7f1d1d 100%)",
            boxShadow:"0 0 0 4px rgba(249,115,22,0.64),0 0 26px 14px rgba(251,146,60,1),0 0 56px 22px rgba(220,38,38,0.66)" })} />
          <div style={ss({ position:"absolute",width:"14px",height:"14px",right:"-6px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 18px 9px rgba(255,255,255,1)" })} />
        </div>
      )

      case "aquos": case "aquo": case "water":
        if (isFehnon) return (
          <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-4px" })}>
            <div style={ss({ width:`${dist}px`,height:"9px",
              background:"linear-gradient(to right,rgba(14,165,233,0) 0%,rgba(56,189,248,0.44) 7%,white 42%,rgba(125,211,252,0.93) 72%,rgba(56,189,248,0.22) 94%,transparent 100%)",
              borderRadius:"9999px",
              boxShadow:"0 0 24px 11px rgba(56,189,248,0.94),0 0 48px 20px rgba(14,165,233,0.6),0 0 80px 32px rgba(56,189,248,0.24)",
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) forwards` })} />
            <div style={ss({ width:`${dist*.83}px`,height:"3.5px",
              background:"linear-gradient(to right,transparent,rgba(125,211,252,0.74) 12%,rgba(255,255,255,0.97) 50%,rgba(186,230,253,0.65) 86%,transparent)",
              borderRadius:"9999px",position:"absolute",top:"-14px",left:`${dist*.05}px`,
              boxShadow:"0 0 12px 3px rgba(56,189,248,0.74)",
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) 16ms forwards` })} />
            <div style={ss({ width:`${dist*.63}px`,height:"2px",
              background:"linear-gradient(to right,transparent,rgba(186,230,253,0.72) 18%,rgba(255,255,255,0.84) 56%,transparent)",
              borderRadius:"9999px",position:"absolute",top:"13px",left:`${dist*.12}px`,
              boxShadow:"0 0 9px 2px rgba(56,189,248,0.6)",
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) 30ms forwards` })} />
            <div style={ss({ width:`${dist*.41}px`,height:"1px",
              background:"linear-gradient(to right,transparent,rgba(224,242,254,0.6),transparent)",
              position:"absolute",top:"-25px",left:`${dist*.18}px`,
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) 44ms forwards` })} />
            <div style={ss({ width:`${dist*.33}px`,height:"1px",
              background:"linear-gradient(to right,transparent,rgba(224,242,254,0.5),transparent)",
              position:"absolute",top:"22px",left:`${dist*.24}px`,
              animation:`a-slash ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) 52ms forwards` })} />
            <div style={ss({ position:"absolute",width:"28px",height:"28px",borderRadius:"50%",
              right:"-3px",top:"-12px",
              background:"radial-gradient(circle,white 13%,#7dd3fc 46%,#0ea5e9 88%)",
              boxShadow:"0 0 32px 16px rgba(56,189,248,1),0 0 68px 28px rgba(14,165,233,0.74)",
              animation:`a-fehnon-tip ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) forwards` })} />
            <div style={ss({ position:"absolute",width:"19px",height:"48px",borderRadius:"50%",
              right:"-6px",top:"-22px",
              border:"2px solid rgba(56,189,248,0.8)",
              boxShadow:"0 0 14px 6px rgba(56,189,248,0.7)",
              animation:"a-burst 0.22s ease-out forwards" })} />
          </div>
        )
        return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv })}>
            <div style={ss({ position:"absolute",width:"140px",height:"7px",
              background:"linear-gradient(to right,transparent,rgba(14,165,233,0.28),#0ea5e9,#38bdf8)",
              borderRadius:"9999px",filter:"blur(2.5px)",opacity:.88,
              animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards` })} />
            <div style={ss({ position:"absolute",width:"115px",height:"5px",
              background:"linear-gradient(to right,transparent,rgba(14,165,233,0.4),#0ea5e9,#38bdf8)",
              borderRadius:"9999px",filter:"blur(1px)",opacity:.84 })} />
            {[64,80,94].map((x,i)=>(
              <div key={i} style={ss({ position:"absolute",width:`${11-i*2}px`,height:`${11-i*2}px`,
                borderRadius:"50%",border:`1px solid rgba(125,211,252,${0.66-i*0.14})`,
                left:`${x}px`,top:`${i%2===0?-6:5}px`,opacity:.62 })} />
            ))}
            <div style={ss({ width:"32px",height:"32px",flexShrink:0,borderRadius:"50%",
              background:"radial-gradient(circle,white 8%,#38bdf8 42%,#0284c7 84%)",
              boxShadow:"0 0 0 2px #7dd3fc,0 0 22px 11px rgba(56,189,248,0.97),0 0 44px 18px rgba(14,165,233,0.56)" })} />
          </div>
        )

      case "terra": case "subterra": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          {/* Deep dust cloud trail */}
          <div style={ss({ position:"absolute",width:"130px",height:"20px",
            background:"linear-gradient(to right,transparent,rgba(120,53,15,0.25),rgba(146,64,14,0.55),#b45309)",
            borderRadius:"5px",filter:"blur(4px)",opacity:.84,
            animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards` })} />
          <div style={ss({ position:"absolute",width:"100px",height:"14px",
            background:"linear-gradient(to right,transparent,rgba(120,53,15,0.44),#92400e,#b45309)",
            borderRadius:"4px",filter:"blur(2px)",opacity:.88 })} />
          {[{x:22,y:-9,sz:9,r:0},{x:42,y:7,sz:8,r:22},{x:60,y:-7,sz:7,r:45},{x:76,y:6,sz:6,r:15}].map((c,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${c.sz}px`,height:`${c.sz}px`,
              background:"radial-gradient(circle,#d97706,#92400e)",
              borderRadius:"2px",transform:`rotate(${c.r}deg)`,
              left:`${c.x}px`,top:`${c.y}px`,opacity:.78-i*.1 })} />
          ))}
          <div style={ss({ width:"34px",height:"34px",flexShrink:0,borderRadius:"4px",
            transform:"rotate(42deg)",
            background:"radial-gradient(circle,#d97706 12%,#92400e 48%,#451a03 88%)",
            boxShadow:"0 0 0 3px #7c2d12,0 0 22px 12px rgba(146,64,14,0.97),0 0 46px 20px rgba(120,53,15,0.56)" })} />
        </div>
      )

      case "haos": case "light": case "lightness": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-5px" })}>
          {/* Diffuse light halo under beam */}
          <div style={ss({ width:`${dist}px`,height:"22px",
            background:"linear-gradient(to right,transparent,rgba(254,240,138,0.1),rgba(253,224,71,0.18),rgba(254,240,138,0.1),transparent)",
            borderRadius:"9999px",position:"absolute",top:"-7px",filter:"blur(5px)",
            animation:`a-laser ${T.STRIKE}ms ease-out forwards` })} />
          <div style={ss({ width:`${dist}px`,height:"10px",
            background:"linear-gradient(to right,rgba(254,240,138,0) 0%,rgba(253,224,71,0.52) 11%,white 45%,rgba(254,249,195,0.94) 78%,rgba(254,240,138,0) 100%)",
            borderRadius:"9999px",
            boxShadow:"0 0 20px 9px rgba(254,240,138,0.97),0 0 42px 18px rgba(253,224,71,0.66),0 0 75px 28px rgba(254,240,138,0.3)",
            animation:`a-laser ${T.STRIKE}ms ease-out forwards` })} />
          <div style={ss({ width:`${dist*.9}px`,height:"4px",
            background:"linear-gradient(to right,transparent,rgba(254,249,195,0.68) 13%,white 52%,transparent)",
            borderRadius:"9999px",position:"absolute",top:"-10px",left:`${dist*.04}px`,
            boxShadow:"0 0 10px 3px rgba(254,240,138,0.78)",
            animation:`a-laser ${T.STRIKE}ms ease-out 11ms forwards` })} />
          <div style={ss({ position:"absolute",right:0,top:"-14px",width:"32px",height:"32px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 34px 17px rgba(254,240,138,1),0 0 72px 30px rgba(253,224,71,0.74)" })} />
        </div>
      )

      case "darkus": case "darkness": case "dark": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          {/* Speed lines — dark purple streaks */}
          {[-18,-9,0,9,18].map((y,i)=>(
            <div key={`sl${i}`} style={ss({ position:"fixed",left:0,top:`calc(50% + ${y*2}px)`,
              width:"100vw",height:i===2?"2px":"1px",
              background:`linear-gradient(to right,transparent,rgba(88,28,135,${0.20+Math.abs(i-2)*0.07}),transparent)`,
              pointerEvents:"none",
              animation:`a-speed-line ${T.STRIKE}ms cubic-bezier(0.04,0,0.08,1) ${i*10}ms forwards` })} />
          ))}
          <div style={ss({ position:"absolute",width:"180px",height:"10px",
            background:"linear-gradient(to right,transparent,rgba(88,28,135,0.18),#7e22ce,#a855f7)",
            borderRadius:"9999px",filter:"blur(3.5px)",opacity:.9,
            animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards` })} />
          <div style={ss({ position:"absolute",width:"140px",height:"6px",
            background:"linear-gradient(to right,transparent,rgba(88,28,135,0.36),#7e22ce,#a855f7)",
            borderRadius:"9999px",filter:"blur(1.5px)",opacity:.92 })} />
          {[{w:66,y:-11,l:48},{w:54,y:11,l:64},{w:38,y:-17,l:82}].map((t,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${t.w}px`,height:"2px",
              background:"linear-gradient(to right,transparent,rgba(76,29,149,0.6))",
              borderRadius:"9999px",top:`${t.y}px`,left:`${t.l}px` })} />
          ))}
          <div style={ss({ width:"13px",height:"44px",flexShrink:0,borderRadius:"3px",
            background:"linear-gradient(to bottom,#c084fc 0%,#581c87 32%,black 62%,#581c87 100%)",
            boxShadow:"0 0 0 2px rgba(88,28,135,0.84),0 0 22px 12px rgba(88,28,135,0.97),0 0 52px 22px rgba(88,28,135,0.56)" })} />
        </div>
      )

      case "ventus": case "wind":
        if (isUller) return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv })}>
            <div style={ss({ position:"absolute",
              width:`${Math.max(dist*.55,72)}px`,height:"3px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.54),#34d399)",
              borderRadius:"9999px",boxShadow:"0 0 7px 2px rgba(52,211,153,0.56)" })} />
            <div style={ss({ position:"absolute",width:"23px",height:"2.5px",
              background:"rgba(110,231,183,0.76)",borderRadius:"9999px",
              left:"5px",top:"-6px",transformOrigin:"left center",transform:"rotate(-30deg)",
              animation:"a-feather 0.19s ease-in-out infinite" })} />
            <div style={ss({ position:"absolute",width:"23px",height:"2.5px",
              background:"rgba(110,231,183,0.76)",borderRadius:"9999px",
              left:"5px",top:"4px",transformOrigin:"left center",transform:"rotate(30deg)",
              animation:"a-feather 0.19s ease-in-out 0.095s infinite" })} />
            <div style={ss({ position:"absolute",width:"55px",height:"11px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.32))",
              top:"-5px",left:"20px",filter:"blur(3.5px)" })} />
            <div style={ss({ width:0,height:0,flexShrink:0,
              borderTop:"13px solid transparent",borderBottom:"13px solid transparent",
              borderLeft:"28px solid #34d399",
              filter:"drop-shadow(0 0 11px rgba(52,211,153,0.97)) drop-shadow(0 0 24px rgba(16,185,129,0.66))" })} />
            <div style={ss({ position:"absolute",right:"-7px",width:"13px",height:"13px",
              background:"white",borderRadius:"50%",
              boxShadow:"0 0 17px 9px rgba(52,211,153,1)" })} />
          </div>
        )
        return (
          <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
            display:"flex",alignItems:"center",...mv })}>
            <div style={ss({ position:"absolute",width:"120px",height:"30px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.11),rgba(110,231,183,0.29))",
              top:"-15px",borderRadius:"0 50% 50% 0",filter:"blur(5px)",opacity:.78,
              animation:`a-trail-fade ${T.STRIKE}ms ease-in forwards` })} />
            <div style={ss({ position:"absolute",width:"80px",height:"42px",
              background:"linear-gradient(to right,transparent,rgba(52,211,153,0.2))",
              top:"-21px",left:"17px",borderRadius:"0 50% 50% 0",filter:"blur(3px)",opacity:.6 })} />
            <div style={ss({ width:"32px",height:"44px",flexShrink:0,borderRadius:"50%",
              border:"3px solid #34d399",
              boxShadow:"0 0 18px 9px rgba(52,211,153,0.94),0 0 40px 16px rgba(16,185,129,0.5)",
              animation:"a-spin 0.09s linear infinite",filter:"blur(0.5px)" })} />
            <div style={ss({ position:"absolute",right:"3px",width:"19px",height:"30px",
              borderRadius:"50%",border:"2px solid #6ee7b7",opacity:.68,
              animation:"a-spin 0.06s linear reverse infinite" })} />
          </div>
        )

      case "void": return (
        <div style={ss({ position:"absolute",left:0,top:"50%",marginTop:"-3px",...mv })}>
          <div style={ss({ position:"absolute",
            width:`${Math.min(dist*.66,125)}px`,height:"3px",
            background:"linear-gradient(to right,transparent,rgba(203,213,225,0.34),rgba(255,255,255,0.99))",
            borderRadius:"9999px",boxShadow:"0 0 9px 3px rgba(203,213,225,0.76)",
            animation:`a-laser ${T.STRIKE}ms ease-out forwards` })} />
          {[{x:26,y:-9,s:16,d:0},{x:48,y:7,s:13,d:26},{x:66,y:-6,s:10,d:50}].map((r,i)=>(
            <div key={i} style={ss({ position:"absolute",width:`${r.s}px`,height:`${r.s}px`,
              borderRadius:"50%",border:"1px solid rgba(203,213,225,0.54)",
              left:`${r.x}%`,top:`${r.y}px`,opacity:.54,
              animation:`a-burst 0.17s ease-out ${r.d}ms forwards` })} />
          ))}
          <div style={ss({ position:"absolute",right:0,top:"-14px",width:"30px",height:"30px",
            background:"radial-gradient(circle,white 13%,#e2e8f0 49%,#94a3b8 87%)",
            borderRadius:"50%",
            boxShadow:"0 0 24px 12px rgba(203,213,225,0.97),0 0 54px 22px rgba(148,163,184,0.6)" })} />
        </div>
      )

      default: return (
        <div style={ss({ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
          display:"flex",alignItems:"center",...mv })}>
          <div style={ss({ position:"absolute",width:"78px",height:"4px",
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.9))",
            borderRadius:"9999px",filter:"blur(1px)" })} />
          <div style={ss({ width:"27px",height:"27px",flexShrink:0,borderRadius:"50%",
            background:"white",boxShadow:"0 0 22px 11px rgba(255,255,255,0.84)" })} />
        </div>
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  IMPACT — strong hero frame with element-colored compression
  // ══════════════════════════════════════════════════════════════════════════
  const Impact = () => {
    const fc: Record<string,string> = {
      pyrus:"rgba(255,115,0,0.72)",   fire:"rgba(255,115,0,0.72)",
      aquos:"rgba(56,189,248,0.60)",  aquo:"rgba(56,189,248,0.60)",   water:"rgba(56,189,248,0.60)",
      terra:"rgba(120,53,15,0.62)",   subterra:"rgba(120,53,15,0.62)",
      haos:"rgba(255,255,175,0.76)",  light:"rgba(255,255,175,0.76)", lightness:"rgba(255,255,175,0.76)",
      darkus:"rgba(88,28,135,0.70)",  darkness:"rgba(88,28,135,0.70)", dark:"rgba(88,28,135,0.70)",
      ventus:"rgba(52,211,153,0.60)", wind:"rgba(52,211,153,0.60)",
      void:"rgba(203,213,225,0.66)",
    }
    const gc: Record<string,string> = {
      pyrus:"rgba(249,115,22,1)",     aquos:"rgba(56,189,248,1)",
      aquos_fehnon:"rgba(56,189,248,1)", terra:"rgba(180,83,9,1)",
      haos:"rgba(254,240,138,1)",     darkus:"rgba(88,28,135,1)",
      ventus:"rgba(52,211,153,1)",    ventus_uller:"rgba(52,211,153,1)",
      void:"rgba(203,213,225,1)",
    }
    // Chromatic aberration color pairs per element
    const chroma: Record<string,[string,string]> = {
      pyrus:    ["rgba(255,60,0,0.55)","rgba(255,180,0,0.55)"],
      aquos:    ["rgba(0,120,255,0.50)","rgba(0,240,255,0.50)"],
      terra:    ["rgba(180,80,0,0.50)","rgba(255,180,60,0.50)"],
      haos:     ["rgba(255,255,80,0.55)","rgba(255,255,255,0.55)"],
      darkus:   ["rgba(140,0,255,0.55)","rgba(80,0,180,0.55)"],
      ventus:   ["rgba(0,200,120,0.50)","rgba(100,255,180,0.50)"],
      void:     ["rgba(180,180,220,0.50)","rgba(255,255,255,0.50)"],
    }
    const rk = (e:string) => {
      const m:{[k:string]:string}={fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",
        light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus"}
      const b=m[e]??e
      if(b==="aquos"&&isFehnon) return "aquos_fehnon"
      if(b==="ventus"&&isUller) return "ventus_uller"
      return b
    }
    const flash   = fc[el] ?? "rgba(255,255,255,0.60)"
    const glow    = gc[rk(el)] ?? "rgba(255,255,255,1)"
    const [cr, cb] = chroma[rk(el).replace("_fehnon","").replace("_uller","")] ?? ["rgba(255,0,0,0.44)","rgba(0,0,255,0.44)"]

    return (
      <div style={ss({ position:"absolute",left:0,top:0,width:0,height:0,
        transform:`rotate(${-aDeg}deg)` })}>

        {/* Screen vignette — edges darken on impact */}
        <div style={ss({ position:"fixed",left:0,top:0,width:"100vw",height:"100vh",
          pointerEvents:"none",
          background:"radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.58) 100%)",
          animation:`a-vignette ${T.IMPACT}ms ease-out forwards` })} />

        {/* Full flash */}
        <div style={ss({ position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",
          background:flash,animation:`a-hero-flash ${T.IMPACT}ms linear forwards`,pointerEvents:"none" })} />

        {/* Chromatic aberration — red channel left */}
        <div style={ss({ position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",
          background:cr,
          animation:`a-chroma-r ${T.IMPACT}ms ease-out forwards`,pointerEvents:"none",
          mixBlendMode:"screen" })} />
        {/* Chromatic aberration — blue channel right */}
        <div style={ss({ position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",
          background:cb,
          animation:`a-chroma-b ${T.IMPACT}ms ease-out forwards`,pointerEvents:"none",
          mixBlendMode:"screen" })} />

        {/* Compression orb */}
        <div style={ss({ position:"absolute",left:"-76px",top:"-76px",width:"152px",height:"152px",
          borderRadius:"50%",background:glow,filter:"blur(24px)",
          animation:`a-hero-compress ${T.IMPACT}ms ease-out forwards` })} />

        {/* Outward shockwave ring */}
        <div style={ss({ position:"absolute",left:"-60px",top:"-60px",width:"120px",height:"120px",
          borderRadius:"50%",border:`6px solid white`,
          boxShadow:`0 0 28px 12px ${glow}`,
          animation:`a-shockwave ${T.IMPACT*1.4}ms cubic-bezier(0.1,0,0.3,1) forwards` })} />

        {/* Impact ring — freeze moment */}
        <div style={ss({ position:"absolute",left:"-44px",top:"-44px",width:"88px",height:"88px",
          borderRadius:"50%",border:"4px solid white",
          boxShadow:`0 0 24px 10px ${glow},inset 0 0 16px 6px ${glow}`,
          animation:`a-hero-ring ${T.IMPACT}ms ease-out forwards` })} />
        {/* Second tight ring */}
        <div style={ss({ position:"absolute",left:"-26px",top:"-26px",width:"52px",height:"52px",
          borderRadius:"50%",border:"2px solid white",opacity:.7,
          animation:`a-hero-ring ${T.IMPACT}ms ease-out 15ms forwards` })} />

        {/* Horizontal ground shockwave */}
        <div style={ss({ position:"absolute",left:"-120px",top:"20px",width:"240px",height:"12px",
          background:`linear-gradient(to right,transparent,${glow},transparent)`,
          borderRadius:"9999px",filter:"blur(3px)",
          transformOrigin:"center center",
          animation:`a-ground-wave ${T.IMPACT*1.2}ms ease-out forwards` })} />

        {/* Smoke puffs bursting out */}
        {[{sx:-28,c:"rgba(180,180,180,0.44)"},{sx:0,c:"rgba(200,200,200,0.38)"},{sx:28,c:"rgba(160,160,160,0.42)"}].map((s,i)=>(
          <div key={i} style={ss({
            position:"absolute",left:"-20px",top:"-10px",
            width:"40px",height:"40px",borderRadius:"50%",
            background:`radial-gradient(circle,${s.c},transparent)`,
            filter:"blur(5px)",
            animation:`a-smoke ${T.AFTERMATH*.7}ms ease-out ${i*35}ms forwards`,
            "--sx":`${s.sx}px`,
          } as React.CSSProperties)} />
        ))}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  AFTERMATH — unique particle behaviors per element
  // ══════════════════════════════════════════════════════════════════════════
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
        cg:"rgba(249,115,22,0.97)",gw:"rgba(220,38,38,0.58)",
        pc:["#7f1d1d","#991b1b","#dc2626","#ea580c","#f97316","#fb923c","#fbbf24","#fef3c7","white"],
        res:"rgba(220,38,38,0.2)"},
      aquos:       {r1:"#38bdf8",r2:"#7dd3fc",r3:"#0ea5e9",
        core:"radial-gradient(circle,white 4%,#38bdf8 28%,#0284c7 60%,#0c4a6e 89%)",
        cg:"rgba(56,189,248,0.93)",gw:"rgba(14,165,233,0.48)",
        pc:["#082f49","#0c4a6e","#0284c7","#0ea5e9","#38bdf8","#7dd3fc","#bae6fd","white"],
        res:"rgba(56,189,248,0.15)"},
      aquos_fehnon:{r1:"#38bdf8",r2:"white",r3:"#7dd3fc",
        core:"radial-gradient(circle,white 6%,#bae6fd 21%,#38bdf8 44%,#0284c7 70%,#075985 92%)",
        cg:"rgba(56,189,248,1)",gw:"rgba(14,165,233,0.74)",
        pc:["white","#f0f9ff","#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9"],
        res:"rgba(56,189,248,0.22)"},
      terra:       {r1:"#b45309",r2:"#d97706",r3:"#92400e",
        core:"radial-gradient(circle,#fbbf24 4%,#b45309 28%,#7c2d12 58%,#431407 89%)",
        cg:"rgba(180,83,9,0.97)",gw:"rgba(120,53,15,0.58)",
        pc:["#1c0a04","#431407","#7c2d12","#92400e","#b45309","#d97706","#fbbf24"],
        res:"rgba(120,53,15,0.18)"},
      haos:        {r1:"#fde047",r2:"white",r3:"#fef08a",
        core:"radial-gradient(circle,white 7%,#fef9c3 26%,#fef08a 52%,#fde047 78%)",
        cg:"rgba(254,240,138,1)",gw:"rgba(253,224,71,0.68)",
        pc:["white","#fefce8","#fef9c3","#fef08a","#fde047","#fbbf24","#f59e0b","#ffd700"],
        res:"rgba(253,224,71,0.24)"},
      darkus:      {r1:"#7e22ce",r2:"#a855f7",r3:"#4c1d95",
        core:"radial-gradient(circle,#e879f9 4%,#a855f7 24%,#7e22ce 48%,#1e1b4b 78%,#0f0a1e 94%)",
        cg:"rgba(88,28,135,0.99)",gw:"rgba(88,28,135,0.68)",
        pc:["#030712","#0f0a1e","#1e1b4b","#4c1d95","#7e22ce","#a855f7","#c084fc","#e879f9"],
        res:"rgba(88,28,135,0.2)"},
      ventus:      {r1:"#34d399",r2:"#6ee7b7",r3:"#059669",
        core:"radial-gradient(circle,white 4%,#6ee7b7 26%,#10b981 54%,#064e3b 87%)",
        cg:"rgba(52,211,153,0.97)",gw:"rgba(5,150,105,0.52)",
        pc:["#022c22","#064e3b","#059669","#34d399","#6ee7b7","#a7f3d0","white"],
        res:"rgba(52,211,153,0.15)"},
      ventus_uller:{r1:"#34d399",r2:"white",r3:"#a7f3d0",
        core:"radial-gradient(circle,white 8%,#a7f3d0 24%,#34d399 48%,#059669 76%)",
        cg:"rgba(52,211,153,1)",gw:"rgba(16,185,129,0.58)",
        pc:["white","#f0fdf4","#dcfce7","#a7f3d0","#6ee7b7","#34d399","#10b981"],
        res:"rgba(52,211,153,0.18)"},
      void:        {r1:"#cbd5e1",r2:"white",r3:"#94a3b8",
        core:"radial-gradient(circle,white 8%,#f1f5f9 24%,#e2e8f0 48%,#94a3b8 74%)",
        cg:"rgba(203,213,225,1)",gw:"rgba(148,163,184,0.58)",
        pc:["white","#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8","#64748b"],
        res:"rgba(148,163,184,0.18)"},
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
        transform:`rotate(${-aDeg}deg)` })}>

        <div style={ss({ position:"absolute",left:"-80px",top:"-80px",width:"160px",height:"160px",
          animation:"a-local-shake 0.2s cubic-bezier(.36,.07,.19,.97) both" })}>

          {/* 5 shockwave rings — extra outer one for punch */}
          {[{s:200,bw:2,d:0,op:.52},{s:152,bw:3,d:0,op:1},{s:120,bw:2,d:24,op:.68},{s:86,bw:2,d:46,op:.48},{s:60,bw:1,d:0,op:.34}].map(({s,bw,d,op},i)=>(
            <div key={i} style={ss({ position:"absolute",
              left:`${80-s/2}px`,top:`${80-s/2}px`,width:s,height:s,
              borderRadius:"50%",
              border:`${bw}px solid ${i<=1?c.r1:i===2?c.r2:c.r3}`,
              boxShadow: i===1?`0 0 30px 13px ${c.cg}`:undefined,
              opacity:op,
              animation:`a-ring ${T.AFTERMATH}ms ease-out ${d}ms forwards` })} />
          ))}

          {/* Core burst */}
          <div style={ss({ position:"absolute",left:"18px",top:"18px",width:"124px",height:"124px",
            borderRadius:"50%",background:c.core,
            boxShadow:`0 0 70px 32px ${c.cg},0 0 140px 56px ${c.gw}`,
            animation:`a-core ${T.AFTERMATH}ms cubic-bezier(0.03,0.94,0.10,1) forwards` })} />

          {/* Second wave eruption */}
          <div style={ss({ position:"absolute",left:"38px",top:"38px",width:"84px",height:"84px",
            borderRadius:"50%",border:`2px solid ${c.r2}`,
            boxShadow:`0 0 14px 5px ${c.cg}`,
            animation:`a-ring ${T.AFTERMATH*.62}ms ease-out ${T.AFTERMATH*.28}ms forwards` })} />
          <div style={ss({ position:"absolute",left:"46px",top:"46px",width:"68px",height:"68px",
            borderRadius:"50%",background:c.res,filter:"blur(7px)",
            animation:`a-second-wave ${T.AFTERMATH*.52}ms ease-out ${T.AFTERMATH*.27}ms forwards` })} />

          {/* Residual glow */}
          <div style={ss({ position:"absolute",left:"26px",top:"26px",width:"108px",height:"108px",
            borderRadius:"50%",background:c.res,filter:"blur(11px)",
            animation:`a-residual ${T.AFTERMATH}ms ease-out forwards` })} />

          {/* FIRE: upward ember column */}
          {isFire && <div style={ss({ position:"absolute",left:"68px",top:"-20px",width:"24px",height:"60px",
            background:"linear-gradient(to top,rgba(251,146,60,0.6),rgba(249,115,22,0.2),transparent)",
            borderRadius:"9999px",filter:"blur(4px)",
            animation:`a-fire-rise ${T.AFTERMATH*.7}ms ease-out forwards` })} />}

          {/* TERRA: rock crack lines on ground */}
          {isTerra && [0,72,144,216,288].map((a,i)=>(
            <div key={i} style={ss({ position:"absolute",left:"80px",top:"80px",
              width:`${50+i*8}px`,height:"2px",
              background:`linear-gradient(to right,${c.r1},transparent)`,
              borderRadius:"9999px",transformOrigin:"left center",
              transform:`rotate(${a}deg)`,opacity:.7,
              animation:`a-terra-crack ${T.AFTERMATH*.6}ms ease-out ${i*20}ms both` })} />
          ))}

          {/* HAOS: cross light beams */}
          {isHaos && [0,45,90,135].map((a,i)=>(
            <div key={i} style={ss({ position:"absolute",left:"80px",top:"80px",
              width:"70px",height:"2px",
              background:`linear-gradient(to right,white,rgba(254,240,138,0.5),transparent)`,
              borderRadius:"9999px",transformOrigin:"left center",
              transform:`rotate(${a}deg)`,opacity:.8,
              animation:`a-terra-crack ${T.AFTERMATH*.5}ms ease-out ${i*15}ms both` })} />
          ))}

          {/* VOID: glitch rings */}
          {isVoid && [52,74,96].map((s,i)=>(
            <div key={i} style={ss({ position:"absolute",
              left:`${80-s/2}px`,top:`${80-s/2}px`,width:s,height:s,
              borderRadius:"50%",border:"1px solid rgba(203,213,225,0.54)",
              animation:`a-void-glitch ${T.AFTERMATH*.44}ms ease-out ${i*36}ms forwards` })} />
          ))}

          {/* VENTUS: spiral wind ring */}
          {isVent && <div style={ss({ position:"absolute",left:"40px",top:"40px",
            width:"80px",height:"80px",borderRadius:"50%",
            border:"2px dashed rgba(52,211,153,0.5)",
            animation:`a-spin 0.4s linear forwards,a-ring ${T.AFTERMATH*.7}ms ease-out forwards` })} />}

        </div>

        {/* FEHNON: scar lines */}
        {isFeh && [
          {w:142,r:0,  t:-3,d:0 },{w:110,r:-19,t:-3,d:7},
          {w:110,r:19, t:-3,d:7 },{w:82, r:-39,t:-2,d:17},
          {w:82, r:39, t:-2,d:17},{w:58, r:-59,t:-1,d:28},
          {w:58, r:59, t:-1,d:28},{w:40, r:-77,t:0, d:40},
          {w:40, r:77, t:0, d:40},
        ].map((s,i)=>(
          <div key={i} style={ss({ position:"absolute",height:"2.5px",width:`${s.w}px`,
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.97),rgba(125,211,252,0.79),transparent)",
            borderRadius:"9999px",top:`${s.t}px`,left:0,
            transform:`rotate(${s.r}deg)`,transformOrigin:"left center",
            boxShadow:"0 0 10px 2px rgba(56,189,248,0.82)",
            animation:`a-slash ${T.AFTERMATH*.66}ms cubic-bezier(0,0,0.12,1) ${s.d}ms forwards` })} />
        ))}
        {isFeh && [-22,-14,-7,0,7,14].map((y,i)=>(
          <div key={`sc${i}`} style={ss({ position:"absolute",height:"1px",
            width:`${92-Math.abs(y)*2}px`,
            background:`linear-gradient(to right,transparent,rgba(186,230,253,${.4+Math.abs(i-2.5)*.1}),transparent)`,
            borderRadius:"9999px",top:`${y}px`,left:"50%",transform:"translateX(-50%)",
            animation:`a-slash ${T.AFTERMATH*.49}ms ease-out ${i*10}ms forwards` })} />
        ))}

        {/* DARKUS: inward absorption (particles go IN) */}
        {isDark && [0,60,120,180,240,300].map((a,i)=>(
          <div key={i} style={ss({ position:"absolute",height:"2px",
            width:"60px",borderRadius:"9999px",
            background:"linear-gradient(to left,rgba(88,28,135,0.78),transparent)",
            transformOrigin:"left center",
            transform:`rotate(${a}deg)`,
            animation:`a-dark-abs ${T.AFTERMATH*.78}ms ease-out ${i*14}ms forwards` })} />
        ))}

        {/* Particles — element-specific behavior */}
        {pts.map(p => {
          const a   = iBase + p.angle * .82
          const d   = p.spd * p.life
          // Fire particles rise (negative Y bias), dark particles absorbed (reduced distance)
          const px  = Math.cos(a)*d*(isDark?.45:1) + p.jx
          const py  = Math.sin(a)*d*(isDark?.45:1) + p.jy + (isFire?p.riseY*.4:0)
          const col = c.pc[p.id % c.pc.length]
          const rot = isFeh ? Math.atan2(py,px)*180/Math.PI : isDark ? p.spin : 0
          return (
            <div key={p.id} style={ss({
              position:"absolute",
              width:`${p.sz}px`,
              height:`${isFeh?p.sz*.34:isTerra?p.sz*.65:isDark?p.sz*1.6:p.sz}px`,
              borderRadius: isTerra||isFeh?"2px":isDark?"1px 5px 1px 5px":"50%",
              background:col,
              boxShadow:`0 0 6px 2px ${col}98`,
              transform: rot?`rotate(${rot}deg)`:undefined,
              animation:`a-particle ${T.AFTERMATH}ms cubic-bezier(0.02,0.56,0.11,1) ${p.del}ms forwards`,
              "--px":`${px}px`,"--py":`${py}px`,opacity:0,
            } as React.CSSProperties)} />
          )
        })}

        {/* ── Shrapnel angular pieces — angular debris launched outward ── */}
        {Array.from({length:8}).map((_,i) => {
          const ang = iBase + (i / 8) * Math.PI * 2
          const dist2 = 55 + (i % 3) * 22
          const shx = Math.cos(ang) * dist2
          const shy = Math.sin(ang) * dist2
          const shr = (i * 47 + 30) % 360
          const col = c.pc[(i*2) % c.pc.length]
          return (
            <div key={`sh${i}`} style={ss({
              position:"absolute",
              width:`${4 + (i%3)*2}px`,height:`${4 + (i%3)*2}px`,
              background:col,
              borderRadius:"1px",
              boxShadow:`0 0 4px 1px ${col}`,
              animation:`a-shrapnel ${T.AFTERMATH*.72}ms cubic-bezier(0.05,0.4,0.2,1) ${i*18}ms forwards`,
              "--shx":`${shx}px`,"--shy":`${shy}px`,"--shr":`${shr}deg`,opacity:1,
            } as React.CSSProperties)} />
          )
        })}

        {/* ── Smoke column rising from impact point ── */}
        {[{sx:-14,delay:0},{sx:0,delay:50},{sx:14,delay:90}].map((s,i)=>(
          <div key={`smk${i}`} style={ss({
            position:"absolute",left:"-14px",top:"-10px",
            width:"28px",height:"28px",borderRadius:"50%",
            background:"radial-gradient(circle,rgba(160,160,160,0.36),transparent)",
            filter:"blur(5px)",
            animation:`a-smoke ${T.AFTERMATH*.85}ms ease-out ${s.delay}ms forwards`,
            "--sx":`${s.sx}px`,
          } as React.CSSProperties)} />
        ))}
      </div>
    )
  }

  let content: React.ReactNode = null
  if      (phase==="charge")    content = <Charge />
  else if (phase==="release")   content = <Release />
  else if (phase==="strike")    content = <Strike />
  else if (phase==="impact")    content = <Impact />
  else if (phase==="aftermath") content = <Aftermath />

  // Orbit keyframes for each element's orbs
  const orbitKFs = `
    @keyframes a-orbit-0 { from{transform:rotate(0deg) translateX(-46px)} to{transform:rotate(360deg) translateX(-46px)} }
    @keyframes a-orbit-1 { from{transform:rotate(120deg) translateX(-40px)} to{transform:rotate(480deg) translateX(-40px)} }
    @keyframes a-orbit-2 { from{transform:rotate(240deg) translateX(-44px)} to{transform:rotate(600deg) translateX(-44px)} }
    @keyframes a-orbit-aq0 { from{transform:rotate(60deg) translateX(-42px)} to{transform:rotate(420deg) translateX(-42px)} }
    @keyframes a-orbit-aq1 { from{transform:rotate(200deg) translateX(-38px)} to{transform:rotate(560deg) translateX(-38px)} }
    @keyframes a-orbit-tr0 { from{transform:rotate(30deg) translateX(-44px)} to{transform:rotate(390deg) translateX(-44px)} }
    @keyframes a-orbit-tr1 { from{transform:rotate(150deg) translateX(-40px)} to{transform:rotate(510deg) translateX(-40px)} }
    @keyframes a-orbit-tr2 { from{transform:rotate(270deg) translateX(-46px)} to{transform:rotate(630deg) translateX(-46px)} }
    @keyframes a-orbit-ha0 { from{transform:rotate(0deg) translateX(-52px)} to{transform:rotate(360deg) translateX(-52px)} }
    @keyframes a-orbit-ha1 { from{transform:rotate(90deg) translateX(-48px)} to{transform:rotate(450deg) translateX(-48px)} }
    @keyframes a-orbit-ha2 { from{transform:rotate(180deg) translateX(-52px)} to{transform:rotate(540deg) translateX(-52px)} }
    @keyframes a-orbit-ha3 { from{transform:rotate(270deg) translateX(-48px)} to{transform:rotate(630deg) translateX(-48px)} }
    @keyframes a-orbit-dk0 { from{transform:rotate(45deg) translateX(-48px)} to{transform:rotate(-315deg) translateX(-48px)} }
    @keyframes a-orbit-dk1 { from{transform:rotate(165deg) translateX(-44px)} to{transform:rotate(-195deg) translateX(-44px)} }
    @keyframes a-orbit-dk2 { from{transform:rotate(285deg) translateX(-48px)} to{transform:rotate(-75deg) translateX(-48px)} }
    @keyframes a-orbit-vt0 { from{transform:rotate(0deg) translateX(-44px)} to{transform:rotate(360deg) translateX(-44px)} }
    @keyframes a-orbit-vt1 { from{transform:rotate(130deg) translateX(-40px)} to{transform:rotate(490deg) translateX(-40px)} }
    @keyframes a-orbit-vt2 { from{transform:rotate(250deg) translateX(-44px)} to{transform:rotate(610deg) translateX(-44px)} }
    @keyframes a-orbit-vo0 { from{transform:rotate(20deg) translateX(-47px)} to{transform:rotate(380deg) translateX(-47px)} }
    @keyframes a-orbit-vo1 { from{transform:rotate(140deg) translateX(-42px)} to{transform:rotate(500deg) translateX(-42px)} }
    @keyframes a-orbit-vo2 { from{transform:rotate(260deg) translateX(-48px)} to{transform:rotate(620deg) translateX(-48px)} }
    @keyframes a-orbit-vo3 { from{transform:rotate(80deg) translateX(-40px)} to{transform:rotate(440deg) translateX(-40px)} }
  `

  const output = (
    <>
      <style>{`
        ${orbitKFs}
        @keyframes a-spin           { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes a-burst          { 0%{transform:scale(.24);opacity:1} 100%{transform:scale(1.82);opacity:0} }
        @keyframes a-fire-pulse     { 0%,100%{opacity:.76;transform:scale(1)} 50%{opacity:1;transform:scale(1.24)} }
        @keyframes a-terra-pulse    { 0%,100%{opacity:.74;transform:scale(1) rotate(45deg)} 50%{opacity:1;transform:scale(1.22) rotate(45deg)} }
        @keyframes a-haos-halo      { 0%,100%{opacity:.66;transform:scale(1)} 50%{opacity:1;transform:scale(1.38)} }
        @keyframes a-haos-ray       { 0%,100%{opacity:.62;transform-origin:50% 100%;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.44)} }
        @keyframes a-dark-consume   { 0%{transform:scale(1.48);opacity:.88} 100%{transform:scale(.42);opacity:.2} }
        @keyframes a-dark-tendril   { 0%,100%{opacity:.66;transform-origin:left center;transform:scaleX(1)} 50%{opacity:1;transform:scaleX(1.44)} }
        @keyframes a-gather         { 0%{opacity:0;transform-origin:left center;transform:translateX(12px) scaleX(0)} 100%{opacity:.86;transform:translateX(12px) scaleX(1)} }
        @keyframes a-terra-crack    { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 100%{opacity:.86;transform:scaleX(1)} }
        @keyframes a-fehnon-contract{ 0%{transform:scale(1.6);opacity:0} 50%{opacity:1} 100%{transform:scale(.17);opacity:0} }
        @keyframes a-fehnon-scan    { 0%{opacity:0;transform:translateX(-50%) scaleX(0)} 42%{opacity:1} 100%{opacity:0;transform:translateX(-50%) scaleX(1)} }
        @keyframes a-release-burst  { 0%{transform:scale(.28);opacity:1;border-width:9px} 100%{transform:scale(2.5);opacity:0;border-width:1px} }
        @keyframes a-release-core   { 0%{opacity:1;transform:scale(1.6)} 100%{opacity:0;transform:scale(3.2)} }
        @keyframes a-move           { 0%{transform:translateX(0)} 100%{transform:translateX(${dist}px)} }
        @keyframes a-trail-fade     { 0%{opacity:.9} 100%{opacity:.2} }
        @keyframes a-laser          { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 6%{opacity:1} 70%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes a-slash          { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 5%{opacity:1} 64%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes a-fehnon-tip     { 0%{transform:translateX(${-dist}px);opacity:0} 6%{opacity:1} 100%{transform:translateX(0);opacity:1} }
        @keyframes a-feather        { 0%,100%{transform:rotate(-30deg);opacity:.76} 50%{transform:rotate(-21deg);opacity:1} }
        @keyframes a-hero-flash     { 0%{opacity:1} 45%{opacity:.72} 100%{opacity:0} }
        @keyframes a-hero-compress  { 0%{transform:scale(.08);opacity:1} 45%{transform:scale(1.5);opacity:.92} 100%{transform:scale(2.2);opacity:0} }
        @keyframes a-hero-ring      { 0%{transform:scale(.18);opacity:1;border-width:7px} 100%{transform:scale(2.4);opacity:0;border-width:1px} }
        @keyframes a-local-shake    { 0%{transform:translate(0,0)} 8%{transform:translate(-7px,-3px)} 18%{transform:translate(7px,4px)} 28%{transform:translate(-6px,2px)} 40%{transform:translate(5px,-3px)} 54%{transform:translate(-3px,2px)} 70%{transform:translate(2px,1px)} 100%{transform:translate(0,0)} }
        @keyframes a-ring           { 0%{transform:scale(.06);opacity:1;border-width:9px} 42%{opacity:.65} 100%{transform:scale(3.0);opacity:0;border-width:1px} }
        @keyframes a-core           { 0%{transform:scale(.02);opacity:1} 14%{transform:scale(1.42);opacity:1} 44%{transform:scale(1.08);opacity:.8} 100%{transform:scale(0);opacity:0} }
        @keyframes a-second-wave    { 0%{transform:scale(.08);opacity:0} 18%{opacity:1} 58%{opacity:.6} 100%{transform:scale(1.9);opacity:0} }
        @keyframes a-residual       { 0%{opacity:0} 14%{opacity:1} 56%{opacity:.54} 100%{opacity:0;transform:scale(1.6)} }
        @keyframes a-particle       { 0%{transform:translate(0,0) scale(2.1);opacity:1} 100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0} }
        @keyframes a-dark-abs       { 0%{opacity:0;transform-origin:right center;transform:rotate(0deg) scaleX(0)} 26%{opacity:.76} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes a-void-glitch    { 0%{transform:scale(.18) skewX(0deg);opacity:.84} 38%{transform:scale(1.25) skewX(3deg);opacity:.52} 68%{transform:scale(1.7) skewX(-2deg);opacity:.22} 100%{transform:scale(2.3) skewX(0deg);opacity:0} }
        @keyframes a-fire-rise      { 0%{transform:translateY(0) scaleY(0);opacity:0} 20%{opacity:.8} 100%{transform:translateY(-50px) scaleY(1.5);opacity:0} }
        @keyframes afterimage-fade  { 0%{opacity:.28} 100%{opacity:0} }

        /* ── NEW: speed lines across the field during strike ── */
        @keyframes a-speed-line     { 0%{transform:translateX(-100%) scaleX(0);opacity:0} 4%{opacity:.7} 60%{opacity:.5} 100%{transform:translateX(0) scaleX(1);opacity:0} }
        /* ── NEW: chromatic split on impact (R/B channel offset) ── */
        @keyframes a-chroma-r       { 0%{opacity:.72;transform:translate(-6px,0)} 60%{opacity:.3} 100%{opacity:0;transform:translate(-14px,0)} }
        @keyframes a-chroma-b       { 0%{opacity:.72;transform:translate(6px,0)} 60%{opacity:.3} 100%{opacity:0;transform:translate(14px,0)} }
        /* ── NEW: impact shockwave that travels outward ── */
        @keyframes a-shockwave      { 0%{transform:scale(0);opacity:.9;border-width:8px} 70%{opacity:.4} 100%{transform:scale(4.5);opacity:0;border-width:0px} }
        /* ── NEW: smoke puff rising after hit ── */
        @keyframes a-smoke          { 0%{transform:translate(var(--sx),0) scale(0.3);opacity:.72;filter:blur(3px)} 100%{transform:translate(var(--sx),-44px) scale(2.0);opacity:0;filter:blur(12px)} }
        /* ── NEW: shrapnel angular pieces ── */
        @keyframes a-shrapnel       { 0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1} 100%{transform:translate(var(--shx),var(--shy)) rotate(var(--shr)) scale(0);opacity:0} }
        /* ── NEW: attacker flash-in at charge start ── */
        @keyframes a-charge-zoom    { 0%{transform:scale(1.18);opacity:0;filter:blur(4px)} 50%{opacity:.84;filter:blur(0)} 100%{transform:scale(1);opacity:1;filter:blur(0)} }
        /* ── NEW: ground shockwave horizontal ── */
        @keyframes a-ground-wave    { 0%{transform:scaleX(0) scaleY(1);opacity:.8} 100%{transform:scaleX(1) scaleY(0.2);opacity:0} }
        /* ── NEW: energy flare spike ── */
        @keyframes a-flare          { 0%{transform:scaleY(0);opacity:1} 35%{opacity:.8} 100%{transform:scaleY(1);opacity:0} }
        /* ── NEW: impact screen edge vignette ── */
        @keyframes a-vignette       { 0%{opacity:.82} 100%{opacity:0} }
      `}</style>

      {attackerImage && inFlight && (
        <>
          {/* Attacker card ghost — fades as it launches */}
          <div style={ss({ position:"absolute",left:startX-40,top:startY-56,
            width:"80px",height:"112px",
            backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
            borderRadius:"8px",opacity:.28,filter:"blur(3px) brightness(1.6)",
            animation:"afterimage-fade 280ms ease-out forwards",
            pointerEvents:"none",zIndex:5 })} />
          {/* Second ghost — delayed, more transparent */}
          <div style={ss({ position:"absolute",left:startX-40,top:startY-56,
            width:"80px",height:"112px",
            backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
            borderRadius:"8px",opacity:.14,filter:"blur(6px) brightness(2)",
            animation:"afterimage-fade 400ms ease-out 60ms forwards",
            pointerEvents:"none",zIndex:4 })} />
        </>
      )}

      <div style={ctr} suppressHydrationWarning>{content}</div>
    </>
  )

  if (portalTarget) return createPortal(output, portalTarget)
  if (typeof document !== "undefined") return createPortal(output, document.body)
  return null
}
