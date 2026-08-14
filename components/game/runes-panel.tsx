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

  // ── Geometria responsiva: TODAS as runas visíveis, sem rolagem ──────────────
  // Cada ramo é uma trilha HORIZONTAL de 10 runas. O tamanho do orbe é derivado
  // do espaço real disponível (largura ÷ 10 slots; altura ÷ 3 trilhas).
  const RUNES_N = branches[0]?.runes.length ?? 10
  const labelW = Math.min(150, Math.max(86, tracksSize.w * 0.16))
  const trackW = Math.max(0, tracksSize.w - labelW - 18)
  const slot   = trackW > 0 ? trackW / RUNES_N : 0
  // Altura de cada seção de ramo: (altura total − gaps) / 3
  const perBranchH = tracksSize.h > 0 ? (tracksSize.h - 2 * 10) / 3 : 0
  const sizeFromW  = slot > 0 ? slot - 10 : 48
  // trilha ocupa: zig(0.22s) + orbe(s) + pedestal(0.42s) + selo/tier(16)
  const sizeFromH  = perBranchH > 0 ? (perBranchH - 20) / 1.68 : 48
  const NODE = Math.max(30, Math.min(62, Math.floor(Math.min(sizeFromW, sizeFromH))))
  const PED  = Math.round(NODE * 0.42)
  const ZIG  = Math.round(NODE * 0.22)
  const trackH = ZIG + NODE + PED + 18
  const ready  = tracksSize.w > 0 && tracksSize.h > 0

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
        }
      `}</style>

      {/* Fundo: tabuleiro isométrico + aura do mestre + glifos rúnicos flutuando */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: "-60%", top: "-60%", width: "220%", height: "220%",
          transform: "rotate(45deg)",
          background: "repeating-conic-gradient(#1b1b23 0% 25%, #111118 0% 50%) 0 0 / 72px 72px",
          opacity: 0.95,
        }}/>
        {/* Névoa colorida do mestre subindo do horizonte */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 90% 55% at 50% 0%, ${master.accentColor}22 0%, transparent 60%)`,
        }}/>
        {/* Aura viva no coração do salão */}
        <div style={{
          position: "absolute", left: "50%", top: "46%",
          width: "72%", height: "58%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(ellipse, ${master.accentColor}18 0%, transparent 65%)`,
          animation: "gpAuraBreathe 5.5s ease-in-out infinite",
        }}/>
        {/* Escurece as bordas para o tabuleiro não competir com a UI */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 85% 75% at 50% 42%, transparent 25%, rgba(5,5,9,0.88) 100%)",
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
                background: `linear-gradient(135deg, ${tint}14 0%, rgba(12,12,18,0.72) 65%)`,
                border: "2px solid #23232c",
                borderLeft: `3px solid ${tint}aa`,
                borderRadius: 6,
                padding: "6px 4px",
                boxShadow: `inset 0 0 22px ${tint}0e, 0 4px 12px rgba(0,0,0,0.35)`,
              }}>
                <div style={{
                  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(180deg, ${tint}22, #14141b)`,
                  border: `2px solid ${tint}88`,
                  boxShadow: `0 0 10px ${tint}44`,
                }}>
                  <BranchIcon size={13} color={tint}/>
                </div>
                <div style={{
                  fontFamily: PIXEL, fontSize: 10, color: "#f3f0ea",
                  textShadow: `0 0 12px ${tint}66`, textAlign: "center", lineHeight: 1.25,
                }}>{branch.name.toUpperCase()}</div>
                <div style={{
                  fontFamily: MONO, fontSize: 8.5, color: "#7b8290",
                  textAlign: "center", lineHeight: 1.3, display: labelW > 100 ? "block" : "none",
                }}>{branch.subtitle}</div>
                <span style={{
                  fontFamily: PIXEL, fontSize: 9, color: branchComplete ? "#4ecf9d" : tint,
                  fontVariantNumeric: "tabular-nums",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "#0d0d13", border: `2px solid ${branchComplete ? "#1d7d5c" : `${tint}44`}`,
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
                          height: 7,
                          marginTop: -3.5,
                          transform: `rotate(${ang}deg)`,
                          transformOrigin: "0 50%",
                          background: lit
                            ? `repeating-linear-gradient(90deg, ${tint} 0 9px, transparent 9px 16px)`
                            : "repeating-linear-gradient(90deg, #3b3b46 0 9px, transparent 9px 16px)",
                          animation: lit && next ? "gpRunePathFlow 1.4s linear infinite" : "none",
                          filter: lit ? `drop-shadow(0 0 6px ${tint}66)` : "none",
                          opacity: lit ? 1 : 0.65,
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
