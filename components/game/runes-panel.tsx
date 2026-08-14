"use client"

import { useEffect, useMemo, useState } from "react"
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

// Geometria da trilha (px) — caminho em zigue-zague como um tabuleiro isométrico
const NODE   = 68
const PED    = Math.round(NODE * 0.42)
const GAP_Y  = 132
const OFF_X  = 30

interface RunesPanelProps {
  master:  Master
  onClose: () => void
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
        .gp-rune-node:hover { filter: brightness(1.12); }
        .gp-rune-node:focus-visible { outline: 2px solid #f7f4ee; outline-offset: 6px; }
        .gp-rune-cta:active { transform: translateY(2px); box-shadow: 0 1px 0 #0b3f2d !important; }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gpRuneGlowPulse { from { opacity: 0.8 } to { opacity: 0.8 } }
          @keyframes gpRuneBlink     { from { opacity: 1 }   to { opacity: 1 } }
          @keyframes gpRunePathFlow  { from { background-position: 0 0 } to { background-position: 0 0 } }
          @keyframes gpRuneFloat     { from { transform: none } to { transform: none } }
        }
      `}</style>

      {/* Tabuleiro: xadrez em losango, como um chão isométrico */}
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
          background: `radial-gradient(ellipse 90% 55% at 50% 0%, ${master.accentColor}1c 0%, transparent 60%)`,
        }}/>
        {/* Escurece as bordas para o tabuleiro não competir com a UI */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 85% 75% at 50% 42%, transparent 25%, rgba(5,5,9,0.88) 100%)",
        }}/>
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 60% 45% at 50% 30%, ${master.accentColor}12 0%, transparent 70%)`,
        }}/>
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
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "10px 18px", borderBottom: `2px solid ${master.accentColor}33`,
        background: `linear-gradient(180deg, #0b0b10 0%, #0b0b10 70%, ${master.accentColor}0a 100%)`,
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        position: "relative", zIndex: 5, flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label="Voltar" style={{
          background: "#16161d", border: "2px solid #2e2e38",
          borderBottomColor: "#0a0a0e", borderRightColor: "#0a0a0e",
          width: 36, height: 36, cursor: "pointer", color: "#9aa1ad",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}><ArrowLeft size={16}/></button>

        <div style={{
          width: 38, height: 38, overflow: "hidden", flexShrink: 0,
          border: `2px solid ${master.accentColor}`,
          background: "#101016",
        }}>
          <img src={master.iconPath || "/placeholder.svg"} alt={master.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
        </div>

        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontFamily: PIXEL, fontSize: 13, color: "#f5f2ec",
            margin: 0, whiteSpace: "nowrap", letterSpacing: "0.02em",
          }}>ROTA DE RUNAS · {master.name.toUpperCase()}</h1>
          <div style={{
            fontFamily: MONO, fontSize: 10.5, color: "#6d7482", marginTop: 2,
          }}>
            {progress.done}/{progress.total} runas — Mestre nível {master.currentLevel}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 12 }}/>

        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
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

      {/* ── Corpo ── */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 4 }}>
        {/* Painel de detalhe da runa selecionada — estilo tooltip de jogo */}
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
              position: "sticky", top: 0, zIndex: 8,
              padding: "18px 16px 10px",
              background: "linear-gradient(180deg,rgba(10,10,15,0.9) 55%,rgba(10,10,15,0))",
            }}>
              <div style={{
                position: "relative", maxWidth: 760, margin: "0 auto",
                background: "rgba(11,11,17,0.97)",
                border: `2px solid ${done || avail ? `${tint}55` : "#34343f"}`,
                borderLeft: `4px solid ${stateColor}`,
                boxShadow: `4px 4px 0 rgba(0,0,0,0.5), inset 0 0 0 1px #17171f${avail ? `, 0 0 24px ${tint}22` : ""}`,
                borderRadius: 6,
                padding: "16px 16px 14px",
              }}>
                {/* Badge de estado sobre a borda, como o "ACTIVE" da referência */}
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

                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {/* Orbe da recompensa principal + nível */}
                  <div style={{ flexShrink: 0, textAlign: "center", paddingTop: 4 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%", position: "relative",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: done || avail
                        ? `radial-gradient(circle at 36% 30%, #fff4cf 0%, #fff4cf 16%, ${tint} 16%, ${tint} 50%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.55) 100%)`
                        : "radial-gradient(circle at 36% 30%, #8f9099 0%, #8f9099 16%, #585a64 16%, #585a64 50%, #232429 50%, #232429 100%)",
                      border: "2px solid #06060a",
                      boxShadow: done || avail ? `0 0 0 2px ${tint}55, 0 0 14px ${tint}55` : "none",
                    }}>
                      <img
                        src={runeRewardIconPath(selected.rewards[0], chestId) || "/placeholder.svg"}
                        alt="" width={28} height={28}
                        style={{ width: 28, height: 28, objectFit: "contain", imageRendering: "pixelated" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    </div>
                    <div style={{
                      marginTop: 7, fontFamily: PIXEL, fontSize: 10, color: "#cfcbc3",
                    }}>Nv. {selected.tier}/{branchSize}</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Título + ramo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{
                        fontFamily: PIXEL, fontSize: 14, color: "#f6f3ed", lineHeight: 1.3,
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

                    {/* O que a runa dá */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 7,
                      }}>
                        <span style={{
                          fontFamily: PIXEL, fontSize: 8.5, letterSpacing: "0.1em",
                          color: `${tint}cc`,
                        }}>RECOMPENSAS</span>
                        <span aria-hidden="true" style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${tint}44, transparent)` }}/>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
                      </div>
                      <p style={{
                        margin: "9px 0 0", fontFamily: MONO, fontSize: 11.5, color: "#8b93a1",
                        lineHeight: 1.6,
                      }}>{selected.description}</p>
                    </div>

                    {/* Como desbloquear */}
                    {!done && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8, marginBottom: 7,
                        }}>
                          <span style={{
                            fontFamily: PIXEL, fontSize: 8.5, letterSpacing: "0.1em",
                            color: avail ? `${tint}cc` : "#6d7482",
                          }}>CUSTO</span>
                          <span aria-hidden="true" style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${avail ? `${tint}44` : "#2a2a33"}, transparent)` }}/>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <img src="/images/gear-coin.png" alt="" width={16} height={16}
                              style={{ width: 16, height: 16, objectFit: "contain", imageRendering: "pixelated" }}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                            <span style={{
                              fontFamily: PIXEL, fontSize: 11, fontVariantNumeric: "tabular-nums",
                              color: gearCoins >= selected.cost.gearCoins ? "#f2c14e" : "#f87171",
                            }}>{selected.cost.gearCoins.toLocaleString("pt-BR")}</span>
                          </div>
                          {(Object.entries(selected.cost.fragments) as [FragmentId, number][]).map(([fid, amount]) => {
                            const have = fragments[fid] ?? 0
                            return (
                              <div key={fid} title={FRAGMENTS[fid].name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <img src={FRAGMENTS[fid].image || "/placeholder.svg"} alt="" width={16} height={16}
                                  style={{ width: 16, height: 16, objectFit: "contain", imageRendering: "pixelated" }}
                                  onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                                <span style={{
                                  fontFamily: PIXEL, fontSize: 11, fontVariantNumeric: "tabular-nums",
                                  color: have >= amount ? FRAGMENTS[fid].color : "#f87171",
                                }}>{amount}</span>
                              </div>
                            )
                          })}
                          <span style={{
                            fontFamily: MONO, fontSize: 10.5,
                            color: master.currentLevel >= selected.requiredLevel ? "#7b8290" : "#f0a97a",
                          }}>
                            Mestre nível {selected.requiredLevel}
                          </span>

                          <div style={{ flex: 1, minWidth: 8 }}/>

                          {avail ? (
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
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        <div style={{ padding: "4px 20px 56px" }}>
          {/* Barra de progresso da rota — blocos segmentados */}
          <div style={{ maxWidth: 760, margin: "0 auto 28px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{
                fontFamily: PIXEL, fontSize: 9,
                color: progress.pct >= 100 ? "#4ecf9d" : "#7b8290",
              }}>
                {progress.pct >= 100 ? "ROTA COMPLETA" : "PROGRESSO DA ROTA"}
              </span>
              <span style={{
                fontFamily: PIXEL, fontSize: 10, color: master.accentColor,
                fontVariantNumeric: "tabular-nums",
              }}>{Math.round(progress.pct)}%</span>
            </div>
            <div style={{
              display: "flex", gap: 3, padding: 3,
              background: "#08080d", border: "2px solid #2c2c36",
              borderBottomColor: "#3a3a46", borderRightColor: "#3a3a46",
              boxShadow: progress.done > 0 ? `0 0 12px ${master.accentColor}22` : "none",
            }}>
              {Array.from({ length: progress.total }, (_, i) => {
                const filled = i < progress.done
                return (
                  <div key={i} style={{
                    flex: 1, height: 9,
                    background: filled
                      ? `linear-gradient(180deg, #ffe9b0 0%, #ffe9b0 30%, ${master.accentColor} 30%, ${master.accentColor} 100%)`
                      : "linear-gradient(180deg, #16161d 0%, #1e1e26 100%)",
                    boxShadow: filled ? `0 0 6px ${master.accentColor}66` : "none",
                    transition: "background 0.45s",
                  }}/>
                )
              })}
            </div>
          </div>

          {/* ── Trilhas de runas ── */}
          <div className="gp-runes-grid" style={{
            display: "grid", gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            alignItems: "start", maxWidth: 760, margin: "0 auto",
          }}>
            {branches.map((branch, bIdx) => {
              const BranchIcon     = BRANCH_ICON[branch.id]
              const tint           = BRANCH_TINT[branch.id]
              const branchDone     = branch.runes.filter(r => unlocked.includes(r.id)).length
              const branchComplete = branchDone === branch.runes.length
              const trackHeight    = (branch.runes.length - 1) * GAP_Y + NODE + PED + 24
              // Status de cada runa do ramo, calculado uma vez para nós e caminhos
              const statusById = new Map(branch.runes.map(r => [
                r.id,
                hydrated
                  ? getRuneStatus({ rune: r, unlocked, level: master.currentLevel, gearCoins, fragments }).status
                  : ("locked_prev" as const),
              ]))

              return (
                <section key={branch.id} style={{
                  animation: `gpRiseIn 0.4s ease ${bIdx * 0.08}s both`,
                  background: `linear-gradient(180deg, ${tint}0f 0%, rgba(12,12,18,0.55) 90px, rgba(12,12,18,0.55) 100%)`,
                  border: "2px solid #23232c",
                  borderTop: `3px solid ${tint}88`,
                  borderRadius: 8,
                  padding: "14px 8px 10px",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.02)",
                }}>
                  {/* Cabeçalho do ramo */}
                  <header style={{
                    display: "flex", alignItems: "center", gap: 9, marginBottom: 6,
                    justifyContent: "center", flexWrap: "wrap", padding: "0 6px",
                  }}>
                    <div style={{
                      width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `linear-gradient(180deg, ${tint}22, #14141b)`,
                      border: `2px solid ${tint}88`,
                      boxShadow: `0 0 10px ${tint}33`,
                      flexShrink: 0,
                    }}>
                      <BranchIcon size={14} color={tint}/>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: PIXEL, fontSize: 11.5, color: "#f3f0ea", lineHeight: 1.3,
                        textShadow: `0 0 12px ${tint}55`,
                      }}>{branch.name.toUpperCase()}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9.5, color: "#7b8290" }}>
                        {branch.subtitle}
                      </div>
                    </div>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 10, color: branchComplete ? "#4ecf9d" : tint,
                      fontVariantNumeric: "tabular-nums",
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "#0d0d13", border: `2px solid ${branchComplete ? "#1d7d5c" : `${tint}44`}`,
                      padding: "2px 7px",
                    }}>
                      {branchComplete && <Check size={11} strokeWidth={3}/>}
                      {branchDone}/{branch.runes.length}
                    </span>
                  </header>

                  {/* Divisor decorativo em losango */}
                  <div aria-hidden="true" style={{
                    display: "flex", alignItems: "center", gap: 6, margin: "0 14px 16px",
                  }}>
                    <span style={{ flex: 1, height: 2, background: `linear-gradient(90deg, transparent, ${tint}44)` }}/>
                    <span style={{
                      width: 7, height: 7, background: `${tint}aa`, flexShrink: 0,
                      clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
                    }}/>
                    <span style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${tint}44, transparent)` }}/>
                  </div>

                  {/* Trilha em zigue-zague */}
                  <div style={{ position: "relative", height: trackHeight }}>
                    {/* Caminhos entre os nós — "estradas" do tabuleiro */}
                    {branch.runes.slice(0, -1).map((rune, i) => {
                      const nextRune = branch.runes[i + 1]
                      const x1 = i % 2 === 0 ? -OFF_X : OFF_X
                      const x2 = (i + 1) % 2 === 0 ? -OFF_X : OFF_X
                      const dx  = x2 - x1
                      const dy  = GAP_Y
                      const len = Math.sqrt(dx * dx + dy * dy)
                      const ang = (Math.atan2(dy, dx) * 180) / Math.PI
                      const lit  = statusById.get(rune.id) === "unlocked"
                      const next = statusById.get(nextRune.id) === "available"
                      return (
                        <div
                          key={`path-${rune.id}`}
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            left: `calc(50% + ${x1}px)`,
                            top: i * GAP_Y + NODE / 2,
                            width: len,
                            height: 8,
                            marginTop: -4,
                            transform: `rotate(${ang}deg)`,
                            transformOrigin: "0 50%",
                            // Pedras de caminho: traços curtos, como lajotas de um tabuleiro
                            background: lit
                              ? `repeating-linear-gradient(90deg, ${tint} 0 10px, transparent 10px 18px)`
                              : "repeating-linear-gradient(90deg, #3b3b46 0 10px, transparent 10px 18px)",
                            animation: lit && next ? "gpRunePathFlow 1.4s linear infinite" : "none",
                            filter: lit ? `drop-shadow(0 0 6px ${tint}66)` : "none",
                            opacity: lit ? 1 : 0.7,
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
                      const x = i % 2 === 0 ? -OFF_X : OFF_X

                      return (
                        <div
                          key={rune.id}
                          style={{
                            position: "absolute",
                            left: `calc(50% + ${x}px)`,
                            top: i * GAP_Y,
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
                              alt="" width={30} height={30}
                              style={{
                                width: 30, height: 30, objectFit: "contain",
                                imageRendering: "pixelated",
                                filter: isLocked ? "grayscale(1) brightness(0.8)" : "drop-shadow(0 2px 0 rgba(0,0,0,0.5))",
                              }}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                            />
                          </RuneNode>

                          {/* Selo de estado no canto do orbe */}
                          {(isDone || isLocked) && (
                            <div aria-hidden="true" style={{
                              position: "absolute", right: -3, top: NODE - 18,
                              width: 18, height: 18,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: isDone ? "#166b50" : "#16161d",
                              border: "2px solid #06060a",
                            }}>
                              {isDone
                                ? <Check size={10} strokeWidth={3} color="#d8fff0"/>
                                : <Lock size={9} color="#6d7482"/>}
                            </div>
                          )}

                          {/* Nome curto sob o pedestal */}
                          <div style={{
                            position: "absolute", top: NODE + PED + 4, left: "50%", transform: "translateX(-50%)",
                            width: 108, textAlign: "center",
                            fontFamily: PIXEL, fontSize: 8,
                            color: isSelected ? "#f6f3ed" : isLocked ? "#5b6270" : "#9aa1ad",
                            lineHeight: 1.35, textWrap: "balance",
                            textShadow: "0 2px 0 rgba(0,0,0,0.7)",
                          }}>
                            {rune.name.replace(/^Runa d[aeo]s? /i, "")}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RunesPanel
