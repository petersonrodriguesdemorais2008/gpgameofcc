"use client"

import { useState, useEffect, useMemo } from "react"
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
  ChevronRight,
  Sparkles,
  Flame,
  Swords,
  BookOpen,
  Users,
  RefreshCw,
  Trophy,
  Shield,
  Lock,
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
  expiresIn?: string
}

const STORAGE_KEY = "missions_claimed_v1"

export default function MissionsScreen({ onBack }: MissionsScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, collection, matchHistory, friends } = useGame()
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "special">("daily")
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimedMissions, setClaimedMissions] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? new Set(JSON.parse(stored)) : new Set()
      } catch {
        return new Set()
      }
    }
    return new Set()
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...claimedMissions]))
    } catch {}
  }, [claimedMissions])

  const totalCards = collection.length
  const wins = matchHistory.filter((m) => m.result === "won").length
  const totalMatches = matchHistory.length
  const friendCount = friends.length

  const progressMap = useMemo(
    () => ({
      "daily-1": Math.min(3, Math.floor(Math.random() * 4)),
      "daily-4": Math.min(totalCards % 5, 5),
    }),
    []
  )

  const allMissions: Mission[] = useMemo(() => [
    {
      id: "daily-1",
      name: "Abertura Diária",
      description: "Abra 3 packs no gacha hoje",
      type: "daily",
      category: "gacha",
      icon: <Sparkles className="w-5 h-5" />,
      progress: progressMap["daily-1"],
      maxProgress: 3,
      reward: { coins: 100 },
      completed: progressMap["daily-1"] >= 3,
      claimed: claimedMissions.has("daily-1"),
      expiresIn: "23:45:30",
    },
    {
      id: "daily-2",
      name: "Duelista Nato",
      description: "Vença 2 partidas",
      type: "daily",
      category: "battle",
      icon: <Swords className="w-5 h-5" />,
      progress: Math.min(wins, 2),
      maxProgress: 2,
      reward: { coins: 150, fp: 20 },
      completed: wins >= 2,
      claimed: claimedMissions.has("daily-2"),
      expiresIn: "23:45:30",
    },
    {
      id: "daily-3",
      name: "Login Diário",
      description: "Faça login no jogo",
      type: "daily",
      category: "general",
      icon: <Calendar className="w-5 h-5" />,
      progress: 1,
      maxProgress: 1,
      reward: { coins: 50 },
      completed: true,
      claimed: claimedMissions.has("daily-3"),
      expiresIn: "23:45:30",
    },
    {
      id: "daily-4",
      name: "Colecionador Ativo",
      description: "Adicione 5 cartas à coleção",
      type: "daily",
      category: "collection",
      icon: <BookOpen className="w-5 h-5" />,
      progress: progressMap["daily-4"],
      maxProgress: 5,
      reward: { coins: 100, fp: 10 },
      completed: progressMap["daily-4"] >= 5,
      claimed: claimedMissions.has("daily-4"),
      expiresIn: "23:45:30",
    },
    {
      id: "daily-5",
      name: "Amigo do Dia",
      description: "Envie um coração para um amigo",
      type: "daily",
      category: "social",
      icon: <Users className="w-5 h-5" />,
      progress: 0,
      maxProgress: 1,
      reward: { fp: 30 },
      completed: false,
      claimed: claimedMissions.has("daily-5"),
      expiresIn: "23:45:30",
    },
    {
      id: "weekly-1",
      name: "Mestre Gacha",
      description: "Abra 30 packs esta semana",
      type: "weekly",
      category: "gacha",
      icon: <Sparkles className="w-5 h-5" />,
      progress: Math.min(totalCards, 30),
      maxProgress: 30,
      reward: { coins: 500, fp: 100 },
      completed: totalCards >= 30,
      claimed: claimedMissions.has("weekly-1"),
      expiresIn: "6d 23h",
    },
    {
      id: "weekly-2",
      name: "Guerreiro da Semana",
      description: "Vença 10 partidas",
      type: "weekly",
      category: "battle",
      icon: <Swords className="w-5 h-5" />,
      progress: Math.min(wins, 10),
      maxProgress: 10,
      reward: { coins: 700, fp: 150 },
      completed: wins >= 10,
      claimed: claimedMissions.has("weekly-2"),
      expiresIn: "6d 23h",
    },
    {
      id: "weekly-3",
      name: "Coleção Crescente",
      description: "Colete 20 cartas novas",
      type: "weekly",
      category: "collection",
      icon: <BookOpen className="w-5 h-5" />,
      progress: Math.min(totalCards, 20),
      maxProgress: 20,
      reward: { coins: 400 },
      completed: totalCards >= 20,
      claimed: claimedMissions.has("weekly-3"),
      expiresIn: "6d 23h",
    },
    {
      id: "weekly-4",
      name: "Rede Social",
      description: "Adicione 3 novos amigos",
      type: "weekly",
      category: "social",
      icon: <Users className="w-5 h-5" />,
      progress: Math.min(friendCount, 3),
      maxProgress: 3,
      reward: { fp: 200 },
      completed: friendCount >= 3,
      claimed: claimedMissions.has("weekly-4"),
      expiresIn: "6d 23h",
    },
    {
      id: "special-1",
      name: "Lançamento Especial",
      description: "Comemore o lançamento coletando 50 cartas!",
      type: "special",
      category: "collection",
      icon: <Flame className="w-5 h-5" />,
      progress: Math.min(totalCards, 50),
      maxProgress: 50,
      reward: { coins: 1000, fp: 500 },
      completed: totalCards >= 50,
      claimed: claimedMissions.has("special-1"),
      expiresIn: "29d 23h",
    },
    {
      id: "special-2",
      name: "Veterano de Guerra",
      description: "Complete 25 batalhas",
      type: "special",
      category: "battle",
      icon: <Target className="w-5 h-5" />,
      progress: Math.min(totalMatches, 25),
      maxProgress: 25,
      reward: { coins: 800, fp: 300, item: "Pack Especial" },
      completed: totalMatches >= 25,
      claimed: claimedMissions.has("special-2"),
      expiresIn: "29d 23h",
    },
    {
      id: "special-3",
      name: "Amizade Verdadeira",
      description: "Alcance nível 5 de afinidade com um amigo",
      type: "special",
      category: "social",
      icon: <Star className="w-5 h-5" />,
      progress: 0,
      maxProgress: 1,
      reward: { coins: 500, fp: 500 },
      completed: false,
      claimed: claimedMissions.has("special-3"),
      expiresIn: "29d 23h",
    },
  ], [progressMap, wins, totalCards, totalMatches, friendCount, claimedMissions])

  const filteredMissions = allMissions.filter((m) => m.type === activeTab)

  const dailyTotal = allMissions.filter((m) => m.type === "daily").length
  const dailyCompleted = allMissions.filter((m) => m.type === "daily" && m.completed).length
  const weeklyTotal = allMissions.filter((m) => m.type === "weekly").length
  const weeklyCompleted = allMissions.filter((m) => m.type === "weekly" && m.completed).length
  const specialTotal = allMissions.filter((m) => m.type === "special").length
  const specialCompleted = allMissions.filter((m) => m.type === "special" && m.completed).length

  const handleClaimReward = (missionId: string) => {
    if (claimedMissions.has(missionId) || claimingId === missionId) return
    const mission = allMissions.find((m) => m.id === missionId)
    if (!mission || !mission.completed) return

    setClaimingId(missionId)
    setTimeout(() => {
      if (mission.reward.coins) {
        setCoins((prev: number) => prev + mission.reward.coins!)
      }
      setClaimedMissions((prev) => {
        const next = new Set([...prev, missionId])
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
        } catch {}
        return next
      })
      setClaimingId(null)
    }, 800)
  }

  const tabs = [
    { id: "daily" as const, label: "Diárias", short: "D", completed: dailyCompleted, total: dailyTotal, color: "sky", timer: "23:45:30", icon: <Clock className="w-3.5 h-3.5" /> },
    { id: "weekly" as const, label: "Semanais", short: "W", completed: weeklyCompleted, total: weeklyTotal, color: "violet", timer: "6d 23h", icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: "special" as const, label: "Especiais", short: "S", completed: specialCompleted, total: specialTotal, color: "amber", timer: "29d 23h", icon: <Flame className="w-3.5 h-3.5" /> },
  ]

  const categoryMeta: Record<string, { label: string; gradient: string; iconColor: string; bg: string; border: string }> = {
    gacha:      { label: "Gacha",    gradient: "from-violet-500 to-purple-600",  iconColor: "text-violet-300", bg: "bg-violet-500/10",  border: "border-violet-500/30" },
    battle:     { label: "Batalha",  gradient: "from-rose-500 to-red-600",       iconColor: "text-rose-300",   bg: "bg-rose-500/10",    border: "border-rose-500/30"   },
    collection: { label: "Coleção",  gradient: "from-amber-400 to-orange-500",   iconColor: "text-amber-300",  bg: "bg-amber-500/10",   border: "border-amber-500/30"  },
    social:     { label: "Social",   gradient: "from-pink-500 to-fuchsia-600",   iconColor: "text-pink-300",   bg: "bg-pink-500/10",    border: "border-pink-500/30"   },
    general:    { label: "Geral",    gradient: "from-sky-400 to-cyan-500",       iconColor: "text-sky-300",    bg: "bg-sky-500/10",     border: "border-sky-500/30"    },
  }

  const tabAccent: Record<string, { ring: string; glow: string; progressFrom: string; progressTo: string; activeBg: string; activeBorder: string; tabText: string }> = {
    daily:   { ring: "ring-sky-500/40",   glow: "shadow-sky-500/20",   progressFrom: "from-sky-400",   progressTo: "to-cyan-400",   activeBg: "bg-sky-500/10",   activeBorder: "border-sky-400/50",   tabText: "text-sky-300"   },
    weekly:  { ring: "ring-violet-500/40", glow: "shadow-violet-500/20", progressFrom: "from-violet-500", progressTo: "to-purple-400", activeBg: "bg-violet-500/10", activeBorder: "border-violet-400/50", tabText: "text-violet-300" },
    special: { ring: "ring-amber-500/40", glow: "shadow-amber-500/20", progressFrom: "from-amber-400", progressTo: "to-orange-400", activeBg: "bg-amber-500/10",  activeBorder: "border-amber-400/50",  tabText: "text-amber-300"  },
  }

  const active = tabAccent[activeTab]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@400;600;700;800&display=swap');

        .missions-root { font-family: 'Nunito', sans-serif; }
        .font-display { font-family: 'Cinzel', serif; }

        @keyframes floatUp {
          0%   { transform: translateY(0px) scale(1);   opacity: 0.5; }
          50%  { transform: translateY(-18px) scale(1.1); opacity: 1; }
          100% { transform: translateY(0px) scale(1);   opacity: 0.5; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0); }
          50%       { box-shadow: 0 0 0 6px rgba(34,211,238,0.12); }
        }
        @keyframes claimPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.13); }
          70%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes badgePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.06); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes headerShine {
          0%   { background-position: -300% center; }
          100% { background-position:  300% center; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .particle { animation: floatUp var(--dur, 5s) var(--delay, 0s) ease-in-out infinite; }
        .shimmer-text {
          background: linear-gradient(90deg, #f59e0b 0%, #fde68a 40%, #fb923c 60%, #f59e0b 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
        .title-shine {
          background: linear-gradient(90deg, #38bdf8, #818cf8, #e879f9, #38bdf8);
          background-size: 300% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: headerShine 4s linear infinite;
        }
        .mission-card { animation: slideIn 0.35s ease both; }
        .claim-pop { animation: claimPop 0.4s ease; }
        .badge-pulse { animation: badgePulse 2s ease infinite; }
        .spin { animation: spin 0.8s linear infinite; }
        .tab-btn { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
        .progress-fill { transition: width 0.7s cubic-bezier(0.4,0,0.2,1); }
        .mission-card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .mission-card-hover:hover { transform: translateY(-2px); }
        .progress-track { position: relative; overflow: hidden; }
        .progress-track::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 2s linear infinite;
        }
        .glass-card {
          background: rgba(15, 20, 40, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .glass-header {
          background: rgba(8, 12, 28, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .separator-glow::before {
          content: '';
          position: absolute; left: 0; right: 0; top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(56,189,248,0.4), transparent);
        }
        .dot-grid {
          background-image: radial-gradient(circle at 1px 1px, rgba(99,102,241,0.18) 1px, transparent 0);
          background-size: 28px 28px;
        }
        .reward-pill {
          display: flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 9999px;
          font-size: 11px; font-weight: 700;
        }
        .icon-ring {
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          width: 48px; height: 48px; flex-shrink: 0;
          position: relative;
        }
        .icon-ring::after {
          content: '';
          position: absolute; inset: -1px;
          border-radius: 15px;
          background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent 60%);
          pointer-events: none;
        }
      `}</style>

      <div className="missions-root min-h-screen flex flex-col relative overflow-hidden bg-[#060B18]">

        {/* ── Background layers ─────────────────────────────────────────── */}
        <div className="fixed inset-0 pointer-events-none">
          {/* Base radial */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(56,189,248,0.07),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_100%,rgba(139,92,246,0.06),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_10%_80%,rgba(244,114,182,0.04),transparent)]" />
          {/* Dot grid */}
          <div className="absolute inset-0 dot-grid opacity-60" />
          {/* Horizontal light bands */}
          <div className="absolute top-[18%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/10 to-transparent" />
          <div className="absolute top-[55%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/8 to-transparent" />
        </div>

        {/* ── Floating particles ─────────────────────────────────────────── */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
          {[...Array(14)].map((_, i) => (
            <div
              key={i}
              className="particle absolute rounded-full"
              style={{
                left: `${(i * 7 + 3) % 100}%`,
                top: `${(i * 11 + 5) % 100}%`,
                width: i % 3 === 0 ? "3px" : "2px",
                height: i % 3 === 0 ? "3px" : "2px",
                background: ["rgba(56,189,248,0.45)", "rgba(139,92,246,0.45)", "rgba(244,114,182,0.35)"][i % 3],
                "--dur": `${4 + (i % 4)}s`,
                "--delay": `${(i * 0.35).toFixed(1)}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            HEADER
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 glass-header border-b border-white/[0.06] separator-glow">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Back button */}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-slate-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.12] transition-all text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            {/* Title */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400/20 to-violet-500/20 border border-sky-400/30 flex items-center justify-center">
                  <Target className="w-4.5 h-4.5 text-sky-400" />
                </div>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#060B18] badge-pulse" />
              </div>
              <h1 className="font-display text-xl tracking-widest title-shine">MISSÕES</h1>
            </div>

            {/* Coins */}
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-xl">
              <Image src="/images/icons/gacha-coin.png" alt="Coin" width={20} height={20} className="w-5 h-5" />
              <span className="font-bold text-amber-300 text-sm">{coins.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB SWITCHER
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 px-4 pt-4 pb-0">
          <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              const pct = Math.round((tab.completed / tab.total) * 100)
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-btn flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-center relative overflow-hidden
                    ${isActive
                      ? `${tabAccent[tab.id].activeBg} ${tabAccent[tab.id].activeBorder} shadow-lg ${tabAccent[tab.id].glow}`
                      : "bg-transparent border-transparent hover:bg-white/[0.04]"
                    }`}
                >
                  {isActive && (
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{ background: `linear-gradient(135deg, var(--tw-gradient-from), transparent)` }}
                    />
                  )}
                  <div className={`flex items-center gap-1.5 ${isActive ? tabAccent[tab.id].tabText : "text-slate-500"}`}>
                    {tab.icon}
                    <span className="font-bold text-xs tracking-wide uppercase">{tab.label}</span>
                  </div>
                  <div className={`text-lg font-bold leading-none ${isActive ? "text-white" : "text-slate-400"}`}>
                    {tab.completed}<span className={`text-xs font-normal ml-0.5 ${isActive ? "text-slate-400" : "text-slate-600"}`}>/{tab.total}</span>
                  </div>
                  {/* Mini progress bar inside tab */}
                  <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${
                        tab.id === "daily"   ? "from-sky-400 to-cyan-300" :
                        tab.id === "weekly"  ? "from-violet-500 to-purple-400" :
                        "from-amber-400 to-orange-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Timer strip ───────────────────────────────────────────────── */}
        <div className="relative z-10 px-4 pt-2.5 pb-1">
          {tabs.filter((t) => t.id === activeTab).map((tab) => (
            <div key={tab.id} className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${tabAccent[activeTab].tabText} opacity-70`}>
                <RefreshCw className="w-3 h-3" />
                {tab.id === "special" ? "Evento termina em:" : "Reinicia em:"}&nbsp;
                <span className="font-bold opacity-100">{tab.timer}</span>
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold ${tabAccent[activeTab].tabText} opacity-60`}>
                <Trophy className="w-3 h-3" />
                {tab.completed === tab.total ? "Todas completas! 🎉" : `${tab.total - tab.completed} restantes`}
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MISSION LIST
        ══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto relative z-10 px-4 pt-3 pb-6">
          <div className="flex flex-col gap-3">
            {filteredMissions.map((mission, idx) => {
              const isClaimed     = claimedMissions.has(mission.id)
              const canClaim      = mission.completed && !isClaimed
              const isClaiming    = claimingId === mission.id
              const pct           = Math.min(100, (mission.progress / mission.maxProgress) * 100)
              const cat           = categoryMeta[mission.category]

              return (
                <div
                  key={mission.id}
                  className={`mission-card mission-card-hover glass-card rounded-2xl border overflow-hidden shadow-xl
                    ${isClaimed
                      ? "border-white/[0.06] opacity-60"
                      : mission.completed
                        ? `border-emerald-500/35 shadow-emerald-500/10 ${active.ring} ring-1`
                        : "border-white/[0.07] hover:border-white/[0.12]"
                    }`}
                  style={{ animationDelay: `${idx * 0.06}s` }}
                >
                  {/* Top accent stripe */}
                  <div className={`h-[3px] w-full bg-gradient-to-r ${
                    isClaimed     ? "from-slate-600/50 via-slate-500/30 to-slate-600/50" :
                    mission.completed ? "from-emerald-500 via-teal-400 to-emerald-500" :
                    `${active.progressFrom.replace("from-", "from-")} ${active.progressTo.replace("to-", "to-")}`
                  }`} />

                  <div className="p-4">
                    {/* ── Row 1: icon + info + claim ───────────────────── */}
                    <div className="flex items-start gap-3">
                      {/* Category icon */}
                      <div className={`icon-ring ${cat.bg} border ${cat.border} shrink-0`}>
                        <span className={cat.iconColor}>{mission.icon}</span>
                      </div>

                      {/* Text block */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        {/* Name + badge */}
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-sm font-bold leading-tight ${isClaimed ? "text-slate-500" : "text-white"}`}>
                            {mission.name}
                          </span>
                          {mission.completed && !isClaimed && (
                            <span className="badge-pulse inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                              Completo
                            </span>
                          )}
                          {isClaimed && (
                            <span className="inline-flex items-center gap-1 bg-slate-600/20 border border-slate-600/30 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <Check className="w-2.5 h-2.5" />
                              Resgatado
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-slate-500 text-xs leading-relaxed mb-2">{mission.description}</p>

                        {/* Rewards row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-600 text-[10px] uppercase tracking-widest font-semibold mr-0.5">Prêmio</span>
                          {mission.reward.coins && (
                            <div className="reward-pill bg-amber-500/10 border border-amber-500/25 text-amber-300">
                              <Image src="/images/icons/gacha-coin.png" alt="Coin" width={12} height={12} className="w-3 h-3" />
                              {mission.reward.coins}
                            </div>
                          )}
                          {mission.reward.fp && (
                            <div className="reward-pill bg-pink-500/10 border border-pink-500/25 text-pink-300">
                              <Star className="w-2.5 h-2.5" />
                              {mission.reward.fp} FP
                            </div>
                          )}
                          {mission.reward.item && (
                            <div className="reward-pill bg-violet-500/10 border border-violet-500/25 text-violet-300">
                              <Gift className="w-2.5 h-2.5" />
                              {mission.reward.item}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Claim button */}
                      <div className="shrink-0 pt-0.5">
                        <button
                          onClick={() => handleClaimReward(mission.id)}
                          disabled={!canClaim || isClaiming}
                          className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all font-bold text-sm border
                            ${isClaiming ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" :
                              canClaim
                                ? "bg-gradient-to-br from-emerald-500 to-teal-500 border-emerald-400/50 text-white shadow-lg shadow-emerald-500/30 hover:scale-105 hover:shadow-emerald-500/50 active:scale-95 claim-pop"
                                : isClaimed
                                  ? "bg-slate-700/40 border-slate-600/30 text-slate-500 cursor-not-allowed"
                                  : "bg-slate-800/50 border-slate-700/40 text-slate-600 cursor-not-allowed"
                            }`}
                        >
                          {isClaiming   ? <div className="w-4 h-4 rounded-full border-2 border-emerald-400/40 border-t-emerald-400 spin" /> :
                           isClaimed    ? <Check className="w-4 h-4" /> :
                           canClaim     ? <Gift className="w-4 h-4" /> :
                                          <Lock className="w-4 h-4" />}
                          {/* Glow dot for claimable */}
                          {canClaim && !isClaiming && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#060B18] badge-pulse" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ── Row 2: progress bar ───────────────────────────── */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-white/[0.05] rounded-full progress-track">
                        <div
                          className={`h-full rounded-full progress-fill bg-gradient-to-r
                            ${isClaimed
                              ? "from-slate-600 to-slate-500"
                              : mission.completed
                                ? "from-emerald-500 to-teal-400"
                                : `${active.progressFrom} ${active.progressTo}`
                            }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold shrink-0 tabular-nums ${
                        isClaimed ? "text-slate-600" :
                        mission.completed ? "text-emerald-400" :
                        tabAccent[activeTab].tabText
                      }`}>
                        {mission.progress}
                        <span className="text-slate-600 font-normal">/{mission.maxProgress}</span>
                      </span>
                    </div>

                    {/* ── Row 3: timer ──────────────────────────────────── */}
                    {mission.expiresIn && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-600 font-semibold">
                        <Clock className="w-3 h-3" />
                        <span>Expira em <span className="text-slate-500">{mission.expiresIn}</span></span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              ALL-COMPLETE BONUS CARD
          ══════════════════════════════════════════════════════════════ */}
          <div className="mt-4">
            <div className="relative rounded-2xl overflow-hidden border border-amber-500/25">
              {/* background */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-950/60 via-orange-950/50 to-amber-950/60" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(251,191,36,0.08),transparent)]" />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

              <div className="relative p-4 flex items-center gap-4">
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
                  <Zap className="w-7 h-7 text-amber-400" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm mb-0.5">Bônus de Conclusão</div>
                  <div className="text-slate-400 text-xs leading-relaxed">
                    Complete todas as missões {activeTab === "daily" ? "diárias" : activeTab === "weekly" ? "semanais" : "especiais"} e ganhe um bônus extra!
                  </div>
                </div>

                {/* Bonus reward */}
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div className={`text-xl font-bold leading-none ${
                    (activeTab === "daily" ? dailyCompleted === dailyTotal :
                     activeTab === "weekly" ? weeklyCompleted === weeklyTotal :
                     specialCompleted === specialTotal)
                      ? "shimmer-text"
                      : "text-amber-400/60"
                  }`}>
                    +{activeTab === "daily" ? "200" : activeTab === "weekly" ? "1.000" : "2.000"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Image src="/images/icons/gacha-coin.png" alt="Coin" width={14} height={14} className="w-3.5 h-3.5" />
                    <span className="text-amber-500/70 text-[10px] font-bold uppercase tracking-wide">coins</span>
                  </div>
                  {/* Mini progress pills */}
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: activeTab === "daily" ? dailyTotal : activeTab === "weekly" ? weeklyTotal : specialTotal }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          i < (activeTab === "daily" ? dailyCompleted : activeTab === "weekly" ? weeklyCompleted : specialCompleted)
                            ? "bg-amber-400"
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
