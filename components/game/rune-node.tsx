"use client"

import type { ReactNode } from "react"

/** Escurece uma cor hex por um fator 0–1 (1 = cor original). */
function shade(hex: string, f: number): string {
  const m = hex.replace("#", "")
  const n = m.length === 3 ? m.split("").map(c => c + c).join("") : m
  const r = Math.round(parseInt(n.slice(0, 2), 16) * f)
  const g = Math.round(parseInt(n.slice(2, 4), 16) * f)
  const b = Math.round(parseInt(n.slice(4, 6), 16) * f)
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`
}

/**
 * Nó de uma Rota de Runas: SELO RÚNICO — um losango de metal forjado com um
 * núcleo de energia cristalizada. Ativo: moldura metálica dourada pelo tinte
 * do ramo, núcleo incandescente pulsante e lens flare em cruz. Trancado:
 * losango de aço adormecido, vidro escuro aguardando ser despertado.
 */
export function RuneNode({
  size = 70,
  tint,
  tintStrength = 1,
  selected = false,
  dim = false,
  float = false,
  maxed = false,
  label,
  onClick,
  children,
}: {
  size?: number
  /** Cor de identidade do ramo (ou do estado) usada na runa e no brilho. */
  tint: string
  /** 0–1: quão viva a runa fica (runas bloqueadas usam um valor baixo). */
  tintStrength?: number
  selected?: boolean
  dim?: boolean
  /** Runa pronta para ser gravada — o selo respira e flutua. */
  float?: boolean
  /** Runa de ápice já gravada — recebe moldura dourada permanente. */
  maxed?: boolean
  label: string
  onClick?: () => void
  children?: ReactNode
}) {
  const active = tintStrength >= 0.9
  const deep   = shade(tint, 0.25)
  const mid    = shade(tint, 0.55)

  /** Moldura metálica: liga viva tingida pelo ramo, ou aço adormecido. */
  const metal = active
    ? `conic-gradient(from 210deg, #f8eecb 0deg, ${tint} 50deg, ${mid} 115deg, #efe3b4 175deg, ${mid} 245deg, #f8eecb 315deg, #f8eecb 360deg)`
    : "conic-gradient(from 210deg, #7b869e 0deg, #2b3247 65deg, #4a5470 140deg, #1f2537 215deg, #5b6683 295deg, #7b869e 360deg)"

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className="gp-rune-node"
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: onClick ? "pointer" : "default",
        opacity: dim ? 0.85 : 1,
        transition: "opacity 0.2s, transform 0.14s",
        animation: float ? "gpRuneFloat 2.8s ease-in-out infinite" : "none",
      }}
    >
      {/* ── Aura difusa: a energia do selo vazando para a constelação ── */}
      {active && (
        <div aria-hidden="true" style={{
          position: "absolute",
          inset: `-${Math.round(size * 0.4)}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${tint}5e 0%, ${tint}20 42%, transparent 70%)`,
          animation: "gpRuneGlowPulse 2.6s ease-in-out infinite",
          pointerEvents: "none",
        }}/>
      )}

      {/* ── Lens flare em cruz alinhado aos vértices do losango ── */}
      {active && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
          animation: "gpAuraBreathe 3.2s ease-in-out infinite",
        }}>
          <div style={{
            position: "absolute", left: `-${Math.round(size * 0.34)}px`, right: `-${Math.round(size * 0.34)}px`,
            top: "50%", height: 2, transform: "translateY(-50%)",
            background: `linear-gradient(90deg, transparent 0%, ${tint}aa 30%, #ffffff 50%, ${tint}aa 70%, transparent 100%)`,
            filter: "blur(0.4px)",
            opacity: 0.8,
          }}/>
          <div style={{
            position: "absolute", top: `-${Math.round(size * 0.28)}px`, bottom: `-${Math.round(size * 0.28)}px`,
            left: "50%", width: 2, transform: "translateX(-50%)",
            background: `linear-gradient(180deg, transparent 0%, ${tint}88 32%, #ffffff 50%, ${tint}88 68%, transparent 100%)`,
            filter: "blur(0.4px)",
            opacity: 0.55,
          }}/>
        </div>
      )}

      {/* ── Moldura dourada girante de runa de ápice gravada ── */}
      {maxed && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: "2%",
          transform: "rotate(45deg)",
          border: "2px dashed #ffe6ad",
          pointerEvents: "none",
          filter: "drop-shadow(0 0 7px #ffe6ad)",
          animation: "gpRingSpin 12s linear infinite",
        }}/>
      )}

      {/* ── Moldura metálica do losango ── */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: "15%",
        transform: "rotate(45deg)",
        background: metal,
        border: active ? `1px solid ${tint}cc` : "1px solid rgba(120,140,180,0.35)",
        boxShadow: active
          ? `0 0 ${Math.round(size * 0.26)}px ${tint}99, 0 0 ${Math.round(size * 0.6)}px ${tint}3a, inset 0 0 6px rgba(255,255,255,0.35)`
          : "0 4px 12px rgba(0,0,0,0.55), inset 0 1px 2px rgba(255,255,255,0.12)",
        transition: "box-shadow 0.25s",
        zIndex: 1,
      }}/>

      {/* ── Placa interna: vidro escuro com núcleo de energia ── */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: "21%",
        transform: "rotate(45deg)",
        background: active
          ? `radial-gradient(circle at 50% 44%, #ffffff 0%, ${tint} 32%, ${deep} 74%, rgba(4,6,18,0.96) 100%)`
          : "radial-gradient(circle at 50% 44%, rgba(96,112,150,0.42) 0%, rgba(26,32,50,0.92) 48%, rgba(7,9,20,0.98) 100%)",
        border: active ? `1px solid ${tint}66` : "1px solid rgba(90,105,140,0.3)",
        boxShadow: active
          ? `inset 0 0 ${Math.round(size * 0.18)}px ${tint}88`
          : "inset 0 2px 8px rgba(0,0,0,0.7)",
        overflow: "hidden",
        zIndex: 1,
      }}>
        {/* Brasa respirando dentro do núcleo (só quando viva) */}
        {active && (
          <div style={{
            position: "absolute", inset: "12%",
            background: `radial-gradient(circle, rgba(255,255,255,0.7) 0%, ${tint}66 44%, transparent 72%)`,
            animation: "gpAuraBreathe 3.4s ease-in-out infinite",
            mixBlendMode: "screen",
          }}/>
        )}
        {/* Poeira estelar adormecida dentro do selo trancado */}
        {!active && (
          <div style={{
            position: "absolute", inset: "24%",
            background: `radial-gradient(circle, ${tint}2e 0%, transparent 66%)`,
          }}/>
        )}
      </div>

      {/* ── Rebites metálicos nos 4 vértices do losango ── */}
      {[
        { left: "50%", top: "8%" },
        { left: "92%", top: "50%" },
        { left: "50%", top: "92%" },
        { left: "8%",  top: "50%" },
      ].map((pos, i) => (
        <span key={i} aria-hidden="true" style={{
          position: "absolute", ...pos,
          width: Math.max(4, Math.round(size * 0.09)),
          height: Math.max(4, Math.round(size * 0.09)),
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: active
            ? `radial-gradient(circle at 34% 28%, #fff6d8 0%, ${tint} 55%, ${deep} 100%)`
            : "radial-gradient(circle at 34% 28%, #8a94ac 0%, #39415a 60%, #171c2c 100%)",
          border: "1px solid rgba(6,8,16,0.85)",
          boxShadow: active ? `0 0 6px ${tint}aa` : "0 1px 3px rgba(0,0,0,0.6)",
          pointerEvents: "none",
          zIndex: 2,
        }}/>
      ))}

      {/* ── Ícone da recompensa, sempre alinhado ao eixo vertical ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        {children}
      </div>

      {/* Cursor de seleção: losango de energia pulsando ao redor do selo */}
      {selected && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: "6%",
          transform: "rotate(45deg)",
          border: `2px solid ${tint}`,
          boxShadow: `0 0 14px ${tint}aa, inset 0 0 10px ${tint}44`,
          animation: "gpRuneBlink 1.1s steps(2, jump-none) infinite",
          pointerEvents: "none",
          zIndex: 4,
        }}/>
      )}
    </button>
  )
}

export default RuneNode
