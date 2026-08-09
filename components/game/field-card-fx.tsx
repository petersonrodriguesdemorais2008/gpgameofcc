"use client"

import { useEffect, useRef, useState } from "react"

/* ============================================================================
   FieldCardFX — Efeitos épicos de campo
   1. Animação de invocação quando uma carta entra em campo (slam + shockwave)
   2. Mini-animação na carta quando uma unidade ganha ou perde DP
   Componente 100% overlay (pointer-events-none), colocado DENTRO do slot.
   Os keyframes vivem em app/globals.css (prefixo fx-).
============================================================================ */

interface FXCard {
  id?: string | number
  name: string
  image?: string
  element?: string
  dp?: number
  currentDp?: number
}

interface FieldCardFXProps {
  card: FXCard | null
  /** Imagem resolvida (skin ativa / verso da carta). Se omitida usa card.image */
  image?: string | null
  /** Desliga a animação de invocação (ex.: zonas que já têm flip próprio) */
  disableSummon?: boolean
  /** Desliga a animação de DP (ex.: cartas que não são unidades) */
  disableDp?: boolean
}

interface SummonFX {
  key: number
  image: string
  color: string
  colorSoft: string
}

interface DpFX {
  key: number
  amount: number
  type: "buff" | "debuff"
}

function elementColors(element?: string): { color: string; colorSoft: string } {
  const e = (element || "").toLowerCase()
  if (e.includes("pyrus") || e.includes("fire") || e.includes("fogo"))
    return { color: "#fb923c", colorSoft: "rgba(251,146,60,0.55)" }
  if (e.includes("aquos") || e.includes("water") || e.includes("água") || e.includes("agua"))
    return { color: "#38bdf8", colorSoft: "rgba(56,189,248,0.55)" }
  if (e.includes("haos") || e.includes("light") || e.includes("luz"))
    return { color: "#fde68a", colorSoft: "rgba(253,230,138,0.55)" }
  if (e.includes("darkus") || e.includes("dark") || e.includes("trevas"))
    return { color: "#a78bfa", colorSoft: "rgba(167,139,250,0.55)" }
  if (e.includes("ventus") || e.includes("wind") || e.includes("vento"))
    return { color: "#4ade80", colorSoft: "rgba(74,222,128,0.55)" }
  if (e.includes("subterra") || e.includes("earth") || e.includes("terra"))
    return { color: "#d6a35c", colorSoft: "rgba(214,163,92,0.55)" }
  if (e.includes("void") || e.includes("vazio"))
    return { color: "#c084fc", colorSoft: "rgba(192,132,252,0.5)" }
  return { color: "#fbbf24", colorSoft: "rgba(251,191,36,0.55)" }
}

/** Partículas determinísticas (sem Math.random para evitar problemas de hidratação) */
const SPARKS = Array.from({ length: 10 }, (_, i) => ({
  x: ((i * 37 + 13) % 100),          // 0-99 (% horizontal)
  delay: ((i * 53) % 30) / 100,       // 0-0.3s
  size: 2 + ((i * 29) % 3),           // 2-4px
  dur: 0.55 + ((i * 17) % 40) / 100,  // 0.55-0.95s
  drift: (((i * 41) % 21) - 10) * 1.6 // -16px a +16px
}))

const DEBUFF_SHARDS = Array.from({ length: 6 }, (_, i) => ({
  x: ((i * 47 + 21) % 90) + 5,
  delay: ((i * 31) % 20) / 100,
  size: 2 + ((i * 13) % 3),
  drift: (((i * 23) % 17) - 8) * 1.4
}))

export default function FieldCardFX({ card, image, disableSummon, disableDp }: FieldCardFXProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const prevKeyRef = useRef<string | null>(null)
  const prevDpRef = useRef<number | null>(null)
  const mountedRef = useRef(false)
  const fxSeq = useRef(0)

  const [summonFx, setSummonFx] = useState<SummonFX | null>(null)
  const [dpFx, setDpFx] = useState<DpFX | null>(null)

  const cardKey = card ? `${card.id ?? ""}::${card.name}` : null
  const dpNow = card ? (card.currentDp ?? card.dp ?? null) : null
  const resolvedImage = image ?? card?.image ?? null

  /* Aplica classe de animação no slot pai (o card real treme / pulsa) */
  const punchParent = (cls: string, delay: number, duration: number) => {
    const parent = rootRef.current?.parentElement
    if (!parent) return () => {}
    const t1 = window.setTimeout(() => parent.classList.add(cls), delay)
    const t2 = window.setTimeout(() => parent.classList.remove(cls), delay + duration)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      parent.classList.remove(cls)
    }
  }

  useEffect(() => {
    /* Primeiro render: registra estado sem animar (evita FX ao restaurar duelo) */
    if (!mountedRef.current) {
      mountedRef.current = true
      prevKeyRef.current = cardKey
      prevDpRef.current = dpNow
      return
    }

    const cleanups: Array<() => void> = []

    /* -------- Carta nova entrou no slot: INVOCAÇÃO -------- */
    if (cardKey && cardKey !== prevKeyRef.current) {
      prevKeyRef.current = cardKey
      prevDpRef.current = dpNow
      if (!disableSummon && resolvedImage) {
        const { color, colorSoft } = elementColors(card?.element)
        fxSeq.current++
        setSummonFx({ key: fxSeq.current, image: resolvedImage, color, colorSoft })
        cleanups.push(punchParent("fx-slot-punch", 340, 450))
        const t = window.setTimeout(() => setSummonFx(null), 1250)
        cleanups.push(() => window.clearTimeout(t))
      }
      return () => cleanups.forEach((c) => c())
    }

    /* -------- Slot esvaziou -------- */
    if (!cardKey) {
      prevKeyRef.current = null
      prevDpRef.current = null
      return
    }

    /* -------- Mesma carta, DP mudou: BUFF / DEBUFF -------- */
    if (!disableDp && dpNow !== null && prevDpRef.current !== null && dpNow !== prevDpRef.current) {
      const diff = dpNow - prevDpRef.current
      prevDpRef.current = dpNow
      fxSeq.current++
      setDpFx({ key: fxSeq.current, amount: diff, type: diff > 0 ? "buff" : "debuff" })
      cleanups.push(punchParent(diff > 0 ? "fx-dp-buff-pop" : "fx-dp-shake", 0, 620))
      const t = window.setTimeout(() => setDpFx(null), 1500)
      cleanups.push(() => window.clearTimeout(t))
      return () => cleanups.forEach((c) => c())
    }

    prevDpRef.current = dpNow
  }, [cardKey, dpNow, resolvedImage, disableSummon, disableDp, card?.element])

  return (
    <div ref={rootRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 60 }} aria-hidden="true">
      {/* ===================== INVOCAÇÃO ===================== */}
      {summonFx && (
        <div key={`summon-${summonFx.key}`} className="absolute -inset-8 overflow-visible">
          {/* Brilho de solo (aparece antes da carta cair) */}
          <div
            className="fx-ground-glow absolute left-1/2 bottom-2 -translate-x-1/2"
            style={{
              width: "130%",
              height: "34%",
              background: `radial-gradient(ellipse at center, ${summonFx.colorSoft} 0%, transparent 70%)`,
              filter: "blur(4px)"
            }}
          />
          {/* Cópia da carta caindo do céu (slam) */}
          <div className="absolute inset-8">
            <div
              className="fx-summon-drop absolute inset-0"
              style={{
                backgroundImage: `url(${summonFx.image})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: `drop-shadow(0 0 14px ${summonFx.colorSoft})`
              }}
            />
          </div>
          {/* Flash radial no impacto */}
          <div
            className="fx-summon-flash absolute inset-4"
            style={{
              background: `radial-gradient(circle at center, rgba(255,255,255,0.95) 0%, ${summonFx.colorSoft} 40%, transparent 72%)`
            }}
          />
          {/* Ondas de choque */}
          <div
            className="fx-shockwave absolute left-1/2 top-1/2"
            style={{ borderColor: summonFx.color, ["--fx-delay" as any]: "0.34s" }}
          />
          <div
            className="fx-shockwave absolute left-1/2 top-1/2"
            style={{ borderColor: "rgba(255,255,255,0.9)", ["--fx-delay" as any]: "0.42s" }}
          />
          {/* Anel de energia rotativo */}
          <div
            className="fx-summon-ring absolute left-1/2 top-1/2"
            style={{
              background: `conic-gradient(from 0deg, transparent 0%, ${summonFx.color} 18%, transparent 40%, ${summonFx.color} 62%, transparent 85%)`
            }}
          />
          {/* Fagulhas subindo */}
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="fx-summon-spark absolute"
              style={{
                left: `${s.x}%`,
                bottom: "18%",
                width: s.size,
                height: s.size,
                background: i % 3 === 0 ? "#ffffff" : summonFx.color,
                boxShadow: `0 0 6px 1px ${summonFx.colorSoft}`,
                ["--fx-delay" as any]: `${0.36 + s.delay}s`,
                ["--fx-dur" as any]: `${s.dur}s`,
                ["--fx-drift" as any]: `${s.drift}px`
              }}
            />
          ))}
        </div>
      )}

      {/* ===================== BUFF DE DP ===================== */}
      {dpFx && dpFx.type === "buff" && (
        <div key={`buff-${dpFx.key}`} className="absolute -inset-6 overflow-visible">
          {/* Aura dourada/esmeralda pulsante */}
          <div
            className="fx-buff-aura absolute inset-4"
            style={{
              background:
                "radial-gradient(circle at 50% 60%, rgba(74,222,128,0.55) 0%, rgba(251,191,36,0.35) 45%, transparent 75%)"
            }}
          />
          {/* Colunas de luz subindo */}
          <div className="absolute inset-6 overflow-hidden">
            {[18, 42, 66, 84].map((x, i) => (
              <span
                key={i}
                className="fx-buff-beam absolute bottom-0"
                style={{
                  left: `${x}%`,
                  width: 2,
                  height: "85%",
                  background: "linear-gradient(to top, transparent, rgba(74,222,128,0.95), rgba(255,255,255,0.9))",
                  ["--fx-delay" as any]: `${i * 0.08}s`
                }}
              />
            ))}
          </div>
          {/* Anel de bênção expandindo */}
          <div
            className="fx-buff-ring absolute left-1/2 top-1/2"
            style={{ borderColor: "rgba(74,222,128,0.9)" }}
          />
          {/* Número flutuante */}
          <div className="fx-dp-float-up absolute left-1/2 top-[30%] -translate-x-1/2">
            <span
              className="text-emerald-300 font-black text-lg whitespace-nowrap"
              style={{
                textShadow:
                  "0 0 8px rgba(74,222,128,0.95), 0 0 18px rgba(74,222,128,0.7), 0 2px 3px rgba(0,0,0,0.9)"
              }}
            >
              +{dpFx.amount} DP
            </span>
          </div>
        </div>
      )}

      {/* ===================== DEBUFF DE DP ===================== */}
      {dpFx && dpFx.type === "debuff" && (
        <div key={`debuff-${dpFx.key}`} className="absolute -inset-6 overflow-visible">
          {/* Flash vermelho de dano */}
          <div
            className="fx-debuff-flash absolute inset-4"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(248,113,113,0.7) 0%, rgba(153,27,27,0.45) 50%, transparent 78%)"
            }}
          />
          {/* Rachaduras (traços diagonais que piscam) */}
          <div className="absolute inset-6 overflow-hidden">
            {[
              { l: "22%", t: "12%", r: 24, len: 34 },
              { l: "58%", t: "30%", r: -38, len: 42 },
              { l: "36%", t: "52%", r: 62, len: 30 }
            ].map((c, i) => (
              <span
                key={i}
                className="fx-debuff-crack absolute"
                style={{
                  left: c.l,
                  top: c.t,
                  width: 2,
                  height: c.len,
                  transform: `rotate(${c.r}deg)`,
                  background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.95), rgba(248,113,113,0.8), transparent)",
                  ["--fx-delay" as any]: `${i * 0.06}s`
                }}
              />
            ))}
          </div>
          {/* Estilhaços caindo */}
          {DEBUFF_SHARDS.map((s, i) => (
            <span
              key={i}
              className="fx-debuff-shard absolute"
              style={{
                left: `${s.x}%`,
                top: "40%",
                width: s.size,
                height: s.size,
                background: i % 2 === 0 ? "#f87171" : "#7f1d1d",
                boxShadow: "0 0 5px 1px rgba(248,113,113,0.6)",
                ["--fx-delay" as any]: `${s.delay}s`,
                ["--fx-drift" as any]: `${s.drift}px`
              }}
            />
          ))}
          {/* Número flutuante */}
          <div className="fx-dp-float-down absolute left-1/2 top-[34%] -translate-x-1/2">
            <span
              className="text-red-400 font-black text-lg whitespace-nowrap"
              style={{
                textShadow:
                  "0 0 8px rgba(248,113,113,0.95), 0 0 18px rgba(220,38,38,0.7), 0 2px 3px rgba(0,0,0,0.9)"
              }}
            >
              {dpFx.amount} DP
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
