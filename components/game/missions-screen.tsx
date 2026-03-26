"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Target,
  Clock,
  Calendar,
  Star,
  Zap,
  Gift,
  Check,
  Sparkles,
  Flame,
  Swords,
  BookOpen,
  Users,
  Lock,
  Trophy,
  ChevronRight,
} from "lucide-react"
import Image from "next/image"

interface MissionsScreenProps {
  onBack: () => void
}

interface Mission {
  id: string
  name: string
  description: string
  type: "daily" | "weekly" | "special"
  category: "gacha" | "battle" | "collection" | "social" | "general"
  icon: React.ReactNode
  progress: number
  maxProgress: number
  reward: {
    coins?: number
    fp?: number
    item?: string
  }
  completed: boolean
  claimed: boolean
}

// ─── Timer utilities (timestamp-based, localStorage-persisted) ───────────────

function getNextMidnightUTC(): number {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return next.getTime()
}

function getNextMondayMidnightUTC(): number {
  const now = new Date()
  const day = now.getUTCDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday))
  return next.getTime()
}

function getEventEndTimestamp(): number {
  const STORAGE_KEY = "missions_event_end"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const ts = parseInt(stored, 10)
    if (!isNaN(ts) && ts > Date.now()) return ts
  }
  const end = Date.now() + 30 * 24 * 60 * 60 * 1000
  localStorage.setItem(STORAGE_KEY, String(end))
  return end
}

function getDailyResetTimestamp(): number {
  const STORAGE_KEY = "missions_daily_reset"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const ts = parseInt(stored, 10)
    if (!isNaN(ts) && ts > Date.now()) return ts
  }
  const ts = getNextMidnightUTC()
  localStorage.setItem(STORAGE_KEY, String(ts))
  return ts
}

function getWeeklyResetTimestamp(): number {
  const STORAGE_KEY = "missions_weekly_reset"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const ts = parseInt(stored, 10)
    if (!isNaN(ts) && ts > Date.now()) return ts
  }
  const ts = getNextMondayMidnightUTC()
  localStorage.setItem(STORAGE_KEY, String(ts))
  return ts
}

function formatCountdown(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  const totalSec = Math.floor(ms / 1000)
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

// ─── Timer display component ──────────────────────────────────────────────────
function CountdownTimer({ targetMs, label, color }: { targetMs: number; label: string; color: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()))

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])

  const { days, hours, minutes, seconds } = formatCountdown(remaining)

  const colorMap: Record<string, { pill: string; text: string; dot: string }> = {
    cyan:   { pill: "bg-cyan-500/10 border-cyan-500/30",   text: "text-cyan-300",   dot: "bg-cyan-400" },
    purple: { pill: "bg-purple-500/10 border-purple-500/30", text: "text-purple-300", dot: "bg-purple-400" },
    amber:  { pill: "bg-amber-500/10 border-amber-500/30",  text: "text-amber-300",  dot: "bg-amber-400" },
  }
  const c = colorMap[color] ?? colorMap.cyan

  return (
    <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border ${c.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${c.dot}`} />
      <span className="text-slate-400 text-[11px] font-medium tracking-wide uppercase">{label}</span>
      <span className={`font-mono text-[13px] font-bold tracking-tight ${c.text}`}>
        {days > 0 ? `${days}d ` : ""}
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MissionsScreen({ onBack }: MissionsScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, collection, matchHistory, friends } = useGame()
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "special">("daily")
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimedMissions, setClaimedMissions] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = localStorage.getItem("claimed_missions")
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch { return new Set() }
  })

  // Persist claimed state
  useEffect(() => {
    try {
      localStorage.setItem("claimed_missions", JSON.stringify([...claimedMissions]))
    } catch {}
  }, [claimedMissions])

  // Stable timer targets
  const [dailyTarget]  = useState<number>(() => getDailyResetTimestamp())
  const [weeklyTarget] = useState<number>(() => getWeeklyResetTimestamp())
  const [eventTarget]  = useState<number>(() => getEventEndTimestamp())

  // Stable random progress (won't flicker)
  const progressMap = useMemo(() => ({
    "daily-1": Math.floor(Math.random() * 4),
  }), [])

  const totalCards   = collection.length
  const wins         = matchHistory.filter(m => m.result === "won").length
  const totalMatches = matchHistory.length
  const friendCount  = friends.length

  const allMissions: Mission[] = useMemo(() => [
    // ── Daily ──────────────────────────────────────────────────────────────
    {
      id: "daily-1",
      name: "Abertura Diária",
      description: "Abra 3 packs no gacha hoje",
      type: "daily", category: "gacha",
      icon: <Sparkles className="w-5 h-5" />,
      progress: Math.min(3, progressMap["daily-1"]),
      maxProgress: 3,
      reward: { coins: 100 },
      completed: progressMap["daily-1"] >= 3,
      claimed: false,
    },
    {
      id: "daily-2",
      name: "Duelista Nato",
      description: "Vença 2 partidas",
      type: "daily", category: "battle",
      icon: <Swords className="w-5 h-5" />,
      progress: Math.min(wins, 2),
      maxProgress: 2,
      reward: { coins: 150, fp: 20 },
      completed: wins >= 2,
      claimed: false,
    },
    {
      id: "daily-3",
      name: "Login Diário",
      description: "Faça login no jogo",
      type: "daily", category: "general",
      icon: <Calendar className="w-5 h-5" />,
      progress: 1, maxProgress: 1,
      reward: { coins: 50 },
      completed: true, claimed: false,
    },
    {
      id: "daily-4",
      name: "Colecionador Ativo",
      description: "Adicione 5 cartas à coleção",
      type: "daily", category: "collection",
      icon: <BookOpen className="w-5 h-5" />,
      progress: Math.min(totalCards % 5, 5),
      maxProgress: 5,
      reward: { coins: 100, fp: 10 },
      completed: (totalCards % 5) >= 5,
      claimed: false,
    },
    {
      id: "daily-5",
      name: "Amigo do Dia",
      description: "Envie um coração para um amigo",
      type: "daily", category: "social",
      icon: <Users className="w-5 h-5" />,
      progress: 0, maxProgress: 1,
      reward: { fp: 30 },
      completed: false, claimed: false,
    },
    // ── Weekly ─────────────────────────────────────────────────────────────
    {
      id: "weekly-1",
      name: "Mestre Gacha",
      description: "Abra 30 packs esta semana",
      type: "weekly", category: "gacha",
      icon: <Sparkles className="w-5 h-5" />,
      progress: Math.min(totalCards, 30),
      maxProgress: 30,
      reward: { coins: 500, fp: 100 },
      completed: totalCards >= 30,
      claimed: false,
    },
    {
      id: "weekly-2",
      name: "Guerreiro da Semana",
      description: "Vença 10 partidas",
      type: "weekly", category: "battle",
      icon: <Swords className="w-5 h-5" />,
      progress: Math.min(wins, 10),
      maxProgress: 10,
      reward: { coins: 700, fp: 150 },
      completed: wins >= 10,
      claimed: false,
    },
    {
      id: "weekly-3",
      name: "Coleção Crescente",
      description: "Colete 20 cartas novas",
      type: "weekly", category: "collection",
      icon: <BookOpen className="w-5 h-5" />,
      progress: Math.min(totalCards, 20),
      maxProgress: 20,
      reward: { coins: 400 },
      completed: totalCards >= 20,
      claimed: false,
    },
    {
      id: "weekly-4",
      name: "Rede Social",
      description: "Adicione 3 novos amigos",
      type: "weekly", category: "social",
      icon: <Users className="w-5 h-5" />,
      progress: Math.min(friendCount, 3),
      maxProgress: 3,
      reward: { fp: 200 },
      completed: friendCount >= 3,
      claimed: false,
    },
    // ── Special ────────────────────────────────────────────────────────────
    {
      id: "special-1",
      name: "Lançamento Especial",
      description: "Comemore o lançamento coletando 50 cartas!",
      type: "special", category: "collection",
      icon: <Flame className="w-5 h-5" />,
      progress: Math.min(totalCards, 50),
      maxProgress: 50,
      reward: { coins: 1000, fp: 500 },
      completed: totalCards >= 50,
      claimed: false,
    },
    {
      id: "special-2",
      name: "Veterano de Guerra",
      description: "Complete 25 batalhas",
      type: "special", category: "battle",
      icon: <Target className="w-5 h-5" />,
      progress: Math.min(totalMatches, 25),
      maxProgress: 25,
      reward: { coins: 800, fp: 300, item: "Pack Especial" },
      completed: totalMatches >= 25,
      claimed: false,
    },
    {
      id: "special-3",
      name: "Amizade Verdadeira",
      description: "Alcance nível 5 de afinidade com um amigo",
      type: "special", category: "social",
      icon: <Star className="w-5 h-5" />,
      progress: 0, maxProgress: 1,
      reward: { coins: 500, fp: 500 },
      completed: false,
      claimed: false,
    },
  ], [totalCards, wins, totalMatches, friendCount, progressMap])

  const handleClaimReward = useCallback((id: string) => {
    if (claimingId !== null) return
    if (claimedMissions.has(id)) return
    const mission = allMissions.find(m => m.id === id)
    if (!mission?.completed) return

    setClaimingId(id)
    setTimeout(() => {
      if (mission.reward.coins) setCoins((prev: number) => prev + mission.reward.coins!)
      setClaimedMissions(prev => new Set([...prev, id]))
      setClaimingId(null)
    }, 700)
  }, [allMissions, claimedMissions, claimingId, setCoins])

  const filteredMissions = allMissions.filter(m => m.type === activeTab)

  const stats = useMemo(() => {
    const count = (type: string) => ({
      total:     allMissions.filter(m => m.type === type).length,
      completed: allMissions.filter(m => m.type === type && m.completed).length,
      claimed:   allMissions.filter(m => m.type === type && claimedMissions.has(m.id)).length,
    })
    return { daily: count("daily"), weekly: count("weekly"), special: count("special") }
  }, [allMissions, claimedMissions])

  const TABS = [
    { id: "daily",   label: "Diárias",   emoji: "☀️",  color: "cyan",   stats: stats.daily,   target: dailyTarget,  timerLabel: "Reinicia em" },
    { id: "weekly",  label: "Semanais",  emoji: "📅",  color: "purple", stats: stats.weekly,  target: weeklyTarget, timerLabel: "Reinicia em" },
    { id: "special", label: "Especiais", emoji: "⚡",  color: "amber",  stats: stats.special, target: eventTarget,  timerLabel: "Evento encerra em" },
  ] as const

  const activeTabData = TABS.find(t => t.id === activeTab)!

  // ── Category config ────────────────────────────────────────────────────────
  const CATEGORY = {
    gacha:      { bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-500/25", glow: "shadow-violet-500/20" },
    battle:     { bg: "bg-rose-500/15",   text: "text-rose-300",   border: "border-rose-500/25",   glow: "shadow-rose-500/20" },
    collection: { bg: "bg-amber-500/15",  text: "text-amber-300",  border: "border-amber-500/25",  glow: "shadow-amber-500/20" },
    social:     { bg: "bg-pink-500/15",   text: "text-pink-300",   border: "border-pink-500/25",   glow: "shadow-pink-500/20" },
    general:    { bg: "bg-sky-500/15",    text: "text-sky-300",    border: "border-sky-500/25",    glow: "shadow-sky-500/20" },
  }

  const TAB_COLORS = {
    cyan:   { active: "border-cyan-500/60 bg-cyan-500/10",   text: "text-cyan-300",   bar: "from-cyan-500 to-cyan-400",     glow: "shadow-cyan-500/25",   ring: "ring-cyan-500/40" },
    purple: { active: "border-purple-500/60 bg-purple-500/10", text: "text-purple-300", bar: "from-purple-500 to-purple-400", glow: "shadow-purple-500/25", ring: "ring-purple-500/40" },
    amber:  { active: "border-amber-500/60 bg-amber-500/10", text: "text-amber-300",   bar: "from-amber-500 to-amber-400",  glow: "shadow-amber-500/25",  ring: "ring-amber-500/40" },
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-slate-950">

      {/* ── Background layers ────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        {/* base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        {/* colored accents per tab */}
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            background: activeTab === "daily"
              ? "radial-gradient(ellipse 60% 45% at 20% 10%, rgba(6,182,212,0.07) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 80% 90%, rgba(6,182,212,0.04) 0%, transparent 50%)"
              : activeTab === "weekly"
              ? "radial-gradient(ellipse 60% 45% at 20% 10%, rgba(168,85,247,0.07) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 80% 90%, rgba(168,85,247,0.04) 0%, transparent 50%)"
              : "radial-gradient(ellipse 60% 45% at 20% 10%, rgba(245,158,11,0.07) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 80% 90%, rgba(245,158,11,0.04) 0%, transparent 50%)",
          }}
        />
        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.8) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* noise vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/60" />
      </div>

      {/* ── Floating orbs ────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full blur-3xl opacity-[0.035]"
            style={{
              width: `${180 + i * 40}px`,
              height: `${180 + i * 40}px`,
              left: `${(i * 17 + 5) % 90}%`,
              top: `${(i * 13 + 8) % 85}%`,
              background: ["#06b6d4","#a855f7","#f59e0b","#ec4899","#10b981","#3b82f6"][i],
              animation: `floatOrb ${8 + i * 2}s ease-in-out infinite alternate`,
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes floatOrb {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(20px, -30px) scale(1.08); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulseRing {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
        .shimmer-text {
          background: linear-gradient(90deg, #fbbf24 0%, #fef3c7 40%, #f59e0b 60%, #fbbf24 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2.5s linear infinite;
        }
        .card-claimed { opacity: 0.45; filter: saturate(0.4); }
        .pulse-ring   { animation: pulseRing 2s ease-in-out infinite; }
      `}</style>

      {/* ─────────────────────────────────────────────────────────────── */}
      {/* MAIN LAYOUT — centred, max-width constrained                   */}
      {/* ─────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col min-h-screen w-full">

        {/* ── Header ───────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/80 border-b border-white/[0.06]">
          <div className="mx-auto w-full max-w-2xl px-4 h-14 flex items-center justify-between gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center border border-white/10">
                  <Target className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <span className="text-white font-bold tracking-wider text-[15px]">MISSÕES</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800/70 border border-white/10 px-2.5 py-1 rounded-xl">
              <Image src="/images/icons/gacha-coin.png" alt="Coin" width={18} height={18} className="w-[18px] h-[18px]" />
              <span className="text-white font-bold text-sm tabular-nums">{coins.toLocaleString()}</span>
            </div>
          </div>
        </header>

        {/* ── Scrollable body ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-4 py-5 flex flex-col gap-5">

            {/* ── Tab selector ─────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2.5">
              {TABS.map(tab => {
                const c = TAB_COLORS[tab.color]
                const pct = tab.stats.total > 0 ? (tab.stats.completed / tab.stats.total) * 100 : 0
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative rounded-2xl border p-3.5 text-left transition-all duration-300 ${
                      isActive
                        ? `${c.active} shadow-lg ${c.glow} ring-1 ${c.ring}`
                        : "bg-slate-900/50 border-slate-800/60 hover:bg-slate-800/40 hover:border-slate-700/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base leading-none">{tab.emoji}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? c.text : "text-slate-500"}`}>
                        {tab.stats.completed}/{tab.stats.total}
                      </span>
                    </div>
                    <div className={`text-[12px] font-semibold mb-2.5 ${isActive ? "text-white" : "text-slate-400"}`}>
                      {tab.label}
                    </div>
                    {/* mini progress */}
                    <div className="h-1 rounded-full bg-slate-700/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${isActive ? c.bar : "bg-slate-600"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ── Timer bar ────────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CountdownTimer
                targetMs={activeTabData.target}
                label={activeTabData.timerLabel}
                color={activeTabData.color}
              />
              <span className="text-slate-600 text-[11px]">
                {activeTab === "daily"   ? "Reinicia à meia-noite (UTC)" :
                 activeTab === "weekly"  ? "Reinicia toda segunda-feira" :
                                          "Evento de lançamento"}
              </span>
            </div>

            {/* ── Mission list ─────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              {filteredMissions.map(mission => {
                const isClaimed   = claimedMissions.has(mission.id)
                const isClaiming  = claimingId === mission.id
                const canClaim    = mission.completed && !isClaimed
                const cat         = CATEGORY[mission.category as keyof typeof CATEGORY] ?? CATEGORY.general
                const pct         = Math.min(100, (mission.progress / mission.maxProgress) * 100)
                const tabC        = TAB_COLORS[activeTabData.color]

                return (
                  <div
                    key={mission.id}
                    className={`
                      relative rounded-2xl border transition-all duration-300 overflow-hidden
                      ${isClaimed
                        ? "card-claimed bg-slate-900/30 border-slate-800/40"
                        : canClaim
                        ? "bg-slate-900/80 border-emerald-500/40 shadow-lg shadow-emerald-500/10 pulse-ring"
                        : "bg-slate-900/60 border-slate-800/50 hover:border-slate-700/60"
                      }
                    `}
                  >
                    {/* top accent stripe */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl ${
                        isClaimed    ? "bg-slate-700" :
                        canClaim     ? "bg-gradient-to-r from-emerald-500 to-green-400" :
                        mission.completed ? "bg-gradient-to-r from-emerald-600 to-green-500" :
                        `bg-gradient-to-r ${tabC.bar} opacity-50`
                      }`}
                    />

                    <div className="p-4 pt-4">
                      <div className="flex gap-3.5 items-start">

                        {/* ── Icon ─────────────────────────────────── */}
                        <div className={`
                          relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0
                          border shadow-lg ${cat.bg} ${cat.border} ${cat.glow}
                        `}>
                          <span className={cat.text}>{mission.icon}</span>
                          {canClaim && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
                          )}
                        </div>

                        {/* ── Content ──────────────────────────────── */}
                        <div className="flex-1 min-w-0">

                          {/* name + badge row */}
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-white font-bold text-[14px] leading-snug">
                              {mission.name}
                            </span>
                            {isClaimed && (
                              <span className="inline-flex items-center gap-1 bg-slate-700/60 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-600/40">
                                <Check className="w-2.5 h-2.5" /> Resgatado
                              </span>
                            )}
                            {!isClaimed && canClaim && (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                                ✦ Completo!
                              </span>
                            )}
                          </div>

                          <p className="text-slate-500 text-[12px] leading-relaxed mb-2.5">
                            {mission.description}
                          </p>

                          {/* progress */}
                          <div className="flex items-center gap-2.5 mb-3">
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${
                                  isClaimed || mission.completed
                                    ? "from-emerald-500 to-green-400"
                                    : tabC.bar
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-slate-500 text-[11px] font-semibold tabular-nums whitespace-nowrap">
                              {mission.progress}<span className="text-slate-600">/{mission.maxProgress}</span>
                            </span>
                          </div>

                          {/* rewards */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-600 text-[10px] uppercase tracking-widest font-semibold mr-0.5">
                              Prêmio
                            </span>
                            {mission.reward.coins && (
                              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                <Image src="/images/icons/gacha-coin.png" alt="Coin" width={12} height={12} className="w-3 h-3" />
                                <span className="text-amber-300 text-[11px] font-bold">{mission.reward.coins.toLocaleString()}</span>
                              </div>
                            )}
                            {mission.reward.fp && (
                              <div className="flex items-center gap-1 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
                                <Star className="w-2.5 h-2.5 text-pink-400" />
                                <span className="text-pink-300 text-[11px] font-bold">{mission.reward.fp} FP</span>
                              </div>
                            )}
                            {mission.reward.item && (
                              <div className="flex items-center gap-1 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                                <Gift className="w-2.5 h-2.5 text-violet-400" />
                                <span className="text-violet-300 text-[11px] font-bold">{mission.reward.item}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ── Claim button ──────────────────────────── */}
                        <div className="shrink-0 flex items-center self-center ml-1">
                          <button
                            onClick={() => handleClaimReward(mission.id)}
                            disabled={!canClaim || isClaiming}
                            className={`
                              relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200
                              ${canClaim && !isClaiming
                                ? "bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/30 hover:scale-110 hover:shadow-emerald-500/50 active:scale-95"
                                : isClaimed
                                ? "bg-slate-800/60 border border-slate-700/40"
                                : "bg-slate-800/40 border border-slate-700/30"
                              }
                            `}
                          >
                            {isClaiming ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : isClaimed ? (
                              <Check className="w-4 h-4 text-slate-500" />
                            ) : canClaim ? (
                              <Gift className="w-4 h-4 text-white" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-600" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Completion bonus card ─────────────────────────────── */}
            {(() => {
              const s = activeTabData.stats
              const allDone = s.completed === s.total
              const bonusAmount = activeTab === "daily" ? "200" : activeTab === "weekly" ? "1.000" : "2.000"
              return (
                <div className={`rounded-2xl border p-4 transition-all duration-500 ${
                  allDone
                    ? "bg-gradient-to-br from-amber-900/25 via-orange-900/20 to-amber-900/25 border-amber-500/40 shadow-lg shadow-amber-500/10"
                    : "bg-slate-900/40 border-slate-800/40"
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-500 ${
                      allDone
                        ? "bg-amber-500/20 border-amber-500/40 shadow-lg shadow-amber-500/20"
                        : "bg-slate-800/60 border-slate-700/40"
                    }`}>
                      <Trophy className={`w-6 h-6 transition-colors duration-500 ${allDone ? "text-amber-400" : "text-slate-500"}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-bold text-[14px] ${allDone ? "text-white" : "text-slate-400"}`}>
                          Bônus de Conclusão
                        </span>
                        {allDone && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">
                            DISPONÍVEL
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-[12px]">
                        Complete todas as {activeTab === "daily" ? "diárias" : activeTab === "weekly" ? "semanais" : "especiais"} para ganhar o bônus
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <Image src="/images/icons/gacha-coin.png" alt="Coin" width={14} height={14} className="w-3.5 h-3.5" />
                        <span className={`font-bold text-[15px] ${allDone ? "shimmer-text" : "text-slate-500"}`}>
                          +{bonusAmount}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 justify-end mt-1">
                        {Array.from({ length: s.total }).map((_, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            i < s.completed ? "bg-amber-400" : "bg-slate-700"
                          }`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* bottom breathing room */}
            <div className="h-4" />
          </div>
        </div>
      </div>
    </div>
  )
}
