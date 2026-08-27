// ─── master-bond.ts ───────────────────────────────────────────────────────────
// Sistema de Afinidade / Vínculo (Bond Level) dos Mestres.
//
// Mecânica: o Mestre ganha XP de Afinidade ao ser usado em partidas (o Mestre
// ATIVO recebe XP de Vínculo junto com o XP de duelo) ou ao receber presentes
// (Garrafas de Stamina). Recompensas por nível de Vínculo: Packs R e SR,
// Títulos para o perfil do jogador e Gacha Coins.

export const BOND_MAX_LEVEL     = 10
/** XP de Vínculo ganho pelo Mestre ativo a cada partida jogada. */
export const BOND_XP_PER_MATCH  = 15
/** XP de Vínculo por Garrafa de Stamina dada de presente. */
export const BOND_XP_PER_BOTTLE = 40

/** XP necessário para ir do nível `level` → `level + 1`. */
export function bondXpForLevel(level: number): number {
  if (level >= BOND_MAX_LEVEL) return 0
  return 80 + level * 40
}

// ─── Recompensas de Vínculo ───────────────────────────────────────────────────
export interface BondRewardDef {
  level:   number
  type:    "pack" | "gacha_coins" | "title"
  label:   string
  packId?: string   // "common" (Pack R) | "sr_guaranteed" (Pack SR)
  amount?: number
  title?:  string   // título desbloqueado no perfil do jogador
}

/** Trilha de recompensas de Vínculo — os títulos são personalizados por Mestre. */
export function bondRewardsFor(masterName: string): BondRewardDef[] {
  return [
    { level: 2,  type:"pack",        label:"1 Pack R",                          packId:"common" },
    { level: 3,  type:"gacha_coins", label:"30 Gacha Coins",                    amount:30 },
    { level: 4,  type:"title",       label:`Título: Amigo de ${masterName}`,    title:`Amigo de ${masterName}` },
    { level: 5,  type:"pack",        label:"1 Pack SR Garantido",               packId:"sr_guaranteed" },
    { level: 6,  type:"gacha_coins", label:"60 Gacha Coins",                    amount:60 },
    { level: 7,  type:"pack",        label:"1 Pack R",                          packId:"common" },
    { level: 8,  type:"title",       label:`Título: Parceiro de ${masterName}`, title:`Parceiro de ${masterName}` },
    { level: 9,  type:"pack",        label:"1 Pack SR Garantido",               packId:"sr_guaranteed" },
    { level: 10, type:"gacha_coins", label:"150 Gacha Coins",                   amount:150 },
  ]
}

// ─── Persistência ─────────────────────────────────────────────────────────────
export const LS_BOND_KEY = "gpgame_master_bond_v1"

interface BondSave { xp: number; claimed: number[] }
type BondStore = Record<string, BondSave>

function loadStore(): BondStore {
  try {
    const raw = localStorage.getItem(LS_BOND_KEY)
    return raw ? (JSON.parse(raw) as BondStore) : {}
  } catch { return {} }
}

function saveStore(store: BondStore): void {
  try { localStorage.setItem(LS_BOND_KEY, JSON.stringify(store)) } catch { /* ignore */ }
}

function emitBondChange(masterId: string, detail: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("gpgame_master_bond", { detail: { masterId, ...detail } }))
}

// ─── Leitura de progresso ─────────────────────────────────────────────────────
export interface BondProgress {
  level:     number
  xpInLevel: number
  xpToNext:  number
  totalXP:   number
  claimed:   number[]
}

export function computeBondLevel(totalXP: number): { level: number; xpInLevel: number; xpToNext: number } {
  let level = 1
  let remaining = Math.max(0, totalXP)
  while (level < BOND_MAX_LEVEL) {
    const needed = bondXpForLevel(level)
    if (remaining < needed) break
    remaining -= needed
    level++
  }
  if (level >= BOND_MAX_LEVEL) return { level: BOND_MAX_LEVEL, xpInLevel: 0, xpToNext: 0 }
  return { level, xpInLevel: remaining, xpToNext: bondXpForLevel(level) }
}

export function getMasterBond(masterId: string): BondProgress {
  const saved = loadStore()[masterId]
  const totalXP = saved?.xp ?? 0
  const { level, xpInLevel, xpToNext } = computeBondLevel(totalXP)
  return { level, xpInLevel, xpToNext, totalXP, claimed: saved?.claimed ?? [] }
}

/** Quantas recompensas de Vínculo estão disponíveis para resgate. */
export function claimableBondCount(masterId: string, masterName: string): number {
  const bond = getMasterBond(masterId)
  return bondRewardsFor(masterName)
    .filter(r => r.level <= bond.level && !bond.claimed.includes(r.level)).length
}

// ─── Mutação ──────────────────────────────────────────────────────────────────
export function grantBondXP(masterId: string, amount: number): { newLevel: number; leveledUp: boolean } | null {
  try {
    if (!Number.isFinite(amount) || amount <= 0) return null
    const store = loadStore()
    const prev = store[masterId] ?? { xp: 0, claimed: [] }
    const prevLevel = computeBondLevel(prev.xp).level
    if (prevLevel >= BOND_MAX_LEVEL) return { newLevel: BOND_MAX_LEVEL, leveledUp: false }

    // Trava o XP total no teto do último nível — presentes não são desperdiçados além do máximo
    let maxTotal = 0
    for (let l = 1; l < BOND_MAX_LEVEL; l++) maxTotal += bondXpForLevel(l)
    const nextXP = Math.min(prev.xp + Math.floor(amount), maxTotal)

    store[masterId] = { ...prev, xp: nextXP }
    saveStore(store)

    const newLevel = computeBondLevel(nextXP).level
    const leveledUp = newLevel > prevLevel
    emitBondChange(masterId, { xpGain: amount, newLevel, leveledUp })
    return { newLevel, leveledUp }
  } catch { return null }
}

export function markBondRewardClaimed(masterId: string, level: number): void {
  try {
    const store = loadStore()
    const prev = store[masterId] ?? { xp: 0, claimed: [] }
    if (prev.claimed.includes(level)) return
    store[masterId] = { ...prev, claimed: [...prev.claimed, level] }
    saveStore(store)
    emitBondChange(masterId, { claimedLevel: level })
  } catch { /* ignore */ }
}

// ─── Títulos do perfil ────────────────────────────────────────────────────────
/** Adiciona um título à lista de títulos desbloqueados do perfil do jogador. */
export function unlockPlayerTitle(title: string): void {
  try {
    const raw = localStorage.getItem("gpgame_titles") ?? "[]"
    const titles: string[] = JSON.parse(raw)
    if (!titles.includes(title)) titles.push(title)
    localStorage.setItem("gpgame_titles", JSON.stringify(titles))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("gpgame_title_unlocked", { detail: { title } }))
    }
  } catch { /* ignore */ }
}
