"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { useGame } from "@/contexts/game-context"
import { loadMastersFromStorage, type Master } from "@/lib/masters-data"

// ─────────────────────────────────────────────────────────────────────────────
// Intro cinematográfica de duelo
//
// Fase 1 — "CHAMADO DO MESTRE": letterbox, brasas subindo, anel de energia
//          girando no Mestre, fala com typewriter sincronizado ao áudio e
//          zoom de saída puxando pro impacto.
// Fase 2 — "CHOQUE": painéis diagonais com speed lines, faísca correndo na
//          linha de corte, relâmpagos, aberração cromática, placas de nome
//          com barra de energia e VS com duplo impacto (ghost + slam).
//
// A música do MENU continua tocando durante toda a intro. Quem a pausa é
// startDuelOst() no duel-screen, no momento em que o duelo de fato começa.
// ─────────────────────────────────────────────────────────────────────────────

const MASTER_INTRO_LINES: Record<string, string> = {
  fehnon:  "Eu tô louco pra entrar nessa festa!",
  calem:   "Com meu poder, eu não tenho o que temer!",
  morgana: "Vamos sentir a melodia de batalha!",
}

export interface DuelIntroOpponent {
  name: string
  icon?: string | null
  subtitle?: string | null
  isBoss?: boolean
}

interface DuelIntroOverlayProps {
  opponent: DuelIntroOpponent
  onComplete: () => void
  sfxVolume?: number
}

// ── Timeline (ms) ────────────────────────────────────────────────────────────
const T_MASTER_END = 2600
const T_IMPACT     = 300
const T_CLASH_END  = 2500
const T_FADE       = 350

// Brasas da fase 1 (posições determinísticas pra não piscar em re-render)
const EMBERS = [
  { l: 8,  d: 0.0, s: 1.0, t: 5.2 },
  { l: 18, d: 1.1, s: 0.6, t: 4.4 },
  { l: 29, d: 0.4, s: 0.8, t: 6.0 },
  { l: 41, d: 1.8, s: 0.5, t: 4.8 },
  { l: 55, d: 0.7, s: 1.1, t: 5.6 },
  { l: 66, d: 1.4, s: 0.7, t: 4.2 },
  { l: 77, d: 0.2, s: 0.9, t: 5.9 },
  { l: 88, d: 1.0, s: 0.6, t: 4.6 },
  { l: 95, d: 1.6, s: 0.8, t: 5.1 },
]

// Faíscas do impacto na fase 2 (ângulo em graus, distância em px, delay em ms)
const SPARKS = [
  { a: 12,   d: 130, dl: 0  },
  { a: 55,   d: 170, dl: 20 },
  { a: 98,   d: 120, dl: 40 },
  { a: 140,  d: 160, dl: 10 },
  { a: 185,  d: 140, dl: 30 },
  { a: 228,  d: 175, dl: 0  },
  { a: 272,  d: 125, dl: 50 },
  { a: 315,  d: 155, dl: 25 },
]

export default function DuelIntroOverlay({ opponent, onComplete, sfxVolume = 80 }: DuelIntroOverlayProps) {
  const { playerProfile } = useGame()
  const [phase, setPhase] = useState<"master" | "clash" | "out">("master")
  const [typed, setTyped] = useState("")

  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const doneRef   = useRef(false)

  const master: Master | null = useMemo(() => {
    try {
      const list = loadMastersFromStorage()
      return list.find(m => m.isActive) ?? list.find(m => m.isUnlocked) ?? list[0] ?? null
    } catch {
      return null
    }
  }, [])

  const masterId   = master?.id ?? "fehnon"
  const line       = MASTER_INTRO_LINES[masterId] ?? "Vamos duelar!"
  const accent     = master?.accentColor ?? "#38bdf8"
  const playerIcon = playerProfile?.avatarUrl || "/images/icons/fehnon-icon.png"
  const playerName = playerProfile?.name || "Duelista"

  // ── Encerra (natural ou por skip) ──────────────────────────────────────────
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    const a = audioRef.current
    if (a) {
      try { a.pause(); a.currentTime = 0 } catch { /* ignore */ }
      audioRef.current = null
    }
    onComplete()
  }

  const skip = () => {
    if (doneRef.current) return
    setPhase("out")
    timersRef.current.push(setTimeout(finish, 180))
  }

  // ── Áudio da fala + typewriter sincronizado ────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const voice = new Audio(`/audio/masters/${masterId}_voice_2_introduel.mp3`)
    voice.volume = Math.max(0, Math.min(1, sfxVolume / 100))
    audioRef.current = voice
    timersRef.current.push(setTimeout(() => {
      voice.play().catch(() => { /* autoplay bloqueado */ })
    }, 220))

    let i = 0
    const typer = setInterval(() => {
      if (cancelled) return
      i++
      setTyped(line.slice(0, i))
      if (i >= line.length) clearInterval(typer)
    }, 26)

    timersRef.current.push(setTimeout(() => { if (!cancelled) setPhase("clash") }, T_MASTER_END))
    timersRef.current.push(setTimeout(() => { if (!cancelled) setPhase("out") }, T_MASTER_END + T_CLASH_END))
    timersRef.current.push(setTimeout(() => { if (!cancelled) finish() }, T_MASTER_END + T_CLASH_END + T_FADE))

    return () => {
      cancelled = true
      clearInterval(typer)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      try { voice.pause() } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterId, line])

  useEffect(() => {
    const onKey = () => skip()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const oppAccent = opponent.isBoss ? "#f59e0b" : "#e11d48"

  return (
    <div
      role="presentation"
      onClick={skip}
      onTouchStart={skip}
      className={`fixed inset-0 z-[880] overflow-hidden cursor-pointer${phase === "out" ? " di-out" : ""}`}
      style={{ background: "#04030d" }}
    >
      {/* Letterbox cinematográfico */}
      <div className="di-letterbox di-letterbox-top"    aria-hidden="true" />
      <div className="di-letterbox di-letterbox-bottom" aria-hidden="true" />

      {/* Vinheta constante pra dar profundidade de cinema */}
      <div className="di-vignette" aria-hidden="true" />

      {/* ── FASE 1: chamado do Mestre ─────────────────────────────────────── */}
      {phase === "master" && (
        <div className="di-stage-master absolute inset-0 flex items-center justify-center px-6">
          {/* Flash de entrada */}
          <div className="di-enter-flash" aria-hidden="true" style={{ background: accent }} />

          {/* Glow suave atrás do Mestre */}
          <div
            className="di-master-glow"
            aria-hidden="true"
            style={{ background: `radial-gradient(circle, ${accent}40, transparent 62%)` }}
          />

          {/* Brasas de energia subindo */}
          {EMBERS.map((e, idx) => (
            <span
              key={idx}
              className="di-ember"
              aria-hidden="true"
              style={{
                left: `${e.l}%`,
                width: `${4 * e.s}px`,
                height: `${4 * e.s}px`,
                background: accent,
                boxShadow: `0 0 ${8 * e.s}px ${accent}`,
                animationDelay: `${e.d}s`,
                animationDuration: `${e.t}s`,
              }}
            />
          ))}

          {/* Texto de contexto acima, com linhas laterais abrindo */}
          <div className="di-callout" aria-hidden="true">
            <span className="di-callout-line" style={{ background: `linear-gradient(to left, ${accent}, transparent)` }} />
            <span style={{ color: accent }}>DUELO IMINENTE</span>
            <span className="di-callout-line" style={{ background: `linear-gradient(to right, ${accent}, transparent)` }} />
          </div>

          <div className="relative flex items-center gap-5 sm:gap-8 max-w-3xl w-full">
            {/* Ícone do Mestre com anel de energia girando */}
            <div className="di-master-in relative shrink-0">
              <div
                className="di-orbit"
                aria-hidden="true"
                style={{ borderColor: `${accent}55`, borderTopColor: accent }}
              />
              <div
                className="di-orbit di-orbit-2"
                aria-hidden="true"
                style={{ borderColor: `${accent}30`, borderBottomColor: `${accent}cc` }}
              />
              <img
                src={master?.iconPath || "/images/masters/fehnon-icon.png"}
                alt={`Mestre ${master?.name ?? ""}`}
                className="di-master-breathe relative w-28 h-28 sm:w-40 sm:h-40 rounded-full object-cover"
                style={{ border: `3px solid ${accent}`, boxShadow: `0 0 28px ${accent}66` }}
                draggable={false}
              />
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-black tracking-widest uppercase whitespace-nowrap z-10"
                style={{ background: accent, color: "#04030d" }}
              >
                {master?.name ?? "Mestre"}
              </div>
            </div>

            {/* Balão de fala */}
            <div className="di-bubble-in relative flex-1 min-w-0">
              <div
                className="relative rounded-2xl px-5 py-4 sm:px-6 sm:py-5"
                style={{
                  background: "rgba(255,255,255,0.96)",
                  boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 3px ${accent}`,
                }}
              >
                <p className="text-slate-900 font-extrabold text-base sm:text-2xl leading-relaxed text-balance">
                  {typed}
                  <span className="di-caret">|</span>
                </p>
                <span
                  className="absolute left-[-11px] top-1/2 -translate-y-1/2 w-0 h-0"
                  aria-hidden="true"
                  style={{
                    borderTop: "10px solid transparent",
                    borderBottom: "10px solid transparent",
                    borderRight: "12px solid rgba(255,255,255,0.96)",
                  }}
                />
              </div>
              <p className="mt-2 text-[10px] sm:text-xs font-mono tracking-[0.3em] uppercase" style={{ color: `${accent}cc` }}>
                {master?.fullName ?? "Mestre"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── FASE 2: choque jogador × oponente ─────────────────────────────── */}
      {(phase === "clash" || phase === "out") && (
        <div className={`absolute inset-0 di-shake`}>
          {/* Painel do oponente (topo) */}
          <div className="di-panel di-panel-opp">
            <img
              src={opponent.icon || "/images/gp-cg-logo.png"}
              alt=""
              aria-hidden="true"
              className="di-panel-img absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.75, objectPosition: "center 22%" }}
              draggable={false}
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(200deg, ${oppAccent}44, rgba(4,3,13,0.5) 45%, rgba(4,3,13,0.88) 100%)` }}
            />
            {/* Speed lines varrendo o painel */}
            <div className="di-speedlines di-speedlines-opp" aria-hidden="true" />
          </div>

          {/* Painel do jogador (base) */}
          <div className="di-panel di-panel-me">
            <img
              src={playerIcon}
              alt=""
              aria-hidden="true"
              className="di-panel-img absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.75, objectPosition: "center 30%" }}
              draggable={false}
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(20deg, ${accent}44, rgba(4,3,13,0.5) 45%, rgba(4,3,13,0.88) 100%)` }}
            />
            <div className="di-speedlines di-speedlines-me" aria-hidden="true" />
          </div>

          {/* Barras brancas do corte diagonal */}
          <div className="di-bar di-bar-top"    aria-hidden="true" />
          <div className="di-bar di-bar-bottom" aria-hidden="true" />

          {/* Faísca correndo na linha de corte */}
          <div className="di-cut-spark" aria-hidden="true" />

          {/* Relâmpagos do impacto */}
          <div className="di-bolt di-bolt-1" aria-hidden="true" />
          <div className="di-bolt di-bolt-2" aria-hidden="true" />
          <div className="di-bolt di-bolt-3" aria-hidden="true" />

          {/* Nome + ícone do oponente */}
          <div className="di-name di-name-opp">
            <div
              className="di-name-bar di-name-bar-opp"
              aria-hidden="true"
              style={{ background: `linear-gradient(to left, ${oppAccent}, transparent)` }}
            />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="text-right">
                {opponent.subtitle && (
                  <p className="text-[10px] sm:text-xs font-black tracking-[0.25em] uppercase" style={{ color: oppAccent }}>
                    {opponent.subtitle}
                  </p>
                )}
                <h2 className="di-title text-2xl sm:text-5xl">{opponent.name}</h2>
              </div>
              <img
                src={opponent.icon || "/images/gp-cg-logo.png"}
                alt={opponent.name}
                className="w-14 h-14 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                style={{ border: `3px solid ${oppAccent}`, boxShadow: `0 0 22px ${oppAccent}88` }}
                draggable={false}
              />
            </div>
          </div>

          {/* Nome + ícone do jogador */}
          <div className="di-name di-name-me">
            <div
              className="di-name-bar di-name-bar-me"
              aria-hidden="true"
              style={{ background: `linear-gradient(to right, ${accent}, transparent)` }}
            />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <img
                src={playerIcon}
                alt={playerName}
                className="w-14 h-14 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                style={{ border: `3px solid ${accent}`, boxShadow: `0 0 22px ${accent}88` }}
                draggable={false}
              />
              <div>
                <p className="text-[10px] sm:text-xs font-black tracking-[0.25em] uppercase" style={{ color: accent }}>
                  Mestre {master?.name ?? ""}
                </p>
                <h2 className="di-title text-2xl sm:text-5xl">{playerName}</h2>
              </div>
            </div>
          </div>

          {/* VS central com duplo impacto */}
          <div className="di-vs-wrap">
            <div className="di-ring"   aria-hidden="true" />
            <div className="di-ring di-ring-2" aria-hidden="true" style={{ borderColor: `${oppAccent}b3` }} />
            {/* Faíscas voando do centro */}
            {SPARKS.map((s, idx) => (
              <span
                key={idx}
                className="di-spark"
                aria-hidden="true"
                style={{
                  background: idx % 2 === 0 ? "#ffffff" : oppAccent,
                  transform: `rotate(${s.a}deg)`,
                  ["--spark-d" as string]: `${s.d}px`,
                  animationDelay: `${T_IMPACT + s.dl}ms`,
                }}
              />
            ))}
            {/* Ghost do VS estourando pra fora */}
            <div className="di-vs-ghost" aria-hidden="true" style={{ WebkitTextStroke: `2px ${oppAccent}` }}>
              {opponent.isBoss ? "BOSS" : "VS"}
            </div>
            <div className="di-vs" style={{ WebkitTextStroke: `3px ${oppAccent}` }}>
              {opponent.isBoss ? "BOSS" : "VS"}
            </div>
          </div>

          {/* Flash de impacto + aberração cromática */}
          <div className="di-flash" aria-hidden="true" />
          <div className="di-chroma di-chroma-r" aria-hidden="true" />
          <div className="di-chroma di-chroma-b" aria-hidden="true" />

          <p className="di-skip-hint absolute bottom-4 left-0 right-0 text-center text-[10px] sm:text-xs font-mono tracking-[0.3em] text-white/35 uppercase z-50">
            Toque para pular
          </p>
        </div>
      )}

      <style>{`
        .di-out { animation: diOut ${T_FADE}ms ease-in forwards; }
        @keyframes diOut { from { opacity: 1 } to { opacity: 0 } }

        /* Letterbox cinematográfico */
        .di-letterbox {
          position: absolute; left: 0; right: 0; height: 7vh; background: #000; z-index: 45;
          will-change: transform;
        }
        .di-letterbox-top    { top: 0;    animation: diLbTop 500ms cubic-bezier(0.16,1,0.3,1) both; }
        .di-letterbox-bottom { bottom: 0; animation: diLbBottom 500ms cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes diLbTop    { from { transform: translate3d(0,-100%,0) } to { transform: translate3d(0,0,0) } }
        @keyframes diLbBottom { from { transform: translate3d(0,100%,0) }  to { transform: translate3d(0,0,0) } }

        .di-vignette {
          position: absolute; inset: 0; z-index: 42; pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.55) 100%);
        }

        /* ── Fase 1 ── */
        /* Zoom de saída: no fim da fase o palco inteiro é puxado pra frente */
        .di-stage-master {
          animation: diStageOut 380ms cubic-bezier(0.55,0,1,0.45) ${T_MASTER_END - 380}ms both;
          will-change: transform, opacity;
        }
        @keyframes diStageOut {
          0%   { transform: scale(1); opacity: 1 }
          100% { transform: scale(1.35); opacity: 0 }
        }

        .di-enter-flash {
          position: absolute; inset: 0; pointer-events: none; z-index: 5;
          animation: diEnterFlash 480ms ease-out both; will-change: opacity;
        }
        @keyframes diEnterFlash { 0% { opacity: 0.5 } 100% { opacity: 0 } }

        .di-master-glow {
          position: absolute; width: 80vmin; height: 80vmin; border-radius: 9999px;
          animation: diGlow 2.6s ease-out forwards; will-change: opacity, transform;
        }
        @keyframes diGlow {
          0%   { opacity: 0; transform: scale(0.6) }
          30%  { opacity: 1; transform: scale(1) }
          100% { opacity: 0.5; transform: scale(1.08) }
        }

        .di-ember {
          position: absolute; bottom: -3%; border-radius: 9999px; opacity: 0;
          animation-name: diEmber; animation-timing-function: ease-out;
          animation-iteration-count: infinite; will-change: transform, opacity;
        }
        @keyframes diEmber {
          0%   { opacity: 0; transform: translate3d(0,0,0) }
          12%  { opacity: 0.9 }
          70%  { opacity: 0.5 }
          100% { opacity: 0; transform: translate3d(14px,-78vh,0) }
        }

        .di-callout {
          position: absolute; top: 12vh; left: 0; right: 0; z-index: 20;
          display: flex; align-items: center; justify-content: center; gap: 14px;
          font-size: clamp(11px, 2vw, 14px); font-weight: 900;
          letter-spacing: 0.45em; text-transform: uppercase;
          animation: diCallout 550ms cubic-bezier(0.16,1,0.3,1) 100ms both;
          will-change: transform, opacity;
        }
        .di-callout-line {
          height: 1px; width: clamp(30px, 10vw, 90px);
          animation: diCalloutLine 700ms cubic-bezier(0.16,1,0.3,1) 250ms both;
          transform-origin: center; will-change: transform;
        }
        @keyframes diCalloutLine { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @keyframes diCallout {
          0%   { opacity: 0; transform: translate3d(0,-12px,0) }
          100% { opacity: 1; transform: translate3d(0,0,0) }
        }

        .di-master-in {
          animation: diMasterIn 580ms cubic-bezier(0.16,1,0.3,1) both;
          will-change: transform, opacity;
        }
        @keyframes diMasterIn {
          0%   { opacity: 0; transform: translate3d(-50px,0,0) scale(0.75) }
          65%  { opacity: 1; transform: translate3d(4px,0,0) scale(1.04) }
          100% { opacity: 1; transform: translate3d(0,0,0) scale(1) }
        }
        .di-master-breathe {
          animation: diBreathe 2.2s ease-in-out 600ms infinite;
          will-change: transform;
        }
        @keyframes diBreathe {
          0%, 100% { transform: scale(1) }
          50%      { transform: scale(1.03) }
        }

        .di-orbit {
          position: absolute; inset: -10px; border-radius: 9999px;
          border: 2px solid transparent;
          animation: diOrbit 2.4s linear infinite; will-change: transform;
        }
        .di-orbit-2 {
          inset: -18px; border-width: 1px;
          animation: diOrbitRev 3.6s linear infinite;
        }
        @keyframes diOrbit    { from { transform: rotate(0deg) }   to { transform: rotate(360deg) } }
        @keyframes diOrbitRev { from { transform: rotate(360deg) } to { transform: rotate(0deg) } }

        .di-bubble-in {
          animation: diBubbleIn 380ms cubic-bezier(0.34,1.56,0.64,1) 140ms both;
          will-change: transform, opacity;
        }
        @keyframes diBubbleIn {
          0%   { opacity: 0; transform: translate3d(0,10px,0) scale(0.88) }
          100% { opacity: 1; transform: translate3d(0,0,0) scale(1) }
        }
        .di-caret { animation: diCaret 0.55s steps(1) infinite; margin-left: 2px; color: #64748b; }
        @keyframes diCaret { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }

        /* ── Fase 2 ── */
        .di-shake {
          animation: diShake 620ms cubic-bezier(0.36,0.07,0.19,0.97) ${T_IMPACT}ms both;
          will-change: transform;
        }
        @keyframes diShake {
          0%   { transform: translate3d(0,0,0) }
          10%  { transform: translate3d(-18px,10px,0) rotate(-0.5deg) }
          24%  { transform: translate3d(14px,-11px,0) rotate(0.4deg) }
          38%  { transform: translate3d(-10px,7px,0) rotate(-0.3deg) }
          54%  { transform: translate3d(7px,-4px,0) }
          70%  { transform: translate3d(-4px,3px,0) }
          86%  { transform: translate3d(2px,-1px,0) }
          100% { transform: translate3d(0,0,0) }
        }

        .di-panel {
          position: absolute; inset: 0; overflow: hidden;
          will-change: transform, opacity; backface-visibility: hidden;
        }
        .di-panel-opp {
          clip-path: polygon(0 0, 100% 0, 100% 40%, 0 58%);
          animation: diPanelOpp 480ms cubic-bezier(0.16,1,0.3,1) both;
        }
        .di-panel-me {
          clip-path: polygon(0 63%, 100% 45%, 100% 100%, 0 100%);
          animation: diPanelMe 480ms cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes diPanelOpp {
          0%   { opacity: 0; transform: translate3d(30%,-12%,0) }
          70%  { opacity: 1; transform: translate3d(-1%,0.5%,0) }
          100% { opacity: 1; transform: translate3d(0,0,0) }
        }
        @keyframes diPanelMe {
          0%   { opacity: 0; transform: translate3d(-30%,12%,0) }
          70%  { opacity: 1; transform: translate3d(1%,-0.5%,0) }
          100% { opacity: 1; transform: translate3d(0,0,0) }
        }
        /* Zoom lento nas artes dos painéis (efeito "câmera viva") */
        .di-panel-img {
          animation: diPanelZoom 3s ease-out both;
          will-change: transform;
        }
        @keyframes diPanelZoom { from { transform: scale(1.12) } to { transform: scale(1) } }

        .di-speedlines {
          position: absolute; inset: -20%; opacity: 0.16; pointer-events: none;
          background: repeating-linear-gradient(
            -9.5deg,
            transparent 0px, transparent 26px,
            rgba(255,255,255,0.85) 26px, rgba(255,255,255,0.85) 28px
          );
          will-change: transform;
        }
        .di-speedlines-opp { animation: diLinesOpp 1.4s linear infinite; }
        .di-speedlines-me  { animation: diLinesMe 1.4s linear infinite; }
        @keyframes diLinesOpp { from { transform: translate3d(0,0,0) }    to { transform: translate3d(-56px,9px,0) } }
        @keyframes diLinesMe  { from { transform: translate3d(0,0,0) }    to { transform: translate3d(56px,-9px,0) } }

        .di-bar {
          position: absolute; left: -10%; width: 120%; height: 5px; z-index: 10;
          background: rgba(255,255,255,0.9);
          box-shadow: 0 0 18px rgba(255,255,255,0.5);
          will-change: transform, opacity;
        }
        .di-bar-top    { top: 45%; transform-origin: left center;  animation: diBar 420ms cubic-bezier(0.16,1,0.3,1) 100ms both; }
        .di-bar-bottom { top: 58%; transform-origin: right center; animation: diBar 420ms cubic-bezier(0.16,1,0.3,1) 180ms both; }
        @keyframes diBar {
          0%   { opacity: 0; transform: rotate(-9.5deg) scaleX(0) }
          100% { opacity: 1; transform: rotate(-9.5deg) scaleX(1) }
        }

        /* Faísca que percorre a linha de corte */
        .di-cut-spark {
          position: absolute; top: 51.5%; left: -6%; z-index: 12;
          width: 90px; height: 4px; border-radius: 9999px;
          background: linear-gradient(to right, transparent, #fff);
          box-shadow: 0 0 22px rgba(255,255,255,0.95), 0 0 44px rgba(255,255,255,0.5);
          transform: rotate(-9.5deg);
          animation: diCutSpark 900ms cubic-bezier(0.5,0,0.3,1) ${T_IMPACT + 150}ms both;
          will-change: transform, opacity;
        }
        @keyframes diCutSpark {
          0%   { opacity: 0; transform: rotate(-9.5deg) translate3d(0,0,0) }
          8%   { opacity: 1 }
          88%  { opacity: 1 }
          100% { opacity: 0; transform: rotate(-9.5deg) translate3d(115vw,0,0) }
        }

        .di-bolt {
          position: absolute; top: -8%; height: 116%; width: 3px; z-index: 32; opacity: 0;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.92) 30%, rgba(255,255,255,0.92) 70%, transparent);
          box-shadow: 0 0 16px rgba(255,255,255,0.75);
          will-change: opacity;
        }
        .di-bolt-1 { left: 31%; transform: rotate(15deg) skewX(-7deg);  animation: diBolt 400ms ease-out ${T_IMPACT - 30}ms both; }
        .di-bolt-2 { left: 65%; transform: rotate(-13deg) skewX(5deg);  animation: diBolt 460ms ease-out ${T_IMPACT + 80}ms both; }
        .di-bolt-3 { left: 48%; width: 2px; transform: rotate(6deg) skewX(-4deg); animation: diBolt 380ms ease-out ${T_IMPACT + 160}ms both; }
        @keyframes diBolt {
          0%   { opacity: 0 }
          10%  { opacity: 1 }
          28%  { opacity: 0.15 }
          42%  { opacity: 0.9 }
          100% { opacity: 0 }
        }

        .di-name {
          position: absolute; z-index: 20; padding: 8px 14px;
          will-change: transform, opacity;
        }
        .di-name-opp {
          top: 9%; right: 5%;
          animation: diNameOpp 460ms cubic-bezier(0.16,1,0.3,1) 140ms both;
        }
        .di-name-me {
          bottom: 13%; left: 5%;
          animation: diNameMe 460ms cubic-bezier(0.16,1,0.3,1) 220ms both;
        }
        @keyframes diNameOpp {
          0%   { opacity: 0; transform: translate3d(60px,-20px,0) }
          100% { opacity: 1; transform: translate3d(0,0,0) }
        }
        @keyframes diNameMe {
          0%   { opacity: 0; transform: translate3d(-60px,20px,0) }
          100% { opacity: 1; transform: translate3d(0,0,0) }
        }
        /* Barra de energia atrás das placas de nome */
        .di-name-bar {
          position: absolute; top: 50%; height: 3px; width: 46vw; max-width: 420px;
          transform: translateY(-50%); opacity: 0.85; border-radius: 9999px;
          will-change: transform;
        }
        .di-name-bar-opp {
          right: -14px; transform-origin: right center;
          animation: diNameBar 520ms cubic-bezier(0.16,1,0.3,1) 320ms both;
        }
        .di-name-bar-me {
          left: -14px; transform-origin: left center;
          animation: diNameBar 520ms cubic-bezier(0.16,1,0.3,1) 400ms both;
        }
        @keyframes diNameBar {
          from { transform: translateY(-50%) scaleX(0) }
          to   { transform: translateY(-50%) scaleX(1) }
        }
        .di-title {
          font-weight: 900; color: #ffffff; line-height: 1;
          letter-spacing: -0.02em; text-transform: uppercase;
          transform: skewX(-6deg);
          text-shadow: 0 3px 0 rgba(0,0,0,0.6);
        }

        .di-vs-wrap {
          position: absolute; top: 50%; left: 50%; z-index: 30;
          transform: translate3d(-50%,-50%,0);
          display: flex; align-items: center; justify-content: center;
        }
        .di-vs {
          font-size: clamp(56px, 14vw, 150px); font-weight: 900; color: #ffffff;
          letter-spacing: -0.04em; line-height: 1;
          text-shadow: 0 4px 0 rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.4);
          animation: diVs 560ms cubic-bezier(0.22,1.4,0.36,1) ${T_IMPACT - 100}ms both,
                     diVsPulse 1.6s ease-in-out ${T_IMPACT + 700}ms infinite;
          will-change: transform, opacity;
        }
        @keyframes diVs {
          0%   { opacity: 0; transform: scale(3.8) rotate(-20deg) }
          55%  { opacity: 1; transform: scale(0.94) rotate(2deg) }
          78%  { transform: scale(1.06) rotate(-1deg) }
          100% { opacity: 1; transform: scale(1) rotate(0deg) }
        }
        @keyframes diVsPulse {
          0%, 100% { text-shadow: 0 4px 0 rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.4) }
          50%      { text-shadow: 0 4px 0 rgba(0,0,0,0.5), 0 0 70px rgba(255,255,255,0.75) }
        }
        /* Cópia fantasma do VS que estoura pra fora no impacto */
        .di-vs-ghost {
          position: absolute; color: transparent;
          font-size: clamp(56px, 14vw, 150px); font-weight: 900;
          letter-spacing: -0.04em; line-height: 1;
          animation: diVsGhost 700ms ease-out ${T_IMPACT + 60}ms both;
          will-change: transform, opacity;
        }
        @keyframes diVsGhost {
          0%   { opacity: 0.9; transform: scale(1) }
          100% { opacity: 0;   transform: scale(2.4) }
        }

        .di-spark {
          position: absolute; width: 34px; height: 3px; border-radius: 9999px;
          opacity: 0; transform-origin: left center;
          animation: diSpark 480ms cubic-bezier(0.2,0.7,0.3,1) both;
          will-change: transform, opacity;
        }
        @keyframes diSpark {
          0%   { opacity: 1; translate: 0 0; scale: 1 1 }
          100% { opacity: 0; translate: var(--spark-d) 0; scale: 0.2 1 }
        }

        .di-ring {
          position: absolute; width: 110px; height: 110px; border-radius: 9999px;
          border: 3px solid rgba(255,255,255,0.8);
          animation: diRing 650ms ease-out ${T_IMPACT}ms both;
          will-change: transform, opacity;
        }
        .di-ring-2 {
          animation-delay: ${T_IMPACT + 120}ms;
          border-width: 2px;
        }
        @keyframes diRing {
          0%   { opacity: 0.9; transform: scale(0.2) }
          100% { opacity: 0;   transform: scale(6) }
        }

        .di-flash {
          position: absolute; inset: 0; background: #ffffff;
          pointer-events: none; z-index: 40;
          animation: diFlash 280ms ease-out ${T_IMPACT}ms both;
          will-change: opacity;
        }
        @keyframes diFlash {
          0%   { opacity: 0 }
          15%  { opacity: 0.8 }
          100% { opacity: 0 }
        }

        /* Aberração cromática rápida no impacto */
        .di-chroma {
          position: absolute; inset: 0; pointer-events: none; z-index: 39;
          mix-blend-mode: screen; opacity: 0;
          will-change: transform, opacity;
        }
        .di-chroma-r {
          background: rgba(255,0,60,0.35);
          animation: diChromaR 260ms ease-out ${T_IMPACT}ms both;
        }
        .di-chroma-b {
          background: rgba(0,120,255,0.35);
          animation: diChromaB 260ms ease-out ${T_IMPACT}ms both;
        }
        @keyframes diChromaR {
          0%   { opacity: 0.8; transform: translate3d(-8px,0,0) }
          100% { opacity: 0;   transform: translate3d(0,0,0) }
        }
        @keyframes diChromaB {
          0%   { opacity: 0.8; transform: translate3d(8px,0,0) }
          100% { opacity: 0;   transform: translate3d(0,0,0) }
        }

        .di-skip-hint { animation: diHint 1.8s ease-in-out 600ms infinite; }
        @keyframes diHint {
          0%, 100% { opacity: 0.35 }
          50%      { opacity: 0.7 }
        }

        @media (prefers-reduced-motion: reduce) {
          .di-shake, .di-master-glow, .di-master-in, .di-bubble-in,
          .di-panel-opp, .di-panel-me, .di-bolt-1, .di-bolt-2, .di-bolt-3,
          .di-ember, .di-orbit, .di-orbit-2, .di-master-breathe,
          .di-speedlines-opp, .di-speedlines-me, .di-cut-spark,
          .di-spark, .di-vs-ghost, .di-chroma-r, .di-chroma-b,
          .di-panel-img, .di-stage-master {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
