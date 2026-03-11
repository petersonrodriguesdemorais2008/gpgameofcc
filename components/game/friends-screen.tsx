"use client"

import { useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, type Friend } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, Heart, Users, UserPlus, Check, X, Star, Crown, Sparkles, Send } from "lucide-react"
import Image from "next/image"

interface FriendsScreenProps {
  onBack: () => void
}

type TabType = "friends" | "requests" | "search"

export default function FriendsScreen({ onBack }: FriendsScreenProps) {
  const { t } = useLanguage()
  const {
    friends,
    friendRequests,
    playerId,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    sendHeart,
    sendHeartToAll,
    searchPlayerById,
    canSendHeartTo,
    friendPoints,
    spendableFP,
  } = useGame()

  const [activeTab, setActiveTab] = useState<TabType>("friends")
  const [searchId, setSearchId] = useState("")
  const [searchResult, setSearchResult] = useState<Friend | null>(null)
  const [searchError, setSearchError] = useState("")
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [sentHearts, setSentHearts] = useState<Set<string>>(new Set())
  const [requestSent, setRequestSent] = useState(false)

  const handleSearch = () => {
    setSearchError("")
    setSearchResult(null)
    setRequestSent(false)
    if (!searchId.trim()) {
      setSearchError("Digite um ID para buscar")
      return
    }
    const result = searchPlayerById(searchId.trim().toUpperCase())
    if (result) {
      setSearchResult(result)
    } else {
      setSearchError("Jogador nao encontrado ou ja e seu amigo")
    }
  }

  const handleSendRequest = () => {
    if (searchResult) {
      const success = sendFriendRequest(searchResult.id)
      if (success) {
        setRequestSent(true)
      }
    }
  }

  const handleSendHeart = (friendId: string) => {
    const success = sendHeart(friendId)
    if (success) {
      setSentHearts((prev) => new Set([...prev, friendId]))
    }
  }

  const handleSendAllHearts = () => {
    const count = sendHeartToAll()
    if (count > 0) {
      const newSent = new Set(sentHearts)
      friends.forEach((f) => newSent.add(f.id))
      setSentHearts(newSent)
    }
  }

  const getAffinityMaxPoints = (level: number) => level * 100
  const pendingRequests = friendRequests.filter((r) => r.status === "pending")
  const realFriends = friends.filter((f) => !f.isGuest || f.id === "GUEST-001")

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-pink-900/10 to-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-pink-400/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-r from-black/80 via-pink-900/30 to-black/80 border-b border-pink-500/30 backdrop-blur-sm">
        <Button onClick={onBack} variant="ghost" className="text-pink-400 hover:text-pink-300 hover:bg-pink-500/10">
          <ArrowLeft className="mr-2 h-5 w-5" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 via-rose-300 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
          <Users className="w-6 h-6 text-pink-400" />
          Amigos
        </h1>
        <div className="flex items-center gap-2 bg-gradient-to-r from-pink-600/80 to-rose-600/80 px-4 py-2 rounded-full border border-pink-400/50 shadow-lg shadow-pink-500/20">
          <Heart className="w-4 h-4 text-white fill-white" />
          <span className="font-bold text-white text-sm">{spendableFP} FP</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex border-b border-slate-700/50">
        {[
          { key: "friends", label: `Amigos (${realFriends.length})`, icon: Users, color: "cyan" },
          { key: "requests", label: "Pedidos", icon: UserPlus, color: "amber", badge: pendingRequests.length },
          { key: "search", label: "Buscar", icon: Search, color: "green" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`flex-1 py-4 px-4 font-medium transition-all relative ${
              activeTab === tab.key
                ? `text-${tab.color}-400 border-b-2 border-${tab.color}-400 bg-${tab.color}-400/10`
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <tab.icon className="w-4 h-4 inline mr-2" />
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className="absolute top-2 right-4 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4">
        {activeTab === "friends" && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {/* One-Tap Gift All Button */}
            <Button
              onClick={handleSendAllHearts}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 py-6 text-lg font-bold border-2 border-pink-400/50 shadow-lg shadow-pink-500/30 transition-all hover:scale-[1.02]"
            >
              <Send className="w-5 h-5 mr-2" />
              Enviar Coracao para Todos
              <Heart className="w-5 h-5 ml-2 fill-white" />
            </Button>

            {/* Friend Points Info */}
            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-2xl p-5 border border-purple-500/30 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-purple-300 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Pontos de Afinidade Acumulados
                </span>
                <span className="text-white font-bold text-lg">{friendPoints} FP</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pink-300 font-medium flex items-center gap-2">
                  <Heart className="w-4 h-4 fill-pink-300" />
                  FP Disponivel para Gacha
                </span>
                <span className="text-white font-bold text-lg">{spendableFP} FP</span>
              </div>
            </div>

            {/* Friends List */}
            {realFriends.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-20 h-20 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Voce ainda nao tem amigos</p>
                <p className="text-sm mt-2">Use a aba Buscar para encontrar jogadores</p>
              </div>
            ) : (
              <div className="space-y-3">
                {realFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className={`bg-gradient-to-r ${
                      friend.isGuest
                        ? "from-amber-900/40 to-yellow-900/40 border-amber-500/40"
                        : "from-slate-800/80 to-pink-900/30 border-pink-500/30"
                    } rounded-2xl p-4 border cursor-pointer hover:border-pink-400/60 transition-all hover:scale-[1.01] backdrop-blur-sm`}
                    onClick={() => setSelectedFriend(friend)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-pink-400/50 bg-slate-700 shadow-lg">
                        {friend.avatarUrl ? (
                          <Image
                            src={friend.avatarUrl || "/placeholder.svg"}
                            alt={friend.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-pink-300">
                            {friend.name.charAt(0)}
                          </div>
                        )}
                        {friend.isGuest && (
                          <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 shadow-lg">
                            <Star className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-lg">{friend.name}</span>
                          {friend.isGuest && (
                            <span className="text-xs bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/50">
                              GUEST
                            </span>
                          )}
                        </div>
                        {friend.title && <p className="text-sm text-pink-400">{friend.title}</p>}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                            Lv.{friend.level}
                          </span>
                          <span className="text-xs text-pink-400 bg-pink-500/20 px-2 py-0.5 rounded">
                            Afinidade Lv.{friend.affinityLevel}
                          </span>
                        </div>

                        {/* Affinity Bar */}
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">FP</span>
                            <span className="text-pink-400 font-medium">
                              {friend.affinityPoints}/{getAffinityMaxPoints(friend.affinityLevel)}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all"
                              style={{
                                width: `${(friend.affinityPoints / getAffinityMaxPoints(friend.affinityLevel)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSendHeart(friend.id)
                        }}
                        disabled={!canSendHeartTo(friend.id) || sentHearts.has(friend.id)}
                        size="sm"
                        className={`${
                          canSendHeartTo(friend.id) && !sentHearts.has(friend.id)
                            ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 shadow-lg shadow-pink-500/30"
                            : "bg-slate-700"
                        } border border-pink-400/30`}
                      >
                        <Heart className={`w-5 h-5 ${sentHearts.has(friend.id) ? "fill-white" : ""}`} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "requests" && (
          <div className="space-y-3 max-w-2xl mx-auto">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <UserPlus className="w-20 h-20 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Nenhum pedido de amizade pendente</p>
              </div>
            ) : (
              pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-gradient-to-r from-slate-800/80 to-amber-900/30 rounded-2xl p-5 border border-amber-500/40 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                      {request.fromName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white text-lg">{request.fromName}</p>
                      <p className="text-xs text-slate-400">ID: {request.fromId}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => acceptFriendRequest(request.id)}
                        className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 border border-green-400/50 shadow-lg"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aceitar
                      </Button>
                      <Button
                        onClick={() => rejectFriendRequest(request.id)}
                        className="bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 border border-red-400/50 shadow-lg"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Recusar
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "search" && (
          <div className="space-y-4 max-w-xl mx-auto">
            {/* Search Box */}
            <div className="bg-gradient-to-r from-slate-800/80 to-green-900/30 rounded-2xl p-5 border border-green-500/40 backdrop-blur-sm">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-lg">
                <Search className="w-5 h-5 text-green-400" />
                Buscar Jogador por ID
              </h3>
              <div className="flex gap-2">
                <Input
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                  placeholder="Ex: GP-ABCD1234"
                  className="bg-slate-900/80 border-green-500/30 text-white font-mono text-lg"
                />
                <Button
                  onClick={handleSearch}
                  className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 border border-green-400/50 px-6"
                >
                  <Search className="w-5 h-5" />
                </Button>
              </div>
              {searchError && <p className="text-red-400 text-sm mt-3">{searchError}</p>}
            </div>

            {/* Search Result */}
            {searchResult && (
              <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 rounded-2xl p-5 border border-green-500/40 backdrop-blur-sm">
                <h3 className="font-bold text-green-400 mb-4 flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Jogador Encontrado!
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                    {searchResult.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-lg">{searchResult.name}</p>
                    <p className="text-xs text-slate-400">ID: {searchResult.id}</p>
                    <p className="text-sm text-cyan-400">Level {searchResult.level}</p>
                  </div>
                  {!requestSent ? (
                    <Button
                      onClick={handleSendRequest}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border border-cyan-400/50 shadow-lg"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Enviar Pedido
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-green-400 bg-green-500/20 px-4 py-2 rounded-lg border border-green-500/50">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">Enviado!</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Your ID */}
            <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-5 border border-purple-500/40 backdrop-blur-sm">
              <h3 className="font-bold text-purple-400 mb-3 flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Seu ID de Jogador
              </h3>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-black/50 px-5 py-4 rounded-xl text-2xl font-mono text-purple-300 tracking-widest border border-purple-500/30">
                  {playerId}
                </code>
                <Button
                  onClick={() => navigator.clipboard.writeText(playerId)}
                  variant="outline"
                  className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20 bg-transparent px-6 py-4"
                >
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Compartilhe seu ID com amigos para que eles possam te adicionar!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Friend Profile Modal */}
      {selectedFriend && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl max-w-lg w-full p-6 border-2 border-pink-500/40 max-h-[90vh] overflow-y-auto relative shadow-2xl shadow-pink-500/20">
            <button
              onClick={() => setSelectedFriend(null)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>

            {/* Profile Header */}
            <div className="text-center mb-6">
              <div className="relative w-28 h-28 mx-auto rounded-2xl overflow-hidden border-4 border-pink-400/50 bg-slate-700 mb-4 shadow-xl">
                {selectedFriend.avatarUrl ? (
                  <Image
                    src={selectedFriend.avatarUrl || "/placeholder.svg"}
                    alt={selectedFriend.name}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-pink-300">
                    {selectedFriend.name.charAt(0)}
                  </div>
                )}
              </div>
              <h2 className="text-3xl font-bold text-white">{selectedFriend.name}</h2>
              {selectedFriend.title && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span className="text-amber-400 font-medium">{selectedFriend.title}</span>
                </div>
              )}
              <p className="text-slate-400 mt-2 text-lg">Level {selectedFriend.level}</p>
              {selectedFriend.isGuest && (
                <span className="inline-block mt-3 text-sm bg-amber-500/30 text-amber-300 px-4 py-1.5 rounded-full border border-amber-500/50">
                  GUEST Player
                </span>
              )}
            </div>

            {/* Affinity Section */}
            <div className="bg-gradient-to-r from-pink-900/40 to-rose-900/40 rounded-2xl p-5 border border-pink-500/40 mb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-pink-300 font-medium flex items-center gap-2">
                  <Heart className="w-5 h-5 fill-pink-400 text-pink-400" />
                  Nivel de Afinidade
                </span>
                <span className="text-white font-bold text-2xl">Lv.{selectedFriend.affinityLevel}</span>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Progresso</span>
                  <span className="text-pink-400 font-medium">
                    {selectedFriend.affinityPoints}/{getAffinityMaxPoints(selectedFriend.affinityLevel)} FP
                  </span>
                </div>
                <div className="h-4 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all"
                    style={{
                      width: `${(selectedFriend.affinityPoints / getAffinityMaxPoints(selectedFriend.affinityLevel)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Showcase */}
            {selectedFriend.showcaseCards && selectedFriend.showcaseCards.length > 0 && (
              <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 rounded-2xl p-5 border border-indigo-500/40">
                <h3 className="font-bold text-indigo-300 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Showcase de Gears
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {selectedFriend.showcaseCards.map((card, idx) => (
                    <div
                      key={idx}
                      className={`relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg ${
                        card.rarity === "LR"
                          ? "ring-2 ring-red-400"
                          : card.rarity === "UR"
                            ? "ring-2 ring-yellow-400"
                            : card.rarity === "SR"
                              ? "ring-1 ring-purple-400"
                              : ""
                      }`}
                    >
                      <Image src={card.image || "/placeholder.svg"} alt={card.name} fill sizes="56px" className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => setSelectedFriend(null)}
              className="w-full mt-6 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 py-3 font-medium"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
