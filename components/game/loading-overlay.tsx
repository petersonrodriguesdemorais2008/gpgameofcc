"use client"

import { useEffect, useState } from "react"

interface LoadingOverlayProps {
  /** Controlled: show overlay when true */
  visible: boolean
  /** Optional message to display */
  message?: string
  /** Fade out duration in ms (default 300) */
  fadeMs?: number
}

/**
 * Lightweight fullscreen overlay for in-game transitions
 * (entering duel, opening gacha, switching screens).
 * Fades in instantly, fades out after `visible` becomes false.
 */
export function LoadingOverlay({ visible, message = "Carregando...", fadeMs = 300 }: LoadingOverlayProps) {
  const [rendered, setRendered] = useState(visible)
  const [opacity, setOpacity] = useState(visible ? 1 : 0)

  useEffect(() => {
    if (visible) {
      setRendered(true)
      requestAnimationFrame(() => setOpacity(1))
    } else {
      setOpacity(0)
      const t = setTimeout(() => setRendered(false), fadeMs + 50)
      return () => clearTimeout(t)
    }
  }, [visible, fadeMs])

  if (!rendered) return null

  return (
    <div
      className="fixed inset-0 z-[9990] flex flex-col items-center justify-center pointer-events-none"
      style={{
        background: "rgba(3,6,14,0.92)",
        opacity,
        transition: `opacity ${fadeMs}ms ease`,
        backdropFilter: "blur(4px)",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Spinner ring */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
          <div
            className="absolute inset-0 rounded-full border-2 border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent"
            style={{ animation: "spinRing 0.9s linear infinite" }}
          />
          <div
            className="absolute inset-1.5 rounded-full border border-t-purple-400/50 border-r-transparent border-b-transparent border-l-transparent"
            style={{ animation: "spinRing 1.4s linear infinite reverse" }}
          />
        </div>
        {message && (
          <p className="text-slate-400 text-xs font-medium tracking-widest uppercase">
            {message}
          </p>
        )}
      </div>

      <style jsx>{`
        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/**
 * Hook to manage a loading state with auto-minimum display time.
 * Prevents flash of loading state for fast operations.
 *
 * Usage:
 *   const { isLoading, startLoading, stopLoading } = useLoadingState(400)
 *   <LoadingOverlay visible={isLoading} message="Preparando duelo..." />
 */
export function useLoadingState(minDisplayMs = 400) {
  const [isLoading, setIsLoading] = useState(false)
  const startRef = { current: 0 }

  const startLoading = () => {
    startRef.current = Date.now()
    setIsLoading(true)
  }

  const stopLoading = () => {
    const elapsed = Date.now() - startRef.current
    const remaining = Math.max(0, minDisplayMs - elapsed)
    setTimeout(() => setIsLoading(false), remaining)
  }

  return { isLoading, startLoading, stopLoading }
}
