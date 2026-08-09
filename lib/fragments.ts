/**
 * FRAGMENTOS — novos itens dropados nos duelos dos Eventos (Treinamento Especial).
 *
 * Cada evento tem um fragmento elemental exclusivo (5 / 10 / 15 por vitória em
 * Fácil / Médio / Difícil) e todos eles também dropam o fragmento de Gálio
 * (2 / 4 / 8), que é o material comum compartilhado entre os treinamentos.
 */

export type FragmentId =
  | "nitrogenio"
  | "iridio"
  | "rubidio"
  | "mercurio"
  | "helio"
  | "galio"

export interface FragmentDef {
  id: FragmentId
  name: string
  image: string
  /** Cor de destaque usada nos selos e brilhos. */
  color: string
}

export const FRAGMENTS: Record<FragmentId, FragmentDef> = {
  nitrogenio: {
    id: "nitrogenio",
    name: "Fragmento de Nitrogênio",
    image: "/images/fragments/fragmento-nitrogenio.png",
    color: "#4ade80",
  },
  iridio: {
    id: "iridio",
    name: "Fragmento de Irídio",
    image: "/images/fragments/fragmento-iridio.png",
    color: "#c084fc",
  },
  rubidio: {
    id: "rubidio",
    name: "Fragmento de Rubídio",
    image: "/images/fragments/fragmento-rubidio.png",
    color: "#f87171",
  },
  mercurio: {
    id: "mercurio",
    name: "Fragmento de Mercúrio",
    image: "/images/fragments/fragmento-mercurio.png",
    color: "#60a5fa",
  },
  helio: {
    id: "helio",
    name: "Fragmento de Hélio",
    image: "/images/fragments/fragmento-helio.png",
    color: "#fbbf24",
  },
  galio: {
    id: "galio",
    name: "Fragmento de Gálio",
    image: "/images/fragments/fragmento-galio.png",
    color: "#e2e8f0",
  },
}

/** Fragmento comum que sai em todos os eventos. */
export const COMMON_FRAGMENT_ID: FragmentId = "galio"

/** Quantidade do fragmento elemental por dificuldade da fase. */
export const ELEMENTAL_FRAGMENT_DROP = { easy: 5, medium: 10, hard: 15 } as const

/** Quantidade do fragmento de Gálio por dificuldade da fase. */
export const COMMON_FRAGMENT_DROP = { easy: 2, medium: 4, hard: 8 } as const

/** Fragmento elemental de cada evento de treinamento. */
export const EVENT_FRAGMENT: Record<string, FragmentId> = {
  "ciclone-verde": "nitrogenio",
  "vastidao-roxa": "iridio",
  "incendio-vermelho": "rubidio",
  "tsunami-azul": "mercurio",
  "feixe-amarelo": "helio",
}

/** Contagem de fragmentos do jogador. */
export type FragmentCounts = Partial<Record<FragmentId, number>>

export function isFragmentId(value: unknown): value is FragmentId {
  return typeof value === "string" && value in FRAGMENTS
}

/** Sanitiza um objeto arbitrário (ex.: localStorage) em contagens válidas. */
export function normalizeFragmentCounts(raw: unknown): FragmentCounts {
  if (!raw || typeof raw !== "object") return {}
  const out: FragmentCounts = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isFragmentId(key) && typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[key] = Math.floor(value)
    }
  }
  return out
}
