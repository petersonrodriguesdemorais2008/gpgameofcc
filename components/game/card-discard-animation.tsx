"use client"

import { useEffect, useState, useRef } from "react"

interface DiscardCard {
  id: string
  name: string
  image: string
  element?: string
  type?: string
}

// ─── Timing constants ──────────────────────────────────────────────────────────
//
// DESTROY_ANIM_DURATION  = how long showDestructionAnimation runs in duel-screen
//                          (its own setTimeout is 1200ms — match that here)
//
// DISCARD_DELAY          = for plain discards (hand → graveyard), near-instant.
//
export const DESTROY_ANIM_DURATION = 1200
export const DISCARD_DELAY         = 80

// ─── Element palette ──────────────────────────────────────────────────────────
const elementColor = (el?: string): string => {
  const e = (el || "").toLowerCase()
  if (e === "pyrus" || e === "fire")                        return "#f97316"
  if (e === "aquos" || e === "water")                       return "#38bdf8"
  if (e === "terra" || e === "subterra")                    return "#b45309"
  if (e === "haos" || e === "light" || e === "lightness")   return "#fde047"
  if (e === "darkus" || e === "darkness")                   return "#a855f7"
  if (e === "ventus" || e === "wind")                       return "#34d399"
  if (e === "void")                                         return "#cbd5e1"
  return "#94a3b8"
}

const elementGlow = (el?: string): string => {
  const e = (el || "").toLowerCase()
  if (e === "pyrus" || e === "fire")                        return "rgba(249,115,22,0.9)"
  if (e === "aquos" || e === "water")                       return "rgba(56,189,248,0.9)"
  if (e === "terra" || e === "subterra")                    return "rgba(180,83,9,0.9)"
  if (e === "haos" || e === "light" || e === "lightness")   return "rgba(253,224,71,0.9)"
  if (e === "darkus" || e === "darkness")                   return "rgba(168,85,247,0.9)"
  if (e === "ventus" || e === "wind")                       return "rgba(52,211,153,0.9)"
  if (e === "void")                                         return "rgba(203,213,225,0.9)"
  return "rgba(148,163,184,0.9)"
}

// Deterministic 20-particle layout keyed to card id
const mkParticles = (id: string) =>
  Array.from({ length: 20 }).map((_, i) => {
    const s1 = id.charCodeAt(i % id.length) * (i + 1) * 31337
    const s2 = id.charCodeAt((i + 3) % id.length) * (i + 2) * 12345
    const s3 = id.charCodeAt((i + 1) % id.length) * 137
    return {
      id: i,
      x:  -28 + (s1 % 56),
      y:  -38 + (s2 % 76),
      rot: s3 % 360,
      scale: 0.3 + (s1 % 10) / 10 * 0.7,
      delay: i * 18,
      w: 8 + (s1 % 18),
      h: 6 + (s2 % 14),
      dx: -12 + (s1 % 24),
      dy: -20 + (s2 % 16),
    }
  })


// ─── Single graveyard-local disintegration ───────────────────────────────────
interface CardDiscardAnimationProps {
  card: DiscardCard
  owner: "player" | "enemy"
  graveyardRef: React.RefObject<HTMLDivElement | null>
  onDone: (id: string) => void
}

export function CardDiscardAnimation({
  card, owner, graveyardRef, onDone
}: CardDiscardAnimationProps) {
  const [stage, setStage]     = useState<"flash" | "disintegrate" | "done">("flash")
  const [gravRect, setGravRect] = useState<DOMRect | null>(null)

  const col       = elementColor(card.element)
  const glow      = elementGlow(card.element)
  const particles = mkParticles(card.id)

  useEffect(() => {
    if (graveyardRef.current) {
      setGravRect(graveyardRef.current.getBoundingClientRect())
    }
    const t1 = setTimeout(() => setStage("disintegrate"), 250)
    const t2 = setTimeout(() => setStage("done"),          900)
    const t3 = setTimeout(() => onDone(card.id),           950)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  if (stage === "done" || !gravRect) return null

  const cx = gravRect.left + gravRect.width  / 2
  const cy = gravRect.top  + gravRect.height / 2
  const CW = Math.min(gravRect.width  * 0.75, 60)
  const CH = Math.min(gravRect.height * 0.75, 84)

  return (
    <div style={{
      position:"fixed", left:cx, top:cy,
      width:0, height:0,
      pointerEvents:"none", zIndex:20000,
    }}>
      <style>{`
        @keyframes dc-grav-flash {
          0%   { opacity:0; transform:translate(-50%,-50%) scale(0.6); filter:brightness(3) blur(2px); }
          40%  { opacity:1; transform:translate(-50%,-50%) scale(1.06); filter:brightness(2); }
          100% { opacity:1; transform:translate(-50%,-50%) scale(1);   filter:brightness(1); }
        }
        @keyframes dc-grav-card-out {
          0%   { opacity:1; transform:translate(-50%,-50%) scale(1);   filter:brightness(1); }
          40%  { opacity:0.8; transform:translate(-50%,-50%) scale(1.04); filter:brightness(2) saturate(2); }
          100% { opacity:0; transform:translate(-50%,-50%) scale(0.7); filter:brightness(4) blur(6px); }
        }
        @keyframes dc-ring {
          0%   { transform:translate(-50%,-50%) scale(0.2); opacity:1;  border-width:5px; }
          100% { transform:translate(-50%,-50%) scale(2.4); opacity:0;  border-width:1px; }
        }
        @keyframes dc-particle-drift {
          0%   { transform:translate(var(--px),var(--py)) scale(var(--ps)) rotate(0deg); opacity:1; }
          60%  { opacity:0.6; }
          100% { transform:translate(calc(var(--px)+var(--dx)),calc(var(--py)+var(--dy))) scale(0) rotate(var(--pr)); opacity:0; }
        }
        @keyframes dc-smoke-drift {
          0%   { transform:translate(var(--sx),var(--sy)) scale(0.4); opacity:0.65; filter:blur(4px); }
          100% { transform:translate(var(--sx),calc(var(--sy)-22px)) scale(1.6); opacity:0; filter:blur(10px); }
        }
        @keyframes dc-glow-pulse {
          0%,100% { opacity:0.4; transform:translate(-50%,-50%) scale(1); }
          50%     { opacity:0.9; transform:translate(-50%,-50%) scale(1.2); }
        }
      `}</style>

      {/* ── FLASH: card art pops in at graveyard zone ── */}
      {stage === "flash" && (
        <>
          <div style={{
            position:"absolute",
            width:`${CW*1.6}px`, height:`${CH*1.6}px`,
            borderRadius:"50%",
            background:`radial-gradient(circle,${glow.replace("0.9","0.35")} 0%,transparent 70%)`,
            filter:"blur(8px)",
            animation:"dc-glow-pulse 0.25s ease-in-out infinite",
          }} />
          <div style={{
            position:"absolute",
            width:`${CW}px`, height:`${CH}px`,
            borderRadius:"5px", overflow:"hidden",
            border:`2px solid ${col}`,
            boxShadow:`0 0 18px 6px ${glow},0 4px 20px rgba(0,0,0,0.7)`,
            animation:"dc-grav-flash 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }}>
            {card.image ? (
              <img src={card.image} alt={card.name}
                style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            ) : (
              <div style={{
                width:"100%", height:"100%",
                background:"linear-gradient(135deg,#1e1b4b,#4c1d95)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"7px", color:"white", textAlign:"center", padding:"4px",
              }}>{card.name}</div>
            )}
            <div style={{
              position:"absolute", inset:0,
              background:"linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 55%,rgba(255,255,255,0.04) 100%)",
            }} />
          </div>
        </>
      )}

      {/* ── DISINTEGRATE: art shatters right at the graveyard zone ── */}
      {stage === "disintegrate" && (
        <>
          <div style={{
            position:"absolute",
            width:`${CW}px`, height:`${CW}px`,
            borderRadius:"50%",
            border:`4px solid ${col}`,
            boxShadow:`0 0 14px 6px ${glow}`,
            animation:"dc-ring 650ms ease-out forwards",
          }} />
          <div style={{
            position:"absolute",
            width:`${CW*0.6}px`, height:`${CW*0.6}px`,
            borderRadius:"50%",
            border:"2px solid rgba(255,255,255,0.5)",
            animation:"dc-ring 650ms ease-out 60ms forwards",
          }} />

          <div style={{
            position:"absolute",
            width:`${CW}px`, height:`${CH}px`,
            borderRadius:"5px", overflow:"hidden",
            border:`2px solid ${col}`,
            boxShadow:`0 0 24px 10px ${glow}`,
            animation:"dc-grav-card-out 650ms ease-out forwards",
          }}>
            {card.image && (
              <img src={card.image} alt={card.name}
                style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            )}
          </div>

          {particles.map(p => (
            <div key={p.id} style={{
              position:"absolute",
              width:`${p.w}px`, height:`${p.h}px`,
              borderRadius:"2px", overflow:"hidden",
              border:`1px solid ${col}`,
              boxShadow:`0 0 5px 2px ${glow}`,
              animation:`dc-particle-drift 650ms cubic-bezier(0.2,0,0.5,1) ${p.delay}ms forwards`,
              "--px":`${p.x}px`, "--py":`${p.y}px`, "--ps":`${p.scale}`,
              "--pr":`${p.rot}deg`,
              "--dx":`${p.dx}px`, "--dy":`${p.dy}px`,
            } as React.CSSProperties}>
              {card.image && (
                <img src={card.image} alt="" style={{
                  width:"220%", height:"220%", objectFit:"cover", pointerEvents:"none",
                  marginLeft:`${-(p.id%4)*30}%`,
                  marginTop:`${-Math.floor(p.id/4)*30}%`,
                }} />
              )}
            </div>
          ))}

          {[{sx:-14,sy:-10},{sx:10,sy:-18},{sx:-6,sy:14},{sx:16,sy:6}].map((s,i) => (
            <div key={i} style={{
              position:"absolute",
              width:"20px", height:"20px",
              borderRadius:"50%",
              background:`radial-gradient(circle,${glow.replace("0.9","0.4")},transparent)`,
              filter:"blur(4px)",
              animation:`dc-smoke-drift 650ms ease-out ${i*50}ms forwards`,
              "--sx":`${s.sx}px`, "--sy":`${s.sy}px`,
            } as React.CSSProperties} />
          ))}
        </>
      )}
    </div>
  )
}


// ─── Manager ─────────────────────────────────────────────────────────────────
//
// The key insight: when a card is *destroyed* on the field, `showDestructionAnimation`
// runs for DESTROY_ANIM_DURATION (1200ms). We must NOT fire the graveyard animation
// until that finishes — otherwise both play simultaneously and the player's eye
// doesn't know where to look.
//
// Solution: the manager accepts an optional `destroyedCardIds` Set.
// Cards in that set are delayed by DESTROY_ANIM_DURATION before appearing in the
// graveyard zone. Plain discards use DISCARD_DELAY (≈80ms, effectively immediate).
//
// ── How to wire it up in duel-screen.tsx ──────────────────────────────────────
//
//   1. Add state:
//      const [destroyedCardIds, setDestroyedCardIds] = useState<Set<string>>(new Set())
//
//   2. Every time you call showDestructionAnimation(card, x, y), also call:
//      setDestroyedCardIds(prev => { const s = new Set(prev); s.add(card.id); return s })
//
//   3. Pass it to the manager:
//      <DiscardAnimationManager
//        ...existing props...
//        destroyedCardIds={destroyedCardIds}
//      />
//
//   4. Remove the fieldRef prop — it's no longer needed.
//
// ─────────────────────────────────────────────────────────────────────────────

interface DiscardManagerProps {
  playerGraveyard: DiscardCard[]
  enemyGraveyard:  DiscardCard[]
  playerGraveyardRef: React.RefObject<HTMLDivElement | null>
  enemyGraveyardRef:  React.RefObject<HTMLDivElement | null>
  /**
   * IDs of cards currently undergoing an on-field destruction animation.
   * These get delayed by DESTROY_ANIM_DURATION before the graveyard anim fires.
   */
  destroyedCardIds?: Set<string>
}

interface ActiveDiscard {
  uid:     string
  card:    DiscardCard
  owner:   "player" | "enemy"
  gravRef: React.RefObject<HTMLDivElement | null>
}

export function DiscardAnimationManager({
  playerGraveyard, enemyGraveyard,
  playerGraveyardRef, enemyGraveyardRef,
  destroyedCardIds,
}: DiscardManagerProps) {
  const [active, setActive] = useState<ActiveDiscard[]>([])
  const prevPlayerLen       = useRef(playerGraveyard.length)
  const prevEnemyLen        = useRef(enemyGraveyard.length)

  const schedule = (
    cards:   DiscardCard[],
    owner:   "player" | "enemy",
    gravRef: React.RefObject<HTMLDivElement | null>,
    baseIdx: number,
  ) => {
    cards.forEach((c, i) => {
      const wasDestroyed = destroyedCardIds?.has(c.id) ?? false
      const delay = wasDestroyed ? DESTROY_ANIM_DURATION : DISCARD_DELAY

      setTimeout(() => {
        setActive(prev => [
          ...prev,
          {
            uid:    `${owner[0]}-${c.id}-${Date.now()}-${baseIdx + i}`,
            card:   c,
            owner,
            gravRef,
          }
        ])
      }, delay)
    })
  }

  useEffect(() => {
    const newCount = playerGraveyard.length - prevPlayerLen.current
    if (newCount > 0) {
      schedule(playerGraveyard.slice(-newCount), "player", playerGraveyardRef, prevPlayerLen.current)
    }
    prevPlayerLen.current = playerGraveyard.length
  }, [playerGraveyard.length])

  useEffect(() => {
    const newCount = enemyGraveyard.length - prevEnemyLen.current
    if (newCount > 0) {
      schedule(enemyGraveyard.slice(-newCount), "enemy", enemyGraveyardRef, prevEnemyLen.current)
    }
    prevEnemyLen.current = enemyGraveyard.length
  }, [enemyGraveyard.length])

  const remove = (uid: string) =>
    setActive(prev => prev.filter(a => a.uid !== uid))

  return (
    <>
      {active.map(a => (
        <CardDiscardAnimation
          key={a.uid}
          card={a.card}
          owner={a.owner}
          graveyardRef={a.gravRef}
          onDone={() => remove(a.uid)}
        />
      ))}
    </>
  )
}
