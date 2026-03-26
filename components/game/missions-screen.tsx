"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import {
  ArrowLeft, Target, Calendar, Star, Gift, Check,
  Sparkles, Flame, Swords, BookOpen, Users, Lock, Trophy, Coins, Zap
} from "lucide-react"

// ─── Coin Icon Inline (substitui next/image) ─────────────────────────────────
function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="url(#coinGrad)" stroke="url(#coinStroke)" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="8.5" fill="url(#coinInner)" opacity="0.6"/>
      <text x="12" y="16.5" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FFF8DC" fontFamily="serif">G</text>
      <defs>
        <radialGradient id="coinGrad" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#FFE066"/>
          <stop offset="50%" stopColor="#F5A623"/>
          <stop offset="100%" stopColor="#C67C00"/>
        </radialGradient>
        <linearGradient id="coinStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700"/>
          <stop offset="100%" stopColor="#A0620A"/>
        </linearGradient>
        <radialGradient id="coinInner" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#FFE566" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#F5A623" stopOpacity="0"/>
        </radialGradient>
      </defs>
    </svg>
  )
}

// ─── FP Icon Inline ───────────────────────────────────────────────────────────
function FPIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polygon points="12,2 15.5,9 23,10 17.5,15.5 19,23 12,19.5 5,23 6.5,15.5 1,10 8.5,9" fill="url(#fpGrad)" stroke="#818CF8" strokeWidth="1"/>
      <defs>
        <linearGradient id="fpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA"/>
          <stop offset="100%" stopColor="#6366F1"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
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
  reward: { coins?: number; fp?: number; item?: string }
  completed: boolean
  claimed: boolean
}

// ─── Utilitários de Tempo ────────────────────────────────────────────────────
function getNextMidnightUTC(): number {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime()
}
function getNextMondayMidnightUTC(): number {
  const now = new Date()
  const day = now.getUTCDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday)).getTime()
}
function getEventEndTimestamp(): number {
  const STORAGE_KEY = "missions_event_end"
  const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  if (stored) { const ts = parseInt(stored, 10); if (!isNaN(ts) && ts > Date.now()) return ts }
  const end = Date.now() + 30 * 24 * 60 * 60 * 1000
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, String(end))
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
function pad(n: number) { return String(n).padStart(2, "0") }

// ─── Countdown Timer ─────────────────────────────────────────────────────────
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
    cyan:   { pill: "bg-cyan-500/10 border-cyan-500/20",   text: "text-cyan-300",   dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" },
    purple: { pill: "bg-purple-500/10 border-purple-500/20", text: "text-purple-300", dot: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" },
    amber:  { pill: "bg-amber-500/10 border-amber-500/20",  text: "text-amber-300",  dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" },
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

// ─── Mission Card ─────────────────────────────────────────────────────────────
function MissionCard({
  mission, isClaimed, isClaiming, onClaim, tabColor,
}: {
  mission: Mission
  isClaimed: boolean
  isClaiming: boolean
  onClaim: (id: string) => void
  tabColor: string
}) {
  // canClaim: completed e ainda não foi claimed (nem no state local nem no set)
  const canClaim = mission.completed && !isClaimed

  const CATEGORY = {
    gacha:      { bg: "from-violet-600/25 to-violet-500/10", iconBg: "bg-violet-500/20", iconText: "text-violet-300", border: "border-violet-500/30", orb: "bg-violet-500/20" },
    battle:     { bg: "from-rose-600/25 to-rose-500/10",     iconBg: "bg-rose-500/20",   iconText: "text-rose-300",   border: "border-rose-500/30",   orb: "bg-rose-500/20" },
    collection: { bg: "from-amber-600/25 to-amber-500/10",   iconBg: "bg-amber-500/20",  iconText: "text-amber-300",  border: "border-amber-500/30",  orb: "bg-amber-500/20" },
    social:     { bg: "from-pink-600/25 to-pink-500/10",     iconBg: "bg-pink-500/20",   iconText: "text-pink-300",   border: "border-pink-500/30",   orb: "bg-pink-500/20" },
    general:    { bg: "from-sky-600/25 to-sky-500/10",       iconBg: "bg-sky-500/20",    iconText: "text-sky-300",    border: "border-sky-500/30",    orb: "bg-sky-500/20" },
  }
  const cat = CATEGORY[mission.category] ?? CATEGORY.general

  const TAB_BAR: Record<string, string> = {
    cyan:   "from-cyan-400 to-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.5)]",
    purple: "from-purple-400 to-purple-300 shadow-[0_0_8px_rgba(192,132,252,0.5)]",
    amber:  "from-amber-400 to-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
  }
  const barClass = TAB_BAR[tabColor] ?? TAB_BAR.cyan
  const pct = Math.min(100, (mission.progress / mission.maxProgress) * 100)

  return (
    <div
      className={`
        relative rounded-2xl border overflow-hidden transition-all duration-300
        ${isClaimed
          ? "opacity-40 grayscale bg-slate-900/20 border-white/5"
          : canClaim
          ? "bg-gradient-to-br from-emerald-950/60 to-slate-900/80 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
          : `bg-gradient-to-br ${cat.bg} border-white/8 hover:border-white/15`
        }
      `}
    >
      {/* Shine line no topo */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${canClaim && !isClaimed ? "via-emerald-400/60" : "via-white/10"} to-transparent`} />

      {/* Orb decorativo */}
      {!isClaimed && (
        <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-40 ${canClaim ? "bg-emerald-500/30" : cat.orb}`} />
      )}

      {/* Sweep de luz nos disponíveis */}
      {canClaim && !isClaiming && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div className="animate-shine absolute inset-0" />
        </div>
      )}

      <div className="relative z-10 p-4 flex gap-4 items-center">
        {/* Ícone de categoria */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${cat.iconBg} ${cat.border} ${cat.iconText}`}>
          {mission.icon}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-white text-sm truncate">{mission.name}</h3>
            {isClaimed && (
              <span className="shrink-0 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                ✓ Coletado
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">{mission.description}</p>

          {/* Barra de progresso */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-950/80 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${canClaim ? "from-emerald-400 to-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : barClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-500 shrink-0">
              {mission.progress}/{mission.maxProgress}
            </span>
          </div>

          {/* Badges de recompensa */}
          <div className="flex gap-2 mt-2.5">
            {mission.reward.coins && (
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 px-2 py-1 rounded-lg">
                <CoinIcon size={13} />
                <span className="text-[11px] font-bold text-amber-300">{mission.reward.coins.toLocaleString()}</span>
              </div>
            )}
            {mission.reward.fp && (
              <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/25 px-2 py-1 rounded-lg">
                <FPIcon size={13} />
                <span className="text-[11px] font-bold text-indigo-300">{mission.reward.fp} FP</span>
              </div>
            )}
          </div>
        </div>

        {/* Botão de coleta */}
        <button
          onClick={() => onClaim(mission.id)}
          disabled={!canClaim || isClaiming || isClaimed}
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
            ${isClaimed
              ? "bg-slate-800/50 text-slate-600 cursor-default"
              : canClaim
              ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_16px_rgba(16,185,129,0.5)] hover:shadow-[0_0_24px_rgba(16,185,129,0.7)] hover:scale-105 active:scale-95"
              : "bg-slate-800/60 text-slate-600 cursor-not-allowed border border-white/5"
            }
          `}
        >
          {isClaiming
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : isClaimed
            ? <Check className="w-5 h-5 text-emerald-500" />
            : canClaim
            ? <Gift className="w-5 h-5" />
            : <Lock className="w-4 h-4" />
          }
        </button>
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

  // ✅ FIX: Estado de missões coletadas - inicializa do localStorage corretamente
  const [claimedMissions, setClaimedMissions] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = localStorage.getItem("claimed_missions")
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch { return new Set() }
  })

  // ✅ FIX: Persiste no localStorage sempre que o set muda
  useEffect(() => {
    try {
      localStorage.setItem("claimed_missions", JSON.stringify([...claimedMissions]))
    } catch {}
  }, [claimedMissions])

  const [dailyTarget]  = useState(() => getNextMidnightUTC())
  const [weeklyTarget] = useState(() => getNextMondayMidnightUTC())
  const [eventTarget]  = useState(() => getEventEndTimestamp())

  const totalCards   = collection?.length ?? 0
  const wins         = matchHistory?.filter((m: any) => m.result === "won").length ?? 0

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

  // ✅ FIX PRINCIPAL: handleClaimReward corrigido — verifica claimedMissions corretamente
  const handleClaimReward = useCallback((id: string) => {
    // Bloqueia se já está coletando outro ou se já foi coletado
    if (claimingId !== null) return
    if (claimedMissions.has(id)) return

    const mission = allMissions.find((m) => m.id === id)
    if (!mission) return
    if (!mission.completed) return

    setClaimingId(id)
    setTimeout(() => {
      // Adiciona coins ao jogador
      if (mission.reward.coins) {
        setCoins?.((prev: number) => prev + (mission.reward.coins ?? 0))
      }
      // Marca como coletada
      setClaimedMissions((prev) => new Set([...prev, id]))
      setClaimingId(null)
    }, 800)
  }, [allMissions, claimedMissions, claimingId, setCoins])

  const filteredMissions = allMissions.filter((m) => m.type === activeTab)

  const stats = useMemo(() => {
    const count = (type: string) => ({
      total:     allMissions.filter((m) => m.type === type).length,
      completed: allMissions.filter((m) => m.type === type && (m.completed || claimedMissions.has(m.id))).length,
    })
    return { daily: count("daily"), weekly: count("weekly"), special: count("special") }
  }, [allMissions, claimedMissions])

  const TABS = [
    { id: "daily",   label: "Diárias",   icon: "☀️", color: "cyan",   stats: stats.daily,   target: dailyTarget,  timerLabel: "Reset Diário" },
    { id: "weekly",  label: "Semanais",  icon: "📅", color: "purple", stats: stats.weekly,  target: weeklyTarget, timerLabel: "Reset Semanal" },
    { id: "special", label: "Especiais", icon: "⚡", color: "amber",  stats: stats.special, target: eventTarget,  timerLabel: "Fim do Evento" },
  ] as const

  const TAB_COLORS = {
    cyan:   { active: "bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]", text: "text-cyan-300", bar: "from-cyan-400 to-cyan-300", accent: "bg-cyan-400" },
    purple: { active: "bg-purple-950/40 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]", text: "text-purple-300", bar: "from-purple-400 to-purple-300", accent: "bg-purple-400" },
    amber:  { active: "bg-amber-950/40 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]", text: "text-amber-300", bar: "from-amber-400 to-amber-300", accent: "bg-amber-400" },
  }

  const activeTabData = TABS.find((t) => t.id === activeTab)!
  const activeColor = TAB_COLORS[activeTabData.color]

  // Bonus de conclusão
  const allCurrentClaimed = filteredMissions.every((m) => claimedMissions.has(m.id) || !m.completed)
  const allCurrentCompleted = filteredMissions.every((m) => m.completed || claimedMissions.has(m.id))
  const bonusReward = activeTab === "daily" ? 200 : activeTab === "weekly" ? 1000 : 2000
  const bonusClaimed = claimedMissions.has(`bonus-${activeTab}`)

  const handleBonusClaim = useCallback(() => {
    if (bonusClaimed || !allCurrentCompleted || claimingId !== null) return
    setClaimingId(`bonus-${activeTab}`)
    setTimeout(() => {
      setCoins?.((prev: number) => prev + bonusReward)
      setClaimedMissions((prev) => new Set([...prev, `bonus-${activeTab}`]))
      setClaimingId(null)
    }, 800)
  }, [bonusClaimed, allCurrentCompleted, claimingId, activeTab, bonusReward, setCoins])

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#070B14] text-slate-200">

      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&display=swap');
        @keyframes shine {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
        .animate-shine {
          background: linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.08) 50%, transparent 80%);
          background-size: 200% auto;
          animation: shine 2.5s linear infinite;
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .font-rajdhani { font-family: 'Rajdhani', sans-serif; }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Noise */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
        />
        {/* Grid sutil */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "48px 48px" }}
        />
        {/* Orb dinâmico por aba */}
        <div
          className="absolute inset-0 transition-all duration-1000"
          style={{
            background: activeTab === "daily"
              ? "radial-gradient(ellipse 60% 40% at 80% -10%, rgba(6,182,212,0.18) 0%, transparent 70%), radial-gradient(ellipse 30% 30% at 10% 90%, rgba(6,182,212,0.08) 0%, transparent 60%)"
              : activeTab === "weekly"
              ? "radial-gradient(ellipse 60% 40% at 80% -10%, rgba(168,85,247,0.18) 0%, transparent 70%), radial-gradient(ellipse 30% 30% at 10% 90%, rgba(168,85,247,0.08) 0%, transparent 60%)"
              : "radial-gradient(ellipse 60% 40% at 80% -10%, rgba(245,158,11,0.18) 0%, transparent 70%), radial-gradient(ellipse 30% 30% at 10% 90%, rgba(245,158,11,0.08) 0%, transparent 60%)"
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen w-full max-w-3xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 px-4 py-3">
          <div className="flex items-center justify-between bg-slate-900/70 backdrop-blur-xl border border-white/8 rounded-2xl px-4 py-3 shadow-2xl">
            <button
              onClick={onBack}
              className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-white/8 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold hidden sm:block">Voltar</span>
            </button>

            <div className="flex items-center gap-3">
              <Target className={`w-5 h-5 ${activeColor.text}`} />
              <h1 className="font-rajdhani text-xl font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                MISSÕES
              </h1>
            </div>

            {/* ✅ FIX: Ícone de coin substituído pelo SVG inline */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-white/8 px-3 py-1.5 rounded-xl">
              <CoinIcon size={20} />
              <span className="text-white font-bold text-sm">{coins?.toLocaleString() ?? "0"}</span>
            </div>
          </div>
        </header>

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 pb-12">
          <div className="flex flex-col gap-5">

            {/* ── Tabs ──────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                const pct = tab.stats.total > 0 ? (tab.stats.completed / tab.stats.total) * 100 : 0
                const c = TAB_COLORS[tab.color]
                const allDone = pct === 100
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex flex-col rounded-2xl border p-3.5 transition-all duration-300 overflow-hidden
                      ${isActive ? c.active : "bg-slate-900/30 border-white/5 hover:border-white/10"}`}
                  >
                    {/* Shine top line */}
                    <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${isActive ? `via-white/25` : "via-white/5"} to-transparent`} />

                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xl ${isActive ? "animate-float" : ""}`}>{tab.icon}</span>
                      {allDone
                        ? <span className="text-[10px] font-bold text-amber-400">👑</span>
                        : <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? `${c.text} bg-white/10` : "text-slate-500 bg-white/5"}`}>
                            {tab.stats.completed}/{tab.stats.total}
                          </span>
                      }
                    </div>
                    <div className={`text-sm font-bold text-left mb-2.5 ${isActive ? "text-white" : "text-slate-500"}`}>{tab.label}</div>
                    <div className="w-full h-1.5 bg-slate-950/80 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${isActive ? c.bar : "from-slate-700 to-slate-700"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ── Timer Banner ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between bg-slate-900/40 border border-white/5 rounded-2xl p-2 pl-4 overflow-hidden relative">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${activeColor.accent} rounded-l-2xl`} />
              <p className="text-slate-400 text-xs font-medium">Fique de olho no tempo restante!</p>
              <CountdownTimer targetMs={activeTabData.target} label={activeTabData.timerLabel} color={activeTabData.color} />
            </div>

            {/* ── Mission List ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              {filteredMissions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  isClaimed={claimedMissions.has(mission.id)}
                  isClaiming={claimingId === mission.id}
                  onClaim={handleClaimReward}
                  tabColor={activeTabData.color}
                />
              ))}
            </div>

            {/* ── Bônus de Conclusão ────────────────────────────────────────── */}
            <div
              className={`relative rounded-2xl border overflow-hidden transition-all duration-500 
                ${bonusClaimed
                  ? "opacity-40 grayscale bg-slate-900/20 border-white/5"
                  : allCurrentCompleted
                  ? "bg-gradient-to-br from-amber-950/50 to-slate-900/80 border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.12)]"
                  : "bg-slate-900/40 border-white/5"
                }
              `}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
              {allCurrentCompleted && !bonusClaimed && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                  <div className="animate-shine absolute inset-0" />
                </div>
              )}
              <div className="relative z-10 p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all
                    ${allCurrentCompleted && !bonusClaimed
                      ? "bg-amber-500/20 border-amber-500/40 shadow-[0_0_16px_rgba(245,158,11,0.3)]"
                      : "bg-slate-800/50 border-white/5"
                    }`}>
                    <Trophy className={`w-5 h-5 ${allCurrentCompleted && !bonusClaimed ? "text-amber-400" : "text-slate-600"}`} />
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm ${allCurrentCompleted && !bonusClaimed ? "text-white" : "text-slate-500"}`}>
                      Bônus de Conclusão
                    </h4>
                    <p className="text-xs text-slate-500">
                      {bonusClaimed ? "Recompensa já coletada!" : allCurrentCompleted ? "Parabéns! Colete seu bônus." : "Complete todas as missões para liberar."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all
                    ${allCurrentCompleted && !bonusClaimed
                      ? "bg-amber-500/15 border-amber-500/30"
                      : "bg-slate-800/50 border-white/5"
                    }`}>
                    <CoinIcon size={16} />
                    <span className={`text-base font-black ${allCurrentCompleted && !bonusClaimed ? "text-amber-300" : "text-slate-500"}`}>
                      +{bonusReward.toLocaleString()}
                    </span>
                  </div>
                  {allCurrentCompleted && (
                    <button
                      onClick={handleBonusClaim}
                      disabled={bonusClaimed || claimingId !== null}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300
                        ${bonusClaimed
                          ? "bg-slate-800/50 text-emerald-500 cursor-default"
                          : "bg-amber-500 hover:bg-amber-400 text-white shadow-[0_0_16px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95"
                        }`}
                    >
                      {claimingId === `bonus-${activeTab}`
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : bonusClaimed
                        ? <Check className="w-5 h-5" />
                        : <Gift className="w-5 h-5" />
                      }
                    </button>
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
