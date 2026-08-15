/**
 * LIVROS DE XP — itens consumíveis que concedem experiência a um Mestre
 * escolhido pelo jogador.
 *
 * Onde são obtidos: dropam com chance ao vencer Duelos do Modo Campanha
 * (Modo História).
 *
 * Onde são usados: na tela de Mestre, ao lado da barra de XP do Mestre
 * selecionado. O botão "Upar XP" abre um mini-painel onde o jogador escolhe
 * qual livro usar e quantos, arrastando um slider sobre a barra de XP. Ao
 * confirmar, o XP é somado ao Mestre selecionado (não precisa ser o Mestre
 * ativo).
 */

export type XPBookId = "xp_book_1" | "xp_book_2"

export interface XPBookDef {
  id: XPBookId
  name: string
  image: string
  /** Quanto de XP cada unidade deste livro concede ao Mestre. */
  xpAmount: number
  /** Cor de destaque do item (verde — mesma família do ícone de EXP). */
  color: string
  description: string
}

export const XP_BOOKS: Record<XPBookId, XPBookDef> = {
  xp_book_1: {
    id: "xp_book_1",
    name: "Livro de XP 1",
    image: "/images/items/xp-book-1.png",
    xpAmount: 150,
    color: "#4ade80",
    description: "Concede 150 de XP ao Mestre escolhido. Dropado em Duelos do Modo Campanha.",
  },
  xp_book_2: {
    id: "xp_book_2",
    name: "Livro de XP 2",
    image: "/images/items/xp-book-2.png",
    xpAmount: 300,
    color: "#16a34a",
    description: "Concede 300 de XP ao Mestre escolhido. Dropado em Duelos do Modo Campanha.",
  },
}

export const ALL_XP_BOOK_IDS: XPBookId[] = ["xp_book_1", "xp_book_2"]

export type XPBookCounts = Partial<Record<XPBookId, number>>

/** Sanitiza um mapa de contagens: só mantém IDs válidos com valor inteiro positivo. */
export function normalizeXPBookCounts(counts?: XPBookCounts | null): XPBookCounts {
  if (!counts) return {}
  const out: XPBookCounts = {}
  for (const id of ALL_XP_BOOK_IDS) {
    const n = Math.floor(counts[id] ?? 0)
    if (Number.isFinite(n) && n > 0) out[id] = n
  }
  return out
}

/**
 * Chance de drop de cada Livro de XP ao vencer um duelo do Modo Campanha.
 * Rolado de forma independente — o jogador pode até dropar os dois na
 * mesma vitória (raro), ou nenhum.
 */
const CAMPAIGN_DROP_TABLE: { id: XPBookId; chance: number }[] = [
  { id: "xp_book_1", chance: 0.30 },
  { id: "xp_book_2", chance: 0.12 },
]

/**
 * Rola o drop de Livro de XP para UMA vitória em Duelo do Modo Campanha.
 * Retorna apenas o primeiro livro que "acertar" a chance (evita empilhar
 * múltiplos toasts na mesma tela de resultado); ou null se não dropar nada.
 */
export function rollCampaignXPBookDrop(): { id: XPBookId; amount: number } | null {
  for (const entry of CAMPAIGN_DROP_TABLE) {
    if (Math.random() < entry.chance) return { id: entry.id, amount: 1 }
  }
  return null
}
