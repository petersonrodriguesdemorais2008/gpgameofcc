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
// DECK INICIAL — preview das cartas que cada Mestre entrega ao ser escolhido
// ═══════════════════════════════════════════════════════════════════════════════

interface DeckCard {
  name: string
  rarity: "UR" | "SR" | "R" | "C"
  qty: number
  icon: string
  color: string
}

interface StarterDeck { main: DeckCard[]; tap: DeckCard[] }

// Cartas neutras compartilhadas pelos 3 decks iniciais (mesmas em todos)
const SHARED_CARDS: Record<string, Omit<DeckCard, "name" | "qty">> = {
  "Chamado da Távola":        { rarity: "R", icon: "📯", color: "#fbbf24" },
  "Ruínas Abandonadas":       { rarity: "C", icon: "🏯", color: "#f97316" },
  "Dados do Destino":         { rarity: "C", icon: "🎲", color: "#ef4444" },
  "Amplificador de Poder":    { rarity: "C", icon: "📡", color: "#ef4444" },
  "Bandagem Restaurada":      { rarity: "C", icon: "🩹", color: "#4ade80" },
  "Brincadeira de Mau Gosto": { rarity: "C", icon: "🎭", color: "#ec4899" },
  "A Grande Ordem":           { rarity: "R", icon: "⭐", color: "#fbbf24" },
  "Laços da Ordem":           { rarity: "R", icon: "🔗", color: "#38bdf8" },
}
/** Helper: monta uma carta compartilhada com a quantidade desejada */
const sc = (name: string, qty: number): DeckCard => ({ name, qty, ...SHARED_CARDS[name] })

const STARTER_DECKS: Record<TutorialMasterId, StarterDeck> = {
  fehnon: {
    main: [
      { name: "Fehnon Hoskie", rarity: "SR", qty: 4, icon: "⚔️", color: "#38bdf8" },
      { name: "Fehnon Hoskie", rarity: "UR", qty: 1, icon: "⚔️", color: "#38bdf8" },
      sc("Chamado da Távola", 2),
      { name: "O Lorde Penguim, Mr. P", rarity: "R", qty: 1, icon: "🐧", color: "#38bdf8" },
      { name: "Vivian, A Dama do Lago", rarity: "R", qty: 1, icon: "🧚", color: "#38bdf8" },
      sc("Ruínas Abandonadas", 1),
      sc("Dados do Destino", 2),
      sc("Amplificador de Poder", 2),
      sc("Bandagem Restaurada", 2),
      sc("Brincadeira de Mau Gosto", 2),
      sc("A Grande Ordem", 1),
      sc("Laços da Ordem", 1),
    ],
    tap: [
      { name: "Protonix Sword", rarity: "UR", qty: 1, icon: "⚔️", color: "#38bdf8" },
      { name: "Ordem de Laceração", rarity: "SR", qty: 1, icon: "🌀", color: "#38bdf8" },
    ],
  },
  morgana: {
    main: [
      { name: "Morgana Pendragon", rarity: "SR", qty: 4, icon: "🎸", color: "#a855f7" },
      { name: "Morgana Pendragon", rarity: "UR", qty: 1, icon: "🎸", color: "#a855f7" },
      sc("Chamado da Távola", 2),
      { name: "Oeiste, O Comerciante", rarity: "R", qty: 1, icon: "🎒", color: "#a855f7" },
      { name: "Merlin, O Mago do Destino", rarity: "R", qty: 1, icon: "🔮", color: "#a855f7" },
      sc("Ruínas Abandonadas", 1),
      sc("Dados do Destino", 2),
      sc("Amplificador de Poder", 2),
      sc("Bandagem Restaurada", 2),
      sc("Brincadeira de Mau Gosto", 2),
      sc("A Grande Ordem", 1),
      sc("Laços da Ordem", 1),
    ],
    tap: [
      { name: "Twilight Avalon", rarity: "UR", qty: 1, icon: "🎸", color: "#a855f7" },
      { name: "Sinfonia Relâmpago", rarity: "SR", qty: 1, icon: "⚡", color: "#a855f7" },
    ],
  },
  calem: {
    main: [
      { name: "Calem Hidenori", rarity: "SR", qty: 4, icon: "✊", color: "#94a3b8" },
      { name: "Calem Hidenori", rarity: "UR", qty: 1, icon: "✊", color: "#94a3b8" },
      sc("Chamado da Távola", 2),
      { name: "Balin, O Sentinela das Sombras", rarity: "R", qty: 1, icon: "🛡️", color: "#94a3b8" },
      { name: "Lancelot, O Herdeiro Sagrado", rarity: "R", qty: 1, icon: "🗡️", color: "#94a3b8" },
      sc("Ruínas Abandonadas", 1),
      sc("Dados do Destino", 2),
      sc("Amplificador de Poder", 2),
      sc("Bandagem Restaurada", 2),
      sc("Brincadeira de Mau Gosto", 2),
      sc("A Grande Ordem", 1),
      sc("Laços da Ordem", 1),
    ],
    tap: [
      { name: "Ultimate Guardian Miguel Arcanjo", rarity: "UR", qty: 1, icon: "👼", color: "#94a3b8" },
      { name: "Julgamento do Vazio Eterno", rarity: "SR", qty: 1, icon: "🌌", color: "#94a3b8" },
    ],
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

// textTarget: texto do elemento real a destacar
//  "__SIDEBAR__" = lógica especial para a coluna lateral direita do main menu
//  null          = sem spotlight (só overlay de escurecimento)
const MENU_STEPS = [
  { text: "Este é o botão JOGAR! Aqui você escolhe o modo de batalha e entra em combate com o seu deck!",
    textTarget: "JOGAR" },
  { text: "Em COLEÇÃO você pode ver, organizar e gerenciar todas as cartas que você possui.",
    textTarget: "COLEÇÃO" },
  { text: "E o GACHA! Aqui você abre packs para conseguir novas cartas poderosas. Logo te mostro como funciona!",
    textTarget: "GACHA" },
  { text: "Esses botões te dão acesso ao Deck, Missões, Loja, Histórico e muito mais! Agora... vamos ao seu primeiro duelo!",
    textTarget: "__SIDEBAR__" },
]

const DUEL_STEPS = [
  { text: "Bem-vindo ao campo de batalha! Fique de olho nos LPs — quem chegar a zero perde o duelo.",
    textTarget: null },
  { text: "Estas são as cartas da sua mão. Arraste uma carta de Unidade para o campo e coloque-a em jogo!",
    textTarget: null },
  { text: "Este é o TAP! A cada 3 turnos do jogador, uma carta extra aparece aqui — de graça. Não esqueça de pegar!",
    textTarget: "TAP" },
  { text: "Sua Unidade está em campo! Selecione-a para iniciar um ataque contra uma carta do oponente.",
    textTarget: null },
  { text: "Clique em IR PARA BATALHA! Destrua as cartas inimigas e ataque diretamente para vencer o duelo!",
    textTarget: "Ir para Batalha" },
  { text: "INCRÍVEL! Você venceu seu primeiro duelo! Quanto mais você joga, mais forte e experiente você fica.",
    textTarget: null },
]

const GACHA_STEPS = [
  { text: "Hora da recompensa! Este pack é especial — é de graça só porque é seu primeiro dia aqui. Vamos abrir!",
    textTarget: null },
  { text: "Clique para abrir! Quem sabe que cartas raras vão aparecer para você...",
    textTarget: "GACHA x1" },
  { text: "Parabéns! Você ganhou suas primeiras cartas! Continue jogando duelos e abrindo packs para montar um deck invencível!",
    textTarget: null },
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

// ─── Helpers de busca no DOM real ────────────────────────────────────────────
type PixelRect = { x: number; y: number; w: number; h: number }

/** Remove acentos e normaliza para comparação */
const normText = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim()

/**
 * Encontra o menor elemento que contém exatamente `target` como texto visível.
 * Retorna o BoundingClientRect com padding.
 */
function findByText(target: string, pad = 10): PixelRect | null {
  const tNorm = normText(target)
  let best: Element | null = null
  let bestArea = Infinity

  document.querySelectorAll("button, a, div, span, p").forEach(el => {
    const elText = normText(el.textContent ?? "")
    // Contém o alvo e não é muito maior que ele (evita pegar container pai)
    if (elText.includes(tNorm) && elText.length <= tNorm.length * 5) {
      const r = el.getBoundingClientRect()
      const area = r.width * r.height
      if (r.width > 10 && r.height > 8 && r.top >= 0 && area < bestArea) {
        best = el
        bestArea = area
      }
    }
  })

  if (!best) return null
  const r = (best as Element).getBoundingClientRect()
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }
}

/**
 * Caso especial "__SIDEBAR__": encontra todos os botões laterais pelo texto
 * e retorna um rect que envolve todos eles.
 */
function findSidebar(pad = 6): PixelRect | null {
  const LABELS = ["DECK", "MESTRE", "CONFIG", "CONF", "TEMA", "LOJA", "DIAR", "HISTO", "HISTÓ"]
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let found = 0

  document.querySelectorAll("div, span, button").forEach(el => {
    const t = normText(el.textContent ?? "")
    if (LABELS.some(l => t === l || t.startsWith(l)) ) {
      const r = el.getBoundingClientRect()
      // Apenas elementos pequenos (botões de sidebar, não containers)
      if (r.width > 0 && r.width < 130 && r.height > 0 && r.height < 130) {
        minX = Math.min(minX, r.left)
        minY = Math.min(minY, r.top)
        maxX = Math.max(maxX, r.right)
        maxY = Math.max(maxY, r.bottom)
        found++
      }
    }
  })

  if (found === 0) return null
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}

// ─── DynamicSpotlight ─────────────────────────────────────────────────────────
/**
 * Spotlight que encontra o elemento pelo texto no DOM real —
 * funciona em qualquer resolução sem coordenadas hardcoded.
 */
function DynamicSpotlight({ textTarget }: { textTarget: string | null }) {
  const [r, setR] = useState<PixelRect | null>(null)

  useEffect(() => {
    if (!textTarget) { setR(null); return }

    const update = () => {
      const found =
        textTarget === "__SIDEBAR__" ? findSidebar() : findByText(textTarget)
      setR(found)
    }

    update()
    const t = setInterval(update, 350)
    window.addEventListener("resize", update)
    return () => { clearInterval(t); window.removeEventListener("resize", update) }
  }, [textTarget])

  // Sem alvo: escurece a tela inteira
  if (!textTarget || !r) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.62)", zIndex: 400, pointerEvents: "none",
      }} />
    )
  }

  const { x, y, w, h } = r

  return (
    <svg style={{
      position: "fixed", inset: 0, width: "100%", height: "100%",
      zIndex: 400, pointerEvents: "none", overflow: "visible",
    }}>
      <defs>
        <mask id="dyn-spl">
          <rect width="100%" height="100%" fill="white" />
          {/* Buraco no overlay: coordenadas em px vindas do getBoundingClientRect */}
          <rect x={x} y={y} width={w} height={h} rx={10} fill="black" />
        </mask>
      </defs>
      {/* Overlay escuro com buraco */}
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#dyn-spl)" />
      {/* Anel pulsante ao redor do elemento */}
      <rect
        x={x - 3} y={y - 3} width={w + 6} height={h + 6}
        rx={13} fill="none"
        stroke="rgba(255,255,255,0.55)" strokeWidth="2.5"
        style={{ animation: "tutRingPulse 1.6s ease-in-out infinite" }}
      />
      <rect
        x={x - 7} y={y - 7} width={w + 14} height={h + 14}
        rx={16} fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"
        style={{ animation: "tutRingPulse 1.6s ease-in-out infinite 0.3s" }}
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: DECK CARD TILE  (representação visual compacta de uma carta)
// ═══════════════════════════════════════════════════════════════════════════════

const RARITY_COLORS: Record<DeckCard["rarity"], string> = {
  UR: "#fbbf24", SR: "#c084fc", R: "#60a5fa", C: "#94a3b8",
}

function DeckCardTile({ card }: { card: DeckCard }) {
  const rc = RARITY_COLORS[card.rarity]
  return (
    <div style={{
      position: "relative", aspectRatio: "0.72", borderRadius: 9,
      overflow: "hidden", display: "flex", flexDirection: "column",
      border: `1.5px solid ${rc}50`,
      background: `linear-gradient(160deg, ${card.color}26 0%, rgba(8,8,14,0.92) 75%)`,
      boxShadow: card.rarity === "UR" || card.rarity === "SR" ? `0 0 12px ${rc}25` : "none",
    }}>
      {/* Faixa de raridade no topo */}
      <div style={{
        height: 3, width: "100%",
        background: `linear-gradient(90deg, transparent, ${rc}, transparent)`,
      }} />
      {/* Badge de raridade */}
      <div style={{
        position: "absolute", top: 6, left: 6,
        fontSize: "clamp(7px, 0.7vw, 9px)", fontWeight: 800,
        color: rc, background: `${rc}1c`,
        border: `1px solid ${rc}55`,
        padding: "1px 6px", borderRadius: 4, letterSpacing: "0.05em",
      }}>
        {card.rarity}
      </div>
      {/* Badge de quantidade */}
      {card.qty > 1 && (
        <div style={{
          position: "absolute", top: 6, right: 6,
          fontSize: "clamp(8px, 0.75vw, 10px)", fontWeight: 800, color: "#fff",
          background: "rgba(0,0,0,0.55)", padding: "1px 6px", borderRadius: 4,
        }}>
          ×{card.qty}
        </div>
      )}
      {/* Ícone central representando a arte da carta */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "clamp(22px, 3.6vw, 34px)",
        filter: `drop-shadow(0 0 10px ${card.color}50)`,
      }}>
        {card.icon}
      </div>
      {/* Nome da carta */}
      <div style={{
        padding: "4px 5px 6px", textAlign: "center",
        fontSize: "clamp(7px, 0.72vw, 9px)", fontWeight: 600,
        color: "rgba(255,255,255,0.78)", lineHeight: 1.28,
        background: "rgba(0,0,0,0.38)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {card.name}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: STARTER DECK MODAL  (preview do Deck Inicial de um Mestre)
// ═══════════════════════════════════════════════════════════════════════════════

function StarterDeckModal({ masterId, onClose }: { masterId: TutorialMasterId; onClose: () => void }) {
  const m = MASTERS[masterId]
  const deck = STARTER_DECKS[masterId]
  const totalMain = deck.main.reduce((s, c) => s + c.qty, 0)
  const totalTap = deck.tap.reduce((s, c) => s + c.qty, 0)

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(2,2,6,0.82)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(10px, 3vh, 30px)",
        animation: "tutFadeIn 0.22s ease both",
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#0a0a12", borderRadius: 18,
          border: `1px solid ${m.color}35`,
          width: "100%", maxWidth: 760, maxHeight: "88vh",
          overflowY: "auto", overflowX: "hidden",
          boxShadow: `0 0 70px ${m.color}22, 0 24px 70px rgba(0,0,0,0.65)`,
          animation: "msDeckModalIn 0.32s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 5,
          background: `linear-gradient(135deg, ${m.color}1c 0%, #0a0a12 85%)`,
          borderBottom: `1px solid ${m.color}28`,
          padding: "clamp(14px, 2.6vw, 22px) clamp(16px, 3vw, 26px)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{
              fontSize: "clamp(8px, 0.85vw, 10px)", color: `${m.color}dd`,
              letterSpacing: "0.24em", fontWeight: 800, textTransform: "uppercase", marginBottom: 5,
            }}>
              {m.name} · {m.deckName}
            </div>
            <div style={{ fontSize: "clamp(17px, 2.4vw, 24px)", fontWeight: 900, color: "#fff" }}>
              🃏 Deck Inicial
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.65)", fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s ease, color 0.2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff" }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.65)" }}
          >
            ✕
          </button>
        </div>

        {/* ── Corpo ── */}
        <div style={{ padding: "clamp(14px, 2.6vw, 24px)" }}>
          {/* Deck Principal */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "clamp(10px, 1.8vh, 14px)" }}>
            <span style={{ fontSize: 15 }}>⚔️</span>
            <span style={{ fontSize: "clamp(12px, 1.4vw, 15px)", fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
              Deck Principal
            </span>
            <span style={{ fontSize: "clamp(10px, 1.1vw, 12px)", color: "rgba(255,255,255,0.32)", fontWeight: 600 }}>
              ({totalMain} cartas)
            </span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
            gap: "clamp(6px, 1vw, 10px)",
          }}>
            {deck.main.map((card, i) => <DeckCardTile key={i} card={card} />)}
          </div>

          {/* TAP — Extra Deck */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "clamp(16px, 2.8vh, 24px) 0 clamp(10px, 1.8vh, 14px)" }}>
            <span style={{ fontSize: 15 }}>🌀</span>
            <span style={{ fontSize: "clamp(12px, 1.4vw, 15px)", fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>
              TAP — Extra Deck
            </span>
            <span style={{ fontSize: "clamp(10px, 1.1vw, 12px)", color: "rgba(255,255,255,0.32)", fontWeight: 600 }}>
              ({totalTap} cartas)
            </span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
            gap: "clamp(6px, 1vw, 10px)",
            maxWidth: 280,
          }}>
            {deck.tap.map((card, i) => <DeckCardTile key={i} card={card} />)}
          </div>

          {/* Nota explicativa */}
          <div style={{
            marginTop: "clamp(16px, 2.8vh, 22px)",
            padding: "clamp(11px, 1.8vh, 15px) clamp(13px, 2.2vw, 18px)",
            background: `${m.color}0e`, border: `1px solid ${m.color}28`,
            borderRadius: 11, textAlign: "center",
            fontSize: "clamp(10px, 1vw, 12px)", color: "rgba(255,255,255,0.55)", lineHeight: 1.65,
          }}>
            ✨ Ao escolher <strong style={{ color: m.color }}>{m.name}</strong> como seu Mestre, este deck completo
            ({totalMain + totalTap} cartas) será adicionado automaticamente à sua conta como{" "}
            <strong style={{ color: "#fff" }}>"Deck Inicial"</strong> e já estará pronto pra batalha no Main Menu.
          </div>
        </div>
      </div>
    </div>
  )
}

function MasterSelectPhase({ playerName, onSelect, selectedMaster, confirmed }: {
  playerName: string; onSelect: (id: TutorialMasterId) => void
  selectedMaster: TutorialMasterId | null; confirmed: boolean
}) {
  const [hovered, setHovered] = useState<TutorialMasterId | null>(null)
  const [entered, setEntered] = useState(false)
  const [viewingDeck, setViewingDeck] = useState<TutorialMasterId | null>(null)
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
              <div style={{ position: "absolute", bottom: "clamp(178px, 26vh, 231px)", left: 8, width: 14, height: 14, pointerEvents: "none", opacity: isActive ? 0.7 : 0.15, transition: "opacity 0.4s ease" }}>
                <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 1.5, background: m.color }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, width: 1.5, height: "100%", background: m.color }} />
              </div>
              {/* Canto inferior direito */}
              <div style={{ position: "absolute", bottom: "clamp(178px, 26vh, 231px)", right: 8, width: 14, height: 14, pointerEvents: "none", opacity: isActive ? 0.7 : 0.15, transition: "opacity 0.4s ease" }}>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: "100%", height: 1.5, background: m.color }} />
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 1.5, height: "100%", background: m.color }} />
              </div>

              {/* ── Pilar de luz vertical (coluna central, bottom-up) */}
              <div style={{
                position: "absolute", bottom: "clamp(176px, 25.5vh, 230px)", left: "50%",
                transform: "translateX(-50%)", width: "40%", height: "68%",
                background: `radial-gradient(ellipse at 50% 100%, ${m.color}${isActive ? "1e" : "08"} 0%, transparent 70%)`,
                pointerEvents: "none", willChange: "opacity",
                transition: "background 0.5s ease",
              }} />

              {/* ── Halo elíptico atrás do personagem */}
              <div style={{
                position: "absolute",
                bottom: "clamp(181px, 26.5vh, 236px)",
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
                bottom: "clamp(176px, 25.5vh, 230px)", left: "50%",
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
                bottom: "clamp(181px, 26.5vh, 236px)", left: "50%",
                transform: `translateX(-50%) translateY(${isActive ? "-10px" : "0px"}) scale(${isActive ? (isCenter ? 1.06 : 1.05) : (isCenter ? 1.02 : 1)})`,
                height: isCenter ? "clamp(300px, 64vh, 560px)" : "clamp(270px, 60vh, 520px)",
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
                height: "clamp(178px, 26vh, 233px)",
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

                {/* Botão DECK INICIAL — abre preview do deck que será adicionado à conta */}
                <button
                  onClick={e => { e.stopPropagation(); setViewingDeck(id) }}
                  style={{
                    width: "clamp(88px, 74%, 160px)",
                    padding: "clamp(5px, 0.85vh, 7px) 0",
                    marginBottom: 6,
                    background: "transparent",
                    border: `1px solid ${m.color}${isActive ? "4a" : "1c"}`,
                    borderRadius: 7,
                    color: `${m.color}${isActive ? "ee" : "70"}`,
                    fontSize: "clamp(8px, 0.85vw, 10px)", fontWeight: 700,
                    textAlign: "center", letterSpacing: "0.12em", textTransform: "uppercase",
                    cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    transition: "background 0.3s ease, border-color 0.3s ease, color 0.3s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${m.color}16`
                    e.currentTarget.style.borderColor = `${m.color}80`
                    e.currentTarget.style.color = m.color
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent"
                    e.currentTarget.style.borderColor = `${m.color}${isActive ? "4a" : "1c"}`
                    e.currentTarget.style.color = `${m.color}${isActive ? "ee" : "70"}`
                  }}
                >
                  <span style={{ fontSize: 11 }}>🃏</span> Deck Inicial
                </button>

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

      {/* Modal de preview do Deck Inicial */}
      {viewingDeck && (
        <StarterDeckModal masterId={viewingDeck} onClose={() => setViewingDeck(null)} />
      )}
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

      {/* Spotlight dinâmico: encontra o elemento pelo texto no DOM real */}
      <DynamicSpotlight textTarget={currentStep?.textTarget ?? null} />

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
  @keyframes msDeckModalIn {
    0%   { opacity: 0; transform: translateY(18px) scale(0.97); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
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
