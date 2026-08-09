"use client"

import { useState } from "react"
import FieldCardFX from "@/components/game/field-card-fx"

const IMG = "/placeholder.svg?height=200&width=140"

export default function FxLab() {
  const [card, setCard] = useState<any>(null)

  return (
    <main className="min-h-screen bg-slate-950 p-16 flex flex-col gap-10 items-center">
      <div className="flex gap-3">
        <button
          className="px-3 py-2 bg-cyan-700 text-white text-sm"
          onClick={() => {
            setCard(null)
            setTimeout(() => setCard({ id: Date.now(), name: "Teste", image: IMG, element: "pyrus", dp: 3, currentDp: 3 }), 60)
          }}
        >
          Invocar
        </button>
        <button
          className="px-3 py-2 bg-emerald-700 text-white text-sm"
          onClick={() => setCard((c: any) => (c ? { ...c, currentDp: (c.currentDp ?? 0) + 2 } : c))}
        >
          +2 DP
        </button>
        <button
          className="px-3 py-2 bg-red-700 text-white text-sm"
          onClick={() => setCard((c: any) => (c ? { ...c, currentDp: (c.currentDp ?? 0) - 1 } : c))}
        >
          -1 DP
        </button>
      </div>

      <div className="mt-24">
        <div className="w-[69px] h-24 border-2 border-cyan-700/60 relative overflow-visible bg-transparent">
          <FieldCardFX card={card} image={card ? IMG : null} />
          {card && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG || "/placeholder.svg"} alt="carta" className="absolute inset-0 w-full h-full object-contain" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-center text-xs text-white font-bold py-0.5">
                {card.currentDp} DP
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
