"use client"

import Image from "next/image"

/**
 * Engrenagem holográfica girando em volta de uma carta, usada para
 * indicar o vínculo entre a Unidade e a Ultimate equipada nela.
 * Deve ser renderizada dentro de um container `relative`.
 */
export function EquipChainOverlay({
  reverse = false,
  duration = 6,
}: {
  /** Gira no sentido oposto (para a carta do outro lado do vínculo). */
  reverse?: boolean
  /** Duração de uma volta completa, em segundos. */
  duration?: number
}) {
  const dir = { ["--gear-dir" as string]: reverse ? "reverse" : "normal" }

  return (
    <div className="gp-equip-chain pointer-events-none absolute -inset-7 -z-10" aria-hidden="true">
      {/* Onda de choque holográfica no momento em que a engrenagem surge */}
      <div className="gp-equip-chain__shockwave absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2 rounded-full" />
      {/* Brilho suave e transparente em volta da carta */}
      <div className="gp-equip-chain__halo absolute inset-6 rounded-sm bg-cyan-300/20 blur-[6px]" />
      {/* Névoa circular holográfica por trás da engrenagem (mesmo diâmetro dela) */}
      <div className="gp-equip-chain__glow absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2 rounded-full" />
      {/* Anel interno de energia, girando no sentido oposto ao da engrenagem */}
      <div className="absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2">
        <div className="gp-equip-chain__ring absolute inset-0 rounded-full" style={dir} />
      </div>
      {/* Feixes de luz varrendo o aro da engrenagem */}
      <div className="absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2">
        <div className="gp-equip-chain__sweep absolute inset-0 rounded-full" style={dir} />
      </div>
      {/* Partículas de energia orbitando o aro */}
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
      {/* Engrenagem girando */}
      <div
        className="gp-equip-chain__gear absolute inset-0"
        style={{
          ["--gear-dur" as string]: `${duration}s`,
          ["--gear-dir" as string]: reverse ? "reverse" : "normal",
        }}
      >
        <Image
          src="/images/effect-chain-ultimates.png"
          alt=""
          fill
          sizes="160px"
          quality={100}
          className="object-contain"
          priority
        />
      </div>
    </div>
  )
}
