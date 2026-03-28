"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, type Card } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Heart, Sparkles, Star } from "lucide-react"
import Image from "next/image"

interface GachaScreenProps {
  onBack: () => void
}

type BannerType = "fsg" | "anl" | "friendship"

interface PackData {
  id: number
  cards: Card[]
  isOpened: boolean
  isRevealing: boolean
  highestRarity: "R" | "SR" | "UR" | "LR"
}

const BANNERS = {
  fsg: {
    name: "Fundadores da Santa Guerra",
    code: "FSG-01",
    packImage: "/images/gacha/pack-fsg.png",
    bannerImage: "/images/gacha/fsg-anuncio.png",
    color: "from-cyan-600 via-blue-600 to-purple-600",
    accentColor: "text-cyan-400",
    glowColor: "shadow-cyan-500/40",
  },
  anl: {
    name: "Ascensao Nordica: Legends",
    code: "ANL-01",
    packImage: "/images/gacha/pack-anl.png",
    bannerImage: "/images/gacha/anl-anuncio.png",
    color: "from-orange-600 via-red-600 to-rose-600",
    accentColor: "text-orange-400",
    glowColor: "shadow-orange-500/40",
  },
  friendship: {
    name: "Gacha de Amizade",
    code: "FP-01",
    packImage: "/images/gacha/pack-fsg.png",
    bannerImage: "/images/gacha/fsg-anuncio.png",
    color: "from-pink-500 via-rose-500 to-fuchsia-500",
    accentColor: "text-pink-400",
    glowColor: "shadow-pink-500/40",
  },
}

export default function GachaScreen({ onBack }: GachaScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, addToCollection, allCards, spendableFP, spendFriendPoints } = useGame()
  const [currentBanner, setCurrentBanner] = useState<BannerType>("fsg")
  const [isOpening, setIsOpening] = useState(false)
  const [openedCards, setOpenedCards] = useState<Card[]>([])
  const [showResults, setShowResults] = useState(false)
  const [rarityTier, setRarityTier] = useState<"normal" | "rare" | "epic" | "legendary">("normal")
  const [phase, setPhase] = useState(0)
  const [fpReward, setFpReward] = useState<number | null>(null)
  const [revealIndex, setRevealIndex] = useState(-1)
  const [screenShake, setScreenShake] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const containerRef = useRef<HTMLDivElement>(null)
  
  // New pack-based animation states
  const [packs, setPacks] = useState<PackData[]>([])
  const [currentPackIndex, setCurrentPackIndex] = useState(0)
  const [packPhase, setPackPhase] = useState<"entering" | "shaking" | "opening" | "revealing" | "done">("entering")
  const [cardRevealIndex, setCardRevealIndex] = useState(-1)
  const [pullCount, setPullCount] = useState(0)

  const COST_SINGLE = 1
  const COST_MULTI = 10
  const CARDS_PER_PACK = 4
  const FP_COST = 50

  const banner = BANNERS[currentBanner]

  // Get pack rarity color based on highest card - premium glow effects
  const getPackGlowColor = (rarity: string) => {
    switch (rarity) {
      case "LR": return "rgba(239, 68, 68, 0.9)"
      case "UR": return "rgba(251, 191, 36, 0.85)"
      case "SR": return "rgba(168, 85, 247, 0.75)"
      default: return "rgba(148, 163, 184, 0.4)"
    }
  }
  
  // Get premium glow shadow for rarity
  const getPackGlowShadow = (rarity: string) => {
    switch (rarity) {
      case "LR": return "0 0 40px rgba(239, 68, 68, 0.6), 0 0 80px rgba(239, 68, 68, 0.3), 0 0 120px rgba(239, 68, 68, 0.15)"
      case "UR": return "0 0 35px rgba(251, 191, 36, 0.6), 0 0 70px rgba(251, 191, 36, 0.3), 0 0 100px rgba(251, 191, 36, 0.15)"
      case "SR": return "0 0 30px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.25), 0 0 90px rgba(168, 85, 247, 0.1)"
      default: return "0 0 20px rgba(148, 163, 184, 0.3), 0 0 40px rgba(148, 163, 184, 0.15)"
    }
  }

  const drawParticles = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    const colors: Record<string, string[]> = {
      normal: ["#64748b", "#94a3b8", "#cbd5e1"],
      rare: ["#8b5cf6", "#a78bfa", "#c4b5fd"],
      epic: ["#f59e0b", "#fbbf24", "#fcd34d"],
      legendary: ["#ef4444", "#f97316", "#fbbf24", "#eab308"],
    }

    const tierColors = colors[rarityTier]

    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      color: string
      alpha: number
      life: number
      type: "orb" | "spark" | "ring" | "meteor"
      angle?: number
      radius?: number
      speed?: number
    }

    const particles: Particle[] = []
    let time = 0

    const animate = () => {
      time++

      // Clear with fade effect
      ctx.fillStyle = packPhase === "opening" ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Ambient particles during all phases
      if (particles.length < 80 && time % 3 === 0) {
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 10,
          vx: (Math.random() - 0.5) * 2,
          vy: -2 - Math.random() * 3,
          size: 2 + Math.random() * 4,
          color: tierColors[Math.floor(Math.random() * tierColors.length)],
          alpha: 0.8,
          life: 180,
          type: "spark",
        })
      }

      // Opening explosion particles
      if (packPhase === "opening" && time < 20) {
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = 8 + Math.random() * 15
          particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 4 + Math.random() * 8,
            color: tierColors[Math.floor(Math.random() * tierColors.length)],
            alpha: 1,
            life: 60,
            type: "spark",
          })
        }
      }

      // Update and draw particles
      particles.forEach((p, i) => {
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.98
        p.vy *= 0.98
        p.alpha -= 0.008
        p.life--

        if (p.life <= 0 || p.alpha <= 0) {
          particles.splice(i, 1)
          return
        }

        const safeSize = Math.max(0.1, p.size)
        ctx.beginPath()
        ctx.arc(p.x, p.y, safeSize, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.fill()

        // Glow effect
        const glowSize = safeSize * 3
        if (glowSize > 0) {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize)
          glow.addColorStop(0, p.color)
          glow.addColorStop(1, "transparent")
          ctx.beginPath()
          ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.globalAlpha = Math.max(0, p.alpha * 0.4)
          ctx.fill()
        }
      })

      ctx.globalAlpha = 1
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()
  }, [packPhase, rarityTier])

  useEffect(() => {
    if (isOpening || showResults) {
      drawParticles()
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isOpening, showResults, drawParticles])

  // Card reveal animation
  useEffect(() => {
    if (packPhase === "revealing" && cardRevealIndex < CARDS_PER_PACK) {
      const timer = setTimeout(() => {
        setCardRevealIndex((prev) => prev + 1)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [packPhase, cardRevealIndex])

  // Auto advance to next pack or finish
  useEffect(() => {
    if (packPhase === "revealing" && cardRevealIndex >= CARDS_PER_PACK) {
      const timer = setTimeout(() => {
        if (currentPackIndex < packs.length - 1) {
          // Move to next pack
          setCurrentPackIndex((prev) => prev + 1)
          setPackPhase("entering")
          setCardRevealIndex(-1)
        } else {
          // All packs opened - show final results
          setPackPhase("done")
          setShowResults(true)
          setIsOpening(false)
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [packPhase, cardRevealIndex, currentPackIndex, packs.length])

  // Pack phase progression
  useEffect(() => {
    if (!isOpening || packs.length === 0) return

    if (packPhase === "entering") {
      const timer = setTimeout(() => setPackPhase("shaking"), 600)
      return () => clearTimeout(timer)
    }
    if (packPhase === "shaking") {
      setScreenShake(true)
      const timer = setTimeout(() => {
        setScreenShake(false)
        setPackPhase("opening")
      }, 800)
      return () => clearTimeout(timer)
    }
    if (packPhase === "opening") {
      const timer = setTimeout(() => {
        setPackPhase("revealing")
        setCardRevealIndex(0)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [packPhase, isOpening, packs.length])

  const pullGacha = (count: number) => {
    const totalCost = count === 1 ? COST_SINGLE : COST_MULTI
    if (coins < totalCost) return

    setCoins(coins - totalCost)
    setIsOpening(true)
    setPullCount(count)
    setCurrentPackIndex(0)
    setPackPhase("entering")
    setCardRevealIndex(-1)
    setRevealIndex(-1)

    const numPacks = count
    const newPacks: PackData[] = []
    const allPulledCards: Card[] = []

    for (let packNum = 0; packNum < numPacks; packNum++) {
      const packCards: Card[] = []
      
      for (let i = 0; i < CARDS_PER_PACK; i++) {
        const rand = Math.random() * 100
        let targetRarity: "R" | "SR" | "UR" | "LR"

        if (rand < 0.5) targetRarity = "LR"
        else if (rand < 5) targetRarity = "UR"
        else if (rand < 30) targetRarity = "SR"
        else targetRarity = "R"

        let availableCards = allCards.filter((c) => c.rarity === targetRarity)
        if (availableCards.length === 0) {
          availableCards = allCards
        }

        const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)]
        const card = { ...randomCard, id: `${randomCard.id}-${Date.now()}-${packNum}-${i}` }
        packCards.push(card)
        allPulledCards.push(card)
      }

      // Determine highest rarity in pack
      const rarities = ["R", "SR", "UR", "LR"] as const
      let highestRarity: "R" | "SR" | "UR" | "LR" = "R"
      for (const card of packCards) {
        if (rarities.indexOf(card.rarity) > rarities.indexOf(highestRarity)) {
          highestRarity = card.rarity
        }
      }

      newPacks.push({
        id: packNum,
        cards: packCards,
        isOpened: false,
        isRevealing: false,
        highestRarity,
      })
    }

    // Set overall rarity tier
    const hasLR = allPulledCards.some((c) => c.rarity === "LR")
    const hasUR = allPulledCards.some((c) => c.rarity === "UR")
    const hasSR = allPulledCards.some((c) => c.rarity === "SR")

    if (hasLR) setRarityTier("legendary")
    else if (hasUR) setRarityTier("epic")
    else if (hasSR) setRarityTier("rare")
    else setRarityTier("normal")

    setPacks(newPacks)
    setOpenedCards(allPulledCards)
    addToCollection(allPulledCards)
  }

  const pullFriendshipGacha = () => {
    if (spendableFP < FP_COST) return
    if (!spendFriendPoints(FP_COST)) return

    setIsOpening(true)
    setPhase(1)

    const isLucky = Math.random() < 0.2
    const reward = isLucky ? 3000 : 300

    setRarityTier(isLucky ? "legendary" : "rare")

    setTimeout(() => setPhase(2), 1200)
    setTimeout(() => setPhase(3), 2400)
    setTimeout(() => {
      setPhase(4)
      setShowResults(true)
      setIsOpening(false)
      setFpReward(reward)
      setCoins(coins + reward)
    }, 3200)
  }

  const closeResults = () => {
    setShowResults(false)
    setOpenedCards([])
    setFpReward(null)
    setPhase(0)
    setRevealIndex(-1)
    setRarityTier("normal")
    setPacks([])
    setCurrentPackIndex(0)
    setPackPhase("entering")
    setCardRevealIndex(-1)
    setPullCount(0)
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "LR":
        return "from-red-500 via-amber-500 to-red-500"
      case "UR":
        return "from-amber-400 to-yellow-500"
      case "SR":
        return "from-purple-500 to-pink-500"
      default:
        return "from-slate-500 to-slate-600"
    }
  }

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case "LR":
        return "0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(251,191,36,0.5)"
      case "UR":
        return "0 0 25px rgba(251,191,36,0.7)"
      case "SR":
        return "0 0 20px rgba(168,85,247,0.6)"
      default:
        return "none"
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Ultra Premium Background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950" />
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 100% 60% at 50% -10%, rgba(168, 85, 247, 0.2) 0%, transparent 60%),
              radial-gradient(ellipse 80% 50% at 80% 110%, rgba(56, 189, 248, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 10% 90%, rgba(251, 191, 36, 0.08) 0%, transparent 40%)
            `,
          }}
        />
        <div className="absolute inset-0 morph-bg opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.5)_100%)]" />
      </div>
      
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => {
          const colors = ["#38bdf8", "#a855f7", "#fbbf24", "#22d3ee", "#f472b6"]
          const color = colors[i % colors.length]
          const size = 2 + (i % 4)
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${(i * 5) % 100}%`,
                top: `${(i * 12) % 100}%`,
                background: color,
                boxShadow: `0 0 ${size * 4}px ${color}80`,
                animation: `floatParticle ${8 + (i % 6)}s ease-in-out ${i * 0.5}s infinite`,
              }}
            />
          )
        })}
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-r from-black/80 via-purple-900/50 to-black/80 border-b border-cyan-500/30 backdrop-blur-sm">
        <Button onClick={onBack} variant="ghost" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
          <ArrowLeft className="mr-2 h-5 w-5" />
          {t("back")}
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
          GACHA
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-slate-800/90 to-slate-700/90 px-4 py-2 rounded-full border border-cyan-400/30 shadow-lg">
            <div className="w-10 h-10 relative -my-1">
              <Image src="/images/icons/gacha-coin.png" alt="Gacha Coin" width={40} height={40} className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <span className="font-bold text-white text-lg">{coins}</span>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-pink-600/90 to-rose-500/90 px-4 py-2 rounded-full border border-pink-400/50 shadow-lg shadow-pink-500/20">
            <Heart className="w-5 h-5 text-white fill-white" />
            <span className="font-bold text-white">{spendableFP} FP</span>
          </div>
        </div>
      </div>

      {/* Banner tabs */}
      <div className="relative z-10 flex justify-center gap-2 p-4">
        {(["fsg", "anl", "friendship"] as BannerType[]).map((bannerKey) => (
          <Button
            key={bannerKey}
            onClick={() => setCurrentBanner(bannerKey)}
            className={`px-6 py-3 font-bold transition-all duration-300 ${
              currentBanner === bannerKey
                ? `bg-gradient-to-r ${BANNERS[bannerKey].color} scale-110 shadow-lg border-2 border-white/30`
                : "bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50"
            }`}
          >
            {bannerKey === "friendship" && <Heart className="w-4 h-4 mr-1 fill-current" />}
            {bannerKey === "fsg" && <Star className="w-4 h-4 mr-1" />}
            {bannerKey === "anl" && <Sparkles className="w-4 h-4 mr-1" />}
            {bannerKey.toUpperCase()}
          </Button>
        ))}
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        {currentBanner !== "friendship" ? (
          <>
            {/* Normal Banner */}
            <div className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-cyan-500/30 mb-6 group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
              <Image
                src={banner.bannerImage || "/placeholder.svg"}
                alt={banner.name}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>

            <div className="text-center mb-4">
              <h2 className={`text-3xl font-bold ${banner.accentColor} drop-shadow-lg`}>{banner.name}</h2>
              <p className="text-white/70 text-sm mt-2 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />4 cartas por pack - Todas as raridades disponiveis
                <Sparkles className="w-4 h-4" />
              </p>
              <p className="text-slate-500 text-xs mt-1">Codigo: {banner.code}</p>
            </div>

            <div className="flex gap-4 mt-4">
              <Button
                onClick={() => pullGacha(1)}
                disabled={coins < COST_SINGLE || isOpening}
                className="group relative px-10 py-5 text-lg font-bold bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 disabled:opacity-50 border-2 border-amber-400/50 shadow-lg shadow-amber-500/30 transition-all hover:scale-105 hover:shadow-amber-500/50"
              >
  <span className="relative z-10 flex items-center gap-2">
  {t("gacha1")}
  <Image src="/images/icons/gacha-coin.png" alt="Coin" width={32} height={32} className="w-8 h-8 object-contain" />
  {COST_SINGLE}
  </span>
              </Button>
              <Button
                onClick={() => pullGacha(10)}
                disabled={coins < COST_MULTI || isOpening}
                className="group relative px-10 py-5 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:opacity-50 border-2 border-purple-400/50 shadow-lg shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-purple-500/50"
              >
  <span className="relative z-10 flex items-center gap-2">
  {t("gacha10")}
  <Image src="/images/icons/gacha-coin.png" alt="Coin" width={32} height={32} className="w-8 h-8 object-contain" />
  {COST_MULTI}
  </span>
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                  HOT
                </span>
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Friendship Gacha */}
            <div className="relative w-full max-w-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-rose-500/20 blur-3xl" />
              <div className="relative bg-gradient-to-br from-pink-900/60 to-rose-900/60 rounded-3xl p-8 border-2 border-pink-500/40 text-center backdrop-blur-sm shadow-2xl shadow-pink-500/20">
                <div className="mb-6 relative">
                  <div className="absolute inset-0 bg-pink-400/20 blur-2xl rounded-full" />
                  <Heart className="relative w-24 h-24 mx-auto text-pink-400 fill-pink-400 animate-pulse drop-shadow-lg" />
                </div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-pink-400 via-rose-300 to-pink-400 bg-clip-text text-transparent mb-3">
                  Gacha de Amizade
                </h2>
                <p className="text-pink-200/80 mb-6 text-lg">Use seus Pontos de Afinidade para ganhar Moedas!</p>
                <div className="bg-black/40 rounded-2xl p-5 mb-6 border border-pink-500/20">
                  <p className="text-slate-300 text-sm mb-3 font-medium">Recompensas possiveis:</p>
                  <div className="flex justify-center gap-8">
  <div className="text-center">
  <div className="flex items-center justify-center gap-1">
  <Image src="/images/icons/gacha-coin.png" alt="Coin" width={32} height={32} className="w-8 h-8 object-contain" />
  <p className="text-amber-400 font-bold text-2xl">300</p>
  </div>
  <p className="text-xs text-slate-400 mt-1">Sorte Normal (80%)</p>
  </div>
  <div className="text-center relative">
  <div className="absolute inset-0 bg-yellow-400/20 blur-xl rounded-full" />
  <div className="relative flex items-center justify-center gap-1">
  <Image src="/images/icons/gacha-coin.png" alt="Coin" width={36} height={36} className="w-9 h-9 object-contain" />
  <p className="text-yellow-300 font-bold text-2xl animate-pulse">3.000</p>
  </div>
  <p className="text-xs text-slate-400 mt-1">Sorte Grande (20%)</p>
  </div>
                  </div>
                </div>
                <p className="text-xs text-pink-300/60 mb-6">
                  * Os FP gastos aqui nao afetam sua barra de afinidade com amigos
                </p>
                <Button
                  onClick={pullFriendshipGacha}
                  disabled={spendableFP < FP_COST || isOpening}
                  className="px-10 py-5 text-lg font-bold bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 disabled:opacity-50 border-2 border-pink-400/50 shadow-lg shadow-pink-500/30 transition-all hover:scale-105"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Puxar
                  <Heart className="w-5 h-5 ml-2 fill-white" />
                  {FP_COST} FP
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cinematic Opening Overlay */}
      {(isOpening || showResults) && currentBanner !== "friendship" && (
        <div ref={containerRef} className={`fixed inset-0 z-50 bg-gradient-to-b from-slate-900 via-black to-slate-900 ${screenShake ? "animate-shake" : ""}`}>
          {/* Canvas for particle system */}
          <canvas ref={canvasRef} className="absolute inset-0" />

          {/* Pack counter */}
          {packs.length > 1 && packPhase !== "done" && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
              <div className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20">
                <span className="text-white font-bold text-lg">
                  Pack {currentPackIndex + 1} / {packs.length}
                </span>
              </div>
            </div>
          )}

          {/* Skip button */}
          {packPhase !== "done" && (
            <Button
              onClick={() => {
                setPackPhase("done")
                setShowResults(true)
                setIsOpening(false)
              }}
              className="absolute top-6 right-6 z-30 bg-white/10 hover:bg-white/20 border border-white/30"
            >
              Pular Tudo
            </Button>
          )}

          {/* Pack Opening Animation */}
          {packPhase !== "done" && packs[currentPackIndex] && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Current Pack */}
              <div className="relative">
                {/* Pack glow based on highest rarity */}
                <div
                  className="absolute inset-0 blur-3xl rounded-3xl transition-all duration-500"
                  style={{
                    background: getPackGlowColor(packs[currentPackIndex].highestRarity),
                    opacity: packPhase === "opening" ? 1 : 0.6,
                    transform: packPhase === "opening" ? "scale(2)" : "scale(1.3)",
                  }}
                />

                {/* Pack image */}
                <div
                  className="relative w-52 h-80 transition-all duration-500"
                  style={{
                    animation:
                      packPhase === "entering"
                        ? "packEnter 0.6s ease-out forwards"
                        : packPhase === "shaking"
                          ? "packShake 0.1s ease-in-out infinite"
                          : packPhase === "opening"
                            ? "packOpen 0.6s ease-out forwards"
                            : undefined,
                  }}
                >
                  <Image
                    src={banner.packImage || "/placeholder.svg"}
                    alt="Pack"
                    fill
                    sizes="320px"
                    className="object-contain drop-shadow-2xl"
                    style={{
                      filter: `drop-shadow(0 0 40px ${getPackGlowColor(packs[currentPackIndex].highestRarity)})`,
                    }}
                  />
                </div>

                {/* Opening burst effect */}
                {packPhase === "opening" && (
                  <>
                    <div className="absolute inset-0 bg-white rounded-3xl" style={{ animation: "flashOut 0.4s ease-out forwards" }} />
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-1/2 top-1/2 w-1 h-32 bg-gradient-to-t from-transparent via-white to-transparent"
                        style={{
                          transform: `rotate(${i * 30}deg) translateY(-50%)`,
                          transformOrigin: "center bottom",
                          animation: "burstRay 0.5s ease-out forwards",
                          opacity: 0,
                          animationDelay: `${i * 0.02}s`,
                        }}
                      />
                    ))}
                  </>
                )}
              </div>

              {/* Pack text */}
              <p
                className="mt-8 text-2xl font-bold text-white/90 tracking-wider"
                style={{ animation: "fadeIn 0.3s ease-out forwards" }}
              >
                {packPhase === "entering" && "Preparando pack..."}
                {packPhase === "shaking" && "Abrindo..."}
                {packPhase === "opening" && (
                  <span className={`${
                    packs[currentPackIndex].highestRarity === "LR" ? "text-red-400" :
                    packs[currentPackIndex].highestRarity === "UR" ? "text-amber-400" :
                    packs[currentPackIndex].highestRarity === "SR" ? "text-purple-400" : "text-slate-400"
                  }`}>
                    {packs[currentPackIndex].highestRarity === "LR" && "LENDARIO!"}
                    {packs[currentPackIndex].highestRarity === "UR" && "ULTRA RARO!"}
                    {packs[currentPackIndex].highestRarity === "SR" && "SUPER RARO!"}
                    {packs[currentPackIndex].highestRarity === "R" && "Cartas obtidas!"}
                  </span>
                )}
              </p>

              {/* Cards reveal for current pack */}
              {packPhase === "revealing" && (
                <div className="mt-8 flex gap-5 justify-center" style={{ animation: "cardsSlideUp 0.4s ease-out forwards" }}>
                  {packs[currentPackIndex].cards.map((card, idx) => {
                    const isRevealed = idx <= cardRevealIndex
                    return (
                      <div key={`${card.id}-reveal-${idx}`} className="flex flex-col items-center gap-2">
                        {/* Card with 3D flip */}
                        <div
                          className="relative w-24 h-36 md:w-28 md:h-40"
                          style={{
                            perspective: "1000px",
                            opacity: idx <= cardRevealIndex + 1 ? 1 : 0,
                            transition: "opacity 0.3s ease-out",
                          }}
                        >
                          <div
                            className="relative w-full h-full"
                            style={{
                              transformStyle: "preserve-3d",
                              transform: isRevealed ? "rotateY(0deg)" : "rotateY(180deg)",
                              transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                          >
                            {/* Card Front */}
                            <div
                              className="absolute inset-0 overflow-hidden"
                              style={{
                                backfaceVisibility: "hidden",
                                boxShadow: isRevealed ? getRarityGlow(card.rarity) : "none",
                              }}
                            >
                              {/* Shine effect */}
                              {isRevealed && (
                                <div
                                  className="absolute inset-0 z-20 bg-gradient-to-r from-transparent via-white/60 to-transparent pointer-events-none"
                                  style={{
                                    transform: "translateX(-100%)",
                                    animation: "shineAcross 0.5s ease-out forwards",
                                    animationDelay: "0.3s",
                                  }}
                                />
                              )}

                              <Image src={card.image || "/placeholder.svg"} alt={card.name} fill sizes="(max-width: 768px) 25vw, 128px" className="object-cover" />

                              {/* LR rainbow border */}
                              {card.rarity === "LR" && isRevealed && (
                                <div
                                  className="absolute inset-0 pointer-events-none"
                                  style={{
                                    background: "linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
                                    backgroundSize: "200% 100%",
                                    animation: "rainbowShift 2s linear infinite",
                                    padding: "3px",
                                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                    WebkitMaskComposite: "xor",
                                    maskComposite: "exclude",
                                  }}
                                />
                              )}

                              {/* UR golden glow */}
                              {card.rarity === "UR" && isRevealed && (
                                <div
                                  className="absolute inset-0 pointer-events-none border-2 border-amber-400/80"
                                  style={{ animation: "pulseGlow 1.5s ease-in-out infinite" }}
                                />
                              )}
                            </div>

                            {/* Card Back */}
                            <div
                              className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center"
                              style={{
                                backfaceVisibility: "hidden",
                                transform: "rotateY(180deg)",
                              }}
                            >
                              <div className="w-[85%] h-[90%] border-2 border-slate-600 bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-amber-400 flex items-center justify-center">
                                  <span className="text-white font-bold text-lg md:text-xl">G</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Rarity badge below card */}
                        <div
                          className={`px-3 py-1 text-center text-sm font-bold bg-gradient-to-r ${getRarityColor(card.rarity)} text-white rounded-md`}
                          style={{
                            opacity: isRevealed ? 1 : 0,
                            transform: isRevealed ? "translateY(0)" : "translateY(-10px)",
                            transition: "all 0.4s ease-out 0.3s",
                          }}
                        >
                          {card.rarity}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Final Results Grid */}
          {packPhase === "done" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ animation: "fadeIn 0.4s ease-out forwards" }}>
              <h2 className="text-3xl font-bold text-white mb-6">
                {pullCount === 1 ? "Cartas Obtidas" : `${pullCount} Packs Abertos!`}
              </h2>

              {/* All cards grouped by pack */}
              <div className="max-h-[65vh] overflow-y-auto w-full max-w-5xl px-4">
                {packs.map((pack, packIdx) => (
                  <div key={pack.id} className="mb-8">
                    {packs.length > 1 && (
                      <p className="text-slate-400 text-sm mb-3 pl-2">Pack {packIdx + 1}</p>
                    )}
                    <div className="flex gap-4 justify-center flex-wrap">
                      {pack.cards.map((card, cardIdx) => (
                        <div
                          key={`${card.id}-final-${cardIdx}`}
                          className="flex flex-col items-center gap-1.5"
                          style={{
                            animation: `cardPopIn 0.3s ease-out forwards`,
                            animationDelay: `${(packIdx * 4 + cardIdx) * 0.05}s`,
                            opacity: 0,
                          }}
                        >
                          <div
                            className="relative w-20 h-28 md:w-24 md:h-32 overflow-hidden transition-transform hover:scale-110 hover:z-10"
                            style={{ boxShadow: getRarityGlow(card.rarity) }}
                          >
                            <Image src={card.image || "/placeholder.svg"} alt={card.name} fill sizes="96px" className="object-cover" />

                            {card.rarity === "LR" && (
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  background: "linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
                                  backgroundSize: "200% 100%",
                                  animation: "rainbowShift 2s linear infinite",
                                  padding: "2px",
                                  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                  WebkitMaskComposite: "xor",
                                  maskComposite: "exclude",
                                }}
                              />
                            )}

                            {card.rarity === "UR" && (
                              <div
                                className="absolute inset-0 pointer-events-none border-2 border-amber-400/80"
                                style={{ animation: "pulseGlow 1.5s ease-in-out infinite" }}
                              />
                            )}
                          </div>

                          {/* Rarity badge below */}
                          <div
                            className={`px-2 py-0.5 text-center text-xs font-bold bg-gradient-to-r ${getRarityColor(card.rarity)} text-white rounded`}
                          >
                            {card.rarity}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirm button */}
              <Button
                onClick={closeResults}
                className="mt-6 px-12 py-4 text-xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 border-2 border-green-400/50"
                style={{ animation: "scaleIn 0.3s ease-out forwards", animationDelay: "0.3s", opacity: 0 }}
              >
                CONFIRMAR
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Friendship Gacha Overlay */}
      {(isOpening || showResults) && currentBanner === "friendship" && fpReward && (
        <div ref={containerRef} className="fixed inset-0 z-50 bg-gradient-to-b from-pink-900/90 via-black to-rose-900/90">
          <canvas ref={canvasRef} className="absolute inset-0" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center" style={{ animation: "scaleIn 0.4s ease-out forwards" }}>
              <p className={`text-5xl font-black mb-8 ${fpReward >= 3000 ? "text-amber-400" : "text-pink-400"}`}>
                {fpReward >= 3000 ? "SORTE GRANDE!" : "Voce ganhou:"}
              </p>
              <div className="relative inline-block">
                <div
                  className={`absolute inset-0 blur-3xl ${fpReward >= 3000 ? "bg-amber-500" : "bg-amber-600"} opacity-60`}
                />
                <div
                  className={`relative flex items-center gap-6 px-16 py-10 rounded-3xl border-4 ${
                    fpReward >= 3000
                      ? "bg-gradient-to-r from-amber-500 to-yellow-500 border-yellow-300"
                      : "bg-gradient-to-r from-amber-600 to-yellow-600 border-amber-400"
                  }`}
                >
                  <Image src="/images/icons/gacha-coin.png" alt="Coin" width={96} height={96} className="w-24 h-24 object-contain drop-shadow-2xl" />
                  <span className="text-6xl font-black text-white">+{fpReward.toLocaleString()}</span>
                </div>
              </div>
              <p className="mt-6 text-2xl font-bold text-white">Moedas de Gacha!</p>
              <Button
                onClick={closeResults}
                className="mt-10 px-12 py-4 text-xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 border-2 border-green-400/50"
              >
                CONFIRMAR
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes floatParticle {
          0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.2; }
          25%  { transform: translateY(-20px) translateX(10px) scale(1.1); opacity: 0.7; }
          50%  { transform: translateY(-40px) translateX(-5px) scale(1.2); opacity: 0.9; }
          75%  { transform: translateY(-25px) translateX(12px) scale(1.1); opacity: 0.6; }
          100% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.2; }
        }
        @keyframes packEnter {
          0% { transform: translateY(-150px) scale(0.5) rotate(-10deg); opacity: 0; }
          60% { transform: translateY(20px) scale(1.05) rotate(2deg); opacity: 1; }
          100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes packShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-8px) rotate(-2deg); }
          75% { transform: translateX(8px) rotate(2deg); }
        }
        @keyframes packOpen {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0) rotate(180deg); opacity: 0; }
        }
        @keyframes burstRay {
          0% { opacity: 0; transform: rotate(var(--r, 0deg)) scaleY(0); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: rotate(var(--r, 0deg)) scaleY(3); }
        }
        @keyframes flashOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes cardsSlideUp {
          0% { transform: translateY(50px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shineAcross {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes rainbowShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(251, 191, 36, 0.5); }
          50% { box-shadow: 0 0 30px rgba(251, 191, 36, 0.8); }
        }
        @keyframes cardPopIn {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.1) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.1); }
          50% { transform: scale(1); }
          75% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
