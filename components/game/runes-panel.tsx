"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
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
 * Pista vertical de cada ramo (fração da largura do mapa). A árvore desce do
 * núcleo no topo em 3 colunas claras — Fortuna à esquerda, Guerra ao centro e
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
      background: `linear-gradient(135deg, ${color}1a 0%, rgba(14,16,34,0.5) 60%)`,
      border: `1px solid ${color}44`,
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      borderRadius: 999,
      padding: "4px 12px 4px 8px",
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.09), 0 2px 12px rgba(0,0,0,0.35), 0 0 14px ${color}1e`,
    }}>
      <img
        src={icon || "/placeholder.svg"}
        alt=""
        width={18} height={18}
        style={{ width: 18, height: 18, objectFit: "contain", filter: `drop-shadow(0 0 5px ${color}55)` }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
      />
      <span style={{
        fontFamily: PIXEL, fontSize: 11, color,
        fontVariantNumeric: "tabular-nums",
      }}>{value.toLocaleString("pt-BR")}</span>
    </div>
  )
}

// ─── Feixe de energia entre runas ─────────────────────────────────────────────
/**
 * Ligação entre dois nós da constelação. Trancado: trilha fantasma de poeira
 * estelar pontilhada, apenas sugerindo o caminho. Desbloqueado: feixe de neon
 * mágico pulsante — núcleo branco incandescente, corona colorida e partículas
 * de luz correndo pelo traçado.
 */
function Conduit({ x, y, len, ang, tint, lit, flowing, accent }: {
  x: number; y: number; len: number; ang: number
  tint: string; lit: boolean; flowing: boolean
  /** Cor do Mestre — usada só no trecho que sai do Núcleo. */
  accent?: string
}) {
  const from = accent ?? tint
  return (
    <div aria-hidden="true" style={{
      position: "absolute", left: x, top: y,
      width: len, height: 12, marginTop: -6, zIndex: 0,
      transform: `rotate(${ang}deg)`,
      transformOrigin: "0 50%",
    }}>
      {/* Trancado: trilha fantasma de poeira estelar */}
      {!lit && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: 5, height: 2, borderRadius: 1,
          background: "repeating-linear-gradient(90deg, rgba(150,170,215,0.4) 0 4px, transparent 4px 13px)",
          opacity: 0.45,
          filter: "blur(0.3px)",
        }}/>
      )}

      {/* Desbloqueado: feixe de neon pulsante */}
      {lit && (
        <>
          {/* Corona difusa: a luz vazando do feixe para o espaço */}
          <div style={{
            position: "absolute", inset: -5, borderRadius: 10,
            background: `linear-gradient(90deg, ${from}55 0%, ${tint}44 50%, ${tint}55 100%)`,
            filter: "blur(7px)",
            animation: "gpBeamPulse 2.4s ease-in-out infinite",
          }}/>
          {/* Halo médio colorido */}
          <div style={{
            position: "absolute", left: 0, right: 0, top: 3, height: 6, borderRadius: 3,
            background: `linear-gradient(90deg, ${from}88 0%, ${tint}99 55%, ${tint}88 100%)`,
            filter: "blur(2px)",
          }}/>
          {/* Núcleo branco incandescente do feixe */}
          <div style={{
            position: "absolute", left: 0, right: 0, top: 5, height: 2.5, borderRadius: 2,
            background: `linear-gradient(90deg, ${from} 0%, #ffffff 42%, ${tint} 100%)`,
            boxShadow: `0 0 10px ${tint}, 0 0 22px ${tint}77`,
            overflow: "hidden",
          }}>
            {/* Partículas de luz correndo pelo feixe */}
            <div style={{
              position: "absolute", inset: 0,
              background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.95) 0 7px, transparent 7px 24px)",
              animation: `gpRunePathFlow ${flowing ? "0.8s" : "2.2s"} linear infinite`,
              mixBlendMode: "screen",
              opacity: flowing ? 1 : 0.55,
            }}/>
          </div>
        </>
      )}
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
              style={{ width: 40, height: 40, objectFit: "contain", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }}
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
                background: `linear-gradient(90deg, ${color}12 0%, #14141b 60%)`,
                border: `1px solid ${color}33`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 7,
                padding: "9px 13px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                animation: `gpRiseIn 0.35s ease ${0.55 + i * 0.14}s both`,
              }}>
                <img
                  src={runeRewardIconPath(rw, chestId) || "/placeholder.svg"}
                  alt="" width={26} height={26}
                  style={{ width: 26, height: 26, objectFit: "contain", filter: `drop-shadow(0 0 6px ${color}44)` }}
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
  // O mapa rola verticalmente: o NÚCLEO fica no TOPO e cada ramo desce em sua
  // própria coluna com espaçamento constante e serpenteio suave — a direção
  // de progressão (topo → base) fica sempre clara e as runas nunca se amontoam.
  const RUNES_N = branches[0]?.runes.length ?? 10
  const W = tracksSize.w
  const H = tracksSize.h
  const ready = W > 0 && H > 0
  const NODE = ready ? Math.max(34, Math.min(54, Math.floor(W / 11))) : 44
  /** Folga sob o orbe para o rótulo do tier respirar. */
  const PED  = 18
  /** Distância vertical entre tiers — folga generosa para respirar. */
  const STEP = Math.max(96, Math.round(NODE * 2.05))
  /** Espaço no topo do mapa (abaixo dos estandartes fixos). */
  const topPad = 86
  /** Núcleo da árvore, no topo central do mapa rolável. */
  const rootSize = Math.round(NODE * 1.45)
  /** Distância do centro do núcleo até o centro da 1ª runa. */
  const gap0 = Math.round(rootSize * 0.8 + NODE * 0.95)
  const rootY = topPad + Math.round(rootSize / 2) + 16
  const root = { x: W / 2, y: rootY }
  /** Centro vertical da runa de índice i (0 = tier I, logo abaixo do núcleo). */
  const yOf = (i: number) => rootY + gap0 + i * STEP
  /** Altura total do conteúdo rolável. */
  const contentH = yOf(RUNES_N - 1) + NODE + PED + 52
  /** Amplitude do serpenteio horizontal de cada pista. */
  const laneAmp = Math.min(NODE * 0.62, W * 0.05)

  // Ao abrir, começa no TOPO — a leitura da rota é sempre de cima para baixo:
  // núcleo → tier I → ... → tier X.
  useEffect(() => {
    if (!ready || !hydrated || didAutoScroll.current) return
    const el = scrollRef.current
    if (!el) return
    didAutoScroll.current = true
    el.scrollTop = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hydrated])

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "#070818",
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
        @keyframes gpBeamPulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @keyframes gpNebulaDrift {
          0%, 100% { transform: translate(-4%, -2%) scale(1); opacity: 0.7; }
          50%      { transform: translate(4%, 2%) scale(1.08); opacity: 1; }
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
        @keyframes gpAuroraDrift {
          0%, 100% { transform: translateX(-7%) skewY(-1.5deg); opacity: 0.55; }
          50%      { transform: translateX(7%) skewY(1.5deg); opacity: 1; }
        }
        @keyframes gpChevronFall {
          0%   { transform: translate(-50%, -10px); opacity: 0; }
          30%  { opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translate(-50%, 10px); opacity: 0; }
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
        .gp-rune-node:hover { filter: brightness(1.22) saturate(1.15); transform: translateY(-2px); }
        @keyframes gpCoreRingPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.05); }
        }
        .gp-rune-node:focus-visible { outline: 2px solid #f7f4ee; outline-offset: 6px; }
        .gp-rune-cta:active { transform: translateY(2px); box-shadow: 0 1px 0 #0b3f2d !important; }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gpRuneGlowPulse { from { opacity: 0.8 } to { opacity: 0.8 } }
          @keyframes gpRuneBlink     { from { opacity: 1 }   to { opacity: 1 } }
          @keyframes gpRunePathFlow  { from { background-position: 0 0 } to { background-position: 0 0 } }
          @keyframes gpBeamPulse     { from { opacity: 0.8 } to { opacity: 0.8 } }
          @keyframes gpNebulaDrift   { from { transform: none; opacity: 0.8 } to { transform: none; opacity: 0.8 } }
          @keyframes gpRuneFloat     { from { transform: none } to { transform: none } }
          @keyframes gpGlyphDrift    { from { opacity: 0.15; transform: none } to { opacity: 0.15; transform: none } }
          @keyframes gpAuraBreathe   { from { opacity: 0.7; transform: none } to { opacity: 0.7; transform: none } }
          @keyframes gpRingSpin      { from { transform: none } to { transform: none } }
          @keyframes gpRingSpinRev   { from { transform: none } to { transform: none } }
          @keyframes gpStarTwinkle   { from { opacity: 0.4 } to { opacity: 0.4 } }
          @keyframes gpAuroraDrift   { from { transform: none; opacity: 0.6 } to { transform: none; opacity: 0.6 } }
          @keyframes gpChevronFall   { from { transform: translate(-50%, 0); opacity: 0.7 } to { transform: translate(-50%, 0); opacity: 0.7 } }
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

      {/* Fundo: nebulosa mágica — constelação viva com profundidade e cor */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Espaço profundo: violeta e azul-petróleo se fundindo em camadas */}
        <div style={{
          position: "absolute", inset: 0,
          background: [
            `radial-gradient(ellipse 110% 70% at 50% -14%, ${master.accentColor}30 0%, #3b2a7a2e 30%, transparent 58%)`,
            `radial-gradient(ellipse 76% 60% at 8% 108%, #1a2f6ecc 0%, #14235200 60%)`,
            `radial-gradient(ellipse 66% 52% at 94% 96%, #3a1d6899 0%, transparent 62%)`,
            "linear-gradient(180deg, #0a0a24 0%, #070818 46%, #0a0c26 100%)",
          ].join(", "),
        }}/>

        {/* Nuvens de nebulosa derivando — massas de gás colorido com movimento implícito */}
        <div style={{
          position: "absolute", left: "-10%", top: "-6%", width: "70%", height: "56%",
          background: `radial-gradient(ellipse at 46% 44%, ${master.accentColor}2e 0%, #6d4dd426 38%, transparent 68%)`,
          filter: "blur(46px)",
          animation: "gpNebulaDrift 26s ease-in-out infinite",
        }}/>
        <div style={{
          position: "absolute", right: "-14%", top: "22%", width: "64%", height: "58%",
          background: "radial-gradient(ellipse at 52% 50%, #2f7dff2a 0%, #1c9ec422 40%, transparent 70%)",
          filter: "blur(52px)",
          animation: "gpNebulaDrift 34s ease-in-out 6s infinite reverse",
        }}/>
        <div style={{
          position: "absolute", left: "8%", bottom: "-12%", width: "72%", height: "48%",
          background: "radial-gradient(ellipse at 50% 56%, #b04dd422 0%, #4d5dd41e 42%, transparent 70%)",
          filter: "blur(56px)",
          animation: "gpNebulaDrift 30s ease-in-out 12s infinite",
        }}/>

        {/* Auroras etéreas varrendo a nebulosa */}
        <div style={{
          position: "absolute", inset: "-12% -25%",
          background: "linear-gradient(112deg, transparent 24%, #6d5aff21 38%, #8fb4ff2e 50%, #6d5aff21 62%, transparent 76%)",
          filter: "blur(28px)",
          animation: "gpAuroraDrift 17s ease-in-out infinite",
        }}/>
        <div style={{
          position: "absolute", inset: "-12% -25%",
          background: "linear-gradient(248deg, transparent 30%, #3c56d41c 44%, #7d95ff26 54%, #3c56d41c 64%, transparent 78%)",
          filter: "blur(36px)",
          animation: "gpAuroraDrift 23s ease-in-out 4s infinite reverse",
        }}/>

        {/* Campo de estrelas denso — camada distante (pontos finos) */}
        {Array.from({ length: 46 }, (_, i) => {
          const sz = 1 + Math.round(frand(i * 3.7) * 1.4)
          return (
            <span key={`star-${i}`} style={{
              position: "absolute",
              left: `${frand(i * 1.3 + 5) * 98}%`,
              top: `${frand(i * 2.9 + 11) * 96}%`,
              width: sz, height: sz, borderRadius: "50%",
              background: i % 5 === 0 ? "#9db4ff" : i % 3 === 0 ? "#c9b8ff" : "#e8eeff",
              boxShadow: i % 5 === 0 ? "0 0 8px #7d9dff" : "0 0 4px rgba(200,214,255,0.7)",
              // @ts-expect-error — custom property
              "--star-op": 0.25 + frand(i * 7.1) * 0.55,
              animation: `gpStarTwinkle ${2.4 + frand(i * 4.3) * 3.6}s ease-in-out ${frand(i * 9.7) * 4}s infinite`,
            }}/>
          )
        })}

        {/* Estrelas maiores com clarão em cruz — os faróis da constelação */}
        {Array.from({ length: 7 }, (_, i) => {
          const x = frand(i * 5.9 + 3) * 92 + 3
          const y = frand(i * 8.3 + 17) * 88 + 4
          const s = 10 + Math.round(frand(i * 2.7) * 12)
          return (
            <span key={`flare-${i}`} style={{
              position: "absolute",
              left: `${x}%`, top: `${y}%`,
              width: s, height: s,
              transform: "translate(-50%, -50%)",
              background: "#ffffff",
              clipPath: "polygon(50% 0, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0 50%, 42% 42%)",
              filter: `drop-shadow(0 0 ${Math.round(s * 0.7)}px ${i % 2 === 0 ? master.accentColor : "#8fb4ff"})`,
              // @ts-expect-error — custom property
              "--star-op": 0.5 + frand(i * 6.1) * 0.4,
              animation: `gpStarTwinkle ${3 + frand(i * 5.3) * 3}s ease-in-out ${frand(i * 7.9) * 3}s infinite`,
            }}/>
          )
        })}

        {/* Círculo de invocação gigante emanando do núcleo da árvore (topo) */}
        <div style={{
          position: "absolute", left: "50%", top: "26%",
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

        {/* Névoa azul subindo do horizonte inferior */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 90% 55% at 50% 100%, #2b6ce028 0%, transparent 60%)",
        }}/>
        {/* Feixes de luz azulados descendo do topo — a bênção do núcleo */}
        <div style={{
          position: "absolute", left: "50%", top: "-30vmax",
          width: "170vmax", height: "170vmax",
          transform: "translateX(-50%)",
          background: "repeating-conic-gradient(from 150deg at 50% 0%, #5f9dff14 0deg 7deg, transparent 7deg 22deg)",
          maskImage: "radial-gradient(ellipse 60% 46% at 50% 0%, black 0%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 46% at 50% 0%, black 0%, transparent 72%)",
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
          background: "rgba(14,16,34,0.8)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 12,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
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
        padding: "8px 16px",
        borderBottom: `1px solid ${master.accentColor}40`,
        background: `linear-gradient(180deg, rgba(12,14,32,0.72) 0%, rgba(10,12,28,0.5) 100%)`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 -1px 0 ${master.accentColor}22`,
        position: "relative", zIndex: 5, flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label="Voltar" style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: 10,
          width: 34, height: 34, cursor: "pointer", color: "#c3cadb",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
        }}><ArrowLeft size={16}/></button>

        <div style={{
          width: 36, height: 36, overflow: "hidden", flexShrink: 0,
          border: `2px solid ${master.accentColor}`,
          borderRadius: 9,
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
            display: "flex", gap: 2, padding: 3, flex: 1, minWidth: 90,
            background: "rgba(8,10,24,0.6)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: progress.done > 0 ? `0 0 12px ${master.accentColor}33, inset 0 1px 0 rgba(255,255,255,0.06)` : "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>
            {Array.from({ length: 10 }, (_, i) => {
              const filled = progress.pct >= (i + 1) * 10 - 0.01
              return (
                <div key={i} style={{
                  flex: 1, height: 7, borderRadius: 999,
                  background: filled
                    ? `linear-gradient(180deg, #ffffff 0%, ${master.accentColor} 60%)`
                    : "rgba(255,255,255,0.06)",
                  boxShadow: filled ? `0 0 7px ${master.accentColor}aa` : "none",
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
            background: "linear-gradient(180deg, rgba(7,8,24,0.9) 0%, rgba(7,8,24,0.5) 55%, transparent 100%)",
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
                    background: `linear-gradient(135deg, ${tint}20 0%, rgba(12,14,32,0.5) 65%)`,
                    border: `1px solid ${tint}55`,
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    borderRadius: 999,
                    padding: "4px 11px 4px 5px",
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.4), 0 0 18px ${tint}22`,
                  }}>
                    <div style={{
                      width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `radial-gradient(circle at 34% 28%, ${tint}55 0%, rgba(10,12,26,0.8) 70%)`,
                      border: `1px solid ${tint}aa`,
                      borderRadius: "50%",
                      boxShadow: `0 0 10px ${tint}66`, flexShrink: 0,
                    }}>
                      <BranchIcon size={11} color={tint}/>
                    </div>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 9.5, color: "#f3f0ea",
                      textShadow: `0 0 10px ${tint}88`, whiteSpace: "nowrap",
                    }}>{branch.name.toUpperCase()}</span>
                    <span style={{
                      fontFamily: PIXEL, fontSize: 8.5,
                      color: branchComplete ? "#4ecf9d" : tint,
                      fontVariantNumeric: "tabular-nums",
                      display: "inline-flex", alignItems: "center", gap: 3,
                      background: "rgba(6,8,18,0.6)",
                      border: `1px solid ${branchComplete ? "#1d7d5c" : `${tint}55`}`,
                      borderRadius: 999,
                      padding: "0px 7px",
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

          // Posições em pista: cada runa desce em coluna com serpenteio suave e
          // espaçamento constante — a direção (topo → base) fica sempre clara.
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
              {/* Raiz: conduíte de metal do núcleo até a 1ª runa do ramo */}
              {(() => {
                const dx  = pts[0].x - root.x
                const dy  = pts[0].y - root.y
                const len = Math.max(4, Math.sqrt(dx * dx + dy * dy))
                const ang = (Math.atan2(dy, dx) * 180) / Math.PI
                const lit = firstStatus === "unlocked"
                const nxt = firstStatus === "available"
                return (
                  <Conduit
                    x={root.x} y={root.y} len={len} ang={ang}
                    tint={tint} lit={lit} flowing={nxt}
                    accent={master.accentColor}
                  />
                )
              })()}
              {/* Feixe de energia da pista: coluna de luz descendo do núcleo ao ápice */}
              <div aria-hidden="true" style={{
                position: "absolute",
                left: laneX - NODE * 1.15,
                top: root.y - NODE * 0.5,
                width: NODE * 2.3,
                height: pts[RUNES_N - 1].y - root.y + NODE * 1.6,
                background: `linear-gradient(180deg, ${tint}1c 0%, ${tint}09 55%, ${tint}14 100%)`,
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
                const midX = (a.x + b.x) / 2
                const midY = (a.y + b.y) / 2
                return (
                  <Fragment key={`path-${rune.id}`}>
                  <Conduit
                    x={a.x} y={a.y} len={len} ang={ang}
                    tint={tint} lit={lit} flowing={lit && next}
                  />
                  {/* Faísca de luz descendo no meio do trecho — direção topo → base */}
                  <span aria-hidden="true" style={{
                    position: "absolute",
                    left: midX, top: midY - 8, zIndex: 2,
                    transform: "translateX(-50%)",
                    width: 10, height: 12,
                    clipPath: "polygon(50% 100%, 0 30%, 50% 46%, 100% 30%)",
                    background: lit
                      ? `linear-gradient(180deg, #ffffff 0%, ${tint} 100%)`
                      : "linear-gradient(180deg, rgba(150,170,215,0.5) 0%, rgba(110,130,180,0.3) 100%)",
                    filter: lit ? `drop-shadow(0 0 8px ${tint})` : "none",
                    opacity: lit ? 1 : 0.45,
                    animation: `gpChevronFall 1.6s ease-in-out ${i * 0.12}s infinite`,
                  }}/>
                  </Fragment>
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
                      maxed={isApex && isDone}
                      label={`${rune.name} — ${isDone ? "gravada" : isAvailable ? "disponível" : "bloqueada"}`}
                      onClick={() => setSelectedId(rune.id)}
                    >
                      <img
                        src={runeRewardIconPath(rune.rewards[0], chestId) || "/placeholder.svg"}
                        alt="" width={iconSize} height={iconSize}
                        style={{
                          width: iconSize, height: iconSize, objectFit: "contain",
                          filter: isLocked ? "grayscale(1) brightness(0.8)" : "drop-shadow(0 2px 3px rgba(0,0,0,0.55))",
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
                        borderRadius: "50%",
                        background: isDone
                          ? "radial-gradient(circle at 34% 28%, #35e0a8 0%, #14805e 70%)"
                          : "rgba(16,18,32,0.85)",
                        border: isDone ? "1px solid #7dffd4" : "1px solid rgba(130,145,180,0.4)",
                        boxShadow: isDone ? "0 0 10px #4ecf9d88" : "0 2px 6px rgba(0,0,0,0.5)",
                      }}>
                        {isDone
                          ? <Check size={Math.round(sealSize * 0.55)} strokeWidth={3} color="#d8fff0"/>
                          : <Lock size={Math.round(sealSize * 0.5)} color="#6d7482"/>}
                      </div>
                    )}

                    {/* Tier em algarismo romano sob o orbe */}
                    <div style={{
                      position: "absolute", top: nSize + 5, left: "50%", transform: "translateX(-50%)",
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
            {/* Coroa de raios divinos girando atrás do núcleo */}
            <div style={{
              position: "absolute",
              left: -rootSize * 1.5, top: -rootSize * 1.5,
              width: rootSize * 3, height: rootSize * 3,
              borderRadius: "50%",
              background: `repeating-conic-gradient(from 0deg, ${master.accentColor}2e 0deg 10deg, transparent 10deg 26deg)`,
              maskImage: "radial-gradient(circle, black 0%, transparent 66%)",
              WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 66%)",
              animation: "gpRingSpin 34s linear infinite",
            }}/>
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
            {/* Anel rúnico de glifos girando ao redor do Núcleo */}
            <div style={{
              position: "absolute",
              left: -rootSize * 1.02, top: -rootSize * 1.02,
              width: rootSize * 2.04, height: rootSize * 2.04,
              animation: "gpRingSpin 46s linear infinite",
            }}>
              {GLYPHS.map((g, i) => {
                const a = (i / GLYPHS.length) * Math.PI * 2
                return (
                  <span key={`core-glyph-${i}`} style={{
                    position: "absolute",
                    left: `${50 + 48 * Math.cos(a)}%`,
                    top: `${50 + 48 * Math.sin(a)}%`,
                    transform: "translate(-50%, -50%)",
                    fontFamily: MONO, fontSize: Math.max(10, rootSize * 0.19),
                    color: master.accentColor,
                    textShadow: `0 0 10px ${master.accentColor}, 0 1px 0 rgba(0,0,0,0.8)`,
                    animation: `gpCoreRingPulse ${2.8 + (i % 3) * 0.6}s ease-in-out ${i * 0.18}s infinite`,
                  }}>{g}</span>
                )
              })}
            </div>
            {/* Aro de metal rúnico cercando o retrato do Mestre */}
            <div style={{
              position: "absolute",
              left: -rootSize * 0.58, top: -rootSize * 0.58,
              width: rootSize * 1.16, height: rootSize * 1.16,
              borderRadius: "50%",
              background: `conic-gradient(from 210deg, #f6e2ad 0deg, #c69a4e 70deg, #6d4a1f 150deg, #f6e2ad 220deg, #6d4a1f 300deg, #c69a4e 360deg)`,
              maskImage: "radial-gradient(circle, transparent 0%, transparent 82%, black 84%, black 100%)",
              WebkitMaskImage: "radial-gradient(circle, transparent 0%, transparent 82%, black 84%, black 100%)",
              filter: `drop-shadow(0 0 12px ${master.accentColor}88)`,
              animation: "gpRingSpin 60s linear infinite",
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
            {/* Rótulo do núcleo — acima do orbe, pois os ramos agora descem */}
            <div style={{
              position: "absolute",
              left: "50%", top: -(rootSize / 2) - Math.max(14, NODE * 0.34),
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
        const badgeBg    = done ? "rgba(29,125,92,0.8)" : avail ? `${tint}cc` : "rgba(40,44,64,0.75)"
        const badgeFg    = done ? "#d8fff0" : avail ? "#0a0c1c" : "#9aa1ad"
        const selBranch  = branches.find(b => b.id === selected.branchId)
        const branchName = selBranch?.name ?? ""
        const branchSize = selBranch?.runes.length ?? 10

        return (
          <div style={{
            position: "relative", zIndex: 6, flexShrink: 0,
            padding: "12px 14px 12px",
            background: "linear-gradient(0deg, rgba(7,8,24,0.92) 62%, rgba(7,8,24,0))",
          }}>
            <div style={{
              position: "relative", maxWidth: 980, margin: "0 auto",
              // Painel de vidro fosco: translúcido, com a nebulosa vazando por trás
              background: `linear-gradient(160deg, ${done || avail ? `${tint}1e` : "rgba(255,255,255,0.05)"} 0%, rgba(14,16,36,0.55) 42%, rgba(8,10,26,0.6) 100%)`,
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: `1px solid ${done || avail ? `${tint}55` : "rgba(140,155,195,0.28)"}`,
              boxShadow: [
                "0 12px 40px rgba(0,0,0,0.55)",
                "inset 0 1px 0 rgba(255,255,255,0.14)",
                avail ? `0 0 34px ${tint}30, inset 0 0 24px ${tint}12` : "",
              ].filter(Boolean).join(", "),
              borderRadius: 16,
              padding: "14px 16px 12px",
            }}>
              {/* Fio de luz correndo pela borda superior do vidro */}
              <div aria-hidden="true" style={{
                position: "absolute", top: 0, left: "8%", right: "8%", height: 1,
                background: `linear-gradient(90deg, transparent 0%, ${done || avail ? tint : "#8fa4d4"} 50%, transparent 100%)`,
                opacity: 0.8,
              }}/>
              {/* Badge de estado sobre a borda */}
              <div style={{
                position: "absolute", top: -12, left: 14,
                display: "inline-flex", alignItems: "center", gap: 6,
                background: badgeBg, color: badgeFg,
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "3px 12px",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                fontFamily: PIXEL, fontSize: 10, letterSpacing: "0.06em",
                boxShadow: `0 4px 12px rgba(0,0,0,0.45)${avail ? `, 0 0 16px ${tint}66` : ""}`,
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
                      style={{ width: 26, height: 26, objectFit: "contain", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
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
                          background: `linear-gradient(135deg, ${c}22 0%, rgba(14,16,34,0.55) 62%)`,
                          border: `1px solid ${c}55`,
                          borderRadius: 999,
                          padding: "4px 11px 4px 8px",
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.09), 0 0 14px ${c}22`,
                        }}>
                          <img
                            src={runeRewardIconPath(rw, chestId) || "/placeholder.svg"}
                            alt="" width={17} height={17}
                            style={{ width: 17, height: 17, objectFit: "contain", filter: `drop-shadow(0 0 5px ${c}66)` }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                          />
                          <span style={{
                            fontFamily: PIXEL, fontSize: 10.5, color: c,
                            letterSpacing: "0.02em",
                            textShadow: `0 0 10px ${c}66, 0 1px 0 rgba(0,0,0,0.8)`,
                          }}>{rw.label}</span>
                        </div>
                      )
                    })}

                    {!done && (
                      <>
                        {/* Fio de luz vertical separando ganho de custo */}
                        <span aria-hidden="true" style={{
                          width: 1, height: 20, flexShrink: 0, margin: "0 4px",
                          background: "linear-gradient(180deg, transparent 0%, rgba(150,170,215,0.5) 50%, transparent 100%)",
                        }}/>
                        <span style={{
                          fontFamily: PIXEL, fontSize: 8.5, color: "#6d7482",
                          letterSpacing: "0.1em", flexShrink: 0,
                        }}>CUSTO</span>
                        <div title="Gear Coins" style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "linear-gradient(135deg, rgba(242,193,78,0.12) 0%, rgba(14,16,34,0.55) 60%)",
                          border: "1px solid rgba(242,193,78,0.35)",
                          borderRadius: 999, padding: "4px 10px 4px 8px",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                        }}>
                          <img src="/images/gear-coin.png" alt="" width={16} height={16}
                            style={{ width: 16, height: 16, objectFit: "contain" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                          <span style={{
                            fontFamily: PIXEL, fontSize: 11.5, fontVariantNumeric: "tabular-nums",
                            color: gearCoins >= selected.cost.gearCoins ? "#f2c14e" : "#f87171",
                            textShadow: gearCoins >= selected.cost.gearCoins
                              ? "0 0 10px #f2c14e66, 0 1px 0 rgba(0,0,0,0.8)"
                              : "0 0 10px #f8717166",
                          }}>{selected.cost.gearCoins.toLocaleString("pt-BR")}</span>
                        </div>
                        {(Object.entries(selected.cost.fragments) as [FragmentId, number][]).map(([fid, amount]) => {
                          const have = fragments[fid] ?? 0
                          const ok   = have >= amount
                          return (
                            <div key={fid} title={FRAGMENTS[fid].name} style={{
                              display: "flex", alignItems: "center", gap: 6,
                              background: `linear-gradient(135deg, ${ok ? `${FRAGMENTS[fid].color}14` : "rgba(248,113,113,0.1)"} 0%, rgba(14,16,34,0.55) 60%)`,
                              border: `1px solid ${ok ? `${FRAGMENTS[fid].color}44` : "rgba(248,113,113,0.4)"}`,
                              borderRadius: 999, padding: "4px 10px 4px 8px",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
                            }}>
                              <img src={FRAGMENTS[fid].image || "/placeholder.svg"} alt="" width={16} height={16}
                                style={{ width: 16, height: 16, objectFit: "contain" }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
                              <span style={{
                                fontFamily: PIXEL, fontSize: 11.5, fontVariantNumeric: "tabular-nums",
                                color: ok ? FRAGMENTS[fid].color : "#f87171",
                                textShadow: `0 0 10px ${ok ? FRAGMENTS[fid].color : "#f87171"}55, 0 1px 0 rgba(0,0,0,0.8)`,
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
                          background: "linear-gradient(180deg, #5adfae 0%, #38b586 100%)",
                          border: "1px solid #0b3f2d",
                          borderRadius: 8,
                          padding: "8px 18px", cursor: "pointer", color: "#06281c",
                          fontFamily: PIXEL, fontSize: 10.5,
                          boxShadow: "0 3px 0 #0b3f2d, 0 0 18px rgba(70,194,149,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
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
