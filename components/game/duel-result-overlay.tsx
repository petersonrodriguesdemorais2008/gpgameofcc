"use client"

/**
 * DUEL RESULT OVERLAY — tela cinematográfica de Vitória/Derrota.
 *
 * Componente puramente visual e compartilhado entre o duelo offline
 * (duel-screen) e o online (online-duel-screen). A concessão de recompensas
 * fica no chamador; aqui só orquestramos a apresentação:
 *
 *  Vitória: flash → god rays dourados → título letra a letra com impacto →
 *  shockwave + confete físico (fitas 3D, estrelas, fogos) → recompensas em
 *  cascata com contadores animados.
 *
 *  Derrota: fade sombrio → cinzas e brasas caindo → título com peso.
 */

import { useEffect, useRef, useState } from "react"
import { CHESTS, type ChestId } from "@/lib/chests"
import { FRAGMENTS, type FragmentCounts, type FragmentId } from "@/lib/fragments"
import { XP_BOOKS, type XPBookId } from "@/lib/xp-books"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DuelResultRewards {
  gacha: number
  gear: number
  fragments?: FragmentCounts
  chest: ChestId | null
}

export interface DuelResultMasterXP {
  masterName: string
  xpGain: number
  newLevel: number
  leveledUp: boolean
}

interface DuelResultOverlayProps {
  result: "won" | "lost"
  onBack: () => void
  rewards?: DuelResultRewards | null
  masterXP?: DuelResultMasterXP | null
  /** Livro de XP dropado — só em vitórias de Duelos do Modo Campanha. */
  xpBookDrop?: { id: XPBookId; amount: number } | null
}

// ─── Contador animado (count-up) ─────────────────────────────────────────────

function CountUp({ value, delay = 0, duration = 900 }: { value: number; delay?: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf = 0
    let start = 0
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts
        const t = Math.min((ts - start) / duration, 1)
        // easeOutExpo
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
        setDisplay(Math.round(eased * value))
        if (t < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [value, delay, duration])
  return <>{display}</>
}

// ─── Motor de partículas (canvas, DPR-aware) ─────────────────────────────────

function useResultParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>, isWon: boolean) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0, H = 0
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    const GOLD = ["#ffd700", "#ffe55c", "#fff3b0", "#fbbf24", "#f59e0b", "#ffffff"]
    const JEWEL = ["#4ade80", "#c084fc", "#67e8f9", "#f472b6"]
    const ASH = ["#ef4444", "#b91c1c", "#7f1d1d", "#f97316", "#57534e", "#78716c"]

    // Confete-fita: retângulo que "vira" em 3D via scaleY senoidal
    type Ribbon = {
      x: number; y: number; vx: number; vy: number
      w: number; h: number; rot: number; rotV: number
      flip: number; flipV: number; color: string; alpha: number
      sway: number; swayV: number
    }
    // Faísca/brasa circular com brilho
    type Spark = {
      x: number; y: number; vx: number; vy: number
      size: number; alpha: number; decay: number; color: string
      gravity: number; drag: number; twinkle: number
    }
    // Estrela girante
    type Star = {
      x: number; y: number; vx: number; vy: number
      size: number; alpha: number; decay: number; color: string; spin: number; spinV: number
    }
    // Foguete de fogos de artifício
    type Rocket = { x: number; y: number; vy: number; targetY: number; color: string; trail: { x: number; y: number; a: number }[] }

    const ribbons: Ribbon[] = []
    const sparks: Spark[] = []
    const stars: Star[] = []
    const rockets: Rocket[] = []

    function spawnRibbon(x: number, y: number, burst: boolean) {
      const pool = Math.random() < 0.75 ? GOLD : JEWEL
      ribbons.push({
        x, y,
        vx: burst ? (Math.random() - 0.5) * 14 : (Math.random() - 0.5) * 1.4,
        vy: burst ? -(4 + Math.random() * 10) : 0.6 + Math.random() * 1.4,
        w: 7 + Math.random() * 8, h: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.25,
        flip: Math.random() * Math.PI * 2, flipV: 0.08 + Math.random() * 0.16,
        color: pool[Math.floor(Math.random() * pool.length)],
        alpha: 1,
        sway: Math.random() * Math.PI * 2, swayV: 0.02 + Math.random() * 0.03,
      })
    }

    function explode(cx: number, cy: number, count: number, colors: string[], power: number) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = (0.5 + Math.random()) * power
        sparks.push({
          x: cx, y: cy,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          size: 1.5 + Math.random() * 3.5,
          alpha: 1, decay: 0.008 + Math.random() * 0.012,
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity: 0.05, drag: 0.975,
          twinkle: Math.random() * Math.PI * 2,
        })
      }
      // algumas estrelas grandes
      if (isWon) {
        for (let i = 0; i < Math.floor(count / 6); i++) {
          const a = Math.random() * Math.PI * 2
          const sp = (0.4 + Math.random() * 0.7) * power
          stars.push({
            x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
            size: 6 + Math.random() * 8, alpha: 1, decay: 0.010 + Math.random() * 0.008,
            color: GOLD[Math.floor(Math.random() * GOLD.length)],
            spin: Math.random() * Math.PI * 2, spinV: (Math.random() - 0.5) * 0.2,
          })
        }
      }
    }

    function launchRocket() {
      const x = W * (0.15 + Math.random() * 0.7)
      rockets.push({
        x, y: H + 10, vy: -(9 + Math.random() * 4),
        targetY: H * (0.18 + Math.random() * 0.3),
        color: GOLD[Math.floor(Math.random() * GOLD.length)],
        trail: [],
      })
    }

    function drawStarShape(cx: number, cy: number, r: number, spin: number) {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = spin + (i / 10) * Math.PI * 2
        const rad = i % 2 === 0 ? r : r * 0.42
        i === 0 ? ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
                : ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
      }
      ctx.closePath()
    }

    // ── Coreografia inicial ──
    const timers: ReturnType<typeof setTimeout>[] = []
    if (isWon) {
      // explosão central sincronizada com o pouso do título
      timers.push(setTimeout(() => explode(W / 2, H * 0.38, 90, GOLD, 9), 620))
      timers.push(setTimeout(() => explode(W / 2, H * 0.38, 50, JEWEL, 6), 760))
      // canhões de confete das laterais inferiores
      timers.push(setTimeout(() => {
        for (let i = 0; i < 55; i++) {
          const r1 = { x: -10, y: H * 0.9 }
          ribbons.push({
            x: r1.x, y: r1.y,
            vx: 5 + Math.random() * 11, vy: -(9 + Math.random() * 9),
            w: 7 + Math.random() * 8, h: 4 + Math.random() * 5,
            rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.25,
            flip: Math.random() * Math.PI * 2, flipV: 0.08 + Math.random() * 0.16,
            color: (Math.random() < 0.75 ? GOLD : JEWEL)[Math.floor(Math.random() * 4)],
            alpha: 1, sway: Math.random() * Math.PI * 2, swayV: 0.02 + Math.random() * 0.03,
          })
        }
      }, 700))
      timers.push(setTimeout(() => {
        for (let i = 0; i < 55; i++) {
          ribbons.push({
            x: W + 10, y: H * 0.9,
            vx: -(5 + Math.random() * 11), vy: -(9 + Math.random() * 9),
            w: 7 + Math.random() * 8, h: 4 + Math.random() * 5,
            rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.25,
            flip: Math.random() * Math.PI * 2, flipV: 0.08 + Math.random() * 0.16,
            color: (Math.random() < 0.75 ? GOLD : JEWEL)[Math.floor(Math.random() * 4)],
            alpha: 1, sway: Math.random() * Math.PI * 2, swayV: 0.02 + Math.random() * 0.03,
          })
        }
      }, 850))
      timers.push(setTimeout(launchRocket, 1400))
      timers.push(setTimeout(launchRocket, 2100))
    } else {
      timers.push(setTimeout(() => explode(W / 2, H * 0.38, 36, ASH, 4), 620))
    }

    let frame = 0
    let raf = 0
    function tick() {
      raf = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, W, H)
      frame++

      if (isWon) {
        // chuva contínua de confete
        if (frame % 5 === 0) spawnRibbon(Math.random() * W, -20, false)
        // foguetes ocasionais
        if (frame % 300 === 0) launchRocket()
      } else {
        // cinzas caindo devagar
        if (frame % 6 === 0) {
          sparks.push({
            x: Math.random() * W, y: -10,
            vx: (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random() * 1.2,
            size: 1 + Math.random() * 2.6,
            alpha: 0.35 + Math.random() * 0.5, decay: 0.0022 + Math.random() * 0.003,
            color: ASH[Math.floor(Math.random() * ASH.length)],
            gravity: 0.004, drag: 0.999,
            twinkle: Math.random() * Math.PI * 2,
          })
        }
        // brasas subindo do rodapé
        if (frame % 14 === 0) {
          sparks.push({
            x: Math.random() * W, y: H + 6,
            vx: (Math.random() - 0.5) * 0.4, vy: -(0.5 + Math.random() * 1.1),
            size: 1 + Math.random() * 1.8,
            alpha: 0.6 + Math.random() * 0.4, decay: 0.004 + Math.random() * 0.004,
            color: Math.random() < 0.6 ? "#f97316" : "#ef4444",
            gravity: -0.002, drag: 0.998,
            twinkle: Math.random() * Math.PI * 2,
          })
        }
      }

      // ── Foguetes ──
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.trail.push({ x: r.x, y: r.y, a: 0.9 })
        if (r.trail.length > 14) r.trail.shift()
        r.y += r.vy
        r.x += Math.sin(frame * 0.15 + i) * 0.6
        for (const t of r.trail) {
          t.a -= 0.06
          if (t.a > 0) {
            ctx.globalAlpha = t.a
            ctx.fillStyle = r.color
            ctx.beginPath(); ctx.arc(t.x, t.y, 1.6, 0, Math.PI * 2); ctx.fill()
          }
        }
        ctx.globalAlpha = 1
        if (r.y <= r.targetY) {
          explode(r.x, r.y, 70, Math.random() < 0.5 ? GOLD : JEWEL, 7)
          rockets.splice(i, 1)
        }
      }

      // ── Fitas de confete ──
      for (let i = ribbons.length - 1; i >= 0; i--) {
        const p = ribbons[i]
        p.sway += p.swayV
        p.x += p.vx + Math.sin(p.sway) * 1.1
        p.y += p.vy
        p.vy = Math.min(p.vy + 0.12, 3.2) // terminal velocity
        p.vx *= 0.985
        p.rot += p.rotV
        p.flip += p.flipV
        if (p.y > H + 30) { ribbons.splice(i, 1); continue }
        const flipScale = Math.abs(Math.sin(p.flip)) * 0.9 + 0.1
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.scale(1, flipScale)
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        // face mais escura quando "de lado" simula luz
        if (Math.sin(p.flip) < 0) {
          ctx.globalAlpha = p.alpha * 0.65
        }
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      // ── Faíscas / brasas ──
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        p.x += p.vx; p.y += p.vy
        p.vy += p.gravity
        p.vx *= p.drag; p.vy *= p.drag
        p.alpha -= p.decay
        p.twinkle += 0.2
        if (p.alpha <= 0 || p.y > H + 30 || p.y < -40) { sparks.splice(i, 1); continue }
        const tw = 0.7 + 0.3 * Math.sin(p.twinkle)
        ctx.save()
        ctx.globalAlpha = p.alpha * tw
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = isWon ? 8 : 5
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }

      // ── Estrelas ──
      for (let i = stars.length - 1; i >= 0; i--) {
        const p = stars[i]
        p.x += p.vx; p.y += p.vy
        p.vy += 0.07; p.vx *= 0.985
        p.spin += p.spinV
        p.alpha -= p.decay
        if (p.alpha <= 0 || p.y > H + 30) { stars.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 12
        drawStarShape(p.x, p.y, p.size / 2, p.spin)
        ctx.fill()
        ctx.restore()
      }
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      window.removeEventListener("resize", resize)
    }
  }, [canvasRef, isWon])
}

// ─── Componente principal ────────────────────────────────────────────────────

export function DuelResultOverlay({ result, onBack, rewards, masterXP, xpBookDrop }: DuelResultOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isWon = result === "won"
  useResultParticles(canvasRef, isWon)

  const col = isWon ? "#ffd700" : "#ef4444"
  const colDim = isWon ? "rgba(251,191,36,.72)" : "rgba(248,113,113,.72)"
  const title = isWon ? "VITÓRIA" : "DERROTA"

  // atraso base para blocos de recompensa em cascata
  let rewardDelay = 1150
  const nextDelay = () => { const d = rewardDelay; rewardDelay += 140; return d }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes grx-bg   {from{opacity:0}to{opacity:1}}
        @keyframes grx-flash{0%{opacity:0}18%{opacity:.9}100%{opacity:0}}
        @keyframes grx-letter{
          0%{opacity:0;transform:translateY(-90px) rotateX(90deg) scale(1.6);filter:blur(14px)}
          58%{opacity:1;transform:translateY(6px) rotateX(-12deg) scale(1.02);filter:blur(0)}
          78%{transform:translateY(-3px) rotateX(4deg) scale(1)}
          100%{opacity:1;transform:translateY(0) rotateX(0) scale(1)}
        }
        @keyframes grx-letter-l{
          0%{opacity:0;transform:translateY(40px) scale(.7);filter:blur(10px)}
          100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}
        }
        @keyframes grx-shake{
          0%,100%{transform:translate(0,0)}
          20%{transform:translate(-5px,3px)} 40%{transform:translate(5px,-3px)}
          60%{transform:translate(-3px,-2px)} 80%{transform:translate(3px,2px)}
        }
        @keyframes grx-up   {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes grx-card {
          0%{opacity:0;transform:translateY(26px) scale(.92)}
          70%{opacity:1;transform:translateY(-3px) scale(1.015)}
          100%{opacity:1;transform:translateY(0) scale(1)}
        }
        @keyframes grx-btn  {0%{opacity:0;transform:scale(.88) translateY(18px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes grx-glw-w{
          0%,100%{text-shadow:0 0 32px #ffd700cc,0 0 90px #ffd70066,0 3px 0 #7a5800}
          50%{text-shadow:0 0 60px #ffd700,0 0 140px #fff20088,0 3px 0 #7a5800}
        }
        @keyframes grx-glw-l{
          0%,100%{text-shadow:0 0 32px #ef4444aa,0 0 80px #ef444455,0 3px 0 #450a0a}
          50%{text-shadow:0 0 55px #ef4444,0 0 120px #dc262677,0 3px 0 #450a0a}
        }
        @keyframes grx-shine{0%{left:-130%}100%{left:230%}}
        @keyframes grx-ring {0%{transform:translate(-50%,-50%) scale(.1);opacity:.9}100%{transform:translate(-50%,-50%) scale(5);opacity:0}}
        @keyframes grx-rays {from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes grx-line {from{width:0;opacity:0}to{width:min(300px,70vw);opacity:1}}
        @keyframes grx-pulse{0%,100%{opacity:.55}50%{opacity:1}}
        @keyframes grx-card-shine{0%{left:-80%}100%{left:180%}}
        @keyframes grx-vignette{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* Fundo */}
      <div style={{
        position: "absolute", inset: 0,
        background: isWon
          ? "radial-gradient(ellipse at 50% 34%, #201603 0%, #0b0800 46%, #000 100%)"
          : "radial-gradient(ellipse at 50% 34%, #1c0202 0%, #090000 46%, #000 100%)",
        animation: "grx-bg 420ms ease-out forwards",
      }} />

      {/* God rays girando (só na vitória; sutil na derrota) */}
      <div style={{
        position: "absolute", left: "50%", top: "38%",
        width: "160vmax", height: "160vmax",
        background: isWon
          ? "repeating-conic-gradient(from 0deg, rgba(255,215,0,.055) 0deg 7deg, transparent 7deg 24deg)"
          : "repeating-conic-gradient(from 0deg, rgba(239,68,68,.03) 0deg 7deg, transparent 7deg 30deg)",
        WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 62%)",
        maskImage: "radial-gradient(circle, black 0%, transparent 62%)",
        animation: `grx-rays ${isWon ? 46 : 80}s linear infinite`,
        pointerEvents: "none", opacity: 0,
        animationName: "grx-rays", // keep spin
        transition: "opacity 1s ease",
      }}
        ref={el => { if (el) requestAnimationFrame(() => { el.style.opacity = "1" }) }}
      />

      {/* Glow ambiente pulsante atrás do título */}
      <div style={{
        position: "absolute", width: 760, height: 440, borderRadius: "50%",
        background: `radial-gradient(ellipse, ${isWon ? "rgba(251,191,36,.14)" : "rgba(239,68,68,.11)"} 0%, transparent 68%)`,
        top: "36%", left: "50%", transform: "translate(-50%,-50%)",
        pointerEvents: "none", animation: "grx-pulse 2.6s ease-in-out 1.1s infinite",
      }} />

      {/* Flash de impacto */}
      <div style={{
        position: "absolute", inset: 0, background: isWon ? "#fff8dd" : "#3b0a0a",
        animation: "grx-flash 700ms ease-out 560ms both", pointerEvents: "none", zIndex: 3,
      }} />

      {/* Shockwaves sincronizadas com o pouso do título */}
      {[620, 800, 1000].map((delay, i) => (
        <div key={i} style={{
          position: "absolute", left: "50%", top: "38%",
          borderRadius: "50%",
          width: 200 + i * 60, height: 200 + i * 60,
          border: `${2 - i * 0.5}px solid ${col}${i === 0 ? "66" : "44"}`,
          boxShadow: `0 0 ${30 - i * 8}px ${col}33, inset 0 0 ${30 - i * 8}px ${col}22`,
          animation: `grx-ring 1.5s cubic-bezier(.16,.84,.44,1) ${delay}ms both`,
          pointerEvents: "none", zIndex: 1,
        }} />
      ))}

      {/* Canvas de partículas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />

      {/* Vinheta */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4,
        background: "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,.55) 100%)",
        animation: "grx-vignette 900ms ease-out both",
      }} />

      {/* Conteúdo principal */}
      <div style={{
        position: "relative", zIndex: 5,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 20, padding: "0 24px",
        textAlign: "center", maxHeight: "100dvh", overflowY: "auto",
        animation: isWon ? "grx-shake 340ms ease-out 620ms" : undefined,
      }}>

        {/* Sobretítulo */}
        <p style={{
          color: colDim, fontSize: 12, fontWeight: 800, margin: 0,
          letterSpacing: "0.5em", textTransform: "uppercase",
          animation: "grx-up 550ms ease-out 200ms both",
        }}>
          Fim do duelo
        </p>

        {/* Título letra a letra */}
        <h1
          aria-label={title}
          style={{
            fontSize: "clamp(58px,14vw,118px)",
            fontWeight: 900, letterSpacing: "0.08em",
            textTransform: "uppercase", color: col, margin: 0,
            fontFamily: "monospace", position: "relative",
            perspective: "700px",
            display: "flex",
            animation: `${isWon ? "grx-glw-w" : "grx-glw-l"} 2.4s ease-in-out 1.3s infinite`,
          }}
        >
          {title.split("").map((ch, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{
                display: "inline-block",
                transformStyle: "preserve-3d",
                animation: isWon
                  ? `grx-letter 640ms cubic-bezier(.22,1.2,.36,1) ${180 + i * 62}ms both`
                  : `grx-letter-l 700ms cubic-bezier(.22,1,.36,1) ${220 + i * 80}ms both`,
              }}
            >
              {ch}
            </span>
          ))}
          {/* Varredura de brilho */}
          <span style={{
            position: "absolute", top: 0, left: "-130%",
            width: "50%", height: "100%",
            background: "linear-gradient(105deg,transparent,rgba(255,255,255,.45),transparent)",
            animation: "grx-shine 1.2s ease-in-out 900ms both",
            pointerEvents: "none",
          }} />
        </h1>

        {/* Filete ornamental */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          animation: "grx-up 550ms ease-out 850ms both",
        }}>
          <div style={{
            height: 1, background: `linear-gradient(to right,transparent,${col})`,
            animation: "grx-line 700ms ease-out 850ms both",
          }} />
          <div style={{
            width: 7, height: 7, transform: "rotate(45deg)",
            background: col, boxShadow: `0 0 12px ${col}`,
          }} />
          <div style={{
            height: 1, background: `linear-gradient(to left,transparent,${col})`,
            animation: "grx-line 700ms ease-out 850ms both",
          }} />
        </div>

        {/* Subtítulo */}
        <p style={{
          color: colDim, fontSize: 15, fontWeight: 600, margin: 0,
          letterSpacing: "0.24em", textTransform: "uppercase",
          animation: "grx-up 550ms ease-out 950ms both",
        }}>
          {isWon ? "O duelo terminou em sua glória" : "Você caiu em batalha"}
        </p>

        {/* Recompensas — moedas */}
        {isWon && rewards && (
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            background: "linear-gradient(160deg, rgba(60,44,4,.55), rgba(0,0,0,.65))",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(250,204,21,0.35)", borderRadius: 16,
            padding: "12px 26px", position: "relative", overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)",
            animation: `grx-card 620ms cubic-bezier(.22,1.2,.36,1) ${nextDelay()}ms both`,
          }}>
            <span style={{
              position: "absolute", top: 0, left: "-80%", width: "45%", height: "100%",
              background: "linear-gradient(105deg,transparent,rgba(255,255,255,.14),transparent)",
              animation: "grx-card-shine 1.4s ease-in-out 1.9s both", pointerEvents: "none",
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/images/Gacha_Coin.png" alt="Gacha Coin"
                style={{ width: 36, height: 36, objectFit: "contain",
                  filter: "drop-shadow(0 0 9px rgba(252,211,77,0.75))" }} />
              <span style={{ fontWeight: 900, fontSize: 19, color: "#FCD34D", minWidth: 44, textAlign: "left",
                textShadow: "0 0 12px rgba(252,211,77,0.55)", fontVariantNumeric: "tabular-nums" }}>
                +<CountUp value={rewards.gacha} delay={rewardDelay + 150} />
              </span>
            </div>
            <div style={{ width: 1, height: 26, background: "rgba(250,204,21,0.28)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/images/gear-coin.png" alt="Gear Coin"
                style={{ width: 34, height: 34, objectFit: "contain",
                  filter: "drop-shadow(0 0 9px rgba(253,224,71,0.75))" }} />
              <span style={{ fontWeight: 900, fontSize: 19, color: "#FDE047", minWidth: 44, textAlign: "left",
                textShadow: "0 0 12px rgba(253,224,71,0.55)", fontVariantNumeric: "tabular-nums" }}>
                +<CountUp value={rewards.gear} delay={rewardDelay + 260} />
              </span>
            </div>
          </div>
        )}

        {/* Fragmentos */}
        {isWon && rewards && rewards.fragments && Object.keys(rewards.fragments).length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center",
            background: "linear-gradient(160deg, rgba(40,15,66,.5), rgba(0,0,0,.65))",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(168,85,247,0.35)", borderRadius: 16,
            padding: "12px 26px", position: "relative", overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)",
            animation: `grx-card 620ms cubic-bezier(.22,1.2,.36,1) ${nextDelay()}ms both`,
          }}>
            {(Object.entries(rewards.fragments) as [FragmentId, number][]).map(([id, amount]) => {
              const frag = FRAGMENTS[id]
              if (!frag) return null
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={frag.image || "/placeholder.svg"} alt={frag.name}
                    style={{ width: 34, height: 34, objectFit: "contain",
                      filter: `drop-shadow(0 0 10px ${frag.color}b3)` }} />
                  <span style={{ fontWeight: 900, fontSize: 18, color: frag.color,
                    textShadow: `0 0 12px ${frag.color}80`, fontVariantNumeric: "tabular-nums" }}>
                    +<CountUp value={amount} delay={rewardDelay + 150} />
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Baú encontrado */}
        {isWon && rewards && rewards.chest && CHESTS[rewards.chest] && (
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            background: `linear-gradient(160deg, ${CHESTS[rewards.chest].color}1a, rgba(0,0,0,.65))`,
            backdropFilter: "blur(12px)",
            border: `1px solid ${CHESTS[rewards.chest].color}66`, borderRadius: 16,
            padding: "12px 26px", position: "relative", overflow: "hidden",
            boxShadow: `0 8px 32px rgba(0,0,0,.5), 0 0 24px ${CHESTS[rewards.chest].color}22`,
            animation: `grx-card 620ms cubic-bezier(.22,1.2,.36,1) ${nextDelay()}ms both`,
          }}>
            <span style={{
              position: "absolute", top: 0, left: "-80%", width: "45%", height: "100%",
              background: "linear-gradient(105deg,transparent,rgba(255,255,255,.16),transparent)",
              animation: "grx-card-shine 1.4s ease-in-out 2.2s both", pointerEvents: "none",
            }} />
            <img src={CHESTS[rewards.chest].image || "/placeholder.svg"} alt={CHESTS[rewards.chest].name}
              style={{ width: 44, height: 44, objectFit: "contain",
                filter: `drop-shadow(0 0 12px ${CHESTS[rewards.chest].color}aa)` }} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, textAlign: "left" }}>
              <span style={{ fontWeight: 900, fontSize: 13, color: CHESTS[rewards.chest].color,
                textShadow: `0 0 10px ${CHESTS[rewards.chest].color}80`,
                textTransform: "uppercase", letterSpacing: "1px" }}>
                Baú encontrado!
              </span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#f1f0ee" }}>
                {CHESTS[rewards.chest].name}
              </span>
            </div>
          </div>
        )}

        {/* Livro de XP encontrado — só em Duelos do Modo Campanha */}
        {isWon && xpBookDrop && XP_BOOKS[xpBookDrop.id] && (
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            background: `linear-gradient(160deg, ${XP_BOOKS[xpBookDrop.id].color}1a, rgba(0,0,0,.65))`,
            backdropFilter: "blur(12px)",
            border: `1px solid ${XP_BOOKS[xpBookDrop.id].color}66`, borderRadius: 16,
            padding: "12px 26px", position: "relative", overflow: "hidden",
            boxShadow: `0 8px 32px rgba(0,0,0,.5), 0 0 24px ${XP_BOOKS[xpBookDrop.id].color}22`,
            animation: `grx-card 620ms cubic-bezier(.22,1.2,.36,1) ${nextDelay()}ms both`,
          }}>
            <span style={{
              position: "absolute", top: 0, left: "-80%", width: "45%", height: "100%",
              background: "linear-gradient(105deg,transparent,rgba(255,255,255,.16),transparent)",
              animation: "grx-card-shine 1.4s ease-in-out 2.2s both", pointerEvents: "none",
            }} />
            <img src={XP_BOOKS[xpBookDrop.id].image || "/placeholder.svg"} alt={XP_BOOKS[xpBookDrop.id].name}
              style={{ width: 44, height: 44, objectFit: "contain",
                filter: `drop-shadow(0 0 12px ${XP_BOOKS[xpBookDrop.id].color}aa)` }} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, textAlign: "left" }}>
              <span style={{ fontWeight: 900, fontSize: 13, color: XP_BOOKS[xpBookDrop.id].color,
                textShadow: `0 0 10px ${XP_BOOKS[xpBookDrop.id].color}80`,
                textTransform: "uppercase", letterSpacing: "1px" }}>
                Livro de XP encontrado!
              </span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#f1f0ee" }}>
                {xpBookDrop.amount > 1 ? `${xpBookDrop.amount}x ` : ""}{XP_BOOKS[xpBookDrop.id].name}
              </span>
            </div>
          </div>
        )}

        {/* XP do Mestre */}
        {masterXP && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
            background: "linear-gradient(160deg, rgba(58,48,16,.5), rgba(0,0,0,.65))",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(232,201,109,0.35)", borderRadius: 16,
            padding: "12px 26px",
            boxShadow: "0 8px 32px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)",
            animation: `grx-card 620ms cubic-bezier(.22,1.2,.36,1) ${nextDelay()}ms both`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#f1f0ee" }}>
                {masterXP.masterName}
              </span>
              <span style={{
                fontWeight: 900, fontSize: 17, color: "#e8c96d",
                textShadow: "0 0 12px rgba(232,201,109,0.6)", fontVariantNumeric: "tabular-nums",
              }}>
                +<CountUp value={masterXP.xpGain} delay={rewardDelay + 150} /> XP
              </span>
            </div>
            {masterXP.leveledUp && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "linear-gradient(135deg,rgba(232,201,109,0.16),rgba(232,201,109,0.28))",
                border: "1px solid rgba(232,201,109,0.45)", borderRadius: 10,
                padding: "6px 18px",
              }}>
                <span style={{
                  fontWeight: 900, fontSize: 14, color: "#e8c96d",
                  letterSpacing: "1px", textShadow: "0 0 10px rgba(232,201,109,0.5)",
                }}>
                  SUBIU PARA O NÍVEL {masterXP.newLevel}!
                </span>
              </div>
            )}
          </div>
        )}

        {/* Botão voltar */}
        <button
          onClick={onBack}
          style={{
            marginTop: 10, padding: "15px 56px",
            borderRadius: 12, fontWeight: 800,
            fontSize: 15, letterSpacing: "2px",
            textTransform: "uppercase", cursor: "pointer",
            border: `2px solid ${col}99`,
            background: `linear-gradient(135deg,${col}24,${col}0a)`,
            color: col, backdropFilter: "blur(10px)",
            animation: `grx-btn 560ms cubic-bezier(.22,1.2,.36,1) ${rewardDelay + 150}ms both`,
            transition: "background 180ms, transform 140ms, box-shadow 200ms",
            boxShadow: `0 0 0 0 ${col}44`,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = `linear-gradient(135deg,${col}3a,${col}18)`
            e.currentTarget.style.boxShadow = `0 0 28px 6px ${col}33`
            e.currentTarget.style.transform = "scale(1.05)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = `linear-gradient(135deg,${col}24,${col}0a)`
            e.currentTarget.style.boxShadow = `0 0 0 0 ${col}44`
            e.currentTarget.style.transform = "scale(1)"
          }}
        >
          Voltar ao Menu
        </button>
      </div>
    </div>
  )
}
