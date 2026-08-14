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
  fortuna: "#ffc531",
  guerra:  "#ff6a4d",
  dominio: "#b78bff",
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const

/** Glifos rúnicos decorativos que flutuam ao fundo do salão. */
const GLYPHS = ["ᚠ", "ᚱ", "ᚹ", "ᛉ", "ᛟ", "ᚨ", "ᛞ", "ᛗ"] as const

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
      background: "rgba(6,22,58,0.85)", border: "2px solid #2f5da8",
      borderRadius: 5,
      boxShadow: "inset 0 0 8px rgba(90,170,255,0.18)",
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
        background: "radial-gradient(ellipse at 50% 40%, rgba(10,42,107,0.94) 0%, rgba(3,10,32,0.96) 70%)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "gpFadeIn 0.22s ease",
      }}>
      <div style={{
        position: "relative", textAlign: "center", maxWidth: 440, width: "100%",
        background: "linear-gradient(180deg, #0a2a6b 0%, #071e4e 100%)",
        border: "2px solid #4d92e8",
        boxShadow: "0 12px 36px rgba(2,8,28,0.7), inset 0 1px 0 rgba(150,210,255,0.4), 0 0 40px rgba(70,150,255,0.3)",
        borderRadius: 12,
        padding: "26px 22px 20px",
        animation: "gpLevelBounce 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Badge no topo */}
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          background: "linear-gradient(180deg, #2a9df0, #0b78d0)", color: "#ffffff",
          border: "2px solid #ffffff",
          borderRadius: 6,
          boxShadow: "0 0 14px rgba(70,170,255,0.7)",
          fontFamily: PIXEL, fontSize: 10, letterSpacing: "0.08em",
          padding: "3px 12px", whiteSpace: "nowrap",
        }}>RUNA DESBLOQUEADA</div>

        <div style={{
          margin: "8px auto 16px", width: 84, height: 84,
          borderRadius: "50%",
          background: `radial-gradient(circle at 34% 28%, #ffffff 0%, ${master.accentColor} 40%, ${master.accentColor} 58%, rgba(6,20,56,0.85) 100%)`,
          border: "2px solid #ffffff",
          boxShadow: `0 0 0 3px ${master.accentColor}66, 0 0 30px ${master.accentColor}aa`,
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
          fontFamily: PIXEL, fontSize: 17, color: "#ffffff", lineHeight: 1.3,
          textShadow: "0 0 14px rgba(90,180,255,0.7)",
        }}>{rune.name}</div>
        <p style={{ fontFamily: MONO, color: "#9fc6f5", fontSize: 12, margin: "10px 0 18px", lineHeight: 1.6 }}>
          {rune.description}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {rune.rewards.map((rw, i) => {
            const color = runeRewardColor(rw.type, CHESTS[chestId].color)
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 11,
                background: "rgba(5,18,50,0.85)", border: "2px solid #2f5da8",
                borderRadius: 7,
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
          fontFamily: PIXEL, color: "#6f9fd8", fontSize: 9.5, marginTop: 18,
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

  // ── Geometria responsiva: TODAS as runas visíveis, sem rolagem ──────────────
  // Cada ramo é uma trilha HORIZONTAL de 10 runas. O tamanho do orbe é derivado
  // do espaço real disponível (largura ÷ 10 slots; altura ÷ 3 trilhas).
  const RUNES_N = branches[0]?.runes.length ?? 10
  const labelW = Math.min(150, Math.max(86, tracksSize.w * 0.16))
  const trackW = Math.max(0, tracksSize.w - labelW - 18)
  const slot   = trackW > 0 ? trackW / RUNES_N : 0
  // Altura de cada seção de ramo: (altura total − gaps) / 3
  const perBranchH = tracksSize.h > 0 ? (tracksSize.h - 2 * 10) / 3 : 0
  const sizeFromW  = slot > 0 ? slot - 12 : 48
  // trilha ocupa: zig(0.22s) + orbe(s) + selo/tier(18)
  const sizeFromH  = perBranchH > 0 ? (perBranchH - 26) / 1.26 : 48
  const NODE = Math.max(30, Math.min(62, Math.floor(Math.min(sizeFromW, sizeFromH))))
  const ZIG  = Math.round(NODE * 0.22)
  const trackH = ZIG + NODE + 18
  const ready  = tracksSize.w > 0 && tracksSize.h > 0

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "#06122e",
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
          100% { background-position: 28px 0; }
        }
        @keyframes gpRuneFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes gpRuneFlarePulse {
          0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.94); }
          50%      { opacity: 1;   transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes gpRuneSelRing {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(1.08); }
        }
        @keyframes gpRuneSelSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes gpSparkleTwinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.7); }
          50%      { opacity: var(--spark-op, 0.8); transform: scale(1.15); }
        }
        @keyframes gpAuraBreathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.06); }
        }
        .gp-rune-node:hover { filter: brightness(1.15); }
        .gp-rune-node:focus-visible { outline: 2px solid #ffffff; outline-offset: 6px; border-radius: 50%; }
        .gp-rune-cta:active { transform: translateY(2px); box-shadow: 0 1px 0 #0b3f2d !important; }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gpRuneGlowPulse   { from { opacity: 0.8 } to { opacity: 0.8 } }
          @keyframes gpRuneBlink       { from { opacity: 1 }   to { opacity: 1 } }
          @keyframes gpRunePathFlow    { from { background-position: 0 0 } to { background-position: 0 0 } }
          @keyframes gpRuneFloat       { from { transform: none } to { transform: none } }
          @keyframes gpRuneFlarePulse  { from { opacity: 0.85; transform: translate(-50%, -50%) } to { opacity: 0.85; transform: translate(-50%, -50%) } }
          @keyframes gpRuneSelRing     { from { opacity: 1; transform: none } to { opacity: 1; transform: none } }
          @keyframes gpRuneSelSpin     { from { transform: none } to { transform: none } }
          @keyframes gpSparkleTwinkle  { from { opacity: 0.4; transform: none } to { opacity: 0.4; transform: none } }
          @keyframes gpAuraBreathe     { from { opacity: 0.7; transform: none } to { opacity: 0.7; transform: none } }
        }
      `}</style>

      {/* Fundo: cosmos azul com bola de energia + aura do mestre + fagulhas de luz */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <img
          src="/images/runes-board-bg.png"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Névoa colorida do mestre subindo do horizonte */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 90% 55% at 50% 0%, ${master.accentColor}30 0%, transparent 60%)`,
          mixBlendMode: "screen",
        }}/>
        {/* Aura viva no coração do tabuleiro */}
        <div style={{
          position: "absolute", left: "50%", top: "46%",
          width: "72%", height: "58%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(ellipse, ${master.accentColor}22 0%, transparent 65%)`,
          animation: "gpAuraBreathe 5.5s ease-in-out infinite",
          mixBlendMode: "screen",
        }}/>
        {/* Vinheta azul profunda para a UI respirar nas bordas */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 85% 75% at 50% 42%, transparent 30%, rgba(3,10,32,0.82) 100%)",
        }}/>
        {/* Fagulhas de luz cintilando (estrelas de energia) */}
        {GLYPHS.map((_, i) => {
          const s = 3 + (i % 3) * 2
          return (
            <span key={i} style={{
              position: "absolute",
              left: `${6 + (i * 12.3) % 90}%`,
              top: `${10 + (i * 23) % 74}%`,
              width: s, height: s,
              background: "#ffffff",
              borderRadius: "50%",
              boxShadow: `0 0 ${6 + s}px ${i % 2 === 0 ? "#9fd8ff" : "#ffffff"}`,
              opacity: 0,
              // @ts-expect-error — custom property
              "--spark-op": 0.5 + (i % 3) * 0.2,
              animation: `gpSparkleTwinkle ${2.2 + (i % 4) * 1.1}s ease-in-out ${i * 0.6}s infinite`,
            }}/>
          )
        })}
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
        padding: "8px 16px", borderBottom: "2px solid #3a76d8",
        background: "linear-gradient(180deg, #0a2a6b 0%, #082252 60%, #061a42 100%)",
        boxShadow: "0 4px 18px rgba(2,8,28,0.6), inset 0 -1px 0 rgba(120,190,255,0.35)",
        position: "relative", zIndex: 5, flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label="Voltar" style={{
          background: "rgba(8,26,64,0.9)", border: "2px solid #2f5da8",
          borderRadius: 5,
          width: 34, height: 34, cursor: "pointer", color: "#bfe0ff",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}><ArrowLeft size={16}/></button>

        <div style={{
          width: 36, height: 36, overflow: "hidden", flexShrink: 0,
          border: `2px solid ${master.accentColor}`,
          borderRadius: 5,
          background: "#081a40",
          boxShadow: `0 0 14px ${master.accentColor}77`,
        }}>
          <img src={master.iconPath || "/placeholder.svg"} alt={master.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
        </div>

        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontFamily: PIXEL, fontSize: 12.5, color: "#ffffff",
            margin: 0, whiteSpace: "nowrap", letterSpacing: "0.02em",
            textShadow: "0 0 14px #64baffcc, 0 2px 0 rgba(2,10,30,0.8)",
          }}>ROTA DE RUNAS · {master.name.toUpperCase()}</h1>
          <div style={{
            fontFamily: MONO, fontSize: 10, color: "#8fc3ff", marginTop: 2,
          }}>
            {progress.done}/{progress.total} runas — Mestre nível {master.currentLevel}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 12 }}/>

        {/* Progresso da rota compacto, no próprio cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 130 }}>
          <div style={{
            display: "flex", gap: 2, padding: 2, flex: 1, minWidth: 90,
            background: "rgba(4,16,44,0.9)", border: "2px solid #2f5da8",
            borderRadius: 4,
            boxShadow: progress.done > 0 ? "0 0 12px rgba(90,190,255,0.35)" : "none",
          }}>
            {Array.from({ length: 10 }, (_, i) => {
              const filled = progress.pct >= (i + 1) * 10 - 0.01
              return (
                <div key={i} style={{
                  flex: 1, height: 8, borderRadius: 2,
                  background: filled
                    ? "linear-gradient(180deg, #dff4ff 0%, #dff4ff 30%, #38b6ff 30%, #38b6ff 100%)"
                    : "linear-gradient(180deg, #0a1f4c 0%, #10295e 100%)",
                  boxShadow: filled ? "0 0 6px rgba(90,190,255,0.8)" : "none",
                }}/>
              )
            })}
          </div>
          <span style={{
            fontFamily: PIXEL, fontSize: 10, color: "#5fc4ff",
            textShadow: "0 0 8px rgba(90,190,255,0.6)",
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

      {/* ── Trilhas: 3 ramos horizontais, todas as 30 runas visíveis ── */}
      <div
        ref={tracksRef}
        style={{
          flex: 1, minHeight: 0, position: "relative", zIndex: 4,
          display: "flex", flexDirection: "column", justifyContent: "space-evenly",
          gap: 10, padding: "10px 14px 6px",
        }}
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

          return (
            <section key={branch.id} style={{
              display: "flex", alignItems: "stretch", gap: 10,
              animation: `gpRiseIn 0.4s ease ${bIdx * 0.08}s both`,
              minHeight: 0,
            }}>
              {/* Estandarte do ramo */}
              <div style={{
                width: labelW, flexShrink: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 4,
                background: `linear-gradient(135deg, ${tint}1e 0%, rgba(5,20,56,0.82) 65%)`,
                border: "2px solid #2f5da8",
                borderLeft: `3px solid ${tint}`,
                borderRadius: 8,
                padding: "6px 4px",
                boxShadow: `inset 0 0 24px ${tint}18, 0 4px 14px rgba(2,8,28,0.5), inset 0 1px 0 rgba(150,210,255,0.25)`,
                backdropFilter: "blur(2px)",
              }}>
                <div style={{
                  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `radial-gradient(circle at 35% 30%, #ffffff33, ${tint}33 60%, rgba(5,18,50,0.9))`,
                  border: `2px solid ${tint}`,
                  borderRadius: "50%",
                  boxShadow: `0 0 12px ${tint}88`,
                }}>
                  <BranchIcon size={13} color="#ffffff"/>
                </div>
                <div style={{
                  fontFamily: PIXEL, fontSize: 10, color: "#ffffff",
                  textShadow: `0 0 12px ${tint}, 0 2px 0 rgba(2,10,30,0.8)`, textAlign: "center", lineHeight: 1.25,
                }}>{branch.name.toUpperCase()}</div>
                <div style={{
                  fontFamily: MONO, fontSize: 8.5, color: "#9fc6f5",
                  textAlign: "center", lineHeight: 1.3, display: labelW > 100 ? "block" : "none",
                }}>{branch.subtitle}</div>
                <span style={{
                  fontFamily: PIXEL, fontSize: 9, color: branchComplete ? "#5dff9c" : "#ffffff",
                  fontVariantNumeric: "tabular-nums",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(4,16,44,0.9)", border: `2px solid ${branchComplete ? "#2ea86c" : `${tint}77`}`,
                  borderRadius: 4,
                  padding: "1px 6px",
                }}>
                  {branchComplete && <Check size={10} strokeWidth={3}/>}
                  {branchDone}/{branch.runes.length}
                </span>
              </div>

              {/* Trilha horizontal em leve zigue-zague */}
              <div style={{
                flex: 1, minWidth: 0, position: "relative",
                display: "flex", alignItems: "center",
              }}>
                <div style={{ position: "relative", width: "100%", height: trackH }}>
                  {/* Caminhos entre os nós */}
                  {branch.runes.slice(0, -1).map((rune, i) => {
                    const y1 = (i % 2 === 0 ? ZIG : 0) + NODE / 2
                    const y2 = ((i + 1) % 2 === 0 ? ZIG : 0) + NODE / 2
                    const x1 = slot * i + slot / 2 + NODE * 0.44
                    const dx = slot - NODE * 0.88
                    const dy = y2 - y1
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
                          left: x1,
                          top: y1,
                          width: len,
                          height: lit ? 6 : 4,
                          marginTop: lit ? -3 : -2,
                          transform: `rotate(${ang}deg)`,
                          transformOrigin: "0 50%",
                          borderRadius: 3,
                          background: lit
                            ? "linear-gradient(180deg, #fffef0 0%, #fff6c8 45%, #ffe98a 100%)"
                            : "linear-gradient(180deg, rgba(120,165,230,0.5), rgba(70,110,180,0.4))",
                          backgroundImage: lit && next
                            ? "repeating-linear-gradient(90deg, #fffef0 0 14px, #ffe98a 14px 28px)"
                            : undefined,
                          animation: lit && next ? "gpRunePathFlow 1.1s linear infinite" : "none",
                          boxShadow: lit
                            ? "0 0 10px rgba(255,240,170,0.85), 0 0 22px rgba(255,235,150,0.4)"
                            : "0 0 6px rgba(90,150,230,0.35)",
                          opacity: lit ? 1 : 0.8,
                        }}
                      />
                    )
                  })}

                  {/* Nós */}
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
                          left: slot * i + slot / 2,
                          top: i % 2 === 0 ? ZIG : 0,
                          transform: "translateX(-50%)",
                        }}
                      >
                        <RuneNode
                          size={NODE}
                          tint={isDone ? "#3fe08e" : tint}
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
                              filter: isLocked ? "grayscale(1) brightness(0.75)" : "drop-shadow(0 2px 2px rgba(0,0,0,0.5))",
                            }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                          />
                        </RuneNode>

                        {/* Selo de estado no canto do orbe */}
                        {(isDone || isLocked) && (
                          <div aria-hidden="true" style={{
                            position: "absolute", right: -3, top: NODE - sealSize,
                            width: sealSize, height: sealSize, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: isDone ? "#12915f" : "#0a1c44",
                            border: isDone ? "2px solid #baffdd" : "2px solid #3a5d9e",
                            boxShadow: isDone ? "0 0 8px rgba(93,255,156,0.7)" : "0 2px 4px rgba(0,0,0,0.5)",
                          }}>
                            {isDone
                              ? <Check size={Math.round(sealSize * 0.55)} strokeWidth={3} color="#eafff4"/>
                              : <Lock size={Math.round(sealSize * 0.5)} color="#8fb2e5"/>}
                          </div>
                        )}

                        {/* Tier em algarismo romano sob o orbe */}
                        <div style={{
                          position: "absolute", top: NODE + 4, left: "50%", transform: "translateX(-50%)",
                          fontFamily: PIXEL, fontSize: Math.max(7.5, NODE * 0.16),
                          color: isSelected ? "#ffffff" : isLocked ? "#6d8ec2" : "#d8ecff",
                          textShadow: isSelected
                            ? `0 0 10px ${tint}, 0 2px 0 rgba(2,10,30,0.85)`
                            : "0 2px 0 rgba(2,10,30,0.85), 0 0 6px rgba(60,120,220,0.5)",
                          whiteSpace: "nowrap",
                        }}>
                          {ROMAN[rune.tier - 1] ?? rune.tier}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {/* ── Painel de detalhe da runa selecionada — fixo na base ── */}
      {selected && selectedInfo && (() => {
        const tint  = BRANCH_TINT[selected.branchId]
        const done  = selectedInfo.status === "unlocked"
        const avail = selectedInfo.status === "available"
        const stateColor = done ? "#18b573" : avail ? tint : "#7d9cc9"
        const stateLabel = done ? "GRAVADA" : avail ? "DISPONÍVEL" : "BLOQUEADA"
        const badgeBg    = done ? "#12915f" : avail ? "#0b78d0" : "#41598a"
        const badgeFg    = "#ffffff"
        const selBranch  = branches.find(b => b.id === selected.branchId)
        const branchName = selBranch?.name ?? ""
        const branchSize = selBranch?.runes.length ?? 10

        return (
          <div style={{
            position: "relative", zIndex: 6, flexShrink: 0,
            padding: "12px 14px 12px",
            background: "linear-gradient(0deg, rgba(3,12,36,0.9) 70%, rgba(3,12,36,0))",
          }}>
            <div style={{
              position: "relative", maxWidth: 980, margin: "0 auto",
              background: "linear-gradient(180deg, #f4fcff 0%, #e6f5fd 100%)",
              border: "2px solid #9fdcf2",
              borderLeft: `5px solid ${stateColor}`,
              boxShadow: `0 8px 24px rgba(2,10,32,0.55), inset 0 1px 0 #ffffff${avail ? `, 0 0 26px ${tint}44` : ""}`,
              borderRadius: 10,
              padding: "14px 14px 12px",
            }}>
              {/* Badge de estado sobre a borda */}
              <div style={{
                position: "absolute", top: -12, left: 12,
                display: "inline-flex", alignItems: "center", gap: 6,
                background: badgeBg, color: badgeFg,
                border: "2px solid #ffffff",
                borderRadius: 5,
                boxShadow: "0 2px 6px rgba(2,10,32,0.4)",
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
                      ? `radial-gradient(circle at 34% 28%, #ffffff 0%, ${tint} 40%, ${tint} 60%, rgba(10,40,90,0.75) 100%)`
                      : "radial-gradient(circle at 34% 28%, #c9d6e8 0%, #8fa3c0 45%, #5a7195 100%)",
                    border: "2px solid #ffffff",
                    boxShadow: done || avail
                      ? `0 0 0 2px ${tint}66, 0 0 16px ${tint}88`
                      : "0 0 0 2px rgba(120,150,190,0.4), 0 2px 6px rgba(2,10,32,0.25)",
                  }}>
                    <img
                      src={runeRewardIconPath(selected.rewards[0], chestId) || "/placeholder.svg"}
                      alt="" width={26} height={26}
                      style={{ width: 26, height: 26, objectFit: "contain", imageRendering: "pixelated" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                    />
                  </div>
                  <div style={{
                    marginTop: 5, fontFamily: PIXEL, fontSize: 9, color: "#2a5893",
                  }}>Nv. {selected.tier}/{branchSize}</div>
                </div>

                <div style={{ flex: 1, minWidth: 220 }}>
                  {/* Título + ramo */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 13, color: "#0b2e5e", lineHeight: 1.3,
                    }}>{selected.name}</span>
                    <div style={{ flex: 1, minWidth: 8 }}/>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 9, color: "#0b78d0",
                    }}>{branchName.toUpperCase()}</span>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 9,
                      color: master.currentLevel >= selected.requiredLevel ? "#0f8a56" : "#c05a1e",
                      border: `2px solid ${master.currentLevel >= selected.requiredLevel ? "#2ea86c" : "#e09a5c"}`,
                      borderRadius: 4,
                      background: "#ffffff",
                      padding: "1px 6px",
                    }}>Lv.{selected.requiredLevel}</span>
                  </div>

                  <p style={{
                    margin: "6px 0 0", fontFamily: MONO, fontSize: 11, color: "#3a5a85",
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
                          background: "#0a2a6b", border: "2px solid #3a76d8",
                          borderRadius: 5,
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
                          width: 2, height: 18, background: "#b7dcee", margin: "0 2px", flexShrink: 0,
                        }}/>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <img src="/images/gear-coin.png" alt="" width={15} height={15}
                            style={{ width: 15, height: 15, objectFit: "contain", imageRendering: "pixelated" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                          <span style={{
                            fontFamily: PIXEL, fontSize: 10.5, fontVariantNumeric: "tabular-nums",
                            color: gearCoins >= selected.cost.gearCoins ? "#a4700a" : "#d13c3c",
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
                                color: have >= amount ? "#1b6ab0" : "#d13c3c",
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
                          background: "linear-gradient(180deg, #4fe3a5 0%, #23c07f 100%)",
                          border: "2px solid #0b3f2d",
                          borderRadius: 6,
                          padding: "7px 14px", cursor: "pointer", color: "#043321",
                          fontFamily: PIXEL, fontSize: 10.5,
                          boxShadow: "0 3px 0 #0b3f2d, 0 0 14px rgba(60,220,150,0.5)",
                          transition: "transform 0.06s, box-shadow 0.06s",
                        }}>
                        GRAVAR RUNA
                      </button>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        color: "#5a7aa5", fontFamily: MONO, fontSize: 10.5,
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
