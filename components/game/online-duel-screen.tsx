"use client"

import type React from "react"
import type { Deck as GameDeck, Card as GameCard } from "@/contexts/game-context"
import { useState, useEffect, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, CARD_BACK_IMAGE } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Swords, X, MessageCircle, Send } from "lucide-react"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { ElementalAttackAnimation, type AttackAnimationProps } from "./elemental-attack-animation"
import { DiscardAnimationManager } from "./card-discard-animation"

// ─── Multiplayer types ────────────────────────────────────────────────────────
interface RoomData {
  roomId: string
  roomCode: string
  isHost: boolean
  hostId: string
  hostName: string
  hostDeck: GameDeck | null
  guestId: string | null
  guestName: string | null
  guestDeck: GameDeck | null
  hostReady: boolean
  guestReady: boolean
}

interface DuelAction {
  type: string
  playerId: string
  data: any
  timestamp: number
}

interface OnlineChatMessage {
  id: string
  sender_id: string
  sender_name: string
  message: string
  created_at: string
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
  canAttackTurn: number // Made required, not optional
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

interface AttackState {
  isAttacking: boolean
  attackerIndex: number | null
  targetInfo?: { type: "unit" | "direct"; index?: number } | null
}

interface DropTarget {
  type: "unit" | "function" | "scenario" | "ultimate"
  index: number
}

interface ExplosionEffect {
  id: string
  x: number
  y: number
  element: string
  particles: Particle[]
  startTime: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  color: string
  gravity?: number
  heat?: number
  shape?: string
  rotation?: number
  rv?: number
}

// Define interface for Deck with image and playmat image
interface DeckWithImages extends GameDeck {
  image?: string
  playmatImage?: string
}

// ==========================================
// CENTRALIZED FUNCTION CARD EFFECT SYSTEM
// ==========================================

interface FunctionCardEffect {
  id: string
  name: string
  requiresTargets: boolean
  requiresChoice?: boolean
  choiceOptions?: { id: string; label: string; description: string }[]
  targetConfig?: {
    enemyUnits?: number
    allyUnits?: number
    ownFunctions?: number
  }
  requiresDice?: boolean
  needsDrawAfterResolve?: boolean
  resolve: (context: EffectContext, targets?: EffectTargets) => EffectResult
  canActivate: (context: EffectContext) => { canActivate: boolean; reason?: string }
}

interface EffectContext {
  playerField: FieldState
  enemyField: FieldState
  setPlayerField: React.Dispatch<React.SetStateAction<FieldState>>
  setEnemyField: React.Dispatch<React.SetStateAction<FieldState>>
}

interface EffectTargets {
  enemyUnitIndices?: number[]
  allyUnitIndices?: number[]
  chosenOption?: string
  diceResult?: number // Result of dice roll (1-6)
}

// Global projectile delay
const PROJECTILE_DURATION = 500 // Synchronized with ElementalAttackAnimation (150ms charge + 350ms travel)

interface EffectResult {
  success: boolean
  message?: string
  cardToDiscard?: GameCard
  needsDrawAndCheck?: boolean
  needsDrawAndCheckUnit?: boolean
  needsDrawOnly?: boolean
  currentLife?: number
}

// Registry of all Function card effects
const FUNCTION_CARD_EFFECTS: Record<string, FunctionCardEffect> = {
  "amplificador-de-poder": {
    id: "amplificador-de-poder",
    name: "Amplificador de Poder",
    requiresTargets: true,
    targetConfig: {
      enemyUnits: 1,
      allyUnits: 1,
    },
    canActivate: (context) => {
      const hasEnemyUnits = context.enemyField.unitZone.some((u) => u !== null)
      const hasPlayerUnits = context.playerField.unitZone.some((u) => u !== null)

      if (!hasEnemyUnits) {
        return { canActivate: false, reason: "Nenhuma unidade inimiga no campo" }
      }
      if (!hasPlayerUnits) {
        return { canActivate: false, reason: "Nenhuma unidade aliada no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      if (!targets?.enemyUnitIndices?.length || !targets?.allyUnitIndices?.length) {
        return { success: false, message: "Alvos invalidos" }
      }

      const enemyIndex = targets.enemyUnitIndices[0]
      const allyIndex = targets.allyUnitIndices[0]
      const enemyUnit = context.enemyField.unitZone[enemyIndex]
      const allyUnit = context.playerField.unitZone[allyIndex]

      if (!enemyUnit || !allyUnit) {
        return { success: false, message: "Unidades nao encontradas" }
      }

      // Get ORIGINAL DP (base dp, not currentDp which may have buffs/debuffs)
      const dpBonus = enemyUnit.dp
      const allyCurrentDp = allyUnit.currentDp || allyUnit.dp
      const newDp = allyCurrentDp + dpBonus

      context.setPlayerField((prev) => {
        const newUnitZone = [...prev.unitZone]
        if (newUnitZone[allyIndex]) {
          newUnitZone[allyIndex] = {
            ...newUnitZone[allyIndex]!,
            currentDp: newDp,
          }
        }
        return { ...prev, unitZone: newUnitZone }
      })

      return { success: true, message: `+${dpBonus} DP aplicado! (${allyCurrentDp} -> ${newDp})` }
    },
  },

  "bandagem-restauradora": {
    id: "bandagem-restauradora",
    name: "Bandagem Restauradora",
    requiresTargets: false,
    canActivate: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20 // Max LP

      if (currentLife >= maxLife) {
        return { canActivate: false, reason: "LP ja esta no maximo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20
      const healAmount = Math.min(2, maxLife - currentLife) // Heal up to 2, but don't exceed max

      if (healAmount <= 0) {
        return { success: false, message: "Nao ha dano para curar" }
      }

      const newLife = Math.min(currentLife + healAmount, maxLife)

      context.setPlayerField((prev) => ({
        ...prev,
        life: newLife,
      }))

      return { success: true, message: `+${healAmount} LP restaurado! (${currentLife} -> ${newLife})` }
    },
  },

  "adaga-energizada": {
    id: "adaga-energizada",
    name: "Adaga Energizada",
    requiresTargets: false,
    canActivate: (context) => {
      // Count enemy units on the field
      const enemyUnitCount = context.enemyField.unitZone.filter((u) => u !== null).length

      if (enemyUnitCount < 2) {
        return { canActivate: false, reason: "O oponente precisa ter 2 ou mais unidades no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      // Deal 4 direct damage to enemy LP
      const damage = 4
      const currentEnemyLife = context.enemyField.life
      const newEnemyLife = Math.max(0, currentEnemyLife - damage)

      context.setEnemyField((prev) => ({
        ...prev,
        life: newEnemyLife,
      }))

      return { success: true, message: `4 de dano direto! LP do oponente: ${currentEnemyLife} -> ${newEnemyLife}` }
    },
  },

  "bandagens-duplas": {
    id: "bandagens-duplas",
    name: "Bandagens Duplas",
    requiresTargets: false,
    canActivate: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20 // Max LP

      if (currentLife >= maxLife) {
        return { canActivate: false, reason: "LP ja esta no maximo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20
      const healAmount = Math.min(4, maxLife - currentLife) // Heal up to 4, but don't exceed max

      if (healAmount <= 0) {
        return { success: false, message: "Nao ha dano para curar" }
      }

      const newLife = Math.min(currentLife + healAmount, maxLife)

      context.setPlayerField((prev) => ({
        ...prev,
        life: newLife,
      }))

      return { success: true, message: `+${healAmount} LP restaurado! (${currentLife} -> ${newLife})` }
    },
  },

  "cristal-recuperador": {
    id: "cristal-recuperador",
    name: "Cristal Recuperador",
    requiresTargets: false,
    // This effect needs special handling because it draws a card
    // We'll mark it as needing post-resolution draw
    needsDrawAfterResolve: true,
    canActivate: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20

      if (currentLife >= maxLife) {
        return { canActivate: false, reason: "LP ja esta no maximo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20
      const healAmount = Math.min(3, maxLife - currentLife)
      const newLife = Math.min(currentLife + healAmount, maxLife)

      context.setPlayerField((prev) => ({
        ...prev,
        life: newLife,
      }))

      // Return special flag to indicate we need to draw and potentially heal more
      return {
        success: true,
        message: `+${healAmount} LP restaurado! (${currentLife} -> ${newLife})`,
        needsDrawAndCheck: true,
        currentLife: newLife,
      }
    },
  },

  "cauda-de-dragao-assada": {
    id: "cauda-de-dragao-assada",
    name: "Cauda de Dragão Assada",
    requiresTargets: false,
    canActivate: (context) => {
      // Count player units on the field
      const playerUnitCount = context.playerField.unitZone.filter((u) => u !== null).length

      if (playerUnitCount < 2) {
        return { canActivate: false, reason: "Voce precisa ter 2 ou mais unidades no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      const maxLife = 20
      const currentLife = context.playerField.life
      const healAmount = Math.min(2, maxLife - currentLife)
      const newLife = Math.min(currentLife + healAmount, maxLife)

      // Buff all player units with +1 DP
      context.setPlayerField((prev) => ({
        ...prev,
        life: newLife,
        unitZone: prev.unitZone.map((unit) => {
          if (unit === null) return null
          return {
            ...unit,
            currentDp: (unit.currentDp || unit.dp) + 1,
          }
        }),
      }))

      const unitCount = context.playerField.unitZone.filter((u) => u !== null).length
      const healMsg = healAmount > 0 ? ` +${healAmount} LP (${currentLife} -> ${newLife})` : ""
      return { success: true, message: `+1 DP para ${unitCount} unidades!${healMsg}` }
    },
  },

  "projetil-de-impacto": {
    id: "projetil-de-impacto",
    name: "Projétil de Impacto",
    requiresTargets: false,
    canActivate: () => {
      // No condition - can always be activated
      return { canActivate: true }
    },
    resolve: (context) => {
      // Deal 2 direct damage to enemy LP
      const damage = 2
      const currentEnemyLife = context.enemyField.life
      const newEnemyLife = Math.max(0, currentEnemyLife - damage)

      context.setEnemyField((prev) => ({
        ...prev,
        life: newEnemyLife,
      }))

      return { success: true, message: `2 de dano direto! LP do oponente: ${currentEnemyLife} -> ${newEnemyLife}` }
    },
  },

  "veu-dos-lacos-cruzados": {
    id: "veu-dos-lacos-cruzados",
    name: "Véu dos Laços Cruzados",
    requiresTargets: true,
    requiresChoice: true, // Requires player to choose between two options
    choiceOptions: [
      { id: "buff", label: "+2 DP em Fehnon/Jaden", description: "Adiciona 2 DP a uma unidade Fehnon Hoskie ou Jaden Hainaegi sua" },
      { id: "debuff", label: "-2 DP em inimigo", description: "Reduz 2 DP de uma unidade do oponente" },
    ],
    targetConfig: {
      allyUnits: 1,
    },
    canActivate: (context) => {
      // Check if player has Fehnon Hoskie or Jaden Hainaegi on field
      const hasRequiredUnit = context.playerField.unitZone.some((u) =>
        u !== null && (u.name === "Fehnon Hoskie" || u.name === "Jaden Hainaegi")
      )

      if (!hasRequiredUnit) {
        return { canActivate: false, reason: "Voce precisa ter Fehnon Hoskie ou Jaden Hainaegi no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      const chosenOption = targets?.chosenOption

      if (chosenOption === "buff") {
        // Buff option: +2 DP to Fehnon or Jaden
        if (!targets?.allyUnitIndices?.length) {
          return { success: false, message: "Selecione uma unidade Fehnon ou Jaden" }
        }

        const allyIndex = targets.allyUnitIndices[0]
        const allyUnit = context.playerField.unitZone[allyIndex]

        if (!allyUnit || (allyUnit.name !== "Fehnon Hoskie" && allyUnit.name !== "Jaden Hainaegi")) {
          return { success: false, message: "Selecione Fehnon Hoskie ou Jaden Hainaegi" }
        }

        const currentDp = allyUnit.currentDp || allyUnit.dp
        const newDp = currentDp + 2

        context.setPlayerField((prev) => {
          const newUnitZone = [...prev.unitZone]
          if (newUnitZone[allyIndex]) {
            newUnitZone[allyIndex] = {
              ...newUnitZone[allyIndex]!,
              currentDp: newDp,
            }
          }
          return { ...prev, unitZone: newUnitZone }
        })

        return { success: true, message: `${allyUnit.name} recebeu +2 DP! (${currentDp} -> ${newDp})` }
      } else if (chosenOption === "debuff") {
        // Debuff option: -2 DP to enemy unit
        if (!targets?.enemyUnitIndices?.length) {
          return { success: false, message: "Selecione uma unidade inimiga" }
        }

        const enemyIndex = targets.enemyUnitIndices[0]
        const enemyUnit = context.enemyField.unitZone[enemyIndex]

        if (!enemyUnit) {
          return { success: false, message: "Unidade inimiga nao encontrada" }
        }

        const currentDp = enemyUnit.currentDp || enemyUnit.dp
        const newDp = Math.max(0, currentDp - 2)

        context.setEnemyField((prev) => {
          const newUnitZone = [...prev.unitZone]
          if (newUnitZone[enemyIndex]) {
            newUnitZone[enemyIndex] = {
              ...newUnitZone[enemyIndex]!,
              currentDp: newDp,
            }
          }
          return { ...prev, unitZone: newUnitZone }
        })

        return { success: true, message: `${enemyUnit.name} perdeu 2 DP! (${currentDp} -> ${newDp})` }
      }

      return { success: false, message: "Escolha uma opcao" }
    },
  },

  "nucleo-explosivo": {
    id: "nucleo-explosivo",
    name: "Núcleo Explosivo",
    requiresTargets: false,
    canActivate: (context) => {
      // Check if opponent has at least 1 unit on field
      const enemyUnitCount = context.enemyField.unitZone.filter((u) => u !== null).length

      if (enemyUnitCount === 0) {
        return { canActivate: false, reason: "O oponente precisa ter ao menos 1 unidade no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      // Deal 1 damage to each enemy unit
      let unitsHit = 0

      context.setEnemyField((prev) => ({
        ...prev,
        unitZone: prev.unitZone.map((unit) => {
          if (unit === null) return null
          unitsHit++
          const currentDp = unit.currentDp || unit.dp
          const newDp = Math.max(0, currentDp - 1)
          return {
            ...unit,
            currentDp: newDp,
          }
        }),
      }))

      return { success: true, message: `1 de dano em ${unitsHit} unidade(s) inimigas!` }
    },
  },

  "kit-medico-improvisado": {
    id: "kit-medico-improvisado",
    name: "Kit Médico Improvisado",
    requiresTargets: false,
    needsDrawAfterResolve: true,
    canActivate: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20

      if (currentLife >= maxLife) {
        return { canActivate: false, reason: "LP ja esta no maximo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20
      const healAmount = Math.min(2, maxLife - currentLife)
      const newLife = Math.min(currentLife + healAmount, maxLife)

      context.setPlayerField((prev) => ({
        ...prev,
        life: newLife,
      }))

      // Return special flag to indicate we need to draw and check for Unit type
      return {
        success: true,
        message: `+${healAmount} LP restaurado! (${currentLife} -> ${newLife})`,
        needsDrawAndCheckUnit: true,
        currentLife: newLife,
      }
    },
  },

  "soro-recuperador": {
    id: "soro-recuperador",
    name: "Soro Recuperador",
    requiresTargets: false,
    needsDrawAfterResolve: true,
    canActivate: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20

      if (currentLife >= maxLife) {
        return { canActivate: false, reason: "LP ja esta no maximo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      const currentLife = context.playerField.life
      const maxLife = 20
      const healAmount = Math.min(3, maxLife - currentLife)
      const newLife = Math.min(currentLife + healAmount, maxLife)

      context.setPlayerField((prev) => ({
        ...prev,
        life: newLife,
      }))

      // Return special flag to indicate we need to draw (no bonus check)
      return {
        success: true,
        message: `+${healAmount} LP restaurado! (${currentLife} -> ${newLife})`,
        needsDrawOnly: true,
        currentLife: newLife,
      }
    },
  },

  "ordem-de-laceracao": {
    id: "ordem-de-laceracao",
    name: "Ordem de Laceração",
    requiresTargets: false,
    canActivate: (context) => {
      // Check if player has Fehnon Hoskie on field
      const hasFehnon = context.playerField.unitZone.some((u) =>
        u !== null && u.name === "Fehnon Hoskie"
      )

      if (!hasFehnon) {
        return { canActivate: false, reason: "Voce precisa ter Fehnon Hoskie no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      // Deal 3 direct damage to enemy LP (ignores unit abilities)
      const damage = 3
      const currentEnemyLife = context.enemyField.life
      const newEnemyLife = Math.max(0, currentEnemyLife - damage)

      context.setEnemyField((prev) => ({
        ...prev,
        life: newEnemyLife,
      }))

      return { success: true, message: `3 de dano direto! LP do oponente: ${currentEnemyLife} -> ${newEnemyLife}` }
    },
  },

  "sinfonia-relampago": {
    id: "sinfonia-relampago",
    name: "Sinfonia Relâmpago",
    requiresTargets: false,
    canActivate: (context) => {
      // Check if player has Morgana Pendragon on field
      const hasMorgana = context.playerField.unitZone.some((u) =>
        u !== null && u.name === "Morgana Pendragon"
      )

      if (!hasMorgana) {
        return { canActivate: false, reason: "Voce precisa ter Morgana Pendragon no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      // Deal 4 direct damage to enemy LP (cannot be negated by traps)
      const damage = 4
      const currentEnemyLife = context.enemyField.life
      const newEnemyLife = Math.max(0, currentEnemyLife - damage)

      context.setEnemyField((prev) => ({
        ...prev,
        life: newEnemyLife,
      }))

      return { success: true, message: `4 de dano direto! LP do oponente: ${currentEnemyLife} -> ${newEnemyLife}` }
    },
  },

  "fafnisbani": {
    id: "fafnisbani",
    name: "Fafnisbani",
    requiresTargets: true,
    requiresChoice: true,
    choiceOptions: [
      { id: "unit", label: "Atacar Unidade", description: "Causa 3 de dano a uma unidade inimiga" },
      { id: "lp", label: "Atacar LP", description: "Causa 3 de dano direto ao LP do oponente" },
    ],
    canActivate: (context) => {
      // Check if player has Scandinavian Angel Hrotti on field (any variant name)
      const hasHrotti = context.playerField.unitZone.some((u) =>
        u !== null && (u.name === "Scandinavian Angel Hrotti" || u.name?.toLowerCase().includes("hrotti"))
      )

      if (!hasHrotti) {
        return { canActivate: false, reason: "Voce precisa ter Scandinavian Angel Hrotti no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      const chosenOption = targets?.chosenOption

      if (chosenOption === "lp") {
        // Direct damage to LP
        const damage = 3
        const currentEnemyLife = context.enemyField.life
        const newEnemyLife = Math.max(0, currentEnemyLife - damage)

        context.setEnemyField((prev) => ({
          ...prev,
          life: newEnemyLife,
        }))

        return { success: true, message: `Fafnisbani! 3 de dano direto! LP: ${currentEnemyLife} -> ${newEnemyLife}` }
      } else if (chosenOption === "unit") {
        // Damage to enemy unit
        if (!targets?.enemyUnitIndices?.length) {
          return { success: false, message: "Selecione uma unidade inimiga" }
        }

        const enemyIndex = targets.enemyUnitIndices[0]
        const enemyUnit = context.enemyField.unitZone[enemyIndex]

        if (!enemyUnit) {
          return { success: false, message: "Unidade inimiga nao encontrada" }
        }

        const currentDp = enemyUnit.currentDp || enemyUnit.dp
        const newDp = Math.max(0, currentDp - 3)
        const isDestroyed = newDp <= 0

        context.setEnemyField((prev) => {
          const newUnitZone = [...prev.unitZone]
          const newGraveyard = [...prev.graveyard]

          if (isDestroyed) {
            // Unit is destroyed - send to graveyard
            if (newUnitZone[enemyIndex]) {
              newGraveyard.push(newUnitZone[enemyIndex]!)
            }
            newUnitZone[enemyIndex] = null
          } else {
            // Unit survives with reduced DP
            if (newUnitZone[enemyIndex]) {
              newUnitZone[enemyIndex] = {
                ...newUnitZone[enemyIndex]!,
                currentDp: newDp,
              }
            }
          }
          return { ...prev, unitZone: newUnitZone, graveyard: newGraveyard }
        })

        if (isDestroyed) {
          return { success: true, message: `Fafnisbani! ${enemyUnit.name} foi destruido!` }
        }
        return { success: true, message: `Fafnisbani! ${enemyUnit.name} recebeu 3 de dano! (${currentDp} -> ${newDp})` }
      }

      return { success: false, message: "Escolha uma opcao" }
    },
  },

  "devorar-o-mundo": {
    id: "devorar-o-mundo",
    name: "Devorar o Mundo",
    requiresTargets: true,
    requiresChoice: true,
    choiceOptions: [
      { id: "unit", label: "Atacar Unidade", description: "Causa 4 de dano a uma unidade inimiga" },
      { id: "lp", label: "Atacar LP", description: "Causa 4 de dano direto ao LP do oponente" },
    ],
    canActivate: (context) => {
      // Check if player has Scandinavian Angel Logi on field (any variant name)
      const hasLogi = context.playerField.unitZone.some((u) =>
        u !== null && (u.name === "Scandinavian Angel Logi" || u.name?.toLowerCase().includes("logi"))
      )

      if (!hasLogi) {
        return { canActivate: false, reason: "Voce precisa ter Scandinavian Angel Logi no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      const chosenOption = targets?.chosenOption

      if (chosenOption === "lp") {
        // Direct damage to LP
        const damage = 4
        const currentEnemyLife = context.enemyField.life
        const newEnemyLife = Math.max(0, currentEnemyLife - damage)

        context.setEnemyField((prev) => ({
          ...prev,
          life: newEnemyLife,
        }))

        return { success: true, message: `Devorar o Mundo! 4 de dano direto! LP: ${currentEnemyLife} -> ${newEnemyLife}` }
      } else if (chosenOption === "unit") {
        // Damage to enemy unit
        if (!targets?.enemyUnitIndices?.length) {
          return { success: false, message: "Selecione uma unidade inimiga" }
        }

        const enemyIndex = targets.enemyUnitIndices[0]
        const enemyUnit = context.enemyField.unitZone[enemyIndex]

        if (!enemyUnit) {
          return { success: false, message: "Unidade inimiga nao encontrada" }
        }

        const currentDp = enemyUnit.currentDp || enemyUnit.dp
        const newDp = Math.max(0, currentDp - 4)
        const isDestroyed = newDp <= 0

        context.setEnemyField((prev) => {
          const newUnitZone = [...prev.unitZone]
          const newGraveyard = [...prev.graveyard]

          if (isDestroyed) {
            // Unit is destroyed - send to graveyard
            if (newUnitZone[enemyIndex]) {
              newGraveyard.push(newUnitZone[enemyIndex]!)
            }
            newUnitZone[enemyIndex] = null
          } else {
            // Unit survives with reduced DP
            if (newUnitZone[enemyIndex]) {
              newUnitZone[enemyIndex] = {
                ...newUnitZone[enemyIndex]!,
                currentDp: newDp,
              }
            }
          }
          return { ...prev, unitZone: newUnitZone, graveyard: newGraveyard }
        })

        if (isDestroyed) {
          return { success: true, message: `Devorar o Mundo! ${enemyUnit.name} foi destruido!` }
        }
        return { success: true, message: `Devorar o Mundo! ${enemyUnit.name} recebeu 4 de dano! (${currentDp} -> ${newDp})` }
      }

      return { success: false, message: "Escolha uma opcao" }
    },
  },

  // ========== DICE FUNCTION CARDS ==========

  "dados-do-destino-gentil": {
    id: "dados-do-destino-gentil",
    name: "Dados do Destino Gentil",
    requiresTargets: true,
    requiresDice: true,
    targetConfig: {
      allyUnits: 1,
    },
    canActivate: (context) => {
      const hasAllyUnits = context.playerField.unitZone.some((u) => u !== null)
      if (!hasAllyUnits) {
        return { canActivate: false, reason: "Voce precisa ter uma unidade em campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      if (!targets?.allyUnitIndices?.length) {
        return { success: false, message: "Selecione uma unidade sua" }
      }

      const allyIndex = targets.allyUnitIndices[0]
      const allyUnit = context.playerField.unitZone[allyIndex]

      if (!allyUnit) {
        return { success: false, message: "Unidade nao encontrada" }
      }

      const diceResult = targets.diceResult || 1
      const currentDp = allyUnit.currentDp || allyUnit.dp

      if (diceResult >= 1 && diceResult <= 3) {
        // 1-3: -3 DP
        const newDp = Math.max(0, currentDp - 3)
        const isDestroyed = newDp <= 0

        context.setPlayerField((prev) => {
          const newUnitZone = [...prev.unitZone]
          const newGraveyard = [...prev.graveyard]

          if (isDestroyed) {
            if (newUnitZone[allyIndex]) {
              newGraveyard.push(newUnitZone[allyIndex]!)
            }
            newUnitZone[allyIndex] = null
          } else {
            if (newUnitZone[allyIndex]) {
              newUnitZone[allyIndex] = { ...newUnitZone[allyIndex]!, currentDp: newDp }
            }
          }
          return { ...prev, unitZone: newUnitZone, graveyard: newGraveyard }
        })

        if (isDestroyed) {
          return { success: true, message: `Dado: ${diceResult}! ${allyUnit.name} perdeu 3 DP e foi destruida!` }
        }
        return { success: true, message: `Dado: ${diceResult}! ${allyUnit.name} perdeu 3 DP (${currentDp} -> ${newDp})` }
      } else {
        // 4-6: +5 DP
        const newDp = currentDp + 5

        context.setPlayerField((prev) => {
          const newUnitZone = [...prev.unitZone]
          if (newUnitZone[allyIndex]) {
            newUnitZone[allyIndex] = { ...newUnitZone[allyIndex]!, currentDp: newDp }
          }
          return { ...prev, unitZone: newUnitZone }
        })

        return { success: true, message: `Dado: ${diceResult}! ${allyUnit.name} ganhou +5 DP! (${currentDp} -> ${newDp})` }
      }
    },
  },

  "dados-elementais-alpha": {
    id: "dados-elementais-alpha",
    name: "Dados Elementais Alpha",
    requiresTargets: true,
    requiresDice: true,
    targetConfig: {
      allyUnits: 1,
    },
    canActivate: (context) => {
      // Cards treated as Fire by name even if element tag differs
      const fireNames = ["scandinavian angel logi", "jaden hainaegi"]
      const isFireByName = (u: any) =>
        fireNames.some(n => u.name?.toLowerCase().includes(n))

      // Cards treated as Darkness by name
      const darknessNames = ["morgana pendragon"]
      const isDarknessByName = (u: any) =>
        darknessNames.some(n => u.name?.toLowerCase().includes(n))

      const validElements = ["darkness", "fire", "aquos"]
      const hasValidUnit = context.playerField.unitZone.some((u) =>
        u !== null && (
          validElements.includes(u.element?.toLowerCase() || "") ||
          isFireByName(u) ||
          isDarknessByName(u)
        )
      )
      if (!hasValidUnit) {
        return { canActivate: false, reason: "Precisa de unidade Darkness, Fire ou Aquos em campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      if (!targets?.allyUnitIndices?.length) {
        return { success: false, message: "Selecione uma unidade sua" }
      }

      const allyIndex = targets.allyUnitIndices[0]
      const allyUnit = context.playerField.unitZone[allyIndex]

      if (!allyUnit) {
        return { success: false, message: "Unidade nao encontrada" }
      }

      // Cards treated as Fire by name
      const fireNames = ["scandinavian angel logi", "jaden hainaegi"]
      const isFireByName = fireNames.some(n =>
        allyUnit.name?.toLowerCase().includes(n)
      )

      // Cards treated as Darkness by name
      const darknessNames = ["morgana pendragon"]
      const isDarknessByName = darknessNames.some(n =>
        allyUnit.name?.toLowerCase().includes(n)
      )

      const validElements = ["darkness", "fire", "aquos"]
      const rawElement = allyUnit.element?.toLowerCase() || ""
      // Override element for named cards
      const effectiveElement = isFireByName ? "fire" : isDarknessByName ? "darkness" : rawElement

      if (!validElements.includes(rawElement) && !isFireByName && !isDarknessByName) {
        return { success: false, message: "Unidade deve ser Darkness, Fire ou Aquos" }
      }

      const diceResult = targets.diceResult || 1
      const currentDp = allyUnit.currentDp || allyUnit.dp
      let dpBonus = 0
      let bonusMessage = ""

      if (diceResult >= 1 && diceResult <= 2) {
        dpBonus = 3
        if (effectiveElement === "darkness") {
          // Bonus: Draw 1 card
          if (context.playerField.deck.length > 0) {
            const drawnCard = context.playerField.deck[0]
            context.setPlayerField((prev) => ({
              ...prev,
              hand: [...prev.hand, drawnCard],
              deck: prev.deck.slice(1),
            }))
            bonusMessage = " Bonus Darkness: Comprou 1 carta!"
          }
        }
      } else if (diceResult >= 3 && diceResult <= 4) {
        dpBonus = 4
        if (effectiveElement === "fire") {
          // Bonus: +2 LP
          context.setPlayerField((prev) => ({ ...prev, life: prev.life + 2 }))
          bonusMessage = " Bonus Fire: +2 LP!"
        }
      } else {
        dpBonus = 5
        if (effectiveElement === "aquos") {
          // Bonus: +3 LP
          context.setPlayerField((prev) => ({ ...prev, life: prev.life + 3 }))
          bonusMessage = " Bonus Aquos: +3 LP!"
        }
      }

      const newDp = currentDp + dpBonus
      context.setPlayerField((prev) => {
        const newUnitZone = [...prev.unitZone]
        if (newUnitZone[allyIndex]) {
          newUnitZone[allyIndex] = { ...newUnitZone[allyIndex]!, currentDp: newDp }
        }
        return { ...prev, unitZone: newUnitZone }
      })

      return { success: true, message: `Dado: ${diceResult}! ${allyUnit.name} +${dpBonus} DP!${bonusMessage}` }
    },
  },

  "dados-elementais-omega": {
    id: "dados-elementais-omega",
    name: "Dados Elementais Omega",
    requiresTargets: true,
    requiresDice: true,
    targetConfig: {
      allyUnits: 1,
    },
    canActivate: (context) => {
      // Cards treated as Lightness by name even if element tag differs
      const lightnessNames = ["santo graal galahad", "mordred, o usurpador"]
      const isLightnessByName = (u: any) =>
        lightnessNames.some(n => u.name?.toLowerCase().includes(n))

      // Cards treated as Darkness by name
      const darknessNames = ["morgana pendragon"]
      const isDarknessByName = (u: any) =>
        darknessNames.some(n => u.name?.toLowerCase().includes(n))

      const validElements = ["neutral", "lightness", "ventus", "void", "darkness"]
      const hasValidUnit = context.playerField.unitZone.some((u) =>
        u !== null && (
          validElements.includes(u.element?.toLowerCase() || "") ||
          isLightnessByName(u) ||
          isDarknessByName(u)
        )
      )
      if (!hasValidUnit) {
        return { canActivate: false, reason: "Precisa de unidade Neutral, Lightness, Ventus, Void ou Darkness em campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      if (!targets?.allyUnitIndices?.length) {
        return { success: false, message: "Selecione uma unidade sua" }
      }

      const allyIndex = targets.allyUnitIndices[0]
      const allyUnit = context.playerField.unitZone[allyIndex]

      if (!allyUnit) {
        return { success: false, message: "Unidade nao encontrada" }
      }

      // Cards treated as Lightness by name
      const lightnessNames = ["santo graal galahad", "mordred, o usurpador"]
      const isLightnessByName = lightnessNames.some(n =>
        allyUnit.name?.toLowerCase().includes(n)
      )

      // Cards treated as Darkness by name
      const darknessNames = ["morgana pendragon"]
      const isDarknessByName = darknessNames.some(n =>
        allyUnit.name?.toLowerCase().includes(n)
      )

      const validElements = ["neutral", "lightness", "ventus", "void", "darkness"]
      const rawElement = allyUnit.element?.toLowerCase() || ""
      // Treat Void as Neutral for dice bonus purposes
      // Treat named Lightness cards as Lightness even if element tag differs
      // Treat named Darkness cards as Darkness even if element tag differs
      const effectiveElement = isLightnessByName
        ? "lightness"
        : isDarknessByName
          ? "darkness"
          : rawElement === "void" ? "neutral" : rawElement

      if (!validElements.includes(rawElement) && !isLightnessByName && !isDarknessByName) {
        return { success: false, message: "Unidade deve ser Neutral, Lightness, Ventus, Void ou Darkness" }
      }

      const diceResult = targets.diceResult || 1
      const currentDp = allyUnit.currentDp || allyUnit.dp
      let dpBonus = 0
      let bonusMessage = ""

      if (diceResult >= 1 && diceResult <= 2) {
        dpBonus = 3
        if (effectiveElement === "neutral") {
          // Bonus: Draw 1 card
          if (context.playerField.deck.length > 0) {
            const drawnCard = context.playerField.deck[0]
            context.setPlayerField((prev) => ({
              ...prev,
              hand: [...prev.hand, drawnCard],
              deck: prev.deck.slice(1),
            }))
            bonusMessage = " Bonus Neutral: Comprou 1 carta!"
          }
        }
      } else if (diceResult >= 3 && diceResult <= 4) {
        dpBonus = 4
        if (effectiveElement === "lightness") {
          // Bonus: +2 LP
          context.setPlayerField((prev) => ({ ...prev, life: prev.life + 2 }))
          bonusMessage = " Bonus Lightness: +2 LP!"
        } else if (effectiveElement === "darkness") {
          // Bonus: enemy loses 2 LP
          context.setEnemyField((prev) => ({ ...prev, life: Math.max(0, prev.life - 2) }))
          bonusMessage = " Bonus Darkness: Inimigo -2 LP!"
        }
      } else {
        dpBonus = 5
        if (effectiveElement === "ventus") {
          // Bonus: +3 LP
          context.setPlayerField((prev) => ({ ...prev, life: prev.life + 3 }))
          bonusMessage = " Bonus Ventus: +3 LP!"
        }
      }

      const newDp = currentDp + dpBonus
      context.setPlayerField((prev) => {
        const newUnitZone = [...prev.unitZone]
        if (newUnitZone[allyIndex]) {
          newUnitZone[allyIndex] = { ...newUnitZone[allyIndex]!, currentDp: newDp }
        }
        return { ...prev, unitZone: newUnitZone }
      })

      return { success: true, message: `Dado: ${diceResult}! ${allyUnit.name} +${dpBonus} DP!${bonusMessage}` }
    },
  },

  // ========== TRAP CARDS ==========

  "contra-ataque-surpresa": {
    id: "contra-ataque-surpresa",
    name: "Contra-Ataque Surpresa",
    requiresTargets: false,
    canActivate: () => ({ canActivate: true }),
    resolve: () => ({ success: true, message: "Armadilha ativada: Contra-Ataque Surpresa!" }),
  },
  "escudo-de-mana": {
    id: "escudo-de-mana",
    name: "Escudo de Mana",
    requiresTargets: false,
    canActivate: () => ({ canActivate: true }),
    resolve: () => ({ success: true, message: "Armadilha ativada: Escudo de Mana!" }),
  },
  "portao-da-fortaleza": {
    id: "portao-da-fortaleza",
    name: "Portão da Fortaleza",
    requiresTargets: false,
    canActivate: () => ({ canActivate: true }),
    resolve: () => ({ success: true, message: "Armadilha ativada: Portão da Fortaleza!" }),
  },
  "brincadeira-de-mau-gosto": {
    id: "brincadeira-de-mau-gosto",
    name: "Brincadeira de Mau Gosto",
    requiresTargets: false,
    canActivate: () => ({ canActivate: true }),
    resolve: () => ({ success: true, message: "Armadilha ativada: Brincadeira de Mau Gosto!" }),
  },

  // ========== NEW ACTION FUNCTION CARDS ==========

  "investida-coordenada": {
    id: "investida-coordenada",
    name: "Investida Coordenada",
    requiresTargets: true,
    targetConfig: {
      enemyUnits: 1,
    },
    canActivate: (context) => {
      // Check if player has 2+ units of the same brotherhood
      const units = context.playerField.unitZone.filter((u) => u !== null) as FieldCard[]

      // Brotherhood check functions
      const brotherhoods = [
        // Avalon: Arthur, Morgana, Galahad, Vivian, Merlin, Mordred, Cavaleiro Verde, Caveiro Afogado
        (name: string) => name.includes("arthur") || name.includes("morgana") || name.includes("galahad") || name.includes("vivian") || name.includes("merlin") || name.includes("mordred") || name.includes("cavaleiro verde") || name.includes("caveiro afogado"),
        // The Great Order: Fehnon, Morgana, Calem
        (name: string) => name.includes("fehnon") || name.includes("morgana") || name.includes("calem"),
        // Scandinavian Angels
        (name: string) => name.includes("scandinavian angel"),
        // Tormenta Prominence: Jaden
        (name: string) => name.includes("jaden"),
      ]

      const hasBrotherhood = brotherhoods.some((checkFn) => {
        const count = units.filter((u) => checkFn(u.name.toLowerCase())).length
        return count >= 2
      })

      if (!hasBrotherhood) {
        return { canActivate: false, reason: "Você precisa ter 2 ou mais Unidades da mesma Irmandade em campo" }
      }

      const hasEnemyUnits = context.enemyField.unitZone.some((u) => u !== null)
      if (!hasEnemyUnits) {
        return { canActivate: false, reason: "O oponente não possui unidades no campo" }
      }

      return { canActivate: true }
    },
    resolve: (context, targets) => {
      if (!targets?.enemyUnitIndices?.length) {
        return { success: false, message: "Selecione uma unidade inimiga" }
      }

      const enemyIndex = targets.enemyUnitIndices[0]
      const enemyUnit = context.enemyField.unitZone[enemyIndex]

      if (!enemyUnit) {
        return { success: false, message: "Unidade inimiga não encontrada" }
      }

      const currentDp = enemyUnit.currentDp || enemyUnit.dp
      const newDp = Math.max(0, currentDp - 2)

      context.setEnemyField((prev) => {
        const newUnitZone = [...prev.unitZone]
        const newGraveyard = [...prev.graveyard]
        if (newDp <= 0) {
          if (newUnitZone[enemyIndex]) {
            newGraveyard.push(newUnitZone[enemyIndex]!)
          }
          newUnitZone[enemyIndex] = null
        } else if (newUnitZone[enemyIndex]) {
          newUnitZone[enemyIndex] = {
            ...newUnitZone[enemyIndex]!,
            currentDp: newDp,
          }
        }
        return { ...prev, unitZone: newUnitZone, graveyard: newGraveyard }
      })

      if (newDp <= 0) {
        return { success: true, message: `Investida Coordenada! ${enemyUnit.name} foi destruída!` }
      }
      return { success: true, message: `Investida Coordenada! ${enemyUnit.name} perdeu 2 DP! (${currentDp} -> ${newDp})` }
    },
  },

  "lacos-da-ordem": {
    id: "lacos-da-ordem",
    name: "Laços da Ordem",
    requiresTargets: false,
    canActivate: (context) => {
      // Check if player has 2+ Great Order units (Fehnon, Morgana, Calem)
      const greatOrderNames = ["fehnon", "morgana", "calem"]
      const greatOrderCount = context.playerField.unitZone.filter((u) => {
        if (u === null) return false
        const name = u.name.toLowerCase()
        return greatOrderNames.some((n) => name.includes(n))
      }).length

      if (greatOrderCount < 2) {
        return { canActivate: false, reason: "Você precisa ter 2 ou mais Unidades de The Great Order (Fehnon, Morgana ou Calem) em campo" }
      }

      return { canActivate: true }
    },
    resolve: (context) => {
      const greatOrderNames = ["fehnon", "morgana", "calem"]

      // Check for trio (all 3)
      const hasFehnon = context.playerField.unitZone.some((u) => u !== null && u.name.toLowerCase().includes("fehnon"))
      const hasMorgana = context.playerField.unitZone.some((u) => u !== null && u.name.toLowerCase().includes("morgana"))
      const hasCalem = context.playerField.unitZone.some((u) => u !== null && u.name.toLowerCase().includes("calem"))
      const hasTrio = hasFehnon && hasMorgana && hasCalem

      // Base effect: recover an Action Function from graveyard
      const actionCards = context.playerField.graveyard.filter((c) => c.type === "action")
      let recoveredCard: typeof actionCards[0] | null = null

      if (actionCards.length > 0) {
        recoveredCard = actionCards[0]
        context.setPlayerField((prev) => {
          const graveyardCopy = [...prev.graveyard]
          const cardIndex = graveyardCopy.findIndex((c) => c.id === recoveredCard!.id)
          if (cardIndex !== -1) {
            graveyardCopy.splice(cardIndex, 1)
          }
          return {
            ...prev,
            hand: [...prev.hand, recoveredCard!],
            graveyard: graveyardCopy,
          }
        })
      }

      let message = recoveredCard
        ? `Recuperou "${recoveredCard.name}" do Cemitério!`
        : "Nenhuma Action Function no Cemitério para recuperar."

      // Trio bonus: draw a card, if it's a Function type, +2DP to a unit
      if (hasTrio && context.playerField.deck.length > 0) {
        const drawnCard = context.playerField.deck[0]
        const isFunction = drawnCard.type === "action" || drawnCard.type === "magic" || drawnCard.type === "trap"

        if (isFunction) {
          // Draw the card and give +2DP to the first unit on field
          const firstUnitIndex = context.playerField.unitZone.findIndex((u) => u !== null)

          context.setPlayerField((prev) => {
            const newUnitZone = [...prev.unitZone]
            if (firstUnitIndex !== -1 && newUnitZone[firstUnitIndex]) {
              const unit = newUnitZone[firstUnitIndex]!
              newUnitZone[firstUnitIndex] = {
                ...unit,
                currentDp: (unit.currentDp || unit.dp) + 2,
              }
            }
            return {
              ...prev,
              hand: [...prev.hand, drawnCard],
              deck: prev.deck.slice(1),
              unitZone: newUnitZone,
            }
          })

          const unitName = firstUnitIndex !== -1 && context.playerField.unitZone[firstUnitIndex]
            ? context.playerField.unitZone[firstUnitIndex]!.name
            : "unidade"
          message += ` Trio completo! Comprou "${drawnCard.name}" (Função) e ${unitName} ganhou +2DP!`
        } else {
          context.setPlayerField((prev) => ({
            ...prev,
            hand: [...prev.hand, drawnCard],
            deck: prev.deck.slice(1),
          }))
          message += ` Trio completo! Comprou "${drawnCard.name}" (não é Função, sem bônus de DP).`
        }
      }

      return { success: true, message }
    },
  },

  "estrategia-real": {
    id: "estrategia-real",
    name: "Estratégia Real",
    requiresTargets: false,
    canActivate: (context) => {
      if (context.playerField.deck.length === 0) {
        return { canActivate: false, reason: "Seu deck está vazio" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      // Check if player has Rei Arthur on field
      const hasArthur = context.playerField.unitZone.some((u) =>
        u !== null && u.name === "Rei Arthur"
      )

      const drawCount = hasArthur ? 2 : 1
      const actualDraw = Math.min(drawCount, context.playerField.deck.length)
      const drawnCards = context.playerField.deck.slice(0, actualDraw)

      context.setPlayerField((prev) => ({
        ...prev,
        hand: [...prev.hand, ...drawnCards],
        deck: prev.deck.slice(actualDraw),
      }))

      if (hasArthur) {
        return { success: true, message: `Estratégia Real! Rei Arthur em campo: comprou ${actualDraw} cartas!` }
      }
      return { success: true, message: `Estratégia Real! Comprou 1 carta.` }
    },
  },

  "ventos-de-camelot": {
    id: "ventos-de-camelot",
    name: "Ventos de Camelot",
    requiresTargets: true,
    targetConfig: {
      allyUnits: 1,
    },
    canActivate: (context) => {
      // Check if player has a Ventus or Haos (Lightness) unit on field
      const hasValidUnit = context.playerField.unitZone.some((u) => {
        if (u === null) return false
        const el = u.element?.toLowerCase() || ""
        return el === "ventus" || el === "haos" || el === "lightness"
      })

      if (!hasValidUnit) {
        return { canActivate: false, reason: "Você precisa ter uma Unidade Ventus ou Lightness em campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      if (!targets?.allyUnitIndices?.length) {
        return { success: false, message: "Selecione uma Unidade Ventus ou Lightness sua" }
      }

      const allyIndex = targets.allyUnitIndices[0]
      const allyUnit = context.playerField.unitZone[allyIndex]

      if (!allyUnit) {
        return { success: false, message: "Unidade não encontrada" }
      }

      const el = allyUnit.element?.toLowerCase() || ""
      if (el !== "ventus" && el !== "haos" && el !== "lightness") {
        return { success: false, message: "Selecione uma Unidade Ventus ou Lightness" }
      }

      // Allow the unit to attack twice (reset hasAttacked and canAttack)
      context.setPlayerField((prev) => {
        const newUnitZone = [...prev.unitZone]
        if (newUnitZone[allyIndex]) {
          newUnitZone[allyIndex] = {
            ...newUnitZone[allyIndex]!,
            canAttack: true,
            hasAttacked: false,
          }
        }
        return { ...prev, unitZone: newUnitZone }
      })

      return { success: true, message: `Ventos de Camelot! ${allyUnit.name} pode atacar duas vezes nesta fase de batalha! Magic Functions bloqueadas neste turno.` }
    },
  },

  "troca-de-guarda": {
    id: "troca-de-guarda",
    name: "Troca de Guarda",
    requiresTargets: true,
    targetConfig: { allyUnits: 1 },
    canActivate: (context) => {
      const hasDarknessUnit = context.playerField.unitZone.some((u) =>
        u !== null && u.element?.toLowerCase() === "darkus"
      )
      if (!hasDarknessUnit) {
        return { canActivate: false, reason: "Você precisa ter uma Unidade do Elemento Darkus em campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      if (!targets?.allyUnitIndices?.length) {
        return { success: false, message: "Selecione uma Unidade Darkus sua" }
      }
      const allyIndex = targets.allyUnitIndices[0]
      const allyUnit = context.playerField.unitZone[allyIndex]
      if (!allyUnit) return { success: false, message: "Unidade não encontrada" }
      if (allyUnit.element?.toLowerCase() !== "darkus") {
        return { success: false, message: "A unidade selecionada deve ser do Elemento Darkus" }
      }
      context.setPlayerField((prev) => {
        const newUnitZone = [...prev.unitZone]
        const unitToReturn = newUnitZone[allyIndex]
        if (!unitToReturn) return prev
        newUnitZone[allyIndex] = null
        return { ...prev, unitZone: newUnitZone, hand: [...prev.hand, unitToReturn] }
      })
      return { success: true, message: `Troca de Guarda! ${allyUnit.name} retornou para sua mão.` }
    },
  },

  "chamado-da-tavola": {
    id: "chamado-da-tavola",
    name: "Chamado da Távola",
    requiresTargets: false,
    canActivate: (context) => {
      const hasTroop = context.playerField.deck.some((c) => c.type === "troops")
      if (!hasTroop) {
        return { canActivate: false, reason: "Não há Unidades de Tropa no seu deck" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      const troops = context.playerField.deck.filter((c) => c.type === "troops")
      if (troops.length === 0) {
        return { success: false, message: "Nenhuma Unidade de Tropa encontrada no deck" }
      }
      // Pick the first troop found (deck is already shuffled)
      const chosen = troops[0]
      context.setPlayerField((prev) => {
        // Remove chosen card from deck and shuffle the rest
        const newDeck = prev.deck.filter((c) => c !== chosen)
        const shuffled = [...newDeck].sort(() => Math.random() - 0.5)
        return {
          ...prev,
          hand: [...prev.hand, chosen],
          deck: shuffled,
        }
      })
      return { success: true, message: `Chamado da Távola! ${chosen.name} adicionada à mão. Deck embaralhado.` }
    },
  },

  "dados-da-calamidade": {
    id: "dados-da-calamidade",
    name: "Dados da Calamidade",
    requiresTargets: true,
    requiresDice: true,
    targetConfig: { allyUnits: 1 },
    canActivate: (context) => {
      const hasAllyUnits = context.playerField.unitZone.some((u) => u !== null)
      if (!hasAllyUnits) return { canActivate: false, reason: "Você precisa ter uma unidade em campo" }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      if (!targets?.allyUnitIndices?.length) return { success: false, message: "Selecione uma unidade sua" }
      const allyIndex = targets.allyUnitIndices[0]
      const allyUnit = context.playerField.unitZone[allyIndex]
      if (!allyUnit) return { success: false, message: "Unidade não encontrada" }
      const diceResult = targets.diceResult || 1
      const currentDp = (allyUnit as any).currentDp || allyUnit.dp
      if (diceResult <= 2) {
        const newDp = Math.max(0, currentDp - 5)
        const isDestroyed = newDp <= 0
        context.setPlayerField((prev) => {
          const newUnitZone = [...prev.unitZone]
          if (isDestroyed) {
            const dead = newUnitZone[allyIndex]; newUnitZone[allyIndex] = null
            return { ...prev, unitZone: newUnitZone as any, graveyard: dead ? [...prev.graveyard, dead] : prev.graveyard }
          }
          newUnitZone[allyIndex] = { ...newUnitZone[allyIndex]!, currentDp: newDp } as any
          return { ...prev, unitZone: newUnitZone as any }
        })
        if (isDestroyed) return { success: true, message: `Dado: ${diceResult}! Calamidade! ${allyUnit.name} destruída!` }
        return { success: true, message: `Dado: ${diceResult}! Calamidade! ${allyUnit.name} −5DP (${currentDp}→${newDp})` }
      }
      if (diceResult <= 4) return { success: true, message: `Dado: ${diceResult}! Nada acontece.` }
      const newDp = currentDp + 8
      context.setPlayerField((prev) => {
        const newUnitZone = [...prev.unitZone]
        if (newUnitZone[allyIndex]) newUnitZone[allyIndex] = { ...newUnitZone[allyIndex]!, currentDp: newDp, calamidadeDebuffTurn: (context.playerField as any).turnNumber + 2 } as any
        return { ...prev, unitZone: newUnitZone as any }
      })
      return { success: true, message: `Dado: ${diceResult}! ${allyUnit.name} +8DP! (−5DP em 2 turnos)` }
    },
  },

  "flecha-de-balista": {
    id: "flecha-de-balista",
    name: "Flecha de Balista",
    requiresTargets: true,
    targetConfig: { enemyUnits: 1 },
    canActivate: (context) => {
      const hasEnemyUnits = context.enemyField.unitZone.some((u) => u !== null)
      if (!hasEnemyUnits) {
        return { canActivate: false, reason: "O oponente não tem Unidades no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context, targets) => {
      if (!targets?.enemyUnitIndices?.length) {
        return { success: false, message: "Selecione uma Unidade inimiga" }
      }
      const enemyIndex = targets.enemyUnitIndices[0]
      const enemyUnit = context.enemyField.unitZone[enemyIndex]
      if (!enemyUnit) return { success: false, message: "Unidade não encontrada" }

      const currentDp = enemyUnit.currentDp || enemyUnit.dp
      const newDp = Math.max(0, currentDp - 2)
      const isDestroyed = newDp <= 0

      context.setEnemyField((prev) => {
        const newUnitZone = [...prev.unitZone]
        const newGraveyard = [...prev.graveyard]
        if (isDestroyed) {
          newGraveyard.push(enemyUnit)
          newUnitZone[enemyIndex] = null
        } else {
          newUnitZone[enemyIndex] = { ...enemyUnit, currentDp: newDp }
        }
        return { ...prev, unitZone: newUnitZone as (FieldCard | null)[], graveyard: newGraveyard }
      })

      if (isDestroyed) {
        return { success: true, message: `Flecha de Balista! ${enemyUnit.name} destruída! (ignora Traps)` }
      }
      return { success: true, message: `Flecha de Balista! ${enemyUnit.name} -2DP! (${currentDp} → ${newDp}) (ignora Traps)` }
    },
  },

  "pedra-de-afiar": {
    id: "pedra-de-afiar",
    name: "Pedra de Afiar",
    requiresTargets: false,
    canActivate: (context) => {
      const hasMainUnit = context.playerField.unitZone.some((u) =>
        u !== null && (u.type === "unit" || u.type === "ultimateElemental" || u.type === "ultimateGuardian")
      )
      if (!hasMainUnit) {
        return { canActivate: false, reason: "Você precisa ter uma Unidade Principal no campo" }
      }
      return { canActivate: true }
    },
    resolve: (context) => {
      const hasUltimateGear = context.playerField.ultimateZone !== null

      if (hasUltimateGear) {
        // Already has UG equipped: deal -1DP direct to enemy LP
        context.setEnemyField((prev) => ({ ...prev, life: Math.max(0, prev.life - 1) }))
        return { success: true, message: `Pedra de Afiar: Ultimate Gear já equipada! -1DP direto aos LP do oponente!` }
      }

      // No UG: signal to open deck search modal - return special flag
      // The actual search+add happens in the placeCard handler via deckSearchModal
      return { success: true, message: "PEDRA_AFIAR_SEARCH" }
    },
  },
}

// Helper function to extract base card ID (removes deck timestamp suffix)
const getBaseCardId = (cardId: string): string => {
  // Card IDs in deck are formatted as: "original-id-deck-timestamp"
  // We need to extract just "original-id"
  const deckSuffixIndex = cardId.lastIndexOf("-deck-")
  if (deckSuffixIndex !== -1) {
    return cardId.substring(0, deckSuffixIndex)
  }
  return cardId
}

// Helper function to get effect for a card - also checks by card name
const getFunctionCardEffect = (card: { id: string; name?: string }): FunctionCardEffect | null => {
  // First try by base ID
  const baseId = getBaseCardId(card.id)
  if (FUNCTION_CARD_EFFECTS[baseId]) {
    return FUNCTION_CARD_EFFECTS[baseId]
  }

  // Fallback: try to match by card name
  const effectByName = Object.values(FUNCTION_CARD_EFFECTS).find(
    (effect) => effect.name === card.name
  )
  return effectByName || null
}

// Helper to check if a Function card can be activated
const canActivateFunctionCard = (cardId: string, context: EffectContext): { canActivate: boolean; reason?: string } => {
  const effect = getFunctionCardEffect({ id: cardId })
  if (!effect) {
    return { canActivate: true } // Unknown cards can be placed normally
  }
  return effect.canActivate(context)
}

// Function to get playmat for a deck
// REMOVED: const getPlaymatForDeck = (deck: DeckWithImages): { image: string } | null => {
//   if (!deck.playmatImage) return null
//   return { image: deck.playmatImage }
// }

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
    case "neutral":
      return ["#f5f5f5", "#e5e5e5", "#d5d5d5", "#c5c5c5", "#b5b5b5"]
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

// ─── DiceCanvas3D ─────────────────────────────────────────────────────────────
// CSS preserve-3d dice. rig handles scale/translateY, cube handles rotateX/Y.
// Transforms set via rAF JS — no @keyframes on preserve-3d elements (would flatten).
interface DiceCanvas3DProps { result: number | null; cardName: string }

const DICE_PIPS: Record<number,[number,number][]> = {
  1:[[50,50]],
  2:[[25,25],[75,75]],
  3:[[22,22],[50,50],[78,78]],
  4:[[25,25],[25,75],[75,25],[75,75]],
  5:[[25,25],[25,75],[50,50],[75,25],[75,75]],
  6:[[22,26],[50,26],[78,26],[22,74],[50,74],[78,74]],
}
const DICE_FACE_NUMS = [1,6,2,5,3,4] // front,back,right,left,top,bot
const DICE_SETTLE: Record<number,{rx:number,ry:number}> = {
  1:{rx:0,  ry:0  }, 2:{rx:0,  ry:-90},
  3:{rx:-90,ry:0  }, 4:{rx:90, ry:0  },
  5:{rx:0,  ry:90 }, 6:{rx:0,  ry:180},
}

function DiceCanvas3D({ result, onSettled }: DiceCanvas3DProps & { onSettled?: ()=>void }) {
  const rigRef  = useRef<HTMLDivElement>(null)
  const cubeRef = useRef<HTMLDivElement>(null)
  const rollRef = useRef<((n:number)=>void)|null>(null)
  const rafRef  = useRef<number>(0)

  useEffect(()=>{
    const rig  = rigRef.current
    const cube = cubeRef.current
    if(!rig||!cube) return

    const lerp  = (a:number,b:number,t:number)=>a+(b-a)*t

    // Live rotation state
    let rx = 0, ry = 0

    // Start spinning immediately at full speed (no throw, no fade-in)
    const FAST_X = 8   // deg/frame
    const FAST_Y = 11  // deg/frame

    function idleFrame(){
      rafRef.current = requestAnimationFrame(idleFrame)
      rx += FAST_X
      ry += FAST_Y
      cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`
    }
    rafRef.current = requestAnimationFrame(idleFrame)

    function doRoll(n:number){
      cancelAnimationFrame(rafRef.current)

      const target = DICE_SETTLE[n]
      // Target: current position + many extra turns + face angle
      const extraX  = 720 + Math.ceil(Math.random()*2)*360
      const extraY  = 1080+ Math.ceil(Math.random()*2)*360
      const finalRX = rx + (Math.random()>.5 ? extraX : -extraX) + (target.rx - ((rx % 360)+360)%360)
      const finalRY = ry + (Math.random()>.5 ? extraY : -extraY) + (target.ry - ((ry % 360)+360)%360)

      // ── PHASE 1: DECELERATE  1800ms ────────────────────────────────
      // Dice is already spinning; speed goes from FAST → 0, steering to face.
      const DECEL_MS = 1800
      const fromRX = rx, fromRY = ry
      let d0: number|null = null

      function decelFrame(ts:number){
        if(!d0) d0=ts
        const p = Math.min((ts-d0)/DECEL_MS, 1)

        if(p < 0.65){
          // Decelerate: cubic ease-out on speed multiplier
          const spd = Math.pow(1 - p/0.65, 2)
          rx += FAST_X * spd
          ry += FAST_Y * spd
        } else {
          // Steer firmly toward final angle
          const t2 = (p - 0.65) / 0.35
          rx = lerp(rx, finalRX, t2 * 0.10)
          ry = lerp(ry, finalRY, t2 * 0.10)
        }

        cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`
        if(p < 1){ rafRef.current=requestAnimationFrame(decelFrame); return }

        // ── PHASE 2: SETTLE  spring 360ms ──────────────────────────
        const snapRX  = Math.round(finalRX/360)*360 + target.rx
        const snapRY  = Math.round(finalRY/360)*360 + target.ry
        const fRX = rx, fRY = ry
        const SETTLE = 360; let ss0:number|null=null

        // Signal result as soon as dice starts settling (player can read it)
        onSettled?.()

        function settleFrame(ts:number){
          if(!ss0) ss0=ts
          const sp = Math.min((ts-ss0)/SETTLE, 1)
          const spring = sp===1?1:1-Math.pow(2,-10*sp)*Math.cos((sp*10-.75)*2*Math.PI/3)
          rx = lerp(fRX, snapRX, spring)
          ry = lerp(fRY, snapRY, spring)
          cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`
          if(sp<1){ rafRef.current=requestAnimationFrame(settleFrame); return }
          rx=snapRX; ry=snapRY
          cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`

          // ── PHASE 3: BOUNCE  800ms ──────────────────────────────
          const BOUNCE=800; let bt0:number|null=null
          function bounceFrame(ts:number){
            if(!bt0) bt0=ts
            const bp=Math.min((ts-bt0)/BOUNCE,1)
            let ty=0
            if(bp<.22)      ty=lerp(0,-28,bp/.22)
            else if(bp<.44) ty=lerp(-28,0,(bp-.22)/.22)
            else if(bp<.60) ty=lerp(0,-12,(bp-.44)/.16)
            else if(bp<.76) ty=lerp(-12,0,(bp-.60)/.16)
            else if(bp<.88) ty=lerp(0,-5,(bp-.76)/.12)
            else             ty=lerp(-5,0,(bp-.88)/.12)
            rig.style.transform=`translateY(${ty}px)`
            if(bp<1){ rafRef.current=requestAnimationFrame(bounceFrame); return }
            rig.style.transform='translateY(0px)'
          }
          rafRef.current=requestAnimationFrame(bounceFrame)
        }
        rafRef.current=requestAnimationFrame(settleFrame)
      }
      rafRef.current=requestAnimationFrame(decelFrame)
    }

    rollRef.current=doRoll
    if(result!==null) doRoll(result)
    return()=>cancelAnimationFrame(rafRef.current)
  },[])

  useEffect(()=>{
    if(result!==null&&rollRef.current) rollRef.current(result)
  },[result])

  const faceClasses = ['front','back','right','left','top','bot']

  return (
    <>
      <style>{`
        .dc-scene{perspective:600px;perspective-origin:50% 42%;width:160px;height:160px;display:flex;align-items:center;justify-content:center}
        .dc-rig{position:relative;transform-style:preserve-3d}
        .dc-cube{width:110px;height:110px;transform-style:preserve-3d;position:relative}
        .dc-face{position:absolute;width:110px;height:110px;border-radius:14px;border:2px solid #c8c8c8;overflow:hidden;backface-visibility:visible}
        .dc-face-front{transform:translateZ(55px)}
        .dc-face-back {transform:rotateY(180deg) translateZ(55px)}
        .dc-face-right{transform:rotateY(90deg) translateZ(55px)}
        .dc-face-left {transform:rotateY(-90deg) translateZ(55px)}
        .dc-face-top  {transform:rotateX(90deg) translateZ(55px)}
        .dc-face-bot  {transform:rotateX(-90deg) translateZ(55px)}
        .dc-fb   {position:absolute;inset:0;background:linear-gradient(145deg,#ffffff 0%,#e4e4e4 100%)}
        .dc-shine{position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.75) 0%,transparent 52%)}
        .dc-dot  {position:absolute;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 36% 32%,#3a3a3a,#000);box-shadow:0 1px 4px rgba(0,0,0,.55),inset 0 1px 1px rgba(255,255,255,.08);transform:translate(-50%,-50%)}
      `}</style>
      <div className="dc-scene">
        <div ref={rigRef} className="dc-rig">
          <div ref={cubeRef} className="dc-cube">
            {DICE_FACE_NUMS.map((faceNum,fi)=>(
              <div key={fi} className={`dc-face dc-face-${faceClasses[fi]}`}>
                <div className="dc-fb"/>
                <div className="dc-shine"/>
                {DICE_PIPS[faceNum].map(([top,left],pi)=>(
                  <div key={pi} className="dc-dot" style={{top:`${top}%`,left:`${left}%`}}/>
                ))}
                <span style={{position:'absolute',top:5,left:8,fontSize:9,fontWeight:700,fontFamily:'monospace',color:'rgba(0,0,0,.12)',pointerEvents:'none'}}>{faceNum}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
// ──────────────────────────────────────────────────────────────────────────────
// ─── StarfieldCanvas ───────────────────────────────────────────────────────────
// Deep-space background: nebulae + field stars in offscreen canvas; 6 galaxies
// each on own canvas with 3D tilt (scaleY oscillates) + precession (scaleX);
// Saturn with scrolling bands (axial rotation) + rings; Uranus bands;
// dust particles, cross-sparkles, fast/coloured shooting stars.

function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")!
    let W = 0, H = 0

    /* ── Static offscreen: nebulae + field stars ── */
    const off = document.createElement("canvas")
    const oc  = off.getContext("2d")!

    function buildOff() {
      const OW=Math.round(W*2.2), OH=Math.round(H*2.2)
      off.width=OW; off.height=OH

      // ── Deep space base: NOT pure black — subtle dark navy/indigo tint
      const baseBg = oc.createRadialGradient(OW*.45,OH*.40,0, OW*.45,OH*.40, OW*.85)
      baseBg.addColorStop(0,  "#07041a")
      baseBg.addColorStop(.35,"#050314")
      baseBg.addColorStop(.70,"#03020e")
      baseBg.addColorStop(1,  "#020108")
      oc.fillStyle=baseBg; oc.fillRect(0,0,OW,OH)

      // ── Helper: soft elliptical nebula blob ──
      function nebBlob(cx:number,cy:number,rx:number,ry:number,rot:number,col:string,alpha0:number,alpha1:number){
        oc.save()
        oc.translate(cx,cy); oc.rotate(rot); oc.scale(1,ry/rx)
        const g=oc.createRadialGradient(0,0,0,0,0,rx)
        g.addColorStop(0,  col.replace(/[\d.]+\)$/,String(alpha0)+")"))
        g.addColorStop(.45,col.replace(/[\d.]+\)$/,String(alpha1)+")"))
        g.addColorStop(.75,col.replace(/[\d.]+\)$/,"0.02)"))
        g.addColorStop(1,  "rgba(0,0,0,0)")
        oc.beginPath(); oc.arc(0,0,rx,0,Math.PI*2); oc.fillStyle=g; oc.fill()
        oc.restore()
      }

      // ── LAYER 1: Large deep colour washes (whole scene tonality) ──
      nebBlob(OW*.38,OH*.42, OW*.55,OH*.40,  .12, "rgba(55,15,130,1)", .14,.07)  // deep violet
      nebBlob(OW*.72,OH*.30, OW*.48,OH*.38, -.18, "rgba(12,28,120,1)", .12,.06)  // deep blue
      nebBlob(OW*.18,OH*.65, OW*.42,OH*.35,  .22, "rgba(80,8,110,1)",  .11,.05)  // deep purple
      nebBlob(OW*.85,OH*.72, OW*.38,OH*.30, -.08, "rgba(8,45,100,1)",  .10,.04)  // deep navy
      nebBlob(OW*.50,OH*.15, OW*.40,OH*.28,  .05, "rgba(18,60,110,1)", .09,.04)  // top blue

      // ── LAYER 2: Mid nebulae — vivid clouds ──
      // Rich magenta/purple cloud — left-centre
      nebBlob(OW*.28,OH*.38, OW*.28,OH*.18,  .30, "rgba(160,40,220,1)", .16,.09)
      nebBlob(OW*.32,OH*.40, OW*.16,OH*.12,  .18, "rgba(200,80,255,1)", .22,.12)
      // Cyan/teal cloud — right
      nebBlob(OW*.76,OH*.22, OW*.24,OH*.16, -.22, "rgba(20,160,200,1)", .18,.10)
      nebBlob(OW*.80,OH*.25, OW*.14,OH*.10, -.15, "rgba(40,200,230,1)", .22,.12)
      // Gold/amber warm cloud — bottom centre
      nebBlob(OW*.50,OH*.78, OW*.30,OH*.18,  .08, "rgba(180,100,20,1)", .14,.07)
      nebBlob(OW*.48,OH*.80, OW*.18,OH*.12, -.05, "rgba(220,140,40,1)", .18,.09)
      // Pink/rose cloud — top right
      nebBlob(OW*.82,OH*.12, OW*.22,OH*.14,  .40, "rgba(220,50,150,1)", .15,.08)
      nebBlob(OW*.85,OH*.10, OW*.12,OH*.09,  .35, "rgba(255,100,180,1)",.20,.11)
      // Blue-violet cloud — bottom left
      nebBlob(OW*.12,OH*.80, OW*.24,OH*.16, -.30, "rgba(60,30,200,1)",  .15,.08)
      nebBlob(OW*.10,OH*.82, OW*.14,OH*.10, -.22, "rgba(100,60,255,1)", .20,.10)

      // ── LAYER 3: Bright emission cores (HII regions) ──
      nebBlob(OW*.30,OH*.38, OW*.06,OH*.04, .18, "rgba(255,150,255,1)", .55,.30)
      nebBlob(OW*.77,OH*.22, OW*.05,OH*.03,-.15, "rgba(100,230,255,1)", .58,.32)
      nebBlob(OW*.50,OH*.79, OW*.05,OH*.03, .08, "rgba(255,180,80,1)",  .52,.28)
      nebBlob(OW*.84,OH*.11, OW*.04,OH*.03, .35, "rgba(255,120,200,1)", .50,.26)
      nebBlob(OW*.11,OH*.81, OW*.04,OH*.03,-.22, "rgba(140,100,255,1)", .50,.26)

      // ── LAYER 4: Milky Way — diagonal luminous streak ──
      ;[
        {cx:.55,cy:.08,rx:.60,ry:.06,rot:.28,a:.08},
        {cx:.50,cy:.30,rx:.65,ry:.07,rot:.26,a:.10},
        {cx:.44,cy:.52,rx:.62,ry:.06,rot:.24,a:.09},
        {cx:.38,cy:.74,rx:.58,ry:.06,rot:.22,a:.07},
      ].forEach(b=>{
        nebBlob(OW*b.cx,OH*b.cy, OW*b.rx,OH*b.ry, b.rot, "rgba(180,180,255,1)", b.a, b.a*.5)
        // Brighter inner streak
        nebBlob(OW*b.cx,OH*b.cy, OW*b.rx*.4,OH*b.ry*.5, b.rot, "rgba(220,215,255,1)", b.a*1.5, b.a*.8)
      })

      // ── LAYER 5: Dark dust lanes over bright nebulae ──
      ;[
        [.32,.36,.18,.04, .24,"rgba(2,1,8,.55)"],
        [.78,.20,.16,.03,-.18,"rgba(1,2,6,.50)"],
        [.50,.78,.20,.03, .06,"rgba(2,1,6,.48)"],
        [.84,.10,.14,.03, .38,"rgba(1,1,5,.45)"],
      ].forEach(([px,py,rx,ry,rot,col])=>{
        oc.save(); oc.translate(OW*(px as number),OH*(py as number))
        oc.rotate(rot as number); oc.scale(1,(ry as number)/(rx as number))
        const g=oc.createRadialGradient(0,0,0,0,0,OW*(rx as number))
        g.addColorStop(0,col as string); g.addColorStop(.5,col as string); g.addColorStop(1,"rgba(0,0,0,0)")
        oc.beginPath(); oc.arc(0,0,OW*(rx as number),0,Math.PI*2); oc.fillStyle=g; oc.fill(); oc.restore()
      })

      // ── LAYER 6: Stars ──
      const SC=["#fff","#fff","#fff","#fff","#c8d8ff","#ffeedd","#b8d0ff","#ffd8f0","#d8f8ff","#ffe0e8","#e8ffee"]

      // Base micro-stars — fills all black gaps
      for(let i=0;i<4500;i++){
        oc.globalAlpha=.03+Math.random()*.22
        oc.beginPath(); oc.arc(Math.random()*OW,Math.random()*OH,.06+Math.random()*.40,0,Math.PI*2)
        oc.fillStyle="#ffffff"; oc.fill()
      }
      // Medium coloured stars
      for(let i=0;i<1600;i++){
        oc.globalAlpha=.12+Math.random()*.48
        oc.beginPath(); oc.arc(Math.random()*OW,Math.random()*OH,.18+Math.random()*.95,0,Math.PI*2)
        oc.fillStyle=SC[Math.floor(Math.random()*SC.length)]; oc.fill()
      }
      // Extra density along milky way diagonal
      for(let i=0;i<1200;i++){
        const t=Math.random()
        const mx=OW*(.62-t*.28)+( Math.random()-.5)*OW*.22
        const my=OH*(t*.95+.04)
        oc.globalAlpha=.05+Math.random()*.30
        oc.beginPath(); oc.arc(mx,my,.06+Math.random()*.50,0,Math.PI*2)
        oc.fillStyle=SC[Math.floor(Math.random()*SC.length)]; oc.fill()
      }
      // Bright star points with cross-diffraction spikes
      for(let i=0;i<160;i++){
        const sx=Math.random()*OW, sy=Math.random()*OH
        const sr=0.7+Math.random()*2.0
        const col=SC[Math.floor(Math.random()*SC.length)]
        // Core
        oc.globalAlpha=.65+Math.random()*.35
        oc.beginPath(); oc.arc(sx,sy,sr,0,Math.PI*2); oc.fillStyle=col; oc.fill()
        // Halo
        oc.globalAlpha=.07+Math.random()*.09
        const hg=oc.createRadialGradient(sx,sy,0,sx,sy,sr*5.5)
        hg.addColorStop(0,col); hg.addColorStop(.35,"rgba(255,255,255,0.10)"); hg.addColorStop(1,"rgba(0,0,0,0)")
        oc.beginPath(); oc.arc(sx,sy,sr*5.5,0,Math.PI*2); oc.fillStyle=hg; oc.fill()
        // Diffraction spikes (4-pointed cross)
        if(sr>1.4){
          oc.globalAlpha=.18+Math.random()*.18
          oc.strokeStyle=col; oc.lineWidth=.5
          const len=sr*8
          oc.beginPath(); oc.moveTo(sx-len,sy); oc.lineTo(sx+len,sy); oc.stroke()
          oc.beginPath(); oc.moveTo(sx,sy-len); oc.lineTo(sx,sy+len); oc.stroke()
        }
      }
      oc.globalAlpha=1
    }

    /* ── Per-galaxy canvas — arms drawn flat, tilt applied per-frame ── */
    function makeGalaxy(r:number, arms:number,
      col1:string, col2:string, coreCol:string, clusterCol:string, dustCol:string
    ): HTMLCanvasElement {
      const half=Math.ceil(r*3.2), size=half*2
      const gc=document.createElement("canvas"); gc.width=gc.height=size
      const c2=gc.getContext("2d")!

      function rg2(x:number,y:number,rad:number,stops:[number,string][]){
        const g=c2.createRadialGradient(x,y,0,x,y,rad)
        stops.forEach(([t,col])=>g.addColorStop(t,col))
        c2.beginPath(); c2.arc(x,y,rad,0,Math.PI*2); c2.fillStyle=g; c2.fill()
      }
      rg2(half,half,r*3.0,[[0,coreCol+".18)"],[.30,coreCol+".09)"],[.65,coreCol+".03)"],[1,"rgba(0,0,0,0)"]])
      rg2(half,half,r*1.3,[[0,coreCol+".36)"],[.42,coreCol+".14)"],[1,"rgba(0,0,0,0)"]])
      rg2(half,half,r*.38,[[0,"rgba(255,255,255,.80)"],[.28,coreCol+".58)"],[.70,coreCol+".14)"],[1,"rgba(0,0,0,0)"]])

      c2.save(); c2.translate(half,half)

      for(let arm=0;arm<arms;arm++){
        const base=arm*(Math.PI*2/arms)
        for(let i=0;i<420;i++){
          const t=i/420, radius=0.05*r+t*r*2.2
          const angle=base+t*Math.PI*3.9+(Math.random()-.5)*.22
          const sc=(Math.random()-.5)*radius*.22
          const x=Math.cos(angle)*(radius+sc), y=Math.sin(angle)*(radius+sc)
          const bright=Math.pow(1-t,.65), sz=0.2+bright*3.0+Math.random()*.9
          const alpha=(Math.random()>.55?.60+bright*.32:.06+bright*.28)*bright
          c2.globalAlpha=Math.max(0,Math.min(1,alpha))
          c2.beginPath(); c2.arc(x,y,sz,0,Math.PI*2)
          c2.fillStyle=t<.15?"rgba(255,252,240,1)":Math.random()>.42?col1:col2; c2.fill()
        }
        for(let i=0;i<90;i++){
          const t=.04+i/90*.65, radius=t*r*1.9, angle=base+t*Math.PI*3.7-.18
          c2.globalAlpha=.07+t*.05
          c2.beginPath(); c2.arc(Math.cos(angle)*radius,Math.sin(angle)*radius,1.2+t*3.5,0,Math.PI*2)
          c2.fillStyle=dustCol; c2.fill()
        }
      }
      for(let i=0;i<580;i++){
        const a=Math.random()*Math.PI*2, d=Math.pow(Math.random(),2)*r*.62
        c2.globalAlpha=.18+Math.random()*.75
        c2.beginPath(); c2.arc(Math.cos(a)*d,Math.sin(a)*d,.2+Math.random()*1.5,0,Math.PI*2)
        c2.fillStyle=clusterCol; c2.fill()
      }
      for(let i=0;i<300;i++){
        const a=Math.random()*Math.PI*2, d=r*.35+Math.pow(Math.random(),.55)*r*2.0
        c2.globalAlpha=.03+Math.random()*.18
        c2.beginPath(); c2.arc(Math.cos(a)*d,Math.sin(a)*d,.2+Math.random()*.9,0,Math.PI*2)
        c2.fillStyle=clusterCol; c2.fill()
      }
      c2.restore(); c2.globalAlpha=1
      return gc
    }

    type GLayer = {
      cv: HTMLCanvasElement; half: number
      x: number; y: number
      tilt: number
      rotation: number; spinSpeed: number
      precPhase: number; precSpeed: number
    }
    let galaxyLayers: GLayer[] = []

    function buildGalaxies() {
      const defs = [
        // Large purple spiral — centre, tilt=0.50 (viewed ~30° from face), spin slow
        {x:.42,y:.55,r:W*.13, arms:4,tilt:.50,rotation:0,    spinSpeed:.000055,precPhase:0,   precSpeed:.00018,c1:"rgba(195,118,255,1)",c2:"rgba(105,152,255,1)",cc:"rgba(155,75,255,", cl:"#ead4ff",dc:"rgba(18,4,58,1)"},
        // Blue spiral — top-centre, tilt=0.42, slightly faster
        {x:.62,y:.10,r:W*.09, arms:3,tilt:.42,rotation:1.2,  spinSpeed:.000070,precPhase:2.0, precSpeed:.00022,c1:"rgba(75,158,255,1)", c2:"rgba(135,218,255,1)",cc:"rgba(38,115,255,",  cl:"#c6e8ff",dc:"rgba(4,8,50,1)"},
        // Pink — bottom, very flat tilt=0.18 (nearly edge-on), slow
        {x:.32,y:.78,r:W*.072,arms:3,tilt:.18,rotation:2.5,  spinSpeed:.000048,precPhase:4.1, precSpeed:.00025,c1:"rgba(242,108,255,1)",c2:"rgba(198,75,228,1)", cc:"rgba(198,55,218,",  cl:"#ffccff",dc:"rgba(38,4,58,1)"},
        // Teal — top-left, flat tilt=0.22, medium
        {x:.08,y:.12,r:W*.058,arms:2,tilt:.22,rotation:3.8,  spinSpeed:.000062,precPhase:1.5, precSpeed:.00028,c1:"rgba(55,218,228,1)", c2:"rgba(38,158,208,1)", cc:"rgba(18,175,198,",  cl:"#b8f2ff",dc:"rgba(4,18,38,1)"},
        // Indigo small — far-right, tilt=0.45, faster (smaller = spins faster visually)
        {x:.92,y:.68,r:W*.045,arms:2,tilt:.45,rotation:5.0,  spinSpeed:.000085,precPhase:3.3, precSpeed:.00030,c1:"rgba(128,75,255,1)", c2:"rgba(165,98,255,1)", cc:"rgba(88,38,208,",   cl:"#ceb8ff",dc:"rgba(14,4,48,1)"},
        // Rose/violet — left, very flat tilt=0.16, slow
        {x:.04,y:.55,r:W*.10, arms:3,tilt:.16,rotation:0.7,  spinSpeed:.000042,precPhase:5.8, precSpeed:.00020,c1:"rgba(255,105,185,1)",c2:"rgba(185,88,255,1)", cc:"rgba(210,60,195,",  cl:"#ffc8ee",dc:"rgba(45,5,55,1)"},
      ]
      galaxyLayers = defs.map(d => {
        const cv = makeGalaxy(d.r,d.arms,d.c1,d.c2,d.cc,d.cl,d.dc)
        return { cv, half:cv.width/2, x:d.x, y:d.y, tilt:d.tilt, rotation:d.rotation, spinSpeed:d.spinSpeed, precPhase:d.precPhase, precSpeed:d.precSpeed }
      })
    }

    /* ── Saturn: rings fixed, sphere bands scroll horizontally = axial rotation ── */
    function drawSaturn(ts:number) {
      const r=Math.min(W,H)*.082, SX=W*.82, SY=H*.30, TILT=.40
      const bandScroll = ts * .00045

      const RINGS: {ri:number;ro:number;a:number;gap:boolean}[] = [
        {ri:r*1.22,ro:r*1.38,a:.62,gap:false},
        {ri:r*1.38,ro:r*1.50,a:.05,gap:true },
        {ri:r*1.50,ro:r*1.82,a:.72,gap:false},
        {ri:r*1.82,ro:r*2.12,a:.56,gap:false},
        {ri:r*2.10,ro:r*2.42,a:.40,gap:false},
        {ri:r*2.42,ro:r*2.65,a:.24,gap:false},
      ]

      function drawRingHalf(startA:number, endA:number, ccw:boolean) {
        RINGS.forEach(rr=>{
          if(rr.gap){
            ctx.beginPath(); ctx.arc(0,0,rr.ro,startA,endA,ccw); ctx.arc(0,0,rr.ri,endA,startA,!ccw)
            ctx.closePath(); ctx.fillStyle=`rgba(8,5,2,${rr.a})`; ctx.fill(); return
          }
          ctx.beginPath(); ctx.arc(0,0,rr.ro,startA,endA,ccw); ctx.arc(0,0,rr.ri,endA,startA,!ccw)
          ctx.closePath()
          const rg2=ctx.createRadialGradient(0,0,rr.ri,0,0,rr.ro)
          rg2.addColorStop(0,`rgba(222,188,108,${rr.a*.96})`); rg2.addColorStop(.4,`rgba(202,168,90,${rr.a})`)
          rg2.addColorStop(.75,`rgba(178,142,72,${rr.a*.86})`); rg2.addColorStop(1,`rgba(145,115,55,${rr.a*.64})`)
          ctx.fillStyle=rg2; ctx.fill()
          const lg=ctx.createLinearGradient(-rr.ro,0,rr.ro,0)
          lg.addColorStop(0,"rgba(0,0,0,.30)"); lg.addColorStop(.32,"rgba(255,255,255,.07)")
          lg.addColorStop(.68,"rgba(255,255,255,.07)"); lg.addColorStop(1,"rgba(0,0,0,.30)")
          ctx.beginPath(); ctx.arc(0,0,rr.ro,startA,endA,ccw); ctx.arc(0,0,rr.ri,endA,startA,!ccw)
          ctx.closePath(); ctx.fillStyle=lg; ctx.fill()
        })
      }

      ctx.save(); ctx.translate(SX,SY)
      ctx.save(); ctx.scale(1,Math.sin(TILT)); drawRingHalf(Math.PI,Math.PI*2,false); ctx.restore()

      // Sphere — clipped, bands scroll horizontally
      ctx.save(); ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.clip()
      const sphere=ctx.createLinearGradient(0,-r,0,r)
      sphere.addColorStop(0,"#6a4420"); sphere.addColorStop(.10,"#9a6e32"); sphere.addColorStop(.22,"#c8923a")
      sphere.addColorStop(.38,"#e0b252"); sphere.addColorStop(.50,"#f0cc68"); sphere.addColorStop(.62,"#e0b252")
      sphere.addColorStop(.78,"#c8923a"); sphere.addColorStop(.90,"#9a6e32"); sphere.addColorStop(1,"#6a4420")
      ctx.fillStyle=sphere; ctx.fillRect(-r,-r,r*2,r*2)
      ;[
        {y:-.70,h:.07,d:.26,ph:0  },{y:-.52,h:.06,d:.20,ph:.8 },{y:-.33,h:.11,d:.18,ph:1.6},
        {y:-.08,h:.15,d:.16,ph:2.4},{y: .18,h:.10,d:.18,ph:1.2},{y: .38,h:.07,d:.20,ph:.4},
        {y: .52,h:.06,d:.23,ph:2.0},{y: .68,h:.07,d:.26,ph:1.0},
      ].forEach(b=>{
        const yC=b.y*r, hH=b.h*r
        ctx.beginPath(); ctx.moveTo(-r,yC-hH)
        for(let xi=-r;xi<=r;xi+=2){
          const xNorm=(xi+r)/(r*2)
          const sn=(xNorm+bandScroll)%1
          const wave=Math.sin(sn*Math.PI*6+b.ph)*r*.012
          ctx.lineTo(xi,yC-hH+wave)
        }
        ctx.lineTo(r,yC+hH); ctx.lineTo(-r,yC+hH); ctx.closePath()
        ctx.fillStyle=`rgba(45,25,5,${b.d})`; ctx.fill()
      })
      const eq=ctx.createLinearGradient(0,-r*.08,0,r*.08)
      eq.addColorStop(0,"rgba(255,240,180,0)"); eq.addColorStop(.5,"rgba(255,240,180,.07)"); eq.addColorStop(1,"rgba(255,240,180,0)")
      ctx.fillStyle=eq; ctx.fillRect(-r,-r*.08,r*2,r*.16)
      const sp=ctx.createRadialGradient(-r*.32,-r*.36,0,-r*.18,-r*.24,r*.58)
      sp.addColorStop(0,"rgba(255,252,238,.52)"); sp.addColorStop(.38,"rgba(255,248,220,.12)"); sp.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=sp; ctx.fillRect(-r,-r,r*2,r*2)
      const lb=ctx.createRadialGradient(0,0,r*.60,0,0,r)
      lb.addColorStop(0,"rgba(0,0,0,0)"); lb.addColorStop(.78,"rgba(0,0,0,0)"); lb.addColorStop(1,"rgba(0,0,0,.70)")
      ctx.fillStyle=lb; ctx.fillRect(-r,-r,r*2,r*2)
      ctx.restore()

      const at=ctx.createRadialGradient(0,0,r*.82,0,0,r*1.55)
      at.addColorStop(0,"rgba(0,0,0,0)"); at.addColorStop(.80,"rgba(0,0,0,0)")
      at.addColorStop(.92,"rgba(200,155,75,.11)"); at.addColorStop(1,"rgba(0,0,0,0)")
      ctx.beginPath(); ctx.arc(0,0,r*1.55,0,Math.PI*2); ctx.fillStyle=at; ctx.fill()
      ctx.save(); ctx.scale(1,Math.sin(TILT)); drawRingHalf(0,Math.PI,false); ctx.restore()
      ctx.restore()
    }

    /* ── Uranus: sphere bands scroll horizontally ── */
    function drawUranus(ts:number) {
      const r=Math.min(W,H)*.058, UX=W*.18, UY=H*.30
      const bandScroll=ts*.00030

      ctx.save(); ctx.translate(UX,UY)

      ctx.save(); ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.clip()
      const sphere=ctx.createLinearGradient(0,-r,0,r)
      sphere.addColorStop(0,"#1a5560"); sphere.addColorStop(.15,"#1e7a88"); sphere.addColorStop(.32,"#22a0b0")
      sphere.addColorStop(.50,"#28c0d0"); sphere.addColorStop(.68,"#22a0b0"); sphere.addColorStop(.85,"#1e7a88")
      sphere.addColorStop(1,"#1a5560")
      ctx.fillStyle=sphere; ctx.fillRect(-r,-r,r*2,r*2)
      ;[
        {y:-.60,h:.08,d:.07,ph:0  },{y:-.35,h:.06,d:.06,ph:1.4},
        {y:-.10,h:.10,d:.05,ph:2.8},{y: .15,h:.08,d:.06,ph:1.0},
        {y: .40,h:.06,d:.07,ph:2.2},{y: .60,h:.07,d:.07,ph:.7},
      ].forEach(b=>{
        const yC=b.y*r, hH=b.h*r
        ctx.beginPath(); ctx.moveTo(-r,yC-hH)
        for(let xi=-r;xi<=r;xi+=2){
          const xNorm=(xi+r)/(r*2)
          const sn=(xNorm+bandScroll)%1
          const wave=Math.sin(sn*Math.PI*5+b.ph)*r*.007
          ctx.lineTo(xi,yC-hH+wave)
        }
        ctx.lineTo(r,yC+hH); ctx.lineTo(-r,yC+hH); ctx.closePath()
        ctx.fillStyle=`rgba(10,60,70,${b.d})`; ctx.fill()
      })
      const pole=ctx.createRadialGradient(0,-r*.65,0,0,-r*.40,r*.80)
      pole.addColorStop(0,"rgba(15,55,65,.28)"); pole.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=pole; ctx.fillRect(-r,-r,r*2,r*2)
      const sp=ctx.createRadialGradient(-r*.30,-r*.34,0,-r*.16,-r*.22,r*.55)
      sp.addColorStop(0,"rgba(220,250,255,.50)"); sp.addColorStop(.40,"rgba(200,240,248,.12)"); sp.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=sp; ctx.fillRect(-r,-r,r*2,r*2)
      const lb=ctx.createRadialGradient(0,0,r*.58,0,0,r)
      lb.addColorStop(0,"rgba(0,0,0,0)"); lb.addColorStop(.75,"rgba(0,0,0,0)"); lb.addColorStop(1,"rgba(0,0,0,.68)")
      ctx.fillStyle=lb; ctx.fillRect(-r,-r,r*2,r*2)
      ctx.restore()

      const at=ctx.createRadialGradient(0,0,r*.80,0,0,r*1.50)
      at.addColorStop(0,"rgba(0,0,0,0)"); at.addColorStop(.78,"rgba(0,0,0,0)")
      at.addColorStop(.92,"rgba(40,180,200,.11)"); at.addColorStop(1,"rgba(0,0,0,0)")
      ctx.beginPath(); ctx.arc(0,0,r*1.50,0,Math.PI*2); ctx.fillStyle=at; ctx.fill()
      ctx.restore()
    }

    /* ── Runtime particles ── */
    type Dust    = {x:number;y:number;vx:number;vy:number;s:number;a:number;col:string;ph:number;fr:number}
    type Sparkle = {x:number;y:number;s:number;ph:number;fr:number;col:string}
    type Shoot   = {x:number;y:number;vx:number;vy:number;len:number;alpha:number;dec:number;col:string;w:number}
    let dust:Dust[]=[], sparkles:Sparkle[]=[]
    const shoots:Shoot[]=[]

    function initParticles(){
      dust=[]
      for(let i=0;i<85;i++) dust.push({
        x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.08,
        s:.5+Math.random()*3,a:.03+Math.random()*.12,
        col:Math.random()>.5?"rgba(145,68,255,1)":"rgba(68,118,255,1)",
        ph:Math.random()*Math.PI*2,fr:.002+Math.random()*.007,
      })
      sparkles=[]
      const SC=["#fff","#ddc8ff","#c0d8ff","#ffeedd","#b8f2ff","#ffd0f0"]
      for(let i=0;i<38;i++) sparkles.push({
        x:Math.random()*W,y:Math.random()*H,s:.4+Math.random()*2.3,
        ph:Math.random()*Math.PI*2,fr:.4+Math.random()*2.4,col:SC[Math.floor(Math.random()*SC.length)],
      })
    }

    function spawnShoot(fast:boolean){
      const a=(Math.random()>.5?.11:Math.PI-.11)+(Math.random()-.5)*.30
      const spd=fast?18+Math.random()*24:5+Math.random()*9
      const COLS=["rgba(205,158,255,1)","rgba(158,212,255,1)","rgba(255,212,158,1)","rgba(158,255,200,1)"]
      shoots.push({
        x:Math.random()*W,y:Math.random()*H*.48,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd+.8,
        len:fast?135+Math.random()*245:58+Math.random()*112,alpha:.95,
        dec:fast?.012+Math.random()*.012:.020+Math.random()*.014,
        col:fast?"rgba(255,255,255,1)":COLS[Math.floor(Math.random()*COLS.length)],w:fast?2:.9,
      })
    }

    function resize(){
      W=cv.width=window.innerWidth; H=cv.height=window.innerHeight
      buildOff(); buildGalaxies(); initParticles()
    }
    resize()
    window.addEventListener("resize",resize)

    let ox=0, oy=0, shootT=0, raf=0

    function tick(ts:number){
      raf=requestAnimationFrame(tick)
      ox+=.020; oy+=.009; shootT++

      const OW=off.width, OH=off.height
      ctx.fillStyle="#02010a"; ctx.fillRect(0,0,W,H)
      const nx=((-ox*.16)%OW+OW)%OW, ny=((-oy*.11)%OH+OH)%OW
      for(let tx=-OW;tx<=W;tx+=OW)
        for(let ty=-OH;ty<=H;ty+=OH)
          ctx.drawImage(off,nx+tx,ny+ty)

      // Galaxies — annular 3D rotation
      // Order matters: scale Y first (tilt), THEN rotate (spin arms).
      // This keeps the compression axis always vertical so the disk stays straight.
      for(const g of galaxyLayers){
        g.rotation  += g.spinSpeed
        g.precPhase += g.precSpeed
        const scaleY = g.tilt + Math.sin(g.precPhase) * 0.05
        ctx.save()
        ctx.globalAlpha = 0.90
        ctx.translate(g.x*W, g.y*H)
        ctx.scale(1, scaleY)       // compress Y first — disk looks tilted, always upright
        ctx.rotate(g.rotation)     // then spin arms inside the already-flattened space
        ctx.drawImage(g.cv, -g.half, -g.half, g.cv.width, g.cv.height)
        ctx.restore()
      }
      ctx.globalAlpha=1

      const t=ts*.001

      for(const d of dust){
        d.x+=d.vx; d.y+=d.vy
        if(d.x<0)d.x=W; if(d.x>W)d.x=0; if(d.y<0)d.y=H; if(d.y>H)d.y=0
        ctx.globalAlpha=d.a*(.52+.48*Math.sin(t*d.fr*Math.PI*2+d.ph))
        ctx.beginPath(); ctx.arc(d.x,d.y,d.s,0,Math.PI*2); ctx.fillStyle=d.col; ctx.fill()
      }
      ctx.globalAlpha=1

      for(const s of sparkles){
        const p=.20+.80*Math.abs(Math.sin(t*s.fr+s.ph)), r=s.s*(1+p*.72)
        ctx.globalAlpha=p*.92; ctx.strokeStyle=s.col; ctx.lineWidth=.72
        ctx.beginPath(); ctx.moveTo(s.x-r,s.y); ctx.lineTo(s.x+r,s.y)
        ctx.moveTo(s.x,s.y-r); ctx.lineTo(s.x,s.y+r); ctx.stroke()
        const rd=r*.50; ctx.beginPath()
        ctx.moveTo(s.x-rd,s.y-rd); ctx.lineTo(s.x+rd,s.y+rd)
        ctx.moveTo(s.x+rd,s.y-rd); ctx.lineTo(s.x-rd,s.y+rd); ctx.stroke()
        ctx.globalAlpha=p*.86; ctx.beginPath()
        ctx.arc(s.x,s.y,s.s*.40,0,Math.PI*2); ctx.fillStyle=s.col; ctx.fill()
      }
      ctx.globalAlpha=1

      drawSaturn(ts)
      drawUranus(ts)

      if(shootT%80===0)  spawnShoot(true)
      if(shootT%130===0) spawnShoot(true)
      if(shootT%200===0) spawnShoot(false)
      if(shootT%290===0) spawnShoot(false)
      for(let i=shoots.length-1;i>=0;i--){
        const sh=shoots[i]
        const tail=ctx.createLinearGradient(sh.x,sh.y,sh.x-sh.vx/14*sh.len,sh.y-sh.vy/14*sh.len)
        tail.addColorStop(0,sh.col.replace(/[\d.]+\)$/,`${sh.alpha})`))
        tail.addColorStop(.26,sh.col.replace(/[\d.]+\)$/,`${sh.alpha*.38})`))
        tail.addColorStop(1,"rgba(0,0,0,0)")
        ctx.beginPath(); ctx.moveTo(sh.x,sh.y)
        ctx.lineTo(sh.x-sh.vx/14*sh.len,sh.y-sh.vy/14*sh.len)
        ctx.strokeStyle=tail; ctx.lineWidth=sh.w; ctx.stroke()
        sh.x+=sh.vx; sh.y+=sh.vy; sh.alpha-=sh.dec
        if(sh.alpha<=0||sh.x<-300||sh.x>W+300||sh.y>H+120) shoots.splice(i,1)
      }
    }

    raf=requestAnimationFrame(tick)
    return()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",resize) }
  },[])

  return (
    <canvas
      ref={canvasRef}
      style={{position:"absolute",inset:0,width:"100%",height:"100%",zIndex:0,pointerEvents:"none"}}
    />
  )
}

// ─── GameResultScreen ─────────────────────────────────────────────────────────

interface GameResultScreenProps {
  result: "won" | "lost"
  onBack: () => void
}

function GameResultScreen({ result, onBack }: GameResultScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const isWon     = result === "won"

  // Canvas particle system
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener("resize", resize)
    const ctx = canvas.getContext("2d")!

    type P = {
      x:number; y:number; vx:number; vy:number; size:number
      alpha:number; decay:number; color:string; gravity:number
      spin:number; spinV:number; shape:"rect"|"circle"|"star"|"diamond"
    }

    const particles: P[] = []
    const W = () => canvas.width, H = () => canvas.height

    const COLS_WON  = ["#ffd700","#ffe55c","#ffffff","#fbbf24","#86efac","#4ade80","#c084fc","#e879f9","#67e8f9"]
    const COLS_LOST = ["#ef4444","#dc2626","#b91c1c","#f97316","#7f1d1d","#fca5a5","#450a0a","#ff6b6b"]

    function burst(cx: number, cy: number, count: number) {
      const cols = isWon ? COLS_WON : COLS_LOST
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = isWon ? 2 + Math.random() * 9 : 1 + Math.random() * 5
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (isWon ? 4 : 1),
          size: isWon ? 5 + Math.random() * 10 : 3 + Math.random() * 7,
          alpha: 1,
          decay: isWon ? 0.006 + Math.random() * 0.006 : 0.010 + Math.random() * 0.008,
          color: cols[Math.floor(Math.random() * cols.length)],
          gravity: isWon ? 0.15 : 0.08,
          spin: Math.random() * Math.PI * 2,
          spinV: (Math.random() - 0.5) * 0.20,
          shape: isWon
            ? (["rect","circle","star","diamond"] as const)[Math.floor(Math.random()*4)]
            : (["circle","rect"] as const)[Math.floor(Math.random()*2)],
        })
      }
    }

    function drawStar(cx: number, cy: number, r: number, spin: number) {
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a   = spin + (i/10)*Math.PI*2
        const rad = i%2===0 ? r : r*0.38
        i===0 ? ctx.moveTo(cx+Math.cos(a)*rad, cy+Math.sin(a)*rad)
              : ctx.lineTo(cx+Math.cos(a)*rad, cy+Math.sin(a)*rad)
      }
      ctx.closePath()
    }

    function drawDiamond(cx: number, cy: number, r: number, spin: number) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin)
      ctx.beginPath()
      ctx.moveTo(0, -r); ctx.lineTo(r*0.6, 0)
      ctx.lineTo(0, r);  ctx.lineTo(-r*0.6, 0)
      ctx.closePath(); ctx.restore()
    }

    // Initial burst from centre
    burst(window.innerWidth/2, window.innerHeight/2, isWon ? 80 : 50)

    // Side cannons for victory
    if (isWon) {
      setTimeout(() => burst(0, window.innerHeight*0.5, 40), 300)
      setTimeout(() => burst(window.innerWidth, window.innerHeight*0.5, 40), 500)
      setTimeout(() => burst(window.innerWidth/2, 0, 50), 700)
      setTimeout(() => burst(window.innerWidth*0.25, window.innerHeight*0.3, 30), 900)
      setTimeout(() => burst(window.innerWidth*0.75, window.innerHeight*0.3, 30), 1100)
    } else {
      setTimeout(() => burst(window.innerWidth/2, -20, 35), 400)
      setTimeout(() => burst(window.innerWidth*0.3, -20, 25), 700)
      setTimeout(() => burst(window.innerWidth*0.7, -20, 25), 900)
    }

    // Continuous rain
    let frame = 0
    function tick() {
      rafRef.current = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, W(), H())
      frame++

      // Continuous drizzle
      if (frame % (isWon ? 4 : 7) === 0) {
        const cx = Math.random() * W()
        const cy = isWon ? Math.random() * H() * 0.3 : -10
        burst(cx, cy, isWon ? 4 : 2)
      }

      for (let i = particles.length-1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx; p.y += p.vy
        p.vy += p.gravity; p.vx *= 0.98
        p.spin += p.spinV
        p.alpha -= p.decay
        if (p.alpha <= 0 || p.y > H()+40) { particles.splice(i,1); continue }

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle   = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur  = isWon ? 10 : 6

        if (p.shape === "rect") {
          ctx.translate(p.x, p.y); ctx.rotate(p.spin)
          ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2)
        } else if (p.shape === "star") {
          drawStar(p.x, p.y, p.size/2, p.spin)
          ctx.fill()
        } else if (p.shape === "diamond") {
          drawDiamond(p.x, p.y, p.size/2, p.spin)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2)
          ctx.fill()
        }
        ctx.restore()
      }
    }
    tick()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [isWon])

  const col    = isWon ? "#ffd700" : "#ef4444"
  const colDim = isWon ? "rgba(251,191,36,.7)" : "rgba(248,113,113,.7)"

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      overflow:"hidden",
    }}>
      <style>{`
        @keyframes gr-bg  {from{opacity:0}to{opacity:1}}
        @keyframes gr-pop {0%{transform:scale(.2) translateY(-20px);opacity:0;filter:blur(20px)}
                           55%{transform:scale(1.06) translateY(4px);opacity:1;filter:blur(0)}
                           75%{transform:scale(.97) translateY(-2px)}
                           100%{transform:scale(1) translateY(0);opacity:1}}
        @keyframes gr-up  {from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gr-btn {0%{opacity:0;transform:scale(.88) translateY(16px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes gr-glw-w{0%,100%{text-shadow:0 0 40px #ffd700,0 0 80px #ffd70088,0 0 120px #ffd70044}
                             50%{text-shadow:0 0 70px #ffd700,0 0 130px #fff700,0 0 200px #ffd70066}}
        @keyframes gr-glw-l{0%,100%{text-shadow:0 0 40px #ef4444,0 0 80px #ef444466}
                             50%{text-shadow:0 0 70px #ef4444,0 0 130px #dc2626,0 0 180px #ef444444}}
        @keyframes gr-icon {0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-10px) scale(1.06)}}
        @keyframes gr-shine{0%{left:-120%}100%{left:220%}}
        @keyframes gr-ring {0%{transform:scale(0);opacity:.85}100%{transform:scale(4);opacity:0}}
        @keyframes gr-line {from{width:0;opacity:0}to{width:220px;opacity:1}}
        @keyframes gr-pulse{0%,100%{opacity:.6}50%{opacity:1}}
      `}</style>

      {/* Dark bg */}
      <div style={{
        position:"absolute", inset:0,
        background: isWon
          ? "radial-gradient(ellipse at 50% 38%, #1a1200 0%, #0a0800 50%, #000 100%)"
          : "radial-gradient(ellipse at 50% 38%, #1a0000 0%, #080000 50%, #000 100%)",
        animation:"gr-bg 350ms ease-out forwards",
      }}/>

      {/* Ambient glow behind title */}
      <div style={{
        position:"absolute", width:700, height:400, borderRadius:"50%",
        background:`radial-gradient(ellipse, ${isWon?"rgba(251,191,36,.12)":"rgba(239,68,68,.10)"} 0%, transparent 70%)`,
        top:"35%", left:"50%", transform:"translate(-50%,-50%)",
        pointerEvents:"none", animation:"gr-pulse 2.5s ease-in-out 1s infinite",
      }}/>

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1}}/>

      {/* Expanding rings */}
      {[0,180,360].map((delay,i)=>(
        <div key={i} style={{
          position:"absolute", borderRadius:"50%",
          width:160+i*70, height:160+i*70,
          border:`2px solid ${col}44`,
          animation:`gr-ring 1.4s ease-out ${delay}ms both`,
          pointerEvents:"none", zIndex:1,
        }}/>
      ))}

      {/* Main content */}
      <div style={{
        position:"relative", zIndex:2,
        display:"flex", flexDirection:"column",
        alignItems:"center", gap:24, padding:"0 24px",
        textAlign:"center",
      }}>

        {/* Emoji icon */}
        <div style={{
          fontSize:80, lineHeight:1,
          filter:`drop-shadow(0 0 28px ${col})`,
          animation:"gr-pop 750ms cubic-bezier(.34,1.56,.64,1) 80ms both, gr-icon 3s ease-in-out 1.2s infinite",
        }}>
          {isWon ? "🏆" : "💀"}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize:"clamp(56px,13vw,104px)",
          fontWeight:900, letterSpacing:"0.1em",
          textTransform:"uppercase", color:col, margin:0,
          fontFamily:"monospace", position:"relative", overflow:"hidden",
          animation:`gr-pop 650ms cubic-bezier(.34,1.56,.64,1) 180ms both, ${isWon?"gr-glw-w":"gr-glw-l"} 2.2s ease-in-out 900ms infinite`,
        }}>
          {isWon ? "VITÓRIA" : "DERROTA"}
          {/* Shine sweep */}
          <span style={{
            position:"absolute", top:0, left:"-120%",
            width:"55%", height:"100%",
            background:"linear-gradient(90deg,transparent,rgba(255,255,255,.38),transparent)",
            animation:"gr-shine 1.3s ease-in-out 550ms both",
            pointerEvents:"none",
          }}/>
        </h1>

        {/* Horizontal rule */}
        <div style={{
          height:1,
          background:`linear-gradient(to right,transparent,${col},transparent)`,
          animation:"gr-line 600ms ease-out 700ms both",
        }}/>

        {/* Subtitle */}
        <p style={{
          color:colDim, fontSize:16, fontWeight:600,
          letterSpacing:"0.22em", textTransform:"uppercase", margin:0,
          animation:"gr-up 500ms ease-out 750ms both",
        }}>
          {isWon ? "O duelo terminou em sua glória" : "Você caiu em batalha"}
        </p>

        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            marginTop:8, padding:"14px 52px",
            borderRadius:12, fontWeight:700,
            fontSize:15, letterSpacing:"1.5px",
            textTransform:"uppercase", cursor:"pointer",
            border:`2px solid ${col}99`,
            background:`linear-gradient(135deg,${col}22,${col}0a)`,
            color:col, backdropFilter:"blur(10px)",
            animation:"gr-btn 550ms cubic-bezier(.34,1.56,.64,1) 1000ms both",
            transition:"background 180ms, transform 120ms, box-shadow 180ms",
            boxShadow:`0 0 0 0 ${col}44`,
          }}
          onMouseEnter={e=>{
            e.currentTarget.style.background=`linear-gradient(135deg,${col}38,${col}18)`
            e.currentTarget.style.boxShadow=`0 0 24px 4px ${col}33`
            e.currentTarget.style.transform="scale(1.04)"
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.background=`linear-gradient(135deg,${col}22,${col}0a)`
            e.currentTarget.style.boxShadow=`0 0 0 0 ${col}44`
            e.currentTarget.style.transform="scale(1)"
          }}
        >
          Voltar ao Menu
        </button>
      </div>

      {/* ── Online Chat Panel ── */}
      {showOnlineChat && (
        <div className="fixed bottom-20 right-4 z-[500] w-72 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden" style={{height:'320px'}}>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
            <span className="text-white text-sm font-bold">Chat — {opponentName}</span>
            <button onClick={() => setShowOnlineChat(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div ref={onlineChatRef} className="flex-1 overflow-y-auto p-2 space-y-1">
            {onlineChat.map(msg => (
              <div key={msg.id} className={`text-xs p-1.5 rounded ${msg.sender_id === playerId ? 'bg-amber-900/40 text-amber-200 text-right' : 'bg-slate-800 text-slate-200'}`}>
                <span className="font-semibold">{msg.sender_name}: </span>{msg.message}
              </div>
            ))}
          </div>
          <div className="flex gap-1 p-2 border-t border-slate-700">
            <Input
              value={onlineChatInput}
              onChange={e => setOnlineChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
              placeholder="Mensagem..."
              className="flex-1 h-8 text-xs bg-slate-800 border-slate-600 text-white"
            />
            <button onClick={sendChatMessage} className="px-2 py-1 bg-amber-600 hover:bg-amber-500 rounded text-white text-xs">
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Online Chat Toggle Button ── */}
      <button
        onClick={() => setShowOnlineChat(v => !v)}
        className="fixed bottom-4 right-4 z-[500] w-12 h-12 bg-amber-600 hover:bg-amber-500 rounded-full shadow-lg flex items-center justify-center transition-all"
      >
        <MessageCircle className="w-5 h-5 text-white" />
        {onlineChat.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
            {onlineChat.length > 9 ? '9+' : onlineChat.length}
          </span>
        )}
      </button>
    </div>
  )
}
// ──────────────────────────────────────────────────────────────────────────────

export function OnlineDuelScreen({ roomData, onBack }: OnlineDuelScreenProps) {
  const { t } = useLanguage()
  const { addMatchRecord, getPlaymatForDeck } = useGame()
  const mode = "online"
  const supabase = (() => {
    try { return createClient() } catch (e) { console.error("[OnlineDuelScreen] Supabase init failed:", e); return null }
  })()

  // ─── Multiplayer identity ────────────────────────────────────────────────
  const playerId   = roomData.isHost ? roomData.hostId : (roomData.guestId || "")
  const myDeckRaw  = roomData.isHost ? roomData.hostDeck : roomData.guestDeck
  const oppDeckRaw = roomData.isHost ? roomData.guestDeck : roomData.hostDeck
  const opponentName = roomData.isHost
    ? (roomData.guestName || "Convidado")
    : (roomData.hostName  || "Anfitrião")

  // Cast decks to DeckWithImages
  const selectedDeck   = myDeckRaw  as DeckWithImages | null
  const oppDeckTyped   = oppDeckRaw as DeckWithImages | null

  const [gameStarted, setGameStarted] = useState(false)
  const [isMyTurn, setIsMyTurn]       = useState(roomData.isHost) // host goes first

  // ─── Multiplayer channels ────────────────────────────────────────────────
  const actionsChannelRef              = useRef<RealtimeChannel | null>(null)
  const chatChannelRef                 = useRef<RealtimeChannel | null>(null)
  const processedActionIdsRef          = useRef<Set<string>>(new Set())
  const actionsPollRef                 = useRef<NodeJS.Timeout | null>(null)
  const lastActionTimeRef              = useRef<string>("1970-01-01")

  // ─── Online chat state ───────────────────────────────────────────────────
  const [onlineChat, setOnlineChat]       = useState<OnlineChatMessage[]>([])
  const [onlineChatInput, setOnlineChatInput] = useState("")
  const [showOnlineChat, setShowOnlineChat]   = useState(false)
  const onlineChatRef                         = useRef<HTMLDivElement>(null)

  // Multiplayer state
  const [multiplayerRoomData, setMultiplayerRoomData] = useState<RoomData | null>(null)
  const [showOnlineDuel, setShowOnlineDuel] = useState(false)

  const [turn, setTurn] = useState(1)
  const [phase, setPhase] = useState<Phase>("draw")

  // Draw card animation state
  const [drawAnimation, setDrawAnimation] = useState<{
    visible: boolean
    cardName: string
    cardImage: string
    cardType: string
    fromX: number; fromY: number
    midX:  number; midY:  number
    toX:   number; toY:   number
  } | null>(null)
  const [enemyDrawAnimation, setEnemyDrawAnimation] = useState<{
    fromX: number; fromY: number
    midX:  number; midY:  number
    toX:   number; toY:   number
  } | null>(null)
  const [playerWentFirst, setPlayerWentFirst] = useState(true)
  const [playerField, setPlayerField] = useState<FieldState>({
    unitZone: [null, null, null, null],
    functionZone: [null, null, null, null],
    equipZone: null,
    scenarioZone: null,
    ultimateZone: null,
    hand: [],
    deck: [],
    graveyard: [],
    tap: [],
    life: 50,
  })
  const [enemyField, setEnemyField] = useState<FieldState>({
    unitZone: [null, null, null, null],
    functionZone: [null, null, null, null],
    equipZone: null,
    scenarioZone: null,
    ultimateZone: null,
    hand: [],
    deck: [],
    graveyard: [],
    tap: [],
    life: 50,
  })
  const [selectedHandCard, setSelectedHandCard] = useState<number | null>(null)
  const [cardAnimations, setCardAnimations] = useState<{ [key: string]: string }>({})

  // Constants for card animations
  const CARD_JUMP_DURATION = 350 // Duration of the "jump" movement
  const CARD_JUMP_DELAY = 150 // Wait for charge phase before jumping
  const [gameResult, setGameResult] = useState<"won" | "lost" | null>(null)

  const [attackState, setAttackState] = useState<AttackState>({
    isAttacking: false,
    attackerIndex: null,
    targetInfo: null, // Initialize targetInfo
  })
  const [attackTarget, setAttackTarget] = useState<{ type: "direct" | "unit"; index?: number } | null>(null)
  const [itemSelectionMode, setItemSelectionMode] = useState<{
    active: boolean
    itemCard: GameCard | null
    step: "selectEnemy" | "selectAlly" | "selectChoice"
    selectedEnemyIndex: number | null
    chosenOption: string | null
  }>({ active: false, itemCard: null, step: "selectEnemy", selectedEnemyIndex: null, chosenOption: null })

  // State for choice modal (for cards like Véu dos Laços Cruzados)
  const [choiceModal, setChoiceModal] = useState<{
    visible: boolean
    cardName: string
    options: { id: string; label: string; description: string }[]
    onChoose: (optionId: string) => void
    gridLayout?: boolean
  } | null>(null)

  // Deck search modal (Pedra de Afiar and future search effects)
  const [deckSearchModal, setDeckSearchModal] = useState<{
    visible: boolean
    title: string
    cards: GameCard[]
    onSelect: (card: GameCard) => void
    onCancel: () => void
  } | null>(null)

  // Attack arrow state
  const [arrowPos, setArrowPos] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 })
  const [activeProjectiles, setActiveProjectiles] = useState<Omit<AttackAnimationProps, "onComplete">[]>([])

  const [explosionEffects, setExplosionEffects] = useState<ExplosionEffect[]>([])
  const explosionCanvasRef = useRef<HTMLCanvasElement>(null)
  const activeParticlesRef = useRef<Map<string, { particles: Particle[], startTime: number, element: string, x: number, y: number }>>(new Map())
  const [impactFlash, setImpactFlash] = useState<{ active: boolean; color: string }>({ active: false, color: "#ffffff" })
  const [screenShake, setScreenShake] = useState({ active: false, intensity: 0 })
  const positionRef = useRef({ startX: 0, startY: 0, currentX: 0, currentY: 0, lastTargetCheck: 0 })
  const arrowRef = useRef<SVGLineElement>(null)
  const rafRef = useRef<number | null>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const playerGraveyardRef = useRef<HTMLDivElement>(null)
  const enemyGraveyardRef  = useRef<HTMLDivElement>(null)
  const playerDeckRef      = useRef<HTMLDivElement>(null)
  const enemyDeckRef       = useRef<HTMLDivElement>(null)
  const handContainerRef   = useRef<HTMLDivElement>(null)
  const enemyUnitRectsRef = useRef<DOMRect[]>([])
  const isDraggingRef = useRef(false) // Track drag state
  const playerCardsRef = useRef<(HTMLDivElement | null)[]>([]) // Added for player unit zone refs

  const triggerScreenShake = useCallback((intensity: number = 5, duration: number = 150) => {
    setScreenShake({ active: true, intensity })
    setTimeout(() => setScreenShake({ active: false, intensity: 0 }), duration)
  }, [])

  const triggerExplosion = useCallback((targetX: number, targetY: number, element: string) => {
    const el = element?.toLowerCase().trim() || "neutral"
    const particles: Particle[] = []

    // Screen shake — heavier for earth/fire, lighter for others
    const shakeMap: Record<string, number> = { pyrus:7, fire:7, terra:8, subterra:8, darkus:5, darkness:5, dark:5, void:4 }
    triggerScreenShake(shakeMap[el] ?? 3, 130)

    // ── AQUOS ── water droplets with gravity arc
    if (el === "aquos" || el === "aquo" || el === "water") {
      for (let i = 0; i < 28; i++) {
        const a = (Math.random() * Math.PI * 2)
        const spd = 1.2 + Math.random() * 3.5
        particles.push({ x:targetX, y:targetY, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd - 2.5,
          size:2+Math.random()*4, color:["#00bfff","#40e0d0","#87ceeb"][i%3], alpha:1, gravity:0.18 } as any)
      }
      // White foam burst
      for (let i = 0; i < 10; i++) {
        particles.push({ x:targetX+(Math.random()-0.5)*10, y:targetY+(Math.random()-0.5)*10,
          vx:(Math.random()-0.5)*1.2, vy:-2-Math.random()*2,
          size:3+Math.random()*4, color:"#e0ffff", alpha:0.9, gravity:0.12 } as any)
      }
    }
    // ── PYRUS/FIRE ── rising embers + hot core
    else if (el === "fire" || el === "pyrus") {
      // Core burst
      for (let i = 0; i < 22; i++) {
        const a = Math.random()*Math.PI*2; const spd = 1.5+Math.random()*4
        particles.push({ x:targetX, y:targetY, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd-1,
          size:5+Math.random()*8, color:["#ff4500","#ff6a00","#ff8c00","#ffd700"][i%4], alpha:1, heat:-0.06 } as any)
      }
      // Rising embers
      for (let i = 0; i < 18; i++) {
        particles.push({ x:targetX+(Math.random()-0.5)*16, y:targetY+(Math.random()-0.5)*8,
          vx:(Math.random()-0.5)*1.5, vy:-1-Math.random()*2.5,
          size:1.5+Math.random()*2.5, color:i%2===0?"#ffcc00":"#ff8c00", alpha:0.9, heat:-0.08 } as any)
      }
    }
    // ── VENTUS ── tight spiraling wind
    else if (el === "ventus" || el === "wind") {
      for (let i = 0; i < 30; i++) {
        const a = Math.random()*Math.PI*2; const spd = 2.5+Math.random()*5
        particles.push({ x:targetX, y:targetY, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd*0.4-1.2,
          size:1.5+Math.random()*3, color:["#adff2f","#7fff00","#90ee90","#ffffff"][i%4], alpha:0.9 })
      }
      // Flat shockwave rings
      for (let i = 0; i < 6; i++) {
        const a = Math.random()*Math.PI*2
        particles.push({ x:targetX, y:targetY, vx:Math.cos(a)*6, vy:Math.sin(a)*2,
          size:8+Math.random()*8, color:"rgba(173,255,47,0.25)", alpha:0.5 })
      }
    }
    // ── DARKUS/DARKNESS ── implosion then burst
    else if (el === "darkus" || el === "darkness" || el === "dark") {
      for (let i = 0; i < 32; i++) {
        const a = Math.random()*Math.PI*2; const dist = 35+Math.random()*30
        particles.push({ x:targetX+Math.cos(a)*dist, y:targetY+Math.sin(a)*dist,
          vx:(targetX-(targetX+Math.cos(a)*dist))*0.12,
          vy:(targetY-(targetY+Math.sin(a)*dist))*0.12,
          size:2+Math.random()*4,
          color:["#7b2d8b","#4b0082","#9400d3","#000000"][i%4], alpha:1 })
      }
      // Purple sparks outward
      for (let i = 0; i < 12; i++) {
        const a = (i/12)*Math.PI*2
        particles.push({ x:targetX, y:targetY, vx:Math.cos(a)*4, vy:Math.sin(a)*4,
          size:3+Math.random()*3, color:"#da70d6", alpha:0.85 })
      }
    }
    // ── HAOS/LIGHTNESS ── radiant rays + golden sparks
    else if (el === "haos" || el === "lightness" || el === "light") {
      for (let i = 0; i < 24; i++) {
        const a = Math.random()*Math.PI*2; const spd = 2+Math.random()*6
        particles.push({ x:targetX, y:targetY, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
          size:1+Math.random()*2.5, color:"#ffffff", alpha:1 })
      }
      // Golden falling sparks
      for (let i = 0; i < 20; i++) {
        particles.push({ x:targetX+(Math.random()-0.5)*30, y:targetY+(Math.random()-0.5)*10,
          vx:(Math.random()-0.5)*2, vy:-1.5-Math.random()*3,
          size:1.5+Math.random()*2.5, color:i%3===0?"#fff8dc":"#ffd700", alpha:1, gravity:0.08 } as any)
      }
    }
    // ── VOID ── silver shards + implosion flash
    else if (el === "void") {
      for (let i = 0; i < 36; i++) {
        const a = Math.random()*Math.PI*2; const spd = 2+Math.random()*6
        particles.push({ x:targetX, y:targetY, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
          size:2+Math.random()*5, color:i%3===0?"#c0c0c0":i%3===1?"#dcdcdc":"#a0a0a0", alpha:1,
          shape:"shard", rotation:Math.random()*Math.PI*2, rv:(Math.random()-0.5)*0.25 } as any)
      }
    }
    // ── TERRA/SUBTERRA ── debris + dust
    else if (el === "terra" || el === "subterra") {
      for (let i = 0; i < 22; i++) {
        const a = Math.random()*Math.PI*2; const spd = 1.5+Math.random()*4
        particles.push({ x:targetX, y:targetY, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd-2,
          size:4+Math.random()*9, color:["#8b4513","#a0522d","#cd853f","#d2691e"][i%4], alpha:1, gravity:0.2 } as any)
      }
      for (let i = 0; i < 10; i++) {
        particles.push({ x:targetX+(Math.random()-0.5)*20, y:targetY,
          vx:(Math.random()-0.5)*1.5, vy:-0.5-Math.random()*1,
          size:8+Math.random()*12, color:"rgba(139,69,19,0.3)", alpha:0.5, gravity:0.05 } as any)
      }
    }
    // ── DEFAULT ──
    else {
      for (let i = 0; i < 24; i++) {
        const a = Math.random()*Math.PI*2; const spd = 1.5+Math.random()*4
        particles.push({ x:targetX, y:targetY, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
          size:2+Math.random()*4, color:"#ffffff", alpha:1 })
      }
    }

    const effectId = `explosion-${Date.now()}`
    const startTime = Date.now()
    setExplosionEffects((prev) => [...prev, { id: effectId, x: targetX, y: targetY, element, particles, startTime }])

    const flashColors: Record<string,string> = {
      aquos:"rgba(0,191,255,0.45)", aquo:"rgba(0,191,255,0.45)",
      fire:"rgba(255,80,0,0.55)", pyrus:"rgba(255,80,0,0.55)",
      ventus:"rgba(100,220,50,0.4)",
      darkness:"rgba(120,0,180,0.55)", darkus:"rgba(120,0,180,0.55)", dark:"rgba(120,0,180,0.55)",
      lightness:"rgba(255,220,0,0.5)", haos:"rgba(255,220,0,0.5)", light:"rgba(255,220,0,0.5)",
      void:"rgba(180,180,200,0.5)",
      terra:"rgba(120,60,10,0.5)", subterra:"rgba(120,60,10,0.5)",
    }
    setImpactFlash({ active:true, color: flashColors[el] ?? "rgba(255,255,255,0.35)" })
    setTimeout(() => setImpactFlash({ active:false, color:"#ffffff" }), 90)

    setTimeout(() => {
      setExplosionEffects((prev) => prev.filter((e) => e.id !== effectId))
    }, 1000)
  }, [triggerScreenShake])

  // Destruction animation state
  const [destructionAnimation, setDestructionAnimation] = useState<{
    id: string
    cardName: string
    cardImage: string
    x: number
    y: number
    element: string
  } | null>(null)

  // ── All missing state declarations ──
  const [diceAnimation, setDiceAnimation] = useState<{
    visible: boolean; rolling: boolean; result: number | null
    cardName: string; onComplete: ((result: number) => void) | null
  } | null>(null)
  const [lacerationAnimation, setLacerationAnimation] = useState(false)
  const [sinfoniaAnimation, setSinfoniaAnimation] = useState(false)
  const [draggedHandCard, setDraggedHandCard] = useState<{ index: number; card: GameCard; currentY?: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [droppingCard, setDroppingCard] = useState<{ card: GameCard; targetX: number; targetY: number } | null>(null)
  const [inspectedCard, setInspectedCard] = useState<GameCard | null>(null)
  const [graveyardView, setGraveyardView] = useState<"player" | "enemy" | null>(null)
  const [tapView, setTapView] = useState<"player" | "enemy" | null>(null)
  const [effectFeedback, setEffectFeedback] = useState<{ active: boolean; message: string; type: "success" | "error" } | null>(null)
  const [playerUgAbilityUsed, setPlayerUgAbilityUsed] = useState(false)
  const [enemyUgAbilityUsed, setEnemyUgAbilityUsed] = useState(false)
  const [ugTargetMode, setUgTargetMode] = useState<{
    active: boolean; ugCard: GameCard | null
    type: "oden_sword" | "twiligh_avalon" | "mefisto" | "julgamento_divino" | null
  }>({ active: false, ugCard: null, type: null })
  const [julgamentoDivinoUsedThisTurn, setJulgamentoDivinoUsedThisTurn] = useState(false)
  const [pulsoNulidadeLastUsedTurn, setPulsoNulidadeLastUsedTurn] = useState<number | null>(null)
  const [impactoSemFeLastUsedTurn, setImpactoSemFeLastUsedTurn] = useState<number | null>(null)
  const [calemUrDoubleAttack, setCalemUrDoubleAttack] = useState(false)
  const [normalSummonUsed, setNormalSummonUsed] = useState(false)  // 1 normal unit summon per turn
  const [julgamentoVazioTargetMode, setJulgamentoVazioTargetMode] = useState<{ active: boolean; attackerIndex: number | null }>({ active: false, attackerIndex: null })
  const [fornbrennaFireCount, setFornbrennaFireCount] = useState(0)

  // ── Fehnon double-attack & bonus DP flags ──
  const [fehnonSrDouble, setFehnonSrDouble] = useState(false)
  const [fehnonUrDouble, setFehnonUrDouble] = useState(false)
  const [fehnonUrUsedDoubleThisTurn, setFehnonUrUsedDoubleThisTurn] = useState(false)
  const [fehnonLrDouble, setFehnonLrDouble] = useState(false)
  const [fehnonLrBonusDp, setFehnonLrBonusDp] = useState(0)


  // ── Pre-game setup state ──


  // ── Multiplayer state ──
  // ── Ullr states ──
  const [ullrSrMarcaUsed, setUllrSrMarcaUsed] = useState(false)                      // Marca da Caçada — once per duel (or cooldown?) — description says always active, treat as once per main phase
  const [ullrUrJuramentoLastTurn, setUllrUrJuramentoLastTurn] = useState<number|null>(null)  // Juramento Eterno — every 4 turns
  const [ullrUrFlechaUsed, setUllrUrFlechaUsed] = useState(false)                    // Flecha de Skadi — once ever

  // ── Logi states ──
  const [logiSrKillsThisBattle, setLogiSrKillsThisBattle] = useState(0)           // Incêndio Vivo: extra attacks this battle
  const [logiUrDevorarLastTurn, setLogiUrDevorarLastTurn] = useState<number|null>(null)  // Devorar o Mundo cooldown (3 turns)

  // ── Hrotti states ──
  const [hrottiSrLastTurn, setHrottiSrLastTurn] = useState<number|null>(null)      // Avareza de Fafnir cooldown (3 turns)
  const [hrottiSrAttackLastTurn, setHrottiSrAttackLastTurn] = useState<number|null>(null)  // Corte do Medo Rúnico cooldown (2 turns)
  const [hrottiUrUsed, setHrottiUrUsed] = useState(false)                           // Herança de Andvaranaut — once ever
  const [hrottiUrNullifyUntil, setHrottiUrNullifyUntil] = useState<number|null>(null)  // turn until UG effects nullified
  const [hrottiLrTidalActiveTurn, setHrottiLrTidalActiveTurn] = useState<number|null>(null)  // turn Tidal first activated
  const [hrottiLrIraUsed, setHrottiLrIraUsed] = useState(false)                    // Ira Maelstrom triggered this battle

  // ── Unit ability confirmation modal ──
  const [unitAbilityConfirm, setUnitAbilityConfirm] = useState<{name:string; abilityKey:string} | null>(null)

  // ── Mr. P / Vivian effect states ──
  const [mrPManuscritoUsed, setMrPManuscritoUsed] = useState(false)  // Manuscrito de Guerra — once per duel (optional)
  const [mrpTargetMode, setMrpTargetMode] = useState(false)  // true while player is picking enemy unit
  const [vivianAbracoUsed, setVivianAbracoUsed] = useState(false)    // Abraço das Profundezas — on summon

  // ── Merlin / Oswin effect states ──
  const [merlinUsed, setMerlinUsed] = useState(false)   // Visão Além do Agora — once per duel
  const [oswinUsed, setOswinUsed] = useState(false)     // Lucro na Crise — once per duel

  // ── Galahad / Mordred effect states ──
  const [mordredCamlannUsed, setMordredCamlannUsed] = useState(false)  // once per duel

  // ── Rei Arthur effect states ──
  const [arthurUrVeredito, setArthurUrVeredito] = useState<number|null>(null)   // last turn UR used Veredito
  const [arthurLrCalice, setArthurLrCalice] = useState<number|null>(null)        // last turn LR used Cálice
  const [arthurLrCaliceMode, setArthurLrCaliceMode] = useState(false)            // LR: awaiting 2-target selection
  const [arthurLrCaliceTargets, setArthurLrCaliceTargets] = useState<number[]>([]) // LR: selected targets

  // ── Morgana Pendragon effect states ──
  const [morganaEclipseLastTurn, setMorganaEclipseLastTurn] = useState<number|null>(null)       // SR: Ressonância em Eclipse cooldown
  const [morganaSinfoniaLastTurn, setMorganaSinfoniaLastTurn] = useState<number|null>(null)     // UR: Sinfonia Relâmpago cooldown
  const [morganaDiscordiaLastTurn, setMorganaDiscordiaLastTurn] = useState<number|null>(null)   // LR: Sinfonia da Discórdia cooldown
  const [morganaEclipseActive, setMorganaEclipseActive] = useState<{target:'direct'|'unit';turn:number}|null>(null)  // SR: eclipse debuff on enemy
  const [morganaTrapBlocked, setMorganaTrapBlocked] = useState(false)     // UR 3dp: traps blocked while on field
  const [morganaActionBlocked, setMorganaActionBlocked] = useState(false) // LR 4dp: actions+traps blocked while on field

  // Destruction sequencing: IDs of cards with an active on-field destruction animation.
  // DiscardAnimationManager delays graveyard animation until the field explosion finishes.
  const [destroyedCardIds, setDestroyedCardIds] = useState<Set<string>>(new Set())
  const markDestroyed = useCallback((card: GameCard) =>
    setDestroyedCardIds(prev => { const s = new Set(prev); s.add(card.id); return s })
  , [])

  const prevUnitZoneRef = useRef<(string | null)[]>([])
  const cardPressTimer = useRef<NodeJS.Timeout | null>(null)
  const animationInProgressRef = useRef(false)
  const attackIdRef = useRef(0)
  const draggedCardRef = useRef<HTMLDivElement>(null)
  const dragPosRef = useRef({ x: 0, y: 0, rotation: 0, lastCheck: 0 })

  useEffect(() => {
    if (!playerField.ultimateZone || !playerField.ultimateZone.requiresUnit) {
      prevUnitZoneRef.current = playerField.unitZone.map((u) => u?.name || null); return
    }
    const ug = playerField.ultimateZone; const requiredUnit = ug.requiresUnit!; const ability = ug.ability
    const prevNames = prevUnitZoneRef.current; const currentNames = playerField.unitZone.map((u) => u?.name || null)
    const wasPresent = prevNames.some((n) => n === requiredUnit); const isNowPresent = currentNames.some((n) => n === requiredUnit)
    if (!wasPresent && isNowPresent) {
      const unitIdx = playerField.unitZone.findIndex((u) => u && u.name === requiredUnit)
      if (unitIdx !== -1) {
        setPlayerField((prev) => {
          const newUnits = [...prev.unitZone]; const unit = newUnits[unitIdx]; if (!unit) return prev
          let bonus = 0; let msg = ""
          if (ability === "ODEN SWORD") { bonus = 4; msg = `${requiredUnit} +4 DP (Oden Sword)!` }
          else if (ability === "PROTONIX SWORD") { bonus = 2; msg = `${requiredUnit} +2 DP (Protonix Sword)!` }
          else if (ability === "TWILIGH AVALON") { bonus = 2; msg = `${requiredUnit} +2 DP (Twiligh Avalon)!` }
          else if (ability === "ULLRBOGI") { msg = `${requiredUnit} receberá +3 DP nas fases de batalha!` }
          else if (ability === "MIGUEL ARCANJO") { bonus = 4; msg = `${requiredUnit} +4 DP! Proteção ativada! (Miguel Arcanjo)` }
          else if (ability === "MEFISTO") { bonus = 2; msg = `${requiredUnit} +2 DP! (Mefisto Foles)` }
          else if (ability === "FORNBRENNA") {
            const fireCount = countFireUnitsUsed(prev); bonus = fireCount * 2
            setFornbrennaFireCount(fireCount); msg = `${requiredUnit} +${bonus} DP (Fornbrenna, ${fireCount} fogo)!`
          }
          if (bonus > 0) newUnits[unitIdx] = { ...unit, currentDp: (unit as any).currentDp + bonus }
          if (msg) showEffectFeedback(msg, "success")
          return { ...prev, unitZone: newUnits as any }
        })
      }
    }
    prevUnitZoneRef.current = currentNames
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerField.unitZone, playerField.ultimateZone])

  const handleAnimationComplete = useCallback((id: string) => { setActiveProjectiles((prev) => prev.filter((p) => p.id !== id)) }, [])
  const handleImpact = useCallback((id: string, x: number, y: number, element: string) => {
    setActiveProjectiles((prev) => prev.filter((p) => p.id !== id)); triggerExplosion(x, y, element)
  }, [triggerExplosion])
  const gameResultRecordedRef = useRef(false)
  const showEffectFeedback = useCallback((message: string, type: "success" | "error" | "info" | "warning") => {
    setEffectFeedback({ active: true, message, type: type === "info" || type === "warning" ? "error" : type })
    setTimeout(() => setEffectFeedback(null), 2000)
  }, [])
  const showDrawAnimation = useCallback((card: GameCard) => {
    const deckEl      = playerDeckRef.current
    const handEl      = handContainerRef.current

    // Source: centre of player deck
    const dr = deckEl?.getBoundingClientRect()
    const fx = dr ? dr.left + dr.width/2  : window.innerWidth  * 0.78
    const fy = dr ? dr.top  + dr.height/2 : window.innerHeight * 0.42

    // Destination: position the NEW last card will occupy in the fan
    // newLen = current hand length + 1 (card not yet added to state)
    const CARD_W  = 80   // w-20
    const CARD_H  = 112  // h-28
    const GAP     = 12   // gap-3

    let tx = window.innerWidth * 0.50
    let ty = window.innerHeight * 0.87

    if (handEl) {
      const hRect  = handEl.getBoundingClientRect()
      const newLen = playerField.hand.length + 1   // card being added
      const lastI  = newLen - 1
      const offset = lastI - (newLen - 1) / 2      // rightmost card offset
      // Centre of hand container + fan offset
      const centerX = hRect.left + hRect.width / 2
      tx = centerX + offset * (CARD_W + GAP)
      ty = hRect.bottom - CARD_H / 2               // items-end: bottom-aligned
    }

    // Arc peak: midway but lifted well above both points
    const mx = (fx + tx) / 2 + (tx > fx ? 30 : -30)
    const my = Math.min(fy, ty) - window.innerHeight * 0.18

    setDrawAnimation({ visible:true, cardName:card.name, cardImage:card.image, cardType:card.type,
      fromX:fx, fromY:fy, midX:mx, midY:my, toX:tx, toY:ty })
    setTimeout(() => setDrawAnimation(null), 1100)
  }, [playerDeckRef, handContainerRef, playerField.hand.length])
  const showDestructionAnimation = useCallback((card: GameCard, x: number, y: number) => {
    setDestructionAnimation({ id: `destruction-${Date.now()}`, cardName: card.name, cardImage: card.image, x, y, element: card.element || "neutral" })
    markDestroyed(card)
    setTimeout(() => setDestructionAnimation(null), 1200)
  }, [markDestroyed])
  const rollDice = useCallback((cardName: string): Promise<number> => {
    return new Promise((resolve) => {
      // Compute result immediately so the dice can start decelerating to the right face from frame 1
      const result = Math.floor(Math.random() * 6) + 1
      // rolling=true hides the result number; rolling=false reveals it
      // We pass result from the start so DiceCanvas3D can decelerate to the correct face immediately
      setDiceAnimation({ visible: true, rolling: true, result, cardName, onComplete: null })
      // After dice physics finishes decelerating (~1800ms), reveal the number
      setTimeout(() => {
        setDiceAnimation((prev) => prev ? { ...prev, rolling: false } : null)
        // Close 1800ms after number is revealed (bounce plays during this time)
        setTimeout(() => { setDiceAnimation(null); resolve(result) }, 1800)
      }, 2000)
    })
  }, [])
  const resolveEffectWithDice = useCallback(async (effect: FunctionCardEffect, effectContext: EffectContext, targets: EffectTargets, cardName: string): Promise<EffectResult> => {
    if (effect.requiresDice) { const diceResult = await rollDice(cardName); return effect.resolve(effectContext, { ...targets, diceResult }) }
    return effect.resolve(effectContext, targets)
  }, [rollDice])


  useEffect(() => {
    if (explosionEffects.length === 0) {
      const canvas = explosionCanvasRef.current
      if (canvas) { const ctx = canvas.getContext("2d"); if (ctx) ctx.clearRect(0,0,canvas.width,canvas.height) }
      return
    }

    const canvas = explosionCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    const duration = 1000

    const animate = () => {
      const now = Date.now()
      const activeEffects = activeParticlesRef.current

      explosionEffects.forEach((effect) => {
        if (!activeEffects.has(effect.id)) {
          activeEffects.set(effect.id, {
            particles: effect.particles.map((p) => ({ ...p })),
            startTime: effect.startTime, element: effect.element, x: effect.x, y: effect.y
          })
        }
      })
      for (const [id, effect] of activeEffects.entries()) {
        if (now - effect.startTime > duration) activeEffects.delete(id)
      }
      if (activeEffects.size === 0) { ctx.clearRect(0,0,canvas.width,canvas.height); return }
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth; canvas.height = window.innerHeight
      }
      ctx.clearRect(0,0,canvas.width,canvas.height)

      activeEffects.forEach((effect) => {
        const elapsed = now - effect.startTime
        if (elapsed > duration) return
        const el = effect.element?.toLowerCase()
        const t = elapsed / duration // 0→1
        const cx = effect.x; const cy = effect.y

        // ── Per-element canvas background effects ──
        if (el === "aquos" || el === "aquo") {
          // Expanding wavy water ring
          const maxR = 60; const ringT = Math.min(1, t * 2.5)
          ctx.save()
          ctx.globalAlpha = (1 - ringT) * 0.55
          ctx.strokeStyle = "#00d4ff"; ctx.lineWidth = 2 + (1-ringT)*4
          ctx.shadowColor = "#00bfff"; ctx.shadowBlur = 12
          ctx.beginPath()
          for (let a = 0; a < Math.PI*2; a += 0.15) {
            const r = ringT * maxR + Math.sin(a*5 + elapsed*0.008)*4
            const px = cx + Math.cos(a)*r; const py = cy + Math.sin(a)*r
            a === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py)
          }
          ctx.closePath(); ctx.stroke(); ctx.restore()
          // Second thinner ring delayed
          const rt2 = Math.min(1, Math.max(0,(t-0.15)*3))
          if (rt2 > 0) {
            ctx.save(); ctx.globalAlpha = (1-rt2)*0.35
            ctx.strokeStyle = "#40e0d0"; ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.arc(cx, cy, rt2*45, 0, Math.PI*2); ctx.stroke(); ctx.restore()
          }
        }
        else if (el === "fire" || el === "pyrus") {
          // Jagged fire burst outline
          const fp = Math.min(1, t*2.2)
          ctx.save(); ctx.globalAlpha = (1-fp)*0.7
          ctx.strokeStyle = "#ff4500"; ctx.lineWidth = 3+(1-fp)*5
          ctx.shadowColor = "#ff6a00"; ctx.shadowBlur = 20
          ctx.beginPath()
          for (let a = 0; a < Math.PI*2; a += 0.25) {
            const r = fp*62 + (Math.random()-0.5)*12
            ctx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r)
          }
          ctx.closePath(); ctx.stroke(); ctx.restore()
          // Inner glow
          if (fp < 0.6) {
            ctx.save()
            const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,fp*40)
            grad.addColorStop(0,`rgba(255,255,200,${(0.6-fp)*0.9})`)
            grad.addColorStop(1,"transparent")
            ctx.fillStyle = grad; ctx.fillRect(cx-45,cy-45,90,90); ctx.restore()
          }
        }
        else if (el === "ventus" || el === "wind") {
          // Logarithmic spiral
          const sp = Math.min(1, t*2)
          ctx.save(); ctx.globalAlpha = (1-sp)*0.55
          ctx.strokeStyle = "#7fff00"; ctx.lineWidth = 1.5
          ctx.shadowColor = "#adff2f"; ctx.shadowBlur = 8
          ctx.beginPath()
          for (let a = 0; a < Math.PI*5; a += 0.12) {
            const r = a * 3.5 * sp
            ctx.lineTo(cx+Math.cos(a + elapsed*0.015)*r, cy+Math.sin(a + elapsed*0.015)*r)
          }
          ctx.stroke()
          // Horizontal shockwave ellipse
          const sw = Math.min(1,(t-0.1)*2.5)
          if (sw > 0) {
            ctx.globalAlpha = (1-sw)*0.4
            ctx.strokeStyle = "#adff2f"; ctx.lineWidth = 2
            ctx.beginPath(); ctx.ellipse(cx,cy,sw*70,sw*22,0,0,Math.PI*2); ctx.stroke()
          }
          ctx.restore()
        }
        else if (el === "darkus" || el === "darkness" || el === "dark") {
          // Dark void pulse
          const dp = Math.min(1, t*1.8)
          ctx.save()
          const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,dp*70)
          grad.addColorStop(0,`rgba(60,0,100,${(1-dp)*0.85})`)
          grad.addColorStop(0.5,`rgba(30,0,60,${(1-dp)*0.5})`)
          grad.addColorStop(1,"transparent")
          ctx.fillStyle = grad; ctx.fillRect(cx-75,cy-75,150,150)
          // Rotating tentacle lines
          for (let i = 0; i < 8; i++) {
            const ang = (Math.PI*2*i/8) + elapsed*0.003
            const len = 58*(1-dp)
            if (len > 2) {
              ctx.strokeStyle = `rgba(${100+i*8},0,${130+i*5},0.5)`
              ctx.lineWidth = 1.5; ctx.beginPath()
              ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(ang)*len, cy+Math.sin(ang)*len)
              ctx.stroke()
            }
          }
          ctx.restore()
        }
        else if (el === "haos" || el === "lightness" || el === "light") {
          // Star-burst rays
          const lp = Math.min(1, t*2)
          ctx.save(); ctx.globalAlpha = (1-lp)*0.8
          ctx.strokeStyle = "#ffd700"; ctx.lineWidth = 2
          ctx.shadowColor = "#fff8dc"; ctx.shadowBlur = 18
          for (let i = 0; i < 12; i++) {
            const ang = (Math.PI*2*i/12)
            const len = lp * 55
            ctx.beginPath()
            ctx.moveTo(cx + Math.cos(ang)*8, cy + Math.sin(ang)*8)
            ctx.lineTo(cx + Math.cos(ang)*len, cy + Math.sin(ang)*len)
            ctx.stroke()
          }
          // Central bright flash
          if (t < 0.25) {
            const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,35*(1-t*4))
            grad.addColorStop(0,`rgba(255,255,220,${(0.25-t)*3.5})`)
            grad.addColorStop(1,"transparent")
            ctx.fillStyle = grad; ctx.fillRect(cx-40,cy-40,80,80)
          }
          ctx.restore()
        }
        else if (el === "void") {
          // Fracture cracks radiating out
          const vp = Math.min(1, t*2.2)
          ctx.save(); ctx.globalAlpha = (1-vp)*0.8
          ctx.strokeStyle = "#b8b8cc"; ctx.lineWidth = 1.2
          ctx.shadowColor = "#c8c8e0"; ctx.shadowBlur = 8
          for (let i = 0; i < 6; i++) {
            const baseAng = (Math.PI*2*i/6)
            ctx.beginPath(); ctx.moveTo(cx,cy)
            let lx=cx, ly=cy
            for (let j = 0; j < 3; j++) {
              lx += Math.cos(baseAng+(Math.random()-0.5)*0.7)*vp*18
              ly += Math.sin(baseAng+(Math.random()-0.5)*0.7)*vp*18
              ctx.lineTo(lx,ly)
            }
            ctx.stroke()
          }
          // Inversion flash
          if (t < 0.18) {
            ctx.globalAlpha = (0.18-t)*4*0.6
            ctx.fillStyle = "rgba(220,220,255,0.5)"
            ctx.beginPath(); ctx.arc(cx,cy,40*(1-t*5),0,Math.PI*2); ctx.fill()
          }
          ctx.restore()
        }
        else if (el === "terra" || el === "subterra") {
          // Ground crack lines
          const tp = Math.min(1, t*2)
          ctx.save(); ctx.globalAlpha = (1-tp)*0.7
          ctx.strokeStyle = "#8b4513"; ctx.lineWidth = 2
          for (let i = 0; i < 5; i++) {
            const ang = (Math.PI*2*i/5)+0.3
            ctx.beginPath(); ctx.moveTo(cx,cy)
            let lx=cx, ly=cy
            for (let j = 0; j < 4; j++) {
              lx += Math.cos(ang+(Math.random()-0.5)*0.9)*tp*16
              ly += Math.sin(ang+(Math.random()-0.5)*0.9)*tp*16
              ctx.lineTo(lx,ly)
            }
            ctx.stroke()
          }
          ctx.restore()
          // Dust cloud
          const dc = Math.min(1,(t-0.05)*3)
          if (dc > 0 && dc < 1) {
            ctx.save()
            const grad = ctx.createRadialGradient(cx,cy+10,0,cx,cy+10,dc*55)
            grad.addColorStop(0,`rgba(160,90,20,${(1-dc)*0.4})`)
            grad.addColorStop(1,"transparent")
            ctx.fillStyle = grad; ctx.fillRect(cx-60,cy-20,120,80); ctx.restore()
          }
        }

        // ── Particles (shared) ──
        effect.particles.forEach((p: any) => {
          if (p.gravity) p.vy += p.gravity
          if (p.heat) p.vy += p.heat
          if (p.rotation !== undefined) p.rotation += (p.rv || 0.1)
          p.x += p.vx; p.y += p.vy; p.alpha -= 0.022; p.size *= 0.97
          if (p.alpha <= 0 || p.size < 0.4) return

          ctx.save()
          ctx.translate(p.x, p.y)
          if (p.rotation !== undefined) ctx.rotate(p.rotation)
          ctx.globalAlpha = p.alpha
          ctx.fillStyle = p.color

          // Glow for bright elements
          if (el==="haos"||el==="light"||el==="lightness"||el==="fire"||el==="pyrus") {
            ctx.shadowColor = p.color; ctx.shadowBlur = 10
          }
          if (el==="aquos"||el==="aquo") { ctx.shadowColor="#00d4ff"; ctx.shadowBlur=7 }
          if (el==="darkus"||el==="darkness"||el==="dark") { ctx.shadowColor="#9400d3"; ctx.shadowBlur=8 }

          if (p.shape === "shard") {
            ctx.beginPath()
            ctx.moveTo(0,-p.size); ctx.lineTo(p.size*0.6,p.size); ctx.lineTo(-p.size*0.6,p.size)
            ctx.closePath(); ctx.fill()
          } else {
            ctx.beginPath(); ctx.arc(0,0,p.size,0,Math.PI*2); ctx.fill()
          }
          ctx.restore()
        })

        // ── Central residual glow ──
        const ga = Math.max(0, 0.7 - t * 1.3)
        if (ga > 0) {
          const glowColor = getElementGlow(effect.element)
          const gr = ctx.createRadialGradient(cx,cy,0,cx,cy,70)
          gr.addColorStop(0, glowColor.replace("0.8", String(ga * 0.55)))
          gr.addColorStop(1, "transparent")
          ctx.fillStyle = gr; ctx.fillRect(cx-75,cy-75,150,150)
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [explosionEffects])


  const canPlayerAttack = () => {
    if (phase !== "battle") return false
    if (!isMyTurn) return false
    if (playerWentFirst) {
      return turn >= 3
    } else {
      return turn >= 2
    }
  }

  // Cards that go in the Ultimate Zone (gear/weapons only)
  // Rei Arthur (ultimateGuardian) is a UNIT and goes in the Unit Zone
  const isUltimateCard = (card: GameCard) => {
    if (card.name.toLowerCase().includes("rei arthur")) return false
    if (card.name.toLowerCase().includes("hrotti")) return false
    return (
      card.type === "ultimateGear" ||
      card.type === "ultimateGuardian"
    )
  }

  const isUnitCard = (card: GameCard) => {
    return (
      card.type === "unit" ||
      card.type === "ultimateGear" ||
      card.type === "ultimateElemental" ||
      card.type === "ultimateGuardian" ||
      card.type === "troops"
    )
  }

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
           name.includes("caveiro afogado") // Sic: handle typo in card name
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

  const calculateCardDP = (card: GameCard, ownerField: FieldState, isEnemy: boolean): number => {
    let dp = card.dp
    
    // Use the ownerField properly to check what continuous functions they have
    const ownerFunctions = ownerField.functionZone.filter(f => f && !f.isFaceDown);
    const hasAlvorada = ownerFunctions.some(f => f?.name === "Alvorada de Albion");
    const hasGrandeOrdem = ownerFunctions.some(f => f?.name === "A Grande Ordem");

    // Apply Brotherhood Function Auras
    if (hasGrandeOrdem) {
      const name = card.name.toLowerCase();
      if (name.includes("fehnon") || name.includes("morgana") || name.includes("calem")) {
        dp += 3;
      }
    }

    if (hasAlvorada) {
      const name = card.name.toLowerCase();
      if (name.includes("arthur")) {
        dp += 3;
      }
      if (isTroopUnit(card) && card.element === "Darkus") {
        dp += 2;
      }
    }

    // ── LANCELOT: Virtude do Cavaleiro — +2DP if any Void unit on owner's field ──
    if (card.name.toLowerCase().includes("lancelot")) {
      const ownerUnitZone = isEnemy ? enemyField.unitZone : playerField.unitZone
      const hasVoidUnit = ownerUnitZone.some(u => u !== null && u.id !== card.id && (u.element === "Void" || u.element === "Darkus"))
      if (hasVoidUnit) dp += 2
    }

    // Check scenarios (both can be active at the same time in some games, but here we check both fields)
    const scenarios = [
      { card: playerField.scenarioZone, isPlayer: true, field: playerField },
      { card: enemyField.scenarioZone, isPlayer: false, field: enemyField }
    ]

    scenarios.forEach(({ card: scenario, isPlayer: scenarioOwnerIsPlayer, field: scenarioField }) => {
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
        // Debuff: Only if this scenario belongs to the OPPONENT of this card
        if (!applied && !isCardOwner) {
          // Check if the scenario owner has Alvorada de Albion
          const scenarioOwnerHasAlvorada = scenarioField.functionZone.some(f => f && !f.isFaceDown && f.name === "Alvorada de Albion");
          dp -= (scenarioOwnerHasAlvorada ? 4 : 2);
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

    // Clamp DP to minimum 0
    return Math.max(0, dp)
  }

  const canUnitAttackNow = (card: FieldCard | null): boolean => {
    if (!card) return false
    if (phase !== "battle") return false
    if (!isMyTurn) return false
    if (card.hasAttacked) return false
    // Only check turn restriction
    if (turn <= card.canAttackTurn) return false
    return true
  }

  const cacheEnemyRects = useCallback(() => {
    const enemyUnitElements = document.querySelectorAll("[data-enemy-unit]")
    enemyUnitRectsRef.current = Array.from(enemyUnitElements).map((el) => el.getBoundingClientRect())
  }, [])

  // ─── initGame: called once on mount for multiplayer ────────────────────────
  const initGame = (playerDeck: DeckWithImages, opponentDeck: DeckWithImages | null) => {
    const shuffledDeck = [...playerDeck.cards].sort(() => Math.random() - 0.5)
    const hand = shuffledDeck.slice(0, 5)
    const remainingDeck = shuffledDeck.slice(5)

    setPlayerField((prev) => ({
      ...prev,
      hand,
      deck: remainingDeck,
      tap: playerDeck.tapCards ? [...playerDeck.tapCards] : [],
      life: 50,
      unitZone: [null, null, null, null],
      functionZone: [null, null, null, null],
      scenarioZone: null,
      ultimateZone: null,
      graveyard: [],
    }))

    if (opponentDeck) {
      const shuffledOpp = [...opponentDeck.cards].sort(() => Math.random() - 0.5)
      setEnemyField((prev) => ({
        ...prev,
        hand: Array(5).fill(null),
        deck: Array(shuffledOpp.length - 5 > 0 ? shuffledOpp.length - 5 : 0).fill(null),
        tap: opponentDeck.tapCards ? [...opponentDeck.tapCards] : [],
        life: 50,
        unitZone: [null, null, null, null],
        functionZone: [null, null, null, null],
        scenarioZone: null,
        ultimateZone: null,
        graveyard: [],
      }))
    }

    setGameStarted(true)
    setTurn(1)
    setPhase("draw")
    setIsMyTurn(roomData.isHost) // host always goes first
    setPlayerWentFirst(roomData.isHost)
  }

  const drawCard = () => {
    if (playerField.deck.length === 0) return

    const drawnCard = playerField.deck[0]
    showDrawAnimation(drawnCard)
    // Broadcast draw to opponent
    sendActionRef.current({ type: "draw", playerId, data: { handSize: playerField.hand.length + 1, deckSize: playerField.deck.length - 1 }, timestamp: Date.now() })
    setPlayerField((prev) => ({
      ...prev,
      hand: [...prev.hand, drawnCard],
      deck: prev.deck.slice(1),
    }))
  }

  const placeCard = (zone: "unit" | "function", slotIndex: number, forcedCardIndex?: number) => {
    if (!isMyTurn) return
    if (phase !== "main") return

    const cardIndex = forcedCardIndex ?? (draggedHandCard?.index ?? selectedHandCard)
    if (cardIndex === null || cardIndex === undefined) return

    const cardToPlace = playerField.hand[cardIndex]
    if (!cardToPlace) return

    // Scenario cards can ONLY be played in the Scenario zone
    if (cardToPlace.type === "scenario") return

    // Ultimate cards (ultimateGear, ultimateGuardian) can ONLY be played in the Ultimate zone
    if (isUltimateCard(cardToPlace)) return

    const isUnit = isUnitCard(cardToPlace)
    if (zone === "unit" && isUnit) {
      if (playerField.unitZone[slotIndex] !== null) return
      // Limit: only 1 normal summon per turn
      if (normalSummonUsed) {
        showEffectFeedback("Você já evocou uma Unidade neste turno!", "error")
        return
      }

      const fieldCard: FieldCard = {
        ...cardToPlace,
        currentDp: calculateCardDP(cardToPlace, playerField, false),
        canAttack: false,
        hasAttacked: false,
        canAttackTurn: turn, // Store current turn when card is placed
      }

      setPlayerField((prev) => {
        const newUnitZone = [...prev.unitZone]
        newUnitZone[slotIndex] = fieldCard
        return {
          ...prev,
          unitZone: newUnitZone,
          hand: prev.hand.filter((_, i) => i !== cardIndex),
        }
      })
      setNormalSummonUsed(true)
      // ── Broadcast unit placement ──
      sendActionRef.current({
        type: "place_card",
        playerId,
        data: { zone: "unit", index: slotIndex, card: cardToPlace, source: "hand" },
        timestamp: Date.now(),
      })
      // ── LOGI UR: Cinzas do Mundo — ao entrar em campo, +2DP a outra unidade (ou compra 1 carta) ──
      if (cardToPlace.name.toLowerCase().includes("logi") && cardToPlace.dp === 2) {
        // Use functional setter to read FRESH state after Logi was placed
        setTimeout(() => {
          setPlayerField(prev => {
            const otherUnits = prev.unitZone
              .map((u, i) => ({ u, i }))
              .filter(({ u }) => u !== null && !u.name.toLowerCase().includes("logi"))
            if (otherUnits.length === 0) {
              // No other units — draw a card
              const drawn = prev.deck[0]
              if (drawn) {
                showDrawAnimation(drawn)
                showEffectFeedback("CINZAS DO MUNDO: Nenhuma unidade! Comprou 1 carta.", "info")
                return { ...prev, deck: prev.deck.slice(1), hand: [...prev.hand, drawn] }
              }
              return prev
            }
            if (otherUnits.length === 1) {
              const { u, i } = otherUnits[0]
              const newUnits = [...prev.unitZone]
              newUnits[i] = { ...newUnits[i]!, currentDp: (newUnits[i]!.currentDp ?? newUnits[i]!.dp) + 2 }
              showEffectFeedback(`CINZAS DO MUNDO: ${u!.name} +2DP permanente!`, "success")
              return { ...prev, unitZone: newUnits as (FieldCard|null)[] }
            }
            // Multiple options — show modal (read options from fresh state)
            const opts = otherUnits.slice(0, 4)
            setTimeout(() => {
              setChoiceModal({
                visible: true,
                cardName: "Cinzas do Mundo — Escolha 1 unidade para receber +2DP",
                options: opts.map(({ u, i }) => ({
                  id: String(i),
                  label: u!.name,
                  description: `${u!.currentDp ?? u!.dp}DP → ${(u!.currentDp ?? u!.dp) + 2}DP`,
                })),
                onChoose: (optId) => {
                  setChoiceModal(null)
                  const idx = parseInt(optId)
                  setPlayerField(prev2 => {
                    const newUnits = [...prev2.unitZone]
                    if (newUnits[idx]) {
                      const chosen = newUnits[idx]!
                      newUnits[idx] = { ...chosen, currentDp: (chosen.currentDp ?? chosen.dp) + 2 }
                      showEffectFeedback(`CINZAS DO MUNDO: ${chosen.name} +2DP permanente!`, "success")
                    }
                    return { ...prev2, unitZone: newUnits as (FieldCard|null)[] }
                  })
                },
              })
            }, 0)
            return prev
          })
        }, 400)
      }

      // ── VIVIAN: Abraço das Profundezas — ao entrar em campo, pode evocar unidade 2/3DP do deck ──
      if (cardToPlace.name.toLowerCase().includes("vivian") && !vivianAbracoUsed) {
        setTimeout(() => activateVivianAbility(), 300)
      }

      // ── REI ARTHUR LR 4DP: O Preço da Coroa — ao entrar em campo, opção de comprar 1 carta ──
      if (cardToPlace.name.toLowerCase().includes("rei arthur") && cardToPlace.dp === 4) {
        setTimeout(() => {
          const hasMefisto = playerField.ultimateZone?.ability === "MEFISTO"
          if (hasMefisto && playerField.deck.length > 0) {
            setChoiceModal({
              visible: true,
              cardName: "O Preço da Coroa — Comprar 1 carta?",
              options: [
                { id: "draw", label: "Comprar 1 carta", description: "Compre a carta do topo do deck" },
                { id: "skip", label: "Não comprar", description: "Pular esta oportunidade" },
              ],
              onChoose: (optId) => {
                setChoiceModal(null)
                if (optId === "draw") {
                  const drawn = playerField.deck[0]
                  if (drawn) {
                    showDrawAnimation(drawn)
                    setPlayerField(prev => ({ ...prev, deck: prev.deck.slice(1), hand: [...prev.hand, drawn] }))
                    showEffectFeedback(`O PREÇO DA COROA: ${drawn.name} comprada!`, "success")
                  }
                }
              },
            })
          }
        }, 400)
      }

      if (cardToPlace.name.toLowerCase().includes("balin")) {
        setTimeout(() => {
          const top3 = playerField.deck.slice(0, Math.min(3, playerField.deck.length))
          if (top3.length === 0) return
          if (top3.length === 1) {
            showDrawAnimation(top3[0])
            setPlayerField((prev) => ({
              ...prev,
              hand: [...prev.hand, top3[0]],
              deck: prev.deck.slice(1),
            }))
            showEffectFeedback(`Vigília Eterna: ${top3[0].name} adicionada à mão!`, "success")
            return
          }
          setChoiceModal({
            visible: true,
            cardName: "Vigília Eterna — Escolha 1 carta",
            options: top3.map((c, i) => ({
              id: String(i),
              label: c.name,
              description: c.rarity + " · " + (c.category || c.type),
            })),
            onChoose: (optionId: string) => {
              setChoiceModal(null)
              const pickedIdx = Number(optionId)
              setPlayerField((prev) => {
                const deckWithout = prev.deck.slice(top3.length)
                const chosen = top3[pickedIdx]
                const toBottom = top3.filter((_, i) => i !== pickedIdx)
                showEffectFeedback(`Vigília Eterna: ${chosen.name} adicionada à mão!`, "success")
                showDrawAnimation(chosen)
                return {
                  ...prev,
                  hand: [...prev.hand, chosen],
                  deck: [...deckWithout, ...toBottom],
                }
              })
            },
          })
        }, 350)
      }

      // União da Grande Ordem check
      const cardNameLower = cardToPlace.name.toLowerCase()
      const isGreatOrderMember = cardNameLower.includes("fehnon") || cardNameLower.includes("morgana") || cardNameLower.includes("calem")
      const hasGrandeOrdem = playerField.functionZone.some(f => f && !f.isFaceDown && f.name === "A Grande Ordem")
      
      if (hasGrandeOrdem && isGreatOrderMember) {
         const searchedNames = ["fehnon", "morgana", "calem"].filter(m => !cardNameLower.includes(m))
         const searchOptions = playerField.deck.filter(c => searchedNames.some(m => c.name.toLowerCase().includes(m)))
         
         const uniqueOptions: { id: string, label: string, description: string }[] = []
         const seenNames = new Set()
         for (const c of searchOptions) {
            if (!seenNames.has(c.name)) {
               uniqueOptions.push({ id: c.id, label: c.name, description: `Adicionar ${c.name} à mão` })
               seenNames.add(c.name)
            }
         }
         
         if (uniqueOptions.length > 0) {
           setChoiceModal({
             visible: true,
             cardName: "A Grande Ordem (União)",
             options: [
               ...uniqueOptions,
               { id: "cancel", label: "Cancelar", description: "Não buscar nada" }
             ],
             onChoose: (optionId: string) => {
               setChoiceModal(null)
               if (optionId === "cancel") return
               
               setPlayerField(prev => {
                  const targetCardIndex = prev.deck.findIndex(c => c.id === optionId)
                  if (targetCardIndex === -1) return prev
                  
                  const cardToDraw = prev.deck[targetCardIndex]
                  const newDeck = [...prev.deck]
                  newDeck.splice(targetCardIndex, 1)
                  newDeck.sort(() => Math.random() - 0.5) // Shuffle
                  
                  setTimeout(() => showEffectFeedback(`A Grande Ordem: ${cardToDraw.name} adicionado à mão!`, "success"), 500)
                  return {
                    ...prev,
                    hand: [...prev.hand, cardToDraw],
                    deck: newDeck
                  }
               })
             }
           })
         }
      }
    } else if (zone === "function") {
      if (playerField.functionZone[slotIndex] !== null) return

      // Trap cards are placed face-down and not activated immediately
      if (cardToPlace.type === "trap") {
        setPlayerField((prev) => {
          const newFunctionZone = [...prev.functionZone]
          newFunctionZone[slotIndex] = { ...cardToPlace, isFaceDown: true }
          return {
            ...prev,
            functionZone: newFunctionZone,
            hand: prev.hand.filter((_, i) => i !== cardIndex),
          }
        })
        // ── Broadcast trap placement ──
        sendActionRef.current({
          type: "place_card", playerId,
          data: { zone: "function", index: slotIndex, card: cardToPlace, source: "hand", isTrap: true },
          timestamp: Date.now(),
        })
        setSelectedHandCard(null)
        setDraggedHandCard(null)
        return
      }

      // Special handling for Brotherhood Functions - they stay on field
      if (cardToPlace.name === "Alvorada de Albion" || cardToPlace.name === "A Grande Ordem") {
        setPlayerField((prev) => {
          const newFunctionZone = [...prev.functionZone]
          newFunctionZone[slotIndex] = { ...cardToPlace, isFaceDown: false }
          
          let newHand = prev.hand.filter((_, i) => i !== cardIndex)
          let newDeck = [...prev.deck]
          
          // Hora das Sombras: Draw a card when played
          if (cardToPlace.name === "Alvorada de Albion" && newDeck.length > 0) {
            const drawnCard = newDeck[0]
            newDeck = newDeck.slice(1)
            newHand.push(drawnCard)
            setTimeout(() => showEffectFeedback("Hora das Sombras: 1 carta comprada!", "success"), 500)
          }

          return {
            ...prev,
            functionZone: newFunctionZone,
            hand: newHand,
            deck: newDeck,
          }
        })
        // ── Broadcast brotherhood function placement ──
        sendActionRef.current({
          type: "place_card", playerId,
          data: { zone: "function", index: slotIndex, card: cardToPlace, source: "hand", isTrap: false },
          timestamp: Date.now(),
        })
        setSelectedHandCard(null)
        setDraggedHandCard(null)
        return
      }

      // Get the effect configuration for this card
      const effect = getFunctionCardEffect(cardToPlace)

      // Special handling for Function cards by name (backup)
      const isAmplificador = cardToPlace.name === "Amplificador de Poder"
      const isBandagem = cardToPlace.name === "Bandagem Restauradora"
      const isAdaga = cardToPlace.name === "Adaga Energizada"
      const isBandagensDuplas = cardToPlace.name === "Bandagens Duplas"
      const isCristalRecuperador = cardToPlace.name === "Cristal Recuperador"
      const isCaudaDeDragao = cardToPlace.name === "Cauda de Dragão Assada"
      const isProjetilDeImpacto = cardToPlace.name === "Projétil de Impacto"
      const isVeuDosLacos = cardToPlace.name === "Véu dos Laços Cruzados"
      const isNucleoExplosivo = cardToPlace.name === "Núcleo Explosivo"
      const isKitMedico = cardToPlace.name === "Kit Médico Improvisado"
      const isSoroRecuperador = cardToPlace.name === "Soro Recuperador"
      const isOrdemDeLaceracao = cardToPlace.name === "Ordem de Laceração"
      const isSinfoniaRelampago = cardToPlace.name === "Sinfonia Relâmpago"
      const isFafnisbani = cardToPlace.name === "Fafnisbani"
      const isDevorarOMundo = cardToPlace.name === "Devorar o Mundo"
      const isInvestidaCoordenada = cardToPlace.name === "Investida Coordenada"
      const isLacosDaOrdem = cardToPlace.name === "Laços da Ordem"
      const isEstrategiaReal = cardToPlace.name === "Estratégia Real"
      const isVentosDeCamelot = cardToPlace.name === "Ventos de Camelot"
      const isTrocaDeGuarda = cardToPlace.name === "Troca de Guarda"
      const isFlechaDeBalista = cardToPlace.name === "Flecha de Balista"
      const isPedraDeAfiar = cardToPlace.name === "Pedra de Afiar"
      const isDadosCalamidade = cardToPlace.name === "Dados da Calamidade"
      const isChamadoDaTavola = cardToPlace.name === "Chamado da Távola"

      if (effect || isAmplificador || isBandagem || isAdaga || isBandagensDuplas || isCristalRecuperador || isCaudaDeDragao || isProjetilDeImpacto || isVeuDosLacos || isNucleoExplosivo || isKitMedico || isSoroRecuperador || isOrdemDeLaceracao || isSinfoniaRelampago || isFafnisbani || isDevorarOMundo || isInvestidaCoordenada || isLacosDaOrdem || isEstrategiaReal || isVentosDeCamelot || isTrocaDeGuarda || isFlechaDeBalista || isPedraDeAfiar || isDadosCalamidade || isChamadoDaTavola) {
        // Use found effect or fallback to the correct one by name
        let effectToUse = effect
        if (!effectToUse) {
          if (isAmplificador) effectToUse = FUNCTION_CARD_EFFECTS["amplificador-de-poder"]
          else if (isBandagem) effectToUse = FUNCTION_CARD_EFFECTS["bandagem-restauradora"]
          else if (isAdaga) effectToUse = FUNCTION_CARD_EFFECTS["adaga-energizada"]
          else if (isBandagensDuplas) effectToUse = FUNCTION_CARD_EFFECTS["bandagens-duplas"]
          else if (isCristalRecuperador) effectToUse = FUNCTION_CARD_EFFECTS["cristal-recuperador"]
          else if (isCaudaDeDragao) effectToUse = FUNCTION_CARD_EFFECTS["cauda-de-dragao-assada"]
          else if (isProjetilDeImpacto) effectToUse = FUNCTION_CARD_EFFECTS["projetil-de-impacto"]
          else if (isVeuDosLacos) effectToUse = FUNCTION_CARD_EFFECTS["veu-dos-lacos-cruzados"]
          else if (isNucleoExplosivo) effectToUse = FUNCTION_CARD_EFFECTS["nucleo-explosivo"]
          else if (isKitMedico) effectToUse = FUNCTION_CARD_EFFECTS["kit-medico-improvisado"]
          else if (isSoroRecuperador) effectToUse = FUNCTION_CARD_EFFECTS["soro-recuperador"]
          else if (isOrdemDeLaceracao) effectToUse = FUNCTION_CARD_EFFECTS["ordem-de-laceracao"]
          else if (isSinfoniaRelampago) effectToUse = FUNCTION_CARD_EFFECTS["sinfonia-relampago"]
          else if (isFafnisbani) effectToUse = FUNCTION_CARD_EFFECTS["fafnisbani"]
          else if (isDevorarOMundo) effectToUse = FUNCTION_CARD_EFFECTS["devorar-o-mundo"]
          else if (isInvestidaCoordenada) effectToUse = FUNCTION_CARD_EFFECTS["investida-coordenada"]
          else if (isLacosDaOrdem) effectToUse = FUNCTION_CARD_EFFECTS["lacos-da-ordem"]
          else if (isEstrategiaReal) effectToUse = FUNCTION_CARD_EFFECTS["estrategia-real"]
          else if (isVentosDeCamelot) effectToUse = FUNCTION_CARD_EFFECTS["ventos-de-camelot"]
          else if (isTrocaDeGuarda) effectToUse = FUNCTION_CARD_EFFECTS["troca-de-guarda"]
          else if (isFlechaDeBalista) effectToUse = FUNCTION_CARD_EFFECTS["flecha-de-balista"]
          else if (isPedraDeAfiar) effectToUse = FUNCTION_CARD_EFFECTS["pedra-de-afiar"]
          else if (isDadosCalamidade) effectToUse = FUNCTION_CARD_EFFECTS["dados-da-calamidade"]
          else if (isChamadoDaTavola) effectToUse = FUNCTION_CARD_EFFECTS["chamado-da-tavola"]
        }

        if (!effectToUse) return // Safety check

        // Create effect context
        const effectContext: EffectContext = {
          playerField,
          enemyField,
          setPlayerField,
          setEnemyField,
        }

        // ── HROTTI LR: Tidal de Midgard — bloqueia habilidades/magias/armadilhas do oponente durante as primeiras 4 turnos ──
        // (This blocks enemy function card activations — handled in the bot executeBotTurn via _morganaLrBlock pattern)
        // For player's perspective: this has no direct UI block needed since bot is auto

        // ── REI ARTHUR SR 2DP: Soberania das Sombras — block healing cards while on field ──
        const _arthurSrOnField = enemyField.unitZone.some(u =>
          u && u.name.toLowerCase().includes("rei arthur") && u.dp === 2
        )
        const _healingCardIds = ["bandagem-restauradora","cristal-recuperador","kit-medico-improvisado","soro-recuperador","bandagens-duplas"]
        const _isHealingCard = _healingCardIds.some(id => effectToUse.id?.includes(id)) ||
          (cardToPlace.name.toLowerCase().includes("bandagem") || cardToPlace.name.toLowerCase().includes("cristal recuperador") ||
           cardToPlace.name.toLowerCase().includes("kit médico") || cardToPlace.name.toLowerCase().includes("soro recuperador"))
        if (_arthurSrOnField && _isHealingCard) {
          showEffectFeedback("SOBERANIA DAS SOMBRAS: Rei Arthur impede a ativação de cartas de Cura!", "error")
          return
        }

        // Check if card can be activated
        const { canActivate, reason } = effectToUse.canActivate(effectContext)
        if (!canActivate) {
          // Card cannot be activated - show feedback
          showEffectFeedback(`${cardToPlace.name}: ${reason}`, "error")
          return // Card cannot be played
        }

        // If effect requires a choice first, show choice modal
        if (effectToUse.requiresChoice && effectToUse.choiceOptions) {
          setChoiceModal({
            visible: true,
            cardName: cardToPlace.name,
            options: effectToUse.choiceOptions,
            onChoose: (optionId: string) => {
              setChoiceModal(null)

              // For Fafnisbani and Devorar o Mundo - if choosing LP, resolve immediately
              if (optionId === "lp") {
                const result = effectToUse.resolve(effectContext, { chosenOption: "lp" })
                if (result.success) {
                  showEffectFeedback(`${cardToPlace.name}: ${result.message}`, "success")
                  setPlayerField((prev) => ({
                    ...prev,
                    hand: prev.hand.filter((_, i) => i !== cardIndex),
                    graveyard: [...prev.graveyard, cardToPlace],
                  }))
                } else {
                  showEffectFeedback(`${cardToPlace.name}: ${result.message || "Falha"}`, "error")
                }
                setSelectedHandCard(null)
                setDraggedHandCard(null)
                return
              }

              // Now enter target selection mode with the chosen option
              const step = optionId === "buff" ? "selectAlly" : "selectEnemy"
              setItemSelectionMode({
                active: true,
                itemCard: cardToPlace,
                step: step,
                selectedEnemyIndex: null,
                chosenOption: optionId,
              })
              setPlayerField((prev) => ({
                ...prev,
                hand: prev.hand.filter((_, i) => i !== cardIndex),
              }))
              setSelectedHandCard(null)
              setDraggedHandCard(null)
            },
          })
          return
        }

        // FLECHA DE BALISTA: direct enemy unit selection, bypasses requiresTargets system entirely
        if (cardToPlace.name === "Flecha de Balista") {
          const hasEnemyUnits = enemyField.unitZone.some((u) => u !== null)
          if (!hasEnemyUnits) {
            showEffectFeedback("Flecha de Balista: O oponente não tem Unidades no campo!", "error")
            return
          }
          // Remove from hand, enter enemy selection mode
          setPlayerField((prev) => ({
            ...prev,
            hand: prev.hand.filter((_, i) => i !== cardIndex),
          }))
          setSelectedHandCard(null)
          setDraggedHandCard(null)
          setItemSelectionMode({
            active: true,
            itemCard: cardToPlace,
            step: "selectEnemy",
            selectedEnemyIndex: null,
            chosenOption: "flecha_direct", // flag to identify this card in handleEnemyUnitSelect
          })
          return
        }

        // If effect requires targets, enter selection mode
        if (effectToUse.requiresTargets && effectToUse.targetConfig) {
          // Determine the correct step based on target config
          // If only needs ally units (like dice cards), go straight to selectAlly
          const needsEnemyFirst = effectToUse.targetConfig.enemyUnits && effectToUse.targetConfig.enemyUnits > 0
          const initialStep = needsEnemyFirst ? "selectEnemy" : "selectAlly"

          setItemSelectionMode({
            active: true,
            itemCard: cardToPlace,
            step: initialStep,
            selectedEnemyIndex: null,
            chosenOption: null,
          })
          setPlayerField((prev) => ({
            ...prev,
            hand: prev.hand.filter((_, i) => i !== cardIndex),
          }))
          setSelectedHandCard(null)
          setDraggedHandCard(null)
          return
        }

        // Effect doesn't require targets - resolve immediately
        const result = effectToUse.resolve(effectContext)
        if (result.success) {
          if (result.message === "PEDRA_AFIAR_SEARCH") {
            // Collect all Ultimate Gear cards in the player's deck
            const ugCardsInDeck = playerField.deck.filter((c) => c.type === "ultimateGear")
            if (ugCardsInDeck.length === 0) {
              showEffectFeedback("Nenhuma Ultimate Gear no Deck!", "error")
              return
            }
            // Remove card from hand now
            setPlayerField((prev) => ({
              ...prev,
              hand: prev.hand.filter((_, i) => i !== cardIndex),
              graveyard: [...prev.graveyard, cardToPlace],
            }))
            setSelectedHandCard(null)
            setDraggedHandCard(null)
            // Open search modal
            setDeckSearchModal({
              visible: true,
              title: "Pedra de Afiar — Escolha uma Ultimate Gear",
              cards: ugCardsInDeck,
              onSelect: (chosenCard) => {
                setDeckSearchModal(null)
                setPlayerField((prev) => {
                  const newDeck = prev.deck.filter((c) => c.id !== chosenCard.id)
                  // Shuffle deck
                  for (let i = newDeck.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]]
                  }
                  return { ...prev, hand: [...prev.hand, chosenCard], deck: newDeck }
                })
                showEffectFeedback(`Pedra de Afiar! ${chosenCard.name} adicionada à mão! Deck embaralhado.`, "success")
              },
              onCancel: () => setDeckSearchModal(null),
            })
            return
          }

          // Show visual feedback
          showEffectFeedback(`${cardToPlace.name}: ${result.message}`, "success")

          // ORDEM DE LACERAÇÃO: trigger slash animation
          if (cardToPlace.name === "Ordem de Laceração") {
            setLacerationAnimation(true)
            setTimeout(() => setLacerationAnimation(false), 1800)
          }
          if (cardToPlace.name === "Sinfonia Relâmpago") {
            setSinfoniaAnimation(true)
            setTimeout(() => setSinfoniaAnimation(false), 1500)
          }

          // Special handling for Cristal Recuperador - draw a card and check if Function type
          if (result.needsDrawAndCheck) {
            setTimeout(() => {
              setPlayerField((prev) => {
                if (prev.deck.length === 0) {
                  showEffectFeedback("Deck vazio - nao pode comprar carta", "error")
                  return {
                    ...prev,
                    hand: prev.hand.filter((_, i) => i !== cardIndex),
                    graveyard: [...prev.graveyard, cardToPlace],
                  }
                }

                const drawnCard = prev.deck[0]
                const newDeck = prev.deck.slice(1)
                const newHand = [...prev.hand.filter((_, i) => i !== cardIndex), drawnCard]

                // Check if drawn card is a Function type (item)
                const isFunctionCard = drawnCard.type === "item"
                let finalLife = result.currentLife || prev.life

                if (isFunctionCard) {
                  const maxLife = 20
                  const bonusHeal = Math.min(1, maxLife - finalLife)
                  finalLife = Math.min(finalLife + bonusHeal, maxLife)
                  if (bonusHeal > 0) {
                    showEffectFeedback(`Carta Function comprada! +1 LP bonus! (${finalLife - 1} -> ${finalLife})`, "success")
                  }
                } else {
                  showEffectFeedback(`Comprou: ${drawnCard.name}`, "success")
                }

                return {
                  ...prev,
                  deck: newDeck,
                  hand: newHand,
                  graveyard: [...prev.graveyard, cardToPlace],
                  life: finalLife,
                }
              })
            }, 500) // Small delay for visual feedback

            setSelectedHandCard(null)
            setDraggedHandCard(null)
            return
          }

          // Special handling for Kit Médico Improvisado - draw and check if Unit type for bonus
          if (result.needsDrawAndCheckUnit) {
            setTimeout(() => {
              setPlayerField((prev) => {
                if (prev.deck.length === 0) {
                  showEffectFeedback("Deck vazio - nao pode comprar carta", "error")
                  return {
                    ...prev,
                    hand: prev.hand.filter((_, i) => i !== cardIndex),
                    graveyard: [...prev.graveyard, cardToPlace],
                  }
                }

                const drawnCard = prev.deck[0]
                const newDeck = prev.deck.slice(1)
                const newHand = [...prev.hand.filter((_, i) => i !== cardIndex), drawnCard]

                // Check if drawn card is a Unit type
                const isUnitCard = drawnCard.type === "unit"
                let finalLife = result.currentLife || prev.life

                if (isUnitCard) {
                  const maxLife = 20
                  const bonusHeal = Math.min(1, maxLife - finalLife)
                  finalLife = Math.min(finalLife + bonusHeal, maxLife)
                  if (bonusHeal > 0) {
                    showEffectFeedback(`Carta Unidade comprada! +1 LP bonus! (${finalLife - 1} -> ${finalLife})`, "success")
                  }
                } else {
                  showEffectFeedback(`Comprou: ${drawnCard.name}`, "success")
                }

                return {
                  ...prev,
                  deck: newDeck,
                  hand: newHand,
                  graveyard: [...prev.graveyard, cardToPlace],
                  life: finalLife,
                }
              })
            }, 500)

            setSelectedHandCard(null)
            setDraggedHandCard(null)
            return
          }

          // Special handling for Soro Recuperador - just draw, no bonus check
          if (result.needsDrawOnly) {
            setTimeout(() => {
              setPlayerField((prev) => {
                if (prev.deck.length === 0) {
                  showEffectFeedback("Deck vazio - nao pode comprar carta", "error")
                  return {
                    ...prev,
                    hand: prev.hand.filter((_, i) => i !== cardIndex),
                    graveyard: [...prev.graveyard, cardToPlace],
                  }
                }

                const drawnCard = prev.deck[0]
                const newDeck = prev.deck.slice(1)
                const newHand = [...prev.hand.filter((_, i) => i !== cardIndex), drawnCard]

                showEffectFeedback(`Comprou: ${drawnCard.name}`, "success")

                return {
                  ...prev,
                  deck: newDeck,
                  hand: newHand,
                  graveyard: [...prev.graveyard, cardToPlace],
                }
              })
            }, 500)

            setSelectedHandCard(null)
            setDraggedHandCard(null)
            return
          }

          // Send card to graveyard after resolution
          setPlayerField((prev) => ({
            ...prev,
            hand: prev.hand.filter((_, i) => i !== cardIndex),
            graveyard: [...prev.graveyard, cardToPlace],
          }))
          // ── Broadcast function card use ──
          sendActionRef.current({
            type: "use_function_card", playerId,
            data: { card: cardToPlace, source: "hand" },
            timestamp: Date.now(),
          })
          setSelectedHandCard(null)
          setDraggedHandCard(null)
          return
        } else {
          showEffectFeedback(`${cardToPlace.name}: ${result.message || "Falha ao ativar"}`, "error")
        }
      }

      // Fallback: place card in function zone without effect
      setPlayerField((prev) => {
        const newFunctionZone = [...prev.functionZone]
        newFunctionZone[slotIndex] = cardToPlace
        return {
          ...prev,
          functionZone: newFunctionZone,
          hand: prev.hand.filter((_, i) => i !== cardIndex),
        }
      })
      sendActionRef.current({
        type: "place_card", playerId,
        data: { zone: "function", index: slotIndex, card: cardToPlace, source: "hand", isTrap: false },
        timestamp: Date.now(),
      })
    }

    setSelectedHandCard(null) // Clear selection if using drag-drop
    setDraggedHandCard(null) // Clear drag state
  }

  const placeScenarioCard = (forcedCardIndex?: number) => {
    if (!isMyTurn) return
    if (phase !== "main") return

    const cardIndex = forcedCardIndex ?? (draggedHandCard?.index ?? selectedHandCard)
    if (cardIndex === null || cardIndex === undefined) return

    const cardToPlace = playerField.hand[cardIndex]
    if (!cardToPlace || cardToPlace.type !== "scenario") return
    if (playerField.scenarioZone !== null) return

    setPlayerField((prev) => {
      const newHand = prev.hand.filter((_, i) => i !== cardIndex)
      let newDeck = prev.deck
      let finalScenarioZone = cardToPlace

      // Ruinas Abandonadas and Arena Escandinava: Draw 1 card when played
      if (cardToPlace.ability === "RUÍNAS ABANDONADAS" || cardToPlace.ability === "ARENA ESCANDINAVA") {
        if (newDeck.length > 0) {
          const drawn = newDeck[0]
          newDeck = newDeck.slice(1)
          newHand.push(drawn)
          setTimeout(() => {
            showDrawAnimation(drawn)
            showEffectFeedback(`${cardToPlace.name}: Comprou 1 carta!`, "success")
          }, 300)
        }
      }

      // Prepare updated zones with scenario buffs
      const updatedPlayerUnitZone = prev.unitZone.map(u => {
        if (!u) return null
        return { ...u, currentDp: calculateCardDP(u, prev, false) }
      })

      // Also update enemy units if scenario provides debuffs/buffs
      setEnemyField(enemyPrev => ({
        ...enemyPrev,
        unitZone: enemyPrev.unitZone.map(u => {
          if (!u) return null
          return { ...u, currentDp: calculateCardDP(u, enemyPrev, true) }
        })
      }))

      if (cardToPlace.ability === "REINO DE CAMELOT" || cardToPlace.ability === "VILA DA PÓLVORA") {
        setTimeout(() => showEffectFeedback(`${cardToPlace.name} ativado! O campo mudou!`, "success"), 500)
      }

      return {
        ...prev,
        scenarioZone: finalScenarioZone,
        hand: newHand,
        deck: newDeck,
        unitZone: updatedPlayerUnitZone,
      }
    })

    // ── Broadcast scenario placement ──
    sendActionRef.current({
      type: "place_card", playerId,
      data: { zone: "scenario", card: cardToPlace, source: "hand" },
      timestamp: Date.now(),
    })
    setSelectedHandCard(null)
    setDraggedHandCard(null)
  }

  // Helper: find index of a unit by name in a unit zone
  const findUnitByName = (unitZone: (FieldCard | null)[], unitName: string): number => {
    return unitZone.findIndex((u) => u && u.name === unitName)
  }

  // Helper: count fire element units in graveyard + field (already used)
  const countFireUnitsUsed = (field: FieldState): number => {
    let count = 0
    // Graveyard fire units
    count += field.graveyard.filter((c) => c.element === "Pyrus" && (c.type === "unit" || c.type === "ultimateGear" || c.type === "ultimateGuardian" || c.type === "ultimateElemental")).length
    // Field fire units currently in play
    field.unitZone.forEach((u) => { if (u && u.element === "Pyrus") count++ })
    return count
  }

  const placeUltimateCard = (forcedCardIndex?: number) => {
    if (!isMyTurn) return
    if (phase !== "main") return

    const cardIndex = forcedCardIndex ?? (draggedHandCard?.index ?? selectedHandCard)
    if (cardIndex === null || cardIndex === undefined) return

    const cardToPlace = playerField.hand[cardIndex]
    if (!cardToPlace || !isUltimateCard(cardToPlace)) return
    if (playerField.ultimateZone !== null) return

    const fieldCard: FieldCard = {
      ...cardToPlace,
      currentDp: cardToPlace.dp,
      canAttack: false,
      hasAttacked: false,
      canAttackTurn: turn,
    }

    setPlayerField((prev) => {
      const newHand = prev.hand.filter((_, i) => i !== cardIndex)
      const requiredUnit = cardToPlace.requiresUnit
      const unitIdx = requiredUnit ? findUnitByName(prev.unitZone, requiredUnit) : -1
      const unitFound = unitIdx !== -1

      // Apply passive DP bonus to the matching unit if found
      let newUnitZone = [...prev.unitZone]
      let bonusMsg = ""

      if (unitFound && requiredUnit) {
        const unit = newUnitZone[unitIdx]!
        const ability = cardToPlace.ability

        if (ability === "ODEN SWORD") {
          // +4 DP to Fehnon
          newUnitZone[unitIdx] = { ...unit, currentDp: unit.currentDp + 4 }
          bonusMsg = `${requiredUnit} +4 DP!`
        } else if (ability === "PROTONIX SWORD") {
          // +2 DP to Fehnon
          newUnitZone[unitIdx] = { ...unit, currentDp: unit.currentDp + 2 }
          bonusMsg = `${requiredUnit} +2 DP!`
        } else if (ability === "TWILIGH AVALON") {
          // +2 DP to Morgana
          newUnitZone[unitIdx] = { ...unit, currentDp: unit.currentDp + 2 }
          bonusMsg = `${requiredUnit} +2 DP!`
        } else if (ability === "ULLRBOGI") {
          // +3 DP only during battle phase - applied separately, no immediate bonus
          bonusMsg = `${requiredUnit} recebera +3 DP nas fases de batalha!`
        } else if (ability === "FORNBRENNA") {
          // Count fire units used so far
          const fireCount = countFireUnitsUsed(prev)
          const bonus = fireCount * 2
          if (bonus > 0) {
            newUnitZone[unitIdx] = { ...unit, currentDp: unit.currentDp + bonus }
          }
          setFornbrennaFireCount(fireCount)
          bonusMsg = `${requiredUnit} +${bonus} DP! (${fireCount} unidades de fogo usadas)`
        } else if (ability === "MIGUEL ARCANJO") {
          // +4 DP to Calem Hidenori
          newUnitZone[unitIdx] = { ...unit, currentDp: unit.currentDp + 4 }
          bonusMsg = `${requiredUnit} +4 DP! Protecao de Funcoes ativada! (Miguel Arcanjo)`
        } else if (ability === "MEFISTO") {
          // +2 DP to Rei Arthur
          newUnitZone[unitIdx] = { ...unit, currentDp: unit.currentDp + 2 }
          bonusMsg = `${requiredUnit} +2 DP! (Mefisto Foles)`
        }
      }

      if (bonusMsg) {
        setTimeout(() => showEffectFeedback(bonusMsg, "success"), 300)
      } else if (requiredUnit && !unitFound) {
        setTimeout(() => showEffectFeedback(`${cardToPlace.name} equipada! Coloque ${requiredUnit} no campo para ativar.`, "success"), 300)
      }

      return {
        ...prev,
        ultimateZone: fieldCard,
        unitZone: newUnitZone as (FieldCard | null)[],
        hand: newHand,
      }
    })

    // ── Broadcast ultimate placement ──
    sendActionRef.current({
      type: "place_card", playerId,
      data: { zone: "ultimate", card: cardToPlace, source: "hand" },
      timestamp: Date.now(),
    })
    // Reset one-time ability flag for a new UG
    setPlayerUgAbilityUsed(false)
    setSelectedHandCard(null)
    setDraggedHandCard(null)
  }

  // Activate Ultimate Gear one-time ability
  const activateUgAbility = () => {
    if (!isMyTurn || phase !== "main") return
    if (playerUgAbilityUsed) return
    if (!playerField.ultimateZone) return

    const ug = playerField.ultimateZone
    const requiredUnit = ug.requiresUnit
    if (!requiredUnit) return

    // Check if the required unit is on the field
    const unitIdx = findUnitByName(playerField.unitZone, requiredUnit)
    if (unitIdx === -1) {
      showEffectFeedback(`${requiredUnit} precisa estar no campo!`, "error")
      return
    }

    if (ug.ability === "ODEN SWORD") {
      // Check if opponent has function cards
      const hasEnemyFunctions = enemyField.functionZone.some((f) => f !== null)
      if (!hasEnemyFunctions) {
        showEffectFeedback("Oponente nao tem cartas de Function no campo!", "error")
        return
      }
      setUgTargetMode({ active: true, ugCard: ug, type: "oden_sword" })
      showEffectFeedback("Selecione uma Function inimiga para destruir!", "success")
    } else if (ug.ability === "TWILIGH AVALON") {
      // Check if opponent has any cards on field (units or functions)
      const hasEnemyCards = enemyField.unitZone.some((u) => u !== null) || enemyField.functionZone.some((f) => f !== null)
      if (!hasEnemyCards) {
        showEffectFeedback("Oponente nao tem cartas no campo!", "error")
        return
      }
      setUgTargetMode({ active: true, ugCard: ug, type: "twiligh_avalon" })
      showEffectFeedback("Selecione uma carta inimiga para devolver a mao!", "success")
    } else if (ug.ability === "MEFISTO") {
      // Once per duel: destroy any 1 card on opponent's field
      if (playerUgAbilityUsed) return
      const hasEnemyCards = enemyField.unitZone.some((u) => u !== null) || enemyField.functionZone.some((f) => f !== null)
      if (!hasEnemyCards) {
        showEffectFeedback("Oponente nao tem cartas no campo!", "error")
        return
      }
      setUgTargetMode({ active: true, ugCard: ug, type: "mefisto" })
      showEffectFeedback("MEFISTO FOLES: Selecione 1 carta inimiga para destruir!", "success")
    } else if (ug.ability === "MIGUEL ARCANJO") {
      // Julgamento Divino: once per turn, select enemy unit and reduce -1DP
      if (julgamentoDivinoUsedThisTurn) {
        showEffectFeedback("Julgamento Divino ja foi usado neste turno!", "error")
        return
      }
      const hasEnemyUnits = enemyField.unitZone.some((u) => u !== null)
      if (!hasEnemyUnits) {
        showEffectFeedback("Oponente nao tem Unidades no campo!", "error")
        return
      }
      setUgTargetMode({ active: true, ugCard: ug, type: "julgamento_divino" })
      showEffectFeedback("JULGAMENTO DIVINO: Selecione uma Unidade inimiga para -1DP!", "success")
    }
  }

  // Handle UG target selection for enemy function cards (ODEN SWORD / MEFISTO)
  const handleUgTargetEnemyFunction = (funcIndex: number) => {
    if (!ugTargetMode.active) return
    const funcCard = enemyField.functionZone[funcIndex]
    if (!funcCard) return

    if (ugTargetMode.type === "oden_sword" || ugTargetMode.type === "mefisto") {
      markDestroyed(funcCard)
      setEnemyField((prev) => {
        const newFuncs = [...prev.functionZone]
        const destroyed = newFuncs[funcIndex]
        newFuncs[funcIndex] = null
        return {
          ...prev,
          functionZone: newFuncs,
          graveyard: destroyed ? [...prev.graveyard, destroyed] : prev.graveyard,
        }
      })
      const label = ugTargetMode.type === "mefisto" ? "MEFISTO FOLES" : "ODEN SWORD"
      showEffectFeedback(`${label}: ${funcCard.name} destruida!`, "success")
      setPlayerUgAbilityUsed(true)
      setUgTargetMode({ active: false, ugCard: null, type: null })
    }
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

    const card = playerField.tap[cardIndex]
    if (!card) return

    // Check space
    if (zone === "unit" && playerField.unitZone[targetIndex!] !== null) return
    if (zone === "function" && playerField.functionZone[targetIndex!] !== null) return
    if (zone === "scenario" && playerField.scenarioZone !== null) return
    if (zone === "ultimate" && playerField.ultimateZone !== null) return

    setPlayerField((prev) => {
      const newTap = prev.tap.filter((_, i) => i !== cardIndex)

      if (zone === "unit") {
        const newUnitZone = [...prev.unitZone]
        newUnitZone[targetIndex!] = {
          ...card,
          currentDp: card.dp,
          canAttack: false,
          hasAttacked: false,
          canAttackTurn: turn,
        }
        return { ...prev, unitZone: newUnitZone, tap: newTap }
      } else if (zone === "function") {
        const newFunctionZone = [...prev.functionZone]
        const isTrap = card.type === "trap"
        newFunctionZone[targetIndex!] = {
          ...card,
          isFaceDown: isTrap,
        } as FunctionZoneCard
        return { ...prev, functionZone: newFunctionZone, tap: newTap }
      } else if (zone === "scenario") {
        return { ...prev, scenarioZone: card, tap: newTap }
      } else if (zone === "ultimate") {
        return {
          ...prev,
          ultimateZone: {
            ...card,
            currentDp: card.dp,
            canAttack: false,
            hasAttacked: false,
            canAttackTurn: turn,
          },
          tap: newTap,
        }
      }
      return prev
    })

    setTapView(null)
  }

  // Handle UG target selection for any enemy card (TWILIGH AVALON / MEFISTO)
  const handleUgTargetEnemyCard = (type: "unit" | "function", index: number) => {
    if (!ugTargetMode.active) return

    if (ugTargetMode.type === "twiligh_avalon") {
      if (type === "unit") {
        const unit = enemyField.unitZone[index]
        if (!unit) return

        setEnemyField((prev) => {
          const newUnits = [...prev.unitZone]
          const returned = newUnits[index]
          newUnits[index] = null
          return {
            ...prev,
            unitZone: newUnits as (FieldCard | null)[],
            hand: returned ? [...prev.hand, returned] : prev.hand,
          }
        })
        // If returned card is a unit, deal 3 DP to opponent
        setEnemyField((prev) => ({
          ...prev,
          life: Math.max(0, prev.life - 3),
        }))
        showEffectFeedback(`TWILIGH AVALON: ${unit.name} devolvida! -3 LP no oponente!`, "success")
      } else {
        const func = enemyField.functionZone[index]
        if (!func) return

        setEnemyField((prev) => {
          const newFuncs = [...prev.functionZone]
          const returned = newFuncs[index]
          newFuncs[index] = null
          return {
            ...prev,
            functionZone: newFuncs,
            hand: returned ? [...prev.hand, returned] : prev.hand,
          }
        })
        showEffectFeedback(`TWILIGH AVALON: ${func.name} devolvida a mao!`, "success")
      }
      setPlayerUgAbilityUsed(true)
      setUgTargetMode({ active: false, ugCard: null, type: null })
    } else if (ugTargetMode.type === "mefisto") {
      // MEFISTO: destroy any card on opponent's field
      if (type === "unit") {
        const unit = enemyField.unitZone[index]
        if (!unit) return
        markDestroyed(unit)
        setEnemyField((prev) => {
          const newUnits = [...prev.unitZone]
          const destroyed = newUnits[index]
          newUnits[index] = null
          return {
            ...prev,
            unitZone: newUnits as (FieldCard | null)[],
            graveyard: destroyed ? [...prev.graveyard, destroyed] : prev.graveyard,
          }
        })
        showEffectFeedback(`MEFISTO FOLES: ${unit.name} destruida!`, "success")
      } else {
        const func = enemyField.functionZone[index]
        if (!func) return
        markDestroyed(func)
        setEnemyField((prev) => {
          const newFuncs = [...prev.functionZone]
          const destroyed = newFuncs[index]
          newFuncs[index] = null
          return {
            ...prev,
            functionZone: newFuncs,
            graveyard: destroyed ? [...prev.graveyard, destroyed] : prev.graveyard,
          }
        })
        showEffectFeedback(`MEFISTO FOLES: ${func.name} destruida!`, "success")
      }
      setPlayerUgAbilityUsed(true)
      setUgTargetMode({ active: false, ugCard: null, type: null })
    }
  }

  // Handle JULGAMENTO DIVINO: select enemy unit and reduce -1DP
  const handleJulgamentoDivinoTarget = (unitIndex: number) => {
    if (!ugTargetMode.active || ugTargetMode.type !== "julgamento_divino") return
    const unit = enemyField.unitZone[unitIndex]
    if (!unit) return

    setEnemyField((prev) => {
      const newUnits = [...prev.unitZone]
      const target = newUnits[unitIndex]
      if (!target) return prev
      const newDp = target.currentDp - 1
      if (newDp <= 0) {
        markDestroyed(target)
        newUnits[unitIndex] = null
        showEffectFeedback(`JULGAMENTO DIVINO: ${target.name} destruido! (0 DP)`, "success")
        return {
          ...prev,
          unitZone: newUnits as (FieldCard | null)[],
          graveyard: [...prev.graveyard, target],
        }
      }
      newUnits[unitIndex] = { ...target, currentDp: newDp }
      showEffectFeedback(`JULGAMENTO DIVINO: ${target.name} -1 DP! (${newDp} DP restante)`, "success")
      return { ...prev, unitZone: newUnits as (FieldCard | null)[] }
    })

    setJulgamentoDivinoUsedThisTurn(true)
    setUgTargetMode({ active: false, ugCard: null, type: null })
  }

  // CALEM LR: Julgamento do Vazio Eterno - destroy selected enemy unit or function
  const handleJulgamentoVazioTarget = (type: "unit" | "function", index: number) => {
    if (!julgamentoVazioTargetMode.active) return

    const attackerIdx = julgamentoVazioTargetMode.attackerIndex

    if (type === "unit") {
      const target = enemyField.unitZone[index]
      if (!target) return
      markDestroyed(target)
      setEnemyField((prev) => {
        const newUnits = [...prev.unitZone]
        newUnits[index] = null
        return { ...prev, unitZone: newUnits as (FieldCard | null)[], graveyard: [...prev.graveyard, target] }
      })
      showEffectFeedback(`JULGAMENTO DO VAZIO ETERNO: ${target.name} destruído!`, "success")
    } else {
      const target = enemyField.functionZone[index]
      if (!target) return
      markDestroyed(target)
      setEnemyField((prev) => {
        const newFunctions = [...prev.functionZone]
        newFunctions[index] = null
        return { ...prev, functionZone: newFunctions, graveyard: [...prev.graveyard, target] }
      })
      showEffectFeedback(`JULGAMENTO DO VAZIO ETERNO: ${target.name} destruído!`, "success")
    }

    // Mark attacker as having attacked and fully reset attack arrow/drag state
    if (attackerIdx !== null) {
      setPlayerField((prev) => {
        const newUnitZone = [...prev.unitZone]
        if (newUnitZone[attackerIdx]) {
          newUnitZone[attackerIdx] = { ...newUnitZone[attackerIdx]!, hasAttacked: true }
        }
        return { ...prev, unitZone: newUnitZone }
      })
    }
    setJulgamentoVazioTargetMode({ active: false, attackerIndex: null })
    setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
    isDraggingRef.current = false
    animationInProgressRef.current = false
  }

  // Cancel UG target mode
  const cancelUgTargetMode = () => {
    setUgTargetMode({ active: false, ugCard: null, type: null })
  }

  const advancePhase = () => {
    if (!isMyTurn) return
    if (phase === "draw") {
      // Compra uma carta automaticamente ao sair da fase de draw
      if (playerField.deck.length > 0) {
        const drawnCard = playerField.deck[0]
        showDrawAnimation(drawnCard)
        setPlayerField((prev) => ({
          ...prev,
          hand: [...prev.hand, drawnCard],
          deck: prev.deck.slice(1),
        }))
      }
      setPhase("main")
    } else if (phase === "main") {
      // ULLRBOGI: +3 DP to Ullr when entering battle phase
      if (playerField.ultimateZone && playerField.ultimateZone.ability === "ULLRBOGI" && playerField.ultimateZone.requiresUnit) {
        const ullrIdx = findUnitByName(playerField.unitZone, playerField.ultimateZone.requiresUnit)
        if (ullrIdx !== -1) {
          setPlayerField((prev) => {
            const newUnits = [...prev.unitZone]
            const unit = newUnits[ullrIdx]
            if (unit) {
              newUnits[ullrIdx] = { ...unit, currentDp: unit.currentDp + 3 }
              showEffectFeedback(`ULLRBOGI: ${unit.name} +3 DP na fase de batalha!`, "success")
            }
            return { ...prev, unitZone: newUnits as (FieldCard | null)[] }
          })
        }
      }
      setPhase("battle")
    } else if (phase === "battle") {
      endTurn()
    }
  }

  const handleAttackStart = useCallback(
    (index: number, e: React.MouseEvent | React.TouchEvent) => {
      if (!isMyTurn || phase !== "battle") return

      const unit = playerField.unitZone[index]
      if (!unit || unit.hasAttacked) return
      if (turn <= unit.canAttackTurn) return

      e.preventDefault()
      e.stopPropagation()

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

      isDraggingRef.current = true
      positionRef.current = {
        startX: clientX,
        startY: clientY,
        currentX: clientX,
        currentY: clientY,
        lastTargetCheck: 0,
      }

      cacheEnemyRects()

      setArrowPos({ x1: clientX, y1: clientY, x2: clientX, y2: clientY })
      setAttackState({
        isAttacking: true,
        attackerIndex: index,
        targetInfo: null,
      })
    },
    [isMyTurn, phase, playerField.unitZone, cacheEnemyRects, turn],
  )

  const handleAttackMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDraggingRef.current || !attackState.isAttacking) return

      e.preventDefault()

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

      // Direct state update for immediate response
      setArrowPos((prev) => ({ ...prev, x2: clientX, y2: clientY }))

      // Throttled target detection
      const now = Date.now()
      if (!positionRef.current.lastTargetCheck || now - positionRef.current.lastTargetCheck > 50) {
        positionRef.current.lastTargetCheck = now

        const fieldRect = fieldRef.current?.getBoundingClientRect()
        if (!fieldRect) return

        const relativeY = clientY - fieldRect.top
        let foundTarget: { type: "unit" | "direct"; index?: number } | null = null

        // Check upper half for enemy units
        if (relativeY < fieldRect.height / 2) {
          for (let idx = 0; idx < enemyUnitRectsRef.current.length; idx++) {
            const rect = enemyUnitRectsRef.current[idx]
            if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
              if (enemyField.unitZone[idx]) {
                foundTarget = { type: "unit", index: idx }
                break
              }
            }
          }
          // Check for direct attack if no units
          if (!foundTarget) {
            const hasEnemyUnits = enemyField.unitZone.some((u) => u !== null)
            if (!hasEnemyUnits) {
              foundTarget = { type: "direct" }
            }
          }
        }

        setAttackState((prev) => ({ ...prev, targetInfo: foundTarget }))
      }
    },
    [attackState.isAttacking, enemyField.unitZone, setAttackState],
  )

  const handleAttackEnd = useCallback(() => {
    if (!isDraggingRef.current || animationInProgressRef.current) return
    isDraggingRef.current = false
    animationInProgressRef.current = true
    attackIdRef.current++
    const currentAttackId = attackIdRef.current

    if (attackState.isAttacking && attackState.attackerIndex !== null && attackState.targetInfo) {
      const attacker = playerField.unitZone[attackState.attackerIndex]
      if (attacker) {

        // ── FEHNON SR 2DP: Laceração — compra 1 carta ao atacar; se Unidade → ataca novamente ──
        if (attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 2) {
          const drawn = playerField.deck[0]
          if (drawn) {
            const isUnit = ["unit","troops","ultimateGuardian","ultimateElemental"].includes(drawn.type)
            setPlayerField((prev) => ({ ...prev, deck: prev.deck.slice(1), hand: [...prev.hand, drawn] }))
            showDrawAnimation(drawn)
            if (isUnit) {
              setFehnonSrDouble(true)
              showEffectFeedback("LACERAÇÃO: Carta Unidade! Fehnon pode atacar novamente!", "success")
            } else {
              showEffectFeedback("LACERAÇÃO: Carta comprada!", "info")
            }
          }
        }

        // ── FEHNON UR 3DP: Ordem de Laceração — compra 1 carta ao atacar; se Unidade → ataca novamente (traps ignorados) ──
        // Singularidade Zero: pode realizar até 2 ataques por batalha SE equipado com Protonix Sword
        if (attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 3) {
          const drawn = playerField.deck[0]
          if (drawn) {
            const isUnit = ["unit","troops","ultimateGuardian","ultimateElemental"].includes(drawn.type)
            setPlayerField((prev) => ({ ...prev, deck: prev.deck.slice(1), hand: [...prev.hand, drawn] }))
            showDrawAnimation(drawn)
            // Only grant double attack if Protonix Sword is equipped (Singularidade Zero condition)
            const hasProtonixSword =
              playerField.ultimateZone?.ability === "PROTONIX SWORD" &&
              playerField.ultimateZone?.requiresUnit?.toLowerCase().includes("fehnon")
            if (isUnit && !fehnonUrUsedDoubleThisTurn && hasProtonixSword) {
              setFehnonUrDouble(true)
              showEffectFeedback("ORDEM DE LACERAÇÃO: Carta Unidade + Protonix Sword! Fehnon ataca novamente (traps ignorados)!", "success")
            } else if (isUnit && !fehnonUrUsedDoubleThisTurn && !hasProtonixSword) {
              // Without Protonix Sword, still draw but no second attack
              showEffectFeedback("ORDEM DE LACERAÇÃO: Carta Unidade comprada! (Precisa de Protonix Sword para atacar novamente)", "info")
            } else {
              showEffectFeedback("ORDEM DE LACERAÇÃO: Carta comprada!", "info")
            }
          }
        }

        // ── FEHNON LR 4DP: Laceração do Mundo — compra 1 carta ao atacar
        // Requer ODEN SWORD: se Unidade ou Action Function → +3DP + ataca novamente ──
        if (attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 4) {
          const drawn = playerField.deck[0]
          if (drawn) {
            // "Unit or Action Function" = unit, troops, ultimates, or function cards
            const isUnitOrAction = ["unit","troops","ultimateGuardian","ultimateElemental","function","action"].includes(drawn.type)
            setPlayerField((prev) => ({ ...prev, deck: prev.deck.slice(1), hand: [...prev.hand, drawn] }))
            showDrawAnimation(drawn)
            // Check ODEN SWORD is equipped on Fehnon LR (Laceração do Mundo requirement)
            const hasOdenSword =
              playerField.ultimateZone?.ability === "ODEN SWORD" &&
              playerField.ultimateZone?.requiresUnit?.toLowerCase().includes("fehnon")
            if (isUnitOrAction && hasOdenSword) {
              setFehnonLrDouble(true)
              setFehnonLrBonusDp(3)
              setPlayerField((prev) => {
                const newUnitZone = [...prev.unitZone]
                const idx = attackState.attackerIndex!
                if (newUnitZone[idx]) {
                  const cur = newUnitZone[idx]!
                  newUnitZone[idx] = { ...cur, currentDp: (cur.currentDp || cur.dp) + 3 }
                }
                return { ...prev, unitZone: newUnitZone }
              })
              showEffectFeedback(`LACERAÇÃO DO MUNDO: ${drawn.name} (${drawn.type})! Fehnon +3DP e ataca novamente!`, "success")
            } else if (isUnitOrAction && !hasOdenSword) {
              showEffectFeedback("LACERAÇÃO DO MUNDO: Carta comprada! (Equipe ODEN SWORD para o efeito completo)", "info")
            } else {
              showEffectFeedback("LACERAÇÃO DO MUNDO: Carta comprada!", "info")
            }
          }
        }

        // ── MORGANA SR 2DP: Ressonância em Eclipse — ao declarar ataque (cada 2 turnos) ──
        if (attacker.name.toLowerCase().includes("morgana") && attacker.dp === 2) {
          if (morganaEclipseLastTurn === null || turn - morganaEclipseLastTurn >= 2) {
            setMorganaEclipseActive({ target: attackState.targetInfo!.type === "direct" ? "direct" : "unit", turn })
            setMorganaEclipseLastTurn(turn)
            showEffectFeedback("RESSONÂNCIA EM ECLIPSE: Se sobreviver, oponente não pode comprar ou ativar habilidades no próximo turno!", "warning")
          }
        }

        // ── MORGANA UR 3DP: Sinfonia Relâmpago — ao atacar, a cada 3 turnos destrói 2 Functions/Traps ──
        if (attacker.name.toLowerCase().includes("morgana") && attacker.dp === 3) {
          if (morganaSinfoniaLastTurn === null || turn - morganaSinfoniaLastTurn >= 3) {
            const destroyableEnemy = enemyField.functionZone
              .map((f, i) => ({ f, i }))
              .filter(({ f }) => f !== null)
              .slice(0, 2)
            if (destroyableEnemy.length > 0) {
              setMorganaSinfoniaLastTurn(turn)
              const discardCount = destroyableEnemy.length * 3
              setEnemyField(prev => {
                const newFuncs = [...prev.functionZone]
                const newGrave = [...prev.graveyard]
                const newDeck = [...prev.deck]
                const newGraveFromDeck: typeof prev.graveyard[0][] = []
                destroyableEnemy.forEach(({ i }) => {
                  if (newFuncs[i]) { newGrave.push(newFuncs[i]!); newFuncs[i] = null }
                })
                // Discard top 3 per destroyed card
                const topCards = newDeck.slice(0, discardCount)
                const restDeck = newDeck.slice(discardCount)
                return { ...prev, functionZone: newFuncs as any, graveyard: [...newGrave, ...topCards], deck: restDeck }
              })
              showEffectFeedback(`SINFONIA RELÂMPAGO: ${destroyableEnemy.length} cartas destruídas! Oponente descarta ${discardCount} cartas do deck!`, "warning")
            }
          }
        }

        // ── MORGANA LR 4DP: Sinfonia da Discórdia — roubar 1 carta do cemitério inimigo a cada 2 turnos ──
        if (attacker.name.toLowerCase().includes("morgana") && attacker.dp === 4) {
          if (morganaDiscordiaLastTurn === null || turn - morganaDiscordiaLastTurn >= 2) {
            const stealableCards = enemyField.graveyard.filter(c =>
              c.type === "function" || c.type === "action" || c.type === "trap"
            )
            if (stealableCards.length > 0) {
              setMorganaDiscordiaLastTurn(turn)
              // Show choice modal to pick which graveyard card to steal
              const options = stealableCards.slice(0, 6).map((c, i) => ({
                id: String(i),
                label: c.name,
                description: `${c.type} · ${c.element || "Neutro"}`,
              }))
              setChoiceModal({
                visible: true,
                cardName: "Sinfonia da Discórdia — Escolha 1 carta do cemitério inimigo",
                options,
                onChoose: (optionId: string) => {
                  setChoiceModal(null)
                  const idx = parseInt(optionId)
                  const stolen = stealableCards[idx]
                  if (!stolen) return
                  // Remove from enemy graveyard, shuffle into player deck, enemy loses 2LP
                  setEnemyField(prev => {
                    const newGrave = [...prev.graveyard]
                    const removeIdx = newGrave.findIndex(c => c.id === stolen.id)
                    if (removeIdx !== -1) newGrave.splice(removeIdx, 1)
                    return { ...prev, graveyard: newGrave, life: Math.max(0, prev.life - 2) }
                  })
                  setPlayerField(prev => {
                    const newDeck = [...prev.deck, stolen].sort(() => Math.random() - 0.5)
                    return { ...prev, deck: newDeck }
                  })
                  showEffectFeedback(`SINFONIA DA DISCÓRDIA: "${stolen.name}" roubada e embaralhada no seu deck! Oponente -2LP!`, "success")
                },
              })
            }
          }
        }

        // ── MR. P: A Pena é Mais Forte que a Espada — seleciona 1 carta da mão do oponente para descartar ──
        if (attacker.name.toLowerCase().includes("mr. p") || attacker.name.toLowerCase().includes("mr p") || attacker.name.toLowerCase().includes("penguim")) {
          if (enemyField.hand.length > 0) {
            // Bot hand is unknown — discard random card (bot doesn't reveal hand)
            const randIdx = Math.floor(Math.random() * enemyField.hand.length)
            const discarded = enemyField.hand[randIdx]
            setEnemyField(prev => ({
              ...prev,
              hand: prev.hand.filter((_, i) => i !== randIdx),
              graveyard: [...prev.graveyard, discarded],
            }))
            showEffectFeedback(`A PENA É MAIS FORTE: ${discarded.name} descartada da mão do oponente!`, "success")
          } else {
            showEffectFeedback("A PENA É MAIS FORTE: Oponente não tem cartas na mão!", "info")
          }
        }

        // ── ULLR SR: Veredicto de Ullr — ao atacar, compra 1 carta; se Ventus → compra +1 ──
        if (attacker.name.toLowerCase().includes("ullr") && attacker.dp === 2) {
          const drawn1 = playerField.deck[0]
          if (drawn1) {
            const isVentus1 = drawn1.element === "Ventus" || drawn1.element === "Wind"
            setPlayerField(prev => ({ ...prev, deck: prev.deck.slice(1), hand: [...prev.hand, drawn1] }))
            showDrawAnimation(drawn1)
            showEffectFeedback(`VEREDICTO DE ULLR: ${drawn1.name} comprada!${isVentus1 ? " É Ventus! Compra mais 1!" : ""}`, isVentus1 ? "success" : "info")
            if (isVentus1) {
              const drawn2 = playerField.deck[1] // index 1 since deck[0] was drawn1
              if (drawn2) {
                setPlayerField(prev => ({ ...prev, deck: prev.deck.slice(1), hand: [...prev.hand, drawn2] }))
                showDrawAnimation(drawn2)
                setTimeout(() => showEffectFeedback(`VEREDICTO DE ULLR: ${drawn2.name} (bônus Ventus)!`, "success"), 400)
              }
            }
          }
        }

        // ── ULLR UR: Flecha de Skadi — antes de atacar, pode destruir 1 unidade inimiga com 2DP (uma vez) ──
        if (attacker.name.toLowerCase().includes("ullr") && attacker.dp === 3 && !ullrUrFlechaUsed) {
          const twoDpTargets = enemyField.unitZone
            .map((u,i) => ({u,i}))
            .filter(({u}) => u !== null && (u.currentDp ?? u.dp) === 2)
          if (twoDpTargets.length > 0) {
            setChoiceModal({
              visible: true,
              cardName: "Flecha de Skadi — Destruir 1 unidade inimiga com 2DP?",
              options: [
                ...twoDpTargets.slice(0,4).map(({u,i}) => ({ id: String(i), label: u!.name, description: `${u!.currentDp ?? u!.dp}DP` })),
                { id: "skip", label: "Não usar", description: "Atacar normalmente" },
              ],
              onChoose: (optId) => {
                setChoiceModal(null)
                if (optId === "skip") return
                const idx = parseInt(optId)
                const target = enemyField.unitZone[idx]
                if (!target) return
                markDestroyed(target)
                setEnemyField(prev => {
                  const newUnits = [...prev.unitZone]
                  newUnits[idx] = null
                  return { ...prev, unitZone: newUnits as (FieldCard|null)[], graveyard: [...prev.graveyard, target] }
                })
                setUllrUrFlechaUsed(true)
                showEffectFeedback(`FLECHA DE SKADI: ${target.name} destruída!`, "success")
              },
            })
          }
        }

        // ── LOGI SR: Incêndio Vivo — handled via keepAttackReady after kill (see on-destroy block) ──
        // ── LOGI SR: Explosão de Muspell — after attack, +1DP to a fire unit in battle ──
        // (triggered in on-destroy / post-attack block below)

        // ── LOGI UR: Devorar o Mundo — antes de atacar, todas unidades inimigas -2DP (destruídas se 0), a cada 3 turnos ──
        // Flag to signal that Devorar ran this attack cycle (used in attack resolution to re-check target)
        let _devorarRanThisAttack = false
        if (attacker.name.toLowerCase().includes("logi") && attacker.dp === 2) {
          if (logiUrDevorarLastTurn === null || turn - logiUrDevorarLastTurn >= 3) {
            const hasEnemyUnits = enemyField.unitZone.some(u => u !== null)
            if (hasEnemyUnits) {
              setLogiUrDevorarLastTurn(turn)
              _devorarRanThisAttack = true
              setEnemyField(prev => {
                const newUnits = [...prev.unitZone]
                const newGrave = [...prev.graveyard]
                prev.unitZone.forEach((u, i) => {
                  if (!u) return
                  const newDp = (u.currentDp ?? u.dp) - 2
                  if (newDp <= 0) {
                    markDestroyed(u)
                    newGrave.push(u)
                    newUnits[i] = null
                  } else {
                    newUnits[i] = { ...u, currentDp: newDp }
                  }
                })
                return { ...prev, unitZone: newUnits as (FieldCard|null)[], graveyard: newGrave }
              })
              showEffectFeedback("DEVORAR O MUNDO: Todas as unidades inimigas -2DP!", "warning")
            }
          }
        }

        // ── HROTTI SR: Corte do Medo Rúnico — antes de atacar, todas unidades inimigas -1DP (a cada 2 turnos na fase de batalha) ──
        if (attacker.name.toLowerCase().includes("hrotti") && attacker.dp === 2) {
          if (hrottiSrAttackLastTurn === null || turn - hrottiSrAttackLastTurn >= 2) {
            const hasEnemyUnits = enemyField.unitZone.some(u => u !== null)
            if (hasEnemyUnits) {
              setEnemyField(prev => ({
                ...prev,
                unitZone: prev.unitZone.map(u => u ? { ...u, currentDp: Math.max(0, (u.currentDp ?? u.dp) - 1) } : null) as (FieldCard|null)[],
              }))
              setHrottiSrAttackLastTurn(turn)
              showEffectFeedback("CORTE DO MEDO RÚNICO: Todas as unidades inimigas -1DP!", "warning")
            }
          }
        }

        // ── HROTTI UR: Fafnisbani — se alvo tem ≤3DP total, Hrotti +2DP antes do ataque ──
        if (attacker.name.toLowerCase().includes("hrotti") && attacker.dp === 3) {
          if (attackState.targetInfo?.type === "unit" && attackState.targetInfo.index !== undefined) {
            const target = enemyField.unitZone[attackState.targetInfo.index]
            if (target && (target.currentDp ?? target.dp) <= 3) {
              const attackerIdx = attackState.attackerIndex!
              setPlayerField(prev => {
                const newUnits = [...prev.unitZone]
                if (newUnits[attackerIdx]) {
                  const h = newUnits[attackerIdx]!
                  newUnits[attackerIdx] = { ...h, currentDp: (h.currentDp ?? h.dp) + 2 }
                }
                return { ...prev, unitZone: newUnits }
              })
              showEffectFeedback(`FAFNISBANI: ${target.name} tem ≤3DP! Hrotti +2DP!`, "success")
            }
          }
        }

        // ── HROTTI LR: Tidal de Midgard — registra quando entra em batalha pela primeira vez ──
        if (attacker.name.toLowerCase().includes("hrotti") && attacker.dp === 4) {
          if (hrottiLrTidalActiveTurn === null) setHrottiLrTidalActiveTurn(turn)
        }

        // ── MORDRED 1DP: Destino de Camlann — compra 1 carta ao atacar (1x por duelo); se Tropas → +2DP ──
        if (attacker.name.toLowerCase().includes("mordred") && !mordredCamlannUsed) {
          const drawn = playerField.deck[0]
          if (drawn) {
            const isTroop = drawn.type === "troops"
            setPlayerField(prev => ({ ...prev, deck: prev.deck.slice(1), hand: [...prev.hand, drawn] }))
            showDrawAnimation(drawn)
            setMordredCamlannUsed(true)
            if (isTroop) {
              setPlayerField(prev => {
                const newUnits = [...prev.unitZone]
                const idx = attackState.attackerIndex!
                if (newUnits[idx]) newUnits[idx] = { ...newUnits[idx]!, currentDp: (newUnits[idx]!.currentDp ?? newUnits[idx]!.dp) + 2 }
                return { ...prev, unitZone: newUnits }
              })
              showEffectFeedback(`DESTINO DE CAMLANN: Carta de Tropas! Mordred +2DP!`, "success")
            } else {
              showEffectFeedback(`DESTINO DE CAMLANN: ${drawn.name} comprada!`, "info")
            }
          }
        }

        // CALEM SR: Pulso da Nulidade - draw on attack every 3 turns
        if (attacker.name.toLowerCase().includes("calem") && attacker.dp === 2 && (pulsoNulidadeLastUsedTurn === null || turn - pulsoNulidadeLastUsedTurn >= 3)) {
          const drawn = playerField.deck[0]
          if (drawn) {
            const isVoidTroop = (drawn.element === "Void" && drawn.type === "troops")
            setPlayerField((prev) => {
              const newDeck = [...prev.deck.slice(1)]
              const newHand = [...prev.hand, drawn]
              const newUnitZone = [...prev.unitZone]
              const idx = attackState.attackerIndex!
              if (isVoidTroop && newUnitZone[idx]) {
                const cur = newUnitZone[idx]!
                newUnitZone[idx] = { ...cur, currentDp: (cur.currentDp || cur.dp) + 1 }
              }
              return { ...prev, deck: newDeck, hand: newHand, unitZone: newUnitZone }
            })
            showDrawAnimation(drawn)
            setPulsoNulidadeLastUsedTurn(turn)
            showEffectFeedback(isVoidTroop ? "PULSO DA NULIDADE: Calem +1DP (carta Void Tropas)!" : "PULSO DA NULIDADE: Carta comprada!", "info")
          }
        }

        // CALEM UR: Impacto sem Fé - draw on attack every 3 turns, if Unit → attack again
        if (attacker.name.toLowerCase().includes("calem") && attacker.dp === 3 && (impactoSemFeLastUsedTurn === null || turn - impactoSemFeLastUsedTurn >= 3)) {
          const drawn = playerField.deck[0]
          if (drawn) {
            const isUnit = ["unit","troops","ultimateGuardian","ultimateElemental"].includes(drawn.type)
            setPlayerField((prev) => {
              const newDeck = [...prev.deck.slice(1)]
              const newHand = [...prev.hand, drawn]
              return { ...prev, deck: newDeck, hand: newHand }
            })
            showDrawAnimation(drawn)
            setImpactoSemFeLastUsedTurn(turn)
            if (isUnit) {
              setCalemUrDoubleAttack(true)
              showEffectFeedback("IMPACTO SEM FÉ: Carta Unidade! Calem pode atacar novamente!", "success")
            } else {
              showEffectFeedback("IMPACTO SEM FÉ: Carta comprada!", "info")
            }
          }
        }

        // ── REI ARTHUR UR 3DP: Veredito do Rei Tirano — antes de atacar, descarte 1 carta → destrua 1 unidade inimiga (a cada 2 turnos) ──
        if (attacker.name.toLowerCase().includes("rei arthur") && attacker.dp === 3) {
          if (arthurUrVeredito === null || turn - arthurUrVeredito >= 2) {
            const hasHandCards = playerField.hand.length > 0
            const hasEnemyTargets = enemyField.unitZone.some(u => u !== null)
            if (hasHandCards && hasEnemyTargets) {
              // Show hand selection to discard, then enemy unit selection
              setChoiceModal({
                visible: true,
                cardName: "Veredito do Rei Tirano — Descarte 1 carta para destruir 1 unidade inimiga",
                options: [
                  ...playerField.hand.slice(0, 6).map((c, i) => ({ id: String(i), label: c.name, description: c.type })),
                  { id: "skip", label: "Não usar", description: "Atacar normalmente" },
                ],
                onChoose: (optId) => {
                  setChoiceModal(null)
                  if (optId === "skip") return
                  const discardIdx = parseInt(optId)
                  const discarded = playerField.hand[discardIdx]
                  if (!discarded) return
                  // Discard the card
                  setPlayerField(prev => ({
                    ...prev,
                    hand: prev.hand.filter((_, i) => i !== discardIdx),
                    graveyard: [...prev.graveyard, discarded],
                  }))
                  setArthurUrVeredito(turn)
                  // Now select enemy unit to destroy
                  const enemyTargets = enemyField.unitZone
                    .map((u, i) => ({u, i}))
                    .filter(({u}) => u !== null)
                  if (enemyTargets.length === 1) {
                    const target = enemyTargets[0].u!
                    markDestroyed(target)
                    setEnemyField(prev => {
                      const newUnits = [...prev.unitZone]
                      newUnits[enemyTargets[0].i] = null
                      return { ...prev, unitZone: newUnits as (FieldCard | null)[], graveyard: [...prev.graveyard, target] }
                    })
                    showEffectFeedback(`VEREDITO DO REI TIRANO: ${target.name} destruída!`, "success")
                  } else {
                    setChoiceModal({
                      visible: true,
                      cardName: "Veredito do Rei Tirano — Escolha a unidade inimiga para destruir",
                      options: enemyTargets.slice(0,4).map(({u,i}) => ({ id: String(i), label: u!.name, description: `${u!.currentDp ?? u!.dp}DP` })),
                      onChoose: (targetId) => {
                        setChoiceModal(null)
                        const tIdx = parseInt(targetId)
                        const target = enemyField.unitZone[tIdx]
                        if (!target) return
                        markDestroyed(target)
                        setEnemyField(prev => {
                          const newUnits = [...prev.unitZone]
                          newUnits[tIdx] = null
                          return { ...prev, unitZone: newUnits as (FieldCard | null)[], graveyard: [...prev.graveyard, target] }
                        })
                        showEffectFeedback(`VEREDITO DO REI TIRANO: ${target.name} destruída!`, "success")
                      },
                    })
                  }
                },
              })
            }
          }
        }

        // ── REI ARTHUR LR 4DP: Cálice do Monarca — antes de atacar, descarte 1 carta → destrua 2 unidades inimigas; se carta mágica → +2DP (a cada 2 turnos) ──
        if (attacker.name.toLowerCase().includes("rei arthur") && attacker.dp === 4) {
          if (arthurLrCalice === null || turn - arthurLrCalice >= 2) {
            const hasHandCards = playerField.hand.length > 0
            const enemyUnitCount = enemyField.unitZone.filter(u => u !== null).length
            if (hasHandCards && enemyUnitCount > 0) {
              setChoiceModal({
                visible: true,
                cardName: "Cálice do Monarca — Descarte 1 carta para destruir 2 unidades inimigas",
                gridLayout: true,
                options: [
                  ...playerField.hand.slice(0, 6).map((c, i) => ({ id: String(i), label: c.name, description: c.type })),
                  { id: "skip", label: "Não usar", description: "Atacar normalmente" },
                ],
                onChoose: (optId) => {
                  setChoiceModal(null)
                  if (optId === "skip") return
                  const discardIdx = parseInt(optId)
                  const discarded = playerField.hand[discardIdx]
                  if (!discarded) return
                  const isMagic = discarded.type === "function" || discarded.type === "action"
                  setPlayerField(prev => ({
                    ...prev,
                    hand: prev.hand.filter((_, i) => i !== discardIdx),
                    graveyard: [...prev.graveyard, discarded],
                  }))
                  setArthurLrCalice(turn)
                  // +2DP if discarded card is magic
                  if (isMagic) {
                    const attackerIdx = attackState.attackerIndex!
                    setPlayerField(prev => {
                      const newUnits = [...prev.unitZone]
                      if (newUnits[attackerIdx]) {
                        const cur = newUnits[attackerIdx]!
                        newUnits[attackerIdx] = { ...cur, currentDp: (cur.currentDp ?? cur.dp) + 2 }
                      }
                      return { ...prev, unitZone: newUnits }
                    })
                    showEffectFeedback("CÁLICE DO MONARCA: Carta mágica! Arthur +2DP!", "success")
                  }
                  // Destroy up to 2 enemy units
                  const enemyTargetPool = enemyField.unitZone.map((u,i) => ({u,i})).filter(({u}) => u !== null)
                  const toDestroy = enemyTargetPool.slice(0, Math.min(2, enemyTargetPool.length))
                  toDestroy.forEach(({u, i}) => {
                    if (u) markDestroyed(u)
                  })
                  setEnemyField(prev => {
                    const newUnits = [...prev.unitZone]
                    const newGrave = [...prev.graveyard]
                    toDestroy.forEach(({u, i}) => {
                      if (newUnits[i]) { newGrave.push(newUnits[i]!); newUnits[i] = null }
                    })
                    return { ...prev, unitZone: newUnits as (FieldCard | null)[], graveyard: newGrave }
                  })
                  showEffectFeedback(`CÁLICE DO MONARCA: ${toDestroy.length} unidade(s) destruída(s)!`, "warning")
                },
              })
            }
          }
        }

        // CALEM LR 4DP: Julgamento do Vazio Eterno
        // Requires Miguel Arcanjo equipped. Fires BEFORE the normal attack.
        // Check attacker by name (dp===4 = base dp, always true for LR regardless of buffs)
        const _isCalemLr = attacker.name.toLowerCase().includes("calem") && attacker.dp === 4
        const _miguelEquipped = !!(playerField.ultimateZone && playerField.ultimateZone.ability === "MIGUEL ARCANJO")
        if (_isCalemLr && _miguelEquipped) {
          const grave = playerField.graveyard
          const lastCard = grave.length > 0 ? grave[grave.length - 1] : null
          const triggerTypes = ["unit","troops","ultimateGuardian","ultimateElemental","function","action"]
          const _triggered = lastCard && triggerTypes.includes(lastCard.type)
          if (_triggered) {
            const enemyHasCards =
              enemyField.unitZone.some(u => u !== null) ||
              enemyField.functionZone.some(f => f !== null)
            if (enemyHasCards) {
              // Freeze the attack, open target selector
              const savedAttackerIdx = attackState.attackerIndex!
              setJulgamentoVazioTargetMode({ active: true, attackerIndex: savedAttackerIdx })
              setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
              isDraggingRef.current = false
              animationInProgressRef.current = false
              showEffectFeedback("JULGAMENTO DO VAZIO ETERNO: Selecione uma carta do oponente para destruir!", "warning")
              return
            } else {
              // No enemy cards left → +4DP bonus, attack still proceeds
              setPlayerField((prev) => {
                const newUnitZone = [...prev.unitZone]
                const idx = attackState.attackerIndex!
                if (idx !== null && newUnitZone[idx]) {
                  const cur = newUnitZone[idx]!
                  newUnitZone[idx] = { ...cur, currentDp: (cur.currentDp ?? cur.dp) + 4 }
                }
                return { ...prev, unitZone: newUnitZone }
              })
              showEffectFeedback("JULGAMENTO DO VAZIO ETERNO: Sem alvos! Calem +4DP!", "success")
            }
          }
        }

        // Generate projectile animation
        const attackerElement = document.querySelector(`[data-player-unit="${attackState.attackerIndex}"]`)
        const attackerRect = attackerElement?.getBoundingClientRect()
        const startX = attackerRect ? attackerRect.left + attackerRect.width / 2 : window.innerWidth / 2
        const startY = attackerRect ? attackerRect.top + attackerRect.height / 2 : window.innerHeight / 2

        let targetX = startX
        let targetY = startY

        if (attackState.targetInfo.type === "unit" && attackState.targetInfo.index !== undefined) {
          const targetElement = document.querySelector(`[data-enemy-unit="${attackState.targetInfo.index}"]`)
          const targetRect = targetElement?.getBoundingClientRect()
          if (targetRect) {
            targetX = targetRect.left + targetRect.width / 2
            targetY = targetRect.top + targetRect.height / 2
          }
        } else if (attackState.targetInfo.type === "direct") {
          const directZone = document.querySelector("[data-direct-attack]")
          const directRect = directZone?.getBoundingClientRect()
          if (directRect) {
            targetX = directRect.left + directRect.width / 2
            targetY = directRect.top + directRect.height / 2
          }
        }

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
            attackerName: attacker.name,
            isDirect: attackState.targetInfo!.type === "direct"
          },
        ])

        // ── Broadcast attack to opponent ──
        sendActionRef.current({
          type: "attack",
          playerId,
          data: {
            attackerIndex: attackState.attackerIndex,
            targetType: attackState.targetInfo!.type,
            targetIndex: attackState.targetInfo!.index,
            damage: attacker.currentDp ?? attacker.dp,
            attackerCard: { id: attacker.id, name: attacker.name, element: attacker.element, image: attacker.image, dp: attacker.dp },
          },
          timestamp: Date.now(),
        })

        // Trigger Card Jump Animation
        const key = `player-${attackState.attackerIndex}`
        const diffX = (targetX - startX) * 0.4 // Move 40% of the way
        const diffY = (targetY - startY) * 0.4
        
        setTimeout(() => {
          setCardAnimations(prev => ({
            ...prev,
            [key]: `translate3d(${diffX}px, ${diffY}px, 0) scale(1.1) rotate(${Math.random() * 4 - 2}deg)`
          }))
          
          // Reset card position after impact
          setTimeout(() => {
            setCardAnimations(prev => {
              const next = { ...prev }
              delete next[key]
              return next
            })
          }, CARD_JUMP_DURATION)
        }, CARD_JUMP_DELAY)

        // Hide arrow immediately — before any animation
        setAttackState({ isAttacking: false, attackerIndex: attackState.attackerIndex, targetInfo: attackState.targetInfo })

        setTimeout(() => {
          // Reset fully after projectile lands
          if (attackState.targetInfo!.type === "unit" && attackState.targetInfo!.index !== undefined) {
            // If Devorar o Mundo ran this cycle, the closure's enemyField is stale.
            // We use prev.unitZone inside the setEnemyField updater to get fresh state.
            // For the outer guard, if Devorar ran, we skip the stale check and let the updater handle it.
            const defender = _devorarRanThisAttack
              ? (enemyField.unitZone[attackState.targetInfo!.index] ?? { name: '__devorar_check__' })
              : enemyField.unitZone[attackState.targetInfo!.index]
            if (defender) {
              // CHECK ENEMY TRAPS - PORTÃO DA FORTALEZA
              // ── MORGANA UR/LR: Domínio Eterno/Horizontes — traps blocked ──
              const _morganaTrapBlock = playerField.unitZone.some(u =>
                u && u.name.toLowerCase().includes("morgana") && (u.dp === 3 || u.dp === 4)
              )
              const trapPortaoIndex = _morganaTrapBlock ? -1 : enemyField.functionZone.findIndex(f => f?.id === "portao-da-fortaleza" && f.isFaceDown)
              if (trapPortaoIndex !== -1) {
                setEnemyField(prev => {
                  const newFuncs = [...prev.functionZone]
                  newFuncs[trapPortaoIndex] = { ...newFuncs[trapPortaoIndex]!, isFaceDown: false }
                  const newHand = [...prev.hand]
                  if (newHand.length > 0) {
                    const discardIdx = Math.floor(Math.random() * newHand.length)
                    const discarded = newHand.splice(discardIdx, 1)[0]
                    return { ...prev, functionZone: newFuncs, hand: newHand, graveyard: [...prev.graveyard, discarded] }
                  }
                  return { ...prev, functionZone: newFuncs }
                })
                setPlayerField(prev => {
                  const newUnitZone = [...prev.unitZone]
                  newUnitZone[attackState.attackerIndex!] = null
                  return { ...prev, unitZone: newUnitZone, hand: [...prev.hand, attacker] }
                })
                showEffectFeedback("Armadilha Ativada! Portão da Fortaleza negou o ataque e devolveu sua unidade para a mão!", "error")
                setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
                animationInProgressRef.current = false
                return
              }

              const attackerDp = attacker.currentDp || attacker.dp
              const defenderDp = defender.currentDp || defender.dp
              const newDefenderDp = defenderDp - attackerDp

              // CHECK ENEMY TRAPS - CONTRA-ATAQUE SURPRESA
              if (attackerDp > 0) {
                const trapContraAtaqueIndex = _morganaTrapBlock ? -1 : enemyField.functionZone.findIndex(f => f?.id === "contra-ataque-surpresa" && f.isFaceDown)
                if (trapContraAtaqueIndex !== -1) {
                  setEnemyField(prev => {
                    const newFuncs = [...prev.functionZone]
                    newFuncs[trapContraAtaqueIndex] = { ...newFuncs[trapContraAtaqueIndex]!, isFaceDown: false }
                    return { ...prev, functionZone: newFuncs }
                  })
                  setPlayerField(prev => ({
                    ...prev,
                    life: Math.max(0, prev.life - attackerDp)
                  }))
                  showEffectFeedback(`Armadilha Ativada! Contra-Ataque Surpresa devolveu ${attackerDp} de dano aos seus LP!`, "error")
                }
              }

              const targetIndex = attackState.targetInfo!.index
              const targetElement = document.querySelector(`[data-enemy-unit="${targetIndex}"]`)
              const targetRect = targetElement?.getBoundingClientRect()

              // Recompute damage using fresh enemy state via functional updater
              setEnemyField((prev) => {
                const newUnitZone = [...prev.unitZone]
                const newGraveyard = [...prev.graveyard]
                // Re-check from fresh prev state — Devorar may have already destroyed this unit
                const freshDefender = prev.unitZone[targetIndex]
                if (!freshDefender) return prev  // already destroyed by Devorar or other effect
                // Recompute dp from fresh state to avoid stale closure issues
                const freshAttackerDp = attacker.currentDp ?? attacker.dp
                const freshDefenderDp = freshDefender.currentDp ?? freshDefender.dp
                const freshNewDefenderDp = freshDefenderDp - freshAttackerDp
                const isProtectedByProtonix = prev.ultimateZone &&
                  prev.ultimateZone.ability === "PROTONIX SWORD" &&
                  prev.ultimateZone.requiresUnit === freshDefender.name

                if (freshNewDefenderDp <= 0) {
                  if (isProtectedByProtonix) {
                    newUnitZone[targetIndex] = { ...defender, currentDp: 1 }
                    showEffectFeedback(`PROTONIX SWORD: ${defender.name} protegida! Resta 1 DP`, "error")
                  } else {
                    if (targetRect) {
                      showDestructionAnimation(
                        defender,
                        targetRect.left + targetRect.width / 2,
                        targetRect.top + targetRect.height / 2
                      )
                      setTimeout(() => {
                        triggerExplosion(
                          targetRect.left + targetRect.width / 2,
                          targetRect.top + targetRect.height / 2,
                          attacker.element || "neutral",
                        )
                      }, 400)
                    }
                    newGraveyard.push(defender)
                    newUnitZone[targetIndex] = null
                  }
                } else {
                  newUnitZone[targetIndex] = { ...defender, currentDp: newDefenderDp }
                  if (targetRect) {
                    triggerExplosion(
                      targetRect.left + targetRect.width / 2,
                      targetRect.top + targetRect.height / 2,
                      attacker.element || "neutral",
                    )
                  }
                }
                return { ...prev, unitZone: newUnitZone, graveyard: newGraveyard }
              })


              // ── FEHNON SR 2DP: Fluxo de Ruptura — ao destruir unidade: 2DP dano direto ──
              if (newDefenderDp <= 0 && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 2) {
                setTimeout(() => {
                  setEnemyField((prev) => ({ ...prev, life: Math.max(0, prev.life - 2) }))
                  showEffectFeedback("FLUXO DE RUPTURA: 2DP de dano direto ao oponente!", "warning")
                }, 500)
              }

              // ── REI ARTHUR SR 2DP: Eclipse de Avalon — ao destruir unidade → 3DP dano direto ──
              if (newDefenderDp <= 0 && attacker.name.toLowerCase().includes("rei arthur") && attacker.dp === 2) {
                setTimeout(() => {
                  setEnemyField((prev) => ({ ...prev, life: Math.max(0, prev.life - 3) }))
                  showEffectFeedback("ECLIPSE DE AVALON: 3DP de dano direto ao oponente!", "warning")
                }, 500)
              }

              // ── FEHNON UR 3DP: Singularidade Zero — ao destruir unidade: +2DP até o final do turno ──
              if (newDefenderDp <= 0 && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 3) {
                setPlayerField((prev) => {
                  const newUnitZone = [...prev.unitZone]
                  const idx = attackState.attackerIndex!
                  if (newUnitZone[idx]) {
                    const cur = newUnitZone[idx]!
                    newUnitZone[idx] = { ...cur, currentDp: (cur.currentDp || cur.dp) + 2 }
                  }
                  return { ...prev, unitZone: newUnitZone }
                })
                showEffectFeedback("SINGULARIDADE ZERO: Fehnon UR +2DP até o final do turno!", "success")
              }

              // ── FEHNON LR 4DP: Ruptura do Núcleo Supremo — ao destruir unidade: 2DP dano direto ──
              if (newDefenderDp <= 0 && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 4) {
                setTimeout(() => {
                  setEnemyField((prev) => ({ ...prev, life: Math.max(0, prev.life - 2) }))
                  showEffectFeedback("RUPTURA DO NÚCLEO SUPREMO: 2DP de dano direto ao oponente!", "warning")
                }, 500)
              }

              if (newDefenderDp <= 0 && attacker.name.toLowerCase().includes("calem") && attacker.dp === 2) {
                setTimeout(() => {
                  setEnemyField((prev) => ({ ...prev, life: Math.max(0, prev.life - 1) }))
                  showEffectFeedback("VÁCUO DE ESSÊNCIA: 1DP de dano direto ao oponente!", "warning")
                }, 600)
              }

              if (newDefenderDp <= 0 && attacker.name.toLowerCase().includes("calem") && attacker.dp === 3) {
                setPlayerField((prev) => {
                  const newUnitZone = [...prev.unitZone]
                  const idx = attackState.attackerIndex!
                  if (newUnitZone[idx]) {
                    const cur = newUnitZone[idx]!
                    newUnitZone[idx] = { ...cur, currentDp: (cur.currentDp || cur.dp) + 2 }
                  }
                  return { ...prev, unitZone: newUnitZone }
                })
                showEffectFeedback("HORIZONTE DE EVENTOS: Calem +2DP até o final do turno!", "success")
              }

              if (newDefenderDp <= 0 && attacker.name.toLowerCase().includes("calem") && attacker.dp === 4) {
                // Legião do Guardião Alado requires Miguel Arcanjo equipped
                const hasMiguelArcanjo = playerField.ultimateZone?.ability === "MIGUEL ARCANJO"
                if (hasMiguelArcanjo) {
                  setPlayerField((prev) => {
                    const newUnitZone = [...prev.unitZone]
                    const idx = attackState.attackerIndex!
                    if (newUnitZone[idx]) {
                      const cur = newUnitZone[idx]!
                      newUnitZone[idx] = { ...cur, currentDp: (cur.currentDp || cur.dp) + 3 }
                    }
                    return { ...prev, unitZone: newUnitZone }
                  })
                  showEffectFeedback("LEGIÃO DO GUARDIÃO ALADO: Calem +3DP! (Miguel Arcanjo)", "success")
                }
              }

              // ── LOGI SR: Incêndio Vivo — ao destruir unidade, Logi pode atacar novamente ──
              const isLogiSrKill = newDefenderDp <= 0 && attacker.name.toLowerCase().includes("logi") && attacker.dp === 1
              if (isLogiSrKill) {
                setLogiSrKillsThisBattle(prev => prev + 1)
                showEffectFeedback("INCÊNDIO VIVO: Logi destruiu uma unidade! Pode atacar novamente!", "success")
              }

              // ── LOGI SR: Explosão de Muspell — após ataque, +1DP a unidade de fogo no campo ──
              if (attacker.name.toLowerCase().includes("logi") && attacker.dp === 1) {
                const fireUnits = playerField.unitZone
                  .map((u, i) => ({ u, i }))
                  .filter(({ u }) => u !== null && (u.element === "Pyrus" || u.element === "Fire") && !u.name.toLowerCase().includes("logi"))
                if (fireUnits.length === 1) {
                  const { u, i } = fireUnits[0]
                  setPlayerField(prev => {
                    const nz = [...prev.unitZone]
                    if (nz[i]) nz[i] = { ...nz[i]!, currentDp: (nz[i]!.currentDp ?? nz[i]!.dp) + 1 }
                    return { ...prev, unitZone: nz as (FieldCard|null)[] }
                  })
                  showEffectFeedback(`EXPLOSÃO DE MUSPELL: ${u!.name} +1DP até o final da fase de batalha!`, "success")
                } else if (fireUnits.length > 1) {
                  setChoiceModal({
                    visible: true,
                    cardName: "Explosão de Muspell — Escolha 1 unidade de fogo para +1DP",
                    options: fireUnits.slice(0, 4).map(({ u, i }) => ({
                      id: String(i), label: u!.name, description: `${u!.currentDp ?? u!.dp}DP → ${(u!.currentDp ?? u!.dp) + 1}DP`
                    })),
                    onChoose: (optId) => {
                      setChoiceModal(null)
                      const idx = parseInt(optId)
                      setPlayerField(prev => {
                        const nz = [...prev.unitZone]
                        if (nz[idx]) nz[idx] = { ...nz[idx]!, currentDp: (nz[idx]!.currentDp ?? nz[idx]!.dp) + 1 }
                        return { ...prev, unitZone: nz as (FieldCard|null)[] }
                      })
                      showEffectFeedback(`EXPLOSÃO DE MUSPELL: ${fireUnits.find(f=>f.i===idx)?.u?.name} +1DP!`, "success")
                    },
                  })
                }
              }

              const keepAttackReady =
                (isLogiSrKill) ||
                (calemUrDoubleAttack && attacker.name.toLowerCase().includes("calem") && attacker.dp === 3) ||
                (fehnonSrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 2) ||
                (fehnonUrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 3) ||
                (fehnonLrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 4)

              setPlayerField((prev) => {
                const newUnitZone = [...prev.unitZone]
                newUnitZone[attackState.attackerIndex!] = { ...attacker, hasAttacked: !keepAttackReady }
                return { ...prev, unitZone: newUnitZone }
              })
              if (calemUrDoubleAttack && attacker.name.toLowerCase().includes("calem") && attacker.dp === 3) setCalemUrDoubleAttack(false)
              if (fehnonSrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 2) setFehnonSrDouble(false)
              if (fehnonUrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 3) { setFehnonUrDouble(false); setFehnonUrUsedDoubleThisTurn(true) }
              if (fehnonLrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 4) { setFehnonLrDouble(false) }
            }
          } else if (attackState.targetInfo!.type === "direct") {
            const directZone = document.querySelector("[data-direct-attack]")
            const directRect = directZone?.getBoundingClientRect()
            if (directRect) {
              triggerExplosion(
                directRect.left + directRect.width / 2,
                directRect.top + directRect.height / 2,
                attacker.element || "neutral",
              )
            }
            setEnemyField((prev) => ({
              ...prev,
              life: Math.max(0, prev.life - (attacker.currentDp || attacker.dp)),
            }))

            // ── MORGANA SR 2DP: Acorde do Abismo — ataque direto drena vida ──
            if (attacker.name.toLowerCase().includes("morgana") && attacker.dp === 2) {
              const hasEnemyLight = enemyField.unitZone.some(u => u && (u.element === "Haos" || u.element === "Light" || u.element === "Lightness"))
              const drain = hasEnemyLight ? 2 : 1
              setTimeout(() => {
                setPlayerField(prev => ({ ...prev, life: prev.life + drain }))
                showEffectFeedback(`ACORDE DO ABISMO: Morgana drena ${drain}LP!${hasEnemyLight ? " (Unidade Luz inimiga — drenagem dobrada!)" : ""}`, "success")
              }, 400)
            }

            // ── HROTTI LR: Ira Maelstrom — after dealing direct battle damage ──
            if (attacker.name.toLowerCase().includes("hrotti") && attacker.dp === 4 && !hrottiLrIraUsed) {
              setHrottiLrIraUsed(true)
              setTimeout(() => activateHrottiLrIra(), 500)
            }

            const keepReadyDirect =
              (fehnonSrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 2) ||
              (fehnonUrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 3) ||
              (fehnonLrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 4)

            setPlayerField((prev) => {
              const newUnitZone = [...prev.unitZone]
              newUnitZone[attackState.attackerIndex!] = { ...attacker, hasAttacked: !keepReadyDirect }
              return { ...prev, unitZone: newUnitZone }
            })
            if (fehnonSrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 2) setFehnonSrDouble(false)
            if (fehnonUrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 3) { setFehnonUrDouble(false); setFehnonUrUsedDoubleThisTurn(true) }
            if (fehnonLrDouble && attacker.name.toLowerCase().includes("fehnon") && attacker.dp === 4) setFehnonLrDouble(false)
          }
          setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
          setTimeout(() => {
            animationInProgressRef.current = false
          }, 100)
        }, PROJECTILE_DURATION)
      } else {
        setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
        animationInProgressRef.current = false
      }
    } else {
      setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
      animationInProgressRef.current = false
    }
  }, [attackState, playerField.unitZone, playerField.deck, playerField.graveyard, playerField.hand, enemyField.unitZone, enemyField.functionZone, enemyField.graveyard, triggerExplosion, turn, pulsoNulidadeLastUsedTurn, impactoSemFeLastUsedTurn, calemUrDoubleAttack, fehnonSrDouble, fehnonUrDouble, fehnonUrUsedDoubleThisTurn, fehnonLrDouble, fehnonLrBonusDp, morganaEclipseLastTurn, morganaSinfoniaLastTurn, morganaDiscordiaLastTurn, setEnemyField, setPlayerField, setAttackState, showEffectFeedback, setChoiceModal])

  // ── Global 0DP Sweep — any unit that reaches 0 or below DP is auto-destroyed ──
  useEffect(() => {
    if (!gameStarted) return

    // Player units
    const playerHasZeroDp = playerField.unitZone.some(u => u !== null && (u.currentDp ?? u.dp) <= 0)
    if (playerHasZeroDp) {
      setPlayerField(prev => {
        let changed = false
        const newUnits = prev.unitZone.map(u => {
          if (!u || (u.currentDp ?? u.dp) > 0) return u
          markDestroyed(u)
          changed = true
          return null
        })
        if (!changed) return prev
        const destroyed = prev.unitZone.filter(u => u !== null && (u.currentDp ?? u.dp) <= 0) as FieldCard[]
        return {
          ...prev,
          unitZone: newUnits as (FieldCard | null)[],
          graveyard: [...prev.graveyard, ...destroyed],
        }
      })
    }

    // Enemy units
    const enemyHasZeroDp = enemyField.unitZone.some(u => u !== null && (u.currentDp ?? u.dp) <= 0)
    if (enemyHasZeroDp) {
      setEnemyField(prev => {
        let changed = false
        const newUnits = prev.unitZone.map(u => {
          if (!u || (u.currentDp ?? u.dp) > 0) return u
          markDestroyed(u)
          changed = true
          return null
        })
        if (!changed) return prev
        const destroyed = prev.unitZone.filter(u => u !== null && (u.currentDp ?? u.dp) <= 0) as FieldCard[]
        return {
          ...prev,
          unitZone: newUnits as (FieldCard | null)[],
          graveyard: [...prev.graveyard, ...destroyed],
        }
      })
    }
  }, [
    playerField.unitZone.map(u => u?.currentDp ?? u?.dp ?? 0).join(','),
    enemyField.unitZone.map(u => u?.currentDp ?? u?.dp ?? 0).join(','),
  ])

  // ── Lancelot: Virtude do Cavaleiro — recalc DP when field changes ──
  useEffect(() => {
    setPlayerField(prev => {
      const hasVoidUnit = prev.unitZone.some(u => u !== null && (u.element === "Void" || u.element === "Darkus"))
      const newUnitZone = prev.unitZone.map(u => {
        if (!u || !u.name.toLowerCase().includes("lancelot")) return u
        // recalc without Void bonus first, then re-apply
        const baseCalc = calculateCardDP(u, { ...prev, unitZone: prev.unitZone }, false)
        return { ...u, currentDp: baseCalc }
      })
      return { ...prev, unitZone: newUnitZone as (FieldCard | null)[] }
    })
  }, [playerField.unitZone.map(u => u?.id).join(',')])

  // ── Morgana UR 3DP: Domínio Eterno — block traps while on field ──
  useEffect(() => {
    const hasMorganaUr = playerField.unitZone.some(u => u && u.name.toLowerCase().includes("morgana") && u.dp === 3)
    setMorganaTrapBlocked(hasMorganaUr)
  }, [playerField.unitZone])

  // ── Morgana LR 4DP: Domínio de Horizontes — block all actions+traps while on field ──
  useEffect(() => {
    const hasMorganaLr = playerField.unitZone.some(u => u && u.name.toLowerCase().includes("morgana") && u.dp === 4)
    setMorganaActionBlocked(hasMorganaLr)
  }, [playerField.unitZone])

  // ── Merlin: Visão Além do Agora ──
  const activateMerlinAbility = () => {
    if (merlinUsed) { showEffectFeedback("Visão Além do Agora já foi usada neste duelo!", "error"); return }
    const top5 = playerField.deck.slice(0, Math.min(5, playerField.deck.length))
    if (top5.length === 0) { showEffectFeedback("Deck vazio!", "error"); return }
    setMerlinUsed(true)

    // Each card in top5 is tagged with its original index so selection maps back cleanly
    const tagged = top5.map((card, idx) => ({ card, idx }))

    if (top5.length <= 2) {
      // Fewer than 3 cards — all go to hand
      setPlayerField(prev => ({
        ...prev,
        hand: [...prev.hand, ...top5],
        deck: prev.deck.slice(top5.length),
      }))
      top5.forEach(card => showDrawAnimation(card))
      showEffectFeedback(`VISÃO ALÉM DO AGORA: ${top5.map(c => c.name).join(", ")} adicionadas!`, "success")
      return
    }

    // Pick 1st card
    setChoiceModal({
      visible: true,
      cardName: "Visão Além do Agora — Escolha a 1ª carta para a mão",
      options: tagged.map(({ card, idx }) => ({
        id: String(idx),
        label: card.name,
        description: `${card.type}${card.dp ? ` · ${card.dp}DP` : ''}`,
      })),
      onChoose: (firstIdStr) => {
        const firstIdx = parseInt(firstIdStr)
        const firstCard = top5[firstIdx]

        // Pick 2nd card from the remaining
        const remainingTagged = tagged.filter(({ idx }) => idx !== firstIdx)
        setChoiceModal({
          visible: true,
          cardName: `Visão Além do Agora — Escolha a 2ª carta (${firstCard.name} escolhida)`,
          options: remainingTagged.map(({ card, idx }) => ({
            id: String(idx),
            label: card.name,
            description: `${card.type}${card.dp ? ` · ${card.dp}DP` : ''}`,
          })),
          onChoose: (secondIdStr) => {
            setChoiceModal(null)
            const secondIdx = parseInt(secondIdStr)
            const chosenIndices = new Set([firstIdx, secondIdx])
            const chosenCards = top5.filter((_, i) => chosenIndices.has(i))
            const bottomCards = top5.filter((_, i) => !chosenIndices.has(i))
            setPlayerField(prev => ({
              ...prev,
              hand: [...prev.hand, ...chosenCards],
              deck: [...prev.deck.slice(top5.length), ...bottomCards],
            }))
            chosenCards.forEach(card => showDrawAnimation(card))
            showEffectFeedback(
              `VISÃO ALÉM DO AGORA: ${chosenCards.map(c => c.name).join(", ")} adicionadas à mão!`,
              "success"
            )
          },
        })
      },
    })
  }

  // ── Oswin: Lucro na Crise ──
  const activateOswinAbility = () => {
    if (oswinUsed) { showEffectFeedback("Lucro na Crise já foi usada neste duelo!", "error"); return }
    const top5 = playerField.deck.slice(0, Math.min(5, playerField.deck.length))
    if (top5.length === 0) { showEffectFeedback("Deck vazio!", "error"); return }
    setOswinUsed(true)
    // Item cards: type "function" cards that are items (by name or category)
    const itemCards = top5.filter(c =>
      c.type === "function" || c.type === "action" || (c.category && c.category.toLowerCase().includes("item"))
    )
    const hasItems = itemCards.length > 0
    const maxChoose = hasItems ? Math.min(2, itemCards.length) : 1
    const pool = hasItems ? itemCards : top5

    if (pool.length === 1) {
      setPlayerField(prev => ({
        ...prev,
        hand: [...prev.hand, pool[0]],
        deck: [...prev.deck.slice(top5.length), ...top5.filter(c => c !== pool[0])],
      }))
      showDrawAnimation(pool[0])
      showEffectFeedback(`LUCRO NA CRISE: ${pool[0].name} adicionada à mão!`, "success")
      return
    }

    const pickCount = maxChoose
    const picks: number[] = []

    const pickNext = () => {
      if (picks.length >= pickCount) {
        const chosenCards = picks.map(i => pool[i])
        const bottomCards = top5.filter(c => !chosenCards.includes(c))
        setPlayerField(prev => ({
          ...prev,
          hand: [...prev.hand, ...chosenCards],
          deck: [...prev.deck.slice(5), ...bottomCards],
        }))
        chosenCards.forEach(c => showDrawAnimation(c))
        showEffectFeedback(`LUCRO NA CRISE: ${chosenCards.map(c=>c.name).join(", ")} adicionadas à mão!`, "success")
        return
      }
      const available = pool.filter((_, i) => !picks.includes(i))
      setChoiceModal({
        visible: true,
        cardName: `Lucro na Crise — Escolha carta ${picks.length + 1}/${pickCount}${hasItems ? " (Itens encontrados!)" : ""}`,
        options: available.map((c, i) => {
          const origIdx = pool.indexOf(c)
          return { id: String(origIdx), label: c.name, description: c.type + (c.dp ? ` · ${c.dp}DP` : '') }
        }),
        onChoose: (optId) => {
          setChoiceModal(null)
          picks.push(parseInt(optId))
          pickNext()
        },
      })
    }
    pickNext()
  }

  // ── Mr. P: Manuscrito de Guerra — (optional) select enemy unit, -2DP ──
  const activateMrPAbility = () => {
    const enemyTargets = enemyField.unitZone
      .map((u, i) => ({ u, i }))
      .filter(({ u }) => u !== null)
    if (enemyTargets.length === 0) {
      showEffectFeedback("Nenhuma unidade inimiga no campo!", "error")
      return
    }
    setChoiceModal({
      visible: true,
      cardName: "Manuscrito de Guerra — Selecione uma unidade inimiga para -2DP",
      options: [
        ...enemyTargets.slice(0, 4).map(({ u, i }) => ({
          id: String(i),
          label: u!.name,
          description: `${u!.currentDp ?? u!.dp}DP → ${Math.max(0, (u!.currentDp ?? u!.dp) - 2)}DP`,
        })),
        { id: "skip", label: "Não usar", description: "Pular este efeito" },
      ],
      onChoose: (optId) => {
        setChoiceModal(null)
        if (optId === "skip") return
        const idx = parseInt(optId)
        setEnemyField(prev => {
          const newUnits = [...prev.unitZone]
          if (newUnits[idx]) {
            const u = newUnits[idx]!
            newUnits[idx] = { ...u, currentDp: Math.max(0, (u.currentDp ?? u.dp) - 2) }
          }
          return { ...prev, unitZone: newUnits as (FieldCard | null)[] }
        })
        setMrPManuscritoUsed(true)
        showEffectFeedback(`MANUSCRITO DE GUERRA: ${enemyTargets.find(t => t.i === idx)?.u?.name} -2DP!`, "success")
      },
    })
  }

  // ── Vivian: Abraço das Profundezas — on summon, special-summon a 2 or 3DP unit from deck ──
  const activateVivianAbility = () => {
    if (vivianAbracoUsed) return
    const emptySlot = playerField.unitZone.findIndex(s => s === null)
    if (emptySlot === -1) {
      showEffectFeedback("Campo cheio! Não é possível evocar mais unidades.", "error")
      return
    }
    const candidates = playerField.deck.filter(c =>
      isUnitCard(c) && !isUltimateCard(c) && (c.dp === 2 || c.dp === 3)
    )
    if (candidates.length === 0) {
      showEffectFeedback("Nenhuma unidade de 2 ou 3DP no deck!", "info")
      return
    }
    const uniqueByName = candidates.filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)
    setChoiceModal({
      visible: true,
      cardName: "Abraço das Profundezas — Escolha uma unidade (2 ou 3DP) do deck para evocar",
      options: uniqueByName.slice(0, 6).map((c, i) => ({
        id: c.id,
        label: c.name,
        description: `${c.dp}DP · ${c.element || "Neutro"}`,
      })),
      onChoose: (cardId) => {
        setChoiceModal(null)
        const chosen = playerField.deck.find(c => c.id === cardId)
        if (!chosen) return
        const fieldCard: FieldCard = {
          ...chosen,
          currentDp: calculateCardDP(chosen, playerField, false),
          canAttack: false,
          hasAttacked: false,
          canAttackTurn: turn,
        }
        setPlayerField(prev => {
          const newUnitZone = [...prev.unitZone]
          const slot = newUnitZone.findIndex(s => s === null)
          if (slot === -1) return prev
          newUnitZone[slot] = fieldCard
          return {
            ...prev,
            unitZone: newUnitZone as (FieldCard | null)[],
            deck: prev.deck.filter(c => c.id !== cardId),
          }
        })
        setVivianAbracoUsed(true)
        showEffectFeedback(`ABRAÇO DAS PROFUNDEZAS: ${chosen.name} evocada do deck!`, "success")
      },
    })
  }

  // ── Hrotti SR: Avareza de Fafnir — discard own field cards for +1DP each (every 3 turns) ──
  const activateHrottiSrAbility = () => {
    if (hrottiSrLastTurn !== null && turn - hrottiSrLastTurn < 3) {
      showEffectFeedback(`Avareza de Fafnir disponível no turno ${hrottiSrLastTurn + 3}!`, "error"); return
    }

    // Build field options from current playerField (now safe — called fresh from key lookup)
    const fieldOptions: { id: string; label: string; description: string }[] = []
    playerField.unitZone.forEach((u, i) => {
      if (u && !u.name.toLowerCase().includes("hrotti"))
        fieldOptions.push({ id: `unit-${i}`, label: u.name, description: `Unidade · ${u.currentDp ?? u.dp}DP` })
    })
    playerField.functionZone.forEach((f, i) => {
      if (f)
        fieldOptions.push({ id: `func-${i}`, label: f.name, description: `Function${f.isFaceDown ? ' (face-down)' : ''}` })
    })
    if (playerField.scenarioZone)
      fieldOptions.push({ id: 'scenario', label: playerField.scenarioZone.name, description: 'Cenário' })
    if (playerField.ultimateZone)
      fieldOptions.push({ id: 'ultimate', label: playerField.ultimateZone.name, description: 'Ultimate Zone' })

    if (fieldOptions.length === 0) { showEffectFeedback("Nenhuma carta no campo para descartar!", "error"); return }

    const selected: string[] = []

    const applyDiscard = () => {
        if (selected.length === 0) { showEffectFeedback("Nenhuma carta selecionada.", "info"); return }
        const bonus = selected.length
        setPlayerField(prev => {
          const newUnitZone = [...prev.unitZone]
          const newFuncZone = [...prev.functionZone]
          let newScenario = prev.scenarioZone
          let newUltimate = prev.ultimateZone
          const newGrave = [...prev.graveyard]
          selected.forEach(sel => {
            if (sel.startsWith('unit-')) {
              const idx = parseInt(sel.replace('unit-', ''))
              if (newUnitZone[idx]) { newGrave.push(newUnitZone[idx]!); newUnitZone[idx] = null }
            } else if (sel.startsWith('func-')) {
              const idx = parseInt(sel.replace('func-', ''))
              if (newFuncZone[idx]) { newGrave.push(newFuncZone[idx]!); newFuncZone[idx] = null }
            } else if (sel === 'scenario') {
              if (newScenario) { newGrave.push(newScenario); newScenario = null }
            } else if (sel === 'ultimate') {
              if (newUltimate) { newGrave.push(newUltimate); newUltimate = null }
            }
          })
          // +1DP per card discarded to Hrotti SR
          const hrottiIdx = newUnitZone.findIndex(u => u && u.name.toLowerCase().includes("hrotti") && u.dp === 2)
          if (hrottiIdx !== -1 && newUnitZone[hrottiIdx]) {
            const h = newUnitZone[hrottiIdx]!
            newUnitZone[hrottiIdx] = { ...h, currentDp: (h.currentDp ?? h.dp) + bonus }
          }
          return { ...prev, unitZone: newUnitZone as (FieldCard|null)[], functionZone: newFuncZone, scenarioZone: newScenario, ultimateZone: newUltimate, graveyard: newGrave }
        })
        setHrottiSrLastTurn(turn)
        showEffectFeedback(`AVAREZA DE FAFNIR: ${bonus} carta(s) descartada(s)! Hrotti +${bonus}DP!`, "success")
      }

      const showPicker = () => {
        const available = fieldOptions.filter(o => !selected.includes(o.id))
        setChoiceModal({
          visible: true,
          cardName: `Avareza de Fafnir — Escolha cartas para descartar (${selected.length} selecionadas)`,
          options: [
            ...available.map(o => ({ id: o.id, label: o.label, description: o.description })),
            { id: '__confirm__', label: `✓ Confirmar (${selected.length} carta${selected.length !== 1 ? 's' : ''})`, description: selected.length > 0 ? `+${selected.length}DP para Hrotti` : 'Selecione ao menos 1' },
          ],
          onChoose: (optId) => {
            setChoiceModal(null)
            if (optId === '__confirm__') { applyDiscard(); return }
            selected.push(optId)
            showPicker()
          },
        })
      }
    showPicker()
  }

  // ── Hrotti UR: Herança de Andvaranaut — nullify all Ultimate Gear effects for 3 turns (once ever) ──
  const activateHrottiUrAbility = () => {
    if (hrottiUrUsed) { showEffectFeedback("Herança de Andvaranaut já foi usada!", "error"); return }
    setHrottiUrUsed(true)
    setHrottiUrNullifyUntil(turn + 3)
    showEffectFeedback("HERANÇA DE ANDVARANAUT: Todos os efeitos de Ultimate Gear anulados por 3 turnos!", "warning")
  }

  // ── Hrotti LR: Ira Maelstrom — after dealing battle damage: shuffle top of enemy deck to bottom; look at own top ──
  const activateHrottiLrIra = () => {
    // Move enemy's top deck card to bottom
    if (enemyField.deck.length > 0) {
      const top = enemyField.deck[0]
      setEnemyField(prev => ({
        ...prev,
        deck: [...prev.deck.slice(1), top],
      }))
      showEffectFeedback("IRA MAELSTROM: Carta do topo do deck inimigo enviada ao fundo!", "warning")
    }
    // Look at own top and choose to keep or bottom
    const ownTop = playerField.deck[0]
    if (ownTop) {
      setChoiceModal({
        visible: true,
        cardName: `Ira Maelstrom — Carta do topo: ${ownTop.name}`,
        options: [
          { id: 'keep', label: 'Manter no topo', description: `${ownTop.name} permanece no topo` },
          { id: 'bottom', label: 'Enviar ao fundo', description: `${ownTop.name} vai ao fundo do seu deck` },
        ],
        onChoose: (optId) => {
          setChoiceModal(null)
          if (optId === 'bottom') {
            setPlayerField(prev => ({
              ...prev,
              deck: [...prev.deck.slice(1), prev.deck[0]],
            }))
            showEffectFeedback(`IRA MAELSTROM: ${ownTop.name} enviada ao fundo do seu deck!`, "info")
          }
        },
      })
    }
    setHrottiLrIraUsed(false) // Reset for next battle
  }

  // ── Ullr SR: Marca da Caçada — choose enemy unit, Ventus -2DP / other -1DP (once per main phase) ──
  const activateUllrSrAbility = () => {
    const enemyTargets = enemyField.unitZone.map((u,i) => ({u,i})).filter(({u}) => u !== null)
    if (enemyTargets.length === 0) { showEffectFeedback("Nenhuma unidade inimiga no campo!", "error"); return }
    setChoiceModal({
      visible: true,
      cardName: "Marca da Caçada — Selecione uma unidade inimiga como alvo",
      options: enemyTargets.slice(0,4).map(({u,i}) => {
        const isVentus = u!.element === "Ventus" || u!.element === "Wind"
        const dpLoss = isVentus ? 2 : 1
        return { id: String(i), label: u!.name, description: `${u!.currentDp ?? u!.dp}DP → ${Math.max(0,(u!.currentDp ?? u!.dp)-dpLoss)}DP${isVentus ? " (Ventus: -2DP)" : " (-1DP)"}` }
      }),
      onChoose: (optId) => {
        setChoiceModal(null)
        const idx = parseInt(optId)
        setEnemyField(prev => {
          const newUnits = [...prev.unitZone]
          const u = newUnits[idx]
          if (!u) return prev
          const isVentus = u.element === "Ventus" || u.element === "Wind"
          const dpLoss = isVentus ? 2 : 1
          newUnits[idx] = { ...u, currentDp: Math.max(0, (u.currentDp ?? u.dp) - dpLoss) }
          return { ...prev, unitZone: newUnits as (FieldCard|null)[] }
        })
        setUllrSrMarcaUsed(true)
        const tgt = enemyTargets.find(t => t.i === idx)
        const isVentus = tgt?.u?.element === "Ventus" || tgt?.u?.element === "Wind"
        sendActionRef.current({
          type: "ability_used", playerId,
          data: { ability: "ullrSr", targetIndex: idx, dpChange: isVentus ? -2 : -1 },
          timestamp: Date.now(),
        })
        showEffectFeedback(`MARCA DA CAÇADA: ${tgt?.u?.name} ${isVentus ? "-2DP (Ventus)" : "-1DP"}!`, "success")
      },
    })
  }

  // ── Ullr UR: Juramento Eterno — all Wind/Ventus units +2DP (or +3DP with Ullrbogi), every 4 turns ──
  const activateUllrUrAbility = () => {
    if (ullrUrJuramentoLastTurn !== null && turn - ullrUrJuramentoLastTurn < 4) {
      showEffectFeedback(`Juramento Eterno disponível no turno ${ullrUrJuramentoLastTurn + 4}!`, "error"); return
    }
    const hasUllrbogi = playerField.ultimateZone?.ability === "ULLRBOGI"
    const bonus = hasUllrbogi ? 3 : 2
    setPlayerField(prev => {
      const newUnits = prev.unitZone.map(u => {
        if (!u) return null
        if (u.element === "Ventus" || u.element === "Wind") {
          return { ...u, currentDp: (u.currentDp ?? u.dp) + bonus }
        }
        return u
      })
      return { ...prev, unitZone: newUnits as (FieldCard|null)[] }
    })
    setUllrUrJuramentoLastTurn(turn)
    sendActionRef.current({
      type: "ability_used", playerId,
      data: { ability: "ullrUr", bonus },
      timestamp: Date.now(),
    })
    showEffectFeedback(`JURAMENTO ETERNO: Todas as unidades Ventus +${bonus}DP${hasUllrbogi ? " (Ullrbogi!)" : ""}!`, "success")
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const handleHandCardDragStart = (index: number, e: React.MouseEvent | React.TouchEvent) => {
    if (!isMyTurn || phase !== "main") return

    const card = playerField.hand[index]
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

    // Update DOM directly for smooth movement (no React re-render)
    const isOverTarget = dropTarget !== null
    draggedCardRef.current.style.transform = `translate(${clientX - 40}px, ${clientY - 56}px) rotate(${isOverTarget ? 0 : dragPosRef.current.rotation}deg) scale(${isOverTarget ? 1.2 : 1.1})`

    // Throttled drop target check - only every 50ms
    const now = Date.now()
    if (!dragPosRef.current.lastCheck || now - dragPosRef.current.lastCheck > 16) {
      dragPosRef.current.lastCheck = now

      const elements = document.elementsFromPoint(clientX, clientY)
      let foundTarget: { type: "unit" | "function" | "scenario" | "ultimate"; index: number } | null = null

      for (const el of elements) {
        const unitSlot = el.closest("[data-player-unit-slot]")
        const funcSlot = el.closest("[data-player-func-slot]")
        const scenarioSlot = el.closest("[data-player-scenario-slot]")
        const ultimateSlot = el.closest("[data-player-ultimate-slot]")

        if (ultimateSlot && isUltimateCard(draggedHandCard.card)) {
          if (!playerField.ultimateZone) {
            foundTarget = { type: "ultimate", index: 0 }
            break
          }
        } else if (unitSlot && isUnitCard(draggedHandCard.card) && !isUltimateCard(draggedHandCard.card)) {
          const slotIndex = Number.parseInt(unitSlot.getAttribute("data-player-unit-slot") || "0")
          if (!playerField.unitZone[slotIndex]) {
            foundTarget = { type: "unit", index: slotIndex }
            break
          }
        } else if (funcSlot && !isUnitCard(draggedHandCard.card) && draggedHandCard.card.type !== "scenario") {
          const slotIndex = Number.parseInt(funcSlot.getAttribute("data-player-func-slot") || "0")
          if (!playerField.functionZone[slotIndex]) {
            foundTarget = { type: "function", index: slotIndex }
            break
          }
        } else if (scenarioSlot && draggedHandCard.card.type === "scenario") {
          if (!playerField.scenarioZone) {
            foundTarget = { type: "scenario", index: 0 }
            break
          }
        }
      }

      // Only update state if target changed
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
      const targetSelector = dropTarget.type === "unit"
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

      // Remove card from hand IMMEDIATELY by passing index directly
      if (targetType === "ultimate") {
        placeUltimateCard(cardIndex)
      } else if (targetType === "scenario") {
        placeScenarioCard(cardIndex)
      } else {
        placeCard(targetType, targetIndex, cardIndex)
      }
      setSelectedHandCard(null)

      // Show materialize animation if we have target position
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

  // Card inspection handlers (press and hold to view)
  const handleCardPressStart = (card: GameCard) => {
    if (cardPressTimer.current) {
      clearTimeout(cardPressTimer.current)
    }
    cardPressTimer.current = setTimeout(() => {
      setInspectedCard(card)
    }, 300) // 300ms hold to inspect
  }

  const handleCardPressEnd = () => {
    if (cardPressTimer.current) {
      clearTimeout(cardPressTimer.current)
      cardPressTimer.current = null
    }
  }

  // Bot AI removed — multiplayer uses sendAction/handleOpponentAction

  // ════════════════════════════════════════════════════════════════════════
  //  MULTIPLAYER LAYER — Supabase sendAction / handleOpponentAction
  // ════════════════════════════════════════════════════════════════════════

  // sendActionRef allows calling sendAction from closures defined before it
  const sendActionRef = useRef<(action: DuelAction) => Promise<void>>(async () => {})
  // handleOpponentActionRef — always points to latest version (avoids stale closure in subscription)
  const handleOpponentActionRef = useRef<(action: DuelAction) => void>(() => {})

  const sendAction = useCallback(async (action: DuelAction) => {
    if (!supabase) return
    try {
      // Use timestamp as sequence — avoids extra RPC round-trip for speed
      const seq = action.timestamp
      await supabase.from("duel_actions").insert({
        room_id: roomData.roomId,
        player_id: playerId,
        action_type: action.type,
        action_data: JSON.stringify(action),
        sequence_number: seq,
      })
    } catch (err) {
      console.error("[online] sendAction error:", err)
    }
  }, [supabase, roomData.roomId, playerId])

  // Keep ref in sync
  useEffect(() => { sendActionRef.current = sendAction }, [sendAction])
  useEffect(() => { handleOpponentActionRef.current = handleOpponentAction }, [handleOpponentAction])

  const handleOpponentAction = useCallback((action: DuelAction) => {
    const actionId = `${action.type}-${action.timestamp}`
    if (processedActionIdsRef.current.has(actionId)) return
    processedActionIdsRef.current.add(actionId)

    switch (action.type) {

      case "draw":
        setEnemyField(prev => ({
          ...prev,
          hand: Array(action.data.handSize ?? 5).fill(null),
          deck: Array(action.data.deckSize ?? 0).fill(null),
        }))
        break

      case "place_card": {
        const card = action.data.card
        const src  = action.data.source || "hand"
        if (action.data.zone === "unit") {
          setEnemyField(prev => {
            const newUZ = [...prev.unitZone]
            newUZ[action.data.index] = { ...card, currentDp: card.dp, canAttack: false, hasAttacked: false, canAttackTurn: turn }
            const ns = { ...prev, unitZone: newUZ }
            if (src === "tap") ns.tap = prev.tap.filter(c => c.id !== card.id)
            else ns.hand = prev.hand.slice(0, -1)
            return ns
          })
        } else if (action.data.zone === "function") {
          setEnemyField(prev => {
            const newFZ = [...prev.functionZone]
            newFZ[action.data.index] = action.data.isTrap
              ? { ...card, isFaceDown: true, isRevealing: false, isSettingDown: true }
              : card
            const ns = { ...prev, functionZone: newFZ }
            if (src === "tap") ns.tap = prev.tap.filter(c => c.id !== card.id)
            else ns.hand = prev.hand.slice(0, -1)
            return ns
          })
        } else if (action.data.zone === "scenario") {
          setEnemyField(prev => {
            const ns = { ...prev, scenarioZone: card }
            if (src === "tap") ns.tap = prev.tap.filter(c => c.id !== card.id)
            else ns.hand = prev.hand.slice(0, -1)
            return ns
          })
        } else if (action.data.zone === "ultimate") {
          setEnemyField(prev => {
            const ns = { ...prev, ultimateZone: { ...card, currentDp: card.dp, canAttack: false, hasAttacked: false, canAttackTurn: turn } }
            if (src === "tap") ns.tap = prev.tap.filter(c => c.id !== card.id)
            else ns.hand = prev.hand.slice(0, -1)
            return ns
          })
        }
        break
      }

      case "attack": {
        const { attackerIndex, targetType, targetIndex, damage, attackerCard } = action.data
        // Use attackerCard from action data (never stale)
        const attacker = attackerCard ?? enemyField.unitZone[attackerIndex]

        // Projectile from enemy → my field
        const getCoords = (sel: string) => {
          const el = document.querySelector(sel)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { x: r.left + r.width/2, y: r.top + r.height/2 }
        }
        const startEl = document.querySelector(`[data-enemy-unit="${attackerIndex}"]`)
        const startR  = startEl?.getBoundingClientRect()
        const startX  = startR ? startR.left + startR.width/2  : window.innerWidth/2
        const startY  = startR ? startR.top  + startR.height/2 : 0

        let tgt = targetType === "direct"
          ? getCoords('[data-direct-attack]')
          : getCoords(`[data-player-unit-slot="${targetIndex}"]`)

        if (tgt && attacker) {
          const projId = `opp-${Date.now()}`
          setActiveProjectiles(prev => [...prev, {
            id: projId, startX, startY,
            targetX: tgt!.x, targetY: tgt!.y,
            element: attacker.element || "neutral",
            attackerImage: attacker.image,
            attackerName: attacker.name,
            isDirect: targetType === "direct",
          }])
        }

        setTimeout(() => {
          if (targetType === "direct") {
            setPlayerField(prev => ({ ...prev, life: Math.max(0, prev.life - damage) }))
          } else {
            setPlayerField(prev => {
              const nUZ = [...prev.unitZone]
              const nGY = [...prev.graveyard]
              const t = nUZ[targetIndex]
              if (t) {
                t.currentDp -= damage
                if (t.currentDp <= 0) { nGY.push(t); nUZ[targetIndex] = null }
              }
              return { ...prev, unitZone: nUZ, graveyard: nGY }
            })
          }
          if (tgt) triggerExplosion(tgt.x, tgt.y, attacker?.element || "neutral")
        }, 600)
        break
      }

      case "end_turn":
        setIsMyTurn(true)
        setTurn(prev => prev + 1)
        setPhase("draw")
        setNormalSummonUsed(false) // reset for my new turn
        setPlayerField(prev => ({
          ...prev,
          unitZone: prev.unitZone.map(u => u ? { ...u, canAttack: true, hasAttacked: false } : null),
          ultimateZone: prev.ultimateZone ? { ...prev.ultimateZone, canAttack: true, hasAttacked: false } : null,
        }))
        break

      case "damage":
        if (action.data.target === "player") {
          setPlayerField(prev => ({ ...prev, life: Math.max(0, prev.life - action.data.amount) }))
        }
        break

      case "surrender":
        setWinReason("surrender")
        setGameResult("won")
        break

      case "destroy_card":
        setPlayerField(prev => {
          const nUZ = [...prev.unitZone]
          const destroyed = nUZ[action.data.index]
          if (destroyed) {
            nUZ[action.data.index] = null
            return { ...prev, unitZone: nUZ, graveyard: [...prev.graveyard, destroyed] }
          }
          return prev
        })
        break

      case "use_function_card": {
        // Opponent used a function/item card — update visible state
        const card = action.data.card
        setEnemyField(prev => ({
          ...prev,
          hand: prev.hand.slice(0, -1),
          graveyard: [...prev.graveyard, card],
        }))
        // If it targeted a player unit, apply damage/effect
        if (action.data.targets?.allyUnitIndex != null) {
          const idx = action.data.targets.allyUnitIndex
          setPlayerField(prev => {
            const nUZ = [...prev.unitZone]
            const unit = nUZ[idx]
            if (unit && card.abilityDescription?.toLowerCase().includes("-2dp")) {
              unit.currentDp = Math.max(0, (unit.currentDp ?? unit.dp) - 2)
              if (unit.currentDp <= 0) {
                const nGY = [...prev.graveyard, unit]
                nUZ[idx] = null
                return { ...prev, unitZone: nUZ, graveyard: nGY }
              }
            }
            return { ...prev, unitZone: nUZ }
          })
        }
        break
      }

      case "phase_change":
        // No visual needed — phases are driven by turn ownership
        break

      case "life_change":
        if (action.data.target === "enemy") {
          setEnemyField(prev => ({ ...prev, life: Math.max(0, action.data.newLife) }))
        } else {
          setPlayerField(prev => ({ ...prev, life: Math.max(0, action.data.newLife) }))
        }
        break

      case "field_update":
        if (action.data.enemyField) {
          setEnemyField(prev => ({ ...prev, ...action.data.enemyField }))
        }
        break

      case "tap_to_hand":
        // Opponent moved a card from TAP to hand — update visible hand size
        setEnemyField(prev => ({
          ...prev,
          hand: [...prev.hand, null as any], // opponent drew 1 more card
          tap: prev.tap.filter(t => t?.id !== action.data.card?.id),
        }))
        break

      case "use_ability":
      case "ability_used": {
        const ab = action.data.ability
        // Ullr SR: Marca da Caçada — debuff enemy unit (which is MY unit from opponent's perspective)
        if (ab === "ullrSr" && action.data.targetIndex !== undefined) {
          setPlayerField(prev => {
            const nUZ = [...prev.unitZone]
            const u = nUZ[action.data.targetIndex]
            if (u) {
              nUZ[action.data.targetIndex] = {
                ...u,
                currentDp: Math.max(0, (u.currentDp ?? u.dp) + (action.data.dpChange ?? -1))
              }
            }
            return { ...prev, unitZone: nUZ as (FieldCard|null)[] }
          })
        }
        // Ullr UR: Juramento Eterno — buff opponent's Ventus units (enemy field for me)
        if (ab === "ullrUr" && action.data.bonus) {
          setEnemyField(prev => ({
            ...prev,
            unitZone: prev.unitZone.map(u => {
              if (!u) return null
              if (u.element === "Ventus" || u.element === "Wind") {
                return { ...u, currentDp: (u.currentDp ?? u.dp) + action.data.bonus }
              }
              return u
            }) as (FieldCard|null)[]
          }))
        }
        break
      }
    }
  }, [enemyField, playerField, turn, triggerExplosion])

  // ─── Subscribe to opponent actions ───────────────────────────────────────
  const subscribeToActions = useCallback(() => {
    if (!supabase) return
    if (actionsChannelRef.current) actionsChannelRef.current.unsubscribe()

    const channel = supabase
      .channel(`duel-actions-${roomData.roomId}-${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "duel_actions", filter: `room_id=eq.${roomData.roomId}`,
      }, (payload: { new: any }) => {
        const row = payload.new
        if (row.player_id === playerId) return
        let data = row.action_data
        if (typeof data === "string") { try { data = JSON.parse(data) } catch {} }
        // Always use ref — avoids stale closure capturing old field state
        handleOpponentActionRef.current(data)
        lastActionTimeRef.current = row.created_at
      })
      .subscribe()

    actionsChannelRef.current = channel

    // Aggressive polling fallback: 400ms
    if (actionsPollRef.current) clearInterval(actionsPollRef.current)
    actionsPollRef.current = setInterval(async () => {
      const { data: rows } = await supabase
        .from("duel_actions")
        .select("*")
        .eq("room_id", roomData.roomId)
        .neq("player_id", playerId)
        .gt("created_at", lastActionTimeRef.current)
        .order("sequence_number", { ascending: true })
        .limit(10)
      if (rows && rows.length > 0) {
        for (const row of rows) {
          let actionData = row.action_data
          if (typeof actionData === "string") { try { actionData = JSON.parse(actionData) } catch {} }
          handleOpponentActionRef.current(actionData)
          lastActionTimeRef.current = row.created_at
        }
      }
    }, 400)
  }, [supabase, roomData.roomId, playerId])

  // ─── Online chat ─────────────────────────────────────────────────────────
  const subscribeToChat = useCallback(() => {
    if (!supabase) return
    if (chatChannelRef.current) chatChannelRef.current.unsubscribe()

    const loadChat = async () => {
      const { data } = await supabase.from("duel_chat")
        .select("*").eq("room_id", roomData.roomId).order("created_at", { ascending: true })
      if (data) setOnlineChat(data)
    }
    loadChat()

    const channel = supabase
      .channel(`duel-chat-${roomData.roomId}-${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "duel_chat", filter: `room_id=eq.${roomData.roomId}`,
      }, (payload: { new: any }) => {
        setOnlineChat(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .subscribe()

    chatChannelRef.current = channel
  }, [supabase, roomData.roomId])

  const sendChatMessage = async () => {
    if (!onlineChatInput.trim() || !supabase) return
    const msg = onlineChatInput.trim()
    setOnlineChatInput("")
    await supabase.from("duel_chat").insert({
      room_id: roomData.roomId,
      sender_id: playerId,
      sender_name: roomData.isHost ? roomData.hostName : (roomData.guestName || "Jogador"),
      message: msg,
    })
  }

  // Auto-scroll chat
  useEffect(() => {
    if (onlineChatRef.current) onlineChatRef.current.scrollTop = onlineChatRef.current.scrollHeight
  }, [onlineChat])

  // Cleanup multiplayer on unmount
  useEffect(() => {
    return () => {
      if (actionsChannelRef.current) actionsChannelRef.current.unsubscribe()
      if (chatChannelRef.current)    chatChannelRef.current.unsubscribe()
      if (actionsPollRef.current)    clearInterval(actionsPollRef.current)
    }
  }, [])

  // ─── Start game on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDeck) {
      console.error("[OnlineDuelScreen] selectedDeck is null — cannot start game")
      return
    }
    initGame(selectedDeck, oppDeckTyped)
    subscribeToActions()
    subscribeToChat()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  const endTurn = () => {
    setPhase("end")

    setPlayerField((prev) => ({
      ...prev,
      unitZone: prev.unitZone.map((unit) => (unit ? { ...unit, hasAttacked: false } : null)),
      ultimateZone: prev.ultimateZone ? { ...prev.ultimateZone, hasAttacked: false } : null,
    }))

    setTimeout(() => {
      const nextTurn = turn + 1
      setTurn(nextTurn)
      setIsMyTurn(false)
      setPhase("draw")
      setNormalSummonUsed(false) // reset for next turn

      setEnemyField((prev) => ({
        ...prev,
        unitZone: prev.unitZone.map((unit) =>
          unit ? { ...unit, hasAttacked: false, canAttack: nextTurn > unit.canAttackTurn } : null,
        ),
      }))

      // ── Broadcast end_turn to opponent ──
      sendActionRef.current({
        type: "end_turn",
        playerId,
        data: { turn: nextTurn },
        timestamp: Date.now(),
      })
    }, 500)
  }

  const endEnemyTurn = () => {
    setPhase("end")

    setEnemyField((prev) => ({
      ...prev,
      unitZone: prev.unitZone.map((unit) => (unit ? { ...unit, hasAttacked: false } : null)),
    }))

    // Bot ULLRBOGI: remove +3 DP from Ullr when ending turn (leaving battle phase)
    setEnemyField((prevEnemy) => {
      if (prevEnemy.ultimateZone && prevEnemy.ultimateZone.ability === "ULLRBOGI" && prevEnemy.ultimateZone.requiresUnit) {
        const ullrIdx = prevEnemy.unitZone.findIndex((u) => u && u.name === prevEnemy.ultimateZone!.requiresUnit)
        if (ullrIdx !== -1 && prevEnemy.unitZone[ullrIdx]) {
          const newUnits = [...prevEnemy.unitZone]
          newUnits[ullrIdx] = { ...newUnits[ullrIdx]!, currentDp: Math.max(0, newUnits[ullrIdx]!.currentDp - 3) }
          return { ...prevEnemy, unitZone: newUnits as (FieldCard | null)[] }
        }
      }
      return prevEnemy
    })

    setTimeout(() => {
      const nextTurn = turn + 1
      setTurn(nextTurn)
      setIsMyTurn(true)
      setPhase("draw")
      setJulgamentoDivinoUsedThisTurn(false)

      setPlayerField((prev) => ({
        ...prev,
        unitZone: prev.unitZone.map((unit) =>
          unit ? { ...unit, hasAttacked: false, canAttack: nextTurn > unit.canAttackTurn } : null,
        ),
        ultimateZone: prev.ultimateZone
          ? { ...prev.ultimateZone, hasAttacked: false, canAttack: nextTurn > prev.ultimateZone.canAttackTurn }
          : null,
      }))
    }, 500)
  }

  const surrender = () => {
    // Broadcast surrender to opponent
    sendActionRef.current({
      type: "surrender",
      playerId,
      data: {},
      timestamp: Date.now(),
    })
    setGameResult("lost")
    addMatchRecord({
      id: `match-${Date.now()}`,
      date: new Date().toISOString(),
      opponent: opponentName,
      mode: "online",
      result: "lost",
      deckUsed: selectedDeck?.name || "Unknown",
    })
  }

  const handleEnemyUnitSelect = (index: number) => {
    if (!itemSelectionMode.active || itemSelectionMode.step !== "selectEnemy") return
    const enemyUnit = enemyField.unitZone[index]
    if (!enemyUnit) return

    // FLECHA DE BALISTA: direct enemy unit damage, ignores traps entirely
    if (itemSelectionMode.chosenOption === "flecha_direct" && itemSelectionMode.itemCard) {
      const cardToUse = itemSelectionMode.itemCard
      setItemSelectionMode({ active: false, itemCard: null, step: "selectEnemy", selectedEnemyIndex: null, chosenOption: null })

      const currentDp = enemyUnit.currentDp || enemyUnit.dp
      const newDp = Math.max(0, currentDp - 2)
      const isDestroyed = newDp <= 0

      setEnemyField((prev) => {
        const newUnitZone = [...prev.unitZone]
        const newGraveyard = [...prev.graveyard]
        if (isDestroyed) {
          newGraveyard.push(enemyUnit)
          newUnitZone[index] = null
        } else {
          newUnitZone[index] = { ...enemyUnit, currentDp: newDp }
        }
        return { ...prev, unitZone: newUnitZone as (FieldCard | null)[], graveyard: newGraveyard }
      })

      setPlayerField((prev) => ({
        ...prev,
        graveyard: [...prev.graveyard, cardToUse],
      }))

      if (isDestroyed) {
        showEffectFeedback(`Flecha de Balista! ${enemyUnit.name} destruída!`, "success")
      } else {
        showEffectFeedback(`Flecha de Balista! ${enemyUnit.name} -2DP! (${currentDp} → ${newDp})`, "success")
      }
      return
    }

    // If this is Véu dos Laços Cruzados with "debuff" option, OR Investida Coordenada, resolve immediately
    const isEnemyOnlyCard = itemSelectionMode.itemCard?.name === "Investida Coordenada"
      || itemSelectionMode.itemCard?.name === "Flecha de Balista"
    if ((itemSelectionMode.chosenOption === "debuff" || isEnemyOnlyCard) && itemSelectionMode.itemCard) {
      let effect = getFunctionCardEffect(itemSelectionMode.itemCard)
      if (!effect && itemSelectionMode.itemCard.name === "Véu dos Laços Cruzados") {
        effect = FUNCTION_CARD_EFFECTS["veu-dos-lacos-cruzados"]
      } else if (!effect && itemSelectionMode.itemCard.name === "Investida Coordenada") {
        effect = FUNCTION_CARD_EFFECTS["investida-coordenada"]
      } else if (!effect && itemSelectionMode.itemCard.name === "Flecha de Balista") {
        effect = FUNCTION_CARD_EFFECTS["flecha-de-balista"]
      }

      if (effect) {
        const effectContext: EffectContext = {
          playerField,
          enemyField,
          setPlayerField,
          setEnemyField,
        }

        const targets: EffectTargets = {
          enemyUnitIndices: [index],
          allyUnitIndices: [],
          chosenOption: itemSelectionMode.chosenOption || undefined,
        }

        const cardToUse = itemSelectionMode.itemCard
        setItemSelectionMode({ active: false, itemCard: null, step: "selectEnemy", selectedEnemyIndex: null, chosenOption: null })

        // Use async resolve for dice cards
        resolveEffectWithDice(effect, effectContext, targets, cardToUse.name).then((result) => {
          if (result.success) {
            showEffectFeedback(`${cardToUse.name}: ${result.message}`, "success")
            setPlayerField((prev) => ({
              ...prev,
              graveyard: [...prev.graveyard, cardToUse],
            }))
          } else {
            showEffectFeedback(`${cardToUse.name}: ${result.message || "Falha"}`, "error")
          }
        })
        return
      }
    }

    setItemSelectionMode((prev) => ({
      ...prev,
      step: "selectAlly",
      selectedEnemyIndex: index,
    }))
  }

  const handleAllyUnitSelect = (index: number) => {
    if (!itemSelectionMode.active || itemSelectionMode.step !== "selectAlly") return
    if (!itemSelectionMode.itemCard) return

    // Check if this is a dice card (they don't need selectedEnemyIndex)
    const cardId = getBaseCardId(itemSelectionMode.itemCard.id || "")
    const isDiceCard = cardId.includes("dados-do-destino") || cardId.includes("dados-elementais")

    // For Véu dos Laços Cruzados with "buff" option, we don't need selectedEnemyIndex
    const isVeuBuff = itemSelectionMode.chosenOption === "buff"

    // For cards that ONLY target an ally
    const isAllyOnlyCard = itemSelectionMode.itemCard?.name === "Ventos de Camelot" || itemSelectionMode.itemCard?.name === "Troca de Guarda"

    // Skip the selectedEnemyIndex check for dice cards, buff options, and ally-only cards
    if (itemSelectionMode.selectedEnemyIndex === null && !isVeuBuff && !isDiceCard && !isAllyOnlyCard) return

    const allyUnit = playerField.unitZone[index]
    if (!allyUnit) return

    // For Véu dos Laços Cruzados buff, check if unit is Fehnon or Jaden
    if (isVeuBuff && allyUnit.name !== "Fehnon Hoskie" && allyUnit.name !== "Jaden Hainaegi") {
      showEffectFeedback("Selecione Fehnon Hoskie ou Jaden Hainaegi", "error")
      return
    }

    // Use centralized effect resolver
    let effect = getFunctionCardEffect(itemSelectionMode.itemCard)

    // Fallback: find effect by name
    if (!effect) {
      const isAmplificador = itemSelectionMode.itemCard.name === "Amplificador de Poder"
      const isBandagem = itemSelectionMode.itemCard.name === "Bandagem Restauradora"
      const isAdaga = itemSelectionMode.itemCard.name === "Adaga Energizada"
      const isBandagensDuplas = itemSelectionMode.itemCard.name === "Bandagens Duplas"
      const isCristalRecuperador = itemSelectionMode.itemCard.name === "Cristal Recuperador"
      const isCaudaDeDragao = itemSelectionMode.itemCard.name === "Cauda de Dragão Assada"
      const isProjetilDeImpacto = itemSelectionMode.itemCard.name === "Projétil de Impacto"
      const isVeuDosLacos = itemSelectionMode.itemCard.name === "Véu dos Laços Cruzados"
      const isNucleoExplosivo = itemSelectionMode.itemCard.name === "Núcleo Explosivo"
      const isKitMedico = itemSelectionMode.itemCard.name === "Kit Médico Improvisado"
      const isSoroRecuperador = itemSelectionMode.itemCard.name === "Soro Recuperador"
      const isOrdemDeLaceracao = itemSelectionMode.itemCard.name === "Ordem de Laceração"
      const isSinfoniaRelampago = itemSelectionMode.itemCard.name === "Sinfonia Relâmpago"
      const isFafnisbani = itemSelectionMode.itemCard.name === "Fafnisbani"
      const isDevorarOMundo = itemSelectionMode.itemCard.name === "Devorar o Mundo"
      const isDadosDestinoGentil = itemSelectionMode.itemCard.name === "Dados do Destino Gentil"
      const isDadosElementaisAlpha = itemSelectionMode.itemCard.name === "Dados Elementais Alpha"
      const isDadosElementaisOmega = itemSelectionMode.itemCard.name === "Dados Elementais Omega"
      const isInvestidaCoordenada2 = itemSelectionMode.itemCard.name === "Investida Coordenada"
      const isLacosDaOrdem2 = itemSelectionMode.itemCard.name === "Laços da Ordem"
      const isEstrategiaReal2 = itemSelectionMode.itemCard.name === "Estratégia Real"
      const isVentosDeCamelot2 = itemSelectionMode.itemCard.name === "Ventos de Camelot"
      const isTrocaDeGuarda2 = itemSelectionMode.itemCard.name === "Troca de Guarda"
      const isFlechaDeBalista2 = itemSelectionMode.itemCard.name === "Flecha de Balista"
      const isPedraDeAfiar2 = itemSelectionMode.itemCard.name === "Pedra de Afiar"
      const isDadosCalamidade2 = itemSelectionMode.itemCard.name === "Dados da Calamidade"
      const isChamadoDaTavola2 = itemSelectionMode.itemCard.name === "Chamado da Távola"
      if (isAmplificador) effect = FUNCTION_CARD_EFFECTS["amplificador-de-poder"]
      else if (isBandagem) effect = FUNCTION_CARD_EFFECTS["bandagem-restauradora"]
      else if (isAdaga) effect = FUNCTION_CARD_EFFECTS["adaga-energizada"]
      else if (isBandagensDuplas) effect = FUNCTION_CARD_EFFECTS["bandagens-duplas"]
      else if (isCristalRecuperador) effect = FUNCTION_CARD_EFFECTS["cristal-recuperador"]
      else if (isCaudaDeDragao) effect = FUNCTION_CARD_EFFECTS["cauda-de-dragao-assada"]
      else if (isProjetilDeImpacto) effect = FUNCTION_CARD_EFFECTS["projetil-de-impacto"]
      else if (isVeuDosLacos) effect = FUNCTION_CARD_EFFECTS["veu-dos-lacos-cruzados"]
      else if (isNucleoExplosivo) effect = FUNCTION_CARD_EFFECTS["nucleo-explosivo"]
      else if (isKitMedico) effect = FUNCTION_CARD_EFFECTS["kit-medico-improvisado"]
      else if (isSoroRecuperador) effect = FUNCTION_CARD_EFFECTS["soro-recuperador"]
      else if (isOrdemDeLaceracao) effect = FUNCTION_CARD_EFFECTS["ordem-de-laceracao"]
      else if (isSinfoniaRelampago) effect = FUNCTION_CARD_EFFECTS["sinfonia-relampago"]
      else if (isFafnisbani) effect = FUNCTION_CARD_EFFECTS["fafnisbani"]
      else if (isDevorarOMundo) effect = FUNCTION_CARD_EFFECTS["devorar-o-mundo"]
      else if (isDadosDestinoGentil) effect = FUNCTION_CARD_EFFECTS["dados-do-destino-gentil"]
      else if (isDadosElementaisAlpha) effect = FUNCTION_CARD_EFFECTS["dados-elementais-alpha"]
      else if (isDadosElementaisOmega) effect = FUNCTION_CARD_EFFECTS["dados-elementais-omega"]
      else if (isInvestidaCoordenada2) effect = FUNCTION_CARD_EFFECTS["investida-coordenada"]
      else if (isLacosDaOrdem2) effect = FUNCTION_CARD_EFFECTS["lacos-da-ordem"]
      else if (isEstrategiaReal2) effect = FUNCTION_CARD_EFFECTS["estrategia-real"]
      else if (isVentosDeCamelot2) effect = FUNCTION_CARD_EFFECTS["ventos-de-camelot"]
      else if (isTrocaDeGuarda2) effect = FUNCTION_CARD_EFFECTS["troca-de-guarda"]
      else if (isFlechaDeBalista2) effect = FUNCTION_CARD_EFFECTS["flecha-de-balista"]
      else if (isPedraDeAfiar2) effect = FUNCTION_CARD_EFFECTS["pedra-de-afiar"]
      else if (isDadosCalamidade2) effect = FUNCTION_CARD_EFFECTS["dados-da-calamidade"]
      else if (isChamadoDaTavola2) effect = FUNCTION_CARD_EFFECTS["chamado-da-tavola"]
    }

    if (effect) {
      const effectContext: EffectContext = {
        playerField,
        enemyField,
        setPlayerField,
        setEnemyField,
      }

      const targets: EffectTargets = {
        enemyUnitIndices: itemSelectionMode.selectedEnemyIndex !== null ? [itemSelectionMode.selectedEnemyIndex] : [],
        allyUnitIndices: [index],
        chosenOption: itemSelectionMode.chosenOption || undefined,
      }

      const cardToUse = itemSelectionMode.itemCard
      setItemSelectionMode({ active: false, itemCard: null, step: "selectEnemy", selectedEnemyIndex: null, chosenOption: null })

      // Use async resolve for dice cards
      resolveEffectWithDice(effect, effectContext, targets, cardToUse.name).then((result) => {
        if (result.success) {
          showEffectFeedback(`${cardToUse.name}: ${result.message}`, "success")
          setPlayerField((prev) => ({
            ...prev,
            graveyard: [...prev.graveyard, cardToUse],
          }))
          // ── Broadcast item card use ──
          sendActionRef.current({
            type: "use_function_card", playerId,
            data: {
              card: cardToUse,
              targets: {
                enemyUnitIndex: targets.enemyUnitIndices?.[0] ?? null,
                allyUnitIndex: targets.allyUnitIndices?.[0] ?? null,
              },
            },
            timestamp: Date.now(),
          })
        } else {
          showEffectFeedback(`${cardToUse.name}: ${result.message || "Falha"}`, "error")
        }
      })
      return
    }
  }

  const cancelItemSelection = () => {
    if (itemSelectionMode.itemCard) {
      setPlayerField((prev) => ({
        ...prev,
        hand: [...prev.hand, itemSelectionMode.itemCard!],
      }))
    }
    setItemSelectionMode({ active: false, itemCard: null, step: "selectEnemy", selectedEnemyIndex: null, chosenOption: null })
  }

  useEffect(() => {
    if (!gameStarted || gameResultRecordedRef.current) return

    if (playerField.life <= 0) {
      gameResultRecordedRef.current = true
      setGameResult("lost")
      addMatchRecord({
        id: `match-${Date.now()}`,
        date: new Date().toISOString(),
        opponent: opponentName,
        mode: "online",
        result: "lost",
        deckUsed: selectedDeck?.name || "Unknown",
      })
    } else if (enemyField.life <= 0) {
      gameResultRecordedRef.current = true
      setGameResult("won")
      addMatchRecord({
        id: `match-${Date.now()}`,
        date: new Date().toISOString(),
        opponent: opponentName,
        mode: "online",
        result: "won",
        deckUsed: selectedDeck?.name || "Unknown",
      })
    }
  }, [playerField.life, enemyField.life, gameStarted, mode, selectedDeck?.name])


  // Online: show loading until game initializes
  if (!gameStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-xl font-bold">Iniciando duelo...</p>
          <p className="text-slate-400 text-sm mt-2">Conectando com {opponentName}</p>
        </div>
      </div>
    )
  }

  if (gameResult) {
    return <GameResultScreen result={gameResult} onBack={onBack} />
  }

  return (
    <div
      ref={fieldRef}
      suppressHydrationWarning={true}
      className={`relative h-screen flex flex-col overflow-hidden select-none touch-none`}
      style={{
        background: "#04030d",
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
      {/* Animated starfield — sits at z-0 behind all UI */}
      <StarfieldCanvas />
      {activeProjectiles.map((proj) => (
        <ElementalAttackAnimation
          key={proj.id}
          {...proj}
          portalTarget={fieldRef.current}
          onImpact={handleImpact}
          onComplete={handleAnimationComplete}
        />
      ))}

      {/* Impact Flash Overlay - Epic cinematic effect */}
      {impactFlash.active && (
        <div
          className="absolute inset-0 z-50 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${impactFlash.color} 0%, transparent 70%)`,
            animation: "epicFlash 0.25s ease-out forwards"
          }}
        />
      )}

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

      <canvas
        ref={explosionCanvasRef}
        className="fixed inset-0 pointer-events-none z-[60]"
        style={{ width: "100vw", height: "100vh" }}
      />

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
            <filter id="professionalGlow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 0.3 0 0 0  0 0 0.3 0 0  0 0 0 0.5 0"
                result="redBlur"
              />
              <feMerge>
                <feMergeNode in="redBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
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

          {/* Main arrow with border effect */}
          <line
            x1={arrowPos.x1}
            y1={arrowPos.y1}
            x2={arrowPos.x2}
            y2={arrowPos.y2}
            stroke="#b91c1c"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Main arrow */}
          <line
            ref={arrowRef}
            x1={arrowPos.x1}
            y1={arrowPos.y1}
            x2={arrowPos.x2}
            y2={arrowPos.y2}
            stroke="url(#arrowGradient)"
            strokeWidth="4"
            markerEnd="url(#arrowhead)"
            filter="url(#professionalGlow)"
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
            <span className="text-xs text-slate-400">Oponente</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-red-400">LP: {enemyField.life}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center px-4 py-1 bg-black/50 rounded-lg border border-amber-500/30">
            <span className="text-xs text-slate-400">{t("turn")}</span>
            <span className="block text-2xl font-bold text-amber-400">{turn}</span>
          </div>
          {false /* online: no bot */ && (
            <div className={`px-2 py-1 rounded text-[9px] font-bold border ${
              difficulty === 'easy' ? 'bg-green-900/50 border-green-600/40 text-green-300'
              : difficulty === 'medium' ? 'bg-amber-900/50 border-amber-600/40 text-amber-300'
              : 'bg-red-900/50 border-red-600/40 text-red-300'
            }`}>
              {difficulty === 'easy' ? '🟢 Fácil' : difficulty === 'medium' ? '🟡 Médio' : '🔴 Difícil'}
            </div>
          )}
          <div
            className={`px-4 py-2 rounded-lg text-sm font-bold border-2 ${isMyTurn
              ? "bg-green-600/20 border-green-500 text-green-400"
              : "bg-red-600/20 border-red-500 text-red-400"
              }`}
          >
            {isMyTurn ? t("yourTurn") : t("enemyTurn")}
          </div>
          {/* Morgana passive effects indicator */}
          {playerField.unitZone.some(u => u && u.name.toLowerCase().includes("morgana") && (u.dp === 3 || u.dp === 4)) && (
            <div className="px-2 py-1 rounded text-[9px] font-bold bg-purple-900/60 border border-purple-500/50 text-purple-300">
              {playerField.unitZone.some(u => u && u.name.toLowerCase().includes("morgana") && u.dp === 4)
                ? "🌑 Actions+Traps bloqueados"
                : "🌑 Traps bloqueadas"}
            </div>
          )}
        </div>

        <Button onClick={surrender} size="sm" variant="ghost" className="text-slate-400 hover:text-red-400">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("surrender")}
        </Button>
      </div>

      {/* Enemy hand (card backs) */}
      <div className="relative z-10 flex justify-center py-1">
        <div className="flex gap-1">
          {enemyField.hand.map((_, i) => (
            <div
              key={i}
              className="w-6 h-8 bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800 rounded border border-slate-500/50 shadow-md"
              style={{
                transform: `rotate(${(i - enemyField.hand.length / 2) * 3}deg) translateY(${Math.abs(i - enemyField.hand.length / 2) * 2}px)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Battle Area — centered arena */}
      <div className="flex-1 flex items-center justify-center px-2 py-1">
        <div
          className="relative w-full max-w-xl mx-auto rounded-xl overflow-hidden"
          style={{
            aspectRatio: "9/16",
            maxHeight: "calc(100vh - 220px)",
            boxShadow: "0 0 30px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,0,0,0.3)",
          }}
        >
          {/* Playmat container with border */}
          <div className="absolute inset-0 rounded-xl border-4 border-amber-600/30 bg-gradient-to-b from-slate-900/90 to-slate-800/90">
            {/* Enemy side background */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-red-950/30 to-transparent" />

            {/* Player Playmat Background */}
            {(() => {
              const playmat = selectedDeck ? getPlaymatForDeck(selectedDeck) : null
              if (playmat) {
                return (
                  <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden">
                    <img
                      src={playmat.image || "/placeholder.svg"}
                      alt={playmat.name}
                      className="w-full h-full object-cover"
                      style={{ opacity: 0.75 }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-slate-900/60" />
                  </div>
                )
              }
              return (
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-950/30 to-transparent" />
              )
            })()}
          </div>

          {/* Field content */}
          <div className="relative h-full flex flex-col justify-between p-1 pb-2 z-10">
            {/* Enemy Field */}
            <div className="flex justify-center items-center gap-2">
              {/* Enemy Deck, Graveyard, Scenario and Ultimate */}
              <div className="flex items-start gap-1.5">
                <div className="flex gap-1.5">
                  <div className="flex flex-col gap-1.5">
                    <div
                      ref={enemyGraveyardRef}
                      className="w-16 h-24 bg-purple-900/80 rounded text-sm text-purple-300 flex items-center justify-center border border-purple-500/50 cursor-pointer hover:bg-purple-800/80 transition-colors"
                      onClick={() => setGraveyardView("enemy")}
                    >
                      {enemyField.graveyard.length}
                    </div>
                    <div ref={enemyDeckRef} className="w-16 h-24 relative">
                      {enemyField.deck.length > 0 ? (
                        <>
                          {[...Array(Math.min(Math.ceil(enemyField.deck.length / 6), 6))].map((_, i) => (
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
                              {enemyField.deck.length}
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
                    className="w-16 h-24 bg-orange-600/80 rounded text-[10px] text-white flex flex-col items-center justify-center font-bold border border-orange-400/50 cursor-pointer hover:bg-orange-500/80 transition-animation"
                    onClick={() => setTapView("enemy")}
                  >
                    <span className="opacity-70">TAP</span>
                    <span>{enemyField.tap.length}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {/* Enemy Scenario Zone - Horizontal slot, aligned with unit zone */}
                  <div className="h-16 w-24 bg-amber-900/40 border border-amber-600/40 rounded flex items-center justify-center relative overflow-hidden">
                    {enemyField.scenarioZone ? (
                      <Image
                        src={enemyField.scenarioZone.image || "/placeholder.svg"}
                        alt={enemyField.scenarioZone.name}
                        fill
                        className="object-cover rounded"
                        onMouseDown={() => handleCardPressStart(enemyField.scenarioZone!)}
                        onMouseUp={handleCardPressEnd}
                        onMouseLeave={handleCardPressEnd}
                        onTouchStart={() => handleCardPressStart(enemyField.scenarioZone!)}
                        onTouchEnd={handleCardPressEnd}
                      />
                    ) : (
                      <span className="text-amber-500/50 text-[8px] text-center">SCENARIO</span>
                    )}
                  </div>
                  {/* Enemy Ultimate Zone - single slot, green */}
                  <div className="w-16 h-24 bg-emerald-900/40 border border-emerald-600/40 rounded flex items-center justify-center relative overflow-hidden">
                    {enemyField.ultimateZone ? (
                      <Image
                        src={enemyField.ultimateZone.image || "/placeholder.svg"}
                        alt={enemyField.ultimateZone.name}
                        fill
                        className="object-cover rounded"
                        onMouseDown={() => handleCardPressStart(enemyField.ultimateZone!)}
                        onMouseUp={handleCardPressEnd}
                        onMouseLeave={handleCardPressEnd}
                        onTouchStart={() => handleCardPressStart(enemyField.ultimateZone!)}
                        onTouchEnd={handleCardPressEnd}
                      />
                    ) : null}
                    {enemyField.ultimateZone && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-center text-xs text-white font-bold py-0.5">
                        {enemyField.ultimateZone.currentDp} DP
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Enemy Zones */}
              <div className="flex flex-col gap-2">
                {/* Enemy Function Zone */}
                <div className="flex justify-center items-center gap-2">
                  {enemyField.functionZone.map((card, i) => {
                    const isUgTarget = ugTargetMode.active && card && (
                      ugTargetMode.type === "oden_sword" || ugTargetMode.type === "twiligh_avalon" || ugTargetMode.type === "mefisto"
                    )
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (ugTargetMode.active && (ugTargetMode.type === "oden_sword" || ugTargetMode.type === "mefisto") && card) {
                            handleUgTargetEnemyFunction(i)
                          } else if (ugTargetMode.active && (ugTargetMode.type === "twiligh_avalon" || ugTargetMode.type === "mefisto") && card) {
                            handleUgTargetEnemyCard("function", i)
                          } else if (julgamentoVazioTargetMode.active && card) {
                            handleJulgamentoVazioTarget("function", i)
                          }
                        }}
                        className={`w-16 h-24 bg-purple-900/40 border-2 rounded flex items-center justify-center relative overflow-hidden transition-all ${isUgTarget || (julgamentoVazioTargetMode.active && card)
                          ? "border-yellow-400 cursor-pointer hover:bg-yellow-900/30 ring-2 ring-yellow-400/50 animate-pulse"
                          : "border-purple-600/40"
                          }`}
                      >
                        {card && (
                          <div className={`absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d] ${card.isFaceDown ? '' : '[transform:rotateY(180deg)]'}`}>
                            <div className="absolute inset-0 [backface-visibility:hidden]">
                              <Image
                                src={CARD_BACK_IMAGE || "/placeholder.svg"}
                                alt="Face down card"
                                fill
                                className="object-cover rounded"
                              />
                            </div>
                            <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                              <Image
                                src={card.image || "/placeholder.svg"}
                                alt={card.name}
                                fill
                                className="object-cover rounded"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Enemy Unit Zone */}
                <div className="flex justify-center items-center gap-2">
                  {enemyField.unitZone.map((card, i) => (
                    <div
                      key={i}
                      data-enemy-unit={i}
                      onClick={() => {
                        if (mrpTargetMode && card) {
                          handleMrpTarget(i)
                        } else if (ugTargetMode.active && (ugTargetMode.type === "twiligh_avalon" || ugTargetMode.type === "mefisto") && card) {
                          handleUgTargetEnemyCard("unit", i)
                        } else if (ugTargetMode.active && ugTargetMode.type === "julgamento_divino" && card) {
                          handleJulgamentoDivinoTarget(i)
                        } else if (julgamentoVazioTargetMode.active && card) {
                          handleJulgamentoVazioTarget("unit", i)
                        } else if (itemSelectionMode.active && itemSelectionMode.step === "selectEnemy") {
                          handleEnemyUnitSelect(i)
                        }
                      }}
                      className={`w-16 h-24 bg-red-900/30 border-2 rounded relative overflow-hidden transition-all ${(mrpTargetMode && card) ||
                        (ugTargetMode.active && (ugTargetMode.type === "twiligh_avalon" || ugTargetMode.type === "mefisto" || ugTargetMode.type === "julgamento_divino") && card) ||
                        (julgamentoVazioTargetMode.active && card)
                        ? "border-yellow-400 cursor-pointer hover:bg-yellow-900/30 ring-2 ring-yellow-400/50 animate-pulse"
                        : attackTarget?.type === "unit" && attackTarget.index === i
                          ? "border-red-500 ring-2 ring-red-400 scale-105"
                          : itemSelectionMode.active && itemSelectionMode.step === "selectEnemy" && card
                            ? "border-yellow-500 cursor-pointer hover:bg-yellow-900/30"
                            : "border-red-700/40"
                        }`}
                    >
                      {card && (
                        <>
                          <Image
                            src={card.image || "/placeholder.svg"}
                            alt={card.name}
                            fill
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
                  {phase === "draw" ? "DRAW" : phase === "main" ? "MAIN" : "BATTLE"}
                </span>
                <div className="flex-1 h-0.5 bg-gradient-to-l from-transparent via-amber-500/60 to-amber-500" />
              </div>
            </div>

            {/* Player Field */}
            <div className="flex justify-center items-center gap-2">
              {/* Player Zones */}
              <div className="flex flex-col gap-2">
                {/* Player Unit Zone */}
                <div className="flex justify-center items-center gap-2">
                  {playerField.unitZone.map((card, i) => {
                    const isDropTarget =
                      draggedHandCard &&
                      isUnitCard(draggedHandCard.card) &&
                      !card &&
                      draggedHandCard.currentY! < window.innerHeight * 0.6
                    const canAttack = card && canUnitAttackNow(card as FieldCard)

                    // Determine if this card has an activatable ability
                    const cardName = card?.name.toLowerCase() ?? ''
                    // Only cards with a MANUAL main-phase ability get the green glow.
                    // Attack-triggered effects (Arthur Veredito/Cálice, Mordred Camlann) do NOT need a click — they fire automatically when the player drags to attack.
                    const hasAbility = card && isMyTurn && phase === "main" && (
                      (cardName.includes("merlin") && !merlinUsed) ||
                      (cardName.includes("oswin") && !oswinUsed) ||
                      ((cardName.includes("mr. p") || cardName.includes("mr p") || cardName.includes("penguim")) && !mrPManuscritoUsed) ||
                      (cardName.includes("hrotti") && card.dp === 2 && (hrottiSrLastTurn === null || turn - hrottiSrLastTurn >= 3)) ||
                      (cardName.includes("hrotti") && card.dp === 3 && !hrottiUrUsed) ||
                      (cardName.includes("ullr") && card.dp === 2 && !ullrSrMarcaUsed) ||
                      (cardName.includes("ullr") && card.dp === 3 && (ullrUrJuramentoLastTurn === null || turn - ullrUrJuramentoLastTurn >= 4))
                    )
                    const getAbilityFn = (): (() => void) | null => {
                      if (!card) return null
                      if (cardName.includes("merlin") && !merlinUsed) return activateMerlinAbility
                      if (cardName.includes("oswin") && !oswinUsed) return activateOswinAbility
                      if ((cardName.includes("mr. p") || cardName.includes("mr p") || cardName.includes("penguim")) && !mrPManuscritoUsed) return activateMrPAbility
                      if (cardName.includes("hrotti") && card.dp === 2 && (hrottiSrLastTurn === null || turn - hrottiSrLastTurn >= 3)) return activateHrottiSrAbility
                      if (cardName.includes("hrotti") && card.dp === 3 && !hrottiUrUsed) return activateHrottiUrAbility
                      if (cardName.includes("ullr") && card.dp === 2 && !ullrSrMarcaUsed) return activateUllrSrAbility
                      if (cardName.includes("ullr") && card.dp === 3 && (ullrUrJuramentoLastTurn === null || turn - ullrUrJuramentoLastTurn >= 4)) return activateUllrUrAbility
                      return null
                    }

                    return (
                      <div
                        key={i}
                        data-player-unit-slot={i}
                        onClick={() => {
                          if (selectedHandCard !== null) {
                            placeCard("unit", i)
                          } else if (itemSelectionMode.active && itemSelectionMode.step === "selectAlly" && card) {
                            handleAllyUnitSelect(i)
                          } else if (hasAbility && getAbilityFn()) {
                            setUnitAbilityConfirm({ name: card!.name, abilityKey: (() => {
                          if (cardName.includes('merlin') && !merlinUsed) return 'merlin'
                          if (cardName.includes('oswin') && !oswinUsed) return 'oswin'
                          if ((cardName.includes('mr. p') || cardName.includes('mr p') || cardName.includes('penguim')) && !mrPManuscritoUsed) return 'mrp'
                          if (cardName.includes('hrotti') && card.dp === 2 && (hrottiSrLastTurn === null || turn - hrottiSrLastTurn >= 3)) return 'hrottiSr'
                          if (cardName.includes('hrotti') && card.dp === 3 && !hrottiUrUsed) return 'hrottiUr'
                          if (cardName.includes('ullr') && card.dp === 2 && !ullrSrMarcaUsed) return 'ullrSr'
                          if (cardName.includes('ullr') && card.dp === 3 && (ullrUrJuramentoLastTurn === null || turn - ullrUrJuramentoLastTurn >= 4)) return 'ullrUr'
                          return ''
                        })() })
                          }
                        }}
                        className={`w-16 h-24 bg-blue-900/30 border-2 rounded relative overflow-hidden transition-all duration-75 ${dropTarget?.type === "unit" && dropTarget?.index === i && !card
                          ? "border-green-400 bg-green-500/60 scale-115 shadow-lg shadow-green-500/50 ring-2 ring-green-400/50 animate-pulse"
                          : isDropTarget
                            ? "border-green-400/70 bg-green-500/30 scale-105"
                            : selectedHandCard !== null && isUnitCard(playerField.hand[selectedHandCard])
                              ? "border-green-500 bg-green-900/40 cursor-pointer"
                              : draggedHandCard && isUnitCard(draggedHandCard.card)
                                ? "border-blue-400/50 bg-blue-500/20"
                                : itemSelectionMode.active && itemSelectionMode.step === "selectAlly" && card
                                  ? "border-yellow-500 cursor-pointer hover:bg-yellow-900/30"
                                  : hasAbility
                                    ? "border-emerald-400 cursor-pointer shadow-[0_0_12px_3px_rgba(52,211,153,0.7)]"
                                    : canAttack
                                      ? "border-yellow-400 shadow-lg shadow-yellow-500/40"
                                      : "border-blue-700/40"
                          }`}
                        style={{
                          transform: cardAnimations[`player-${i}`] || "none",
                          zIndex: cardAnimations[`player-${i}`] ? 50 : 1,
                        }}
                      >
                        {/* Green glow for ability-ready cards */}
                        {hasAbility && (
                          <div className="absolute -inset-1 bg-emerald-400/30 rounded blur-sm animate-pulse -z-10" />
                        )}
                        {/* Yellow glow for attackable cards */}
                        {!hasAbility && canAttack && (
                          <div className="absolute -inset-1 bg-yellow-400/40 rounded blur-sm animate-pulse -z-10" />
                        )}
                        {card && (
                          <>
                            <Image
                              src={card.image || "/placeholder.svg"}
                              alt={card.name}
                              fill
                              className="object-cover"
                              onMouseDown={(e) => {
                                if (canAttack && !hasAbility) {
                                  handleAttackStart(i, e)
                                } else {
                                  handleCardPressStart(card)
                                }
                              }}
                              onMouseUp={handleCardPressEnd}
                              onMouseLeave={handleCardPressEnd}
                              onTouchStart={(e) => {
                                if (canAttack && !hasAbility) {
                                  handleAttackStart(i, e)
                                } else {
                                  handleCardPressStart(card)
                                }
                              }}
                              onTouchEnd={handleCardPressEnd}
                            />
                            {canAttack && !hasAbility && (
                              <div className="absolute top-0 left-0 right-0 bg-green-500 text-white text-[10px] text-center font-bold animate-pulse">
                                {t("dragToAttack")}
                              </div>
                            )}
                            {hasAbility && (
                              <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 text-white text-[8px] text-center font-bold py-0.5">
                                ✦ HABILIDADE
                              </div>
                            )}
                            {!canAttack && !hasAbility && card && turn <= (card as FieldCard).canAttackTurn && (
                              <div className="absolute top-0 left-0 right-0 bg-amber-600/90 text-white text-[8px] text-center">
                                T{(card as FieldCard).canAttackTurn + 1}
                              </div>
                            )}
                          </>
                        )}
                        {!card && isDropTarget && (
                          <span className="text-green-400 text-xs font-bold animate-pulse">SOLTAR</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Player Function Zone */}
                <div className="flex justify-center items-center gap-2">
                  {playerField.functionZone.map((card, i) => {
                    const isDropTarget =
                      draggedHandCard &&
                      !isUnitCard(draggedHandCard.card) &&
                      !card &&
                      draggedHandCard.currentY! < window.innerHeight * 0.6

                    return (
                      <div
                        key={i}
                        data-player-func-slot={i}
                        onClick={() => selectedHandCard !== null && placeCard("function", i)}
                        className={`w-16 h-24 bg-purple-900/30 border-2 rounded flex items-center justify-center cursor-pointer transition-all duration-75 relative overflow-hidden ${dropTarget?.type === "function" && dropTarget?.index === i && !card
                          ? "border-green-400 bg-green-500/60 scale-115 shadow-lg shadow-green-500/50 ring-2 ring-green-400/50 animate-pulse"
                          : isDropTarget
                            ? "border-green-400/70 bg-green-500/30 scale-105"
                            : selectedHandCard !== null && !isUnitCard(playerField.hand[selectedHandCard])
                              ? "border-green-500 bg-green-900/40"
                              : draggedHandCard && !isUnitCard(draggedHandCard.card)
                                ? "border-purple-400/50 bg-purple-500/20"
                                : "border-purple-600/40"
                          }`}
                      >
                        {card && (
                          <div className={`absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d] ${card.isFaceDown ? '' : '[transform:rotateY(180deg)]'}`}>
                            {/* Back of Card */}
                            <div className="absolute inset-0 [backface-visibility:hidden]">
                              <Image
                                src={CARD_BACK_IMAGE || "/placeholder.svg"}
                                alt="Face down card"
                                fill
                                className="object-cover rounded"
                                onMouseDown={() => handleCardPressStart(card)}
                                onMouseUp={handleCardPressEnd}
                                onMouseLeave={handleCardPressEnd}
                                onTouchStart={() => handleCardPressStart(card)}
                                onTouchEnd={handleCardPressEnd}
                              />
                            </div>
                            {/* Front of Card */}
                            <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                              <Image
                                src={card.image || "/placeholder.svg"}
                                alt={card.name}
                                fill
                                className="object-cover rounded"
                                onMouseDown={() => handleCardPressStart(card)}
                                onMouseUp={handleCardPressEnd}
                                onMouseLeave={handleCardPressEnd}
                                onTouchStart={() => handleCardPressStart(card)}
                                onTouchEnd={handleCardPressEnd}
                              />
                            </div>
                          </div>
                        )}
                        {!card && isDropTarget && (
                          <span className="text-green-400 text-[10px] font-bold animate-pulse">SOLTAR</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Player Scenario, Ultimate Zone and Deck/Graveyard */}
              <div className="flex items-start gap-1.5">
                <div className="flex flex-col gap-1.5">
                  {/* Player Scenario Zone - Horizontal slot, aligned with unit zone */}
                  <div
                    data-player-scenario-slot
                    onClick={() => selectedHandCard !== null && playerField.hand[selectedHandCard]?.type === "scenario" && placeScenarioCard()}
                    className={`h-16 w-24 bg-amber-900/30 border-2 rounded flex items-center justify-center relative overflow-hidden transition-all duration-75 ${dropTarget?.type === "scenario" && !playerField.scenarioZone
                      ? "border-green-400 bg-green-500/60 scale-110 shadow-lg shadow-green-500/50 ring-2 ring-green-400/50 animate-pulse"
                      : selectedHandCard !== null && playerField.hand[selectedHandCard]?.type === "scenario"
                        ? "border-green-500 bg-green-900/40 cursor-pointer"
                        : draggedHandCard && draggedHandCard.card.type === "scenario"
                          ? "border-amber-400/50 bg-amber-500/20"
                          : "border-amber-600/40"
                      }`}
                  >
                    {playerField.scenarioZone ? (
                      <Image
                        src={playerField.scenarioZone.image || "/placeholder.svg"}
                        alt={playerField.scenarioZone.name}
                        fill
                        className="object-cover rounded"
                        onMouseDown={() => handleCardPressStart(playerField.scenarioZone!)}
                        onMouseUp={handleCardPressEnd}
                        onMouseLeave={handleCardPressEnd}
                        onTouchStart={() => handleCardPressStart(playerField.scenarioZone!)}
                        onTouchEnd={handleCardPressEnd}
                      />
                    ) : (
                      <span className="text-amber-500/50 text-[8px] text-center">SCENARIO</span>
                    )}
                  </div>
                  {/* Player Ultimate Zone - single green slot below scenario */}
                  <div
                    data-player-ultimate-slot
                    onClick={() => selectedHandCard !== null && playerField.hand[selectedHandCard] && isUltimateCard(playerField.hand[selectedHandCard]) && placeUltimateCard()}
                    className={`w-16 h-24 bg-emerald-900/30 border-2 rounded flex items-center justify-center relative overflow-hidden transition-all duration-75 ${dropTarget?.type === "ultimate" && !playerField.ultimateZone
                      ? "border-green-400 bg-green-500/60 scale-110 shadow-lg shadow-green-500/50 ring-2 ring-green-400/50 animate-pulse"
                      : selectedHandCard !== null && playerField.hand[selectedHandCard] && isUltimateCard(playerField.hand[selectedHandCard])
                        ? "border-emerald-400 bg-emerald-900/40 cursor-pointer"
                        : draggedHandCard && isUltimateCard(draggedHandCard.card)
                          ? "border-emerald-400/50 bg-emerald-500/20"
                          : "border-emerald-600/40"
                      }`}
                  >
                    {playerField.ultimateZone ? (
                      <>
                        <Image
                          src={playerField.ultimateZone.image || "/placeholder.svg"}
                          alt={playerField.ultimateZone.name}
                          fill
                          className="object-cover rounded"
                          onMouseDown={() => handleCardPressStart(playerField.ultimateZone!)}
                          onMouseUp={handleCardPressEnd}
                          onMouseLeave={handleCardPressEnd}
                          onTouchStart={() => handleCardPressStart(playerField.ultimateZone!)}
                          onTouchEnd={handleCardPressEnd}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-center text-xs text-white font-bold py-0.5">
                          {playerField.ultimateZone.currentDp} DP
                        </div>
                        {/* Activate button for one-time abilities (ODEN SWORD, TWILIGH AVALON, MEFISTO) */}
                        {isMyTurn && phase === "main" && !playerUgAbilityUsed && !ugTargetMode.active &&
                          (playerField.ultimateZone.ability === "ODEN SWORD" || playerField.ultimateZone.ability === "TWILIGH AVALON" || playerField.ultimateZone.ability === "MEFISTO") &&
                          playerField.ultimateZone.requiresUnit &&
                          findUnitByName(playerField.unitZone, playerField.ultimateZone.requiresUnit) !== -1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); activateUgAbility() }}
                              className="absolute -top-5 left-1/2 -translate-x-1/2 bg-yellow-500 hover:bg-yellow-400 text-black text-[7px] font-bold px-1.5 py-0.5 rounded shadow-lg shadow-yellow-500/50 animate-pulse whitespace-nowrap z-10"
                            >
                              ATIVAR
                            </button>
                          )}
                        {/* Activate button for Julgamento Divino (MIGUEL ARCANJO - once per turn) */}
                        {isMyTurn && phase === "main" && !julgamentoDivinoUsedThisTurn && !ugTargetMode.active &&
                          playerField.ultimateZone.ability === "MIGUEL ARCANJO" &&
                          playerField.ultimateZone.requiresUnit &&
                          findUnitByName(playerField.unitZone, playerField.ultimateZone.requiresUnit) !== -1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); activateUgAbility() }}
                              className="absolute -top-8 left-1/2 -translate-x-1/2 bg-purple-600 hover:bg-purple-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded shadow-lg shadow-purple-500/50 animate-pulse whitespace-nowrap z-10"
                            >
                              JULGAMENTO
                            </button>
                          )}
                      </>
                    ) : null}
                    {!playerField.ultimateZone && dropTarget?.type === "ultimate" && (
                      <span className="text-green-400 text-[10px] font-bold animate-pulse">SOLTAR</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="flex flex-col gap-1.5">
                    <div ref={playerDeckRef} className="w-16 h-24 relative">
                      {playerField.deck.length > 0 ? (
                        <>
                          {[...Array(Math.min(Math.ceil(playerField.deck.length / 6), 6))].map((_, i) => (
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
                              {playerField.deck.length}
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
                      ref={playerGraveyardRef}
                      className="w-16 h-24 bg-purple-900/80 rounded text-sm text-purple-300 flex items-center justify-center border border-purple-500/50 cursor-pointer hover:bg-purple-800/80 transition-colors"
                      onClick={() => setGraveyardView("player")}
                    >
                      {playerField.graveyard.length}
                    </div>
                  </div>
                    {/* TAP Pile Button with availability glow and card preview */}
                    {(() => {
                      const isTapAvailable = turn > 0 && turn % 3 === 0 && isMyTurn && phase === "main" && playerField.tap.length > 0
                      return (
                        <div className="relative group/tap">
                          <div
                            className={`w-16 h-24 rounded text-[10px] text-white flex flex-col items-center justify-center font-bold border transition-all duration-300 cursor-pointer relative z-10 ${isTapAvailable
                              ? "bg-orange-600/90 border-orange-400"
                              : "bg-slate-800/80 border-slate-700/50 opacity-60 grayscale-[0.5]"
                              }`}
                            onClick={() => setTapView("player")}
                          >
                            {isTapAvailable && (
                              <div className="absolute -inset-1 bg-orange-500/20 rounded pointer-events-none" />
                            )}
                            <span className={`opacity-70 ${isTapAvailable ? "text-orange-200" : ""}`}>TAP</span>
                            <span className={isTapAvailable ? "text-xl mt-1" : ""}>{playerField.tap.length}</span>
                            {isTapAvailable && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" />
                            )}
                          </div>

                          {/* TAP Card Preview - Only shown when available */}
                          {isTapAvailable && playerField.tap.length > 0 && (
                            <div className="absolute left-full top-0 ml-4 flex gap-1 animate-in slide-in-from-left-4 fade-in duration-500 pointer-events-none">
                              {playerField.tap.slice(0, 3).map((card, idx) => (
                                <div 
                                  key={idx} 
                                  className="w-10 h-14 rounded border border-orange-500/50 overflow-hidden shadow-lg shadow-black/50 bg-slate-900"
                                  style={{ 
                                    transform: `translateX(-${idx * 15}px) rotate(${idx * 5 - 5}deg)`,
                                    zIndex: 5 - idx 
                                  }}
                                >
                                  <Image src={card.image || "/placeholder.svg"} alt="" fill className="object-cover" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                </div>
                              ))}
                              {playerField.tap.length > 3 && (
                                <div className="w-6 h-14 flex items-center justify-center text-[8px] font-black text-orange-400 bg-black/40 rounded border border-orange-500/20 backdrop-blur-sm -ml-4">
                                  +{playerField.tap.length - 3}
                                </div>
                              )}
                            </div>
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


      {/* Bottom HUD */}
      <div className="relative z-20 bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-1 pb-2 px-4">
        {/* Player LP bar + phase buttons */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold">P1</span>
            </div>
            <div>
              <span className="text-xs text-slate-400">Você</span>
              <div className="text-xl font-bold text-blue-400">LP: {playerField.life}</div>
            </div>
          </div>

          {/* Phase buttons */}
          <div className="flex gap-2 min-h-[40px]">
            {isMyTurn && phase === "draw" && (
              <Button
                onClick={advancePhase}
                size="default"
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold px-6 shadow-lg shadow-green-500/30"
              >
                {t("drawCard")}
              </Button>
            )}
            {isMyTurn && phase === "main" && (
              <Button
                onClick={advancePhase}
                size="default"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-6 shadow-lg shadow-blue-500/30"
              >
                {t("toBattle")}
              </Button>
            )}
            {isMyTurn && phase === "battle" && (
              <Button
                onClick={endTurn}
                size="default"
                className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold px-6 shadow-lg shadow-amber-500/30"
              >
                {t("endTurn")}
              </Button>
            )}
          </div>
        </div>

        {/* Player Hand - PROMINENT display */}
        <div className="flex justify-center -mt-14 min-h-28">
          <div ref={handContainerRef} className="flex gap-3 items-end">
            {playerField.hand.map((card, i) => {
              const offset = i - (playerField.hand.length - 1) / 2
              const rotation = offset * 4
              const translateY = Math.abs(offset) * 5
              const isSelected = selectedHandCard === i
              const isDragging = draggedHandCard?.index === i

              // Check if card can be played: must be player turn, main phase, and have space in appropriate zone
              const hasSpaceInZone = isUltimateCard(card)
                ? playerField.ultimateZone === null
                : card.type === "scenario"
                  ? playerField.scenarioZone === null
                  : isUnitCard(card)
                    ? playerField.unitZone.some(slot => slot === null) && !normalSummonUsed
                    : playerField.functionZone.some(slot => slot === null)
              const canPlay = isMyTurn && phase === "main" && hasSpaceInZone

              return (
                <div
                  key={`hand-${card.id}-${i}`}
                  onMouseDown={(e) => {
                    handleCardPressStart(card)
                    if (canPlay) {
                      handleHandCardDragStart(i, e)
                    }
                  }}
                  onMouseUp={handleCardPressEnd}
                  onMouseLeave={handleCardPressEnd}
                  onTouchStart={(e) => {
                    handleCardPressStart(card)
                    if (canPlay) {
                      handleHandCardDragStart(i, e)
                    }
                  }}
                  onTouchEnd={handleCardPressEnd}
                  onClick={() => {
                    handleCardPressEnd()
                    if (canPlay && !draggedHandCard) {
                      setSelectedHandCard(i === selectedHandCard ? null : i)
                    }
                  }}
                  className={`relative cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-0 scale-75" : "opacity-100"
                    } ${!canPlay ? "opacity-60 cursor-not-allowed" : ""}`}
                  style={{
                    transform: `rotate(${rotation}deg) translateY(${isSelected ? -24 : translateY}px) scale(${isSelected ? 1.08 : 1})`,
                    zIndex: isSelected ? 100 : 50 - Math.abs(offset),
                    transition: 'transform 0.10s ease-out, opacity 0.08s ease-out',
                  }}
                >
                  {/* Playable card glow effect */}
                  {canPlay && (
                    <div className="absolute -inset-1.5 bg-yellow-400/40 rounded-xl blur-md animate-pulse" />
                  )}
                  {isSelected && (
                    <div className="absolute -inset-2 bg-yellow-400/50 rounded-2xl blur-lg" />
                  )}
                  <div
                    className={`relative w-20 h-28 rounded-xl border-3 shadow-xl bg-slate-900 transition-all duration-150 ${isSelected
                      ? "border-yellow-400 ring-4 ring-yellow-400/40 shadow-yellow-500/50"
                      : canPlay
                        ? "border-yellow-400/70 hover:border-yellow-400 shadow-yellow-500/30"
                        : "border-slate-600/50"
                      }`}
                  >
                    <div className="relative w-full h-full overflow-hidden rounded-lg">
                      <Image src={card.image || "/placeholder.svg"} alt={card.name} fill className="object-contain" />
                    </div>
                  </div>
                  {/* Drag hint */}
                  {canPlay && isSelected && (
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

      {/* Dragged hand card ghost - GPU accelerated */}
      {draggedHandCard && (
        <div
          ref={draggedCardRef}
          className="fixed top-0 left-0 pointer-events-none z-[70]"
          style={{
            willChange: 'transform',
            contain: 'layout style paint',
            transform: `translate(${dragPosRef.current.x - 40}px, ${dragPosRef.current.y - 56}px) rotate(0deg) scale(1.1)`,
          }}
        >
          {/* Glow */}
          <div className={`absolute -inset-3 rounded-xl blur-xl transition-all duration-150 ${dropTarget ? 'bg-green-400/60' : 'bg-yellow-400/40'
            }`} />
          {/* Card */}
          <div className={`relative w-20 h-28 rounded-xl border-3 shadow-2xl overflow-hidden bg-slate-900 transition-all duration-100 ${dropTarget
            ? 'border-green-400 shadow-green-500/60'
            : 'border-yellow-400 shadow-yellow-500/50'
            }`}>
            <img
              src={draggedHandCard.card.image || "/placeholder.svg"}
              alt={draggedHandCard.card.name}
              className="w-full h-full object-contain"
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
            style={{ animation: 'summonRing 500ms ease-out forwards' }}
          >
            <div className="w-20 h-20 rounded-full border-2 border-cyan-400/80" />
          </div>
          {/* Glow burst */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: 'summonGlow 450ms ease-out forwards' }}
          >
            <div className="w-16 h-16 bg-cyan-400/50 rounded-full blur-2xl" />
          </div>
          {/* Card materializing */}
          <div
            className="relative rounded-lg border-2 border-cyan-400 shadow-xl shadow-cyan-500/60 overflow-hidden bg-slate-900"
            style={{
              width: '64px',
              height: '88px',
              animation: 'cardMaterialize 500ms ease-out forwards',
              transformStyle: 'preserve-3d',
            }}
          >
            <img
              src={droppingCard.card.image || "/placeholder.svg"}
              alt={droppingCard.card.name}
              className="w-full h-full object-contain"
              draggable={false}
            />
          </div>
        </div>
      )}

      {/* Card Inspection Overlay - Press and hold to view */}
      {inspectedCard && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85"
          onClick={() => setInspectedCard(null)}
          onTouchEnd={() => setInspectedCard(null)}
        >
          <div
            className="relative flex flex-col items-center gap-4"
            style={{ animation: 'cardInspectIn 250ms ease-out forwards' }}
          >
            {/* Subtle ambient glow */}
            <div className="absolute -inset-16 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 blur-3xl rounded-full pointer-events-none" />

            {/* Card — single image, no overlay duplicate */}
            <div className="relative rounded-2xl border-2 border-white/30 shadow-2xl overflow-hidden"
              style={{ width: '280px', height: '392px' }}>
              <img
                src={inspectedCard.image || "/placeholder.svg"}
                alt={inspectedCard.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* DP badge — unit cards only */}
            {isUnitCard(inspectedCard) && (
              <div className={`px-5 py-1.5 rounded-full font-bold text-lg border ${
                (inspectedCard as FieldCard).currentDp !== undefined && (inspectedCard as FieldCard).currentDp > inspectedCard.dp
                  ? "bg-green-900/60 border-green-400/60 text-green-300"
                  : (inspectedCard as FieldCard).currentDp !== undefined && (inspectedCard as FieldCard).currentDp < inspectedCard.dp
                    ? "bg-red-900/60 border-red-400/60 text-red-300"
                    : "bg-cyan-900/60 border-cyan-400/60 text-cyan-300"
              }`}>
                {(inspectedCard as FieldCard).currentDp !== undefined
                  ? (inspectedCard as FieldCard).currentDp
                  : inspectedCard.dp} DP
              </div>
            )}

            {/* Close hint */}
            <div className="text-white/40 text-xs">Toque para fechar</div>
          </div>
        </div>
      )}

      {/* Graveyard View Modal */}
      {graveyardView && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85"
          onClick={() => setGraveyardView(null)}
        >
          <div
            className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border-2 border-purple-500/50 p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-purple-400 font-bold text-xl mb-4 text-center">
              {graveyardView === "player" ? "Seu Cemiterio" : "Cemiterio do Oponente"}
            </h3>
            <div className="max-h-80 overflow-y-auto">
              {(graveyardView === "player" ? playerField.graveyard : enemyField.graveyard).length === 0 ? (
                <p className="text-gray-400 text-center py-8">Nenhuma carta no cemiterio</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {(graveyardView === "player" ? playerField.graveyard : enemyField.graveyard).map((card, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-22 rounded-lg border-2 border-purple-500/50 overflow-hidden bg-slate-800 cursor-pointer hover:border-purple-400 hover:scale-105 transition-all"
                      style={{ height: '88px' }}
                      onClick={() => {
                        setInspectedCard(card)
                      }}
                    >
                      <img
                        src={card.image || "/placeholder.svg"}
                        alt={card.name}
                        className="w-full h-full object-contain"
                      />
                      {isUnitCard(card) && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[8px] text-center py-0.5">
                          {card.dp} DP
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              onClick={() => setGraveyardView(null)}
              size="sm"
              variant="outline"
              className="mt-4 w-full bg-transparent text-purple-400 border-purple-500/50 hover:bg-purple-500/20"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}

      {/* Effect Feedback Toast */}
      {effectFeedback && (
        <div className={`fixed top-1/3 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-white font-bold text-lg shadow-2xl animate-pulse ${effectFeedback.type === "success"
          ? "bg-gradient-to-r from-green-600 to-emerald-600 border-2 border-green-400"
          : "bg-gradient-to-r from-red-600 to-rose-600 border-2 border-red-400"
          }`}>
          {effectFeedback.message}
        </div>
      )}

      {/* ── Draw Animations ── */}
      {(drawAnimation || enemyDrawAnimation) && (()=>{
        const anim  = drawAnimation
        const eAnim = enemyDrawAnimation
        const W = 56, H = 80   // matches actual hand card proportions

        function flyCSS(a:{fromX:number;fromY:number;midX:number;midY:number;toX:number;toY:number}, id:string) {
          // Quadratic bezier arc via 3 keyframe positions
          const p0x = a.fromX - W/2,  p0y = a.fromY - H/2
          const p1x = a.midX  - W/2,  p1y = a.midY  - H/2
          const p2x = a.toX   - W/2,  p2y = a.toY   - H/2
          // t=0.5 point on the quadratic curve
          const qx = p0x*.25 + p1x*.5 + p2x*.25
          const qy = p0y*.25 + p1y*.5 + p2y*.25
          return `
            @keyframes ${id}-fly {
              0%   { transform:translate(${p0x}px,${p0y}px) scale(0.80) rotateY(0deg);   opacity:0 }
              6%   { opacity:1 }
              50%  { transform:translate(${qx}px,${qy}px)   scale(1.05) rotateY(90deg) }
              100% { transform:translate(${p2x}px,${p2y}px) scale(1)    rotateY(180deg); opacity:1 }
            }
          `
        }

        return (
          <div style={{position:'fixed',inset:0,zIndex:55,pointerEvents:'none',overflow:'hidden'}}>
            <style>{`
              ${anim  ? flyCSS(anim,  'dcp') : ''}
              ${eAnim ? flyCSS(eAnim, 'dce') : ''}
              @keyframes dc-shine { 0%{left:-120%;opacity:.6} 100%{left:230%;opacity:0} }
              @keyframes dc-land  { 0%{opacity:.5;transform:translate(var(--lx),var(--ly)) scale(.9)} 100%{opacity:0;transform:translate(var(--lx),var(--ly)) scale(1.15)} }
            `}</style>

            {/* ── PLAYER draw ── */}
            {anim && (<>
              {/* Card: back → flip → front */}
              <div style={{
                position:'absolute', left:0, top:0, width:W, height:H,
                transformStyle:'preserve-3d',
                animation:'dcp-fly .68s cubic-bezier(.33,.6,.4,.97) forwards',
                filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
              }}>
                {/* Back face */}
                <div style={{position:'absolute',inset:0,backfaceVisibility:'hidden',borderRadius:7,overflow:'hidden'}}>
                  <img src={CARD_BACK_IMAGE||"/placeholder.svg"} alt=""
                    style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                </div>
                {/* Front face — revealed after flip */}
                <div style={{
                  position:'absolute',inset:0,backfaceVisibility:'hidden',
                  transform:'rotateY(180deg)',borderRadius:7,overflow:'hidden',
                }}>
                  <img src={anim.cardImage} alt=""
                    style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                  {/* One-shot shine sweep on reveal */}
                  <div style={{
                    position:'absolute',top:0,bottom:0,width:'40%',
                    background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)',
                    animation:'dc-shine .30s ease-out .52s both',
                    pointerEvents:'none',
                  }}/>
                </div>
              </div>

              {/* Arrival: tiny soft pulse at destination only */}
              <div style={{
                position:'absolute', left:0, top:0,
                width:W+12, height:H+12,
                borderRadius:9,
                border:'1px solid rgba(180,210,255,0.25)',
                animation:'dc-land .50s ease-out .65s both',
                '--lx':`${anim.toX - (W+12)/2}px`,
                '--ly':`${anim.toY - (H+12)/2}px`,
              } as React.CSSProperties}/>
            </>)}

            {/* ── ENEMY draw — back only, red tint ── */}
            {eAnim && (
              <div style={{
                position:'absolute', left:0, top:0, width:W, height:H,
                transformStyle:'preserve-3d',
                animation:'dce-fly .68s cubic-bezier(.33,.6,.4,.97) forwards',
                filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
              }}>
                <div style={{position:'absolute',inset:0,backfaceVisibility:'hidden',borderRadius:7,overflow:'hidden'}}>
                  <img src={CARD_BACK_IMAGE||"/placeholder.svg"} alt=""
                    style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                  <div style={{position:'absolute',inset:0,background:'rgba(140,10,10,0.20)',mixBlendMode:'multiply',borderRadius:7}}/>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Dice Roll Animation ── */}
      {diceAnimation && (()=>{
        const rolling = diceAnimation.rolling
        const r       = diceAnimation.result  // always set from frame 1

        const TIER: Record<number,{col:string,bg:string,border:string,label:string,icon:string,name:string}> = {
          1:{col:'#f87171',bg:'rgba(239,68,68,.14)', border:'rgba(239,68,68,.6)', label:'RESULTADO BAIXO', icon:'💀',name:'red'},
          2:{col:'#f87171',bg:'rgba(239,68,68,.14)', border:'rgba(239,68,68,.6)', label:'RESULTADO BAIXO', icon:'💀',name:'red'},
          3:{col:'#facc15',bg:'rgba(234,179,8,.14)',  border:'rgba(234,179,8,.6)',  label:'RESULTADO BOM',   icon:'⚡',name:'yellow'},
          4:{col:'#facc15',bg:'rgba(234,179,8,.14)',  border:'rgba(234,179,8,.6)',  label:'RESULTADO BOM',   icon:'⚡',name:'yellow'},
          5:{col:'#4ade80',bg:'rgba(34,197,94,.14)',  border:'rgba(34,197,94,.6)',  label:'RESULTADO ÓTIMO', icon:'🔥',name:'green'},
          6:{col:'#4ade80',bg:'rgba(34,197,94,.14)',  border:'rgba(34,197,94,.6)',  label:'RESULTADO ÓTIMO', icon:'🔥',name:'green'},
        }
        const t   = r ? TIER[r] : null
        const col = t?.col ?? '#a78bfa'

        return (
          <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
            <style>{`
              @keyframes d-in   {from{opacity:0}to{opacity:1}}
              @keyframes d-pop  {0%{transform:scale(.2);opacity:0;filter:blur(7px)}65%{transform:scale(1.1);filter:blur(0);opacity:1}82%{transform:scale(.97)}100%{transform:scale(1);opacity:1}}
              @keyframes d-numgl{0%,100%{text-shadow:0 0 20px ${col},0 0 40px ${col}88}50%{text-shadow:0 0 40px ${col},0 0 80px ${col},0 0 120px ${col}55}}
              @keyframes d-bdg  {0%,100%{box-shadow:0 0 0 0 ${col}44}50%{box-shadow:0 0 0 10px transparent}}
              @keyframes d-spark{0%{transform:translate(0,0) scale(1.4);opacity:1}100%{transform:translate(var(--sx),var(--sy)) scale(0);opacity:0}}
              @keyframes d-ring {0%{transform:scale(0);opacity:.95;border-width:6px}100%{transform:scale(5.5);opacity:0;border-width:0}}
              @keyframes d-dot  {0%{opacity:.18}100%{opacity:1}}
              @keyframes d-lbl  {0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:translateY(0)}}
              @keyframes d-bgfl {0%{opacity:0}15%{opacity:1}100%{opacity:0}}
              @keyframes d-shat {0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--dr)) scale(0);opacity:0}}
              @keyframes d-strk {0%{transform:scaleY(0);opacity:.9;transform-origin:bottom}100%{transform:scaleY(1);opacity:0;transform-origin:bottom}}
              @keyframes pulse  {0%{opacity:.22}100%{opacity:1}}
            `}</style>

            {/* Backdrop */}
            <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,rgba(18,8,44,.92),rgba(0,0,0,.88))',animation:'d-in 200ms ease-out forwards'}} />

            {/* Result FX — appears when rolling flips to false (dice has settled) */}
            {!rolling && r!==null && t && (()=>{
              const sparks = Array.from({length:14}).map((_,i)=>{
                const a=(i/14)*Math.PI*2
                const dist=72+(i%3)*26
                const baseAngle = t.name==='green' ? -Math.PI/2+(Math.random()-.5)*Math.PI*.85 : a
                const sz=i%3===0?10:i%3===1?7:5
                return <div key={i} style={{
                  position:'absolute',width:sz,height:sz,borderRadius:'50%',
                  background:t.col,boxShadow:`0 0 7px 2px ${t.col}`,
                  animation:`d-spark .65s cubic-bezier(.2,0,.5,1) ${i*22}ms both`,
                  '--sx':`${Math.cos(baseAngle)*dist}px`,
                  '--sy':`${Math.sin(baseAngle)*dist}px`,
                } as React.CSSProperties} />
              })
              const rings = [0,80].map((delay,i)=>(
                <div key={i} style={{
                  position:'absolute',borderRadius:'50%',
                  width:120+i*24,height:120+i*24,
                  border:`5px solid ${t.col}`,boxShadow:`0 0 18px 5px ${t.col}44`,
                  animation:`d-ring ${540+i*90}ms ease-out ${delay}ms both`,
                }} />
              ))
              const bgFlash = <div style={{position:'absolute',inset:0,background:`${t.col}18`,animation:'d-bgfl .65s ease-out forwards',pointerEvents:'none'}} />
              const shatter = t.name==='red' ? Array.from({length:16}).map((_,i)=>{
                const a=Math.random()*Math.PI*2, d=55+Math.random()*75
                return <div key={i} style={{
                  position:'absolute',width:`${5+Math.random()*9}px`,height:`${5+Math.random()*9}px`,
                  borderRadius:Math.random()>.5?'2px':'50%',
                  background:t.col,boxShadow:`0 0 5px 2px ${t.col}`,
                  animation:`d-shat .8s cubic-bezier(.1,0,.4,1) ${i*20}ms both`,
                  '--dx':`${Math.cos(a)*d}px`,'--dy':`${Math.sin(a)*d}px`,
                  '--dr':`${-180+Math.random()*360}deg`,
                } as React.CSSProperties} />
              }) : null
              const streaks = t.name==='yellow' ? [0,1,2].map(i=>(
                <div key={i} style={{
                  position:'absolute',width:`${2+i}px`,height:'52%',
                  background:`linear-gradient(to bottom,transparent,${t.col},${t.col}88,transparent)`,
                  borderRadius:'9999px',left:`calc(50% + ${(-18+i*18)}px)`,top:'24%',
                  animation:`d-strk .42s ease-out ${i*75}ms both`,
                }} />
              )) : null
              return <>{bgFlash}{shatter}{streaks}{sparks}{rings}</>
            })()}

            {/* Content */}
            <div style={{position:'relative',zIndex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>

              {/* Card name */}
              <div style={{background:'linear-gradient(135deg,rgba(110,50,5,.97),rgba(160,85,8,.93))',padding:'8px 28px',borderRadius:12,border:'1px solid rgba(251,191,36,.55)',boxShadow:'0 4px 18px rgba(0,0,0,.5)',animation:'d-lbl 300ms ease-out forwards'}}>
                <p style={{color:'#fcd34d',fontWeight:700,fontSize:15,margin:0,letterSpacing:'.5px'}}>{diceAnimation.cardName}</p>
              </div>

              {/* 3D CSS dice — result passed immediately so it decelerates to correct face from frame 1 */}
              <DiceCanvas3D result={r} cardName={diceAnimation.cardName} />

              {/* Rolling text — shown while dice is still spinning */}
              {rolling && (
                <div style={{textAlign:'center'}}>
                  <p style={{color:'#fff',fontWeight:700,fontSize:16,letterSpacing:'2px',textTransform:'uppercase',textShadow:'0 0 16px rgba(139,92,246,.9)',margin:'0 0 9px'}}>Rolando...</p>
                  <div style={{display:'flex',gap:7,justifyContent:'center'}}>
                    {[0,1,2].map(i=>(
                      <div key={i} style={{width:8,height:8,borderRadius:'50%',background:'rgba(139,92,246,.9)',animation:`d-dot .7s ease-in-out ${i*.18}s infinite alternate`}} />
                    ))}
                  </div>
                </div>
              )}

              {/* Result — appears when dice has settled (rolling=false) while bounce still plays */}
              {!rolling && r!==null && t && (
                <div style={{textAlign:'center',animation:'d-pop .5s cubic-bezier(.34,1.56,.64,1) forwards'}}>
                  <div style={{fontSize:84,fontWeight:900,fontFamily:'monospace',lineHeight:1,color:t.col,marginBottom:10,animation:'d-numgl 1.4s ease-in-out .5s infinite'}}>{r}</div>
                  <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 24px',borderRadius:24,background:t.bg,border:`1.5px solid ${t.border}`,animation:'d-bdg 1.5s ease-in-out infinite'}}>
                    <span style={{fontSize:18}}>{t.icon}</span>
                    <span style={{fontWeight:700,fontSize:13,letterSpacing:'1px',textTransform:'uppercase',color:t.col}}>{t.label}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Ordem de Laceração — Blue Slash Animation */}


      {lacerationAnimation && (
        <div className="fixed inset-0 z-[80] pointer-events-none overflow-hidden">
          {/* Dark tint */}
          <div className="absolute inset-0 bg-black/30 laceration-bg-flash" />

          {/* Fehnon silhouette flash top-left */}
          <div className="absolute left-[8%] bottom-[30%] laceration-char-flash">
            <div className="w-16 h-24 bg-gradient-to-t from-cyan-400/80 to-transparent rounded-full blur-sm" />
          </div>

          {/* Slash 1 — diagonal from left, thick */}
          <div
            className="absolute laceration-slash-1"
            style={{
              left: "-10%", top: "28%",
              width: "130%", height: "6px",
              background: "linear-gradient(90deg, transparent 0%, #38bdf8 20%, #ffffff 50%, #7dd3fc 75%, transparent 100%)",
              transform: "rotate(-12deg)",
              boxShadow: "0 0 16px 6px rgba(56,189,248,0.9), 0 0 40px 12px rgba(56,189,248,0.5)",
              filter: "blur(0.5px)",
            }}
          />
          {/* Slash 1 afterglow */}
          <div
            className="absolute laceration-slash-1-glow"
            style={{
              left: "-10%", top: "26%",
              width: "130%", height: "14px",
              background: "linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.3) 25%, rgba(255,255,255,0.15) 50%, rgba(56,189,248,0.25) 75%, transparent 100%)",
              transform: "rotate(-12deg)",
              filter: "blur(3px)",
            }}
          />

          {/* Slash 2 — steeper, slightly lower */}
          <div
            className="absolute laceration-slash-2"
            style={{
              left: "-10%", top: "40%",
              width: "130%", height: "5px",
              background: "linear-gradient(90deg, transparent 0%, #0ea5e9 15%, #e0f2fe 50%, #38bdf8 80%, transparent 100%)",
              transform: "rotate(-8deg)",
              boxShadow: "0 0 14px 5px rgba(14,165,233,0.9), 0 0 35px 10px rgba(14,165,233,0.5)",
            }}
          />
          <div
            className="absolute laceration-slash-2-glow"
            style={{
              left: "-10%", top: "38.5%",
              width: "130%", height: "12px",
              background: "linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.25) 25%, rgba(255,255,255,0.12) 50%, rgba(14,165,233,0.2) 75%, transparent 100%)",
              transform: "rotate(-8deg)",
              filter: "blur(3px)",
            }}
          />

          {/* Slash 3 — thin fast upper */}
          <div
            className="absolute laceration-slash-3"
            style={{
              left: "-10%", top: "18%",
              width: "100%", height: "3px",
              background: "linear-gradient(90deg, transparent 0%, #bae6fd 30%, #ffffff 55%, #bae6fd 75%, transparent 100%)",
              transform: "rotate(-14deg)",
              boxShadow: "0 0 10px 4px rgba(186,230,253,0.8)",
            }}
          />

          {/* Slash 4 — wide sweeping lower */}
          <div
            className="absolute laceration-slash-4"
            style={{
              left: "-10%", top: "55%",
              width: "120%", height: "8px",
              background: "linear-gradient(90deg, transparent 0%, #0284c7 10%, #7dd3fc 40%, #ffffff 55%, #7dd3fc 75%, transparent 100%)",
              transform: "rotate(-6deg)",
              boxShadow: "0 0 20px 8px rgba(2,132,199,0.8), 0 0 50px 15px rgba(2,132,199,0.4)",
            }}
          />
          <div
            className="absolute laceration-slash-4-glow"
            style={{
              left: "-10%", top: "52%",
              width: "120%", height: "18px",
              background: "linear-gradient(90deg, transparent 0%, rgba(2,132,199,0.2) 20%, rgba(255,255,255,0.1) 50%, rgba(2,132,199,0.15) 75%, transparent 100%)",
              transform: "rotate(-6deg)",
              filter: "blur(4px)",
            }}
          />

          {/* Slash 5 — ultra-fast thin finishing strike */}
          <div
            className="absolute laceration-slash-5"
            style={{
              left: "-10%", top: "34%",
              width: "140%", height: "4px",
              background: "linear-gradient(90deg, transparent 0%, #93c5fd 20%, #dbeafe 50%, #93c5fd 80%, transparent 100%)",
              transform: "rotate(-10deg)",
              boxShadow: "0 0 12px 5px rgba(147,197,253,0.9), 0 0 30px 8px rgba(147,197,253,0.5)",
            }}
          />

          {/* ── SVG sword-cut scar marks that appear as permanent slash wounds ── */}
          <svg
            className="absolute inset-0 w-full h-full laceration-scars"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.9))" }}
          >
            {/* Scar 1 */}
            <line x1="5" y1="30" x2="78" y2="24" stroke="#38bdf8" strokeWidth="0.35" strokeLinecap="round"
              className="laceration-scar-1" />
            {/* Scar 2 */}
            <line x1="8" y1="41" x2="85" y2="36" stroke="#7dd3fc" strokeWidth="0.25" strokeLinecap="round"
              className="laceration-scar-2" />
            {/* Scar 3 */}
            <line x1="12" y1="20" x2="72" y2="15" stroke="#bae6fd" strokeWidth="0.2" strokeLinecap="round"
              className="laceration-scar-3" />
            {/* Scar 4 */}
            <line x1="3" y1="56" x2="82" y2="51" stroke="#0ea5e9" strokeWidth="0.3" strokeLinecap="round"
              className="laceration-scar-4" />
            {/* Scar 5 */}
            <line x1="10" y1="35" x2="92" y2="29" stroke="#e0f2fe" strokeWidth="0.2" strokeLinecap="round"
              className="laceration-scar-5" />
          </svg>

          {/* ── Sword-cut air distortion ripples ── */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={`ripple-${i}`}
              className="absolute laceration-ripple"
              style={{
                left: `${10 + i * 15}%`,
                top: `${22 + i * 6}%`,
                width: `${20 + i * 5}%`,
                height: "2px",
                background: "linear-gradient(90deg, transparent, rgba(148,219,255,0.5), transparent)",
                transform: `rotate(${-11 + i * 1.5}deg)`,
                animationDelay: `${i * 0.06}s`,
                filter: "blur(1px)",
              }}
            />
          ))}

          {/* ── Impact sparks where blades land ── */}
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="absolute laceration-spark"
              style={{
                left: `${30 + (i % 5) * 10}%`,
                top: `${20 + Math.floor(i / 5) * 12 + (i % 3) * 4}%`,
                width: `${1 + (i % 3)}px`,
                height: `${8 + (i % 5) * 4}px`,
                background: i % 2 === 0
                  ? "linear-gradient(180deg, #ffffff 0%, #38bdf8 60%, transparent 100%)"
                  : "linear-gradient(180deg, #e0f2fe 0%, #0284c7 60%, transparent 100%)",
                borderRadius: "1px 1px 0 0",
                transform: `rotate(${-30 + i * 12}deg)`,
                boxShadow: "0 0 4px 1px rgba(56,189,248,0.7)",
                animationDelay: `${0.25 + i * 0.03}s`,
              }}
            />
          ))}

          {/* ── Flash on each slash hit ── */}
          <div className="absolute inset-0 laceration-flash-1" style={{ background: "radial-gradient(ellipse 80% 30% at 50% 30%, rgba(56,189,248,0.35) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 laceration-flash-2" style={{ background: "radial-gradient(ellipse 80% 30% at 50% 40%, rgba(255,255,255,0.2) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 laceration-flash-3" style={{ background: "radial-gradient(ellipse 80% 30% at 50% 55%, rgba(56,189,248,0.3) 0%, transparent 70%)" }} />

          {/* ── Central energy burst ── */}
          <div
            className="absolute laceration-burst"
            style={{
              left: "45%", top: "38%",
              width: "100px", height: "100px",
              marginLeft: "-50px", marginTop: "-50px",
              background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(56,189,248,0.7) 30%, transparent 70%)",
              borderRadius: "50%",
            }}
          />

          {/* ── Damage number — -3 DP in white only ── */}
          <div
            className="absolute laceration-dmg-number"
            style={{ left: "50%", top: "18%", transform: "translateX(-50%)" }}
          >
            <span
              style={{
                fontSize: "64px",
                fontWeight: 900,
                color: "#ffffff",
                textShadow:
                  "0 0 20px #38bdf8, 0 0 40px rgba(56,189,248,0.9), 0 0 80px rgba(56,189,248,0.5), 0 3px 6px rgba(0,0,0,0.95)",
                letterSpacing: "-3px",
                fontFamily: "system-ui, sans-serif",
                display: "block",
              }}
            >
              -3 DP
            </span>
          </div>
        </div>
      )}

      {/* Sinfonia Relâmpago Animation */}
      {sinfoniaAnimation && (
        <div className="fixed inset-0 z-[80] pointer-events-none overflow-hidden">
          {/* Purple tint */}
          <div className="absolute inset-0 sin-bg" />
          {/* Single main lightning bolt across enemy field */}
          <svg className="absolute inset-0 w-full h-full sin-bolt" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sinLG" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c3aed"/>
                <stop offset="50%" stopColor="#ffffff"/>
                <stop offset="100%" stopColor="#6d28d9"/>
              </linearGradient>
            </defs>
            <polyline points="0,20 16,13 26,5 38,18 52,3 65,16 78,4 92,14 100,9"
              fill="none" stroke="url(#sinLG)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter:"drop-shadow(0 0 8px #e879f9)" }}/>
            <polyline points="0,20 16,13 26,5 38,18 52,3 65,16 78,4 92,14 100,9"
              fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.5" strokeLinecap="round"/>
          </svg>
          {/* 3 musical notes */}
          <div className="absolute sin-note" style={{ left:"12%", top:"8%",  fontSize:"42px", color:"#f0abfc", textShadow:"0 0 14px #a855f7", animationDelay:"0s" }}>♬</div>
          <div className="absolute sin-note" style={{ left:"80%", top:"5%",  fontSize:"38px", color:"#c084fc", textShadow:"0 0 14px #a855f7", animationDelay:"0.06s" }}>♪</div>
          <div className="absolute sin-note" style={{ left:"48%", top:"10%", fontSize:"34px", color:"#f0abfc", textShadow:"0 0 14px #a855f7", animationDelay:"0.03s" }}>♫</div>
          {/* Glow flash on enemy field */}
          <div className="absolute sin-flash" style={{ left:0, right:0, top:0, height:"45%", background:"radial-gradient(ellipse 100% 80% at 50% 0%, rgba(232,121,249,0.35) 0%, transparent 75%)" }} />
          {/* Title */}
          <div className="absolute sin-title" style={{ left:"50%", top:"36%", transform:"translateX(-50%)", whiteSpace:"nowrap" }}>
            <span style={{ fontSize:"20px", fontWeight:900, color:"#fff", letterSpacing:"3px", textTransform:"uppercase", textShadow:"0 0 12px #f0abfc, 0 0 24px #a855f7, 0 2px 6px rgba(0,0,0,0.9)" }}>♫ Sinfonia Relâmpago ♫</span>
          </div>
        </div>
      )}

      {/* Card Destruction Animation */}      {/* Card Destruction Animation */}      {/* Card Destruction Animation */}
      {destructionAnimation && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {/* Shatter card animation at destruction position */}
          <div
            className="destruction-container"
            style={{
              left: destructionAnimation.x,
              top: destructionAnimation.y,
            }}
          >
            {/* Card image that shatters */}
            <div className="destruction-card">
              <img
                src={destructionAnimation.cardImage}
                alt={destructionAnimation.cardName}
                className="w-full h-full object-cover rounded"
              />
            </div>

            {/* Shatter fragments */}
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className={`destruction-fragment destruction-fragment-${i + 1}`}
                style={{
                  backgroundImage: `url(${destructionAnimation.cardImage})`,
                  backgroundSize: '100% 100%',
                }}
              />
            ))}

            {/* Flash effect */}
            <div className="destruction-flash" />

            {/* Card name */}
            <div className="destruction-name">
              <span className="text-red-400 font-bold text-xs uppercase tracking-wider">
                {destructionAnimation.cardName}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Choice Modal for cards like Véu dos Laços Cruzados */}
      {choiceModal && choiceModal.visible && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-6 rounded-xl border-2 border-purple-500/50 text-center shadow-2xl max-w-sm mx-4">
            <h3 className="text-purple-400 font-bold text-xl mb-4">{choiceModal.cardName}</h3>
            <p className="text-white/80 text-sm mb-5">Escolha um dos efeitos:</p>
            {choiceModal.gridLayout ? (
              <div className="grid grid-cols-3 gap-2">
                {choiceModal.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => choiceModal.onChoose(option.id)}
                    className={`bg-gradient-to-b ${option.id === 'skip' ? 'from-slate-600 to-slate-700 hover:from-slate-500 col-span-3' : 'from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600'} text-white font-bold py-2 px-2 rounded-lg border border-purple-400/40 transition-all hover:scale-105 flex flex-col items-center justify-center min-h-[60px]`}
                  >
                    <div className="text-[11px] font-bold leading-tight text-center">{option.label}</div>
                    {option.description && <div className="text-[9px] text-white/60 mt-0.5 text-center">{option.description}</div>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {choiceModal.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => choiceModal.onChoose(option.id)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-lg border border-purple-400/50 transition-all hover:scale-105"
                  >
                    <div className="text-lg">{option.label}</div>
                    <div className="text-xs text-white/70 mt-1">{option.description}</div>
                  </button>
                ))}
              </div>
            )}
            <Button
              onClick={() => setChoiceModal(null)}
              size="sm"
              variant="outline"
              className="mt-4 border-red-500/50 text-red-400 hover:bg-red-950/50"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Deck Search Modal (Pedra de Afiar) */}
      {deckSearchModal && deckSearchModal.visible && (
        <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-[90]">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border-2 border-amber-500/50 shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-amber-900/30 to-transparent">
              <h3 className="text-amber-400 font-bold text-lg text-center">⚔️ Pedra de Afiar</h3>
              <p className="text-white/60 text-xs text-center mt-1">Escolha uma Ultimate Gear do seu Deck</p>
            </div>

            {/* Card list */}
            <div className="p-4 max-h-72 overflow-y-auto flex flex-col gap-3">
              {deckSearchModal.cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => deckSearchModal.onSelect(card)}
                  className="flex items-center gap-3 bg-slate-700/60 hover:bg-amber-900/40 border border-slate-600/50 hover:border-amber-500/60 rounded-xl p-3 transition-all group text-left"
                >
                  {/* Card image */}
                  <div className="w-12 h-16 rounded-lg overflow-hidden border border-amber-500/30 flex-shrink-0 relative">
                    <img
                      src={card.image || "/placeholder.svg"}
                      alt={card.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Card info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm truncate group-hover:text-amber-300 transition-colors">
                      {card.name}
                    </div>
                    <div className="text-amber-400/70 text-xs mt-0.5">{card.category || "Ultimate Gear"}</div>
                    {card.requiresUnit && (
                      <div className="text-slate-400 text-[10px] mt-1">
                        Equipa em: <span className="text-cyan-400">{card.requiresUnit}</span>
                      </div>
                    )}
                    {card.abilityDescription && (
                      <div className="text-white/40 text-[9px] mt-1 line-clamp-2">{card.abilityDescription}</div>
                    )}
                  </div>
                  {/* Arrow */}
                  <div className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg flex-shrink-0">→</div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10">
              <button
                onClick={deckSearchModal.onCancel}
                className="w-full py-2 rounded-lg border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-950/40 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UG Target Selection Mode overlay */}
      {ugTargetMode.active && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-yellow-500/50 rounded-xl px-4 py-3 text-center">
          <h3 className="text-yellow-400 font-bold text-sm mb-1">
            {ugTargetMode.type === "oden_sword" ? "ODEN SWORD"
              : ugTargetMode.type === "twiligh_avalon" ? "TWILIGH AVALON"
                : ugTargetMode.type === "mefisto" ? "MEFISTO FÓLES"
                  : "JULGAMENTO DIVINO"}
          </h3>
          <p className="text-yellow-200/80 text-xs mb-2">
            {ugTargetMode.type === "oden_sword"
              ? "Selecione uma Function inimiga para destruir"
              : ugTargetMode.type === "mefisto"
                ? "Selecione 1 carta inimiga para destruir"
                : ugTargetMode.type === "julgamento_divino"
                  ? "Selecione uma Unidade inimiga para -1DP"
                  : "Selecione uma carta inimiga para devolver a mao"
            }
          </p>
          <button
            onClick={cancelUgTargetMode}
            className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded font-bold"
          >
            CANCELAR
          </button>
        </div>
      )}

      {/* Unit Ability Confirmation Modal */}
      {unitAbilityConfirm && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setUnitAbilityConfirm(null)}
        >
          <div
            className="relative bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl border-2 border-emerald-500/60 shadow-2xl shadow-emerald-900/40 p-6 max-w-xs w-full mx-4 text-center"
            onClick={e => e.stopPropagation()}
          >
            {/* Glow accent */}
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 pointer-events-none" />
            <div className="text-emerald-400 text-xs font-bold tracking-widest uppercase mb-1">Efeito de Habilidade</div>
            <div className="text-white font-bold text-lg mb-1">{unitAbilityConfirm.name}</div>
            <div className="text-slate-300 text-sm mb-5">Ativar Efeito de Habilidade?</div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  const key = unitAbilityConfirm?.abilityKey
                  setUnitAbilityConfirm(null)
                  if (key === 'merlin') activateMerlinAbility()
                  else if (key === 'oswin') activateOswinAbility()
                  else if (key === 'mrp') activateMrPAbility()
                  else if (key === 'hrottiSr') activateHrottiSrAbility()
                  else if (key === 'hrottiUr') activateHrottiUrAbility()
                  else if (key === 'ullrSr') activateUllrSrAbility()
                  else if (key === 'ullrUr') activateUllrUrAbility()
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors shadow-lg shadow-emerald-900/50"
              >
                ✓ Sim
              </button>
              <button
                onClick={() => setUnitAbilityConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-sm transition-colors"
              >
                ✗ Não
              </button>
            </div>
          </div>
        </div>
      )}

      {mrpTargetMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-yellow-500/60 rounded-xl px-4 py-3 text-center">
          <h3 className="text-yellow-300 font-bold text-sm mb-1">MANUSCRITO DE GUERRA</h3>
          <p className="text-yellow-200/80 text-xs mb-2">Selecione 1 unidade inimiga para -2DP</p>
          <button onClick={() => setMrpTargetMode(false)} className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded font-bold">CANCELAR</button>
        </div>
      )}

      {julgamentoVazioTargetMode.active && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-violet-500/60 rounded-xl px-4 py-3 text-center">
          <h3 className="text-violet-300 font-bold text-sm mb-1">JULGAMENTO DO VAZIO ETERNO</h3>
          <p className="text-violet-200/80 text-xs mb-2">Selecione 1 carta inimiga para destruir</p>
          <button
            onClick={() => { setJulgamentoVazioTargetMode({ active: false, attackerIndex: null }); animationInProgressRef.current = false }}
            className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded font-bold"
          >
            CANCELAR
          </button>
        </div>
      )}

      {itemSelectionMode.active && itemSelectionMode.itemCard && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-5 rounded-xl border-2 border-yellow-500/50 text-center shadow-2xl pointer-events-auto">
            <h3 className="text-yellow-400 font-bold text-lg mb-3">{itemSelectionMode.itemCard.name}</h3>
            {(() => {
              const cardId = getBaseCardId(itemSelectionMode.itemCard?.id || "")
              const isDiceCard = cardId.includes("dados-do-destino") || cardId.includes("dados-elementais")

              if (isDiceCard) {
                return (
                  <p className="text-white text-sm">
                    Clique em uma unidade <span className="text-cyan-400 font-bold">SUA</span> para rolar o dado
                  </p>
                )
              }

              if (itemSelectionMode.step === "selectEnemy") {
                return (
                  <p className="text-white text-sm">
                    {itemSelectionMode.chosenOption === "flecha_direct"
                      ? <>Selecione uma <span className="text-red-400 font-bold">Unidade Inimiga</span> — dano de <span className="text-orange-400 font-bold">2DP</span> ignorando Traps</>
                      : itemSelectionMode.chosenOption === "debuff"
                        ? <>Clique em uma unidade <span className="text-red-400 font-bold">INIMIGA</span> para reduzir <span className="text-red-400 font-bold">-2 DP</span></>
                        : <>Clique em uma unidade <span className="text-red-400 font-bold">INIMIGA</span> para aplicar o efeito</>
                    }
                  </p>
                )
              }

              return (
                <p className="text-white text-sm">
                  {itemSelectionMode.chosenOption === "buff"
                    ? <>Clique em <span className="text-cyan-400 font-bold">Fehnon Hoskie</span> ou <span className="text-cyan-400 font-bold">Jaden Hainaegi</span> para receber <span className="text-green-400 font-bold">+2 DP</span></>
                    : <>Clique em uma unidade <span className="text-cyan-400 font-bold">SUA</span> para aplicar o efeito</>
                  }
                </p>
              )
            })()}
            <Button
              onClick={cancelItemSelection}
              size="sm"
              variant="outline"
              className="mt-4 bg-transparent text-white border-white/50 hover:bg-white/10 pointer-events-auto"
            >
              Cancelar
            </Button>
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
                <h2 className="text-4xl font-black text-white tracking-widest uppercase italic">TAP</h2>
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
                const activeTap = tapView === "player" ? playerField.tap : enemyField.tap

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
                                // Add card to hand and remove from TAP
                                setPlayerField((prev) => {
                                  const newTap = prev.tap.filter((_, idx) => idx !== i)
                                  return { ...prev, tap: newTap, hand: [...prev.hand, card] }
                                })
                                sendActionRef.current({
                                  type: "tap_to_hand", playerId,
                                  data: { card, index: i },
                                  timestamp: Date.now(),
                                })
                                setTapView(null)
                                showEffectFeedback(`TAP: ${card.name} adicionada à mão!`, "success")
                              }
                            }}
                          >
                            <Image src={card.image || "/placeholder.svg"} alt={card.name} fill className="object-cover" />

                            {/* Available Glow Overlay */}
                            {isPlayable && (
                              <div className="absolute inset-0 bg-gradient-to-t from-orange-600/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end pb-4">
                                <div className="bg-orange-500 text-white font-black px-4 py-2 rounded-xl text-xs shadow-2xl tracking-widest">
                                  À MÃO
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
      {/* Card Inspection Overlay */}
      <style jsx global>{`
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .animate-shake {
          animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
        }

        /* ── ORDEM DE LACERAÇÃO — sword slash animation ── */
        @keyframes lacerationBgFlash {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          55%  { opacity: 0.5; }
          100% { opacity: 0; }
        }
        .laceration-bg-flash { animation: lacerationBgFlash 1.8s ease-out forwards; }

        @keyframes lacerationCharFlash {
          0%   { opacity: 0; transform: scale(0.8) translateY(10px); }
          12%  { opacity: 1; transform: scale(1.1) translateY(-4px); }
          40%  { opacity: 0.6; }
          100% { opacity: 0; transform: scale(0.9); }
        }
        .laceration-char-flash { animation: lacerationCharFlash 1.8s ease-out forwards; }

        @keyframes slashSweep1 {
          0%        { transform: rotate(-12deg) scaleX(0); opacity: 0; }
          2%        { opacity: 1; }
          14%       { transform: rotate(-12deg) scaleX(1); opacity: 1; }
          38%       { opacity: 0.5; }
          58%,100%  { opacity: 0; }
        }
        .laceration-slash-1      { animation: slashSweep1 1.8s cubic-bezier(0.04,0.8,0.1,1) 0s    forwards; transform-origin: left center; }
        .laceration-slash-1-glow { animation: slashSweep1 1.8s cubic-bezier(0.04,0.8,0.1,1) 0.02s forwards; transform-origin: left center; }

        @keyframes slashSweep2 {
          0%,10%    { transform: rotate(-8deg) scaleX(0); opacity: 0; }
          12%       { opacity: 1; }
          26%       { transform: rotate(-8deg) scaleX(1); opacity: 1; }
          50%       { opacity: 0.4; }
          68%,100%  { opacity: 0; }
        }
        .laceration-slash-2      { animation: slashSweep2 1.8s cubic-bezier(0.04,0.8,0.1,1) 0.08s  forwards; transform-origin: left center; }
        .laceration-slash-2-glow { animation: slashSweep2 1.8s cubic-bezier(0.04,0.8,0.1,1) 0.10s  forwards; transform-origin: left center; }

        @keyframes slashSweep3 {
          0%,3%     { transform: rotate(-14deg) scaleX(0); opacity: 0; }
          5%        { opacity: 1; }
          16%       { transform: rotate(-14deg) scaleX(1); opacity: 1; }
          32%       { opacity: 0.3; }
          48%,100%  { opacity: 0; }
        }
        .laceration-slash-3 { animation: slashSweep3 1.8s cubic-bezier(0.03,0.9,0.08,1) 0.03s forwards; transform-origin: left center; }

        @keyframes slashSweep4 {
          0%,17%    { transform: rotate(-6deg) scaleX(0); opacity: 0; }
          19%       { opacity: 1; }
          36%       { transform: rotate(-6deg) scaleX(1); opacity: 1; }
          60%       { opacity: 0.5; }
          78%,100%  { opacity: 0; }
        }
        .laceration-slash-4      { animation: slashSweep4 1.8s cubic-bezier(0.04,0.7,0.1,1) 0.15s  forwards; transform-origin: left center; }
        .laceration-slash-4-glow { animation: slashSweep4 1.8s cubic-bezier(0.04,0.7,0.1,1) 0.17s  forwards; transform-origin: left center; }

        @keyframes slashSweep5 {
          0%,24%    { transform: rotate(-10deg) scaleX(0); opacity: 0; }
          26%       { opacity: 1; }
          40%       { transform: rotate(-10deg) scaleX(1); opacity: 1; }
          56%       { opacity: 0.3; }
          70%,100%  { opacity: 0; }
        }
        .laceration-slash-5 { animation: slashSweep5 1.8s cubic-bezier(0.02,0.95,0.05,1) 0.22s forwards; transform-origin: left center; }

        @keyframes lacerationScar {
          0%,15%  { stroke-dasharray: 0 200; opacity: 0; }
          25%     { stroke-dasharray: 200 0; opacity: 0.9; }
          65%     { opacity: 0.5; }
          100%    { opacity: 0; }
        }
        .laceration-scars { opacity: 1; }
        .laceration-scar-1 { animation: lacerationScar 1.8s ease-out 0.10s forwards; }
        .laceration-scar-2 { animation: lacerationScar 1.8s ease-out 0.18s forwards; }
        .laceration-scar-3 { animation: lacerationScar 1.8s ease-out 0.05s forwards; }
        .laceration-scar-4 { animation: lacerationScar 1.8s ease-out 0.22s forwards; }
        .laceration-scar-5 { animation: lacerationScar 1.8s ease-out 0.14s forwards; }

        @keyframes lacerationRipple {
          0%,20%   { opacity: 0; scaleX: 0; }
          30%      { opacity: 0.8; }
          60%      { opacity: 0.3; }
          80%,100% { opacity: 0; }
        }
        .laceration-ripple { animation: lacerationRipple 1.8s ease-out forwards; }

        @keyframes lacerationSpark {
          0%,26%  { opacity: 0; transform: scale(0) translateY(0); }
          30%     { opacity: 1; transform: scale(1) translateY(0); }
          65%     { opacity: 0.7; transform: scale(0.8) translateY(-12px); }
          100%    { opacity: 0; transform: scale(0.2) translateY(-24px); }
        }
        .laceration-spark { animation: lacerationSpark 1.8s ease-out forwards; }

        @keyframes lacerationFlash1 {
          0%,2%    { opacity: 0; } 4%  { opacity: 1; } 14%,100% { opacity: 0; }
        }
        @keyframes lacerationFlash2 {
          0%,13%   { opacity: 0; } 16% { opacity: 0.8; } 26%,100% { opacity: 0; }
        }
        @keyframes lacerationFlash3 {
          0%,25%   { opacity: 0; } 28% { opacity: 1; } 40%,100% { opacity: 0; }
        }
        .laceration-flash-1 { animation: lacerationFlash1 1.8s ease-out forwards; }
        .laceration-flash-2 { animation: lacerationFlash2 1.8s ease-out forwards; }
        .laceration-flash-3 { animation: lacerationFlash3 1.8s ease-out forwards; }

        @keyframes lacerationBurst {
          0%,27%  { transform: scale(0); opacity: 0; }
          33%     { transform: scale(1.5); opacity: 1; }
          52%     { transform: scale(0.9); opacity: 0.6; }
          72%     { transform: scale(1.8); opacity: 0.2; }
          100%    { transform: scale(2.4); opacity: 0; }
        }
        .laceration-burst { animation: lacerationBurst 1.8s cubic-bezier(0.2,0.8,0.3,1) forwards; }

        /* ── SINFONIA RELÂMPAGO CSS ── */
        @keyframes sinBg    { 0%{opacity:.4} 50%{opacity:.15} 100%{opacity:0} }
        @keyframes sinBolt  { 0%{opacity:1}  40%{opacity:.7}  70%{opacity:.2}  85%,100%{opacity:0} }
        @keyframes sinNote  { 0%{opacity:1;transform:scale(.5) translateY(6px)} 25%{opacity:1;transform:scale(1.25) translateY(-5px)} 55%{opacity:1;transform:scale(1) translateY(0)} 80%{opacity:.4;transform:scale(1) translateY(-18px)} 100%{opacity:0;transform:scale(.7) translateY(-35px)} }
        @keyframes sinFlash { 0%{opacity:.9} 25%{opacity:.4}  55%,100%{opacity:0} }
        @keyframes sinTitle { 0%{opacity:1;transform:translateX(-50%) scale(.75)} 20%{opacity:1;transform:translateX(-50%) scale(1.05)} 45%{transform:translateX(-50%) scale(1)} 75%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(-10px)} }
        .sin-bg    { animation: sinBg    1.5s ease-out forwards; background:rgba(88,28,135,1); }
        .sin-bolt  { animation: sinBolt  1.5s ease-out forwards; }
        .sin-note  { animation: sinNote  1.5s ease-out forwards; }
        .sin-flash { animation: sinFlash 1.5s ease-out forwards; }
        .sin-title { animation: sinTitle 1.5s ease-out forwards; }


        @keyframes lacerationDmgNumber {
          0%,18%  { opacity: 0; transform: translateX(-50%) translateY(24px) scale(0.4) rotate(-8deg); }
          32%     { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1.35) rotate(2deg); }
          50%     { transform: translateX(-50%) translateY(0px) scale(1) rotate(0deg); }
          72%     { opacity: 1; }
          100%    { opacity: 0; transform: translateX(-50%) translateY(-28px) scale(0.85); }
        }
        .laceration-dmg-number { animation: lacerationDmgNumber 1.8s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      {/* Discard/destroy animations */}
      <DiscardAnimationManager
        playerGraveyard={playerField.graveyard}
        enemyGraveyard={enemyField.graveyard}
        playerGraveyardRef={playerGraveyardRef}
        enemyGraveyardRef={enemyGraveyardRef}
        destroyedCardIds={destroyedCardIds}
      />

    </div>
  )
}

