"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/contexts/language-context"
import { useGame, type Deck, type Card as GameCard, CARD_BACK_IMAGE } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MessageCircle, Send, X, Swords } from "lucide-react"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { ElementalAttackAnimation, type AttackAnimationProps } from "./elemental-attack-animation"

interface RoomData {
  roomId: string
  roomCode: string
  isHost: boolean
  hostId: string
  hostName: string
  hostDeck: Deck | null
  guestId: string | null
  guestName: string | null
  guestDeck: Deck | null
  hostReady: boolean
  guestReady: boolean
}

interface OnlineDuelScreenProps {
  roomData: RoomData
  onBack: () => void
}

type Phase = "draw" | "main" | "battle" | "end"

interface FieldCard extends GameCard {
  currentDp: number
  canAttack: boolean
  hasAttacked: boolean
  canAttackTurn: number
}

interface FunctionZoneCard extends GameCard {
  isFaceDown?: boolean
  isRevealing?: boolean
  isSettingDown?: boolean
}

interface FieldState {
  unitZone: (FieldCard | null)[]
  functionZone: (FunctionZoneCard | null)[]
  equipZone: GameCard | null
  scenarioZone: GameCard | null
  ultimateZone: FieldCard | null
  hand: GameCard[]
  deck: GameCard[]
  graveyard: GameCard[]
  tap: GameCard[]
  life: number
}

interface DuelAction {
  type: "draw" | "place_card" | "attack" | "end_turn" | "phase_change" | "damage" | "destroy_card" | "place_scenario" | "place_ultimate" | "surrender"
  playerId: string
  data: any
  timestamp: number
  source?: "hand" | "tap"
}

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  message: string
  created_at: string
}

interface AttackState {
  isAttacking: boolean
  attackerIndex: number | null
  targetInfo?: { type: "unit" | "direct"; index?: number } | null
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  gravity?: number
  heat?: number
  shape?: string
  rotation?: number
  rv?: number
}

interface ExplosionEffect {
  id: string
  x: number
  y: number
  element: string
  particles: Particle[]
  startTime: number
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const isUltimateCard = (card: GameCard | null): boolean => {
  if (!card) return false
  return card.type === "ultimateGear" || card.type === "ultimateGuardian"
}

const isUnitCard = (card: GameCard | null): boolean => {
  if (!card) return false
  return (
    card.type === "unit" ||
    card.type === "ultimateGear" ||
    card.type === "ultimateElemental" ||
    card.type === "ultimateGuardian" ||
    card.type === "troops"
  )
}

// Global projectile delay
const PROJECTILE_DURATION = 600

// Brotherhood Helpers
const isAvalonUnit = (card: GameCard) => {
  const name = card.name.toLowerCase()
  return name.includes("arthur") || 
         name.includes("morgana") || 
         name.includes("galahad") || 
         name.includes("vivian") || 
         name.includes("merlin") || 
         name.includes("mordred") || 
         name.includes("cavaleiro verde") || 
         name.includes("caveiro afogado")
}

const isGreatOrderUnit = (card: GameCard) => {
  const name = card.name.toLowerCase()
  return name.includes("fehnon") || name.includes("tsubasa")
}

const isScandinavianAngel = (card: GameCard) => {
  return card.name.toLowerCase().includes("scandinavian angel")
}

const isTormentaProminence = (card: GameCard) => {
  return card.name.toLowerCase().includes("jaden")
}

const isTroopUnit = (card: GameCard) => {
  return card.type === "troops"
}

const calculateCardDP = (card: GameCard, myField: FieldState, opponentField: FieldState, isEnemy: boolean): number => {
  let dp = card.dp
  
  // Scenarios from both players
  const scenarios = [
    { card: myField.scenarioZone, isPlayer: true },
    { card: opponentField.scenarioZone, isPlayer: false }
  ]

  scenarios.forEach(({ card: scenario, isPlayer: scenarioOwnerIsPlayer }) => {
    if (!scenario) return

    const ability = scenario.ability
    const isCardOwner = !isEnemy === scenarioOwnerIsPlayer

    if (ability === "RUÍNAS ABANDONADAS") {
      let applied = false
      if (isGreatOrderUnit(card)) {
        dp += 2
        applied = true
      }
      if (!applied && isTroopUnit(card)) {
        dp += 2
      }
    } else if (ability === "REINO DE CAMELOT") {
      let applied = false
      if (isAvalonUnit(card)) {
        dp += 3
        applied = true
      }
      if (!applied && card.element === "Darkus") {
        dp += 2
        applied = true
      }
      if (!applied && !isCardOwner) {
        dp -= 2
      }
    } else if (ability === "ARENA ESCANDINAVA") {
      let applied = false
      if (isScandinavianAngel(card)) {
        dp += 3
        applied = true
      }
      if (!applied && !isCardOwner) {
        dp -= 1
      }
    } else if (ability === "VILA DA PÓLVORA") {
      let applied = false
      if (isTormentaProminence(card)) {
        dp += 2
        applied = true
      }
      if (!applied && card.element === "Pyrus") {
        dp += 1
        applied = true
      }
      if (!applied && !isCardOwner) {
        dp -= 3
      }
    }
  })

  return Math.max(0, dp)
}

const getElementColors = (element: string): string[] => {
  const el = element?.toLowerCase()
  switch (el) {
    case "aquos":
    case "aquo":
      return ["#00bfff", "#0080ff", "#40e0d0", "#87ceeb", "#00ffff"]
    case "fire":
    case "pyrus":
      return ["#ff4500", "#ff6600", "#ff8c00", "#ffa500", "#ffcc00"]
    case "ventus":
      return ["#32cd32", "#00ff00", "#7cfc00", "#90ee90", "#adff2f"]
    case "darkness":
    case "darkus":
    case "dark":
      return ["#9932cc", "#8b008b", "#4b0082", "#800080", "#9400d3"]
    case "lightness":
    case "haos":
    case "light":
      return ["#ffd700", "#ffff00", "#fffacd", "#fff8dc", "#ffefd5"]
    case "void":
      return ["#c0c0c0", "#e0e0e0", "#a9a9a9", "#dcdcdc", "#ffffff"] // Silver-Gray
    case "terra":
      return ["#8b4513", "#a0522d", "#cd853f", "#d2691e", "#deb887"]
    default:
      return ["#ffffff", "#f0f0f0", "#e0e0e0", "#d0d0d0", "#c0c0c0"]
  }
}

const getElementGlow = (element: string): string => {
  const el = element?.toLowerCase()
  switch (el) {
    case "aquos":
    case "aquo":
      return "rgba(0, 191, 255, 0.8)"
    case "fire":
    case "pyrus":
      return "rgba(255, 69, 0, 0.8)"
    case "ventus":
      return "rgba(50, 205, 50, 0.8)"
    case "darkness":
    case "darkus":
    case "dark":
      return "rgba(153, 50, 204, 0.8)"
    case "lightness":
    case "haos":
    case "light":
      return "rgba(255, 215, 0, 0.8)"
    case "void":
      return "rgba(192, 192, 192, 0.8)" // Silver-Gray
    case "terra":
      return "rgba(139, 69, 19, 0.8)"
    default:
      return "rgba(255, 255, 255, 0.8)"
  }
}

export function OnlineDuelScreen({ roomData, onBack }: OnlineDuelScreenProps) {
  const { t } = useLanguage()
  const { getPlaymatForDeck, addMatchRecord } = useGame()
  const supabase = createClient()

  // If Supabase is not available, show error and go back
  if (!supabase) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <Swords className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Conexao Perdida</h2>
          <p className="text-slate-400 mb-4">Nao foi possivel conectar ao servidor de duelos.</p>
          <Button onClick={onBack}>Voltar ao Menu</Button>
        </div>
      </div>
    )
  }

  // Player identification
  const playerId = roomData.isHost ? roomData.hostId : roomData.guestId || ""
  const playerProfile = {
    name: roomData.isHost ? roomData.hostName : roomData.guestName || "Player",
  }
  const myDeck = roomData.isHost ? roomData.hostDeck : roomData.guestDeck
  const opponentDeck = roomData.isHost ? roomData.guestDeck : roomData.hostDeck

  // Game state
  const [turn, setTurn] = useState(1)
  const [phase, setPhase] = useState<Phase>("draw")
  const [isMyTurn, setIsMyTurn] = useState(roomData.isHost) // Host goes first
  const [gameResult, setGameResult] = useState<"won" | "lost" | null>(null)
  const [winReason, setWinReason] = useState<"surrender" | "combat" | "timeout" | null>(null)
  const [turnTimeLeft, setTurnTimeLeft] = useState(60)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Field states
  const [myField, setMyField] = useState<FieldState>({
    unitZone: [null, null, null, null],
    functionZone: [null, null, null, null],
    equipZone: null,
    scenarioZone: null,
    ultimateZone: null,
    hand: [],
    deck: [],
    graveyard: [],
    tap: [],
    life: 20,
  })

  const [opponentField, setOpponentField] = useState<FieldState>({
    unitZone: [null, null, null, null],
    functionZone: [null, null, null, null],
    equipZone: null,
    scenarioZone: null,
    ultimateZone: null,
    hand: [],
    deck: [],
    graveyard: [],
    tap: [],
    life: 20,
  })

  // UI state
  const [selectedHandCard, setSelectedHandCard] = useState<number | null>(null)
  const [attackState, setAttackState] = useState<AttackState>({
    isAttacking: false,
    attackerIndex: null,
    targetInfo: null,
  })
  const [attackTarget, setAttackTarget] = useState<{ type: "direct" | "unit"; index?: number } | null>(null)
  const [inspectedCard, setInspectedCard] = useState<GameCard | null>(null)
  const [graveyardView, setGraveyardView] = useState<"player" | "enemy" | null>(null)
  const [tapView, setTapView] = useState<"player" | "enemy" | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Drag and drop state
  const [draggedHandCard, setDraggedHandCard] = useState<{
    index: number
    card: GameCard
    currentY?: number
  } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ type: "unit" | "function" | "scenario" | "ultimate"; index: number } | null>(null)

  // Attack arrow state
  const [arrowPos, setArrowPos] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 })
  const [activeProjectiles, setActiveProjectiles] = useState<Omit<AttackAnimationProps, "onComplete">[]>([])

  // Refs
  const actionsChannelRef = useRef<RealtimeChannel | null>(null)
  const chatChannelRef = useRef<RealtimeChannel | null>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const cardPressTimer = useRef<NodeJS.Timeout | null>(null)
  const positionRef = useRef({ startX: 0, startY: 0, currentX: 0, currentY: 0 })
  const gameResultRecordedRef = useRef(false)
  const draggedCardRef = useRef<HTMLDivElement>(null)
  const dragPosRef = useRef({ x: 0, y: 0, rotation: 0, lastCheck: 0 })
  const isDraggingRef = useRef(false)
  const animationInProgressRef = useRef(false)
  const attackIdRef = useRef(0)
  const processedActionIdsRef = useRef<Set<string>>(new Set())
  const [droppingCard, setDroppingCard] = useState<{
    card: GameCard
    targetX: number
    targetY: number
  } | null>(null)

  const [screenShake, setScreenShake] = useState({ active: false, intensity: 0 })
  const [impactFlash, setImpactFlash] = useState<{ active: boolean; color: string }>({
    active: false,
    color: "#ffffff",
  })
  const [effectFeedback, setEffectFeedback] = useState<{
    message: string
    type: "success" | "error" | "warning"
    active: boolean
  } | null>(null)

  const opponentName = roomData.isHost ? roomData.guestName || "Guest" : roomData.hostName || "Host"

  const triggerScreenShake = useCallback((intensity: number = 5, duration: number = 150) => {
    setScreenShake({ active: true, intensity })
    setTimeout(() => setScreenShake({ active: false, intensity: 0 }), duration)
  }, [])
  const explosionCanvasRef = useRef<HTMLCanvasElement>(null)
  const activeParticlesRef = useRef<Map<string, {
    particles: Particle[],
    startTime: number,
    element: string,
    x: number,
    y: number
  }>>(new Map())
  const enemyUnitRectsRef = useRef<DOMRect[]>([])
  const playerUnitRectsRef = useRef<DOMRect[]>([])

  // Draw card animation state
  const [drawAnimation, setDrawAnimation] = useState<{
    visible: boolean
    cardName: string
    cardImage: string
    cardType: string
  } | null>(null)

  // explosionEffects was missing useState — this was the crash
  const [explosionEffects, setExplosionEffects] = useState<ExplosionEffect[]>([])
  // Helper to show effect feedback
  const showEffectFeedback = useCallback((message: string, type: "success" | "error" | "warning" = "success") => {
    setEffectFeedback({ active: true, message, type })
    setTimeout(() => setEffectFeedback(null), 3000)
  }, [])

  const triggerCameraShake = useCallback(() => {
    const startTime = Date.now()
    const duration = 150
    const intensity = 3

    const shake = () => {
      const elapsed = Date.now() - startTime
      if (elapsed < duration) {
        if (fieldRef.current) {
          const x = (Math.random() - 0.5) * intensity
          const y = (Math.random() - 0.5) * intensity
          fieldRef.current.style.transform = `translate(${x}px, ${y}px)`
        }
        requestAnimationFrame(shake)
      } else {
        if (fieldRef.current) fieldRef.current.style.transform = ""
      }
    }
    requestAnimationFrame(shake)
  }, [])

  const triggerExplosion = useCallback((targetX: number, targetY: number, element: string) => {
    const el = element?.toLowerCase()
    const colors = getElementColors(element)
    const particles: Particle[] = []

    // Screen shake on impact
    const shakeIntensity = el === "fire" || el === "terra" || el === "pyrus" ? 8 : 4
    triggerScreenShake(shakeIntensity, 150)

    // AQUO/AQUOS - Hyper-focused water impact
    if (el === "aquos" || el === "aquo") {
      for (let i = 0; i < 35; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.5 + Math.random() * 2.5 // Reduced speed
        particles.push({
          x: targetX, y: targetY,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
          size: 1.5 + Math.random() * 3.5, color: colors[Math.floor(Math.random() * colors.length)], alpha: 1,
        })
      }
      for (let i = 0; i < 12; i++) {
        particles.push({
          x: targetX + (Math.random() - 0.5) * 12, y: targetY + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 0.7, vy: -1.5 - Math.random() * 1.5,
          size: 3 + Math.random() * 3, color: "#ffffff", alpha: 0.8,
        })
      }
    }
    // Element-specific particle generation for 1000x polish
    if (el === "aquos" || el === "aquo") {
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 5
        particles.push({
          x: targetX, y: targetY,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1, gravity: 0.08
        })
      }
    } else if (el === "fire" || el === "pyrus") {
      for (let i = 0; i < 45; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 3 + Math.random() * 6
        particles.push({
          x: targetX, y: targetY,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1, heat: -0.05
        })
      }
    } else if (el === "ventus") {
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 3.5 + Math.random() * 5.5
        particles.push({
          x: targetX, y: targetY,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1, gravity: 0.08
        })
      }
    } else if (el === "darkness" || el === "darkus" || el === "dark") {
      for (let i = 0; i < 45; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist = 30 + Math.random() * 35
        const x = targetX + Math.cos(angle) * dist
        const y = targetY + Math.sin(angle) * dist
        particles.push({
          x, y,
          vx: (targetX - x) * 0.14, vy: (targetY - y) * 0.14,
          size: 2 + Math.random() * 4,
          color: i % 4 === 0 ? "#000000" : colors[Math.floor(Math.random() * colors.length)],
          alpha: 1
        })
      }
    } else if (el === "void") {
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2.5 + Math.random() * 7
        particles.push({
          x: targetX, y: targetY,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 5,
          color: i % 2 === 0 ? "#c0c0c0" : "#dcdcdc",
          alpha: 1, shape: "shard", rotation: Math.random() * Math.PI, rv: (Math.random() - 0.5) * 0.2
        })
      }
    } else {
      // Default / Lightness / Terra refined
      const count = (el === "lightness" || el === "haos" || el === "light") ? 55 : 35
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 6
        particles.push({
          x: targetX, y: targetY,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          gravity: el === "terra" ? 0.12 : 0.05
        })
      }
    }


    const effectId = `explosion-${Date.now()}`
    const startTime = Date.now()
    setExplosionEffects((prev) => [...prev, { id: effectId, x: targetX, y: targetY, element, particles, startTime }])

    // Enhanced impact flash logic
    const flashColors: Record<string, string> = {
      aquos: "rgba(0, 191, 255, 0.5)",
      aquo: "rgba(0, 191, 255, 0.5)",
      fire: "rgba(255, 69, 0, 0.6)",
      pyrus: "rgba(255, 69, 0, 0.6)",
      ventus: "rgba(50, 205, 50, 0.5)",
      darkness: "rgba(128, 0, 128, 0.6)",
      darkus: "rgba(128, 0, 128, 0.6)",
      dark: "rgba(128, 0, 128, 0.6)",
      lightness: "rgba(255, 215, 0, 0.6)",
      haos: "rgba(255, 215, 0, 0.6)",
      light: "rgba(255, 215, 0, 0.6)",
      void: "rgba(192, 192, 192, 0.6)",
      terra: "rgba(139, 69, 19, 0.6)",
    }
    setImpactFlash({ active: true, color: flashColors[el] || "rgba(255, 255, 255, 0.4)" })
    setTimeout(() => setImpactFlash({ active: false, color: "#ffffff" }), 100) // Snapier flash

    setTimeout(() => {
      setExplosionEffects((prev) => prev.filter((e) => e.id !== effectId))
    }, 1100) // Snappier decay
  }, [])

  const handleImpact = useCallback((id: string, x: number, y: number, element: string) => {
    // Add a quick flash before explosion
    setImpactFlash({ active: true, color: "rgba(255, 255, 255, 0.6)" })
    setTimeout(() => setImpactFlash({ active: false, color: "#ffffff" }), 16)

    triggerCameraShake()
    triggerExplosion(x, y, element)
  }, [triggerCameraShake])


  // Animation Rendering Loop
  useEffect(() => {
    if (explosionEffects.length === 0) {
      // Still need to clear if something was there
      const canvas = explosionCanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const canvas = explosionCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    const duration = 1100

    const animate = () => {
      const now = Date.now()
      const activeEffects = activeParticlesRef.current

      // Add new effects
      explosionEffects.forEach((effect) => {
        if (!activeEffects.has(effect.id)) {
          activeEffects.set(effect.id, {
            particles: effect.particles.map((p: any) => ({ ...p })),
            startTime: effect.startTime,
            element: effect.element,
            x: effect.x,
            y: effect.y
          })
        }
      })

      // Cleanup
      for (const [id, effect] of activeEffects.entries()) {
        if (now - effect.startTime > duration) {
          activeEffects.delete(id)
        }
      }

      if (activeEffects.size === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      // Dynamic resize
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      activeEffects.forEach((effect) => {
        const elapsed = now - effect.startTime
        if (elapsed > duration) return

        const el = effect.element?.toLowerCase()
        const colors = getElementColors(effect.element)

        // Rendering logic (Hyper-focused rings, etc.)
        if (el === "aquos" || el === "aquo") {
          for (let ring = 0; ring < 5; ring++) {
            const ringProgress = Math.min(1, (elapsed - ring * 80) / 350)
            if (ringProgress > 0 && ringProgress < 1) {
              const ringRadius = ringProgress * 65
              ctx.save()
              ctx.globalAlpha = (1 - ringProgress) * 0.4
              ctx.strokeStyle = colors[ring % colors.length]
              ctx.lineWidth = 1 + (1 - ringProgress) * 3
              ctx.shadowColor = "#00bfff"
              ctx.shadowBlur = 10
              ctx.beginPath()
              for (let a = 0; a < Math.PI * 2; a += 0.2) {
                const r = ringRadius + Math.sin(a * 4 + elapsed * 0.01) * 3
                const rx = effect.x + Math.cos(a) * r
                const ry = effect.y + Math.sin(a) * r
                if (a === 0) ctx.moveTo(rx, ry)
                else ctx.lineTo(rx, ry)
              }
              ctx.closePath()
              ctx.stroke()
              ctx.restore()
            }
          }
        } else if (el === "fire" || el === "pyrus") {
           const rp = Math.min(1, elapsed / 300)
           if (rp < 1) {
             ctx.save()
             ctx.globalAlpha = (1 - rp) * 0.8
             ctx.strokeStyle = "#ff4500"
             ctx.lineWidth = 2 + (1 - rp) * 8
             ctx.beginPath()
             for (let a = 0; a < Math.PI * 2; a += 0.3) {
               const r = rp * 75 + (Math.random() - 0.5) * 10
               ctx.lineTo(effect.x + Math.cos(a) * r, effect.y + Math.sin(a) * r)
             }
             ctx.closePath()
             ctx.stroke()
             ctx.restore()
           }
        } else if (el === "lightness" || el === "haos" || el === "light") {
          const progress = Math.min(1, elapsed / 400)
          ctx.save()
          ctx.strokeStyle = "#ffd700"
          ctx.setLineDash([5, 5])
          const flareLen = 40 * (1 - progress)
          ctx.beginPath()
          ctx.moveTo(effect.x - flareLen, effect.y); ctx.lineTo(effect.x + flareLen, effect.y)
          ctx.moveTo(effect.x, effect.y - flareLen); ctx.lineTo(effect.x, effect.y + flareLen)
          ctx.stroke()
          ctx.restore()
        } else if (el === "ventus") {
          const spiralProgress = Math.min(1, elapsed / 400)
          if (spiralProgress < 1) {
            ctx.save()
            ctx.globalAlpha = (1 - spiralProgress) * 0.6
            ctx.strokeStyle = "#32cd32"
            ctx.beginPath()
            for (let angle = 0; angle < Math.PI * 4; angle += 0.2) {
              const radius = angle * 4 * spiralProgress
              ctx.lineTo(effect.x + Math.cos(angle + elapsed * 0.018) * radius, effect.y + Math.sin(angle + elapsed * 0.018) * radius)
            }
            ctx.stroke()
            ctx.restore()
          }
        } else if (el === "void") {
          for (let i = 0; i < 5; i++) {
            const crackAngle = (Math.PI * 2 * i) / 5
            const crackProgress = Math.min(1, elapsed / 350)
            if (crackProgress < 1) {
              ctx.save()
              ctx.globalAlpha = (1 - crackProgress) * 0.8
              ctx.strokeStyle = "#c0c0c0"
              ctx.beginPath()
              ctx.moveTo(effect.x, effect.y)
              let cx = effect.x, cy = effect.y
              for (let j = 0; j < 3; j++) {
                cx += Math.cos(crackAngle + (Math.random() - 0.5) * 0.8) * 15
                cy += Math.sin(crackAngle + (Math.random() - 0.5) * 0.8) * 15
                ctx.lineTo(cx, cy)
              }
              ctx.stroke()
              ctx.restore()
            }
          }
        }

        // Particles
        effect.particles.forEach((p: any) => {
          if (p.gravity) p.vy += p.gravity
          if (p.heat) p.vy += p.heat
          if (p.rotation !== undefined) p.rotation += (p.rv || 0.1)

          p.x += p.vx
          p.y += p.vy
          p.alpha -= 0.02
          p.size *= 0.97

          if (p.alpha > 0 && p.size > 0.5) {
            ctx.save()
            ctx.translate(p.x, p.y)
            if (p.rotation !== undefined) ctx.rotate(p.rotation)
            ctx.globalAlpha = p.alpha
            ctx.fillStyle = p.color
            if (el === "haos" || el === "light" || el === "fire" || el === "pyrus") {
              ctx.shadowColor = p.color
              ctx.shadowBlur = 10
            }
            if (p.shape === "shard") {
              ctx.beginPath()
              ctx.moveTo(0, -p.size); ctx.lineTo(p.size, p.size); ctx.lineTo(-p.size, p.size); ctx.closePath()
              ctx.fill()
            } else {
              ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill()
            }
            ctx.restore()
          }
        })

        // Glow
        const glowAlpha = Math.max(0, 1 - elapsed / 600)
        if (glowAlpha > 0) {
          const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, 100)
          gradient.addColorStop(0, getElementGlow(effect.element).replace("0.8", String(glowAlpha * 0.6)))
          gradient.addColorStop(1, "transparent")
          ctx.fillStyle = gradient
          ctx.fillRect(effect.x - 100, effect.y - 100, 200, 200)
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [explosionEffects])

  // Initialize game
  useEffect(() => {
    console.log("[v0] Initialize useEffect running, myDeck:", myDeck?.name)
    if (!myDeck) {
      console.log("[v0] No myDeck found, skipping initialization")
      return
    }

    // Shuffle deck and draw initial hand
    const shuffledDeck = shuffleArray([...myDeck.cards])
    const initialHand = shuffledDeck.slice(0, 5)
    const remainingDeck = shuffledDeck.slice(5)

    console.log("[v0] Setting initial hand with", initialHand.length, "cards")
    console.log("[v0] Initial hand cards:", initialHand.map(c => c.name))

    setMyField((prev) => ({
      ...prev,
      deck: remainingDeck,
      hand: initialHand,
      tap: myDeck.tapCards ? [...myDeck.tapCards] : [],
    }))

    // Set opponent initial deck size
    if (opponentDeck) {
      setOpponentField((prev) => ({
        ...prev,
        deck: Array(opponentDeck.cards.length - 5).fill(null),
        hand: Array(5).fill(null),
        tap: opponentDeck.tapCards ? [...opponentDeck.tapCards] : [],
      }))
    }

    // Start turn timer
    startTurnTimer()

    // Subscribe to game actions
    subscribeToActions()
    subscribeToChat()

    // Send initial state to opponent
    sendAction({
      type: "draw",
      playerId,
      data: { handSize: initialHand.length, deckSize: remainingDeck.length },
      timestamp: Date.now(),
    })

    return () => {
      if (actionsChannelRef.current) {
        actionsChannelRef.current.unsubscribe()
      }
      if (chatChannelRef.current) {
        chatChannelRef.current.unsubscribe()
      }
    }
  }, [])

  // Subscribe to game actions
  const subscribeToActions = useCallback(() => {
    console.log("[v0] Subscribing to actions for room:", roomData.roomId)
    const channel = supabase
      .channel(`duel-actions-${roomData.roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "duel_actions",
          filter: `room_id=eq.${roomData.roomId}`,
        },
        (payload: { new: any }) => {
          console.log("[v0] Received action payload:", payload)
          const actionFromDb = payload.new
          let actionData = actionFromDb.action_data
          if (typeof actionData === "string") {
            try {
              actionData = JSON.parse(actionData)
            } catch {
              // Keep as is
            }
          }

          if (actionFromDb.player_id !== playerId) {
            console.log("[v0] Processing opponent action")
            handleOpponentAction(actionData)
          } else {
            console.log("[v0] Skipping own action")
          }
        }
      )
      .subscribe()

    actionsChannelRef.current = channel
  }, [supabase, roomData.roomId, playerId])

  // Subscribe to chat
  const subscribeToChat = useCallback(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from("duel_chat")
        .select("*")
        .eq("room_id", roomData.roomId)
        .order("created_at", { ascending: true })

      if (data) {
        setChatMessages(data)
      }
    }
    loadMessages()

    const channel = supabase
      .channel(`duel-chat-${roomData.roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "duel_chat",
          filter: `room_id=eq.${roomData.roomId}`,
        },
        (payload: { new: any }) => {
          setChatMessages((prev) => [...prev, payload.new as ChatMessage])
        }
      )
      .subscribe()

    chatChannelRef.current = channel
  }, [supabase, roomData.roomId])

  // Send action to database
  const sendAction = useCallback(async (action: DuelAction) => {
    console.log("[v0] Sending action:", action.type, action)

    // Get the next sequence number for this room
    const { data: seqData } = await supabase.rpc('get_next_action_sequence', {
      p_room_id: roomData.roomId
    })
    const sequenceNumber = seqData || 1

    const { error } = await supabase.from("duel_actions").insert({
      room_id: roomData.roomId,
      player_id: playerId,
      action_type: action.type,
      action_data: JSON.stringify(action),
      sequence_number: sequenceNumber,
    })
    if (error) {
      console.error("[v0] Error sending action:", error)
    } else {
      console.log("[v0] Action sent successfully with sequence:", sequenceNumber)
    }
  }, [supabase, roomData.roomId, playerId])

  // Handle opponent's action
   const handleOpponentAction = (action: DuelAction) => {
    // Deduplicate by timestamp + type
    const actionId = `${action.type}-${action.timestamp}`
    if (processedActionIdsRef.current.has(actionId)) {
      console.log("[v0] Ignoring duplicate opponent action:", actionId)
      return
    }
    processedActionIdsRef.current.add(actionId)

    console.log("[v0] Received opponent action:", action.type, action)

    switch (action.type) {
      case "draw":
        setOpponentField((prev) => ({
          ...prev,
          hand: Array(action.data.handSize).fill(null),
          deck: Array(action.data.deckSize).fill(null),
        }))
        break

      case "place_card": {
        const source = action.data.source || "hand"
        const cardData = action.data.card

        if (action.data.zone === "unit") {
          setOpponentField((prev) => {
            const newUnitZone = [...prev.unitZone]
            newUnitZone[action.data.index] = {
              ...cardData,
              currentDp: calculateCardDP(cardData, opponentField, myField, true),
              canAttack: false,
              hasAttacked: false,
              canAttackTurn: turn,
            }
            const newState = { ...prev, unitZone: newUnitZone }
            if (source === "tap") {
              newState.tap = prev.tap.filter(c => c.id !== cardData.id)
            } else {
              newState.hand = prev.hand.slice(0, -1)
            }
            return newState
          })
        } else if (action.data.zone === "function") {
          setOpponentField((prev) => {
            const newFunctionZone = [...prev.functionZone]
            const functionCard: FunctionZoneCard = action.data.isTrap
              ? {
                ...cardData,
                isFaceDown: true,
                isRevealing: false,
                isSettingDown: true,
              }
              : cardData

            newFunctionZone[action.data.index] = functionCard

            if (action.data.isTrap) {
              setTimeout(() => {
                setOpponentField((p) => {
                  const updatedZone = [...p.functionZone]
                  const trap = updatedZone[action.data.index]
                  if (trap && (trap as FunctionZoneCard).isSettingDown) {
                    updatedZone[action.data.index] = { ...trap, isSettingDown: false } as FunctionZoneCard
                  }
                  return { ...p, functionZone: updatedZone }
                })
              }, 500)
            }

            const newState = { ...prev, functionZone: newFunctionZone }
            if (source === "tap") {
              newState.tap = prev.tap.filter(c => c.id !== cardData.id)
            } else {
              newState.hand = prev.hand.slice(0, -1)
            }
            return newState
          })
        }
        break
      }

      case "place_scenario": {
        const source = action.data.source || "hand"
        const cardData = action.data.card
        setOpponentField((prev) => {
          const newHand = source === "tap" ? prev.hand : prev.hand.slice(0, -1)
          const newTap = source === "tap" ? prev.tap.filter(c => c.id !== cardData.id) : prev.tap
          
          const newState = { 
            ...prev, 
            scenarioZone: cardData, 
            hand: newHand,
            tap: newTap,
            unitZone: prev.unitZone.map(u => u ? { ...u, currentDp: calculateCardDP(u, prev, myField, true) } : null)
          }

          // Update my units if scenario has debuffs/buffs
          setMyField(myPrev => ({
            ...myPrev,
            unitZone: myPrev.unitZone.map(u => u ? { ...u, currentDp: calculateCardDP(u, myPrev, newState, false) } : null)
          }))

          // Scenario "Draw on play" for opponent (represented by hand size change)
          if (cardData.ability === "RUÍNAS ABANDONADAS" || cardData.ability === "ARENA ESCANDINAVA") {
             newState.hand = [...newState.hand, null as any]
             newState.deck = newState.deck.slice(1)
             showEffectFeedback(`Oponente: ${cardData.name} ativado! Oponente comprou 1 carta.`, "success")
          }

          return newState
        })
        break
      }

      case "place_ultimate": {
        const source = action.data.source || "hand"
        const cardData = action.data.card
        setOpponentField((prev) => {
          const newState = {
            ...prev,
            ultimateZone: {
              ...cardData,
              currentDp: cardData.dp,
              canAttack: false,
              hasAttacked: false,
              canAttackTurn: turn,
            }
          }
          if (source === "tap") {
            newState.tap = prev.tap.filter(c => c.id !== cardData.id)
          } else {
            newState.hand = prev.hand.slice(0, -1)
          }
          return newState
        })
        break
      }

      case "attack":
        const { attackerIndex, targetType, targetIndex, damage } = action.data

        // Projectile animation from opponent
        let targetX = 0
        let targetY = 0
        let targetFound = false

        if (targetType === "direct") {
          const directTarget = document.querySelector('[data-direct-attack]')
          if (directTarget) {
            const rect = directTarget.getBoundingClientRect()
            targetX = rect.left + rect.width / 2
            targetY = rect.top + rect.height / 2
            targetFound = true
          }
        } else if (targetType === "unit") {
          const targetSlot = document.querySelector(`[data-player-unit-slot="${targetIndex}"]`)
          if (targetSlot) {
            const rect = targetSlot.getBoundingClientRect()
            targetX = rect.left + rect.width / 2
            targetY = rect.top + rect.height / 2
            targetFound = true
          }
        }

        if (targetFound) {
          const attackerElement = document.querySelector(`[data-enemy-unit="${attackerIndex}"]`)
          const attackerRect = attackerElement?.getBoundingClientRect()
          const startX = attackerRect ? attackerRect.left + attackerRect.width / 2 : window.innerWidth / 2
          const startY = attackerRect ? attackerRect.top + attackerRect.height / 2 : window.innerHeight / 2

          const attacker = opponentField.unitZone[attackerIndex] as FieldCard
          if (attacker) {
            const projId = `opp-proj-${Date.now()}`
            setActiveProjectiles((prev) => [
              ...prev,
              {
                id: projId,
                startX,
                startY,
                targetX: targetX,
                targetY: targetY,
                element: attacker.element || "neutral",
                attackerImage: attacker.image,
                isDirect: targetType === "direct"
              },
            ])
          }
        }

        setTimeout(() => {
          if (targetType === "direct") {
            if (targetFound) {
              handleImpact("", targetX, targetY, action.data.card?.element || "neutral")
            }
            setMyField((prev) => ({
              ...prev,
              life: Math.max(0, prev.life - damage),
            }))
          } else if (targetType === "unit") {
            if (targetFound) {
              handleImpact("", targetX, targetY, action.data.card?.element || "neutral")
            }

            setMyField((prev) => {
              const newUnitZone = [...prev.unitZone]
              const newGraveyard = [...prev.graveyard]
              const target = newUnitZone[targetIndex]
              if (target) {
                target.currentDp -= damage
                if (target.currentDp <= 0) {
                  newGraveyard.push(target)
                  newUnitZone[targetIndex] = null
                }
              }
              return { ...prev, unitZone: newUnitZone, graveyard: newGraveyard }
            })
          }
        }, PROJECTILE_DURATION)
        break

      case "damage":
        if (action.data.target === "player") {
          setMyField((prev) => ({
            ...prev,
            life: Math.max(0, prev.life - action.data.amount),
          }))
        }
        break

      case "end_turn":
        console.log("[v0] Received end_turn action from opponent")
        console.log("[v0] Setting isMyTurn to true")
        setIsMyTurn(true)
        setTurn((prev) => {
          console.log("[v0] Incrementing turn from", prev, "to", prev + 1)
          return prev + 1
        })
        setPhase("draw")
        console.log("[v0] Changed phase to draw")

        // Enable my units to attack
        setMyField((prev) => ({
          ...prev,
          unitZone: prev.unitZone.map((unit) =>
            unit && turn >= unit.canAttackTurn ? { ...unit, canAttack: true, hasAttacked: false } : unit
          ),
          ultimateZone: prev.ultimateZone && turn >= prev.ultimateZone.canAttackTurn
            ? { ...prev.ultimateZone, canAttack: true, hasAttacked: false }
            : prev.ultimateZone,
        }))
        break

      case "surrender":
        console.log("[v0] Received surrender action from opponent")
        if (!gameResultRecordedRef.current) {
          gameResultRecordedRef.current = true
          setWinReason("surrender")
          setGameResult("won")
          endGame("won")
        }
        break

      case "phase_change":
        // Visual feedback for opponent's phase change
        break
    }

    // Check for game over
    checkGameOver()
  }

  // Check for game over
  const checkGameOver = useCallback(() => {
    if (gameResultRecordedRef.current) return

    if (myField.life <= 0) {
      gameResultRecordedRef.current = true
      setGameResult("lost")
      endGame("lost")
    } else if (opponentField.life <= 0) {
      gameResultRecordedRef.current = true
      setGameResult("won")
      endGame("won")
    }
  }, [myField.life, opponentField.life])

  // End the game
  const endGame = async (result: "won" | "lost") => {
    addMatchRecord({
      id: `online-${Date.now()}`,
      date: new Date().toISOString(),
      opponent: opponentName || "Jogador Online",
      mode: "player",
      result,
      deckUsed: myDeck?.name || "Unknown",
    })

    // Update room status
    await supabase.from("duel_rooms").update({ status: "finished" }).eq("id", roomData.roomId)
  }

  // Check game over on life changes
  useEffect(() => {
    checkGameOver()
  }, [myField.life, opponentField.life, checkGameOver])

  // Global drag event listeners - using refs to avoid stale closures
  const draggedHandCardRef2 = useRef(draggedHandCard)
  const dropTargetRef = useRef(dropTarget)
  const myFieldRef = useRef(myField)
  const isMyTurnRef = useRef(isMyTurn)
  const phaseRef = useRef(phase)
  const turnRef = useRef(turn)
  const sendActionRef = useRef(sendAction)
  const playerIdRef = useRef(playerId)

  // Keep refs in sync
  useEffect(() => {
    draggedHandCardRef2.current = draggedHandCard
  }, [draggedHandCard])

  useEffect(() => {
    dropTargetRef.current = dropTarget
  }, [dropTarget])

  useEffect(() => {
    console.log("[v0] myField changed - hand size:", myField.hand.length, "cards:", myField.hand.map(c => c?.name))
    myFieldRef.current = myField
  }, [myField])

  useEffect(() => {
    console.log("[v0] isMyTurn changed to:", isMyTurn)
    isMyTurnRef.current = isMyTurn
  }, [isMyTurn])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    turnRef.current = turn
  }, [turn])

  useEffect(() => {
    sendActionRef.current = sendAction
  }, [sendAction])

  useEffect(() => {
    playerIdRef.current = playerId
  }, [playerId])

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      const dragged = draggedHandCardRef2.current
      if (!dragged || !draggedCardRef.current) return

      e.preventDefault()

      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX
      const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY

      // Calculate rotation based on horizontal movement
      const deltaX = clientX - dragPosRef.current.x
      const targetRotation = Math.max(-10, Math.min(10, deltaX * 0.8))
      dragPosRef.current.rotation = targetRotation * 0.4 + dragPosRef.current.rotation * 0.6
      dragPosRef.current.x = clientX
      dragPosRef.current.y = clientY

      // Update ghost DOM directly for smooth movement
      const isOverTarget = dropTargetRef.current !== null
      draggedCardRef.current.style.transform = `translate(${clientX - 40}px, ${clientY - 56}px) rotate(${isOverTarget ? 0 : dragPosRef.current.rotation}deg) scale(${isOverTarget ? 1.2 : 1.1})`

      // Throttled drop target check
      const now = Date.now()
      if (!dragPosRef.current.lastCheck || now - dragPosRef.current.lastCheck > 50) {
        dragPosRef.current.lastCheck = now

        const elements = document.elementsFromPoint(clientX, clientY)
        let foundTarget: { type: "unit" | "function" | "scenario" | "ultimate"; index: number } | null = null
        const currentField = myFieldRef.current

        for (const el of elements) {
          const unitSlot = el.closest("[data-player-unit-slot]")
          const funcSlot = el.closest("[data-player-func-slot]")
          const scenarioSlot = el.closest("[data-player-scenario-slot]")
          const ultimateSlot = el.closest("[data-player-ultimate-slot]")

          if (ultimateSlot && isUltimateCard(dragged.card)) {
            if (!currentField.ultimateZone) {
              foundTarget = { type: "ultimate", index: 0 }
              break
            }
          } else if (unitSlot && isUnitCard(dragged.card) && !isUltimateCard(dragged.card)) {
            const slotIndex = Number.parseInt(unitSlot.getAttribute("data-player-unit-slot") || "0")
            if (!currentField.unitZone[slotIndex]) {
              foundTarget = { type: "unit", index: slotIndex }
              break
            }
          } else if (funcSlot && !isUnitCard(dragged.card) && dragged.card.type !== "scenario" && dragged.card.type !== "ultimateGear" && dragged.card.type !== "ultimateGuardian") {
            const slotIndex = Number.parseInt(funcSlot.getAttribute("data-player-func-slot") || "0")
            if (!currentField.functionZone[slotIndex]) {
              foundTarget = { type: "function", index: slotIndex }
              break
            }
          } else if (scenarioSlot && dragged.card.type === "scenario") {
            if (!currentField.scenarioZone) {
              foundTarget = { type: "scenario", index: 0 }
              break
            }
          }
        }

        if (foundTarget?.type !== dropTargetRef.current?.type || foundTarget?.index !== dropTargetRef.current?.index) {
          setDropTarget(foundTarget as any)
        }
      }
    }

    const handleGlobalEnd = () => {
      const dragged = draggedHandCardRef2.current
      const target = dropTargetRef.current
      const currentField = myFieldRef.current
      const currentIsMyTurn = isMyTurnRef.current
      const currentPhase = phaseRef.current
      const currentTurn = turnRef.current
      const currentSendAction = sendActionRef.current
      const currentPlayerId = playerIdRef.current

      if (!dragged) {
        setDropTarget(null)
        return
      }

      if (target && currentIsMyTurn && currentPhase === "main") {
        const targetSelector =
          target.type === "unit"
            ? `[data-player-unit-slot="${target.index}"]`
            : target.type === "function"
              ? `[data-player-func-slot="${target.index}"]`
              : (target.type as string) === "ultimate"
                ? `[data-player-ultimate-slot]`
                : `[data-player-scenario-slot]`
        const targetElement = document.querySelector(targetSelector)
        const targetRect = targetElement?.getBoundingClientRect()

        const cardIndex = dragged.index
        const targetType = target.type
        const targetIndex = target.index
        const cardToPlay = dragged.card

        // Directly update the field state instead of calling functions with stale closures
        if ((targetType as string) === "ultimate" && isUltimateCard(cardToPlay) && !currentField.ultimateZone) {
          setMyField((prev) => {
            const newHand = prev.hand.filter((_, i) => i !== cardIndex)
            return {
              ...prev,
              ultimateZone: {
                ...cardToPlay,
                currentDp: cardToPlay.dp,
                canAttack: false,
                hasAttacked: false,
                canAttackTurn: currentTurn,
              },
              hand: newHand,
            }
          })
          currentSendAction({
            type: "place_ultimate",
            playerId: currentPlayerId,
            data: { card: cardToPlay },
            timestamp: Date.now(),
          })
        } else if (targetType === "scenario" && cardToPlay.type === "scenario" && !currentField.scenarioZone) {
          setMyField((prev) => {
            const newHand = prev.hand.filter((_, i) => i !== cardIndex)
            let newDeck = prev.deck
            const scenario = cardToPlay

            // Draw 1 on play
            if (scenario.ability === "RUÍNAS ABANDONADAS" || scenario.ability === "ARENA ESCANDINAVA") {
              if (newDeck.length > 0) {
                const drawn = newDeck[0]
                newDeck = newDeck.slice(1)
                newHand.push(drawn)
                setTimeout(() => {
                  showDrawAnimation(drawn)
                  showEffectFeedback(`${scenario.name}: Comprou 1 carta!`, "success")
                }, 300)
              }
            }

            const newState = {
              ...prev,
              scenarioZone: scenario,
              hand: newHand,
              deck: newDeck,
              unitZone: prev.unitZone.map(u => u ? { ...u, currentDp: calculateCardDP(u, prev, opponentField, false) } : null)
            }

            // Update opponent units
            setOpponentField(oppPrev => ({
              ...oppPrev,
              unitZone: oppPrev.unitZone.map(u => u ? { ...u, currentDp: calculateCardDP(u, oppPrev, newState, true) } : null)
            }))

            if (scenario.ability === "REINO DE CAMELOT" || scenario.ability === "VILA DA PÓLVORA") {
              setTimeout(() => showEffectFeedback(`${scenario.name} ativado! O campo mudou!`, "success"), 500)
            }

            return newState
          })
          currentSendAction({
            type: "place_scenario", // Changed from place_card for better tracking if needed, though handleOpponentAction supports both
            playerId: currentPlayerId,
            data: { zone: "scenario", index: 0, card: cardToPlay },
            timestamp: Date.now(),
          })
        } else if (targetType === "unit" && isUnitCard(cardToPlay) && !isUltimateCard(cardToPlay)) {
          if (!currentField.unitZone[targetIndex]) {
            setMyField((prev) => {
              const newHand = prev.hand.filter((_, i) => i !== cardIndex)
              const newUnitZone = [...prev.unitZone]
              newUnitZone[targetIndex] = {
                ...cardToPlay,
                currentDp: calculateCardDP(cardToPlay, prev, opponentField, false),
                canAttack: false,
                hasAttacked: false,
                canAttackTurn: currentTurn,
              }
              return { ...prev, unitZone: newUnitZone, hand: newHand }
            })
            currentSendAction({
              type: "place_card",
              playerId: currentPlayerId,
              data: { zone: "unit", index: targetIndex, card: cardToPlay },
              timestamp: Date.now(),
            })
          }
        } else if (targetType === "function" && !isUnitCard(cardToPlay) && cardToPlay.type !== "scenario" && cardToPlay.type !== "ultimateGear" && cardToPlay.type !== "ultimateGuardian") {
          if (!currentField.functionZone[targetIndex]) {
            setMyField((prev) => {
              const newHand = prev.hand.filter((_, i) => i !== cardIndex)
              const newFunctionZone = [...prev.functionZone]
              newFunctionZone[targetIndex] = cardToPlay
              return { ...prev, functionZone: newFunctionZone, hand: newHand }
            })
            currentSendAction({
              type: "place_card",
              playerId: currentPlayerId,
              data: { zone: "function", index: targetIndex, card: cardToPlay },
              timestamp: Date.now(),
            })
          }
        }

        setSelectedHandCard(null)

        // Show materialize animation
        if (targetRect) {
          const targetX = targetRect.left + targetRect.width / 2
          const targetY = targetRect.top + targetRect.height / 2

          setDroppingCard({
            card: cardToPlay,
            targetX,
            targetY,
          })

          setTimeout(() => {
            setDroppingCard(null)
          }, 500)
        }
      }

      // Always clear drag state
      setDraggedHandCard(null)
      setDropTarget(null)
    }

    window.addEventListener("mousemove", handleGlobalMove)
    window.addEventListener("mouseup", handleGlobalEnd)
    window.addEventListener("touchmove", handleGlobalMove, { passive: false })
    window.addEventListener("touchend", handleGlobalEnd)

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove)
      window.removeEventListener("mouseup", handleGlobalEnd)
      window.removeEventListener("touchmove", handleGlobalMove)
      window.removeEventListener("touchend", handleGlobalEnd)
    }
  }, [])


  // Card inspection handlers
  const handleCardPressStart = (card: GameCard) => {
    if (cardPressTimer.current) {
      clearTimeout(cardPressTimer.current)
    }
    cardPressTimer.current = setTimeout(() => {
      setInspectedCard(card)
    }, 300)
  }

  const handleCardPressEnd = () => {
    if (cardPressTimer.current) {
      clearTimeout(cardPressTimer.current)
      cardPressTimer.current = null
    }
  }

  // Can unit attack now?
  const canUnitAttackNow = (card: FieldCard): boolean => {
    return isMyTurn && phase === "battle" && card.canAttack && !card.hasAttacked && turn > card.canAttackTurn
  }

  // Draw a card
  const drawCard = () => {
    if (!isMyTurn || phase !== "draw") return

    setMyField((prev) => {
      if (prev.deck.length === 0) return prev
      const drawnCard = prev.deck[0]
      const newDeck = prev.deck.slice(1)
      const newHand = [...prev.hand, drawnCard]

      // Show draw animation
      showDrawAnimation(drawnCard)

      sendAction({
        type: "draw",
        playerId,
        data: { handSize: newHand.length, deckSize: newDeck.length },
        timestamp: Date.now(),
      })

      return { ...prev, deck: newDeck, hand: newHand }
    })

    setPhase("main")
    resetTurnTimer()
  }

  // Turn timer logic
  const startTurnTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setTurnTimeLeft(60)
    
    timerIntervalRef.current = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          if (isMyTurnRef.current) {
            endTurn()
          }
          return 60
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const resetTurnTimer = useCallback(() => {
    setTurnTimeLeft(60)
  }, [])

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [])

  const advancePhase = () => {
    if (!isMyTurn) return

    if (phase === "draw") {
      drawCard()
    } else if (phase === "main") {
      setPhase("battle")
      // Enable units to attack that were placed in previous turns
      setMyField((prev) => ({
        ...prev,
        unitZone: prev.unitZone.map((unit) => (unit && turn > unit.canAttackTurn ? { ...unit, canAttack: true } : unit)),
        ultimateZone: prev.ultimateZone && turn > prev.ultimateZone.canAttackTurn
          ? { ...prev.ultimateZone, canAttack: true }
          : prev.ultimateZone,
      }))
      sendAction({
        type: "phase_change",
        playerId,
        data: { phase: "battle" },
        timestamp: Date.now(),
      })
      resetTurnTimer()
    }
  }

  // Place a card
  const placeCard = (zone: "unit" | "function", index: number, forcedCardIndex?: number, externalCard?: GameCard) => {
    const cardIndex = forcedCardIndex ?? (draggedHandCard?.index ?? selectedHandCard)
    if (!isMyTurn || phase !== "main" || (cardIndex === null && !externalCard)) return

    const card = externalCard || myField.hand[cardIndex!]
    if (!card) return

    // Check zone compatibility
    if (zone === "unit" && !isUnitCard(card)) return
    if (zone === "function" && (isUnitCard(card) || isUltimateCard(card) || card.type === "scenario")) return
    if (card.type === "scenario") return // Scenario cards go to scenario zone only
    if (isUltimateCard(card)) return // Ultimate cards go to ultimate zone only

    setMyField((prev) => {
      // Only filter hand if we're playing from hand
      const newHand = externalCard ? prev.hand : prev.hand.filter((_, i) => i !== cardIndex)

      if (zone === "unit") {
        const newUnitZone = [...prev.unitZone]
        if (newUnitZone[index] !== null) return prev // Slot occupied
        newUnitZone[index] = {
          ...card,
          currentDp: card.dp,
          canAttack: false,
          hasAttacked: false,
          canAttackTurn: turn,
        }
        return { ...prev, unitZone: newUnitZone, hand: newHand }
      } else {
        const newFunctionZone = [...prev.functionZone]
        if (newFunctionZone[index] !== null) return prev // Slot occupied

        // Check if card is a trap - set face down
        const isTrap = card.type === "trap"
        const functionCard: FunctionZoneCard = {
          ...card,
          isFaceDown: isTrap,
          isRevealing: false,
          isSettingDown: isTrap, // Animation for setting
        }
        newFunctionZone[index] = functionCard

        // Remove setting animation after it completes
        if (isTrap) {
          setTimeout(() => {
            setMyField((prev) => {
              const updatedZone = [...prev.functionZone]
              const trapCard = updatedZone[index]
              if (trapCard && (trapCard as FunctionZoneCard).isSettingDown) {
                updatedZone[index] = { ...trapCard, isSettingDown: false } as FunctionZoneCard
              }
              return { ...prev, functionZone: updatedZone }
            })
          }, 500)
        }

        return { ...prev, functionZone: newFunctionZone, hand: newHand }
      }
    })

    // Send action to opponent (but for traps, don't reveal the card identity)
    const cardToSend = card.type === "trap"
      ? { ...card, isFaceDown: true, isRevealing: false }
      : card

    sendAction({
      type: "place_card",
      playerId,
      data: { zone, index, card: cardToSend, isTrap: card.type === "trap", source: externalCard ? "tap" : "hand" },
      timestamp: Date.now(),
      source: externalCard ? "tap" : "hand"
    })

    setSelectedHandCard(null)
  }

  // Place ultimate card (ultimateGear, ultimateGuardian)
  const placeUltimateCard = (forcedCardIndex?: number, externalCard?: GameCard) => {
    const cardIndex = forcedCardIndex ?? (draggedHandCard?.index ?? selectedHandCard)
    if (!isMyTurn || phase !== "main" || (cardIndex === null && !externalCard)) return

    const card = externalCard || myField.hand[cardIndex!]
    if (!card || !isUltimateCard(card)) return
    if (myField.ultimateZone !== null) return

    setMyField((prev) => {
      const newHand = externalCard ? prev.hand : prev.hand.filter((_, i) => i !== cardIndex)
      return {
        ...prev,
        ultimateZone: {
          ...card,
          currentDp: card.dp,
          canAttack: false,
          hasAttacked: false,
          canAttackTurn: turn,
        },
        hand: newHand,
      }
    })

    sendAction({
      type: "place_ultimate",
      playerId,
      data: { card, source: externalCard ? "tap" : "hand" },
      timestamp: Date.now(),
    })

    setSelectedHandCard(null)
  }

  // Place scenario card
  const placeScenarioCard = (forcedCardIndex?: number, externalCard?: GameCard) => {
    const cardIndex = forcedCardIndex ?? (draggedHandCard?.index ?? selectedHandCard)
    if (!isMyTurn || phase !== "main" || (cardIndex === null && !externalCard)) return

    const card = externalCard || myField.hand[cardIndex!]
    if (!card || card.type !== "scenario") return
    if (myField.scenarioZone !== null) return // Already has scenario

    setMyField((prev) => {
      const newHand = externalCard ? prev.hand : prev.hand.filter((_, i) => i !== cardIndex)
      let newDeck = prev.deck
      const scenario = card

      // Draw 1 on play
      if (scenario.ability === "RUÍNAS ABANDONADAS" || scenario.ability === "ARENA ESCANDINAVA") {
        if (newDeck.length > 0) {
          const drawn = newDeck[0]
          newDeck = newDeck.slice(1)
          newHand.push(drawn)
          setTimeout(() => {
            showDrawAnimation(drawn)
            showEffectFeedback(`${scenario.name}: Comprou 1 carta!`, "success")
          }, 300)
        }
      }

      const newState = {
        ...prev,
        scenarioZone: scenario,
        hand: newHand,
        deck: newDeck,
        unitZone: prev.unitZone.map(u => u ? { ...u, currentDp: calculateCardDP(u, prev, opponentField, false) } : null)
      }

      // Update opponent units
      setOpponentField(oppPrev => ({
        ...oppPrev,
        unitZone: oppPrev.unitZone.map(u => u ? { ...u, currentDp: calculateCardDP(u, oppPrev, newState, true) } : null)
      }))

      if (scenario.ability === "REINO DE CAMELOT" || scenario.ability === "VILA DA PÓLVORA") {
        setTimeout(() => showEffectFeedback(`${scenario.name} ativado! O campo mudou!`, "success"), 500)
      }

      return newState
    })

    sendAction({
      type: "place_scenario",
      playerId,
      data: { card, source: externalCard ? "tap" : "hand" },
      timestamp: Date.now(),
    })
    setSelectedHandCard(null)
  }


  // Play a card from TAP (Tactical Access Pile)
  const playCardFromTap = (cardIndex: number, zone: "unit" | "function" | "scenario" | "ultimate", targetIndex?: number) => {
    if (!isMyTurn || phase !== "main") return

    // Every 3 turns restriction
    const isTapAvailable = turn > 0 && turn % 3 === 0
    if (!isTapAvailable) {
      showEffectFeedback("TAP Pile disponivel apenas a cada 3 turnos!", "error")
      return
    }

    const card = myField.tap[cardIndex]
    if (!card) return

    // Check space
    if (zone === "unit" && myField.unitZone[targetIndex!] !== null) return
    if (zone === "function" && myField.functionZone[targetIndex!] !== null) return
    if (zone === "scenario" && myField.scenarioZone !== null) return
    if (zone === "ultimate" && myField.ultimateZone !== null) return

    if (zone === "unit" && targetIndex !== undefined) {
      placeCard("unit", targetIndex, undefined, card)
    } else if (zone === "function" && targetIndex !== undefined) {
      placeCard("function", targetIndex, undefined, card)
    } else if (zone === "scenario") {
      placeScenarioCard(undefined, card)
    } else if (zone === "ultimate") {
      placeUltimateCard(undefined, card)
    }

    setMyField((prev) => ({
      ...prev,
      tap: prev.tap.filter((_, i) => i !== cardIndex),
    }))

    setTapView(null)
  }
  // Show draw card animation
  const showDrawAnimation = (card: GameCard) => {
    setDrawAnimation({
      visible: true,
      cardName: card.name,
      cardImage: card.image,
      cardType: card.type,
    })
    setTimeout(() => setDrawAnimation(null), 2500)
  }

  // Hand card drag handlers
  const handleHandCardDragStart = (index: number, e: React.MouseEvent | React.TouchEvent) => {
    if (!isMyTurn || phase !== "main") return

    const card = myField.hand[index]
    if (!card) return

    e.preventDefault()

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    dragPosRef.current = { x: clientX, y: clientY, rotation: 0, lastCheck: 0 }
    setDraggedHandCard({ index, card, currentY: clientY })
    setSelectedHandCard(index)

    // Update ghost position immediately
    if (draggedCardRef.current) {
      draggedCardRef.current.style.transform = `translate(${clientX - 40}px, ${clientY - 56}px) rotate(0deg) scale(1.1)`
    }
  }

  const handleHandCardDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggedHandCard || !draggedCardRef.current) return

    e.preventDefault()

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    // Calculate rotation based on horizontal movement
    const deltaX = clientX - dragPosRef.current.x
    const targetRotation = Math.max(-10, Math.min(10, deltaX * 0.8))
    dragPosRef.current.rotation = targetRotation * 0.4 + dragPosRef.current.rotation * 0.6
    dragPosRef.current.x = clientX
    dragPosRef.current.y = clientY

    // Update ghost DOM directly for smooth movement
    const isOverTarget = dropTarget !== null
    draggedCardRef.current.style.transform = `translate(${clientX - 40}px, ${clientY - 56}px) rotate(${isOverTarget ? 0 : dragPosRef.current.rotation}deg) scale(${isOverTarget ? 1.2 : 1.1})`

    // Throttled drop target check
    const now = Date.now()
    if (!dragPosRef.current.lastCheck || now - dragPosRef.current.lastCheck > 50) {
      dragPosRef.current.lastCheck = now

      const elements = document.elementsFromPoint(clientX, clientY)
      let foundTarget: { type: "unit" | "function" | "scenario" | "ultimate"; index: number } | null = null

      for (const el of elements) {
        const unitSlot = el.closest("[data-player-unit-slot]")
        const funcSlot = el.closest("[data-player-func-slot]")
        const scenarioSlot = el.closest("[data-player-scenario-slot]")
        const ultimateSlot = el.closest("[data-player-ultimate-slot]")

        if (ultimateSlot && isUltimateCard(draggedHandCard.card)) {
          if (!myField.ultimateZone) {
            foundTarget = { type: "ultimate", index: 0 }
            break
          }
        } else if (unitSlot && isUnitCard(draggedHandCard.card) && !isUltimateCard(draggedHandCard.card)) {
          const slotIndex = Number.parseInt(unitSlot.getAttribute("data-player-unit-slot") || "0")
          if (!myField.unitZone[slotIndex]) {
            foundTarget = { type: "unit", index: slotIndex }
            break
          }
        } else if (funcSlot && !isUnitCard(draggedHandCard.card) && draggedHandCard.card.type !== "scenario" && draggedHandCard.card.type !== "ultimateGear" && draggedHandCard.card.type !== "ultimateGuardian") {
          const slotIndex = Number.parseInt(funcSlot.getAttribute("data-player-func-slot") || "0")
          if (!myField.functionZone[slotIndex]) {
            foundTarget = { type: "function", index: slotIndex }
            break
          }
        } else if (scenarioSlot && draggedHandCard.card.type === "scenario") {
          if (!myField.scenarioZone) {
            foundTarget = { type: "scenario", index: 0 }
            break
          }
        }
      }

      if (foundTarget?.type !== dropTarget?.type || foundTarget?.index !== dropTarget?.index) {
        setDropTarget(foundTarget)
      }
    }
  }

  const handleHandCardDragEnd = () => {
    if (!draggedHandCard) {
      setDropTarget(null)
      return
    }

    if (dropTarget) {
      const targetSelector =
        dropTarget.type === "unit"
          ? `[data-player-unit-slot="${dropTarget.index}"]`
          : dropTarget.type === "function"
            ? `[data-player-func-slot="${dropTarget.index}"]`
            : dropTarget.type === "ultimate"
              ? `[data-player-ultimate-slot]`
              : `[data-player-scenario-slot]`
      const targetElement = document.querySelector(targetSelector)
      const targetRect = targetElement?.getBoundingClientRect()

      const cardIndex = draggedHandCard.index
      const targetType = dropTarget.type
      const targetIndex = dropTarget.index
      const cardToPlay = draggedHandCard.card

      // Place the card
      if (targetType === "ultimate") {
        placeUltimateCard(cardIndex)
      } else if (targetType === "scenario") {
        placeScenarioCard(cardIndex)
      } else {
        placeCard(targetType, targetIndex, cardIndex)
      }
      setSelectedHandCard(null)

      // Show materialize animation
      if (targetRect) {
        const targetX = targetRect.left + targetRect.width / 2
        const targetY = targetRect.top + targetRect.height / 2

        setDroppingCard({
          card: cardToPlay,
          targetX,
          targetY,
        })

        setTimeout(() => {
          setDroppingCard(null)
        }, 500)
      }
    }

    // Always clear drag state
    setDraggedHandCard(null)
    setDropTarget(null)
  }

  // Attack handlers
  const handleAttackStart = (unitIndex: number, e: React.MouseEvent | React.TouchEvent) => {
    if (!isMyTurn || phase !== "battle" || animationInProgressRef.current) return
    isDraggingRef.current = true

    const unit = myField.unitZone[unitIndex]
    if (!unit || !canUnitAttackNow(unit)) return

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    positionRef.current = {
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
    }

    setArrowPos({
      x1: clientX,
      y1: clientY,
      x2: clientX,
      y2: clientY,
    })

    setAttackState({
      isAttacking: true,
      attackerIndex: unitIndex,
      targetInfo: null,
    })
  }

  const handleAttackMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!attackState.isAttacking) return

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    positionRef.current.currentX = clientX
    positionRef.current.currentY = clientY

    setArrowPos((prev) => ({
      ...prev,
      x2: clientX,
      y2: clientY,
    }))

    // Check for targets
    const elements = document.elementsFromPoint(clientX, clientY)
    let newTarget: { type: "direct" | "unit"; index?: number } | null = null

    for (const el of elements) {
      const enemyUnit = el.closest("[data-enemy-unit]")
      if (enemyUnit) {
        const index = Number.parseInt(enemyUnit.getAttribute("data-enemy-unit") || "-1", 10)
        if (index >= 0 && opponentField.unitZone[index]) {
          newTarget = { type: "unit", index }
          break
        }
      }

      if (el.closest("[data-direct-attack]")) {
        newTarget = { type: "direct" }
        break
      }
    }

    setAttackTarget(newTarget)
  }

  const handleAttackEnd = () => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    if (!attackState.isAttacking || attackState.attackerIndex === null) {
      setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
      setAttackTarget(null)
      return
    }

    if (attackTarget) {
      performAttack(attackTarget.type, attackTarget.index)
    }

    setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
    setAttackTarget(null)
  }

  // Perform attack
  const performAttack = (targetType: "direct" | "unit", targetIndex?: number) => {
    if (!isMyTurn || phase !== "battle" || attackState.attackerIndex === null || animationInProgressRef.current) return

    const attacker = myField.unitZone[attackState.attackerIndex]
    if (!attacker || !attacker.canAttack || attacker.hasAttacked) return

    animationInProgressRef.current = true
    attackIdRef.current++
    const currentAttackId = attackIdRef.current

    const damage = attacker.currentDp
    const attackerIdx = attackState.attackerIndex

    // Check for target and get coordinates
    let targetX = 0
    let targetY = 0
    let targetFound = false

    if (targetType === "direct") {
      const directTarget = document.querySelector('[data-direct-attack]')
      if (directTarget) {
        const rect = directTarget.getBoundingClientRect()
        targetX = rect.left + rect.width / 2
        targetY = rect.top + rect.height / 2
        targetFound = true
      }
    } else if (targetType === "unit" && targetIndex !== undefined) {
      const enemySlot = document.querySelector(`[data-enemy-unit="${targetIndex}"]`)
      if (enemySlot) {
        const rect = enemySlot.getBoundingClientRect()
        targetX = rect.left + rect.width / 2
        targetY = rect.top + rect.height / 2
        targetFound = true
      }
    }

    if (!targetFound) {
      setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
      setAttackTarget(null)
      return
    }

    // Get attacker coordinates
    const attackerElement = document.querySelector(`[data-player-unit-slot="${attackerIdx}"]`)
    const attackerRect = attackerElement?.getBoundingClientRect()
    const startX = attackerRect ? attackerRect.left + attackerRect.width / 2 : window.innerWidth / 2
    const startY = attackerRect ? attackerRect.top + attackerRect.height / 2 : window.innerHeight / 2
    const projId = `proj-${Date.now()}-${currentAttackId}`
    setActiveProjectiles((prev) => [
      ...prev,
      { 
        id: projId, 
        startX, 
        startY, 
        targetX, 
        targetY, 
        element: attacker.element || "neutral",
        attackerImage: attacker.image,
        isDirect: targetType === "direct"
      },
    ])

    // Hide arrow immediately — before any animation
    setAttackState({ isAttacking: false, attackerIndex: attackerIdx, targetInfo: attackState.targetInfo })
    setAttackTarget(null)

    setTimeout(() => {
      if (targetType === "direct") {
        // Direct attack
        triggerExplosion(targetX, targetY, attacker.element || "neutral")

        setOpponentField((prev) => ({
          ...prev,
          life: Math.max(0, prev.life - damage),
        }))

        sendAction({
          type: "attack",
          playerId,
          data: { attackerIndex: attackerIdx, targetType: "direct", damage, card: attacker },
          timestamp: Date.now(),
        })

        // Mark attacker as having attacked
        setMyField((prev) => {
          const newUnitZone = [...prev.unitZone]
          const unit = newUnitZone[attackerIdx]
          if (unit) {
            unit.hasAttacked = true
            unit.canAttack = false
          }
          return { ...prev, unitZone: newUnitZone }
        })
      } else if (targetType === "unit" && targetIndex !== undefined) {
        // Attack a unit
        triggerExplosion(targetX, targetY, attacker.element || "neutral")

        const target = opponentField.unitZone[targetIndex]
        if (!target) return

        const targetDp = target.currentDp

        // Apply damage to opponent's unit
        setOpponentField((prev) => {
          const newUnitZone = [...prev.unitZone]
          const newGraveyard = [...prev.graveyard]
          const targetUnit = newUnitZone[targetIndex]
          if (targetUnit) {
            targetUnit.currentDp -= damage
            if (targetUnit.currentDp <= 0) {
              newGraveyard.push(targetUnit)
              newUnitZone[targetIndex] = null
            }
          }
          return { ...prev, unitZone: newUnitZone, graveyard: newGraveyard }
        })

        // Attacker takes counter damage
        setMyField((prev) => {
          const newUnitZone = [...prev.unitZone]
          const newGraveyard = [...prev.graveyard]
          const attackerUnit = newUnitZone[attackerIdx]
          if (attackerUnit) {
            attackerUnit.currentDp -= targetDp
            attackerUnit.hasAttacked = true
            attackerUnit.canAttack = false
            if (attackerUnit.currentDp <= 0) {
              newGraveyard.push(attackerUnit)
              newUnitZone[attackerIdx] = null
            }
          }
          return { ...prev, unitZone: newUnitZone, graveyard: newGraveyard }
        })

        sendAction({
          type: "attack",
          playerId,
          data: { attackerIndex: attackerIdx, targetType: "unit", targetIndex, damage, counterDamage: targetDp, card: attacker },
          timestamp: Date.now(),
        })
      }

      checkGameOver()
      setTimeout(() => {
        animationInProgressRef.current = false
      }, 100)
    }, PROJECTILE_DURATION)
  }
  const endTurn = () => {
    console.log("[v0] endTurn called, isMyTurn:", isMyTurn)
    if (!isMyTurn) {
      console.log("[v0] Cannot end turn - not my turn")
      return
    }

    console.log("[v0] Ending my turn, setting isMyTurn to false")
    setIsMyTurn(false)
    setPhase("end")
    setSelectedHandCard(null)

    // Disable my units
    setMyField((prev) => ({
      ...prev,
      unitZone: prev.unitZone.map((unit) => (unit ? { ...unit, canAttack: false, hasAttacked: false } : null)),
      ultimateZone: prev.ultimateZone ? { ...prev.ultimateZone, canAttack: false, hasAttacked: false } : null,
    }))

    // Enable opponent's units
    setOpponentField((prev) => ({
      ...prev,
      unitZone: prev.unitZone.map((unit) => (unit ? { ...unit, canAttack: true, hasAttacked: false } : null)),
      ultimateZone: prev.ultimateZone ? { ...prev.ultimateZone, canAttack: true, hasAttacked: false } : null,
    }))

    console.log("[v0] Sending end_turn action to opponent, turn:", turn)
    sendAction({
      type: "end_turn",
      playerId,
      data: { turn },
      timestamp: Date.now(),
    })
  }


  // Surrender
  const surrender = () => {
    if (gameResultRecordedRef.current) return
    gameResultRecordedRef.current = true

    // Send surrender action to opponent
    sendAction({
      type: "surrender",
      playerId,
      data: { playerName: roomData.isHost ? roomData.hostName : roomData.guestName },
      timestamp: Date.now(),
    })

    setGameResult("lost")
    endGame("lost")
  }

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return

    await supabase.from("duel_chat").insert({
      room_id: roomData.roomId,
      sender_id: playerId,
      sender_name: playerProfile.name,
      message: chatInput.trim(),
    })

    setChatInput("")
  }

  // Scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  // Get playmat for both decks
  const myPlaymat = myDeck ? getPlaymatForDeck(myDeck) : null
  const opponentPlaymat = opponentDeck ? getPlaymatForDeck(opponentDeck) : null

  // Debug logs for playmats
  console.log("[v0] My Deck:", myDeck?.name)
  console.log("[v0] My Playmat:", myPlaymat?.name, myPlaymat?.image)
  console.log("[v0] Opponent Deck:", opponentDeck?.name)
  console.log("[v0] Opponent Playmat:", opponentPlaymat?.name, opponentPlaymat?.image)

  // Game result screen
  if (gameResult) {
    const getResultMessage = () => {
      if (gameResult === "won") {
        if (winReason === "surrender") {
          return `${opponentName} desistiu do duelo!`
        }
        return `Voce derrotou ${opponentName}!`
      }
      return `Voce desistiu do duelo.`
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black/90">
        <div className="absolute inset-0 overflow-hidden">
          {gameResult === "won" && (
            <>
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-pulse"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    width: `${Math.random() * 4 + 2}px`,
                    height: `${Math.random() * 4 + 2}px`,
                    backgroundColor: "#fbbf24",
                    borderRadius: "50%",
                    animationDelay: `${Math.random() * 2}s`,
                  }}
                />
              ))}
            </>
          )}
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <h1
            className={`text-6xl font-bold mb-4 ${gameResult === "won" ? "text-green-400" : "text-red-400"}`}
            style={{
              textShadow: gameResult === "won"
                ? "0 0 20px rgba(74, 222, 128, 0.5)"
                : "0 0 20px rgba(248, 113, 113, 0.5)",
            }}
          >
            {gameResult === "won" ? t("victory") : t("defeat")}
          </h1>
          {winReason === "surrender" && gameResult === "won" && (
            <p className="text-amber-400 text-lg mb-2 font-bold">Vitoria por desistencia!</p>
          )}
          <p className="text-slate-300 text-xl mb-8">{getResultMessage()}</p>
          <Button onClick={onBack} className="px-8 py-4 text-xl bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500">
            {t("back")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={fieldRef}
      suppressHydrationWarning={true}
      className={`relative h-screen flex flex-col overflow-hidden select-none touch-none ${screenShake.active ? "shake-animation" : ""}`}
      style={{
        background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 25%, #0f0f2f 50%, #1a1a3a 75%, #0a0a1a 100%)",
      }}
      onMouseMove={(e) => {
        handleAttackMove(e)
        handleHandCardDragMove(e)
      }}
      onMouseUp={() => {
        handleAttackEnd()
        handleHandCardDragEnd()
      }}
      onMouseLeave={() => {
        handleAttackEnd()
        handleHandCardDragEnd()
      }}
      onTouchMove={(e) => {
        handleAttackMove(e)
        handleHandCardDragMove(e)
      }}
      onTouchEnd={() => {
        handleAttackEnd()
        handleHandCardDragEnd()
      }}
    >
      {/* Canvas for cinematic effects */}
      <canvas
        ref={explosionCanvasRef}
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{ width: "100vw", height: "100vh" }}
      />

      {/* Impact Flash Backdrop */}
      {impactFlash.active && (
        <div
          className="fixed inset-0 z-[110] pointer-events-none animate-flash-overlay"
          style={{ backgroundColor: impactFlash.color }}
        />
      )}

      {/* HUD / Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-[60] pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <Button
            variant="ghost"
            onClick={onBack}
            className="bg-black/40 hover:bg-black/60 text-white border border-white/10 backdrop-blur-md"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t("back")}
          </Button>
          <div className="bg-black/60 border border-white/20 rounded-lg p-2 backdrop-blur-md shadow-2xl">
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Turno {turn}</div>
             <div className="text-xl text-white font-mono flex items-center gap-2">
               <span className={`${turnTimeLeft <= 10 ? "text-red-500 animate-pulse" : "text-amber-400"}`}>
                 {Math.floor(turnTimeLeft / 60)}:{(turnTimeLeft % 60).toString().padStart(2, '0')}
               </span>
               <div className="w-1 h-6 bg-white/20" />
               <span className="text-sm font-sans uppercase tracking-[0.1em]">{isMyTurn ? "Seu Turno" : "Turno Adversario"}</span>
             </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <Button
            variant="ghost"
            onClick={() => setShowChat(!showChat)}
            className="bg-black/40 hover:bg-black/60 text-white border border-white/10 backdrop-blur-md shadow-lg"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Chat
          </Button>
          <div className="flex flex-col items-end bg-black/40 border border-white/10 rounded-lg p-3 backdrop-blur-md shadow-xl border-l-[3px] border-l-cyan-500">
            <div className="text-xs text-slate-400 mb-1 uppercase font-bold tracking-tighter">Status da Sala</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-xs text-white font-mono tracking-widest">{roomData.roomCode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Projectiles */}
      {activeProjectiles.map((proj) => (
        <ElementalAttackAnimation
          key={proj.id}
          {...proj}
          portalTarget={fieldRef.current}
          onImpact={handleImpact}
          onComplete={handleAnimationComplete}
        />
      ))}

      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
                            radial-gradient(circle at 80% 70%, rgba(147, 51, 234, 0.3) 0%, transparent 50%),
                            radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.2) 0%, transparent 60%)`,
        }}
      />

      {/* Animated grid lines */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Attack Arrow */}
      {attackState.isAttacking && (
        <svg className="fixed inset-0 pointer-events-none z-50" style={{ width: "100vw", height: "100vh" }}>
          <defs>
            <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="50%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f87171" />
            </linearGradient>
            <marker id="arrowhead" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto">
              <path d="M 0 0 L 12 5 L 0 10 L 3 5 Z" fill="#f87171" stroke="#dc2626" strokeWidth="0.5" />
            </marker>
          </defs>

          {/* Outer glow */}
          <line
            x1={arrowPos.x1}
            y1={arrowPos.y1}
            x2={arrowPos.x2}
            y2={arrowPos.y2}
            stroke="#f87171"
            strokeWidth="8"
            opacity="0.18"
            strokeLinecap="round"
          />

          {/* Main arrow */}
          <line
            x1={arrowPos.x1}
            y1={arrowPos.y1}
            x2={arrowPos.x2}
            y2={arrowPos.y2}
            stroke="url(#arrowGradient)"
            strokeWidth="4"
            markerEnd="url(#arrowhead)"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Top HUD - Enemy info */}
      <div className="relative z-20 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-800 border-2 border-red-400 flex items-center justify-center">
            <Swords className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xs text-slate-400">{opponentName}</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-red-400">LP: {opponentField.life}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center px-4 py-1 bg-black/50 rounded-lg border border-amber-500/30">
            <span className="text-xs text-slate-400">{t("turn")}</span>
            <span className="block text-2xl font-bold text-amber-400">{turn}</span>
          </div>
          <div
            className={`px-4 py-2 rounded-lg text-sm font-bold border-2 ${isMyTurn
              ? "bg-green-600/20 border-green-500 text-green-400"
              : "bg-red-600/20 border-red-500 text-red-400"
              }`}
          >
            {isMyTurn ? t("yourTurn") : t("enemyTurn")}
          </div>
        </div>

        <Button onClick={surrender} size="sm" variant="ghost" className="text-slate-400 hover:text-red-400">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("surrender")}
        </Button>
      </div>

      {/* Enemy hand (card backs) */}
      <div className="relative z-10 flex justify-center py-1">
        <div className="flex gap-1">
          {opponentField.hand.map((_, i) => (
            <div
              key={i}
              className="w-6 h-8 bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800 rounded border border-slate-500/50 shadow-md"
              style={{
                transform: `rotate(${(i - opponentField.hand.length / 2) * 3}deg) translateY(${Math.abs(i - opponentField.hand.length / 2) * 2}px)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Battle Area with Playmat */}
      <div className="flex-1 flex items-center justify-center px-2 py-1">
        <div
          className="relative w-full max-w-xl mx-auto rounded-xl overflow-hidden"
          style={{
            aspectRatio: "9/16",
            maxHeight: "calc(100vh - 220px)",
            boxShadow: "0 0 30px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,0,0,0.3)",
            transform: screenShake.active
              ? `translate(${(Math.random() - 0.5) * screenShake.intensity}px, ${(Math.random() - 0.5) * screenShake.intensity}px)`
              : "none",
            transition: screenShake.active ? "none" : "transform 0.1s ease-out",
          }}
        >
          {/* Playmat container with border */}
          <div className="absolute inset-0 rounded-xl border-4 border-amber-600/30 bg-gradient-to-b from-slate-900/90 to-slate-800/90">
            {/* Opponent Playmat Background */}
            {opponentPlaymat ? (
              <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
                <img
                  src={opponentPlaymat.image || "/placeholder.svg"}
                  alt={opponentPlaymat.name}
                  className="w-full h-full object-cover rotate-180"
                  style={{ opacity: 0.6 }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/60" />
              </div>
            ) : (
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-red-950/30 to-transparent" />
            )}

            {/* Player Playmat Background */}
            {myPlaymat ? (
              <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden">
                <img
                  src={myPlaymat.image || "/placeholder.svg"}
                  alt={myPlaymat.name}
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.6 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-slate-900/60" />
              </div>
            ) : (
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-950/30 to-transparent" />
            )}
          </div>

          {/* Field content */}
          <div className="relative h-full flex flex-col justify-between p-1.5 pb-3 z-10">
            {/* Enemy Field */}
            <div className="flex justify-center items-center gap-3">
              {/* Enemy Deck, Graveyard, Scenario and Ultimate */}
              <div className="flex items-start gap-1">
                <div className="flex gap-1">
                  <div className="flex flex-col gap-1">
                    <div
                      className="w-14 h-20 bg-purple-900/80 rounded text-sm text-purple-300 flex items-center justify-center border border-purple-500/50 cursor-pointer hover:bg-purple-800/80 transition-colors"
                      onClick={() => setGraveyardView("enemy")}
                    >
                      {opponentField.graveyard.length}
                    </div>
                    <div className="w-14 h-20 relative">
                      {opponentField.deck.length > 0 ? (
                        <>
                          {[...Array(Math.min(Math.ceil(opponentField.deck.length / 6), 6))].map((_, i) => (
                            <div
                              key={i}
                              className="absolute inset-0 rounded border border-black/40 shadow-sm overflow-hidden bg-red-900"
                              style={{
                                transform: `translateY(-${i * 1.5}px)`,
                                zIndex: 10 - i,
                              }}
                            >
                              <Image
                                src={CARD_BACK_IMAGE || "/placeholder.svg"}
                                alt="Deck"
                                fill
                                className="object-cover"
                              />
                            </div>
                          ))}
                          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                            <span className="bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full border border-white/20 font-bold backdrop-blur-sm">
                              {opponentField.deck.length}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 rounded border-2 border-dashed border-red-900/40 flex items-center justify-center">
                          <span className="text-red-900/40 text-[8px] font-bold">VAZIO</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="w-14 h-20 bg-orange-600/80 rounded text-[10px] text-white flex flex-col items-center justify-center font-bold border border-orange-400/50 cursor-pointer hover:bg-orange-500/80 transition-animation"
                    onClick={() => setTapView("enemy")}
                  >
                    <span className="opacity-70">TAP</span>
                    <span>{opponentField.tap.length}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {/* Enemy Scenario Zone - Horizontal slot, aligned with unit zone */}
                  <div className="h-14 w-20 bg-amber-900/40 border border-amber-600/40 rounded flex items-center justify-center relative overflow-hidden">
                    {opponentField.scenarioZone ? (
                      <Image
                        src={opponentField.scenarioZone.image || "/placeholder.svg"}
                        alt={opponentField.scenarioZone.name}
                        fill
                        sizes="80px"
                        className="object-cover rounded"
                        onMouseDown={() => handleCardPressStart(opponentField.scenarioZone!)}
                        onMouseUp={handleCardPressEnd}
                        onMouseLeave={handleCardPressEnd}
                        onTouchStart={() => handleCardPressStart(opponentField.scenarioZone!)}
                        onTouchEnd={handleCardPressEnd}
                      />
                    ) : (
                      <span className="text-amber-500/50 text-[8px] text-center">SCENARIO</span>
                    )}
                  </div>
                  {/* Enemy Ultimate Zone - single green slot below scenario */}
                  <div className="w-14 h-20 bg-emerald-900/40 border border-emerald-600/40 rounded flex items-center justify-center relative overflow-hidden mx-auto">
                    {opponentField.ultimateZone ? (
                      <>
                        <Image
                          src={opponentField.ultimateZone.image || "/placeholder.svg"}
                          alt={opponentField.ultimateZone.name}
                          fill
                          sizes="56px"
                          className="object-cover rounded"
                          onMouseDown={() => handleCardPressStart(opponentField.ultimateZone!)}
                          onMouseUp={handleCardPressEnd}
                          onMouseLeave={handleCardPressEnd}
                          onTouchStart={() => handleCardPressStart(opponentField.ultimateZone!)}
                          onTouchEnd={handleCardPressEnd}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-center text-xs text-white font-bold py-0.5">
                          {opponentField.ultimateZone.currentDp} DP
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Enemy Zones */}
              <div className="flex flex-col gap-1.5">
                {/* Enemy Function Zone */}
                <div className="flex justify-center items-center gap-1.5">
                  {opponentField.functionZone.map((card, i) => (
                    <div
                      key={i}
                      className={`w-14 h-20 bg-purple-900/40 border border-purple-600/40 rounded flex items-center justify-center relative overflow-hidden ${(card as FunctionZoneCard)?.isFaceDown ? 'trap-face-down' : ''
                        }`}
                    >
                      {card && (
                        <div
                          className={`relative w-full h-full ${(card as FunctionZoneCard).isRevealing ? 'animate-flip-card trap-activating' : ''
                            }`}
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          <Image
                            src={(card as FunctionZoneCard).isFaceDown ? CARD_BACK_IMAGE : (card.image || "/placeholder.svg")}
                            alt={(card as FunctionZoneCard).isFaceDown ? "Set Card" : card.name}
                            fill
                            sizes="56px"
                            className="object-cover rounded"
                            onMouseDown={() => !(card as FunctionZoneCard).isFaceDown && handleCardPressStart(card)}
                            onMouseUp={handleCardPressEnd}
                            onMouseLeave={handleCardPressEnd}
                            onTouchStart={() => !(card as FunctionZoneCard).isFaceDown && handleCardPressStart(card)}
                            onTouchEnd={handleCardPressEnd}
                          />
                          {/* NO trap indicator for opponent face-down cards */}
                          {(card as FunctionZoneCard).isRevealing && (
                            <>
                              <div className="trap-shockwave" />
                              <div className="trap-shockwave-2" />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Enemy Unit Zone */}
                <div className="flex justify-center items-center gap-1.5">
                  {opponentField.unitZone.map((card, i) => (
                    <div
                      key={i}
                      data-enemy-unit={i}
                      className={`w-14 h-20 bg-red-900/30 border-2 rounded relative overflow-hidden transition-all ${attackTarget?.type === "unit" && attackTarget.index === i
                        ? "border-red-500 ring-2 ring-red-400 scale-105"
                        : "border-red-700/40"
                        }`}
                    >
                      {card && (
                        <>
                          <Image
                            src={card.image || "/placeholder.svg"}
                            alt={card.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                            onMouseDown={() => handleCardPressStart(card)}
                            onMouseUp={handleCardPressEnd}
                            onMouseLeave={handleCardPressEnd}
                            onTouchStart={() => handleCardPressStart(card)}
                            onTouchEnd={handleCardPressEnd}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-center text-xs text-white font-bold py-0.5">
                            {(card as FieldCard).currentDp} DP
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Center Phase indicator and Direct Attack Zone */}
            <div className="flex flex-col items-center gap-1 py-1">
              <div
                data-direct-attack
                className={`px-6 py-1 rounded-full border-2 border-dashed transition-all text-sm font-bold ${attackTarget?.type === "direct"
                  ? "border-red-500 bg-red-500/30 text-red-300 scale-105"
                  : "border-slate-500/50 text-slate-500"
                  }`}
              >
                {attackTarget?.type === "direct" ? "ATAQUE DIRETO!" : ""}
              </div>

              {/* Phase divider */}
              <div className="w-full flex items-center gap-2">
                <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-amber-500" />
                <span className="text-amber-400 text-xs font-bold px-3 py-1 bg-black/60 rounded-full border border-amber-500/40">
                  {phase === "draw" ? "DRAW" : phase === "main" ? "MAIN" : phase === "battle" ? "BATTLE" : "END"}
                </span>
                <div className="flex-1 h-0.5 bg-gradient-to-l from-transparent via-amber-500/60 to-amber-500" />
              </div>
            </div>

            {/* Player Field */}
            <div className="flex justify-center items-center gap-3">
              {/* Player Zones */}
              <div className="flex flex-col gap-1.5">
                {/* Player Unit Zone */}
                <div className="flex justify-center items-center gap-1.5">
                  {myField.unitZone.map((card, i) => {
                    const canAttack = card && canUnitAttackNow(card as FieldCard)
                    const isSelectedTarget =
                      selectedHandCard !== null && isUnitCard(myField.hand[selectedHandCard]) && !card
                    const isDragTarget =
                      draggedHandCard && isUnitCard(draggedHandCard.card) && !card && !isUltimateCard(draggedHandCard.card)
                    const isDropping = dropTarget?.type === "unit" && dropTarget?.index === i
                    const isValidDropTarget = isSelectedTarget || isDragTarget

                    return (
                      <div
                        key={i}
                        data-player-unit-slot={i}
                        onClick={() => {
                          if (selectedHandCard !== null && !card && !draggedHandCard) {
                            placeCard("unit", i)
                          }
                        }}
                        className={`w-14 h-20 bg-blue-900/30 border-2 rounded relative overflow-hidden transition-all ${isDropping
                          ? "border-green-400 bg-green-500/50 scale-110 shadow-lg shadow-green-500/50"
                          : isValidDropTarget
                            ? "border-green-500 bg-green-900/40 cursor-pointer"
                            : canAttack
                              ? "border-yellow-400 shadow-lg shadow-yellow-500/40"
                              : "border-blue-700/40"
                          }`}
                      >
                        {canAttack && (
                          <div className="absolute -inset-1 bg-yellow-400/40 rounded blur-sm animate-pulse -z-10" />
                        )}
                        {card && (
                          <>
                            <Image
                              src={card.image || "/placeholder.svg"}
                              alt={card.name}
                              fill
                              sizes="56px"
                              className="object-cover"
                              onMouseDown={(e) => {
                                if (canAttack) {
                                  handleAttackStart(i, e)
                                } else {
                                  handleCardPressStart(card)
                                }
                              }}
                              onMouseUp={handleCardPressEnd}
                              onMouseLeave={handleCardPressEnd}
                              onTouchStart={(e) => {
                                if (canAttack) {
                                  handleAttackStart(i, e)
                                } else {
                                  handleCardPressStart(card)
                                }
                              }}
                              onTouchEnd={handleCardPressEnd}
                            />
                            {canAttack && (
                              <div className="absolute top-0 left-0 right-0 bg-green-500 text-white text-[10px] text-center font-bold animate-pulse">
                                {t("dragToAttack")}
                              </div>
                            )}
                            {!canAttack && card && turn <= (card as FieldCard).canAttackTurn && (
                              <div className="absolute top-0 left-0 right-0 bg-amber-600/90 text-white text-[8px] text-center">
                                T{(card as FieldCard).canAttackTurn + 1}
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-center text-xs text-white font-bold py-0.5">
                              {card.currentDp} DP
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Player Function Zone */}
                <div className="flex justify-center items-center gap-1.5">
                  {myField.functionZone.map((card, i) => {
                    const isSelectedTarget =
                      selectedHandCard !== null &&
                      !isUnitCard(myField.hand[selectedHandCard]) &&
                      myField.hand[selectedHandCard]?.type !== "scenario" &&
                      !isUltimateCard(myField.hand[selectedHandCard]) &&
                      !card
                    const isDragTarget =
                      draggedHandCard &&
                      !isUnitCard(draggedHandCard.card) &&
                      draggedHandCard.card.type !== "scenario" &&
                      !isUltimateCard(draggedHandCard.card) &&
                      !card
                    const isDropping = dropTarget?.type === "function" && dropTarget?.index === i
                    const isValidDropTarget = isSelectedTarget || isDragTarget

                    return (
                      <div
                        key={i}
                        data-player-func-slot={i}
                        onClick={() => {
                          if (selectedHandCard !== null && !card && !draggedHandCard) {
                            placeCard("function", i)
                          }
                        }}
                        className={`w-14 h-20 bg-purple-900/30 border-2 rounded flex items-center justify-center cursor-pointer transition-all duration-200 relative overflow-hidden ${isDropping
                          ? "border-green-400 bg-green-500/50 scale-110 shadow-lg shadow-green-500/50"
                          : isValidDropTarget
                            ? "border-green-500 bg-green-900/40"
                            : "border-purple-600/40"
                          }`}
                      >
                        {card && (
                          <div
                            className={`relative w-full h-full ${(card as FunctionZoneCard).isSettingDown
                              ? 'animate-trap-set'
                              : (card as FunctionZoneCard).isRevealing
                                ? 'animate-flip-card trap-activating'
                                : (card as FunctionZoneCard).isFaceDown
                                  ? 'trap-face-down'
                                  : ''
                              }`}
                            style={{ transformStyle: 'preserve-3d' }}
                          >
                            <Image
                              src={(card as FunctionZoneCard).isFaceDown ? CARD_BACK_IMAGE : (card.image || "/placeholder.svg")}
                              alt={(card as FunctionZoneCard).isFaceDown ? "Trap Card" : card.name}
                              fill
                              sizes="56px"
                              className="object-cover rounded"
                              onMouseDown={() => handleCardPressStart(card)}
                              onMouseUp={handleCardPressEnd}
                              onMouseLeave={handleCardPressEnd}
                              onTouchStart={() => handleCardPressStart(card)}
                              onTouchEnd={handleCardPressEnd}
                            />
                            {/* Trap indicator for MY face-down cards */}
                            {(card as FunctionZoneCard).isFaceDown && (
                              <div className="absolute bottom-0.5 right-0.5 bg-pink-500/80 rounded px-0.5 py-0.5">
                                <span className="text-[6px] font-bold text-white">TRAP</span>
                              </div>
                            )}
                            {(card as FunctionZoneCard).isRevealing && (
                              <>
                                <div className="trap-shockwave" />
                                <div className="trap-shockwave-2" />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Player Scenario, Ultimate Zone and Deck/Graveyard */}
              <div className="flex items-start gap-1">
                <div className="flex flex-col gap-1">
                  {/* Player Scenario Zone - Horizontal slot, aligned with unit zone */}
                  {(() => {
                    const isSelectedTarget =
                      selectedHandCard !== null &&
                      myField.hand[selectedHandCard]?.type === "scenario" &&
                      !myField.scenarioZone
                    const isDragTarget =
                      draggedHandCard && draggedHandCard.card.type === "scenario" && !myField.scenarioZone
                    const isDropping = dropTarget?.type === "scenario"
                    const isValidDropTarget = isSelectedTarget || isDragTarget

                    return (
                      <div
                        data-player-scenario-slot
                        onClick={() => {
                          if (selectedHandCard !== null && myField.hand[selectedHandCard]?.type === "scenario" && !draggedHandCard) {
                            placeScenarioCard()
                          }
                        }}
                        className={`h-14 w-20 bg-amber-900/30 border-2 rounded flex items-center justify-center relative overflow-hidden transition-all duration-200 ${isDropping
                          ? "border-green-400 bg-green-500/50 scale-110 shadow-lg shadow-green-500/50"
                          : isValidDropTarget
                            ? "border-green-500 bg-green-900/40 cursor-pointer"
                            : "border-amber-600/40"
                          }`}
                      >
                        {myField.scenarioZone ? (
                          <Image
                            src={myField.scenarioZone.image || "/placeholder.svg"}
                            alt={myField.scenarioZone.name}
                            fill
                            sizes="80px"
                            className="object-cover rounded"
                            onMouseDown={() => handleCardPressStart(myField.scenarioZone!)}
                            onMouseUp={handleCardPressEnd}
                            onMouseLeave={handleCardPressEnd}
                            onTouchStart={() => handleCardPressStart(myField.scenarioZone!)}
                            onTouchEnd={handleCardPressEnd}
                          />
                        ) : (
                          <span className="text-amber-500/50 text-[8px] text-center">SCENARIO</span>
                        )}
                      </div>
                    )
                  })()}
                  {/* Player Ultimate Zone - single green slot below scenario */}
                  {(() => {
                    const isSelectedUltimate =
                      selectedHandCard !== null &&
                      myField.hand[selectedHandCard] &&
                      isUltimateCard(myField.hand[selectedHandCard]) &&
                      !myField.ultimateZone
                    const isDragUltimate =
                      draggedHandCard && isUltimateCard(draggedHandCard.card) && !myField.ultimateZone
                    const isDroppingUltimate = dropTarget?.type === "ultimate"
                    const isValidUltimateTarget = isSelectedUltimate || isDragUltimate

                    return (
                      <div
                        data-player-ultimate-slot
                        onClick={() => {
                          if (selectedHandCard !== null && myField.hand[selectedHandCard] && isUltimateCard(myField.hand[selectedHandCard]) && !draggedHandCard) {
                            placeUltimateCard()
                          }
                        }}
                        className={`w-14 h-20 bg-emerald-900/30 border-2 rounded flex items-center justify-center relative overflow-hidden transition-all duration-200 mx-auto ${isDroppingUltimate
                          ? "border-green-400 bg-green-500/60 scale-110 shadow-lg shadow-green-500/50 ring-2 ring-green-400/50 animate-pulse"
                          : isValidUltimateTarget
                            ? "border-emerald-400 bg-emerald-900/40 cursor-pointer"
                            : "border-emerald-600/40"
                          }`}
                      >
                        {myField.ultimateZone ? (
                          <>
                            <Image
                              src={myField.ultimateZone.image || "/placeholder.svg"}
                              alt={myField.ultimateZone.name}
                              fill
                              sizes="56px"
                              className="object-cover rounded"
                              onMouseDown={() => handleCardPressStart(myField.ultimateZone!)}
                              onMouseUp={handleCardPressEnd}
                              onMouseLeave={handleCardPressEnd}
                              onTouchStart={() => handleCardPressStart(myField.ultimateZone!)}
                              onTouchEnd={handleCardPressEnd}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-center text-xs text-white font-bold py-0.5">
                              {myField.ultimateZone.currentDp} DP
                            </div>
                          </>
                        ) : null}
                        {!myField.ultimateZone && isDroppingUltimate && (
                          <span className="text-green-400 text-[10px] font-bold animate-pulse">SOLTAR</span>
                        )}
                      </div>
                    )
                  })()}
                </div>
                <div className="flex gap-1">
                  <div className="flex flex-col gap-1">
                    <div className="w-14 h-20 relative">
                      {myField.deck.length > 0 ? (
                        <>
                          {[...Array(Math.min(Math.ceil(myField.deck.length / 6), 6))].map((_, i) => (
                            <div
                              key={i}
                              className="absolute inset-0 rounded border border-black/40 shadow-sm overflow-hidden bg-blue-900"
                              style={{
                                transform: `translateY(-${i * 1.5}px)`,
                                zIndex: 10 - i,
                              }}
                            >
                              <Image
                                src={CARD_BACK_IMAGE || "/placeholder.svg"}
                                alt="Deck"
                                fill
                                className="object-cover"
                              />
                            </div>
                          ))}
                          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                            <span className="bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full border border-white/20 font-bold backdrop-blur-sm">
                              {myField.deck.length}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 rounded border-2 border-dashed border-blue-900/40 flex items-center justify-center">
                          <span className="text-blue-900/40 text-[8px] font-bold">VAZIO</span>
                        </div>
                      )}
                    </div>
                    <div
                      className="w-14 h-20 bg-purple-900/80 rounded text-sm text-purple-300 flex items-center justify-center border border-purple-500/50 cursor-pointer hover:bg-purple-800/80 transition-animation"
                      onClick={() => setGraveyardView("player")}
                    >
                      {myField.graveyard.length}
                    </div>
                  </div>
                  {/* TAP Pile Button with availability glow */}
                  {(() => {
                    const isTapAvailable = turn > 0 && turn % 3 === 0 && isMyTurn && phase === "main"
                    return (
                      <div
                        className={`w-14 h-20 rounded text-[10px] text-white flex flex-col items-center justify-center font-bold border transition-all duration-300 cursor-pointer relative ${isTapAvailable
                          ? "bg-orange-600/90 border-orange-400"
                          : "bg-slate-800/80 border-slate-700/50 opacity-60 grayscale-[0.5]"
                          }`}
                        onClick={() => setTapView("player")}
                      >
                        {isTapAvailable && (
                          <div className="absolute -inset-1 bg-orange-500/20 rounded pointer-events-none" />
                        )}
                        <span className={`opacity-70 ${isTapAvailable ? "text-orange-200" : ""}`}>TAP</span>
                        <span className={isTapAvailable ? "text-xl mt-1" : ""}>{myField.tap.length}</span>
                        {isTapAvailable && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" />
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom HUD - Player info and controls */}
      <div className="relative z-20 bg-gradient-to-t from-black/95 via-black/90 to-transparent pt-2 pb-2 px-4">
        {/* Player LP bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold">P1</span>
            </div>
            <div>
              <span className="text-xs text-slate-400">{playerProfile.name}</span>
              <div className="text-xl font-bold text-blue-400">LP: {myField.life}</div>
            </div>
          </div>

          {/* Empty space for balance */}
          <div className="flex gap-2 min-h-[40px]">
          </div>

          {/* Chat toggle */}
          <Button variant="ghost" onClick={() => setShowChat(!showChat)} className="text-white p-2">
            <MessageCircle className="w-5 h-5" />
          </Button>
        </div>

        {/* Player Hand with Phase Buttons on the right side */}
        <div className="flex justify-center items-end -mt-14 min-h-28">
          {/* Phase Buttons - positioned on the right edge */}
          <div className="absolute right-4 bottom-4 z-30">
            {isMyTurn && phase === "draw" && (
              <Button
                onClick={advancePhase}
                size="lg"
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold px-8 py-6 shadow-lg shadow-green-500/30 animate-pulse"
              >
                {t("drawCard")}
              </Button>
            )}
            {isMyTurn && phase === "main" && (
              <Button
                onClick={advancePhase}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-8 py-6 shadow-lg shadow-blue-500/30 animate-pulse"
              >
                {t("toBattle")}
              </Button>
            )}
            {isMyTurn && phase === "battle" && (
              <Button
                onClick={endTurn}
                size="lg"
                className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold px-8 py-6 shadow-lg shadow-amber-500/30 animate-pulse"
              >
                {t("endTurn")}
              </Button>
            )}
          </div>
          <div className="flex gap-3 items-end">
            {myField.hand.map((card, i) => {
              const offset = i - (myField.hand.length - 1) / 2
              const rotation = offset * 4
              const translateY = Math.abs(offset) * 5
              const isSelected = selectedHandCard === i
              const isDragging = draggedHandCard?.index === i

              // Check if card can be played
              const hasSpaceInZone = isUltimateCard(card)
                ? myField.ultimateZone === null
                : card.type === "scenario"
                  ? myField.scenarioZone === null
                  : isUnitCard(card)
                    ? myField.unitZone.some((slot) => slot === null)
                    : myField.functionZone.some((slot) => slot === null)
              const canPlay = isMyTurn && phase === "main" && hasSpaceInZone

              return (
                <div
                  key={i}
                  className="relative"
                  onClick={() => {
                    if (canPlay && !draggedHandCard) {
                      setSelectedHandCard(isSelected ? null : i)
                    }
                  }}
                  onMouseDown={(e) => canPlay && handleHandCardDragStart(i, e)}
                  onTouchStart={(e) => canPlay && handleHandCardDragStart(i, e)}
                >
                  <div
                    className={`relative w-20 h-28 rounded-xl border-2 overflow-hidden transition-all duration-200 cursor-pointer ${isDragging
                      ? "opacity-30 scale-95"
                      : isSelected
                        ? "border-amber-400 ring-2 ring-amber-400/60 -translate-y-6 scale-110 z-30"
                        : canPlay
                          ? "border-amber-500/50 hover:-translate-y-4 hover:border-amber-400"
                          : "border-slate-600/50 opacity-60"
                      }`}
                    style={{
                      transform: isDragging
                        ? "scale(0.95)"
                        : isSelected
                          ? "translateY(-24px) scale(1.1)"
                          : `rotate(${rotation}deg) translateY(${translateY}px)`,
                      zIndex: isSelected ? 30 : 10 + i,
                    }}
                    onMouseDown={() => handleCardPressStart(card)}
                    onMouseUp={handleCardPressEnd}
                    onMouseLeave={handleCardPressEnd}
                    onTouchStart={() => handleCardPressStart(card)}
                    onTouchEnd={handleCardPressEnd}
                  >
                    <div className="relative w-full h-full overflow-hidden rounded-lg">
                      <Image
                        src={card.image || "/placeholder.svg"}
                        alt={card.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                  {/* Drag hint */}
                  {canPlay && isSelected && !isDragging && (
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-yellow-400 text-[10px] font-bold whitespace-nowrap">
                      Arraste para jogar
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Chat overlay */}
      {showChat && (
        <div className="absolute bottom-32 right-4 w-72 bg-slate-900/95 rounded-xl border border-slate-700 shadow-xl z-50">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-white font-medium flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Chat
            </h3>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={chatContainerRef} className="h-40 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">Nenhuma mensagem...</p>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender_id === playerId ? "items-end" : "items-start"}`}>
                  <span className="text-xs text-slate-500 mb-1">{msg.sender_name}</span>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg ${msg.sender_id === playerId ? "bg-amber-500/30 text-amber-100" : "bg-slate-700 text-slate-200"
                      }`}
                  >
                    <p className="text-sm break-words">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-slate-700">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendChatMessage()
              }}
              className="flex gap-2"
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Mensagem..."
                className="flex-1 bg-slate-700 border-slate-600 text-white text-sm"
                maxLength={100}
              />
              <Button type="submit" disabled={!chatInput.trim()} className="bg-amber-500 hover:bg-amber-600 text-white">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Graveyard View */}
      {graveyardView && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" onClick={() => setGraveyardView(null)}>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">
                {graveyardView === "player" ? "Seu Cemiterio" : "Cemiterio do Oponente"}
              </h3>
              <button onClick={() => setGraveyardView(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
              {(graveyardView === "player" ? myField.graveyard : opponentField.graveyard).map((card, i) => (
                <div
                  key={i}
                  className="relative w-full aspect-[3/4] rounded border border-slate-600 overflow-hidden cursor-pointer hover:border-amber-400 transition-colors"
                  onClick={() => setInspectedCard(card)}
                >
                  <Image src={card.image || "/placeholder.svg"} alt={card.name} fill sizes="80px" className="object-cover" />
                </div>
              ))}
              {(graveyardView === "player" ? myField.graveyard : opponentField.graveyard).length === 0 && (
                <p className="col-span-4 text-slate-500 text-center py-8">Cemiterio vazio</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Draw Card Animation - Card pulled from deck to hand */}
      {drawAnimation && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {/* Card moving from deck position to hand */}
          <div className="draw-card-container">
            {/* Glow effect - follows card */}
            <div className="draw-card-glow" />

            {/* The card itself */}
            <div className="draw-card-frame">
              {/* Card back */}
              <div className="draw-card-back">
                <div className="absolute inset-1.5 border border-cyan-500/40 rounded" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 opacity-70" />
                </div>
              </div>

              {/* Card front */}
              <div className="draw-card-front">
                <img
                  src={drawAnimation.cardImage}
                  alt={drawAnimation.cardName}
                  className="w-full h-full object-cover"
                />
                {/* Shine effect */}
                <div className="draw-card-shine" />
              </div>
            </div>
          </div>

          {/* Card name - appears at peak */}
          <div className="draw-card-name">
            <span className="text-white font-bold text-sm drop-shadow-lg">
              {drawAnimation.cardName}
            </span>
          </div>
        </div>
      )}

      {/* Card Inspection Overlay */}
      {inspectedCard && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setInspectedCard(null)}
          onTouchEnd={() => setInspectedCard(null)}
        >
          <div style={{ animation: "cardInspectIn 250ms ease-out forwards" }} className="relative flex flex-col items-center">
            {/* Glow de fundo */}
            <div className="absolute -inset-20 bg-gradient-to-br from-cyan-500/15 to-purple-500/15 blur-3xl rounded-full" />

            {/* Carta grande */}
            <div
              className="relative rounded-3xl border-4 border-white/40 shadow-2xl overflow-hidden bg-slate-900"
              style={{ width: "280px", height: "392px" }}
            >
              <Image
                src={inspectedCard.image || "/placeholder.svg"}
                alt={inspectedCard.name}
                fill
                className="object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Nome e DP */}
            <div className="mt-8 text-center bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
              <div className="text-white font-bold text-2xl tracking-wide">{inspectedCard.name}</div>
              {isUnitCard(inspectedCard) && (
                <div className="text-cyan-400 text-lg font-bold mt-1">
                  DP: {(inspectedCard as any).currentDp || inspectedCard.dp}
                </div>
              )}
              <p className="text-slate-400 text-sm mt-2 max-w-xs line-clamp-2 italic">
                {(inspectedCard as any).description || inspectedCard.ability || "Tactical Unit Profile"}
              </p>
            </div>

            <div className="mt-6 text-white/50 text-sm animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              Toque para fechar
            </div>
          </div>
        </div>
      )}

      {/* Dragged hand card ghost */}
      {draggedHandCard && (
        <div
          ref={draggedCardRef}
          className="fixed top-0 left-0 pointer-events-none z-[70]"
          style={{
            willChange: "transform",
            transform: `translate(${dragPosRef.current.x - 40}px, ${dragPosRef.current.y - 56}px) rotate(0deg) scale(1.1)`,
          }}
        >
          {/* Glow */}
          <div
            className={`absolute -inset-3 rounded-xl blur-xl transition-all duration-150 ${dropTarget ? "bg-green-400/60" : "bg-yellow-400/40"
              }`}
          />
          {/* Card */}
          <div
            className={`relative w-20 h-28 rounded-xl border-3 shadow-2xl overflow-hidden bg-slate-900 transition-all duration-100 ${dropTarget ? "border-green-400 shadow-green-500/60" : "border-yellow-400 shadow-yellow-500/50"
              }`}
          >
            <img
              src={draggedHandCard.card.image || "/placeholder.svg"}
              alt={draggedHandCard.card.name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        </div>
      )}

      {/* Card materialize in slot animation */}
      {droppingCard && (
        <div
          className="fixed pointer-events-none z-[80]"
          style={{
            left: droppingCard.targetX - 32,
            top: droppingCard.targetY - 44,
          }}
        >
          {/* Ring effect */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: "summonRing 500ms ease-out forwards" }}
          >
            <div className="w-20 h-20 rounded-full border-2 border-cyan-400/80" />
          </div>
          {/* Glow burst */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: "summonGlow 450ms ease-out forwards" }}
          >
            <div className="w-16 h-16 bg-cyan-400/50 rounded-full blur-2xl" />
          </div>
          {/* Card materializing */}
          <div
            className="relative rounded-lg border-2 border-cyan-400 shadow-xl shadow-cyan-500/60 overflow-hidden bg-slate-900"
            style={{
              width: "64px",
              height: "88px",
              animation: "cardMaterialize 500ms ease-out forwards",
              transformStyle: "preserve-3d",
            }}
          >
            <img
              src={droppingCard.card.image || "/placeholder.svg"}
              alt={droppingCard.card.name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        </div>
      )}
      {/* TAP Modal - Redesigned with premium aesthetics */}
      {tapView && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-gradient-to-b from-slate-900/95 to-black/95 border-2 border-orange-500/40 rounded-3xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-orange-600/10 to-transparent">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-red-600 to-orange-700 flex items-center justify-center shadow-lg transform rotate-3">
                  <Swords className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-widest uppercase italic">
                    {tapView === "player" ? "Tactical Access Pile" : "Opponent Tactical Pile"}
                  </h2>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTapView(null)}
                className="text-slate-500 hover:text-white hover:bg-white/5 rounded-full w-12 h-12 transition-all"
              >
                <X className="w-8 h-8" />
              </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
              {(() => {
                const isAvailable = turn > 0 && turn % 3 === 0 && isMyTurn && phase === "main"
                const activeTap = tapView === "player" ? myField.tap : opponentField.tap

                if (activeTap.length === 0) {
                  return (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-700 gap-5 opacity-50">
                      <div className="w-20 h-20 rounded-full border-4 border-dashed border-slate-800 flex items-center justify-center">
                        <Swords className="w-10 h-10" />
                      </div>
                      <p className="font-bold text-xl tracking-wider">TAP AREA DEPLETED</p>
                    </div>
                  )
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-10 justify-items-center">
                    {activeTap.map((card, i) => {
                      const isPlayable = tapView === "player" && isAvailable
                      return (
                        <div 
                          key={i} 
                          className="relative group perspective-1000"
                          onMouseDown={() => handleCardPressStart(card)}
                          onMouseUp={handleCardPressEnd}
                          onMouseLeave={handleCardPressEnd}
                          onTouchStart={() => handleCardPressStart(card)}
                          onTouchEnd={handleCardPressEnd}
                        >
                          <div
                            className={`relative w-40 h-56 rounded-xl overflow-hidden border-2 transition-all duration-500 transform-gpu ${isPlayable
                              ? "border-orange-500/40 cursor-pointer group-hover:scale-110 group-hover:-translate-y-4 group-hover:border-orange-400 group-hover:shadow-[0_20px_40px_rgba(249,115,22,0.3)] shadow-[0_0_20px_rgba(249,115,22,0.1)]"
                              : "border-slate-800/50 opacity-40 grayscale-[0.8]"
                              }`}
                            onClick={() => {
                              if (isPlayable) {
                                if (isUltimateCard(card)) playCardFromTap(i, "ultimate")
                                else if (card.type === "scenario") playCardFromTap(i, "scenario")
                                else if (isUnitCard(card)) {
                                  const emptyIdx = myField.unitZone.findIndex(s => s === null)
                                  if (emptyIdx !== -1) playCardFromTap(i, "unit", emptyIdx)
                                  else showEffectFeedback("Sem espaço na zona de unidades!", "error")
                                } else {
                                  const emptyIdx = myField.functionZone.findIndex(s => s === null)
                                  if (emptyIdx !== -1) playCardFromTap(i, "function", emptyIdx)
                                  else showEffectFeedback("Sem espaço na zona de funções!", "error")
                                }
                              }
                            }}
                          >
                            <Image src={card.image || "/placeholder.svg"} alt={card.name} fill className="object-cover" />

                            {/* Available Glow Overlay */}
                            {isPlayable && (
                              <div className="absolute inset-0 bg-gradient-to-t from-orange-600/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end pb-4">
                                <div className="bg-orange-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-2xl tracking-widest">
                                  DEPLOY
                                </div>
                              </div>
                            )}

                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-all duration-700 -translate-x-full group-hover:translate-x-full" />
                          </div>

                          {/* Card Info */}
                          <div className="mt-4 text-center transition-all duration-300 group-hover:opacity-100 opacity-80">
                            <div className="text-white font-black text-xs uppercase tracking-tight truncate w-40">{card.name}</div>
                            <div className={`text-[9px] font-black uppercase mt-1 tracking-[0.2em] ${isPlayable ? "text-orange-500" : "text-slate-600"}`}>
                              {card.type}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* Footer / Status - Empty for practicality */}
            <div className="p-4 bg-white/5 border-t border-white/5" />
          </div>
        </div>
      )}

      {/* Effect Feedback Overlay */}
      {effectFeedback && effectFeedback.active && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] pointer-events-none animate-in fade-in zoom-in duration-300">
          <div className={`px-12 py-6 rounded-3xl border-2 backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.5)] flex flex-col items-center gap-3 ${effectFeedback.type === "success"
            ? "bg-green-500/20 border-green-500/50"
            : "bg-red-500/20 border-red-500/50"
            }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${effectFeedback.type === "success" ? "bg-green-500" : "bg-red-500"
              }`}>
              {effectFeedback.type === "success" ? (
                <Swords className="w-6 h-6 text-white" />
              ) : (
                <X className="w-6 h-6 text-white" />
              )}
            </div>
            <p className="text-2xl font-black text-white uppercase tracking-widest italic drop-shadow-lg">
              {effectFeedback.message}
            </p>
          </div>
        </div>
      )}
      {/* Modal containers */}
      <div id="modal-root" />
    </div>
  )
}
