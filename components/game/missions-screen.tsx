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

// ─── Utilitários de Tempo ────────────────────────────────────────────────────
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

// ─── Componente Principal ────────────────────────────────────────────────────
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
    try {
      localStorage.setItem("claimed_missions", JSON.stringify([...claimedMissions]))
    } catch {}
  }, [claimedMissions])

  const [dailyTarget]  = useState<number>(() => getNextMidnightUTC())
  const [weeklyTarget] = useState<number>(() => getNextMondayMidnightUTC())
  const [eventTarget]  = useState<number>(() => getEventEndTimestamp())

  const totalCards   = collection?.length || 0
  const wins         = matchHistory?.filter(m => m.result === "won").length || 0
  const totalMatches = matchHistory?.length || 0

  const allMissions: Mission[] = useMemo(() => [
    {
      id: "daily-1", name: "Abertura Diária", description: "Abra 3 packs no gacha hoje",
      type: "daily", category: "gacha", icon: <Sparkles className="w-5 h-5" />,
      progress: 0, maxProgress: 3, reward: { coins: 100 },
      completed: false, claimed: false,
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
      // CORREÇÃO AQUI: Removido o operador de módulo que causava o bug
      progress: Math.min(totalCards, 5), maxProgress: 5, reward: { coins: 100, fp: 10 },
      completed: totalCards >= 5, claimed: false,
    },
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
    {
      id: "special-1", name: "Lançamento Especial", description: "Comemore o lançamento coletando 50 cartas!",
      type: "special", category: "collection", icon: <Flame className="w-5 h-5" />,
      progress: Math.min(totalCards, 50), maxProgress: 50, reward: { coins: 1000, fp: 500 },
      completed: totalCards >= 50, claimed: false,
    },
  ], [totalCards, wins])

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
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0A0F1C] text-slate-200 font-sans">
      
      {/* Background FX */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
        <div 
          className="absolute inset-0 transition-all duration-1000"
          style={{
            background: activeTab === "daily" 
              ? "radial-gradient(circle at 15% 0%, rgba(6,182,212,0.12) 0%, transparent 50%)"
              : activeTab === "weekly"
              ? "radial-gradient(circle at 15% 0%, rgba(168,85,247,0.12) 0%, transparent 50%)"
              : "radial-gradient(circle at 15% 0%, rgba(245,158,11,0.12) 0%, transparent 50%)"
          }}
        />
      </div>

      <style>{`
        @keyframes shine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .animate-shine {
          background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.3) 50%, transparent 80%);
          background-size: 200% auto;
          animation: shine 3s linear infinite;
        }
      `}</style>

      <div className="relative z-10 flex flex-col min-h-screen w-full max-w-3xl mx-auto">
        
        {/* Header */}
        <header className="sticky top-0 z-40 px-4 py-4">
          <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-2xl">
            <button onClick={onBack} className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-white/5 flex items-center justify-center group-hover:bg-slate-700">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold hidden sm:block">Voltar</span>
            </button>

            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-cyan-400" />
              <h1 className="text-xl font-black tracking-widest bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">MISSÕES</h1>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/80 border border-white/10 px-3 py-1.5 rounded-xl">
              <Image src="/images/icons/gacha-coin.png" alt="Coin" width={20} height={20} className="w-5 h-5" />
              <span className="text-white font-bold">{coins?.toLocaleString() || "0"}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 pb-12">
          <div className="flex flex-col gap-6">

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-3">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id
                const pct = tab.stats.total > 0 ? (tab.stats.completed / tab.stats.total) * 100 : 0
                const c = TAB_COLORS[tab.color]
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex flex-col rounded-2xl border p-4 transition-all duration-300 ${isActive ? c.active : "bg-slate-900/40 border-white/5"}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg">{tab.icon}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${isActive ? "bg-white/10" : "text-slate-500"}`}>
                        {tab.stats.completed}/{tab.stats.total}
                      </span>
                    </div>
                    <div className={`text-sm font-bold text-left mb-3 ${isActive ? "text-white" : "text-slate-500"}`}>{tab.label}</div>
                    <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${isActive ? c.bar : "bg-slate-700"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between bg-slate-900/30 border border-white/5 rounded-2xl p-2 pl-4">
              <p className="text-slate-400 text-xs font-medium">Fique de olho no tempo restante!</p>
              <CountdownTimer targetMs={activeTabData.target} label={activeTabData.timerLabel} color={activeTabData.color} />
            </div>

            {/* Mission List */}
            <div className="flex flex-col gap-4">
              {filteredMissions.map((mission) => {
                const isClaimed = claimedMissions.has(mission.id)
                const isClaiming = claimingId === mission.id
                const canClaim = mission.completed && !isClaimed
                const cat = CATEGORY[mission.category as keyof typeof CATEGORY] ?? CATEGORY.general
                const pct = Math.min(100, (mission.progress / mission.maxProgress) * 100)
                const tabC = TAB_COLORS[activeTabData.color]

                return (
                  <div key={mission.id} className={`relative rounded-2xl border p-4 flex gap-4 items-center transition-all ${isClaimed ? "opacity-50 grayscale bg-slate-900/20" : canClaim ? "bg-slate-900/80 border-emerald-500/50" : "bg-slate-900/50 border-white/10"}`}>
                    
                    {canClaim && <div className="absolute inset-0 animate-shine pointer-events-none rounded-2xl" />}

                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${cat.bg} ${cat.border} ${cat.iconText}`}>
                      {mission.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate">{mission.name}</h3>
                      <p className="text-xs text-slate-400 mb-3">{mission.description}</p>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${canClaim ? "bg-emerald-400" : tabC.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex gap-2">
                          {mission.reward.coins && (
                            <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-md border border-white/5">
                              <Image src="/images/icons/gacha-coin.png" alt="C" width={12} height={12} />
                              <span className="text-[10px] font-bold text-amber-400">{mission.reward.coins}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleClaimReward(mission.id)}
                      disabled={!canClaim || isClaiming}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${canClaim ? "bg-emerald-500 text-white shadow-lg" : "bg-slate-800 text-slate-600"}`}
                    >
                      {isClaiming ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isClaimed ? <Check className="w-5 h-5" /> : canClaim ? <Gift className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Footer Bonus */}
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Trophy className="w-8 h-8 text-slate-700" />
                <div>
                  <h4 className="font-bold text-sm text-slate-300">Bônus de Conclusão</h4>
                  <p className="text-xs text-slate-500">Complete tudo para liberar.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <Image src="/images/icons/gacha-coin.png" alt="C" width={16} height={16} />
                 <span className="text-lg font-black text-slate-500">+{activeTab === "daily" ? "200" : "1.000"}</span>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
