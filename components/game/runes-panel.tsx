"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Check, Lock, Coins, Swords, Crown } from "lucide-react"
import { useGame } from "@/contexts/game-context"
import { PackOpeningOverlay } from "./pack-opening-overlay"
import { RuneNode } from "./rune-node"
import { elementToChestId, type Master } from "@/lib/masters-data"
import { CHESTS } from "@/lib/chests"
import { FRAGMENTS, type FragmentId } from "@/lib/fragments"
import {
  getRuneBranches,
  getRuneProgress,
  getRuneStatus,
  loadUnlockedRunes,
  saveUnlockedRunes,
  runeRewardIconPath,
  runeRewardColor,
  elementToFragmentId,
  type RuneBranchId,
  type RuneDef,
} from "@/lib/runes"

const PIXEL = "var(--font-pixel), 'Courier New', monospace"
const MONO  = "ui-monospace, 'Cascadia Mono', 'Roboto Mono', Menlo, monospace"

const BRANCH_ICON: Record<RuneBranchId, typeof Coins> = {
  fortuna: Coins,
  guerra:  Swords,
  dominio: Crown,
}

/** Cor de identidade de cada ramo — dá personalidade própria sem fugir da paleta. */
const BRANCH_TINT: Record<RuneBranchId, string> = {
  fortuna: "#f2a936",
  guerra:  "#f0705a",
  dominio: "#a78bfa",
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const

/** Glifos rúnicos decorativos que flutuam ao fundo do salão. */
const GLYPHS = ["ᚠ", "ᚱ", "ᚹ", "ᛉ", "ᛟ", "ᚨ", "ᛞ", "ᛗ"] as const

/** Pseudo-aleatório determinístico 0–1 — mesmo layout em todo render. */
function frand(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Fase da onda de cada ramo — cada rota serpenteia de um jeito próprio. */
const BRANCH_PHASE: Record<RuneBranchId, number> = {
  fortuna: 0.6,
  guerra:  2.5,
  dominio: 4.3,
}

interface RunesPanelProps {
  master:  Master
  onClose: () => void
}

/** Observa largura e altura de um elemento para dimensionar a rota. */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

// ─── Chip de recurso no cabeçalho ─────────────────────────────────────────────
function ResourceChip({ icon, label, value, color }: {
  icon: string; label: string; value: number; color: string
}) {
  return (
    <div title={label} style={{
      display: "flex", alignItems: "center", gap: 7,
      background: "#101016", border: "2px solid #2c2c36",
      borderBottomColor: "#0a0a0e", borderRightColor: "#0a0a0e",
      padding: "4px 10px 4px 6px",
    }}>
      <img
        src={icon || "/placeholder.svg"}
        alt=""
        width={18} height={18}
        style={{ width: 18, height: 18, objectFit: "contain", imageRendering: "pixelated" }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
      />
      <span style={{
        fontFamily: PIXEL, fontSize: 11, color,
        fontVariantNumeric: "tabular-nums",
      }}>{value.toLocaleString("pt-BR")}</span>
    </div>
  )
}

// ─── Overlay de celebração ────────────────────────────────────────────────────
function RuneUnlockOverlay({ rune, master, onClose }: {
  rune: RuneDef; master: Master; onClose: () => void
}) {
  const chestId = elementToChestId(master.element)
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 620, cursor: "pointer",
        background: "rgba(4,4,8,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "gpFadeIn 0.22s ease",
      }}>
      <div style={{
        position: "relative", textAlign: "center", maxWidth: 440, width: "100%",
        background: "#0d0d13",
        border: "2px solid #3c3c48",
        boxShadow: "4px 4px 0 rgba(0,0,0,0.55), inset 0 0 0 1px #17171f",
        borderRadius: 6,
        padding: "26px 22px 20px",
        animation: "gpLevelBounce 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Badge no topo */}
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          background: "#c0512c", color: "#ffe9d6",
          border: "2px solid #06060a",
          fontFamily: PIXEL, fontSize: 10, letterSpacing: "0.08em",
          padding: "3px 12px", whiteSpace: "nowrap",
        }}>RUNA DESBLOQUEADA</div>

        <div style={{
          margin: "8px auto 16px", width: 84, height: 84,
          borderRadius: "50%",
          background: `radial-gradient(circle at 36% 30%, #fff4cf 0%, #fff4cf 15%, ${master.accentColor} 15%, ${master.accentColor} 48%, rgba(0,0,0,0.6) 48%, rgba(0,0,0,0.6) 100%)`,
          border: "2px solid #06060a",
          boxShadow: `0 0 0 2px ${master.accentColor}55, 0 0 22px ${master.accentColor}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <img
            src={runeRewardIconPath(rune.rewards[0], chestId) || "/placeholder.svg"}
            alt="" width={38} height={38}
            style={{ width: 38, height: 38, objectFit: "contain", imageRendering: "pixelated" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        </div>

        <div style={{
          fontFamily: PIXEL, fontSize: 17, color: "#f4f2ea", lineHeight: 1.3,
        }}>{rune.name}</div>
        <p style={{ fontFamily: MONO, color: "#8b93a1", fontSize: 12, margin: "10px 0 18px", lineHeight: 1.6 }}>
          {rune.description}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {rune.rewards.map((rw, i) => {
            const color = runeRewardColor(rw.type, CHESTS[chestId].color)
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 11,
                background: "#14141b", border: "2px solid #26262f",
                padding: "9px 13px",
                animation: `gpRiseIn 0.35s ease ${0.08 + i * 0.08}s both`,
              }}>
                <img
                  src={runeRewardIconPath(rw, chestId) || "/placeholder.svg"}
                  alt="" width={26} height={26}
                  style={{ width: 26, height: 26, objectFit: "contain", imageRendering: "pixelated" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                />
                <span style={{ fontFamily: PIXEL, fontSize: 11.5, color }}>{rw.label}</span>
              </div>
            )
          })}
        </div>

        <div style={{
          fontFamily: PIXEL, color: "#565d6b", fontSize: 9.5, marginTop: 18,
          animation: "gpRuneBlink 1.2s steps(2, jump-none) infinite",
        }}>
          ▶ TOQUE PARA CONTINUAR
        </div>
      </div>
    </div>
  )
}

// ─── Painel principal ─────────────────────────────────────────────────────────
export function RunesPanel({ master, onClose }: RunesPanelProps) {
  const {
    coins, setCoins, gearCoins, setGearCoins,
    fragments, spendFragments,
    addChests, addSkipTickets, addStaminaBottles,
  } = useGame()

  const [unlocked,    setUnlocked]    = useState<string[]>([])
  const [hydrated,    setHydrated]    = useState(false)
  const [toast,       setToast]       = useState<string | null>(null)
  const [celebration, setCelebration] = useState<RuneDef | null>(null)
  const [pendingPack, setPendingPack] = useState<string | null>(null)
  const [packToOpen,  setPackToOpen]  = useState<string | null>(null)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)

  const branches    = useMemo(() => getRuneBranches(master), [master])
  const chestId     = elementToChestId(master.element)
  const elementalId = elementToFragmentId(master.element)
  const progress    = getRuneProgress(master, unlocked)

  const [tracksRef, tracksSize] = useElementSize<HTMLDivElement>()

  useEffect(() => {
    setUnlocked(loadUnlockedRunes()[master.id] ?? [])
    setHydrated(true)
  }, [master.id])

  const allRunes = useMemo(() => branches.flatMap(b => b.runes), [branches])

  // Seleciona automaticamente a runa mais relevante da rota
  useEffect(() => {
    if (!hydrated) return
    setSelectedId(prev => {
      if (prev && allRunes.some(r => r.id === prev)) return prev
      const next = allRunes.find(r => {
        const info = getRuneStatus({ rune: r, unlocked, level: master.currentLevel, gearCoins, fragments })
        return info.status === "available"
      }) ?? allRunes.find(r => !unlocked.includes(r.id)) ?? allRunes[0]
      return next?.id ?? null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, allRunes, unlocked])

  const selected = allRunes.find(r => r.id === selectedId) ?? null
  const selectedInfo = selected && hydrated
    ? getRuneStatus({ rune: selected, unlocked, level: master.currentLevel, gearCoins, fragments })
    : null

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  const handleUnlock = (rune: RuneDef) => {
    const info = getRuneStatus({
      rune, unlocked, level: master.currentLevel, gearCoins, fragments,
    })
    if (info.status !== "available") {
      showToast(info.reason || "Runa indisponível")
      return
    }

    // Debita fragmentos primeiro — a operação é atômica e falha sem consumir nada
    if (!spendFragments(rune.cost.fragments)) {
      showToast("Fragmentos insuficientes")
      return
    }

    // Soma o que a runa entrega e desconta o custo em Gear Coins numa só passada
    let gearDelta = -rune.cost.gearCoins
    let gachaGain = 0
    let chestGain = 0
    let skipGain  = 0
    let bottleGain = 0
    let packId: string | null = null

    for (const rw of rune.rewards) {
      if (rw.type === "gear_coins"     && rw.amount) gearDelta  += rw.amount
      else if (rw.type === "gacha_coins"    && rw.amount) gachaGain  += rw.amount
      else if (rw.type === "chest"          && rw.amount) chestGain  += rw.amount
      else if (rw.type === "skip_ticket"    && rw.amount) skipGain   += rw.amount
      else if (rw.type === "stamina_bottle" && rw.amount) bottleGain += rw.amount
      else if (rw.type === "pack" && rw.packId) packId = rw.packId
    }

    setGearCoins(prev => Math.max(0, prev + gearDelta))
    if (gachaGain) {
      const newTotal = coins + gachaGain
      setCoins(newTotal)
      try { localStorage.setItem("gearperks-coins", String(newTotal)) } catch { /* ignore */ }
    }
    if (chestGain)  addChests({ [chestId]: chestGain })
    if (skipGain)   addSkipTickets(skipGain)
    if (bottleGain) addStaminaBottles(bottleGain)

    const next = [...unlocked, rune.id]
    setUnlocked(next)
    const all = loadUnlockedRunes()
    saveUnlockedRunes({ ...all, [master.id]: next })
    // Avisa a tela de Mestres para atualizar o contador de runas
    window.dispatchEvent(new CustomEvent("gpgame_runes_changed", { detail: { masterId: master.id } }))

    setPendingPack(packId)
    setCelebration(rune)
  }

  const closeCelebration = () => {
    setCelebration(null)
    if (pendingPack) {
      setPackToOpen(pendingPack)
      setPendingPack(null)
    }
  }

  // ── Geometria responsiva: mapa de rotas — TODAS as runas visíveis ───────────
  // Cada ramo é uma ROTA que serpenteia horizontalmente pela sua banda do mapa,
  // com posições orgânicas (onda + jitter determinístico) como num skill map.
  const RUNES_N = branches[0]?.runes.length ?? 10
  const PAD_X = Math.max(18, Math.round(tracksSize.w * 0.025))
  const mapW  = Math.max(0, tracksSize.w - PAD_X * 2)
  const slot  = mapW > 0 ? mapW / RUNES_N : 0
  const bandH = tracksSize.h > 0 ? tracksSize.h / 3 : 0
  const sizeFromW = slot > 0 ? slot - 14 : 48
  const sizeFromH = bandH > 0 ? bandH * 0.42 : 48
  const NODE = Math.max(30, Math.min(58, Math.floor(Math.min(sizeFromW, sizeFromH))))
  const PED  = Math.round(NODE * 0.42)
  // Amplitude do serpentear vertical dentro da banda
  const AMP  = Math.max(8, Math.round(bandH * 0.17))
  const ready = tracksSize.w > 0 && tracksSize.h > 0

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "#0e0e13",
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "gpFadeIn 0.25s ease",
    }}>
      <style>{`
        @keyframes gpRuneGlowPulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @keyframes gpRuneBlink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }
        @keyframes gpRunePathFlow {
          0%   { background-position: 0 0; }
          100% { background-position: 24px 0; }
        }
        @keyframes gpRuneFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes gpGlyphDrift {
          0%   { transform: translateY(12px) rotate(-4deg); opacity: 0; }
          12%  { opacity: var(--glyph-op, 0.2); }
          88%  { opacity: var(--glyph-op, 0.2); }
          100% { transform: translateY(-46px) rotate(5deg); opacity: 0; }
        }
        @keyframes gpAuraBreathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.06); }
        }
        @keyframes gpRingSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes gpRingSpinRev {
          from { transform: rotate(360deg); }
          to   { transform: rotate(0deg); }
        }
        @keyframes gpStarTwinkle {
          0%, 100% { opacity: var(--star-op, 0.5); }
          50%      { opacity: 0.08; }
        }
        .gp-rune-node:hover { filter: brightness(1.12); }
        .gp-rune-node:focus-visible { outline: 2px solid #f7f4ee; outline-offset: 6px; }
        .gp-rune-cta:active { transform: translateY(2px); box-shadow: 0 1px 0 #0b3f2d !important; }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gpRuneGlowPulse { from { opacity: 0.8 } to { opacity: 0.8 } }
          @keyframes gpRuneBlink     { from { opacity: 1 }   to { opacity: 1 } }
          @keyframes gpRunePathFlow  { from { background-position: 0 0 } to { background-position: 0 0 } }
          @keyframes gpRuneFloat     { from { transform: none } to { transform: none } }
          @keyframes gpGlyphDrift    { from { opacity: 0.15; transform: none } to { opacity: 0.15; transform: none } }
          @keyframes gpAuraBreathe   { from { opacity: 0.7; transform: none } to { opacity: 0.7; transform: none } }
          @keyframes gpRingSpin      { from { transform: none } to { transform: none } }
          @keyframes gpRingSpinRev   { from { transform: none } to { transform: none } }
          @keyframes gpStarTwinkle   { from { opacity: 0.4 } to { opacity: 0.4 } }
        }
      `}</style>

      {/* Fundo: céu arcano profundo + círculo de invocação + estrelas + glifos */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Céu profundo com nebulosas na cor do mestre */}
        <div style={{
          position: "absolute", inset: 0,
          background: [
            `radial-gradient(ellipse 110% 80% at 50% 118%, ${master.accentColor}1c 0%, transparent 55%)`,
            `radial-gradient(ellipse 75% 60% at 8% -12%, #1d1d38 0%, transparent 58%)`,
            `radial-gradient(ellipse 65% 55% at 94% 4%, ${master.accentColor}12 0%, transparent 60%)`,
            "linear-gradient(180deg, #0c0c18 0%, #08080f 52%, #0a0a14 100%)",
          ].join(", "),
        }}/>

        {/* Estrelas cintilando */}
        {Array.from({ length: 34 }, (_, i) => {
          const sz = 1 + Math.round(frand(i * 3.7) * 2)
          return (
            <span key={`star-${i}`} style={{
              position: "absolute",
              left: `${frand(i * 1.3 + 5) * 98}%`,
              top: `${frand(i * 2.9 + 11) * 96}%`,
              width: sz, height: sz, borderRadius: "50%",
              background: i % 5 === 0 ? master.accentColor : "#cdd3e6",
              boxShadow: i % 5 === 0 ? `0 0 6px ${master.accentColor}` : "0 0 4px rgba(205,211,230,0.7)",
              // @ts-expect-error — custom property
              "--star-op": 0.25 + frand(i * 7.1) * 0.55,
              animation: `gpStarTwinkle ${2.4 + frand(i * 4.3) * 3.6}s ease-in-out ${frand(i * 9.7) * 4}s infinite`,
            }}/>
          )
        })}

        {/* Círculo de invocação gigante no coração do mapa */}
        <div style={{
          position: "absolute", left: "50%", top: "52%",
          width: "min(88vh, 62vw)", aspectRatio: "1",
          transform: "translate(-50%, -50%)",
        }}>
          {/* Anel externo tracejado girando */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px dashed ${master.accentColor}30`,
            animation: "gpRingSpin 90s linear infinite",
          }}/>
          {/* Anel fino intermediário */}
          <div style={{
            position: "absolute", inset: "8%", borderRadius: "50%",
            border: `1px solid ${master.accentColor}20`,
            boxShadow: `inset 0 0 60px ${master.accentColor}0d`,
          }}/>
          {/* Anel pontilhado interno girando ao contrário */}
          <div style={{
            position: "absolute", inset: "21%", borderRadius: "50%",
            border: `2px dotted ${master.accentColor}28`,
            animation: "gpRingSpinRev 130s linear infinite",
          }}/>
          {/* Núcleo de energia respirando */}
          <div style={{
            position: "absolute", inset: "34%", borderRadius: "50%",
            background: `radial-gradient(circle, ${master.accentColor}26 0%, ${master.accentColor}0c 45%, transparent 70%)`,
            animation: "gpAuraBreathe 6s ease-in-out infinite",
          }}/>
          {/* Glifos orbitando o círculo */}
          <div style={{ position: "absolute", inset: "10%", animation: "gpRingSpin 160s linear infinite" }}>
            {GLYPHS.map((g, i) => {
              const a = (i / GLYPHS.length) * Math.PI * 2
              return (
                <span key={`orbit-${i}`} style={{
                  position: "absolute",
                  left: `${50 + 48 * Math.cos(a)}%`,
                  top: `${50 + 48 * Math.sin(a)}%`,
                  transform: "translate(-50%, -50%)",
                  fontFamily: MONO, fontSize: 18,
                  color: `${master.accentColor}66`,
                  textShadow: `0 0 12px ${master.accentColor}55`,
                }}>{g}</span>
              )
            })}
          </div>
        </div>

        {/* Névoa colorida do mestre subindo do horizonte */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 90% 55% at 50% 0%, ${master.accentColor}1a 0%, transparent 60%)`,
        }}/>
        {/* Vinheta: escurece as bordas para o mapa não competir com a UI */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 88% 78% at 50% 44%, transparent 30%, rgba(4,4,9,0.9) 100%)",
        }}/>
        {/* Glifos rúnicos flutuando como brasas */}
        {GLYPHS.map((g, i) => (
          <span key={i} style={{
            position: "absolute",
            left: `${6 + (i * 12.3) % 90}%`,
            top: `${14 + (i * 23) % 68}%`,
            fontFamily: MONO,
            fontSize: 15 + (i % 3) * 7,
            color: i % 2 === 0 ? master.accentColor : BRANCH_TINT[(["fortuna","guerra","dominio"] as const)[i % 3]],
            opacity: 0,
            // @ts-expect-error — custom property
            "--glyph-op": 0.12 + (i % 3) * 0.05,
            animation: `gpGlyphDrift ${7 + (i % 4) * 2.4}s linear ${i * 1.15}s infinite`,
            textShadow: `0 0 12px ${master.accentColor}66`,
          }}>{g}</span>
        ))}
      </div>

      {toast && (
        <div role="status" style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 700,
          background: "#101016", border: "2px solid #3c3c48",
          boxShadow: "3px 3px 0 rgba(0,0,0,0.5)",
          padding: "9px 18px", color: "#f0ede6",
          fontFamily: PIXEL, fontSize: 11,
          maxWidth: "90vw", textAlign: "center", animation: "gpToastIn 0.25s ease",
        }}>
          {toast}
        </div>
      )}

      {celebration && (
        <RuneUnlockOverlay rune={celebration} master={master} onClose={closeCelebration}/>
      )}

      {packToOpen && (
        <PackOpeningOverlay packId={packToOpen} onClose={() => setPackToOpen(null)}/>
      )}

      {/* ── Cabeçalho ── */}
      <header style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "8px 16px", borderBottom: `2px solid ${master.accentColor}33`,
        background: `linear-gradient(180deg, #0b0b10 0%, #0b0b10 70%, ${master.accentColor}0a 100%)`,
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        position: "relative", zIndex: 5, flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label="Voltar" style={{
          background: "#16161d", border: "2px solid #2e2e38",
          borderBottomColor: "#0a0a0e", borderRightColor: "#0a0a0e",
          width: 34, height: 34, cursor: "pointer", color: "#9aa1ad",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}><ArrowLeft size={16}/></button>

        <div style={{
          width: 36, height: 36, overflow: "hidden", flexShrink: 0,
          border: `2px solid ${master.accentColor}`,
          background: "#101016",
          boxShadow: `0 0 12px ${master.accentColor}55`,
        }}>
          <img src={master.iconPath || "/placeholder.svg"} alt={master.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
        </div>

        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontFamily: PIXEL, fontSize: 12.5, color: "#f5f2ec",
            margin: 0, whiteSpace: "nowrap", letterSpacing: "0.02em",
            textShadow: `0 0 14px ${master.accentColor}66`,
          }}>ROTA DE RUNAS · {master.name.toUpperCase()}</h1>
          <div style={{
            fontFamily: MONO, fontSize: 10, color: "#6d7482", marginTop: 2,
          }}>
            {progress.done}/{progress.total} runas — Mestre nível {master.currentLevel}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 12 }}/>

        {/* Progresso da rota compacto, no próprio cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 130 }}>
          <div style={{
            display: "flex", gap: 2, padding: 2, flex: 1, minWidth: 90,
            background: "#08080d", border: "2px solid #2c2c36",
            borderBottomColor: "#3a3a46", borderRightColor: "#3a3a46",
            boxShadow: progress.done > 0 ? `0 0 10px ${master.accentColor}22` : "none",
          }}>
            {Array.from({ length: 10 }, (_, i) => {
              const filled = progress.pct >= (i + 1) * 10 - 0.01
              return (
                <div key={i} style={{
                  flex: 1, height: 8,
                  background: filled
                    ? `linear-gradient(180deg, #ffe9b0 0%, #ffe9b0 30%, ${master.accentColor} 30%, ${master.accentColor} 100%)`
                    : "linear-gradient(180deg, #16161d 0%, #1e1e26 100%)",
                  boxShadow: filled ? `0 0 5px ${master.accentColor}66` : "none",
                }}/>
              )
            })}
          </div>
          <span style={{
            fontFamily: PIXEL, fontSize: 10, color: master.accentColor,
            fontVariantNumeric: "tabular-nums", flexShrink: 0,
          }}>{Math.round(progress.pct)}%</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <ResourceChip icon="/images/gear-coin.png" label="Gear Coins" value={gearCoins} color="#f2c14e"/>
          <ResourceChip
            icon={FRAGMENTS[elementalId].image}
            label={FRAGMENTS[elementalId].name}
            value={fragments[elementalId] ?? 0}
            color={FRAGMENTS[elementalId].color}
          />
          {elementalId !== "galio" && (
            <ResourceChip
              icon={FRAGMENTS.galio.image}
              label={FRAGMENTS.galio.name}
              value={fragments.galio ?? 0}
              color={FRAGMENTS.galio.color}
            />
          )}
        </div>
      </header>

      {/* ── Mapa de rotas: 3 rotas serpenteando pelo mapa, todas as 30 runas ── */}
      <div
        ref={tracksRef}
        style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 4 }}
      >
        {ready && branches.map((branch, bIdx) => {
          const BranchIcon     = BRANCH_ICON[branch.id]
          const tint           = BRANCH_TINT[branch.id]
          const branchDone     = branch.runes.filter(r => unlocked.includes(r.id)).length
          const branchComplete = branchDone === branch.runes.length
          const statusById = new Map(branch.runes.map(r => [
            r.id,
            hydrated
              ? getRuneStatus({ rune: r, unlocked, level: master.currentLevel, gearCoins, fragments }).status
              : ("locked_prev" as const),
          ]))

          // Posições orgânicas da rota: onda senoidal + jitter determinístico,
          // com o centro do orbe sempre dentro da banda do ramo.
          const phase   = BRANCH_PHASE[branch.id]
          const bandTop = bandH * bIdx
          const minY    = bandTop + NODE / 2 + 14
          const maxY    = bandTop + bandH - PED - NODE / 2 - 16
          const pts = branch.runes.map((_, i) => {
            const wob = Math.sin(i * 1.12 + phase) * AMP
              + (frand(i * 3.1 + bIdx * 17 + 1) - 0.5) * AMP * 0.9
            const x = PAD_X + slot * i + slot / 2
              + (frand(i * 7.3 + bIdx * 29 + 2) - 0.5) * slot * 0.26
            const y = Math.max(minY, Math.min(maxY, bandTop + bandH * 0.47 + wob))
            return { x, y }
          })

          return (
            <div key={branch.id} style={{
              position: "absolute", inset: 0,
              animation: `gpRiseIn 0.4s ease ${bIdx * 0.08}s both`,
            }}>
              {/* Estandarte flutuante do ramo, ancorado no início da rota */}
              <div style={{
                position: "absolute", left: 10, top: bandTop + 6,
                display: "inline-flex", alignItems: "center", gap: 7,
                background: `linear-gradient(135deg, ${tint}1c 0%, rgba(10,10,16,0.85) 70%)`,
                border: "2px solid #23232c",
                borderLeft: `3px solid ${tint}aa`,
                borderRadius: 5,
                padding: "4px 9px 4px 6px",
                boxShadow: `inset 0 0 16px ${tint}0e, 0 4px 12px rgba(0,0,0,0.4)`,
                zIndex: 2,
              }}>
                <div style={{
                  width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(180deg, ${tint}22, #14141b)`,
                  border: `2px solid ${tint}88`,
                  boxShadow: `0 0 8px ${tint}44`, flexShrink: 0,
                }}>
                  <BranchIcon size={11} color={tint}/>
                </div>
                <span style={{
                  fontFamily: PIXEL, fontSize: 9.5, color: "#f3f0ea",
                  textShadow: `0 0 10px ${tint}66`, whiteSpace: "nowrap",
                }}>{branch.name.toUpperCase()}</span>
                <span style={{
                  fontFamily: PIXEL, fontSize: 8.5,
                  color: branchComplete ? "#4ecf9d" : tint,
                  fontVariantNumeric: "tabular-nums",
                  display: "inline-flex", alignItems: "center", gap: 3,
                  background: "#0d0d13", border: `2px solid ${branchComplete ? "#1d7d5c" : `${tint}44`}`,
                  padding: "0px 5px",
                }}>
                  {branchComplete && <Check size={9} strokeWidth={3}/>}
                  {branchDone}/{branch.runes.length}
                </span>
              </div>

              {/* Linhas de energia conectando os orbes */}
              {branch.runes.slice(0, -1).map((rune, i) => {
                const a = pts[i]
                const b = pts[i + 1]
                const dx  = b.x - a.x
                const dy  = b.y - a.y
                const len = Math.max(4, Math.sqrt(dx * dx + dy * dy))
                const ang = (Math.atan2(dy, dx) * 180) / Math.PI
                const lit  = statusById.get(rune.id) === "unlocked"
                const next = statusById.get(branch.runes[i + 1].id) === "available"
                return (
                  <div
                    key={`path-${rune.id}`}
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: a.x, top: a.y,
                      width: len, height: 5, marginTop: -2.5,
                      transform: `rotate(${ang}deg)`,
                      transformOrigin: "0 50%",
                      borderRadius: 3,
                      background: lit
                        ? `linear-gradient(90deg, ${tint}00 0%, ${tint} 16%, #fff6d8 50%, ${tint} 84%, ${tint}00 100%)`
                        : "linear-gradient(90deg, transparent 0%, #33343f 16%, #454654 50%, #33343f 84%, transparent 100%)",
                      boxShadow: lit ? `0 0 10px ${tint}88` : "none",
                      opacity: lit ? 0.95 : 0.55,
                      overflow: "hidden",
                    }}
                  >
                    {/* Pulso de energia correndo até a próxima runa disponível */}
                    {lit && next && (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0 7px, transparent 7px 18px)",
                        animation: "gpRunePathFlow 1.1s linear infinite",
                        mixBlendMode: "screen",
                      }}/>
                    )}
                  </div>
                )
              })}

              {/* Nós da rota */}
              {branch.runes.map((rune, i) => {
                const status      = statusById.get(rune.id) ?? "locked_prev"
                const isDone      = status === "unlocked"
                const isAvailable = status === "available"
                const isLocked    = !isDone && !isAvailable
                const isSelected  = selectedId === rune.id
                const iconSize    = Math.round(NODE * 0.44)
                const sealSize    = Math.max(13, Math.round(NODE * 0.26))

                return (
                  <div
                    key={rune.id}
                    style={{
                      position: "absolute",
                      left: pts[i].x,
                      top: pts[i].y - NODE / 2,
                      transform: "translateX(-50%)",
                      zIndex: isSelected ? 3 : 1,
                    }}
                  >
                    <RuneNode
                      size={NODE}
                      tint={isDone ? "#4ecf9d" : tint}
                      tintStrength={isLocked ? 0.4 : 1}
                      selected={isSelected}
                      dim={isLocked}
                      float={isAvailable}
                      label={`${rune.name} — ${isDone ? "gravada" : isAvailable ? "disponível" : "bloqueada"}`}
                      onClick={() => setSelectedId(rune.id)}
                    >
                      <img
                        src={runeRewardIconPath(rune.rewards[0], chestId) || "/placeholder.svg"}
                        alt="" width={iconSize} height={iconSize}
                        style={{
                          width: iconSize, height: iconSize, objectFit: "contain",
                          imageRendering: "pixelated",
                          filter: isLocked ? "grayscale(1) brightness(0.8)" : "drop-shadow(0 2px 0 rgba(0,0,0,0.5))",
                        }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    </RuneNode>

                    {/* Selo de estado no canto do orbe */}
                    {(isDone || isLocked) && (
                      <div aria-hidden="true" style={{
                        position: "absolute", right: -3, top: NODE - sealSize,
                        width: sealSize, height: sealSize,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isDone ? "#166b50" : "#16161d",
                        border: "2px solid #06060a",
                      }}>
                        {isDone
                          ? <Check size={Math.round(sealSize * 0.55)} strokeWidth={3} color="#d8fff0"/>
                          : <Lock size={Math.round(sealSize * 0.5)} color="#6d7482"/>}
                      </div>
                    )}

                    {/* Tier em algarismo romano sob o pedestal */}
                    <div style={{
                      position: "absolute", top: NODE + PED + 2, left: "50%", transform: "translateX(-50%)",
                      fontFamily: PIXEL, fontSize: Math.max(7.5, NODE * 0.16),
                      color: isSelected ? tint : isLocked ? "#5b6270" : "#9aa1ad",
                      textShadow: isSelected ? `0 0 8px ${tint}88` : "0 2px 0 rgba(0,0,0,0.7)",
                      whiteSpace: "nowrap",
                    }}>
                      {ROMAN[rune.tier - 1] ?? rune.tier}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── Painel de detalhe da runa selecionada — fixo na base ── */}
      {selected && selectedInfo && (() => {
        const tint  = BRANCH_TINT[selected.branchId]
        const done  = selectedInfo.status === "unlocked"
        const avail = selectedInfo.status === "available"
        const stateColor = done ? "#4ecf9d" : avail ? tint : "#7b8290"
        const stateLabel = done ? "GRAVADA" : avail ? "DISPONÍVEL" : "BLOQUEADA"
        const badgeBg    = done ? "#1d7d5c" : avail ? "#c0512c" : "#33333d"
        const badgeFg    = done ? "#d8fff0" : avail ? "#ffe9d6" : "#9aa1ad"
        const selBranch  = branches.find(b => b.id === selected.branchId)
        const branchName = selBranch?.name ?? ""
        const branchSize = selBranch?.runes.length ?? 10

        return (
          <div style={{
            position: "relative", zIndex: 6, flexShrink: 0,
            padding: "12px 14px 12px",
            background: "linear-gradient(0deg, rgba(8,8,13,0.97) 70%, rgba(8,8,13,0))",
          }}>
            <div style={{
              position: "relative", maxWidth: 980, margin: "0 auto",
              background: "rgba(11,11,17,0.97)",
              border: `2px solid ${done || avail ? `${tint}55` : "#34343f"}`,
              borderLeft: `4px solid ${stateColor}`,
              boxShadow: `4px 4px 0 rgba(0,0,0,0.5), inset 0 0 0 1px #17171f${avail ? `, 0 0 24px ${tint}22` : ""}`,
              borderRadius: 6,
              padding: "14px 14px 12px",
            }}>
              {/* Badge de estado sobre a borda */}
              <div style={{
                position: "absolute", top: -12, left: 12,
                display: "inline-flex", alignItems: "center", gap: 6,
                background: badgeBg, color: badgeFg,
                border: "2px solid #06060a",
                padding: "2px 10px",
                fontFamily: PIXEL, fontSize: 10, letterSpacing: "0.06em",
              }}>
                {done ? <Check size={10} strokeWidth={3}/> : !avail ? <Lock size={9}/> : null}
                {stateLabel}
              </div>

              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* Orbe da recompensa principal + nível */}
                <div style={{ flexShrink: 0, textAlign: "center", paddingTop: 2 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%", position: "relative",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: done || avail
                      ? `radial-gradient(circle at 36% 30%, #fff4cf 0%, #fff4cf 16%, ${tint} 16%, ${tint} 50%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.55) 100%)`
                      : "radial-gradient(circle at 36% 30%, #8f9099 0%, #8f9099 16%, #585a64 16%, #585a64 50%, #232429 50%, #232429 100%)",
                    border: "2px solid #06060a",
                    boxShadow: done || avail ? `0 0 0 2px ${tint}55, 0 0 14px ${tint}55` : "none",
                  }}>
                    <img
                      src={runeRewardIconPath(selected.rewards[0], chestId) || "/placeholder.svg"}
                      alt="" width={26} height={26}
                      style={{ width: 26, height: 26, objectFit: "contain", imageRendering: "pixelated" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                    />
                  </div>
                  <div style={{
                    marginTop: 5, fontFamily: PIXEL, fontSize: 9, color: "#cfcbc3",
                  }}>Nv. {selected.tier}/{branchSize}</div>
                </div>

                <div style={{ flex: 1, minWidth: 220 }}>
                  {/* Título + ramo */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 13, color: "#f6f3ed", lineHeight: 1.3,
                    }}>{selected.name}</span>
                    <div style={{ flex: 1, minWidth: 8 }}/>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 9, color: tint,
                    }}>{branchName.toUpperCase()}</span>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 9,
                      color: master.currentLevel >= selected.requiredLevel ? "#4ecf9d" : "#f0a97a",
                      border: `2px solid ${master.currentLevel >= selected.requiredLevel ? "#1d7d5c" : "#8a5a34"}`,
                      background: "#101016",
                      padding: "1px 6px",
                    }}>Lv.{selected.requiredLevel}</span>
                  </div>

                  <p style={{
                    margin: "6px 0 0", fontFamily: MONO, fontSize: 11, color: "#8b93a1",
                    lineHeight: 1.5,
                  }}>{selected.description}</p>

                  {/* Recompensas + custo numa faixa única e compacta */}
                  <div style={{
                    marginTop: 10,
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
                  }}>
                    {selected.rewards.map((rw, i) => {
                      const c = runeRewardColor(rw.type, CHESTS[chestId].color)
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "#14141b", border: "2px solid #26262f",
                          borderBottomColor: "#0c0c11", borderRightColor: "#0c0c11",
                          padding: "3px 8px 3px 5px",
                        }}>
                          <img
                            src={runeRewardIconPath(rw, chestId) || "/placeholder.svg"}
                            alt="" width={16} height={16}
                            style={{ width: 16, height: 16, objectFit: "contain", imageRendering: "pixelated" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                          />
                          <span style={{ fontFamily: PIXEL, fontSize: 9.5, color: c }}>{rw.label}</span>
                        </div>
                      )
                    })}

                    {!done && (
                      <>
                        <span aria-hidden="true" style={{
                          width: 2, height: 18, background: "#26262f", margin: "0 2px", flexShrink: 0,
                        }}/>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <img src="/images/gear-coin.png" alt="" width={15} height={15}
                            style={{ width: 15, height: 15, objectFit: "contain", imageRendering: "pixelated" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                          <span style={{
                            fontFamily: PIXEL, fontSize: 10.5, fontVariantNumeric: "tabular-nums",
                            color: gearCoins >= selected.cost.gearCoins ? "#f2c14e" : "#f87171",
                          }}>{selected.cost.gearCoins.toLocaleString("pt-BR")}</span>
                        </div>
                        {(Object.entries(selected.cost.fragments) as [FragmentId, number][]).map(([fid, amount]) => {
                          const have = fragments[fid] ?? 0
                          return (
                            <div key={fid} title={FRAGMENTS[fid].name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <img src={FRAGMENTS[fid].image || "/placeholder.svg"} alt="" width={15} height={15}
                                style={{ width: 15, height: 15, objectFit: "contain", imageRendering: "pixelated" }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                              <span style={{
                                fontFamily: PIXEL, fontSize: 10.5, fontVariantNumeric: "tabular-nums",
                                color: have >= amount ? FRAGMENTS[fid].color : "#f87171",
                              }}>{amount}</span>
                            </div>
                          )
                        })}
                      </>
                    )}

                    <div style={{ flex: 1, minWidth: 8 }}/>

                    {!done && (avail ? (
                      <button
                        onClick={() => handleUnlock(selected)}
                        className="gp-rune-cta"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          background: "#46c295",
                          border: "2px solid #0b3f2d",
                          borderRadius: 3,
                          padding: "7px 14px", cursor: "pointer", color: "#06281c",
                          fontFamily: PIXEL, fontSize: 10.5,
                          boxShadow: "0 3px 0 #0b3f2d",
                          transition: "transform 0.06s, box-shadow 0.06s",
                        }}>
                        GRAVAR RUNA
                      </button>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        color: "#8b93a1", fontFamily: MONO, fontSize: 10.5,
                      }}><Lock size={11}/> {selectedInfo.reason}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default RunesPanel
