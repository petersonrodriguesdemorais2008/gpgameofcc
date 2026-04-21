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
  const { coins, setCoins, giftBoxes, claimGift, hasUnclaimedGifts, playerProfile, mobileMode } = useGame()
  const spendCoins = (amount: number) => setCoins((prev: number) => Math.max(0, prev - amount))
  const [showPlayMenu, setShowPlayMenu] = useState(false)
  const [showGiftBox, setShowGiftBox] = useState(false)
  const [claimedCard, setClaimedCard] = useState<ReturnType<typeof claimGift>>(null)
  const [claimedCoins, setClaimedCoins] = useState<number | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [isClaimingAll, setIsClaimingAll] = useState(false)
  const [claimAllResults, setClaimAllResults] = useState<{ cards: any[]; coins: number } | null>(null)
  const [showWallpaperModal, setShowWallpaperModal] = useState(false)

  // ── Wallpaper system ──────────────────────────────────────────────────────
  const WALLPAPERS = [
    {
      id: "default",
      name: "Padrão",
      description: "Fundo padrão do menu com cartas caindo",
      image: null,
      cost: 0,
      free: true,
    },
    {
      id: "fehnon_wallpaper",
      name: "Fehnon Wallpaper",
      description: "Arte do Fehnon Hoskie",
      image: "/images/wallpapers/fehnon_wallpaper.png",
      cost: 0,
      free: true,
    },
    {
      id: "arthur_wallpaper",
      name: "Arthur Wallpaper",
      description: "Arte do Arthur com o Vazio",
      image: "/images/wallpapers/arthur_wallpaper.png",
      cost: 500,
      free: false,
    },
    {
      id: "fsg_wallpaper",
      name: "FSG Wallpaper",
      description: "Arte dos Fundadores da Santa Guerra",
      image: "/images/wallpapers/fsg_wallpaper.png",
      cost: 500,
      free: false,
    },
    {
      id: "fsg_wallpaper_2",
      name: "FSG Wallpaper 2",
      description: "Arte especial dos personagens",
      image: "/images/wallpapers/fsg_wallpaper_2.png",
      cost: 500,
      free: false,
    },
    {
      id: "fsg_wallpaper_3",
      name: "FSG Wallpaper 3",
      description: "Arte do Fehnon e Morgana",
      image: "/images/wallpapers/fsg_wallpaper_3.png",
      cost: 500,
      free: false,
    },
    {
      id: "fsg_wallpaper_4",
      name: "FSG Wallpaper 4",
      description: "Arte do grupo FSG",
      image: "/images/wallpapers/fsg_wallpaper_4.png",
      cost: 500,
      free: false,
    },
  ]

  const WALLPAPER_LS_KEY = "gpgame_selected_wallpaper"
  const UNLOCKED_LS_KEY = "gpgame_unlocked_wallpapers"

  const [selectedWallpaper, setSelectedWallpaper] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(WALLPAPER_LS_KEY) ?? "fehnon_wallpaper"
    }
    return "fehnon_wallpaper"
  })

  const [unlockedWallpapers, setUnlockedWallpapers] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(UNLOCKED_LS_KEY)
        const parsed = saved ? JSON.parse(saved) : []
        // Always include free ones
        const base = ["default", "fehnon_wallpaper"]
        return [...new Set([...base, ...parsed])]
      } catch { return ["default", "fehnon_wallpaper"] }
    }
    return ["default", "fehnon_wallpaper"]
  })

  const activeWallpaper = WALLPAPERS.find(w => w.id === selectedWallpaper)

  const handleSelectWallpaper = (id: string) => {
    setSelectedWallpaper(id)
    if (typeof window !== "undefined") localStorage.setItem(WALLPAPER_LS_KEY, id)
  }

  const handleUnlockWallpaper = (wallpaper: typeof WALLPAPERS[0]) => {
    if (coins < wallpaper.cost) return
    spendCoins(wallpaper.cost)
    const next = [...new Set([...unlockedWallpapers, wallpaper.id])]
    setUnlockedWallpapers(next)
    if (typeof window !== "undefined") localStorage.setItem(UNLOCKED_LS_KEY, JSON.stringify(next))
    handleSelectWallpaper(wallpaper.id)
  }

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
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{background:"transparent"}}>

      {/* ── FULL-SCREEN BACKGROUND ── */}
      <div className="fixed inset-0 z-0">
        {/* Wallpaper or deep space base */}
        {activeWallpaper?.image ? (
          <>
            <div className="absolute inset-0" style={{
              backgroundImage: `url(${activeWallpaper.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center center",
              backgroundRepeat: "no-repeat",
            }} />
            {/* No dark overlay — wallpaper at full visibility */}
          </>
        ) : (
          <div className="absolute inset-0" style={{background:"linear-gradient(180deg,#050911 0%,#081220 35%,#0a1828 60%,#060c18 100%)"}} />
        )}

        {/* Falling cards layer — hidden when wallpaper is active */}
        {!activeWallpaper?.image && (
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
        )}

        {/* Atmospheric glows */}
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 100% 55% at 50% 0%, rgba(6,182,212,0.10) 0%,transparent 55%)"}} />
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 70% 45% at 15% 80%, rgba(168,85,247,0.07) 0%,transparent 50%)"}} />
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 60% 40% at 85% 85%, rgba(251,191,36,0.05) 0%,transparent 45%)"}} />
        {/* Bottom fade for navbar legibility */}
        {/* Bottom fade removed for full wallpaper visibility */}
      </div>

      {/* ── TOP BAR ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-3 pb-3"
        style={{background:"linear-gradient(to bottom,rgba(3,6,14,0.55) 0%,rgba(3,6,14,0.20) 70%,transparent 100%)",backdropFilter:"blur(4px)"}}>

        {/* Left: Player profile */}
        <button onClick={() => onNavigate("profile")}
          className="flex items-center gap-2.5 group transition-all duration-200 hover:scale-[1.03]">
          <div className="relative">
            {/* Avatar ring glow */}
            <div className="absolute inset-0 rounded-2xl bg-cyan-400/20 blur-md group-hover:bg-cyan-400/35 transition-all" style={{transform:"scale(1.15)"}} />
            <div className="relative w-11 h-11 rounded-2xl overflow-hidden border border-cyan-400/50 shadow-lg shadow-cyan-500/25 group-hover:border-cyan-300/70 transition-all">
              {playerProfile.avatarUrl ? (
                <Image src={playerProfile.avatarUrl||"/placeholder.svg"} alt={playerProfile.name} width={44} height={44} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center">
                  <span className="text-white text-base font-black">{playerProfile.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            {mobileMode && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black/80 shadow" />}
          </div>
          <div className="text-left">
            <p className="text-white font-black text-sm leading-tight tracking-wide">{playerProfile.name}</p>
            <p className="text-cyan-400/60 text-[10px] font-medium tracking-wider">{playerProfile.title || "Jogador"}</p>
          </div>
        </button>

        {/* Right: Resources */}
        <div className="flex items-center gap-2">
          {/* Coins */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-400/20 shadow-inner"
            style={{background:"linear-gradient(135deg,rgba(20,14,3,0.90),rgba(30,20,5,0.85))"}}>
            <div className="w-5 h-5 relative">
              <Image src="/images/icons/gacha-coin.png" alt="Coins" width={20} height={20} className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <span className="text-amber-300 font-black text-sm tabular-nums">{coins.toLocaleString()}</span>
          </div>

          {/* Gift box */}
          <button onClick={() => setShowGiftBox(true)}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-amber-500/20 transition-all hover:border-amber-400/50 hover:scale-105"
            style={{background:"linear-gradient(135deg,rgba(20,14,3,0.90),rgba(30,20,5,0.85))"}}>
            <Gift className="w-4 h-4 text-amber-300" />
            {unclaimedGifts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-red-500 to-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-lg border border-black/50">
                {unclaimedGifts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── LOGO ── */}
      <div className="fixed top-16 left-4 z-30 pointer-events-none">
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
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2.5">
        <button onClick={() => onNavigate("deck-builder")}
          className="flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl border transition-all hover:scale-110 shadow-xl"
          style={{background:"linear-gradient(145deg,rgba(4,50,33,0.95),rgba(3,38,25,0.98))",borderColor:"rgba(52,211,153,0.25)",boxShadow:"0 4px 20px rgba(16,185,129,0.12)"}}>
          <Hammer className="w-5 h-5 text-emerald-400" />
          <span className="text-[9px] text-emerald-300/70 font-bold tracking-widest">DECK</span>
        </button>

        <button onClick={() => onNavigate("history")}
          className="flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl border transition-all hover:scale-110 shadow-xl"
          style={{background:"rgba(12,16,28,0.95)",borderColor:"rgba(148,163,184,0.18)",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>
          <History className="w-5 h-5 text-slate-300" />
          <span className="text-[9px] text-slate-500 font-bold tracking-widest">HIST.</span>
        </button>

        <button onClick={() => onNavigate("settings")}
          className="flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl border transition-all hover:scale-110 shadow-xl"
          style={{background:"linear-gradient(145deg,rgba(4,18,40,0.95),rgba(3,12,28,0.98))",borderColor:"rgba(56,189,248,0.22)",boxShadow:"0 4px 20px rgba(56,189,248,0.08)"}}>
          <Settings className="w-5 h-5 text-sky-400" />
          <span className="text-[9px] text-sky-400/70 font-bold tracking-widest">CONFIG</span>
        </button>

        <button onClick={() => setShowWallpaperModal(true)}
          className="flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl border transition-all hover:scale-110 shadow-xl"
          style={{background:"linear-gradient(145deg,rgba(30,10,60,0.95),rgba(50,20,80,0.98))",borderColor:"rgba(168,85,247,0.30)",boxShadow:"0 4px 20px rgba(168,85,247,0.12)"}}>
          <span className="text-lg leading-none">🖼️</span>
          <span className="text-[9px] text-purple-400/80 font-bold tracking-widest">TEMA</span>
        </button>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40"
        style={{background:"linear-gradient(to top,rgba(3,6,14,0.60) 0%,rgba(3,6,14,0.25) 75%,transparent 100%)",backdropFilter:"blur(6px)"}}>
        {!showPlayMenu ? (
          <div className="flex items-end justify-around px-3 pb-5 pt-2 max-w-lg mx-auto">

            {/* Coleção */}
            <NavBtn icon={<BookOpen className="w-5 h-5" />} label={t("collection")} onClick={() => onNavigate("collection")} color="cyan" />

            {/* Gacha */}
            <NavBtn icon={<Sparkles className="w-5 h-5" />} label={t("gacha")} onClick={() => onNavigate("gacha")} color="purple" />

            {/* PLAY — center elevated */}
            <button onClick={() => setShowPlayMenu(true)} className="relative flex flex-col items-center -mt-8">
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-2xl blur-xl" style={{background:"rgba(239,68,68,0.35)",transform:"scale(1.3)"}} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center border-2 border-red-400/60 transition-all hover:scale-105 hover:border-red-300/80 shadow-2xl shadow-red-600/30"
                style={{background:"linear-gradient(145deg,#dc2626,#ef4444,#c2410c)"}}>
                <Swords className="w-7 h-7 text-white drop-shadow-lg" />
              </div>
              <span className="text-white text-[10px] font-black tracking-widest mt-1.5 uppercase">{t("play")}</span>
            </button>

            {/* Social */}
            <NavBtn icon={<Users className="w-5 h-5" />} label="Social" onClick={() => onNavigate("friends")} color="pink" />

            {/* Missões */}
            <NavBtn icon={<Target className="w-5 h-5" />} label="Missões" onClick={() => onNavigate("missions")} color="amber" />
          </div>
        ) : (
          /* Play sub-menu */
          <div className="px-4 pb-6 pt-4 max-w-lg mx-auto space-y-2.5">
            <p className="text-slate-500 text-[11px] text-center tracking-widest uppercase font-semibold mb-3">Modo de jogo</p>
            <button onClick={() => onNavigate("duel-bot")}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl"
              style={{background:"linear-gradient(135deg,#1d4ed8,#3b82f6,#2563eb)",boxShadow:"0 8px 24px rgba(59,130,246,0.25)"}}>
              <Bot className="h-6 w-6" />{t("vsBot")}
            </button>
            <button onClick={() => onNavigate("duel-player")}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl"
              style={{background:"linear-gradient(135deg,#c2410c,#f97316,#ea580c)",boxShadow:"0 8px 24px rgba(249,115,22,0.25)"}}>
              <Users className="h-6 w-6" />{t("vsPlayer")}
            </button>
            <button onClick={() => setShowPlayMenu(false)}
              className="w-full h-10 rounded-xl border border-white/[0.08] text-slate-500 hover:text-slate-300 text-sm font-semibold transition-colors hover:bg-white/[0.04]">
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
      {/* ── WALLPAPER MODAL ── */}
      {showWallpaperModal && (
        <div className="fixed inset-0 z-[9500] flex flex-col" style={{background:"rgba(0,0,0,0.92)",backdropFilter:"blur(8px)"}}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]"
            style={{background:"rgba(30,10,60,0.90)"}}>
            <div>
              <h2 className="text-white font-black text-xl flex items-center gap-2">🖼️ Tema do Menu</h2>
              <p className="text-slate-400 text-xs mt-0.5">Escolha o wallpaper do menu principal</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-400/20"
                style={{background:"rgba(20,14,3,0.85)"}}>
                <Image src="/images/icons/gacha-coin.png" alt="" width={16} height={16} className="object-contain" />
                <span className="text-amber-300 font-black text-sm">{coins.toLocaleString()}</span>
              </div>
              <button onClick={() => setShowWallpaperModal(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-lg">
                ✕
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {WALLPAPERS.map(wp => {
                const isSelected = selectedWallpaper === wp.id
                const isUnlocked = unlockedWallpapers.includes(wp.id)
                const canAfford = coins >= wp.cost

                return (
                  <div key={wp.id}
                    className={`relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                      isSelected ? "border-purple-400 shadow-2xl shadow-purple-500/30 scale-[1.02]" :
                      isUnlocked ? "border-white/20 hover:border-white/40 hover:scale-[1.01]" :
                      "border-white/[0.08] opacity-80"
                    }`}
                    onClick={() => {
                      if (isUnlocked) handleSelectWallpaper(wp.id)
                    }}>

                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full overflow-hidden" style={{position:"relative"}}>
                      {wp.image ? (
                        <div className="absolute inset-0" style={{
                          backgroundImage: `url(${wp.image})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                        }} />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1"
                          style={{background:"linear-gradient(145deg,#050911,#081220,#0a1828)"}}>
                          <span className="text-2xl">✨</span>
                          <span className="text-slate-500 text-[10px]">Padrão</span>
                        </div>
                      )}

                      {/* Lock overlay */}
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                          style={{background:"rgba(0,0,0,0.70)"}}>
                          <span className="text-3xl">🔒</span>
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-amber-400/40"
                            style={{background:"rgba(20,14,3,0.90)"}}>
                            <Image src="/images/icons/gacha-coin.png" alt="" width={14} height={14} className="object-contain" />
                            <span className="text-amber-300 font-black text-xs">{wp.cost}</span>
                          </div>
                        </div>
                      )}

                      {/* Selected badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center shadow-lg">
                          <span className="text-white text-xs font-black">✓</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="px-3 py-2.5" style={{background:"rgba(10,5,20,0.92)"}}>
                      <p className="text-white font-bold text-sm truncate">{wp.name}</p>
                      <p className="text-slate-500 text-[10px] truncate">{wp.description}</p>

                      {/* Action button */}
                      <div className="mt-2">
                        {isSelected ? (
                          <div className="w-full py-1.5 rounded-lg text-center text-[11px] font-black text-purple-300 border border-purple-500/30"
                            style={{background:"rgba(88,28,135,0.25)"}}>
                            ✓ Ativo
                          </div>
                        ) : isUnlocked ? (
                          <button onClick={(e) => { e.stopPropagation(); handleSelectWallpaper(wp.id) }}
                            className="w-full py-1.5 rounded-lg text-center text-[11px] font-bold text-white transition-all hover:brightness-110"
                            style={{background:"linear-gradient(135deg,#7e22ce,#9333ea)"}}>
                            Selecionar
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (canAfford) handleUnlockWallpaper(wp) }}
                            disabled={!canAfford}
                            className={`w-full py-1.5 rounded-lg text-center text-[11px] font-black flex items-center justify-center gap-1 transition-all ${
                              canAfford
                                ? "text-black hover:brightness-110"
                                : "opacity-50 text-slate-400 border border-slate-700"
                            }`}
                            style={canAfford ? {background:"linear-gradient(135deg,#d97706,#f59e0b)"} : {background:"rgba(30,30,30,0.8)"}}>
                            {canAfford ? (
                              <>
                                <Image src="/images/icons/gacha-coin.png" alt="" width={14} height={14} className="object-contain" />
                                {wp.cost} — Desbloquear
                              </>
                            ) : (
                              <>🔒 Coins insuficientes</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
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
