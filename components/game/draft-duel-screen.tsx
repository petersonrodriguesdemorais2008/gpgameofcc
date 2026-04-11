"use client"

import { useState, useMemo, useCallback } from "react"
import { useGame, type Card } from "@/contexts/game-context"
import { DuelScreen } from "./duel-screen"
import Image from "next/image"
import { ArrowLeft, Shuffle, Swords, Check, Info, Zap, Star, Shield } from "lucide-react"

// ─── Draft config ─────────────────────────────────────────────────────────────
const OPTIONS_PER_PICK = 3
const DECK_SIZE        = 20
const TAP_SIZE         = 5

const RARITY_WEIGHTS: Record<string, number> = { R: 60, SR: 28, UR: 10, LR: 2 }

const TYPE_WEIGHTS: Record<string, number> = {
  unit: 3, troops: 2, action: 2.5, magic: 2, item: 2,
  trap: 1.5, ultimateGear: 0.8, ultimateGuardian: 0.8, scenario: 0.4,
}

const TAP_TYPE_WEIGHTS: Record<string, number> = {
  action: 3, magic: 2.5, item: 2.5, trap: 2, unit: 0.5, troops: 0.5,
}

type DraftPhase = "intro" | "main-draft" | "tap-draft" | "review" | "duel"

// ─── Helpers ─────────────────────────────────────────────────────────────────
function weightedRandom<T>(items: T[], weight: (x: T) => number): T {
  const total = items.reduce((s, i) => s + weight(i), 0)
  let r = Math.random() * total
  for (const item of items) { r -= weight(item); if (r <= 0) return item }
  return items[items.length - 1]
}

const rarityBorder = (r: string) =>
  r==="LR" ? "border-red-400" : r==="UR" ? "border-sky-400" :
  r==="SR" ? "border-purple-400" : "border-slate-600"

const rarityGlow = (r: string) =>
  r==="LR" ? "rgba(239,68,68,0.5)"  : r==="UR" ? "rgba(56,189,248,0.5)"  :
  r==="SR" ? "rgba(168,85,247,0.4)" : "rgba(100,116,139,0.15)"

const rarityBadgeCls = (r: string) =>
  r==="LR" ? "from-red-500 to-amber-500 text-white"    :
  r==="UR" ? "from-sky-500 to-cyan-400 text-white"     :
  r==="SR" ? "from-purple-600 to-purple-400 text-white" :
  "from-slate-600 to-slate-500 text-slate-200"

const typeLabel = (t: string) => ({
  unit:"Unidade", troops:"Tropas", action:"Action", magic:"Magic",
  item:"Item", trap:"Trap", ultimateGear:"UG", ultimateGuardian:"UGr", scenario:"Cenário"
}[t] ?? t)

const typeColor = (t: string) =>
  ["unit","troops"].includes(t)                   ? "text-cyan-400"    :
  ["action","magic"].includes(t)                  ? "text-purple-400"  :
  ["item","trap"].includes(t)                     ? "text-amber-400"   :
  ["ultimateGear","ultimateGuardian"].includes(t) ? "text-emerald-400" :
  "text-slate-400"

// ─── Component ───────────────────────────────────────────────────────────────
interface DraftDuelScreenProps { onBack: () => void }

export default function DraftDuelScreen({ onBack }: DraftDuelScreenProps) {
  const { allCards } = useGame()

  const [phase, setPhase]           = useState<DraftPhase>("intro")
  const [mainDeck, setMainDeck]     = useState<Card[]>([])
  const [tapCards, setTapCards]     = useState<Card[]>([])
  const [options, setOptions]       = useState<Card[]>([])
  const [pickNum, setPickNum]       = useState(0)
  const [zoomedCard, setZoomedCard] = useState<Card | null>(null)
  const [difficulty, setDifficulty] = useState<"easy"|"medium"|"hard">("medium")
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const draftPool = useMemo(() => allCards.filter(c => TYPE_WEIGHTS[c.type] !== undefined), [allCards])
  const tapPool   = useMemo(() => allCards.filter(c => TAP_TYPE_WEIGHTS[c.type] !== undefined), [allCards])

  const genOptions = useCallback((pool: Card[], usedIds: Set<string>, weights: Record<string,number>): Card[] => {
    const out: Card[] = []
    const localUsed = new Set(usedIds)
    for (let attempt = 0; attempt < 60 && out.length < OPTIONS_PER_PICK; attempt++) {
      const rarity     = weightedRandom(Object.keys(RARITY_WEIGHTS), r => RARITY_WEIGHTS[r])
      const candidates = pool.filter(c => c.rarity === rarity && !localUsed.has(c.id))
      if (!candidates.length) continue
      const pick = weightedRandom(candidates, c => weights[c.type] ?? 1)
      out.push(pick)
      localUsed.add(pick.id)
    }
    return out
  }, [])

  // ── Start main draft ──
  const startMainDraft = () => {
    const used = new Set<string>()
    setOptions(genOptions(draftPool, used, TYPE_WEIGHTS))
    setMainDeck([])
    setTapCards([])
    setPickNum(0)
    setPhase("main-draft")
  }

  // ── Pick main deck card ──
  const pickMain = (card: Card) => {
    const next = [...mainDeck, card]
    setMainDeck(next)
    if (next.length >= DECK_SIZE) {
      const used = new Set<string>(next.map(c => c.id))
      setOptions(genOptions(tapPool, used, TAP_TYPE_WEIGHTS))
      setPickNum(0)
      setPhase("tap-draft")
      return
    }
    const used = new Set<string>(next.map(c => c.id))
    setOptions(genOptions(draftPool, used, TYPE_WEIGHTS))
    setPickNum(p => p + 1)
  }

  // ── Pick TAP card ──
  const pickTap = (card: Card) => {
    const next = [...tapCards, card]
    setTapCards(next)
    if (next.length >= TAP_SIZE) {
      setPhase("review")
      return
    }
    const used = new Set<string>([...mainDeck.map(c => c.id), ...next.map(c => c.id)])
    setOptions(genOptions(tapPool, used, TAP_TYPE_WEIGHTS))
    setPickNum(p => p + 1)
  }

  const finalDeck = useMemo(() => ({
    id:       "draft-deck",
    name:     "Draft Deck",
    cards:    mainDeck,
    tapCards: tapCards,
  }), [mainDeck, tapCards])

  // ─── DUEL ─────────────────────────────────────────────────────────────────
  if (phase === "duel") {
    return (
      <DuelScreen
        mode="bot"
        draftDeck={finalDeck}
        draftDifficulty={difficulty}
        onBack={onBack}
      />
    )
  }

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{background:"linear-gradient(160deg,#020812 0%,#050e1c 50%,#030a14 100%)"}}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{position:"absolute",top:"-10%",left:"30%",width:"600px",height:"400px",background:"radial-gradient(ellipse,rgba(168,85,247,0.12) 0%,transparent 65%)",filter:"blur(40px)"}} />
          <div style={{position:"absolute",bottom:"0",right:"10%",width:"400px",height:"300px",background:"radial-gradient(ellipse,rgba(6,182,212,0.10) 0%,transparent 65%)",filter:"blur(30px)"}} />
        </div>

        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.07]"
          style={{background:"rgba(2,8,18,0.85)",backdropFilter:"blur(8px)"}}>
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" /><span className="text-sm font-medium">Voltar</span>
          </button>
          <h1 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-purple-400" />Draft VS BOT
          </h1>
          <div className="w-20" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto w-full">
          <div className="relative mb-8">
            <div className="absolute inset-0 blur-2xl rounded-full" style={{background:"rgba(168,85,247,0.3)",transform:"scale(1.5)"}} />
            <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center border border-purple-500/40"
              style={{background:"linear-gradient(145deg,rgba(88,28,135,0.9),rgba(109,40,217,0.8))"}}>
              <Shuffle className="w-12 h-12 text-purple-200" />
            </div>
          </div>

          <h2 className="text-3xl font-black text-white text-center mb-3">Draft VS BOT</h2>
          <p className="text-slate-400 text-center text-sm leading-relaxed mb-8 max-w-sm">
            Monte seu deck na hora! Escolha <span className="text-purple-300 font-bold">{DECK_SIZE} cartas</span> para o deck principal e depois <span className="text-cyan-300 font-bold">{TAP_SIZE} cartas para o TAP</span>. Cada rodada apresenta {OPTIONS_PER_PICK} opções aleatórias.
          </p>

          <div className="w-full rounded-2xl border border-white/[0.08] mb-8 overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}>
            {[
              { icon:<Shuffle className="w-4 h-4 text-purple-400"/>, text:`${DECK_SIZE} picks — Deck Principal` },
              { icon:<Shield className="w-4 h-4 text-cyan-400"/>,   text:`${TAP_SIZE} picks — Cartas do TAP` },
              { icon:<Star className="w-4 h-4 text-amber-400"/>,    text:"Raridades variadas: R, SR, UR e LR" },
              { icon:<Swords className="w-4 h-4 text-red-400"/>,    text:"Duelo completo com todos os elementos do jogo" },
              { icon:<Zap className="w-4 h-4 text-emerald-400"/>,   text:"Deck temporário — apenas para este duelo" },
            ].map((r,i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] last:border-0">
                {r.icon}<span className="text-slate-300 text-sm">{r.text}</span>
              </div>
            ))}
          </div>

          <div className="w-full mb-6">
            <p className="text-slate-500 text-[11px] uppercase tracking-widest font-semibold mb-2 text-center">Dificuldade do Bot</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id:"easy",   label:"Fácil",   color:"from-green-700 to-green-600", border:"border-green-500/40", dot:"bg-green-400" },
                { id:"medium", label:"Médio",   color:"from-amber-700 to-amber-600", border:"border-amber-500/40", dot:"bg-amber-400" },
                { id:"hard",   label:"Difícil", color:"from-red-800 to-red-700",     border:"border-red-500/40",   dot:"bg-red-400"   },
              ] as const).map(d => (
                <button key={d.id} onClick={() => setDifficulty(d.id)}
                  className={`py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    difficulty===d.id ? `bg-gradient-to-r ${d.color} ${d.border} text-white shadow-lg` : "bg-white/[0.03] border-white/[0.08] text-slate-500 hover:text-slate-300"
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${difficulty===d.id ? d.dot : "bg-slate-600"}`} />{d.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={startMainDraft}
            className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-2xl"
            style={{background:"linear-gradient(135deg,#7e22ce,#9333ea,#a855f7)",boxShadow:"0 8px 32px rgba(168,85,247,0.35)"}}>
            <Shuffle className="w-6 h-6" />Iniciar Draft
          </button>
        </div>
      </div>
    )
  }

  // ─── DRAFTING (main + tap shared layout) ──────────────────────────────────
  const isMainDraft = phase === "main-draft"
  const picked      = isMainDraft ? mainDeck : tapCards
  const totalPicks  = isMainDraft ? DECK_SIZE : TAP_SIZE
  const handlePick  = isMainDraft ? pickMain : pickTap
  const progress    = (picked.length / totalPicks) * 100

  if (phase === "main-draft" || phase === "tap-draft") {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{background:"linear-gradient(160deg,#020812 0%,#050e1c 50%,#030a14 100%)"}}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{position:"absolute",top:"-5%",left:"20%",width:"500px",height:"350px",
            background:`radial-gradient(ellipse,${isMainDraft?"rgba(168,85,247,0.08)":"rgba(6,182,212,0.08)"} 0%,transparent 65%)`,filter:"blur(40px)"}} />
        </div>

        {/* Header */}
        <div className="relative z-10 border-b border-white/[0.07]"
          style={{background:"rgba(2,8,18,0.90)",backdropFilter:"blur(10px)"}}>
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setPhase("intro")}
              className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
              <ArrowLeft className="w-4 h-4" /><span className="text-xs font-medium">Reiniciar</span>
            </button>
            <div className="text-center">
              <p className={`font-black text-sm tracking-widest ${isMainDraft?"text-purple-400":"text-cyan-400"}`}>
                {isMainDraft ? `DECK PRINCIPAL — ${picked.length+1}/${totalPicks}` : `TAP — ${picked.length+1}/${totalPicks}`}
              </p>
            </div>
            <div className="text-slate-500 text-xs">{picked.length} cartas</div>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full" style={{background:"rgba(255,255,255,0.05)"}}>
            <div className="h-full transition-all duration-500 ease-out"
              style={{width:`${progress}%`,background:isMainDraft?"linear-gradient(90deg,#7e22ce,#a855f7)":"linear-gradient(90deg,#0e7490,#06b6d4)"}} />
          </div>

          {/* Phase tabs */}
          <div className="flex border-t border-white/[0.05]">
            {[
              { label:`Deck Principal (${mainDeck.length}/${DECK_SIZE})`, active:isMainDraft, done:!isMainDraft },
              { label:`TAP (${tapCards.length}/${TAP_SIZE})`,             active:!isMainDraft, done:false },
            ].map((s,i) => (
              <div key={i} className={`flex-1 py-1.5 text-center text-[10px] font-bold tracking-wider border-b-2 ${
                s.active ? "text-white border-purple-400" : s.done ? "text-slate-500 border-emerald-500" : "text-slate-700 border-transparent"
              }`}>
                {s.done ? "✓ " : ""}{s.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center px-4 py-6">
          <p className="text-slate-400 text-xs font-medium tracking-wider uppercase mb-6">
            {isMainDraft ? "Escolha 1 carta para o deck principal" : "Escolha 1 carta para o TAP"}
          </p>

          {/* Options */}
          <div className="flex gap-4 justify-center w-full max-w-2xl mb-8 flex-wrap">
            {options.map((card, idx) => (
              <div key={`opt-${card.id}-${pickNum}-${idx}`} className="flex flex-col items-center gap-2"
                style={{animation:`draftCardIn 0.35s cubic-bezier(0.34,1.56,0.64,1) ${idx*0.08}s both`}}>
                <button
                  onClick={() => handlePick(card)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`relative overflow-hidden border-2 transition-all duration-200 ${rarityBorder(card.rarity)} ${hoveredIdx===idx?"scale-110 z-10":"scale-100"}`}
                  style={{
                    width:"130px", height:"185px",
                    boxShadow: hoveredIdx===idx
                      ? `0 0 28px ${rarityGlow(card.rarity)},0 8px 24px rgba(0,0,0,0.6)`
                      : `0 0 10px ${rarityGlow(card.rarity)}`,
                  }}>
                  <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="140px" className="object-cover" />
                  {hoveredIdx===idx && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{background:"rgba(168,85,247,0.25)"}}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-white/80" style={{background:"rgba(168,85,247,0.7)"}}>
                        <Check className="w-7 h-7 text-white" />
                      </div>
                    </div>
                  )}
                  <button onClick={e => { e.stopPropagation(); setZoomedCard(card) }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center hover:scale-110 transition-all"
                    style={{background:"rgba(0,0,0,0.75)",border:"1px solid rgba(255,255,255,0.2)"}}>
                    <Info className="w-3.5 h-3.5 text-white" />
                  </button>
                </button>
                <div className="text-center w-32">
                  <p className="text-white text-[11px] font-bold leading-tight truncate">{card.name}</p>
                  <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r ${rarityBadgeCls(card.rarity)}`}>{card.rarity}</span>
                    <span className={`text-[10px] font-semibold ${typeColor(card.type)}`}>{typeLabel(card.type)}</span>
                    {card.dp > 0 && <span className="text-[10px] text-slate-400">{card.dp}DP</span>}
                  </div>
                  {card.element && <p className="text-[10px] text-slate-500 mt-0.5">{card.element}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Picked mini preview */}
          {picked.length > 0 && (
            <div className="w-full max-w-2xl">
              <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2">
                {isMainDraft ? `Deck principal (${picked.length}/${totalPicks})` : `TAP (${picked.length}/${totalPicks})`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {picked.map((c,i) => (
                  <div key={`p-${c.id}-${i}`} className={`relative overflow-hidden border ${rarityBorder(c.rarity)}`}
                    style={{width:"38px",height:"54px"}}>
                    <Image src={c.image||"/placeholder.svg"} alt={c.name} fill sizes="42px" className="object-cover" />
                  </div>
                ))}
                {Array.from({length:totalPicks-picked.length}).map((_,i) => (
                  <div key={`e-${i}`} className="border border-dashed border-white/[0.08] rounded"
                    style={{width:"38px",height:"54px",background:"rgba(255,255,255,0.02)"}} />
                ))}
              </div>
            </div>
          )}
        </div>

        <ZoomModal card={zoomedCard} onClose={() => setZoomedCard(null)}
          onPick={c => { handlePick(c); setZoomedCard(null) }} showPick />

        <style jsx>{`
          @keyframes draftCardIn {
            from { opacity:0; transform:translateY(20px) scale(0.9); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
        `}</style>
      </div>
    )
  }

  // ─── REVIEW ───────────────────────────────────────────────────────────────
  if (phase === "review") {
    const units  = mainDeck.filter(c => ["unit","troops"].includes(c.type))
    const funcs  = mainDeck.filter(c => ["action","magic","item","trap"].includes(c.type))
    const others = mainDeck.filter(c => !["unit","troops","action","magic","item","trap"].includes(c.type))
    const rc = (r:string) => mainDeck.filter(c => c.rarity===r).length

    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{background:"linear-gradient(160deg,#020812 0%,#050e1c 50%,#030a14 100%)"}}>
        <div className="absolute inset-0 pointer-events-none">
          <div style={{position:"absolute",top:"-5%",left:"20%",width:"500px",height:"350px",
            background:"radial-gradient(ellipse,rgba(168,85,247,0.10) 0%,transparent 65%)",filter:"blur(40px)"}} />
        </div>

        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.07]"
          style={{background:"rgba(2,8,18,0.90)",backdropFilter:"blur(8px)"}}>
          <button onClick={startMainDraft}
            className="text-slate-500 hover:text-white text-sm px-2 py-1.5 rounded-lg hover:bg-white/5 flex items-center gap-1.5 transition-colors">
            <Shuffle className="w-4 h-4" />Refazer
          </button>
          <h1 className="text-lg font-black text-white">Deck Pronto!</h1>
          <div className="w-20" />
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto w-full">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label:"Unidades", value:units.length,    color:"text-cyan-400"   },
              { label:"Funções",  value:funcs.length,    color:"text-purple-400" },
              { label:"Outros",   value:others.length,   color:"text-amber-400"  },
              { label:"Total",    value:mainDeck.length, color:"text-white"      },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] p-3 text-center" style={{background:"rgba(255,255,255,0.03)"}}>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-slate-600 text-[10px] font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Rarity breakdown */}
          <div className="flex gap-2 mb-5">
            {(["LR","UR","SR","R"] as const).filter(r => rc(r)>0).map(r => (
              <div key={r} className={`flex-1 py-2 rounded-xl text-center bg-gradient-to-r ${rarityBadgeCls(r)}`}>
                <p className="text-lg font-black">{rc(r)}</p>
                <p className="text-[10px] font-bold opacity-80">{r}</p>
              </div>
            ))}
          </div>

          {/* Main deck */}
          <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2">Deck Principal ({mainDeck.length} cartas)</p>
          <div className="grid grid-cols-5 gap-1.5 mb-5">
            {mainDeck.map((c,i) => (
              <button key={`m-${c.id}-${i}`} onClick={() => setZoomedCard(c)}
                className={`relative overflow-hidden border-2 transition-all hover:scale-105 hover:z-10 ${rarityBorder(c.rarity)}`}
                style={{aspectRatio:"3/4",boxShadow:`0 0 8px ${rarityGlow(c.rarity)}`}}>
                <Image src={c.image||"/placeholder.svg"} alt={c.name} fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>

          {/* TAP cards */}
          <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2">Cartas do TAP ({tapCards.length} cartas)</p>
          <div className="grid grid-cols-5 gap-1.5 mb-6">
            {tapCards.map((c,i) => (
              <button key={`t-${c.id}-${i}`} onClick={() => setZoomedCard(c)}
                className={`relative overflow-hidden border-2 transition-all hover:scale-105 hover:z-10 ${rarityBorder(c.rarity)}`}
                style={{aspectRatio:"3/4",boxShadow:`0 0 8px ${rarityGlow(c.rarity)}`}}>
                <Image src={c.image||"/placeholder.svg"} alt={c.name} fill sizes="80px" className="object-cover" />
                <div className="absolute bottom-0 left-0 right-0 py-0.5 text-center text-[8px] font-black text-white"
                  style={{background:"rgba(6,182,212,0.80)"}}>TAP</div>
              </button>
            ))}
          </div>

          <button onClick={() => setPhase("duel")}
            className="w-full py-4 rounded-2xl font-black text-xl text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-2xl mb-3"
            style={{background:"linear-gradient(135deg,#1d4ed8,#3b82f6,#2563eb)",boxShadow:"0 8px 32px rgba(59,130,246,0.35)"}}>
            <Swords className="w-7 h-7" />Iniciar Duelo!
          </button>
          <button onClick={startMainDraft}
            className="w-full py-2.5 rounded-xl border border-white/[0.08] text-slate-500 hover:text-slate-300 text-sm font-semibold transition-colors hover:bg-white/[0.04] flex items-center justify-center gap-2">
            <Shuffle className="w-4 h-4" />Refazer Draft
          </button>
        </div>

        <ZoomModal card={zoomedCard} onClose={() => setZoomedCard(null)} />
      </div>
    )
  }

  return null
}

// ─── Zoom modal ───────────────────────────────────────────────────────────────
function ZoomModal({ card, onClose, onPick, showPick }: {
  card: Card | null; onClose: () => void
  onPick?: (c: Card) => void; showPick?: boolean
}) {
  if (!card) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:"rgba(0,0,0,0.92)",backdropFilter:"blur(6px)"}}
      onClick={onClose}>
      <div className="flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
        <div className="relative w-full aspect-[3/4] shadow-2xl"
          style={{boxShadow:`0 0 40px ${rarityGlow(card.rarity)}`}}>
          <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="320px" className="object-contain" />
        </div>
        <div className="text-center w-full">
          <h3 className="text-white font-black text-xl mb-1">{card.name}</h3>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className={`px-3 py-0.5 rounded-full text-sm font-bold bg-gradient-to-r ${rarityBadgeCls(card.rarity)}`}>{card.rarity}</span>
            <span className={`text-sm font-semibold ${typeColor(card.type)}`}>{typeLabel(card.type)}</span>
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
          {showPick && onPick && (
            <button onClick={() => onPick(card)}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:brightness-110"
              style={{background:"linear-gradient(135deg,#7e22ce,#a855f7)"}}>
              <Check className="w-4 h-4" />Escolher
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
