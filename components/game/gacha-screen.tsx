"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, type Card } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Heart, Sparkles, Star, Gift, Clock, Zap, Crown } from "lucide-react"
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

// ── Daily Gacha helpers ──────────────────────────────────────────────────────
const DAILY_GACHA_KEY = "gpgame_daily_gacha_date"

function getTodayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function getDailyGachaUsed(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(DAILY_GACHA_KEY) === getTodayKey()
}

function markDailyGachaUsed() {
  if (typeof window === "undefined") return
  localStorage.setItem(DAILY_GACHA_KEY, getTodayKey())
}

function getTimeUntilMidnight(): string {
  const now = new Date()
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0)
  const diff = midnight.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
// ─────────────────────────────────────────────────────────────────────────────

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

  // Daily gacha state
  const [dailyUsed, setDailyUsed] = useState(false)
  const [timeUntilReset, setTimeUntilReset] = useState("")

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

  // Init daily gacha state
  useEffect(() => {
    setDailyUsed(getDailyGachaUsed())
  }, [])

  // Countdown timer for daily reset
  useEffect(() => {
    if (!dailyUsed) return
    const tick = () => setTimeUntilReset(getTimeUntilMidnight())
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [dailyUsed])

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

  const pullDailyGacha = () => {
    if (dailyUsed || isOpening) return

    markDailyGachaUsed()
    setDailyUsed(true)
    setIsOpening(true)
    setPullCount(1)
    setCurrentPackIndex(0)
    setPackPhase("entering")
    setCardRevealIndex(-1)
    setRevealIndex(-1)

    const packCards: Card[] = []
    for (let i = 0; i < CARDS_PER_PACK; i++) {
      const rand = Math.random() * 100
      let targetRarity: "R" | "SR" | "UR" | "LR"
      if (rand < 0.3) targetRarity = "LR"
      else if (rand < 4) targetRarity = "UR"
      else if (rand < 28) targetRarity = "SR"
      else targetRarity = "R"

      let available = allCards.filter((c) => c.rarity === targetRarity)
      if (available.length === 0) available = allCards
      const card = { ...available[Math.floor(Math.random() * available.length)], id: `${available[0].id}-daily-${Date.now()}-${i}` }
      packCards.push(card)
    }

    const rarities = ["R", "SR", "UR", "LR"] as const
    let highestRarity: "R" | "SR" | "UR" | "LR" = "R"
    for (const card of packCards) {
      if (rarities.indexOf(card.rarity) > rarities.indexOf(highestRarity)) highestRarity = card.rarity
    }

    const hasLR = packCards.some((c) => c.rarity === "LR")
    const hasUR = packCards.some((c) => c.rarity === "UR")
    const hasSR = packCards.some((c) => c.rarity === "SR")
    if (hasLR) setRarityTier("legendary")
    else if (hasUR) setRarityTier("epic")
    else if (hasSR) setRarityTier("rare")
    else setRarityTier("normal")

    setPacks([{ id: 0, cards: packCards, isOpened: false, isRevealing: false, highestRarity }])
    setOpenedCards(packCards)
    addToCollection(packCards)
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
      {/* Background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-[#0d0820] to-[#0a0a1a]" />
        <div className="absolute inset-0" style={{background:`radial-gradient(ellipse 110% 55% at 50% -5%, rgba(139,92,246,0.22) 0%, transparent 55%),radial-gradient(ellipse 70% 45% at 85% 105%, rgba(56,189,248,0.10) 0%, transparent 45%),radial-gradient(ellipse 55% 40% at 5% 85%, rgba(251,191,36,0.07) 0%, transparent 40%)`}} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.55)_100%)]" />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,backgroundSize:"40px 40px"}} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(24)].map((_, i) => {
          const colors = ["#38bdf8","#a855f7","#fbbf24","#22d3ee","#f472b6","#4ade80"]
          const color = colors[i % colors.length]
          const size = 1.5 + (i % 3)
          return (
            <div key={i} className="absolute rounded-full" style={{width:`${size}px`,height:`${size}px`,left:`${(i*4.3)%100}%`,top:`${(i*9.7)%100}%`,background:color,boxShadow:`0 0 ${size*5}px ${color}90`,animation:`floatParticle ${9+(i%7)}s ease-in-out ${i*0.4}s infinite`}} />
          )
        })}
      </div>

      {/* ── HEADER ── */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.07] backdrop-blur-md" style={{background:"rgba(10,10,26,0.8)"}}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">{t("back")}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <Crown className="w-5 h-5 text-amber-400" />
          <h1 className="text-xl font-black tracking-widest bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
            GACHA
          </h1>
          <Crown className="w-5 h-5 text-amber-400" />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-slate-800/80 to-slate-700/80 px-3 py-1.5 rounded-full border border-amber-400/20">
            <Image src="/images/icons/gacha-coin.png" alt="Coin" width={22} height={22} className="object-contain" />
            <span className="font-bold text-white text-sm">{coins.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-pink-700/80 to-rose-600/80 px-3 py-1.5 rounded-full border border-pink-400/30">
            <Heart className="w-3.5 h-3.5 text-white fill-white" />
            <span className="font-bold text-white text-sm">{spendableFP} FP</span>
          </div>
        </div>
      </div>

      {/* ── DAILY GACHA BANNER ── */}
      <div className="relative z-10 mx-4 mt-4">
        <div className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
          dailyUsed
            ? "border-slate-700/50 bg-slate-900/60"
            : "border-emerald-500/50 bg-gradient-to-r from-emerald-950/80 via-teal-950/80 to-emerald-950/80"
        }`}
          style={!dailyUsed ? {boxShadow:"0 0 30px rgba(16,185,129,0.15), 0 0 60px rgba(16,185,129,0.07)"} : {}}
        >
          {/* Shimmer on available */}
          {!dailyUsed && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/8 to-transparent -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite]" style={{animation:"shimmer 2.5s ease-in-out infinite"}} />
          )}

          <div className="flex items-center gap-4 p-4">
            {/* Icon */}
            <div className={`relative flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center border ${
              dailyUsed ? "bg-slate-800/80 border-slate-700" : "bg-emerald-500/20 border-emerald-500/50"
            }`}>
              {dailyUsed
                ? <Clock className="w-7 h-7 text-slate-500" />
                : <Gift className="w-7 h-7 text-emerald-400" style={{filter:"drop-shadow(0 0 8px rgba(16,185,129,0.7))"}} />
              }
              {!dailyUsed && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                  FREE
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-base font-black tracking-wide ${dailyUsed ? "text-slate-500" : "text-emerald-300"}`}>
                  GACHA DIÁRIO
                </span>
                {!dailyUsed && <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />}
              </div>
              <p className={`text-xs ${dailyUsed ? "text-slate-600" : "text-emerald-500/80"}`}>
                {dailyUsed ? "Já usado hoje — volte amanhã" : "1 pack grátis todo dia • Todas as raridades disponíveis"}
              </p>
              {dailyUsed && timeUntilReset && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock className="w-3 h-3 text-slate-600" />
                  <span className="text-slate-600 text-xs font-mono">Reseta em {timeUntilReset}</span>
                </div>
              )}
            </div>

            {/* Button */}
            <button
              onClick={pullDailyGacha}
              disabled={dailyUsed || isOpening}
              className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border ${
                dailyUsed || isOpening
                  ? "bg-slate-800/60 border-slate-700 text-slate-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-emerald-400/50 text-white hover:scale-105 shadow-lg shadow-emerald-500/30"
              }`}
            >
              {dailyUsed ? "Usado" : "PUXAR"}
            </button>
          </div>
        </div>
      </div>

      {/* ── BANNER TABS ── */}
      <div className="relative z-10 flex gap-2 px-4 pt-4 pb-2">
        {(["fsg", "anl", "friendship"] as BannerType[]).map((bannerKey) => (
          <button
            key={bannerKey}
            onClick={() => setCurrentBanner(bannerKey)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border ${
              currentBanner === bannerKey
                ? `bg-gradient-to-r ${BANNERS[bannerKey].color} border-white/25 shadow-lg scale-[1.03]`
                : "bg-white/[0.04] hover:bg-white/[0.07] border-white/[0.08] text-slate-400 hover:text-white"
            }`}
          >
            {bannerKey === "friendship" && <Heart className="w-3.5 h-3.5 fill-current" />}
            {bannerKey === "fsg" && <Star className="w-3.5 h-3.5" />}
            {bannerKey === "anl" && <Sparkles className="w-3.5 h-3.5" />}
            <span>{bannerKey === "fsg" ? "FSG" : bannerKey === "anl" ? "ANL" : "AMIZADE"}</span>
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center px-4 pb-6">
        {currentBanner !== "friendship" ? (
          <>
            {/* Banner image */}
            <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl mb-5 group" style={{aspectRatio:"16/7",border:"1px solid rgba(255,255,255,0.08)"}}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent z-10" />
              <Image src={banner.bannerImage || "/placeholder.svg"} alt={banner.name} fill sizes="(max-width:768px) 100vw, 768px" className="object-cover transition-transform duration-700 group-hover:scale-105" priority />
              {/* Shine sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 z-20" />
              {/* Bottom info overlay */}
              <div className="absolute bottom-0 left-0 right-0 z-20 px-5 py-3">
                <h2 className={`text-2xl font-black ${banner.accentColor} drop-shadow-lg`}>{banner.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-white/60 text-xs flex items-center gap-1"><Sparkles className="w-3 h-3" />4 cartas por pack</span>
                  <span className="text-white/40 text-xs">•</span>
                  <span className="text-white/60 text-xs">Todas raridades</span>
                  <span className="text-white/40 text-xs">•</span>
                  <span className="text-white/40 text-xs">{banner.code}</span>
                </div>
              </div>
            </div>

            {/* Pull buttons */}
            <div className="flex gap-3 w-full max-w-md">
              {/* Single pull */}
              <button
                onClick={() => pullGacha(1)}
                disabled={coins < COST_SINGLE || isOpening}
                className="flex-1 relative group rounded-2xl overflow-hidden border-2 border-amber-400/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 hover:border-amber-400/70"
                style={{background:"linear-gradient(135deg, #78350f, #92400e, #b45309)"}}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <div className="relative px-4 py-4 flex flex-col items-center gap-2">
                  <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">1 Pack</span>
                  <span className="text-white text-xl font-black">{t("gacha1")}</span>
                  <div className="flex items-center gap-1.5 bg-black/30 rounded-full px-3 py-1">
                    <Image src="/images/icons/gacha-coin.png" alt="Coin" width={18} height={18} className="object-contain" />
                    <span className="text-amber-300 font-bold text-sm">{COST_SINGLE}</span>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>

              {/* Multi pull */}
              <button
                onClick={() => pullGacha(10)}
                disabled={coins < COST_MULTI || isOpening}
                className="flex-[1.4] relative group rounded-2xl overflow-hidden border-2 border-purple-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 hover:border-purple-400/80"
                style={{background:"linear-gradient(135deg, #3b0764, #4c1d95, #6d28d9)"}}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                {/* HOT badge */}
                <div className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-bl-xl rounded-tr-xl z-10 animate-pulse">
                  HOT
                </div>
                <div className="relative px-4 py-4 flex flex-col items-center gap-2">
                  <span className="text-white/70 text-xs font-semibold tracking-widest uppercase">10 Packs</span>
                  <span className="text-white text-xl font-black">{t("gacha10")}</span>
                  <div className="flex items-center gap-1.5 bg-black/30 rounded-full px-3 py-1">
                    <Image src="/images/icons/gacha-coin.png" alt="Coin" width={18} height={18} className="object-contain" />
                    <span className="text-purple-300 font-bold text-sm">{COST_MULTI}</span>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>
            </div>

            {/* Rates info */}
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-600">
              <span className="text-red-500/70 font-bold">LR 0.5%</span>
              <span className="text-slate-700">•</span>
              <span className="text-amber-500/70 font-bold">UR 4.5%</span>
              <span className="text-slate-700">•</span>
              <span className="text-purple-500/70 font-bold">SR 25%</span>
              <span className="text-slate-700">•</span>
              <span className="text-slate-500 font-bold">R 70%</span>
            </div>
          </>
        ) : (
          <>
            {/* Friendship Gacha */}
            <div className="relative w-full max-w-md mt-2">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600/15 to-rose-600/15 blur-3xl rounded-3xl" />
              <div className="relative rounded-3xl p-7 border border-pink-500/25 backdrop-blur-sm shadow-2xl overflow-hidden" style={{background:"linear-gradient(135deg, rgba(131,24,67,0.5), rgba(159,18,57,0.5))"}}>
                {/* Decorative hearts */}
                <div className="absolute top-3 right-4 text-pink-800/30 text-5xl select-none pointer-events-none">♥</div>
                <div className="absolute bottom-4 left-3 text-rose-800/20 text-3xl select-none pointer-events-none">♥</div>

                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-pink-500/20 blur-2xl rounded-full" />
                    <Heart className="relative w-16 h-16 text-pink-400 fill-pink-400 drop-shadow-lg" style={{filter:"drop-shadow(0 0 12px rgba(236,72,153,0.8))",animation:"heartbeat 1.5s ease-in-out infinite"}} />
                  </div>

                  <h2 className="text-3xl font-black bg-gradient-to-r from-pink-300 via-rose-200 to-pink-300 bg-clip-text text-transparent mb-1">
                    Gacha de Amizade
                  </h2>
                  <p className="text-pink-300/70 text-sm mb-5">Use Pontos de Afinidade para ganhar Moedas de Gacha</p>

                  {/* Rewards */}
                  <div className="w-full bg-black/30 rounded-2xl p-4 mb-5 border border-pink-500/15">
                    <p className="text-slate-400 text-xs font-semibold mb-3 uppercase tracking-wider">Recompensas Possíveis</p>
                    <div className="flex justify-center gap-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Image src="/images/icons/gacha-coin.png" alt="Coin" width={26} height={26} className="object-contain" />
                          <span className="text-amber-400 font-black text-xl">300</span>
                        </div>
                        <p className="text-xs text-slate-500">Normal (80%)</p>
                      </div>
                      <div className="w-px bg-pink-800/50" />
                      <div className="text-center relative">
                        <div className="absolute inset-0 bg-yellow-400/10 blur-xl rounded-full" />
                        <div className="relative flex items-center justify-center gap-1 mb-1">
                          <Image src="/images/icons/gacha-coin.png" alt="Coin" width={30} height={30} className="object-contain" />
                          <span className="text-yellow-300 font-black text-xl">3.000</span>
                        </div>
                        <p className="text-xs text-slate-500">Sorte Grande (20%)</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-pink-900/70 text-[11px] mb-4">* Os FP gastos aqui não afetam sua barra de afinidade</p>

                  <button
                    onClick={pullFriendshipGacha}
                    disabled={spendableFP < FP_COST || isOpening}
                    className="w-full py-4 rounded-2xl font-black text-lg border-2 border-pink-400/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 hover:shadow-xl hover:shadow-pink-500/25 flex items-center justify-center gap-3"
                    style={{background:"linear-gradient(135deg, #db2777, #be185d, #e11d48)"}}
                  >
                    <Sparkles className="w-5 h-5" />
                    Puxar
                    <span className="flex items-center gap-1 bg-black/20 rounded-full px-3 py-0.5 text-sm">
                      <Heart className="w-3.5 h-3.5 fill-white" />
                      {FP_COST} FP
                    </span>
                  </button>

                  {spendableFP < FP_COST && (
                    <p className="text-pink-800/80 text-xs mt-2">Você tem {spendableFP} FP — faltam {FP_COST - spendableFP} FP</p>
                  )}
                </div>
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
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          60%  { transform: translateX(200%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}
