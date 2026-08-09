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
  return (
    <div className="gp-equip-chain pointer-events-none absolute -inset-2 z-40" aria-hidden="true">
      {/* Brilho suave e transparente em volta da carta */}
      <div className="gp-equip-chain__halo absolute inset-1 rounded-sm bg-cyan-300/20 blur-[6px]" />
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
