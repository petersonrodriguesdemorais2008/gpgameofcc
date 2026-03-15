"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import Image from "next/image"

interface TitleScreenProps {
  onEnter: () => void
}

// Pre-computed particle data to avoid hydration mismatches
const PARTICLE_COLORS = ["#38bdf8", "#a855f7", "#fbbf24", "#22d3ee", "#f472b6"]
const PARTICLE_COUNT = 35

export default function TitleScreen({ onEnter }: TitleScreenProps) {
  const bgMusicRef = useRef<HTMLAudioElement | null>(null)
  const narratorRef = useRef<HTMLAudioElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [blink, setBlink] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [bgMusicReady, setBgMusicReady] = useState(false)
  const [narratorReady, setNarratorReady] = useState(false)
  const [mounted, setMounted] = useState(false)
  const hasAttemptedAutoplay = useRef(false)
  
  // Mark as mounted on client
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Pre-compute particle positions to be deterministic
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      size: 2 + (i % 5),
      left: (i * 2.9) % 100,
      top: (i * 5.7) % 100,
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
      const results = await Promise.allSettled([
        bgMusic.play(),
        narrator.play()
      ])
      
      // Check if at least one succeeded
      const anySuccess = results.some(r => r.status === 'fulfilled')
      
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

  // Blink effect for "Toque para Comecar"
  useEffect(() => {
    const interval = setInterval(() => setBlink((b) => !b), 800)
    return () => clearInterval(interval)
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
        if (document.visibilityState === 'visible' && !audioPlaying) {
          attemptPlay()
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)
      
      // Strategy 4: Try on window focus
      const handleFocus = () => {
        if (!audioPlaying) attemptPlay()
      }
      window.addEventListener('focus', handleFocus, { once: true })
      
      return () => {
        clearTimeout(timer1)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('focus', handleFocus)
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
    const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'scroll']
    
    events.forEach(event => {
      window.addEventListener(event, startOnInteraction, { once: true, passive: true })
    })

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, startOnInteraction)
      })
    }
  }, [audioPlaying, attemptPlay])

  const handleEnter = () => {
    if (leaving) return
    
    // Try to start audio if not already playing
    if (!audioPlaying) {
      attemptPlay()
    }
    
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
    
    setTimeout(() => onEnter(), 700)
  }

  return (
    <div
      onClick={handleEnter}
      suppressHydrationWarning={true}
      className="fixed inset-0 cursor-pointer select-none overflow-hidden"
      style={{
        opacity: leaving ? 0 : visible ? 1 : 0,
        transition: leaving ? "opacity 0.7s ease-in" : "opacity 1s ease-out",
        zIndex: 9999,
      }}
    >
      {/* Background Music */}
      <audio 
        ref={bgMusicRef} 
        src="/audio/menu-ost.mp3" 
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

      <div className="absolute inset-0">
        <Image
          src="/images/the great order wallpaper.png"
          alt="The Great Order Background"
          fill
          sizes="100vw"
          className="object-cover object-center"
          priority
          quality={75}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%)" }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-56"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
        />
      </div>

      {/* Cinematic light rays */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-0 left-1/4 w-[500px] h-full opacity-[0.06]"
          style={{
            background: "linear-gradient(180deg, rgba(56, 189, 248, 0.4) 0%, transparent 70%)",
            filter: "blur(80px)",
            transform: "skewX(-15deg)",
            animation: "lightSway 8s ease-in-out infinite",
          }}
        />
        <div 
          className="absolute top-0 right-1/3 w-[400px] h-full opacity-[0.05]"
          style={{
            background: "linear-gradient(180deg, rgba(168, 85, 247, 0.4) 0%, transparent 60%)",
            filter: "blur(60px)",
            transform: "skewX(10deg)",
            animation: "lightSway 10s ease-in-out infinite reverse",
          }}
        />
        <div 
          className="absolute top-0 right-1/4 w-[300px] h-full opacity-[0.04]"
          style={{
            background: "linear-gradient(180deg, rgba(251, 191, 36, 0.3) 0%, transparent 50%)",
            filter: "blur(50px)",
            transform: "skewX(-8deg)",
            animation: "lightSway 12s ease-in-out infinite",
          }}
        />
      </div>

      {/* Ultra premium floating particles - only render on client to avoid hydration issues */}
      {mounted && particles.map((particle, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            background: particle.color,
            opacity: particle.opacity,
            boxShadow: `0 0 ${particle.size * 4}px ${particle.color}, 0 0 ${particle.size * 8}px ${particle.color}80, 0 0 ${particle.size * 12}px ${particle.color}40`,
            animation: `floatParticle ${particle.animationDuration}s ease-in-out ${particle.animationDelay}s infinite`,
          }}
        />
      ))}

      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ paddingBottom: "80px" }}
      >
        <div
          className="relative"
          style={{
            animation: "logoFloat 5s ease-in-out infinite",
          }}
        >
          {/* Logo glow layers */}
          <div 
            className="absolute inset-0 blur-3xl opacity-60"
            style={{
              background: "radial-gradient(circle, rgba(56,189,248,0.4) 0%, transparent 70%)",
              animation: "pulseGlow 3s ease-in-out infinite",
            }}
          />
          <div 
            className="absolute inset-0 blur-2xl opacity-40"
            style={{
              background: "radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 60%)",
              animation: "pulseGlow 4s ease-in-out infinite reverse",
            }}
          />
          <Image
            src="/images/GP_CG_logo.png"
            alt="Gear Perks Card Game"
            width={520}
            height={520}
            className="object-contain relative z-10"
            priority
            style={{ 
              maxWidth: "min(520px, 90vw)",
              filter: "drop-shadow(0 0 50px rgba(56,189,248,0.5)) drop-shadow(0 0 100px rgba(168,85,247,0.3)) drop-shadow(0 0 150px rgba(251,191,36,0.15))",
            }}
          />
        </div>

        <div className="mt-6 mb-8 flex items-center gap-3" style={{ width: "min(320px, 70vw)" }}>
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #60a5fa, transparent)" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #60a5fa, transparent)" }} />
        </div>

        <p
          style={{
            fontFamily: "'Segoe UI', sans-serif",
            fontSize: "clamp(14px, 2.8vw, 18px)",
            letterSpacing: "0.35em",
            fontWeight: 500,
            color: "#f0f9ff",
            textTransform: "uppercase",
            textShadow: "0 0 30px rgba(56,189,248,0.9), 0 0 60px rgba(168,85,247,0.5), 0 2px 10px rgba(0,0,0,0.9)",
            opacity: blink ? 1 : 0.25,
            transition: "opacity 0.5s ease",
          }}
        >
          Toque para Comecar
        </p>
      </div>

      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "11px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>
          Gear Perks Card Game
        </p>
      </div>

      <style>{`
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
        @keyframes lightSway {
          0%, 100% { transform: skewX(-15deg) translateX(-20px); opacity: 0.04; }
          50% { transform: skewX(-15deg) translateX(20px); opacity: 0.08; }
        }
      `}</style>
    </div>
  )
}
