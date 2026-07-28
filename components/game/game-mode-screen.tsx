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
import { ArrowLeft, Bot, Users, BookOpen, Layers, Compass, Flame, Ticket, ChevronRight, Sparkles } from "lucide-react"
import type { GameScreen } from "./game-wrapper"
import GearBackdrop from "./gear-backdrop"
import { imagesReady, areImagesCached, GAME_MODE_IMAGES } from "./image-preloader"

interface GameModeScreenProps {
  onSelect: (screen: GameScreen) => void
  onBack: () => void
}

/* Durações da transição — loading adaptativo:
   - imagens em cache  → transição rápida de cortina (LOADING_FAST_MS)
   - imagens baixando  → espera elas ficarem prontas, com teto máximo */
const LOADING_FAST_MS = 340
const LOADING_MIN_MS = 250
const LOADING_MAX_MS = 3000
const FADE_MS = 450
const SELECT_MS = 1150

type Phase = "loading" | "in" | "ready" | "select" | "out"

export default function GameModeScreen({ onSelect, onBack }: GameModeScreenProps) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [selected, setSelected] = useState<{ name: string; accent: string } | null>(null)

  /* Fade in adaptativo: sempre com transição de cortina —
     curta se as imagens já estão em cache, ou aguardando o download com teto */
  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const reveal = () => {
      if (cancelled) return
      setPhase((p) => (p === "loading" ? "in" : p))
      timers.push(setTimeout(() => {
        if (!cancelled) setPhase((p) => (p === "in" ? "ready" : p))
      }, FADE_MS))
    }

    if (areImagesCached(GAME_MODE_IMAGES)) {
      /* Tudo em cache: cortina rápida mesmo assim, para manter o ritmo da transição */
      timers.push(setTimeout(reveal, LOADING_FAST_MS))
    } else {
      /* Espera imagens + tempo mínimo (para a animação não "piscar"),
         com teto máximo para nunca prender o jogador no loading */
      const minWait = new Promise<void>((r) => timers.push(setTimeout(r, LOADING_MIN_MS)))
      const maxWait = new Promise<void>((r) => timers.push(setTimeout(r, LOADING_MAX_MS)))
      Promise.race([
        Promise.all([imagesReady(GAME_MODE_IMAGES), minWait]).then(() => undefined),
        maxWait,
      ]).then(reveal)
    }

    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [])

  /* Fade out antes de executar a ação (voltar ao menu) */
  const exitWith = useCallback((action: () => void) => {
    setPhase("out")
    setPendingAction(() => action)
  }, [])

  /* Transição de seleção de modo: cortina fecha com o nome do modo estampado */
  const selectWith = useCallback((name: string, accent: string, action: () => void) => {
    setSelected({ name, accent })
    setPhase("select")
    setPendingAction(() => action)
  }, [])

  useEffect(() => {
    if (!pendingAction) return
    if (phase === "out") {
      const t = setTimeout(() => pendingAction(), FADE_MS)
      return () => clearTimeout(t)
    }
    if (phase === "select") {
      const t = setTimeout(() => pendingAction(), SELECT_MS)
      return () => clearTimeout(t)
    }
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
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        willChange: phase === "out" ? "opacity" : undefined,
      }}
    >
      {/* ── Fundo animado: engrenagens tonais girando e deslizando na diagonal ── */}
      <GearBackdrop />

      {/* ── Auroras de energia à deriva (transform-only) ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="gpm-aurora absolute -left-40 top-[-20%] h-[60vh] w-[60vw] rounded-full"
          style={{ background: "radial-gradient(ellipse at center, rgba(124,58,237,0.16) 0%, transparent 65%)" }}
        />
        <div
          className="gpm-aurora-2 absolute -right-40 bottom-[-25%] h-[65vh] w-[55vw] rounded-full"
          style={{ background: "radial-gradient(ellipse at center, rgba(217,70,239,0.1) 0%, transparent 65%)" }}
        />
      </div>

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

      {/* ── Vinheta cinematográfica nas bordas da tela ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 50% 45%, transparent 55%, rgba(2,0,10,0.55) 100%)",
        }}
      />

      {/* ── Overlay de loading (fade in/out) — desmonta após a transição ── */}
      {(phase === "loading" || phase === "in") && (
        <div
          aria-hidden={phase !== "loading"}
          className="fixed inset-0 z-[220] pointer-events-none overflow-hidden"
          style={{
            opacity: phase === "loading" ? 1 : 0,
            transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          }}
        >
          {/* Cortina dupla: duas metades que deslizam para fora no fade out */}
          <div
            className="absolute inset-x-0 top-0 h-1/2"
            style={{
              background: "linear-gradient(180deg, #05010f 60%, rgba(5,1,15,0.99))",
              transform: phase === "loading" ? "translateY(0)" : "translateY(-101%)",
              transition: `transform ${FADE_MS + 150}ms cubic-bezier(0.65, 0, 0.35, 1)`,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background: "linear-gradient(0deg, #05010f 60%, rgba(5,1,15,0.99))",
              transform: phase === "loading" ? "translateY(0)" : "translateY(101%)",
              transition: `transform ${FADE_MS + 150}ms cubic-bezier(0.65, 0, 0.35, 1)`,
            }}
          />

          {/* Linha de energia central — marca a "costura" da cortina */}
          <div
            aria-hidden
            className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.9) 30%, #d8b4fe 50%, rgba(168,85,247,0.9) 70%, transparent)",
              boxShadow: "0 0 18px rgba(168,85,247,0.8), 0 0 46px rgba(124,58,237,0.5)",
              opacity: phase === "loading" ? 1 : 0,
              transform: phase === "loading" ? "translateY(-50%) scaleX(1)" : "translateY(-50%) scaleX(1.15)",
              transition: `opacity ${Math.round(FADE_MS * 0.6)}ms ease, transform ${FADE_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`,
            }}
          />

          {/* Núcleo do loading: engrenagem girando + anéis de energia */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              opacity: phase === "loading" ? 1 : 0,
              transform: phase === "loading" ? "scale(1)" : "scale(0.85)",
              transition: `opacity ${Math.round(FADE_MS * 0.55)}ms ease, transform ${FADE_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`,
            }}
          >
            <div className="relative flex h-24 w-24 items-center justify-center">
              {/* Pulso de energia externo */}
              <div className="gpm-pulse absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.28) 0%, transparent 65%)" }} />
              {/* Anel orbital externo */}
              <div className="gpm-spin absolute inset-0 rounded-full border-2 border-t-purple-400 border-r-transparent border-b-purple-400/25 border-l-transparent" />
              {/* Anel orbital interno em contra-rotação */}
              <div className="gpm-spin-rev absolute inset-3 rounded-full border border-t-fuchsia-400/70 border-r-transparent border-b-transparent border-l-fuchsia-400/20" />
              {/* Engrenagem central girando (mesma arte do fundo) */}
              <img
                src="/images/modes/gear-blue.png"
                alt=""
                draggable={false}
                className="gpm-gear-load h-11 w-11 select-none"
                style={{ filter: "hue-rotate(45deg) saturate(1.2) drop-shadow(0 0 12px rgba(168,85,247,0.75))" }}
              />
            </div>
            <p className="gpm-load-txt mt-6 text-[10px] font-black tracking-[0.4em] uppercase text-purple-300/70">
              Preparando modos
            </p>
          </div>
        </div>
      )}

      {/* ── Overlay de SELEÇÃO DE MODO: cortina fecha com o nome estampado ── */}
      {phase === "select" && selected && (
        <div className="fixed inset-0 z-[230] pointer-events-none overflow-hidden">
          {/* Cortina dupla fechando (invertida da abertura) */}
          <div
            className="gpm-sel-top absolute inset-x-0 top-0 h-1/2"
            style={{ background: "linear-gradient(180deg, #05010f 60%, rgba(5,1,15,0.99))" }}
          />
          <div
            className="gpm-sel-bot absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: "linear-gradient(0deg, #05010f 60%, rgba(5,1,15,0.99))" }}
          />

          {/* Flash radial na cor do modo */}
          <div
            aria-hidden
            className="gpm-sel-flash absolute inset-0"
            style={{ background: `radial-gradient(ellipse 60% 45% at 50% 50%, ${selected.accent}38 0%, transparent 65%)` }}
          />

          {/* Linha de energia central na cor do modo */}
          <div
            aria-hidden
            className="gpm-sel-line absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2"
            style={{
              background: `linear-gradient(90deg, transparent, ${selected.accent}e6 28%, #ffffff 50%, ${selected.accent}e6 72%, transparent)`,
              boxShadow: `0 0 20px ${selected.accent}cc, 0 0 52px ${selected.accent}80`,
            }}
          />

          {/* Nome do modo estampado no centro */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p
              className="gpm-sel-tag text-[10px] font-black uppercase tracking-[0.5em]"
              style={{ color: `${selected.accent}cc` }}
            >
              Modo selecionado
            </p>
            <h2
              className="gpm-sel-name mt-3 text-balance px-6 text-center text-4xl font-black uppercase italic leading-none tracking-[0.14em] sm:text-6xl"
              style={{
                background: `linear-gradient(180deg, #ffffff 25%, ${selected.accent} 100%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: `drop-shadow(0 0 26px ${selected.accent}aa) drop-shadow(0 3px 0 rgba(0,0,20,0.9))`,
              }}
            >
              {selected.name}
            </h2>
            {/* Losangos decorativos laterais */}
            <div aria-hidden className="gpm-sel-diamonds mt-5 flex items-center gap-2.5">
              <div className="h-px w-14" style={{ background: `linear-gradient(90deg, transparent, ${selected.accent}99)` }} />
              <div className="h-2 w-2 rotate-45" style={{ background: selected.accent, boxShadow: `0 0 10px ${selected.accent}` }} />
              <div className="h-px w-14" style={{ background: `linear-gradient(90deg, ${selected.accent}99, transparent)` }} />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ CONTEÚDO ══════════════════ */}
      <div
        className="relative z-10 mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-28 pt-8 sm:px-8"
        style={{
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible
            ? "translateY(0) scale(1)"
            : phase === "select"
              ? "translateY(0) scale(0.97)"
              : "translateY(22px) scale(0.985)",
          transition: `opacity ${FADE_MS + 100}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${FADE_MS + 250}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      >
        {/* ── Cabeçalho ── */}
        <header className="mb-7 flex items-center gap-4">
          <div
            className="relative flex h-12 w-12 shrink-0 items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.4), rgba(88,28,135,0.18))",
              border: "1px solid rgba(167,139,250,0.45)",
              boxShadow: "0 0 22px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
              clipPath: "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)",
            }}
          >
            <Ticket className="h-5 w-5 text-purple-200" />
          </div>
          <div className="flex flex-col">
            <h1
              className="text-balance text-2xl font-black uppercase italic leading-none tracking-[0.22em] sm:text-3xl"
              style={{
                background: "linear-gradient(180deg, #ffffff 30%, #c4b5fd 70%, #a78bfa 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 0 16px rgba(139,92,246,0.6)) drop-shadow(0 2px 0 rgba(0,0,30,0.9))",
              }}
            >
              Modo de Jogo
            </h1>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-purple-300/55">
              Escolha seu destino, duelista
            </p>
          </div>
          {/* Linha decorativa com losango de energia */}
          <div aria-hidden className="ml-2 hidden flex-1 items-center gap-2 sm:flex">
            <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(167,139,250,0.5), rgba(167,139,250,0.08))" }} />
            <div className="h-1.5 w-1.5 rotate-45" style={{ background: "rgba(196,181,253,0.7)", boxShadow: "0 0 8px rgba(167,139,250,0.8)" }} />
            <div className="h-px w-10" style={{ background: "linear-gradient(90deg, rgba(167,139,250,0.3), transparent)" }} />
          </div>
        </header>

        {/* ��─ TICKET GRANDE: CAMPANHA (banner oficial Modo História) ── */}
        <TicketPanel
          big
          accent="#a855f7"
          accentDark="#5b21b6"
          image="/images/modes/banner-campanha.png"
          imageAlt="Banner do Modo História: dois duelistas em confronto de energia azul e roxa"
          name="CAMPANHA"
          tag="MODO HISTÓRIA"
          description="Viva a jornada de Camelot capítulo por capítulo e desbloqueie recompensas de história."
          icon={<BookOpen className="h-5 w-5" />}
          delay={0}
          visible={contentVisible}
          onClick={() => selectWith("CAMPANHA", "#a855f7", () => onSelect("story"))}
        />

        {/* ── DOIS TICKETS MÉDIOS: EVENTOS / PVP ── */}
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <TicketPanel
            accent="#e879f9"
            accentDark="#86198f"
            image="/images/events/ciclone-verde.png"
            imageAlt="Banner dos eventos: treinamentos especiais com duelistas elementais"
            name="EVENTOS"
            tag="TREINAMENTO ESPECIAL"
            description="Encare os treinamentos elementais em 3 fases e farme Gacha Coins e Gear Coins."
            icon={<Sparkles className="h-5 w-5" />}
            delay={90}
            visible={contentVisible}
            onClick={() => selectWith("EVENTOS", "#e879f9", () => onSelect("events"))}
          />
          <TicketPanel
            accent="#f97316"
            accentDark="#c2410c"
            image="/images/modes/banner-pvp.png"
            imageAlt="Banner do modo PVP Ranqueada: dois gladiadores rivais, um com aura azul e outro com aura de fogo"
            name="PVP"
            tag="RANQUEADA · JxJ"
            description="Desafie duelistas reais e prove quem manda na arena."
            icon={<Users className="h-5 w-5" />}
            delay={180}
            visible={contentVisible}
            onClick={() => selectWith("PVP", "#f97316", () => onSelect("duel-player"))}
          />
        </div>

        {/* ── TICKET: VS BOT (treino contra a IA) ── */}
        <div className="mt-5">
          <TicketPanel
            accent="#3b82f6"
            accentDark="#1d4ed8"
            image="/images/modes/mode-vsbot.png"
            imageAlt="Arte do modo VS BOT: duelista holográfico de energia azul"
            name="VS BOT"
            tag="TREINO · PVE"
            description="Enfrente a IA e aperfeiçoe suas estratégias sem pressão."
            icon={<Bot className="h-5 w-5" />}
            delay={220}
            visible={contentVisible}
            onClick={() => selectWith("VS BOT", "#3b82f6", () => onSelect("duel-bot"))}
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
            onClick={() => selectWith("DRAFT", "#10b981", () => onSelect("duel-draft"))}
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
            onClick={() => selectWith("ROGUELIKE", "#f59e0b", () => onSelect("duel-roguelike"))}
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
            onClick={() => selectWith("CATÁSTROFE", "#ef4444", () => onSelect("duel-catastrophe"))}
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
        .gpm-spin { animation: gpmSpin 1.1s cubic-bezier(0.6, 0.15, 0.4, 0.85) infinite; }
        .gpm-spin-rev { animation: gpmSpin 1.6s cubic-bezier(0.6, 0.15, 0.4, 0.85) infinite reverse; }
        @keyframes gpmSpin { to { transform: rotate(360deg); } }
        .gpm-gear-load { animation: gpmSpin 2.2s linear infinite; }
        .gpm-pulse { animation: gpmPulse 1.5s ease-in-out infinite; }
        @keyframes gpmPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.35); opacity: 1; }
        }
        .gpm-load-txt { animation: gpmTxtGlow 1.8s ease-in-out infinite; }
        @keyframes gpmTxtGlow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .gpm-aurora { animation: gpmAurora 14s ease-in-out infinite alternate; will-change: transform; }
        .gpm-aurora-2 { animation: gpmAurora 18s ease-in-out infinite alternate-reverse; will-change: transform; }
        @keyframes gpmAurora {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to { transform: translate3d(9vw, 6vh, 0) scale(1.18); }
        }

        /* ── Transição de SELEÇÃO: cortina fecha + nome estampado ── */
        .gpm-sel-top {
          transform: translateY(-101%);
          animation: gpmSelTop 420ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
        .gpm-sel-bot {
          transform: translateY(101%);
          animation: gpmSelBot 420ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
        @keyframes gpmSelTop { to { transform: translateY(0); } }
        @keyframes gpmSelBot { to { transform: translateY(0); } }

        .gpm-sel-line {
          opacity: 0;
          transform: translateY(-50%) scaleX(0);
          animation: gpmSelLine 480ms cubic-bezier(0.22, 1, 0.36, 1) 240ms forwards;
        }
        @keyframes gpmSelLine {
          from { opacity: 0; transform: translateY(-50%) scaleX(0); }
          60% { opacity: 1; }
          to { opacity: 1; transform: translateY(-50%) scaleX(1); }
        }

        .gpm-sel-flash {
          opacity: 0;
          animation: gpmSelFlash 700ms ease-out 300ms forwards;
        }
        @keyframes gpmSelFlash {
          from { opacity: 0; }
          40% { opacity: 1; }
          to { opacity: 0.55; }
        }

        .gpm-sel-tag {
          opacity: 0;
          animation: gpmSelFadeUp 400ms ease-out 430ms forwards;
        }
        .gpm-sel-name {
          opacity: 0;
          transform: scale(1.45);
          animation: gpmSelStamp 460ms cubic-bezier(0.22, 1, 0.36, 1) 380ms forwards;
        }
        @keyframes gpmSelStamp {
          from { opacity: 0; transform: scale(1.45); }
          to { opacity: 1; transform: scale(1); }
        }
        .gpm-sel-diamonds {
          opacity: 0;
          animation: gpmSelFadeUp 400ms ease-out 560ms forwards;
        }
        @keyframes gpmSelFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .gpm-aurora, .gpm-aurora-2, .gpm-pulse, .gpm-load-txt { animation: none; }
          .gpm-sel-top, .gpm-sel-bot { animation-duration: 1ms; }
          .gpm-sel-line, .gpm-sel-flash, .gpm-sel-tag, .gpm-sel-name, .gpm-sel-diamonds { animation-duration: 1ms; animation-delay: 0ms; }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   TICKET PANEL — painel grande em formato de bilhete com recortes laterais,
   picote tracejado e faixa de nome inclinada (estilo Inazuma Eleven Cross)
══════════════════════════════════════════════════���════════════════════════ */

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
      {/* Halo de energia atrás do ticket (intensifica no hover) */}
      <div
        aria-hidden
        className="absolute -inset-1 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          borderRadius: 18,
          background: `radial-gradient(ellipse 70% 90% at 50% 50%, ${accent}30, transparent 70%)`,
          filter: "blur(10px)",
        }}
      />

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
          boxShadow: `inset 0 0 0 1px ${accent}55, inset 0 0 32px ${accent}14`,
        }}
      >
        {/* Fio de energia no topo do ticket */}
        <div
          aria-hidden
          className="absolute left-0 top-0 z-10 h-[2px] w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}cc 30%, ${accent} 50%, ${accent}cc 70%, transparent)` }}
        />
        {/* Arte do modo */}
        <div className={`relative w-full overflow-hidden ${big ? "h-44 sm:h-52" : "h-36 sm:h-40"}`}>
          <Image
            src={image || "/placeholder.svg"}
            alt={imageAlt}
            fill
            priority
            unoptimized
            sizes={big ? "(max-width: 1024px) 100vw, 960px" : "(max-width: 768px) 100vw, 470px"}
            className="object-cover"
          />
          {/* Vinheta inferior pra ancorar a faixa de nome */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, transparent 40%, rgba(8,3,22,0.55) 82%, rgba(8,3,22,0.92) 100%)" }}
          />
          {/* Brilho varrendo no hover (transform-only, roda apenas ao passar o mouse) */}
          <div aria-hidden className="gpt-shine absolute inset-0" />
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
            className="flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-transform group-hover:translate-x-0.5"
            style={{
              background: `linear-gradient(135deg, ${accentDark}, ${accent})`,
              boxShadow: `0 3px 14px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
              clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
            }}
          >
            Entrar
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {/* Cantoneiras táticas nos 4 cantos (fora da mask, sempre visíveis) */}
      {[
        "left-0 top-0 border-l-2 border-t-2 rounded-tl-[14px]",
        "right-0 top-0 border-r-2 border-t-2 rounded-tr-[14px]",
        "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-[14px]",
        "right-0 bottom-0 border-r-2 border-b-2 rounded-br-[14px]",
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`pointer-events-none absolute h-5 w-5 transition-all duration-300 group-hover:h-7 group-hover:w-7 ${pos}`}
          style={{ borderColor: accent, filter: `drop-shadow(0 0 4px ${accent}aa)` }}
        />
      ))}

      <style jsx>{`
        .gpt-shine {
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.14) 48%, transparent 62%);
          transform: translate3d(-105%, 0, 0);
          pointer-events: none;
        }
        .gpt-ticket:hover .gpt-shine {
          animation: gptShine 0.9s ease;
        }
        @keyframes gptShine {
          from { transform: translate3d(-105%, 0, 0); }
          to { transform: translate3d(105%, 0, 0); }
        }
      `}</style>
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODE CARD — card vertical menor para os modos especiais
   (fileira inferior, como os cards de Trial/Versus da referência)
═════════════════════════════════════════════════════════════════��═════════ */

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
          loading="eager"
          unoptimized
          sizes="(max-width: 640px) 100vw, 300px"
          className="object-cover"
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

      {/* Cantoneiras nos cantos superiores */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-4 w-4 rounded-tl-[14px] border-l-2 border-t-2 opacity-60 transition-all duration-300 group-hover:h-6 group-hover:w-6 group-hover:opacity-100"
        style={{ borderColor: accent, filter: `drop-shadow(0 0 4px ${accent}99)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-4 w-4 rounded-tr-[14px] border-r-2 border-t-2 opacity-60 transition-all duration-300 group-hover:h-6 group-hover:w-6 group-hover:opacity-100"
        style={{ borderColor: accent, filter: `drop-shadow(0 0 4px ${accent}99)` }}
      />
    </button>
  )
}


