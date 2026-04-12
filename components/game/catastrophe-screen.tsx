"use client"

import { useState } from "react"
import { DuelScreen } from "./duel-screen"
import { ArrowLeft, Zap, Bot, Users, AlertTriangle } from "lucide-react"

interface CatastropheScreenProps {
  onBack: () => void
}

type CatSubMode = "select" | "bot-setup" | "duel"

export default function CatastropheScreen({ onBack }: CatastropheScreenProps) {
  const [subMode, setSubMode] = useState<CatSubMode>("select")
  const [duelMode, setDuelMode] = useState<"bot" | "player">("bot")
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium")

  // ─── Duel phase ──────────────────────────────────────────────────────────
  if (subMode === "duel") {
    return (
      <DuelScreen
        key={`catastrophe-${duelMode}`}
        mode={duelMode}
        onBack={onBack}
        catastropheMode
      />
    )
  }

  // ─── Bot difficulty setup ─────────────────────────────────────────────────
  if (subMode === "bot-setup") {
    const diffs = [
      { id:"easy",   label:"Fácil",   color:"from-green-700 to-green-600", border:"border-green-500/40", dot:"bg-green-400", desc:"Bot joga aleatoriamente sem estratégia." },
      { id:"medium", label:"Médio",   color:"from-amber-700 to-amber-600", border:"border-amber-500/40", dot:"bg-amber-400", desc:"Bot prioriza unidades fortes e usa habilidades." },
      { id:"hard",   label:"Difícil", color:"from-red-800 to-red-700",     border:"border-red-500/40",   dot:"bg-red-400",   desc:"Bot otimizado: gestão de campo e sequência de ataques." },
    ] as const
    return (
      <ScreenWrapper onBack={() => setSubMode("select")} title="Modo Catástrofe — VS BOT">
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-sm mx-auto w-full gap-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-white mb-1">Dificuldade</h2>
            <p className="text-slate-400 text-sm">Como o oponente deve jogar?</p>
          </div>
          <div className="w-full space-y-3">
            {diffs.map(d => (
              <button key={d.id}
                onClick={() => { setDifficulty(d.id); setDuelMode("bot"); setSubMode("duel") }}
                className={`w-full py-4 px-5 rounded-2xl border text-left transition-all hover:scale-[1.02] hover:brightness-110 ${d.border}`}
                style={{background:`linear-gradient(135deg,${d.color.replace("from-","").replace(" to-",", ")})`}}>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`w-3 h-3 rounded-full ${d.dot}`} />
                  <span className="text-white font-black text-lg">{d.label}</span>
                </div>
                <p className="text-white/70 text-xs pl-6">{d.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </ScreenWrapper>
    )
  }

  // ─── Mode selection ───────────────────────────────────────────────────────
  return (
    <ScreenWrapper onBack={onBack} title="Modo Catástrofe">
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full">

        {/* Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 blur-3xl rounded-full" style={{background:"rgba(239,68,68,0.35)",transform:"scale(1.6)"}} />
          <div className="relative w-28 h-28 rounded-3xl flex items-center justify-center border border-red-500/40 shadow-2xl"
            style={{background:"linear-gradient(145deg,rgba(127,29,29,0.95),rgba(220,38,38,0.85))"}}>
            <span className="text-5xl">☄️</span>
          </div>
        </div>

        <h2 className="text-3xl font-black text-white text-center mb-2">Modo Catástrofe</h2>
        <p className="text-red-400 text-xs font-bold tracking-widest uppercase mb-6">Eventos Destrutivos</p>

        <p className="text-slate-400 text-center text-sm leading-relaxed mb-8 max-w-sm">
          A cada turno, eventos catastróficos abalam o campo de batalha — meteoros destroem unidades, apagões cegam o inimigo, tempestades causam dano direto e muito mais. Prepare-se para o caos!
        </p>

        {/* Event preview */}
        <div className="w-full rounded-2xl border border-white/[0.08] mb-8 overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}>
          <div className="px-4 py-2 border-b border-white/[0.06]">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Exemplos de Eventos</p>
          </div>
          {[
            { emoji:"☄️", name:"Chuva de Meteoros",  desc:"Destrói até 2 unidades aleatórias em campo." },
            { emoji:"⚡", name:"Tempestade Elétrica", desc:"Causa 5 de dano direto a ambos os jogadores." },
            { emoji:"🌑", name:"Apagão Dimensional",  desc:"O campo do inimigo fica oculto por 1 turno." },
            { emoji:"🌊", name:"Tsunami Arcano",       desc:"Devol. todas as Function Cards ao deck." },
            { emoji:"❄️", name:"Inverno Eterno",       desc:"Todas as unidades perdem 1 DP neste turno." },
          ].map((e,i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-0">
              <span className="text-xl">{e.emoji}</span>
              <div>
                <p className="text-white text-xs font-bold">{e.name}</p>
                <p className="text-slate-500 text-[10px]">{e.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mode buttons */}
        <div className="w-full space-y-3 max-w-sm">
          <button onClick={() => setSubMode("bot-setup")}
            className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl border border-blue-400/30"
            style={{background:"linear-gradient(135deg,#1d4ed8,#3b82f6,#2563eb)",boxShadow:"0 8px 24px rgba(59,130,246,0.25)"}}>
            <Bot className="w-6 h-6" />VS BOT
          </button>
          <button onClick={() => { setDuelMode("player"); setSubMode("duel") }}
            className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl border border-orange-400/30"
            style={{background:"linear-gradient(135deg,#c2410c,#f97316,#ea580c)",boxShadow:"0 8px 24px rgba(249,115,22,0.25)"}}>
            <Users className="w-6 h-6" />VS JOGADOR
          </button>
        </div>
      </div>
    </ScreenWrapper>
  )
}

function ScreenWrapper({ children, onBack, title }: {
  children: React.ReactNode; onBack: () => void; title: string
}) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{background:"linear-gradient(160deg,#0a0204 0%,#180308 50%,#0a0204 100%)"}}>
      <div className="absolute inset-0 pointer-events-none">
        <div style={{position:"absolute",top:"-10%",right:"20%",width:"600px",height:"400px",background:"radial-gradient(ellipse,rgba(239,68,68,0.10) 0%,transparent 65%)",filter:"blur(40px)"}} />
        <div style={{position:"absolute",bottom:"5%",left:"10%",width:"400px",height:"300px",background:"radial-gradient(ellipse,rgba(251,191,36,0.07) 0%,transparent 65%)",filter:"blur(30px)"}} />
        <div style={{position:"absolute",inset:0,opacity:0.025,backgroundImage:"linear-gradient(rgba(239,68,68,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.3) 1px,transparent 1px)",backgroundSize:"64px 64px"}} />
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]"
        style={{background:"rgba(10,2,4,0.90)",backdropFilter:"blur(8px)"}}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
          <ArrowLeft className="w-4 h-4" /><span className="text-xs font-medium">Voltar</span>
        </button>
        <h1 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
          <span>☄️</span>{title}
        </h1>
        <div className="w-20" />
      </div>

      {children}
    </div>
  )
}
