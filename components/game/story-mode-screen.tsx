"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ArrowLeft, BookOpen, Lock, ChevronRight, SkipForward } from "lucide-react"
import { useGame } from "@/contexts/game-context"

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

const BG = {
  house_ext:   "/images/calemhouse1_scene.png",
  house_int:   "/images/calemhouse2_scene.png",
  bosque:      "/images/bosque2_scene.png",
  ruins_day:   "/images/ruins1_scene.png",
  ruins_night: "/images/ruins2_scene.png",
  camelot:     "/images/camelot_scene.png",
}

// Left character always faces RIGHT (scaleX(-1) to flip so they face inward)
// Right character always faces LEFT (default, already facing left since they're mirrored)
// Rule: left char → scaleX(-1), right char → default (no flip)
function charImg(id: CharacterId, emotion: Emotion) {
  return `/images/${id}_${emotion}_scene.png`
}

// Collect all unique images from all scenes for preloading
function getAllSceneImages(stages: Stage[]): string[] {
  const imgs = new Set<string>()
  stages.forEach(s => {
    if (s.sceneData) {
      s.sceneData.panels.forEach(p => {
        imgs.add(p.bg)
        p.characters.forEach(c => {
          imgs.add(charImg(c.id, c.emotion))
        })
      })
    }
  })
  return Array.from(imgs)
}

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
      const img = new Image()
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

  // Character filter: speaker = normal, non-speaker = dimmed, no drop-shadow on speaker
  const charFilter = (isSpeaking: boolean) => {
    if (isNarrator) return "none"
    return isSpeaking ? "none" : "brightness(0.40) saturate(0.3)"
  }

  return (
    <div
      onClick={advance}
      style={{
        position:"fixed", inset:0, zIndex:200,
        background:"#000", userSelect:"none", cursor:"pointer",
        fontFamily:"'Segoe UI',system-ui,sans-serif",
        overflow:"hidden",
      }}
    >
      {/* BG — no transition, instant swap */}
      <div style={{
        position:"absolute", inset:0,
        backgroundImage:`url(${panel.bg})`,
        backgroundSize:"cover", backgroundPosition:"center",
        filter:"brightness(0.70)",
      }}/>
      <div style={{
        position:"absolute", inset:0,
        background:"linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.0) 42%, rgba(0,0,0,0.10) 100%)",
      }}/>

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
              <div key={i} style={{
                width: i===idx ? 16 : 5, height:4, borderRadius:99,
                background: i===idx ? "#8b5cf6" : i<idx ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.18)",
                transition:"width 0.3s",
              }}/>
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

      {/* Location caption */}
      {panel.overlayCaption && (
        <div style={{ position:"absolute", top:52, left:20, zIndex:30,
          background:"rgba(0,0,0,0.72)", borderLeft:"3px solid #8b5cf6", padding:"5px 14px" }}>
          <span style={{ color:"#e2e8f0", fontSize:11, fontStyle:"italic" }}>{panel.overlayCaption}</span>
        </div>
      )}

      {/* LEFT character — asset naturally faces RIGHT, so NO flip needed */}
      {left && (
        <img
          src={charImg(left.id, left.emotion)}
          alt={left.name}
          style={{
            position: "absolute",
            bottom: 126,
            left: 0,
            height: "calc(100vh - 174px)",
            width: "auto",
            maxWidth: "48%",
            objectFit: "contain",
            objectPosition: "bottom",
            pointerEvents: "none",
            opacity: fading ? 0 : 1,
            transition: "opacity 0.14s ease",
            filter: charFilter(isLeftSpeaking),
            zIndex: 10,
            display: "block",
          }}
        />
      )}

      {/* RIGHT character — asset faces RIGHT, flip to face LEFT (inward) */}
      {right && (
        <img
          src={charImg(right.id, right.emotion)}
          alt={right.name}
          style={{
            position: "absolute",
            bottom: 126,
            right: 0,
            height: "calc(100vh - 174px)",
            width: "auto",
            maxWidth: "48%",
            objectFit: "contain",
            objectPosition: "bottom",
            transform: "scaleX(-1)",
            pointerEvents: "none",
            opacity: fading ? 0 : 1,
            transition: "opacity 0.14s ease",
            filter: charFilter(isRightSpeaking),
            zIndex: 10,
            display: "block",
          }}
        />
      )}

      {/* Dialogue box */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, zIndex:40,
        opacity: fading ? 0 : 1, transition:"opacity 0.14s ease",
      }}>
        {isNarrator ? (
          <div style={{
            margin:"0 14px 18px",
            background:"rgba(0,0,0,0.82)", border:"1px solid rgba(139,92,246,0.35)",
            borderLeft:"4px solid #8b5cf6", borderRadius:10, padding:"14px 18px",
            backdropFilter:"blur(10px)",
          }}>
            <p style={{ color:"#d1d5db", fontSize:14, fontStyle:"italic", lineHeight:1.75, margin:0 }}>
              {panel.text}
            </p>
          </div>
        ) : (
          <div style={{
            background:"rgba(4,8,18,0.92)", borderTop:"1px solid rgba(255,255,255,0.12)",
            borderRadius:"14px 14px 0 0", backdropFilter:"blur(14px)",
            minHeight:120,
          }}>
            {panel.speakerName && (
              <div style={{
                display:"inline-block", marginLeft:20, marginTop:-1,
                background: nameBg(panel.speaker),
                padding:"5px 18px 6px", borderRadius:"0 0 9px 9px",
              }}>
                <span style={{ color:"#fff", fontWeight:900, fontSize:13, letterSpacing:"0.04em" }}>
                  {panel.speakerName}
                </span>
              </div>
            )}
            <div style={{ padding:"10px 22px 0" }}>
              <p style={{
                color:"#f1f5f9", fontSize:15, lineHeight:1.8, margin:0,
                fontStyle: panel.textType==="thought" ? "italic" : undefined,
                letterSpacing:"0.01em",
              }}>
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
  const { stamina, maxStamina, spendStamina } = useGame()
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

        {/* Battle info */}
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

        {/* Stamina cost box */}
        <div style={{
          background: hasEnoughStamina ? "rgba(3,20,10,0.80)" : "rgba(40,0,0,0.60)",
          border: `1px solid ${hasEnoughStamina ? "rgba(16,185,129,0.30)" : "rgba(239,68,68,0.40)"}`,
          borderRadius:14, padding:"14px 20px", marginBottom:24, maxWidth:300,
        }}>
          {/* Stamina cost */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ color:"#64748b", fontSize:12 }}>Custo de Stamina</span>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{
                color: hasEnoughStamina ? "#34d399" : "#f87171",
                fontWeight:900, fontSize:16,
              }}>-{staminaCost}</span>
              <span style={{ color:"#475569", fontSize:11 }}>STAMINA</span>
            </div>
          </div>

          {/* Current stamina bar */}
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ color:"#64748b", fontSize:11 }}>Sua Stamina</span>
            <span style={{
              color: hasEnoughStamina ? "#6ee7b7" : "#f87171",
              fontWeight:700, fontSize:12,
            }}>{stamina}/{maxStamina}</span>
          </div>
          <div style={{ height:6, borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
            <div style={{
              height:"100%", borderRadius:99,
              width:`${staminaPct}%`,
              background: hasEnoughStamina
                ? "linear-gradient(90deg,#059669,#10b981)"
                : "linear-gradient(90deg,#dc2626,#ef4444)",
              boxShadow: hasEnoughStamina ? "0 0 6px rgba(16,185,129,0.5)" : "0 0 6px rgba(239,68,68,0.5)",
              transition:"width 0.5s",
            }}/>
          </div>

          {/* Not enough stamina warning */}
          {!hasEnoughStamina && (
            <div style={{
              marginTop:10, padding:"8px 12px", borderRadius:8,
              background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.25)",
            }}>
              <p style={{ color:"#fca5a5", fontSize:11, margin:0, fontWeight:700 }}>
                ⚡ Stamina insuficiente! Aguarde a recuperação (1 a cada 5 min).
              </p>
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onBack} style={{ padding:"11px 22px", borderRadius:11,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)",
            color:"#64748b", fontWeight:800, fontSize:13, cursor:"pointer" }}>Voltar</button>
          <button
            onClick={handleStart}
            disabled={!hasEnoughStamina}
            style={{ padding:"11px 28px", borderRadius:11, border:"none",
              background: !hasEnoughStamina
                ? "rgba(255,255,255,0.06)"
                : isBoss
                ? "linear-gradient(135deg,#7f1d1d,#dc2626)"
                : "linear-gradient(135deg,#1e3a8a,#3b82f6)",
              color: hasEnoughStamina ? "#fff" : "#475569",
              fontWeight:900, fontSize:14,
              cursor: hasEnoughStamina ? "pointer" : "not-allowed",
              boxShadow: !hasEnoughStamina
                ? "none"
                : isBoss
                ? "0 6px 20px rgba(220,38,38,0.35)"
                : "0 6px 20px rgba(59,130,246,0.35)",
              transition:"all 0.2s",
            }}>
            {!hasEnoughStamina
              ? "⚡ Sem Stamina"
              : isBoss
              ? "⚔️ Batalha Final!"
              : "⚔️ Iniciar Batalha!"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Post-Battle Result Screen ────────────────────────────────────────────────

function PostBattleScreen({
  won,
  onReturnStory,
  onContinue,
}: {
  won: boolean
  onReturnStory: () => void
  onContinue: () => void
}) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(16px)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f1f5f9" }}>
      <div style={{ textAlign:"center", padding:"0 24px" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>{won ? "🏆" : "💀"}</div>
        <h2 style={{ fontWeight:900, fontSize:24, margin:"0 0 8px" }}>
          {won ? "Vitória!" : "Derrota..."}
        </h2>
        <p style={{ color:"#64748b", fontSize:14, margin:"0 0 32px" }}>
          {won ? "Batalha concluída com sucesso." : "Você foi derrotado. Tente novamente."}
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:12, alignItems:"center" }}>
          {won && (
            <button onClick={onContinue} style={{
              width:260, padding:"15px 0", borderRadius:14, border:"none",
              background:"linear-gradient(135deg,#4c1d95,#7c3aed)",
              color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer",
              boxShadow:"0 6px 24px rgba(124,58,237,0.40)",
            }}>
              ▶ Continuar História
            </button>
          )}
          <button onClick={onReturnStory} style={{
            width:260, padding:"13px 0", borderRadius:14,
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)",
            color:"#94a3b8", fontWeight:800, fontSize:14, cursor:"pointer",
          }}>
            ← Voltar ao Story Mode
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stage Card ───────────────────────────────────────────────────────────────

function StageCard({ stage, onPress, completedIds }: { stage:Stage; onPress:()=>void; completedIds:Set<string> }) {
  const isCompleted = completedIds.has(stage.id)
  const prevIdx = CHAPTER1_STAGES.findIndex(s=>s.id===stage.id) - 1
  const prevStage = prevIdx >= 0 ? CHAPTER1_STAGES[prevIdx] : null
  const isLocked = prevStage !== null && !completedIds.has(prevStage.id)
  const accent = stage.type==="boss" ? "#f87171" : stage.type==="battle" ? "#60a5fa" : "#a78bfa"
  const bg = stage.type==="boss" ? "linear-gradient(135deg,rgba(220,38,38,0.14),rgba(127,29,29,0.07))"
    : stage.type==="battle" ? "linear-gradient(135deg,rgba(37,99,235,0.14),rgba(29,78,216,0.07))"
    : "linear-gradient(135deg,rgba(91,33,182,0.11),rgba(55,48,163,0.05))"
  const icon = stage.type==="boss" ? "💀" : stage.type==="battle" ? "⚔️" : "📖"
  return (
    <button onClick={isLocked?undefined:onPress} disabled={isLocked} style={{
      width:"100%", background:isLocked?"rgba(255,255,255,0.02)":bg,
      border:`1px solid ${isLocked?"rgba(255,255,255,0.05)":isCompleted?accent+"50":accent+"28"}`,
      borderRadius:14, padding:"13px 14px",
      display:"flex", alignItems:"center", gap:12,
      cursor:isLocked?"not-allowed":"pointer",
      opacity:isLocked?0.45:1, transition:"all 0.2s", textAlign:"left",
    }}>
      <div style={{ width:44, height:44, borderRadius:11, flexShrink:0,
        background:isCompleted?"rgba(34,197,94,0.15)":isLocked?"rgba(255,255,255,0.04)":stage.type==="boss"?"rgba(220,38,38,0.18)":stage.type==="battle"?"rgba(37,99,235,0.18)":"rgba(91,33,182,0.18)",
        display:"flex", alignItems:"center", justifyContent:"center",
        border:`1px solid ${isCompleted?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.07)"}`, fontSize:20 }}>
        {isLocked ? <Lock size={15} color="#334155"/> : isCompleted ? <span style={{color:"#22c55e",fontSize:17}}>✓</span> : icon}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", gap:5, marginBottom:3, flexWrap:"wrap" }}>
          <span style={{ fontSize:9, fontWeight:800, color:accent, background:`${accent}18`, padding:"2px 7px", borderRadius:5, letterSpacing:"0.08em", textTransform:"uppercase" }}>{stage.subtitle}</span>
          {isCompleted && <span style={{ fontSize:9, color:"#22c55e", fontWeight:700, background:"rgba(34,197,94,0.1)", padding:"2px 7px", borderRadius:5 }}>✓ Concluído</span>}
        </div>
        <p style={{ color:isLocked?"#334155":"#e2e8f0", fontWeight:900, fontSize:14, margin:0 }}>{stage.title}</p>
      </div>
      {!isLocked && <ChevronRight size={15} color="#475569"/>}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const LS_KEY = "gpgame_story_progress"
const LS_BATTLE_KEY = "gpgame_story_battle_pending"

export default function StoryModeScreen({ onBack, onStartBattle }: StoryModeScreenProps) {
  const { stamina, maxStamina } = useGame()
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try { const s = localStorage.getItem(LS_KEY); return s ? new Set(JSON.parse(s)) : new Set() } catch { return new Set() }
  })
  const [activeScene, setActiveScene] = useState<Scene|null>(null)
  const [battleStage, setBattleStage] = useState<Stage|null>(null)
  const [pendingId, setPendingId] = useState<string|null>(null)
  const [postBattle, setPostBattle] = useState<{ won: boolean; stageId: string } | null>(null)

  // Preload all images on mount
  usePreloadImages(getAllSceneImages(CHAPTER1_STAGES))

  // Check if we returned from a battle
  useEffect(() => {
    const pending = localStorage.getItem(LS_BATTLE_KEY)
    if (pending) {
      localStorage.removeItem(LS_BATTLE_KEY)
      try {
        const { stageId, won } = JSON.parse(pending)
        if (won) {
          setCompletedIds(prev => new Set([...prev, stageId]))
        }
        setPostBattle({ won, stageId })
      } catch {}
    }
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
    const lp = isBoss ? 30 : 20
    localStorage.setItem(LS_BATTLE_KEY, JSON.stringify({ stageId: battleStage.id, won: false, lp }))
    setBattleStage(null)
    setPendingId(null)
    onStartBattle(isBoss ? "story-boss" : "story-normal", battleStage.id)
  }

  // Get next stage after a completed one
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

  const total = CHAPTER1_STAGES.length
  const done  = CHAPTER1_STAGES.filter(s => completedIds.has(s.id)).length
  const pct   = Math.round((done/total)*100)
  const reversed = [...CHAPTER1_STAGES].reverse()

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
        <BattleIntroScreen stage={battleStage}
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

      <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#020610 0%,#050d1a 50%,#030a14 100%)",
        color:"#f1f5f9", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
          background:"radial-gradient(ellipse 80% 40% at 50% 0%,rgba(91,33,182,0.12) 0%,transparent 60%)" }}/>

        {/* Header */}
        <div style={{ position:"sticky", top:0, zIndex:50,
          background:"rgba(2,6,16,0.92)", backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, maxWidth:600, margin:"0 auto" }}>
            <button onClick={onBack} style={{ background:"rgba(255,255,255,0.06)",
              border:"1px solid rgba(255,255,255,0.10)", borderRadius:12, padding:"8px 10px",
              cursor:"pointer", color:"#94a3b8", display:"flex", alignItems:"center" }}>
              <ArrowLeft size={18}/>
            </button>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <BookOpen size={18} color="#8b5cf6"/>
                <h1 style={{ fontWeight:900, fontSize:18, margin:0 }}>Campanha</h1>
              </div>
              <p style={{ color:"#475569", fontSize:11, margin:0 }}>Gear Perks — A Lenda da Estrela</p>
            </div>
            {/* Stamina */}
            <div style={{
              display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3,
              background:"rgba(3,20,10,0.80)", border:"1px solid rgba(16,185,129,0.25)",
              borderRadius:10, padding:"6px 12px",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:9, fontWeight:800, color:"#34d399", letterSpacing:"0.08em", textTransform:"uppercase" }}>Stamina</span>
                <span style={{ fontWeight:900, fontSize:13, color:"#6ee7b7" }}>
                  {stamina}<span style={{ color:"#065f46", fontWeight:600, fontSize:11 }}>/{maxStamina}</span>
                </span>
              </div>
              <div style={{ width:90, height:5, borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                <div style={{
                  height:"100%", borderRadius:99,
                  width:`${Math.min(100,(stamina/maxStamina)*100)}%`,
                  background: stamina === maxStamina
                    ? "linear-gradient(90deg,#10b981,#34d399)"
                    : stamina < maxStamina * 0.3
                    ? "linear-gradient(90deg,#ef4444,#f87171)"
                    : "linear-gradient(90deg,#059669,#10b981)",
                  boxShadow:"0 0 6px rgba(16,185,129,0.5)",
                  transition:"width 0.5s",
                }}/>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:"auto", position:"relative", zIndex:1 }}>
          <div style={{ maxWidth:600, margin:"0 auto", padding:"16px 16px 100px" }}>

            {/* Chapter card */}
            <div style={{ background:"linear-gradient(135deg,rgba(91,33,182,0.20),rgba(55,48,163,0.12))",
              border:"1px solid rgba(91,33,182,0.30)", borderRadius:20, padding:"20px", marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                <div style={{ width:54, height:54, borderRadius:14, flexShrink:0,
                  background:"linear-gradient(145deg,#4c1d95,#7c3aed)", display:"flex",
                  alignItems:"center", justifyContent:"center",
                  boxShadow:"0 8px 24px rgba(124,58,237,0.35)", fontSize:24 }}>⭐</div>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:9, fontWeight:800, color:"#a78bfa",
                    background:"rgba(91,33,182,0.2)", padding:"2px 8px", borderRadius:6,
                    letterSpacing:"0.08em", textTransform:"uppercase", display:"inline-block", marginBottom:6 }}>
                    Capítulo 1
                  </span>
                  <h2 style={{ fontWeight:900, fontSize:17, margin:"0 0 4px", color:"#e2e8f0" }}>A Lenda da Estrela</h2>
                  <p style={{ color:"#64748b", fontSize:12, margin:0, lineHeight:1.5 }}>
                    Um encontro inesperado, um reino em alerta e um segredo que mudará dois mundos.
                  </p>
                </div>
              </div>
              <div style={{ marginTop:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:11, color:"#64748b" }}>Progresso</span>
                  <span style={{ fontSize:11, color:"#a78bfa", fontWeight:800 }}>{done}/{total} · {pct}%</span>
                </div>
                <div style={{ height:6, borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:99, width:`${pct}%`,
                    background:"linear-gradient(90deg,#7c3aed,#a855f7)",
                    boxShadow:"0 0 12px rgba(168,85,247,0.5)", transition:"width 0.6s" }}/>
                </div>
              </div>
            </div>

            <p style={{ color:"#334155", fontSize:11, textAlign:"center", marginBottom:14, fontStyle:"italic" }}>
              ↑ As fases avançam de baixo para cima ↑
            </p>

            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {reversed.map(stage => (
                <StageCard key={stage.id} stage={stage} onPress={()=>handlePress(stage)} completedIds={completedIds}/>
              ))}
            </div>

            {pct === 100 && (
              <div style={{ marginTop:24, background:"rgba(234,179,8,0.10)",
                border:"1px solid rgba(234,179,8,0.25)", borderRadius:16, padding:"20px", textAlign:"center" }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🏆</div>
                <p style={{ fontWeight:900, fontSize:15, color:"#fbbf24", margin:"0 0 4px" }}>Capítulo 1 Concluído!</p>
                <p style={{ color:"#78716c", fontSize:12, margin:0 }}>Capítulo 2 em breve...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
