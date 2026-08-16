// ─── masters-data.ts ──────────────────────────────────────────────────────────

import { CHESTS, type ChestId } from "./chests"

export type MasterElement = "Aquos" | "Darkus" | "Ventus" | "Pyrus" | "Haos" | "Subterra" | "Vazio"
export type MasterRarity  = "R" | "SR" | "UR" | "LR"

/**
 * Casa o elemento do Mestre com o Baú temático correspondente.
 * Toda recompensa do tipo "chest" na trilha de um Mestre entrega o baú
 * do PRÓPRIO elemento dele — ex.: Fehnon (Aquos) → Baú de Aquos,
 * Calem (Vazio) → Baú do Vazio, Morgana (Darkus) → Baú das Trevas.
 */
export function elementToChestId(element: MasterElement): ChestId {
  switch (element) {
    case "Aquos":    return "aquos"
    case "Darkus":   return "darkness"
    case "Ventus":   return "ventus"
    case "Pyrus":    return "fire"
    case "Haos":     return "lightness"
    case "Vazio":    return "void"
    case "Subterra": return "void" // sem baú dedicado ainda — fallback neutro
    default:         return "void"
  }
}

export interface MasterReward {
  level:       number
  type:        "gear_coins" | "pack" | "gacha_coins" | "card_skin" | "chest" | "skip_ticket" | "stamina_bottle"
  label:       string
  amount?:     number
  packId?:     string  // "common" | "sr_guaranteed" | "lr_guaranteed"
  claimed:     boolean
}

export interface Master {
  id:           string
  name:         string
  fullName:     string
  element:      MasterElement
  rarity:       MasterRarity
  iconPath:     string
  artPath:      string
  bgColor:      string
  accentColor:  string
  description:  string
  quote:        string
  maxLevel:     number
  currentLevel: number
  currentXP:    number
  xpToNext:     number
  totalXP:      number
  rewards:      MasterReward[]
  isActive:     boolean
  isUnlocked:   boolean
}

// ─── XP Table ─────────────────────────────────────────────────────────────────
export function xpRequiredForLevel(level: number): number {
  if (level <= 0)  return 0
  if (level <= 10) return 100 + level * 30
  if (level <= 20) return 400 + (level - 10) * 60
  if (level <= 30) return 1000 + (level - 20) * 100
  if (level <= 40) return 2000 + (level - 30) * 150
  return 3500 + (level - 40) * 200
}

export function xpForNextLevel(level: number): number {
  return xpRequiredForLevel(level)
}

// ─── Reward table ─────────────────────────────────────────────────────────────
// Gear Coins (moeda comum) | Gacha Coins | Packs | Baús | Skip Tíquetes |
// Garrafas de Stamina | Skins de Carta (Lv40/50)
function buildRewards(): MasterReward[] {
  const table: Omit<MasterReward, "claimed">[] = [
    { level:  1, type:"gear_coins",     label:"50 Gear Coins",            amount:50 },
    { level:  2, type:"pack",           label:"1 Pack Comum",             packId:"common" },
    { level:  3, type:"gacha_coins",    label:"10 Gacha Coins",           amount:10 },
    { level:  4, type:"gear_coins",     label:"80 Gear Coins",            amount:80 },
    { level:  5, type:"pack",           label:"Pack SR Garantido",        packId:"sr_guaranteed" },
    { level:  6, type:"gacha_coins",    label:"20 Gacha Coins",           amount:20 },
    { level:  7, type:"gear_coins",     label:"120 Gear Coins",           amount:120 },
    { level:  8, type:"pack",           label:"1 Pack Comum",             packId:"common" },
    { level:  9, type:"gacha_coins",    label:"30 Gacha Coins",           amount:30 },
    { level: 10, type:"gear_coins",     label:"200 Gear Coins",           amount:200 },
    { level: 11, type:"gear_coins",     label:"150 Gear Coins",           amount:150 },
    { level: 12, type:"gacha_coins",    label:"40 Gacha Coins",           amount:40 },
    { level: 13, type:"gear_coins",     label:"180 Gear Coins",           amount:180 },
    { level: 14, type:"pack",           label:"Pack SR Garantido",        packId:"sr_guaranteed" },
    { level: 15, type:"gear_coins",     label:"250 Gear Coins",           amount:250 },
    { level: 16, type:"gacha_coins",    label:"60 Gacha Coins",           amount:60 },
    { level: 17, type:"gear_coins",     label:"220 Gear Coins",           amount:220 },
    { level: 18, type:"pack",           label:"1 Pack Comum",             packId:"common" },
    { level: 19, type:"gacha_coins",    label:"80 Gacha Coins",           amount:80 },
    { level: 20, type:"pack",           label:"Pack LR Garantido",        packId:"lr_guaranteed" },
    { level: 21, type:"gear_coins",     label:"300 Gear Coins",           amount:300 },
    { level: 22, type:"gacha_coins",    label:"100 Gacha Coins",          amount:100 },
    { level: 23, type:"pack",           label:"Pack SR Garantido",        packId:"sr_guaranteed" },
    { level: 24, type:"gear_coins",     label:"350 Gear Coins",           amount:350 },
    { level: 25, type:"stamina_bottle", label:"3 Garrafas de Stamina",    amount:3 },
    { level: 26, type:"gacha_coins",    label:"120 Gacha Coins",          amount:120 },
    { level: 27, type:"gear_coins",     label:"400 Gear Coins",           amount:400 },
    { level: 28, type:"pack",           label:"Pack LR Garantido",        packId:"lr_guaranteed" },
    { level: 29, type:"gacha_coins",    label:"150 Gacha Coins",          amount:150 },
    { level: 30, type:"skip_ticket",    label:"3 Skip Tíquetes",          amount:3 },
    { level: 31, type:"gear_coins",     label:"500 Gear Coins",           amount:500 },
    { level: 32, type:"gacha_coins",    label:"180 Gacha Coins",          amount:180 },
    { level: 33, type:"pack",           label:"Pack SR Garantido",        packId:"sr_guaranteed" },
    { level: 34, type:"gear_coins",     label:"600 Gear Coins",           amount:600 },
    { level: 35, type:"chest",          label:"2 Baús Elementais",        amount:2 },
    { level: 36, type:"gacha_coins",    label:"200 Gacha Coins",          amount:200 },
    { level: 37, type:"gear_coins",     label:"700 Gear Coins",           amount:700 },
    { level: 38, type:"pack",           label:"Pack LR Garantido",        packId:"lr_guaranteed" },
    { level: 39, type:"gacha_coins",    label:"250 Gacha Coins",          amount:250 },
    { level: 40, type:"card_skin",      label:"Skin de Carta Exclusiva" },
    { level: 41, type:"gear_coins",     label:"800 Gear Coins",           amount:800 },
    { level: 42, type:"gacha_coins",    label:"300 Gacha Coins",          amount:300 },
    { level: 43, type:"pack",           label:"Pack LR Garantido",        packId:"lr_guaranteed" },
    { level: 44, type:"gear_coins",     label:"900 Gear Coins",           amount:900 },
    { level: 45, type:"gacha_coins",    label:"500 Gacha Coins",          amount:500 },
    { level: 46, type:"pack",           label:"Pack LR Garantido",        packId:"lr_guaranteed" },
    { level: 47, type:"gear_coins",     label:"1000 Gear Coins",          amount:1000 },
    { level: 48, type:"gacha_coins",    label:"600 Gacha Coins",          amount:600 },
    { level: 49, type:"pack",           label:"Pack LR Garantido",        packId:"lr_guaranteed" },
    { level: 50, type:"card_skin",      label:"Skin de Carta Lendária"  },
  ]
  return table.map(r => ({ ...r, claimed: false }))
}

// ─── Master definitions ────────────────────────────────────────────────────────
export const MASTERS_DATA: Master[] = [
  // ── Fehnon Hoskie — Aquos ─────────────────────────────────────────────────
  {
    id:          "fehnon",
    name:        "Fehnon",
    fullName:    "Fehnon Hoskie",
    element:     "Aquos",
    rarity:      "LR",
    iconPath:    "/images/masters/fehnon-icon.png",
    artPath:     "/images/masters/fehnon-art.png",
    bgColor:     "#0a1628",
    accentColor: "#38bdf8",
    description: "Um guerreiro poderoso com sua espada, a Poderosa Protonix Sword! Ele sempre está treinando para entender mais do seu Poder Ultimate.",
    quote:       '"A espada não mente. Ela revela quem você realmente é."',
    maxLevel:    50, currentLevel:1, currentXP:0, xpToNext:xpRequiredForLevel(1), totalXP:0,
    rewards:     buildRewards(), isActive:true, isUnlocked:true,
  },

  // ── Morgana Pendragon — Darkus ────────────────────────────────────────────
  {
    id:          "morgana",
    name:        "Morgana",
    fullName:    "Morgana Pendragon",
    element:     "Darkus",
    rarity:      "LR",
    iconPath:    "/images/masters/morgana-icon.png",
    artPath:     "/images/masters/morgana-art.png",
    bgColor:     "#120a28",
    accentColor: "#a855f7",
    description: "Uma garota muito apegada com a música, sua vida está em um ritmo acelerado, e quando está em batalha, ela revela sua melodia impactante!",
    quote:       '"Cada duelo é uma música. Eu escolho o final."',
    maxLevel:    50, currentLevel:1, currentXP:0, xpToNext:xpRequiredForLevel(1), totalXP:0,
    rewards:     buildRewards(), isActive:false, isUnlocked:true,
  },

  // ── Calem Hidenori — Vazio ────────────────────────────────────────────────
  {
    id:          "calem",
    name:        "Calem",
    fullName:    "Calem Hidenori",
    element:     "Vazio",
    rarity:      "UR",
    iconPath:    "/images/masters/calem-icon.png",
    artPath:     "/images/masters/calem-art.png",
    bgColor:     "#0f1013",
    accentColor: "#94a3b8",
    description: "Um garoto aparentemente inofensivo, mas na verdade ele esconde um grande poder que ele mesmo o descobre através das batalhas, e sempre buscando a vitória!",
    quote:       '"Não preciso parecer forte. Só preciso vencer."',
    maxLevel:    50, currentLevel:1, currentXP:0, xpToNext:xpRequiredForLevel(1), totalXP:0,
    rewards:     buildRewards(), isActive:false, isUnlocked:true,
  },

  // ── Arthur Pendragon — Darkus ─────────────────────────────────────────────
  {
    id:          "arthur",
    name:        "Arthur",
    fullName:    "Arthur Pendragon",
    element:     "Darkus",
    rarity:      "LR",
    iconPath:    "/images/masters/arthur-icon.png",
    artPath:     "/images/masters/arthur-art.png",
    bgColor:     "#0d0718",
    accentColor: "#7c3aed",
    description: "O Rei de Camelot que carrega o peso do trono e o poder das trevas. Imponente e calculista, ele trata cada duelo como um julgamento real onde a última palavra é sempre a dele.",
    quote:       '"Veredito do Rei Tirano!"',
    maxLevel:    50, currentLevel:1, currentXP:0, xpToNext:xpRequiredForLevel(1), totalXP:0,
    rewards:     buildRewards(), isActive:false, isUnlocked:true,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getActiveMaster(): Master | undefined {
  return MASTERS_DATA.find(m => m.isActive)
}

export function cumulativeXPForLevel(level: number): number {
  let total = 0
  for (let l = 1; l < level; l++) total += xpRequiredForLevel(l)
  return total
}

export function computeLevelFromXP(totalXP: number): { level: number; xpInLevel: number; xpToNext: number } {
  let level = 1, remaining = totalXP
  while (level < 50) {
    const needed = xpRequiredForLevel(level)
    if (remaining < needed) break
    remaining -= needed; level++
  }
  return { level, xpInLevel: remaining, xpToNext: xpRequiredForLevel(level) }
}

export function calcMasterXP(opts: {
  won: boolean; opponentLevel: number
  duelMode: "pvp" | "pve" | "boss" | "war" | "draft"
}): number {
  const base = opts.won ? 80 : 30
  const modeBonus: Record<string,number> = { pvp:30, boss:60, war:50, pve:20, draft:25 }
  const levelBonus = Math.min(opts.opponentLevel * 2, 40)
  return base + (modeBonus[opts.duelMode] ?? 20) + levelBonus
}

export function calcAccountXP(durationMinutes: number, won: boolean): number {
  return Math.round(30 + durationMinutes * 5 + (won ? 20 : 0))
}

/**
 * Image icon path for each reward type (used by the Master screen UI).
 * Para recompensas do tipo "chest", passe o `chestId` do elemento do Mestre
 * (via `elementToChestId`) para exibir o baú temático correto — ex.: o baú
 * de Fehnon (Aquos) é diferente do baú de Calem (Vazio).
 */
export function rewardIconPath(type: MasterReward["type"], packId?: string, chestId?: ChestId): string {
  switch (type) {
    case "gear_coins":     return "/images/gear-coin.png"
    case "gacha_coins":    return "/images/icons/gacha-coin.png"
    case "pack":           return packId === "sr_guaranteed" ? "/images/gacha/pack-anl.png" : "/images/gacha/pack-fsg.png"
    case "chest":          return CHESTS[chestId ?? "void"].image
    case "skip_ticket":    return "/images/skip-ticket.png"
    case "stamina_bottle": return "/images/stamina-bottle.png"
    case "card_skin":      return "/images/gacha/Parte_de_trás_da_Carta.png"
    default:               return "/images/gear-coin.png"
  }
}

/**
 * Rótulo de exibição de uma recompensa, resolvendo o nome do Baú temático
 * de acordo com o elemento do Mestre quando `reward.type === "chest"`.
 */
export function rewardDisplayLabel(reward: MasterReward, masterElement: MasterElement): string {
  if (reward.type === "chest" && reward.amount) {
    const chest = CHESTS[elementToChestId(masterElement)]
    // "Baú de Aquos" → "Baús de Aquos" (pluraliza só a palavra "Baú" inicial)
    const name = reward.amount > 1 ? chest.name.replace(/^Baú/, "Baús") : chest.name
    return `${reward.amount} ${name}`
  }
  return reward.label
}

/** Legacy emoji icon (kept for compatibility with older call sites). */
export function rewardIcon(type: MasterReward["type"]): string {
  const map: Record<string,string> = {
    gear_coins:"🪙", pack:"📦", gacha_coins:"🎰",
    card_skin:"🃏", chest:"🎁", skip_ticket:"🎟️", stamina_bottle:"🧪",
  }
  return map[type] ?? "🎁"
}

export const LS_MASTERS_KEY = "gpgame_masters_v1"

export function saveMastersToStorage(masters: Master[]): void {
  try {
    const data = masters.map(m => ({
      id: m.id, currentLevel: m.currentLevel, currentXP: m.currentXP,
      totalXP: m.totalXP, isActive: m.isActive, isUnlocked: m.isUnlocked,
      rewards: m.rewards.map(r => ({ level: r.level, claimed: r.claimed })),
    }))
    localStorage.setItem(LS_MASTERS_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

export function loadMastersFromStorage(): Master[] {
  try {
    const raw = localStorage.getItem(LS_MASTERS_KEY)
    if (!raw) return MASTERS_DATA
    const saved: Array<{
      id:string; currentLevel:number; currentXP:number; totalXP:number
      isActive:boolean; isUnlocked:boolean; rewards:Array<{level:number;claimed:boolean}>
    }> = JSON.parse(raw)
    return MASTERS_DATA.map(master => {
      const s = saved.find(x => x.id === master.id)
      if (!s) return master
      return {
        ...master,
        currentLevel: s.currentLevel, currentXP: s.currentXP,
        totalXP: s.totalXP, xpToNext: xpRequiredForLevel(s.currentLevel),
        isActive: s.isActive, isUnlocked: s.isUnlocked,
        rewards: master.rewards.map(r => {
          const sr = s.rewards.find(x => x.level === r.level)
          return sr ? { ...r, claimed: sr.claimed } : r
        }),
      }
    })
  } catch { return MASTERS_DATA }
}

/**
 * Concede XP de Mestre pelo resultado de um duelo, salva no localStorage e
 * dispara o evento "gpgame_master_xp" que a tela de resultado escuta.
 *
 * Mesma regra usada no fim de um duelo real — reaproveitada pelo Skip Tíquete,
 * que pula a partida mas mantém todas as recompensas.
 */
export function grantMasterDuelXP(opts: {
  won: boolean
  duelMode: "pvp" | "pve" | "boss" | "war" | "draft"
  opponentLevel?: number
}): void {
  try {
    const masters = loadMastersFromStorage()
    const xpGain = calcMasterXP({
      won: opts.won,
      opponentLevel: opts.opponentLevel ?? 1,
      duelMode: opts.duelMode,
    })
    const prevActive = masters.find(m => m.isActive)
    const updated = masters.map(m => {
      if (!m.isActive) return m
      if (m.currentLevel >= m.maxLevel) return m
      let xp = m.currentXP + xpGain
      let level = m.currentLevel
      while (level < m.maxLevel) {
        const needed = xpRequiredForLevel(level)
        if (xp >= needed) { xp -= needed; level++ }
        else break
      }
      if (level >= m.maxLevel) { level = m.maxLevel; xp = 0 }
      return { ...m, currentXP: xp, currentLevel: level, totalXP: m.totalXP + xpGain, xpToNext: xpRequiredForLevel(level) }
    })
    saveMastersToStorage(updated)

    const active = updated.find(m => m.isActive)
    const leveledUp = !!(active && prevActive && active.currentLevel > prevActive.currentLevel)
    window.dispatchEvent(new CustomEvent("gpgame_master_xp", {
      detail: {
        masterId: active?.id ?? "",
        masterName: active?.name ?? "",
        xpGain,
        newLevel: active?.currentLevel ?? 1,
        leveledUp,
      },
    }))
  } catch { /* ignore */ }
}

/**
 * Concede XP manualmente a um Mestre ESPECÍFICO (não precisa ser o Mestre
 * ativo) — usado pelos Livros de XP na tela de Mestre. Salva no localStorage
 * e dispara o mesmo evento "gpgame_master_xp" usado pelo XP de duelo, para a
 * tela de Mestres atualizar a barra/nível imediatamente.
 */
export function grantMasterXPManual(
  masterId: string,
  xpAmount: number,
): { newLevel: number; leveledUp: boolean } | null {
  try {
    if (!Number.isFinite(xpAmount) || xpAmount <= 0) return null
    const masters = loadMastersFromStorage()
    const target = masters.find(m => m.id === masterId)
    if (!target) return null
    const prevLevel = target.currentLevel

    const updated = masters.map(m => {
      if (m.id !== masterId) return m
      if (m.currentLevel >= m.maxLevel) return m
      let xp = m.currentXP + xpAmount
      let level = m.currentLevel
      while (level < m.maxLevel) {
        const needed = xpRequiredForLevel(level)
        if (xp >= needed) { xp -= needed; level++ }
        else break
      }
      if (level >= m.maxLevel) { level = m.maxLevel; xp = 0 }
      return { ...m, currentXP: xp, currentLevel: level, totalXP: m.totalXP + xpAmount, xpToNext: xpRequiredForLevel(level) }
    })
    saveMastersToStorage(updated)

    const result = updated.find(m => m.id === masterId)!
    const leveledUp = result.currentLevel > prevLevel
    window.dispatchEvent(new CustomEvent("gpgame_master_xp", {
      detail: {
        masterId: result.id,
        masterName: result.name,
        xpGain: xpAmount,
        newLevel: result.currentLevel,
        leveledUp,
      },
    }))
    return { newLevel: result.currentLevel, leveledUp }
  } catch { return null }
}
