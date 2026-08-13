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
 * Nó de uma Rota de Runas em estilo pixel art: orbe com sombreamento em bandas
 * duras apoiado num pedestal isométrico, como num tabuleiro de skill tree retrô.
 */
export function RuneNode({
  size = 70,
  tint,
  tintStrength = 1,
  selected = false,
  dim = false,
  float = false,
  label,
  onClick,
  children,
}: {
  size?: number
  /** Cor de identidade do ramo (ou do estado) usada no orbe. */
  tint: string
  /** 0–1: quão vivo o orbe fica (runas bloqueadas usam um valor baixo). */
  tintStrength?: number
  selected?: boolean
  dim?: boolean
  /** Runa pronta para ser gravada — o orbe flutua suavemente. */
  float?: boolean
  label: string
  onClick?: () => void
  children?: ReactNode
}) {
  const active = tintStrength >= 0.9
  const ped = Math.round(size * 0.42)

  // Bandas do orbe: núcleo claro → cor do ramo → sombra → borda escura
  const core  = active ? "#fff6d8" : "#5d5f6b"
  const mid   = active ? tint : "#3d3f4a"
  const dark1 = active ? shade(tint, 0.55) : "#2b2c34"
  const dark2 = active ? shade(tint, 0.28) : "#1d1e24"

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
        height: size + ped,
        flexShrink: 0,
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: onClick ? "pointer" : "default",
        opacity: dim ? 0.85 : 1,
        transition: "opacity 0.2s",
        imageRendering: "pixelated",
      }}
    >
      {/* Pedestal isométrico: topo + corpo + base */}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: Math.round(size * 0.62), pointerEvents: "none" }}>
        {/* Sombra projetada no chão */}
        <div style={{
          position: "absolute", left: "50%", top: Math.round(ped * 0.66),
          transform: "translateX(-50%)",
          width: Math.round(size * 1.16), height: Math.round(ped * 0.7),
          background: "rgba(0,0,0,0.4)",
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
          filter: "blur(2px)",
        }}/>
        {/* Base (losango largo) */}
        <div style={{
          position: "absolute", left: "50%", top: Math.round(ped * 0.52),
          transform: "translateX(-50%)",
          width: Math.round(size * 1.04), height: Math.round(ped * 0.78),
          background: active
            ? `linear-gradient(180deg,${shade(tint, 0.62)} 0%,${shade(tint, 0.62)} 52%,${shade(tint, 0.34)} 52%,${shade(tint, 0.34)} 100%)`
            : "linear-gradient(180deg,#41424e 0%,#41424e 52%,#2a2b33 52%,#2a2b33 100%)",
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
        }}/>
        {/* Corpo do cubo */}
        <div style={{
          position: "absolute", left: "50%", top: Math.round(ped * 0.3),
          transform: "translateX(-50%)",
          width: Math.round(size * 0.56), height: Math.round(ped * 0.62),
          background: "linear-gradient(90deg,#22232b 0%,#22232b 50%,#131418 50%,#131418 100%)",
          borderLeft: "2px solid #33343e",
          borderRight: "2px solid #08080c",
        }}/>
        {/* Topo do cubo (losango) */}
        <div style={{
          position: "absolute", left: "50%", top: 0,
          transform: "translateX(-50%)",
          width: Math.round(size * 0.78), height: Math.round(ped * 0.6),
          background: active ? shade(tint, 0.4) : "#383944",
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
          boxShadow: active ? `0 0 16px ${tint}55` : "none",
        }}/>
      </div>

      {/* Brilho quente atrás do orbe */}
      {active && (
        <div aria-hidden="true" style={{
          position: "absolute",
          inset: `-${Math.round(size * 0.26)}px`,
          bottom: ped,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${tint}66 0%, ${tint}26 45%, transparent 68%)`,
          animation: "gpRuneGlowPulse 2.4s ease-in-out infinite",
          pointerEvents: "none",
        }}/>
      )}

      {/* Orbe com sombreamento em bandas (estilo sprite) */}
      <div style={{
        position: "absolute",
        left: 0, right: 0, top: 0,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 36% 30%, ${core} 0%, ${core} 15%, ${mid} 15%, ${mid} 45%, ${dark1} 45%, ${dark1} 72%, ${dark2} 72%, ${dark2} 100%)`,
        border: "2px solid rgba(6,5,3,0.94)",
        boxShadow: active
          ? `inset 0 0 0 2px ${tint}44, 0 0 0 2px ${tint}44, 0 0 18px ${tint}55`
          : "inset 0 0 0 2px rgba(255,255,255,0.04), 0 0 0 2px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        animation: float ? "gpRuneFloat 2.8s ease-in-out infinite" : "none",
      }}>
        {/* Reflexo pixelado: dois blocos duros no canto superior */}
        <div aria-hidden="true" style={{
          position: "absolute", top: "12%", left: "20%",
          width: "22%", height: "10%",
          background: active ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.16)",
          borderRadius: 2,
        }}/>
        <div aria-hidden="true" style={{
          position: "absolute", top: "24%", left: "15%",
          width: "9%", height: "7%",
          background: active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.1)",
          borderRadius: 2,
        }}/>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children}
        </div>
      </div>

      {/* Anel de seleção girando lentamente (tracejado, estilo cursor de jogo) */}
      {selected && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: -9, bottom: ped - 9,
          pointerEvents: "none",
        }}>
          {([["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]] as const).map(([v, h]) => (
            <span key={`${v}-${h}`} style={{
              position: "absolute", [v]: 0, [h]: 0,
              width: 13, height: 13,
              borderTop: v === "top" ? `3px solid ${tint}` : "none",
              borderBottom: v === "bottom" ? `3px solid ${tint}` : "none",
              borderLeft: h === "left" ? `3px solid ${tint}` : "none",
              borderRight: h === "right" ? `3px solid ${tint}` : "none",
              animation: "gpRuneBlink 1.1s steps(2, jump-none) infinite",
              filter: `drop-shadow(0 0 4px ${tint})`,
            }}/>
          ))}
        </div>
      )}
    </button>
  )
}

export default RuneNode
