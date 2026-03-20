"use client"

import { useEffect, useState, useRef } from "react"

interface DiscardCard {
  id: string
  name: string
  image: string
  element?: string
  type?: string
}

interface CardDiscardAnimationProps {
  card: DiscardCard
  owner: "player" | "enemy"
  graveyardRef: React.RefObject<HTMLDivElement | null>
  fieldRef: React.RefObject<HTMLDivElement | null>
  onDone: (id: string) => void
}

// Element-based destroy color
const elementColor = (el?: string): string => {
  const e = (el || "").toLowerCase()
  if (e === "pyrus" || e === "fire")      return "#f97316"
  if (e === "aquos" || e === "water")     return "#38bdf8"
  if (e === "terra" || e === "subterra")  return "#b45309"
  if (e === "haos" || e === "light" || e === "lightness") return "#fde047"
  if (e === "darkus" || e === "darkness") return "#a855f7"
  if (e === "ventus" || e === "wind")     return "#34d399"
  if (e === "void")                       return "#cbd5e1"
  return "#94a3b8"
}

// Get element glow for shatter effect
const elementGlow = (el?: string): string => {
  const e = (el || "").toLowerCase()
  if (e === "pyrus" || e === "fire")      return "rgba(249,115,22,0.9)"
  if (e === "aquos" || e === "water")     return "rgba(56,189,248,0.9)"
  if (e === "terra" || e === "subterra")  return "rgba(180,83,9,0.9)"
  if (e === "haos" || e === "light" || e === "lightness") return "rgba(253,224,71,0.9)"
  if (e === "darkus" || e === "darkness") return "rgba(88,28,135,0.9)"
  if (e === "ventus" || e === "wind")     return "rgba(52,211,153,0.9)"
  if (e === "void")                       return "rgba(203,213,225,0.9)"
  return "rgba(148,163,184,0.9)"
}

// Seeded fragments for consistent look per card
const mkFragments = (id: string) =>
  Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    x: -80 + (((id.charCodeAt(i % id.length) * (i + 1) * 31337) % 160)),
    y: -80 + (((id.charCodeAt((i + 3) % id.length) * (i + 2) * 12345) % 160)),
    rot: ((id.charCodeAt(i % id.length) * 137) % 360),
    scale: 0.2 + ((id.charCodeAt(i % id.length) * 7) % 10) / 10 * 0.6,
    delay: (i * 20),
    w: 20 + ((id.charCodeAt(i % id.length) * 11) % 30),
    h: 14 + ((id.charCodeAt((i+1) % id.length) * 7) % 20),
  }))

export function CardDiscardAnimation({
  card, owner, graveyardRef, fieldRef, onDone
}: CardDiscardAnimationProps) {
  const [stage, setStage] = useState<"enter" | "shatter" | "fly" | "done">("enter")
  const [gravPos, setGravPos] = useState({ x: 0, y: 0 })
  const [fieldCenter, setFieldCenter] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const col = elementColor(card.element)
  const glow = elementGlow(card.element)
  const fragments = mkFragments(card.id)

  useEffect(() => {
    // Get positions relative to field container
    if (graveyardRef.current && fieldRef.current) {
      const grav = graveyardRef.current.getBoundingClientRect()
      const field = fieldRef.current.getBoundingClientRect()
      setGravPos({
        x: grav.left + grav.width / 2 - field.left,
        y: grav.top + grav.height / 2 - field.top,
      })
      setFieldCenter({
        x: field.width / 2,
        y: field.height / 2,
      })
    }

    // Stage timeline
    const t1 = setTimeout(() => setStage("shatter"), 300)   // show card 300ms
    const t2 = setTimeout(() => setStage("fly"),     600)    // shatter 300ms
    const t3 = setTimeout(() => setStage("done"),    1100)   // fly 500ms
    const t4 = setTimeout(() => onDone(card.id),     1200)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  if (stage === "done") return null

  const isEnemy = owner === "enemy"

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: fieldCenter.x,
        top: fieldCenter.y,
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex: 20000,
      }}
    >
      <style>{`
        @keyframes dc-enter {
          0%   { transform: translate(-50%,-50%) scale(0.4) rotate(-8deg); opacity: 0; filter: blur(4px); }
          40%  { transform: translate(-50%,-50%) scale(1.12) rotate(2deg); opacity: 1; filter: blur(0px); }
          70%  { transform: translate(-50%,-50%) scale(0.96) rotate(-1deg); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes dc-shatter-card {
          0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; filter: brightness(1); }
          30%  { transform: translate(-50%,-50%) scale(1.04); opacity: 1; filter: brightness(2) saturate(2); }
          60%  { transform: translate(-50%,-50%) scale(0.9); opacity: 0.5; filter: blur(2px) brightness(3); }
          100% { transform: translate(-50%,-50%) scale(0.6); opacity: 0; filter: blur(6px); }
        }
        @keyframes dc-flash {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes dc-fragment {
          0%   { transform: translate(var(--fx),var(--fy)) scale(1) rotate(0deg); opacity: 1; }
          60%  { opacity: 0.8; }
          100% { transform: translate(calc(var(--fx)*2.5),calc(var(--fy)*2.5)) scale(0) rotate(var(--fr)); opacity: 0; }
        }
        @keyframes dc-fly-to-grave {
          0%   { transform: translate(calc(var(--gx) - 50% + 0px), calc(var(--gy) - 50% + 0px)) scale(0.55) rotate(${isEnemy ? "12deg" : "-12deg"}); opacity: 0.9; filter: blur(1px); }
          50%  { opacity: 0.7; filter: blur(2px); }
          100% { transform: translate(calc(var(--gx) - 50%), calc(var(--gy) - 50%)) scale(0.12) rotate(${isEnemy ? "25deg" : "-25deg"}); opacity: 0; filter: blur(4px); }
        }
        @keyframes dc-ring-expand {
          0%   { transform: translate(-50%,-50%) scale(0.1); opacity: 1; border-width: 6px; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; border-width: 1px; }
        }
        @keyframes dc-pulse-glow {
          0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; }
          50%      { transform: translate(-50%,-50%) scale(1.3); opacity: 1; }
        }
        @keyframes dc-smoke {
          0%   { transform: translate(var(--sx),var(--sy)) scale(0.3); opacity: 0.7; filter: blur(3px); }
          100% { transform: translate(calc(var(--sx)*1.5),calc(var(--sy)*1.5 - 30px)) scale(1.4); opacity: 0; filter: blur(8px); }
        }
      `}</style>

      {/* ── ENTER STAGE: card slides in with bounce ── */}
      {stage === "enter" && (
        <>
          {/* Glow halo behind card */}
          <div style={{
            position: "absolute",
            width: "80px", height: "80px",
            borderRadius: "50%",
            background: `radial-gradient(circle,${glow.replace("0.9","0.3")} 0%,transparent 70%)`,
            left: 0, top: 0,
            animation: "dc-pulse-glow 0.3s ease-in-out infinite",
            filter: "blur(6px)",
          }} />
          {/* Card */}
          <div style={{
            position: "absolute",
            width: "64px", height: "90px",
            borderRadius: "6px",
            overflow: "hidden",
            boxShadow: `0 0 20px 8px ${glow}, 0 8px 32px rgba(0,0,0,0.6)`,
            border: `2px solid ${col}`,
            animation: "dc-enter 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }}>
            {card.image ? (
              <img src={card.image} alt={card.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width:"100%",height:"100%",background:`linear-gradient(135deg,#1e1b4b,#4c1d95)`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:"8px",
                color:"white",textAlign:"center",padding:"4px" }}>
                {card.name}
              </div>
            )}
            {/* Overlay shimmer */}
            <div style={{
              position:"absolute",inset:0,
              background:"linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 50%,rgba(255,255,255,0.05) 100%)"
            }} />
          </div>
          {/* Card name label */}
          <div style={{
            position:"absolute", top:"54px", left:"50%",
            transform:"translateX(-50%)",
            background:"rgba(0,0,0,0.82)",
            color:"white",fontSize:"9px",fontWeight:"bold",
            padding:"2px 8px",borderRadius:"4px",
            whiteSpace:"nowrap",border:`1px solid ${col}`,
            backdropFilter:"blur(4px)", letterSpacing:"0.5px",
          }}>
            {card.name.length > 20 ? card.name.slice(0,18)+"…" : card.name}
          </div>
        </>
      )}

      {/* ── SHATTER STAGE: card explodes into fragments ── */}
      {stage === "shatter" && (
        <>
          {/* Flash ring */}
          <div style={{
            position:"absolute", width:"80px", height:"80px",
            borderRadius:"50%", border:`3px solid ${col}`,
            boxShadow:`0 0 20px 8px ${glow}`,
            animation:`dc-ring-expand 300ms ease-out forwards`,
          }} />
          <div style={{
            position:"absolute", width:"50px", height:"50px",
            borderRadius:"50%", border:`2px solid white`,
            opacity: 0.6,
            animation:`dc-ring-expand 300ms ease-out 40ms forwards`,
          }} />

          {/* Card breaking apart */}
          <div style={{
            position:"absolute", width:"64px", height:"90px",
            borderRadius:"6px", overflow:"hidden",
            boxShadow:`0 0 30px 14px ${glow}`,
            border:`2px solid ${col}`,
            animation:"dc-shatter-card 300ms ease-out forwards",
          }}>
            {card.image && <img src={card.image} alt={card.name}
              style={{ width:"100%", height:"100%", objectFit:"cover" }} />}
          </div>

          {/* Shatter fragments — card pieces flying out */}
          {fragments.map(f => (
            <div key={f.id} style={{
              position:"absolute",
              width:`${f.w}px`, height:`${f.h}px`,
              borderRadius:"2px",
              overflow:"hidden",
              border:`1px solid ${col}`,
              boxShadow:`0 0 6px 2px ${glow}`,
              animation:`dc-fragment 300ms cubic-bezier(0.2,0,0.4,1) ${f.delay}ms forwards`,
              "--fx":`${f.x * 0.6}px`,
              "--fy":`${f.y * 0.6}px`,
              "--fr":`${f.rot}deg`,
            } as React.CSSProperties}>
              {card.image && (
                <img src={card.image} alt=""
                  style={{
                    width: "200%", height: "200%",
                    objectFit: "cover",
                    marginLeft: `${-(f.id % 4) * 25}%`,
                    marginTop: `${-(Math.floor(f.id / 4)) * 33}%`,
                  }} />
              )}
            </div>
          ))}

          {/* Smoke puffs */}
          {[{sx:-20,sy:-15},{sx:15,sy:-20},{sx:-10,sy:20},{sx:22,sy:10}].map((s,i) => (
            <div key={i} style={{
              position:"absolute", width:"24px", height:"24px",
              borderRadius:"50%",
              background:`radial-gradient(circle,${glow.replace("0.9","0.4")},transparent)`,
              filter:"blur(4px)",
              animation:`dc-smoke 300ms ease-out ${i*40}ms forwards`,
              "--sx":`${s.sx}px`, "--sy":`${s.sy}px`,
            } as React.CSSProperties} />
          ))}
        </>
      )}

      {/* ── FLY STAGE: fragments rush toward graveyard ── */}
      {stage === "fly" && (
        <>
          {/* Main card ghost flying to graveyard */}
          <div style={{
            position:"absolute", width:"64px", height:"90px",
            borderRadius:"6px", overflow:"hidden",
            border:`1px solid ${col}`,
            boxShadow:`0 0 12px 4px ${glow}`,
            animation:`dc-fly-to-grave 500ms cubic-bezier(0.4,0,1,1) forwards`,
            "--gx":`${gravPos.x - fieldCenter.x}px`,
            "--gy":`${gravPos.y - fieldCenter.y}px`,
          } as React.CSSProperties}>
            {card.image && <img src={card.image} alt={card.name}
              style={{ width:"100%",height:"100%",objectFit:"cover",opacity:0.7 }} />}
            <div style={{
              position:"absolute",inset:0,
              background:`linear-gradient(135deg,${glow.replace("0.9","0.3")},transparent)`,
            }} />
          </div>

          {/* Trailing fragments following */}
          {fragments.slice(0,6).map((f,i) => (
            <div key={f.id} style={{
              position:"absolute",
              width:`${f.w * f.scale}px`, height:`${f.h * f.scale}px`,
              borderRadius:"2px",
              background:col, opacity:0.6,
              boxShadow:`0 0 4px 2px ${glow}`,
              animation:`dc-fly-to-grave 500ms cubic-bezier(0.4,0,1,1) ${i*30+50}ms forwards`,
              "--gx":`${gravPos.x - fieldCenter.x + f.x * 0.1}px`,
              "--gy":`${gravPos.y - fieldCenter.y + f.y * 0.1}px`,
            } as React.CSSProperties} />
          ))}
        </>
      )}
    </div>
  )
}

// ─── Manager: detects new graveyard entries and spawns animations ──────────────
interface DiscardManagerProps {
  playerGraveyard: DiscardCard[]
  enemyGraveyard: DiscardCard[]
  playerGraveyardRef: React.RefObject<HTMLDivElement | null>
  enemyGraveyardRef: React.RefObject<HTMLDivElement | null>
  fieldRef: React.RefObject<HTMLDivElement | null>
}

interface ActiveDiscard {
  uid: string
  card: DiscardCard
  owner: "player" | "enemy"
  gravRef: React.RefObject<HTMLDivElement | null>
}

export function DiscardAnimationManager({
  playerGraveyard, enemyGraveyard,
  playerGraveyardRef, enemyGraveyardRef, fieldRef
}: DiscardManagerProps) {
  const [active, setActive] = useState<ActiveDiscard[]>([])
  const prevPlayerLen = useRef(playerGraveyard.length)
  const prevEnemyLen  = useRef(enemyGraveyard.length)

  useEffect(() => {
    const newPlayer = playerGraveyard.length - prevPlayerLen.current
    if (newPlayer > 0) {
      const newCards = playerGraveyard.slice(-newPlayer)
      setActive(prev => [
        ...prev,
        ...newCards.map((c, i) => ({
          uid: `p-${c.id}-${Date.now()}-${i}`,
          card: c,
          owner: "player" as const,
          gravRef: playerGraveyardRef,
        }))
      ])
    }
    prevPlayerLen.current = playerGraveyard.length
  }, [playerGraveyard.length])

  useEffect(() => {
    const newEnemy = enemyGraveyard.length - prevEnemyLen.current
    if (newEnemy > 0) {
      const newCards = enemyGraveyard.slice(-newEnemy)
      setActive(prev => [
        ...prev,
        ...newCards.map((c, i) => ({
          uid: `e-${c.id}-${Date.now()}-${i}`,
          card: c,
          owner: "enemy" as const,
          gravRef: enemyGraveyardRef,
        }))
      ])
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
          fieldRef={fieldRef}
          onDone={() => remove(a.uid)}
        />
      ))}
    </>
  )
}
