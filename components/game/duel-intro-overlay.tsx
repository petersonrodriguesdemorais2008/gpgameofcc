"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { useGame } from "@/contexts/game-context"
import { loadMastersFromStorage, type Master } from "@/lib/masters-data"

// ─────────────────────────────────────────────────────────────────────────────
// Intro cinematográfica de duelo — versão ÉPICA
//
// Fase 1 — "CHAMADO DO MESTRE": letterbox cinematográfico, aura girante,
//          partículas de energia subindo, ícone do Mestre entra com flash e
//          o balão de fala escreve em sincronia com o áudio
//          <id>_voice_2_introduel.mp3.
// Fase 2 — "CHOQUE": speed-lines radiais, relâmpagos, painéis com zoom lento,
//          flash duplo (branco + cor de impacto), faíscas voando do centro,
//          shockwaves triplas e VS com pulso de energia contínuo.
//
// A música do MENU continua tocando por trás durante toda a intro — quem a
// pausa é o startDuelOst() do duel-screen, exatamente quando o duelo começa.
//
// Performance: 100% CSS (só transform/opacity). O único timer contínuo é o
// "typewriter" do balão (~26ms), que só atualiza um <span> de texto.
// ─────────────────────────────────────────────────────────────────────────────

/** Frases faladas em <master>_voice_2_introduel.mp3 (sincronizadas com o áudio) */
const MASTER_INTRO_LINES: Record<string, string> = {
  fehnon:  "Eu tô louco pra entrar nessa festa!",
  calem:   "Com meu poder, eu não tenho o que temer!",
  morgana: "Vamos sentir a melodia de batalha!",
}

export interface DuelIntroOpponent {
  /** Nome exibido: "Oponente", "Treino de Fogo", "Mefisto", nick do player... */
  name: string
  /** Imagem/ícone do oponente (opcional — cai num emblema genérico) */
  icon?: string | null
  /** Linha pequena acima do nome: "Boss Battle", "Dificuldade: Médio"... */
  subtitle?: string | null
  /** Boss (modo história/evento) → moldura dourada e "BOSS" no lugar de VS */
  isBoss?: boolean
}

interface DuelIntroOverlayProps {
  opponent: DuelIntroOpponent
  onComplete: () => void
  /** 0-100 — mesmo slider de SFX do duelo */
  sfxVolume?: number
}

// ── Timeline (ms) ────────────────────────────────────────────────────────────
const T_MASTER_END = 2600   // fim da fala do Mestre → começa o choque
const T_IMPACT     = 380    // atraso do impacto dentro da fase de choque
const T_CLASH_END  = 2250   // duração da fase de choque
const T_FADE       = 380    // fade final

export default function DuelIntroOverlay({ opponent, onComplete, sfxVolume = 80 }: DuelIntroOverlayProps) {
  const { playerProfile } = useGame()
  const [phase, setPhase] = useState<"master" | "clash" | "out">("master")
  const [typed, setTyped] = useState("")

  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const doneRef   = useRef(false)

  // Mestre ativo do jogador
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

  // Partículas de energia (fase 1) — geradas uma única vez, animadas por CSS
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: `${(i * 61) % 100}%`,
        size: 3 + ((i * 7) % 6),
        delay: `${(i * 173) % 1600}ms`,
        dur: `${2200 + ((i * 311) % 1400)}ms`,
      })),
    [],
  )

  // Faíscas do impacto (fase 2) — voam do centro em todas as direções
  const sparks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const ang = (i / 18) * Math.PI * 2 + 0.35
        const dist = 34 + ((i * 137) % 26) // vmin
        return {
          dx: `${Math.cos(ang) * dist}vmin`,
          dy: `${Math.sin(ang) * dist}vmin`,
          size: 4 + ((i * 5) % 7),
          delay: `${(i * 29) % 160}ms`,
          hot: i % 3 === 0,
        }
      }),
    [],
  )

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
    const t = setTimeout(finish, 180)
    timersRef.current.push(t)
  }

  // ── Áudio da fala + typewriter sincronizado ────────────────────────────────
  useEffect(() => {
    let cancelled = false

    // Voz do Mestre
    const voice = new Audio(`/audio/masters/${masterId}_voice_2_introduel.mp3`)
    voice.volume = Math.max(0, Math.min(1, sfxVolume / 100))
    audioRef.current = voice
    const playTimer = setTimeout(() => {
      voice.play().catch(() => { /* autoplay bloqueado — segue sem voz */ })
    }, 220)
    timersRef.current.push(playTimer)

    // Balão de fala escrevendo junto com a voz
    let i = 0
    const typer = setInterval(() => {
      if (cancelled) return
      i++
      setTyped(line.slice(0, i))
      if (i >= line.length) clearInterval(typer)
    }, 26)

    // Transições de fase
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

  // Pular com qualquer tecla
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
      className={`fixed inset-0 z-[880] overflow-hidden cursor-pointer ${phase === "out" ? "di-out" : ""}`}
      style={{ background: "#04030d" }}
    >
      {/* Listras diagonais em movimento (fundo) */}
      <div className="di-stripes" aria-hidden="true" />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.07), rgba(0,0,0,0.85) 70%)" }}
      />

      {/* Letterbox cinematográfico */}
      <div className="di-letterbox di-letterbox-top" aria-hidden="true" />
      <div className="di-letterbox di-letterbox-bottom" aria-hidden="true" />

      {/* ── FASE 1: chamado do Mestre ─────────────────────────────────────── */}
      {phase === "master" && (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          {/* Flash de entrada */}
          <div className="di-enter-flash" aria-hidden="true" style={{ background: accent }} />

          <div
            className="di-master-glow"
            aria-hidden="true"
            style={{ background: `radial-gradient(circle, ${accent}55, transparent 65%)` }}
          />

          {/* Aura girante atrás do Mestre */}
          <div
            className="di-aura"
            aria-hidden="true"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, ${accent}44 24deg, transparent 60deg, ${accent}2e 130deg, transparent 170deg, ${accent}44 250deg, transparent 300deg)`,
            }}
          />

          {/* Partículas de energia subindo */}
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            {particles.map((p, i) => (
              <span
                key={i}
                className="di-particle"
                style={{
                  left: p.left,
                  width: p.size,
                  height: p.size,
                  background: accent,
                  boxShadow: `0 0 ${p.size * 2}px ${accent}`,
                  animationDelay: p.delay,
                  animationDuration: p.dur,
                }}
              />
            ))}
          </div>

          {/* Selo "DUELO IMINENTE" */}
          <div className="di-callout" aria-hidden="true">
            <span className="di-callout-text" style={{ color: accent, textShadow: `0 0 18px ${accent}` }}>
              — DUELO IMINENTE —
            </span>
          </div>

          <div className="relative flex items-center gap-5 sm:gap-8 max-w-3xl w-full">
            {/* Ícone do Mestre */}
            <div className="di-master-in relative shrink-0">
              <div
                className="absolute -inset-3 rounded-full di-pulse-ring"
                aria-hidden="true"
                style={{ border: `2px solid ${accent}` }}
              />
              <div
                className="absolute -inset-6 rounded-full di-pulse-ring di-pulse-ring-2"
                aria-hidden="true"
                style={{ border: `1px solid ${accent}` }}
              />
              <img
                src={master?.iconPath || "/images/masters/fehnon-icon.png"}
                alt={`Mestre ${master?.name ?? ""}`}
                className="relative w-28 h-28 sm:w-40 sm:h-40 rounded-full object-cover di-master-breathe"
                style={{ border: `3px solid ${accent}`, boxShadow: `0 0 40px ${accent}88, 0 0 90px ${accent}44` }}
                draggable={false}
              />
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-black tracking-widest uppercase whitespace-nowrap"
                style={{ background: accent, color: "#04030d", boxShadow: `0 0 18px ${accent}aa` }}
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
                  boxShadow: `0 10px 40px rgba(0,0,0,0.6), 0 0 0 3px ${accent}, 0 0 34px ${accent}66`,
                }}
              >
                <p className="text-slate-900 font-extrabold text-base sm:text-2xl leading-relaxed text-balance">
                  {typed}
                  <span className="di-caret">|</span>
                </p>
                {/* Rabicho do balão */}
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
        <div className="absolute inset-0 di-shake">
          {/* Speed-lines radiais girando lentamente */}
          <div className="di-speedlines" aria-hidden="true" />

          {/* Painel do oponente (topo) */}
          <div className="di-panel di-panel-opp">
            <img
              src={opponent.icon || "/images/gp-cg-logo.png"}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover di-kenburns"
              style={{ opacity: 0.8, objectPosition: "center 22%" }}
              draggable={false}
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(200deg, ${oppAccent}55, rgba(4,3,13,0.55) 45%, rgba(4,3,13,0.92) 100%)` }}
            />
          </div>

          {/* Painel do jogador (base) */}
          <div className="di-panel di-panel-me">
            <img
              src={playerIcon}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover di-kenburns"
              style={{ opacity: 0.8, objectPosition: "center 30%" }}
              draggable={false}
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(20deg, ${accent}55, rgba(4,3,13,0.55) 45%, rgba(4,3,13,0.92) 100%)` }}
            />
          </div>

          {/* Barras brancas do corte diagonal */}
          <div className="di-bar di-bar-top" aria-hidden="true" />
          <div className="di-bar di-bar-bottom" aria-hidden="true" />

          {/* Relâmpagos do impacto */}
          <div className="di-bolt di-bolt-1" aria-hidden="true" />
          <div className="di-bolt di-bolt-2" aria-hidden="true" />

          {/* Faíscas voando do centro */}
          <div className="absolute top-1/2 left-1/2 z-[35]" aria-hidden="true">
            {sparks.map((s, i) => (
              <span
                key={i}
                className="di-spark"
                style={
                  {
                    "--dx": s.dx,
                    "--dy": s.dy,
                    width: s.size,
                    height: s.size,
                    background: s.hot ? "#ffffff" : oppAccent,
                    boxShadow: `0 0 ${s.size * 3}px ${s.hot ? "#ffffff" : oppAccent}`,
                    animationDelay: `${T_IMPACT}ms`,
                    transitionDelay: s.delay,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          {/* Nome + ícone do oponente */}
          <div className="di-name di-name-opp">
            <div className="flex items-center gap-3 sm:gap-4">
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
                style={{ border: `3px solid ${oppAccent}`, boxShadow: `0 0 30px ${oppAccent}99` }}
                draggable={false}
              />
            </div>
          </div>

          {/* Nome + ícone do jogador */}
          <div className="di-name di-name-me">
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src={playerIcon}
                alt={playerName}
                className="w-14 h-14 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                style={{ border: `3px solid ${accent}`, boxShadow: `0 0 30px ${accent}99` }}
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

          {/* Emblema central + shockwaves + flash duplo */}
          <div className="di-vs-wrap">
            <div className="di-ring" aria-hidden="true" />
            <div className="di-ring di-ring-2" aria-hidden="true" />
            <div className="di-ring di-ring-3" aria-hidden="true" />
            <div className="di-vs" style={{ WebkitTextStroke: `3px ${oppAccent}` }}>
              {opponent.isBoss ? "BOSS" : "VS"}
            </div>
          </div>
          <div className="di-flash" aria-hidden="true" />
          <div className="di-flash-color" aria-hidden="true" style={{ background: oppAccent }} />

          {/* Vinheta de energia pulsando nas bordas */}
          <div
            className="di-edge-glow"
            aria-hidden="true"
            style={{ boxShadow: `inset 0 0 120px 30px ${oppAccent}33, inset 0 0 60px 10px ${accent}22` }}
          />

          <p className="absolute bottom-4 left-0 right-0 text-center text-[10px] sm:text-xs font-mono tracking-[0.3em] text-white/40 uppercase z-50">
            Toque para pular
          </p>
        </div>
      )}

      <style>{`
        .di-out { animation: diOut ${T_FADE}ms ease-in forwards; }
        @keyframes diOut { from { opacity: 1 } to { opacity: 0 } }

        /* Fundo listrado em movimento */
        .di-stripes {
          position: absolute; inset: -25%;
          background: repeating-linear-gradient(
            115deg,
            rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px,
            transparent 2px, transparent 16px,
            rgba(225,29,72,0.10) 16px, rgba(225,29,72,0.10) 20px,
            transparent 20px, transparent 40px
          );
          animation: diStripes 1.6s linear infinite;
          will-change: transform;
        }
        @keyframes diStripes { from { transform: translate3d(0,0,0) } to { transform: translate3d(-40px,-86px,0) } }

        /* Letterbox cinematográfico */
        .di-letterbox {
          position: absolute; left: 0; right: 0; height: 7vh; background: #000; z-index: 45;
          will-change: transform;
        }
        .di-letterbox-top    { top: 0;    animation: diLbTop 600ms cubic-bezier(0.16,1,0.3,1) both; }
        .di-letterbox-bottom { bottom: 0; animation: diLbBottom 600ms cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes diLbTop    { from { transform: translate3d(0,-100%,0) } to { transform: translate3d(0,0,0) } }
        @keyframes diLbBottom { from { transform: translate3d(0,100%,0) }  to { transform: translate3d(0,0,0) } }

        /* ── Fase 1 ── */
        .di-enter-flash {
          position: absolute; inset: 0; pointer-events: none; z-index: 5;
          animation: diEnterFlash 520ms ease-out both; will-change: opacity;
        }
        @keyframes diEnterFlash {
          0%   { opacity: 0.55 }
          100% { opacity: 0 }
        }
        .di-master-glow {
          position: absolute; width: 90vmin; height: 90vmin; border-radius: 9999px;
          animation: diGlow 2.6s ease-out forwards; will-change: transform, opacity;
        }
        @keyframes diGlow {
          0%   { opacity: 0; transform: scale(0.5) }
          25%  { opacity: 1; transform: scale(1) }
          100% { opacity: 0.55; transform: scale(1.12) }
        }
        .di-aura {
          position: absolute; width: 120vmin; height: 120vmin; border-radius: 9999px;
          animation: diAura 6s linear infinite; opacity: 0.8;
          will-change: transform;
        }
        @keyframes diAura { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

        .di-particle {
          position: absolute; bottom: -12px; border-radius: 9999px; opacity: 0;
          animation-name: diParticle; animation-timing-function: linear; animation-iteration-count: infinite;
          will-change: transform, opacity;
        }
        @keyframes diParticle {
          0%   { opacity: 0;   transform: translate3d(0,0,0) }
          12%  { opacity: 0.9; }
          85%  { opacity: 0.5; }
          100% { opacity: 0;   transform: translate3d(14px,-105vh,0) }
        }

        .di-callout {
          position: absolute; top: 12vh; left: 0; right: 0; text-align: center; z-index: 20;
          animation: diCallout 700ms cubic-bezier(0.16,1,0.3,1) 120ms both;
          will-change: transform, opacity;
        }
        .di-callout-text {
          font-size: clamp(11px, 2.2vw, 16px); font-weight: 900;
          letter-spacing: 0.5em; text-transform: uppercase;
          animation: diCalloutBlink 1.1s ease-in-out 800ms infinite alternate;
        }
        @keyframes diCallout {
          0%   { opacity: 0; transform: translate3d(0,-18px,0) scale(1.4); letter-spacing: 1em }
          100% { opacity: 1; transform: translate3d(0,0,0) scale(1) }
        }
        @keyframes diCalloutBlink { from { opacity: 1 } to { opacity: 0.45 } }

        .di-master-in { animation: diMasterIn 620ms cubic-bezier(0.16,1,0.3,1) both; will-change: transform, opacity; }
        @keyframes diMasterIn {
          0%   { opacity: 0; transform: translate3d(-60px,0,0) scale(0.7) }
          60%  { opacity: 1; transform: translate3d(6px,0,0) scale(1.06) }
          100% { opacity: 1; transform: translate3d(0,0,0) scale(1) }
        }
        .di-master-breathe { animation: diBreathe 1.6s ease-in-out 700ms infinite alternate; will-change: transform; }
        @keyframes diBreathe { from { transform: scale(1) } to { transform: scale(1.045) } }

        .di-pulse-ring { animation: diPulseRing 1.4s ease-out infinite; will-change: transform, opacity; }
        .di-pulse-ring-2 { animation-delay: 0.45s; animation-duration: 1.7s; }
        @keyframes diPulseRing {
          0%   { opacity: 0.9; transform: scale(0.92) }
          100% { opacity: 0;   transform: scale(1.35) }
        }
        .di-bubble-in { animation: diBubbleIn 420ms cubic-bezier(0.34,1.56,0.64,1) 160ms both; will-change: transform, opacity; }
        @keyframes diBubbleIn {
          0%   { opacity: 0; transform: translate3d(0,10px,0) scale(0.85) }
          100% { opacity: 1; transform: translate3d(0,0,0) scale(1) }
        }
        .di-caret { animation: diCaret 0.55s steps(1) infinite; margin-left: 2px; color: #64748b; }
        @keyframes diCaret { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }

        /* ── Fase 2 ── */
        .di-shake { animation: diShake 560ms cubic-bezier(0.36,0.07,0.19,0.97) ${T_IMPACT}ms both; will-change: transform; }
        @keyframes diShake {
          0%   { transform: translate3d(0,0,0) }
          10%  { transform: translate3d(-16px,10px,0) rotate(-0.5deg) }
          22%  { transform: translate3d(14px,-11px,0) rotate(0.4deg) }
          36%  { transform: translate3d(-11px,7px,0) rotate(-0.3deg) }
          50%  { transform: translate3d(8px,-5px,0) rotate(0.2deg) }
          66%  { transform: translate3d(-5px,3px,0) }
          82%  { transform: translate3d(3px,-2px,0) }
          100% { transform: translate3d(0,0,0) }
        }

        .di-speedlines {
          position: absolute; inset: -30%; z-index: 5; opacity: 0;
          background: repeating-conic-gradient(
            from 0deg at 50% 50%,
            rgba(255,255,255,0.09) 0deg, rgba(255,255,255,0.09) 1.4deg,
            transparent 1.4deg, transparent 9deg
          );
          animation: diSpeedIn 400ms ease-out ${T_IMPACT}ms forwards, diSpeedSpin 9s linear infinite;
          will-change: transform, opacity;
        }
        @keyframes diSpeedIn   { from { opacity: 0 } to { opacity: 1 } }
        @keyframes diSpeedSpin { from { transform: rotate(0deg) } to { transform: rotate(14deg) } }

        .di-panel {
          position: absolute; inset: 0; overflow: hidden;
          will-change: transform, opacity; backface-visibility: hidden;
        }
        .di-panel-opp {
          clip-path: polygon(0 0, 100% 0, 100% 40%, 0 58%);
          animation: diPanelOpp 520ms cubic-bezier(0.16,1,0.3,1) both;
        }
        .di-panel-me {
          clip-path: polygon(0 63%, 100% 45%, 100% 100%, 0 100%);
          animation: diPanelMe 520ms cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes diPanelOpp {
          0%   { opacity: 0; transform: translate3d(35%,-14%,0) }
          70%  { opacity: 1; transform: translate3d(-1.5%,0.6%,0) }
          100% { opacity: 1; transform: translate3d(0,0,0) }
        }
        @keyframes diPanelMe {
          0%   { opacity: 0; transform: translate3d(-35%,14%,0) }
          70%  { opacity: 1; transform: translate3d(1.5%,-0.6%,0) }
          100% { opacity: 1; transform: translate3d(0,0,0) }
        }
        .di-kenburns { animation: diKenburns 3.2s ease-out ${T_IMPACT}ms both; will-change: transform; }
        @keyframes diKenburns { from { transform: scale(1.1) } to { transform: scale(1.22) } }

        .di-bar {
          position: absolute; left: -10%; width: 120%; height: 6px; z-index: 10;
          background: rgba(255,255,255,0.92);
          box-shadow: 0 0 24px rgba(255,255,255,0.55);
          will-change: transform, opacity;
        }
        .di-bar-top    { top: 45%; transform-origin: left center; animation: diBar 480ms cubic-bezier(0.16,1,0.3,1) 120ms both; }
        .di-bar-bottom { top: 58%; transform-origin: right center; animation: diBar 480ms cubic-bezier(0.16,1,0.3,1) 200ms both; }
        @keyframes diBar {
          0%   { opacity: 0; transform: rotate(-9.5deg) scaleX(0) }
          100% { opacity: 1; transform: rotate(-9.5deg) scaleX(1) }
        }

        /* Relâmpagos do impacto */
        .di-bolt {
          position: absolute; top: -12%; height: 124%; width: 4px; z-index: 32; opacity: 0;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.95) 30%, rgba(255,255,255,0.95) 70%, transparent);
          box-shadow: 0 0 22px rgba(255,255,255,0.85);
          will-change: transform, opacity;
        }
        .di-bolt-1 { left: 30%; transform: rotate(16deg) skewX(-8deg); animation: diBolt 460ms ease-out ${T_IMPACT - 40}ms both; }
        .di-bolt-2 { left: 66%; transform: rotate(-14deg) skewX(6deg); animation: diBolt 520ms ease-out ${T_IMPACT + 90}ms both; }
        @keyframes diBolt {
          0%   { opacity: 0 }
          8%   { opacity: 1 }
          22%  { opacity: 0.2 }
          34%  { opacity: 0.95 }
          100% { opacity: 0 }
        }

        /* Faíscas radiais */
        .di-spark {
          position: absolute; top: 0; left: 0; border-radius: 9999px; opacity: 0;
          animation: diSpark 780ms cubic-bezier(0.16,1,0.3,1) both;
          will-change: transform, opacity;
        }
        @keyframes diSpark {
          0%   { opacity: 1; transform: translate3d(0,0,0) scale(1.4) }
          100% { opacity: 0; transform: translate3d(var(--dx), var(--dy), 0) scale(0.15) }
        }

        .di-name {
          position: absolute; z-index: 20; padding: 10px 18px; border-radius: 18px;
          background: radial-gradient(ellipse at center, rgba(4,3,13,0.62), rgba(4,3,13,0) 72%);
          will-change: transform, opacity;
        }
        .di-name-opp {
          top: 9%; right: 5%;
          animation: diNameOpp 520ms cubic-bezier(0.16,1,0.3,1) 150ms both;
        }
        .di-name-me {
          bottom: 13%; left: 5%;
          animation: diNameMe 520ms cubic-bezier(0.16,1,0.3,1) 240ms both;
        }
        @keyframes diNameOpp {
          0%   { opacity: 0; transform: translate3d(70px,-24px,0) }
          100% { opacity: 1; transform: translate3d(0,0,0) }
        }
        @keyframes diNameMe {
          0%   { opacity: 0; transform: translate3d(-70px,24px,0) }
          100% { opacity: 1; transform: translate3d(0,0,0) }
        }
        .di-title {
          font-weight: 900; color: #ffffff; line-height: 1;
          letter-spacing: -0.02em; text-transform: uppercase;
          transform: skewX(-7deg);
          text-shadow: 0 4px 0 rgba(0,0,0,0.65), 0 0 26px rgba(255,255,255,0.35);
        }

        .di-vs-wrap {
          position: absolute; top: 50%; left: 50%; z-index: 30;
          transform: translate3d(-50%,-50%,0);
          display: flex; align-items: center; justify-content: center;
        }
        .di-vs {
          font-size: clamp(56px, 14vw, 150px); font-weight: 900; color: #ffffff;
          letter-spacing: -0.04em; line-height: 1;
          text-shadow: 0 0 50px rgba(255,255,255,0.6);
          animation:
            diVs 620ms cubic-bezier(0.22,1.4,0.36,1) ${T_IMPACT - 120}ms both,
            diVsPulse 1s ease-in-out ${T_IMPACT + 520}ms infinite alternate;
          will-change: transform, opacity;
        }
        @keyframes diVs {
          0%   { opacity: 0; transform: scale(4.2) rotate(-24deg) }
          55%  { opacity: 1; transform: scale(0.92) rotate(3deg) }
          75%  { transform: scale(1.08) rotate(-2deg) }
          100% { opacity: 1; transform: scale(1) rotate(0deg) }
        }
        @keyframes diVsPulse {
          from { text-shadow: 0 0 50px rgba(255,255,255,0.6) }
          to   { text-shadow: 0 0 85px rgba(255,255,255,0.95), 0 0 30px rgba(255,255,255,0.8) }
        }
        .di-ring {
          position: absolute; width: 120px; height: 120px; border-radius: 9999px;
          border: 4px solid rgba(255,255,255,0.85);
          animation: diRing 700ms ease-out ${T_IMPACT}ms both;
          will-change: transform, opacity;
        }
        .di-ring-2 { animation-delay: ${T_IMPACT + 110}ms; border-color: rgba(225,29,72,0.8); }
        .di-ring-3 { animation-delay: ${T_IMPACT + 230}ms; animation-duration: 850ms; border-width: 2px; border-color: rgba(255,255,255,0.5); }
        @keyframes diRing {
          0%   { opacity: 0.95; transform: scale(0.2) }
          100% { opacity: 0;    transform: scale(7) }
        }
        .di-flash {
          position: absolute; inset: 0; background: #ffffff; pointer-events: none; z-index: 40;
          animation: diFlash 320ms ease-out ${T_IMPACT}ms both;
          will-change: opacity;
        }
        @keyframes diFlash {
          0%   { opacity: 0 }
          14%  { opacity: 0.85 }
          100% { opacity: 0 }
        }
        .di-flash-color {
          position: absolute; inset: 0; pointer-events: none; z-index: 39;
          animation: diFlashColor 460ms ease-out ${T_IMPACT + 130}ms both;
          will-change: opacity;
        }
        @keyframes diFlashColor {
          0%   { opacity: 0 }
          18%  { opacity: 0.35 }
          100% { opacity: 0 }
        }
        .di-edge-glow {
          position: absolute; inset: 0; pointer-events: none; z-index: 38;
          animation: diEdgeGlow 1.2s ease-in-out ${T_IMPACT + 300}ms infinite alternate both;
          will-change: opacity;
        }
        @keyframes diEdgeGlow { from { opacity: 0.35 } to { opacity: 1 } }

        @media (prefers-reduced-motion: reduce) {
          .di-stripes, .di-shake, .di-pulse-ring, .di-pulse-ring-2, .di-aura,
          .di-particle, .di-speedlines, .di-kenburns, .di-master-breathe,
          .di-spark, .di-edge-glow { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
