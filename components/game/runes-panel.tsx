"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, Lock, Coins, Swords, Crown, Sparkles } from "lucide-react"
import { useGame } from "@/contexts/game-context"
import { PackOpeningOverlay } from "./pack-opening-overlay"
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

interface RunesPanelProps {
  master:  Master
  onClose: () => void
}

// ─── Selo rúnico (losango com número do tier) ─────────────────────────────────
function RuneSeal({ tier, color, active, done, size = 46 }: {
  tier: number; color: string; active: boolean; done: boolean; size?: number
}) {
  const tint = done ? color : active ? color : "#3a3f4b"
  return (
    <div style={{
      width: size, height: size, flexShrink: 0, position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        transform: "rotate(45deg)",
        background: done
          ? `linear-gradient(135deg,${color}44,${color}18)`
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${tint}${done ? "aa" : active ? "66" : "33"}`,
        boxShadow: done ? `0 0 18px ${color}44` : active ? `0 0 12px ${color}22` : "none",
      }}/>
      <span style={{
        position: "relative", fontFamily: SERIF, fontWeight: 800, fontSize: 15,
        color: done ? "#f7f4ee" : active ? tint : "#5b6270",
      }}>
        {done ? <Check size={16} strokeWidth={3}/> : tier}
      </span>
    </div>
  )
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

  const branches    = useMemo(() => getRuneBranches(master), [master])
  const chestId     = elementToChestId(master.element)
  const elementalId = elementToFragmentId(master.element)
  const progress    = getRuneProgress(master, unlocked)

  useEffect(() => {
    setUnlocked(loadUnlockedRunes()[master.id] ?? [])
    setHydrated(true)
  }, [master.id])

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
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 48px", position: "relative", zIndex: 4 }}>
        <p style={{ fontSize: 12.5, color: "#7b8290", lineHeight: 1.7, margin: "0 0 6px", maxWidth: 760 }}>
          Gaste Gear Coins e <strong style={{ color: FRAGMENTS[elementalId].color }}>{FRAGMENTS[elementalId].name}</strong>
          {" "}— o fragmento do elemento {master.element} — para gravar as runas de {master.fullName}. Cada ramo
          precisa ser desbloqueado em ordem, e cada runa entrega sua recompensa uma única vez.
        </p>

        {/* Barra de progresso da rota */}
        <div style={{ maxWidth: 760, margin: "14px 0 22px" }}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress.pct}%`, borderRadius: 99,
              background: `linear-gradient(90deg,${master.accentColor}70,${master.accentColor})`,
              boxShadow: `0 0 14px ${master.accentColor}66`,
              transition: "width 0.45s cubic-bezier(0.22,1,0.36,1)",
            }}/>
          </div>
        </div>

        <div className="gp-runes-grid" style={{
          display: "grid", gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          alignItems: "start",
        }}>
          {branches.map(branch => {
            const BranchIcon = BRANCH_ICON[branch.id]
            const branchDone = branch.runes.filter(r => unlocked.includes(r.id)).length
            return (
              <section key={branch.id} style={{
                background: "rgba(255,255,255,0.022)",
                border: `1px solid ${master.accentColor}1f`,
                clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                padding: "16px 16px 18px",
              }}>
                <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${master.accentColor}16`, border: `1px solid ${master.accentColor}3a`,
                    clipPath: "polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)",
                    flexShrink: 0,
                  }}>
                    <BranchIcon size={16} color={master.accentColor}/>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: SERIF, fontWeight: 800, fontSize: 15, color: "#f3f0ea", lineHeight: 1.2,
                    }}>{branch.name}</div>
                    <div style={{ fontSize: 10, color: "#565d6b", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                      {branch.subtitle}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}/>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: master.accentColor, fontVariantNumeric: "tabular-nums",
                  }}>{branchDone}/{branch.runes.length}</span>
                </header>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {branch.runes.map((rune, idx) => {
                    const info = hydrated
                      ? getRuneStatus({ rune, unlocked, level: master.currentLevel, gearCoins, fragments })
                      : { status: "locked_prev" as const, reason: "", missingGear: 0, missingFragments: {} }
                    const isDone      = info.status === "unlocked"
                    const isAvailable = info.status === "available"
                    const dim         = !isDone && !isAvailable

                    return (
                      <div key={rune.id} style={{ position: "relative" }}>
                        {/* conector com a runa anterior */}
                        {idx > 0 && (
                          <div aria-hidden="true" style={{
                            position: "absolute", left: 22, top: -10, width: 2, height: 10,
                            background: isDone || isAvailable
                              ? `linear-gradient(180deg,${master.accentColor}88,${master.accentColor}44)`
                              : "rgba(255,255,255,0.08)",
                          }}/>
                        )}

                        <article style={{
                          display: "flex", gap: 12,
                          background: isDone
                            ? `linear-gradient(120deg,${master.accentColor}12,rgba(255,255,255,0.02))`
                            : "rgba(255,255,255,0.026)",
                          border: `1px solid ${isDone ? `${master.accentColor}4a` : isAvailable ? `${master.accentColor}30` : "rgba(255,255,255,0.06)"}`,
                          clipPath: "polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)",
                          padding: "12px 13px",
                          opacity: dim ? 0.62 : 1,
                          transition: "opacity 0.25s, border-color 0.25s",
                        }}>
                          <RuneSeal tier={rune.tier} color={master.accentColor} active={isAvailable} done={isDone}/>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                              <span style={{
                                fontWeight: 800, fontSize: 13, color: isDone ? "#f6f3ed" : "#dcd9d3", lineHeight: 1.25,
                              }}>{rune.name}</span>
                              <span style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                                color: master.currentLevel >= rune.requiredLevel ? "#34d399" : "#8b93a1",
                                background: master.currentLevel >= rune.requiredLevel ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.05)",
                                border: `1px solid ${master.currentLevel >= rune.requiredLevel ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.1)"}`,
                                padding: "2px 7px",
                              }}>Lv.{rune.requiredLevel}</span>
                            </div>

                            {/* Recompensas */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                              {rune.rewards.map((rw, i) => {
                                const c = runeRewardColor(rw.type, CHESTS[chestId].color)
                                return (
                                  <div key={i} style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    background: `${c}14`, border: `1px solid ${c}33`,
                                    clipPath: "polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)",
                                    padding: "4px 8px 4px 5px",
                                  }}>
                                    <img
                                      src={runeRewardIconPath(rw, chestId) || "/placeholder.svg"}
                                      alt="" width={16} height={16}
                                      style={{ width: 16, height: 16, objectFit: "contain" }}
                                      onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                                    />
                                    <span style={{ fontSize: 10.5, fontWeight: 800, color: c }}>{rw.label}</span>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Custo */}
                            {!isDone && (
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <img src="/images/gear-coin.png" alt="" width={15} height={15}
                                    style={{ width: 15, height: 15, objectFit: "contain" }}
                                    onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                                  <span style={{
                                    fontSize: 11.5, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                                    color: gearCoins >= rune.cost.gearCoins ? "#e8c96d" : "#f87171",
                                  }}>{rune.cost.gearCoins.toLocaleString("pt-BR")}</span>
                                </div>
                                {(Object.entries(rune.cost.fragments) as [FragmentId, number][]).map(([fid, amount]) => {
                                  const have = fragments[fid] ?? 0
                                  return (
                                    <div key={fid} title={FRAGMENTS[fid].name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                      <img src={FRAGMENTS[fid].image || "/placeholder.svg"} alt="" width={15} height={15}
                                        style={{ width: 15, height: 15, objectFit: "contain" }}
                                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                                      <span style={{
                                        fontSize: 11.5, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                                        color: have >= amount ? FRAGMENTS[fid].color : "#f87171",
                                      }}>{amount}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Ação / estado */}
                            <div style={{ marginTop: 11 }}>
                              {isDone ? (
                                <div style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  color: "#34d399", fontSize: 10.5, fontWeight: 800,
                                  letterSpacing: "0.12em", textTransform: "uppercase",
                                }}><Check size={12}/> Gravada</div>
                              ) : isAvailable ? (
                                <button
                                  onClick={() => handleUnlock(rune)}
                                  className="gp-cta"
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    background: `linear-gradient(135deg,${master.accentColor}44,${master.accentColor}80)`,
                                    border: `1px solid ${master.accentColor}88`,
                                    clipPath: "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
                                    padding: "8px 15px", cursor: "pointer", color: "#fff",
                                    fontWeight: 900, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
                                    boxShadow: `0 3px 16px ${master.accentColor}44`,
                                  }}>
                                  <Sparkles size={12}/> Desbloquear
                                </button>
                              ) : (
                                <div style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  color: "#6d7482", fontSize: 10.5, fontWeight: 700, lineHeight: 1.4,
                                }}><Lock size={11}/> {info.reason}</div>
                              )}
                            </div>
                          </div>
                        </article>
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
  )
}

export default RunesPanel
