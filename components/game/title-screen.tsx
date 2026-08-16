"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import Image from "next/image"
import { ChevronsUpDown, Globe, UserCog, Wrench } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import {
  GAME_VERSION,
  TitleMenuPanel,
  getServerLabel,
  pingColor,
  useDisplayUid,
  useSelectedServer,
  type TitlePanel,
} from "./title-menu-panels"

/** Estilo compartilhado dos botões em ícone posicionados nos cantos/laterais. */
const ICON_BUTTON_CLASS =
  "group absolute flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 hover:scale-105"

const ICON_BUTTON_STYLE: React.CSSProperties = {
  background: "rgba(8,14,30,0.55)",
  border: "1px solid rgba(56,189,248,0.25)",
  boxShadow: "0 0 20px rgba(56,189,248,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
  backdropFilter: "blur(6px)",
}

interface TitleScreenProps {
  onEnter: () => void
}

// Pre-computed particle data to avoid hydration mismatches
const PARTICLE_COLORS = ["#38bdf8", "#a855f7", "#fbbf24", "#22d3ee", "#f472b6"]
const PARTICLE_COUNT = 18

export default function TitleScreen({ onEnter }: TitleScreenProps) {
  const { t } = useLanguage()
  const { server, selectServer, ping, status, liveServerId, refresh } = useSelectedServer()
  const { uid, isGuest, ready: uidReady } = useDisplayUid()
  const [panel, setPanel] = useState<TitlePanel | null>(null)
  const bgMusicRef = useRef<HTMLAudioElement | null>(null)
  const narratorRef = useRef<HTMLAudioElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [bgMusicReady, setBgMusicReady] = useState(false)
  const [narratorReady, setNarratorReady] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null)
  const hasAttemptedAutoplay = useRef(false)
  const parallaxRaf = useRef<number | null>(null)
  const bgLayerRef = useRef<HTMLDivElement | null>(null)
  const contentLayerRef = useRef<HTMLDivElement | null>(null)
  const leavingRef = useRef(false)

  // Pointer parallax - writes transforms directly to the DOM (no React re-render per frame)
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (leavingRef.current || parallaxRaf.current !== null) return
    const { clientX, clientY } = e
    parallaxRaf.current = requestAnimationFrame(() => {
      parallaxRaf.current = null
      if (leavingRef.current) return
      const nx = (clientX / window.innerWidth - 0.5) * 2
      const ny = (clientY / window.innerHeight - 0.5) * 2
      if (bgLayerRef.current) {
        bgLayerRef.current.style.transform = `scale(1.04) translate3d(${nx * -10}px, ${ny * -7}px, 0)`
      }
      if (contentLayerRef.current) {
        contentLayerRef.current.style.transform = `translate3d(${nx * 6}px, ${ny * 4}px, 0)`
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      if (parallaxRaf.current !== null) cancelAnimationFrame(parallaxRaf.current)
    }
  }, [])

  // Mark as mounted on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Pre-compute particle positions to be deterministic
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      size: 2 + (i % 5),
      left: (i * 5.9 + 3) % 100,
      top: (i * 11.3 + 5) % 100,
      opacity: 0.3 + (i % 4) * 0.15,
      animationDuration: 6 + (i % 8),
      animationDelay: (i * 0.4) % 5,
    }))
  }, [])

  // Check if all audio is ready
  const allAudioReady = bgMusicReady && narratorReady

  // Attempt to play all audio synchronized - returns true if successful
  const attemptPlay = useCallback(async () => {
    if (audioPlaying) return false

    const bgMusic = bgMusicRef.current
    const narrator = narratorRef.current

    if (!bgMusic || !narrator) return false

    try {
      // Set volumes - start muted then unmute for better autoplay compatibility
      bgMusic.volume = 0
      bgMusic.loop = true
      narrator.volume = 0
      narrator.loop = false

      // Try to play both simultaneously
      const results = await Promise.allSettled([bgMusic.play(), narrator.play()])

      // Check if at least one succeeded
      const anySuccess = results.some((r) => r.status === "fulfilled")

      if (anySuccess) {
        // Fade in volumes smoothly for synchronized experience
        let vol = 0
        const fadeIn = setInterval(() => {
          vol += 0.05
          if (vol >= 1) {
            bgMusic.volume = 0.4
            narrator.volume = 0.8
            clearInterval(fadeIn)
          } else {
            bgMusic.volume = Math.min(0.4, vol * 0.4)
            narrator.volume = Math.min(0.8, vol * 0.8)
          }
        }, 50)

        setAudioPlaying(true)
        return true
      }

      return false
    } catch {
      // Autoplay blocked by browser - needs user interaction
      return false
    }
  }, [audioPlaying])

  // Show screen with fade in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Try autoplay when all audio is ready and screen is visible
  useEffect(() => {
    if (allAudioReady && visible && !hasAttemptedAutoplay.current) {
      hasAttemptedAutoplay.current = true

      // Strategy 1: Immediate attempt after audio is ready
      attemptPlay()

      // Strategy 2: Retry after a short delay (some browsers need this)
      const timer1 = setTimeout(() => {
        if (!audioPlaying) attemptPlay()
      }, 500)

      // Strategy 3: Try on visibility change (when tab becomes active)
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible" && !audioPlaying) {
          attemptPlay()
        }
      }
      document.addEventListener("visibilitychange", handleVisibilityChange)

      // Strategy 4: Try on window focus
      const handleFocus = () => {
        if (!audioPlaying) attemptPlay()
      }
      window.addEventListener("focus", handleFocus, { once: true })

      return () => {
        clearTimeout(timer1)
        document.removeEventListener("visibilitychange", handleVisibilityChange)
        window.removeEventListener("focus", handleFocus)
      }
    }
  }, [allAudioReady, visible, attemptPlay, audioPlaying])

  // Listen for any user interaction to start audio if autoplay failed
  useEffect(() => {
    if (audioPlaying) return

    const startOnInteraction = () => {
      attemptPlay()
    }

    // These events count as user interaction for autoplay policy
    // Using multiple event types increases chances of catching first interaction
    const events = ["click", "touchstart", "touchend", "keydown", "mousedown", "pointerdown", "scroll"]

    events.forEach((event) => {
      window.addEventListener(event, startOnInteraction, { once: true, passive: true })
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, startOnInteraction)
      })
    }
  }, [audioPlaying, attemptPlay])

  const handleEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    // Um painel aberto (conta, reparo, idioma, servidor) captura o toque
    if (leaving || panel) return

    // Touch ripple at click position
    setRipple({ x: e.clientX, y: e.clientY, key: Date.now() })

    // Try to start audio if not already playing
    if (!audioPlaying) {
      attemptPlay()
    }

    leavingRef.current = true
    setLeaving(true)

    // Fade out both audios
    const bgMusic = bgMusicRef.current
    const narrator = narratorRef.current

    if (audioPlaying) {
      const fadeOut = setInterval(() => {
        let stillFading = false

        if (bgMusic && bgMusic.volume > 0.05) {
          bgMusic.volume = Math.max(0, bgMusic.volume - 0.05)
          stillFading = true
        } else if (bgMusic) {
          bgMusic.pause()
        }

        if (narrator && narrator.volume > 0.05) {
          narrator.volume = Math.max(0, narrator.volume - 0.05)
          stillFading = true
        } else if (narrator) {
          narrator.pause()
        }

        if (!stillFading) {
          clearInterval(fadeOut)
        }
      }, 60)
    }

    setTimeout(() => onEnter(), 1000)
  }

  return (
    <div
      onClick={handleEnter}
      onPointerMove={handlePointerMove}
      suppressHydrationWarning={true}
      className="fixed inset-0 cursor-pointer select-none overflow-hidden bg-black"
      style={{
        opacity: leaving ? 0 : visible ? 1 : 0,
        transition: leaving ? "opacity 0.6s cubic-bezier(0.65, 0, 0.35, 1) 0.4s" : "opacity 1.2s ease-out",
        zIndex: 9999,
      }}
    >
      {/* Background Music */}
      <audio
        ref={bgMusicRef}
        src="/audio/title-game-ost-remix.mp3"
        preload="auto"
        onCanPlayThrough={() => setBgMusicReady(true)}
        onLoadedData={() => setBgMusicReady(true)}
      />

      {/* Narrator Voice */}
      <audio
        ref={narratorRef}
        src="/audio/narrator-intro.mp3"
        preload="auto"
        onCanPlayThrough={() => setNarratorReady(true)}
        onLoadedData={() => setNarratorReady(true)}
      />

      {/* Parallax wrapper - shifts opposite to pointer for depth */}
      <div
        ref={bgLayerRef}
        className="absolute inset-0"
        style={{
          transform: leaving ? "scale(1.14) translate3d(0, 0, 0)" : "scale(1.04) translate3d(0, 0, 0)",
          transition: leaving
            ? "transform 1s cubic-bezier(0.33, 0, 0.2, 1)"
            : "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
      {/* Background with Ken Burns drift */}
      <div
        className="absolute inset-0"
        style={{
          animation: leaving ? undefined : "kenBurns 28s ease-in-out infinite alternate",
          willChange: "transform",
        }}
      >
        <Image
          src="/images/title-menu-wallpaper.png"
          alt="Personagens principais de Gear Perks Card Game contra um ceu luminoso"
          fill
          sizes="100vw"
          className="object-cover object-center"
          priority
          quality={75}
        />
      </div>
      </div>

      {/* Shooting stars - occasional comets crossing the sky */}
      {mounted && !leaving && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute h-px"
              style={{
                width: "140px",
                top: `${8 + i * 14}%`,
                left: "-140px",
                background: "linear-gradient(90deg, transparent, rgba(224,242,254,0.9), rgba(56,189,248,0.6))",
                boxShadow: "0 0 6px rgba(56,189,248,0.8)",
                animation: `shootingStar ${9 + i * 4}s linear ${3 + i * 5.5}s infinite`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Cinematic light rays - soft gradients, no blur filter (GPU friendly) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-0 left-1/4 w-[500px] h-full opacity-[0.07]${leaving ? " ts-anim-paused" : ""}`}
          style={{
            background:
              "radial-gradient(ellipse 60% 90% at 50% 0%, rgba(56, 189, 248, 0.5) 0%, rgba(56, 189, 248, 0.15) 45%, transparent 75%)",
            transform: "skewX(-15deg) translateZ(0)",
            animation: "lightSway 9s ease-in-out infinite",
            willChange: "transform, opacity",
          }}
        />
        <div
          className={`absolute top-0 right-1/3 w-[400px] h-full opacity-[0.06]${leaving ? " ts-anim-paused" : ""}`}
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(168, 85, 247, 0.5) 0%, rgba(168, 85, 247, 0.12) 40%, transparent 70%)",
            transform: "skewX(10deg) translateZ(0)",
            animation: "lightSway 12s ease-in-out infinite reverse",
            willChange: "transform, opacity",
          }}
        />
      </div>

      {/* Ultra premium floating particles - only render on client to avoid hydration issues */}
      {mounted &&
        particles.map((particle, i) => (
          <div
            key={i}
            className={`absolute rounded-full${leaving ? " ts-anim-paused" : ""}`}
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              background: particle.color,
              opacity: particle.opacity,
              boxShadow: `0 0 ${particle.size * 4}px ${particle.color}`,
              animation: `floatParticle ${particle.animationDuration}s ease-in-out ${particle.animationDelay}s infinite`,
              willChange: "transform, opacity",
            }}
          />
        ))}

      {/* Central content with staggered entrance + exit lift */}
      <div
        ref={contentLayerRef}
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{
          paddingTop: "80px",
          transform: leaving ? "translate3d(0, -30px, 0) scale(1.06)" : "translate3d(0, 0, 0)",
          opacity: leaving ? 0 : 1,
          transition: leaving
            ? "transform 0.9s cubic-bezier(0.33, 0, 0.2, 1), opacity 0.55s ease-in 0.15s"
            : "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
      >
        <div
          className={`relative${leaving ? " ts-anim-paused" : ""}`}
          style={{
            animation: visible ? "logoEntrance 1.4s cubic-bezier(0.16, 1, 0.3, 1) both, logoFloat 5s ease-in-out 1.4s infinite" : undefined,
            willChange: "transform",
          }}
        >
          <Image
            src="/images/GP_CG_logo.png"
            alt="Gear Perks Card Game"
            width={400}
            height={400}
            className="object-contain relative z-10"
            priority
            style={{
              maxWidth: "min(400px, 78vw)",
              filter:
                "drop-shadow(0 0 50px rgba(56,189,248,0.55)) drop-shadow(0 0 110px rgba(168,85,247,0.3))",
            }}
          />
        </div>

        {/* Divider line - expands on entrance */}
        <div
          className="-mt-10 mb-6 flex items-center gap-3"
          style={{
            width: "min(320px, 70vw)",
            animation: visible ? "dividerExpand 1s cubic-bezier(0.16, 1, 0.3, 1) 0.8s both" : undefined,
          }}
        >
          <div
            className="flex-1 h-px"
            style={{ background: "linear-gradient(to right, transparent, #60a5fa, transparent)" }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full bg-blue-400"
            style={{ boxShadow: "0 0 8px #60a5fa, 0 0 16px #60a5fa80", animation: "dotPulse 2.4s ease-in-out infinite" }}
          />
          <div
            className="flex-1 h-px"
            style={{ background: "linear-gradient(to right, transparent, #60a5fa, transparent)" }}
          />
        </div>

      </div>

      {/* Centro inferior - seleção de servidor + chamada principal em destaque */}
      <div
        className="absolute bottom-24 left-0 right-0 flex flex-col items-center gap-4 px-4 sm:bottom-20"
        style={{
          zIndex: 55,
          opacity: leaving ? 0 : 1,
          transition: "opacity 0.45s ease-out",
          pointerEvents: "none",
        }}
      >
        {/* Faixa semitransparente destaca o texto da roupa escura do personagem, sem piscar */}
        <div
          className={`relative flex items-center justify-center rounded-full px-7 py-3 sm:px-9${leaving ? " ts-anim-paused" : ""}`}
          style={{
            background: "rgba(4,10,24,0.6)",
            border: "1px solid rgba(125,211,252,0.35)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 0 24px rgba(56,189,248,0.22), inset 0 1px 0 rgba(255,255,255,0.08)",
            animation: visible ? "textEntrance 1s ease-out 1.1s both" : undefined,
          }}
        >
          <p
            style={{
              fontFamily: "'Segoe UI', sans-serif",
              fontSize: "clamp(14px, 2.8vw, 18px)",
              letterSpacing: "0.35em",
              fontWeight: 700,
              color: "#f8fdff",
              textTransform: "uppercase",
              textShadow:
                "0 0 12px rgba(224,242,254,0.9), 0 0 34px rgba(56,189,248,0.85), 0 2px 12px rgba(0,0,0,0.95)",
            }}
          >
            {t("tapToStart")}
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setPanel("server")
          }}
          aria-label={`${t("titleServer")}: ${getServerLabel(server)}`}
          className="group flex items-center gap-2.5 rounded-full px-4 py-2 transition-all duration-300 hover:scale-[1.03]"
          style={{
            ...ICON_BUTTON_STYLE,
            borderColor: "rgba(56,189,248,0.28)",
            animation: visible ? "textEntrance 1s ease-out 1.45s both" : undefined,
            opacity: panel ? 0.4 : undefined,
            pointerEvents: leaving ? "none" : "auto",
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: pingColor(ping),
              boxShadow: `0 0 8px ${pingColor(ping)}`,
              animation: "dotPulse 2.4s ease-in-out infinite",
            }}
            aria-hidden="true"
          />
          <span
            className="text-[11px] font-medium uppercase tracking-[0.2em] text-sky-100/90"
            style={{ fontFamily: "'Segoe UI', sans-serif" }}
          >
            {getServerLabel(server)}
          </span>
          <span className="font-mono text-[10px]" style={{ color: pingColor(ping) }}>
            {status === "measuring" ? "..." : status === "offline" ? "--" : `${ping}ms`}
          </span>
          <ChevronsUpDown
            className="h-3.5 w-3.5 text-sky-300/60 transition-colors group-hover:text-sky-200"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Touch ripple on click */}
      {ripple && (
        <div
          key={ripple.key}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: "10px",
            height: "10px",
            transform: "translate(-50%, -50%)",
            border: "2px solid rgba(147, 197, 253, 0.9)",
            boxShadow: "0 0 24px rgba(56,189,248,0.8), inset 0 0 12px rgba(56,189,248,0.4)",
            animation: "rippleExpand 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            zIndex: 50,
          }}
        />
      )}

      {/* Cinematic letterbox bars slide in on exit */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "12vh",
          background: "#000",
          transform: leaving ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.7s cubic-bezier(0.7, 0, 0.3, 1)",
          zIndex: 45,
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: "12vh",
          background: "#000",
          transform: leaving ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.7s cubic-bezier(0.7, 0, 0.3, 1)",
          zIndex: 45,
        }}
      />

      {/* Light bloom on exit - peaks mid-transition then settles into dark */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, rgba(224,242,254,0.85) 0%, rgba(56,189,248,0.45) 45%, transparent 80%)",
          opacity: 0,
          animation: leaving ? "exitBloom 1s cubic-bezier(0.4, 0, 0.2, 1) forwards" : "none",
          willChange: "opacity",
          zIndex: 40,
        }}
      />

      {/* Dark veil - fades in at the end so the menu enters from a dark frame */}
      <div
        className="absolute inset-0 pointer-events-none bg-black"
        style={{
          opacity: leaving ? 1 : 0,
          transition: leaving ? "opacity 0.5s cubic-bezier(0.65, 0, 0.35, 1) 0.5s" : "none",
          zIndex: 46,
        }}
      />

      {/* Cantos superiores - reparo de cliente (esq) e idioma (dir) */}
      {[
        { key: "repair" as const, Icon: Wrench, label: t("titleRepair"), position: "left-4 top-4 sm:left-6 sm:top-6" },
        {
          key: "language" as const,
          Icon: Globe,
          label: t("titleLanguage"),
          position: "right-4 top-4 sm:right-6 sm:top-6",
        },
      ].map(({ key, Icon, label, position }) => (
        <button
          key={key}
          type="button"
          title={label}
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation()
            setPanel(key)
          }}
          className={`${ICON_BUTTON_CLASS} ${position}`}
          style={{
            ...ICON_BUTTON_STYLE,
            zIndex: 60,
            opacity: leaving ? 0 : 1,
            transition: "opacity 0.4s ease-out, transform 0.3s",
            pointerEvents: leaving ? "none" : "auto",
            animation: visible ? "textEntrance 0.9s ease-out 1.6s both" : undefined,
          }}
        >
          <Icon
            className="h-5 w-5 text-sky-200/75 transition-colors duration-300 group-hover:text-sky-100"
            aria-hidden="true"
          />
          <span className="sr-only">{label}</span>
        </button>
      ))}

      {/* Lateral esquerda (centro) - menu de conta */}
      <button
        type="button"
        title={t("titleAccount")}
        aria-label={t("titleAccount")}
        onClick={(e) => {
          e.stopPropagation()
          setPanel("account")
        }}
        className={`${ICON_BUTTON_CLASS} left-4 top-1/2 sm:left-6`}
        style={{
          ...ICON_BUTTON_STYLE,
          zIndex: 60,
          marginTop: "-22px",
          opacity: leaving ? 0 : 1,
          transition: "opacity 0.4s ease-out, transform 0.3s",
          pointerEvents: leaving ? "none" : "auto",
          animation: visible ? "textEntrance 0.9s ease-out 1.7s both" : undefined,
        }}
      >
        <UserCog
          className="h-5 w-5 text-sky-200/75 transition-colors duration-300 group-hover:text-sky-100"
          aria-hidden="true"
        />
        <span className="sr-only">{t("titleAccount")}</span>
      </button>

      {/* Cantos inferiores - versão/UID à esquerda, legal à direita (empilha no mobile) */}
      <footer
        className="absolute bottom-3 left-4 right-4 flex flex-col-reverse items-center gap-1.5 sm:left-6 sm:right-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
        style={{
          zIndex: 50,
          opacity: leaving ? 0 : 1,
          transition: "opacity 0.4s ease-out",
          pointerEvents: leaving ? "none" : "auto",
          animation: visible ? "textEntrance 1s ease-out 1.6s both" : undefined,
        }}
      >
        {/* Versão e UID: é o que o suporte pede em um relato de bug */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-0.5">
          <p
            className="font-mono"
            style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.32)" }}
          >
            {GAME_VERSION}
          </p>
          {uidReady && uid ? (
            <p
              className="font-mono"
              style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(125,211,252,0.45)" }}
            >
              <span className="uppercase">{isGuest ? t("uidGuestLabel") : t("uidLabel")}</span> {uid}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-0.5 sm:items-end">
          <nav className="flex items-center gap-2" aria-label={t("legalTerms")}>
            {[
              { key: "terms" as const, label: t("legalTerms") },
              { key: "privacy" as const, label: t("legalPrivacy") },
            ].map(({ key, label }, index) => (
              <span key={key} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden="true" style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>
                    ·
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPanel(key)
                  }}
                  className="rounded transition-colors hover:text-sky-200"
                  style={{
                    fontFamily: "'Segoe UI', sans-serif",
                    fontSize: "11px",
                    letterSpacing: "0.06em",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  {label}
                </button>
              </span>
            ))}
          </nav>
          <p
            className="text-center sm:text-right"
            style={{
              fontFamily: "'Segoe UI', sans-serif",
              fontSize: "10px",
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.28)",
            }}
          >
            {t("legalCopyright")}
          </p>
        </div>
      </footer>

      {/* Painéis do menu - o stopPropagation evita que o clique inicie o jogo */}
      {panel ? (
        <div onClick={(e) => e.stopPropagation()} className="contents">
          <TitleMenuPanel
            panel={panel}
            onClose={() => setPanel(null)}
            currentServerId={server.id}
            liveServerId={liveServerId}
            ping={ping}
            status={status}
            onRefresh={() => void refresh()}
            onSelectServer={(id) => {
              selectServer(id)
              setPanel(null)
            }}
          />
        </div>
      ) : null}

      <style>{`
        .ts-anim-paused { animation-play-state: paused !important; }
        @keyframes kenBurns {
          0%   { transform: scale(1) translate(0px, 0px); }
          50%  { transform: scale(1.05) translate(-8px, -5px); }
          100% { transform: scale(1.08) translate(6px, -8px); }
        }
        @keyframes logoEntrance {
          0%   { opacity: 0; transform: translateY(-40px) scale(1.15); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: translateY(0px) scale(1); }
        }
        @keyframes dividerExpand {
          0%   { opacity: 0; transform: scaleX(0); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes textEntrance {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0px); }
        }
        @keyframes softBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.6; }
        }
        @keyframes shineSweep {
          0%   { left: -40%; opacity: 0; }
          8%   { opacity: 1; }
          30%  { left: 110%; opacity: 0; }
          100% { left: 110%; opacity: 0; }
        }
        @keyframes rippleExpand {
          0%   { width: 10px; height: 10px; opacity: 1; }
          100% { width: 340px; height: 340px; opacity: 0; }
        }
        @keyframes logoFloat {
          0%   { transform: translateY(0px) rotate(-0.2deg) scale(1); }
          25%  { transform: translateY(-12px) rotate(0.1deg) scale(1.01); }
          50%  { transform: translateY(-20px) rotate(0.2deg) scale(1.02); }
          75%  { transform: translateY(-8px) rotate(0deg) scale(1.01); }
          100% { transform: translateY(0px) rotate(-0.2deg) scale(1); }
        }
        @keyframes floatParticle {
          0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.2; }
          25%  { transform: translateY(-15px) translateX(8px) scale(1.1); opacity: 0.7; }
          50%  { transform: translateY(-30px) translateX(-5px) scale(1.2); opacity: 0.9; }
          75%  { transform: translateY(-20px) translateX(10px) scale(1.15); opacity: 0.6; }
          100% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.2; }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }
        @keyframes shootingStar {
          0%   { transform: translateX(0) translateY(0) rotate(12deg); opacity: 0; }
          2%   { opacity: 1; }
          10%  { transform: translateX(120vw) translateY(18vh) rotate(12deg); opacity: 0; }
          100% { transform: translateX(120vw) translateY(18vh) rotate(12deg); opacity: 0; }
        }
        @keyframes lightSway {
          0%, 100% { transform: skewX(-15deg) translateX(-20px) translateZ(0); opacity: 0.04; }
          50% { transform: skewX(-15deg) translateX(20px) translateZ(0); opacity: 0.08; }
        }
        @keyframes exitBloom {
          0%   { opacity: 0; }
          45%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  )
}
