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

// ─── Progressive level cost ────────────────────────────────────────────────────
// Custo para passar do nível N-1 para o nível N: começa em 25 pts, +5 a cada nível
// ptsForLevel(1)=25, ptsForLevel(2)=30, ptsForLevel(3)=35, ...
const ptsForLevel = (lvl: number): number => 20 + lvl * 5

// Pontos cumulativos para ALCANÇAR o nível N (chegar ao nível N)
// Σ(i=1..N) of (20 + 5i) = 20N + 5·N·(N+1)/2
const totalPtsToReachLevel = (lvl: number): number =>
  lvl <= 0 ? 0 : 20 * lvl + Math.round(5 * lvl * (lvl + 1) / 2)

// Nível calculado a partir dos pontos totais acumulados
const levelFromPts = (pts: number): number => {
  let lvl = 0
  while (lvl < MAX_LEVELS && pts >= totalPtsToReachLevel(lvl + 1)) lvl++
  return lvl
}
const MAX_LEVELS = 100
const VISIBLE = 7          // Número de níveis visíveis por vez na trilha
const PREMIUM_PRICE = "R$22,99"
const PREMIUM_PRICE_LABEL = "Gear Pass Premium"
const STRIPE_PAYMENT_URL = "https://buy.stripe.com/aFafZj1lMfdqdRV5Pk4gg01"
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

function RewardIcon({ reward, small }: { reward: PassReward; small?: boolean }) {
  const iconSize = small ? 22 : 28
  const emojiSize = small ? 18 : 24
  const rarityColor: Record<string, string> = {
    R: "#60a5fa", SR: "#c084fc", UR: "#fbbf24", LR: "#f87171",
  }

  if (reward.type === "coins") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <img src="/images/icons/gacha-coin.png" alt="Coins"
          style={{ width: iconSize, height: iconSize, objectFit: "contain" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
        {reward.amount && (
          <span style={{ fontSize: 8, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>
            +{reward.amount}
          </span>
        )}
      </div>
    )
  }
  if (reward.type === "gacha_coin") return <div style={{ fontSize: emojiSize }}>🎰</div>
  if (reward.type === "card_pack") {
    return (
      <div style={{ fontSize: 10, fontWeight: 900, lineHeight: 1, textAlign: "center" }}>
        <div style={{ fontSize: emojiSize }}>📦</div>
        {reward.rarity && <div style={{ color: rarityColor[reward.rarity], fontSize: 8, marginTop: 1 }}>{reward.rarity}</div>}
      </div>
    )
  }
  if (reward.type === "exclusive_card") return <div style={{ fontSize: emojiSize }}>🃏</div>
  if (reward.type === "playmat")       return <div style={{ fontSize: emojiSize }}>🖼️</div>
  if (reward.type === "avatar_frame")  return <div style={{ fontSize: emojiSize }}>👑</div>
  if (reward.type === "title")         return <div style={{ fontSize: emojiSize }}>🏅</div>
  return <Star size={iconSize - 4} color="#94a3b8" />
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
  // Lê o wallpaper ativo do jogador (mesmo sistema do main menu)
  const wallpaperUrl = typeof window !== "undefined"
    ? `/images/wallpapers/${localStorage.getItem("gpgame_selected_wallpaper") ?? "fehnon_wallpaper"}.png`
    : "/images/wallpapers/fehnon_wallpaper.png"
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

  // ── Helpers para reset de missões ───────────────────────────────────────────
  const getDayKey  = () => new Date().toISOString().slice(0, 10)          // "YYYY-MM-DD"
  const getWeekKey = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const mon = new Date(d); mon.setDate(diff)
    return mon.toISOString().slice(0, 10)                                   // Monday of current week
  }

  // Claimed missions stored as { id: { claimedAt, dayKey, weekKey } }
  const [claimedMissionIds, setClaimedMissionIds] = useState<Record<string, { dayKey: string; weekKey: string }>>(() => {
    if (typeof window === "undefined") return {}
    try {
      const saved = localStorage.getItem(LS_MISSIONS_KEY)
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      // Migrate old format (array) to new format (object)
      if (Array.isArray(parsed)) {
        const obj: Record<string, { dayKey: string; weekKey: string }> = {}
        parsed.forEach((id: string) => {
          obj[id] = { dayKey: getDayKey(), weekKey: getWeekKey() }
        })
        return obj
      }
      return parsed
    } catch {}
    return {}
  })

  // Check if a mission is still validly claimed (not expired by reset)
  const isMissionClaimed = (id: string, type: "daily" | "weekly" | "limited"): boolean => {
    const entry = claimedMissionIds[id]
    if (!entry) return false
    if (type === "daily")   return entry.dayKey  === getDayKey()
    if (type === "weekly")  return entry.weekKey === getWeekKey()
    return true  // limited never resets
  }

  const claimMission = (id: string, type: "daily" | "weekly" | "limited") => {
    setClaimedMissionIds(prev => ({
      ...prev,
      [id]: { dayKey: getDayKey(), weekKey: getWeekKey() },
    }))
  }

  // ── currentDayKey: muda à meia-noite e força re-avaliação das missões ────────
  const [currentDayKey, setCurrentDayKey] = useState(() => getDayKey())

  // Login diário — apenas no mount, não a cada claim
  useEffect(() => { trackDailyLogin() }, [])

  // Detecta virada de dia a cada 60s e atualiza currentDayKey
  useEffect(() => {
    const check = () => {
      const today = getDayKey()
      if (today !== currentDayKey) setCurrentDayKey(today)
    }
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [currentDayKey])

  // Missões lidas ao vivo do tracker + status de claimed
  const [missions, setMissions] = useState<PassMission[]>(() =>
    buildMissions().map(m => ({ ...m, claimed: false }))
  )

  // Recarrega progresso das missões a cada 3s
  // Depende de claimedMissionIds (novos claims) e currentDayKey (virada de dia)
  useEffect(() => {
    const refresh = () => {
      const fresh = buildMissions()
      setMissions(fresh.map(m => {
        const claimed = isMissionClaimed(m.id, m.type)
        return {
          ...m,
          claimed,
          ...(claimed ? { completed: true, progress: m.goal } : {}),
        }
      }))
    }
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimedMissionIds, currentDayKey])

  const [activeTab, setActiveTab] = useState<"pass" | "missions">("pass")
  const [missionFilter, setMissionFilter] = useState<"all" | "daily" | "weekly" | "limited">("all")
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null)
  const [focusedLevel, setFocusedLevel] = useState<number | null>(null)
  // Rastreia scrollLeft para saber se as setas estão nos limites
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollMax,  setScrollMax]  = useState(1)
  const passRowRef = useRef<HTMLDivElement>(null)

  // ── Drag com inércia — refs não causam re-render durante o movimento ─────────
  const isDragging        = useRef(false)
  const dragStartX        = useRef(0)
  const scrollAtDragStart = useRef(0)
  const lastDragX         = useRef(0)
  const lastDragTime      = useRef(0)
  const dragVelocity      = useRef(0)          // px/ms no momento do release
  const momentumFrame     = useRef<number | null>(null)

  // Para a animação de inércia anterior antes de começar novo arrasto
  const cancelMomentum = () => {
    if (momentumFrame.current !== null) {
      cancelAnimationFrame(momentumFrame.current)
      momentumFrame.current = null
    }
  }

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    cancelMomentum()
    isDragging.current       = true
    dragStartX.current       = e.pageX
    lastDragX.current        = e.pageX
    lastDragTime.current     = performance.now()
    dragVelocity.current     = 0
    scrollAtDragStart.current = passRowRef.current?.scrollLeft ?? 0
    e.currentTarget.style.cursor     = "grabbing"
    e.currentTarget.style.userSelect = "none"
  }

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !passRowRef.current) return
    e.preventDefault()
    const now = performance.now()
    const dt  = now - lastDragTime.current
    const dx  = e.pageX - lastDragX.current
    // Velocidade em px/ms (suavizada por exponential moving average)
    if (dt > 0) dragVelocity.current = dragVelocity.current * 0.7 + (dx / dt) * 0.3
    lastDragX.current    = e.pageX
    lastDragTime.current = now
    passRowRef.current.scrollLeft = scrollAtDragStart.current - (e.pageX - dragStartX.current)
  }

  const handleTrackMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    isDragging.current = false
    e.currentTarget.style.cursor     = "grab"
    e.currentTarget.style.userSelect = ""

    // ── Inércia: continua deslizando com desaceleração suave ──
    let velocity = dragVelocity.current * 16   // converte px/ms → px/frame (60fps)
    const glide = () => {
      if (!passRowRef.current || Math.abs(velocity) < 0.4) return
      passRowRef.current.scrollLeft -= velocity
      velocity *= 0.88   // atrito — 0.88 dá ~8 frames até parar num arrasto rápido
      momentumFrame.current = requestAnimationFrame(glide)
    }
    if (Math.abs(velocity) > 1) momentumFrame.current = requestAnimationFrame(glide)
  }

  // Largura de cada coluna de nível (px) — usada nas setas para scroll por página
  const COL_WIDTH = 88  // 80px coluna + 8px conector

  // Desloca a trilha para a esquerda ou direita por VISIBLE colunas
  const scrollTrack = (dir: 1 | -1) => {
    passRowRef.current?.scrollBy({ left: dir * COL_WIDTH * VISIBLE, behavior: "smooth" })
  }

  // Atualiza scrollLeft/scrollMax enquanto o usuário arrasta ou usa as setas
  useEffect(() => {
    const el = passRowRef.current
    if (!el) return
    const onScroll = () => {
      setScrollLeft(el.scrollLeft)
      setScrollMax(el.scrollWidth - el.clientWidth)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    onScroll()   // leitura inicial
    return () => el.removeEventListener("scroll", onScroll)
  }, [activeTab])

  // Centraliza no nível atual ao montar / quando o nível muda
  useEffect(() => {
    if (!passRowRef.current) return
    const targetX = Math.max(0, (passData.currentLevel - Math.floor(VISIBLE / 2)) * COL_WIDTH)
    passRowRef.current.scrollTo({ left: targetX, behavior: "smooth" })
  }, [passData.currentLevel])

  // Persist passData
  useEffect(() => {
    localStorage.setItem(LS_PASS_KEY, JSON.stringify(passData))
  }, [passData])

  // Persist claimed mission IDs with timestamps
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
  // Pontos gastos nos níveis anteriores (para calcular progresso no nível atual)
  const ptsSpentBefore      = totalPtsToReachLevel(passData.currentLevel)
  // Pontos acumulados dentro do nível atual (acima do limiar do nível anterior)
  const pointsInCurrentLevel = passData.currentPoints - ptsSpentBefore
  // Custo do próximo nível (de currentLevel → currentLevel + 1)
  const nextLevelCost        = ptsForLevel(passData.currentLevel + 1)
  // Porcentagem de progresso para o próximo nível
  const progressPct          = passData.currentLevel >= MAX_LEVELS
    ? 100
    : Math.min(100, Math.round((pointsInCurrentLevel / nextLevelCost) * 100))
  // Total acumulado para referência no header
  const totalPointsNeeded    = totalPtsToReachLevel(passData.currentLevel)

  const filteredMissions = missionFilter === "all"
    ? missions
    : missions.filter(m => m.type === missionFilter)

  const claimableCount = filteredMissions.filter(m => m.completed && !m.claimed).length

  const handleClaimAll = () => {
    const claimable = filteredMissions.filter(m => m.completed && !m.claimed)
    if (claimable.length === 0) return
    let totalPoints = 0
    claimable.forEach(m => {
      claimMission(m.id, m.type)
      totalPoints += m.points
    })
    const newPoints = passData.currentPoints + totalPoints
    const newLevel = Math.min(MAX_LEVELS, levelFromPts(newPoints))
    setPassData(pd => ({ ...pd, currentPoints: newPoints, currentLevel: newLevel }))
    setClaimFeedback(`+${totalPoints} pontos do Passe!`)
    setTimeout(() => setClaimFeedback(null), 2500)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleClaimMission = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId)
    if (!mission || !mission.completed || mission.claimed) return
    if (isMissionClaimed(missionId, mission.type)) return

    const newPoints = passData.currentPoints + mission.points
    const newLevel = Math.min(MAX_LEVELS, levelFromPts(newPoints))
    setPassData(pd => ({ ...pd, currentPoints: newPoints, currentLevel: newLevel }))
    claimMission(missionId, mission.type)
    setClaimFeedback(`+${mission.points} pontos do Passe!`)
    setTimeout(() => setClaimFeedback(null), 2000)
  }

  // ── Bônus de Conclusão: 300 pts (diárias) / 750 pts (semanais) ──────────────
  const COMPLETION_BONUS = { daily: 300, weekly: 750 } as const

  const getCompletionBonusState = (type: "daily" | "weekly") => {
    const bonusId  = `${type}_completion_bonus`
    const ofType   = missions.filter(m => m.type === type)
    // Todas concluídas ou já coletadas individualmente
    const allDone  = ofType.length > 0 && ofType.every(m => m.completed || m.claimed)
    const claimed  = isMissionClaimed(bonusId, type)
    return { bonusId, allDone, claimed, pts: COMPLETION_BONUS[type] }
  }

  const handleClaimCompletionBonus = (type: "daily" | "weekly") => {
    const { bonusId, allDone, claimed, pts } = getCompletionBonusState(type)
    if (!allDone || claimed) return
    const newPoints = passData.currentPoints + pts
    const newLevel  = Math.min(MAX_LEVELS, levelFromPts(newPoints))
    setPassData(pd => ({ ...pd, currentPoints: newPoints, currentLevel: newLevel }))
    claimMission(bonusId, type)
    setClaimFeedback(`+${pts} pts — Bônus de Conclusão!`)
    setTimeout(() => setClaimFeedback(null), 2800)
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

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: "100dvh", maxHeight: "100dvh",
      display: "flex", flexDirection: "column",
      color: "#f1f5f9",
      fontFamily: "'Segoe UI',system-ui,sans-serif",
      position: "relative", overflow: "hidden",
    }}>

      {/* ── WALLPAPER BACKGROUND ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: "cover", backgroundPosition: "center top",
        filter: "brightness(0.28) saturate(0.7) blur(0px)",
        transform: "scale(1.04)", // evita borda branca do blur
      }} />
      {/* Overlay gradiente — mais escuro à esquerda, deixa o wallpaper aparecer sutilmente à direita */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "linear-gradient(120deg,rgba(2,6,16,0.96) 0%,rgba(2,6,16,0.82) 55%,rgba(2,6,16,0.70) 100%)",
      }} />
      {/* Vinheta ciano no topo */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 35% at 50% 0%,rgba(6,182,212,0.08),transparent 65%)" }} />

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

      {/* ── EVERYTHING ABOVE WALLPAPER ── */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <div style={{
        flexShrink: 0,
        position: "relative",
        background: "rgba(2,6,16,0.75)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(6,182,212,0.14)",
      }}>
        {/* Top bar */}
        <div style={{ padding: "12px 16px 0", display: "flex", alignItems: "center", gap: 12, maxWidth: 700, margin: "0 auto" }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 10, width: 36, height: 36, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#64748b", transition: "all 0.2s", flexShrink: 0,
          }}>
            <ArrowLeft size={17} />
          </button>

          {/* Title block */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "linear-gradient(135deg,rgba(6,182,212,0.25),rgba(6,182,212,0.08))",
              border: "1px solid rgba(6,182,212,0.30)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 12px rgba(6,182,212,0.20)",
            }}>
              <Shield size={17} color="#06b6d4" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.01em", color: "#f1f5f9" }}>Gear Pass</span>
                {passData.hasPremium && (
                  <span style={{
                    background: "linear-gradient(90deg,#b45309,#f59e0b)",
                    borderRadius: 5, padding: "2px 7px",
                    fontSize: 8, fontWeight: 900, color: "#000", letterSpacing: "0.08em",
                  }}>PREMIUM</span>
                )}
              </div>
              {/* Season pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulseGlow 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, color: "#475569" }}>Temporada 1</span>
                <span style={{ fontSize: 10, color: "#1e293b" }}>·</span>
                <span style={{ fontSize: 10, color: "#475569" }}>Encerra em 29 dias</span>
              </div>
            </div>
          </div>

          {!passData.hasPremium && (
            <button onClick={() => setShowPremiumModal(true)} style={{
              background: "linear-gradient(135deg,#92400e,#d97706,#fbbf24)",
              border: "none", borderRadius: 11, padding: "9px 18px",
              color: "#000", fontWeight: 900, fontSize: 11, cursor: "pointer",
              boxShadow: "0 4px 18px rgba(217,119,6,0.40)",
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              letterSpacing: "0.02em",
            }}>
              <Crown size={13} />
              {PREMIUM_PRICE}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", maxWidth: 700, margin: "10px auto 0",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          {(["pass", "missions"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "11px 0", border: "none",
              cursor: "pointer", fontWeight: 800, fontSize: 12,
              transition: "all 0.2s", background: "transparent",
              color: activeTab === tab ? "#06b6d4" : "#334155",
              borderBottom: `2px solid ${activeTab === tab ? "#06b6d4" : "transparent"}`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {tab === "pass" ? <Shield size={13} /> : <Star size={13} />}
              {tab === "pass" ? "Passe" : "Missões"}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      {/* ── CONTENT (flex:1, sem scroll de página) ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", maxWidth: 700, margin: "0 auto", width: "100%" }}>

          {/* ── PASS TAB ── */}
          {activeTab === "pass" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* ── PROGRESS HERO ── */}
              <div style={{
                margin: "10px 14px 0", borderRadius: 18, flexShrink: 0,
                position: "relative", overflow: "hidden",
                background: "rgba(5,13,26,0.65)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(6,182,212,0.18)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
                padding: "14px 18px 12px",
              }}>
                {/* Decorative orb */}
                <div style={{ position:"absolute",top:-50,left:-50,width:180,height:180,borderRadius:"50%",pointerEvents:"none",
                  background:"radial-gradient(circle,rgba(6,182,212,0.10) 0%,transparent 65%)" }} />
                <div style={{ position:"absolute",top:0,right:0,width:100,height:100,pointerEvents:"none",
                  background:"radial-gradient(circle at top right,rgba(139,92,246,0.08),transparent 60%)" }} />

                {/* Level + XP row */}
                <div style={{ position:"relative", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"baseline", gap:6, lineHeight:1 }}>
                    <span style={{ fontSize:42, fontWeight:900, color:"#f1f5f9", letterSpacing:"-0.04em" }}>{passData.currentLevel}</span>
                    <span style={{ fontSize:14, color:"#1e293b", fontWeight:700 }}>/ {MAX_LEVELS}</span>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    {passData.currentLevel >= MAX_LEVELS ? (
                      <div style={{ background:"linear-gradient(135deg,#d97706,#fbbf24)",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:900,color:"#000" }}>MAX</div>
                    ) : (
                      <>
                        <div style={{ fontSize:20,fontWeight:900,color:"#06b6d4",letterSpacing:"-0.02em",lineHeight:1 }}>
                          {pointsInCurrentLevel}<span style={{ fontSize:11,color:"#1e293b",fontWeight:600 }}> / {nextLevelCost} pts</span>
                        </div>
                        <div style={{ fontSize:9,color:"#334155",marginTop:2 }}>para o próximo nível</div>
                      </>
                    )}
                  </div>
                </div>

                {/* XP bar shimmer */}
                <div style={{ position:"relative",height:10,borderRadius:99,background:"rgba(255,255,255,0.06)",overflow:"hidden",marginBottom:10 }}>
                  <div style={{ height:"100%",borderRadius:99,width:`${progressPct}%`,
                    background:"linear-gradient(90deg,#0369a1,#06b6d4,#22d3ee)",
                    boxShadow:"0 0 14px rgba(6,182,212,0.60)",
                    transition:"width 0.8s cubic-bezier(.4,0,.2,1)",position:"relative",overflow:"hidden" }}>
                    <div style={{ position:"absolute",top:0,bottom:0,width:"40%",
                      background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent)",
                      animation:"shimmer 2.2s ease-in-out infinite" }} />
                  </div>
                  <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:7,fontWeight:900,letterSpacing:"0.06em",
                    color: progressPct > 35 ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.22)" }}>{progressPct}%</div>
                </div>

                {/* Pass type cards */}
                <div style={{ display:"flex", gap:8, position:"relative" }}>
                  {/* Common */}
                  <div style={{ flex:1,borderRadius:10,padding:"8px 12px",
                    background:"rgba(6,182,212,0.08)",backdropFilter:"blur(8px)",
                    border:"1px solid rgba(6,182,212,0.20)",
                    display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ width:28,height:28,borderRadius:7,flexShrink:0,
                      background:"rgba(6,182,212,0.14)",border:"1px solid rgba(6,182,212,0.20)",
                      display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Shield size={13} color="#06b6d4" />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:900,fontSize:11,color:"#06b6d4" }}>Passe Comum</div>
                      <div style={{ fontSize:9,color:"#334155" }}>Grátis · Sempre ativo</div>
                    </div>
                    <div style={{ marginLeft:"auto",flexShrink:0,width:16,height:16,borderRadius:"50%",
                      background:"rgba(34,197,94,0.14)",border:"1.5px solid rgba(34,197,94,0.35)",
                      display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Check size={9} color="#22c55e" strokeWidth={3} />
                    </div>
                  </div>
                  {/* Premium */}
                  <div onClick={passData.hasPremium ? undefined : () => setShowPremiumModal(true)} style={{
                    flex:1,borderRadius:10,padding:"8px 12px",
                    background: passData.hasPremium ? "rgba(217,119,6,0.12)" : "rgba(92,40,10,0.10)",
                    backdropFilter:"blur(8px)",
                    border:`1px solid ${passData.hasPremium ? "rgba(251,191,36,0.30)" : "rgba(92,40,10,0.25)"}`,
                    display:"flex",alignItems:"center",gap:8,cursor:passData.hasPremium?"default":"pointer" }}>
                    <div style={{ width:28,height:28,borderRadius:7,flexShrink:0,
                      background:passData.hasPremium?"rgba(245,158,11,0.14)":"rgba(92,40,10,0.18)",
                      border:`1px solid ${passData.hasPremium?"rgba(245,158,11,0.25)":"rgba(92,40,10,0.22)"}`,
                      display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Crown size={13} color={passData.hasPremium?"#f59e0b":"#78350f"} />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:900,fontSize:11,color:passData.hasPremium?"#f59e0b":"#78350f" }}>Passe Premium</div>
                      <div style={{ fontSize:9,color:"#334155" }}>{passData.hasPremium?"Ativo ✓":PREMIUM_PRICE}</div>
                    </div>
                    {!passData.hasPremium && (
                      <div style={{ marginLeft:"auto",flexShrink:0,background:"linear-gradient(135deg,#92400e,#d97706)",
                        borderRadius:5,padding:"2px 7px",fontSize:8,fontWeight:900,color:"#fff" }}>Desbloquear</div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── REWARD TRACK ── */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", marginTop: 8 }}>
                {/* Elegant section header */}
                <div style={{ padding: "0 14px 8px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ height: 1, width: 16, background: "rgba(6,182,212,0.35)", flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.14em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    Trilha de Recompensas
                  </span>
                  <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg,rgba(6,182,212,0.25),transparent)" }} />
                  <div style={{ flexShrink: 0, background: "rgba(6,182,212,0.10)",
                    border: "1px solid rgba(6,182,212,0.22)", borderRadius: 8,
                    padding: "2px 9px", display: "flex", alignItems: "center", gap: 5 }}>
                    <Zap size={9} color="#06b6d4" />
                    <span style={{ fontSize: 10, fontWeight: 900, color: "#06b6d4" }}>Lv.{passData.currentLevel}</span>
                  </div>
                </div>

                {/* Wrapper com setas e trilha scrollável */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4, paddingLeft: 8, paddingRight: 8 }}>

                  {/* ← Seta anterior */}
                  <button
                    onClick={() => scrollTrack(-1)}
                    disabled={scrollLeft <= 0}
                    style={{
                      flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: scrollLeft <= 0 ? "rgba(255,255,255,0.02)" : "rgba(6,182,212,0.14)",
                      color: scrollLeft <= 0 ? "#1e293b" : "#06b6d4",
                      cursor: scrollLeft <= 0 ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 900, transition: "all 0.2s",
                      boxShadow: scrollLeft <= 0 ? "none" : "0 0 8px rgba(6,182,212,0.20)",
                      userSelect: "none",
                    }}>‹</button>

                  {/* Trilha scrollável — suporta toque, arrasto e setas */}
                  <div
                    ref={passRowRef}
                    className="gp-track"
                    style={{
                      flex: 1,
                      overflowX: "scroll",
                      // Oculta scrollbar no Firefox
                      scrollbarWidth: "none",
                      // Cursor de "agarrar"
                      cursor: "grab",
                      // Permite pan horizontal no touch sem interferir no scroll vertical da página
                      touchAction: "pan-x",
                      // Evita seleção de texto enquanto arrasta
                      userSelect: "none",
                    }}
                    onMouseDown={handleTrackMouseDown}
                    onMouseMove={handleTrackMouseMove}
                    onMouseUp={handleTrackMouseUp}
                    onMouseLeave={handleTrackMouseUp}
                  >
                    <div style={{
                        display: "flex",
                        alignItems: "stretch",
                        paddingLeft: 8,
                        paddingRight: 8,
                        width: `${MAX_LEVELS * COL_WIDTH + 16}px`,
                      }}
                    >
                      {levelGroups.map((lg, idx) => {
                        const isCurrent = lg.level === passData.currentLevel + 1
                        const isPast    = lg.level <= passData.currentLevel
                        const isLast    = idx === levelGroups.length - 1

                        return (
                          <div
                            key={lg.level}
                            data-level={lg.level}
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            {/* Coluna do nível — largura fixa para manter ritmo visual */}
                            <div style={{ width: 70, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>

                              {/* ── PREMIUM reward (topo) ── */}
                              <button
                                onClick={() => { if (isPast) handleClaimPassReward(lg.level, true) }}
                                style={{
                                  width: 46, height: 46, borderRadius: 11,
                                  display: "flex", flexDirection: "column", alignItems: "center",
                                  justifyContent: "center", gap: 1,
                                  cursor: isPast && passData.hasPremium ? "pointer" : "default",
                                  border: `1.5px solid ${
                                    lg.premiumClaimed          ? "rgba(34,197,94,0.50)"   :
                                    isPast && passData.hasPremium ? "rgba(251,191,36,0.60)" :
                                    isPast                     ? "rgba(251,191,36,0.28)"  :
                                    "rgba(251,191,36,0.16)"
                                  }`,
                                  background: lg.premiumClaimed
                                    ? "rgba(34,197,94,0.10)"
                                    : isPast && passData.hasPremium
                                    ? "rgba(217,119,6,0.18)"
                                    : isPast
                                    ? "rgba(217,119,6,0.10)"
                                    : "linear-gradient(145deg,rgba(180,83,9,0.14),rgba(120,53,15,0.08))",
                                  boxShadow: lg.premiumClaimed
                                    ? "0 0 10px rgba(34,197,94,0.20), inset 0 0 6px rgba(34,197,94,0.08)"
                                    : isPast && passData.hasPremium
                                    ? "0 0 14px rgba(251,191,36,0.28)"
                                    : !isPast
                                    ? "inset 0 0 14px rgba(251,191,36,0.06)"
                                    : "none",
                                  position: "relative", transition: "all 0.2s",
                                  transform: isCurrent ? "scale(1.08)" : "scale(1)",
                                }}>
                                {lg.premiumClaimed ? (
                                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(34,197,94,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Check size={16} color="#22c55e" strokeWidth={3} />
                                  </div>
                                ) : !isPast ? (
                                  <Lock size={14} color="#78350f" />
                                ) : lg.premium ? (
                                  <RewardIcon reward={lg.premium} />
                                ) : null}
                                <Crown size={8} color="#f59e0b" style={{ position: "absolute", top: 3, right: 3 }} />
                              </button>

                              {/* Conector vertical superior */}
                              <div style={{ width: 2, height: 12, background: isPast ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.06)", borderRadius: 99 }} />

                              {/* Badge do nível */}
                              <div style={{
                                width: 36, height: 22, borderRadius: 8,
                                background: isCurrent ? "linear-gradient(135deg,#0e7490,#0369a1)" : isPast ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.05)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: `1px solid ${isCurrent ? "rgba(6,182,212,0.6)" : isPast ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.07)"}`,
                                boxShadow: isCurrent ? "0 0 10px rgba(6,182,212,0.35)" : "none",
                              }}>
                                <span style={{ fontSize: 9, fontWeight: 900, color: isCurrent ? "#e0f2fe" : isPast ? "#38bdf8" : "#334155" }}>{lg.level}</span>
                              </div>

                              {/* Conector vertical inferior */}
                              <div style={{ width: 2, height: 12, background: isPast ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.06)", borderRadius: 99 }} />

                              {/* ── COMMON reward (baixo) — TRILHA ATIVA ── */}
                              <button
                                onClick={() => { if (isPast) handleClaimPassReward(lg.level, false) }}
                                style={{
                                  width: 46, height: 46, borderRadius: 11,
                                  display: "flex", flexDirection: "column", alignItems: "center",
                                  justifyContent: "center", gap: 1,
                                  cursor: isPast ? "pointer" : "default",
                                  border: `1.5px solid ${
                                    lg.commonClaimed ? "rgba(34,197,94,0.55)" :
                                    isPast           ? "rgba(6,182,212,0.50)"  :
                                    isCurrent        ? "rgba(6,182,212,0.28)"  :
                                    "rgba(255,255,255,0.07)"
                                  }`,
                                  background: lg.commonClaimed
                                    ? "rgba(34,197,94,0.12)"
                                    : isPast   ? "rgba(6,182,212,0.13)"
                                    : isCurrent ? "rgba(6,182,212,0.07)"
                                    : "rgba(255,255,255,0.03)",
                                  boxShadow: lg.commonClaimed
                                    ? "0 0 12px rgba(34,197,94,0.25), inset 0 0 8px rgba(34,197,94,0.10)"
                                    : isPast    ? "0 0 8px rgba(6,182,212,0.18)"
                                    : isCurrent ? "0 0 10px rgba(6,182,212,0.22)"
                                    : "none",
                                  transition: "all 0.2s",
                                  transform: isCurrent ? "scale(1.08)" : "scale(1)",
                                  opacity: lg.commonClaimed ? 0.85 : 1,
                                }}>
                                {lg.commonClaimed ? (
                                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(34,197,94,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Check size={16} color="#22c55e" strokeWidth={3} />
                                  </div>
                                ) : !isPast ? (
                                  <Lock size={14} color="#334155" />
                                ) : lg.common ? (
                                  <RewardIcon reward={lg.common} />
                                ) : null}
                              </button>

                            </div>

                            {/* Conector horizontal entre colunas */}
                            {!isLast && (
                              <div style={{
                                width: 8, height: 2, alignSelf: "center", marginTop: -60,
                                background: lg.isUnlocked ? "rgba(6,182,212,0.35)" : "rgba(255,255,255,0.05)",
                              }} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* → Seta próximo */}
                  <button
                    onClick={() => scrollTrack(1)}
                    disabled={scrollLeft >= scrollMax - 1}
                    style={{
                      flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: scrollLeft >= scrollMax - 1 ? "rgba(255,255,255,0.02)" : "rgba(6,182,212,0.14)",
                      color: scrollLeft >= scrollMax - 1 ? "#1e293b" : "#06b6d4",
                      cursor: scrollLeft >= scrollMax - 1 ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 900, transition: "all 0.2s",
                      boxShadow: scrollLeft >= scrollMax - 1 ? "none" : "0 0 8px rgba(6,182,212,0.20)",
                      userSelect: "none",
                    }}>›</button>
                </div>

                {/* Dica de arrastar */}
                <div style={{ textAlign: "center", marginTop: 6, fontSize: 9, color: "#1e293b", letterSpacing: "0.04em" }}>
                  ← arraste ou use as setas para navegar →
                </div>

                {/* Legenda */}
                <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "6px 16px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Crown size={10} color="#f59e0b" />
                    <span style={{ fontSize: 10, color: "#64748b" }}>Recompensa Premium (topo)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Shield size={10} color="#06b6d4" />
                    <span style={{ fontSize: 10, color: "#06b6d4", fontWeight: 700 }}>Trilha Ativa — Comum (baixo)</span>
                  </div>
                </div>
              </div>

              {/* ── MARCOS ESPECIAIS — strip compacto ── */}
              <div style={{ padding: "6px 14px 8px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase" }}>🏆 Marcos</span>
                  <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg,rgba(255,255,255,0.06),transparent)" }} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[10, 25, 50, 75, 100].map(milestone => {
                    const unlocked = milestone <= passData.currentLevel
                    const icons: Record<number, string> = { 100: "👑", 50: "⚔️", 75: "🎁", 25: "🎁", 10: "🎁" }
                    const labels: Record<number, string> = { 100: "Carta LR", 75: "Pack SR", 50: "Playmat", 25: "Pack UR", 10: "Pack SR" }
                    return (
                      <div key={milestone} style={{
                        flex: 1, borderRadius: 10, padding: "7px 6px",
                        background: unlocked ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${unlocked ? "rgba(6,182,212,0.22)" : "rgba(255,255,255,0.06)"}`,
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 14, lineHeight: 1, marginBottom: 3 }}>{icons[milestone]}</div>
                        <div style={{ fontWeight: 900, fontSize: 9, color: unlocked ? "#06b6d4" : "#334155" }}>Lv.{milestone}</div>
                        <div style={{ fontSize: 8, color: "#1e293b", marginTop: 1 }}>{labels[milestone]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>   {/* end pass tab flex column */}
          )}

          {/* ── MISSIONS TAB ── */}
          {activeTab === "missions" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "10px 14px 0" }}>
              {/* Filter pills + Coletar Tudo */}
              <div style={{ flexShrink: 0, display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", alignItems: "center" }}>
                {(["all", "daily", "weekly", "limited"] as const).map(f => (
                  <button key={f} onClick={() => setMissionFilter(f)} style={{
                    padding: "5px 12px", borderRadius: 20, border: "none",
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
                <div style={{ flex: 1 }} />
                {/* Coletar Tudo */}
                <button
                  onClick={handleClaimAll}
                  disabled={claimableCount === 0}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "none",
                    cursor: claimableCount > 0 ? "pointer" : "not-allowed",
                    fontWeight: 800, fontSize: 11, whiteSpace: "nowrap",
                    transition: "all 0.2s",
                    background: claimableCount > 0
                      ? "linear-gradient(135deg,#16a34a,#22c55e)"
                      : "rgba(255,255,255,0.04)",
                    color: claimableCount > 0 ? "#fff" : "#334155",
                    boxShadow: claimableCount > 0 ? "0 2px 12px rgba(34,197,94,0.35)" : "none",
                    opacity: claimableCount > 0 ? 1 : 0.5,
                  }}>
                  ✓ Coletar Tudo{claimableCount > 0 ? ` (${claimableCount})` : ""}
                </button>
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

              {/* Mission list — scrolls internally so page never scrolls */}
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
                {filteredMissions.map(mission => (
                  <MissionCard key={mission.id} mission={mission} onClaim={handleClaimMission} />
                ))}
              </div>

              {/* ── Bônus de Conclusão — aparece nas abas Diárias e Semanais ── */}
              {(missionFilter === "daily" || missionFilter === "weekly") && (() => {
                const { allDone, claimed, pts } = getCompletionBonusState(missionFilter)
                const color = missionFilter === "daily" ? "#06b6d4" : "#a78bfa"
                const label = missionFilter === "daily" ? "Diárias" : "Semanais"
                const icon  = missionFilter === "daily" ? "☀️" : "📅"
                return (
                  <div style={{
                    marginTop: 6,
                    padding: "14px 18px",
                    borderRadius: 14,
                    border: `1.5px solid ${claimed ? "rgba(34,197,94,0.40)" : allDone ? `${color}60` : "rgba(255,255,255,0.07)"}`,
                    background: claimed
                      ? "rgba(34,197,94,0.07)"
                      : allDone
                      ? `linear-gradient(135deg,${color}15,${color}06)`
                      : "rgba(255,255,255,0.02)",
                    boxShadow: allDone && !claimed ? `0 0 20px ${color}20` : "none",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    transition: "all 0.3s",
                  }}>
                    {/* Left: icon + text */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: claimed
                          ? "rgba(34,197,94,0.15)"
                          : allDone
                          ? `${color}20`
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${claimed ? "rgba(34,197,94,0.35)" : allDone ? `${color}40` : "rgba(255,255,255,0.07)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20,
                      }}>
                        {claimed ? "✅" : allDone ? "🏆" : icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: claimed ? "#4ade80" : allDone ? "#f1f0ee" : "#475569", marginBottom: 2 }}>
                          Bônus de Conclusão {label}
                        </div>
                        <div style={{ fontSize: 11, color: claimed ? "#4ade80" : allDone ? color : "#334155" }}>
                          {claimed
                            ? "✓ Bônus coletado!"
                            : allDone
                            ? "Todas as missões concluídas — colete seu bônus!"
                            : `Complete todas as missões ${label.toLowerCase()} para desbloquear`}
                        </div>
                      </div>
                    </div>

                    {/* Right: pts badge + button */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <div style={{
                        background: claimed ? "rgba(34,197,94,0.15)" : allDone ? `${color}22` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${claimed ? "rgba(34,197,94,0.30)" : allDone ? `${color}40` : "rgba(255,255,255,0.07)"}`,
                        borderRadius: 10, padding: "6px 10px", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: claimed ? "#4ade80" : allDone ? color : "#334155", lineHeight: 1 }}>
                          +{pts}
                        </div>
                        <div style={{ fontSize: 9, color: claimed ? "#4ade80" : allDone ? color : "#1e293b", fontWeight: 700 }}>pts</div>
                      </div>

                      <button
                        onClick={() => handleClaimCompletionBonus(missionFilter)}
                        disabled={!allDone || claimed}
                        style={{
                          padding: "8px 16px", borderRadius: 10, fontWeight: 800, fontSize: 12,
                          cursor: allDone && !claimed ? "pointer" : "not-allowed",
                          border: "none", transition: "all 0.2s",
                          background: claimed
                            ? "rgba(34,197,94,0.15)"
                            : allDone
                            ? `linear-gradient(135deg,${color},${color}cc)`
                            : "rgba(255,255,255,0.04)",
                          color: claimed ? "#4ade80" : allDone ? "#fff" : "#334155",
                          boxShadow: allDone && !claimed ? `0 4px 14px ${color}40` : "none",
                          opacity: !allDone && !claimed ? 0.5 : 1,
                        }}>
                        {claimed ? "✓ Coletado" : allDone ? "Coletar" : "Bloqueado"}
                      </button>
                    </div>
                  </div>
                )
              })()}

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
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes pulseGlow {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .gp-track::-webkit-scrollbar { display: none; }
        .mission-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      </div>{/* end EVERYTHING ABOVE WALLPAPER */}
    </div>
  )
}
