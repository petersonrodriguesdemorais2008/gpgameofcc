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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ultra premium animated background */}
      <div className="fixed inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        
        {/* Aurora light effects */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 120% 70% at 50% -20%, rgba(56, 189, 248, 0.15) 0%, transparent 60%),
              radial-gradient(ellipse 80% 50% at 100% 100%, rgba(168, 85, 247, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 0% 80%, rgba(251, 191, 36, 0.08) 0%, transparent 40%)
            `,
          }}
        />

        {/* Animated gradient overlay */}
        <div className="absolute inset-0 morph-bg" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(56,189,248,0.2) 1px, transparent 1px), 
              linear-gradient(90deg, rgba(56,189,248,0.2) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />
        
        {/* Cinematic vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.6)_100%)]" />
        
        {/* Top light beam */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-[0.08]"
          style={{
            background: "radial-gradient(ellipse at center top, rgba(56, 189, 248, 0.4) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Falling cards background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
        {fallingCards.map((card) => {
          const theme = CARD_THEMES[card.themeIndex]
          const swayDur = 5 + (card.id % 4) * 0.8
          const flipDur = 9 + (card.id % 5) * 1.5
          return (
            <div
              key={card.id}
              className="absolute falling-card-wrapper"
              style={{
                left: `${card.x}%`,
                animation: `fallingCard ${card.duration}s linear infinite`,
                animationDelay: `${card.delay}s`,
              }}
            >
              {/* Sway */}
              <div style={{ animation: `cardSway ${swayDur}s ease-in-out infinite`, animationDelay: `${card.delay * 0.4}s` }}>
                {/* 3D flip */}
                <div style={{ animation: `cardFlipSpin ${flipDur}s ease-in-out infinite`, animationDelay: `${card.delay * 0.7}s`, transformStyle: "preserve-3d" }}>
                  {/* ---- CARD FRONT ---- */}
                  <div
                    className="falling-card-face"
                    style={{
                      width: `${card.width}px`,
                      height: `${card.height}px`,
                      background: theme.bg,
                      border: `1.5px solid ${theme.border}`,
                      borderRadius: "8px",
                      boxShadow: `0 0 16px ${theme.glow}, 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`,
                      backfaceVisibility: "hidden",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {/* Holographic shine overlay */}
                    <div className="falling-card-holo" style={{
                      position: "absolute", inset: 0, borderRadius: "7px",
                      background: `linear-gradient(${card.shimmerAngle}deg, transparent 30%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.12) 55%, transparent 70%)`,
                      animation: `cardHoloShift ${3 + (card.id % 3) * 0.8}s ease-in-out infinite`,
                      animationDelay: `${card.delay * 0.3}s`,
                    }} />
                    {/* Card inner structure */}
                    <div style={{ position: "relative", padding: "5px", height: "100%", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {/* Art frame */}
                      <div style={{
                        flex: "1",
                        borderRadius: "4px",
                        background: `linear-gradient(180deg, ${theme.inner} 0%, rgba(0,0,0,0.3) 100%)`,
                        border: `1px solid rgba(255,255,255,0.08)`,
                        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)",
                        position: "relative",
                        overflow: "hidden",
                      }}>
                        {/* Decorative diamond */}
                        <div style={{
                          position: "absolute", top: "50%", left: "50%",
                          width: "40%", height: "40%",
                          transform: "translate(-50%,-50%) rotate(45deg)",
                          border: `1px solid ${theme.accent}`,
                          opacity: 0.2,
                          borderRadius: "2px",
                        }} />
                        <div style={{
                          position: "absolute", top: "50%", left: "50%",
                          width: "20%", height: "20%",
                          transform: "translate(-50%,-50%) rotate(45deg)",
                          background: theme.accent,
                          opacity: 0.1,
                          borderRadius: "1px",
                        }} />
                      </div>
                      {/* Info strip */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "0 1px" }}>
                        <div style={{ width: "75%", height: "2.5px", borderRadius: "2px", background: `${theme.accent}`, opacity: 0.2 }} />
                        <div style={{ width: "50%", height: "2px", borderRadius: "2px", background: `${theme.accent}`, opacity: 0.12 }} />
                      </div>
                    </div>
                    {/* Border glow accent at top */}
                    <div style={{
                      position: "absolute", top: 0, left: "15%", right: "15%", height: "1px",
                      background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
                      opacity: 0.4,
                    }} />
                  </div>

                  {/* ---- CARD BACK ---- */}
                  <div
                    className="falling-card-face"
                    style={{
                      position: "absolute", top: 0, left: 0,
                      width: `${card.width}px`,
                      height: `${card.height}px`,
                      background: "linear-gradient(145deg, #0f172a, #1e293b, #0f172a)",
                      border: `1.5px solid ${theme.border}`,
                      borderRadius: "8px",
                      boxShadow: `0 0 14px ${theme.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Pattern */}
                    <div style={{
                      width: "100%", height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `repeating-conic-gradient(rgba(255,255,255,0.02) 0% 25%, transparent 0% 50%) 0 0 / 10px 10px`,
                    }}>
                      {/* Center emblem */}
                      <div style={{
                        width: "50%", height: "50%",
                        borderRadius: "6px",
                        border: `1px solid rgba(255,255,255,0.06)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{
                          width: "50%", height: "50%",
                          transform: "rotate(45deg)",
                          border: `1px solid ${theme.border}`,
                          opacity: 0.15,
                          borderRadius: "3px",
                        }} />
                      </div>
                    </div>
                    {/* Top edge shine */}
                    <div style={{
                      position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
                      background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
                      opacity: 0.25,
                    }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Ambient light blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[0]">
        <div className="absolute top-[8%] left-[12%] w-80 h-80 bg-blue-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute top-[50%] right-[8%] w-64 h-64 bg-purple-500/[0.04] rounded-full blur-[100px]" />
        <div className="absolute bottom-[12%] left-[20%] w-72 h-72 bg-cyan-500/[0.04] rounded-full blur-[110px]" />
      </div>

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-start z-40">
        {/* Mobile mode indicator */}
        <div className="flex items-center">
          {mobileMode && (
            <div className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-medium">Mobile</span>
            </div>
          )}
        </div>
        {/* Coins and Player Profile display */}
        <div className="flex flex-col items-end gap-2">
          {/* Coins */}
          <div className="flex items-center gap-2 glass px-4 py-2 rounded-full">
            <div className="w-12 h-12 relative -my-1">
              <Image
                src="/images/icons/gacha-coin.png"
                alt="Gacha Coin"
                width={48}
                height={48}
                className="w-full h-full object-contain drop-shadow-lg"
              />
            </div>
            <span className="font-bold text-white text-xl">{coins.toLocaleString()}</span>
          </div>
          {/* Player Profile - clickable */}
          <button
            onClick={() => onNavigate("profile")}
            className="flex items-center gap-2.5 glass-card px-4 py-2 rounded-2xl hover:bg-white/5 transition-all duration-300 cursor-pointer group hover-lift"
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden border-2 border-cyan-400/40 shadow-lg shadow-cyan-500/20 group-hover:border-cyan-400/60 transition-colors">
              {playerProfile.avatarUrl ? (
                <Image
                  src={playerProfile.avatarUrl || "/placeholder.svg"}
                  alt={playerProfile.name}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{playerProfile.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <span className="font-semibold text-white text-sm max-w-24 truncate">{playerProfile.name}</span>
            <User className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
          </button>
        </div>
      </div>

      {/* Status Message Banner */}
      {statusMessage && (
        <div className="relative z-50 w-full max-w-sm mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-sm text-sm font-medium shadow-lg ${
            statusMessage.includes("ativado")
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-emerald-500/10"
              : "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-amber-500/10"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              statusMessage.includes("ativado") ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"
            }`} />
            {statusMessage}
          </div>
        </div>
      )}

      {/* Logo */}
      <div className="mb-10 relative z-10 text-center flex flex-col items-center">
        <div className="text-cyan-400/70 text-sm font-mono tracking-wider mb-4">v1.5.0</div>
        
        {/* Logo container with aura glow */}
        <div className="relative">

          {/* Aura layer 1: wide soft outer glow (slowest pulse) */}
          <div
            className="absolute inset-0 -inset-x-8 -inset-y-6 pointer-events-none rounded-[50%]"
            style={{
              background: "radial-gradient(ellipse at center, rgba(34,211,238,0.12) 0%, rgba(8,145,178,0.06) 40%, transparent 70%)",
              animation: "auraOuter 5s ease-in-out infinite",
            }}
          />

          {/* Aura layer 2: mid glow ring (offset timing) */}
          <div
            className="absolute inset-0 -inset-x-5 -inset-y-4 pointer-events-none rounded-[50%]"
            style={{
              background: "radial-gradient(ellipse at center, rgba(103,232,249,0.14) 0%, rgba(34,211,238,0.07) 45%, transparent 72%)",
              animation: "auraMid 4s ease-in-out infinite",
              animationDelay: "1.2s",
            }}
          />

          {/* Aura layer 3: tight inner glow (subtle, fast breathing) */}
          <div
            className="absolute inset-0 -inset-x-2 -inset-y-2 pointer-events-none rounded-[45%]"
            style={{
              background: "radial-gradient(ellipse at center, rgba(165,243,252,0.1) 0%, rgba(34,211,238,0.05) 50%, transparent 75%)",
              animation: "auraInner 3s ease-in-out infinite",
              animationDelay: "0.5s",
            }}
          />

          {/* Logo image with subtle animated drop-shadow as the primary aura effect */}
          <Image
            src="/images/gp-cg-logo.png"
            alt="Gear Perks Card Game"
            width={600}
            height={600}
            className="relative w-80 h-auto sm:w-96 md:w-[28rem] lg:w-[32rem] aura-logo"
            priority
          />
        </div>

        <p className="text-slate-500 text-sm mt-3 tracking-wider">2025 Gear Perks Oficial Card Game, Made in BRAZIL</p>
      </div>

      {/* Menu buttons */}
      <div className="flex flex-col gap-3.5 w-full max-w-sm relative z-10">
        {!showPlayMenu ? (
          <>
            {/* Play button - larger and more prominent */}
            <button
              onClick={() => setShowPlayMenu(true)}
              className="btn-premium w-full h-[72px] text-xl font-bold rounded-2xl menu-btn-play text-white flex items-center justify-center gap-3 breathing-glow card-shine"
            >
              <Swords className="h-7 w-7 drop-shadow-lg" />
              <span className="drop-shadow-lg tracking-wide">{t("play")}</span>
              <Star className="h-5 w-5 opacity-80 animate-pulse" />
            </button>

            {/* Other menu buttons */}
            <div className="grid grid-cols-2 gap-3.5">
              <button
                onClick={() => onNavigate("gacha")}
                className="btn-premium h-[60px] font-bold rounded-xl menu-btn-gacha text-white flex items-center justify-center gap-2.5 card-shine"
              >
                <Sparkles className="h-5 w-5" />
                {t("gacha")}
              </button>

              <button
                onClick={() => onNavigate("collection")}
                className="btn-premium h-[60px] font-bold rounded-xl menu-btn-collection text-white flex items-center justify-center gap-2.5 card-shine"
              >
                <BookOpen className="h-5 w-5" />
                {t("collection")}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <button
                onClick={() => onNavigate("deck-builder")}
                className="btn-premium h-[60px] font-bold rounded-xl menu-btn-deck text-white flex items-center justify-center gap-2.5 card-shine"
              >
                <Hammer className="h-5 w-5" />
                {t("deckBuilder")}
              </button>

              <button
                onClick={() => onNavigate("friends")}
                className="btn-premium h-[60px] font-bold rounded-xl menu-btn-friends text-white flex items-center justify-center gap-2.5 card-shine"
              >
                <Users className="h-5 w-5" />
                Amigos
              </button>
            </div>

            {/* Shop and Missions row */}
            <div className="grid grid-cols-2 gap-3.5">
              <button
                onClick={() => onNavigate("shop")}
                className="btn-premium h-[60px] font-bold rounded-xl bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-500 text-amber-950 flex items-center justify-center gap-2.5 breathing-glow-gold card-shine"
              >
                <ShoppingCart className="h-5 w-5" />
                Loja
              </button>

              <button
                onClick={() => onNavigate("missions")}
                className="btn-premium h-[60px] font-bold rounded-xl bg-gradient-to-br from-cyan-500 via-sky-400 to-cyan-500 text-white flex items-center justify-center gap-2.5 breathing-glow card-shine"
              >
                <Target className="h-5 w-5" />
                Missoes
              </button>
            </div>

            {/* Gift Box button */}
            <button
              onClick={() => setShowGiftBox(true)}
              className="btn-premium w-full h-[60px] font-bold rounded-xl menu-btn-gift text-white flex items-center justify-center gap-2.5 relative card-shine"
            >
              <Gift className="h-5 w-5" />
              Gift Box
              {unclaimedGifts.length > 0 && (
                <span className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-gradient-to-br from-red-500 to-rose-600 text-white text-sm font-bold rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-red-500/50 border border-white/20">
                  {unclaimedGifts.length}
                </span>
              )}
            </button>

            {/* Secondary buttons */}
            <div className="grid grid-cols-2 gap-3.5 mt-1">
              <button
                onClick={() => onNavigate("history")}
                className="h-12 font-medium rounded-xl ultra-glass text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02]"
              >
                <History className="h-4 w-4" />
                {t("history")}
              </button>

              <button
                onClick={() => onNavigate("settings")}
                className="h-12 font-medium rounded-xl ultra-glass text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02]"
              >
                <Settings className="h-4 w-4" />
                {t("settings")}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3.5">
            <button
              onClick={() => onNavigate("duel-bot")}
              className="btn-premium w-full h-[60px] text-lg font-bold rounded-xl bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 text-white flex items-center justify-center gap-2.5 shadow-xl shadow-blue-500/30 card-shine"
            >
              <Bot className="h-5 w-5" />
              {t("vsBot")}
            </button>

            <button
              onClick={() => onNavigate("duel-player")}
              className="gacha-btn w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition-all duration-300"
            >
              <Users className="h-5 w-5" />
              {t("vsPlayer")}
            </button>

            <button
              onClick={() => setShowPlayMenu(false)}
              className="w-full h-12 font-medium rounded-xl glass text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all duration-300"
            >
              {t("back")}
            </button>
          </div>
        )}
      </div>

      {/* Gift Box Modal */}
      {showGiftBox && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-dark rounded-3xl max-w-md w-full p-6 relative border border-amber-500/20 shadow-2xl shadow-amber-500/10">
            <button
              onClick={() => {
                setShowGiftBox(false)
                setClaimedCard(null)
                setClaimedCoins(null)
                setClaimAllResults(null)
              }}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>

            <div className="flex items-center justify-center gap-3 mb-6">
              <Gift className="w-8 h-8 text-amber-400" />
              <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                Caixa de Presentes
              </h2>
            </div>

            {!claimedCard && !claimedCoins && !claimAllResults ? (
              unclaimedGifts.length > 0 ? (
                <>
                  {/* Claim All Button */}
                  {unclaimedGifts.length > 1 && (
                    <button
                      onClick={handleClaimAll}
                      disabled={isClaimingAll}
                      className="w-full gacha-btn h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 mb-4"
                    >
                      {isClaimingAll ? (
                        <>
                          <Sparkles className="w-4 h-4 animate-spin" />
                          Coletando...
                        </>
                      ) : (
                        <>
                          <Gift className="w-4 h-4" />
                          Coletar Tudo ({unclaimedGifts.length})
                        </>
                      )}
                    </button>
                  )}
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {unclaimedGifts.map((gift) => (
                      <div
                        key={gift.id}
                        className="bg-gradient-to-r from-pink-900/30 to-rose-900/30 border border-pink-500/30 rounded-2xl p-4"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl shadow-lg shadow-pink-500/30">
                            <Gift className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="font-bold text-white">{gift.title}</h3>
                        </div>
                        <p className="text-slate-300 text-sm mb-4">{gift.message}</p>
                        {gift.coinsReward && (
                          <div className="flex items-center gap-2 mb-3 text-amber-400">
                            <Coins className="w-4 h-4" />
                            <span>+{gift.coinsReward} Moedas</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleOpenGift(gift.id)}
                          disabled={isOpening}
                          className="gacha-btn w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30"
                        >
                          {isOpening ? (
                            <>
                              <Sparkles className="w-4 h-4 animate-spin" />
                              Abrindo...
                            </>
                          ) : (
                            "Abrir Presente"
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <Gift className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400">Nenhum presente disponível no momento.</p>
                </div>
              )
            ) : claimedCard ? (
              <div className="flex flex-col items-center py-4">
                <p className="text-amber-400 font-bold text-lg mb-4">Você recebeu:</p>
                <div className="relative animate-float">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 blur-2xl opacity-50 animate-pulse" />
                  <div
                    className={`relative w-40 h-56 rounded-xl overflow-hidden shadow-2xl ${
                      claimedCard.rarity === "LR"
                        ? "rarity-lr"
                        : claimedCard.rarity === "UR"
                          ? "rarity-ur"
                          : claimedCard.rarity === "SR"
                            ? "rarity-sr"
                            : "rarity-r"
                    }`}
                  >
                    <Image
                      src={claimedCard.image || "/placeholder.svg"}
                      alt={claimedCard.name}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  </div>
                </div>
                <h3 className="mt-4 text-xl font-bold text-white text-center">{claimedCard.name}</h3>
                <span
                  className={`mt-2 px-4 py-1 rounded-full text-sm font-bold ${
                    claimedCard.rarity === "LR"
                      ? "bg-gradient-to-r from-red-500 to-amber-500 text-white"
                      : claimedCard.rarity === "UR"
                        ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black"
                        : claimedCard.rarity === "SR"
                          ? "bg-purple-500 text-white"
                          : "bg-slate-500 text-white"
                  }`}
                >
                  {claimedCard.rarity}
                </span>
                <button
                  onClick={() => {
                    setShowGiftBox(false)
                    setClaimedCard(null)
                  }}
                  className="mt-6 gacha-btn px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/30"
                >
                  Fechar
                </button>
              </div>
            ) : claimAllResults ? (
              <div className="flex flex-col items-center py-4">
                <p className="text-amber-400 font-bold text-lg mb-4">Você recebeu:</p>
                
                <div className="w-full max-h-[50vh] overflow-y-auto space-y-3 mb-4">
                  {/* Display collected cards */}
                  {claimAllResults.cards.length > 0 && (
                    <div className="bg-slate-800/50 rounded-2xl p-4">
                      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-400" />
                        Cartas ({claimAllResults.cards.length})
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {claimAllResults.cards.map((card, index) => (
                          <div key={index} className="relative group">
                            <div
                              className={`relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg ${
                                card.rarity === "LR"
                                  ? "rarity-lr"
                                  : card.rarity === "UR"
                                    ? "rarity-ur"
                                    : card.rarity === "SR"
                                      ? "rarity-sr"
                                      : "rarity-r"
                              }`}
                            >
                              <Image
                                src={card.image || "/placeholder.svg"}
                                alt={card.name}
                                fill
                                sizes="100px"
                                className="object-cover"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                              <span className="text-white text-[10px] font-bold text-center px-1">
                                {card.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Display collected coins */}
                  {claimAllResults.coins > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-2xl p-4">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 relative">
                          <Image
                            src="/images/icons/gacha-coin.png"
                            alt="Gacha Coin"
                            width={40}
                            height={40}
                            className="w-full h-full object-contain drop-shadow-lg"
                          />
                        </div>
                        <span className="text-2xl font-bold text-amber-400">+{claimAllResults.coins}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setShowGiftBox(false)
                    setClaimAllResults(null)
                  }}
                  className="gacha-btn px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/30"
                >
                  Fechar
                </button>
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
                <button
                  onClick={() => {
                    setShowGiftBox(false)
                    setClaimedCoins(null)
                  }}
                  className="mt-6 gacha-btn px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/30"
                >
                  Fechar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
