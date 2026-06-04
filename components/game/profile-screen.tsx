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
  Ventus:"#4ade80", Lightness:"#fde68a", Lighness:"#fde68a", Subterra:"#fb923c", Haos:"#fde68a",
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

// Rename legacy element IDs for display
function displayElement(el: string): string {
  const map: Record<string,string> = { Darkus:"Darkness", Sombra:"Shadow", Vento:"Ventus", Haos:"Lighness" }
  return map[el] ?? el
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

// ─── Profile themes ──────────────────────────────────────────────────────────
const PROFILE_THEMES: Record<string,{label:string;colors:string[];emoji:string}> = {
  auto:     { label:"Auto (Prestígio)", colors:[],               emoji:"✨" },
  purple:   { label:"Roxo",             colors:["#7c3aed","#a855f7","#c084fc"],  emoji:"💜" },
  gold:     { label:"Dourado",          colors:["#b7791f","#e8c96d","#fde68a"],  emoji:"🌟" },
  red:      { label:"Vermelho",         colors:["#dc2626","#ef4444","#fca5a5"],  emoji:"❤️" },
  cyan:     { label:"Ciano",            colors:["#0891b2","#38bdf8","#7dd3fc"],  emoji:"💙" },
  green:    { label:"Verde",            colors:["#059669","#4ade80","#86efac"],  emoji:"💚" },
  rose:     { label:"Rosa",             colors:["#be185d","#f472b6","#fbcfe8"],  emoji:"🌸" },
  orange:   { label:"Laranja",          colors:["#c2410c","#fb923c","#fed7aa"],  emoji:"🔥" },
}

// ─── Performance bar chart ────────────────────────────────────────────────────
function PerformanceChart({ matches }: { matches: any[] }) {
  const last10 = [...matches]
    .filter((m:any) => !!m.result)
    .sort((a:any,b:any) => {
      const ta = a.date ? new Date(a.date).getTime() : a.id ? parseInt((a.id as string).replace("match-",""),10) : 0
      const tb = b.date ? new Date(b.date).getTime() : b.id ? parseInt((b.id as string).replace("match-",""),10) : 0
      return ta - tb  // oldest first for chart
    })
    .slice(-10)

  if (last10.length === 0) return (
    <div style={{textAlign:"center",color:"#374151",fontSize:12,padding:"20px 0"}}>Nenhuma partida registrada ainda</div>
  )

  const BAR_W = 28, GAP = 8, H = 80
  const totalW = last10.length * (BAR_W + GAP) - GAP

  // rolling win rate per match (cumulative)
  let wins = 0
  const rates = last10.map((m,i) => { if (m.result==="won") wins++; return Math.round((wins/(i+1))*100) })

  return (
    <div style={{overflowX:"auto"}}>
      <svg width={Math.max(totalW,200)} height={H+36} style={{display:"block",margin:"0 auto"}}>
        {/* Grid lines */}
        {[0,25,50,75,100].map(pct => {
          const y = H - (pct/100)*H
          return <line key={pct} x1={0} y1={y} x2={totalW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>
        })}

        {/* Bars */}
        {last10.map((m,i) => {
          const won = m.result === "won"
          const x = i*(BAR_W+GAP)
          const barH = won ? H * 0.75 : H * 0.35
          const y = H - barH
          const col  = won ? "#4ade80" : "#f87171"
          const glow = won ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"
          return (
            <g key={i}>
              <rect x={x} y={y} width={BAR_W} height={barH}
                fill={`url(#barGrad${i})`} rx={4}
                style={{filter:`drop-shadow(0 0 4px ${glow})`}}/>
              <defs>
                <linearGradient id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={col} stopOpacity={0.9}/>
                  <stop offset="100%" stopColor={col} stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              {/* W/L label */}
              <text x={x+BAR_W/2} y={H+14} textAnchor="middle" fontSize={10} fontWeight={800} fill={col}>{won?"V":"D"}</text>
              {/* Match number */}
              <text x={x+BAR_W/2} y={H+26} textAnchor="middle" fontSize={8} fill="#374151">{i+1}</text>
            </g>
          )
        })}

        {/* Trend line (rolling win rate) */}
        {rates.length > 1 && (
          <polyline
            points={rates.map((r,i) => {
              const x = i*(BAR_W+GAP) + BAR_W/2
              const y = H - (r/100)*H
              return `${x},${y}`
            }).join(" ")}
            fill="none" stroke="#e8c96d" strokeWidth={1.5} strokeDasharray="4 2"
            opacity={0.6}
          />
        )}
      </svg>
      <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:4}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:10,height:10,borderRadius:2,background:"#4ade80"}}/>
          <span style={{fontSize:9,color:"#4b5563"}}>Vitória</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:10,height:10,borderRadius:2,background:"#f87171"}}/>
          <span style={{fontSize:9,color:"#4b5563"}}>Derrota</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:18,height:2,borderRadius:1,background:"#e8c96d",opacity:0.6}}/>
          <span style={{fontSize:9,color:"#4b5563"}}>Win rate</span>
        </div>
      </div>
    </div>
  )
}

// Animated win-rate ring
function WinRing({ rate }: { rate: number }) {
  const r=34, stroke=6, circ=2*Math.PI*r
  const dash = circ*(rate/100)
  const color = rate>=60?"#4ade80":rate>=40?"#fbbf24":"#f87171"
  return (
    <svg width={84} height={84}>
      {/* Background track */}
      <circle cx={42} cy={42} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}/>
      {/* Empty-state: dashed ring when 0% */}
      {rate===0&&<circle cx={42} cy={42} r={r} fill="none" stroke="rgba(255,255,255,0.12)"
        strokeWidth={stroke} strokeDasharray="6 6" transform="rotate(-90 42 42)"/>}
      {/* Progress arc */}
      {rate>0&&<circle cx={42} cy={42} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 42 42)"
        style={{transition:"stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)",filter:`drop-shadow(0 0 6px ${color})`}}/>}
    </svg>
  )
}

// ─── Bio Profanity Filter ─────────────────────────────────────────────────────
// Base roots — suffixes (diminutives, augmentatives, etc.) are stripped
// automatically, so "cuzinho", "fodinha", "pintudão" are all caught.
const BIO_BAD_ROOTS = [
  // PT-BR — raízes
  "porra","caralh","cuzao","cuzão","arrombad","burr",
  "cu","cú",
  "pint","penis","pênis","rola","pau",
  "xoxot","xerec","bucet","pepec",
  "viado","viadao","viadão",
  "puta","put","piranha","prostitu",
  "foder","foda","fud","fuder","fudend",
  "fdp","filhadaputa","filhode","vsf",
  "merd","bost","cocô","escrot",
  "safad","vagabund",
  "punhet","gozar","gozo","tesão","tesao",
  "sacanaг","sacanag","tarad","pervertid",
  "trepand","trepar","sexo oral","anal",
  "corno","corna","broquel",
  "imbecil","idiota","retardad",
  // EN fallback roots
  "fuck","shit","ass","bitch","cunt","dick","cock",
  "pussy","nigga","faggot","whore","bastard",
]

// Suffixes to strip before root-matching (PT diminutives/augmentatives/etc.)
const PT_SUFFIXES = [
  "zinhozinho","zinhaozinha","zinhao",
  "zinhaz","zinhao",
  "zozinho","zozinha",
  "zinho","zinha","zão","zao","zona",
  "inho","inha","ões","oes",
  "udo","uda","udão","udao","udinho","udinha",
  "ão","ao","ona","ona",
  "eiro","eira","ista",
  "ada","ado","ados","adas",
  "ando","endo","indo",
  "iss","iss",
  "s",
]

// Normalise leetspeak: 4→a, 3→e, 1→i, 0→o, 5→s, @→a, $→s
function normaliseLeet(s: string): string {
  return s.toLowerCase()
    .replace(/4/g,"a").replace(/3/g,"e").replace(/1/g,"i")
    .replace(/0/g,"o").replace(/5/g,"s").replace(/@/g,"a")
    .replace(/\$/g,"s").replace(/\+/g,"t").replace(/!/g,"i")
    .replace(/\*/g,"").replace(/\./g,"").replace(/_/g,"")
    .replace(/-/g,"").replace(/\s+/g," ").trim()
}

// Strip one suffix from the end of a word (longest match first)
function stripSuffix(word: string): string {
  for (const sfx of PT_SUFFIXES) {
    if (word.length > sfx.length + 2 && word.endsWith(sfx)) {
      return word.slice(0, word.length - sfx.length)
    }
  }
  return word
}

// Check word against all roots, with and without suffix stripping
function matchesRoot(word: string): boolean {
  const candidates = [word, stripSuffix(word), stripSuffix(stripSuffix(word))]
  for (const c of candidates) {
    for (const root of BIO_BAD_ROOTS) {
      const nr = normaliseLeet(root)
      if (c === nr || c.startsWith(nr)) return true
    }
  }
  return false
}

function bioHasProfanity(text: string): boolean {
  const norm = normaliseLeet(text)
  // Check the full normalised string for any root
  for (const root of BIO_BAD_ROOTS) {
    if (norm.replace(/\s/g,"").includes(normaliseLeet(root))) return true
  }
  // Also check each individual word with suffix stripping
  const words = norm.split(/\s+/)
  return words.some(matchesRoot)
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { t } = useLanguage()
  const { playerProfile, updatePlayerProfile, collection, decks, matchHistory, coins, setCoins, friendPoints, playerId } = useGame()

  const [isEditing,       setIsEditing]       = useState(false)
  const [editName,        setEditName]         = useState(playerProfile.name)
  const [editTitle,       setEditTitle]        = useState(playerProfile.title)
  const [editBio,         setEditBio]          = useState("")
  const [bio,             setBio]              = useState("")
  const [bioError,        setBioError]         = useState<string|null>(null)
  const [showIconSel,     setShowIconSel]      = useState(false)
  const [showShare,       setShowShare]        = useState(false)
  const [shareCopied,     setShareCopied]      = useState(false)
  const [showThemeSel,    setShowThemeSel]     = useState(false)
  const [profileTheme,    setProfileTheme]     = useState("auto")
  const [showcaseIds,     setShowcaseIds]      = useState<(string|null)[]>([null,null,null])
  const [showShowcasePick,setShowShowcasePick] = useState<number|null>(null)
  const [activeTab,       setActiveTab]        = useState<"stats"|"achievements"|"collection">("stats")
  const [copied,          setCopied]           = useState(false)
  const [playerTitles,    setPlayerTitles]     = useState<string[]>(BASE_PLAYER_TITLES)
  const [hoveredCard,     setHoveredCard]      = useState<string|null>(null)
  const [cardTilt,        setCardTilt]         = useState({x:0,y:0})
  const [zoomedCard,      setZoomedCard]       = useState<any|null>(null)
  const [claimedAchievements, setClaimedAchievements] = useState<Set<string>>(new Set())
  const [claimToast,          setClaimToast]          = useState<string|null>(null)
  const [collectionSearch,    setCollectionSearch]     = useState("")
  const [collectionElemFilter,setCollectionElemFilter] = useState<string|null>(null)
  const [expandedRarities,    setExpandedRarities]     = useState<Set<string>>(new Set())

  useEffect(() => {
    setPlayerTitles(getPlayerTitles())
    const h = () => setPlayerTitles(getPlayerTitles())
    window.addEventListener("gpgame_title_unlocked", h)
    return () => window.removeEventListener("gpgame_title_unlocked", h)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem("gpgame_claimed_achievements") ?? "[]"
      setClaimedAchievements(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem("gpgame_profile_bio") ?? ""
    setBio(saved)
    setEditBio(saved)
    const theme = localStorage.getItem("gpgame_profile_theme") ?? "auto"
    setProfileTheme(theme)
    try {
      const sc = JSON.parse(localStorage.getItem("gpgame_showcase") ?? "[]")
      if (Array.isArray(sc)) setShowcaseIds([sc[0]??null, sc[1]??null, sc[2]??null])
    } catch {}
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
  const pc = profileTheme !== "auto" && PROFILE_THEMES[profileTheme]?.colors.length
    ? PROFILE_THEMES[profileTheme].colors
    : PRESTIGE_COLORS[prestige]

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
          setActiveMasterName(names[active.id]||active.id)
          // Prefer the iconPath stored in master data; fall back to /images/masters/
          const iconPath: string = active.iconPath || `/images/masters/${active.id}-icon.png`
          setActiveMasterIcon(iconPath)
        }
      }
    } catch {}
  }, [])

  // Favourite card (highest rarity, first found)
  const favCard = collection.find(c=>c.rarity==="LR") || collection.find(c=>c.rarity==="UR") || collection.find(c=>c.rarity==="SR") || collection[0]

  // Win streak — inline (no useState) so it recalculates every render.
  // Sort by date DESC so the result is correct regardless of how the context
  // stores the array (newest-first or oldest-first, mutated or replaced).
  const winStreak = (() => {
    const sorted = [...matchHistory]
      .filter((m: any) => !!m.result)
      .sort((a: any, b: any) => {
        const ta = a.date
          ? new Date(a.date).getTime()
          : a.id ? parseInt((a.id as string).replace("match-", ""), 10) : 0
        const tb = b.date
          ? new Date(b.date).getTime()
          : b.id ? parseInt((b.id as string).replace("match-", ""), 10) : 0
        return tb - ta  // newest first
      })
    let s = 0
    for (const m of sorted) {
      if (m.result === "won") s++
      else break
    }
    return s
  })()

  // XP system: 100 XP per win, 30 per loss → level up every 500 XP
  const xpPerLevel  = 500
  const totalXP     = wins * 100 + (totalMatches - wins) * 30
  const currentLevel = Math.max(1, Math.floor(totalXP / xpPerLevel) + 1)
  const levelXP     = totalXP % xpPerLevel
  const xpPct       = Math.round((levelXP / xpPerLevel) * 100)

  // Sync computed level back to playerProfile whenever it rises
  useEffect(() => {
    if (currentLevel > (playerProfile.level || 1)) {
      updatePlayerProfile({ level: currentLevel })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel])

  // Recent matches (last 5, newest first)
  const recentMatches = [...matchHistory].reverse().slice(0, 5)

  // Master bond (approximated by total matches until per-master tracking is added)
  const masterBondPct = Math.min(100, (totalMatches % 20) / 20 * 100)
  const masterBondLv  = Math.floor(totalMatches / 20) + 1

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

  const handleSave = () => {
    const trimmed = editBio.slice(0,80)
    if (bioHasProfanity(trimmed)) {
      setBioError("Bio contém linguagem inapropriada. Por favor, revise o texto.")
      return
    }
    updatePlayerProfile({name:editName,title:editTitle})
    setBio(trimmed)
    setBioError(null)
    try { localStorage.setItem("gpgame_profile_bio", trimmed) } catch {}
    setIsEditing(false)
  }
  const handleIcon = (icon:string) => { updatePlayerProfile({avatarUrl:icon}); setShowIconSel(false) }
  const handleCopy = () => { navigator.clipboard.writeText(playerId); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  const handleCopyStats = () => {
    const txt = [
      `🎮 ${playerProfile.name} — GP Card Game`,
      `🏆 Nível ${currentLevel} | ${prestige.charAt(0).toUpperCase()+prestige.slice(1)}`,
      `⚔ ${wins}V / ${totalMatches-wins}D (${winRate}% win rate)`,
      `📚 ${uniqueCards} cartas únicas | LR: ${rarityCount.LR} | UR: ${rarityCount.UR}`,
      `💰 ${coins.toLocaleString()} moedas`,
      favElement?`⚡ Elemento favorito: ${displayElement(favElement[0])}`:"",
      winStreak>=2?`🔥 Streak: ${winStreak} vitórias seguidas`:"",
      `🆔 ID: ${playerId}`,
    ].filter(Boolean).join("\n")
    navigator.clipboard.writeText(txt)
    setShareCopied(true)
    setTimeout(()=>setShareCopied(false), 2500)
  }

  const handleClaimAchievement = (id: string, reward: string) => {
    // Parse coin amount from strings like "100 Moedas"
    const match = reward.match(/(\d[\d.]*)\s*Moedas?/i)
    const amount = match ? parseInt(match[1].replace(/\./g,""), 10) : 0
    if (amount > 0) {
      const newTotal = coins + amount
      if (typeof setCoins === "function") setCoins(newTotal)
      try { localStorage.setItem("gearperks-coins", String(newTotal)) } catch {}
      // Toast notification
      setClaimToast(`+${amount.toLocaleString()} Moedas`)
      setTimeout(() => setClaimToast(null), 2800)
    }
    setClaimedAchievements(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem("gpgame_claimed_achievements", JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  const handleTheme = (t: string) => {
    setProfileTheme(t)
    try { localStorage.setItem("gpgame_profile_theme", t) } catch {}
    setShowThemeSel(false)
  }

  const handleShowcasePick = (slot: number, cardId: string | null) => {
    setShowcaseIds(prev => {
      const next = [...prev]
      next[slot] = cardId
      try { localStorage.setItem("gpgame_showcase", JSON.stringify(next)) } catch {}
      return next
    })
    setShowShowcasePick(null)
  }
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientY-rect.top)/rect.height-.5)*14
    const y = -((e.clientX-rect.left)/rect.width-.5)*14
    setCardTilt({x,y})
  }

  return (
    <div style={{height:"100vh",background:"#05000f",color:"#f1f0ee",fontFamily:"'Segoe UI',system-ui,sans-serif",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column"}}>

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
        {/* Share button */}
        <button onClick={()=>setShowShare(true)} style={{marginLeft:8,background:"rgba(139,92,246,0.12)",border:"1px solid rgba(139,92,246,0.30)",borderRadius:10,padding:"6px 12px",cursor:"pointer",color:"#a78bfa",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
          🌐 Compartilhar
        </button>
        {/* Theme button */}
        <button onClick={()=>setShowThemeSel(true)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:10,padding:"6px 12px",cursor:"pointer",color:"#94a3b8",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
          {PROFILE_THEMES[profileTheme]?.emoji} Tema
        </button>
        {/* Online status */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto",background:"rgba(34,197,94,0.10)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:20,padding:"4px 12px"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e",animation:"onlinePulse 2s ease-in-out infinite"}}/>
          <span style={{fontSize:11,fontWeight:700,color:"#22c55e"}}>Online</span>
        </div>
      </div>

      {/* Centering row — scrollbar at right edge of viewport */}
      <div style={{position:"relative",zIndex:1,flex:1,overflowY:"auto",overflowX:"hidden",display:"flex",justifyContent:"center"}}>
      {/* Width-capped content column — auto height so centering wrapper scrolls */}
      <div style={{width:"100%",maxWidth:1400,padding:"0 32px 24px",display:"flex",flexDirection:"column"}}>

        {/* ══════════ HERO SECTION ══════════ */}
        <div style={{position:"relative",marginBottom:0,flexShrink:0}}>

          {/* Banner */}
          <div style={{position:"relative",height:62,overflow:"hidden"}}>
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
          <div style={{position:"relative",marginTop:-30,padding:"0 12px 0"}}>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:16}}>

              {/* Avatar with holographic ring */}
              <div style={{position:"relative",flexShrink:0}} onClick={()=>!isEditing&&setShowIconSel(true)}>
                <div style={{
                  position:"absolute",inset:-4,borderRadius:"50%",
                  background:`conic-gradient(${pc.join(",")},${pc[0]})`,
                  animation:"rotateSpin 3s linear infinite",
                  filter:`blur(2px) drop-shadow(0 0 12px ${pc[0]})`,
                }}/>
                <div style={{position:"relative",width:60,height:60,borderRadius:"50%",overflow:"hidden",border:"3px solid rgba(5,0,15,1)",cursor:"pointer"}}>
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
                    {/* Bio field */}
                    <div style={{position:"relative"}}>
                      <textarea
                        value={editBio}
                        onChange={e=>{ setEditBio(e.target.value.slice(0,80)); setBioError(null) }}
                        placeholder="Bio (máx. 80 caracteres)…"
                        rows={2}
                        style={{
                          width:"100%",boxSizing:"border-box",padding:"7px 10px",borderRadius:8,
                          background:"rgba(255,255,255,0.05)",
                          border:`1px solid ${bioError?"rgba(239,68,68,0.60)":"rgba(139,92,246,0.30)"}`,
                          color:"#c4b5fd",fontSize:12,outline:"none",resize:"none",fontFamily:"inherit",
                        }}
                      />
                      <span style={{position:"absolute",bottom:6,right:8,fontSize:9,color:editBio.length>=75?"#f87171":"#374151"}}>{editBio.length}/80</span>
                    </div>
                    {/* Profanity error */}
                    {bioError&&(
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:8,background:"rgba(239,68,68,0.10)",border:"1px solid rgba(239,68,68,0.30)"}}>
                        <span style={{fontSize:13}}>🚫</span>
                        <span style={{fontSize:11,color:"#f87171",fontWeight:600}}>{bioError}</span>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={handleSave} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#065f46,#059669)",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>✓ Salvar</button>
                      <button onClick={()=>setIsEditing(false)} style={{flex:1,padding:"7px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.10)",color:"#6b7280",fontWeight:700,fontSize:12,cursor:"pointer"}}>✕</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                      <h2 style={{fontWeight:900,fontSize:18,margin:0,background:`linear-gradient(135deg,#f1f0ee,${pc[0]})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{playerProfile.name}</h2>
                      <button onClick={()=>setIsEditing(true)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:7,padding:"4px 8px",cursor:"pointer",color:"#6b7280",fontSize:13}}>✎</button>
                    </div>
                    {/* Title badge */}
                    {playerProfile.title&&(
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:`linear-gradient(135deg,${pc[0]}20,${pc[1]||pc[0]}10)`,border:`1px solid ${pc[0]}40`,borderRadius:20,padding:"2px 10px",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:800,color:pc[0]}}>{playerProfile.title}</span>
                      </div>
                    )}
                    {/* Bio */}
                    {bio?(
                      <div style={{fontSize:12,color:"#94a3b8",fontStyle:"italic",marginBottom:4,maxWidth:380,lineHeight:1.4}}>"{bio}"</div>
                    ):(
                      <button onClick={()=>setIsEditing(true)} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontSize:11,color:"#374151",fontStyle:"italic",marginBottom:4}}>+ Adicionar bio…</button>
                    )}
                    {/* ID row */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,color:"#374151",fontFamily:"monospace"}}>ID: {playerId?.slice(0,12)}...</span>
                      <button onClick={handleCopy} style={{background:"none",border:"none",cursor:"pointer",color:copied?"#22c55e":"#4b5563",fontSize:11,fontWeight:600,padding:0}}>
                        {copied?"✓ Copiado":"⎘ Copiar"}
                      </button>
                    </div>
                    {/* Recent achievement chips */}
                    {achievements.filter(a=>a.done&&!a.secret).slice(0,3).length>0&&(
                      <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                        {achievements.filter(a=>a.done&&!a.secret).slice(0,3).map(a=>{
                          const ra=RARITY_ACHIEV[a.rarity]
                          return(
                            <div key={a.id} title={a.name} style={{display:"inline-flex",alignItems:"center",gap:4,background:ra.bg,border:`1px solid ${ra.color}40`,borderRadius:20,padding:"2px 8px",fontSize:9,color:ra.color,fontWeight:700}}>
                              <span style={{fontSize:10}}>{a.icon}</span>{a.name.split(" ")[0]}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* Streak badge */}
                    {winStreak>=2&&(
                      <div style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:4,background:"rgba(251,146,60,0.12)",border:"1px solid rgba(251,146,60,0.35)",borderRadius:20,padding:"2px 8px"}}>
                        <span style={{fontSize:10}}>🔥</span>
                        <span style={{fontSize:9,fontWeight:800,color:"#fb923c"}}>{winStreak} vitórias seguidas</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Active master pill */}
              {activeMasterName&&(
                <div style={{
                  flexShrink:0,
                  background:"linear-gradient(160deg,rgba(232,201,109,0.08),rgba(255,255,255,0.02))",
                  border:"1px solid rgba(232,201,109,0.25)",
                  borderRadius:14,padding:"10px 12px",textAlign:"center",minWidth:100,
                  boxShadow:"0 0 20px rgba(232,201,109,0.08)",
                }}>
                  {activeMasterIcon&&(
                    <div style={{width:48,height:48,borderRadius:"50%",overflow:"hidden",
                      border:`2px solid rgba(232,201,109,0.5)`,
                      boxShadow:"0 0 12px rgba(232,201,109,0.3)",
                      margin:"0 auto 5px",position:"relative"}}>
                      <Image src={activeMasterIcon} alt="" width={48} height={48} style={{objectFit:"cover"}}/>
                    </div>
                  )}
                  <div style={{fontSize:8,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:1}}>Mestre</div>
                  <div style={{fontSize:12,fontWeight:900,color:"#f1f0ee",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:90,marginBottom:5}}>
                    {activeMasterName.split(" ")[0]}
                  </div>
                  {/* Bond level - gold gradient */}
                  <div style={{
                    display:"inline-block",
                    background:"linear-gradient(90deg,#b7791f,#e8c96d,#b7791f)",
                    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                    backgroundClip:"text",
                    fontSize:10,fontWeight:900,letterSpacing:"0.04em",marginBottom:5,
                  }}>⚔ Vínculo Lv.{masterBondLv}</div>
                  {/* Bond progress bar — thick + glowing */}
                  <div style={{height:6,borderRadius:99,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                    <div style={{
                      height:"100%",borderRadius:99,
                      width:`${masterBondPct}%`,
                      background:"linear-gradient(90deg,#b7791f,#e8c96d)",
                      boxShadow:"0 0 8px rgba(232,201,109,0.6)",
                      transition:"width 1s ease",
                    }}/>
                  </div>
                  <div style={{fontSize:8,color:"#4b5563",marginTop:3}}>{Math.round(masterBondPct)}% → Lv.{masterBondLv+1}</div>
                </div>
              )}
            </div>

            {/* Quick-stats row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginTop:6}}>
              {[
                {icon:"⚔",    val:totalMatches, lbl:"Partidas"},
                {icon:"🏆",   val:wins,         lbl:"Vitórias"},
                {icon:"📚",   val:uniqueCards,  lbl:"Cartas"},
                {icon:"",     val:coins,        lbl:"Moedas", iconImg:"/images/icons/gacha-coin.png"},
              ].map(s=>(
                <div key={s.lbl} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"5px 4px",textAlign:"center"}}>
                  {(s as any).iconImg
                    ? <img src={(s as any).iconImg} alt="" style={{width:14,height:14,objectFit:"contain",display:"block",margin:"0 auto 2px"}}/>
                    : <div style={{fontSize:12,marginBottom:2}}>{s.icon}</div>
                  }
                  <div style={{fontWeight:900,fontSize:13,color:"#f1f0ee"}}>{s.val.toLocaleString()}</div>
                  <div style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.04em"}}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* XP progress bar */}
            <div style={{marginTop:5,padding:"5px 8px",background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.15)",borderRadius:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:8,fontWeight:700,color:"#a78bfa",textTransform:"uppercase",letterSpacing:"0.06em"}}>⚡ XP — Lv.{currentLevel}</span>
                <span style={{fontSize:8,color:"#6b7280"}}>{levelXP} / {xpPerLevel} XP</span>
              </div>
              <div style={{height:4,borderRadius:99,background:"rgba(255,255,255,0.06)"}}>
                <div style={{height:"100%",borderRadius:99,width:`${xpPct}%`,background:"linear-gradient(90deg,#7c3aed,#a855f7,#c084fc)",boxShadow:"0 0 8px rgba(168,85,247,0.5)",transition:"width 1s ease"}}/>
              </div>
            </div>

            {/* ══ CARD SHOWCASE ══ */}
            <div style={{marginTop:8,padding:"8px 0"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:9,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em"}}>🃏 Vitrine de Cartas</span>
                <span style={{fontSize:9,color:"#374151"}}>— clique para escolher</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[0,1,2].map(slot => {
                  const card = showcaseIds[slot] ? collection.find(c=>c.id===showcaseIds[slot]) : null
                  return (
                    <div key={slot} onClick={()=>setShowShowcasePick(slot)}
                      style={{
                        position:"relative",aspectRatio:"3/4",borderRadius:10,overflow:"hidden",cursor:"pointer",
                        border: card ? rarityBorder(card.rarity) : "2px dashed rgba(255,255,255,0.10)",
                        background: card ? rarityBg(card.rarity) : "rgba(255,255,255,0.02)",
                        transition:"all .2s",
                        boxShadow: card ? rarityGlow(card.rarity) : "none",
                      }}>
                      {card ? (
                        <>
                          <Image src={card.image||"/placeholder.svg"} alt={card.name} fill style={{objectFit:"cover"}}/>
                          {/* Holo sheen */}
                          <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,transparent 35%,rgba(255,255,255,0.12) 50%,transparent 65%)",animation:"holoSheen 2.5s ease-in-out infinite"}}/>
                          {card.rarity==="LR"&&<div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,#ef444420,#fbbf2420,#a855f720,#ef444420)",backgroundSize:"300% 100%",animation:"rainbowShift 1.5s linear infinite"}}/>}
                          {/* Bottom label */}
                          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.85))",padding:"16px 6px 5px"}}>
                            <div style={{fontSize:9,fontWeight:800,color:"#f1f0ee",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{card.name}</div>
                            <div style={{fontSize:8,color: card.rarity==="LR"?"#ef4444":card.rarity==="UR"?"#38bdf8":card.rarity==="SR"?"#a855f7":"#94a3b8"}}>{card.rarity}</div>
                          </div>
                          {/* Remove button */}
                          <button onClick={e=>{e.stopPropagation();handleShowcasePick(slot,null)}}
                            style={{position:"absolute",top:4,right:4,width:18,height:18,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",cursor:"pointer",color:"#f87171",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                        </>
                      ) : (
                        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
                          <span style={{fontSize:22,opacity:.25}}>🃏</span>
                          <span style={{fontSize:9,color:"#374151"}}>Slot {slot+1}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Favourite card signature */}
            {favCard&&(
              <div style={{marginTop:5,display:"flex",alignItems:"center",gap:8,background:rarityBg(favCard.rarity),border:rarityBorder(favCard.rarity),borderRadius:10,padding:"6px 10px"}}>
                <div style={{position:"relative",width:32,height:44,flexShrink:0,borderRadius:4,overflow:"hidden",boxShadow:rarityGlow(favCard.rarity)}}>
                  <Image src={favCard.image||"/placeholder.svg"} alt={favCard.name} fill style={{objectFit:"cover"}}/>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,transparent 35%,rgba(255,255,255,0.18) 50%,transparent 65%)",animation:"holoSheen 2.5s ease-in-out infinite"}}/>
                  {favCard.rarity==="LR"&&<div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,#ef444420,#fbbf2420,#a855f720,#ef444420)",backgroundSize:"300% 100%",animation:"rainbowShift 1.5s linear infinite"}}/>}
                </div>
                <div>
                  <div style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.10em",marginBottom:2}}>🃏 Carta Favorita</div>
                  <div style={{fontWeight:900,fontSize:13,color:"#f1f0ee",marginBottom:2}}>{favCard.name}</div>
                  <div style={{display:"flex",gap:5}}>
                    <span style={{fontSize:8,fontWeight:800,padding:"1px 6px",borderRadius:3,background:rarityBg(favCard.rarity),color:favCard.rarity==="LR"?"#ef4444":favCard.rarity==="UR"?"#38bdf8":favCard.rarity==="SR"?"#a855f7":"#94a3b8"}}>{favCard.rarity}</span>
                    {favCard.element&&<span style={{fontSize:8,fontWeight:700,padding:"1px 6px",borderRadius:3,color:ELEMENT_COLORS[favCard.element]||ELEMENT_COLORS[displayElement(favCard.element)]||"#94a3b8",background:`${ELEMENT_COLORS[favCard.element]||ELEMENT_COLORS[displayElement(favCard.element)]||"#94a3b8"}15`}}>{displayElement(favCard.element)}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════ THEME SELECTOR MODAL ══════════ */}
        {showThemeSel&&(
          <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.80)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"linear-gradient(160deg,#0f0b1a,#0a0510)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:20,padding:24,maxWidth:380,width:"100%"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontWeight:900,fontSize:16,color:"#f1f0ee"}}>🎨 Tema do Perfil</div>
                <button onClick={()=>setShowThemeSel(false)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"#6b7280",fontSize:13}}>✕</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {Object.entries(PROFILE_THEMES).map(([key,th])=>(
                  <button key={key} onClick={()=>handleTheme(key)}
                    style={{
                      padding:"10px 12px",borderRadius:12,cursor:"pointer",textAlign:"left",
                      background: profileTheme===key ? `linear-gradient(135deg,${(th.colors[0]||"#7c3aed")}30,${(th.colors[1]||"#a855f7")}15)` : "rgba(255,255,255,0.03)",
                      border: profileTheme===key ? `1.5px solid ${th.colors[0]||"#7c3aed"}` : "1px solid rgba(255,255,255,0.07)",
                      transition:"all .2s",
                    }}>
                    <div style={{fontSize:18,marginBottom:4}}>{th.emoji}</div>
                    <div style={{fontSize:11,fontWeight:700,color:profileTheme===key?(th.colors[0]||"#a855f7"):"#94a3b8"}}>{th.label}</div>
                    {th.colors.length>0&&(
                      <div style={{display:"flex",gap:3,marginTop:5}}>
                        {th.colors.map(c=>(
                          <div key={c} style={{width:12,height:12,borderRadius:"50%",background:c,boxShadow:`0 0 5px ${c}80`}}/>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ SHOWCASE CARD PICKER ══════════ */}
        {showShowcasePick!==null&&(
          <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"linear-gradient(160deg,#0f0b1a,#0a0510)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:20,padding:20,maxWidth:560,width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontWeight:900,fontSize:15,color:"#f1f0ee"}}>🃏 Escolher carta — Slot {showShowcasePick+1}</div>
                <button onClick={()=>setShowShowcasePick(null)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"#6b7280",fontSize:13}}>✕</button>
              </div>
              {/* Remove option */}
              <button onClick={()=>handleShowcasePick(showShowcasePick,null)}
                style={{marginBottom:10,padding:"7px",borderRadius:8,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.20)",color:"#f87171",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                🗑 Remover carta deste slot
              </button>
              {/* Card grid */}
              <div style={{overflowY:"auto",flex:1}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
                  {/* Sort by rarity */}
                  {[...collection].sort((a,b)=>{const o={LR:0,UR:1,SR:2,R:3,C:4};return (o[a.rarity as keyof typeof o]??5)-(o[b.rarity as keyof typeof o]??5)}).map(card=>(
                    <div key={card.id} onClick={()=>handleShowcasePick(showShowcasePick,card.id)}
                      style={{
                        position:"relative",aspectRatio:"3/4",borderRadius:7,overflow:"hidden",cursor:"pointer",
                        border: showcaseIds.includes(card.id) ? `2px solid #e8c96d` : rarityBorder(card.rarity),
                        boxShadow: rarityGlow(card.rarity), transition:"all .15s",
                      }}>
                      <Image src={card.image||"/placeholder.svg"} alt={card.name} fill style={{objectFit:"cover"}}/>
                      {showcaseIds.includes(card.id)&&(
                        <div style={{position:"absolute",inset:0,background:"rgba(232,201,109,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>✓</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ SHARE MODAL ══════════ */}
        {showShare&&(
          <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"linear-gradient(160deg,#0f0b1a,#0a0510)",border:"1px solid rgba(139,92,246,0.25)",borderRadius:20,padding:24,maxWidth:420,width:"100%",boxShadow:"0 0 40px rgba(139,92,246,0.15)"}}>
              {/* Title */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <div style={{fontWeight:900,fontSize:16,color:"#f1f0ee"}}>🌐 Compartilhar Perfil</div>
                <button onClick={()=>setShowShare(false)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"#6b7280",fontSize:13}}>✕</button>
              </div>

              {/* Profile card preview */}
              <div style={{background:"linear-gradient(135deg,rgba(139,92,246,0.08),rgba(232,201,109,0.04))",border:`1px solid ${pc[0]}30`,borderRadius:14,padding:"14px 16px",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  {playerProfile.avatarUrl&&(
                    <div style={{width:48,height:48,borderRadius:"50%",overflow:"hidden",border:`2px solid ${pc[0]}60`,flexShrink:0,position:"relative"}}>
                      <Image src={playerProfile.avatarUrl} alt="" fill style={{objectFit:"cover"}}/>
                    </div>
                  )}
                  <div>
                    <div style={{fontWeight:900,fontSize:16,color:"#f1f0ee"}}>{playerProfile.name}</div>
                    {playerProfile.title&&<div style={{fontSize:11,color:pc[0],fontWeight:700}}>{playerProfile.title}</div>}
                    {bio&&<div style={{fontSize:11,color:"#6b7280",fontStyle:"italic",marginTop:2}}>"{bio}"</div>}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
                  {[
                    {v:`Lv.${currentLevel}`, l:"Nível"},
                    {v:`${winRate}%`, l:"Win rate"},
                    {v:String(wins), l:"Vitórias"},
                    {v:String(uniqueCards), l:"Cartas"},
                  ].map(s=>(
                    <div key={s.l} style={{textAlign:"center",background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"5px 4px"}}>
                      <div style={{fontWeight:900,fontSize:14,color:"#f1f0ee"}}>{s.v}</div>
                      <div style={{fontSize:9,color:"#4b5563"}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {winStreak>=2&&(
                  <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(251,146,60,0.12)",border:"1px solid rgba(251,146,60,0.30)",borderRadius:20,padding:"2px 8px"}}>
                    <span>🔥</span><span style={{fontSize:10,color:"#fb923c",fontWeight:700}}>{winStreak} vitórias seguidas</span>
                  </div>
                )}
              </div>

              {/* QR Code via qrserver.com (reliable, no auth needed) */}
              <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:16}}>
                <div style={{flexShrink:0,background:"#fff",borderRadius:10,padding:6,width:120,height:120,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=2&data=${encodeURIComponent([
                      `GP Card Game — ${playerProfile.name}`,
                      `Lv.${currentLevel} | ${prestige}`,
                      `${wins}V/${totalMatches-wins}D | ${winRate}% win rate`,
                      `${uniqueCards} cartas | LR:${rarityCount.LR} UR:${rarityCount.UR}`,
                      `ID: ${playerId}`,
                    ].join('\n'))}`}
                    alt="QR Code"
                    width={110} height={110}
                    style={{display:"block",borderRadius:4}}
                    onError={e => {
                      const el = e.currentTarget as HTMLImageElement
                      el.style.display = "none"
                      const parent = el.parentElement
                      if (parent && !parent.querySelector(".qr-fallback")) {
                        const fb = document.createElement("div")
                        fb.className = "qr-fallback"
                        fb.style.cssText = "font-size:9px;color:#6b7280;text-align:center;padding:4px;line-height:1.4"
                        fb.textContent = "QR indisponível\n(sem internet)"
                        parent.appendChild(fb)
                      }
                    }}
                  />
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"#6b7280",marginBottom:8,lineHeight:1.5}}>
                    Escaneie o QR Code para ver os seus stats, ou copie o resumo do perfil para compartilhar onde quiser.
                  </div>
                  <button
                    onClick={handleCopyStats}
                    style={{
                      width:"100%",padding:"10px",borderRadius:10,cursor:"pointer",fontWeight:800,fontSize:13,
                      background:shareCopied?"linear-gradient(135deg,#065f46,#059669)":"linear-gradient(135deg,#4c1d95,#7c3aed)",
                      border:"none",color:"#fff",
                      boxShadow:shareCopied?"0 0 16px rgba(5,150,105,0.4)":"0 0 16px rgba(124,58,237,0.3)",
                      transition:"all .3s",
                    }}>
                    {shareCopied?"✓ Copiado!":"📋 Copiar Resumo"}
                  </button>
                </div>
              </div>

              {/* Stats text preview */}
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:9,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Prévia do texto copiado</div>
                <pre style={{margin:0,fontSize:11,color:"#94a3b8",fontFamily:"monospace",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{[
                  `🎮 ${playerProfile.name} — GP Card Game`,
                  `🏆 Nível ${currentLevel} | ${prestige.charAt(0).toUpperCase()+prestige.slice(1)}`,
                  `⚔ ${wins}V / ${totalMatches-wins}D (${winRate}% win rate)`,
                  `📚 ${uniqueCards} cartas únicas | LR:${rarityCount.LR} UR:${rarityCount.UR}`,
                  `💰 ${coins.toLocaleString()} moedas`,
                  favElement?`⚡ Elemento: ${displayElement(favElement[0])}`:"",
                  winStreak>=2?`🔥 Streak: ${winStreak} vitórias seguidas`:"",
                  `🆔 ID: ${playerId}`,
                ].filter(Boolean).join("\n")}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Icon selector */}
        {showIconSel&&(
          <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div style={{background:"linear-gradient(160deg,#100c08,#0e0b18)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:20,padding:20,maxWidth:400,width:"100%"}}>
              <div style={{fontWeight:900,fontSize:15,color:"#f1f0ee",marginBottom:14}}>Escolher Avatar</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                {PROFILE_ICONS.map((icon: {id:string;name:string;image:string})=>(
                  <button key={icon.id} onClick={()=>handleIcon(icon.image)}
                    style={{
                      aspectRatio:"1",borderRadius:12,overflow:"hidden",
                      border:playerProfile.avatarUrl===icon.image?"2px solid #e8c96d":"2px solid rgba(255,255,255,0.07)",
                      cursor:"pointer",padding:0,background:"rgba(255,255,255,0.04)",
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,
                      transition:"all 0.2s",
                    }}>
                    <div style={{position:"relative",width:60,height:60,borderRadius:8,overflow:"hidden"}}>
                      <Image src={icon.image} alt={icon.name} fill style={{objectFit:"cover"}}/>
                    </div>
                    <span style={{fontSize:9,fontWeight:700,color:"#6b7280"}}>{icon.name}</span>
                  </button>
                ))}
              </div>
              <button onClick={()=>setShowIconSel(false)} style={{marginTop:14,width:"100%",padding:"10px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#6b7280",fontWeight:700,fontSize:13,cursor:"pointer"}}>Fechar</button>
            </div>
          </div>
        )}

        {/* ══════════ TABS ══════════ */}
        <div style={{flexShrink:0,display:"flex",margin:"8px 12px 0",borderRadius:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
          {(["stats","achievements","collection"] as const).map(tab=>{
            const icons={"stats":"📊","achievements":"🏆","collection":"🃏"}
            const labels={"stats":"Estatísticas","achievements":"Conquistas","collection":"Coleção"}
            const active=activeTab===tab
            const colors={"stats":"#38bdf8","achievements":"#fbbf24","collection":"#a855f7"}
            return (
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{
                flex:1,padding:"8px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                background:active?`${colors[tab]}12`:"transparent",
                borderBottom:`2px solid ${active?colors[tab]:"transparent"}`,
                border:"none",cursor:"pointer",transition:"all .2s",
                borderRight:tab!=="collection"?"1px solid rgba(255,255,255,0.05)":"none",
              }}>
                <span style={{fontSize:14}}>{icons[tab]}</span>
                <span style={{fontSize:9,fontWeight:700,color:active?colors[tab]:"#4b5563",letterSpacing:"0.04em"}}>{labels[tab]}</span>
              </button>
            )
          })}
        </div>

        {/* ══════════ TAB CONTENT (scrolls independently) ══════════ */}
        <div style={{paddingBottom:8}}>

        {/* ══════════ STATS TAB ══════════ */}
        {activeTab==="stats"&&(
          <div style={{padding:"8px 12px",display:"flex",flexDirection:"column",gap:8}}>

            {/* Win rate ring + breakdown */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12}}>
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(56,189,248,0.15)",borderRadius:12,padding:"8px",textAlign:"center",position:"relative"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Taxa de Vitória</div>
                <div style={{position:"relative",display:"inline-block"}}>
                  <WinRing rate={winRate}/>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontWeight:900,fontSize:16,color:"#f1f0ee",lineHeight:1}}>{winRate}%</span>
                    <span style={{fontSize:9,color:"#4b5563",marginTop:2}}>{wins}V/{totalMatches-wins}D</span>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {/* Rarity breakdown */}
                {(["LR","UR","SR","R"] as const).map(r=>{
                  const col=r==="LR"?"#ef4444":r==="UR"?"#38bdf8":r==="SR"?"#a855f7":"#94a3b8"
                  const pct=uniqueCards>0?Math.min(100,(rarityCount[r]/uniqueCards)*100):0
                  return(
                    <div key={r} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7,padding:"4px 8px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:10,fontWeight:800,color:col}}>{r}</span>
                        <span style={{fontSize:10,color:"#6b7280"}}>{rarityCount[r]}</span>
                      </div>
                      <div style={{height:4,borderRadius:99,background:"rgba(255,255,255,0.06)"}}>
                        <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:`linear-gradient(90deg,${col}80,${col})`,boxShadow:`0 0 6px ${col}60`,transition:"width .8s ease"}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Favourite element + decks + resources — 3 columns */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {/* Element */}
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"8px"}}>
                <div style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>⚡ Elemento Favorito</div>
                {favElement?(
                  <>
                    <div style={{fontWeight:900,fontSize:15,color:ELEMENT_COLORS[favElement[0]]||ELEMENT_COLORS[displayElement(favElement[0])]||"#94a3b8",marginBottom:1}}>{displayElement(favElement[0])}</div>
                    <div style={{fontSize:10,color:"#4b5563"}}>{favElement[1]} cartas</div>
                  </>
                ):<div style={{color:"#374151",fontSize:12}}>Sem dados</div>}
              </div>
              {/* Decks */}
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"8px"}}>
                <div style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>🃏 Decks Criados</div>
                <div style={{fontWeight:900,fontSize:15,color:"#f1f0ee",marginBottom:1}}>{decks.length}</div>
                <div style={{fontSize:10,color:"#4b5563"}}>{decks[0]?.name||"Nenhum deck"}</div>
              </div>
              {/* Resources */}
              <div style={{background:"rgba(232,201,109,0.05)",border:"1px solid rgba(232,201,109,0.15)",borderRadius:10,padding:"8px"}}>
                <div style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>💰 Recursos</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <img src="/images/icons/gacha-coin.png" alt="" style={{width:18,height:18,objectFit:"contain",flexShrink:0}}/>
                    <div>
                      <div style={{fontWeight:900,fontSize:14,color:"#e8c96d"}}>{coins.toLocaleString()}</div>
                      <div style={{fontSize:9,color:"#4b5563"}}>Moedas</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16}}>⭐</span>
                    <div>
                      <div style={{fontWeight:900,fontSize:14,color:"#c4b5fd"}}>{friendPoints||0}</div>
                      <div style={{fontSize:9,color:"#4b5563"}}>Pts Amizade</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance chart */}
            <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>📊 Gráfico de Desempenho — Últimas 10</div>
              <PerformanceChart matches={matchHistory}/>
            </div>

            {/* Recent matches */}
            {recentMatches.length>0&&(
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"8px 12px"}}>
                <div style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>⚔ Últimas Partidas</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                  {recentMatches.map((m:any,i:number)=>{
                    const won = m.result === "won"
                    // duel-screen saves: opponent, deckUsed, date, mode, result
                    const opp  = m.opponent || ""
                    const deck = m.deckUsed || m.deckName || m.deck || ""
                    const date = m.date
                      ? new Date(m.date).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})
                      : m.timestamp
                        ? new Date(m.timestamp).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})
                        : ""
                    // Skip records with no valid result to avoid showing false defeats
                    if (!m.result) return null
                    return(
                      <div key={m.id||i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px",borderRadius:6,background:won?"rgba(34,197,94,0.05)":"rgba(239,68,68,0.05)",border:`1px solid ${won?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)"}`}}>
                        <div style={{width:20,height:20,borderRadius:5,flexShrink:0,background:won?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:won?"#4ade80":"#f87171"}}>
                          {won?"✓":"✗"}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:700,color:won?"#4ade80":"#f87171"}}>
                            {won?"Vitória":"Derrota"}{opp?` vs ${opp}`:""}
                          </div>
                          {deck&&<div style={{fontSize:9,color:"#4b5563",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deck}</div>}
                        </div>
                        {date&&<div style={{fontSize:9,color:"#374151",flexShrink:0}}>{date}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ ACHIEVEMENTS TAB ══════════ */}
        {activeTab==="achievements"&&(
          <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
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
                <div key={a.id} style={{position:"relative",background:a.done?ra.bg:"rgba(255,255,255,0.02)",border:`1px solid ${a.done?ra.color+"40":"rgba(255,255,255,0.06)"}`,borderRadius:12,padding:"10px 12px",overflow:"hidden",transition:"all .2s"}}>
                  {/* Particle effect for completed */}
                  {a.done&&<AchievementParticles active={true}/>}
                  {/* Completed glow */}
                  {a.done&&<div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 0% 50%,${ra.color}15,transparent 60%)`,pointerEvents:"none"}}/>}
                  <div style={{position:"relative",display:"flex",alignItems:"center",gap:12}}>
                    <div style={{
                      width:38,height:38,borderRadius:10,flexShrink:0,
                      background:a.done?`linear-gradient(135deg,${ra.color}25,${ra.color}10)`:"rgba(255,255,255,0.04)",
                      border:`1px solid ${a.done?ra.color+"50":"rgba(255,255,255,0.07)"}`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,
                      boxShadow:a.done?`0 0 14px ${ra.color}40`:"none",
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
                    <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,minWidth:90}}>
                      {a.done&&!a.secret&&!claimedAchievements.has(a.id)&&(
                        <button
                          onClick={()=>handleClaimAchievement(a.id,a.reward)}
                          style={{
                            background:"linear-gradient(135deg,#7a5c0f,#e8c96d)",
                            border:"none",borderRadius:7,padding:"5px 12px",cursor:"pointer",
                            color:"#0c0a06",fontWeight:900,fontSize:11,
                            boxShadow:"0 2px 10px rgba(232,201,109,0.40)",whiteSpace:"nowrap",
                          }}>
                          🎁 Receber
                        </button>
                      )}
                      {a.done&&!a.secret&&claimedAchievements.has(a.id)&&(
                        <span style={{fontSize:10,color:"#22c55e",fontWeight:700}}>✓ Coletado</span>
                      )}
                      <span style={{fontSize:10,color:a.done&&!claimedAchievements.has(a.id)?"#e8c96d":"#374151",fontWeight:700,textAlign:"right"}}>
                        {!a.secret?a.reward:""}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════ COLLECTION TAB ══════════ */}
        {activeTab==="collection"&&(
          <div style={{padding:"10px 12px"}}>
            {/* Header row */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:13,color:"#4b5563"}}>{uniqueCards} cartas únicas</span>
              <div style={{display:"flex",gap:6}}>
                {(["LR","UR","SR","R"] as const).map(r=>{
                  const col=r==="LR"?"#ef4444":r==="UR"?"#38bdf8":r==="SR"?"#a855f7":"#94a3b8"
                  return <span key={r} style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,color:col,background:`${col}15`}}>{r}: {rarityCount[r]}</span>
                })}
              </div>
            </div>

            {/* ── Search + Element filter bar ── */}
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
              {/* Search input */}
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,pointerEvents:"none",opacity:0.4}}>🔍</span>
                <input
                  value={collectionSearch}
                  onChange={e=>setCollectionSearch(e.target.value)}
                  placeholder="Buscar carta por nome…"
                  style={{
                    width:"100%",boxSizing:"border-box",
                    background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:10,padding:"7px 10px 7px 32px",
                    color:"#f1f0ee",fontSize:12,outline:"none",fontFamily:"inherit",
                  }}
                />
                {collectionSearch&&(
                  <button onClick={()=>setCollectionSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#4b5563",fontSize:14,lineHeight:1}}>✕</button>
                )}
              </div>
              {/* Element filter chips */}
              {(()=>{
                const usedElements = [...new Set(collection.filter(c=>c.element).map(c=>displayElement(c.element!)))]
                if (usedElements.length===0) return null
                return (
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:9,color:"#374151",fontWeight:700}}>Elemento:</span>
                    <button
                      onClick={()=>setCollectionElemFilter(null)}
                      style={{padding:"2px 10px",borderRadius:99,fontSize:9,fontWeight:700,cursor:"pointer",border:`1px solid ${collectionElemFilter===null?"rgba(255,255,255,0.30)":"rgba(255,255,255,0.08)"}`,background:collectionElemFilter===null?"rgba(255,255,255,0.10)":"rgba(255,255,255,0.03)",color:collectionElemFilter===null?"#f1f0ee":"#4b5563",transition:"all .15s"}}>
                      Todos
                    </button>
                    {usedElements.map(el=>{
                      const ec = ELEMENT_COLORS[el]||"#94a3b8"
                      const active = collectionElemFilter===el
                      return (
                        <button key={el} onClick={()=>setCollectionElemFilter(active?null:el)}
                          style={{padding:"2px 10px",borderRadius:99,fontSize:9,fontWeight:700,cursor:"pointer",
                            border:`1px solid ${active?ec:ec+"30"}`,
                            background:active?`${ec}20`:"rgba(255,255,255,0.02)",
                            color:active?ec:"#4b5563",transition:"all .15s",
                          }}>
                          {el}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* Rarity sections */}
            {(["LR","UR","SR","R"] as const).map(rarity=>{
              // Apply search + element filter
              let cards = collection.filter(c=>c.rarity===rarity)
              if (collectionSearch.trim()) {
                const q = collectionSearch.toLowerCase()
                cards = cards.filter(c=>c.name.toLowerCase().includes(q))
              }
              if (collectionElemFilter) {
                cards = cards.filter(c=>c.element&&displayElement(c.element)===collectionElemFilter)
              }
              if (!cards.length) return null
              const rc = rarity==="LR"?"#ef4444":rarity==="UR"?"#38bdf8":rarity==="SR"?"#a855f7":"#94a3b8"
              const isExpanded = expandedRarities.has(rarity)
              const LIMIT = 16
              const visible = isExpanded ? cards : cards.slice(0,LIMIT)
              return(
                <div key={rarity} style={{marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{height:1,flex:1,background:`linear-gradient(to right,${rc}40,transparent)`}}/>
                    <span style={{fontSize:11,fontWeight:800,color:rc,textTransform:"uppercase",letterSpacing:"0.10em"}}>{rarity}</span>
                    <span style={{fontSize:9,color:"#4b5563"}}>{cards.length}</span>
                    <div style={{height:1,flex:1,background:`linear-gradient(to left,${rc}40,transparent)`}}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                    {visible.map((card,i)=>(
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
                  {/* Expand / Collapse button */}
                  {cards.length>LIMIT&&(
                    <button
                      onClick={()=>setExpandedRarities(prev=>{
                        const next=new Set(prev)
                        if (next.has(rarity)) next.delete(rarity)
                        else next.add(rarity)
                        return next
                      })}
                      style={{
                        display:"block",width:"100%",marginTop:8,padding:"6px",
                        borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11,
                        background:`${rc}12`,border:`1px solid ${rc}30`,color:rc,
                        transition:"all .2s",
                      }}>
                      {isExpanded?`▲ Recolher`:`▼ Ver todas ${cards.length} cartas (+${cards.length-LIMIT})`}
                    </button>
                  )}
                </div>
              )
            })}
            {/* Empty state */}
            {(collectionSearch||collectionElemFilter)&&(["LR","UR","SR","R"] as const).every(r=>{
              let c=collection.filter(x=>x.rarity===r)
              if(collectionSearch.trim()) c=c.filter(x=>x.name.toLowerCase().includes(collectionSearch.toLowerCase()))
              if(collectionElemFilter) c=c.filter(x=>x.element&&displayElement(x.element)===collectionElemFilter)
              return c.length===0
            })&&(
              <div style={{textAlign:"center",padding:"30px 0",color:"#374151",fontSize:13}}>
                Nenhuma carta encontrada para "{collectionSearch||collectionElemFilter}"
              </div>
            )}
          </div>
        )}
        </div>
      </div>{/* end width-capped content column */}
      </div>{/* end centering wrapper */}

      {/* ── Achievement Claim Toast ── */}
      {claimToast&&(
        <div style={{
          position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",zIndex:500,
          background:"linear-gradient(135deg,#7a5c0f,#e8c96d,#7a5c0f)",
          borderRadius:99,padding:"10px 24px",
          boxShadow:"0 0 32px rgba(232,201,109,0.60)",
          display:"flex",alignItems:"center",gap:10,
          animation:"toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          pointerEvents:"none",
        }}>
          <img src="/images/icons/gacha-coin.png" alt="" style={{width:22,height:22,objectFit:"contain"}}/>
          <span style={{fontWeight:900,fontSize:16,color:"#0c0a06",letterSpacing:"0.02em"}}>{claimToast} coletados!</span>
          <span style={{fontSize:18}}>🎉</span>
        </div>
      )}

      {/* ── Enhanced Card Zoom Modal ── */}
      {zoomedCard&&(
        <div onClick={()=>setZoomedCard(null)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:16,alignItems:"flex-start",maxWidth:600,width:"100%"}}>
            {/* Card image */}
            <div style={{width:200,flexShrink:0,aspectRatio:"3/4",position:"relative",borderRadius:14,overflow:"hidden",boxShadow:rarityGlow(zoomedCard.rarity)}}>
              <Image src={zoomedCard.image||"/placeholder.svg"} alt={zoomedCard.name} fill style={{objectFit:"cover"}}/>
              {zoomedCard.rarity==="LR"&&<div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,#ef444420,#fbbf2420,#a855f720,#ef444420)",backgroundSize:"300% 100%",animation:"rainbowShift 1.5s linear infinite"}}/>}
              <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,transparent 40%,rgba(255,255,255,0.12) 50%,transparent 60%)",animation:"holoSheen 2.5s ease-in-out infinite",pointerEvents:"none"}}/>
            </div>
            {/* Card info panel */}
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:10}}>
              {/* Name + rarity */}
              <div>
                <div style={{fontSize:8,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.10em",marginBottom:4}}>Carta</div>
                <h3 style={{margin:0,fontWeight:900,fontSize:17,color:"#f1f0ee",lineHeight:1.3,marginBottom:6}}>{zoomedCard.name}</h3>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{
                    fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:4,
                    color:zoomedCard.rarity==="LR"?"#ef4444":zoomedCard.rarity==="UR"?"#38bdf8":zoomedCard.rarity==="SR"?"#a855f7":"#94a3b8",
                    background:rarityBg(zoomedCard.rarity),border:rarityBorder(zoomedCard.rarity),
                  }}>{zoomedCard.rarity}</span>
                  {zoomedCard.element&&<span style={{
                    fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,
                    color:ELEMENT_COLORS[zoomedCard.element]||ELEMENT_COLORS[displayElement(zoomedCard.element)]||"#94a3b8",
                    background:`${ELEMENT_COLORS[zoomedCard.element]||ELEMENT_COLORS[displayElement(zoomedCard.element)]||"#94a3b8"}18`,
                  }}>{displayElement(zoomedCard.element)}</span>
                  {(zoomedCard as any).type&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,color:"#94a3b8",background:"rgba(255,255,255,0.06)"}}>{(zoomedCard as any).type}</span>}
                </div>
              </div>

              {/* DP / power */}
              {(zoomedCard as any).dp&&(
                <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontWeight:900,fontSize:22,color:
                    zoomedCard.rarity==="LR"?"#fbbf24":
                    zoomedCard.rarity==="UR"?"#38bdf8":
                    zoomedCard.rarity==="SR"?"#a855f7":"#94a3b8"
                  }}>{(zoomedCard as any).dp}</span>
                  <span style={{fontSize:11,color:"#4b5563",fontWeight:700}}>DP</span>
                </div>
              )}

              {/* Effect / description */}
              {(zoomedCard as any).effect&&(
                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Efeito</div>
                  <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.6}}>{(zoomedCard as any).effect}</div>
                </div>
              )}

              {/* How many copies player owns */}
              {(()=>{
                const copies = collection.filter(c=>c.id.split("-").slice(0,-2).join("-")===zoomedCard.id.split("-").slice(0,-2).join("-")).length
                return copies>0?(
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:10,color:"#4b5563"}}>Você possui</span>
                    <span style={{fontWeight:900,fontSize:14,color:"#e8c96d"}}>{copies}×</span>
                    <span style={{fontSize:10,color:"#4b5563"}}>desta carta</span>
                  </div>
                ):null
              })()}

              {/* Quick-add to showcase */}
              {showcaseIds.some(id=>id===null)&&(
                <button
                  onClick={()=>{
                    const slot=showcaseIds.findIndex(id=>id===null)
                    if(slot>=0){ handleShowcasePick(slot,zoomedCard.id); setZoomedCard(null) }
                  }}
                  style={{
                    padding:"8px 14px",borderRadius:10,border:"1px solid rgba(232,201,109,0.35)",
                    background:"rgba(232,201,109,0.08)",color:"#e8c96d",fontWeight:800,fontSize:12,cursor:"pointer",
                    display:"flex",alignItems:"center",gap:6,transition:"all .2s",
                  }}>
                  🃏 Adicionar à vitrine
                </button>
              )}

              {/* Close */}
              <button onClick={()=>setZoomedCard(null)} style={{marginTop:"auto",padding:"8px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#6b7280",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                ✕ Fechar
              </button>
            </div>
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
        @keyframes toastIn{0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(0.85)}100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
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
