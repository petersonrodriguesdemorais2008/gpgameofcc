"use client"

/**
 * EVENTS SCREEN — Aba de Eventos (Treinamento Especial)
 *
 * Dois níveis de navegação:
 *  1. LISTA — banners dos eventos disponíveis (Ciclone Verde, Vastidão Roxa,
 *     Tsunami Azul, Incêndio Vermelho, Feixe Amarelo).
 *  2. FASES — cada evento abre uma tela com 3 painéis de duelo no mesmo
 *     espírito do mapa da Campanha: Fácil → Médio → Difícil, liberados em
 *     sequência, cada um com seu próprio drop de Gacha Coins e Gear Coins.
 *
 * O progresso é salvo em localStorage por evento/dificuldade. O resultado do
 * duelo volta via a chave "gpgame_event_battle_pending", escrita pelo
 * duel-screen ao terminar a partida (mesmo padrão do Modo História).
 */

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Check, Lock, Swords, Sparkles, Trophy } from "lucide-react"
import GearBackdrop from "./gear-backdrop"

export const EVENT_BATTLE_KEY = "gpgame_event_battle_pending"
const LS_PROGRESS_KEY = "gpgame_event_progress"

// ─── Dados dos eventos ───────────────────────────────────────────────────────

export type EventDifficulty = "easy" | "medium" | "hard"

export interface EventStageDef {
  difficulty: EventDifficulty
  label: string
  opponent: string
  lp: number
  gacha: number
  gear: number
  description: string
}

export interface EventDef {
  id: string
  name: string
  subtitle: string
  banner: string
  bannerAlt: string
  accent: string
  accentDark: string
  /** Nome do elemento em português, exibido na interface. */
  element: string
  /**
   * Grupo de elemento canônico das cartas (mesma normalização do deck builder).
   * Define o deck que o oponente usa: o treinamento de água enfrenta um deck
   * Aquos, o de trevas um deck Darkus, e assim por diante.
   */
  elementGroup: "aquos" | "ventus" | "fire" | "darkness" | "lightness"
}

/** As 3 fases são iguais em todos os eventos: fácil, médio e difícil. */
export const EVENT_STAGES: EventStageDef[] = [
  {
    difficulty: "easy",
    label: "Fácil",
    opponent: "Aprendiz de Treino",
    lp: 20,
    gacha: 10,
    gear: 30,
    description: "Aquecimento contra um duelista iniciante. Bom para testar o deck.",
  },
  {
    difficulty: "medium",
    label: "Médio",
    opponent: "Veterano do Coliseu",
    lp: 30,
    gacha: 20,
    gear: 50,
    description: "O oponente já sabe o que faz. Jogue com atenção ao ritmo do duelo.",
  },
  {
    difficulty: "hard",
    label: "Difícil",
    opponent: "Mestre do Treinamento",
    lp: 40,
    gacha: 30,
    gear: 80,
    description: "O desafio final do treinamento. Recompensa máxima para quem vencer.",
  },
]

export const EVENTS: EventDef[] = [
  {
    id: "ciclone-verde",
    name: "Ciclone Verde",
    subtitle: "Treinamento Especial",
    banner: "/images/events/ciclone-verde.png",
    bannerAlt: "Banner do evento Ciclone Verde: arqueiro de gorro verde puxando um arco de cristal",
    accent: "#22c55e",
    accentDark: "#15803d",
    element: "Vento",
    elementGroup: "ventus",
  },
  {
    id: "vastidao-roxa",
    name: "Vastidão Roxa",
    subtitle: "Treinamento Especial",
    banner: "/images/events/vastidao-roxa.png",
    bannerAlt: "Banner do evento Vastidão Roxa: dois duelistas de aura roxa, um deles com uma guitarra",
    accent: "#a855f7",
    accentDark: "#6b21a8",
    element: "Trevas",
    elementGroup: "darkness",
  },
  {
    id: "tsunami-azul",
    name: "Tsunami Azul",
    subtitle: "Treinamento Especial",
    banner: "/images/events/tsunami-azul.png",
    bannerAlt: "Banner do evento Tsunami Azul: princesa de cabelo branco ao lado de um espadachim de cabelo azul",
    accent: "#3b82f6",
    accentDark: "#1d4ed8",
    element: "Água",
    elementGroup: "aquos",
  },
  {
    id: "incendio-vermelho",
    name: "Incêndio Vermelho",
    subtitle: "Treinamento Especial",
    banner: "/images/events/incendio-vermelho.png",
    bannerAlt: "Banner do evento Incêndio Vermelho: dois duelistas de vestes vermelhas em pose de ataque",
    accent: "#ef4444",
    accentDark: "#b91c1c",
    element: "Fogo",
    elementGroup: "fire",
  },
  {
    id: "feixe-amarelo",
    name: "Feixe Amarelo",
    subtitle: "Treinamento Especial",
    banner: "/images/events/feixe-amarelo.png",
    bannerAlt: "Banner do evento Feixe Amarelo: cavaleiro de armadura ao lado de uma garota com espada dourada",
    accent: "#f59e0b",
    accentDark: "#b45309",
    element: "Luz",
    elementGroup: "lightness",
  },
]

// ─── Progresso ───────────────────────────────────────────────────────────────

type Progress = Record<string, EventDifficulty[]>

function loadProgress(): Progress {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LS_PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as Progress) : {}
  } catch { return {} }
}

function saveProgress(p: Progress) {
  try { localStorage.setItem(LS_PROGRESS_KEY, JSON.stringify(p)) } catch { }
}

// ─── Selo de moeda (usado nos painéis) ───────────────────────────────────────

function CoinTag({ src, alt, value, color }: { src: string; alt: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <img src={src || "/placeholder.svg"} alt={alt} width={26} height={26}
        className="h-[26px] w-[26px] shrink-0 object-contain"
        style={{ filter: `drop-shadow(0 0 7px ${color}99)` }} />
      <span className="text-sm font-black tabular-nums" style={{ color, textShadow: `0 0 8px ${color}66` }}>
        +{value}
      </span>
    </div>
  )
}

// ─── Painel de fase (estilo dos nós da Campanha) ─────────────────────────────

function StagePanel({
  stage, index, accent, accentDark, state, delay, visible, onPlay,
}: {
  stage: EventStageDef
  index: number
  accent: string
  accentDark: string
  state: "done" | "open" | "locked"
  delay: number
  visible: boolean
  onPlay: () => void
}) {
  const locked = state === "locked"
  const done = state === "done"

  return (
    <button
      type="button"
      onClick={locked ? undefined : onPlay}
      disabled={locked}
      aria-label={`Fase ${index + 1} — ${stage.label}${locked ? " (bloqueada)" : ""}`}
      className="group relative flex w-full flex-col overflow-hidden text-left transition-transform"
      style={{
        background: "linear-gradient(160deg, rgba(12,8,26,0.94) 0%, rgba(6,4,16,0.97) 100%)",
        border: `1px solid ${locked ? "rgba(148,163,184,0.18)" : `${accent}55`}`,
        borderRadius: 18,
        boxShadow: locked
          ? "0 8px 26px rgba(0,0,0,0.45)"
          : `0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px ${accent}1f, inset 0 1px 0 rgba(255,255,255,0.06)`,
        cursor: locked ? "not-allowed" : "pointer",
        opacity: visible ? (locked ? 0.62 : 1) : 0,
        transform: visible ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 480ms cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 560ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {/* Brilho de topo na cor do evento */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: `linear-gradient(180deg, ${locked ? "rgba(148,163,184,0.10)" : `${accent}22`} 0%, transparent 100%)` }} />

      {/* Cabeçalho: número da fase + dificuldade + status */}
      <div className="relative flex items-center gap-3 px-4 pt-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center"
          style={{
            background: locked
              ? "linear-gradient(145deg,#1e293b,#0f172a)"
              : `linear-gradient(145deg,${accent},${accentDark})`,
            border: `1px solid ${locked ? "rgba(148,163,184,0.30)" : "rgba(255,255,255,0.35)"}`,
            boxShadow: locked ? "none" : `0 0 16px ${accent}80`,
            clipPath: "polygon(24% 0, 100% 0, 100% 76%, 76% 100%, 0 100%, 0 24%)",
          }}>
          {done ? <Check className="h-5 w-5 text-white" strokeWidth={3.5} />
            : locked ? <Lock className="h-4 w-4 text-slate-400" />
              : <span className="text-base font-black text-white">{index + 1}</span>}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[9px] font-black uppercase tracking-[0.28em]"
            style={{ color: locked ? "rgba(148,163,184,0.7)" : `${accent}dd` }}>
            Fase {index + 1}
          </span>
          <span className="text-lg font-black uppercase italic leading-none tracking-wide text-white">
            {stage.label}
          </span>
        </div>
        {done && (
          <span className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]"
            style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: accent }}>
            <Trophy className="h-3 w-3" /> Limpa
          </span>
        )}
      </div>

      {/* Corpo: descrição + oponente + LP */}
      <div className="relative flex flex-1 flex-col gap-3 px-4 pt-3">
        <p className="text-pretty text-xs leading-relaxed text-slate-400">{stage.description}</p>
        <div className="flex flex-col gap-1.5 rounded-xl px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Oponente</span>
            <span className="text-[11px] font-bold text-slate-300">{stage.opponent}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">LP de partida</span>
            <span className="text-[11px] font-black" style={{ color: locked ? "#94a3b8" : accent }}>
              {stage.lp} LP
            </span>
          </div>
        </div>
      </div>

      {/* Recompensas */}
      <div className="relative mt-3 flex items-center justify-between gap-2 px-4 py-3"
        style={{ background: "rgba(0,0,0,0.35)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3.5">
          <CoinTag src="/images/Gacha_Coin.png" alt="Gacha Coin" value={stage.gacha} color="#FCD34D" />
          <div aria-hidden className="h-5 w-px" style={{ background: "rgba(250,204,21,0.22)" }} />
          <CoinTag src="/images/gear-coin.png" alt="Gear Coin" value={stage.gear} color="#FDE047" />
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]"
          style={{ color: locked ? "rgba(148,163,184,0.7)" : accent }}>
          {locked ? "Bloqueada" : done ? "Rejogar" : "Duelar"}
          {!locked && <Swords className="h-3.5 w-3.5" />}
        </span>
      </div>
    </button>
  )
}

// ─── Tela de fases de um evento ──────────────────────────────────────────────

function EventStagesView({
  event, cleared, onBack, onStart,
}: {
  event: EventDef
  cleared: EventDifficulty[]
  onBack: () => void
  onStart: (stage: EventStageDef) => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  const stageState = (i: number): "done" | "open" | "locked" => {
    const s = EVENT_STAGES[i]
    if (cleared.includes(s.difficulty)) return "done"
    if (i === 0) return "open"
    return cleared.includes(EVENT_STAGES[i - 1].difficulty) ? "open" : "locked"
  }

  const doneCount = EVENT_STAGES.filter((s) => cleared.includes(s.difficulty)).length
  const progPct = Math.round((doneCount / EVENT_STAGES.length) * 100)

  return (
    <div className="fixed inset-0 z-[210] overflow-y-auto"
      role="dialog" aria-label={`Fases do evento ${event.name}`}
      style={{
        background: `radial-gradient(ellipse 90% 60% at 50% -10%, ${event.accentDark}55 0%, transparent 60%), linear-gradient(165deg, #060214 0%, #0a0420 45%, #05010f 100%)`,
      }}>
      <GearBackdrop />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-28 pt-6 sm:px-8">
        {/* Banner do evento */}
        <div className="relative overflow-hidden"
          style={{
            borderRadius: 20,
            border: `1px solid ${event.accent}66`,
            boxShadow: `0 14px 44px rgba(0,0,0,0.6), 0 0 0 1px ${event.accent}22`,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(-14px)",
            transition: "opacity 520ms cubic-bezier(0.4,0,0.2,1), transform 620ms cubic-bezier(0.16,1,0.3,1)",
          }}>
          <img src={event.banner || "/placeholder.svg"} alt={event.bannerAlt}
            className="block h-[136px] w-full select-none object-cover object-center sm:h-[164px]"
            draggable={false} />
          <div aria-hidden className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(180deg, transparent 55%, rgba(3,1,12,0.85) 100%)" }} />
        </div>

        {/* Cabeçalho com progresso */}
        <header className="mt-5 flex flex-wrap items-center gap-4"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(14px)",
            transition: "opacity 520ms cubic-bezier(0.4,0,0.2,1) 90ms, transform 620ms cubic-bezier(0.16,1,0.3,1) 90ms",
          }}>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: `${event.accent}cc` }}>
              {event.subtitle} · {event.element}
            </span>
            <h1 className="text-balance text-2xl font-black uppercase italic leading-none tracking-[0.14em] sm:text-3xl"
              style={{
                background: `linear-gradient(180deg,#ffffff 30%,${event.accent} 100%)`,
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                filter: `drop-shadow(0 0 18px ${event.accent}88) drop-shadow(0 2px 0 rgba(0,0,20,0.9))`,
              }}>
              {event.name}
            </h1>
          </div>
          <div className="ml-auto flex min-w-[190px] flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Progresso</span>
              <span className="text-[11px] font-black" style={{ color: event.accent }}>
                {doneCount}/{EVENT_STAGES.length}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${progPct}%`,
                  background: `linear-gradient(90deg,${event.accentDark},${event.accent})`,
                  boxShadow: `0 0 10px ${event.accent}aa`,
                }} />
            </div>
          </div>
        </header>

        {/* Divisor */}
        <div className="mb-4 mt-7 flex items-center gap-3">
          <div aria-hidden className="h-px flex-1"
            style={{ background: `linear-gradient(90deg, transparent, ${event.accent}55)` }} />
          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
            Fases do Treinamento
          </span>
          <div aria-hidden className="h-px flex-1"
            style={{ background: `linear-gradient(90deg, ${event.accent}55, transparent)` }} />
        </div>

        {/* Os 3 painéis de duelo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {EVENT_STAGES.map((stage, i) => (
            <StagePanel
              key={stage.difficulty}
              stage={stage}
              index={i}
              accent={event.accent}
              accentDark={event.accentDark}
              state={stageState(i)}
              delay={140 + i * 90}
              visible={visible}
              onPlay={() => onStart(stage)}
            />
          ))}
        </div>

        {doneCount === EVENT_STAGES.length && (
          <div className="mt-6 flex items-center justify-center gap-2.5 rounded-2xl px-5 py-4"
            style={{
              background: `${event.accent}14`,
              border: `1px solid ${event.accent}44`,
              boxShadow: `0 0 26px ${event.accent}22`,
            }}>
            <Sparkles className="h-4 w-4" style={{ color: event.accent }} />
            <span className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: event.accent }}>
              Treinamento concluído — rejogue as fases para farmar moedas
            </span>
          </div>
        )}
      </div>

      <BackButton onClick={onBack} label="Voltar aos eventos" accent={event.accent} />
    </div>
  )
}

// ─── Card de evento na lista ─────────────────────────────────────────────────

function EventCard({
  event, cleared, delay, visible, onClick,
}: {
  event: EventDef
  cleared: EventDifficulty[]
  delay: number
  visible: boolean
  onClick: () => void
}) {
  const doneCount = EVENT_STAGES.filter((s) => cleared.includes(s.difficulty)).length
  const progPct = Math.round((doneCount / EVENT_STAGES.length) * 100)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Abrir evento ${event.name}`}
      className="group relative w-full overflow-hidden text-left transition-transform hover:-translate-y-0.5"
      style={{
        borderRadius: 20,
        border: `1px solid ${event.accent}55`,
        boxShadow: `0 12px 36px rgba(0,0,0,0.55), 0 0 0 1px ${event.accent}1a`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(22px)",
        transition: `opacity 500ms cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {/* Banner */}
      <img src={event.banner || "/placeholder.svg"} alt={event.bannerAlt}
        className="block h-auto w-full select-none transition-transform duration-500 group-hover:scale-[1.02]"
        draggable={false} />

      {/* Gradiente + informações sobrepostas */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 40%, rgba(3,1,12,0.92) 100%)" }} />

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: `${event.accent}dd` }}>
            {event.element}
          </span>
          <span className="text-base font-black uppercase italic leading-none tracking-wide text-white sm:text-lg">
            {event.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[10px] font-black tabular-nums" style={{ color: event.accent }}>
              {doneCount}/{EVENT_STAGES.length} fases
            </span>
            <div className="h-1 w-20 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
              <div className="h-full rounded-full"
                style={{
                  width: `${progPct}%`,
                  background: `linear-gradient(90deg,${event.accentDark},${event.accent})`,
                  boxShadow: `0 0 8px ${event.accent}aa`,
                }} />
            </div>
          </div>
          <span className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-[10px] font-black uppercase tracking-[0.14em] text-white"
            style={{
              background: `linear-gradient(135deg,${event.accentDark},${event.accent})`,
              boxShadow: `0 5px 18px ${event.accent}66`,
            }}>
            Entrar <Swords className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Botão voltar (mesma linguagem visual do Modo de Jogo) ───────────────────

function BackButton({ onClick, label, accent }: { onClick: () => void; label: string; accent: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-6 left-5 z-[240] flex h-14 w-14 items-center justify-center transition-transform hover:scale-105 active:scale-95"
      style={{
        background: "linear-gradient(135deg, rgba(20,12,40,0.95), rgba(8,4,20,0.95))",
        border: `1px solid ${accent}66`,
        boxShadow: `0 8px 26px rgba(0,0,0,0.6), 0 0 20px ${accent}33`,
        clipPath: "polygon(24% 0, 100% 0, 100% 76%, 76% 100%, 0 100%, 0 24%)",
      }}
    >
      <ArrowLeft className="h-6 w-6" style={{ color: accent }} />
    </button>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

interface EventsScreenProps {
  onBack: () => void
  /** Dispara o duelo da fase; o wrapper salva a pendência e navega pro duelo. */
  onStartBattle: (payload: {
    eventId: string
    eventName: string
    /** Grupo de elemento do deck que o oponente vai usar. */
    elementGroup: EventDef["elementGroup"]
    difficulty: EventDifficulty
    lp: number
    gacha: number
    gear: number
  }) => void
}

export default function EventsScreen({ onBack, onStartBattle }: EventsScreenProps) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [openEventId, setOpenEventId] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  /* Ao voltar do duelo: lê o resultado e marca a fase como concluída */
  useEffect(() => {
    const raw = localStorage.getItem(EVENT_BATTLE_KEY)
    if (!raw) return
    localStorage.removeItem(EVENT_BATTLE_KEY)
    try {
      const { eventId, difficulty, won } = JSON.parse(raw) as {
        eventId: string; difficulty: EventDifficulty; won: boolean
      }
      setOpenEventId(eventId)
      if (!won) return
      setProgress((prev) => {
        const list = prev[eventId] ?? []
        if (list.includes(difficulty)) return prev
        const next = { ...prev, [eventId]: [...list, difficulty] }
        saveProgress(next)
        return next
      })
    } catch { }
  }, [])

  const handleStart = useCallback((eventId: string, stage: EventStageDef) => {
    const ev = EVENTS.find((e) => e.id === eventId)
    if (!ev) return
    onStartBattle({
      eventId,
      eventName: ev.name,
      elementGroup: ev.elementGroup,
      difficulty: stage.difficulty,
      lp: stage.lp,
      gacha: stage.gacha,
      gear: stage.gear,
    })
  }, [onStartBattle])

  const openEvent = openEventId ? EVENTS.find((e) => e.id === openEventId) ?? null : null

  if (openEvent) {
    return (
      <EventStagesView
        event={openEvent}
        cleared={progress[openEvent.id] ?? []}
        onBack={() => setOpenEventId(null)}
        onStart={(stage) => handleStart(openEvent.id, stage)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[210] overflow-y-auto"
      role="dialog" aria-label="Eventos"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(88,28,135,0.35) 0%, transparent 60%), linear-gradient(165deg, #060214 0%, #0a0420 45%, #05010f 100%)",
      }}>
      <GearBackdrop />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-28 pt-8 sm:px-8">
        {/* Cabeçalho */}
        <header className="mb-7 flex items-center gap-4"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(-12px)",
            transition: "opacity 520ms cubic-bezier(0.4,0,0.2,1), transform 620ms cubic-bezier(0.16,1,0.3,1)",
          }}>
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(217,70,239,0.4), rgba(88,28,135,0.18))",
              border: "1px solid rgba(240,171,252,0.45)",
              boxShadow: "0 0 22px rgba(217,70,239,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
              clipPath: "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)",
            }}>
            <Sparkles className="h-5 w-5 text-fuchsia-200" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-balance text-2xl font-black uppercase italic leading-none tracking-[0.22em] sm:text-3xl"
              style={{
                background: "linear-gradient(180deg,#ffffff 30%,#f0abfc 70%,#e879f9 100%)",
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                filter: "drop-shadow(0 0 16px rgba(217,70,239,0.6)) drop-shadow(0 2px 0 rgba(0,0,30,0.9))",
              }}>
              Eventos
            </h1>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-fuchsia-300/55">
              Treinamentos especiais por tempo limitado
            </p>
          </div>
          <div aria-hidden className="ml-2 hidden flex-1 items-center gap-2 sm:flex">
            <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(240,171,252,0.5), rgba(240,171,252,0.08))" }} />
            <div className="h-1.5 w-1.5 rotate-45" style={{ background: "rgba(240,171,252,0.7)", boxShadow: "0 0 8px rgba(217,70,239,0.8)" }} />
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, rgba(240,171,252,0.3), transparent)" }} />
          </div>
        </header>

        {/* Explicação rápida das recompensas */}
        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(240,171,252,0.16)",
            opacity: visible ? 1 : 0,
            transition: "opacity 520ms cubic-bezier(0.4,0,0.2,1) 80ms",
          }}>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300/70">
            Drops por vitória
          </span>
          {EVENT_STAGES.map((s) => (
            <div key={s.difficulty} className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">{s.label}</span>
              <CoinTag src="/images/Gacha_Coin.png" alt="Gacha Coin" value={s.gacha} color="#FCD34D" />
              <CoinTag src="/images/gear-coin.png" alt="Gear Coin" value={s.gear} color="#FDE047" />
            </div>
          ))}
        </div>

        {/* Lista de eventos */}
        <div className="grid grid-cols-1 gap-5">
          {EVENTS.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              cleared={progress[event.id] ?? []}
              delay={120 + i * 80}
              visible={visible}
              onClick={() => setOpenEventId(event.id)}
            />
          ))}
        </div>
      </div>

      <BackButton onClick={onBack} label="Voltar ao modo de jogo" accent="#e879f9" />
    </div>
  )
}
