"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, type Card, CARD_BACK_IMAGE } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Heart, Sparkles, Star, Gift, Clock, Zap, Crown, BookOpen, X } from "lucide-react"
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

// ── Card Pool definitions ─────────────────────────────────────────────────────
const CARD_POOLS: Record<string, { category: string; emoji: string; cards: { name: string; rarity?: string; dp?: string; note?: string }[] }[]> = {
  fsg: [
    {
      category: "Unit Card", emoji: "👑",
      cards: [
        { name: "Rei Arthur", rarity: "SR", dp: "2 DP" }, { name: "Rei Arthur", rarity: "UR", dp: "3 DP" }, { name: "Rei Arthur", rarity: "LR", dp: "4 DP" },
        { name: "Fehnon Hoskie", rarity: "SR", dp: "2 DP" }, { name: "Fehnon Hoskie", rarity: "UR", dp: "3 DP" }, { name: "Fehnon Hoskie", rarity: "LR", dp: "4 DP" },
        { name: "Calem Hidenori", rarity: "SR", dp: "2 DP" }, { name: "Calem Hidenori", rarity: "UR", dp: "3 DP" }, { name: "Calem Hidenori", rarity: "LR", dp: "4 DP" },
        { name: "Morgana Pendragon", rarity: "SR", dp: "2 DP" }, { name: "Morgana Pendragon", rarity: "UR", dp: "3 DP" }, { name: "Morgana Pendragon", rarity: "LR", dp: "4 DP" },
      ],
    },
    {
      category: "Tropas", emoji: "⚔️",
      cards: [
        { name: "Santo Graal: Galahad", rarity: "SR" }, { name: "Santo Graal: Galahad", rarity: "R" },
        { name: "Balin: O Sentinela das Ruínas", rarity: "SR" }, { name: "Balin: O Sentinela das Ruínas", rarity: "R" },
        { name: "Merlin: O Mago do Destino", rarity: "SR" }, { name: "Merlin: O Mago do Destino", rarity: "R" },
        { name: "Mordred: O Usurpador", rarity: "SR" }, { name: "Mordred: O Usurpador", rarity: "R" },
        { name: "Vivian: A Dama do Lago", rarity: "SR" }, { name: "Vivian: A Dama do Lago", rarity: "R" },
        { name: "Oswin: O Comerciante", rarity: "SR" }, { name: "Oswin: O Comerciante", rarity: "R" },
        { name: "O Lorde Penguim Mr. P", rarity: "SR" }, { name: "O Lorde Penguim Mr. P", rarity: "R" },
      ],
    },
    {
      category: "Action Funcion Card", emoji: "⚡",
      cards: [
        { name: "Estratégia Real" }, { name: "Investida Coordenada" }, { name: "Laços da Ordem" },
        { name: "Troca de Guarda" }, { name: "Ventos de Camelot" }, { name: "Chamado da Távola" },
      ],
    },
    {
      category: "Magic Funcion Card", emoji: "✨",
      cards: [
        { name: "Ordem de Laceração" }, { name: "Sinfonia Relâmpago" }, { name: "Veredito do Rei Tirano" }, { name: "Julgamento do Vazio Eterno" },
      ],
    },
    {
      category: "Item Funcion Card", emoji: "🧪",
      cards: [
        { name: "Bandagem Restauradora" }, { name: "Cálice de Vinho Sagrado" }, { name: "Dados da Calamidade" },
        { name: "Dados do Destino Gentil" }, { name: "Flecha de Balista" }, { name: "Pedra de Afiar" }, { name: "Amplificador de Poder" },
      ],
    },
    {
      category: "Trap Funcion Card", emoji: "🪤",
      cards: [
        { name: "Contra-Ataque Surpresa" }, { name: "Escudo de Mana" }, { name: "Portão da Fortaleza" }, { name: "Brincadeira de Mau Gosto" },
      ],
    },
    {
      category: "Brotherhood Function Card", emoji: "🛡️",
      cards: [{ name: "Alvorada de Albion" }, { name: "A Grande Ordem" }],
    },
    {
      category: "Ultimate Gear Card", emoji: "⚙️",
      cards: [
        { name: "Ultimate Gear: Protonix Sword", note: "Fehnon" },
        { name: "Ultimate Gear: Oden Sword", note: "Fehnon" },
        { name: "Ultimate Gear: Twiligh Avalon", note: "Morgana" },
      ],
    },
    {
      category: "Ultimate Guardian Card", emoji: "🪽",
      cards: [
        { name: "Ultimate Guardian: Miguel Arcanjo", note: "Calem" },
        { name: "Ultimate Guardian: Mefisto Fóles", note: "Arthur" },
      ],
    },
    {
      category: "Scenario Card", emoji: "🗺️",
      cards: [{ name: "Ruínas Abandonadas" }, { name: "Reino de Camelot" }],
    },
  ],
  anl: [],
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
  const [showCardPool, setShowCardPool] = useState(false)
  const [cardPoolSection, setCardPoolSection] = useState(0)
  const [zoomedPoolCard, setZoomedPoolCard] = useState<{ image: string; name: string; rarity: string } | null>(null)

  // New pack-based animation states
  const [packs, setPacks] = useState<PackData[]>([])
  const [currentPackIndex, setCurrentPackIndex] = useState(0)
  const [packPhase, setPackPhase] = useState<"entering" | "floating" | "shaking" | "opening" | "revealing" | "done">("entering")
  const [cardRevealIndex, setCardRevealIndex] = useState(-1)
  const [pullCount, setPullCount] = useState(0)
  // Drag/swipe to open
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)
  const [swipeProgress, setSwipeProgress] = useState(0)
  const [swipeComplete, setSwipeComplete] = useState(false)
  // Zoom on revealed cards
  const [revealZoomedCard, setRevealZoomedCard] = useState<{ image: string; name: string; rarity: string } | null>(null)

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
    const cx = canvas.width / 2
    const cy = canvas.height / 2

    const palettes: Record<string, string[]> = {
      normal:    ["#64748b","#94a3b8","#cbd5e1","#e2e8f0"],
      rare:      ["#7c3aed","#8b5cf6","#a78bfa","#c4b5fd","#ede9fe"],
      epic:      ["#fbbf24","#f59e0b","#fcd34d","#fde68a","#ffffff"],
      legendary: ["#ef4444","#f97316","#fbbf24","#22c55e","#3b82f6","#8b5cf6","#ec4899"],
    }
    const cols = palettes[rarityTier]

    interface Particle {
      x: number; y: number; vx: number; vy: number
      size: number; color: string; alpha: number; life: number; maxLife: number
      type: "spark"|"orb"|"ring"|"star"
      angle?: number; spin?: number; trail?: {x:number;y:number}[]
    }

    const particles: Particle[] = []
    let t = 0

    const spawnAmbient = () => {
      if (particles.length >= 120) return
      const side = Math.random()
      const x = side < 0.5 ? Math.random() * canvas.width : (Math.random() < 0.5 ? -10 : canvas.width + 10)
      const y = side < 0.5 ? canvas.height + 10 : Math.random() * canvas.height
      particles.push({ x, y, vx:(Math.random()-0.5)*1.5, vy:-1.5-Math.random()*2.5,
        size:1.5+Math.random()*3, color:cols[Math.floor(Math.random()*cols.length)],
        alpha:0.9, life:200, maxLife:200, type:"spark" })
    }

    const spawnBurst = (num:number, x:number, y:number, speed:number) => {
      for (let i=0;i<num;i++) {
        const a = (Math.PI*2/num)*i + Math.random()*0.4
        const s = speed * (0.7+Math.random()*0.6)
        particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
          size:3+Math.random()*6, color:cols[Math.floor(Math.random()*cols.length)],
          alpha:1, life:70, maxLife:70, type:Math.random()<0.3?"star":"spark",
          spin:((Math.random()-0.5)*0.3), trail:[] })
      }
    }

    const spawnRing = (x:number,y:number,radius:number,count:number) => {
      for(let i=0;i<count;i++){
        const a=(Math.PI*2/count)*i
        particles.push({x:x+Math.cos(a)*radius,y:y+Math.sin(a)*radius,
          vx:Math.cos(a)*2,vy:Math.sin(a)*2,
          size:2+Math.random()*3,color:cols[Math.floor(Math.random()*cols.length)],
          alpha:1,life:50,maxLife:50,type:"spark",trail:[]})
      }
    }

    const animate = () => {
      t++
      const fade = packPhase==="opening"?"rgba(0,0,0,0.25)":packPhase==="revealing"?"rgba(0,0,0,0.08)":"rgba(0,0,0,0.06)"
      ctx.fillStyle=fade; ctx.fillRect(0,0,canvas.width,canvas.height)

      // Ambient
      if(t%2===0) spawnAmbient()

      // Opening burst — multi-wave
      if(packPhase==="opening") {
        if(t===1) { spawnBurst(40,cx,cy,18); spawnRing(cx,cy,0,20) }
        if(t===8) { spawnBurst(30,cx,cy,12); spawnRing(cx,cy,60,16) }
        if(t===16){ spawnBurst(20,cx,cy,8);  spawnRing(cx,cy,100,12) }
      }

      // Revealing — occasional sparkle bursts near cards
      if(packPhase==="revealing" && t%25===0 && cardRevealIndex>=0) {
        const cardX = cx + (cardRevealIndex - 1.5) * 80
        spawnBurst(8, cardX + (Math.random()-0.5)*60, cy + (Math.random()-0.5)*60, 5)
      }

      // Shaking — tension particles
      if(packPhase==="shaking" && t%4===0) {
        spawnBurst(4, cx+(Math.random()-0.5)*60, cy+(Math.random()-0.5)*80, 3)
      }

      ctx.globalAlpha=1

      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i]
        p.x+=p.vx; p.y+=p.vy
        p.vx*=0.96; p.vy*=0.96
        p.life--
        const pct=p.life/p.maxLife
        p.alpha=pct*(p.type==="orb"?0.7:0.9)

        if(p.life<=0){particles.splice(i,1);continue}

        // Trail
        if(p.trail){ p.trail.unshift({x:p.x,y:p.y}); if(p.trail.length>8)p.trail.pop() }

        ctx.save()
        if(p.type==="star"){
          ctx.globalAlpha=Math.max(0,p.alpha)
          ctx.translate(p.x,p.y)
          if(p.spin) ctx.rotate(p.spin*t)
          ctx.fillStyle=p.color
          // 4-point star
          const r=p.size; const inner=r*0.4
          ctx.beginPath()
          for(let k=0;k<8;k++){
            const a=(Math.PI/4)*k
            const radius=k%2===0?r:inner
            k===0?ctx.moveTo(Math.cos(a)*radius,Math.sin(a)*radius):ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius)
          }
          ctx.closePath(); ctx.fill()
        } else {
          // Particle core
          ctx.globalAlpha=Math.max(0,p.alpha)
          ctx.beginPath()
          ctx.arc(p.x,p.y,Math.max(0.1,p.size),0,Math.PI*2)
          ctx.fillStyle=p.color; ctx.fill()
          // Glow halo
          const gs=Math.max(0.1,p.size*4)
          const grd=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,gs)
          grd.addColorStop(0,p.color); grd.addColorStop(1,"transparent")
          ctx.globalAlpha=Math.max(0,p.alpha*0.35)
          ctx.beginPath(); ctx.arc(p.x,p.y,gs,0,Math.PI*2)
          ctx.fillStyle=grd; ctx.fill()
          // Trail
          if(p.trail&&p.trail.length>1){
            ctx.globalAlpha=Math.max(0,p.alpha*0.25)
            ctx.strokeStyle=p.color; ctx.lineWidth=Math.max(0.1,p.size*0.5)
            ctx.beginPath(); ctx.moveTo(p.trail[0].x,p.trail[0].y)
            p.trail.forEach(pt=>ctx.lineTo(pt.x,pt.y))
            ctx.stroke()
          }
        }
        ctx.restore()
      }
      ctx.globalAlpha=1
      animationRef.current=requestAnimationFrame(animate)
    }
    animate()
  }, [packPhase, rarityTier, cardRevealIndex])

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

  // Card reveal animation — dramatic delays for rares
  useEffect(() => {
    if (packPhase === "revealing" && cardRevealIndex < CARDS_PER_PACK) {
      const card = packs[currentPackIndex]?.cards[cardRevealIndex]
      // Dramatic pause before UR/LR reveals
      const delay = card?.rarity === "LR" ? 900 : card?.rarity === "UR" ? 600 : card?.rarity === "SR" ? 400 : 280
      const timer = setTimeout(() => setCardRevealIndex((prev) => prev + 1), delay)
      return () => clearTimeout(timer)
    }
  }, [packPhase, cardRevealIndex, packs, currentPackIndex])

  // Auto advance to next pack or finish
  useEffect(() => {
    if (packPhase === "revealing" && cardRevealIndex >= CARDS_PER_PACK) {
      const timer = setTimeout(() => {
        if (currentPackIndex < packs.length - 1) {
          setCurrentPackIndex((prev) => prev + 1)
          setPackPhase("entering")
          setCardRevealIndex(-1)
        } else {
          setPackPhase("done")
          setShowResults(true)
          setIsOpening(false)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [packPhase, cardRevealIndex, currentPackIndex, packs.length])

  // Pack phase progression — entering → floating (wait swipe on first pack only) → shaking → opening → revealing
  useEffect(() => {
    if (!isOpening || packs.length === 0) return
    if (packPhase === "entering") {
      // Only first pack requires swipe; subsequent packs auto-open
      if (currentPackIndex === 0) {
        const t = setTimeout(() => { setPackPhase("floating"); setSwipeProgress(0); setSwipeComplete(false) }, 800)
        return () => clearTimeout(t)
      } else {
        const t = setTimeout(() => { setPackPhase("shaking") }, 600)
        return () => clearTimeout(t)
      }
    }
    if (packPhase === "shaking") {
      setScreenShake(true)
      const t = setTimeout(() => { setScreenShake(false); setPackPhase("opening") }, 700)
      return () => clearTimeout(t)
    }
    if (packPhase === "opening") {
      const t = setTimeout(() => { setPackPhase("revealing"); setCardRevealIndex(0) }, 1000)
      return () => clearTimeout(t)
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
    setSwipeProgress(0)
    setSwipeStartX(null)
    setSwipeComplete(false)
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
      case "LR": return "0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(251,191,36,0.5)"
      case "UR": return "0 0 25px rgba(251,191,36,0.7)"
      case "SR": return "0 0 20px rgba(168,85,247,0.6)"
      default: return "none"
    }
  }

  // Look up a card's image from allCards by name + optional rarity
  const findCardImage = (name: string, rarity?: string): string => {
    const match = allCards.find(c =>
      c.name === name && (
        !rarity ||
        rarity === "R/SR" ||
        c.rarity === rarity
      )
    )
    return match?.image || "/placeholder.svg"
  }

  const getRarityBadgeStyle = (rarity: string) => {
    switch (rarity) {
      case "LR": return "bg-gradient-to-r from-red-500 to-amber-500 text-white"
      case "UR": return "bg-gradient-to-r from-amber-400 to-yellow-500 text-black"
      case "SR": return "bg-purple-500 text-white"
      case "R/SR": return "bg-slate-500 text-white"
      default: return "bg-slate-600 text-white"
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

      {/* ── BANNER TABS ── */}
      <div className="relative z-10 flex gap-2 px-4 pt-3 pb-2">
        {(["fsg", "anl", "friendship"] as BannerType[]).map((bannerKey) => (
          <button
            key={bannerKey}
            onClick={() => { setCurrentBanner(bannerKey); setShowCardPool(false); setCardPoolSection(0) }}
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
            {/* ── MAIN AREA: banner left | card pool right ── */}
            <div className={`flex gap-3 w-full mb-3 ${showCardPool ? "max-w-5xl" : "max-w-3xl"} transition-all duration-300`}>

              {/* LEFT COL: banner + buttons + rates */}
              <div className="flex flex-col flex-1 min-w-0">
                {/* Banner image */}
                <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl mb-3 group" style={{aspectRatio:"16/7", border:"1px solid rgba(255,255,255,0.08)"}}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent z-10" />
                  <Image src={banner.bannerImage || "/placeholder.svg"} alt={banner.name} fill sizes="(max-width:768px) 100vw, 640px" className="object-cover transition-transform duration-700 group-hover:scale-105" priority />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 z-20" />
                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 z-20 px-4 py-2.5">
                    <h2 className={`text-lg font-black ${banner.accentColor} drop-shadow-lg`}>{banner.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-white/50 text-[11px] flex items-center gap-1"><Sparkles className="w-2.5 h-2.5"/>4 cartas por pack</span>
                      <span className="text-white/30 text-[11px]">•</span>
                      <span className="text-white/50 text-[11px]">{banner.code}</span>
                    </div>
                  </div>
                  {/* Ver Cartas button — bottom-right of banner */}
                  {CARD_POOLS[currentBanner]?.length > 0 && (
                    <button
                      onClick={() => setShowCardPool(v => !v)}
                      className={`absolute bottom-2.5 right-3 z-30 flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
                        showCardPool
                          ? "bg-white/20 border-white/30 text-white"
                          : "bg-black/50 border-white/15 text-white/70 hover:bg-black/70 hover:text-white hover:border-white/30"
                      } backdrop-blur-sm`}
                    >
                      <BookOpen className="w-3 h-3" />
                      {showCardPool ? "Fechar" : "Ver Cartas"}
                    </button>
                  )}
                </div>

                {/* Pull buttons */}
                <div className="flex gap-2 mb-2.5">
                  {/* DAILY */}
                  <button onClick={pullDailyGacha} disabled={dailyUsed || isOpening}
                    className={`flex-1 relative group rounded-xl overflow-hidden border-2 transition-all duration-300 ${dailyUsed || isOpening ? "border-slate-700/50 opacity-60 cursor-not-allowed" : "border-emerald-500/60 hover:scale-105 hover:border-emerald-400"}`}
                    style={{background: dailyUsed ? "linear-gradient(135deg,#0f1a13,#111b14)" : "linear-gradient(135deg,#064e3b,#065f46,#047857)"}}>
                    {!dailyUsed && !isOpening && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-300/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />}
                    {!dailyUsed && <div className="absolute -top-px -right-px bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg rounded-tr-xl z-10 animate-pulse">FREE</div>}
                    <div className="relative px-2 py-3 flex flex-col items-center gap-1">
                      {dailyUsed ? <Clock className="w-5 h-5 text-slate-600" /> : <Gift className="w-5 h-5 text-emerald-300" style={{filter:"drop-shadow(0 0 6px rgba(52,211,153,0.8))"}} />}
                      <span className={`text-[10px] font-black tracking-widest uppercase ${dailyUsed ? "text-slate-600" : "text-emerald-200"}`}>Diário</span>
                      {dailyUsed && timeUntilReset ? <span className="text-slate-700 text-[9px] font-mono">{timeUntilReset}</span> : <span className={`text-[10px] font-bold ${dailyUsed ? "text-slate-700" : "text-emerald-400"}`}>{dailyUsed ? "Usado" : "GRÁTIS"}</span>}
                    </div>
                  </button>
                  {/* SINGLE */}
                  <button onClick={() => pullGacha(1)} disabled={coins < COST_SINGLE || isOpening}
                    className="flex-1 relative group rounded-xl overflow-hidden border-2 border-amber-400/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105"
                    style={{background:"linear-gradient(135deg,#78350f,#92400e,#b45309)"}}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <div className="relative px-2 py-3 flex flex-col items-center gap-1">
                      <span className="text-white/60 text-[10px] font-semibold tracking-widest uppercase">1 Pack</span>
                      <span className="text-white text-sm font-black">{t("gacha1")}</span>
                      <div className="flex items-center gap-1 bg-black/30 rounded-full px-2 py-0.5">
                        <Image src="/images/icons/gacha-coin.png" alt="Coin" width={13} height={13} className="object-contain" />
                        <span className="text-amber-300 font-bold text-[10px]">{COST_SINGLE}</span>
                      </div>
                    </div>
                  </button>
                  {/* MULTI */}
                  <button onClick={() => pullGacha(10)} disabled={coins < COST_MULTI || isOpening}
                    className="flex-[1.3] relative group rounded-xl overflow-hidden border-2 border-purple-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105"
                    style={{background:"linear-gradient(135deg,#3b0764,#4c1d95,#6d28d9)"}}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <div className="absolute -top-px -right-px bg-gradient-to-r from-red-500 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg rounded-tr-xl z-10 animate-pulse">HOT</div>
                    <div className="relative px-2 py-3 flex flex-col items-center gap-1">
                      <span className="text-white/60 text-[10px] font-semibold tracking-widest uppercase">10 Packs</span>
                      <span className="text-white text-sm font-black">{t("gacha10")}</span>
                      <div className="flex items-center gap-1 bg-black/30 rounded-full px-2 py-0.5">
                        <Image src="/images/icons/gacha-coin.png" alt="Coin" width={13} height={13} className="object-contain" />
                        <span className="text-purple-300 font-bold text-[10px]">{COST_MULTI}</span>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Rates */}
                <div className="flex items-center gap-2.5 text-[10px]">
                  <span className="text-red-500/70 font-bold">LR 0.5%</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-amber-500/70 font-bold">UR 4.5%</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-purple-500/70 font-bold">SR 25%</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-500 font-bold">R 70%</span>
                </div>
              </div>

              {/* RIGHT COL: card pool panel */}
              {showCardPool && CARD_POOLS[currentBanner] && (
                <div className="w-72 flex-shrink-0 rounded-2xl border border-white/10 flex flex-col" style={{background:"rgba(7,7,18,0.97)", height:"fit-content", maxHeight:"calc(100vh - 220px)"}}>

                  {/* Header with section tabs */}
                  <div className="flex-shrink-0 border-b border-white/[0.07]">
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-white font-bold text-xs">Cartas da Box</span>
                      </div>
                      <button onClick={() => setShowCardPool(false)} className="text-slate-600 hover:text-white transition-colors p-0.5 rounded">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Section selector — horizontal scroll */}
                    <div className="flex gap-1 px-2 pb-2 overflow-x-auto scrollbar-none">
                      {CARD_POOLS[currentBanner].map((group, idx) => {
                        // Short display label for each tab (no emoji)
                        const tabLabel =
                          group.category === "Unit Card" ? "Unidades" :
                          group.category === "Tropas" ? "Tropas" :
                          group.category === "Action Funcion Card" ? "Action" :
                          group.category === "Magic Funcion Card" ? "Magic" :
                          group.category === "Item Funcion Card" ? "Item" :
                          group.category === "Trap Funcion Card" ? "Trap" :
                          group.category === "Brotherhood Function Card" ? "Brotherhood" :
                          group.category === "Ultimate Gear Card" ? "Ultimate Gear" :
                          group.category === "Ultimate Guardian Card" ? "Ultimate Guardian" :
                          group.category === "Scenario Card" ? "Cenário" :
                          group.category.split(" ")[0]
                        return (
                          <button
                            key={group.category}
                            onClick={() => setCardPoolSection(idx)}
                            className={`flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold transition-all duration-150 border whitespace-nowrap ${
                              cardPoolSection === idx
                                ? "bg-white/15 border-white/25 text-white"
                                : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
                            }`}
                          >
                            {tabLabel}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Cards grid for active section */}
                  {(() => {
                    const group = CARD_POOLS[currentBanner][cardPoolSection]
                    if (!group) return null
                    return (
                      <div className="overflow-y-auto p-2">
                        <div className="text-[10px] font-black text-slate-500 tracking-wider uppercase mb-2 px-0.5">
                          {group.category} ({group.cards.length})
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {group.cards.map((poolCard, idx) => {
                            const img = findCardImage(poolCard.name, poolCard.rarity)
                            const displayRarity = poolCard.rarity || "R"
                            return (
                              <button
                                key={idx}
                                onClick={() => setZoomedPoolCard({ image: img, name: poolCard.name, rarity: displayRarity })}
                                className="flex flex-col items-center gap-1 group/card"
                              >
                                <div
                                  className={`relative w-full rounded-lg overflow-hidden border transition-all duration-200 group-hover/card:scale-110 group-hover/card:z-10 ${
                                    displayRarity === "LR" ? "rarity-lr" :
                                    displayRarity === "UR" ? "rarity-ur" :
                                    displayRarity === "SR" ? "rarity-sr" : "rarity-r"
                                  }`}
                                  style={{aspectRatio:"3/4"}}
                                >
                                  <Image src={img} alt={poolCard.name} fill sizes="60px" className="object-cover" />
                                </div>
                                <span className={`text-[9px] font-black px-1 py-0.5 rounded w-full text-center ${getRarityBadgeStyle(displayRarity)}`}>
                                  {displayRarity}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Friendship Gacha */}
            <div className="relative w-full max-w-md mt-2">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600/15 to-rose-600/15 blur-3xl rounded-3xl" />
              <div className="relative rounded-3xl p-7 border border-pink-500/25 backdrop-blur-sm shadow-2xl overflow-hidden" style={{background:"linear-gradient(135deg, rgba(131,24,67,0.5), rgba(159,18,57,0.5))"}}>
                <div className="absolute top-3 right-4 text-pink-800/30 text-5xl select-none pointer-events-none">♥</div>
                <div className="absolute bottom-4 left-3 text-rose-800/20 text-3xl select-none pointer-events-none">♥</div>
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-pink-500/20 blur-2xl rounded-full" />
                    <Heart className="relative w-16 h-16 text-pink-400 fill-pink-400 drop-shadow-lg" style={{filter:"drop-shadow(0 0 12px rgba(236,72,153,0.8))",animation:"heartbeat 1.5s ease-in-out infinite"}} />
                  </div>
                  <h2 className="text-3xl font-black bg-gradient-to-r from-pink-300 via-rose-200 to-pink-300 bg-clip-text text-transparent mb-1">Gacha de Amizade</h2>
                  <p className="text-pink-300/70 text-sm mb-5">Use Pontos de Afinidade para ganhar Moedas de Gacha</p>
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
                  <button onClick={pullFriendshipGacha} disabled={spendableFP < FP_COST || isOpening}
                    className="w-full py-4 rounded-2xl font-black text-lg border-2 border-pink-400/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 hover:shadow-xl hover:shadow-pink-500/25 flex items-center justify-center gap-3"
                    style={{background:"linear-gradient(135deg,#db2777,#be185d,#e11d48)"}}>
                    <Sparkles className="w-5 h-5" />Puxar
                    <span className="flex items-center gap-1 bg-black/20 rounded-full px-3 py-0.5 text-sm"><Heart className="w-3.5 h-3.5 fill-white" />{FP_COST} FP</span>
                  </button>
                  {spendableFP < FP_COST && <p className="text-pink-800/80 text-xs mt-2">Você tem {spendableFP} FP — faltam {FP_COST - spendableFP} FP</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── REVEAL CARD ZOOM — igual à coleção ── */}
      {revealZoomedCard && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[80] p-4"
          onClick={() => setRevealZoomedCard(null)}
        >
          <div className="relative w-full max-w-sm aspect-[3/4] animate-float">
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-500 to-purple-500 opacity-30" />
            <Image
              src={revealZoomedCard.image || "/placeholder.svg"}
              alt={revealZoomedCard.name}
              fill
              sizes="(max-width: 768px) 90vw, 384px"
              className={`object-contain ${
                revealZoomedCard.rarity === "LR" ? "rarity-lr" :
                revealZoomedCard.rarity === "UR" ? "rarity-ur" :
                revealZoomedCard.rarity === "SR" ? "rarity-sr" : "rarity-r"
              }`}
            />
          </div>
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <h3 className="text-2xl font-bold text-white mb-2">{revealZoomedCard.name}</h3>
            <span className={`px-4 py-1 rounded-full text-sm font-bold ${
              revealZoomedCard.rarity === "LR" ? "bg-gradient-to-r from-red-500 to-amber-500 text-white" :
              revealZoomedCard.rarity === "UR" ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black" :
              revealZoomedCard.rarity === "SR" ? "bg-purple-500 text-white" : "bg-slate-500 text-white"
            }`}>
              {revealZoomedCard.rarity}
            </span>
          </div>
          <button onClick={() => setRevealZoomedCard(null)}
            className="absolute top-4 right-4 p-2 glass rounded-full hover:bg-white/20 transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* ── CARD POOL ZOOM — igual à coleção ── */}
      {zoomedPoolCard && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={() => setZoomedPoolCard(null)}
        >
          <div className="relative w-full max-w-sm aspect-[3/4] animate-float">
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-500 to-purple-500 opacity-30" />
            <Image
              src={zoomedPoolCard.image || "/placeholder.svg"}
              alt={zoomedPoolCard.name}
              fill
              sizes="(max-width: 768px) 90vw, 384px"
              className={`object-contain rounded-2xl ${
                zoomedPoolCard.rarity === "LR" ? "rarity-lr" :
                zoomedPoolCard.rarity === "UR" ? "rarity-ur" :
                zoomedPoolCard.rarity === "SR" ? "rarity-sr" : "rarity-r"
              }`}
            />
          </div>
          {/* Card info */}
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <h3 className="text-2xl font-bold text-white mb-2">{zoomedPoolCard.name}</h3>
            <span className={`px-4 py-1 rounded-full text-sm font-bold ${
              zoomedPoolCard.rarity === "LR" ? "bg-gradient-to-r from-red-500 to-amber-500 text-white" :
              zoomedPoolCard.rarity === "UR" ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black" :
              zoomedPoolCard.rarity === "SR" ? "bg-purple-500 text-white" : "bg-slate-500 text-white"
            }`}>
              {zoomedPoolCard.rarity}
            </span>
          </div>
          <button
            onClick={() => setZoomedPoolCard(null)}
            className="absolute top-4 right-4 p-2 glass rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           CINEMATIC PACK OPENING OVERLAY
          ══════════════════════════════════════════════════════════ */}
      {(isOpening || showResults) && currentBanner !== "friendship" && (
        <div
          ref={containerRef}
          className={`fixed inset-0 z-50 overflow-hidden ${screenShake ? "animate-shake" : ""}`}
          style={{background:"radial-gradient(ellipse at 50% 40%, #0a0a2e 0%, #000000 70%)"}}
        >
          {/* Particle canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

          {/* Dynamic vignette that reacts to rarity */}
          {packPhase !== "done" && packs[currentPackIndex] && (
            <div className="absolute inset-0 pointer-events-none transition-all duration-700" style={{
              background: packs[currentPackIndex].highestRarity === "LR"
                ? "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(239,68,68,0.15) 70%, rgba(139,0,0,0.4) 100%)"
                : packs[currentPackIndex].highestRarity === "UR"
                ? "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(56,189,248,0.12) 70%, rgba(0,50,100,0.35) 100%)"
                : packs[currentPackIndex].highestRarity === "SR"
                ? "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(168,85,247,0.10) 70%, rgba(50,0,80,0.30) 100%)"
                : "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)"
            }} />
          )}

          {/* Pack counter */}
          {packs.length > 1 && packPhase !== "done" && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30">
              <div className="bg-black/70 backdrop-blur-md px-5 py-2 rounded-full border border-white/15">
                <span className="text-white/80 font-bold text-sm tracking-widest">
                  PACK {currentPackIndex + 1} <span className="text-white/30">/</span> {packs.length}
                </span>
              </div>
            </div>
          )}

          {/* Skip button */}
          {packPhase !== "done" && (
            <button
              onClick={() => { setPackPhase("done"); setShowResults(true); setIsOpening(false) }}
              className="absolute top-5 right-5 z-30 text-xs font-bold text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 backdrop-blur-sm"
            >
              Pular
            </button>
          )}

          {/* ── PACK PHASE ── */}
          {packPhase !== "done" && packs[currentPackIndex] && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {(() => {
                const pack = packs[currentPackIndex]
                const rarity = pack.highestRarity
                const rarityGlow =
                  rarity === "LR" ? { inner:"rgba(239,68,68,0.9)", outer:"rgba(251,191,36,0.5)", text:"text-red-400", label:"LENDÁRIO!" } :
                  rarity === "UR" ? { inner:"rgba(56,189,248,0.85)", outer:"rgba(99,179,237,0.4)", text:"text-sky-300", label:"ULTRA RARO!" } :
                  rarity === "SR" ? { inner:"rgba(168,85,247,0.8)", outer:"rgba(192,132,252,0.3)", text:"text-purple-400", label:"SUPER RARO!" } :
                                   { inner:"rgba(148,163,184,0.5)", outer:"rgba(200,200,200,0.15)", text:"text-slate-400", label:"" }

                // Swipe handlers
                const handleSwipeStart = (clientX: number) => {
                  if (packPhase !== "floating") return
                  setSwipeStartX(clientX)
                }
                const handleSwipeMove = (clientX: number) => {
                  if (packPhase !== "floating" || swipeStartX === null) return
                  const delta = clientX - swipeStartX
                  const progress = Math.min(1, Math.max(0, delta / 160))
                  setSwipeProgress(progress)
                  if (progress >= 1 && !swipeComplete) {
                    setSwipeComplete(true)
                    setSwipeProgress(1)
                    setSwipeStartX(null)
                    setPackPhase("shaking")
                  }
                }
                const handleSwipeEnd = () => {
                  if (swipeProgress < 1) { setSwipeProgress(0); setSwipeStartX(null) }
                }

                return (
                  <>
                    {/* ── ENTERING + FLOATING + OPENING phases ── */}
                    {(packPhase === "entering" || packPhase === "floating" || packPhase === "shaking" || packPhase === "opening") && (
                      <div className="relative flex flex-col items-center select-none">

                        {/* Ambient halo */}
                        <div className="absolute pointer-events-none" style={{
                          inset:"-60px", borderRadius:"50%",
                          background:`radial-gradient(ellipse at 50% 50%, ${rarityGlow.inner} 0%, transparent 65%)`,
                          filter:"blur(35px)",
                          animation: packPhase==="shaking" ? "haloFlicker 0.1s ease-in-out infinite" :
                            packPhase==="floating" ? "haloPulse 1.8s ease-in-out infinite" : "haloPulse 2s ease-in-out infinite",
                          opacity: packPhase==="entering" ? 0.4 : 0.8,
                        }} />

                        {/* "Abra!" label — only in floating */}
                        {packPhase === "floating" && (
                          <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap"
                            style={{animation:"abraLabel 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards"}}>
                            <span className="text-white/90 font-black text-xl tracking-widest" style={{
                              textShadow:`0 0 14px ${rarityGlow.inner}, 0 0 28px ${rarityGlow.outer}`}}>
                              Abra!
                            </span>
                          </div>
                        )}

                        {/* Pack body */}
                        <div className="relative" style={{
                          width:"208px", height:"308px",
                          animation:
                            packPhase==="entering" ? "packEnterEpic 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards" :
                            packPhase==="floating" ? "packFloat 2.4s ease-in-out infinite" :
                            packPhase==="shaking"  ? "packShakeEpic 0.1s ease-in-out infinite" :
                            packPhase==="opening"  ? "packOpenEpic 1s cubic-bezier(0.22,1,0.36,1) forwards" :
                            undefined,
                          filter:`drop-shadow(0 0 30px ${rarityGlow.inner}) drop-shadow(0 0 60px ${rarityGlow.outer})`,
                        }}>
                          <Image src={banner.packImage||"/placeholder.svg"} alt="Pack" fill sizes="208px" className="object-contain" />
                          {/* Holographic sheen */}
                          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg" style={{
                            background:"linear-gradient(135deg, transparent 35%, rgba(255,255,255,0.14) 50%, transparent 65%)",
                            animation:"packSheen 3.5s ease-in-out infinite",
                          }} />

                          {/* ── TEAR LINE + SWIPE ZONE (only in floating) ── */}
                          {packPhase === "floating" && (
                            <div
                              className="absolute left-0 right-0 z-30 cursor-grab active:cursor-grabbing"
                              style={{top:"28%", height:"44px", touchAction:"none"}}
                              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); handleSwipeStart(e.clientX) }}
                              onPointerMove={e => handleSwipeMove(e.clientX)}
                              onPointerUp={handleSwipeEnd}
                              onPointerCancel={handleSwipeEnd}
                            >
                              {/* Tear perforation line */}
                              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex items-center gap-[3px] px-1">
                                {[...Array(28)].map((_,i) => (
                                  <div key={i} className="flex-1 h-[2px] rounded-full" style={{
                                    background: swipeProgress > i/28
                                      ? `linear-gradient(to right, white, ${rarityGlow.inner})`
                                      : "rgba(255,255,255,0.25)",
                                    transition:"background 0.1s",
                                    boxShadow: swipeProgress > i/28 ? `0 0 6px ${rarityGlow.inner}` : "none",
                                  }} />
                                ))}
                              </div>

                              {/* Scissor / swipe arrow indicator */}
                              <div className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-100"
                                style={{left:`${4 + swipeProgress * 88}%`}}>
                                <div className="flex items-center gap-1"
                                  style={{animation: swipeProgress === 0 ? "swipeHint 1.2s ease-in-out infinite" : "none",
                                    filter:`drop-shadow(0 0 8px ${rarityGlow.inner})`}}>
                                  <span style={{fontSize:"20px", lineHeight:1}}>✂</span>
                                  {swipeProgress < 0.05 && (
                                    <span className="text-white/70 text-[10px] font-bold ml-1 whitespace-nowrap" style={{animation:"swipeHintText 1.2s ease-in-out infinite"}}>
                                      ← rasgar
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Progress glow fill */}
                              {swipeProgress > 0 && (
                                <div className="absolute top-0 left-0 bottom-0 pointer-events-none rounded-r-full" style={{
                                  width:`${swipeProgress*100}%`,
                                  background:`linear-gradient(to right, transparent, ${rarityGlow.inner}20)`,
                                  borderRight:`2px solid ${rarityGlow.inner}`,
                                  boxShadow:`0 0 12px ${rarityGlow.inner}`,
                                }} />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Swipe instruction text */}
                        {packPhase === "floating" && swipeProgress === 0 && (
                          <div className="mt-6 text-center pointer-events-none" style={{animation:"abraLabel 0.6s ease-out 0.2s both"}}>
                            <p className="text-white/40 text-xs tracking-widest">arraste a linha para rasgar</p>
                          </div>
                        )}

                        {/* Burst rays on opening */}
                        {packPhase === "opening" && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {[...Array(18)].map((_,i) => (
                              <div key={i} className="absolute" style={{
                                width:"2.5px", height:"200px",
                                background:`linear-gradient(to top, transparent, ${rarityGlow.inner}, white, transparent)`,
                                transform:`rotate(${i*(360/18)}deg)`,
                                transformOrigin:"50% 100%",
                                top:"50%", left:"50%", marginLeft:"-1.25px",
                                animation:`burstRayEpic 1s cubic-bezier(0.22,1,0.36,1) ${i*0.012}s forwards`,
                                opacity:0, borderRadius:"2px",
                                filter:`blur(1px) drop-shadow(0 0 4px ${rarityGlow.inner})`,
                              }} />
                            ))}
                            <div className="absolute inset-0 rounded-full" style={{
                              background:`radial-gradient(circle, white 0%, ${rarityGlow.inner} 25%, transparent 65%)`,
                              animation:"centralFlash 1s ease-out forwards",
                            }} />
                          </div>
                        )}

                        {/* Rarity announcement */}
                        {packPhase === "opening" && rarity !== "R" && (
                          <div className="absolute -bottom-20 left-1/2 whitespace-nowrap pointer-events-none"
                            style={{animation:"rarityAnnounce 0.85s cubic-bezier(0.34,1.56,0.64,1) 0.35s forwards",
                              opacity:0, transform:"translateX(-50%) scale(0.5)"}}>
                            <span className={`text-3xl font-black tracking-widest drop-shadow-2xl ${rarityGlow.text}`}
                              style={{textShadow: rarity==="LR"?"0 0 20px #ef4444, 0 0 40px #fbbf24":
                                rarity==="UR"?"0 0 20px #38bdf8, 0 0 40px #7dd3fc":"0 0 20px #a855f7, 0 0 35px #c084fc"}}>
                              {rarityGlow.label}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── CARD REVEAL ── */}
                    {packPhase === "revealing" && (
                      <div className="flex flex-col items-center gap-5 w-full" style={{animation:"revealContainerIn 0.4s ease-out forwards"}}>
                        <div className="flex gap-3 justify-center px-2">
                          {pack.cards.map((card, idx) => {
                            const isRevealed = idx < cardRevealIndex
                            const isRevealing = idx === cardRevealIndex - 1
                            const isPending = idx >= cardRevealIndex
                            const cardGlowStyle =
                              card.rarity==="LR" ? "0 0 30px rgba(239,68,68,0.9), 0 0 60px rgba(251,191,36,0.5)" :
                              card.rarity==="UR" ? "0 0 25px rgba(56,189,248,0.85), 0 0 50px rgba(99,179,237,0.4)" :
                              card.rarity==="SR" ? "0 0 22px rgba(168,85,247,0.8), 0 0 40px rgba(192,132,252,0.3)" :
                              "0 0 12px rgba(148,163,184,0.4)"
                            return (
                              <div key={`${card.id}-reveal-${idx}`} className="flex flex-col items-center gap-2">
                                <div className="relative" style={{perspective:"900px"}}>
                                  {isPending && idx === cardRevealIndex && (
                                    <div className="absolute inset-0 pointer-events-none z-10" style={{
                                      background: card.rarity==="LR" ? "radial-gradient(ellipse, rgba(239,68,68,0.6) 0%, transparent 70%)" :
                                        card.rarity==="UR" ? "radial-gradient(ellipse, rgba(56,189,248,0.5) 0%, transparent 70%)" :
                                        card.rarity==="SR" ? "radial-gradient(ellipse, rgba(168,85,247,0.4) 0%, transparent 70%)" : "none",
                                      filter:"blur(10px)", animation:"anticipateGlow 0.6s ease-in-out infinite alternate",
                                    }} />
                                  )}
                                  {/* 3D flip — larger, square corners */}
                                  <div
                                    className={isRevealed ? "cursor-pointer" : ""}
                                    style={{
                                      width:"108px", height:"155px", position:"relative",
                                      transformStyle:"preserve-3d",
                                      transform: isRevealed ? "rotateY(0deg)" : "rotateY(-180deg)",
                                      transition: isRevealing ? `transform ${card.rarity==="LR"?"0.9s":card.rarity==="UR"?"0.75s":"0.6s"} cubic-bezier(0.4,0,0.2,1)` : "none",
                                      opacity: isPending && idx > cardRevealIndex ? 0.10 : 1,
                                    }}
                                    onClick={() => isRevealed && setRevealZoomedCard({image:card.image||"/placeholder.svg",name:card.name,rarity:card.rarity})}
                                  >
                                    {/* FRONT — no border radius */}
                                    <div className="absolute inset-0 overflow-hidden"
                                      style={{backfaceVisibility:"hidden", boxShadow: isRevealed ? cardGlowStyle : "none", transition:"box-shadow 0.4s ease"}}>
                                      <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="115px" className="object-cover" />
                                      {isRevealing && (
                                        <div className="absolute inset-0 z-20 pointer-events-none" style={{
                                          background:"linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.75) 50%,transparent 65%)",
                                          animation:"shineSweep 0.65s ease-out 0.2s forwards", transform:"translateX(-100%)"}} />
                                      )}
                                      {card.rarity==="LR" && isRevealed && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          background:"linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)",
                                          backgroundSize:"300% 100%", animation:"rainbowShift 1.5s linear infinite",
                                          padding:"3px", WebkitMask:"linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                          WebkitMaskComposite:"xor", maskComposite:"exclude"}} />
                                      )}
                                      {card.rarity==="LR" && isRevealed && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          background:"linear-gradient(135deg,transparent 30%,rgba(255,255,255,0.08) 50%,transparent 70%)",
                                          backgroundSize:"200% 200%", animation:"lrHoloShimmer 3s ease-in-out infinite"}} />
                                      )}
                                      {card.rarity==="UR" && isRevealed && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          border:"2px solid rgba(56,189,248,0.9)", boxShadow:"inset 0 0 14px rgba(56,189,248,0.35)",
                                          animation:"urDiamondPulse 1.8s ease-in-out infinite"}} />
                                      )}
                                      {card.rarity==="SR" && isRevealed && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          border:"2px solid rgba(168,85,247,0.8)", animation:"srGoldPulse 2s ease-in-out infinite"}} />
                                      )}
                                      {isRevealed && <div className="absolute inset-0 bg-white/0 hover:bg-white/8 transition-colors duration-150" />}
                                    </div>
                                    {/* BACK — no border radius */}
                                    <div className="absolute inset-0 overflow-hidden"
                                      style={{backfaceVisibility:"hidden", transform:"rotateY(180deg)"}}>
                                      <Image src={CARD_BACK_IMAGE||"/placeholder.svg"} alt="Card Back" fill sizes="115px" className="object-cover" />
                                      {!isRevealed && idx <= cardRevealIndex && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          background: card.rarity==="LR" ? "linear-gradient(135deg,rgba(239,68,68,0.3),rgba(251,191,36,0.3))" :
                                            card.rarity==="UR" ? "rgba(56,189,248,0.25)" :
                                            card.rarity==="SR" ? "rgba(168,85,247,0.2)" : "transparent",
                                          animation:"backGlowPulse 0.8s ease-in-out infinite alternate"}} />
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {/* Rarity badge — no rounded */}
                                <div className={`px-2.5 py-0.5 text-center text-xs font-black bg-gradient-to-r ${getRarityColor(card.rarity)} text-white`}
                                  style={{opacity:isRevealed?1:0, transform:isRevealed?"translateY(0) scale(1)":"translateY(-6px) scale(0.8)",
                                    transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.35s"}}>
                                  {card.rarity}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {cardRevealIndex >= CARDS_PER_PACK && (
                          <p className="text-white/25 text-[10px] tracking-widest" style={{animation:"fadeIn 0.5s ease-out forwards"}}>
                            toque em uma carta para ampliar
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* ── FINAL RESULTS ── */}
          {packPhase === "done" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{animation:"fadeIn 0.5s ease-out forwards"}}>
              <h2 className="text-3xl font-black text-white mb-1 tracking-wider" style={{textShadow:"0 0 20px rgba(255,255,255,0.3)"}}>
                {pullCount === 1 ? "Cartas Obtidas!" : `${pullCount} Packs Abertos!`}
              </h2>
              <p className="text-slate-500 text-xs mb-4 tracking-widest uppercase">{openedCards.length} cartas · toque para ampliar</p>

              <div className="max-h-[65vh] overflow-y-auto w-full max-w-5xl px-3">
                {packs.map((pack, packIdx) => (
                  <div key={pack.id} className="mb-5">
                    {packs.length > 1 && <p className="text-slate-600 text-xs mb-2 pl-1 uppercase tracking-widest">Pack {packIdx + 1}</p>}
                    <div className="flex gap-2.5 justify-center flex-wrap">
                      {pack.cards.map((card, cardIdx) => {
                        const cardGlow =
                          card.rarity==="LR" ? "0 0 24px rgba(239,68,68,0.85), 0 0 48px rgba(251,191,36,0.45)" :
                          card.rarity==="UR" ? "0 0 20px rgba(56,189,248,0.85), 0 0 40px rgba(99,179,237,0.35)" :
                          card.rarity==="SR" ? "0 0 18px rgba(168,85,247,0.75), 0 0 36px rgba(192,132,252,0.25)" : "none"
                        return (
                          <div
                            key={`${card.id}-final-${cardIdx}`}
                            className="flex flex-col items-center gap-1.5 cursor-pointer group"
                            style={{animation:"cardPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
                              animationDelay:`${(packIdx*4+cardIdx)*0.06}s`, opacity:0}}
                            onClick={() => setRevealZoomedCard({image:card.image||"/placeholder.svg",name:card.name,rarity:card.rarity})}
                          >
                            {/* Card art — no rounded corners, bigger */}
                            <div
                              className="relative overflow-hidden transition-transform duration-200 group-hover:scale-110 group-hover:z-10"
                              style={{width:"86px", height:"122px", boxShadow:cardGlow}}
                            >
                              <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="96px" className="object-cover" />
                              {/* LR rainbow */}
                              {card.rarity==="LR" && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                  background:"linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)",
                                  backgroundSize:"300% 100%", animation:"rainbowShift 1.5s linear infinite",
                                  padding:"2px", WebkitMask:"linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                  WebkitMaskComposite:"xor", maskComposite:"exclude"}} />
                              )}
                              {/* UR diamond border */}
                              {card.rarity==="UR" && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                  border:"2px solid rgba(56,189,248,0.85)",
                                  boxShadow:"inset 0 0 10px rgba(56,189,248,0.25)",
                                  animation:"urDiamondPulse 1.8s ease-in-out infinite"}} />
                              )}
                              {/* SR purple border */}
                              {card.rarity==="SR" && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                  border:"1.5px solid rgba(168,85,247,0.75)",
                                  animation:"srGoldPulse 2s ease-in-out infinite"}} />
                              )}
                              {/* Hover shimmer */}
                              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-colors duration-150" />
                            </div>
                            {/* Rarity badge — no rounded */}
                            <div className={`px-2 py-0.5 text-center text-[10px] font-black bg-gradient-to-r ${getRarityColor(card.rarity)} text-white`}>
                              {card.rarity}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={closeResults}
                className="mt-4 px-10 py-3.5 text-lg font-black rounded-2xl border-2 border-emerald-400/50 transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/30"
                style={{background:"linear-gradient(135deg,#059669,#10b981,#34d399)",animation:"scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.3s forwards",opacity:0}}>
                CONFIRMAR
              </button>
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
        /* ── Pack float idle ── */
        @keyframes packFloat {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          30%     { transform: translateY(-12px) rotate(0.5deg); }
          70%     { transform: translateY(-8px) rotate(-0.3deg); }
        }

        /* ── "Abra!" label ── */
        @keyframes abraLabel {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.85); }
          60%  { opacity: 1; transform: translateX(-50%) translateY(2px) scale(1.05); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        /* ── Swipe hint wiggle ── */
        @keyframes swipeHint {
          0%,100% { transform: translateX(0); opacity: 0.7; }
          40%     { transform: translateX(18px); opacity: 1; }
          80%     { transform: translateX(8px); opacity: 0.9; }
        }
        @keyframes swipeHintText {
          0%,100% { opacity: 0.5; }
          50%     { opacity: 1; }
        }

        /* ── Ambient float ── */
        @keyframes floatParticle {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.15; }
          33%  { transform: translateY(-30px) translateX(8px) scale(1.15); opacity: 0.8; }
          66%  { transform: translateY(-50px) translateX(-6px) scale(1.2); opacity: 0.9; }
          100% { transform: translateY(-80px) translateX(4px) scale(0.8); opacity: 0; }
        }

        /* ── Pack enter ── */
        @keyframes packEnterEpic {
          0%   { transform: translateY(-200px) scale(0.4) rotate(-8deg); opacity: 0; filter: brightness(0); }
          50%  { transform: translateY(18px) scale(1.07) rotate(1.5deg); opacity: 1; filter: brightness(1.4); }
          75%  { transform: translateY(-6px) scale(0.98) rotate(-0.5deg); }
          100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
        }

        /* ── Pack shake — intensifying ── */
        @keyframes packShakeEpic {
          0%   { transform: translateX(0) rotate(0deg); }
          15%  { transform: translateX(-7px) rotate(-1.5deg) scale(1.01); }
          30%  { transform: translateX(9px) rotate(2deg) scale(1.02); }
          45%  { transform: translateX(-11px) rotate(-2.5deg) scale(1.03); }
          60%  { transform: translateX(10px) rotate(2deg) scale(1.02); }
          75%  { transform: translateX(-8px) rotate(-1.5deg) scale(1.01); }
          100% { transform: translateX(0) rotate(0deg); }
        }

        /* ── Pack open ── */
        @keyframes packOpenEpic {
          0%   { transform: scale(1) rotate(0deg) translateY(0); opacity: 1; }
          20%  { transform: scale(1.12) rotate(0.5deg) translateY(-8px); }
          50%  { transform: scale(1.35) rotate(-1deg) translateY(-15px); opacity: 0.9; filter: brightness(2.5); }
          80%  { transform: scale(0.5) rotate(5deg) translateY(20px); opacity: 0.3; }
          100% { transform: scale(0) rotate(12deg) translateY(40px); opacity: 0; }
        }

        /* ── Tearing animations ── */
        @keyframes tearTopFlap {
          0%   { transform: rotate(0deg) translateY(0); opacity: 1; }
          30%  { transform: rotate(-2deg) translateY(-5px); }
          60%  { transform: rotate(-8deg) translateY(-30px) scale(1.05); opacity: 0.8; }
          100% { transform: rotate(-20deg) translateY(-120px) translateX(-40px) scale(0.7); opacity: 0; }
        }
        @keyframes tearEdgeShake {
          0%,100% { transform: scaleX(1); }
          25%     { transform: scaleX(1.02) translateX(2px); }
          75%     { transform: scaleX(0.99) translateX(-1px); }
        }
        @keyframes tearSpark {
          0%   { transform: translateY(0) scaleY(0.2); opacity: 0; }
          30%  { opacity: 1; transform: translateY(-12px) scaleY(1); }
          60%  { opacity: 0.6; transform: translateY(-22px) scaleY(0.6); }
          100% { opacity: 0; transform: translateY(-35px) scaleY(0.1); }
        }
        @keyframes tearBeam {
          0%   { opacity: 0; transform: translateX(-50%) scaleY(0); }
          20%  { opacity: 1; transform: translateX(-50%) scaleY(1.5); }
          60%  { opacity: 0.6; transform: translateX(-50%) scaleY(1); }
          100% { opacity: 0; transform: translateX(-50%) scaleY(2) translateY(-20px); }
        }

        /* ── Burst rays ── */
        @keyframes burstRayEpic {
          0%   { opacity: 0; transform: rotate(var(--r,0deg)) scaleY(0) translateY(-50%); }
          20%  { opacity: 1; }
          60%  { opacity: 0.6; transform: rotate(var(--r,0deg)) scaleY(1) translateY(-50%); }
          100% { opacity: 0; transform: rotate(var(--r,0deg)) scaleY(2.5) translateY(-50%); }
        }
        @keyframes centralFlash {
          0%   { opacity: 0; transform: scale(0); }
          15%  { opacity: 1; transform: scale(0.8); }
          40%  { opacity: 0.7; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(2.5); }
        }

        /* ── Rarity announce ── */
        @keyframes rarityAnnounce {
          0%   { opacity: 0; transform: translateX(-50%) scale(0.4) rotate(-5deg); }
          60%  { opacity: 1; transform: translateX(-50%) scale(1.1) rotate(1deg); }
          80%  { transform: translateX(-50%) scale(0.97) rotate(-0.5deg); }
          100% { opacity: 1; transform: translateX(-50%) scale(1) rotate(0deg); }
        }

        /* ── Halo behind pack ── */
        @keyframes haloPulse {
          0%,100% { opacity: 0.6; transform: scale(1); }
          50%     { opacity: 1; transform: scale(1.15); }
        }
        @keyframes haloFlicker {
          0%,100% { opacity: 0.7; transform: scale(1.05) rotate(0deg); }
          33%     { opacity: 1; transform: scale(1.2) rotate(1deg); }
          66%     { opacity: 0.9; transform: scale(1.1) rotate(-1deg); }
        }
        @keyframes packSheen {
          0%,100% { background-position: 200% 200%; opacity: 0.6; }
          50%     { background-position: -100% -100%; opacity: 1; }
        }

        /* ── Card flip effects ── */
        @keyframes shineSweep {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        @keyframes anticipateGlow {
          0%   { opacity: 0.3; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes backGlowPulse {
          0%   { opacity: 0.4; }
          100% { opacity: 0.9; }
        }

        /* ── Rarity borders ── */
        @keyframes urDiamondPulse {
          0%,100% { box-shadow: 0 0 10px rgba(56,189,248,0.5), inset 0 0 8px rgba(56,189,248,0.2); border-color: rgba(56,189,248,0.7); }
          50%     { box-shadow: 0 0 25px rgba(56,189,248,0.9), 0 0 50px rgba(99,179,237,0.4), inset 0 0 15px rgba(56,189,248,0.4); border-color: rgba(56,189,248,1); }
        }
        @keyframes srGoldPulse {
          0%,100% { box-shadow: 0 0 8px rgba(168,85,247,0.5); border-color: rgba(168,85,247,0.6); }
          50%     { box-shadow: 0 0 20px rgba(168,85,247,0.9), 0 0 40px rgba(192,132,252,0.3); border-color: rgba(168,85,247,1); }
        }
        @keyframes lrHoloShimmer {
          0%,100% { background-position: 200% 200%; opacity: 0.5; }
          50%     { background-position: -100% -100%; opacity: 1; }
        }
        @keyframes rainbowShift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 15px rgba(251,191,36,0.5); }
          50%     { box-shadow: 0 0 30px rgba(251,191,36,0.9); }
        }

        /* ── Global ── */
        @keyframes revealContainerIn {
          0%   { opacity: 0; transform: translateY(30px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes scaleIn {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cardPopIn {
          0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
          55%  { transform: scale(1.12) rotate(2deg); }
          80%  { transform: scale(0.97) rotate(-0.5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0) rotate(0deg); }
          10%,50%,90% { transform: translateX(-10px) rotate(-1deg); }
          30%,70% { transform: translateX(10px) rotate(1deg); }
        }
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes heartbeat {
          0%,100% { transform: scale(1); }
          25%     { transform: scale(1.1); }
          75%     { transform: scale(1.05); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          60%,100% { transform: translateX(200%); }
        }
        @keyframes floatCard {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  )
}
