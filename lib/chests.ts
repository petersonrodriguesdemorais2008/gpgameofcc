/**
 * BAÚS — itens que podem cair após vencer QUALQUER duelo (PvE ou PvP).
 *
 * Onde são obtidos: pequena chance ao vencer qualquer duelo do jogo.
 * Onde são abertos: tela de Itens (Inventário) → selecionar o baú → "Abrir".
 *
 * DROP: cada baú entrega SOMENTE fragmentos — nada de moedas ou cartas.
 * O fragmento é definido pela COR do baú, num pareamento 1:1:
 *
 *   Baú de Ventus    (verde)   → Fragmento de Nitrogênio (verde)
 *   Baú das Trevas   (roxo)    → Fragmento de Irídio     (roxo)
 *   Baú de Fogo      (vermelho)→ Fragmento de Rubídio    (vermelho)
 *   Baú de Aquos     (azul)    → Fragmento de Mercúrio   (azul)
 *   Baú da Luz       (amarelo) → Fragmento de Hélio      (amarelo)
 *   Baú do Vazio     (prata)   → Fragmento de Gálio      (prata)
 */

import { FRAGMENTS, type FragmentId } from "./fragments"

export type ChestId = "darkness" | "aquos" | "void" | "fire" | "lightness" | "ventus"

export interface ChestDef {
  id: ChestId
  name: string
  image: string
  /** Cor de destaque (brilho, borda, texto). Casa com a cor do fragmento. */
  color: string
  /** Elemento temático do baú (usado apenas para exibição). */
  element: string
  description: string
  /** Único fragmento que este baú entrega, pareado pela cor. */
  fragment: FragmentId
  /** Faixa de fragmentos entregues ao abrir. */
  amount: { min: number; max: number }
}

export const CHESTS: Record<ChestId, ChestDef> = {
  darkness: {
    id: "darkness",
    name: "Baú das Trevas",
    image: "/images/chests/bau-darkness.png",
    color: "#a855f7",
    element: "Darkus",
    description: "Um baú sombrio guardado por caveiras de ametista. Contém Fragmentos de Irídio.",
    fragment: "iridio",
    amount: { min: 6, max: 14 },
  },
  aquos: {
    id: "aquos",
    name: "Baú de Aquos",
    image: "/images/chests/bau-aquos.png",
    color: "#3b82f6",
    element: "Aquos",
    description: "Forjado nas profundezas geladas, guarda Fragmentos de Mercúrio das marés de Aquos.",
    fragment: "mercurio",
    amount: { min: 6, max: 14 },
  },
  void: {
    id: "void",
    name: "Baú do Vazio",
    image: "/images/chests/bau-void.png",
    color: "#cbd5e1",
    element: "Void",
    description: "Um baú pálido e silencioso, vindo do espaço entre os mundos. Contém Fragmentos de Gálio.",
    fragment: "galio",
    amount: { min: 8, max: 18 },
  },
  fire: {
    id: "fire",
    name: "Baú de Fogo",
    image: "/images/chests/bau-fire.png",
    color: "#ef4444",
    element: "Fire",
    description: "Quente ao toque, guarda Fragmentos de Rubídio forjados em chamas vivas.",
    fragment: "rubidio",
    amount: { min: 6, max: 14 },
  },
  lightness: {
    id: "lightness",
    name: "Baú da Luz",
    image: "/images/chests/bau-lightness.png",
    color: "#facc15",
    element: "Haos",
    description: "Reluzente e dourado, abriga Fragmentos de Hélio abençoados pela luz de Haos.",
    fragment: "helio",
    amount: { min: 6, max: 14 },
  },
  ventus: {
    id: "ventus",
    name: "Baú de Ventus",
    image: "/images/chests/bau-ventus.png",
    color: "#22c55e",
    element: "Ventus",
    description: "Leve como o vento, esconde Fragmentos de Nitrogênio trazidos pelas tempestades de Ventus.",
    fragment: "nitrogenio",
    amount: { min: 6, max: 14 },
  },
}

export const ALL_CHEST_IDS = Object.keys(CHESTS) as ChestId[]

/** Fragmento entregue por cada baú (atalho para leitura na UI). */
export const CHEST_FRAGMENT: Record<ChestId, FragmentId> = {
  darkness: "iridio",
  aquos: "mercurio",
  void: "galio",
  fire: "rubidio",
  lightness: "helio",
  ventus: "nitrogenio",
}

/** Definição completa do fragmento que um baú entrega. */
export function getChestFragment(chestId: ChestId) {
  return FRAGMENTS[CHESTS[chestId].fragment]
}

/** Contagem de baús no inventário do jogador. */
export type ChestCounts = Partial<Record<ChestId, number>>

export function isChestId(value: unknown): value is ChestId {
  return typeof value === "string" && value in CHESTS
}

/** Sanitiza um objeto arbitrário (ex.: localStorage) em contagens válidas. */
export function normalizeChestCounts(raw: unknown): ChestCounts {
  if (!raw || typeof raw !== "object") return {}
  const out: ChestCounts = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isChestId(key) && typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[key] = Math.floor(value)
    }
  }
  return out
}

/**
 * Chance de dropar um baú ao vencer QUALQUER duelo (PvE ou PvP).
 * Cerca de 1 em cada 6 vitórias, com o elemento sorteado uniformemente.
 */
const CHEST_DROP_CHANCE = 0.16

/** Sorteia se um baú deve dropar após uma vitória e, se sim, qual. */
export function rollChestDrop(): ChestId | null {
  if (Math.random() >= CHEST_DROP_CHANCE) return null
  return ALL_CHEST_IDS[Math.floor(Math.random() * ALL_CHEST_IDS.length)]
}

export interface ChestOpenResult {
  chestId: ChestId
  /** Fragmento entregue (sempre o da cor do baú). */
  fragmentId: FragmentId
  /** Quantidade de fragmentos entregues. */
  amount: number
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

/**
 * Sorteia a recompensa de abrir um baú: SEMPRE apenas fragmentos, do tipo
 * pareado com a cor do baú, numa quantidade dentro da faixa definida.
 */
export function rollChestReward(chestId: ChestId): ChestOpenResult {
  const def = CHESTS[chestId]
  return {
    chestId,
    fragmentId: def.fragment,
    amount: randomInt(def.amount.min, def.amount.max),
  }
}
