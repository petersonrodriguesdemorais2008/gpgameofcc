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

const CHARGE_DURATION  = 160
const TRAVEL_DURATION  = 340
const IMPACT_DURATION  = 440
const TOTAL_DURATION   = CHARGE_DURATION + TRAVEL_DURATION + IMPACT_DURATION

const rng = (a: number, b: number) => a + Math.random() * (b - a)

const mkParticles = (n: number, spread = 110) =>
  Array.from({ length: n }).map((_, i) => ({
    id: i,
    angle: rng(-spread / 2, spread / 2) * (Math.PI / 180),
    speed: rng(35, 85),
    size:  rng(2.5, 8),
    life:  rng(0.45, 1),
    delay: rng(0, 80),
  }))

// ─── Helper: thin glow bar ────────────────────────────────────────────────────
const Bar = ({ w, h=4, bg, glow, top=0, left=0, rot=0, anim, delay=0, origin="left center" }: {
  w:number|string; h?:number; bg:string; glow?:string; top?:number; left?:number|string;
  rot?:number; anim?:string; delay?:number; origin?:string
}) => (
  <div style={{
    position:"absolute", width:w, height:h, background:bg, borderRadius:"9999px",
    top, left: left as any, transform:`rotate(${rot}deg)`,
    boxShadow: glow, animation: anim,
    animationDelay: delay ? `${delay}ms` : undefined,
    transformOrigin: origin,
  }} />
)

// ─── Helper: glowing circle ───────────────────────────────────────────────────
const Ring = ({ size, border, color, glow, anim, delay=0, opacity=1 }: {
  size:number; border?:string; color?:string; glow?:string; anim?:string; delay?:number; opacity?:number
}) => (
  <div style={{
    position:"absolute",
    width:size, height:size,
    marginLeft:-size/2, marginTop:-size/2,
    borderRadius:"50%",
    border, background: color,
    boxShadow: glow, opacity,
    animation: anim,
    animationDelay: delay ? `${delay}ms` : undefined,
  }} />
)

export function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY,
  element, attackerImage, attackerName,
  portalTarget, onImpact, onComplete,
}: AttackAnimationProps) {
  const [phase, setPhase] = useState<AnimPhase>("charge")
  const [mounted, setMounted] = useState(false)

  const distance = Math.hypot(targetX - startX, targetY - startY)
  const angleRad  = Math.atan2(targetY - startY, targetX - startX)
  const angleDeg  = angleRad * (180 / Math.PI)
  const el        = element?.toLowerCase().trim() || "neutral"

  const isUller  = /ullr|uller/i.test(attackerName || "")
  const isFehnon = /fehnon/i.test(attackerName || "")

  const particles = useMemo(() => mkParticles(
    ({ pyrus:22,fire:22,aquos:18,aquo:18,water:18,terra:16,subterra:16,
       haos:24,light:24,lightness:24,darkus:20,darkness:20,dark:20,
       ventus:20,wind:20,void:22 } as Record<string,number>)[el] ?? 16,
    ({ void:360,haos:160,light:160,lightness:160,ventus:140,wind:140 } as Record<string,number>)[el] ?? 115
  ), [el])

  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    setMounted(true)
    const t1 = setTimeout(() => setPhase("travel"), CHARGE_DURATION)
    const t2 = setTimeout(() => { setPhase("impact"); onImpact?.(id,targetX,targetY,el) }, CHARGE_DURATION+TRAVEL_DURATION)
    const t3 = setTimeout(() => onCompleteRef.current(id), TOTAL_DURATION)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [id])

  if (!mounted) return null

  const cs: React.CSSProperties = phase === "impact"
    ? { position:"absolute",left:targetX,top:targetY,width:0,height:60,marginTop:-30,pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${angleDeg}deg)` }
    : { position:"absolute",left:startX, top:startY, width:distance,height:60,marginTop:-30,pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${angleDeg}deg)` }

  // ══════════════════════════════════════════════════════════════════════════
  //  CHARGE
  // ══════════════════════════════════════════════════════════════════════════
  const renderCharge = () => {
    const wrap = (children: React.ReactNode, size=96) => (
      <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
        width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center" }}>
        {children}
      </div>
    )

    switch(el) {

      // ── PYRUS ──────────────────────────────────────────────────────────────
      case "pyrus": case "fire": return wrap(<>
        {/* Three nested spinning rings of increasing speed */}
        <Ring size={84} border="2px solid #f97316" glow="0 0 14px 5px rgba(249,115,22,0.7)" anim="ep-spin 0.22s linear infinite" opacity={0.85} />
        <Ring size={62} border="3px solid #fbbf24" glow="0 0 10px 4px rgba(251,191,36,0.7)" anim="ep-spin 0.16s linear reverse infinite" opacity={0.75} />
        <Ring size={42} border="2px solid #ef4444" glow="0 0 8px 4px rgba(239,68,68,0.8)"  anim="ep-spin 0.12s linear infinite"         opacity={0.65} />
        {/* Pulsing magma core */}
        <div style={{ position:"absolute",width:26,height:26,borderRadius:"50%",
          background:"radial-gradient(circle,white 12%,#fb923c 40%,#dc2626 75%,#7f1d1d 100%)",
          boxShadow:"0 0 0 3px #f97316,0 0 24px 12px rgba(251,146,60,1),0 0 48px 20px rgba(220,38,38,0.6)",
          animation:"ep-pulse 0.09s ease-in-out infinite" }} />
        {/* Expanding heat rings */}
        <Ring size={88} border="1px solid rgba(251,146,60,0.5)" anim="ep-ring-out 0.16s ease-out infinite" />
        <Ring size={88} border="1px solid rgba(251,146,60,0.35)" anim="ep-ring-out 0.16s ease-out 0.08s infinite" />
        {/* Outer radial glow */}
        <Ring size={96} color="radial-gradient(circle,rgba(251,146,60,0.18) 0%,transparent 70%)" anim="ep-pulse 0.11s ease-in-out infinite" />
      </>)

      // ── AQUOS / FEHNON ─────────────────────────────────────────────────────
      case "aquos": case "aquo": case "water": return isFehnon ? wrap(<>
        {/* Fehnon: holographic blade forming — contracting rings + scan lines */}
        <Ring size={92} border="2px solid rgba(56,189,248,0.75)" glow="0 0 14px 5px rgba(56,189,248,0.5)" anim="ep-fehnon-contract 0.16s ease-in forwards" />
        <Ring size={72} border="1px solid rgba(125,211,252,0.55)" anim="ep-fehnon-contract 0.16s ease-in 0.03s forwards" />
        <Ring size={54} border="1px solid rgba(186,230,253,0.4)"  anim="ep-fehnon-contract 0.16s ease-in 0.06s forwards" />
        {[-22,-14,-6,0,6,14,22].map((y,i)=>(
          <div key={i} style={{ position:"absolute",height:"1.5px",
            width:`${74 - Math.abs(y)*2}px`,
            background:`linear-gradient(to right,transparent,rgba(56,189,248,${0.3+Math.abs(i-3)*0.12}),rgba(255,255,255,${0.55+Math.abs(i-3)*0.1}),rgba(56,189,248,${0.3+Math.abs(i-3)*0.12}),transparent)`,
            borderRadius:"9999px",top:`calc(50% + ${y}px)`,left:"50%",
            transform:"translateX(-50%)",animation:"ep-fehnon-scanline 0.16s ease-out forwards" }} />
        ))}
        {/* Diamond blade core */}
        <div style={{ position:"absolute",width:22,height:22,borderRadius:"3px",transform:"rotate(45deg)",
          background:"radial-gradient(circle,white 8%,#7dd3fc 40%,#0ea5e9 80%)",
          boxShadow:"0 0 0 2px #38bdf8,0 0 22px 10px rgba(56,189,248,1),0 0 44px 18px rgba(14,165,233,0.7)",
          animation:"ep-pulse 0.08s ease-in-out infinite" }} />
        <Ring size={96} color="radial-gradient(circle,rgba(56,189,248,0.2) 0%,transparent 70%)" anim="ep-fehnon-glow 0.14s ease-in-out infinite" />
      </>, 100) : wrap(<>
        {/* Normal Aquos: water vortex charging */}
        <Ring size={80} border="2px solid #38bdf8" glow="0 0 12px 5px rgba(56,189,248,0.6)" anim="ep-spin 0.35s linear infinite" opacity={0.75} />
        <Ring size={58} border="2px solid #7dd3fc" glow="0 0 8px 3px rgba(125,211,252,0.5)"  anim="ep-spin 0.28s linear reverse infinite" opacity={0.6} />
        <Ring size={38} border="1px solid #bae6fd" anim="ep-spin 0.2s linear infinite" opacity={0.45} />
        <div style={{ position:"absolute",width:20,height:20,borderRadius:"50%",
          background:"radial-gradient(circle,white 15%,#38bdf8 50%,#0284c7 90%)",
          boxShadow:"0 0 0 2px #7dd3fc,0 0 20px 10px rgba(56,189,248,0.9),0 0 40px 16px rgba(14,165,233,0.5)",
          animation:"ep-pulse 0.11s ease-in-out infinite" }} />
        <Ring size={88} color="radial-gradient(circle,rgba(56,189,248,0.16) 0%,transparent 70%)" anim="ep-pulse 0.13s ease-in-out infinite" />
        <Ring size={88} border="1px solid rgba(56,189,248,0.4)" anim="ep-ring-out 0.2s ease-out infinite" />
      </>)

      // ── TERRA ──────────────────────────────────────────────────────────────
      case "terra": case "subterra": return wrap(<>
        {/* Rock shards radiating outward */}
        {[0,40,80,120,160,200,240,280,320].map(a=>(
          <div key={a} style={{ position:"absolute",width:"28px",height:"3px",
            background:`linear-gradient(to right,transparent,#b45309,#d97706)`,
            borderRadius:"2px",transform:`rotate(${a}deg) translateX(14px)`,opacity:0.8 }} />
        ))}
        {/* Inner crackling core */}
        <div style={{ position:"absolute",width:26,height:26,borderRadius:"3px",transform:"rotate(45deg)",
          background:"radial-gradient(circle,#fbbf24 10%,#b45309 45%,#7c2d12 90%)",
          boxShadow:"0 0 0 3px #92400e,0 0 22px 10px rgba(180,83,9,0.95),0 0 44px 18px rgba(120,53,15,0.5)",
          animation:"ep-pulse 0.12s ease-in-out infinite" }} />
        {/* Ground pulse rings */}
        <Ring size={84} border="2px solid #92400e" glow="0 0 10px 4px rgba(146,64,14,0.5)" anim="ep-ring-out 0.18s ease-out infinite" opacity={0.7} />
        <Ring size={84} border="1px solid #b45309" anim="ep-ring-out 0.18s ease-out 0.09s infinite" opacity={0.45} />
        <Ring size={92} color="radial-gradient(circle,rgba(120,53,15,0.3) 0%,transparent 70%)" anim="ep-pulse 0.14s ease-in-out infinite" />
      </>)

      // ── HAOS ───────────────────────────────────────────────────────────────
      case "haos": case "light": case "lightness": return wrap(<>
        {/* 16 divine rays of varying length */}
        {[0,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,270,292.5,315,337.5].map((a,i)=>(
          <div key={a} style={{ position:"absolute",width:"2px",
            height: i%4===0 ? "26px" : i%2===0 ? "18px" : "12px",
            background:"linear-gradient(to top,transparent,#fef9c3,white)",
            borderRadius:"9999px",
            transform:`rotate(${a}deg) translateY(-${i%4===0?22:i%2===0?15:10}px)`,
            opacity: i%4===0 ? 1 : i%2===0 ? 0.75 : 0.5,
            animation:`ep-haos-ray 0.12s ease-in-out ${i%3===0?0:i%3===1?40:80}ms infinite` }} />
        ))}
        {/* Blazing core */}
        <div style={{ position:"absolute",width:28,height:28,borderRadius:"50%",
          background:"white",
          boxShadow:"0 0 0 4px #fef08a,0 0 0 8px rgba(253,224,71,0.5),0 0 44px 20px rgba(254,240,138,1),0 0 70px 28px rgba(253,224,71,0.45)",
          animation:"ep-pulse 0.08s ease-in-out infinite" }} />
        <Ring size={92} color="radial-gradient(circle,rgba(254,240,138,0.4) 0%,transparent 65%)" anim="ep-haos-halo 0.1s ease-in-out infinite" />
        <Ring size={96} border="1px solid rgba(254,240,138,0.5)" anim="ep-ring-out 0.14s ease-out infinite" />
      </>, 100)

      // ── DARKUS ─────────────────────────────────────────────────────────────
      case "darkus": case "darkness": case "dark": return wrap(<>
        {/* Outer void ring slowly collapsing */}
        <Ring size={86} border="2px solid #7e22ce" glow="0 0 16px 6px rgba(88,28,135,0.7)" anim="ep-suck-ring 0.18s ease-in infinite" opacity={0.8} />
        <Ring size={64} border="2px solid #a855f7" glow="0 0 10px 4px rgba(168,85,247,0.6)" anim="ep-spin 0.25s linear reverse infinite" opacity={0.65} />
        <Ring size={44} border="1px solid #c084fc" anim="ep-spin 0.18s linear infinite" opacity={0.45} />
        {/* Void tendrils */}
        {[0,51,103,154,206,257,308].map(a=>(
          <div key={a} style={{ position:"absolute",width:"22px",height:"2px",
            background:`linear-gradient(to right,rgba(88,28,135,0.9),transparent)`,
            borderRadius:"9999px",transform:`rotate(${a}deg) translateX(10px)`,opacity:0.75,
            animation:"ep-tendril 0.16s ease-in-out infinite" }} />
        ))}
        {/* Singularity core */}
        <div style={{ position:"absolute",width:18,height:18,borderRadius:"50%",
          background:"radial-gradient(circle,#1e1b4b 20%,black 60%)",
          boxShadow:"0 0 0 3px #581c87,0 0 0 6px rgba(88,28,135,0.5),0 0 30px 14px rgba(88,28,135,1),0 0 60px 24px rgba(88,28,135,0.5)" }} />
        <Ring size={92} color="radial-gradient(circle,rgba(88,28,135,0.45) 0%,transparent 70%)" anim="ep-suck 0.14s ease-in infinite" />
      </>)

      // ── VENTUS / ULLER ─────────────────────────────────────────────────────
      case "ventus": case "wind": return isUller ? wrap(<>
        {/* Uller: arrow tip forming from converging energy lines */}
        {[0,40,80,120,160,200,240,280,320].map(a=>(
          <div key={a} style={{ position:"absolute",width:"22px",height:"2px",
            background:`linear-gradient(to right,rgba(52,211,153,0),#34d399)`,
            borderRadius:"9999px",transform:`rotate(${a}deg) translateX(12px)`,opacity:0.8 }} />
        ))}
        <div style={{ position:"absolute",width:18,height:18,borderRadius:"50%",
          background:"radial-gradient(circle,white 18%,#6ee7b7 55%,#059669 90%)",
          boxShadow:"0 0 0 2px #34d399,0 0 22px 10px rgba(52,211,153,0.95),0 0 44px 18px rgba(16,185,129,0.55)",
          animation:"ep-pulse 0.1s ease-in-out infinite" }} />
        <Ring size={78} border="1px solid rgba(52,211,153,0.6)" anim="ep-ring-out 0.16s ease-out infinite" opacity={0.6} />
        <Ring size={90} color="radial-gradient(circle,rgba(52,211,153,0.22) 0%,transparent 70%)" anim="ep-pulse 0.12s ease-in-out infinite" />
      </>) : wrap(<>
        {/* Other ventus: dual counter-rotating vortex */}
        <Ring size={82} border="2px solid #34d399" glow="0 0 12px 5px rgba(52,211,153,0.6)" anim="ep-spin 0.28s linear infinite" opacity={0.75} />
        <Ring size={60} border="2px solid #6ee7b7" glow="0 0 8px 3px rgba(110,231,183,0.55)"  anim="ep-spin 0.22s linear reverse infinite" opacity={0.6} />
        <Ring size={40} border="1px solid #a7f3d0" anim="ep-spin 0.16s linear infinite" opacity={0.45} />
        <div style={{ position:"absolute",width:18,height:18,borderRadius:"50%",
          background:"radial-gradient(circle,white 18%,#6ee7b7 55%,#059669 90%)",
          boxShadow:"0 0 0 2px #34d399,0 0 20px 10px rgba(110,231,183,0.95),0 0 40px 16px rgba(5,150,105,0.5)",
          animation:"ep-pulse 0.1s ease-in-out infinite" }} />
        <Ring size={88} color="radial-gradient(circle,rgba(110,231,183,0.2) 0%,transparent 70%)" anim="ep-pulse 0.12s ease-in-out infinite" />
        <Ring size={88} border="1px solid rgba(52,211,153,0.4)" anim="ep-ring-out 0.18s ease-out infinite" />
      </>)

      // ── VOID ───────────────────────────────────────────────────────────────
      case "void": return wrap(<>
        {/* Reality distortion — silver rings at different speeds */}
        <Ring size={88} border="1.5px solid rgba(203,213,225,0.8)" glow="0 0 14px 5px rgba(203,213,225,0.5)" anim="ep-spin 0.6s linear infinite" opacity={0.65} />
        <Ring size={66} border="1.5px solid rgba(226,232,240,0.7)"  glow="0 0 10px 4px rgba(226,232,240,0.4)" anim="ep-spin 0.42s linear reverse infinite" opacity={0.55} />
        <Ring size={46} border="1px solid white"                    anim="ep-spin 0.28s linear infinite"        opacity={0.45} />
        {/* Dimensional rift core */}
        <div style={{ position:"absolute",width:22,height:22,borderRadius:"50%",
          background:"radial-gradient(circle,white 15%,#e2e8f0 45%,#94a3b8 80%)",
          boxShadow:"0 0 0 3px #cbd5e1,0 0 0 6px rgba(148,163,184,0.5),0 0 30px 14px rgba(203,213,225,1),0 0 58px 22px rgba(148,163,184,0.5)",
          animation:"ep-pulse 0.11s ease-in-out infinite" }} />
        {/* Void ripples */}
        <Ring size={90} border="1px solid rgba(203,213,225,0.4)" anim="ep-ring-out 0.18s ease-out infinite" />
        <Ring size={90} border="1px solid rgba(203,213,225,0.25)" anim="ep-ring-out 0.18s ease-out 0.09s infinite" />
        <Ring size={94} color="radial-gradient(circle,rgba(203,213,225,0.3) 0%,transparent 70%)" anim="ep-pulse 0.13s ease-in-out infinite" />
      </>)

      default: return wrap(<>
        <div style={{ position:"absolute",width:22,height:22,borderRadius:"50%",
          background:"white",boxShadow:"0 0 24px 12px rgba(255,255,255,0.8)",
          animation:"ep-pulse 0.1s ease-in-out infinite" }} />
      </>)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TRAVEL
  // ══════════════════════════════════════════════════════════════════════════
  const renderProjectile = () => {
    const mv: React.CSSProperties = { animation:`ep-move ${TRAVEL_DURATION}ms cubic-bezier(0.1,0,0.08,1) forwards` }

    switch(el) {

      // ── PYRUS ──────────────────────────────────────────────────────────────
      case "pyrus": case "fire": return (
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center", ...mv }}>
          {/* Long ember tail */}
          <Bar w="130px" h={8}  bg="linear-gradient(to right,transparent,rgba(127,29,29,0.4),rgba(220,38,38,0.7),#f97316)" glow="0 0 8px 3px rgba(249,115,22,0.6)" />
          <Bar w="90px"  h={4}  bg="linear-gradient(to right,transparent,#fbbf24,rgba(251,191,36,0.4))" top={-6} left="20px" />
          <Bar w="60px"  h={3}  bg="linear-gradient(to right,transparent,rgba(251,146,60,0.5))" top={7} left="40px" />
          {/* Secondary ember */}
          <div style={{ position:"absolute",width:10,height:10,borderRadius:"50%",
            background:"radial-gradient(circle,white,#fbbf24)",
            boxShadow:"0 0 6px 3px rgba(251,191,36,0.9)",
            left:"65px",top:"-6px",opacity:0.7 }} />
          {/* Main fireball */}
          <div style={{ width:28,height:28,flexShrink:0,borderRadius:"50%",
            background:"radial-gradient(circle,white 8%,#fb923c 38%,#dc2626 72%,#7f1d1d 100%)",
            boxShadow:"0 0 0 3px rgba(249,115,22,0.6),0 0 18px 8px rgba(251,146,60,1),0 0 36px 14px rgba(220,38,38,0.6)" }} />
          {/* Tip flare */}
          <div style={{ position:"absolute",width:10,height:10,right:"-4px",
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 10px 5px rgba(255,255,255,0.95)" }} />
        </div>
      )

      // ── AQUOS / FEHNON ─────────────────────────────────────────────────────
      case "aquos": case "aquo": case "water": return isFehnon ? (
        // Fehnon: multi-layer holographic laceration slash
        <div style={{ position:"absolute",left:0,top:"50%",marginTop:"-3px" }}>
          {/* Main beam — instant reveal left→right */}
          <Bar w={`${distance}px`} h={7}
            bg="linear-gradient(to right,rgba(14,165,233,0) 0%,rgba(56,189,248,0.55) 12%,white 48%,rgba(125,211,252,0.85) 72%,rgba(56,189,248,0.25) 92%,transparent 100%)"
            glow="0 0 16px 7px rgba(56,189,248,0.9),0 0 32px 12px rgba(14,165,233,0.55),0 0 56px 22px rgba(56,189,248,0.22)"
            anim={`ep-fehnon-slash ${TRAVEL_DURATION}ms cubic-bezier(0.04,0,0.08,1) forwards`} />
          {/* Secondary slash — offset up */}
          <Bar w={`${distance*0.8}px`} h={3}
            bg="linear-gradient(to right,transparent,rgba(125,211,252,0.7) 18%,rgba(255,255,255,0.9) 52%,rgba(186,230,253,0.55) 82%,transparent)"
            glow="0 0 8px 3px rgba(56,189,248,0.7)" top={-11}
            left={`${distance*0.06}px`}
            anim={`ep-fehnon-slash ${TRAVEL_DURATION}ms cubic-bezier(0.04,0,0.08,1) 20ms forwards`} />
          {/* Tertiary slash — offset down */}
          <Bar w={`${distance*0.6}px`} h={2}
            bg="linear-gradient(to right,transparent,rgba(186,230,253,0.65) 25%,rgba(255,255,255,0.78) 55%,transparent)"
            glow="0 0 6px 2px rgba(56,189,248,0.55)" top={10}
            left={`${distance*0.13}px`}
            anim={`ep-fehnon-slash ${TRAVEL_DURATION}ms cubic-bezier(0.04,0,0.08,1) 36ms forwards`} />
          {/* Holo edge — far above */}
          <Bar w={`${distance*0.42}px`} h={1}
            bg="linear-gradient(to right,transparent,rgba(224,242,254,0.55),transparent)" top={-21}
            left={`${distance*0.2}px`}
            anim={`ep-fehnon-slash ${TRAVEL_DURATION}ms cubic-bezier(0.04,0,0.08,1) 52ms forwards`} />
          <Bar w={`${distance*0.34}px`} h={1}
            bg="linear-gradient(to right,transparent,rgba(224,242,254,0.45),transparent)" top={19}
            left={`${distance*0.26}px`}
            anim={`ep-fehnon-slash ${TRAVEL_DURATION}ms cubic-bezier(0.04,0,0.08,1) 58ms forwards`} />
          {/* Tip orb tracking the leading edge */}
          <div style={{ position:"absolute",width:22,height:22,borderRadius:"50%",right:"-2px",top:"-9px",
            background:"radial-gradient(circle,white 18%,#7dd3fc 52%,#0ea5e9 88%)",
            boxShadow:"0 0 22px 11px rgba(56,189,248,1),0 0 48px 20px rgba(14,165,233,0.7)",
            animation:`ep-fehnon-tip ${TRAVEL_DURATION}ms cubic-bezier(0.04,0,0.08,1) forwards` }} />
          {/* Oval ripple at tip */}
          <div style={{ position:"absolute",width:14,height:38,borderRadius:"50%",right:"-3px",top:"-18px",
            border:"2px solid rgba(56,189,248,0.75)",
            boxShadow:"0 0 10px 4px rgba(56,189,248,0.65)",
            animation:`ep-ring-out ${TRAVEL_DURATION*0.45}ms ease-out forwards` }} />
        </div>
      ) : (
        // Normal Aquos: water torpedo
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center", ...mv }}>
          <Bar w="100px" h={5} bg="linear-gradient(to right,transparent,rgba(14,165,233,0.45),#0ea5e9,#38bdf8)" glow="0 0 6px 3px rgba(56,189,248,0.6)" />
          {/* bubble trail */}
          {[55,72,85].map((x,i)=>(
            <div key={i} style={{ position:"absolute",width:`${9-i*2}px`,height:`${9-i*2}px`,
              borderRadius:"50%",border:`1px solid rgba(125,211,252,${0.6-i*0.15})`,
              left:`${x}px`,top:`${i%2===0?-5:4}px`,opacity:0.55 }} />
          ))}
          <div style={{ width:26,height:26,flexShrink:0,borderRadius:"50%",
            background:"radial-gradient(circle,white 10%,#38bdf8 46%,#0284c7 85%)",
            boxShadow:"0 0 0 2px #7dd3fc,0 0 16px 8px rgba(56,189,248,0.95),0 0 32px 12px rgba(14,165,233,0.5)" }} />
        </div>
      )

      // ── TERRA ──────────────────────────────────────────────────────────────
      case "terra": case "subterra": return (
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center", ...mv }}>
          <Bar w="85px" h={9} bg="linear-gradient(to right,transparent,rgba(120,53,15,0.5),#92400e,#b45309)" glow="0 0 6px 3px rgba(146,64,14,0.7)" />
          {/* Rock shards in wake */}
          {[0,1,2,3].map(i=>(
            <div key={i} style={{ position:"absolute",
              width:`${7-i}px`,height:`${7-i}px`,background:"#92400e",
              borderRadius:"2px",transform:`rotate(${i*22}deg)`,
              left:`${22+i*16}px`,top:`${i%2===0?-6:5}px`,opacity:0.7-i*0.1 }} />
          ))}
          {/* Boulder */}
          <div style={{ width:28,height:28,flexShrink:0,borderRadius:"4px",transform:"rotate(42deg)",
            background:"radial-gradient(circle,#d97706 18%,#92400e 52%,#451a03 88%)",
            boxShadow:"0 0 0 2px #7c2d12,0 0 14px 6px rgba(146,64,14,0.95),0 0 28px 10px rgba(120,53,15,0.5)" }} />
        </div>
      )

      // ── HAOS ───────────────────────────────────────────────────────────────
      case "haos": case "light": case "lightness": return (
        <div style={{ position:"absolute",left:0,top:"50%",marginTop:"-3px" }}>
          {/* Laser beam expanding instantly */}
          <Bar w={`${distance}px`} h={7}
            bg="linear-gradient(to right,rgba(254,240,138,0) 0%,rgba(253,224,71,0.6) 15%,white 50%,rgba(254,249,195,0.85) 78%,rgba(254,240,138,0) 100%)"
            glow="0 0 12px 5px rgba(254,240,138,0.95),0 0 26px 10px rgba(253,224,71,0.6),0 0 48px 20px rgba(254,240,138,0.3)"
            anim={`ep-laser ${TRAVEL_DURATION}ms ease-out forwards`} />
          {/* Secondary thinner laser */}
          <Bar w={`${distance*0.85}px`} h={3}
            bg="linear-gradient(to right,transparent,rgba(254,249,195,0.6) 20%,white 55%,transparent)"
            glow="0 0 6px 2px rgba(254,240,138,0.7)" top={-6}
            left={`${distance*0.04}px`}
            anim={`ep-laser ${TRAVEL_DURATION}ms ease-out 15ms forwards`} />
          {/* Tip burst */}
          <div style={{ position:"absolute",right:0,top:"-10px",width:24,height:24,
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 20px 10px rgba(254,240,138,1),0 0 44px 20px rgba(253,224,71,0.7)" }} />
        </div>
      )

      // ── DARKUS ─────────────────────────────────────────────────────────────
      case "darkus": case "darkness": case "dark": return (
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center", ...mv }}>
          <Bar w="120px" h={5} bg="linear-gradient(to right,transparent,rgba(88,28,135,0.4),#7e22ce,#a855f7)" glow="0 0 8px 3px rgba(88,28,135,0.7)" />
          {/* Shadow tendrils */}
          <Bar w="55px" h={2} bg="linear-gradient(to right,transparent,rgba(76,29,149,0.6))" top={-7} left="40px" />
          <Bar w="45px" h={2} bg="linear-gradient(to right,transparent,rgba(76,29,149,0.5))" top={7}  left="55px" />
          <Bar w="30px" h={1} bg="linear-gradient(to right,transparent,rgba(167,139,250,0.4))" top={-12} left="70px" />
          {/* Dark blade */}
          <div style={{ width:10,height:34,flexShrink:0,borderRadius:"3px",
            background:"linear-gradient(to bottom,#c084fc 0%,#581c87 40%,black 70%,#581c87 100%)",
            boxShadow:"0 0 0 1px rgba(88,28,135,0.8),0 0 14px 7px rgba(88,28,135,0.95),0 0 32px 14px rgba(88,28,135,0.5)" }} />
        </div>
      )

      // ── VENTUS / ULLER ─────────────────────────────────────────────────────
      case "ventus": case "wind": return isUller ? (
        // Uller: precision green arrow
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center", ...mv }}>
          {/* Arrow shaft */}
          <Bar w={`${Math.max(distance*0.55,70)}px`} h={3}
            bg="linear-gradient(to right,transparent,rgba(52,211,153,0.5),#34d399)"
            glow="0 0 4px 2px rgba(52,211,153,0.5)" />
          {/* Fletching (two angled bars at tail) */}
          <Bar w="18px" h={2} bg="rgba(110,231,183,0.7)" rot={-25} left="6px" origin="left center" />
          <Bar w="18px" h={2} bg="rgba(110,231,183,0.7)" rot={25}  left="6px" origin="left center" />
          {/* Arrowhead */}
          <div style={{ width:0,height:0,flexShrink:0,
            borderTop:"10px solid transparent",borderBottom:"10px solid transparent",
            borderLeft:"22px solid #34d399",
            filter:"drop-shadow(0 0 7px rgba(52,211,153,0.95)) drop-shadow(0 0 16px rgba(16,185,129,0.6))" }} />
          {/* Tip spark */}
          <div style={{ position:"absolute",right:"-5px",width:9,height:9,
            background:"white",borderRadius:"50%",
            boxShadow:"0 0 10px 5px rgba(52,211,153,1)" }} />
        </div>
      ) : (
        // Other Ventus: whirlwind tornado
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center", ...mv }}>
          {/* Wind trail */}
          <Bar w="100px" h={22} bg="linear-gradient(to right,transparent,rgba(52,211,153,0.12),rgba(110,231,183,0.25))" top={-11} style={{filter:"blur(4px)"}} />
          <Bar w="70px"  h={32} bg="linear-gradient(to right,transparent,rgba(52,211,153,0.18))" top={-16} left="12px" style={{filter:"blur(3px)"}} />
          {/* Spinning vortex core */}
          <div style={{ width:26,height:36,flexShrink:0,borderRadius:"50%",
            border:"3px solid #34d399",
            boxShadow:"0 0 12px 5px rgba(52,211,153,0.85),0 0 26px 10px rgba(16,185,129,0.45)",
            animation:"ep-spin 0.14s linear infinite",filter:"blur(0.5px)" }} />
          <div style={{ position:"absolute",right:"3px",width:16,height:24,borderRadius:"50%",
            border:"2px solid #6ee7b7",opacity:0.6,animation:"ep-spin 0.1s linear reverse infinite" }} />
        </div>
      )

      // ── VOID ───────────────────────────────────────────────────────────────
      case "void": return (
        <div style={{ position:"absolute",left:0,top:"50%",marginTop:"-3px" }}>
          {/* Silver rift tear */}
          <Bar w={`${Math.min(distance*0.62,115)}px`} h={3}
            bg="linear-gradient(to right,transparent,rgba(203,213,225,0.4),rgba(255,255,255,0.95))"
            glow="0 0 6px 2px rgba(203,213,225,0.7)" />
          {/* Distortion ripples along path */}
          {[35,55,72].map((x,i)=>(
            <div key={i} style={{ position:"absolute",width:`${13-i*3}px`,height:`${13-i*3}px`,
              borderRadius:"50%",border:"1px solid rgba(203,213,225,0.55)",
              left:`${x}%`,top:`${-6+i*2}px`,
              animation:`ep-ring-out ${0.2+i*0.04}s ease-out ${i*30}ms infinite`,opacity:0.5 }} />
          ))}
          {/* Orb */}
          <div style={{ position:"absolute",right:0,top:"-10px",width:24,height:24,
            background:"radial-gradient(circle,white 18%,#e2e8f0 52%,#94a3b8 88%)",
            borderRadius:"50%",
            boxShadow:"0 0 16px 8px rgba(203,213,225,0.95),0 0 36px 14px rgba(148,163,184,0.55)" }} />
        </div>
      )

      default: return (
        <div style={{ position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center", ...mv }}>
          <Bar w="70px" h={4} bg="linear-gradient(to right,transparent,rgba(255,255,255,0.85))" />
          <div style={{ width:22,height:22,flexShrink:0,borderRadius:"50%",background:"white",
            boxShadow:"0 0 14px 7px rgba(255,255,255,0.75)" }} />
        </div>
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  IMPACT
  // ══════════════════════════════════════════════════════════════════════════
  const renderImpact = () => {
    type EC = { r1:string; r2:string; r3:string; core:string; cg:string; gw:string; pc:string[]; flash:string }

    const resolveKey = (e:string) => {
      const m:{[k:string]:string}={fire:"pyrus",aquo:"aquos",water:"aquos",subterra:"terra",light:"haos",lightness:"haos",darkness:"darkus",dark:"darkus",wind:"ventus"}
      const base = m[e]??e
      if((base==="aquos")&&isFehnon)    return "aquos_fehnon"
      if((base==="ventus")&&isUller)    return "ventus_uller"
      return base
    }

    const cfgs: Record<string,EC> = {
      pyrus:        {r1:"#f97316",r2:"#fbbf24",r3:"#ef4444",core:"radial-gradient(circle,white 6%,#fb923c 32%,#dc2626 62%,#7f1d1d 90%)",cg:"rgba(249,115,22,0.95)",gw:"rgba(220,38,38,0.5)",pc:["#7f1d1d","#991b1b","#dc2626","#ea580c","#f97316","#fb923c","#fbbf24","white"],flash:"rgba(255,120,0,0.25)"},
      aquos:        {r1:"#38bdf8",r2:"#7dd3fc",r3:"#0ea5e9",core:"radial-gradient(circle,white 6%,#38bdf8 35%,#0284c7 68%,#0c4a6e 92%)",cg:"rgba(56,189,248,0.9)",gw:"rgba(14,165,233,0.4)",pc:["#082f49","#0c4a6e","#0284c7","#0ea5e9","#38bdf8","#7dd3fc","#bae6fd","white"],flash:"rgba(56,189,248,0.2)"},
      aquos_fehnon: {r1:"#38bdf8",r2:"white",  r3:"#7dd3fc",core:"radial-gradient(circle,white 8%,#bae6fd 26%,#38bdf8 50%,#0284c7 76%,#075985 94%)",cg:"rgba(56,189,248,1)",gw:"rgba(14,165,233,0.65)",pc:["white","#f0f9ff","#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9"],flash:"rgba(56,189,248,0.35)"},
      terra:        {r1:"#b45309",r2:"#d97706",r3:"#92400e",core:"radial-gradient(circle,#fbbf24 6%,#b45309 35%,#7c2d12 65%,#431407 92%)",cg:"rgba(180,83,9,0.95)",gw:"rgba(120,53,15,0.5)",pc:["#1c0a04","#431407","#7c2d12","#92400e","#b45309","#d97706","#fbbf24"],flash:"rgba(120,53,15,0.28)"},
      haos:         {r1:"#fde047",r2:"white",  r3:"#fef08a",core:"radial-gradient(circle,white 10%,#fef9c3 32%,#fef08a 58%,#fde047 82%)",cg:"rgba(254,240,138,1)",gw:"rgba(253,224,71,0.6)",pc:["white","#fefce8","#fef9c3","#fef08a","#fde047","#fbbf24","#f59e0b"],flash:"rgba(255,255,180,0.35)"},
      darkus:       {r1:"#7e22ce",r2:"#a855f7",r3:"#4c1d95",core:"radial-gradient(circle,#e879f9 6%,#a855f7 30%,#7e22ce 55%,#1e1b4b 82%,#0f0a1e 96%)",cg:"rgba(88,28,135,0.98)",gw:"rgba(88,28,135,0.6)",pc:["#030712","#0f0a1e","#1e1b4b","#4c1d95","#7e22ce","#a855f7","#c084fc","#e879f9"],flash:"rgba(88,28,135,0.25)"},
      ventus:       {r1:"#34d399",r2:"#6ee7b7",r3:"#059669",core:"radial-gradient(circle,white 6%,#6ee7b7 32%,#10b981 60%,#064e3b 90%)",cg:"rgba(52,211,153,0.95)",gw:"rgba(5,150,105,0.45)",pc:["#022c22","#064e3b","#059669","#34d399","#6ee7b7","#a7f3d0","white"],flash:"rgba(52,211,153,0.2)"},
      ventus_uller: {r1:"#34d399",r2:"white",  r3:"#a7f3d0",core:"radial-gradient(circle,white 10%,#a7f3d0 30%,#34d399 55%,#059669 80%)",cg:"rgba(52,211,153,1)",gw:"rgba(16,185,129,0.5)",pc:["white","#f0fdf4","#dcfce7","#a7f3d0","#6ee7b7","#34d399","#10b981"],flash:"rgba(52,211,153,0.25)"},
      void:         {r1:"#cbd5e1",r2:"white",  r3:"#94a3b8",core:"radial-gradient(circle,white 10%,#f1f5f9 30%,#e2e8f0 52%,#94a3b8 78%)",cg:"rgba(203,213,225,1)",gw:"rgba(148,163,184,0.5)",pc:["white","#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8","#64748b"],flash:"rgba(203,213,225,0.25)"},
    }

    const c = cfgs[resolveKey(el)] ?? cfgs["void"]
    const iBase = angleRad + Math.PI
    const isTerra  = el==="terra"||el==="subterra"
    const isFehImp = isFehnon&&(el==="aquos"||el==="aquo"||el==="water")

    return (
      <div style={{ position:"absolute",left:0,top:0,width:0,height:0,transform:`rotate(${-angleDeg}deg)` }}>

        {/* ── Screen flash ── */}
        <div style={{ position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",
          background:c.flash,animation:"ep-flash 0.14s linear forwards",pointerEvents:"none" }} />

        {/* ── 4 expanding shockwave rings ── */}
        {[{s:140,bw:3,delay:0,op:1},{s:110,bw:2,delay:35,op:0.6},{s:80,bw:2,delay:65,op:0.4},{s:56,bw:2,delay:0,dur:IMPACT_DURATION*0.55,op:0.3}].map(({s,bw,delay,op},i)=>(
          <div key={i} style={{ position:"absolute",left:`-${s/2}px`,top:`-${s/2}px`,width:s,height:s,
            borderRadius:"50%",border:`${bw}px solid ${i===1?c.r2:c.r1}`,
            boxShadow: i===0 ? `0 0 18px 6px ${c.cg}` : undefined,
            opacity:op,
            animation:`ep-ring-expand ${IMPACT_DURATION}ms ease-out ${delay}ms forwards` }} />
        ))}

        {/* ── Core burst ── */}
        <div style={{ position:"absolute",left:"-56px",top:"-56px",width:"112px",height:"112px",
          borderRadius:"50%",background:c.core,
          boxShadow:`0 0 50px 22px ${c.cg},0 0 100px 40px ${c.gw}`,
          animation:`ep-core ${IMPACT_DURATION}ms cubic-bezier(0.06,0.85,0.14,1) forwards` }} />

        {/* ── FEHNON exclusive: laceration scar lines ── */}
        {isFehImp && [
          {w:130,rot:0,   top:-3,  delay:0 },{w:100,rot:-20, top:-3, delay:12},
          {w:100,rot:20,  top:-3,  delay:12},{w:72, rot:-40, top:-2, delay:25},
          {w:72, rot:40,  top:-2,  delay:25},{w:50, rot:-62, top:-1, delay:38},
          {w:50, rot:62,  top:-1,  delay:38},{w:32, rot:-80, top:0,  delay:50},
        ].map((s,i)=>(
          <div key={i} style={{ position:"absolute",height:"2.5px",width:`${s.w}px`,
            background:"linear-gradient(to right,transparent,rgba(255,255,255,0.92),rgba(125,211,252,0.75),transparent)",
            borderRadius:"9999px",top:`${s.top}px`,left:0,
            transform:`rotate(${s.rot}deg)`,transformOrigin:"left center",
            boxShadow:"0 0 7px 2px rgba(56,189,248,0.75)",
            animation:`ep-fehnon-slash ${IMPACT_DURATION*0.68}ms cubic-bezier(0,0,0.2,1) ${s.delay}ms forwards` }} />
        ))}
        {isFehImp && [-18,-10,-3,4,11,18].map((y,i)=>(
          <div key={`sc${i}`} style={{ position:"absolute",height:"1px",
            width:`${84-Math.abs(y)*2}px`,
            background:`linear-gradient(to right,transparent,rgba(186,230,253,${0.48+Math.abs(i-2.5)*0.08}),transparent)`,
            borderRadius:"9999px",top:`${y}px`,left:"50%",transform:"translateX(-50%)",
            animation:`ep-fehnon-slash ${IMPACT_DURATION*0.52}ms ease-out ${i*10}ms forwards` }} />
        ))}

        {/* ── Particles ── */}
        {particles.map(p=>{
          const a   = iBase + p.angle*0.85
          const d   = p.speed * p.life
          const px  = Math.cos(a)*d
          const py  = Math.sin(a)*d
          const col = c.pc[p.id % c.pc.length]
          const rot = isFehImp ? Math.atan2(py,px)*180/Math.PI : 0
          return (
            <div key={p.id} style={{
              position:"absolute",
              width:`${p.size}px`,
              height:`${isFehImp ? p.size*0.38 : isTerra ? p.size*0.7 : p.size}px`,
              borderRadius: isTerra||isFehImp ? "2px" : "50%",
              background:col,
              boxShadow:`0 0 5px 2px ${col}90`,
              transform: rot ? `rotate(${rot}deg)` : undefined,
              animation:`ep-particle ${IMPACT_DURATION}ms cubic-bezier(0.03,0.5,0.16,1) ${p.delay}ms forwards`,
              "--px":`${px}px`,"--py":`${py}px`,opacity:0,
            } as React.CSSProperties} />
          )
        })}
      </div>
    )
  }

  let content = null
  if(phase==="charge") content = renderCharge()
  else if(phase==="travel") content = renderProjectile()
  else if(phase==="impact") content = renderImpact()

  const el$ = (
    <>
      <style>{`
        @keyframes ep-pulse         { 0%,100%{opacity:.72;transform:scale(1)}     50%{opacity:1;transform:scale(1.18)} }
        @keyframes ep-haos-halo     { 0%,100%{opacity:.62;transform:scale(1)}     50%{opacity:1;transform:scale(1.30)} }
        @keyframes ep-haos-ray      { 0%,100%{opacity:.6;transform-origin:center bottom;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.3)} }
        @keyframes ep-ring-out      { 0%{transform:scale(.3);opacity:1}           100%{transform:scale(1.7);opacity:0} }
        @keyframes ep-spin          { from{transform:rotate(0deg)}                to{transform:rotate(360deg)} }
        @keyframes ep-suck          { 0%{transform:scale(1.5);opacity:.9}         100%{transform:scale(.5);opacity:.3} }
        @keyframes ep-suck-ring     { 0%{transform:scale(1.4);opacity:.8}         100%{transform:scale(.6);opacity:.3} }
        @keyframes ep-tendril       { 0%,100%{opacity:.6;transform:scaleX(1)}     50%{opacity:1;transform:scaleX(1.3)} }
        @keyframes ep-move          { 0%{transform:translateX(0)}                 100%{transform:translateX(${distance}px)} }
        @keyframes ep-laser         { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 7%{opacity:1} 72%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes ep-flash         { 0%{opacity:1} 30%{opacity:.6} 100%{opacity:0} }
        @keyframes ep-ring-expand   { 0%{transform:scale(.08);opacity:1;border-width:7px} 50%{opacity:.55} 100%{transform:scale(2.6);opacity:0;border-width:1px} }
        @keyframes ep-core          { 0%{transform:scale(.03);opacity:1} 20%{transform:scale(1.3);opacity:1} 52%{transform:scale(1);opacity:.72} 100%{transform:scale(0);opacity:0} }
        @keyframes ep-particle      { 0%{transform:translate(0,0) scale(1.7);opacity:1} 100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0} }
        @keyframes afterimage-fade  { 0%{opacity:.26} 100%{opacity:0} }
        @keyframes ep-fehnon-contract  { 0%{transform:scale(1.5);opacity:0} 55%{opacity:1} 100%{transform:scale(.25);opacity:0} }
        @keyframes ep-fehnon-scanline  { 0%{opacity:0;transform:translateX(-50%) scaleX(0)} 45%{opacity:1} 100%{opacity:0;transform:translateX(-50%) scaleX(1)} }
        @keyframes ep-fehnon-glow      { 0%,100%{opacity:.48;transform:scale(1)}  50%{opacity:1;transform:scale(1.22)} }
        @keyframes ep-fehnon-slash     { 0%{opacity:0;transform-origin:left center;transform:scaleX(0)} 5%{opacity:1} 68%{opacity:1} 100%{opacity:0;transform:scaleX(1)} }
        @keyframes ep-fehnon-tip       { 0%{transform:translateX(calc(-${distance}px));opacity:0} 7%{opacity:1} 100%{transform:translateX(0);opacity:1} }
      `}</style>
      {attackerImage && phase!=="impact" && (
        <div style={{ position:"absolute",left:startX-40,top:startY-56,width:"80px",height:"112px",
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:0.2,filter:"blur(2px)",
          animation:"afterimage-fade 200ms ease-out forwards",pointerEvents:"none",zIndex:5 }} />
      )}
      <div style={cs} suppressHydrationWarning>{content}</div>
    </>
  )

  if(portalTarget) return createPortal(el$, portalTarget)
  if(typeof document!=="undefined") return createPortal(el$, document.body)
  return null
}
