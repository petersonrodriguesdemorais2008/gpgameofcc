"use client"

import { useEffect } from "react"
import { Snowflake } from "lucide-react"

export function FreezeCardAnimation({ cardName, onComplete }: { cardName: string; onComplete?: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onComplete?.(), 950)
    return () => window.clearTimeout(timer)
  }, [onComplete])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center animate-freeze-overlay"
      role="status"
      aria-label={`Congelando ${cardName}`}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onComplete?.()
      }}
    >
      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="absolute h-44 w-44 rounded-full border border-primary/30 animate-freeze-ring" />
        <div className="absolute h-64 w-64 rounded-full border border-primary/15 animate-freeze-ring [animation-delay:80ms]" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/80 bg-primary/15 text-primary shadow-[0_0_45px_var(--game-cyan)] animate-freeze-core">
          <Snowflake className="h-10 w-10 animate-freeze-snow" strokeWidth={1.5} />
        </div>
        <div className="rounded-lg border border-primary/40 bg-background/90 px-4 py-2 shadow-[0_0_30px_color-mix(in_oklab,var(--game-cyan)_35%,transparent)] animate-freeze-label">
          <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-primary">VATNAVORDR MESSIHAM</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{cardName} congelada</p>
        </div>
      </div>
    </div>
  )
}
