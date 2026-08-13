"use client"

import type { ReactNode } from "react"

/**
 * Nó de uma Rota de Runas: orbe de vidro com a engrenagem holográfica do duelo
 * (`effect-chain-ultimates`) girando em volta. Reaproveita as classes
 * `.gp-equip-chain__*` do globals.css, apenas tingindo o conjunto por filtro
 * para seguir a cor do ramo / estado da runa.
 */
export function RuneNode({
  size = 74,
  tint,
  tintStrength = 1,
  filter,
  spin = 7,
  reverse = false,
  selected = false,
  dim = false,
  rich = true,
  label,
  onClick,
  children,
}: {
  size?: number
  /** Cor de identidade do ramo (ou do estado) usada no orbe. */
  tint: string
  /** 0–1: quão vivo o orbe fica (runas bloqueadas usam um valor baixo). */
  tintStrength?: number
  /** Filtro aplicado à engrenagem para tingi-la. */
  filter: string
  /** Duração de uma volta completa, em segundos. */
  spin?: number
  reverse?: boolean
  selected?: boolean
  dim?: boolean
  /** Liga as camadas mais pesadas (varredura + partículas). */
  rich?: boolean
  label: string
  onClick?: () => void
  children?: ReactNode
}) {
  const dir = { ["--gear-dir" as string]: reverse ? "reverse" : "normal" }
  // Alpha em hexadecimal para as camadas do orbe, conforme a intensidade pedida
  const a = (base: number) =>
    Math.round(Math.max(0, Math.min(255, base * tintStrength)))
      .toString(16)
      .padStart(2, "0")

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
        opacity: dim ? 0.72 : 1,
        transition: "opacity 0.25s, transform 0.25s",
      }}
    >
      {/* Engrenagem holográfica girando (mesma do duelo), tingida por filtro */}
      <div
        className="gp-equip-chain"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: -Math.round(size * 0.22),
          filter,
          // Impede que as camadas em `mix-blend-mode: screen` reajam ao fundo da tela
          isolation: "isolate",
          opacity: 0.4 + 0.6 * tintStrength,
          pointerEvents: "none",
        }}
      >
        <div className="gp-equip-chain__glow absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2">
          <div className="gp-equip-chain__ring absolute inset-0 rounded-full" style={dir} />
        </div>
        {rich && (
          <>
            <div className="absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2">
              <div className="gp-equip-chain__sweep absolute inset-0 rounded-full" style={dir} />
            </div>
            <div className="absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2">
              <div className="gp-equip-chain__orbit absolute inset-0" style={dir}>
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <span
                    key={deg}
                    className="gp-equip-chain__spark"
                    style={{
                      transform: `rotate(${deg}deg)`,
                      ["--spark-delay" as string]: `${i * 0.35}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
        <div
          className="gp-equip-chain__gear absolute inset-0"
          style={{
            ["--gear-dur" as string]: `${spin}s`,
            ["--gear-dir" as string]: reverse ? "reverse" : "normal",
          }}
        >
          <img
            src="/images/effect-chain-ultimates.png"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
        </div>
      </div>

      {/* Anel de seleção */}
      {selected && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -7,
            borderRadius: "50%",
            border: `2px solid ${tint}`,
            boxShadow: `0 0 20px ${tint}88, inset 0 0 14px ${tint}44`,
            animation: "gpRuneNodePulse 1.9s ease-in-out infinite",
          }}
        />
      )}

      {/* Orbe de vidro */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 28%, ${tint}${a(242)} 0%, ${tint}${a(192)} 38%, ${tint}${a(112)} 62%, rgba(6,4,10,0.92) 100%)`,
          border: `1px solid ${tint}${a(204)}`,
          boxShadow: `0 0 26px ${tint}${a(85)}, inset 0 -8px 18px rgba(0,0,0,0.55), inset 0 6px 12px rgba(255,255,255,${0.1 + 0.18 * tintStrength})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Reflexo especular */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "9%",
            left: "18%",
            width: "42%",
            height: "26%",
            borderRadius: "50%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.68), rgba(255,255,255,0))",
            filter: "blur(1.5px)",
          }}
        />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children}
        </div>
      </div>
    </button>
  )
}

export default RuneNode
