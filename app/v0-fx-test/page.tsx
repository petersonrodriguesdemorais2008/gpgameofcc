"use client"

// Página temporária de verificação visual — será removida.

import { useState } from "react"
import { DuelResultOverlay } from "@/components/game/duel-result-overlay"
import { ChestOpeningOverlay } from "@/components/game/chest-opening-overlay"

export default function FxTestPage() {
  const [view, setView] = useState<"none" | "won" | "lost" | "chest">("none")

  return (
    <main style={{ minHeight: "100vh", background: "#000", display: "flex", gap: 12, alignItems: "center", justifyContent: "center" }}>
      <button data-testid="btn-won" onClick={() => setView("won")} style={{ padding: 12, background: "#333", color: "#fff" }}>Vitória</button>
      <button data-testid="btn-lost" onClick={() => setView("lost")} style={{ padding: 12, background: "#333", color: "#fff" }}>Derrota</button>
      <button data-testid="btn-chest" onClick={() => setView("chest")} style={{ padding: 12, background: "#333", color: "#fff" }}>Baú</button>

      {(view === "won" || view === "lost") && (
        <DuelResultOverlay
          result={view}
          onBack={() => setView("none")}
          rewards={view === "won" ? { gacha: 20, gear: 50, fragments: { mercurio: 12 }, chest: "fire" } : null}
          masterXP={view === "won" ? { masterName: "Mestre Ignis", xpGain: 120, newLevel: 4, leveledUp: true } : null}
        />
      )}

      {view === "chest" && (
        <ChestOpeningOverlay
          chestId="fire"
          result={{ fragmentId: "mercurio", amount: 25 } as any}
          onClose={() => setView("none")}
        />
      )}
    </main>
  )
}
