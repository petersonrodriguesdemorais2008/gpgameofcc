"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, Lock, Coins, Swords, Crown, Sparkles } from "lucide-react"
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

const SERIF = "var(--font-serif), Georgia, serif"

const BRANCH_ICON: Record<RuneBranchId, typeof Coins> = {
  fortuna: Coins,
  guerra:  Swords,
  dominio: Crown,
}

/** Cor de identidade de cada ramo — dá personalidade própria sem fugir da paleta. */
const BRANCH_TINT: Record<RuneBranchId, string> = {
  fortuna: "#e8c96d",
  guerra:  "#f0705a",
  dominio: "#a78bfa",
}

/**
 * A engrenagem `effect-chain-ultimates` é ciano-esverdeada. Para tingi-la de
 * forma previsível, normalizamos em sépia (matiz ~35°) e giramos até a cor
 * desejada — mantendo o mesmo efeito holográfico do duelo.
 */
function gearFilter(hueTarget: number, sat = 5.5, bright = 1): string {
  const rot = Math.round(hueTarget - 35)
  return `grayscale(1) sepia(1) saturate(${sat}) hue-rotate(${rot}deg) brightness(${bright})`
}

const BRANCH_GEAR_FILTER: Record<RuneBranchId, string> = {
  fortuna: gearFilter(48, 5.5, 1.08),
  guerra:  gearFilter(8, 5.5, 1.04),
  dominio: gearFilter(262, 4.5, 1.1),
}
const DONE_GEAR_FILTER = gearFilter(158, 4, 1.05)

/** Runa bloqueada: mantém a matiz do ramo, mas apagada e sem vida. */
function lockedGearFilter(branch: RuneBranchId): string {
  const hue = branch === "fortuna" ? 48 : branch === "guerra" ? 8 : 262
  return gearFilter(hue, 1.6, 0.62)
}

// Geometria da trilha (px) — caminho em zigue-zague como um tabuleiro isométrico
const NODE   = 70
const GAP_Y  = 116
const OFF_X  = 26

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
      background: "rgba(255,255,255,0.035)", border: `1px solid ${color}33`,
      clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
      padding: "6px 12px 6px 7px",
    }}>
      <img
        src={icon || "/placeholder.svg"}
        alt=""
        width={20} height={20}
        style={{ width: 20, height: 20, objectFit: "contain" }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
      />
      <span style={{
        fontSize: 12.5, fontWeight: 800, color: "#eceae5",
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
        background: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(6,3,12,0.94), rgba(1,0,3,0.985))",
        backdropFilter: "blur(18px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "gpFadeIn 0.22s ease",
      }}>
      {[0, 0.16].map((d, i) => (
        <div key={i} aria-hidden="true" style={{
          position: "absolute", left: "50%", top: "50%", width: 280, height: 280,
          marginLeft: -140, marginTop: -140, borderRadius: "50%",
          border: `1.5px solid ${master.accentColor}${i === 0 ? "66" : "33"}`,
          animation: `gpActShock 1.5s cubic-bezier(0.16,1,0.3,1) ${d}s both`,
        }}/>
      ))}

      <div style={{ position: "relative", textAlign: "center", maxWidth: 460 }}>
        <div style={{
          margin: "0 auto 20px", width: 92, height: 92, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "gpLevelBounce 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <div style={{
            position: "absolute", inset: 0, transform: "rotate(45deg)",
            background: `linear-gradient(135deg,${master.accentColor}55,${master.accentColor}18)`,
            border: `1px solid ${master.accentColor}aa`,
            boxShadow: `0 0 42px ${master.accentColor}66`,
          }}/>
          <Sparkles size={34} color="#f7f4ee" style={{ position: "relative" }}/>
        </div>

        <div style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: "0.4em", textTransform: "uppercase",
          color: master.accentColor, marginBottom: 10,
        }}>Runa Desbloqueada</div>
        <div style={{
          fontFamily: SERIF, fontWeight: 800, fontSize: "clamp(22px,4vw,32px)", color: "#f7f4ee",
          textShadow: `0 2px 30px ${master.accentColor}66`, lineHeight: 1.15,
        }}>{rune.name}</div>
        <p style={{ color: "#7b8290", fontSize: 12.5, fontStyle: "italic", margin: "12px 0 22px", lineHeight: 1.6 }}>
          {rune.description}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {rune.rewards.map((rw, i) => {
            const color = runeRewardColor(rw.type, CHESTS[chestId].color)
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "rgba(255,255,255,0.04)", border: `1px solid ${color}38`,
                clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                padding: "11px 16px",
                animation: `gpRiseIn 0.4s ease ${0.1 + i * 0.09}s both`,
              }}>
                <img
                  src={runeRewardIconPath(rw, chestId) || "/placeholder.svg"}
                  alt="" width={30} height={30}
                  style={{ width: 30, height: 30, objectFit: "contain" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                />
                <span style={{ fontWeight: 800, fontSize: 13.5, color: "#f1efea" }}>{rw.label}</span>
              </div>
            )
          })}
        </div>

        <div style={{ color: "#565d6b", fontSize: 11, marginTop: 22, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          toque para continuar
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
      background: "linear-gradient(168deg,#0a0712 0%,#050308 58%,#0a0714 100%)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "gpFadeIn 0.25s ease",
    }}>
      <style>{`
        @keyframes gpRuneNodePulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.07); }
        }
        @keyframes gpRunePathFlow {
          0%   { background-position: 0 0; }
          100% { background-position: 22px 0; }
        }
        @keyframes gpRuneShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .gp-rune-node:hover { transform: translateY(-3px); }
        .gp-rune-node:focus-visible { outline: 2px solid #f7f4ee; outline-offset: 6px; border-radius: 50%; }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gpRuneNodePulse { from { opacity: 0.7 } to { opacity: 0.7 } }
          @keyframes gpRunePathFlow  { from { background-position: 0 0 } to { background-position: 0 0 } }
          @keyframes gpRuneShimmer   { from { background-position: 0 0 } to { background-position: 0 0 } }
        }
      `}</style>

      {/* Atmosfera */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 65% 60% at 50% 0%, ${master.accentColor}14 0%, transparent 65%)`,
        }}/>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.32,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 25%,black,transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 25%,black,transparent)",
        }}/>
      </div>

      {toast && (
        <div role="status" style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 700,
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(12,10,6,0.96)", border: `1px solid ${master.accentColor}55`,
          borderRadius: 11, padding: "10px 20px", color: "#f0ede6", fontWeight: 700, fontSize: 13,
          backdropFilter: "blur(16px)", boxShadow: "0 6px 28px rgba(0,0,0,0.55)",
          maxWidth: "90vw", textAlign: "center", animation: "gpToastIn 0.25s ease",
        }}>
          <Sparkles size={14} color={master.accentColor}/>
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
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: "12px 20px", borderBottom: `1px solid ${master.accentColor}1e`,
        background: "rgba(6,4,10,0.72)", backdropFilter: "blur(18px)",
        position: "relative", zIndex: 5, flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label="Voltar" className="gp-icon-btn" style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 10, width: 38, height: 38, cursor: "pointer", color: "#8b93a1",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}><ArrowLeft size={17}/></button>

        <div style={{
          width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
          border: `2px solid ${master.accentColor}`,
          background: `radial-gradient(circle,${master.bgColor},#08060a)`,
        }}>
          <img src={master.iconPath || "/placeholder.svg"} alt={master.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
        </div>

        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontFamily: SERIF, fontWeight: 800, fontSize: 16, color: "#f5f2ec",
            letterSpacing: "0.03em", margin: 0, whiteSpace: "nowrap",
          }}>Rota de Runas · {master.name}</h1>
          <div style={{
            fontSize: 10, color: "#565d6b", letterSpacing: "0.14em",
            textTransform: "uppercase", fontWeight: 700, marginTop: 2,
          }}>
            {progress.done}/{progress.total} runas · Mestre nível {master.currentLevel}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 12 }}/>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <ResourceChip icon="/images/gear-coin.png" label="Gear Coins" value={gearCoins} color="#e8c96d"/>
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
        {/* Painel flutuante de detalhe da runa selecionada */}
        {selected && selectedInfo && (() => {
          const tint  = BRANCH_TINT[selected.branchId]
          const done  = selectedInfo.status === "unlocked"
          const avail = selectedInfo.status === "available"
          const stateColor = done ? "#34d399" : avail ? tint : "#7b8290"
          const stateLabel = done ? "Gravada" : avail ? "Disponível" : "Bloqueada"
          const branchName = branches.find(b => b.id === selected.branchId)?.name ?? ""

          return (
            <div style={{
              position: "sticky", top: 0, zIndex: 8,
              padding: "16px 20px 12px",
              background: "linear-gradient(180deg,rgba(5,3,9,0.96) 60%,rgba(5,3,9,0))",
              backdropFilter: "blur(10px)",
            }}>
              <div style={{
                position: "relative", maxWidth: 780, margin: "0 auto",
                background: "linear-gradient(150deg,rgba(16,14,24,0.97),rgba(8,6,13,0.97))",
                border: `1px solid ${stateColor}44`, borderRadius: 14,
                boxShadow: `0 16px 44px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 32px ${stateColor}18`,
                padding: "14px 16px 15px",
              }}>
                {/* Tag de estado, sobreposta na borda superior */}
                <div style={{
                  position: "absolute", top: -11, left: 14,
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: done ? "#1d7d5c" : avail ? tint : "#2a2f3a",
                  color: done || avail ? "#08060a" : "#aab1bd",
                  border: `1px solid ${stateColor}88`,
                  clipPath: "polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%)",
                  padding: "3px 12px",
                  fontSize: 9.5, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase",
                }}>
                  {done ? <Check size={11} strokeWidth={3}/> : avail ? <Sparkles size={10}/> : <Lock size={10}/>}
                  {stateLabel}
                </div>

                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {/* Ícone da recompensa principal + tier */}
                  <div style={{ flexShrink: 0, textAlign: "center", paddingTop: 6 }}>
                    <div style={{
                      width: 58, height: 58, borderRadius: "50%", position: "relative",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `radial-gradient(circle at 35% 28%, ${tint}${done || avail ? "e0" : "80"}, rgba(6,4,10,0.9))`,
                      border: `1px solid ${tint}${done || avail ? "cc" : "66"}`,
                      boxShadow: `0 0 20px ${tint}${done || avail ? "55" : "22"}, inset 0 6px 12px rgba(255,255,255,0.22)`,
                    }}>
                      <img
                        src={runeRewardIconPath(selected.rewards[0], chestId) || "/placeholder.svg"}
                        alt="" width={30} height={30}
                        style={{ width: 30, height: 30, objectFit: "contain" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    </div>
                    <div style={{
                      marginTop: 7, fontFamily: SERIF, fontWeight: 800, fontSize: 12,
                      color: "#cfcbc3", letterSpacing: "0.04em",
                    }}>Nv. {selected.tier}/4</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Título + ramo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{
                        fontFamily: SERIF, fontWeight: 800, fontSize: 17, color: "#f6f3ed", lineHeight: 1.2,
                      }}>{selected.name}</span>
                      <div style={{ flex: 1, minWidth: 8 }}/>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: tint,
                      }}>{branchName}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                        color: master.currentLevel >= selected.requiredLevel ? "#34d399" : "#f0a97a",
                        background: master.currentLevel >= selected.requiredLevel ? "rgba(52,211,153,0.10)" : "rgba(240,169,122,0.10)",
                        border: `1px solid ${master.currentLevel >= selected.requiredLevel ? "rgba(52,211,153,0.32)" : "rgba(240,169,122,0.32)"}`,
                        borderRadius: 4, padding: "2px 7px",
                      }}>Lv.{selected.requiredLevel}</span>
                    </div>

                    {/* O que a runa dá */}
                    <div style={{
                      marginTop: 9, background: "rgba(255,255,255,0.035)",
                      border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9,
                      padding: "10px 12px",
                    }}>
                      <div style={{
                        fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase",
                        color: "#6d7482", marginBottom: 7,
                      }}>O que ela concede</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {selected.rewards.map((rw, i) => {
                          const c = runeRewardColor(rw.type, CHESTS[chestId].color)
                          return (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", gap: 6,
                              background: `${c}14`, border: `1px solid ${c}38`, borderRadius: 6,
                              padding: "4px 9px 4px 6px",
                            }}>
                              <img
                                src={runeRewardIconPath(rw, chestId) || "/placeholder.svg"}
                                alt="" width={17} height={17}
                                style={{ width: 17, height: 17, objectFit: "contain" }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                              />
                              <span style={{ fontSize: 11, fontWeight: 800, color: c }}>{rw.label}</span>
                            </div>
                          )
                        })}
                      </div>
                      <p style={{
                        margin: "9px 0 0", fontSize: 11.5, color: "#8b93a1",
                        fontStyle: "italic", lineHeight: 1.55,
                      }}>{selected.description}</p>
                    </div>

                    {/* Como desbloquear */}
                    {!done && (
                      <div style={{
                        marginTop: 8, background: "rgba(255,255,255,0.025)",
                        border: `1px solid ${avail ? `${tint}33` : "rgba(255,255,255,0.06)"}`,
                        borderRadius: 9, padding: "10px 12px",
                      }}>
                        <div style={{
                          display: "inline-block",
                          fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase",
                          color: "#08060a", background: avail ? tint : "#5b6270",
                          padding: "2px 8px", borderRadius: 3, marginBottom: 8,
                        }}>Como desbloquear</div>

                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <img src="/images/gear-coin.png" alt="" width={17} height={17}
                              style={{ width: 17, height: 17, objectFit: "contain" }}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                            <span style={{
                              fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                              color: gearCoins >= selected.cost.gearCoins ? "#e8c96d" : "#f87171",
                            }}>{selected.cost.gearCoins.toLocaleString("pt-BR")}</span>
                          </div>
                          {(Object.entries(selected.cost.fragments) as [FragmentId, number][]).map(([fid, amount]) => {
                            const have = fragments[fid] ?? 0
                            return (
                              <div key={fid} title={FRAGMENTS[fid].name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <img src={FRAGMENTS[fid].image || "/placeholder.svg"} alt="" width={17} height={17}
                                  style={{ width: 17, height: 17, objectFit: "contain" }}
                                  onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                                <span style={{
                                  fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                                  color: have >= amount ? FRAGMENTS[fid].color : "#f87171",
                                }}>{amount}</span>
                              </div>
                            )
                          })}
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: master.currentLevel >= selected.requiredLevel ? "#7b8290" : "#f0a97a",
                          }}>
                            Mestre nível {selected.requiredLevel}
                          </span>

                          <div style={{ flex: 1, minWidth: 8 }}/>

                          {avail ? (
                            <button
                              onClick={() => handleUnlock(selected)}
                              className="gp-cta"
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                background: `linear-gradient(135deg,${tint}66,${tint}aa)`,
                                border: `1px solid ${tint}`, borderRadius: 7,
                                padding: "8px 16px", cursor: "pointer", color: "#08060a",
                                fontWeight: 900, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                                boxShadow: `0 3px 18px ${tint}55`,
                              }}>
                              <Sparkles size={12}/> Gravar runa
                            </button>
                          ) : (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              color: "#8b93a1", fontSize: 11, fontWeight: 700,
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
          {/* Barra de progresso da rota — segmentada por runa */}
          <div style={{ maxWidth: 780, margin: "0 auto 26px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase",
                color: progress.pct >= 100 ? "#34d399" : "#7b8290",
              }}>
                {progress.pct >= 100 ? "Rota completa" : "Progresso da rota"}
              </span>
              <span style={{
                fontSize: 11.5, fontWeight: 800, color: master.accentColor,
                fontVariantNumeric: "tabular-nums",
              }}>{Math.round(progress.pct)}%</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: progress.total }, (_, i) => {
                const filled = i < progress.done
                const isNext = i === progress.done && progress.done < progress.total
                return (
                  <div key={i} style={{
                    flex: 1, height: 7, borderRadius: 2, position: "relative", overflow: "hidden",
                    background: filled
                      ? `linear-gradient(90deg,${master.accentColor}88,${master.accentColor})`
                      : "rgba(255,255,255,0.07)",
                    boxShadow: filled ? `0 0 10px ${master.accentColor}55` : "none",
                    border: isNext ? `1px solid ${master.accentColor}55` : "1px solid transparent",
                    transition: "background 0.45s, box-shadow 0.45s",
                  }}>
                    {filled && (
                      <div aria-hidden="true" style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.35) 50%,transparent 70%)",
                        backgroundSize: "200% 100%",
                        animation: "gpRuneShimmer 3.2s ease-in-out infinite",
                      }}/>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Trilhas de runas ── */}
          <div className="gp-runes-grid" style={{
            display: "grid", gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            alignItems: "start", maxWidth: 780, margin: "0 auto",
          }}>
            {branches.map((branch, bIdx) => {
              const BranchIcon     = BRANCH_ICON[branch.id]
              const tint           = BRANCH_TINT[branch.id]
              const branchDone     = branch.runes.filter(r => unlocked.includes(r.id)).length
              const branchComplete = branchDone === branch.runes.length
              const trackHeight    = (branch.runes.length - 1) * GAP_Y + NODE + 18

              return (
                <section key={branch.id} style={{
                  animation: `gpRiseIn 0.4s ease ${bIdx * 0.08}s both`,
                }}>
                  {/* Cabeçalho do ramo */}
                  <header style={{
                    display: "flex", alignItems: "center", gap: 9, marginBottom: 18,
                    justifyContent: "center",
                  }}>
                    <div style={{
                      width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${tint}16`, border: `1px solid ${tint}3a`, borderRadius: 8,
                      flexShrink: 0,
                      boxShadow: branchComplete ? `0 0 14px ${tint}44` : "none",
                    }}>
                      <BranchIcon size={15} color={tint}/>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: SERIF, fontWeight: 800, fontSize: 14, color: "#f3f0ea", lineHeight: 1.2,
                      }}>{branch.name}</div>
                      <div style={{ fontSize: 9, color: "#565d6b", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                        {branch.subtitle}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: tint, fontVariantNumeric: "tabular-nums",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      {branchComplete && <Check size={11} strokeWidth={3}/>}
                      {branchDone}/{branch.runes.length}
                    </span>
                  </header>

                  {/* Trilha em zigue-zague */}
                  <div style={{ position: "relative", height: trackHeight }}>
                    {/* Caminhos entre os nós */}
                    {branch.runes.slice(0, -1).map((rune, i) => {
                      const nextRune = branch.runes[i + 1]
                      const x1 = i % 2 === 0 ? -OFF_X : OFF_X
                      const x2 = (i + 1) % 2 === 0 ? -OFF_X : OFF_X
                      const dx  = x2 - x1
                      const dy  = GAP_Y
                      const len = Math.sqrt(dx * dx + dy * dy)
                      const ang = (Math.atan2(dy, dx) * 180) / Math.PI
                      const lit = unlocked.includes(rune.id)
                      const half = unlocked.includes(nextRune.id) || lit
                      return (
                        <div
                          key={`path-${rune.id}`}
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            left: `calc(50% + ${x1}px)`,
                            top: i * GAP_Y + NODE / 2,
                            width: len,
                            height: 5,
                            marginTop: -2.5,
                            transform: `rotate(${ang}deg)`,
                            transformOrigin: "0 50%",
                            borderRadius: 3,
                            background: half
                              ? `repeating-linear-gradient(90deg,${tint}dd 0 9px,${tint}55 9px 22px)`
                              : "repeating-linear-gradient(90deg,rgba(255,255,255,0.13) 0 9px,rgba(255,255,255,0.05) 9px 22px)",
                            backgroundSize: "22px 100%",
                            boxShadow: half ? `0 0 12px ${tint}66` : "none",
                            animation: half ? "gpRunePathFlow 1.1s linear infinite" : "none",
                          }}
                        />
                      )
                    })}

                    {/* Nós */}
                    {branch.runes.map((rune, i) => {
                      const info = hydrated
                        ? getRuneStatus({ rune, unlocked, level: master.currentLevel, gearCoins, fragments })
                        : { status: "locked_prev" as const, reason: "", missingGear: 0, missingFragments: {} }
                      const isDone      = info.status === "unlocked"
                      const isAvailable = info.status === "available"
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
                            tint={tint}
                            tintStrength={isLocked ? 0.5 : 1}
                            filter={isDone ? DONE_GEAR_FILTER : isAvailable ? BRANCH_GEAR_FILTER[branch.id] : lockedGearFilter(branch.id)}
                            spin={6 + i * 0.7}
                            reverse={i % 2 === 1}
                            selected={isSelected}
                            dim={isLocked}
                            rich={isAvailable || isDone || isSelected}
                            label={`${rune.name} — ${isDone ? "gravada" : isAvailable ? "disponível" : "bloqueada"}`}
                            onClick={() => setSelectedId(rune.id)}
                          >
                            <img
                              src={runeRewardIconPath(rune.rewards[0], chestId) || "/placeholder.svg"}
                              alt="" width={30} height={30}
                              style={{
                                width: 30, height: 30, objectFit: "contain",
                                filter: isLocked ? "grayscale(1) brightness(0.85)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                              }}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                            />
                          </RuneNode>

                          {/* Selo de estado no canto do nó */}
                          {(isDone || isLocked) && (
                            <div aria-hidden="true" style={{
                              position: "absolute", right: -2, bottom: -2,
                              width: 20, height: 20, borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: isDone ? "#166b50" : "#161a22",
                              border: `1px solid ${isDone ? "#34d399" : "rgba(255,255,255,0.14)"}`,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
                            }}>
                              {isDone
                                ? <Check size={11} strokeWidth={3} color="#d8fff0"/>
                                : <Lock size={10} color="#6d7482"/>}
                            </div>
                          )}

                          {/* Nome curto sob o nó */}
                          <div style={{
                            position: "absolute", top: NODE + 6, left: "50%", transform: "translateX(-50%)",
                            width: 104, textAlign: "center",
                            fontSize: 9, fontWeight: 800, letterSpacing: "0.04em",
                            color: isSelected ? "#f6f3ed" : isLocked ? "#5b6270" : "#9aa1ad",
                            lineHeight: 1.25, textWrap: "balance",
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
