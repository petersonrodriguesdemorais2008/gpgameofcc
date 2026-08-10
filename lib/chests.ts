/**
 * BAÚS — itens que podem cair após vencer QUALQUER duelo (PvE ou PvP).
 *
 * Onde são obtidos: pequena chance ao vencer qualquer duelo do jogo.
 * Onde são abertos: tela de Itens (Inventário) → selecionar o baú → "Abrir".
 *
 * Cada baú é temático de um elemento e entrega Gear Coins + Gacha Coins,
 * com uma chance de também entregar uma carta daquele elemento.
 */

export type ChestId = "darkness" | "aquos" | "void" | "fire" | "lightness" | "ventus"

export interface ChestDef {
  id: ChestId
  name: string
  image: string
  /** Cor de destaque (brilho, borda, texto). */
  color: string
  /** Elemento de cartas que esse baú pode entregar. */
  element: string
  description: string
  /** Faixa de Gear Coins entregues ao abrir. */
  gear: { min: number; max: number }
  /** Faixa de Gacha Coins entregues ao abrir. */
  gacha: { min: number; max: number }
  /** Chance (0–1) de o baú também entregar uma carta do elemento dele. */
  cardChance: number
}

export const CHESTS: Record<ChestId, ChestDef> = {
  darkness: {
    id: "darkness",
    name: "Baú das Trevas",
    image: "/images/chests/bau-darkness.png",
    color: "#a855f7",
    element: "Darkus",
    description: "Um baú sombrio guardado por caveiras de ametista. Contém tesouros das trevas.",
    gear: { min: 40, max: 90 },
    gacha: { min: 8, max: 18 },
    cardChance: 0.18,
  },
  aquos: {
    id: "aquos",
    name: "Baú de Aquos",
    image: "/images/chests/bau-aquos.png",
    color: "#3b82f6",
    element: "Aquos",
    description: "Forjado nas profundezas geladas, guarda os tesouros das marés de Aquos.",
    gear: { min: 40, max: 90 },
    gacha: { min: 8, max: 18 },
    cardChance: 0.18,
  },
  void: {
    id: "void",
    name: "Baú do Vazio",
    image: "/images/chests/bau-void.png",
    color: "#cbd5e1",
    element: "Void",
    description: "Um baú pálido e silencioso, vindo direto do espaço entre os mundos.",
    gear: { min: 45, max: 100 },
    gacha: { min: 10, max: 20 },
    cardChance: 0.20,
  },
  fire: {
    id: "fire",
    name: "Baú de Fogo",
    image: "/images/chests/bau-fire.png",
    color: "#ef4444",
    element: "Fire",
    description: "Quente ao toque, guarda brasas e tesouros forjados em chamas vivas.",
    gear: { min: 40, max: 90 },
    gacha: { min: 8, max: 18 },
    cardChance: 0.18,
  },
  lightness: {
    id: "lightness",
    name: "Baú da Luz",
    image: "/images/chests/bau-lightness.png",
    color: "#facc15",
    element: "Haos",
    description: "Reluzente e dourado, abriga tesouros abençoados pela luz de Haos.",
    gear: { min: 40, max: 90 },
    gacha: { min: 8, max: 18 },
    cardChance: 0.18,
  },
  ventus: {
    id: "ventus",
    name: "Baú de Ventus",
    image: "/images/chests/bau-ventus.png",
    color: "#22c55e",
    element: "Ventus",
    description: "Leve como o vento, esconde tesouros trazidos pelas tempestades de Ventus.",
    gear: { min: 40, max: 90 },
    gacha: { min: 8, max: 18 },
    cardChance: 0.18,
  },
}

export const ALL_CHEST_IDS = Object.keys(CHESTS) as ChestId[]

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
  gear: number
  gacha: number
  /** Presente apenas quando o sorteio de carta deu sucesso. */
  cardId?: string
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

/**
 * Sorteia a recompensa de abrir um baú. O parâmetro `pickCardId` recebe o
 * elemento do baú e deve devolver o id de uma carta desse elemento (ou
 * undefined se nenhuma estiver disponível) — a escolha real das cartas fica
 * a cargo de quem chama, pois só o contexto do jogo tem `allCards`.
 */
export function rollChestReward(
  chestId: ChestId,
  pickCardId: (element: string) => string | undefined,
): ChestOpenResult {
  const def = CHESTS[chestId]
  const gear = randomInt(def.gear.min, def.gear.max)
  const gacha = randomInt(def.gacha.min, def.gacha.max)
  const wonCard = Math.random() < def.cardChance
  const cardId = wonCard ? pickCardId(def.element) : undefined
  return { chestId, gear, gacha, cardId }
}
