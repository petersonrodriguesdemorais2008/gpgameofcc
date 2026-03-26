"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
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
} from "lucide-react"
import Image from "next/image"

interface MissionsScreenProps {
  onBack: () => void
}

interface MissionDefinition {
  id: string
  name: string
  description: string
  type: "daily" | "weekly" | "special"
  category: "gacha" | "battle" | "collection" | "social" | "general"
  iconName: string
  maxProgress: number
  reward: {
    coins?: number
    fp?: number
    item?: string
  }
  expiresIn?: string
}

// ─── Stable mission definitions (no random, no JSX here) ─────────────────────
const MISSION_DEFINITIONS: MissionDefinition[] = [
  // Daily
  {
    id: "daily-1",
    name: "Abertura Diária",
    description: "Abra 3 packs no gacha hoje",
    type: "daily",
    category: "gacha",
    iconName: "sparkles",
    maxProgress: 3,
    reward: { coins: 100 },
    expiresIn: "23:45:30",
  },
  {
    id: "daily-2",
    name: "Duelista Nato",
    description: "Vença 2 partidas",
    type: "daily",
    category: "battle",
    iconName: "swords",
    maxProgress: 2,
    reward: { coins: 150, fp: 20 },
    expiresIn: "23:45:30",
  },
  {
    id: "daily-3",
    name: "Login Diário",
    description: "Faça login no jogo",
    type: "daily",
    category: "general",
    iconName: "calendar",
    maxProgress: 1,
    reward: { coins: 50 },
    expiresIn: "23:45:30",
  },
  {
    id: "daily-4",
    name: "Colecionador Ativo",
    description: "Adicione 5 cartas à coleção",
    type: "daily",
    category: "collection",
    iconName: "bookOpen",
    maxProgress: 5,
    reward: { coins: 100, fp: 10 },
    expiresIn: "23:45:30",
  },
  {
    id: "daily-5",
    name: "Amigo do Dia",
    description: "Envie um coração para um amigo",
    type: "daily",
    category: "social",
    iconName: "users",
    maxProgress: 1,
    reward: { fp: 30 },
    expiresIn: "23:45:30",
  },
  // Weekly
  {
    id: "weekly-1",
    name: "Mestre Gacha",
    description: "Abra 30 packs esta semana",
    type: "weekly",
    category: "gacha",
    iconName: "sparkles",
    maxProgress: 30,
    reward: { coins: 500, fp: 100 },
    expiresIn: "6d 23h",
  },
  {
    id: "weekly-2",
    name: "Guerreiro da Semana",
    description: "Vença 10 partidas",
    type: "weekly",
    category: "battle",
    iconName: "swords",
    maxProgress: 10,
    reward: { coins: 700, fp: 150 },
    expiresIn: "6d 23h",
  },
  {
    id: "weekly-3",
    name: "Coleção Crescente",
    description: "Colete 20 cartas novas",
    type: "weekly",
    category: "collection",
    iconName: "bookOpen",
    maxProgress: 20,
    reward: { coins: 400 },
    expiresIn: "6d 23h",
  },
  {
    id: "weekly-4",
    name: "Rede Social",
    description: "Adicione 3 novos amigos",
    type: "weekly",
    category: "social",
    iconName: "users",
    maxProgress: 3,
    reward: { fp: 200 },
    expiresIn: "6d 23h",
  },
  // Special
  {
    id: "special-1",
    name: "Lançamento Especial",
    description: "Comemore o lançamento coletando 50 cartas!",
    type: "special",
    category: "collection",
    iconName: "flame",
    maxProgress: 50,
    reward: { coins: 1000, fp: 500 },
    expiresIn: "29d 23h",
  },
  {
    id: "special-2",
    name: "Veterano de Guerra",
    description: "Complete 25 batalhas",
    type: "special",
    category: "battle",
    iconName: "target",
    maxProgress: 25,
    reward: { coins: 800, fp: 300, item: "Pack Especial" },
    expiresIn: "29d 23h",
  },
  {
    id: "special-3",
    name: "Amizade Verdadeira",
    description: "Alcance nível 5 de afinidade com um amigo",
    type: "special",
    category: "social",
    iconName: "star",
    maxProgress: 1,
    reward: { coins: 500, fp: 500 },
    expiresIn: "29d 23h",
  },
]

// ─── Icon resolver ────────────────────────────────────────────────────────────
function MissionIcon({
  name,
  category,
}: {
  name: string
  category: string
}) {
  const colorMap: Record<string, string> = {
    gacha: "text-purple-400",
    battle: "text-red-400",
    collection: "text-amber-400",
    social: "text-pink-400",
    general: "text-cyan-400",
  }
  const cls = `w-5 h-5 ${colorMap[category] ?? "text-cyan-400"}`
  switch (name) {
    case "sparkles": return <Sparkles className={cls} />
    case "swords":   return <Swords className={cls} />
    case "calendar": return <Calendar className={cls} />
    case "bookOpen": return <BookOpen className={cls} />
    case "users":    return <Users className={cls} />
    case "flame":    return <Flame className={cls} />
    case "target":   return <Target className={cls} />
    case "star":     return <Star className={cls} />
    default:         return <Sparkles className={cls} />
  }
}

// ─── Persistence key ──────────────────────────────────────────────────────────
const STORAGE_KEY = "missions_claimed_v1"

export default function MissionsScreen({ onBack }: MissionsScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, collection, matchHistory, friends } = useGame()

  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "special">("daily")
  const [claimingId, setClaimingId] = useState<string | null>(null)

  // ── FIX 1: Persist claimed missions in localStorage ──────────────────────
  const [claimedMissions, setClaimedMissions] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>()
    } catch {
      return new Set<string>()
    }
  })

  // Sync to localStorage whenever claimedMissions changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...claimedMissions]))
    } catch {
      // storage unavailable – silent fail
    }
  }, [claimedMissions])

  // ── Stable game stats ─────────────────────────────────────────────────────
  const totalCards   = collection.length
  const wins         = useMemo(() => matchHistory.filter(m => m.result === "won").length, [matchHistory])
  const totalMatches = matchHistory.length
  const friendCount  = friends.length

  // ── FIX 2: Derive progress from stable game data (no Math.random here) ───
  const progressMap = useMemo<Record<string, number>>(() => ({
    "daily-1":   0,           // tracked externally (gacha opens today)
    "daily-2":   Math.min(wins, 2),
    "daily-3":   1,           // always complete on login
    "daily-4":   Math.min(totalCards % 5, 5),
    "daily-5":   0,
    "weekly-1":  Math.min(totalCards, 30),
    "weekly-2":  Math.min(wins, 10),
    "weekly-3":  Math.min(totalCards, 20),
    "weekly-4":  Math.min(friendCount, 3),
    "special-1": Math.min(totalCards, 50),
    "special-2": Math.min(totalMatches, 25),
    "special-3": 0,
  }), [totalCards, wins, totalMatches, friendCount])

  // ── Composed mission list ─────────────────────────────────────────────────
  const allMissions = useMemo(() =>
    MISSION_DEFINITIONS.map(def => {
      const progress = progressMap[def.id] ?? 0
      const completed = progress >= def.maxProgress
      const claimed   = claimedMissions.has(def.id)
      return { ...def, progress, completed, claimed }
    }),
  [progressMap, claimedMissions])

  const filteredMissions = useMemo(
    () => allMissions.filter(m => m.type === activeTab),
    [allMissions, activeTab]
  )

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const byType = (type: string) => allMissions.filter(m => m.type === type)
    return {
      daily:   { total: byType("daily").length,   completed: byType("daily").filter(m => m.completed).length },
      weekly:  { total: byType("weekly").length,  completed: byType("weekly").filter(m => m.completed).length },
      special: { total: byType("special").length, completed: byType("special").filter(m => m.completed).length },
    }
  }, [allMissions])

  // ── FIX 3: Claim handler with authoritative Set guard ────────────────────
  const handleClaimReward = useCallback((missionId: string) => {
    // Guard: check the Set directly — not the stale mission snapshot
    if (claimingId !== null) return
    if (claimedMissions.has(missionId)) return

    const mission = allMissions.find(m => m.id === missionId)
    if (!mission || !mission.completed) return

    setClaimingId(missionId)

    setTimeout(() => {
      // Apply reward
      if (mission.reward.coins) {
        setCoins((prev: number) => prev + mission.reward.coins!)
      }

      // ── FIX: Mark claimed BEFORE clearing claimingId ─────────────────────
      setClaimedMissions(prev => {
        const next = new Set(prev)
        next.add(missionId)
        return next
      })

      setClaimingId(null)
    }, 900)
  }, [claimingId, claimedMissions, allMissions, setCoins])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const categoryBg: Record<string, string> = {
    gacha:      "bg-purple-500/15 border-purple-500/30",
    battle:     "bg-red-500/15 border-red-500/30",
    collection: "bg-amber-500/15 border-amber-500/30",
    social:     "bg-pink-500/15 border-pink-500/30",
    general:    "bg-cyan-500/15 border-cyan-500/30",
  }

  const tabConfig = {
    daily:   { label: "Diárias",  color: "cyan",   bonus: 200 },
    weekly:  { label: "Semanais", color: "violet",  bonus: 1000 },
    special: { label: "Especiais",color: "amber",  bonus: 2000 },
  }

  const activeStats = stats[activeTab]

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#070b14]">
      {/* ── Layered background ───────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        {/* base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#070b14] via-[#0c1628] to-[#070b14]" />
        {/* ambient blobs */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-violet-600/6 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-blue-900/8 blur-[80px]" />
        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(6,182,212,0.7) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* diagonal lines */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, rgba(148,163,184,0.5) 0px, rgba(148,163,184,0.5) 1px, transparent 0px, transparent 50%)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      {/* ── Floating orbs ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-pulse"
            style={{
              width: `${4 + (i % 3) * 3}px`,
              height: `${4 + (i % 3) * 3}px`,
              background: i % 3 === 0 ? "rgba(6,182,212,0.25)" : i % 3 === 1 ? "rgba(139,92,246,0.2)" : "rgba(251,191,36,0.2)",
              left: `${(i * 13 + 5) % 100}%`,
              top: `${(i * 17 + 10) % 100}%`,
              animationDelay: `${i * 0.6}s`,
              animationDuration: `${4 + i * 0.5}s`,
              filter: "blur(1px)",
            }}
          />
        ))}
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="relative z-10 border-b border-white/5 bg-white/[0.02] backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-xl gap-1.5 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{t("back")}</span>
          </Button>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/30 to-violet-600/30 border border-cyan-500/40 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <h1 className="text-xl font-black tracking-widest bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent uppercase">
              Missões
            </h1>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-xl">
            <Image src="/images/icons/gacha-coin.png" alt="Coin" width={18} height={18} className="w-[18px] h-[18px]" />
            <span className="font-bold text-amber-300 text-sm">{coins.toLocaleString()}</span>
          </div>
        </div>
      </header>

      {/* ── Tab selector ──────────────────────────────────────────────────── */}
      <div className="relative z-10 px-4 pt-4 pb-2">
        <div className="grid grid-cols-3 gap-2">
          {(["daily", "weekly", "special"] as const).map(tab => {
            const cfg = tabConfig[tab]
            const s   = stats[tab]
            const pct = s.total > 0 ? (s.completed / s.total) * 100 : 0
            const isActive = activeTab === tab

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  relative rounded-2xl p-3 border transition-all duration-300 text-left overflow-hidden
                  ${isActive
                    ? tab === "daily"
                      ? "bg-cyan-500/12 border-cyan-400/40 shadow-lg shadow-cyan-500/10"
                      : tab === "weekly"
                      ? "bg-violet-500/12 border-violet-400/40 shadow-lg shadow-violet-500/10"
                      : "bg-amber-500/12 border-amber-400/40 shadow-lg shadow-amber-500/10"
                    : "bg-white/[0.02] border-white/6 hover:border-white/12 hover:bg-white/[0.04]"
                  }
                `}
              >
                {/* Glow strip on active */}
                {isActive && (
                  <div className={`absolute top-0 left-0 right-0 h-px ${
                    tab === "daily" ? "bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
                    : tab === "weekly" ? "bg-gradient-to-r from-transparent via-violet-400/60 to-transparent"
                    : "bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
                  }`} />
                )}

                <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${
                  isActive
                    ? tab === "daily" ? "text-cyan-400" : tab === "weekly" ? "text-violet-400" : "text-amber-400"
                    : "text-slate-500"
                }`}>
                  {cfg.label}
                </div>

                <div className="flex items-baseline gap-0.5 mb-2">
                  <span className={`text-xl font-black ${isActive ? "text-white" : "text-slate-400"}`}>
                    {s.completed}
                  </span>
                  <span className="text-slate-600 text-sm font-medium">/{s.total}</span>
                </div>

                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isActive
                        ? tab === "daily" ? "bg-gradient-to-r from-cyan-500 to-cyan-300"
                          : tab === "weekly" ? "bg-gradient-to-r from-violet-500 to-violet-300"
                          : "bg-gradient-to-r from-amber-500 to-amber-300"
                        : "bg-slate-700"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Timer strip ───────────────────────────────────────────────────── */}
      <div className="relative z-10 px-4 py-2">
        <div className="flex items-center justify-between bg-white/[0.025] border border-white/5 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {activeTab === "daily"   && "Reinicia em: 23:45:30"}
              {activeTab === "weekly"  && "Reinicia em: 6d 23h"}
              {activeTab === "special" && "Evento termina em: 29d 23h"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-600">Completas:</span>
            <span className={`font-bold ${
              activeTab === "daily" ? "text-cyan-400"
              : activeTab === "weekly" ? "text-violet-400"
              : "text-amber-400"
            }`}>
              {activeStats.completed}/{activeStats.total}
            </span>
          </div>
        </div>
      </div>

      {/* ── Mission List ──────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto relative z-10 space-y-2.5">
        {filteredMissions.map((mission) => {
          // ── Single authoritative claim check ──────────────────────────
          const isClaimed   = claimedMissions.has(mission.id)
          const isClaiming  = claimingId === mission.id
          const canClaim    = mission.completed && !isClaimed && !isClaiming
          const progressPct = Math.min((mission.progress / mission.maxProgress) * 100, 100)

          const accentColor =
            mission.type === "daily"   ? "cyan"
            : mission.type === "weekly" ? "violet"
            : "amber"

          return (
            <div
              key={mission.id}
              className={`
                relative rounded-2xl overflow-hidden border transition-all duration-300
                ${isClaimed
                  ? "bg-white/[0.015] border-white/5 opacity-60"
                  : mission.completed
                  ? "bg-emerald-500/6 border-emerald-500/25 shadow-lg shadow-emerald-500/8"
                  : "bg-white/[0.025] border-white/7 hover:border-white/12 hover:bg-white/[0.035]"
                }
              `}
            >
              {/* Top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-px ${
                isClaimed ? "bg-slate-700/50"
                : mission.completed
                  ? "bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent"
                  : accentColor === "cyan"
                    ? "bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"
                    : accentColor === "violet"
                    ? "bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"
                    : "bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"
              }`} />

              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* ── Icon ──────────────────────────────────────────── */}
                  <div className={`
                    w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 mt-0.5
                    ${categoryBg[mission.category] ?? "bg-cyan-500/15 border-cyan-500/30"}
                  `}>
                    <MissionIcon name={mission.iconName} category={mission.category} />
                  </div>

                  {/* ── Body ──────────────────────────────────────────── */}
                  <div className="flex-1 min-w-0">
                    {/* Name + badges */}
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`font-bold text-sm ${isClaimed ? "text-slate-500" : "text-white"}`}>
                        {mission.name}
                      </span>
                      {mission.completed && !isClaimed && (
                        <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse tracking-wide">
                          COMPLETA
                        </span>
                      )}
                      {isClaimed && (
                        <span className="bg-slate-700/60 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full tracking-wide flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> RESGATADA
                        </span>
                      )}
                    </div>

                    <p className={`text-xs mb-2.5 leading-relaxed ${isClaimed ? "text-slate-600" : "text-slate-400"}`}>
                      {mission.description}
                    </p>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isClaimed
                              ? "bg-slate-700"
                              : mission.completed
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                              : accentColor === "cyan"
                              ? "bg-gradient-to-r from-cyan-600 to-cyan-400"
                              : accentColor === "violet"
                              ? "bg-gradient-to-r from-violet-600 to-violet-400"
                              : "bg-gradient-to-r from-amber-600 to-amber-400"
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-mono font-bold shrink-0 ${
                        isClaimed ? "text-slate-600"
                        : mission.completed ? "text-emerald-400"
                        : "text-slate-400"
                      }`}>
                        {mission.progress}/{mission.maxProgress}
                      </span>
                    </div>

                    {/* Rewards */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-600 text-[10px] uppercase tracking-wider font-semibold">
                        Recompensa:
                      </span>
                      {mission.reward.coins && (
                        <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-lg">
                          <Image src="/images/icons/gacha-coin.png" alt="Coin" width={12} height={12} className="w-3 h-3" />
                          <span className="text-amber-400 text-[11px] font-bold">{mission.reward.coins}</span>
                        </div>
                      )}
                      {mission.reward.fp && (
                        <div className="flex items-center gap-1 bg-pink-500/10 border border-pink-500/20 px-1.5 py-0.5 rounded-lg">
                          <Star className="w-2.5 h-2.5 text-pink-400" />
                          <span className="text-pink-400 text-[11px] font-bold">{mission.reward.fp} FP</span>
                        </div>
                      )}
                      {mission.reward.item && (
                        <div className="flex items-center gap-1 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-lg">
                          <Gift className="w-2.5 h-2.5 text-violet-400" />
                          <span className="text-violet-400 text-[11px] font-bold">{mission.reward.item}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Claim button ───────────────────────────────────── */}
                  <div className="shrink-0 flex flex-col items-center gap-1 ml-1">
                    <Button
                      onClick={() => handleClaimReward(mission.id)}
                      disabled={!canClaim}
                      size="sm"
                      className={`
                        w-10 h-10 rounded-xl p-0 transition-all duration-200 border
                        ${isClaimed
                          ? "bg-slate-800/60 border-slate-700/50 text-slate-600 cursor-default"
                          : canClaim
                          ? "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 border-emerald-400/40 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-105 active:scale-95"
                          : "bg-slate-800/40 border-slate-700/30 text-slate-600 cursor-default"
                        }
                      `}
                    >
                      {isClaiming ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : isClaimed ? (
                        <Check className="w-4 h-4" />
                      ) : canClaim ? (
                        <Gift className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Timer footer */}
                {mission.expiresIn && !isClaimed && (
                  <div className="mt-3 pt-2.5 border-t border-white/4 flex items-center gap-1.5">
                    <Clock className={`w-3 h-3 ${
                      accentColor === "cyan" ? "text-cyan-600"
                      : accentColor === "violet" ? "text-violet-600"
                      : "text-amber-600"
                    }`} />
                    <span className="text-slate-600 text-[10px] font-medium">
                      Expira em: <span className="text-slate-500">{mission.expiresIn}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* ── Completion Bonus Banner ──────────────────────────────────────── */}
        <div className="mt-2 relative rounded-2xl overflow-hidden border border-amber-500/20">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-950/60 via-orange-950/60 to-amber-950/60" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: "repeating-linear-gradient(-45deg, rgba(251,191,36,0.5) 0px, rgba(251,191,36,0.5) 1px, transparent 0px, transparent 8px)",
            }}
          />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          <div className="relative flex items-center gap-3 p-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/25 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm mb-0.5">Bônus de Conclusão</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Complete todas as missões{" "}
                {activeTab === "daily" ? "diárias" : activeTab === "weekly" ? "semanais" : "especiais"}{" "}
                para receber um bônus extra!
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-amber-400 font-black text-lg leading-none">
                {activeStats.completed}/{activeStats.total}
              </div>
              <div className="flex items-center gap-1 justify-end mt-1">
                <Image src="/images/icons/gacha-coin.png" alt="Coin" width={12} height={12} className="w-3 h-3" />
                <span className="text-amber-400 text-xs font-bold">
                  +{tabConfig[activeTab].bonus.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
