"use client"

import { useState, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, type Card, type Deck, isTroopUnit } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, Trash2, Plus, Search, X, Sparkles, Layers, ImageIcon, Check } from "lucide-react"
import Image from "next/image"
import { trackDeckEdit } from "@/lib/mission-tracker"


// ─── Card Skin System ──────────────────────────────────────────────────────────
// cardId is the image filename (without path) of the original card art.
// skins: list of skins available for that card.
interface CardSkin {
  id:         string   // unique skin id
  label:      string   // display name
  image:      string   // path to skin image
  masterId:   string   // which master unlocks this skin
  unlockLevel:number   // master level required
}

const CARD_SKINS: Record<string, CardSkin[]> = {
  // Fehnon Hoskie — Aquos UR card
  "fehnon-20ur.png": [
    {
      id:           "fehnon_skin_lv50",
      label:        "Skin Lv.50 — Fehnon",
      image:        "/uploads/fehnon_skin_lv50.jpg",
      masterId:     "fehnon",
      unlockLevel:  50,
    },
  ],
  // Morgana Pendragon — Darkness SR card
  "morgana-20sr.png": [
    {
      id:           "morgana_skin_lv50",
      label:        "Skin Lv.50 — Morgana",
      image:        "/uploads/morgana_skin_lv50.jpg",
      masterId:     "morgana",
      unlockLevel:  50,
    },
  ],
  // Calem Hidenori — Void LR card
  "Calem_LR.png": [
    {
      id:           "calem_skin_lv50",
      label:        "Skin Lv.50 — Calem",
      image:        "/uploads/calem_skin_lv50.jpg",
      masterId:     "calem",
      unlockLevel:  50,
    },
  ],
}

/** Returns the skins for a given card image filename (null if no skins exist) */
function getSkinsForCard(imageUrl: string): CardSkin[] | null {
  const filename = imageUrl.split("/").pop() ?? ""
  return CARD_SKINS[filename] ?? null
}

/** Checks if the player owns a specific skin */
function playerOwnsSkin(skinId: string): boolean {
  try {
    const raw = localStorage.getItem("gpgame_card_skins") ?? "[]"
    const owned: string[] = JSON.parse(raw)
    return owned.includes(skinId)
  } catch { return false }
}

/** Gets the active skin for a card (returns original image if no skin selected) */
function getActiveSkin(cardImageUrl: string): string {
  try {
    const filename = cardImageUrl.split("/").pop() ?? ""
    const raw = localStorage.getItem("gpgame_active_skins") ?? "{}"
    const active: Record<string,string> = JSON.parse(raw)
    const skinId = active[filename]
    if (!skinId) return cardImageUrl
    // Find the skin image
    const skins = CARD_SKINS[filename]
    const skin = skins?.find(s => s.id === skinId)
    return skin ? skin.image : cardImageUrl
  } catch { return cardImageUrl }
}

/** Sets the active skin for a card */
function setActiveSkin(cardImageUrl: string, skinId: string | null): void {
  try {
    const filename = cardImageUrl.split("/").pop() ?? ""
    const raw = localStorage.getItem("gpgame_active_skins") ?? "{}"
    const active: Record<string,string> = JSON.parse(raw)
    if (skinId === null) {
      delete active[filename]
    } else {
      active[filename] = skinId
    }
    localStorage.setItem("gpgame_active_skins", JSON.stringify(active))
  } catch {}
}

interface DeckBuilderScreenProps {
  onBack: () => void
}

export default function DeckBuilderScreen({ onBack }: DeckBuilderScreenProps) {
  const { t } = useLanguage()
  const { collection, decks, saveDeck, deleteDeck, ownedPlaymats, globalPlaymatId, setGlobalPlaymat } = useGame()
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null)
  const [deckName, setDeckName] = useState("")
  const [deckCards, setDeckCards] = useState<Card[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRarity, setFilterRarity] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [isCreating, setIsCreating] = useState(false)
  const [selectedPlaymatId, setSelectedPlaymatId] = useState<string | null>(null)
  const [useGlobalPlaymat, setUseGlobalPlaymat] = useState(true)
  const [showPlaymatSelector, setShowPlaymatSelector] = useState(false)
  const [zoomedCard,      setZoomedCard]      = useState<Card | null>(null)
  const [showSkinPanel,   setShowSkinPanel]   = useState(false)
  const [skinRefresh,     setSkinRefresh]     = useState(0)  // increment to force re-render
  const [draggedCard, setDraggedCard] = useState<Card | null>(null)
  const [isDeckDropZone, setIsDeckDropZone] = useState(false)
  
  // TAP (Tactical Access Pile) state
  const [tapCards, setTapCards] = useState<Card[]>([])
  const MAX_TAP_CARDS = 5
  const MAX_COPIES_PER_TAP_CARD = 4 // Maximum copies of same card allowed in TAP
  
  // Target area toggle: "deck" or "tap" - determines where cards are added
  const [targetArea, setTargetArea] = useState<"deck" | "tap">("deck")
  
  // Long press for zoom
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const LONG_PRESS_DURATION = 500 // ms
  
  const handleCardMouseDown = useCallback((card: Card) => {
    longPressTimerRef.current = setTimeout(() => {
      setZoomedCard(card)
    }, LONG_PRESS_DURATION)
  }, [])
  
  const handleCardMouseUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])
  
  const handleCardMouseLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const MIN_CARDS = 10
  const MAX_CARDS = 20
  const MAX_COPIES_PER_CARD = 4 // Maximum copies of same card allowed in deck

  // Create unique card key using name + rarity (same character with different rarities are different cards)
  const getCardKey = (card: Card) => `${card.name}-${card.rarity}`

  // Count how many copies of each card the player owns in collection (by name + rarity)
  const getOwnedCopies = (card: Card) => {
    return collection.filter((c) => c.name === card.name && c.rarity === card.rarity).length
  }

  // Get unique cards with their owned count (grouped by name + rarity)
  const uniqueCards = collection.reduce(
    (acc, card) => {
      const cardKey = getCardKey(card)
      if (!acc[cardKey]) {
        acc[cardKey] = { ...card, ownedCount: 1 }
      } else {
        acc[cardKey].ownedCount = (acc[cardKey].ownedCount || 1) + 1
      }
      return acc
    },
    {} as Record<string, Card & { ownedCount: number }>,
  )

  const availableCards = Object.values(uniqueCards)

  const filteredCards = availableCards.filter((card) => {
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRarity = filterRarity === "all" || card.rarity === filterRarity
    // Filter by card type - "troops" is for Unidades de Tropas, "brotherhood" for Brotherhood Function Cards
    const matchesType = filterType === "all" ||
      (filterType === "brotherhood" ? card.category === "Brotherhood Function Card" : card.type === filterType)
    return matchesSearch && matchesRarity && matchesType
  })

  // Count copies in deck by name + rarity
  const getCardCopiesInDeck = (card: Card) => {
    return deckCards.filter((c) => c.name === card.name && c.rarity === card.rarity).length
  }

  // Get the maximum allowed copies for a card (minimum between deck limit and owned count)
  const getMaxAllowedCopies = (card: Card) => {
    const ownedCopies = getOwnedCopies(card)
    return Math.min(MAX_COPIES_PER_CARD, ownedCopies)
  }

  // Centralized validation function
  const canAddCardToDeck = (card: Card): { canAdd: boolean; reason?: string; maxAllowed: number } => {
    const copiesInDeck = getCardCopiesInDeck(card)
    const maxAllowed = getMaxAllowedCopies(card)
    
    if (deckCards.length >= MAX_CARDS) {
      return { canAdd: false, reason: "Deck cheio", maxAllowed }
    }
    
    if (copiesInDeck >= maxAllowed) {
      const ownedCopies = getOwnedCopies(card)
      const limitReason = ownedCopies < MAX_COPIES_PER_CARD 
        ? `Voce possui apenas ${ownedCopies}` 
        : `Maximo de ${MAX_COPIES_PER_CARD} copias por deck`
      return { canAdd: false, reason: limitReason, maxAllowed }
    }
    
    return { canAdd: true, maxAllowed }
  }

  const addCardToDeck = (card: Card) => {
    const { canAdd } = canAddCardToDeck(card)
    if (!canAdd) return
    setDeckCards((prev) => [...prev, { ...card, id: `${card.id}-deck-${Date.now()}` }])
  }

  const removeCardFromDeck = (index: number) => {
    setDeckCards((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveDeck = () => {
    if (!deckName.trim()) {
      alert("Digite um nome para o deck!")
      return
    }
    if (deckCards.length < MIN_CARDS) {
      alert(`O deck precisa ter no mínimo ${MIN_CARDS} cartas!`)
      return
    }
    const deck: Deck = {
      id: selectedDeck?.id || `deck-${Date.now()}`,
      name: deckName,
      cards: deckCards,
      tapCards: tapCards.length > 0 ? tapCards : undefined,
      playmatId: useGlobalPlaymat ? undefined : selectedPlaymatId || undefined,
      useGlobalPlaymat: useGlobalPlaymat,
    }
    saveDeck(deck)
    trackDeckEdit()
    setIsCreating(false)
    setSelectedDeck(null)
    setDeckName("")
    setDeckCards([])
    setTapCards([])
    setSelectedPlaymatId(null)
    setUseGlobalPlaymat(true)
  }

  const handleDeleteDeck = (deckId: string) => {
    if (confirm("Tem certeza que deseja deletar este deck?")) {
      deleteDeck(deckId)
    }
  }

  const handleEditDeck = (deck: Deck) => {
    setSelectedDeck(deck)
    setDeckName(deck.name)
    setDeckCards([...deck.cards])
    setTapCards(deck.tapCards ? [...deck.tapCards] : [])
    setSelectedPlaymatId(deck.playmatId || null)
    setUseGlobalPlaymat(deck.useGlobalPlaymat !== false)
    setIsCreating(true)
  }

  const startNewDeck = () => {
    setSelectedDeck(null)
    setDeckName("")
    setDeckCards([])
    setTapCards([])
    setSelectedPlaymatId(null)
    setUseGlobalPlaymat(true)
    setIsCreating(true)
  }
  
  // TAP card management functions (TAP = Extra Deck - only cards NOT in main deck)
  // Count copies in TAP by name + rarity
  const getCardCopiesInTap = (card: Card) => {
    return tapCards.filter((c) => c.name === card.name && c.rarity === card.rarity).length
  }
  
  // Get max allowed copies for TAP (similar to deck logic)
  const getMaxAllowedTapCopies = (card: Card) => {
    const ownedCopies = getOwnedCopies(card)
    return Math.min(MAX_COPIES_PER_TAP_CARD, ownedCopies)
  }
  
  // Validation function for TAP
  const canAddCardToTap = (card: Card): { canAdd: boolean; reason?: string; maxAllowed: number } => {
    const copiesInTap = getCardCopiesInTap(card)
    const copiesInDeck = getCardCopiesInDeck(card)
    const ownedCopies = getOwnedCopies(card)
    const maxAllowed = getMaxAllowedTapCopies(card)
    
    if (tapCards.length >= MAX_TAP_CARDS) {
      return { canAdd: false, reason: "TAP cheio (max 5)", maxAllowed }
    }
    
    // Card must NOT be in the main deck (TAP is separate from deck)
    if (copiesInDeck > 0) {
      return { canAdd: false, reason: "Carta ja esta no Deck", maxAllowed }
    }
    
    // Check total copies used (deck + tap) vs owned
    const totalUsed = copiesInDeck + copiesInTap
    if (totalUsed >= ownedCopies) {
      return { canAdd: false, reason: `Voce possui apenas ${ownedCopies}`, maxAllowed }
    }
    
    if (copiesInTap >= maxAllowed) {
      return { canAdd: false, reason: `Max ${MAX_COPIES_PER_TAP_CARD} copias`, maxAllowed }
    }
    
    return { canAdd: true, maxAllowed }
  }
  
  const addToTap = (card: Card) => {
    const { canAdd } = canAddCardToTap(card)
    if (!canAdd) return
    setTapCards([...tapCards, { ...card, id: `${card.id}-tap-${Date.now()}` }])
  }
  
  const removeFromTap = (index: number) => {
    setTapCards(tapCards.filter((_, i) => i !== index))
  }
  
  // Unified add card function based on target area
  const handleAddCard = (card: Card) => {
    if (targetArea === "deck") {
      addCardToDeck(card)
    } else {
      addToTap(card)
    }
  }
  
  // Get validation based on target area
  const getCardValidation = (card: Card) => {
    if (targetArea === "deck") {
      return canAddCardToDeck(card)
    } else {
      return canAddCardToTap(card)
    }
  }
  
  // Get copies count based on target area
  const getCopiesInTarget = (card: Card) => {
    if (targetArea === "deck") {
      return getCardCopiesInDeck(card)
    } else {
      return getCardCopiesInTap(card)
    }
  }

  const getCurrentPlaymat = () => {
    if (useGlobalPlaymat && globalPlaymatId) {
      return ownedPlaymats.find((p) => p.id === globalPlaymatId)
    }
    if (selectedPlaymatId) {
      return ownedPlaymats.find((p) => p.id === selectedPlaymatId)
    }
    return null
  }

  if (!isCreating) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-indigo-900/20 to-black">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-indigo-400/30 rounded-full animate-float"
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
        <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-r from-black/80 via-indigo-900/50 to-black/80 border-b border-indigo-500/30 backdrop-blur-sm">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            {t("back")}
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-400" />
            {t("deckBuilder")}
          </h1>
          <div className="w-20" />
        </div>

        {/* Deck list */}
        <div className="relative z-10 flex-1 p-4 max-w-3xl mx-auto w-full">
          <Button
            onClick={startNewDeck}
            className="w-full mb-6 h-16 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 border-2 border-green-400/50 shadow-lg shadow-green-500/30 transition-all hover:scale-[1.02]"
          >
            <Plus className="mr-2 h-6 w-6" />
            {t("newDeck")}
          </Button>

          {decks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Layers className="w-16 h-16 mb-4 opacity-30" />
              <p>Nenhum deck criado ainda.</p>
              <p className="text-sm mt-2">Clique no botao acima para criar seu primeiro deck!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className="bg-gradient-to-r from-slate-800/80 to-indigo-900/50 rounded-2xl p-5 flex items-center justify-between border border-indigo-500/30 backdrop-blur-sm hover:border-indigo-400/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {deck.name}
                      </h3>
                      <p className="text-slate-400">
                        {deck.cards.length} {t("cards")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEditDeck(deck)}
                      className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50"
                    >
                      Editar
                    </Button>
                    <Button
                      onClick={() => handleDeleteDeck(deck.id)}
                      variant="destructive"
                      className="border border-red-400/50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative z-10 p-4 max-w-3xl mx-auto w-full">
          <div className="bg-gradient-to-r from-slate-800/80 to-indigo-900/50 rounded-2xl p-4 border border-indigo-500/30 backdrop-blur-sm mb-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-400" />
              Playmat Global
            </h3>
            <p className="text-sm text-slate-400 mb-3">Selecione um tapete de duelo padrao para todos os seus decks</p>

            {ownedPlaymats.length === 0 ? (
              <p className="text-slate-500 text-sm">Voce ainda nao possui playmats. Resgate-os na Gift Box!</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* None option */}
                <div
                  onClick={() => setGlobalPlaymat(null)}
                  className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${
                    !globalPlaymatId
                      ? "border-green-400 ring-2 ring-green-400/50"
                      : "border-slate-600 hover:border-slate-400"
                  }`}
                >
                  <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                    <span className="text-slate-400">Nenhum</span>
                  </div>
                  {!globalPlaymatId && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                {ownedPlaymats.map((playmat) => (
                  <div
                    key={playmat.id}
                    onClick={() => setGlobalPlaymat(playmat.id)}
                    className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${
                      globalPlaymatId === playmat.id
                        ? "border-green-400 ring-2 ring-green-400/50"
                        : "border-slate-600 hover:border-slate-400"
                    }`}
                  >
                    <Image src={playmat.image || "/placeholder.svg"} alt={playmat.name} fill sizes="(max-width: 768px) 50vw, 200px" className="object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white font-bold truncate">{playmat.name}</p>
                    </div>
                    {globalPlaymatId === playmat.id && (
                      <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-indigo-900/20 to-black">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-r from-black/80 via-indigo-900/50 to-black/80 border-b border-indigo-500/30 backdrop-blur-sm">
        <Button onClick={() => setIsCreating(false)} variant="ghost" className="text-indigo-400 hover:text-indigo-300">
          <ArrowLeft className="mr-2 h-5 w-5" />
          {t("back")}
        </Button>
        <Input
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          placeholder={t("deckName")}
          className="max-w-xs bg-slate-900/80 border-indigo-500/50 text-white text-center font-bold"
        />
        <Button
          onClick={handleSaveDeck}
          className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 border border-green-400/50"
        >
          <Save className="mr-2 h-4 w-4" />
          {t("saveDeck")}
        </Button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col lg:flex-row">
        {/* Available cards */}
        <div className="flex-1 flex flex-col border-r border-indigo-500/30">
          {/* Filters */}
          <div className="p-3 bg-black/50 flex flex-wrap gap-2 items-center border-b border-indigo-500/20">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("filterByName")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900/80 border-indigo-500/30 text-white text-sm"
              />
            </div>
            <Select value={filterRarity} onValueChange={setFilterRarity}>
              <SelectTrigger className="w-28 bg-slate-900/80 border-indigo-500/30 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allRarities")}</SelectItem>
                <SelectItem value="R">R</SelectItem>
                <SelectItem value="SR">SR</SelectItem>
                <SelectItem value="UR">UR</SelectItem>
                <SelectItem value="LR">LR</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 bg-slate-900/80 border-indigo-500/30 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTypes")}</SelectItem>
                <SelectItem value="unit">{t("unit")}</SelectItem>
                <SelectItem value="troops">Unid. Tropas</SelectItem>
                <SelectItem value="magic">{t("magic")}</SelectItem>
                <SelectItem value="action">{t("action")}</SelectItem>
                <SelectItem value="ultimateGear">{t("ultimateGear")}</SelectItem>
                <SelectItem value="ultimateGuardian">Ult. Guardian</SelectItem>
                <SelectItem value="trap">Trap</SelectItem>
                <SelectItem value="item">{t("item")}</SelectItem>
                <SelectItem value="scenario">Cenario</SelectItem>
                <SelectItem value="brotherhood">Irmandade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Card grid */}
          <div className="flex-1 p-3 overflow-y-auto">
            <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2">
                {filteredCards.map((card) => {
                  const copiesInTarget = getCopiesInTarget(card)
                  const { canAdd, maxAllowed, reason } = getCardValidation(card)
                  const isAtLimit = copiesInTarget >= maxAllowed

                  return (
                    <div
                      key={card.id}
                      draggable={canAdd}
                      onClick={() => canAdd && handleAddCard(card)}
                      onMouseDown={() => handleCardMouseDown(card)}
                      onMouseUp={handleCardMouseUp}
                      onMouseLeave={handleCardMouseLeave}
                      onTouchStart={() => handleCardMouseDown(card)}
                      onTouchEnd={handleCardMouseUp}
                      onDragStart={(e) => {
                        if (canAdd) {
                          setDraggedCard(card)
                          e.dataTransfer.effectAllowed = "copy"
                        }
                      }}
                      onDragEnd={() => setDraggedCard(null)}
                      className={`relative aspect-[3/4] rounded-lg overflow-hidden shadow-lg transition-all duration-200 select-none ${
                        canAdd ? "cursor-pointer transform hover:scale-110 hover:z-10" : "cursor-not-allowed opacity-50 grayscale"
                      } ${
                        card.rarity === "LR"
                          ? "ring-2 ring-red-400"
                          : card.rarity === "UR"
                            ? "ring-2 ring-yellow-400"
                            : card.rarity === "SR"
                              ? "ring-1 ring-purple-400"
                              : ""
                      } ${targetArea === "tap" && canAdd ? "hover:ring-2 hover:ring-cyan-400" : ""}`}
                      title={!canAdd ? reason : `Clique para adicionar ao ${targetArea.toUpperCase()}, segure para zoom (${copiesInTarget}/${maxAllowed})`}
                    >
                      <Image src={getActiveSkin(card.image || "")} alt={card.name} fill sizes="80px" className="object-cover pointer-events-none" />
                      
                      {/* Target indicator */}
                      {targetArea === "tap" && (
                        <div className="absolute top-1 left-1 bg-cyan-500 rounded px-1 py-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      
                      {/* Copies indicator: X/Y (in target / max allowed) */}
                      <div className={`absolute top-1 right-1 text-white text-xs px-1.5 py-0.5 rounded-full font-bold shadow-lg ${
                        isAtLimit ? "bg-red-600" : copiesInTarget > 0 ? (targetArea === "tap" ? "bg-cyan-600" : "bg-indigo-600") : "bg-slate-700/80"
                      }`}>
                        {copiesInTarget}/{maxAllowed}
                      </div>

                      {/* Lock icon when at limit */}
                      {isAtLimit && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="bg-red-600 rounded-full p-1.5">
                            <X className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* Current deck */}
        <div className="w-full lg:w-80 flex flex-col bg-gradient-to-b from-indigo-900/30 to-slate-900/50">
          {/* Target Area Toggle */}
          <div className="p-2 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-b border-indigo-500/30">
            <p className="text-[10px] text-slate-400 text-center mb-2">Selecione onde adicionar cartas:</p>
            <div className="flex gap-2">
              <button
                onClick={() => setTargetArea("deck")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  targetArea === "deck"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105"
                    : "bg-slate-700/50 text-slate-400 hover:bg-slate-600/50"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                DECK
                {targetArea === "deck" && <Check className="w-3 h-3" />}
              </button>
              <button
                onClick={() => setTargetArea("tap")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  targetArea === "tap"
                    ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-500/30 scale-105"
                    : "bg-slate-700/50 text-slate-400 hover:bg-slate-600/50"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                TAP
                {targetArea === "tap" && <Check className="w-3 h-3" />}
              </button>
            </div>
          </div>
          
          <div className="p-4 border-b border-indigo-500/30 bg-black/30">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">{deckName || t("newDeck")}</h3>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                <span className={deckCards.length >= MIN_CARDS ? "text-green-400" : "text-amber-400"}>
                  {deckCards.length}
                </span>
                /{MAX_CARDS} {t("cards")}
              </p>
              {deckCards.length < MIN_CARDS && <p className="text-xs text-amber-400">Min: {MIN_CARDS}</p>}
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  deckCards.length >= MIN_CARDS
                    ? "bg-gradient-to-r from-green-500 to-emerald-400"
                    : "bg-gradient-to-r from-amber-500 to-yellow-400"
                }`}
                style={{ width: `${(deckCards.length / MAX_CARDS) * 100}%` }}
              />
            </div>
          </div>

          {/* TAP Section */}
          <div className={`p-3 border-b transition-all ${
            targetArea === "tap" 
              ? "border-cyan-400 bg-cyan-900/20" 
              : "border-cyan-500/20"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                TAP ({tapCards.length}/{MAX_TAP_CARDS})
              </span>
              <span className="text-[9px] text-cyan-300/60">Max 4 copias/carta</span>
            </div>
            
            {/* TAP Cards Display - Same size as Deck cards */}
            {tapCards.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {tapCards.map((card, index) => (
                  <div 
                    key={`tap-display-${card.id}-${index}`}
                    onClick={() => removeFromTap(index)}
                    className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-cyan-500/60 shadow-lg cursor-pointer transform hover:scale-105 transition-all group"
                    title="Clique para remover"
                  >
                    <Image
                      src={card.image || "/placeholder.svg"}
                      alt={card.name}
                      fill
                      sizes="(max-width: 768px) 20vw, 60px"
                      className="object-cover"
                    />
                    {/* Cyan glow effect for TAP cards */}
                    <div className="absolute inset-0 ring-1 ring-inset ring-cyan-400/30 rounded-lg" />
                    {/* Hover overlay with remove icon */}
                    <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/70 transition-colors flex items-center justify-center">
                      <X className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                    {/* TAP indicator badge */}
                    <div className="absolute top-1 left-1 bg-cyan-500/90 rounded px-1 py-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-4 border border-dashed border-cyan-500/30 rounded-lg">
                Nenhuma carta no TAP
              </div>
            )}
          </div>

          <div className="p-3 border-b border-indigo-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                Playmat
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPlaymatSelector(!showPlaymatSelector)}
                className="text-indigo-400 hover:text-indigo-300 text-xs"
              >
                {showPlaymatSelector ? "Fechar" : "Alterar"}
              </Button>
            </div>

            {/* Current playmat preview */}
            <div className="relative aspect-video rounded-lg overflow-hidden border border-indigo-500/30">
              {getCurrentPlaymat() ? (
                <Image
                  src={getCurrentPlaymat()!.image || "/placeholder.svg"}
                  alt={getCurrentPlaymat()!.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 300px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                  <span className="text-slate-500 text-xs">Sem playmat</span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-xs text-white">
                  {useGlobalPlaymat ? "Usando Global" : getCurrentPlaymat()?.name || "Nenhum"}
                </p>
              </div>
            </div>

            {/* Playmat selector dropdown */}
            {showPlaymatSelector && (
              <div className="mt-2 space-y-2">
                {/* Use global toggle */}
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useGlobalPlaymat}
                    onChange={(e) => setUseGlobalPlaymat(e.target.checked)}
                    className="rounded border-indigo-500"
                  />
                  Usar playmat global
                </label>

                {!useGlobalPlaymat && (
                  <div className="grid grid-cols-2 gap-2">
                    {/* None option */}
                    <div
                      onClick={() => setSelectedPlaymatId(null)}
                      className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border ${
                        !selectedPlaymatId ? "border-green-400" : "border-slate-600"
                      }`}
                    >
                      <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                        <span className="text-slate-500 text-xs">Nenhum</span>
                      </div>
                    </div>

                    {ownedPlaymats.map((playmat) => (
                      <div
                        key={playmat.id}
                        onClick={() => setSelectedPlaymatId(playmat.id)}
                        className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border ${
                          selectedPlaymatId === playmat.id ? "border-green-400" : "border-slate-600"
                        }`}
                      >
                        <Image
                          src={playmat.image || "/placeholder.svg"}
                          alt={playmat.name}
                          fill
                          sizes="100px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

  {/* Deck cards grid - Drop Zone */}
  <div 
    className={`flex-1 p-3 overflow-y-auto transition-colors ${
      isDeckDropZone ? "bg-green-500/20 ring-2 ring-green-400 ring-inset" : ""
    }`}
    onDragOver={(e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
      setIsDeckDropZone(true)
    }}
    onDragLeave={() => setIsDeckDropZone(false)}
    onDrop={(e) => {
      e.preventDefault()
      setIsDeckDropZone(false)
      if (draggedCard) {
        const { canAdd } = canAddCardToDeck(draggedCard)
        if (canAdd) {
          addCardToDeck(draggedCard)
        }
        setDraggedCard(null)
      }
    }}
  >
    {isDeckDropZone && (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="bg-green-500/90 text-white font-bold px-4 py-2 rounded-lg shadow-lg">
          Solte para adicionar
        </div>
      </div>
    )}
  <div className="grid grid-cols-4 gap-2">
  {deckCards.map((card, index) => (
  <div
  key={`${card.id}-${index}`}
  onClick={() => removeCardFromDeck(index)}
  onMouseDown={() => handleCardMouseDown(card)}
  onMouseUp={handleCardMouseUp}
  onMouseLeave={handleCardMouseLeave}
  onTouchStart={() => handleCardMouseDown(card)}
  onTouchEnd={handleCardMouseUp}
  className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-lg cursor-pointer transform hover:scale-110 transition-all group"
  title="Clique para remover, segure para zoom"
  >
  <Image src={card.image || "/placeholder.svg"} alt={card.name} fill sizes="60px" className="object-cover pointer-events-none" />
  <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/60 transition-colors flex items-center justify-center">
  <X className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
  </div>
  </div>
  ))}
  </div>
  </div>
  </div>
  </div>
  
  {/* Card zoom modal with skin system */}
  {zoomedCard && (() => {
    const cardSkins    = getSkinsForCard(zoomedCard.image || "")
    const hasSkins     = cardSkins !== null && cardSkins.length > 0
    const activeSkinId = (() => {
      try {
        const fn  = (zoomedCard.image || "").split("/").pop() ?? ""
        const raw = localStorage.getItem("gpgame_active_skins") ?? "{}"
        return (JSON.parse(raw) as Record<string,string>)[fn] ?? null
      } catch { return null }
    })()
    const displayImg = getActiveSkin(zoomedCard.image || "")

    return (
      <div
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex z-50"
        style={{ alignItems:"center", justifyContent:"center" }}
      >
        {/* Backdrop click closes */}
        <div className="absolute inset-0" onClick={() => { setZoomedCard(null); setShowSkinPanel(false) }}/>

        {/* Card + skin panel side by side */}
        <div style={{ position:"relative", display:"flex", alignItems:"center", gap:16, padding:16, zIndex:1 }}>

          {/* Card */}
          <div className="relative animate-float" style={{ width:"min(85vw,320px)", aspectRatio:"3/4" }}>
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-500 to-purple-500 opacity-30" />
            <Image
              src={displayImg || "/placeholder.svg"}
              alt={zoomedCard.name}
              fill
              sizes="320px"
              className={`object-contain rounded-2xl ${
                zoomedCard.rarity === "LR" ? "rarity-lr"
                : zoomedCard.rarity === "UR" ? "rarity-ur"
                : zoomedCard.rarity === "SR" ? "rarity-sr"
                : "rarity-r"
              }`}
            />
            {/* SKIN button — only if card has skins */}
            {hasSkins && (
              <button
                onClick={e => { e.stopPropagation(); setShowSkinPanel(v => !v) }}
                style={{
                  position:"absolute", right:-52, top:"50%", transform:"translateY(-50%)",
                  background: showSkinPanel
                    ? "linear-gradient(135deg,#7a5c0f,#e8c96d)"
                    : "rgba(232,201,109,0.12)",
                  border:"2px solid rgba(232,201,109,0.60)",
                  borderRadius:12, padding:"10px 8px", cursor:"pointer",
                  writingMode:"vertical-rl", textOrientation:"mixed",
                  color: showSkinPanel ? "#0c0a06" : "#e8c96d",
                  fontWeight:900, fontSize:11, letterSpacing:"0.10em",
                  boxShadow: showSkinPanel ? "0 4px 16px rgba(232,201,109,0.4)" : "none",
                  transition:"all 0.2s",
                }}>
                SKIN
              </button>
            )}
          </div>

          {/* Skin panel */}
          {hasSkins && showSkinPanel && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background:"rgba(10,8,6,0.97)", border:"1px solid rgba(232,201,109,0.25)",
                borderRadius:16, padding:14, width:180,
                display:"flex", flexDirection:"column", gap:10,
                boxShadow:"0 8px 32px rgba(0,0,0,0.7)",
              }}>
              <div style={{ fontWeight:900, fontSize:12, color:"#e8c96d",
                letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:4 }}>
                🃏 Skins
              </div>

              {/* Original art option */}
              <button
                onClick={() => { setActiveSkin(zoomedCard.image || "", null); setSkinRefresh(v=>v+1) }}
                style={{
                  display:"flex", flexDirection:"column", gap:6, padding:8,
                  background: activeSkinId === null ? "rgba(232,201,109,0.10)" : "rgba(255,255,255,0.03)",
                  border:`1px solid ${activeSkinId === null ? "rgba(232,201,109,0.40)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius:10, cursor:"pointer", textAlign:"left",
                }}>
                <div style={{ position:"relative", width:"100%", aspectRatio:"3/4", borderRadius:8, overflow:"hidden",
                  border: activeSkinId === null ? "2px solid #e8c96d" : "2px solid transparent" }}>
                  <Image src={zoomedCard.image || "/placeholder.svg"} alt="Original" fill
                    style={{ objectFit:"contain" }}/>
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:10, fontWeight:700, color:"#f1f0ee" }}>Arte Original</span>
                  {activeSkinId === null && <span style={{ fontSize:10, color:"#e8c96d" }}>✓</span>}
                </div>
              </button>

              {/* Each skin option */}
              {cardSkins!.map(skin => {
                const owned   = playerOwnsSkin(skin.id)
                const active  = activeSkinId === skin.id
                return (
                  <button
                    key={skin.id}
                    onClick={() => {
                      if (!owned) return
                      setActiveSkin(zoomedCard.image || "", skin.id)
                      setSkinRefresh(v => v+1)
                    }}
                    style={{
                      display:"flex", flexDirection:"column", gap:6, padding:8,
                      background: active ? "rgba(232,201,109,0.10)" : "rgba(255,255,255,0.03)",
                      border:`1px solid ${active ? "rgba(232,201,109,0.40)" : "rgba(255,255,255,0.07)"}`,
                      borderRadius:10, cursor: owned ? "pointer" : "not-allowed",
                      textAlign:"left", opacity: owned ? 1 : 0.7,
                    }}>
                    <div style={{ position:"relative", width:"100%", aspectRatio:"3/4", borderRadius:8, overflow:"hidden",
                      border: active ? "2px solid #e8c96d" : "2px solid transparent" }}>
                      <Image src={skin.image} alt={skin.label} fill style={{ objectFit:"contain",
                        filter: owned ? "none" : "brightness(0.35) saturate(0.3)" }}
                        onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }}/>
                      {!owned && (
                        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                          alignItems:"center", justifyContent:"center", gap:4 }}>
                          <span style={{ fontSize:18 }}>🔒</span>
                          <span style={{ fontSize:8, fontWeight:800, color:"#9ca3af",
                            textAlign:"center", lineHeight:1.3, padding:"0 4px" }}>Skin Bloqueada</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:10, fontWeight:700,
                        color: owned ? "#f1f0ee" : "#6b7280",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        maxWidth:110 }}>{skin.label}</span>
                      {active && <span style={{ fontSize:10, color:"#e8c96d" }}>✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Card info */}
        <div className="absolute bottom-6 left-0 right-0 text-center" style={{ zIndex:1 }}>
          <h3 className="text-2xl font-bold text-white mb-2">{zoomedCard.name}</h3>
          <span className={`px-4 py-1 rounded-full text-sm font-bold ${
            zoomedCard.rarity === "LR" ? "bg-gradient-to-r from-red-500 to-amber-500 text-white"
            : zoomedCard.rarity === "UR" ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black"
            : zoomedCard.rarity === "SR" ? "bg-purple-500 text-white"
            : "bg-slate-500 text-white"
          }`}>{zoomedCard.rarity}</span>
          {zoomedCard.type === "unit" && zoomedCard.dp && (
            <p className="text-cyan-400 font-bold mt-2">DP: {zoomedCard.dp}</p>
          )}
          {hasSkins && (
            <p className="text-amber-400/70 text-xs mt-2">
              ← Arraste para SKIN para ver opções
            </p>
          )}
        </div>

        <button
          onClick={() => { setZoomedCard(null); setShowSkinPanel(false) }}
          className="absolute top-4 right-4 p-2 glass rounded-full hover:bg-white/20 transition-colors"
          style={{ zIndex:1 }}>
          <X className="w-6 h-6 text-white" />
        </button>
      </div>
    )
  })()}
  </div>
  )
}
