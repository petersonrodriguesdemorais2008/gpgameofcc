"use client"

import { useState, useMemo, useCallback } from "react"
import { useGame, type Card } from "@/contexts/game-context"
import { DuelScreen } from "./duel-screen"
import Image from "next/image"
import {
  ArrowLeft, Swords, Shield, Star, Zap, Heart, Skull, Crown,
  Sparkles, RefreshCw, Trophy, X, ChevronRight, Flame, Wind,
  Droplets, Eye, Sword, Package, RotateCcw,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
type RunPhase =
  | "intro"       // before run starts
  | "phase-intro" // show current phase info
  | "duel"        // fighting
  | "card-reward" // choose card after win
  | "buff-reward" // choose buff after card pick
  | "run-over"    // won or lost

type BuffRarity = "R" | "SR" | "UR" | "LR"

interface Buff {
  id: string
  name: string
  description: string
  rarity: BuffRarity
  icon: string          // emoji
  effect: Partial<RunState["passiveEffects"]>
}

interface RunState {
  phase: number          // 1–10
  deck: Card[]           // current deck (max 30)
  tapCards: Card[]       // current TAP (max 5)
  buffs: Buff[]          // collected buffs
  passiveEffects: {
    bonusLP: number              // added to starting 50 LP
    bonusHandSize: number        // added to starting 5 hand
    bonusDrawPerTurn: number     // extra draws each turn (future)
    dpBoostAll: number           // bonus DP to all units on placement
    lifeSteal: boolean           // recover 1 LP on unit destroy
    startWithFullHand: boolean   // draw 7 instead of 5
    shieldFirstTurn: boolean     // immune to first damage
    extraTap: number             // extra TAP slots (future)
  }
  wins: number
  runResult: "ongoing" | "won" | "lost"
}

// ─── Phase config ─────────────────────────────────────────────────────────────
interface PhaseConfig {
  label: string
  subtitle: string
  difficulty: "easy" | "medium" | "hard"
  botLPMult: number    // multiplier on bot's starting 50 LP
  emoji: string
  color: string
}

const PHASES: PhaseConfig[] = [
  { label:"Fase 1",  subtitle:"Recrutas da Fronteira",    difficulty:"easy",   botLPMult:0.6,  emoji:"🌱", color:"text-green-400"  },
  { label:"Fase 2",  subtitle:"Soldados do Vilarejo",     difficulty:"easy",   botLPMult:0.8,  emoji:"🌿", color:"text-green-400"  },
  { label:"Fase 3",  subtitle:"Guardiões do Castelo",     difficulty:"medium", botLPMult:0.9,  emoji:"🛡️", color:"text-cyan-400"   },
  { label:"Fase 4",  subtitle:"Cavaleiros da Ordem",      difficulty:"medium", botLPMult:1.0,  emoji:"⚔️", color:"text-cyan-400"   },
  { label:"Fase 5",  subtitle:"Campeões do Reino",        difficulty:"medium", botLPMult:1.1,  emoji:"👑", color:"text-amber-400"  },
  { label:"Fase 6",  subtitle:"Mestres da Guerra",        difficulty:"hard",   botLPMult:1.2,  emoji:"🔥", color:"text-amber-400"  },
  { label:"Fase 7",  subtitle:"Lendas do Campo de Batalha",difficulty:"hard",  botLPMult:1.35, emoji:"💀", color:"text-red-400"    },
  { label:"Fase 8",  subtitle:"Hereges do Vazio",         difficulty:"hard",   botLPMult:1.5,  emoji:"🌑", color:"text-red-400"    },
  { label:"Fase 9",  subtitle:"Arautos do Apocalipse",    difficulty:"hard",   botLPMult:1.7,  emoji:"⚡", color:"text-purple-400" },
  { label:"Fase 10", subtitle:"O Último Herói",           difficulty:"hard",   botLPMult:2.0,  emoji:"🌟", color:"text-yellow-300" },
]

const MAX_DECK_SIZE = 30
const STARTING_DECK_SIZE = 8
const CARD_OPTIONS_COUNT = 3
const BUFF_OPTIONS_COUNT = 3

// ─── 50 Buffs ─────────────────────────────────────────────────────────────────
const ALL_BUFFS: Buff[] = [
  // ── R (common) ─────────────────────────────────────────────────────────────
  { id:"hp-potion",    name:"Poção de Vida",         description:"+5 LP ao iniciar cada duelo.",           rarity:"R",  icon:"🧪", effect:{bonusLP:5}  },
  { id:"hp-potion-2",  name:"Elixir Básico",          description:"+10 LP ao iniciar cada duelo.",          rarity:"R",  icon:"💊", effect:{bonusLP:10} },
  { id:"hand-r",       name:"Mãos Habilidosas",       description:"Começa com +1 carta na mão.",            rarity:"R",  icon:"🖐️", effect:{bonusHandSize:1} },
  { id:"scholar",      name:"Estudante de Duelo",     description:"+5 LP ao iniciar cada duelo.",           rarity:"R",  icon:"📖", effect:{bonusLP:5}  },
  { id:"iron-skin",    name:"Pele de Ferro",          description:"+8 LP ao iniciar cada duelo.",           rarity:"R",  icon:"🛡️", effect:{bonusLP:8}  },
  { id:"quick-study",  name:"Aprendizado Rápido",     description:"Começa com +1 carta na mão.",            rarity:"R",  icon:"⚡", effect:{bonusHandSize:1} },
  { id:"lucky-charm",  name:"Amuleto da Sorte",       description:"+10 LP ao iniciar cada duelo.",          rarity:"R",  icon:"🍀", effect:{bonusLP:10} },
  { id:"scribe",       name:"Escriba de Batalha",     description:"+5 LP e +1 carta na mão.",               rarity:"R",  icon:"📜", effect:{bonusLP:5, bonusHandSize:1} },
  { id:"vigor",        name:"Vigor Natural",          description:"+12 LP ao iniciar cada duelo.",          rarity:"R",  icon:"💪", effect:{bonusLP:12} },
  { id:"practice",     name:"Treino Diário",          description:"+15 LP ao iniciar cada duelo.",          rarity:"R",  icon:"🏋️", effect:{bonusLP:15} },
  { id:"focus",        name:"Concentração",           description:"Começa com +2 cartas na mão.",           rarity:"R",  icon:"🎯", effect:{bonusHandSize:2} },
  { id:"endurance",    name:"Resistência",            description:"+20 LP ao iniciar cada duelo.",          rarity:"R",  icon:"🌿", effect:{bonusLP:20} },
  { id:"craftsman",    name:"Artesão Tático",         description:"+10 LP e +1 carta na mão.",              rarity:"R",  icon:"🔨", effect:{bonusLP:10, bonusHandSize:1} },

  // ── SR (uncommon) ───────────────────────────────────────────────────────────
  { id:"sr-hp-large",  name:"Cura Abençoada",        description:"+25 LP ao iniciar cada duelo.",          rarity:"SR", icon:"✨", effect:{bonusLP:25} },
  { id:"sr-hand-2",    name:"Arsenal Expandido",     description:"Começa com +3 cartas na mão.",           rarity:"SR", icon:"🗃️", effect:{bonusHandSize:3} },
  { id:"sr-dp-boost",  name:"Bênção de Poder",       description:"+1 DP em todas as unidades ao entrar em campo.", rarity:"SR", icon:"⚔️", effect:{dpBoostAll:1} },
  { id:"sr-combo",     name:"Sinergia de Batalha",   description:"+20 LP e +2 cartas na mão.",             rarity:"SR", icon:"🔗", effect:{bonusLP:20, bonusHandSize:2} },
  { id:"sr-fortress",  name:"Fortaleza Viva",        description:"+30 LP ao iniciar cada duelo.",          rarity:"SR", icon:"🏰", effect:{bonusLP:30} },
  { id:"sr-tactician", name:"Tático Experiente",     description:"+25 LP e +1 carta na mão.",              rarity:"SR", icon:"🗺️", effect:{bonusLP:25, bonusHandSize:1} },
  { id:"sr-draw",      name:"Intuição de Mago",      description:"Começa com mão cheia (7 cartas).",       rarity:"SR", icon:"🔮", effect:{startWithFullHand:true} },
  { id:"sr-lifesteal", name:"Dreno de Essência",     description:"Recupera 1 LP ao destruir uma unidade inimiga.", rarity:"SR", icon:"🩸", effect:{lifeSteal:true} },
  { id:"sr-bulwark",   name:"Baluarte Inabalável",   description:"+35 LP ao iniciar cada duelo.",          rarity:"SR", icon:"🪨", effect:{bonusLP:35} },
  { id:"sr-warrior",   name:"Guerreiro Veterano",    description:"+2 DP em todas as unidades ao entrar em campo.", rarity:"SR", icon:"🗡️", effect:{dpBoostAll:2} },
  { id:"sr-prophet",   name:"Profeta da Vitória",    description:"+30 LP e +2 cartas na mão.",             rarity:"SR", icon:"👁️", effect:{bonusLP:30, bonusHandSize:2} },
  { id:"sr-shield",    name:"Égide Protetora",       description:"Imune ao primeiro dano recebido no duelo.", rarity:"SR", icon:"🛡️", effect:{shieldFirstTurn:true} },
  { id:"sr-legacy",    name:"Legado de Herói",       description:"+40 LP ao iniciar cada duelo.",          rarity:"SR", icon:"🏅", effect:{bonusLP:40} },
  { id:"sr-surge",     name:"Surto de Adrenalina",   description:"+20 LP e mão cheia (7 cartas).",         rarity:"SR", icon:"⚡", effect:{bonusLP:20, startWithFullHand:true} },

  // ── UR (rare) ────────────────────────────────────────────────────────────────
  { id:"ur-godhand",   name:"Mão dos Deuses",        description:"Começa com mão cheia + imune ao 1º dano.", rarity:"UR", icon:"🌟", effect:{startWithFullHand:true, shieldFirstTurn:true} },
  { id:"ur-colossus",  name:"Colosso de Ferro",      description:"+50 LP ao iniciar cada duelo.",          rarity:"UR", icon:"🗿", effect:{bonusLP:50} },
  { id:"ur-dp-3",      name:"Poder Absoluto",        description:"+3 DP em todas as unidades ao entrar em campo.", rarity:"UR", icon:"💥", effect:{dpBoostAll:3} },
  { id:"ur-lifesteal-hand", name:"Vampiro Tático",   description:"Dreno de essência + mão cheia (7 cartas).", rarity:"UR", icon:"🧛", effect:{lifeSteal:true, startWithFullHand:true} },
  { id:"ur-titan",     name:"Titan Ressurgido",      description:"+60 LP ao iniciar cada duelo.",          rarity:"UR", icon:"⚡", effect:{bonusLP:60} },
  { id:"ur-fortress-draw", name:"Bastião do Saber",  description:"+40 LP e mão cheia (7 cartas).",         rarity:"UR", icon:"📚", effect:{bonusLP:40, startWithFullHand:true} },
  { id:"ur-destroyer", name:"Destruidor de Mundos",  description:"+4 DP em todas as unidades ao entrar em campo.", rarity:"UR", icon:"☄️", effect:{dpBoostAll:4} },
  { id:"ur-phoenix",   name:"Chama da Fênix",        description:"+50 LP + imune ao 1º dano.",             rarity:"UR", icon:"🔥", effect:{bonusLP:50, shieldFirstTurn:true} },
  { id:"ur-sovereign", name:"Soberano de Batalha",   description:"+2 DP em unidades + dreno de essência.", rarity:"UR", icon:"👑", effect:{dpBoostAll:2, lifeSteal:true} },
  { id:"ur-oracle",    name:"Oráculo de Camelot",    description:"+60 LP e +3 cartas na mão.",             rarity:"UR", icon:"🌀", effect:{bonusLP:60, bonusHandSize:3} },
  { id:"ur-warlord",   name:"Senhor da Guerra",      description:"+3 DP + mão cheia + imune 1º dano.",     rarity:"UR", icon:"⚔️", effect:{dpBoostAll:3, startWithFullHand:true, shieldFirstTurn:true} },
  { id:"ur-demigod",   name:"Semideus Desperto",     description:"+70 LP ao iniciar cada duelo.",          rarity:"UR", icon:"✨", effect:{bonusLP:70} },

  // ── LR (legendary) ───────────────────────────────────────────────────────────
  { id:"lr-almighty",  name:"Onipotência",            description:"+5 DP em todas as unidades. Imune ao 1º dano.", rarity:"LR", icon:"🌌", effect:{dpBoostAll:5, shieldFirstTurn:true} },
  { id:"lr-immortal",  name:"Imortalidade Parcial",   description:"+100 LP ao iniciar cada duelo.",        rarity:"LR", icon:"💫", effect:{bonusLP:100} },
  { id:"lr-ascended",  name:"Ascensão",               description:"Mão cheia + +4 DP + dreno de essência.", rarity:"LR", icon:"🌠", effect:{startWithFullHand:true, dpBoostAll:4, lifeSteal:true} },
  { id:"lr-godking",   name:"Rei Deus",               description:"+80 LP + mão cheia + imune ao 1º dano.", rarity:"LR", icon:"👁️", effect:{bonusLP:80, startWithFullHand:true, shieldFirstTurn:true} },
  { id:"lr-creation",  name:"Poder da Criação",       description:"+6 DP em todas as unidades ao entrar em campo.", rarity:"LR", icon:"⚡", effect:{dpBoostAll:6} },
  { id:"lr-cosmos",    name:"Força Cósmica",           description:"+5 DP + +80 LP + dreno de essência.",  rarity:"LR", icon:"🌟", effect:{dpBoostAll:5, bonusLP:80, lifeSteal:true} },
  { id:"lr-apocalypse",name:"Arauto do Fim",           description:"Tudo: +4DP, +80LP, mão cheia, escudo, dreno.", rarity:"LR", icon:"🔱", effect:{dpBoostAll:4, bonusLP:80, startWithFullHand:true, shieldFirstTurn:true, lifeSteal:true} },
  { id:"lr-origin",    name:"Força Primordial",        description:"+100 LP + mão cheia (7) + +5 DP.",     rarity:"LR", icon:"🌀", effect:{bonusLP:100, startWithFullHand:true, dpBoostAll:5} },
  // Extra buffs to reach 50
  { id:"sr-twin-edge", name:"Espada Dupla",             description:"+2 DP em unidades + +15 LP.",           rarity:"SR", icon:"⚔️", effect:{dpBoostAll:2, bonusLP:15} },
  { id:"ur-mind-eye",  name:"Olho da Mente",            description:"+4 cartas na mão + imune ao 1º dano.", rarity:"UR", icon:"🧿", effect:{bonusHandSize:4, shieldFirstTurn:true} },
  { id:"lr-eternity",  name:"Eterno Guardião",          description:"+5 DP + +100 LP + dreno de essência.", rarity:"LR", icon:"♾️", effect:{dpBoostAll:5, bonusLP:100, lifeSteal:true} },
]

// ─── Rarity helpers ───────────────────────────────────────────────────────────
const RARITY_WEIGHTS_BUFF: Record<BuffRarity, number> = { R:55, SR:30, UR:12, LR:3 }

const rarityColor = (r: BuffRarity) =>
  r==="LR" ? "from-red-500 to-amber-400 text-white" :
  r==="UR" ? "from-sky-500 to-cyan-400 text-white"  :
  r==="SR" ? "from-purple-600 to-purple-400 text-white" :
  "from-slate-600 to-slate-500 text-slate-200"

const rarityGlow = (r: BuffRarity) =>
  r==="LR" ? "rgba(239,68,68,0.5)"  : r==="UR" ? "rgba(56,189,248,0.5)"  :
  r==="SR" ? "rgba(168,85,247,0.4)" : "rgba(100,116,139,0.2)"

const rarityBorder = (r: BuffRarity) =>
  r==="LR" ? "border-red-400"     : r==="UR" ? "border-sky-400"    :
  r==="SR" ? "border-purple-400"  : "border-slate-600"

const cardRarityBorder = (r: string) =>
  r==="LR" ? "border-red-400" : r==="UR" ? "border-sky-400" :
  r==="SR" ? "border-purple-400" : "border-slate-600"

const cardRarityGlow = (r: string) =>
  r==="LR" ? "rgba(239,68,68,0.5)"  : r==="UR" ? "rgba(56,189,248,0.5)"  :
  r==="SR" ? "rgba(168,85,247,0.4)" : "rgba(100,116,139,0.15)"

const cardRarityBadge = (r: string) =>
  r==="LR" ? "from-red-500 to-amber-500 text-white" :
  r==="UR" ? "from-sky-500 to-cyan-400 text-white"  :
  r==="SR" ? "from-purple-600 to-purple-400 text-white" :
  "from-slate-600 to-slate-500 text-slate-200"

// ─── Weighted random ──────────────────────────────────────────────────────────
function weightedRandom<T>(items: T[], weight: (x: T) => number): T {
  const total = items.reduce((s, i) => s + weight(i), 0)
  let r = Math.random() * total
  for (const i of items) { r -= weight(i); if (r <= 0) return i }
  return items[items.length - 1]
}

// ─── Compute passive effects from buff stack ──────────────────────────────────
function computeEffects(buffs: Buff[]): RunState["passiveEffects"] {
  const base: RunState["passiveEffects"] = {
    bonusLP: 0, bonusHandSize: 0, bonusDrawPerTurn: 0,
    dpBoostAll: 0, lifeSteal: false, startWithFullHand: false,
    shieldFirstTurn: false, extraTap: 0,
  }
  for (const b of buffs) {
    const e = b.effect
    if (e.bonusLP)           base.bonusLP            += e.bonusLP
    if (e.bonusHandSize)     base.bonusHandSize       += e.bonusHandSize
    if (e.bonusDrawPerTurn)  base.bonusDrawPerTurn    += e.bonusDrawPerTurn
    if (e.dpBoostAll)        base.dpBoostAll          += e.dpBoostAll
    if (e.lifeSteal)         base.lifeSteal            = true
    if (e.startWithFullHand) base.startWithFullHand    = true
    if (e.shieldFirstTurn)   base.shieldFirstTurn      = true
    if (e.extraTap)          base.extraTap            += e.extraTap
  }
  return base
}

// ─── Main component ───────────────────────────────────────────────────────────
interface RoguelikeScreenProps { onBack: () => void }

export default function RoguelikeScreen({ onBack }: RoguelikeScreenProps) {
  const { allCards } = useGame()

  const [runPhase, setRunPhase]       = useState<RunPhase>("intro")
  const [currentPhaseIdx, setPhaseIdx] = useState(0)  // 0-9
  const [deck, setDeck]               = useState<Card[]>([])
  const [tapCards, setTapCards]       = useState<Card[]>([])
  const [buffs, setBuffs]             = useState<Buff[]>([])
  const [wins, setWins]               = useState(0)
  const [runResult, setRunResult]     = useState<"won" | "lost" | null>(null)

  // Reward state
  const [cardOptions, setCardOptions] = useState<Card[]>([])
  const [buffOptions, setBuffOptions] = useState<Buff[]>([])
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [deckFull, setDeckFull]       = useState(false)
  const [replaceMode, setReplaceMode] = useState(false)
  const [replaceCard, setReplaceCard] = useState<Card | null>(null)

  // Zoom
  const [zoomedCard, setZoomedCard]   = useState<Card | null>(null)
  const [zoomedBuff, setZoomedBuff]   = useState<Buff | null>(null)

  const effects = useMemo(() => computeEffects(buffs), [buffs])
  const phaseConfig = PHASES[currentPhaseIdx]

  // ── Build starting deck ────────────────────────────────────────────────────
  const buildStartingDeck = (): Card[] => {
    const pool = allCards.filter(c => ["unit","troops","action","magic","item"].includes(c.type))
    const picked = new Set<string>()
    const result: Card[] = []
    while (result.length < STARTING_DECK_SIZE && result.length < pool.length) {
      const c = pool[Math.floor(Math.random() * pool.length)]
      if (!picked.has(c.id)) { picked.add(c.id); result.push(c) }
    }
    return result
  }

  // ── Generate card options (rarity scales with phase) ──────────────────────
  const genCardOptions = (phaseIdx: number): Card[] => {
    const pool = allCards.filter(c => c.type !== "scenario")
    const rarityWeights: Record<string, number> =
      phaseIdx < 2  ? { R:70, SR:25, UR:4,  LR:1  } :
      phaseIdx < 4  ? { R:55, SR:32, UR:11, LR:2  } :
      phaseIdx < 6  ? { R:40, SR:38, UR:18, LR:4  } :
      phaseIdx < 8  ? { R:25, SR:38, UR:28, LR:9  } :
                      { R:10, SR:30, UR:38, LR:22 }

    const picked = new Set<string>()
    const result: Card[] = []
    for (let attempt = 0; attempt < 80 && result.length < CARD_OPTIONS_COUNT; attempt++) {
      const rarity = weightedRandom(Object.keys(rarityWeights), r => rarityWeights[r])
      const cands  = pool.filter(c => c.rarity === rarity && !picked.has(c.id))
      if (!cands.length) continue
      const pick = cands[Math.floor(Math.random() * cands.length)]
      result.push(pick); picked.add(pick.id)
    }
    return result
  }

  // ── Generate buff options ─────────────────────────────────────────────────
  const genBuffOptions = (collected: Buff[]): Buff[] => {
    const available = ALL_BUFFS.filter(b => !collected.some(c => c.id === b.id))
    const picked = new Set<string>()
    const result: Buff[] = []
    for (let attempt = 0; attempt < 80 && result.length < BUFF_OPTIONS_COUNT; attempt++) {
      const b = weightedRandom(available.filter(x => !picked.has(x.id)), b => RARITY_WEIGHTS_BUFF[b.rarity])
      if (b && !picked.has(b.id)) { result.push(b); picked.add(b.id) }
    }
    return result
  }

  // ── Start the run ─────────────────────────────────────────────────────────
  const startRun = () => {
    const d = buildStartingDeck()
    setDeck(d)
    setTapCards([])
    setBuffs([])
    setWins(0)
    setPhaseIdx(0)
    setRunResult(null)
    setRunPhase("phase-intro")
  }

  // ── Start current duel ────────────────────────────────────────────────────
  const startDuel = () => setRunPhase("duel")

  // ── Handle duel result ────────────────────────────────────────────────────
  const handleDuelBack = () => {
    // Called when DuelScreen's onBack fires — means player lost or retreated
    setRunResult("lost")
    setRunPhase("run-over")
  }

  // This is called by a custom win callback we add
  const handleWin = () => {
    const newWins = wins + 1
    setWins(newWins)
    if (currentPhaseIdx >= PHASES.length - 1) {
      setRunResult("won")
      setRunPhase("run-over")
      return
    }
    // Generate card options
    const cards = genCardOptions(currentPhaseIdx)
    setCardOptions(cards)
    setSelectedCard(null)
    setDeckFull(deck.length >= MAX_DECK_SIZE)
    setReplaceMode(false)
    setReplaceCard(null)
    setRunPhase("card-reward")
  }

  // ── Pick a card reward ────────────────────────────────────────────────────
  const pickCard = (card: Card | null) => {
    if (card) {
      if (deck.length >= MAX_DECK_SIZE) {
        // Must replace — handled via replaceMode
        setReplaceCard(card)
        setReplaceMode(true)
        return
      }
      setDeck(prev => [...prev, card])
    }
    // Move to buff reward
    const bOpts = genBuffOptions(buffs)
    setBuffOptions(bOpts)
    setRunPhase("buff-reward")
  }

  const replaceAndContinue = (removeCard: Card) => {
    if (!replaceCard) return
    setDeck(prev => {
      const without = prev.filter(c => c.id !== removeCard.id)
      return [...without, replaceCard]
    })
    setReplaceCard(null)
    setReplaceMode(false)
    const bOpts = genBuffOptions(buffs)
    setBuffOptions(bOpts)
    setRunPhase("buff-reward")
  }

  // ── Pick a buff ──────────────────────────────────────────────────────────
  const pickBuff = (buff: Buff) => {
    const newBuffs = [...buffs, buff]
    setBuffs(newBuffs)
    // Advance phase
    setPhaseIdx(prev => prev + 1)
    setRunPhase("phase-intro")
  }

  // ── Build roguelike deck for DuelScreen ───────────────────────────────────
  const roguelikeDeck = useMemo(() => ({
    id: `roguelike-deck-phase-${currentPhaseIdx}-${wins}`,
    name: `Roguelike Deck — ${phaseConfig.label}`,
    cards: deck,
    tapCards,
  }), [deck, tapCards, currentPhaseIdx, wins, phaseConfig.label])

  const startingLP   = 50 + effects.bonusLP
  const startingHand = effects.startWithFullHand ? 7 : Math.min(5 + effects.bonusHandSize, 10)

  const roguelikeConfig = {
    startingLP,
    startingHandSize: startingHand,
    difficulty: phaseConfig.difficulty,
    phaseLabel: phaseConfig.label,
  }

  // ─── DUEL ─────────────────────────────────────────────────────────────────
  if (runPhase === "duel") {
    return (
      <DuelScreen
        key={`roguelike-phase-${currentPhaseIdx}-${wins}`}
        mode="bot"
        draftDeck={roguelikeDeck}
        roguelikeConfig={roguelikeConfig}
        onWin={handleWin}
        onBack={handleDuelBack}
      />
    )
  }

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (runPhase === "intro") {
    return (
      <ScreenWrapper onBack={onBack}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto w-full">
          <div className="relative mb-8">
            <div className="absolute inset-0 blur-2xl rounded-full" style={{background:"rgba(239,68,68,0.3)",transform:"scale(1.5)"}} />
            <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center border border-red-500/40"
              style={{background:"linear-gradient(145deg,rgba(127,29,29,0.9),rgba(185,28,28,0.8))"}}>
              <Skull className="w-12 h-12 text-red-200" />
            </div>
          </div>

          <h2 className="text-3xl font-black text-white text-center mb-2">Roguelike</h2>
          <p className="text-red-400 text-xs font-bold tracking-widest uppercase mb-6">Modo de Sobrevivência</p>

          <p className="text-slate-400 text-center text-sm leading-relaxed mb-8 max-w-sm">
            Avance por <span className="text-red-300 font-bold">10 fases</span> com dificuldade crescente. Ganhe <span className="text-amber-300 font-bold">cartas</span> e <span className="text-purple-300 font-bold">buffs</span> ao longo da run. Uma derrota encerra tudo.
          </p>

          <div className="w-full rounded-2xl border border-white/[0.08] mb-8 overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}>
            {[
              { icon:<Swords className="w-4 h-4 text-red-400"/>,    text:"10 fases com bots progressivamente mais fortes" },
              { icon:<Star className="w-4 h-4 text-amber-400"/>,    text:"Escolha cartas para expandir seu deck (máx 30)" },
              { icon:<Sparkles className="w-4 h-4 text-purple-400"/>, text:`${ALL_BUFFS.length} buffs únicos — raridades R, SR, UR e LR` },
              { icon:<Shield className="w-4 h-4 text-cyan-400"/>,   text:"Buffs acumulam durante toda a run" },
              { icon:<Skull className="w-4 h-4 text-slate-400"/>,   text:"Uma derrota termina a run permanentemente" },
            ].map((r,i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] last:border-0">
                {r.icon}<span className="text-slate-300 text-sm">{r.text}</span>
              </div>
            ))}
          </div>

          {/* Phase preview */}
          <div className="w-full mb-6">
            <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2 text-center">Jornada</p>
            <div className="flex gap-1 justify-center flex-wrap">
              {PHASES.map((p,i) => (
                <div key={i} className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg border border-white/[0.06] ${p.color}`}
                  style={{background:"rgba(255,255,255,0.03)",minWidth:"36px"}}>
                  <span className="text-base">{p.emoji}</span>
                  <span className="text-[9px] font-bold">{i+1}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={startRun}
            className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-2xl"
            style={{background:"linear-gradient(135deg,#7f1d1d,#dc2626,#ef4444)",boxShadow:"0 8px 32px rgba(239,68,68,0.35)"}}>
            <Skull className="w-6 h-6" />Iniciar Run
          </button>
        </div>
      </ScreenWrapper>
    )
  }

  // ─── PHASE INTRO ──────────────────────────────────────────────────────────
  if (runPhase === "phase-intro") {
    const isFirst = currentPhaseIdx === 0
    return (
      <ScreenWrapper onBack={() => { setRunResult("lost"); setRunPhase("run-over") }} backLabel="Desistir">
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full">
          {/* Phase badge */}
          <div className={`text-7xl mb-4`}>{phaseConfig.emoji}</div>
          <h2 className={`text-4xl font-black text-center mb-1 ${phaseConfig.color}`}>{phaseConfig.label}</h2>
          <p className="text-slate-400 text-base text-center mb-8">{phaseConfig.subtitle}</p>

          {/* Current deck/buff status */}
          <div className="w-full grid grid-cols-2 gap-3 mb-6">
            <StatCard icon={<Package className="w-5 h-5 text-cyan-400"/>} label="Cartas no Deck" value={deck.length} max={MAX_DECK_SIZE} color="text-cyan-300" />
            <StatCard icon={<Sparkles className="w-5 h-5 text-purple-400"/>} label="Buffs Ativos" value={buffs.length} color="text-purple-300" />
            <StatCard icon={<Heart className="w-5 h-5 text-red-400"/>} label="LP Inicial" value={startingLP} color="text-red-300" />
            <StatCard icon={<Eye className="w-5 h-5 text-amber-400"/>} label="Mão Inicial" value={startingHand} color="text-amber-300" />
          </div>

          {/* Active buffs mini list */}
          {buffs.length > 0 && (
            <div className="w-full mb-6">
              <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2">Buffs Ativos</p>
              <div className="flex flex-wrap gap-1.5">
                {buffs.map(b => (
                  <button key={b.id} onClick={() => setZoomedBuff(b)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold ${rarityBorder(b.rarity)}`}
                    style={{background:"rgba(255,255,255,0.04)",boxShadow:`0 0 8px ${rarityGlow(b.rarity)}`}}>
                    <span>{b.icon}</span><span className="text-white">{b.name}</span>
                    <span className={`px-1 py-0.5 rounded text-[9px] font-black bg-gradient-to-r ${rarityColor(b.rarity)}`}>{b.rarity}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Phase difficulty */}
          <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] mb-6" style={{background:"rgba(255,255,255,0.03)"}}>
            <div className="text-2xl">{phaseConfig.emoji}</div>
            <div>
              <p className={`font-black text-sm ${phaseConfig.color}`}>{phaseConfig.subtitle}</p>
              <p className="text-slate-500 text-xs">
                Dificuldade: <span className={
                  phaseConfig.difficulty==="hard"?"text-red-400":phaseConfig.difficulty==="medium"?"text-amber-400":"text-green-400"
                }>{phaseConfig.difficulty==="hard"?"Difícil":phaseConfig.difficulty==="medium"?"Médio":"Fácil"}</span>
                {" · "}Vitórias: <span className="text-white">{wins}</span>
              </p>
            </div>
          </div>

          <button onClick={startDuel}
            className="w-full py-4 rounded-2xl font-black text-xl text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-2xl"
            style={{background:"linear-gradient(135deg,#dc2626,#ef4444,#f87171)",boxShadow:"0 8px 32px rgba(239,68,68,0.35)"}}>
            <Swords className="w-7 h-7" />
            {isFirst ? "Começar Run!" : `Combater ${phaseConfig.label}`}
          </button>
        </div>

        {/* Buff zoom */}
        {zoomedBuff && <BuffZoom buff={zoomedBuff} onClose={() => setZoomedBuff(null)} />}
      </ScreenWrapper>
    )
  }

  // ─── CARD REWARD ─────────────────────────────────────────────────────────
  if (runPhase === "card-reward") {
    const isFull = deck.length >= MAX_DECK_SIZE

    // Replace mode — show deck to pick a card to replace
    if (replaceMode && replaceCard) {
      return (
        <ScreenWrapper backLabel="Cancelar" onBack={() => { setReplaceMode(false); setReplaceCard(null) }}>
          <div className="flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto w-full">
            <div className="text-center mb-6">
              <p className="text-amber-400 font-black text-lg">Deck Cheio!</p>
              <p className="text-slate-400 text-sm">Escolha uma carta para <span className="text-red-400 font-bold">substituir</span> por:</p>
              <div className="flex items-center justify-center gap-3 mt-3">
                <div className={`relative border-2 ${cardRarityBorder(replaceCard.rarity)} overflow-hidden`} style={{width:"70px",height:"99px",boxShadow:`0 0 12px ${cardRarityGlow(replaceCard.rarity)}`}}>
                  <Image src={replaceCard.image||"/placeholder.svg"} alt={replaceCard.name} fill sizes="74px" className="object-cover" />
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{replaceCard.name}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r ${cardRarityBadge(replaceCard.rarity)}`}>{replaceCard.rarity}</span>
                </div>
              </div>
            </div>

            <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-3">Seu deck atual ({deck.length} cartas)</p>
            <div className="grid grid-cols-4 gap-2">
              {deck.map((c,i) => (
                <button key={`rpl-${c.id}-${i}`} onClick={() => replaceAndContinue(c)}
                  className={`relative overflow-hidden border-2 ${cardRarityBorder(c.rarity)} transition-all hover:scale-105 hover:z-10`}
                  style={{aspectRatio:"3/4",boxShadow:`0 0 8px ${cardRarityGlow(c.rarity)}`}}>
                  <Image src={c.image||"/placeholder.svg"} alt={c.name} fill sizes="80px" className="object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    style={{background:"rgba(239,68,68,0.45)"}}>
                    <X className="w-8 h-8 text-white" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </ScreenWrapper>
      )
    }

    return (
      <ScreenWrapper backLabel="Pular" onBack={() => pickCard(null)}>
        <div className="flex-1 flex flex-col items-center px-4 py-6 max-w-lg mx-auto w-full">
          <div className="text-center mb-2">
            <p className="text-green-400 font-black text-xl">✓ Vitória!</p>
            <p className="text-white font-black text-lg">{phaseConfig.label} concluída</p>
          </div>
          <p className="text-slate-400 text-xs font-medium tracking-wider uppercase mb-6">
            {isFull ? `Deck cheio (${deck.length}/${MAX_DECK_SIZE}) — substituir uma carta` : "Escolha 1 carta para adicionar ao deck"}
          </p>
          {isFull && <p className="text-amber-400 text-xs mb-4">Seu deck está cheio. Escolher uma carta abrirá a tela de substituição.</p>}

          {/* Card options */}
          <div className="flex gap-4 justify-center flex-wrap mb-8">
            {cardOptions.map((card, idx) => (
              <div key={`co-${card.id}-${idx}`} className="flex flex-col items-center gap-2"
                style={{animation:`fadeInUp 0.35s ease-out ${idx*0.08}s both`}}>
                <button onClick={() => pickCard(card)} onMouseDown={() => {}}
                  className={`relative overflow-hidden border-2 transition-all hover:scale-110 hover:z-10 ${cardRarityBorder(card.rarity)}`}
                  style={{width:"130px",height:"185px",boxShadow:`0 0 16px ${cardRarityGlow(card.rarity)}`}}>
                  <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="140px" className="object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    style={{background:"rgba(34,197,94,0.25)"}}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-white/80" style={{background:"rgba(34,197,94,0.7)"}}>
                      <Check className="w-7 h-7 text-white" />
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setZoomedCard(card) }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{background:"rgba(0,0,0,0.75)",border:"1px solid rgba(255,255,255,0.2)"}}>
                    <Eye className="w-3.5 h-3.5 text-white" />
                  </button>
                </button>
                <div className="text-center w-32">
                  <p className="text-white text-[11px] font-bold leading-tight truncate">{card.name}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r ${cardRarityBadge(card.rarity)}`}>{card.rarity}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mini deck */}
          <div className="w-full">
            <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2">Deck ({deck.length}/{MAX_DECK_SIZE})</p>
            <div className="flex flex-wrap gap-1">
              {deck.slice(0, 15).map((c,i) => (
                <div key={`dk-${c.id}-${i}`} className={`relative overflow-hidden border ${cardRarityBorder(c.rarity)}`}
                  style={{width:"32px",height:"46px"}}>
                  <Image src={c.image||"/placeholder.svg"} alt={c.name} fill sizes="36px" className="object-cover" />
                </div>
              ))}
              {deck.length > 15 && <div className="flex items-center justify-center text-slate-500 text-[10px] font-bold" style={{width:"32px",height:"46px"}}>+{deck.length-15}</div>}
            </div>
          </div>
        </div>

        {zoomedCard && <CardZoom card={zoomedCard} onClose={() => setZoomedCard(null)} onPick={c => { setZoomedCard(null); pickCard(c) }} />}
      </ScreenWrapper>
    )
  }

  // ─── BUFF REWARD ─────────────────────────────────────────────────────────
  if (runPhase === "buff-reward") {
    return (
      <ScreenWrapper backLabel="" onBack={() => {}}>
        <div className="flex-1 flex flex-col items-center px-4 py-6 max-w-lg mx-auto w-full">
          <div className="text-center mb-6">
            <p className="text-purple-400 font-black text-xl">✨ Escolha um Buff</p>
            <p className="text-slate-400 text-sm">O buff escolhido permanece para o resto da run</p>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-sm">
            {buffOptions.map((buff, idx) => (
              <button key={buff.id} onClick={() => pickBuff(buff)}
                className={`w-full rounded-2xl border-2 ${rarityBorder(buff.rarity)} p-4 text-left transition-all hover:scale-[1.02] hover:brightness-110`}
                style={{
                  background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))",
                  boxShadow:`0 0 20px ${rarityGlow(buff.rarity)}`,
                  animation:`fadeInUp 0.35s ease-out ${idx*0.1}s both`,
                }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl">{buff.icon}</span>
                    <div>
                      <p className="text-white font-black text-base leading-tight">{buff.name}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r ${rarityColor(buff.rarity)}`}>{buff.rarity}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{buff.description}</p>
              </button>
            ))}
          </div>

          {/* Current buffs */}
          {buffs.length > 0 && (
            <div className="w-full mt-6">
              <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2">Buffs já coletados</p>
              <div className="flex flex-wrap gap-1.5">
                {buffs.map(b => (
                  <div key={b.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${rarityBorder(b.rarity)}`}
                    style={{background:"rgba(255,255,255,0.03)"}}>
                    <span>{b.icon}</span>
                    <span className="text-slate-300 text-[10px]">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScreenWrapper>
    )
  }

  // ─── RUN OVER ─────────────────────────────────────────────────────────────
  if (runPhase === "run-over") {
    const won = runResult === "won"
    return (
      <ScreenWrapper onBack={onBack} backLabel="Sair">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto w-full">
          <div className="text-6xl mb-4">{won ? "🏆" : "💀"}</div>
          <h2 className={`text-4xl font-black text-center mb-2 ${won?"text-yellow-300":"text-red-400"}`}>
            {won ? "Run Concluída!" : "Derrota"}
          </h2>
          <p className="text-slate-400 text-sm text-center mb-8">
            {won ? "Você derrotou todos os 10 oponentes. Lendário!" : `Eliminado na ${PHASES[currentPhaseIdx].label} — ${PHASES[currentPhaseIdx].subtitle}`}
          </p>

          {/* Stats */}
          <div className="w-full grid grid-cols-3 gap-3 mb-6">
            <StatCard icon={<Trophy className="w-5 h-5 text-amber-400"/>} label="Vitórias" value={wins} color="text-amber-300" />
            <StatCard icon={<Sparkles className="w-5 h-5 text-purple-400"/>} label="Buffs" value={buffs.length} color="text-purple-300" />
            <StatCard icon={<Package className="w-5 h-5 text-cyan-400"/>} label="Cartas" value={deck.length} color="text-cyan-300" />
          </div>

          {/* Buffs collected */}
          {buffs.length > 0 && (
            <div className="w-full mb-6">
              <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2">Buffs Coletados</p>
              <div className="flex flex-wrap gap-1.5">
                {buffs.map(b => (
                  <div key={b.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${rarityBorder(b.rarity)}`}
                    style={{background:"rgba(255,255,255,0.03)"}}>
                    <span>{b.icon}</span><span className="text-slate-300 text-[10px]">{b.name}</span>
                    <span className={`px-1 rounded text-[9px] font-black bg-gradient-to-r ${rarityColor(b.rarity)}`}>{b.rarity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={startRun}
            className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-2xl mb-3"
            style={{background:"linear-gradient(135deg,#7f1d1d,#dc2626)",boxShadow:"0 8px 32px rgba(239,68,68,0.35)"}}>
            <RotateCcw className="w-6 h-6" />Nova Run
          </button>
          <button onClick={onBack}
            className="w-full py-2.5 rounded-xl border border-white/[0.08] text-slate-500 hover:text-slate-300 text-sm font-semibold transition-colors hover:bg-white/[0.04]">
            Voltar ao Menu
          </button>
        </div>
      </ScreenWrapper>
    )
  }

  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScreenWrapper({ children, onBack, backLabel = "Voltar" }: {
  children: React.ReactNode; onBack: () => void; backLabel?: string
}) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{background:"linear-gradient(160deg,#080206 0%,#12050a 50%,#080206 100%)"}}>
      <div className="absolute inset-0 pointer-events-none">
        <div style={{position:"absolute",top:"-5%",right:"20%",width:"500px",height:"350px",background:"radial-gradient(ellipse,rgba(239,68,68,0.08) 0%,transparent 65%)",filter:"blur(40px)"}} />
        <div style={{position:"absolute",bottom:"0",left:"10%",width:"400px",height:"300px",background:"radial-gradient(ellipse,rgba(168,85,247,0.07) 0%,transparent 65%)",filter:"blur(30px)"}} />
        <div style={{position:"absolute",inset:0,opacity:0.02,backgroundImage:"linear-gradient(rgba(239,68,68,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.4) 1px,transparent 1px)",backgroundSize:"64px 64px"}} />
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]"
        style={{background:"rgba(8,2,6,0.90)",backdropFilter:"blur(8px)"}}>
        {backLabel ? (
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" /><span className="text-xs font-medium">{backLabel}</span>
          </button>
        ) : <div className="w-20" />}
        <h1 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
          <Skull className="w-5 h-5 text-red-400" />Roguelike
        </h1>
        <div className="w-20" />
      </div>

      {children}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  )
}

function StatCard({ icon, label, value, max, color }: {
  icon: React.ReactNode; label: string; value: number; max?: number; color: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] p-3 text-center" style={{background:"rgba(255,255,255,0.03)"}}>
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <p className={`text-xl font-black ${color}`}>{value}{max ? `/${max}` : ""}</p>
      <p className="text-slate-600 text-[10px] font-medium">{label}</p>
    </div>
  )
}

function BuffZoom({ buff, onClose }: { buff: Buff; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:"rgba(0,0,0,0.92)",backdropFilter:"blur(6px)"}} onClick={onClose}>
      <div className="max-w-xs w-full rounded-2xl border-2 p-6 text-center"
        style={{background:"linear-gradient(160deg,#0d0608,#150a10)",borderColor:rarityBorder(buff.rarity).replace("border-","")}}
        onClick={e => e.stopPropagation()}>
        <span className="text-5xl block mb-4">{buff.icon}</span>
        <h3 className="text-white font-black text-2xl mb-2">{buff.name}</h3>
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${rarityColor(buff.rarity)} mb-4`}>{buff.rarity}</span>
        <p className="text-slate-300 text-sm leading-relaxed mb-4">{buff.description}</p>
        <button onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm transition-colors">
          Fechar
        </button>
      </div>
    </div>
  )
}

import { Check } from "lucide-react"

function CardZoom({ card, onClose, onPick }: { card: Card; onClose: () => void; onPick?: (c: Card) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:"rgba(0,0,0,0.92)",backdropFilter:"blur(6px)"}} onClick={onClose}>
      <div className="flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
        <div className="relative w-full aspect-[3/4]" style={{boxShadow:`0 0 40px ${cardRarityGlow(card.rarity)}`}}>
          <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="320px" className="object-contain" />
        </div>
        <div className="text-center w-full">
          <h3 className="text-white font-black text-xl mb-1">{card.name}</h3>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className={`px-3 py-0.5 rounded-full text-sm font-bold bg-gradient-to-r ${cardRarityBadge(card.rarity)}`}>{card.rarity}</span>
            {card.dp > 0 && <span className="text-slate-400 text-sm">{card.dp} DP</span>}
            {card.element && <span className="text-slate-500 text-sm">{card.element}</span>}
          </div>
          {card.ability && (
            <div className="mt-3 text-left bg-white/[0.05] rounded-xl p-3 border border-white/[0.08]">
              <p className="text-cyan-400 text-xs font-bold mb-1">{card.ability}</p>
              <p className="text-slate-300 text-xs leading-relaxed">{card.abilityDescription}</p>
            </div>
          )}
          {card.attack && <p className="mt-2 text-amber-400 text-xs font-semibold">⚔ {card.attack}</p>}
        </div>
        <div className="flex gap-2 w-full">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm transition-colors">
            Fechar
          </button>
          {onPick && (
            <button onClick={() => onPick(card)}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
              style={{background:"linear-gradient(135deg,#16a34a,#22c55e)"}}>
              <Check className="w-4 h-4" />Escolher
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
