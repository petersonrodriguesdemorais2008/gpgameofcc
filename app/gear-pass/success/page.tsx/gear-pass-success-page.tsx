// app/gear-pass/success/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function GearPassSuccessPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    // ── 1. Ativa o Premium IMEDIATAMENTE no localStorage ─────────────────
    // Garante que o jogador veja o Premium ativo assim que voltar ao jogo,
    // independente do webhook ter processado ou não.
    try {
      const LS_PASS_KEY = "gpgame_gear_pass"
      const existing = JSON.parse(localStorage.getItem(LS_PASS_KEY) || "{}")
      localStorage.setItem(LS_PASS_KEY, JSON.stringify({ ...existing, hasPremium: true }))
    } catch {}

    // ── 2. Tenta confirmar via API em background ───────────────────────────
    const checkPremium = async () => {
      const playerId =
        localStorage.getItem("gear-perks-player-id") ||
        localStorage.getItem("gearperks-playerid") || ""
      if (!playerId) return
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise((r) => setTimeout(r, 2000))
        try {
          const res = await fetch(`/api/stripe/check-premium?player_id=${playerId}`)
          const data = await res.json()
          if (data.hasPremium) {
            const LS_PASS_KEY = "gpgame_gear_pass"
            const existing = JSON.parse(localStorage.getItem(LS_PASS_KEY) || "{}")
            localStorage.setItem(LS_PASS_KEY, JSON.stringify({ ...existing, hasPremium: true }))
            break
          }
        } catch {}
      }
    }
    checkPremium()

    // ── 3. Contagem regressiva ─────────────────────────────────────────────
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); router.push("/"); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [router])

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg,#020610 0%,#050d1a 50%,#030a14 100%)",
      color: "#f1f5f9", fontFamily: "'Segoe UI',system-ui,sans-serif",
      padding: 24, textAlign: "center",
    }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 40% at 50% 50%, rgba(217,119,6,0.12) 0%, transparent 65%)" }} />

      <div style={{ width: 100, height: 100, borderRadius: 28, marginBottom: 24,
        background: "linear-gradient(145deg,#92400e,#b45309,#d97706)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 12px 48px rgba(217,119,6,0.40)", position: "relative", zIndex: 1, fontSize: 48 }}>
        👑
      </div>

      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 10, position: "relative", zIndex: 1 }}>
        Gear Pass Premium Ativado! 🎉
      </h1>
      <p style={{ color: "#64748b", fontSize: 15, marginBottom: 20, maxWidth: 360, position: "relative", zIndex: 1 }}>
        Suas recompensas Premium já estão disponíveis na trilha do Gear Pass.
      </p>

      <div style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.20)",
        borderRadius: 16, padding: "16px 20px", marginBottom: 24, maxWidth: 320, position: "relative", zIndex: 1 }}>
        {["✅ Recompensas Premium desbloqueadas","✅ Carta LR Exclusiva no Nível 100",
          "✅ Playmats exclusivos disponíveis","✅ Packs UR em marcos especiais"].map((item, i) => (
          <div key={i} style={{ color: "#cbd5e1", fontSize: 13, textAlign: "left", marginBottom: 6 }}>{item}</div>
        ))}
      </div>

      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: "14px 28px", position: "relative", zIndex: 1 }}>
        <span style={{ color: "#94a3b8", fontSize: 14 }}>
          Voltando ao jogo em{" "}
          <strong style={{ color: "#06b6d4", fontSize: 20 }}>{countdown}s</strong>
        </span>
      </div>

      <button onClick={() => router.push("/")}
        style={{ marginTop: 12, background: "transparent", border: "none",
          color: "#334155", fontSize: 12, cursor: "pointer", textDecoration: "underline", position: "relative", zIndex: 1 }}>
        Voltar agora
      </button>
    </div>
  )
}
