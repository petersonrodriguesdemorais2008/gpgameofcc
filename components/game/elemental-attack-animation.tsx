"use client"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export interface AttackAnimationProps {
  id: string
  startX: number
  startY: number
  targetX: number
  targetY: number
  element: string
  isDirect?: boolean
  attackerImage?: string
  attackerName?: string
  portalTarget?: HTMLElement | null
  onImpact?: (id: string, x: number, y: number, element: string) => void
  onComplete: (id: string) => void
}

// ── Timing (ms) — mantém sincronia com a lógica dos duelos ──────────────────
const T = {
  CHARGE: 320,
  RELEASE: 50,
  STRIKE: 260,
  IMPACT: 320,
  AFTERMATH: 900,
  HITSTOP: 90,
  get TOTAL() {
    return this.CHARGE + this.RELEASE + this.STRIKE + this.IMPACT + this.AFTERMATH
  },
}

// ── Paletas ──────────────────────────────────────────────────────────────────
type P = { a: string; b: string; c: string; w: string; gl: string; sc: string; rgb: string }
const PALS: Record<string, P> = {
  fire: { a: "#b91c1c", b: "#f97316", c: "#fbbf24", w: "#fff7ed", gl: "rgba(249,115,22,1)", sc: "rgba(239,68,68,.30)", rgb: "249,115,22" },
  pyrus: { a: "#b91c1c", b: "#f97316", c: "#fbbf24", w: "#fff7ed", gl: "rgba(249,115,22,1)", sc: "rgba(239,68,68,.30)", rgb: "249,115,22" },
  aquos: { a: "#075985", b: "#0ea5e9", c: "#38bdf8", w: "#f0f9ff", gl: "rgba(14,165,233,1)", sc: "rgba(14,165,233,.22)", rgb: "14,165,233" },
  aquo: { a: "#075985", b: "#0ea5e9", c: "#38bdf8", w: "#f0f9ff", gl: "rgba(14,165,233,1)", sc: "rgba(14,165,233,.22)", rgb: "14,165,233" },
  water: { a: "#075985", b: "#0ea5e9", c: "#38bdf8", w: "#f0f9ff", gl: "rgba(14,165,233,1)", sc: "rgba(14,165,233,.22)", rgb: "14,165,233" },
  haos: { a: "#854d0e", b: "#eab308", c: "#fde047", w: "#fefce8", gl: "rgba(234,179,8,1)", sc: "rgba(234,179,8,.28)", rgb: "234,179,8" },
  light: { a: "#854d0e", b: "#eab308", c: "#fde047", w: "#fefce8", gl: "rgba(234,179,8,1)", sc: "rgba(234,179,8,.28)", rgb: "234,179,8" },
  lightness: { a: "#854d0e", b: "#eab308", c: "#fde047", w: "#fefce8", gl: "rgba(234,179,8,1)", sc: "rgba(234,179,8,.28)", rgb: "234,179,8" },
  darkus: { a: "#2e1065", b: "#7c3aed", c: "#a78bfa", w: "#faf5ff", gl: "rgba(124,58,237,1)", sc: "rgba(88,28,135,.34)", rgb: "124,58,237" },
  darkness: { a: "#2e1065", b: "#7c3aed", c: "#a78bfa", w: "#faf5ff", gl: "rgba(124,58,237,1)", sc: "rgba(88,28,135,.34)", rgb: "124,58,237" },
  dark: { a: "#2e1065", b: "#7c3aed", c: "#a78bfa", w: "#faf5ff", gl: "rgba(124,58,237,1)", sc: "rgba(88,28,135,.34)", rgb: "124,58,237" },
  ventus: { a: "#064e3b", b: "#10b981", c: "#34d399", w: "#ecfdf5", gl: "rgba(16,185,129,1)", sc: "rgba(16,185,129,.22)", rgb: "16,185,129" },
  wind: { a: "#064e3b", b: "#10b981", c: "#34d399", w: "#ecfdf5", gl: "rgba(16,185,129,1)", sc: "rgba(16,185,129,.22)", rgb: "16,185,129" },
  void: { a: "#0f172a", b: "#475569", c: "#94a3b8", w: "#f8fafc", gl: "rgba(71,85,105,1)", sc: "rgba(0,0,0,.42)", rgb: "71,85,105" },
}
const pal = (e: string): P =>
  PALS[e] || { a: "#3730a3", b: "#6366f1", c: "#a5b4fc", w: "#eef2ff", gl: "rgba(99,102,241,1)", sc: "rgba(99,102,241,.2)", rgb: "99,102,241" }
export type ElementPalette = P
/** Reusable element palette lookup — also used by duel-screen.tsx for the targeting aim line */
export const getElementPalette = (e: string): P => pal((e || "neutral").toLowerCase().trim())
/** Normalizes any element string variant into one of: fire|aquos|darkness|haos|ventus|void */
export const normalizeElement = (e: string): string => {
  const x = (e || "").toLowerCase().trim()
  if (["pyrus", "fire"].includes(x)) return "fire"
  if (["aquos", "aquo", "water"].includes(x)) return "aquos"
  if (["darkus", "darkness", "dark"].includes(x)) return "darkness"
  if (["haos", "light", "lightness"].includes(x)) return "haos"
  if (["ventus", "wind"].includes(x)) return "ventus"
  if (x === "void") return "void"
  return "neutral"
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const eoExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
const eoCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const eiCubic = (x: number) => x * x * x
const eoBack = (x: number) => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}
const hex2rgb = (h: string): [number, number, number] => {
  const n = Number.parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mulberry = (seed: number) => {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Sprite de brilho pré-renderizado (blit rápido, sem gradiente por frame) ──
const spriteCache = new Map<string, HTMLCanvasElement>()
function glowSprite(r: number, g: number, b: number): HTMLCanvasElement {
  const key = `${r},${g},${b}`
  const hit = spriteCache.get(key)
  if (hit) return hit
  const cv = document.createElement("canvas")
  cv.width = cv.height = 64
  const cx = cv.getContext("2d")!
  const gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, `rgba(255,255,255,1)`)
  gr.addColorStop(0.22, `rgba(${r},${g},${b},.9)`)
  gr.addColorStop(0.55, `rgba(${r},${g},${b},.34)`)
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`)
  cx.fillStyle = gr
  cx.fillRect(0, 0, 64, 64)
  spriteCache.set(key, cv)
  return cv
}
function blit(ctx: CanvasRenderingContext2D, sp: HTMLCanvasElement, x: number, y: number, rad: number, a: number) {
  if (rad <= 0 || a <= 0) return
  ctx.globalAlpha = a
  ctx.drawImage(sp, x - rad, y - rad, rad * 2, rad * 2)
  ctx.globalAlpha = 1
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, w: number, color: string) {
  if (r <= 0 || w <= 0) return
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.lineWidth = w
  ctx.strokeStyle = color
  ctx.stroke()
}
/** Nota musical (colcheia) desenhada em canvas — usada na animação exclusiva da Morgana */
function musicNote(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number,
  alpha: number, color: string, double = false,
) {
  if (alpha <= 0 || size <= 0) return
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineCap = "round"
  const s = size
  if (double) {
    // duas cabeças + barra de ligação (semicolcheias unidas)
    ctx.lineWidth = s * 0.16
    for (const hx of [0, s * 0.85]) {
      ctx.beginPath()
      ctx.ellipse(hx, 0, s * 0.32, s * 0.22, -0.45, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(hx + s * 0.28, -s * 0.05)
      ctx.lineTo(hx + s * 0.28, -s * 1.1)
      ctx.stroke()
    }
    ctx.lineWidth = s * 0.26
    ctx.beginPath()
    ctx.moveTo(s * 0.28, -s * 1.1)
    ctx.lineTo(s * 1.13, -s * 1.1)
    ctx.stroke()
  } else {
    ctx.lineWidth = s * 0.16
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.34, s * 0.24, -0.45, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(s * 0.3, -s * 0.05)
    ctx.lineTo(s * 0.3, -s * 1.2)
    ctx.stroke()
    // bandeirola
    ctx.beginPath()
    ctx.moveTo(s * 0.3, -s * 1.2)
    ctx.quadraticCurveTo(s * 0.95, -s * 0.92, s * 0.58, -s * 0.45)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

/** Raio elétrico serrilhado entre dois pontos, com jitter determinístico por seed */
function bolt(
  ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number,
  segs: number, jag: number, seed: number, width: number, color: string,
) {
  const r = mulberry(seed)
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 2) return
  const nx = -dy / len, ny = dx / len
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  for (let i = 1; i < segs; i++) {
    const p = i / segs
    const off = (r() - 0.5) * 2 * jag * Math.sin(p * Math.PI)
    ctx.lineTo(x1 + dx * p + nx * off, y1 + dy * p + ny * off)
  }
  ctx.lineTo(x2, y2)
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.stroke()
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, n: number, R: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? R : r
    const a = rot + (i * Math.PI) / n
    const px = x + Math.cos(a) * rad
    const py = y + Math.sin(a) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

// ── Partículas ────────────────────────────────────────────────────────────────
type Kind = "glow" | "flame" | "shard" | "glitter" | "swirl" | "wisp" | "note"
interface Pt {
  x: number; y: number; vx: number; vy: number
  ax: number; ay: number; drag: number
  age: number; life: number; size: number
  r: number; g: number; b: number
  kind: Kind; seed: number; rot: number; spin: number
}

export function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY, element, attackerImage, attackerName,
  portalTarget, onImpact, onComplete,
}: AttackAnimationProps) {
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cbRef = useRef({ onImpact, onComplete })
  useEffect(() => { cbRef.current = { onImpact, onComplete } })
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return

    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    const resize = () => {
      cv.width = Math.round(window.innerWidth * dpr)
      cv.height = Math.round(window.innerHeight * dpr)
    }
    resize()
    window.addEventListener("resize", resize)

    const el = (element || "neutral").toLowerCase().trim()
    // ── FEHNON HOSKIE — animação exclusiva de corte de espada com água ──────
    const isFehnon = !!attackerName && attackerName.toLowerCase().includes("fehnon")
    // ── MORGANA PENDRAGON — animação exclusiva de rasgo elétrico roxo com notas musicais ──
    const isMorgana = !isFehnon && !!attackerName && attackerName.toLowerCase().includes("morgana")
    // ── CALEM HIDENORI — animação exclusiva de esfera do vazio cinza prateada ──
    const isCalem = !isFehnon && !isMorgana && !!attackerName && attackerName.toLowerCase().includes("calem")
    const E = isFehnon ? "aquos" : isMorgana ? "darkness" : isCalem ? "void" : normalizeElement(el)
    const P = isFehnon ? pal("aquos") : isMorgana ? pal("darkus") : isCalem ? pal("void") : pal(el)
    const [br, bg, bb] = hex2rgb(P.b)
    const [cr, cg, cb] = hex2rgb(P.c)
    const [ar, ag, ab] = hex2rgb(P.a)
    const spW = glowSprite(255, 255, 255)
    const spC = glowSprite(cr, cg, cb)
    const spB = glowSprite(br, bg, bb)
    const rnd = mulberry(Array.from(id).reduce((a, c) => a + c.charCodeAt(0) * 31, 7))
    const pMul = reduced ? 0.4 : 1

    const sx = startX, sy = startY, tx = targetX, ty = targetY
    const dist = Math.hypot(tx - sx, ty - sy)
    const ang = Math.atan2(ty - sy, tx - sx)
    const cosA = Math.cos(ang), sinA = Math.sin(ang)

    const C0 = T.CHARGE
    const C1 = C0 + T.RELEASE
    const C2 = C1 + T.STRIKE
    const C3 = C2 + T.IMPACT

    const pts: Pt[] = []
    const trail: { x: number; y: number }[] = []
    let impactFired = false
    let done = false
    let raf = 0
    const start = performance.now()
    let last = start

    const spawn = (n: number, fn: (i: number) => Partial<Pt>) => {
      const count = Math.round(n * pMul)
      for (let i = 0; i < count; i++) {
        const d = fn(i)
        pts.push({
          x: tx, y: ty, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0.985,
          age: 0, life: 600, size: 6, r: 255, g: 255, b: 255,
          kind: "glow", seed: rnd(), rot: rnd() * TAU, spin: 0, ...d,
        })
      }
    }

    // ── Deslocamento de trajetória por elemento (voo com personalidade) ──────
    const wave = (p: number): number => {
      switch (E) {
        case "fire": return Math.sin(p * Math.PI) * -36
        case "aquos": return Math.sin(p * Math.PI * 3) * 15 * (1 - p * 0.35)
        case "ventus": return Math.sin(p * Math.PI * 6) * 12
        case "darkness": return Math.sin(p * Math.PI * 9) * 5
        case "haos": return 0
        default: return Math.sin(p * 61) * 7 + Math.sin(p * 23) * 4
      }
    }
    const projAt = (p: number) => {
      const off = wave(p)
      return { x: sx + cosA * dist * p - sinA * off, y: sy + sinA * dist * p + cosA * off }
    }

    // ── Explosão de impacto por elemento ─────────────────────────────────────
    const burst = () => {
      if (isFehnon) {
        const sa = ang + Math.PI / 5
        // Explosão radial de gotas d'água com gravidade
        spawn(72, () => {
          const a = rnd() * TAU
          const sp = 150 + rnd() * 540
          const white = rnd() < 0.35
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 130, ay: 640,
            size: 3 + rnd() * 6, life: 480 + rnd() * 540,
            r: white ? 255 : 125, g: white ? 255 : 211, b: white ? 255 : 252,
            drag: 0.982, kind: "glow",
          }
        })
        // Lascas de água voando perpendiculares à linha do corte
        spawn(28, () => {
          const along = (rnd() - 0.5) * 2
          const side = rnd() < 0.5 ? -1 : 1
          const sp = 200 + rnd() * 400
          return {
            x: tx + Math.cos(sa) * along * 130, y: ty + Math.sin(sa) * along * 130,
            vx: -Math.sin(sa) * sp * side, vy: Math.cos(sa) * sp * side - 90,
            ay: 500, size: 2.5 + rnd() * 4, life: 520 + rnd() * 440,
            r: 186, g: 230, b: 253, drag: 0.985, kind: "glitter",
          }
        })
        // Névoa azul subindo (vapor do impacto)
        spawn(14, () => {
          const a = rnd() * TAU
          const sp = 40 + rnd() * 130
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 55, ay: -34,
            size: 12 + rnd() * 15, life: 820 + rnd() * 520,
            r: 56, g: 189, b: 248, drag: 0.97, kind: "wisp",
          }
        })
        // Cintilar branco duradouro
        spawn(10, (i) => {
          const a = (i / 10) * TAU
          const sp = 30 + rnd() * 70
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, ay: -14,
            size: 2 + rnd() * 2.5, life: 1000 + rnd() * 280,
            r: 255, g: 255, b: 255, drag: 0.995, kind: "glitter",
          }
        })
        return
      }
      if (isMorgana) {
        // Faíscas elétricas radiais violentas
        spawn(60, () => {
          const a = rnd() * TAU
          const sp = 180 + rnd() * 620
          const white = rnd() < 0.4
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            size: 2.5 + rnd() * 5.5, life: 340 + rnd() * 460,
            r: white ? 255 : 196, g: white ? 255 : 181, b: white ? 255 : 253,
            drag: 0.955, kind: "glow",
          }
        })
        // NOTAS MUSICAIS ROXAS explodindo do impacto (assinatura da Morgana)
        spawn(13, (i) => {
          const a = (i / 13) * TAU + rnd() * 0.5
          const sp = 130 + rnd() * 300
          const bright = rnd() < 0.45
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, ay: 200,
            size: 11 + rnd() * 10, life: 800 + rnd() * 500,
            r: bright ? 216 : 168, g: bright ? 180 : 85, b: 255,
            drag: 0.97, kind: "note",
            rot: (rnd() - 0.5) * 0.9, spin: (rnd() - 0.5) * 4,
          }
        })
        // Fragmentos elétricos serrilhados (estilhaços de energia)
        spawn(20, () => {
          const a = rnd() * TAU
          const sp = 220 + rnd() * 380
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            size: 2 + rnd() * 3.5, life: 500 + rnd() * 420,
            r: 233, g: 213, b: 255, drag: 0.98, kind: "glitter",
          }
        })
        // Fumaça sombria roxa se expandindo
        spawn(14, () => {
          const a = rnd() * TAU
          const sp = 60 + rnd() * 160
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, ay: -30,
            size: 11 + rnd() * 14, life: 760 + rnd() * 520,
            r: 88, g: 28, b: 135, drag: 0.96, kind: "wisp",
          }
        })
        // Cintilar branco/lavanda duradouro
        spawn(10, (i) => {
          const a = (i / 10) * TAU
          const sp = 30 + rnd() * 70
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 55, ay: -16,
            size: 2 + rnd() * 2.5, life: 1000 + rnd() * 300,
            r: 255, g: 255, b: 255, drag: 0.995, kind: "glitter",
          }
        })
        return
      }
      if (isCalem) {
        // Estilhaços prateados radiais violentos
        spawn(66, () => {
          const a = rnd() * TAU
          const sp = 200 + rnd() * 640
          const white = rnd() < 0.45
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            size: 2.5 + rnd() * 5.5, life: 360 + rnd() * 480,
            r: white ? 255 : 203, g: white ? 255 : 213, b: white ? 255 : 225,
            drag: 0.955, kind: "glow",
          }
        })
        // Cacos metálicos da esfera girando
        spawn(22, () => {
          const a = rnd() * TAU
          const sp = 240 + rnd() * 420
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            size: 4 + rnd() * 6, life: 460 + rnd() * 420,
            r: 226, g: 232, b: 240, drag: 0.96, kind: "shard", spin: (rnd() - 0.5) * 16,
          }
        })
        // Fumaça do vazio — névoa escura se expandindo
        spawn(16, () => {
          const a = rnd() * TAU
          const sp = 60 + rnd() * 170
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: -24,
            size: 12 + rnd() * 15, life: 780 + rnd() * 540,
            r: 30, g: 41, b: 59, drag: 0.96, kind: "wisp",
          }
        })
        // Poeira que é sugada de volta ao centro (sucção residual do vazio)
        spawn(18, () => {
          const a = rnd() * TAU
          const sp = 320 + rnd() * 260
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            ax: -Math.cos(a) * 900, ay: -Math.sin(a) * 900,
            size: 2 + rnd() * 3, life: 520 + rnd() * 300,
            r: 148, g: 163, b: 184, drag: 0.97, kind: "glitter",
          }
        })
        // Cintilar branco duradouro
        spawn(10, (i) => {
          const a = (i / 10) * TAU
          const sp = 30 + rnd() * 70
          return {
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, ay: -14,
            size: 2 + rnd() * 2.5, life: 1000 + rnd() * 300,
            r: 255, g: 255, b: 255, drag: 0.995, kind: "glitter",
          }
        })
        return
      }
      const speak = E === "haos" ? 620 : 540
      // Faíscas radiais principais
      spawn(E === "fire" ? 64 : 54, () => {
        const a = rnd() * TAU
        const sp = 90 + rnd() * speak
        const white = rnd() < 0.4
        return {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          size: 3 + rnd() * 7, life: 380 + rnd() * 520,
          r: white ? 255 : cr, g: white ? 255 : cg, b: white ? 255 : cb,
          drag: 0.965, kind: "glow",
        }
      })
      switch (E) {
        case "fire":
          spawn(18, () => {
            const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4
            const sp = 120 + rnd() * 260
            return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: -140, size: 8 + rnd() * 10, life: 500 + rnd() * 420, r: 251, g: 146, b: 60, drag: 0.97, kind: "flame" }
          })
          spawn(14, () => {
            const a = rnd() * TAU
            const sp = 60 + rnd() * 200
            return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, ay: 220, size: 2.5 + rnd() * 3, life: 700 + rnd() * 500, r: 253, g: 224, b: 71, drag: 0.99, kind: "glitter" }
          })
          break
        case "aquos":
          spawn(30, () => {
            const a = rnd() * TAU
            const sp = 130 + rnd() * 330
            return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90, ay: 560, size: 3 + rnd() * 5, life: 520 + rnd() * 380, r: 125, g: 211, b: 252, drag: 0.985, kind: "glow" }
          })
          break
        case "darkness":
          spawn(26, () => {
            const a = rnd() * TAU
            const sp = 160 + rnd() * 300
            return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 5 + rnd() * 8, life: 420 + rnd() * 380, r: 88, g: 28, b: 135, drag: 0.94, kind: "wisp" }
          })
          spawn(16, () => {
            const a = rnd() * TAU
            const sp = 80 + rnd() * 180
            return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 2.5 + rnd() * 3.5, life: 600 + rnd() * 400, r: 196, g: 181, b: 253, drag: 0.975, kind: "glitter" }
          })
          break
        case "haos":
          spawn(30, () => {
            const a = rnd() * TAU
            const sp = 60 + rnd() * 260
            return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, ay: 30, size: 2.5 + rnd() * 4, life: 750 + rnd() * 550, r: 254, g: 240, b: 138, drag: 0.988, kind: "glitter" }
          })
          break
        case "ventus":
          spawn(30, () => {
            const a = rnd() * TAU
            const sp = 140 + rnd() * 280
            return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: -90, size: 3 + rnd() * 5, life: 520 + rnd() * 420, r: 110, g: 231, b: 183, drag: 0.975, kind: "swirl", spin: 2.6 + rnd() * 2 }
          })
          break
        default:
          spawn(26, () => {
            const a = rnd() * TAU
            const sp = 120 + rnd() * 280
            return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 3 + rnd() * 6, life: 420 + rnd() * 320, r: 148, g: 163, b: 184, drag: 0.95, kind: "shard", spin: (rnd() - 0.5) * 14 }
          })
      }
      // Cintilar duradouro (glimmer de vitória)
      spawn(9, (i) => {
        const a = (i / 9) * TAU
        const sp = 26 + rnd() * 60
        return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 46, ay: -14, size: 2 + rnd() * 2.5, life: 950 + rnd() * 260, r: 255, g: 255, b: 255, drag: 0.995, kind: "glitter" }
      })
    }

    // ── Imagem residual do atacante ──────────────────────────────────────────
    let atkImg: HTMLImageElement | null = null
    if (attackerImage) {
      atkImg = new Image()
      atkImg.crossOrigin = "anonymous"
      atkImg.src = attackerImage
    }

    // ═════════════════════════ DESENHO POR FASE ═════════════════════════════

    const drawCharge = (k: number, now: number) => {
      const t = now * 0.001
      const grow = eoCubic(k)
      // aura ambiente + vinheta
      const amb = ctx.createRadialGradient(sx, sy, 0, sx, sy, 300)
      amb.addColorStop(0, `rgba(${P.rgb},${0.26 * k})`)
      amb.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = amb
      ctx.fillRect(sx - 300, sy - 300, 600, 600)

      ctx.globalCompositeOperation = "lighter"
      // faíscas convergindo (sucção de energia)
      for (let i = 0; i < 12; i++) {
        const frac = 1 - ((t * 1.7 + i * 0.618) % 1)
        const a = i * (TAU / 12) + t * 2.2
        const r = frac * 105
        blit(ctx, i % 2 ? spC : spW, sx + Math.cos(a) * r, sy + Math.sin(a) * r, 5 + (1 - frac) * 7, (1 - frac) * 0.9 * k)
      }
      // anéis colapsando
      for (let i = 0; i < 3; i++) {
        const fr = 1 - ((t * 1.4 + i / 3) % 1)
        ring(ctx, sx, sy, fr * 118, 2, `rgba(${P.rgb},${(1 - fr) * 0.7 * k})`)
      }
      // núcleo
      const pulse = 1 + Math.sin(t * 26) * 0.12
      blit(ctx, spB, sx, sy, (30 + 34 * grow) * pulse, 0.95)
      blit(ctx, spW, sx, sy, (14 + 18 * grow) * pulse, 1)

      switch (E) {
        case "fire":
          for (let i = 0; i < 8; i++) {
            const a = i * (TAU / 8) + Math.sin(t * 9 + i) * 0.25
            const L = (34 + Math.sin(t * 21 + i * 2.4) * 14) * grow
            ctx.save()
            ctx.translate(sx, sy)
            ctx.rotate(a)
            ctx.scale(1, 2.1)
            blit(ctx, spC, 0, -L / 2, 9, 0.75)
            ctx.restore()
          }
          for (let i = 0; i < 6; i++) {
            const a2 = t * (3 + i * 0.4) + i
            blit(ctx, spW, sx + Math.cos(a2) * 34 * grow, sy + Math.sin(a2 * 1.7) * 30 * grow, 3.5, 0.85)
          }
          break
        case "aquos":
          for (let i = 0; i < 3; i++) {
            const rot = t * (5 + i) * (i % 2 ? -1 : 1)
            const rr = (58 - i * 12) * grow
            for (let s = 0; s < 4; s++) {
              ctx.beginPath()
              ctx.arc(sx, sy, rr, rot + s * (TAU / 4), rot + s * (TAU / 4) + 0.9)
              ctx.lineWidth = 3.5 - i
              ctx.strokeStyle = `rgba(${i % 2 ? P.rgb : "125,211,252"},${0.8 - i * 0.18})`
              ctx.stroke()
            }
          }
          for (let i = 0; i < 7; i++) {
            const fr = 1 - ((t * 1.5 + i / 7) % 1)
            const a = t * 8 + i * 2.4
            blit(ctx, spW, sx + Math.cos(a) * fr * 56, sy + Math.sin(a) * fr * 56, 3.5, (1 - fr) * 0.9)
          }
          break
        case "darkness": {
          ctx.globalCompositeOperation = "source-over"
          const cr2 = 16 * grow * (1 + Math.sin(t * 18) * 0.1)
          ctx.beginPath(); ctx.arc(sx, sy, cr2, 0, TAU)
          ctx.fillStyle = "#09000f"; ctx.fill()
          ctx.globalCompositeOperation = "lighter"
          ring(ctx, sx, sy, cr2 + 4, 3, `rgba(124,58,237,.95)`)
          for (let i = 0; i < 12; i++) {
            const a = i * (TAU / 12) + t * 3
            const L = (30 + Math.sin(t * 16 + i * 3) * 20) * grow
            ctx.beginPath()
            ctx.moveTo(sx + Math.cos(a) * (cr2 + 6), sy + Math.sin(a) * (cr2 + 6))
            ctx.lineTo(sx + Math.cos(a) * (cr2 + 6 + L), sy + Math.sin(a) * (cr2 + 6 + L))
            ctx.lineWidth = 2
            ctx.strokeStyle = `rgba(167,139,250,${0.35 + Math.sin(t * 16 + i * 3) * 0.3})`
            ctx.stroke()
          }
          break
        }
        case "haos": {
          // pilar de luz ascendente
          const ph = 96 * grow
          const gr = ctx.createLinearGradient(sx, sy, sx, sy - ph)
          gr.addColorStop(0, "rgba(255,255,255,.95)")
          gr.addColorStop(0.5, "rgba(254,240,138,.55)")
          gr.addColorStop(1, "rgba(253,224,71,0)")
          ctx.fillStyle = gr
          ctx.fillRect(sx - 9, sy - ph, 18, ph)
          // halo rotativo (elipse)
          ctx.save()
          ctx.translate(sx, sy)
          ctx.scale(1, 0.32)
          ring(ctx, 0, 0, 62 * grow, 4, `rgba(253,224,71,${0.85})`)
          ring(ctx, 0, 0, (46 + Math.sin(t * 6) * 6) * grow, 2, "rgba(255,255,255,.7)")
          ctx.restore()
          for (let i = 0; i < 10; i++) {
            const a = i * (TAU / 10) + t * 1.5
            const L = (i % 2 ? 26 : 44) * grow * (1 + Math.sin(t * 18 + i) * 0.3)
            ctx.beginPath()
            ctx.moveTo(sx, sy)
            ctx.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L)
            ctx.lineWidth = 2
            ctx.strokeStyle = `rgba(254,249,195,${0.75})`
            ctx.stroke()
          }
          break
        }
        case "ventus":
          for (let i = 0; i < 5; i++) {
            const w = (26 + i * 15) * grow
            const hy = sy - 52 * grow + i * 20 * grow
            ctx.save()
            ctx.translate(sx, hy)
            ctx.scale(1, 0.3)
            ctx.setLineDash([10, 8])
            ctx.lineDashOffset = t * 140 * (i % 2 ? -1 : 1)
            ring(ctx, 0, 0, w, 2.6 - i * 0.3, `rgba(${i % 2 ? "52,211,153" : "110,231,183"},${0.9 - i * 0.1})`)
            ctx.setLineDash([])
            ctx.restore()
          }
          for (let i = 0; i < 6; i++) {
            const fr = (t * 1.4 + i / 6) % 1
            const a = t * 9 + i * 2
            const rr = (14 + fr * 34) * grow
            blit(ctx, spC, sx + Math.cos(a) * rr, sy + 40 * grow - fr * 92 * grow, 3.5, (1 - fr) * 0.9)
          }
          break
        default: {
          // void/neutral — realidade glitch
          ctx.save()
          ctx.translate(sx, sy)
          ctx.rotate(t * 3.2)
          ctx.strokeStyle = "rgba(148,163,184,.75)"
          ctx.lineWidth = 2
          ctx.strokeRect(-34 * grow, -34 * grow, 68 * grow, 68 * grow)
          ctx.rotate(-t * 5.6)
          ctx.strokeStyle = "rgba(203,213,225,.5)"
          ctx.strokeRect(-24 * grow, -24 * grow, 48 * grow, 48 * grow)
          ctx.restore()
          for (let i = 0; i < 8; i++) {
            const on = Math.sin(t * 30 + i * 7) > 0
            if (!on) continue
            const gx = ((i % 3) - 1) * 28 * grow
            const gy = (Math.floor(i / 3) - 1) * 28 * grow
            ctx.fillStyle = "rgba(148,163,184,.85)"
            ctx.fillRect(sx + gx - 3, sy + gy - 3, 6, 6)
          }
        }
      }
      ctx.globalCompositeOperation = "source-over"

      // imagem residual do atacante
      if (atkImg && atkImg.complete && atkImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.4 * (1 - k)
        ctx.drawImage(atkImg, sx - 42, sy - 58, 84, 116)
        ctx.globalAlpha = 1
      }
    }

    const drawRelease = (k: number) => {
      ctx.globalCompositeOperation = "lighter"
      const r = eoExpo(k) * 110
      blit(ctx, spW, sx, sy, r, 1 - k * 0.5)
      blit(ctx, spB, sx, sy, r * 1.5, (1 - k) * 0.8)
      ring(ctx, sx, sy, r * 1.2, 3, `rgba(255,255,255,${(1 - k) * 0.9})`)
      ctx.globalCompositeOperation = "source-over"
    }

    const drawStrike = (k: number, now: number) => {
      const t = now * 0.001
      const p = eiCubic(k) * 0.35 + k * 0.65 // acelera mas garante chegada
      const pos = projAt(p)
      trail.push({ x: pos.x, y: pos.y })
      if (trail.length > 26) trail.shift()

      ctx.globalCompositeOperation = "lighter"

      // linhas de velocidade pelo campo
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(ang)
      for (let i = 0; i < 10; i++) {
        const off = (i - 4.5) * 30
        const len = 120 + ((i * 53) % 140)
        const xw = p * (dist + 500) - len - ((i * 97) % 260)
        ctx.strokeStyle = `rgba(${P.rgb},${0.16 - Math.abs(i - 4.5) * 0.02})`
        ctx.lineWidth = Math.abs(i - 4.5) < 1.5 ? 3 : 1.5
        ctx.beginPath()
        ctx.moveTo(xw, off)
        ctx.lineTo(xw + len, off)
        ctx.stroke()
      }
      ctx.restore()

      // feixe Haos: laser contínuo da origem
      if (E === "haos") {
        const gr = ctx.createLinearGradient(sx, sy, pos.x, pos.y)
        gr.addColorStop(0, "rgba(253,224,71,0)")
        gr.addColorStop(0.5, "rgba(253,224,71,.5)")
        gr.addColorStop(1, "rgba(255,255,255,.95)")
        ctx.strokeStyle = gr
        ctx.lineWidth = 9
        ctx.lineCap = "round"
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(pos.x, pos.y); ctx.stroke()
        ctx.lineWidth = 3
        ctx.strokeStyle = "rgba(255,255,255,.95)"
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(pos.x, pos.y); ctx.stroke()
      }

      // rastro (afterimages)
      for (let i = 0; i < trail.length; i++) {
        const f = i / trail.length
        blit(ctx, spB, trail[i].x, trail[i].y, 4 + f * 17, f * 0.5)
      }

      // cabeça do projétil por elemento
      const hx = pos.x, hy = pos.y
      switch (E) {
        case "fire": {
          blit(ctx, spB, hx, hy, 44, 0.9)
          const wob = Math.sin(t * 40)
          blit(ctx, spC, hx + wob * 4, hy - wob * 3, 26, 1)
          blit(ctx, spW, hx + 8 * cosA, hy + 8 * sinA, 15, 1)
          // pedaços de meteoro girando
          for (let i = 0; i < 3; i++) {
            const a = t * 14 + i * (TAU / 3)
            blit(ctx, spC, hx + Math.cos(a) * 20, hy + Math.sin(a) * 20, 6, 0.85)
          }
          break
        }
        case "aquos": {
          blit(ctx, spB, hx, hy, 38, 0.9)
          blit(ctx, spW, hx + 6 * cosA, hy + 6 * sinA, 13, 1)
          // saca-rolhas: elipses girando ao redor do eixo
          for (let i = 0; i < 3; i++) {
            const ph = t * 22 + i * 2.1
            const off = Math.sin(ph) * 17
            const bx = hx - cosA * (16 + i * 15) - sinA * off
            const by = hy - sinA * (16 + i * 15) + cosA * off
            blit(ctx, spC, bx, by, 7 - i, 0.9 - i * 0.2)
          }
          break
        }
        case "darkness": {
          // lâmina crescente
          ctx.save()
          ctx.translate(hx, hy)
          ctx.rotate(ang)
          const bl = ctx.createLinearGradient(-30, 0, 26, 0)
          bl.addColorStop(0, `rgba(${ar},${ag},${ab},.2)`)
          bl.addColorStop(0.6, "rgba(124,58,237,.95)")
          bl.addColorStop(1, "rgba(196,181,253,1)")
          ctx.fillStyle = bl
          ctx.beginPath()
          ctx.moveTo(-30, 0)
          ctx.quadraticCurveTo(0, -19, 26, 0)
          ctx.quadraticCurveTo(0, 19, -30, 0)
          ctx.fill()
          ctx.restore()
          blit(ctx, spB, hx, hy, 34, 0.8)
          blit(ctx, spW, hx + 10 * cosA, hy + 10 * sinA, 9, 0.95)
          break
        }
        case "haos": {
          ctx.fillStyle = "rgba(255,255,255,.98)"
          star(ctx, hx, hy, t * 6, 4, 26, 9)
          ctx.fill()
          blit(ctx, spC, hx, hy, 40, 0.95)
          blit(ctx, spW, hx, hy, 18, 1)
          break
        }
        case "ventus": {
          blit(ctx, spB, hx, hy, 34, 0.85)
          for (let i = 0; i < 4; i++) {
            ctx.save()
            ctx.translate(hx, hy - 12 + i * 8)
            ctx.scale(1, 0.34)
            ctx.setLineDash([7, 6])
            ctx.lineDashOffset = t * 260 * (i % 2 ? -1 : 1)
            ring(ctx, 0, 0, 20 - i * 3.5, 2.2, `rgba(110,231,183,${0.95 - i * 0.15})`)
            ctx.setLineDash([])
            ctx.restore()
          }
          blit(ctx, spW, hx, hy, 11, 1)
          break
        }
        default: {
          // cluster glitch
          for (let i = 0; i < 5; i++) {
            const jx = Math.sin(t * 50 + i * 9) * 6
            const jy = Math.cos(t * 44 + i * 7) * 6
            ctx.fillStyle = i === 0 ? "rgba(226,232,240,.95)" : "rgba(148,163,184,.8)"
            const s = i === 0 ? 18 : 9 - i
            ctx.fillRect(hx + jx - s / 2, hy + jy - s / 2, s, s)
          }
          blit(ctx, spB, hx, hy, 30, 0.7)
        }
      }

      // partículas de rastro
      if (!reduced && rnd() < 0.9) {
        const off = (rnd() - 0.5) * 18
        pts.push({
          x: hx - sinA * off, y: hy + cosA * off,
          vx: -cosA * 60 + (rnd() - 0.5) * 50, vy: -sinA * 60 + (rnd() - 0.5) * 50,
          ax: 0, ay: E === "fire" ? -80 : 0, drag: 0.96,
          age: 0, life: 260 + rnd() * 200, size: 3 + rnd() * 4,
          r: cr, g: cg, b: cb, kind: "glow", seed: rnd(), rot: 0, spin: 0,
        })
      }
      ctx.globalCompositeOperation = "source-over"
    }

    const drawImpact = (tk: number) => {
      const inHitstop = tk < T.HITSTOP
      const k = clamp01((tk - T.HITSTOP) / (T.IMPACT - T.HITSTOP))
      ctx.globalCompositeOperation = "lighter"

      // clarão central
      const coreA = inHitstop ? 1 : (1 - k) * 0.9
      blit(ctx, spW, tx, ty, inHitstop ? 90 : 90 + eoExpo(k) * 120, coreA)
      blit(ctx, spB, tx, ty, inHitstop ? 150 : 150 + eoExpo(k) * 220, coreA * 0.8)

      if (!inHitstop) {
        // ondas de choque
        for (let i = 0; i < 5; i++) {
          const kk = clamp01(k * 1.35 - i * 0.09)
          if (kk <= 0) continue
          const r = eoExpo(kk) * (170 + i * 62)
          const alpha = (1 - kk) * (0.95 - i * 0.14)
          ring(ctx, tx, ty, r, Math.max(1, 11 - i * 2 - kk * 8), i < 2 ? `rgba(255,255,255,${alpha})` : `rgba(${P.rgb},${alpha})`)
        }
        // aberração cromática barata: anéis deslocados
        const rC = eoExpo(k) * 210
        ring(ctx, tx - 4, ty, rC, 2, `rgba(255,60,60,${(1 - k) * 0.4})`)
        ring(ctx, tx + 4, ty, rC, 2, `rgba(60,60,255,${(1 - k) * 0.4})`)
        // raios radiais
        for (let i = 0; i < 18; i++) {
          const a = i * (TAU / 18) + 0.35
          const L = eoExpo(k) * (130 + ((i * 37) % 90))
          const w = i % 3 === 0 ? 4 : 2
          ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * (i % 3 === 0 ? 0.9 : 0.55)})`
          ctx.lineWidth = w
          ctx.beginPath()
          ctx.moveTo(tx + Math.cos(a) * L * 0.25, ty + Math.sin(a) * L * 0.25)
          ctx.lineTo(tx + Math.cos(a) * L, ty + Math.sin(a) * L)
          ctx.stroke()
        }

        // ── SIGILO ELEMENTAL — círculo mágico de "ativação" ──
        const sg = clamp01(k * 1.6)
        const sgA = sg < 0.7 ? 1 : 1 - (sg - 0.7) / 0.3
        const R = eoBack(clamp01(sg * 1.4)) * 150
        const rot = k * 2.4
        if (R > 4) {
          for (let s = 0; s < 12; s++) {
            ctx.beginPath()
            ctx.arc(tx, ty, R, rot + s * (TAU / 12), rot + s * (TAU / 12) + TAU / 26)
            ctx.lineWidth = 5
            ctx.strokeStyle = `rgba(${P.rgb},${0.9 * sgA})`
            ctx.stroke()
          }
          for (let s = 0; s < 8; s++) {
            ctx.beginPath()
            ctx.arc(tx, ty, R * 0.74, -rot * 1.4 + s * (TAU / 8), -rot * 1.4 + s * (TAU / 8) + TAU / 18)
            ctx.lineWidth = 2.5
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.85 * sgA})`
            ctx.stroke()
          }
          ring(ctx, tx, ty, R * 0.58, 1, `rgba(255,255,255,${0.6 * sgA})`)
          // glifo central por elemento
          const gn = E === "fire" ? 5 : E === "aquos" ? 6 : E === "darkness" ? 5 : E === "haos" ? 12 : E === "ventus" ? 8 : 7
          const gRatio = E === "haos" ? 0.5 : E === "ventus" ? 0.32 : 0.45
          const GR = R * 0.42
          const gg = ctx.createLinearGradient(tx - GR, ty - GR, tx + GR, ty + GR)
          gg.addColorStop(0, "rgba(255,255,255,1)")
          gg.addColorStop(1, `rgba(${P.rgb},1)`)
          ctx.fillStyle = gg
          ctx.globalAlpha = sgA
          star(ctx, tx, ty, rot * 0.5 + (E === "darkness" ? Math.PI : -Math.PI / 2), gn, GR, GR * gRatio)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
      ctx.globalCompositeOperation = "source-over"
    }

    const drawAftermath = (k: number, now: number) => {
      const t = now * 0.001
      ctx.globalCompositeOperation = "lighter"
      // brilho residual
      blit(ctx, spB, tx, ty, 70 * (1 - k), (1 - k) * 0.55)

      switch (E) {
        case "fire":
          if (k < 0.7) {
            for (let i = 0; i < 10; i++) {
              const a = i * (TAU / 10)
              const fk = clamp01(k / 0.7)
              const L = eoCubic(fk) * (56 + ((i * 29) % 26))
              ctx.save()
              ctx.translate(tx + Math.cos(a) * L * 0.4, ty + Math.sin(a) * L * 0.4 - eoCubic(fk) * 42)
              ctx.scale(1, 1.9)
              blit(ctx, spC, 0, 0, 10 * (1 - fk * 0.7), (1 - fk) * 0.85)
              ctx.restore()
            }
            ring(ctx, tx, ty, eoExpo(clamp01(k / 0.6)) * 200, 2.5, `rgba(249,115,22,${(1 - k / 0.7) * 0.7})`)
          }
          break
        case "aquos": {
          // vórtice que drena e explode
          for (let i = 0; i < 3; i++) {
            const rot = t * (6 - i) * (i % 2 ? -1 : 1)
            const sz = k < 0.4 ? (1 - k / 0.4) * (70 + i * 22) : eoCubic((k - 0.4) / 0.6) * (150 + i * 50)
            const al = k < 0.4 ? 0.85 : (1 - (k - 0.4) / 0.6) * 0.7
            for (let s = 0; s < 5; s++) {
              ctx.beginPath()
              ctx.arc(tx, ty, sz, rot + s * (TAU / 5), rot + s * (TAU / 5) + 0.7)
              ctx.lineWidth = 3 - i * 0.6
              ctx.strokeStyle = `rgba(${i % 2 ? "56,189,248" : "125,211,252"},${al})`
              ctx.stroke()
            }
          }
          // coluna d'água
          if (k > 0.3 && k < 0.85) {
            const wk = (k - 0.3) / 0.55
            const wh = eoCubic(wk) * 90
            const gr = ctx.createLinearGradient(tx, ty, tx, ty - wh)
            gr.addColorStop(0, `rgba(56,189,248,${(1 - wk) * 0.85})`)
            gr.addColorStop(1, "rgba(125,211,252,0)")
            ctx.fillStyle = gr
            ctx.fillRect(tx - 8, ty - wh, 16, wh)
          }
          break
        }
        case "darkness":
          if (k < 0.4) {
            // implosão: linhas sugadas para dentro
            const ik = k / 0.4
            for (let i = 0; i < 10; i++) {
              const a = i * (TAU / 10)
              const L = (1 - eoCubic(ik)) * 96
              ctx.strokeStyle = `rgba(167,139,250,${(1 - ik) * 0.9})`
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.moveTo(tx + Math.cos(a) * L, ty + Math.sin(a) * L)
              ctx.lineTo(tx + Math.cos(a) * L * 0.4, ty + Math.sin(a) * L * 0.4)
              ctx.stroke()
            }
            ctx.globalCompositeOperation = "source-over"
            ctx.beginPath(); ctx.arc(tx, ty, (1 - ik) * 20 + 6, 0, TAU)
            ctx.fillStyle = "#09000f"; ctx.fill()
            ctx.globalCompositeOperation = "lighter"
          } else {
            // garras sombrias estalando para fora
            const ck = (k - 0.4) / 0.6
            for (let i = 0; i < 6; i++) {
              const a = i * (TAU / 6) + (i % 2 ? 0.5 : -0.5) * eoCubic(ck)
              const L = eoBack(clamp01(ck * 1.2)) * 80
              ctx.save()
              ctx.translate(tx, ty)
              ctx.rotate(a)
              const gr = ctx.createLinearGradient(0, 0, L, 0)
              gr.addColorStop(0, `rgba(46,16,101,${(1 - ck) * 0.95})`)
              gr.addColorStop(1, `rgba(167,139,250,0)`)
              ctx.fillStyle = gr
              ctx.beginPath()
              ctx.moveTo(0, -4)
              ctx.quadraticCurveTo(L * 0.6, -10, L, 0)
              ctx.quadraticCurveTo(L * 0.6, 6, 0, 4)
              ctx.fill()
              ctx.restore()
            }
            ring(ctx, tx, ty, eoExpo(ck) * 180, 2, `rgba(167,139,250,${(1 - ck) * 0.5})`)
          }
          break
        case "haos": {
          // flash em cruz + pilar divino
          if (k < 0.45) {
            const xk = k / 0.45
            const L = eoExpo(xk) * 210
            ctx.strokeStyle = `rgba(255,255,255,${(1 - xk) * 0.95})`
            ctx.lineWidth = 6 * (1 - xk) + 1
            for (const a of [0, Math.PI / 2]) {
              ctx.beginPath()
              ctx.moveTo(tx - Math.cos(a) * L, ty - Math.sin(a) * L)
              ctx.lineTo(tx + Math.cos(a) * L, ty + Math.sin(a) * L)
              ctx.stroke()
            }
          }
          if (k < 0.75) {
            const pk = clamp01(k / 0.75)
            const ph = eoCubic(pk) * 150
            const gr = ctx.createLinearGradient(tx, ty, tx, ty - ph)
            gr.addColorStop(0, `rgba(255,255,255,${(1 - pk) * 0.9})`)
            gr.addColorStop(0.5, `rgba(254,240,138,${(1 - pk) * 0.5})`)
            gr.addColorStop(1, "rgba(253,224,71,0)")
            ctx.fillStyle = gr
            ctx.fillRect(tx - 12, ty - ph, 24, ph)
          }
          for (let i = 0; i < 3; i++) {
            const rk = clamp01(k * 1.3 - i * 0.12)
            if (rk <= 0) continue
            ring(ctx, tx, ty, eoExpo(rk) * (110 + i * 60), 2, `rgba(253,224,71,${(1 - rk) * (0.8 - i * 0.2)})`)
          }
          break
        }
        case "ventus": {
          // funil de tornado subindo e se dissipando
          const rise = eoCubic(k) * 70
          for (let i = 0; i < 6; i++) {
            const w = (120 - i * 16) * (1 - k * 0.5)
            const hy = ty + 30 - i * 22 - rise
            ctx.save()
            ctx.translate(tx + Math.sin(t * 3 + i) * 6, hy)
            ctx.scale(1, 0.32)
            ctx.setLineDash([12, 9])
            ctx.lineDashOffset = t * 200 * (i % 2 ? -1 : 1)
            ring(ctx, 0, 0, w / 2, 2.6 - i * 0.3, `rgba(${i % 2 ? "52,211,153" : "110,231,183"},${(1 - k) * (0.9 - i * 0.08)})`)
            ctx.setLineDash([])
            ctx.restore()
          }
          for (let i = 0; i < 8; i++) {
            const sk = clamp01(k * 1.6 - i * 0.06)
            if (sk <= 0) continue
            const a = i * (TAU / 8) + 0.4
            const L = eoExpo(sk) * 95
            ctx.strokeStyle = `rgba(52,211,153,${(1 - sk) * 0.85})`
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.moveTo(tx + Math.cos(a) * L * 0.3, ty + Math.sin(a) * L * 0.3)
            ctx.lineTo(tx + Math.cos(a) * L, ty + Math.sin(a) * L)
            ctx.stroke()
          }
          break
        }
        default:
          // void — barras glitch + rachaduras de realidade
          if (k < 0.55) {
            for (let i = 0; i < 4; i++) {
              const on = Math.sin(t * 26 + i * 5) > -0.2
              if (!on) continue
              const gx = Math.sin(t * 40 + i * 13) * 12
              ctx.fillStyle = `rgba(203,213,225,${(1 - k / 0.55) * 0.55})`
              ctx.fillRect(tx - 90 + gx, ty - 26 + i * 17, 180, 3)
            }
          }
          for (let i = 0; i < 6; i++) {
            const sk = clamp01(k * 1.5 - i * 0.07)
            if (sk <= 0) continue
            const a = i * (TAU / 6) + 0.16
            const L = eoExpo(sk) * 74
            ctx.strokeStyle = `rgba(148,163,184,${(1 - sk) * 0.75})`
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(tx, ty)
            ctx.lineTo(tx + Math.cos(a) * L, ty + Math.sin(a) * L)
            ctx.stroke()
          }
      }
      ctx.globalCompositeOperation = "source-over"
    }

    const drawParticles = (dt: number) => {
      ctx.globalCompositeOperation = "lighter"
      const dragPow = dt * 60
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i]
        p.age += dt * 1000
        if (p.age >= p.life) { pts.splice(i, 1); continue }
        p.vx += p.ax * dt
        p.vy += p.ay * dt
        const dr = Math.pow(p.drag, dragPow)
        p.vx *= dr; p.vy *= dr
        if (p.kind === "swirl") {
          const rot = p.spin * dt
          const nvx = p.vx * Math.cos(rot) - p.vy * Math.sin(rot)
          p.vy = p.vx * Math.sin(rot) + p.vy * Math.cos(rot)
          p.vx = nvx
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.spin * dt
        const k = p.age / p.life
        const fade = 1 - k
        switch (p.kind) {
          case "shard": {
            ctx.globalCompositeOperation = "source-over"
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.rotate(p.rot)
            ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${fade * 0.9})`
            const s = p.size * (1 - k * 0.5)
            ctx.fillRect(-s / 2, -s / 2, s, s * 0.6)
            ctx.restore()
            ctx.globalCompositeOperation = "lighter"
            break
          }
          case "flame": {
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.scale(1, 1.8)
            blit(ctx, spC, 0, 0, p.size * (1 - k * 0.4), fade * 0.85)
            ctx.restore()
            break
          }
          case "glitter": {
            const tw = 0.5 + 0.5 * Math.sin(p.age * 0.03 + p.seed * 20)
            blit(ctx, spW, p.x, p.y, p.size * (1 - k * 0.4), fade * tw)
            break
          }
          case "note": {
            // nota musical roxa flutuante com brilho — assinatura da Morgana
            const tw = 0.72 + 0.28 * Math.sin(p.age * 0.02 + p.seed * 20)
            const wobble = Math.sin(p.age * 0.004 + p.seed * 10) * 0.3
            blit(ctx, spB, p.x, p.y, p.size * 1.5 * (1 - k * 0.3), fade * 0.55)
            musicNote(
              ctx, p.x, p.y, p.size * (1 - k * 0.25), p.rot + wobble,
              fade * tw, `rgb(${p.r},${p.g},${p.b})`, p.seed > 0.62,
            )
            break
          }
          case "wisp": {
            ctx.globalCompositeOperation = "source-over"
            const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (1 + k))
            gr.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${fade * 0.8})`)
            gr.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`)
            ctx.fillStyle = gr
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k), 0, TAU); ctx.fill()
            ctx.globalCompositeOperation = "lighter"
            break
          }
          default: {
            const sp = p.r === 255 && p.g === 255 && p.b === 255 ? spW : p.r === cr && p.g === cg && p.b === cb ? spC : spB
            blit(ctx, sp, p.x, p.y, p.size * (1 - k * 0.55), fade)
          }
        }
      }
      ctx.globalCompositeOperation = "source-over"
    }

    // ── Overlays de tela cheia (flash / tinta / vinheta) ─────────────────────
    const drawScreenFX = (t: number, w: number, hgt: number) => {
      if (t >= C1 && t < C2 && E === "haos") {
        // brilho sutil de tela no laser
        ctx.fillStyle = "rgba(254,240,138,.05)"
        ctx.fillRect(0, 0, w, hgt)
      }
      if (t >= C2 && t < C3) {
        const ik = (t - C2) / T.IMPACT
        const flash = ik < 0.12 ? 0.85 : Math.max(0, 0.85 * (1 - (ik - 0.12) / 0.45))
        if (flash > 0.01) {
          // Calem: flash branco-prata instantâneo, depois a tela é engolida pelo escuro do vazio
          ctx.fillStyle = E === "darkness"
            ? `rgba(20,4,36,${flash})`
            : isCalem
              ? ik < 0.16
                ? `rgba(255,255,255,${flash * 0.9})`
                : `rgba(4,6,10,${flash})`
              : `rgba(255,255,255,${flash * 0.75})`
          ctx.fillRect(0, 0, w, hgt)
        }
        const tint = 0.22 * (1 - ik)
        if (tint > 0.01) {
          ctx.fillStyle = `rgba(${P.rgb},${tint})`
          ctx.fillRect(0, 0, w, hgt)
        }
      }
    }

    // ═══════════ FEHNON HOSKIE — CORTE DE ESPADA AQUÁTICO ÉPICO ═════════════
    const fehnonSlashAng = ang + Math.PI / 5

    const drawFehnonCharge = (k: number, now: number) => {
      const t = now * 0.001
      const grow = eoCubic(k)
      // aura ambiente azul profunda
      const amb = ctx.createRadialGradient(sx, sy, 0, sx, sy, 340)
      amb.addColorStop(0, `rgba(14,165,233,${0.3 * k})`)
      amb.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = amb
      ctx.fillRect(sx - 340, sy - 340, 680, 680)

      ctx.globalCompositeOperation = "lighter"
      // correntes de água espiralando para dentro (sucção)
      for (let i = 0; i < 14; i++) {
        const frac = 1 - ((t * 1.9 + i * 0.618) % 1)
        const a = i * (TAU / 14) + t * 2.6 + frac * 2.2
        const r = frac * 120
        blit(ctx, i % 2 ? spC : spW, sx + Math.cos(a) * r, sy + Math.sin(a) * r, 4 + (1 - frac) * 8, (1 - frac) * 0.95 * k)
      }
      // anéis d'água colapsando
      for (let i = 0; i < 3; i++) {
        const fr = 1 - ((t * 1.5 + i / 3) % 1)
        ring(ctx, sx, sy, fr * 130, 2.5, `rgba(56,189,248,${(1 - fr) * 0.8 * k})`)
      }
      // LÂMINA DE ÁGUA se materializando — espada erguida em diagonal
      const bladeH = 128 * grow
      const sway = Math.sin(t * 7) * 0.08
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(-Math.PI / 4 + sway)
      const bl = ctx.createLinearGradient(0, 22, 0, -bladeH)
      bl.addColorStop(0, "rgba(240,249,255,.95)")
      bl.addColorStop(0.5, "rgba(56,189,248,.9)")
      bl.addColorStop(1, "rgba(14,165,233,0)")
      ctx.fillStyle = bl
      ctx.beginPath()
      ctx.moveTo(0, 22)
      ctx.quadraticCurveTo(-10 - 4 * Math.sin(t * 12), -bladeH * 0.45, 0, -bladeH)
      ctx.quadraticCurveTo(10 + 4 * Math.sin(t * 12 + 1), -bladeH * 0.45, 0, 22)
      ctx.fill()
      // fio branco da lâmina
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * grow})`
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(0, -bladeH); ctx.stroke()
      // água espiralando ao longo da lâmina
      for (let i = 0; i < 7; i++) {
        const fr = (t * 1.6 + i / 7) % 1
        const yy = 20 - fr * (bladeH + 20)
        const xx = Math.sin(fr * TAU * 3 + i) * 15 * (1 - fr * 0.4)
        blit(ctx, i % 2 ? spW : spC, xx, yy, 3.5 + (1 - fr) * 2.5, (1 - fr) * 0.9 * grow)
      }
      ctx.restore()
      // núcleo pulsante no punho
      const pulse = 1 + Math.sin(t * 24) * 0.14
      blit(ctx, spB, sx, sy, (26 + 30 * grow) * pulse, 0.95)
      blit(ctx, spW, sx, sy, (12 + 15 * grow) * pulse, 1)
      ctx.globalCompositeOperation = "source-over"
      // imagem residual do atacante
      if (atkImg && atkImg.complete && atkImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.4 * (1 - k)
        ctx.drawImage(atkImg, sx - 42, sy - 58, 84, 116)
        ctx.globalAlpha = 1
      }
    }

    const drawFehnonStrike = (k: number, now: number) => {
      const t = now * 0.001
      const p = eiCubic(k) * 0.35 + k * 0.65
      const pos = { x: sx + cosA * dist * p, y: sy + sinA * dist * p }
      trail.push({ x: pos.x, y: pos.y })
      if (trail.length > 26) trail.shift()

      ctx.globalCompositeOperation = "lighter"
      // linhas de velocidade
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(ang)
      for (let i = 0; i < 12; i++) {
        const off = (i - 5.5) * 26
        const len = 140 + ((i * 53) % 160)
        const xw = p * (dist + 520) - len - ((i * 97) % 240)
        ctx.strokeStyle = `rgba(14,165,233,${0.2 - Math.abs(i - 5.5) * 0.02})`
        ctx.lineWidth = Math.abs(i - 5.5) < 1.5 ? 3 : 1.5
        ctx.beginPath(); ctx.moveTo(xw, off); ctx.lineTo(xw + len, off); ctx.stroke()
      }
      ctx.restore()

      // fitas d'água serpenteando atrás do corte
      for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath()
        for (let i = 0; i <= 22; i++) {
          const q = (i / 22) * p
          const wob = Math.sin(q * TAU * 3.2 + t * 9) * 24 * s * (1 - q * 0.3)
          const wx = sx + cosA * dist * q - sinA * wob
          const wy = sy + sinA * dist * q + cosA * wob
          if (i === 0) ctx.moveTo(wx, wy)
          else ctx.lineTo(wx, wy)
        }
        ctx.strokeStyle = "rgba(125,211,252,.55)"
        ctx.lineWidth = 3
        ctx.stroke()
      }

      // rastro (afterimages)
      for (let i = 0; i < trail.length; i++) {
        const f = i / trail.length
        blit(ctx, spB, trail[i].x, trail[i].y, 5 + f * 20, f * 0.55)
      }

      // ── LÂMINA CRESCENTE GIGANTE — o corte voador ──
      const R = 42 + p * 36
      ctx.save()
      ctx.translate(pos.x, pos.y)
      ctx.rotate(ang)
      const grad = ctx.createLinearGradient(-R, 0, R * 0.9, 0)
      grad.addColorStop(0, "rgba(7,89,133,.15)")
      grad.addColorStop(0.55, "rgba(56,189,248,.95)")
      grad.addColorStop(1, "rgba(255,255,255,1)")
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(-R * 0.2, -R)
      ctx.quadraticCurveTo(R * 0.95, 0, -R * 0.2, R)
      ctx.quadraticCurveTo(R * 0.25, 0, -R * 0.2, -R)
      ctx.closePath()
      ctx.fill()
      // fio branco no gume do crescente
      ctx.strokeStyle = "rgba(255,255,255,.95)"
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(-R * 0.2, -R)
      ctx.quadraticCurveTo(R * 0.95, 0, -R * 0.2, R)
      ctx.stroke()
      ctx.restore()
      blit(ctx, spB, pos.x, pos.y, R, 0.75)
      blit(ctx, spW, pos.x + 10 * cosA, pos.y + 10 * sinA, 14, 1)
      // gotas orbitando a lâmina
      for (let i = 0; i < 4; i++) {
        const a = t * 16 + i * (TAU / 4)
        blit(ctx, spC, pos.x + Math.cos(a) * R * 0.7, pos.y + Math.sin(a) * R * 0.35, 5, 0.85)
      }

      // gotículas deixadas para trás
      if (!reduced && rnd() < 0.95) {
        const off = (rnd() - 0.5) * 24
        pts.push({
          x: pos.x - sinA * off, y: pos.y + cosA * off,
          vx: -cosA * 70 + (rnd() - 0.5) * 60, vy: -sinA * 70 + (rnd() - 0.5) * 60 + 40,
          ax: 0, ay: 320, drag: 0.97,
          age: 0, life: 300 + rnd() * 240, size: 2.5 + rnd() * 4,
          r: 125, g: 211, b: 252, kind: "glow", seed: rnd(), rot: 0, spin: 0,
        })
      }
      ctx.globalCompositeOperation = "source-over"
    }

    const drawFehnonImpact = (tk: number) => {
      const inHitstop = tk < T.HITSTOP
      const k = clamp01((tk - T.HITSTOP) / (T.IMPACT - T.HITSTOP))
      ctx.globalCompositeOperation = "lighter"

      // clarão central
      const coreA = inHitstop ? 1 : (1 - k) * 0.9
      blit(ctx, spW, tx, ty, inHitstop ? 100 : 100 + eoExpo(k) * 130, coreA)
      blit(ctx, spB, tx, ty, inHitstop ? 160 : 160 + eoExpo(k) * 240, coreA * 0.8)

      // ── LINHA DE CORTE GIGANTE (visível já no hitstop) ──
      const cutL = inHitstop ? 250 : 250 + eoExpo(k) * 170
      const fadeCut = inHitstop ? 1 : 1 - k * 0.85
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(fehnonSlashAng)
      const cg2 = ctx.createLinearGradient(-cutL, 0, cutL, 0)
      cg2.addColorStop(0, "rgba(56,189,248,0)")
      cg2.addColorStop(0.5, `rgba(255,255,255,${0.98 * fadeCut})`)
      cg2.addColorStop(1, "rgba(56,189,248,0)")
      ctx.fillStyle = cg2
      ctx.beginPath()
      ctx.moveTo(-cutL, 0)
      ctx.quadraticCurveTo(0, -15, cutL, 0)
      ctx.quadraticCurveTo(0, 15, -cutL, 0)
      ctx.fill()
      ctx.strokeStyle = `rgba(56,189,248,${0.85 * fadeCut})`
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.moveTo(-cutL, 0); ctx.lineTo(cutL, 0); ctx.stroke()
      ctx.restore()

      // segundo corte cruzado (X) — chega um instante depois
      if (!inHitstop && k > 0.1) {
        const k2 = clamp01((k - 0.1) / 0.9)
        const cut2 = eoExpo(k2) * 350
        ctx.save()
        ctx.translate(tx, ty)
        ctx.rotate(fehnonSlashAng + Math.PI / 2.4)
        const g3 = ctx.createLinearGradient(-cut2, 0, cut2, 0)
        g3.addColorStop(0, "rgba(125,211,252,0)")
        g3.addColorStop(0.5, `rgba(255,255,255,${0.9 * (1 - k2)})`)
        g3.addColorStop(1, "rgba(125,211,252,0)")
        ctx.fillStyle = g3
        ctx.beginPath()
        ctx.moveTo(-cut2, 0)
        ctx.quadraticCurveTo(0, -11, cut2, 0)
        ctx.quadraticCurveTo(0, 11, -cut2, 0)
        ctx.fill()
        ctx.restore()
      }

      if (!inHitstop) {
        // ondas de choque aquáticas
        for (let i = 0; i < 5; i++) {
          const kk = clamp01(k * 1.35 - i * 0.09)
          if (kk <= 0) continue
          const r = eoExpo(kk) * (190 + i * 66)
          const alpha = (1 - kk) * (0.95 - i * 0.14)
          ring(ctx, tx, ty, r, Math.max(1, 11 - i * 2 - kk * 8), i < 2 ? `rgba(255,255,255,${alpha})` : `rgba(14,165,233,${alpha})`)
        }
        // aberração cromática
        const rC = eoExpo(k) * 230
        ring(ctx, tx - 4, ty, rC, 2, `rgba(255,60,60,${(1 - k) * 0.4})`)
        ring(ctx, tx + 4, ty, rC, 2, `rgba(60,60,255,${(1 - k) * 0.4})`)
        // GÊISER — coluna d'água explodindo para cima
        const gk = clamp01(k * 1.25)
        const gh = eoCubic(gk) * 220
        const gw = 26 * (1 - gk * 0.35)
        const gg = ctx.createLinearGradient(tx, ty, tx, ty - gh)
        gg.addColorStop(0, `rgba(255,255,255,${(1 - gk) * 0.95})`)
        gg.addColorStop(0.4, `rgba(56,189,248,${(1 - gk) * 0.8})`)
        gg.addColorStop(1, "rgba(125,211,252,0)")
        ctx.fillStyle = gg
        ctx.fillRect(tx - gw / 2, ty - gh, gw, gh)
        // coroa d'água (splash em coroa, achatada)
        ctx.save()
        ctx.translate(tx, ty)
        ctx.scale(1, 0.4)
        const crownR = eoExpo(k) * 155
        ring(ctx, 0, 0, crownR, 4, `rgba(125,211,252,${(1 - k) * 0.9})`)
        for (let i = 0; i < 12; i++) {
          const a = i * (TAU / 12)
          const dR = crownR + Math.sin(k * 20 + i * 3) * 8
          blit(ctx, spC, Math.cos(a) * dR, Math.sin(a) * dR, 7 * (1 - k * 0.5), (1 - k) * 0.9)
        }
        ctx.restore()
      }
      ctx.globalCompositeOperation = "source-over"
    }

    const drawFehnonAftermath = (k: number, now: number) => {
      const t = now * 0.001
      ctx.globalCompositeOperation = "lighter"
      blit(ctx, spB, tx, ty, 80 * (1 - k), (1 - k) * 0.5)
      // linha de corte residual pulsando
      if (k < 0.6) {
        const rk = k / 0.6
        const L = 270 * (1 - rk * 0.3)
        ctx.save()
        ctx.translate(tx, ty)
        ctx.rotate(fehnonSlashAng)
        ctx.strokeStyle = `rgba(125,211,252,${(1 - rk) * 0.8 * (0.6 + 0.4 * Math.sin(t * 30))})`
        ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke()
        ctx.restore()
      }
      // vórtice que drena e explode
      for (let i = 0; i < 3; i++) {
        const rot = t * (6 - i) * (i % 2 ? -1 : 1)
        const sz = k < 0.4 ? (1 - k / 0.4) * (80 + i * 26) : eoCubic((k - 0.4) / 0.6) * (170 + i * 55)
        const al = k < 0.4 ? 0.85 : (1 - (k - 0.4) / 0.6) * 0.7
        for (let s = 0; s < 5; s++) {
          ctx.beginPath()
          ctx.arc(tx, ty, sz, rot + s * (TAU / 5), rot + s * (TAU / 5) + 0.7)
          ctx.lineWidth = 3 - i * 0.6
          ctx.strokeStyle = `rgba(${i % 2 ? "56,189,248" : "125,211,252"},${al})`
          ctx.stroke()
        }
      }
      // névoa subindo (vapor se dissipando)
      if (k < 0.9) {
        for (let i = 0; i < 6; i++) {
          const fr = (t * 0.5 + i / 6) % 1
          const mx = tx + ((i % 3) - 1) * 60 + Math.sin(t * 2 + i) * 14
          const my = ty - fr * 115
          blit(ctx, spC, mx, my, 20 + fr * 16, (1 - fr) * (1 - k) * 0.35)
        }
      }
      ctx.globalCompositeOperation = "source-over"
    }

    // ═══════ MORGANA PENDRAGON — RASGO ELÉTRICO ROXO COM NOTAS MUSICAIS ══════
    const morganaSlashAng = ang - Math.PI / 6

    const drawMorganaCharge = (k: number, now: number) => {
      const t = now * 0.001
      const grow = eoCubic(k)
      // aura ambiente roxa profunda
      const amb = ctx.createRadialGradient(sx, sy, 0, sx, sy, 340)
      amb.addColorStop(0, `rgba(124,58,237,${0.32 * k})`)
      amb.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = amb
      ctx.fillRect(sx - 340, sy - 340, 680, 680)

      ctx.globalCompositeOperation = "lighter"
      // arcos elétricos crepitando ao redor (flicker por frame)
      const fseed = Math.floor(now / 46)
      const frnd = mulberry(fseed)
      for (let i = 0; i < 6; i++) {
        if (frnd() < 0.35) continue
        const a1 = frnd() * TAU
        const a2 = a1 + 0.6 + frnd() * 1.4
        const r1 = (26 + frnd() * 66) * grow
        const r2 = (26 + frnd() * 66) * grow
        bolt(
          ctx, sx + Math.cos(a1) * r1, sy + Math.sin(a1) * r1,
          sx + Math.cos(a2) * r2, sy + Math.sin(a2) * r2,
          5, 9, fseed * 7 + i * 131, 1.6, `rgba(216,180,254,${0.85 * k})`,
        )
      }
      // faíscas convergindo em espiral (sucção de energia)
      for (let i = 0; i < 13; i++) {
        const frac = 1 - ((t * 1.9 + i * 0.618) % 1)
        const a = i * (TAU / 13) + t * 2.8 + frac * 2
        const r = frac * 118
        blit(ctx, i % 2 ? spC : spW, sx + Math.cos(a) * r, sy + Math.sin(a) * r, 4 + (1 - frac) * 7, (1 - frac) * 0.9 * k)
      }
      // anéis colapsando
      for (let i = 0; i < 3; i++) {
        const fr = 1 - ((t * 1.5 + i / 3) % 1)
        ring(ctx, sx, sy, fr * 125, 2.5, `rgba(167,139,250,${(1 - fr) * 0.8 * k})`)
      }
      // NOTAS MUSICAIS orbitando e subindo ao redor da carga
      for (let i = 0; i < 6; i++) {
        const fr = (t * 0.65 + i / 6) % 1
        const a = t * 2.4 + i * (TAU / 6)
        const orbR = (46 + Math.sin(t * 3 + i) * 10) * grow
        const nx = sx + Math.cos(a) * orbR
        const ny = sy + Math.sin(a) * orbR * 0.7 - fr * 58
        musicNote(ctx, nx, ny, (9 + (i % 3) * 3) * grow, Math.sin(t * 2 + i) * 0.4, (1 - fr) * 0.9 * k, i % 2 ? "rgba(216,180,254,1)" : "rgba(168,85,247,1)", i % 3 === 0)
      }
      // núcleo sombrio com anel violeta pulsante
      ctx.globalCompositeOperation = "source-over"
      const cr2 = 15 * grow * (1 + Math.sin(t * 20) * 0.1)
      ctx.beginPath(); ctx.arc(sx, sy, cr2, 0, TAU)
      ctx.fillStyle = "#0b0016"; ctx.fill()
      ctx.globalCompositeOperation = "lighter"
      ring(ctx, sx, sy, cr2 + 4, 3, "rgba(168,85,247,.95)")
      const pulse = 1 + Math.sin(t * 24) * 0.14
      blit(ctx, spB, sx, sy, (24 + 30 * grow) * pulse, 0.9)
      blit(ctx, spW, sx, sy, (10 + 13 * grow) * pulse, 1)
      ctx.globalCompositeOperation = "source-over"
      // imagem residual do atacante
      if (atkImg && atkImg.complete && atkImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.4 * (1 - k)
        ctx.drawImage(atkImg, sx - 42, sy - 58, 84, 116)
        ctx.globalAlpha = 1
      }
    }

    const drawMorganaStrike = (k: number, now: number) => {
      const t = now * 0.001
      const p = eiCubic(k) * 0.35 + k * 0.65
      const pos = { x: sx + cosA * dist * p, y: sy + sinA * dist * p }
      trail.push({ x: pos.x, y: pos.y })
      if (trail.length > 26) trail.shift()

      ctx.globalCompositeOperation = "lighter"
      // linhas de velocidade roxas
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(ang)
      for (let i = 0; i < 12; i++) {
        const off = (i - 5.5) * 26
        const len = 140 + ((i * 53) % 160)
        const xw = p * (dist + 520) - len - ((i * 97) % 240)
        ctx.strokeStyle = `rgba(124,58,237,${0.2 - Math.abs(i - 5.5) * 0.02})`
        ctx.lineWidth = Math.abs(i - 5.5) < 1.5 ? 3 : 1.5
        ctx.beginPath(); ctx.moveTo(xw, off); ctx.lineTo(xw + len, off); ctx.stroke()
      }
      ctx.restore()

      // ── RELÂMPAGO CONTÍNUO da origem até a cabeça — o rasgo em trânsito ──
      const fseed = Math.floor(now / 40)
      bolt(ctx, sx, sy, pos.x, pos.y, 14, 30, fseed * 13 + 1, 7, "rgba(124,58,237,.5)")
      bolt(ctx, sx, sy, pos.x, pos.y, 14, 26, fseed * 13 + 2, 3.5, "rgba(168,85,247,.85)")
      bolt(ctx, sx, sy, pos.x, pos.y, 14, 22, fseed * 13 + 3, 1.6, "rgba(255,255,255,.95)")
      // arcos secundários que se ramificam do relâmpago principal
      const brnd = mulberry(fseed * 29)
      for (let i = 0; i < 4; i++) {
        if (brnd() < 0.3) continue
        const q = 0.25 + brnd() * 0.6
        const bx = sx + cosA * dist * p * q
        const by = sy + sinA * dist * p * q
        const ba = ang + (brnd() - 0.5) * 2.4
        const bL = 30 + brnd() * 70
        bolt(ctx, bx, by, bx + Math.cos(ba) * bL, by + Math.sin(ba) * bL, 5, 12, fseed * 31 + i * 17, 1.4, "rgba(216,180,254,.8)")
      }

      // rastro (afterimages)
      for (let i = 0; i < trail.length; i++) {
        const f = i / trail.length
        blit(ctx, spB, trail[i].x, trail[i].y, 5 + f * 19, f * 0.55)
      }

      // ── CABEÇA: fenda elétrica crescente cortando o ar ──
      const R = 40 + p * 34
      ctx.save()
      ctx.translate(pos.x, pos.y)
      ctx.rotate(ang)
      const grad = ctx.createLinearGradient(-R, 0, R * 0.9, 0)
      grad.addColorStop(0, "rgba(46,16,101,.15)")
      grad.addColorStop(0.55, "rgba(168,85,247,.95)")
      grad.addColorStop(1, "rgba(255,255,255,1)")
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(-R * 0.2, -R)
      ctx.quadraticCurveTo(R * 0.95, 0, -R * 0.2, R)
      ctx.quadraticCurveTo(R * 0.25, 0, -R * 0.2, -R)
      ctx.closePath()
      ctx.fill()
      // fio branco serrilhado no gume
      ctx.strokeStyle = "rgba(255,255,255,.95)"
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(-R * 0.2, -R)
      ctx.quadraticCurveTo(R * 0.95, 0, -R * 0.2, R)
      ctx.stroke()
      ctx.restore()
      blit(ctx, spB, pos.x, pos.y, R, 0.8)
      blit(ctx, spW, pos.x + 10 * cosA, pos.y + 10 * sinA, 13, 1)

      // NOTAS MUSICAIS voando no vácuo do rasgo
      for (let i = 0; i < 5; i++) {
        const q = p - 0.08 - i * 0.09
        if (q <= 0.02) continue
        const wob = Math.sin(q * TAU * 2.4 + t * 7 + i * 2) * 30
        const nx = sx + cosA * dist * q - sinA * wob
        const ny = sy + sinA * dist * q + cosA * wob
        musicNote(ctx, nx, ny, 10 + (i % 3) * 3, Math.sin(t * 4 + i) * 0.5, 0.9 - i * 0.14, i % 2 ? "rgba(216,180,254,1)" : "rgba(168,85,247,1)", i % 3 === 0)
      }

      // partículas de rastro (faíscas roxas)
      if (!reduced && rnd() < 0.95) {
        const off = (rnd() - 0.5) * 24
        pts.push({
          x: pos.x - sinA * off, y: pos.y + cosA * off,
          vx: -cosA * 70 + (rnd() - 0.5) * 70, vy: -sinA * 70 + (rnd() - 0.5) * 70,
          ax: 0, ay: 0, drag: 0.96,
          age: 0, life: 280 + rnd() * 220, size: 2.5 + rnd() * 4,
          r: 196, g: 181, b: 253, kind: "glow", seed: rnd(), rot: 0, spin: 0,
        })
      }
      // nota ocasional deixada para trás flutuando
      if (!reduced && rnd() < 0.22) {
        pts.push({
          x: pos.x + (rnd() - 0.5) * 30, y: pos.y + (rnd() - 0.5) * 30,
          vx: (rnd() - 0.5) * 60, vy: -40 - rnd() * 60,
          ax: 0, ay: -20, drag: 0.985,
          age: 0, life: 500 + rnd() * 350, size: 8 + rnd() * 5,
          r: 216, g: 180, b: 254, kind: "note", seed: rnd(), rot: (rnd() - 0.5) * 0.8, spin: (rnd() - 0.5) * 3,
        })
      }
      ctx.globalCompositeOperation = "source-over"
    }

    const drawMorganaImpact = (tk: number) => {
      const inHitstop = tk < T.HITSTOP
      const k = clamp01((tk - T.HITSTOP) / (T.IMPACT - T.HITSTOP))
      ctx.globalCompositeOperation = "lighter"

      // clarão central
      const coreA = inHitstop ? 1 : (1 - k) * 0.9
      blit(ctx, spW, tx, ty, inHitstop ? 95 : 95 + eoExpo(k) * 130, coreA)
      blit(ctx, spB, tx, ty, inHitstop ? 155 : 155 + eoExpo(k) * 240, coreA * 0.8)

      // ── O GRANDE RASGO — fenda elétrica serrilhada rasgando a tela ──
      const seedBase = Math.floor(tk / 42)
      const cutL = inHitstop ? 250 : 250 + eoExpo(k) * 190
      const fadeCut = inHitstop ? 1 : 1 - k * 0.8
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(morganaSlashAng)
      // abertura do rasgo (losango fino escuro — o "vácuo" do corte)
      ctx.globalCompositeOperation = "source-over"
      const gapH = (inHitstop ? 16 : 16 * (1 - k * 0.7)) * fadeCut
      if (gapH > 0.5) {
        ctx.fillStyle = `rgba(11,0,22,${0.9 * fadeCut})`
        ctx.beginPath()
        ctx.moveTo(-cutL, 0)
        ctx.quadraticCurveTo(0, -gapH, cutL, 0)
        ctx.quadraticCurveTo(0, gapH, -cutL, 0)
        ctx.fill()
      }
      ctx.globalCompositeOperation = "lighter"
      // bordas do rasgo: relâmpagos serrilhados espelhados
      bolt(ctx, -cutL, 0, cutL, 0, 18, 16, seedBase * 11 + 1, 6, `rgba(124,58,237,${0.6 * fadeCut})`)
      bolt(ctx, -cutL, 0, cutL, 0, 18, 13, seedBase * 11 + 2, 3, `rgba(168,85,247,${0.9 * fadeCut})`)
      bolt(ctx, -cutL, 0, cutL, 0, 18, 10, seedBase * 11 + 3, 1.6, `rgba(255,255,255,${0.98 * fadeCut})`)
      ctx.restore()

      // segundo rasgo cruzado — chega um instante depois
      if (!inHitstop && k > 0.1) {
        const k2 = clamp01((k - 0.1) / 0.9)
        const cut2 = eoExpo(k2) * 340
        ctx.save()
        ctx.translate(tx, ty)
        ctx.rotate(morganaSlashAng + Math.PI / 2.3)
        bolt(ctx, -cut2, 0, cut2, 0, 16, 11, seedBase * 17 + 5, 2.4, `rgba(216,180,254,${0.85 * (1 - k2)})`)
        bolt(ctx, -cut2, 0, cut2, 0, 16, 8, seedBase * 17 + 6, 1.2, `rgba(255,255,255,${0.9 * (1 - k2)})`)
        ctx.restore()
      }

      if (!inHitstop) {
        // ondas de choque roxas
        for (let i = 0; i < 5; i++) {
          const kk = clamp01(k * 1.35 - i * 0.09)
          if (kk <= 0) continue
          const r = eoExpo(kk) * (185 + i * 64)
          const alpha = (1 - kk) * (0.95 - i * 0.14)
          ring(ctx, tx, ty, r, Math.max(1, 11 - i * 2 - kk * 8), i < 2 ? `rgba(255,255,255,${alpha})` : `rgba(124,58,237,${alpha})`)
        }
        // aberração cromática
        const rC = eoExpo(k) * 225
        ring(ctx, tx - 4, ty, rC, 2, `rgba(255,60,60,${(1 - k) * 0.4})`)
        ring(ctx, tx + 4, ty, rC, 2, `rgba(60,60,255,${(1 - k) * 0.4})`)
        // RELÂMPAGOS RADIAIS estourando do centro
        const rrnd = mulberry(seedBase * 23)
        for (let i = 0; i < 8; i++) {
          if (rrnd() < 0.2) continue
          const a = i * (TAU / 8) + rrnd() * 0.5
          const L = eoExpo(k) * (110 + rrnd() * 110)
          bolt(
            ctx, tx + Math.cos(a) * L * 0.15, ty + Math.sin(a) * L * 0.15,
            tx + Math.cos(a) * L, ty + Math.sin(a) * L,
            6, 13, seedBase * 41 + i * 19, i % 3 === 0 ? 2.6 : 1.4,
            `rgba(${i % 2 ? "216,180,254" : "255,255,255"},${(1 - k) * 0.9})`,
          )
        }
        // ── CÍRCULO DE NOTAS — partitura mágica se expandindo ──
        const sg = clamp01(k * 1.5)
        const sgA = sg < 0.7 ? 1 : 1 - (sg - 0.7) / 0.3
        const NR = eoBack(clamp01(sg * 1.3)) * 140
        if (NR > 6) {
          ring(ctx, tx, ty, NR, 2, `rgba(168,85,247,${0.7 * sgA})`)
          ring(ctx, tx, ty, NR * 0.8, 1, `rgba(255,255,255,${0.45 * sgA})`)
          // pauta circular tracejada
          ctx.setLineDash([3, 9])
          ring(ctx, tx, ty, NR * 0.9, 1.2, `rgba(216,180,254,${0.6 * sgA})`)
          ctx.setLineDash([])
          const rot = k * 1.8
          for (let i = 0; i < 8; i++) {
            const a = rot + i * (TAU / 8)
            musicNote(ctx, tx + Math.cos(a) * NR, ty + Math.sin(a) * NR, 13, a + Math.PI / 2, 0.95 * sgA, i % 2 ? "rgba(216,180,254,1)" : "rgba(255,255,255,1)", i % 4 === 0)
          }
        }
      }
      ctx.globalCompositeOperation = "source-over"
    }

    const drawMorganaAftermath = (k: number, now: number) => {
      const t = now * 0.001
      ctx.globalCompositeOperation = "lighter"
      blit(ctx, spB, tx, ty, 76 * (1 - k), (1 - k) * 0.5)
      // rasgo residual crepitando e encolhendo
      if (k < 0.65) {
        const rk = k / 0.65
        const L = 260 * (1 - rk * 0.4)
        const seedBase = Math.floor(now / 60)
        ctx.save()
        ctx.translate(tx, ty)
        ctx.rotate(morganaSlashAng)
        const flick = 0.55 + 0.45 * Math.sin(t * 34)
        bolt(ctx, -L, 0, L, 0, 16, 9 * (1 - rk), seedBase * 7 + 2, 2, `rgba(168,85,247,${(1 - rk) * 0.85 * flick})`)
        bolt(ctx, -L, 0, L, 0, 16, 6 * (1 - rk), seedBase * 7 + 3, 1, `rgba(255,255,255,${(1 - rk) * 0.7 * flick})`)
        ctx.restore()
        // fagulhas elétricas estalando do rasgo
        const srnd = mulberry(seedBase * 13)
        for (let i = 0; i < 3; i++) {
          if (srnd() < 0.5) continue
          const q = (srnd() - 0.5) * 2
          const bx = tx + Math.cos(morganaSlashAng) * q * L
          const by = ty + Math.sin(morganaSlashAng) * q * L
          const ba = srnd() * TAU
          const bL2 = 16 + srnd() * 34
          bolt(ctx, bx, by, bx + Math.cos(ba) * bL2, by + Math.sin(ba) * bL2, 4, 8, seedBase * 19 + i * 7, 1.2, `rgba(216,180,254,${(1 - rk) * 0.8})`)
        }
      }
      // notas musicais subindo em cascata (a melodia final)
      if (k < 0.92) {
        for (let i = 0; i < 7; i++) {
          const fr = (t * 0.55 + i / 7) % 1
          const mx = tx + ((i % 4) - 1.5) * 46 + Math.sin(t * 2.2 + i * 1.7) * 16
          const my = ty - 10 - fr * 130
          const al = (1 - fr) * (1 - k) * 0.9
          musicNote(ctx, mx, my, 9 + (i % 3) * 3.5, Math.sin(t * 3 + i) * 0.45, al, i % 2 ? "rgba(216,180,254,1)" : "rgba(168,85,247,1)", i % 3 === 0)
        }
      }
      // anéis finais dissipando
      for (let i = 0; i < 2; i++) {
        const rk = clamp01(k * 1.2 - i * 0.15)
        if (rk <= 0) continue
        ring(ctx, tx, ty, eoExpo(rk) * (130 + i * 70), 1.6, `rgba(167,139,250,${(1 - rk) * (0.55 - i * 0.2)})`)
      }
      ctx.globalCompositeOperation = "source-over"
    }

    // ═══════ CALEM HIDENORI — ESFERA DO VAZIO CINZA PRATEADA ═══════
    /** Desenha a esfera do vazio: núcleo negro absoluto com aro prateado e reflexo especular */
    const voidSphere = (x: number, y: number, R: number, glow: number) => {
      // halo de distorção prateado
      blit(ctx, spB, x, y, R * 3, 0.75 * glow)
      blit(ctx, spC, x, y, R * 1.8, 0.8 * glow)
      // núcleo negro (horizonte de eventos)
      ctx.globalCompositeOperation = "source-over"
      const core = ctx.createRadialGradient(x, y, 0, x, y, R)
      core.addColorStop(0, "#000000")
      core.addColorStop(0.75, "#05070c")
      core.addColorStop(1, "#0f172a")
      ctx.fillStyle = core
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill()
      ctx.globalCompositeOperation = "lighter"
      // aro prateado brilhante
      ring(ctx, x, y, R + 1.5, 2.6, `rgba(226,232,240,${0.95 * glow})`)
      ring(ctx, x, y, R + 5, 1, `rgba(148,163,184,${0.55 * glow})`)
      // reflexo especular — a "prata" da esfera
      blit(ctx, spW, x - R * 0.4, y - R * 0.45, R * 0.32, 0.95 * glow)
    }

    const drawCalemCharge = (k: number, now: number) => {
      const t = now * 0.001
      const grow = eoCubic(k)
      // escuridão ambiente — o vazio drena a luz ao redor
      ctx.globalCompositeOperation = "source-over"
      const dark = ctx.createRadialGradient(sx, sy, 0, sx, sy, 320)
      dark.addColorStop(0, `rgba(2,4,8,${0.5 * k})`)
      dark.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = dark
      ctx.fillRect(sx - 320, sy - 320, 640, 640)

      ctx.globalCompositeOperation = "lighter"
      // poeira prateada sendo sugada em espiral
      for (let i = 0; i < 16; i++) {
        const frac = 1 - ((t * 2 + i * 0.618) % 1)
        const a = i * (TAU / 16) + t * 2.4 + (1 - frac) * 2.6
        const r = frac * 128
        blit(ctx, i % 2 ? spC : spW, sx + Math.cos(a) * r, sy + Math.sin(a) * r, 3.5 + (1 - frac) * 7, (1 - frac) * 0.9 * k)
      }
      // anéis de distorção colapsando (lente gravitacional)
      for (let i = 0; i < 4; i++) {
        const fr = 1 - ((t * 1.6 + i / 4) % 1)
        ring(ctx, sx, sy, fr * 132, 2 + (1 - fr) * 1.5, `rgba(203,213,225,${(1 - fr) * 0.7 * k})`)
      }
      // ── A ESFERA DO VAZIO se materializando ──
      const R = (10 + 26 * grow) * (1 + Math.sin(t * 18) * 0.06)
      voidSphere(sx, sy, R, grow)
      // arcos orbitais prateados inclinados girando ao redor
      for (let i = 0; i < 3; i++) {
        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(t * (1.4 + i * 0.5) * (i % 2 ? -1 : 1) + i * 2.1)
        ctx.scale(1, 0.32 + i * 0.1)
        ring(ctx, 0, 0, R + 10 + i * 8, 1.4, `rgba(${i % 2 ? "203,213,225" : "148,163,184"},${(0.75 - i * 0.15) * grow})`)
        ctx.restore()
      }
      // fiapos de realidade rasgada crepitando ao redor
      const fseed = Math.floor(now / 55)
      const frnd = mulberry(fseed)
      for (let i = 0; i < 5; i++) {
        if (frnd() < 0.4) continue
        const a = frnd() * TAU
        const r1 = R + 8 + frnd() * 46 * grow
        bolt(
          ctx, sx + Math.cos(a) * r1, sy + Math.sin(a) * r1,
          sx + Math.cos(a + 0.7) * (r1 + 12), sy + Math.sin(a + 0.7) * (r1 + 12),
          4, 7, fseed * 9 + i * 37, 1.2, `rgba(226,232,240,${0.7 * k})`,
        )
      }
      ctx.globalCompositeOperation = "source-over"
      // imagem residual do atacante
      if (atkImg && atkImg.complete && atkImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.4 * (1 - k)
        ctx.drawImage(atkImg, sx - 42, sy - 58, 84, 116)
        ctx.globalAlpha = 1
      }
    }

    const drawCalemStrike = (k: number, now: number) => {
      const t = now * 0.001
      const p = eiCubic(k) * 0.35 + k * 0.65
      const pos = { x: sx + cosA * dist * p, y: sy + sinA * dist * p }
      trail.push({ x: pos.x, y: pos.y })
      if (trail.length > 26) trail.shift()

      ctx.globalCompositeOperation = "lighter"
      // linhas de velocidade prateadas
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(ang)
      for (let i = 0; i < 12; i++) {
        const off = (i - 5.5) * 26
        const len = 140 + ((i * 53) % 160)
        const xw = p * (dist + 520) - len - ((i * 97) % 240)
        ctx.strokeStyle = `rgba(148,163,184,${0.2 - Math.abs(i - 5.5) * 0.02})`
        ctx.lineWidth = Math.abs(i - 5.5) < 1.5 ? 3 : 1.5
        ctx.beginPath(); ctx.moveTo(xw, off); ctx.lineTo(xw + len, off); ctx.stroke()
      }
      ctx.restore()

      // rastro: espaço "descosturado" — afterimages escuras onde a esfera passou
      ctx.globalCompositeOperation = "source-over"
      for (let i = 0; i < trail.length; i++) {
        const f = i / trail.length
        const rr = 3 + f * 15
        const g2 = ctx.createRadialGradient(trail[i].x, trail[i].y, 0, trail[i].x, trail[i].y, rr)
        g2.addColorStop(0, `rgba(2,4,8,${f * 0.75})`)
        g2.addColorStop(1, "rgba(2,4,8,0)")
        ctx.fillStyle = g2
        ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, rr, 0, TAU); ctx.fill()
      }
      ctx.globalCompositeOperation = "lighter"
      for (let i = 0; i < trail.length; i++) {
        const f = i / trail.length
        blit(ctx, spC, trail[i].x, trail[i].y, 4 + f * 18, f * 0.4)
      }

      // ── A ESFERA DO VAZIO em voo ──
      const R = 20 + p * 8
      voidSphere(pos.x, pos.y, R, 1)
      // anel de acreção girando com o voo
      ctx.save()
      ctx.translate(pos.x, pos.y)
      ctx.rotate(ang + Math.sin(t * 10) * 0.3)
      ctx.scale(1, 0.34)
      ring(ctx, 0, 0, R + 11, 1.6, "rgba(203,213,225,.85)")
      ctx.restore()
      // fragmentos prateados orbitando
      for (let i = 0; i < 4; i++) {
        const a = t * 15 + i * (TAU / 4)
        blit(ctx, spC, pos.x + Math.cos(a) * (R + 9), pos.y + Math.sin(a) * (R + 9) * 0.5, 4, 0.85)
      }
      // crepitar do vazio na cabeça
      const fseed = Math.floor(now / 45)
      const frnd = mulberry(fseed)
      for (let i = 0; i < 3; i++) {
        if (frnd() < 0.35) continue
        const a = frnd() * TAU
        const L2 = R + 16 + frnd() * 18
        bolt(
          ctx, pos.x + Math.cos(a) * R, pos.y + Math.sin(a) * R,
          pos.x + Math.cos(a) * L2, pos.y + Math.sin(a) * L2,
          4, 6, fseed * 11 + i * 23, 1.2, "rgba(226,232,240,.85)",
        )
      }

      // partículas sugadas para dentro da esfera (o vazio se alimenta)
      if (!reduced && rnd() < 0.95) {
        const a = rnd() * TAU
        const rr = 40 + rnd() * 30
        pts.push({
          x: pos.x + Math.cos(a) * rr, y: pos.y + Math.sin(a) * rr,
          vx: -Math.cos(a) * 220 - cosA * 120, vy: -Math.sin(a) * 220 - sinA * 120,
          ax: 0, ay: 0, drag: 0.94,
          age: 0, life: 200 + rnd() * 160, size: 2 + rnd() * 3,
          r: 203, g: 213, b: 225, kind: "glow", seed: rnd(), rot: 0, spin: 0,
        })
      }
      ctx.globalCompositeOperation = "source-over"
    }

    const drawCalemImpact = (tk: number) => {
      const inHitstop = tk < T.HITSTOP
      const k = clamp01((tk - T.HITSTOP) / (T.IMPACT - T.HITSTOP))
      ctx.globalCompositeOperation = "lighter"

      if (inHitstop) {
        // ── IMPLOSÃO — tudo é sugado para um ponto antes da explosão ──
        const ik = tk / T.HITSTOP
        const R = 26 * (1 - ik * 0.7)
        // linhas de sucção convergindo
        for (let i = 0; i < 14; i++) {
          const a = i * (TAU / 14) + 0.3
          const L = 150 * (1 - ik)
          ctx.strokeStyle = `rgba(203,213,225,${0.85 * (1 - ik * 0.4)})`
          ctx.lineWidth = i % 3 === 0 ? 2.5 : 1.2
          ctx.beginPath()
          ctx.moveTo(tx + Math.cos(a) * (R + L), ty + Math.sin(a) * (R + L))
          ctx.lineTo(tx + Math.cos(a) * (R + 4), ty + Math.sin(a) * (R + 4))
          ctx.stroke()
        }
        // esfera comprimindo, brilhando ao máximo
        blit(ctx, spW, tx, ty, R * 2.4, 1)
        ctx.globalCompositeOperation = "source-over"
        ctx.beginPath(); ctx.arc(tx, ty, R, 0, TAU)
        ctx.fillStyle = "#000"; ctx.fill()
        ctx.globalCompositeOperation = "lighter"
        ring(ctx, tx, ty, R + 2, 3, "rgba(255,255,255,1)")
        ctx.globalCompositeOperation = "source-over"
        return
      }

      // ── EXPLOSÃO DO VAZIO ──
      const coreA = (1 - k) * 0.95
      blit(ctx, spW, tx, ty, 100 + eoExpo(k) * 150, coreA)
      blit(ctx, spB, tx, ty, 170 + eoExpo(k) * 260, coreA * 0.8)

      // DOMO DO VAZIO — esfera negra se expandindo que "come" a cena
      ctx.globalCompositeOperation = "source-over"
      const VR = eoExpo(k) * 190
      const va = k < 0.55 ? 0.92 : 0.92 * (1 - (k - 0.55) / 0.45)
      if (VR > 2 && va > 0.01) {
        const vg = ctx.createRadialGradient(tx, ty, 0, tx, ty, VR)
        vg.addColorStop(0, `rgba(0,0,0,${va})`)
        vg.addColorStop(0.72, `rgba(3,6,12,${va * 0.9})`)
        vg.addColorStop(1, "rgba(15,23,42,0)")
        ctx.fillStyle = vg
        ctx.beginPath(); ctx.arc(tx, ty, VR, 0, TAU); ctx.fill()
        // borda prateada do domo
        ctx.globalCompositeOperation = "lighter"
        ring(ctx, tx, ty, VR, 4, `rgba(226,232,240,${va})`)
        ring(ctx, tx, ty, VR * 0.9, 1.4, `rgba(148,163,184,${va * 0.6})`)
      }
      ctx.globalCompositeOperation = "lighter"

      // ondas de choque prateadas
      for (let i = 0; i < 5; i++) {
        const kk = clamp01(k * 1.35 - i * 0.09)
        if (kk <= 0) continue
        const r = eoExpo(kk) * (200 + i * 70)
        const alpha = (1 - kk) * (0.95 - i * 0.14)
        ring(ctx, tx, ty, r, Math.max(1, 11 - i * 2 - kk * 8), i < 2 ? `rgba(255,255,255,${alpha})` : `rgba(148,163,184,${alpha})`)
      }
      // aberração cromática
      const rC = eoExpo(k) * 240
      ring(ctx, tx - 5, ty, rC, 2, `rgba(255,60,60,${(1 - k) * 0.45})`)
      ring(ctx, tx + 5, ty, rC, 2, `rgba(60,60,255,${(1 - k) * 0.45})`)
      // lanças de luz prateada radiais
      for (let i = 0; i < 16; i++) {
        const a = i * (TAU / 16) + 0.2
        const L = eoExpo(k) * (170 + ((i * 41) % 110))
        ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * (i % 4 === 0 ? 0.95 : 0.5)})`
        ctx.lineWidth = i % 4 === 0 ? 4 : 1.8
        ctx.beginPath()
        ctx.moveTo(tx + Math.cos(a) * L * 0.3, ty + Math.sin(a) * L * 0.3)
        ctx.lineTo(tx + Math.cos(a) * L, ty + Math.sin(a) * L)
        ctx.stroke()
      }
      // rachaduras de realidade — fendas serrilhadas prateadas
      const seedBase = Math.floor(tk / 44)
      const crnd = mulberry(seedBase * 21)
      for (let i = 0; i < 7; i++) {
        if (crnd() < 0.22) continue
        const a = i * (TAU / 7) + crnd() * 0.6
        const L = eoExpo(k) * (120 + crnd() * 130)
        bolt(
          ctx, tx + Math.cos(a) * L * 0.12, ty + Math.sin(a) * L * 0.12,
          tx + Math.cos(a) * L, ty + Math.sin(a) * L,
          6, 14, seedBase * 37 + i * 13, i % 2 === 0 ? 2.4 : 1.3,
          `rgba(${i % 2 ? "226,232,240" : "255,255,255"},${(1 - k) * 0.9})`,
        )
      }
      // anel de acreção — halo achatado girando se expandindo
      const sg = clamp01(k * 1.5)
      const sgA = sg < 0.7 ? 1 : 1 - (sg - 0.7) / 0.3
      const AR = eoBack(clamp01(sg * 1.3)) * 150
      if (AR > 6) {
        ctx.save()
        ctx.translate(tx, ty)
        ctx.rotate(k * 1.6)
        ctx.scale(1, 0.38)
        ring(ctx, 0, 0, AR, 3, `rgba(226,232,240,${0.85 * sgA})`)
        ctx.setLineDash([4, 10])
        ring(ctx, 0, 0, AR * 0.82, 1.5, `rgba(148,163,184,${0.7 * sgA})`)
        ctx.setLineDash([])
        for (let i = 0; i < 10; i++) {
          const a = k * 3 + i * (TAU / 10)
          blit(ctx, spW, Math.cos(a) * AR, Math.sin(a) * AR, 4 * sgA, 0.9 * sgA)
        }
        ctx.restore()
      }
      ctx.globalCompositeOperation = "source-over"
    }

    const drawCalemAftermath = (k: number, now: number) => {
      const t = now * 0.001
      // resíduo do vazio — mini-singularidade colapsando
      const R = 24 * (1 - eoCubic(k))
      ctx.globalCompositeOperation = "source-over"
      if (R > 1) {
        const vg = ctx.createRadialGradient(tx, ty, 0, tx, ty, R * 2.4)
        vg.addColorStop(0, `rgba(0,0,0,${(1 - k) * 0.9})`)
        vg.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = vg
        ctx.beginPath(); ctx.arc(tx, ty, R * 2.4, 0, TAU); ctx.fill()
      }
      ctx.globalCompositeOperation = "lighter"
      if (R > 1) {
        ring(ctx, tx, ty, R + 2, 2, `rgba(226,232,240,${(1 - k) * (0.7 + 0.3 * Math.sin(t * 26))})`)
        blit(ctx, spW, tx - R * 0.4, ty - R * 0.4, R * 0.3, 1 - k)
      }
      blit(ctx, spB, tx, ty, 70 * (1 - k), (1 - k) * 0.45)
      // poeira prateada sendo sugada de volta para a singularidade
      if (k < 0.85) {
        for (let i = 0; i < 10; i++) {
          const fr = (t * 1.1 + i / 10) % 1
          const a = i * (TAU / 10) + t * 1.6
          const rr = (1 - fr) * 110 * (1 - k * 0.5)
          blit(ctx, i % 2 ? spC : spW, tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, 3 + (1 - fr) * 3, (1 - fr) * (1 - k) * 0.85)
        }
      }
      // fendas residuais crepitando e sumindo
      if (k < 0.55) {
        const seedBase = Math.floor(now / 70)
        const srnd = mulberry(seedBase * 17)
        for (let i = 0; i < 3; i++) {
          if (srnd() < 0.45) continue
          const a = srnd() * TAU
          const L = 30 + srnd() * 60
          bolt(
            ctx, tx + Math.cos(a) * 12, ty + Math.sin(a) * 12,
            tx + Math.cos(a) * L, ty + Math.sin(a) * L,
            4, 9, seedBase * 23 + i * 11, 1.2, `rgba(203,213,225,${(1 - k / 0.55) * 0.8})`,
          )
        }
      }
      // anel de acreção se dissipando
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(t * 0.9)
      ctx.scale(1, 0.38)
      ring(ctx, 0, 0, 90 + k * 60, 1.6, `rgba(148,163,184,${(1 - k) * 0.5})`)
      ctx.restore()
      // anéis finais dissipando
      for (let i = 0; i < 2; i++) {
        const rk = clamp01(k * 1.2 - i * 0.15)
        if (rk <= 0) continue
        ring(ctx, tx, ty, eoExpo(rk) * (140 + i * 70), 1.6, `rgba(203,213,225,${(1 - rk) * (0.5 - i * 0.18)})`)
      }
      ctx.globalCompositeOperation = "source-over"
    }

    // ═════════════════════════ LOOP PRINCIPAL ════════════════════════════════
    const frame = (now: number) => {
      if (done) return
      const t = now - start
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const w = window.innerWidth
      const hgt = window.innerHeight

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, hgt)

      // screen shake durante o impacto (após o hitstop)
      let shX = 0, shY = 0
      if (!reduced && t >= C2 + T.HITSTOP && t < C3) {
        const sk = 1 - (t - C2 - T.HITSTOP) / (T.IMPACT - T.HITSTOP)
        const amp = (isCalem ? 22 : isFehnon || isMorgana ? 19 : 13) * sk * sk
        shX = Math.sin(t * 0.09) * amp
        shY = Math.cos(t * 0.117) * amp
      }
      ctx.translate(shX, shY)

      if (t < C0) {
        if (isFehnon) drawFehnonCharge(clamp01(t / C0), now)
        else if (isMorgana) drawMorganaCharge(clamp01(t / C0), now)
        else if (isCalem) drawCalemCharge(clamp01(t / C0), now)
        else drawCharge(clamp01(t / C0), now)
      } else if (t < C1) {
        drawRelease(clamp01((t - C0) / T.RELEASE))
      } else if (t < C2) {
        if (isFehnon) drawFehnonStrike(clamp01((t - C1) / T.STRIKE), now)
        else if (isMorgana) drawMorganaStrike(clamp01((t - C1) / T.STRIKE), now)
        else if (isCalem) drawCalemStrike(clamp01((t - C1) / T.STRIKE), now)
        else drawStrike(clamp01((t - C1) / T.STRIKE), now)
      } else if (t < C3) {
        if (!impactFired) {
          impactFired = true
          burst()
          cbRef.current.onImpact?.(id, tx, ty, el)
        }
        if (isFehnon) drawFehnonImpact(t - C2)
        else if (isMorgana) drawMorganaImpact(t - C2)
        else if (isCalem) drawCalemImpact(t - C2)
        else drawImpact(t - C2)
      } else if (t < T.TOTAL) {
        if (isFehnon) drawFehnonAftermath(clamp01((t - C3) / T.AFTERMATH), now)
        else if (isMorgana) drawMorganaAftermath(clamp01((t - C3) / T.AFTERMATH), now)
        else if (isCalem) drawCalemAftermath(clamp01((t - C3) / T.AFTERMATH), now)
        else drawAftermath(clamp01((t - C3) / T.AFTERMATH), now)
      }

      drawParticles(dt)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawScreenFX(t, w, hgt)

      if (t >= T.TOTAL && pts.length === 0) {
        done = true
        cbRef.current.onComplete(id)
        return
      }
      if (t >= T.TOTAL + 600) {
        // salvaguarda: nunca deixar a animação viva demais
        done = true
        cbRef.current.onComplete(id)
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      done = true
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, id])

  if (!mounted) return null
  const node = (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 10000 }}
    />
  )
  if (portalTarget) return createPortal(node, portalTarget)
  if (typeof document !== "undefined") return createPortal(node, document.body)
  return null
}
