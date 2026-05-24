"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, PROFILE_ICONS } from "@/contexts/game-context"
import { ArrowLeft, Edit3, Check, X, Copy, Shield, Flame, Crown, BookOpen, Star, Trophy, Swords, Zap, Lock } from "lucide-react"
import Image from "next/image"

interface ProfileScreenProps { onBack: () => void }

const BASE_PLAYER_TITLES = ["Iniciante","Colecionador","Estrategista","Mestre das Cartas","Guardiao Lendario","Comandante de Elite","Senhor do Gacha","Lenda Viva"]

function getPlayerTitles(): string[] {
  if (typeof window === "undefined") return BASE_PLAYER_TITLES
  try {
    const raw = localStorage.getItem("gpgame_titles") ?? "[]"
    const unlocked: string[] = JSON.parse(raw)
    const all = [...BASE_PLAYER_TITLES]
    for (const t of unlocked) { if (!all.includes(t)) all.push(t) }
    return all
  } catch { return BASE_PLAYER_TITLES }
}

const ELEMENT_COLORS: Record<string,string> = {
  Aquos:"#38bdf8", Fire:"#f87171", Darkus:"#a855f7", Void:"#22d3ee",
  Ventus:"#4ade80", Lightness:"#fde68a", Subterra:"#fb923c", Haos:"#fde68a",
  Darkness:"#a855f7", Shadow:"#8b5cf6",
}

function rarityGlow(r: string) {
  if (r==="LR") return "0 0 20px rgba(239,68,68,0.9),0 0 40px rgba(251,191,36,0.5)"
  if (r==="UR") return "0 0 16px rgba(56,189,248,0.85),0 0 32px rgba(99,179,237,0.4)"
  if (r==="SR") return "0 0 14px rgba(168,85,247,0.8),0 0 28px rgba(192,132,252,0.3)"
  return "none"
}
function rarityBorder(r: string) {
  if (r==="LR") return "2px solid rgba(239,68,68,0.9)"
  if (r==="UR") return "2px solid rgba(56,189,248,0.85)"
  if (r==="SR") return "1.5px solid rgba(168,85,247,0.75)"
  return "1px solid rgba(148,163,184,0.3)"
}
function rarityBg(r: string) {
  if (r==="LR") return "linear-gradient(135deg,rgba(239,68,68,0.15),rgba(251,191,36,0.08))"
  if (r==="UR") return "linear-gradient(135deg,rgba(56,189,248,0.12),rgba(99,179,237,0.06))"
  if (r==="SR") return "linear-gradient(135deg,rgba(168,85,247,0.12),rgba(192,132,252,0.06))"
  return "rgba(255,255,255,0.03)"
}

// Tab background colours
const TAB_BG: Record<string,string> = {
  stats:        "radial-gradient(ellipse 80% 60% at 50% 0%,rgba(56,189,248,0.10) 0%,transparent 70%)",
  achievements: "radial-gradient(ellipse 80% 60% at 50% 0%,rgba(251,191,36,0.10) 0%,transparent 70%)",
  collection:   "radial-gradient(ellipse 80% 60% at 50% 0%,rgba(168,85,247,0.12) 0%,transparent 70%)",
}

// Particle canvas for achievements
function AchievementParticles({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raf  = useRef<number>()
  useEffect(() => {
    if (!active) return
    const c = ref.current; if (!c) return
    const ctx = c.getContext("2d")!
    c.width = c.offsetWidth; c.height = c.offsetHeight
    const pts: { x:number;y:number;vx:number;vy:number;life:number;col:string }[] = []
    const cols = ["#fbbf24","#f59e0b","#fcd34d","#fff","#a78bfa"]
    for (let i=0;i<40;i++) pts.push({
      x:Math.random()*c.width, y:c.height+10,
      vx:(Math.random()-.5)*1.5, vy:-1-Math.random()*2,
      life:1, col:cols[Math.floor(Math.random()*cols.length)]
    })
    const draw = () => {
      ctx.clearRect(0,0,c.width,c.height)
      pts.forEach((p,i)=>{
        p.x+=p.vx; p.y+=p.vy; p.life-=0.012
        if (p.life<=0) {
          pts[i]={x:Math.random()*c.width,y:c.height+10,vx:(Math.random()-.5)*1.5,vy:-1-Math.random()*2,life:1,col:cols[Math.floor(Math.random()*cols.length)]}
        }
        ctx.globalAlpha=p.life*.8
        ctx.fillStyle=p.col
        ctx.beginPath(); ctx.arc(p.x,p.y,2,0,Math.PI*2); ctx.fill()
      })
      ctx.globalAlpha=1
      raf.current=requestAnimationFrame(draw)
    }
    draw()
    return ()=>{if(raf.current) cancelAnimationFrame(raf.current)}
  },[active])
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>
}

// Animated win-rate ring
function WinRing({ rate }: { rate: number }) {
  const r=48, stroke=7, circ=2*Math.PI*r
  const dash = circ*(rate/100)
  return (
    <svg width={120} height={120} style={{transform:"rotate(-90deg)"}}>
      <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}/>
      <circle cx={60} cy={60} r={r} fill="none"
        stroke={rate>=60?"#4ade80":rate>=40?"#fbbf24":"#f87171"}
        strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{transition:"stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)",filter:`drop-shadow(0 0 6px ${rate>=60?"#4ade80":rate>=40?"#fbbf24":"#f87171"})`}}/>
    </svg>
  )
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { t } = useLanguage()
  const { playerProfile, updatePlayerProfile, collection, decks, matchHistory, coins, friendPoints, playerId } = useGame()

  const [isEditing,       setIsEditing]       = useState(false)
  const [editName,        setEditName]         = useState(playerProfile.name)
  const [editTitle,       setEditTitle]        = useState(playerProfile.title)
  const [showIconSel,     setShowIconSel]      = useState(false)
  const [activeTab,       setActiveTab]        = useState<"stats"|"achievements"|"collection">("stats")
  const [copied,          setCopied]           = useState(false)
  const [playerTitles,    setPlayerTitles]     = useState<string[]>(BASE_PLAYER_TITLES)
  const [hoveredCard,     setHoveredCard]      = useState<string|null>(null)
  const [cardTilt,        setCardTilt]         = useState({x:0,y:0})
  const [zoomedCard,      setZoomedCard]       = useState<any|null>(null)

  useEffect(() => {
    setPlayerTitles(getPlayerTitles())
    const h = () => setPlayerTitles(getPlayerTitles())
    window.addEventListener("gpgame_title_unlocked", h)
    return () => window.removeEventListener("gpgame_title_unlocked", h)
  }, [])

  // Stats
  const totalMatches = matchHistory.length
  const wins         = matchHistory.filter(m => m.result==="won").length
  const winRate      = totalMatches>0 ? Math.round((wins/totalMatches)*100) : 0
  const uniqueCards  = new Set(collection.map(c=>c.id.split("-").slice(0,-2).join("-"))).size
  const rarityCount  = { LR:0,UR:0,SR:0,R:0 } as Record<string,number>
  collection.forEach(c=>{ if(rarityCount[c.rarity]!==undefined) rarityCount[c.rarity]++ })

  // Favourite element from units
  const elemMap: Record<string,number> = {}
  collection.filter(c=>c.type==="unit").forEach(c=>{ if(c.element) elemMap[c.element]=(elemMap[c.element]||0)+1 })
  const favElement = Object.entries(elemMap).sort((a,b)=>b[1]-a[1])[0]

  // Account prestige aura
  const totalRare = rarityCount.LR*4+rarityCount.UR*2+rarityCount.SR
  const prestige = totalRare>200?"legendary":totalRare>80?"epic":totalRare>20?"rare":"common"
  const PRESTIGE_COLORS: Record<string,string[]> = {
    legendary:["#ef4444","#fbbf24","#a855f7"],
    epic:["#38bdf8","#8b5cf6","#06b6d4"],
    rare:["#a855f7","#8b5cf6","#c084fc"],
    common:["#64748b","#94a3b8"],
  }
  const pc = PRESTIGE_COLORS[prestige]

  // Active master
  const [activeMasterName, setActiveMasterName] = useState<string|null>(null)
  const [activeMasterIcon, setActiveMasterIcon] = useState<string|null>(null)
  useEffect(() => {
    if (typeof window==="undefined") return
    try {
      const raw = localStorage.getItem("gpgame_masters_v1")
      if (raw) {
        const arr = JSON.parse(raw)
        const active = arr.find((m:any)=>m.isActive)
        if (active) {
          const names:Record<string,string> = {fehnon:"Fehnon Hoskie",morgana:"Morgana Pendragon",calem:"Calem Hidenori"}
          const icons:Record<string,string> = {fehnon:"/images/icons/fehnon-icon.png",morgana:"/images/icons/morgana-icon.png",calem:"/images/icons/calem-icon.png"}
          setActiveMasterName(names[active.id]||active.id)
          setActiveMasterIcon(icons[active.id]||null)
        }
      }
    } catch {}
  }, [])

  // Favourite card (highest rarity, first found)
  const favCard = collection.find(c=>c.rarity==="LR") || collection.find(c=>c.rarity==="UR") || collection.find(c=>c.rarity==="SR") || collection[0]

  // Achievements
  const achievements = [
    { id:"first-win",    name:"Primeira Vitória",      desc:"Vença sua primeira partida",     icon:"🏆", progress:Math.min(wins,1),     max:1,   done:wins>=1,          rarity:"common",  reward:"100 Moedas", secret:false },
    { id:"col10",        name:"Colecionador Iniciante", desc:"Colete 10 cartas únicas",        icon:"📚", progress:Math.min(uniqueCards,10), max:10, done:uniqueCards>=10, rarity:"common",  reward:"200 Moedas", secret:false },
    { id:"col50",        name:"Colecionador Veterano",  desc:"Colete 50 cartas únicas",        icon:"⭐", progress:Math.min(uniqueCards,50), max:50, done:uniqueCards>=50, rarity:"rare",    reward:"500 Moedas", secret:false },
    { id:"decks3",       name:"Mestre dos Decks",       desc:"Crie 3 decks diferentes",        icon:"🛡", progress:Math.min(decks.length,3), max:3, done:decks.length>=3,  rarity:"common",  reward:"300 Moedas", secret:false },
    { id:"lr-hunter",   name:"Caçador de Lendas",      desc:"Obtenha uma carta LR",           icon:"👑", progress:Math.min(rarityCount.LR,1),max:1,done:rarityCount.LR>=1,rarity:"legendary",reward:"1000 Moedas",secret:false },
    { id:"win10",        name:"Guerreiro",               desc:"Vença 10 partidas",              icon:"⚔", progress:Math.min(wins,10),    max:10,  done:wins>=10,         rarity:"rare",    reward:"400 Moedas", secret:false },
    { id:"secret1",      name:"???",                    desc:"Conquista secreta",              icon:"🔒", progress:0,                    max:1,   done:false,            rarity:"legendary",reward:"???",        secret:true },
    { id:"secret2",      name:"???",                    desc:"Conquista secreta",              icon:"🔒", progress:0,                    max:1,   done:false,            rarity:"rare",    reward:"???",        secret:true },
  ]

  const RARITY_ACHIEV: Record<string,{color:string;label:string;bg:string}> = {
    legendary:{ color:"#fbbf24", label:"Lendária", bg:"rgba(251,191,36,0.15)" },
    rare:     { color:"#a855f7", label:"Rara",     bg:"rgba(168,85,247,0.12)" },
    common:   { color:"#64748b", label:"Comum",    bg:"rgba(255,255,255,0.05)" },
  }

  const handleSave = () => { updatePlayerProfile({name:editName,title:editTitle}); setIsEditing(false) }
  const handleIcon = (icon:string) => { updatePlayerProfile({avatarUrl:icon}); setShowIconSel(false) }
  const handleCopy = () => { navigator.clipboard.writeText(playerId); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  // 3D tilt for cards
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientY-rect.top)/rect.height-.5)*14
    const y = -((e.clientX-rect.left)/rect.width-.5)*14
    setCardTilt({x,y})
  }

  return (
    <div style={{minHeight:"100vh",background:"#05000f",color:"#f1f0ee",fontFamily:"'Segoe UI',system-ui,sans-serif",position:"relative",overflow:"hidden"}}>

      {/* ── Dynamic tab background ── */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,transition:"background 0.6s ease"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 100% 80% at 50% -20%,rgba(10,5,30,0.95),transparent 60%)"}}/>
        <div style={{position:"absolute",inset:0,background:TAB_BG[activeTab],transition:"background 0.6s ease"}}/>
        {/* Grid */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(139,92,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.04) 1px,transparent 1px)",backgroundSize:"48px 48px",opacity:0.5}}/>
      </div>

      {/* ── Header ── */}
      <div style={{position:"sticky",top:0,zIndex:50,backdropFilter:"blur(20px)",background:"rgba(5,0,15,0.85)",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",padding:"12px 16px",gap:12}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,width:38,height:38,cursor:"pointer",color:"#94a3b8",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <ArrowLeft size={18}/>
        </button>
        <span style={{fontWeight:900,fontSize:18,background:"linear-gradient(135deg,#f1f0ee,#c4b5fd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",letterSpacing:"0.04em"}}>PERFIL</span>
        {/* Online status */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto",background:"rgba(34,197,94,0.10)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:20,padding:"4px 12px"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e",animation:"onlinePulse 2s ease-in-out infinite"}}/>
          <span style={{fontSize:11,fontWeight:700,color:"#22c55e"}}>Online</span>
        </div>
      </div>

      <div style={{position:"relative",zIndex:1,maxWidth:900,margin:"0 auto",padding:"0 0 100px"}}>

        {/* ══════════ HERO SECTION ══════════ */}
        <div style={{position:"relative",marginBottom:0}}>

          {/* Banner */}
          <div style={{position:"relative",height:180,overflow:"hidden"}}>
            {/* Animated gradient banner */}
            <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${pc[0]}25,${pc[1]||pc[0]}15,${pc[2]||pc[0]}20)`,backgroundSize:"200% 200%",animation:"bannerShift 6s ease-in-out infinite"}}/>
            <div style={{position:"absolute",inset:0,background:"url('/images/the_great_order_wallpaper.png') center/cover",opacity:0.15,mixBlendMode:"screen"}}/>
            {/* Prestige aura at top */}
            {prestige==="legendary"&&<div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,#ef444410,#fbbf2410,#a855f710,#ef444410)",backgroundSize:"400% 100%",animation:"bannerShift 3s linear infinite"}}/>}
            {/* Master art in background */}
            {activeMasterIcon && (
              <div style={{position:"absolute",right:0,top:0,height:"100%",width:"50%",opacity:0.15,overflow:"hidden"}}>
                <Image src={activeMasterIcon} alt="" fill style={{objectFit:"contain",objectPosition:"right center",filter:"blur(1px)"}}/>
              </div>
            )}
            {/* Prestige badge */}
            <div style={{position:"absolute",top:12,right:16,background:`linear-gradient(135deg,${pc[0]}30,${pc[1]||pc[0]}20)`,border:`1px solid ${pc[0]}50`,borderRadius:20,padding:"4px 12px",backdropFilter:"blur(8px)"}}>
              <span style={{fontSize:10,fontWeight:900,color:pc[0],letterSpacing:"0.10em",textTransform:"uppercase"}}>
                {prestige==="legendary"?"⚜ Lendário":prestige==="epic"?"✦ Épico":prestige==="rare"?"◈ Raro":"● Comum"}
              </span>
            </div>
            {/* Gradient overlay bottom */}
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:"80%",background:"linear-gradient(transparent,#05000f)"}}/>
          </div>

          {/* Avatar + info — overlaps banner */}
          <div style={{position:"relative",marginTop:-70,padding:"0 20px 0"}}>
            <div style={{display:"flex",alignItems:"flex-end",gap:20}}>

              {/* Avatar with holographic ring */}
              <div style={{position:"relative",flexShrink:0}} onClick={()=>!isEditing&&setShowIconSel(true)}>
                <div style={{
                  position:"absolute",inset:-4,borderRadius:"50%",
                  background:`conic-gradient(${pc.join(",")},${pc[0]})`,
                  animation:"rotateSpin 3s linear infinite",
                  filter:`blur(2px) drop-shadow(0 0 12px ${pc[0]})`,
                }}/>
                <div style={{position:"relative",width:96,height:96,borderRadius:"50%",overflow:"hidden",border:"3px solid rgba(5,0,15,1)",cursor:"pointer"}}>
                  {playerProfile.avatarUrl
                    ? <Image src={playerProfile.avatarUrl} alt="" fill style={{objectFit:"cover"}}/>
                    : <div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${pc[0]},${pc[1]||pc[0]})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:900,color:"#fff"}}>{playerProfile.name.charAt(0).toUpperCase()}</div>
                  }
                </div>
                {/* Lv badge */}
                <div style={{position:"absolute",bottom:-4,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#7c3aed,#a855f7)",borderRadius:99,padding:"1px 8px",border:"2px solid #05000f",whiteSpace:"nowrap"}}>
                  <span style={{fontSize:9,fontWeight:900,color:"#fff"}}>Lv.{playerProfile.level||1}</span>
                </div>
              </div>

              {/* Name / title / id */}
              <div style={{flex:1,paddingBottom:8,minWidth:0}}>
                {isEditing ? (
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <input value={editName} onChange={e=>setEditName(e.target.value)} maxLength={20}
                      style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(139,92,246,0.40)",borderRadius:8,padding:"7px 12px",color:"#f1f0ee",fontSize:15,fontWeight:800,outline:"none"}}/>
                    <select value={editTitle} onChange={e=>setEditTitle(e.target.value)}
                      style={{background:"rgba(10,5,30,0.95)",border:"1px solid rgba(139,92,246,0.30)",borderRadius:8,padding:"6px 10px",color:"#c4b5fd",fontSize:12}}>
                      {playerTitles.map(tt=><option key={tt} value={tt}>{tt}</option>)}
                    </select>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={handleSave} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#065f46,#059669)",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>✓ Salvar</button>
                      <button onClick={()=>setIsEditing(false)} style={{flex:1,padding:"7px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.10)",color:"#6b7280",fontWeight:700,fontSize:12,cursor:"pointer"}}>✕</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                      <h2 style={{fontWeight:900,fontSize:22,margin:0,background:`linear-gradient(135deg,#f1f0ee,${pc[0]})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{playerProfile.name}</h2>
                      <button onClick={()=>setIsEditing(true)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:7,padding:"4px 8px",cursor:"pointer",color:"#6b7280",fontSize:13}}>✎</button>
                    </div>
                    {/* Title badge */}
                    {playerProfile.title&&(
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:`linear-gradient(135deg,${pc[0]}20,${pc[1]||pc[0]}10)`,border:`1px solid ${pc[0]}40`,borderRadius:20,padding:"3px 12px",marginBottom:8}}>
                        <span style={{fontSize:12,fontWeight:800,color:pc[0]}}>{playerProfile.title}</span>
                      </div>
                    )}
                    {/* ID row */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,color:"#374151",fontFamily:"monospace"}}>ID: {playerId?.slice(0,12)}...</span>
                      <button onClick={handleCopy} style={{background:"none",border:"none",cursor:"pointer",color:copied?"#22c55e":"#4b5563",fontSize:11,fontWeight:600,padding:0}}>
                        {copied?"✓ Copiado":"⎘ Copiar"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Active master pill */}
              {activeMasterName&&(
                <div style={{flexShrink:0,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"8px 12px",textAlign:"center",minWidth:90}}>
                  {activeMasterIcon&&(
                    <div style={{width:36,height:36,borderRadius:"50%",overflow:"hidden",border:`2px solid ${pc[0]}60`,margin:"0 auto 4px"}}>
                      <Image src={activeMasterIcon} alt="" width={36} height={36} style={{objectFit:"cover"}}/>
                    </div>
                  )}
                  <div style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em"}}>Mestre</div>
                  <div style={{fontSize:11,fontWeight:800,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{activeMasterName.split(" ")[0]}</div>
                </div>
              )}
            </div>

            {/* Quick-stats row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:16}}>
              {[
                {icon:"⚔",val:totalMatches,lbl:"Partidas"},
                {icon:"🏆",val:wins,lbl:"Vitórias"},
                {icon:"📚",val:uniqueCards,lbl:"Cartas"},
                {icon:"🪙",val:coins,lbl:"Moedas"},
              ].map(s=>(
                <div key={s.lbl} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <div style={{fontSize:16,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontWeight:900,fontSize:16,color:"#f1f0ee"}}>{s.val.toLocaleString()}</div>
                  <div style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Favourite card signature */}
            {favCard&&(
              <div style={{marginTop:14,display:"flex",alignItems:"center",gap:14,background:rarityBg(favCard.rarity),border:rarityBorder(favCard.rarity),borderRadius:14,padding:"12px 16px"}}>
                <div style={{position:"relative",width:52,height:72,flexShrink:0,borderRadius:6,overflow:"hidden",boxShadow:rarityGlow(favCard.rarity)}}>
                  <Image src={favCard.image||"/placeholder.svg"} alt={favCard.name} fill style={{objectFit:"cover"}}/>
                  {/* Holographic sheen */}
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,transparent 35%,rgba(255,255,255,0.18) 50%,transparent 65%)",animation:"holoSheen 2.5s ease-in-out infinite"}}/>
                  {favCard.rarity==="LR"&&<div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,#ef444420,#fbbf2420,#a855f720,#ef444420)",backgroundSize:"300% 100%",animation:"rainbowShift 1.5s linear infinite"}}/>}
                </div>
                <div>
                  <div style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.10em",marginBottom:4}}>🃏 Carta Favorita</div>
                  <div style={{fontWeight:900,fontSize:14,color:"#f1f0ee",marginBottom:3}}>{favCard.name}</div>
                  <div style={{display:"flex",gap:6}}>
                    <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,background:rarityBg(favCard.rarity),color:favCard.rarity==="LR"?"#ef4444":favCard.rarity==="UR"?"#38bdf8":favCard.rarity==="SR"?"#a855f7":"#94a3b8"}}>{favCard.rarity}</span>
                    {favCard.element&&<span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:4,color:ELEMENT_COLORS[favCard.element]||"#94a3b8",background:`${ELEMENT_COLORS[favCard.element]||"#94a3b8"}15`}}>{favCard.element}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Icon selector */}
        {showIconSel&&(
          <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"linear-gradient(160deg,#100c08,#0e0b18)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:20,padding:20,maxWidth:400,width:"100%"}}>
              <div style={{fontWeight:900,fontSize:15,color:"#f1f0ee",marginBottom:14}}>Escolher Avatar</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
                {PROFILE_ICONS.map((icon:string)=>(
                  <button key={icon} onClick={()=>handleIcon(icon)}
                    style={{aspectRatio:"1",borderRadius:12,overflow:"hidden",border:playerProfile.avatarUrl===icon?"2px solid #e8c96d":"2px solid rgba(255,255,255,0.07)",cursor:"pointer",padding:0,background:"rgba(255,255,255,0.04)"}}>
                    <Image src={icon} alt="" width={60} height={60} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  </button>
                ))}
              </div>
              <button onClick={()=>setShowIconSel(false)} style={{marginTop:14,width:"100%",padding:"10px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#6b7280",fontWeight:700,fontSize:13,cursor:"pointer"}}>Fechar</button>
            </div>
          </div>
        )}

        {/* ══════════ TABS ══════════ */}
        <div style={{display:"flex",margin:"20px 20px 0",borderRadius:14,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
          {(["stats","achievements","collection"] as const).map(tab=>{
            const icons={"stats":"📊","achievements":"🏆","collection":"🃏"}
            const labels={"stats":"Estatísticas","achievements":"Conquistas","collection":"Coleção"}
            const active=activeTab===tab
            const colors={"stats":"#38bdf8","achievements":"#fbbf24","collection":"#a855f7"}
            return (
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{
                flex:1,padding:"12px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                background:active?`${colors[tab]}12`:"transparent",
                borderBottom:`2px solid ${active?colors[tab]:"transparent"}`,
                border:"none",cursor:"pointer",transition:"all .2s",
                borderRight:tab!=="collection"?"1px solid rgba(255,255,255,0.05)":"none",
              }}>
                <span style={{fontSize:16}}>{icons[tab]}</span>
                <span style={{fontSize:10,fontWeight:700,color:active?colors[tab]:"#4b5563",letterSpacing:"0.04em"}}>{labels[tab]}</span>
              </button>
            )
          })}
        </div>

        {/* ══════════ STATS TAB ══════════ */}
        {activeTab==="stats"&&(
          <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>

            {/* Win rate ring + breakdown */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(56,189,248,0.15)",borderRadius:16,padding:"18px",textAlign:"center",position:"relative"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Taxa de Vitória</div>
                <div style={{position:"relative",display:"inline-block"}}>
                  <WinRing rate={winRate}/>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",transform:"rotate(90deg)"}}>
                    <span style={{fontWeight:900,fontSize:22,color:"#f1f0ee"}}>{winRate}%</span>
                    <span style={{fontSize:9,color:"#4b5563"}}>{wins}V/{totalMatches-wins}D</span>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {/* Rarity breakdown */}
                {(["LR","UR","SR","R"] as const).map(r=>{
                  const col=r==="LR"?"#ef4444":r==="UR"?"#38bdf8":r==="SR"?"#a855f7":"#94a3b8"
                  const pct=uniqueCards>0?Math.min(100,(rarityCount[r]/uniqueCards)*100):0
                  return(
                    <div key={r} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"8px 12px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:11,fontWeight:800,color:col}}>{r}</span>
                        <span style={{fontSize:11,color:"#6b7280"}}>{rarityCount[r]}</span>
                      </div>
                      <div style={{height:4,borderRadius:99,background:"rgba(255,255,255,0.06)"}}>
                        <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:`linear-gradient(90deg,${col}80,${col})`,boxShadow:`0 0 6px ${col}60`,transition:"width .8s ease"}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Favourite element + deck */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"14px"}}>
                <div style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>⚡ Elemento Favorito</div>
                {favElement?(
                  <>
                    <div style={{fontWeight:900,fontSize:18,color:ELEMENT_COLORS[favElement[0]]||"#94a3b8",marginBottom:2}}>{favElement[0]}</div>
                    <div style={{fontSize:11,color:"#4b5563"}}>{favElement[1]} cartas</div>
                  </>
                ):<div style={{color:"#374151",fontSize:12}}>Sem dados</div>}
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"14px"}}>
                <div style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>🃏 Decks Criados</div>
                <div style={{fontWeight:900,fontSize:18,color:"#f1f0ee",marginBottom:2}}>{decks.length}</div>
                <div style={{fontSize:11,color:"#4b5563"}}>{decks[0]?.name||"Nenhum deck"}</div>
              </div>
            </div>

            {/* Resources */}
            <div style={{background:"rgba(232,201,109,0.05)",border:"1px solid rgba(232,201,109,0.15)",borderRadius:14,padding:"14px 16px"}}>
              <div style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>💰 Recursos</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>🪙</span>
                  <div>
                    <div style={{fontWeight:900,fontSize:16,color:"#e8c96d"}}>{coins.toLocaleString()}</div>
                    <div style={{fontSize:10,color:"#4b5563"}}>Moedas</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>⭐</span>
                  <div>
                    <div style={{fontWeight:900,fontSize:16,color:"#c4b5fd"}}>{friendPoints||0}</div>
                    <div style={{fontSize:10,color:"#4b5563"}}>Pts Amizade</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ACHIEVEMENTS TAB ══════════ */}
        {activeTab==="achievements"&&(
          <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:12,color:"#4b5563"}}>{achievements.filter(a=>a.done).length}/{achievements.length} completas</span>
              <div style={{height:5,flex:1,margin:"0 12px",borderRadius:99,background:"rgba(255,255,255,0.06)"}}>
                <div style={{height:"100%",borderRadius:99,width:`${(achievements.filter(a=>a.done).length/achievements.length)*100}%`,background:"linear-gradient(90deg,#7c3aed,#e8c96d)",transition:"width .8s ease"}}/>
              </div>
            </div>
            {achievements.map(a=>{
              const ra=RARITY_ACHIEV[a.rarity]
              const pct=a.max>0?(a.progress/a.max)*100:0
              return(
                <div key={a.id} style={{position:"relative",background:a.done?ra.bg:"rgba(255,255,255,0.02)",border:`1px solid ${a.done?ra.color+"40":"rgba(255,255,255,0.06)"}`,borderRadius:14,padding:"14px 16px",overflow:"hidden",transition:"all .2s"}}>
                  {/* Particle effect for completed */}
                  {a.done&&<AchievementParticles active={true}/>}
                  {/* Completed glow */}
                  {a.done&&<div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 0% 50%,${ra.color}15,transparent 60%)`,pointerEvents:"none"}}/>}
                  <div style={{position:"relative",display:"flex",alignItems:"center",gap:12}}>
                    <div style={{
                      width:44,height:44,borderRadius:12,flexShrink:0,
                      background:a.done?`linear-gradient(135deg,${ra.color}25,${ra.color}10)`:"rgba(255,255,255,0.04)",
                      border:`1px solid ${a.done?ra.color+"50":"rgba(255,255,255,0.07)"}`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
                      boxShadow:a.done?`0 0 16px ${ra.color}40`:"none",
                    }}>{a.secret&&!a.done?"🔒":a.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                        <span style={{fontWeight:800,fontSize:13,color:a.done?"#f1f0ee":"#6b7280"}}>{a.secret&&!a.done?"???":a.name}</span>
                        <span style={{fontSize:8,fontWeight:800,padding:"1px 6px",borderRadius:4,color:ra.color,background:ra.bg}}>{ra.label}</span>
                        {a.done&&<span style={{fontSize:10,color:"#22c55e"}}>✓</span>}
                      </div>
                      <div style={{fontSize:11,color:"#4b5563",marginBottom:a.max>1?6:0}}>{a.secret&&!a.done?"Complete desafios secretos para descobrir...":a.desc}</div>
                      {a.max>1&&!a.secret&&(
                        <div>
                          <div style={{height:4,borderRadius:99,background:"rgba(255,255,255,0.06)"}}>
                            <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:a.done?`linear-gradient(90deg,${ra.color}80,${ra.color})`:
                              "linear-gradient(90deg,#38bdf880,#38bdf8)",transition:"width .8s ease"}}/>
                          </div>
                          <div style={{fontSize:9,color:"#4b5563",marginTop:2}}>{a.progress}/{a.max}</div>
                        </div>
                      )}
                    </div>
                    <div style={{flexShrink:0,fontSize:10,color:"#e8c96d",fontWeight:700,textAlign:"right"}}>
                      {a.done&&!a.secret?a.reward:""}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════ COLLECTION TAB ══════════ */}
        {activeTab==="collection"&&(
          <div style={{padding:"16px 20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontSize:13,color:"#4b5563"}}>{uniqueCards} cartas únicas</span>
              <div style={{display:"flex",gap:6}}>
                {(["LR","UR","SR","R"] as const).map(r=>{
                  const col=r==="LR"?"#ef4444":r==="UR"?"#38bdf8":r==="SR"?"#a855f7":"#94a3b8"
                  return <span key={r} style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,color:col,background:`${col}15`}}>{r}: {rarityCount[r]}</span>
                })}
              </div>
            </div>

            {/* Rarity sections */}
            {(["LR","UR","SR","R"] as const).map(rarity=>{
              const cards = collection.filter(c=>c.rarity===rarity)
              if (!cards.length) return null
              const rc = rarity==="LR"?"#ef4444":rarity==="UR"?"#38bdf8":rarity==="SR"?"#a855f7":"#94a3b8"
              return(
                <div key={rarity} style={{marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{height:1,flex:1,background:`linear-gradient(to right,${rc}40,transparent)`}}/>
                    <span style={{fontSize:11,fontWeight:800,color:rc,textTransform:"uppercase",letterSpacing:"0.10em"}}>{rarity}</span>
                    <span style={{fontSize:9,color:"#4b5563"}}>{cards.length}</span>
                    <div style={{height:1,flex:1,background:`linear-gradient(to left,${rc}40,transparent)`}}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                    {cards.slice(0,16).map((card,i)=>(
                      <div key={`${card.id}-${i}`}
                        onMouseMove={e=>{setHoveredCard(card.id+i);handleCardMouseMove(e)}}
                        onMouseLeave={()=>{setHoveredCard(null);setCardTilt({x:0,y:0})}}
                        onClick={()=>setZoomedCard(card)}
                        style={{
                          position:"relative",aspectRatio:"3/4",borderRadius:8,overflow:"hidden",cursor:"pointer",
                          border:rarityBorder(rarity),
                          boxShadow:hoveredCard===card.id+i?rarityGlow(rarity):"none",
                          transform:hoveredCard===card.id+i?`perspective(600px) rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg) scale(1.08)`:"scale(1)",
                          transition:"transform .15s ease,box-shadow .15s ease",
                        }}>
                        <Image src={card.image||"/placeholder.svg"} alt={card.name} fill style={{objectFit:"cover"}}/>
                        {/* Holographic overlay on hover */}
                        {hoveredCard===card.id+i&&(
                          <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,transparent 35%,rgba(255,255,255,0.20) 50%,transparent 65%)",pointerEvents:"none"}}/>
                        )}
                        {/* Rarity border effect */}
                        {rarity==="LR"&&<div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,#ef444420,#fbbf2420,#a855f720,#ef444420)",backgroundSize:"300% 100%",animation:"rainbowShift 1.5s linear infinite",pointerEvents:"none"}}/>}
                        {rarity==="UR"&&<div style={{position:"absolute",inset:0,boxShadow:"inset 0 0 12px rgba(56,189,248,0.25)",pointerEvents:"none",animation:"urPulse 2s ease-in-out infinite"}}/>}
                        {/* LR particles */}
                        {rarity==="LR"&&hoveredCard===card.id+i&&<LRParticles/>}
                      </div>
                    ))}
                  </div>
                  {cards.length>16&&<div style={{textAlign:"center",marginTop:8,fontSize:11,color:"#4b5563"}}>+{cards.length-16} cartas</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Card zoom */}
      {zoomedCard&&(
        <div onClick={()=>setZoomedCard(null)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:260,aspectRatio:"3/4",position:"relative",borderRadius:12,overflow:"hidden",boxShadow:rarityGlow(zoomedCard.rarity)}}>
            <Image src={zoomedCard.image||"/placeholder.svg"} alt={zoomedCard.name} fill style={{objectFit:"cover"}}/>
            {zoomedCard.rarity==="LR"&&<div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,#ef444420,#fbbf2420,#a855f720,#ef444420)",backgroundSize:"300% 100%",animation:"rainbowShift 1.5s linear infinite"}}/>}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html:`
        @keyframes onlinePulse{0%,100%{opacity:1;box-shadow:0 0 8px #22c55e}50%{opacity:0.6;box-shadow:0 0 16px #22c55e}}
        @keyframes rotateSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes bannerShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes holoSheen{0%,100%{background-position:200% 200%;opacity:0.5}50%{background-position:-100% -100%;opacity:1}}
        @keyframes rainbowShift{0%{background-position:0% 50%}100%{background-position:300% 50%}}
        @keyframes urPulse{0%,100%{box-shadow:inset 0 0 12px rgba(56,189,248,0.2)}50%{box-shadow:inset 0 0 22px rgba(56,189,248,0.5)}}
      `}}/>
    </div>
  )
}

// LR particle effect
function LRParticles() {
  const cols=["#ef4444","#fbbf24","#a855f7","#fff"]
  return(
    <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
      {[...Array(8)].map((_,i)=>(
        <div key={i} style={{
          position:"absolute",
          width:3,height:3,borderRadius:"50%",
          background:cols[i%cols.length],
          left:`${10+i*11}%`,
          animation:`lrFloat${i%3} ${1.2+i*0.2}s ease-in-out ${i*0.15}s infinite`,
          boxShadow:`0 0 6px ${cols[i%cols.length]}`,
        }}/>
      ))}
      <style dangerouslySetInnerHTML={{__html:`
        @keyframes lrFloat0{0%,100%{top:90%;opacity:0}50%{top:10%;opacity:1}}
        @keyframes lrFloat1{0%,100%{top:80%;opacity:0}60%{top:20%;opacity:0.8}}
        @keyframes lrFloat2{0%,100%{top:95%;opacity:0}40%{top:5%;opacity:1}}
      `}}/>
    </div>
  )
}
