"use client"

import { useEffect, useRef, useState } from "react"

/* ============================================================================
   ScenarioRevealOverlay — Animação cinematográfica única para cartas de CENÁRIO

   Componente "observador": recebe as zonas de cenário do jogador e do oponente
   e dispara automaticamente uma animação épica em tela cheia sempre que uma
   NOVA carta de cenário entra em campo — não importa a origem (clique, drag,
   TAP, bot, multiplayer). Zero acoplamento com a lógica de jogo.

   Fases (total ~2.4s):
     0.00s  Barras cinematográficas fecham + escurecimento do campo
     0.15s  Raios de luz dourados giram atrás da carta
     0.25s  Carta surge do "horizonte" com perspectiva 3D + brilho âmbar
     0.55s  Onda de choque + faixa "CENÁRIO ATIVADO" varre a tela
     1.90s  Tudo se dissolve; a carta "assenta" na zona
============================================================================ */

interface ScenarioCard {
  id?: string | number
  name: string
  image?: string
}

interface ScenarioRevealOverlayProps {
  playerScenario: ScenarioCard | null | undefined
  enemyScenario: ScenarioCard | null | undefined
  /** Rótulos customizáveis (default PT-BR) */
  playerLabel?: string
  enemyLabel?: string
}

interface RevealFX {
  key: number
  card: ScenarioCard
  owner: "player" | "enemy"
}

const REVEAL_DURATION = 2400

/* Partículas determinísticas (evita divergência de hidratação) */
const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 61 + 17) % 100,
  delay: ((i * 37) % 90) / 100,
  size: 2 + ((i * 23) % 4),
  dur: 1.1 + ((i * 13) % 60) / 100,
  drift: (((i * 47) % 25) - 12) * 2.2,
}))

const RAYS = Array.from({ length: 8 }, (_, i) => ({
  rot: i * 45,
  delay: (i % 4) * 0.05,
}))

export default function ScenarioRevealOverlay({
  playerScenario,
  enemyScenario,
  playerLabel = "SEU CENÁRIO",
  enemyLabel = "CENÁRIO DO OPONENTE",
}: ScenarioRevealOverlayProps) {
  const mountedRef = useRef(false)
  const prevPlayerKeyRef = useRef<string | null>(null)
  const prevEnemyKeyRef = useRef<string | null>(null)
  const seqRef = useRef(0)
  const queueRef = useRef<RevealFX[]>([])
  const [fx, setFx] = useState<RevealFX | null>(null)
  const fxActiveRef = useRef(false)

  const playerKey = playerScenario ? `${playerScenario.id ?? ""}::${playerScenario.name}` : null
  const enemyKey = enemyScenario ? `${enemyScenario.id ?? ""}::${enemyScenario.name}` : null

  const startNext = () => {
    const next = queueRef.current.shift()
    if (!next) {
      fxActiveRef.current = false
      setFx(null)
      return
    }
    fxActiveRef.current = true
    setFx(next)
    window.setTimeout(startNext, REVEAL_DURATION)
  }

  const enqueue = (card: ScenarioCard, owner: "player" | "enemy") => {
    seqRef.current++
    queueRef.current.push({ key: seqRef.current, card, owner })
    if (!fxActiveRef.current) startNext()
  }

  useEffect(() => {
    /* Primeiro render: registra estado sem animar (evita FX ao restaurar duelo) */
    if (!mountedRef.current) {
      mountedRef.current = true
      prevPlayerKeyRef.current = playerKey
      prevEnemyKeyRef.current = enemyKey
      return
    }
    if (playerKey && playerKey !== prevPlayerKeyRef.current && playerScenario) {
      enqueue(playerScenario, "player")
    }
    if (enemyKey && enemyKey !== prevEnemyKeyRef.current && enemyScenario) {
      enqueue(enemyScenario, "enemy")
    }
    prevPlayerKeyRef.current = playerKey
    prevEnemyKeyRef.current = enemyKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey, enemyKey])

  if (!fx) return null

  const isPlayer = fx.owner === "player"
  const accent = isPlayer ? "#38bdf8" : "#f87171"
  const accentSoft = isPlayer ? "rgba(56,189,248,0.55)" : "rgba(248,113,113,0.55)"
  const ownerText = isPlayer ? playerLabel : enemyLabel
  const img = fx.card.image || "/placeholder.svg"

  return (
    <div
      key={`scn-${fx.key}`}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 30000 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-dim {
          0%   { opacity: 0; }
          12%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes scn-bar-top {
          0%   { transform: translateY(-100%); }
          12%  { transform: translateY(0); }
          82%  { transform: translateY(0); }
          100% { transform: translateY(-100%); }
        }
        @keyframes scn-bar-bottom {
          0%   { transform: translateY(100%); }
          12%  { transform: translateY(0); }
          82%  { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
        @keyframes scn-rays-spin {
          0%   { opacity: 0; transform: translate(-50%,-50%) rotate(0deg) scale(0.4); }
          18%  { opacity: 0.8; }
          70%  { opacity: 0.7; }
          100% { opacity: 0; transform: translate(-50%,-50%) rotate(120deg) scale(1.35); }
        }
        @keyframes scn-card-rise {
          0%   { opacity: 0; transform: translate(-50%,-30%) rotateX(52deg) scale(0.35); filter: brightness(3) blur(8px); }
          22%  { opacity: 1; transform: translate(-50%,-50%) rotateX(14deg) scale(1.12); filter: brightness(1.6) blur(0); }
          32%  { transform: translate(-50%,-50%) rotateX(0deg) scale(1); filter: brightness(1.15); }
          74%  { opacity: 1; transform: translate(-50%,-50%) rotateX(0deg) scale(1.02); filter: brightness(1); }
          100% { opacity: 0; transform: translate(-50%,-58%) rotateX(-10deg) scale(0.72); filter: brightness(1.8) blur(4px); }
        }
        @keyframes scn-shockring {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.15); border-width: 6px; }
          10%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(3.2); border-width: 1px; }
        }
        @keyframes scn-banner-sweep {
          0%   { opacity: 0; transform: translateX(-110%) skewX(-14deg); }
          16%  { opacity: 1; transform: translateX(0) skewX(-14deg); }
          78%  { opacity: 1; transform: translateX(0) skewX(-14deg); }
          100% { opacity: 0; transform: translateX(110%) skewX(-14deg); }
        }
        @keyframes scn-text-in {
          0%   { opacity: 0; transform: translateY(14px) scale(0.9); letter-spacing: 0.6em; }
          30%  { opacity: 1; transform: translateY(0) scale(1); letter-spacing: 0.25em; }
          80%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-8px); }
        }
        @keyframes scn-name-in {
          0%   { opacity: 0; transform: translateY(10px); }
          35%  { opacity: 1; transform: translateY(0); }
          82%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes scn-ember-rise {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.6); }
          15%  { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--scn-drift), -46vh) scale(0.2); }
        }
        @keyframes scn-ground-pulse {
          0%   { opacity: 0; transform: translateX(-50%) scaleX(0.3); }
          20%  { opacity: 1; transform: translateX(-50%) scaleX(1); }
          78%  { opacity: 0.8; }
          100% { opacity: 0; transform: translateX(-50%) scaleX(1.4); }
        }
      `}</style>

      {/* Escurecimento do campo com vinheta âmbar */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(120,72,10,0.28) 0%, rgba(0,0,0,0.78) 78%)",
          animation: `scn-dim ${REVEAL_DURATION}ms ease-in-out forwards`,
        }}
      />

      {/* Barras cinematográficas */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: "9%",
          background: "linear-gradient(to bottom, #000 78%, transparent)",
          animation: `scn-bar-top ${REVEAL_DURATION}ms cubic-bezier(0.22,1,0.36,1) forwards`,
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "9%",
          background: "linear-gradient(to top, #000 78%, transparent)",
          animation: `scn-bar-bottom ${REVEAL_DURATION}ms cubic-bezier(0.22,1,0.36,1) forwards`,
        }}
      />

      {/* Raios de luz dourados girando atrás da carta */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: "120vmin",
          height: "120vmin",
          animation: `scn-rays-spin ${REVEAL_DURATION}ms ease-in-out forwards`,
        }}
      >
        {RAYS.map((r, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 origin-top"
            style={{
              width: 3,
              height: "60vmin",
              transform: `rotate(${r.rot}deg)`,
              background:
                "linear-gradient(to bottom, rgba(251,191,36,0.85), rgba(251,191,36,0.25) 55%, transparent)",
              filter: "blur(1px)",
              boxShadow: "0 0 18px 4px rgba(251,191,36,0.35)",
            }}
          />
        ))}
      </div>

      {/* Brilho de solo (linha de energia horizontal) */}
      <div
        className="absolute left-1/2 top-[62%]"
        style={{
          width: "70vmin",
          height: 5,
          borderRadius: 999,
          background: `linear-gradient(to right, transparent, ${accent}, #fbbf24, ${accent}, transparent)`,
          boxShadow: `0 0 26px 8px ${accentSoft}`,
          animation: `scn-ground-pulse ${REVEAL_DURATION}ms ease-out forwards`,
        }}
      />

      {/* Ondas de choque */}
      <div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: "34vmin",
          height: "34vmin",
          border: "6px solid #fbbf24",
          boxShadow: "0 0 30px 10px rgba(251,191,36,0.5)",
          animation: `scn-shockring 1100ms ease-out 480ms forwards`,
          opacity: 0,
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: "34vmin",
          height: "34vmin",
          border: `4px solid ${accent}`,
          animation: `scn-shockring 1100ms ease-out 620ms forwards`,
          opacity: 0,
        }}
      />

      {/* Carta subindo do horizonte com perspectiva 3D */}
      <div className="absolute inset-0" style={{ perspective: "900px" }}>
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: "min(52vmin, 320px)",
            height: "min(36vmin, 220px)",
            transformStyle: "preserve-3d",
            animation: `scn-card-rise ${REVEAL_DURATION}ms cubic-bezier(0.16,1,0.3,1) forwards`,
          }}
        >
          <div
            className="absolute inset-0 rounded-lg overflow-hidden"
            style={{
              border: "2px solid #fbbf24",
              boxShadow: `0 0 42px 12px rgba(251,191,36,0.55), 0 0 90px 30px ${accentSoft}, 0 24px 60px rgba(0,0,0,0.85)`,
              background: "#1c1408",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className="w-full h-full object-cover" />
            {/* Reflexo varrendo a arte */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.35) 48%, transparent 62%)",
                mixBlendMode: "screen",
                animation: `scn-banner-sweep 1400ms ease-in-out 350ms forwards`,
                opacity: 0,
              }}
            />
          </div>
        </div>
      </div>

      {/* Fagulhas âmbar subindo */}
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={
            {
              left: `${e.x}%`,
              top: "64%",
              width: e.size,
              height: e.size,
              background: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#fbbf24" : accent,
              boxShadow: `0 0 8px 2px rgba(251,191,36,0.6)`,
              opacity: 0,
              animation: `scn-ember-rise ${e.dur}s ease-out ${0.45 + e.delay}s forwards`,
              "--scn-drift": `${e.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Faixa "CENÁRIO ATIVADO" */}
      <div className="absolute left-0 right-0 top-[13%] flex justify-center overflow-hidden">
        <div
          className="px-8 py-2"
          style={{
            background: `linear-gradient(to right, transparent, rgba(0,0,0,0.85) 18%, rgba(0,0,0,0.85) 82%, transparent)`,
            borderTop: "1px solid rgba(251,191,36,0.7)",
            borderBottom: "1px solid rgba(251,191,36,0.7)",
            animation: `scn-banner-sweep ${REVEAL_DURATION - 200}ms cubic-bezier(0.22,1,0.36,1) 380ms forwards`,
            opacity: 0,
          }}
        >
          <div
            className="text-center font-black text-amber-300"
            style={{
              fontSize: "clamp(16px, 3.4vmin, 26px)",
              letterSpacing: "0.25em",
              textShadow:
                "0 0 12px rgba(251,191,36,0.9), 0 0 30px rgba(251,191,36,0.5), 0 2px 4px rgba(0,0,0,0.9)",
              transform: "skewX(14deg)",
            }}
          >
            CENÁRIO ATIVADO
          </div>
        </div>
      </div>

      {/* Dono + nome da carta */}
      <div className="absolute left-0 right-0 bottom-[15%] flex flex-col items-center gap-1.5">
        <span
          className="font-bold uppercase"
          style={{
            color: accent,
            fontSize: "clamp(10px, 1.9vmin, 14px)",
            letterSpacing: "0.3em",
            textShadow: `0 0 10px ${accentSoft}, 0 2px 3px rgba(0,0,0,0.9)`,
            animation: `scn-text-in ${REVEAL_DURATION - 400}ms ease-out 500ms forwards`,
            opacity: 0,
          }}
        >
          {ownerText}
        </span>
        <span
          className="font-black text-white text-balance text-center px-6"
          style={{
            fontSize: "clamp(15px, 3vmin, 24px)",
            textShadow:
              "0 0 14px rgba(251,191,36,0.85), 0 0 34px rgba(251,191,36,0.45), 0 2px 4px rgba(0,0,0,0.95)",
            animation: `scn-name-in ${REVEAL_DURATION - 500}ms ease-out 620ms forwards`,
            opacity: 0,
          }}
        >
          {fx.card.name}
        </span>
      </div>
    </div>
  )
}
