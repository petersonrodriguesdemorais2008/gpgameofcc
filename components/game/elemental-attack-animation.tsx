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

// Timing constants (Total: 900ms)
const CHARGE_DURATION = 150
const TRAVEL_DURATION = 350
const IMPACT_DURATION = 400
const TOTAL_DURATION = CHARGE_DURATION + TRAVEL_DURATION + IMPACT_DURATION

// Utility for generating random particles
const generateParticles = (count: number, angleOffset: number = 0, spread: number = 120) => {
  return Array.from({ length: count }).map((_, i) => {
    const angle = angleOffset + (Math.random() * spread - spread / 2) * (Math.PI / 180)
    const velocity = 3 + Math.random() * 8
    const size = 0.3 + Math.random() * 0.7
    const life = 0.6 + Math.random() * 0.4
    return {
      id: i,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      size,
      life,
      delay: Math.random() * 0.15,
    }
  })
}

export function ElementalAttackAnimation({
  id,
  startX,
  startY,
  targetX,
  targetY,
  element,
  isDirect,
  attackerImage,
  portalTarget,
  onImpact,
  onComplete,
}: AttackAnimationProps) {
  const [phase, setPhase] = useState<AnimPhase>("charge")
  const [mounted, setMounted] = useState(false)

  const distance = Math.hypot(targetX - startX, targetY - startY)
  const angleRad = Math.atan2(targetY - startY, targetX - startX)
  const angleDeg = angleRad * (180 / Math.PI)
  
  const el = element?.toLowerCase().trim() || "neutral"

  const particles = useMemo(() => {
    let count = 25
    let spread = 120
    if (el === "haos" || el === "light" || el === "lightness") count = 40
    if (el === "ventus") count = 30
    if (el === "terra" || el === "subterra") count = 20
    if (el === "void") { count = 35; spread = 360 }
    return generateParticles(count, angleRad, spread)
  }, [el, angleRad])

  // Use a ref for onComplete to avoid restarting timers if the prop change
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    setMounted(true)

    const travelTimer = setTimeout(() => {
      setPhase("travel")
    }, CHARGE_DURATION)

    const impactTimer = setTimeout(() => {
      setPhase("impact")
      if (onImpact) {
        onImpact(id, targetX, targetY, el)
      }
    }, CHARGE_DURATION + TRAVEL_DURATION)

    const completeTimer = setTimeout(() => {
      onCompleteRef.current(id)
    }, TOTAL_DURATION)

    return () => {
      clearTimeout(travelTimer)
      clearTimeout(impactTimer)
      clearTimeout(completeTimer)
    }
  }, [id])

  if (!mounted) return null

  const getContainerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      left: startX,
      top: startY,
      transformOrigin: "0 50%",
      transform: `translate3d(0,0,0) rotate(${angleDeg}deg)`,
      width: distance,
      height: 60,
      marginTop: -30,
      pointerEvents: "none",
      zIndex: 10000,
    }

    if (phase === "impact") {
      base.left = targetX
      base.top = targetY
      base.width = 0
    }

    return base
  }

  const renderAfterimage = () => {
    if (!attackerImage || phase === "impact") return null
    return (
      <div 
        className="absolute w-20 h-28 pointer-events-none z-[5]"
        style={{
          left: startX - 40,
          top: startY - 56,
          backgroundImage: `url(${attackerImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: '8px',
          opacity: 0.3,
          filter: 'blur(2px)',
          animation: 'afterimage-fade 200ms ease-out forwards'
        }}
      />
    )
  }

  const renderShadow = () => {
    if (phase !== "travel") return null
    return (
      <div 
        className="absolute w-12 h-4 bg-black/40 rounded-[100%] blur-md"
        style={{ 
          left: 0, 
          top: 60, // Positioned below the main axis
          transform: 'translateX(20px)',
          animation: `shadow-travel ${TRAVEL_DURATION}ms cubic-bezier(0.2, 0, 0.1, 1) forwards`
        }} 
      />
    )
  }

  const renderCharge = () => {
    switch (el) {
      case "pyrus":
      case "fire":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center">
            {/* Spinning fire rings */}
            <div className="absolute inset-0 border-2 border-orange-500 rounded-full blur-[2px] animate-[ping_0.6s_ease-out_infinite]" />
            <div className="absolute inset-4 border-4 border-red-600 rounded-full blur-[1px] animate-[spin_0.4s_linear_infinite]" />
            <div className="absolute w-12 h-12 bg-orange-400 rounded-full blur-xl opacity-80 animate-pulse" />
          </div>
        )
      case "aquos":
      case "aquo":
      case "water":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-32 flex items-center justify-center">
            {/* Contained Geyser Effect */}
            <div className="absolute bottom-0 w-16 h-full bg-gradient-to-t from-cyan-600 via-blue-400 to-white/40 rounded-t-full blur-md animate-[geyser-rise_0.15s_ease-out_infinite]" />
            <div className="absolute w-20 h-20 border-2 border-cyan-200 rounded-full blur-[4px] animate-[spin_1s_linear_infinite] opacity-40" />
          </div>
        )
      case "terra":
      case "subterra":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center">
            {/* Cracks radiating from unit */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
              <div key={a} className="absolute w-12 h-[2px] bg-amber-900 blur-[1px]" style={{ transform: `rotate(${a}deg) translateX(12px)`, opacity: 0.8 }} />
            ))}
            <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(139,69,19,1)] rounded-full animate-pulse" />
          </div>
        )
      case "haos":
      case "light":
      case "lightness":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center">
             <div className="absolute inset-0 bg-white rounded-full blur-3xl brightness-200 animate-[haos-halo_0.15s_ease-in-out_infinite]" />
             <div className="absolute w-16 h-16 border-4 border-yellow-200 rounded-full blur-sm animate-ping" />
          </div>
        )
      case "darkus":
      case "darkness":
      case "dark":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center">
            {/* Darkness consuming from bottom-up */}
            <div className="absolute bottom-0 w-full h-0 bg-black rounded-b-full blur-xl animate-[dark-consume_0.15s_ease-in_forwards]" />
            <div className="absolute inset-0 border-2 border-purple-900 rounded-full opacity-40 blur-md" />
          </div>
        )
      case "ventus":
      case "wind":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center overflow-hidden">
             <div className="w-full h-full border-t-4 border-green-300 rounded-full blur-[2px] animate-[spin_0.1s_linear_infinite]" />
             <div className="absolute w-[70%] h-[70%] border-b-4 border-emerald-500 rounded-full blur-[1px] animate-[spin_0.15s_linear_infinite_reverse]" />
          </div>
        )
      case "electric":
      case "eletric":
      case "lightning":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center">
            {/* Static all around */}
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute w-full h-[1px] bg-yellow-200/60 blur-[1px]" style={{ top: `${Math.random()*100}%`, transform: `rotate(${Math.random()*360}deg)` }} />
            ))}
            <div className="w-12 h-12 bg-yellow-400/20 rounded-full blur-2xl animate-pulse" />
          </div>
        )
      case "void":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center">
            {/* Gravitational distortion - silver/white only */}
            <div className="absolute inset-0 bg-slate-300/20 rounded-full blur-3xl animate-[pulse_0.1s_infinite]" />
            <div className="absolute inset-4 border-[1px] border-white/60 rounded-full blur-sm animate-ping mix-blend-difference" />
            <div className="absolute w-4 h-4 bg-white rounded-full blur-[1px] animate-pulse shadow-[0_0_12px_6px_rgba(200,210,255,0.8)]" />
          </div>
        )
      default:
        return <div className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-16 bg-white/40 rounded-full blur-xl scale-50 animate-pulse" />
    }
  }

  const renderProjectile = () => {
    switch (el) {
      case "pyrus":
      case "fire":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center anim-travel-move-epic">
            {/* Spiral fire tornado */}
            <div className="w-48 h-16 bg-gradient-to-r from-transparent via-red-600 to-orange-400 rounded-full blur-[8px] opacity-80" />
            <div className="absolute left-10 w-24 h-24 border-x-4 border-orange-300 rounded-full blur-[1px] animate-[spin_0.2s_linear_infinite]" />
            <div className="w-16 h-16 bg-white rounded-full shadow-[0_0_50px_25px_rgba(255,100,0,1)] mix-blend-screen" />
            {/* Flying embers */}
            <div className="absolute -left-10 w-32 h-20 pointer-events-none">
               <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-200 rounded-full animate-ping" style={{ animationDelay: '0.1s' }} />
               <div className="absolute bottom-0 left-10 w-2 h-2 bg-orange-500 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )
      case "aquos":
      case "aquo":
      case "water":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center anim-travel-move-epic">
            {/* Translucent water spear */}
            <div className="w-40 h-6 bg-cyan-400/40 rounded-l-full blur-sm opacity-80" />
            <div className="w-28 h-4 bg-white/60 rounded-full shadow-[0_0_30px_15px_rgba(0,191,255,0.6)]" />
            <div className="w-12 h-10 bg-cyan-200/80 rounded-[100%_0_0_100%] blur-[1px] border-l-2 border-white" />
            {/* Misty spray */}
            <div className="absolute -left-10 w-full h-12 bg-cyan-100/20 blur-xl" />
          </div>
        )
      case "terra":
      case "subterra":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center anim-travel-move-epic">
            {/* Massive Rock with dust */}
            <div className="w-24 h-24 bg-amber-950 border-4 border-amber-700 rounded-xl shadow-2xl rotate-45 animate-[spin_0.6s_linear_infinite]">
               <div className="absolute inset-2 border-2 border-amber-300 opacity-30" />
            </div>
            <div className="absolute -left-20 w-32 h-16 bg-amber-900/40 blur-xl rounded-full" />
          </div>
        )
      case "haos":
      case "light":
      case "lightness":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center" style={{ width: distance }}>
            {/* Pure light beam with side rays */}
            <div className="h-10 w-full bg-gradient-to-r from-transparent via-yellow-100 to-white shadow-[0_0_40px_20px_rgba(255,255,200,0.9)] mix-blend-screen anim-travel-stretch-epic" />
            <div className="absolute top-1/2 -translate-y-[15px] h-1 w-full bg-white/60 anim-travel-stretch-epic" style={{ animationDelay: '20ms' }} />
            <div className="absolute top-1/2 translate-y-[12px] h-1 w-full bg-white/60 anim-travel-stretch-epic" style={{ animationDelay: '40ms' }} />
            {/* Lens flare */}
            <div className="absolute right-0 w-24 h-24 bg-white rounded-full blur-2xl animate-pulse" />
          </div>
        )
      case "darkus":
      case "darkness":
      case "dark":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center anim-travel-move-epic">
            {/* Shadow Blade */}
            <div className="w-56 h-4 bg-purple-900 rounded-full blur-[2px] rotate-2" />
            <div className="absolute left-0 w-48 h-12 bg-black rounded-full shadow-[0_0_50px_rgba(148,0,211,0.8)] mix-blend-multiply" />
            <div className="w-20 h-2 bg-indigo-500 rounded-full blur-[1px] translate-x-10" />
            {/* Lingering purple scar */}
            <div className="absolute -left-[300px] w-[300px] h-1 bg-purple-600/40 blur-[2px]" />
          </div>
        )
      case "ventus":
      case "wind":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center anim-travel-move-epic">
            {/* Compressed air distortion */}
            <div className="w-32 h-20 border-y-2 border-green-200 rounded-[50%] blur-sm opacity-60 scale-150" />
            <div className="absolute left-10 w-20 h-20 border-4 border-white/30 rounded-full animate-[ping_0.3s_linear_infinite]" />
            <div className="w-24 h-24 bg-emerald-200/20 rounded-full blur-3xl animate-pulse" />
          </div>
        )
      case "electric":
      case "eletric":
      case "lightning":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center anim-travel-move-epic w-full">
            <div className="w-[120%] h-32 -translate-y-1/2">
               <svg width="100%" height="100%" preserveAspectRatio="none" className="overflow-visible filter drop-shadow-[0_0_20px_rgba(255,255,255,1)]">
                 {/* Main thick lightning */}
                 <path d="M0,60 L50,20 L100,100 L150,40 L200,60" fill="none" stroke="#fff" strokeWidth="8" vectorEffect="non-scaling-stroke" className="anim-lightning-strike-epic" />
                 {/* Zigg-zagging branches */}
                 <path d="M50,20 L40,-10" fill="none" stroke="#fef08a" strokeWidth="2" vectorEffect="non-scaling-stroke" className="anim-lightning-strike-epic" style={{ animationDelay: '50ms' }} />
                 <path d="M100,100 L120,130" fill="none" stroke="#fef08a" strokeWidth="2" vectorEffect="non-scaling-stroke" className="anim-lightning-strike-epic" style={{ animationDelay: '100ms' }} />
                 <path d="M150,40 L170,10" fill="none" stroke="#fef08a" strokeWidth="2" vectorEffect="non-scaling-stroke" className="anim-lightning-strike-epic" style={{ animationDelay: '150ms' }} />
               </svg>
            </div>
          </div>
        )
      case "void":
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center" style={{ width: distance }}>
            {/* Torn space - silver/white */}
            <div className="h-16 w-full bg-slate-300/30 blur-[4px] anim-travel-stretch-void-epic" />
            <div className="absolute inset-0 h-4 bg-white/90 blur-sm mix-blend-difference anim-travel-stretch-void-epic" />
            <div className="absolute right-0 w-20 h-20 border-2 border-slate-200 rounded-full animate-ping shadow-[0_0_16px_6px_rgba(200,210,255,0.6)]" />
          </div>
        )
      default:
        return (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center anim-travel-move-epic">
            <div className="w-20 h-10 bg-gradient-to-r from-transparent via-gray-300 to-white rounded-full blur-md" />
            <div className="w-10 h-10 bg-white rounded-full shadow-[0_0_20px_10px_rgba(255,255,255,0.7)]" />
          </div>
        )
    }
  }

  const renderImpact = () => {
    let colors = ["bg-gray-300", "bg-white", "bg-gray-400"]
    let coreEffect = "bg-white"
    let coreGlow = "rgba(255,255,255,0.8)"
    let shockwaveBorder = "border-white"

    switch (el) {
      case "pyrus":
      case "fire":
        colors = ["bg-red-600", "bg-orange-500", "bg-yellow-400", "#450a0a", "#1c1917"]
        coreEffect = "bg-orange-500"
        coreGlow = "rgba(255,69,0,1)"
        shockwaveBorder = "border-red-600"
        break
      case "aquos":
      case "aquo":
      case "water":
        colors = ["bg-blue-500", "bg-cyan-400", "bg-white", "bg-sky-200"]
        coreEffect = "bg-cyan-300"
        coreGlow = "rgba(0,191,255,1)"
        shockwaveBorder = "border-cyan-400"
        break
      case "terra":
      case "subterra":
        colors = ["bg-amber-950", "bg-amber-800", "bg-stone-600", "bg-yellow-900"]
        coreEffect = "bg-amber-900"
        coreGlow = "rgba(139,69,19,1)"
        shockwaveBorder = "border-amber-950"
        break
      case "haos":
      case "light":
      case "lightness":
        colors = ["bg-yellow-100", "bg-white", "bg-yellow-400", "bg-amber-100"]
        coreEffect = "bg-white"
        coreGlow = "rgba(255,255,150,1)"
        shockwaveBorder = "border-yellow-200"
        break
      case "darkus":
      case "darkness":
      case "dark":
        colors = ["bg-purple-900", "bg-black", "bg-indigo-950", "bg-purple-500"]
        coreEffect = "bg-black"
        coreGlow = "rgba(148,0,211,1)"
        shockwaveBorder = "border-purple-900"
        break
      case "ventus":
      case "wind":
        colors = ["bg-green-100", "bg-emerald-400", "bg-white", "bg-teal-100"]
        coreEffect = "bg-green-100"
        coreGlow = "rgba(50,205,50,0.8)"
        shockwaveBorder = "border-green-300"
        break
      case "electric":
      case "eletric":
      case "lightning":
        colors = ["bg-yellow-100", "bg-white", "bg-sky-100", "bg-yellow-400"]
        coreEffect = "bg-white"
        coreGlow = "rgba(255,255,0,1)"
        shockwaveBorder = "border-yellow-400"
        break
      case "void":
        colors = ["bg-white", "bg-slate-300", "bg-slate-100", "bg-gray-200"]
        coreEffect = "bg-white"
        coreGlow = "rgba(220,225,255,1)"
        shockwaveBorder = "border-slate-300"
        break
    }

    // Impact direction: particles blow back slightly towards the attacker (as requested)
    const impactBaseAngle = angleRad + Math.PI

    return (
      <div className="absolute left-0 top-0 w-0 h-0" style={{ transform: `rotate(${-angleDeg}deg)` }}>
        {/* Shockwave based on element */}
        <div className={`absolute -left-24 -top-24 w-48 h-48 border-2 ${shockwaveBorder} rounded-full ${el === 'ventus' ? 'anim-impact-shockwave-flat' : 'anim-impact-ring-epic'}`} />
        
        {/* Core Explosion */}
        <div 
          className={`absolute -left-20 -top-20 w-40 h-40 ${coreEffect} rounded-full blur-xl mix-blend-screen ${el === 'darkus' || el === 'darkness' ? 'anim-impact-pulse-3' : 'anim-impact-core-epic'}`}
          style={{ boxShadow: `0 0 100px 50px ${coreGlow}` }}
        />

        {/* Specialized vertical elements */}
        {(el === 'pyrus' || el === 'fire') && <div className="absolute left-[-10px] bottom-0 w-5 h-64 bg-gradient-to-t from-orange-500 to-transparent blur-md animate-[magma-rise_0.4s_ease-out_forwards]" />}
        {(el === 'terra' || el === 'subterra') && <div className="absolute left-[-20px] bottom-0 w-10 h-48 bg-amber-900/60 blur-lg animate-[magma-rise_0.3s_ease-out_forwards]" />}

        {/* Cone Particles (120°) */}
        {particles.map(p => {
          const colorClass = colors[p.id % colors.length]
          const isTerra = el === "terra" || el === "subterra"
          const isFire = el === "pyrus" || el === "fire"
          
          // Redirect particles to a 120 degree cone pointing back to attacker
          const coneAngle = impactBaseAngle + (Math.random() * 120 - 60) * (Math.PI / 180)
          const px = Math.cos(coneAngle) * (isFire ? 150 : 100) * p.life
          const py = Math.sin(coneAngle) * (isFire ? 150 : 100) * p.life

          return (
            <div
              key={p.id}
              className={`absolute ${isTerra ? 'rounded-sm' : 'rounded-full'} ${colorClass.startsWith('bg-') ? colorClass : ''}`}
              style={{
                backgroundColor: colorClass.startsWith('bg-') ? undefined : colorClass,
                width: `${p.size * (isTerra ? 20 : 15)}px`,
                height: `${p.size * (isTerra ? 16 : 15)}px`,
                animation: `particle-fly-cinematic ${IMPACT_DURATION}ms cubic-bezier(0.1, 0.5, 0.2, 1) forwards`,
                animationDelay: `${p.delay}s`,
                '--px': `${px}px`,
                '--py': `${py}px`,
                opacity: 0,
              } as React.CSSProperties}
            />
          )
        })}

        {/* Impact Flash (16ms Technique) */}
        <div className="absolute -left-[100vw] -top-[100vh] w-[200vw] h-[200vh] bg-white animate-[flash-16ms_0.1s_linear_forwards] z-[100] pointer-events-none" />
      </div>
    )
  }

  // Choose content based on phase
  let content = null
  if (phase === "charge") content = renderCharge()
  else if (phase === "travel") content = renderProjectile()
  else if (phase === "impact") content = renderImpact()

  const elementToRender = (
    <>
      <style>{`
        @keyframes geyser-rise {
          0% { height: 0%; opacity: 1; }
          100% { height: 100%; opacity: 0; }
        }
        @keyframes haos-halo {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes dark-consume {
          0% { height: 0%; transform: scaleX(0.5); }
          100% { height: 100%; transform: scaleX(1.2); }
        }
        @keyframes magma-rise {
          0% { height: 0; opacity: 1; }
          100% { height: 100px; opacity: 0; }
        }
        @keyframes flash-16ms {
          0% { opacity: 0.8; }
          16% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        @keyframes particle-fly-cinematic {
          0% { transform: translate(0, 0) scale(1.5); opacity: 1; }
          100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
        }
        @keyframes anim-travel-move-epic {
          0% { left: 0px; opacity: 0.5; transform: ${isDirect ? 'translateY(0)' : 'scale(0.8)'} translateZ(0); }
          15% { opacity: 1; transform: ${isDirect ? 'translateY(-20px)' : 'scale(1.2)'} translateZ(0); }
          100% { left: ${distance}px; opacity: 1; transform: ${isDirect ? 'translateY(0)' : 'scale(1)'} translateZ(0); }
        }
        .anim-travel-move-epic {
          animation: anim-travel-move-epic ${TRAVEL_DURATION}ms cubic-bezier(0.2, 0, 0.1, 1) forwards;
        }
        @keyframes anim-impact-shockwave-flat {
          0% { transform: scaleX(0.2) scaleY(0.1); opacity: 1; border-width: 8px; }
          100% { transform: scaleX(3) scaleY(0.2); opacity: 0; border-width: 0px; }
        }
        .anim-impact-shockwave-flat {
          animation: anim-impact-shockwave-flat ${IMPACT_DURATION}ms ease-out forwards;
        }
        @keyframes anim-impact-pulse-3 {
          0% { transform: scale(0.1); opacity: 1; }
          30% { transform: scale(1.5); opacity: 0.6; }
          60% { transform: scale(2); opacity: 0.3; }
          100% { transform: scale(0); opacity: 0; }
        }
        .anim-impact-pulse-3 {
          animation: anim-impact-pulse-3 ${IMPACT_DURATION}ms ease-out forwards;
        }
        @keyframes flare-charge-epic {
          0% { transform: scale(0); opacity: 0; filter: blur(20px); }
          50% { opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; filter: blur(5px); }
        }
        @keyframes suck-in-epic {
          0% { transform: scale(3); opacity: 0; }
          70% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(0); opacity: 1; }
        }
        @keyframes anim-travel-stretch-epic {
          0% { width: 0%; opacity: 0; left: 0; translateZ(0); }
          20% { opacity: 1; left: 0; width: 60%; translateZ(0); }
          100% { width: 10%; left: ${distance}px; opacity: 0; translateZ(0); }
        }
        .anim-travel-stretch-epic {
          animation: anim-travel-stretch-epic ${TRAVEL_DURATION}ms ease-out forwards;
        }
        .anim-travel-stretch-epic.delayed { animation-delay: 50ms; }
        @keyframes anim-travel-stretch-void-epic {
          0% { width: 0%; opacity: 0; left: 0; filter: contrast(2); }
          50% { width: 100%; opacity: 1; left: 0; }
          100% { width: 5%; left: ${distance}px; opacity: 0; filter: contrast(1); }
        }
        .anim-travel-stretch-void-epic {
          animation: anim-travel-stretch-void-epic ${TRAVEL_DURATION}ms cubic-bezier(0.5, 0, 0.5, 1) forwards;
        }
        @keyframes stroke-jagged-epic {
          0% { stroke-dasharray: 0, 1000; opacity: 1; }
          30% { stroke-dasharray: 1000, 0; }
          100% { stroke-dasharray: 1000, 0; opacity: 0; }
        }
        .anim-lightning-strike-epic {
          animation: stroke-jagged-epic ${TRAVEL_DURATION}ms linear forwards;
        }
        @keyframes anim-impact-core-epic {
          0% { transform: scale(0.1); opacity: 1; }
          30% { transform: scale(1.8); opacity: 1; }
          100% { transform: scale(0); opacity: 0; }
        }
        .anim-impact-core-epic {
          animation: anim-impact-core-epic ${IMPACT_DURATION}ms cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }
        @keyframes anim-impact-ring-epic {
          0% { transform: scale(0.2); opacity: 1; border-width: 10px; }
          100% { transform: scale(2.5); opacity: 0; border-width: 0px; }
        }
        .anim-impact-ring-epic {
          animation: anim-impact-ring-epic ${IMPACT_DURATION}ms ease-out forwards;
        }
        @keyframes shadow-travel {
          0% { left: 0px; opacity: 0.2; transform: scale(0.5) translateX(20px); }
          100% { left: ${distance}px; opacity: 0.4; transform: scale(1) translateX(-20px); }
        }
        @keyframes afterimage-fade {
          0% { opacity: 0.3; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.1); }
        }
        .anim-spin-fast { animation: spin 0.2s linear infinite; }
        .anim-spin-slow { animation: spin 1s linear infinite; }
        @keyframes spin { from { rotate: 0deg; } to { rotate: 360deg; } }
        @keyframes anim-bubble {
          0% { transform: translateY(0) scale(1.2); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-30px) scale(0.5); opacity: 0; }
        }
        .anim-bubble { animation: anim-bubble 400ms infinite; }
        .anim-bubble-delayed { animation: anim-bubble 400ms infinite 200ms; }
      `}</style>
      {renderAfterimage()}
      <div style={getContainerStyle()} suppressHydrationWarning>
        {renderShadow()}
        {content}
      </div>
    </>
  )

  if (portalTarget) {
    return createPortal(elementToRender, portalTarget)
  }
  
  if (typeof document !== 'undefined') {
    return createPortal(elementToRender, document.body)
  }

  return null
}
