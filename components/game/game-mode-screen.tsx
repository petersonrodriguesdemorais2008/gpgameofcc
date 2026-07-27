"use client"

/**
 * GAME MODE SCREEN — Tela de seleção de Modo de Jogo
 *
 * Inspirada no layout do Inazuma Eleven Cross: painéis em formato de
 * "ticket" (bilhete com recortes laterais e picote tracejado) para os
 * modos principais, e uma fileira de cards verticais para os modos
 * especiais.
 *
 * Fluxo: aparece após o jogador clicar em "Jogar" no Main Menu, com uma
 * transição interna de fade (loading → fade out → conteúdo fade in).
 * O botão de voltar (setinha, canto inferior esquerdo, como na
 * referência) faz fade out antes de retornar ao menu.
 */

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { ArrowLeft, Bot, Users, BookOpen, Layers, Compass, Flame, Ticket, ChevronRight } from "lucide-react"
import type { GameScreen } from "./game-wrapper"

interface GameModeScreenProps {
  onSelect: (screen: GameScreen) => void
  onBack: () => void
}

/* Durações da transição */
const LOADING_MS = 650
const FADE_MS = 380

type Phase = "loading" | "in" | "ready" | "out"

export default function GameModeScreen({ onSelect, onBack }: GameModeScreenProps) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  /* Fade in: loading breve → revela conteúdo */
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("in"), LOADING_MS)
    const t2 = setTimeout(() => setPhase("ready"), LOADING_MS + FADE_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  /* Fade out antes de executar a ação (voltar ou entrar num modo) */
  const exitWith = useCallback((action: () => void) => {
    setPhase("out")
    setPendingAction(() => action)
  }, [])

  useEffect(() => {
    if (phase !== "out" || !pendingAction) return
    const t = setTimeout(() => pendingAction(), FADE_MS)
    return () => clearTimeout(t)
  }, [phase, pendingAction])

  const contentVisible = phase === "in" || phase === "ready"

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto"
      role="dialog"
      aria-label="Seleção de modo de jogo"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(88,28,135,0.35) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 85% 110%, rgba(30,10,60,0.6) 0%, transparent 55%), linear-gradient(165deg, #060214 0%, #0a0420 45%, #05010f 100%)",
        opacity: phase === "out" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {/* ── Textura de fundo: grade diagonal sutil (papel de scrapbook da referência) ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 100%)",
        }}
      />

      {/* ── Overlay de loading (fade in/out) ── */}
      <div
        aria-hidden={phase !== "loading"}
        className="fixed inset-0 z-[220] flex flex-col items-center justify-center pointer-events-none"
        style={{
          background: "rgba(3,4,14,0.97)",
          opacity: phase === "loading" ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/15" />
          <div className="absolute inset-0 rounded-full border-2 border-t-purple-400 border-r-transparent border-b-transparent border-l-transparent gpm-spin" />
          <div className="absolute inset-2 rounded-full border border-t-fuchsia-400/60 border-r-transparent border-b-transparent border-l-transparent gpm-spin-rev" />
        </div>
        <p className="mt-5 text-[10px] font-black tracking-[0.35em] uppercase text-purple-300/60">
          Preparando modos
        </p>
      </div>

      {/* ══════════════════ CONTEÚDO ══════════════════ */}
      <div
        className="relative z-10 mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-28 pt-8 sm:px-8"
        style={{
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? "translateY(0)" : "translateY(14px)",
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS + 120}ms cubic-bezier(0.22,1,0.36,1)`,
        }}
      >
        {/* ── Cabeçalho ── */}
        <header className="mb-7 flex items-center gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(88,28,135,0.2))",
              border: "1px solid rgba(167,139,250,0.35)",
              boxShadow: "0 0 18px rgba(124,58,237,0.25)",
            }}
          >
            <Ticket className="h-5 w-5 text-purple-300" />
          </div>
          <div className="flex flex-col">
            <h1
              className="text-balance text-2xl font-black uppercase leading-none tracking-[0.22em] text-white sm:text-3xl"
              style={{ textShadow: "0 0 18px rgba(139,92,246,0.55), 0 2px 0 rgba(0,0,30,0.8)" }}
            >
              Modo de Jogo
            </h1>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-purple-300/50">
              Escolha seu destino, duelista
            </p>
          </div>
          {/* Linha decorativa */}
          <div
            aria-hidden
            className="ml-2 hidden h-px flex-1 sm:block"
            style={{ background: "linear-gradient(90deg, rgba(167,139,250,0.4), transparent)" }}
          />
        </header>

        {/* ── TICKET GRANDE: CAMPANHA ── */}
        <TicketPanel
          big
          accent="#a855f7"
          accentDark="#5b21b6"
          image="/images/modes/mode-campanha.png"
          imageAlt="Arte do modo Campanha: cavaleiro rumo ao castelo de Camelot"
          name="CAMPANHA"
          tag="MODO HISTÓRIA"
          description="Viva a jornada de Camelot capítulo por capítulo e desbloqueie recompensas de história."
          icon={<BookOpen className="h-5 w-5" />}
          delay={0}
          visible={contentVisible}
          onClick={() => exitWith(() => onSelect("story"))}
        />

        {/* ── DOIS TICKETS MÉDIOS: VS BOT / VS JOGADOR ── */}
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <TicketPanel
            accent="#3b82f6"
            accentDark="#1d4ed8"
            image="/images/modes/mode-vsbot.png"
            imageAlt="Arte do modo VS BOT: duelista holográfico de energia azul"
            name="VS BOT"
            tag="TREINO · PVE"
            description="Enfrente a IA e aperfeiçoe suas estratégias sem pressão."
            icon={<Bot className="h-5 w-5" />}
            delay={90}
            visible={contentVisible}
            onClick={() => exitWith(() => onSelect("duel-bot"))}
          />
          <TicketPanel
            accent="#f97316"
            accentDark="#c2410c"
            image="/images/modes/mode-vsjogador.png"
            imageAlt="Arte do modo VS JOGADOR: dois rivais em confronto"
            name="VS JOGADOR"
            tag="RANQUEADA · PVP"
            description="Desafie duelistas reais e prove quem manda na arena."
            icon={<Users className="h-5 w-5" />}
            delay={180}
            visible={contentVisible}
            onClick={() => exitWith(() => onSelect("duel-player"))}
          />
        </div>

        {/* ── Divisor "MODOS ESPECIAIS" ── */}
        <div className="mt-9 mb-4 flex items-center gap-3">
          <div aria-hidden className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.35))" }} />
          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-purple-300/55">
            Modos Especiais
          </span>
          <div aria-hidden className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(167,139,250,0.35), transparent)" }} />
        </div>

        {/* ── FILEIRA DE CARDS: DRAFT / ROGUELIKE / CATÁSTROFE ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ModeCard
            accent="#10b981"
            image="/images/modes/mode-draft.png"
            imageAlt="Arte do modo Draft: mão escolhendo uma carta brilhante"
            name="DRAFT"
            description="Monte um deck na hora, carta a carta, e duele com ele."
            icon={<Layers className="h-4 w-4" />}
            delay={260}
            visible={contentVisible}
            onClick={() => exitWith(() => onSelect("duel-draft"))}
          />
          <ModeCard
            accent="#f59e0b"
            image="/images/modes/mode-roguelike.png"
            imageAlt="Arte do modo Roguelike: aventureiro descendo uma masmorra"
            name="ROGUELIKE"
            description="Sobreviva a uma sequência de duelos cada vez mais difíceis."
            icon={<Compass className="h-4 w-4" />}
            delay={340}
            visible={contentVisible}
            onClick={() => exitWith(() => onSelect("duel-roguelike"))}
          />
          <ModeCard
            accent="#ef4444"
            image="/images/modes/mode-catastrofe.png"
            imageAlt="Arte do modo Catástrofe: guerreiro diante de um meteoro"
            name="CATÁSTROFE"
            description="Regras caóticas mudam o duelo. Só os fortes resistem."
            icon={<Flame className="h-4 w-4" />}
            delay={420}
            visible={contentVisible}
            onClick={() => exitWith(() => onSelect("duel-catastrophe"))}
          />
        </div>
      </div>

      {/* ── BOTÃO VOLTAR — setinha fixa, canto inferior esquerdo (como na referência) ── */}
      <button
        onClick={() => exitWith(onBack)}
        aria-label="Voltar ao menu principal"
        className="fixed bottom-6 left-6 z-[210] flex items-center gap-2.5 rounded-2xl px-4 py-3 transition-transform hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(150deg, rgba(20,10,45,0.95), rgba(10,5,26,0.95))",
          border: "1px solid rgba(167,139,250,0.35)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.55), 0 0 20px rgba(124,58,237,0.18)",
          opacity: contentVisible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease, transform 150ms ease`,
        }}
      >
        <ArrowLeft className="h-5 w-5 text-purple-200" />
        <span className="text-xs font-black uppercase tracking-[0.2em] text-purple-100">Voltar</span>
      </button>

      <style jsx>{`
        .gpm-spin { animation: gpmSpin 0.9s linear infinite; }
        .gpm-spin-rev { animation: gpmSpin 1.4s linear infinite reverse; }
        @keyframes gpmSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   TICKET PANEL — painel grande em formato de bilhete com recortes laterais,
   picote tracejado e faixa de nome inclinada (estilo Inazuma Eleven Cross)
═══════════════════════════════════════════════════════════════════════════ */

interface TicketPanelProps {
  big?: boolean
  accent: string
  accentDark: string
  image: string
  imageAlt: string
  name: string
  tag: string
  description: string
  icon: React.ReactNode
  delay: number
  visible: boolean
  onClick: () => void
}

function TicketPanel({
  big = false, accent, accentDark, image, imageAlt, name, tag, description, icon, delay, visible, onClick,
}: TicketPanelProps) {
  return (
    <button
      onClick={onClick}
      className="gpt-ticket group relative block w-full text-left transition-transform duration-200 hover:scale-[1.015] active:scale-[0.99]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(22px)",
        transition: `opacity 500ms ease ${delay}ms, transform 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, scale 200ms ease`,
      }}
    >
      {/* Corpo do ticket — recortes laterais via mask radial */}
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: 14,
          background: "linear-gradient(160deg, rgba(22,12,48,0.97), rgba(9,4,24,0.98))",
          WebkitMaskImage:
            "radial-gradient(circle 13px at 0% 50%, transparent 98%, black 100%), radial-gradient(circle 13px at 100% 50%, transparent 98%, black 100%)",
          WebkitMaskComposite: "source-in",
          maskImage:
            "radial-gradient(circle 13px at 0% 50%, transparent 98%, black 100%), radial-gradient(circle 13px at 100% 50%, transparent 98%, black 100%)",
          maskComposite: "intersect",
          boxShadow: `inset 0 0 0 1px ${accent}44`,
        }}
      >
        {/* Arte do modo */}
        <div className={`relative w-full overflow-hidden ${big ? "h-44 sm:h-52" : "h-36 sm:h-40"}`}>
          <Image
            src={image || "/placeholder.svg"}
            alt={imageAlt}
            fill
            sizes={big ? "(max-width: 1024px) 100vw, 960px" : "(max-width: 768px) 100vw, 470px"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
          {/* Vinheta inferior pra ancorar a faixa de nome */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, transparent 40%, rgba(8,3,22,0.55) 82%, rgba(8,3,22,0.92) 100%)" }}
          />
          {/* Brilho varrendo no hover */}
          <div
            aria-hidden
            className="gpt-shine absolute inset-0 opacity-0 group-hover:opacity-100"
          />
          {/* Tag no canto superior */}
          <span
            className="absolute left-0 top-4 flex items-center gap-1.5 py-1 pl-4 pr-3 text-[9px] font-black uppercase tracking-[0.22em] text-white"
            style={{
              background: `linear-gradient(90deg, ${accentDark}ee, ${accent}cc 70%, transparent)`,
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            {tag}
          </span>

          {/* Faixa de NOME — ribbon inclinada sobre a arte */}
          <div className="absolute bottom-3 left-4 sm:bottom-4 sm:left-5" style={{ transform: "skewX(-8deg)" }}>
            <div
              className="flex items-center gap-2.5 px-4 py-2 sm:px-5"
              style={{
                background: `linear-gradient(105deg, ${accentDark} 0%, ${accent} 100%)`,
                boxShadow: `0 6px 22px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.35)`,
                clipPath: "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
              }}
            >
              <span className="text-white" style={{ transform: "skewX(8deg)" }}>{icon}</span>
              <span
                className={`font-black uppercase italic tracking-[0.14em] text-white ${big ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}
                style={{ transform: "skewX(8deg)", textShadow: "0 2px 0 rgba(0,0,40,0.45), 0 0 16px rgba(255,255,255,0.35)" }}
              >
                {name}
              </span>
            </div>
            {/* Sombra dupla da ribbon (profundidade estilo sticker) */}
            <div
              aria-hidden
              className="absolute -bottom-1.5 left-1.5 right-0 h-full -z-10"
              style={{ background: "rgba(0,0,15,0.55)", clipPath: "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}
            />
          </div>
        </div>

        {/* Picote tracejado — divisória de ticket */}
        <div aria-hidden className="relative mx-3.5 h-px" style={{
          backgroundImage: `repeating-linear-gradient(90deg, ${accent}55 0 8px, transparent 8px 16px)`,
        }} />

        {/* Canhoto do ticket: descrição + chamada */}
        <div className="flex items-center gap-3 px-5 py-3.5">
          <p className="flex-1 text-pretty text-xs leading-relaxed text-purple-100/65">{description}</p>
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-transform group-hover:translate-x-0.5"
            style={{ background: `linear-gradient(135deg, ${accentDark}, ${accent})`, boxShadow: `0 3px 14px ${accent}55` }}
          >
            Entrar
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      <style jsx>{`
        .gpt-shine {
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.14) 48%, transparent 62%);
          background-size: 250% 100%;
          transition: opacity 300ms ease;
          animation: gptShine 1.6s ease infinite;
          pointer-events: none;
        }
        @keyframes gptShine {
          from { background-position: 160% 0; }
          to { background-position: -60% 0; }
        }
      `}</style>
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODE CARD — card vertical menor para os modos especiais
   (fileira inferior, como os cards de Trial/Versus da referência)
═══════════════════════════════════════════════════════════════════════════ */

interface ModeCardProps {
  accent: string
  image: string
  imageAlt: string
  name: string
  description: string
  icon: React.ReactNode
  delay: number
  visible: boolean
  onClick: () => void
}

function ModeCard({ accent, image, imageAlt, name, description, icon, delay, visible, onClick }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative block w-full overflow-hidden text-left transition-transform duration-200 hover:scale-[1.03] hover:-translate-y-1 active:scale-[0.99]"
      style={{
        borderRadius: 14,
        background: "linear-gradient(165deg, rgba(20,11,44,0.97), rgba(8,4,22,0.98))",
        boxShadow: `inset 0 0 0 1px ${accent}3d, 0 6px 24px rgba(0,0,0,0.4)`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(22px)",
        transition: `opacity 500ms ease ${delay}ms, transform 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, scale 200ms ease, translate 200ms ease, box-shadow 200ms ease`,
      }}
    >
      {/* Arte vertical */}
      <div className="relative h-40 w-full overflow-hidden sm:h-48">
        <Image
          src={image || "/placeholder.svg"}
          alt={imageAlt}
          fill
          sizes="(max-width: 640px) 100vw, 300px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.08]"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, transparent 45%, rgba(7,3,20,0.7) 85%, rgba(7,3,20,0.96) 100%)" }}
        />
        {/* Selo "ESPECIAL" no canto */}
        <span
          className="absolute right-0 top-3 py-0.5 pl-2.5 pr-3 text-[8px] font-black uppercase tracking-[0.25em] text-white"
          style={{
            background: `linear-gradient(270deg, ${accent}dd, transparent)`,
            textShadow: "0 1px 2px rgba(0,0,0,0.7)",
          }}
        >
          Especial
        </span>
        {/* Nome sobre a arte */}
        <div className="absolute bottom-2.5 left-3.5 flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-white"
            style={{ background: `${accent}e6`, boxShadow: `0 0 12px ${accent}77` }}
          >
            {icon}
          </span>
          <span
            className="text-lg font-black uppercase italic tracking-[0.12em] text-white"
            style={{ textShadow: `0 2px 0 rgba(0,0,30,0.6), 0 0 14px ${accent}99` }}
          >
            {name}
          </span>
        </div>
      </div>

      {/* Base do card */}
      <div className="px-4 pb-3.5 pt-2.5">
        <p className="text-pretty text-[11px] leading-relaxed text-purple-100/60">{description}</p>
      </div>

      {/* Barra de energia inferior no hover */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
    </button>
  )
}
