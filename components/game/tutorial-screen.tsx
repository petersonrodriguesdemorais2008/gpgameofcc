"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ArrowLeft, BookOpen, Swords, Home, Lock, SkipForward } from "lucide-react"
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
  stages.forEach(s => {
    if (s.sceneData) {
      s.sceneData.panels.forEach(p => {
        imgs.add(p.bg)
        p.characters.forEach(c => imgs.add(charImg(c.id, c.emotion)))
      })
    }
  })
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
    id: "c1s2", number: 2, title: "A Fuga", subtitle: "Cena 2", type: "scene",
    sceneData: { id: "c1s2", title: "A Fuga", panels: [
      { id:"p1", bg: BG.house_ext, characters:[{id:"guard1",name:"Guarda",emotion:"normal",side:"left"},{id:"guard2",name:"Guarda",emotion:"normal",side:"right"}], speaker:"guard1", speakerName:"Guarda do Reino", text:"Ele entrou nessa casa! Cerquem o local!", textType:"speech" },
      { id:"p2", bg: BG.house_ext, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Desculpa por isso. Preciso ir agora.", textType:"speech" },
      { id:"p3", bg: BG.bosque, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Espera! Eu vou com você!", textType:"speech" },
      { id:"p4", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"calem",name:"Calem",emotion:"normal",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Por que você foi atrás de mim?! Isso é problema meu!", textType:"speech" },
      { id:"p5", bg: BG.bosque, characters:[{id:"calem",name:"Calem",emotion:"happy",side:"left"}], speaker:"calem", speakerName:"Calem", text:"Já estamos longe dos guardas. Você disse que tinha um plano, não disse?", textType:"speech" },
      { id:"p6", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"happy",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"...Certo. Conheço um lugar onde estaremos seguros. Me sigam.", textType:"speech" },
    ]},
  },
  {
    id: "c1s3", number: 3, title: "As Ruínas", subtitle: "Cena 3", type: "scene",
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
    id: "c1s4", number: 4, title: "A Rachadura", subtitle: "Cena 4", type: "scene",
    sceneData: { id: "c1s4", title: "A Rachadura Roxa", panels: [
      { id:"p1", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"happy",side:"right"}], speaker:"narrator", speakerName:"", text:"No dia seguinte, eles partiram sem saber para onde ir...", textType:"narrator", overlayCaption:"No dia seguinte — estrada fora das ruínas" },
      { id:"p2", bg: BG.bosque, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"O quê?! Uma rachadura roxa explodindo no céu?!", textType:"speech" },
      { id:"p3", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"CALEM!! NÃO!!", textType:"speech" },
      { id:"p4", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"narrator", speakerName:"", text:"Uma voz ecoa... 'Venha ao Reino de Camelot até o meio-dia. Ou seu amigo morrerá.'", textType:"narrator" },
      { id:"p5", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"CAMELOT...! Eu vou te salvar, Calem!", textType:"speech" },
    ]},
  },
  { id:"c1b1", number:5, title:"Portões de Camelot", subtitle:"Batalha", type:"battle" },
  {
    id: "c1s5", number: 6, title: "O Refém", subtitle: "Cena 5", type: "scene",
    sceneData: { id: "c1s5", title: "O Refém", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Onde... onde estou?", textType:"speech", overlayCaption:"Salão do Trono — Castelo de Camelot" },
      { id:"p2", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Bem-vindo ao meu reino, garoto. Você é apenas uma peça no meu jogo.", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"arthur",name:"Rei Arthur",emotion:"normal",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Fehnon! Afinal, você chegou.", textType:"speech" },
      { id:"p4", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Solte o Calem. O que você quer, Arthur?!", textType:"speech" },
      { id:"p5", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Simples. Você conhece os Poderes Ultimates da estrela misteriosa. Me conte tudo.", textType:"speech" },
    ]},
  },
  {
    id: "c1s6", number: 7, title: "Recusa e Confronto", subtitle: "Cena 6", type: "scene",
    sceneData: { id: "c1s6", title: "Recusa e Confronto", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Não vou te contar nada!", textType:"speech" },
      { id:"p2", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"ARTHUR!!!", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Imprudente...!", textType:"speech" },
      { id:"p4", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"A sala está desabando!!", textType:"speech" },
      { id:"p5", bg: BG.bosque, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Segura em mim, Calem!", textType:"speech", overlayCaption:"Telhados do Reino de Camelot" },
    ]},
  },
  {
    id: "c1s7", number: 8, title: "Nos Telhados", subtitle: "Cena 7", type: "scene",
    sceneData: { id: "c1s7", title: "Nos Telhados", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Você está bem, Calem?", textType:"speech", overlayCaption:"Telhados do Reino de Camelot" },
      { id:"p2", bg: BG.camelot, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Raios roxos estão caindo do céu!!", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Sua escolha foi péssima, Fehnon. Vocês dois serão executados.", textType:"speech" },
      { id:"p4", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Surja, Mefisto! MEU ULTIMATE GUARDIAN!!", textType:"speech" },
      { id:"p5", bg: BG.camelot, characters:[{id:"calem",name:"Calem",emotion:"rage",side:"right"},{id:"fehnon",name:"Fehnon",emotion:"happy",side:"left"}], speaker:"calem", speakerName:"Calem", text:"Fe-Fehnon?! Como você pode estar sorrindo agora?!", textType:"speech" },
      { id:"p6", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"happy",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Relaxa. Eu dou um jeito nesse cara. Porque eu também tenho minha Ultimate Gear... a Protonix Sword!!", textType:"speech" },
    ]},
  },
  { id:"c1boss", number:9, title:"Mefisto — O Guardião", subtitle:"Boss Battle", type:"boss" },
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
  const panel = scene.panels[idx]
  const isLast = idx >= scene.panels.length - 1
  const isNarrator = panel.speaker === "narrator" || panel.textType === "narrator"
  const left  = panel.characters.find(c => c.side === "left")
  const right = panel.characters.find(c => c.side === "right")
  const isLeftSpeaking  = !!left  && panel.speaker === left.id
  const isRightSpeaking = !!right && panel.speaker === right.id

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

// ─── Battle Intro ─────────────────────────────────────────────────────────────

function BattleIntroScreen({ stage, onStart, onBack }: { stage:Stage; onStart:()=>void; onBack:()=>void }) {
  const { stamina, maxStamina, spendStamina, staminaNextTickSeconds } = useGame()
  const isBoss = stage.type === "boss"
  const lp = isBoss ? 30 : 20
  const staminaCost = isBoss ? 10 : 5
  const hasEnoughStamina = stamina >= staminaCost
  const staminaPct = Math.min(100, (stamina / maxStamina) * 100)

  const handleStart = () => {
    if (!hasEnoughStamina) return
    spendStamina(staminaCost)
    onStart()
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
              {isBoss ? "Rei Arthur" : "Guardas do Reino"}
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
          {!hasEnoughStamina && (
            <div style={{ marginTop:10, padding:"8px 12px", borderRadius:8,
              background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.25)" }}>
              <p style={{ color:"#fca5a5", fontSize:11, margin:0, fontWeight:700 }}>
                ⚡ Stamina insuficiente!{" "}
                {staminaNextTickSeconds > 0
                  ? `Próximo ponto em ${String(Math.floor(staminaNextTickSeconds/60)).padStart(1,"0")}:${String(staminaNextTickSeconds%60).padStart(2,"0")}`
                  : "Aguarde a recuperação."}
              </p>
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onBack} style={{ padding:"11px 22px", borderRadius:11,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)",
            color:"#64748b", fontWeight:800, fontSize:13, cursor:"pointer" }}>Voltar</button>
          <button onClick={handleStart} disabled={!hasEnoughStamina}
            style={{ padding:"11px 28px", borderRadius:11, border:"none",
              background: !hasEnoughStamina ? "rgba(255,255,255,0.06)"
                : isBoss ? "linear-gradient(135deg,#7f1d1d,#dc2626)"
                : "linear-gradient(135deg,#1e3a8a,#3b82f6)",
              color: hasEnoughStamina ? "#fff" : "#475569",
              fontWeight:900, fontSize:14,
              cursor: hasEnoughStamina ? "pointer" : "not-allowed",
              boxShadow: !hasEnoughStamina ? "none"
                : isBoss ? "0 6px 20px rgba(220,38,38,0.35)"
                : "0 6px 20px rgba(59,130,246,0.35)",
              transition:"all 0.2s" }}>
            {!hasEnoughStamina ? "⚡ Sem Stamina"
              : isBoss ? "⚔️ Batalha Final!"
              : "⚔️ Iniciar Batalha!"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Post-Battle Result ────────────────────────────────────────────────────────

function PostBattleScreen({
  won, onReturnStory, onContinue,
}: { won:boolean; onReturnStory:()=>void; onContinue:()=>void }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(16px)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f1f5f9" }}>
      <div style={{ textAlign:"center", padding:"0 24px" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>{won ? "🏆" : "💀"}</div>
        <h2 style={{ fontWeight:900, fontSize:24, margin:"0 0 8px" }}>{won ? "Vitória!" : "Derrota..."}</h2>
        <p style={{ color:"#64748b", fontSize:14, margin:"0 0 32px" }}>
          {won ? "Batalha concluída com sucesso." : "Você foi derrotado. Tente novamente."}
        </p>
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

// ─── Board Map: Node Definitions ──────────────────────────────────────────────
//
//  Positions (x, y) are percentages of the viewport.
//  They trace a path from Calem's house (bottom-left of the world image)
//  through the forest and ruins, into the walled city of Camelot,
//  up to the floating colosseum at the top.
//
//  WORLD IMAGE path: /images/gearperks-world.png
//  → Place the Gear Perks world panorama at that path in your /public folder.

interface MapNodeDef {
  stageId:  string | null   // null = START node (no stage)
  type:     "start" | "scene" | "battle" | "boss"
  label:    string
  sublabel: string | null
  x: number   // % from left
  y: number   // % from top
}

const MAP_NODES: MapNodeDef[] = [
  //  START — Calem's house, bottom-left of world image
  { stageId: null,      type: "start",  label: "Início",             sublabel: null,          x: 22,  y: 83 },
  //  Chapter 1 stages in story order
  { stageId: "c1s1",   type: "scene",  label: "O Encontro",         sublabel: "Cena 1",      x: 20,  y: 71 },
  { stageId: "c1s2",   type: "scene",  label: "A Fuga",             sublabel: "Cena 2",      x: 16,  y: 59 },
  { stageId: "c1s3",   type: "scene",  label: "As Ruínas",          sublabel: "Cena 3",      x: 26,  y: 47 },
  { stageId: "c1s4",   type: "scene",  label: "A Rachadura",        sublabel: "Cena 4",      x: 38,  y: 53 },
  { stageId: "c1b1",   type: "battle", label: "Portões de Camelot", sublabel: "Batalha",     x: 50,  y: 66 },
  { stageId: "c1s5",   type: "scene",  label: "O Refém",            sublabel: "Cena 5",      x: 56,  y: 54 },
  { stageId: "c1s6",   type: "scene",  label: "Recusa e Confronto", sublabel: "Cena 6",      x: 60,  y: 41 },
  { stageId: "c1s7",   type: "scene",  label: "Nos Telhados",       sublabel: "Cena 7",      x: 61,  y: 29 },
  { stageId: "c1boss", type: "boss",   label: "Mefisto",            sublabel: "Boss Battle", x: 59,  y: 17 },
  { stageId: "c1s8",   type: "scene",  label: "A Revelação",        sublabel: "Cena Final",  x: 55,  y: 6  },
]

// ─── Board Map View ───────────────────────────────────────────────────────────

function StoryMapView({
  stages, completedIds, onPress, onBack, stamina, maxStamina, staminaNextTickSeconds,
}: {
  stages: Stage[]
  completedIds: Set<string>
  onPress: (stage: Stage) => void
  onBack: () => void
  stamina: number
  maxStamina: number
  staminaNextTickSeconds: number
}) {
  // Window pixel dimensions so SVG path lines render correctly
  const [vw, setVw] = useState(() => typeof window !== "undefined" ? window.innerWidth  : 1024)
  const [vh, setVh] = useState(() => typeof window !== "undefined" ? window.innerHeight : 768)

  useEffect(() => {
    const handle = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener("resize", handle)
    return () => window.removeEventListener("resize", handle)
  }, [])

  const px = (pct: number) => (pct / 100) * vw
  const py = (pct: number) => (pct / 100) * vh

  const done  = stages.filter(s => completedIds.has(s.id)).length
  const total = stages.length
  const pct   = Math.round((done / total) * 100)
  const isChapterDone = done === total

  // First uncompleted accessible stage
  const nextStageId = (() => {
    for (let i = 0; i < stages.length; i++) {
      if (completedIds.has(stages[i].id)) continue
      if (i === 0 || completedIds.has(stages[i - 1].id)) return stages[i].id
      break
    }
    return null
  })()

  // Player sits at the last completed stage, or at START if none
  const lastCompletedId = (() => {
    for (let i = stages.length - 1; i >= 0; i--) {
      if (completedIds.has(stages[i].id)) return stages[i].id
    }
    return null
  })()
  const playerNodeId = lastCompletedId ?? null  // null → START node

  const isAccessible = (stageId: string) => {
    const idx = stages.findIndex(s => s.id === stageId)
    return idx === 0 || (idx > 0 && completedIds.has(stages[idx - 1].id))
  }

  return (
    <div style={{ position:"fixed", inset:0, overflow:"hidden", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>

      {/* ── World background ── */}
      {/* Drop the Gear Perks world panorama at /public/images/gearperks-world.png */}
      <div style={{ position:"absolute", inset:0,
        backgroundImage:"url(/images/gearperks-world.png)",
        backgroundSize:"cover", backgroundPosition:"center top" }}/>

      {/* Subtle darkening so nodes and text remain readable */}
      <div style={{ position:"absolute", inset:0,
        background:"linear-gradient(160deg,rgba(3,6,14,0.42) 0%,rgba(3,6,14,0.18) 50%,rgba(3,6,14,0.50) 100%)" }}/>

      {/* ── SVG path lines ── */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%",
        pointerEvents:"none", zIndex:5, overflow:"visible" }}>
        {MAP_NODES.slice(0, -1).map((node, i) => {
          const next = MAP_NODES[i + 1]
          // A segment is "lit" (completed) when the origin node is done (or it's the START)
          const segLit = node.stageId === null
            ? true
            : completedIds.has(node.stageId)
          return (
            <g key={`path-${i}`}>
              {/* Dark navy border — thicker */}
              <line
                x1={px(node.x)} y1={py(node.y)} x2={px(next.x)} y2={py(next.y)}
                stroke="#0c1a30" strokeWidth={8} strokeLinecap="round"
                strokeDasharray={segLit ? undefined : "18 10"}
                opacity={segLit ? 1 : 0.55}
              />
              {/* Purple foreground */}
              <line
                x1={px(node.x)} y1={py(node.y)} x2={px(next.x)} y2={py(next.y)}
                stroke={segLit ? "#7c3aed" : "#3b0764"}
                strokeWidth={4} strokeLinecap="round"
                strokeDasharray={segLit ? undefined : "18 10"}
                opacity={segLit ? 0.92 : 0.45}
              />
              {/* Faint glow on lit segments */}
              {segLit && (
                <line
                  x1={px(node.x)} y1={py(node.y)} x2={px(next.x)} y2={py(next.y)}
                  stroke="#a855f7" strokeWidth={2} strokeLinecap="round" opacity={0.35}
                  style={{ filter:"blur(1px)" }}
                />
              )}
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

        // Colour palette per type
        const palette = {
          start:  { bg:"#1e293b",                                      border:"#475569",  glow:"rgba(148,163,184,0.4)" },
          scene:  { bg:"linear-gradient(145deg,#3b0764,#5b21b6)",      border:"#7c3aed",  glow:"rgba(124,58,237,0.6)" },
          battle: { bg:"linear-gradient(145deg,#172554,#1d4ed8)",      border:"#2563eb",  glow:"rgba(59,130,246,0.6)" },
          boss:   { bg:"linear-gradient(145deg,#450a0a,#991b1b)",      border:"#dc2626",  glow:"rgba(220,38,38,0.6)" },
        }[nodeDef.type]

        const nodeBg     = isCompleted ? "linear-gradient(145deg,#14532d,#166534)" : !accessible && !isStart ? "#0f172a" : palette.bg
        const nodeBorder = isPlayer ? "#38bdf8" : isNext ? "#22c55e" : isCompleted ? "#22c55e" : !accessible && !isStart ? "#1e293b" : palette.border
        const nodeGlow   = isPlayer ? "0 0 20px rgba(56,189,248,0.7),0 6px 16px rgba(0,0,0,0.6)"
                         : isNext   ? "0 0 20px rgba(34,197,94,0.7),0 6px 16px rgba(0,0,0,0.6)"
                         : isCompleted ? "0 0 14px rgba(34,197,94,0.4),0 4px 12px rgba(0,0,0,0.5)"
                         : `0 0 14px ${palette.glow},0 4px 12px rgba(0,0,0,0.5)`

        return (
          <div key={nodeDef.stageId ?? "start"} style={{
            position:"absolute",
            left:`${nodeDef.x}%`, top:`${nodeDef.y}%`,
            transform:"translate(-50%,-50%)",
            zIndex:10,
            display:"flex", flexDirection:"column", alignItems:"center", gap:4,
          }}>

            {/* ▶ PRÓXIMO badge */}
            {isNext && (
              <div style={{
                background:"#16a34a", borderRadius:8, padding:"2px 8px",
                fontSize:8, fontWeight:900, color:"#fff", letterSpacing:"0.06em",
                whiteSpace:"nowrap", marginBottom:2,
                boxShadow:"0 2px 10px rgba(22,163,74,0.65)",
                animation:"storyBounce 1.6s ease-in-out infinite",
              }}>▶ PRÓXIMO</div>
            )}

            {/* Outer pulse ring for player position */}
            {isPlayer && (
              <div style={{
                position:"absolute", top:"50%", left:"50%",
                transform:"translate(-50%,-50%)",
                width:66, height:66, borderRadius:"50%",
                border:"2px solid #38bdf8",
                animation:"storyPulseRing 1.8s ease-out infinite",
                pointerEvents:"none",
              }}/>
            )}

            {/* Node circle */}
            <button
              onClick={() => accessible && !isStart && stage ? onPress(stage) : undefined}
              disabled={!accessible || isStart}
              style={{
                width:50, height:50, borderRadius:"50%",
                background: nodeBg,
                border:`3px solid ${nodeBorder}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor: accessible && !isStart ? "pointer" : "default",
                boxShadow: nodeGlow,
                opacity: !accessible && !isStart ? 0.42 : 1,
                transition:"transform 0.15s, box-shadow 0.15s",
                position:"relative",
                // Extra interactive feel
              }}
              onMouseEnter={e => { if (accessible && !isStart) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.10)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
              onMouseDown={e  => { if (accessible && !isStart) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)" }}
              onMouseUp={e    => { if (accessible && !isStart) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.10)" }}
            >
              {/* Player blue highlight ring (on top of border) */}
              {isPlayer && (
                <div style={{
                  position:"absolute", inset:-4, borderRadius:"50%",
                  border:"2px solid #38bdf8",
                  boxShadow:"0 0 12px rgba(56,189,248,0.9)",
                  pointerEvents:"none",
                }}/>
              )}

              {/* Icon */}
              {isStart ? (
                <span style={{fontSize:22}}>🏠</span>
              ) : isCompleted ? (
                <span style={{color:"#4ade80", fontSize:22, fontWeight:900}}>✓</span>
              ) : !accessible ? (
                <Lock size={17} color="#334155"/>
              ) : nodeDef.type === "scene" ? (
                <BookOpen size={19} color="#c4b5fd"/>
              ) : nodeDef.type === "boss" ? (
                <Swords size={19} color="#fca5a5"/>
              ) : (
                <Swords size={19} color="#93c5fd"/>
              )}
            </button>

            {/* Label card */}
            <div style={{
              background:"rgba(2,6,16,0.82)",
              border:"1px solid rgba(255,255,255,0.09)",
              borderRadius:7, padding:"2px 7px",
              backdropFilter:"blur(8px)",
              textAlign:"center", maxWidth:96,
            }}>
              {nodeDef.sublabel && (
                <div style={{
                  fontSize:7, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.08em",
                  color: nodeDef.type==="boss" ? "#fca5a5"
                       : nodeDef.type==="battle" ? "#93c5fd"
                       : "#c4b5fd",
                  lineHeight:1.4,
                }}>{nodeDef.sublabel}</div>
              )}
              <div style={{
                fontSize:9, fontWeight:700, lineHeight:1.35,
                color: accessible || isStart ? "#e2e8f0" : "#334155",
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:90,
              }}>{nodeDef.label}</div>
            </div>
          </div>
        )
      })}

      {/* ── Top header ── */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:50,
        background:"rgba(2,6,16,0.88)", backdropFilter:"blur(16px)",
        borderBottom:"1px solid rgba(255,255,255,0.07)",
        padding:"11px 16px", display:"flex", alignItems:"center", gap:12 }}>

        <button onClick={onBack} style={{
          background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)",
          borderRadius:10, padding:"7px 10px", cursor:"pointer", color:"#94a3b8",
          display:"flex", alignItems:"center" }}>
          <ArrowLeft size={17}/>
        </button>

        <div style={{flex:1}}>
          <div style={{display:"flex", alignItems:"center", gap:7}}>
            <BookOpen size={15} color="#8b5cf6"/>
            <span style={{fontWeight:900, fontSize:15, color:"#e2e8f0"}}>Campanha</span>
          </div>
          <p style={{color:"#475569", fontSize:10, margin:0}}>
            Capítulo 1 — A Lenda da Estrela
          </p>
        </div>

        {/* Stamina indicator */}
        <div style={{ display:"flex", alignItems:"center", gap:5,
          background:"rgba(3,20,10,0.82)", border:"1px solid rgba(16,185,129,0.22)",
          borderRadius:9, padding:"5px 11px" }}>
          <span style={{fontSize:11, color:"#34d399"}}>⚡</span>
          <span style={{fontWeight:900, fontSize:13, color:"#6ee7b7"}}>
            {stamina}<span style={{color:"#065f46", fontWeight:600, fontSize:10}}>/{maxStamina}</span>
          </span>
          {stamina < maxStamina && staminaNextTickSeconds > 0 && (
            <span style={{fontSize:9, color:"rgba(52,211,153,0.55)", fontVariantNumeric:"tabular-nums"}}>
              {String(Math.floor(staminaNextTickSeconds/60)).padStart(1,"0")}:{String(staminaNextTickSeconds%60).padStart(2,"0")}
            </span>
          )}
        </div>

        {/* Chapter progress pill */}
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:11, fontWeight:900, color:"#a78bfa", marginBottom:3}}>
            {done}/{total}
          </div>
          <div style={{width:44, height:4, borderRadius:99, background:"rgba(255,255,255,0.08)", overflow:"hidden"}}>
            <div style={{height:"100%", width:`${pct}%`, borderRadius:99,
              background:"linear-gradient(90deg,#7c3aed,#a855f7)",
              boxShadow:"0 0 8px rgba(168,85,247,0.5)", transition:"width 0.6s"}}/>
          </div>
        </div>
      </div>

      {/* ── Chapter-complete banner ── */}
      {isChapterDone && (
        <div style={{ position:"fixed", top:64, left:"50%", transform:"translateX(-50%)",
          zIndex:60, background:"rgba(234,179,8,0.12)", border:"1px solid rgba(234,179,8,0.30)",
          borderRadius:14, padding:"10px 22px", display:"flex", alignItems:"center", gap:10,
          backdropFilter:"blur(12px)", boxShadow:"0 6px 24px rgba(0,0,0,0.4)" }}>
          <span style={{fontSize:22}}>🏆</span>
          <div>
            <p style={{fontWeight:900, fontSize:13, color:"#fbbf24", margin:0}}>Capítulo 1 Concluído!</p>
            <p style={{color:"#78716c", fontSize:10, margin:0}}>Capítulo 2 em breve...</p>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{ position:"fixed", left:12, bottom:72, zIndex:50,
        background:"rgba(2,6,16,0.82)", border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:10, padding:"8px 10px", backdropFilter:"blur(10px)",
        display:"flex", flexDirection:"column", gap:5 }}>
        {[
          { color:"#93c5fd", icon:<Swords size={11} color="#93c5fd"/>, label:"Batalha" },
          { color:"#c4b5fd", icon:<BookOpen size={11} color="#c4b5fd"/>, label:"Cena" },
          { color:"#fca5a5", icon:<Swords size={11} color="#fca5a5"/>, label:"Boss" },
        ].map(item => (
          <div key={item.label} style={{display:"flex", alignItems:"center", gap:5}}>
            {item.icon}
            <span style={{fontSize:9, color:"rgba(255,255,255,0.55)", fontWeight:600}}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Bottom nav button ── */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50,
        padding:"0 0 18px", display:"flex", justifyContent:"center",
        background:"linear-gradient(to top, rgba(2,6,16,0.90) 0%, transparent 100%)" }}>
        <button onClick={onBack} style={{
          display:"flex", alignItems:"center", gap:8,
          background:"rgba(2,6,16,0.90)", border:"1px solid rgba(255,255,255,0.12)",
          borderRadius:16, padding:"11px 24px",
          color:"#94a3b8", fontWeight:800, fontSize:13,
          cursor:"pointer", backdropFilter:"blur(12px)",
          boxShadow:"0 4px 20px rgba(0,0,0,0.4)",
        }}>
          <Home size={14}/> Menu Principal
        </button>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes storyPulseRing {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.80; }
          100% { transform: translate(-50%,-50%) scale(1.70); opacity: 0;    }
        }
        @keyframes storyBounce {
          0%, 100% { transform: translateY(0);   }
          50%       { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const LS_KEY        = "gpgame_story_progress"
const LS_BATTLE_KEY = "gpgame_story_battle_pending"

export default function StoryModeScreen({ onBack, onStartBattle }: StoryModeScreenProps) {
  const { stamina, maxStamina, staminaNextTickSeconds } = useGame()

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try { const s = localStorage.getItem(LS_KEY); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
  })
  const [activeScene,  setActiveScene]  = useState<Scene  | null>(null)
  const [battleStage,  setBattleStage]  = useState<Stage  | null>(null)
  const [pendingId,    setPendingId]    = useState<string | null>(null)
  const [postBattle,   setPostBattle]   = useState<{ won:boolean; stageId:string } | null>(null)

  usePreloadImages(getAllSceneImages(CHAPTER1_STAGES))

  // Pick up battle result when returning from the duel screen
  useEffect(() => {
    const pending = localStorage.getItem(LS_BATTLE_KEY)
    if (!pending) return
    localStorage.removeItem(LS_BATTLE_KEY)
    try {
      const { stageId, won } = JSON.parse(pending)
      if (won) setCompletedIds(prev => new Set([...prev, stageId]))
      setPostBattle({ won, stageId })
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify([...completedIds])) } catch {}
  }, [completedIds])

  const mark = (id: string) => setCompletedIds(p => new Set([...p, id]))

  const handlePress = (stage: Stage) => {
    if (stage.type === "scene" && stage.sceneData) {
      setPendingId(stage.id)
      setActiveScene(stage.sceneData)
    } else if (stage.type === "battle" || stage.type === "boss") {
      setPendingId(stage.id)
      setBattleStage(stage)
    }
  }

  const handleBattleStart = () => {
    if (!battleStage) return
    const isBoss = battleStage.type === "boss"
    localStorage.setItem(LS_BATTLE_KEY, JSON.stringify({ stageId: battleStage.id, won: false, lp: isBoss ? 30 : 20 }))
    setBattleStage(null)
    setPendingId(null)
    onStartBattle(isBoss ? "story-boss" : "story-normal", battleStage.id)
  }

  const getNextStage = (stageId: string): Stage | null => {
    const idx = CHAPTER1_STAGES.findIndex(s => s.id === stageId)
    return idx >= 0 && idx + 1 < CHAPTER1_STAGES.length ? CHAPTER1_STAGES[idx + 1] : null
  }

  const handlePostBattleContinue = () => {
    if (!postBattle) return
    const next = getNextStage(postBattle.stageId)
    setPostBattle(null)
    if (next) handlePress(next)
  }

  return (
    <>
      {activeScene && (
        <SceneViewer scene={activeScene} onComplete={() => {
          if (pendingId) mark(pendingId)
          setPendingId(null)
          setActiveScene(null)
        }}/>
      )}

      {battleStage && (
        <BattleIntroScreen
          stage={battleStage}
          onBack={() => { setBattleStage(null); setPendingId(null) }}
          onStart={handleBattleStart}
        />
      )}

      {postBattle && (
        <PostBattleScreen
          won={postBattle.won}
          onReturnStory={() => setPostBattle(null)}
          onContinue={handlePostBattleContinue}
        />
      )}

      {/* Board map — hidden when a scene/battle overlay is active */}
      {!activeScene && !battleStage && !postBattle && (
        <StoryMapView
          stages={CHAPTER1_STAGES}
          completedIds={completedIds}
          onPress={handlePress}
          onBack={onBack}
          stamina={stamina}
          maxStamina={maxStamina}
          staminaNextTickSeconds={staminaNextTickSeconds}
        />
      )}
    </>
  )
}

// ─── Exports required by game-wrapper.tsx ─────────────────────────────────────
// These were previously expected but did not exist in this file.
// Stub exports keep the build working without breaking game-wrapper.tsx.

/** Stub overlay — game-wrapper renders nothing here until a real tutorial overlay is built. */
export function TutorialGameOverlay(): null {
  return null
}

/** Type for tutorial master IDs used in game-wrapper progress tracking. */
export type TutorialMasterId = string

/** Stub deck grant — returns an empty array until starter-deck logic is implemented. */
export function buildStarterDeckGrant(_masterId: TutorialMasterId): unknown[] {
  return []
}
