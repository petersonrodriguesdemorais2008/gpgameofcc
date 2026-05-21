"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import type { GameScreen } from "@/components/game/game-wrapper"
import {
  Swords, Bot, Users, Gift, BookOpen, Hammer, History, Settings,
  Coins, X, Sparkles, Star, ShoppingCart, User, Target, Shield,
} from "lucide-react"
import Image from "next/image"
import { MasterMenuCard } from "./master-screen"

// ── Injeção de CSS ────────────────────────────────────────────────────────────
const GP_CSS = `
.gp-scan{position:fixed;inset:0;z-index:100;pointer-events:none;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.055) 2px,rgba(0,0,0,0.055) 4px);}
.gp-vign{position:fixed;inset:0;z-index:3;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,transparent 32%,rgba(0,0,8,0.68) 100%);}
.gp-grid{position:fixed;inset:0;z-index:4;pointer-events:none;background-image:linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px);background-size:48px 48px;}
.gp-c{position:fixed;width:20px;height:20px;border-color:rgba(139,92,246,0.22);border-style:solid;z-index:5;pointer-events:none;}
.gp-c-tl{top:10px;left:10px;border-width:2px 0 0 2px;}
.gp-c-tr{top:10px;right:68px;border-width:2px 2px 0 0;}
.gp-c-bl{bottom:80px;left:10px;border-width:0 0 2px 2px;}
.gp-c-br{bottom:80px;right:68px;border-width:0 2px 2px 0;}

.gp-wbg{animation:gp-bgb 8s ease-in-out infinite;}
@keyframes gp-bgb{0%,100%{filter:brightness(1);}50%{filter:brightness(1.07);}}

.gp-av-ring{position:absolute;inset:-3px;border-radius:14px;background:conic-gradient(rgba(232,121,249,0.62),rgba(139,92,246,0.62),rgba(167,139,250,0.62),rgba(232,121,249,0.62));animation:gp-spin 5s linear infinite;z-index:0;}
@keyframes gp-spin{to{transform:rotate(360deg);}}

.gp-logo{filter:drop-shadow(0 0 14px rgba(139,92,246,0.42));animation:gp-logo-f 4s ease-in-out infinite;}
@keyframes gp-logo-f{0%,100%{transform:translateY(0px);}50%{transform:translateY(-2px);}}

.gp-stam-bar{width:80px;height:5px;border-radius:3px;overflow:hidden;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.18);}
.gp-stam-fill{height:100%;border-radius:3px;animation:gp-stam 2.5s ease-in-out infinite;}
@keyframes gp-stam{0%,100%{opacity:1;box-shadow:0 0 5px rgba(167,139,250,0.35);}50%{opacity:0.82;box-shadow:0 0 10px rgba(232,121,249,0.6);}}

.gp-jr1{animation:gp-jr 2s ease-out infinite;}
.gp-jr2{animation:gp-jr 2s ease-out infinite 0.65s;}
@keyframes gp-jr{0%{transform:scale(1);opacity:0.8;}100%{transform:scale(1.4);opacity:0;}}

.gp-hud-sep{position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(139,92,246,0.28),rgba(167,139,250,0.5),rgba(139,92,246,0.28),transparent);}

.gp-sb{width:52px;padding:7px 0;background:rgba(5,2,18,0.84);border:1px solid rgba(124,58,237,0.15);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all .25s ease;position:relative;overflow:hidden;}
.gp-sb::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:rgba(139,92,246,0.85);transform:scaleY(0);transform-origin:center;transition:transform .25s ease;}
.gp-sb:hover{background:rgba(10,5,32,0.92);border-color:rgba(139,92,246,0.35);transform:translateX(-2px);box-shadow:2px 0 14px rgba(124,58,237,0.18);}
.gp-sb:hover::before{transform:scaleY(1);}
.gp-sb-icon{width:17px;height:17px;color:rgba(167,139,250,0.8);transition:color .25s;}
.gp-sb:hover .gp-sb-icon{color:rgba(192,132,252,0.95);filter:drop-shadow(0 0 4px rgba(167,139,250,0.45));}
.gp-sb-lbl{font-size:7px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(109,40,217,0.75);transition:color .25s;}
.gp-sb:hover .gp-sb-lbl{color:rgba(139,92,246,0.9);}
.gp-sb.gp-gold{background:rgba(12,7,2,0.84);border-color:rgba(245,158,11,0.22);}
.gp-sb.gp-gold::before{background:rgba(245,158,11,0.85);}
.gp-sb.gp-gold:hover{border-color:rgba(245,158,11,0.52);box-shadow:2px 0 14px rgba(245,158,11,0.18);}

.gp-nav-bar{position:relative;}
.gp-nav-bar::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(139,92,246,0.28),rgba(167,139,250,0.5),rgba(139,92,246,0.28),transparent);}
.gp-ni{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px 3px;background:transparent;border:none;cursor:pointer;position:relative;transition:background .25s;}
.gp-ni::after{content:'';position:absolute;bottom:0;left:22%;right:22%;height:2px;background:rgba(139,92,246,0.85);transform:scaleX(0);transition:transform .25s;border-radius:1px 1px 0 0;}
.gp-ni:hover::after{transform:scaleX(1);}
.gp-ni:hover{background:rgba(124,58,237,0.07);}
.gp-ni svg{color:rgba(109,40,217,0.62);transition:all .25s;}
.gp-ni:hover svg{color:rgba(167,139,250,0.9);filter:drop-shadow(0 0 5px rgba(167,139,250,0.45));}
.gp-ni-lbl{font-size:7.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(109,40,217,0.55);transition:color .25s;}
.gp-ni:hover .gp-ni-lbl{color:rgba(139,92,246,0.85);}

.gp-jogar-btn{width:62px;height:62px;border-radius:18px;background:radial-gradient(circle at 38% 32%,#FF6B7A,#DC2626,#7F1D1D);border:2px solid rgba(255,107,122,0.45);box-shadow:0 0 18px rgba(220,38,38,0.55),0 0 36px rgba(220,38,38,0.22),inset 0 1px 0 rgba(255,255,255,0.18);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .25s ease;position:relative;overflow:hidden;}
.gp-jogar-btn::before{content:'';position:absolute;top:12%;left:18%;right:18%;height:26%;background:linear-gradient(180deg,rgba(255,255,255,0.2),transparent);border-radius:50%;filter:blur(2px);pointer-events:none;}
.gp-jogar-btn:hover{transform:scale(1.07);box-shadow:0 0 28px rgba(220,38,38,0.7),0 0 52px rgba(220,38,38,0.28),inset 0 1px 0 rgba(255,255,255,0.18);}
.gp-jogar-ring{position:absolute;border-radius:22px;border-style:solid;pointer-events:none;}

/* Rarity borders (used in gift & gacha modals) */
.rarity-lr{box-shadow:0 0 20px rgba(239,68,68,0.5),0 0 40px rgba(251,191,36,0.3);border:2px solid #fbbf24;}
.rarity-ur{box-shadow:0 0 18px rgba(245,158,11,0.5);border:2px solid #f59e0b;}
.rarity-sr{box-shadow:0 0 16px rgba(168,85,247,0.5);border:2px solid #a855f7;}
.rarity-r{box-shadow:0 0 10px rgba(148,163,184,0.3);border:2px solid #94a3b8;}
/* Gacha button */
.gacha-btn{transition:all .2s;}
.gacha-btn:hover{transform:scale(1.02);filter:brightness(1.1);}
.gacha-btn:active{transform:scale(0.98);}
/* Float animation (gift reveal) */
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
.animate-float{animation:float 3s ease-in-out infinite;}
/* Logo aura */
.aura-logo{filter:drop-shadow(0 0 12px rgba(139,92,246,0.5));}
/* Falling cards (default wallpaper) */
@keyframes fallingCard{0%{transform:translateY(-120px) rotate(-8deg);opacity:0;}5%{opacity:1;}95%{opacity:0.6;}100%{transform:translateY(calc(100vh + 140px)) rotate(12deg);opacity:0;}}
@keyframes cardSway{0%,100%{transform:translateX(-18px);}50%{transform:translateX(18px);}}
@keyframes cardFlipSpin{0%{transform:rotateY(0deg);}45%{transform:rotateY(0deg);}55%{transform:rotateY(180deg);}100%{transform:rotateY(180deg);}}
@keyframes cardHoloShift{0%,100%{opacity:0.05;}50%{opacity:0.18;}}
`

// ─── Panel style helpers ──────────────────────────────────────────────────────
const PANEL: React.CSSProperties = {
  background: "rgba(5,2,18,0.84)",
  border: "1px solid rgba(124,58,237,0.18)",
  borderRadius: 14,
}
const PANEL_BTN: React.CSSProperties = {
  background: "rgba(5,2,18,0.84)",
  border: "1px solid rgba(124,58,237,0.18)",
  borderRadius: 11,
}

interface MainMenuProps {
  onNavigate: (screen: GameScreen) => void
  statusMessage?: string | null
  onClearMessage?: () => void
}

export default function MainMenu({ onNavigate, statusMessage, onClearMessage }: MainMenuProps) {
  const { t } = useLanguage()
  const {
    coins, setCoins, giftBoxes, claimGift, playerProfile,
    mobileMode, stamina, maxStamina, staminaNextTickSeconds,
  } = useGame()

  const spendCoins = (amount: number) => setCoins((prev: number) => Math.max(0, prev - amount))

  const [showPlayMenu, setShowPlayMenu]     = useState(false)
  const [showGiftBox, setShowGiftBox]       = useState(false)
  const [claimedCard, setClaimedCard]       = useState<ReturnType<typeof claimGift>>(null)
  const [claimedCoins, setClaimedCoins]     = useState<number | null>(null)
  const [isOpening, setIsOpening]           = useState(false)
  const [isClaimingAll, setIsClaimingAll]   = useState(false)
  const [claimAllResults, setClaimAllResults] = useState<{ cards: any[]; coins: number } | null>(null)
  const [showWallpaperModal, setShowWallpaperModal] = useState(false)
  const [showDailyBonus, setShowDailyBonus] = useState(false)
  const [dailyBonusClaimed, setDailyBonusClaimed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    const lastClaim = localStorage.getItem("gpgame_daily_bonus_date")
    if (!lastClaim) return false
    return new Date(lastClaim).toDateString() === new Date().toDateString()
  })
  const [dailyBonusJustClaimed, setDailyBonusJustClaimed] = useState(false)

  const handleClaimDailyBonus = () => {
    if (dailyBonusClaimed) return
    setCoins((prev: number) => prev + 50)
    localStorage.setItem("gpgame_daily_bonus_date", new Date().toISOString())
    setDailyBonusClaimed(true)
    setDailyBonusJustClaimed(true)
  }

  // ── Wallpaper system (logic idêntica ao original) ─────────────────────────
  const WALLPAPERS = [
    { id: "default",        name: "Padrão",          description: "Fundo padrão do menu com cartas caindo",  image: null,                                      cost: 0,   free: true  },
    { id: "fehnon_wallpaper",  name: "Fehnon Wallpaper",  description: "Arte do Fehnon Hoskie",              image: "/images/wallpapers/fehnon_wallpaper.png",  cost: 0,   free: true  },
    { id: "arthur_wallpaper",  name: "Arthur Wallpaper",  description: "Arte do Arthur com o Vazio",         image: "/images/wallpapers/arthur_wallpaper.png",  cost: 500, free: false },
    { id: "fsg_wallpaper",     name: "FSG Wallpaper",     description: "Arte dos Fundadores da Santa Guerra", image: "/images/wallpapers/fsg_wallpaper.png",     cost: 500, free: false },
    { id: "fsg_wallpaper_2",   name: "FSG Wallpaper 2",   description: "Arte especial dos personagens",      image: "/images/wallpapers/fsg_wallpaper_2.png",   cost: 500, free: false },
    { id: "fsg_wallpaper_3",   name: "FSG Wallpaper 3",   description: "Arte do Fehnon e Morgana",           image: "/images/wallpapers/fsg_wallpaper_3.png",   cost: 500, free: false },
    { id: "fsg_wallpaper_4",   name: "FSG Wallpaper 4",   description: "Arte do grupo FSG",                  image: "/images/wallpapers/fsg_wallpaper_4.png",   cost: 500, free: false },
  ]
  const WALLPAPER_LS_KEY = "gpgame_selected_wallpaper"
  const UNLOCKED_LS_KEY  = "gpgame_unlocked_wallpapers"

  const [selectedWallpaper, setSelectedWallpaper] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem(WALLPAPER_LS_KEY) ?? "fehnon_wallpaper") : "fehnon_wallpaper"
  )
  const [unlockedWallpapers, setUnlockedWallpapers] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved   = localStorage.getItem(UNLOCKED_LS_KEY)
        const parsed  = saved ? JSON.parse(saved) : []
        return [...new Set(["default", "fehnon_wallpaper", ...parsed])]
      } catch { return ["default", "fehnon_wallpaper"] }
    }
    return ["default", "fehnon_wallpaper"]
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem(UNLOCKED_LS_KEY) && !localStorage.getItem(WALLPAPER_LS_KEY)) {
      setSelectedWallpaper("fehnon_wallpaper")
      setUnlockedWallpapers(["default", "fehnon_wallpaper"])
    }
  }, [coins])

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

  useEffect(() => {
    if (statusMessage && onClearMessage) {
      const t = setTimeout(() => onClearMessage(), 4000)
      return () => clearTimeout(t)
    }
  }, [statusMessage, onClearMessage])

  // ── Falling cards (idêntico ao original) ─────────────────────────────────
  const CARD_THEMES = [
    { bg: "linear-gradient(145deg,#1e3a5f,#0c4a6e,#164e63)", border: "#38bdf8", glow: "rgba(56,189,248,0.35)", accent: "#7dd3fc" },
    { bg: "linear-gradient(145deg,#5b1a1a,#7f1d1d,#991b1b)", border: "#fca5a5", glow: "rgba(252,165,165,0.30)", accent: "#fecaca" },
    { bg: "linear-gradient(145deg,#713f12,#92400e,#78350f)", border: "#fcd34d", glow: "rgba(252,211,77,0.35)", accent: "#fde68a" },
    { bg: "linear-gradient(145deg,#3b0764,#581c87,#6b21a8)", border: "#d8b4fe", glow: "rgba(216,180,254,0.30)", accent: "#e9d5ff" },
    { bg: "linear-gradient(145deg,#064e3b,#065f46,#047857)", border: "#6ee7b7", glow: "rgba(110,231,183,0.30)", accent: "#a7f3d0" },
    { bg: "linear-gradient(145deg,#1e293b,#334155,#475569)", border: "#e2e8f0", glow: "rgba(226,232,240,0.25)", accent: "#f1f5f9" },
  ]
  const seededRand = (seed: number) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x) }
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

  // ── Gift handlers (idênticos ao original) ─────────────────────────────────
  const handleOpenGift = (giftId: string) => {
    setIsOpening(true)
    const gift = giftBoxes.find(g => g.id === giftId)
    setTimeout(() => {
      const card = claimGift(giftId)
      setClaimedCard(card)
      if (gift?.coinsReward && !card) setClaimedCoins(gift.coinsReward)
      setIsOpening(false)
    }, 1500)
  }
  const handleClaimAll = () => {
    setIsClaimingAll(true)
    const cards: any[] = []; let totalCoins = 0
    setTimeout(() => {
      giftBoxes.forEach(gift => {
        if (!gift.claimed) {
          const card = claimGift(gift.id)
          if (card) cards.push(card)
          else if (gift.coinsReward) totalCoins += gift.coinsReward
        }
      })
      setClaimAllResults({ cards, coins: totalCoins })
      setIsClaimingAll(false)
    }, 1500)
  }
  const unclaimedGifts = giftBoxes.filter(g => !g.claimed)

  // ── Canvas particle system ────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    let animId: number
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight }
    resize(); addEventListener("resize", resize)
    class P {
      x=0;y=0;sz=0;vx=0;vy=0;op=0;hue=0;li=0;ml=0;tw=0;cop=0
      constructor(){this.reset()}
      reset(){
        this.x=Math.random()*canvas.width;this.y=Math.random()*canvas.height
        this.sz=Math.random()*2+0.4;this.vx=(Math.random()-.5)*.32;this.vy=-Math.random()*.42-.1
        this.op=Math.random()*.42+.08;this.hue=Math.random()*42+255
        this.li=0;this.ml=Math.random()*180+90;this.tw=Math.random()*Math.PI*2
      }
      tick(){
        this.li++;this.x+=this.vx;this.y+=this.vy;this.tw+=.032
        const pr=this.li/this.ml,fi=pr<.12?pr/.12:1,fo=pr>.72?(1-(pr-.72)/.28):1
        this.cop=this.op*fi*fo*(.55+Math.sin(this.tw)*.45)
        if(this.li>=this.ml)this.reset()
      }
      draw(){
        ctx!.beginPath();ctx!.arc(this.x,this.y,this.sz,0,Math.PI*2)
        ctx!.fillStyle=`hsla(${this.hue},75%,70%,${this.cop})`
        ctx!.shadowBlur=this.sz*4;ctx!.shadowColor=`hsla(${this.hue},75%,70%,${this.cop*.4})`
        ctx!.fill()
      }
    }
    const ps:P[]=[]
    for(let i=0;i<55;i++){const p=new P();p.li=Math.random()*p.ml;ps.push(p)}
    const loop=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.shadowBlur=0;ps.forEach(p=>{p.tick();p.draw()});animId=requestAnimationFrame(loop)}
    loop()
    return()=>{removeEventListener("resize",resize);cancelAnimationFrame(animId)}
  },[])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: "transparent" }}>

      {/* CSS injector */}
      <style dangerouslySetInnerHTML={{ __html: GP_CSS }} />

      {/* ── Camadas atmosféricas ── */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 2 }} />
      <div className="gp-scan" /><div className="gp-vign" /><div className="gp-grid" />
      <div className="gp-c gp-c-tl" /><div className="gp-c gp-c-tr" />
      <div className="gp-c gp-c-bl" /><div className="gp-c gp-c-br" />

      {/* ── BACKGROUND ── */}
      <div className="fixed inset-0 z-0">
        {activeWallpaper?.image ? (
          <div className="absolute inset-0 gp-wbg" style={{
            backgroundImage: `url(${activeWallpaper.image})`,
            backgroundSize: "cover", backgroundPosition: "center center", backgroundRepeat: "no-repeat",
          }} />
        ) : (
          <div className="absolute inset-0 gp-wbg" style={{ background: "linear-gradient(180deg,#03060F 0%,#060D1C 30%,#08122A 60%,#040A16 100%)" }} />
        )}

        {!activeWallpaper?.image && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {fallingCards.map(card => {
              const theme = CARD_THEMES[card.themeIndex]
              const swayDur = 5 + (card.id % 4) * 0.8
              const flipDur = 9 + (card.id % 5) * 1.5
              return (
                <div key={card.id} className="absolute falling-card-wrapper"
                  style={{ left: `${card.x}%`, animation: `fallingCard ${card.duration}s linear infinite`, animationDelay: `${card.delay}s` }}>
                  <div style={{ animation: `cardSway ${swayDur}s ease-in-out infinite`, animationDelay: `${card.delay * .4}s` }}>
                    <div style={{ animation: `cardFlipSpin ${flipDur}s ease-in-out infinite`, animationDelay: `${card.delay * .7}s`, transformStyle: "preserve-3d" }}>
                      <div style={{ width: `${card.width}px`, height: `${card.height}px`, background: theme.bg, border: `1.5px solid ${theme.border}`, borderRadius: 8, boxShadow: `0 0 16px ${theme.glow}`, backfaceVisibility: "hidden", overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${card.shimmerAngle}deg,transparent 30%,rgba(255,255,255,0.15) 50%,transparent 70%)`, animation: `cardHoloShift ${3 + (card.id % 3) * .8}s ease-in-out infinite` }} />
                        <div style={{ position: "absolute", top: "50%", left: "50%", width: "35%", height: "35%", transform: "translate(-50%,-50%) rotate(45deg)", border: `1px solid ${theme.accent}`, opacity: .2, borderRadius: 2 }} />
                      </div>
                      <div style={{ position: "absolute", top: 0, left: 0, width: `${card.width}px`, height: `${card.height}px`, background: "linear-gradient(145deg,#0f172a,#1e293b)", border: `1.5px solid ${theme.border}`, borderRadius: 8, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 100% 55% at 50% 0%,rgba(124,58,237,0.10) 0%,transparent 55%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 45% at 15% 80%,rgba(109,40,217,0.07) 0%,transparent 50%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 40% at 85% 85%,rgba(168,85,247,0.05) 0%,transparent 45%)" }} />
      </div>

      {/* ── TOP HUD ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-2.5 pb-2.5"
        style={{ background: "linear-gradient(180deg,rgba(2,1,14,0.97) 0%,rgba(2,1,14,0) 100%)" }}>
        <div className="gp-hud-sep" />

        {/* Esquerda: perfil + MasterCard */}
        <div className="flex flex-col gap-1.5">
          <button onClick={() => onNavigate("profile")}
            className="flex items-center gap-2.5 group transition-all duration-200 hover:scale-[1.03]">
            <div className="relative w-10 h-10">
              <div className="gp-av-ring" />
              <div className="relative w-10 h-10 rounded-xl overflow-hidden" style={{ zIndex: 1, border: "1.5px solid rgba(139,92,246,0.5)", boxShadow: "0 0 10px rgba(124,58,237,0.35)" }}>
                {playerProfile.avatarUrl ? (
                  <Image src={playerProfile.avatarUrl || "/placeholder.svg"} alt={playerProfile.name} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#2E1065,#7C3AED)" }}>
                    <span className="text-white text-base font-black">{playerProfile.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              {mobileMode && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black/80" style={{ zIndex: 2 }} />}
            </div>
            <div className="text-left">
              <p className="text-white font-black text-sm leading-tight tracking-wide">{playerProfile.name}</p>
              <p className="text-[10px] font-semibold tracking-widest" style={{ color: "rgba(167,139,250,0.6)" }}>{playerProfile.title || "Jogador"}</p>
            </div>
          </button>
          <MasterMenuCard onOpen={() => onNavigate("masters")} />
        </div>

        {/* Centro: Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <Image src="/images/gp-cg-logo.png" alt="Gear Perks" width={180} height={60}
            className="w-32 h-auto aura-logo gp-logo" priority />
        </div>

        {/* Direita: recursos */}
        <div className="flex items-center gap-2">
          {/* Stamina */}
          <div className="flex items-center gap-2 px-3 py-2" style={PANEL}>
            <span className="text-sm" style={{ color: "rgba(96,165,250,0.9)", filter: "drop-shadow(0 0 5px rgba(96,165,250,0.65))" }}>⚡</span>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black tracking-widest uppercase" style={{ color: "rgba(167,139,250,0.5)" }}>Stamina</span>
                <span className="font-black text-sm text-white tabular-nums">
                  {stamina}<span className="font-normal text-xs" style={{ color: "rgba(167,139,250,0.4)" }}>/{maxStamina}</span>
                </span>
                {stamina < maxStamina && staminaNextTickSeconds > 0 && (
                  <span className="text-[9px] font-bold tabular-nums" style={{ color: "rgba(52,211,153,0.55)" }}>
                    {String(Math.floor(staminaNextTickSeconds / 60)).padStart(1,"0")}:{String(staminaNextTickSeconds % 60).padStart(2,"0")}
                  </span>
                )}
              </div>
              <div className="gp-stam-bar">
                <div className="gp-stam-fill transition-all duration-500" style={{
                  width: `${Math.min(100, (stamina / maxStamina) * 100)}%`,
                  background: stamina === maxStamina
                    ? "linear-gradient(90deg,#7C3AED,#E879F9)"
                    : stamina < maxStamina * 0.3
                    ? "linear-gradient(90deg,#ef4444,#f87171)"
                    : "linear-gradient(90deg,#6D28D9,#8B5CF6)",
                }} />
              </div>
            </div>
          </div>

          {/* Coins */}
          <div className="flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-all hover:brightness-110" style={PANEL}>
            <div className="w-5 h-5 relative">
              <Image src="/images/icons/gacha-coin.png" alt="Coins" width={20} height={20} className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <span className="font-black text-sm tabular-nums" style={{ color: "#FCD34D", textShadow: "0 0 8px rgba(252,211,77,0.4)" }}>{coins.toLocaleString()}</span>
            <span style={{ color: "rgba(167,139,250,0.38)", fontSize: 13 }}>+</span>
          </div>

          {/* Gift */}
          <button onClick={() => setShowGiftBox(true)}
            className="relative flex items-center justify-center w-9 h-9 transition-all hover:scale-105"
            style={PANEL_BTN}>
            <Gift className="w-4 h-4" style={{ color: "#FCD34D" }} />
            {unclaimedGifts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black text-white"
                style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 0 6px rgba(239,68,68,0.6)", border: "1px solid rgba(255,255,255,0.18)" }}>
                {unclaimedGifts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── STATUS MESSAGE ── */}
      {statusMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold shadow-lg backdrop-blur-md ${
            statusMessage.includes("ativado") ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"
          }`} style={{ background: statusMessage.includes("ativado") ? "rgba(3,18,10,0.92)" : "rgba(18,10,2,0.92)" }}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${statusMessage.includes("ativado") ? "bg-emerald-400" : "bg-amber-400"}`} />
            {statusMessage}
          </div>
        </div>
      )}

      {/* ── BOTÕES LATERAIS ── */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">

        <button className="gp-sb" onClick={() => onNavigate("deck-builder")}>
          <Hammer className="gp-sb-icon" /><span className="gp-sb-lbl">Deck</span>
        </button>

        <button className="gp-sb" onClick={() => onNavigate("history")}>
          <History className="gp-sb-icon" /><span className="gp-sb-lbl">Hist.</span>
        </button>

        <button className="gp-sb" onClick={() => onNavigate("settings")}>
          <Settings className="gp-sb-icon" /><span className="gp-sb-lbl">Config</span>
        </button>

        <button className="gp-sb relative" onClick={() => { setShowDailyBonus(true); setDailyBonusJustClaimed(false) }}>
          {!dailyBonusClaimed && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 5px rgba(52,211,153,0.7)" }} />
          )}
          <span className="text-base leading-none">{dailyBonusClaimed ? "✅" : "🎁"}</span>
          <span className="gp-sb-lbl" style={{ color: dailyBonusClaimed ? "rgba(100,100,100,0.55)" : "rgba(52,211,153,0.75)" }}>Daily</span>
        </button>

        <button className="gp-sb" onClick={() => setShowWallpaperModal(true)}>
          <span className="text-base leading-none">🖼️</span><span className="gp-sb-lbl">Tema</span>
        </button>

        <button className="gp-sb relative" onClick={() => onNavigate("gear-pass")}>
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ boxShadow: "0 0 5px rgba(251,191,36,0.7)" }} />
          <Shield className="gp-sb-icon" /><span className="gp-sb-lbl">Passe</span>
        </button>

        <button className="gp-sb" onClick={() => onNavigate("story")}>
          <BookOpen className="gp-sb-icon" /><span className="gp-sb-lbl">Story</span>
        </button>

        <button className="gp-sb gp-gold" onClick={() => onNavigate("masters")}>
          <Star className="gp-sb-icon" style={{ color: "rgba(252,211,77,0.9)" }} />
          <span className="gp-sb-lbl" style={{ color: "rgba(245,158,11,0.85)" }}>Mestre</span>
        </button>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40"
        style={{ background: "linear-gradient(180deg,rgba(2,1,14,0) 0%,rgba(2,1,14,0.97) 100%)", backdropFilter: "blur(14px)" }}>

        {!showPlayMenu ? (
          <div className="gp-nav-bar flex items-end justify-around px-3 pb-4 pt-2 max-w-lg mx-auto">

            <button className="gp-ni" onClick={() => onNavigate("collection")}>
              <BookOpen className="w-5 h-5" /><span className="gp-ni-lbl">Coleção</span>
            </button>

            <button className="gp-ni" onClick={() => onNavigate("gacha")}>
              <Sparkles className="w-5 h-5" /><span className="gp-ni-lbl">Gacha</span>
            </button>

            {/* ── JOGAR ── */}
            <button onClick={() => setShowPlayMenu(true)} className="relative flex flex-col items-center -mt-7">
              <div className="relative" style={{ width: 66, height: 66 }}>
                <div className="gp-jogar-ring gp-jr1" style={{ inset: -9, borderColor: "rgba(220,38,38,0.40)", borderWidth: 1.5 }} />
                <div className="gp-jogar-ring gp-jr2" style={{ inset: -17, borderColor: "rgba(220,38,38,0.22)", borderWidth: 1 }} />
                <div className="gp-jogar-btn" style={{ position: "absolute", inset: 0 }}>
                  <Swords className="w-7 h-7 text-white relative" style={{ zIndex: 1, filter: "drop-shadow(0 0 4px rgba(255,200,200,0.35))" }} />
                </div>
              </div>
              <span className="text-[9px] font-black tracking-widest mt-1.5 uppercase" style={{ color: "rgba(167,139,250,0.78)" }}>{t("play")}</span>
            </button>

            <button className="gp-ni" onClick={() => onNavigate("friends")}>
              <Users className="w-5 h-5" /><span className="gp-ni-lbl">Social</span>
            </button>

            <button className="gp-ni" onClick={() => onNavigate("missions")}>
              <Target className="w-5 h-5" /><span className="gp-ni-lbl">Missões</span>
            </button>

            <button className="gp-ni" onClick={() => onNavigate("guild")}>
              <Users className="w-5 h-5" /><span className="gp-ni-lbl">Guilda</span>
            </button>

          </div>
        ) : (
          <div className="px-4 pb-6 pt-4 max-w-lg mx-auto space-y-2.5">
            <p className="text-[11px] text-center tracking-widest uppercase font-semibold mb-3" style={{ color: "rgba(139,92,246,0.5)" }}>Modo de jogo</p>

            <button onClick={() => onNavigate("duel-bot")}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl"
              style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6,#2563eb)", boxShadow: "0 8px 24px rgba(59,130,246,0.25)" }}>
              <Bot className="h-6 w-6" />{t("vsBot")}
            </button>

            <button onClick={() => onNavigate("duel-player")}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl"
              style={{ background: "linear-gradient(135deg,#c2410c,#f97316,#ea580c)", boxShadow: "0 8px 24px rgba(249,115,22,0.25)" }}>
              <Users className="h-6 w-6" />{t("vsPlayer")}
            </button>

            <button onClick={() => { setShowPlayMenu(false); onNavigate("story") }}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl"
              style={{ background: "linear-gradient(135deg,#5b21b6,#7c3aed,#4c1d95)", boxShadow: "0 8px 24px rgba(124,58,237,0.30)" }}>
              <BookOpen className="h-6 w-6" />Campanha
            </button>

            <button onClick={() => setShowPlayMenu(false)}
              className="w-full h-10 rounded-xl border text-sm font-semibold transition-colors hover:bg-white/[0.04]"
              style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(139,92,246,0.55)" }}>
              {t("back")}
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════ MODAIS ══════════════════════════════════════ */}

      {/* GIFT BOX */}
      {showGiftBox && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}>
          <div className="rounded-3xl max-w-md w-full p-6 relative"
            style={{ background: "linear-gradient(160deg,#05021A,#07031E)", border: "1px solid rgba(124,58,237,0.25)", boxShadow: "0 0 60px rgba(124,58,237,0.15)" }}>

            <button onClick={() => { setShowGiftBox(false); setClaimedCard(null); setClaimedCoins(null); setClaimAllResults(null) }}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5" style={{ color: "rgba(167,139,250,0.7)" }} />
            </button>

            <div className="flex items-center justify-center gap-3 mb-6">
              <Gift className="w-7 h-7" style={{ color: "#FCD34D" }} />
              <h2 className="text-xl font-black" style={{ background: "linear-gradient(135deg,#FCD34D,#F59E0B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Caixa de Presentes
              </h2>
            </div>

            {!claimedCard && !claimedCoins && !claimAllResults ? (
              unclaimedGifts.length > 0 ? (
                <>
                  {unclaimedGifts.length > 1 && (
                    <button onClick={handleClaimAll} disabled={isClaimingAll}
                      className="w-full gacha-btn h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-lg mb-4"
                      style={{ background: "linear-gradient(135deg,#059669,#10b981)", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
                      {isClaimingAll ? <><Sparkles className="w-4 h-4 animate-spin" />Coletando...</> : <><Gift className="w-4 h-4" />Coletar Tudo ({unclaimedGifts.length})</>}
                    </button>
                  )}
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {unclaimedGifts.map(gift => (
                      <div key={gift.id} className="rounded-2xl p-4" style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.25)" }}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 rounded-xl" style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}>
                            <Gift className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="font-bold text-white">{gift.title}</h3>
                        </div>
                        <p className="text-slate-300 text-sm mb-4">{gift.message}</p>
                        {gift.coinsReward && <div className="flex items-center gap-2 mb-3" style={{ color: "#FCD34D" }}><Coins className="w-4 h-4" /><span>+{gift.coinsReward} Moedas</span></div>}
                        <button onClick={() => handleOpenGift(gift.id)} disabled={isOpening}
                          className="gacha-btn w-full h-12 rounded-xl text-black font-bold flex items-center justify-center gap-2 shadow-lg"
                          style={{ background: "linear-gradient(135deg,#FCD34D,#F59E0B)", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}>
                          {isOpening ? <><Sparkles className="w-4 h-4 animate-spin" />Abrindo...</> : "Abrir Presente"}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(124,58,237,0.10)" }}>
                    <Gift className="w-8 h-8" style={{ color: "rgba(124,58,237,0.45)" }} />
                  </div>
                  <p style={{ color: "rgba(167,139,250,0.55)" }}>Nenhum presente disponível no momento.</p>
                </div>
              )
            ) : claimedCard ? (
              <div className="flex flex-col items-center py-4">
                <p className="font-bold text-lg mb-4" style={{ color: "#FCD34D" }}>Você recebeu:</p>
                <div className="relative animate-float">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 blur-2xl opacity-50 animate-pulse" />
                  <div className={`relative w-40 h-56 rounded-xl overflow-hidden shadow-2xl ${claimedCard.rarity === "LR" ? "rarity-lr" : claimedCard.rarity === "UR" ? "rarity-ur" : claimedCard.rarity === "SR" ? "rarity-sr" : "rarity-r"}`}>
                    <Image src={claimedCard.image || "/placeholder.svg"} alt={claimedCard.name} fill sizes="160px" className="object-cover" />
                  </div>
                </div>
                <h3 className="mt-4 text-xl font-bold text-white text-center">{claimedCard.name}</h3>
                <span className={`mt-2 px-4 py-1 rounded-full text-sm font-bold ${claimedCard.rarity === "LR" ? "bg-gradient-to-r from-red-500 to-amber-500 text-white" : claimedCard.rarity === "UR" ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black" : claimedCard.rarity === "SR" ? "bg-purple-500 text-white" : "bg-slate-500 text-white"}`}>
                  {claimedCard.rarity}
                </span>
                <button onClick={() => { setShowGiftBox(false); setClaimedCard(null) }}
                  className="mt-6 gacha-btn px-8 py-3 rounded-xl text-white font-bold shadow-lg"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
                  Fechar
                </button>
              </div>
            ) : claimAllResults ? (
              <div className="flex flex-col items-center py-4">
                <p className="font-bold text-lg mb-4" style={{ color: "#FCD34D" }}>Você recebeu:</p>
                <div className="w-full max-h-[50vh] overflow-y-auto space-y-3 mb-4">
                  {claimAllResults.cards.length > 0 && (
                    <div className="rounded-2xl p-4" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
                      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                        <Star className="w-5 h-5" style={{ color: "#FCD34D" }} />Cartas ({claimAllResults.cards.length})
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {claimAllResults.cards.map((card, index) => (
                          <div key={index} className="relative">
                            <div className={`relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg ${card.rarity === "LR" ? "rarity-lr" : card.rarity === "UR" ? "rarity-ur" : card.rarity === "SR" ? "rarity-sr" : "rarity-r"}`}>
                              <Image src={card.image || "/placeholder.svg"} alt={card.name} fill sizes="100px" className="object-cover" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {claimAllResults.coins > 0 && (
                    <div className="rounded-2xl p-4" style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)" }}>
                      <div className="flex items-center justify-center gap-3">
                        <Image src="/images/icons/gacha-coin.png" alt="Gacha Coin" width={40} height={40} className="w-10 h-10 object-contain" />
                        <span className="text-2xl font-bold" style={{ color: "#FCD34D" }}>+{claimAllResults.coins}</span>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => { setShowGiftBox(false); setClaimAllResults(null) }}
                  className="gacha-btn px-8 py-3 rounded-xl text-white font-bold shadow-lg"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
                  Fechar
                </button>
              </div>
            ) : claimedCoins ? (
              <div className="flex flex-col items-center py-8">
                <p className="font-bold text-lg mb-4" style={{ color: "#FCD34D" }}>Você recebeu:</p>
                <div className="relative animate-float">
                  <div className="absolute inset-0 rounded-2xl blur-2xl opacity-50 animate-pulse" style={{ background: "linear-gradient(135deg,#FCD34D,#F59E0B)" }} />
                  <div className="relative flex items-center gap-3 px-8 py-6 rounded-2xl shadow-2xl"
                    style={{ background: "linear-gradient(135deg,#D97706,#F59E0B)", boxShadow: "0 8px 32px rgba(245,158,11,0.35)" }}>
                    <Coins className="w-12 h-12 text-white" />
                    <span className="text-4xl font-bold text-white">+{claimedCoins}</span>
                  </div>
                </div>
                <p className="mt-4 text-xl font-bold text-white">Moedas de Gacha!</p>
                <button onClick={() => { setShowGiftBox(false); setClaimedCoins(null) }}
                  className="mt-6 gacha-btn px-8 py-3 rounded-xl text-white font-bold"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
                  Fechar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* DAILY BONUS */}
      {showDailyBonus && (
        <div className="fixed inset-0 z-[9400] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: "linear-gradient(160deg,#05021A,#07031E)",
              border: dailyBonusClaimed ? "1px solid rgba(100,100,100,0.15)" : "1px solid rgba(34,197,94,0.35)",
              boxShadow: dailyBonusClaimed ? "none" : "0 0 60px rgba(34,197,94,0.20)",
            }}>
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="text-6xl mb-3">{dailyBonusClaimed ? "✅" : "🎁"}</div>
              <h2 className="text-white font-black text-2xl mb-1">Bônus Diário</h2>
              <p className="text-sm" style={{ color: "rgba(167,139,250,0.58)" }}>
                {dailyBonusClaimed ? "Você já coletou o bônus de hoje. Volte amanhã!" : "Colete suas recompensas diárias gratuitas!"}
              </p>
            </div>
            <div className="px-6 py-5">
              <div className="rounded-2xl p-5 flex items-center justify-center gap-4"
                style={{
                  background: dailyBonusClaimed ? "rgba(255,255,255,0.03)" : "rgba(34,197,94,0.08)",
                  border: dailyBonusClaimed ? "1px solid rgba(100,100,100,0.12)" : "1px solid rgba(34,197,94,0.25)",
                }}>
                <div className="relative">
                  <Image src="/images/icons/gacha-coin.png" alt="Gacha Coin" width={56} height={56} className="drop-shadow-lg" />
                  {!dailyBonusClaimed && (
                    <div className="absolute inset-0 rounded-full blur-xl" style={{ background: "rgba(251,191,36,0.4)", transform: "scale(1.5)" }} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{ color: "rgba(167,139,250,0.5)" }}>Recompensa</p>
                  <p className="text-4xl font-black" style={{ color: dailyBonusClaimed ? "rgba(100,100,100,0.5)" : "#FCD34D" }}>+50</p>
                  <p className="text-xs" style={{ color: "rgba(124,58,237,0.5)" }}>Gacha Coins</p>
                </div>
              </div>
              {dailyBonusJustClaimed && (
                <div className="mt-3 text-center py-2.5 rounded-xl"
                  style={{ border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.10)" }}>
                  <p className="font-black text-sm" style={{ color: "#34d399" }}>🎉 +50 Coins coletados!</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 space-y-2.5">
              {!dailyBonusClaimed ? (
                <button onClick={handleClaimDailyBonus}
                  className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all hover:scale-[1.02] hover:brightness-110 shadow-2xl"
                  style={{ background: "linear-gradient(135deg,#15803d,#22c55e,#16a34a)", boxShadow: "0 8px 32px rgba(34,197,94,0.35)" }}>
                  🎁 Coletar Agora!
                </button>
              ) : (
                <div className="w-full py-4 rounded-2xl text-center font-bold"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,100,100,0.14)", color: "rgba(100,100,100,0.6)" }}>
                  Coletado hoje · Volte amanhã
                </div>
              )}
              <button onClick={() => setShowDailyBonus(false)}
                className="w-full py-2.5 rounded-xl border text-sm font-semibold transition-colors hover:bg-white/[0.04]"
                style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(139,92,246,0.5)" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WALLPAPER MODAL */}
      {showWallpaperModal && (
        <div className="fixed inset-0 z-[9500] flex flex-col" style={{ background: "rgba(0,0,0,0.94)", backdropFilter: "blur(8px)" }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ background: "rgba(5,2,18,0.95)", borderBottom: "1px solid rgba(124,58,237,0.22)" }}>
            <div>
              <h2 className="text-white font-black text-xl flex items-center gap-2">🖼️ Tema do Menu</h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(124,58,237,0.5)" }}>Escolha o wallpaper do menu principal</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(12,7,2,0.88)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <Image src="/images/icons/gacha-coin.png" alt="" width={16} height={16} className="object-contain" />
                <span className="font-black text-sm" style={{ color: "#FCD34D" }}>{coins.toLocaleString()}</span>
              </div>
              <button onClick={() => setShowWallpaperModal(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(167,139,250,0.7)" }}>
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {WALLPAPERS.map(wp => {
                const isSelected = selectedWallpaper === wp.id
                const isUnlocked = unlockedWallpapers.includes(wp.id)
                const canAfford  = coins >= wp.cost
                return (
                  <div key={wp.id}
                    className="relative rounded-2xl overflow-hidden cursor-pointer transition-all"
                    style={{
                      border: isSelected ? "2px solid rgba(139,92,246,0.85)" : isUnlocked ? "1px solid rgba(124,58,237,0.25)" : "1px solid rgba(124,58,237,0.10)",
                      boxShadow: isSelected ? "0 0 22px rgba(124,58,237,0.32),0 0 44px rgba(124,58,237,0.10)" : "none",
                      transform: isSelected ? "scale(1.02)" : undefined,
                      opacity: isUnlocked ? 1 : 0.82,
                    }}
                    onClick={() => { if (isUnlocked) handleSelectWallpaper(wp.id) }}>
                    <div className="relative aspect-video w-full overflow-hidden">
                      {wp.image ? (
                        <div className="absolute inset-0" style={{ backgroundImage: `url(${wp.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1"
                          style={{ background: "linear-gradient(145deg,#04081A,#070D24)" }}>
                          <span className="text-2xl">✨</span>
                          <span className="text-[10px]" style={{ color: "rgba(124,58,237,0.5)" }}>Padrão</span>
                        </div>
                      )}
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                          style={{ background: "rgba(0,0,0,0.72)" }}>
                          <span className="text-3xl">🔒</span>
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full"
                            style={{ background: "rgba(12,7,2,0.92)", border: "1px solid rgba(245,158,11,0.35)" }}>
                            <Image src="/images/icons/gacha-coin.png" alt="" width={14} height={14} className="object-contain" />
                            <span className="font-black text-xs" style={{ color: "#FCD34D" }}>{wp.cost}</span>
                          </div>
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                          style={{ background: "rgba(124,58,237,0.92)" }}>
                          <span className="text-white text-xs font-black">✓</span>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2.5" style={{ background: "rgba(5,2,18,0.94)" }}>
                      <p className="text-white font-bold text-sm truncate">{wp.name}</p>
                      <p className="text-xs truncate" style={{ color: "rgba(124,58,237,0.52)" }}>{wp.description}</p>
                      <div className="mt-2">
                        {isSelected ? (
                          <div className="w-full py-1.5 rounded-lg text-center text-[11px] font-black"
                            style={{ background: "rgba(88,28,135,0.25)", border: "1px solid rgba(124,58,237,0.30)", color: "rgba(167,139,250,0.9)" }}>
                            ✓ Ativo
                          </div>
                        ) : isUnlocked ? (
                          <button onClick={e => { e.stopPropagation(); handleSelectWallpaper(wp.id) }}
                            className="w-full py-1.5 rounded-lg text-center text-[11px] font-bold text-white transition-all hover:brightness-110"
                            style={{ background: "linear-gradient(135deg,#5b21b6,#7c3aed)" }}>
                            Selecionar
                          </button>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); if (canAfford) handleUnlockWallpaper(wp) }}
                            disabled={!canAfford}
                            className="w-full py-1.5 rounded-lg text-center text-[11px] font-black flex items-center justify-center gap-1 transition-all"
                            style={canAfford
                              ? { background: "linear-gradient(135deg,#92400E,#D97706)", color: "#000" }
                              : { background: "rgba(28,28,28,0.8)", border: "1px solid rgba(100,100,100,0.2)", color: "rgba(150,150,150,0.6)" }}>
                            {canAfford
                              ? <><Image src="/images/icons/gacha-coin.png" alt="" width={14} height={14} className="object-contain" />{wp.cost} — Desbloquear</>
                              : <>🔒 Coins insuficientes</>}
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
