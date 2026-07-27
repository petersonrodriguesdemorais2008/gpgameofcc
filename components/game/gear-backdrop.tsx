"use client"

/**
 * GEAR BACKDROP — fundo animado estilo loading de jogo (referência Inazuma):
 * padrão tonal de engrenagens flat que giram enquanto a camada inteira
 * desliza na diagonal em loop perfeito. 100% transform (GPU), zero repaint.
 *
 * Compartilhado entre a tela de Modo de Jogo e a tela de Configurações.
 */

import { useMemo } from "react"

/* Variantes por célula (padrão com período de 2x2 células → loop perfeito).
   Duas engrenagens por célula → padrão mais denso. */
const GEAR_VARIANTS = [
  [
    { size: 132, dur: 15, rev: false, ox: 24, oy: 36, op: 0.14 },
    { size: 54, dur: 7, rev: true, ox: 172, oy: 130, op: 0.18 },
  ],
  [
    { size: 66, dur: 8, rev: true, ox: 150, oy: 30, op: 0.17 },
    { size: 96, dur: 11, rev: false, ox: 40, oy: 152, op: 0.15 },
  ],
  [
    { size: 88, dur: 11, rev: true, ox: 120, oy: 96, op: 0.15 },
    { size: 44, dur: 5.5, rev: false, ox: 30, oy: 210, op: 0.19 },
  ],
  [
    { size: 50, dur: 6, rev: false, ox: 196, oy: 190, op: 0.18 },
    { size: 110, dur: 13, rev: true, ox: 60, oy: 60, op: 0.14 },
  ],
] as const

const GEAR_SPACING = 260
const GEAR_PERIOD = GEAR_SPACING * 2
const GEAR_IMG = "/images/modes/gear-blue.png"

export default function GearBackdrop() {
  const gears = useMemo(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1600
    const vh = typeof window !== "undefined" ? window.innerHeight : 900
    const cols = Math.ceil((vw + GEAR_PERIOD) / GEAR_SPACING) + 1
    const rows = Math.ceil((vh + GEAR_PERIOD) / GEAR_SPACING) + 1
    const list: Array<{
      key: string; x: number; y: number
      size: number; dur: number; rev: boolean; op: number
    }> = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = GEAR_VARIANTS[(c % 2) + (r % 2) * 2]
        cell.forEach((v, i) => {
          list.push({
            key: `${r}-${c}-${i}`,
            x: c * GEAR_SPACING + v.ox - GEAR_SPACING,
            y: r * GEAR_SPACING + v.oy - GEAR_SPACING,
            size: v.size, dur: v.dur, rev: v.rev, op: v.op,
          })
        })
      }
    }
    return list
  }, [])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="gpm-drift absolute left-0 top-0"
        style={{
          width: `calc(100% + ${GEAR_PERIOD}px)`,
          height: `calc(100% + ${GEAR_PERIOD}px)`,
          willChange: "transform",
        }}
      >
        {gears.map((g) => (
          <img
            key={g.key}
            src={GEAR_IMG || "/placeholder.svg"}
            alt=""
            draggable={false}
            className={g.rev ? "gpm-gear-ccw absolute select-none" : "gpm-gear-cw absolute select-none"}
            style={{
              left: g.x,
              top: g.y,
              width: g.size,
              height: g.size,
              opacity: g.op,
              animationDuration: `${g.dur}s`,
            }}
          />
        ))}
      </div>

      <style jsx global>{`
        .gpm-drift {
          animation: gpmDrift 24s linear infinite;
        }
        .gpm-gear-cw {
          animation: gpmRot linear infinite;
        }
        .gpm-gear-ccw {
          animation: gpmRot linear infinite reverse;
        }
        @keyframes gpmDrift {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-${GEAR_PERIOD}px, -${GEAR_PERIOD}px, 0); }
        }
        @keyframes gpmRot {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gpm-drift, .gpm-gear-cw, .gpm-gear-ccw { animation: none; }
        }
      `}</style>
    </div>
  )
}
