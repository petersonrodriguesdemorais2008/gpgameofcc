"use client"

import { useState, useEffect, useRef } from "react"
import { useGame } from "@/contexts/game-context"
import {
  ArrowLeft, Crown, Star, Gift, Check, Lock, Zap,
  Calendar, RefreshCw, Flame, ChevronRight, ChevronLeft,
  Sparkles, Shield, Target, Trophy,
} from "lucide-react"
import {
  getMissionProgress,
  trackDailyLogin,
} from "@/lib/mission-tracker"

// ─── Types ───────────────────────────────────────────────────────────────────

interface PassMission {
  id: string
  title: string
  description: string
  type: "daily" | "weekly" | "limited"
  points: number
  progress: number
  goal: number
  completed: boolean
  claimed: boolean
  expiresIn?: string
}

interface PassReward {
  level: number
  type: "coins" | "card_pack" | "gacha_coin" | "avatar_frame" | "title" | "exclusive_card" | "playmat"
  label: string
  amount?: number
  rarity?: "R" | "SR" | "UR" | "LR"
  isPremium: boolean
}

interface GearPassScreenProps {
  onBack: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POINTS_PER_LEVEL = 500
const MAX_LEVELS = 100
const PREMIUM_PRICE = "R$22,99"
const PREMIUM_PRICE_LABEL = "Gear Pass Premium"
const STRIPE_PAYMENT_URL = "https://buy.stripe.com/test_fZudRbc9c0oWcWZ2rj3oA00"
const STRIPE_SUCCESS_URL = "/gear-pass/success"

const LS_PASS_KEY = "gpgame_gear_pass"
const LS_MISSIONS_KEY = "gpgame_pass_missions"

// ─── Reward helpers ───────────────────────────────────────────────────────────

function buildRewards(): PassReward[] {
  const rewards: PassReward[] = []

  for (let lvl = 1; lvl <= MAX_LEVELS; lvl++) {
    // Common reward every level
    if (lvl % 10 === 0) {
      // milestone common
      rewards.push({
        level: lvl,
        type: "card_pack",
        label: "Pack Raro",
        rarity: lvl >= 80 ? "SR" : "R",
        isPremium: false,
      })
    } else if (lvl % 5 === 0) {
      rewards.push({
        level: lvl,
        type: "gacha_coin",
        label: "Gacha Coin",
        amount: 1,
        isPremium: false,
      })
    } else {
      rewards.push({
        level: lvl,
        type: "coins",
        label: "Coins",
        amount: lvl <= 30 ? 100 : lvl <= 60 ? 150 : 200,
        isPremium: false,
      })
    }

    // Premium reward every level
    if (lvl === 100) {
      rewards.push({
        level: lvl,
        type: "exclusive_card",
        label: "Carta Exclusiva LR",
        rarity: "LR",
        isPremium: true,
      })
    } else if (lvl % 25 === 0) {
      rewards.push({
        level: lvl,
        type: "playmat",
        label: "Playmat Exclusivo",
        isPremium: true,
      })
    } else if (lvl % 10 === 0) {
      rewards.push({
        level: lvl,
        type: "card_pack",
        label: "Pack Premium",
        rarity: lvl >= 80 ? "UR" : "SR",
        isPremium: true,
      })
    } else if (lvl % 5 === 0) {
      rewards.push({
        level: lvl,
        type: "gacha_coin",
        label: "Gacha Coin x2",
        amount: 2,
        isPremium: true,
      })
    } else {
      rewards.push({
        level: lvl,
        type: "coins",
        label: "Coins",
        amount: lvl <= 30 ? 300 : lvl <= 60 ? 450 : 600,
        isPremium: true,
      })
    }
  }

  return rewards
}

const ALL_REWARDS = buildRewards()

// ─── Build missions from live tracker data ────────────────────────────────────

function buildMissions(): PassMission[] {
  const g = {
    gachaToday:   getMissionProgress.gachaToday(),
    gachaWeek:    getMissionProgress.gachaWeek(),
    gachaTotal:   getMissionProgress.gachaTotal(),
    winsToday:    getMissionProgress.winsToday(),
    winsWeek:     getMissionProgress.winsWeek(),
    winsTotal:    getMissionProgress.winsTotal(),
    duelsToday:   getMissionProgress.duelsToday(),
    duelsWeek:    getMissionProgress.duelsWeek(),
    duelsTotal:   getMissionProgress.duelsTotal(),
    srTotal:      getMissionProgress.srTotal(),
    loginToday:   getMissionProgress.loginToday(),
    deckEditWeek: getMissionProgress.deckEditWeek(),
  }

  return [
    // ── Diárias ──
    {
      id: "daily_duel_1",
      title: "Duelista Diário",
      description: "Vença 1 duelo no modo Bot",
      type: "daily",
      points: 50,
      progress: Math.min(g.winsToday, 1),
      goal: 1,
      completed: g.winsToday >= 1,
      claimed: false,
    },
    {
      id: "daily_duel_3",
      title: "Em Chamas",
      description: "Dispute 3 duelos (vitória ou derrota)",
      type: "daily",
      points: 50,
      progress: Math.min(g.duelsToday, 3),
      goal: 3,
      completed: g.duelsToday >= 3,
      claimed: false,
    },
    {
      id: "daily_gacha",
      title: "Fortuna Diária",
      description: "Faça 1 pull no Gacha",
      type: "daily",
      points: 50,
      progress: Math.min(g.gachaToday, 1),
      goal: 1,
      completed: g.gachaToday >= 1,
      claimed: false,
    },
    {
      id: "daily_login",
      title: "Presença Garantida",
      description: "Colete o Bônus Diário",
      type: "daily",
      points: 30,
      progress: g.loginToday ? 1 : 0,
      goal: 1,
      completed: g.loginToday,
      claimed: false,
    },
    // ── Semanais ──
    {
      id: "weekly_wins_5",
      title: "Semana de Vitórias",
      description: "Vença 5 duelos nesta semana",
      type: "weekly",
      points: 150,
      progress: Math.min(g.winsWeek, 5),
      goal: 5,
      completed: g.winsWeek >= 5,
      claimed: false,
    },
    {
      id: "weekly_gacha_5",
      title: "Colecionador",
      description: "Faça 5 pulls no Gacha esta semana",
      type: "weekly",
      points: 150,
      progress: Math.min(g.gachaWeek, 5),
      goal: 5,
      completed: g.gachaWeek >= 5,
      claimed: false,
    },
    {
      id: "weekly_deck",
      title: "Mestre da Estratégia",
      description: "Edite ou crie um deck esta semana",
      type: "weekly",
      points: 100,
      progress: g.deckEditWeek ? 1 : 0,
      goal: 1,
      completed: g.deckEditWeek,
      claimed: false,
    },
    {
      id: "weekly_duel_10",
      title: "Veterano da Arena",
      description: "Dispute 10 duelos esta semana",
      type: "weekly",
      points: 200,
      progress: Math.min(g.duelsWeek, 10),
      goal: 10,
      completed: g.duelsWeek >= 10,
      claimed: false,
    },
    // ── Limitadas ──
    {
      id: "limited_wins_20",
      title: "Desafio do Passe",
      description: "Vença 20 duelos durante este Passe",
      type: "limited",
      points: 300,
      progress: Math.min(g.winsTotal, 20),
      goal: 20,
      completed: g.winsTotal >= 20,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_gacha_20",
      title: "Gacha Lendário",
      description: "Faça 20 pulls no Gacha durante este Passe",
      type: "limited",
      points: 300,
      progress: Math.min(g.gachaTotal, 20),
      goal: 20,
      completed: g.gachaTotal >= 20,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_sr_card",
      title: "Caçador de Raridades",
      description: "Obtenha 1 carta SR ou superior",
      type: "limited",
      points: 200,
      progress: Math.min(g.srTotal, 1),
      goal: 1,
      completed: g.srTotal >= 1,
      claimed: false,
      expiresIn: "29d",
    },
  ]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RewardIcon({ reward }: { reward: PassReward }) {
  const rarityColor: Record<string, string> = {
    R: "#60a5fa",
    SR: "#c084fc",
    UR: "#fbbf24",
    LR: "#f87171",
  }

  if (reward.type === "coins") {
    return (
      <img src="/images/icons/gacha-coin.png" alt="Coins"
        style={{ width: 28, height: 28, objectFit: "contain" }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
    )
  }
  if (reward.type === "gacha_coin") {
    return <div style={{ fontSize: 22 }}>🎰</div>
  }
  if (reward.type === "card_pack") {
    return (
      <div style={{
        fontSize: 10, fontWeight: 900, color: reward.rarity ? rarityColor[reward.rarity] : "#94a3b8",
        lineHeight: 1, textAlign: "center",
      }}>
        <div style={{ fontSize: 20 }}>📦</div>
        {reward.rarity && <div style={{ color: rarityColor[reward.rarity] }}>{reward.rarity}</div>}
      </div>
    )
  }
  if (reward.type === "exclusive_card") return <div style={{ fontSize: 22 }}>🃏</div>
  if (reward.type === "playmat") return <div style={{ fontSize: 22 }}>🖼️</div>
  if (reward.type === "avatar_frame") return <div style={{ fontSize: 22 }}>👑</div>
  if (reward.type === "title") return <div style={{ fontSize: 22 }}>🏅</div>
  return <Star size={20} color="#94a3b8" />
}

function MissionCard({
  mission,
  onClaim,
}: {
  mission: PassMission
  onClaim: (id: string) => void
}) {
  const typeColors = {
    daily: { bg: "rgba(6,182,212,0.10)", border: "rgba(6,182,212,0.25)", label: "Diária", labelColor: "#22d3ee" },
    weekly: { bg: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.25)", label: "Semanal", labelColor: "#c084fc" },
    limited: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)", label: "Limitada", labelColor: "#fbbf24" },
  }
  const col = typeColors[mission.type]
  const pct = Math.min(100, Math.round((mission.progress / mission.goal) * 100))

  return (
    <div style={{
      background: col.bg,
      border: `1px solid ${col.border}`,
      borderRadius: 16,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, color: col.labelColor,
              background: `${col.border}`, padding: "2px 6px", borderRadius: 6,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>{col.label}</span>
            {mission.expiresIn && (
              <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>⏰ {mission.expiresIn}</span>
            )}
          </div>
          <p style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{mission.title}</p>
          <p style={{ color: "#94a3b8", fontSize: 11 }}>{mission.description}</p>
        </div>

        {/* Points badge */}
        <div style={{
          background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)",
          borderRadius: 10, padding: "4px 10px", textAlign: "center", flexShrink: 0,
        }}>
          <div style={{ color: "#fbbf24", fontWeight: 900, fontSize: 15, lineHeight: 1 }}>+{mission.points}</div>
          <div style={{ color: "#d97706", fontSize: 9, fontWeight: 700 }}>pts</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{
          height: 6, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 99, width: `${pct}%`,
            background: mission.completed
              ? "linear-gradient(90deg,#22c55e,#4ade80)"
              : `linear-gradient(90deg,${col.labelColor}80,${col.labelColor})`,
            transition: "width 0.5s ease",
            boxShadow: mission.completed ? "0 0 8px rgba(34,197,94,0.5)" : undefined,
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: "#64748b" }}>{mission.progress}/{mission.goal}</span>
          {mission.completed && !mission.claimed && (
            <button
              onClick={() => onClaim(mission.id)}
              style={{
                background: "linear-gradient(135deg,#16a34a,#22c55e)",
                border: "none", borderRadius: 8, padding: "3px 12px",
                color: "#fff", fontSize: 11, fontWeight: 900, cursor: "pointer",
                boxShadow: "0 2px 10px rgba(34,197,94,0.35)",
              }}>
              Coletar ✓
            </button>
          )}
          {mission.claimed && (
            <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>✓ Coletado</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GearPassScreen({ onBack }: GearPassScreenProps) {
  const { coins, setCoins, playerId } = useGame()

  // ── Verificar premium no servidor ao abrir a tela ─────────────────────────
  useEffect(() => {
    if (!playerId) return
    const checkServerPremium = async () => {
      try {
        const res = await fetch(`/api/stripe/check-premium?player_id=${playerId}`)
        const data = await res.json()
        if (data.hasPremium) {
          setPassData(pd => ({ ...pd, hasPremium: true }))
          // Espelha no localStorage para acesso offline imediato
          const stored = JSON.parse(localStorage.getItem(LS_PASS_KEY) || "{}")
          localStorage.setItem(LS_PASS_KEY, JSON.stringify({ ...stored, hasPremium: true }))
        }
      } catch {
        // Se offline, confia no localStorage
      }
    }
    checkServerPremium()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])

  // ── Persistent state ─────────────────────────────────────────────────────
  const [passData, setPassData] = useState<{
    currentPoints: number
    currentLevel: number
    hasPremium: boolean
    claimedCommon: number[]
    claimedPremium: number[]
  }>(() => {
    if (typeof window === "undefined") return {
      currentPoints: 0, currentLevel: 0, hasPremium: false,
      claimedCommon: [], claimedPremium: [],
    }
    try {
      const saved = localStorage.getItem(LS_PASS_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return { currentPoints: 0, currentLevel: 0, hasPremium: false, claimedCommon: [], claimedPremium: [] }
  })

  // Claimed missions (apenas IDs) persistidos no localStorage
  const [claimedMissionIds, setClaimedMissionIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem(LS_MISSIONS_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return []
  })

  // Missões lidas ao vivo do tracker + status de claimed
  const [missions, setMissions] = useState<PassMission[]>(() =>
    buildMissions().map(m => ({
      ...m,
      claimed: false,
    }))
  )

  // Recarrega progresso das missões a cada 3s (para refletir ações do jogo)
  useEffect(() => {
    trackDailyLogin()
    const refresh = () => {
      const fresh = buildMissions()
      setMissions(fresh.map(m => ({
        ...m,
        claimed: claimedMissionIds.includes(m.id),
        // Se já foi claimed, mantém completed = true e progress = goal
        ...(claimedMissionIds.includes(m.id) ? { completed: true, progress: m.goal } : {}),
      })))
    }
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimedMissionIds])

  const [activeTab, setActiveTab] = useState<"pass" | "missions">("pass")
  const [missionFilter, setMissionFilter] = useState<"all" | "daily" | "weekly" | "limited">("all")
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null)
  const [focusedLevel, setFocusedLevel] = useState<number | null>(null)
  const passRowRef = useRef<HTMLDivElement>(null)

  // Persist passData
  useEffect(() => {
    localStorage.setItem(LS_PASS_KEY, JSON.stringify(passData))
  }, [passData])

  // Persist claimed mission IDs
  useEffect(() => {
    localStorage.setItem(LS_MISSIONS_KEY, JSON.stringify(claimedMissionIds))
  }, [claimedMissionIds])

  // Scroll to current level
  useEffect(() => {
    if (activeTab === "pass" && passRowRef.current) {
      const lvl = passData.currentLevel
      const target = passRowRef.current.querySelector(`[data-level="${Math.max(1, lvl)}"]`)
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
      }
    }
  }, [activeTab, passData.currentLevel])

  // ── Derived ──────────────────────────────────────────────────────────────
  const pointsInCurrentLevel = passData.currentPoints % POINTS_PER_LEVEL
  const progressPct = Math.min(100, Math.round((pointsInCurrentLevel / POINTS_PER_LEVEL) * 100))
  const totalPointsNeeded = passData.currentLevel * POINTS_PER_LEVEL

  const filteredMissions = missionFilter === "all"
    ? missions
    : missions.filter(m => m.type === missionFilter)

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleClaimMission = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId)
    if (!mission || !mission.completed || mission.claimed) return
    if (claimedMissionIds.includes(missionId)) return

    // Add points to pass
    const newPoints = passData.currentPoints + mission.points
    const newLevel = Math.min(MAX_LEVELS, Math.floor(newPoints / POINTS_PER_LEVEL))
    setPassData(pd => ({
      ...pd,
      currentPoints: newPoints,
      currentLevel: newLevel,
    }))
    setClaimedMissionIds(prev => [...prev, missionId])
    setClaimFeedback(`+${mission.points} pontos do Passe!`)
    setTimeout(() => setClaimFeedback(null), 2000)
  }

  const handleClaimPassReward = (level: number, isPremium: boolean) => {
    if (level > passData.currentLevel) return
    if (isPremium && !passData.hasPremium) {
      setShowPremiumModal(true)
      return
    }
    const key = isPremium ? "claimedPremium" : "claimedCommon"
    if (passData[key].includes(level)) return

    const reward = ALL_REWARDS.find(r => r.level === level && r.isPremium === isPremium)
    if (!reward) return

    // Give reward
    if (reward.type === "coins" && reward.amount) {
      setCoins((c: number) => c + reward.amount!)
    }

    setPassData(pd => ({
      ...pd,
      [key]: [...pd[key], level],
    }))

    setClaimFeedback(
      reward.type === "coins"
        ? `+${reward.amount} Coins!`
        : reward.type === "gacha_coin"
        ? `+${reward.amount ?? 1} Gacha Coin(s)!`
        : `${reward.label} obtido!`
    )
    setTimeout(() => setClaimFeedback(null), 2000)
    setFocusedLevel(null)
  }

  const openStripeCheckout = () => {
    // Passa o playerId como client_reference_id para o webhook identificar o jogador
    const pid = playerId || localStorage.getItem("gear-perks-player-id") || localStorage.getItem("gearperks-playerid") || ""
    const stripeUrl = pid
      ? `${STRIPE_PAYMENT_URL}?client_reference_id=${encodeURIComponent(pid)}`
      : STRIPE_PAYMENT_URL
    window.open(stripeUrl, "_blank")
    setShowPremiumModal(false)
  }

  // ── Level reward data ─────────────────────────────────────────────────────
  const levelGroups = Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map(lvl => ({
    level: lvl,
    common: ALL_REWARDS.find(r => r.level === lvl && !r.isPremium),
    premium: ALL_REWARDS.find(r => r.level === lvl && r.isPremium),
    isUnlocked: lvl <= passData.currentLevel,
    commonClaimed: passData.claimedCommon.includes(lvl),
    premiumClaimed: passData.claimedPremium.includes(lvl),
  }))

  // ── Visible window: show 5 levels centered on current ────────────────────
  const VISIBLE = 7
  const startIdx = Math.max(0, Math.min(passData.currentLevel - Math.floor(VISIBLE / 2), MAX_LEVELS - VISIBLE))

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "linear-gradient(160deg,#020610 0%,#050d1a 50%,#030a14 100%)",
      color: "#f1f5f9",
      fontFamily: "'Segoe UI',system-ui,sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Background glows */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 40% at 50% 0%,rgba(6,182,212,0.09) 0%,transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 40% at 85% 80%,rgba(168,85,247,0.07) 0%,transparent 55%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 30% at 10% 70%,rgba(251,191,36,0.05) 0%,transparent 50%)" }} />
      </div>

      {/* Feedback toast */}
      {claimFeedback && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.40)",
          borderRadius: 14, padding: "10px 24px", color: "#4ade80", fontWeight: 900, fontSize: 14,
          backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(34,197,94,0.2)",
          animation: "fadeInDown 0.3s ease",
        }}>
          🎉 {claimFeedback}
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(2,6,16,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "14px 16px 10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 700, margin: "0 auto" }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center",
            color: "#94a3b8", transition: "all 0.2s",
          }}>
            <ArrowLeft size={18} />
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={18} color="#06b6d4" />
              <h1 style={{ fontWeight: 900, fontSize: 18, margin: 0, letterSpacing: "0.02em" }}>
                Gear Pass
              </h1>
              {passData.hasPremium && (
                <span style={{
                  background: "linear-gradient(135deg,#d97706,#fbbf24)",
                  borderRadius: 6, padding: "2px 8px", fontSize: 9,
                  fontWeight: 900, color: "#000", letterSpacing: "0.06em",
                }}>PREMIUM</span>
              )}
            </div>
            <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>
              Temporada 1 · Encerra em 29 dias
            </p>
          </div>

          {!passData.hasPremium && (
            <button onClick={() => setShowPremiumModal(true)} style={{
              background: "linear-gradient(135deg,#b45309,#d97706,#f59e0b)",
              border: "none", borderRadius: 12, padding: "8px 14px",
              color: "#fff", fontWeight: 900, fontSize: 11, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(217,119,6,0.35)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <Crown size={13} />
              {PREMIUM_PRICE}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 6, maxWidth: 700, margin: "12px auto 0",
          background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4,
        }}>
          {(["pass", "missions"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "8px 0", borderRadius: 9, border: "none",
              cursor: "pointer", fontWeight: 800, fontSize: 12, letterSpacing: "0.04em",
              transition: "all 0.2s",
              background: activeTab === tab
                ? "linear-gradient(135deg,rgba(6,182,212,0.25),rgba(139,92,246,0.20))"
                : "transparent",
              color: activeTab === tab ? "#e2e8f0" : "#475569",
              boxShadow: activeTab === tab ? "0 2px 8px rgba(6,182,212,0.15)" : "none",
            }}>
              {tab === "pass" ? "🛡️ Passe" : "🎯 Missões"}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 0 100px" }}>

          {/* ── PASS TAB ── */}
          {activeTab === "pass" && (
            <>
              {/* Progress overview */}
              <div style={{
                margin: "16px 16px 0",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: "18px 20px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>
                      Nível {passData.currentLevel}
                      <span style={{ color: "#475569", fontWeight: 600, fontSize: 16 }}> / {MAX_LEVELS}</span>
                    </div>
                    <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                      {passData.currentPoints.toLocaleString()} pts acumulados
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#06b6d4", fontWeight: 800, fontSize: 13 }}>
                      {pointsInCurrentLevel} / {POINTS_PER_LEVEL}
                    </div>
                    <div style={{ color: "#334155", fontSize: 10 }}>pts p/ próx. nível</div>
                  </div>
                </div>

                {/* XP bar */}
                <div style={{
                  height: 10, borderRadius: 99,
                  background: "rgba(255,255,255,0.07)", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 99, width: `${progressPct}%`,
                    background: "linear-gradient(90deg,#06b6d4,#8b5cf6)",
                    boxShadow: "0 0 12px rgba(6,182,212,0.5)",
                    transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
                  }} />
                </div>

                {/* Pass type badges */}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <div style={{
                    flex: 1, background: "rgba(6,182,212,0.08)",
                    border: "1px solid rgba(6,182,212,0.20)",
                    borderRadius: 10, padding: "8px 12px",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <Shield size={16} color="#06b6d4" />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: "#06b6d4" }}>Passe Comum</div>
                      <div style={{ fontSize: 10, color: "#334155" }}>Grátis · Sempre ativo</div>
                    </div>
                    <Check size={14} color="#22c55e" style={{ marginLeft: "auto" }} />
                  </div>

                  <div style={{
                    flex: 1,
                    background: passData.hasPremium
                      ? "rgba(217,119,6,0.12)"
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${passData.hasPremium ? "rgba(217,119,6,0.35)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 10, padding: "8px 12px",
                    display: "flex", alignItems: "center", gap: 8,
                    cursor: passData.hasPremium ? "default" : "pointer",
                  }} onClick={passData.hasPremium ? undefined : () => setShowPremiumModal(true)}>
                    <Crown size={16} color={passData.hasPremium ? "#f59e0b" : "#475569"} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: passData.hasPremium ? "#f59e0b" : "#475569" }}>
                        Passe Premium
                      </div>
                      <div style={{ fontSize: 10, color: "#334155" }}>
                        {passData.hasPremium ? "Ativo ✓" : PREMIUM_PRICE}
                      </div>
                    </div>
                    {!passData.hasPremium && (
                      <Lock size={13} color="#475569" style={{ marginLeft: "auto" }} />
                    )}
                  </div>
                </div>
              </div>

              {/* ── REWARD TRACK ── */}
              <div style={{ marginTop: 20, paddingBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px 10px" }}>
                  <h2 style={{ fontWeight: 900, fontSize: 14, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
                    Trilha de Recompensas
                  </h2>
                  <span style={{ fontSize: 11, color: "#334155" }}>
                    Nível atual: <strong style={{ color: "#06b6d4" }}>{passData.currentLevel}</strong>
                  </span>
                </div>

                {/* Horizontal scroll track */}
                <div ref={passRowRef} style={{
                  overflowX: "auto", paddingBottom: 8,
                  scrollbarWidth: "none",
                }}>
                  <div style={{
                    display: "flex", alignItems: "stretch",
                    gap: 0, paddingLeft: 16, paddingRight: 16,
                    minWidth: "max-content",
                  }}>
                    {levelGroups.map((lg, idx) => {
                      const isCurrent = lg.level === passData.currentLevel + 1
                      const isPast = lg.level <= passData.currentLevel

                      return (
                        <div key={lg.level} data-level={lg.level} style={{ display: "flex", alignItems: "center" }}>
                          {/* Level column */}
                          <div style={{ width: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>

                            {/* Premium reward (top) */}
                            <button
                              onClick={() => {
                                if (isPast) handleClaimPassReward(lg.level, true)
                              }}
                              style={{
                                width: 56, height: 56, borderRadius: 14,
                                display: "flex", flexDirection: "column", alignItems: "center",
                                justifyContent: "center", gap: 2, cursor: isPast ? "pointer" : "default",
                                border: `1.5px solid ${
                                  lg.premiumClaimed ? "rgba(34,197,94,0.30)" :
                                  isPast && passData.hasPremium ? "rgba(251,191,36,0.50)" :
                                  isPast ? "rgba(251,191,36,0.25)" :
                                  "rgba(255,255,255,0.07)"
                                }`,
                                background: lg.premiumClaimed
                                  ? "rgba(34,197,94,0.08)"
                                  : isPast && passData.hasPremium
                                  ? "rgba(217,119,6,0.15)"
                                  : isPast
                                  ? "rgba(217,119,6,0.08)"
                                  : "rgba(255,255,255,0.03)",
                                position: "relative",
                                transition: "all 0.2s",
                                transform: isCurrent ? "scale(1.08)" : "scale(1)",
                                boxShadow: isCurrent && passData.hasPremium
                                  ? "0 0 16px rgba(251,191,36,0.25)"
                                  : "none",
                              }}>
                              {lg.premiumClaimed ? (
                                <Check size={20} color="#22c55e" />
                              ) : !isPast ? (
                                <Lock size={14} color="#334155" />
                              ) : lg.premium ? (
                                <RewardIcon reward={lg.premium} />
                              ) : null}
                              {/* Crown badge */}
                              <Crown size={8} color="#f59e0b" style={{ position: "absolute", top: 3, right: 3 }} />
                            </button>

                            {/* Connector line */}
                            <div style={{
                              width: 2, height: 12,
                              background: isPast ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.06)",
                              borderRadius: 99,
                            }} />

                            {/* Level badge */}
                            <div style={{
                              width: 36, height: 22,
                              background: isCurrent
                                ? "linear-gradient(135deg,#0e7490,#0369a1)"
                                : isPast
                                ? "rgba(6,182,212,0.15)"
                                : "rgba(255,255,255,0.05)",
                              borderRadius: 8,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: `1px solid ${isCurrent ? "rgba(6,182,212,0.6)" : isPast ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.07)"}`,
                              boxShadow: isCurrent ? "0 0 10px rgba(6,182,212,0.35)" : "none",
                            }}>
                              <span style={{
                                fontSize: 9, fontWeight: 900,
                                color: isCurrent ? "#e0f2fe" : isPast ? "#38bdf8" : "#334155",
                              }}>{lg.level}</span>
                            </div>

                            <div style={{
                              width: 2, height: 12,
                              background: isPast ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.06)",
                              borderRadius: 99,
                            }} />

                            {/* Common reward (bottom) */}
                            <button
                              onClick={() => {
                                if (isPast) handleClaimPassReward(lg.level, false)
                              }}
                              style={{
                                width: 56, height: 56, borderRadius: 14,
                                display: "flex", flexDirection: "column", alignItems: "center",
                                justifyContent: "center", gap: 2, cursor: isPast ? "pointer" : "default",
                                border: `1.5px solid ${
                                  lg.commonClaimed ? "rgba(34,197,94,0.30)" :
                                  isPast ? "rgba(6,182,212,0.35)" :
                                  "rgba(255,255,255,0.07)"
                                }`,
                                background: lg.commonClaimed
                                  ? "rgba(34,197,94,0.08)"
                                  : isPast
                                  ? "rgba(6,182,212,0.10)"
                                  : "rgba(255,255,255,0.03)",
                                transition: "all 0.2s",
                                transform: isCurrent ? "scale(1.08)" : "scale(1)",
                                boxShadow: isCurrent ? "0 0 12px rgba(6,182,212,0.20)" : "none",
                              }}>
                              {lg.commonClaimed ? (
                                <Check size={20} color="#22c55e" />
                              ) : !isPast ? (
                                <Lock size={14} color="#334155" />
                              ) : lg.common ? (
                                <RewardIcon reward={lg.common} />
                              ) : null}
                            </button>

                          </div>

                          {/* Horizontal connector */}
                          {idx < MAX_LEVELS - 1 && (
                            <div style={{
                              width: 8, height: 2, alignSelf: "center",
                              marginTop: -60, // align with level badge row
                              background: lg.isUnlocked ? "rgba(6,182,212,0.35)" : "rgba(255,255,255,0.05)",
                            }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "6px 16px 0", marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Crown size={10} color="#f59e0b" />
                    <span style={{ fontSize: 10, color: "#64748b" }}>Recompensa Premium (topo)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Shield size={10} color="#06b6d4" />
                    <span style={{ fontSize: 10, color: "#64748b" }}>Recompensa Comum (baixo)</span>
                  </div>
                </div>
              </div>

              {/* Notable milestones */}
              <div style={{ margin: "20px 16px 0" }}>
                <h3 style={{ fontWeight: 900, fontSize: 13, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                  🏆 Marcos Especiais
                </h3>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {[10, 25, 50, 75, 100].map(milestone => {
                    const unlocked = milestone <= passData.currentLevel
                    return (
                      <div key={milestone} style={{
                        minWidth: 110, borderRadius: 14, padding: "12px 10px",
                        background: unlocked ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${unlocked ? "rgba(6,182,212,0.25)" : "rgba(255,255,255,0.07)"}`,
                        textAlign: "center", flexShrink: 0,
                      }}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>
                          {milestone === 100 ? "👑" : milestone === 50 ? "⚔️" : "🎁"}
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 11, color: unlocked ? "#06b6d4" : "#334155" }}>
                          Nível {milestone}
                        </div>
                        <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>
                          {milestone === 100 ? "Carta LR Exclusiva" :
                           milestone === 50 ? "Playmat Premium" :
                           milestone === 25 ? "Pack UR" :
                           "Pack SR"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── MISSIONS TAB ── */}
          {activeTab === "missions" && (
            <div style={{ padding: "16px 16px 0" }}>
              {/* Filter pills */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
                {(["all", "daily", "weekly", "limited"] as const).map(f => (
                  <button key={f} onClick={() => setMissionFilter(f)} style={{
                    padding: "6px 14px", borderRadius: 20, border: "none",
                    cursor: "pointer", fontWeight: 800, fontSize: 11, whiteSpace: "nowrap",
                    transition: "all 0.2s",
                    background: missionFilter === f
                      ? "linear-gradient(135deg,rgba(6,182,212,0.25),rgba(139,92,246,0.20))"
                      : "rgba(255,255,255,0.05)",
                    color: missionFilter === f ? "#e2e8f0" : "#475569",
                    border: `1px solid ${missionFilter === f ? "rgba(6,182,212,0.30)" : "rgba(255,255,255,0.07)"}`,
                  }}>
                    {f === "all" ? "Todas" : f === "daily" ? "Diárias" : f === "weekly" ? "Semanais" : "Limitadas"}
                  </button>
                ))}
              </div>

              {/* Info banner */}
              <div style={{
                background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.18)",
                borderRadius: 14, padding: "10px 14px", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <Zap size={16} color="#06b6d4" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12, color: "#e2e8f0" }}>
                    Complete missões para ganhar pontos!
                  </div>
                  <div style={{ fontSize: 10, color: "#475569" }}>
                    Os pontos sobem tanto no Passe Comum quanto no Premium.
                  </div>
                </div>
              </div>

              {/* Mission list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredMissions.map(mission => (
                  <MissionCard key={mission.id} mission={mission} onClaim={handleClaimMission} />
                ))}
              </div>

              {filteredMissions.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#334155" }}>
                  <Target size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                  <p style={{ fontSize: 13, fontWeight: 700 }}>Nenhuma missão disponível</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── PREMIUM MODAL ── */}
      {showPremiumModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.80)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "linear-gradient(160deg,#0a0616,#0d0b20,#080618)",
            border: "1px solid rgba(217,119,6,0.35)",
            borderRadius: 28, padding: "28px 24px", maxWidth: 380, width: "100%",
            boxShadow: "0 24px 80px rgba(217,119,6,0.20)",
            position: "relative",
          }}>
            {/* Close */}
            <button onClick={() => setShowPremiumModal(false)} style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10, width: 32, height: 32, cursor: "pointer",
              color: "#64748b", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>

            {/* Icon */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20, margin: "0 auto 12px",
                background: "linear-gradient(145deg,#92400e,#b45309,#d97706)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(217,119,6,0.35)",
              }}>
                <Crown size={32} color="#fff" />
              </div>
              <h2 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 6px" }}>
                Gear Pass Premium
              </h2>
              <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
                Desbloqueie recompensas exclusivas por toda a temporada!
              </p>
            </div>

            {/* Benefits */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {[
                { icon: "🃏", text: "Recompensas Premium em todos os 100 níveis" },
                { icon: "👑", text: "Carta LR Exclusiva ao atingir Nível 100" },
                { icon: "🖼️", text: "4 Playmats exclusivos do Passe" },
                { icon: "💎", text: "Packs UR e SR em marcos especiais" },
                { icon: "⚡", text: "Bônus de coins dobrado nas recompensas" },
                { icon: "🔓", text: "Válido por toda a Temporada 1 (30 dias)" },
              ].map((b, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px",
                }}>
                  <span style={{ fontSize: 16 }}>{b.icon}</span>
                  <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>{b.text}</span>
                </div>
              ))}
            </div>

            {/* Price and CTA */}
            <div style={{
              background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.20)",
              borderRadius: 16, padding: "16px", marginBottom: 16, textAlign: "center",
            }}>
              <div style={{ color: "#f59e0b", fontWeight: 900, fontSize: 28, lineHeight: 1 }}>
                {PREMIUM_PRICE}
              </div>
              <div style={{ color: "#78350f", fontSize: 11, marginTop: 4 }}>
                Pagamento único · Sem renovação automática
              </div>
            </div>

            <button onClick={openStripeCheckout} style={{
              width: "100%", padding: "16px 0", borderRadius: 16,
              background: "linear-gradient(135deg,#92400e,#b45309,#d97706,#f59e0b)",
              border: "none", cursor: "pointer",
              color: "#fff", fontWeight: 900, fontSize: 16,
              boxShadow: "0 8px 32px rgba(217,119,6,0.40)",
              letterSpacing: "0.02em",
            }}>
              👑 Comprar Agora
            </button>

            <p style={{ textAlign: "center", fontSize: 10, color: "#334155", marginTop: 12 }}>
              As missões do Passe Comum também contribuem pontos ao Passe Premium.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
