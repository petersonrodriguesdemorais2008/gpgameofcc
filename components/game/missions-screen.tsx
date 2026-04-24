"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import {
  ArrowLeft, Target, Calendar, Star, Gift, Check,
  Sparkles, Flame, Swords, BookOpen, Users, Lock, Trophy, Crown,
} from "lucide-react"
import {
  getMissionProgress,
  trackDailyLogin,
} from "@/lib/mission-tracker"

// ─── Coin Icon com fallback SVG ───────────────────────────────────────────────
function CoinIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <img
        src="/images/icons/gacha-coin.png"
        alt="Coin"
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: "contain" }}
        onError={() => setFailed(true)}
      />
    )
  }

  // Fallback SVG – anel dourado com brilho
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <defs>
        <radialGradient id="coinGrad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </radialGradient>
        <radialGradient id="coinShine" cx="35%" cy="30%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="#B45309" />
      <circle cx="12" cy="12" r="10" fill="url(#coinGrad)" />
      <circle cx="12" cy="12" r="10" fill="url(#coinShine)" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#92400E" fontFamily="serif">$</text>
    </svg>
  )
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface MissionsScreenProps { onBack: () => void }

interface Mission {
  id: string
  name: string
  description: string
  type: "daily" | "weekly" | "special"
  category: "gacha" | "battle" | "collection" | "social" | "general"
  icon: React.ReactNode
  progress: number
  maxProgress: number
  reward: { coins?: number; fp?: number; item?: string }
  completed: boolean
  claimed: boolean
}

// ─── Utilitários de Tempo ─────────────────────────────────────────────────────
function getNextMidnightUTC() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime()
}
function getNextMondayMidnightUTC() {
  const now = new Date(); const day = now.getUTCDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday)).getTime()
}
function getEventEndTimestamp() {
  const KEY = "missions_event_end"
  if (typeof window === "undefined") return Date.now() + 30 * 86400000
  const stored = localStorage.getItem(KEY)
  if (stored) { const ts = parseInt(stored, 10); if (!isNaN(ts) && ts > Date.now()) return ts }
  const end = Date.now() + 30 * 86400000
  localStorage.setItem(KEY, String(end))
  return end
}
function formatCountdown(ms: number) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  const s = Math.floor(ms / 1000)
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}
const pad = (n: number) => String(n).padStart(2, "0")

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function CountdownTimer({ targetMs, label, color }: { targetMs: number; label: string; color: "cyan" | "purple" | "amber" }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()))
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [targetMs])
  const { days, hours, minutes, seconds } = formatCountdown(remaining)
  const cm = {
    cyan:   { pill: "bg-cyan-500/10 border-cyan-500/30",   text: "text-cyan-300",   dot: "bg-cyan-400",   ping: "bg-cyan-400",   bar: "bg-cyan-400" },
    purple: { pill: "bg-purple-500/10 border-purple-500/30", text: "text-purple-300", dot: "bg-purple-400", ping: "bg-purple-400", bar: "bg-purple-400" },
    amber:  { pill: "bg-amber-500/10 border-amber-500/30",  text: "text-amber-300",  dot: "bg-amber-400",  ping: "bg-amber-400",  bar: "bg-amber-400" },
  }[color]
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${cm.pill}`}>
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cm.ping}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cm.dot}`} />
      </span>
      <div className="flex flex-col leading-none">
        <span className="text-slate-400 text-[9px] font-bold tracking-widest uppercase mb-0.5">{label}</span>
        <span className={`font-mono text-[13px] font-bold ${cm.text}`}>
          {days > 0 && <>{days}d </>}{pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </div>
    </div>
  )
}

// ─── Mission Card ─────────────────────────────────────────────────────────────
function MissionCard({
  mission, isClaimed, isClaiming, tabColor, onClaim,
}: {
  mission: Mission
  isClaimed: boolean
  isClaiming: boolean
  tabColor: "cyan" | "purple" | "amber"
  onClaim: () => void
}) {
  const canClaim = mission.completed && !isClaimed
  const pct = Math.min(100, (mission.progress / mission.maxProgress) * 100)

  const catStyle = {
    gacha:      { bg: "from-violet-600/20 to-violet-500/5",  icon: "bg-violet-500/20 border-violet-500/40 text-violet-300",  glow: "rgba(139,92,246,0.25)" },
    battle:     { bg: "from-rose-600/20 to-rose-500/5",      icon: "bg-rose-500/20 border-rose-500/40 text-rose-300",        glow: "rgba(244,63,94,0.25)" },
    collection: { bg: "from-amber-600/20 to-amber-500/5",    icon: "bg-amber-500/20 border-amber-500/40 text-amber-300",     glow: "rgba(245,158,11,0.25)" },
    social:     { bg: "from-pink-600/20 to-pink-500/5",      icon: "bg-pink-500/20 border-pink-500/40 text-pink-300",        glow: "rgba(236,72,153,0.25)" },
    general:    { bg: "from-sky-600/20 to-sky-500/5",        icon: "bg-sky-500/20 border-sky-500/40 text-sky-300",           glow: "rgba(14,165,233,0.25)" },
  }[mission.category]

  const barColor = {
    cyan:   "from-cyan-400 to-teal-300",
    purple: "from-purple-400 to-pink-400",
    amber:  "from-amber-400 to-yellow-300",
  }[tabColor]

  const btnStyle = isClaimed
    ? "bg-slate-800/60 border border-white/5 text-slate-600 cursor-default"
    : canClaim
    ? "bg-gradient-to-b from-emerald-400 to-emerald-600 border border-emerald-300/30 text-white shadow-[0_0_20px_rgba(52,211,153,0.5)] hover:shadow-[0_0_28px_rgba(52,211,153,0.7)] hover:scale-105 active:scale-95"
    : "bg-slate-800/60 border border-white/5 text-slate-600 cursor-not-allowed"

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isClaimed
          ? "border-white/5 bg-slate-900/30 opacity-50 grayscale"
          : canClaim
          ? "border-emerald-500/40 bg-gradient-to-br from-slate-900/90 to-slate-800/60"
          : "border-white/[0.07] bg-slate-900/60"
      }`}
      style={canClaim ? { boxShadow: "0 0 30px rgba(52,211,153,0.12)" } : undefined}
    >
      {/* Top shine line */}
      {!isClaimed && (
        <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${canClaim ? "from-transparent via-emerald-400/60 to-transparent" : "from-transparent via-white/10 to-transparent"}`} />
      )}

      {/* Category bg gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${catStyle.bg} pointer-events-none`} />

      {/* Sweep animation when claimable */}
      {canClaim && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div className="absolute inset-0 animate-[shimmer_2.5s_linear_infinite]"
            style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%)", backgroundSize: "200% 100%" }} />
        </div>
      )}

      <div className="relative flex items-center gap-4 p-4">
        {/* Category icon */}
        <div className={`w-13 h-13 min-w-[52px] min-h-[52px] rounded-xl flex items-center justify-center border ${catStyle.icon}`}
          style={{ boxShadow: !isClaimed ? `0 0 18px ${catStyle.glow}` : undefined }}>
          <div className="w-6 h-6">{mission.icon}</div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className={`font-bold text-sm truncate ${isClaimed ? "text-slate-500" : "text-white"}`}>{mission.name}</h3>
            {isClaimed && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
          </div>
          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">{mission.description}</p>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-950/80 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${canClaim ? "from-emerald-400 to-teal-300 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : isClaimed ? "from-slate-600 to-slate-500" : barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0 tabular-nums">
              {mission.progress}/{mission.maxProgress}
            </span>
          </div>

          {/* Rewards */}
          <div className="flex gap-1.5 mt-2.5">
            {mission.reward.coins && (
              <div className="flex items-center gap-1 bg-slate-950/60 border border-white/10 px-2 py-1 rounded-lg">
                <CoinIcon size={13} />
                <span className="text-[10px] font-bold text-amber-300">+{mission.reward.coins.toLocaleString()}</span>
              </div>
            )}
            {mission.reward.fp && (
              <div className="flex items-center gap-1 bg-slate-950/60 border border-purple-500/20 px-2 py-1 rounded-lg">
                <span className="text-[10px]">⚡</span>
                <span className="text-[10px] font-bold text-purple-300">+{mission.reward.fp} FP</span>
              </div>
            )}
          </div>
        </div>

        {/* Claim button */}
        <button
          onClick={onClaim}
          disabled={!canClaim || isClaiming}
          className={`w-11 h-11 min-w-[44px] rounded-xl flex items-center justify-center transition-all duration-200 ${btnStyle}`}
        >
          {isClaiming
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : isClaimed
            ? <Check className="w-4 h-4" />
            : canClaim
            ? <Gift className="w-5 h-5" />
            : <Lock className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MissionsScreen({ onBack }: MissionsScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, collection, matchHistory } = useGame()

  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "special">("daily")
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimedMissions, setClaimedMissions] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = localStorage.getItem("claimed_missions")
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch { return new Set() }
  })

  useEffect(() => {
    try { localStorage.setItem("claimed_missions", JSON.stringify([...claimedMissions])) } catch {}
  }, [claimedMissions])

  const [dailyTarget]  = useState(getNextMidnightUTC)
  const [weeklyTarget] = useState(getNextMondayMidnightUTC)
  const [eventTarget]  = useState(getEventEndTimestamp)

  const totalCards   = collection?.length || 0
  const wins         = matchHistory?.filter(m => m.result === "won").length || 0

  // ── Lê progresso real do tracker ────────────────────────────────────────────
  const [trackedProgress, setTrackedProgress] = useState({
    gachaToday:  0,
    gachaWeek:   0,
    winsToday:   0,
    winsWeek:    0,
    duelsToday:  0,
    duelsWeek:   0,
    srTotal:     0,
    loginToday:  false,
    deckEditWeek: false,
  })

  // Atualiza progresso quando a tela abre e a cada 3s
  useEffect(() => {
    // Marca login ao abrir missões
    trackDailyLogin()

    const refresh = () => setTrackedProgress({
      gachaToday:   getMissionProgress.gachaToday(),
      gachaWeek:    getMissionProgress.gachaWeek(),
      winsToday:    getMissionProgress.winsToday(),
      winsWeek:     getMissionProgress.winsWeek(),
      duelsToday:   getMissionProgress.duelsToday(),
      duelsWeek:    getMissionProgress.duelsWeek(),
      srTotal:      getMissionProgress.srTotal(),
      loginToday:   getMissionProgress.loginToday(),
      deckEditWeek: getMissionProgress.deckEditWeek(),
    })
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [])

  const allMissions: Mission[] = useMemo(() => {
    const g  = trackedProgress

    return [
      // ── Diárias ──
      {
        id: "daily-1",
        name: "Abertura Diária",
        description: "Abra 3 packs no gacha hoje",
        type: "daily", category: "gacha",
        icon: <Sparkles className="w-5 h-5" />,
        progress: Math.min(g.gachaToday, 3), maxProgress: 3,
        reward: { coins: 100 },
        completed: g.gachaToday >= 3, claimed: false,
      },
      {
        id: "daily-2",
        name: "Duelista Nato",
        description: "Vença 2 partidas no modo Batalha",
        type: "daily", category: "battle",
        icon: <Swords className="w-5 h-5" />,
        progress: Math.min(g.winsToday, 2), maxProgress: 2,
        reward: { coins: 150, fp: 20 },
        completed: g.winsToday >= 2, claimed: false,
      },
      {
        id: "daily-3",
        name: "Presença Diária",
        description: "Faça login no jogo",
        type: "daily", category: "general",
        icon: <Calendar className="w-5 h-5" />,
        progress: g.loginToday ? 1 : 0, maxProgress: 1,
        reward: { coins: 50 },
        completed: g.loginToday, claimed: false,
      },
      {
        id: "daily-4",
        name: "Colecionador Ativo",
        description: "Adicione 5 cartas à coleção",
        type: "daily", category: "collection",
        icon: <BookOpen className="w-5 h-5" />,
        progress: Math.min(totalCards, 5), maxProgress: 5,
        reward: { coins: 100, fp: 10 },
        completed: totalCards >= 5, claimed: false,
      },
      // ── Semanais ──
      {
        id: "weekly-1",
        name: "Mestre Gacha",
        description: "Abra 30 packs esta semana",
        type: "weekly", category: "gacha",
        icon: <Sparkles className="w-5 h-5" />,
        progress: Math.min(g.gachaWeek, 30), maxProgress: 30,
        reward: { coins: 500, fp: 100 },
        completed: g.gachaWeek >= 30, claimed: false,
      },
      {
        id: "weekly-2",
        name: "Guerreiro da Semana",
        description: "Vença 10 partidas esta semana",
        type: "weekly", category: "battle",
        icon: <Swords className="w-5 h-5" />,
        progress: Math.min(g.winsWeek, 10), maxProgress: 10,
        reward: { coins: 700, fp: 150 },
        completed: g.winsWeek >= 10, claimed: false,
      },
      // ── Especiais ──
      {
        id: "special-1",
        name: "Lançamento Especial",
        description: "Comemore o lançamento coletando 50 cartas!",
        type: "special", category: "collection",
        icon: <Flame className="w-5 h-5" />,
        progress: Math.min(totalCards, 50), maxProgress: 50,
        reward: { coins: 1000, fp: 500 },
        completed: totalCards >= 50, claimed: false,
      },
    ]
  }, [trackedProgress, totalCards])

  const handleClaimReward = useCallback((id: string) => {
    if (claimingId !== null) return
    if (claimedMissions.has(id)) return
    const mission = allMissions.find(m => m.id === id)
    if (!mission?.completed) return
    setClaimingId(id)
    setTimeout(() => {
      if (mission.reward.coins && setCoins) setCoins(coins + mission.reward.coins)
      setClaimedMissions(prev => new Set([...prev, id]))
      setClaimingId(null)
    }, 800)
  }, [allMissions, claimedMissions, claimingId, setCoins, coins])

  // ── Bônus de Conclusão ───────────────────────────────────────────────────────
  const [bonusClaimed, setBonusClaimed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = localStorage.getItem("claimed_bonus")
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch { return new Set() }
  })

  useEffect(() => {
    try { localStorage.setItem("claimed_bonus", JSON.stringify([...bonusClaimed])) } catch {}
  }, [bonusClaimed])

  const handleClaimBonus = useCallback(() => {
    if (bonusClaimed.has(activeTab)) return
    setCoins(coins + bonusCoins)
    setBonusClaimed(prev => new Set([...prev, activeTab]))
  }, [activeTab, bonusClaimed, coins, bonusCoins, setCoins])

  const filteredMissions = allMissions.filter(m => m.type === activeTab)

  const stats = useMemo(() => {
    const count = (type: string) => ({
      total:     allMissions.filter(m => m.type === type).length,
      completed: allMissions.filter(m => m.type === type && (m.completed || claimedMissions.has(m.id))).length,
    })
    return { daily: count("daily"), weekly: count("weekly"), special: count("special") }
  }, [allMissions, claimedMissions])

  const TABS = [
    { id: "daily",   label: "Diárias",   emoji: "☀️", color: "cyan"   as const, stats: stats.daily,   target: dailyTarget,  timerLabel: "Reset Diário"  },
    { id: "weekly",  label: "Semanais",  emoji: "📅", color: "purple" as const, stats: stats.weekly,  target: weeklyTarget, timerLabel: "Reset Semanal" },
    { id: "special", label: "Especiais", emoji: "⚡", color: "amber"  as const, stats: stats.special, target: eventTarget,  timerLabel: "Fim do Evento" },
  ]

  const activeTabData = TABS.find(t => t.id === activeTab)!

  const tabColors = {
    cyan:   { active: "border-cyan-500/50 bg-cyan-950/40",   text: "text-cyan-300",   bar: "from-cyan-400 to-teal-300",     glow: "rgba(6,182,212,0.15)",   orb: "rgba(6,182,212,0.15)"  },
    purple: { active: "border-purple-500/50 bg-purple-950/40", text: "text-purple-300", bar: "from-purple-400 to-pink-400",   glow: "rgba(168,85,247,0.15)",  orb: "rgba(168,85,247,0.15)" },
    amber:  { active: "border-amber-500/50 bg-amber-950/40", text: "text-amber-300",  bar: "from-amber-400 to-yellow-300", glow: "rgba(245,158,11,0.15)",  orb: "rgba(245,158,11,0.15)" },
  }

  const activeColors = tabColors[activeTabData.color]

  const allComplete = filteredMissions.length > 0 && filteredMissions.every(m => claimedMissions.has(m.id))
  const bonusAlreadyClaimed = bonusClaimed.has(activeTab)
  const bonusCoins  = activeTab === "daily" ? 200 : activeTab === "weekly" ? 1000 : 2000

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#070C18] text-slate-200">

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-4px);  }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        .animate-shimmer { animation: shimmer 2.5s linear infinite; }
        .animate-float   { animation: float 3s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>

      {/* Layered background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse 80% 50% at 20% -10%, ${activeColors.orb} 0%, transparent 60%)`
        }} />
        <div className="absolute inset-0 transition-all duration-1000" style={{
          background: `radial-gradient(ellipse 60% 40% at 80% 110%, ${activeColors.orb} 0%, transparent 60%)`
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen w-full max-w-2xl mx-auto">

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 px-4 pt-4 pb-2">
          <div className="flex items-center justify-between bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <button onClick={onBack} className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold hidden sm:block">Voltar</span>
            </button>

            <div className="flex items-center gap-2.5">
              <Target className="w-5 h-5 text-cyan-400" />
              <h1 className="text-lg font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
                MISSÕES
              </h1>
            </div>

            {/* Coin balance */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-white/10 px-3 py-1.5 rounded-xl">
              <CoinIcon size={18} />
              <span className="text-white font-bold text-sm tabular-nums">{coins?.toLocaleString() ?? "0"}</span>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="flex-1 overflow-y-auto px-4 pb-12 pt-3">
          <div className="flex flex-col gap-4">

            {/* ── Tabs ── */}
            <div className="grid grid-cols-3 gap-2.5">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id
                const pct = tab.stats.total > 0 ? (tab.stats.completed / tab.stats.total) * 100 : 0
                const c = tabColors[tab.color]
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative flex flex-col rounded-2xl border p-3.5 transition-all duration-300 overflow-hidden ${
                      isActive ? `${c.active} shadow-[0_0_24px_${c.glow}]` : "bg-slate-900/40 border-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    {isActive && (
                      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent`} />
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className={isActive ? "animate-float text-xl" : "text-xl"}>{tab.emoji}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                        isActive ? `${c.text} border-current bg-white/5` : "text-slate-600 border-slate-700/50"
                      }`}>
                        {tab.stats.completed}/{tab.stats.total}
                      </span>
                    </div>
                    <span className={`text-xs font-bold text-left mb-2.5 ${isActive ? "text-white" : "text-slate-500"}`}>
                      {tab.label}
                    </span>
                    <div className="w-full h-1 bg-slate-950/80 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${isActive ? c.bar : "bg-slate-700/60"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ── Timer Banner ── */}
            <div className="flex items-center justify-between bg-slate-900/50 border border-white/[0.07] rounded-xl px-4 py-2.5">
              <p className="text-slate-500 text-[11px] font-medium hidden sm:block">Tempo restante</p>
              <CountdownTimer targetMs={activeTabData.target} label={activeTabData.timerLabel} color={activeTabData.color} />
            </div>

            {/* ── Mission List ── */}
            <div className="flex flex-col gap-3">
              {filteredMissions.map(mission => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  isClaimed={claimedMissions.has(mission.id)}
                  isClaiming={claimingId === mission.id}
                  tabColor={activeTabData.color}
                  onClaim={() => handleClaimReward(mission.id)}
                />
              ))}
            </div>

            {/* ── Completion Bonus ── */}
            <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-500 ${
              allComplete
                ? "border-amber-500/50 bg-gradient-to-br from-amber-950/60 to-slate-900/60 shadow-[0_0_30px_rgba(245,158,11,0.15)]"
                : "border-white/[0.07] bg-slate-900/40"
            }`}>
              {allComplete && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                    allComplete ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-slate-800/60 border-white/5 text-slate-600"
                  }`}>
                    {allComplete ? <Crown className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm ${allComplete ? "text-amber-200" : "text-slate-400"}`}>
                      Bônus de Conclusão
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {allComplete ? "Parabéns! Colete seu bônus." : "Complete todas as missões para liberar."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {allComplete ? (
                    <button
                      onClick={!bonusAlreadyClaimed ? handleClaimBonus : undefined}
                      disabled={bonusAlreadyClaimed}
                      className={`flex items-center gap-2 border font-bold text-sm px-4 py-2 rounded-xl transition-all ${
                        bonusAlreadyClaimed
                          ? "bg-slate-800/60 border-white/5 text-slate-500 cursor-default"
                          : "bg-gradient-to-b from-amber-400 to-amber-600 border-amber-300/30 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_28px_rgba(245,158,11,0.6)] cursor-pointer"
                      }`}
                    >
                      {bonusAlreadyClaimed ? (
                        <><Check className="w-4 h-4 text-emerald-400" /> Coletado</>
                      ) : (
                        <><CoinIcon size={16} /> +{bonusCoins.toLocaleString()}</>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 opacity-40">
                      <CoinIcon size={16} />
                      <span className="text-slate-400 font-black">+{bonusCoins.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
