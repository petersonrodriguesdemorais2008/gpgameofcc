"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, type Card } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Heart, Sparkles, Star, Zap } from "lucide-react"
import Image from "next/image"

interface GachaScreenProps {
  onBack: () => void
}

type BannerType = "fsg" | "anl" | "friendship"

interface PackData {
  id: number
  cards: Card[]
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
  },
  anl: {
    name: "Ascensão Nórdica: Legends",
    code: "ANL-01",
    packImage: "/images/gacha/pack-anl.png",
    bannerImage: "/images/gacha/anl-anuncio.png",
    color: "from-orange-600 via-red-600 to-rose-600",
    accentColor: "text-orange-400",
  },
  friendship: {
    name: "Gacha de Amizade",
    code: "FP-01",
    packImage: "/images/gacha/pack-fsg.png",
    bannerImage: "/images/gacha/fsg-anuncio.png",
    color: "from-pink-500 via-rose-500 to-fuchsia-500",
    accentColor: "text-pink-400",
  },
}

export default function GachaScreen({ onBack }: GachaScreenProps) {
  const { t } = useLanguage()
  const { coins, setCoins, addToCollection, allCards, spendableFP, spendFriendPoints } = useGame()
  const [currentBanner, setCurrentBanner] = useState<BannerType>("fsg")
  
  // States de animação
  const [isOpening, setIsOpening] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [rarityTier, setRarityTier] = useState<"normal" | "rare" | "epic" | "legendary">("normal")
  const [fpReward, setFpReward] = useState<number | null>(null)
  
  const [packs, setPacks] = useState<PackData[]>([])
  const [currentPackIndex, setCurrentPackIndex] = useState(0)
  const [packPhase, setPackPhase] = useState<"entering" | "shaking" | "opening" | "revealing" | "done">("entering")
  const [cardRevealIndex, setCardRevealIndex] = useState(-1)
  const [screenShake, setScreenShake] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  
  const COST_SINGLE = 1
  const COST_MULTI = 10
  const CARDS_PER_PACK = 4
  const FP_COST = 50

  const banner = BANNERS[currentBanner]

  // Helpers de Estilo
  const getRarityUI = (rarity: string) => {
    switch (rarity) {
      case "LR": return { color: "from-red-600 via-purple-600 to-orange-500", shadow: "rgba(239, 68, 68, 0.8)", label: "LENDÁRIO" }
      case "UR": return { color: "from-amber-400 via-yellow-300 to-amber-500", shadow: "rgba(251, 191, 36, 0.7)", label: "ULTRA RARO" }
      case "SR": return { color: "from-purple-500 via-fuchsia-400 to-purple-600", shadow: "rgba(168, 85, 247, 0.6)", label: "SUPER RARO" }
      default: return { color: "from-slate-400 to-slate-600", shadow: "rgba(148, 163, 184, 0.3)", label: "RARO" }
    }
  }

  // --- Sistema de Partículas ---
  const drawParticles = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: any[] = []
    const tierConfig = {
      normal: { colors: ["#94a3b8", "#f1f5f9"], count: 40 },
      rare: { colors: ["#a855f7", "#e9d5ff"], count: 60 },
      epic: { colors: ["#fbbf24", "#fef3c7"], count: 80 },
      legendary: { colors: ["#ef4444", "#fb7185", "#fbbf24"], count: 120 },
    }
    const config = tierConfig[rarityTier]

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      if (particles.length < config.count && Math.random() > 0.5) {
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 10,
          vx: (Math.random() - 0.5) * 2,
          vy: -1 - Math.random() * 3,
          size: Math.random() * 3 + 1,
          color: config.colors[Math.floor(Math.random() * config.colors.length)],
          alpha: 1,
          life: 0.01 + Math.random() * 0.02
        })
      }

      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.alpha -= p.life
        if (p.alpha <= 0) particles.splice(i, 1)
        
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        
        // Glow effect
        if (rarityTier === "legendary") {
            ctx.shadowBlur = 10; ctx.shadowColor = p.color
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }
    animate()
  }, [rarityTier])

  useEffect(() => {
    if (isOpening || showResults) drawParticles()
    return () => cancelAnimationFrame(animationRef.current!)
  }, [isOpening, showResults, drawParticles])

  // --- Lógica de Workflow ---
  
  useEffect(() => {
    if (!isOpening) return
    
    const timers: NodeJS.Timeout[] = []

    if (packPhase === "entering") {
      timers.push(setTimeout(() => setPackPhase("shaking"), 800))
    } else if (packPhase === "shaking") {
      setScreenShake(true)
      timers.push(setTimeout(() => {
        setScreenShake(false)
        setPackPhase("opening")
      }, 1000))
    } else if (packPhase === "opening") {
      timers.push(setTimeout(() => {
        setPackPhase("revealing")
        setCardRevealIndex(0)
      }, 600))
    }

    return () => timers.forEach(clearTimeout)
  }, [packPhase, isOpening])

  // Revelação de cartas interna ao pack
  useEffect(() => {
    if (packPhase === "revealing" && cardRevealIndex < CARDS_PER_PACK) {
      const t = setTimeout(() => setCardRevealIndex(prev => prev + 1), 400)
      return () => clearTimeout(t)
    } else if (packPhase === "revealing" && cardRevealIndex >= CARDS_PER_PACK) {
      const t = setTimeout(() => {
        if (currentPackIndex < packs.length - 1) {
          setCurrentPackIndex(prev => prev + 1)
          setCardRevealIndex(-1)
          setPackPhase("entering")
        } else {
          setPackPhase("done")
          setShowResults(true)
          setIsOpening(false)
        }
      }, 1200)
      return () => clearTimeout(t)
    }
  }, [cardRevealIndex, packPhase])

  const pullGacha = (count: number) => {
    const totalCost = count === 1 ? COST_SINGLE : COST_MULTI
    if (coins < totalCost) return

    setCoins(coins - totalCost)
    
    // Gerar cartas
    const newPacks: PackData[] = []
    const allPulledCards: Card[] = []

    for (let p = 0; p < count; p++) {
      const packCards: Card[] = []
      for (let i = 0; i < CARDS_PER_PACK; i++) {
        const rand = Math.random() * 100
        let rarity: "R" | "SR" | "UR" | "LR"
        if (rand < 1) rarity = "LR"
        else if (rand < 8) rarity = "UR"
        else if (rand < 30) rarity = "SR"
        else rarity = "R"

        const pool = allCards.filter(c => c.rarity === rarity)
        const selectedCard = pool[Math.floor(Math.random() * pool.length)] || allCards[0]
        const instance = { ...selectedCard, id: `${selectedCard.id}-${Date.now()}-${p}-${i}` }
        packCards.push(instance)
        allPulledCards.push(instance)
      }

      const rarities = ["R", "SR", "UR", "LR"]
      const highest = packCards.reduce((prev, curr) => 
        rarities.indexOf(curr.rarity) > rarities.indexOf(prev) ? curr.rarity : prev, "R" as any)

      newPacks.push({ id: p, cards: packCards, highestRarity: highest })
    }

    // Tier global da animação
    if (allPulledCards.some(c => c.rarity === "LR")) setRarityTier("legendary")
    else if (allPulledCards.some(c => c.rarity === "UR")) setRarityTier("epic")
    else if (allPulledCards.some(c => c.rarity === "SR")) setRarityTier("rare")
    else setRarityTier("normal")

    setPacks(newPacks)
    setIsOpening(true)
    setPackPhase("entering")
    setCurrentPackIndex(0)
    addToCollection(allPulledCards)
  }

  // --- Gacha de Amizade ---
  const pullFriendshipGacha = () => {
    if (spendableFP < FP_COST || !spendFriendPoints(FP_COST)) return
    setIsOpening(true)
    const lucky = Math.random() < 0.2
    const reward = lucky ? 3000 : 300
    setRarityTier(lucky ? "legendary" : "rare")
    
    setTimeout(() => {
        setFpReward(reward)
        setCoins(coins + reward)
        setShowResults(true)
        setIsOpening(false)
    }, 2500)
  }

  const closeResults = () => {
    setShowResults(false); setIsOpening(false)
    setPacks([]); setFpReward(null)
    setRarityTier("normal")
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-slate-950">
      {/* Background Decorativo */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
      </div>

      {/* Header UI */}
      <div className="relative z-20 flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <Button onClick={onBack} variant="ghost" className="text-slate-300">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-1.5 rounded-full border border-amber-500/30">
                <Image src="/images/icons/gacha-coin.png" alt="Coin" width={24} height={24} />
                <span className="font-bold text-amber-400">{coins}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-1.5 rounded-full border border-pink-500/30">
                <Heart className="w-4 h-4 text-pink-500 fill-current" />
                <span className="font-bold text-pink-400">{spendableFP}</span>
            </div>
        </div>
      </div>

      {/* Main Gacha Screen */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        {currentBanner !== 'friendship' ? (
          <div className="w-full max-w-4xl space-y-8 animate-in fade-in zoom-in duration-500">
            {/* Tabs */}
            <div className="flex justify-center gap-2">
                {Object.keys(BANNERS).map((key) => (
                    <button
                        key={key}
                        onClick={() => setCurrentBanner(key as any)}
                        className={`px-6 py-2 rounded-t-lg font-bold transition-all ${
                            currentBanner === key ? 'bg-white/10 text-white border-b-2 border-cyan-400' : 'text-slate-500'
                        }`}
                    >
                        {key.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* Banner Preview */}
            <div className="relative group overflow-hidden rounded-2xl border-2 border-white/10 aspect-[21/9] shadow-2xl">
               <Image 
                src={banner.bannerImage} 
                alt="Banner" 
                fill 
                className="object-cover group-hover:scale-105 transition-transform duration-700" 
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
               <div className="absolute bottom-6 left-8">
                 <h2 className={`text-4xl font-black italic tracking-tighter ${banner.accentColor} drop-shadow-md`}>
                   {banner.name}
                 </h2>
                 <p className="text-white/60 font-medium">Chance de DROP aumentada para {banner.code}!</p>
               </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-6">
                <Button 
                    onClick={() => pullGacha(1)} 
                    disabled={isOpening || coins < COST_SINGLE}
                    className="h-16 px-8 bg-gradient-to-b from-slate-700 to-slate-900 border border-white/20 hover:scale-105 transition-all group"
                >
                    <div className="flex flex-col items-center">
                        <span className="text-xs text-slate-400">Puxar 1x</span>
                        <div className="flex items-center gap-1 font-bold">
                            <Image src="/images/icons/gacha-coin.png" alt="coin" width={18} height={18} /> {COST_SINGLE}
                        </div>
                    </div>
                </Button>

                <Button 
                    onClick={() => pullGacha(10)} 
                    disabled={isOpening || coins < COST_MULTI}
                    className="h-16 px-12 bg-gradient-to-b from-blue-600 to-purple-700 border border-white/20 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-105 transition-all relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <div className="flex flex-col items-center relative z-10">
                        <span className="text-xs text-blue-200">Pack Especial</span>
                        <div className="flex items-center gap-1 font-bold text-lg">
                            <Image src="/images/icons/gacha-coin.png" alt="coin" width={22} height={22} /> {COST_MULTI}
                        </div>
                    </div>
                    <div className="absolute -top-1 -right-4 bg-red-500 text-[10px] px-4 py-0.5 rotate-12 font-black">LUCKY!</div>
                </Button>
            </div>
          </div>
        ) : (
          <div className="text-center animate-in slide-in-from-bottom duration-500">
              <div className="w-32 h-32 mx-auto bg-pink-500/20 rounded-full flex items-center justify-center mb-6 border border-pink-500/50 shadow-[0_0_40px_rgba(236,72,153,0.3)]">
                  <Heart className="w-16 h-16 text-pink-500 fill-current animate-pulse" />
              </div>
              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400 mb-2">GACHA DE AMIZADE</h2>
              <p className="text-slate-400 max-w-md mx-auto mb-10">Troque seus pontos acumulados enviando e recebendo corações por Moedas de Gacha puras!</p>
              
              <Button 
                onClick={pullFriendshipGacha} 
                disabled={isOpening || spendableFP < FP_COST}
                className="bg-pink-600 hover:bg-pink-500 text-white font-black px-12 py-8 rounded-2xl border-b-4 border-pink-800 hover:border-b-2 active:translate-y-1 transition-all"
              >
                  PUXAR RECOMPENSA ({FP_COST} FP)
              </Button>
          </div>
        )}
      </main>

      {/* CINEMATIC OVERLAY */}
      {(isOpening || (showResults && packs.length > 0)) && (
        <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-500 ${screenShake ? 'animate-shake' : ''}`}>
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

          {/* SKIP BUTTON */}
          {!showResults && (
            <button 
                onClick={closeResults}
                className="absolute top-8 right-8 z-50 px-6 py-2 rounded-full bg-white/5 border border-white/20 text-white/50 hover:bg-white/20 transition-all uppercase text-xs font-bold tracking-widest"
            >
                Pular Animação
            </button>
          )}

          {/* ANIMAÇÃO DE PACK ATUAL */}
          {!showResults && packs[currentPackIndex] && (
            <div className="relative z-10 w-full flex flex-col items-center">
                {/* Info superior */}
                {packs.length > 1 && (
                    <div className="mb-12 text-slate-400 font-mono tracking-widest bg-white/5 px-6 py-1 rounded-full border border-white/10">
                        ABRINDO PACK <span className="text-white">{currentPackIndex + 1}</span> / {packs.length}
                    </div>
                )}

                {/* Container do Pack / Reveal */}
                <div className="relative h-[400px] w-full flex items-center justify-center">
                    
                    {/* Visual do Pack de Cartas (Fisico) */}
                    {(packPhase === "entering" || packPhase === "shaking" || packPhase === "opening") && (
                        <div 
                          className="relative w-56 h-80 transition-all"
                          style={{
                              animation: packPhase === "entering" ? 'packIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 
                                         packPhase === "shaking" ? 'packShaking 0.1s infinite' : 'packOpen 0.5s ease-out forwards'
                          }}
                        >
                            <div className="absolute inset-0 bg-white/20 blur-3xl scale-150 animate-pulse" />
                            <Image 
                                src={banner.packImage} 
                                alt="Pack" 
                                fill 
                                className="object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
                            />
                        </div>
                    )}

                    {/* Explosão de Luz */}
                    {packPhase === "opening" && (
                        <div className="absolute inset-0 bg-white animate-flashOut z-50" />
                    )}

                    {/* Revelação de Cartas (Cards do Pack) */}
                    {packPhase === "revealing" && (
                        <div className="flex gap-4 md:gap-8 px-4 max-w-6xl overflow-visible">
                            {packs[currentPackIndex].cards.map((card, idx) => {
                                const ui = getRarityUI(card.rarity)
                                const isVisible = idx <= cardRevealIndex
                                
                                return (
                                    <div 
                                        key={card.id} 
                                        className="relative transition-all duration-700"
                                        style={{ 
                                            opacity: isVisible ? 1 : 0, 
                                            transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(100px)',
                                            perspective: '1000px'
                                        }}
                                    >
                                        <div 
                                          className={`relative w-28 h-40 md:w-36 md:h-52 rounded-xl border-2 shadow-2xl overflow-hidden`}
                                          style={{ 
                                            borderColor: isVisible ? ui.shadow : 'transparent',
                                            boxShadow: `0 0 30px ${ui.shadow}`
                                          }}
                                        >
                                           <Image src={card.image} alt="Card" fill className="object-cover" />
                                           
                                           {/* Brilho da Rariadade */}
                                           {card.rarity === 'LR' && (
                                               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent -translate-x-full animate-shineCard" />
                                           )}
                                        </div>
                                        <div className={`mt-3 text-center text-[10px] md:text-xs font-black p-1 rounded bg-gradient-to-r ${ui.color} text-white`}>
                                            {ui.label}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Legend do Pack Ativo */}
                <div className="mt-16 h-8 text-xl font-black italic tracking-tighter opacity-70 flex items-center gap-2">
                    {packPhase === 'shaking' && <Zap className="text-yellow-400 fill-current animate-bounce" />}
                    <span className="text-white">
                        {packPhase === 'entering' && 'PREPARANDO PACK...'}
                        {packPhase === 'shaking' && 'ALGO ESTÁ VINDO...'}
                        {packPhase === 'revealing' && (
                             <span className={getRarityUI(packs[currentPackIndex].highestRarity).label !== 'RARO' ? 'text-amber-400 uppercase scale-125 block animate-pulse' : ''}>
                                {getRarityUI(packs[currentPackIndex].highestRarity).label}!
                             </span>
                        )}
                    </span>
                </div>
            </div>
          )}

          {/* RESULTADO FINAL (GRID DE TODAS AS CARTAS) */}
          {showResults && packs.length > 0 && (
             <div className="relative z-10 w-full max-w-5xl h-full flex flex-col p-10 overflow-hidden animate-in fade-in zoom-in duration-500">
                <h3 className="text-4xl font-black text-white text-center mb-8 tracking-tighter italic">RECOMPENSAS DO GAHA</h3>
                
                <div className="flex-1 overflow-y-auto pr-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 content-start pb-20">
                    {packs.flatMap(p => p.cards).map((card, idx) => {
                         const ui = getRarityUI(card.rarity)
                         return (
                            <div 
                                key={card.id + idx}
                                className="group relative aspect-[3/4.5] bg-slate-800 rounded-lg overflow-hidden border border-white/10 hover:border-white/40 transition-all hover:z-20 hover:scale-110"
                                style={{ 
                                    animation: `popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.05}s forwards`,
                                    opacity: 0 
                                }}
                            >
                                <Image src={card.image} alt="card" fill className="object-cover group-hover:brightness-110" />
                                <div className={`absolute bottom-0 inset-x-0 text-[10px] font-bold text-center py-0.5 text-white bg-gradient-to-r ${ui.color}`}>
                                    {card.rarity}
                                </div>
                            </div>
                         )
                    })}
                </div>

                <div className="absolute bottom-8 left-0 right-0 flex justify-center pt-8 bg-gradient-to-t from-black via-black/80 to-transparent">
                   <Button onClick={closeResults} size="lg" className="px-20 py-8 text-xl font-black bg-white text-black hover:bg-cyan-400 transition-colors border-none shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                      CONFIRMAR RECOMPENSAS
                   </Button>
                </div>
             </div>
          )}
        </div>
      )}

      {/* ESTILO GLOBAL DE ANIMAÇÕES */}
      <style jsx global>{`
        @keyframes packIn {
          from { transform: translateY(400px) scale(0.5); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes packShaking {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-5px) rotate(-1deg); }
          75% { transform: translateX(5px) rotate(1deg); }
        }
        @keyframes packOpen {
          to { transform: scale(3) rotate(5deg); filter: brightness(5) blur(10px); opacity: 0; }
        }
        @keyframes flashOut {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes popIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes shineCard {
          to { transform: translateX(200%); }
        }
        .animate-flashOut { animation: flashOut 0.6s ease-out forwards; }
        .animate-shineCard { animation: shineCard 2s linear infinite; }
        .animate-shake { animation: packShaking 0.1s infinite; }
      `}</style>
    </div>
  )
}
