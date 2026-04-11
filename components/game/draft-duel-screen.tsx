"use client"

import { useState, useMemo, useCallback } from "react"
import { useGame, type Card } from "@/contexts/game-context"
import { DuelScreen } from "./duel-screen"
import Image from "next/image"
import { ArrowLeft, Shuffle, Swords, Check, X, Info, Zap, Shield, Star } from "lucide-react"

// ─── Draft config ─────────────────────────────────────────────────────────────
const PICKS_PER_ROUND   = 1   // player picks 1 card per round
const OPTIONS_PER_ROUND = 3   // shown 3 random options per pick
const DECK_SIZE         = 20  // final deck size

// Card type weights for draft pool composition
const DRAFT_TYPE_WEIGHTS: Record<string, number> = {
  unit:             3,
  troops:           2,
  action:           2,
  magic:            2,
  item:             2,
  trap:             1.5,
  ultimateGear:     0.8,
  ultimateGuardian: 0.8,
  scenario:         0.5,
}

// Rarity weights
const RARITY_WEIGHTS: Record<string, number> = {
  R:  60,
  SR: 28,
  UR: 10,
  LR: 2,
}

interface DraftDuelScreenProps {
  onBack: () => void
}

type DraftPhase = "intro" | "drafting" | "review" | "duel"

// ─── Helper: weighted random pick ────────────────────────────────────────────
function weightedPick<T>(items: T[], weightFn: (item: T) => number): T {
  const total = items.reduce((s, i) => s + weightFn(i), 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= weightFn(item)
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

// ─── Rarity colour helpers ────────────────────────────────────────────────────
function rarityBorder(rarity: string) {
  if (rarity === "LR") return "border-red-400 shadow-red-500/40"
  if (rarity === "UR") return "border-sky-400 shadow-sky-500/40"
  if (rarity === "SR") return "border-purple-400 shadow-purple-500/40"
  return "border-slate-500/60 shadow-slate-600/20"
}
function rarityBadge(rarity: string) {
  if (rarity === "LR") return "from-red-500 to-amber-500 text-white"
  if (rarity === "UR") return "from-sky-500 to-cyan-400 text-white"
  if (rarity === "SR") return "from-purple-600 to-purple-400 text-white"
  return "from-slate-600 to-slate-500 text-slate-200"
}
function rarityGlow(rarity: string) {
  if (rarity === "LR") return "rgba(239,68,68,0.5)"
  if (rarity === "UR") return "rgba(56,189,248,0.5)"
  if (rarity === "SR") return "rgba(168,85,247,0.4)"
  return "rgba(100,116,139,0.2)"
}
function typeLabel(type: string) {
  const map: Record<string, string> = {
    unit: "Unidade", troops: "Tropas", action: "Action", magic: "Magic",
    item: "Item", trap: "Trap", ultimateGear: "UG", ultimateGuardian: "UGr",
    scenario: "Cenário",
  }
  return map[type] ?? type
}
function typeColor(type: string) {
  if (type === "unit" || type === "troops")           return "text-cyan-400"
  if (type === "action" || type === "magic")          return "text-purple-400"
  if (type === "item" || type === "trap")             return "text-amber-400"
  if (type === "ultimateGear" || type === "ultimateGuardian") return "text-emerald-400"
  return "text-slate-400"
}

export default function DraftDuelScreen({ onBack }: DraftDuelScreenProps) {
  const { allCards } = useGame()

  const [phase, setPhase]             = useState<DraftPhase>("intro")
  const [pickedCards, setPickedCards] = useState<Card[]>([])
  const [currentOptions, setCurrentOptions] = useState<Card[]>([])
  const [pickNumber, setPickNumber]   = useState(0)   // 0-indexed
  const [zoomedCard, setZoomedCard]   = useState<Card | null>(null)
  const [difficulty, setDifficulty]   = useState<"easy"|"medium"|"hard">("medium")
  const [hoveredIdx, setHoveredIdx]   = useState<number | null>(null)

  // ── Build weighted draft pool (excludes scenario spam) ─────────────────────
  const draftPool = useMemo(() => allCards.filter(c =>
    DRAFT_TYPE_WEIGHTS[c.type] !== undefined
  ), [allCards])

  // ── Generate 3 options for the next pick ──────────────────────────────────
  const generateOptions = useCallback((): Card[] => {
    if (draftPool.length === 0) return []

    // Pick rarity first, then pick a card of that rarity
    const options: Card[] = []
    const used = new Set<string>()

    for (let attempt = 0; attempt < 30 && options.length < OPTIONS_PER_ROUND; attempt++) {
      // Pick rarity
      const rarityKeys = Object.keys(RARITY_WEIGHTS)
      const rarity = weightedPick(rarityKeys, r => RARITY_WEIGHTS[r])

      // Get candidates of that rarity, not already chosen
      const candidates = draftPool.filter(c =>
        c.rarity === rarity && !used.has(c.id)
      )
      if (candidates.length === 0) continue

      // Weight by type
      const pick = weightedPick(candidates, c => DRAFT_TYPE_WEIGHTS[c.type] ?? 1)
      options.push(pick)
      used.add(pick.id)
    }
    return options
  }, [draftPool])

  // ── Start draft ────────────────────────────────────────────────────────────
  const startDraft = () => {
    const opts = generateOptions()
    setCurrentOptions(opts)
    setPickNumber(0)
    setPickedCards([])
    setPhase("drafting")
  }

  // ── Pick a card ────────────────────────────────────────────────────────────
  const handlePick = (card: Card) => {
    const newPicked = [...pickedCards, card]
    setPickedCards(newPicked)

    if (newPicked.length >= DECK_SIZE) {
      setPhase("review")
      return
    }

    // Next round
    const opts = generateOptions()
    setCurrentOptions(opts)
    setPickNumber(prev => prev + 1)
  }

  // ── Build final deck object for DuelScreen ─────────────────────────────────
  const finalDeck = useMemo(() => ({
    id:    "draft-deck",
    name:  "Draft Deck",
    cards: pickedCards,
  }), [pickedCards])

  // ─────────────────────────────────────────────────────────────────────────
  // If in duel phase, render DuelScreen directly with the draft deck pre-loaded
  if (phase === "duel") {
    return (
      <DraftDuelWrapper
        deck={finalDeck}
        difficulty={difficulty}
        onBack={onBack}
      />
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTRO
  if (phase === "intro") {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{background:"linear-gradient(160deg,#020812 0%,#050e1c 50%,#030a14 100%)"}}>

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{position:"absolute",top:"-10%",left:"30%",width:"600px",height:"400px",background:"radial-gradient(ellipse,rgba(168,85,247,0.12) 0%,transparent 65%)",filter:"blur(40px)"}} />
          <div style={{position:"absolute",bottom:"0",right:"10%",width:"400px",height:"300px",background:"radial-gradient(ellipse,rgba(6,182,212,0.10) 0%,transparent 65%)",filter:"blur(30px)"}} />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.07]"
          style={{background:"rgba(2,8,18,0.85)",backdropFilter:"blur(8px)"}}>
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar</span>
          </button>
          <h1 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-purple-400" />
            Draft VS BOT
          </h1>
          <div className="w-20" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto w-full">

          {/* Icon */}
          <div className="relative mb-8">
            <div className="absolute inset-0 blur-2xl rounded-full" style={{background:"rgba(168,85,247,0.3)",transform:"scale(1.5)"}} />
            <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center border border-purple-500/40"
              style={{background:"linear-gradient(145deg,rgba(88,28,135,0.9),rgba(109,40,217,0.8))"}}>
              <Shuffle className="w-12 h-12 text-purple-200" />
            </div>
          </div>

          {/* Title & description */}
          <h2 className="text-3xl font-black text-white text-center mb-3">Draft VS BOT</h2>
          <p className="text-slate-400 text-center text-sm leading-relaxed mb-8 max-w-sm">
            Monte seu deck na hora! Você receberá <span className="text-purple-300 font-bold">{DECK_SIZE} escolhas</span>, cada uma com <span className="text-purple-300 font-bold">{OPTIONS_PER_ROUND} cartas aleatórias</span>. Escolha uma por vez e construa a melhor estratégia possível.
          </p>

          {/* Rules */}
          <div className="w-full rounded-2xl border border-white/[0.08] mb-8 overflow-hidden"
            style={{background:"rgba(255,255,255,0.03)"}}>
            {[
              { icon:<Shuffle className="w-4 h-4 text-purple-400"/>, text:`${DECK_SIZE} rodadas de escolha — 1 carta por rodada` },
              { icon:<Star className="w-4 h-4 text-amber-400"/>, text:"Raridades variadas: R, SR, UR e LR" },
              { icon:<Swords className="w-4 h-4 text-cyan-400"/>, text:"Duela contra o BOT com o deck montado" },
              { icon:<Zap className="w-4 h-4 text-emerald-400"/>, text:"Deck temporário — só para este duelo" },
            ].map((r,i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] last:border-0">
                {r.icon}
                <span className="text-slate-300 text-sm">{r.text}</span>
              </div>
            ))}
          </div>

          {/* Difficulty selector */}
          <div className="w-full mb-6">
            <p className="text-slate-500 text-[11px] uppercase tracking-widest font-semibold mb-2 text-center">Dificuldade do Bot</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id:"easy",   label:"Fácil",   color:"from-green-700 to-green-600",  border:"border-green-500/40",  dot:"bg-green-400"  },
                { id:"medium", label:"Médio",   color:"from-amber-700 to-amber-600",  border:"border-amber-500/40",  dot:"bg-amber-400"  },
                { id:"hard",   label:"Difícil", color:"from-red-800 to-red-700",      border:"border-red-500/40",    dot:"bg-red-400"    },
              ] as const).map(d => (
                <button key={d.id} onClick={() => setDifficulty(d.id)}
                  className={`py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    difficulty===d.id
                      ? `bg-gradient-to-r ${d.color} ${d.border} text-white shadow-lg`
                      : "bg-white/[0.03] border-white/[0.08] text-slate-500 hover:text-slate-300"
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${difficulty===d.id ? d.dot : "bg-slate-600"}`} />
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <button onClick={startDraft}
            className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-2xl"
            style={{background:"linear-gradient(135deg,#7e22ce,#9333ea,#a855f7)",boxShadow:"0 8px 32px rgba(168,85,247,0.35)"}}>
            <Shuffle className="w-6 h-6" />
            Iniciar Draft
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DRAFTING
  if (phase === "drafting") {
    const progress = (pickedCards.length / DECK_SIZE) * 100

    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{background:"linear-gradient(160deg,#020812 0%,#050e1c 50%,#030a14 100%)"}}>

        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{position:"absolute",top:"-5%",left:"20%",width:"500px",height:"350px",background:"radial-gradient(ellipse,rgba(168,85,247,0.08) 0%,transparent 65%)",filter:"blur(40px)"}} />
        </div>

        {/* Header */}
        <div className="relative z-10 border-b border-white/[0.07]"
          style={{background:"rgba(2,8,18,0.90)",backdropFilter:"blur(10px)"}}>
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setPhase("intro")}
              className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-medium">Reiniciar</span>
            </button>
            <div className="text-center">
              <p className="text-purple-400 font-black text-sm tracking-widest">ESCOLHA {pickedCards.length + 1} / {DECK_SIZE}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">{pickedCards.length} cartas</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full" style={{background:"rgba(255,255,255,0.05)"}}>
            <div className="h-full transition-all duration-500 ease-out"
              style={{width:`${progress}%`,background:"linear-gradient(90deg,#7e22ce,#a855f7)"}} />
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center px-4 py-6">

          {/* Instruction */}
          <p className="text-slate-400 text-xs font-medium tracking-wider uppercase mb-6">
            Escolha <span className="text-purple-300">1 carta</span> para adicionar ao seu deck
          </p>

          {/* Card options */}
          <div className="flex gap-4 justify-center w-full max-w-2xl mb-8 flex-wrap">
            {currentOptions.map((card, idx) => (
              <div key={`${card.id}-${pickNumber}-${idx}`} className="flex flex-col items-center gap-2"
                style={{animation:`draftCardIn 0.35s cubic-bezier(0.34,1.56,0.64,1) ${idx*0.08}s both`}}>

                {/* Card */}
                <button
                  onClick={() => handlePick(card)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`relative overflow-hidden border-2 transition-all duration-200 ${rarityBorder(card.rarity)} ${
                    hoveredIdx === idx ? "scale-110 z-10" : "scale-100"
                  }`}
                  style={{
                    width:"130px", height:"185px",
                    boxShadow: hoveredIdx===idx ? `0 0 28px ${rarityGlow(card.rarity)}, 0 8px 24px rgba(0,0,0,0.6)` : `0 0 12px ${rarityGlow(card.rarity)}`,
                  }}>
                  <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="140px" className="object-cover" />

                  {/* Hover overlay — pick indicator */}
                  {hoveredIdx === idx && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{background:"rgba(168,85,247,0.25)"}}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-white/80"
                        style={{background:"rgba(168,85,247,0.7)"}}>
                        <Check className="w-7 h-7 text-white" />
                      </div>
                    </div>
                  )}

                  {/* Info button */}
                  <button
                    onClick={e => { e.stopPropagation(); setZoomedCard(card) }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
                    style={{background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.2)"}}>
                    <Info className="w-3.5 h-3.5 text-white" />
                  </button>
                </button>

                {/* Card info below */}
                <div className="text-center w-32">
                  <p className="text-white text-[11px] font-bold leading-tight truncate" title={card.name}>{card.name}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r ${rarityBadge(card.rarity)}`}>
                      {card.rarity}
                    </span>
                    <span className={`text-[10px] font-semibold ${typeColor(card.type)}`}>{typeLabel(card.type)}</span>
                    {card.dp > 0 && <span className="text-[10px] text-slate-400">{card.dp}DP</span>}
                  </div>
                  {card.element && <p className="text-[10px] text-slate-500 mt-0.5">{card.element}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Already picked — mini preview */}
          {pickedCards.length > 0 && (
            <div className="w-full max-w-2xl">
              <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2">Deck atual ({pickedCards.length} cartas)</p>
              <div className="flex flex-wrap gap-1.5">
                {pickedCards.map((c, i) => (
                  <div key={`picked-${c.id}-${i}`}
                    className={`relative overflow-hidden border ${rarityBorder(c.rarity)}`}
                    style={{width:"40px", height:"56px"}}>
                    <Image src={c.image||"/placeholder.svg"} alt={c.name} fill sizes="44px" className="object-cover" />
                  </div>
                ))}
                {/* Empty slots */}
                {Array.from({length: DECK_SIZE - pickedCards.length}).map((_,i) => (
                  <div key={`empty-${i}`} className="border border-dashed border-white/10 rounded"
                    style={{width:"40px",height:"56px",background:"rgba(255,255,255,0.02)"}} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Card zoom modal */}
        {zoomedCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setZoomedCard(null)}>
            <div className="flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
              <div className="relative w-full aspect-[3/4] shadow-2xl"
                style={{boxShadow:`0 0 40px ${rarityGlow(zoomedCard.rarity)}`}}>
                <Image src={zoomedCard.image||"/placeholder.svg"} alt={zoomedCard.name} fill sizes="320px" className="object-contain" />
              </div>
              <div className="text-center">
                <h3 className="text-white font-black text-xl">{zoomedCard.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className={`px-3 py-0.5 rounded-full text-sm font-bold bg-gradient-to-r ${rarityBadge(zoomedCard.rarity)}`}>{zoomedCard.rarity}</span>
                  <span className={`text-sm font-semibold ${typeColor(zoomedCard.type)}`}>{typeLabel(zoomedCard.type)}</span>
                  {zoomedCard.dp > 0 && <span className="text-slate-400 text-sm">{zoomedCard.dp} DP</span>}
                </div>
                {zoomedCard.ability && (
                  <div className="mt-3 text-left bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-cyan-400 text-xs font-bold mb-1">{zoomedCard.ability}</p>
                    <p className="text-slate-300 text-xs leading-relaxed">{zoomedCard.abilityDescription}</p>
                  </div>
                )}
                {zoomedCard.attack && (
                  <p className="mt-2 text-amber-400 text-xs font-semibold">⚔ {zoomedCard.attack}</p>
                )}
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={() => setZoomedCard(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-colors">
                  Fechar
                </button>
                <button onClick={() => { handlePick(zoomedCard); setZoomedCard(null) }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:brightness-110"
                  style={{background:"linear-gradient(135deg,#7e22ce,#a855f7)"}}>
                  <Check className="w-4 h-4" />Escolher
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes draftCardIn {
            from { opacity:0; transform:translateY(20px) scale(0.9); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
        `}</style>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REVIEW
  if (phase === "review") {
    // Analyse deck composition
    const units  = pickedCards.filter(c => c.type==="unit"||c.type==="troops")
    const funcs  = pickedCards.filter(c => ["action","magic","item","trap"].includes(c.type))
    const others = pickedCards.filter(c => !["unit","troops","action","magic","item","trap"].includes(c.type))
    const rarityCount = (r:string) => pickedCards.filter(c => c.rarity===r).length

    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{background:"linear-gradient(160deg,#020812 0%,#050e1c 50%,#030a14 100%)"}}>

        <div className="absolute inset-0 pointer-events-none">
          <div style={{position:"absolute",top:"-5%",left:"20%",width:"500px",height:"350px",background:"radial-gradient(ellipse,rgba(168,85,247,0.10) 0%,transparent 65%)",filter:"blur(40px)"}} />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.07]"
          style={{background:"rgba(2,8,18,0.90)",backdropFilter:"blur(8px)"}}>
          <button onClick={() => startDraft()} className="text-slate-500 hover:text-white text-sm px-2 py-1.5 rounded-lg hover:bg-white/5 flex items-center gap-1.5 transition-colors">
            <Shuffle className="w-4 h-4" />Refazer
          </button>
          <h1 className="text-lg font-black text-white">Deck Montado!</h1>
          <div className="w-20" />
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto w-full">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { label:"Unidades", value:units.length,  color:"text-cyan-400" },
              { label:"Funções",  value:funcs.length,  color:"text-purple-400" },
              { label:"Outros",   value:others.length, color:"text-amber-400" },
              { label:"Cartas",   value:pickedCards.length, color:"text-white" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] p-3 text-center" style={{background:"rgba(255,255,255,0.03)"}}>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-slate-600 text-[10px] font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Rarity breakdown */}
          <div className="flex gap-2 mb-5">
            {(["LR","UR","SR","R"] as const).map(r => rarityCount(r) > 0 && (
              <div key={r} className={`flex-1 py-2 rounded-xl border text-center bg-gradient-to-r ${rarityBadge(r)} border-transparent`}>
                <p className="text-lg font-black">{rarityCount(r)}</p>
                <p className="text-[10px] font-bold opacity-80">{r}</p>
              </div>
            ))}
          </div>

          {/* Card grid */}
          <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-3">Todas as cartas</p>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {pickedCards.map((card, i) => (
              <button key={`review-${card.id}-${i}`}
                onClick={() => setZoomedCard(card)}
                className={`relative overflow-hidden border-2 transition-all hover:scale-105 hover:z-10 ${rarityBorder(card.rarity)}`}
                style={{aspectRatio:"3/4", boxShadow:`0 0 8px ${rarityGlow(card.rarity)}`}}>
                <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>

          {/* Start duel button */}
          <button onClick={() => setPhase("duel")}
            className="w-full py-4 rounded-2xl font-black text-xl text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-2xl mb-3"
            style={{background:"linear-gradient(135deg,#1d4ed8,#3b82f6,#2563eb)",boxShadow:"0 8px 32px rgba(59,130,246,0.35)"}}>
            <Swords className="w-7 h-7" />
            Iniciar Duelo!
          </button>
          <button onClick={() => startDraft()}
            className="w-full py-2.5 rounded-xl border border-white/[0.08] text-slate-500 hover:text-slate-300 text-sm font-semibold transition-colors hover:bg-white/[0.04] flex items-center justify-center gap-2">
            <Shuffle className="w-4 h-4" />Refazer Draft
          </button>
        </div>

        {/* Card zoom modal (reused) */}
        {zoomedCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setZoomedCard(null)}>
            <div className="flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
              <div className="relative w-full aspect-[3/4]" style={{boxShadow:`0 0 40px ${rarityGlow(zoomedCard.rarity)}`}}>
                <Image src={zoomedCard.image||"/placeholder.svg"} alt={zoomedCard.name} fill sizes="320px" className="object-contain" />
              </div>
              <div className="text-center">
                <h3 className="text-white font-black text-xl">{zoomedCard.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className={`px-3 py-0.5 rounded-full text-sm font-bold bg-gradient-to-r ${rarityBadge(zoomedCard.rarity)}`}>{zoomedCard.rarity}</span>
                  <span className={`text-sm ${typeColor(zoomedCard.type)}`}>{typeLabel(zoomedCard.type)}</span>
                  {zoomedCard.dp > 0 && <span className="text-slate-400 text-sm">{zoomedCard.dp} DP</span>}
                </div>
                {zoomedCard.ability && (
                  <div className="mt-3 text-left bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-cyan-400 text-xs font-bold mb-1">{zoomedCard.ability}</p>
                    <p className="text-slate-300 text-xs leading-relaxed">{zoomedCard.abilityDescription}</p>
                  </div>
                )}
                {zoomedCard.attack && <p className="mt-2 text-amber-400 text-xs font-semibold">⚔ {zoomedCard.attack}</p>}
              </div>
              <button onClick={() => setZoomedCard(null)}
                className="w-full py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-colors">
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

// ─── Wrapper that injects the draft deck into DuelScreen ─────────────────────
// DuelScreen starts with deck selection — we bypass it by passing mode="bot"
// and auto-selecting the draft deck via the initialDeck prop.
// Since DuelScreen's props only accept mode+onBack, we render it and
// programmatically trigger startGame via a ref bridge or just use the
// existing DuelScreen which allows deck selection then starts the game.
// The cleanest approach: extend DuelScreen to accept an optional initialDeck.
// For now we render DuelScreen in bot mode — it will show deck selector,
// but with the draft deck pre-filled via a hidden auto-select.
function DraftDuelWrapper({
  deck,
  difficulty,
  onBack,
}: {
  deck: { id: string; name: string; cards: Card[] }
  difficulty: "easy" | "medium" | "hard"
  onBack: () => void
}) {
  // We inject the draft deck via localStorage so DuelScreen finds it
  // without requiring code changes to DuelScreen itself.
  const [ready, setReady] = useState(false)

  // On mount: write a temporary deck to a well-known key that DuelScreen
  // can optionally read. Since modifying DuelScreen is a larger change,
  // we use a lighter approach: provide a thin wrapper that injects
  // a "draft" deck directly through the game context's deck list.
  const { decks, setDecks } = useGame() as any

  useState(() => {
    // Prepend the draft deck at index 0 so it appears first
    const draftDeck = {
      ...deck,
      id: `draft-${Date.now()}`,
      _isDraft: true,
    }
    setDecks((prev: any[]) => [draftDeck, ...prev.filter((d: any) => !d._isDraft)])
    setReady(true)
  })

  if (!ready) return null

  return (
    <DuelScreen
      mode="bot"
      onBack={() => {
        // Clean up draft deck on exit
        setDecks((prev: any[]) => prev.filter((d: any) => !d._isDraft))
        onBack()
      }}
    />
  )
}
