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
// Transição final: cortina de engrenagens varrendo pra esquerda
const T_GEAR_TOTAL = 1700 // duração total da varredura
const T_GEAR_COVER = 700  // momento em que a cortina cobre 100% da tela (revela o duelo por trás)

const GEAR_IMG = "/images/modes/gear-blue.png"

// Engrenagens soltas que riscam a tela em 3 camadas de paralaxe:
// dy = deriva vertical (px) durante o voo · op = opacidade (profundidade)
// 1ª leva = vanguarda (antes da cortina) · 2ª leva = retaguarda (sobre o duelo revelado)
const GEAR_STREAKS = [
  // camada frontal — grandes, rápidas, brilho total
  { top: 6,  s: 52, dl: 0,   t: 540, spin: 800,  dy: 14,  op: 1 },
  { top: 21, s: 64, dl: 110, t: 500, spin: 1000, dy: -10, op: 1 },
  { top: 38, s: 48, dl: 50,  t: 560, spin: 750,  dy: 8,   op: 1 },
  { top: 55, s: 58, dl: 170, t: 520, spin: 900,  dy: -16, op: 1 },
  { top: 70, s: 46, dl: 30,  t: 580, spin: 700,  dy: 12,  op: 1 },
  { top: 84, s: 62, dl: 140, t: 500, spin: 950,  dy: -8,  op: 1 },
  // camada média — tamanho médio, levemente atenuadas
  { top: 12, s: 32, dl: 80,  t: 640, spin: 620,  dy: -18, op: 0.85 },
  { top: 30, s: 36, dl: 210, t: 620, spin: 680,  dy: 10,  op: 0.85 },
  { top: 46, s: 28, dl: 130, t: 660, spin: 560,  dy: -12, op: 0.85 },
  { top: 62, s: 34, dl: 250, t: 620, spin: 640,  dy: 16,  op: 0.85 },
  { top: 77, s: 30, dl: 100, t: 660, spin: 580,  dy: -14, op: 0.85 },
  { top: 92, s: 36, dl: 190, t: 640, spin: 660,  dy: 10,  op: 0.85 },
  // camada de fundo — pequenas, mais lentas, discretas (profundidade)
  { top: 9,  s: 20, dl: 160, t: 760, spin: 500,  dy: 6,   op: 0.55 },
  { top: 27, s: 16, dl: 60,  t: 800, spin: 440,  dy: -8,  op: 0.55 },
  { top: 43, s: 22, dl: 240, t: 740, spin: 520,  dy: 10,  op: 0.55 },
  { top: 59, s: 18, dl: 20,  t: 780, spin: 460,  dy: -6,  op: 0.55 },
  { top: 73, s: 20, dl: 200, t: 760, spin: 480,  dy: 8,   op: 0.55 },
  { top: 88, s: 16, dl: 120, t: 800, spin: 420,  dy: -10, op: 0.55 },
  // onda intermediária — preenche o intervalo enquanto a cortina cobre a tela
  { top: 8,  s: 30, dl: 380, t: 600, spin: 600,  dy: 12,  op: 0.9 },
  { top: 24, s: 24, dl: 440, t: 640, spin: 520,  dy: -14, op: 0.8 },
  { top: 41, s: 38, dl: 400, t: 560, spin: 700,  dy: 8,   op: 0.95 },
  { top: 58, s: 26, dl: 470, t: 620, spin: 540,  dy: -10, op: 0.85 },
  { top: 74, s: 32, dl: 410, t: 580, spin: 640,  dy: 16,  op: 0.9 },
  { top: 90, s: 22, dl: 450, t: 660, spin: 500,  dy: -8,  op: 0.8 },
  // retaguarda — cruzam por cima do duelo já revelado (eco da varredura)
  { top: 14, s: 26, dl: 880, t: 580, spin: 560,  dy: -12, op: 0.9 },
  { top: 33, s: 40, dl: 960, t: 540, spin: 720,  dy: 10,  op: 0.9 },
  { top: 51, s: 22, dl: 920, t: 620, spin: 500,  dy: -8,  op: 0.8 },
  { top: 68, s: 34, dl: 1010, t: 560, spin: 660, dy: 14,  op: 0.9 },
  { top: 83, s: 24, dl: 940, t: 600, spin: 540,  dy: -10, op: 0.8 },
  { top: 27, s: 18, dl: 1080, t: 640, spin: 480, dy: 8,   op: 0.65 },
  { top: 60, s: 20, dl: 1120, t: 620, spin: 460, dy: -12, op: 0.6 },
]

// Poeira de micro engrenagens — enxame denso de partículas minúsculas que dá
// densidade e sensação de velocidade extrema à varredura.
// dy = deriva vertical · op = opacidade · spin = rotação individual (variação
// pra nenhuma partícula parecer clone da vizinha)
const GEAR_DUST = [
  // 1ª rajada — antes da cortina
  { top: 4,  s: 10, dl: 40,  t: 480, dy: 8,   op: 0.5,  spin: 380 },
  { top: 8,  s: 7,  dl: 220, t: 440, dy: -12, op: 0.4,  spin: 300 },
  { top: 11, s: 8,  dl: 190, t: 520, dy: -6,  op: 0.45, spin: 420 },
  { top: 15, s: 12, dl: 60,  t: 460, dy: 14,  op: 0.55, spin: 340 },
  { top: 18, s: 12, dl: 90,  t: 460, dy: 10,  op: 0.5,  spin: 360 },
  { top: 22, s: 7,  dl: 300, t: 500, dy: -16, op: 0.4,  spin: 280 },
  { top: 25, s: 9,  dl: 280, t: 540, dy: -8,  op: 0.45, spin: 400 },
  { top: 29, s: 11, dl: 10,  t: 470, dy: 12,  op: 0.55, spin: 320 },
  { top: 32, s: 11, dl: 140, t: 500, dy: 6,   op: 0.5,  spin: 440 },
  { top: 36, s: 8,  dl: 330, t: 450, dy: -10, op: 0.4,  spin: 300 },
  { top: 40, s: 8,  dl: 20,  t: 560, dy: -14, op: 0.45, spin: 380 },
  { top: 44, s: 13, dl: 250, t: 480, dy: 16,  op: 0.55, spin: 340 },
  { top: 48, s: 13, dl: 230, t: 470, dy: 8,   op: 0.5,  spin: 420 },
  { top: 52, s: 7,  dl: 100, t: 520, dy: -6,  op: 0.4,  spin: 260 },
  { top: 56, s: 9,  dl: 110, t: 530, dy: -12, op: 0.45, spin: 360 },
  { top: 60, s: 12, dl: 350, t: 460, dy: 10,  op: 0.55, spin: 300 },
  { top: 63, s: 11, dl: 320, t: 490, dy: 14,  op: 0.5,  spin: 400 },
  { top: 67, s: 8,  dl: 170, t: 510, dy: -8,  op: 0.4,  spin: 320 },
  { top: 71, s: 8,  dl: 70,  t: 550, dy: -16, op: 0.45, spin: 440 },
  { top: 75, s: 12, dl: 290, t: 470, dy: 6,   op: 0.55, spin: 340 },
  { top: 78, s: 12, dl: 260, t: 480, dy: 12,  op: 0.5,  spin: 380 },
  { top: 82, s: 7,  dl: 130, t: 500, dy: -10, op: 0.4,  spin: 280 },
  { top: 86, s: 10, dl: 160, t: 520, dy: -6,  op: 0.45, spin: 360 },
  { top: 90, s: 12, dl: 30,  t: 490, dy: 14,  op: 0.55, spin: 420 },
  { top: 93, s: 9,  dl: 340, t: 500, dy: 8,   op: 0.5,  spin: 300 },
  { top: 97, s: 8,  dl: 200, t: 460, dy: -12, op: 0.4,  spin: 340 },
  // 2ª rajada — junto da onda intermediária
  { top: 6,  s: 9,  dl: 480, t: 500, dy: 10,  op: 0.5,  spin: 360 },
  { top: 34, s: 11, dl: 520, t: 470, dy: -14, op: 0.55, spin: 400 },
  { top: 54, s: 8,  dl: 500, t: 530, dy: 8,   op: 0.45, spin: 300 },
  { top: 80, s: 10, dl: 540, t: 490, dy: -10, op: 0.5,  spin: 340 },
  // 3ª rajada — eco sobre o duelo revelado
  { top: 10, s: 8,  dl: 900, t: 500, dy: -8,  op: 0.45, spin: 320 },
  { top: 24, s: 10, dl: 960, t: 470, dy: 12,  op: 0.5,  spin: 380 },
  { top: 44, s: 10, dl: 930, t: 480, dy: -14, op: 0.5,  spin: 420 },
  { top: 58, s: 7,  dl: 1020, t: 520, dy: 8,  op: 0.4,  spin: 280 },
  { top: 72, s: 9,  dl: 950, t: 510, dy: -6,  op: 0.45, spin: 360 },
  { top: 88, s: 11, dl: 990, t: 490, dy: 10,  op: 0.5,  spin: 340 },
]

// Faíscas cuspidas pela borda de ataque da cortina (relativas à borda esquerda)
// a = ângulo do jato em graus · d = alcance px · dl = delay ms
const EDGE_SPARKS = [
  { top: 8,  a: 168, d: 150, dl: 60,  t: 420 },
  { top: 19, a: 187, d: 190, dl: 140, t: 460 },
  { top: 31, a: 172, d: 130, dl: 30,  t: 400 },
  { top: 43, a: 193, d: 170, dl: 190, t: 440 },
  { top: 55, a: 178, d: 200, dl: 90,  t: 480 },
  { top: 67, a: 165, d: 140, dl: 240, t: 420 },
  { top: 79, a: 190, d: 180, dl: 120, t: 460 },
  { top: 91, a: 174, d: 155, dl: 200, t: 430 },
]

// Engrenagens grandes cravadas nas bordas da cortina (metade pra fora)
const CURTAIN_EDGE_GEARS = [
  { top: -3, s: 120, spin: 2600, rev: false },
  { top: 9,  s: 72,  spin: 1800, rev: true  },
  { top: 20, s: 96,  spin: 2200, rev: false },
  { top: 33, s: 60,  spin: 1500, rev: true  },
  { top: 42, s: 112, spin: 2400, rev: false },
  { top: 57, s: 68,  spin: 1700, rev: true  },
  { top: 67, s: 100, spin: 2300, rev: false },
  { top: 81, s: 64,  spin: 1600, rev: true  },
  { top: 89, s: 118, spin: 2700, rev: false },
]

// Colunas internas de engrenagens menores (profundidade dentro da cortina)
const CURTAIN_INNER_GEARS = [
  { top: 5,  s: 46, x: 96,  spin: 1400, rev: true  },
  { top: 16, s: 30, x: 210, spin: 1100, rev: false },
  { top: 28, s: 58, x: 150, spin: 1900, rev: false },
  { top: 39, s: 26, x: 250, spin: 1000, rev: true  },
  { top: 50, s: 42, x: 88,  spin: 1300, rev: true  },
  { top: 61, s: 32, x: 220, spin: 1150, rev: false },
  { top: 72, s: 54, x: 160, spin: 1800, rev: false },
  { top: 83, s: 28, x: 240, spin: 1050, rev: true  },
  { top: 92, s: 44, x: 104, spin: 1500, rev: true  },
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
    // Durante a varredura de engrenagens o duelo já está sendo revelado —
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

    // Fim do choque → cortina de engrenagens varre a tela pra esquerda.
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

          {/* Barras do corte diagonal com energia dos dois lados */}
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

          {/* Energia incandescente pulsando na zona do choque */}
          <div
            className="di-cut-glow"
            aria-hidden="true"
            style={{ background: `linear-gradient(to right, ${accent}30, rgba(255,255,255,0.22) 50%, ${oppAccent}30)` }}
          />

          {/* Faísca correndo na linha de corte */}
          <div className="di-cut-spark" aria-hidden="true" />

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
              <span className="di-shine di-shine-opp" aria-hidden="true" />
              <img
                src={opponent.icon || "/images/gp-cg-logo.png"}
                alt={opponent.name}
                className="relative w-14 h-14 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
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
              <span className="di-shine di-shine-me" aria-hidden="true" />
            </div>
          </div>

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

      {/* ── TRANSIÇÃO FINAL: cortina de engrenagens varrendo pra esquerda ──── */}
      {phase === "gears" && (
        <div className="absolute inset-0 z-[60] pointer-events-none" aria-hidden="true">
          {/* Flash de revelação: pulso ciano no instante em que a cortina cobre */}
          <div className="di-gear-flash" style={{ animationDelay: `${T_GEAR_COVER - 80}ms` }} />

          {/* Onda de pressão: feixe vertical que precede a cortina */}
          <div className="di-gear-pressure" />

          {/* Feixe de luz residual varrendo a tela após a revelação */}
          <div className="di-gear-afterbeam" style={{ animationDelay: `${T_GEAR_COVER + 120}ms` }} />

          {/* Poeira de micro engrenagens (enxame de fundo) */}
          {GEAR_DUST.map((g, idx) => (
            <div
              key={`dust-${idx}`}
              className="di-gear-dust"
              style={{
                top: `${g.top}%`,
                animationDelay: `${g.dl}ms`,
                animationDuration: `${g.t}ms`,
                ["--dy" as string]: `${g.dy}px`,
                ["--op" as string]: g.op,
              }}
            >
              <img
                src={GEAR_IMG || "/placeholder.svg"}
                alt=""
                className={`di-gear-spin${idx % 2 ? " di-gear-spin-rev" : ""}`}
                style={{ width: `${g.s}px`, height: `${g.s}px`, animationDuration: `${g.spin}ms` }}
                draggable={false}
              />
            </div>
          ))}

          {/* Vanguarda + retaguarda: engrenagens soltas riscando a tela */}
          {GEAR_STREAKS.map((g, idx) => (
            <div
              key={idx}
              className="di-gear-streak"
              style={{
                top: `${g.top}%`,
                opacity: g.op,
                animationDelay: `${g.dl}ms`,
                animationDuration: `${g.t}ms`,
                ["--dy" as string]: `${g.dy}px`,
                ["--op" as string]: g.op,
              }}
            >
              <span className="di-gear-trail" style={{ width: `${g.s * 4.2}px` }} />
              <span className="di-gear-trail-core" style={{ width: `${g.s * 2.2}px` }} />
              <span className="di-gear-blur" style={{ width: `${g.s}px`, height: `${g.s}px` }}>
                <img
                  src={GEAR_IMG || "/placeholder.svg"}
                  alt=""
                  className={`di-gear-spin${idx % 2 ? " di-gear-spin-rev" : ""}`}
                  style={{ width: "100%", height: "100%", animationDuration: `${g.spin}ms` }}
                  draggable={false}
                />
              </span>
            </div>
          ))}

          {/* Cortina de máquina: corpo metálico com engrenagens nas bordas */}
          <div className="di-gear-curtain">
            <div className="di-gear-curtain-body" />
            <div className="di-gear-curtain-lines" />
            <div className="di-gear-curtain-plates" />
            <div className="di-gear-edge di-gear-edge-l" />
            <div className="di-gear-edge di-gear-edge-r" />

            {/* Faíscas cuspidas pela borda de ataque (atrito de máquina) */}
            {EDGE_SPARKS.map((s, idx) => (
              <span
                key={`spark-${idx}`}
                className="di-edge-spark"
                style={{
                  top: `${s.top}%`,
                  transform: `rotate(${s.a}deg)`,
                  animationDelay: `${s.dl}ms`,
                  animationDuration: `${s.t}ms`,
                  ["--spark-d" as string]: `${s.d}px`,
                }}
              />
            ))}

            {/* Coluna interna (profundidade) */}
            {CURTAIN_INNER_GEARS.map((g, idx) => (
              <img
                key={`in-${idx}`}
                src={GEAR_IMG || "/placeholder.svg"}
                alt=""
                className={`di-gear-spin di-gear-dim${g.rev ? " di-gear-spin-rev" : ""}`}
                style={{
                  position: "absolute",
                  top: `${g.top}%`,
                  left: `${g.x}px`,
                  width: `${g.s}px`,
                  height: `${g.s}px`,
                  animationDuration: `${g.spin}ms`,
                }}
                draggable={false}
              />
            ))}

            {/* Borda de ataque (esquerda): engrenagens grandes meio pra fora */}
            {CURTAIN_EDGE_GEARS.map((g, idx) => (
              <img
                key={`l-${idx}`}
                src={GEAR_IMG || "/placeholder.svg"}
                alt=""
                className={`di-gear-spin${g.rev ? " di-gear-spin-rev" : ""}`}
                style={{
                  position: "absolute",
                  top: `${g.top}%`,
                  left: `${-g.s / 2}px`,
                  width: `${g.s}px`,
                  height: `${g.s}px`,
                  animationDuration: `${g.spin}ms`,
                }}
                draggable={false}
              />
            ))}

            {/* Borda de fuga (direita): espelhada, gira ao contrário */}
            {CURTAIN_EDGE_GEARS.map((g, idx) => (
              <img
                key={`r-${idx}`}
                src={GEAR_IMG || "/placeholder.svg"}
                alt=""
                className={`di-gear-spin${g.rev ? "" : " di-gear-spin-rev"}`}
                style={{
                  position: "absolute",
                  top: `${g.top}%`,
                  right: `${-g.s / 2}px`,
                  width: `${g.s}px`,
                  height: `${g.s}px`,
                  animationDuration: `${g.spin}ms`,
                }}
                draggable={false}
              />
            ))}
          </div>
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
        .di-shine {
          position: absolute; inset: -6px; pointer-events: none; z-index: 5;
          background: linear-gradient(110deg, transparent 42%, rgba(255,255,255,0.55) 50%, transparent 58%);
          background-size: 260% 100%; background-position: 130% 0;
          animation: diShine 750ms ease-in-out both;
          will-change: background-position;
        }
        .di-shine-opp { animation-delay: ${T_IMPACT + 620}ms; }
        .di-shine-me  { animation-delay: ${T_IMPACT + 760}ms; }
        @keyframes diShine {
          from { background-position: 130% 0 }
          to   { background-position: -30% 0 }
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

        /* ── Transição final: cortina de engrenagens ── */
        /* A cortina entra em disparada pela direita, "morde" a tela inteira
           (momento em que o duelo é revelado por trás) e acelera pra fora
           pela esquerda. Pacing controlado pelos percentuais dos keyframes. */
        .di-gear-curtain {
          position: absolute; top: -8%; bottom: -8%; left: 0; width: 165vw;
          animation: diGearSweep ${T_GEAR_TOTAL}ms linear both;
          will-change: transform; backface-visibility: hidden;
        }
        /* Entrada em disparada com leve inclinação de velocidade, mordida com
           micro-creep (peso da máquina) e saída explosiva endireitando */
        @keyframes diGearSweep {
          0%   { transform: translate3d(104vw,0,0) skewX(-3deg); animation-timing-function: cubic-bezier(0.16,0.8,0.35,1); }
          41%  { transform: translate3d(-10vw,0,0) skewX(0deg); animation-timing-function: linear; }
          54%  { transform: translate3d(-16vw,0,0) skewX(0deg); animation-timing-function: cubic-bezier(0.55,0,0.85,0.35); }
          100% { transform: translate3d(-180vw,0,0) skewX(3deg); }
        }
        .di-gear-curtain-body {
          position: absolute; inset: 0;
          background: linear-gradient(to right,
            #071022 0%, #0a1730 8%, #060b1c 30%, #081226 55%, #0a1730 82%, #071022 100%);
          box-shadow: 0 0 80px rgba(0,0,0,0.9);
        }
        /* Placas metálicas diagonais: quebra a monotonia do corpo da cortina */
        .di-gear-curtain-plates {
          position: absolute; inset: 0; opacity: 0.35;
          background:
            repeating-linear-gradient(115deg,
              transparent 0px, transparent 140px,
              rgba(125,211,252,0.06) 140px, rgba(125,211,252,0.06) 143px,
              rgba(2,6,18,0.55) 143px, rgba(2,6,18,0.55) 150px),
            repeating-linear-gradient(to bottom,
              transparent 0px, transparent 120px,
              rgba(148,163,184,0.07) 120px, rgba(148,163,184,0.07) 122px);
        }
        /* Estrias de velocidade sutis dentro do corpo da cortina */
        .di-gear-curtain-lines {
          position: absolute; inset: 0; opacity: 0.14;
          background: repeating-linear-gradient(
            to right,
            transparent 0px, transparent 54px,
            rgba(56,189,248,0.5) 54px, rgba(56,189,248,0.5) 56px
          );
        }
        /* Bordas incandescentes da cortina */
        .di-gear-edge {
          position: absolute; top: 0; bottom: 0; width: 4px;
          background: linear-gradient(to bottom, #38bdf8, #7dd3fc, #38bdf8);
          box-shadow: 0 0 24px rgba(56,189,248,0.9), 0 0 60px rgba(56,189,248,0.45);
        }
        .di-gear-edge-l { left: 0; }
        .di-gear-edge-r { right: 0; }

        /* Onda de pressão: feixe vertical difuso que corre à frente da cortina,
           como o deslocamento de ar de um trem passando */
        .di-gear-pressure {
          position: absolute; top: -8%; bottom: -8%; left: 0; width: 30vw;
          z-index: 4; pointer-events: none;
          background: linear-gradient(to right,
            transparent, rgba(56,189,248,0.07) 40%, rgba(125,211,252,0.16) 78%, rgba(186,230,253,0.28));
          animation: diGearPressure ${Math.round(T_GEAR_COVER * 1.06)}ms cubic-bezier(0.16,0.8,0.35,1) both;
          will-change: transform, opacity;
        }
        @keyframes diGearPressure {
          0%   { opacity: 0; transform: translate3d(110vw,0,0) }
          12%  { opacity: 1 }
          85%  { opacity: 1 }
          100% { opacity: 0; transform: translate3d(-32vw,0,0) }
        }

        /* Feixe residual: lâmina de luz fina que cruza o duelo já revelado,
           "assinando" a transição sem cobrir a gameplay */
        .di-gear-afterbeam {
          position: absolute; top: -8%; bottom: -8%; left: 0; width: 10vw;
          z-index: 7; pointer-events: none; opacity: 0;
          background: linear-gradient(to right,
            transparent, rgba(186,230,253,0.14) 45%, rgba(224,242,254,0.3) 62%, rgba(56,189,248,0.1) 80%, transparent);
          animation: diGearAfterbeam 620ms cubic-bezier(0.5,0,0.4,1) both;
          will-change: transform, opacity;
        }
        @keyframes diGearAfterbeam {
          0%   { opacity: 0; transform: translate3d(108vw,0,0) }
          14%  { opacity: 0.9 }
          80%  { opacity: 0.9 }
          100% { opacity: 0; transform: translate3d(-14vw,0,0) }
        }

        /* Faíscas cuspidas pela borda de ataque da cortina */
        .di-edge-spark {
          position: absolute; left: -4px; width: 30px; height: 2.5px;
          border-radius: 9999px; z-index: 6; opacity: 0;
          background: linear-gradient(to right, rgba(224,242,254,0.95), rgba(56,189,248,0.5));
          box-shadow: 0 0 12px rgba(125,211,252,0.8);
          transform-origin: left center;
          animation-name: diEdgeSpark;
          animation-timing-function: cubic-bezier(0.2,0.7,0.3,1);
          animation-fill-mode: both;
          animation-iteration-count: 2;
          will-change: transform, opacity;
        }
        @keyframes diEdgeSpark {
          0%   { opacity: 1; translate: 0 0; scale: 1 1 }
          100% { opacity: 0; translate: calc(var(--spark-d) * -1) 0; scale: 0.15 1 }
        }

        /* Rotação das engrenagens (duração individual via style) */
        .di-gear-spin {
          animation-name: diGearRot;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          filter: drop-shadow(0 0 10px rgba(56,189,248,0.55));
          will-change: transform;
        }
        .di-gear-spin-rev { animation-direction: reverse; }
        .di-gear-dim { opacity: 0.38; filter: drop-shadow(0 0 6px rgba(56,189,248,0.3)); }
        @keyframes diGearRot { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

        /* Flash de revelação no instante em que a cortina cobre a tela */
        .di-gear-flash {
          position: absolute; inset: 0; z-index: 8; opacity: 0;
          background: radial-gradient(ellipse at center, rgba(186,230,253,0.5), rgba(56,189,248,0.18) 45%, transparent 75%);
          animation: diGearFlash 260ms ease-out both;
          will-change: opacity;
        }
        @keyframes diGearFlash {
          0% { opacity: 0 } 30% { opacity: 1 } 100% { opacity: 0 }
        }

        /* Engrenagens soltas cruzando a tela em disparada (com rastro de luz).
           --dy = deriva vertical durante o voo · --op = opacidade da camada */
        .di-gear-streak {
          position: absolute; left: 0; z-index: 5;
          display: flex; align-items: center;
          transform: translate3d(110vw,0,0); opacity: 0;
          animation-name: diGearStreak;
          animation-timing-function: cubic-bezier(0.3,0,0.6,1);
          animation-fill-mode: both;
          will-change: transform, opacity;
        }
        @keyframes diGearStreak {
          0%   { opacity: 0; transform: translate3d(112vw, 0, 0) }
          8%   { opacity: var(--op, 1) }
          88%  { opacity: var(--op, 1) }
          100% { opacity: 0; transform: translate3d(-38vw, var(--dy, 0px), 0) }
        }
        /* Esmagamento horizontal sutil = motion blur barato e convincente */
        .di-gear-blur {
          position: relative; z-index: 2; display: block;
          transform: scaleX(1.18);
        }
        /* Rastro duplo: banda larga difusa + núcleo fino brilhante */
        .di-gear-trail {
          position: absolute; left: 50%; top: 50%; height: 42%;
          max-height: 26px; min-height: 8px;
          transform: translateY(-50%); border-radius: 9999px;
          background: linear-gradient(to right, rgba(56,189,248,0.28), rgba(56,189,248,0.1) 60%, transparent);
          filter: blur(3px);
        }
        .di-gear-trail-core {
          position: absolute; left: 55%; top: 50%; height: 3px;
          transform: translateY(-50%); border-radius: 9999px;
          background: linear-gradient(to right, rgba(224,242,254,0.95), rgba(56,189,248,0.4) 55%, transparent);
          box-shadow: 0 0 14px rgba(56,189,248,0.7);
        }

        /* Poeira de micro engrenagens: enxame minúsculo, atenuado e veloz */
        .di-gear-dust {
          position: absolute; left: 0; z-index: 3;
          transform: translate3d(112vw,0,0); opacity: 0;
          animation-name: diGearDust;
          animation-timing-function: linear;
          animation-fill-mode: both;
          will-change: transform, opacity;
        }
        .di-gear-dust img { filter: drop-shadow(0 0 4px rgba(56,189,248,0.5)); }
        @keyframes diGearDust {
          0%   { opacity: 0; transform: translate3d(112vw,0,0) }
          10%  { opacity: var(--op, 0.45) }
          85%  { opacity: var(--op, 0.45) }
          100% { opacity: 0; transform: translate3d(-30vw, var(--dy, 0px), 0) }
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
          .di-impact-frame, .di-debris, .di-vs-core, .di-shine,
            .di-gear-spin, .di-gear-streak, .di-gear-dust, .di-gear-flash,
          .di-gear-pressure, .di-gear-afterbeam, .di-edge-spark {
            animation: none !important;
          }
          /* Com motion reduzido a cortina não varre: apenas cobre e some no fade */
          .di-gear-curtain { animation: none !important; transform: translate3d(-16vw,0,0); }
          .di-gear-streak, .di-gear-dust, .di-gear-flash,
          .di-gear-pressure, .di-gear-afterbeam, .di-edge-spark { opacity: 0 !important; }
        }
      `}</style>
    </div>
  )
}
