"use client"

import { useState, useEffect, useMemo } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import type { GameScreen } from "@/components/game/game-wrapper"
import {
  Swords,
  Bot,
  Users,
  Gift,
  BookOpen,
  Hammer,
  History,
  Settings,
  Coins,
  X,
  Sparkles,
  Star,
  ShoppingCart,
  User,
  Target,
} from "lucide-react"
import Image from "next/image"

interface MainMenuProps {
  onNavigate: (screen: GameScreen) => void
  statusMessage?: string | null
  onClearMessage?: () => void
}

export default function MainMenu({ onNavigate, statusMessage, onClearMessage }: MainMenuProps) {
  const { t } = useLanguage()
  const { coins, giftBoxes, claimGift, hasUnclaimedGifts, playerProfile, mobileMode } = useGame()
  const [showPlayMenu, setShowPlayMenu] = useState(false)
  const [showGiftBox, setShowGiftBox] = useState(false)
  const [claimedCard, setClaimedCard] = useState<ReturnType<typeof claimGift>>(null)
  const [claimedCoins, setClaimedCoins] = useState<number | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [isClaimingAll, setIsClaimingAll] = useState(false)
  const [claimAllResults, setClaimAllResults] = useState<{ cards: any[]; coins: number } | null>(null)
  
  // Auto-clear status message after 4 seconds
  useEffect(() => {
    if (statusMessage && onClearMessage) {
      const timer = setTimeout(() => onClearMessage(), 4000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage, onClearMessage])
  // Card rarity themes - rich metallic/jewel tones
  const CARD_THEMES = [
    { bg: "linear-gradient(145deg, #1e3a5f, #0c4a6e, #164e63)", border: "#38bdf8", glow: "rgba(56,189,248,0.35)", accent: "#7dd3fc", inner: "#0c4a6e" },
    { bg: "linear-gradient(145deg, #5b1a1a, #7f1d1d, #991b1b)", border: "#fca5a5", glow: "rgba(252,165,165,0.3)", accent: "#fecaca", inner: "#7f1d1d" },
    { bg: "linear-gradient(145deg, #713f12, #92400e, #78350f)", border: "#fcd34d", glow: "rgba(252,211,77,0.35)", accent: "#fde68a", inner: "#92400e" },
    { bg: "linear-gradient(145deg, #3b0764, #581c87, #6b21a8)", border: "#d8b4fe", glow: "rgba(216,180,254,0.3)", accent: "#e9d5ff", inner: "#581c87" },
    { bg: "linear-gradient(145deg, #064e3b, #065f46, #047857)", border: "#6ee7b7", glow: "rgba(110,231,183,0.3)", accent: "#a7f3d0", inner: "#065f46" },
    { bg: "linear-gradient(145deg, #1e293b, #334155, #475569)", border: "#e2e8f0", glow: "rgba(226,232,240,0.25)", accent: "#f1f5f9", inner: "#334155" },
  ]

  // Deterministic pseudo-random to avoid hydration mismatch (no Math.random)
  const seededRand = (seed: number) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280
    return x - Math.floor(x)
  }

  const fallingCards = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: (i * 5.1) % 94 + 3 + (seededRand(i + 1) * 3 - 1.5),
      delay: (i * 0.85) % 16 + seededRand(i + 20) * 2,
      duration: 18 + seededRand(i + 40) * 12,
      width: 48 + seededRand(i + 60) * 16,
      height: 68 + seededRand(i + 80) * 20,
      themeIndex: i % CARD_THEMES.length,
      shimmerAngle: 110 + seededRand(i + 100) * 40,
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  const handleOpenGift = (giftId: string) => {
    setIsOpening(true)
    const gift = giftBoxes.find((g) => g.id === giftId)
    setTimeout(() => {
      const card = claimGift(giftId)
      setClaimedCard(card)
      if (gift?.coinsReward && !card) {
        setClaimedCoins(gift.coinsReward)
      }
      setIsOpening(false)
    }, 1500)
  }

  const handleClaimAll = () => {
    setIsClaimingAll(true)
    const cards: any[] = []
    let totalCoins = 0
    
    setTimeout(() => {
      giftBoxes.forEach((gift) => {
        if (!gift.claimed) {
          const card = claimGift(gift.id)
          if (card) {
            cards.push(card)
          } else if (gift.coinsReward) {
            totalCoins += gift.coinsReward
          }
        }
      })
      
      setClaimAllResults({ cards, coins: totalCoins })
      setIsClaimingAll(false)
    }, 1500)
  }

  const unclaimedGifts = giftBoxes.filter((g) => !g.claimed)

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{background:"#050911"}}>

      {/* ── FULL-SCREEN BACKGROUND ── */}
      <div className="fixed inset-0 z-0">
        {/* Deep space base */}
        <div className="absolute inset-0" style={{background:"linear-gradient(180deg,#050911 0%,#081220 35%,#0a1828 60%,#060c18 100%)"}} />

        {/* Falling cards layer */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {fallingCards.map((card) => {
            const theme = CARD_THEMES[card.themeIndex]
            const swayDur = 5 + (card.id % 4) * 0.8
            const flipDur = 9 + (card.id % 5) * 1.5
            return (
              <div key={card.id} className="absolute falling-card-wrapper"
                style={{left:`${card.x}%`,animation:`fallingCard ${card.duration}s linear infinite`,animationDelay:`${card.delay}s`}}>
                <div style={{animation:`cardSway ${swayDur}s ease-in-out infinite`,animationDelay:`${card.delay*0.4}s`}}>
                  <div style={{animation:`cardFlipSpin ${flipDur}s ease-in-out infinite`,animationDelay:`${card.delay*0.7}s`,transformStyle:"preserve-3d"}}>
                    <div className="falling-card-face" style={{width:`${card.width}px`,height:`${card.height}px`,background:theme.bg,border:`1.5px solid ${theme.border}`,borderRadius:"8px",boxShadow:`0 0 16px ${theme.glow}`,backfaceVisibility:"hidden",overflow:"hidden",position:"relative"}}>
                      <div className="falling-card-holo" style={{position:"absolute",inset:0,background:`linear-gradient(${card.shimmerAngle}deg,transparent 30%,rgba(255,255,255,0.15) 50%,transparent 70%)`,animation:`cardHoloShift ${3+(card.id%3)*0.8}s ease-in-out infinite`}} />
                      <div style={{position:"absolute",top:"50%",left:"50%",width:"35%",height:"35%",transform:"translate(-50%,-50%) rotate(45deg)",border:`1px solid ${theme.accent}`,opacity:0.2,borderRadius:"2px"}} />
                    </div>
                    <div className="falling-card-face" style={{position:"absolute",top:0,left:0,width:`${card.width}px`,height:`${card.height}px`,background:"linear-gradient(145deg,#0f172a,#1e293b)",border:`1.5px solid ${theme.border}`,borderRadius:"8px",backfaceVisibility:"hidden",transform:"rotateY(180deg)"}} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Atmospheric glows */}
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 100% 55% at 50% 0%, rgba(6,182,212,0.10) 0%,transparent 55%)"}} />
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 70% 45% at 15% 80%, rgba(168,85,247,0.07) 0%,transparent 50%)"}} />
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 60% 40% at 85% 85%, rgba(251,191,36,0.05) 0%,transparent 45%)"}} />
        {/* Bottom fade for navbar legibility */}
        <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none" style={{background:"linear-gradient(to top, rgba(5,9,17,0.95) 0%, transparent 100%)"}} />
      </div>

      {/* ── TOP BAR ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-start justify-between px-4 pt-4 pb-2" style={{background:"linear-gradient(to bottom,rgba(5,9,17,0.80) 0%,transparent 100%)"}}>

        {/* Left: Player profile */}
        <button onClick={() => onNavigate("profile")}
          className="flex items-center gap-2.5 group transition-all hover:scale-[1.02]">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-cyan-400/40 shadow-lg shadow-cyan-500/20 group-hover:border-cyan-400/70 transition-colors">
              {playerProfile.avatarUrl ? (
                <Image src={playerProfile.avatarUrl||"/placeholder.svg"} alt={playerProfile.name} width={48} height={48} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center">
                  <span className="text-white text-lg font-black">{playerProfile.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            {mobileMode && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border border-black shadow" />}
          </div>
          <div className="text-left">
            <p className="text-white font-black text-sm leading-tight">{playerProfile.name}</p>
            <p className="text-cyan-400/70 text-[10px] font-medium tracking-wide">{playerProfile.title || "Jogador"}</p>
          </div>
        </button>

        {/* Right: Resources */}
        <div className="flex items-center gap-2">
          {/* Coins */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-amber-400/20" style={{background:"rgba(15,12,5,0.75)"}}>
            <div className="w-6 h-6 relative">
              <Image src="/images/icons/gacha-coin.png" alt="Coins" width={24} height={24} className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <span className="text-amber-300 font-black text-sm">{coins.toLocaleString()}</span>
          </div>

          {/* Gift box */}
          <button onClick={() => setShowGiftBox(true)}
            className="relative flex items-center justify-center w-10 h-10 rounded-2xl border border-white/10 transition-all hover:border-amber-400/40"
            style={{background:"rgba(15,12,5,0.75)"}}>
            <Gift className="w-5 h-5 text-amber-300" />
            {unclaimedGifts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-red-500 to-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg border border-black">
                {unclaimedGifts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── LOGO ── */}
      <div className="fixed top-16 left-4 z-30 pointer-events-none">
        <p className="text-[10px] text-cyan-400/50 font-mono tracking-widest uppercase mb-0.5">Card Game</p>
        <Image src="/images/gp-cg-logo.png" alt="Gear Perks" width={180} height={60} className="w-36 h-auto aura-logo opacity-90" priority />
      </div>

      {/* ── STATUS MESSAGE ── */}
      {statusMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold shadow-lg backdrop-blur-md ${
            statusMessage.includes("ativado") ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-amber-500/20 border-amber-500/40 text-amber-300"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusMessage.includes("ativado") ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
            {statusMessage}
          </div>
        </div>
      )}

      {/* ── SIDE FLOATING BUTTONS (right) ── */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3">
        <button onClick={() => onNavigate("deck-builder")}
          className="flex flex-col items-center gap-1 w-14 h-14 rounded-2xl border border-emerald-500/30 text-white transition-all hover:scale-105 hover:border-emerald-400/60 shadow-lg"
          style={{background:"linear-gradient(145deg,rgba(5,60,40,0.9),rgba(4,47,32,0.95))"}}>
          <Hammer className="w-5 h-5 text-emerald-400" />
          <span className="text-[9px] text-emerald-300/80 font-bold tracking-wide">DECK</span>
        </button>

        <button onClick={() => onNavigate("history")}
          className="flex flex-col items-center gap-1 w-14 h-14 rounded-2xl border border-slate-600/40 text-white transition-all hover:scale-105 hover:border-slate-400/60 shadow-lg"
          style={{background:"rgba(15,20,35,0.90)"}}>
          <History className="w-5 h-5 text-slate-300" />
          <span className="text-[9px] text-slate-400 font-bold tracking-wide">HIST.</span>
        </button>

        <button onClick={() => onNavigate("settings")}
          className="relative flex flex-col items-center gap-1 w-14 h-14 rounded-2xl border border-sky-500/30 text-white transition-all hover:scale-105 hover:border-sky-400/60 shadow-lg"
          style={{background:"rgba(5,18,40,0.90)"}}>
          <Settings className="w-5 h-5 text-sky-400" />
          <span className="text-[9px] text-sky-300/80 font-bold tracking-wide">CONFIG</span>
        </button>
      </div>

      {/* ── BOTTOM CHARACTER INFO (when not in play menu) ── */}
      {!showPlayMenu && (
        <div className="fixed bottom-28 left-3 z-30 max-w-[200px]">
          <div className="rounded-2xl border border-white/[0.08] px-4 py-3 backdrop-blur-md" style={{background:"rgba(5,9,17,0.78)"}}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight">Gear Perks</p>
                <p className="text-cyan-400/70 text-[10px]">Card Game v1.5</p>
              </div>
            </div>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              2025 Gear Perks Oficial Card Game, Made in BRAZIL
            </p>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40" style={{background:"linear-gradient(to top,rgba(4,7,15,0.97) 0%,rgba(4,7,15,0.90) 80%,transparent 100%)"}}>
        {!showPlayMenu ? (
          <div className="flex items-end justify-around px-4 pb-4 pt-2 max-w-lg mx-auto">

            {/* Coleção */}
            <NavBtn icon={<BookOpen className="w-5 h-5" />} label={t("collection")} onClick={() => onNavigate("collection")} color="cyan" />

            {/* Gacha */}
            <NavBtn icon={<Sparkles className="w-5 h-5" />} label={t("gacha")} onClick={() => onNavigate("gacha")} color="purple" />

            {/* PLAY — center big */}
            <button
              onClick={() => setShowPlayMenu(true)}
              className="relative flex flex-col items-center -mt-6"
              style={{filter:"drop-shadow(0 0 16px rgba(239,68,68,0.5))"}}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 via-orange-500 to-red-600 flex items-center justify-center shadow-2xl shadow-red-500/40 border-2 border-red-400/50 transition-all hover:scale-105 hover:shadow-red-500/60">
                <Swords className="w-7 h-7 text-white drop-shadow-lg" />
              </div>
              <span className="text-white text-[10px] font-black tracking-widest mt-1 uppercase">{t("play")}</span>
            </button>

            {/* Amigos */}
            <NavBtn icon={<Users className="w-5 h-5" />} label="Amigos" onClick={() => onNavigate("friends")} color="pink" />

            {/* Loja */}
            <NavBtn icon={<ShoppingCart className="w-5 h-5" />} label="Loja" onClick={() => onNavigate("shop")} color="amber" />
          </div>
        ) : (
          /* Play sub-menu */
          <div className="px-4 pb-5 pt-3 max-w-lg mx-auto space-y-2.5">
            <p className="text-slate-500 text-xs text-center tracking-widest uppercase mb-3">Escolha o modo de jogo</p>
            <button onClick={() => onNavigate("duel-bot")}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 border border-blue-400/30 transition-all hover:scale-[1.02] shadow-xl shadow-blue-500/20"
              style={{background:"linear-gradient(135deg,#1e40af,#3b82f6,#1d4ed8)"}}>
              <Bot className="h-6 w-6" />{t("vsBot")}
            </button>
            <button onClick={() => onNavigate("duel-player")}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 border border-orange-400/30 transition-all hover:scale-[1.02] shadow-xl shadow-orange-500/20"
              style={{background:"linear-gradient(135deg,#c2410c,#f97316,#ea580c)"}}>
              <Users className="h-6 w-6" />{t("vsPlayer")}
            </button>
            <button onClick={() => setShowPlayMenu(false)}
              className="w-full h-10 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm font-medium transition-colors hover:bg-white/5">
              {t("back")}
            </button>
          </div>
        )}
      </div>

      {/* ── GIFT BOX MODAL ── */}
      {showGiftBox && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-3xl max-w-md w-full p-6 relative border border-amber-500/20 shadow-2xl shadow-amber-500/10"
            style={{background:"linear-gradient(160deg,#0d1117,#0a0e1a)"}}>
            <button onClick={() => { setShowGiftBox(false); setClaimedCard(null); setClaimedCoins(null); setClaimAllResults(null) }}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex items-center justify-center gap-3 mb-6">
              <Gift className="w-7 h-7 text-amber-400" />
              <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Caixa de Presentes</h2>
            </div>

            {!claimedCard && !claimedCoins && !claimAllResults ? (
              unclaimedGifts.length > 0 ? (
                <>
                  {unclaimedGifts.length > 1 && (
                    <button onClick={handleClaimAll} disabled={isClaimingAll}
                      className="w-full gacha-btn h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 mb-4">
                      {isClaimingAll ? <><Sparkles className="w-4 h-4 animate-spin" />Coletando...</> : <><Gift className="w-4 h-4" />Coletar Tudo ({unclaimedGifts.length})</>}
                    </button>
                  )}
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {unclaimedGifts.map(gift => (
                      <div key={gift.id} className="bg-gradient-to-r from-pink-900/30 to-rose-900/30 border border-pink-500/30 rounded-2xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl shadow-lg shadow-pink-500/30"><Gift className="w-6 h-6 text-white" /></div>
                          <h3 className="font-bold text-white">{gift.title}</h3>
                        </div>
                        <p className="text-slate-300 text-sm mb-4">{gift.message}</p>
                        {gift.coinsReward && (<div className="flex items-center gap-2 mb-3 text-amber-400"><Coins className="w-4 h-4" /><span>+{gift.coinsReward} Moedas</span></div>)}
                        <button onClick={() => handleOpenGift(gift.id)} disabled={isOpening}
                          className="gacha-btn w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30">
                          {isOpening ? <><Sparkles className="w-4 h-4 animate-spin" />Abrindo...</> : "Abrir Presente"}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4"><Gift className="w-8 h-8 text-slate-500" /></div>
                  <p className="text-slate-400">Nenhum presente disponível no momento.</p>
                </div>
              )
            ) : claimedCard ? (
              <div className="flex flex-col items-center py-4">
                <p className="text-amber-400 font-bold text-lg mb-4">Você recebeu:</p>
                <div className="relative animate-float">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 blur-2xl opacity-50 animate-pulse" />
                  <div className={`relative w-40 h-56 rounded-xl overflow-hidden shadow-2xl ${claimedCard.rarity==="LR"?"rarity-lr":claimedCard.rarity==="UR"?"rarity-ur":claimedCard.rarity==="SR"?"rarity-sr":"rarity-r"}`}>
                    <Image src={claimedCard.image||"/placeholder.svg"} alt={claimedCard.name} fill sizes="160px" className="object-cover" />
                  </div>
                </div>
                <h3 className="mt-4 text-xl font-bold text-white text-center">{claimedCard.name}</h3>
                <span className={`mt-2 px-4 py-1 rounded-full text-sm font-bold ${claimedCard.rarity==="LR"?"bg-gradient-to-r from-red-500 to-amber-500 text-white":claimedCard.rarity==="UR"?"bg-gradient-to-r from-amber-500 to-yellow-400 text-black":claimedCard.rarity==="SR"?"bg-purple-500 text-white":"bg-slate-500 text-white"}`}>{claimedCard.rarity}</span>
                <button onClick={() => { setShowGiftBox(false); setClaimedCard(null) }} className="mt-6 gacha-btn px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/30">Fechar</button>
              </div>
            ) : claimAllResults ? (
              <div className="flex flex-col items-center py-4">
                <p className="text-amber-400 font-bold text-lg mb-4">Você recebeu:</p>
                <div className="w-full max-h-[50vh] overflow-y-auto space-y-3 mb-4">
                  {claimAllResults.cards.length > 0 && (
                    <div className="bg-slate-800/50 rounded-2xl p-4">
                      <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Star className="w-5 h-5 text-amber-400" />Cartas ({claimAllResults.cards.length})</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {claimAllResults.cards.map((card, index) => (
                          <div key={index} className="relative group">
                            <div className={`relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg ${card.rarity==="LR"?"rarity-lr":card.rarity==="UR"?"rarity-ur":card.rarity==="SR"?"rarity-sr":"rarity-r"}`}>
                              <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="100px" className="object-cover" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {claimAllResults.coins > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-2xl p-4">
                      <div className="flex items-center justify-center gap-3">
                        <Image src="/images/icons/gacha-coin.png" alt="Gacha Coin" width={40} height={40} className="w-10 h-10 object-contain" />
                        <span className="text-2xl font-bold text-amber-400">+{claimAllResults.coins}</span>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => { setShowGiftBox(false); setClaimAllResults(null) }} className="gacha-btn px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/30">Fechar</button>
              </div>
            ) : claimedCoins ? (
              <div className="flex flex-col items-center py-8">
                <p className="text-amber-400 font-bold text-lg mb-4">Você recebeu:</p>
                <div className="relative animate-float">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-400 blur-2xl opacity-50 animate-pulse" />
                  <div className="relative flex items-center gap-3 bg-gradient-to-r from-amber-500 to-yellow-500 px-8 py-6 rounded-2xl shadow-2xl shadow-amber-500/30">
                    <Coins className="w-12 h-12 text-white" />
                    <span className="text-4xl font-bold text-white">+{claimedCoins}</span>
                  </div>
                </div>
                <p className="mt-4 text-xl font-bold text-white">Moedas de Gacha!</p>
                <button onClick={() => { setShowGiftBox(false); setClaimedCoins(null) }} className="mt-6 gacha-btn px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/30">Fechar</button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Nav button helper ─────────────────────────────────────────────────────────
function NavBtn({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  const colors: Record<string, string> = {
    cyan:   "text-cyan-400 group-hover:text-cyan-300",
    purple: "text-purple-400 group-hover:text-purple-300",
    pink:   "text-pink-400 group-hover:text-pink-300",
    amber:  "text-amber-400 group-hover:text-amber-300",
    emerald:"text-emerald-400 group-hover:text-emerald-300",
  }
  return (
    <button onClick={onClick}
      className="group flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all hover:bg-white/5 min-w-[52px]">
      <span className={`${colors[color]||"text-slate-300"} transition-colors`}>{icon}</span>
      <span className="text-slate-400 group-hover:text-white text-[10px] font-semibold tracking-wide transition-colors whitespace-nowrap">{label}</span>
    </button>
  )
}
