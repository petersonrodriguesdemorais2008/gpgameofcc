"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, type Card, CARD_BACK_IMAGE } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Heart, Sparkles, Star, Gift, Clock, Zap, Crown, BookOpen, X } from "lucide-react"
import Image from "next/image"
import { trackGachaPull, trackDailyLogin } from "@/lib/mission-tracker"

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
        { name: "Lancelot: O Herdeiro Sagrado", rarity: "SR" }, { name: "Lancelot: O Herdeiro Sagrado", rarity: "R" },
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
  // Special rarity reveal — plays before opening when pack contains SR+
  const [rarityRevealPhase, setRarityRevealPhase] = useState<"idle" | "flash" | "hold" | "done">("idle")
  const [revealingCardRarity, setRevealingCardRarity] = useState<"R" | "SR" | "UR" | "LR" | null>(null)
  const [phase, setPhase] = useState(0)
  const [fpReward, setFpReward] = useState<number | null>(null)
  const [revealIndex, setRevealIndex] = useState(-1)
  const [screenShake, setScreenShake] = useState(false)
  const [raritySpecialShake, setRaritySpecialShake] = useState(false) // physical shake only, no extra white flash
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

  // Refs mirroring the latest state so the particle animation loop (below) can
  // read current values without ever being torn down and rebuilt. Previously
  // drawParticles's useCallback depended directly on packPhase/cardRevealIndex/
  // rarityTier/revealingCardRarity, so EVERY change to any of them (which
  // happens many times per second during a reveal sequence) recreated the
  // whole closure — wiping the particle array and frame counter, and because
  // assigning canvas.width always clears its pixel content, this caused a
  // visible flash/reset of every in-flight particle and the ambient smoke
  // trail. That repeated reset is very likely what read as "bugged" flicker.
  // NOTE: these must be declared AFTER packPhase/cardRevealIndex/rarityTier/
  // revealingCardRarity above — reading a `const` state variable before its
  // own useState() line has executed throws "Cannot access before
  // initialization", which is what crashed the screen on load previously.
  const packPhaseRef = useRef(packPhase)
  const cardRevealIndexRef = useRef(cardRevealIndex)
  const rarityTierRef = useRef(rarityTier)
  const revealingCardRarityRef = useRef(revealingCardRarity)
  useEffect(() => { packPhaseRef.current = packPhase }, [packPhase])
  useEffect(() => { cardRevealIndexRef.current = cardRevealIndex }, [cardRevealIndex])
  useEffect(() => { rarityTierRef.current = rarityTier }, [rarityTier])
  useEffect(() => { revealingCardRarityRef.current = revealingCardRarity }, [revealingCardRarity])

  // Drag/swipe to open
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)
  const [swipeProgress, setSwipeProgress] = useState(0)
  const [swipeComplete, setSwipeComplete] = useState(false)
  // Tear sparks — array of {id, x (% along line), side (+1/-1), life 0-1}
  const [tearSparks, setTearSparks] = useState<{id:number;x:number;side:number;scale:number}[]>([])
  const tearSparkIdRef = useRef(0)
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

    // Monochromatic per-tier palettes — matches the rColor/rColor2 theme used
    // elsewhere (orange/red for legendary, blue for epic/UR, purple for rare/SR).
    // A rainbow palette is what makes bursts read as "fireworks"; keeping each
    // tier to 2-3 close hues makes it read as "magic glow" instead.
    const palettes: Record<string, string[]> = {
      normal:    ["#94a3b8","#cbd5e1","#e2e8f0"],
      rare:      ["#a855f7","#c4b5fd","#ede9fe"],
      epic:      ["#38bdf8","#93c5fd","#e0f2fe"],
      legendary: ["#f97316","#fbbf24","#fde68a"],
    }
    const currentCols = () => palettes[rarityTierRef.current] || palettes.normal

    interface Particle {
      x: number; y: number; vx: number; vy: number
      size: number; color: string; alpha: number; life: number; maxLife: number
      gravity?: boolean
      trail?: {x:number;y:number}[]
    }

    const particles: Particle[] = []
    let frame = 0

    // "Last seen" trackers so bursts fire exactly once per state TRANSITION
    // (a phase newly starting, a new card index) rather than at a fixed
    // absolute frame number — the old `if (t===1)` style only worked because
    // the whole loop used to restart (t back to 0) on every phase change; now
    // that the loop runs continuously forever, triggers must detect "this
    // just became true" instead.
    let openingBurstStage: 0 | 1 | 2 = 0
    let openingBurstStageStartFrame = 0
    let lastRevealedIdx = -2

    const spawnAmbient = () => {
      if (particles.length >= 120) return
      const cols = currentCols()
      const side = Math.random()
      const x = side < 0.5 ? Math.random() * canvas.width : (Math.random() < 0.5 ? -10 : canvas.width + 10)
      const y = side < 0.5 ? canvas.height + 10 : Math.random() * canvas.height
      particles.push({ x, y, vx:(Math.random()-0.5)*1.5, vy:-1.5-Math.random()*2.5,
        size:1.5+Math.random()*3, color:cols[Math.floor(Math.random()*cols.length)],
        alpha:0.9, life:200, maxLife:200 })
    }

    // Loot-burst style: particles launch outward/upward then arc down under
    // gravity, like a treasure-chest opening — NOT a flat radial firework
    // burst that hangs in a perfect circle with no gravity.
    const spawnBurst = (num:number, x:number, y:number, speed:number) => {
      const cols = currentCols()
      for (let i=0;i<num;i++) {
        // Bias toward upward directions (-160°..-20° in screen space) rather
        // than a full uniform 360° ring — reads as "erupting up" not "radiating out".
        const a = (-Math.PI*0.89) + Math.random()*(Math.PI*0.78)
        const s = speed * (0.6+Math.random()*0.7)
        particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
          size:2.5+Math.random()*4.5, color:cols[Math.floor(Math.random()*cols.length)],
          alpha:1, life:60, maxLife:60, gravity:true, trail:[] })
      }
    }

    const animate = () => {
      frame++
      const phase = packPhaseRef.current
      const cri = cardRevealIndexRef.current
      const rarity = revealingCardRarityRef.current

      const fade = phase==="opening"?"rgba(0,0,0,0.25)":phase==="revealing"?"rgba(0,0,0,0.08)":"rgba(0,0,0,0.06)"
      ctx.fillStyle=fade; ctx.fillRect(0,0,canvas.width,canvas.height)

      // Ambient
      if(frame%2===0) spawnAmbient()

      // Opening burst — two waves, each fired exactly once per "opening" phase
      // entry (detected via the stage counter, not an absolute frame number,
      // so this works correctly no matter how long the loop has been running).
      if (phase==="opening") {
        if (openingBurstStage===0) { spawnBurst(22,cx,cy,14); openingBurstStage=1; openingBurstStageStartFrame=frame }
        else if (openingBurstStage===1 && frame-openingBurstStageStartFrame>=7) { spawnBurst(10,cx,cy,8); openingBurstStage=2 }
      } else {
        openingBurstStage = 0 // reset so the NEXT pack's opening phase can fire its waves again
      }

      // Revealing — a small twinkle only on rare cards, fired once when
      // cardRevealIndex reaches a new value (i.e. a card just flipped).
      // Plain R cards get no canvas burst at all.
      if (phase==="revealing" && cri>=0 && cri!==lastRevealedIdx) {
        lastRevealedIdx = cri
        if (rarity) {
          const n = rarity==="LR" ? 14 : rarity==="UR" ? 9 : 6
          spawnBurst(n, cx + (cri-1.5)*80, cy, rarity==="LR"?10:7)
        }
      }
      if (phase!=="revealing") lastRevealedIdx = -2

      // Shaking — tension particles
      if(phase==="shaking" && frame%4===0) {
        spawnBurst(4, cx+(Math.random()-0.5)*60, cy+(Math.random()-0.5)*80, 3)
      }

      ctx.globalAlpha=1

      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i]
        p.x+=p.vx; p.y+=p.vy
        p.vx*=0.96; p.vy*=0.96
        if (p.gravity) p.vy += 0.13 // arcs particles downward like falling treasure/embers, not a flat radial hang
        p.life--
        const pct=p.life/p.maxLife
        p.alpha=pct*0.9

        if(p.life<=0){particles.splice(i,1);continue}

        // Trail
        if(p.trail){ p.trail.unshift({x:p.x,y:p.y}); if(p.trail.length>8)p.trail.pop() }

        ctx.save()
        {
          // All particles render as soft glowing orbs — no geometric star shapes,
          // which is what made bursts read as confetti/fireworks.
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
  }, []) // Empty deps — created ONCE and never torn down mid-session; all
         // time-varying reads go through the refs above instead.

  // Runs the particle loop for exactly one continuous session per gacha pull.
  // Derived into a single boolean so that isOpening and showResults flipping
  // together at the very end of a multi-pack pull (isOpening: true→false and
  // showResults: false→true happen in the same update, when moving from the
  // last card's reveal straight into the results screen) doesn't count as a
  // stop-then-restart — the boolean itself stays true across that transition,
  // so the loop (and its particles) carries on seamlessly instead of resetting.
  const particleSessionActive = isOpening || showResults
  useEffect(() => {
    if (!particleSessionActive) return
    drawParticles()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [particleSessionActive, drawParticles])


  // Card reveal animation — dramatic delays + special rarity flash for SR+
  // FIX: all setTimeout IDs are now tracked in a single array and cleared
  // together on cleanup. The previous version nested a setTimeout inside
  // another setTimeout's callback, and the inner one's ID was never captured
  // by the effect's cleanup — if the effect re-ran mid-sequence (e.g. props
  // changing) that inner timer kept firing on a stale closure, occasionally
  // skipping a card or double-advancing the reveal index.
  useEffect(() => {
    if (packPhase !== "revealing" || cardRevealIndex >= CARDS_PER_PACK) return
    const card = packs[currentPackIndex]?.cards[cardRevealIndex]
    const rarity = card?.rarity as "R" | "SR" | "UR" | "LR" | undefined
    const timers: ReturnType<typeof setTimeout>[] = []

    if (rarity && rarity !== "R") {
      setRevealingCardRarity(rarity)
      setRarityRevealPhase("flash")
      const flashDur  = rarity === "LR" ? 320 : rarity === "UR" ? 260 : 200
      const holdDur   = rarity === "LR" ? 900 : rarity === "UR" ? 650 : 420
      const flipDelay = rarity === "LR" ? 900 : rarity === "UR" ? 600 : 400

      // LR reveals get a screen shake at the peak of the flash — the biggest "wow" moment
      if (rarity === "LR") {
        timers.push(setTimeout(() => {
          setRaritySpecialShake(true)
          timers.push(setTimeout(() => setRaritySpecialShake(false), 400))
        }, flashDur * 0.6))
      }
      timers.push(setTimeout(() => setRarityRevealPhase("hold"), flashDur))
      timers.push(setTimeout(() => {
        setRarityRevealPhase("done")
        setRevealingCardRarity(null)
      }, flashDur + holdDur))
      timers.push(setTimeout(() => setCardRevealIndex((prev) => prev + 1), flashDur + holdDur + flipDelay))
    } else {
      // Normal R card — just delay and flip
      timers.push(setTimeout(() => setCardRevealIndex((prev) => prev + 1), 280))
    }

    return () => timers.forEach(clearTimeout)
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
    // ── Rastrear missões ──
    trackGachaPull(numPacks, allPulledCards)
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
    // ── Rastrear missões ──
    trackGachaPull(1, packCards)
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
          className={`fixed inset-0 z-50 overflow-hidden ${(screenShake || raritySpecialShake) ? "animate-shake" : ""}`}
          style={{background:"radial-gradient(ellipse at 50% 40%, #0a0a2e 0%, #000000 70%)"}}
        >
          {/* Chromatic aberration flash on screen shake — tightened radius, lower peak opacity */}
          {screenShake && <>
            <div className="absolute inset-0 pointer-events-none z-[200]" style={{background:"radial-gradient(circle at center,rgba(255,255,255,0.14) 0%,transparent 42%)",animation:"chromaFlash 0.45s ease-out forwards"}}/>
            <div className="absolute inset-0 pointer-events-none z-[199] mix-blend-screen" style={{background:"radial-gradient(circle at center,rgba(255,30,30,0) 0%,rgba(255,30,30,0.10) 100%)",animation:"chromaR 0.45s ease-out forwards"}}/>
            <div className="absolute inset-0 pointer-events-none z-[199] mix-blend-screen" style={{background:"radial-gradient(circle at center,rgba(30,30,255,0) 0%,rgba(30,30,255,0.10) 100%)",animation:"chromaB 0.45s ease-out forwards"}}/>
          </>}
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

                  // Generate tear sparks along the tear line
                  if (progress > 0 && progress < 1) {
                    const newSparks = Array.from({length: 3}, () => ({
                      id: tearSparkIdRef.current++,
                      x: progress * 100 + (Math.random() - 0.5) * 8,
                      side: Math.random() > 0.5 ? 1 : -1,
                      scale: 0.5 + Math.random() * 1.2,
                    }))
                    setTearSparks(prev => [...prev.slice(-18), ...newSparks])
                    setTimeout(() => {
                      setTearSparks(prev => prev.filter(s => !newSparks.find(n => n.id === s.id)))
                    }, 380)
                  }

                  if (progress >= 1 && !swipeComplete) {
                    setSwipeComplete(true)
                    setSwipeProgress(1)
                    setSwipeStartX(null)
                    setTearSparks([])
                    // Single source of truth for the shake: just transition phase.
                    // The "shaking" state-machine effect owns screenShake timing —
                    // previously this handler ALSO drove its own 500ms shake timer
                    // while the effect ran an independent 700ms one, leaving a ~200ms
                    // dead pause where the pack sat frozen before the burst fired.
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
                              style={{top:"9%", height:"44px", touchAction:"none"}}
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
                                    transition:"background 0.08s",
                                    boxShadow: swipeProgress > i/28 ? `0 0 8px ${rarityGlow.inner}, 0 0 16px ${rarityGlow.inner}60` : "none",
                                  }} />
                                ))}
                              </div>

                              {/* Live tear sparks */}
                              {tearSparks.map(spark => (
                                <div key={spark.id} className="absolute pointer-events-none"
                                  style={{
                                    left:`${spark.x}%`,
                                    top: spark.side > 0 ? "calc(50% - 2px)" : "calc(50% + 2px)",
                                    width:`${4 * spark.scale}px`,
                                    height:`${10 * spark.scale}px`,
                                    background:`linear-gradient(to ${spark.side>0?"top":"bottom"}, white, ${rarityGlow.inner}, transparent)`,
                                    borderRadius:"9999px",
                                    transform:`translateX(-50%) translateY(${spark.side > 0 ? "-100%" : "0%"})`,
                                    animation:"tearSparkBurst 0.38s ease-out forwards",
                                    boxShadow:`0 0 6px 2px ${rarityGlow.inner}`,
                                    filter:`brightness(1.6)`,
                                  }} />
                              ))}

                              {/* Glow cursor that follows the drag */}
                              {swipeProgress > 0 && swipeProgress < 1 && (
                                <div className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                                  style={{
                                    left:`${swipeProgress * 100}%`,
                                    width:"18px", height:"18px",
                                    borderRadius:"50%",
                                    background:`radial-gradient(circle, white 10%, ${rarityGlow.inner} 55%, transparent 100%)`,
                                    transform:`translateX(-50%) translateY(-50%)`,
                                    boxShadow:`0 0 18px 6px ${rarityGlow.inner}, 0 0 40px 12px ${rarityGlow.outer}`,
                                    filter:"brightness(1.8)",
                                  }} />
                              )}

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
                                <div className="absolute top-0 left-0 bottom-0 pointer-events-none" style={{
                                  width:`${swipeProgress*100}%`,
                                  background:`linear-gradient(to right, transparent, ${rarityGlow.inner}25)`,
                                  borderRight:`2px solid ${rarityGlow.inner}`,
                                  boxShadow:`0 0 18px ${rarityGlow.inner}`,
                                }} />
                              )}
                            </div>
                          )}

                          {/* ── PHYSICAL TOP FLAP SEPARATION ── */}
                          {packPhase === "floating" && swipeProgress > 0 && (
                            <div className="absolute left-0 right-0 overflow-hidden pointer-events-none z-20"
                              style={{
                                top: 0,
                                height:"9%",
                                transform:`rotate(${swipeProgress * -14}deg) translateY(${swipeProgress * -28}px) translateX(${swipeProgress * -12}px)`,
                                transformOrigin:"left center",
                                opacity: 1 - swipeProgress * 0.4,
                                filter:`brightness(${1 + swipeProgress * 0.6}) drop-shadow(0 -4px 12px ${rarityGlow.inner})`,
                                transition:"transform 0.05s linear",
                              }}>
                              <Image src={banner.packImage||"/placeholder.svg"} alt="Pack top" fill sizes="208px" className="object-cover object-top" />
                            </div>
                          )}
                        </div>

                        {/* Swipe instruction text */}
                        {packPhase === "floating" && swipeProgress === 0 && (
                          <div className="mt-6 text-center pointer-events-none" style={{animation:"abraLabel 0.6s ease-out 0.2s both"}}>
                            <p className="text-white/40 text-xs tracking-widest">arraste a linha para rasgar</p>
                          </div>
                        )}

                        {/* Opening burst — concentric rings + diagonal light sweep + core flash.
                            No particles depart from the center in a circular pattern — that motion
                            is what reads as "fireworks" regardless of shape, so it's avoided entirely. */}
                        {packPhase === "opening" && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {/* Shockwave rings — concentric expansion, not radiating spikes */}
                            {[0,0.1,0.2,0.32].map((del,i) => (
                              <div key={i} className="absolute rounded-full pointer-events-none"
                                style={{
                                  width:"80px", height:"80px",
                                  border:`${4-i*0.7}px solid ${i===0?"white":rarityGlow.inner}`,
                                  boxShadow: `0 0 ${24-i*5}px ${rarityGlow.inner}`,
                                  animation:`shockwaveRing 0.95s cubic-bezier(0.03,0,0.14,1) ${del}s forwards`,
                                  opacity:0,
                                }} />
                            ))}

                            {/* Expanding energy ring — solid band thinning as it grows */}
                            <div className="absolute rounded-full" style={{
                              width:"60px", height:"60px",
                              border:`10px solid ${rarityGlow.inner}`,
                              animation:"energyRingExpand 0.9s cubic-bezier(0.1,0.6,0.25,1) forwards",
                              opacity:0,
                            }}/>

                            {/* Two diagonal light sweeps, staggered — reads as "flash of light across glass/metal" */}
                            <div className="absolute inset-[-40%]" style={{
                              background:`linear-gradient(115deg, transparent 42%, ${rarityGlow.inner}55 49%, white 50%, ${rarityGlow.inner}55 51%, transparent 58%)`,
                              animation:"lightSweepPass 0.75s ease-out 0.04s forwards",
                              opacity:0,
                              mixBlendMode:"screen",
                            }}/>
                            <div className="absolute inset-[-40%]" style={{
                              background:`linear-gradient(65deg, transparent 44%, ${rarityGlow.outer}40 50%, transparent 56%)`,
                              animation:"lightSweepPass 0.85s ease-out 0.16s forwards",
                              opacity:0,
                              mixBlendMode:"screen",
                            }}/>

                            {/* Central flash orb — contained core, doesn't wash out the screen */}
                            <div className="absolute rounded-full" style={{
                              width:"90px", height:"90px",
                              background:`radial-gradient(circle, white 0%, ${rarityGlow.inner} 30%, ${rarityGlow.outer}60 58%, transparent 90%)`,
                              animation:"centralFlash 1.1s ease-out forwards",
                              filter:"blur(1.5px)",
                            }} />
                            <div className="absolute rounded-full" style={{
                              width:"32px", height:"32px",
                              background:"radial-gradient(circle, white 0%, white 50%, transparent 100%)",
                              animation:"centralFlash 0.7s ease-out forwards",
                            }} />
                          </div>
                        )}

                        {/* Rarity announcement — delay+duration kept comfortably under the
                            1000ms "opening" phase window (see the setTimeout that advances
                            packPhase to "revealing"), so the pop-in always fully completes
                            instead of being unmounted mid-animation at ~83% through. */}
                        {packPhase === "opening" && rarity !== "R" && (
                          <div className="absolute -bottom-20 left-1/2 whitespace-nowrap pointer-events-none"
                            style={{animation:"rarityAnnounce 0.65s cubic-bezier(0.34,1.56,0.64,1) 0.2s forwards",
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

                    {/* ── SPECIAL RARITY REVEAL OVERLAY — plays before SR/UR/LR card flips ── */}
                    {packPhase === "revealing" && revealingCardRarity && rarityRevealPhase !== "idle" && rarityRevealPhase !== "done" && (() => {
                      const rc = revealingCardRarity
                      const rColor = rc==="LR" ? "#f97316" : rc==="UR" ? "#38bdf8" : "#a855f7"
                      const rColor2 = rc==="LR" ? "#ef4444" : rc==="UR" ? "#6366f1" : "#7c3aed"
                      const rLabel = rc==="LR" ? "LENDÁRIO" : rc==="UR" ? "ULTRA RARO" : "SUPER RARO"
                      // Bumped up from the previous 190/240/300 pass, with a wider gap for LR
                      // specifically so the top tier reads as a clear step above UR, not just
                      // a slightly-bigger version of it.
                      const ringSize = rc==="LR" ? 360 : rc==="UR" ? 260 : 200
                      const ringSize2 = rc==="LR" ? 265 : rc==="UR" ? 190 : 148
                      // Matches holdDur in the card-reveal useEffect exactly, so anything
                      // animated for the FULL hold window (the beam below) always completes
                      // its own fade-out before this overlay unmounts, instead of being cut
                      // off mid-animation and yanked from the DOM still visible.
                      const holdMs = rc==="LR" ? 900 : rc==="UR" ? 650 : 420
                      return (
                        <div className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none overflow-hidden">
                          {/* Dark scrim FIRST — dims the background so the color pops without washing the whole screen white */}
                          <div className="absolute inset-0 bg-black" style={{
                            opacity: rarityRevealPhase === "flash" ? 0.35 : 0.58,
                            transition: "opacity 0.25s ease-out",
                          }}/>

                          {/* Flash — brief, CONTAINED burst (small white core, color falls off fast) */}
                          {rarityRevealPhase === "flash" && (
                            <div className="absolute inset-0" style={{
                              background: `radial-gradient(circle at center, rgba(255,255,255,0.9) 0%, ${rColor}cc 12%, ${rColor2}66 28%, transparent 48%)`,
                              animation: `raritySpecialFlash ${rc==="LR"?"0.32s":rc==="UR"?"0.26s":"0.2s"} ease-out forwards`,
                            }}/>
                          )}
                          {/* Hold — ambient wash, magic circle rings, drifting motes, vertical beam, label */}
                          {rarityRevealPhase === "hold" && (
                            <>
                              <div className="absolute inset-0" style={{
                                background: `radial-gradient(ellipse at center, ${rColor}20 0%, ${rColor2}0e 38%, transparent 62%)`,
                                animation: "rarityHoldPulse 0.6s ease-in-out infinite",
                              }}/>

                              {/* NEW: Screen-edge color vignette — frames the whole viewport in the
                                  rarity's color so the reveal feels "color-graded" rather than a
                                  small effect floating alone in the middle of the screen. Scales
                                  up with rarity, giving LR a noticeably heavier frame than SR. */}
                              <div className="absolute inset-0" style={{
                                boxShadow: `inset 0 0 ${rc==="LR"?160:rc==="UR"?115:82}px ${rc==="LR"?42:rc==="UR"?26:16}px ${rColor}75`,
                                animation: "rarityHoldPulse 0.6s ease-in-out infinite",
                              }}/>

                              {/* NEW: Impact punch — a one-shot scale-flash marking the beat where
                                  flash gives way to hold, so the transition lands with a "thunk"
                                  instead of just a background-color cut. */}
                              <div className="absolute inset-0" style={{
                                background: `radial-gradient(circle at center, ${rColor}55 0%, transparent 60%)`,
                                animation: "holdImpactPunch 0.35s ease-out forwards",
                              }}/>

                              {/* Vertical light beam descending from top — cinematic "chosen one" spotlight */}
                              <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{
                                width: rc==="LR"?"170px":rc==="UR"?"120px":"82px",
                                height:"100%",
                                background:`linear-gradient(to bottom, ${rColor}00, ${rColor}45 15%, ${rColor}28 60%, ${rColor}00 100%)`,
                                animation:`lightBeamDescend ${holdMs}ms ease-out forwards`,
                                mixBlendMode:"screen",
                              }}/>

                              {/* Magic circle — SVG dashed rings rotating opposite directions (arcane, not a mask/gradient hack) */}
                              <svg className="absolute" width={ringSize} height={ringSize} viewBox="0 0 100 100"
                                style={{opacity:0.65, animation:`magicRingSpin ${rc==="LR"?"6s":rc==="UR"?"7.5s":"9s"} linear infinite`,
                                  filter:`drop-shadow(0 0 4px ${rColor}a0)`}}>
                                <circle cx="50" cy="50" r="46" fill="none" stroke={rColor} strokeWidth="2.4" strokeDasharray="7 5" />
                              </svg>
                              <svg className="absolute" width={ringSize2} height={ringSize2} viewBox="0 0 100 100"
                                style={{opacity:0.5, animation:`magicRingSpinRev ${rc==="LR"?"4.5s":rc==="UR"?"5.5s":"6.5s"} linear infinite`}}>
                                <circle cx="50" cy="50" r="46" fill="none" stroke={rColor} strokeWidth="1.8" strokeDasharray="4 4" />
                              </svg>
                              {/* Thin static outer ring for definition */}
                              <div className="absolute rounded-full pointer-events-none" style={{
                                width: ringSize+24, height: ringSize+24,
                                border:`1px solid ${rColor}60`,
                              }}/>

                              {/* Drifting light motes — float upward slowly with gentle sway, NOT exploding outward */}
                              {[...Array(rc==="LR"?16:rc==="UR"?11:8)].map((_,i)=>{
                                const startX = (Math.random()-0.5) * (rc==="LR"?360:rc==="UR"?270:200)
                                const sway = (Math.random()-0.5) * 60
                                const size = 2 + Math.random()*3
                                const dur = 1.6 + Math.random()*1.2
                                const del = Math.random()*0.5
                                return <div key={i} className="absolute rounded-full" style={{
                                  left:`calc(50% + ${startX}px)`, bottom:"38%",
                                  width:`${size}px`, height:`${size}px`,
                                  background: rc==="LR" ? "#fde047" : rc==="UR" ? "#bae6fd" : "#e9d5ff",
                                  boxShadow:`0 0 4px 1px ${rColor}90`,
                                  animation:`moteDrift ${dur}s ease-out ${del}s infinite`,
                                  "--sway": `${sway}px`,
                                } as React.CSSProperties}/>
                              })}

                              {/* Label — now on an ornate rank-badge plate instead of bare floating
                                  text, for "trophy reveal" weight that matches the rarity tier. */}
                              <div className="relative z-10 text-center" style={{animation:"raritySpecialLabel 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards"}}>
                                {/* Impact stamp — quick localized burst right as the badge lands */}
                                <div className="absolute left-1/2 top-1/2 rounded-full pointer-events-none" style={{
                                  width:"10px", height:"10px",
                                  background: `radial-gradient(circle, white, ${rColor}, transparent 70%)`,
                                  transform:"translate(-50%,-50%)",
                                  animation:"labelStampFlash 0.5s ease-out forwards",
                                }}/>
                                <div className="relative mx-auto" style={{
                                  padding: rc==="LR" ? "15px 46px" : rc==="UR" ? "12px 40px" : "10px 34px",
                                  background: `linear-gradient(135deg, ${rColor2}e6, ${rColor}cc 50%, ${rColor2}e6)`,
                                  clipPath: "polygon(3% 0%, 97% 0%, 100% 50%, 97% 100%, 3% 100%, 0% 50%)",
                                  boxShadow: `0 0 34px ${rColor}95, 0 4px 14px rgba(0,0,0,0.55)`,
                                  border: "1px solid rgba(255,255,255,0.45)",
                                }}>
                                  <p className="font-black tracking-[0.3em]" style={{
                                    fontSize: rc==="LR"?"46px":rc==="UR"?"36px":"28px",
                                    color:"white",
                                    textShadow:`0 2px 6px rgba(0,0,0,0.6), 0 0 18px ${rColor}`,
                                  }}>{rLabel}</p>
                                </div>
                                {rc==="LR" && (
                                  <p className="text-white/85 text-sm font-bold tracking-[0.4em] mt-3" style={{textShadow:`0 0 8px ${rColor}`}}>✦ ✦ ✦</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}

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
                                  <div style={{perspective:"900px", width:"108px", height:"155px"}}>
                                  <div
                                    className={isRevealed ? "cursor-pointer" : ""}
                                    style={{
                                      width:"108px", height:"155px", position:"relative",
                                      transformStyle:"preserve-3d",
                                      transform: isRevealed ? "rotateY(0deg)" : "rotateY(-180deg)",
                                      // FIX: transition used to be gated on `isRevealing`, which turns false
                                      // as soon as the NEXT card starts its own reveal — for R cards (only
                                      // 280ms between reveals) this happened WHILE the current card's 0.6s
                                      // flip transition was still mid-flight, snapping `transition` to "none"
                                      // and causing the card to instantly pop to its end angle instead of
                                      // finishing the rotation smoothly. The transition rule now always
                                      // applies (each card only ever changes its transform once, from
                                      // face-down to face-up, so this never causes unwanted animation on
                                      // mount) — only the one-time shine-sweep/glow effects below still key
                                      // off `isRevealing`.
                                      transition: `transform ${card.rarity==="LR"?"0.9s":card.rarity==="UR"?"0.75s":"0.6s"} cubic-bezier(0.4,0,0.2,1)`,
                                      opacity: isPending && idx > cardRevealIndex ? 0.10 : 1,
                                    }}
                                    onClick={() => isRevealed && setRevealZoomedCard({image:card.image||"/placeholder.svg",name:card.name,rarity:card.rarity})}
                                  >
                                  {/* Card reveal shine — a single directional light sweep across the
                                      card face as it flips into view (the classic "legendary card"
                                      glint from Hearthstone/MTG Arena). Directional motion like this
                                      can never read as fireworks the way radiating particles do.
                                      Rare cards additionally get a soft uniform glow bloom behind them
                                      — a smooth scale+fade, not discrete sparks, so it stays a "glow"
                                      rather than a "burst". */}
                                  {isRevealing && (
                                    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden rounded-sm">
                                      {card.rarity !== "R" && (
                                        <div className="absolute inset-0 rounded-full" style={{
                                          background: `radial-gradient(circle, ${
                                            card.rarity==="LR" ? "rgba(251,146,60,0.55)" :
                                            card.rarity==="UR" ? "rgba(56,189,248,0.5)" : "rgba(168,85,247,0.45)"
                                          } 0%, transparent 70%)`,
                                          animation: "cardGlowBloom 0.6s ease-out forwards",
                                        }}/>
                                      )}
                                      <div className="absolute inset-[-30%]" style={{
                                        background: `linear-gradient(115deg, transparent 40%, rgba(255,255,255,${card.rarity==="R"?0.35:0.6}) 50%, transparent 60%)`,
                                        animation: `cardShineSweep ${card.rarity==="LR"?"0.7s":"0.55s"} ease-out ${card.rarity==="R"?"0.05s":"0.15s"} forwards`,
                                      }}/>
                                    </div>
                                  )}
                                    {/* FRONT — hidden until card turns */}
                                    <div className="absolute inset-0 overflow-hidden"
                                      style={{
                                        backfaceVisibility:"hidden",
                                        WebkitBackfaceVisibility:"hidden",
                                        boxShadow: isRevealed ? cardGlowStyle : "none",
                                        transition:"box-shadow 0.4s ease",
                                      }}>
                                      {/* Only render image when card is being revealed or already revealed */}
                                      {(isRevealed || isRevealing) && (
                                        <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="115px" className="object-cover" />
                                      )}
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
                                    {/* BACK */}
                                    <div className="absolute inset-0 overflow-hidden"
                                      style={{
                                        backfaceVisibility:"hidden",
                                        WebkitBackfaceVisibility:"hidden",
                                        transform:"rotateY(180deg)",
                                      }}>
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
          {packPhase === "done" && (() => {
            const allCards = packs.flatMap(p => p.cards)
            const bestRarity = allCards.some(c=>c.rarity==="LR") ? "LR" : allCards.some(c=>c.rarity==="UR") ? "UR" : allCards.some(c=>c.rarity==="SR") ? "SR" : "R"
            const bgOverlay = bestRarity==="LR"
              ? "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.28) 0%, rgba(251,146,60,0.14) 40%, transparent 70%)"
              : bestRarity==="UR"
              ? "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.22) 0%, rgba(99,102,241,0.12) 40%, transparent 70%)"
              : bestRarity==="SR"
              ? "radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.20) 0%, rgba(139,92,246,0.10) 40%, transparent 70%)"
              : "none"
            return (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4"
              style={{background: bgOverlay, animation:"fadeIn 0.5s ease-out forwards"}}>

              {/* Title block — pops in with spring */}
              <div style={{animation:"scaleIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards", opacity:0}}>
                <h2 className="text-3xl font-black text-white mb-0.5 tracking-wider text-center"
                  style={{textShadow:"0 0 30px rgba(255,255,255,0.35)"}}>
                  {pullCount === 1 ? "Cartas Obtidas!" : `${pullCount} Packs Abertos!`}
                </h2>
                <p className="text-slate-500 text-xs tracking-widest uppercase text-center">{allCards.length} cartas · toque para ampliar</p>
                {/* Best rarity callout */}
                {bestRarity !== "R" && (
                  <p className={`text-center text-base font-black mt-1 ${
                    bestRarity==="LR" ? "text-orange-400 drop-shadow-[0_0_14px_rgba(251,146,60,0.9)]" :
                    bestRarity==="UR" ? "text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]" :
                                        "text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.75)]"
                  }`}>
                    ★ {bestRarity==="LR"?"LENDÁRIO!":bestRarity==="UR"?"ULTRA RARO!":"SUPER RARO!"}
                  </p>
                )}
              </div>

              {/* Card grid — each card pops in with stagger */}
              <div className="max-h-[65vh] overflow-y-auto w-full max-w-5xl px-3 mt-4">
                {packs.map((pack, packIdx) => (
                  <div key={pack.id} className="mb-5">
                    {packs.length > 1 && <p className="text-slate-600 text-xs mb-2 pl-1 uppercase tracking-widest">Pack {packIdx + 1}</p>}
                    <div className="flex gap-2.5 justify-center flex-wrap">
                      {pack.cards.map((card, cardIdx) => {
                        const cardGlow =
                          card.rarity==="LR" ? "0 0 24px rgba(239,68,68,0.85), 0 0 48px rgba(251,191,36,0.45)" :
                          card.rarity==="UR" ? "0 0 20px rgba(56,189,248,0.85), 0 0 40px rgba(99,179,237,0.35)" :
                          card.rarity==="SR" ? "0 0 18px rgba(168,85,247,0.75), 0 0 36px rgba(192,132,252,0.25)" : "none"
                        const stagger = (packIdx*pack.cards.length+cardIdx)*0.065
                        return (
                          <div key={`${card.id}-final-${cardIdx}`}
                            className="flex flex-col items-center gap-1.5 cursor-pointer group"
                            style={{animation:`cardPopIn 0.42s cubic-bezier(0.34,1.56,0.64,1) ${stagger}s forwards`, opacity:0}}
                            onClick={() => setRevealZoomedCard({image:card.image||"/placeholder.svg",name:card.name,rarity:card.rarity})}
                          >
                            <div className="relative overflow-hidden transition-transform duration-200 group-hover:scale-110 group-hover:z-10"
                              style={{width:"86px", height:"122px", boxShadow:cardGlow}}>
                              <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="96px" className="object-cover" />
                              {/* LR rainbow shimmer */}
                              {card.rarity==="LR" && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                  background:"linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)",
                                  backgroundSize:"300% 100%", animation:"rainbowShift 1.5s linear infinite",
                                  padding:"2px", WebkitMask:"linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                  WebkitMaskComposite:"xor", maskComposite:"exclude"}} />
                              )}
                              {/* UR border */}
                              {card.rarity==="UR" && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                  border:"2px solid rgba(56,189,248,0.85)",
                                  boxShadow:"inset 0 0 10px rgba(56,189,248,0.25)",
                                  animation:"urDiamondPulse 1.8s ease-in-out infinite"}} />
                              )}
                              {/* SR border */}
                              {card.rarity==="SR" && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                  border:"1.5px solid rgba(168,85,247,0.75)",
                                  animation:"srGoldPulse 2s ease-in-out infinite"}} />
                              )}
                              {/* Hover lens-flare sweep — the Tailwind opacity-0/group-hover:opacity-100/
                                  transition-opacity classes on the wrapper already handle the show/hide;
                                  "group-hover:" is a class modifier and is not valid inside a raw CSS
                                  "animation" value, so it was silently dropped by the browser and never
                                  animated anything (a harmless but dead style declaration). */}
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200"
                                style={{background:"linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.22) 50%,transparent 60%)"}} />
                            </div>
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
                className="mt-4 px-10 py-3.5 text-lg font-black rounded-2xl border-2 border-emerald-400/50 transition-all hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-emerald-500/30"
                style={{background:"linear-gradient(135deg,#059669,#10b981,#34d399)",
                  animation:"scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.3s forwards",opacity:0,
                  boxShadow:"0 0 24px rgba(16,185,129,0.45)"}}>
                CONFIRMAR
              </button>
            </div>
            )
          })()}
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
          /* Small amplitude on purpose: switching the animation property
             (e.g. when the phase moves from floating to shaking) does NOT
             interpolate from wherever this loop was interrupted -- it hard-cuts
             straight to the next animation's 0% state. A large offset here
             would produce a visible snap at that instant; keeping the range
             tight keeps any such snap imperceptible. */
          0%,100% { transform: translateY(0px) rotate(0deg); }
          30%     { transform: translateY(-4px) rotate(0.3deg); }
          70%     { transform: translateY(-2px) rotate(-0.2deg); }
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
        /* ── NEW: Cinematic opening burst (ring + sweep + scattering shards) ── */
        @keyframes energyRingExpand {
          0%   { opacity: 0; transform: scale(0.3); border-width: 14px; }
          25%  { opacity: 0.9; }
          100% { opacity: 0; transform: scale(5.5); border-width: 0px; }
        }
        @keyframes lightSweepPass {
          0%   { opacity: 0; transform: translateX(-30%) rotate(0deg); }
          15%  { opacity: 1; }
          60%  { opacity: 0.5; }
          100% { opacity: 0; transform: translateX(30%) rotate(0deg); }
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

        /* ── NEW: Special SR/UR/LR reveal sequence ── */
        @keyframes raritySpecialFlash {
          0%   { opacity: 0; transform: scale(0.4); }
          30%  { opacity: 1; transform: scale(1.05); }
          70%  { opacity: 0.35; }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes rarityHoldPulse {
          0%   { opacity: 0.55; }
          50%  { opacity: 0.85; }
          100% { opacity: 0.55; }
        }
        /* ── NEW: Magic-circle rarity reveal (beam, rotating rings, drifting motes) --
           lightBeamDescend's duration is bound to holdMs (see holdMs below) so the
           grow-hold-fade cycle always finishes before the overlay unmounts. It
           previously used a fixed 0.6s and ended at opacity 0.8 via "forwards"
           regardless of rarity -- for SR (hold window only 420ms) the overlay was
           torn down mid-grow, yanking a still-bright beam off-screen abruptly;
           for every rarity the tail end never actually faded out, so whatever was
           left on screen the instant the overlay unmounted was still ~80% opaque.
           Both issues are what read as "the beam appears bugged". */
        @keyframes lightBeamDescend {
          0%   { opacity: 0;    transform: translateX(-50%) scaleY(0.3); transform-origin: top; }
          25%  { opacity: 0.9;  transform: translateX(-50%) scaleY(1);   transform-origin: top; }
          70%  { opacity: 0.75; transform: translateX(-50%) scaleY(1);   transform-origin: top; }
          100% { opacity: 0;    transform: translateX(-50%) scaleY(1);   transform-origin: top; }
        }
        @keyframes magicRingSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes magicRingSpinRev {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes moteDrift {
          0%   { opacity: 0; transform: translate(0, 0); }
          15%  { opacity: 1; }
          80%  { opacity: 0.7; }
          100% { opacity: 0; transform: translate(var(--sway, 20px), -160px); }
        }
        @keyframes raritySpecialLabel {
          0%   { opacity: 0; transform: scale(0.4) translateY(20px); letter-spacing: 0.1em; }
          60%  { transform: scale(1.1) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); letter-spacing: 0.3em; }
        }
        /* NEW: one-shot punch marking the flash-to-hold transition beat */
        @keyframes holdImpactPunch {
          0%   { opacity: 0.85; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(1.9); }
        }
        /* NEW: quick localized burst synced to the rank-badge landing */
        @keyframes labelStampFlash {
          0%   { opacity: 0.9; width: 10px; height: 10px; }
          100% { opacity: 0; width: 240px; height: 240px; }
        }

        @keyframes floatCard {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-8px); }
        }

        /* ── NEW: Tear spark burst ── */
        @keyframes tearSparkBurst {
          0%   { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          60%  { opacity: 0.8; }
          100% { transform: translateX(-50%) translateY(-22px) scale(0.2); opacity: 0; }
        }

        /* ── NEW: Chromatic aberration on shake ── */
        @keyframes chromaFlash {
          0%   { opacity: 0.9; }
          18%  { opacity: 0.75; }
          100% { opacity: 0; }
        }
        @keyframes chromaR {
          0%   { opacity: 0.85; transform: translate(-12px, 0); }
          65%  { opacity: 0.4; }
          100% { opacity: 0; transform: translate(-26px, 0); }
        }
        @keyframes chromaB {
          0%   { opacity: 0.85; transform: translate(12px, 0); }
          65%  { opacity: 0.4; }
          100% { opacity: 0; transform: translate(26px, 0); }
        }

        /* ── NEW: Shockwave ring on burst ── */
        @keyframes shockwaveRing {
          0%   { transform: scale(0); opacity: 1; }
          60%  { opacity: 0.55; }
          100% { transform: scale(9); opacity: 0; }
        }

        /* ── NEW: Card reveal shine — directional sweep + soft glow bloom (no radial particles) ── */
        @keyframes cardShineSweep {
          0%   { opacity: 0; transform: translateX(-60%) rotate(0deg); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(60%) rotate(0deg); }
        }
        @keyframes cardGlowBloom {
          0%   { opacity: 0; transform: scale(0.5); }
          35%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.5); }
        }
      `}</style>
    </div>
  )
}
