"use client"

import { createContext, useContext, useState, useRef, useCallback, type ReactNode, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { FRAGMENTS, normalizeFragmentCounts, type FragmentCounts, type FragmentId } from "@/lib/fragments"
import { STAMINA_BOTTLE_MIN_MISSING, STAMINA_BOTTLE_REFILL_AMOUNT } from "@/lib/stamina-bottle"
import {
  loadMastersFromStorage,
  saveMastersToStorage,
  xpRequiredForLevel,
  cumulativeXPForLevel,
} from "@/lib/masters-data"
import {
  CHESTS,
  normalizeChestCounts,
  rollChestDrop,
  rollChestReward,
  type ChestCounts,
  type ChestId,
  type ChestOpenResult,
} from "@/lib/chests"
import {
  normalizeXPBookCounts,
  rollCampaignXPBookDrop,
  type XPBookCounts,
  type XPBookId,
} from "@/lib/xp-books"

export interface Card {
  id: string
  name: string
  image: string
  rarity: "R" | "SR" | "UR" | "LR"
  type: "unit" | "troops" | "magic" | "trap" | "action" | "ultimateGear" | "ultimateGuardian" | "ultimateElemental" | "item" | "scenario"
  element: "Aquos" | "Ventus" | "Pyrus" | "Fire" | "Terra" | "Darkus" | "Haos" | "Void"
  dp: number
  ability: string
  abilityDescription: string
  attack: string
  attackDescription?: string
  category: string
  requiresEquip?: string
  requiresUnit?: string
  isFaceDown?: boolean
}

export interface Playmat {
  id: string
  name: string
  image: string
  description: string
}

export interface Sleeve {
  id: string
  name: string
  image: string
  description: string
}

export interface Deck {
  id: string
  name: string
  cards: Card[]
  tapCards?: Card[]
  playmatId?: string
  useGlobalPlaymat?: boolean
}

export interface MatchRecord {
  id: string
  date: string
  opponent: string
  mode: "bot" | "player"
  result: "won" | "lost"
  deckUsed: string
}

export interface GiftBox {
  id: string
  title: string
  message: string
  cardId?: string
  coinsReward?: number
  playmatId?: string
  claimed: boolean
}

export interface Friend {
  id: string
  name: string
  avatarUrl?: string
  title?: string
  level: number
  mainUnit?: Card
  showcaseCards: Card[]
  affinityLevel: number
  affinityPoints: number
  lastHeartSent?: string
  lastHeartReceived?: string
  isGuest: boolean
  likes: number
}

export interface FriendRequest {
  id: string
  fromId: string
  fromName: string
  fromAvatarUrl?: string
  timestamp: string
  status: "pending" | "accepted" | "rejected"
}

export interface PlayerProfile {
  id: string
  name: string
  title: string
  level: number
  avatarUrl?: string
  mainUnit?: Card
  showcaseCards: Card[]
  hasCompletedSetup?: boolean
}

// Available profile icons
export const CARD_BACK_IMAGE = "/images/cards/card-back.png"

export const PROFILE_ICONS = [
  { id: "hrotti", name: "Hrotti", image: "/images/icons/hrotti-icon.png" },
  { id: "tsubasa", name: "Tsubasa", image: "/images/icons/tsubasa-icon.png" },
  { id: "morgana", name: "Morgana", image: "/images/icons/morgana-icon.png" },
  { id: "jaden", name: "Jaden", image: "/images/icons/jaden-icon.png" },
  { id: "uller", name: "Uller", image: "/images/icons/uller-icon.png" },
  { id: "fehnon", name: "Fehnon", image: "/images/icons/fehnon-icon.png" },
]

/** Icone de perfil vendido na loja (aba Icones). */
export interface ProfileIcon {
  id: string
  name: string
  image: string
  description: string
  element: string
  rarity: "rare" | "epic" | "legendary"
  gearPrice: number
  gachaPrice: number
}

/**
 * Precos propositalmente abaixo das skins de carta (1200 gear / 500 gacha)
 * e dos sleeves (750 / 300) — icones sao o cosmetico de entrada.
 */
export const ICON_PRICES = {
  rare: { gear: 350, gacha: 140 },
  epic: { gear: 500, gacha: 200 },
  legendary: { gear: 700, gacha: 280 },
} as const

export const SHOP_PROFILE_ICONS: ProfileIcon[] = [
  {
    id: "icon-phoenix-flame",
    name: "Fenix Incandescente",
    image: "/images/icons/avatars/phoenix-flame.png",
    description: "Um rosto de fenix forjado apenas em chamas vivas, olhos brancos de brasa.",
    element: "Fire",
    rarity: "rare",
    ...{ gearPrice: ICON_PRICES.rare.gear, gachaPrice: ICON_PRICES.rare.gacha },
  },
  {
    id: "icon-ice-wolf",
    name: "Lobo de Gelo Fraturado",
    image: "/images/icons/avatars/ice-wolf.png",
    description: "Lobo esculpido em lascas de gelo, exalando um uivo congelante azul.",
    element: "Aquos",
    rarity: "rare",
    ...{ gearPrice: ICON_PRICES.rare.gear, gachaPrice: ICON_PRICES.rare.gacha },
  },
  {
    id: "icon-void-kraken",
    name: "Kraken do Vazio",
    image: "/images/icons/avatars/void-kraken.png",
    description: "Tentaculos violeta e presas infinitas emergindo de chamas do abismo.",
    element: "Void",
    rarity: "epic",
    ...{ gearPrice: ICON_PRICES.epic.gear, gachaPrice: ICON_PRICES.epic.gacha },
  },
  {
    id: "icon-forge-titan",
    name: "Titan da Forja",
    image: "/images/icons/avatars/forge-titan.png",
    description: "Coloso de cobre rebitado com uma fornalha rugindo no lugar da boca.",
    element: "Subterra",
    rarity: "epic",
    ...{ gearPrice: ICON_PRICES.epic.gear, gachaPrice: ICON_PRICES.epic.gacha },
  },
  {
    id: "icon-bone-sovereign",
    name: "Soberano de Ossos",
    image: "/images/icons/avatars/bone-sovereign.png",
    description: "Cavaleiro esqueletico coroado por chamas carmesim e runas ardentes.",
    element: "Darkness",
    rarity: "legendary",
    ...{ gearPrice: ICON_PRICES.legendary.gear, gachaPrice: ICON_PRICES.legendary.gacha },
  },
  {
    id: "icon-eye-moth",
    name: "Mariposa dos Mil Olhos",
    image: "/images/icons/avatars/eye-moth.png",
    description: "Asas cosmicas cobertas de olhos que observam cada jogada do oponente.",
    element: "Void",
    rarity: "legendary",
    ...{ gearPrice: ICON_PRICES.legendary.gear, gachaPrice: ICON_PRICES.legendary.gacha },
  },
  {
    id: "icon-storm-wolf",
    name: "Lobo da Tempestade",
    image: "/images/icons/avatars/storm-wolf.png",
    description: "Fera negra atravessada por galhos de relampago violeta.",
    element: "Ventus",
    rarity: "epic",
    ...{ gearPrice: ICON_PRICES.epic.gear, gachaPrice: ICON_PRICES.epic.gacha },
  },
  {
    id: "icon-gold-scorpion",
    name: "Escorpiao Aureo",
    image: "/images/icons/avatars/gold-scorpion.png",
    description: "Carapaca de ouro e veneno esmeralda pingando do ferrao erguido.",
    element: "Subterra",
    rarity: "rare",
    ...{ gearPrice: ICON_PRICES.rare.gear, gachaPrice: ICON_PRICES.rare.gacha },
  },
  {
    id: "icon-shadow-devourer",
    name: "Devorador de Sombras",
    image: "/images/icons/avatars/shadow-devourer.png",
    description: "Silhueta chifruda cercada por aneis runicos e relampagos purpura.",
    element: "Darkness",
    rarity: "legendary",
    ...{ gearPrice: ICON_PRICES.legendary.gear, gachaPrice: ICON_PRICES.legendary.gacha },
  },
  {
    id: "icon-solar-lion",
    name: "Leao Solar",
    image: "/images/icons/avatars/solar-lion.png",
    description: "Juba de luz dourada e asas de fogo que rasgam o horizonte.",
    element: "Lightness",
    rarity: "legendary",
    ...{ gearPrice: ICON_PRICES.legendary.gear, gachaPrice: ICON_PRICES.legendary.gacha },
  },
  {
    id: "icon-ember-tiger",
    name: "Tigre das Brasas",
    image: "/images/icons/avatars/ember-tiger.png",
    description: "Predador tatuado com runas incandescentes, rugindo entre labaredas.",
    element: "Fire",
    rarity: "epic",
    ...{ gearPrice: ICON_PRICES.epic.gear, gachaPrice: ICON_PRICES.epic.gacha },
  },
  {
    id: "icon-verdant-dragon",
    name: "Dragao Verdejante",
    image: "/images/icons/avatars/verdant-dragon.png",
    description: "Escamas de ouro e folhas, com raios esmeralda escapando das presas.",
    element: "Ventus",
    rarity: "epic",
    ...{ gearPrice: ICON_PRICES.epic.gear, gachaPrice: ICON_PRICES.epic.gacha },
  },
  {
    id: "icon-magma-golem",
    name: "Golem de Magma",
    image: "/images/icons/avatars/magma-golem.png",
    description: "Placas de pedra rachadas revelando o nucleo de lava incandescente.",
    element: "Subterra",
    rarity: "rare",
    ...{ gearPrice: ICON_PRICES.rare.gear, gachaPrice: ICON_PRICES.rare.gacha },
  },
  {
    id: "icon-abyss-serpent",
    name: "Serpente do Abismo",
    image: "/images/icons/avatars/abyss-serpent.png",
    description: "Dragao de agua viva, brilhando em ciano nas profundezas escuras.",
    element: "Aquos",
    rarity: "epic",
    ...{ gearPrice: ICON_PRICES.epic.gear, gachaPrice: ICON_PRICES.epic.gacha },
  },
  {
    id: "icon-carnivore-bloom",
    name: "Flor Carnivora",
    image: "/images/icons/avatars/carnivore-bloom.png",
    description: "Petalas carmesim escondendo uma bocarra repleta de presas douradas.",
    element: "Ventus",
    rarity: "rare",
    ...{ gearPrice: ICON_PRICES.rare.gear, gachaPrice: ICON_PRICES.rare.gacha },
  },
  {
    id: "icon-tomb-pharaoh",
    name: "Farao do Tumulo",
    image: "/images/icons/avatars/tomb-pharaoh.png",
    description: "Mumia real acorrentada, com hieroglifos ardendo nas bandagens.",
    element: "Subterra",
    rarity: "legendary",
    ...{ gearPrice: ICON_PRICES.legendary.gear, gachaPrice: ICON_PRICES.legendary.gacha },
  },
  {
    id: "icon-neon-ronin",
    name: "Ronin Neon",
    image: "/images/icons/avatars/neon-ronin.png",
    description: "Samurai demoniaco cortando a matriz digital com uma lamina magenta.",
    element: "Darkness",
    rarity: "legendary",
    ...{ gearPrice: ICON_PRICES.legendary.gear, gachaPrice: ICON_PRICES.legendary.gacha },
  },
  {
    id: "icon-prism-colossus",
    name: "Coloso Prismatico",
    image: "/images/icons/avatars/prism-colossus.png",
    description: "Cristais iridescentes gravados com selos geometricos de energia rosa.",
    element: "Lightness",
    rarity: "legendary",
    ...{ gearPrice: ICON_PRICES.legendary.gear, gachaPrice: ICON_PRICES.legendary.gacha },
  },
]

/** Icones gratuitos (base) normalizados para o mesmo formato dos icones de loja. */
export const FREE_PROFILE_ICONS = PROFILE_ICONS.map((i) => ({ ...i, free: true as const }))

/** Procura um icone da loja pela imagem equipada. */
export function findShopIconByImage(image?: string | null): ProfileIcon | undefined {
  if (!image) return undefined
  return SHOP_PROFILE_ICONS.find((i) => i.image === image)
}

export interface AccountAuth {
  isLoggedIn: boolean
  email: string | null
  uniqueCode: string | null
  lastSaved: string | null
}

/** Recompensa de duelo: preset padrão ou valores explícitos (eventos). */
export type DuelRewardKind =
  | "normal"
  | "pvp"
  | { gacha: number; gear: number; fragments?: FragmentCounts }

interface GameContextType {
  coins: number
  setCoins: (coins: number) => void
  addCoins: (amount: number) => void
  addFP: (amount: number) => void
  gearCoins: number
  setGearCoins: React.Dispatch<React.SetStateAction<number>>
  addDuelRewards: (kind: DuelRewardKind) => {
    gacha: number
    gear: number
    fragments: FragmentCounts
    /** Baú dropado — garantido em todo duelo. */
    chest: ChestId
  }
  /** Fragmentos (itens de evento) no inventário do jogador. */
  fragments: FragmentCounts
  /** Baús no inventário do jogador (1 garantido por duelo concluído). */
  chests: ChestCounts
  /** Soma baús ao inventário. */
  addChests: (gain: ChestCounts) => void
  /** Quantidade de um baú específico. */
  getChestCount: (id: ChestId) => number
  /** Abre 1 baú: consome do inventário e entrega SOMENTE fragmentos da cor do baú. Retorna null se não houver o baú. */
  openChest: (id: ChestId) => ChestOpenResult | null
  /** Soma fragmentos ao inventário e devolve o total atualizado. */
  addFragments: (gain: FragmentCounts) => void
  /** Quantidade de um fragmento específico. */
  getFragmentCount: (id: FragmentId) => number
  /** Consome fragmentos (ex.: desbloqueio de Runas). Retorna false se faltar algum. */
  spendFragments: (cost: FragmentCounts) => boolean
  /** Skip Tíquetes: itens que pulam um duelo de Evento. */
  skipTickets: number
  /** Soma tíquetes ao inventário (bônus das missões diárias). */
  addSkipTickets: (amount: number) => void
  /** Consome 1 tíquete. Retorna false quando o jogador não tem nenhum. */
  consumeSkipTicket: () => boolean
  /** Garrafas de Energia: itens que recuperam stamina do jogador. */
  staminaBottles: number
  /** Soma garrafas ao inventário (ex.: Bônus Diário). */
  addStaminaBottles: (amount: number) => void
  /** Consome 1 garrafa e recupera stamina. Só funciona faltando 10+ de stamina; retorna false caso contrário. */
  useStaminaBottle: () => boolean
  /** Livros de XP: itens que concedem XP a um Mestre escolhido (dropam em Duelos do Modo Campanha). */
  xpBooks: XPBookCounts
  /** Soma livros ao inventário. */
  addXPBooks: (gain: XPBookCounts) => void
  /** Quantidade de um livro específico. */
  getXPBookCount: (id: XPBookId) => number
  /** Consome livros do inventário. Retorna false se faltar algum (nada é debitado nesse caso). */
  spendXPBooks: (cost: XPBookCounts) => boolean
  /** Rola o drop de Livro de XP ao vencer um duelo do Modo Campanha; soma ao inventário se dropar. */
  rollCampaignXPBook: () => { id: XPBookId; amount: number } | null
  collection: Card[]
  addToCollection: (cards: Card[]) => void
  decks: Deck[]
  saveDeck: (deck: Deck) => void
  deleteDeck: (deckId: string) => void
  matchHistory: MatchRecord[]
  addMatchRecord: (record: MatchRecord) => void
  allCards: Card[]
  giftBoxes: GiftBox[]
  claimGift: (giftId: string) => Card | null
  addGift: (gift: Omit<GiftBox, "id" | "claimed">) => void
  hasUnclaimedGifts: boolean
  playerId: string
  playerProfile: PlayerProfile
  updatePlayerProfile: (updates: Partial<PlayerProfile>) => void
  friends: Friend[]
  friendRequests: FriendRequest[]
  friendPoints: number
  spendableFP: number
  sendFriendRequest: (targetId: string) => boolean
  acceptFriendRequest: (requestId: string) => void
  rejectFriendRequest: (requestId: string) => void
  sendHeart: (friendId: string) => boolean
  sendHeartToAll: () => number
  likeFriendShowcase: (friendId: string) => void
  spendFriendPoints: (amount: number) => boolean
  searchPlayerById: (id: string) => Friend | null
  getGhostPlayers: (count: number) => Friend[]
  canSendHeartTo: (friendId: string) => boolean
  accountAuth: AccountAuth
  loginAccount: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  registerAccount: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithCode: (code: string, password: string) => Promise<{ success: boolean; error?: string }>
  registerWithCode: (password: string) => Promise<{ success: boolean; error?: string; code?: string }>
  linkEmailToCode: (email: string) => Promise<{ success: boolean; error?: string }>
  logoutAccount: () => void
  saveProgressManually: () => void
  allPlaymats: Playmat[]
  ownedPlaymats: Playmat[]
  globalPlaymatId: string | null
  setGlobalPlaymat: (playmatId: string | null) => void
  getPlaymatForDeck: (deck: Deck) => Playmat | null
  unlockPlaymat: (playmatId: string) => boolean
  allSleeves: Sleeve[]
  ownedSleeves: Sleeve[]
  globalSleeveId: string | null
  setGlobalSleeve: (sleeveId: string | null) => void
  unlockSleeve: (sleeveId: string) => boolean
  // Icones de perfil (avatares)
  shopProfileIcons: ProfileIcon[]
  ownedIconIds: string[]
  ownsProfileIcon: (iconId: string) => boolean
  unlockProfileIcon: (iconId: string) => boolean
  equipProfileIcon: (iconId: string) => boolean
  /** Todos os icones que o jogador pode equipar agora (gratuitos + comprados). */
  availableProfileIcons: { id: string; name: string; image: string }[]
  getActiveCardBack: () => string
  redeemCode: (code: string) => { success: boolean; message: string }
  redeemedCodes: string[]
  deleteAccountData: () => Promise<{ success: boolean; error?: string }>
  mobileMode: boolean
  setMobileMode: (enabled: boolean) => void
  // Stamina
  stamina: number
  maxStamina: number
  spendStamina: (amount: number) => boolean
  refillStamina: () => void
  staminaNextTickSeconds: number  // seconds until next +1 stamina (0 when full)
}

const GameContext = createContext<GameContextType | undefined>(undefined)

// Generate unique player ID
const generatePlayerId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let id = "GP-"
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

const DEFAULT_GUEST_FRIEND: Friend = {
  id: "GUEST-001",
  name: "[GUEST] Sakura",
  avatarUrl: "/images/cards/vivian-20sr.png",
  title: "Iniciante Dedicado",
  level: 15,
  mainUnit: undefined,
  showcaseCards: [],
  affinityLevel: 1,
  affinityPoints: 0,
  isGuest: true,
  likes: 0,
}

// Ghost players for when user doesn't have enough friends
const GHOST_PLAYERS: Friend[] = [
  {
    id: "GHOST-001",
    name: "[GUEST] Rei",
    title: "Mestre das Chamas",
    level: 25,
    showcaseCards: [],
    affinityLevel: 1,
    affinityPoints: 0,
    isGuest: true,
    likes: 0,
  },
  {
    id: "GHOST-002",
    name: "[GUEST] Yuki",
    title: "Guardiao do Gelo",
    level: 30,
    showcaseCards: [],
    affinityLevel: 1,
    affinityPoints: 0,
    isGuest: true,
    likes: 0,
  },
  {
    id: "GHOST-003",
    name: "[GUEST] Kaito",
    title: "Senhor dos Ventos",
    level: 28,
    showcaseCards: [],
    affinityLevel: 1,
    affinityPoints: 0,
    isGuest: true,
    likes: 0,
  },
  {
    id: "GHOST-004",
    name: "[GUEST] Hana",
    title: "Princesa da Terra",
    level: 22,
    showcaseCards: [],
    affinityLevel: 1,
    affinityPoints: 0,
    isGuest: true,
    likes: 0,
  },
  {
    id: "GHOST-005",
    name: "[GUEST] Akira",
    title: "Sombra Eterna",
    level: 35,
    showcaseCards: [],
    affinityLevel: 1,
    affinityPoints: 0,
    isGuest: true,
    likes: 0,
  },
]

// All available cards in the game
const ALL_CARDS: Card[] = [
  {
    id: "vivian-r",
    name: "Vivian: A Dama do Lago",
    image: "/images/vivian-20r.png",
    rarity: "R",
    type: "troops",
    element: "Aquos",
    dp: 1,
    ability: "Abraço das Profundezas",
    abilityDescription:
      "Quando ela for evocada, você pode escolher uma unidade de 2 ou 3DP do seu deck, e evoca-la no seu campo.",
    attack: "Vapor de Avalon",
    category: "Aquos Troops unit",
  },
  {
    id: "vivian-sr",
    name: "Vivian: A Dama do Lago",
    image: "/images/vivian-20sr.png",
    rarity: "SR",
    type: "troops",
    element: "Aquos",
    dp: 1,
    ability: "Abraço das Profundezas",
    abilityDescription:
      "Quando ela for evocada, você pode escolher uma unidade de 2 ou 3DP do seu deck, e evoca-la no seu campo.",
    attack: "Vapor de Avalon",
    category: "Aquos Troops unit",
  },
  {
    id: "cavaleiro-verde-r",
    name: "O Cavaleiro Verde",
    image: "/images/o-20cavaleiro-20verde-20r.png",
    rarity: "R",
    type: "troops",
    element: "Ventus",
    dp: 1,
    ability: "Clareira Sagrada",
    abilityDescription:
      "Se ele for evocado por alguma outra carta, seja unidade ou não, ele ganha +3DP e você pode comprar uma carta.",
    attack: "Provação Eterna",
    category: "Ventus Troops unit",
  },
  {
    id: "cavaleiro-verde-sr",
    name: "O Cavaleiro Verde",
    image: "/images/o-20cavaleiro-20verde-20sr.png",
    rarity: "SR",
    type: "troops",
    element: "Ventus",
    dp: 1,
    ability: "Clareira Sagrada",
    abilityDescription:
      "Se ele for evocado por alguma outra carta, seja unidade ou não, ele ganha +3DP e você pode comprar uma carta.",
    attack: "Provação Eterna",
    category: "Ventus Troops unit",
  },
  {
    id: "cavaleiro-afogado-r",
    name: "O Caveiro Afogado",
    image: "/images/o-20cavaleiro-20afogado-20r.png",
    rarity: "R",
    type: "troops",
    element: "Aquos",
    dp: 1,
    ability: "Juramento Submerso",
    abilityDescription: "Se ele for evocado por alguma outra carta sendo unidade ou não, Você compra uma carta.",
    attack: "Afogamento Eterno",
    category: "Aquos Troops unit",
  },
  {
    id: "cavaleiro-afogado-sr",
    name: "O Caveiro Afogado",
    image: "/images/o-20cavaleiro-20afogado-20sr.png",
    rarity: "SR",
    type: "troops",
    element: "Aquos",
    dp: 1,
    ability: "Juramento Submerso",
    abilityDescription: "Se ele for evocado por alguma outra carta sendo unidade ou não, Você compra uma carta.",
    attack: "Afogamento Eterno",
    category: "Aquos Troops unit",
  },
  {
    id: "ullr-sr",
    name: "Scandinavian Angel Ullr",
    image: "/images/ullr-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Ventus",
    dp: 2,
    ability: "Marca da Caçada",
    abilityDescription:
      "Ullr escolhe uma unidade do oponente como alvo, se for do elemento Ventus, ela perde 2DP, se for de outro elemento perde 1DP.",
    attack: "Veredito de Ullr",
    attackDescription:
      "Ao atacar, alguma unidade, ou diretamente o oponente, Compre uma carta, se for uma unidade do elemento Ventus, compre mais uma.",
    category: "Ventus Ultimate Gear user",
  },
  {
    id: "ullr-ur",
    name: "Scandinavian Angel Ullr",
    image: "/images/ullr-20ur.png",
    rarity: "UR",
    type: "unit",
    element: "Ventus",
    dp: 3,
    ability: "Juramento Eterno",
    abilityDescription:
      "Todos do elemento vento ganham mais 2DP, caso Ullr estiver usando a UG: Ullrbogi, serão 3DP, essa habilidade pode ser aplicada nele também, ela pode ser ativada a cada 4 turnos.",
    attack: "Flecha de Skadi",
    attackDescription:
      "Ele pode destruir qualquer unidade que tenha 2DP no total, esse efeito pode ser ativado somente uma vez",
    category: "Ventus Ultimate Gear user",
  },
  {
    id: "mr-p-r",
    name: "O Lorde Penguim Mr. P",
    image: "/images/mr.png",
    rarity: "R",
    type: "troops",
    element: "Aquos",
    dp: 1,
    ability: "Manuscrito de Guerra",
    abilityDescription:
      "(Se quiser) Selecione uma unidade do campo do seu oponente e diminua 2DP dela. Selecione uma carta da mão do seu oponente e faça-o descarta-la.",
    attack: "A Pena é Mais Forte que a Espada",
    category: "Aquos Troops unit",
  },
  {
    id: "mr-p-sr",
    name: "O Lorde Penguim Mr. P",
    image: "/images/mr.png",
    rarity: "SR",
    type: "troops",
    element: "Aquos",
    dp: 1,
    ability: "Manuscrito de Guerra",
    abilityDescription:
      "(Se quiser) Selecione uma unidade do campo do seu oponente e diminua 2DP dela. Selecione uma carta da mão do seu oponente e faça-o descarta-la.",
    attack: "A Pena é Mais Forte que a Espada",
    category: "Aquos Troops unit",
  },
  {
    id: "morgana-sr",
    name: "Morgana Pendragon",
    image: "/images/morgana-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Darkus",
    dp: 2,
    ability: "Acorde do Abismo",
    abilityDescription:
      "Toda vez que Morgana causa dano a um oponente diretamente, ela drena uma pequena quantidade de vida (1DP) para a vida do jogador. Se o oponente tiver uma unidade do elemento Luz em campo, a drenagem é dobrada (2DP).",
    attack: "Ressonância em Eclipse",
    attackDescription:
      "Se a unidade ou o oponente sobreviver a este ataque, ele fica impedido de sacar cartas ou ativar habilidades no próximo turno dele, esse efeito pode ser ativado a cada 2 turnos.",
    category: "Darkness Ultimate Gear user",
  },
  {
    id: "morgana-ur",
    name: "Morgana Pendragon",
    image: "/images/morgana-20ur.png",
    rarity: "UR",
    type: "unit",
    element: "Darkus",
    dp: 3,
    ability: "Domínio Eterno",
    abilityDescription:
      "Enquanto essa carta estiver em campo, o oponente não pode ativar cartas armadilhas. Se essa carta for removida do campo, o oponente perde 3PV",
    attack: "Sinfonia Relâmpago",
    attackDescription:
      "A cada 3 turnos ela pode destruir duas cartas de Action ou Armadilhas Correntes do oponente. Para cada carta destruída por este efeito, o oponente deve descartar as 3 cartas do topo do deck dele diretamente para o cemitério.",
    category: "Darkness Ultimate Gear user",
  },
  {
    id: "logi-ur",
    name: "Scandinavian Angel Logi",
    image: "/images/logi-20ur.png",
    rarity: "UR",
    type: "unit",
    element: "Fire",
    dp: 3,
    ability: "Cinzas do Mundo",
    abilityDescription:
      "Quando ele entrar em campo, você pode escolher uma unidade de qualquer elemento (sem ser essa) e adicionar 2DP a ela permanentemente, se não tiver nenhuma outra unidade fora essa, compre uma carta.",
    attack: "Devorar o Mundo",
    attackDescription:
      "Antes dele atacar, todas as cartas de unidades do openente perdem 2DP (Se ficarem com 0 serão destruídas), se ainda ficarem com DP, ficarão permanente com o DP diminuído, esse efeito é ativado a cada 3 turnos de batalha do jogador.",
    category: "Fire Ultimate Gear user",
  },
  {
    id: "oswin-r",
    name: "Oswin: O Comerciante",
    image: "/images/oswin-20r.png",
    rarity: "R",
    type: "unit",
    element: "Darkus",
    dp: 1,
    ability: "Lucro na Crise",
    abilityDescription:
      "Puxe 5 cartas do seu baralho, se tiver cartas de itens, escolha até duas dessas cartas para adiciona-las a sua mão, o resto das cartas você irá deixa-las abaixo do seu baralho, sendo elas as ultimas a serem compradas, Caso não tenha, escolha 1 carta dessas. Essa habilidade só pode ser ativada uma vez por duelo.",
    attack: "Arremesso de Mercadorias",
    category: "Darkness Troops unit",
  },
  {
    id: "oswin-sr",
    name: "Oswin: O Comerciante",
    image: "/images/oswin-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Darkus",
    dp: 1,
    ability: "Lucro na Crise",
    abilityDescription:
      "Puxe 5 cartas do seu baralho, se tiver cartas de itens, escolha até duas dessas cartas para adiciona-las a sua mão, o resto das cartas você irá deixa-las abaixo do seu baralho, sendo elas as ultimas a serem compradas, Caso não tenha, escolha 1 carta dessas. Essa habilidade só pode ser ativada uma vez por duelo.",
    attack: "Arremesso de Mercadorias",
    category: "Darkness Troops unit",
  },
  {
    id: "mordred-r",
    name: "Mordred: O Usurpador",
    image: "/images/mordred-20r.png",
    rarity: "R",
    type: "unit",
    element: "Haos",
    dp: 1,
    ability: "Destino de Camlann",
    abilityDescription:
      "Compre uma carta, se ela for uma unidade de tropa, Mordred ganha +2DP. Essa habilidade só pode ser ativada uma vez por duelo.",
    attack: "Traição do Rei Caído",
    category: "Lightness Troops unit",
  },
  {
    id: "mordred-sr",
    name: "Mordred: O Usurpador",
    image: "/images/mordred-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Haos",
    dp: 1,
    ability: "Destino de Camlann",
    abilityDescription:
      "Compre uma carta, se ela for uma unidade de tropa, Mordred ganha +2DP. Essa habilidade só pode ser ativada uma vez por duelo.",
    attack: "Traição do Rei Caído",
    category: "Lightness Troops unit",
  },
  {
    id: "merlin-r",
    name: "Merlin: O Mago do Destino",
    image: "/images/merlin-20r.png",
    rarity: "R",
    type: "unit",
    element: "Darkus",
    dp: 1,
    ability: "Visão Além do Agora",
    abilityDescription:
      "Puxe 5 cartas do seu baralho, escolha duas dessas cartas para adiciona-las a sua mão, o resto das cartas você irá deixa-las abaixo do seu baralho, sendo elas as ultimas a serem compradas. Essa habilidade só pode ser ativada uma vez por duelo.",
    attack: "Feitiço da Eternidade",
    category: "Darkness Troops unit",
  },
  {
    id: "merlin-sr",
    name: "Merlin: O Mago do Destino",
    image: "/images/merlin-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Darkus",
    dp: 1,
    ability: "Visão Além do Agora",
    abilityDescription:
      "Puxe 5 cartas do seu baralho, escolha duas dessas cartas para adiciona-las a sua mão, o resto das cartas você irá deixa-las abaixo do seu baralho, sendo elas as ultimas a serem compradas. Essa habilidade só pode ser ativada uma vez por duelo.",
    attack: "Feitiço da Eternidade",
    category: "Darkness Troops unit",
  },
  {
    id: "logi-sr",
    name: "Scandinavian Angel Logi",
    image: "/images/logi-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Fire",
    dp: 2,
    ability: "Incêndio Vivo",
    abilityDescription:
      "Cada unidade do oponente que ele derrota, é mais uma vez que ele pode atacar sendo unidade do oponente, ou diretamente, essa habilidade está ativa sempre que essa carta estiver em campo batalhando.",
    attack: "Explosão de Muspell",
    attackDescription:
      "Após ele usar esse ataque, você pode escolher uma unidade de fogo do seu campo em batalha, e adicionar 1DP a ela, esse efeito dura até o final dessa fase de batalha desse turno.",
    category: "Fire Ultimate Gear user",
  },
  {
    id: "vatnavordr-messiham-ur",
    name: "VATNAVORDR MESSIHAM",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/VATNAVORDR%20MESSIHAM-UnyqzuIO3gdLp8sxnC2ANycv4ZBEsm.png",
    rarity: "UR",
    type: "ultimateGear",
    element: "Aquos",
    dp: 0,
    ability: "Congelamento de Vatnavordr",
    abilityDescription: "Quando equipado em Hrotti, Hrotti ganha +2 DP. Selecione uma carta inimiga para congelá-la até o final do próximo turno do oponente. Se o alvo for uma unidade, cause também 2 DP de dano direto ao LP do oponente. Esta habilidade só pode ser ativada uma vez por duelo.",
    attack: "—",
    category: "Aquos Ultimate Gear",
    requiresUnit: "Scandinavian Angel Hrotti",
  },
  {
    id: "gram-sword-ur",
    name: "GRAM SWORD",
    image: "/images/cards/gram-sword.png",
    rarity: "UR",
    type: "ultimateGear",
    element: "Aquos",
    dp: 0,
    ability: "Poder da Gram Sword",
    abilityDescription:
      "Quando equipada em SCANDINAVIAN ANGEL Hrotti, Hrotti ganha +2DP. Você pode selecionar e mandar para o Cemitério um Card do campo do oponente. Esta segunda habilidade pode ser ativada somente uma única vez.",
    attack: "—",
    category: "Aquos Ultimate Gear",
    requiresUnit: "Scandinavian Angel Hrotti",
  },
  {
    id: "yggdra-nidhogg-ur",
    name: "YGGDRA NIDHOGG",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/YGGDRA%20NIDHOGG-vQtHkdJrrtpx8g0lIBPxdksaGCZpRw.png",
    rarity: "UR",
    type: "ultimateGear",
    element: "Fire",
    dp: 0,
    ability: "Destruição de Nidhogg",
    abilityDescription: "Quando equipado em Logi, Logi ganha +3 DP. Selecione e destrua uma carta de Função no campo do oponente. Esta habilidade só pode ser ativada uma vez por duelo.",
    attack: "—",
    category: "Fire Ultimate Gear",
    requiresUnit: "Scandinavian Angel Logi",
  },
  {
    id: "hrotti-lr",
    name: "Scandinavian Angel Hrotti",
    image: "/images/hrotti-20lr.png",
    rarity: "LR",
    type: "ultimateGuardian",
    element: "Aquos",
    dp: 4,
    ability: "Ira Maelstrom",
    abilityDescription:
      "Condição: Após causar dano de batalha ao oponente. Efeito: O oponente é forçado a colocar a carta do topo de seu Deck como a última carta de seu Deck. Além disso, você pode olhar a carta do topo do seu próprio Deck e colocá-la na parte inferior ou mantê-la onde está.",
    attack: "Tidal of Midgard",
    attackDescription:
      "Enquanto esta carta estiver no campo, o oponente não pode ativar Habilidades, Magias ou Armadilhas durante a sua Fase Principal 1 e Fase de Batalha. Esse efeito ativa na primeira fase de batalha do jogador que essa carta estiver em campo, esse efeito dura por 4 turnos.",
    category: "Aquos Ultimate Guardian user",
    requiresEquip: "MESSIHAM",
  },
  {
    id: "hrotti-ur",
    name: "Scandinavian Angel Hrotti",
    image: "/images/hrotti-20ur.png",
    rarity: "UR",
    type: "ultimateElemental",
    element: "Aquos",
    dp: 3,
    ability: "Herança de Andvaranaut",
    abilityDescription:
      "Todas as Ultimates Gears tem seus efeitos anulados por 3 turnos. Essa habilidade pode ser ativada somente uma vez.",
    attack: "Fafnisbani",
    attackDescription:
      "Quando Hrotti declara um ataque: Se a carta de unidade que ele atacar tiver 3 ou menos de DP total, essa carta ganha +2DP permanentemente, antes do ataque ser realizado, esse efeito será ativado.",
    category: "Aquos Ultimate Elemental user",
  },
  {
    id: "hrotti-sr",
    name: "Scandinavian Angel Hrotti",
    image: "/images/hrotti-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Aquos",
    dp: 2,
    ability: "Avareza de Fafnir",
    abilityDescription:
      "A cada 3 turnos, você pode descartar cartas do seu campo (qualquer tipo de carta ativa em seu campo) para conceder a Hrotti um bônus de DP dependendo de quantas cartas forem descartadas (1DP para cada)",
    attack: "Corte do Medo Rúnico",
    attackDescription:
      "Na fase de batalha, antes de Hrotti atacar, todas as unidades do oponente independente do elemento, perdem 1DP, essa habilidade é ativada a cada 2 turnos na fase de batalha do jogador.",
    category: "Aquos Ultimate Gear user",
  },
  {
    id: "galahad-sr",
    name: "Santo Graal: Galahad",
    image: "/images/galahad-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Haos",
    dp: 1,
    ability: "Coração Imaculado",
    abilityDescription:
      "Enquanto estiver em campo, Galahad não pode ser destruído por cartas do oponente, exceto se unidades do oponente forem ataca-lo.",
    attack: "Lâmina da Pureza",
    category: "Lightness Troops unit",
  },
  {
    id: "jaden-lr",
    name: "Jaden Hainaegi",
    image: "/images/jaden-20lr.png",
    rarity: "LR",
    type: "ultimateGuardian",
    element: "Fire",
    dp: 4,
    ability: "Magma Primordial",
    abilityDescription:
      "Causa 3 DP de dano direto ao oponente. Esse dano ignora qualquer carta, efeito ou condição, e não pode ser prevenido. Só pode ser ativada uma única vez por duelo.",
    attack: "Sol Carmesim",
    attackDescription:
      "Se esse ataque derrotar uma unidade, cause 2 DP de dano direto adicional ao oponente. Na fase de batalha do turno seguinte, todas as outras unidades inimigas recebem a mesma quantidade de dano (2DP) no próximo turno.",
    category: "Fire Ultimate Guardian user",
    requiresEquip: "IFRAID",
  },
  {
    id: "jaden-ur",
    name: "Jaden Hainaegi",
    image: "/images/jaden-20ur.png",
    rarity: "UR",
    type: "ultimateElemental",
    element: "Fire",
    dp: 3,
    ability: "Neo Núcleo",
    abilityDescription:
      "No início do turno do seu controlador, você pode ativar este efeito: Escolha 1 unidade inimiga, ela perde 1 DP. Se essa unidade for derrotada por este efeito, Jaden recebe +1DP neste turno. Pode ser ativada uma vez por turno. Não pode ser usada no turno em que Jaden entrou em campo.",
    attack: "Pressão Vulcânica",
    attackDescription:
      "Quando Jaden declara um ataque: Cause 1 DP de dano direto ao oponente antes da resolução do combate. Se o ataque derrotar a unidade inimiga, Jaden ganha +1DP",
    category: "Fire Ultimate Elemental user",
  },
  {
    id: "jaden-sr",
    name: "Jaden Hainaegi",
    image: "/images/jaden-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Fire",
    dp: 2,
    ability: "Núcleo Ardente",
    abilityDescription:
      "Causa dano de 2DP direto ignorando qualquer tipo de carta/efeito que tente negar essa habilidade. Ela só pode ser ativada uma única vez em um duelo.",
    attack: "Impacto Carmesim",
    attackDescription:
      "Se derrotar um inimigo, Jaden pode atacar novamente uma unidade do oponente ou atacá-lo diretamente.",
    category: "Fire Ultimate Elemental user",
  },
  {
    id: "arthur-lr",
    name: "Rei Arthur",
    image: "/images/arthur-20lr.png",
    rarity: "LR",
    type: "ultimateGuardian",
    element: "Darkus",
    dp: 4,
    ability: "O Preço da Coroa",
    abilityDescription:
      "Unidades inimigas com 5 ou 6 de DP, não podem declarar ataque contra ele. Quando essa carta for jogada, você tem a opção de comprar uma carta.",
    attack: "Cálice do Monarca",
    attackDescription:
      "Antes de declarar um ataque, você pode escolher descartar uma carta da sua mão, caso descarte, você pode escolher duas unidades do oponente como alvo, e destruí-las. Se a carta que você descartou foi uma magia, essa unidade ganha +2DP. Esse efeito só pode ser usado a cada 2 turnos.",
    category: "Darkness Ultimate Guardian user",
    requiresEquip: "MEFISTO",
  },
  {
    id: "arthur-ur",
    name: "Rei Arthur",
    image: "/images/arthur-20ur.png",
    rarity: "UR",
    type: "ultimateGuardian",
    element: "Darkus",
    dp: 3,
    ability: "Presença Esmagadora",
    abilityDescription: "Unidades inimigas com 3 ou 4 de DP, não podem declarar ataque contra ele.",
    attack: "Veredito do Rei Tirano",
    attackDescription:
      "Antes de declarar um ataque, você pode escolher descartar uma carta da sua mão, caso descarte, você pode escolher uma unidade do oponente como alvo, e destruí-la. Esse efeito só pode ser usado a cada 2 turnos.",
    category: "Darkness Ultimate Guardian user",
  },
  {
    id: "arthur-sr",
    name: "Rei Arthur",
    image: "/images/arthur-20sr.png",
    rarity: "SR",
    type: "ultimateElemental",
    element: "Darkus",
    dp: 2,
    ability: "Soberania das Sombras",
    abilityDescription:
      "Enquanto essa carta estiver no campo, seu oponente não pode ativar cartas com efeitos de 'Cura'.",
    attack: "Eclipse de Avalon",
    attackDescription: "Se esse ataque derrotar uma unidade, cause 3 DP de dano direto adicional ao oponente.",
    category: "Darkness Ultimate Elemental user",
  },
  {
    id: "calem-sr",
    name: "Calem Hidenori",
    image: "/images/cards/calem-sr.png",
    rarity: "SR",
    type: "ultimateElemental",
    element: "Void",
    dp: 2,
    ability: "Vácuo de Essência",
    abilityDescription:
      "Sempre que Calem destruir uma unidade do oponente em batalha, cause 1DP de dano direto aos LP do oponente.",
    attack: "Pulso da Nulidade",
    attackDescription:
      "Ao atacar: compre uma carta. Se for uma carta de Unidade de Tropas do Elemento Void, ele ganha +1DP até o final da fase de batalha. Esse efeito pode ser ativado a cada 3 Turnos.",
    category: "Void Ultimate Elemental user",
  },
  {
    id: "calem-ur",
    name: "Calem Hidenori",
    image: "/images/cards/calem-ur.png",
    rarity: "UR",
    type: "ultimateElemental",
    element: "Void",
    dp: 3,
    ability: "Horizonte de Eventos",
    abilityDescription:
      "Sempre que este personagem destruir uma unidade do oponente em batalha, ele recebe +2DP até o final do turno.",
    attack: "Impacto sem Fé",
    attackDescription:
      "Ao declarar um ataque: compre 1 carta. Se for uma Unidade, este personagem pode atacar novamente. Esse efeito pode ser ativado a cada 3 Turnos.",
    category: "Void Ultimate Elemental user",
  },
  {
    id: "calem-lr",
    name: "Calem Hidenori",
    image: "/images/cards/Calem_LR.png",
    rarity: "LR",
    type: "unit",
    element: "Void",
    dp: 4,
    ability: "Legião do Guardião Alado",
    abilityDescription:
      "Requer MIGUEL ARCANJO equipado. Sempre que uma unidade do oponente for destruída em batalha por esta unidade, esta Unidade ganha +3DP.",
    attack: "Julgamento do Vazio Eterno",
    attackDescription:
      "Ao declarar um ataque: veja qual foi a última carta que foi para o seu cemitério. Se for uma Unidade ou Action Function, selecione e destrua uma carta do oponente. Se o oponente não tiver mais cartas a serem destruídas, esta unidade ganha +4DP até o final dessa fase de batalha.",
    category: "Void Ultimate Guardian user",
    requiresEquip: "MIGUEL ARCANJO",
  },
  {
    id: "balin-r",
    name: "Balin: O Sentinela das Ruínas",
    image: "/images/cards/Balin_R.png",
    rarity: "R",
    type: "troops",
    element: "Void",
    dp: 1,
    ability: "Vigília Eterna",
    abilityDescription:
      "Quando esta carta entrar em campo, olhe as 3 cartas do topo do seu deck, adicione 1 à sua mão e coloque o restante no fundo do deck.",
    attack: "Lâmina de Poeira e Vácuo",
    category: "Void Troops unit",
  },
  {
    id: "balin-sr",
    name: "Balin: O Sentinela das Ruínas",
    image: "/images/cards/Balin_SR.png",
    rarity: "SR",
    type: "troops",
    element: "Void",
    dp: 1,
    ability: "Vigília Eterna",
    abilityDescription:
      "Quando esta carta entrar em campo, olhe as 3 cartas do topo do seu deck, adicione 1 à sua mão e coloque o restante no fundo do deck.",
    attack: "Lâmina de Poeira e Vácuo",
    category: "Void Troops unit",
  },
  {
    id: "lancelot-r",
    name: "Lancelot: O Herdeiro Sagrado",
    image: "/images/cards/Lancelot_R.png",
    rarity: "R",
    type: "troops",
    element: "Void",
    dp: 1,
    ability: "Virtude do Cavaleiro",
    abilityDescription:
      "Se você controlar qualquer Unidade de Elemento Void no seu campo, Lancelot ganha +2DP. Quando esta carta é destruída, você pode recuperar uma carta Funcion do seu cemitério e colocá-la na sua mão.",
    attack: "Impacto da Coroa",
    category: "Void Troops unit",
  },
  {
    id: "lancelot-sr",
    name: "Lancelot: O Herdeiro Sagrado",
    image: "/images/cards/Lancelot_SR.png",
    rarity: "SR",
    type: "troops",
    element: "Void",
    dp: 1,
    ability: "Virtude do Cavaleiro",
    abilityDescription:
      "Se você controlar qualquer Unidade de Elemento Void no seu campo, Lancelot ganha +2DP. Quando esta carta é destruída, você pode recuperar uma carta Funcion do seu cemitério e colocá-la na sua mão.",
    attack: "Impacto da Coroa",
    category: "Void Troops unit",
  },
  {
    id: "galahad-r",
    name: "Santo Graal: Galahad",
    image: "/images/galahad-20r.png",
    rarity: "R",
    type: "unit",
    element: "Haos",
    dp: 1,
    ability: "Coração Imaculado",
    abilityDescription:
      "Enquanto estiver em campo, Galahad não pode ser destruído por cartas do oponente, exceto se unidades do oponente forem ataca-lo.",
    attack: "Lâmina da Pureza",
    category: "Lightness Troops unit",
  },
  {
    id: "fehnon-ur",
    name: "Fehnon Hoskie",
    image: "/images/fehnon-20ur.png",
    rarity: "UR",
    type: "unit",
    element: "Aquos",
    dp: 3,
    ability: "Singularidade Zero",
    abilityDescription:
      "Ruptura: Enquanto este card estiver equipado com UG: Protonix Sword, ele pode realizar até dois ataques durante cada Fase de Batalha. Sempre que este personagem destruir uma unidade do oponente em batalha, ele recebe +2 DP até o final do turno.",
    attack: "Ordem de Laceração",
    attackDescription:
      "Ao declarar um ataque: compre 1 card. Se for uma Unidade, este personagem pode atacar novamente e o oponente não pode ativar efeitos em resposta a este ataque.",
    category: "Aquos Ultimate Gear user",
  },
  {
    id: "fehnon-sr",
    name: "Fehnon Hoskie",
    image: "/images/fehnon-20sr.png",
    rarity: "SR",
    type: "unit",
    element: "Aquos",
    dp: 2,
    ability: "Fluxo de Ruptura",
    abilityDescription:
      "Quando ele derrota em batalha uma unidade do oponente, cause 2DP como dano extra na vida do oponente por unidade derrotada, essa habilidade pode ser ativada toda vez que ele derrotar uma unidade do oponente.",
    attack: "Laceração",
    attackDescription:
      "Quando ele ataca, tanto uma unidade do oponente, quanto diretamente, compre uma carta, se for uma carta de unidade, ele pode atacar novamente.",
    category: "Aquos Ultimate Gear user",
  },
  {
    id: "fehnon-lr",
    name: "Fehnon Hoskie",
    image: "/images/cards/fehnon-lr.jpg",
    rarity: "LR",
    type: "unit",
    element: "Aquos",
    dp: 4,
    ability: "Ruptura do Núcleo Supremo",
    abilityDescription:
      "Sempre que uma unidade do oponente for destruída em batalha por esta unidade, cause 2 DP de dano direto aos LP do oponente.",
    attack: "Laceração do Mundo",
    attackDescription:
      "Ao declarar um ataque: Compre 1 carta. Se for uma Unidade ou Action Function, este personagem ganha +3DP até o final dessa fase de batalha, e pode atacar novamente.",
    category: "Aquos Ultimate Gear user",
    requiresEquip: "ODEN SWORD",
  },
  {
    id: "morgana-lr",
    name: "Morgana Pendragon",
    image: "/images/cards/morgana-lr.jpg",
    rarity: "LR",
    type: "unit",
    element: "Darkus",
    dp: 4,
    ability: "Domínio de Horizontes",
    abilityDescription:
      "Enquanto esta carta estiver em campo, o oponente não pode ativar nenhuma carta Action Function ou Trap Function durante todos os seus turnos.",
    attack: "Sinfonia da Discórdia Pendragon",
    attackDescription:
      "Uma vez a cada 2 turnos, escolha 1 carta de Ação ou Armadilha no Cemitério do oponente. Você pode ativar o efeito dessa carta como se fosse sua, sem pagar o custo de DP. Após o uso, em vez de voltar ao cemitério original, a carta é embaralhada no seu deck e o oponente perde 2 PV por ter sua 'estratégia roubada'.",
    category: "Darkness Ultimate Gear user",
    requiresEquip: "TWILIGH AVALON",
  },
  {
    id: "ullrbogi",
    name: "Ultimate Gear: Ullrbogi",
    image: "/images/ullrbogi.png",
    rarity: "UR",
    type: "ultimateGear",
    element: "Ventus",
    dp: 0,
    ability: "ULLRBOGI",
    abilityDescription: "Somente quando Ullr está equipado com esta arma, ele ganha mais 3DP em todos os momentos das fases de batalha do jogador",
    attack: "",
    category: "Ventus Ultimate Gear",
    requiresUnit: "Scandinavian Angel Ullr",
  },
  {
    id: "twiligh-avalon",
    name: "Ultimate Gear: Twiligh Avalon",
    image: "/images/twiligh-20avalon.png",
    rarity: "UR",
    type: "ultimateGear",
    element: "Darkus",
    dp: 0,
    ability: "TWILIGH AVALON",
    abilityDescription: "Quando equipada em Morgana, a Twiligh Avalon concede os seguintes efeitos: Morgana ganha +2DP, Você pode selecionar e devolver 1 Card do campo do seu oponente para a mão dele, Se o Card devolvido for uma unidade, cause 3DP de dano direto aos LP do oponente, essa segunda habilidade pode ser ativada somente uma única vez.",
    attack: "",
    category: "Darkness Ultimate Gear",
    requiresUnit: "Morgana Pendragon",
  },
  {
    id: "oden-sword",
    name: "Ultimate Gear: Oden Sword",
    image: "/images/oden-20sword.png",
    rarity: "UR",
    type: "ultimateGear",
    element: "Aquos",
    dp: 0,
    ability: "ODEN SWORD",
    abilityDescription: "Quando equipada em Fehnon Hoskie, a Oden Sword concede os seguintes efeitos: Fehnon ganha +4DP, Você pode selecionar e destruir um Card de Função do campo do seu oponente, essa segunda habilidade pode ser ativada somente uma única vez.",
    attack: "",
    category: "Aquos Ultimate Gear",
    requiresUnit: "Fehnon Hoskie",
  },
  {
    id: "protonix-sword",
    name: "Ultimate Gear: Protonix Sword",
    image: "/images/protonix-20sword.png",
    rarity: "SR",
    type: "ultimateGear",
    element: "Aquos",
    dp: 0,
    ability: "PROTONIX SWORD",
    abilityDescription: "Enquanto esta carta estiver equipada, o Fehnon Hoskie recebe +2 DP adicional.",
    attack: "",
    category: "Aquos Ultimate Gear",
    requiresUnit: "Fehnon Hoskie",
  },
  {
    id: "fornbrenna",
    name: "Ultimate Gear: Fornbrenna",
    image: "/images/fornbrenna.png",
    rarity: "UR",
    type: "ultimateGear",
    element: "Pyrus",
    dp: 0,
    ability: "FORNBRENNA",
    abilityDescription: "Somente quando Logi está equipado com esta arma, ele ganha mais 2DP a cada carta de unidade de fogo que já foi usada pelo jogador, cartas evocadas depois não serão incluídas.",
    attack: "",
    category: "Fire Ultimate Gear",
    requiresUnit: "Scandinavian Angel Logi",
  },
  {
    id: "miguel-arcanjo",
    name: "Ultimate Guardian: Miguel Arcanjo",
    image: "/images/cards/miguel-arcanjo.png",
    rarity: "UR",
    type: "ultimateGear",
    element: "Haos",
    dp: 0,
    ability: "MIGUEL ARCANJO",
    abilityDescription: "Quando está equipado em Calem Hidenori, ele concede os seguintes efeitos: Calem Hidenori ganha +4DP. Enquanto este Card estiver equipado, Calem Hidenori não pode ser alvo ou destruído por efeitos de Cards de Função do oponente. Julgamento Divino: Uma vez por turno, você pode selecionar uma Unidade no campo do oponente e diminuir -1DP.",
    attack: "",
    category: "Haos Ultimate Guardian",
    requiresUnit: "Calem Hidenori",
  },
  {
    id: "mefisto-foles",
    name: "Ultimate Guardian: Mefisto Fóles",
    image: "/images/cards/mefisto-foles.png",
    rarity: "UR",
    type: "ultimateGear",
    element: "Darkus",
    dp: 0,
    ability: "MEFISTO",
    abilityDescription: "Quando está equipado em Arthur, ele concede os seguintes efeitos: Arthur ganha +2 DP. Você pode selecionar 1 Card no campo do seu oponente e destruá-lo. Esta habilidade de controle pode ser ativada somente uma única vez por duelo.",
    attack: "",
    category: "Darkness Ultimate Guardian",
    requiresUnit: "Rei Arthur",
  },
  // SCENARIO CARDS
  {
    id: "reino-de-camelot",
    name: "Reino de Camelot",
    image: "/images/reino-de-camelot.png",
    rarity: "UR",
    type: "scenario",
    element: "Darkus",
    dp: 0,
    ability: "REINO DE CAMELOT",
    abilityDescription: "Efeito para determinadas cartas de unidades destacadas: Unidades da Irmandade ALVORADA DE AVALON e Unidades do Elemento DARK. Unidades da ALVORADA DE AVALON recebem +3DP. Unidades do Elemento DARK recebem +2DP. Demais Unidades do oponente perdem -2DP. Se uma carta for da Irmandade, mas também for do elemento destacado, ele receberá apenas o Efeito da Irmandade.",
    attack: "",
    category: "Scenario Card",
  },
  {
    id: "arena-escandinava",
    name: "Arena Escandinava",
    image: "/images/arena-escandinava.png",
    rarity: "UR",
    type: "scenario",
    element: "Haos",
    dp: 0,
    ability: "ARENA ESCANDINAVA",
    abilityDescription: "Efeito para determinadas cartas de unidades destacadas: Unidades da Irmandade SCANDINAVIAN ANGELS, ou no caso tendo Scandinavian Angels em seu nome. Unidades da SCANDINAVIAN ANGELS recebem +3DP. Compre uma carta quando esse Scenario for jogado no seu campo. Demais Unidades do oponente perdem -1DP.",
    attack: "",
    category: "Scenario Card",
  },
  {
    id: "vila-da-polvora",
    name: "Vila da Pólvora",
    image: "/images/vila-da-polvora.png",
    rarity: "UR",
    type: "scenario",
    element: "Pyrus",
    dp: 0,
    ability: "VILA DA PÓLVORA",
    abilityDescription: "Efeito para determinadas cartas de unidades destacadas: Unidades da Irmandade TORMENTA PROMINENCE e Unidades do Elemento FIRE. Unidades da TORMENTA PROMINENCE recebem +2DP. Unidades do Elemento FIRE recebem +1DP. Demais Unidades do oponente perdem -3DP. Se uma carta for da Irmandade, mas também for do elemento destacado, ele receberá apenas o Efeito da Irmandade.",
    attack: "",
    category: "Scenario Card",
  },
  {
    id: "ruinas-abandonadas",
    name: "Ruínas Abandonadas",
    image: "/images/ruinas-abandonadas.png",
    rarity: "UR",
    type: "scenario",
    element: "Haos",
    dp: 0,
    ability: "RUÍNAS ABANDONADAS",
    abilityDescription: "Efeito para determinadas cartas de unidades destacadas: Unidades da Irmandade THE GREAT ORDER e Unidades Tropas. Unidades da THE GREAT ORDER recebem +2DP. Unidades Tropas recebem +2DP. Compre uma carta quando esse Scenario for jogado no seu campo. Se uma carta for da Irmandade, mas também for tropa, ele receberá apenas o Efeito da Irmandade.",
    attack: "",
    category: "Scenario Card",
  },
  {
    id: "bandagens-duplas",
    name: "Bandagens Duplas",
    image: "/images/bandagens-duplas.png",
    rarity: "R",
    type: "item",
    element: "Haos",
    dp: 0,
    ability: "Cura",
    abilityDescription: "Essa carta cura 4LP do jogador de dano já sofrido.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "bandagem-restauradora",
    name: "Bandagem Restauradora",
    image: "/images/bandagem-restauradora.png",
    rarity: "R",
    type: "item",
    element: "Haos",
    dp: 0,
    ability: "Cura",
    abilityDescription: "Essa carta cura 2LP do jogador de dano já sofrido.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "cristal-recuperador",
    name: "Cristal Recuperador",
    image: "/images/cristal-recuperador.png",
    rarity: "R",
    type: "item",
    element: "Haos",
    dp: 0,
    ability: "Cura Avançada",
    abilityDescription:
      "Essa carta cura 3LP do jogador de dano já sofrido, em seguida compre uma carta, se for de Funcion, ela cura +1DP do jogador.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "dados-elementais-alpha",
    name: "Dados Elementais Alpha",
    image: "/images/dados-elementais-alpha.png",
    rarity: "SR",
    type: "item",
    element: "Darkus",
    dp: 0,
    ability: "Rolagem Elemental",
    abilityDescription:
      "Jogue um dado (efeito bônus se for do elemento específico): 1-2: uma unidade sua ganha +3DP. Se for (Darkness): compre +1 carta. 3-4: uma unidade sua ganha +4DP. Se for (Fire): você ganha +2LP. 5-6: uma unidade sua ganha +5DP. Se for (Aquos): você ganha +3LP. Requer uma carta de unidade dos elementos (Darkness, Fire ou Aquos). Se você tiver e não cair no elemento da sua unidade, essa carta não faz nada.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "dados-elementais-omega",
    name: "Dados Elementais Omega",
    image: "/images/dados-elementais-omega.png",
    rarity: "SR",
    type: "item",
    element: "Haos",
    dp: 0,
    ability: "Rolagem Elemental",
    abilityDescription:
      "Jogue um dado (efeito bônus se for do elemento específico): 1-2: uma unidade sua ganha +3DP. Se for (Neutral/Void): compre +1 carta. 3-4: uma unidade sua ganha +4DP. Se for (Lightness): você ganha +2LP. 5-6: uma unidade sua ganha +5DP e você ganha +3LP. Requer uma carta de unidade dos elementos (Neutral, Void, Lightness ou Ventus). Se você tiver e não cair no elemento da sua unidade, nada acontece.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "dados-da-calamidade",
    name: "Dados da Calamidade",
    image: "/images/dados-da-calamidade.png",
    rarity: "UR",
    type: "item",
    element: "Darkus",
    dp: 0,
    ability: "Risco e Recompensa",
    abilityDescription:
      "Jogue um dado: se cair em 1-2: uma unidade sua perde -5DP. 3-4: nada acontece. 5-6: uma unidade sua ganha +8DP, mas após 2 turnos -5DP.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "flecha-de-balista",
    name: "Flecha de Balista",
    image: "/images/cards/Flecha_de_Balista.png",
    rarity: "SR",
    type: "item",
    element: "Ventus",
    dp: 0,
    ability: "Disparo Certeiro",
    abilityDescription:
      "Selecione uma Unidade inimiga: ela perde -2DP. Se ficar com 0DP é destruída. Este efeito ignora Armadilhas.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "hidromel-dos-deuses",
    name: "Hidromel dos Deuses",
    image: "/images/cards/hidromel-dos-deuses.png",
    rarity: "SR",
    type: "item",
    element: "Haos",
    dp: 0,
    ability: "Néctar Divino",
    abilityDescription: "Restaure 5LP de sua Vida total.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "machado-de-arremesso",
    name: "Machado de Arremesso",
    image: "/images/cards/machado-de-arremesso.png",
    rarity: "SR",
    type: "item",
    element: "Pyrus",
    dp: 0,
    ability: "Arremesso Flamejante",
    abilityDescription: "Cause 3DP de dano diretamente a uma Unidade do oponente.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "pedra-de-afiar",
    name: "Pedra de Afiar",
    image: "/images/cards/Pedra_de_Afiar.png",
    rarity: "R",
    type: "item",
    element: "Terra",
    dp: 0,
    ability: "Fio da Lâmina",
    abilityDescription:
      "Se você tiver uma Ultimate Gear equipada: causa -1DP direto aos LP do oponente. Caso contrário, busque uma Ultimate Gear no seu deck e adicione à mão.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "dados-da-fortuna",
    name: "Dados da Fortuna",
    image: "/images/dados-da-fortuna.png",
    rarity: "R",
    type: "item",
    element: "Ventus",
    dp: 0,
    ability: "Sorte",
    abilityDescription:
      "Jogue um dado: 1-2: uma unidade sua ganha +1DP. 3-4: uma unidade sua ganha +2DP, e compre 1 carta. 5-6: uma unidade sua ganha +3DP e compre 2 cartas.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "amplificador-de-poder",
    name: "Amplificador de Poder",
    image: "/images/amplificador-de-poder.png",
    rarity: "SR",
    type: "item",
    element: "Pyrus",
    dp: 0,
    ability: "Absorção de Poder",
    abilityDescription:
      "Selecione uma carta de unidade no campo do oponente, o DP Original dela é somada ao DP total de alguma carta ativa no campo do jogador.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "cauda-de-dragao-assada",
    name: "Cauda de Dragão Assada",
    image: "/images/cauda-de-dragao-assada.png",
    rarity: "R",
    type: "item",
    element: "Pyrus",
    dp: 0,
    ability: "Banquete",
    abilityDescription:
      "Se você tiver 2 ou mais cartas de unidade em seu campo, todas essas unidades ganham +1DP, e você ganha +2LP total.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "adaga-energizada",
    name: "Adaga Energizada",
    image: "/images/adaga-energizada.png",
    rarity: "SR",
    type: "item",
    element: "Pyrus",
    dp: 0,
    ability: "Dano Direto",
    abilityDescription: "Se o oponente tiver duas cartas de unidades no campo dele, cause 4DP diretamente aos LP dele.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "dados-do-cataclismo",
    name: "Dados do Cataclismo",
    image: "/images/cards/dados-do-cataclismo.png",
    rarity: "UR",
    type: "item",
    element: "Pyrus",
    dp: 0,
    ability: "Rolagem Cataclísmica",
    abilityDescription:
      "Jogue um dado: 1-3: nenhuma unidade recebe bônus. 4-6: uma unidade sua ganha +6DP. Se sair 6, cause -3DP em uma unidade inimiga.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "projetil-de-impacto",
    name: "Projétil de Impacto",
    image: "/images/cards/projetil-de-impacto.png",
    rarity: "R",
    type: "item",
    element: "Pyrus",
    dp: 0,
    ability: "Dano Direto",
    abilityDescription: "Cause 2DP diretamente aos LP do oponente.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "nucleo-explosivo",
    name: "Núcleo Explosivo",
    image: "/images/cards/nucleo-explosivo.png",
    rarity: "SR",
    type: "item",
    element: "Pyrus",
    dp: 0,
    ability: "Explosão em Área",
    abilityDescription: "Cause 1 de dano a cada carta de unidade no campo do oponente.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "soro-recuperador",
    name: "Soro Recuperador",
    image: "/images/cards/soro-recuperador.png",
    rarity: "R",
    type: "item",
    element: "Haos",
    dp: 0,
    ability: "Cura e Compra",
    abilityDescription: "Essa carta cura 3LP do jogador de dano já sofrido, em seguida compre uma carta.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "dados-do-destino-gentil",
    name: "Dados do Destino Gentil",
    image: "/images/cards/dados-do-destino-gentil.png",
    rarity: "SR",
    type: "item",
    element: "Haos",
    dp: 0,
    ability: "Destino Incerto",
    abilityDescription:
      "Jogue um dado: se cair em 1, 2, ou 3, uma carta de unidade que você tem em campo perde -3DP. Se cair em 4, 5, ou 6, uma carta de unidade que você tem em campo ganha +5DP.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "kit-medico-improvisado",
    name: "Kit Médico Improvisado",
    image: "/images/cards/kit-medico-improvisado.png",
    rarity: "R",
    type: "item",
    element: "Haos",
    dp: 0,
    ability: "Cura Avançada",
    abilityDescription:
      "Essa carta cura 2LP do jogador de dano já sofrido, em seguida compre uma carta, se for de unidade, ela cura +1DP do jogador.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "calice-de-vinho-sagrado",
    name: "Cálice de Vinho Sagrado",
    image: "/images/cards/calice-de-vinho-sagrado.png",
    rarity: "SR",
    type: "item",
    element: "Haos",
    dp: 0,
    ability: "Bênção do Cálice",
    abilityDescription:
      "Restaure 1LP de sua Vida total, em seguida escolha uma Unidade em seu campo e adicione +1DP a ela.",
    attack: "",
    category: "Item Funcion Card",
  },
  {
    id: "contra-ataque-surpresa",
    name: "Contra-Ataque Surpresa",
    image: "/images/cards/contra-ataque-surpresa.png",
    rarity: "SR",
    type: "trap",
    element: "Pyrus",
    dp: 0,
    ability: "Contra-Ataque",
    abilityDescription: "Quando sua unidade recebe dano de batalha, O oponente recebe o mesmo valor de dano em seus LP.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "escudo-de-mana",
    name: "Escudo de Mana",
    image: "/images/cards/escudo-de-mana.png",
    rarity: "SR",
    type: "trap",
    element: "Aquos",
    dp: 0,
    ability: "Proteção",
    abilityDescription: "Quando o oponente ativa uma Magic Function ou Item Function de dano, Anule o efeito da carta e destrua-a.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "portao-da-fortaleza",
    name: "Portão da Fortaleza",
    image: "/images/cards/portao-da-fortaleza.png",
    rarity: "SR",
    type: "trap",
    element: "Terra",
    dp: 0,
    ability: "Defesa Sólida",
    abilityDescription: "Quando uma unidade do oponente declara um ataque contra sua unidade, Negue o ataque e mande a unidade atacante do oponente diretamente para a mão dele. Descarte uma carta da mão para ativar essa armadilha.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "brincadeira-de-mau-gosto",
    name: "Brincadeira de Mau Gosto",
    image: "/images/cards/brincadeira-de-mau-gosto.png",
    rarity: "SR",
    type: "trap",
    element: "Darkus",
    dp: 0,
    ability: "Sabotagem",
    abilityDescription: "Ative quando o oponente usar uma carta de Item Funcion ou uma Action Funcion: Negue o efeito da carta que o oponente ativou, e selecione uma Unidade do oponente e ela perde -2DP, caso ele não tenha Unidades, o oponente é obrigado a revelar a mão dele para você.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "visao-do-hrotti",
    name: "VISÃO DO HROTTI",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/VIS%C3%83O%20DO%20HROTTI-JYah7BSl5S9gr406UmZdV8cavmX0qB.png",
    rarity: "UR",
    type: "trap",
    element: "Aquos",
    dp: 0,
    ability: "Visão do Hrotti",
    abilityDescription:
      "Ativada quando o oponente ativa uma Habilidade ou quando o oponente joga uma Action Funcion, Negue a ativação da habilidade ou da carta Action Funcion do oponente. Congele imediatamente Uma Unidade do oponente e o seu DP é reduzido para 0 até o final do próximo turno.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "pressagio-de-logi",
    name: "PRESSÁGIO DE LOGI",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/PRESS%C3%81GIO%20DE%20LOGI-UsPCqUf8pWvQGdams4WMYFXoDR2l8X.png",
    rarity: "UR",
    type: "trap",
    element: "Fire",
    dp: 0,
    ability: "Presságio de Logi",
    abilityDescription:
      "Ativada quando o oponente equipa uma Ultimate Gear em uma Unidade dele, ou quando tenta curar uma unidade, Se você controlar o Logi no seu campo, a unidade inimiga também entra no estado de Queimadura (perde -1DP no início de cada turno do oponente durante 2 turnos, se chegar a 0, a Unidade é destruída e mandada para o cemitério.)",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "o-portal-da-yggdrasil",
    name: "O PORTAL DA YGGDRASIL",
    image: "/images/cards/o-portal-da-yggdrasil.png",
    rarity: "UR",
    type: "trap",
    element: "Haos",
    dp: 0,
    ability: "Portal da Yggdrasil",
    abilityDescription:
      "Ativada quando você recebe dano de uma Magic Function ou ataque de uma Unidade do Oponente. O oponente recebe o mesmo dano que ele causou, e você pode olhar as 3 cartas do topo do deck dele, devolvendo-as na ordem que você desejar.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "o-sol-da-meia-noite",
    name: "O SOL DA MEIA-NOITE",
    image: "/images/cards/o-sol-da-meia-noite.png",
    rarity: "UR",
    type: "trap",
    element: "Fire",
    dp: 0,
    ability: "Sol da Meia-Noite",
    abilityDescription:
      "Ativada se o oponente tiver mais Unidades que você. Escolha uma Unidade do oponente que tem no máximo 5DP. Ganhe LP no mesmo valor ao DP dela.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "percepcao-de-skadi",
    name: "PERCEPÇÃO DE SKADI",
    image: "/images/cards/percepcao-de-skadi.png",
    rarity: "UR",
    type: "trap",
    element: "Aquos",
    dp: 0,
    ability: "Percepção de Skadi",
    abilityDescription:
      "Ativada no momento em que o oponente joga uma Unidade no campo dele. O oponente deve revelar a mão e você escolhe 2 cartas para ele descartar ao cemitério, em seguida cause -2DP a uma Unidade no campo dele.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "a-lanca-que-tudo-perfura",
    name: "A LANÇA QUE TUDO PERFURA",
    image: "/images/cards/a-lanca-que-tudo-perfura.png",
    rarity: "UR",
    type: "trap",
    element: "Haos",
    dp: 0,
    ability: "A Lança que Tudo Perfura",
    abilityDescription:
      "Ativada durante a sua fase de ataque. Se o oponente ativar uma Trap que negue o seu ataque, negue o efeito daquela Trap e cause 1 de dano direto aos LP dele.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "podio-da-humilhacao",
    name: "PÓDIO DA HUMILHAÇÃO",
    image: "/images/cards/podio-da-humilhacao.png",
    rarity: "SR",
    type: "trap",
    element: "Void",
    dp: 0,
    ability: "Pódio da Humilhação",
    abilityDescription:
      "Ativada quando o oponente usa uma Item Function para curar LP ou aumentar o DP de uma unidade. O efeito do item é invertido. Se o item iria curar, ele causa aquele valor como dano. Se iria dar um bônus de DP, ele se torna uma penalidade de DP. Após o uso, a unidade alvo do oponente não pode receber buffs de outras Functions até o final do próximo turno.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "neblina-de-niflheim",
    name: "NEBLINA DE NIFLHEIM",
    image: "/images/cards/neblina-de-niflheim.png",
    rarity: "UR",
    type: "trap",
    element: "Void",
    dp: 0,
    ability: "Neblina de Niflheim",
    abilityDescription:
      "Ativada quando o oponente destrói 2 ou mais Unidades suas no mesmo turno. Você pode escolher uma Unidade da Irmandade SCANDINAVIAN ANGELS no seu Cemitério e invocá-la diretamente no seu campo. Além disso, o seu oponente não pode declarar ataques no próximo turno.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "o-preco-do-caolho",
    name: "O PREÇO DO CAOLHO",
    image: "/images/cards/o-preco-do-caolho.png",
    rarity: "SR",
    type: "trap",
    element: "Void",
    dp: 0,
    ability: "O Preço do Caolho",
    abilityDescription:
      "Ativada quando o oponente joga uma Magic Function. Pague 2LP e negue completamente a ativação da carta ou habilidade do oponente. Se a carta de Scenario Arena Escandinava estiver ativa no seu campo, você também compra 1 carta do topo do seu deck.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "chamado-das-valquirias",
    name: "CHAMADO DAS VALQUÍRIAS",
    image: "/images/cards/chamado-das-valquirias.png",
    rarity: "SR",
    type: "trap",
    element: "Void",
    dp: 0,
    ability: "Chamado das Valquírias",
    abilityDescription:
      "Ativada quando uma Unidade do seu campo da Irmandade SCANDINAVIAN ANGELS é destruída por um ataque da Unidade do Oponente. A Unidade do Oponente perde -4DP. Se o DP da Unidade do Oponente chegar a 0 por conta desse efeito, ela é destruída e mandada para o Cemitério, e você ganha +2LP.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "emboscada-dos-berserkers",
    name: "EMBOSCADA DOS BERSERKERS",
    image: "/images/cards/emboscada-dos-berserkers.png",
    rarity: "SR",
    type: "trap",
    element: "Void",
    dp: 0,
    ability: "Emboscada dos Berserkers",
    abilityDescription:
      "Ativada quando sua Unidade Ativa, ou você diretamente recebe dano de uma Magic Funcion ou de um ataque inimigo. Reduza o dano recebido pela metade, mas caso você tenha uma Unidade do elemento Fire ou Darkness na sua mão, você revela essa Unidade ao oponente, e todo o dano do oponente é anulado.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "armadilha-de-gelo",
    name: "ARMADILHA DE GELO",
    image: "/images/cards/armadilha-de-gelo.png",
    rarity: "UR",
    type: "trap",
    element: "Void",
    dp: 0,
    ability: "Armadilha de Gelo",
    abilityDescription:
      "Ativada quando uma Unidade inimiga declara um ataque. O ataque é cancelado e a unidade atacante fica no estado Congelada. Uma unidade congelada não pode atacar nem usar habilidades relacionadas a ela; o controlador só consegue descongelá-la se descartar uma carta da mão.",
    attack: "",
    category: "Trap Funcion Card",
  },
  {
    id: "ordem-de-laceracao",
    name: "Ordem de Laceração",
    image: "/images/cards/ordem-de-laceracao.png",
    rarity: "UR",
    type: "magic",
    element: "Aquos",
    dp: 0,
    ability: "Ataque Especial de Fehnon",
    abilityDescription:
      "Se estiver com Fehnon Hoskie em seu campo de batalha, use essa carta e cause 3DP diretamente no seu oponente, essa carta não pode ser negada por efeito de habilidades de cartas unidade do seu oponente.",
    attack: "",
    category: "Magic Funcion Card",
    requiresUnit: "fehnon",
  },
  {
    id: "sinfonia-relampago",
    name: "Sinfonia Relâmpago",
    image: "/images/cards/sinfonia-relampago.png",
    rarity: "UR",
    type: "magic",
    element: "Darkus",
    dp: 0,
    ability: "Ataque Especial de Morgana",
    abilityDescription:
      "Se estiver com Morgana Pendragon em seu campo de batalha, use essa carta e cause 4DP diretamente no seu oponente, essa carta não pode ser negada por armadilhas do seu oponente.",
    attack: "",
    category: "Magic Funcion Card",
    requiresUnit: "morgana",
  },
  {
    id: "veredito-do-rei-tirano",
    name: "Veredito do Rei Tirano",
    image: "/images/cards/veredito-do-rei-tirano.png",
    rarity: "UR",
    type: "magic",
    element: "Darkus",
    dp: 0,
    ability: "Ataque Especial de Rei Arthur",
    abilityDescription:
      "Se estiver com Rei Arthur em seu campo de batalha, use essa carta e cause 5DP em alguma unidade do seu oponente ou diretamente no LP dele.",
    attack: "",
    category: "Magic Funcion Card",
    requiresUnit: "arthur",
  },
  {
    id: "julgamento-do-vazio-eterno",
    name: "Julgamento do Vazio Eterno",
    image: "/images/cards/Julgamento_do_Vazio_Eterno.png",
    rarity: "UR",
    type: "magic",
    element: "Haos",
    dp: 0,
    ability: "Ataque Especial de Calem",
    abilityDescription:
      "Se estiver com Calem Hidenori em seu campo de batalha, use essa carta e cause 5DP em alguma unidade do seu oponente ou diretamente no LP dele.",
    attack: "",
    category: "Magic Funcion Card",
    requiresUnit: "calem",
  },
  {
    id: "fafnisbani",
    name: "Fafnisbani",
    image: "/images/cards/fafnisbani.png",
    rarity: "LR",
    type: "magic",
    element: "Aquos",
    dp: 0,
    ability: "Ataque Especial de Hrotti",
    abilityDescription:
      "Se estiver com Scandinavian Angel Hrotti em seu campo de batalha, use essa carta e cause 3DP em alguma unidade do seu oponente ou diretamente no LP dele, após isso, destrua uma carta Function do campo dele. Essa carta não pode ser negada por efeito de Ultimates Guardians do seu oponente.",
    attack: "",
    category: "Magic Funcion Card",
    requiresUnit: "hrotti",
  },
  {
    id: "devorar-o-mundo",
    name: "Devorar o Mundo",
    image: "/images/cards/devorar-o-mundo.png",
    rarity: "UR",
    type: "magic",
    element: "Pyrus",
    dp: 0,
    ability: "Ataque Especial de Logi",
    abilityDescription:
      "Se estiver com Scandinavian Angel Logi em seu campo de batalha, use essa carta e cause 4DP em alguma unidade do seu oponente ou diretamente no LP dele. Essa carta não pode ser negada por efeito de Armadilhas do seu oponente.",
    attack: "",
    category: "Magic Funcion Card",
    requiresUnit: "logi",
  },
  {
    id: "veu-dos-lacos-cruzados",
    name: "Véu dos Laços Cruzados",
    image: "/images/cards/veu-dos-lacos-cruzados.png",
    rarity: "SR",
    type: "action",
    element: "Haos",
    dp: 0,
    ability: "Laços de Amizade",
    abilityDescription:
      "Se tiver um unidade Fehnon Hoskie ou Jaden Hainaegi no seu campo, você pode escolher entre: Adicionar 2DP a uma dessas unidades no seu campo, ou diminuir 2DP de uma unidade do oponente.",
    attack: "",
    category: "Action Funcion Card",
    requiresUnit: "fehnon,jaden",
  },
  {
    id: "chamado-ao-banquete-nordico",
    name: "CHAMADO AO BANQUETE NÓRDICO",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/CHAMADO%20AO%20BANQUETE%20N%C3%93RDICO-qIYdrjL2t7PUuBAOPq6PUW0r76pPJ3.png",
    rarity: "UR",
    type: "action",
    element: "Fire",
    dp: 0,
    ability: "Chamado ao Banquete Nórdico",
    abilityDescription: "Escolha uma Unidade de Tropa do elemento Aquos ou Fire no seu Cemitério e invoque-a diretamente para o seu campo.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "chamas-de-eldfjall",
    name: "CHAMAS DE ELDFJALL",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/CHAMAS%20DE%20ELDFJALL-igcecPMod6q8CZUwuALvdd6PBdBfoU.png",
    rarity: "SR",
    type: "action",
    element: "Fire",
    dp: 0,
    ability: "Chamas de Eldfjall",
    abilityDescription: "Escolha uma Unidade do elemento Fire no seu campo. Ela ganha +3 DP até o fim do turno.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "maelstrom-boreal",
    name: "MAELSTROM BOREAL",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/MAELSTROM%20BOREAL-28xvx9Pn5opMsY3DG8anWKIZuvqqTT.png",
    rarity: "SR",
    type: "action",
    element: "Aquos",
    dp: 0,
    ability: "Maelstrom Boreal",
    abilityDescription: "Escolha uma Unidade do elemento Aquos no seu campo. Ela ganha +3 DP até o fim do turno.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "dualidade-do-caos-nordico",
    name: "DUALIDADE DO CAOS NÓRDICO",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Dualidade%20do%20Caos%20N%C3%B3rdico%20UR-JniJhgckJBnNSNYvq1KHdATIyku7xl.png",
    rarity: "UR",
    type: "action",
    element: "Void",
    dp: 0,
    ability: "Dualidade do Caos Nórdico",
    abilityDescription: "Se tiver uma unidade Scandinavian Angel Logi ou Scandinavian Angel Hrotti no seu campo, compre uma carta e destrua uma unidade inimiga com menos de 5 DP.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "colapso-da-bifrost",
    name: "COLAPSO DA BIFROST",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/COLAPSO%20DA%20BIFROST-e7Gncfxa3g0xcpGZOjwcCdN7S5q9l0.png",
    rarity: "UR",
    type: "action",
    element: "Void",
    dp: 0,
    ability: "Colapso da Bifrost",
    abilityDescription: "Destrua a carta de Cenário ativa no campo do oponente e cause 2 de dano aos LP dele.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "forja-de-brokk-e-eitri",
    name: "FORJA DE BROKK E EITRI",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/FORJA%20DE%20BROKK%20E%20EITRI-ABbtFrzGHW07BP86VwmRe8iRluKsti.png",
    rarity: "UR",
    type: "action",
    element: "Fire",
    dp: 0,
    ability: "Forja de Brokk e Eitri",
    abilityDescription: "Pague 5 LP e procure no seu deck por uma Ultimate Gear, adicione-a à sua mão e embaralhe seu deck.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "rivalidade-de-destinos-azuis",
    name: "RIVALIDADE DE DESTINOS AZUIS",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Rivalidade%20de%20Destinos%20Azuis%20SR-RWRApbQ7opw9Lc0ihiUV1BTpGhVGg9.png",
    rarity: "SR",
    type: "action",
    element: "Aquos",
    dp: 0,
    ability: "Rivalidade de Destinos Azuis",
    abilityDescription: "Se tiver uma unidade Fehnon Hoskie ou Scandinavian Angel Hrotti no seu campo, destrua uma unidade inimiga com menos de 4 DP e uma carta de função do oponente.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "investida-coordenada",
    name: "Investida Coordenada",
    image: "/images/cards/investida-coordenada.png",
    rarity: "SR",
    type: "action",
    element: "Haos",
    dp: 0,
    ability: "Investida Coordenada",
    abilityDescription:
      "Se você tiver 2 ou mais Unidades da mesma Irmandade em seu campo, escolha uma Unidade inimiga: ela perde -2DP até o fim do turno.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "lacos-da-ordem",
    name: "Laços da Ordem",
    image: "/images/cards/lacos-da-ordem.png",
    rarity: "SR",
    type: "action",
    element: "Void",
    dp: 0,
    ability: "Laços da Ordem",
    abilityDescription:
      "Ative esta carta apenas se você possuir 2 ou mais Unidades da Irmandade \"The Great Order\" (Fehnon, Morgana ou Calem) em campo: Recupere uma carta Action Function do seu Cemitério. Se possuir o trio completo em campo, compre uma carta do deck; se for uma Função, escolha uma Unidade sua e adicione +2DP a ela.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "estrategia-real",
    name: "Estratégia Real",
    image: "/images/cards/estrategia-real.png",
    rarity: "SR",
    type: "action",
    element: "Darkus",
    dp: 0,
    ability: "Estratégia Real",
    abilityDescription:
      "Compre uma carta. Se você tiver o \"Rei Arthur\" em campo, compre duas cartas.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "ventos-de-camelot",
    name: "Ventos de Camelot",
    image: "/images/cards/ventos-de-camelot.png",
    rarity: "SR",
    type: "action",
    element: "Ventus",
    dp: 0,
    ability: "Ventos de Camelot",
    abilityDescription:
      "Selecione uma Unidade do Elemento Ventus ou Lightness no seu campo. Ela pode atacar duas vezes nessa fase de batalha, mas você não pode usar Magic Functions até o final desse turno.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "troca-de-guarda",
    name: "Troca de Guarda",
    image: "/images/cards/troca-de-guarda.png",
    rarity: "SR",
    type: "action",
    element: "Darkus",
    dp: 0,
    ability: "Troca de Guarda",
    abilityDescription:
      "Retorne uma das suas Unidades do Elemento Darkness que esteja ativa no seu campo para a sua mão.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "chamado-da-tavola",
    name: "Chamado da Távola",
    image: "/images/cards/Chamado_da_Távola.png",
    rarity: "SR",
    type: "action",
    element: "Haos",
    dp: 0,
    ability: "Chamado da Távola",
    abilityDescription:
      "Procure em seu deck por uma Unidade de Tropa, revele-a e adicione-a à sua mão. Em seguida, embaralhe o seu deck.",
    attack: "",
    category: "Action Funcion Card",
  },
  {
    id: "alvorada-de-albion",
    name: "Alvorada de Albion",
    image: "/images/cards/alvorada-de-albion.jpg",
    rarity: "UR",
    type: "action", // Functions are technically action type but remain on field due to resolve logic
    element: "Void",
    dp: 0,
    ability: "Alvorada de Albion",
    abilityDescription:
      "Brotherhood Function (Permanece em campo).\n- Rei Arthur recebe +3DP; Tropas Darkness +2DP.\n- Hora das Sombras: Compre uma carta ao jogar.\n- Soberania: O debuff de REINO DE CAMELOT contra inimigos dobra (-4DP).",
    attack: "",
    category: "Brotherhood Function Card",
  },
  {
    id: "a-grande-ordem",
    name: "A Grande Ordem",
    image: "/images/cards/a-grande-ordem.jpg",
    rarity: "UR",
    type: "action",
    element: "Void",
    dp: 0,
    ability: "A Grande Ordem",
    abilityDescription:
      "Brotherhood Function (Permanece em campo).\n- Unidades Fehnon, Morgana ou Calem recebem +3DP.\n- União: Ao baixar um destes membros, busque outro no deck e adicione à mão.\n- Melodia: (Desativado no ambiente online.)",
    attack: "",
    category: "Brotherhood Function Card",
  },
  {
    id: "thoren-mareen-r",
    name: "Thoren e Mareen, os Exploradores de Névoa",
    image: "/images/cards/thoren-mareen.png",
    rarity: "R",
    type: "troops",
    element: "Aquos",
    dp: 1,
    ability: "Sinais da Maré",
    abilityDescription: "Enquanto esta carta estiver em campo, todas as Unidades Aquos do seu campo ganham +2 DP.",
    attack: "Domínio do Fiorde",
    category: "Aquos Troops unit",
  },
  {
    id: "vaelor-mestre-emboscada-r",
    name: "Vaelor, o Mestre da Emboscada",
    image: "/images/cards/vaelor-mestre-emboscada.png",
    rarity: "R",
    type: "troops",
    element: "Ventus",
    dp: 1,
    ability: "Terreno Favorável",
    abilityDescription: "Após atacar, você pode retornar esta unidade para a mão.",
    attack: "Avanço Calculado",
    category: "Ventus Troops unit",
  },
  {
    id: "piromantes-labareda-r",
    name: "Piromantes de Labareda",
    image: "/images/cards/piromantes-labareda.png",
    rarity: "R",
    type: "troops",
    element: "Fire",
    dp: 1,
    ability: "Fogo Compartilhado",
    abilityDescription: "Sempre que outra Unidade de Fogo do seu campo causar dano direto aos LP do oponente, esta carta ganha +1 DP.",
    attack: "Coroa de Fogo",
    category: "Fire Troops unit",
  },
  {
    id: "runi-mercador-fiordes-r",
    name: "Rúni, o Mercador dos Fiordes",
    image: "/images/cards/runi-mercador-fiordes.png",
    rarity: "R",
    type: "troops",
    element: "Aquos",
    dp: 1,
    ability: "Troca Justa",
    abilityDescription: "Uma vez por turno, você pode descartar uma carta da sua mão e comprar uma nova carta.",
    attack: "Taxa de Passagem",
    category: "Aquos Troops unit",
  },
  {
    id: "runista-odin-r",
    name: "Runista de Odin",
    image: "/images/cards/runista-odin.png",
    rarity: "R",
    type: "troops",
    element: "Haos",
    dp: 1,
    ability: "Runa da Revelação",
    abilityDescription: "Uma vez por turno, você pode descartar uma carta. Se fizer isso, compre 2 cartas.",
    attack: "Escrita do Destino",
    category: "Lightness Troops unit",
  },
  {
    id: "sacerdote-olho-perdido-r",
    name: "Sacerdote do Olho Perdido",
    image: "/images/cards/sacerdote-olho-perdido.png",
    rarity: "R",
    type: "troops",
    element: "Darkus",
    dp: 1,
    ability: "Oferta da Sabedoria Profunda",
    abilityDescription: "Ao entrar em campo, escolha até duas outras Unidades Darkness do seu campo; elas ganham +2 DP.",
    attack: "Olhar que Perfura Destinos",
    category: "Darkness Troops unit",
  },
  {
    id: "guias-do-mjolnir-r",
    name: "Guias do Mjolnir",
    image: "/images/cards/guias-do-mjolnir.png",
    rarity: "R",
    type: "troops",
    element: "Void",
    dp: 1,
    ability: "Chamado do Relâmpago",
    abilityDescription: "Enquanto você controlar outra Unidade, esta unidade recebe +1 DP.",
    attack: "Impacto do Mjölnir",
    category: "Void Troops unit",
  },
  {
    id: "oraculos-de-asgard-r",
    name: "Oráculos de Asgard",
    image: "/images/cards/oraculos-de-asgard.png",
    rarity: "R",
    type: "troops",
    element: "Void",
    dp: 1,
    ability: "Destino Adiado",
    abilityDescription:
      "No início do seu turno, olhe a carta do topo do deck do oponente. Você pode deixá-la lá ou colocá-la no fundo do deck.",
    attack: "Presságio Inevitável",
    category: "Void Troops unit",
  },
  {
    id: "atiradores-runicos-r",
    name: "Atiradores Rúnicos",
    image: "/images/cards/atiradores-runicos.png",
    rarity: "R",
    type: "troops",
    element: "Ventus",
    dp: 1,
    ability: "Mira Preparada",
    abilityDescription: "Se esta unidade não atacar neste turno, ela recebe +1 DP.",
    attack: "Disparo Gravado",
    category: "Ventus Troops unit",
  },
  {
    id: "comandante-de-valhalla-r",
    name: "Comandante de Valhalla",
    image: "/images/cards/comandante-de-valhalla.png",
    rarity: "R",
    type: "troops",
    element: "Haos",
    dp: 1,
    ability: "Bênção dos Caídos",
    abilityDescription: "No início do combate, escolha uma Unidade sua. Ela recebe +1 DP somente nessa fase.",
    attack: "Corte da Glória",
    category: "Light Troops unit",
  },
  {
    id: "corvos-vigia-r",
    name: "Corvos Vigia",
    image: "/images/cards/corvos-vigia.png",
    rarity: "R",
    type: "troops",
    element: "Darkus",
    dp: 1,
    ability: "Olhos de Hugin e Munin",
    abilityDescription:
      "Escolha duas cartas de Unidade do elemento Darkness do seu campo de batalha, elas ganham +1 DP.",
    attack: "Rasgo do Presságio",
    category: "Darkness Troops unit",
  },
  {
    id: "glodrim-slime-nordico-r",
    name: "Glódrim, o Slime Nórdico",
    image: "/images/cards/glodrim-slime-nordico.png",
    rarity: "R",
    type: "troops",
    element: "Fire",
    dp: 1,
    ability: "Calor Persistente",
    abilityDescription:
      "Essa carta não pode ser destruída pelo primeiro ataque que receber em cada turno, e quando ela for destruída, compre uma carta.",
    attack: "Toque de Brasa",
    category: "Fire Troops unit",
  },
]

const ALL_SLEEVES: Sleeve[] = [
  {
    id: "sleeve-anjo-vencedor",
    name: "Anjo Vencedor no Campo de Batalha",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Anjo%20vencedor%20no%20campo%20de%20batalha-1mIlywFgRp0WLSe44yNgnGIsyDRvRx.png",
    description: "O arcanjo de luz triunfa sobre as trevas — proteja seu deck com a forca divina.",
  },
  {
    id: "sleeve-calem-2",
    name: "Calem: Energia Relampago",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/calem_sleeve_2-6ppAxjYajtuwrmuM1veQDQSYv5BZfh.png",
    description: "Calem carregado de energia eletrica, pronto para dominar qualquer duelo.",
  },
  {
    id: "sleeve-arthur-3",
    name: "Arthur: Pose Misterio",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/arthur_sleeve_3-GbLMVycvunxWvnMBp4OBzstftEmllk.jpg",
    description: "Arthur relaxado e confiante, com sua aura violeta caracteristica.",
  },
  {
    id: "sleeve-arthur-1",
    name: "Arthur: Vulto das Sombras",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/arthur_sleeve_1-lKFk4H0VNekCZQH1Vv2C9verWDfIi4.png",
    description: "Arthur desencadeia um turbilhao de energia purpura — o poder das sombras em cada carta.",
  },
  {
    id: "sleeve-fehnon-1",
    name: "Fehnon: Lamina Azul",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fehnon_sleeve_1-EAaVhr0pKB7Zcxhq1uc7JgvKR3OycY.png",
    description: "Fehnon em postura de batalha, com raios azuis e fundo rosa energetico.",
  },
  {
    id: "sleeve-morgana-2",
    name: "Morgana e Fehnon: Dueto",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/morgana_sleeve_2-8IsYSKP4HRhoK255Fo7NIdZdTfnMJM.png",
    description: "Morgana e Fehnon lado a lado — a musica e a batalha em perfeita harmonia.",
  },
]

const ALL_PLAYMATS: Playmat[] = [
  {
    id: "playmat-hrotti-water",
    name: "Hrotti: Furia Aquatica",
    image: "/images/playmats/hrotti-water.png",
    description: "O poder das aguas ancestrais flui atraves deste tapete mistico.",
  },
  {
    id: "playmat-logi-fire",
    name: "Logi: Chamas Eternas",
    image: "/images/playmats/logi-fire.png",
    description: "O fogo primordial arde eternamente neste tapete lendario.",
  },
  {
    id: "playmat-tsubasa-lr",
    name: "Tsubasa LR",
    image: "/images/playmats/tsubasa_lr_playmat.png",
    description: "O espírito do cavalo celestial galopa ao lado de Tsubasa neste tapete lendário.",
  },
  {
    id: "playmat-uller-isgrimm-lr",
    name: "Uller e Isgrimm LR",
    image: "/images/playmats/uller_e_isgrimm_lr_playmat.png",
    description: "A dupla lendária de Uller e Isgrimm em sua forma suprema.",
  },
  {
    id: "playmat-uller-isgrimm",
    name: "Uller e Isgrimm",
    image: "/images/playmats/uller_e_isgrimm_playmat.png",
    description: "Uller e seu fiel companheiro Isgrimm unidos pelo vento.",
  },
  {
    id: "playmat-morgana",
    name: "Morgana: Riff Sombrio",
    image: "/images/playmats/morgana_playmat.png",
    description: "A melodia de Morgana ecoa em ondas de energia purpura por todo o campo.",
  },
  {
    id: "playmat-fehnon",
    name: "Fehnon: Lamina Azul",
    image: "/images/playmats/fehnon_playmat.png",
    description: "A lamina gelida de Fehnon corta o campo com correntes de energia azul.",
  },
  {
    id: "playmat-arthur",
    name: "Arthur: Vulto das Sombras",
    image: "/images/playmats/arthur_playmat.png",
    description: "O misterioso Arthur envolve o campo em um turbilhao de sombras violetas.",
  },
  {
    id: "playmat-calem",
    name: "Calem: Luz Celestial",
    image: "/images/playmats/calem_playmat.png",
    description: "Calem e seu guardiao celestial banham o campo em luz divina.",
  },
]

const INITIAL_GIFT_BOXES: GiftBox[] = [
  {
    id: "beta-reward",
    title: "Presente de Beta Tester",
    message: "Obrigado por testar a Beta de Gear Perks!!!",
    cardId: "veu-dos-lacos-cruzados",
    claimed: false,
  },
]

export function GameProvider({ children }: { children: ReactNode }) {
  const [coins, setCoins] = useState(999)
  const [gearCoins, setGearCoins] = useState(500)
  // Fragmentos de evento (Nitrogênio, Irídio, Rubídio, Mercúrio, Hélio, Gálio).
  // Lidos direto do localStorage no primeiro render pra não perder o inventário
  // enquanto o resto do progresso é carregado (nuvem ou local).
  const [fragments, setFragments] = useState<FragmentCounts>(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw =
        localStorage.getItem("gear-perks-fragments") || localStorage.getItem("gearperks-fragments")
      return raw ? normalizeFragmentCounts(JSON.parse(raw)) : {}
    } catch { return {} }
  })
  // Baús — mesma estratégia dos fragmentos: leitura direta do localStorage
  // no primeiro render pra não zerar o inventário durante o load.
  const [chests, setChests] = useState<ChestCounts>(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw = localStorage.getItem("gear-perks-chests")
      return raw ? normalizeChestCounts(JSON.parse(raw)) : {}
    } catch { return {} }
  })
  // Skip Tíquetes — mesma estratégia dos fragmentos: leitura direta do
  // localStorage no primeiro render pra não zerar o item durante o load.
  const [skipTickets, setSkipTickets] = useState<number>(() => {
    if (typeof window === "undefined") return 0
    try {
      const raw =
        localStorage.getItem("gear-perks-skiptickets") || localStorage.getItem("gearperks-skiptickets")
      const n = raw ? Number.parseInt(raw, 10) : 0
      return Number.isFinite(n) && n > 0 ? n : 0
    } catch { return 0 }
  })
  // Garrafas de Energia — mesma estratégia dos Skip Tíquetes.
  const [staminaBottles, setStaminaBottles] = useState<number>(() => {
    if (typeof window === "undefined") return 0
    try {
      const raw =
        localStorage.getItem("gear-perks-staminabottles") || localStorage.getItem("gearperks-staminabottles")
      const n = raw ? Number.parseInt(raw, 10) : 0
      return Number.isFinite(n) && n > 0 ? n : 0
    } catch { return 0 }
  })
  // Livros de XP — mesma estratégia dos fragmentos/baús: leitura direta do
  // localStorage no primeiro render pra não zerar o inventário durante o load.
  const [xpBooks, setXpBooks] = useState<XPBookCounts>(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw = localStorage.getItem("gear-perks-xpbooks")
      return raw ? normalizeXPBookCounts(JSON.parse(raw)) : {}
    } catch { return {} }
  })
  const [collection, setCollection] = useState<Card[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([])
  const [giftBoxes, setGiftBoxes] = useState<GiftBox[]>([
    {
      id: "welcome-gift",
      title: "Obrigado por testar a Beta de Gear Perks!!!",
      message: "Como agradecimento por participar da nossa beta, voce recebe esta carta exclusiva!",
      cardId: "veu-lacos-cruzados",
      claimed: false,
    },
    {
      id: "playmat-gift-water",
      title: "Presente Especial: Playmat Hrotti",
      message: "Desbloqueie o tapete de duelo Hrotti: Furia Aquatica para personalizar seu campo de batalha!",
      playmatId: "playmat-hrotti-water",
      claimed: false,
    },
    {
      id: "playmat-gift-fire",
      title: "Presente Especial: Playmat Logi",
      message: "Desbloqueie o tapete de duelo Logi: Chamas Eternas para personalizar seu campo de batalha!",
      playmatId: "playmat-logi-fire",
      claimed: false,
    },
  ])

  const [playerId, setPlayerId] = useState("")
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>({
    id: "",
    name: "Jogador",
    title: "Novato",
    level: 1,
    showcaseCards: [],
  })
  const [friends, setFriends] = useState<Friend[]>([DEFAULT_GUEST_FRIEND])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [friendPoints, setFriendPoints] = useState(0) // Accumulated (bar)
  const [spendableFP, setSpendableFP] = useState(0) // Spendable in gacha

  // Account Auth State
  const [accountAuth, setAccountAuth] = useState<AccountAuth>({
    isLoggedIn: false,
    email: null,
    uniqueCode: null,
    lastSaved: null,
  })

  const [ownedPlaymats, setOwnedPlaymats] = useState<Playmat[]>([])
  const [globalPlaymatId, setGlobalPlaymatId] = useState<string | null>(null)
  const [ownedSleeves, setOwnedSleeves] = useState<Sleeve[]>([])
  const [globalSleeveId, setGlobalSleeveId] = useState<string | null>(null)
  const [ownedIconIds, setOwnedIconIds] = useState<string[]>([])
  const [redeemedCodes, setRedeemedCodes] = useState<string[]>([])
  const [mobileMode, setMobileModeState] = useState(false)

  // ── STAMINA ───────────────────────────────────────────────────────��────────
  const STAMINA_REGEN_SECS = 5 * 60
  const getMaxStamina = (level: number) => 19 + level

  const [stamina, setStamina] = useState<number>(() => {
    if (typeof window === "undefined") return 20
    try {
      const saved = localStorage.getItem("gpgame_stamina_v2")
      if (!saved) return 20
      const { value, lastSave, level } = JSON.parse(saved)
      const max = 19 + (level ?? 1)
      const secsPassed = Math.floor((Date.now() - lastSave) / 1000)
      const recovered = Math.floor(secsPassed / STAMINA_REGEN_SECS)
      return Math.min(max, (value ?? 20) + recovered)
    } catch { return 20 }
  })

  const [staminaCycleElapsed, setStaminaCycleElapsed] = useState<number>(() => {
    if (typeof window === "undefined") return 0
    try {
      const saved = localStorage.getItem("gpgame_stamina_v2")
      if (!saved) return 0
      const { lastSave } = JSON.parse(saved)
      const secsPassed = Math.floor((Date.now() - lastSave) / 1000)
      return secsPassed % STAMINA_REGEN_SECS
    } catch { return 0 }
  })

  // prevLevelRef MUST be declared before any useEffect (rules of hooks)
  const prevLevelRef = useRef(playerProfile.level)

  // Tick every second for stamina regen
  useEffect(() => {
    const interval = setInterval(() => {
      const max = getMaxStamina(playerProfile.level)
      setStaminaCycleElapsed(prev => {
        const next = prev + 1
        if (next >= STAMINA_REGEN_SECS) {
          setStamina(s => Math.min(max, s + 1))
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [playerProfile.level])

  // Persist stamina
  useEffect(() => {
    try {
      localStorage.setItem("gpgame_stamina_v2", JSON.stringify({
        value: stamina,
        lastSave: Date.now(),
        level: playerProfile.level,
      }))
    } catch {}
  }, [stamina, playerProfile.level])

  // Fill stamina on level up
  useEffect(() => {
    if (playerProfile.level > prevLevelRef.current) {
      setStamina(getMaxStamina(playerProfile.level))
      setStaminaCycleElapsed(0)
    }
    prevLevelRef.current = playerProfile.level
  }, [playerProfile.level])

  const spendStamina = (amount: number): boolean => {
    if (stamina < amount) return false
    setStamina(prev => prev - amount)
    return true
  }

  const refillStamina = () => {
    setStamina(getMaxStamina(playerProfile.level))
    setStaminaCycleElapsed(0)
  }

  // Derived: seconds until next +1 stamina
  const staminaNextTickSeconds = stamina >= getMaxStamina(playerProfile.level)
    ? 0
    : Math.max(0, STAMINA_REGEN_SECS - staminaCycleElapsed)

  // Helper to get localStorage with fallback keys (old format vs new format)
  const getLS = (key: string): string | null => {
    // Try new format first (gear-perks-*), then old format (gearperks-*)
    return localStorage.getItem(`gear-perks-${key}`) || localStorage.getItem(`gearperks-${key}`) || null
  }

  // Key for redeemed codes, scoped per account (prevents codes from one
  // account appearing as "already redeemed" on another account in the same browser)
  const redeemedCodesLSKey = (uniqueCode: string | null | undefined) =>
    `redeemed-codes-${uniqueCode ? uniqueCode.toUpperCase() : "guest"}`

  // Save to localStorage with unified key format
  const setLS = (key: string, value: string) => {
    localStorage.setItem(`gearperks-${key}`, value)
    localStorage.setItem(`gear-perks-${key}`, value) // save to both for compatibility
  }

  // Load saved data from localStorage on mount, and from cloud if logged in
  useEffect(() => {
    const loadData = async () => {
      // 1. Load auth first
      const savedAuth = localStorage.getItem("gear-perks-auth")
      let auth: AccountAuth | null = null
      if (savedAuth) {
        try {
          auth = JSON.parse(savedAuth)
          if (auth) setAccountAuth(auth)
        } catch (e) {
          console.error("Failed to parse auth data")
        }
      }

      // 2. If logged in, try loading progress from cloud using the session token
      let cloudLoaded = false
      if (auth?.isLoggedIn) {
        const savedToken = localStorage.getItem("gear-perks-session-token")
        if (savedToken) {
          try {
            const res = await fetch("/api/account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "load", token: savedToken }),
            })
            const result = await res.json()

            if (result.success && result.progress) {
              // Apply progress payload inline (applyProgressPayload declared later in this component)
              const p = result.progress
              if (p && typeof p === "object") {
                if (typeof p.coins === "number") setCoins(p.coins)
                if (typeof p.gearCoins === "number") setGearCoins(p.gearCoins)
                if (Array.isArray(p.collection)) setCollection(p.collection)
                if (Array.isArray(p.decks)) setDecks(p.decks)
                if (Array.isArray(p.matchHistory)) setMatchHistory(p.matchHistory)
                if (Array.isArray(p.giftBoxes)) setGiftBoxes(p.giftBoxes)
                if (Array.isArray(p.friends)) {
                  const hasGuest = p.friends.some((f: Friend) => f.id === "GUEST-001")
                  setFriends(hasGuest ? p.friends : [DEFAULT_GUEST_FRIEND, ...p.friends])
                }
                if (Array.isArray(p.friendRequests)) setFriendRequests(p.friendRequests)
                if (typeof p.friendPoints === "number") setFriendPoints(p.friendPoints)
                if (typeof p.spendableFP === "number") setSpendableFP(p.spendableFP)
                if (p.playerProfile && typeof p.playerProfile === "object") setPlayerProfile(p.playerProfile)
                if (typeof p.playerId === "string" && p.playerId) {
                  setPlayerId(p.playerId)
                  setLS("playerid", p.playerId)
                  localStorage.setItem("gear-perks-player-id", p.playerId)
                }
                if (Array.isArray(p.ownedPlaymatIds)) {
                  setOwnedPlaymats(ALL_PLAYMATS.filter((pm) => p.ownedPlaymatIds.includes(pm.id)))
                  localStorage.setItem("gearperks_owned_playmats", JSON.stringify(p.ownedPlaymatIds))
                }
                if (typeof p.globalPlaymatId === "string" && p.globalPlaymatId) {
                  setGlobalPlaymatId(p.globalPlaymatId)
                  localStorage.setItem("gearperks_global_playmat", p.globalPlaymatId)
                }
                if (Array.isArray(p.ownedSleeveIds)) {
                  setOwnedSleeves(ALL_SLEEVES.filter((s) => p.ownedSleeveIds.includes(s.id)))
                  localStorage.setItem("gearperks_owned_sleeves", JSON.stringify(p.ownedSleeveIds))
                }
                if (typeof p.globalSleeveId === "string" && p.globalSleeveId) {
                  setGlobalSleeveId(p.globalSleeveId)
                  localStorage.setItem("gearperks_global_sleeve", p.globalSleeveId)
                }
                if (Array.isArray(p.ownedIconIds)) {
                  const ids = p.ownedIconIds.filter((id: unknown) => typeof id === "string")
                  setOwnedIconIds(ids)
                  localStorage.setItem("gearperks_owned_icons", JSON.stringify(ids))
                }
                if (Array.isArray(p.redeemedCodes)) setRedeemedCodes(p.redeemedCodes)
                // Sync to localStorage for offline access
                if (typeof p.coins === "number") setLS("coins", p.coins.toString())
                if (typeof p.gearCoins === "number") setLS("gearcoins", p.gearCoins.toString())
                if (Array.isArray(p.collection)) setLS("collection", JSON.stringify(p.collection))
                if (Array.isArray(p.decks)) setLS("decks", JSON.stringify(p.decks))
                if (Array.isArray(p.matchHistory)) setLS("history", JSON.stringify(p.matchHistory))
                if (p.playerProfile) setLS("profile", JSON.stringify(p.playerProfile))
              }

              // Update auth with any server-side corrections (e.g. email or code)
              const updatedAuth: AccountAuth = {
                isLoggedIn: true,
                email: result.email ?? auth.email,
                uniqueCode: result.code ?? auth.uniqueCode,
                lastSaved: result.lastSaved ?? auth.lastSaved,
              }
              setAccountAuth(updatedAuth)
              localStorage.setItem("gear-perks-auth", JSON.stringify(updatedAuth))

              cloudLoaded = true
            } else if (result.error === "Sessao expirada. Entre novamente.") {
              // Token is invalid — clear auth so user is prompted to log in again
              localStorage.removeItem("gear-perks-session-token")
              localStorage.removeItem("gear-perks-auth")
              setAccountAuth({ isLoggedIn: false, email: null, uniqueCode: null, lastSaved: null })
            }
          } catch (err) {
            console.error("Failed to load from cloud, falling back to localStorage:", err)
          }
        }
      }

      // 3. If not loaded from cloud, load from localStorage
      if (!cloudLoaded) {
        const savedCoins = getLS("coins")
        const savedCollection = getLS("collection")
        const savedDecks = getLS("decks")
        const savedHistory = getLS("history")
        const savedProfile = getLS("profile")

        if (savedCoins) setCoins(Number.parseInt(savedCoins))
        const savedGearCoins = getLS("gearcoins")
        if (savedGearCoins) setGearCoins(Number.parseInt(savedGearCoins))
        if (savedCollection) {
          try { setCollection(JSON.parse(savedCollection)) } catch { }
        }
        if (savedDecks) {
          try { setDecks(JSON.parse(savedDecks)) } catch { }
        }
        if (savedHistory) {
          try { setMatchHistory(JSON.parse(savedHistory)) } catch { }
        }
        if (savedProfile) {
          try { setPlayerProfile(JSON.parse(savedProfile)) } catch { }
        }
      }

      // 4. Load gift boxes (always from localStorage since not in cloud)
      const savedGifts = getLS("giftboxes")
      if (savedGifts) {
        try {
          const parsed = JSON.parse(savedGifts) as GiftBox[]
          const merged = INITIAL_GIFT_BOXES.map((gift) => {
            const saved = parsed.find((p) => p.id === gift.id)
            return saved ? { ...gift, claimed: saved.claimed } : gift
          })
          const newGifts = parsed.filter((p) => !INITIAL_GIFT_BOXES.find((g) => g.id === p.id))
          setGiftBoxes([...merged, ...newGifts])
        } catch { }
      }

      // Player ID
      const savedPlayerId = getLS("playerid") || localStorage.getItem("gear-perks-player-id")
      if (savedPlayerId) {
        setPlayerId(savedPlayerId)
      } else {
        const newId = generatePlayerId()
        setPlayerId(newId)
        setLS("playerid", newId)
      }

      // Friends - ensure GUEST is always present
      const savedFriends = getLS("friends")
      if (savedFriends) {
        try {
          const parsed = JSON.parse(savedFriends) as Friend[]
          const hasGuest = parsed.some((f) => f.id === "GUEST-001")
          if (!hasGuest) {
            setFriends([DEFAULT_GUEST_FRIEND, ...parsed])
          } else {
            setFriends(parsed)
          }
        } catch { }
      }

      const savedRequests = getLS("friendrequests")
      const savedFP = getLS("fp")
      const savedSpendableFP = getLS("spendablefp")
      if (savedRequests) { try { setFriendRequests(JSON.parse(savedRequests)) } catch { } }
      if (savedFP) setFriendPoints(Number.parseInt(savedFP))
      if (savedSpendableFP) setSpendableFP(Number.parseInt(savedSpendableFP))

      // Playmats
      const savedOwnedPlaymats = localStorage.getItem("gearperks_owned_playmats")
      const savedGlobalPlaymat = localStorage.getItem("gearperks_global_playmat")
      if (savedOwnedPlaymats) {
        try {
          const playmatIds = JSON.parse(savedOwnedPlaymats)
          setOwnedPlaymats(ALL_PLAYMATS.filter((p) => playmatIds.includes(p.id)))
        } catch { }
      }
      if (savedGlobalPlaymat) {
        setGlobalPlaymatId(savedGlobalPlaymat)
      }

      // Sleeves
      const savedOwnedSleeves = localStorage.getItem("gearperks_owned_sleeves")
      const savedGlobalSleeve = localStorage.getItem("gearperks_global_sleeve")
      if (savedOwnedSleeves) {
        try {
          const sleeveIds = JSON.parse(savedOwnedSleeves)
          setOwnedSleeves(ALL_SLEEVES.filter((s) => sleeveIds.includes(s.id)))
        } catch { }
      }
      if (savedGlobalSleeve) {
        setGlobalSleeveId(savedGlobalSleeve)
      }

      // Icones de perfil comprados na loja
      const savedOwnedIcons = localStorage.getItem("gearperks_owned_icons")
      if (savedOwnedIcons) {
        try {
          const iconIds = JSON.parse(savedOwnedIcons)
          if (Array.isArray(iconIds)) setOwnedIconIds(iconIds.filter((id: unknown) => typeof id === "string"))
        } catch { }
      }

      // Redeemed codes (scoped per account)
      const codesKey = redeemedCodesLSKey(auth?.isLoggedIn ? auth.uniqueCode : null)
      const savedRedeemedCodes = getLS(codesKey)
      if (savedRedeemedCodes) {
        try { setRedeemedCodes(JSON.parse(savedRedeemedCodes)) } catch { }
      } else {
        // Migrate legacy global key (old bug: codes were shared between all accounts).
        // Assign them to the currently active account and remove the global key
        // so other accounts stop seeing codes they never redeemed.
        const legacyCodes = getLS("redeemed-codes")
        if (legacyCodes) {
          try {
            setRedeemedCodes(JSON.parse(legacyCodes))
            setLS(codesKey, legacyCodes)
          } catch { }
          localStorage.removeItem("gearperks-redeemed-codes")
          localStorage.removeItem("gear-perks-redeemed-codes")
        }
      }

      // Mobile mode
      const savedMobileMode = getLS("mobile-mode")
      if (savedMobileMode === "true") {
        setMobileModeState(true)
      }
    }

    loadData()
  }, [])

  // Save to localStorage when data changes (both key formats for compatibility)
  useEffect(() => {
    setLS("coins", coins.toString())
  }, [coins])

  useEffect(() => {
    setLS("gearcoins", gearCoins.toString())
  }, [gearCoins])

  // ── Duel rewards: gacha coins + gear coins per victory ──────────────────
  // Aceita um preset ("normal" / "pvp") ou valores explícitos (eventos).
  const addFragments = useCallback((gain: FragmentCounts) => {
    const clean = normalizeFragmentCounts(gain)
    if (Object.keys(clean).length === 0) return
    setFragments((prev) => {
      const next: FragmentCounts = { ...prev }
      for (const [id, amount] of Object.entries(clean) as [FragmentId, number][]) {
        next[id] = (next[id] ?? 0) + amount
      }
      return next
    })
  }, [])

  const getFragmentCount = useCallback((id: FragmentId) => fragments[id] ?? 0, [fragments])

  /**
   * Consome fragmentos do inventário de forma atômica: se faltar QUALQUER item
   * do custo, nada é debitado e a função retorna false.
   */
  const spendFragments = useCallback((cost: FragmentCounts) => {
    const clean = normalizeFragmentCounts(cost)
    const entries = Object.entries(clean) as [FragmentId, number][]
    if (entries.length === 0) return true
    for (const [id, amount] of entries) {
      if ((fragments[id] ?? 0) < amount) return false
    }
    setFragments((prev) => {
      const next: FragmentCounts = { ...prev }
      for (const [id, amount] of entries) {
        next[id] = Math.max(0, (next[id] ?? 0) - amount)
      }
      return next
    })
    return true
  }, [fragments])

  // ── Baús ──────────────────────────────────────────────────────────────────
  const addChests = useCallback((gain: ChestCounts) => {
    const clean = normalizeChestCounts(gain)
    if (Object.keys(clean).length === 0) return
    setChests((prev) => {
      const next: ChestCounts = { ...prev }
      for (const [id, amount] of Object.entries(clean) as [ChestId, number][]) {
        next[id] = (next[id] ?? 0) + amount
      }
      return next
    })
  }, [])

  const getChestCount = useCallback((id: ChestId) => chests[id] ?? 0, [chests])

  // ── Skip Tíquetes ──────────────────────────────────────────────────────────���
  const addSkipTickets = useCallback((amount: number) => {
    const gain = Math.floor(amount)
    if (!Number.isFinite(gain) || gain <= 0) return
    setSkipTickets((prev) => prev + gain)
  }, [])

  const consumeSkipTicket = useCallback(() => {
    if (skipTickets <= 0) return false
    setSkipTickets((prev) => Math.max(0, prev - 1))
    return true
  }, [skipTickets])

  // ── Garrafas de Energia ────────────────────────────────────────���─────────────
  const addStaminaBottles = useCallback((amount: number) => {
    const gain = Math.floor(amount)
    if (!Number.isFinite(gain) || gain <= 0) return
    setStaminaBottles((prev) => prev + gain)
  }, [])

  const useStaminaBottle = useCallback(() => {
    const max = getMaxStamina(playerProfile.level)
    const missing = max - stamina
    if (staminaBottles <= 0) return false
    if (missing < STAMINA_BOTTLE_MIN_MISSING) return false
    setStaminaBottles((prev) => Math.max(0, prev - 1))
    setStamina((prev) => Math.min(max, prev + STAMINA_BOTTLE_REFILL_AMOUNT))
    return true
  }, [staminaBottles, stamina, playerProfile.level])

  // ── Livros de XP ─────────────────────────────────────────────────────────────
  const addXPBooks = useCallback((gain: XPBookCounts) => {
    const clean = normalizeXPBookCounts(gain)
    if (Object.keys(clean).length === 0) return
    setXpBooks((prev) => {
      const next: XPBookCounts = { ...prev }
      for (const [id, amount] of Object.entries(clean) as [XPBookId, number][]) {
        next[id] = (next[id] ?? 0) + amount
      }
      return next
    })
  }, [])

  const getXPBookCount = useCallback((id: XPBookId) => xpBooks[id] ?? 0, [xpBooks])

  /**
   * Consome livros do inventário de forma atômica: se faltar QUALQUER item
   * do custo, nada é debitado e a função retorna false.
   */
  const spendXPBooks = useCallback((cost: XPBookCounts) => {
    const clean = normalizeXPBookCounts(cost)
    const entries = Object.entries(clean) as [XPBookId, number][]
    if (entries.length === 0) return true
    for (const [id, amount] of entries) {
      if ((xpBooks[id] ?? 0) < amount) return false
    }
    setXpBooks((prev) => {
      const next: XPBookCounts = { ...prev }
      for (const [id, amount] of entries) {
        next[id] = Math.max(0, (next[id] ?? 0) - amount)
      }
      return next
    })
    return true
  }, [xpBooks])

  /** Rola o drop de Livro de XP ao vencer um duelo do Modo Campanha (História). */
  const rollCampaignXPBook = useCallback(() => {
    const drop = rollCampaignXPBookDrop()
    if (drop) addXPBooks({ [drop.id]: drop.amount })
    return drop
  }, [addXPBooks])

  const addDuelRewards = useCallback((kind: DuelRewardKind) => {
    const { gacha, gear, fragments: drop } =
      typeof kind === "object"
        ? kind
        : kind === "pvp"
          ? { gacha: 20, gear: 50, fragments: undefined }
          : { gacha: 10, gear: 30, fragments: undefined }
    setCoins((prev) => prev + gacha)
    setGearCoins((prev) => prev + gear)
    const fragmentDrop = normalizeFragmentCounts(drop)
    addFragments(fragmentDrop)
    // Todo duelo (História, Treinamento, Eventos ou PvP) dropa 1 baú garantido.
    const chestDrop = rollChestDrop()
    addChests({ [chestDrop]: 1 })
    return { gacha, gear, fragments: fragmentDrop, chest: chestDrop }
  }, [addFragments, addChests])

  useEffect(() => {
    setLS("fragments", JSON.stringify(fragments))
  }, [fragments])

  useEffect(() => {
    localStorage.setItem("gear-perks-chests", JSON.stringify(chests))
  }, [chests])

  useEffect(() => {
    setLS("skiptickets", skipTickets.toString())
  }, [skipTickets])

  useEffect(() => {
    setLS("staminabottles", staminaBottles.toString())
  }, [staminaBottles])

  useEffect(() => {
    localStorage.setItem("gear-perks-xpbooks", JSON.stringify(xpBooks))
  }, [xpBooks])

  useEffect(() => {
    setLS("collection", JSON.stringify(collection))
  }, [collection])

  useEffect(() => {
    setLS("decks", JSON.stringify(decks))
  }, [decks])

  useEffect(() => {
    setLS("history", JSON.stringify(matchHistory))
  }, [matchHistory])

  useEffect(() => {
    setLS("giftboxes", JSON.stringify(giftBoxes))
  }, [giftBoxes])

  useEffect(() => {
    if (playerId) setLS("playerid", playerId)
  }, [playerId])

  useEffect(() => {
    setLS("profile", JSON.stringify(playerProfile))
  }, [playerProfile])

  useEffect(() => {
    setLS("friends", JSON.stringify(friends))
  }, [friends])

  useEffect(() => {
    setLS("friendrequests", JSON.stringify(friendRequests))
  }, [friendRequests])

  useEffect(() => {
    setLS("fp", friendPoints.toString())
  }, [friendPoints])

  useEffect(() => {
    setLS("spendablefp", spendableFP.toString())
  }, [spendableFP])

  // useEffect(() => {
  //   localStorage.setItem("gearperks-accountAuth", JSON.stringify(accountAuth)) // Replaced by gear-perks-auth
  //   if (accountAuth.isLoggedIn) {
  //     setAccountAuth((prev) => ({ ...prev, lastSaved: new Date().toISOString() }))
  //   }
  // }, [accountAuth])

  // Save account auth state to localStorage
  useEffect(() => {
    localStorage.setItem("gear-perks-auth", JSON.stringify(accountAuth))
    localStorage.setItem("gearperks-accountAuth", JSON.stringify(accountAuth))
  }, [accountAuth])

  useEffect(() => {
    localStorage.setItem("gearperks_owned_playmats", JSON.stringify(ownedPlaymats.map((p) => p.id)))
  }, [ownedPlaymats])

  useEffect(() => {
    if (globalPlaymatId) {
      localStorage.setItem("gearperks_global_playmat", globalPlaymatId)
    } else {
      localStorage.removeItem("gearperks_global_playmat")
    }
  }, [globalPlaymatId])

  useEffect(() => {
    localStorage.setItem("gearperks_owned_sleeves", JSON.stringify(ownedSleeves.map((s) => s.id)))
  }, [ownedSleeves])

  useEffect(() => {
    localStorage.setItem("gearperks_owned_icons", JSON.stringify(ownedIconIds))
  }, [ownedIconIds])

  useEffect(() => {
    if (globalSleeveId) {
      localStorage.setItem("gearperks_global_sleeve", globalSleeveId)
    } else {
      localStorage.removeItem("gearperks_global_sleeve")
    }
  }, [globalSleeveId])

  const addToCollection = (cards: Card[]) => {
    setCollection((prev) => [...prev, ...cards])
  }

  /**
   * Abre um baú: consome 1 unidade e credita SOMENTE fragmentos, do tipo
   * pareado com a cor do baú (ver lib/chests.ts). Nunca entrega moedas
   * ou cartas.
   */
  const openChest = useCallback((id: ChestId): ChestOpenResult | null => {
    if ((chests[id] ?? 0) <= 0) return null

    const result = rollChestReward(id)

    setChests((prev) => {
      const next: ChestCounts = { ...prev }
      next[id] = Math.max(0, (next[id] ?? 0) - 1)
      if (next[id] === 0) delete next[id]
      return next
    })

    addFragments({ [result.fragmentId]: result.amount })

    return result
  }, [chests, addFragments])

  const saveDeck = (deck: Deck) => {
    setDecks((prev) => {
      const existingIndex = prev.findIndex((d) => d.id === deck.id)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = deck
        return updated
      }
      return [...prev, deck]
    })
  }

  const deleteDeck = (deckId: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== deckId))
  }

  const addMatchRecord = (record: MatchRecord) => {
    setMatchHistory((prev) => [record, ...prev])
  }

  const claimGift = (giftId: string): Card | null => {
    const gift = giftBoxes.find((g) => g.id === giftId)
    if (!gift || gift.claimed) return null

    setGiftBoxes((prev) => prev.map((g) => (g.id === giftId ? { ...g, claimed: true } : g)))

    // Handle playmat reward
    if (gift.playmatId) {
      const playmat = ALL_PLAYMATS.find((p) => p.id === gift.playmatId)
      if (playmat && !ownedPlaymats.some((p) => p.id === playmat.id)) {
        setOwnedPlaymats((prev) => [...prev, playmat])
      }
      return null
    }

    // Handle coin reward
    if (gift.coinsReward) {
      setCoins((prev) => prev + gift.coinsReward!)
      return null
    }

    // Handle card reward
    if (gift.cardId) {
      const card = ALL_CARDS.find((c) => c.id === gift.cardId)
      if (card) {
        addToCollection([card])
        return card
      }
    }

    return null
  }

  const addGift = (gift: Omit<GiftBox, "id" | "claimed">) => {
    const newGift: GiftBox = {
      ...gift,
      id: `gift-${Date.now()}`,
      claimed: false,
    }
    setGiftBoxes((prev) => [...prev, newGift])
  }

  const hasUnclaimedGifts = giftBoxes.some((g) => !g.claimed)

  const updatePlayerProfile = (updates: Partial<PlayerProfile>) => {
    setPlayerProfile((prev) => ({ ...prev, ...updates }))
  }

  const sendFriendRequest = (targetId: string): boolean => {
    // In a real app, this would send to server
    // For demo, we simulate finding a player
    if (targetId === playerId) return false
    if (friends.some((f) => f.id === targetId)) return false
    // Simulate a successful request being sent to a server
    return true
  }

  const acceptFriendRequest = (requestId: string) => {
    const request = friendRequests.find((r) => r.id === requestId)
    if (!request) return

    // Add to friends
    const newFriend: Friend = {
      id: request.fromId,
      name: request.fromName,
      avatarUrl: request.fromAvatarUrl,
      level: 1,
      showcaseCards: [],
      affinityLevel: 1,
      affinityPoints: 0,
      isGuest: false,
      likes: 0,
    }
    setFriends((prev) => [...prev, newFriend])

    // Remove request
    setFriendRequests((prev) => prev.filter((r) => r.id !== requestId))
  }

  const rejectFriendRequest = (requestId: string) => {
    setFriendRequests((prev) => prev.filter((r) => r.id !== requestId))
  }

  const canSendHeartTo = (friendId: string): boolean => {
    const friend = friends.find((f) => f.id === friendId)
    if (!friend) return false
    // If it's a guest or they haven't sent a heart, they can receive one
    if (friend.isGuest && friend.id !== "GUEST-001") return true
    if (!friend.lastHeartSent) return true

    const lastSent = new Date(friend.lastHeartSent)
    const today = new Date()
    return lastSent.toDateString() !== today.toDateString()
  }

  const sendHeart = (friendId: string): boolean => {
    if (!canSendHeartTo(friendId)) return false

    // Update friend's affinity
    setFriends((prev) =>
      prev.map((f) => {
        if (f.id === friendId) {
          // For guests, affinity increases by 10 (base) + likes received
          const pointsToAdd = f.isGuest && f.id !== "GUEST-001" ? 10 + f.likes : 10
          const newPoints = f.affinityPoints + pointsToAdd
          const maxPoints = f.affinityLevel * 100
          const levelUp = newPoints >= maxPoints

          return {
            ...f,
            affinityPoints: levelUp ? newPoints - maxPoints : newPoints,
            affinityLevel: levelUp ? f.affinityLevel + 1 : f.affinityLevel,
            lastHeartSent: new Date().toISOString(),
          }
        }
        return f
      }),
    )

    // Add FP (both accumulated and spendable)
    setFriendPoints((prev) => prev + 5)
    setSpendableFP((prev) => prev + 5)

    // Add gift to gift box if it's not a guest
    if (!friends.find((f) => f.id === friendId)?.isGuest || friendId === "GUEST-001") {
      addGift({
        title: "Recompensa por envio de afinidade",
        message: "Você ganhou 5 Friend Points por enviar coração para seu amigo!",
        coinsReward: 5, // Assuming coinsReward is for FP here based on context
      })
    }

    return true
  }

  const sendHeartToAll = (): number => {
    let sentCount = 0
    friends.forEach((friend) => {
      if (canSendHeartTo(friend.id)) {
        if (sendHeart(friend.id)) {
          sentCount++
        }
      }
    })
    return sentCount
  }

  const likeFriendShowcase = (friendId: string) => {
    setFriends((prev) =>
      prev.map((f) => {
        if (f.id === friendId) {
          // Add affinity points based on likes, guests get more
          const pointsToAdd = f.isGuest && f.id !== "GUEST-001" ? 5 + f.likes : 5
          return { ...f, likes: f.likes + 1, affinityPoints: f.affinityPoints + pointsToAdd }
        }
        return f
      }),
    )
    setFriendPoints((prev) => prev + 2)
    setSpendableFP((prev) => prev + 2)
  }

  const spendFriendPoints = (amount: number): boolean => {
    if (spendableFP < amount) return false
    setSpendableFP((prev) => prev - amount)
    return true
  }

  /** Adiciona moedas de forma segura (functional update, sem closure stale) */
  const addCoins = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    setCoins((prev) => prev + amount)
  }

  /** Adiciona Friend Points (acumulados + gastáveis) de forma segura */
  const addFP = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    setFriendPoints((prev) => prev + amount)
    setSpendableFP((prev) => prev + amount)
  }

  const searchPlayerById = (id: string): Friend | null => {
    // In real app, this would query server
    // For demo, return a simulated player
    if (id === playerId) return null
    if (friends.some((f) => f.id === id)) return null

    // Simulate finding a random player
    if (id.startsWith("GP-") && id.length === 11) {
      return {
        id,
        name: `Jogador ${id.slice(-4)}`,
        level: Math.floor(Math.random() * 30) + 1,
        showcaseCards: [],
        affinityLevel: 1,
        affinityPoints: 0,
        isGuest: false,
        likes: 0,
      }
    }
    return null
  }

  const getGhostPlayers = (count: number): Friend[] => {
    const available = GHOST_PLAYERS.slice(0, count)
    return available
  }

  // ---------- Account Auth (nuvem via /api/account) ----------
  const SESSION_TOKEN_KEY = "gear-perks-session-token"

  // Monta o payload de progresso completo para salvar na nuvem
  const buildProgressPayload = () => ({
    coins,
    gearCoins,
    collection,
    decks,
    matchHistory,
    giftBoxes,
    friends,
    friendRequests,
    friendPoints,
    spendableFP,
    playerProfile,
    playerId,
    ownedPlaymatIds: ownedPlaymats.map((p) => p.id),
    globalPlaymatId,
    ownedSleeveIds: ownedSleeves.map((s) => s.id),
    globalSleeveId,
    ownedIconIds,
    redeemedCodes,
  })

  // Aplica um progresso vindo da nuvem em todos os estados do jogo
  const applyProgressPayload = (p: any) => {
    if (!p || typeof p !== "object") return
    if (typeof p.coins === "number") setCoins(p.coins)
    if (typeof p.gearCoins === "number") setGearCoins(p.gearCoins)
    if (Array.isArray(p.collection)) setCollection(p.collection)
    if (Array.isArray(p.decks)) setDecks(p.decks)
    if (Array.isArray(p.matchHistory)) setMatchHistory(p.matchHistory)
    if (Array.isArray(p.giftBoxes)) setGiftBoxes(p.giftBoxes)
    if (Array.isArray(p.friends)) {
      const hasGuest = p.friends.some((f: Friend) => f.id === "GUEST-001")
      setFriends(hasGuest ? p.friends : [DEFAULT_GUEST_FRIEND, ...p.friends])
    }
    if (Array.isArray(p.friendRequests)) setFriendRequests(p.friendRequests)
    if (typeof p.friendPoints === "number") setFriendPoints(p.friendPoints)
    if (typeof p.spendableFP === "number") setSpendableFP(p.spendableFP)
    if (p.playerProfile && typeof p.playerProfile === "object") setPlayerProfile(p.playerProfile)
    if (typeof p.playerId === "string" && p.playerId) {
      setPlayerId(p.playerId)
      setLS("playerid", p.playerId)
      localStorage.setItem("gear-perks-player-id", p.playerId)
    }
    if (Array.isArray(p.ownedPlaymatIds)) {
      setOwnedPlaymats(ALL_PLAYMATS.filter((pm) => p.ownedPlaymatIds.includes(pm.id)))
      localStorage.setItem("gearperks_owned_playmats", JSON.stringify(p.ownedPlaymatIds))
    }
    if (typeof p.globalPlaymatId === "string" && p.globalPlaymatId) {
      setGlobalPlaymatId(p.globalPlaymatId)
      localStorage.setItem("gearperks_global_playmat", p.globalPlaymatId)
    }
    if (Array.isArray(p.ownedSleeveIds)) {
      setOwnedSleeves(ALL_SLEEVES.filter((s) => p.ownedSleeveIds.includes(s.id)))
      localStorage.setItem("gearperks_owned_sleeves", JSON.stringify(p.ownedSleeveIds))
    }
    if (typeof p.globalSleeveId === "string" && p.globalSleeveId) {
      setGlobalSleeveId(p.globalSleeveId)
      localStorage.setItem("gearperks_global_sleeve", p.globalSleeveId)
    }
    if (Array.isArray(p.ownedIconIds)) {
      const ids = p.ownedIconIds.filter((id: unknown) => typeof id === "string")
      setOwnedIconIds(ids)
      localStorage.setItem("gearperks_owned_icons", JSON.stringify(ids))
    }
    if (Array.isArray(p.redeemedCodes)) setRedeemedCodes(p.redeemedCodes)

    // Sincroniza com localStorage para acesso offline
    if (typeof p.coins === "number") setLS("coins", p.coins.toString())
    if (typeof p.gearCoins === "number") setLS("gearcoins", p.gearCoins.toString())
    if (Array.isArray(p.collection)) setLS("collection", JSON.stringify(p.collection))
    if (Array.isArray(p.decks)) setLS("decks", JSON.stringify(p.decks))
    if (Array.isArray(p.matchHistory)) setLS("history", JSON.stringify(p.matchHistory))
    if (p.playerProfile) setLS("profile", JSON.stringify(p.playerProfile))
  }

  // Chamada padrão à API de contas
  const accountApi = async (payload: Record<string, unknown>): Promise<any> => {
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      return await res.json()
    } catch {
      return { success: false, error: "Erro de conexao. Verifique sua internet." }
    }
  }

  const loginAccount = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const result = await accountApi({ action: "login", email, password })
    if (!result.success) {
      return { success: false, error: result.error || "Erro ao entrar. Tente novamente." }
    }

    localStorage.setItem(SESSION_TOKEN_KEY, result.token)
    applyProgressPayload(result.progress)

    const auth: AccountAuth = {
      isLoggedIn: true,
      email: email.trim().toLowerCase(),
      uniqueCode: null,
      lastSaved: result.lastSaved || null,
    }
    setAccountAuth(auth)
    localStorage.setItem("gear-perks-auth", JSON.stringify(auth))

    // Códigos resgatados vêm da nuvem; se não houver, usa os do dispositivo
    if (!Array.isArray(result.progress?.redeemedCodes)) {
      const savedCodes = getLS(redeemedCodesLSKey(null))
      try {
        setRedeemedCodes(savedCodes ? JSON.parse(savedCodes) : [])
      } catch {
        setRedeemedCodes([])
      }
    }

    return { success: true }
  }

  const registerAccount = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!email.includes("@")) {
      return { success: false, error: "Email invalido" }
    }
    if (password.length < 6) {
      return { success: false, error: "Senha deve ter pelo menos 6 caracteres" }
    }

    // Registra na nuvem levando o progresso atual do dispositivo
    const result = await accountApi({
      action: "register",
      email,
      password,
      progress: buildProgressPayload(),
    })
    if (!result.success) {
      return { success: false, error: result.error || "Erro ao criar conta. Tente novamente." }
    }

    localStorage.setItem(SESSION_TOKEN_KEY, result.token)

    const auth: AccountAuth = {
      isLoggedIn: true,
      email: email.trim().toLowerCase(),
      uniqueCode: null,
      lastSaved: result.lastSaved || new Date().toISOString(),
    }
    setAccountAuth(auth)
    localStorage.setItem("gear-perks-auth", JSON.stringify(auth))

    return { success: true }
  }

  // Register with unique code (o código é gerado no servidor)
  const registerWithCode = async (password: string): Promise<{ success: boolean; error?: string; code?: string }> => {
    if (password.length < 6) {
      return { success: false, error: "Senha deve ter pelo menos 6 caracteres" }
    }

    const result = await accountApi({
      action: "register-code",
      password,
      progress: buildProgressPayload(),
    })
    if (!result.success || !result.code) {
      return { success: false, error: result.error || "Erro ao criar conta. Tente novamente." }
    }

    localStorage.setItem(SESSION_TOKEN_KEY, result.token)

    const auth: AccountAuth = {
      isLoggedIn: true,
      email: null,
      uniqueCode: result.code,
      lastSaved: result.lastSaved || new Date().toISOString(),
    }
    setAccountAuth(auth)
    localStorage.setItem("gear-perks-auth", JSON.stringify(auth))

    // Carry over codes redeemed as guest to the new account (progress converts to account)
    setLS(redeemedCodesLSKey(result.code), JSON.stringify(redeemedCodes))

    return { success: true, code: result.code }
  }

  // Login with unique code
  const loginWithCode = async (code: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "")

    const result = await accountApi({ action: "login-code", code: normalizedCode, password })
    if (!result.success) {
      return { success: false, error: result.error || "Erro ao fazer login. Verifique sua conexao." }
    }

    localStorage.setItem(SESSION_TOKEN_KEY, result.token)
    applyProgressPayload(result.progress)

    const auth: AccountAuth = {
      isLoggedIn: true,
      email: null,
      uniqueCode: normalizedCode,
      lastSaved: result.lastSaved || null,
    }
    setAccountAuth(auth)
    localStorage.setItem("gear-perks-auth", JSON.stringify(auth))

    // Códigos resgatados vêm da nuvem; se não houver, usa os salvos neste dispositivo
    if (!Array.isArray(result.progress?.redeemedCodes)) {
      const savedAccountCodes = getLS(redeemedCodesLSKey(normalizedCode))
      try {
        setRedeemedCodes(savedAccountCodes ? JSON.parse(savedAccountCodes) : [])
      } catch {
        setRedeemedCodes([])
      }
    }

    return { success: true }
  }

  // Link email to existing code account
  const linkEmailToCode = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!accountAuth.uniqueCode) {
      return { success: false, error: "Nenhum codigo vinculado" }
    }
    if (!email.includes("@")) {
      return { success: false, error: "Email invalido" }
    }

    // Update auth to include email
    const auth: AccountAuth = {
      ...accountAuth,
      email,
    }
    setAccountAuth(auth)
    localStorage.setItem("gear-perks-auth", JSON.stringify(auth))

    return { success: true }
  }

  const logoutAccount = () => {
    // Clear local storage related to this account's progress before logging out
    // This prevents loading old progress when logging in with a different account or as a guest.
    // However, be careful not to clear general settings if they are stored separately.
    // For simplicity here, we just clear the auth token.
    // In a more robust system, you might have a way to specifically clear or isolate account data.

    // Clear auth tokens
    localStorage.removeItem("gear-perks-auth")
    localStorage.removeItem("gear-perks-session-token")

    // Reset game state to defaults
    setCoins(999)
    setGearCoins(500)
    setCollection([])
    setDecks([])
    setMatchHistory([])
    setGiftBoxes(INITIAL_GIFT_BOXES) // Reset to initial gifts
    setPlayerId(generatePlayerId()) // Generate a new guest ID
    setPlayerProfile({
      id: "",
      name: "Jogador",
      title: "Novato",
      level: 1,
      showcaseCards: [],
    })
    setFriends([DEFAULT_GUEST_FRIEND]) // Reset to default guest friend
    setFriendRequests([])
    setFriendPoints(0)
    setSpendableFP(0)

    setAccountAuth({
      isLoggedIn: false,
      email: null,
      uniqueCode: null,
      lastSaved: null,
    })

    // Reset playmat states on logout
    setOwnedPlaymats([])
    setGlobalPlaymatId(null)
    // Reset sleeve states on logout
    setOwnedSleeves([])
    setGlobalSleeveId(null)
    // Reset owned profile icons on logout
    setOwnedIconIds([])

    // Load guest-scoped redeemed codes (don't keep the previous account's codes)
    const guestCodes = getLS(redeemedCodesLSKey(null))
    try {
      setRedeemedCodes(guestCodes ? JSON.parse(guestCodes) : [])
    } catch {
      setRedeemedCodes([])
    }
  }

  // Ref sempre atualizada com os valores mais recentes — evita closure stale no interval
  const progressRef = useRef({
    coins,
    gearCoins,
    collection,
    decks,
    matchHistory,
    giftBoxes,
    friends,
    friendRequests,
    friendPoints,
    spendableFP,
    playerProfile,
    playerId,
    ownedPlaymats,
    globalPlaymatId,
    ownedSleeves,
    globalSleeveId,
    redeemedCodes,
    accountAuth,
  })
  useEffect(() => {
    progressRef.current = {
      coins,
      gearCoins,
      collection,
      decks,
      matchHistory,
      giftBoxes,
      friends,
      friendRequests,
      friendPoints,
      spendableFP,
      playerProfile,
      playerId,
      ownedPlaymats,
      globalPlaymatId,
      ownedSleeves,
      globalSleeveId,
      redeemedCodes,
      accountAuth,
    }
  })

  // Ref para controlar se ja tem um save em andamento (evita saves paralelos)
  const isSavingRef = useRef(false)
  // Ref para marcar que houve mudanca desde o ultimo save
  const hasPendingSaveRef = useRef(false)

  // Marca que houve mudanca sempre que qualquer estado de progresso mudar
  useEffect(() => {
    if (accountAuth.isLoggedIn) {
      hasPendingSaveRef.current = true
    }
  }, [
    coins,
    gearCoins,
    collection,
    decks,
    matchHistory,
    giftBoxes,
    friends,
    friendRequests,
    friendPoints,
    spendableFP,
    playerProfile,
    playerId,
    ownedPlaymats,
    globalPlaymatId,
    ownedSleeves,
    globalSleeveId,
    redeemedCodes,
    accountAuth.isLoggedIn,
  ])

  const saveProgressManually = async () => {
    const { accountAuth: auth } = progressRef.current
    if (!auth.isLoggedIn) return
    if (isSavingRef.current) return

    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (!token) return

    isSavingRef.current = true
    hasPendingSaveRef.current = false

    const { accountAuth: _auth, ownedPlaymats: mats, ownedSleeves: sleeves, ...rest } = progressRef.current
    const payload = { ...rest, ownedPlaymatIds: mats.map((p) => p.id), ownedSleeveIds: sleeves.map((s) => s.id) }

    try {
      const result = await accountApi({
        action: "save",
        token,
        progress: payload,
      })

      if (!result.success) {
        hasPendingSaveRef.current = true // reagenda para proxima tentativa
        return
      }

      const now = result.lastSaved || new Date().toISOString()

      // Sincroniza localStorage
      const cur = progressRef.current
      setLS("coins", cur.coins.toString())
      setLS("gearcoins", cur.gearCoins.toString())
      setLS("collection", JSON.stringify(cur.collection))
      setLS("decks", JSON.stringify(cur.decks))
      setLS("history", JSON.stringify(cur.matchHistory))
      setLS("profile", JSON.stringify(cur.playerProfile))

      setAccountAuth((prev) => {
        const updated = { ...prev, lastSaved: now }
        localStorage.setItem("gear-perks-auth", JSON.stringify(updated))
        return updated
      })
    } finally {
      isSavingRef.current = false
    }
  }

  // Autosave: interval fixo de 60s — so salva se houve mudanca real desde o ultimo save
  useEffect(() => {
    if (!accountAuth.isLoggedIn) return

    const interval = setInterval(() => {
      if (hasPendingSaveRef.current) {
        saveProgressManually()
      }
    }, 60_000)

    return () => clearInterval(interval)
  }, [accountAuth.isLoggedIn])

  // Salva imediatamente ao fechar/sair da aba se houver mudancas pendentes
  useEffect(() => {
    if (!accountAuth.isLoggedIn) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && hasPendingSaveRef.current) {
        const token = localStorage.getItem(SESSION_TOKEN_KEY)
        if (!token) return
        const { accountAuth: _auth, ownedPlaymats: mats, ownedSleeves: sleeves, ...rest } = progressRef.current
        const payload = { ...rest, ownedPlaymatIds: mats.map((p) => p.id), ownedSleeveIds: sleeves.map((s) => s.id) }
        // sendBeacon é fire-and-forget: funciona mesmo enquanto a aba esta fechando
        navigator.sendBeacon(
          "/api/account",
          JSON.stringify({ action: "save", token, progress: payload })
        )
        hasPendingSaveRef.current = false
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [accountAuth.isLoggedIn])

  const setGlobalPlaymat = (playmatId: string | null) => {
    setGlobalPlaymatId(playmatId)
  }

  const setGlobalSleeve = (sleeveId: string | null) => {
    setGlobalSleeveId(sleeveId)
  }

  // Unlocks a sleeve directly into the player's account (used by shop purchases)
  const unlockSleeve = (sleeveId: string): boolean => {
    const sleeve = ALL_SLEEVES.find((s) => s.id === sleeveId)
    if (!sleeve) return false
    if (ownedSleeves.some((s) => s.id === sleeveId)) return false
    const updated = [...ownedSleeves, sleeve]
    setOwnedSleeves(updated)
    localStorage.setItem("gearperks_owned_sleeves", JSON.stringify(updated.map((s) => s.id)))
    return true
  }

  // ── ICONES DE PERFIL (avatares) ──────────────────────────────────────────
  const ownsProfileIcon = (iconId: string): boolean => ownedIconIds.includes(iconId)

  /** Libera um icone da loja na conta do jogador (usado nas compras). */
  const unlockProfileIcon = (iconId: string): boolean => {
    const icon = SHOP_PROFILE_ICONS.find((i) => i.id === iconId)
    if (!icon) return false
    if (ownedIconIds.includes(iconId)) return false
    const updated = [...ownedIconIds, iconId]
    setOwnedIconIds(updated)
    localStorage.setItem("gearperks_owned_icons", JSON.stringify(updated))
    return true
  }

  /** Equipa um icone (gratuito ou comprado) como avatar do perfil. */
  const equipProfileIcon = (iconId: string): boolean => {
    const free = PROFILE_ICONS.find((i) => i.id === iconId)
    if (free) {
      setPlayerProfile((prev) => ({ ...prev, avatarUrl: free.image }))
      return true
    }
    const shopIcon = SHOP_PROFILE_ICONS.find((i) => i.id === iconId)
    if (!shopIcon || !ownedIconIds.includes(iconId)) return false
    setPlayerProfile((prev) => ({ ...prev, avatarUrl: shopIcon.image }))
    return true
  }

  /** Gratuitos + comprados, na ordem em que aparecem nos seletores. */
  const availableProfileIcons = [
    ...PROFILE_ICONS.map((i) => ({ id: i.id, name: i.name, image: i.image })),
    ...SHOP_PROFILE_ICONS.filter((i) => ownedIconIds.includes(i.id)).map((i) => ({
      id: i.id,
      name: i.name,
      image: i.image,
    })),
  ]

  // Returns the active card back image: active sleeve image or default card-back
  const getActiveCardBack = (): string => {
    if (globalSleeveId) {
      const sleeve = ownedSleeves.find((s) => s.id === globalSleeveId)
      if (sleeve) return sleeve.image
    }
    return CARD_BACK_IMAGE
  }

  // Unlocks a playmat directly into the player's account (used by shop purchases)
  const unlockPlaymat = (playmatId: string): boolean => {
    const playmat = ALL_PLAYMATS.find((p) => p.id === playmatId)
    if (!playmat) return false
    if (ownedPlaymats.some((p) => p.id === playmatId)) return false
    const updated = [...ownedPlaymats, playmat]
    setOwnedPlaymats(updated)
    localStorage.setItem("gearperks_owned_playmats", JSON.stringify(updated.map((p) => p.id)))
    return true
  }

  const getPlaymatForDeck = (deck: Deck): Playmat | null => {
    // If deck uses global playmat or has no specific setting
    if (deck.useGlobalPlaymat !== false && globalPlaymatId) {
      return ownedPlaymats.find((p) => p.id === globalPlaymatId) || null
    }
    // If deck has specific playmat
    if (deck.playmatId) {
      return ownedPlaymats.find((p) => p.id === deck.playmatId) || null
    }
    // Fallback to global
    if (globalPlaymatId) {
      return ownedPlaymats.find((p) => p.id === globalPlaymatId) || null
    }
    return null
  }

  // Redeem promotional codes
  const redeemCode = (code: string): { success: boolean; message: string } => {
    const normalizedCode = code.toUpperCase().trim()

    // Check if code was already redeemed
    if (redeemedCodes.includes(normalizedCode)) {
      return { success: false, message: "Este codigo ja foi resgatado!" }
    }

    // ALLCARDS - Unlocks all cards with 4 copies each
    if (normalizedCode === "ALLCARDS") {
      // Get all cards with 4 copies each
      const allCardsWithCopies: Card[] = []
      ALL_CARDS.forEach((card) => {
        for (let i = 0; i < 4; i++) {
          allCardsWithCopies.push({ ...card })
        }
      })

      // Add to collection and persist immediately
      setCollection(allCardsWithCopies)
      setLS("collection", JSON.stringify(allCardsWithCopies))

      // Mark code as redeemed and persist immediately (scoped per account)
      const newRedeemedCodes = [...redeemedCodes, normalizedCode]
      setRedeemedCodes(newRedeemedCodes)
      setLS(redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null), JSON.stringify(newRedeemedCodes))

      return { success: true, message: `Todas as ${ALL_CARDS.length} cartas foram desbloqueadas com 4 copias cada!` }
    }

    // PLAYMAT - Unlocks all playmats
    if (normalizedCode === "PLAYMAT") {
      const newOwnedPlaymats = ALL_PLAYMATS.filter(
        (p) => !ownedPlaymats.some((op) => op.id === p.id)
      )
      const updatedPlaymats = [...ownedPlaymats, ...newOwnedPlaymats]
      setOwnedPlaymats(updatedPlaymats)
      localStorage.setItem("gearperks_owned_playmats", JSON.stringify(updatedPlaymats.map((p) => p.id)))

      const newRedeemedCodes = [...redeemedCodes, normalizedCode]
      setRedeemedCodes(newRedeemedCodes)
      setLS(redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null), JSON.stringify(newRedeemedCodes))

      return { success: true, message: `Todos os ${ALL_PLAYMATS.length} playmats foram desbloqueados!` }
    }

    // SLEEVES - Unlocks every sleeve that exists at the moment the code is redeemed
    if (normalizedCode === "SLEEVES") {
      const newOwnedSleeves = ALL_SLEEVES.filter(
        (s) => !ownedSleeves.some((os) => os.id === s.id)
      )
      const updatedSleeves = [...ownedSleeves, ...newOwnedSleeves]
      setOwnedSleeves(updatedSleeves)
      localStorage.setItem("gearperks_owned_sleeves", JSON.stringify(updatedSleeves.map((s) => s.id)))

      const newRedeemedCodes = [...redeemedCodes, normalizedCode]
      setRedeemedCodes(newRedeemedCodes)
      setLS(redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null), JSON.stringify(newRedeemedCodes))

      return { success: true, message: `Todos os ${ALL_SLEEVES.length} sleeves foram desbloqueados!` }
    }

    // ICONS - Unlocks every profile icon that exists at the moment the code is redeemed
    if (normalizedCode === "ICONS") {
      const newOwnedIconIds = SHOP_PROFILE_ICONS.filter(
        (i) => !ownedIconIds.includes(i.id)
      ).map((i) => i.id)
      const updatedIconIds = [...ownedIconIds, ...newOwnedIconIds]
      setOwnedIconIds(updatedIconIds)
      localStorage.setItem("gearperks_owned_icons", JSON.stringify(updatedIconIds))

      const newRedeemedCodes = [...redeemedCodes, normalizedCode]
      setRedeemedCodes(newRedeemedCodes)
      setLS(redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null), JSON.stringify(newRedeemedCodes))

      return { success: true, message: `Todos os ${SHOP_PROFILE_ICONS.length} ícones foram desbloqueados!` }
    }

    // PASS - Grants the maximum Gear Pass XP, reaching the max Gear Pass level
    if (normalizedCode === "PASS") {
      const GEAR_PASS_MAX_LEVEL = 100
      // Σ(i=1..N) of (20 + 5i) = 20N + 5·N·(N+1)/2 — mesma fórmula usada na tela do Gear Pass
      const maxPoints = 20 * GEAR_PASS_MAX_LEVEL + Math.round((5 * GEAR_PASS_MAX_LEVEL * (GEAR_PASS_MAX_LEVEL + 1)) / 2)

      const LS_PASS_KEY = "gpgame_gear_pass"
      let stored: Record<string, any> = {}
      try {
        stored = JSON.parse(localStorage.getItem(LS_PASS_KEY) || "{}")
      } catch {}

      const updatedPassData = {
        currentPoints: maxPoints,
        currentLevel: GEAR_PASS_MAX_LEVEL,
        hasPremium: stored.hasPremium ?? false,
        claimedCommon: stored.claimedCommon ?? [],
        claimedPremium: stored.claimedPremium ?? [],
        seasonStartedAt: stored.seasonStartedAt ?? Date.now(),
        seasonNumber: stored.seasonNumber ?? 1,
      }
      localStorage.setItem(LS_PASS_KEY, JSON.stringify(updatedPassData))

      const newRedeemedCodes = [...redeemedCodes, normalizedCode]
      setRedeemedCodes(newRedeemedCodes)
      setLS(redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null), JSON.stringify(newRedeemedCodes))

      return { success: true, message: `Nível máximo do Gear Pass (nível ${GEAR_PASS_MAX_LEVEL}) alcançado!` }
    }

    // EXP - Leva todos os Mestres que o jogador possui ao nível máximo
    if (normalizedCode === "EXP") {
      const masters = loadMastersFromStorage()
      const maxedMasters = masters.map((m) => {
        if (!m.isUnlocked) return m
        return {
          ...m,
          currentLevel: m.maxLevel,
          currentXP: 0,
          xpToNext: xpRequiredForLevel(m.maxLevel),
          totalXP: Math.max(m.totalXP, cumulativeXPForLevel(m.maxLevel)),
        }
      })
      saveMastersToStorage(maxedMasters)
      // Reaproveita o evento usado por grantMasterDuelXP para que a tela de
      // Mestres recarregue os dados sem disparar a celebração de level up.
      window.dispatchEvent(new CustomEvent("gpgame_master_xp", { detail: { leveledUp: false } }))

      const newRedeemedCodes = [...redeemedCodes, normalizedCode]
      setRedeemedCodes(newRedeemedCodes)
      setLS(redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null), JSON.stringify(newRedeemedCodes))

      return { success: true, message: "Todos os seus Mestres alcançaram o nível máximo!" }
    }

    // GOLD - Grants 1,000,000 gear coins to the player's account
    if (normalizedCode === "GOLD") {
      setGearCoins((prev) => prev + 1_000_000)

      const newRedeemedCodes = [...redeemedCodes, normalizedCode]
      setRedeemedCodes(newRedeemedCodes)
      setLS(redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null), JSON.stringify(newRedeemedCodes))

      return { success: true, message: "1.000.000 gear coins foram adicionados à sua conta!" }
    }

    // SKINS - Unlocks all card skins
    if (normalizedCode === "SKINS") {
      // As skins de carta ficam apenas no localStorage (gpgame_card_skins) e sao
      // consumidas pela loja, deck-builder e duel-screen. Ids precisam casar com
      // CARD_SKIN_SHOP_ITEMS (shop-screen.tsx) / CARD_SKINS (deck-builder-screen.tsx).
      const ALL_CARD_SKIN_IDS = ["fehnon_skin_pixel", "calem_skin_pixel", "morgana_skin_pixel"]
      try {
        const raw = localStorage.getItem("gpgame_card_skins") ?? "[]"
        const owned: string[] = JSON.parse(raw)
        const merged = Array.from(new Set([...owned, ...ALL_CARD_SKIN_IDS]))
        localStorage.setItem("gpgame_card_skins", JSON.stringify(merged))
        ALL_CARD_SKIN_IDS.forEach((skinId) => {
          window.dispatchEvent(new CustomEvent("gpgame_skin_unlocked", { detail: { skinId } }))
        })
      } catch {}

      const newRedeemedCodes = [...redeemedCodes, normalizedCode]
      setRedeemedCodes(newRedeemedCodes)
      setLS(redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null), JSON.stringify(newRedeemedCodes))

      return { success: true, message: `Todas as ${ALL_CARD_SKIN_IDS.length} skins de carta foram desbloqueadas!` }
    }

    // FRAG - Grants 10,000 fragments of every type
    if (normalizedCode === "FRAG") {
      const allFragmentIds = Object.keys(FRAGMENTS) as FragmentId[]
      const gain: FragmentCounts = {}
      allFragmentIds.forEach((id) => {
        gain[id] = 10_000
      })
      addFragments(gain)

      const newRedeemedCodes = [...redeemedCodes, normalizedCode]
      setRedeemedCodes(newRedeemedCodes)
      setLS(redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null), JSON.stringify(newRedeemedCodes))

      return { success: true, message: `10.000 fragmentos de todos os ${allFragmentIds.length} tipos foram adicionados à sua conta!` }
    }

    // Invalid code
    return { success: false, message: "Codigo invalido!" }
  }

  // Delete all account data but keep logged in
  const deleteAccountData = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Reset all game data to defaults
      setCoins(999)
      setGearCoins(500)
      setCollection([])
      setDecks([])
      setMatchHistory([])
      setGiftBoxes(INITIAL_GIFT_BOXES)
      setFriends([DEFAULT_GUEST_FRIEND])
      setFriendRequests([])
      setFriendPoints(0)
      setSpendableFP(0)
      setOwnedPlaymats([])
      setGlobalPlaymatId(null)
      setRedeemedCodes([])
      setPlayerProfile({
        id: playerId,
        name: "Jogador",
        title: "Iniciante",
        level: 1,
        showcaseCards: [],
        hasCompletedSetup: false,
      })

      // Clear localStorage data — ALL keys including Masters, Story, Missions, Gear Pass
      localStorage.removeItem("gearperks-coins")
      localStorage.removeItem("gearperks-collection")
      localStorage.removeItem("gearperks-decks")
      localStorage.removeItem("gearperks-history")
      localStorage.removeItem("gearperks-giftboxes")
      localStorage.removeItem("gearperks-profile")
      localStorage.removeItem("gearperks-friends")
      localStorage.removeItem("gearperks-friend-requests")
      localStorage.removeItem("gearperks-friend-points")
      localStorage.removeItem("gearperks-spendable-fp")
      localStorage.removeItem("gearperks_owned_playmats")
      localStorage.removeItem("gearperks_global_playmat")
    localStorage.removeItem("gearperks_owned_sleeves")
    localStorage.removeItem("gearperks_global_sleeve")
    localStorage.removeItem("gearperks_owned_icons")
      localStorage.removeItem("gearperks-redeemed-codes")
      localStorage.removeItem("gear-perks-redeemed-codes")
      const currentCodesKey = redeemedCodesLSKey(accountAuth.isLoggedIn ? accountAuth.uniqueCode : null)
      localStorage.removeItem(`gearperks-${currentCodesKey}`)
      localStorage.removeItem(`gear-perks-${currentCodesKey}`)
      localStorage.removeItem("gpgame_selected_wallpaper")
      localStorage.removeItem("gpgame_unlocked_wallpapers")

      // ── Masters system ────────────────��────────────────────────────────────
      localStorage.removeItem("gpgame_masters_v1")

      // ── Story Mode (Campanha) ─────────────────────────────────────────���────
      localStorage.removeItem("gpgame_story_progress")
      localStorage.removeItem("gpgame_story_battle_pending")

      // ── Eventos (progresso + fragmentos) ──────────────────────────────────
      localStorage.removeItem("gpgame_event_progress")
      localStorage.removeItem("gpgame_event_battle_pending")
      localStorage.removeItem("gearperks-fragments")
      localStorage.removeItem("gear-perks-fragments")
      setFragments({})

      // ── Gear Pass ─────────────────────────────────────────────────────────
      localStorage.removeItem("gpgame_gear_pass")
      localStorage.removeItem("gpgame_pass_missions")

      // ── Missions (Missões diárias/eventos) ─────────────────────���──────────
      localStorage.removeItem("claimed_missions")
      localStorage.removeItem("claimed_bonus")
      localStorage.removeItem("missions_event_end")

      // ── Card skins & active skins ─────────────────────────────────────────
      localStorage.removeItem("gpgame_card_skins")
      localStorage.removeItem("gpgame_active_skins")

      // ── Titles & pending packs ──────────────────────────────────────���─────
      localStorage.removeItem("gpgame_titles")
      localStorage.removeItem("gpgame_pending_packs")

    // ── Gacha coins & coins ───────────────────────────────────────────────
    localStorage.removeItem("gpgame_coins")
    localStorage.removeItem("gpgame_gacha_coins")
    localStorage.removeItem("gacha_coins")
    localStorage.removeItem("coins")
    localStorage.removeItem("gearperks-gearcoins")
    localStorage.removeItem("gear-perks-gearcoins")
    localStorage.removeItem("gpgame_menu_prev_gearcoins")
      localStorage.removeItem("gpgame_profile")

      // ── Stamina ───────────────────────────────────────────────────────────
      localStorage.removeItem("gpgame_stamina_v2")

      // ── Guild (local state) ───────────────────────────────────────────────
      localStorage.removeItem("gpgame_guild_id")
      localStorage.removeItem("gpgame_kicked_from")

      // ── Daily check-in & misc ���────────────────────────────────────────────
      localStorage.removeItem("gpgame_checkin")
      localStorage.removeItem("gpgame_last_checkin")

      // If logged in, also wipe cloud progress via the account API
      if (accountAuth.isLoggedIn) {
        const token = localStorage.getItem("gear-perks-session-token")
        if (token) {
          try {
            await fetch("/api/account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "save", token, progress: null }),
            })
          } catch (err) {
            console.error("Error clearing cloud data:", err)
          }
        }
        localStorage.removeItem("gear-perks-session-token")
        localStorage.removeItem("gear-perks-auth")
      }
      setAccountAuth({ isLoggedIn: false, email: null, uniqueCode: null, lastSaved: null })

      return { success: true }
    } catch (err) {
      console.error("Error deleting account data:", err)
      return { success: false, error: "Erro ao deletar dados da conta" }
    }
  }

  return (
    <GameContext.Provider
      value={{
        coins,
        setCoins,
        addCoins,
        addFP,
        gearCoins,
        setGearCoins,
        addDuelRewards,
        fragments,
        addFragments,
        getFragmentCount,
        spendFragments,
        chests,
        addChests,
        getChestCount,
        openChest,
    skipTickets,
    addSkipTickets,
    consumeSkipTicket,
    staminaBottles,
    addStaminaBottles,
    useStaminaBottle,
    xpBooks,
    addXPBooks,
    getXPBookCount,
    spendXPBooks,
    rollCampaignXPBook,
        collection,
        addToCollection,
        decks,
        saveDeck,
        deleteDeck,
        matchHistory,
        addMatchRecord,
        allCards: ALL_CARDS,
        giftBoxes,
        claimGift,
        addGift,
        hasUnclaimedGifts,
        playerId,
        playerProfile,
        updatePlayerProfile,
        friends,
        friendRequests,
        friendPoints,
        spendableFP,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        sendHeart,
        sendHeartToAll,
        likeFriendShowcase,
        spendFriendPoints,
        searchPlayerById,
        getGhostPlayers,
        canSendHeartTo,
        // Account Auth
        accountAuth,
        loginAccount,
        registerAccount,
        loginWithCode,
        registerWithCode,
        linkEmailToCode,
        logoutAccount,
        saveProgressManually,
        // Added playmat-related values
        allPlaymats: ALL_PLAYMATS,
        ownedPlaymats,
        globalPlaymatId,
        setGlobalPlaymat,
        getPlaymatForDeck,
        unlockPlaymat,
        // Sleeve-related values
        allSleeves: ALL_SLEEVES,
        ownedSleeves,
        globalSleeveId,
        setGlobalSleeve,
        unlockSleeve,
        // Profile icon values
        shopProfileIcons: SHOP_PROFILE_ICONS,
        ownedIconIds,
        ownsProfileIcon,
        unlockProfileIcon,
        equipProfileIcon,
        availableProfileIcons,
        getActiveCardBack,
        // Code redemption
        redeemCode,
        redeemedCodes,
        deleteAccountData,
        mobileMode,
        setMobileMode: (enabled: boolean) => {
          setMobileModeState(enabled)
          if (typeof window !== "undefined") {
            localStorage.setItem("gearperks-mobile-mode", enabled ? "true" : "false")
            localStorage.setItem("gear-perks-mobile-mode", enabled ? "true" : "false")
          }
        },
        stamina,
        maxStamina: getMaxStamina(playerProfile.level),
        spendStamina,
        refillStamina,
        staminaNextTickSeconds,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error("useGame must be used within GameProvider")
  }
  return context
}
