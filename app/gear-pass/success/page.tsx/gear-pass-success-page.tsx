// app/gear-pass/success/page.tsx
// Stripe redireciona para esta página após pagamento bem-sucedido
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, CheckCircle, ArrowRight } from "lucide-react"

export default function GearPassSuccessPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)
  const [premiumConfirmed, setPremiumConfirmed] = useState(false)

  useEffect(() => {
    // Tenta confirmar premium via API (webhook pode ter um leve delay)
    const checkPremium = async () => {
      const playerId =
        localStorage.getItem("gear-perks-player-id") ||
        localStorage.getItem("gearperks-playerid")

      if (!playerId) return

      // Tenta até 5x com intervalo de 2s para garantir que o webhook processou
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise((r) => setTimeout(r, 2000))
        try {
          const res = await fetch(`/api/stripe/check-premium?player_id=${playerId}`)
          const data = await res.json()
          if (data.hasPremium) {
            // Espelha no localStorage para acesso imediato no cliente
            localStorage.setItem("gpgame_gear_pass", JSON.stringify({
              ...JSON.parse(localStorage.getItem("gpgame_gear_pass") || "{}"),
              hasPremium: true,
            }))
            setPremiumConfirmed(true)
            break
          }
        } catch {
          // Silencia erros de rede e continua tentando
        }
      }
    }

    checkPremium()

    // Contagem regressiva para voltar ao jogo
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          router.push("/")
          return 0
        }
        return c - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [router])

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg,#020610 0%,#050d1a 50%,#030a14 100%)",
        color: "#f1f5f9",
        fontFamily: "'Segoe UI',system-ui,sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      {/* Glow de fundo */}
      <div
        style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 70% 40% at 50% 50%, rgba(217,119,6,0.10) 0%, transparent 65%)",
        }}
      />

      {/* Ícone */}
      <div
        style={{
          width: 100, height: 100, borderRadius: 28,
          background: "linear-gradient(145deg,#92400e,#b45309,#d97706)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 12px 48px rgba(217,119,6,0.40)",
          marginBottom: 24, position: "relative",
        }}
      >
        <Crown size={48} color="#fff" />
        {premiumConfirmed && (
          <div
            style={{
              position: "absolute", bottom: -8, right: -8,
              background: "#16a34a", borderRadius: "50%",
              width: 32, height: 32, display: "flex",
              alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(22,163,74,0.4)",
            }}
          >
            <CheckCircle size={18} color="#fff" />
          </div>
        )}
      </div>

      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 10 }}>
        {premiumConfirmed ? "Gear Pass Premium Ativado! 🎉" : "Pagamento Recebido!"}
      </h1>

      <p style={{ color: "#64748b", fontSize: 15, marginBottom: 8, maxWidth: 360 }}>
        {premiumConfirmed
          ? "Suas recompensas Premium já estão disponíveis na trilha do Gear Pass."
          : "Estamos confirmando seu pagamento com o Stripe... isso leva alguns segundos."}
      </p>

      {!premiumConfirmed && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <div
            style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "2px solid rgba(6,182,212,0.25)",
              borderTop: "2px solid #06b6d4",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <span style={{ color: "#475569", fontSize: 13 }}>Aguardando confirmação...</span>
        </div>
      )}

      {/* Countdown */}
      <div
        style={{
          marginTop: 28, background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: "14px 28px",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <ArrowRight size={16} color="#06b6d4" />
        <span style={{ color: "#94a3b8", fontSize: 14 }}>
          Voltando ao jogo em{" "}
          <strong style={{ color: "#06b6d4", fontSize: 18 }}>{countdown}s</strong>
        </span>
      </div>

      <button
        onClick={() => router.push("/")}
        style={{
          marginTop: 16, background: "transparent", border: "none",
          color: "#334155", fontSize: 12, cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Voltar agora
      </button>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// Importação esquecida acima — adicionando aqui
function Crown({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 5-4-5-4 5-6-5z" />
      <path d="M5 20h14" />
    </svg>
  )
}
