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
 * Nó de uma Rota de Runas: ORBE DE PODER — uma estrela cristalizada flutuando
 * na constelação. Ativa: esfera de energia viva com núcleo incandescente,
 * lens flare em cruz e anel de luz orbitando. Trancada: estrela adormecida,
 * uma esfera de vidro escuro com um brilho mínimo aguardando ser despertada.
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
  /** Cor de identidade do ramo (ou do estado) usada no orbe e no brilho. */
  tint: string
  /** 0–1: quão vivo o orbe fica (runas bloqueadas usam um valor baixo). */
  tintStrength?: number
  selected?: boolean
  dim?: boolean
  /** Runa pronta para ser gravada — o orbe respira e flutua. */
  float?: boolean
  /** Runa de ápice já gravada — recebe halo dourado permanente. */
  maxed?: boolean
  label: string
  onClick?: () => void
  children?: ReactNode
}) {
  const active = tintStrength >= 0.9
  const deep   = shade(tint, 0.25)

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
      {/* ── Aura difusa: a luz da estrela vazando para a constelação ── */}
      {active && (
        <div aria-hidden="true" style={{
          position: "absolute",
          inset: `-${Math.round(size * 0.42)}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${tint}66 0%, ${tint}22 42%, transparent 70%)`,
          animation: "gpRuneGlowPulse 2.6s ease-in-out infinite",
          pointerEvents: "none",
        }}/>
      )}

      {/* ── Lens flare em cruz — o clarão característico de estrela acesa ── */}
      {active && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
          animation: "gpAuraBreathe 3.2s ease-in-out infinite",
        }}>
          {/* Feixe horizontal */}
          <div style={{
            position: "absolute", left: `-${Math.round(size * 0.36)}px`, right: `-${Math.round(size * 0.36)}px`,
            top: "50%", height: 2, transform: "translateY(-50%)",
            background: `linear-gradient(90deg, transparent 0%, ${tint}aa 30%, #ffffff 50%, ${tint}aa 70%, transparent 100%)`,
            filter: "blur(0.4px)",
            opacity: 0.85,
          }}/>
          {/* Feixe vertical */}
          <div style={{
            position: "absolute", top: `-${Math.round(size * 0.3)}px`, bottom: `-${Math.round(size * 0.3)}px`,
            left: "50%", width: 2, transform: "translateX(-50%)",
            background: `linear-gradient(180deg, transparent 0%, ${tint}88 32%, #ffffff 50%, ${tint}88 68%, transparent 100%)`,
            filter: "blur(0.4px)",
            opacity: 0.6,
          }}/>
        </div>
      )}

      {/* ── Anel de luz orbitando o orbe ativo ── */}
      {active && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: `-${Math.max(4, Math.round(size * 0.1))}px`,
          borderRadius: "50%", pointerEvents: "none",
          background: `conic-gradient(from 0deg, transparent 0deg, ${tint} 40deg, #ffffffcc 60deg, ${tint} 80deg, transparent 130deg, transparent 360deg)`,
          maskImage: "radial-gradient(circle, transparent 0%, transparent 78%, black 82%, black 92%, transparent 96%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 0%, transparent 78%, black 82%, black 92%, transparent 96%)",
          animation: "gpRingSpin 5s linear infinite",
          filter: `drop-shadow(0 0 4px ${tint})`,
        }}/>
      )}

      {/* Halo dourado permanente de runa de ápice gravada */}
      {maxed && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: `-${Math.round(size * 0.22)}px`,
          borderRadius: "50%", pointerEvents: "none",
          background: "conic-gradient(from 0deg, transparent 0deg, #ffe9b088 50deg, transparent 120deg, #ffe9b088 230deg, transparent 310deg)",
          maskImage: "radial-gradient(circle, transparent 0%, transparent 70%, black 76%, black 88%, transparent 94%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 0%, transparent 70%, black 76%, black 88%, transparent 94%)",
          animation: "gpRingSpinRev 10s linear infinite",
          filter: "drop-shadow(0 0 6px #ffe9b0)",
        }}/>
      )}

      {/* ── O orbe em si: esfera de energia cristalizada ── */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: "50%",
        background: active
          ? [
              // Reflexo especular no topo
              `radial-gradient(circle at 32% 24%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.28) 12%, transparent 30%)`,
              // Núcleo incandescente
              `radial-gradient(circle at 50% 52%, #ffffff 0%, ${tint} 34%, ${deep} 72%, rgba(4,6,18,0.95) 100%)`,
            ].join(", ")
          : [
              `radial-gradient(circle at 32% 24%, rgba(255,255,255,0.14) 0%, transparent 26%)`,
              `radial-gradient(circle at 50% 52%, rgba(90,105,140,0.4) 0%, rgba(28,34,52,0.9) 46%, rgba(8,10,20,0.98) 100%)`,
            ].join(", "),
        border: active ? `1px solid ${tint}cc` : "1px solid rgba(120,140,180,0.28)",
        boxShadow: active
          ? `0 0 ${Math.round(size * 0.32)}px ${tint}aa, 0 0 ${Math.round(size * 0.7)}px ${tint}44, inset 0 0 ${Math.round(size * 0.2)}px ${tint}88`
          : "inset 0 2px 8px rgba(0,0,0,0.7), 0 0 10px rgba(80,100,150,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        transition: "box-shadow 0.25s",
        zIndex: 1,
      }}>
        {/* Brasa respirando dentro do núcleo (só quando viva) */}
        {active && (
          <div aria-hidden="true" style={{
            position: "absolute", inset: "16%",
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(255,255,255,0.7) 0%, ${tint}66 44%, transparent 70%)`,
            animation: "gpAuraBreathe 3.4s ease-in-out infinite",
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}/>
        )}
        {/* Poeira estelar adormecida dentro da esfera trancada */}
        {!active && (
          <div aria-hidden="true" style={{
            position: "absolute", inset: "26%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${tint}2e 0%, transparent 66%)`,
            pointerEvents: "none",
          }}/>
        )}
        <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children}
        </div>
      </div>

      {/* Cursor de seleção: anel de energia pulsando ao redor do orbe */}
      {selected && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: -8,
          borderRadius: "50%",
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
