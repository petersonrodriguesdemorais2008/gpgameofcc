"use client"

/**
 * tutorial-screen.tsx — Gear Perks Card Game
 *
 * Fluxo completo do tutorial em 4 fases:
 *  1. "A Queda"    (Lore)         — 9 slides de diálogo brevíssimos
 *  2. "A Escolha"  (Agência)      — Seleção épica do Mestre de Jornada
 *  3. "A Batalha"  (Ação)         — Tour do Main Menu + Duelo com spotlight
 *  4. "A Recompensa" (Loop)       — Tutorial do Gacha + Pack gratuito
 *
 * Recursos técnicos:
 *  – Spotlight via SVG mask com anel pulsante
 *  – MasterBubble styled igual ao balão do main menu real
 *  – Salvamento em localStorage após escolha do Mestre (skip lore no reload)
 *  – Botão Pular na fase de lore
 *  – Mock screens fiéis ao visual real (sem dependências de contexto)
 */

import { useState, useEffect, useRef, useCallback } from "react"

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

export type TutorialMasterId = "fehnon" | "morgana" | "calem"

type TutorialPhase =
  | "lore"            // Slides de introdução
  | "master-select"   // Escolha do Mestre
  | "menu-tour"       // Walkthrough do Main Menu (mock)
  | "duel-tutorial"   // Walkthrough do Duelo (mock)
  | "gacha-tutorial"  // Tutorial do Gacha (mock)
  | "complete"        // Mensagem final

export interface TutorialScreenProps {
  playerName: string
  onComplete: (selectedMasterId: TutorialMasterId) => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// DADOS DOS MESTRES
// ═══════════════════════════════════════════════════════════════════════════════

const MASTERS: Record<
  TutorialMasterId,
  {
    name: string
    color: string
    bgGlow: string
    shadowGlow: string
    art: string
    deckName: string
    element: string
    deckDesc: string
  }
> = {
  fehnon: {
    name: "Fehnon Hoskie",
    color: "#38bdf8",
    bgGlow: "rgba(56,189,248,0.13)",
    shadowGlow: "rgba(56,189,248,0.55)",
    art: "/images/fehnon-art.png",
    deckName: "Deck Aquos",
    element: "Aquos",
    deckDesc: "Controle e fluxo — domine o campo com cartas de água e efeitos encadeados.",
  },
  morgana: {
    name: "Morgana Pendragon",
    color: "#a855f7",
    bgGlow: "rgba(168,85,247,0.13)",
    shadowGlow: "rgba(168,85,247,0.55)",
    art: "/images/morgana-art.png",
    deckName: "Deck Darkus",
    element: "Darkus",
    deckDesc: "Trevas agressivas — alto poder de ataque e efeitos devastadores no campo.",
  },
  calem: {
    name: "Calem",
    color: "#94a3b8",
    bgGlow: "rgba(148,163,184,0.12)",
    shadowGlow: "rgba(148,163,184,0.45)",
    art: "/images/calem-art.png",
    deckName: "Deck Neutro",
    element: "Haos",
    deckDesc: "Versátil e equilibrado — perfeito para aprender todas as estratégias do jogo.",
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDES DE LORE (breves, conforme orientação de design)
// ═══════════════════════════════════════════════════════════════════════════════

interface LoreSlide {
  bg: string
  speakerName: string
  speakerColor: string
  text: string
  leftChar?: TutorialMasterId | null
  rightChar?: TutorialMasterId | null
  isNarrator?: boolean
  tag?: string
}

function buildLoreSlides(playerName: string): LoreSlide[] {
  const pn = playerName || "Viajante"
  return [
    {
      bg: "radial-gradient(ellipse at 50% 30%, #0a1628 0%, #020307 100%)",
      speakerName: "Narrador",
      speakerColor: "#fbbf24",
      isNarrator: true,
      tag: "A Grande Ordem",
      text: "Em um reino celeste... três jovens seguiam destinos distintos, guiados por algo que não conseguiam nomear.",
      leftChar: null,
      rightChar: null,
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "???",
      speakerColor: "#38bdf8",
      tag: "Reino Celeste — sob os céus estrelados",
      text: "Para onde iremos agora? Parece que o destino continua nos chamando...",
      leftChar: "fehnon",
      rightChar: null,
    },
    {
      bg: "linear-gradient(160deg, #0d0520 0%, #1a0838 60%, #0d0520 100%)",
      speakerName: "???",
      speakerColor: "#a855f7",
      tag: "Reino Celeste — sob os céus estrelados",
      text: "Sigamos juntos! Somos uma Grande Ordem, lembra? O destino sempre nos guiará.",
      leftChar: "calem",
      rightChar: "morgana",
    },
    {
      bg: "radial-gradient(ellipse at 50% 80%, #0b1428 0%, #020307 100%)",
      speakerName: "???",
      speakerColor: "#94a3b8",
      text: "ESPERA! Tem alguém CAINDO do céu ali! Precisamos ir AGORA!",
      leftChar: "calem",
      rightChar: "fehnon",
    },
    {
      bg: "radial-gradient(ellipse at 50% 50%, #080a10 0%, #010203 100%)",
      speakerName: pn,
      speakerColor: "#e2e8f0",
      text: "O que?... Onde... Onde estou?...",
      leftChar: null,
      rightChar: null,
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "Fehnon Hoskie",
      speakerColor: "#38bdf8",
      text: `Ufa, você acordou! Eu sou Fehnon Hoskie. Ela é Morgana, e ele é Calem. Bem-vindo(a), ${pn}!`,
      leftChar: "fehnon",
      rightChar: "morgana",
    },
    {
      bg: "radial-gradient(ellipse at 50% 50%, #080a10 0%, #010203 100%)",
      speakerName: pn,
      speakerColor: "#e2e8f0",
      text: "Eu... não me lembro de nada. É como se tivesse batido a cabeça.",
      leftChar: null,
      rightChar: null,
    },
    {
      bg: "linear-gradient(160deg, #02091e 0%, #0b1e3c 60%, #02091e 100%)",
      speakerName: "Fehnon Hoskie",
      speakerColor: "#38bdf8",
      text: "Este mundo é perigoso. Aqui alguns possuem poderes chamados Ultimates — cada um escolhe usá-los para o bem ou para o mal. Mas você não estará sozinho(a).",
      leftChar: "fehnon",
      rightChar: null,
    },
    {
      bg: "linear-gradient(160deg, #0d0520 0%, #1a0838 60%, #0d0520 100%)",
      speakerName: "Fehnon Hoskie",
      speakerColor: "#38bdf8",
      text: "Venha conosco nessa jornada! E se quiser aprender sobre as Ultimates... escolha um de nós para ser seu Mestre de Jornada.",
      leftChar: "fehnon",
      rightChar: "morgana",
    },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// DADOS DE PASSOS DO TUTORIAL (textos dos balões de fala do Mestre)
// ═══════════════════════════════════════════════════════════════════════════════

const MENU_STEPS = [
  {
    key: "jogar",
    text: "Este é o botão JOGAR! Aqui você escolhe o modo de batalha e entra em combate com o seu deck!",
  },
  {
    key: "colecao",
    text: "Em COLEÇÃO você pode ver, organizar e gerenciar todas as cartas que você possui.",
  },
  {
    key: "gacha",
    text: "E o GACHA! Aqui você abre packs para conseguir novas cartas poderosas. Logo te mostro como funciona!",
  },
  {
    key: "sidebar",
    text: "Esses botões te dão acesso ao Deck, Missões, Loja, Histórico e muito mais! Agora... vamos ao seu primeiro duelo!",
  },
]

const DUEL_STEPS = [
  {
    key: "overview",
    text: "Bem-vindo ao campo de batalha! Fique de olho nos LPs — quem chegar a zero perde o duelo.",
  },
  {
    key: "hand",
    text: "Estas são as cartas da sua mão. Arraste uma carta de Unidade para o campo e coloque-a em jogo!",
  },
  {
    key: "tap",
    text: "Este é o TAP! A cada 3 turnos do jogador, uma carta extra aparece aqui — de graça. Não esqueça de pegar!",
  },
  {
    key: "field",
    text: "Sua Unidade está em campo! Selecione-a para iniciar um ataque contra uma carta do oponente.",
  },
  {
    key: "battle",
    text: "Clique em IR PARA BATALHA! Destrua as cartas inimigas e ataque diretamente para vencer o duelo!",
  },
  {
    key: "win",
    text: "INCRÍVEL! Você venceu seu primeiro duelo! Quanto mais você joga, mais forte e experiente você fica.",
  },
]

const GACHA_STEPS = [
  {
    key: "pack",
    text: "Hora da recompensa! Este pack é especial — é de graça só porque é seu primeiro dia aqui. Vamos abrir!",
  },
  {
    key: "open",
    text: "Clique para abrir! Quem sabe que cartas raras vão aparecer para você...",
  },
  {
    key: "result",
    text: "Parabéns! Você ganhou 4 novas cartas! Continue jogando duelos e abrindo packs para montar um deck invencível!",
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// PERSISTÊNCIA (localStorage)
// ═══════════════════════════════════════════════════════════════════════════════

const SAVE_KEY = "gpgame_tutorial_v1"

function saveTut(phase: TutorialPhase, masterId: TutorialMasterId | null) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ phase, masterId }))
  } catch {}
}

function loadTut(): { phase: TutorialPhase; masterId: TutorialMasterId } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    // Só restaura se já passou da seleção de Mestre
    if (p.masterId && p.phase !== "lore" && p.phase !== "master-select") return p
    return null
  } catch {
    return null
  }
}

function clearTut() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: BALÃO DE FALA DO MESTRE
// (estilo fiel ao balão do main menu real — branco, cauda para baixo)
// ═══════════════════════════════════════════════════════════════════════════════

function MasterBubble({
  masterId,
  text,
  onNext,
  nextLabel = "Continuar ►",
}: {
  masterId: TutorialMasterId
  text: string
  onNext: () => void
  nextLabel?: string
}) {
  const m = MASTERS[masterId]

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        zIndex: 500,
        pointerEvents: "none",
        width: "clamp(240px, 27vw, 370px)",
      }}
    >
      {/* ── Balão de fala (branco, com cauda apontando para o Mestre) ── */}
      <div
        style={{
          position: "relative",
          background: "white",
          borderRadius: 14,
          padding: "14px 16px",
          marginRight: 88,
          marginBottom: 10,
          width: "calc(100% - 98px)",
          boxShadow: `0 6px 30px rgba(0,0,0,0.55), 0 0 0 2px ${m.color}35`,
          pointerEvents: "all",
        }}
      >
        {/* Sombra da cauda (dá a impressão de borda colorida) */}
        <div
          style={{
            position: "absolute",
            bottom: -17,
            right: 28,
            width: 0,
            height: 0,
            borderLeft: "16px solid transparent",
            borderRight: "16px solid transparent",
            borderTop: `17px solid ${m.color}35`,
            zIndex: -1,
          }}
        />
        {/* Cauda branca */}
        <div
          style={{
            position: "absolute",
            bottom: -13,
            right: 30,
            width: 0,
            height: 0,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderTop: "14px solid white",
          }}
        />

        {/* Nome do Mestre */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: m.color,
            fontFamily: "'Segoe UI', sans-serif",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {m.name}
        </div>

        {/* Texto */}
        <p
          style={{
            fontFamily: "'Segoe UI', sans-serif",
            fontSize: "clamp(12px, 1.25vw, 14px)",
            color: "#1e293b",
            lineHeight: 1.6,
            margin: "0 0 12px",
            fontWeight: 500,
          }}
        >
          {text}
        </p>

        {/* Botão avançar */}
        <button
          onClick={onNext}
          style={{
            display: "block",
            marginLeft: "auto",
            background: m.color,
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.04em",
            boxShadow: `0 2px 10px ${m.shadowGlow}`,
            fontFamily: "'Segoe UI', sans-serif",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
        >
          {nextLabel}
        </button>
      </div>

      {/* Arte do Mestre */}
      <img
        src={m.art}
        alt={m.name}
        style={{
          width: 94,
          height: 158,
          objectFit: "contain",
          objectPosition: "bottom center",
          filter: `drop-shadow(0 0 22px ${m.shadowGlow})`,
          flexShrink: 0,
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: SPOTLIGHT via SVG mask
// ═══════════════════════════════════════════════════════════════════════════════

function Spotlight({
  targetRef,
  padding = 10,
}: {
  targetRef: React.RefObject<HTMLElement | null>
  padding?: number
}) {
  const [r, setR] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  useEffect(() => {
    const measure = () => {
      const el = targetRef.current
      if (!el) return
      const b = el.getBoundingClientRect()
      setR({
        x: b.left - padding,
        y: b.top - padding,
        w: b.width + padding * 2,
        h: b.height + padding * 2,
      })
    }
    measure()
    const t = setInterval(measure, 150)
    window.addEventListener("resize", measure)
    return () => {
      clearInterval(t)
      window.removeEventListener("resize", measure)
    }
  }, [targetRef, padding])

  if (!r)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.72)",
          zIndex: 300,
          pointerEvents: "none",
        }}
      />
    )

  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 300,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <defs>
        <mask id="tut-spl">
          <rect width="100%" height="100%" fill="white" />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={12} fill="black" />
        </mask>
      </defs>
      {/* Manto escuro com buraco */}
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.72)"
        mask="url(#tut-spl)"
      />
      {/* Anel pulsante externo */}
      <rect
        x={r.x - 2}
        y={r.y - 2}
        width={r.w + 4}
        height={r.h + 4}
        rx={13}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={2.5}
        style={{ animation: "tutRingPulse 1.6s ease-in-out infinite" }}
      />
      <rect
        x={r.x - 7}
        y={r.y - 7}
        width={r.w + 14}
        height={r.h + 14}
        rx={17}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1.5}
        style={{ animation: "tutRingPulse 1.6s ease-in-out infinite 0.25s" }}
      />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 1 — LORE (slides de diálogo)
// ═══════════════════════════════════════════════════════════════════════════════

function LorePhase({
  slides,
  currentSlide,
  onAdvance,
  onSkip,
}: {
  slides: LoreSlide[]
  currentSlide: number
  onAdvance: () => void
  onSkip: () => void
}) {
  const slide = slides[currentSlide]
  const [textKey, setTextKey] = useState(0)
  useEffect(() => {
    setTextKey(k => k + 1)
  }, [currentSlide])

  const isLast = currentSlide === slides.length - 1

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: slide.bg,
        cursor: "pointer",
        userSelect: "none",
        transition: "background 0.65s ease",
      }}
      onClick={onAdvance}
    >
      {/* Fundo estrelado sutil */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.65) 0%, transparent 100%)," +
            "radial-gradient(1px 1px at 75% 14%, rgba(255,255,255,0.5) 0%, transparent 100%)," +
            "radial-gradient(1.5px 1.5px at 48% 62%, rgba(255,255,255,0.55) 0%, transparent 100%)," +
            "radial-gradient(1px 1px at 91% 73%, rgba(255,255,255,0.45) 0%, transparent 100%)," +
            "radial-gradient(1px 1px at 28% 88%, rgba(255,255,255,0.35) 0%, transparent 100%)," +
            "radial-gradient(1px 1px at 62% 38%, rgba(255,255,255,0.5) 0%, transparent 100%)," +
            "radial-gradient(1px 1px at 38% 5%, rgba(255,255,255,0.4) 0%, transparent 100%)," +
            "radial-gradient(1.5px 1.5px at 84% 40%, rgba(255,255,255,0.35) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Sprite esquerdo */}
      {slide.leftChar && (
        <div
          key={`L${currentSlide}`}
          style={{
            position: "absolute",
            left: 0,
            bottom: 128,
            height: "clamp(270px, 57vh, 500px)",
            animation: "tutSlideLeft 0.4s ease both",
            pointerEvents: "none",
          }}
        >
          <img
            src={MASTERS[slide.leftChar].art}
            alt=""
            style={{
              height: "100%",
              objectFit: "contain",
              objectPosition: "bottom",
              filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.75))",
            }}
          />
        </div>
      )}

      {/* Sprite direito (espelhado para olhar para o centro) */}
      {slide.rightChar && (
        <div
          key={`R${currentSlide}`}
          style={{
            position: "absolute",
            right: 0,
            bottom: 128,
            height: "clamp(270px, 57vh, 500px)",
            transform: "scaleX(-1)",
            animation: "tutSlideRight 0.4s ease both",
            pointerEvents: "none",
          }}
        >
          <img
            src={MASTERS[slide.rightChar].art}
            alt=""
            style={{
              height: "100%",
              objectFit: "contain",
              objectPosition: "bottom",
              filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.75))",
            }}
          />
        </div>
      )}

      {/* Tag de localização / capítulo */}
      {slide.tag && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "rgba(0,0,0,0.58)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "5px 14px",
            color: "rgba(255,255,255,0.45)",
            fontSize: 11,
            fontFamily: "'Segoe UI', sans-serif",
            fontStyle: "italic",
            letterSpacing: "0.03em",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {slide.isNarrator ? "📖" : "📍"} {slide.tag}
        </div>
      )}

      {/* Pontos de progresso */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 88,
          display: "flex",
          gap: 5,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        {slides.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === currentSlide ? 18 : 5,
              height: 5,
              borderRadius: 3,
              background:
                i === currentSlide
                  ? "rgba(255,255,255,0.92)"
                  : "rgba(255,255,255,0.2)",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Botão Pular */}
      <button
        onClick={e => {
          e.stopPropagation()
          onSkip()
        }}
        style={{
          position: "absolute",
          top: 14,
          right: 16,
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "rgba(255,255,255,0.6)",
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 13,
          cursor: "pointer",
          zIndex: 10,
          fontFamily: "'Segoe UI', sans-serif",
          backdropFilter: "blur(4px)",
          letterSpacing: "0.04em",
        }}
      >
        ⏭ Pular
      </button>

      {/* Caixa de diálogo inferior */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(3,4,10,0.93)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          padding: "18px 24px 26px",
          minHeight: 128,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Badge do orador */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: `${slide.speakerColor}16`,
            border: `1px solid ${slide.speakerColor}50`,
            color: slide.speakerColor,
            fontFamily: "'Segoe UI', sans-serif",
            fontWeight: 700,
            fontSize: 12,
            padding: "3px 14px",
            borderRadius: 20,
            marginBottom: 10,
            letterSpacing: "0.04em",
          }}
        >
          {slide.isNarrator ? "📖" : "💬"} {slide.speakerName}
        </div>

        {/* Texto com animação de entrada */}
        <p
          key={textKey}
          style={{
            fontFamily: "'Segoe UI', sans-serif",
            fontSize: "clamp(14px, 1.85vw, 17px)",
            color: "#f0f9ff",
            lineHeight: 1.68,
            margin: 0,
            fontWeight: 400,
            animation: "tutFadeIn 0.32s ease both",
          }}
        >
          {slide.text}
        </p>

        {/* Botão avançar */}
        <button
          onClick={onAdvance}
          style={{
            position: "absolute",
            bottom: 20,
            right: 24,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.22)",
            color: "rgba(255,255,255,0.55)",
            borderRadius: 8,
            padding: "5px 18px",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "'Segoe UI', sans-serif",
            letterSpacing: "0.04em",
            transition: "border-color 0.2s, color 0.2s",
          }}
        >
          {isLast ? "Escolher Mestre ►" : "Avançar ►"}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2 — SELEÇÃO DE MESTRE
// ═══════════════════════════════════════════════════════════════════════════════

function MasterSelectPhase({
  playerName,
  onSelect,
  selectedMaster,
  confirmed,
}: {
  playerName: string
  onSelect: (id: TutorialMasterId) => void
  selectedMaster: TutorialMasterId | null
  confirmed: boolean
}) {
  const [hovered, setHovered] = useState<TutorialMasterId | null>(null)

  /* ── Tela de confirmação após escolha ── */
  if (confirmed && selectedMaster) {
    const m = MASTERS[selectedMaster]
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 60%, ${m.bgGlow} 0%, #050208 70%)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI', sans-serif",
          animation: "tutFadeIn 0.4s ease both",
        }}
      >
        <img
          src={m.art}
          alt={m.name}
          style={{
            height: "clamp(210px, 46vh, 400px)",
            objectFit: "contain",
            filter: `drop-shadow(0 0 55px ${m.shadowGlow})`,
            animation: "tutMasterIn 0.65s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        />
        <h2
          style={{
            color: m.color,
            fontSize: "clamp(20px, 3.2vw, 32px)",
            fontWeight: 800,
            textShadow: `0 0 30px ${m.shadowGlow}`,
            margin: "14px 0 8px",
            textAlign: "center",
          }}
        >
          {m.name}
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: "clamp(13px, 1.7vw, 17px)",
            textAlign: "center",
            lineHeight: 1.6,
            maxWidth: 460,
          }}
        >
          {playerName}, fico muito feliz com sua escolha!
          <br />
          <span style={{ color: m.color, fontWeight: 700 }}>
            Você tem MUITO a aprender comigo daqui pra frente!
          </span>
        </p>
      </div>
    )
  }

  /* ── Tela de seleção ── */
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 20%, #120640 0%, #04010e 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      {/* Blobs de luz ambiente */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 12% 78%, rgba(56,189,248,0.07) 0%, transparent 40%)," +
            "radial-gradient(circle at 88% 18%, rgba(168,85,247,0.07) 0%, transparent 40%)," +
            "radial-gradient(circle at 50% 92%, rgba(148,163,184,0.05) 0%, transparent 35%)",
          pointerEvents: "none",
        }}
      />

      {/* Cabeçalho */}
      <div
        style={{
          paddingTop: "clamp(16px, 4vh, 34px)",
          textAlign: "center",
          zIndex: 1,
          animation: "tutFadeIn 0.5s ease both",
        }}
      >
        <p
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            color: "rgba(255,255,255,0.32)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          A GRANDE ORDEM
        </p>
        <h1
          style={{
            fontSize: "clamp(19px, 3.2vw, 34px)",
            fontWeight: 800,
            color: "#f0f9ff",
            textShadow: "0 0 40px rgba(168,85,247,0.45)",
            margin: "0 0 8px",
          }}
        >
          Escolha seu Mestre de Jornada
        </h1>
        <p
          style={{
            fontSize: "clamp(12px, 1.4vw, 15px)",
            color: "rgba(255,255,255,0.38)",
          }}
        >
          Cada Mestre vem com um Deck inicial exclusivo
        </p>
      </div>

      {/* Grade de cartões */}
      <div
        style={{
          display: "flex",
          gap: "clamp(10px, 2vw, 22px)",
          padding: "clamp(12px, 2.5vh, 26px) clamp(12px, 3vw, 36px)",
          flex: 1,
          alignItems: "flex-start",
          zIndex: 1,
          maxWidth: 1000,
          width: "100%",
          overflow: "auto",
        }}
      >
        {(["fehnon", "morgana", "calem"] as TutorialMasterId[]).map((id, idx) => {
          const m = MASTERS[id]
          const isSel = selectedMaster === id
          const isHov = hovered === id

          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flex: 1,
                maxWidth: 310,
                background:
                  isSel || isHov
                    ? `radial-gradient(ellipse at 50% 100%, ${m.bgGlow} 0%, rgba(0,0,0,0.88) 70%)`
                    : "rgba(255,255,255,0.02)",
                border: `2px solid ${
                  isSel ? m.color : isHov ? m.color + "65" : "rgba(255,255,255,0.07)"
                }`,
                borderRadius: 20,
                cursor: "pointer",
                padding: 0,
                overflow: "hidden",
                boxShadow: isSel ? `0 0 36px ${m.bgGlow}` : "none",
                transform: isSel
                  ? "scale(1.04) translateY(-6px)"
                  : isHov
                  ? "translateY(-4px)"
                  : "none",
                transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                animation: `tutFadeIn 0.5s ease ${idx * 0.1}s both`,
              }}
            >
              {/* Faixa decorativa colorida no topo */}
              <div
                style={{
                  height: 4,
                  width: "100%",
                  background: `linear-gradient(90deg, transparent, ${m.color}, transparent)`,
                }}
              />

              {/* Zona da arte */}
              <div
                style={{
                  height: "clamp(148px, 25vh, 240px)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  background: `radial-gradient(ellipse at 50% 90%, ${m.bgGlow} 0%, transparent 70%)`,
                  overflow: "hidden",
                  width: "100%",
                }}
              >
                <img
                  src={m.art}
                  alt={m.name}
                  style={{
                    height: "112%",
                    objectFit: "contain",
                    objectPosition: "bottom",
                    filter: isSel
                      ? `drop-shadow(0 0 26px ${m.shadowGlow})`
                      : "none",
                    transition: "filter 0.3s ease",
                  }}
                />
              </div>

              {/* Info */}
              <div
                style={{
                  padding: "13px 15px 17px",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    color: m.color,
                    background: m.bgGlow,
                    padding: "2px 10px",
                    borderRadius: 20,
                    textTransform: "uppercase",
                    fontFamily: "'Segoe UI', sans-serif",
                  }}
                >
                  {m.element}
                </span>

                <h3
                  style={{
                    fontSize: "clamp(14px, 1.55vw, 18px)",
                    fontWeight: 800,
                    color: "#f0f9ff",
                    margin: "8px 0 4px",
                    fontFamily: "'Segoe UI', sans-serif",
                  }}
                >
                  {m.name}
                </h3>

                <div
                  style={{
                    fontSize: 11,
                    color: m.color,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    marginBottom: 8,
                    fontFamily: "'Segoe UI', sans-serif",
                  }}
                >
                  📦 {m.deckName}
                </div>

                <p
                  style={{
                    fontSize: "clamp(11px, 1.05vw, 13px)",
                    color: "rgba(255,255,255,0.42)",
                    lineHeight: 1.48,
                    margin: "0 0 14px",
                    fontFamily: "'Segoe UI', sans-serif",
                  }}
                >
                  {m.deckDesc}
                </p>

                {/* Botão de seleção */}
                <div
                  style={{
                    background: isSel ? m.color : `${m.color}16`,
                    border: `1px solid ${m.color}55`,
                    borderRadius: 10,
                    padding: "8px 0",
                    color: isSel ? "white" : m.color,
                    fontSize: 12,
                    fontWeight: 800,
                    textAlign: "center",
                    letterSpacing: "0.07em",
                    fontFamily: "'Segoe UI', sans-serif",
                    transition: "all 0.22s ease",
                  }}
                >
                  {isSel ? "✓ SELECIONADO" : "ESCOLHER"}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK: MAIN MENU
// ═══════════════════════════════════════════════════════════════════════════════

function MockMainMenu({
  masterId,
  jogarRef,
  colecaoRef,
  gachaRef,
  sidebarRef,
}: {
  masterId: TutorialMasterId
  jogarRef: React.RefObject<HTMLButtonElement | null>
  colecaoRef: React.RefObject<HTMLButtonElement | null>
  gachaRef: React.RefObject<HTMLButtonElement | null>
  sidebarRef: React.RefObject<HTMLDivElement | null>
}) {
  const m = MASTERS[masterId]

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: `radial-gradient(ellipse at 65% 50%, ${m.bgGlow} 0%, #080510 70%)`,
        fontFamily: "'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Barra superior ── */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            👤
          </div>
          <div>
            <div style={{ color: "#f0f9ff", fontWeight: 700, fontSize: 13 }}>Jogador</div>
            <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 10 }}>Novo Guardião</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "5px 14px",
              color: "#a3e635",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ⚡ 5/5
          </div>
          <div
            style={{
              background: "rgba(255,153,0,0.11)",
              border: "1px solid rgba(255,153,0,0.22)",
              borderRadius: 20,
              padding: "5px 14px",
              color: "#fbbf24",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ◎ 500
          </div>
        </div>
      </div>

      {/* ── Corpo ── */}
      <div style={{ flex: 1, display: "flex", position: "relative", minHeight: 0 }}>
        {/* Painel esquerdo */}
        <div
          style={{
            width: "clamp(150px, 20vw, 230px)",
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${m.color}28`,
              borderRadius: 14,
              padding: 10,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.28)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Mestre
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img
                src={m.art}
                style={{ width: 34, height: 34, objectFit: "contain" }}
                alt=""
              />
              <div>
                <div style={{ color: m.color, fontWeight: 700, fontSize: 11 }}>{m.name}</div>
                <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 9 }}>Lv.1</div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: 10,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.26)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Deck Ativo
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f0f9ff" }}>{m.deckName}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>20 cartas</div>
          </div>
        </div>

        {/* Centro — botões principais */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            paddingBottom: 28,
          }}
        >
          {/* JOGAR */}
          <button
            ref={jogarRef}
            style={{
              width: "clamp(185px, 25vw, 275px)",
              padding: "22px 0",
              background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)",
              border: "1px solid rgba(56,189,248,0.35)",
              borderRadius: 16,
              color: "white",
              fontWeight: 800,
              fontSize: "clamp(16px, 2.2vw, 22px)",
              cursor: "default",
              letterSpacing: "0.08em",
              boxShadow: "0 4px 20px rgba(29,78,216,0.38)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            ⚔️ JOGAR
          </button>

          {/* COLEÇÃO + GACHA */}
          <div
            style={{
              display: "flex",
              gap: 10,
              width: "clamp(185px, 25vw, 275px)",
            }}
          >
            <button
              ref={colecaoRef}
              style={{
                flex: 1,
                padding: "13px 0",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.13)",
                borderRadius: 14,
                color: "#f0f9ff",
                fontWeight: 700,
                fontSize: "clamp(11px, 1.25vw, 14px)",
                cursor: "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                fontFamily: "'Segoe UI', sans-serif",
              }}
            >
              📚 COLEÇÃO
            </button>
            <button
              ref={gachaRef}
              style={{
                flex: 1,
                padding: "13px 0",
                background: "linear-gradient(135deg, #7e1d5f 0%, #be185d 100%)",
                border: "1px solid rgba(244,114,182,0.28)",
                borderRadius: 14,
                color: "white",
                fontWeight: 700,
                fontSize: "clamp(11px, 1.25vw, 14px)",
                cursor: "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                fontFamily: "'Segoe UI', sans-serif",
              }}
            >
              ✨ GACHA
            </button>
          </div>
        </div>

        {/* Arte do Mestre (decorativo) */}
        <img
          src={m.art}
          alt=""
          style={{
            position: "absolute",
            right: 66,
            bottom: 0,
            height: "clamp(175px, 47vh, 395px)",
            objectFit: "contain",
            objectPosition: "bottom",
            filter: `drop-shadow(0 0 40px ${m.bgGlow})`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Barra lateral direita */}
        <div
          ref={sidebarRef}
          style={{
            width: 62,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            padding: "8px 0",
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          {[
            { label: "DECK", icon: "⚒️" },
            { label: "HISTÓ", icon: "📜" },
            { label: "CONF.", icon: "⚙️" },
            { label: "DIÁR.", icon: "🎁" },
            { label: "TEMA", icon: "🖼️" },
            { label: "HIST.", icon: "📖" },
            { label: "MESTRE", icon: "⭐" },
          ].map(({ label, icon }) => (
            <div
              key={label}
              style={{
                width: 52,
                padding: "6px 2px",
                background: "rgba(0,0,0,0.65)",
                border: "1px solid rgba(124,58,237,0.13)",
                borderRadius: 12,
                color: "rgba(255,255,255,0.4)",
                fontSize: 8,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: 1.3,
                cursor: "default",
                fontFamily: "'Segoe UI', sans-serif",
              }}
            >
              <div style={{ fontSize: 14, marginBottom: 2 }}>{icon}</div>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Barra de navegação inferior ── */}
      <div
        style={{
          padding: "8px 0 12px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          background: "rgba(0,0,0,0.7)",
          flexShrink: 0,
        }}
      >
        {["👥 SOCIAL", "🎯 MISSÕES", "🏰 GUILDA", "🛒 LOJA", "👤 PERFIL"].map(item => (
          <div
            key={item}
            style={{
              color: "rgba(255,255,255,0.36)",
              fontSize: "clamp(8px, 1vw, 11px)",
              fontWeight: 600,
              textAlign: "center",
              fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK: DUEL SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function MockDuelScreen({
  masterId,
  handRef,
  tapRef,
  fieldRef,
  battleRef,
}: {
  masterId: TutorialMasterId
  handRef: React.RefObject<HTMLDivElement | null>
  tapRef: React.RefObject<HTMLDivElement | null>
  fieldRef: React.RefObject<HTMLDivElement | null>
  battleRef: React.RefObject<HTMLButtonElement | null>
}) {
  const m = MASTERS[masterId]

  const handCards = [
    { label: "Unidade", dp: "2DP", color: m.color },
    { label: "Unidade", dp: "3DP", color: "#a855f7" },
    { label: "Função", dp: "—", color: "#22d3ee" },
    { label: "Ultimate", dp: "—", color: "#fbbf24" },
    { label: "Unidade", dp: "1DP", color: "#4ade80" },
  ]

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(180deg, #02050d 0%, #050b18 100%)",
        fontFamily: "'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Estrelas */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.6) 0%, transparent 100%)," +
            "radial-gradient(1px 1px at 82% 14%, rgba(255,255,255,0.5) 0%, transparent 100%)," +
            "radial-gradient(1.5px 1.5px at 55% 68%, rgba(255,255,255,0.55) 0%, transparent 100%)," +
            "radial-gradient(1px 1px at 91% 78%, rgba(255,255,255,0.42) 0%, transparent 100%)," +
            "radial-gradient(1px 1px at 30% 42%, rgba(255,255,255,0.38) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Barra superior ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 14px",
          flexShrink: 0,
          gap: 10,
        }}
      >
        <div
          style={{
            background: "rgba(220,38,38,0.22)",
            border: "2px solid #ef4444",
            borderRadius: 12,
            padding: "8px 18px",
            color: "white",
            fontWeight: 800,
            fontSize: "clamp(13px, 1.75vw, 18px)",
          }}
        >
          Oponente — <span style={{ color: "#fca5a5" }}>LP: 50</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "6px 14px",
              color: "#fbbf24",
              fontWeight: 800,
              fontSize: "clamp(12px, 1.5vw, 16px)",
            }}
          >
            TURNO 1
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #14532d 0%, #15803d 100%)",
              border: "1px solid #22c55e",
              borderRadius: 10,
              padding: "8px 16px",
              color: "white",
              fontWeight: 800,
              fontSize: "clamp(11px, 1.4vw, 15px)",
              letterSpacing: "0.05em",
            }}
          >
            SEU TURNO
          </div>
        </div>
      </div>

      {/* ── Campo + Log ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, gap: 8, padding: "0 8px" }}>
        {/* Campo central */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Zona do Oponente */}
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "74px 74px 1fr 74px 74px 74px",
              gap: 6,
              alignContent: "center",
              padding: "2px 2px",
            }}
          >
            {/* Carta do oponente */}
            <div
              style={{
                background: "rgba(168,85,247,0.12)",
                border: "1px solid rgba(168,85,247,0.28)",
                borderRadius: 10,
                aspectRatio: "0.7",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: 4,
              }}
            >
              <div style={{ fontSize: 9, color: "#a855f7", fontWeight: 700 }}>3DP</div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.28)" }}>Oponente</div>
            </div>

            {/* TAP slot */}
            <div
              ref={tapRef}
              style={{
                background: "rgba(249,115,22,0.2)",
                border: "2px solid #f97316",
                borderRadius: 10,
                aspectRatio: "0.7",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "default",
              }}
            >
              <div style={{ color: "#fb923c", fontWeight: 800, fontSize: 12 }}>TAP</div>
              <div style={{ color: "#fb923c", fontSize: 10 }}>3</div>
            </div>

            {/* Scenario */}
            <div
              style={{
                background: "rgba(120,70,0,0.1)",
                border: "1px solid rgba(161,98,7,0.22)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.16)",
                fontSize: 9,
                letterSpacing: "0.04em",
              }}
            >
              SCENARIO
            </div>

            {/* Slots vazios oponente */}
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  background: "rgba(168,85,247,0.04)",
                  border: "1px dashed rgba(168,85,247,0.1)",
                  borderRadius: 10,
                  aspectRatio: "0.7",
                }}
              />
            ))}
          </div>

          {/* Divisor */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
              flexShrink: 0,
            }}
          />

          {/* Zona do Jogador */}
          <div
            ref={fieldRef}
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "74px 74px 1fr 74px 74px 74px",
              gap: 6,
              alignContent: "center",
              padding: "2px 2px",
            }}
          >
            {/* Carta do jogador em campo */}
            <div
              style={{
                background: m.bgGlow,
                border: `1px solid ${m.color}50`,
                borderRadius: 10,
                aspectRatio: "0.7",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: 4,
              }}
            >
              <div style={{ fontSize: 9, color: m.color, fontWeight: 700 }}>2DP</div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>Fehnon</div>
            </div>

            {/* Slot vazio */}
            <div
              style={{
                background: "rgba(0,0,0,0.22)",
                border: "1px dashed rgba(255,255,255,0.07)",
                borderRadius: 10,
                aspectRatio: "0.7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.07)",
                fontSize: 20,
              }}
            >
              +
            </div>

            {/* Zona MAIN */}
            <div
              style={{
                background: `${m.bgGlow}60`,
                border: `1px solid ${m.color}14`,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.13)",
                fontSize: 9,
              }}
            >
              MAIN
            </div>

            {/* Slots de função vazios */}
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  background: `${m.bgGlow}40`,
                  border: `1px dashed ${m.color}12`,
                  borderRadius: 10,
                  aspectRatio: "0.7",
                }}
              />
            ))}
          </div>
        </div>

        {/* Painel direito (log + botão batalha) */}
        <div
          style={{
            width: 154,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.26)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              LOG
            </div>
            <div
              style={{
                fontSize: 10,
                color: `${m.color}bb`,
                lineHeight: 1.7,
              }}
            >
              T1 — Você comprou carta
              <br />
              T1 — Fehnon em campo
            </div>
          </div>

          <button
            ref={battleRef}
            style={{
              background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
              border: "1px solid #22c55e",
              borderRadius: 12,
              padding: "13px 0",
              color: "white",
              fontWeight: 800,
              fontSize: 13,
              cursor: "default",
              letterSpacing: "0.04em",
              fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            ⚔️ Ir para Batalha
          </button>
        </div>
      </div>

      {/* ── Mão do jogador ── */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(0,0,0,0.65)",
          padding: "8px 10px 12px",
          flexShrink: 0,
        }}
      >
        {/* LP */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)",
              border: "1px solid rgba(56,189,248,0.3)",
              borderRadius: 20,
              padding: "5px 16px",
              color: "white",
              fontWeight: 800,
              fontSize: "clamp(11px, 1.35vw, 15px)",
            }}
          >
            Você — <span style={{ color: "#93c5fd" }}>LP: 50</span>
          </div>
        </div>

        {/* Cartas */}
        <div
          ref={handRef}
          style={{
            display: "flex",
            gap: "clamp(5px, 1vw, 10px)",
            justifyContent: "center",
          }}
        >
          {handCards.map((card, i) => (
            <div
              key={i}
              style={{
                width: "clamp(46px, 6.2vw, 76px)",
                aspectRatio: "0.7",
                background: `linear-gradient(160deg, ${card.color}17 0%, rgba(0,0,0,0.87) 100%)`,
                border: `1px solid ${card.color}50`,
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: 4,
                cursor: "default",
              }}
            >
              <div
                style={{
                  color: card.color,
                  fontWeight: 700,
                  fontSize: "clamp(7px, 0.75vw, 9px)",
                }}
              >
                {card.dp}
              </div>
              <div
                style={{
                  fontSize: "clamp(5px, 0.58vw, 7px)",
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 1,
                  textAlign: "center",
                }}
              >
                {card.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK: GACHA SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function MockGachaScreen({
  masterId,
  opened,
  packRef,
  openRef,
}: {
  masterId: TutorialMasterId
  opened: boolean
  packRef: React.RefObject<HTMLDivElement | null>
  openRef: React.RefObject<HTMLButtonElement | null>
}) {
  const m = MASTERS[masterId]

  const revealedCards = [
    { name: "Fehnon Hoskie", rarity: "SR", color: "#a78bfa" },
    { name: "Morgana", rarity: "R", color: "#94a3b8" },
    { name: "Aquos Gear", rarity: "SR", color: "#a78bfa" },
    { name: "Carta Rara", rarity: "UR", color: "#fbbf24" },
  ]

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(135deg, #07040e 0%, #0d0820 50%, #07040e 100%)",
        fontFamily: "'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Barra superior */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 13 }}>← VOLTAR</span>
        <h1
          style={{
            color: "#fbbf24",
            fontWeight: 800,
            fontSize: "clamp(15px, 2.1vw, 20px)",
            letterSpacing: "0.1em",
            margin: 0,
            textShadow: "0 0 14px rgba(251,191,36,0.5)",
          }}
        >
          👑 GACHA 👑
        </h1>
        <span style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700 }}>◎ 500</span>
      </div>

      {opened ? (
        /* Cartas reveladas */
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: 20,
          }}
        >
          <h2
            style={{
              color: "#fbbf24",
              fontWeight: 800,
              fontSize: "clamp(16px, 2.4vw, 26px)",
              margin: 0,
              textShadow: "0 0 24px rgba(251,191,36,0.8)",
              animation: "tutTextGlow 1s ease-in-out infinite",
            }}
          >
            ✨ Pack Aberto!
          </h2>
          <div
            style={{
              display: "flex",
              gap: "clamp(8px, 1.8vw, 18px)",
              animation: "tutFadeIn 0.5s ease both",
            }}
          >
            {revealedCards.map((card, i) => (
              <div
                key={i}
                style={{
                  width: "clamp(72px, 9vw, 122px)",
                  aspectRatio: "0.7",
                  background: `linear-gradient(160deg, ${card.color}26 0%, rgba(0,0,0,0.9) 100%)`,
                  border: `2px solid ${card.color}`,
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "8px",
                  boxShadow: `0 0 18px ${card.color}38`,
                  animation: `tutCardReveal 0.4s ease ${i * 0.1}s both`,
                }}
              >
                <div
                  style={{
                    fontSize: "clamp(8px, 0.85vw, 11px)",
                    color: card.color,
                    fontWeight: 800,
                    background: `${card.color}18`,
                    padding: "2px 8px",
                    borderRadius: 20,
                    marginBottom: 4,
                  }}
                >
                  {card.rarity}
                </div>
                <div
                  style={{
                    fontSize: "clamp(7px, 0.72vw, 9px)",
                    color: "rgba(255,255,255,0.42)",
                    textAlign: "center",
                  }}
                >
                  {card.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Exibição do pack */
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            padding: 20,
          }}
        >
          {/* Banner do pack */}
          <div
            ref={packRef}
            style={{
              width: "clamp(255px, 46vw, 468px)",
              background: `linear-gradient(160deg, ${m.bgGlow} 0%, rgba(0,0,0,0.65) 100%)`,
              border: `2px solid ${m.color}38`,
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: `0 8px 40px ${m.bgGlow}`,
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                textAlign: "center",
                background: `linear-gradient(135deg, ${m.bgGlow} 0%, rgba(0,0,0,0.28) 100%)`,
              }}
            >
              <div
                style={{
                  color: "#fbbf24",
                  fontSize: "clamp(14px, 2.2vw, 22px)",
                  fontWeight: 800,
                  marginBottom: 4,
                  textShadow: "0 0 14px rgba(251,191,36,0.5)",
                }}
              >
                ✨ 4 Cartas LEGEND Disponíveis!
              </div>
              <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 11 }}>
                Pack Tutorial · Gratuito
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 8,
                padding: "14px 16px 18px",
              }}
            >
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  style={{
                    width: "clamp(38px, 5.2vw, 62px)",
                    aspectRatio: "0.7",
                    background: `linear-gradient(135deg, ${m.color}10 0%, rgba(0,0,0,0.8) 100%)`,
                    border: `1px solid ${m.color}28`,
                    borderRadius: 8,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Botão abrir */}
          <button
            ref={openRef}
            style={{
              background: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
              border: "1px solid #f59e0b",
              borderRadius: 14,
              padding: "14px 40px",
              color: "white",
              fontWeight: 800,
              fontSize: "clamp(13px, 1.75vw, 17px)",
              cursor: "default",
              boxShadow: "0 4px 20px rgba(217,119,6,0.5)",
              letterSpacing: "0.05em",
              fontFamily: "'Segoe UI', sans-serif",
              animation: "tutRingPulse 2s ease-in-out infinite",
            }}
          >
            ✨ GACHA x1 — GRÁTIS
          </button>

          <div
            style={{
              color: "rgba(255,255,255,0.26)",
              fontSize: 11,
              textAlign: "center",
              fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            LR 0.5% · UR 4.5% · SR 25% · R 70%
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE FINAL — CONCLUSÃO DO TUTORIAL
// ═══════════════════════════════════════════════════════════════════════════════

function CompletePhase({
  masterId,
  playerName,
  onComplete,
}: {
  masterId: TutorialMasterId
  playerName: string
  onComplete: () => void
}) {
  const m = MASTERS[masterId]
  const [vis, setVis] = useState(false)
  useEffect(() => {
    setTimeout(() => setVis(true), 100)
  }, [])

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: `radial-gradient(ellipse at 50% 65%, ${m.bgGlow} 0%, #040108 70%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(16px, 4vw, 40px)",
        fontFamily: "'Segoe UI', sans-serif",
        opacity: vis ? 1 : 0,
        transition: "opacity 0.75s ease",
      }}
    >
      {/* Arte do Mestre */}
      <img
        src={m.art}
        alt={m.name}
        style={{
          height: "clamp(175px, 38vh, 350px)",
          objectFit: "contain",
          filter: `drop-shadow(0 0 55px ${m.shadowGlow})`,
          marginBottom: 20,
          animation: vis ? "tutMasterIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both" : "none",
        }}
      />

      {/* Mensagem final */}
      <div
        style={{
          background: "rgba(0,0,0,0.72)",
          border: `1px solid ${m.color}25`,
          borderRadius: 20,
          padding: "clamp(18px, 2.8vw, 28px) clamp(22px, 4vw, 42px)",
          maxWidth: 560,
          textAlign: "center",
          backdropFilter: "blur(10px)",
          animation: vis ? "tutFadeIn 0.5s ease 0.3s both" : "none",
        }}
      >
        <p
          style={{
            fontSize: "clamp(13px, 1.7vw, 17px)",
            color: "#f0f9ff",
            lineHeight: 1.78,
            margin: "0 0 22px",
            fontWeight: 400,
          }}
        >
          <strong style={{ color: m.color }}>{playerName}</strong>, você está pronto(a) para essa
          jornada!
          <br />
          Jogue duelos no{" "}
          <span style={{ color: m.color, fontWeight: 700 }}>Modo História</span>, colecione cartas no{" "}
          <span style={{ color: m.color, fontWeight: 700 }}>Gacha</span> e monte um deck invencível!
          <br />
          <br />
          Boa sorte e divirta-se muito jogando{" "}
          <span style={{ color: m.color, fontWeight: 800 }}>Gear Perks CARD! ⭐</span>
        </p>

        <button
          onClick={onComplete}
          style={{
            background: `linear-gradient(135deg, ${m.color}aa 0%, ${m.color} 100%)`,
            border: "none",
            borderRadius: 14,
            padding: "clamp(12px, 1.4vw, 15px) clamp(28px, 4vw, 48px)",
            color: "white",
            fontWeight: 800,
            fontSize: "clamp(13px, 1.65vw, 17px)",
            cursor: "pointer",
            boxShadow: `0 4px 24px ${m.shadowGlow}`,
            letterSpacing: "0.06em",
            fontFamily: "'Segoe UI', sans-serif",
            transition: "transform 0.12s ease, box-shadow 0.12s ease",
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.transform = "scale(1.04)"
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 32px ${m.shadowGlow}`
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 24px ${m.shadowGlow}`
          }}
        >
          🌟 Começar Jornada!
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS — ANIMAÇÕES GLOBAIS DO TUTORIAL
// ═══════════════════════════════════════════════════════════════════════════════

const TUTORIAL_CSS = `
  @keyframes tutFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes tutSlideLeft {
    from { opacity: 0; transform: translateX(-44px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes tutSlideRight {
    from { opacity: 0; transform: translateX(44px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes tutMasterIn {
    from { opacity: 0; transform: scale(0.78) translateY(22px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes tutRingPulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }
  @keyframes tutCardReveal {
    from { opacity: 0; transform: translateY(30px) scale(0.82); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes tutTextGlow {
    0%, 100% { text-shadow: 0 0 20px rgba(251,191,36,0.6); }
    50%       { text-shadow: 0 0 42px rgba(251,191,36,1); }
  }
`

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — ORQUESTRADOR DO TUTORIAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function TutorialScreen({ playerName, onComplete }: TutorialScreenProps) {
  // ── Estado central
  const [phase, setPhase] = useState<TutorialPhase>("lore")
  const [loreStep, setLoreStep] = useState(0)
  const [selectedMaster, setSelectedMaster] = useState<TutorialMasterId | null>(null)
  const [masterConfirmed, setMasterConfirmed] = useState(false)
  const [menuStep, setMenuStep] = useState(0)
  const [duelStep, setDuelStep] = useState(0)
  const [gachaStep, setGachaStep] = useState(0)
  const [gachaOpened, setGachaOpened] = useState(false)
  const [visible, setVisible] = useState(false)

  // ── Refs para spotlight — Main Menu
  const menuJogarRef   = useRef<HTMLButtonElement>(null)
  const menuColecaoRef = useRef<HTMLButtonElement>(null)
  const menuGachaRef   = useRef<HTMLButtonElement>(null)
  const menuSidebarRef = useRef<HTMLDivElement>(null)

  // ── Refs para spotlight — Duelo
  const duelHandRef   = useRef<HTMLDivElement>(null)
  const duelTapRef    = useRef<HTMLDivElement>(null)
  const duelFieldRef  = useRef<HTMLDivElement>(null)
  const duelBattleRef = useRef<HTMLButtonElement>(null)

  // ── Refs para spotlight — Gacha
  const gachaPackRef = useRef<HTMLDivElement>(null)
  const gachaOpenRef = useRef<HTMLButtonElement>(null)

  const loreSlides = buildLoreSlides(playerName)

  // ── Restaurar progresso salvo (pula lore se Mestre já foi escolhido)
  useEffect(() => {
    const saved = loadTut()
    if (saved) {
      setSelectedMaster(saved.masterId)
      setPhase(saved.phase)
    }
    setTimeout(() => setVisible(true), 80)
  }, [])

  // ── Callbacks de navegação
  const advanceLore = useCallback(() => {
    if (loreStep < loreSlides.length - 1) setLoreStep(s => s + 1)
    else setPhase("master-select")
  }, [loreStep, loreSlides.length])

  const skipLore = useCallback(() => setPhase("master-select"), [])

  const handleMasterSelect = useCallback((id: TutorialMasterId) => {
    setSelectedMaster(id)
    setMasterConfirmed(true)
    saveTut("menu-tour", id)
    setTimeout(() => {
      setMasterConfirmed(false)
      setPhase("menu-tour")
    }, 2700)
  }, [])

  const advanceMenu = useCallback(() => {
    if (menuStep < MENU_STEPS.length - 1) {
      setMenuStep(s => s + 1)
    } else {
      saveTut("duel-tutorial", selectedMaster)
      setPhase("duel-tutorial")
    }
  }, [menuStep, selectedMaster])

  const advanceDuel = useCallback(() => {
    if (duelStep < DUEL_STEPS.length - 1) {
      setDuelStep(s => s + 1)
    } else {
      saveTut("gacha-tutorial", selectedMaster)
      setPhase("gacha-tutorial")
    }
  }, [duelStep, selectedMaster])

  const advanceGacha = useCallback(() => {
    if (gachaStep === 1) setGachaOpened(true)
    if (gachaStep < GACHA_STEPS.length - 1) {
      setGachaStep(s => s + 1)
    } else {
      setPhase("complete")
    }
  }, [gachaStep])

  const handleComplete = useCallback(() => {
    clearTut()
    if (selectedMaster) onComplete(selectedMaster)
  }, [selectedMaster, onComplete])

  // ── Resolve qual ref usar como alvo do spotlight
  const resolveSpotlightRef = (): React.RefObject<HTMLElement | null> | null => {
    if (phase === "menu-tour") {
      const map = [menuJogarRef, menuColecaoRef, menuGachaRef, menuSidebarRef] as const
      return (map[menuStep] ?? null) as React.RefObject<HTMLElement | null>
    }
    if (phase === "duel-tutorial") {
      // índice 0 = overview (sem spotlight), índice 5 = win (sem spotlight)
      const map = [null, duelHandRef, duelTapRef, duelFieldRef, duelBattleRef, null] as const
      return (map[duelStep] ?? null) as React.RefObject<HTMLElement | null>
    }
    if (phase === "gacha-tutorial") {
      // índice 2 = result (sem spotlight)
      const map = [gachaPackRef, gachaOpenRef, null] as const
      return (map[gachaStep] ?? null) as React.RefObject<HTMLElement | null>
    }
    return null
  }

  const spotRef = resolveSpotlightRef()

  // ── Texto e label do balão de fala por fase/passo
  const bubbleText = (): string => {
    if (phase === "menu-tour")     return MENU_STEPS[menuStep]?.text ?? ""
    if (phase === "duel-tutorial") return DUEL_STEPS[duelStep]?.text ?? ""
    if (phase === "gacha-tutorial") return GACHA_STEPS[gachaStep]?.text ?? ""
    return ""
  }

  const bubbleNextLabel = (): string => {
    if (phase === "menu-tour")
      return menuStep === MENU_STEPS.length - 1 ? "Ir para o Duelo! ►" : "Continuar ►"
    if (phase === "duel-tutorial")
      return duelStep === DUEL_STEPS.length - 1 ? "Ir para o GACHA! ►" : "Entendido ►"
    if (phase === "gacha-tutorial")
      return gachaStep === GACHA_STEPS.length - 1 ? "Ir ao Menu! ►" : "Continuar ►"
    return "Continuar ►"
  }

  const bubbleAdvance = (): void => {
    if (phase === "menu-tour")     advanceMenu()
    if (phase === "duel-tutorial") advanceDuel()
    if (phase === "gacha-tutorial") advanceGacha()
  }

  // ── Helper: overlay de escurecimento sem spotlight quando não há alvo
  const DimOverlay = ({ opacity = 0.5 }: { opacity?: number }) => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: `rgba(0,0,0,${opacity})`,
        zIndex: 300,
        pointerEvents: "none",
      }}
    />
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.7s ease",
        zIndex: 9990,
      }}
    >
      <style>{TUTORIAL_CSS}</style>

      {/* ── FASE: LORE ─────────────────────────────────────────────────── */}
      {phase === "lore" && (
        <LorePhase
          slides={loreSlides}
          currentSlide={loreStep}
          onAdvance={advanceLore}
          onSkip={skipLore}
        />
      )}

      {/* ── FASE: SELEÇÃO DE MESTRE ────────────────────────────────────── */}
      {phase === "master-select" && (
        <MasterSelectPhase
          playerName={playerName}
          onSelect={handleMasterSelect}
          selectedMaster={selectedMaster}
          confirmed={masterConfirmed}
        />
      )}

      {/* ── FASE: TOUR DO MAIN MENU ────────────────────────────────────── */}
      {phase === "menu-tour" && selectedMaster && (
        <>
          <MockMainMenu
            masterId={selectedMaster}
            jogarRef={menuJogarRef}
            colecaoRef={menuColecaoRef}
            gachaRef={menuGachaRef}
            sidebarRef={menuSidebarRef}
          />
          {spotRef ? (
            <Spotlight targetRef={spotRef} />
          ) : (
            <DimOverlay opacity={0.55} />
          )}
          <MasterBubble
            masterId={selectedMaster}
            text={bubbleText()}
            onNext={bubbleAdvance}
            nextLabel={bubbleNextLabel()}
          />
        </>
      )}

      {/* ── FASE: TUTORIAL DO DUELO ────────────────────────────────────── */}
      {phase === "duel-tutorial" && selectedMaster && (
        <>
          <MockDuelScreen
            masterId={selectedMaster}
            handRef={duelHandRef}
            tapRef={duelTapRef}
            fieldRef={duelFieldRef}
            battleRef={duelBattleRef}
          />
          {spotRef ? (
            <Spotlight targetRef={spotRef} />
          ) : (
            <DimOverlay opacity={0.45} />
          )}
          <MasterBubble
            masterId={selectedMaster}
            text={bubbleText()}
            onNext={bubbleAdvance}
            nextLabel={bubbleNextLabel()}
          />
        </>
      )}

      {/* ── FASE: TUTORIAL DO GACHA ────────────────────────────────────── */}
      {phase === "gacha-tutorial" && selectedMaster && (
        <>
          <MockGachaScreen
            masterId={selectedMaster}
            opened={gachaOpened}
            packRef={gachaPackRef}
            openRef={gachaOpenRef}
          />
          {spotRef ? (
            <Spotlight targetRef={spotRef} />
          ) : (
            <DimOverlay opacity={0.3} />
          )}
          <MasterBubble
            masterId={selectedMaster}
            text={bubbleText()}
            onNext={bubbleAdvance}
            nextLabel={bubbleNextLabel()}
          />
        </>
      )}

      {/* ── FASE: CONCLUSÃO ────────────────────────────────────────────── */}
      {phase === "complete" && selectedMaster && (
        <CompletePhase
          masterId={selectedMaster}
          playerName={playerName}
          onComplete={handleComplete}
        />
      )}
    </div>
  )
}
