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
 * Nó de uma Rota de Runas em estilo "ability board" épico: orbe de energia
 * luminosa com flare em cruz de quatro pontas, como num tabuleiro de
 * habilidades de anime (Inazuma Eleven).
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
  const flare = Math.round(size * 0.88)

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
        opacity: dim ? 0.9 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Flare em cruz de quatro pontas atrás do orbe (estilo starburst) */}
      {active && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: size + flare,
            height: size + flare,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            animation: "gpRuneFlarePulse 2.6s ease-in-out infinite",
          }}
        >
          {/* Ponta vertical */}
          <div style={{
            position: "absolute", left: "50%", top: 0, bottom: 0,
            width: Math.max(8, size * 0.22),
            transform: "translateX(-50%)",
            background: `linear-gradient(180deg, transparent 0%, ${tint}cc 38%, #ffffff 50%, ${tint}cc 62%, transparent 100%)`,
            clipPath: "polygon(50% 0, 78% 40%, 78% 60%, 50% 100%, 22% 60%, 22% 40%)",
            filter: "blur(0.5px)",
          }}/>
          {/* Ponta horizontal */}
          <div style={{
            position: "absolute", top: "50%", left: 0, right: 0,
            height: Math.max(8, size * 0.22),
            transform: "translateY(-50%)",
            background: `linear-gradient(90deg, transparent 0%, ${tint}cc 38%, #ffffff 50%, ${tint}cc 62%, transparent 100%)`,
            clipPath: "polygon(0 50%, 40% 22%, 60% 22%, 100% 50%, 60% 78%, 40% 78%)",
            filter: "blur(0.5px)",
          }}/>
        </div>
      )}

      {/* Halo de energia difuso */}
      {active && (
        <div aria-hidden="true" style={{
          position: "absolute",
          inset: `-${Math.round(size * 0.3)}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${tint}77 0%, ${tint}2c 45%, transparent 70%)`,
          animation: "gpRuneGlowPulse 2.4s ease-in-out infinite",
          pointerEvents: "none",
        }}/>
      )}

      {/* Orbe de energia com brilho vítreo */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        background: active
          ? `radial-gradient(circle at 34% 28%, #ffffff 0%, ${tint} 34%, ${shade(tint, 0.62)} 70%, ${shade(tint, 0.34)} 100%)`
          : "radial-gradient(circle at 34% 28%, #6f7f9e 0%, #3a4a6e 40%, #22304f 75%, #16203a 100%)",
        border: active
          ? "2px solid rgba(255,255,255,0.9)"
          : "2px solid rgba(150,175,220,0.45)",
        boxShadow: active
          ? `0 0 0 3px ${tint}44, 0 0 22px ${tint}aa, inset 0 0 12px rgba(255,255,255,0.45)`
          : "0 0 0 2px rgba(20,35,70,0.7), inset 0 0 10px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        animation: float ? "gpRuneFloat 2.8s ease-in-out infinite" : "none",
      }}>
        {/* Reflexo vítreo no topo */}
        <div aria-hidden="true" style={{
          position: "absolute", top: "6%", left: "16%",
          width: "56%", height: "32%",
          background: active
            ? "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0))"
            : "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0))",
          borderRadius: "50%",
        }}/>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", filter: active ? "drop-shadow(0 0 4px rgba(255,255,255,0.7))" : "none" }}>
          {children}
        </div>
      </div>

      {/* Anel de seleção circular pulsante (estilo cursor de jogo) */}
      {selected && (
        <>
          <div aria-hidden="true" style={{
            position: "absolute", inset: -8,
            borderRadius: "50%",
            border: "3px solid #5dff9c",
            boxShadow: "0 0 14px #5dff9caa, inset 0 0 10px #5dff9c55",
            animation: "gpRuneSelRing 1.4s ease-in-out infinite",
            pointerEvents: "none",
          }}/>
          <div aria-hidden="true" style={{
            position: "absolute", inset: -15,
            borderRadius: "50%",
            border: "2px dashed rgba(93,255,156,0.55)",
            animation: "gpRuneSelSpin 6s linear infinite",
            pointerEvents: "none",
          }}/>
        </>
      )}
    </button>
  )
}

export default RuneNode
