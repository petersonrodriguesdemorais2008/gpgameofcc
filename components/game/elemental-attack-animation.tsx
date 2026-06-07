"use client"
/**
 * elemental-attack-animation.tsx
 *
 * High-performance elemental attack animations.
 * All motion is driven by CSS @keyframes → only `transform` and `opacity`
 * are animated → fully GPU-accelerated, zero layout thrash, no FPS drops.
 *
 * Architecture:
 *  1. Charge phase  (0 – 180 ms): attacker card glows + projectile forms
 *  2. Travel phase  (180 – 520 ms): projectile flies on a slight arc
 *  3. Impact moment (520 ms): onImpact callback → existing canvas explosion fires
 *  4. Linger        (520 – 700 ms): shockwave ring + screen glow fades
 *  5. Cleanup       (700 ms): onComplete removes this from activeProjectiles
 */

import { useEffect, useRef, useState, memo } from "react"
import { createPortal } from "react-dom"

// ─── Public interface ─────────────────────────────────────────────────────────
export interface AttackAnimationProps {
  id: string
  startX: number
  startY: number
  targetX: number
  targetY: number
  element: string
  attackerImage: string
  attackerName: string
  isDirect: boolean
  portalTarget: HTMLElement | null
  onImpact: (x: number, y: number, element: string) => void
  onComplete: (id: string) => void
}

// ─── Timing constants (ms) — keep in sync with PROJECTILE_DURATION ─────────
const T_CHARGE  = 160   // charge / glow build-up
const T_TRAVEL  = 340   // projectile travel
const T_LINGER  = 180   // impact shockwave lingers
const T_TOTAL   = T_CHARGE + T_TRAVEL + T_LINGER // 680 ms

// ─── Element palette ──────────────────────────────────────────────────────────
interface ElementStyle {
  core: string          // primary colour
  glow: string          // rgba box-shadow colour
  trail: string[]       // gradient stop colours for the trail
  shape: "orb"|"blade"|"bolt"|"pulse"|"beam"|"rift"
  shockwave: string     // ring colour at impact
  chargeColor: string   // card outline during charge
}

const ELEMENT_STYLES: Record<string, ElementStyle> = {
  aquos: {
    core: "#00d4ff",
    glow: "rgba(0,212,255,0.9)",
    trail: ["#00d4ff","#0080ff","rgba(0,128,255,0)"],
    shape: "orb",
    shockwave: "#00d4ff",
    chargeColor: "#00bfff",
  },
  fire: {
    core: "#ff6000",
    glow: "rgba(255,100,0,1)",
    trail: ["#ffff00","#ff6000","rgba(180,30,0,0)"],
    shape: "blade",
    shockwave: "#ff8c00",
    chargeColor: "#ff4500",
  },
  ventus: {
    core: "#7fff00",
    glow: "rgba(100,255,50,0.85)",
    trail: ["#ccff00","#7fff00","rgba(50,200,0,0)"],
    shape: "bolt",
    shockwave: "#adff2f",
    chargeColor: "#32cd32",
  },
  darkness: {
    core: "#bf00ff",
    glow: "rgba(140,0,255,0.95)",
    trail: ["#ff00ff","#7700ff","rgba(60,0,120,0)"],
    shape: "pulse",
    shockwave: "#9900ff",
    chargeColor: "#8b00ff",
  },
  lightness: {
    core: "#fff700",
    glow: "rgba(255,247,0,1)",
    trail: ["#ffffff","#fff700","rgba(255,200,0,0)"],
    shape: "beam",
    shockwave: "#ffd700",
    chargeColor: "#ffd700",
  },
  void: {
    core: "#c0c0c0",
    glow: "rgba(220,220,255,0.9)",
    trail: ["#ffffff","#c0c0c0","rgba(100,100,140,0)"],
    shape: "rift",
    shockwave: "#a0a0c0",
    chargeColor: "#d0d0e0",
  },
  neutral: {
    core: "#e0e0ff",
    glow: "rgba(200,200,255,0.7)",
    trail: ["#ffffff","#c8c8ff","rgba(150,150,200,0)"],
    shape: "orb",
    shockwave: "#c8c8ff",
    chargeColor: "#c8c8ff",
  },
}

function resolveEl(raw: string): ElementStyle {
  const k = raw?.toLowerCase().trim() ?? ""
  return (
    ELEMENT_STYLES[k] ??
    ELEMENT_STYLES[k === "aquo" ? "aquos" : k === "pyrus" ? "fire" : k === "darkus" || k === "dark" ? "darkness" : k === "haos" ? "lightness" : ""] ??
    ELEMENT_STYLES.neutral
  )
}

// ─── Inline <style> block (injected once) ────────────────────────────────────
// Using a module-level flag so we only add it once per session.
let _stylesInjected = false
function ensureStyles() {
  if (_stylesInjected || typeof document === "undefined") return
  _stylesInjected = true
  const el = document.createElement("style")
  el.textContent = `
    /* ── Projectile travel (arc via rotate trick) ───────────────────── */
    @keyframes ea-travel {
      0%   { transform: translate(0,0) scale(0.5); opacity:0.3; }
      10%  { opacity:1; transform: translate(calc(var(--dx)*0.1), calc(var(--dy)*0.1 - 12px)) scale(1.15); }
      55%  { transform: translate(calc(var(--dx)*0.55), calc(var(--dy)*0.55 - 20px)) scale(1); }
      90%  { transform: translate(calc(var(--dx)*0.9), calc(var(--dy)*0.9 - 6px)) scale(0.9); opacity:1; }
      100% { transform: translate(var(--dx), var(--dy)) scale(0.6); opacity:0; }
    }
    /* ── Charge glow on attacker card ──────────────────────────────── */
    @keyframes ea-charge {
      0%,100% { box-shadow: 0 0 0px transparent; }
      40%     { box-shadow: 0 0 28px 10px var(--charge-color), 0 0 60px 20px var(--charge-color); }
      70%     { box-shadow: 0 0 20px 8px var(--charge-color); }
    }
    /* ── Impact shockwave ring ─────────────────────────────────────── */
    @keyframes ea-shockwave {
      0%   { transform: translate(-50%,-50%) scale(0.2); opacity:1; }
      100% { transform: translate(-50%,-50%) scale(4.5); opacity:0; }
    }
    /* ── Secondary ring (offset timing) ─────────────────────────────── */
    @keyframes ea-shockwave2 {
      0%   { transform: translate(-50%,-50%) scale(0.1); opacity:0.7; }
      100% { transform: translate(-50%,-50%) scale(3); opacity:0; }
    }
    /* ── Screen flash at impact ─────────────────────────────────────── */
    @keyframes ea-flash {
      0%   { opacity:0.55; }
      100% { opacity:0; }
    }
    /* ── Trail streak (each with slight delay offset) ─────────────── */
    @keyframes ea-trail {
      0%   { opacity:0.9; transform: scale(1); }
      100% { opacity:0; transform: scale(0); }
    }
    /* ── Projectile spin (for orb / rift shapes) ─────────────────── */
    @keyframes ea-spin {
      to { transform: rotate(360deg); }
    }
    /* ── Pulse ring (darkness) ─────────────────────────────────────── */
    @keyframes ea-pulse-ring {
      0%   { transform: translate(-50%,-50%) scale(0.5); opacity:0.8; }
      50%  { opacity:0.5; }
      100% { transform: translate(-50%,-50%) scale(2); opacity:0; }
    }
    /* ── Charge sparkle particles ───────────────────────────────────── */
    @keyframes ea-sparkle {
      0%   { transform: translate(0,0) scale(1); opacity:1; }
      100% { transform: translate(var(--sx),var(--sy)) scale(0); opacity:0; }
    }
    /* ── Direct-attack LP hit overlay ──────────────────────────────── */
    @keyframes ea-lp-hit {
      0%   { opacity:0.65; }
      100% { opacity:0; }
    }
  `
  document.head.appendChild(el)
}

// ─── Projectile shapes ────────────────────────────────────────────────────────
function ProjectileCore({ style, angle }: { style: ElementStyle; angle: number }) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    willChange: "transform",
    pointerEvents: "none",
  }

  if (style.shape === "orb") {
    return (
      <div style={{
        ...baseStyle,
        width: 28, height: 28,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, #fff 0%, ${style.core} 45%, ${style.glow.replace(/,[^,]+\)$/,",0.4)")} 100%)`,
        boxShadow: `0 0 14px 6px ${style.glow}, 0 0 30px 10px ${style.glow.replace(/,[^,]+\)$/,",0.4)")}`,
        animation: "ea-spin 0.4s linear infinite",
      }} />
    )
  }
  if (style.shape === "blade") {
    return (
      <div style={{
        ...baseStyle,
        width: 52, height: 16,
        borderRadius: "0 50% 50% 0",
        background: `linear-gradient(90deg, #fff 0%, ${style.core} 40%, transparent 100%)`,
        boxShadow: `0 0 18px 6px ${style.glow}`,
        transform: `translate(-50%,-50%) rotate(${angle}deg)`,
      }}>
        {/* Core white tip */}
        <div style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", width:8, height:8, borderRadius:"50%", background:"#fff", boxShadow:`0 0 8px 4px ${style.core}` }} />
      </div>
    )
  }
  if (style.shape === "bolt") {
    return (
      <div style={{
        ...baseStyle,
        width: 44, height: 10,
        clipPath: "polygon(0 50%, 20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%)",
        background: `linear-gradient(90deg, ${style.core}, #fff, ${style.core})`,
        boxShadow: `0 0 16px 5px ${style.glow}`,
        transform: `translate(-50%,-50%) rotate(${angle}deg)`,
      }} />
    )
  }
  if (style.shape === "pulse") {
    return (
      <div style={{ position:"absolute", top:"50%", left:"50%", width:0, height:0 }}>
        {/* Outer pulsing ring */}
        <div style={{
          position:"absolute",
          width: 36, height: 36, borderRadius:"50%",
          border: `3px solid ${style.core}`,
          boxShadow: `0 0 16px 4px ${style.glow}, inset 0 0 10px 2px ${style.glow}`,
          transform: "translate(-50%,-50%)",
          animation: "ea-pulse-ring 0.35s ease-out infinite",
        }} />
        {/* Core orb */}
        <div style={{
          position:"absolute",
          width: 18, height: 18, borderRadius:"50%",
          background: `radial-gradient(circle, #fff 0%, ${style.core} 60%, transparent 100%)`,
          boxShadow: `0 0 20px 8px ${style.glow}`,
          transform: "translate(-50%,-50%)",
        }} />
      </div>
    )
  }
  if (style.shape === "beam") {
    return (
      <div style={{
        ...baseStyle,
        width: 60, height: 12,
        borderRadius: 6,
        background: `linear-gradient(90deg, transparent, ${style.core} 30%, #fff 50%, ${style.core} 70%, transparent)`,
        boxShadow: `0 0 20px 8px ${style.glow}, 0 0 40px 15px rgba(255,247,0,0.4)`,
        transform: `translate(-50%,-50%) rotate(${angle}deg)`,
      }}>
        <div style={{ position:"absolute", inset:0, borderRadius:6, background:"rgba(255,255,255,0.6)", filter:"blur(2px)" }} />
      </div>
    )
  }
  // rift (void)
  return (
    <div style={{
      ...baseStyle,
      width: 30, height: 30,
      borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
      background: `radial-gradient(circle, #fff 0%, ${style.core} 50%, ${style.glow.replace(/,[^,]+\)$/,",0.2)")} 100%)`,
      boxShadow: `0 0 18px 8px ${style.glow}`,
      animation: "ea-spin 0.5s linear infinite",
    }} />
  )
}

// ─── Trail particles (pure CSS, no JS loop) ───────────────────────────────────
function TrailParticles({ style, count = 8, travelMs }: { style: ElementStyle; count: number; travelMs: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const frac = i / count
        const delay = `${frac * travelMs * 0.6}ms`
        const dur   = `${80 + (1 - frac) * 120}ms`
        const size  = 4 + (1 - frac) * 10
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: size, height: size,
              borderRadius: "50%",
              transform: "translate(-50%,-50%)",
              background: style.trail[i % style.trail.length] ?? style.core,
              boxShadow: `0 0 ${size}px ${size/2}px ${style.glow.replace(/,[^,]+\)$/,",0.6)")}`,
              opacity: 0,
              animationName: "ea-trail",
              animationDuration: dur,
              animationDelay: delay,
              animationTimingFunction: "ease-out",
              animationFillMode: "forwards",
              willChange: "transform,opacity",
              pointerEvents: "none",
            }}
          />
        )
      })}
    </>
  )
}

// ─── Impact shockwave ────────────────────────────────────────────────────────
function ImpactShockwave({ x, y, style, isDirect }: { x: number; y: number; style: ElementStyle; isDirect: boolean }) {
  const base: React.CSSProperties = {
    position: "fixed",
    left: x, top: y,
    width: isDirect ? 120 : 80,
    height: isDirect ? 120 : 80,
    borderRadius: "50%",
    border: `3px solid ${style.shockwave}`,
    boxShadow: `0 0 20px 6px ${style.glow}, inset 0 0 20px 6px ${style.glow.replace(/,[^,]+\)$/,",0.3)")}`,
    pointerEvents: "none",
    willChange: "transform,opacity",
  }
  return (
    <>
      {/* Primary ring */}
      <div style={{ ...base, animationName:"ea-shockwave", animationDuration:`${T_LINGER * 0.9}ms`, animationTimingFunction:"ease-out", animationFillMode:"forwards" }} />
      {/* Secondary ring (slightly delayed) */}
      <div style={{ ...base, border:`2px solid ${style.shockwave}`, animationName:"ea-shockwave2", animationDuration:`${T_LINGER * 1.1}ms`, animationTimingFunction:"ease-out", animationDelay:"30ms", animationFillMode:"forwards" }} />
      {/* Flash fill */}
      <div style={{
        position: "fixed", left: x, top: y,
        width: 40, height: 40,
        borderRadius: "50%",
        transform: "translate(-50%,-50%)",
        background: style.core,
        boxShadow: `0 0 40px 20px ${style.glow}`,
        opacity: 0,
        animationName: "ea-trail",
        animationDuration: `${T_LINGER * 0.5}ms`,
        animationTimingFunction: "ease-out",
        animationFillMode: "forwards",
        pointerEvents: "none",
        willChange: "transform,opacity",
      }} />
      {/* Screen-edge flash overlay */}
      <div style={{
        position: "fixed", inset: 0,
        background: isDirect
          ? `radial-gradient(circle at center, ${style.core}44 0%, transparent 70%)`
          : `radial-gradient(circle at ${x}px ${y}px, ${style.core}33 0%, transparent 50%)`,
        pointerEvents: "none",
        animationName: "ea-flash",
        animationDuration: `${T_LINGER}ms`,
        animationTimingFunction: "ease-out",
        animationFillMode: "forwards",
        zIndex: 9998,
      }} />
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export const ElementalAttackAnimation = memo(function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY,
  element, isDirect,
  portalTarget, onImpact, onComplete,
}: AttackAnimationProps) {
  ensureStyles()

  const style    = resolveEl(element)
  const dx       = targetX - startX
  const dy       = targetY - startY
  const angle    = Math.atan2(dy, dx) * (180 / Math.PI)
  const dist     = Math.sqrt(dx * dx + dy * dy)

  const [phase, setPhase] = useState<"charge"|"travel"|"impact"|"done">("charge")
  const impactFired = useRef(false)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("travel"),  T_CHARGE)
    const t2 = setTimeout(() => {
      setPhase("impact")
      if (!impactFired.current) {
        impactFired.current = true
        onImpact(targetX, targetY, element)
      }
    }, T_CHARGE + T_TRAVEL)
    const t3 = setTimeout(() => {
      setPhase("done")
      onComplete(id)
    }, T_TOTAL)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, []) // eslint-disable-line

  if (phase === "done") return null

  const content = (
    <>
      {/* ── Charge sparkles at attacker position ─────────────────────── */}
      {phase === "charge" && (
        <div style={{ position:"fixed", left: startX, top: startY, zIndex: 9999, pointerEvents:"none" }}>
          {Array.from({ length: 8 }).map((_, i) => {
            const a  = (i / 8) * Math.PI * 2
            const r  = 30 + Math.random() * 20
            return (
              <div key={i} style={{
                position: "absolute",
                width: 5, height: 5,
                borderRadius: "50%",
                background: style.core,
                boxShadow: `0 0 8px 3px ${style.glow}`,
                transform: "translate(-50%,-50%)",
                ["--sx" as any]: `${Math.cos(a)*r}px`,
                ["--sy" as any]: `${Math.sin(a)*r}px`,
                animationName: "ea-sparkle",
                animationDuration: `${T_CHARGE}ms`,
                animationDelay: `${i * 12}ms`,
                animationTimingFunction: "ease-out",
                animationFillMode: "forwards",
                willChange: "transform,opacity",
              }} />
            )
          })}
          {/* Charge ring */}
          <div style={{
            position:"absolute",
            width: 50, height: 50,
            borderRadius:"50%",
            border:`2px solid ${style.shockwave}`,
            transform:"translate(-50%,-50%)",
            animationName:"ea-shockwave",
            animationDuration:`${T_CHARGE * 0.8}ms`,
            animationTimingFunction:"ease-out",
            animationFillMode:"forwards",
            boxShadow:`0 0 12px 4px ${style.glow}`,
          }} />
        </div>
      )}

      {/* ── Travelling projectile ─────────────────────────────────────── */}
      {phase === "travel" && (
        <div style={{
          position: "fixed",
          left: startX,
          top:  startY,
          zIndex: 9999,
          pointerEvents: "none",
          willChange: "transform,opacity",
          ["--dx" as any]: `${dx}px`,
          ["--dy" as any]: `${dy}px`,
          animationName: "ea-travel",
          animationDuration: `${T_TRAVEL}ms`,
          animationTimingFunction: "cubic-bezier(0.25,0.46,0.45,0.94)",
          animationFillMode: "forwards",
        }}>
          {/* Trail particles behind */}
          <TrailParticles style={style} count={8} travelMs={T_TRAVEL} />
          {/* Core projectile */}
          <ProjectileCore style={style} angle={angle} />
        </div>
      )}

      {/* ── Impact effects ───────────────────────────────────────────── */}
      {phase === "impact" && (
        <ImpactShockwave x={targetX} y={targetY} style={style} isDirect={isDirect} />
      )}

      {/* ── Direct-attack full-screen LP hit overlay ─────────────────── */}
      {isDirect && phase === "impact" && (
        <div style={{
          position:"fixed", inset:0,
          background:`linear-gradient(135deg, ${style.core}22 0%, transparent 60%)`,
          zIndex:9997, pointerEvents:"none",
          animationName:"ea-lp-hit",
          animationDuration:`${T_LINGER * 1.5}ms`,
          animationTimingFunction:"ease-out",
          animationFillMode:"forwards",
        }}>
          {/* Big impact text for direct hits */}
          <div style={{
            position:"absolute", top:"30%", left:"50%", transform:"translate(-50%,-50%)",
            fontSize:48, fontWeight:900, color:style.core,
            textShadow:`0 0 20px ${style.glow}, 0 0 40px ${style.glow}`,
            letterSpacing:4,
            animationName:"ea-trail",
            animationDuration:`${T_LINGER * 1.2}ms`,
            animationTimingFunction:"ease-out",
            animationFillMode:"forwards",
            pointerEvents:"none",
            whiteSpace:"nowrap",
          }}>
            ATAQUE DIRETO!
          </div>
        </div>
      )}
    </>
  )

  return portalTarget ? createPortal(content, portalTarget) : content
})
