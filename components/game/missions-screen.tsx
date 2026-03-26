"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import {
  ArrowLeft,
  Target,
  Calendar,
  Star,
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

// ─── Interfaces ──────────────────────────────────────────────────────────────
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
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (stored) {
    const ts = parseInt(stored, 10)
    if (!isNaN(ts) && ts > Date.now()) return ts
  }
  const end = Date.now() + 30 * 24 * 60 * 60 * 1000
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(end))
  return end
}

function getDailyResetTimestamp(): number {
  const STORAGE_KEY = "missions_daily_reset"
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (stored) {
    const ts = parseInt(stored, 10)
    if (!isNaN(ts) && ts > Date.now()) return ts
  }
  const ts = getNextMidnightUTC()
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(ts))
  return ts
}

function getWeeklyResetTimestamp(): number {
  const STORAGE_KEY = "missions_weekly_reset"
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (stored) {
    const ts = parseInt(stored, 10)
    if (!isNaN(ts) && ts > Date.now()) return ts
  }
  const ts = getNextMondayMidnightUTC()
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(ts))
  return ts
}

function formatCountdown(ms: number) {
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
    cyan:   { pill: "bg-cyan-500/10 border-cyan-500/20",   text: "text-cyan-400",   dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" },
    purple: { pill: "bg-purple-500/10 border-purple-500/20", text: "text-purple-400", dot: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" },
    amber:  { pill: "bg-amber-500/10 border-amber-500/20",  text: "text-amber-400",  dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" },
  }
  const c = colorMap[color] ?? colorMap.cyan

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border backdrop-blur-sm ${c.pill}`}>
      <div className="relative flex items-center justify-center">
        <span className={`absolute w-2 h-2 rounded-full animate-ping opacity-75 ${c.dot}`} />
        <span className={`relative w-2 h-2 rounded-full ${c.dot}`} />
      </div>
      <div className="flex flex-col">
        <span className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mb-0.5">{label}</span>
        <span className={`font-mono text-[14px] leading-none font-bold tracking-tight ${c.text}`}>
          {days > 0 && <span className="mr-1">{days}d</span>}
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </div>
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

  const progressMap = useMemo(() => ({
    "daily-1": Math.floor(Math.random() * 4),
  }), [])

  const totalCards   = collection?.length || 0
  const wins         = matchHistory?.filter(m => m.result === "won").length || 0
  const totalMatches = matchHistory?.length || 0
  const friendCount  = friends?.length || 0

  const allMissions: Mission[] = useMemo(() => [
    // ── Daily ──────────────────────────────────────────────────────────────
    {
      id: "daily-1", name: "Abertura Diária", description: "Abra 3 packs no gacha hoje",
      type: "daily", category: "gacha", icon: <Sparkles className="w-5 h-5" />,
      progress: Math.min(3, progressMap["daily-1"]), maxProgress: 3, reward: { coins: 100 },
      completed: progressMap["daily-1"] >= 3, claimed: false,
    },
    {
      id: "daily-2", name: "Duelista Nato", description: "Vença 2 partidas no modo Batalha",
      type: "daily", category: "battle", icon: <Swords className="w-5 h-5" />,
      progress: Math.min(wins, 2), maxProgress: 2, reward: { coins: 150, fp: 20 },
      completed: wins >= 2, claimed: false,
    },
    {
      id: "daily-3", name: "Presença Diária", description: "Faça login no jogo",
      type: "daily", category: "general", icon: <Calendar className="w-5 h-5" />,
      progress: 1, maxProgress: 1, reward: { coins: 50 },
      completed: true, claimed: false,
    },
    {
      id: "daily-4", name: "Colecionador Ativo", description: "Adicione 5 cartas à coleção",
      type: "daily", category: "collection", icon: <BookOpen className="w-5 h-5" />,
      progress: Math.min(totalCards % 5, 5), maxProgress: 5, reward: { coins: 100, fp: 10 },
      completed: (totalCards % 5) >= 5, claimed: false,
    },
    {
      id: "daily-5", name: "Vínculo Fortalecido", description: "Envie um coração para um amigo",
      type: "daily", category: "social", icon: <Users className="w-5 h-5" />,
      progress: 0, maxProgress: 1, reward: { fp: 30 },
      completed: false, claimed: false,
    },
    // ── Weekly ─────────────────────────────────────────────────────────────
    {
      id: "weekly-1", name: "Mestre Gacha", description: "Abra 30 packs esta semana",
      type: "weekly", category: "gacha", icon: <Sparkles className="w-5 h-5" />,
      progress: Math.min(totalCards, 30), maxProgress: 30, reward: { coins: 500, fp: 100 },
      completed: totalCards >= 30, claimed: false,
    },
    {
      id: "weekly-2", name: "Guerreiro da Semana", description: "Vença 10 partidas",
      type: "weekly", category: "battle", icon: <Swords className="w-5 h-5" />,
      progress: Math.min(wins, 10), maxProgress: 10, reward: { coins: 700, fp: 150 },
      completed: wins >= 10, claimed: false,
    },
    // ── Special ────────────────────────────────────────────────────────────
    {
      id: "special-1", name: "Lançamento Especial", description: "Comemore o lançamento coletando 50 cartas!",
      type: "special", category: "collection", icon: <Flame className="w-5 h-5" />,
      progress: Math.min(totalCards, 50), maxProgress: 50, reward: { coins: 1000, fp: 500 },
      completed: totalCards >= 50, claimed: false,
    },
    {
      id: "special-2", name: "Veterano de Guerra", description: "Complete 25 batalhas",
      type: "special", category: "battle", icon: <Target className="w-5 h-5" />,
      progress: Math.min(totalMatches, 25), maxProgress: 25, reward: { coins: 800, fp: 300, item: "Pack Especial" },
      completed: totalMatches >= 25, claimed: false,
    },
  ], [totalCards, wins, totalMatches, progressMap])

  const handleClaimReward = useCallback((id: string) => {
    if (claimingId !== null) return
    if (claimedMissions.has(id)) return
    const mission = allMissions.find(m => m.id === id)
    if (!mission?.completed) return

    setClaimingId(id)
    setTimeout(() => {
      if (mission.reward.coins && setCoins) setCoins((prev: number) => prev + mission.reward.coins!)
      setClaimedMissions(prev => new Set([...prev, id]))
      setClaimingId(null)
    }, 800)
  }, [allMissions, claimedMissions, claimingId, setCoins])

  const filteredMissions = allMissions.filter(m => m.type === activeTab)

  const stats = useMemo(() => {
    const count = (type: string) => ({
      total:     allMissions.filter(m => m.type === type).length,
      completed: allMissions.filter(m => m.type === type && (m.completed || claimedMissions.has(m.id))).length,
    })
    return { daily: count("daily"), weekly: count("weekly"), special: count("special") }
  }, [allMissions, claimedMissions])

  const TABS = [
    { id: "daily",   label: "Diárias",   icon: "☀️", color: "cyan",   stats: stats.daily,   target: dailyTarget,  timerLabel: "Reset Diário" },
    { id: "weekly",  label: "Semanais",  icon: "📅", color: "purple", stats: stats.weekly,  target: weeklyTarget, timerLabel: "Reset Semanal" },
    { id: "special", label: "Especiais", icon: "⚡", color: "amber",  stats: stats.special, target: eventTarget,  timerLabel: "Fim do Evento" },
  ] as const

  const activeTabData = TABS.find(t => t.id === activeTab)!

  // ── Styling configs ────────────────────────────────────────────────────────
  const CATEGORY = {
    gacha:      { bg: "bg-violet-500/20", iconText: "text-violet-400", glow: "shadow-[0_0_15px_rgba(139,92,246,0.3)]", border: "border-violet-500/30", gradient: "from-violet-500/20 to-transparent" },
    battle:     { bg: "bg-rose-500/20",   iconText: "text-rose-400",   glow: "shadow-[0_0_15px_rgba(244,63,94,0.3)]", border: "border-rose-500/30", gradient: "from-rose-500/20 to-transparent" },
    collection: { bg: "bg-amber-500/20",  iconText: "text-amber-400",  glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]", border: "border-amber-500/30", gradient: "from-amber-500/20 to-transparent" },
    social:     { bg: "bg-pink-500/20",   iconText: "text-pink-400",   glow: "shadow-[0_0_15px_rgba(236,72,153,0.3)]", border: "border-pink-500/30", gradient: "from-pink-500/20 to-transparent" },
    general:    { bg: "bg-sky-500/20",    iconText: "text-sky-400",    glow: "shadow-[0_0_15px_rgba(14,165,233,0.3)]", border: "border-sky-500/30", gradient: "from-sky-500/20 to-transparent" },
  }

  const TAB_COLORS = {
    cyan:   { active: "bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]", text: "text-cyan-400", bar: "bg-gradient-to-r from-cyan-400 to-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.5)]" },
    purple: { active: "bg-purple-950/40 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]", text: "text-purple-400", bar: "bg-gradient-to-r from-purple-400 to-purple-300 shadow-[0_0_10px_rgba(192,132,252,0.5)]" },
    amber:  { active: "bg-amber-950/40 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]", text: "text-amber-400", bar: "bg-gradient-to-r from-amber-400 to-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.5)]" },
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0A0F1C] text-slate-200 selection:bg-cyan-500/30 font-sans">
      
      {/* ── Background layers & effects ────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
        <div 
          className="absolute inset-0 transition-all duration-1000 ease-in-out"
          style={{
            background: activeTab === "daily" 
              ? "radial-gradient(circle at 15% 0%, rgba(6,182,212,0.12) 0%, transparent 50%), radial-gradient(circle at 85% 100%, rgba(6,182,212,0.08) 0%, transparent 50%)"
              : activeTab === "weekly"
              ? "radial-gradient(circle at 15% 0%, rgba(168,85,247,0.12) 0%, transparent 50%), radial-gradient(circle at 85% 100%, rgba(168,85,247,0.08) 0%, transparent 50%)"
              : "radial-gradient(circle at 15% 0%, rgba(245,158,11,0.12) 0%, transparent 50%), radial-gradient(circle at 85% 100%, rgba(245,158,11,0.08) 0%, transparent 50%)"
          }}
        />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <style>{`
        @keyframes shine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-soft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        .animate-shine {
          background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.3) 50%, transparent 80%);
          background-size: 200% auto;
          animation: shine 3s linear infinite;
        }
        .text-gradient-gold {
          background: linear-gradient(to right, #FDE68A, #F59E0B, #FDE68A);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-size: 200% auto;
          animation: shine 4s linear infinite;
        }
      `}</style>

      <div className="relative z-10 flex flex-col min-h-screen w-full max-w-3xl mx-auto">
        
        {/* ── Header Premium ───────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 px-4 py-4 md:py-6">
          <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <button
              onClick={onBack}
              className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-white/5 flex items-center justify-center group-hover:bg-slate-700/80 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold tracking-wide hidden sm:block">Voltar</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                <Target className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              </div>
              <h1 className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
                MISSÕES
              </h1>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/80 border border-white/10 px-3 py-1.5 rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
              <Image src="/images/icons/gacha-coin.png" alt="Coin" width={20} height={20} className="w-5 h-5 drop-shadow-md" />
              <span className="text-white font-bold text-base tracking-wide tabular-nums">
                {coins?.toLocaleString() || "0"}
              </span>
            </div>
          </div>
        </header>

        {/* ── Corpo ────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 pb-12 hide-scrollbar">
          <div className="flex flex-col gap-6">

            {/* ── Tab Selector Glassmorphism ──────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {TABS.map(tab => {
                const c = TAB_COLORS[tab.color]
                const isActive = activeTab === tab.id
                const pct = tab.stats.total > 0 ? (tab.stats.completed / tab.stats.total) * 100 : 0

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative group flex flex-col rounded-2xl border p-4 transition-all duration-300 overflow-hidden
                      ${isActive ? c.active : "bg-slate-900/40 border-white/5 hover:bg-slate-800/40 hover:border-white/10"}
                    `}
                  >
                    {/* Fundo dinâmico para aba ativa */}
                    {isActive && (
                      <div className={`absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none`} />
                    )}

                    <div className="flex items-center justify-between mb-3 z-10">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${isActive ? "bg-white/10" : "bg-slate-800/50"}`}>
                        {tab.icon}
                      </div>
                      <div className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${isActive ? `border-${tab.color}-500/30 bg-${tab.color}-500/10 ${c.text}` : "border-slate-700 bg-slate-800/50 text-slate-400"}`}>
                        {tab.stats.completed}/{tab.stats.total}
                      </div>
                    </div>
                    
                    <div className={`text-sm font-bold tracking-wide text-left mb-3 z-10 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}>
                      {tab.label}
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-950/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] z-10 overflow-hidden relative">
                      <div 
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${isActive ? c.bar : "bg-slate-600"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ── Timer & Context Info ─────────────────────────────────── */}
            <div className="flex items-center justify-between bg-slate-900/30 border border-white/5 rounded-2xl p-2 pl-4">
              <p className="text-slate-400 text-xs font-medium tracking-wide">
                {activeTab === "daily"   ? "Complete as missões antes do fim do dia." :
                 activeTab === "weekly"  ? "Recompensas maiores toda semana." :
                                          "Disponível apenas por tempo limitado!"}
              </p>
              <CountdownTimer targetMs={activeTabData.target} label={activeTabData.timerLabel} color={activeTabData.color} />
            </div>

            {/* ── Lista de Missões ─────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              {filteredMissions.map((mission, idx) => {
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
                      relative rounded-2xl border transition-all duration-500 overflow-hidden group
                      ${isClaimed 
                        ? "bg-slate-900/20 border-white/5 opacity-60 grayscale-[30%]" 
                        : canClaim
                        ? "bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)] transform hover:-translate-y-1"
                        : "bg-slate-900/50 border-white/10 hover:border-white/20 hover:bg-slate-800/50"
                      }
                    `}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    {/* Fundo gradiente sutil baseado na categoria */}
                    {!isClaimed && !canClaim && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${cat.gradient} opacity-20 pointer-events-none`} />
                    )}

                    {/* Efeito de brilho se pode ser resgatado */}
                    {canClaim && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent animate-shine pointer-events-none" />
                    )}

                    <div className="relative p-4 sm:p-5 flex gap-4 sm:gap-5 items-center">
                      
                      {/* Icone */}
                      <div className={`
                        relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border
                        ${isClaimed ? "bg-slate-800 border-slate-700 text-slate-500" : `${cat.bg} ${cat.border} ${cat.iconText} ${cat.glow}`}
                      `}>
                        {mission.icon}
                        {canClaim && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-[#0A0F1C]" />
                          </span>
                        )}
                      </div>

                      {/* Info principal */}
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-bold text-base sm:text-lg truncate ${isClaimed ? "text-slate-500" : "text-white"}`}>
                            {mission.name}
                          </h3>
                          {canClaim && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              Concluído
                            </span>
                          )}
                        </div>
                        
                        <p className={`text-sm mb-3 line-clamp-2 ${isClaimed ? "text-slate-600" : "text-slate-400"}`}>
                          {mission.description}
                        </p>

                        {/* Progresso & Recompensas */}
                        <div className="flex flex-wrap items-end justify-between gap-4">
                          
                          {/* Barra de Progresso */}
                          <div className="flex-1 min-w-[140px] max-w-[200px]">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Progresso</span>
                              <span className="text-xs font-bold font-mono text-slate-300">
                                {mission.progress} <span className="text-slate-500">/ {mission.maxProgress}</span>
                              </span>
                            </div>
                            <div className="h-2 bg-slate-950/80 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out relative
                                  ${isClaimed ? "bg-slate-600" : canClaim ? "bg-gradient-to-r from-emerald-400 to-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]" : tabC.bar}
                                `}
                                style={{ width: `${pct}%` }}
                              >
                                {canClaim && <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/40 blur-sm" />}
                              </div>
                            </div>
                          </div>

                          {/* Recompensas Pills */}
                          <div className="flex items-center gap-2 shrink-0">
                            {mission.reward.coins && (
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${isClaimed ? "bg-slate-800/50 border-white/5" : "bg-slate-800/80 border-amber-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"}`}>
                                <Image src="/images/icons/gacha-coin.png" alt="Coin" width={14} height={14} className={isClaimed ? "opacity-50" : ""} />
                                <span className={`text-xs font-bold ${isClaimed ? "text-slate-500" : "text-amber-400"}`}>
                                  {mission.reward.coins}
                                </span>
                              </div>
                            )}
                            {mission.reward.fp && (
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${isClaimed ? "bg-slate-800/50 border-white/5" : "bg-slate-800/80 border-pink-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"}`}>
                                <Star className={`w-3.5 h-3.5 ${isClaimed ? "text-slate-500" : "text-pink-400"}`} />
                                <span className={`text-xs font-bold ${isClaimed ? "text-slate-500" : "text-pink-400"}`}>
                                  {mission.reward.fp}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botão de Claim */}
                      <div className="shrink-0 flex items-center justify-center pl-2 sm:pl-4 border-l border-white/5">
                        <button
                          onClick={() => handleClaimReward(mission.id)}
                          disabled={!canClaim || isClaiming}
                          className={`
                            relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-300
                            ${canClaim && !isClaiming
                              ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_4px_15px_rgba(16,185,129,0.4)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 active:translate-y-0"
                              : isClaimed
                              ? "bg-slate-800/40 border border-slate-700/50"
                              : "bg-slate-800/60 border border-white/5"
                            }
                          `}
                        >
                          {isClaiming ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : isClaimed ? (
                            <Check className="w-6 h-6 text-slate-500" />
                          ) : canClaim ? (
                            <>
                              <Gift className="w-6 h-6 text-white relative z-10" />
                              <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
                            </>
                          ) : (
                            <Lock className="w-5 h-5 text-slate-600" />
                          )}
                        </button>
                      </div>
                      
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Bônus de Conclusão Premium ─────────────────────────────── */}
            {(() => {
              const s = activeTabData.stats
              const allDone = s.completed === s.total && s.total > 0
              const bonusAmount = activeTab === "daily" ? "200" : activeTab === "weekly" ? "1.000" : "2.000"
              
              return (
                <div className={`
                  relative mt-4 rounded-2xl p-[1px] overflow-hidden transition-all duration-500
                  ${allDone ? "bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)]" : "bg-slate-800/50"}
                `}>
                  <div className={`
                    relative h-full w-full rounded-[15px] p-5 flex items-center gap-4 sm:gap-6 backdrop-blur-xl
                    ${allDone ? "bg-slate-900/90" : "bg-slate-900/50"}
                  `}>
                    
                    {allDone && <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />}
                    
                    <div className={`
                      w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 z-10 transition-all duration-500
                      ${allDone ? "bg-amber-500/20 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.4)]" : "bg-slate-800 border-white/5"}
                    `}>
                      <Trophy className={`w-7 h-7 ${allDone ? "text-amber-400 drop-shadow-md" : "text-slate-600"}`} />
                    </div>

                    <div className="flex-1 z-10">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className={`text-base font-bold ${allDone ? "text-white" : "text-slate-400"}`}>
                          Baú de Conclusão
                        </h4>
                        {allDone && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-[10px] font-black uppercase tracking-widest animate-pulse">
                            Pronto
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        Complete todas as missões {activeTab === "daily" ? "diárias" : activeTab === "weekly" ? "semanais" : "especiais"} para abrir.
                      </p>
                    </div>

                    <div className="flex flex-col items-end shrink-0 z-10">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Image src="/images/icons/gacha-coin.png" alt="Coin" width={18} height={18} className="drop-shadow-sm" />
                        <span className={`text-lg font-black tracking-wide ${allDone ? "text-gradient-gold" : "text-slate-500"}`}>
                          +{bonusAmount}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.max(s.total, 1) }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-2.5 h-2.5 rounded-sm rotate-45 transition-all duration-500 ${
                              i < s.completed ? "bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.6)]" : "bg-slate-700/50 border border-white/5"
                            }`} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

          </div>
        </main>
      </div>
    </div>
  )
}
