"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

/* ============================================================================
   FieldCardFX — Efeitos épicos de campo
   1. INVOCAÇÃO: portal rúnico → pilar de luz → queda 3D com rastro → impacto
      (a arte real da carta fica OCULTA até o impacto, então "materializa";
       nunca pisca antes da animação — usamos useLayoutEffect, que aplica a
       classe de ocultação ANTES do primeiro paint do slot)
   2. DP: surto de poder (buff) / fratura de dano (debuff) na própria carta
   Componente 100% overlay (pointer-events-none), colocado DENTRO do slot.
   Os keyframes vivem em app/globals.css (prefixo fx-).
============================================================================ */

interface FXCard {
  id?: string | number
  name: string
  image?: string
  element?: string
  dp?: number
  currentDp?: number
}

interface FieldCardFXProps {
  card: FXCard | null
  /** Imagem resolvida (skin ativa / verso da carta). Se omitida usa card.image */
  image?: string | null
  /** Desliga a animação de invocação (ex.: zonas que já têm flip próprio) */
  disableSummon?: boolean
  /** Desliga a animação de DP (ex.: cartas que não são unidades) */
  disableDp?: boolean
}

interface SummonFX {
  key: number
  image: string
  color: string
  colorSoft: string
  colorFaint: string
}

interface DpFX {
  key: number
  amount: number
  type: "buff" | "debuff"
}

/* ---- Linha do tempo da invocação (ms) — tudo derivado daqui ---- */
const T_IMPACT = 760 // instante exato em que a carta "bate" no slot
const T_END = 1900 // limpeza do overlay

function elementColors(element?: string) {
  const e = (element || "").toLowerCase()
  const mk = (c: string, s: string, f: string) => ({ color: c, colorSoft: s, colorFaint: f })
  if (e.includes("pyrus") || e.includes("fire") || e.includes("fogo"))
    return mk("#fb923c", "rgba(251,146,60,0.55)", "rgba(251,146,60,0.16)")
  if (e.includes("aquos") || e.includes("water") || e.includes("água") || e.includes("agua"))
    return mk("#38bdf8", "rgba(56,189,248,0.55)", "rgba(56,189,248,0.16)")
  if (e.includes("haos") || e.includes("light") || e.includes("luz"))
    return mk("#fde68a", "rgba(253,230,138,0.55)", "rgba(253,230,138,0.18)")
  if (e.includes("darkus") || e.includes("dark") || e.includes("trevas"))
    return mk("#a78bfa", "rgba(167,139,250,0.55)", "rgba(167,139,250,0.16)")
  if (e.includes("ventus") || e.includes("wind") || e.includes("vento"))
    return mk("#4ade80", "rgba(74,222,128,0.55)", "rgba(74,222,128,0.16)")
  if (e.includes("subterra") || e.includes("earth") || e.includes("terra"))
    return mk("#d6a35c", "rgba(214,163,92,0.55)", "rgba(214,163,92,0.16)")
  if (e.includes("void") || e.includes("vazio"))
    return mk("#c084fc", "rgba(192,132,252,0.5)", "rgba(192,132,252,0.16)")
  return mk("#fbbf24", "rgba(251,191,36,0.55)", "rgba(251,191,36,0.16)")
}

/* Partículas determinísticas (sem Math.random — evita mismatch de hidratação) */
const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  delay: ((i * 53) % 34) / 100,
  size: 2 + ((i * 29) % 3),
  dur: 0.6 + ((i * 17) % 45) / 100,
  drift: (((i * 41) % 21) - 10) * 1.9,
  rise: 62 + ((i * 23) % 34),
}))

const IMPACT_DUST = Array.from({ length: 16 }, (_, i) => {
  const side = i % 2 === 0 ? 1 : -1
  const spread = 24 + ((i * 31) % 52)
  return {
    x: side * spread,
    y: -(2 + ((i * 19) % 20)),
    size: 2 + ((i * 23) % 4),
    delay: ((i * 37) % 16) / 100,
    dur: 0.5 + ((i * 13) % 34) / 100,
  }
})

/* Fagulhas radiais do impacto (estrela de energia) */
const IMPACT_RAYS = Array.from({ length: 10 }, (_, i) => ({
  rot: i * 36 + 8,
  len: 30 + ((i * 17) % 22),
  delay: ((i * 11) % 9) / 100,
}))

const BUFF_MOTES = Array.from({ length: 12 }, (_, i) => ({
  x: (i * 29 + 7) % 96,
  size: 2 + ((i * 19) % 3),
  delay: ((i * 43) % 42) / 100,
  dur: 0.75 + ((i * 23) % 40) / 100,
  drift: (((i * 31) % 17) - 8) * 1.7,
  rise: 54 + ((i * 13) % 30),
}))

const DEBUFF_SHARDS = Array.from({ length: 10 }, (_, i) => ({
  x: (i * 41 + 9) % 92,
  delay: ((i * 27) % 22) / 100,
  size: 2 + ((i * 13) % 4),
  drift: (((i * 23) % 19) - 9) * 1.8,
  fall: 44 + ((i * 17) % 28),
  rot: 90 + ((i * 37) % 180),
}))

const CRACKS = [
  { l: "20%", t: "10%", r: 26, len: 36 },
  { l: "62%", t: "22%", r: -40, len: 44 },
  { l: "34%", t: "48%", r: 64, len: 32 },
  { l: "74%", t: "58%", r: -18, len: 28 },
]

export default function FieldCardFX({ card, image, disableSummon, disableDp }: FieldCardFXProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const prevKeyRef = useRef<string | null>(null)
  const prevDpRef = useRef<number | null>(null)
  const mountedRef = useRef(false)
  const fxSeq = useRef(0)
  const timersRef = useRef<number[]>([])
  const parentClassesRef = useRef<string[]>([])

  const [summonFx, setSummonFx] = useState<SummonFX | null>(null)
  const [dpFx, setDpFx] = useState<DpFX | null>(null)

  const cardKey = card ? `${card.id ?? ""}::${card.name}` : null
  const dpNow = card ? card.currentDp ?? card.dp ?? null : null
  const resolvedImage = image ?? card?.image ?? null

  const parentEl = () => rootRef.current?.parentElement ?? null

  const addParentClass = (cls: string) => {
    const p = parentEl()
    if (!p) return
    p.classList.add(cls)
    if (!parentClassesRef.current.includes(cls)) parentClassesRef.current.push(cls)
  }

  const removeParentClass = (cls: string) => {
    parentEl()?.classList.remove(cls)
    parentClassesRef.current = parentClassesRef.current.filter((c) => c !== cls)
  }

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }

  /** Pulso/tremor na carta real (classe no slot pai) */
  const punchParent = (cls: string, delay: number, duration: number) => {
    later(() => {
      removeParentClass(cls)
      // força reinício da animação caso a classe tenha acabado de sair
      void parentEl()?.offsetWidth
      addParentClass(cls)
    }, delay)
    later(() => removeParentClass(cls), delay + duration)
  }

  const clearAll = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
    const p = parentEl()
    if (p) parentClassesRef.current.forEach((c) => p.classList.remove(c))
    parentClassesRef.current = []
  }

  /* useLayoutEffect: roda ANTES do paint, então a arte real nunca aparece
     por um frame antes da animação de invocação começar (sem "piscar"). */
  useLayoutEffect(() => {
    /* Primeiro render: registra estado sem animar (evita FX ao restaurar duelo) */
    if (!mountedRef.current) {
      mountedRef.current = true
      prevKeyRef.current = cardKey
      prevDpRef.current = dpNow
      return
    }

    /* -------- Carta nova entrou no slot: INVOCAÇÃO -------- */
    if (cardKey && cardKey !== prevKeyRef.current) {
      prevKeyRef.current = cardKey
      prevDpRef.current = dpNow

      if (disableSummon || !resolvedImage) return

      clearAll()
      const { color, colorSoft, colorFaint } = elementColors(card?.element)
      fxSeq.current++
      setSummonFx({ key: fxSeq.current, image: resolvedImage, color, colorSoft, colorFaint })
      setDpFx(null)

      /* pré-carrega a arte para o clone da queda não aparecer atrasado */
      if (typeof window !== "undefined") {
        const pre = new window.Image()
        pre.decoding = "sync"
        pre.src = resolvedImage
      }

      /* esconde a arte real ANTES do paint e eleva o slot acima dos vizinhos */
      addParentClass("fx-summon-hiding")

      /* impacto: materializa a carta real + soco no slot */
      later(() => {
        removeParentClass("fx-summon-hiding")
        addParentClass("fx-summon-landing")
      }, T_IMPACT)
      later(() => removeParentClass("fx-summon-landing"), T_IMPACT + 620)
      punchParent("fx-slot-punch", T_IMPACT - 40, 560)
      later(() => setSummonFx(null), T_END)
      return
    }

    /* -------- Slot esvaziou -------- */
    if (!cardKey) {
      prevKeyRef.current = null
      prevDpRef.current = null
      clearAll()
      setSummonFx(null)
      setDpFx(null)
      return
    }

    /* -------- Mesma carta, DP mudou: BUFF / DEBUFF -------- */
    if (!disableDp && dpNow !== null && prevDpRef.current !== null && dpNow !== prevDpRef.current) {
      const diff = dpNow - prevDpRef.current
      prevDpRef.current = dpNow
      const buff = diff > 0

      clearAll()
      fxSeq.current++
      setDpFx({ key: fxSeq.current, amount: diff, type: buff ? "buff" : "debuff" })
      addParentClass("fx-dp-active")
      punchParent(buff ? "fx-dp-buff-pop" : "fx-dp-shake", 0, buff ? 780 : 660)
      later(() => removeParentClass("fx-dp-active"), 900)
      later(() => setDpFx(null), 1650)
      return
    }

    prevDpRef.current = dpNow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, dpNow, resolvedImage, disableSummon, disableDp, card?.element])

  /* limpeza ao desmontar */
  useEffect(() => clearAll, [])

  return (
    <div
      ref={rootRef}
      className="fx-root absolute inset-0 pointer-events-none"
      style={{ zIndex: 60 }}
      aria-hidden="true"
    >
      {/* ============================ INVOCAÇÃO ============================ */}
      {summonFx && (
        <div key={`summon-${summonFx.key}`} className="absolute -inset-8 overflow-visible" style={{ perspective: "480px" }}>
          {/* Portal mágico se abrindo no chão (anel externo giratório) */}
          <div
            className="fx-portal-open absolute left-1/2 bottom-[9%]"
            style={{
              width: "118%",
              aspectRatio: "1",
              borderRadius: "9999px",
              border: `2px solid ${summonFx.color}`,
              boxShadow: `0 0 20px 2px ${summonFx.colorSoft}, inset 0 0 26px 5px ${summonFx.colorSoft}`,
              background: `conic-gradient(from 0deg, transparent 0%, ${summonFx.colorSoft} 12%, transparent 26%, ${summonFx.colorSoft} 48%, transparent 62%, ${summonFx.colorSoft} 84%, transparent 100%)`,
              maskImage: "radial-gradient(circle, transparent 47%, black 55%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 47%, black 55%)",
            }}
          />
          {/* Anel rúnico interno (gira ao contrário, tracejado) */}
          <div
            className="fx-portal-runes absolute left-1/2 bottom-[13%]"
            style={{
              width: "84%",
              aspectRatio: "1",
              borderRadius: "9999px",
              border: `2px dashed ${summonFx.color}`,
              boxShadow: `0 0 12px 1px ${summonFx.colorSoft}`,
            }}
          />
          {/* Brilho de solo */}
          <div
            className="fx-ground-glow absolute left-1/2 bottom-2 -translate-x-1/2"
            style={{
              width: "155%",
              height: "40%",
              background: `radial-gradient(ellipse at center, ${summonFx.colorSoft} 0%, transparent 70%)`,
              filter: "blur(6px)",
            }}
          />
          {/* Pilar de energia subindo do portal */}
          <div
            className="fx-summon-pillar absolute left-1/2 bottom-[11%]"
            style={{
              width: "36%",
              height: "138%",
              background: `linear-gradient(to top, rgba(255,255,255,0.9) 0%, ${summonFx.color} 20%, ${summonFx.colorSoft} 48%, transparent 96%)`,
              filter: "blur(6px)",
            }}
          />
          {/* Rastro de movimento da queda */}
          <div
            className="fx-summon-trail absolute left-1/2 bottom-[12%]"
            style={{
              width: "40%",
              height: "158%",
              background: `linear-gradient(to top, transparent 0%, ${summonFx.colorFaint} 22%, ${summonFx.colorSoft} 58%, transparent 100%)`,
              filter: "blur(8px)",
            }}
          />

          {/* Clone da carta caindo do céu com giro 3D (slam) */}
          <div className="absolute inset-8" style={{ perspective: "560px" }}>
            <div
              className="fx-summon-drop absolute inset-0"
              style={{
                backgroundImage: `url(${summonFx.image})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                ["--fx-el" as any]: summonFx.color,
                ["--fx-el-soft" as any]: summonFx.colorSoft,
              }}
            />
          </div>

          {/* Flash radial no impacto */}
          <div
            className="fx-summon-flash absolute -inset-2"
            style={{
              background: `radial-gradient(circle at center, rgba(255,255,255,0.98) 0%, ${summonFx.colorSoft} 38%, transparent 70%)`,
            }}
          />
          {/* Estrela de raios do impacto */}
          {IMPACT_RAYS.map((r, i) => (
            <span
              key={`ray-${i}`}
              className="fx-impact-ray absolute left-1/2 top-1/2"
              style={{
                height: r.len,
                background: `linear-gradient(to top, transparent, ${summonFx.color}, rgba(255,255,255,0.95))`,
                ["--fx-rot" as any]: `${r.rot}deg`,
                ["--fx-delay" as any]: `${T_IMPACT / 1000 + r.delay}s`,
              }}
            />
          ))}
          {/* Ondas de choque (tripla: elemento → branco → elemento) */}
          <div
            className="fx-shockwave absolute left-1/2 top-1/2"
            style={{ borderColor: summonFx.color, ["--fx-delay" as any]: `${T_IMPACT / 1000}s` }}
          />
          <div
            className="fx-shockwave absolute left-1/2 top-1/2"
            style={{ borderColor: "rgba(255,255,255,0.92)", ["--fx-delay" as any]: `${T_IMPACT / 1000 + 0.07}s` }}
          />
          <div
            className="fx-shockwave absolute left-1/2 top-1/2"
            style={{ borderColor: summonFx.colorSoft, ["--fx-delay" as any]: `${T_IMPACT / 1000 + 0.16}s` }}
          />
          {/* Anel de energia rotativo */}
          <div
            className="fx-summon-ring absolute left-1/2 top-1/2"
            style={{
              background: `conic-gradient(from 0deg, transparent 0%, ${summonFx.color} 18%, transparent 40%, ${summonFx.color} 62%, transparent 85%)`,
            }}
          />
          {/* Poeira/detritos explodindo para os lados no impacto */}
          {IMPACT_DUST.map((d, i) => (
            <span
              key={`dust-${i}`}
              className="fx-impact-dust absolute"
              style={{
                left: "50%",
                bottom: "15%",
                width: d.size,
                height: d.size,
                background: i % 3 === 0 ? "#ffffff" : summonFx.color,
                boxShadow: `0 0 6px 1px ${summonFx.colorSoft}`,
                ["--fx-delay" as any]: `${T_IMPACT / 1000 + d.delay}s`,
                ["--fx-dur" as any]: `${d.dur}s`,
                ["--fx-dust-x" as any]: `${d.x}px`,
                ["--fx-dust-y" as any]: `${d.y}px`,
              }}
            />
          ))}
          {/* Arcos elétricos crepitando sobre a carta */}
          <div
            className="fx-energy-arc absolute inset-6"
            style={{
              background: `linear-gradient(105deg, transparent 44%, ${summonFx.color} 47%, rgba(255,255,255,0.9) 50%, ${summonFx.color} 53%, transparent 56%)`,
              ["--fx-delay" as any]: `${T_IMPACT / 1000 + 0.04}s`,
            }}
          />
          <div
            className="fx-energy-arc absolute inset-6"
            style={{
              background: `linear-gradient(-70deg, transparent 46%, rgba(255,255,255,0.85) 49%, ${summonFx.color} 52%, transparent 55%)`,
              ["--fx-delay" as any]: `${T_IMPACT / 1000 + 0.16}s`,
            }}
          />
          {/* Aura elemental residual (respira e some) */}
          <div
            className="fx-summon-afterglow absolute inset-7"
            style={{
              background: `radial-gradient(circle at 50% 58%, ${summonFx.colorSoft} 0%, transparent 70%)`,
              boxShadow: `inset 0 0 18px 3px ${summonFx.colorSoft}`,
              ["--fx-delay" as any]: `${T_IMPACT / 1000 + 0.05}s`,
            }}
          />
          {/* Fagulhas subindo */}
          {SPARKS.map((s, i) => (
            <span
              key={`spark-${i}`}
              className="fx-summon-spark absolute"
              style={{
                left: `${s.x}%`,
                bottom: "17%",
                width: s.size,
                height: s.size,
                background: i % 3 === 0 ? "#ffffff" : summonFx.color,
                boxShadow: `0 0 7px 1px ${summonFx.colorSoft}`,
                ["--fx-delay" as any]: `${T_IMPACT / 1000 + 0.02 + s.delay}s`,
                ["--fx-dur" as any]: `${s.dur}s`,
                ["--fx-drift" as any]: `${s.drift}px`,
                ["--fx-rise" as any]: `${-s.rise}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* ============================ BUFF DE DP ============================ */}
      {dpFx && dpFx.type === "buff" && (
        <div key={`buff-${dpFx.key}`} className="absolute -inset-6 overflow-visible">
          {/* Bloom dourado/esmeralda */}
          <div
            className="fx-buff-bloom absolute inset-3"
            style={{
              background:
                "radial-gradient(circle at 50% 62%, rgba(255,255,255,0.3) 0%, rgba(74,222,128,0.44) 28%, rgba(251,191,36,0.26) 54%, transparent 78%)",
            }}
          />
          {/* Círculo rúnico de poder girando sob a carta */}
          <div
            className="fx-buff-rune absolute left-1/2 bottom-[6%]"
            style={{
              width: "112%",
              aspectRatio: "1",
              borderRadius: "9999px",
              border: "2px solid rgba(74,222,128,0.9)",
              background:
                "conic-gradient(from 0deg, transparent 0%, rgba(74,222,128,0.5) 14%, transparent 30%, rgba(251,191,36,0.45) 56%, transparent 74%)",
              maskImage: "radial-gradient(circle, transparent 52%, black 60%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 52%, black 60%)",
              boxShadow: "0 0 16px 2px rgba(74,222,128,0.45)",
            }}
          />
          {/* Colunas de luz subindo + varredura de brilho (recortadas na carta) */}
          <div className="absolute inset-6 overflow-hidden">
            {[14, 32, 50, 68, 86].map((x, i) => (
              <span
                key={`beam-${i}`}
                className="fx-buff-beam absolute bottom-0"
                style={{
                  left: `${x}%`,
                  width: 2,
                  height: "92%",
                  background: "linear-gradient(to top, transparent, rgba(74,222,128,0.95), rgba(255,255,255,0.95))",
                  ["--fx-delay" as any]: `${i * 0.06}s`,
                }}
              />
            ))}
            <span
              className="fx-buff-shine absolute inset-y-[-20%] w-[55%]"
              style={{
                background:
                  "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.15) 35%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.15) 65%, transparent 100%)",
              }}
            />
          </div>
          {/* Halos de bênção expandindo */}
          <div className="fx-buff-halo absolute left-1/2 top-1/2" style={{ borderColor: "rgba(255,255,255,0.95)" }} />
          <div
            className="fx-buff-halo absolute left-1/2 top-1/2"
            style={{ borderColor: "rgba(74,222,128,0.85)", ["--fx-delay" as any]: "0.12s" }}
          />
          {/* Chevrons de "power up" subindo */}
          {[0, 1, 2].map((i) => (
            <span
              key={`chev-${i}`}
              className="fx-buff-chevron absolute left-1/2"
              style={{
                bottom: "18%",
                width: 16,
                height: 9,
                background: "linear-gradient(to top, rgba(74,222,128,0.35), rgba(190,255,215,0.98))",
                clipPath: "polygon(50% 0%, 100% 100%, 50% 72%, 0% 100%)",
                filter: "drop-shadow(0 0 6px rgba(74,222,128,0.9))",
                ["--fx-delay" as any]: `${i * 0.13}s`,
              }}
            />
          ))}
          {/* Motes de energia subindo */}
          {BUFF_MOTES.map((m, i) => (
            <span
              key={`mote-${i}`}
              className="fx-buff-mote absolute"
              style={{
                left: `${m.x}%`,
                bottom: "20%",
                width: m.size,
                height: m.size,
                background: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#86efac" : "#fde68a",
                boxShadow: "0 0 7px 2px rgba(134,239,172,0.75)",
                ["--fx-delay" as any]: `${m.delay}s`,
                ["--fx-dur" as any]: `${m.dur}s`,
                ["--fx-drift" as any]: `${m.drift}px`,
                ["--fx-rise" as any]: `${-m.rise}px`,
              }}
            />
          ))}
          {/* Número flutuante (com bloom atrás) */}
          <div className="fx-dp-float-up absolute left-1/2 top-[26%] -translate-x-1/2">
            <span
              className="fx-dp-num relative block text-emerald-200 font-black text-[19px] leading-none whitespace-nowrap"
              style={{
                textShadow:
                  "0 0 6px rgba(255,255,255,0.95), 0 0 14px rgba(74,222,128,0.95), 0 0 26px rgba(74,222,128,0.7), 0 2px 3px rgba(0,0,0,0.95)",
              }}
            >
              +{dpFx.amount} DP
            </span>
          </div>
        </div>
      )}

      {/* =========================== DEBUFF DE DP =========================== */}
      {dpFx && dpFx.type === "debuff" && (
        <div key={`debuff-${dpFx.key}`} className="absolute -inset-6 overflow-visible">
          {/* Flash branco-quente virando vermelho */}
          <div
            className="fx-debuff-impact absolute inset-3"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.62) 0%, rgba(248,113,113,0.55) 34%, rgba(127,29,29,0.4) 62%, transparent 80%)",
            }}
          />
          {/* Vinheta escura fechando sobre a carta */}
          <div
            className="fx-debuff-vignette absolute inset-4"
            style={{ boxShadow: "inset 0 0 22px 8px rgba(90,10,10,0.85)" }}
          />
          {/* Cortes/rachaduras + estilhaços recortados na carta */}
          <div className="absolute inset-6 overflow-hidden">
            <span
              className="fx-debuff-slash absolute inset-y-[-30%] left-[-30%] w-[160%]"
              style={{
                background:
                  "linear-gradient(102deg, transparent 46%, rgba(255,255,255,0.98) 49.4%, rgba(248,113,113,0.95) 50.6%, transparent 54%)",
              }}
            />
            <span
              className="fx-debuff-slash absolute inset-y-[-30%] left-[-30%] w-[160%]"
              style={{
                background:
                  "linear-gradient(-64deg, transparent 46%, rgba(255,255,255,0.92) 49.4%, rgba(220,38,38,0.9) 50.6%, transparent 54%)",
                ["--fx-delay" as any]: "0.12s",
              }}
            />
            {CRACKS.map((c, i) => (
              <span
                key={`crack-${i}`}
                className="fx-debuff-crack absolute"
                style={{
                  left: c.l,
                  top: c.t,
                  width: 2,
                  height: c.len,
                  transform: `rotate(${c.r}deg)`,
                  background:
                    "linear-gradient(to bottom, transparent, rgba(255,255,255,0.98), rgba(248,113,113,0.85), transparent)",
                  ["--fx-delay" as any]: `${0.06 + i * 0.05}s`,
                }}
              />
            ))}
            {/* Fumaça/dreno descendo */}
            {[22, 46, 70, 88].map((x, i) => (
              <span
                key={`drain-${i}`}
                className="fx-debuff-drain absolute top-0"
                style={{
                  left: `${x}%`,
                  width: 3,
                  height: "80%",
                  background: "linear-gradient(to bottom, rgba(220,38,38,0.8), rgba(60,5,5,0.05))",
                  ["--fx-delay" as any]: `${i * 0.07}s`,
                }}
              />
            ))}
          </div>
          {/* Onda de impacto vermelha */}
          <div className="fx-debuff-ring absolute left-1/2 top-1/2" style={{ borderColor: "rgba(248,113,113,0.95)" }} />
          {/* Estilhaços caindo */}
          {DEBUFF_SHARDS.map((s, i) => (
            <span
              key={`shard-${i}`}
              className="fx-debuff-shard absolute"
              style={{
                left: `${s.x}%`,
                top: "38%",
                width: s.size,
                height: s.size,
                background: i % 2 === 0 ? "#f87171" : "#7f1d1d",
                boxShadow: "0 0 6px 1px rgba(248,113,113,0.7)",
                ["--fx-delay" as any]: `${s.delay}s`,
                ["--fx-drift" as any]: `${s.drift}px`,
                ["--fx-fall" as any]: `${s.fall}px`,
                ["--fx-rot" as any]: `${s.rot}deg`,
              }}
            />
          ))}
          {/* Número flutuante */}
          <div className="fx-dp-float-down absolute left-1/2 top-[32%] -translate-x-1/2">
            <span
              className="fx-dp-num relative block text-red-300 font-black text-[19px] leading-none whitespace-nowrap"
              style={{
                textShadow:
                  "0 0 6px rgba(255,255,255,0.8), 0 0 14px rgba(248,113,113,0.95), 0 0 26px rgba(220,38,38,0.75), 0 2px 3px rgba(0,0,0,0.95)",
              }}
            >
              {dpFx.amount} DP
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
