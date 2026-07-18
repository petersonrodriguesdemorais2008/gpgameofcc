"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { useGame, type Card, CARD_BACK_IMAGE } from "@/contexts/game-context"
import {
  ArrowLeft, Crown, Star, Gift, Check, Lock, Zap,
  Calendar, RefreshCw, ChevronRight,
  Sparkles, Shield, Target, Trophy, X,
  MapPin, Package, Award, Frame, PartyPopper, Gem, Flag, Dices, AlertTriangle, Unlock, Clock,
} from "lucide-react"
import {
  getMissionProgress,
  trackDailyLogin,
  trackGachaPull,
} from "@/lib/mission-tracker"

// ─── Types ───────────────────────────────────────────────────────────────────

interface PassMission {
  id: string
  title: string
  description: string
  type: "daily" | "weekly" | "limited"
  points: number
  progress: number
  goal: number
  completed: boolean
  claimed: boolean
  expiresIn?: string
}

interface PassReward {
  level: number
  type: "coins" | "card_pack" | "gacha_coin" | "avatar_frame" | "title" | "exclusive_card" | "playmat"
  label: string
  amount?: number
  rarity?: "R" | "SR" | "UR" | "LR"
  isPremium: boolean
}

interface GearPassScreenProps {
  onBack: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Progressive level cost ────────────────────────────────────────────────────
// Custo para passar do nível N-1 para o nível N: começa em 25 pts, +5 a cada nível
// ptsForLevel(1)=25, ptsForLevel(2)=30, ptsForLevel(3)=35, ...
const ptsForLevel = (lvl: number): number => 20 + lvl * 5

// Pontos cumulativos para ALCANÇAR o nível N (chegar ao nível N)
// Σ(i=1..N) of (20 + 5i) = 20N + 5·N·(N+1)/2
const totalPtsToReachLevel = (lvl: number): number =>
  lvl <= 0 ? 0 : 20 * lvl + Math.round(5 * lvl * (lvl + 1) / 2)

// Nível calculado a partir dos pontos totais acumulados
const levelFromPts = (pts: number): number => {
  let lvl = 0
  while (lvl < MAX_LEVELS && pts >= totalPtsToReachLevel(lvl + 1)) lvl++
  return lvl
}
const MAX_LEVELS = 100
const VISIBLE = 7          // Número de níveis visíveis por vez na trilha
// Níveis-marco — recebem coluna mais larga e destaque dourado na trilha
const MILESTONE_LEVELS = new Set([10, 25, 50, 75, 100])
const NORMAL_COL_WIDTH    = 112  // 96px coluna + 16px gap (aumentado ~17% pra trilha maior)
// Marcos usam a MESMA largura/altura que colunas normais — só mudam de cor/borda.
// Antes, marcos tinham boxSz=60 e largura=112 (vs 54/96 normal); essa diferença
// dimensional entre tipos de coluna causava uma instabilidade visual perceptível
// ao arrastar passando por elas (mais notável a partir do 2º marco em diante,
// nível 25). Igualar as dimensões elimina a causa raiz por completo.
const MILESTONE_COL_WIDTH = NORMAL_COL_WIDTH
const PREMIUM_PRICE = "R$22,99"
const SEASON_DURATION_DAYS = 30  // duração total da temporada — usado pro countdown real
const STRIPE_PAYMENT_URL = "https://buy.stripe.com/aFafZj1lMfdqdRV5Pk4gg01"

const LS_PASS_KEY = "gpgame_gear_pass"
const LS_MISSIONS_KEY = "gpgame_pass_missions"

// ─── Reward helpers ───────────────────────────────────────────────────────────

function buildRewards(): PassReward[] {
  const rewards: PassReward[] = []

  for (let lvl = 1; lvl <= MAX_LEVELS; lvl++) {
    // Common reward every level
    if (lvl % 10 === 0) {
      // milestone common
      rewards.push({
        level: lvl,
        type: "card_pack",
        label: "Pack Raro",
        rarity: lvl >= 80 ? "SR" : "R",
        isPremium: false,
      })
    } else if (lvl % 5 === 0) {
      rewards.push({
        level: lvl,
        type: "gacha_coin",
        label: "Gacha Coin",
        amount: 1,
        isPremium: false,
      })
    } else {
      rewards.push({
        level: lvl,
        type: "coins",
        label: "Coins",
        amount: lvl <= 30 ? 100 : lvl <= 60 ? 150 : 200,
        isPremium: false,
      })
    }

    // Premium reward every level
    if (lvl === 100) {
      rewards.push({
        level: lvl,
        type: "exclusive_card",
        label: "Carta Exclusiva LR",
        rarity: "LR",
        isPremium: true,
      })
    } else if (lvl % 25 === 0) {
      rewards.push({
        level: lvl,
        type: "playmat",
        label: "Playmat Exclusivo",
        isPremium: true,
      })
    } else if (lvl % 10 === 0) {
      rewards.push({
        level: lvl,
        type: "card_pack",
        label: "Pack Premium",
        rarity: lvl >= 80 ? "UR" : "SR",
        isPremium: true,
      })
    } else if (lvl % 5 === 0) {
      rewards.push({
        level: lvl,
        type: "gacha_coin",
        label: "Gacha Coin x2",
        amount: 2,
        isPremium: true,
      })
    } else {
      rewards.push({
        level: lvl,
        type: "coins",
        label: "Coins",
        amount: lvl <= 30 ? 300 : lvl <= 60 ? 450 : 600,
        isPremium: true,
      })
    }
  }

  return rewards
}

const ALL_REWARDS = buildRewards()

// ─── Build missions from live tracker data ────────────────────────────────────

function buildMissions(): PassMission[] {
  const g = {
    gachaToday:   getMissionProgress.gachaToday(),
    gachaWeek:    getMissionProgress.gachaWeek(),
    gachaTotal:   getMissionProgress.gachaTotal(),
    winsToday:    getMissionProgress.winsToday(),
    winsWeek:     getMissionProgress.winsWeek(),
    winsTotal:    getMissionProgress.winsTotal(),
    duelsToday:   getMissionProgress.duelsToday(),
    duelsWeek:    getMissionProgress.duelsWeek(),
    duelsTotal:   getMissionProgress.duelsTotal(),
    srTotal:      getMissionProgress.srTotal(),
    loginToday:   getMissionProgress.loginToday(),
    deckEditWeek: getMissionProgress.deckEditWeek(),
  }

  return [
    // ── Diárias ──
    {
      id: "daily_duel_1",
      title: "Duelista Diário",
      description: "Vença 1 duelo no modo Bot",
      type: "daily",
      points: 50,
      progress: Math.min(g.winsToday, 1),
      goal: 1,
      completed: g.winsToday >= 1,
      claimed: false,
    },
    {
      id: "daily_duel_3",
      title: "Em Chamas",
      description: "Dispute 3 duelos (vitória ou derrota)",
      type: "daily",
      points: 50,
      progress: Math.min(g.duelsToday, 3),
      goal: 3,
      completed: g.duelsToday >= 3,
      claimed: false,
    },
    {
      id: "daily_gacha",
      title: "Fortuna Diária",
      description: "Faça 1 pull no Gacha",
      type: "daily",
      points: 50,
      progress: Math.min(g.gachaToday, 1),
      goal: 1,
      completed: g.gachaToday >= 1,
      claimed: false,
    },
    {
      id: "daily_login",
      title: "Presença Garantida",
      description: "Colete o Bônus Diário",
      type: "daily",
      points: 30,
      progress: g.loginToday ? 1 : 0,
      goal: 1,
      completed: g.loginToday,
      claimed: false,
    },
    {
      id: "daily_wins_3",
      title: "Domínio Total",
      description: "Vença 3 duelos hoje",
      type: "daily",
      points: 80,
      progress: Math.min(g.winsToday, 3),
      goal: 3,
      completed: g.winsToday >= 3,
      claimed: false,
    },
    {
      id: "daily_gacha_3",
      title: "Sortudo do Dia",
      description: "Faça 3 pulls no Gacha hoje",
      type: "daily",
      points: 60,
      progress: Math.min(g.gachaToday, 3),
      goal: 3,
      completed: g.gachaToday >= 3,
      claimed: false,
    },
    {
      id: "daily_deck_edit",
      title: "Ajuste Fino",
      description: "Edite um deck hoje",
      type: "daily",
      points: 40,
      progress: g.deckEditWeek >= 1 ? 1 : 0,
      goal: 1,
      completed: g.deckEditWeek >= 1,
      claimed: false,
    },
    {
      id: "daily_duels_5",
      title: "Maratonista",
      description: "Dispute 5 duelos hoje (vitória ou derrota)",
      type: "daily",
      points: 70,
      progress: Math.min(g.duelsToday, 5),
      goal: 5,
      completed: g.duelsToday >= 5,
      claimed: false,
    },
    // ── Semanais ──
    {
      id: "weekly_wins_5",
      title: "Semana de Vitórias",
      description: "Vença 5 duelos nesta semana",
      type: "weekly",
      points: 150,
      progress: Math.min(g.winsWeek, 5),
      goal: 5,
      completed: g.winsWeek >= 5,
      claimed: false,
    },
    {
      id: "weekly_gacha_5",
      title: "Colecionador",
      description: "Faça 5 pulls no Gacha esta semana",
      type: "weekly",
      points: 150,
      progress: Math.min(g.gachaWeek, 5),
      goal: 5,
      completed: g.gachaWeek >= 5,
      claimed: false,
    },
    {
      id: "weekly_deck",
      title: "Mestre da Estratégia",
      description: "Edite ou crie um deck esta semana",
      type: "weekly",
      points: 100,
      progress: g.deckEditWeek ? 1 : 0,
      goal: 1,
      completed: g.deckEditWeek,
      claimed: false,
    },
    {
      id: "weekly_duel_10",
      title: "Veterano da Arena",
      description: "Dispute 10 duelos esta semana",
      type: "weekly",
      points: 200,
      progress: Math.min(g.duelsWeek, 10),
      goal: 10,
      completed: g.duelsWeek >= 10,
      claimed: false,
    },
    // ── Limitadas ──
    {
      id: "limited_wins_20",
      title: "Desafio do Passe",
      description: "Vença 20 duelos durante este Passe",
      type: "limited",
      points: 300,
      progress: Math.min(g.winsTotal, 20),
      goal: 20,
      completed: g.winsTotal >= 20,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_gacha_20",
      title: "Gacha Lendário",
      description: "Faça 20 pulls no Gacha durante este Passe",
      type: "limited",
      points: 300,
      progress: Math.min(g.gachaTotal, 20),
      goal: 20,
      completed: g.gachaTotal >= 20,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_sr_card",
      title: "Caçador de Raridades",
      description: "Obtenha 1 carta SR ou superior",
      type: "limited",
      points: 200,
      progress: Math.min(g.srTotal, 1),
      goal: 1,
      completed: g.srTotal >= 1,
      claimed: false,
      expiresIn: "29d",
    },
    // ── Novas limitadas ──
    {
      id: "limited_wins_50",
      title: "Lenda da Arena",
      description: "Vença 50 duelos durante este Passe",
      type: "limited",
      points: 500,
      progress: Math.min(g.winsTotal, 50),
      goal: 50,
      completed: g.winsTotal >= 50,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_duels_100",
      title: "Centenário",
      description: "Dispute 100 duelos durante este Passe",
      type: "limited",
      points: 400,
      progress: Math.min(g.duelsTotal, 100),
      goal: 100,
      completed: g.duelsTotal >= 100,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_gacha_50",
      title: "Viciado no Gacha",
      description: "Faça 50 pulls no Gacha durante este Passe",
      type: "limited",
      points: 500,
      progress: Math.min(g.gachaTotal, 50),
      goal: 50,
      completed: g.gachaTotal >= 50,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_sr_5",
      title: "Colecionador de Élite",
      description: "Obtenha 5 cartas SR ou superior",
      type: "limited",
      points: 400,
      progress: Math.min(g.srTotal, 5),
      goal: 5,
      completed: g.srTotal >= 5,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_wins_100",
      title: "O Grande Campeão",
      description: "Vença 100 duelos durante este Passe",
      type: "limited",
      points: 750,
      progress: Math.min(g.winsTotal, 100),
      goal: 100,
      completed: g.winsTotal >= 100,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_deck_3",
      title: "Arquiteto de Decks",
      description: "Edite ou crie decks 3 vezes neste Passe",
      type: "limited",
      points: 250,
      progress: Math.min(g.deckEditWeek * 1, 3),
      goal: 3,
      completed: (g.deckEditWeek * 1) >= 3,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_duels_50",
      title: "Veterano da Arena",
      description: "Dispute 50 duelos durante este Passe",
      type: "limited",
      points: 350,
      progress: Math.min(g.duelsTotal, 50),
      goal: 50,
      completed: g.duelsTotal >= 50,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_wins_30",
      title: "Invicto",
      description: "Vença 30 duelos durante este Passe",
      type: "limited",
      points: 350,
      progress: Math.min(g.winsTotal, 30),
      goal: 30,
      completed: g.winsTotal >= 30,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_gacha_10",
      title: "Sortudo do Passe",
      description: "Faça 10 pulls no Gacha durante este Passe",
      type: "limited",
      points: 200,
      progress: Math.min(g.gachaTotal, 10),
      goal: 10,
      completed: g.gachaTotal >= 10,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_sr_10",
      title: "Mestre das Raridades",
      description: "Obtenha 10 cartas SR ou superior neste Passe",
      type: "limited",
      points: 600,
      progress: Math.min(g.srTotal, 10),
      goal: 10,
      completed: g.srTotal >= 10,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_deck_10",
      title: "Mestre das Estratégias",
      description: "Edite ou crie decks 10 vezes neste Passe",
      type: "limited",
      points: 450,
      progress: Math.min(g.deckEditWeek * 1, 10),
      goal: 10,
      completed: (g.deckEditWeek * 1) >= 10,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_duels_200",
      title: "Gladiador Imparável",
      description: "Dispute 200 duelos durante este Passe",
      type: "limited",
      points: 700,
      progress: Math.min(g.duelsTotal, 200),
      goal: 200,
      completed: g.duelsTotal >= 200,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_wins_75",
      title: "Conquistador",
      description: "Vença 75 duelos durante este Passe",
      type: "limited",
      points: 550,
      progress: Math.min(g.winsTotal, 75),
      goal: 75,
      completed: g.winsTotal >= 75,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_gacha_30",
      title: "Caçador de Cartas",
      description: "Faça 30 pulls no Gacha durante este Passe",
      type: "limited",
      points: 350,
      progress: Math.min(g.gachaTotal, 30),
      goal: 30,
      completed: g.gachaTotal >= 30,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_gacha_100",
      title: "Lendário do Gacha",
      description: "Faça 100 pulls no Gacha durante este Passe",
      type: "limited",
      points: 900,
      progress: Math.min(g.gachaTotal, 100),
      goal: 100,
      completed: g.gachaTotal >= 100,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_sr_3",
      title: "Garimpeiro",
      description: "Obtenha 3 cartas SR ou superior neste Passe",
      type: "limited",
      points: 300,
      progress: Math.min(g.srTotal, 3),
      goal: 3,
      completed: g.srTotal >= 3,
      claimed: false,
      expiresIn: "29d",
    },
    {
      id: "limited_deck_5",
      title: "Estrategista",
      description: "Edite ou crie decks 5 vezes neste Passe",
      type: "limited",
      points: 300,
      progress: Math.min(g.deckEditWeek * 1, 5),
      goal: 5,
      completed: (g.deckEditWeek * 1) >= 5,
      claimed: false,
      expiresIn: "29d",
    },
  ]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RewardIcon({ reward, small }: { reward: PassReward; small?: boolean }) {
  const iconSize = small ? 24 : 28
  const rarityColor: Record<string, string> = {
    R: "#60a5fa", SR: "#c084fc", UR: "#fbbf24", LR: "#f87171",
  }

  if (reward.type === "coins") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <img src="/images/icons/gacha-coin.png" alt="Coins"
          style={{ width: small ? 26 : 32, height: small ? 26 : 32, objectFit: "contain" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
        {reward.amount && (
          <span style={{ fontSize: 9, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>
            +{reward.amount}
          </span>
        )}
      </div>
    )
  }
  if (reward.type === "gacha_coin")
    return <Dices size={iconSize} color="#fbbf24" strokeWidth={2} style={{ filter: "drop-shadow(0 0 4px rgba(251,191,36,0.45))" }} />
  if (reward.type === "card_pack") {
    const rc = reward.rarity ? rarityColor[reward.rarity] : "#94a3b8"
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <Package size={iconSize} color={rc} strokeWidth={2} style={{ filter: `drop-shadow(0 0 4px ${rc}70)` }} />
        {reward.rarity && <div style={{ color: rc, fontSize: 7.5, fontWeight: 900, marginTop: -1, letterSpacing: "0.02em" }}>{reward.rarity}</div>}
      </div>
    )
  }
  if (reward.type === "exclusive_card")
    return <Gem size={iconSize} color="#f87171" strokeWidth={2} style={{ filter: "drop-shadow(0 0 4px rgba(248,113,113,0.45))" }} />
  if (reward.type === "playmat")
    return <Frame size={iconSize} color="#22d3ee" strokeWidth={2} style={{ filter: "drop-shadow(0 0 4px rgba(34,211,238,0.40))" }} />
  if (reward.type === "avatar_frame")
    return <Award size={iconSize} color="#c084fc" strokeWidth={2} style={{ filter: "drop-shadow(0 0 4px rgba(192,132,252,0.40))" }} />
  if (reward.type === "title")
    return <Sparkles size={iconSize} color="#fbbf24" strokeWidth={2} style={{ filter: "drop-shadow(0 0 4px rgba(251,191,36,0.40))" }} />
  return <Star size={iconSize - 4} color="#94a3b8" />
}

function MissionCard({
  mission,
  onClaim,
  cascadeDelay,
}: {
  mission: PassMission
  onClaim: (id: string) => void
  cascadeDelay?: number | null
}) {
  const typeColors = {
    daily: { bg: "rgba(6,182,212,0.10)", border: "rgba(6,182,212,0.25)", label: "Diária", labelColor: "#22d3ee" },
    weekly: { bg: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.25)", label: "Semanal", labelColor: "#c084fc" },
    limited: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.22)", label: "Limitada", labelColor: "#fbbf24" },
  }
  const col = typeColors[mission.type]
  const pct = Math.min(100, Math.round((mission.progress / mission.goal) * 100))
  // "Pronto pra coletar" — mesmo estado que dá glow pulsante na trilha
  const readyToClaim = mission.completed && !mission.claimed
  const isCascading = cascadeDelay !== null && cascadeDelay !== undefined

  return (
    <div style={{
      background: readyToClaim ? "rgba(34,197,94,0.08)" : col.bg,
      border: `1.5px solid ${readyToClaim ? "rgba(34,197,94,0.55)" : col.border}`,
      borderRadius: 16,
      padding: "13px 15px",
      display: "flex",
      flexDirection: "column",
      gap: 9,
      position: "relative",
      // Cascata tem prioridade (flash sequencial); senão, o pulso normal de "pronto pra coletar"
      animation: isCascading
        ? `cascadeFlash 0.5s ease ${cascadeDelay}ms`
        : readyToClaim ? "claimPulseGreen 2s ease-in-out infinite" : "none",
      transition: "background 0.3s, border-color 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 8.5, fontWeight: 800, color: col.labelColor,
              background: `${col.border}`, padding: "2.5px 7px", borderRadius: 20,
              letterSpacing: "0.09em", textTransform: "uppercase", lineHeight: 1,
            }}>{col.label}</span>
            {mission.expiresIn && (
              <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700, display:"flex", alignItems:"center", gap:2 }}>
                <Calendar size={9} /> {mission.expiresIn}
              </span>
            )}
            {readyToClaim && (
              <span style={{
                fontSize: 9, fontWeight: 900, color: "#4ade80",
                background: "rgba(34,197,94,0.16)", padding: "2.5px 8px", borderRadius: 20,
                letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 3, lineHeight: 1,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: "#4ade80", boxShadow: "0 0 6px rgba(74,222,128,0.9)" }} />
                Pronto!
              </span>
            )}
          </div>
          <p style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 13, marginBottom: 3, letterSpacing: "-0.005em" }}>{mission.title}</p>
          <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.4 }}>{mission.description}</p>
        </div>

        {/* Points badge — ganha glow verde quando pronta */}
        <div style={{
          background: readyToClaim ? "rgba(34,197,94,0.14)" : "rgba(251,191,36,0.12)",
          border: `1px solid ${readyToClaim ? "rgba(34,197,94,0.35)" : "rgba(251,191,36,0.25)"}`,
          borderRadius: 11, padding: "5px 11px", textAlign: "center", flexShrink: 0,
          boxShadow: readyToClaim ? "0 0 12px rgba(34,197,94,0.25)" : "none",
        }}>
          <div style={{ color: readyToClaim ? "#4ade80" : "#fbbf24", fontWeight: 900, fontSize: 15, lineHeight: 1, fontFamily: "monospace" }}>+{mission.points}</div>
          <div style={{ color: readyToClaim ? "#16a34a" : "#d97706", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.04em" }}>PTS</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{
          height: 6, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 99, width: `${pct}%`,
            background: mission.completed
              ? "linear-gradient(90deg,#22c55e,#4ade80)"
              : `linear-gradient(90deg,${col.labelColor}80,${col.labelColor})`,
            transition: "width 0.5s ease",
            boxShadow: mission.completed ? "0 0 8px rgba(34,197,94,0.5)" : undefined,
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
          <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{mission.progress}/{mission.goal}</span>
          {readyToClaim && (
            <button
              onClick={() => onClaim(mission.id)}
              style={{
                background: "linear-gradient(135deg,#16a34a,#22c55e)",
                border: "none", borderRadius: 9, padding: "4px 13px",
                color: "#fff", fontSize: 11, fontWeight: 900, cursor: "pointer",
                boxShadow: "0 2px 10px rgba(34,197,94,0.35)",
              }}>
              Coletar ✓
            </button>
          )}
          {mission.claimed && (
            <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>✓ Coletado</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GearPassScreen({ onBack }: GearPassScreenProps) {
  // Lê o wallpaper ativo do jogador (mesmo sistema do main menu)
  const wallpaperUrl = typeof window !== "undefined"
    ? `/images/wallpapers/${localStorage.getItem("gpgame_selected_wallpaper") ?? "fehnon_wallpaper"}.png`
    : "/images/wallpapers/fehnon_wallpaper.png"
  const { setCoins, playerId, allCards, addToCollection } = useGame()

  // ── PACK OPENING — extraído verbatim do GachaScreen ───────────────────────────
  // Mesmos states, mesmos efeitos, mesmo JSX e keyframes. A única diferença é
  // que aqui as cartas já chegam prontas (geradas por openPackReward) em vez de
  // vir de pullGacha — a animação em si é idêntica.
  const CARDS_PER_PACK = 4
  const [packIsOpening, setPackIsOpening] = useState(false)
  const [packShowResults, setPackShowResults] = useState(false)
  const [packOpenedCards, setPackOpenedCards] = useState<Card[]>([])
  const [packRarityTier, setPackRarityTier] = useState<"normal" | "rare" | "epic" | "legendary">("normal")
  const [packScreenShake, setPackScreenShake] = useState(false)
  const packCanvasRef = useRef<HTMLCanvasElement>(null)
  const packAnimationRef = useRef<number>()
  const [packList, setPackList] = useState<{ id: number; cards: Card[]; highestRarity: "R"|"SR"|"UR"|"LR" }[]>([])
  const [packCurrentIndex, setPackCurrentIndex] = useState(0)
  const [packPhase, setPackPhase] = useState<"entering"|"floating"|"shaking"|"opening"|"revealing"|"done">("entering")
  const [packCardRevealIndex, setPackCardRevealIndex] = useState(-1)
  const [packSwipeStartX, setPackSwipeStartX] = useState<number | null>(null)
  const [packSwipeProgress, setPackSwipeProgress] = useState(0)
  const [packSwipeComplete, setPackSwipeComplete] = useState(false)
  const [packRevealZoomedCard, setPackRevealZoomedCard] = useState<{ image: string; name: string; rarity: string } | null>(null)

  // ── drawParticles — cópia exata do sistema de partículas do GachaScreen ──────
  const drawPackParticles = useCallback(() => {
    const canvas = packCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const cx = canvas.width / 2
    const cy = canvas.height / 2

    const palettes: Record<string, string[]> = {
      normal:    ["#64748b","#94a3b8","#cbd5e1","#e2e8f0"],
      rare:      ["#7c3aed","#8b5cf6","#a78bfa","#c4b5fd","#ede9fe"],
      epic:      ["#fbbf24","#f59e0b","#fcd34d","#fde68a","#ffffff"],
      legendary: ["#ef4444","#f97316","#fbbf24","#22c55e","#3b82f6","#8b5cf6","#ec4899"],
    }
    const cols = palettes[packRarityTier]

    interface Particle {
      x: number; y: number; vx: number; vy: number
      size: number; color: string; alpha: number; life: number; maxLife: number
      type: "spark"|"orb"|"ring"|"star"
      angle?: number; spin?: number; trail?: {x:number;y:number}[]
    }

    const particles: Particle[] = []
    let t = 0

    const spawnAmbient = () => {
      if (particles.length >= 120) return
      const side = Math.random()
      const x = side < 0.5 ? Math.random() * canvas.width : (Math.random() < 0.5 ? -10 : canvas.width + 10)
      const y = side < 0.5 ? canvas.height + 10 : Math.random() * canvas.height
      particles.push({ x, y, vx:(Math.random()-0.5)*1.5, vy:-1.5-Math.random()*2.5,
        size:1.5+Math.random()*3, color:cols[Math.floor(Math.random()*cols.length)],
        alpha:0.9, life:200, maxLife:200, type:"spark" })
    }

    const spawnBurst = (num:number, x:number, y:number, speed:number) => {
      for (let i=0;i<num;i++) {
        const a = (Math.PI*2/num)*i + Math.random()*0.4
        const s = speed * (0.7+Math.random()*0.6)
        particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
          size:3+Math.random()*6, color:cols[Math.floor(Math.random()*cols.length)],
          alpha:1, life:70, maxLife:70, type:Math.random()<0.3?"star":"spark",
          spin:((Math.random()-0.5)*0.3), trail:[] })
      }
    }

    const spawnRing = (x:number,y:number,radius:number,count:number) => {
      for(let i=0;i<count;i++){
        const a=(Math.PI*2/count)*i
        particles.push({x:x+Math.cos(a)*radius,y:y+Math.sin(a)*radius,
          vx:Math.cos(a)*2,vy:Math.sin(a)*2,
          size:2+Math.random()*3,color:cols[Math.floor(Math.random()*cols.length)],
          alpha:1,life:50,maxLife:50,type:"spark",trail:[]})
      }
    }

    const animate = () => {
      t++
      const fade = packPhase==="opening"?"rgba(0,0,0,0.25)":packPhase==="revealing"?"rgba(0,0,0,0.08)":"rgba(0,0,0,0.06)"
      ctx.fillStyle=fade; ctx.fillRect(0,0,canvas.width,canvas.height)

      if(t%2===0) spawnAmbient()

      if(packPhase==="opening") {
        if(t===1) { spawnBurst(40,cx,cy,18); spawnRing(cx,cy,0,20) }
        if(t===8) { spawnBurst(30,cx,cy,12); spawnRing(cx,cy,60,16) }
        if(t===16){ spawnBurst(20,cx,cy,8);  spawnRing(cx,cy,100,12) }
      }

      if(packPhase==="revealing" && t%25===0 && packCardRevealIndex>=0) {
        const cardX = cx + (packCardRevealIndex - 1.5) * 80
        spawnBurst(8, cardX + (Math.random()-0.5)*60, cy + (Math.random()-0.5)*60, 5)
      }

      if(packPhase==="shaking" && t%4===0) {
        spawnBurst(4, cx+(Math.random()-0.5)*60, cy+(Math.random()-0.5)*80, 3)
      }

      ctx.globalAlpha=1

      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i]
        p.x+=p.vx; p.y+=p.vy
        p.vx*=0.96; p.vy*=0.96
        p.life--
        const pct=p.life/p.maxLife
        p.alpha=pct*(p.type==="orb"?0.7:0.9)

        if(p.life<=0){particles.splice(i,1);continue}

        if(p.trail){ p.trail.unshift({x:p.x,y:p.y}); if(p.trail.length>8)p.trail.pop() }

        ctx.save()
        if(p.type==="star"){
          ctx.globalAlpha=Math.max(0,p.alpha)
          ctx.translate(p.x,p.y)
          if(p.spin) ctx.rotate(p.spin*t)
          ctx.fillStyle=p.color
          const r=p.size; const inner=r*0.4
          ctx.beginPath()
          for(let k=0;k<8;k++){
            const a=(Math.PI/4)*k
            const radius=k%2===0?r:inner
            k===0?ctx.moveTo(Math.cos(a)*radius,Math.sin(a)*radius):ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius)
          }
          ctx.closePath(); ctx.fill()
        } else {
          ctx.globalAlpha=Math.max(0,p.alpha)
          ctx.beginPath()
          ctx.arc(p.x,p.y,Math.max(0.1,p.size),0,Math.PI*2)
          ctx.fillStyle=p.color; ctx.fill()
          const gs=Math.max(0.1,p.size*4)
          const grd=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,gs)
          grd.addColorStop(0,p.color); grd.addColorStop(1,"transparent")
          ctx.globalAlpha=Math.max(0,p.alpha*0.35)
          ctx.beginPath(); ctx.arc(p.x,p.y,gs,0,Math.PI*2)
          ctx.fillStyle=grd; ctx.fill()
          if(p.trail&&p.trail.length>1){
            ctx.globalAlpha=Math.max(0,p.alpha*0.25)
            ctx.strokeStyle=p.color; ctx.lineWidth=Math.max(0.1,p.size*0.5)
            ctx.beginPath(); ctx.moveTo(p.trail[0].x,p.trail[0].y)
            p.trail.forEach(pt=>ctx.lineTo(pt.x,pt.y))
            ctx.stroke()
          }
        }
        ctx.restore()
      }
      ctx.globalAlpha=1
      packAnimationRef.current=requestAnimationFrame(animate)
    }
    animate()
  }, [packPhase, packRarityTier, packCardRevealIndex])

  useEffect(() => {
    if (packIsOpening || packShowResults) {
      drawPackParticles()
    }
    return () => {
      if (packAnimationRef.current) cancelAnimationFrame(packAnimationRef.current)
    }
  }, [packIsOpening, packShowResults, drawPackParticles])

  // Card reveal — delays dramáticos por raridade (idêntico ao gacha)
  useEffect(() => {
    if (packPhase === "revealing" && packCardRevealIndex < CARDS_PER_PACK) {
      const card = packList[packCurrentIndex]?.cards[packCardRevealIndex]
      const delay = card?.rarity === "LR" ? 900 : card?.rarity === "UR" ? 600 : card?.rarity === "SR" ? 400 : 280
      const timer = setTimeout(() => setPackCardRevealIndex(prev => prev + 1), delay)
      return () => clearTimeout(timer)
    }
  }, [packPhase, packCardRevealIndex, packList, packCurrentIndex])

  // Avança pro próximo pack ou finaliza (agora suporta múltiplos packs em sequência
  // — usado quando o jogador coleta vários packs de uma vez em "Coletar Pendentes")
  useEffect(() => {
    if (packPhase === "revealing" && packCardRevealIndex >= CARDS_PER_PACK) {
      const timer = setTimeout(() => {
        if (packCurrentIndex < packList.length - 1) {
          setPackCurrentIndex(prev => prev + 1)
          setPackPhase("entering")
          setPackCardRevealIndex(-1)
        } else {
          setPackPhase("done")
          setPackShowResults(true)
          setPackIsOpening(false)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [packPhase, packCardRevealIndex, packCurrentIndex, packList.length])

  // Sincroniza o tier visual (glow de fundo + cor das partículas) com a raridade
  // do pack ATUAL sempre que avança pro próximo — essencial no fluxo multi-pack
  useEffect(() => {
    if (!packIsOpening || !packList[packCurrentIndex]) return
    setPackRarityTier(tierFromRarity(packList[packCurrentIndex].highestRarity))
  }, [packCurrentIndex, packIsOpening])

  // Progressão de fase: entering → floating (swipe) → shaking → opening → revealing
  useEffect(() => {
    if (!packIsOpening || packList.length === 0) return
    if (packPhase === "entering") {
      if (packCurrentIndex === 0) {
        const t = setTimeout(() => { setPackPhase("floating"); setPackSwipeProgress(0); setPackSwipeComplete(false) }, 800)
        return () => clearTimeout(t)
      } else {
        const t = setTimeout(() => { setPackPhase("shaking") }, 600)
        return () => clearTimeout(t)
      }
    }
    if (packPhase === "shaking") {
      setPackScreenShake(true)
      const t = setTimeout(() => { setPackScreenShake(false); setPackPhase("opening") }, 700)
      return () => clearTimeout(t)
    }
    if (packPhase === "opening") {
      const t = setTimeout(() => { setPackPhase("revealing"); setPackCardRevealIndex(0) }, 1000)
      return () => clearTimeout(t)
    }
  }, [packPhase, packIsOpening, packList.length])

  const closePackResults = () => {
    setPackShowResults(false)
    setPackOpenedCards([])
    setPackRarityTier("normal")
    setPackList([])
    setPackCurrentIndex(0)
    setPackPhase("entering")
    setPackCardRevealIndex(-1)
    setPackSwipeProgress(0)
    setPackSwipeStartX(null)
    setPackSwipeComplete(false)
  }

  const getPackRarityColor = (rarity: string) => {
    switch (rarity) {
      case "LR": return "from-red-500 via-amber-500 to-red-500"
      case "UR": return "from-amber-400 to-yellow-500"
      case "SR": return "from-purple-500 to-pink-500"
      default:   return "from-slate-500 to-slate-600"
    }
  }

  // ── Verificar premium no servidor ao abrir a tela ─────────────────────────
  useEffect(() => {
    if (!playerId) return
    const checkServerPremium = async () => {
      try {
        const res = await fetch(`/api/stripe/check-premium?player_id=${playerId}`)
        const data = await res.json()
        if (data.hasPremium) {
          setPassData(pd => ({ ...pd, hasPremium: true }))
          // Espelha no localStorage para acesso offline imediato
          const stored = JSON.parse(localStorage.getItem(LS_PASS_KEY) || "{}")
          localStorage.setItem(LS_PASS_KEY, JSON.stringify({ ...stored, hasPremium: true }))
        }
      } catch {
        // Se offline, confia no localStorage
      }
    }
    checkServerPremium()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])

  // ── Persistent state ─────────────────────────────────────────────────────
  const [passData, setPassData] = useState<{
    currentPoints: number
    currentLevel: number
    hasPremium: boolean
    claimedCommon: number[]
    claimedPremium: number[]
    seasonStartedAt: number
    seasonNumber: number
  }>(() => {
    const fresh = { currentPoints: 0, currentLevel: 0, hasPremium: false, claimedCommon: [], claimedPremium: [], seasonStartedAt: Date.now(), seasonNumber: 1 }
    if (typeof window === "undefined") return fresh
    try {
      const saved = localStorage.getItem(LS_PASS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Migração: dados antigos sem esses campos ganham valores padrão
        if (!parsed.seasonStartedAt) parsed.seasonStartedAt = Date.now()
        if (!parsed.seasonNumber) parsed.seasonNumber = 1
        return parsed
      }
    } catch {}
    return fresh
  })

  // ── Helpers para reset de missões ───────────────────────────────────────────
  const getDayKey  = () => new Date().toISOString().slice(0, 10)          // "YYYY-MM-DD"
  const getWeekKey = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const mon = new Date(d); mon.setDate(diff)
    return mon.toISOString().slice(0, 10)                                   // Monday of current week
  }

  // Claimed missions stored as { id: { claimedAt, dayKey, weekKey } }
  const [claimedMissionIds, setClaimedMissionIds] = useState<Record<string, { dayKey: string; weekKey: string }>>(() => {
    if (typeof window === "undefined") return {}
    try {
      const saved = localStorage.getItem(LS_MISSIONS_KEY)
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      // Migrate old format (array) to new format (object)
      if (Array.isArray(parsed)) {
        const obj: Record<string, { dayKey: string; weekKey: string }> = {}
        parsed.forEach((id: string) => {
          obj[id] = { dayKey: getDayKey(), weekKey: getWeekKey() }
        })
        return obj
      }
      return parsed
    } catch {}
    return {}
  })

  // Check if a mission is still validly claimed (not expired by reset)
  const isMissionClaimed = (id: string, type: "daily" | "weekly" | "limited"): boolean => {
    const entry = claimedMissionIds[id]
    if (!entry) return false
    if (type === "daily")   return entry.dayKey  === getDayKey()
    if (type === "weekly")  return entry.weekKey === getWeekKey()
    return true  // limited never resets
  }

  const claimMission = (id: string, _type: "daily" | "weekly" | "limited") => {
    setClaimedMissionIds(prev => ({
      ...prev,
      [id]: { dayKey: getDayKey(), weekKey: getWeekKey() },
    }))
  }

  // ── currentDayKey: muda à meia-noite e força re-avaliação das missões ────────
  const [currentDayKey, setCurrentDayKey] = useState(() => getDayKey())

  // Login diário — apenas no mount, não a cada claim
  useEffect(() => {
    trackDailyLogin()
    // Mostra toast de "+30 pts" só uma vez por dia
    const todayKey = getDayKey()
    const seenKey  = `gpgame_login_toast_${todayKey}`
    if (typeof window !== "undefined" && !localStorage.getItem(seenKey)) {
      localStorage.setItem(seenKey, "1")
      setTimeout(() => {
        setShowLoginToast(true)
        setTimeout(() => setShowLoginToast(false), 2800)
      }, 900)
    }
  }, [])

  // Detecta virada de dia a cada 60s e atualiza currentDayKey
  useEffect(() => {
    const check = () => {
      const today = getDayKey()
      if (today !== currentDayKey) setCurrentDayKey(today)
    }
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [currentDayKey])

  // Missões lidas ao vivo do tracker + status de claimed
  const [missions, setMissions] = useState<PassMission[]>(() =>
    buildMissions().map(m => ({ ...m, claimed: false }))
  )

  // Recarrega progresso das missões a cada 3s
  // Depende de claimedMissionIds (novos claims) e currentDayKey (virada de dia)
  useEffect(() => {
    const refresh = () => {
      const fresh = buildMissions()
      setMissions(fresh.map(m => {
        const claimed = isMissionClaimed(m.id, m.type)
        return {
          ...m,
          claimed,
          ...(claimed ? { completed: true, progress: m.goal } : {}),
        }
      }))
    }
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimedMissionIds, currentDayKey])

  const [activeTab, setActiveTab] = useState<"pass" | "missions">("pass")
  const [missionFilter, setMissionFilter] = useState<"all" | "daily" | "weekly" | "limited">("all")
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null)
  const [levelUpAnim, setLevelUpAnim] = useState<number | null>(null)
  const prevLevelRef = useRef(0)
  // Pop do checkmark no claim individual — limpo após 600ms
  const [justClaimed, setJustClaimed] = useState<{ level: number; isPremium: boolean } | null>(null)
  // Toast de login diário — mostrado só uma vez por dia
  const [showLoginToast, setShowLoginToast] = useState(false)

  // ── Clicar e segurar numa recompensa já coletada mostra os detalhes dela ─────
  const [peekedReward, setPeekedReward] = useState<{ level: number; isPremium: boolean } | null>(null)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const LONG_PRESS_MS = 420

  const handlePressStart = (level: number, isPremium: boolean, claimed: boolean) => {
    if (!claimed) return // só funciona em recompensas já coletadas
    pressTimerRef.current = setTimeout(() => {
      setPeekedReward({ level, isPremium })
      pressTimerRef.current = null
    }, LONG_PRESS_MS)
  }
  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  // ── Haptic feedback (vibração) — silenciosamente ignorado em devices sem suporte ──
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(pattern) } catch {}
    }
  }

  // ── Animação em cascata: marca quais níveis/missões "piscam" em sequência
  // após um claim em massa (Coletar Pendentes / Coletar Tudo). O dado já muda
  // de uma vez — isso só controla o efeito visual escalonado por cima.
  const [cascadeTrackLevels, setCascadeTrackLevels] = useState<number[]>([])
  const [cascadeMissionIds, setCascadeMissionIds] = useState<string[]>([])
  const CASCADE_STEP_MS = 70

  // ── Resumo de temporada — exibido no exato momento do reset, antes de zerar ──
  const [seasonRecap, setSeasonRecap] = useState<{
    seasonNumber: number
    finalLevel: number
    totalClaimed: number
    autoCollectedCoins: number
  } | null>(null)

  // ── Dias restantes da temporada — countdown real, não mais hardcoded ─────────
  const seasonDaysLeft = Math.max(0, SEASON_DURATION_DAYS - Math.floor((Date.now() - passData.seasonStartedAt) / 86_400_000))

  const [resetCountdown, setResetCountdown] = useState("")
  // Rastreia scrollLeft para saber se as setas estão nos limites
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollMax,  setScrollMax]  = useState(1)
  const passRowRef = useRef<HTMLDivElement>(null)

  // ── Drag com inércia — refs não causam re-render durante o movimento ─────────
  const isDragging        = useRef(false)
  const dragStartX        = useRef(0)
  const scrollAtDragStart = useRef(0)
  const lastDragX         = useRef(0)
  const lastDragTime      = useRef(0)
  const dragVelocity      = useRef(0)          // px/ms no momento do release
  const momentumFrame     = useRef<number | null>(null)

  // Para a animação de inércia anterior antes de começar novo arrasto
  const cancelMomentum = () => {
    if (momentumFrame.current !== null) {
      cancelAnimationFrame(momentumFrame.current)
      momentumFrame.current = null
    }
  }

  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    cancelMomentum()
    isDragging.current       = true
    dragStartX.current       = e.pageX
    lastDragX.current        = e.pageX
    lastDragTime.current     = performance.now()
    dragVelocity.current     = 0
    scrollAtDragStart.current = passRowRef.current?.scrollLeft ?? 0
    e.currentTarget.style.cursor     = "grabbing"
    e.currentTarget.style.userSelect = "none"
  }

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !passRowRef.current) return
    e.preventDefault()
    const now = performance.now()
    const dt  = now - lastDragTime.current
    const dx  = e.pageX - lastDragX.current
    // Velocidade em px/ms (suavizada por exponential moving average)
    if (dt > 0) dragVelocity.current = dragVelocity.current * 0.7 + (dx / dt) * 0.3
    lastDragX.current    = e.pageX
    lastDragTime.current = now
    passRowRef.current.scrollLeft = scrollAtDragStart.current - (e.pageX - dragStartX.current)
  }

  const handleTrackMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    isDragging.current = false
    e.currentTarget.style.cursor     = "grab"
    e.currentTarget.style.userSelect = ""

    // ── Inércia: continua deslizando com desaceleração suave ──
    let velocity = dragVelocity.current * 16   // converte px/ms → px/frame (60fps)
    const glide = () => {
      if (!passRowRef.current || Math.abs(velocity) < 0.4) return
      passRowRef.current.scrollLeft -= velocity
      velocity *= 0.88   // atrito — 0.88 dá ~8 frames até parar num arrasto rápido
      momentumFrame.current = requestAnimationFrame(glide)
    }
    if (Math.abs(velocity) > 1) momentumFrame.current = requestAnimationFrame(glide)
  }

  // Largura de cada coluna de nível (px) — usada nas setas para scroll por página
  const COL_WIDTH = NORMAL_COL_WIDTH

  // Largura total da trilha — soma colunas normais + colunas-marco (mais largas)
  const trackTotalWidth =
    (MAX_LEVELS - MILESTONE_LEVELS.size) * NORMAL_COL_WIDTH +
    MILESTONE_LEVELS.size * MILESTONE_COL_WIDTH + 16

  // Desloca a trilha para a esquerda ou direita por VISIBLE colunas
  const scrollTrack = (dir: 1 | -1) => {
    passRowRef.current?.scrollBy({ left: dir * COL_WIDTH * VISIBLE, behavior: "smooth" })
  }

  // Posição X onde o nível atual fica centralizado — usada tanto no auto-center quanto no botão "voltar"
  const currentLevelTargetX = Math.max(0, (passData.currentLevel - Math.floor(VISIBLE / 2)) * COL_WIDTH)

  // Volta a trilha pro nível atual (botão flutuante)
  const scrollToCurrentLevel = () => {
    passRowRef.current?.scrollTo({ left: currentLevelTargetX, behavior: "smooth" })
  }

  // Jogador se afastou o suficiente do nível atual? (mais de ~1.5 colunas de distância)
  const isAwayFromCurrent = Math.abs(scrollLeft - currentLevelTargetX) > COL_WIDTH * 1.5

  // Próximo marco não alcançado — botão de atalho na trilha
  const nextMilestone = [10, 25, 50, 75, 100].find(ml => ml > passData.currentLevel)
  const scrollToNextMilestone = () => {
    if (!nextMilestone || !passRowRef.current) return
    const targetX = Math.max(0, (nextMilestone - Math.floor(VISIBLE / 2)) * COL_WIDTH)
    passRowRef.current.scrollTo({ left: targetX, behavior: "smooth" })
  }

  // Atualiza scrollLeft/scrollMax enquanto o usuário arrasta ou usa as setas.
  // Throttled via requestAnimationFrame: o evento "scroll" nativo pode disparar
  // dezenas de vezes por segundo, e sem throttle isso causava um setState (e um
  // re-render de TODA a árvore, incluindo as 100 colunas da trilha) por pixel
  // movido — exatamente o que causava o jank/oscilação visual durante o arrasto.
  useEffect(() => {
    const el = passRowRef.current
    if (!el) return
    let rafId: number | null = null
    const onScroll = () => {
      if (rafId !== null) return // já tem uma atualização agendada pro próximo frame
      rafId = requestAnimationFrame(() => {
        setScrollLeft(el.scrollLeft)
        setScrollMax(el.scrollWidth - el.clientWidth)
        rafId = null
      })
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    onScroll()   // leitura inicial
    return () => {
      el.removeEventListener("scroll", onScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [activeTab])

  // ── Detecta level-up e dispara celebração visual + vibração festiva ──────────
  useEffect(() => {
    if (passData.currentLevel > prevLevelRef.current && prevLevelRef.current > 0) {
      setLevelUpAnim(passData.currentLevel)
      vibrate([40, 50, 40, 50, 90]) // padrão mais longo — diferencia de um claim comum
      setTimeout(() => setLevelUpAnim(null), 2800)
    }
    prevLevelRef.current = passData.currentLevel
  }, [passData.currentLevel])

  // ── Countdown até reset diário (atualiza a cada minuto) ──────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const diff = tomorrow.getTime() - now.getTime()
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      setResetCountdown(`${h}h ${String(m).padStart(2, "0")}m`)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Ref espelhando passData — leitura segura dentro do interval sem stale closure ──
  const passDataRef = useRef(passData)
  useEffect(() => { passDataRef.current = passData }, [passData])

  // ── Fim de temporada: reset completo do Passe, COM rede de segurança ─────────
  // Quando o tempo desde seasonStartedAt ultrapassa SEASON_DURATION_DAYS:
  //  • Toda recompensa ALCANÇADA mas nunca coletada é resgatada automaticamente
  //    antes de zerar — o jogador nunca perde progresso por esquecimento
  //  • Pontos e nível voltam a 0
  //  • Todas as recompensas (agora todas marcadas como coletadas) são limpas
  //  • hasPremium volta a false — a compra do Premium vale só para a temporada
  //    em que foi feita, então o jogador precisa comprar de novo na próxima
  //  • Uma nova temporada começa imediatamente (seasonStartedAt = agora)
  //  • Um resumo da temporada que terminou fica visível até o jogador fechar
  // A checagem roda no mount (cobre reabrir o app depois do fim) e a cada 60s.
  useEffect(() => {
    const checkSeasonEnd = () => {
      const pd = passDataRef.current
      const elapsed = Date.now() - pd.seasonStartedAt
      if (elapsed < SEASON_DURATION_DAYS * 86_400_000) return

      // Auto-coleta de segurança: varre todos os níveis alcançados e resgata
      // qualquer recompensa esquecida antes de zerar o progresso.
      let autoCollectedCoins = 0
      const finalClaimedCommon  = [...pd.claimedCommon]
      const finalClaimedPremium = [...pd.claimedPremium]
      for (let lvl = 1; lvl <= pd.currentLevel; lvl++) {
        if (!finalClaimedCommon.includes(lvl)) {
          const r = ALL_REWARDS.find(x => x.level === lvl && !x.isPremium)
          if (r) {
            finalClaimedCommon.push(lvl)
            if (r.type === "coins" && r.amount) autoCollectedCoins += r.amount
          }
        }
        if (pd.hasPremium && !finalClaimedPremium.includes(lvl)) {
          const r = ALL_REWARDS.find(x => x.level === lvl && x.isPremium)
          if (r) {
            finalClaimedPremium.push(lvl)
            if (r.type === "coins" && r.amount) autoCollectedCoins += r.amount
          }
        }
      }

      const endedSeason  = pd.seasonNumber
      const totalClaimed = finalClaimedCommon.length + finalClaimedPremium.length

      if (autoCollectedCoins > 0) setCoins((c: number) => c + autoCollectedCoins)

      setPassData({
        currentPoints: 0,
        currentLevel: 0,
        hasPremium: false,
        claimedCommon: [],
        claimedPremium: [],
        seasonStartedAt: Date.now(),
        seasonNumber: endedSeason + 1,
      })

      // Resumo rico substitui o toast simples — dá fechamento real ao jogador
      setSeasonRecap({
        seasonNumber: endedSeason,
        finalLevel: pd.currentLevel,
        totalClaimed,
        autoCollectedCoins,
      })
      vibrate([50, 40, 50, 40, 120])
    }
    checkSeasonEnd()
    const id = setInterval(checkSeasonEnd, 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Centraliza no nível atual ao montar / quando o nível muda ────────────────
  useEffect(() => {
    if (!passRowRef.current) return
    passRowRef.current.scrollTo({ left: currentLevelTargetX, behavior: "smooth" })
  }, [passData.currentLevel])

  // Persist passData
  useEffect(() => {
    localStorage.setItem(LS_PASS_KEY, JSON.stringify(passData))
  }, [passData])

  // Persist claimed mission IDs with timestamps
  useEffect(() => {
    localStorage.setItem(LS_MISSIONS_KEY, JSON.stringify(claimedMissionIds))
  }, [claimedMissionIds])

  // Scroll to current level
  useEffect(() => {
    if (activeTab === "pass" && passRowRef.current) {
      const lvl = passData.currentLevel
      const target = passRowRef.current.querySelector(`[data-level="${Math.max(1, lvl)}"]`)
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
      }
    }
  }, [activeTab, passData.currentLevel])

  // ── Derived ──────────────────────────────────────────────────────────────
  // Pontos gastos nos níveis anteriores (para calcular progresso no nível atual)
  const ptsSpentBefore      = totalPtsToReachLevel(passData.currentLevel)
  // Pontos acumulados dentro do nível atual (acima do limiar do nível anterior)
  const pointsInCurrentLevel = passData.currentPoints - ptsSpentBefore
  // Custo do próximo nível (de currentLevel → currentLevel + 1)
  const nextLevelCost        = ptsForLevel(passData.currentLevel + 1)
  // Porcentagem de progresso para o próximo nível
  const progressPct          = passData.currentLevel >= MAX_LEVELS
    ? 100
    : Math.min(100, Math.round((pointsInCurrentLevel / nextLevelCost) * 100))

  const filteredMissions = missionFilter === "all"
    ? missions
    : missions.filter(m => m.type === missionFilter)

  const claimableCount = filteredMissions.filter(m => m.completed && !m.claimed).length

  // Progresso por tipo — usado no indicador "X/Y completadas" no header de missões
  const missionProgress = (type: PassMission["type"]) => {
    const ofType = missions.filter(m => m.type === type)
    const done   = ofType.filter(m => m.completed || m.claimed).length
    return { done, total: ofType.length }
  }

  const handleClaimAll = () => {
    const claimable = filteredMissions.filter(m => m.completed && !m.claimed)
    if (claimable.length === 0) return
    let totalPoints = 0
    claimable.forEach(m => {
      claimMission(m.id, m.type)
      totalPoints += m.points
    })
    const newPoints = passData.currentPoints + totalPoints
    const newLevel = Math.min(MAX_LEVELS, levelFromPts(newPoints))
    setPassData(pd => ({ ...pd, currentPoints: newPoints, currentLevel: newLevel }))
    setClaimFeedback(`+${totalPoints} pontos do Passe!`)
    setTimeout(() => setClaimFeedback(null), 2500)

    // Vibração escalonada — um "tap" leve por item, dá a sensação de resgate em série
    const vibePattern1: number[] = []
    claimable.forEach(() => vibePattern1.push(25, 30))
    vibrate(vibePattern1)

    // Cascata visual — cada card "pisca" em sequência, não tudo de uma vez
    setCascadeMissionIds(claimable.map(m => m.id))
    setTimeout(() => setCascadeMissionIds([]), claimable.length * CASCADE_STEP_MS + 500)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleClaimMission = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId)
    if (!mission || !mission.completed || mission.claimed) return
    if (isMissionClaimed(missionId, mission.type)) return

    const newPoints = passData.currentPoints + mission.points
    const newLevel = Math.min(MAX_LEVELS, levelFromPts(newPoints))
    setPassData(pd => ({ ...pd, currentPoints: newPoints, currentLevel: newLevel }))
    claimMission(missionId, mission.type)
    vibrate(35)
    setClaimFeedback(`+${mission.points} pontos do Passe!`)
    setTimeout(() => setClaimFeedback(null), 2000)
  }

  // ── Bônus de Conclusão: 300 pts (diárias) / 750 pts (semanais) ──────────────
  const COMPLETION_BONUS = { daily: 300, weekly: 750 } as const

  const getCompletionBonusState = (type: "daily" | "weekly") => {
    const bonusId  = `${type}_completion_bonus`
    const ofType   = missions.filter(m => m.type === type)
    // Todas concluídas ou já coletadas individualmente
    const allDone  = ofType.length > 0 && ofType.every(m => m.completed || m.claimed)
    const claimed  = isMissionClaimed(bonusId, type)
    return { bonusId, allDone, claimed, pts: COMPLETION_BONUS[type] }
  }

  const handleClaimCompletionBonus = (type: "daily" | "weekly") => {
    const { bonusId, allDone, claimed, pts } = getCompletionBonusState(type)
    if (!allDone || claimed) return
    const newPoints = passData.currentPoints + pts
    const newLevel  = Math.min(MAX_LEVELS, levelFromPts(newPoints))
    setPassData(pd => ({ ...pd, currentPoints: newPoints, currentLevel: newLevel }))
    claimMission(bonusId, type)
    vibrate([30, 30, 50])
    setClaimFeedback(`+${pts} pts — Bônus de Conclusão!`)
    setTimeout(() => setClaimFeedback(null), 2800)
  }

  const handleClaimPassReward = (level: number, isPremium: boolean) => {
    if (level > passData.currentLevel) return
    if (isPremium && !passData.hasPremium) { setShowPremiumModal(true); return }
    const key = isPremium ? "claimedPremium" : "claimedCommon"
    if (passData[key].includes(level)) return
    const reward = ALL_REWARDS.find(r => r.level === level && r.isPremium === isPremium)
    if (!reward) return

    if (reward.type === "coins" && reward.amount) setCoins((c: number) => c + reward.amount!)

    setPassData(pd => ({ ...pd, [key]: [...pd[key], level] }))
    vibrate(isPremium ? [30, 25, 40] : 35)
    setJustClaimed({ level, isPremium })
    setTimeout(() => setJustClaimed(null), 600)

    // card_pack → abre o pack opening embutido
    if (reward.type === "card_pack") {
      openPackReward(reward.rarity)
    } else {
      setClaimFeedback(
        reward.type === "coins" ? `+${reward.amount} Coins!`
        : reward.type === "gacha_coin" ? `+${reward.amount ?? 1} Gacha Coin(s)!`
        : `${reward.label} obtido!`
      )
      setTimeout(() => setClaimFeedback(null), 2000)
    }
  }

  // ── Gera CARDS_PER_PACK cartas com taxas baseadas na raridade do pack ─────────
  // ── openPackReward: gera cards, salva no localStorage, navega pro gacha ──────
  // O gacha screen detecta o localStorage no mount e inicia a animação EXATA
  // de pack opening, sem recriar nada.
  // ── Gera as 4 cartas de UM pack, com taxas baseadas na raridade do pack ──────
  // Extraído como helper pra ser reutilizado tanto no claim individual quanto
  // no "Coletar Pendentes" (múltiplos packs de uma vez).
  const generatePackCards = (packRarity?: "R" | "SR" | "UR" | "LR"): { cards: Card[]; highestRarity: "R"|"SR"|"UR"|"LR" } => {
    const rarityRates: Record<string, Record<string, number>> = {
      R:  { LR: 0.5, UR: 4.5, SR: 25, R: 70 },
      SR: { LR: 1,   UR: 9,   SR: 40, R: 50 },
      UR: { LR: 3,   UR: 22,  SR: 55, R: 20 },
      LR: { LR: 20,  UR: 50,  SR: 30, R: 0  },
    }
    const rates = rarityRates[packRarity ?? "R"]
    const packCards: Card[] = []

    for (let i = 0; i < 4; i++) {
      const rand = Math.random() * 100
      let targetRarity: "R" | "SR" | "UR" | "LR"
      if      (rand < rates.LR)                       targetRarity = "LR"
      else if (rand < rates.LR + rates.UR)            targetRarity = "UR"
      else if (rand < rates.LR + rates.UR + rates.SR)  targetRarity = "SR"
      else                                             targetRarity = "R"
      let pool = (allCards as Card[]).filter(c => c.rarity === targetRarity)
      if (pool.length === 0) pool = allCards as Card[]
      const base = pool[Math.floor(Math.random() * pool.length)]
      packCards.push({ ...base, id: `${base.id}-gp-${Date.now()}-${i}-${Math.random().toString(36).slice(2,7)}` })
    }

    const rarityOrder = ["R","SR","UR","LR"] as const
    let highestRarity: "R"|"SR"|"UR"|"LR" = "R"
    for (const c of packCards) {
      if (rarityOrder.indexOf(c.rarity as any) > rarityOrder.indexOf(highestRarity))
        highestRarity = c.rarity as "R"|"SR"|"UR"|"LR"
    }
    return { cards: packCards, highestRarity }
  }

  // Calcula o tier visual (pro glow de fundo e partículas) a partir da raridade mais alta
  const tierFromRarity = (r: "R"|"SR"|"UR"|"LR"): "normal"|"rare"|"epic"|"legendary" =>
    r === "LR" ? "legendary" : r === "UR" ? "epic" : r === "SR" ? "rare" : "normal"

  const openPackReward = (packRarity?: "R" | "SR" | "UR" | "LR") => {
    if (!allCards || allCards.length === 0) return

    const { cards: packCards, highestRarity } = generatePackCards(packRarity)

    // Adiciona à coleção e rastreia — as cartas já vão pra conta antes da animação
    addToCollection(packCards)
    trackGachaPull(1, packCards)
    vibrate([40, 30, 60])

    // Dispara a animação de pack opening INLINE, sem sair do Gear Pass
    setPackRarityTier(tierFromRarity(highestRarity))
    setPackList([{ id: 0, cards: packCards, highestRarity }])
    setPackOpenedCards(packCards)
    setPackCurrentIndex(0)
    setPackCardRevealIndex(-1)
    setPackIsOpening(true)
    setPackPhase("entering")
  }

  const openStripeCheckout = () => {
    // Passa o playerId como client_reference_id para o webhook identificar o jogador
    const pid = playerId || localStorage.getItem("gear-perks-player-id") || localStorage.getItem("gearperks-playerid") || ""
    const stripeUrl = pid
      ? `${STRIPE_PAYMENT_URL}?client_reference_id=${encodeURIComponent(pid)}`
      : STRIPE_PAYMENT_URL
    window.open(stripeUrl, "_blank")
    setShowPremiumModal(false)
  }

  // ── Level reward data ─────────────────────────────────────────────────────
  const levelGroups = Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map(lvl => ({
    level: lvl,
    common: ALL_REWARDS.find(r => r.level === lvl && !r.isPremium),
    premium: ALL_REWARDS.find(r => r.level === lvl && r.isPremium),
    isUnlocked: lvl <= passData.currentLevel,
    commonClaimed: passData.claimedCommon.includes(lvl),
    premiumClaimed: passData.claimedPremium.includes(lvl),
  }))

  // ─────────────────────────────────────────────────────────────────────────

  // Badges de notificação — contam itens prontos pra coletar por área
  const trackPendingCount = levelGroups.filter(lg =>
    lg.isUnlocked && (!lg.commonClaimed || (passData.hasPremium && !lg.premiumClaimed))
  ).length

  const missionPendingCount = missions.filter(m => m.completed && !m.claimed).length

  // Teaser: próxima recompensa comum ainda não desbloqueada
  const nextRewardEntry = levelGroups.find(lg => !lg.commonClaimed && lg.level > passData.currentLevel)

  // Passe 100% completo — nível máximo atingido E todas as recompensas coletadas
  const isPassComplete = passData.currentLevel >= MAX_LEVELS && trackPendingCount === 0

  // ── Teaser de premium retroativo ──────────────────────────────────────────
  // Conta níveis já alcançados cuja recompensa premium nunca foi coletada,
  // INDEPENDENTE de hasPremium — é exatamente o que o jogador resgataria de uma
  // vez se comprasse agora. Usado no modal de upsell.
  const retroactivePremiumLevels = levelGroups.filter(lg => lg.isUnlocked && lg.premium && !lg.premiumClaimed)
  const retroactivePremiumCount  = retroactivePremiumLevels.length

  // ── Coletar todos os pendentes da trilha de uma vez ──────────────────────────
  const handleClaimAllTrack = () => {
    const newCommon   = [...passData.claimedCommon]
    const newPremium  = [...passData.claimedPremium]
    const touchedLevels: number[] = [] // ordem de cascata — usada só pro efeito visual
    let totalCoins = 0
    // Packs encontrados no lote — cada um vira uma entrada em packList
    const packsToOpen: { id: number; cards: Card[]; highestRarity: "R"|"SR"|"UR"|"LR" }[] = []
    const allNewCards: Card[] = []

    levelGroups.filter(lg => lg.isUnlocked).forEach(lg => {
      let touched = false
      if (!lg.commonClaimed) {
        newCommon.push(lg.level)
        if (lg.common?.type === "coins" && lg.common.amount) totalCoins += lg.common.amount
        if (lg.common?.type === "card_pack") {
          const { cards, highestRarity } = generatePackCards(lg.common.rarity)
          packsToOpen.push({ id: packsToOpen.length, cards, highestRarity })
          allNewCards.push(...cards)
        }
        touched = true
      }
      if (passData.hasPremium && !lg.premiumClaimed) {
        newPremium.push(lg.level)
        if (lg.premium?.type === "coins" && lg.premium.amount) totalCoins += lg.premium.amount
        if (lg.premium?.type === "card_pack") {
          const { cards, highestRarity } = generatePackCards(lg.premium.rarity)
          packsToOpen.push({ id: packsToOpen.length, cards, highestRarity })
          allNewCards.push(...cards)
        }
        touched = true
      }
      if (touched) touchedLevels.push(lg.level)
    })

    if (totalCoins > 0) setCoins((c: number) => c + totalCoins)
    setPassData(pd => ({ ...pd, claimedCommon: newCommon, claimedPremium: newPremium }))

    // Cartas de todos os packs vão pra conta imediatamente, antes da animação
    if (allNewCards.length > 0) {
      addToCollection(allNewCards)
      trackGachaPull(packsToOpen.length, allNewCards)
      vibrate([40, 30, 60])
    }

    setClaimFeedback(
      `Tudo coletado!${totalCoins > 0 ? ` +${totalCoins} Coins` : ""}${packsToOpen.length > 0 ? ` · ${packsToOpen.length} pack${packsToOpen.length !== 1 ? "s" : ""} aberto${packsToOpen.length !== 1 ? "s" : ""}` : ""}`
    )
    setTimeout(() => setClaimFeedback(null), 2500)

    // Vibração escalonada + cascata visual nas caixinhas, na mesma ordem da trilha
    const vibePattern2: number[] = []
    touchedLevels.forEach(() => vibePattern2.push(22, 28))
    vibrate(vibePattern2)
    setCascadeTrackLevels(touchedLevels)
    setTimeout(() => setCascadeTrackLevels([]), touchedLevels.length * CASCADE_STEP_MS + 500)

    // Se algum pack foi coletado no lote, dispara a animação em sequência —
    // um pack de cada vez, na mesma ordem em que apareceram na trilha
    if (packsToOpen.length > 0) {
      setPackRarityTier(tierFromRarity(packsToOpen[0].highestRarity))
      setPackList(packsToOpen)
      setPackOpenedCards(allNewCards)
      setPackCurrentIndex(0)
      setPackCardRevealIndex(-1)
      setPackIsOpening(true)
      setPackPhase("entering")
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: "100dvh", maxHeight: "100dvh",
      display: "flex", flexDirection: "column",
      color: "#f1f5f9",
      fontFamily: "'Segoe UI',system-ui,sans-serif",
      position: "relative", overflow: "hidden",
      // Impede que gestos de touch (ex: arrastar a trilha) "vazem" pro bounce
      // vertical nativo do navegador, causando a sensação de tela oscilando
      overscrollBehavior: "none",
    }}>

      {/* ── WALLPAPER BACKGROUND ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: "cover", backgroundPosition: "center top",
        filter: "brightness(0.42) saturate(0.80)",
        transform: "scale(1.04)",
      }} />
      {/* Overlay: gradiente escuro suave — mais forte no topo para legibilidade do header */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "linear-gradient(180deg,rgba(2,6,16,0.70) 0%,rgba(2,6,16,0.30) 20%,rgba(2,6,16,0.18) 60%,rgba(2,6,16,0.35) 100%)",
      }} />

      {/* ── RESUMO DE TEMPORADA ── aparece no exato momento do reset, dá fechamento */}
      {seasonRecap && (
        <div onClick={() => setSeasonRecap(null)} style={{
          position: "fixed", inset: 0, zIndex: 9997,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, animation: "fadeIn 0.2s ease",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "linear-gradient(160deg,rgba(6,182,212,0.10),rgba(3,8,22,0.97) 40%)",
            border: "1.5px solid rgba(6,182,212,0.40)",
            borderRadius: 22, padding: "28px 26px", textAlign: "center",
            maxWidth: 320, width: "100%",
            boxShadow: "0 0 60px rgba(6,182,212,0.20)",
            animation: "popIn 0.28s cubic-bezier(.2,1.3,.4,1)",
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: 16, margin: "0 auto 10px",
              background: "linear-gradient(145deg,#0e7490,#0891b2,#22d3ee)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 20px rgba(6,182,212,0.35), inset 0 1.5px 0 rgba(255,255,255,0.30), inset 0 -4px 8px rgba(0,0,0,0.20)",
            }}>
              <Flag size={26} color="#fff" strokeWidth={2} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
              Temporada {seasonRecap.seasonNumber} Encerrada
            </div>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#f1f5f9", marginBottom: 18 }}>
              Bem-vindo à Temporada {seasonRecap.seasonNumber + 1}!
            </div>

            {/* Stats da temporada que terminou */}
            <div style={{ display: "flex", gap: 10, marginBottom: seasonRecap.autoCollectedCoins > 0 ? 12 : 18 }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 8px" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9" }}>{seasonRecap.finalLevel}</div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Nível Final</div>
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 8px" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#22c55e" }}>{seasonRecap.totalClaimed}</div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Recompensas</div>
              </div>
            </div>

            {/* Aviso de auto-coleta — só aparece se algo foi resgatado automaticamente */}
            {seasonRecap.autoCollectedCoins > 0 && (
              <div style={{
                background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.30)",
                borderRadius: 10, padding: "8px 12px", marginBottom: 18,
                fontSize: 11, color: "#4ade80", display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
              }}>
                <Gift size={13} /> +{seasonRecap.autoCollectedCoins} Coins resgatados automaticamente
              </div>
            )}

            <button onClick={() => setSeasonRecap(null)} style={{
              width: "100%", padding: "11px 0", borderRadius: 12,
              border: "none", background: "linear-gradient(135deg,#0e7490,#06b6d4)",
              color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(6,182,212,0.30)",
            }}>
              Começar Temporada {seasonRecap.seasonNumber + 1}
            </button>
          </div>
        </div>
      )}

      {/* ── LEVEL-UP CELEBRATION ── */}
      {levelUpAnim !== null && (
        <div style={{ position:"fixed",inset:0,zIndex:9998,pointerEvents:"none",
          display:"flex",alignItems:"center",justifyContent:"center" }}>
          {[...Array(8)].map((_,i) => {
            const rayStyle: any = {
              position:"absolute",width:3,height:100,borderRadius:99,
              background:`linear-gradient(to top,${i%2===0?"#06b6d4":"#f59e0b"},transparent)`,
              transformOrigin:"50% 100%",
              "--r": `${i*45}deg`,
              animation:"burstRay 0.7s ease-out forwards",opacity:0,
              animationDelay:`${i*30}ms`,
            }
            return <div key={i} style={rayStyle} />
          })}
          <div style={{
            background:"rgba(3,8,22,0.92)",backdropFilter:"blur(20px)",
            border:"2px solid rgba(6,182,212,0.55)",borderRadius:24,
            padding:"22px 44px",textAlign:"center",
            boxShadow:"0 0 60px rgba(6,182,212,0.35),0 0 100px rgba(245,158,11,0.15)",
            animation:"levelUpCard 2.8s ease forwards",
          }}>
            <div style={{fontSize:10,fontWeight:700,color:"#06b6d4",letterSpacing:"0.18em",
              textTransform:"uppercase",marginBottom:6}}>Subiu de Nível</div>
            <div style={{fontSize:60,fontWeight:900,color:"#fff",lineHeight:1,
              letterSpacing:"-0.04em"}}>{levelUpAnim}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:6}}>
              Lv.{levelUpAnim-1} → Lv.{levelUpAnim}
            </div>
          </div>
        </div>
      )}


      {/* ── PEEK: ver detalhes de recompensa já coletada (clicar e segurar) ── */}
      {peekedReward && (() => {
        const lg = levelGroups.find(g => g.level === peekedReward.level)
        const reward = lg ? (peekedReward.isPremium ? lg.premium : lg.common) : null
        if (!reward) return null
        const accent = peekedReward.isPremium ? "#f59e0b" : "#06b6d4"
        const rarityColors: Record<string, string> = { R: "#60a5fa", SR: "#a855f7", UR: "#38bdf8", LR: "#ef4444" }
        return (
          <div onClick={() => setPeekedReward(null)} style={{
            position: "fixed", inset: 0, zIndex: 9990,
            background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, animation: "fadeIn 0.15s ease",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "rgba(3,8,22,0.97)",
              border: `1.5px solid ${accent}55`,
              borderRadius: 20, padding: "24px 28px", textAlign: "center",
              maxWidth: 260, boxShadow: `0 0 50px ${accent}30`,
              animation: "popIn 0.22s cubic-bezier(.2,1.4,.4,1)",
            }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.40)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <RewardIcon reward={reward} />
                </div>
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>
                {peekedReward.isPremium ? "Recompensa Premium" : "Recompensa Comum"} · Lv.{peekedReward.level}
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#f1f5f9", marginBottom: 8 }}>
                {reward.label}
              </div>
              {reward.rarity && (
                <div style={{
                  display: "inline-block", fontSize: 10, fontWeight: 800, padding: "3px 11px", borderRadius: 8,
                  background: `${rarityColors[reward.rarity]}20`, color: rarityColors[reward.rarity], marginBottom: 4,
                }}>
                  {reward.rarity}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 10, color: "#4ade80", fontSize: 11, fontWeight: 700 }}>
                <Check size={13} strokeWidth={3} /> Já coletado
              </div>
              <button onClick={() => setPeekedReward(null)} style={{
                marginTop: 18, width: "100%", padding: "9px 0", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)",
                color: "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                Fechar
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── FEEDBACK TOAST ── */}
      {claimFeedback && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.40)",
          borderRadius: 14, padding: "10px 24px", color: "#4ade80", fontWeight: 900, fontSize: 14,
          backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(34,197,94,0.2)",
          animation: "fadeInDown 0.3s ease", display: "flex", alignItems: "center", gap: 8,
        }}>
          <PartyPopper size={16} color="#4ade80" strokeWidth={2} />
          {claimFeedback}
        </div>
      )}

      {/* ── TOAST DE LOGIN DIÁRIO — aparece na primeira abertura do dia ── */}
      {showLoginToast && (
        <div style={{
          position: "fixed", top: 120, left: "50%", transform: "translateX(-50%)",
          zIndex: 9998, background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.35)",
          borderRadius: 14, padding: "8px 20px", color: "#22d3ee", fontWeight: 800, fontSize: 13,
          backdropFilter: "blur(12px)", boxShadow: "0 4px 20px rgba(6,182,212,0.18)",
          animation: "fadeInDown 0.3s ease", display: "flex", alignItems: "center", gap: 8,
          whiteSpace: "nowrap",
        }}>
          <Zap size={14} color="#22d3ee" />
          +30 pts por login diário
        </div>
      )}

      {/* ── EVERYTHING ABOVE WALLPAPER ── */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>

      {/* ── HEADER — sem fundo, sem blur, flutua sobre o wallpaper ── */}
      <div style={{
        flexShrink: 0,
        position: "relative",
        background: "transparent",
      }}>
        {/* Top bar */}
        <div style={{ padding: "12px 16px 0", display: "flex", alignItems: "center", gap: 12, maxWidth: 960, margin: "0 auto" }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 10, width: 36, height: 36, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#64748b", transition: "all 0.2s", flexShrink: 0,
          }}>
            <ArrowLeft size={17} />
          </button>

          {/* Title block */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0, position: "relative", overflow: "hidden",
              background: "linear-gradient(145deg,rgba(6,182,212,0.28),rgba(6,182,212,0.06))",
              border: `1px solid ${passData.hasPremium ? "rgba(251,191,36,0.55)" : "rgba(6,182,212,0.30)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -6px 10px rgba(0,0,0,0.25)`,
            }}>
              {/* Anel interno — dá sensação de "brasão", não só ícone solto */}
              <div style={{ position: "absolute", inset: 3, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
              <Shield size={18} color={passData.hasPremium ? "#fbbf24" : "#06b6d4"} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.015em", color: "#f8fafc", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>Gear Pass</span>
                {passData.hasPremium && (
                  <span style={{
                    position: "relative", overflow: "hidden",
                    background: "linear-gradient(90deg,#b45309,#f59e0b)",
                    borderRadius: 5, padding: "2px 7px",
                    fontSize: 8, fontWeight: 900, color: "#000", letterSpacing: "0.08em",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                  }}>
                    PREMIUM
                    <div style={{ position: "absolute", inset: 0, width: "50%",
                      background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)",
                      animation: "shimmer 3.5s ease-in-out infinite" }} />
                  </span>
                )}
              </div>
              {/* Season pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px rgba(34,197,94,0.8)", animation: "pulseGlow 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Temporada {passData.seasonNumber}</span>
                <span style={{ fontSize: 10, color: "#334155" }}>·</span>
                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                  {seasonDaysLeft > 0 ? `Encerra em ${seasonDaysLeft} dia${seasonDaysLeft !== 1 ? "s" : ""}` : "Temporada encerrada"}
                </span>
              </div>
            </div>
          </div>

          {!passData.hasPremium && (
            <button onClick={() => setShowPremiumModal(true)} style={{
              position: "relative", overflow: "hidden",
              background: "linear-gradient(135deg,#78350f,#b45309,#d97706,#fbbf24)",
              border: "1px solid rgba(255,213,128,0.40)", borderRadius: 11, padding: "9px 18px",
              color: "#1c0a00", fontWeight: 900, fontSize: 11, cursor: "pointer",
              boxShadow: "0 4px 18px rgba(217,119,6,0.45), inset 0 1.5px 0 rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.20)",
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              letterSpacing: "0.02em",
            }}>
              <Crown size={13} />
              {PREMIUM_PRICE}
              <div style={{ position: "absolute", inset: 0, width: "45%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)",
                animation: "shimmer 3s ease-in-out infinite" }} />
            </button>
          )}
        </div>

        {/* Tabs com badges de notificação */}
        <div style={{ display:"flex",maxWidth:960,margin:"12px auto 0",borderTop:"1px solid rgba(255,255,255,0.05)" }}>
          {(["pass","missions"] as const).map(tab => {
            const badge = tab==="pass" ? trackPendingCount : missionPendingCount
            const active = activeTab===tab
            return (
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{
                flex:1,padding:"12px 0",border:"none",cursor:"pointer",fontWeight:800,fontSize:12,
                transition:"all 0.2s", position: "relative",
                background: active ? "linear-gradient(180deg,rgba(6,182,212,0.09),transparent)" : "transparent",
                color:active?"#22d3ee":"#334155",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              }}>
                {tab==="pass"?<Shield size={13}/>:<Star size={13}/>}
                {tab==="pass"?"Passe":"Missões"}
                {badge>0 && (
                  <div style={{
                    minWidth:16,height:16,borderRadius:99,padding:"0 4px",
                    background:"#ef4444",color:"#fff",fontSize:9,fontWeight:900,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    boxShadow:"0 0 8px rgba(239,68,68,0.55)",
                  }}>{badge>9?"9+":badge}</div>
                )}
                {active && (
                  <div style={{ position: "absolute", left: "20%", right: "20%", bottom: 0, height: 2, borderRadius: 99,
                    background: "linear-gradient(90deg,transparent,#22d3ee,transparent)",
                    boxShadow: "0 0 8px rgba(34,211,238,0.80)" }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Fechamento ornamental — linha · losango · linha, em vez de hairline seca */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,rgba(6,182,212,0.28))" }} />
          <div style={{ width: 4, height: 4, background: "rgba(6,182,212,0.55)", transform: "rotate(45deg)", boxShadow: "0 0 5px rgba(6,182,212,0.6)", flexShrink: 0 }} />
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(6,182,212,0.28),transparent)" }} />
        </div>
      </div>

      {/* ── AVISO DE TEMPORADA ENCERRANDO ── últimos 3 dias, lembra de coletar tudo */}
      {seasonDaysLeft > 0 && seasonDaysLeft <= 3 && (
        <div
          onClick={() => setActiveTab("pass")}
          style={{
            position: "relative", zIndex: 1, flexShrink: 0, cursor: "pointer",
            maxWidth: 960, margin: "0 auto", width: "100%",
            background: "rgba(245,158,11,0.12)", borderBottom: "1px solid rgba(245,158,11,0.30)",
            padding: "7px 16px", display: "flex", alignItems: "center", gap: 8,
          }}>
          <div style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
            background: "rgba(245,158,11,0.20)", border: "1px solid rgba(245,158,11,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <AlertTriangle size={11} color="#fbbf24" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700 }}>
            Temporada encerra em {seasonDaysLeft} dia{seasonDaysLeft !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 11, color: "#cbd5e1" }}>
            — não esqueça de coletar suas recompensas!
          </span>
          {trackPendingCount > 0 && (
            <span style={{
              marginLeft: "auto", flexShrink: 0, fontSize: 10, fontWeight: 800,
              color: "#fbbf24", background: "rgba(245,158,11,0.18)",
              padding: "2px 8px", borderRadius: 99,
            }}>
              {trackPendingCount} pendente{trackPendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* ── CONTENT (flex:1, sem scroll de página) ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", maxWidth: 960, margin: "0 auto", width: "100%" }}>

          {/* ── PASS TAB ── */}
          {activeTab === "pass" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* ── PROGRESS HERO — fundido visualmente com a trilha abaixo, ── */}
              {/* ── formando UM painel contínuo em vez de dois cards soltos ── */}
              <div style={{
                margin: "10px 14px 0", borderRadius: "18px 18px 0 0", flexShrink: 0,
                position: "relative", overflow: "hidden",
                background: "rgba(3,8,22,0.93)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderTop: passData.hasPremium ? "1px solid rgba(245,158,11,0.42)" : "1px solid rgba(6,182,212,0.32)",
                borderLeft: passData.hasPremium ? "1px solid rgba(245,158,11,0.42)" : "1px solid rgba(6,182,212,0.32)",
                borderRight: passData.hasPremium ? "1px solid rgba(245,158,11,0.42)" : "1px solid rgba(6,182,212,0.32)",
                boxShadow: passData.hasPremium
                  ? "0 8px 48px rgba(0,0,0,0.75), 0 0 30px rgba(245,158,11,0.08) inset"
                  : "0 8px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(6,182,212,0.08) inset",
                padding: "17px 18px 14px",
              }}>
                {/* Cap ornamental no topo — mesma linguagem visual do topo dos marcos na trilha */}
                <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 2, borderRadius: "0 0 3px 3px",
                  background: passData.hasPremium
                    ? "linear-gradient(90deg,transparent,#f59e0b,#fbbf24,#f59e0b,transparent)"
                    : "linear-gradient(90deg,transparent,#0891b2,#22d3ee,#0891b2,transparent)",
                  boxShadow: passData.hasPremium ? "0 0 10px rgba(251,191,36,0.7)" : "0 0 10px rgba(34,211,238,0.7)" }} />
                {/* Textura sutil — hairlines diagonais, dá densidade de "material premium" sem poluir */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5,
                  background: "repeating-linear-gradient(115deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 26px)" }} />
                {/* Decorative orb */}
                <div style={{ position:"absolute",top:-50,left:-50,width:180,height:180,borderRadius:"50%",pointerEvents:"none",
                  background:"radial-gradient(circle,rgba(6,182,212,0.10) 0%,transparent 65%)" }} />
                <div style={{ position:"absolute",top:0,right:0,width:100,height:100,pointerEvents:"none",
                  background:`radial-gradient(circle at top right,${passData.hasPremium?"rgba(245,158,11,0.09)":"rgba(139,92,246,0.08)"},transparent 60%)` }} />

                {/* Passe 100% completo — substitui a linha de nível + teaser */}
                {isPassComplete ? (
                  <div style={{
                    position: "relative", textAlign: "center", padding: "8px 0 10px",
                    marginBottom: 12,
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 16, margin: "0 auto 8px",
                      background: "linear-gradient(145deg,#78350f,#d97706,#fbbf24)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 6px 20px rgba(217,119,6,0.40), inset 0 1.5px 0 rgba(255,255,255,0.35), inset 0 -4px 8px rgba(0,0,0,0.25)",
                    }}>
                      <Trophy size={26} color="#fff" strokeWidth={2} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24", letterSpacing: "-0.01em" }}>
                      Passe Completo!
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                      Você coletou todas as recompensas da Temporada {passData.seasonNumber}
                    </div>
                  </div>
                ) : (
                /* Level + teaser de próxima recompensa (sem repetir pts, que já está na barra abaixo) */
                <div style={{ position:"relative", display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:12 }}>
                  <div style={{ position: "relative" }}>
                    {/* Halo atrás do número — dá peso de "hero" sem virar um anel de progresso redundante */}
                    <div style={{ position: "absolute", left: -14, top: -10, width: 84, height: 84, borderRadius: "50%", pointerEvents: "none",
                      background: `radial-gradient(circle, ${passData.hasPremium ? "rgba(251,191,36,0.16)" : "rgba(6,182,212,0.18)"} 0%, transparent 70%)` }} />
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.20em", marginBottom: 2, position: "relative" }}>NÍVEL</div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:6, lineHeight:1, position: "relative" }}>
                      <span style={{ fontSize:46, fontWeight:900, color:"#f8fafc", letterSpacing:"-0.045em",
                        textShadow: `0 2px 12px ${passData.hasPremium ? "rgba(251,191,36,0.35)" : "rgba(6,182,212,0.40)"}, 0 1px 2px rgba(0,0,0,0.6)` }}>
                        {passData.currentLevel}
                      </span>
                      <span style={{ fontSize:14, color:"#334155", fontWeight:700 }}>/ {MAX_LEVELS}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right", maxWidth:180 }}>
                    {passData.currentLevel >= MAX_LEVELS ? (
                      <div style={{ background:"linear-gradient(135deg,#d97706,#fbbf24)",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:900,color:"#000" }}>MAX</div>
                    ) : nextRewardEntry ? (
                      <>
                        <div style={{ fontSize:9,color:"#475569",marginBottom:2,letterSpacing:"0.04em" }}>PRÓXIMA RECOMPENSA</div>
                        <div style={{ fontSize:12,fontWeight:800,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                          {nextRewardEntry.common?.label ?? "Recompensa"} · Lv.{nextRewardEntry.level}
                        </div>
                        <div style={{ fontSize:10,color:"#06b6d4",marginTop:1,fontWeight:600 }}>
                          {nextRewardEntry.level - passData.currentLevel} nível{nextRewardEntry.level - passData.currentLevel !== 1 ? "s" : ""} restante{nextRewardEntry.level - passData.currentLevel !== 1 ? "s" : ""}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize:11,color:"#22c55e",fontWeight:700 }}>✓ Tudo coletado!</div>
                    )}
                  </div>
                </div>
                )}

                {/* Divisor ornamental — linha · losango · linha, separa hero dos cards de passe */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, margin: "2px 0 10px", position: "relative" }}>
                  <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.10))" }} />
                  <div style={{ width: 3.5, height: 3.5, background: "rgba(255,255,255,0.20)", transform: "rotate(45deg)", flexShrink: 0 }} />
                  <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(255,255,255,0.10),transparent)" }} />
                </div>

                {/* Pass type cards */}
                <div style={{ display:"flex", gap:8, position:"relative" }}>
                  {/* Common */}
                  <div style={{ flex:1,borderRadius:12,padding:"9px 12px",
                    background:"linear-gradient(160deg,rgba(6,182,212,0.10),rgba(6,182,212,0.04))",backdropFilter:"blur(8px)",
                    border:"1px solid rgba(6,182,212,0.22)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -8px 14px -8px rgba(0,0,0,0.35)",
                    display:"flex",alignItems:"center",gap:9 }}>
                    <div style={{ width:29,height:29,borderRadius:8,flexShrink:0, position:"relative",
                      background:"rgba(6,182,212,0.16)",border:"1px solid rgba(6,182,212,0.30)",
                      boxShadow:"inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -3px 5px rgba(0,0,0,0.25)",
                      display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Shield size={13} color="#22d3ee" />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:800,fontSize:11,color:"#22d3ee" }}>Passe Comum</div>
                      <div style={{ fontSize:9,color:"#475569" }}>Grátis · Sempre ativo</div>
                    </div>
                    <div style={{ marginLeft:"auto",flexShrink:0,width:17,height:17,borderRadius:"50%",
                      background:"rgba(34,197,94,0.16)",border:"1.5px solid rgba(34,197,94,0.40)",
                      display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Check size={9} color="#4ade80" strokeWidth={3} />
                    </div>
                  </div>
                  {/* Premium — badge com contagem retroativa reforça o teaser antes mesmo de abrir o modal */}
                  <div onClick={passData.hasPremium ? undefined : () => setShowPremiumModal(true)} style={{
                    flex:1,borderRadius:12,padding:"9px 12px",position:"relative",
                    background: passData.hasPremium ? "linear-gradient(160deg,rgba(245,158,11,0.16),rgba(217,119,6,0.06))" : "rgba(92,40,10,0.10)",
                    backdropFilter:"blur(8px)",
                    border:`1px solid ${passData.hasPremium ? "rgba(251,191,36,0.35)" : "rgba(92,40,10,0.25)"}`,
                    boxShadow: passData.hasPremium
                      ? "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -8px 14px -8px rgba(0,0,0,0.35)"
                      : "inset 0 2px 6px rgba(0,0,0,0.30)",
                    display:"flex",alignItems:"center",gap:9,cursor:passData.hasPremium?"default":"pointer" }}>
                    {/* Badge "N esperando" */}
                    {!passData.hasPremium && retroactivePremiumCount > 0 && (
                      <div style={{
                        position:"absolute", top:-7, right:-6,
                        minWidth:18, height:18, borderRadius:99, padding:"0 5px",
                        background:"#ef4444", color:"#fff", fontSize:9, fontWeight:900,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        boxShadow:"0 0 10px rgba(239,68,68,0.60)", border:"2px solid rgba(3,8,22,0.93)",
                      }}>{retroactivePremiumCount > 9 ? "9+" : retroactivePremiumCount}</div>
                    )}
                    <div style={{ width:29,height:29,borderRadius:8,flexShrink:0,
                      background:passData.hasPremium?"rgba(245,158,11,0.18)":"rgba(92,40,10,0.20)",
                      border:`1px solid ${passData.hasPremium?"rgba(251,191,36,0.35)":"rgba(92,40,10,0.28)"}`,
                      boxShadow: passData.hasPremium
                        ? "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -3px 5px rgba(0,0,0,0.25)"
                        : "inset 0 2px 5px rgba(0,0,0,0.35)",
                      display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Crown size={13} color={passData.hasPremium?"#fbbf24":"#78350f"} />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:800,fontSize:11,color:passData.hasPremium?"#fbbf24":"#a16207" }}>Passe Premium</div>
                      <div style={{ fontSize:9,color:"#475569" }}>{passData.hasPremium?"Ativo ✓":PREMIUM_PRICE}</div>
                    </div>
                    {!passData.hasPremium && (
                      <div style={{ marginLeft:"auto",flexShrink:0,background:"linear-gradient(135deg,#92400e,#d97706)",
                        borderRadius:6,padding:"2px 7px",fontSize:8,fontWeight:900,color:"#fff",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)" }}>Desbloquear</div>
                    )}
                  </div>
                </div>

                {/* Costura — selo ornamental que marca a transição pro painel da trilha,
                    substitui o antigo gap entre dois cards separados por UM painel contínuo */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "13px -18px -14px", padding: "0 18px",
                  position: "relative", height: 1 }}>
                  <div style={{ position: "absolute", left: 18, right: 18, height: 1,
                    background: `linear-gradient(90deg,transparent,${passData.hasPremium ? "rgba(251,191,36,0.30)" : "rgba(6,182,212,0.30)"} 20%,${passData.hasPremium ? "rgba(251,191,36,0.30)" : "rgba(6,182,212,0.30)"} 80%,transparent)` }} />
                  <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) rotate(45deg)",
                    width: 5, height: 5, background: passData.hasPremium ? "#fbbf24" : "#22d3ee",
                    boxShadow: `0 0 8px ${passData.hasPremium ? "rgba(251,191,36,0.8)" : "rgba(34,211,238,0.8)"}` }} />
                </div>
              </div>

              {/* ── REWARD TRACK ── */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
                background: "rgba(3,8,22,0.93)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                borderRadius: "0 0 14px 14px", margin: "0 14px 0",
                borderBottom: passData.hasPremium ? "1px solid rgba(245,158,11,0.42)" : "1px solid rgba(6,182,212,0.32)",
                borderLeft: passData.hasPremium ? "1px solid rgba(245,158,11,0.42)" : "1px solid rgba(6,182,212,0.32)",
                borderRight: passData.hasPremium ? "1px solid rgba(245,158,11,0.42)" : "1px solid rgba(6,182,212,0.32)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.50)",
              }}>
                {/* ── XP BAR FUNDIDA ── Lv badge + barra full-width + pts, ponta a ponta */}
                <div style={{ padding: "12px 14px 10px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10,
                  borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ flexShrink: 0, background: "rgba(6,182,212,0.12)",
                    border: "1px solid rgba(6,182,212,0.32)", borderRadius: 8,
                    padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                    <Zap size={11} color="#06b6d4" />
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#06b6d4" }}>Lv.{passData.currentLevel}</span>
                  </div>

                  <div style={{ flex: 1, position: "relative", height: 10, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "visible" }}>
                    {/* Fill */}
                    <div style={{ height: "100%", borderRadius: 99, width: `${progressPct}%`,
                      background: "linear-gradient(90deg,#0369a1,#06b6d4,#22d3ee)",
                      boxShadow: "0 0 14px rgba(6,182,212,0.60)",
                      transition: "width 0.8s cubic-bezier(.4,0,.2,1)", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, width: "40%",
                        background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent)",
                        animation: "shimmer 2.2s ease-in-out infinite" }} />
                    </div>
                    {/* Marcadores dos marcos — posicionados pela % de pts acumulados */}
                    {[10, 25, 50, 75, 100].map(ml => {
                      const markerPct = Math.round((totalPtsToReachLevel(ml) / totalPtsToReachLevel(MAX_LEVELS)) * 100)
                      const reached   = passData.currentLevel >= ml
                      return (
                        <div key={ml} style={{
                          position: "absolute", top: -3, bottom: -3,
                          left: `${markerPct}%`, width: 2,
                          background: reached ? "#fbbf24" : "rgba(255,255,255,0.25)",
                          borderRadius: 99, zIndex: 2,
                          boxShadow: reached ? "0 0 6px rgba(251,191,36,0.70)" : "none",
                          transform: "translateX(-50%)",
                        }}>
                          {/* Tooltip do marco — visível ao hover via title */}
                          <div title={`Lv.${ml}`} style={{ position: "absolute", inset: "-6px -4px" }} />
                        </div>
                      )
                    })}
                  </div>

                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#64748b", fontFamily: "monospace" }}>
                    {passData.currentLevel >= MAX_LEVELS ? "MAX" : `${pointsInCurrentLevel}/${nextLevelCost}`}
                  </span>
                </div>

                {/* Elegant section header + Coletar Pendentes — minHeight fixo evita
                    que o header "pule" de tamanho quando o FAB 📍 ou o botão
                    "Coletar Pendentes" aparecem/somem durante o arrasto da trilha */}
                <div style={{ padding: "8px 14px 8px", flexShrink: 0, display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 8, minHeight: 38 }}>
                  <div style={{ width: 3.5, height: 3.5, background: "rgba(6,182,212,0.55)", transform: "rotate(45deg)", flexShrink: 0 }} />
                  <div style={{ height: 1, width: 12, background: "rgba(6,182,212,0.35)", flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.16em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    Trilha de Recompensas
                  </span>
                  <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg,rgba(6,182,212,0.25),transparent)" }} />
                  {/* 📍 Voltar pro nível atual — agora vive na mesma flex row que "Coletar Pendentes", nunca sobrepõe */}
                  {isAwayFromCurrent && (
                    <button onClick={scrollToCurrentLevel} style={{
                      flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", borderRadius: 20,
                      background: "rgba(6,182,212,0.16)", border: "1px solid rgba(6,182,212,0.45)",
                      color: "#06b6d4", fontSize: 10, fontWeight: 800, cursor: "pointer",
                      boxShadow: "0 0 10px rgba(6,182,212,0.20)",
                      animation: "fabIn 0.2s ease",
                    }}>
                      <MapPin size={11} strokeWidth={2.5} /> Lv.{passData.currentLevel}
                    </button>
                  )}
                  {/* Atalho pro próximo marco não alcançado */}
                  {nextMilestone && (
                    <button onClick={scrollToNextMilestone} style={{
                      flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", borderRadius: 20,
                      background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)",
                      color: "#fbbf24", fontSize: 10, fontWeight: 800, cursor: "pointer",
                    }}>
                      <Trophy size={11} strokeWidth={2.5} /> Lv.{nextMilestone} <ChevronRight size={11} strokeWidth={3} style={{ marginLeft: -2 }} />
                    </button>
                  )}
                  {trackPendingCount > 0 && (
                    <button onClick={handleClaimAllTrack} style={{
                      flexShrink: 0, padding: "4px 12px", borderRadius: 20,
                      border: "1px solid rgba(6,182,212,0.45)", background: "rgba(6,182,212,0.12)",
                      color: "#06b6d4", fontSize: 10, fontWeight: 800, cursor: "pointer",
                      boxShadow: "0 0 12px rgba(6,182,212,0.20)",
                      display: "flex", alignItems: "center", gap: 5,
                      animation: "pulseGlow 2s ease-in-out infinite",
                    }}>
                      <Gift size={11} /> Coletar Pendentes ({trackPendingCount})
                    </button>
                  )}
                </div>

                {/* Wrapper com setas e trilha scrollável — height FIXO explícito.
                    Sem isso, a altura era calculada a partir do conteúdo da trilha,
                    e qualquer variação durante os re-renders do drag (mesmo sutil)
                    causava a sensação de "tela subindo/oscilando" */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4, paddingLeft: 8, paddingRight: 8, height: 222, flexShrink: 0 }}>

                  {/* ← Seta anterior */}
                  <button
                    onClick={() => scrollTrack(-1)}
                    disabled={scrollLeft <= 0}
                    style={{
                      flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: scrollLeft <= 0 ? "rgba(255,255,255,0.02)" : "rgba(6,182,212,0.14)",
                      color: scrollLeft <= 0 ? "#1e293b" : "#06b6d4",
                      cursor: scrollLeft <= 0 ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 900, transition: "all 0.2s",
                      boxShadow: scrollLeft <= 0 ? "none" : "0 0 8px rgba(6,182,212,0.20)",
                      userSelect: "none",
                    }}>‹</button>

                  {/* Trilha scrollável — suporta toque, arrasto e setas */}
                  <div
                    ref={passRowRef}
                    className="gp-track"
                    style={{
                      flex: 1,
                      height: "100%",
                      overflowX: "scroll",
                      overflowY: "hidden",
                      // Oculta scrollbar no Firefox
                      scrollbarWidth: "none",
                      // Cursor de "agarrar"
                      cursor: "grab",
                      // Permite pan horizontal no touch sem interferir no scroll vertical da página
                      touchAction: "pan-x",
                      // Trava o bounce/rubber-band — sem isso, o gesto de arrastar
                      // horizontal "vaza" verticalmente em alguns navegadores (Safari/iOS),
                      // causando a sensação de tela subindo/oscilando durante o drag
                      overscrollBehavior: "contain",
                      // Evita seleção de texto enquanto arrasta
                      userSelect: "none",
                    }}
                    onMouseDown={handleTrackMouseDown}
                    onMouseMove={handleTrackMouseMove}
                    onMouseUp={handleTrackMouseUp}
                    onMouseLeave={handleTrackMouseUp}
                  >
                    {/* Wrapper com largura total + spine (rail) único atravessando a trilha */}
                    <div style={{ position: "relative", width: `${trackTotalWidth}px` }}>
                      {/* Spine — rail único na altura dos badges de nível, "contas no fio" */}
                      <div style={{
                        position: "absolute", left: 8, right: 8, top: 83, height: 2, zIndex: 0,
                        background: "linear-gradient(90deg,rgba(6,182,212,0.06),rgba(6,182,212,0.40) 8%,rgba(6,182,212,0.40) 92%,rgba(6,182,212,0.06))",
                      }} />

                      <div style={{
                          display: "flex",
                          alignItems: "stretch",
                          paddingLeft: 8,
                          paddingRight: 8,
                          position: "relative", zIndex: 1,
                        }}
                      >
                      {levelGroups.map((lg) => {
                        const isCurrent   = lg.level === passData.currentLevel + 1
                        const isPast      = lg.level <= passData.currentLevel
                        const isMilestone = MILESTONE_LEVELS.has(lg.level)
                        const colW   = isMilestone ? MILESTONE_COL_WIDTH : NORMAL_COL_WIDTH
                        const boxSz  = 64  // mesma altura para marcos e colunas normais (aumentado de 54)
                        // Estados "pronto para coletar" — alimentam o glow pulsante
                        const commonClaimable  = isPast && !lg.commonClaimed
                        const premiumClaimable = isPast && !lg.premiumClaimed && passData.hasPremium
                        // Cascata: se este nível foi tocado num "Coletar Pendentes", calcula o delay
                        // sequencial pra animação de flash em cima das duas caixinhas
                        const cascadeIdx   = cascadeTrackLevels.indexOf(lg.level)
                        const cascadeDelay = cascadeIdx === -1 ? 0 : cascadeIdx * CASCADE_STEP_MS

                        return (
                          <div
                            key={lg.level}
                            data-level={lg.level}
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            {/* Coluna do nível — height fixo + overflow:hidden garante que
                                nenhum elemento (glow, sombra) cause percepção de "levanta"
                                ao cruzar o viewport durante o arrasto */}
                            <div style={{
                              width: colW, flexShrink: 0,
                              height: 216, overflow: "hidden", position: "relative",
                              display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "center", gap: 3,
                              ...(isMilestone ? {
                                background: "linear-gradient(160deg,rgba(245,158,11,0.10),rgba(6,182,212,0.05))",
                                borderLeft: "2px solid rgba(245,158,11,0.32)",
                                borderRight: "2px solid rgba(245,158,11,0.32)",
                              } : {}),
                            }}>
                              {/* Molduras de canto — transforma o marco numa "medalha" de verdade.
                                  Puramente decorativo/absolute: zero impacto na altura fixa da coluna. */}
                              {isMilestone && (
                                <>
                                  {/* Faixa dourada no topo — mesmo motivo do cap no Progress Hero, amarra a tela toda */}
                                  <div style={{ position:"absolute", top:0, left:"14%", right:"14%", height:2, borderRadius:"0 0 2px 2px",
                                    background:"linear-gradient(90deg,transparent,#f59e0b,#fde68a,#f59e0b,transparent)",
                                    boxShadow:"0 0 8px rgba(251,191,36,0.65)", pointerEvents:"none" }} />
                                  <div style={{ position:"absolute", top:12, left:4, width:10, height:10,
                                    borderTop:"1.5px solid rgba(251,191,36,0.55)", borderLeft:"1.5px solid rgba(251,191,36,0.55)",
                                    borderTopLeftRadius:3, pointerEvents:"none" }} />
                                  <div style={{ position:"absolute", top:12, right:4, width:10, height:10,
                                    borderTop:"1.5px solid rgba(251,191,36,0.55)", borderRight:"1.5px solid rgba(251,191,36,0.55)",
                                    borderTopRightRadius:3, pointerEvents:"none" }} />
                                  <div style={{ position:"absolute", bottom:12, left:4, width:10, height:10,
                                    borderBottom:"1.5px solid rgba(251,191,36,0.55)", borderLeft:"1.5px solid rgba(251,191,36,0.55)",
                                    borderBottomLeftRadius:3, pointerEvents:"none" }} />
                                  <div style={{ position:"absolute", bottom:12, right:4, width:10, height:10,
                                    borderBottom:"1.5px solid rgba(251,191,36,0.55)", borderRight:"1.5px solid rgba(251,191,36,0.55)",
                                    borderBottomRightRadius:3, pointerEvents:"none" }} />
                                </>
                              )}

                              {/* ── PREMIUM reward (topo) ── */}
                              <button
                                onClick={() => { if (isPast) handleClaimPassReward(lg.level, true) }}
                                onMouseDown={() => handlePressStart(lg.level, true, lg.premiumClaimed)}
                                onMouseUp={handlePressEnd}
                                onMouseLeave={handlePressEnd}
                                onTouchStart={() => handlePressStart(lg.level, true, lg.premiumClaimed)}
                                onTouchEnd={handlePressEnd}
                                title={lg.premiumClaimed ? "Segure para ver detalhes" : undefined}
                                style={{
                                  width: boxSz, height: boxSz, borderRadius: 13,
                                  display: "flex", flexDirection: "column", alignItems: "center",
                                  justifyContent: "center", gap: 1,
                                  cursor: isPast && passData.hasPremium ? "pointer" : "default",
                                  border: `1.5px solid ${
                                    lg.premiumClaimed          ? "rgba(34,197,94,0.50)"   :
                                    isPast && passData.hasPremium ? "rgba(251,191,36,0.60)" :
                                    isPast                     ? "rgba(251,191,36,0.28)"  :
                                    "rgba(251,191,36,0.16)"
                                  }`,
                                  background: lg.premiumClaimed
                                    ? "rgba(34,197,94,0.10)"
                                    : isPast && passData.hasPremium
                                    ? "linear-gradient(160deg,rgba(245,158,11,0.20),rgba(180,83,9,0.10))"
                                    : isPast
                                    ? "rgba(217,119,6,0.10)"
                                    : "linear-gradient(145deg,rgba(180,83,9,0.14),rgba(120,53,15,0.08))",
                                  // Soquete real: recessado (inset escuro) quando bloqueado/vazio,
                                  // rim-light no topo quando disponível — como luz pegando a borda de metal
                                  boxShadow: lg.premiumClaimed
                                    ? "0 0 10px rgba(34,197,94,0.20), inset 0 0 6px rgba(34,197,94,0.08), inset 0 1px 0 rgba(255,255,255,0.10)"
                                    : isPast && passData.hasPremium
                                    ? "inset 0 1.5px 0 rgba(255,255,255,0.18), inset 0 -4px 8px rgba(0,0,0,0.25)"
                                    : !isPast
                                    ? "inset 0 3px 7px rgba(0,0,0,0.45), inset 0 0 14px rgba(251,191,36,0.05)"
                                    : "inset 0 2px 5px rgba(0,0,0,0.30)",
                                  // Cascata tem prioridade (flash sequencial); senão, o pulso normal de "pronto pra coletar"
                                  animation: cascadeIdx !== -1
                                    ? `cascadeFlash 0.5s ease ${cascadeDelay}ms`
                                    : premiumClaimable ? "claimPulseAmber 2s ease-in-out infinite" : "none",
                                  position: "relative", transition: "all 0.2s",
                                }}>
                                {lg.premiumClaimed ? (
                                  <div style={{
                                    width: 36, height: 36, borderRadius: "50%",
                                    background: "rgba(34,197,94,0.22)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    // Pop do checkmark — só anima no claim que acabou de acontecer
                                    animation: justClaimed?.level === lg.level && justClaimed.isPremium
                                      ? "claimPop 0.5s cubic-bezier(.2,1.4,.4,1)"
                                      : "none",
                                  }}>
                                    <Check size={19} color="#22c55e" strokeWidth={3} />
                                  </div>
                                ) : !isPast ? (
                                  <Lock size={16} color="#78350f" />
                                ) : lg.premium ? (
                                  <RewardIcon reward={lg.premium} />
                                ) : null}
                                <Crown size={8} color="#f59e0b" style={{ position: "absolute", top: 3, right: 3 }} />
                                {/* Ponto de raridade — card_pack com rarity definida */}
                                {lg.premium?.type === "card_pack" && lg.premium.rarity && (
                                  <div style={{
                                    position: "absolute", top: 3, left: 3, width: 6, height: 6, borderRadius: "50%",
                                    background: { R:"#60a5fa", SR:"#a855f7", UR:"#fbbf24", LR:"#ef4444" }[lg.premium.rarity] ?? "#94a3b8",
                                    boxShadow: `0 0 4px ${{ R:"rgba(96,165,250,0.8)", SR:"rgba(168,85,247,0.8)", UR:"rgba(251,191,36,0.8)", LR:"rgba(239,68,68,0.8)" }[lg.premium.rarity] ?? "none"}`,
                                  }} />
                                )}
                              </button>

                              {/* Conector vertical superior */}
                              <div style={{ width: 2, height: 12, background: isPast ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.06)", borderRadius: 99 }} />

                              {/* Badge do nível — sem boxShadow (o glow vazava pra fora dos bounds
                                  do elemento e criava percepção de "levanta" durante o drag) */}
                              <div style={{
                                width: isMilestone ? 54 : 42, height: 26, borderRadius: 8, zIndex: 1,
                                background: isMilestone
                                  ? (isCurrent ? "linear-gradient(135deg,#92400e,#d97706)" : isPast ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.06)")
                                  : (isCurrent ? "linear-gradient(135deg,#0e7490,#0369a1)" : isPast ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.05)"),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: `1.5px solid ${
                                  isMilestone
                                    ? (isCurrent ? "rgba(245,158,11,0.80)" : isPast ? "rgba(245,158,11,0.32)" : "rgba(245,158,11,0.16)")
                                    : (isCurrent ? "rgba(6,182,212,0.80)" : isPast ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.07)")
                                }`,
                              }}>
                                <span style={{ fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", gap: 2, color:
                                  isMilestone
                                    ? (isCurrent ? "#fde68a" : isPast ? "#fbbf24" : "#78350f")
                                    : (isCurrent ? "#e0f2fe" : isPast ? "#38bdf8" : "#334155")
                                }}>
                                  {isMilestone && <Trophy size={10} strokeWidth={2.5} />}{lg.level}
                                </span>
                              </div>

                              {/* Conector vertical inferior */}
                              <div style={{ width: 2, height: 12, background: isPast ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.06)", borderRadius: 99 }} />

                              {/* ── COMMON reward (baixo) — TRILHA ATIVA ── */}
                              <button
                                onClick={() => { if (isPast) handleClaimPassReward(lg.level, false) }}
                                onMouseDown={() => handlePressStart(lg.level, false, lg.commonClaimed)}
                                onMouseUp={handlePressEnd}
                                onMouseLeave={handlePressEnd}
                                onTouchStart={() => handlePressStart(lg.level, false, lg.commonClaimed)}
                                onTouchEnd={handlePressEnd}
                                title={lg.commonClaimed ? "Segure para ver detalhes" : undefined}
                                style={{
                                  width: boxSz, height: boxSz, borderRadius: 13,
                                  display: "flex", flexDirection: "column", alignItems: "center",
                                  justifyContent: "center", gap: 1,
                                  cursor: isPast ? "pointer" : "default",
                                  border: `1.5px solid ${
                                    lg.commonClaimed ? "rgba(34,197,94,0.55)" :
                                    isPast           ? "rgba(6,182,212,0.50)"  :
                                    isCurrent        ? "rgba(6,182,212,0.28)"  :
                                    isMilestone      ? "rgba(245,158,11,0.20)" :
                                    "rgba(255,255,255,0.07)"
                                  }`,
                                  background: lg.commonClaimed
                                    ? "rgba(34,197,94,0.12)"
                                    : isPast   ? "linear-gradient(160deg,rgba(6,182,212,0.16),rgba(6,182,212,0.06))"
                                    : isCurrent ? "rgba(6,182,212,0.07)"
                                    : isMilestone ? "rgba(245,158,11,0.05)"
                                    : "rgba(255,255,255,0.03)",
                                  // Soquete real: recessado (inset escuro) quando bloqueado, rim-light no topo quando disponível
                                  boxShadow: lg.commonClaimed
                                    ? "0 0 12px rgba(34,197,94,0.25), inset 0 0 8px rgba(34,197,94,0.10), inset 0 1px 0 rgba(255,255,255,0.10)"
                                    : isPast
                                    ? `inset 0 1.5px 0 rgba(255,255,255,0.16), inset 0 -4px 8px rgba(0,0,0,0.22)${isCurrent ? ", 0 0 16px rgba(6,182,212,0.45)" : ""}`
                                    : "inset 0 3px 7px rgba(0,0,0,0.42)",
                                  animation: cascadeIdx !== -1
                                    ? `cascadeFlash 0.5s ease ${cascadeDelay}ms`
                                    : commonClaimable ? "claimPulseCyan 2s ease-in-out infinite" : "none",
                                  transition: "all 0.2s",
                                  opacity: lg.commonClaimed ? 0.85 : 1,
                                  position: "relative",
                                }}>
                                {lg.commonClaimed ? (
                                  <div style={{
                                    width: 36, height: 36, borderRadius: "50%",
                                    background: "rgba(34,197,94,0.22)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    animation: justClaimed?.level === lg.level && !justClaimed.isPremium
                                      ? "claimPop 0.5s cubic-bezier(.2,1.4,.4,1)"
                                      : "none",
                                  }}>
                                    <Check size={19} color="#22c55e" strokeWidth={3} />
                                  </div>
                                ) : !isPast ? (
                                  <Lock size={16} color="#334155" />
                                ) : lg.common ? (
                                  <RewardIcon reward={lg.common} />
                                ) : null}
                                {/* Label do marco — absolutamente posicionado dentro da
                                    caixinha, sem afetar o height do fluxo da coluna */}
                                {isMilestone && lg.common?.label && !lg.commonClaimed && !isPast && (
                                  <div style={{
                                    position: "absolute", bottom: 4, left: 0, right: 0,
                                    textAlign: "center", fontSize: 7, fontWeight: 900,
                                    color: "#fbbf24", letterSpacing: "0.04em",
                                    overflow: "hidden", textOverflow: "ellipsis",
                                    whiteSpace: "nowrap", padding: "0 3px",
                                  }}>
                                    {lg.common.label.toUpperCase()}
                                  </div>
                                )}
                                {/* Ponto de raridade — card_pack com rarity definida */}
                                {lg.common?.type === "card_pack" && lg.common.rarity && (
                                  <div style={{
                                    position: "absolute", top: 3, left: 3, width: 6, height: 6, borderRadius: "50%",
                                    background: { R:"#60a5fa", SR:"#a855f7", UR:"#fbbf24", LR:"#ef4444" }[lg.common.rarity] ?? "#94a3b8",
                                    boxShadow: `0 0 4px ${{ R:"rgba(96,165,250,0.8)", SR:"rgba(168,85,247,0.8)", UR:"rgba(251,191,36,0.8)", LR:"rgba(239,68,68,0.8)" }[lg.common.rarity] ?? "none"}`,
                                  }} />
                                )}
                              </button>

                            </div>
                          </div>
                        )
                      })}
                      </div>{/* fim flex row de colunas */}
                    </div>{/* fim wrapper relative + spine */}
                  </div>

                  {/* → Seta próximo */}
                  <button
                    onClick={() => scrollTrack(1)}
                    disabled={scrollLeft >= scrollMax - 1}
                    style={{
                      flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: scrollLeft >= scrollMax - 1 ? "rgba(255,255,255,0.02)" : "rgba(6,182,212,0.14)",
                      color: scrollLeft >= scrollMax - 1 ? "#1e293b" : "#06b6d4",
                      cursor: scrollLeft >= scrollMax - 1 ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 900, transition: "all 0.2s",
                      boxShadow: scrollLeft >= scrollMax - 1 ? "none" : "0 0 8px rgba(6,182,212,0.20)",
                      userSelect: "none",
                    }}>›</button>
                </div>

                {/* Legenda — chips agrupados, leitura rápida */}
                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, padding: "8px 16px 10px" }}>
                  {[
                    { icon: <Crown size={9} color="#f59e0b" />, label: "Premium", color: "#94a3b8" },
                    { icon: <Shield size={9} color="#06b6d4" />, label: "Trilha Ativa", color: "#06b6d4", bold: true },
                    { icon: <Trophy size={9} color="#fbbf24" strokeWidth={2.5} />, label: "Marco", color: "#fbbf24", bold: true },
                    { icon: <div style={{ width: 6, height: 6, borderRadius: 99, background: "#06b6d4", boxShadow: "0 0 6px rgba(6,182,212,0.9)" }} />, label: "Pronto", color: "#94a3b8" },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 20, padding: "3px 9px 3px 7px",
                    }}>
                      {item.icon}
                      <span style={{ fontSize: 9, color: item.color, fontWeight: item.bold ? 700 : 500 }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── MISSIONS TAB ── */}
          {activeTab === "missions" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
              padding: "10px 14px 0", position: "relative",
              background: "rgba(3,8,22,0.93)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              margin: "8px 14px 6px", borderRadius: 16,
              border: passData.hasPremium ? "1px solid rgba(245,158,11,0.42)" : "1px solid rgba(6,182,212,0.32)",
              boxShadow: passData.hasPremium
                ? "0 8px 32px rgba(0,0,0,0.65), 0 0 24px rgba(245,158,11,0.06) inset"
                : "0 8px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(6,182,212,0.06) inset",
            }}>
              {/* Cap ornamental no topo — mesma linguagem visual do Passe, fecha a consistência entre abas */}
              <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 2, borderRadius: "0 0 3px 3px",
                background: passData.hasPremium
                  ? "linear-gradient(90deg,transparent,#f59e0b,#fbbf24,#f59e0b,transparent)"
                  : "linear-gradient(90deg,transparent,#0891b2,#22d3ee,#0891b2,transparent)",
                boxShadow: passData.hasPremium ? "0 0 10px rgba(251,191,36,0.7)" : "0 0 10px rgba(34,211,238,0.7)" }} />
              {/* Textura sutil — mesmo padrão do Progress Hero */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.4, borderRadius: 16,
                background: "repeating-linear-gradient(115deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 26px)" }} />
              {/* Filter pills + Coletar Tudo */}
              <div style={{ flexShrink: 0, display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", alignItems: "center" }}>
                {(["all", "daily", "weekly", "limited"] as const).map(f => {
                  const isActive = missionFilter === f
                  // Progresso por tipo visível no próprio botão de filtro
                  const prog = f !== "all" ? missionProgress(f as PassMission["type"]) : null
                  const allDoneHere = prog && prog.total > 0 && prog.done === prog.total
                  return (
                    <button key={f} onClick={() => setMissionFilter(f)} style={{
                      padding: "5px 12px", borderRadius: 20,
                      cursor: "pointer", fontWeight: 800, fontSize: 11, whiteSpace: "nowrap",
                      transition: "all 0.2s",
                      background: isActive
                        ? "linear-gradient(135deg,rgba(6,182,212,0.25),rgba(139,92,246,0.20))"
                        : "rgba(255,255,255,0.05)",
                      color: isActive ? "#e2e8f0" : "#475569",
                      border: `1px solid ${isActive ? "rgba(6,182,212,0.30)" : "rgba(255,255,255,0.07)"}`,
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      {f === "all" ? "Todas" : f === "daily" ? "Diárias" : f === "weekly" ? "Semanais" : "Limitadas"}
                      {/* Indicador "X/Y" no próprio filtro */}
                      {prog && prog.total > 0 && (
                        <span style={{
                          fontSize: 9, fontWeight: 900, lineHeight: 1,
                          color: allDoneHere ? "#4ade80" : isActive ? "#06b6d4" : "#334155",
                          background: allDoneHere ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)",
                          borderRadius: 99, padding: "1px 5px",
                        }}>
                          {allDoneHere ? "✓" : `${prog.done}/${prog.total}`}
                        </span>
                      )}
                    </button>
                  )
                })}
                <div style={{ flex: 1 }} />
                {/* Coletar Tudo */}
                <button
                  onClick={handleClaimAll}
                  disabled={claimableCount === 0}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "none",
                    cursor: claimableCount > 0 ? "pointer" : "not-allowed",
                    fontWeight: 800, fontSize: 11, whiteSpace: "nowrap",
                    transition: "all 0.2s",
                    background: claimableCount > 0
                      ? "linear-gradient(135deg,#16a34a,#22c55e)"
                      : "rgba(255,255,255,0.04)",
                    color: claimableCount > 0 ? "#fff" : "#334155",
                    boxShadow: claimableCount > 0 ? "0 2px 12px rgba(34,197,94,0.35)" : "none",
                    opacity: claimableCount > 0 ? 1 : 0.5,
                  }}>
                  ✓ Coletar Tudo{claimableCount > 0 ? ` (${claimableCount})` : ""}
                </button>
              </div>

              {/* Countdown de reset — diárias e semanais */}
              {(missionFilter === "daily" || missionFilter === "all") && resetCountdown && (
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, marginBottom: 10, marginTop: -4 }}>
                  <RefreshCw size={10} color="#475569" />
                  <span style={{ fontSize: 10, color: "#475569" }}>
                    Missões diárias resetam em <span style={{ color: "#06b6d4", fontWeight: 700, fontFamily: "monospace" }}>{resetCountdown}</span>
                  </span>
                </div>
              )}

              {/* Info banner */}
              <div style={{
                background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.18)",
                borderRadius: 14, padding: "10px 14px", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 11,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: "rgba(6,182,212,0.14)", border: "1px solid rgba(6,182,212,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
                }}>
                  <Zap size={14} color="#06b6d4" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12, color: "#e2e8f0" }}>
                    Complete missões para ganhar pontos!
                  </div>
                  <div style={{ fontSize: 10, color: "#475569" }}>
                    Os pontos sobem tanto no Passe Comum quanto no Premium.
                  </div>
                </div>
              </div>

              {/* Mission list — scrolls internally so page never scrolls */}
              <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
                {filteredMissions.length === 0 ? (
                  // Estado vazio — evita lista em branco sem explicação
                  <div style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "40px 20px", textAlign: "center",
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 16, opacity: 0.5,
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {missionFilter === "limited" ? <Clock size={22} color="#94a3b8" /> : missionFilter === "weekly" ? <Calendar size={22} color="#94a3b8" /> : <Zap size={22} color="#94a3b8" />}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>
                      {missionFilter === "limited"
                        ? "Nenhuma missão limitada disponível"
                        : missionFilter === "weekly"
                        ? "Nenhuma missão semanal disponível"
                        : "Nenhuma missão diária disponível"}
                    </div>
                    <div style={{ fontSize: 11, color: "#334155" }}>
                      {missionFilter === "limited" ? "Volte mais tarde para novos eventos especiais." : "Volte mais tarde para novas missões."}
                    </div>
                  </div>
                ) : missionFilter === "all" ? (
                  // Filtro "Todas": agrupa por tipo com cabeçalho de seção
                  (["daily", "weekly", "limited"] as const).map(type => {
                    const group = missions.filter(m => m.type === type)
                    if (group.length === 0) return null
                    const labels = { daily: "Diárias", weekly: "Semanais", limited: "Limitadas" }
                    const groupIcons = { daily: Zap, weekly: Calendar, limited: Clock }
                    const colors = { daily: "#22d3ee", weekly: "#c084fc", limited: "#fbbf24" }
                    const GroupIcon = groupIcons[type]
                    return (
                      <div key={type}>
                        {/* Cabeçalho de grupo */}
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, marginTop: type === "daily" ? 0 : 4 }}>
                          <GroupIcon size={11} color={colors[type]} strokeWidth={2.5} />
                          <span style={{ fontSize: 10, fontWeight: 800, color: colors[type], letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            {labels[type]}
                          </span>
                          <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg,${colors[type]}40,transparent)` }} />
                        </div>
                        {/* Missões do grupo */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {group.map(mission => {
                            const cIdx = cascadeMissionIds.indexOf(mission.id)
                            return (
                              <MissionCard
                                key={mission.id}
                                mission={mission}
                                onClaim={handleClaimMission}
                                cascadeDelay={cIdx === -1 ? null : cIdx * CASCADE_STEP_MS}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  filteredMissions.map(mission => {
                    const cIdx = cascadeMissionIds.indexOf(mission.id)
                    return (
                      <MissionCard
                        key={mission.id}
                        mission={mission}
                        onClaim={handleClaimMission}
                        cascadeDelay={cIdx === -1 ? null : cIdx * CASCADE_STEP_MS}
                      />
                    )
                  })
                )}
              </div>

              {/* ── Bônus de Conclusão — aparece nas abas Diárias e Semanais ── */}
              {(missionFilter === "daily" || missionFilter === "weekly") && (() => {
                const { allDone, claimed, pts } = getCompletionBonusState(missionFilter)
                const color = missionFilter === "daily" ? "#06b6d4" : "#a78bfa"
                const label = missionFilter === "daily" ? "Diárias" : "Semanais"
                const TypeIcon = missionFilter === "daily" ? Zap : Calendar
                return (
                  <div style={{
                    marginTop: 6,
                    padding: "14px 18px",
                    borderRadius: 14,
                    border: `1.5px solid ${claimed ? "rgba(34,197,94,0.40)" : allDone ? `${color}60` : "rgba(255,255,255,0.07)"}`,
                    background: claimed
                      ? "rgba(34,197,94,0.07)"
                      : allDone
                      ? `linear-gradient(135deg,${color}15,${color}06)`
                      : "rgba(255,255,255,0.02)",
                    boxShadow: allDone && !claimed ? `0 0 20px ${color}20` : "none",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    transition: "all 0.3s",
                  }}>
                    {/* Left: icon + text */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: claimed
                          ? "rgba(34,197,94,0.15)"
                          : allDone
                          ? `${color}20`
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${claimed ? "rgba(34,197,94,0.35)" : allDone ? `${color}40` : "rgba(255,255,255,0.07)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {claimed ? <Check size={20} color="#4ade80" strokeWidth={2.5} />
                          : allDone ? <Trophy size={19} color={color} strokeWidth={2} />
                          : <TypeIcon size={19} color="#475569" strokeWidth={2} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: claimed ? "#4ade80" : allDone ? "#f1f0ee" : "#475569", marginBottom: 2 }}>
                          Bônus de Conclusão {label}
                        </div>
                        <div style={{ fontSize: 11, color: claimed ? "#4ade80" : allDone ? color : "#334155" }}>
                          {claimed
                            ? "✓ Bônus coletado!"
                            : allDone
                            ? "Todas as missões concluídas — colete seu bônus!"
                            : `Complete todas as missões ${label.toLowerCase()} para desbloquear`}
                        </div>
                      </div>
                    </div>

                    {/* Right: pts badge + button */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <div style={{
                        background: claimed ? "rgba(34,197,94,0.15)" : allDone ? `${color}22` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${claimed ? "rgba(34,197,94,0.30)" : allDone ? `${color}40` : "rgba(255,255,255,0.07)"}`,
                        borderRadius: 10, padding: "6px 10px", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: claimed ? "#4ade80" : allDone ? color : "#334155", lineHeight: 1 }}>
                          +{pts}
                        </div>
                        <div style={{ fontSize: 9, color: claimed ? "#4ade80" : allDone ? color : "#1e293b", fontWeight: 700 }}>pts</div>
                      </div>

                      <button
                        onClick={() => handleClaimCompletionBonus(missionFilter)}
                        disabled={!allDone || claimed}
                        style={{
                          padding: "8px 16px", borderRadius: 10, fontWeight: 800, fontSize: 12,
                          cursor: allDone && !claimed ? "pointer" : "not-allowed",
                          border: "none", transition: "all 0.2s",
                          background: claimed
                            ? "rgba(34,197,94,0.15)"
                            : allDone
                            ? `linear-gradient(135deg,${color},${color}cc)`
                            : "rgba(255,255,255,0.04)",
                          color: claimed ? "#4ade80" : allDone ? "#fff" : "#334155",
                          boxShadow: allDone && !claimed ? `0 4px 14px ${color}40` : "none",
                          opacity: !allDone && !claimed ? 0.5 : 1,
                        }}>
                        {claimed ? "✓ Coletado" : allDone ? "Coletar" : "Bloqueado"}
                      </button>
                    </div>
                  </div>
                )
              })()}

              {filteredMissions.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#334155" }}>
                  <Target size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                  <p style={{ fontSize: 13, fontWeight: 700 }}>Nenhuma missão disponível</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── PREMIUM MODAL ── */}
      {showPremiumModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.80)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "linear-gradient(160deg,#0a0616,#0d0b20,#080618)",
            border: "1px solid rgba(217,119,6,0.35)",
            borderRadius: 28, padding: "28px 24px", maxWidth: 380, width: "100%",
            boxShadow: "0 24px 80px rgba(217,119,6,0.20)",
            position: "relative", overflow: "hidden",
          }}>
            {/* Cap ornamental — mesma linguagem do topo do Progress Hero e dos marcos */}
            <div style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 2, borderRadius: "0 0 3px 3px",
              background: "linear-gradient(90deg,transparent,#f59e0b,#fde68a,#f59e0b,transparent)",
              boxShadow: "0 0 12px rgba(251,191,36,0.7)" }} />
            {/* Textura sutil — mesmo padrão do Progress Hero */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.4,
              background: "repeating-linear-gradient(115deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 26px)" }} />

            {/* Close */}
            <button onClick={() => setShowPremiumModal(false)} style={{
              position: "absolute", top: 16, right: 16, zIndex: 2,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10, width: 32, height: 32, cursor: "pointer",
              color: "#64748b", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            }}><X size={16} strokeWidth={2.5} /></button>

            {/* Icon */}
            <div style={{ textAlign: "center", marginBottom: 20, position: "relative" }}>
              <div style={{
                width: 76, height: 76, borderRadius: 20, margin: "0 auto 14px", position: "relative",
                background: "linear-gradient(145deg,#78350f,#b45309,#d97706,#f59e0b)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(217,119,6,0.40), inset 0 2px 0 rgba(255,255,255,0.30), inset 0 -6px 12px rgba(0,0,0,0.30)",
              }}>
                {/* Anel interno — mesmo tratamento de "brasão" do crest do header */}
                <div style={{ position: "absolute", inset: 5, borderRadius: 15, border: "1px solid rgba(255,255,255,0.20)", pointerEvents: "none" }} />
                <Crown size={34} color="#fff" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }} />
              </div>
              <h2 style={{ fontWeight: 900, fontSize: 23, margin: "0 0 6px", letterSpacing: "-0.01em",
                textShadow: "0 2px 10px rgba(251,191,36,0.25)" }}>
                Gear Pass Premium
              </h2>
              <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
                Desbloqueie recompensas exclusivas por toda a temporada!
              </p>
            </div>

            {/* ── TEASER DE PREMIUM RETROATIVO ── gatilho de compra mais forte:
                mostra exatamente quanto o jogador já "deixou na mesa" */}
            {retroactivePremiumCount > 0 && (
              <div style={{
                background: "linear-gradient(135deg,rgba(245,158,11,0.16),rgba(245,158,11,0.05))",
                border: "1.5px solid rgba(245,158,11,0.45)",
                borderRadius: 14, padding: "12px 14px", marginBottom: 16,
                display: "flex", alignItems: "center", gap: 12,
                boxShadow: "0 0 20px rgba(245,158,11,0.12)",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: "rgba(245,158,11,0.20)", border: "1px solid rgba(245,158,11,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Gift size={18} color="#fbbf24" strokeWidth={2} /></div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fbbf24", lineHeight: 1.3 }}>
                    {retroactivePremiumCount} recompensa{retroactivePremiumCount !== 1 ? "s" : ""} esperando por você
                  </div>
                  <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>
                    Você já passou desses níveis — compre agora e resgate tudo de uma vez, instantaneamente.
                  </div>
                </div>
              </div>
            )}

            {/* Benefits — lista limpa, sem repetir a mesma caixinha 6 vezes seguidas */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: 24,
              border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
              {[
                { Icon: Package, color: "#22d3ee", text: "Recompensas Premium em todos os 100 níveis" },
                { Icon: Crown, color: "#fbbf24", text: "Carta LR Exclusiva ao atingir Nível 100" },
                { Icon: Frame, color: "#c084fc", text: "4 Playmats exclusivos do Passe" },
                { Icon: Gem, color: "#f87171", text: "Packs UR e SR em marcos especiais" },
                { Icon: Zap, color: "#fbbf24", text: "Bônus de coins dobrado nas recompensas" },
                { Icon: Unlock, color: "#4ade80", text: `Válido por toda a Temporada ${passData.seasonNumber} (${SEASON_DURATION_DAYS} dias)` },
              ].map((b, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 14px",
                  background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent",
                  borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}>
                  <b.Icon size={15} color={b.color} strokeWidth={2} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 500 }}>{b.text}</span>
                </div>
              ))}
            </div>

            {/* Price and CTA */}
            <div style={{
              background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.20)",
              borderRadius: 16, padding: "16px", marginBottom: 16, textAlign: "center",
            }}>
              <div style={{ color: "#f59e0b", fontWeight: 900, fontSize: 28, lineHeight: 1 }}>
                {PREMIUM_PRICE}
              </div>
              <div style={{ color: "#78350f", fontSize: 11, marginTop: 4 }}>
                Pagamento único · Sem renovação automática
              </div>
            </div>

            <button onClick={openStripeCheckout} style={{
              width: "100%", padding: "16px 0", borderRadius: 16, position: "relative", overflow: "hidden",
              background: "linear-gradient(135deg,#78350f,#b45309,#d97706,#fbbf24)",
              border: "1px solid rgba(255,213,128,0.35)", cursor: "pointer",
              color: "#1c0a00", fontWeight: 900, fontSize: 16,
              boxShadow: "0 8px 32px rgba(217,119,6,0.45), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -4px 8px rgba(0,0,0,0.20)",
              letterSpacing: "0.02em",
            }}>
              <Crown size={17} style={{ marginRight: 6, verticalAlign: -3, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }} />Comprar Agora
              <div style={{ position: "absolute", inset: 0, width: "40%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.50),transparent)",
                animation: "shimmer 2.8s ease-in-out infinite" }} />
            </button>

            <p style={{ textAlign: "center", fontSize: 10, color: "#334155", marginTop: 12 }}>
              As missões do Passe Comum também contribuem pontos ao Passe Premium.
            </p>
          </div>
        </div>
      )}

      <style>{`
        /* Trava o bounce/rubber-band do documento inteiro — terceira camada de
           proteção contra o gesto de arrastar a trilha "vazar" verticalmente */
        html, body {
          overscroll-behavior: none;
          height: 100%;
          overflow: hidden;
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        /* Pra elementos centralizados via flexbox (sem left:50%) — popup de peek */
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        /* Backdrop full-screen — só fade, sem transform (evita deslocar a tela inteira) */
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        /* Pra elementos ancorados (right/left) sem deslocamento de centralização */
        @keyframes fabIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes pulseGlow {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* "Pronto para coletar" — glow pulsante, sinaliza recompensa disponível */
        @keyframes claimPulseCyan {
          0%,100% { box-shadow: 0 0 8px rgba(6,182,212,0.30); }
          50%      { box-shadow: 0 0 22px rgba(6,182,212,0.70); }
        }
        @keyframes claimPulseAmber {
          0%,100% { box-shadow: 0 0 8px rgba(251,191,36,0.28); }
          50%      { box-shadow: 0 0 22px rgba(251,191,36,0.65); }
        }
        /* Glow das missões prontas pra coletar — mesma família dos pulses da trilha */
        @keyframes claimPulseGreen {
          0%,100% { box-shadow: 0 0 8px rgba(34,197,94,0.22); }
          50%      { box-shadow: 0 0 20px rgba(34,197,94,0.50); }
        }
        /* Flash sequencial usado no "Coletar Pendentes"/"Coletar Tudo" — cada item
           pisca em sua vez, na ordem certa, dando a sensação de resgate em série */
        /* Pop do checkmark no claim individual — aparece com scale elástico */
        @keyframes claimPop {
          0%   { opacity: 0; transform: scale(0.3); }
          60%  { opacity: 1; transform: scale(1.25); }
          80%  { transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes cascadeFlash {
          0%   { box-shadow: 0 0 0px rgba(34,197,94,0); transform: scale(1); }
          35%  { box-shadow: 0 0 24px rgba(34,197,94,0.75); transform: scale(1.10); }
          100% { box-shadow: 0 0 0px rgba(34,197,94,0); transform: scale(1); }
        }
        /* Level-up celebration */
        @keyframes burstRay {
          0%   { opacity: 0; transform: rotate(var(--r,0deg)) translateY(-90px) scaleY(0.2); }
          40%  { opacity: 1; }
          100% { opacity: 0; transform: rotate(var(--r,0deg)) translateY(-190px) scaleY(1); }
        }
        @keyframes levelUpCard {
          0%   { opacity: 0; transform: scale(0.7); }
          15%  { opacity: 1; transform: scale(1.06); }
          25%  { transform: scale(1); }
          75%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.92) translateY(-16px); }
        }
        .gp-track::-webkit-scrollbar { display: none; }
        .mission-scroll::-webkit-scrollbar { display: none; }

        /* Acessibilidade — respeita a preferência do sistema de reduzir movimento */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
      </div>{/* end EVERYTHING ABOVE WALLPAPER */}

      {/* ── PACK OPENING OVERLAY — JSX extraído verbatim do GachaScreen ─────────
          Mesma estrutura, mesmas classes, mesmos keyframes. Roda inline aqui
          dentro do Gear Pass — o jogador nunca sai da tela. ── */}
      {(packIsOpening || packShowResults) && (
        <div
          className={`fixed inset-0 z-[9999] overflow-hidden ${packScreenShake ? "animate-shake" : ""}`}
          style={{background:"radial-gradient(ellipse at 50% 40%, #0a0a2e 0%, #000000 70%)"}}
        >
          <canvas ref={packCanvasRef} className="absolute inset-0 pointer-events-none" />

          {packPhase !== "done" && packList[packCurrentIndex] && (
            <div className="absolute inset-0 pointer-events-none transition-all duration-700" style={{
              background: packList[packCurrentIndex].highestRarity === "LR"
                ? "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(239,68,68,0.15) 70%, rgba(139,0,0,0.4) 100%)"
                : packList[packCurrentIndex].highestRarity === "UR"
                ? "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(56,189,248,0.12) 70%, rgba(0,50,100,0.35) 100%)"
                : packList[packCurrentIndex].highestRarity === "SR"
                ? "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(168,85,247,0.10) 70%, rgba(50,0,80,0.30) 100%)"
                : "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)"
            }} />
          )}

          {packPhase !== "done" && (
            <button
              onClick={() => { setPackPhase("done"); setPackShowResults(true); setPackIsOpening(false) }}
              className="absolute top-5 right-5 z-30 text-xs font-bold text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 backdrop-blur-sm"
            >
              Pular
            </button>
          )}

          {/* ── PACK PHASE ── */}
          {packPhase !== "done" && packList[packCurrentIndex] && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {(() => {
                const pack = packList[packCurrentIndex]
                const rarity = pack.highestRarity
                const rarityGlow =
                  rarity === "LR" ? { inner:"rgba(239,68,68,0.9)", outer:"rgba(251,191,36,0.5)", text:"text-red-400", label:"LENDÁRIO!" } :
                  rarity === "UR" ? { inner:"rgba(56,189,248,0.85)", outer:"rgba(99,179,237,0.4)", text:"text-sky-300", label:"ULTRA RARO!" } :
                  rarity === "SR" ? { inner:"rgba(168,85,247,0.8)", outer:"rgba(192,132,252,0.3)", text:"text-purple-400", label:"SUPER RARO!" } :
                                   { inner:"rgba(148,163,184,0.5)", outer:"rgba(200,200,200,0.15)", text:"text-slate-400", label:"" }

                const handleSwipeStart = (clientX: number) => {
                  if (packPhase !== "floating") return
                  setPackSwipeStartX(clientX)
                }
                const handleSwipeMove = (clientX: number) => {
                  if (packPhase !== "floating" || packSwipeStartX === null) return
                  const delta = clientX - packSwipeStartX
                  const progress = Math.min(1, Math.max(0, delta / 160))
                  setPackSwipeProgress(progress)
                  if (progress >= 1 && !packSwipeComplete) {
                    setPackSwipeComplete(true)
                    setPackSwipeProgress(1)
                    setPackSwipeStartX(null)
                    setPackPhase("shaking")
                  }
                }
                const handleSwipeEnd = () => {
                  if (packSwipeProgress < 1) { setPackSwipeProgress(0); setPackSwipeStartX(null) }
                }

                return (
                  <>
                    {(packPhase === "entering" || packPhase === "floating" || packPhase === "shaking" || packPhase === "opening") && (
                      <div className="relative flex flex-col items-center select-none">

                        <div className="absolute pointer-events-none" style={{
                          inset:"-60px", borderRadius:"50%",
                          background:`radial-gradient(ellipse at 50% 50%, ${rarityGlow.inner} 0%, transparent 65%)`,
                          filter:"blur(35px)",
                          animation: packPhase==="shaking" ? "gpPackHaloFlicker 0.1s ease-in-out infinite" :
                            packPhase==="floating" ? "gpPackHaloPulse 1.8s ease-in-out infinite" : "gpPackHaloPulse 2s ease-in-out infinite",
                          opacity: packPhase==="entering" ? 0.4 : 0.8,
                        }} />

                        {packPhase === "floating" && (
                          <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap"
                            style={{animation:"gpPackAbraLabel 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards"}}>
                            <span className="text-white/90 font-black text-xl tracking-widest" style={{
                              textShadow:`0 0 14px ${rarityGlow.inner}, 0 0 28px ${rarityGlow.outer}`}}>
                              Abra!
                            </span>
                          </div>
                        )}

                        <div className="relative" style={{
                          width:"208px", height:"308px",
                          animation:
                            packPhase==="entering" ? "gpPackEnterEpic 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards" :
                            packPhase==="floating" ? "gpPackFloat 2.4s ease-in-out infinite" :
                            packPhase==="shaking"  ? "gpPackShakeEpic 0.1s ease-in-out infinite" :
                            packPhase==="opening"  ? "gpPackOpenEpic 1s cubic-bezier(0.22,1,0.36,1) forwards" :
                            undefined,
                          filter:`drop-shadow(0 0 30px ${rarityGlow.inner}) drop-shadow(0 0 60px ${rarityGlow.outer})`,
                        }}>
                          <Image src="/images/gacha/pack-fsg.png" alt="Pack" fill sizes="208px" className="object-contain" />
                          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg" style={{
                            background:"linear-gradient(135deg, transparent 35%, rgba(255,255,255,0.14) 50%, transparent 65%)",
                            animation:"gpPackSheen 3.5s ease-in-out infinite",
                          }} />

                          {packPhase === "floating" && (
                            <div
                              className="absolute left-0 right-0 z-30 cursor-grab active:cursor-grabbing"
                              style={{top:"9%", height:"44px", touchAction:"none"}}
                              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); handleSwipeStart(e.clientX) }}
                              onPointerMove={e => handleSwipeMove(e.clientX)}
                              onPointerUp={handleSwipeEnd}
                              onPointerCancel={handleSwipeEnd}
                            >
                              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex items-center gap-[3px] px-1">
                                {[...Array(28)].map((_,i) => (
                                  <div key={i} className="flex-1 h-[2px] rounded-full" style={{
                                    background: packSwipeProgress > i/28
                                      ? `linear-gradient(to right, white, ${rarityGlow.inner})`
                                      : "rgba(255,255,255,0.25)",
                                    transition:"background 0.1s",
                                    boxShadow: packSwipeProgress > i/28 ? `0 0 6px ${rarityGlow.inner}` : "none",
                                  }} />
                                ))}
                              </div>

                              <div className="absolute top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-100"
                                style={{left:`${4 + packSwipeProgress * 88}%`}}>
                                <div className="flex items-center gap-1"
                                  style={{animation: packSwipeProgress === 0 ? "gpSwipeHint 1.2s ease-in-out infinite" : "none",
                                    filter:`drop-shadow(0 0 8px ${rarityGlow.inner})`}}>
                                  <span style={{fontSize:"20px", lineHeight:1}}>✂</span>
                                  {packSwipeProgress < 0.05 && (
                                    <span className="text-white/70 text-[10px] font-bold ml-1 whitespace-nowrap" style={{animation:"gpSwipeHintText 1.2s ease-in-out infinite"}}>
                                      ← rasgar
                                    </span>
                                  )}
                                </div>
                              </div>

                              {packSwipeProgress > 0 && (
                                <div className="absolute top-0 left-0 bottom-0 pointer-events-none rounded-r-full" style={{
                                  width:`${packSwipeProgress*100}%`,
                                  background:`linear-gradient(to right, transparent, ${rarityGlow.inner}20)`,
                                  borderRight:`2px solid ${rarityGlow.inner}`,
                                  boxShadow:`0 0 12px ${rarityGlow.inner}`,
                                }} />
                              )}
                            </div>
                          )}
                        </div>

                        {packPhase === "floating" && packSwipeProgress === 0 && (
                          <div className="mt-6 text-center pointer-events-none" style={{animation:"gpPackAbraLabel 0.6s ease-out 0.2s both"}}>
                            <p className="text-white/40 text-xs tracking-widest">arraste a linha para rasgar</p>
                          </div>
                        )}

                        {packPhase === "opening" && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {[...Array(18)].map((_,i) => (
                              <div key={i} className="absolute" style={{
                                width:"2.5px", height:"200px",
                                background:`linear-gradient(to top, transparent, ${rarityGlow.inner}, white, transparent)`,
                                transform:`rotate(${i*(360/18)}deg)`,
                                transformOrigin:"50% 100%",
                                top:"50%", left:"50%", marginLeft:"-1.25px",
                                animation:`gpBurstRayEpic 1s cubic-bezier(0.22,1,0.36,1) ${i*0.012}s forwards`,
                                opacity:0, borderRadius:"2px",
                                filter:`blur(1px) drop-shadow(0 0 4px ${rarityGlow.inner})`,
                              }} />
                            ))}
                            <div className="absolute inset-0 rounded-full" style={{
                              background:`radial-gradient(circle, white 0%, ${rarityGlow.inner} 25%, transparent 65%)`,
                              animation:"gpCentralFlash 1s ease-out forwards",
                            }} />
                          </div>
                        )}

                        {packPhase === "opening" && rarity !== "R" && (
                          <div className="absolute -bottom-20 left-1/2 whitespace-nowrap pointer-events-none"
                            style={{animation:"gpRarityAnnounce 0.85s cubic-bezier(0.34,1.56,0.64,1) 0.35s forwards",
                              opacity:0, transform:"translateX(-50%) scale(0.5)"}}>
                            <span className={`text-3xl font-black tracking-widest drop-shadow-2xl ${rarityGlow.text}`}
                              style={{textShadow: rarity==="LR"?"0 0 20px #ef4444, 0 0 40px #fbbf24":
                                rarity==="UR"?"0 0 20px #38bdf8, 0 0 40px #7dd3fc":"0 0 20px #a855f7, 0 0 35px #c084fc"}}>
                              {rarityGlow.label}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── CARD REVEAL ── */}
                    {packPhase === "revealing" && (
                      <div className="flex flex-col items-center gap-5 w-full" style={{animation:"gpRevealContainerIn 0.4s ease-out forwards"}}>
                        <div className="flex gap-3 justify-center px-2">
                          {pack.cards.map((card, idx) => {
                            const isRevealed = idx < packCardRevealIndex
                            const isRevealing = idx === packCardRevealIndex - 1
                            const isPending = idx >= packCardRevealIndex
                            const cardGlowStyle =
                              card.rarity==="LR" ? "0 0 30px rgba(239,68,68,0.9), 0 0 60px rgba(251,191,36,0.5)" :
                              card.rarity==="UR" ? "0 0 25px rgba(56,189,248,0.85), 0 0 50px rgba(99,179,237,0.4)" :
                              card.rarity==="SR" ? "0 0 22px rgba(168,85,247,0.8), 0 0 40px rgba(192,132,252,0.3)" :
                              "0 0 12px rgba(148,163,184,0.4)"
                            return (
                              <div key={`${card.id}-reveal-${idx}`} className="flex flex-col items-center gap-2">
                                <div className="relative" style={{perspective:"900px"}}>
                                  {isPending && idx === packCardRevealIndex && (
                                    <div className="absolute inset-0 pointer-events-none z-10" style={{
                                      background: card.rarity==="LR" ? "radial-gradient(ellipse, rgba(239,68,68,0.6) 0%, transparent 70%)" :
                                        card.rarity==="UR" ? "radial-gradient(ellipse, rgba(56,189,248,0.5) 0%, transparent 70%)" :
                                        card.rarity==="SR" ? "radial-gradient(ellipse, rgba(168,85,247,0.4) 0%, transparent 70%)" : "none",
                                      filter:"blur(10px)", animation:"gpAnticipateGlow 0.6s ease-in-out infinite alternate",
                                    }} />
                                  )}
                                  <div style={{perspective:"900px", width:"108px", height:"155px"}}>
                                  <div
                                    className={isRevealed ? "cursor-pointer" : ""}
                                    style={{
                                      width:"108px", height:"155px", position:"relative",
                                      transformStyle:"preserve-3d",
                                      transform: isRevealed ? "rotateY(0deg)" : "rotateY(-180deg)",
                                      transition: isRevealing ? `transform ${card.rarity==="LR"?"0.9s":card.rarity==="UR"?"0.75s":"0.6s"} cubic-bezier(0.4,0,0.2,1)` : "none",
                                      opacity: isPending && idx > packCardRevealIndex ? 0.10 : 1,
                                    }}
                                    onClick={() => isRevealed && setPackRevealZoomedCard({image:card.image||"/placeholder.svg",name:card.name,rarity:card.rarity})}
                                  >
                                    <div className="absolute inset-0 overflow-hidden"
                                      style={{
                                        backfaceVisibility:"hidden",
                                        WebkitBackfaceVisibility:"hidden",
                                        boxShadow: isRevealed ? cardGlowStyle : "none",
                                        transition:"box-shadow 0.4s ease",
                                      }}>
                                      {(isRevealed || isRevealing) && (
                                        <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="115px" className="object-cover" />
                                      )}
                                      {isRevealing && (
                                        <div className="absolute inset-0 z-20 pointer-events-none" style={{
                                          background:"linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.75) 50%,transparent 65%)",
                                          animation:"gpShineSweep 0.65s ease-out 0.2s forwards", transform:"translateX(-100%)"}} />
                                      )}
                                      {card.rarity==="LR" && isRevealed && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          background:"linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)",
                                          backgroundSize:"300% 100%", animation:"gpRainbowShift 1.5s linear infinite",
                                          padding:"3px", WebkitMask:"linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                          WebkitMaskComposite:"xor", maskComposite:"exclude"}} />
                                      )}
                                      {card.rarity==="LR" && isRevealed && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          background:"linear-gradient(135deg,transparent 30%,rgba(255,255,255,0.08) 50%,transparent 70%)",
                                          backgroundSize:"200% 200%", animation:"gpLrHoloShimmer 3s ease-in-out infinite"}} />
                                      )}
                                      {card.rarity==="UR" && isRevealed && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          border:"2px solid rgba(56,189,248,0.9)", boxShadow:"inset 0 0 14px rgba(56,189,248,0.35)",
                                          animation:"gpUrDiamondPulse 1.8s ease-in-out infinite"}} />
                                      )}
                                      {card.rarity==="SR" && isRevealed && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          border:"2px solid rgba(168,85,247,0.8)", animation:"gpSrGoldPulse 2s ease-in-out infinite"}} />
                                      )}
                                      {isRevealed && <div className="absolute inset-0 bg-white/0 hover:bg-white/8 transition-colors duration-150" />}
                                    </div>
                                    <div className="absolute inset-0 overflow-hidden"
                                      style={{
                                        backfaceVisibility:"hidden",
                                        WebkitBackfaceVisibility:"hidden",
                                        transform:"rotateY(180deg)",
                                      }}>
                                      <Image src={CARD_BACK_IMAGE||"/placeholder.svg"} alt="Card Back" fill sizes="115px" className="object-cover" />
                                      {!isRevealed && idx <= packCardRevealIndex && (
                                        <div className="absolute inset-0 pointer-events-none" style={{
                                          background: card.rarity==="LR" ? "linear-gradient(135deg,rgba(239,68,68,0.3),rgba(251,191,36,0.3))" :
                                            card.rarity==="UR" ? "rgba(56,189,248,0.25)" :
                                            card.rarity==="SR" ? "rgba(168,85,247,0.2)" : "transparent",
                                          animation:"gpBackGlowPulse 0.8s ease-in-out infinite alternate"}} />
                                      )}
                                    </div>
                                  </div>
                                  </div>
                                </div>
                                <div className={`px-2.5 py-0.5 text-center text-xs font-black bg-gradient-to-r ${getPackRarityColor(card.rarity)} text-white`}
                                  style={{opacity:isRevealed?1:0, transform:isRevealed?"translateY(0) scale(1)":"translateY(-6px) scale(0.8)",
                                    transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.35s"}}>
                                  {card.rarity}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {packCardRevealIndex >= CARDS_PER_PACK && (
                          <p className="text-white/25 text-[10px] tracking-widest" style={{animation:"gpFadeIn 0.5s ease-out forwards"}}>
                            toque em uma carta para ampliar
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* ── FINAL RESULTS ── */}
          {packPhase === "done" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{animation:"gpFadeIn 0.5s ease-out forwards"}}>
              <h2 className="text-3xl font-black text-white mb-1 tracking-wider" style={{textShadow:"0 0 20px rgba(255,255,255,0.3)"}}>
                Cartas Obtidas!
              </h2>
              <p className="text-slate-500 text-xs mb-4 tracking-widest uppercase">{packOpenedCards.length} cartas · toque para ampliar</p>

              <div className="max-h-[65vh] overflow-y-auto w-full max-w-5xl px-3">
                {packList.map((pack, packIdx) => (
                  <div key={pack.id} className="mb-5">
                    <div className="flex gap-2.5 justify-center flex-wrap">
                      {pack.cards.map((card, cardIdx) => {
                        const cardGlow =
                          card.rarity==="LR" ? "0 0 24px rgba(239,68,68,0.85), 0 0 48px rgba(251,191,36,0.45)" :
                          card.rarity==="UR" ? "0 0 20px rgba(56,189,248,0.85), 0 0 40px rgba(99,179,237,0.35)" :
                          card.rarity==="SR" ? "0 0 18px rgba(168,85,247,0.75), 0 0 36px rgba(192,132,252,0.25)" : "none"
                        return (
                          <div
                            key={`${card.id}-final-${cardIdx}`}
                            className="flex flex-col items-center gap-1.5 cursor-pointer group"
                            style={{animation:"gpCardPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
                              animationDelay:`${(packIdx*4+cardIdx)*0.06}s`, opacity:0}}
                            onClick={() => setPackRevealZoomedCard({image:card.image||"/placeholder.svg",name:card.name,rarity:card.rarity})}
                          >
                            <div
                              className="relative overflow-hidden transition-transform duration-200 group-hover:scale-110 group-hover:z-10"
                              style={{width:"86px", height:"122px", boxShadow:cardGlow}}
                            >
                              <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="96px" className="object-cover" />
                              {card.rarity==="LR" && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                  background:"linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ef4444)",
                                  backgroundSize:"300% 100%", animation:"gpRainbowShift 1.5s linear infinite",
                                  padding:"2px", WebkitMask:"linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                  WebkitMaskComposite:"xor", maskComposite:"exclude"}} />
                              )}
                              {card.rarity==="UR" && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                  border:"2px solid rgba(56,189,248,0.85)",
                                  boxShadow:"inset 0 0 10px rgba(56,189,248,0.25)",
                                  animation:"gpUrDiamondPulse 1.8s ease-in-out infinite"}} />
                              )}
                              {card.rarity==="SR" && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                  border:"1.5px solid rgba(168,85,247,0.75)",
                                  animation:"gpSrGoldPulse 2s ease-in-out infinite"}} />
                              )}
                              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-colors duration-150" />
                            </div>
                            <div className={`px-2 py-0.5 text-center text-[10px] font-black bg-gradient-to-r ${getPackRarityColor(card.rarity)} text-white`}>
                              {card.rarity}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={closePackResults}
                className="mt-4 px-10 py-3.5 text-lg font-black rounded-2xl border-2 border-emerald-400/50 transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/30"
                style={{background:"linear-gradient(135deg,#059669,#10b981,#34d399)",animation:"gpScaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.3s forwards",opacity:0}}>
                CONFIRMAR
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Zoom de carta revelada ── */}
      {packRevealZoomedCard && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
          onClick={() => setPackRevealZoomedCard(null)}
        >
          <div className="relative w-full max-w-sm aspect-[3/4]">
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-500 to-purple-500 opacity-30" />
            <Image
              src={packRevealZoomedCard.image || "/placeholder.svg"}
              alt={packRevealZoomedCard.name}
              fill
              sizes="(max-width: 768px) 90vw, 384px"
              className="object-contain"
            />
          </div>
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <h3 className="text-2xl font-bold text-white mb-2">{packRevealZoomedCard.name}</h3>
            <span className={`px-4 py-1 rounded-full text-sm font-bold ${
              packRevealZoomedCard.rarity === "LR" ? "bg-gradient-to-r from-red-500 to-amber-500 text-white" :
              packRevealZoomedCard.rarity === "UR" ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black" :
              packRevealZoomedCard.rarity === "SR" ? "bg-purple-500 text-white" : "bg-slate-500 text-white"
            }`}>
              {packRevealZoomedCard.rarity}
            </span>
          </div>
          <button onClick={() => setPackRevealZoomedCard(null)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors bg-white/10">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* ── Keyframes do Pack Opening — prefixo gp- pra não colidir com o resto ── */}
      <style jsx>{`
        @keyframes gpPackFloat {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          30%     { transform: translateY(-12px) rotate(0.5deg); }
          70%     { transform: translateY(-8px) rotate(-0.3deg); }
        }
        @keyframes gpPackAbraLabel {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.85); }
          60%  { opacity: 1; transform: translateX(-50%) translateY(2px) scale(1.05); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes gpSwipeHint {
          0%,100% { transform: translateX(0); opacity: 0.7; }
          40%     { transform: translateX(18px); opacity: 1; }
          80%     { transform: translateX(8px); opacity: 0.9; }
        }
        @keyframes gpSwipeHintText {
          0%,100% { opacity: 0.5; }
          50%     { opacity: 1; }
        }
        @keyframes gpPackEnterEpic {
          0%   { transform: translateY(-200px) scale(0.4) rotate(-8deg); opacity: 0; filter: brightness(0); }
          50%  { transform: translateY(18px) scale(1.07) rotate(1.5deg); opacity: 1; filter: brightness(1.4); }
          75%  { transform: translateY(-6px) scale(0.98) rotate(-0.5deg); }
          100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
        }
        @keyframes gpPackShakeEpic {
          0%   { transform: translateX(0) rotate(0deg); }
          15%  { transform: translateX(-7px) rotate(-1.5deg) scale(1.01); }
          30%  { transform: translateX(9px) rotate(2deg) scale(1.02); }
          45%  { transform: translateX(-11px) rotate(-2.5deg) scale(1.03); }
          60%  { transform: translateX(10px) rotate(2deg) scale(1.02); }
          75%  { transform: translateX(-8px) rotate(-1.5deg) scale(1.01); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes gpPackOpenEpic {
          0%   { transform: scale(1) rotate(0deg) translateY(0); opacity: 1; }
          20%  { transform: scale(1.12) rotate(0.5deg) translateY(-8px); }
          50%  { transform: scale(1.35) rotate(-1deg) translateY(-15px); opacity: 0.9; filter: brightness(2.5); }
          80%  { transform: scale(0.5) rotate(5deg) translateY(20px); opacity: 0.3; }
          100% { transform: scale(0) rotate(12deg) translateY(40px); opacity: 0; }
        }
        @keyframes gpBurstRayEpic {
          0%   { opacity: 0; transform: rotate(var(--r,0deg)) scaleY(0) translateY(-50%); }
          20%  { opacity: 1; }
          60%  { opacity: 0.6; transform: rotate(var(--r,0deg)) scaleY(1) translateY(-50%); }
          100% { opacity: 0; transform: rotate(var(--r,0deg)) scaleY(2.5) translateY(-50%); }
        }
        @keyframes gpCentralFlash {
          0%   { opacity: 0; transform: scale(0); }
          15%  { opacity: 1; transform: scale(0.8); }
          40%  { opacity: 0.7; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(2.5); }
        }
        @keyframes gpRarityAnnounce {
          0%   { opacity: 0; transform: translateX(-50%) scale(0.4) rotate(-5deg); }
          60%  { opacity: 1; transform: translateX(-50%) scale(1.1) rotate(1deg); }
          80%  { transform: translateX(-50%) scale(0.97) rotate(-0.5deg); }
          100% { opacity: 1; transform: translateX(-50%) scale(1) rotate(0deg); }
        }
        @keyframes gpPackHaloPulse {
          0%,100% { opacity: 0.6; transform: scale(1); }
          50%     { opacity: 1; transform: scale(1.15); }
        }
        @keyframes gpPackHaloFlicker {
          0%,100% { opacity: 0.7; transform: scale(1.05) rotate(0deg); }
          33%     { opacity: 1; transform: scale(1.2) rotate(1deg); }
          66%     { opacity: 0.9; transform: scale(1.1) rotate(-1deg); }
        }
        @keyframes gpPackSheen {
          0%,100% { background-position: 200% 200%; opacity: 0.6; }
          50%     { background-position: -100% -100%; opacity: 1; }
        }
        @keyframes gpShineSweep {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        @keyframes gpAnticipateGlow {
          0%   { opacity: 0.3; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes gpBackGlowPulse {
          0%   { opacity: 0.4; }
          100% { opacity: 0.9; }
        }
        @keyframes gpUrDiamondPulse {
          0%,100% { box-shadow: 0 0 10px rgba(56,189,248,0.5), inset 0 0 8px rgba(56,189,248,0.2); border-color: rgba(56,189,248,0.7); }
          50%     { box-shadow: 0 0 25px rgba(56,189,248,0.9), 0 0 50px rgba(99,179,237,0.4), inset 0 0 15px rgba(56,189,248,0.4); border-color: rgba(56,189,248,1); }
        }
        @keyframes gpSrGoldPulse {
          0%,100% { box-shadow: 0 0 8px rgba(168,85,247,0.5); border-color: rgba(168,85,247,0.6); }
          50%     { box-shadow: 0 0 20px rgba(168,85,247,0.9), 0 0 40px rgba(192,132,252,0.3); border-color: rgba(168,85,247,1); }
        }
        @keyframes gpLrHoloShimmer {
          0%,100% { background-position: 200% 200%; opacity: 0.5; }
          50%     { background-position: -100% -100%; opacity: 1; }
        }
        @keyframes gpRainbowShift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes gpRevealContainerIn {
          0%   { opacity: 0; transform: translateY(30px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gpFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes gpScaleIn {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes gpCardPopIn {
          0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
          55%  { transform: scale(1.12) rotate(2deg); }
          80%  { transform: scale(0.97) rotate(-0.5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0) rotate(0deg); }
          10%,50%,90% { transform: translateX(-10px) rotate(-1deg); }
          30%,70% { transform: translateX(10px) rotate(1deg); }
        }
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>
    </div>
  )
}
