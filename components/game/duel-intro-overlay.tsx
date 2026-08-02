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
// Transição final: onda de energia azul varrendo pra esquerda
const T_GEAR_TOTAL = 1700 // duração total da varredura
const T_GEAR_COVER = 700  // momento em que a onda cobre 100% da tela (revela o duelo por trás)

const GEAR_IMG = "/images/modes/gear-blue.png"

// Engrenagens-herói: poucas, grandes e elegantes, cravadas na crista de luz.
// glow = espessura do halo de energia (px) atrás de cada uma.
const HERO_GEARS = [
  { top: 12, s: 150, spin: 3200, rev: false, glow: 34 },
  { top: 46, s: 96,  spin: 2200, rev: true,  glow: 26 },
  { top: 76, s: 126, spin: 2800, rev: false, glow: 30 },
]

// Fagulhas que derivam sobre o duelo revelado e se apagam suavemente
const AFTER_SPARKS = [
  { top: 16, left: 72, s: 5, dl: 780, t: 640 },
  { top: 34, left: 48, s: 4, dl: 840, t: 700 },
  { top: 52, left: 82, s: 6, dl: 760, t: 620 },
  { top: 66, left: 30, s: 4, dl: 900, t: 680 },
  { top: 78, left: 60, s: 5, dl: 820, t: 660 },
  { top: 26, left: 14, s: 4, dl: 880, t: 700 },
]

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

// Destroços que voam do centro e caem com "gravidade" (dx/dy em px)
const DEBRIS = [
  { x: -180, y: -60,  s: 5, dl: 0,   t: 0.9 },
  { x: 150,  y: -90,  s: 4, dl: 30,  t: 1.0 },
  { x: -110, y: 40,   s: 6, dl: 60,  t: 0.8 },
  { x: 200,  y: 20,   s: 3, dl: 10,  t: 1.1 },
  { x: -230, y: -20,  s: 4, dl: 80,  t: 0.95 },
  { x: 90,   y: -130, s: 5, dl: 45,  t: 0.85 },
  { x: -60,  y: -150, s: 3, dl: 20,  t: 1.05 },
  { x: 240,  y: -50,  s: 4, dl: 70,  t: 0.9 },
]

// Typewriter isolado num componente próprio: o setState a cada 26ms
// re-renderiza só este trecho, e não a intro inteira (evita lag na fase 1)
function TypewriterText({ line }: { line: string }) {
  const [typed, setTyped] = useState("")
  useEffect(() => {
    let i = 0
    const typer = setInterval(() => {
      i++
      setTyped(line.slice(0, i))
      if (i >= line.length) clearInterval(typer)
    }, 26)
    return () => clearInterval(typer)
  }, [line])
  return <>{typed}</>
}

export default function DuelIntroOverlay({ opponent, onComplete, sfxVolume = 80 }: DuelIntroOverlayProps) {
  const { playerProfile } = useGame()
  const [phase, setPhase] = useState<"master" | "clash" | "gears" | "out">("master")
  // true a partir do instante em que a cortina de engrenagens cobre a tela:
  // o conteúdo do choque some e o fundo fica transparente, revelando o duelo
  const [revealed, setRevealed] = useState(false)

  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const impactRef = useRef<HTMLAudioElement | null>(null)
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
    const imp = impactRef.current
    if (imp) {
      try { imp.pause(); imp.currentTime = 0 } catch { /* ignore */ }
      impactRef.current = null
    }
    onComplete()
  }

  const skip = () => {
    if (doneRef.current) return
    // Durante a varredura da onda o duelo já está sendo revelado —
    // pular aqui cortaria a transição no meio, então ignoramos
    if (phase === "gears") return
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

    timersRef.current.push(setTimeout(() => { if (!cancelled) setPhase("clash") }, T_MASTER_END))

    // Fim do choque → onda de energia azul varre a tela pra esquerda.
    // No instante em que ela cobre tudo, o duelo é revelado por trás; quando
    // ela termina de sair pela esquerda, o overlay se encerra.
    timersRef.current.push(setTimeout(() => { if (!cancelled) setPhase("gears") }, T_MASTER_END + T_CLASH_END))
    timersRef.current.push(setTimeout(() => { if (!cancelled) setRevealed(true) }, T_MASTER_END + T_CLASH_END + T_GEAR_COVER))
    timersRef.current.push(setTimeout(() => { if (!cancelled) finish() }, T_MASTER_END + T_CLASH_END + T_GEAR_TOTAL))

    return () => {
      cancelled = true
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      try { voice.pause() } catch { /* ignore */ }
      try { impactRef.current?.pause() } catch { /* ignore */ }
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
      style={{ background: revealed ? "transparent" : "#04030d" }}
    >
      {/* Letterbox + vinheta somem quando o duelo é revelado atrás da cortina */}
      {!revealed && (
        <>
          <div className="di-letterbox di-letterbox-top"    aria-hidden="true" />
          <div className="di-letterbox di-letterbox-bottom" aria-hidden="true" />
          <div className="di-vignette" aria-hidden="true" />
        </>
      )}

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

          {/* Raios de energia irradiando do Mestre, girando lentamente */}
          <div
            className="di-rays"
            aria-hidden="true"
            style={{
              background: `repeating-conic-gradient(from 0deg, ${accent}1c 0deg 5deg, transparent 5deg 20deg)`,
            }}
          />

          {/* Brilho de solo sob o Mestre (luz refletida no chão) */}
          <div
            className="di-floor-glow"
            aria-hidden="true"
            style={{ background: `radial-gradient(ellipse at center, ${accent}33, transparent 68%)` }}
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
                  <TypewriterText line={line} />
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
      {(phase === "clash" || phase === "out" || (phase === "gears" && !revealed)) && (
        <div className={`absolute inset-0 di-shake`}>
          {/* Na transição final (onda), escondemos linhas brancas e nomes */}
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
            {phase !== "gears" && <div className="di-speedlines di-speedlines-opp" aria-hidden="true" />}
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
            {phase !== "gears" && <div className="di-speedlines di-speedlines-me" aria-hidden="true" />}
          </div>

          {/* Barras do corte diagonal com energia dos dois lados */}
          {phase !== "gears" && (
            <>
              <div
                className="di-bar di-bar-top"
                aria-hidden="true"
                style={{ background: `linear-gradient(to right, ${oppAccent}, #ffffff 45%, #ffffff 55%, ${oppAccent})` }}
              />
              <div
                className="di-bar di-bar-bottom"
                aria-hidden="true"
                style={{ background: `linear-gradient(to right, ${accent}, #ffffff 45%, #ffffff 55%, ${accent})` }}
              />
            </>
          )}

          {/* Energia incandescente pulsando na zona do choque */}
          {phase !== "gears" && (
            <div
              className="di-cut-glow"
              aria-hidden="true"
              style={{ background: `linear-gradient(to right, ${accent}30, rgba(255,255,255,0.22) 50%, ${oppAccent}30)` }}
            />
          )}

          {/* Faísca correndo na linha de corte */}
          {phase !== "gears" && <div className="di-cut-spark" aria-hidden="true" />}

          {/* Impact frames estilo anime: frames alternados preto/branco no choque */}
          <div className="di-impact-frame" aria-hidden="true" />

          {/* Destroços voando do centro com gravidade */}
          {DEBRIS.map((d, idx) => (
            <span
              key={idx}
              className="di-debris"
              aria-hidden="true"
              style={{
                width: `${d.s}px`,
                height: `${d.s}px`,
                background: idx % 3 === 0 ? oppAccent : "#ffffff",
                boxShadow: `0 0 ${d.s * 2}px ${idx % 3 === 0 ? oppAccent : "rgba(255,255,255,0.8)"}`,
                animationDelay: `${T_IMPACT + d.dl}ms`,
                animationDuration: `${d.t}s`,
                ["--dx" as string]: `${d.x}px`,
                ["--dy" as string]: `${d.y}px`,
              }}
            />
          ))}

          {/* Nome + ícone do oponente */}
          {phase !== "gears" && (
          <div className="di-name di-name-opp">
            <div
              className="di-name-bar di-name-bar-opp"
              aria-hidden="true"
              style={{ background: `linear-gradient(to left, ${oppAccent}, transparent)` }}
            />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="di-plate" aria-hidden="true" style={{ borderColor: `${oppAccent}66`, borderRightColor: oppAccent }} />
              <div className="relative text-right">
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
                className="relative w-14 h-14 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                style={{ border: `3px solid ${oppAccent}`, boxShadow: `0 0 22px ${oppAccent}88` }}
                draggable={false}
              />
            </div>
          </div>
          )}

          {/* Nome + ícone do jogador */}
          {phase !== "gears" && (
          <div className="di-name di-name-me">
            <div
              className="di-name-bar di-name-bar-me"
              aria-hidden="true"
              style={{ background: `linear-gradient(to right, ${accent}, transparent)` }}
            />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="di-plate" aria-hidden="true" style={{ borderColor: `${accent}66`, borderLeftColor: accent }} />
              <img
                src={playerIcon}
                alt={playerName}
                className="relative w-14 h-14 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                style={{ border: `3px solid ${accent}`, boxShadow: `0 0 22px ${accent}88` }}
                draggable={false}
              />
              <div className="relative">
                <p className="text-[10px] sm:text-xs font-black tracking-[0.25em] uppercase" style={{ color: accent }}>
                  Mestre {master?.name ?? ""}
                </p>
                <h2 className="di-title text-2xl sm:text-5xl">{playerName}</h2>
              </div>
            </div>
          </div>
          )}

          {/* VS central com duplo impacto */}
          <div className="di-vs-wrap">
            {/* Brasa incandescente pulsando atrás do VS */}
            <div
              className="di-vs-core"
              aria-hidden="true"
              style={{ background: `radial-gradient(circle, rgba(255,255,255,0.5), ${oppAccent}33 40%, transparent 70%)` }}
            />
            <div className="di-ring"   aria-hidden="true" />
            <div className="di-ring di-ring-2" aria-hidden="true" style={{ borderColor: `${oppAccent}b3` }} />
            <div className="di-ring di-ring-3" aria-hidden="true" style={{ borderColor: `${accent}99` }} />
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

          {/* Flash de impacto */}
          <div className="di-flash" aria-hidden="true" />

          <p className="di-skip-hint absolute bottom-4 left-0 right-0 text-center text-[10px] sm:text-xs font-mono tracking-[0.3em] text-white/35 uppercase z-50">
            Toque para pular
          </p>
        </div>
      )}

      {/* ── TRANSIÇÃO FINAL: onda de energia azul varrendo pra esquerda ────── */}
      {phase === "gears" && (
        <div className="absolute inset-0 z-[60] pointer-events-none" aria-hidden="true">
          {/* Sucção de luz: pulso azul vindo da direita anunciando a onda */}
          {!revealed && <div className="di-sweep-charge" />}

          {/* Onda de energia: muralha de luz que cobre a tela e revela o duelo */}
          <div className="di-wave">
            {/* Corpo profundo com textura de circuito em paralaxe */}
            <div className="di-wave-body" />
            <div className="di-wave-tex" />
            <div className="di-wave-tex di-wave-tex-2" />
            {/* Crista: brilho largo difuso + lâmina incandescente */}
            <div className="di-wave-edge" />
            <div className="di-wave-edge-core" />
            {/* Cauda: véu azul que se dissipa sobre o duelo revelado */}
            <div className="di-wave-tail" />

            {/* Engrenagens-herói na crista — poucas, grandes, cinematográficas */}
            {HERO_GEARS.map((g, idx) => (
              <div
                key={`hero-${idx}`}
                className="di-hero-gear"
                style={{
                  top: `${g.top}%`,
                  left: `${-g.s / 2}px`,
                  width: `${g.s}px`,
                  height: `${g.s}px`,
                  marginTop: `${-g.s / 2}px`,
                }}
              >
                <span className="di-hero-gear-halo" style={{ inset: `${-g.glow}px` }} />
                <img
                  src={GEAR_IMG || "/placeholder.svg"}
                  alt=""
                  className={`di-gear-spin${g.rev ? " di-gear-spin-rev" : ""}`}
                  style={{ width: "100%", height: "100%", animationDuration: `${g.spin}ms` }}
                  draggable={false}
                />
              </div>
            ))}
          </div>

          {/* Clarão sincronizado com o instante do reveal */}
          <div className="di-reveal-flash" />
          {/* Névoa azul que se dissipa sobre o duelo já revelado */}
          <div className="di-afterglow" />
          {/* Energia escorrendo pelas bordas da tela */}
          <div className="di-edge-pulse" />

          {/* Fagulhas derivando sobre o duelo */}
          {AFTER_SPARKS.map((p, idx) => (
            <span
              key={`aspark-${idx}`}
              className="di-after-spark"
              style={{
                top: `${p.top}%`,
                left: `${p.left}%`,
                width: `${p.s}px`,
                height: `${p.s}px`,
                animationDelay: `${p.dl}ms`,
                animationDuration: `${p.t}ms`,
              }}
            />
          ))}
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
        /* Dolly lento pra dentro durante toda a fase + zoom violento de saída */
        .di-stage-master {
          animation: diStageIn ${T_MASTER_END - 380}ms ease-out both,
                     diStageOut 380ms cubic-bezier(0.55,0,1,0.45) ${T_MASTER_END - 380}ms both;
          will-change: transform, opacity;
        }
        @keyframes diStageIn {
          from { transform: scale(1) }
          to   { transform: scale(1.045) }
        }
        @keyframes diStageOut {
          0%   { transform: scale(1.045); opacity: 1 }
          100% { transform: scale(1.4); opacity: 0 }
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

        /* Raios de energia irradiando do centro, girando devagar */
        .di-rays {
          position: absolute; width: 96vmin; height: 96vmin; border-radius: 9999px;
          -webkit-mask-image: radial-gradient(circle, rgba(0,0,0,0.9) 0%, transparent 58%);
          mask-image: radial-gradient(circle, rgba(0,0,0,0.9) 0%, transparent 58%);
          animation: diRaysIn 900ms ease-out 150ms both, diRaysSpin 18s linear infinite;
          will-change: transform;
          transform: translateZ(0);
        }
        @keyframes diRaysIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes diRaysSpin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

        /* Luz refletida no chão sob o Mestre */
        .di-floor-glow {
          position: absolute; bottom: 4%; left: 50%; transform: translateX(-50%);
          width: 90vmin; height: 22vmin; pointer-events: none;
          animation: diFloorGlow 1.1s ease-out 200ms both;
          will-change: opacity;
        }
        @keyframes diFloorGlow { from { opacity: 0 } to { opacity: 1 } }

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
          0%   { opacity: 0; transform: translate3d(0,-12px,0) scale(1.35) }
          100% { opacity: 1; transform: translate3d(0,0,0) scale(1) }
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
          animation: diShake 620ms cubic-bezier(0.36,0.07,0.19,0.97) ${T_IMPACT}ms both,
                     diRumble 260ms linear ${T_IMPACT + 640}ms 5;
          will-change: transform;
        }
        /* Réplica do tremor: micro-abalos que vão morrendo depois do impacto */
        @keyframes diRumble {
          0%   { transform: translate3d(0,0,0) }
          25%  { transform: translate3d(1.5px,-1px,0) }
          50%  { transform: translate3d(-1px,1.5px,0) }
          75%  { transform: translate3d(1px,0.5px,0) }
          100% { transform: translate3d(0,0,0) }
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
          position: absolute; inset: -20%; opacity: 0.09; pointer-events: none;
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
          box-shadow: 0 0 18px rgba(255,255,255,0.5);
          will-change: transform, opacity;
        }
        .di-bar-top    { top: 45%; transform-origin: left center;  animation: diBar 420ms cubic-bezier(0.16,1,0.3,1) 100ms both; }
        .di-bar-bottom { top: 58%; transform-origin: right center; animation: diBar 420ms cubic-bezier(0.16,1,0.3,1) 180ms both; }
        @keyframes diBar {
          0%   { opacity: 0; transform: rotate(-9.5deg) scaleX(0) }
          100% { opacity: 1; transform: rotate(-9.5deg) scaleX(1) }
        }

        /* Energia incandescente respirando na zona do choque, entre as barras */
        .di-cut-glow {
          position: absolute; top: 44%; left: -10%; width: 120%; height: 15%;
          z-index: 9; pointer-events: none;
          transform: rotate(-9.5deg);
          -webkit-mask-image: linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent);
          mask-image: linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent);
          animation: diCutGlowIn 500ms ease-out ${T_IMPACT}ms both,
                     diCutGlowPulse 1.5s ease-in-out ${T_IMPACT + 500}ms infinite;
          will-change: opacity;
        }
        @keyframes diCutGlowIn    { from { opacity: 0 } to { opacity: 0.8 } }
        @keyframes diCutGlowPulse { 0%, 100% { opacity: 0.8 } 50% { opacity: 0.45 } }

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

        /* Placa angular estilo fighting game atrás dos nomes */
        .di-plate {
          position: absolute; inset: -10px -18px; z-index: 0;
          background: linear-gradient(135deg, rgba(6,5,18,0.88), rgba(6,5,18,0.62));
          border: 1px solid; border-radius: 4px;
          transform: skewX(-6deg);
          box-shadow: 0 12px 32px rgba(0,0,0,0.5);
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
          animation: diVs 560ms cubic-bezier(0.22,1.4,0.36,1) ${T_IMPACT - 100}ms both;
          will-change: transform, opacity;
        }
        @keyframes diVs {
          0%   { opacity: 0; transform: scale(3.8) rotate(-20deg) }
          55%  { opacity: 1; transform: scale(0.94) rotate(2deg) }
          78%  { transform: scale(1.06) rotate(-1deg) }
          100% { opacity: 1; transform: scale(1) rotate(0deg) }
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
        .di-ring-3 {
          animation-delay: ${T_IMPACT + 240}ms;
          border-width: 1px;
        }
        @keyframes diRing {
          0%   { opacity: 0.9; transform: scale(0.2) }
          100% { opacity: 0;   transform: scale(6) }
        }

        /* Impact frames estilo anime: alternância seca branco/preto por 4 frames */
        .di-impact-frame {
          position: absolute; inset: 0; pointer-events: none; z-index: 41;
          opacity: 0;
          animation: diImpactFrame 190ms steps(1) ${T_IMPACT - 40}ms both;
          will-change: opacity, background;
        }
        @keyframes diImpactFrame {
          0%   { opacity: 1; background: #ffffff }
          25%  { opacity: 1; background: #000000 }
          50%  { opacity: 1; background: #ffffff }
          75%  { opacity: 0.6; background: #000000 }
          100% { opacity: 0 }
        }

        /* Destroços com arco de gravidade: sobem/voam e caem apagando */
        .di-debris {
          position: absolute; top: 50%; left: 50%; z-index: 31;
          border-radius: 2px; opacity: 0;
          animation-name: diDebris;
          animation-timing-function: cubic-bezier(0.2,0.6,0.6,1);
          animation-fill-mode: both;
          will-change: transform, opacity;
        }
        @keyframes diDebris {
          0%   { opacity: 1; transform: translate3d(0,0,0) rotate(0deg) }
          55%  { opacity: 1; transform: translate3d(var(--dx), var(--dy), 0) rotate(180deg) }
          100% { opacity: 0; transform: translate3d(calc(var(--dx) * 1.25), calc(var(--dy) + 120px), 0) rotate(340deg) }
        }

        /* Brasa incandescente atrás do VS */
        .di-vs-core {
          position: absolute; width: 46vmin; height: 46vmin; border-radius: 9999px;
          animation: diVsCore 900ms ease-out ${T_IMPACT}ms both,
                     diVsCorePulse 1.4s ease-in-out ${T_IMPACT + 900}ms infinite;
          will-change: transform, opacity;
        }
        @keyframes diVsCore {
          0%   { opacity: 0; transform: scale(0.3) }
          40%  { opacity: 1; transform: scale(1.15) }
          100% { opacity: 0.7; transform: scale(1) }
        }
        @keyframes diVsCorePulse {
          0%, 100% { opacity: 0.7; transform: scale(1) }
          50%      { opacity: 0.45; transform: scale(0.94) }
        }

        /* Shine metálico varrendo as placas de nome */

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

        /* ── Transição final: onda de energia azul ── */
        /* Uma muralha de luz varre a tela pra esquerda: crista incandescente,
           corpo profundo com textura de circuito e cauda que se dissipa sobre
           o duelo revelado. Poucas engrenagens-herói na crista — presença,
           não poluição. */

        /* Sucção de luz: pulso azul vindo da direita antes da onda chegar */
        .di-sweep-charge {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 70% 90% at 100% 50%, rgba(56,189,248,0.32), rgba(37,99,235,0.1) 45%, transparent 70%);
          animation: diSweepCharge 520ms ease-out both;
          will-change: opacity;
        }
        @keyframes diSweepCharge {
          0%   { opacity: 0 }
          45%  { opacity: 1 }
          100% { opacity: 0.55 }
        }

        /* Riscos de luz em hipervelocidade — traços puros de energia */

        /* A onda em si: entra em disparada, cobre a tela (reveal) e acelera
           pra fora pela esquerda. Pacing nos percentuais dos keyframes. */
        .di-wave {
          position: absolute; top: -6%; bottom: -6%; left: 0; width: 170vw;
          animation: diWaveSweep ${T_GEAR_TOTAL}ms linear both;
          will-change: transform; backface-visibility: hidden;
        }
        @keyframes diWaveSweep {
          0%   { transform: translate3d(104vw,0,0); animation-timing-function: cubic-bezier(0.16,0.8,0.35,1); }
          41%  { transform: translate3d(-20vw,0,0); animation-timing-function: linear; }
          54%  { transform: translate3d(-27vw,0,0); animation-timing-function: cubic-bezier(0.55,0,0.85,0.35); }
          100% { transform: translate3d(-184vw,0,0); }
        }
        .di-wave-body {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 55% 70% at 22% 42%, rgba(56,189,248,0.16), transparent 70%),
            radial-gradient(ellipse 45% 60% at 62% 72%, rgba(37,99,235,0.14), transparent 70%),
            radial-gradient(ellipse 40% 50% at 86% 24%, rgba(14,116,144,0.18), transparent 70%),
            linear-gradient(to right, rgba(2,8,26,0) 0%, rgba(2,8,26,0.97) 3%, #030b20 8%, #041030 52%, #030b20 94%, rgba(3,11,32,0) 100%);
        }
        /* Textura de circuito: linhas verticais em paralaxe dentro do corpo */
        .di-wave-tex {
          position: absolute; inset: 0; opacity: 0.5;
          background: repeating-linear-gradient(to right, transparent 0 54px, rgba(56,189,248,0.09) 54px 56px);
          -webkit-mask-image: linear-gradient(to right, transparent 2%, #000 10%, #000 92%, transparent 98%);
          mask-image: linear-gradient(to right, transparent 2%, #000 10%, #000 92%, transparent 98%);
          animation: diWaveTex 900ms linear infinite;
          will-change: transform;
        }
        .di-wave-tex-2 {
          opacity: 0.35;
          background: repeating-linear-gradient(to right, transparent 0 26px, rgba(125,211,252,0.07) 26px 27px);
          animation-duration: 500ms;
        }
        @keyframes diWaveTex { from { transform: translate3d(0,0,0) } to { transform: translate3d(56px,0,0) } }
        /* Crista: brilho largo difuso + lâmina incandescente */
        .di-wave-edge {
          position: absolute; top: 0; bottom: 0; left: -110px; width: 200px;
          background: linear-gradient(to left, rgba(56,189,248,0.55), rgba(56,189,248,0.16) 55%, transparent);
          filter: blur(12px);
        }
        .di-wave-edge-core {
          position: absolute; top: 0; bottom: 0; left: -3px; width: 5px; border-radius: 9999px;
          background: linear-gradient(to bottom, rgba(125,211,252,0.3), #e0f2fe 25%, #ffffff 50%, #e0f2fe 75%, rgba(125,211,252,0.3));
          box-shadow: 0 0 26px rgba(125,211,252,0.95), 0 0 70px rgba(56,189,248,0.7);
          animation: diEdgeFlicker 120ms steps(2) infinite;
        }
        @keyframes diEdgeFlicker { 0%, 100% { opacity: 1 } 50% { opacity: 0.82 } }
        /* Cauda: véu azul que escorre sobre o duelo enquanto a onda sai */
        .di-wave-tail {
          position: absolute; top: 0; bottom: 0; right: -60px; width: 180px;
          background: linear-gradient(to right, rgba(56,189,248,0.4), rgba(56,189,248,0.12) 55%, transparent);
          filter: blur(10px);
        }

        /* Engrenagem-herói: cravada na crista, com halo de energia pulsando */
        .di-hero-gear { position: absolute; z-index: 4; }
        .di-hero-gear-halo {
          position: absolute; border-radius: 9999px;
          background: radial-gradient(circle, rgba(56,189,248,0.5), rgba(56,189,248,0.15) 55%, transparent 72%);
          filter: blur(4px);
          animation: diHaloPulse 700ms ease-in-out infinite alternate;
          will-change: transform, opacity;
        }
        @keyframes diHaloPulse {
          from { opacity: 0.65; transform: scale(0.94) }
          to   { opacity: 1; transform: scale(1.05) }
        }

        /* Rotação das engrenagens (duração individual via style) */
        .di-gear-spin {
          animation-name: diGearRot;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          filter: drop-shadow(0 0 14px rgba(56,189,248,0.65));
          will-change: transform;
        }
        .di-gear-spin-rev { animation-direction: reverse; }
        @keyframes diGearRot { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

        /* Clarão no instante em que a onda cobre a tela (reveal do duelo) */
        .di-reveal-flash {
          position: absolute; inset: 0; z-index: 20; opacity: 0;
          background: radial-gradient(circle at 50% 50%, rgba(224,242,254,0.95), rgba(56,189,248,0.5) 42%, transparent 74%);
          animation: diRevealFlash 460ms ease-out ${T_GEAR_COVER - 60}ms both;
          will-change: opacity;
        }
        @keyframes diRevealFlash {
          0%   { opacity: 0 }
          18%  { opacity: 0.9 }
          100% { opacity: 0 }
        }
        /* Névoa azul que se dissipa sobre o duelo já revelado */
        .di-afterglow {
          position: absolute; inset: 0; z-index: 18; opacity: 0;
          background: linear-gradient(to left, rgba(56,189,248,0.22), rgba(56,189,248,0.06) 55%, transparent);
          animation: diAfterglow ${T_GEAR_TOTAL - T_GEAR_COVER}ms ease-out ${T_GEAR_COVER}ms both;
          will-change: opacity;
        }
        @keyframes diAfterglow {
          0%   { opacity: 1 }
          100% { opacity: 0 }
        }
        /* Energia escorrendo pelas bordas da tela no reveal */
        .di-edge-pulse {
          position: absolute; inset: 0; z-index: 19; opacity: 0;
          box-shadow: inset 0 0 120px rgba(56,189,248,0.55), inset 0 0 40px rgba(125,211,252,0.35);
          animation: diEdgePulse 760ms ease-out ${T_GEAR_COVER}ms both;
          will-change: opacity;
        }
        @keyframes diEdgePulse {
          0%   { opacity: 1 }
          100% { opacity: 0 }
        }
        /* Fagulhas derivando sobre o duelo revelado */
        .di-after-spark {
          position: absolute; z-index: 22; border-radius: 9999px; opacity: 0;
          background: #bae6fd;
          box-shadow: 0 0 12px rgba(56,189,248,0.9), 0 0 24px rgba(56,189,248,0.5);
          animation-name: diAfterSpark;
          animation-timing-function: ease-out;
          animation-fill-mode: both;
          will-change: transform, opacity;
        }
        @keyframes diAfterSpark {
          0%   { opacity: 0; transform: translate3d(0,0,0) scale(1) }
          25%  { opacity: 0.95 }
          100% { opacity: 0; transform: translate3d(-48px,-30px,0) scale(0.4) }
        }

        .di-skip-hint { animation: diHint 1.8s ease-in-out 600ms infinite; }
        @keyframes diHint {
          0%, 100% { opacity: 0.35 }
          50%      { opacity: 0.7 }
        }

        @media (prefers-reduced-motion: reduce) {
          .di-shake, .di-master-glow, .di-master-in, .di-bubble-in,
          .di-panel-opp, .di-panel-me,
          .di-ember, .di-orbit, .di-orbit-2, .di-master-breathe,
          .di-speedlines-opp, .di-speedlines-me, .di-cut-spark,
          .di-spark, .di-vs-ghost,
          .di-panel-img, .di-stage-master,
          .di-rays, .di-floor-glow, .di-cut-glow,
          .di-impact-frame, .di-debris, .di-vs-core,
          .di-gear-spin,
          .di-wave-tex, .di-hero-gear-halo, .di-after-spark,
          .di-reveal-flash, .di-edge-pulse, .di-sweep-charge {
            animation: none !important;
          }
          /* Com motion reduzido a onda não varre: apenas cobre e some no fade */
          .di-wave { animation: none !important; transform: translate3d(-20vw,0,0); }
          .di-after-spark { opacity: 0 !important; }
        }
      `}</style>
    </div>
  )
}
