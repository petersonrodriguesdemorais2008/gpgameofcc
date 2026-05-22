"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { useGame, type Card, CARD_BACK_IMAGE } from "@/contexts/game-context"

// ─── Reusable Pack Opening Overlay ────────────────────────────────────────────
// Exact same animation as gacha-screen. Used by master-screen reward system.
// Props:
//   packId  — "common" | "sr_guaranteed" | "lr_guaranteed"
//   onClose — called after CONFIRMAR (no args — cards already added to collection)

interface PackOpeningOverlayProps {
  packId:  string
  onClose: () => void
}

interface PackData {
  id:            number
  cards:         Card[]
  isOpened:      boolean
  isRevealing:   boolean
  highestRarity: "R" | "SR" | "UR" | "LR"
}

const CARDS_PER_PACK = 4

function getRarityColor(rarity: string) {
  if (rarity === "LR") return "from-red-500 to-amber-500"
  if (rarity === "UR") return "from-sky-400 to-blue-400"
  if (rarity === "SR") return "from-purple-500 to-violet-500"
  return "from-slate-500 to-slate-600"
}

function getPackGlowColor(rarity: string) {
  if (rarity === "LR") return "rgba(239,68,68,0.9)"
  if (rarity === "UR") return "rgba(251,191,36,0.85)"
  if (rarity === "SR") return "rgba(168,85,247,0.75)"
  return "rgba(148,163,184,0.4)"
}

export function PackOpeningOverlay({ packId, onClose }: PackOpeningOverlayProps) {
  const { allCards, addToCollection } = useGame()

  const [packs,            setPacks]           = useState<PackData[]>([])
  const [currentPackIndex, setCurrentPackIndex] = useState(0)
  const [packPhase,        setPackPhase]        = useState<"entering"|"floating"|"shaking"|"opening"|"revealing"|"done">("entering")
  const [cardRevealIndex,  setCardRevealIndex]  = useState(-1)
  const [rarityTier,       setRarityTier]       = useState<"normal"|"rare"|"epic"|"legendary">("normal")
  const [openedCards,      setOpenedCards]      = useState<Card[]>([])
  const [screenShake,      setScreenShake]      = useState(false)

  // Swipe
  const [swipeStartX,  setSwipeStartX]  = useState<number|null>(null)
  const [swipeProgress,setSwipeProgress] = useState(0)
  const [swipeComplete,setSwipeComplete] = useState(false)

  // Zoom
  const [revealZoomedCard, setRevealZoomedCard] = useState<{image:string;name:string;rarity:string}|null>(null)

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  // Pack image based on packId
  const packImage = packId === "anl" ? "/images/gacha/pack-anl.png" : "/images/gacha/pack-fsg.png"

  const pack = packs[currentPackIndex]
  const rarity = pack?.highestRarity ?? "R"
  const rarityGlow = {
    inner: getPackGlowColor(rarity),
    outer: rarity === "LR" ? "rgba(251,191,36,0.5)"
      : rarity === "UR"   ? "rgba(251,191,36,0.3)"
      : rarity === "SR"   ? "rgba(192,132,252,0.25)"
      : "rgba(148,163,184,0.2)",
    text: rarity === "LR" ? "text-red-400"
      : rarity === "UR"   ? "text-amber-400"
      : rarity === "SR"   ? "text-purple-400"
      : "text-slate-400",
    label: rarity === "LR" ? "✦ LENDÁRIO ✦"
      : rarity === "UR"   ? "✦ ULTRA RARO ✦"
      : rarity === "SR"   ? "✦ SUPER RARO ✦"
      : "",
  }

  // ── Build packs on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const newPacks: PackData[] = []
    const allPulledCards: Card[] = []

    for (let i = 0; i < CARDS_PER_PACK; i++) {
      const rand = Math.random() * 100
      let targetRarity: "R"|"SR"|"UR"|"LR"

      if (packId === "lr_guaranteed" && i === 0)      targetRarity = "LR"
      else if (packId === "sr_guaranteed" && i === 0) targetRarity = "SR"
      else if (rand < 0.5)  targetRarity = "LR"
      else if (rand < 5)    targetRarity = "UR"
      else if (rand < 30)   targetRarity = "SR"
      else                   targetRarity = "R"

      let available = allCards.filter(c => c.rarity === targetRarity)
      if (!available.length) available = allCards

      const base = available[Math.floor(Math.random() * available.length)]
      const card = { ...base, id: `${base.id}-master-${Date.now()}-${i}` }
      allPulledCards.push(card)
    }

    const rarities = ["R","SR","UR","LR"] as const
    let highestRarity: "R"|"SR"|"UR"|"LR" = "R"
    for (const c of allPulledCards) {
      if (rarities.indexOf(c.rarity) > rarities.indexOf(highestRarity)) highestRarity = c.rarity
    }

    const packData: PackData = {
      id:0, cards:allPulledCards, isOpened:false, isRevealing:false, highestRarity,
    }
    newPacks.push(packData)

    const hasLR = allPulledCards.some(c => c.rarity === "LR")
    const hasUR = allPulledCards.some(c => c.rarity === "UR")
    const hasSR = allPulledCards.some(c => c.rarity === "SR")
    if (hasLR) setRarityTier("legendary")
    else if (hasUR) setRarityTier("epic")
    else if (hasSR) setRarityTier("rare")
    else setRarityTier("normal")

    setPacks(newPacks)
    setOpenedCards(allPulledCards)
    addToCollection(allPulledCards)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Particle canvas ───────────────────────────────────────────────────────
  const drawParticles = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const cx = canvas.width / 2, cy = canvas.height / 2

    const palettes: Record<string,string[]> = {
      normal:    ["#64748b","#94a3b8","#cbd5e1","#e2e8f0"],
      rare:      ["#7c3aed","#8b5cf6","#a78bfa","#c4b5fd","#ede9fe"],
      epic:      ["#fbbf24","#f59e0b","#fcd34d","#fde68a","#ffffff"],
      legendary: ["#ef4444","#f97316","#fbbf24","#22c55e","#3b82f6","#8b5cf6","#ec4899"],
    }
    const cols = palettes[rarityTier]
    interface P { x:number;y:number;vx:number;vy:number;size:number;color:string;alpha:number;life:number;maxLife:number;type:"spark"|"star";spin?:number;trail?:{x:number;y:number}[] }
    const particles: P[] = []
    let t = 0

    const spawnAmbient = () => {
      if (particles.length >= 120) return
      const x = Math.random() * canvas.width
      const y = canvas.height + 10
      particles.push({ x,y, vx:(Math.random()-0.5)*1.5, vy:-1.5-Math.random()*2.5,
        size:1.5+Math.random()*3, color:cols[Math.floor(Math.random()*cols.length)],
        alpha:0.9, life:200, maxLife:200, type:"spark" })
    }
    const spawnBurst = (num:number,x:number,y:number,speed:number) => {
      for (let i=0;i<num;i++) {
        const a=(Math.PI*2/num)*i+Math.random()*0.4
        const s=speed*(0.7+Math.random()*0.6)
        particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
          size:3+Math.random()*6,color:cols[Math.floor(Math.random()*cols.length)],
          alpha:1,life:70,maxLife:70,type:Math.random()<0.3?"star":"spark",
          spin:(Math.random()-0.5)*0.3,trail:[]})
      }
    }

    const animate = () => {
      t++
      ctx.fillStyle = packPhase==="opening"?"rgba(0,0,0,0.25)":"rgba(0,0,0,0.06)"
      ctx.fillRect(0,0,canvas.width,canvas.height)
      if (t%2===0) spawnAmbient()
      if (packPhase==="opening") {
        if(t===1)  spawnBurst(40,cx,cy,18)
        if(t===8)  spawnBurst(30,cx,cy,12)
        if(t===16) spawnBurst(20,cx,cy,8)
      }
      if (packPhase==="shaking"&&t%4===0) spawnBurst(4,cx+(Math.random()-0.5)*60,cy+(Math.random()-0.5)*80,3)
      if (packPhase==="revealing"&&t%25===0&&cardRevealIndex>=0) spawnBurst(8,cx+(cardRevealIndex-1.5)*80+(Math.random()-0.5)*60,cy+(Math.random()-0.5)*60,5)

      ctx.globalAlpha=1
      for (let i=particles.length-1;i>=0;i--) {
        const p=particles[i]
        p.x+=p.vx;p.y+=p.vy;p.vx*=0.96;p.vy*=0.96;p.life--
        const pct=p.life/p.maxLife; p.alpha=pct*0.9
        if(p.life<=0){particles.splice(i,1);continue}
        if(p.trail){p.trail.unshift({x:p.x,y:p.y});if(p.trail.length>8)p.trail.pop()}
        ctx.save(); ctx.globalAlpha=Math.max(0,p.alpha)
        if(p.type==="star"){
          ctx.translate(p.x,p.y); if(p.spin) ctx.rotate(p.spin*t)
          ctx.fillStyle=p.color; const r=p.size,inner=r*0.4; ctx.beginPath()
          for(let k=0;k<8;k++){const a=(Math.PI/4)*k;const rad=k%2===0?r:inner;k===0?ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad)}
          ctx.closePath(); ctx.fill()
        } else {
          ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(0.1,p.size),0,Math.PI*2)
          ctx.fillStyle=p.color; ctx.fill()
        }
        ctx.restore()
      }
      ctx.globalAlpha=1
      animationRef.current=requestAnimationFrame(animate)
    }
    animate()
  }, [packPhase, rarityTier, cardRevealIndex])

  useEffect(() => {
    drawParticles()
    return () => { if(animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [drawParticles])

  // ── Phase progression ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!packs.length) return
    if (packPhase === "entering") {
      const t = setTimeout(() => { setPackPhase("floating"); setSwipeProgress(0); setSwipeComplete(false) }, 800)
      return () => clearTimeout(t)
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
  }, [packPhase, packs.length])

  // ── Card reveal delays ────────────────────────────────────────────────────
  useEffect(() => {
    if (packPhase !== "revealing" || cardRevealIndex >= CARDS_PER_PACK) return
    const card = pack?.cards[cardRevealIndex]
    const delay = card?.rarity==="LR"?900:card?.rarity==="UR"?600:card?.rarity==="SR"?400:280
    const t = setTimeout(() => setCardRevealIndex(v => v+1), delay)
    return () => clearTimeout(t)
  }, [packPhase, cardRevealIndex, pack])

  // ── All cards revealed → done ─────────────────────────────────────────────
  useEffect(() => {
    if (packPhase === "revealing" && cardRevealIndex >= CARDS_PER_PACK) {
      const t = setTimeout(() => { setPackPhase("done") }, 1000)
      return () => clearTimeout(t)
    }
  }, [packPhase, cardRevealIndex])

  // ── Swipe handlers ────────────────────────────────────────────────────────
  const handleSwipeStart = (clientX:number) => {
    if (packPhase !== "floating") return
    setSwipeStartX(clientX)
  }
  const handleSwipeMove = (clientX:number) => {
    if (packPhase !== "floating" || swipeStartX === null) return
    const delta = clientX - swipeStartX
    const progress = Math.min(1, Math.max(0, delta/160))
    setSwipeProgress(progress)
    if (progress >= 1 && !swipeComplete) {
      setSwipeComplete(true); setSwipeProgress(1); setSwipeStartX(null); setPackPhase("shaking")
    }
  }
  const handleSwipeEnd = () => {
    if (swipeProgress < 1) { setSwipeProgress(0); setSwipeStartX(null) }
  }

  return (
    <div className={`fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center overflow-hidden ${screenShake?"animate-shake":""}`}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Skip button */}
      {packPhase !== "done" && packPhase !== "revealing" && (
        <button
          onClick={() => { setPackPhase("revealing"); setCardRevealIndex(0) }}
          className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-white/8 border border-white/12 rounded-lg text-slate-400 text-xs font-bold hover:bg-white/14 transition-colors">
          Pular
        </button>
      )}

      {/* ── Pack animation ── */}
      {(packPhase==="entering"||packPhase==="floating"||packPhase==="shaking"||packPhase==="opening") && (
        <div className="relative flex flex-col items-center select-none">
          {/* Ambient halo */}
          <div className="absolute pointer-events-none" style={{
            inset:"-60px", borderRadius:"50%",
            background:`radial-gradient(ellipse at 50% 50%, ${rarityGlow.inner} 0%, transparent 65%)`,
            filter:"blur(35px)",
            animation:packPhase==="shaking"?"haloFlicker 0.1s ease-in-out infinite":
              packPhase==="floating"?"haloPulse 1.8s ease-in-out infinite":"haloPulse 2s ease-in-out infinite",
            opacity:packPhase==="entering"?0.4:0.8,
          }}/>

          {/* "Abra!" */}
          {packPhase==="floating" && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap"
              style={{animation:"abraLabel 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards"}}>
              <span className="text-white/90 font-black text-xl tracking-widest"
                style={{textShadow:`0 0 14px ${rarityGlow.inner}, 0 0 28px ${rarityGlow.outer}`}}>
                Abra!
              </span>
            </div>
          )}

          {/* Pack body */}
          <div className="relative" style={{
            width:"208px", height:"308px",
            animation:
              packPhase==="entering"?"packEnterEpic 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards":
              packPhase==="floating"?"packFloat 2.4s ease-in-out infinite":
              packPhase==="shaking"?"packShakeEpic 0.1s ease-in-out infinite":
              packPhase==="opening"?"packOpenEpic 1s cubic-bezier(0.22,1,0.36,1) forwards":undefined,
            filter:`drop-shadow(0 0 30px ${rarityGlow.inner}) drop-shadow(0 0 60px ${rarityGlow.outer})`,
          }}>
            <Image src={packImage||"/placeholder.svg"} alt="Pack" fill sizes="208px" className="object-contain"/>
            {/* Sheen */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg" style={{
              background:"linear-gradient(135deg,transparent 35%,rgba(255,255,255,0.14) 50%,transparent 65%)",
              animation:"packSheen 3.5s ease-in-out infinite",
            }}/>
            {/* Tear line */}
            {packPhase==="floating" && (
              <div
                className="absolute left-0 right-0 z-30 cursor-grab active:cursor-grabbing"
                style={{top:"9%",height:"44px",touchAction:"none"}}
                onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);handleSwipeStart(e.clientX)}}
                onPointerMove={e=>handleSwipeMove(e.clientX)}
                onPointerUp={handleSwipeEnd}
                onPointerCancel={handleSwipeEnd}
              >
                {/* Perforation line */}
                <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex items-center gap-[3px] px-1">
                  {[...Array(28)].map((_,i)=>(
                    <div key={i} className="flex-1 h-[2px] rounded-full" style={{
                      background:swipeProgress>i/28?`linear-gradient(to right,white,${rarityGlow.inner})`:"rgba(255,255,255,0.25)",
                      transition:"background 0.1s",
                      boxShadow:swipeProgress>i/28?`0 0 6px ${rarityGlow.inner}`:"none",
                    }}/>
                  ))}
                </div>
                {/* Scissor indicator */}
                <div className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-100"
                  style={{left:`${4+swipeProgress*88}%`}}>
                  <div className="flex items-center gap-1"
                    style={{animation:swipeProgress===0?"swipeHint 1.2s ease-in-out infinite":"none",
                      filter:`drop-shadow(0 0 8px ${rarityGlow.inner})`}}>
                    <span style={{fontSize:"20px",lineHeight:1}}>✂</span>
                    {swipeProgress<0.05&&(
                      <span className="text-white/70 text-[10px] font-bold ml-1 whitespace-nowrap"
                        style={{animation:"swipeHintText 1.2s ease-in-out infinite"}}>
                        ← rasgar
                      </span>
                    )}
                  </div>
                </div>
                {/* Progress fill */}
                {swipeProgress>0&&(
                  <div className="absolute top-0 left-0 bottom-0 pointer-events-none rounded-r-full" style={{
                    width:`${swipeProgress*100}%`,
                    background:`linear-gradient(to right,transparent,${rarityGlow.inner}20)`,
                    borderRight:`2px solid ${rarityGlow.inner}`,
                    boxShadow:`0 0 12px ${rarityGlow.inner}`,
                  }}/>
                )}
              </div>
            )}
          </div>

          {/* Swipe instruction */}
          {packPhase==="floating"&&swipeProgress===0&&(
            <div className="mt-6 text-center pointer-events-none"
              style={{animation:"abraLabel 0.6s ease-out 0.2s both"}}>
              <p className="text-white/40 text-xs tracking-widest">arraste a linha para rasgar</p>
            </div>
          )}

          {/* Burst rays on opening */}
          {packPhase==="opening"&&(
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[...Array(18)].map((_,i)=>(
                <div key={i} className="absolute" style={{
                  width:"2.5px",height:"200px",
                  background:`linear-gradient(to top,transparent,${rarityGlow.inner},white,transparent)`,
                  transform:`rotate(${i*(360/18)}deg)`,transformOrigin:"50% 100%",
                  top:"50%",left:"50%",marginLeft:"-1.25px",
                  animation:`burstRayEpic 1s cubic-bezier(0.22,1,0.36,1) ${i*0.012}s forwards`,
                  opacity:0,borderRadius:"2px",
                  filter:`blur(1px) drop-shadow(0 0 4px ${rarityGlow.inner})`,
                }}/>
              ))}
              <div className="absolute inset-0 rounded-full" style={{
                background:`radial-gradient(circle,white 0%,${rarityGlow.inner} 25%,transparent 65%)`,
                animation:"centralFlash 1s ease-out forwards",
              }}/>
            </div>
          )}

          {/* Rarity announce */}
          {packPhase==="opening"&&rarity!=="R"&&(
            <div className="absolute -bottom-20 left-1/2 whitespace-nowrap pointer-events-none"
              style={{animation:"rarityAnnounce 0.85s cubic-bezier(0.34,1.56,0.64,1) 0.35s forwards",
                opacity:0,transform:"translateX(-50%) scale(0.5)"}}>
              <span className={`text-3xl font-black tracking-widest drop-shadow-2xl ${rarityGlow.text}`}
                style={{textShadow:rarity==="LR"?"0 0 20px #ef4444, 0 0 40px #fbbf24":
                  rarity==="UR"?"0 0 20px #38bdf8, 0 0 40px #7dd3fc":"0 0 20px #a855f7, 0 0 35px #c084fc"}}>
                {rarityGlow.label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Card reveal ── */}
      {packPhase==="revealing"&&pack&&(
        <div className="flex flex-col items-center gap-5 w-full"
          style={{animation:"revealContainerIn 0.4s ease-out forwards"}}>
          <div className="flex gap-3 justify-center px-2">
            {pack.cards.map((card,idx)=>{
              const isRevealed  = idx < cardRevealIndex
              const isRevealing = idx === cardRevealIndex - 1
              const cardGlow =
                card.rarity==="LR"?"0 0 30px rgba(239,68,68,0.9),0 0 60px rgba(251,191,36,0.5)":
                card.rarity==="UR"?"0 0 25px rgba(56,189,248,0.85),0 0 50px rgba(99,179,237,0.4)":
                card.rarity==="SR"?"0 0 22px rgba(168,85,247,0.8),0 0 40px rgba(192,132,252,0.3)":
                "0 0 12px rgba(148,163,184,0.4)"
              return (
                <div key={`${card.id}-${idx}`} className="flex flex-col items-center gap-2">
                  <div style={{perspective:"900px",width:"108px",height:"155px"}}>
                    <div
                      className={isRevealed?"cursor-pointer":""}
                      style={{
                        width:"108px",height:"155px",position:"relative",
                        transformStyle:"preserve-3d",
                        transform:isRevealed?"rotateY(0deg)":"rotateY(-180deg)",
                        transition:isRevealing?`transform ${card.rarity==="LR"?"0.9s":card.rarity==="UR"?"0.75s":"0.6s"} cubic-bezier(0.4,0,0.2,1)`:"none",
                        opacity:!isRevealed&&idx>cardRevealIndex?0.10:1,
                      }}
                      onClick={()=>isRevealed&&setRevealZoomedCard({image:card.image||"/placeholder.svg",name:card.name,rarity:card.rarity})}
                    >
                      {/* Front */}
                      <div className="absolute inset-0 overflow-hidden" style={{
                        backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",
                        boxShadow:isRevealed?cardGlow:"none",transition:"box-shadow 0.4s ease",
                      }}>
                        {(isRevealed||isRevealing)&&(
                          <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="115px" className="object-cover"/>
                        )}
                        {isRevealing&&(
                          <div className="absolute inset-0 z-20 pointer-events-none" style={{
                            background:"linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.75) 50%,transparent 65%)",
                            animation:"shineSweep 0.65s ease-out 0.2s forwards",transform:"translateX(-100%)",
                          }}/>
                        )}
                        {card.rarity==="LR"&&isRevealed&&(
                          <div className="absolute inset-0 pointer-events-none" style={{
                            background:"linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)",
                            backgroundSize:"300% 100%",animation:"rainbowShift 1.5s linear infinite",
                            padding:"3px",WebkitMask:"linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                            WebkitMaskComposite:"xor",maskComposite:"exclude",
                          }}/>
                        )}
                        {card.rarity==="UR"&&isRevealed&&(
                          <div className="absolute inset-0 pointer-events-none" style={{
                            border:"2px solid rgba(56,189,248,0.9)",boxShadow:"inset 0 0 14px rgba(56,189,248,0.35)",
                            animation:"urDiamondPulse 1.8s ease-in-out infinite",
                          }}/>
                        )}
                        {card.rarity==="SR"&&isRevealed&&(
                          <div className="absolute inset-0 pointer-events-none" style={{
                            border:"2px solid rgba(168,85,247,0.8)",animation:"srGoldPulse 2s ease-in-out infinite",
                          }}/>
                        )}
                      </div>
                      {/* Back */}
                      <div className="absolute inset-0 overflow-hidden" style={{
                        backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",
                        transform:"rotateY(180deg)",
                      }}>
                        <Image src={CARD_BACK_IMAGE || "/images/card-back.png"} alt="Card Back" fill sizes="115px" className="object-cover"/>
                      </div>
                    </div>
                  </div>
                  {/* Rarity badge */}
                  <div className={`px-2.5 py-0.5 text-center text-xs font-black bg-gradient-to-r ${getRarityColor(card.rarity)} text-white`}
                    style={{
                      opacity:isRevealed?1:0,
                      transform:isRevealed?"translateY(0) scale(1)":"translateY(-6px) scale(0.8)",
                      transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.35s",
                    }}>
                    {card.rarity}
                  </div>
                </div>
              )
            })}
          </div>
          {cardRevealIndex>=CARDS_PER_PACK&&(
            <p className="text-white/25 text-[10px] tracking-widest"
              style={{animation:"fadeIn 0.5s ease-out forwards"}}>
              toque em uma carta para ampliar
            </p>
          )}
        </div>
      )}

      {/* ── Final results ── */}
      {packPhase==="done"&&(
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4"
          style={{animation:"fadeIn 0.5s ease-out forwards"}}>
          <h2 className="text-3xl font-black text-white mb-1 tracking-wider"
            style={{textShadow:"0 0 20px rgba(255,255,255,0.3)"}}>
            Cartas Obtidas!
          </h2>
          <p className="text-slate-500 text-xs mb-4 tracking-widest uppercase">
            {openedCards.length} cartas · toque para ampliar
          </p>
          <div className="flex gap-2.5 justify-center flex-wrap max-w-lg mb-6">
            {packs[0]?.cards.map((card,idx)=>{
              const cardGlow =
                card.rarity==="LR"?"0 0 24px rgba(239,68,68,0.85),0 0 48px rgba(251,191,36,0.45)":
                card.rarity==="UR"?"0 0 20px rgba(56,189,248,0.85),0 0 40px rgba(99,179,237,0.35)":
                card.rarity==="SR"?"0 0 18px rgba(168,85,247,0.75),0 0 36px rgba(192,132,252,0.25)":"none"
              return (
                <div key={`${card.id}-final-${idx}`}
                  className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  style={{animation:"cardPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
                    animationDelay:`${idx*0.06}s`,opacity:0}}
                  onClick={()=>setRevealZoomedCard({image:card.image||"/placeholder.svg",name:card.name,rarity:card.rarity})}>
                  <div className="relative overflow-hidden transition-transform duration-200 group-hover:scale-110 group-hover:z-10"
                    style={{width:"86px",height:"122px",boxShadow:cardGlow}}>
                    <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="96px" className="object-cover"/>
                    {card.rarity==="LR"&&(
                      <div className="absolute inset-0 pointer-events-none" style={{
                        background:"linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)",
                        backgroundSize:"300% 100%",animation:"rainbowShift 1.5s linear infinite",
                        padding:"2px",WebkitMask:"linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite:"xor",maskComposite:"exclude",
                      }}/>
                    )}
                    {card.rarity==="UR"&&(
                      <div className="absolute inset-0 pointer-events-none" style={{
                        border:"2px solid rgba(56,189,248,0.85)",
                        boxShadow:"inset 0 0 10px rgba(56,189,248,0.25)",
                        animation:"urDiamondPulse 1.8s ease-in-out infinite",
                      }}/>
                    )}
                    {card.rarity==="SR"&&(
                      <div className="absolute inset-0 pointer-events-none" style={{
                        border:"1.5px solid rgba(168,85,247,0.75)",
                        animation:"srGoldPulse 2s ease-in-out infinite",
                      }}/>
                    )}
                  </div>
                  <div className={`px-2 py-0.5 text-center text-[10px] font-black bg-gradient-to-r ${getRarityColor(card.rarity)} text-white`}>
                    {card.rarity}
                  </div>
                </div>
              )
            })}
          </div>
          {/* CONFIRMAR — NO toast, just close and return to master screen */}
          <button onClick={onClose}
            className="px-10 py-3.5 text-lg font-black rounded-2xl border-2 border-emerald-400/50 transition-all hover:scale-105"
            style={{background:"linear-gradient(135deg,#059669,#10b981,#34d399)",
              animation:"scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.3s forwards",opacity:0}}>
            CONFIRMAR
          </button>
        </div>
      )}

      {/* Zoom */}
      {revealZoomedCard&&(
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={()=>setRevealZoomedCard(null)}>
          <div className="relative" style={{width:"260px",height:"370px"}}>
            <Image src={revealZoomedCard.image||"/placeholder.svg"} alt={revealZoomedCard.name}
              fill sizes="260px" className="object-contain"
              style={{filter:`drop-shadow(0 0 30px ${getPackGlowColor(revealZoomedCard.rarity)})`}}/>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes packFloat{0%,100%{transform:translateY(0px) rotate(0deg)}30%{transform:translateY(-12px) rotate(0.5deg)}70%{transform:translateY(-8px) rotate(-0.3deg)}}
        @keyframes abraLabel{0%{opacity:0;transform:translateX(-50%) translateY(-8px) scale(0.85)}60%{opacity:1;transform:translateX(-50%) translateY(2px) scale(1.05)}100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
        @keyframes swipeHint{0%,100%{transform:translateX(0);opacity:0.7}40%{transform:translateX(18px);opacity:1}80%{transform:translateX(8px);opacity:0.9}}
        @keyframes swipeHintText{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes packEnterEpic{0%{transform:translateY(-200px) scale(0.4) rotate(-8deg);opacity:0;filter:brightness(0)}50%{transform:translateY(18px) scale(1.07) rotate(1.5deg);opacity:1;filter:brightness(1.4)}75%{transform:translateY(-6px) scale(0.98) rotate(-0.5deg)}100%{transform:translateY(0) scale(1) rotate(0deg);opacity:1;filter:brightness(1)}}
        @keyframes packShakeEpic{0%{transform:translateX(0) rotate(0deg)}15%{transform:translateX(-7px) rotate(-1.5deg) scale(1.01)}30%{transform:translateX(9px) rotate(2deg) scale(1.02)}45%{transform:translateX(-11px) rotate(-2.5deg) scale(1.03)}60%{transform:translateX(10px) rotate(2deg) scale(1.02)}75%{transform:translateX(-8px) rotate(-1.5deg) scale(1.01)}100%{transform:translateX(0) rotate(0deg)}}
        @keyframes packOpenEpic{0%{transform:scale(1) rotate(0deg) translateY(0);opacity:1}20%{transform:scale(1.12) rotate(0.5deg) translateY(-8px)}50%{transform:scale(1.35) rotate(-1deg) translateY(-15px);opacity:0.9;filter:brightness(2.5)}80%{transform:scale(0.5) rotate(5deg) translateY(20px);opacity:0.3}100%{transform:scale(0) rotate(12deg) translateY(40px);opacity:0}}
        @keyframes burstRayEpic{0%{opacity:0;transform:rotate(var(--r,0deg)) scaleY(0) translateY(-50%)}20%{opacity:1}60%{opacity:0.6;transform:rotate(var(--r,0deg)) scaleY(1) translateY(-50%)}100%{opacity:0;transform:rotate(var(--r,0deg)) scaleY(2.5) translateY(-50%)}}
        @keyframes centralFlash{0%{opacity:0;transform:scale(0)}15%{opacity:1;transform:scale(0.8)}40%{opacity:0.7;transform:scale(1.2)}100%{opacity:0;transform:scale(2.5)}}
        @keyframes rarityAnnounce{0%{opacity:0;transform:translateX(-50%) scale(0.4) rotate(-5deg)}60%{opacity:1;transform:translateX(-50%) scale(1.1) rotate(1deg)}80%{transform:translateX(-50%) scale(0.97) rotate(-0.5deg)}100%{opacity:1;transform:translateX(-50%) scale(1) rotate(0deg)}}
        @keyframes haloPulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes haloFlicker{0%,100%{opacity:0.7;transform:scale(1.05) rotate(0deg)}33%{opacity:1;transform:scale(1.2) rotate(1deg)}66%{opacity:0.9;transform:scale(1.1) rotate(-1deg)}}
        @keyframes packSheen{0%,100%{background-position:200% 200%;opacity:0.6}50%{background-position:-100% -100%;opacity:1}}
        @keyframes shineSweep{0%{transform:translateX(-150%)}100%{transform:translateX(250%)}}
        @keyframes urDiamondPulse{0%,100%{box-shadow:0 0 10px rgba(56,189,248,0.5),inset 0 0 8px rgba(56,189,248,0.2);border-color:rgba(56,189,248,0.7)}50%{box-shadow:0 0 25px rgba(56,189,248,0.9),0 0 50px rgba(99,179,237,0.4),inset 0 0 15px rgba(56,189,248,0.4);border-color:rgba(56,189,248,1)}}
        @keyframes srGoldPulse{0%,100%{box-shadow:0 0 8px rgba(168,85,247,0.5);border-color:rgba(168,85,247,0.6)}50%{box-shadow:0 0 20px rgba(168,85,247,0.9),0 0 40px rgba(192,132,252,0.3);border-color:rgba(168,85,247,1)}}
        @keyframes rainbowShift{0%{background-position:0% 50%}100%{background-position:300% 50%}}
        @keyframes revealContainerIn{0%{opacity:0;transform:translateY(30px) scale(0.95)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes fadeIn{0%{opacity:0}100%{opacity:1}}
        @keyframes scaleIn{0%{transform:scale(0.7);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes cardPopIn{0%{transform:scale(0) rotate(-12deg);opacity:0}55%{transform:scale(1.12) rotate(2deg)}80%{transform:scale(0.97) rotate(-0.5deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes shake{0%,100%{transform:translateX(0) rotate(0deg)}10%,50%,90%{transform:translateX(-10px) rotate(-1deg)}30%,70%{transform:translateX(10px) rotate(1deg)}}
        .animate-shake{animation:shake 0.5s cubic-bezier(.36,.07,.19,.97) both}
      `}} />
    </div>
  )
}
