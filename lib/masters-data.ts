// ─── masters-data.ts ──────────────────────────────────────────────────────────

export type MasterElement = "Aquos" | "Darkus" | "Ventus" | "Pyrus" | "Haos" | "Subterra" | "Vazio"
export type MasterRarity  = "R" | "SR" | "UR" | "LR"

export interface MasterReward {
  level:       number
  type:        "coins" | "pack" | "gacha_coins" | "title" | "card_skin" | "passive"
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
  passive?: {
    name:        string
    description: string
    icon:        string
  }
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
// Gems → Gacha Coins | frame/emote/skin → card_skin (Lv40/50) | Moldura removida
function buildRewards(): MasterReward[] {
  const table: Omit<MasterReward, "claimed">[] = [
    { level:  1, type:"coins",       label:"50 Moedas",              amount:50 },
    { level:  2, type:"pack",        label:"1 Pack Comum",           packId:"common" },
    { level:  3, type:"gacha_coins", label:"10 Gacha Coins",         amount:10 },
    { level:  4, type:"coins",       label:"80 Moedas",              amount:80 },
    { level:  5, type:"pack",        label:"Pack SR Garantido",      packId:"sr_guaranteed" },
    { level:  6, type:"gacha_coins", label:"20 Gacha Coins",         amount:20 },
    { level:  7, type:"coins",       label:"120 Moedas",             amount:120 },
    { level:  8, type:"pack",        label:"1 Pack Comum",           packId:"common" },
    { level:  9, type:"gacha_coins", label:"30 Gacha Coins",         amount:30 },
    { level: 10, type:"coins",       label:"200 Moedas",             amount:200 },
    { level: 11, type:"coins",       label:"150 Moedas",             amount:150 },
    { level: 12, type:"gacha_coins", label:"40 Gacha Coins",         amount:40 },
    { level: 13, type:"coins",       label:"180 Moedas",             amount:180 },
    { level: 14, type:"pack",        label:"Pack SR Garantido",      packId:"sr_guaranteed" },
    { level: 15, type:"coins",       label:"250 Moedas",             amount:250 },
    { level: 16, type:"gacha_coins", label:"60 Gacha Coins",         amount:60 },
    { level: 17, type:"coins",       label:"220 Moedas",             amount:220 },
    { level: 18, type:"pack",        label:"1 Pack Comum",           packId:"common" },
    { level: 19, type:"gacha_coins", label:"80 Gacha Coins",         amount:80 },
    { level: 20, type:"pack",        label:"Pack LR Garantido",      packId:"lr_guaranteed" },
    { level: 21, type:"coins",       label:"300 Moedas",             amount:300 },
    { level: 22, type:"gacha_coins", label:"100 Gacha Coins",        amount:100 },
    { level: 23, type:"pack",        label:"Pack SR Garantido",      packId:"sr_guaranteed" },
    { level: 24, type:"coins",       label:"350 Moedas",             amount:350 },
    { level: 25, type:"passive",     label:"Habilidade Passiva"      },
    { level: 26, type:"gacha_coins", label:"120 Gacha Coins",        amount:120 },
    { level: 27, type:"coins",       label:"400 Moedas",             amount:400 },
    { level: 28, type:"pack",        label:"Pack LR Garantido",      packId:"lr_guaranteed" },
    { level: 29, type:"gacha_coins", label:"150 Gacha Coins",        amount:150 },
    { level: 30, type:"title",       label:"Título Lendário"         },
    { level: 31, type:"coins",       label:"500 Moedas",             amount:500 },
    { level: 32, type:"gacha_coins", label:"180 Gacha Coins",        amount:180 },
    { level: 33, type:"pack",        label:"Pack SR Garantido",      packId:"sr_guaranteed" },
    { level: 34, type:"coins",       label:"600 Moedas",             amount:600 },
    { level: 35, type:"pack",        label:"Pack LR Garantido",      packId:"lr_guaranteed" },
    { level: 36, type:"gacha_coins", label:"200 Gacha Coins",        amount:200 },
    { level: 37, type:"coins",       label:"700 Moedas",             amount:700 },
    { level: 38, type:"pack",        label:"Pack LR Garantido",      packId:"lr_guaranteed" },
    { level: 39, type:"gacha_coins", label:"250 Gacha Coins",        amount:250 },
    { level: 40, type:"card_skin",   label:"Skin de Carta Exclusiva" },
    { level: 41, type:"coins",       label:"800 Moedas",             amount:800 },
    { level: 42, type:"gacha_coins", label:"300 Gacha Coins",        amount:300 },
    { level: 43, type:"pack",        label:"Pack LR Garantido",      packId:"lr_guaranteed" },
    { level: 44, type:"coins",       label:"900 Moedas",             amount:900 },
    { level: 45, type:"gacha_coins", label:"500 Gacha Coins",        amount:500 },
    { level: 46, type:"pack",        label:"Pack LR Garantido",      packId:"lr_guaranteed" },
    { level: 47, type:"coins",       label:"1000 Moedas",            amount:1000 },
    { level: 48, type:"gacha_coins", label:"600 Gacha Coins",        amount:600 },
    { level: 49, type:"pack",        label:"Pack LR Garantido",      packId:"lr_guaranteed" },
    { level: 50, type:"card_skin",   label:"Skin de Carta Lendária"  },
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
    passive: {
      name:        "Lâmina Protonix",
      description: "+15% de dano base em duelos PvE. Bônus de XP +10% ao vencer com menos de 50% de LP.",
      icon:        "⚔️",
    },
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
    passive: {
      name:        "Acorde do Caos",
      description: "+20% de XP de Mestre em duelos PvP. 15% de chance de negar armadilhas do oponente.",
      icon:        "🎸",
    },
  },

  // ── Calem Hidenori — Ventus ───────────────────────────────────────────────
  {
    id:          "calem",
    name:        "Calem",
    fullName:    "Calem Hidenori",
    element:     "Ventus",
    rarity:      "UR",
    iconPath:    "/images/masters/calem-icon.png",
    artPath:     "/images/masters/calem-art.png",
    bgColor:     "#0f1410",
    accentColor: "#4ade80",
    description: "Um garoto aparentemente inofensivo, mas na verdade ele esconde um grande poder que ele mesmo o descobre através das batalhas, e sempre buscando a vitória!",
    quote:       '"Não preciso parecer forte. Só preciso vencer."',
    maxLevel:    50, currentLevel:1, currentXP:0, xpToNext:xpRequiredForLevel(1), totalXP:0,
    rewards:     buildRewards(), isActive:false, isUnlocked:true,
    passive: {
      name:        "Mente Adaptável",
      description: "+25% de XP de Conta em todos os duelos. Reduz custo de Stamina em 1 ao vencer 3 duelos seguidos.",
      icon:        "🌀",
    },
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

/** Icon for reward type */
export function rewardIcon(type: MasterReward["type"]): string {
  const map: Record<string,string> = {
    coins:"🪙", pack:"📦", gacha_coins:"🎰", title:"🏷️",
    card_skin:"🃏", passive:"⚡",
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
