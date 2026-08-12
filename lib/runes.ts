/**
 * RUNAS DOS MESTRES — mecânica de progressão paralela à Trilha de XP.
 *
 * Cada Mestre possui uma ROTA DE RUNAS ÚNICA, dividida em 3 ramos temáticos
 * (Fortuna · Guerra · Domínio) com 4 runas cada. Uma runa só pode ser
 * desbloqueada quando:
 *   1. a runa anterior do MESMO ramo já foi desbloqueada;
 *   2. o Mestre atingiu o nível mínimo exigido;
 *   3. o jogador tem Gear Coins e FRAGMENTOS suficientes.
 *
 * O fragmento exigido é o do ELEMENTO do Mestre — Fehnon (Aquos) gasta
 * Fragmento de Mercúrio, Morgana (Darkus) gasta Fragmento de Irídio,
 * Calem (Vazio) gasta Fragmento de Gálio. Runas de tiers avançados também
 * pedem Fragmento de Gálio (material comum) como custo secundário.
 *
 * Ao desbloquear, a runa entrega UMA recompensa única (Gacha Coins, Packs R /
 * SR / LR, Baús elementais, Skip Tíquetes, Garrafas de Stamina, Gear Coins).
 */

import { FRAGMENTS, COMMON_FRAGMENT_ID, type FragmentCounts, type FragmentId } from "./fragments"
import { elementToChestId, type Master, type MasterElement } from "./masters-data"
import { CHESTS, type ChestId } from "./chests"

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type RuneRewardType =
  | "gear_coins"
  | "gacha_coins"
  | "pack"
  | "chest"
  | "skip_ticket"
  | "stamina_bottle"

export type RunePackId = "common" | "sr_guaranteed" | "lr_guaranteed"

export interface RuneReward {
  type:    RuneRewardType
  amount?: number
  packId?: RunePackId
  /** Rótulo já resolvido para exibição (inclui o nome do baú do elemento). */
  label:   string
}

export interface RuneCost {
  gearCoins: number
  fragments: FragmentCounts
}

export interface RuneDef {
  id:            string
  masterId:      string
  branchId:      RuneBranchId
  /** 1 a 4 — posição dentro do ramo. */
  tier:          number
  name:          string
  description:   string
  requiredLevel: number
  cost:          RuneCost
  rewards:       RuneReward[]
  /** Runa que precisa estar desbloqueada antes desta (null no tier 1). */
  requires:      string | null
}

export type RuneBranchId = "fortuna" | "guerra" | "dominio"

export interface RuneBranch {
  id:       RuneBranchId
  name:     string
  subtitle: string
  runes:    RuneDef[]
}

// ─── Elemento → Fragmento ─────────────────────────────────────────────────────
/** Fragmento gasto para desbloquear as runas de um Mestre, pelo seu elemento. */
export function elementToFragmentId(element: MasterElement): FragmentId {
  switch (element) {
    case "Aquos":    return "mercurio"
    case "Darkus":   return "iridio"
    case "Ventus":   return "nitrogenio"
    case "Pyrus":    return "rubidio"
    case "Haos":     return "helio"
    case "Vazio":    return "galio"
    case "Subterra": return "galio"
    default:         return "galio"
  }
}

// ─── Tabelas de balanceamento ─────────────────────────────────────────────────
/** Custo base por tier: Gear Coins, fragmento elemental e fragmento comum. */
const TIER_COST = [
  { gear:  250, elemental: 15, common:  0 },
  { gear:  550, elemental: 30, common: 12 },
  { gear: 1100, elemental: 55, common: 25 },
  { gear: 1900, elemental: 90, common: 45 },
] as const

/** Nível mínimo do Mestre por ramo/tier — escalonado, sem travar o começo. */
const BRANCH_LEVELS: Record<RuneBranchId, [number, number, number, number]> = {
  fortuna: [2, 7, 14, 22],
  guerra:  [4, 10, 17, 26],
  dominio: [3, 9, 16, 24],
}

const BRANCH_META: Record<RuneBranchId, { name: string; subtitle: string }> = {
  fortuna: { name: "Fortuna",  subtitle: "Moedas e riquezas" },
  guerra:  { name: "Guerra",   subtitle: "Packs e cartas" },
  dominio: { name: "Domínio",  subtitle: "Itens e utilidades" },
}

/** Nomes das runas — rota exclusiva de cada Mestre, com o tema do elemento. */
const RUNE_NAMES: Record<string, Record<RuneBranchId, [string, string, string, string]>> = {
  fehnon: {
    fortuna: ["Runa da Maré Serena", "Runa do Coral Dourado", "Runa da Correnteza Pródiga", "Runa do Abismo Tesouro"],
    guerra:  ["Runa da Lâmina d'Água", "Runa do Golpe Protonix", "Runa da Tempestade Salgada", "Runa do Juízo Oceânico"],
    dominio: ["Runa do Fluxo Constante", "Runa do Sopro Marinho", "Runa da Âncora Eterna", "Runa do Soberano das Marés"],
  },
  morgana: {
    fortuna: ["Runa do Acorde Sombrio", "Runa da Ametista Cantante", "Runa do Réquiem Dourado", "Runa da Sinfonia Proibida"],
    guerra:  ["Runa do Compasso Cruel", "Runa do Grito Púrpura", "Runa da Melodia Impactante", "Runa do Crescendo Final"],
    dominio: ["Runa do Silêncio Breve", "Runa do Eco Noturno", "Runa da Pausa Infinita", "Runa da Regente das Trevas"],
  },
  calem: {
    fortuna: ["Runa do Vácuo Fértil", "Runa da Prata Silente", "Runa do Espólio Nulo", "Runa do Tesouro Sem Nome"],
    guerra:  ["Runa do Corte Invisível", "Runa do Poder Oculto", "Runa da Ruptura Cinzenta", "Runa do Colapso Absoluto"],
    dominio: ["Runa do Passo Leve", "Runa da Brecha Entre Mundos", "Runa do Tempo Suspenso", "Runa do Senhor do Vazio"],
  },
}

/** Fallback quando um Mestre novo ainda não tem nomes autorais. */
function fallbackNames(branch: RuneBranchId): [string, string, string, string] {
  const base = BRANCH_META[branch].name
  return [`Runa de ${base} I`, `Runa de ${base} II`, `Runa de ${base} III`, `Runa de ${base} IV`]
}

const RUNE_DESCRIPTIONS: Record<RuneBranchId, [string, string, string, string]> = {
  fortuna: [
    "Um primeiro sopro de sorte gravado na pedra do Mestre.",
    "O brilho das riquezas antigas começa a responder ao seu chamado.",
    "A veia mais profunda de fortuna se abre para quem persistiu.",
    "O ápice da avareza sagrada: tudo o que foi guardado, enfim entregue.",
  ],
  guerra: [
    "O eco do primeiro duelo, selado em runa.",
    "A técnica amadurece e novas cartas respondem ao combate.",
    "Guerra virou disciplina — e a disciplina virou arsenal.",
    "O golpe definitivo do Mestre, imortalizado em poder lendário.",
  ],
  dominio: [
    "O caminho encurta para quem entende o ritmo da jornada.",
    "Reservas se acumulam nas mãos de quem sabe esperar.",
    "O tempo e o corpo passam a obedecer à vontade do Mestre.",
    "Domínio absoluto: nada mais interrompe a marcha.",
  ],
}

// ─── Recompensas por ramo/tier ────────────────────────────────────────────────
type RawReward = { type: RuneRewardType; amount?: number; packId?: RunePackId }

const BRANCH_REWARDS: Record<RuneBranchId, RawReward[][]> = {
  fortuna: [
    [{ type: "gacha_coins", amount: 80 }],
    [{ type: "gear_coins", amount: 300 }, { type: "pack", packId: "common" }],
    [{ type: "gacha_coins", amount: 220 }, { type: "chest", amount: 2 }],
    [{ type: "gear_coins", amount: 800 }, { type: "gacha_coins", amount: 400 }],
  ],
  guerra: [
    [{ type: "pack", packId: "common" }, { type: "gacha_coins", amount: 40 }],
    [{ type: "pack", packId: "sr_guaranteed" }],
    [{ type: "pack", packId: "sr_guaranteed" }, { type: "chest", amount: 3 }],
    [{ type: "pack", packId: "lr_guaranteed" }, { type: "gacha_coins", amount: 300 }],
  ],
  dominio: [
    [{ type: "skip_ticket", amount: 2 }],
    [{ type: "chest", amount: 3 }, { type: "gear_coins", amount: 200 }],
    [{ type: "stamina_bottle", amount: 3 }, { type: "skip_ticket", amount: 3 }],
    [{ type: "skip_ticket", amount: 5 }, { type: "pack", packId: "sr_guaranteed" }],
  ],
}

// ─── Rótulos ──────────────────────────────────────────────────────────────────
const PACK_LABEL: Record<RunePackId, string> = {
  common:        "1 Pack R",
  sr_guaranteed: "1 Pack SR Garantido",
  lr_guaranteed: "1 Pack LR Garantido",
}

function rewardLabel(raw: RawReward, chestId: ChestId): string {
  switch (raw.type) {
    case "gear_coins":     return `${raw.amount} Gear Coins`
    case "gacha_coins":    return `${raw.amount} Gacha Coins`
    case "pack":           return PACK_LABEL[raw.packId ?? "common"]
    case "skip_ticket":    return `${raw.amount} Skip Tíquete${(raw.amount ?? 1) > 1 ? "s" : ""}`
    case "stamina_bottle": return `${raw.amount} Garrafa${(raw.amount ?? 1) > 1 ? "s" : ""} de Stamina`
    case "chest": {
      const chest = CHESTS[chestId]
      const name  = (raw.amount ?? 1) > 1 ? chest.name.replace(/^Baú/, "Baús") : chest.name
      return `${raw.amount} ${name}`
    }
    default: return "Recompensa"
  }
}

export function runeRewardIconPath(reward: RuneReward, chestId: ChestId): string {
  switch (reward.type) {
    case "gear_coins":     return "/images/gear-coin.png"
    case "gacha_coins":    return "/images/icons/gacha-coin.png"
    case "pack":           return reward.packId === "common" ? "/images/gacha/pack-fsg.png" : "/images/gacha/pack-anl.png"
    case "chest":          return CHESTS[chestId].image
    case "skip_ticket":    return "/images/skip-ticket.png"
    case "stamina_bottle": return "/images/stamina-bottle.png"
    default:               return "/images/gear-coin.png"
  }
}

export function runeRewardColor(type: RuneRewardType, chestColor?: string): string {
  if (type === "chest") return chestColor ?? "#cbd5e1"
  const map: Record<RuneRewardType, string> = {
    gear_coins: "#e8c96d",
    gacha_coins: "#a78bfa",
    pack: "#60a5fa",
    chest: "#cbd5e1",
    skip_ticket: "#34d399",
    stamina_bottle: "#f472b6",
  }
  return map[type] ?? "#94a3b8"
}

// ─── Construção da rota ───────────────────────────────────────────────────────
const BRANCH_ORDER: RuneBranchId[] = ["fortuna", "guerra", "dominio"]

function buildCost(tier: number, elemental: FragmentId): RuneCost {
  const t = TIER_COST[tier - 1]
  const fragments: FragmentCounts = {}
  // Quando o fragmento do elemento JÁ é o comum (Gálio), os dois custos se somam
  // num só valor em vez de aparecerem duplicados.
  if (elemental === COMMON_FRAGMENT_ID) {
    fragments[COMMON_FRAGMENT_ID] = t.elemental + t.common
  } else {
    fragments[elemental] = t.elemental
    if (t.common > 0) fragments[COMMON_FRAGMENT_ID] = t.common
  }
  return { gearCoins: t.gear, fragments }
}

/** Rota completa de Runas de um Mestre (3 ramos × 4 runas). */
export function getRuneBranches(master: Pick<Master, "id" | "element">): RuneBranch[] {
  const elemental = elementToFragmentId(master.element)
  const chestId   = elementToChestId(master.element)
  const names     = RUNE_NAMES[master.id]

  return BRANCH_ORDER.map(branchId => {
    const branchNames = names?.[branchId] ?? fallbackNames(branchId)
    const runes: RuneDef[] = branchNames.map((name, i) => {
      const tier = i + 1
      return {
        id:            `${master.id}-${branchId}-${tier}`,
        masterId:      master.id,
        branchId,
        tier,
        name,
        description:   RUNE_DESCRIPTIONS[branchId][i],
        requiredLevel: BRANCH_LEVELS[branchId][i],
        cost:          buildCost(tier, elemental),
        rewards:       BRANCH_REWARDS[branchId][i].map(raw => ({
          type:   raw.type,
          amount: raw.amount,
          packId: raw.packId,
          label:  rewardLabel(raw, chestId),
        })),
        requires:      tier === 1 ? null : `${master.id}-${branchId}-${tier - 1}`,
      }
    })
    return { id: branchId, ...BRANCH_META[branchId], runes }
  })
}

/** Todas as runas de um Mestre em lista plana. */
export function getAllRunes(master: Pick<Master, "id" | "element">): RuneDef[] {
  return getRuneBranches(master).flatMap(b => b.runes)
}

// ─── Estado de desbloqueio ────────────────────────────────────────────────────
export type UnlockedRunes = Record<string, string[]>

export const LS_RUNES_KEY = "gpgame_runes_v1"

export function loadUnlockedRunes(): UnlockedRunes {
  try {
    const raw = localStorage.getItem(LS_RUNES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    const out: UnlockedRunes = {}
    for (const [masterId, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(list)) out[masterId] = list.filter((x): x is string => typeof x === "string")
    }
    return out
  } catch {
    return {}
  }
}

export function saveUnlockedRunes(state: UnlockedRunes): void {
  try { localStorage.setItem(LS_RUNES_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

export type RuneStatus = "unlocked" | "available" | "locked_level" | "locked_prev" | "locked_cost"

export interface RuneStatusInfo {
  status:      RuneStatus
  /** Motivo legível do bloqueio (vazio quando disponível/desbloqueada). */
  reason:      string
  missingGear: number
  missingFragments: FragmentCounts
}

export function getRuneStatus(opts: {
  rune:      RuneDef
  unlocked:  string[]
  level:     number
  gearCoins: number
  fragments: FragmentCounts
}): RuneStatusInfo {
  const { rune, unlocked, level, gearCoins, fragments } = opts

  if (unlocked.includes(rune.id)) {
    return { status: "unlocked", reason: "", missingGear: 0, missingFragments: {} }
  }
  if (rune.requires && !unlocked.includes(rune.requires)) {
    return { status: "locked_prev", reason: "Desbloqueie a runa anterior do ramo", missingGear: 0, missingFragments: {} }
  }
  if (level < rune.requiredLevel) {
    return {
      status: "locked_level",
      reason: `Requer o Mestre no nível ${rune.requiredLevel}`,
      missingGear: 0, missingFragments: {},
    }
  }

  const missingFragments: FragmentCounts = {}
  for (const [id, need] of Object.entries(rune.cost.fragments) as [FragmentId, number][]) {
    const have = fragments[id] ?? 0
    if (have < need) missingFragments[id] = need - have
  }
  const missingGear = Math.max(0, rune.cost.gearCoins - gearCoins)

  if (missingGear > 0 || Object.keys(missingFragments).length > 0) {
    const parts: string[] = []
    if (missingGear > 0) parts.push(`${missingGear} Gear Coins`)
    for (const [id, amount] of Object.entries(missingFragments) as [FragmentId, number][]) {
      parts.push(`${amount} ${FRAGMENTS[id].name}`)
    }
    return { status: "locked_cost", reason: `Faltam ${parts.join(" e ")}`, missingGear, missingFragments }
  }

  return { status: "available", reason: "", missingGear: 0, missingFragments: {} }
}

/** Progresso total da rota de um Mestre. */
export function getRuneProgress(master: Pick<Master, "id" | "element">, unlocked: string[]) {
  const all = getAllRunes(master)
  const done = all.filter(r => unlocked.includes(r.id)).length
  return { done, total: all.length, pct: all.length ? (done / all.length) * 100 : 0 }
}
