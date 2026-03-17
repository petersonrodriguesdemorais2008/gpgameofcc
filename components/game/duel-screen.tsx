"use client"

import type React from "react"
import type { Deck as GameDeck, Card as GameCard } from "@/contexts/game-context"

import { useState, useEffect, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
// REMOVED: import { useGame, type Deck as GameDeck, type Card as GameCard } from "@/contexts/game-context"
import { useGame, CARD_BACK_IMAGE } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Swords, X } from "lucide-react"
import Image from "next/image"
import { MultiplayerLobby } from "./multiplayer-lobby"
import { OnlineDuelScreen } from "./online-duel-screen"
import { ElementalAttackAnimation, type AttackAnimationProps } from "./elemental-attack-animation"

interface DuelScreenProps {
  mode: "bot" | "player"
  onBack: () => void
}

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
      // Check for units with Darkness, Fire, or Aquos elements
      const validElements = ["darkness", "fire", "aquos"]
      const hasValidUnit = context.playerField.unitZone.some((u) =>
        u !== null && validElements.includes(u.element?.toLowerCase() || "")
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

      const validElements = ["darkness", "fire", "aquos"]
      const unitElement = allyUnit.element?.toLowerCase() || ""

      if (!validElements.includes(unitElement)) {
        return { success: false, message: "Unidade deve ser Darkness, Fire ou Aquos" }
      }

      const diceResult = targets.diceResult || 1
      const currentDp = allyUnit.currentDp || allyUnit.dp
      let dpBonus = 0
      let bonusMessage = ""

      if (diceResult >= 1 && diceResult <= 2) {
        dpBonus = 3
        if (unitElement === "darkness") {
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
        if (unitElement === "fire") {
          // Bonus: +2 LP
          context.setPlayerField((prev) => ({ ...prev, life: prev.life + 2 }))
          bonusMessage = " Bonus Fire: +2 LP!"
        }
      } else {
        dpBonus = 5
        if (unitElement === "aquos") {
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
      // Check for units with Neutral, Lightness, Ventus, or Void elements (Void is treated as Neutral)
      const validElements = ["neutral", "lightness", "ventus", "void"]
      const hasValidUnit = context.playerField.unitZone.some((u) =>
        u !== null && validElements.includes(u.element?.toLowerCase() || "")
      )
      if (!hasValidUnit) {
        return { canActivate: false, reason: "Precisa de unidade Neutral, Lightness, Ventus ou Void em campo" }
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

      const validElements = ["neutral", "lightness", "ventus", "void"]
      const rawElement = allyUnit.element?.toLowerCase() || ""
      // Treat Void as Neutral for dice bonus purposes
      const unitElement = rawElement === "void" ? "neutral" : rawElement

      if (!validElements.includes(rawElement)) {
        return { success: false, message: "Unidade deve ser Neutral, Lightness, Ventus ou Void" }
      }

      const diceResult = targets.diceResult || 1
      const currentDp = allyUnit.currentDp || allyUnit.dp
      let dpBonus = 0
      let bonusMessage = ""

      if (diceResult >= 1 && diceResult <= 2) {
        dpBonus = 3
        if (unitElement === "neutral") {
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
        if (unitElement === "lightness") {
          // Bonus: +2 LP
          context.setPlayerField((prev) => ({ ...prev, life: prev.life + 2 }))
          bonusMessage = " Bonus Lightness: +2 LP!"
        }
      } else {
        dpBonus = 5
        if (unitElement === "ventus") {
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
    targetConfig: {
      allyUnits: 1,
    },
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

      if (!allyUnit) {
        return { success: false, message: "Unidade não encontrada" }
      }

      if (allyUnit.element?.toLowerCase() !== "darkus") {
        return { success: false, message: "A unidade selecionada deve ser do Elemento Darkus" }
      }

      // Return unit to hand
      context.setPlayerField((prev) => {
        const newUnitZone = [...prev.unitZone]
        const unitToReturn = newUnitZone[allyIndex]
        if (!unitToReturn) return prev
        
        newUnitZone[allyIndex] = null
        
        // Return to hand: need to restore original DP/stats if needed? 
        // Based on other cards, we just add the unit object back to hand.
        return {
          ...prev,
          unitZone: newUnitZone,
          hand: [...prev.hand, unitToReturn],
        }
      })

      return { success: true, message: `Troca de Guarda! ${allyUnit.name} retornou para sua mão.` }
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

export function DuelScreen({ mode, onBack }: DuelScreenProps) {
  const { t } = useLanguage()
  // IMPORTED: const { decks, addMatchRecord, getPlaymatForDeck } = useGame()
  const { decks, addMatchRecord, getPlaymatForDeck, ownedPlaymats, globalPlaymatId } = useGame()
  // Ensure decks are typed correctly if they have playmat images
  const typedDecks = decks as DeckWithImages[]
  const [selectedDeck, setSelectedDeck] = useState<DeckWithImages | null>(null)
  const [gameStarted, setGameStarted] = useState(false)

  // Multiplayer state
  const [multiplayerRoomData, setMultiplayerRoomData] = useState<RoomData | null>(null)
  const [showOnlineDuel, setShowOnlineDuel] = useState(false)

  const [turn, setTurn] = useState(1)
  const [phase, setPhase] = useState<Phase>("draw")
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)

  // Draw card animation state
  const [drawAnimation, setDrawAnimation] = useState<{
    visible: boolean
    cardName: string
    cardImage: string
    cardType: string
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
    life: 20,
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
    life: 20,
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
    if (!isPlayerTurn) return false
    if (playerWentFirst) {
      return turn >= 3
    } else {
      return turn >= 2
    }
  }

  const isUltimateCard = (card: GameCard) => {
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
    if (!isPlayerTurn) return false
    if (card.hasAttacked) return false
    // Only check turn restriction
    if (turn <= card.canAttackTurn) return false
    return true
  }

  const cacheEnemyRects = useCallback(() => {
    const enemyUnitElements = document.querySelectorAll("[data-enemy-unit]")
    enemyUnitRectsRef.current = Array.from(enemyUnitElements).map((el) => el.getBoundingClientRect())
  }, [])

  const startGame = (deck: DeckWithImages) => {
    setSelectedDeck(deck)

    const playerFirst = Math.random() > 0.5
    setPlayerWentFirst(playerFirst)

    const shuffledDeck = [...deck.cards].sort(() => Math.random() - 0.5)
    const hand = shuffledDeck.slice(0, 5)
    const remainingDeck = shuffledDeck.slice(5)

    setPlayerField((prev) => ({
      ...prev,
      hand,
      deck: remainingDeck,
      tap: deck.tapCards ? [...deck.tapCards] : [],
      life: 20,
      unitZone: [null, null, null, null],
      functionZone: [null, null, null, null],
      scenarioZone: null,
      ultimateZone: null,
      graveyard: [],
    }))

    const botDeck = [...deck.cards].sort(() => Math.random() - 0.5)
    const botHand = botDeck.slice(0, 5)
    const botRemaining = botDeck.slice(5)

    setEnemyField((prev) => ({
      ...prev,
      hand: botHand,
      deck: botRemaining,
      tap: deck.tapCards ? [...deck.tapCards] : [],
      life: 20,
      unitZone: [null, null, null, null],
      functionZone: [null, null, null, null],
      scenarioZone: null,
      ultimateZone: null,
      graveyard: [],
    }))

    setGameStarted(true)
    setTurn(1)
    setPhase("draw")
    setIsPlayerTurn(playerFirst)

    if (!playerFirst) {
      setTimeout(() => executeBotTurn(), 1000)
    }
  }

  const drawCard = () => {
    if (playerField.deck.length === 0) return

    const drawnCard = playerField.deck[0]
    showDrawAnimation(drawnCard)
    setPlayerField((prev) => ({
      ...prev,
      hand: [...prev.hand, drawnCard],
      deck: prev.deck.slice(1),
    }))
  }

  const placeCard = (zone: "unit" | "function", slotIndex: number, forcedCardIndex?: number) => {
    if (!isPlayerTurn) return
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

      // BALIN: Vigília Eterna — on enter, look top 3, pick 1 to hand, rest to bottom
      if (cardToPlace.id === "balin-r" || cardToPlace.id === "balin-sr") {
        setTimeout(() => {
          const top3 = playerField.deck.slice(0, Math.min(3, playerField.deck.length))
          if (top3.length === 0) return
          if (top3.length === 1) {
            setPlayerField((prev) => ({
              ...prev,
              hand: [...prev.hand, top3[0]],
              deck: prev.deck.slice(1),
            }))
            showEffectFeedback(`Vigília Eterna: ${top3[0].name} adicionada à mão!`, "success")
            return
          }
          // Show choice: pick 1 of top 3
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
                // Remove top 3 from deck, add chosen to hand, put rest at bottom
                const deckWithout = prev.deck.slice(top3.length)
                const chosen = top3[pickedIdx]
                const toBottom = top3.filter((_, i) => i !== pickedIdx)
                showEffectFeedback(`Vigília Eterna: ${chosen.name} adicionada à mão!`, "success")
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

      if (effect || isAmplificador || isBandagem || isAdaga || isBandagensDuplas || isCristalRecuperador || isCaudaDeDragao || isProjetilDeImpacto || isVeuDosLacos || isNucleoExplosivo || isKitMedico || isSoroRecuperador || isOrdemDeLaceracao || isSinfoniaRelampago || isFafnisbani || isDevorarOMundo || isInvestidaCoordenada || isLacosDaOrdem || isEstrategiaReal || isVentosDeCamelot || isTrocaDeGuarda || isFlechaDeBalista || isPedraDeAfiar) {
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
        }

        if (!effectToUse) return // Safety check

        // Create effect context
        const effectContext: EffectContext = {
          playerField,
          enemyField,
          setPlayerField,
          setEnemyField,
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

          // Special handling for Pedra de Afiar - open deck search modal
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
    }

    setSelectedHandCard(null) // Clear selection if using drag-drop
    setDraggedHandCard(null) // Clear drag state
  }

  const placeScenarioCard = (forcedCardIndex?: number) => {
    if (!isPlayerTurn) return
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
    if (!isPlayerTurn) return
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

    // Reset one-time ability flag for a new UG
    setPlayerUgAbilityUsed(false)
    setSelectedHandCard(null)
    setDraggedHandCard(null)
  }

  // Activate Ultimate Gear one-time ability
  const activateUgAbility = () => {
    if (!isPlayerTurn || phase !== "main") return
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
    if (!isPlayerTurn || phase !== "main") return

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

    if (type === "unit") {
      const target = enemyField.unitZone[index]
      if (!target) return
      setEnemyField((prev) => {
        const newUnits = [...prev.unitZone]
        newUnits[index] = null
        return { ...prev, unitZone: newUnits as (FieldCard | null)[], graveyard: [...prev.graveyard, target] }
      })
      showEffectFeedback(`JULGAMENTO DO VAZIO ETERNO: ${target.name} destruído!`, "success")
    } else {
      const target = enemyField.functionZone[index]
      if (!target) return
      setEnemyField((prev) => {
        const newFunctions = [...prev.functionZone]
        newFunctions[index] = null
        return { ...prev, functionZone: newFunctions, graveyard: [...prev.graveyard, target] }
      })
      showEffectFeedback(`JULGAMENTO DO VAZIO ETERNO: ${target.name} destruído!`, "success")
    }

    setJulgamentoVazioTargetMode({ active: false, attackerIndex: null })
  }

  // Cancel UG target mode
  const cancelUgTargetMode = () => {
    setUgTargetMode({ active: false, ugCard: null, type: null })
  }

  const advancePhase = () => {
    if (!isPlayerTurn) return
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
      // ULLRBOGI: remove +3 DP from Ullr when leaving battle phase
      if (playerField.ultimateZone && playerField.ultimateZone.ability === "ULLRBOGI" && playerField.ultimateZone.requiresUnit) {
        const ullrIdx = findUnitByName(playerField.unitZone, playerField.ultimateZone.requiresUnit)
        if (ullrIdx !== -1) {
          setPlayerField((prev) => {
            const newUnits = [...prev.unitZone]
            const unit = newUnits[ullrIdx]
            if (unit) {
              newUnits[ullrIdx] = { ...unit, currentDp: Math.max(0, unit.currentDp - 3) }
            }
            return { ...prev, unitZone: newUnits as (FieldCard | null)[] }
          })
        }
      }
      endTurn()
    }
  }

  const handleAttackStart = useCallback(
    (index: number, e: React.MouseEvent | React.TouchEvent) => {
      if (!isPlayerTurn || phase !== "battle") return

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
    [isPlayerTurn, phase, playerField.unitZone, cacheEnemyRects, turn],
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
        // CALEM SR: Pulso da Nulidade - draw on attack every 3 turns
        if (attacker.id === "calem-sr" && (pulsoNulidadeLastUsedTurn === null || turn - pulsoNulidadeLastUsedTurn >= 3)) {
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
            setPulsoNulidadeLastUsedTurn(turn)
            showEffectFeedback(isVoidTroop ? "PULSO DA NULIDADE: Calem +1DP (carta Void Tropas)!" : "PULSO DA NULIDADE: Carta comprada!", "info")
          }
        }

        // CALEM UR: Impacto sem Fé - draw on attack every 3 turns, if Unit → attack again
        if (attacker.id === "calem-ur" && (impactoSemFeLastUsedTurn === null || turn - impactoSemFeLastUsedTurn >= 3)) {
          const drawn = playerField.deck[0]
          if (drawn) {
            const isUnit = ["unit", "ultimateGuardian", "ultimateElemental"].includes(drawn.type)
            setPlayerField((prev) => {
              const newDeck = [...prev.deck.slice(1)]
              const newHand = [...prev.hand, drawn]
              return { ...prev, deck: newDeck, hand: newHand }
            })
            setImpactoSemFeLastUsedTurn(turn)
            if (isUnit) {
              setCalemUrDoubleAttack(true)
              showEffectFeedback("IMPACTO SEM FÉ: Carta Unidade! Calem pode atacar novamente!", "success")
            } else {
              showEffectFeedback("IMPACTO SEM FÉ: Carta comprada!", "info")
            }
          }
        }

        // CALEM LR: Julgamento do Vazio Eterno - check graveyard
        if (attacker.id === "calem-lr" && attackState.targetInfo.type === "unit") {
          const lastGraveyardCard = playerField.graveyard[playerField.graveyard.length - 1]
          if (lastGraveyardCard && (lastGraveyardCard.type === "unit" || lastGraveyardCard.type === "ultimateGuardian" || lastGraveyardCard.type === "ultimateElemental" || lastGraveyardCard.type === "action")) {
            const hasEnemyTargets = enemyField.unitZone.some(u => u !== null) || enemyField.functionZone.some(f => f !== null)
            if (hasEnemyTargets) {
              setJulgamentoVazioTargetMode({ active: true, attackerIndex: attackState.attackerIndex })
              setAttackState({ isAttacking: false, attackerIndex: null, targetInfo: null })
              showEffectFeedback("JULGAMENTO DO VAZIO ETERNO: Selecione uma carta do oponente para destruir!", "warning")
              return
            } else {
              setPlayerField((prev) => {
                const newUnitZone = [...prev.unitZone]
                const idx = attackState.attackerIndex!
                if (newUnitZone[idx]) {
                  const cur = newUnitZone[idx]!
                  newUnitZone[idx] = { ...cur, currentDp: (cur.currentDp || cur.dp) + 4 }
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
            isDirect: attackState.targetInfo!.type === "direct"
          },
        ])

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
            const defender = enemyField.unitZone[attackState.targetInfo!.index]
            if (defender) {
              // CHECK ENEMY TRAPS - PORTÃO DA FORTALEZA
              const trapPortaoIndex = enemyField.functionZone.findIndex(f => f?.id === "portao-da-fortaleza" && f.isFaceDown)
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
                const trapContraAtaqueIndex = enemyField.functionZone.findIndex(f => f?.id === "contra-ataque-surpresa" && f.isFaceDown)
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

              setEnemyField((prev) => {
                const newUnitZone = [...prev.unitZone]
                const newGraveyard = [...prev.graveyard]
                const isProtectedByProtonix = prev.ultimateZone &&
                  prev.ultimateZone.ability === "PROTONIX SWORD" &&
                  prev.ultimateZone.requiresUnit === defender.name

                if (newDefenderDp <= 0) {
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

              if (newDefenderDp <= 0 && attacker.id === "calem-sr") {
                setTimeout(() => {
                  setEnemyField((prev) => ({ ...prev, life: Math.max(0, prev.life - 1) }))
                  showEffectFeedback("VÁCUO DE ESSÊNCIA: 1DP de dano direto ao oponente!", "warning")
                }, 600)
              }

              if (newDefenderDp <= 0 && attacker.id === "calem-ur") {
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

              if (newDefenderDp <= 0 && attacker.id === "calem-lr") {
                setPlayerField((prev) => {
                  const newUnitZone = [...prev.unitZone]
                  const idx = attackState.attackerIndex!
                  if (newUnitZone[idx]) {
                    const cur = newUnitZone[idx]!
                    newUnitZone[idx] = { ...cur, currentDp: (cur.currentDp || cur.dp) + 3 }
                  }
                  return { ...prev, unitZone: newUnitZone }
                })
                showEffectFeedback("LEGIÃO DO GUARDIÃO ALADO: Calem +3DP!", "success")
              }

              const keepAttackReady = calemUrDoubleAttack && attacker.id === "calem-ur"
              setPlayerField((prev) => {
                const newUnitZone = [...prev.unitZone]
                newUnitZone[attackState.attackerIndex!] = { ...attacker, hasAttacked: !keepAttackReady }
                return { ...prev, unitZone: newUnitZone }
              })
              if (keepAttackReady) setCalemUrDoubleAttack(false)
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
            setPlayerField((prev) => {
              const newUnitZone = [...prev.unitZone]
              newUnitZone[attackState.attackerIndex!] = { ...attacker, hasAttacked: true }
              return { ...prev, unitZone: newUnitZone }
            })
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
  }, [attackState, playerField.unitZone, playerField.deck, playerField.graveyard, playerField.hand, enemyField.unitZone, enemyField.functionZone, triggerExplosion, turn, pulsoNulidadeLastUsedTurn, impactoSemFeLastUsedTurn, calemUrDoubleAttack, setEnemyField, setPlayerField, setAttackState, showEffectFeedback])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const handleHandCardDragStart = (index: number, e: React.MouseEvent | React.TouchEvent) => {
    if (!isPlayerTurn || phase !== "main") return

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

  const executeBotTurn = () => {
    if (enemyField.deck.length > 0) {
      setEnemyField((prev) => ({
        ...prev,
        hand: [...prev.hand, prev.deck[0]],
        deck: prev.deck.slice(1),
      }))
    }

    setTimeout(() => {
      setEnemyField((prev) => {
        let newHand = [...prev.hand]
        const newUnitZone = [...prev.unitZone]
        const newFunctionZone = [...prev.functionZone]
        let newScenarioZone = prev.scenarioZone
        let newUltimateZone = prev.ultimateZone

        // Bot plays Scenario cards ONLY in Scenario zone
        for (let i = newHand.length - 1; i >= 0; i--) {
          const card = newHand[i]
          if (card && card.type === "scenario" && !newScenarioZone) {
            newScenarioZone = card
            newHand.splice(i, 1)

            // Bot scenario effects
            if (card.ability === "RUÍNAS ABANDONADAS" || card.ability === "ARENA ESCANDINAVA") {
              const drawn = prev.deck[0]
              if (drawn) {
                newHand.push(drawn)
                setEnemyField(e => ({ ...e, deck: e.deck.slice(1) }))
                showEffectFeedback(`Bot: ${card.name} ativado! Bot comprou 1 carta.`, "warning")
              }
            }
            break // Only one scenario at a time
          }
        }

        // Apply scenario buffs to bot units if a scenario was played OR if units are placed
        // (We ensure DP is correct when units are placed later in this function)

        // Bot plays Ultimate cards (ultimateGear, ultimateGuardian) ONLY in Ultimate zone
        for (let i = newHand.length - 1; i >= 0; i--) {
          const card = newHand[i]
          if (card && isUltimateCard(card) && !newUltimateZone) {
            newUltimateZone = {
              ...card,
              currentDp: card.dp,
              canAttack: false,
              hasAttacked: false,
              canAttackTurn: turn,
            }
            // Apply passive DP bonus to matching unit if present
            if (card.requiresUnit) {
              const matchIdx = newUnitZone.findIndex((u) => u && u.name === card.requiresUnit)
              if (matchIdx !== -1 && newUnitZone[matchIdx]) {
                const unit = newUnitZone[matchIdx]!
                let bonus = 0
                if (card.ability === "ODEN SWORD") bonus = 4
                else if (card.ability === "PROTONIX SWORD") bonus = 2
                else if (card.ability === "TWILIGH AVALON") bonus = 2
                else if (card.ability === "MIGUEL ARCANJO") { bonus = 4 }
                else if (card.ability === "MEFISTO") { bonus = 2 }
                else if (card.ability === "FORNBRENNA") {
                  // Count fire units in enemy graveyard
                  const fireCount = prev.graveyard.filter((c) => c.element === "Pyrus" && (c.type === "unit")).length
                  bonus = fireCount * 2
                }
                // ULLRBOGI: no immediate bonus, only during battle
                if (bonus > 0) {
                  newUnitZone[matchIdx] = { ...unit, currentDp: unit.currentDp + bonus }
                }
              }
            }
            newHand.splice(i, 1)
            setEnemyUgAbilityUsed(false)
            break // Only one ultimate at a time
          }
        }

        for (let i = newHand.length - 1; i >= 0; i--) {
          const card = newHand[i]
          // Skip ultimate cards - they can only go in ultimate zone
          if (card && isUnitCard(card) && !isUltimateCard(card)) {
            const emptySlot = newUnitZone.findIndex((s) => s === null)
            if (emptySlot !== -1) {
              newUnitZone[emptySlot] = {
                ...card,
                currentDp: calculateCardDP(card, prev, true),
                canAttack: false,
                hasAttacked: false,
                canAttackTurn: turn,
              }
              newHand.splice(i, 1)
            }
          }
        }

        for (let i = newHand.length - 1; i >= 0; i--) {
          const card = newHand[i]
          // Skip scenario and ultimate cards
          if (card && !isUnitCard(card) && card.type !== "scenario") {
            const emptySlot = newFunctionZone.findIndex((s) => s === null)
            if (emptySlot !== -1) {
              newFunctionZone[emptySlot] = card
              newHand = newHand.filter((_, idx) => idx !== i)
            }
          }
        }

        // Bot plays cards from TAP if space exists and hand is low or no units
        if (prev.tap.length > 0) {
          const emptyUnitSlot = newUnitZone.findIndex(s => s === null)
          if (emptyUnitSlot !== -1) {
            const tapUnitIdx = prev.tap.findIndex(c => isUnitCard(c) && !isUltimateCard(c))
            if (tapUnitIdx !== -1) {
              const card = prev.tap[tapUnitIdx]
              newUnitZone[emptyUnitSlot] = {
                ...card,
                currentDp: calculateCardDP(card, prev, true),
                canAttack: false,
                hasAttacked: false,
                canAttackTurn: turn,
              }
              prev.tap.splice(tapUnitIdx, 1)
            }
          }

          if (!newUltimateZone) {
            const tapUltIdx = prev.tap.findIndex(c => isUltimateCard(c))
            if (tapUltIdx !== -1) {
              const card = prev.tap[tapUltIdx]
              newUltimateZone = {
                ...card,
                currentDp: card.dp,
                canAttack: false,
                hasAttacked: false,
                canAttackTurn: turn,
              }
              prev.tap.splice(tapUltIdx, 1)
              setEnemyUgAbilityUsed(false)
            }
          }
        }

        return {
          ...prev,
          hand: newHand,
          unitZone: newUnitZone as (FieldCard | null)[],
          functionZone: newFunctionZone as FunctionZoneCard[],
          scenarioZone: newScenarioZone,
          ultimateZone: newUltimateZone,
        }
      })

      setTimeout(() => {
        const botCanAttack = playerWentFirst ? turn >= 2 : turn >= 3 // Simplified bot attack condition

        // Bot ULLRBOGI: +3 DP to Ullr during battle phase
        setEnemyField((prevEnemy) => {
          if (prevEnemy.ultimateZone && prevEnemy.ultimateZone.ability === "ULLRBOGI" && prevEnemy.ultimateZone.requiresUnit) {
            const ullrIdx = prevEnemy.unitZone.findIndex((u) => u && u.name === prevEnemy.ultimateZone!.requiresUnit)
            if (ullrIdx !== -1 && prevEnemy.unitZone[ullrIdx]) {
              const newUnits = [...prevEnemy.unitZone]
              newUnits[ullrIdx] = { ...newUnits[ullrIdx]!, currentDp: newUnits[ullrIdx]!.currentDp + 3 }
              return { ...prevEnemy, unitZone: newUnits as (FieldCard | null)[] }
            }
          }
          return prevEnemy
        })

        // Bot also uses one-time UG abilities (ODEN SWORD and TWILIGH AVALON)
        setEnemyField((prevEnemy) => {
          if (!prevEnemy.ultimateZone || enemyUgAbilityUsed) return prevEnemy
          const ug = prevEnemy.ultimateZone
          const requiredUnit = ug.requiresUnit
          if (!requiredUnit) return prevEnemy
          const hasUnit = prevEnemy.unitZone.some((u) => u && u.name === requiredUnit)
          if (!hasUnit) return prevEnemy

          if (ug.ability === "ODEN SWORD") {
            // Destroy a player function card
            const funcIdx = playerField.functionZone.findIndex((f) => f !== null)
            if (funcIdx !== -1) {
              setPlayerField((prev) => {
                const newFuncs = [...prev.functionZone]
                const destroyed = newFuncs[funcIdx]
                newFuncs[funcIdx] = null
                return { ...prev, functionZone: newFuncs, graveyard: destroyed ? [...prev.graveyard, destroyed] : prev.graveyard }
              })
              setEnemyUgAbilityUsed(true)
              showEffectFeedback(`Bot ODEN SWORD: Function destruida!`, "error")
            }
          } else if (ug.ability === "TWILIGH AVALON") {
            // Return a player unit to hand and deal 3 damage
            // MIGUEL ARCANJO protection: skip Calem Hidenori
            const isCalemProtected = playerField.ultimateZone?.ability === "MIGUEL ARCANJO"
            const unitIdx = playerField.unitZone.findIndex((u) => u !== null && !(isCalemProtected && u.name === "Calem Hidenori"))
            if (unitIdx !== -1) {
              const unit = playerField.unitZone[unitIdx]
              setPlayerField((prev) => {
                const newUnits = [...prev.unitZone]
                const returned = newUnits[unitIdx]
                newUnits[unitIdx] = null
                return {
                  ...prev,
                  unitZone: newUnits as (FieldCard | null)[],
                  hand: returned ? [...prev.hand, returned] : prev.hand,
                  life: Math.max(0, prev.life - 3),
                }
              })
              setEnemyUgAbilityUsed(true)
              showEffectFeedback(`Bot TWILIGH AVALON: ${unit?.name} devolvida! -3 LP!`, "error")
            }
          } else if (ug.ability === "MEFISTO") {
            // Destroy any player card (unit or function) - once per duel
            // MIGUEL ARCANJO protection: skip Calem Hidenori
            const isCalemProtected = playerField.ultimateZone?.ability === "MIGUEL ARCANJO"
            const unitIdx = playerField.unitZone.findIndex((u) => u !== null && !(isCalemProtected && u.name === "Calem Hidenori"))
            const funcIdx = playerField.functionZone.findIndex((f) => f !== null)
            const targetIdx = unitIdx !== -1 ? unitIdx : -1
            if (targetIdx !== -1) {
              setPlayerField((prev) => {
                const newUnits = [...prev.unitZone]
                const destroyed = newUnits[targetIdx]
                newUnits[targetIdx] = null
                return { ...prev, unitZone: newUnits as (FieldCard | null)[], graveyard: destroyed ? [...prev.graveyard, destroyed] : prev.graveyard }
              })
              setEnemyUgAbilityUsed(true)
              showEffectFeedback(`Bot MEFISTO FOLES: Unidade destruida!`, "error")
            } else if (funcIdx !== -1) {
              setPlayerField((prev) => {
                const newFuncs = [...prev.functionZone]
                const destroyed = newFuncs[funcIdx]
                newFuncs[funcIdx] = null
                return { ...prev, functionZone: newFuncs, graveyard: destroyed ? [...prev.graveyard, destroyed] : prev.graveyard }
              })
              setEnemyUgAbilityUsed(true)
              showEffectFeedback(`Bot MEFISTO FOLES: Function destruida!`, "error")
            }
          }
          return prevEnemy
        })

        if (botCanAttack) {
          setEnemyField((prevEnemy) => {
            const newEnemyUnitZone = [...prevEnemy.unitZone]
            const newEnemyGraveyard = [...prevEnemy.graveyard]

            newEnemyUnitZone.forEach((unit, unitIdx) => {
              if (unit && !unit.hasAttacked) {
                const playerUnitIndex = playerField.unitZone.findIndex((u) => u !== null)

                if (playerUnitIndex !== -1) {
                  const defender = playerField.unitZone[playerUnitIndex] as FieldCard
                  const defenderDp = defender.currentDp
                  const attackerDp = unit.currentDp

                  const newDefenderDp = defenderDp - attackerDp
                  const newAttackerDp = attackerDp - defenderDp

                  setPlayerField((prevPlayer) => {
                    const newPlayerUnitZone = [...prevPlayer.unitZone]
                    const newPlayerGraveyard = [...prevPlayer.graveyard]

                    // PROTONIX SWORD protection: player's unit cannot be destroyed in battle
                    const isProtectedByProtonix = prevPlayer.ultimateZone &&
                      prevPlayer.ultimateZone.ability === "PROTONIX SWORD" &&
                      prevPlayer.ultimateZone.requiresUnit === defender.name

                    if (newDefenderDp <= 0) {
                      if (isProtectedByProtonix) {
                        // Protected: stays at 1 DP
                        newPlayerUnitZone[playerUnitIndex] = { ...defender, currentDp: 1 }
                        showEffectFeedback(`PROTONIX SWORD: ${defender.name} protegida! Resta 1 DP`, "success")
                      } else {
                        newPlayerGraveyard.push(defender)
                        newPlayerUnitZone[playerUnitIndex] = null
                      }
                    } else {
                      newPlayerUnitZone[playerUnitIndex] = { ...defender, currentDp: newDefenderDp }
                    }

                    return {
                      ...prevPlayer,
                      unitZone: newPlayerUnitZone,
                      graveyard: newPlayerGraveyard,
                    }
                  })

                  if (newAttackerDp <= 0) {
                    newEnemyGraveyard.push(unit)
                    newEnemyUnitZone[unitIdx] = null
                  } else {
                    newEnemyUnitZone[unitIdx] = { ...unit, currentDp: newAttackerDp, hasAttacked: true }
                  }
                } else {
                  setPlayerField((prevPlayer) => ({
                    ...prevPlayer,
                    life: Math.max(0, prevPlayer.life - unit.currentDp),
                  }))
                  newEnemyUnitZone[unitIdx] = { ...unit, hasAttacked: true }
                }
              }
            })

            return {
              ...prevEnemy,
              unitZone: newEnemyUnitZone as (FieldCard | null)[],
              graveyard: newEnemyGraveyard,
            }
          })
        }

        // Bot ULLRBOGI: remove +3 DP when leaving battle phase
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
          setTurn((prev) => prev + 1)
          setPhase("draw")
          setIsPlayerTurn(true)

          // Reset attack status and enable attacking for units that can now attack
          setPlayerField((prev) => ({
            ...prev,
            unitZone: prev.unitZone.map((unit) =>
              unit ? { ...unit, hasAttacked: false, canAttack: turn > unit.canAttackTurn } : null,
            ),
            ultimateZone: prev.ultimateZone
              ? { ...prev.ultimateZone, hasAttacked: false, canAttack: turn > prev.ultimateZone.canAttackTurn }
              : null,
          }))
          setEnemyField((prev) => ({
            // Also reset enemy units for the next turn if it becomes their turn
            ...prev,
            unitZone: prev.unitZone.map((unit) => (unit ? { ...unit, hasAttacked: false, canAttack: true } : null)),
            ultimateZone: prev.ultimateZone
              ? { ...prev.ultimateZone, hasAttacked: false, canAttack: true }
              : null,
          }))
        }, 500)
      }, 800)
    }, 500)
  }

  const endTurn = () => {
    setPhase("end")
    setCalemUrDoubleAttack(false)

    setPlayerField((prev) => ({
      ...prev,
      // Reset hasAttacked + reset Horizonte de Eventos DP buff for calem-ur (restores base dp)
      unitZone: prev.unitZone.map((unit) => {
        if (!unit) return null
        if (unit.id === "calem-ur") return { ...unit, hasAttacked: false, currentDp: unit.dp }
        return { ...unit, hasAttacked: false }
      }),
    }))

    setTimeout(() => {
      const nextTurn = turn + 1
      setTurn(nextTurn)
      setIsPlayerTurn(false)
      setPhase("draw")

      setEnemyField((prev) => ({
        ...prev,
        unitZone: prev.unitZone.map((unit) =>
          unit ? { ...unit, hasAttacked: false, canAttack: nextTurn > unit.canAttackTurn } : null,
        ),
      }))

      if (mode === "bot") {
        setTimeout(() => executeBotTurn(), 1000)
      }
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
      setIsPlayerTurn(true)
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
    setGameResult("lost")
    addMatchRecord({
      id: `match-${Date.now()}`,
      date: new Date().toISOString(),
      opponent: mode === "bot" ? "Bot" : "Player",
      mode,
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
        opponent: mode === "bot" ? "Bot" : "Player",
        mode,
        result: "lost",
        deckUsed: selectedDeck?.name || "Unknown",
      })
    } else if (enemyField.life <= 0) {
      gameResultRecordedRef.current = true
      setGameResult("won")
      addMatchRecord({
        id: `match-${Date.now()}`,
        date: new Date().toISOString(),
        opponent: mode === "bot" ? "Bot" : "Player",
        mode,
        result: "won",
        deckUsed: selectedDeck?.name || "Unknown",
      })
    }
  }, [playerField.life, enemyField.life, gameStarted, mode, selectedDeck?.name])

  if (!gameStarted) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex items-center justify-between p-4 bg-black/50">
          <Button onClick={onBack} variant="ghost" className="text-white">
            <ArrowLeft className="mr-2 h-5 w-5" />
            {t("back")}
          </Button>
          <h1 className="text-2xl font-bold text-white">{mode === "bot" ? t("vsBot") : t("vsPlayer")}</h1>
          <div className="w-20" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-xl text-white mb-6">Selecione um Deck</h2>

          {typedDecks.length === 0 ? (
            <p className="text-slate-400">Crie um deck primeiro no menu Construir Deck!</p>
          ) : (
            <div className="grid gap-4 w-full max-w-md">
              {typedDecks.map((deck) => (
                <Button
                  key={deck.id}
                  onClick={() => startGame(deck)}
                  className="h-16 text-lg bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500"
                >
                  <Swords className="mr-2" />
                  {deck.name} ({deck.cards.length} cartas)
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (gameResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black/90" suppressHydrationWarning>
        <h1 className={`text-6xl font-bold mb-8 ${gameResult === "won" ? "text-green-400" : "text-red-400"}`}>
          {gameResult === "won" ? t("victory") : t("defeat")}
        </h1>
        <Button onClick={onBack} className="px-8 py-4 text-xl bg-gradient-to-r from-slate-700 to-slate-600">
          {t("back")}
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={fieldRef}
      suppressHydrationWarning={true}
      className={`relative h-screen flex flex-col overflow-hidden select-none touch-none ${screenShake.active ? "animate-shake" : ""}`}
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
          <div
            className={`px-4 py-2 rounded-lg text-sm font-bold border-2 ${isPlayerTurn
              ? "bg-green-600/20 border-green-500 text-green-400"
              : "bg-red-600/20 border-red-500 text-red-400"
              }`}
          >
            {isPlayerTurn ? t("yourTurn") : t("enemyTurn")}
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

      {/* Main Battle Area with Playmat */}
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
                      style={{ opacity: 0.6 }}
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
                      {enemyField.graveyard.length}
                    </div>
                    <div className="w-14 h-20 relative">
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
                    className="w-14 h-20 bg-orange-600/80 rounded text-[10px] text-white flex flex-col items-center justify-center font-bold border border-orange-400/50 cursor-pointer hover:bg-orange-500/80 transition-animation"
                    onClick={() => setTapView("enemy")}
                  >
                    <span className="opacity-70">TAP</span>
                    <span>{enemyField.tap.length}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {/* Enemy Scenario Zone - Horizontal slot, aligned with unit zone */}
                  <div className="h-14 w-20 bg-amber-900/40 border border-amber-600/40 rounded flex items-center justify-center relative overflow-hidden">
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
                  <div className="w-14 h-20 bg-emerald-900/40 border border-emerald-600/40 rounded flex items-center justify-center relative overflow-hidden mx-auto">
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
              <div className="flex flex-col gap-1.5">
                {/* Enemy Function Zone */}
                <div className="flex justify-center items-center gap-1.5">
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
                        className={`w-14 h-20 bg-purple-900/40 border-2 rounded flex items-center justify-center relative overflow-hidden transition-all ${isUgTarget || (julgamentoVazioTargetMode.active && card)
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
                <div className="flex justify-center items-center gap-1.5">
                  {enemyField.unitZone.map((card, i) => (
                    <div
                      key={i}
                      data-enemy-unit={i}
                      onClick={() => {
                        if (ugTargetMode.active && (ugTargetMode.type === "twiligh_avalon" || ugTargetMode.type === "mefisto") && card) {
                          handleUgTargetEnemyCard("unit", i)
                        } else if (ugTargetMode.active && ugTargetMode.type === "julgamento_divino" && card) {
                          handleJulgamentoDivinoTarget(i)
                        } else if (julgamentoVazioTargetMode.active && card) {
                          handleJulgamentoVazioTarget("unit", i)
                        } else if (itemSelectionMode.active && itemSelectionMode.step === "selectEnemy") {
                          handleEnemyUnitSelect(i)
                        }
                      }}
                      className={`w-14 h-20 bg-red-900/30 border-2 rounded relative overflow-hidden transition-all ${(ugTargetMode.active && (ugTargetMode.type === "twiligh_avalon" || ugTargetMode.type === "mefisto" || ugTargetMode.type === "julgamento_divino") && card) ||
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
            <div className="flex justify-center items-center gap-3">
              {/* Player Zones */}
              <div className="flex flex-col gap-1.5">
                {/* Player Unit Zone */}
                <div className="flex justify-center items-center gap-1.5">
                  {playerField.unitZone.map((card, i) => {
                    const isDropTarget =
                      draggedHandCard &&
                      isUnitCard(draggedHandCard.card) &&
                      !card &&
                      draggedHandCard.currentY! < window.innerHeight * 0.6
                    const canAttack = card && canUnitAttackNow(card as FieldCard)

                    return (
                      <div
                        key={i}
                        data-player-unit-slot={i}
                        onClick={() => {
                          if (selectedHandCard !== null) {
                            placeCard("unit", i)
                          } else if (itemSelectionMode.active && itemSelectionMode.step === "selectAlly" && card) {
                            handleAllyUnitSelect(i)
                          }
                        }}
                        className={`w-14 h-20 bg-blue-900/30 border-2 rounded relative overflow-hidden transition-all duration-200 ${dropTarget?.type === "unit" && dropTarget?.index === i && !card
                          ? "border-green-400 bg-green-500/60 scale-115 shadow-lg shadow-green-500/50 ring-2 ring-green-400/50 animate-pulse"
                          : isDropTarget
                            ? "border-green-400/70 bg-green-500/30 scale-105"
                            : selectedHandCard !== null && isUnitCard(playerField.hand[selectedHandCard])
                              ? "border-green-500 bg-green-900/40 cursor-pointer"
                              : draggedHandCard && isUnitCard(draggedHandCard.card)
                                ? "border-blue-400/50 bg-blue-500/20"
                                : itemSelectionMode.active && itemSelectionMode.step === "selectAlly" && card
                                  ? "border-yellow-500 cursor-pointer hover:bg-yellow-900/30"
                                  : canAttack
                                    ? "border-yellow-400 shadow-lg shadow-yellow-500/40"
                                    : "border-blue-700/40"
                          }`}
                        style={{
                          transform: cardAnimations[`player-${i}`] || "none",
                          zIndex: cardAnimations[`player-${i}`] ? 50 : 1,
                        }}
                      >
                        {/* Yellow glow for playable/attackable cards */}
                        {canAttack && (
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
                <div className="flex justify-center items-center gap-1.5">
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
                        className={`w-14 h-20 bg-purple-900/30 border-2 rounded flex items-center justify-center cursor-pointer transition-all duration-200 relative overflow-hidden ${dropTarget?.type === "function" && dropTarget?.index === i && !card
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
              <div className="flex items-start gap-1">
                <div className="flex flex-col gap-1">
                  {/* Player Scenario Zone - Horizontal slot, aligned with unit zone */}
                  <div
                    data-player-scenario-slot
                    onClick={() => selectedHandCard !== null && playerField.hand[selectedHandCard]?.type === "scenario" && placeScenarioCard()}
                    className={`h-14 w-20 bg-amber-900/30 border-2 rounded flex items-center justify-center relative overflow-hidden transition-all duration-200 ${dropTarget?.type === "scenario" && !playerField.scenarioZone
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
                    className={`w-14 h-20 bg-emerald-900/30 border-2 rounded flex items-center justify-center relative overflow-hidden transition-all duration-200 mx-auto ${dropTarget?.type === "ultimate" && !playerField.ultimateZone
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
                        {isPlayerTurn && phase === "main" && !playerUgAbilityUsed && !ugTargetMode.active &&
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
                        {isPlayerTurn && phase === "main" && !julgamentoDivinoUsedThisTurn && !ugTargetMode.active &&
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
                <div className="flex gap-1">
                  <div className="flex flex-col gap-1">
                    <div className="w-14 h-20 relative">
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
                      className="w-14 h-20 bg-purple-900/80 rounded text-sm text-purple-300 flex items-center justify-center border border-purple-500/50 cursor-pointer hover:bg-purple-800/80 transition-colors"
                      onClick={() => setGraveyardView("player")}
                    >
                      {playerField.graveyard.length}
                    </div>
                  </div>
                    {/* TAP Pile Button with availability glow and card preview */}
                    {(() => {
                      const isTapAvailable = turn > 0 && turn % 3 === 0 && isPlayerTurn && phase === "main"
                      return (
                        <div className="relative group/tap">
                          <div
                            className={`w-14 h-20 rounded text-[10px] text-white flex flex-col items-center justify-center font-bold border transition-all duration-300 cursor-pointer relative z-10 ${isTapAvailable
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

      {/* Bottom HUD - Player info and controls */}
      <div className="relative z-20 bg-gradient-to-t from-black/95 via-black/90 to-transparent pt-2 pb-2 px-4">
        {/* Player LP bar */}
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

          {/* Phase buttons - Fixed height to prevent layout shift */}
          <div className="flex gap-2 min-h-[40px]">
            {isPlayerTurn && phase === "draw" && (
              <Button
                onClick={advancePhase}
                size="default"
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold px-6 shadow-lg shadow-green-500/30"
              >
                {t("drawCard")}
              </Button>
            )}
            {isPlayerTurn && phase === "main" && (
              <Button
                onClick={advancePhase}
                size="default"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-6 shadow-lg shadow-blue-500/30"
              >
                {t("toBattle")}
              </Button>
            )}
            {isPlayerTurn && phase === "battle" && (
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
          <div className="flex gap-3 items-end">
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
                    ? playerField.unitZone.some(slot => slot === null)
                    : playerField.functionZone.some(slot => slot === null)
              const canPlay = isPlayerTurn && phase === "main" && hasSpaceInZone

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
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease-out',
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
                        ? "border-yellow-400/70 hover:border-yellow-400 hover:shadow-2xl hover:-translate-y-4 hover:scale-105 shadow-yellow-500/30"
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setInspectedCard(null)}
          onTouchEnd={() => setInspectedCard(null)}
        >
          <div
            className="relative"
            style={{ animation: 'cardInspectIn 250ms ease-out forwards' }}
          >
            {/* Large glow effects */}
            <div className="absolute -inset-20 bg-gradient-to-br from-cyan-500/15 to-purple-500/15 blur-3xl rounded-full" />
            <div className="absolute -inset-12 bg-gradient-to-br from-cyan-400/20 to-purple-400/20 blur-2xl rounded-3xl" />
            <div className="absolute -inset-4 bg-white/5 blur-xl rounded-2xl" />
            {/* Card - Much larger */}
            <div className="relative rounded-3xl border-4 border-white/40 shadow-2xl overflow-hidden bg-slate-900"
              style={{ width: '280px', height: '392px' }}>
              <img
                src={inspectedCard.image || "/placeholder.svg"}
                alt={inspectedCard.name}
                className="w-full h-full object-contain"
              />
              {/* Shine overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
            </div>
            {/* Card info */}
            <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 text-center w-80">
              <div className="text-white font-bold text-2xl drop-shadow-lg">{inspectedCard.name}</div>
              {isUnitCard(inspectedCard) && (
                <div className="flex flex-col items-center gap-1 mt-2">
                  <div className={`text-xl font-semibold ${(inspectedCard as FieldCard).currentDp !== undefined && (inspectedCard as FieldCard).currentDp > inspectedCard.dp
                    ? "text-green-400"
                    : (inspectedCard as FieldCard).currentDp !== undefined && (inspectedCard as FieldCard).currentDp < inspectedCard.dp
                      ? "text-red-400"
                      : "text-cyan-400"
                    }`}>
                    {(inspectedCard as FieldCard).currentDp !== undefined ? (inspectedCard as FieldCard).currentDp : inspectedCard.dp} DP
                  </div>
                  {(inspectedCard as FieldCard).currentDp !== undefined && (inspectedCard as FieldCard).currentDp !== inspectedCard.dp && (
                    <div className="text-white/50 text-sm">
                      (Base: {inspectedCard.dp} DP | {(inspectedCard as FieldCard).currentDp > inspectedCard.dp ? "+" : ""}{(inspectedCard as FieldCard).currentDp - inspectedCard.dp})
                    </div>
                  )}
                </div>
              )}
              {!isUnitCard(inspectedCard) && (
                <div className="text-purple-400 text-lg mt-2 font-semibold">Carta de Funcao</div>
              )}
            </div>
            {/* Close hint */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-white/50 text-sm">
              Toque para fechar
            </div>
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

      {/* Dice Roll Animation */}
      {diceAnimation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/60 animate-fade-in" />

          {/* Dice container */}
          <div className="relative flex flex-col items-center gap-6">
            {/* Card name */}
            <div className="bg-gradient-to-r from-amber-900/90 to-orange-900/90 px-6 py-2 rounded-xl border border-amber-500/50 shadow-2xl">
              <p className="text-amber-400 font-bold text-lg">{diceAnimation.cardName}</p>
            </div>

            {/* 3D Dice */}
            <div className={`dice-scene ${diceAnimation.rolling ? 'dice-rolling' : ''}`}>
              <div className={`dice-cube ${!diceAnimation.rolling && diceAnimation.result ? `dice-face-${diceAnimation.result}` : ''}`}>
                <div className="dice-face dice-face-1">
                  <span className="dice-dot"></span>
                </div>
                <div className="dice-face dice-face-2">
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                </div>
                <div className="dice-face dice-face-3">
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                </div>
                <div className="dice-face dice-face-4">
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                </div>
                <div className="dice-face dice-face-5">
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                </div>
                <div className="dice-face dice-face-6">
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                  <span className="dice-dot"></span>
                </div>
              </div>
            </div>

            {/* Result display */}
            {!diceAnimation.rolling && diceAnimation.result && (
              <div className="dice-result-display">
                <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-4 rounded-2xl border-2 border-cyan-400/70 shadow-[0_0_30px_rgba(34,211,238,0.5)]">
                  <p className="text-white font-bold text-3xl text-center">
                    {diceAnimation.result}
                  </p>
                  <p className="text-cyan-200 text-sm text-center mt-1">
                    {diceAnimation.result <= 3 ? "Resultado Baixo" : "Resultado Alto"}
                  </p>
                </div>
              </div>
            )}

            {/* Rolling text */}
            {diceAnimation.rolling && (
              <p className="text-white font-bold text-xl animate-pulse">Rolando...</p>
            )}
          </div>
        </div>
      )}

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

      {/* Card Destruction Animation */}
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

      {julgamentoVazioTargetMode.active && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-violet-500/60 rounded-xl px-4 py-3 text-center">
          <h3 className="text-violet-300 font-bold text-sm mb-1">JULGAMENTO DO VAZIO ETERNO</h3>
          <p className="text-violet-200/80 text-xs mb-2">Selecione 1 carta inimiga para destruir</p>
          <button
            onClick={() => setJulgamentoVazioTargetMode({ active: false, attackerIndex: null })}
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
                const isAvailable = turn > 0 && turn % 3 === 0 && isPlayerTurn && phase === "main"
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

        @keyframes lacerationDmgNumber {
          0%,18%  { opacity: 0; transform: translateX(-50%) translateY(24px) scale(0.4) rotate(-8deg); }
          32%     { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1.35) rotate(2deg); }
          50%     { transform: translateX(-50%) translateY(0px) scale(1) rotate(0deg); }
          72%     { opacity: 1; }
          100%    { opacity: 0; transform: translateX(-50%) translateY(-28px) scale(0.85); }
        }
        .laceration-dmg-number { animation: lacerationDmgNumber 1.8s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    </div>
  )
}

export default DuelScreen
