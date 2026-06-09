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

  // Slide 6 = "Ufa, você acordou!" — primeira apresentação real dos personagens.
  // Antes disso as artes aparecem como silhuetas escuras e misteriosas.
  const REVEAL_SLIDE = 6
  const isRevealed = currentSlide >= REVEAL_SLIDE

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
            filter: isRevealed
              ? "drop-shadow(0 8px 32px rgba(0,0,0,0.75))"
              : "brightness(0.07) saturate(0.1) contrast(1.15)",
            transition: isRevealed ? "filter 1.4s ease" : "filter 0.3s ease",
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
            filter: isRevealed
              ? "drop-shadow(0 8px 32px rgba(0,0,0,0.75))"
              : "brightness(0.07) saturate(0.1) contrast(1.15)",
            transition: isRevealed ? "filter 1.4s ease" : "filter 0.3s ease",
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
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useTutorialAudio("/audio/Big Memory.mp3", 0.5)

  useEffect(() => { const t = setTimeout(() => setEntered(true), 80); return () => clearTimeout(t) }, [])

  const handleEnter = (id: TutorialMasterId) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(id)
  }
  const handleLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => setHovered(null), 130)
  }

  // ── TELA DE CONFIRMAÇÃO ────────────────────────────────────────────────────
  if (confirmed && selectedMaster) {
    const m = MASTERS[selectedMaster]
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#060608",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", fontFamily: "'Segoe UI', sans-serif", overflow: "hidden",
      }}>
        {/* Burst de fundo */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 65%, ${m.color}22 0%, transparent 60%)`, animation: "msConfirmBg 0.8s ease both" }} />
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "140%", height: "100%", background: `conic-gradient(from 260deg at 50% 120%, transparent 0deg, ${m.color}10 10deg, transparent 20deg, transparent 30deg, ${m.color}08 40deg, transparent 50deg, transparent 60deg, ${m.color}12 70deg, transparent 80deg, transparent 270deg, ${m.color}08 280deg, transparent 290deg, transparent 300deg, ${m.color}06 310deg, transparent 320deg)`, animation: "msRays 1.2s ease both" }} />
        <img src={m.art} alt={m.name} style={{ height: "clamp(260px, 54vh, 480px)", objectFit: "contain", filter: `drop-shadow(0 0 50px ${m.shadowGlow}) drop-shadow(0 0 100px ${m.color}28)`, animation: "msConfirmArt 0.7s cubic-bezier(0.22,1,0.36,1) both", position: "relative", zIndex: 2, marginBottom: 4 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, zIndex: 2, animation: "tutFadeIn 0.5s ease 0.35s both", width: "clamp(200px, 36vw, 480px)" }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${m.color}55)` }} />
          <div style={{ width: 6, height: 6, background: m.color, transform: "rotate(45deg)", boxShadow: `0 0 8px ${m.color}` }} />
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${m.color}55)` }} />
        </div>
        <div style={{ textAlign: "center", zIndex: 2, animation: "tutFadeIn 0.5s ease 0.4s both" }}>
          <div style={{ fontSize: "clamp(9px, 0.9vw, 11px)", letterSpacing: "0.45em", color: m.color, fontWeight: 700, textTransform: "uppercase", marginBottom: 8, textShadow: `0 0 14px ${m.color}` }}>Mestre de Jornada Escolhido</div>
          <h2 style={{ fontSize: "clamp(28px, 4.2vw, 50px)", fontWeight: 900, color: "#fff", margin: "0 0 12px", textShadow: `0 0 40px ${m.shadowGlow}, 0 4px 20px rgba(0,0,0,0.9)`, letterSpacing: "0.03em" }}>{m.name}</h2>
          <p style={{ fontSize: "clamp(13px, 1.5vw, 17px)", color: "rgba(255,255,255,0.6)", margin: "0 0 4px" }}>{playerName}, fico muito feliz com sua escolha!</p>
          <p style={{ fontSize: "clamp(13px, 1.5vw, 17px)", color: m.color, fontWeight: 700, margin: 0 }}>Você tem MUITO a aprender comigo daqui pra frente!</p>
        </div>
      </div>
    )
  }

  // ── SELEÇÃO ────────────────────────────────────────────────────────────────
  const order: TutorialMasterId[] = ["morgana", "fehnon", "calem"]
  const active = hovered ?? selectedMaster

  return (
    <div style={{ position: "fixed", inset: 0, background: "#060608", fontFamily: "'Segoe UI', sans-serif", overflow: "hidden" }}>

      {/* Glow de fundo suave que muda por personagem — só background/opacity */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        opacity: active ? 1 : 0,
        background: active ? `radial-gradient(ellipse 60% 50% at ${active === "morgana" ? "17%" : active === "fehnon" ? "50%" : "83%"} 100%, ${MASTERS[active].color}18 0%, transparent 100%)` : "transparent",
        transition: "opacity 0.6s ease, background 0.6s ease",
      }} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 30,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "clamp(16px, 3vh, 30px) 0 16px",
        background: "linear-gradient(to bottom, rgba(6,6,8,0.98) 0%, transparent 100%)",
        pointerEvents: "none", animation: "tutFadeIn 0.6s ease both",
      }}>
        <span style={{ fontSize: "clamp(8px, 0.8vw, 9px)", letterSpacing: "0.55em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase", marginBottom: 9 }}>A Grande Ordem — Sua Escolha</span>
        <h1 style={{ fontSize: "clamp(21px, 2.9vw, 38px)", fontWeight: 900, color: "#fff", margin: "0 0 9px", letterSpacing: "0.01em", textShadow: "0 2px 32px rgba(120,60,200,0.35)" }}>
          Escolha seu Mestre de Jornada
        </h1>
        {/* Ornamento sob o título */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "clamp(140px, 28vw, 360px)" }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.1))" }} />
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div style={{ width: 3, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: "50%" }} />
            <div style={{ width: 4, height: 4, background: "rgba(255,255,255,0.22)", transform: "rotate(45deg)" }} />
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.18)", letterSpacing: "0.2em" }}>DECK INICIAL EXCLUSIVO</span>
            <div style={{ width: 4, height: 4, background: "rgba(255,255,255,0.22)", transform: "rotate(45deg)" }} />
            <div style={{ width: 3, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: "50%" }} />
          </div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(255,255,255,0.1))" }} />
        </div>
      </div>

      {/* ── TRÊS PAINÉIS ────────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: "clamp(92px, 13.5vh, 124px)", left: 0, right: 0, bottom: 0, display: "flex" }}>
        {order.map((id, idx) => {
          const m = MASTERS[id]
          const isActive = active === id
          const isSel = selectedMaster === id
          const isCenter = id === "fehnon"

          return (
            <div key={id}
              onMouseEnter={() => handleEnter(id)}
              onMouseLeave={handleLeave}
              onClick={() => onSelect(id)}
              style={{
                flex: "1 0 0",               // ESTÁTICO — zero layout reflow
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                transform: "translateZ(0)",  // camada GPU dedicada por painel
                borderRight: idx < order.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              {/* ── Fundo base do painel (estático) */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: `linear-gradient(170deg, rgba(6,6,8,0) 0%, ${m.color}06 50%, ${m.color}12 100%)`,
              }} />

              {/* ── Intensificação de cor no hover — só opacity */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: `linear-gradient(170deg, transparent 10%, ${m.color}0c 55%, ${m.color}20 100%)`,
                opacity: isActive ? 1 : 0,
                willChange: "opacity",
                transition: "opacity 0.45s ease",
              }} />

              {/* ── Linha de topo com brilho */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2, pointerEvents: "none",
                background: `linear-gradient(90deg, transparent 5%, ${m.color}${isActive ? "ee" : "44"} 35%, ${m.color}${isActive ? "ff" : "55"} 50%, ${m.color}${isActive ? "ee" : "44"} 65%, transparent 95%)`,
                boxShadow: isActive ? `0 0 16px 3px ${m.color}60, 0 0 32px ${m.color}30` : "none",
                willChange: "opacity",
                transition: "background 0.45s ease, box-shadow 0.45s ease",
              }} />

              {/* ── Cantos decorativos (top-left e top-right) */}
              {/* Canto superior esquerdo */}
              <div style={{ position: "absolute", top: 8, left: 8, width: 18, height: 18, pointerEvents: "none", opacity: isActive ? 0.9 : 0.25, transition: "opacity 0.4s ease" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 2, background: m.color, borderRadius: 1 }} />
                <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: "100%", background: m.color, borderRadius: 1 }} />
              </div>
              {/* Canto superior direito */}
              <div style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, pointerEvents: "none", opacity: isActive ? 0.9 : 0.25, transition: "opacity 0.4s ease" }}>
                <div style={{ position: "absolute", top: 0, right: 0, width: "100%", height: 2, background: m.color, borderRadius: 1 }} />
                <div style={{ position: "absolute", top: 0, right: 0, width: 2, height: "100%", background: m.color, borderRadius: 1 }} />
              </div>
              {/* Canto inferior esquerdo */}
              <div style={{ position: "absolute", bottom: "clamp(152px, 22.5vh, 205px)", left: 8, width: 14, height: 14, pointerEvents: "none", opacity: isActive ? 0.7 : 0.15, transition: "opacity 0.4s ease" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 1.5, background: m.color }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, width: 1.5, height: "100%", background: m.color }} />
              </div>
              {/* Canto inferior direito */}
              <div style={{ position: "absolute", bottom: "clamp(152px, 22.5vh, 205px)", right: 8, width: 14, height: 14, pointerEvents: "none", opacity: isActive ? 0.7 : 0.15, transition: "opacity 0.4s ease" }}>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: "100%", height: 1.5, background: m.color }} />
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 1.5, height: "100%", background: m.color }} />
              </div>

              {/* ── Pilar de luz vertical (coluna central, bottom-up) */}
              <div style={{
                position: "absolute", bottom: "clamp(150px, 22vh, 204px)", left: "50%",
                transform: "translateX(-50%)", width: "40%", height: "68%",
                background: `radial-gradient(ellipse at 50% 100%, ${m.color}${isActive ? "1e" : "08"} 0%, transparent 70%)`,
                pointerEvents: "none", willChange: "opacity",
                transition: "background 0.5s ease",
              }} />

              {/* ── Halo elíptico atrás do personagem */}
              <div style={{
                position: "absolute",
                bottom: "clamp(155px, 23vh, 210px)",
                left: "50%", transform: "translateX(-50%)",
                width: "clamp(160px, 22vw, 280px)",
                height: "clamp(160px, 22vw, 280px)",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${m.color}28 0%, ${m.color}0a 45%, transparent 70%)`,
                opacity: isActive ? 1 : 0,
                pointerEvents: "none", willChange: "opacity",
                transition: "opacity 0.5s ease",
              }} />

              {/* ── Brilho no chão sob os pés */}
              <div style={{
                position: "absolute",
                bottom: "clamp(150px, 22vh, 204px)", left: "50%",
                transform: "translateX(-50%)",
                width: "90px", height: "16px",
                background: `radial-gradient(ellipse, ${m.color}60 0%, transparent 70%)`,
                filter: "blur(8px)",
                opacity: isActive ? 1 : 0.15,
                pointerEvents: "none", willChange: "opacity",
                transition: "opacity 0.4s ease",
              }} />

              {/* ── ARTE DO PERSONAGEM — transform + filter apenas (GPU puro) */}
              <div style={{
                position: "absolute",
                bottom: "clamp(155px, 23vh, 210px)", left: "50%",
                transform: `translateX(-50%) translateY(${isActive ? "-10px" : "0px"}) scale(${isActive ? (isCenter ? 1.06 : 1.05) : (isCenter ? 1.02 : 1)})`,
                height: isCenter ? "clamp(320px, 67vh, 585px)" : "clamp(290px, 63vh, 545px)",
                transformOrigin: "bottom center",
                willChange: "transform",
                transition: "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                pointerEvents: "none",
              }}>
                <img src={m.art} alt={m.name} style={{
                  height: "100%", objectFit: "contain", objectPosition: "bottom center",
                  filter: isActive
                    ? `drop-shadow(0 0 22px ${m.color}70) drop-shadow(0 0 44px ${m.color}20)`
                    : "drop-shadow(0 10px 22px rgba(0,0,0,0.75))",
                  transition: "filter 0.5s ease",
                }} />
              </div>

              {/* ── ÁREA DE INFO — altura fixa, zero layout shift ─────────── */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: "clamp(152px, 22.5vh, 207px)",
                background: "linear-gradient(to top, rgba(6,6,8,0.99) 0%, rgba(6,6,8,0.90) 58%, transparent 100%)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "flex-end",
                padding: "0 clamp(10px, 1.8vw, 20px) clamp(14px, 2.4vh, 22px)",
              }}>
                {/* Badge do elemento */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 5,
                  marginBottom: 7,
                }}>
                  {/* Pontinho decorativo */}
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: m.color, opacity: isActive ? 0.9 : 0.4, transition: "opacity 0.4s ease", boxShadow: isActive ? `0 0 6px ${m.color}` : "none" }} />
                  <div style={{
                    fontSize: "clamp(7px, 0.78vw, 9px)", fontWeight: 800,
                    letterSpacing: "0.22em", textTransform: "uppercase",
                    color: m.color,
                    background: `${m.color}${isActive ? "18" : "0c"}`,
                    border: `1px solid ${m.color}${isActive ? "55" : "22"}`,
                    padding: "3px 13px", borderRadius: 20,
                    boxShadow: isActive ? `0 0 10px ${m.color}35` : "none",
                    transition: "background 0.4s ease, border 0.4s ease, box-shadow 0.4s ease",
                  }}>
                    {m.element}
                  </div>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: m.color, opacity: isActive ? 0.9 : 0.4, transition: "opacity 0.4s ease", boxShadow: isActive ? `0 0 6px ${m.color}` : "none" }} />
                </div>

                {/* Nome do personagem */}
                <div style={{
                  fontSize: isCenter ? "clamp(16px, 1.85vw, 24px)" : "clamp(15px, 1.65vw, 21px)",
                  fontWeight: 900, color: "#fff",
                  letterSpacing: "0.015em", textAlign: "center", lineHeight: 1.15,
                  marginBottom: 5,
                  textShadow: isActive
                    ? `0 0 20px ${m.shadowGlow}, 0 2px 4px rgba(0,0,0,0.9)`
                    : "0 2px 8px rgba(0,0,0,0.9)",
                  transition: "text-shadow 0.5s ease",
                }}>
                  {m.name}
                </div>

                {/* Separador decorativo */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 5, marginBottom: 6,
                  width: "clamp(60px, 55%, 120px)",
                  opacity: isActive ? 0.6 : 0.2, transition: "opacity 0.4s ease",
                }}>
                  <div style={{ flex: 1, height: 1, background: m.color }} />
                  <div style={{ width: 3, height: 3, background: m.color, transform: "rotate(45deg)" }} />
                  <div style={{ flex: 1, height: 1, background: m.color }} />
                </div>

                {/* Deck */}
                <div style={{
                  fontSize: "clamp(9px, 0.88vw, 11px)", fontWeight: 600,
                  letterSpacing: "0.06em", marginBottom: 8,
                  color: `${m.color}${isActive ? "bb" : "55"}`,
                  transition: "color 0.4s ease",
                }}>
                  {m.deckName}
                </div>

                {/* Descrição — fade+slide em container de altura fixa */}
                <div style={{
                  height: "clamp(36px, 5vh, 50px)",
                  display: "flex", alignItems: "flex-start", justifyContent: "center",
                  overflow: "hidden", marginBottom: 10, width: "100%",
                }}>
                  <p style={{
                    fontSize: "clamp(9px, 0.84vw, 10.5px)",
                    color: "rgba(255,255,255,0.4)", textAlign: "center",
                    lineHeight: 1.55, margin: 0, maxWidth: 215,
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? "translateY(0)" : "translateY(6px)",
                    transition: "opacity 0.4s ease, transform 0.4s ease",
                  }}>
                    {m.deckDesc}
                  </p>
                </div>

                {/* Botão ESCOLHER */}
                <div style={{
                  width: "clamp(88px, 74%, 160px)",
                  padding: "clamp(6px, 1vh, 9px) 0",
                  background: isSel
                    ? `linear-gradient(135deg, ${m.color}dd, ${m.color})`
                    : isActive
                    ? `${m.color}24`
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isSel ? m.color : isActive ? m.color + "58" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 8,
                  color: isSel ? "#fff" : isActive ? m.color : "rgba(255,255,255,0.25)",
                  fontSize: "clamp(8px, 0.88vw, 10px)", fontWeight: 800,
                  textAlign: "center", letterSpacing: "0.13em", textTransform: "uppercase",
                  boxShadow: isSel ? `0 3px 16px ${m.color}50, 0 0 0 1px ${m.color}40 inset` : "none",
                  transition: "background 0.4s ease, border 0.4s ease, color 0.4s ease, box-shadow 0.4s ease",
                }}>
                  {isSel ? "✓ Selecionado" : "Escolher"}
                </div>
              </div>

              {/* Borda ao selecionar */}
              {isSel && (
                <div style={{ position: "absolute", inset: 0, border: `1px solid ${m.color}28`, pointerEvents: "none", animation: "tutFadeIn 0.3s ease both" }} />
              )}

              {/* Cortina de entrada escalonada */}
              <div style={{
                position: "absolute", inset: 0, background: "#060608",
                opacity: entered ? 0 : 1,
                transition: `opacity 0.7s ease ${idx * 0.2}s`,
                pointerEvents: "none",
              }} />
            </div>
          )
        })}
      </div>

      {/* Rodapé */}
      <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", zIndex: 30, pointerEvents: "none", animation: "tutFadeIn 1s ease 0.9s both" }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.14)", letterSpacing: "0.18em", textTransform: "uppercase" }}>Passe o mouse para ver mais detalhes</span>
      </div>
    </div>
  )
}


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
