"use client"

/**
 * tutorial-screen.tsx — Gear Perks Card Game
 *
 * Dois componentes exportados:
 *  • TutorialScreen (default) — fases standalone: Lore + Seleção de Mestre
 *  • TutorialGameOverlay (named) — overlay sobre as telas REAIS: Menu, Duelo, Gacha
 *
 * Fluxo: TitleScreen → TutorialScreen → (game-wrapper navega p/ MainMenu) → TutorialGameOverlay
 */

import { useState, useEffect, useRef, useCallback } from "react"

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TutorialMasterId = "fehnon" | "morgana" | "calem"
type OverlayPhase = "menu" | "duel" | "gacha"

export interface TutorialScreenProps {
  playerName: string
  /** Chamado quando Mestre foi escolhido — game-wrapper então inicia o overlay */
  onComplete: (selectedMasterId: TutorialMasterId) => void
}

export interface TutorialGameOverlayProps {
  masterId: TutorialMasterId
  /** game-wrapper navega para a tela certa */
  onNavigate: (screen: "menu" | "duel-bot" | "gacha") => void
  /** Chamado quando TODO o tutorial (overlay) é concluído */
  onComplete: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER CONFIG  (art path = /images/masters/ conforme main-menu.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

const MASTERS: Record<TutorialMasterId, {
  name: string; color: string; bgGlow: string; shadowGlow: string
  art: string; deckName: string; element: string; deckDesc: string
}> = {
  fehnon: {
    name: "Fehnon Hoskie", color: "#38bdf8",
    bgGlow: "rgba(56,189,248,0.13)", shadowGlow: "rgba(56,189,248,0.55)",
    art: "/images/masters/fehnon-art.png",
    deckName: "Deck Aquos", element: "AQUOS",
    deckDesc: "Ataques poderosos e Combos intensos, domine o campo com Fehnon e seu poder de Ultimate Gear, a Protonix Sword!",
  },
  morgana: {
    name: "Morgana Pendragon", color: "#a855f7",
    bgGlow: "rgba(168,85,247,0.13)", shadowGlow: "rgba(168,85,247,0.55)",
    art: "/images/masters/morgana-art.png",
    deckName: "Deck Darkness", element: "DARKNESS",
    deckDesc: "Sombras Agressivas! Alto poder em efeitos devastadores com a Ultimate Gear Twilight Avalon!",
  },
  calem: {
    name: "Calem Hidenori", color: "#94a3b8",
    bgGlow: "rgba(148,163,184,0.12)", shadowGlow: "rgba(148,163,184,0.45)",
    art: "/images/masters/calem-art.png",
    deckName: "Deck Neutro", element: "VOID",
    deckDesc: "Versátil e equilibrado — perfeito para aprender todas as estratégias do jogo.",
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// LORE SLIDES  (breves + humanizados)
// ═══════════════════════════════════════════════════════════════════════════════

interface LoreSlide {
  bg: string; speakerName: string; speakerColor: string; text: string
  leftChar?: TutorialMasterId | null; rightChar?: TutorialMasterId | null
  isNarrator?: boolean; tag?: string
}

function buildLoreSlides(playerName: string): LoreSlide[] {
  const pn = playerName || "Viajante"
  return [
    {
      bg: "radial-gradient(ellipse at 50% 30%, #0a1628 0%, #020307 100%)",
      speakerName: "Narrador", speakerColor: "#fbbf24", isNarrator: true,
      tag: "A Grande Ordem",
      text: "Em um lugar distante no mundo, três jovens seguiam suas vidas juntos, deixando o destino os levar...",
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "???", speakerColor: "#94a3b8",
      tag: "Mundo — sob os céus abertos",
      text: "Para onde iremos agora?",
      leftChar: "calem",
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "???", speakerColor: "#38bdf8",
      text: "Temos que deixar o destino nos levar.",
      leftChar: "fehnon",
    },
    {
      bg: "linear-gradient(160deg, #0d0520 0%, #1a0838 60%, #0d0520 100%)",
      speakerName: "???", speakerColor: "#a855f7",
      text: "Mas de qualquer forma, nós vamos seguir juntos! Somos a Grande Ordem, lembra? O destino sempre nos guiará.",
      leftChar: "calem", rightChar: "morgana",
    },
    {
      bg: "radial-gradient(ellipse at 50% 80%, #0b1428 0%, #020307 100%)",
      speakerName: "???", speakerColor: "#94a3b8",
      text: "ESPERA! Tem alguém CAINDO do céu ali! Precisamos ir AGORA!",
      leftChar: "calem", rightChar: "fehnon",
    },
    {
      bg: "radial-gradient(ellipse at 50% 50%, #080a10 0%, #010203 100%)",
      speakerName: pn, speakerColor: "#e2e8f0",
      text: "O que?... Onde... Onde estou?...",
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "Fehnon Hoskie", speakerColor: "#38bdf8",
      text: `Ufa, você acordou! Eu sou Fehnon Hoskie. Ela é Morgana, e ele é Calem Hidenori. Bem-vindo(a), ${pn}!`,
      leftChar: "fehnon", rightChar: "morgana",
    },
    {
      bg: "radial-gradient(ellipse at 50% 50%, #080a10 0%, #010203 100%)",
      speakerName: pn, speakerColor: "#e2e8f0",
      text: "Eu... não me lembro de nada. É como se tivesse batido a cabeça.",
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "Fehnon Hoskie", speakerColor: "#38bdf8",
      text: "Este mundo é perigoso. Aqui alguns possuem poderes chamados Ultimates — cada um escolhe usá-los para o bem ou para o mal. Mas você não estará sozinho(a).",
      leftChar: "fehnon",
    },
    {
      bg: "linear-gradient(160deg, #0d0520 0%, #1a0838 60%, #0d0520 100%)",
      speakerName: "Fehnon Hoskie", speakerColor: "#38bdf8",
      text: "Venha conosco nessa jornada! E se quiser aprender sobre as Ultimates... escolha um de nós para ser seu Mestre de Jornada.",
      leftChar: "fehnon", rightChar: "morgana",
    },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERLAY TUTORIAL STEPS  (texto do balão sobre as telas REAIS)
// ═══════════════════════════════════════════════════════════════════════════════

const MENU_STEPS = [
  { text: "Este é o botão JOGAR! Aqui você escolhe o modo de batalha e entra em combate com o seu deck!",
    region: { left: 2, top: 27, w: 32, h: 31 } },
  { text: "Em COLEÇÃO você pode ver, organizar e gerenciar todas as cartas que você possui.",
    region: { left: 2, top: 60, w: 17, h: 9 } },
  { text: "E o GACHA! Aqui você abre packs para conseguir novas cartas poderosas. Logo te mostro como funciona!",
    region: { left: 19, top: 60, w: 16, h: 9 } },
  { text: "Esses botões te dão acesso ao Deck, Missões, Loja, Histórico e muito mais! Agora... vamos ao seu primeiro duelo!",
    region: { left: 95, top: 21, w: 5, h: 73 } },
]

const DUEL_STEPS = [
  { text: "Bem-vindo ao campo de batalha! Fique de olho nos LPs — quem chegar a zero perde o duelo.",
    region: null },
  { text: "Estas são as cartas da sua mão. Arraste uma carta de Unidade para o campo e coloque-a em jogo!",
    region: { left: 34, top: 83, w: 45, h: 13 } },
  { text: "Este é o TAP! A cada 3 turnos do jogador, uma carta extra aparece aqui — de graça. Não esqueça de pegar!",
    region: { left: 27, top: 12, w: 9, h: 24 } },
  { text: "Sua Unidade está em campo! Selecione-a para iniciar um ataque contra uma carta do oponente.",
    region: { left: 3, top: 47, w: 68, h: 33 } },
  { text: "Clique em IR PARA BATALHA! Destrua as cartas inimigas e ataque diretamente para vencer o duelo!",
    region: { left: 79, top: 73, w: 15, h: 9 } },
  { text: "INCRÍVEL! Você venceu seu primeiro duelo! Quanto mais você joga, mais forte e experiente você fica.",
    region: null },
]

const GACHA_STEPS = [
  { text: "Hora da recompensa! Este pack é especial — é de graça só porque é seu primeiro dia aqui. Vamos abrir!",
    region: { left: 22, top: 14, w: 56, h: 46 } },
  { text: "Clique para abrir! Quem sabe que cartas raras vão aparecer para você...",
    region: { left: 38, top: 62, w: 22, h: 11 } },
  { text: "Parabéns! Você ganhou suas primeiras cartas! Continue jogando duelos e abrindo packs para montar um deck invencível!",
    region: null },
]

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: TYPEWRITER (digita letra por letra)
// ═══════════════════════════════════════════════════════════════════════════════

function useTypewriter(text: string, speedMs = 28) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)
  const textRef = useRef(text)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    indexRef.current = 0
    textRef.current = text

    const interval = setInterval(() => {
      indexRef.current += 1
      setDisplayed(textRef.current.slice(0, indexRef.current))
      if (indexRef.current >= textRef.current.length) {
        setDone(true)
        clearInterval(interval)
      }
    }, speedMs)

    return () => clearInterval(interval)
  }, [text, speedMs])

  /** Pula direto para o texto completo */
  const skip = useCallback(() => {
    indexRef.current = textRef.current.length
    setDisplayed(textRef.current)
    setDone(true)
  }, [])

  return { displayed, done, skip }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: TUTORIAL AUDIO (fade in/out)
// ═══════════════════════════════════════════════════════════════════════════════

function useTutorialAudio(src: string, volume = 0.5) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = 0
    audioRef.current = audio

    // Fade in
    audio.play().catch(() => {})
    let vol = 0
    const fadeIn = setInterval(() => {
      vol = Math.min(volume, vol + 0.02)
      audio.volume = vol
      if (vol >= volume) clearInterval(fadeIn)
    }, 60)

    return () => {
      clearInterval(fadeIn)
      // Fade out
      let v = audio.volume
      const fadeOut = setInterval(() => {
        v = Math.max(0, v - 0.03)
        audio.volume = v
        if (v <= 0) { audio.pause(); clearInterval(fadeOut) }
      }, 40)
    }
  }, [src, volume])
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: MASTER BUBBLE (balão de fala branco — fiel ao in-game)
// ═══════════════════════════════════════════════════════════════════════════════

function MasterBubble({ masterId, text, onNext, nextLabel = "Continuar ►" }: {
  masterId: TutorialMasterId; text: string; onNext: () => void; nextLabel?: string
}) {
  const m = MASTERS[masterId]
  return (
    <div style={{
      position: "fixed", bottom: 0, right: 0,
      display: "flex", flexDirection: "column", alignItems: "flex-end",
      zIndex: 600, pointerEvents: "none",
      width: "clamp(240px, 27vw, 370px)",
    }}>
      {/* Balão */}
      <div style={{
        position: "relative", background: "white", borderRadius: 14,
        padding: "14px 16px",
        marginRight: 88, marginBottom: 10,
        width: "calc(100% - 98px)",
        boxShadow: `0 6px 30px rgba(0,0,0,0.55), 0 0 0 2px ${m.color}35`,
        pointerEvents: "all",
      }}>
        {/* Sombra da cauda */}
        <div style={{
          position: "absolute", bottom: -17, right: 28,
          borderLeft: "16px solid transparent", borderRight: "16px solid transparent",
          borderTop: `17px solid ${m.color}30`, zIndex: -1,
        }} />
        {/* Cauda branca */}
        <div style={{
          position: "absolute", bottom: -13, right: 30,
          borderLeft: "14px solid transparent", borderRight: "14px solid transparent",
          borderTop: "14px solid white",
        }} />
        <div style={{
          fontSize: 10, fontWeight: 800, color: m.color,
          fontFamily: "'Segoe UI', sans-serif",
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
        }}>
          {m.name}
        </div>
        <p style={{
          fontFamily: "'Segoe UI', sans-serif",
          fontSize: "clamp(12px, 1.25vw, 14px)",
          color: "#1e293b", lineHeight: 1.6, margin: "0 0 12px", fontWeight: 500,
        }}>
          {text}
        </p>
        <button onClick={onNext} style={{
          display: "block", marginLeft: "auto",
          background: m.color, color: "white", border: "none",
          borderRadius: 8, padding: "6px 16px",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          letterSpacing: "0.04em", fontFamily: "'Segoe UI', sans-serif",
          boxShadow: `0 2px 10px ${m.shadowGlow}`,
        }}>
          {nextLabel}
        </button>
      </div>
      {/* Arte do Mestre */}
      <img src={m.art} alt={m.name} style={{
        width: 94, height: 158,
        objectFit: "contain", objectPosition: "bottom center",
        filter: `drop-shadow(0 0 22px ${m.shadowGlow})`,
        flexShrink: 0,
      }} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: REGION SPOTLIGHT (spotlight baseado em coordenadas % da tela)
// ═══════════════════════════════════════════════════════════════════════════════

function RegionSpotlight({ region }: {
  region: { left: number; top: number; w: number; h: number } | null
}) {
  const pad = 1 // % de padding ao redor da região

  if (!region) return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.5)", zIndex: 400, pointerEvents: "none",
    }} />
  )

  const { left, top, w, h } = region
  const x = `${left - pad}%`
  const y = `${top - pad}%`
  const rw = `${w + pad * 2}%`
  const rh = `${h + pad * 2}%`

  return (
    <svg style={{
      position: "fixed", inset: 0,
      width: "100%", height: "100%",
      zIndex: 400, pointerEvents: "none", overflow: "visible",
    }}>
      <defs>
        <mask id="reg-spl">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={rw} height={rh} rx="12" fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#reg-spl)" />
      {/* Anel pulsante */}
      <rect x={`calc(${x} - 2px)`} y={`calc(${y} - 2px)`}
        width={`calc(${rw} + 4px)`} height={`calc(${rh} + 4px)`}
        rx="13" fill="none"
        stroke="rgba(255,255,255,0.6)" strokeWidth="2.5"
        style={{ animation: "tutRingPulse 1.6s ease-in-out infinite" }}
      />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: LORE PHASE
// ═══════════════════════════════════════════════════════════════════════════════

function LorePhase({ slides, currentSlide, onAdvance, onSkip }: {
  slides: LoreSlide[]; currentSlide: number; onAdvance: () => void; onSkip: () => void
}) {
  const slide = slides[currentSlide]
  const { displayed, done, skip } = useTypewriter(slide.text, 28)
  useTutorialAudio("/audio/Solidificação.mp3", 0.45)

  const isLast = currentSlide === slides.length - 1

  const handleClick = () => {
    if (!done) { skip(); return }
    onAdvance()
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: slide.bg,
      cursor: "pointer", userSelect: "none",
      transition: "background 0.65s ease",
    }} onClick={handleClick}>
      {/* Fundo estrelado */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage:
          "radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.65) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 75% 14%, rgba(255,255,255,0.5) 0%, transparent 100%)," +
          "radial-gradient(1.5px 1.5px at 48% 62%, rgba(255,255,255,0.55) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 91% 73%, rgba(255,255,255,0.45) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 28% 88%, rgba(255,255,255,0.35) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 62% 38%, rgba(255,255,255,0.5) 0%, transparent 100%)," +
          "radial-gradient(1px 1px at 38% 5%, rgba(255,255,255,0.4) 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Sprite esquerdo */}
      {slide.leftChar && (
        <div key={`L${currentSlide}`} style={{
          position: "absolute", left: 0, bottom: 128,
          height: "clamp(270px, 57vh, 500px)",
          animation: "tutSlideLeft 0.4s ease both", pointerEvents: "none",
        }}>
          <img src={MASTERS[slide.leftChar].art} alt="" style={{
            height: "100%", objectFit: "contain", objectPosition: "bottom",
            filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.75))",
          }} />
        </div>
      )}

      {/* Sprite direito (espelhado) */}
      {slide.rightChar && (
        <div key={`R${currentSlide}`} style={{
          position: "absolute", right: 0, bottom: 128,
          height: "clamp(270px, 57vh, 500px)",
          transform: "scaleX(-1)",
          animation: "tutSlideRight 0.4s ease both", pointerEvents: "none",
        }}>
          <img src={MASTERS[slide.rightChar].art} alt="" style={{
            height: "100%", objectFit: "contain", objectPosition: "bottom",
            filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.75))",
          }} />
        </div>
      )}

      {/* Tag de capítulo/local */}
      {slide.tag && (
        <div style={{
          position: "absolute", top: 16, left: 16,
          background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, padding: "5px 14px",
          color: "rgba(255,255,255,0.45)", fontSize: 11,
          fontFamily: "'Segoe UI', sans-serif", fontStyle: "italic",
          zIndex: 10, display: "flex", alignItems: "center", gap: 6,
        }}>
          {slide.isNarrator ? "📖" : "📍"} {slide.tag}
        </div>
      )}

      {/* Pontos de progresso */}
      <div style={{
        position: "absolute", top: 20, right: 88,
        display: "flex", gap: 5, zIndex: 10, pointerEvents: "none",
      }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            width: i === currentSlide ? 18 : 5, height: 5, borderRadius: 3,
            background: i === currentSlide ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.2)",
            transition: "all 0.3s ease",
          }} />
        ))}
      </div>

      {/* Botão Pular */}
      <button onClick={e => { e.stopPropagation(); onSkip() }} style={{
        position: "absolute", top: 14, right: 16,
        background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.18)",
        color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "6px 14px",
        fontSize: 13, cursor: "pointer", zIndex: 10,
        fontFamily: "'Segoe UI', sans-serif", backdropFilter: "blur(4px)",
        letterSpacing: "0.04em",
      }}>
        ⏭ Pular
      </button>

      {/* Caixa de diálogo */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(3,4,10,0.93)", borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "18px 24px 26px", minHeight: 128,
      }} onClick={e => e.stopPropagation()}>
        {/* Badge do orador */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${slide.speakerColor}16`,
          border: `1px solid ${slide.speakerColor}50`,
          color: slide.speakerColor,
          fontFamily: "'Segoe UI', sans-serif", fontWeight: 700, fontSize: 12,
          padding: "3px 14px", borderRadius: 20, marginBottom: 10, letterSpacing: "0.04em",
        }}>
          {slide.isNarrator ? "📖" : "💬"} {slide.speakerName}
        </div>

        {/* Texto com typewriter — clique para pular */}
        <p style={{
          fontFamily: "'Segoe UI', sans-serif",
          fontSize: "clamp(14px, 1.85vw, 17px)",
          color: "#f0f9ff", lineHeight: 1.68, margin: 0, fontWeight: 400,
          minHeight: "2.5em",
        }}>
          {displayed}
          {/* Cursor piscante enquanto digita */}
          {!done && (
            <span style={{ animation: "tutCursor 0.7s step-end infinite", opacity: 1 }}>|</span>
          )}
        </p>

        <button onClick={e => { e.stopPropagation(); handleClick() }} style={{
          position: "absolute", bottom: 20, right: 24,
          background: "transparent", border: "1px solid rgba(255,255,255,0.22)",
          color: "rgba(255,255,255,0.55)", borderRadius: 8, padding: "5px 18px",
          fontSize: 12, cursor: "pointer",
          fontFamily: "'Segoe UI', sans-serif", letterSpacing: "0.04em",
        }}>
          {!done ? "Pular texto ►" : isLast ? "Escolher Mestre ►" : "Avançar ►"}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: MASTER SELECT PHASE
// ═══════════════════════════════════════════════════════════════════════════════

function MasterSelectPhase({ playerName, onSelect, selectedMaster, confirmed }: {
  playerName: string; onSelect: (id: TutorialMasterId) => void
  selectedMaster: TutorialMasterId | null; confirmed: boolean
}) {
  const [hovered, setHovered] = useState<TutorialMasterId | null>(null)
  const [entered, setEntered] = useState(false)
  useTutorialAudio("/audio/Big Memory.mp3", 0.5)

  useEffect(() => { const t = setTimeout(() => setEntered(true), 60); return () => clearTimeout(t) }, [])

  // ── Tela de confirmação ─────────────────────────────────────────────────────
  if (confirmed && selectedMaster) {
    const m = MASTERS[selectedMaster]
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "#030308",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", fontFamily: "'Segoe UI', sans-serif",
        overflow: "hidden",
      }}>
        {/* Flash colorido de fundo */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at 50% 65%, ${m.color}22 0%, transparent 65%)`,
          animation: "msConfirmBg 0.8s ease both",
        }} />
        {/* Raios de luz saindo de baixo */}
        <div style={{
          position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "140%", height: "100%",
          background: `conic-gradient(from 260deg at 50% 120%, transparent 0deg, ${m.color}12 10deg, transparent 20deg, transparent 30deg, ${m.color}08 40deg, transparent 50deg, transparent 60deg, ${m.color}14 70deg, transparent 80deg, transparent 270deg, ${m.color}10 280deg, transparent 290deg, transparent 300deg, ${m.color}06 310deg, transparent 320deg)`,
          animation: "msRays 1.2s ease both",
        }} />
        {/* Arte do mestre */}
        <img src={m.art} alt={m.name} style={{
          height: "clamp(260px, 54vh, 480px)", objectFit: "contain",
          filter: `drop-shadow(0 0 50px ${m.shadowGlow}) drop-shadow(0 0 100px ${m.color}30)`,
          animation: "msConfirmArt 0.7s cubic-bezier(0.22,1,0.36,1) both",
          position: "relative", zIndex: 2, marginBottom: 4,
        }} />
        {/* Linha decorativa */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14, marginBottom: 14, zIndex: 2,
          animation: "tutFadeIn 0.5s ease 0.35s both",
          width: "clamp(200px, 36vw, 480px)",
        }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${m.color}60)` }} />
          <div style={{ width: 6, height: 6, background: m.color, transform: "rotate(45deg)", boxShadow: `0 0 8px ${m.color}` }} />
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${m.color}60)` }} />
        </div>
        {/* Nome + mensagem */}
        <div style={{ textAlign: "center", zIndex: 2, animation: "tutFadeIn 0.5s ease 0.4s both" }}>
          <div style={{
            fontSize: "clamp(9px, 0.9vw, 11px)", letterSpacing: "0.45em",
            color: m.color, fontWeight: 700, textTransform: "uppercase",
            marginBottom: 8, textShadow: `0 0 16px ${m.color}`,
          }}>
            Mestre de Jornada Escolhido
          </div>
          <h2 style={{
            fontSize: "clamp(28px, 4.2vw, 50px)", fontWeight: 900,
            color: "#fff", margin: "0 0 12px",
            textShadow: `0 0 40px ${m.shadowGlow}, 0 4px 20px rgba(0,0,0,0.9)`,
            letterSpacing: "0.03em",
          }}>
            {m.name}
          </h2>
          <p style={{
            fontSize: "clamp(13px, 1.5vw, 17px)", color: "rgba(255,255,255,0.65)",
            margin: "0 0 4px",
          }}>
            {playerName}, fico muito feliz com sua escolha!
          </p>
          <p style={{ fontSize: "clamp(13px, 1.5vw, 17px)", color: m.color, fontWeight: 700, margin: 0 }}>
            Você tem MUITO a aprender comigo daqui pra frente!
          </p>
        </div>
      </div>
    )
  }

  // ── Tela de seleção — layout fullscreen de 3 painéis ───────────────────────
  const order: TutorialMasterId[] = ["morgana", "fehnon", "calem"]
  const active = hovered ?? selectedMaster

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#030308",
      fontFamily: "'Segoe UI', sans-serif", overflow: "hidden",
    }}>
      {/* Ruído de fundo sutil */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.025, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat", backgroundSize: "200px",
      }} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "clamp(18px, 3.5vh, 34px) 0 0",
        background: "linear-gradient(to bottom, rgba(3,3,8,0.95) 0%, transparent 100%)",
        paddingBottom: 24,
        animation: "tutFadeIn 0.7s ease both",
        pointerEvents: "none",
      }}>
        <span style={{
          fontSize: "clamp(8px, 0.85vw, 10px)", letterSpacing: "0.5em",
          color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginBottom: 10,
        }}>
          A Grande Ordem — Sua Escolha
        </span>
        <h1 style={{
          fontSize: "clamp(20px, 3vw, 38px)", fontWeight: 900,
          color: "#ffffff", margin: 0, letterSpacing: "0.01em",
          textShadow: "0 2px 40px rgba(168,85,247,0.35), 0 0 80px rgba(56,189,248,0.15)",
        }}>
          Escolha seu Mestre de Jornada
        </h1>
        {/* Régua decorativa */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginTop: 10,
          width: "clamp(160px, 30vw, 360px)",
        }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.12))" }} />
          <div style={{ width: 4, height: 4, background: "rgba(255,255,255,0.25)", transform: "rotate(45deg)" }} />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.18em" }}>DECK INICIAL EXCLUSIVO</span>
          <div style={{ width: 4, height: 4, background: "rgba(255,255,255,0.25)", transform: "rotate(45deg)" }} />
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(255,255,255,0.12))" }} />
        </div>
      </div>

      {/* ── TRÊS PAINÉIS ───────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {order.map((id, idx) => {
          const m = MASTERS[id]
          const isActive = active === id
          const isSel = selectedMaster === id
          const isCenter = id === "fehnon"
          // Fehnon é ligeiramente mais proeminente no centro
          const artH = isCenter ? "clamp(340px, 68vh, 600px)" : "clamp(310px, 63vh, 550px)"

          return (
            <div key={id} style={{
              flex: isActive ? (isCenter ? 1.18 : 1.12) : (isCenter ? 1.04 : 1),
              position: "relative", overflow: "hidden", cursor: "pointer",
              transition: "flex 0.55s cubic-bezier(0.4,0,0.2,1)",
              borderRight: idx < order.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(id)}
            >
              {/* Gradiente de fundo do painel */}
              <div style={{
                position: "absolute", inset: 0,
                background: isActive
                  ? `linear-gradient(180deg, #030308 0%, ${m.color}14 60%, ${m.color}22 100%)`
                  : `linear-gradient(180deg, #030308 0%, ${m.color}05 80%, ${m.color}0a 100%)`,
                transition: "background 0.55s ease",
              }} />

              {/* Coluna de luz vertical (fundo) */}
              <div style={{
                position: "absolute", bottom: 0, left: "50%",
                transform: "translateX(-50%)",
                width: isActive ? "55%" : "25%",
                height: "80%",
                background: `radial-gradient(ellipse at 50% 100%, ${m.color}${isActive ? "28" : "0c"} 0%, transparent 65%)`,
                transition: "all 0.55s ease",
                pointerEvents: "none",
              }} />

              {/* Brilho no chão sob os pés */}
              <div style={{
                position: "absolute",
                bottom: "21%", left: "50%",
                transform: "translateX(-50%)",
                width: isActive ? "160px" : "80px", height: "20px",
                background: `radial-gradient(ellipse, ${m.color}${isActive ? "50" : "20"} 0%, transparent 70%)`,
                filter: "blur(10px)",
                transition: "all 0.45s ease",
                pointerEvents: "none",
              }} />

              {/* Arte do personagem */}
              <div style={{
                position: "absolute", bottom: "21%", left: "50%",
                transform: `translateX(-50%) scale(${isActive ? (isCenter ? 1.07 : 1.05) : (isCenter ? 1.02 : 1)})`,
                height: artH,
                transformOrigin: "bottom center",
                transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1), height 0.55s ease",
                pointerEvents: "none",
              }}>
                <img src={m.art} alt={m.name} style={{
                  height: "100%", objectFit: "contain", objectPosition: "bottom center",
                  filter: `drop-shadow(0 0 ${isActive ? 36 : 14}px ${m.color}${isActive ? "99" : "44"}) drop-shadow(0 24px 40px rgba(0,0,0,0.85))`,
                  transition: "filter 0.5s ease",
                }} />
              </div>

              {/* ── OVERLAY DE INFO (parte inferior) ─────────────────────── */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: "23%",
                background: "linear-gradient(to top, rgba(3,3,8,0.98) 0%, rgba(3,3,8,0.82) 55%, transparent 100%)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "flex-end",
                padding: "0 clamp(10px, 2vw, 20px) clamp(14px, 2.5vh, 24px)",
                zIndex: 5,
              }}>
                {/* Badge do elemento */}
                <div style={{
                  fontSize: "clamp(7px, 0.75vw, 9px)", fontWeight: 800,
                  letterSpacing: "0.22em", textTransform: "uppercase",
                  color: m.color, background: `${m.color}14`,
                  border: `1px solid ${m.color}${isActive ? "60" : "30"}`,
                  padding: "3px 12px", borderRadius: 20,
                  marginBottom: 6,
                  textShadow: isActive ? `0 0 12px ${m.color}` : "none",
                  transition: "all 0.4s ease",
                }}>
                  {m.element}
                </div>

                {/* Nome do personagem */}
                <div style={{
                  fontSize: isCenter
                    ? "clamp(16px, 1.85vw, 24px)"
                    : "clamp(14px, 1.65vw, 21px)",
                  fontWeight: 900, color: "#ffffff",
                  letterSpacing: "0.02em", textAlign: "center",
                  lineHeight: 1.15, marginBottom: 4,
                  textShadow: isActive
                    ? `0 0 28px ${m.shadowGlow}, 0 2px 6px rgba(0,0,0,0.9)`
                    : "0 2px 8px rgba(0,0,0,0.9)",
                  transition: "text-shadow 0.4s ease",
                }}>
                  {m.name}
                </div>

                {/* Nome do deck */}
                <div style={{
                  fontSize: "clamp(9px, 0.9vw, 11px)", fontWeight: 600,
                  color: `${m.color}bb`, letterSpacing: "0.06em",
                  marginBottom: 8,
                }}>
                  {m.deckName}
                </div>

                {/* Descrição — aparece suavemente no hover */}
                <div style={{
                  fontSize: "clamp(9px, 0.88vw, 11px)",
                  color: "rgba(255,255,255,0.42)", textAlign: "center",
                  lineHeight: 1.55, maxWidth: 220,
                  marginBottom: 10,
                  maxHeight: isActive ? "62px" : "0px",
                  opacity: isActive ? 1 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.45s ease, opacity 0.35s ease",
                }}>
                  {m.deckDesc}
                </div>

                {/* Botão de seleção */}
                <div style={{
                  width: "clamp(90px, 78%, 170px)",
                  padding: "clamp(7px, 1.1vh, 10px) 0",
                  background: isSel
                    ? m.color
                    : isActive
                      ? `linear-gradient(135deg, ${m.color}28 0%, ${m.color}45 100%)`
                      : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isSel ? m.color : isActive ? m.color + "70" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 9,
                  color: isSel ? "#fff" : isActive ? m.color : "rgba(255,255,255,0.35)",
                  fontSize: "clamp(9px, 0.95vw, 11px)", fontWeight: 800,
                  textAlign: "center", letterSpacing: "0.12em", textTransform: "uppercase",
                  boxShadow: isSel ? `0 4px 20px ${m.color}55` : "none",
                  transition: "all 0.35s ease",
                }}>
                  {isSel ? "✓ Selecionado" : "Escolher"}
                </div>
              </div>

              {/* Borda lateral sutil quando selecionado */}
              {isSel && (
                <div style={{
                  position: "absolute", inset: 0,
                  border: `1px solid ${m.color}35`,
                  pointerEvents: "none",
                  animation: "tutFadeIn 0.3s ease both",
                }} />
              )}

              {/* Cortina de entrada escalonada por painel */}
              <div style={{
                position: "absolute", inset: 0,
                background: "#030308",
                opacity: entered ? 0 : 1,
                transition: `opacity 0.65s ease ${idx * 0.18}s`,
                pointerEvents: "none",
              }} />
            </div>
          )
        })}
      </div>

      {/* Nota de rodapé */}
      <div style={{
        position: "absolute", bottom: 10, left: 0, right: 0,
        textAlign: "center", zIndex: 30, pointerEvents: "none",
        animation: "tutFadeIn 1s ease 0.8s both",
      }}>
        <span style={{
          fontSize: 10, color: "rgba(255,255,255,0.18)",
          letterSpacing: "0.16em", textTransform: "uppercase",
        }}>
          Passe o mouse para ver mais detalhes
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: TUTORIAL GAME OVERLAY (sobre as telas REAIS do jogo)
// ═══════════════════════════════════════════════════════════════════════════════

export function TutorialGameOverlay({ masterId, onNavigate, onComplete }: TutorialGameOverlayProps) {
  const [phase, setPhase] = useState<OverlayPhase>("menu")
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => { setTimeout(() => setVisible(true), 80) }, [])

  const currentSteps = phase === "menu" ? MENU_STEPS : phase === "duel" ? DUEL_STEPS : GACHA_STEPS
  const currentStep = currentSteps[step]
  const isLastStep = step === currentSteps.length - 1
  const isLastPhase = phase === "gacha"

  const nextLabel = () => {
    if (isLastPhase && isLastStep) return "Finalizar Tutorial ►"
    if (isLastStep && phase === "menu") return "Ir para o Duelo! ►"
    if (isLastStep && phase === "duel") return "Ir para o GACHA! ►"
    return "Entendido ►"
  }

  const handleNext = () => {
    if (isLastStep) {
      if (phase === "menu") {
        setPhase("duel")
        setStep(0)
        onNavigate("duel-bot")
      } else if (phase === "duel") {
        setPhase("gacha")
        setStep(0)
        onNavigate("gacha")
      } else {
        onComplete()
      }
    } else {
      setStep(s => s + 1)
    }
  }

  // Progresso total do overlay para os pontinhos
  const totalSteps = MENU_STEPS.length + DUEL_STEPS.length + GACHA_STEPS.length
  const globalStep =
    (phase === "menu" ? 0 : phase === "duel" ? MENU_STEPS.length : MENU_STEPS.length + DUEL_STEPS.length) + step

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      opacity: visible ? 1 : 0, transition: "opacity 0.5s ease",
      pointerEvents: "none", // deixa o jogo receber eventos (apenas o bubble é clicável)
    }}>
      <style>{TUTORIAL_CSS}</style>

      {/* Spotlight sobre a região da tela real */}
      <RegionSpotlight region={currentStep?.region ?? null} />

      {/* Pontinhos de progresso — top center */}
      <div style={{
        position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 5, zIndex: 500, pointerEvents: "none",
      }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            width: i === globalStep ? 16 : 5, height: 5, borderRadius: 3,
            background: i <= globalStep ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)",
            transition: "all 0.3s ease",
          }} />
        ))}
      </div>

      {/* Balão do Mestre (é clicável) */}
      <div style={{ pointerEvents: "all" }}>
        <MasterBubble
          masterId={masterId}
          text={currentStep?.text ?? ""}
          onNext={handleNext}
          nextLabel={nextLabel()}
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS GLOBAL DO TUTORIAL
// ═══════════════════════════════════════════════════════════════════════════════

const TUTORIAL_CSS = `
  /* ── Master Select ───────────────────── */
  @keyframes msConfirmBg {
    0%   { opacity: 0; transform: scale(1.15); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes msConfirmArt {
    0%   { opacity: 0; transform: translateY(30px) scale(0.82); }
    60%  { opacity: 1; transform: translateY(-6px) scale(1.03); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes msRays {
    0%   { opacity: 0; transform: translateX(-50%) rotate(-8deg); }
    100% { opacity: 1; transform: translateX(-50%) rotate(0deg); }
  }
  /* ── Shared ──────────────────────────── */
  @keyframes tutFadeIn {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes tutSlideLeft {
    from { opacity:0; transform:translateX(-44px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes tutSlideRight {
    from { opacity:0; transform:translateX(44px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes tutMasterIn {
    from { opacity:0; transform:scale(0.78) translateY(22px); }
    to   { opacity:1; transform:scale(1) translateY(0); }
  }
  @keyframes tutRingPulse {
    0%,100% { opacity:0.5; }
    50%     { opacity:1; }
  }
  @keyframes tutCursor {
    0%,100% { opacity:1; }
    50%     { opacity:0; }
  }
`

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT: TUTORIAL SCREEN (standalone — lore + seleção de mestre)
// ═══════════════════════════════════════════════════════════════════════════════

export default function TutorialScreen({ playerName, onComplete }: TutorialScreenProps) {
  const [phase, setPhase] = useState<"lore" | "master-select">("lore")
  const [loreStep, setLoreStep] = useState(0)
  const [selectedMaster, setSelectedMaster] = useState<TutorialMasterId | null>(null)
  const [masterConfirmed, setMasterConfirmed] = useState(false)
  const [visible, setVisible] = useState(false)

  const loreSlides = buildLoreSlides(playerName)
  useEffect(() => { setTimeout(() => setVisible(true), 80) }, [])

  const advanceLore = useCallback(() => {
    if (loreStep < loreSlides.length - 1) setLoreStep(s => s + 1)
    else setPhase("master-select")
  }, [loreStep, loreSlides.length])

  const skipLore = useCallback(() => setPhase("master-select"), [])

  const handleMasterSelect = useCallback((id: TutorialMasterId) => {
    setSelectedMaster(id)
    setMasterConfirmed(true)
    // Aguarda animação de confirmação e chama onComplete
    // (game-wrapper cuida da navegação para o main-menu real)
    setTimeout(() => onComplete(id), 2700)
  }, [onComplete])

  return (
    <div style={{
      position: "fixed", inset: 0,
      opacity: visible ? 1 : 0, transition: "opacity 0.7s ease",
      zIndex: 9990,
    }}>
      <style>{TUTORIAL_CSS}</style>

      {phase === "lore" && (
        <LorePhase
          slides={loreSlides}
          currentSlide={loreStep}
          onAdvance={advanceLore}
          onSkip={skipLore}
        />
      )}

      {phase === "master-select" && (
        <MasterSelectPhase
          playerName={playerName}
          onSelect={handleMasterSelect}
          selectedMaster={selectedMaster}
          confirmed={masterConfirmed}
        />
      )}
    </div>
  )
}
