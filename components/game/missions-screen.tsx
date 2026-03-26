"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import {
  ArrowLeft, Target, Calendar, Star, Gift, Check,
  Sparkles, Flame, Swords, BookOpen, Lock, Trophy, Zap, Crown,
} from "lucide-react"
import Image from "next/image"

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface MissionsScreenProps { onBack: () => void }
interface Mission {
  id: string; name: string; description: string
  type: "daily" | "weekly" | "special"
  category: "gacha" | "battle" | "collection" | "social" | "general"
  icon: React.ReactNode; progress: number; maxProgress: number
  reward: { coins?: number; fp?: number; item?: string }
  completed: boolean; claimed: boolean
}

// ─── Time Utilities ───────────────────────────────────────────────────────────
function getNextMidnightUTC() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime()
}
function getNextMondayMidnightUTC() {
  const now = new Date(); const day = now.getUTCDay()
  const d = day === 0 ? 1 : 8 - day
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d)).getTime()
}
function getEventEndTimestamp() {
  const KEY = "missions_event_end"
  const stored = typeof window !== "undefined" ? localStorage.getItem(KEY) : null
  if (stored) { const ts = parseInt(stored, 10); if (!isNaN(ts) && ts > Date.now()) return ts }
  const end = Date.now() + 30 * 24 * 60 * 60 * 1000
  if (typeof window !== "undefined") localStorage.setItem(KEY, String(end))
  return end
}
function formatCountdown(ms: number) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  const s = Math.floor(ms / 1000)
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}
const pad = (n: number) => String(n).padStart(2, "0")

// ─── Animated Background Orbs ─────────────────────────────────────────────────
function BackgroundOrbs({ activeTab }: { activeTab: string }) {
  const configs = {
    daily:   { c1: "rgba(6,182,212,0.15)", c2: "rgba(56,189,248,0.08)", c3: "rgba(103,232,249,0.06)" },
    weekly:  { c1: "rgba(168,85,247,0.15)", c2: "rgba(139,92,246,0.08)", c3: "rgba(196,181,253,0.06)" },
    special: { c1: "rgba(245,158,11,0.15)", c2: "rgba(251,191,36,0.08)", c3: "rgba(252,211,77,0.06)" },
  }
  const c = configs[activeTab as keyof typeof configs] || configs.daily
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(15,23,42,0) 0%, #050810 70%)" }} />
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-60 transition-all duration-1500" style={{ background: c.c1 }} />
      <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full blur-3xl opacity-40 transition-all duration-1500" style={{ background: c.c2 }} />
      <div className="absolute bottom-1/4 left-1/4 w-56 h-56 rounded-full blur-3xl opacity-30 transition-all duration-1500" style={{ background: c.c3 }} />
      <div className="absolute inset-0" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
    </div>
  )
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function CountdownTimer({ targetMs, label, color }: { targetMs: number; label: string; color: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()))
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [targetMs])
  const { days, hours, minutes, seconds } = formatCountdown(remaining)
  const palette = {
    cyan:   { wrap: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30", num: "text-cyan-300", lbl: "text-cyan-500", divider: "bg-cyan-500/20", dot: "#22d3ee" },
    purple: { wrap: "from-purple-500/20 to-purple-500/5 border-purple-500/30", num: "text-purple-300", lbl: "text-purple-500", divider: "bg-purple-500/20", dot: "#c084fc" },
    amber:  { wrap: "from-amber-500/20 to-amber-500/5 border-amber-500/30", num: "text-amber-300", lbl: "text-amber-500", divider: "bg-amber-500/20", dot: "#fbbf24" },
  }
  const p = palette[color as keyof typeof palette] || palette.cyan
  const units = days > 0
    ? [{ v: days, l: "DIAS" }, { v: hours, l: "HRS" }, { v: minutes, l: "MIN" }]
    : [{ v: hours, l: "HRS" }, { v: minutes, l: "MIN" }, { v: seconds, l: "SEG" }]
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-gradient-to-r ${p.wrap} backdrop-blur-sm`}>
      <div className="relative mr-1">
        <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: p.dot, width: 6, height: 6 }} />
        <span className="relative block w-1.5 h-1.5 rounded-full" style={{ background: p.dot, boxShadow: `0 0 6px ${p.dot}` }} />
      </div>
      <span className={`text-[9px] font-black uppercase tracking-widest mr-1.5 ${p.lbl}`}>{label}</span>
      {units.map(({ v, l }, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className={`text-[10px] font-black opacity-40 ${p.num}`}>:</span>}
          <span className="flex flex-col items-center leading-none">
            <span className={`font-mono text-[13px] font-black ${p.num}`}>{pad(v)}</span>
            <span className={`text-[7px] font-bold uppercase tracking-wider opacity-50 ${p.lbl}`}>{l}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

// ─── Mission Card ──────────────────────────────────────────────────────────────
const CAT_STYLE = {
  gacha:      { bg: "from-violet-600/25 to-violet-500/10", border: "border-violet-500/40", icon: "text-violet-300", iconBg: "bg-violet-500/20", glow: "shadow-[0_0_20px_rgba(139,92,246,0.25)]", bar: "from-violet-400 to-violet-300", orb: "rgba(139,92,246,0.3)" },
  battle:     { bg: "from-rose-600/25 to-rose-500/10",     border: "border-rose-500/40",   icon: "text-rose-300",   iconBg: "bg-rose-500/20",   glow: "shadow-[0_0_20px_rgba(244,63,94,0.25)]",  bar: "from-rose-400 to-rose-300",   orb: "rgba(244,63,94,0.3)"   },
  collection: { bg: "from-amber-600/25 to-amber-500/10",   border: "border-amber-500/40",  icon: "text-amber-300",  iconBg: "bg-amber-500/20",  glow: "shadow-[0_0_20px_rgba(245,158,11,0.25)]", bar: "from-amber-400 to-amber-300", orb: "rgba(245,158,11,0.3)"  },
  social:     { bg: "from-pink-600/25 to-pink-500/10",     border: "border-pink-500/40",   icon: "text-pink-300",   iconBg: "bg-pink-500/20",   glow: "shadow-[0_0_20px_rgba(236,72,153,0.25)]", bar: "from-pink-400 to-pink-300",   orb: "rgba(236,72,153,0.3)"  },
  general:    { bg: "from-sky-600/25 to-sky-500/10",       border: "border-sky-500/40",    icon: "text-sky-300",    iconBg: "bg-sky-500/20",    glow: "shadow-[0_0_20px_rgba(14,165,233,0.25)]", bar: "from-sky-400 to-sky-300",     orb: "rgba(14,165,233,0.3)"  },
}

function MissionCard({
  mission, isClaimed, isClaiming, canClaim, tabColor, onClaim
}: {
  mission: Mission; isClaimed: boolean; isClaiming: boolean
  canClaim: boolean; tabColor: string; onClaim: () => void
}) {
  const cat = CAT_STYLE[mission.category as keyof typeof CAT_STYLE] || CAT_STYLE.general
  const pct = Math.min(100, (mission.progress / mission.maxProgress) * 100)

  const barGradient = canClaim
    ? "from-emerald-400 via-green-300 to-emerald-400"
    : cat.bar

  return (
    <div className={`
      group relative rounded-2xl border transition-all duration-500 overflow-hidden
      ${isClaimed
        ? "opacity-40 grayscale border-white/5 bg-slate-900/20"
        : canClaim
          ? `bg-gradient-to-br from-emerald-900/30 to-slate-900/60 border-emerald-500/50 ${cat.glow}`
          : `bg-gradient-to-br ${cat.bg} ${cat.border}`
      }
    `}>
      {/* Shine sweep on claimable */}
      {canClaim && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div className="absolute -inset-full rotate-12 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[sweep_3s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Category glow orb top-right */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: cat.orb, transform: "translate(30%, -30%)" }} />

      <div className="relative flex gap-4 p-4 items-center">
        {/* Icon */}
        <div className="relative shrink-0">
          <div className={`
            w-14 h-14 rounded-2xl flex items-center justify-center border
            ${cat.iconBg} ${cat.border} ${cat.icon}
            transition-transform duration-300 group-hover:scale-105
          `}
            style={{ boxShadow: canClaim ? "0 0 20px rgba(52,211,153,0.4)" : "" }}
          >
            <div className="scale-125">{mission.icon}</div>
          </div>
          {canClaim && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          {/* Title + reward */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`font-black text-sm leading-tight ${isClaimed ? "text-slate-500" : "text-white"}`}>
              {mission.name}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {mission.reward.coins && (
                <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                  <span className="text-amber-400 text-[9px]">🪙</span>
                  <span className="text-[10px] font-black text-amber-300">{mission.reward.coins.toLocaleString()}</span>
                </div>
              )}
              {mission.reward.fp && (
                <div className="flex items-center gap-1 bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 rounded-lg">
                  <Zap className="w-2.5 h-2.5 text-violet-400" />
                  <span className="text-[10px] font-black text-violet-300">{mission.reward.fp}</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">{mission.description}</p>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative h-2 bg-slate-950/80 rounded-full overflow-hidden border border-white/5">
              <div
                className={`h-full bg-gradient-to-r ${barGradient} rounded-full transition-all duration-1000 relative overflow-hidden`}
                style={{ width: `${pct}%` }}
              >
                {pct > 10 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_linear_infinite] bg-[length:200%_100%]" />
                )}
              </div>
            </div>
            <span className={`text-[10px] font-black tabular-nums shrink-0 ${canClaim ? "text-emerald-400" : "text-slate-500"}`}>
              {mission.progress}<span className="text-slate-600">/{mission.maxProgress}</span>
            </span>
          </div>
        </div>

        {/* Claim Button */}
        <button
          onClick={onClaim}
          disabled={!canClaim || isClaiming}
          className={`
            shrink-0 relative w-14 h-14 rounded-2xl flex items-center justify-center
            transition-all duration-300 border overflow-hidden
            ${isClaimed
              ? "bg-slate-800/50 border-white/5 text-slate-600"
              : canClaim
                ? "bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-400/50 text-white shadow-[0_0_20px_rgba(52,211,153,0.4)] hover:scale-105 hover:shadow-[0_0_30px_rgba(52,211,153,0.6)] active:scale-95"
                : "bg-slate-900/60 border-white/5 text-slate-600 cursor-not-allowed"
            }
          `}
        >
          {canClaim && <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />}
          <div className="relative z-10">
            {isClaiming
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : isClaimed
                ? <Check className="w-5 h-5 text-slate-500" />
                : canClaim
                  ? <Gift className="w-5 h-5" />
                  : <Lock className="w-4 h-4" />
            }
          </div>
        </button>
      </div>

      {/* Bottom progress label */}
      {canClaim && !isClaimed && (
        <div className="mx-4 mb-3 flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Recompensa disponível!</span>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MissionsScreen({ onBack }: MissionsScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, collection, matchHistory } = useGame()
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "special">("daily")
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimedMissions, setClaimedMissions] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try { const r = localStorage.getItem("claimed_missions"); return r ? new Set(JSON.parse(r) as string[]) : new Set() }
    catch { return new Set() }
  })
  useEffect(() => {
    try { localStorage.setItem("claimed_missions", JSON.stringify([...claimedMissions])) } catch {}
  }, [claimedMissions])

  const [dailyTarget]  = useState(() => getNextMidnightUTC())
  const [weeklyTarget] = useState(() => getNextMondayMidnightUTC())
  const [eventTarget]  = useState(() => getEventEndTimestamp())

  const totalCards = collection?.length || 0
  const wins = matchHistory?.filter((m: any) => m.result === "won").length || 0

  const allMissions: Mission[] = useMemo(() => [
    { id: "daily-1", name: "Abertura Diária",    description: "Abra 3 packs no gacha hoje",            type: "daily",   category: "gacha",      icon: <Sparkles className="w-5 h-5" />, progress: 0,                     maxProgress: 3,  reward: { coins: 100 },        completed: false,          claimed: false },
    { id: "daily-2", name: "Duelista Nato",       description: "Vença 2 partidas no modo Batalha",      type: "daily",   category: "battle",     icon: <Swords className="w-5 h-5" />,  progress: Math.min(wins, 2),     maxProgress: 2,  reward: { coins: 150, fp: 20 },completed: wins >= 2,      claimed: false },
    { id: "daily-3", name: "Presença Diária",     description: "Faça login no jogo",                    type: "daily",   category: "general",    icon: <Calendar className="w-5 h-5" />,progress: 1,                     maxProgress: 1,  reward: { coins: 50 },         completed: true,           claimed: false },
    { id: "daily-4", name: "Colecionador Ativo",  description: "Adicione 5 cartas à coleção",           type: "daily",   category: "collection", icon: <BookOpen className="w-5 h-5" />,progress: Math.min(totalCards,5), maxProgress: 5, reward: { coins: 100, fp: 10 },completed: totalCards >= 5, claimed: false },
    { id: "weekly-1",name: "Mestre Gacha",        description: "Abra 30 packs esta semana",             type: "weekly",  category: "gacha",      icon: <Sparkles className="w-5 h-5" />,progress: Math.min(totalCards,30),maxProgress: 30, reward: { coins: 500, fp: 100 },completed: totalCards >= 30,claimed: false },
    { id: "weekly-2",name: "Guerreiro da Semana", description: "Vença 10 partidas esta semana",         type: "weekly",  category: "battle",     icon: <Swords className="w-5 h-5" />,  progress: Math.min(wins,10),     maxProgress: 10, reward: { coins: 700, fp: 150 },completed: wins >= 10,     claimed: false },
    { id: "special-1",name:"Lançamento Especial", description: "Comemore o lançamento coletando 50 cartas!", type: "special", category: "collection", icon: <Flame className="w-5 h-5" />,  progress: Math.min(totalCards,50),maxProgress: 50,reward: { coins: 1000, fp: 500 },completed: totalCards >= 50,claimed: false },
  ], [totalCards, wins])

  const handleClaimReward = useCallback((id: string) => {
    if (claimingId || claimedMissions.has(id)) return
    const mission = allMissions.find(m => m.id === id)
    if (!mission?.completed) return
    setClaimingId(id)
    setTimeout(() => {
      if (mission.reward.coins && setCoins) setCoins((p: number) => p + mission.reward.coins!)
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
    { id: "daily",   label: "Diárias",   emoji: "☀️", Icon: Calendar, color: "cyan",   stats: stats.daily,   target: dailyTarget,  timerLabel: "Reset Diário",  gradient: "from-cyan-500 to-sky-400",     glow: "shadow-[0_4px_24px_rgba(6,182,212,0.4)]",   ring: "ring-cyan-500/50",   textColor: "text-cyan-400",   bgActive: "bg-gradient-to-br from-cyan-950/60 to-slate-900/80",   border: "border-cyan-500/40" },
    { id: "weekly",  label: "Semanais",  emoji: "📅", Icon: Star,     color: "purple", stats: stats.weekly,  target: weeklyTarget, timerLabel: "Reset Semanal", gradient: "from-purple-500 to-violet-400",  glow: "shadow-[0_4px_24px_rgba(168,85,247,0.4)]",  ring: "ring-purple-500/50", textColor: "text-purple-400", bgActive: "bg-gradient-to-br from-purple-950/60 to-slate-900/80", border: "border-purple-500/40" },
    { id: "special", label: "Especiais", emoji: "⚡", Icon: Flame,    color: "amber",  stats: stats.special, target: eventTarget,  timerLabel: "Fim do Evento", gradient: "from-amber-500 to-orange-400",   glow: "shadow-[0_4px_24px_rgba(245,158,11,0.4)]",  ring: "ring-amber-500/50",  textColor: "text-amber-400",  bgActive: "bg-gradient-to-br from-amber-950/60 to-slate-900/80",  border: "border-amber-500/40" },
  ] as const

  const activeTabData = TABS.find(t => t.id === activeTab)!
  const allComplete = filteredMissions.every(m => claimedMissions.has(m.id) || m.completed)

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#050810] text-slate-200">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes sweep { 0% { transform: translateX(-100%) rotate(12deg); } 100% { transform: translateX(200%) rotate(12deg); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes pulseGlow { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes borderFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .font-rajdhani { font-family: 'Rajdhani', sans-serif; }
        .animate-shimmer { animation: shimmer 2s linear infinite; background-size: 200% 100%; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        .tab-active-glow { position: relative; }
        .tab-active-glow::before { content: ''; position: absolute; inset: -1px; border-radius: 18px; padding: 1px; background: linear-gradient(135deg, var(--tab-c1), transparent, var(--tab-c2)); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
        .mission-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .mission-card:hover { transform: translateY(-2px); }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      <BackgroundOrbs activeTab={activeTab} />

      <div className="relative z-10 flex flex-col min-h-screen w-full max-w-3xl mx-auto">
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 px-4 pt-4 pb-2">
          <div className="relative flex items-center justify-between bg-slate-900/50 backdrop-blur-2xl border border-white/8 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            <button onClick={onBack} className="group flex items-center gap-2 text-slate-400 hover:text-white transition-all">
              <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-white/8 flex items-center justify-center group-hover:bg-slate-700 group-hover:border-white/15 transition-all">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold hidden sm:block tracking-wide">Voltar</span>
            </button>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5">
                <Target className={`w-5 h-5 ${activeTabData.textColor} transition-colors duration-500`} />
                <h1 className="font-rajdhani text-2xl font-700 tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-400">
                  MISSÕES
                </h1>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {TABS.map(tab => (
                  <div key={tab.id} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeTab === tab.id ? `bg-gradient-to-r ${tab.gradient} scale-125` : "bg-slate-700"}`} />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-gradient-to-br from-amber-950/60 to-slate-900/80 border border-amber-500/25 px-3 py-2 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <span className="text-base leading-none">🪙</span>
              <span className="text-white font-black text-sm tabular-nums">{coins?.toLocaleString() || "0"}</span>
            </div>
          </div>
        </header>

        {/* ─── Main Content ────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 pb-12 pt-3">
          <div className="flex flex-col gap-5">

            {/* ─── Tab Selector ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id
                const pct = tab.stats.total > 0 ? (tab.stats.completed / tab.stats.total) * 100 : 0
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`
                      relative flex flex-col rounded-2xl border p-3.5 transition-all duration-400 overflow-hidden
                      ${isActive ? `${tab.bgActive} ${tab.border} ${tab.glow}` : "bg-slate-900/30 border-white/6 hover:border-white/12 hover:bg-slate-900/50"}
                    `}
                  >
                    {isActive && (
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                    )}
                    {/* Icon */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${isActive ? `bg-gradient-to-br ${tab.gradient} shadow-md animate-float` : "bg-slate-800/60"}`}>
                        {tab.emoji}
                      </div>
                      <div className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${isActive ? `bg-white/10 border-white/15 ${tab.textColor}` : "text-slate-600 border-white/5 bg-slate-900/50"}`}>
                        {tab.stats.completed}/{tab.stats.total}
                      </div>
                    </div>
                    {/* Label */}
                    <div className={`text-sm font-black tracking-wide mb-2.5 text-left transition-colors ${isActive ? "text-white" : "text-slate-500"}`}>
                      {tab.label}
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-slate-950/80 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${isActive ? `bg-gradient-to-r ${tab.gradient}` : "bg-slate-700"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {isActive && pct === 100 && (
                      <div className={`mt-1.5 text-[9px] font-black uppercase tracking-widest ${tab.textColor} flex items-center gap-1`}>
                        <Crown className="w-2.5 h-2.5" /> Tudo concluído!
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* ─── Timer Banner ───────────────────────────────────────────────── */}
            <div className={`relative flex items-center justify-between rounded-2xl border px-4 py-3 overflow-hidden transition-all duration-500 bg-slate-900/30 ${activeTabData.border}`}>
              <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${activeTabData.gradient}`} />
              </div>
              <div className="pl-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Tempo restante</p>
                <p className="text-xs text-slate-400">Não perca suas recompensas!</p>
              </div>
              <CountdownTimer targetMs={activeTabData.target} label={activeTabData.timerLabel} color={activeTabData.color} />
            </div>

            {/* ─── Section Label ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
              <div className={`h-px flex-1 bg-gradient-to-r ${activeTabData.gradient} opacity-20`} />
              <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${activeTabData.textColor}`}>
                {filteredMissions.length} missões ativas
              </span>
              <div className={`h-px flex-1 bg-gradient-to-l ${activeTabData.gradient} opacity-20`} />
            </div>

            {/* ─── Mission Cards ───────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              {filteredMissions.map((mission, i) => {
                const isClaimed = claimedMissions.has(mission.id)
                const isClaiming = claimingId === mission.id
                const canClaim = mission.completed && !isClaimed
                return (
                  <div
                    key={mission.id}
                    className="mission-card"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <MissionCard
                      mission={mission}
                      isClaimed={isClaimed}
                      isClaiming={isClaiming}
                      canClaim={canClaim}
                      tabColor={activeTabData.color}
                      onClaim={() => handleClaimReward(mission.id)}
                    />
                  </div>
                )
              })}
            </div>

            {/* ─── Completion Bonus Card ────────────────────────────────────────── */}
            <div className={`
              relative rounded-2xl border overflow-hidden transition-all duration-500
              ${allComplete
                ? `bg-gradient-to-br from-yellow-900/30 to-amber-900/20 border-yellow-500/40 shadow-[0_0_30px_rgba(234,179,8,0.2)]`
                : "bg-slate-900/30 border-white/6"
              }
            `}>
              {allComplete && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute -inset-full rotate-12 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-[sweep_4s_ease-in-out_infinite]" />
                </div>
              )}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              <div className="flex items-center gap-4 p-5">
                <div className={`
                  relative w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0
                  ${allComplete ? "bg-gradient-to-br from-yellow-500/30 to-amber-500/20 border-yellow-500/40" : "bg-slate-800/50 border-white/6"}
                `}>
                  {allComplete && <div className="absolute inset-0 rounded-2xl animate-pulse-glow bg-yellow-400/10" />}
                  <Trophy className={`w-7 h-7 ${allComplete ? "text-yellow-400" : "text-slate-600"}`} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-black text-sm mb-0.5 ${allComplete ? "text-yellow-300" : "text-slate-400"}`}>
                    Bônus de Conclusão Total
                  </h4>
                  <p className={`text-[11px] ${allComplete ? "text-yellow-500/80" : "text-slate-600"}`}>
                    {allComplete ? "✨ Parabéns! Colete seu bônus!" : "Complete todas as missões para desbloquear."}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${allComplete ? "bg-yellow-500/20 border-yellow-500/40" : "bg-slate-800/50 border-white/5"}`}>
                    <span className="text-sm">🪙</span>
                    <span className={`font-black text-lg tabular-nums ${allComplete ? "text-yellow-300" : "text-slate-600"}`}>
                      +{activeTab === "daily" ? "200" : activeTab === "weekly" ? "1.000" : "5.000"}
                    </span>
                  </div>
                  {allComplete && (
                    <button className="text-[9px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded-lg hover:bg-yellow-500/20 transition-colors">
                      Coletar →
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
