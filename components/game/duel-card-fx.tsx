"use client"

/**
 * DUEL CARD FX — efeitos visuais épicos para os duelos.
 *
 * - SlotSummonFx:      explosão de energia quando qualquer carta entra em campo
 *                      (jogador e oponente, todas as zonas)
 * - DpChangeFx:        mini animação na carta quando uma unidade ganha/perde DP
 * - ScenarioCastOverlay: animação cinematográfica única quando um Cenário é jogado
 * - DropMaterializeFx: materialização melhorada da carta ao soltar no slot
 */

import React, { useEffect, useRef, useState } from "react"

/* ────────────────────────────────────────────────────────────────────────
   Temas por tipo de carta
──────────────────────────────────────────────────────────────────────── */
type FxKind = "unit" | "function" | "ultimate" | "scenario"

const FX_THEMES: Record<FxKind, { main: string; soft: string; glow: string }> = {
  unit:     { main: "#22d3ee", soft: "rgba(34,211,238,0.55)",  glow: "rgba(34,211,238,0.35)" },
  function: { main: "#c084fc", soft: "rgba(192,132,252,0.55)", glow: "rgba(192,132,252,0.35)" },
  ultimate: { main: "#34d399", soft: "rgba(52,211,153,0.55)",  glow: "rgba(52,211,153,0.35)" },
  scenario: { main: "#fbbf24", soft: "rgba(251,191,36,0.55)",  glow: "rgba(251,191,36,0.35)" },
}

export function getCardFxKind(type?: string): FxKind {
  if (!type) return "function"
  if (type === "unit" || type === "troops") return "unit"
  if (type.startsWith("ultimate")) return "ultimate"
  if (type === "scenario") return "scenario"
  return "function"
}

/* ────────────────────────────────────────────────────────────────────────
   SLOT SUMMON FX — dispara ao montar / trocar fxKey (nova carta no slot)
──────────────────────────────────────────────────────────────────────── */
export function SlotSummonFx({
  fxKey,
  kind,
  isEnemy = false,
}: {
  fxKey: string
  kind: FxKind
  isEnemy?: boolean
}) {
  const [burstId, setBurstId] = useState<number | null>(null)

  useEffect(() => {
    if (!fxKey) return
    setBurstId(Date.now())
    const t = setTimeout(() => setBurstId(null), 1200)
    return () => clearTimeout(t)
  }, [fxKey])

  if (burstId === null) return null
  const th = FX_THEMES[kind]
  const accent = isEnemy ? "#f87171" : th.main

  return (
    <div
      key={burstId}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 45, ["--fx-c-soft" as any]: th.soft }}
      aria-hidden="true"
    >
      {/* Flash de impacto */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 55%, rgba(255,255,255,0.95), ${th.soft} 45%, transparent 75%)`,
          animation: "fx-summon-flash 0.5s ease-out forwards",
        }}
      />
      {/* Raios giratórios */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[190%] h-[190%] rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${th.soft} 12deg, transparent 28deg, transparent 88deg, ${th.soft} 100deg, transparent 118deg, transparent 178deg, ${th.soft} 190deg, transparent 208deg, transparent 268deg, ${th.soft} 280deg, transparent 298deg)`,
          filter: "blur(1.5px)",
          animation: "fx-summon-rays 0.95s cubic-bezier(0.22,1,0.36,1) forwards",
        }}
      />
      {/* Bloom central */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(255,255,255,0.9), ${th.soft} 55%, transparent 78%)`,
          filter: "blur(6px)",
          animation: "fx-summon-bloom 0.75s ease-out forwards",
        }}
      />
      {/* Anéis de choque */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2"
        style={{ borderColor: accent, animation: "fx-summon-ring 0.7s cubic-bezier(0.22,1,0.36,1) forwards" }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border"
        style={{ borderColor: th.main, animation: "fx-summon-ring2 1s cubic-bezier(0.22,1,0.36,1) 0.08s forwards", opacity: 0 }}
      />
      {/* Faíscas radiais */}
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 w-1 h-2.5 rounded-full"
          style={{
            background: i % 3 === 0 ? "#ffffff" : th.main,
            boxShadow: `0 0 6px ${th.main}`,
            ["--ang" as any]: `${i * 36 + (i % 2 ? 10 : -8)}deg`,
            ["--dist" as any]: `${44 + (i % 4) * 12}px`,
            animation: `fx-summon-spark ${0.65 + (i % 3) * 0.15}s cubic-bezier(0.22,1,0.36,1) ${i * 0.02}s forwards`,
            opacity: 0,
          }}
        />
      ))}
      {/* Moldura brilhante na carta */}
      <div
        className="absolute inset-0 border-2"
        style={{ borderColor: th.main, animation: "fx-summon-frame 1.05s ease-out forwards" }}
      />
      {/* Varredura de brilho na arte */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 bottom-0 w-1/2"
          style={{
            background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.75), transparent)",
            animation: "fx-summon-sweep 0.8s ease-out 0.15s forwards",
            opacity: 0,
          }}
        />
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   DP CHANGE FX — observa o DP e anima ganho (verde) ou perda (vermelho)
──────────────────────────────────────────────────────────────────────── */
export function DpChangeFx({ fxKey, dp }: { fxKey: string; dp: number }) {
  const prevRef = useRef<{ key: string; dp: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fx, setFx] = useState<{ delta: number; id: number } | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { key: fxKey, dp }
    if (prev && prev.key === fxKey && prev.dp !== dp) {
      setFx({ delta: dp - prev.dp, id: Date.now() })
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setFx(null), 1500)
    }
  }, [fxKey, dp])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  if (!fx) return null
  const up = fx.delta > 0

  return (
    <div key={fx.id} className="absolute inset-0 pointer-events-none" style={{ zIndex: 46 }} aria-hidden="true">
      {up ? (
        <>
          {/* Aura de buff */}
          <div className="absolute inset-0 border-2 border-green-400/80" style={{ animation: "fx-dp-aura-buff 1.3s ease-out forwards" }} />
          {/* Anel ascendente */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-2 border-green-300"
            style={{ animation: "fx-dp-ring 0.8s cubic-bezier(0.22,1,0.36,1) forwards" }}
          />
          {/* Partículas de energia subindo */}
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 bottom-2 w-1 h-1.5 rounded-full"
              style={{
                background: i % 2 ? "#4ade80" : "#bbf7d0",
                boxShadow: "0 0 6px #4ade80",
                ["--px" as any]: `${(i - 2.5) * 9}px`,
                animation: `fx-dp-particle ${0.9 + (i % 3) * 0.2}s ease-out ${i * 0.06}s forwards`,
                opacity: 0,
              }}
            />
          ))}
        </>
      ) : (
        <>
          {/* Aura de dano */}
          <div className="absolute inset-0 border-2 border-red-500/80" style={{ animation: "fx-dp-aura-debuff 1.2s ease-out forwards" }} />
          {/* Tremor */}
          <div className="absolute inset-0" style={{ animation: "fx-dp-shake 0.5s ease-in-out" }}>
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(circle at 50% 45%, rgba(248,113,113,0.5), transparent 70%)",
                animation: "fx-dp-crack 0.9s ease-out forwards",
              }}
            />
          </div>
        </>
      )}
      {/* Texto flutuante do delta */}
      <div
        className="absolute left-1/2 top-1/3 whitespace-nowrap font-black text-sm"
        style={{
          color: up ? "#4ade80" : "#f87171",
          textShadow: up
            ? "0 0 10px rgba(74,222,128,0.95), 0 2px 3px rgba(0,0,0,0.9)"
            : "0 0 10px rgba(248,113,113,0.95), 0 2px 3px rgba(0,0,0,0.9)",
          animation: `${up ? "fx-dp-float-up" : "fx-dp-float-down"} 1.4s cubic-bezier(0.22,1,0.36,1) forwards`,
        }}
      >
        {up ? `+${fx.delta}` : fx.delta} DP
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   SCENARIO CAST OVERLAY — cinematográfico, tela cheia, jogador e oponente
──────────────────────────────────────────────────────────────────────── */
interface ScenarioCardLike {
  id: string
  name: string
  image?: string
  element?: string
}

export function ScenarioCastOverlay({
  playerScenario,
  enemyScenario,
  resolveImage,
}: {
  playerScenario: ScenarioCardLike | null | undefined
  enemyScenario: ScenarioCardLike | null | undefined
  resolveImage?: (img: string) => string
}) {
  const prevP = useRef<string | null | undefined>(undefined)
  const prevE = useRef<string | null | undefined>(undefined)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cast, setCast] = useState<{ card: ScenarioCardLike; isEnemy: boolean; id: number } | null>(null)

  useEffect(() => {
    const pid = playerScenario?.id ?? null
    const eid = enemyScenario?.id ?? null
    // Primeira montagem: apenas registra o estado atual, sem animar
    if (prevP.current === undefined) {
      prevP.current = pid
      prevE.current = eid
      return
    }
    let next: { card: ScenarioCardLike; isEnemy: boolean } | null = null
    if (pid && pid !== prevP.current && playerScenario) next = { card: playerScenario, isEnemy: false }
    else if (eid && eid !== prevE.current && enemyScenario) next = { card: enemyScenario, isEnemy: true }
    prevP.current = pid
    prevE.current = eid
    if (next) {
      setCast({ ...next, id: Date.now() })
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCast(null), 2300)
    }
  }, [playerScenario, enemyScenario])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  if (!cast) return null
  const img = resolveImage ? resolveImage(cast.card.image || "") : cast.card.image
  const accent = cast.isEnemy ? "#f87171" : "#fbbf24"
  const accentSoft = cast.isEnemy ? "rgba(248,113,113,0.4)" : "rgba(251,191,36,0.4)"

  return (
    <div key={cast.id} className="fixed inset-0 z-[86] pointer-events-none" aria-hidden="true">
      {/* Escurecimento + tinta ambiente */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${accentSoft} 0%, rgba(0,0,0,0.82) 68%)`,
          animation: "fx-scn-backdrop 2.3s ease-in-out forwards",
        }}
      />
      {/* Barras cinematográficas */}
      <div
        className="absolute top-0 inset-x-0 h-[9%]"
        style={{ background: "linear-gradient(to bottom, #000, rgba(0,0,0,0.9))", animation: "fx-scn-bar-top 2.3s ease-in-out forwards" }}
      />
      <div
        className="absolute bottom-0 inset-x-0 h-[9%]"
        style={{ background: "linear-gradient(to top, #000, rgba(0,0,0,0.9))", animation: "fx-scn-bar-bottom 2.3s ease-in-out forwards" }}
      />
      {/* Raios de luz rotacionando */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[130vmax] h-[130vmax] rounded-full"
        style={{
          background: `conic-gradient(from 10deg, transparent 0deg, ${accentSoft} 8deg, transparent 20deg, transparent 55deg, ${accentSoft} 64deg, transparent 76deg, transparent 118deg, ${accentSoft} 126deg, transparent 138deg, transparent 178deg, ${accentSoft} 186deg, transparent 198deg, transparent 238deg, ${accentSoft} 246deg, transparent 258deg, transparent 298deg, ${accentSoft} 306deg, transparent 318deg)`,
          filter: "blur(4px)",
          animation: "fx-scn-rays 2.3s ease-in-out forwards",
        }}
      />
      {/* Onda no "chão" */}
      <div
        className="absolute left-1/2 top-[62%] -translate-x-1/2 w-[70vw] max-w-md h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          boxShadow: `0 0 22px 3px ${accentSoft}`,
          animation: "fx-scn-groundwave 2.3s ease-out forwards",
        }}
      />
      {/* Anel de choque central */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-40 rounded-full border-2"
        style={{ borderColor: accent, animation: "fx-scn-ring 2.3s cubic-bezier(0.22,1,0.36,1) forwards" }}
      />
      {/* Flash de impacto */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95), transparent 60%)",
          animation: "fx-scn-flash 2.3s ease-out forwards",
        }}
      />
      {/* Composição central */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ perspective: "900px" }}>
        <p
          className="text-[11px] font-black uppercase"
          style={{
            color: accent,
            textShadow: `0 0 14px ${accent}`,
            animation: "fx-scn-title 2.3s ease-in-out forwards",
          }}
        >
          {cast.isEnemy ? "◆ Cenário do Oponente ◆" : "◆ Cenário Ativado ◆"}
        </p>
        {/* Carta de cenário em paisagem */}
        <div
          className="relative w-72 max-w-[80vw] h-48 border-2 overflow-hidden bg-slate-950"
          style={{
            borderColor: accent,
            boxShadow: `0 0 40px ${accentSoft}, 0 0 90px ${accentSoft}`,
            animation: "fx-scn-card 2.3s cubic-bezier(0.22,1,0.36,1) forwards",
            transformStyle: "preserve-3d",
          }}
        >
          <img
            src={img || "/placeholder.svg"}
            alt={cast.card.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
          {/* Brilho varrendo */}
          <div
            className="absolute top-0 bottom-0 w-1/3"
            style={{
              background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.85), transparent)",
              animation: "fx-scn-shine 2.3s ease-out forwards",
            }}
          />
          {/* Vinheta interna */}
          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,0.65)" }} />
        </div>
        <h3
          className="text-white font-black text-xl text-center px-6 text-balance"
          style={{
            textShadow: `0 0 18px ${accent}, 0 2px 4px rgba(0,0,0,0.9)`,
            animation: "fx-scn-name 2.3s ease-in-out forwards",
          }}
        >
          {cast.card.name}
        </h3>
      </div>
      {/* Brasas subindo */}
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute bottom-[18%] left-1/2 w-1 h-1.5 rounded-full"
          style={{
            background: i % 3 === 0 ? "#fff" : accent,
            boxShadow: `0 0 8px ${accent}`,
            ["--ex" as any]: `${(i - 5.5) * 26}px`,
            animation: `fx-scn-ember ${1.3 + (i % 4) * 0.25}s ease-out ${0.35 + i * 0.07}s forwards`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   DROP MATERIALIZE FX — versão épica da materialização ao soltar a carta
──────────────────────────────────────────────────────────────────────── */
export function DropMaterializeFx({
  card,
  image,
  targetX,
  targetY,
}: {
  card: { name: string; type?: string }
  image?: string
  targetX: number
  targetY: number
}) {
  const kind = getCardFxKind(card.type)
  const th = FX_THEMES[kind]
  const isScenario = kind === "scenario"

  return (
    <div
      className="fixed pointer-events-none z-[80]"
      style={{
        left: targetX - 32,
        top: targetY - 44,
        width: 64,
        height: 88,
        animation: "fx-drop-fadeout 0.9s ease-out forwards",
        ["--fx-c-soft" as any]: th.soft,
      }}
      aria-hidden="true"
    >
      {/* Flash */}
      <div
        className="absolute -inset-8"
        style={{
          background: `radial-gradient(circle, rgba(255,255,255,0.9), ${th.soft} 40%, transparent 70%)`,
          animation: "fx-summon-flash 0.55s ease-out forwards",
        }}
      />
      {/* Raios */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${th.soft} 14deg, transparent 30deg, transparent 86deg, ${th.soft} 100deg, transparent 116deg, transparent 176deg, ${th.soft} 190deg, transparent 206deg, transparent 266deg, ${th.soft} 280deg, transparent 296deg)`,
          filter: "blur(2px)",
          animation: "fx-summon-rays 0.95s cubic-bezier(0.22,1,0.36,1) forwards",
        }}
      />
      {/* Anéis */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2"
        style={{ borderColor: th.main, animation: "fx-summon-ring 0.75s cubic-bezier(0.22,1,0.36,1) forwards" }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border"
        style={{ borderColor: "#ffffff", animation: "fx-summon-ring2 1s cubic-bezier(0.22,1,0.36,1) 0.1s forwards", opacity: 0 }}
      />
      {/* Faíscas */}
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 w-1 h-3 rounded-full"
          style={{
            background: i % 3 === 0 ? "#ffffff" : th.main,
            boxShadow: `0 0 8px ${th.main}`,
            ["--ang" as any]: `${i * 30 + (i % 2 ? 8 : -6)}deg`,
            ["--dist" as any]: `${52 + (i % 4) * 14}px`,
            animation: `fx-summon-spark ${0.7 + (i % 3) * 0.16}s cubic-bezier(0.22,1,0.36,1) ${i * 0.02}s forwards`,
            opacity: 0,
          }}
        />
      ))}
      {/* Carta materializando */}
      <div
        className="relative border-2 overflow-hidden bg-slate-900"
        style={{
          width: 64,
          height: 88,
          borderColor: th.main,
          boxShadow: `0 0 22px ${th.soft}, 0 0 46px ${th.glow}`,
          animation: "fx-drop-card 0.85s cubic-bezier(0.22,1,0.36,1) forwards",
          transformStyle: "preserve-3d",
        }}
      >
        {isScenario ? (
          <div className="absolute top-1/2 left-1/2 w-[88px] h-16 -translate-x-1/2 -translate-y-1/2 rotate-90">
            <img src={image || "/placeholder.svg"} alt={card.name} className="w-full h-full object-contain" draggable={false} />
          </div>
        ) : (
          <img src={image || "/placeholder.svg"} alt={card.name} className="w-full h-full object-contain" draggable={false} />
        )}
        {/* Varredura */}
        <div
          className="absolute top-0 bottom-0 w-1/2"
          style={{
            background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.8), transparent)",
            animation: "fx-summon-sweep 0.7s ease-out 0.25s forwards",
            opacity: 0,
          }}
        />
      </div>
    </div>
  )
}
