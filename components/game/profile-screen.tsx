"use client"

import { useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, PROFILE_ICONS } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  ArrowLeft, 
  User, 
  Trophy, 
  Swords, 
  Star,
  Crown,
  Edit3,
  Check,
  X,
  Shield,
  Flame,
  Target,
  Award,
  Copy,
  BookOpen
} from "lucide-react"
import Image from "next/image"

interface ProfileScreenProps {
  onBack: () => void
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  progress: number
  maxProgress: number
  completed: boolean
  reward: string
}

const PLAYER_TITLES = [
  "Iniciante",
  "Colecionador",
  "Estrategista",
  "Mestre das Cartas",
  "Guardiao Lendario",
  "Comandante de Elite",
  "Senhor do Gacha",
  "Lenda Viva",
]

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { t } = useLanguage()
  const { 
    playerProfile, 
    updatePlayerProfile, 
    collection, 
    decks, 
    matchHistory, 
    coins, 
    friendPoints,
    playerId 
  } = useGame()
  
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(playerProfile.name)
  const [editTitle, setEditTitle] = useState(playerProfile.title)
  const [showIconSelector, setShowIconSelector] = useState(false)
  const [activeTab, setActiveTab] = useState<"stats" | "achievements" | "showcase">("stats")
  const [copied, setCopied] = useState(false)

  // Calculate stats
  const totalCards = collection.length
  const uniqueCards = new Set(collection.map(c => c.id.split("-").slice(0, -2).join("-"))).size
  const totalMatches = matchHistory.length
  const wins = matchHistory.filter(m => m.result === "won").length
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

  // Card rarity breakdown
  const rarityBreakdown = {
    LR: collection.filter(c => c.rarity === "LR").length,
    UR: collection.filter(c => c.rarity === "UR").length,
    SR: collection.filter(c => c.rarity === "SR").length,
    R: collection.filter(c => c.rarity === "R").length,
  }

  // Mock achievements (in a real app, these would come from the game context)
  const achievements: Achievement[] = [
    {
      id: "first-win",
      name: "Primeira Vitoria",
      description: "Venca sua primeira partida",
      icon: <Trophy className="w-6 h-6 text-amber-400" />,
      progress: Math.min(wins, 1),
      maxProgress: 1,
      completed: wins >= 1,
      reward: "100 Moedas"
    },
    {
      id: "collector-10",
      name: "Colecionador Iniciante",
      description: "Colete 10 cartas unicas",
      icon: <BookOpen className="w-6 h-6 text-blue-400" />,
      progress: Math.min(uniqueCards, 10),
      maxProgress: 10,
      completed: uniqueCards >= 10,
      reward: "200 Moedas"
    },
    {
      id: "collector-50",
      name: "Colecionador Veterano",
      description: "Colete 50 cartas unicas",
      icon: <Star className="w-6 h-6 text-purple-400" />,
      progress: Math.min(uniqueCards, 50),
      maxProgress: 50,
      completed: uniqueCards >= 50,
      reward: "500 Moedas"
    },
    {
      id: "deck-master",
      name: "Mestre dos Decks",
      description: "Crie 3 decks diferentes",
      icon: <Shield className="w-6 h-6 text-cyan-400" />,
      progress: Math.min(decks.length, 3),
      maxProgress: 3,
      completed: decks.length >= 3,
      reward: "300 Moedas"
    },
    {
      id: "win-streak",
      name: "Sequencia Vitoriosa",
      description: "Venca 5 partidas seguidas",
      icon: <Flame className="w-6 h-6 text-orange-400" />,
      progress: 0, // Would need tracking in context
      maxProgress: 5,
      completed: false,
      reward: "500 Moedas"
    },
    {
      id: "legendary-hunter",
      name: "Cacador de Lendas",
      description: "Obtenha uma carta LR",
      icon: <Crown className="w-6 h-6 text-amber-400" />,
      progress: Math.min(rarityBreakdown.LR, 1),
      maxProgress: 1,
      completed: rarityBreakdown.LR >= 1,
      reward: "1000 Moedas"
    },
  ]

  const handleSaveProfile = () => {
    updatePlayerProfile({
      name: editName,
      title: editTitle
    })
    setIsEditing(false)
  }

  const handleIconSelect = (iconImage: string) => {
    updatePlayerProfile({ avatarUrl: iconImage })
    setShowIconSelector(false)
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(playerId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const completedAchievements = achievements.filter(a => a.completed).length

  return (
  <div className="min-h-screen flex flex-col relative overflow-hidden">
  {/* Premium Background */}
  <div className="fixed inset-0">
  <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950" />
  <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/15 via-transparent to-purple-900/15" />
  <div className="absolute inset-0 opacity-[0.05]"
  style={{
  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(139,92,246,0.5) 1px, transparent 0)`,
  backgroundSize: "36px 36px",
  }}
  />
  <div 
  className="absolute inset-0"
  style={{
  backgroundImage: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(168,85,247,0.1) 0%, transparent 50%), radial-gradient(ellipse 50% 30% at 80% 100%, rgba(56,189,248,0.08) 0%, transparent 40%)"
  }}
  />
  </div>
  
  {/* Header */}
  <div className="relative z-10 glass-card border-b border-cyan-500/20">
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
            <User className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              PERFIL
            </h1>
          </div>
          <div className="w-20" />
        </div>
      </div>

      {/* Profile Card */}
      <div className="relative z-10 p-4">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-cyan-500/30 shadow-xl shadow-cyan-500/10">
          {/* Banner background */}
          <div className="h-32 bg-gradient-to-r from-cyan-600/30 via-purple-600/30 to-pink-600/30 relative">
            <div className="absolute inset-0 bg-[url('/images/the_great_order_wallpaper.png')] bg-cover bg-center opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
          </div>

          {/* Profile content */}
          <div className="relative -mt-16 px-6 pb-6">
            {/* Avatar */}
            <div className="flex items-end gap-4 mb-4">
              <div 
                className="relative cursor-pointer group"
                onClick={() => setShowIconSelector(true)}
              >
                <div className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-cyan-400/50 shadow-lg shadow-cyan-500/30 bg-slate-800">
                  {playerProfile.avatarUrl ? (
                    <Image
                      src={playerProfile.avatarUrl}
                      alt={playerProfile.name}
                      width={112}
                      height={112}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                      <span className="text-white text-3xl font-bold">{playerProfile.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Edit3 className="w-6 h-6 text-white" />
                </div>
                {/* Level badge */}
                <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-sm px-3 py-1 rounded-full shadow-lg">
                  Lv.{playerProfile.level}
                </div>
              </div>

              {/* Name and title */}
              <div className="flex-1 pb-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-slate-800 border-cyan-500/30 text-white text-xl font-bold"
                      placeholder="Nome"
                    />
                    <select
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-slate-800 border border-cyan-500/30 text-cyan-400 rounded-lg px-3 py-2 text-sm"
                    >
                      {PLAYER_TITLES.map(title => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveProfile} className="bg-green-600 hover:bg-green-500">
                        <Check className="w-4 h-4 mr-1" /> Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                        <X className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-white">{playerProfile.name}</h2>
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <p className="text-cyan-400 font-medium">{playerProfile.title}</p>
                  </>
                )}
              </div>
            </div>

            {/* Player ID */}
            <div className="flex items-center gap-2 mb-4 bg-slate-800/50 rounded-xl px-4 py-2 border border-slate-700/50">
              <span className="text-slate-400 text-sm">ID:</span>
              <span className="text-white font-mono text-sm flex-1">{playerId}</span>
              <button
                onClick={handleCopyId}
                className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: <BookOpen className="w-5 h-5" />, value: uniqueCards, label: "Cartas" },
                { icon: <Swords className="w-5 h-5" />, value: totalMatches, label: "Partidas" },
                { icon: <Trophy className="w-5 h-5" />, value: `${winRate}%`, label: "Vitorias" },
                { icon: <Award className="w-5 h-5" />, value: `${completedAchievements}/${achievements.length}`, label: "Conquistas" },
              ].map((stat, i) => (
                <div key={i} className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/50">
                  <div className="text-cyan-400 mb-1 flex justify-center">{stat.icon}</div>
                  <div className="text-white font-bold text-lg">{stat.value}</div>
                  <div className="text-slate-400 text-xs">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 px-4">
        <div className="flex gap-2 bg-slate-900/50 rounded-xl p-1 border border-slate-700/50">
          {[
            { id: "stats", label: "Estatisticas", icon: Target },
            { id: "achievements", label: "Conquistas", icon: Trophy },
            { id: "showcase", label: "Colecao", icon: Star },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === id
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 overflow-y-auto relative z-10">
        {activeTab === "stats" && (
          <div className="space-y-4">
            {/* Resources */}
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Recursos
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-3">
                  <Image src="/images/icons/gacha-coin.png" alt="Coins" width={40} height={40} className="w-10 h-10" />
                  <div>
                    <div className="text-amber-400 font-bold text-xl">{coins.toLocaleString()}</div>
                    <div className="text-slate-400 text-xs">Moedas</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                    <Star className="w-6 h-6 text-pink-400" />
                  </div>
                  <div>
                    <div className="text-pink-400 font-bold text-xl">{friendPoints}</div>
                    <div className="text-slate-400 text-xs">Pontos de Amizade</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card breakdown */}
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                Cartas por Raridade
              </h3>
              <div className="space-y-3">
                {[
                  { rarity: "LR", count: rarityBreakdown.LR, color: "from-red-500 to-amber-500", textColor: "text-amber-400" },
                  { rarity: "UR", count: rarityBreakdown.UR, color: "from-amber-500 to-yellow-400", textColor: "text-yellow-400" },
                  { rarity: "SR", count: rarityBreakdown.SR, color: "from-purple-500 to-pink-500", textColor: "text-purple-400" },
                  { rarity: "R", count: rarityBreakdown.R, color: "from-slate-500 to-slate-400", textColor: "text-slate-400" },
                ].map(({ rarity, count, color, textColor }) => (
                  <div key={rarity} className="flex items-center gap-3">
                    <span className={`font-bold w-8 ${textColor}`}>{rarity}</span>
                    <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
                        style={{ width: `${Math.min((count / Math.max(totalCards, 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-white font-bold w-12 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Match history */}
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" />
                Historico de Batalhas
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <div className="text-green-400 font-bold text-2xl">{wins}</div>
                  <div className="text-slate-400 text-xs">Vitorias</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <div className="text-red-400 font-bold text-2xl">{totalMatches - wins}</div>
                  <div className="text-slate-400 text-xs">Derrotas</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <div className="text-cyan-400 font-bold text-2xl">{winRate}%</div>
                  <div className="text-slate-400 text-xs">Taxa</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "achievements" && (
          <div className="space-y-3">
            {achievements.map((achievement) => (
              <div 
                key={achievement.id}
                className={`bg-slate-900/50 rounded-2xl p-4 border transition-all ${
                  achievement.completed 
                    ? "border-amber-500/50 shadow-lg shadow-amber-500/10" 
                    : "border-slate-700/50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    achievement.completed 
                      ? "bg-gradient-to-br from-amber-500/30 to-yellow-500/30" 
                      : "bg-slate-800/50"
                  }`}>
                    {achievement.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-bold">{achievement.name}</h4>
                      {achievement.completed && (
                        <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">
                          Completo
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm mb-2">{achievement.description}</p>
                    
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            achievement.completed 
                              ? "bg-gradient-to-r from-amber-500 to-yellow-400" 
                              : "bg-gradient-to-r from-cyan-500 to-blue-500"
                          }`}
                          style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                        />
                      </div>
                      <span className="text-slate-400 text-sm">
                        {achievement.progress}/{achievement.maxProgress}
                      </span>
                    </div>
                    
                    {/* Reward */}
                    <div className="mt-2 flex items-center gap-1 text-amber-400 text-sm">
                      <Gift className="w-4 h-4" />
                      Recompensa: {achievement.reward}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "showcase" && (
          <div className="space-y-4">
            <p className="text-slate-400 text-center">
              Suas cartas mais raras serao exibidas aqui em breve!
            </p>
            {/* Show top cards by rarity */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {collection
                .filter(c => c.rarity === "LR" || c.rarity === "UR")
                .slice(0, 10)
                .map((card, i) => (
                  <div 
                    key={`${card.id}-${i}`}
                    className={`aspect-[3/4] rounded-xl overflow-hidden border-2 ${
                      card.rarity === "LR" 
                        ? "border-amber-500 shadow-lg shadow-amber-500/30" 
                        : "border-purple-500 shadow-lg shadow-purple-500/20"
                    }`}
                  >
                    <Image
                      src={card.image}
                      alt={card.name}
                      width={100}
                      height={140}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
            </div>
            {collection.filter(c => c.rarity === "LR" || c.rarity === "UR").length === 0 && (
              <div className="text-center py-8">
                <Crown className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">Nenhuma carta UR ou LR ainda</p>
                <p className="text-slate-600 text-sm">Abra packs no Gacha para conseguir!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Icon Selector Modal */}
      {showIconSelector && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowIconSelector(false)}
        >
          <div 
            className="bg-slate-900 rounded-2xl border border-cyan-500/30 p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4 text-center">Escolha seu Avatar</h3>
            <div className="grid grid-cols-3 gap-4">
              {PROFILE_ICONS.map((icon) => (
                <button
                  key={icon.id}
                  onClick={() => handleIconSelect(icon.image)}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                    playerProfile.avatarUrl === icon.image 
                      ? "border-cyan-400 shadow-lg shadow-cyan-500/30" 
                      : "border-slate-600 hover:border-slate-400"
                  }`}
                >
                  <Image
                    src={icon.image}
                    alt={icon.name}
                    width={100}
                    height={100}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
            <Button 
              onClick={() => setShowIconSelector(false)}
              className="w-full mt-4 bg-slate-700 hover:bg-slate-600"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Missing import
import { Gift } from "lucide-react"
