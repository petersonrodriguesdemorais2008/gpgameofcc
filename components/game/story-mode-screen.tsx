"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ArrowLeft, BookOpen, Swords, Home, Lock, SkipForward, Trophy, Star, Coins, Gem, Gift, X, Play, Check, Scroll, Zap, FastForward, Map as MapIcon } from "lucide-react"
import { useGame } from "@/contexts/game-context"

// ─── Types ────────────────────────────────────────────────────────────────────

type Emotion = "normal" | "happy" | "rage"
type CharacterId = "fehnon" | "calem" | "arthur" | "guard1" | "guard2"

interface Character {
  id: CharacterId
  name: string
  emotion: Emotion
  side: "left" | "right"
}

interface Panel {
  id: string
  bg: string
  characters: Character[]
  speaker?: CharacterId | "narrator"
  speakerName?: string
  text: string
  textType?: "speech" | "thought" | "narrator"
  overlayCaption?: string
}

interface Scene {
  id: string
  title: string
  panels: Panel[]
}

interface Stage {
  id: string
  number: number
  title: string
  subtitle: string
  type: "scene" | "battle" | "boss"
  sceneData?: Scene
  /** Diálogo exibido ANTES da batalha (Batalha com Diálogo). */
  preDialogue?: Scene
  /** Diálogo exibido DEPOIS da vitória na batalha. */
  postDialogue?: Scene
  /** Nome do oponente exibido na intro de batalha. */
  opponent?: string
}

interface StoryModeScreenProps {
  onBack: () => void
  onStartBattle: (mode: "story-normal" | "story-boss", stageId: string) => void
}

// ─── Assets ───────────────────────────────────────────────────────────────────

const BG = {
  house_ext:   "/images/calemhouse1_scene.png",
  house_int:   "/images/calemhouse2_scene.png",
  bosque:      "/images/bosque2_scene.png",
  ruins_day:   "/images/ruins1_scene.png",
  ruins_night: "/images/ruins2_scene.png",
  camelot:     "/images/camelot_scene.png",
}

function charImg(id: CharacterId, emotion: Emotion) {
  return `/images/${id}_${emotion}_scene.png`
}

function getAllSceneImages(stages: Stage[]): string[] {
  const imgs = new Set<string>()
  const collect = (scene?: Scene) => {
    if (!scene) return
    scene.panels.forEach(p => {
      imgs.add(p.bg)
      p.characters.forEach(c => imgs.add(charImg(c.id, c.emotion)))
    })
  }
  stages.forEach(s => { collect(s.sceneData); collect(s.preDialogue); collect(s.postDialogue) })
  return Array.from(imgs)
}

// ─── Stage Data ───────────────────────────────────────────────────────────────

const CHAPTER1_STAGES: Stage[] = [
  {
    id: "c1s1", number: 1, title: "O Encontro", subtitle: "Cena 1", type: "scene",
    sceneData: { id: "c1s1", title: "O Encontro", panels: [
      { id:"p1", bg: BG.house_ext, characters:[{id:"calem",name:"Calem",emotion:"normal",side:"left"}], speaker:"calem", speakerName:"Calem", text:"Que dia monótono... como sempre.", textType:"thought", overlayCaption:"Casa no topo de uma colina — fora do reino" },
      { id:"p2", bg: BG.house_ext, characters:[{id:"guard1",name:"Guarda",emotion:"normal",side:"left"},{id:"guard2",name:"Guarda",emotion:"normal",side:"right"}], speaker:"guard1", speakerName:"Guarda do Reino", text:"Parem esse garoto! Ele é procurado pelo Reino de Camelot!", textType:"speech" },
      { id:"p3", bg: BG.house_ext, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Eu não fiz nada! Me soltem!", textType:"speech" },
      { id:"p4", bg: BG.house_int, characters:[{id:"calem",name:"Calem",emotion:"happy",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Hm? Que barulho é esse lá fora?", textType:"speech" },
      { id:"p5", bg: BG.house_int, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Desculpa invadir sua casa! Preciso me esconder rápido!", textType:"speech" },
    ]},
  },
  {
    // ── Batalha com Diálogo: os guardas encurralam a dupla na fuga ──
    id: "c1s2", number: 2, title: "A Fuga", subtitle: "Batalha + Cena", type: "battle",
    opponent: "Guardas do Reino",
    preDialogue: { id: "c1s2-pre", title: "A Fuga", panels: [
      { id:"p1", bg: BG.house_ext, characters:[{id:"guard1",name:"Guarda",emotion:"normal",side:"left"},{id:"guard2",name:"Guarda",emotion:"normal",side:"right"}], speaker:"guard1", speakerName:"Guarda do Reino", text:"Ele entrou nessa casa! Cerquem o local!", textType:"speech" },
      { id:"p2", bg: BG.house_ext, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Desculpa por isso. Preciso ir agora.", textType:"speech" },
      { id:"p3", bg: BG.bosque, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Espera! Eu vou com você!", textType:"speech" },
      { id:"p4", bg: BG.bosque, characters:[{id:"guard1",name:"Guarda",emotion:"normal",side:"left"},{id:"guard2",name:"Guarda",emotion:"normal",side:"right"}], speaker:"guard1", speakerName:"Guarda do Reino", text:"Alto aí! Vocês não vão a lugar nenhum!", textType:"speech" },
      { id:"p5", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Fica atrás de mim, Calem. Eu cuido deles!", textType:"speech" },
    ]},
    postDialogue: { id: "c1s2-post", title: "A Fuga", panels: [
      { id:"p1", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"calem",name:"Calem",emotion:"normal",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Por que você foi atrás de mim?! Isso é problema meu!", textType:"speech" },
      { id:"p2", bg: BG.bosque, characters:[{id:"calem",name:"Calem",emotion:"happy",side:"left"}], speaker:"calem", speakerName:"Calem", text:"Já estamos longe dos guardas. Você disse que tinha um plano, não disse?", textType:"speech" },
      { id:"p3", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"happy",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"...Certo. Conheço um lugar onde estaremos seguros. Me sigam.", textType:"speech" },
    ]},
  },
  {
    id: "c1s3", number: 3, title: "As Ruínas", subtitle: "Cena 2", type: "scene",
    sceneData: { id: "c1s3", title: "As Ruínas", panels: [
      { id:"p1", bg: BG.ruins_day, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"happy",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Aqui. Ninguém vem até esse lugar.", textType:"speech", overlayCaption:"Ruínas Abandonadas — fora dos limites do reino" },
      { id:"p2", bg: BG.ruins_day, characters:[{id:"calem",name:"Calem",emotion:"happy",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Incrível! Olha esses desenhos nas paredes... são antigos!", textType:"speech" },
      { id:"p3", bg: BG.ruins_night, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"normal",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Essa estrela... você acha que existe mesmo? A lenda da estrela que realiza desejos?", textType:"speech" },
      { id:"p4", bg: BG.ruins_night, characters:[{id:"fehnon",name:"Fehnon",emotion:"happy",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Não sei. Mas ouvi sobre ela desde criança. Dizem que concede poderes inimagináveis.", textType:"speech" },
      { id:"p5", bg: BG.ruins_night, characters:[{id:"calem",name:"Calem",emotion:"normal",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Me sinto muito sozinho. Queria que minha vida mudasse... que fosse diferente.", textType:"thought" },
      { id:"p6", bg: BG.ruins_night, characters:[{id:"fehnon",name:"Fehnon",emotion:"happy",side:"left"},{id:"calem",name:"Calem",emotion:"happy",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Agora que somos amigos, você não precisa mais ter esse medo! Hahaha!", textType:"speech" },
    ]},
  },
  {
    id: "c1s4", number: 4, title: "A Rachadura", subtitle: "Cena 3", type: "scene",
    sceneData: { id: "c1s4", title: "A Rachadura Roxa", panels: [
      { id:"p1", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"happy",side:"right"}], speaker:"narrator", speakerName:"", text:"No dia seguinte, eles partiram sem saber para onde ir...", textType:"narrator", overlayCaption:"No dia seguinte — estrada fora das ruínas" },
      { id:"p2", bg: BG.bosque, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"O quê?! Uma rachadura roxa explodindo no céu?!", textType:"speech" },
      { id:"p3", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"CALEM!! NÃO!!", textType:"speech" },
      { id:"p4", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"narrator", speakerName:"", text:"Uma voz ecoa... 'Venha ao Reino de Camelot até o meio-dia. Ou seu amigo morrerá.'", textType:"narrator" },
      { id:"p5", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"CAMELOT...! Eu vou te salvar, Calem!", textType:"speech" },
    ]},
  },
  {
    // ── Batalha com Diálogo: os portões de Camelot ──
    id:"c1b1", number:5, title:"Portões de Camelot", subtitle:"Batalha", type:"battle",
    opponent: "Guardas do Reino",
    preDialogue: { id:"c1b1-pre", title:"Portões de Camelot", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Camelot... Aguenta firme, Calem. Já estou chegando.", textType:"thought", overlayCaption:"Portões do Reino de Camelot" },
      { id:"p2", bg: BG.camelot, characters:[{id:"guard1",name:"Guarda",emotion:"normal",side:"left"},{id:"guard2",name:"Guarda",emotion:"normal",side:"right"}], speaker:"guard1", speakerName:"Guarda do Portão", text:"É ele! O fugitivo! Não deixem ele passar!", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Saiam da minha frente. Eu NÃO vou pedir duas vezes!", textType:"speech" },
    ]},
  },
  {
    id: "c1s5", number: 6, title: "O Refém", subtitle: "Cena 4", type: "scene",
    sceneData: { id: "c1s5", title: "O Refém", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Onde... onde estou?", textType:"speech", overlayCaption:"Salão do Trono — Castelo de Camelot" },
      { id:"p2", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Bem-vindo ao meu reino, garoto. Você é apenas uma peça no meu jogo.", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"arthur",name:"Rei Arthur",emotion:"normal",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Fehnon! Afinal, você chegou.", textType:"speech" },
      { id:"p4", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Solte o Calem. O que você quer, Arthur?!", textType:"speech" },
      { id:"p5", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Simples. Você conhece os Poderes Ultimates da estrela misteriosa. Me conte tudo.", textType:"speech" },
    ]},
  },
  {
    // ── Batalha com Diálogo: a recusa vira confronto direto ──
    id: "c1s6", number: 7, title: "Recusa e Confronto", subtitle: "Batalha + Cena", type: "battle",
    opponent: "Soldados de Elite",
    preDialogue: { id: "c1s6-pre", title: "Recusa e Confronto", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Não vou te contar nada!", textType:"speech" },
      { id:"p2", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"ARTHUR!!!", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Imprudente...! Soldados, acabem com ele!", textType:"speech" },
    ]},
    postDialogue: { id: "c1s6-post", title: "Recusa e Confronto", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"A sala está desabando!!", textType:"speech" },
      { id:"p2", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Segura em mim, Calem!", textType:"speech", overlayCaption:"Telhados do Reino de Camelot" },
    ]},
  },
  {
    id: "c1s7", number: 8, title: "Nos Telhados", subtitle: "Cena 5", type: "scene",
    sceneData: { id: "c1s7", title: "Nos Telhados", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Você está bem, Calem?", textType:"speech", overlayCaption:"Telhados do Reino de Camelot" },
      { id:"p2", bg: BG.camelot, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Raios roxos estão caindo do céu!!", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Sua escolha foi péssima, Fehnon. Vocês dois serão executados.", textType:"speech" },
      { id:"p4", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Surja, Mefisto! MEU ULTIMATE GUARDIAN!!", textType:"speech" },
      { id:"p5", bg: BG.camelot, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"},{id:"fehnon",name:"Fehnon",emotion:"happy",side:"left"}], speaker:"calem", speakerName:"Calem", text:"Fe-Fehnon?! Como você pode estar sorrindo agora?!", textType:"speech" },
      { id:"p6", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"happy",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Relaxa. Eu dou um jeito nesse cara. Porque eu também tenho minha Ultimate Gear... a Protonix Sword!!", textType:"speech" },
    ]},
  },
  {
    id:"c1boss", number:9, title:"Mefisto — O Guardião", subtitle:"Boss Battle", type:"boss",
    opponent: "Rei Arthur",
  },
  {
    id: "c1s8", number: 10, title: "A Revelação", subtitle: "Cena Final", type: "scene",
    sceneData: { id: "c1s8", title: "A Revelação", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Desapareça, Mefisto!", textType:"speech" },
      { id:"p2", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Como... meu Mefisto está sendo machucado?!", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"happy",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Conseguimos! Fehnon, você é incrível!", textType:"speech" },
      { id:"p4", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Heh... Vocês acham que ganharam? Eu ainda tenho... uma carta na manga.", textType:"speech" },
      { id:"p5", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Uma carta na manga...?! O quê?!", textType:"speech" },
      { id:"p6", bg: BG.camelot, characters:[], speaker:"narrator", speakerName:"", text:"— A ser continuado no Capítulo 2 —", textType:"narrator", overlayCaption:"Fim do Capítulo 1" },
    ]},
  },
]

// ─── Recompensas: estrelas, drops de fase e baús de capítulo ─────────────────

/** Estrelas concedidas ao concluir cada tipo de fase. */
const STAGE_STARS: Record<Stage["type"], number> = { scene: 1, battle: 2, boss: 3 }

/** Drops de primeira conclusão por tipo de fase. */
interface StageDropTable { gear: number; gacha: number; galio: number }
const STAGE_DROPS: Record<Stage["type"], StageDropTable> = {
  scene:  { gear: 50,  gacha: 0,  galio: 0 },
  battle: { gear: 120, gacha: 30, galio: 2 },
  boss:   { gear: 300, gacha: 80, galio: 5 },
}

const TOTAL_STARS = CHAPTER1_STAGES.reduce((sum, s) => sum + STAGE_STARS[s.type], 0)

interface ChapterChest {
  id: string
  stars: number
  label: string
  rewards: { gacha?: number; gear?: number; galio?: number }
}

const CHAPTER_CHESTS: ChapterChest[] = [
  { id: "c1chest1", stars: 4,  label: "Baú de Bronze", rewards: { gacha: 150 } },
  { id: "c1chest2", stars: 9,  label: "Baú de Prata",  rewards: { gear: 300, galio: 10 } },
  { id: "c1chest3", stars: TOTAL_STARS, label: "Baú de Ouro", rewards: { gacha: 500, gear: 500 } },
]

const GALIO_IMG = "/images/fragments/fragmento-galio.png"
const BOSS_IMG  = "/images/mefisto-foles.png"

/** Custo de stamina da Varredura (Sweep) por tipo de fase. */
const SWEEP_COST: Record<"battle" | "boss", number> = { battle: 5, boss: 10 }

/** Calcula a avaliação (1–3 estrelas) de uma batalha com base no LP restante. */
function computeBattleRating(lpLeft: number | undefined, lpMax: number): number {
  if (lpLeft == null || !Number.isFinite(lpLeft)) return 3
  if (lpLeft >= lpMax * 0.7)  return 3
  if (lpLeft >= lpMax * 0.35) return 2
  return 1
}

/** Fileira de 3 estrelas de desempenho (batalhas). */
function RatingStars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div style={{ display:"flex", gap:2, justifyContent:"center" }} aria-label={`${rating} de 3 estrelas`}>
      {[1,2,3].map(i => (
        <Star key={i} size={size}
          color={i <= rating ? "#facc15" : "rgba(255,255,255,0.30)"}
          fill={i <= rating ? "#facc15" : "transparent"}
          style={i <= rating ? { filter:"drop-shadow(0 0 3px rgba(250,204,21,0.7))" } : undefined}/>
      ))}
    </div>
  )
}

// ─── Preloader ────────────────────────────────────────────────────────────────

function usePreloadImages(urls: string[]) {
  const loaded = useRef<Set<string>>(new Set())
  useEffect(() => {
    urls.forEach(url => {
      if (loaded.current.has(url)) return
      const img = new window.Image()
      img.src = url
      img.onload = () => loaded.current.add(url)
    })
  }, []) // eslint-disable-line
}

// ─── Scene Viewer ─────────────────────────────────────────────────────────────

function SceneViewer({ scene, onComplete }: { scene: Scene; onComplete: () => void }) {
  const [idx, setIdx] = useState(0)
  const [fading, setFading] = useState(false)

  // Guard: clamp idx so panel is never undefined
  const safeIdx = Math.min(idx, scene.panels.length - 1)
  const panel   = scene.panels[safeIdx]
  const isLast  = safeIdx >= scene.panels.length - 1

  useEffect(() => {
    if (idx >= scene.panels.length) { onComplete() }
  }, [idx, scene.panels.length, onComplete])

  const advance = useCallback(() => {
    if (fading) return
    if (isLast) { onComplete(); return }
    setFading(true)
    setTimeout(() => { setIdx(i => i + 1); setFading(false) }, 140)
  }, [fading, isLast, onComplete])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (["Space","Enter","ArrowRight"].includes(e.code)) advance() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [advance])

  if (!panel) return null

  const isNarrator = panel.speaker === "narrator" || panel.textType === "narrator"
  const left  = panel.characters.find(c => c.side === "left")
  const right = panel.characters.find(c => c.side === "right")
  const isLeftSpeaking  = !!left  && panel.speaker === left.id
  const isRightSpeaking = !!right && panel.speaker === right.id

  const nameBg = (id?: CharacterId | "narrator") => {
    if (id === "arthur") return "linear-gradient(135deg,#7f1d1d,#991b1b)"
    if (id === "fehnon") return "linear-gradient(135deg,#1e3a8a,#2563eb)"
    return "linear-gradient(135deg,#1f2937,#374151)"
  }

  const charFilter = (isSpeaking: boolean) => {
    if (isNarrator) return "none"
    return isSpeaking ? "none" : "brightness(0.40) saturate(0.3)"
  }

  return (
    <div
      onClick={advance}
      style={{ position:"fixed", inset:0, zIndex:200, background:"#000",
        userSelect:"none", cursor:"pointer", fontFamily:"'Segoe UI',system-ui,sans-serif", overflow:"hidden" }}
    >
      <div style={{ position:"absolute", inset:0, backgroundImage:`url(${panel.bg})`,
        backgroundSize:"cover", backgroundPosition:"center", filter:"brightness(0.70)" }}/>
      <div style={{ position:"absolute", inset:0,
        background:"linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.0) 42%, rgba(0,0,0,0.10) 100%)" }}/>

      {/* Top HUD */}
      <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:30,
        display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <BookOpen size={14} color="rgba(255,255,255,0.55)"/>
          <span style={{ color:"rgba(255,255,255,0.70)", fontSize:13, fontWeight:700 }}>{scene.title}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", gap:4 }}>
            {scene.panels.map((_,i) => (
              <div key={i} style={{ width: i===idx ? 16 : 5, height:4, borderRadius:99,
                background: i===idx ? "#8b5cf6" : i<idx ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.18)",
                transition:"width 0.3s" }}/>
            ))}
          </div>
          <button onClick={e=>{ e.stopPropagation(); onComplete() }}
            style={{ background:"rgba(0,0,0,0.55)", border:"1px solid rgba(255,255,255,0.18)",
              borderRadius:7, padding:"5px 12px", color:"rgba(255,255,255,0.70)",
              fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
            <SkipForward size={11}/> Pular
          </button>
        </div>
      </div>

      {panel.overlayCaption && (
        <div style={{ position:"absolute", top:52, left:20, zIndex:30,
          background:"rgba(0,0,0,0.72)", borderLeft:"3px solid #8b5cf6", padding:"5px 14px" }}>
          <span style={{ color:"#e2e8f0", fontSize:11, fontStyle:"italic" }}>{panel.overlayCaption}</span>
        </div>
      )}

      {left && (
        <img src={charImg(left.id, left.emotion)} alt={left.name}
          style={{ position:"absolute", bottom:126, left:0,
            height:"calc(100vh - 174px)", width:"auto", maxWidth:"48%",
            objectFit:"contain", objectPosition:"bottom", pointerEvents:"none",
            opacity: fading ? 0 : 1, transition:"opacity 0.14s ease",
            filter: charFilter(isLeftSpeaking), zIndex:10, display:"block" }}/>
      )}

      {right && (
        <img src={charImg(right.id, right.emotion)} alt={right.name}
          style={{ position:"absolute", bottom:126, right:0,
            height:"calc(100vh - 174px)", width:"auto", maxWidth:"48%",
            objectFit:"contain", objectPosition:"bottom", transform:"scaleX(-1)",
            pointerEvents:"none", opacity: fading ? 0 : 1, transition:"opacity 0.14s ease",
            filter: charFilter(isRightSpeaking), zIndex:10, display:"block" }}/>
      )}

      {/* Dialogue box */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:40,
        opacity: fading ? 0 : 1, transition:"opacity 0.14s ease" }}>
        {isNarrator ? (
          <div style={{ margin:"0 14px 18px",
            background:"rgba(0,0,0,0.82)", border:"1px solid rgba(139,92,246,0.35)",
            borderLeft:"4px solid #8b5cf6", borderRadius:10, padding:"14px 18px",
            backdropFilter:"blur(10px)" }}>
            <p style={{ color:"#d1d5db", fontSize:14, fontStyle:"italic", lineHeight:1.75, margin:0 }}>
              {panel.text}
            </p>
          </div>
        ) : (
          <div style={{ background:"rgba(4,8,18,0.92)", borderTop:"1px solid rgba(255,255,255,0.12)",
            borderRadius:"14px 14px 0 0", backdropFilter:"blur(14px)", minHeight:120 }}>
            {panel.speakerName && (
              <div style={{ display:"inline-block", marginLeft:20, marginTop:-1,
                background: nameBg(panel.speaker), padding:"5px 18px 6px", borderRadius:"0 0 9px 9px" }}>
                <span style={{ color:"#fff", fontWeight:900, fontSize:13, letterSpacing:"0.04em" }}>
                  {panel.speakerName}
                </span>
              </div>
            )}
            <div style={{ padding:"10px 22px 0" }}>
              <p style={{ color:"#f1f5f9", fontSize:15, lineHeight:1.8, margin:0,
                fontStyle: panel.textType==="thought" ? "italic" : undefined, letterSpacing:"0.01em" }}>
                {panel.textType==="thought" && <span style={{color:"#93c5fd"}}>‟ </span>}
                {panel.text}
                {panel.textType==="thought" && <span style={{color:"#93c5fd"}}> „</span>}
              </p>
            </div>
            <div style={{ textAlign:"right", paddingRight:22, paddingTop:6, paddingBottom:18 }}>
              <span style={{ color:"rgba(255,255,255,0.28)", fontSize:11, letterSpacing:"0.1em",
                animation:"blink 1.2s ease-in-out infinite" }}>
                {isLast ? "▶ Continuar" : "▶ Avançar"}
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:.22} 50%{opacity:0.9} }`}</style>
    </div>
  )
}

// ─── Drop Row (linha de recompensa nos pop-ups) ───────────────────────────────

function DropRow({ kind, amount, obtained }: { kind: "gear" | "gacha" | "galio" | "star"; amount: number; obtained?: boolean }) {
  const meta = {
    gear:  { label: "Ouro (Gear Coins)",     color: "#fbbf24" },
    gacha: { label: "Moedas de Gacha",       color: "#c084fc" },
    galio: { label: "Fragmentos de Gálio",   color: "#e2e8f0" },
    star:  { label: "Estrelas de Capítulo",  color: "#facc15" },
  }[kind]

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
      borderRadius:10, padding:"8px 12px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
        {kind === "gear"  && <Coins size={16} color={meta.color}/>}
        {kind === "gacha" && <Gem size={16} color={meta.color}/>}
        {kind === "star"  && <Star size={16} color={meta.color} fill={meta.color}/>}
        {kind === "galio" && (
          <img src={GALIO_IMG || "/placeholder.svg"} alt="" aria-hidden="true"
            style={{ width:18, height:18, objectFit:"contain" }}
            onError={e => { e.currentTarget.style.display = "none" }}/>
        )}
        <span style={{ color:"#cbd5e1", fontSize:12, fontWeight:600 }}>{meta.label}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ color:meta.color, fontWeight:900, fontSize:13 }}>x{amount}</span>
        {obtained && <Check size={14} color="#4ade80"/>}
      </div>
    </div>
  )
}

// ─── Stage Info Pop-up (drops da fase) ────────────────────────────────────────

function StageInfoModal({
  stage, completed, battleRating, stamina, onPlay, onSweep, onClose,
}: {
  stage: Stage; completed: boolean; battleRating: number; stamina: number
  onPlay: () => void; onSweep: () => void; onClose: () => void
}) {
  const drops = STAGE_DROPS[stage.type]
  const stars = STAGE_STARS[stage.type]
  const isBattle = stage.type === "battle" || stage.type === "boss"
  const sweepCost   = isBattle ? SWEEP_COST[stage.type as "battle" | "boss"] : 0
  const sweepReady  = isBattle && completed && battleRating >= 3
  const sweepCanPay = stamina >= sweepCost
  const typeMeta = {
    scene:  { label: "Cena de História", color: "#c4b5fd", bg: "rgba(124,58,237,0.14)" },
    battle: { label: stage.preDialogue ? "Batalha com Diálogo" : "Batalha", color: "#93c5fd", bg: "rgba(37,99,235,0.14)" },
    boss:   { label: "Boss Battle", color: "#fca5a5", bg: "rgba(220,38,38,0.14)" },
  }[stage.type]

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:250,
      background:"rgba(0,0,0,0.72)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:360,
        background:"linear-gradient(165deg,#0a1120,#060b16)",
        border:"1px solid rgba(255,255,255,0.10)", borderRadius:18,
        padding:"18px 18px 16px", boxShadow:"0 20px 60px rgba(0,0,0,0.6)", position:"relative" }}>

        <button onClick={onClose} aria-label="Fechar"
          style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.06)",
            border:"1px solid rgba(255,255,255,0.10)", borderRadius:8, width:28, height:28,
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <X size={14} color="#94a3b8"/>
        </button>

        <div style={{ display:"inline-block", background:typeMeta.bg, borderRadius:8,
          padding:"3px 10px", marginBottom:8 }}>
          <span style={{ color:typeMeta.color, fontSize:10, fontWeight:900,
            letterSpacing:"0.1em", textTransform:"uppercase" }}>{typeMeta.label}</span>
        </div>

        <h3 style={{ color:"#f1f5f9", fontWeight:900, fontSize:18, margin:"0 0 2px" }}>{stage.title}</h3>
        <p style={{ color:"#64748b", fontSize:11, margin:"0 0 10px" }}>
          {stage.subtitle}{isBattle && stage.opponent ? ` — vs ${stage.opponent}` : ""}
          {completed ? "  ·  Concluída" : ""}
        </p>

        {isBattle && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12,
            background:"rgba(250,204,21,0.06)", border:"1px solid rgba(250,204,21,0.18)",
            borderRadius:10, padding:"7px 12px" }}>
            <RatingStars rating={completed ? battleRating : 0} size={16}/>
            <span style={{ color:"#94a3b8", fontSize:11, fontWeight:600 }}>
              {completed
                ? (battleRating >= 3 ? "Desempenho perfeito!" : `Desempenho: ${battleRating}/3 — vença com mais LP para melhorar`)
                : "Vença mantendo seu LP alto para ganhar até 3 estrelas"}
            </span>
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
          <Gift size={13} color="#a78bfa"/>
          <span style={{ color:"#a78bfa", fontSize:11, fontWeight:800,
            letterSpacing:"0.08em", textTransform:"uppercase" }}>
            {completed ? "Recompensas obtidas" : "Drops desta fase"}
          </span>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
          <DropRow kind="star" amount={stars} obtained={completed}/>
          {drops.gear  > 0 && <DropRow kind="gear"  amount={drops.gear}  obtained={completed}/>}
          {drops.gacha > 0 && <DropRow kind="gacha" amount={drops.gacha} obtained={completed}/>}
          {drops.galio > 0 && <DropRow kind="galio" amount={drops.galio} obtained={completed}/>}
        </div>

        {completed && (
          <p style={{ color:"#475569", fontSize:10, margin:"0 0 12px", fontStyle:"italic" }}>
            Recompensas de primeira conclusão já coletadas. Você pode rejogar a fase.
          </p>
        )}

        <button onClick={onPlay} style={{ width:"100%", padding:"13px 0", borderRadius:12,
          border:"none", cursor:"pointer",
          background: stage.type === "boss"
            ? "linear-gradient(135deg,#7f1d1d,#dc2626)"
            : stage.type === "battle"
            ? "linear-gradient(135deg,#1e3a8a,#3b82f6)"
            : "linear-gradient(135deg,#4c1d95,#7c3aed)",
          color:"#fff", fontWeight:900, fontSize:14,
          display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Play size={15}/>
          {completed
            ? (isBattle ? "Batalhar novamente" : "Reassistir cena")
            : (isBattle ? "Iniciar" : "Assistir cena")}
        </button>

        {sweepReady && (
          <>
            <button onClick={onSweep} disabled={!sweepCanPay}
              style={{ width:"100%", padding:"11px 0", borderRadius:12, marginTop:8,
                border:`1px solid ${sweepCanPay ? "rgba(250,204,21,0.45)" : "rgba(255,255,255,0.08)"}`,
                cursor: sweepCanPay ? "pointer" : "default",
                background: sweepCanPay ? "rgba(250,204,21,0.10)" : "rgba(255,255,255,0.04)",
                color: sweepCanPay ? "#fde047" : "#475569",
                fontWeight:900, fontSize:13,
                display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <FastForward size={14}/>
              Varrer (coleta instantânea)
              <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:11,
                color: sweepCanPay ? "#a3e635" : "#dc2626", fontWeight:800 }}>
                <Zap size={11}/> -{sweepCost}
              </span>
            </button>
            <p style={{ color:"#57534e", fontSize:9, margin:"6px 0 0", textAlign:"center", fontStyle:"italic" }}>
              {sweepCanPay
                ? "Liberado por ter 3 estrelas: receba os drops sem jogar a batalha."
                : "Stamina insuficiente para varrer esta fase."}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Chest Claim Pop-up ───────────────────────────────────────────────────────

function ChestClaimModal({
  chest, canClaim, claimed, onClaim, onClose,
}: { chest: ChapterChest; canClaim: boolean; claimed: boolean; onClaim: () => void; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:250,
      background:"rgba(0,0,0,0.72)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:340,
        background:"linear-gradient(165deg,#151007,#0b0803)",
        border:"1px solid rgba(234,179,8,0.30)", borderRadius:18,
        padding:"22px 18px 18px", textAlign:"center",
        boxShadow:"0 20px 60px rgba(0,0,0,0.6)", position:"relative" }}>

        <button onClick={onClose} aria-label="Fechar"
          style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.06)",
            border:"1px solid rgba(255,255,255,0.10)", borderRadius:8, width:28, height:28,
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <X size={14} color="#94a3b8"/>
        </button>

        <div style={{ width:64, height:64, borderRadius:"50%", margin:"0 auto 10px",
          background: claimed ? "rgba(34,197,94,0.12)" : "rgba(234,179,8,0.14)",
          border:`2px solid ${claimed ? "rgba(34,197,94,0.5)" : "rgba(234,179,8,0.5)"}`,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          {claimed ? <Check size={28} color="#4ade80"/> : <Gift size={28} color="#fbbf24"/>}
        </div>

        <h3 style={{ color:"#fbbf24", fontWeight:900, fontSize:17, margin:"0 0 2px" }}>{chest.label}</h3>
        <p style={{ color:"#78716c", fontSize:11, margin:"0 0 14px", display:"flex",
          alignItems:"center", justifyContent:"center", gap:4 }}>
          <Star size={11} color="#facc15" fill="#facc15"/> Requer {chest.stars} estrelas no capítulo
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16, textAlign:"left" }}>
          {chest.rewards.gacha ? <DropRow kind="gacha" amount={chest.rewards.gacha} obtained={claimed}/> : null}
          {chest.rewards.gear  ? <DropRow kind="gear"  amount={chest.rewards.gear}  obtained={claimed}/> : null}
          {chest.rewards.galio ? <DropRow kind="galio" amount={chest.rewards.galio} obtained={claimed}/> : null}
        </div>

        {claimed ? (
          <p style={{ color:"#4ade80", fontSize:12, fontWeight:800, margin:0 }}>Recompensas coletadas!</p>
        ) : (
          <button onClick={onClaim} disabled={!canClaim}
            style={{ width:"100%", padding:"13px 0", borderRadius:12, border:"none",
              background: canClaim ? "linear-gradient(135deg,#a16207,#eab308)" : "rgba(255,255,255,0.06)",
              color: canClaim ? "#1a1206" : "#475569",
              fontWeight:900, fontSize:14, cursor: canClaim ? "pointer" : "default",
              boxShadow: canClaim ? "0 6px 22px rgba(234,179,8,0.35)" : "none" }}>
            {canClaim ? "Coletar Recompensas" : "Bloqueado — junte mais estrelas"}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Chapter Chest Progress Bar ───────────────────────────────────────────────

function ChestProgressBar({
  earnedStars, claimed, onChestPress,
}: { earnedStars: number; claimed: Set<string>; onChestPress: (chest: ChapterChest) => void }) {
  const pct = Math.min(100, (earnedStars / TOTAL_STARS) * 100)

  return (
    <div style={{ position:"absolute", bottom:62, left:"50%", transform:"translateX(-50%)",
      zIndex:50, width:"min(480px, 92vw)",
      background:"rgba(2,6,16,0.90)", border:"1px solid rgba(255,255,255,0.09)",
      borderRadius:16, padding:"10px 16px 14px", backdropFilter:"blur(14px)",
      boxShadow:"0 6px 26px rgba(0,0,0,0.5)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <Gift size={13} color="#fbbf24"/>
          <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:900, letterSpacing:"0.04em" }}>
            Baús do Capítulo
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <Star size={12} color="#facc15" fill="#facc15"/>
          <span style={{ color:"#facc15", fontWeight:900, fontSize:12 }}>
            {earnedStars}<span style={{ color:"#57534e", fontWeight:600, fontSize:10 }}>/{TOTAL_STARS}</span>
          </span>
        </div>
      </div>

      {/* Track + chests */}
      <div style={{ position:"relative", height:34, marginTop:2 }}>
        <div style={{ position:"absolute", top:"50%", left:0, right:0, height:7,
          transform:"translateY(-50%)", borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, borderRadius:99,
            background:"linear-gradient(90deg,#a16207,#facc15)",
            boxShadow:"0 0 10px rgba(250,204,21,0.5)", transition:"width 0.6s" }}/>
        </div>

        {CHAPTER_CHESTS.map(chest => {
          const chestPct  = (chest.stars / TOTAL_STARS) * 100
          const isClaimed = claimed.has(chest.id)
          const isReady   = !isClaimed && earnedStars >= chest.stars
          return (
            <button key={chest.id} onClick={() => onChestPress(chest)}
              aria-label={`${chest.label} — ${chest.stars} estrelas`}
              style={{ position:"absolute", top:"50%", left:`${chestPct}%`,
                transform:"translate(-50%,-50%)",
                width:34, height:34, borderRadius:"50%", cursor:"pointer",
                background: isClaimed ? "rgba(20,83,45,0.92)" : isReady ? "rgba(120,80,7,0.95)" : "rgba(12,16,28,0.95)",
                border:`2px solid ${isClaimed ? "#22c55e" : isReady ? "#facc15" : "#334155"}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: isReady ? "0 0 16px rgba(250,204,21,0.65)" : "0 2px 8px rgba(0,0,0,0.5)",
                animation: isReady ? "chestBounce 1.4s ease-in-out infinite" : undefined }}>
              {isClaimed
                ? <Check size={15} color="#4ade80"/>
                : isReady
                ? <Gift size={15} color="#fde047"/>
                : <Lock size={13} color="#475569"/>}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes chestBounce {
          0%, 100% { transform: translate(-50%,-50%) scale(1); }
          50%      { transform: translate(-50%,-52%) scale(1.12); }
        }
      `}</style>
    </div>
  )
}

// ─── Battle Intro ─────────────────────────────────────────────────────────────

function BattleIntroScreen({ stage, onStart, onBack }: { stage:Stage; onStart:()=>void; onBack:()=>void }) {
  const { stamina, maxStamina } = useGame()
  const isBoss = stage.type === "boss"
  const lp = isBoss ? 30 : 20
  const staminaCost = isBoss ? 10 : 5
  const hasEnoughStamina = stamina >= staminaCost  // display-only, never blocks launch
  const staminaPct = Math.min(100, (stamina / maxStamina) * 100)

  const handleStart = () => {
    onStart()  // always allowed — stamina is informational only in story mode
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200,
      background:"linear-gradient(160deg,#020610 0%,#050d1a 50%,#030a14 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f1f5f9" }}>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background: isBoss
          ? "radial-gradient(ellipse 60% 40% at 50% 50%,rgba(220,38,38,0.18) 0%,transparent 70%)"
          : "radial-gradient(ellipse 60% 40% at 50% 50%,rgba(37,99,235,0.15) 0%,transparent 70%)" }}/>
      <div style={{ textAlign:"center", position:"relative", zIndex:1, padding:"0 24px" }}>
        <div style={{ fontSize:52, marginBottom:14 }}>{isBoss ? "💀" : "⚔️"}</div>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.15em",
          color: isBoss?"#f87171":"#60a5fa", textTransform:"uppercase",
          background: isBoss?"rgba(220,38,38,0.12)":"rgba(37,99,235,0.12)",
          padding:"4px 14px", borderRadius:8, display:"inline-block", marginBottom:8 }}>
          {isBoss ? "Boss Battle" : "Batalha"}
        </div>
        <h1 style={{ fontWeight:900, fontSize:22, margin:"8px 0 16px" }}>{stage.title}</h1>
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:14, padding:"14px 20px", marginBottom:16, maxWidth:300 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ color:"#64748b", fontSize:12 }}>LP de partida</span>
            <span style={{ color:isBoss?"#f87171":"#60a5fa", fontWeight:900, fontSize:14 }}>{lp} LP</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:"#64748b", fontSize:12 }}>Oponente</span>
            <span style={{ color:"#94a3b8", fontSize:12, fontWeight:700 }}>
              {stage.opponent ?? (isBoss ? "Rei Arthur" : "Guardas do Reino")}
            </span>
          </div>
        </div>
        <div style={{
          background: hasEnoughStamina ? "rgba(3,20,10,0.80)" : "rgba(40,0,0,0.60)",
          border: `1px solid ${hasEnoughStamina ? "rgba(16,185,129,0.30)" : "rgba(239,68,68,0.40)"}`,
          borderRadius:14, padding:"14px 20px", marginBottom:24, maxWidth:300 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ color:"#64748b", fontSize:12 }}>Custo de Stamina</span>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ color: hasEnoughStamina ? "#34d399" : "#f87171", fontWeight:900, fontSize:16 }}>
                -{staminaCost}
              </span>
              <span style={{ color:"#475569", fontSize:11 }}>STAMINA</span>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ color:"#64748b", fontSize:11 }}>Sua Stamina</span>
            <span style={{ color: hasEnoughStamina ? "#6ee7b7" : "#f87171", fontWeight:700, fontSize:12 }}>
              {stamina}/{maxStamina}
            </span>
          </div>
          <div style={{ height:6, borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:99, width:`${staminaPct}%`,
              background: hasEnoughStamina
                ? "linear-gradient(90deg,#059669,#10b981)"
                : "linear-gradient(90deg,#dc2626,#ef4444)",
              boxShadow: hasEnoughStamina ? "0 0 6px rgba(16,185,129,0.5)" : "0 0 6px rgba(239,68,68,0.5)",
              transition:"width 0.5s" }}/>
          </div>

        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onBack} style={{ padding:"11px 22px", borderRadius:11,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)",
            color:"#64748b", fontWeight:800, fontSize:13, cursor:"pointer" }}>Voltar</button>
          <button onClick={handleStart} disabled={false}
            style={{ padding:"11px 28px", borderRadius:11, border:"none",
               background: isBoss ? "linear-gradient(135deg,#7f1d1d,#dc2626)" : "linear-gradient(135deg,#1e3a8a,#3b82f6)",
               color: "#fff",
              fontWeight:900, fontSize:14,
              cursor: "pointer",
               boxShadow: isBoss ? "0 6px 20px rgba(220,38,38,0.35)" : "0 6px 20px rgba(59,130,246,0.35)",
              transition:"all 0.2s" }}>
            {isBoss ? "⚔️ Batalha Final!" : "⚔️ Iniciar Batalha!"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Post-Battle Result ────────────────────────────────────────────────────────

function PostBattleScreen({
  won, rewards, onReturnStory, onContinue,
}: { won:boolean; rewards: StageDropTable | null; onReturnStory:()=>void; onContinue:()=>void }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(16px)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f1f5f9" }}>
      <div style={{ textAlign:"center", padding:"0 24px", width:"100%", maxWidth:340 }}>
        <div style={{ fontSize:56, marginBottom:16 }}>{won ? "🏆" : "💀"}</div>
        <h2 style={{ fontWeight:900, fontSize:24, margin:"0 0 8px" }}>{won ? "Vitória!" : "Derrota..."}</h2>
        <p style={{ color:"#64748b", fontSize:14, margin:"0 0 20px" }}>
          {won ? "Batalha concluída com sucesso." : "Você foi derrotado. Tente novamente."}
        </p>

        {won && rewards && (
          <div style={{ marginBottom:24, textAlign:"left" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, justifyContent:"center" }}>
              <Gift size={13} color="#a78bfa"/>
              <span style={{ color:"#a78bfa", fontSize:11, fontWeight:800,
                letterSpacing:"0.08em", textTransform:"uppercase" }}>Recompensas obtidas</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {rewards.gear  > 0 && <DropRow kind="gear"  amount={rewards.gear}  obtained/>}
              {rewards.gacha > 0 && <DropRow kind="gacha" amount={rewards.gacha} obtained/>}
              {rewards.galio > 0 && <DropRow kind="galio" amount={rewards.galio} obtained/>}
            </div>
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:12, alignItems:"center" }}>
          {won && (
            <button onClick={onContinue} style={{ width:260, padding:"15px 0", borderRadius:14, border:"none",
              background:"linear-gradient(135deg,#4c1d95,#7c3aed)", color:"#fff",
              fontWeight:900, fontSize:15, cursor:"pointer",
              boxShadow:"0 6px 24px rgba(124,58,237,0.40)" }}>
              ▶ Continuar História
            </button>
          )}
          <button onClick={onReturnStory} style={{ width:260, padding:"13px 0", borderRadius:14,
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)",
            color:"#94a3b8", fontWeight:800, fontSize:14, cursor:"pointer" }}>
            ← Voltar ao Story Mode
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reward Toast (cenas) ─────────────────────────────────────────────────────

function RewardToast({ drops, stars }: { drops: StageDropTable; stars: number }) {
  return (
    <div style={{ position:"fixed", top:70, left:"50%", transform:"translateX(-50%)",
      zIndex:260, background:"rgba(2,6,16,0.94)", border:"1px solid rgba(250,204,21,0.35)",
      borderRadius:14, padding:"10px 18px", display:"flex", alignItems:"center", gap:14,
      backdropFilter:"blur(12px)", boxShadow:"0 8px 30px rgba(0,0,0,0.6)",
      animation:"toastIn 0.3s ease", fontFamily:"'Segoe UI',system-ui,sans-serif", whiteSpace:"nowrap" }}>
      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
        <Star size={14} color="#facc15" fill="#facc15"/>
        <span style={{ color:"#facc15", fontWeight:900, fontSize:13 }}>+{stars}</span>
      </div>
      {drops.gear > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <Coins size={14} color="#fbbf24"/>
          <span style={{ color:"#fbbf24", fontWeight:900, fontSize:13 }}>+{drops.gear}</span>
        </div>
      )}
      {drops.gacha > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <Gem size={14} color="#c084fc"/>
          <span style={{ color:"#c084fc", fontWeight:900, fontSize:13 }}>+{drops.gacha}</span>
        </div>
      )}
      <span style={{ color:"#94a3b8", fontSize:11, fontWeight:700 }}>Recompensas coletadas!</span>
      <style>{`@keyframes toastIn { from { opacity:0; transform:translate(-50%,-8px) } to { opacity:1; transform:translate(-50%,0) } }`}</style>
    </div>
  )
}


// ─── Board Map: Node Definitions ─────────────────────────────────────────────
//
//  Positions (x, y) = percentage of viewport.
//  Path: Início (Calem's house, bottom-left) → ruins → Camelot → colosseum (top).
//  World image: /public/images/gearperks-world.png

interface MapNodeDef {
  stageId:  string | null
  type:     "start" | "scene" | "battle" | "boss"
  label:    string
  sublabel: string | null
  x: number
  y: number
}

const MAP_NODES: MapNodeDef[] = [
  { stageId: null,      type: "start",  label: "Início",             sublabel: null,             x: 22,  y: 83 },
  { stageId: "c1s1",   type: "scene",  label: "O Encontro",         sublabel: "Cena 1",         x: 20,  y: 71 },
  { stageId: "c1s2",   type: "battle", label: "A Fuga",             sublabel: "Batalha + Cena", x: 16,  y: 59 },
  { stageId: "c1s3",   type: "scene",  label: "As Ruínas",          sublabel: "Cena 2",         x: 26,  y: 47 },
  { stageId: "c1s4",   type: "scene",  label: "A Rachadura",        sublabel: "Cena 3",         x: 38,  y: 53 },
  { stageId: "c1b1",   type: "battle", label: "Portões de Camelot", sublabel: "Batalha",        x: 50,  y: 66 },
  { stageId: "c1s5",   type: "scene",  label: "O Refém",            sublabel: "Cena 4",         x: 56,  y: 54 },
  { stageId: "c1s6",   type: "battle", label: "Recusa e Confronto", sublabel: "Batalha + Cena", x: 60,  y: 41 },
  { stageId: "c1s7",   type: "scene",  label: "Nos Telhados",       sublabel: "Cena 5",         x: 61,  y: 29 },
  { stageId: "c1boss", type: "boss",   label: "Mefisto",            sublabel: "Boss Battle",    x: 59,  y: 17 },
  { stageId: "c1s8",   type: "scene",  label: "A Revelação",        sublabel: "Cena Final",     x: 55,  y: 6  },
]


// ─── Board Map View (static — no zoom/pan) ───────────────────────────────────

function StoryMapView({
  stages, completedIds, battleStars, onPress, onBack, stamina, maxStamina, staminaNextTickSeconds,
  earnedStars, claimedChests, onChestPress,
}: {
  stages: Stage[]
  completedIds: Set<string>
  battleStars: Record<string, number>
  onPress: (stage: Stage) => void
  onBack: () => void
  stamina: number
  maxStamina: number
  staminaNextTickSeconds: number
  earnedStars: number
  claimedChests: Set<string>
  onChestPress: (chest: ChapterChest) => void
}) {
  const [vw, setVw] = useState(() => typeof window !== "undefined" ? window.innerWidth  : 1024)
  const [vh, setVh] = useState(() => typeof window !== "undefined" ? window.innerHeight : 768)

  useEffect(() => {
    const h = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener("resize", h)
    return () => window.removeEventListener("resize", h)
  }, [])

  const px = (pct: number) => (pct / 100) * vw
  const py = (pct: number) => (pct / 100) * vh

  const done          = stages.filter(s => completedIds.has(s.id)).length
  const total         = stages.length
  const progPct       = Math.round((done / total) * 100)
  const isChapterDone = done === total

  const nextStageId = (() => {
    for (let i = 0; i < stages.length; i++) {
      if (completedIds.has(stages[i].id)) continue
      if (i === 0 || completedIds.has(stages[i - 1].id)) return stages[i].id
    }
    return null
  })()

  const lastCompletedId = (() => {
    for (let i = stages.length - 1; i >= 0; i--) {
      if (completedIds.has(stages[i].id)) return stages[i].id
    }
    return null
  })()
  const playerNodeId = lastCompletedId ?? null

  const isAccessible = (stageId: string) => {
    const idx = stages.findIndex(s => s.id === stageId)
    return idx === 0 || (idx > 0 && completedIds.has(stages[idx - 1].id))
  }

  return (
    <div style={{ position:"fixed", inset:0, overflow:"hidden",
      fontFamily:"'Segoe UI',system-ui,sans-serif" }}>

      {/* ── World background ── */}
      <img
        src="/images/gearperks-world.png"
        alt="" aria-hidden="true"
        onError={(e) => {
          const t = e.currentTarget
          if (t.dataset.fallback) return
          t.dataset.fallback = "1"
          t.src = "/images/gearperks-word.png"
        }}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%",
          objectFit:"cover", objectPosition:"center top", pointerEvents:"none" }}
      />

      {/* Overlay */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background:"linear-gradient(160deg,rgba(3,6,14,0.38) 0%,rgba(3,6,14,0.14) 50%,rgba(3,6,14,0.46) 100%)" }}/>

      {/* ── SVG path lines ── */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%",
        pointerEvents:"none", zIndex:5, overflow:"visible" }}>
        {MAP_NODES.slice(0, -1).map((node, i) => {
          const next = MAP_NODES[i + 1]
          const lit  = node.stageId === null ? true : completedIds.has(node.stageId)
          const x1=px(node.x), y1=py(node.y), x2=px(next.x), y2=py(next.y)
          return (
            <g key={`seg-${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(0,0,0,0.55)" strokeWidth={7} strokeLinecap="round"
                strokeDasharray={lit ? undefined : "16 9"} opacity={lit ? 1 : 0.5}/>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={lit ? "#8b5cf6" : "#3b0764"}
                strokeWidth={3} strokeLinecap="round"
                strokeDasharray={lit ? undefined : "16 9"} opacity={lit ? 0.95 : 0.4}/>
            </g>
          )
        })}
      </svg>

      {/* ── Map Nodes ── */}
      {MAP_NODES.map((nodeDef) => {
        const isStart     = nodeDef.stageId === null
        const stage       = isStart ? null : stages.find(s => s.id === nodeDef.stageId)
        const isCompleted = !isStart && !!stage && completedIds.has(nodeDef.stageId!)
        const accessible  = !isStart && isAccessible(nodeDef.stageId!)
        const isNext      = nodeDef.stageId === nextStageId
        const isPlayer    = isStart ? playerNodeId === null : nodeDef.stageId === playerNodeId

        const isBoss   = nodeDef.type === "boss"
        const isScene  = nodeDef.type === "scene"
        const isBattle = nodeDef.type === "battle"
        // Boss é maior para dar impacto; cenas são menores (apenas história)
        const size = isBoss ? 88 : isScene ? 50 : 64

        const rating   = !isStart && nodeDef.stageId ? (battleStars[nodeDef.stageId] ?? 0) : 0
        const canSweep = (isBattle || isBoss) && isCompleted && rating >= 3

        const palette = {
          start:  { bg:"#1e293b",                                 border:"#475569" },
          scene:  { bg:"linear-gradient(145deg,#3b0764,#5b21b6)", border:"#7c3aed" },
          battle: { bg:"linear-gradient(145deg,#172554,#1d4ed8)", border:"#2563eb" },
          boss:   { bg:"linear-gradient(145deg,#450a0a,#991b1b)", border:"#f59e0b" },
        }[nodeDef.type]

        const nodeBg = (!accessible && !isStart) ? "rgba(12,16,28,0.92)"
          : isCompleted && isScene ? "linear-gradient(145deg,#14532d,#166534)"
          : palette.bg
        const nodeBd = isPlayer ? "#38bdf8" : isNext ? "#22c55e"
          : (!accessible && !isStart) ? "#1e293b"
          : isCompleted && !isBoss ? "#22c55e"
          : palette.border
        const nodeGlow = isPlayer
          ? "0 0 24px rgba(56,189,248,0.7),0 6px 16px rgba(0,0,0,0.6)"
          : isNext
          ? "0 0 24px rgba(34,197,94,0.7),0 6px 16px rgba(0,0,0,0.6)"
          : isBoss && accessible
          ? "0 0 26px rgba(220,38,38,0.55),0 6px 16px rgba(0,0,0,0.6)"
          : "0 4px 14px rgba(0,0,0,0.55)"
        const subColor = { boss:"#fca5a5", battle:"#93c5fd", scene:"#c4b5fd", start:"#94a3b8" }[nodeDef.type]

        return (
          <div key={nodeDef.stageId ?? "start"} style={{
            position:"absolute", left:`${nodeDef.x}%`, top:`${nodeDef.y}%`,
            transform:"translate(-50%,-50%)", zIndex: isBoss ? 12 : 10,
            display:"flex", flexDirection:"column", alignItems:"center", gap:5,
          }}>
            {isNext && (
              <div style={{ background:"#16a34a", borderRadius:8, padding:"3px 9px",
                fontSize:10, fontWeight:900, color:"#fff", letterSpacing:".06em",
                whiteSpace:"nowrap", marginBottom:2,
                boxShadow:"0 2px 10px rgba(22,163,74,0.65)",
                animation:"storyBounce 1.6s ease-in-out infinite" }}>▶ PRÓXIMO</div>
            )}
            {isPlayer && (
              <div style={{ position:"absolute", top:"50%", left:"50%",
                transform:"translate(-50%,-50%)",
                width:size + 20, height:size + 20, borderRadius:"50%",
                border:"2px solid #38bdf8",
                animation:"storyPulseRing 1.8s ease-out infinite",
                pointerEvents:"none" }}/>
            )}
            <button
              onClick={() => accessible && !isStart && stage ? onPress(stage) : undefined}
              disabled={!accessible || isStart}
              aria-label={`${nodeDef.label}${isCompleted ? " — concluída" : !accessible && !isStart ? " — bloqueada" : ""}`}
              style={{
                width:size, height:size,
                borderRadius: isScene ? 14 : "50%",
                background:nodeBg, border:`${isBoss ? 4 : 3}px solid ${nodeBd}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:accessible && !isStart ? "pointer" : "default",
                boxShadow:nodeGlow,
                opacity:!accessible && !isStart ? 0.42 : 1,
                transition:"transform .15s", position:"relative", flexShrink:0, outline:"none",
                overflow:"visible", padding:0,
              }}
              onMouseEnter={e=>{ if(accessible&&!isStart)(e.currentTarget as HTMLButtonElement).style.transform="scale(1.10)" }}
              onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.transform="scale(1)" }}
            >
              {isPlayer && (
                <div style={{ position:"absolute", inset:-5, borderRadius: isScene ? 18 : "50%",
                  border:"2px solid #38bdf8", boxShadow:"0 0 12px rgba(56,189,248,0.9)",
                  pointerEvents:"none" }}/>
              )}

              {/* Conteúdo central do nó */}
              {isStart ? (
                <Home size={26} color="#94a3b8"/>
              ) : isBoss ? (
                <>
                  {/* Retrato do Mefisto dentro do círculo */}
                  <img src={BOSS_IMG || "/placeholder.svg"} alt="" aria-hidden="true"
                    onError={e => { e.currentTarget.style.display = "none" }}
                    style={{ position:"absolute", inset:0, width:"100%", height:"100%",
                      borderRadius:"50%", objectFit:"cover", objectPosition:"center top",
                      filter: !accessible ? "grayscale(1) brightness(0.35)" : "none" }}/>
                  {!accessible && (
                    <Lock size={26} color="#94a3b8" style={{ position:"relative", zIndex:2 }}/>
                  )}
                  {/* Faixa "BOSS" */}
                  <div style={{ position:"absolute", top:-11, left:"50%", transform:"translateX(-50%)",
                    background:"linear-gradient(135deg,#991b1b,#dc2626)", borderRadius:6,
                    border:"1px solid rgba(245,158,11,0.7)", padding:"1px 8px", zIndex:3 }}>
                    <span style={{ color:"#fde68a", fontSize:8, fontWeight:900, letterSpacing:".14em" }}>BOSS</span>
                  </div>
                </>
              ) : !accessible ? (
                <Lock size={isScene ? 17 : 22} color="#334155"/>
              ) : isScene ? (
                <Scroll size={20} color={isCompleted ? "#86efac" : "#c4b5fd"}/>
              ) : (
                <Swords size={24} color={isCompleted ? "#86efac" : "#93c5fd"}/>
              )}

              {/* Badge de concluído (check no canto, mantendo o ícone do tipo visível) */}
              {isCompleted && (
                <div style={{ position:"absolute", bottom:-4, right:-4, width:20, height:20,
                  borderRadius:"50%", background:"#14532d", border:"2px solid #22c55e",
                  display:"flex", alignItems:"center", justifyContent:"center", zIndex:3,
                  boxShadow:"0 2px 6px rgba(0,0,0,0.6)" }}>
                  <Check size={11} color="#4ade80" strokeWidth={3.5}/>
                </div>
              )}

              {/* Badge de Varredura liberada (3 estrelas) */}
              {canSweep && (
                <div title="Varredura liberada — 3 estrelas"
                  style={{ position:"absolute", top:-4, left:-4, width:20, height:20,
                    borderRadius:"50%", background:"#422006", border:"2px solid #facc15",
                    display:"flex", alignItems:"center", justifyContent:"center", zIndex:3,
                    boxShadow:"0 0 8px rgba(250,204,21,0.6)" }}>
                  <FastForward size={10} color="#fde047"/>
                </div>
              )}
            </button>

            {/* Avaliação de 3 estrelas (batalhas e boss) */}
            {(isBattle || isBoss) && (accessible || isCompleted) && (
              <div style={{ background:"rgba(2,6,16,0.80)", borderRadius:8, padding:"2px 7px",
                marginTop:-1 }}>
                <RatingStars rating={rating} size={isBoss ? 13 : 11}/>
              </div>
            )}

            <div style={{ background:"rgba(2,6,16,0.88)", border:"1px solid rgba(255,255,255,0.10)",
              borderRadius:8, padding:"3px 8px", textAlign:"center", maxWidth:112 }}>
              {nodeDef.sublabel && (
                <div style={{ fontSize:8, fontWeight:900, textTransform:"uppercase",
                  letterSpacing:".08em", lineHeight:1.4, color:subColor }}>{nodeDef.sublabel}</div>
              )}
              <div style={{ fontSize:10, fontWeight:700, lineHeight:1.35,
                color:accessible||isStart?"#e2e8f0":"#334155",
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:108
              }}>{nodeDef.label}</div>
            </div>
          </div>
        )
      })}

      {/* ── Top header ── */}
      <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:50,
        background:"rgba(2,6,16,0.90)", backdropFilter:"blur(16px)",
        borderBottom:"1px solid rgba(255,255,255,0.07)",
        padding:"11px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.06)",
          border:"1px solid rgba(255,255,255,0.10)", borderRadius:10, padding:"7px 10px",
          cursor:"pointer", color:"#94a3b8", display:"flex", alignItems:"center" }}>
          <ArrowLeft size={17}/>
        </button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <BookOpen size={15} color="#8b5cf6"/>
            <span style={{fontWeight:900,fontSize:15,color:"#e2e8f0"}}>Campanha</span>
          </div>
          <p style={{color:"#475569",fontSize:10,margin:0}}>
            Capítulo 1 — A Lenda da Estrela
          </p>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:4,
          background:"rgba(30,20,2,0.85)", border:"1px solid rgba(250,204,21,0.25)",
          borderRadius:9, padding:"5px 11px" }}>
          <Star size={12} color="#facc15" fill="#facc15"/>
          <span style={{fontWeight:900,fontSize:13,color:"#facc15"}}>
            {earnedStars}<span style={{color:"#78591a",fontWeight:600,fontSize:10}}>/{TOTAL_STARS}</span>
          </span>
        </div>
        <div title="Energia — gasta ao iniciar batalhas e varrer fases"
          style={{ display:"flex",alignItems:"center",gap:5,
          background:"rgba(3,20,10,0.85)", border:"1px solid rgba(16,185,129,0.22)",
          borderRadius:9, padding:"5px 11px" }}>
          <Zap size={12} color="#34d399" fill="#34d399"/>
          <span style={{fontWeight:900,fontSize:13,color:"#6ee7b7"}}>
            {stamina}<span style={{color:"#065f46",fontWeight:600,fontSize:10}}>/{maxStamina}</span>
          </span>
          {stamina < maxStamina && staminaNextTickSeconds > 0 && (
            <span style={{fontSize:9,color:"rgba(52,211,153,0.55)",fontVariantNumeric:"tabular-nums"}}>
              {String(Math.floor(staminaNextTickSeconds/60)).padStart(1,"0")}:{String(staminaNextTickSeconds%60).padStart(2,"0")}
            </span>
          )}
        </div>
        <div title="Fases concluídas do capítulo" style={{textAlign:"right"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4,marginBottom:3}}>
            <MapIcon size={11} color="#a78bfa"/>
            <span style={{fontSize:11,fontWeight:900,color:"#a78bfa"}}>{done}/{total}</span>
          </div>
          <div style={{width:44,height:4,borderRadius:99,background:"rgba(255,255,255,0.08)",overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progPct}%`,borderRadius:99,
              background:"linear-gradient(90deg,#7c3aed,#a855f7)",transition:"width 0.6s"}}/>
          </div>
          <div style={{fontSize:8,fontWeight:700,color:"#64748b",letterSpacing:".08em",
            textTransform:"uppercase",marginTop:2}}>Fases</div>
        </div>
      </div>

      {isChapterDone && (
        <div style={{ position:"absolute",top:64,left:"50%",transform:"translateX(-50%)",
          zIndex:60,background:"rgba(234,179,8,0.12)",border:"1px solid rgba(234,179,8,0.30)",
          borderRadius:14,padding:"10px 22px",display:"flex",alignItems:"center",gap:10,
          backdropFilter:"blur(12px)",whiteSpace:"nowrap" }}>
          <Trophy size={20} color="#fbbf24"/>
          <div>
            <p style={{fontWeight:900,fontSize:13,color:"#fbbf24",margin:0}}>Capítulo 1 Concluído!</p>
            <p style={{color:"#78716c",fontSize:10,margin:0}}>Capítulo 2 em breve...</p>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{ position:"absolute",left:12,bottom:72,zIndex:50,
        background:"rgba(2,6,16,0.92)",border:"1px solid rgba(255,255,255,0.14)",
        borderRadius:12,padding:"10px 12px",display:"flex",flexDirection:"column",gap:8,
        backdropFilter:"blur(10px)", boxShadow:"0 4px 18px rgba(0,0,0,0.5)" }}>
        <span style={{ fontSize:9, fontWeight:900, letterSpacing:".12em", textTransform:"uppercase",
          color:"rgba(255,255,255,0.55)" }}>Legenda</span>
        {([
          { swatch:{ bg:"linear-gradient(145deg,#172554,#1d4ed8)", bd:"#3b82f6", round:"50%" },
            icon:<Swords size={13} color="#bfdbfe"/>, label:"Batalha" },
          { swatch:{ bg:"linear-gradient(145deg,#3b0764,#5b21b6)", bd:"#8b5cf6", round:"7px" },
            icon:<Scroll size={13} color="#ddd6fe"/>, label:"Cena (história)" },
          { swatch:{ bg:"linear-gradient(145deg,#450a0a,#991b1b)", bd:"#f59e0b", round:"50%" },
            icon:<Swords size={13} color="#fecaca"/>, label:"Boss" },
        ] as const).map(item=>(
          <div key={item.label} style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{ width:24, height:24, borderRadius:item.swatch.round,
              background:item.swatch.bg, border:`2px solid ${item.swatch.bd}`,
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {item.icon}
            </div>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.85)",fontWeight:700}}>{item.label}</span>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{ width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Star size={15} color="#facc15" fill="#facc15"/>
          </div>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.85)",fontWeight:700}}>Desempenho na batalha</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{ width:24, height:24, borderRadius:"50%", background:"#422006",
            border:"2px solid #facc15", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <FastForward size={11} color="#fde047"/>
          </div>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.85)",fontWeight:700}}>Varredura (3★)</span>
        </div>
      </div>

      {/* ── Chapter chest progress bar ── */}
      <ChestProgressBar earnedStars={earnedStars} claimed={claimedChests} onChestPress={onChestPress}/>

      {/* ── Bottom nav ── */}
      <div style={{ position:"absolute",bottom:0,left:0,right:0,zIndex:50,
        padding:"0 0 14px",display:"flex",justifyContent:"center",
        background:"linear-gradient(to top,rgba(2,6,16,0.92) 0%,transparent 100%)" }}>
        <button onClick={onBack} style={{ display:"flex",alignItems:"center",gap:8,
          background:"rgba(2,6,16,0.92)",border:"1px solid rgba(255,255,255,0.12)",
          borderRadius:16,padding:"10px 24px",color:"#94a3b8",fontWeight:800,fontSize:13,
          cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
          <Home size={14}/> Menu Principal
        </button>
      </div>

      <style>{`
        @keyframes storyPulseRing {
          0%   { transform: translate(-50%,-50%) scale(1);    opacity: 0.80; }
          100% { transform: translate(-50%,-50%) scale(1.75); opacity: 0;    }
        }
        @keyframes storyBounce {
          0%, 100% { transform: translateY(0);    }
          50%       { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const LS_KEY        = "gpgame_story_progress"
const LS_BATTLE_KEY = "gpgame_story_battle_pending"
const LS_CHESTS_KEY = "gpgame_story_chests_c1"
const LS_STARS_KEY  = "gpgame_story_battle_stars_c1"

/** O que fazer quando a cena ativa terminar. */
type SceneFlow =
  | { kind: "scene"; stageId: string }                 // cena de história normal
  | { kind: "pre";   stage: Stage }                    // diálogo pré-batalha → abre intro
  | { kind: "post";  stageId: string; won: boolean }   // diálogo pós-batalha → resultado

export default function StoryModeScreen({ onBack, onStartBattle }: StoryModeScreenProps) {
  const { stamina, maxStamina, staminaNextTickSeconds, addCoins, setGearCoins, addFragments, spendStamina } = useGame()

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try { const s = localStorage.getItem(LS_KEY); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
  })
  const [claimedChests, setClaimedChests] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try { const s = localStorage.getItem(LS_CHESTS_KEY); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
  })
  const [battleStars, setBattleStars] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {}
    try { const s = localStorage.getItem(LS_STARS_KEY); return s ? JSON.parse(s) : {} } catch { return {} }
  })

  const [activeScene,  setActiveScene]  = useState<Scene | null>(null)
  const [sceneFlow,    setSceneFlow]    = useState<SceneFlow | null>(null)
  const [battleStage,  setBattleStage]  = useState<Stage | null>(null)
  const [infoStage,    setInfoStage]    = useState<Stage | null>(null)
  const [chestModal,   setChestModal]   = useState<ChapterChest | null>(null)
  const [postBattle,   setPostBattle]   = useState<{ won:boolean; stageId:string; rewards: StageDropTable | null } | null>(null)
  const [rewardToast,  setRewardToast]  = useState<{ drops: StageDropTable; stars: number } | null>(null)

  usePreloadImages(getAllSceneImages(CHAPTER1_STAGES))

  const earnedStars = CHAPTER1_STAGES.reduce(
    (sum, s) => sum + (completedIds.has(s.id) ? STAGE_STARS[s.type] : 0), 0)

  // ── Concede os drops de primeira conclusão de uma fase ──
  const grantStageRewards = useCallback((stage: Stage) => {
    const d = STAGE_DROPS[stage.type]
    if (d.gear  > 0) setGearCoins(prev => prev + d.gear)
    if (d.gacha > 0) addCoins(d.gacha)
    if (d.galio > 0) addFragments({ galio: d.galio })
    return d
  }, [setGearCoins, addCoins, addFragments])

  // Pick up battle result when returning from the duel screen
  useEffect(() => {
    const pending = localStorage.getItem(LS_BATTLE_KEY)
    if (!pending) return
    localStorage.removeItem(LS_BATTLE_KEY)
    try {
      const { stageId, won } = JSON.parse(pending)
      const stage = CHAPTER1_STAGES.find(s => s.id === stageId)
      if (won && stage) {
        const firstTime = !completedIds.has(stageId)
        let rewards: StageDropTable | null = null
        if (firstTime) {
          rewards = grantStageRewards(stage)
          setCompletedIds(prev => new Set([...prev, stageId]))
        }
        // Batalha com Diálogo: exibe o diálogo pós-batalha antes do resultado
        if (firstTime && stage.postDialogue) {
          setSceneFlow({ kind: "post", stageId, won })
          setActiveScene(stage.postDialogue)
          setPostBattle(null)
          // guarda recompensas para exibir depois do diálogo
          pendingRewardsRef.current = rewards
          return
        }
        setPostBattle({ won, stageId, rewards })
      } else {
        setPostBattle({ won, stageId, rewards: null })
      }
    } catch {}
  }, []) // eslint-disable-line

  const pendingRewardsRef = useRef<StageDropTable | null>(null)

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify([...completedIds])) } catch {}
  }, [completedIds])

  useEffect(() => {
    try { localStorage.setItem(LS_CHESTS_KEY, JSON.stringify([...claimedChests])) } catch {}
  }, [claimedChests])

  // Auto-hide do toast de recompensas
  useEffect(() => {
    if (!rewardToast) return
    const t = setTimeout(() => setRewardToast(null), 3200)
    return () => clearTimeout(t)
  }, [rewardToast])

  const mark = (id: string) => setCompletedIds(p => new Set([...p, id]))

  // ── Clique em nó do mapa: sempre abre o pop-up de drops ──
  const handleNodePress = (stage: Stage) => setInfoStage(stage)

  // ── "Jogar" a partir do pop-up de informação ──
  const handlePlayStage = (stage: Stage) => {
    setInfoStage(null)
    if (stage.type === "scene" && stage.sceneData) {
      setSceneFlow({ kind: "scene", stageId: stage.id })
      setActiveScene(stage.sceneData)
    } else if (stage.type === "battle" || stage.type === "boss") {
      if (stage.preDialogue && !completedIds.has(stage.id)) {
        // Batalha com Diálogo: primeiro o diálogo, depois a intro da batalha
        setSceneFlow({ kind: "pre", stage })
        setActiveScene(stage.preDialogue)
      } else {
        setBattleStage(stage)
      }
    }
  }

  // ── Fim de uma cena (história, pré ou pós-batalha) ──
  const handleSceneComplete = () => {
    const flow = sceneFlow
    setActiveScene(null)
    setSceneFlow(null)
    if (!flow) return

    if (flow.kind === "scene") {
      if (!completedIds.has(flow.stageId)) {
        const stage = CHAPTER1_STAGES.find(s => s.id === flow.stageId)
        if (stage) {
          const drops = grantStageRewards(stage)
          setRewardToast({ drops, stars: STAGE_STARS[stage.type] })
        }
        mark(flow.stageId)
      }
    } else if (flow.kind === "pre") {
      setBattleStage(flow.stage)
    } else if (flow.kind === "post") {
      setPostBattle({ won: flow.won, stageId: flow.stageId, rewards: pendingRewardsRef.current })
      pendingRewardsRef.current = null
    }
  }

  const handleBattleStart = () => {
    if (!battleStage) return
    const isBoss = battleStage.type === "boss"
    const stageId = battleStage.id
    const mode = isBoss ? "story-boss" as const : "story-normal" as const
    setBattleStage(null)
    onStartBattle(mode, stageId)
  }

  const getNextStage = (stageId: string): Stage | null => {
    const idx = CHAPTER1_STAGES.findIndex(s => s.id === stageId)
    return idx >= 0 && idx + 1 < CHAPTER1_STAGES.length ? CHAPTER1_STAGES[idx + 1] : null
  }

  const handlePostBattleContinue = () => {
    if (!postBattle) return
    const next = getNextStage(postBattle.stageId)
    setPostBattle(null)
    if (next) handlePlayStage(next)
  }

  // ── Baús de capítulo ──
  const handleChestPress = (chest: ChapterChest) => setChestModal(chest)

  const handleClaimChest = () => {
    if (!chestModal) return
    if (claimedChests.has(chestModal.id) || earnedStars < chestModal.stars) return
    const r = chestModal.rewards
    if (r.gear)  setGearCoins(prev => prev + r.gear!)
    if (r.gacha) addCoins(r.gacha)
    if (r.galio) addFragments({ galio: r.galio })
    setClaimedChests(prev => new Set([...prev, chestModal.id]))
  }

  return (
    <>
      {activeScene && (
        <SceneViewer scene={activeScene} onComplete={handleSceneComplete}/>
      )}

      {battleStage && (
        <BattleIntroScreen
          stage={battleStage}
          onBack={() => setBattleStage(null)}
          onStart={handleBattleStart}
        />
      )}

      {postBattle && (
        <PostBattleScreen
          won={postBattle.won}
          rewards={postBattle.rewards}
          onReturnStory={() => setPostBattle(null)}
          onContinue={handlePostBattleContinue}
        />
      )}

      {/* Board map — hidden when a scene/battle overlay is active */}
      {!activeScene && !battleStage && !postBattle && (
        <StoryMapView
          stages={CHAPTER1_STAGES}
          completedIds={completedIds}
          onPress={handleNodePress}
          onBack={onBack}
          stamina={stamina}
          maxStamina={maxStamina}
          staminaNextTickSeconds={staminaNextTickSeconds}
          earnedStars={earnedStars}
          claimedChests={claimedChests}
          onChestPress={handleChestPress}
        />
      )}

      {/* Pop-up de drops da fase */}
      {infoStage && !activeScene && !battleStage && (
        <StageInfoModal
          stage={infoStage}
          completed={completedIds.has(infoStage.id)}
          onPlay={() => handlePlayStage(infoStage)}
          onClose={() => setInfoStage(null)}
        />
      )}

      {/* Pop-up de baú de capítulo */}
      {chestModal && (
        <ChestClaimModal
          chest={chestModal}
          canClaim={earnedStars >= chestModal.stars && !claimedChests.has(chestModal.id)}
          claimed={claimedChests.has(chestModal.id)}
          onClaim={handleClaimChest}
          onClose={() => setChestModal(null)}
        />
      )}

      {/* Toast de recompensas de cena */}
      {rewardToast && !activeScene && (
        <RewardToast drops={rewardToast.drops} stars={rewardToast.stars}/>
      )}
    </>
  )
}
