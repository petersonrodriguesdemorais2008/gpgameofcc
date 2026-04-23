/**
 * mission-tracker.ts
 * Utilitário centralizado para rastrear progresso de missões via localStorage.
 * Usado por gacha-screen, duel-screen, missions-screen e gear-pass-screen.
 *
 * Coloque em: lib/mission-tracker.ts
 */

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function getWeekStartStr(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`
}

// ─── Storage keys (um por janela de tempo) ────────────────────────────────────

const K = {
  gacha_d:    () => `gpgame_mt_gacha_d_${getTodayStr()}`,
  gacha_w:    () => `gpgame_mt_gacha_w_${getWeekStartStr()}`,
  gacha_total:    "gpgame_mt_gacha_total",
  wins_d:     () => `gpgame_mt_wins_d_${getTodayStr()}`,
  wins_w:     () => `gpgame_mt_wins_w_${getWeekStartStr()}`,
  wins_total:     "gpgame_mt_wins_total",
  duels_d:    () => `gpgame_mt_duels_d_${getTodayStr()}`,
  duels_w:    () => `gpgame_mt_duels_w_${getWeekStartStr()}`,
  duels_total:    "gpgame_mt_duels_total",
  sr_total:       "gpgame_mt_sr_total",
  login_d:    () => `gpgame_mt_login_${getTodayStr()}`,
  deck_d:     () => `gpgame_mt_deck_${getTodayStr()}`,
  deck_w:     () => `gpgame_mt_deck_w_${getWeekStartStr()}`,
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

function ri(key: string): number {
  if (typeof window === "undefined") return 0
  return parseInt(localStorage.getItem(key) || "0", 10) || 0
}
function ai(key: string, amount = 1): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, String(ri(key) + amount))
}
function rb(key: string): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(key) === "1"
}
function sb(key: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, "1")
}

// ─── Public tracking functions ────────────────────────────────────────────────

/** Chamar quando o jogador abre packs no gacha */
export function trackGachaPull(packCount: number, cards: Array<{ rarity: string }>): void {
  ai(K.gacha_d(),    packCount)
  ai(K.gacha_w(),    packCount)
  ai(K.gacha_total,  packCount)
  const srCount = cards.filter(c => ["SR","UR","LR"].includes(c.rarity)).length
  if (srCount > 0) ai(K.sr_total, srCount)
}

/** Chamar quando um duelo termina */
export function trackDuelResult(won: boolean): void {
  ai(K.duels_d())
  ai(K.duels_w())
  ai(K.duels_total)
  if (won) {
    ai(K.wins_d())
    ai(K.wins_w())
    ai(K.wins_total)
  }
}

/** Chamar quando o jogador abre o jogo (login diário) */
export function trackDailyLogin(): void {
  sb(K.login_d())
}

/** Chamar quando o jogador salva/edita um deck */
export function trackDeckEdit(): void {
  sb(K.deck_d())
  sb(K.deck_w())
}

// ─── Public read functions ────────────────────────────────────────────────────

export const getMissionProgress = {
  // Gacha
  gachaToday:    () => ri(K.gacha_d()),
  gachaWeek:     () => ri(K.gacha_w()),
  gachaTotal:    () => ri(K.gacha_total),
  // Vitórias
  winsToday:     () => ri(K.wins_d()),
  winsWeek:      () => ri(K.wins_w()),
  winsTotal:     () => ri(K.wins_total),
  // Duelos (vitória ou derrota)
  duelsToday:    () => ri(K.duels_d()),
  duelsWeek:     () => ri(K.duels_w()),
  duelsTotal:    () => ri(K.duels_total),
  // SRs obtidas
  srTotal:       () => ri(K.sr_total),
  // Login
  loginToday:    () => rb(K.login_d()),
  // Deck
  deckEditToday: () => rb(K.deck_d()),
  deckEditWeek:  () => rb(K.deck_w()),
}
