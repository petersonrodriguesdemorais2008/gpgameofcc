"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Check, Lock, Coins, Swords, Crown } from "lucide-react"
import { useGame } from "@/contexts/game-context"
import { PackOpeningOverlay } from "./pack-opening-overlay"
import { RuneNode } from "./rune-node"
import { elementToChestId, type Master } from "@/lib/masters-data"
import { CHESTS } from "@/lib/chests"
import { FRAGMENTS, type FragmentId } from "@/lib/fragments"
import {
  getRuneBranches,
  getRuneProgress,
  getRuneStatus,
  loadUnlockedRunes,
  saveUnlockedRunes,
  runeRewardIconPath,
  runeRewardColor,
  elementToFragmentId,
  type RuneBranchId,
  type RuneDef,
} from "@/lib/runes"

const PIXEL = "var(--font-pixel), 'Courier New', monospace"
const MONO  = "ui-monospace, 'Cascadia Mono', 'Roboto Mono', Menlo, monospace"

const BRANCH_ICON: Record<RuneBranchId, typeof Coins> = {
  fortuna: Coins,
  guerra:  Swords,
  dominio: Crown,
}

/** Cor de identidade de cada ramo — dá personalidade própria sem fugir da paleta. */
const BRANCH_TINT: Record<RuneBranchId, string> = {
  fortuna: "#f2a936",
  guerra:  "#f0705a",
  dominio: "#a78bfa",
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const

/** Glifos rúnicos decorativos que flutuam ao fundo do salão. */
const GLYPHS = ["ᚠ", "ᚱ", "ᚹ", "ᛉ", "ᛟ", "ᚨ", "ᛞ", "ᛗ"] as const

/** Pseudo-aleatório determinístico 0–1 — mesmo layout em todo render. */
function frand(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Fase da onda de cada ramo — cada pista serpenteia de um jeito próprio. */
const BRANCH_PHASE: Record<RuneBranchId, number> = {
  fortuna: 0.6,
  guerra:  2.5,
  dominio: 4.3,
}

/**
 * Pista vertical de cada ramo (fração da largura do mapa). A árvore sobe do
 * núcleo na base em 3 colunas claras — Fortuna à esquerda, Guerra ao centro e
 * Domínio à direita — sem cruzamentos e com espaçamento constante entre tiers.
 */
const BRANCH_LANE: Record<RuneBranchId, number> = {
  fortuna: 0.17,
  guerra:  0.5,
  dominio: 0.83,
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

interface RunesPanelProps {
  master:  Master
  onClose: () => void
}

/** Observa largura e altura de um elemento para dimensionar a rota. */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

// ─── Chip de recurso no cabeçalho ─────────────────────────────────────────────
function ResourceChip({ icon, label, value, color }: {
  icon: string; label: string; value: number; color: string
}) {
  return (
    <div title={label} style={{
      display: "flex", alignItems: "center", gap: 7,
      background: "#101016", border: "2px solid #2c2c36",
      borderBottomColor: "#0a0a0e", borderRightColor: "#0a0a0e",
      padding: "4px 10px 4px 6px",
    }}>
      <img
        src={icon || "/placeholder.svg"}
        alt=""
        width={18} height={18}
        style={{ width: 18, height: 18, objectFit: "contain", imageRendering: "pixelated" }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
      />
      <span style={{
        fontFamily: PIXEL, fontSize: 11, color,
        fontVariantNumeric: "tabular-nums",
      }}>{value.toLocaleString("pt-BR")}</span>
    </div>
  )
}

// ─── Overlay de celebração ────────────────────────────────────────────────────
function RuneUnlockOverlay({ rune, master, onClose }: {
  rune: RuneDef; master: Master; onClose: () => void
}) {
  const chestId = elementToChestId(master.element)
  const tint    = BRANCH_TINT[rune.branchId]

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 620, cursor: "pointer",
        background: "rgba(3,3,7,0.94)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        overflow: "hidden",
        animation: "gpFadeIn 0.22s ease",
      }}>

      {/* Flash inicial de energia varrendo a tela */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(circle at 50% 46%, ${tint}88 0%, ${master.accentColor}44 30%, transparent 62%)`,
        animation: "gpUnlockFlash 1.1s ease-out both",
      }}/>

      {/* Raios de luz divinos girando lentamente atrás do painel */}
      <div aria-hidden="true" style={{
        position: "absolute", left: "50%", top: "46%",
        width: "160vmax", height: "160vmax", pointerEvents: "none",
        background: `repeating-conic-gradient(from 0deg, ${tint}17 0deg 9deg, transparent 9deg 24deg)`,
        maskImage: "radial-gradient(circle, black 0%, transparent 58%)",
        WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 58%)",
        animation: "gpRaysSpin 70s linear infinite",
      }}/>

      {/* Ondas de choque expandindo do centro */}
      {[0, 0.18, 0.4].map((delay, i) => (
        <div key={`wave-${i}`} aria-hidden="true" style={{
          position: "absolute", left: "50%", top: "46%",
          width: "min(120vmin, 900px)", aspectRatio: "1",
          borderRadius: "50%", pointerEvents: "none",
          border: `${3 - i}px solid ${i === 1 ? "#fff6d8" : tint}`,
          boxShadow: `0 0 30px ${tint}88, inset 0 0 30px ${tint}44`,
          animation: `gpShockwave ${0.9 + i * 0.25}s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
        }}/>
      ))}

      {/* Chuva de partículas explodindo do centro */}
      {Array.from({ length: 26 }, (_, i) => {
        const a    = (i / 26) * Math.PI * 2 + frand(i * 1.7) * 0.5
        const dist = 130 + frand(i * 3.3) * 240
        const sz   = 3 + Math.round(frand(i * 5.9) * 5)
        const gold = i % 3 === 0
        return (
          <span key={`p-${i}`} aria-hidden="true" style={{
            position: "absolute", left: "50%", top: "46%",
            width: sz, height: sz, pointerEvents: "none",
            background: gold ? "#ffe9b0" : tint,
            boxShadow: `0 0 8px ${gold ? "#ffe9b0" : tint}`,
            // @ts-expect-error — custom property
            "--dx": `${Math.cos(a) * dist}px`,
            "--dy": `${Math.sin(a) * dist}px`,
            animation: `gpParticleFly ${0.7 + frand(i * 7.7) * 0.8}s cubic-bezier(0.16,1,0.3,1) ${frand(i * 2.1) * 0.22}s both`,
          }}/>
        )
      })}

      {/* Glifos rúnicos ascendendo ao redor do painel */}
      {GLYPHS.map((g, i) => (
        <span key={`gl-${i}`} aria-hidden="true" style={{
          position: "absolute",
          left: `${18 + (i * 9.5) % 66}%`,
          top: `${58 + frand(i * 4.1) * 26}%`,
          fontFamily: MONO, fontSize: 16 + (i % 3) * 8,
          color: i % 2 === 0 ? tint : "#ffe9b0",
          textShadow: `0 0 14px ${tint}`,
          pointerEvents: "none", opacity: 0,
          // @ts-expect-error — custom property
          "--glyph-op": 0.35 + frand(i * 6.3) * 0.4,
          animation: `gpGlyphAscend ${2.6 + frand(i * 3.9) * 2}s ease-out ${0.3 + i * 0.35}s infinite`,
        }}>{g}</span>
      ))}

      <div style={{
        position: "relative", textAlign: "center", maxWidth: 440, width: "100%",
        background: "#0d0d13",
        border: `2px solid ${tint}66`,
        boxShadow: `4px 4px 0 rgba(0,0,0,0.55), inset 0 0 0 1px #17171f, 0 0 46px ${tint}33`,
        borderRadius: 6,
        padding: "26px 22px 20px",
        animation: "gpLevelBounce 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Badge no topo, carimbado com impacto */}
        <div style={{
          position: "absolute", top: -12, left: "50%",
          background: "#c0512c", color: "#ffe9d6",
          border: "2px solid #06060a",
          fontFamily: PIXEL, fontSize: 10, letterSpacing: "0.08em",
          padding: "3px 12px", whiteSpace: "nowrap",
          boxShadow: `0 0 18px ${tint}66`,
          animation: "gpStampIn 0.45s cubic-bezier(0.16,1,0.3,1) 0.12s both",
        }}>✦ RUNA DESBLOQUEADA ✦</div>

        {/* Orbe da runa: aura em flor + anéis girando + ascensão dramática */}
        <div style={{ position: "relative", width: 118, height: 118, margin: "10px auto 14px" }}>
          {/* Aura florescendo atrás do orbe */}
          <div aria-hidden="true" style={{
            position: "absolute", inset: -26, borderRadius: "50%",
            background: `radial-gradient(circle, ${tint}5c 0%, ${tint}1e 45%, transparent 70%)`,
            animation: "gpHaloBloom 0.9s ease-out both, gpAuraBreathe 3.2s ease-in-out 0.9s infinite",
          }}/>
          {/* Anel tracejado girando ao redor do orbe */}
          <div aria-hidden="true" style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            border: `2px dashed ${tint}88`,
            animation: "gpRingSpin 14s linear infinite",
          }}/>
          <div aria-hidden="true" style={{
            position: "absolute", inset: 2, borderRadius: "50%",
            border: `1px dotted ${tint}55`,
            animation: "gpRingSpinRev 20s linear infinite",
          }}/>
          {/* Sparkles cintilando nos cantos do orbe */}
          {[[-4, 14], [104, 4], [110, 92], [-10, 78]].map(([x, y], i) => (
            <span key={`sp-${i}`} aria-hidden="true" style={{
              position: "absolute", left: x, top: y,
              width: 10, height: 10, pointerEvents: "none",
              background: "#fff6d8",
              clipPath: "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)",
              filter: `drop-shadow(0 0 6px ${tint})`,
              animation: `gpSparkleBlink ${1.4 + i * 0.35}s ease-in-out ${0.5 + i * 0.3}s infinite`,
            }}/>
          ))}
          {/* O orbe em si */}
          <div style={{
            position: "absolute", inset: 14, borderRadius: "50%",
            background: `radial-gradient(circle at 36% 30%, #fff4cf 0%, #fff4cf 15%, ${tint} 15%, ${tint} 48%, rgba(0,0,0,0.6) 48%, rgba(0,0,0,0.6) 100%)`,
            border: "2px solid #06060a",
            boxShadow: `0 0 0 2px ${tint}55, 0 0 26px ${tint}88`,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "gpOrbAscend 0.85s cubic-bezier(0.16,1,0.3,1) 0.05s both, gpRuneFloat 3s ease-in-out 0.95s infinite",
          }}>
            <img
              src={runeRewardIconPath(rune.rewards[0], chestId) || "/placeholder.svg"}
              alt="" width={40} height={40}
              style={{ width: 40, height: 40, objectFit: "contain", imageRendering: "pixelated" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          </div>
        </div>

        <div style={{
          fontFamily: PIXEL, fontSize: 17, color: "#f4f2ea", lineHeight: 1.3,
          textShadow: `0 0 18px ${tint}88`,
          animation: "gpTitleGlow 0.6s ease-out 0.3s both",
        }}>{rune.name}</div>
        <p style={{
          fontFamily: MONO, color: "#8b93a1", fontSize: 12, margin: "10px 0 18px", lineHeight: 1.6,
          animation: "gpRiseIn 0.4s ease 0.45s both",
        }}>
          {rune.description}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {rune.rewards.map((rw, i) => {
            const color = runeRewardColor(rw.type, CHESTS[chestId].color)
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 11,
                background: "#14141b", border: "2px solid #26262f",
                borderLeft: `3px solid ${color}`,
                padding: "9px 13px",
                animation: `gpRiseIn 0.35s ease ${0.55 + i * 0.14}s both`,
              }}>
                <img
                  src={runeRewardIconPath(rw, chestId) || "/placeholder.svg"}
                  alt="" width={26} height={26}
                  style={{ width: 26, height: 26, objectFit: "contain", imageRendering: "pixelated" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                />
                <span style={{ fontFamily: PIXEL, fontSize: 11.5, color }}>{rw.label}</span>
              </div>
            )
          })}
        </div>

        <div style={{
          fontFamily: PIXEL, color: "#565d6b", fontSize: 9.5, marginTop: 18,
          animation: "gpRuneBlink 1.2s steps(2, jump-none) infinite",
        }}>
          ▶ TOQUE PARA CONTINUAR
        </div>
      </div>
    </div>
  )
}

// ─── Painel principal ─────────────────────────────────────────────────────────
export function RunesPanel({ master, onClose }: RunesPanelProps) {
  const {
    coins, setCoins, gearCoins, setGearCoins,
    fragments, spendFragments,
    addChests, addSkipTickets, addStaminaBottles,
  } = useGame()

  const [unlocked,    setUnlocked]    = useState<string[]>([])
  const [hydrated,    setHydrated]    = useState(false)
  const [toast,       setToast]       = useState<string | null>(null)
  const [celebration, setCelebration] = useState<RuneDef | null>(null)
  const [pendingPack, setPendingPack] = useState<string | null>(null)
  const [packToOpen,  setPackToOpen]  = useState<string | null>(null)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [burstId,     setBurstId]     = useState<string | null>(null)

  const branches    = useMemo(() => getRuneBranches(master), [master])
  const chestId     = elementToChestId(master.element)
  const elementalId = elementToFragmentId(master.element)
  const progress    = getRuneProgress(master, unlocked)

  const [tracksRef, tracksSize] = useElementSize<HTMLDivElement>()
  const scrollRef     = useRef<HTMLDivElement | null>(null)
  const didAutoScroll = useRef(false)

  useEffect(() => {
    setUnlocked(loadUnlockedRunes()[master.id] ?? [])
    setHydrated(true)
  }, [master.id])

  const allRunes = useMemo(() => branches.flatMap(b => b.runes), [branches])

  // Seleciona automaticamente a runa mais relevante da rota
  useEffect(() => {
    if (!hydrated) return
    setSelectedId(prev => {
      if (prev && allRunes.some(r => r.id === prev)) return prev
      const next = allRunes.find(r => {
        const info = getRuneStatus({ rune: r, unlocked, level: master.currentLevel, gearCoins, fragments })
        return info.status === "available"
      }) ?? allRunes.find(r => !unlocked.includes(r.id)) ?? allRunes[0]
      return next?.id ?? null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, allRunes, unlocked])

  const selected = allRunes.find(r => r.id === selectedId) ?? null
  const selectedInfo = selected && hydrated
    ? getRuneStatus({ rune: selected, unlocked, level: master.currentLevel, gearCoins, fragments })
    : null

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  const handleUnlock = (rune: RuneDef) => {
    const info = getRuneStatus({
      rune, unlocked, level: master.currentLevel, gearCoins, fragments,
    })
    if (info.status !== "available") {
      showToast(info.reason || "Runa indisponível")
      return
    }

    // Debita fragmentos primeiro — a operação é atômica e falha sem consumir nada
    if (!spendFragments(rune.cost.fragments)) {
      showToast("Fragmentos insuficientes")
      return
    }

    // Soma o que a runa entrega e desconta o custo em Gear Coins numa só passada
    let gearDelta = -rune.cost.gearCoins
    let gachaGain = 0
    let chestGain = 0
    let skipGain  = 0
    let bottleGain = 0
    let packId: string | null = null

    for (const rw of rune.rewards) {
      if (rw.type === "gear_coins"     && rw.amount) gearDelta  += rw.amount
      else if (rw.type === "gacha_coins"    && rw.amount) gachaGain  += rw.amount
      else if (rw.type === "chest"          && rw.amount) chestGain  += rw.amount
      else if (rw.type === "skip_ticket"    && rw.amount) skipGain   += rw.amount
      else if (rw.type === "stamina_bottle" && rw.amount) bottleGain += rw.amount
      else if (rw.type === "pack" && rw.packId) packId = rw.packId
    }

    setGearCoins(prev => Math.max(0, prev + gearDelta))
    if (gachaGain) {
      const newTotal = coins + gachaGain
      setCoins(newTotal)
      try { localStorage.setItem("gearperks-coins", String(newTotal)) } catch { /* ignore */ }
    }
    if (chestGain)  addChests({ [chestId]: chestGain })
    if (skipGain)   addSkipTickets(skipGain)
    if (bottleGain) addStaminaBottles(bottleGain)

    const next = [...unlocked, rune.id]
    setUnlocked(next)
    const all = loadUnlockedRunes()
    saveUnlockedRunes({ ...all, [master.id]: next })
    // Avisa a tela de Mestres para atualizar o contador de runas
    window.dispatchEvent(new CustomEvent("gpgame_runes_changed", { detail: { masterId: master.id } }))

    setPendingPack(packId)
    // Explosão no orbe do mapa + overlay de celebração
    setBurstId(rune.id)
    window.setTimeout(() => setBurstId(prev => (prev === rune.id ? null : prev)), 1800)
    setCelebration(rune)
  }

  const closeCelebration = () => {
    setCelebration(null)
    if (pendingPack) {
      setPackToOpen(pendingPack)
      setPendingPack(null)
    }
  }

  // ── Geometria: ÁRVORE DE HABILIDADES — 3 pistas verticais com rolagem ───────
  // O mapa rola verticalmente: o núcleo fica na base e cada ramo sobe em sua
  // própria coluna com espaçamento constante e serpenteio suave — a direção
  // de progressão (base → topo) fica sempre clara e as runas nunca se amontoam.
  const RUNES_N = branches[0]?.runes.length ?? 10
  const W = tracksSize.w
  const H = tracksSize.h
  const ready = W > 0 && H > 0
  const NODE = ready ? Math.max(34, Math.min(54, Math.floor(W / 11))) : 44
  const PED  = Math.round(NODE * 0.42)
  /** Distância vertical entre tiers — folga generosa para respirar. */
  const STEP = Math.max(96, Math.round(NODE * 2.05))
  /** Espaço no topo do mapa (abaixo dos estandartes fixos). */
  const topPad = 86
  /** Núcleo da árvore, na base central do mapa rolável. */
  const rootSize = Math.round(NODE * 1.45)
  /** Distância do centro do núcleo até o centro da 1ª runa. */
  const gap0 = Math.round(rootSize * 0.8 + NODE * 0.95)
  const rootY = topPad + NODE + (RUNES_N - 1) * STEP + gap0
  /** Altura total do conteúdo rolável. */
  const contentH = rootY + rootSize + PED + 28
  const root = { x: W / 2, y: rootY }
  /** Centro vertical da runa de índice i (0 = tier I, embaixo). */
  const yOf = (i: number) => rootY - gap0 - i * STEP
  /** Amplitude do serpenteio horizontal de cada pista. */
  const laneAmp = Math.min(NODE * 0.62, W * 0.05)

  // Ao abrir, centraliza a rolagem na runa mais relevante (a selecionada)
  useEffect(() => {
    if (!ready || !hydrated || didAutoScroll.current || !selectedId) return
    const el = scrollRef.current
    if (!el) return
    didAutoScroll.current = true
    const sel = allRunes.find(r => r.id === selectedId)
    const targetY = sel ? yOf(sel.tier - 1) : rootY
    el.scrollTop = Math.max(0, Math.min(contentH - el.clientHeight, targetY - el.clientHeight * 0.55))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hydrated, selectedId])

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "#0e0e13",
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "gpFadeIn 0.25s ease",
    }}>
      <style>{`
        @keyframes gpRuneGlowPulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @keyframes gpRuneBlink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }
        @keyframes gpRunePathFlow {
          0%   { background-position: 0 0; }
          100% { background-position: 24px 0; }
        }
        @keyframes gpRuneFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes gpGlyphDrift {
          0%   { transform: translateY(12px) rotate(-4deg); opacity: 0; }
          12%  { opacity: var(--glyph-op, 0.2); }
          88%  { opacity: var(--glyph-op, 0.2); }
          100% { transform: translateY(-46px) rotate(5deg); opacity: 0; }
        }
        @keyframes gpAuraBreathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.06); }
        }
        @keyframes gpRingSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes gpRingSpinRev {
          from { transform: rotate(360deg); }
          to   { transform: rotate(0deg); }
        }
        @keyframes gpStarTwinkle {
          0%, 100% { opacity: var(--star-op, 0.5); }
          50%      { opacity: 0.08; }
        }
        @keyframes gpUnlockFlash {
          0%   { opacity: 0; }
          8%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes gpShockwave {
          0%   { transform: translate(-50%, -50%) scale(0.15); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
        @keyframes gpParticleFly {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
        }
        @keyframes gpRaysSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes gpOrbAscend {
          0%   { transform: scale(0.2) rotate(-14deg); opacity: 0; filter: brightness(3); }
          55%  { transform: scale(1.22) rotate(4deg); opacity: 1; filter: brightness(1.7); }
          75%  { transform: scale(0.94) rotate(-1deg); filter: brightness(1.15); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
        }
        @keyframes gpStampIn {
          0%   { transform: translateX(-50%) scale(2.6) rotate(-8deg); opacity: 0; }
          60%  { transform: translateX(-50%) scale(0.9) rotate(2deg); opacity: 1; }
          100% { transform: translateX(-50%) scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes gpHaloBloom {
          0%   { opacity: 0; transform: scale(0.4); }
          40%  { opacity: 1; }
          100% { opacity: 0.65; transform: scale(1); }
        }
        @keyframes gpGlyphAscend {
          0%   { transform: translateY(26px) scale(0.7); opacity: 0; }
          25%  { opacity: var(--glyph-op, 0.5); }
          100% { transform: translateY(-90px) scale(1.15); opacity: 0; }
        }
        @keyframes gpTitleGlow {
          0%   { opacity: 0; transform: translateY(10px); letter-spacing: 0.3em; filter: blur(3px); }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0.02em; filter: blur(0); }
        }
        @keyframes gpNodeBurstPop {
          0%   { transform: scale(1); filter: brightness(1); }
          30%  { transform: scale(1.35); filter: brightness(2.2); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes gpSparkleBlink {
          0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
          50%      { opacity: 1; transform: scale(1) rotate(90deg); }
        }
        .gp-rune-node:hover { filter: brightness(1.12); }
        .gp-rune-node:focus-visible { outline: 2px solid #f7f4ee; outline-offset: 6px; }
        .gp-rune-cta:active { transform: translateY(2px); box-shadow: 0 1px 0 #0b3f2d !important; }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gpRuneGlowPulse { from { opacity: 0.8 } to { opacity: 0.8 } }
          @keyframes gpRuneBlink     { from { opacity: 1 }   to { opacity: 1 } }
          @keyframes gpRunePathFlow  { from { background-position: 0 0 } to { background-position: 0 0 } }
          @keyframes gpRuneFloat     { from { transform: none } to { transform: none } }
          @keyframes gpGlyphDrift    { from { opacity: 0.15; transform: none } to { opacity: 0.15; transform: none } }
          @keyframes gpAuraBreathe   { from { opacity: 0.7; transform: none } to { opacity: 0.7; transform: none } }
          @keyframes gpRingSpin      { from { transform: none } to { transform: none } }
          @keyframes gpRingSpinRev   { from { transform: none } to { transform: none } }
          @keyframes gpStarTwinkle   { from { opacity: 0.4 } to { opacity: 0.4 } }
          @keyframes gpUnlockFlash   { from { opacity: 0 } to { opacity: 0 } }
          @keyframes gpShockwave     { from { opacity: 0 } to { opacity: 0 } }
          @keyframes gpParticleFly   { from { opacity: 0 } to { opacity: 0 } }
          @keyframes gpRaysSpin      { from { transform: translate(-50%, -50%) } to { transform: translate(-50%, -50%) } }
          @keyframes gpOrbAscend     { from { transform: none; opacity: 1 } to { transform: none; opacity: 1 } }
          @keyframes gpStampIn       { from { transform: translateX(-50%); opacity: 1 } to { transform: translateX(-50%); opacity: 1 } }
          @keyframes gpHaloBloom     { from { opacity: 0.5; transform: none } to { opacity: 0.5; transform: none } }
          @keyframes gpGlyphAscend   { from { opacity: 0 } to { opacity: 0 } }
          @keyframes gpTitleGlow     { from { opacity: 1; transform: none; filter: none } to { opacity: 1; transform: none; filter: none } }
          @keyframes gpNodeBurstPop  { from { transform: none } to { transform: none } }
          @keyframes gpSparkleBlink  { from { opacity: 0.6; transform: none } to { opacity: 0.6; transform: none } }
        }
      `}</style>

      {/* Fundo: céu arcano profundo + círculo de invocação + estrelas + glifos */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Céu profundo com nebulosas na cor do mestre */}
        <div style={{
          position: "absolute", inset: 0,
          background: [
            `radial-gradient(ellipse 110% 80% at 50% 118%, ${master.accentColor}1c 0%, transparent 55%)`,
            `radial-gradient(ellipse 75% 60% at 8% -12%, #1d1d38 0%, transparent 58%)`,
            `radial-gradient(ellipse 65% 55% at 94% 4%, ${master.accentColor}12 0%, transparent 60%)`,
            "linear-gradient(180deg, #0c0c18 0%, #08080f 52%, #0a0a14 100%)",
          ].join(", "),
        }}/>

        {/* Estrelas cintilando */}
        {Array.from({ length: 34 }, (_, i) => {
          const sz = 1 + Math.round(frand(i * 3.7) * 2)
          return (
            <span key={`star-${i}`} style={{
              position: "absolute",
              left: `${frand(i * 1.3 + 5) * 98}%`,
              top: `${frand(i * 2.9 + 11) * 96}%`,
              width: sz, height: sz, borderRadius: "50%",
              background: i % 5 === 0 ? master.accentColor : "#cdd3e6",
              boxShadow: i % 5 === 0 ? `0 0 6px ${master.accentColor}` : "0 0 4px rgba(205,211,230,0.7)",
              // @ts-expect-error — custom property
              "--star-op": 0.25 + frand(i * 7.1) * 0.55,
              animation: `gpStarTwinkle ${2.4 + frand(i * 4.3) * 3.6}s ease-in-out ${frand(i * 9.7) * 4}s infinite`,
            }}/>
          )
        })}

        {/* Círculo de invocação gigante emanando do núcleo da árvore */}
        <div style={{
          position: "absolute", left: "50%", top: "68%",
          width: "min(96vh, 70vw)", aspectRatio: "1",
          transform: "translate(-50%, -50%)",
        }}>
          {/* Anel externo tracejado girando */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px dashed ${master.accentColor}30`,
            animation: "gpRingSpin 90s linear infinite",
          }}/>
          {/* Anel fino intermediário */}
          <div style={{
            position: "absolute", inset: "8%", borderRadius: "50%",
            border: `1px solid ${master.accentColor}20`,
            boxShadow: `inset 0 0 60px ${master.accentColor}0d`,
          }}/>
          {/* Anel pontilhado interno girando ao contrário */}
          <div style={{
            position: "absolute", inset: "21%", borderRadius: "50%",
            border: `2px dotted ${master.accentColor}28`,
            animation: "gpRingSpinRev 130s linear infinite",
          }}/>
          {/* Núcleo de energia respirando */}
          <div style={{
            position: "absolute", inset: "34%", borderRadius: "50%",
            background: `radial-gradient(circle, ${master.accentColor}26 0%, ${master.accentColor}0c 45%, transparent 70%)`,
            animation: "gpAuraBreathe 6s ease-in-out infinite",
          }}/>
          {/* Glifos orbitando o círculo */}
          <div style={{ position: "absolute", inset: "10%", animation: "gpRingSpin 160s linear infinite" }}>
            {GLYPHS.map((g, i) => {
              const a = (i / GLYPHS.length) * Math.PI * 2
              return (
                <span key={`orbit-${i}`} style={{
                  position: "absolute",
                  left: `${50 + 48 * Math.cos(a)}%`,
                  top: `${50 + 48 * Math.sin(a)}%`,
                  transform: "translate(-50%, -50%)",
                  fontFamily: MONO, fontSize: 18,
                  color: `${master.accentColor}66`,
                  textShadow: `0 0 12px ${master.accentColor}55`,
                }}>{g}</span>
              )
            })}
          </div>
        </div>

        {/* Névoa colorida do mestre subindo do horizonte */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 90% 55% at 50% 0%, ${master.accentColor}1a 0%, transparent 60%)`,
        }}/>
        {/* Vinheta: escurece as bordas para o mapa não competir com a UI */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 88% 78% at 50% 44%, transparent 30%, rgba(4,4,9,0.9) 100%)",
        }}/>
        {/* Glifos rúnicos flutuando como brasas */}
        {GLYPHS.map((g, i) => (
          <span key={i} style={{
            position: "absolute",
            left: `${6 + (i * 12.3) % 90}%`,
            top: `${14 + (i * 23) % 68}%`,
            fontFamily: MONO,
            fontSize: 15 + (i % 3) * 7,
            color: i % 2 === 0 ? master.accentColor : BRANCH_TINT[(["fortuna","guerra","dominio"] as const)[i % 3]],
            opacity: 0,
            // @ts-expect-error — custom property
            "--glyph-op": 0.12 + (i % 3) * 0.05,
            animation: `gpGlyphDrift ${7 + (i % 4) * 2.4}s linear ${i * 1.15}s infinite`,
            textShadow: `0 0 12px ${master.accentColor}66`,
          }}>{g}</span>
        ))}
      </div>

      {toast && (
        <div role="status" style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 700,
          background: "#101016", border: "2px solid #3c3c48",
          boxShadow: "3px 3px 0 rgba(0,0,0,0.5)",
          padding: "9px 18px", color: "#f0ede6",
          fontFamily: PIXEL, fontSize: 11,
          maxWidth: "90vw", textAlign: "center", animation: "gpToastIn 0.25s ease",
        }}>
          {toast}
        </div>
      )}

      {celebration && (
        <RuneUnlockOverlay rune={celebration} master={master} onClose={closeCelebration}/>
      )}

      {packToOpen && (
        <PackOpeningOverlay packId={packToOpen} onClose={() => setPackToOpen(null)}/>
      )}

      {/* ── Cabeçalho ── */}
      <header style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "8px 16px", borderBottom: `2px solid ${master.accentColor}33`,
        background: `linear-gradient(180deg, #0b0b10 0%, #0b0b10 70%, ${master.accentColor}0a 100%)`,
        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        position: "relative", zIndex: 5, flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label="Voltar" style={{
          background: "#16161d", border: "2px solid #2e2e38",
          borderBottomColor: "#0a0a0e", borderRightColor: "#0a0a0e",
          width: 34, height: 34, cursor: "pointer", color: "#9aa1ad",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}><ArrowLeft size={16}/></button>

        <div style={{
          width: 36, height: 36, overflow: "hidden", flexShrink: 0,
          border: `2px solid ${master.accentColor}`,
          background: "#101016",
          boxShadow: `0 0 12px ${master.accentColor}55`,
        }}>
          <img src={master.iconPath || "/placeholder.svg"} alt={master.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
        </div>

        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontFamily: PIXEL, fontSize: 12.5, color: "#f5f2ec",
            margin: 0, whiteSpace: "nowrap", letterSpacing: "0.02em",
            textShadow: `0 0 14px ${master.accentColor}66`,
          }}>ROTA DE RUNAS · {master.name.toUpperCase()}</h1>
          <div style={{
            fontFamily: MONO, fontSize: 10, color: "#6d7482", marginTop: 2,
          }}>
            {progress.done}/{progress.total} runas — Mestre nível {master.currentLevel}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 12 }}/>

        {/* Progresso da rota compacto, no próprio cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 130 }}>
          <div style={{
            display: "flex", gap: 2, padding: 2, flex: 1, minWidth: 90,
            background: "#08080d", border: "2px solid #2c2c36",
            borderBottomColor: "#3a3a46", borderRightColor: "#3a3a46",
            boxShadow: progress.done > 0 ? `0 0 10px ${master.accentColor}22` : "none",
          }}>
            {Array.from({ length: 10 }, (_, i) => {
              const filled = progress.pct >= (i + 1) * 10 - 0.01
              return (
                <div key={i} style={{
                  flex: 1, height: 8,
                  background: filled
                    ? `linear-gradient(180deg, #ffe9b0 0%, #ffe9b0 30%, ${master.accentColor} 30%, ${master.accentColor} 100%)`
                    : "linear-gradient(180deg, #16161d 0%, #1e1e26 100%)",
                  boxShadow: filled ? `0 0 5px ${master.accentColor}66` : "none",
                }}/>
              )
            })}
          </div>
          <span style={{
            fontFamily: PIXEL, fontSize: 10, color: master.accentColor,
            fontVariantNumeric: "tabular-nums", flexShrink: 0,
          }}>{Math.round(progress.pct)}%</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <ResourceChip icon="/images/gear-coin.png" label="Gear Coins" value={gearCoins} color="#f2c14e"/>
          <ResourceChip
            icon={FRAGMENTS[elementalId].image}
            label={FRAGMENTS[elementalId].name}
            value={fragments[elementalId] ?? 0}
            color={FRAGMENTS[elementalId].color}
          />
          {elementalId !== "galio" && (
            <ResourceChip
              icon={FRAGMENTS.galio.image}
              label={FRAGMENTS.galio.name}
              value={fragments.galio ?? 0}
              color={FRAGMENTS.galio.color}
            />
          )}
        </div>
      </header>

      {/* ── Mapa de rotas: árvore vertical rolável, 3 pistas + núcleo na base ── */}
      <div
        ref={tracksRef}
        style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 4 }}
      >
        {/* Estandartes dos ramos — fixos no topo do mapa, fora da rolagem */}
        {ready && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 6,
            pointerEvents: "none",
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "8px 10px 20px",
            background: "linear-gradient(180deg, rgba(8,8,13,0.94) 0%, rgba(8,8,13,0.6) 55%, transparent 100%)",
          }}>
            {branches.map(branch => {
              const BranchIcon     = BRANCH_ICON[branch.id]
              const tint           = BRANCH_TINT[branch.id]
              const branchDone     = branch.runes.filter(r => unlocked.includes(r.id)).length
              const branchComplete = branchDone === branch.runes.length
              return (
                <div key={`banner-${branch.id}`} style={{
                  flex: 1, display: "flex",
                  justifyContent: branch.id === "fortuna" ? "flex-start"
                    : branch.id === "dominio" ? "flex-end" : "center",
                }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    background: `linear-gradient(135deg, ${tint}1c 0%, rgba(10,10,16,0.9) 70%)`,
                    border: "2px solid #23232c",
                    borderLeft: `3px solid ${tint}aa`,
                    borderRadius: 5,
                    padding: "4px 9px 4px 6px",
                    boxShadow: `inset 0 0 16px ${tint}0e, 0 4px 12px rgba(0,0,0,0.4)`,
                  }}>
                    <div style={{
                      width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `linear-gradient(180deg, ${tint}22, #14141b)`,
                      border: `2px solid ${tint}88`,
                      boxShadow: `0 0 8px ${tint}44`, flexShrink: 0,
                    }}>
                      <BranchIcon size={11} color={tint}/>
                    </div>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 9.5, color: "#f3f0ea",
                      textShadow: `0 0 10px ${tint}66`, whiteSpace: "nowrap",
                    }}>{branch.name.toUpperCase()}</span>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 8.5,
                      color: branchComplete ? "#4ecf9d" : tint,
                      fontVariantNumeric: "tabular-nums",
                      display: "inline-flex", alignItems: "center", gap: 3,
                      background: "#0d0d13", border: `2px solid ${branchComplete ? "#1d7d5c" : `${tint}44`}`,
                      padding: "0px 5px",
                    }}>
                      {branchComplete && <Check size={9} strokeWidth={3}/>}
                      {branchDone}/{branch.runes.length}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div ref={scrollRef} style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: ready ? contentH : "100%" }}>
        {ready && branches.map((branch, bIdx) => {
          const tint = BRANCH_TINT[branch.id]
          const statusById = new Map(branch.runes.map(r => [
            r.id,
            hydrated
              ? getRuneStatus({ rune: r, unlocked, level: master.currentLevel, gearCoins, fragments }).status
              : ("locked_prev" as const),
          ]))

          // Posições em pista: cada runa sobe em coluna com serpenteio suave e
          // espaçamento constante — a direção (base → topo) fica sempre clara.
          const phase = BRANCH_PHASE[branch.id]
          const laneX = clamp(W * BRANCH_LANE[branch.id], NODE / 2 + 16, W - NODE / 2 - 16)
          const pts = branch.runes.map((_, i) => ({
            x: clamp(laneX + Math.sin(i * 0.9 + phase) * laneAmp, NODE / 2 + 10, W - NODE / 2 - 10),
            y: yOf(i),
          }))

          const firstStatus = statusById.get(branch.runes[0].id)

          return (
            <div key={branch.id} style={{
              position: "absolute", inset: 0,
              pointerEvents: "none",
              animation: `gpRiseIn 0.4s ease ${bIdx * 0.08}s both`,
            }}>
              {/* Raiz de energia: conecta o núcleo central à 1ª runa do ramo */}
              {(() => {
                const dx  = pts[0].x - root.x
                const dy  = pts[0].y - root.y
                const len = Math.max(4, Math.sqrt(dx * dx + dy * dy))
                const ang = (Math.atan2(dy, dx) * 180) / Math.PI
                const lit = firstStatus === "unlocked"
                const nxt = firstStatus === "available"
                return (
                  <div aria-hidden="true" style={{
                    position: "absolute", left: root.x, top: root.y,
                    width: len, height: 5, marginTop: -2.5,
                    transform: `rotate(${ang}deg)`,
                    transformOrigin: "0 50%",
                    borderRadius: 3,
                    background: lit
                      ? `linear-gradient(90deg, ${master.accentColor} 0%, #fff6d8 50%, ${tint} 100%)`
                      : `linear-gradient(90deg, ${master.accentColor}55 0%, #454654 55%, #33343f 100%)`,
                    boxShadow: lit ? `0 0 10px ${tint}88` : "none",
                    opacity: lit ? 0.95 : 0.6,
                    overflow: "hidden",
                  }}>
                    {nxt && (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0 7px, transparent 7px 18px)",
                        animation: "gpRunePathFlow 1.1s linear infinite",
                        mixBlendMode: "screen",
                      }}/>
                    )}
                  </div>
                )
              })()}
              {/* Feixe de energia da pista: coluna de luz sutil atrás do ramo */}
              <div aria-hidden="true" style={{
                position: "absolute",
                left: laneX - NODE * 1.15,
                top: pts[RUNES_N - 1].y - NODE * 1.1,
                width: NODE * 2.3,
                height: root.y - pts[RUNES_N - 1].y + NODE * 1.6,
                background: `linear-gradient(180deg, ${tint}16 0%, ${tint}09 55%, transparent 100%)`,
                maskImage: "linear-gradient(90deg, transparent 0%, black 32%, black 68%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 32%, black 68%, transparent 100%)",
              }}/>

              {/* Linhas de energia conectando os orbes */}
              {branch.runes.slice(0, -1).map((rune, i) => {
                const a = pts[i]
                const b = pts[i + 1]
                const dx  = b.x - a.x
                const dy  = b.y - a.y
                const len = Math.max(4, Math.sqrt(dx * dx + dy * dy))
                const ang = (Math.atan2(dy, dx) * 180) / Math.PI
                const lit  = statusById.get(rune.id) === "unlocked"
                const next = statusById.get(branch.runes[i + 1].id) === "available"
                return (
                  <div
                    key={`path-${rune.id}`}
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: a.x, top: a.y,
                      width: len, height: 5, marginTop: -2.5,
                      transform: `rotate(${ang}deg)`,
                      transformOrigin: "0 50%",
                      borderRadius: 3,
                      background: lit
                        ? `linear-gradient(90deg, ${tint}00 0%, ${tint} 16%, #fff6d8 50%, ${tint} 84%, ${tint}00 100%)`
                        : "linear-gradient(90deg, transparent 0%, #33343f 16%, #454654 50%, #33343f 84%, transparent 100%)",
                      boxShadow: lit ? `0 0 10px ${tint}88` : "none",
                      opacity: lit ? 0.95 : 0.55,
                      overflow: "hidden",
                    }}
                  >
                    {/* Pulso de energia correndo até a próxima runa disponível */}
                    {lit && next && (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0 7px, transparent 7px 18px)",
                        animation: "gpRunePathFlow 1.1s linear infinite",
                        mixBlendMode: "screen",
                      }}/>
                    )}
                  </div>
                )
              })}

              {/* Nós da rota */}
              {branch.runes.map((rune, i) => {
                const status      = statusById.get(rune.id) ?? "locked_prev"
                const isDone      = status === "unlocked"
                const isAvailable = status === "available"
                const isLocked    = !isDone && !isAvailable
                const isSelected  = selectedId === rune.id
                const isBursting  = burstId === rune.id
                /** A runa final do ramo é maior — o ápice épico da pista. */
                const isApex      = rune.tier === RUNES_N
                const nSize       = isApex ? Math.round(NODE * 1.24) : NODE
                const iconSize    = Math.round(nSize * 0.44)
                const sealSize    = Math.max(13, Math.round(nSize * 0.26))

                return (
                  <div
                    key={rune.id}
                    style={{
                      position: "absolute",
                      left: pts[i].x,
                      top: pts[i].y - nSize / 2,
                      transform: "translateX(-50%)",
                      // Reativa os cliques: o container do ramo usa pointerEvents "none"
                      // para uma camada não bloquear os nós das outras rotas.
                      pointerEvents: "auto",
                      zIndex: isBursting ? 4 : isSelected ? 3 : 1,
                      animation: isBursting ? "gpNodeBurstPop 0.7s cubic-bezier(0.16,1,0.3,1)" : "none",
                    }}
                  >
                    {/* Explosão de energia no momento do desbloqueio */}
                    {isBursting && (
                      <div aria-hidden="true" style={{
                        position: "absolute", left: "50%", top: nSize / 2,
                        width: 0, height: 0, pointerEvents: "none", zIndex: 5,
                      }}>
                        {[0, 0.14, 0.3].map((delay, w) => (
                          <div key={`bw-${w}`} style={{
                            position: "absolute", left: 0, top: 0,
                            width: NODE * 3.2, aspectRatio: "1", borderRadius: "50%",
                            border: `${3 - w}px solid ${w === 1 ? "#fff6d8" : "#4ecf9d"}`,
                            boxShadow: "0 0 16px #4ecf9d88",
                            animation: `gpShockwave ${0.65 + w * 0.2}s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
                          }}/>
                        ))}
                        {Array.from({ length: 14 }, (_, p) => {
                          const a    = (p / 14) * Math.PI * 2 + frand(p * 2.3) * 0.6
                          const dist = NODE * (0.9 + frand(p * 4.1) * 1.3)
                          const gold = p % 3 === 0
                          return (
                            <span key={`bp-${p}`} style={{
                              position: "absolute", left: -2, top: -2,
                              width: 4 + Math.round(frand(p * 6.7) * 3),
                              height: 4 + Math.round(frand(p * 6.7) * 3),
                              background: gold ? "#ffe9b0" : "#4ecf9d",
                              boxShadow: `0 0 6px ${gold ? "#ffe9b0" : "#4ecf9d"}`,
                              // @ts-expect-error — custom property
                              "--dx": `${Math.cos(a) * dist}px`,
                              "--dy": `${Math.sin(a) * dist}px`,
                              animation: `gpParticleFly ${0.55 + frand(p * 8.9) * 0.5}s cubic-bezier(0.16,1,0.3,1) ${frand(p * 3.7) * 0.15}s both`,
                            }}/>
                          )
                        })}
                      </div>
                    )}
                    {/* Coroa de raios atrás da runa final do ramo */}
                    {isApex && !isLocked && (
                      <div aria-hidden="true" style={{
                        position: "absolute",
                        left: "50%", top: nSize / 2,
                        width: nSize * 2.4, height: nSize * 2.4,
                        transform: "translate(-50%, -50%)",
                        pointerEvents: "none",
                        background: `repeating-conic-gradient(from 0deg, ${tint}22 0deg 12deg, transparent 12deg 30deg)`,
                        maskImage: "radial-gradient(circle, black 0%, transparent 68%)",
                        WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 68%)",
                        borderRadius: "50%",
                        animation: "gpRingSpin 26s linear infinite",
                      }}/>
                    )}
                    <RuneNode
                      size={nSize}
                      tint={isDone ? "#4ecf9d" : tint}
                      tintStrength={isLocked ? 0.4 : 1}
                      selected={isSelected}
                      dim={isLocked}
                      float={isAvailable}
                      label={`${rune.name} — ${isDone ? "gravada" : isAvailable ? "disponível" : "bloqueada"}`}
                      onClick={() => setSelectedId(rune.id)}
                    >
                      <img
                        src={runeRewardIconPath(rune.rewards[0], chestId) || "/placeholder.svg"}
                        alt="" width={iconSize} height={iconSize}
                        style={{
                          width: iconSize, height: iconSize, objectFit: "contain",
                          imageRendering: "pixelated",
                          filter: isLocked ? "grayscale(1) brightness(0.8)" : "drop-shadow(0 2px 0 rgba(0,0,0,0.5))",
                        }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    </RuneNode>

                    {/* Selo de estado no canto do orbe */}
                    {(isDone || isLocked) && (
                      <div aria-hidden="true" style={{
                        position: "absolute", right: -3, top: nSize - sealSize,
                        width: sealSize, height: sealSize,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isDone ? "#166b50" : "#16161d",
                        border: "2px solid #06060a",
                      }}>
                        {isDone
                          ? <Check size={Math.round(sealSize * 0.55)} strokeWidth={3} color="#d8fff0"/>
                          : <Lock size={Math.round(sealSize * 0.5)} color="#6d7482"/>}
                      </div>
                    )}

                    {/* Tier em algarismo romano sob o pedestal */}
                    <div style={{
                      position: "absolute", top: nSize + Math.round(nSize * 0.42) + 2, left: "50%", transform: "translateX(-50%)",
                      fontFamily: PIXEL, fontSize: Math.max(7.5, nSize * 0.16),
                      color: isSelected ? tint : isLocked ? "#5b6270" : "#9aa1ad",
                      textShadow: isSelected ? `0 0 8px ${tint}88` : "0 2px 0 rgba(0,0,0,0.7)",
                      whiteSpace: "nowrap",
                    }}>
                      {ROMAN[rune.tier - 1] ?? rune.tier}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* ── Núcleo da árvore: emblema do Mestre irradiando os 3 ramos ── */}
        {ready && (
          <div aria-hidden="true" style={{
            position: "absolute",
            left: root.x, top: root.y,
            width: 0, height: 0,
            pointerEvents: "none", zIndex: 3,
          }}>
            {/* Aura respirando */}
            <div style={{
              position: "absolute",
              left: -rootSize * 1.1, top: -rootSize * 1.1,
              width: rootSize * 2.2, height: rootSize * 2.2,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${master.accentColor}55 0%, ${master.accentColor}1a 45%, transparent 70%)`,
              animation: "gpAuraBreathe 3.6s ease-in-out infinite",
            }}/>
            {/* Anéis girando ao redor do núcleo */}
            <div style={{
              position: "absolute",
              left: -rootSize * 0.78, top: -rootSize * 0.78,
              width: rootSize * 1.56, height: rootSize * 1.56,
              borderRadius: "50%",
              border: `2px dashed ${master.accentColor}77`,
              animation: "gpRingSpin 18s linear infinite",
            }}/>
            <div style={{
              position: "absolute",
              left: -rootSize * 0.62, top: -rootSize * 0.62,
              width: rootSize * 1.24, height: rootSize * 1.24,
              borderRadius: "50%",
              border: `1px dotted ${master.accentColor}55`,
              animation: "gpRingSpinRev 26s linear infinite",
            }}/>
            {/* Orbe do núcleo com o retrato do Mestre */}
            <div style={{
              position: "absolute",
              left: -rootSize / 2, top: -rootSize / 2,
              width: rootSize, height: rootSize,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #06060a",
              boxShadow: `0 0 0 2px ${master.accentColor}88, 0 0 26px ${master.accentColor}77`,
              background: "#101016",
              animation: "gpRuneFloat 3.4s ease-in-out infinite",
            }}>
              <img
                src={master.iconPath || "/placeholder.svg"}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
              />
              {/* Verniz de cor do mestre sobre o retrato */}
              <div style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(circle at 36% 28%, transparent 35%, ${master.accentColor}33 100%)`,
              }}/>
            </div>
            {/* Rótulo do núcleo */}
            <div style={{
              position: "absolute",
              left: "50%", top: rootSize / 2 + 6,
              transform: "translateX(-50%)",
              fontFamily: PIXEL, fontSize: Math.max(7.5, NODE * 0.2),
              color: master.accentColor,
              textShadow: `0 0 10px ${master.accentColor}88, 0 2px 0 rgba(0,0,0,0.7)`,
              whiteSpace: "nowrap", letterSpacing: "0.08em",
            }}>NÚCLEO</div>
          </div>
        )}
        </div>
        </div>
      </div>

      {/* ── Painel de detalhe da runa selecionada — fixo na base ── */}
      {selected && selectedInfo && (() => {
        const tint  = BRANCH_TINT[selected.branchId]
        const done  = selectedInfo.status === "unlocked"
        const avail = selectedInfo.status === "available"
        const stateColor = done ? "#4ecf9d" : avail ? tint : "#7b8290"
        const stateLabel = done ? "GRAVADA" : avail ? "DISPONÍVEL" : "BLOQUEADA"
        const badgeBg    = done ? "#1d7d5c" : avail ? "#c0512c" : "#33333d"
        const badgeFg    = done ? "#d8fff0" : avail ? "#ffe9d6" : "#9aa1ad"
        const selBranch  = branches.find(b => b.id === selected.branchId)
        const branchName = selBranch?.name ?? ""
        const branchSize = selBranch?.runes.length ?? 10

        return (
          <div style={{
            position: "relative", zIndex: 6, flexShrink: 0,
            padding: "12px 14px 12px",
            background: "linear-gradient(0deg, rgba(8,8,13,0.97) 70%, rgba(8,8,13,0))",
          }}>
            <div style={{
              position: "relative", maxWidth: 980, margin: "0 auto",
              background: "rgba(11,11,17,0.97)",
              border: `2px solid ${done || avail ? `${tint}55` : "#34343f"}`,
              borderLeft: `4px solid ${stateColor}`,
              boxShadow: `4px 4px 0 rgba(0,0,0,0.5), inset 0 0 0 1px #17171f${avail ? `, 0 0 24px ${tint}22` : ""}`,
              borderRadius: 6,
              padding: "14px 14px 12px",
            }}>
              {/* Badge de estado sobre a borda */}
              <div style={{
                position: "absolute", top: -12, left: 12,
                display: "inline-flex", alignItems: "center", gap: 6,
                background: badgeBg, color: badgeFg,
                border: "2px solid #06060a",
                padding: "2px 10px",
                fontFamily: PIXEL, fontSize: 10, letterSpacing: "0.06em",
              }}>
                {done ? <Check size={10} strokeWidth={3}/> : !avail ? <Lock size={9}/> : null}
                {stateLabel}
              </div>

              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* Orbe da recompensa principal + nível */}
                <div style={{ flexShrink: 0, textAlign: "center", paddingTop: 2 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%", position: "relative",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: done || avail
                      ? `radial-gradient(circle at 36% 30%, #fff4cf 0%, #fff4cf 16%, ${tint} 16%, ${tint} 50%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.55) 100%)`
                      : "radial-gradient(circle at 36% 30%, #8f9099 0%, #8f9099 16%, #585a64 16%, #585a64 50%, #232429 50%, #232429 100%)",
                    border: "2px solid #06060a",
                    boxShadow: done || avail ? `0 0 0 2px ${tint}55, 0 0 14px ${tint}55` : "none",
                  }}>
                    <img
                      src={runeRewardIconPath(selected.rewards[0], chestId) || "/placeholder.svg"}
                      alt="" width={26} height={26}
                      style={{ width: 26, height: 26, objectFit: "contain", imageRendering: "pixelated" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                    />
                  </div>
                  <div style={{
                    marginTop: 5, fontFamily: PIXEL, fontSize: 9, color: "#cfcbc3",
                  }}>Nv. {selected.tier}/{branchSize}</div>
                </div>

                <div style={{ flex: 1, minWidth: 220 }}>
                  {/* Título + ramo */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 13, color: "#f6f3ed", lineHeight: 1.3,
                    }}>{selected.name}</span>
                    <div style={{ flex: 1, minWidth: 8 }}/>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 9, color: tint,
                    }}>{branchName.toUpperCase()}</span>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 9,
                      color: master.currentLevel >= selected.requiredLevel ? "#4ecf9d" : "#f0a97a",
                      border: `2px solid ${master.currentLevel >= selected.requiredLevel ? "#1d7d5c" : "#8a5a34"}`,
                      background: "#101016",
                      padding: "1px 6px",
                    }}>Lv.{selected.requiredLevel}</span>
                  </div>

                  <p style={{
                    margin: "6px 0 0", fontFamily: MONO, fontSize: 11, color: "#8b93a1",
                    lineHeight: 1.5,
                  }}>{selected.description}</p>

                  {/* Recompensas + custo numa faixa única e compacta */}
                  <div style={{
                    marginTop: 10,
                    display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
                  }}>
                    {selected.rewards.map((rw, i) => {
                      const c = runeRewardColor(rw.type, CHESTS[chestId].color)
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "#14141b", border: "2px solid #26262f",
                          borderBottomColor: "#0c0c11", borderRightColor: "#0c0c11",
                          padding: "3px 8px 3px 5px",
                        }}>
                          <img
                            src={runeRewardIconPath(rw, chestId) || "/placeholder.svg"}
                            alt="" width={16} height={16}
                            style={{ width: 16, height: 16, objectFit: "contain", imageRendering: "pixelated" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                          />
                          <span style={{ fontFamily: PIXEL, fontSize: 9.5, color: c }}>{rw.label}</span>
                        </div>
                      )
                    })}

                    {!done && (
                      <>
                        <span aria-hidden="true" style={{
                          width: 2, height: 18, background: "#26262f", margin: "0 2px", flexShrink: 0,
                        }}/>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <img src="/images/gear-coin.png" alt="" width={15} height={15}
                            style={{ width: 15, height: 15, objectFit: "contain", imageRendering: "pixelated" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                          <span style={{
                            fontFamily: PIXEL, fontSize: 10.5, fontVariantNumeric: "tabular-nums",
                            color: gearCoins >= selected.cost.gearCoins ? "#f2c14e" : "#f87171",
                          }}>{selected.cost.gearCoins.toLocaleString("pt-BR")}</span>
                        </div>
                        {(Object.entries(selected.cost.fragments) as [FragmentId, number][]).map(([fid, amount]) => {
                          const have = fragments[fid] ?? 0
                          return (
                            <div key={fid} title={FRAGMENTS[fid].name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <img src={FRAGMENTS[fid].image || "/placeholder.svg"} alt="" width={15} height={15}
                                style={{ width: 15, height: 15, objectFit: "contain", imageRendering: "pixelated" }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                              <span style={{
                                fontFamily: PIXEL, fontSize: 10.5, fontVariantNumeric: "tabular-nums",
                                color: have >= amount ? FRAGMENTS[fid].color : "#f87171",
                              }}>{amount}</span>
                            </div>
                          )
                        })}
                      </>
                    )}

                    <div style={{ flex: 1, minWidth: 8 }}/>

                    {!done && (avail ? (
                      <button
                        onClick={() => handleUnlock(selected)}
                        className="gp-rune-cta"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          background: "#46c295",
                          border: "2px solid #0b3f2d",
                          borderRadius: 3,
                          padding: "7px 14px", cursor: "pointer", color: "#06281c",
                          fontFamily: PIXEL, fontSize: 10.5,
                          boxShadow: "0 3px 0 #0b3f2d",
                          transition: "transform 0.06s, box-shadow 0.06s",
                        }}>
                        GRAVAR RUNA
                      </button>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        color: "#8b93a1", fontFamily: MONO, fontSize: 10.5,
                      }}><Lock size={11}/> {selectedInfo.reason}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default RunesPanel
