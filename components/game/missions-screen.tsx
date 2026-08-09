"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import {
  ArrowLeft, Target, Calendar, Star, Gift, Check,
  Sparkles, Flame, Swords, BookOpen, Users, Lock, Trophy, Crown,
} from "lucide-react"
import {
  getMissionProgress,
  trackDailyLogin,
  getTodayStr,
  getWeekStartStr,
} from "@/lib/mission-tracker"
import {
  SKIP_TICKET_DAILY_BONUS,
  SKIP_TICKET_IMAGE,
  SKIP_TICKET_NAME,
} from "@/lib/skip-ticket"

// ─── Skip Tíquete: ícone do item ──────────────────────────────────────────────
function SkipTicketIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={SKIP_TICKET_IMAGE || "/placeholder.svg"}
      alt={SKIP_TICKET_NAME}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: "drop-shadow(0 0 6px rgba(125,211,252,0.65))",
      }}
    />
  )
}

// ─── Coin Icon com fallback SVG ───────────────────────────────────────────────
function CoinIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <img
        src="/images/icons/gacha-coin.png"
        alt="Coin"
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: "contain" }}
        onError={() => setFailed(true)}
      />
    )
  }

  // Fallback SVG – anel dourado com brilho
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <defs>
        <radialGradient id="coinGrad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </radialGradient>
        <radialGradient id="coinShine" cx="35%" cy="30%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="#B45309" />
      <circle cx="12" cy="12" r="10" fill="url(#coinGrad)" />
      <circle cx="12" cy="12" r="10" fill="url(#coinShine)" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#92400E" fontFamily="serif">$</text>
    </svg>
  )
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface MissionsScreenProps { onBack: () => void }

interface Mission {
  id: string
  name: string
  description: string
  type: "daily" | "weekly" | "special"
  category: "gacha" | "battle" | "collection" | "social" | "general"
  icon: React.ReactNode
  progress: number
  maxProgress: number
  reward: { coins?: number; fp?: number; item?: string }
  completed: boolean
  claimed: boolean
}

// ─── Utilitários de Tempo ─────────────────────────────────────────────────────
function getNextMidnightUTC() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime()
}
function getNextMondayMidnightUTC() {
  const now = new Date(); const day = now.getUTCDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday)).getTime()
}
function getEventEndTimestamp() {
  const KEY = "missions_event_end"
  if (typeof window === "undefined") return Date.now() + 30 * 86400000
  const stored = localStorage.getItem(KEY)
  if (stored) { const ts = parseInt(stored, 10); if (!isNaN(ts) && ts > Date.now()) return ts }
  const end = Date.now() + 30 * 86400000
  localStorage.setItem(KEY, String(end))
  return end
}
function formatCountdown(ms: number) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  const s = Math.floor(ms / 1000)
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}
const pad = (n: number) => String(n).padStart(2, "0")

// Chaves de data para resetar claims por dia/semana.
// Usa as mesmas funções do mission-tracker (data local) para evitar
// divergência UTC vs. local perto da meia-noite.
const getDayKey  = getTodayStr
const getWeekKey = getWeekStartStr
// Tipo interno para claims com metadado de data
type ClaimedMap = Record<string, { dayKey: string; weekKey: string }>

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function CountdownTimer({ targetMs, label, color }: { targetMs: number; label: string; color: "cyan" | "purple" | "amber" }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()))
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [targetMs])
  const { days, hours, minutes, seconds } = formatCountdown(remaining)
  const cm = {
    cyan:   { pill: "bg-cyan-500/10 border-cyan-500/30",   text: "text-cyan-300",   dot: "bg-cyan-400",   ping: "bg-cyan-400",   bar: "bg-cyan-400" },
    purple: { pill: "bg-purple-500/10 border-purple-500/30", text: "text-purple-300", dot: "bg-purple-400", ping: "bg-purple-400", bar: "bg-purple-400" },
    amber:  { pill: "bg-amber-500/10 border-amber-500/30",  text: "text-amber-300",  dot: "bg-amber-400",  ping: "bg-amber-400",  bar: "bg-amber-400" },
  }[color]
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${cm.pill}`}>
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cm.ping}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cm.dot}`} />
      </span>
      <div className="flex flex-col leading-none">
        <span className="text-slate-400 text-[9px] font-bold tracking-widest uppercase mb-0.5">{label}</span>
        <span className={`font-mono text-[13px] font-bold ${cm.text}`}>
          {days > 0 && <>{days}d </>}{pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </div>
    </div>
  )
}

// ─── Mission Card ─────────────────────────────────────────────────────────────
// Anatomia AAA: recorte diagonal sci-fi, número de progresso "herói",
// estado PRONTO em ouro (#FFC531) com pulso de borda + sweep + partículas.
const CARD_CLIP = "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))"
const BTN_CLIP  = "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))"

function MissionCard({
  mission, isClaimed, isClaiming, tabColor, onClaim,
}: {
  mission: Mission
  isClaimed: boolean
  isClaiming: boolean
  tabColor: "cyan" | "purple" | "amber"
  onClaim: () => void
}) {
  const canClaim = mission.completed && !isClaimed
  const pct = Math.min(100, (mission.progress / mission.maxProgress) * 100)

  const catStyle = {
    gacha:      { icon: "bg-violet-500/15 border-violet-500/30 text-violet-300" },
    battle:     { icon: "bg-rose-500/15 border-rose-500/30 text-rose-300" },
    collection: { icon: "bg-amber-500/15 border-amber-500/30 text-amber-300" },
    social:     { icon: "bg-pink-500/15 border-pink-500/30 text-pink-300" },
    general:    { icon: "bg-sky-500/15 border-sky-500/30 text-sky-300" },
  }[mission.category]

  const barColor = {
    cyan:   "from-cyan-400 to-teal-300",
    purple: "from-purple-400 to-fuchsia-400",
    amber:  "from-amber-400 to-yellow-300",
  }[tabColor]

  return (
    <div className="relative">
      {/* Anel de pulso externo (fora do clip) quando pronto */}
      {canClaim && (
        <div
          className="absolute -inset-px pointer-events-none animate-[claim-pulse_2s_ease-in-out_infinite]"
          style={{ clipPath: CARD_CLIP, border: "1px solid rgba(255,197,49,0.9)" }}
        />
      )}

      <div
        className={`relative overflow-hidden transition-all duration-300 ${
          isClaimed
            ? "opacity-45 saturate-50"
            : canClaim
            ? ""
            : ""
        }`}
        style={{
          clipPath: CARD_CLIP,
          background: isClaimed
            ? "linear-gradient(180deg, rgba(15,23,42,0.5), rgba(10,15,28,0.5))"
            : canClaim
            ? "linear-gradient(135deg, rgba(45,33,8,0.85) 0%, rgba(20,17,10,0.92) 45%, rgba(10,14,26,0.95) 100%)"
            : "linear-gradient(180deg, rgba(17,25,44,0.75), rgba(10,15,28,0.85))",
          border: canClaim ? "1px solid rgba(255,197,49,0.45)" : "1px solid rgba(255,255,255,0.07)",
          boxShadow: canClaim ? "0 8px 32px rgba(255,180,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Textura scanline sutil */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.35]" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.012) 2px 4px)",
        }} />

        {/* Faixa diagonal decorativa no canto do recorte */}
        {!isClaimed && (
          <div className="absolute top-0 right-0 w-[72px] h-[72px] pointer-events-none" style={{
            background: canClaim
              ? "linear-gradient(225deg, rgba(255,197,49,0.22) 0%, transparent 55%)"
              : "linear-gradient(225deg, rgba(255,255,255,0.05) 0%, transparent 55%)",
          }} />
        )}

        {/* Sweep de luz quando pronto */}
        {canClaim && (
          <div className="absolute inset-0 pointer-events-none animate-[shimmer_2.4s_linear_infinite]"
            style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,220,120,0.10) 50%, transparent 65%)", backgroundSize: "200% 100%" }} />
        )}

        {/* Partículas (só no estado pronto) */}
        {canClaim && (
          <div className="absolute inset-0 pointer-events-none">
            {[
              { l: "12%", d: "0s",   s: 3 },
              { l: "38%", d: "0.7s", s: 2 },
              { l: "63%", d: "1.3s", s: 3 },
              { l: "85%", d: "0.4s", s: 2 },
            ].map((p, i) => (
              <span key={i}
                className="absolute bottom-1 rounded-full bg-[#FFC531] animate-[spark_2.6s_ease-in_infinite]"
                style={{ left: p.l, width: p.s, height: p.s, animationDelay: p.d, boxShadow: "0 0 6px rgba(255,197,49,0.9)" }} />
            ))}
          </div>
        )}

        <div className="relative flex items-stretch gap-3.5 p-4 sm:p-5">
          {/* Placa do ícone com recorte */}
          <div className="flex items-center">
            <div
              className={`w-[52px] h-[52px] flex items-center justify-center border ${canClaim ? "bg-[#FFC531]/15 border-[#FFC531]/40 text-[#FFC531]" : catStyle.icon}`}
              style={{ clipPath: BTN_CLIP }}
            >
              <div className="w-6 h-6">{mission.icon}</div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-black text-[13px] uppercase tracking-wide truncate ${isClaimed ? "text-slate-500" : "text-white"}`}>
                    {mission.name}
                  </h3>
                  {isClaimed && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed truncate">{mission.description}</p>
              </div>

              {/* Número herói de progresso */}
              <div className="shrink-0 text-right leading-none">
                <span className={`font-mono font-black text-xl tabular-nums ${canClaim ? "text-[#FFC531]" : isClaimed ? "text-slate-600" : "text-white"}`}>
                  {mission.progress}
                </span>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">/{mission.maxProgress}</span>
              </div>
            </div>

            {/* Barra de progresso + recompensas: mesmo grupo semântico */}
            <div className="mt-3">
              <div className="relative h-2 bg-slate-950/90 overflow-hidden" style={{ clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 100%, 0 100%)" }}>
                {/* ticks de segmento */}
                {mission.maxProgress > 1 && mission.maxProgress <= 10 &&
                  Array.from({ length: mission.maxProgress - 1 }).map((_, i) => (
                    <span key={i} className="absolute top-0 bottom-0 w-px bg-black/60 z-10"
                      style={{ left: `${((i + 1) / mission.maxProgress) * 100}%` }} />
                  ))}
                <div
                  className={`h-full transition-all duration-1000 bg-gradient-to-r ${
                    canClaim ? "from-[#FFC531] to-[#FFE08A]" : isClaimed ? "from-slate-600 to-slate-500" : barColor
                  }`}
                  style={{ width: `${pct}%`, boxShadow: canClaim ? "0 0 10px rgba(255,197,49,0.55)" : undefined }}
                />
              </div>

              <div className="flex items-center justify-between mt-2.5">
                <div className="flex gap-1.5">
                  {mission.reward.coins && (
                    <div className="flex items-center gap-1 bg-black/40 border border-amber-400/20 px-2 py-1" style={{ clipPath: BTN_CLIP }}>
                      <CoinIcon size={13} />
                      <span className="text-[10px] font-black text-amber-300 tabular-nums">+{mission.reward.coins.toLocaleString()}</span>
                    </div>
                  )}
                  {mission.reward.fp && (
                    <div className="flex items-center gap-1 bg-black/40 border border-purple-400/20 px-2 py-1" style={{ clipPath: BTN_CLIP }}>
                      <Star className="w-3 h-3 text-purple-300" />
                      <span className="text-[10px] font-black text-purple-300 tabular-nums">+{mission.reward.fp} FP</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Botão de claim: retangular, CTA real */}
          <div className="flex items-center">
            <button
              onClick={onClaim}
              disabled={!canClaim || isClaiming}
              className={`h-[52px] px-4 flex items-center justify-center gap-1.5 font-black text-[11px] uppercase tracking-wider transition-all duration-200 ${
                isClaimed
                  ? "bg-slate-800/50 text-slate-600 cursor-default border border-white/5"
                  : canClaim
                  ? "text-[#1A1000] hover:brightness-110 active:scale-95 cursor-pointer"
                  : "bg-slate-800/50 text-slate-600 cursor-not-allowed border border-white/5"
              }`}
              style={{
                clipPath: BTN_CLIP,
                minWidth: canClaim ? 96 : 52,
                background: canClaim ? "linear-gradient(180deg, #FFDF7E 0%, #FFC531 45%, #E8A812 100%)" : undefined,
                boxShadow: canClaim ? "0 0 22px rgba(255,197,49,0.4), inset 0 1px 0 rgba(255,255,255,0.5)" : undefined,
              }}
            >
              {isClaiming
                ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                : isClaimed
                ? <Check className="w-4 h-4" />
                : canClaim
                ? <><Gift className="w-4 h-4" /> Coletar</>
                : <Lock className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MissionsScreen({ onBack }: MissionsScreenProps) {
  const { t } = useLanguage()
  const { coins, addCoins, addFP, collection, skipTickets, addSkipTickets } = useGame()

  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "special">("daily")
  const [claimingId, setClaimingId] = useState<string | null>(null)
  // ── claimed_missions agora armazena {dayKey, weekKey} para resetar por data ──
  const [claimedMissions, setClaimedMissions] = useState<ClaimedMap>(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw = localStorage.getItem("claimed_missions")
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      // Migração: array antigo → objeto com metadado de data
      if (Array.isArray(parsed)) {
        const obj: ClaimedMap = {}
        parsed.forEach((id: string) => {
          obj[id] = { dayKey: getDayKey(), weekKey: getWeekKey() }
        })
        return obj
      }
      return parsed as ClaimedMap
    } catch { return {} }
  })

  useEffect(() => {
    try { localStorage.setItem("claimed_missions", JSON.stringify(claimedMissions)) } catch {}
  }, [claimedMissions])

  // Verifica se um claim ainda é válido para o dia/semana atual
  const isMissionClaimed = useCallback((id: string, type: "daily" | "weekly" | "special"): boolean => {
    const entry = claimedMissions[id]
    if (!entry) return false
    if (type === "daily")   return entry.dayKey  === getDayKey()
    if (type === "weekly")  return entry.weekKey === getWeekKey()
    return true // special nunca reseta
  }, [claimedMissions])

  const [dailyTarget, setDailyTarget]   = useState(getNextMidnightUTC)
  const [weeklyTarget, setWeeklyTarget] = useState(getNextMondayMidnightUTC)
  const [eventTarget]  = useState(getEventEndTimestamp)

  // Renova os alvos dos timers quando o reset acontece (evita countdown travado em 00:00:00)
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      if (now >= dailyTarget)  setDailyTarget(getNextMidnightUTC())
      if (now >= weeklyTarget) setWeeklyTarget(getNextMondayMidnightUTC())
    }, 1000)
    return () => clearInterval(id)
  }, [dailyTarget, weeklyTarget])

  const totalCards = collection?.length || 0

  // ── Lê progresso real do tracker ────────────────────────────────────────────
  const [trackedProgress, setTrackedProgress] = useState({
    gachaToday:  0,
    gachaWeek:   0,
    winsToday:   0,
    winsWeek:    0,
    winsTotal:   0,
    duelsToday:  0,
    duelsWeek:   0,
    srTotal:     0,
    cardsToday:  0,
    loginToday:  false,
    deckEditWeek: false,
  })

  // Atualiza progresso quando a tela abre e a cada 3s
  useEffect(() => {
    // Marca login ao abrir missões
    trackDailyLogin()

    const refresh = () => setTrackedProgress({
      gachaToday:   getMissionProgress.gachaToday(),
      gachaWeek:    getMissionProgress.gachaWeek(),
      winsToday:    getMissionProgress.winsToday(),
      winsWeek:     getMissionProgress.winsWeek(),
      winsTotal:    getMissionProgress.winsTotal(),
      duelsToday:   getMissionProgress.duelsToday(),
      duelsWeek:    getMissionProgress.duelsWeek(),
      srTotal:      getMissionProgress.srTotal(),
      cardsToday:   getMissionProgress.cardsToday(),
      loginToday:   getMissionProgress.loginToday(),
      deckEditWeek: getMissionProgress.deckEditWeek(),
    })
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [])

  const allMissions: Mission[] = useMemo(() => {
    const g  = trackedProgress

    return [
      // ── Diárias ──
      {
        id: "daily-1",
        name: "Abertura Diária",
        description: "Abra 3 packs no gacha hoje",
        type: "daily", category: "gacha",
        icon: <Sparkles className="w-5 h-5" />,
        progress: Math.min(g.gachaToday, 3), maxProgress: 3,
        reward: { coins: 100 },
        completed: g.gachaToday >= 3, claimed: false,
      },
      {
        id: "daily-2",
        name: "Duelista Nato",
        description: "Vença 2 partidas no modo Batalha",
        type: "daily", category: "battle",
        icon: <Swords className="w-5 h-5" />,
        progress: Math.min(g.winsToday, 2), maxProgress: 2,
        reward: { coins: 150, fp: 20 },
        completed: g.winsToday >= 2, claimed: false,
      },
      {
        id: "daily-3",
        name: "Presença Diária",
        description: "Faça login no jogo",
        type: "daily", category: "general",
        icon: <Calendar className="w-5 h-5" />,
        progress: g.loginToday ? 1 : 0, maxProgress: 1,
        reward: { coins: 50 },
        completed: g.loginToday, claimed: false,
      },
      {
        id: "daily-4",
        name: "Colecionador Ativo",
        description: "Adicione 5 cartas à coleção hoje",
        type: "daily", category: "collection",
        icon: <BookOpen className="w-5 h-5" />,
        progress: Math.min(g.cardsToday, 5), maxProgress: 5,
        reward: { coins: 100, fp: 10 },
        completed: g.cardsToday >= 5, claimed: false,
      },
      {
        id: "daily-5",
        name: "Espírito de Luta",
        description: "Jogue 3 duelos hoje (vitória ou derrota)",
        type: "daily", category: "battle",
        icon: <Target className="w-5 h-5" />,
        progress: Math.min(g.duelsToday, 3), maxProgress: 3,
        reward: { coins: 120, fp: 15 },
        completed: g.duelsToday >= 3, claimed: false,
      },
      // ── Semanais ──
      {
        id: "weekly-1",
        name: "Mestre Gacha",
        description: "Abra 30 packs esta semana",
        type: "weekly", category: "gacha",
        icon: <Sparkles className="w-5 h-5" />,
        progress: Math.min(g.gachaWeek, 30), maxProgress: 30,
        reward: { coins: 500, fp: 100 },
        completed: g.gachaWeek >= 30, claimed: false,
      },
      {
        id: "weekly-2",
        name: "Guerreiro da Semana",
        description: "Vença 10 partidas esta semana",
        type: "weekly", category: "battle",
        icon: <Swords className="w-5 h-5" />,
        progress: Math.min(g.winsWeek, 10), maxProgress: 10,
        reward: { coins: 700, fp: 150 },
        completed: g.winsWeek >= 10, claimed: false,
      },
      {
        id: "weekly-3",
        name: "Maratona de Duelos",
        description: "Jogue 15 duelos esta semana",
        type: "weekly", category: "battle",
        icon: <Target className="w-5 h-5" />,
        progress: Math.min(g.duelsWeek, 15), maxProgress: 15,
        reward: { coins: 400, fp: 60 },
        completed: g.duelsWeek >= 15, claimed: false,
      },
      {
        id: "weekly-4",
        name: "Arquiteto de Decks",
        description: "Salve ou edite um deck esta semana",
        type: "weekly", category: "general",
        icon: <Users className="w-5 h-5" />,
        progress: g.deckEditWeek ? 1 : 0, maxProgress: 1,
        reward: { coins: 250, fp: 30 },
        completed: g.deckEditWeek, claimed: false,
      },
      // ── Especiais ──
      {
        id: "special-1",
        name: "Lançamento Especial",
        description: "Comemore o lançamento coletando 50 cartas!",
        type: "special", category: "collection",
        icon: <Flame className="w-5 h-5" />,
        progress: Math.min(totalCards, 50), maxProgress: 50,
        reward: { coins: 1000, fp: 500 },
        completed: totalCards >= 50, claimed: false,
      },
      {
        id: "special-2",
        name: "Caçador de Raridades",
        description: "Obtenha 10 cartas SR ou superiores no gacha",
        type: "special", category: "gacha",
        icon: <Star className="w-5 h-5" />,
        progress: Math.min(g.srTotal, 10), maxProgress: 10,
        reward: { coins: 800, fp: 300 },
        completed: g.srTotal >= 10, claimed: false,
      },
      {
        id: "special-3",
        name: "Campeão Lendário",
        description: "Vença 25 partidas no total",
        type: "special", category: "battle",
        icon: <Trophy className="w-5 h-5" />,
        progress: Math.min(g.winsTotal, 25), maxProgress: 25,
        reward: { coins: 1500, fp: 400 },
        completed: g.winsTotal >= 25, claimed: false,
      },
    ]
  }, [trackedProgress, totalCards])

  // ── Bônus de conclusão com reset diário/semanal ─────────────────────────────
  const [bonusClaimed, setBonusClaimed] = useState<ClaimedMap>(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw = localStorage.getItem("claimed_bonus")
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const obj: ClaimedMap = {}
        parsed.forEach((id: string) => { obj[id] = { dayKey: getDayKey(), weekKey: getWeekKey() } })
        return obj
      }
      return parsed as ClaimedMap
    } catch { return {} }
  })

  useEffect(() => {
    try { localStorage.setItem("claimed_bonus", JSON.stringify(bonusClaimed)) } catch {}
  }, [bonusClaimed])

  // Bonus diário reseta por dia, semanal por semana, especial nunca
  const isBonusClaimed = (tab: string) => {
    const entry = bonusClaimed[tab]
    if (!entry) return false
    if (tab === "daily")   return entry.dayKey  === getDayKey()
    if (tab === "weekly")  return entry.weekKey === getWeekKey()
    return !!entry.dayKey // special: uma vez por evento
  }

  const bonusAlreadyClaimed = isBonusClaimed(activeTab)
  // bonusCoins declarado aqui — antes de handleClaimBonus que o usa no deps array
  const bonusCoins = activeTab === "daily" ? 200 : activeTab === "weekly" ? 1000 : 2000
  // Só o bônus das missões DIÁRIAS entrega Skip Tíquete
  const bonusTickets = activeTab === "daily" ? SKIP_TICKET_DAILY_BONUS : 0

  // ── Toast de recompensa coletada ────────────────────────────────────────────
  const [rewardToast, setRewardToast] = useState<{ coins: number; fp: number; tickets?: number; key: number } | null>(null)
  useEffect(() => {
    if (!rewardToast) return
    const id = setTimeout(() => setRewardToast(null), 2400)
    return () => clearTimeout(id)
  }, [rewardToast])

  const showRewardToast = useCallback((coinsGained: number, fpGained: number, ticketsGained = 0) => {
    if (coinsGained <= 0 && fpGained <= 0 && ticketsGained <= 0) return
    setRewardToast({ coins: coinsGained, fp: fpGained, tickets: ticketsGained, key: Date.now() })
  }, [])

  const handleClaimBonus = useCallback(() => {
    if (isBonusClaimed(activeTab)) return
    addCoins(bonusCoins)
    if (bonusTickets > 0) addSkipTickets(bonusTickets)
    showRewardToast(bonusCoins, 0, bonusTickets)
    setBonusClaimed(prev => ({
      ...prev,
      [activeTab]: { dayKey: getDayKey(), weekKey: getWeekKey() },
    }))
  }, [activeTab, bonusClaimed, bonusCoins, bonusTickets, addCoins, addSkipTickets, showRewardToast])

  // Coleta recompensa de uma missão individual (moedas + FP)
  const handleClaimReward = useCallback((id: string) => {
    if (claimingId !== null) return
    const mission = allMissions.find(m => m.id === id)
    if (!mission) return
    // isMissionClaimed respeita reset diário/semanal
    if (isMissionClaimed(id, mission.type)) return
    if (!mission.completed) return
    setClaimingId(id)
    setTimeout(() => {
      const coinsGained = mission.reward.coins ?? 0
      const fpGained    = mission.reward.fp ?? 0
      if (coinsGained > 0) addCoins(coinsGained)
      if (fpGained > 0)    addFP(fpGained)
      showRewardToast(coinsGained, fpGained)
      // Grava com metadado de data para reset automático
      setClaimedMissions(prev => ({
        ...prev,
        [id]: { dayKey: getDayKey(), weekKey: getWeekKey() },
      }))
      setClaimingId(null)
    }, 800)
  }, [allMissions, isMissionClaimed, claimingId, addCoins, addFP, showRewardToast])

  const filteredMissions = allMissions.filter(m => m.type === activeTab)

  const claimableAll = filteredMissions.filter(m => m.completed && !isMissionClaimed(m.id, m.type))

  const handleClaimAll = useCallback(() => {
    if (claimableAll.length === 0 || claimingId !== null) return
    let totalCoins = 0
    let totalFP    = 0
    const dayKey  = getDayKey()
    const weekKey = getWeekKey()
    const newClaimed = { ...claimedMissions }
    claimableAll.forEach(m => {
      newClaimed[m.id] = { dayKey, weekKey }
      totalCoins += m.reward.coins ?? 0
      totalFP    += m.reward.fp ?? 0
    })
    setClaimedMissions(newClaimed)
    if (totalCoins > 0) addCoins(totalCoins)
    if (totalFP > 0)    addFP(totalFP)
    showRewardToast(totalCoins, totalFP)
  }, [claimableAll, claimedMissions, claimingId, addCoins, addFP, showRewardToast])

  const stats = useMemo(() => {
    const count = (type: string) => ({
      total:     allMissions.filter(m => m.type === type).length,
      // Missão conta como completa se concluída OU já coletada (para o dia/semana atual)
      completed: allMissions.filter(m => m.type === type && (m.completed || isMissionClaimed(m.id, m.type as any))).length,
    })
    return { daily: count("daily"), weekly: count("weekly"), special: count("special") }
  }, [allMissions, isMissionClaimed])

  const TABS = [
    { id: "daily",   label: "Diárias",   tabIcon: <Target   className="w-5 h-5" />, color: "cyan"   as const, stats: stats.daily,   target: dailyTarget,  timerLabel: "Reset Diário"  },
    { id: "weekly",  label: "Semanais",  tabIcon: <Calendar className="w-5 h-5" />, color: "purple" as const, stats: stats.weekly,  target: weeklyTarget, timerLabel: "Reset Semanal" },
    { id: "special", label: "Especiais", tabIcon: <Flame    className="w-5 h-5" />, color: "amber"  as const, stats: stats.special, target: eventTarget,  timerLabel: "Fim do Evento" },
  ]

  const activeTabData = TABS.find(t => t.id === activeTab)!

  const tabColors = {
    cyan:   { active: "border-cyan-500/50 bg-cyan-950/40",   text: "text-cyan-300",   bar: "from-cyan-400 to-teal-300",     glow: "rgba(6,182,212,0.15)",   orb: "rgba(6,182,212,0.15)"  },
    purple: { active: "border-purple-500/50 bg-purple-950/40", text: "text-purple-300", bar: "from-purple-400 to-pink-400",   glow: "rgba(168,85,247,0.15)",  orb: "rgba(168,85,247,0.15)" },
    amber:  { active: "border-amber-500/50 bg-amber-950/40", text: "text-amber-300",  bar: "from-amber-400 to-yellow-300", glow: "rgba(245,158,11,0.15)",  orb: "rgba(245,158,11,0.15)" },
  }

  const activeColors = tabColors[activeTabData.color]

  const allComplete = filteredMissions.length > 0 && filteredMissions.every(m => isMissionClaimed(m.id, m.type))

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#070C18] text-slate-200">

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-4px);  }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        @keyframes claim-pulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50%       { opacity: 0.25; transform: scale(1.008); }
        }
        @keyframes spark {
          0%   { transform: translateY(0);     opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(-46px); opacity: 0; }
        }
        @keyframes toast-in {
          0%   { transform: translate(-50%, 16px); opacity: 0; }
          12%  { transform: translate(-50%, 0);    opacity: 1; }
          85%  { transform: translate(-50%, 0);    opacity: 1; }
          100% { transform: translate(-50%, -8px); opacity: 0; }
        }
        .animate-shimmer { animation: shimmer 2.5s linear infinite; }
        .animate-float   { animation: float 3s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>

      {/* Layered background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse 80% 50% at 20% -10%, ${activeColors.orb} 0%, transparent 60%)`
        }} />
        <div className="absolute inset-0 transition-all duration-1000" style={{
          background: `radial-gradient(ellipse 60% 40% at 80% 110%, ${activeColors.orb} 0%, transparent 60%)`
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen w-full max-w-2xl mx-auto">

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 px-4 pt-4 pb-2">
          <div className="flex items-center justify-between bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <button onClick={onBack} className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold hidden sm:block">Voltar</span>
            </button>

            <div className="flex items-center gap-2.5">
              <Target className="w-5 h-5 text-cyan-400" />
              <h1 className="text-lg font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
                MISSÕES
              </h1>
            </div>

            {/* Coin balance */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-white/10 px-3 py-1.5 rounded-xl">
              <CoinIcon size={18} />
              <span className="text-white font-bold text-sm tabular-nums">{coins?.toLocaleString() ?? "0"}</span>
            </div>

            {/* Skip Tíquetes em posse */}
            {skipTickets > 0 && (
              <div
                className="flex items-center gap-2 bg-slate-950/80 border border-sky-400/25 px-3 py-1.5 rounded-xl"
                title={SKIP_TICKET_NAME}
              >
                <SkipTicketIcon size={20} />
                <span className="text-sky-200 font-bold text-sm tabular-nums">{skipTickets}</span>
              </div>
            )}
          </div>
        </header>

        {/* ── Main ── */}
        <main className="flex-1 overflow-y-auto px-4 pb-12 pt-3">
          <div className="flex flex-col gap-4">

            {/* ── Tabs ── */}
            <div className="grid grid-cols-3 gap-2.5">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id
                const pct = tab.stats.total > 0 ? (tab.stats.completed / tab.stats.total) * 100 : 0
                const c = tabColors[tab.color]
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative flex flex-col border p-3.5 transition-all duration-300 overflow-hidden ${
                      isActive ? c.active : "bg-slate-900/40 border-white/[0.06] hover:border-white/10"
                    }`}
                    style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)" }}
                  >
                    {isActive && (
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className={isActive ? c.text : "text-slate-600"}>{tab.tabIcon}</span>
                      <span className={`text-[9px] font-black font-mono tabular-nums px-1.5 py-0.5 border ${
                        isActive ? `${c.text} border-current bg-white/5` : "text-slate-600 border-slate-700/50"
                      }`} style={{ clipPath: "polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)" }}>
                        {tab.stats.completed}/{tab.stats.total}
                      </span>
                    </div>
                    <span className={`text-xs font-black uppercase tracking-wider text-left mb-2.5 ${isActive ? "text-white" : "text-slate-500"}`}>
                      {tab.label}
                    </span>
                    <div className="w-full h-1 bg-slate-950/80 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-700 bg-gradient-to-r ${isActive ? c.bar : "bg-slate-700/60"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ── Timer Banner + Coletar Tudo ── */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center justify-between bg-slate-900/50 border border-white/[0.07] rounded-xl px-4 py-2.5 flex-1">
                <p className="text-slate-500 text-[11px] font-medium hidden sm:block">Tempo restante</p>
                <CountdownTimer targetMs={activeTabData.target} label={activeTabData.timerLabel} color={activeTabData.color} />
              </div>
              <button
                onClick={handleClaimAll}
                disabled={claimableAll.length === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap hover:brightness-110 active:scale-95"
                style={{
                  clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
                  background: claimableAll.length > 0
                    ? "linear-gradient(180deg,#34d399,#10b981 55%,#059669)"
                    : "rgba(255,255,255,0.04)",
                  color: claimableAll.length > 0 ? "#03170e" : "#334155",
                  boxShadow: claimableAll.length > 0 ? "0 0 18px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.4)" : "none",
                  border: "none",
                  cursor: claimableAll.length > 0 ? "pointer" : "not-allowed",
                  opacity: claimableAll.length > 0 ? 1 : 0.5,
                }}
              >
                <Check className="w-3.5 h-3.5" /> Coletar Tudo{claimableAll.length > 0 ? ` (${claimableAll.length})` : ""}
              </button>
            </div>

            {/* ── Mission List ── */}
            <div className="flex flex-col gap-3">
              {filteredMissions.map(mission => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  isClaimed={isMissionClaimed(mission.id, mission.type)}
                  isClaiming={claimingId === mission.id}
                  tabColor={activeTabData.color}
                  onClaim={() => handleClaimReward(mission.id)}
                />
              ))}
            </div>

            {/* ── Completion Bonus ── */}
            <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-500 ${
              allComplete
                ? "border-amber-500/50 bg-gradient-to-br from-amber-950/60 to-slate-900/60 shadow-[0_0_30px_rgba(245,158,11,0.15)]"
                : "border-white/[0.07] bg-slate-900/40"
            }`}>
              {allComplete && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                    allComplete ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-slate-800/60 border-white/5 text-slate-600"
                  }`}>
                    {allComplete ? <Crown className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm ${allComplete ? "text-amber-200" : "text-slate-400"}`}>
                      Bônus de Conclusão
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {allComplete ? "Parabéns! Colete seu bônus." : "Complete todas as missões para liberar."}
                    </p>
                    {bonusTickets > 0 && (
                      <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-300/80">
                        <SkipTicketIcon size={16} />
                        Inclui {bonusTickets} {SKIP_TICKET_NAME} — pula um duelo de Evento
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {allComplete ? (
                    <button
                      onClick={!bonusAlreadyClaimed ? handleClaimBonus : undefined}
                      disabled={bonusAlreadyClaimed}
                      className={`flex items-center gap-2 border font-bold text-sm px-4 py-2 rounded-xl transition-all ${
                        bonusAlreadyClaimed
                          ? "bg-slate-800/60 border-white/5 text-slate-500 cursor-default"
                          : "bg-gradient-to-b from-amber-400 to-amber-600 border-amber-300/30 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_28px_rgba(245,158,11,0.6)] cursor-pointer"
                      }`}
                    >
                      {bonusAlreadyClaimed ? (
                        <><Check className="w-4 h-4 text-emerald-400" /> Coletado</>
                      ) : (
                        <>
                          <CoinIcon size={16} /> +{bonusCoins.toLocaleString()}
                          {bonusTickets > 0 && (
                            <>
                              <span aria-hidden className="mx-0.5 h-4 w-px bg-white/30" />
                              <SkipTicketIcon size={18} /> +{bonusTickets}
                            </>
                          )}
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 opacity-40">
                      <CoinIcon size={16} />
                      <span className="text-slate-400 font-black">+{bonusCoins.toLocaleString()}</span>
                      {bonusTickets > 0 && (
                        <>
                          <SkipTicketIcon size={18} />
                          <span className="text-slate-400 font-black">+{bonusTickets}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* ── Toast de recompensa ── */}
      {rewardToast && (
        <div
          key={rewardToast.key}
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border border-amber-400/40 bg-slate-900/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_24px_rgba(255,197,49,0.2)]"
          style={{ animation: "toast-in 2.4s ease forwards" }}
        >
          <Gift className="w-5 h-5 text-[#FFC531]" />
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Recompensa coletada</span>
            {rewardToast.coins > 0 && (
              <span className="flex items-center gap-1 text-sm font-black text-amber-300 tabular-nums">
                <CoinIcon size={15} /> +{rewardToast.coins.toLocaleString()}
              </span>
            )}
            {rewardToast.fp > 0 && (
              <span className="flex items-center gap-1 text-sm font-black text-purple-300 tabular-nums">
                <Star className="w-3.5 h-3.5" /> +{rewardToast.fp} FP
              </span>
            )}
            {(rewardToast.tickets ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-sm font-black text-sky-300 tabular-nums">
                <SkipTicketIcon size={18} /> +{rewardToast.tickets}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
