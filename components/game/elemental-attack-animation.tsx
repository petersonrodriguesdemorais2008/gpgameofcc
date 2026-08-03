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
type Kind = "glow" | "flame" | "shard" | "glitter" | "swirl" | "wisp"
interface Pt {
  x: number; y: number; vx: number; vy: number
  ax: number; ay: number; drag: number
  age: number; life: number; size: number
  r: number; g: number; b: number
  kind: Kind; seed: number; rot: number; spin: number
}

export function ElementalAttackAnimation({
  id, startX, startY, targetX, targetY, element, attackerImage,
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
    const E = normalizeElement(el)
    const P = pal(el)
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
          ctx.fillStyle = E === "darkness" ? `rgba(20,4,36,${flash})` : `rgba(255,255,255,${flash * 0.75})`
          ctx.fillRect(0, 0, w, hgt)
        }
        const tint = 0.22 * (1 - ik)
        if (tint > 0.01) {
          ctx.fillStyle = `rgba(${P.rgb},${tint})`
          ctx.fillRect(0, 0, w, hgt)
        }
      }
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
        const amp = 13 * sk * sk
        shX = Math.sin(t * 0.09) * amp
        shY = Math.cos(t * 0.117) * amp
      }
      ctx.translate(shX, shY)

      if (t < C0) {
        drawCharge(clamp01(t / C0), now)
      } else if (t < C1) {
        drawRelease(clamp01((t - C0) / T.RELEASE))
      } else if (t < C2) {
        drawStrike(clamp01((t - C1) / T.STRIKE), now)
      } else if (t < C3) {
        if (!impactFired) {
          impactFired = true
          burst()
          cbRef.current.onImpact?.(id, tx, ty, el)
        }
        drawImpact(t - C2)
      } else if (t < T.TOTAL) {
        drawAftermath(clamp01((t - C3) / T.AFTERMATH), now)
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
