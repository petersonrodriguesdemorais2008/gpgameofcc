"use client"

import { useState, useEffect } from "react"
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
  RefreshCw
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

export default function MissionsScreen({ onBack }: MissionsScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, collection, matchHistory, friends } = useGame()
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "special">("daily")
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimedMissions, setClaimedMissions] = useState<Set<string>>(new Set())

  // Calculate real progress from game data
  const totalCards = collection.length
  const wins = matchHistory.filter(m => m.result === "won").length
  const totalMatches = matchHistory.length
  const friendCount = friends.length

  // Mock missions with real progress
  const allMissions: Mission[] = [
    // Daily Missions
    {
      id: "daily-1",
      name: "Abertura Diaria",
      description: "Abra 3 packs no gacha hoje",
      type: "daily",
      category: "gacha",
      icon: <Sparkles className="w-6 h-6 text-purple-400" />,
      progress: Math.min(3, Math.floor(Math.random() * 4)),
      maxProgress: 3,
      reward: { coins: 100 },
      completed: false,
      claimed: claimedMissions.has("daily-1"),
      expiresIn: "23:45:30"
    },
    {
      id: "daily-2",
      name: "Duelista Nato",
      description: "Venca 2 partidas",
      type: "daily",
      category: "battle",
      icon: <Swords className="w-6 h-6 text-red-400" />,
      progress: Math.min(wins, 2),
      maxProgress: 2,
      reward: { coins: 150, fp: 20 },
      completed: wins >= 2,
      claimed: claimedMissions.has("daily-2"),
      expiresIn: "23:45:30"
    },
    {
      id: "daily-3",
      name: "Login Diario",
      description: "Faca login no jogo",
      type: "daily",
      category: "general",
      icon: <Calendar className="w-6 h-6 text-cyan-400" />,
      progress: 1,
      maxProgress: 1,
      reward: { coins: 50 },
      completed: true,
      claimed: claimedMissions.has("daily-3"),
      expiresIn: "23:45:30"
    },
    {
      id: "daily-4",
      name: "Colecionador Ativo",
      description: "Adicione 5 cartas a colecao",
      type: "daily",
      category: "collection",
      icon: <BookOpen className="w-6 h-6 text-amber-400" />,
      progress: Math.min(totalCards % 5, 5),
      maxProgress: 5,
      reward: { coins: 100, fp: 10 },
      completed: false,
      claimed: claimedMissions.has("daily-4"),
      expiresIn: "23:45:30"
    },
    {
      id: "daily-5",
      name: "Amigo do Dia",
      description: "Envie um coracao para um amigo",
      type: "daily",
      category: "social",
      icon: <Users className="w-6 h-6 text-pink-400" />,
      progress: 0,
      maxProgress: 1,
      reward: { fp: 30 },
      completed: false,
      claimed: claimedMissions.has("daily-5"),
      expiresIn: "23:45:30"
    },
    // Weekly Missions
    {
      id: "weekly-1",
      name: "Mestre Gacha",
      description: "Abra 30 packs esta semana",
      type: "weekly",
      category: "gacha",
      icon: <Sparkles className="w-6 h-6 text-purple-400" />,
      progress: Math.min(totalCards, 30),
      maxProgress: 30,
      reward: { coins: 500, fp: 100 },
      completed: totalCards >= 30,
      claimed: claimedMissions.has("weekly-1"),
      expiresIn: "6d 23h"
    },
    {
      id: "weekly-2",
      name: "Guerreiro da Semana",
      description: "Venca 10 partidas",
      type: "weekly",
      category: "battle",
      icon: <Swords className="w-6 h-6 text-red-400" />,
      progress: Math.min(wins, 10),
      maxProgress: 10,
      reward: { coins: 700, fp: 150 },
      completed: wins >= 10,
      claimed: claimedMissions.has("weekly-2"),
      expiresIn: "6d 23h"
    },
    {
      id: "weekly-3",
      name: "Colecao Crescente",
      description: "Colete 20 cartas novas",
      type: "weekly",
      category: "collection",
      icon: <BookOpen className="w-6 h-6 text-amber-400" />,
      progress: Math.min(totalCards, 20),
      maxProgress: 20,
      reward: { coins: 400 },
      completed: totalCards >= 20,
      claimed: claimedMissions.has("weekly-3"),
      expiresIn: "6d 23h"
    },
    {
      id: "weekly-4",
      name: "Rede Social",
      description: "Adicione 3 novos amigos",
      type: "weekly",
      category: "social",
      icon: <Users className="w-6 h-6 text-pink-400" />,
      progress: Math.min(friendCount, 3),
      maxProgress: 3,
      reward: { fp: 200 },
      completed: friendCount >= 3,
      claimed: claimedMissions.has("weekly-4"),
      expiresIn: "6d 23h"
    },
    // Special Missions
    {
      id: "special-1",
      name: "Lancamento Especial",
      description: "Comemore o lancamento coletando 50 cartas!",
      type: "special",
      category: "collection",
      icon: <Flame className="w-6 h-6 text-orange-400" />,
      progress: Math.min(totalCards, 50),
      maxProgress: 50,
      reward: { coins: 1000, fp: 500 },
      completed: totalCards >= 50,
      claimed: claimedMissions.has("special-1"),
      expiresIn: "29d 23h"
    },
    {
      id: "special-2",
      name: "Veterano de Guerra",
      description: "Complete 25 batalhas",
      type: "special",
      category: "battle",
      icon: <Target className="w-6 h-6 text-red-400" />,
      progress: Math.min(totalMatches, 25),
      maxProgress: 25,
      reward: { coins: 800, fp: 300, item: "Pack Especial" },
      completed: totalMatches >= 25,
      claimed: claimedMissions.has("special-2"),
      expiresIn: "29d 23h"
    },
    {
      id: "special-3",
      name: "Amizade Verdadeira",
      description: "Alcance nivel 5 de afinidade com um amigo",
      type: "special",
      category: "social",
      icon: <Star className="w-6 h-6 text-amber-400" />,
      progress: 0,
      maxProgress: 1,
      reward: { coins: 500, fp: 500 },
      completed: false,
      claimed: claimedMissions.has("special-3"),
      expiresIn: "29d 23h"
    },
  ]

  const filteredMissions = allMissions.filter(m => m.type === activeTab)
  
  // Calculate completion stats
  const dailyTotal = allMissions.filter(m => m.type === "daily").length
  const dailyCompleted = allMissions.filter(m => m.type === "daily" && m.completed).length
  const weeklyTotal = allMissions.filter(m => m.type === "weekly").length
  const weeklyCompleted = allMissions.filter(m => m.type === "weekly" && m.completed).length
  const specialTotal = allMissions.filter(m => m.type === "special").length
  const specialCompleted = allMissions.filter(m => m.type === "special" && m.completed).length

  const handleClaimReward = (mission: Mission) => {
    if (!mission.completed || mission.claimed) return
    
    setClaimingId(mission.id)
    
    setTimeout(() => {
      // Add rewards
      let totalCoins = coins
      if (mission.reward.coins) {
        totalCoins += mission.reward.coins
      }
      setCoins(totalCoins)
      
      // Mark as claimed
      setClaimedMissions(prev => new Set([...prev, mission.id]))
      setClaimingId(null)
    }, 800)
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "gacha": return "text-purple-400 bg-purple-500/20"
      case "battle": return "text-red-400 bg-red-500/20"
      case "collection": return "text-amber-400 bg-amber-500/20"
      case "social": return "text-pink-400 bg-pink-500/20"
      default: return "text-cyan-400 bg-cyan-500/20"
    }
  }

  const getTypeStyles = (type: string) => {
  switch (type) {
  case "daily":
  return { border: "border-cyan-500/40", glow: "shadow-lg shadow-cyan-500/15", accent: "text-cyan-400" }
  case "weekly":
  return { border: "border-purple-500/40", glow: "shadow-lg shadow-purple-500/15", accent: "text-purple-400" }
  case "special":
  return { border: "border-amber-500/50", glow: "shadow-lg shadow-amber-500/20", accent: "text-amber-400" }
  default:
  return { border: "border-slate-500/30", glow: "", accent: "text-slate-400" }
  }
  }

  return (
  <div className="min-h-screen flex flex-col relative overflow-hidden">
  {/* Premium Background */}
  <div className="fixed inset-0">
  <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-cyan-950/20 to-slate-950" />
  <div className="absolute inset-0 bg-gradient-to-t from-purple-900/15 via-transparent to-cyan-900/15" />
  <div className="absolute inset-0 opacity-[0.04]"
  style={{
  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(6,182,212,0.5) 1px, transparent 0)`,
  backgroundSize: "32px 32px",
  }}
  />
  <div 
  className="absolute inset-0"
  style={{
  backgroundImage: "radial-gradient(ellipse 70% 40% at 30% 0%, rgba(56,189,248,0.08) 0%, transparent 50%), radial-gradient(ellipse 50% 30% at 70% 100%, rgba(168,85,247,0.06) 0%, transparent 40%)"
  }}
  />
  </div>

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-cyan-400/30 rounded-full animate-float"
            style={{
              left: `${(i * 8) % 100}%`,
              top: `${(i * 9) % 100}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${5 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 glass-dark border-b border-cyan-500/20">
        <div className="flex items-center justify-between p-4">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            {t("back")}
          </Button>
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              MISSOES
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-full border border-cyan-400/30">
              <Image src="/images/icons/gacha-coin.png" alt="Coin" width={24} height={24} className="w-6 h-6" />
              <span className="font-bold text-white">{coins.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="relative z-10 p-4 pb-2">
        <div className="grid grid-cols-3 gap-3">
          {[
            { type: "daily", label: "Diarias", completed: dailyCompleted, total: dailyTotal, color: "cyan" },
            { type: "weekly", label: "Semanais", completed: weeklyCompleted, total: weeklyTotal, color: "purple" },
            { type: "special", label: "Especiais", completed: specialCompleted, total: specialTotal, color: "amber" },
          ].map(({ type, label, completed, total, color }) => (
            <button
              key={type}
              onClick={() => setActiveTab(type as typeof activeTab)}
              className={`relative rounded-2xl p-4 border transition-all duration-300 ${
                activeTab === type
                  ? `bg-${color}-500/20 border-${color}-500/50 shadow-lg shadow-${color}-500/20`
                  : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600/50"
              }`}
            >
              <div className={`text-xs font-medium mb-1 ${activeTab === type ? `text-${color}-400` : "text-slate-400"}`}>
                {label}
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${activeTab === type ? "text-white" : "text-slate-300"}`}>
                  {completed}
                </span>
                <span className="text-slate-500">/{total}</span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    activeTab === type 
                      ? `bg-gradient-to-r from-${color}-500 to-${color}-400` 
                      : "bg-slate-600"
                  }`}
                  style={{ width: `${(completed / total) * 100}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Refresh timer */}
      <div className="relative z-10 px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <RefreshCw className="w-4 h-4" />
            <span>
              {activeTab === "daily" && "Reinicia em: 23:45:30"}
              {activeTab === "weekly" && "Reinicia em: 6d 23h"}
              {activeTab === "special" && "Evento termina em: 29d 23h"}
            </span>
          </div>
          <button className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-sm font-medium">
            Ver Todas <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mission List */}
      <div className="flex-1 p-4 pt-2 overflow-y-auto relative z-10">
        <div className="space-y-3">
          {filteredMissions.map((mission) => {
            const styles = getTypeStyles(mission.type)
            const categoryStyle = getCategoryColor(mission.category)
            const progress = (mission.progress / mission.maxProgress) * 100
            const isClaiming = claimingId === mission.id
            const canClaim = mission.completed && !mission.claimed && !claimedMissions.has(mission.id)

  return (
  <div
  key={mission.id}
  className={`relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] ${styles.border} border glass-card shadow-xl ${styles.glow} ${
  mission.completed ? "ring-2 ring-green-500/40 glow-cyan" : ""
  }`}
  >
                <div className="p-4">
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${categoryStyle}`}>
                      {mission.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-bold truncate">{mission.name}</h3>
                        {mission.completed && !mission.claimed && !claimedMissions.has(mission.id) && (
                          <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                            Completo!
                          </span>
                        )}
                        {(mission.claimed || claimedMissions.has(mission.id)) && (
                          <span className="bg-slate-600/50 text-slate-400 text-xs font-bold px-2 py-0.5 rounded-full">
                            Resgatado
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm mb-2">{mission.description}</p>

                      {/* Progress bar */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              mission.completed
                                ? "bg-gradient-to-r from-green-500 to-emerald-400"
                                : "bg-gradient-to-r from-cyan-500 to-blue-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-slate-400 text-sm font-medium">
                          {mission.progress}/{mission.maxProgress}
                        </span>
                      </div>

                      {/* Rewards */}
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-xs">Recompensa:</span>
                        <div className="flex items-center gap-2">
                          {mission.reward.coins && (
                            <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full">
                              <Image src="/images/icons/gacha-coin.png" alt="Coin" width={16} height={16} className="w-4 h-4" />
                              <span className="text-amber-400 text-xs font-bold">{mission.reward.coins}</span>
                            </div>
                          )}
                          {mission.reward.fp && (
                            <div className="flex items-center gap-1 bg-pink-500/10 px-2 py-0.5 rounded-full">
                              <Star className="w-3 h-3 text-pink-400" />
                              <span className="text-pink-400 text-xs font-bold">{mission.reward.fp} FP</span>
                            </div>
                          )}
                          {mission.reward.item && (
                            <div className="flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded-full">
                              <Gift className="w-3 h-3 text-purple-400" />
                              <span className="text-purple-400 text-xs font-bold">{mission.reward.item}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Claim button */}
                    <div className="shrink-0 flex items-center">
                      <Button
                        onClick={() => handleClaimReward(mission)}
                        disabled={!canClaim || isClaiming}
                        className={`${
                          canClaim
                            ? "bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white"
                            : mission.claimed || claimedMissions.has(mission.id)
                            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                            : "bg-slate-800 text-slate-500 cursor-not-allowed"
                        } transition-all`}
                      >
                        {isClaiming ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : mission.claimed || claimedMissions.has(mission.id) ? (
                          <Check className="w-5 h-5" />
                        ) : canClaim ? (
                          <Gift className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Time remaining */}
                  {mission.expiresIn && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        Expira em: {mission.expiresIn}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bonus section */}
        <div className="mt-6">
          <div className="bg-gradient-to-r from-amber-900/30 via-orange-900/30 to-amber-900/30 rounded-2xl p-4 border border-amber-500/30">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
                <Zap className="w-8 h-8 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold mb-1">Bonus de Conclusao</h3>
                <p className="text-slate-400 text-sm">
                  Complete todas as missoes {activeTab === "daily" ? "diarias" : activeTab === "weekly" ? "semanais" : "especiais"} para receber um bonus extra!
                </p>
              </div>
              <div className="text-center">
                <div className="text-amber-400 font-bold text-xl">
                  {activeTab === "daily" ? dailyCompleted : activeTab === "weekly" ? weeklyCompleted : specialCompleted}
                  /
                  {activeTab === "daily" ? dailyTotal : activeTab === "weekly" ? weeklyTotal : specialTotal}
                </div>
                <div className="flex items-center gap-1 justify-center text-amber-400 text-sm">
                  <Image src="/images/icons/gacha-coin.png" alt="Coin" width={16} height={16} className="w-4 h-4" />
                  +{activeTab === "daily" ? "200" : activeTab === "weekly" ? "1000" : "2000"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
