"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ArrowLeft, BookOpen, Swords, Home, Lock, SkipForward, Trophy, Star, Gift, X, Play, Check, Scroll, Zap, FastForward, Search } from "lucide-react"
import { useGame } from "@/contexts/game-context"

// ─── Types ────────────────────────────────────────────────────────────────────

type Emotion = "normal" | "happy" | "rage"
type CharacterId = "fehnon" | "calem" | "arthur" | "morgana" | "guard1" | "guard2"

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
  /** Efeito cinematográfico disparado ao exibir o painel. */
  fx?: "purpleLightning" | "shake"
  /** Entrada dramática do personagem à direita (surge no topo de um telhado). */
  revealRight?: boolean
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
    id: "c1s8", number: 10, title: "A Revelação", subtitle: "Cena 6", type: "scene",
    sceneData: { id: "c1s8", title: "A Revelação", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"Desapareça, Mefisto!", textType:"speech" },
      { id:"p2", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Como... meu Mefisto está sendo machucado?!", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"calem",name:"Calem",emotion:"happy",side:"right"}], speaker:"calem", speakerName:"Calem", text:"Conseguimos! Fehnon, você é incrível!", textType:"speech" },
      { id:"p4", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"rage",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Heh... Vocês acham que ganharam? Eu ainda tenho... uma carta na manga.", textType:"speech" },
      { id:"p5", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"calem",name:"Calem",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Uma carta na manga...?! O quê?!", textType:"speech" },
      { id:"p6", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"happy",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"E ela já está aqui há um bom tempo... apenas assistindo.", textType:"speech" },
    ]},
  },
  {
    id: "c1s9", number: 11, title: "A Carta na Manga", subtitle: "Cena Final", type: "scene",
    sceneData: { id: "c1s9", title: "A Carta na Manga", panels: [
      { id:"p1", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"arthur",name:"Rei Arthur",emotion:"happy",side:"right"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Você foi muito ingênuo, Fehnon. Vir me enfrentar sozinho... isso foi um erro.", textType:"speech", overlayCaption:"Telhados do Reino de Camelot — logo após a queda de Mefisto" },
      { id:"p2", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"arthur",name:"Rei Arthur",emotion:"happy",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Sozinho...? Do que você está falando? Você já perdeu, Arthur.", textType:"speech" },
      { id:"p3", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"narrator", speakerName:"", text:"CRAAACK!! Um raio roxo rasga o céu e explode a poucos passos de Fehnon, estilhaçando as telhas.", textType:"narrator", fx:"purpleLightning" },
      { id:"p4", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"fehnon", speakerName:"Fehnon", text:"O QUÊ?! De onde veio isso?!", textType:"speech", fx:"shake" },
      { id:"p5", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"morgana",name:"Morgana",emotion:"normal",side:"right"}], speaker:"narrator", speakerName:"", text:"No topo de uma das casas, uma silhueta observa tudo. Uma garota — imóvel, com raios roxos dançando entre seus dedos.", textType:"narrator", revealRight:true },
      { id:"p6", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"normal",side:"left"},{id:"morgana",name:"Morgana",emotion:"happy",side:"right"}], speaker:"morgana", speakerName:"Morgana", text:"Hahaha! Então é ESSE o famoso Fehnon? Sério? Achei que fosse maior.", textType:"speech" },
      { id:"p7", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"morgana",name:"Morgana",emotion:"happy",side:"right"}], speaker:"morgana", speakerName:"Morgana", text:"Vou ajudar meu irmão a te derrotar. E, sinceramente, isso não vai demorar nada.", textType:"speech" },
      { id:"p8", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"morgana",name:"Morgana",emotion:"normal",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Irmão...? Arthur tem uma irmã?! Ninguém no reino nunca falou disso...", textType:"thought" },
      { id:"p9", bg: BG.camelot, characters:[{id:"arthur",name:"Rei Arthur",emotion:"happy",side:"right"},{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"}], speaker:"arthur", speakerName:"Rei Arthur", text:"Minha irmã, Morgana. A verdadeira carta na manga de Camelot.", textType:"speech" },
      { id:"p10", bg: BG.camelot, characters:[{id:"fehnon",name:"Fehnon",emotion:"rage",side:"left"},{id:"morgana",name:"Morgana",emotion:"rage",side:"right"}], speaker:"fehnon", speakerName:"Fehnon", text:"Não importa! Um ou dois, tanto faz — eu vou fazer de TUDO para derrotar vocês dois!", textType:"speech" },
      { id:"p11", bg: BG.camelot, characters:[], speaker:"narrator", speakerName:"", text:"— A ser continuado no Capítulo 2 —", textType:"narrator", overlayCaption:"Fim do Capítulo 1" },
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

/** Artes dos baús de capítulo, na mesma ordem de CHAPTER_CHESTS. */
const CHEST_ART: Record<string, string> = {
  c1chest1: "/images/chests/bau-bronze.png",
  c1chest2: "/images/chests/bau-prata.png",
  c1chest3: "/images/chests/bau-ouro.png",
}

/** Artes oficiais dos itens/moedas do jogo. */
const ITEM_ART = {
  gear:  "/images/gear-coin.png",
  gacha: "/images/icons/gacha-coin.png",
  galio: "/images/fragments/fragmento-galio.png",
} as const

const GALIO_IMG = ITEM_ART.galio
const BOSS_IMG  = "/images/mefisto-foles.png"

/** Ícone de item com a arte oficial e brilho na cor do recurso. */
function ItemIcon({ kind, size = 20 }: { kind: keyof typeof ITEM_ART; size?: number }) {
  const glow = { gear: "rgba(251,191,36,0.55)", gacha: "rgba(192,132,252,0.55)", galio: "rgba(226,232,240,0.45)" }[kind]
  return (
    <img src={ITEM_ART[kind] || "/placeholder.svg"} alt="" aria-hidden="true"
      onError={e => { e.currentTarget.style.display = "none" }}
      style={{ width:size, height:size, objectFit:"contain", flexShrink:0,
        filter:`drop-shadow(0 0 5px ${glow})` }}/>
  )
}

/** Custo de stamina da Varredura (Sweep) por tipo de fase. */
const SWEEP_COST: Record<"battle" | "boss", number> = { battle: 5, boss: 10 }

/** Código tático da operação (exibido no painel e nas plaquetas do mapa). */
function stageCode(stage: Stage) {
  return `1-${stage.number}`
}

/** Briefing curto de cada fase, exibido no painel de operação. */
const STAGE_DESC: Record<string, string> = {
  c1s1:   "Uma casa isolada no topo da colina, fora do reino. Um fugitivo invade a vida pacata de Calem — e nada mais será como antes.",
  c1s2:   "Os guardas cercaram a colina. Abra caminho pela floresta e proteja Calem antes que o cerco se feche.",
  c1s3:   "Ruínas esquecidas além dos limites do reino. Nas paredes gastas, a lenda da estrela que realiza desejos.",
  c1s4:   "Uma rachadura roxa rasga o céu. Calem foi levado — e uma voz marca o encontro em Camelot antes do meio-dia.",
  c1b1:   "Os portões do reino estão trancados e vigiados. Ninguém entra sem autorização. Fehnon não pediu permissão.",
  c1s5:   "No salão do trono, Rei Arthur revela seu jogo: ele quer os segredos dos Poderes Ultimates da estrela misteriosa.",
  c1s6:   "A recusa vira sentença. Soldados de elite invadem o salão — só existe uma saída, e é lutando.",
  c1s7:   "Raios roxos caem sobre Camelot. Nos telhados do reino, Arthur prepara a invocação do seu Ultimate Guardian.",
  c1boss: "Mefisto, o Guardião de Arthur, desperta em sua forma completa. A Protonix Sword contra o poder de um reino inteiro.",
  c1s8:   "O guardião tomba, mas Arthur ainda sorri. Uma carta na manga não foi jogada...",
  c1s9:   "Um raio roxo explode nas telhas. No topo de uma casa, alguém observava desde o começo — e ela não veio sozinha por acaso.",
}

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
    if (id === "morgana") return "linear-gradient(135deg,#4c1d95,#7c3aed)"
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
      <div key={`bg-${panel.id}`} style={{ position:"absolute", inset:0, backgroundImage:`url(${panel.bg})`,
        backgroundSize:"cover", backgroundPosition:"center", filter:"brightness(0.70)",
        animation: panel.fx ? "sceneShake .55s cubic-bezier(.36,.07,.19,.97) both" : undefined }}/>
      <div style={{ position:"absolute", inset:0,
        background:"linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.0) 42%, rgba(0,0,0,0.10) 100%)" }}/>

      {/* Raio roxo caindo perto do personagem */}
      {panel.fx === "purpleLightning" && (
        <div key={`fx-${panel.id}`} aria-hidden="true"
          style={{ position:"absolute", inset:0, zIndex:22, pointerEvents:"none" }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(167,110,255,0.6)",
            mixBlendMode:"screen", animation:"boltFlash 1s ease-out both" }}/>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none"
            style={{ position:"absolute", top:0, left:"20%", width:"17%", height:"84%",
              animation:"boltStrike .9s ease-out both",
              filter:"drop-shadow(0 0 14px rgba(167,110,255,0.95))" }}>
            <path d="M62 0 L40 34 L58 36 L28 78 L44 52 L26 50 L48 12 Z"
              fill="#e9d5ff" stroke="#a855f7" strokeWidth="1.2"/>
            <path d="M62 0 L40 34 L58 36 L28 78" fill="none"
              stroke="#f5f3ff" strokeWidth="2.4" strokeLinejoin="miter"/>
          </svg>
          <div style={{ position:"absolute", left:"22%", bottom:100, width:"30%", height:150,
            transform:"translateX(-40%)",
            background:"radial-gradient(closest-side, rgba(216,180,254,0.85), rgba(147,51,234,0.35), transparent 75%)",
            animation:"boltImpact 1s ease-out both" }}/>
        </div>
      )}

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
              <div key={i} style={{ width: i===safeIdx ? 16 : 5, height:4, borderRadius:99,
                background: i===safeIdx ? "#8b5cf6" : i<safeIdx ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.18)",
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
        <img key={`right-${panel.id}`} src={charImg(right.id, right.emotion)} alt={right.name}
          style={{ position:"absolute", bottom:126, right:0,
            height:"calc(100vh - 174px)", width:"auto", maxWidth:"48%",
            objectFit:"contain", objectPosition:"bottom", transform:"scaleX(-1)",
            pointerEvents:"none", opacity: fading ? 0 : 1, transition:"opacity 0.14s ease",
            filter: charFilter(isRightSpeaking), zIndex:10, display:"block",
            animation: panel.revealRight ? "charDrop .85s cubic-bezier(.22,1,.36,1) both" : undefined }}/>
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

      <style>{`
        @keyframes blink { 0%,100%{opacity:.22} 50%{opacity:0.9} }
        @keyframes boltFlash {
          0%{opacity:0} 5%{opacity:.85} 13%{opacity:.1} 20%{opacity:.6}
          32%{opacity:.05} 100%{opacity:0}
        }
        @keyframes boltStrike {
          0%{opacity:0; transform:translateY(-14%) scaleY(.5)}
          8%{opacity:1; transform:translateY(0) scaleY(1)}
          26%{opacity:.15} 38%{opacity:.9} 60%{opacity:0} 100%{opacity:0}
        }
        @keyframes boltImpact {
          0%{opacity:0; transform:translateX(-40%) scale(.3)}
          12%{opacity:1; transform:translateX(-40%) scale(1)}
          100%{opacity:0; transform:translateX(-40%) scale(1.5)}
        }
        @keyframes sceneShake {
          0%,100%{transform:translate3d(0,0,0)}
          12%{transform:translate3d(-9px,4px,0)}
          26%{transform:translate3d(8px,-5px,0)}
          42%{transform:translate3d(-6px,3px,0)}
          58%{transform:translate3d(5px,-2px,0)}
          76%{transform:translate3d(-3px,1px,0)}
        }
        @keyframes charDrop {
          0%{opacity:0; transform:scaleX(-1) translateY(-46px); filter:brightness(3) saturate(1.6)}
          55%{opacity:1; filter:brightness(1.6)}
          100%{opacity:1; transform:scaleX(-1) translateY(0)}
        }
      `}</style>
    </div>
  )
}

// ─── Drop Row (linha de recompensa nos pop-ups) ───────────────────────────────

function DropRow({ kind, amount, obtained }: { kind: "gear" | "gacha" | "galio" | "star"; amount: number; obtained?: boolean }) {
  const meta = {
    gear:  { label: "Gear Coins",           color: "#fbbf24", frame: "rgba(251,191,36,0.28)",  frameBg: "rgba(251,191,36,0.08)" },
    gacha: { label: "Gacha Coins",          color: "#c084fc", frame: "rgba(192,132,252,0.28)", frameBg: "rgba(192,132,252,0.08)" },
    galio: { label: "Fragmentos de Gálio",  color: "#e2e8f0", frame: "rgba(226,232,240,0.22)", frameBg: "rgba(226,232,240,0.06)" },
    star:  { label: "Estrelas de Capítulo", color: "#facc15", frame: "rgba(250,204,21,0.28)",  frameBg: "rgba(250,204,21,0.08)" },
  }[kind]

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      background:"linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
      border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:12, padding:"7px 12px 7px 8px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:9, flexShrink:0,
          background:meta.frameBg, border:`1px solid ${meta.frame}`,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          {kind === "star"
            ? <Star size={17} color={meta.color} fill={meta.color}
                style={{ filter:"drop-shadow(0 0 4px rgba(250,204,21,0.6))" }}/>
            : <ItemIcon kind={kind} size={24}/>}
        </div>
        <span style={{ color:"#e2e8f0", fontSize:12, fontWeight:700, letterSpacing:"0.01em" }}>{meta.label}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ color:meta.color, fontWeight:900, fontSize:14,
          textShadow:`0 0 10px ${meta.frame}` }}>x{amount}</span>
        {obtained && <Check size={14} color="#4ade80"/>}
      </div>
    </div>
  )
}

// ─── Painel de Operação (lateral, estilo tático) ──────────────────────────────

/** Tile quadrado de recompensa (drops no rodapé do painel). */
function DropTile({ kind, amount, obtained, accent }: {
  kind: "gear" | "gacha" | "galio" | "star"; amount: number; obtained?: boolean; accent: string
}) {
  const meta = {
    gear:  { label: "Gear",     color: "#fbbf24" },
    gacha: { label: "Gacha",    color: "#c084fc" },
    galio: { label: "Gálio",    color: "#e2e8f0" },
    star:  { label: "Estrelas", color: "#facc15" },
  }[kind]
  return (
    <div style={{ position:"relative", width:64, flexShrink:0,
      display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <div style={{ position:"relative", width:54, height:54, borderRadius:"50%",
        background:"radial-gradient(circle at 35% 30%, #3a3f46 0%, #16181d 72%)",
        border:`2px solid ${obtained ? "rgba(120,220,130,0.85)" : "#e7b93c"}`,
        boxShadow: obtained
          ? "0 0 8px rgba(74,222,128,0.35), inset 0 2px 6px rgba(0,0,0,0.6)"
          : "0 0 10px rgba(231,185,60,0.30), inset 0 2px 6px rgba(0,0,0,0.6)",
        display:"flex", alignItems:"center", justifyContent:"center" }}>
        {kind === "star"
          ? <Star size={24} color={meta.color} fill={meta.color}
              style={{ filter:"drop-shadow(0 0 5px rgba(250,204,21,0.6))" }}/>
          : <ItemIcon kind={kind} size={32}/>}
        {/* Quantidade em placa chanfrada, encostada na borda do anel */}
        <span style={{ position:"absolute", bottom:-3, right:-6, color:"#fff",
          background:"rgba(8,10,14,0.94)", border:"1px solid rgba(255,255,255,0.25)",
          padding:"0 6px", fontSize:10, fontWeight:900, fontStyle:"italic",
          clipPath:"polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)" }}>x{amount}</span>
        {obtained && (
          <span style={{ position:"absolute", top:-3, left:-3, width:16, height:16,
            borderRadius:"50%", background:"#14532d", border:"1px solid #22c55e",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Check size={9} color="#4ade80" strokeWidth={4}/>
          </span>
        )}
      </div>
      <span style={{ fontSize:8, fontWeight:800, letterSpacing:".08em", textTransform:"uppercase",
        color: obtained ? "#4ade80" : "#9aa3ad", whiteSpace:"nowrap" }}>
        {obtained ? "Obtido" : meta.label}
      </span>
    </div>
  )
}

/** Medalha de desempenho (losango com estrela), estilo emblema de operação. */
function Medal({ earned, accent, delay }: { earned: boolean; accent: string; delay: number }) {
  return (
    <div style={{ width:30, height:30, transform:"rotate(45deg)",
      background: earned
        ? "linear-gradient(135deg,rgba(250,204,21,0.28),rgba(250,204,21,0.08))"
        : "rgba(255,255,255,0.04)",
      border:`1px solid ${earned ? "#facc15" : "rgba(255,255,255,0.14)"}`,
      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
      boxShadow: earned ? "0 0 12px rgba(250,204,21,0.35)" : "none",
      animation:`opMedalIn .5s cubic-bezier(.34,1.56,.64,1) ${delay}s backwards` }}>
      <Star size={14} style={{ transform:"rotate(-45deg)",
          filter: earned ? "drop-shadow(0 0 4px rgba(250,204,21,0.8))" : "none" }}
        color={earned ? "#facc15" : "rgba(255,255,255,0.22)"}
        fill={earned ? "#facc15" : "transparent"}/>
    </div>
  )
}

function StageInfoModal({
  stage, completed, battleRating, stamina, onPlay, onSweep, onClose,
}: {
  stage: Stage; completed: boolean; battleRating: number; stamina: number
  onPlay: () => void; onSweep: () => void; onClose: () => void
}) {
  const drops = STAGE_DROPS[stage.type]
  const stars = STAGE_STARS[stage.type]
  const isBattle = stage.type === "battle" || stage.type === "boss"
  const isBoss   = stage.type === "boss"
  const code     = stageCode(stage)
  const desc     = STAGE_DESC[stage.id] ?? ""
  const entryCost    = isBattle ? SWEEP_COST[stage.type as "battle" | "boss"] : 0
  const sweepCost    = entryCost
  const sweepReady   = isBattle && completed && battleRating >= 3
  const sweepCanPay  = stamina >= sweepCost

  const typeMeta = {
    scene:  { label:"Cena de História", opLabel:"Operação de História", accent:"#9b7bff",
      accentDim:"rgba(155,123,255,0.55)", grad:"linear-gradient(180deg,#6d4fd8,#4527a0)",
      glow:"rgba(124,92,255,0.45)" },
    battle: { label: stage.preDialogue ? "Batalha com Diálogo" : "Batalha", opLabel:"Operação Padrão", accent:"#2fb5e8",
      accentDim:"rgba(47,181,232,0.55)", grad:"linear-gradient(180deg,#2fb5e8,#0f7fb4)",
      glow:"rgba(47,181,232,0.45)" },
    boss:   { label:"Boss Battle", opLabel:"Operação Crítica", accent:"#ff5f4a",
      accentDim:"rgba(255,95,74,0.55)", grad:"linear-gradient(180deg,#e2492f,#8f1d0e)",
      glow:"rgba(226,73,47,0.5)" },
  }[stage.type]

  // Miniaturas táticas do briefing (inimigo / mapa)
  const mapThumb   = stage.sceneData?.panels[0]?.bg ?? stage.preDialogue?.panels[0]?.bg ?? BG.camelot
  const enemyThumb = isBoss ? BOSS_IMG : isBattle ? charImg("guard1", "normal") : charImg("calem", "normal")

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:250,
      fontFamily:"'Segoe UI',system-ui,sans-serif",
      background:"linear-gradient(90deg,rgba(3,4,7,0.10) 0%,rgba(3,4,7,0.40) 45%,rgba(3,4,7,0.85) 100%)",
      animation:"opBackdropIn .3s ease both" }}>

      <aside onClick={e=>e.stopPropagation()} role="dialog" aria-label={`Operação ${code} — ${stage.title}`}
        style={{ position:"absolute", top:0, right:0, bottom:0,
          width:"min(440px, 100%)", display:"flex", flexDirection:"column",
          background:"linear-gradient(180deg,rgba(17,19,23,0.97) 0%,rgba(10,12,15,0.99) 100%)",
          borderLeft:"1px solid rgba(255,255,255,0.10)",
          boxShadow:"-30px 0 70px rgba(0,0,0,0.7)",
          backdropFilter:"blur(14px)",
          animation:"opPanelIn .42s cubic-bezier(.22,1,.36,1) both" }}>

        {/* Textura diagonal sutil no painel inteiro */}
        <div aria-hidden="true" style={{ position:"absolute", inset:0, pointerEvents:"none", opacity:0.04,
          background:"repeating-linear-gradient(-55deg, transparent 0 10px, #fff 10px 11px)" }}/>

        {/* ── Cabeçalho da operação: bloco de tipo + código gigante ── */}
        <header style={{ position:"relative", padding:"16px 16px 14px",
          background:"rgba(4,5,7,0.92)",
          borderBottom:"1px solid rgba(255,255,255,0.08)",
          display:"flex", alignItems:"stretch", gap:14, overflow:"hidden" }}>
          <div aria-hidden="true" style={{ position:"absolute", inset:0, opacity:0.06,
            background:"repeating-linear-gradient(-55deg, transparent 0 14px, #fff 14px 15px)" }}/>

          <button onClick={onClose} aria-label="Fechar"
            style={{ position:"absolute", top:10, right:10, zIndex:3,
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.18)",
              width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", clipPath:"polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
            <X size={15} color="#e2e8f0"/>
          </button>

          {/* Bloco de tipo (à la "Standard Operation") */}
          <div style={{ position:"relative", zIndex:2, width:56, flexShrink:0,
            background:typeMeta.grad, boxShadow:`0 0 20px ${typeMeta.glow}`,
            clipPath:"polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3 }}>
            {isBattle
              ? <Swords size={22} color="#fff" style={{ filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}/>
              : <Scroll size={22} color="#fff" style={{ filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}/>}
            <span style={{ color:"rgba(255,255,255,0.92)", fontSize:7.5, fontWeight:900,
              letterSpacing:".16em" }}>{isBoss ? "BOSS" : isBattle ? "COMBATE" : "HISTÓRIA"}</span>
          </div>

          <div style={{ position:"relative", zIndex:2, flex:1, minWidth:0 }}>
            <div style={{ color:typeMeta.accent, fontSize:9.5, fontWeight:900,
              letterSpacing:".26em", textTransform:"uppercase" }}>{typeMeta.opLabel}</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, marginTop:1 }}>
              <span style={{ color:"#fff", fontSize:44, fontWeight:900, fontStyle:"italic",
                lineHeight:1.05, letterSpacing:".03em",
                textShadow:"0 2px 14px rgba(0,0,0,0.7)" }}>{code}</span>
              {isBoss && (
                <span style={{ background:"rgba(226,73,47,0.18)", border:"1px solid rgba(255,95,74,0.6)",
                  color:"#ffb4a8", fontSize:9, fontWeight:900, letterSpacing:".18em",
                  padding:"2px 8px" }}>BOSS</span>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
              <h3 style={{ color:"#e5e7eb", fontWeight:800, fontSize:15, margin:"2px 0 0",
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                textShadow:"0 1px 8px rgba(0,0,0,0.5)" }}>{stage.title}</h3>
              {/* Medalhas de desempenho (batalhas) ou emblema de cena */}
              {isBattle ? (
                <div style={{ display:"flex", gap:9, flexShrink:0, paddingRight:2 }}>
                  {[1,2,3].map(i => (
                    <Medal key={i} earned={completed && battleRating >= i} accent={typeMeta.accent} delay={0.15 + i*0.08}/>
                  ))}
                </div>
              ) : (
                <div style={{ width:28, height:28, transform:"rotate(45deg)", flexShrink:0, marginRight:8,
                  background: completed ? "rgba(74,222,128,0.16)" : "rgba(255,255,255,0.06)",
                  border:`1px solid ${completed ? "#4ade80" : "rgba(255,255,255,0.28)"}`,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {completed
                    ? <Check size={13} color="#4ade80" strokeWidth={3.5} style={{ transform:"rotate(-45deg)" }}/>
                    : <Scroll size={13} color="rgba(255,255,255,0.75)" style={{ transform:"rotate(-45deg)" }}/>}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Faixa de recomendação (placa vermelha de alerta) ── */}
        <div style={{ margin:"14px 16px 0", display:"flex", alignItems:"center" }}>
          <span style={{ background: isBattle ? "#c8321f" : "#5b3bbd",
            color:"#fff", fontSize:9, fontWeight:900, letterSpacing:".12em", textTransform:"uppercase",
            padding:"4px 10px",
            clipPath:"polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
            {isBattle ? "Inimigo" : "História"}
          </span>
          <span style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)",
            borderLeft:"none", color:"#f3f4f6", fontSize:11, fontWeight:800, padding:"3px 12px 3px 14px",
            marginLeft:-6, clipPath:"polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
            {isBattle && stage.opponent ? `vs ${stage.opponent}` : typeMeta.label}
          </span>
          {completed && (
            <span style={{ marginLeft:"auto", color:"#4ade80", fontSize:10, fontWeight:800,
              letterSpacing:".08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:4 }}>
              <Check size={11} strokeWidth={3.5}/> Concluída
            </span>
          )}
        </div>

        {/* ── Briefing ── */}
        <div style={{ margin:"10px 16px 0", position:"relative", paddingLeft:12 }}>
          <div aria-hidden="true" style={{ position:"absolute", left:0, top:2, bottom:2, width:2,
            background:typeMeta.accentDim }}/>
          <p style={{ color:"#aeb7c0", fontSize:12, lineHeight:1.6, margin:0 }}>{desc}</p>
        </div>

        {/* ── Miniaturas táticas (Info do Inimigo / Mapa) ── */}
        <div style={{ margin:"14px 16px 0", display:"flex", gap:10 }}>
          {[
            { label: isBattle ? "Info do Inimigo" : "Personagens", img: enemyThumb },
            { label: "Mapa", img: mapThumb },
          ].map(t => (
            <div key={t.label} style={{ flex:1, position:"relative", height:76,
              border:"1px solid rgba(255,255,255,0.18)", overflow:"hidden",
              clipPath:"polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)",
              background:"#0a0c10" }}>
              <img src={t.img || "/placeholder.svg"} alt="" aria-hidden="true"
                onError={e => { e.currentTarget.style.display = "none" }}
                style={{ position:"absolute", inset:0, width:"100%", height:"100%",
                  objectFit:"cover", objectPosition:"center top",
                  opacity:0.55, filter:"grayscale(0.35) contrast(1.05)" }}/>
              <div aria-hidden="true" style={{ position:"absolute", inset:0,
                background:"linear-gradient(180deg,rgba(5,6,8,0.55) 0%,transparent 45%,rgba(5,6,8,0.35) 100%)" }}/>
              <span style={{ position:"absolute", top:0, left:0, background:"rgba(5,6,8,0.88)",
                color:"#e5e7eb", fontSize:8, fontWeight:900, letterSpacing:".1em",
                textTransform:"uppercase", padding:"3px 8px",
                clipPath:"polygon(0 0,100% 0,calc(100% - 7px) 100%,0 100%)" }}>{t.label}</span>
              <span aria-hidden="true" style={{ position:"absolute", top:"50%", left:"50%",
                transform:"translate(-50%,-50%)", width:26, height:26, borderRadius:"50%",
                background:"rgba(5,6,8,0.65)", border:"1px solid rgba(255,255,255,0.35)",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Search size={13} color="#e5e7eb"/>
              </span>
            </div>
          ))}
        </div>

        {/* ── Dica de desempenho (batalhas) ── */}
        {isBattle && (
          <div style={{ margin:"12px 16px 0", display:"flex", alignItems:"center", gap:9,
            background:"rgba(231,185,60,0.05)", border:"1px solid rgba(231,185,60,0.18)",
            padding:"8px 12px",
            clipPath:"polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }}>
            <RatingStars rating={completed ? battleRating : 0} size={13}/>
            <span style={{ color:"#aeb7c0", fontSize:10.5, fontWeight:600, lineHeight:1.4 }}>
              {completed
                ? (battleRating >= 3 ? "Desempenho perfeito — varredura liberada." : `Desempenho ${battleRating}/3 — vença com mais LP para melhorar.`)
                : "Vença mantendo seu LP alto para conquistar as 3 medalhas."}
            </span>
          </div>
        )}

        <div style={{ flex:1 }}/>

        {/* ── Recompensas (canto inferior, junto do iniciar) ── */}
        <div style={{ padding:"0 16px 12px", position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={{ background:"#f2f4f5", color:"#15171b", fontSize:9.5, fontWeight:900,
              letterSpacing:".14em", textTransform:"uppercase", padding:"3px 10px",
              clipPath:"polygon(0 0,100% 0,calc(100% - 7px) 100%,0 100%)" }}>
              {completed ? "Recompensas obtidas" : "Recompensas"}
            </span>
            {!completed && (
              <span style={{ background:"rgba(231,185,60,0.10)",
                border:"1px solid rgba(231,185,60,0.40)", color:"#e7b93c",
                fontSize:8.5, fontWeight:900, letterSpacing:".1em", textTransform:"uppercase",
                padding:"2px 7px" }}>1ª conclusão</span>
            )}
            <div aria-hidden="true" style={{ flex:1, height:1,
              background:"linear-gradient(90deg, rgba(255,255,255,0.14), transparent)" }}/>
          </div>
          <div style={{ display:"flex", gap:9, flexWrap:"wrap" }}>
            <DropTile kind="star" amount={stars} obtained={completed} accent={typeMeta.accent}/>
            {drops.gear  > 0 && <DropTile kind="gear"  amount={drops.gear}  obtained={completed} accent={typeMeta.accent}/>}
            {drops.gacha > 0 && <DropTile kind="gacha" amount={drops.gacha} obtained={completed} accent={typeMeta.accent}/>}
            {drops.galio > 0 && <DropTile kind="galio" amount={drops.galio} obtained={completed} accent={typeMeta.accent}/>}
          </div>
          {completed && (
            <p style={{ color:"#475569", fontSize:9.5, margin:"8px 0 0", fontStyle:"italic" }}>
              Drops de primeira conclusão já coletados — você pode rejogar a fase.
            </p>
          )}
        </div>

        {/* ── Barra de ação inferior (estilo Practice / Start) ── */}
        <div style={{ display:"flex", alignItems:"stretch", gap:8, padding:"0 16px 16px" }}>
          {isBattle && (
            <button onClick={sweepReady && sweepCanPay ? onSweep : undefined}
              disabled={!sweepReady || !sweepCanPay}
              title={!sweepReady
                ? "Conquiste as 3 medalhas para liberar a varredura."
                : sweepCanPay
                ? "Liberado por 3 medalhas: receba os drops sem jogar."
                : "Stamina insuficiente para varrer."}
              style={{ flexShrink:0, padding:"0 18px", border:"none",
                cursor: sweepReady && sweepCanPay ? "pointer" : "default",
                background: sweepReady
                  ? (sweepCanPay ? "linear-gradient(180deg,#e9ecee,#c3c9ce)" : "rgba(255,255,255,0.06)")
                  : "rgba(255,255,255,0.05)",
                outline:`1px solid ${sweepReady && sweepCanPay ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)"}`,
                outlineOffset:-1,
                clipPath:"polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 }}>
              <span style={{ display:"flex", alignItems:"center", gap:5,
                color: sweepReady ? (sweepCanPay ? "#15171b" : "#6b7280") : "#4b5563",
                fontWeight:900, fontSize:12, letterSpacing:".06em", textTransform:"uppercase" }}>
                {sweepReady ? <FastForward size={13}/> : <Lock size={12}/>} Varrer
              </span>
              <span style={{ display:"flex", alignItems:"center", gap:2, fontSize:10,
                color: sweepReady ? (sweepCanPay ? "#8f6a00" : "#b91c1c") : "#4b5563", fontWeight:800 }}>
                <Zap size={10}/> -{sweepCost}
              </span>
            </button>
          )}
          <button onClick={onPlay}
            style={{ flex:1, border:"none", cursor:"pointer", position:"relative",
              padding:"14px 16px", background:typeMeta.grad,
              clipPath:"polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%)",
              boxShadow:`0 6px 26px ${typeMeta.glow}`,
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              overflow:"hidden" }}
            onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.15)" }}
            onMouseLeave={e => { e.currentTarget.style.filter = "none" }}>
            <span aria-hidden="true" style={{ position:"absolute", inset:0, opacity:0.10,
              background:"repeating-linear-gradient(-55deg, transparent 0 12px, #fff 12px 13px)" }}/>
            <span aria-hidden="true" style={{ position:"absolute", top:0, bottom:0, left:"-40%", width:"30%",
              background:"linear-gradient(105deg, transparent, rgba(255,255,255,0.35), transparent)",
              animation:"opSheen 2.8s ease-in-out infinite" }}/>
            <Play size={17} color="#fff" fill="#fff" style={{ position:"relative" }}/>
            <span style={{ position:"relative", color:"#fff", fontWeight:900, fontSize:15,
              letterSpacing:".08em", textTransform:"uppercase", fontStyle:"italic" }}>
              {completed
                ? (isBattle ? "Rejogar" : "Reassistir")
                : (isBattle ? "Iniciar" : "Assistir")}
            </span>
            {isBattle && (
              <span style={{ position:"relative", display:"flex", alignItems:"center", gap:3,
                background:"rgba(0,0,0,0.35)", padding:"3px 9px", fontSize:11,
                color: stamina >= entryCost ? "#bfe9ff" : "#fca5a5", fontWeight:900,
                clipPath:"polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)" }}>
                <Zap size={11}/> -{entryCost}
              </span>
            )}
          </button>
        </div>

        <style>{`
          @keyframes opPanelIn {
            from { transform: translateX(60px); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
          @keyframes opBackdropIn {
            from { opacity: 0; } to { opacity: 1; }
          }
          @keyframes opMedalIn {
            from { transform: rotate(45deg) scale(0); opacity: 0; }
            to   { transform: rotate(45deg) scale(1); opacity: 1; }
          }
          @keyframes opEdgePulse {
            0%, 100% { opacity: 0.45; } 50% { opacity: 1; }
          }
          @keyframes opSheen {
            0%       { left: -40%; }
            55%, 100% { left: 115%; }
          }
        `}</style>
      </aside>
    </div>
  )
}

// ─── Chest Claim Pop-up ───────────────────────────────────────────────────────

function ChestClaimModal({
  chest, canClaim, claimed, onClaim, onClose,
}: { chest: ChapterChest; canClaim: boolean; claimed: boolean; onClaim: () => void; onClose: () => void }) {
  // Fases da animação de coleta: idle → shake (tremor) → burst (explosão de luz) → done
  const [openPhase, setOpenPhase] = useState<"idle" | "shake" | "burst">("idle")
  const [justOpened, setJustOpened] = useState(false)
  const opening = openPhase !== "idle"
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  const handleClaimClick = () => {
    if (!canClaim || opening) return
    setOpenPhase("shake")
    timers.current.push(setTimeout(() => {
      setOpenPhase("burst")
      setJustOpened(true)
      onClaim()
    }, 640))
    timers.current.push(setTimeout(() => setOpenPhase("idle"), 1900))
  }

  const handleClose = () => { if (!opening) onClose() }

  const rewardEntries = ([
    chest.rewards.gacha ? { kind: "gacha" as const, amount: chest.rewards.gacha } : null,
    chest.rewards.gear  ? { kind: "gear"  as const, amount: chest.rewards.gear  } : null,
    chest.rewards.galio ? { kind: "galio" as const, amount: chest.rewards.galio } : null,
  ]).filter(Boolean) as { kind: "gacha" | "gear" | "galio"; amount: number }[]

  return (
    <div onClick={handleClose} style={{ position:"fixed", inset:0, zIndex:250,
      background:"rgba(0,0,0,0.72)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:340,
        background:"linear-gradient(165deg,#151007,#0b0803)",
        border:"1px solid rgba(234,179,8,0.30)", borderRadius:18,
        padding:"22px 18px 18px", textAlign:"center",
        boxShadow:"0 20px 60px rgba(0,0,0,0.6)", position:"relative", overflow:"hidden" }}>

        <button onClick={handleClose} aria-label="Fechar"
          style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.06)",
            border:"1px solid rgba(255,255,255,0.10)", borderRadius:8, width:28, height:28,
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:6 }}>
          <X size={14} color="#94a3b8"/>
        </button>

        <div style={{ width:112, height:112, margin:"0 auto 8px", position:"relative",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ position:"absolute", inset:8, borderRadius:"50%",
            background: claimed && !opening
              ? "radial-gradient(circle,rgba(34,197,94,0.22) 0%,transparent 70%)"
              : "radial-gradient(circle,rgba(234,179,8,0.30) 0%,transparent 70%)",
            animation: claimed && !opening ? undefined : "chestGlow 2.2s ease-in-out infinite" }}/>

          <img src={CHEST_ART[chest.id] || "/placeholder.svg"} alt={chest.label}
            onError={e => { e.currentTarget.style.display = "none" }}
            style={{ width:"100%", height:"100%", objectFit:"contain", position:"relative", zIndex:2,
              filter: claimed && !opening
                ? "grayscale(0.5) brightness(0.75)"
                : openPhase === "burst"
                ? "drop-shadow(0 0 22px rgba(250,204,21,0.95)) brightness(1.25)"
                : "drop-shadow(0 6px 16px rgba(0,0,0,0.6))",
              animation: openPhase === "shake"
                ? "chestShakeAnim 0.64s cubic-bezier(.36,.07,.19,.97) forwards"
                : openPhase === "burst"
                ? "chestPopAnim 0.72s cubic-bezier(.34,1.56,.64,1)"
                : undefined,
              transition:"filter 0.35s ease" }}/>

          {/* Explosão de luz + feixe + ondas de choque + raios + fagulhas na coleta */}
          {openPhase === "burst" && (
            <>
              {/* Feixe de luz vertical subindo do baú */}
              <div aria-hidden="true" style={{ position:"absolute", left:"50%", bottom:"38%", zIndex:1,
                width:54, height:190, transform:"translateX(-50%)", transformOrigin:"bottom center",
                background:"linear-gradient(to top,rgba(253,224,71,0.55) 0%,rgba(255,247,214,0.30) 45%,transparent 100%)",
                clipPath:"polygon(32% 100%, 68% 100%, 100% 0%, 0% 0%)",
                animation:"chestBeam 1.1s ease-out forwards", pointerEvents:"none" }}/>
              {/* Clarão central */}
              <div aria-hidden="true" style={{ position:"absolute", inset:-8, borderRadius:"50%", zIndex:3,
                background:"radial-gradient(circle,rgba(255,251,235,0.98) 0%,rgba(253,224,71,0.60) 38%,transparent 70%)",
                animation:"chestFlash 0.70s ease-out forwards", pointerEvents:"none" }}/>
              {/* Ondas de choque em anel */}
              {[0, 0.14].map((delay, ri) => (
                <div key={ri} aria-hidden="true" style={{ position:"absolute", inset:0, zIndex:3,
                  borderRadius:"50%", border:`${ri ? 2 : 3}px solid rgba(253,224,71,${ri ? 0.55 : 0.85})`,
                  boxShadow:"0 0 18px rgba(250,204,21,0.55), inset 0 0 12px rgba(250,204,21,0.35)",
                  animation:`chestShockwave 0.85s cubic-bezier(.16,.84,.44,1) ${delay}s forwards`,
                  pointerEvents:"none" }}/>
              ))}
              {/* Raios giratórios */}
              <div aria-hidden="true" style={{ position:"absolute", inset:-22, zIndex:1,
                background:"conic-gradient(from 0deg, rgba(250,204,21,0.55) 0deg 9deg, transparent 9deg 45deg, rgba(250,204,21,0.45) 45deg 54deg, transparent 54deg 90deg, rgba(250,204,21,0.55) 90deg 99deg, transparent 99deg 135deg, rgba(250,204,21,0.45) 135deg 144deg, transparent 144deg 180deg, rgba(250,204,21,0.55) 180deg 189deg, transparent 189deg 225deg, rgba(250,204,21,0.45) 225deg 234deg, transparent 234deg 270deg, rgba(250,204,21,0.55) 270deg 279deg, transparent 279deg 315deg, rgba(250,204,21,0.45) 315deg 324deg, transparent 324deg 360deg)",
                borderRadius:"50%", animation:"chestRays 1.0s ease-out forwards", pointerEvents:"none" }}/>
              {/* Fagulhas radiais: círculos + estrelas de 4 pontas */}
              {Array.from({ length: 22 }).map((_, i) => {
                const ang    = (i / 22) * Math.PI * 2 + (i % 2 ? 0.19 : 0)
                const dist   = 54 + (i % 4) * 22
                const sz     = i % 3 === 0 ? 9 : i % 2 ? 6 : 4
                const isStarShape = i % 4 === 0
                return (
                  <div key={i} aria-hidden="true" style={{
                    position:"absolute", left:"50%", top:"50%", width:sz, height:sz, zIndex:4,
                    borderRadius: isStarShape ? 0 : "50%",
                    clipPath: isStarShape
                      ? "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)"
                      : undefined,
                    background: i % 3 === 0 ? "#fffbeb" : i % 3 === 1 ? "#fde047" : "#fbbf24",
                    boxShadow: isStarShape ? undefined : "0 0 10px rgba(250,204,21,0.95)",
                    ["--tx" as string]: `${Math.round(Math.cos(ang) * dist)}px`,
                    ["--ty" as string]: `${Math.round(Math.sin(ang) * dist)}px`,
                    ["--rot" as string]: `${(i % 2 ? 1 : -1) * (140 + (i % 3) * 90)}deg`,
                    animation:`${isStarShape ? "chestSparkle" : "chestParticle"} ${0.85 + (i % 3) * 0.12}s cubic-bezier(.17,.67,.35,1) ${i * 0.016}s forwards`,
                    pointerEvents:"none" }}/>
                )
              })}
              {/* Confete dourado flutuando para cima */}
              {Array.from({ length: 10 }).map((_, i) => {
                const offX = (i - 4.5) * 13 + (i % 2 ? 5 : -4)
                return (
                  <div key={`c${i}`} aria-hidden="true" style={{
                    position:"absolute", left:"50%", top:"46%", width: i % 2 ? 5 : 7, height: i % 2 ? 9 : 5,
                    zIndex:4, borderRadius:2,
                    background: i % 3 === 0 ? "#fde68a" : i % 3 === 1 ? "#facc15" : "#f59e0b",
                    ["--cx" as string]: `${offX}px`,
                    ["--rot" as string]: `${(i % 2 ? 1 : -1) * (200 + i * 40)}deg`,
                    animation:`chestConfetti ${1.05 + (i % 4) * 0.14}s cubic-bezier(.22,.78,.4,1) ${0.06 + i * 0.03}s forwards`,
                    opacity:0, pointerEvents:"none" }}/>
                )
              })}
            </>
          )}

          {claimed && !opening && (
            <div style={{ position:"absolute", bottom:2, right:2, width:28, height:28, zIndex:5,
              borderRadius:"50%", background:"#14532d", border:"2px solid #22c55e",
              display:"flex", alignItems:"center", justifyContent:"center",
              animation: justOpened ? "chestCheckPop 0.4s cubic-bezier(.34,1.56,.64,1) both" : undefined }}>
              <Check size={15} color="#4ade80" strokeWidth={3}/>
            </div>
          )}
        </div>
        <style>{`
          @keyframes chestGlow { 0%,100% { opacity:0.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.12); } }
          @keyframes chestShakeAnim {
            0%   { transform: rotate(0deg) scale(1); }
            8%   { transform: rotate(0deg) scale(0.94, 1.05); }
            18%  { transform: rotate(-8deg) scale(1.02); }
            30%  { transform: rotate(7deg)  scale(1.04); }
            42%  { transform: rotate(-7deg) scale(1.06); }
            54%  { transform: rotate(6deg)  scale(1.08); }
            66%  { transform: rotate(-5deg) scale(1.10); }
            78%  { transform: rotate(4deg)  scale(1.12); }
            90%  { transform: rotate(-2deg) scale(1.06, 0.94); }
            100% { transform: rotate(0deg)  scale(0.92, 1.10); }
          }
          @keyframes chestPopAnim {
            0%   { transform: scale(0.80, 1.14); }
            28%  { transform: scale(1.34, 0.92); }
            52%  { transform: scale(0.96, 1.08); }
            74%  { transform: scale(1.10, 0.97); }
            100% { transform: scale(1, 1); }
          }
          @keyframes chestFlash {
            0%   { opacity: 0.98; transform: scale(0.40); }
            100% { opacity: 0;    transform: scale(2.3);  }
          }
          @keyframes chestShockwave {
            0%   { opacity: 0.95; transform: scale(0.55); }
            100% { opacity: 0;    transform: scale(2.6);  }
          }
          @keyframes chestBeam {
            0%   { opacity: 0;    transform: translateX(-50%) scaleY(0.1); }
            25%  { opacity: 1;    transform: translateX(-50%) scaleY(1.05); }
            60%  { opacity: 0.85; transform: translateX(-50%) scaleY(1); }
            100% { opacity: 0;    transform: translateX(-50%) scaleY(1.15); }
          }
          @keyframes chestRays {
            0%   { opacity: 0.9; transform: scale(0.5) rotate(0deg);  }
            100% { opacity: 0;   transform: scale(2.0) rotate(40deg); }
          }
          @keyframes chestParticle {
            0%   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
            100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.25); }
          }
          @keyframes chestSparkle {
            0%   { opacity: 1; transform: translate(-50%,-50%) scale(0.4) rotate(0deg); }
            35%  { opacity: 1; transform: translate(calc(-50% + var(--tx) * 0.6), calc(-50% + var(--ty) * 0.6)) scale(1.25) rotate(calc(var(--rot) * 0.5)); }
            100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.2) rotate(var(--rot)); }
          }
          @keyframes chestConfetti {
            0%   { opacity: 0; transform: translate(calc(-50% + var(--cx) * 0.2), 0) rotate(0deg); }
            15%  { opacity: 1; }
            100% { opacity: 0; transform: translate(calc(-50% + var(--cx)), -118px) rotate(var(--rot)); }
          }
          @keyframes chestCheckPop {
            from { opacity: 0; transform: scale(0.3); }
            to   { opacity: 1; transform: scale(1);   }
          }
          @keyframes chestRewardIn {
            from { opacity: 0; transform: translateY(10px) scale(0.95); }
            to   { opacity: 1; transform: translateY(0)    scale(1);    }
          }
        `}</style>

        <h3 style={{ color:"#fbbf24", fontWeight:900, fontSize:17, margin:"0 0 2px" }}>{chest.label}</h3>
        <p style={{ color:"#78716c", fontSize:11, margin:"0 0 14px", display:"flex",
          alignItems:"center", justifyContent:"center", gap:4 }}>
          <Star size={11} color="#facc15" fill="#facc15"/> Requer {chest.stars} estrelas no capítulo
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16, textAlign:"left" }}>
          {rewardEntries.map((r, i) => (
            <div key={r.kind} style={ justOpened
              ? { animation:`chestRewardIn 0.45s cubic-bezier(.34,1.56,.64,1) ${0.35 + i * 0.13}s both` }
              : undefined }>
              <DropRow kind={r.kind} amount={r.amount} obtained={claimed}/>
            </div>
          ))}
        </div>

        {claimed && !opening ? (
          <p style={{ color:"#4ade80", fontSize:12, fontWeight:800, margin:0,
            animation: justOpened ? "chestRewardIn 0.45s ease 0.7s both" : undefined }}>
            Recompensas coletadas!
          </p>
        ) : opening ? (
          <p style={{ color:"#fde047", fontSize:12, fontWeight:800, margin:0 }}>Abrindo baú...</p>
        ) : (
          <button onClick={handleClaimClick} disabled={!canClaim}
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
      background:"rgba(5,6,8,0.92)", border:"1px solid rgba(255,255,255,0.12)",
      borderTop:"2px solid rgba(231,185,60,0.65)",
      clipPath:"polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)",
      padding:"10px 18px 14px", backdropFilter:"blur(14px)",
      boxShadow:"0 6px 26px rgba(0,0,0,0.55)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <Gift size={12} color="#e7b93c"/>
          <span style={{ color:"#f2f4f5", fontSize:9.5, fontWeight:900, letterSpacing:".2em",
            textTransform:"uppercase" }}>
            Baús do Capítulo
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"baseline", gap:3 }}>
          <Star size={11} color="#fde047" fill="#fde047" style={{ alignSelf:"center" }}/>
          <span style={{ color:"#fde047", fontWeight:900, fontSize:13, fontStyle:"italic" }}>
            {earnedStars}<span style={{ color:"#78591a", fontWeight:700, fontSize:10, fontStyle:"normal" }}>/{TOTAL_STARS}</span>
          </span>
        </div>
      </div>

      {/* Track + chests */}
      <div style={{ position:"relative", height:34, marginTop:2 }}>
        <div style={{ position:"absolute", top:"50%", left:0, right:0, height:7,
          transform:"translateY(-50%) skewX(-18deg)", background:"rgba(255,255,255,0.07)",
          boxShadow:"inset 0 1px 3px rgba(0,0,0,0.55)", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, position:"relative",
            background:"linear-gradient(90deg,#a16207,#eab308,#fde047)",
            boxShadow:"0 0 12px rgba(250,204,21,0.6)", overflow:"hidden",
            transition:"width 0.8s cubic-bezier(.22,.9,.35,1)" }}>
            {/* Brilho deslizante na barra */}
            <div aria-hidden="true" style={{ position:"absolute", inset:0,
              background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.55) 50%,transparent 100%)",
              width:"46%", animation:"chestBarShine 2.6s ease-in-out infinite" }}/>
          </div>
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
                width:42, height:42, borderRadius:12, cursor:"pointer",
                background:"transparent", border:"none", padding:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                filter: isReady ? "drop-shadow(0 0 14px rgba(250,204,21,0.85))" : "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
                animation: isReady ? "chestBounce 1.4s ease-in-out infinite" : undefined }}>
              {isReady && (
                <div aria-hidden="true" style={{ position:"absolute", inset:-4, borderRadius:"50%",
                  border:"2px solid rgba(253,224,71,0.75)",
                  animation:"chestReadyRing 1.6s ease-out infinite", pointerEvents:"none" }}/>
              )}
              <img src={CHEST_ART[chest.id] || "/placeholder.svg"} alt=""
                aria-hidden="true"
                onError={e => { e.currentTarget.style.display = "none" }}
                style={{ width:"100%", height:"100%", objectFit:"contain",
                  filter: !isClaimed && !isReady ? "grayscale(0.85) brightness(0.55)" : isClaimed ? "brightness(0.85)" : "none" }}/>
              {isClaimed && (
                <div style={{ position:"absolute", bottom:-3, right:-3, width:17, height:17,
                  borderRadius:"50%", background:"#14532d", border:"2px solid #22c55e",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Check size={9} color="#4ade80" strokeWidth={3.5}/>
                </div>
              )}
              {!isClaimed && !isReady && (
                <div style={{ position:"absolute", bottom:-3, right:-3, width:17, height:17,
                  borderRadius:"50%", background:"#0c1018", border:"1.5px solid #334155",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Lock size={9} color="#64748b"/>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes chestBounce {
          0%, 100% { transform: translate(-50%,-50%) scale(1); }
          50%      { transform: translate(-50%,-52%) scale(1.12); }
        }
        @keyframes chestBarShine {
          0%   { transform: translateX(-120%); }
          60%, 100% { transform: translateX(320%); }
        }
        @keyframes chestReadyRing {
          0%   { opacity: 0.85; transform: scale(0.9); }
          100% { opacity: 0;    transform: scale(1.55); }
        }
      `}</style>
    </div>
  )
}

// ─── Battle Intro ──────────────────────────────────────────────�����──────────────

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
      fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f1f5f9", overflow:"hidden" }}>
      {/* Cenário de fundo */}
      <div style={{ position:"absolute", inset:0,
        backgroundImage:"url(/images/camelot_scene.png)", backgroundSize:"cover",
        backgroundPosition:"center", filter:"brightness(0.22) saturate(0.7)",
        animation:"introBgZoom 14s ease-in-out infinite alternate" }}/>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background: isBoss
          ? "radial-gradient(ellipse 70% 50% at 50% 42%,rgba(220,38,38,0.26) 0%,transparent 70%)"
          : "radial-gradient(ellipse 70% 50% at 50% 42%,rgba(37,99,235,0.22) 0%,transparent 70%)" }}/>
      {/* Linhas de velocidade laterais */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", opacity:0.5,
        background:`repeating-linear-gradient(115deg, transparent 0 46px, ${isBoss ? "rgba(220,38,38,0.05)" : "rgba(59,130,246,0.05)"} 46px 48px)` }}/>

      <div style={{ textAlign:"center", position:"relative", zIndex:1, padding:"0 24px",
        animation:"introRise 0.45s ease both" }}>
        {/* Emblema central */}
        <div style={{ width:104, height:104, margin:"0 auto 14px", borderRadius:"50%",
          position:"relative",
          background: isBoss
            ? "radial-gradient(circle at 50% 35%,#450a0a,#1a0505)"
            : "radial-gradient(circle at 50% 35%,#172554,#060b16)",
          border:`3px solid ${isBoss ? "#dc2626" : "#3b82f6"}`,
          boxShadow: isBoss
            ? "0 0 40px rgba(220,38,38,0.5), inset 0 0 24px rgba(220,38,38,0.25)"
            : "0 0 40px rgba(59,130,246,0.45), inset 0 0 24px rgba(59,130,246,0.2)",
          display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
          {isBoss ? (
            <img src={BOSS_IMG || "/placeholder.svg"} alt="Mefisto"
              onError={e => { e.currentTarget.style.display = "none" }}
              style={{ position:"absolute", inset:0, width:"100%", height:"100%",
                objectFit:"cover", objectPosition:"center top" }}/>
          ) : (
            <Swords size={44} color="#93c5fd" style={{ filter:"drop-shadow(0 0 10px rgba(59,130,246,0.8))" }}/>
          )}
        </div>
        <div style={{ fontSize:10, fontWeight:900, letterSpacing:"0.22em",
          color: isBoss?"#f87171":"#60a5fa", textTransform:"uppercase",
          background: isBoss?"rgba(220,38,38,0.14)":"rgba(37,99,235,0.14)",
          border:`1px solid ${isBoss ? "rgba(220,38,38,0.35)" : "rgba(37,99,235,0.35)"}`,
          padding:"4px 16px", borderRadius:8, display:"inline-block", marginBottom:8 }}>
          {isBoss ? "⟨ Boss Battle ⟩" : "⟨ Batalha ⟩"}
        </div>
        <h1 style={{ fontWeight:900, fontSize:26, margin:"8px 0 4px", letterSpacing:"0.01em",
          textShadow: isBoss ? "0 0 24px rgba(220,38,38,0.55)" : "0 0 24px rgba(59,130,246,0.5)" }}>
          {stage.title}
        </h1>
        <p style={{ margin:"0 0 16px", fontSize:12, fontWeight:800, letterSpacing:"0.1em",
          color: isBoss ? "#fca5a5" : "#93c5fd", textTransform:"uppercase" }}>
          VS {stage.opponent ?? (isBoss ? "Rei Arthur" : "Guardas do Reino")}
        </p>
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
            style={{ padding:"12px 30px", borderRadius:11, border:"none",
               background: isBoss ? "linear-gradient(135deg,#7f1d1d,#dc2626)" : "linear-gradient(135deg,#1e3a8a,#3b82f6)",
               color: "#fff",
              fontWeight:900, fontSize:14, letterSpacing:"0.03em",
              cursor: "pointer",
              display:"flex", alignItems:"center", gap:8,
               boxShadow: isBoss ? "0 6px 26px rgba(220,38,38,0.5)" : "0 6px 26px rgba(59,130,246,0.5)",
              transition:"all 0.2s" }}>
            <Swords size={16}/>
            {isBoss ? "Batalha Final!" : "Iniciar Batalha!"}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes introBgZoom { from { transform: scale(1); } to { transform: scale(1.07); } }
        @keyframes introRise { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

// ─── Post-Battle Result ──────────��─��───────────────────────────────────────────

function PostBattleScreen({
  won, rewards, onReturnStory, onContinue,
}: { won:boolean; rewards: StageDropTable | null; onReturnStory:()=>void; onContinue:()=>void }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(16px)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f1f5f9", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background: won
          ? "radial-gradient(ellipse 70% 45% at 50% 38%,rgba(250,204,21,0.14) 0%,transparent 70%)"
          : "radial-gradient(ellipse 70% 45% at 50% 38%,rgba(220,38,38,0.14) 0%,transparent 70%)" }}/>
      <div style={{ textAlign:"center", padding:"0 24px", width:"100%", maxWidth:340,
        position:"relative", animation:"resultRise 0.45s ease both" }}>
        <div style={{ width:96, height:96, margin:"0 auto 16px", borderRadius:"50%",
          background: won
            ? "radial-gradient(circle at 50% 35%,#422006,#140a02)"
            : "radial-gradient(circle at 50% 35%,#450a0a,#160404)",
          border:`3px solid ${won ? "#facc15" : "#dc2626"}`,
          boxShadow: won
            ? "0 0 44px rgba(250,204,21,0.5), inset 0 0 22px rgba(250,204,21,0.2)"
            : "0 0 44px rgba(220,38,38,0.45), inset 0 0 22px rgba(220,38,38,0.2)",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          {won
            ? <Trophy size={44} color="#fde047" style={{ filter:"drop-shadow(0 0 12px rgba(250,204,21,0.8))" }}/>
            : <Swords size={44} color="#f87171" style={{ filter:"drop-shadow(0 0 12px rgba(220,38,38,0.8))" }}/>}
        </div>
        <h2 style={{ fontWeight:900, fontSize:26, margin:"0 0 8px", letterSpacing:"0.02em",
          color: won ? "#fde047" : "#f87171",
          textShadow: won ? "0 0 26px rgba(250,204,21,0.55)" : "0 0 26px rgba(220,38,38,0.5)" }}>
          {won ? "Vitória!" : "Derrota..."}
        </h2>
        <p style={{ color:"#94a3b8", fontSize:14, margin:"0 0 20px" }}>
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
            ← Voltar à Campanha
          </button>
        </div>
      </div>
      <style>{`@keyframes resultRise { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }`}</style>
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
      {stars > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <Star size={14} color="#facc15" fill="#facc15"/>
          <span style={{ color:"#facc15", fontWeight:900, fontSize:13 }}>+{stars}</span>
        </div>
      )}
      {drops.gear > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <ItemIcon kind="gear" size={17}/>
          <span style={{ color:"#fbbf24", fontWeight:900, fontSize:13 }}>+{drops.gear}</span>
        </div>
      )}
      {drops.gacha > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <ItemIcon kind="gacha" size={17}/>
          <span style={{ color:"#c084fc", fontWeight:900, fontSize:13 }}>+{drops.gacha}</span>
        </div>
      )}
      {drops.galio > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <ItemIcon kind="galio" size={17}/>
          <span style={{ color:"#e2e8f0", fontWeight:900, fontSize:13 }}>+{drops.galio}</span>
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
  { stageId: "c1boss", type: "boss",   label: "Mefisto",            sublabel: "Boss Battle",    x: 63,  y: 22 },
  { stageId: "c1s8",   type: "scene",  label: "A Revelação",        sublabel: "Cena 6",         x: 48,  y: 13 },
  { stageId: "c1s9",   type: "scene",  label: "A Carta na Manga",   sublabel: "Cena Final",     x: 34,  y: 19 },
]


// ─── Player Pawn: bonequinho que caminha pelo mapa ───────────────────────────
//
//  Fica ao LADO do nó atual (nunca em cima dele) e desliza suavemente até a
//  nova posição sempre que o jogador avança de fase.

const PAWN_SPRITE = "/images/player-storymode.png"
const PAWN_W = 54          // largura do sprite
const PAWN_H = 54          // altura do sprite
const PAWN_OFFSET_X = -86  // deslocamento à esquerda do centro do nó
const PAWN_OFFSET_Y = -56  // deslocamento acima do centro do nó (pés na trilha)

function PlayerPawn({ x, y }: { x: number; y: number }) {
  const prev = useRef({ x, y })
  const [facing, setFacing]   = useState<1 | -1>(1)
  const [walking, setWalking] = useState(false)

  useEffect(() => {
    const p = prev.current
    if (p.x === x && p.y === y) return
    setFacing(x < p.x ? -1 : 1)
    setWalking(true)
    prev.current = { x, y }
    const t = setTimeout(() => setWalking(false), 1250)
    return () => clearTimeout(t)
  }, [x, y])

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute", left: `${x}%`, top: `${y}%`,
        width: 0, height: 0, zIndex: 14, pointerEvents: "none",
        transition: "left 1.15s cubic-bezier(.42,.02,.32,1), top 1.15s cubic-bezier(.42,.02,.32,1)",
      }}
    >
      {/* Sombra elíptica no chão */}
      <div style={{
        position: "absolute",
        left: PAWN_OFFSET_X + PAWN_W / 2 - 15,
        top: PAWN_OFFSET_Y + PAWN_H - 6,
        width: 30, height: 9, borderRadius: "50%",
        background: "radial-gradient(50% 50%, rgba(0,0,0,0.55), transparent 72%)",
        animation: walking ? "storyPawnShadow .44s ease-in-out infinite" : undefined,
      }}/>

      {/* Halo de posição atual */}
      <div style={{
        position: "absolute",
        left: PAWN_OFFSET_X + PAWN_W / 2 - 20,
        top: PAWN_OFFSET_Y + PAWN_H - 13,
        width: 40, height: 40, borderRadius: "50%",
        border: "2px solid rgba(94,205,245,0.85)",
        transform: "scaleY(0.38)",
        animation: "storyPawnRing 2.1s ease-out infinite",
      }}/>

      {/* Sprite */}
      <div style={{
        position: "absolute", left: PAWN_OFFSET_X, top: PAWN_OFFSET_Y,
        width: PAWN_W, height: PAWN_H,
        animation: walking
          ? "storyPawnWalk .44s ease-in-out infinite"
          : "storyPawnIdle 2.6s ease-in-out infinite",
      }}>
        <img
          src={PAWN_SPRITE || "/placeholder.svg"}
          alt=""
          onError={e => { e.currentTarget.style.display = "none" }}
          style={{
            width: "100%", height: "100%", objectFit: "contain",
            imageRendering: "pixelated",
            transform: `scaleX(${facing})`,
            filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.75)) drop-shadow(0 0 9px rgba(94,205,245,0.45))",
          }}
        />
      </div>
    </div>
  )
}


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
  const playerNode =
    MAP_NODES.find(n => (playerNodeId === null ? n.stageId === null : n.stageId === playerNodeId)) ?? MAP_NODES[0]

  const isAccessible = (stageId: string) => {
    const idx = stages.findIndex(s => s.id === stageId)
    return idx === 0 || (idx > 0 && completedIds.has(stages[idx - 1].id))
  }

  return (
    <div style={{ position:"fixed", inset:0, overflow:"hidden",
      fontFamily:"'Segoe UI',system-ui,sans-serif" }}>

      {/* ── World background (maquete tática 3D) ── */}
      <img
        src="/images/story-map-tactical-bg.png"
        alt="" aria-hidden="true"
        onError={(e) => {
          const t = e.currentTarget
          if (t.dataset.fallback) return
          t.dataset.fallback = "1"
          t.src = "/images/gearperks-world.png"
        }}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%",
          objectFit:"cover", objectPosition:"center", pointerEvents:"none",
          filter:"saturate(0.72) contrast(1.14) brightness(0.94)",
          animation:"storyBgDrift 46s ease-in-out infinite alternate" }}
      />

      {/* Grade de cor cinematográfico: sombras frias azuladas + luz quente */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", mixBlendMode:"color",
        background:"linear-gradient(215deg, rgba(38,84,124,0.55) 0%, rgba(18,32,52,0.45) 55%, rgba(64,38,20,0.30) 100%)" }}/>
      {/* Feixe de luz quente varrendo a maquete (holofote de comando) */}
      <div aria-hidden="true" style={{ position:"absolute", inset:"-20%", pointerEvents:"none",
        mixBlendMode:"soft-light", opacity:0.9,
        background:"linear-gradient(115deg, transparent 30%, rgba(255,196,140,0.55) 46%, rgba(255,220,180,0.75) 50%, rgba(255,196,140,0.55) 54%, transparent 70%)",
        animation:"storySweep 14s ease-in-out infinite" }}/>
      {/* Overlay: vinheta escura + varredura fria no topo */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background:"radial-gradient(120% 90% at 50% 42%, transparent 36%, rgba(3,5,10,0.62) 100%), linear-gradient(180deg,rgba(3,5,10,0.60) 0%,rgba(3,5,10,0.06) 28%,rgba(3,5,10,0.08) 68%,rgba(3,5,10,0.68) 100%)" }}/>
      {/* Névoa azulada sutil (leitura das rotas) */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", mixBlendMode:"overlay",
        background:"linear-gradient(200deg,rgba(47,181,232,0.14) 0%,transparent 45%,rgba(47,181,232,0.08) 100%)" }}/>
      {/* Névoa baixa deslizando entre os prédios */}
      <div aria-hidden="true" style={{ position:"absolute", inset:0, pointerEvents:"none", opacity:0.5,
        background:"radial-gradient(60% 34% at 22% 82%, rgba(120,170,210,0.16), transparent 70%), radial-gradient(52% 30% at 74% 30%, rgba(120,170,210,0.12), transparent 70%)",
        animation:"storyFogDrift 22s ease-in-out infinite alternate" }}/>

      {/* Grade tática fina sobre a maquete */}
      <div aria-hidden="true" style={{ position:"absolute", inset:0, pointerEvents:"none", opacity:0.05,
        backgroundImage:"linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
        backgroundSize:"56px 56px" }}/>

      {/* Marca d'água do episódio (decoração de fundo, à la Arknights) */}
      <div aria-hidden="true" style={{ position:"absolute", right:"3%", bottom:"9%", zIndex:2,
        pointerEvents:"none", textAlign:"right", userSelect:"none" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:10, marginBottom:6 }}>
          <div style={{ width:"clamp(60px,10vw,140px)", height:1,
            background:"linear-gradient(90deg,transparent,rgba(94,205,245,0.55))" }}/>
          <span style={{ fontSize:10, fontWeight:900, letterSpacing:".5em", textTransform:"uppercase",
            color:"rgba(94,205,245,0.5)" }}>A Lenda da Estrela</span>
        </div>
        <div style={{ fontSize:"clamp(52px, 9vw, 118px)", fontWeight:900, fontStyle:"italic",
          lineHeight:0.9, letterSpacing:"-0.02em", color:"transparent",
          WebkitTextStroke:"1.5px rgba(255,255,255,0.14)" }}>EPISODE</div>
        <div style={{ fontSize:"clamp(52px, 9vw, 118px)", fontWeight:900, fontStyle:"italic",
          lineHeight:0.9, letterSpacing:".06em",
          background:"linear-gradient(180deg, rgba(94,205,245,0.22), rgba(94,205,245,0.04))",
          WebkitBackgroundClip:"text", backgroundClip:"text", color:"transparent",
          WebkitTextStroke:"1px rgba(94,205,245,0.18)" }}>01</div>
      </div>

      {/* Fagulhas flutuando sobre a maquete */}
      <div aria-hidden="true" style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:3, overflow:"hidden" }}>
        {[...Array(14)].map((_, i) => (
          <span key={i} style={{ position:"absolute",
            left:`${(i * 137) % 100}%`, top:`${(i * 61) % 100}%`,
            width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2, borderRadius:"50%",
            background: i % 4 === 0 ? "rgba(255,150,90,0.85)" : "rgba(255,196,140,0.6)",
            boxShadow:"0 0 6px rgba(255,150,90,0.8)",
            animation:`storyEmber ${7 + (i % 5) * 2.4}s linear ${-(i * 1.7)}s infinite` }}/>
        ))}
      </div>

      {/* Cantoneiras HUD */}
      {([["top","left"],["top","right"],["bottom","left"],["bottom","right"]] as const).map(([v,h]) => (
        <div key={v+h} aria-hidden="true" style={{ position:"absolute", zIndex:4, pointerEvents:"none",
          [v]: v === "top" ? 66 : 10, [h]: 10, width:22, height:22,
          [`border${v === "top" ? "Top" : "Bottom"}`]:"2px solid rgba(255,255,255,0.22)",
          [`border${h === "left" ? "Left" : "Right"}`]:"2px solid rgba(255,255,255,0.22)" } as React.CSSProperties}/>
      ))}

      {/* ── SVG path lines (rotas táticas retas, estilo mapa de operações) ── */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%",
        pointerEvents:"none", zIndex:5, overflow:"visible" }}>
        <defs>
          <filter id="storyLineGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {MAP_NODES.slice(0, -1).map((node, i) => {
          const next = MAP_NODES[i + 1]
          const lit  = node.stageId === null ? true : completedIds.has(node.stageId)
          // Segmento que leva à próxima operação disponível (fluxo azul animado)
          const isNextSeg = next.stageId === nextStageId
          const x1 = px(node.x), y1 = py(node.y)
          const x2 = px(next.x), y2 = py(next.y)
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
          const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
          // Pontos a 30% e 70% do trecho (ticks e chevrons direcionais)
          const p30 = { x: x1 + (x2 - x1) * 0.3, y: y1 + (y2 - y1) * 0.3 }
          const p70 = { x: x1 + (x2 - x1) * 0.7, y: y1 + (y2 - y1) * 0.7 }
          return (
            <g key={`seg-${i}`}>
              {/* Sombra dura da linha (profundidade sobre a maquete) */}
              <line x1={x1} y1={y1 + 2.5} x2={x2} y2={y2 + 2.5}
                stroke="rgba(0,0,0,0.55)" strokeWidth={lit ? 6 : 4}
                strokeLinecap="square" opacity={lit ? 0.85 : 0.4}/>
              {lit ? (
                <>
                  {/* Trilho branco sólido e nítido, com contorno escuro */}
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="rgba(10,12,16,0.9)" strokeWidth={5.5} strokeLinecap="square"/>
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="rgba(255,255,255,0.96)" strokeWidth={3.2}
                    strokeLinecap="square" filter="url(#storyLineGlow)"/>
                  {/* Ticks perpendiculares (marcação de rota) */}
                  {[p30, p70].map((p, j) => (
                    <line key={j} x1={p.x} y1={p.y - 5} x2={p.x} y2={p.y + 5}
                      transform={`rotate(${ang + 90} ${p.x} ${p.y})`}
                      stroke="rgba(255,255,255,0.75)" strokeWidth={2} strokeLinecap="square"/>
                  ))}
                  {/* Losango tático no meio do trecho */}
                  <rect x={mx - 4.5} y={my - 4.5} width={9} height={9}
                    transform={`rotate(45 ${mx} ${my})`}
                    fill={isNextSeg ? "#2fb5e8" : "#f2f4f5"}
                    stroke="rgba(0,0,0,0.55)" strokeWidth={1.2}/>
                  {isNextSeg && (
                    <>
                      <line x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke="#2fb5e8" strokeWidth={3.5} strokeLinecap="square"
                        strokeDasharray="12 16"
                        style={{ animation:"storyFlow 1.8s linear infinite",
                          filter:"drop-shadow(0 0 6px rgba(47,181,232,0.9))" }}/>
                      {/* Chevrons direcionais apontando para a próxima operação */}
                      {[p30, p70].map((p, j) => (
                        <path key={`ch-${j}`}
                          d={`M ${p.x - 5} ${p.y - 6} L ${p.x + 3} ${p.y} L ${p.x - 5} ${p.y + 6}`}
                          transform={`rotate(${ang} ${p.x} ${p.y})`}
                          fill="none" stroke="#8fdcf8" strokeWidth={2.5}
                          strokeLinecap="square" strokeLinejoin="miter"
                          style={{ animation:`storyChevron 1.4s ease-in-out ${j * 0.35}s infinite`,
                            filter:"drop-shadow(0 0 5px rgba(47,181,232,0.9))" }}/>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <>
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="rgba(255,255,255,0.28)" strokeWidth={2}
                    strokeLinecap="square" strokeDasharray="3 9"/>
                  {/* Losango apagado no meio do trecho bloqueado */}
                  <rect x={mx - 3} y={my - 3} width={6} height={6}
                    transform={`rotate(45 ${mx} ${my})`}
                    fill="rgba(255,255,255,0.14)" stroke="rgba(0,0,0,0.4)" strokeWidth={1}/>
                </>
              )}
            </g>
          )
        })}
      </svg>

      {/* ── Map Nodes: hexágono tático + plaqueta de operação ── */}
      {MAP_NODES.map((nodeDef, nodeIdx) => {
        const isStart     = nodeDef.stageId === null
        const stage       = isStart ? null : stages.find(s => s.id === nodeDef.stageId)
        const isCompleted = !isStart && !!stage && completedIds.has(nodeDef.stageId!)
        const accessible  = !isStart && isAccessible(nodeDef.stageId!)
        const isNext      = nodeDef.stageId === nextStageId
        const isPlayer    = isStart ? playerNodeId === null : nodeDef.stageId === playerNodeId

        const isBoss   = nodeDef.type === "boss"
        const isScene  = nodeDef.type === "scene"
        const isBattle = nodeDef.type === "battle"

        const rating   = !isStart && nodeDef.stageId ? (battleStars[nodeDef.stageId] ?? 0) : 0
        const canSweep = (isBattle || isBoss) && isCompleted && rating >= 3

        const unlocked = accessible || isStart
        const hexClip  = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)"
        const hexSize  = isBoss ? 54 : isStart ? 32 : 38
        const hexBg = !unlocked ? "linear-gradient(180deg,#262b31,#14171b)"
          : isStart  ? "linear-gradient(180deg,#3c434b,#1b1f24)"
          : isBoss   ? "linear-gradient(180deg,#e2492f,#8f1d0e)"
          : isNext   ? "linear-gradient(180deg,#5ecdf5,#1181b4)"
          : isScene && !isCompleted ? "linear-gradient(180deg,#9b7bff,#5b2fd1)"
          : "linear-gradient(180deg,#2fb5e8,#0f7fb4)"
        const hexGlow = isPlayer ? "drop-shadow(0 0 12px rgba(94,205,245,0.9))"
          : isNext ? "drop-shadow(0 0 12px rgba(47,181,232,0.9))"
          : isBoss && accessible ? "drop-shadow(0 0 14px rgba(226,73,47,0.75))"
          : unlocked ? "drop-shadow(0 3px 6px rgba(0,0,0,0.6))"
          : "drop-shadow(0 2px 5px rgba(0,0,0,0.6))"

        return (
          <div key={nodeDef.stageId ?? "start"} style={{
            position:"absolute", left:`${nodeDef.x}%`, top:`${nodeDef.y}%`,
            transform:"translate(-50%,-50%)", zIndex: isBoss ? 12 : 10,
            display:"flex", flexDirection:"column", alignItems:"center", gap:5,
            animation:`storyNodeIn .55s cubic-bezier(.34,1.56,.64,1) ${nodeIdx * 0.06}s backwards`
              + (isNext
                ? `, storyNodeFloat ${4.6 + (nodeIdx % 3) * 0.7}s ease-in-out ${nodeIdx * 0.06 + 0.6}s infinite`
                : ""),
          }}>
            {/* Tag superior (à la "Limited Drop"): próximo ou varredura */}
            {isNext && (
              <div style={{ display:"flex", alignItems:"center", gap:5,
                background:"rgba(5,6,8,0.92)", border:"1px solid rgba(94,205,245,0.7)",
                padding:"3px 10px", marginBottom:2, whiteSpace:"nowrap",
                clipPath:"polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)",
                boxShadow:"0 2px 10px rgba(47,181,232,0.45)",
                animation:"storyBounce 1.6s ease-in-out infinite" }}>
                <Play size={9} color="#5ecdf5" fill="#5ecdf5"/>
                <span style={{ fontSize:9, fontWeight:900, color:"#cdeefb", letterSpacing:".1em" }}>PRÓXIMO</span>
              </div>
            )}
            {!isNext && canSweep && (
              <div title="Varredura liberada — 3 estrelas"
                style={{ display:"flex", alignItems:"center", gap:5,
                  background:"rgba(5,6,8,0.92)", border:"1px solid rgba(231,185,60,0.6)",
                  padding:"2px 9px", marginBottom:2, whiteSpace:"nowrap",
                  clipPath:"polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)" }}>
                <FastForward size={9} color="#e7b93c"/>
                <span style={{ fontSize:8, fontWeight:900, color:"#f3d27a", letterSpacing:".1em" }}>VARREDURA</span>
              </div>
            )}
            {isBoss && (
              <div style={{ background:"linear-gradient(180deg,#e2492f,#8f1d0e)",
                border:"1px solid rgba(255,180,168,0.5)", padding:"2px 10px", marginBottom:2,
                clipPath:"polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)" }}>
                <span style={{ color:"#ffe4de", fontSize:8, fontWeight:900, letterSpacing:".18em" }}>BOSS</span>
              </div>
            )}

            <button
              onClick={() => accessible && !isStart && stage ? onPress(stage) : undefined}
              disabled={!accessible || isStart}
              aria-label={`${nodeDef.label}${isCompleted ? " — concluída" : !accessible && !isStart ? " — bloqueada" : ""}`}
              style={{
                display:"flex", alignItems:"center", background:"transparent",
                border:"none", padding:0, position:"relative", outline:"none",
                cursor:accessible && !isStart ? "pointer" : "default",
                transition:"transform .35s cubic-bezier(.34,1.56,.64,1), filter .3s ease",
              }}
              onMouseEnter={e=>{ if(accessible&&!isStart){ const b=e.currentTarget as HTMLButtonElement; b.style.transform="scale(1.08) translateY(-2px)"; b.style.filter="brightness(1.15)" } }}
              onMouseLeave={e=>{ const b=e.currentTarget as HTMLButtonElement; b.style.transform="scale(1) translateY(0)"; b.style.filter="none" }}
            >
              {/* Anel de posição do jogador */}
              {isPlayer && (
                <div style={{ position:"absolute", left:hexSize/2, top:"50%",
                  transform:"translate(-50%,-50%)",
                  width:hexSize + 22, height:hexSize + 22, borderRadius:"50%",
                  border:"2px solid #5ecdf5",
                  animation:"storyPulseRing 1.8s ease-out infinite",
                  pointerEvents:"none" }}/>
              )}

              {/* Hexágono tático */}
              <div style={{ width:hexSize, height:hexSize, clipPath:hexClip,
                background:hexBg, position:"relative", zIndex:2, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                filter:hexGlow,
                animation: isBoss && accessible && !isCompleted ? "storyBossBreath 2.4s ease-in-out infinite" : undefined }}>
                {/* Facetas internas do hexágono */}
                <div aria-hidden="true" style={{ position:"absolute", inset:2, clipPath:hexClip,
                  background:"linear-gradient(165deg,rgba(255,255,255,0.30) 0%,rgba(255,255,255,0.04) 40%,transparent 55%, rgba(0,0,0,0.25) 100%)",
                  pointerEvents:"none" }}/>
                {isStart ? (
                  <Home size={15} color="#c8cfd6"/>
                ) : isBoss ? (
                  <>
                    <img src={BOSS_IMG || "/placeholder.svg"} alt="" aria-hidden="true"
                      onError={e => { e.currentTarget.style.display = "none" }}
                      style={{ position:"absolute", inset:0, width:"100%", height:"100%",
                        clipPath:hexClip, objectFit:"cover", objectPosition:"center top",
                        filter: !accessible ? "grayscale(1) brightness(0.35)" : "none" }}/>
                    {!accessible && (
                      <Lock size={20} color="#8a929b" style={{ position:"relative", zIndex:2 }}/>
                    )}
                  </>
                ) : !accessible ? (
                  <Lock size={15} color="#4b545e"/>
                ) : isCompleted ? (
                  <Check size={18} color="#fff" strokeWidth={4}
                    style={{ filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}/>
                ) : isScene ? (
                  <Scroll size={16} color="#fff" style={{ filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}/>
                ) : (
                  <Swords size={17} color="#fff" style={{ filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}/>
                )}
              </div>

              {/* Plaqueta da operação (código + nome) */}
              {!isStart && (
                <div style={{ marginLeft:-9, textAlign:"left", position:"relative",
                  background: unlocked ? "linear-gradient(180deg,#f7f8f9,#dfe4e8)" : "rgba(24,28,33,0.92)",
                  clipPath:"polygon(0 0,100% 0,calc(100% - 11px) 100%,0 100%)",
                  padding:"4px 22px 5px 17px", minWidth:96,
                  boxShadow:"0 4px 12px rgba(0,0,0,0.6)" }}>
                  <div style={{ fontSize:6.5, fontWeight:900, letterSpacing:".2em",
                    textTransform:"uppercase", lineHeight:1.3,
                    color: unlocked ? "#8a929b" : "#4b545e" }}>
                    {nodeDef.sublabel ?? "Operação"}
                  </div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                    <span style={{ fontSize:15, fontWeight:900, fontStyle:"italic", lineHeight:1.1,
                      color: unlocked ? "#15171b" : "#5b636c" }}>
                      {stage ? stageCode(stage) : "—"}
                    </span>
                    <span style={{ fontSize:8.5, fontWeight:800, lineHeight:1.2,
                      color: unlocked ? "#3c4650" : "#4b545e",
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:86 }}>
                      {nodeDef.label}
                    </span>
                  </div>
                  {/* Filete azul de status na base da plaqueta */}
                  <div aria-hidden="true" style={{ position:"absolute", left:0, right:8, bottom:0, height:2,
                    background: !unlocked ? "rgba(255,255,255,0.06)"
                      : isBoss ? "linear-gradient(90deg,#e2492f,transparent)"
                      : isCompleted ? "linear-gradient(90deg,#2fb5e8,transparent)"
                      : isNext ? "linear-gradient(90deg,#5ecdf5,transparent)"
                      : isScene ? "linear-gradient(90deg,#9b7bff,transparent)"
                      : "linear-gradient(90deg,#2fb5e8,transparent)" }}/>
                </div>
              )}

              {/* Rótulo do ponto de partida */}
              {isStart && (
                <div style={{ marginLeft:-8, background:"rgba(24,28,33,0.92)",
                  clipPath:"polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)",
                  padding:"3px 16px 3px 14px" }}>
                  <span style={{ fontSize:8.5, fontWeight:900, letterSpacing:".16em",
                    textTransform:"uppercase", color:"#8a929b" }}>Início</span>
                </div>
              )}
            </button>

            {/* Avaliação de 3 estrelas (batalhas e boss) */}
            {(isBattle || isBoss) && (accessible || isCompleted) && (
              <div style={{ background:"rgba(5,6,8,0.88)", border:"1px solid rgba(255,255,255,0.12)",
                padding:"2px 9px", marginTop:-1,
                clipPath:"polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)" }}>
                <RatingStars rating={rating} size={isBoss ? 12 : 10}/>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Bonequinho do jogador: caminha ao lado do nó alcançado ── */}
      {playerNode && <PlayerPawn x={playerNode.x} y={playerNode.y}/>}

      {/* ── Top header (barra tática angular) ── */}
      <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:50,
        background:"linear-gradient(180deg,rgba(4,5,8,0.94) 0%,rgba(4,5,8,0.86) 100%)",
        backdropFilter:"blur(14px)",
        borderBottom:"1px solid rgba(255,255,255,0.10)",
        padding:"0 14px 0 0", display:"flex", alignItems:"stretch", gap:0, height:56 }}>
        {/* Textura diagonal sutil */}
        <div aria-hidden="true" style={{ position:"absolute", inset:0, pointerEvents:"none", opacity:0.05,
          background:"repeating-linear-gradient(-55deg, transparent 0 12px, #fff 12px 13px)" }}/>

        {/* Bloco de voltar chanfrado */}
        <button onClick={onBack} aria-label="Voltar"
          style={{ position:"relative", background:"rgba(255,255,255,0.06)",
            border:"none", borderRight:"1px solid rgba(255,255,255,0.12)",
            padding:"0 22px 0 18px", cursor:"pointer", color:"#e2e8f0",
            display:"flex", alignItems:"center",
            clipPath:"polygon(0 0,100% 0,calc(100% - 14px) 100%,0 100%)",
            transition:"background .2s" }}
          onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.12)" }}
          onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.06)" }}>
          <ArrowLeft size={19}/>
        </button>

        {/* Divisor vertical */}
        <div aria-hidden="true" style={{ width:1, background:"rgba(255,255,255,0.14)",
          margin:"12px 0 12px 4px" }}/>

        {/* Emblema do episódio */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center",
          padding:"0 16px", minWidth:0, flex:1, position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <BookOpen size={12} color="#5ecdf5"/>
            <span style={{ fontSize:8.5, fontWeight:900, letterSpacing:".3em",
              textTransform:"uppercase", color:"#5ecdf5" }}>Episode 01 · Campanha</span>
          </div>
          <div style={{ display:"flex", alignItems:"baseline", gap:9 }}>
            <span style={{ fontWeight:900, fontSize:17, fontStyle:"italic", color:"#f2f4f5",
              letterSpacing:".02em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
              textShadow:"0 1px 8px rgba(0,0,0,0.6)" }}>A Lenda da Estrela</span>
          </div>
        </div>

        {/* Placa: estrelas (à la contador PLAN) */}
        <div style={{ display:"flex", alignItems:"center", alignSelf:"center", height:34 }}>
          <span style={{ height:"100%", display:"flex", alignItems:"center", gap:4,
            background:"#f2f4f5", padding:"0 10px",
            clipPath:"polygon(0 0,100% 0,calc(100% - 9px) 100%,0 100%)" }}>
            <Star size={12} color="#15171b" fill="#15171b"/>
            <span style={{ fontSize:8, fontWeight:900, letterSpacing:".14em", color:"#15171b" }}>STARS</span>
          </span>
          <span style={{ height:"100%", display:"flex", alignItems:"baseline", gap:2,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)",
            borderLeft:"none", padding:"6px 14px 0 16px", marginLeft:-7,
            clipPath:"polygon(9px 0,100% 0,100% 100%,0 100%)" }}>
            <span style={{ fontWeight:900, fontSize:19, fontStyle:"italic", color:"#fde047", lineHeight:1.3 }}>{earnedStars}</span>
            <span style={{ color:"#8a929b", fontWeight:700, fontSize:10 }}>/{TOTAL_STARS}</span>
          </span>
        </div>

        {/* Placa: stamina */}
        <div title="Energia — gasta ao iniciar batalhas e varrer fases"
          style={{ display:"flex", alignItems:"center", alignSelf:"center", height:34, marginLeft:10 }}>
          <span style={{ height:"100%", display:"flex", alignItems:"center",
            background:"linear-gradient(180deg,#2fb5e8,#0f7fb4)", padding:"0 9px",
            clipPath:"polygon(0 0,100% 0,calc(100% - 9px) 100%,0 100%)" }}>
            <Zap size={13} color="#fff" fill="#fff"/>
          </span>
          <span style={{ height:"100%", display:"flex", alignItems:"baseline", gap:2,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)",
            borderLeft:"none", padding:"6px 12px 0 15px", marginLeft:-7,
            clipPath:"polygon(9px 0,100% 0,100% 100%,0 100%)" }}>
            <span style={{ fontWeight:900, fontSize:19, fontStyle:"italic", color:"#f2f4f5", lineHeight:1.3 }}>{stamina}</span>
            <span style={{ color:"#8a929b", fontWeight:700, fontSize:10 }}>/{maxStamina}</span>
            {stamina < maxStamina && staminaNextTickSeconds > 0 && (
              <span style={{ fontSize:9, color:"#5ecdf5", fontWeight:700, marginLeft:5,
                fontVariantNumeric:"tabular-nums" }}>
                {String(Math.floor(staminaNextTickSeconds/60)).padStart(1,"0")}:{String(staminaNextTickSeconds%60).padStart(2,"0")}
              </span>
            )}
          </span>
        </div>

        {/* Progresso de fases */}
        <div title="Fases concluídas do capítulo"
          style={{ alignSelf:"center", textAlign:"right", marginLeft:14 }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:3 }}>
            <span style={{ fontSize:14, fontWeight:900, fontStyle:"italic", color:"#f2f4f5" }}>{done}</span>
            <span style={{ fontSize:9, fontWeight:700, color:"#8a929b" }}>/{total}</span>
          </div>
          <div style={{ display:"flex", gap:2, marginTop:3 }}>
            {stages.map((s, i) => (
              <div key={s.id} style={{ width:6, height:4,
                transform:"skewX(-18deg)",
                background: completedIds.has(s.id) ? "#2fb5e8" : "rgba(255,255,255,0.12)",
                boxShadow: completedIds.has(s.id) ? "0 0 4px rgba(47,181,232,0.7)" : "none",
                transition:"background .4s" }}/>
            ))}
          </div>
          <div style={{ fontSize:7, fontWeight:800, color:"#5b636c", letterSpacing:".16em",
            textTransform:"uppercase", marginTop:2 }}>Operações</div>
        </div>
      </div>

      {isChapterDone && (
        <div style={{ position:"absolute",top:66,left:"50%",transform:"translateX(-50%)",
          zIndex:60, background:"rgba(5,6,8,0.92)", border:"1px solid rgba(231,185,60,0.55)",
          borderTop:"2px solid #e7b93c",
          clipPath:"polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)",
          padding:"9px 30px 10px", display:"flex", alignItems:"center", gap:11,
          backdropFilter:"blur(12px)", whiteSpace:"nowrap",
          boxShadow:"0 6px 26px rgba(231,185,60,0.25)" }}>
          <Trophy size={19} color="#e7b93c"/>
          <div>
            <p style={{ fontWeight:900, fontSize:12, fontStyle:"italic", letterSpacing:".08em",
              textTransform:"uppercase", color:"#f3d27a", margin:0 }}>Episode 01 — Concluído</p>
            <p style={{ color:"#8a929b", fontSize:9.5, margin:0, letterSpacing:".04em" }}>Capítulo 2 em breve...</p>
          </div>
        </div>
      )}

      {/* ���─ Legend (placa tática angular) ── */}
      <div style={{ position:"absolute", left:12, bottom:76, zIndex:50,
        background:"rgba(5,6,8,0.92)", border:"1px solid rgba(255,255,255,0.14)",
        borderLeft:"3px solid #2fb5e8",
        clipPath:"polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)",
        padding:"9px 18px 13px 12px", display:"flex", flexDirection:"column", gap:7,
        backdropFilter:"blur(10px)", boxShadow:"0 4px 18px rgba(0,0,0,0.55)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <span style={{ fontSize:8.5, fontWeight:900, letterSpacing:".26em", textTransform:"uppercase",
            color:"#8a929b" }}>Legenda</span>
          <div aria-hidden="true" style={{ flex:1, height:1,
            background:"linear-gradient(90deg,rgba(255,255,255,0.18),transparent)" }}/>
        </div>
        {([
          { bg:"linear-gradient(180deg,#2fb5e8,#0f7fb4)", icon:<Swords size={11} color="#fff"/>, label:"Batalha" },
          { bg:"linear-gradient(180deg,#9b7bff,#5b2fd1)", icon:<Scroll size={11} color="#fff"/>, label:"Cena (história)" },
          { bg:"linear-gradient(180deg,#e2492f,#8f1d0e)", icon:<Swords size={11} color="#fff"/>, label:"Boss" },
        ] as const).map(item=>(
          <div key={item.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:20, height:20, flexShrink:0,
              clipPath:"polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
              background:item.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {item.icon}
            </div>
            <span style={{ fontSize:10, color:"#c8cfd6", fontWeight:800,
              letterSpacing:".04em" }}>{item.label}</span>
          </div>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Star size={13} color="#fde047" fill="#fde047"/>
          </div>
          <span style={{ fontSize:10, color:"#c8cfd6", fontWeight:800, letterSpacing:".04em" }}>Desempenho na batalha</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, flexShrink:0,
            clipPath:"polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
            background:"linear-gradient(180deg,#e7b93c,#8f6a00)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <FastForward size={10} color="#fff"/>
          </div>
          <span style={{ fontSize:10, color:"#c8cfd6", fontWeight:800, letterSpacing:".04em" }}>Varredura (3★)</span>
        </div>
      </div>

      {/* ── Chapter chest progress bar ── */}
      <ChestProgressBar earnedStars={earnedStars} claimed={claimedChests} onChestPress={onChestPress}/>

      {/* ── Bottom nav ── */}
      <div style={{ position:"absolute",bottom:0,left:0,right:0,zIndex:50,
        padding:"0 0 14px",display:"flex",justifyContent:"center",
        background:"linear-gradient(to top,rgba(2,6,16,0.92) 0%,transparent 100%)" }}>
        <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:9,
          background:"rgba(5,6,8,0.94)", border:"1px solid rgba(255,255,255,0.16)",
          clipPath:"polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%)",
          padding:"10px 34px", color:"#c8cfd6", fontWeight:900, fontSize:11.5,
          letterSpacing:".14em", textTransform:"uppercase", fontStyle:"italic",
          cursor:"pointer", boxShadow:"0 4px 20px rgba(0,0,0,0.4)",
          transition:"background .2s, color .2s" }}
          onMouseEnter={e=>{ e.currentTarget.style.background="rgba(242,244,245,0.95)"; e.currentTarget.style.color="#15171b" }}
          onMouseLeave={e=>{ e.currentTarget.style.background="rgba(5,6,8,0.94)"; e.currentTarget.style.color="#c8cfd6" }}>
          <Home size={13}/> Menu Principal
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
        @keyframes storyPawnIdle {
          0%, 100% { transform: translateY(0);      }
          50%      { transform: translateY(-2px);   }
        }
        @keyframes storyPawnWalk {
          0%   { transform: translateY(0)    rotate(-2deg); }
          25%  { transform: translateY(-5px) rotate(0deg);  }
          50%  { transform: translateY(0)    rotate(2deg);  }
          75%  { transform: translateY(-5px) rotate(0deg);  }
          100% { transform: translateY(0)    rotate(-2deg); }
        }
        @keyframes storyPawnShadow {
          0%, 100% { transform: scale(1);      opacity: 0.85; }
          50%      { transform: scale(0.7);    opacity: 0.45; }
        }
        @keyframes storyPawnRing {
          0%   { transform: scaleY(0.38) scale(0.75); opacity: 0.85; }
          100% { transform: scaleY(0.38) scale(1.6);  opacity: 0;    }
        }
        @keyframes storyFlow {
          to { stroke-dashoffset: -135; }
        }
        @keyframes storyFlowSlow {
          to { stroke-dashoffset: -160; }
        }
        @keyframes storyShimmer {
          0%   { stroke-dashoffset: 346;  opacity: 0;   }
          12%  { opacity: 0.9; }
          55%  { stroke-dashoffset: 0;    opacity: 0.9; }
          70%  { opacity: 0; }
          100% { stroke-dashoffset: -346; opacity: 0;   }
        }
        @keyframes storyAuraBreath {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1;    }
        }
        @keyframes storyNodeFloat {
          0%, 100% { transform: translate(-50%,-50%) translateY(0px);   }
          50%      { transform: translate(-50%,-50%) translateY(-4px);  }
        }
        @keyframes storySpinRing {
          from { transform: translate(-50%,-50%) rotate(0deg);   }
          to   { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes storyNodeIn {
          from { opacity: 0; transform: translate(-50%,-50%) scale(0.55); }
          to   { opacity: 1; transform: translate(-50%,-50%) scale(1);    }
        }
        @keyframes storyEmber {
          0%   { transform: translate(0, 12vh) scale(0.6); opacity: 0; }
          12%  { opacity: 0.9; }
          85%  { opacity: 0.7; }
          100% { transform: translate(4vw, -110vh) scale(1); opacity: 0; }
        }
        @keyframes storyChevron {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 1;    }
        }
        @keyframes storyBossBreath {
          0%, 100% { box-shadow: 0 0 22px rgba(220,38,38,0.45), 0 6px 18px rgba(0,0,0,0.6),
                      inset 0 1px 3px rgba(255,255,255,0.28), inset 0 -4px 8px rgba(0,0,0,0.38); }
          50%      { box-shadow: 0 0 42px rgba(220,38,38,0.85), 0 6px 18px rgba(0,0,0,0.6),
                      inset 0 1px 3px rgba(255,255,255,0.28), inset 0 -4px 8px rgba(0,0,0,0.38); }
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
      const { stageId, won, lp, lpLeft } = JSON.parse(pending)
      const stage = CHAPTER1_STAGES.find(s => s.id === stageId)
      if (won && stage) {
        // Avaliação de 1–3 estrelas com base no LP restante (melhor resultado é mantido)
        const rating = computeBattleRating(lpLeft, typeof lp === "number" && lp > 0 ? lp : 20)
        setBattleStars(prev => ({ ...prev, [stageId]: Math.max(prev[stageId] ?? 0, rating) }))
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

  useEffect(() => {
    try { localStorage.setItem(LS_STARS_KEY, JSON.stringify(battleStars)) } catch {}
  }, [battleStars])

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
    // Gasta a stamina exibida na intro (nunca bloqueia o início da batalha:
    // se não houver stamina suficiente, spendStamina retorna false e segue).
    spendStamina(isBoss ? SWEEP_COST.boss : SWEEP_COST.battle)
    setBattleStage(null)
    onStartBattle(mode, stageId)
  }

  // ── Varredura: coleta instantânea dos drops de uma fase já dominada (3★) ──
  const handleSweepStage = (stage: Stage) => {
    if (stage.type !== "battle" && stage.type !== "boss") return
    if (!completedIds.has(stage.id)) return
    if ((battleStars[stage.id] ?? 0) < 3) return
    const cost = SWEEP_COST[stage.type]
    if (!spendStamina(cost)) return
    const drops = grantStageRewards(stage)
    setInfoStage(null)
    setRewardToast({ drops, stars: 0 })
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
          battleStars={battleStars}
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
          battleRating={battleStars[infoStage.id] ?? 0}
          stamina={stamina}
          onPlay={() => handlePlayStage(infoStage)}
          onSweep={() => handleSweepStage(infoStage)}
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
