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
 * Nó de uma Rota de Runas: MOLDURA RÚNICA de metal trabalhado — anel octogonal
 * de ouro envelhecido (ou prata fria quando trancada) com sulcos gravados,
 * assentado sobre um pedestal de pedra esculpida. O interior é uma lente de
 * vidro mágico com textura de pedra por baixo, e não um orbe liso de plástico.
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
  /** Cor de identidade do ramo (ou do estado) usada na moldura e na lente. */
  tint: string
  /** 0–1: quão vivo o metal fica (runas bloqueadas usam um valor baixo). */
  tintStrength?: number
  selected?: boolean
  dim?: boolean
  /** Runa pronta para ser gravada — a moldura respira e flutua. */
  float?: boolean
  /** Runa de ápice já gravada — recebe halo dourado permanente. */
  maxed?: boolean
  label: string
  onClick?: () => void
  children?: ReactNode
}) {
  const active = tintStrength >= 0.9
  const ped = Math.round(size * 0.42)

  /** Metal: ouro envelhecido quando ativa, prata fria e opaca quando trancada. */
  const metalLight = active ? "#f6e2ad" : "#7c8390"
  const metalMid   = active ? "#c69a4e" : "#4d5462"
  const metalDeep  = active ? "#6d4a1f" : "#2b303a"
  const metalEdge  = active ? "#3a2610" : "#171a20"

  /** Vidro mágico interno: profundo, com a cor do ramo pulsando no fundo. */
  const glassTop = active ? `${tint}66` : "rgba(120,130,148,0.16)"
  const glassBot = active ? shade(tint, 0.2) : "#15171d"

  /** Octógono rúnico — a silhueta de uma pedra lapidada, não um círculo. */
  const OCT = "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)"

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
        opacity: dim ? 0.9 : 1,
        transition: "opacity 0.2s, transform 0.14s",
      }}
    >
      {/* ── Pedestal de pedra esculpida: sombra + laje + coluna + capitel ── */}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: Math.round(size * 0.66), pointerEvents: "none" }}>
        {/* Sombra projetada no chão */}
        <div style={{
          position: "absolute", left: "50%", top: Math.round(ped * 0.66),
          transform: "translateX(-50%)",
          width: Math.round(size * 1.18), height: Math.round(ped * 0.72),
          background: "rgba(0,0,0,0.5)",
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
          filter: "blur(3px)",
        }}/>
        {/* Laje inferior (losango de pedra com veio claro no topo) */}
        <div style={{
          position: "absolute", left: "50%", top: Math.round(ped * 0.5),
          transform: "translateX(-50%)",
          width: Math.round(size * 1.06), height: Math.round(ped * 0.8),
          background: [
            `linear-gradient(180deg,#4a4f5c 0%,#4a4f5c 46%,#2b2f39 46%,#22252d 100%)`,
          ].join(", "),
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
          boxShadow: active ? `0 0 14px ${tint}33` : "none",
        }}/>
        {/* Coluna do pedestal com sulcos verticais gravados */}
        <div style={{
          position: "absolute", left: "50%", top: Math.round(ped * 0.28),
          transform: "translateX(-50%)",
          width: Math.round(size * 0.5), height: Math.round(ped * 0.64),
          background: [
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 4px)",
            "linear-gradient(90deg,#34384333 0%,#2a2d36 42%,#14161b 100%)",
          ].join(", "),
          borderLeft: "2px solid #3d424e",
          borderRight: "2px solid #0a0b0f",
        }}/>
        {/* Capitel (losango) — recebe a moldura da runa */}
        <div style={{
          position: "absolute", left: "50%", top: 0,
          transform: "translateX(-50%)",
          width: Math.round(size * 0.8), height: Math.round(ped * 0.62),
          background: active
            ? `linear-gradient(180deg,${metalMid} 0%,${metalMid} 48%,${metalDeep} 48%,${metalDeep} 100%)`
            : "linear-gradient(180deg,#454b58 0%,#454b58 48%,#252932 48%,#252932 100%)",
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
          boxShadow: active ? `0 0 18px ${tint}55` : "none",
        }}/>
      </div>

      {/* Aura quente atrás da moldura */}
      {active && (
        <div aria-hidden="true" style={{
          position: "absolute",
          inset: `-${Math.round(size * 0.28)}px`,
          bottom: ped,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${tint}5c 0%, ${tint}22 46%, transparent 70%)`,
          animation: "gpRuneGlowPulse 2.6s ease-in-out infinite",
          pointerEvents: "none",
        }}/>
      )}

      {/* Halo permanente de runa de nível máximo */}
      {maxed && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: `-${Math.round(size * 0.16)}px`, bottom: ped,
          clipPath: OCT,
          background: "conic-gradient(from 0deg, transparent 0deg, #ffe9b055 60deg, transparent 130deg, #ffe9b055 240deg, transparent 320deg)",
          animation: "gpRingSpin 12s linear infinite",
          pointerEvents: "none",
        }}/>
      )}

      {/* ── Moldura rúnica: anel de metal com bisel, sulcos e cravos ── */}
      <div style={{
        position: "absolute",
        left: 0, right: 0, top: 0,
        height: size,
        clipPath: OCT,
        // Bisel do metal: luz no topo-esquerdo, sombra na base-direita
        background: [
          `linear-gradient(145deg, ${metalLight} 0%, ${metalMid} 28%, ${metalDeep} 62%, ${metalEdge} 100%)`,
        ].join(", "),
        padding: Math.max(3, Math.round(size * 0.085)),
        boxShadow: active
          ? `0 0 0 1px ${metalEdge}, 0 0 20px ${tint}66, inset 0 2px 2px rgba(255,255,255,0.28)`
          : `0 0 0 1px #0b0d11, inset 0 2px 2px rgba(255,255,255,0.08)`,
        animation: float ? "gpRuneFloat 2.8s ease-in-out infinite" : "none",
        transition: "box-shadow 0.18s",
      }}>
        {/* Sulcos radiais gravados no metal da moldura */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, clipPath: OCT,
          background: `repeating-conic-gradient(from 0deg, rgba(0,0,0,0.34) 0deg 2deg, transparent 2deg 11deg)`,
          opacity: active ? 0.75 : 0.5,
          pointerEvents: "none",
        }}/>
        {/* Cravos de metal nos quatro cantos retos do octógono */}
        {([["8%", "50%"], ["92%", "50%"], ["50%", "7%"], ["50%", "93%"]] as const).map(([l, t], i) => (
          <span key={`rivet-${i}`} aria-hidden="true" style={{
            position: "absolute", left: l, top: t,
            width: Math.max(3, Math.round(size * 0.075)),
            height: Math.max(3, Math.round(size * 0.075)),
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            background: `radial-gradient(circle at 32% 30%, ${metalLight} 0%, ${metalMid} 55%, ${metalEdge} 100%)`,
            boxShadow: `0 1px 1px rgba(0,0,0,0.7)`,
            pointerEvents: "none", zIndex: 3,
          }}/>
        ))}

        {/* ── Lente de vidro mágico sobre pedra esculpida ── */}
        <div style={{
          position: "relative", width: "100%", height: "100%",
          clipPath: OCT,
          background: [
            // Textura de pedra: granulado fino em duas direções
            "repeating-linear-gradient(38deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px)",
            "repeating-linear-gradient(-52deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 4px)",
            // Vidro mágico com a cor do ramo submergindo ao fundo
            `radial-gradient(circle at 34% 26%, ${glassTop} 0%, ${glassBot} 58%, #0b0d12 100%)`,
          ].join(", "),
          boxShadow: active
            ? `inset 0 0 12px ${tint}55, inset 0 3px 6px rgba(0,0,0,0.7)`
            : "inset 0 3px 6px rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {/* Reflexo duro do vidro no canto superior */}
          <div aria-hidden="true" style={{
            position: "absolute", top: "6%", left: "10%",
            width: "52%", height: "34%",
            background: `linear-gradient(150deg, rgba(255,255,255,${active ? 0.3 : 0.09}) 0%, transparent 72%)`,
            clipPath: "polygon(0 0, 100% 0, 62% 100%, 0 78%)",
            pointerEvents: "none",
          }}/>
          {/* Brasa de energia respirando no fundo da lente (só quando viva) */}
          {active && (
            <div aria-hidden="true" style={{
              position: "absolute", inset: "18%",
              background: `radial-gradient(circle, ${tint}55 0%, transparent 68%)`,
              animation: "gpAuraBreathe 3.4s ease-in-out infinite",
              pointerEvents: "none",
            }}/>
          )}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {children}
          </div>
        </div>
      </div>

      {/* Cursor de seleção: cantoneiras de metal piscando ao redor da moldura */}
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
