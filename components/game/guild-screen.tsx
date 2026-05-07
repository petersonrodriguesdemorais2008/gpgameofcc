"use client"

import { useState, useEffect, useRef } from "react"
import {
  ArrowLeft, Plus, Users, Send,
  Swords, Settings, LogOut, Copy, Check,
} from "lucide-react"
import { useGame } from "@/contexts/game-context"
import type { Deck } from "@/contexts/game-context"
import { createClient } from "@/lib/supabase/client"

// ─── Types ────────────────────────────────────────────────────────────────────

type GuildRole     = "leader" | "officer" | "member"
type GuildJoinMode = "open" | "approval"

interface GuildMember {
  id:             string
  guild_id:       string
  name:           string
  title:          string
  level:          number
  avatar_url?:    string
  role:           GuildRole
  last_online:    number
  weekly_contrib: number
}

interface ChatMessage {
  id:          string
  guild_id:    string
  author_id:   string
  author_name: string
  author_role: GuildRole
  text:        string
  timestamp:   number
}

interface Guild {
  id:                 string
  name:               string
  icon:               string
  slogan:             string
  description:        string
  level:              number
  xp:                 number
  xp_to_next:         number
  join_mode:          GuildJoinMode
  min_level:          number
  max_members:        number
  guild_coins:        number
  total_damage_today: number
  created_at:         number
}

interface GuildScreenProps {
  onBack:           () => void
  onStartBossDuel?: (deckId: string) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GUILD_ICONS_IMG: { path: string; label: string }[] = [
  { path: "/images/guild-icons/1b.png",  label: "Fênix de Fogo"       },
  { path: "/images/guild-icons/2b.png",  label: "Lobo do Gelo"        },
  { path: "/images/guild-icons/3b.png",  label: "Monstro das Sombras" },
  { path: "/images/guild-icons/4b.png",  label: "Tigre das Chamas"    },
  { path: "/images/guild-icons/5b.png",  label: "Mefisto Esqueleto"   },
  { path: "/images/guild-icons/6b.png",  label: "Kraken das Trevas"   },
  { path: "/images/guild-icons/7b.png",  label: "Borboleta do Abismo" },
  { path: "/images/guild-icons/8b.png",  label: "Lobo do Trovão"      },
  { path: "/images/guild-icons/9b.png",  label: "Titã de Ferro"       },
  { path: "/images/guild-icons/10b.png", label: "Leão Solar"          },
  { path: "/images/guild-icons/11b.png", label: "Demônio Arcano"      },
  { path: "/images/guild-icons/12b.png", label: "Escorpião Dourado"   },
]

const CREATE_COST = 300
const XP_PER_LEVEL = 1000
const LEVEL_MAX_MEMBERS: Record<number, number> = {
  1:15,2:17,3:19,4:20,5:22,6:23,7:25,8:27,9:28,10:30,
}

// localStorage keys
const LS_GUILD_ID  = "gpgame_guild_id_v3"
const LS_INVITE    = "gpgame_pending_invite"
const LS_CHECKIN   = "gpgame_guild_checkin"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const d = Date.now() - ms
  if (d < 60_000)    return "agora"
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`
  if (d < 86_400_000)return `${Math.floor(d / 3_600_000)}h`
  return `${Math.floor(d / 86_400_000)}d`
}

function roleLabel(role: GuildRole) {
  if (role === "leader")  return { text: "Líder",   color: "#fbbf24", bg: "rgba(251,191,36,0.15)"  }
  if (role === "officer") return { text: "Oficial",  color: "#60a5fa", bg: "rgba(96,165,250,0.15)"  }
  return                         { text: "Membro",   color: "#94a3b8", bg: "rgba(148,163,184,0.10)" }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GuildIcon({ icon, size = 48, borderRadius = 12 }: {
  icon: string; size?: number; borderRadius?: number
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius, flexShrink: 0,
      background: "rgba(139,92,246,0.15)",
      border: "1px solid rgba(139,92,246,0.25)",
      overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <img
        src={icon} alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2" }}
      />
    </div>
  )
}

function MemberRow({ member, myRole, onKick, onPromote }: {
  member: GuildMember; myRole: GuildRole
  onKick?: () => void; onPromote?: () => void
}) {
  const rl       = roleLabel(member.role)
  const isOnline = Date.now() - member.last_online < 5 * 60_000
  const canManage= (myRole === "leader" || myRole === "officer") && member.role === "member"

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,0.03)", borderRadius: 12,
      padding: "10px 14px", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, overflow: "hidden",
          background: "linear-gradient(135deg,#1e3a5f,#0f2744)",
          border: "1px solid rgba(255,255,255,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {member.avatar_url
            ? <img src={member.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
            : <span style={{ fontSize: 18 }}>👤</span>}
        </div>
        <div style={{
          position: "absolute", bottom: -2, right: -2,
          width: 10, height: 10, borderRadius: "50%",
          background: isOnline ? "#22c55e" : "#374151",
          border: "2px solid #0a0a12",
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 13,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {member.name}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, color: rl.color, background: rl.bg,
            padding: "1px 6px", borderRadius: 5,
            letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0,
          }}>{rl.text}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          <span style={{ color: "#475569", fontSize: 11 }}>Lv.{member.level}</span>
          <span style={{ color: "#334155", fontSize: 10 }}>·</span>
          <span style={{ color: "#334155", fontSize: 10 }}>
            {isOnline ? "Online" : timeAgo(member.last_online)}
          </span>
          <span style={{ color: "#334155", fontSize: 10 }}>·</span>
          <span style={{ color: "#06b6d4", fontSize: 10 }}>⚡{member.weekly_contrib}</span>
        </div>
      </div>

      {canManage && (
        <div style={{ display: "flex", gap: 6 }}>
          {myRole === "leader" && onPromote && (
            <button onClick={onPromote} style={{
              background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)",
              borderRadius: 8, padding: "4px 8px", cursor: "pointer",
              color: "#60a5fa", fontSize: 10, fontWeight: 700,
            }}>↑ Oficial</button>
          )}
          {onKick && (
            <button onClick={onKick} style={{
              background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)",
              borderRadius: 8, padding: "4px 8px", cursor: "pointer",
              color: "#f87171", fontSize: 10, fontWeight: 700,
            }}>Expulsar</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── DeckSelectorModal ────────────────────────────────────────────────────────

function DeckSelectorModal({ decks, onSelect, onClose }: {
  decks: Deck[]; onSelect: (d: Deck) => void; onClose: () => void
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(0,0,0,0.92)", backdropFilter: "blur(18px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "linear-gradient(160deg,#0a0614,#0d0b20)",
        border: "1px solid rgba(220,38,38,0.40)", borderRadius: 24,
        padding: "24px 20px", maxWidth: 420, width: "100%",
        fontFamily: "'Segoe UI',system-ui,sans-serif", color: "#f1f5f9",
        maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontWeight: 900, fontSize: 18, margin: 0, color: "#f87171" }}>💀 Chefão da Guilda</h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, width: 32, height: 32, cursor: "pointer", color: "#64748b", fontSize: 18 }}>✕</button>
        </div>
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>
          Escolha seu deck para batalhar contra o Chefão!
        </p>
        {decks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "#475569" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗃️</div>
            <p style={{ fontWeight: 700 }}>Nenhum deck criado ainda.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Crie um deck no Construtor de Decks primeiro!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {decks.map(deck => (
              <button key={deck.id} onClick={() => onSelect(deck)} style={{
                background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.22)",
                borderRadius: 14, padding: "14px 16px", cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,38,38,0.16)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(220,38,38,0.07)")}
              >
                <div style={{ fontSize: 30 }}>⚔️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#f1f5f9" }}>{deck.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{deck.cards.length} cartas</div>
                </div>
                <div style={{ color: "#f87171", fontSize: 12, fontWeight: 800 }}>Selecionar →</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CreateGuildModal ─────────────────────────────────────────────────────────

function CreateGuildModal({ onClose, onCreate, coins, setCoins, playerId, playerProfile }: {
  onClose: () => void
  onCreate: (g: Guild, me: GuildMember) => void
  coins: number; setCoins: (n: number) => void
  playerId: string; playerProfile: any
}) {
  const [icon,        setIcon]        = useState(GUILD_ICONS_IMG[0].path)
  const [name,        setName]        = useState("")
  const [slogan,      setSlogan]      = useState("")
  const [description, setDescription] = useState("")
  const [joinMode,    setJoinMode]    = useState<GuildJoinMode>("open")
  const [minLevel,    setMinLevel]    = useState(1)
  const [error,       setError]       = useState("")
  const [saving,      setSaving]      = useState(false)

  const canCreate = coins >= CREATE_COST && name.trim().length >= 3

  const handleCreate = async () => {
    if (!canCreate || saving) return
    setError(""); setSaving(true)

    const supabase = createClient()
    const guildId  = `guild-${Date.now()}`

    const newGuild: Guild = {
      id: guildId,
      name: name.trim(),
      icon,
      slogan:      slogan.trim() || "Juntos somos mais fortes!",
      description: description.trim() || "Uma nova guilda começa aqui.",
      level: 1, xp: 0, xp_to_next: XP_PER_LEVEL,
      join_mode: joinMode, min_level: minLevel,
      max_members: 15, guild_coins: 0,
      total_damage_today: 0, created_at: Date.now(),
    }

    const newMember: GuildMember = {
      id: playerId, guild_id: guildId,
      name: playerProfile.name, title: playerProfile.title ?? "",
      level: playerProfile.level ?? 1, avatar_url: playerProfile.avatarUrl,
      role: "leader", last_online: Date.now(), weekly_contrib: 0,
    }

    if (supabase) {
      const { error: gErr } = await supabase.from("guilds").insert({
        id: newGuild.id, name: newGuild.name, icon: newGuild.icon,
        slogan: newGuild.slogan, description: newGuild.description,
        level: 1, xp: 0, xp_to_next: XP_PER_LEVEL,
        join_mode: newGuild.join_mode, min_level: newGuild.min_level,
        max_members: 15, guild_coins: 0,
        total_damage_today: 0, created_at: newGuild.created_at,
      })
      if (gErr) { setError("Erro ao criar: " + gErr.message); setSaving(false); return }

      const { error: mErr } = await supabase.from("guild_members").insert({
        id: newMember.id, guild_id: guildId,
        name: newMember.name, title: newMember.title,
        level: newMember.level, avatar_url: newMember.avatar_url,
        role: "leader", last_online: newMember.last_online, weekly_contrib: 0,
      })
      if (mErr) { setError("Erro ao entrar: " + mErr.message); setSaving(false); return }

      await supabase.from("guild_chat").insert({
        id: `sys-${Date.now()}`, guild_id: guildId,
        author_id: "system", author_name: "Sistema", author_role: "leader",
        text: `🎉 Guilda "${newGuild.name}" foi criada! Bem-vindos!`,
        timestamp: Date.now(),
      })
    }

    setCoins(coins - CREATE_COST)
    localStorage.setItem(LS_GUILD_ID, guildId)
    onCreate(newGuild, newMember)
    setSaving(false)
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "linear-gradient(160deg,#0a0614,#0d0b20)", border: "1px solid rgba(139,92,246,0.30)", borderRadius: 24, padding: "24px 20px", maxWidth: 420, width: "100%", fontFamily: "'Segoe UI',system-ui,sans-serif", color: "#f1f5f9", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontWeight: 900, fontSize: 18, margin: 0 }}>🏰 Criar Guilda</h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, width: 32, height: 32, cursor: "pointer", color: "#64748b", fontSize: 18 }}>✕</button>
        </div>

        {/* Cost */}
        <div style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🪙</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 12, color: "#fbbf24" }}>Custo: {CREATE_COST} Gacha Coins</div>
            <div style={{ fontSize: 11, color: "#78716c" }}>Saldo: {coins} · {coins >= CREATE_COST ? "✅ Suficiente" : "❌ Insuficiente"}</div>
          </div>
        </div>

        {/* Icon picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 10 }}>
            Selecione o Ícone da Guilda
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {GUILD_ICONS_IMG.map(ic => (
              <button key={ic.path} onClick={() => setIcon(ic.path)} title={ic.label} style={{
                position: "relative", aspectRatio: "1/1", borderRadius: 12, padding: 0,
                overflow: "hidden", background: "rgba(255,255,255,0.04)",
                border: `2px solid ${icon === ic.path ? "#8b5cf6" : "rgba(255,255,255,0.08)"}`,
                cursor: "pointer", transition: "all 0.2s",
                boxShadow: icon === ic.path ? "0 0 14px rgba(139,92,246,0.55)" : "none",
                transform: icon === ic.path ? "scale(1.06)" : "scale(1)",
              }}>
                <img src={ic.path} alt={ic.label}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={e => { (e.target as HTMLImageElement).style.opacity = "0.15" }} />
                {icon === ic.path && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(139,92,246,0.28)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 10px rgba(139,92,246,0.8)" }}>
                      <span style={{ fontSize: 14, color: "#fff" }}>✓</span>
                    </div>
                  </div>
                )}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.80))", padding: "3px 4px 4px" }}>
                  <p style={{ margin: 0, fontSize: 8, color: "#e2e8f0", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: icon === ic.path ? 800 : 400 }}>
                    {ic.label}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Selecionado:</span>
            <GuildIcon icon={icon} size={44} borderRadius={11} />
            <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700 }}>
              {GUILD_ICONS_IMG.find(ic => ic.path === icon)?.label ?? ""}
            </span>
          </div>
        </div>

        {/* Text fields */}
        {([
          { label: "Nome da Guilda *", val: name,        set: setName,        placeholder: "Mínimo 3 caracteres",      max: 30,  multi: false },
          { label: "Slogan",           val: slogan,      set: setSlogan,      placeholder: "Frase de impacto",          max: 50,  multi: false },
          { label: "Descrição",        val: description, set: setDescription, placeholder: "Descreva sua guilda...",    max: 120, multi: true  },
        ] as const).map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{f.label}</label>
            {f.multi
              ? <textarea value={f.val} onChange={e => f.set(e.target.value)} maxLength={f.max}
                  placeholder={f.placeholder} rows={2}
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              : <input value={f.val} onChange={e => f.set(e.target.value)} maxLength={f.max}
                  placeholder={f.placeholder}
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
            }
          </div>
        ))}

        {/* Join mode */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Entrada</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["open", "approval"] as GuildJoinMode[]).map(m => (
              <button key={m} onClick={() => setJoinMode(m)} style={{
                flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 12,
                background: joinMode === m ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)",
                color: joinMode === m ? "#c4b5fd" : "#475569",
                border: `1px solid ${joinMode === m ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.08)"}`,
              }}>{m === "open" ? "🔓 Livre" : "🔒 Por Aprovação"}</button>
            ))}
          </div>
        </div>

        {/* Min level */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Nível mínimo: <span style={{ color: "#8b5cf6" }}>Lv.{minLevel}</span>
          </label>
          <input type="range" min={1} max={50} value={minLevel}
            onChange={e => setMinLevel(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#8b5cf6" }} />
        </div>

        {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12, fontWeight: 700 }}>⚠️ {error}</div>}

        <button onClick={handleCreate} disabled={!canCreate || saving} style={{
          width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
          background: canCreate && !saving ? "linear-gradient(135deg,#6d28d9,#8b5cf6)" : "rgba(255,255,255,0.05)",
          color: canCreate && !saving ? "#fff" : "#475569",
          fontWeight: 900, fontSize: 14,
          cursor: canCreate && !saving ? "pointer" : "not-allowed",
          boxShadow: canCreate && !saving ? "0 4px 20px rgba(139,92,246,0.35)" : "none",
        }}>
          {saving ? "Criando..." : `🏰 Criar por ${CREATE_COST} 🪙`}
        </button>
      </div>
    </div>
  )
}

// ─── InviteLinkModal ──────────────────────────────────────────────────────────

function InviteLinkModal({ inviteGuild, currentGuildId, onAccept, onDecline }: {
  inviteGuild: Guild; currentGuildId: string | null
  onAccept: () => void; onDecline: () => void
}) {
  const alreadyIn = currentGuildId !== null
  const sameGuild = currentGuildId === inviteGuild.id
  if (sameGuild) { onDecline(); return null }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "linear-gradient(160deg,#0a0614,#0d0b20)", border: "1px solid rgba(139,92,246,0.40)", borderRadius: 24, padding: "28px 22px", maxWidth: 380, width: "100%", textAlign: "center", fontFamily: "'Segoe UI',system-ui,sans-serif", color: "#f1f5f9", boxShadow: "0 0 60px rgba(139,92,246,0.15)" }}>
        <GuildIcon icon={inviteGuild.icon} size={80} borderRadius={20} />
        <h3 style={{ fontWeight: 900, fontSize: 20, margin: "14px 0 4px" }}>{inviteGuild.name}</h3>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 4px", fontStyle: "italic" }}>
          "{inviteGuild.slogan || "Juntos somos mais fortes!"}"
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, margin: "10px 0 20px", fontSize: 12, color: "#475569" }}>
          <span>Lv.{inviteGuild.level}</span>
          <span>·</span>
          <span>{inviteGuild.join_mode === "open" ? "🔓 Livre" : "🔒 Aprovação"}</span>
        </div>

        {alreadyIn ? (
          <>
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 14, padding: "12px 14px", marginBottom: 20, textAlign: "left" }}>
              <p style={{ color: "#fbbf24", fontSize: 13, margin: 0, fontWeight: 700 }}>⚠️ Você já pertence a uma guilda.</p>
              <p style={{ color: "#78716c", fontSize: 12, margin: "4px 0 0" }}>Saia da sua guilda atual antes de aceitar este convite.</p>
            </div>
            <button onClick={onDecline} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>Entendido</button>
          </>
        ) : (
          <>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>
              Você foi convidado para entrar nesta guilda. Deseja aceitar?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onDecline} style={{ flex: 1, padding: "11px 0", borderRadius: 11, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#64748b", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Recusar</button>
              <button onClick={onAccept} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(139,92,246,0.40)" }}>
                ✅ Entrar na Guilda
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── MAIN GuildScreen ─────────────────────────────────────────────────────────

export default function GuildScreen({ onBack, onStartBossDuel }: GuildScreenProps) {
  const { playerProfile, playerId, coins, setCoins, decks } = useGame()
  const supabase = createClient()
  const myId = playerId || `anon-${Date.now()}`

  // ── State ──────────────────────────────────────────────────────────────────
  const [guild,         setGuild]         = useState<Guild | null>(null)
  const [members,       setMembers]       = useState<GuildMember[]>([])
  const [chat,          setChat]          = useState<ChatMessage[]>([])
  const [loading,       setLoading]       = useState(true)
  const [view,          setView]          = useState<"main"|"members"|"chat"|"boss"|"war"|"shop"|"settings"|"browse">("browse")
  const [showCreate,    setShowCreate]    = useState(false)
  const [showDeckSel,   setShowDeckSel]   = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [feedback,      setFeedback]      = useState<string | null>(null)
  const [leaveConfirm,  setLeaveConfirm]  = useState(false)
  const [chatInput,     setChatInput]     = useState("")
  const [invitePayload, setInvitePayload] = useState<Guild | null>(null)
  const [checkedIn,     setCheckedIn]     = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const myMember   = members.find(m => m.id === myId)
  const myRole     = myMember?.role ?? "member"
  const guildXpPct = guild ? Math.min(100, (guild.xp / guild.xp_to_next) * 100) : 0

  const toast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2800)
  }

  // ── 1. Load guild on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const savedId = localStorage.getItem(LS_GUILD_ID)
    if (!savedId || !supabase) { setLoading(false); return }

    ;(async () => {
      const { data: gData } = await supabase
        .from("guilds").select("*").eq("id", savedId).single()
      if (!gData) { localStorage.removeItem(LS_GUILD_ID); setLoading(false); return }

      const { data: mData } = await supabase
        .from("guild_members").select("*").eq("guild_id", savedId)
      const { data: cData } = await supabase
        .from("guild_chat").select("*")
        .eq("guild_id", savedId).order("timestamp", { ascending: true }).limit(50)

      setGuild(gData as Guild)
      setMembers((mData ?? []) as GuildMember[])
      setChat((cData ?? []) as ChatMessage[])
      setView("main")
      setCheckedIn(localStorage.getItem(LS_CHECKIN) === new Date().toDateString())
      setLoading(false)

      // Update my last_online ping
      await supabase.from("guild_members")
        .update({ last_online: Date.now() }).eq("id", myId)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 2. Realtime subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (!guild || !supabase) return
    const gid = guild.id

    // ── guild_members: live member list ──────────────────────────────────────
    const membersCh = supabase
      .channel(`members:${gid}`)
      .on("postgres_changes", {
        event: "*", schema: "public",
        table: "guild_members", filter: `guild_id=eq.${gid}`,
      }, ({ eventType, new: row, old }) => {

        if (eventType === "INSERT") {
          const m = row as GuildMember
          setMembers(prev => {
            if (prev.find(x => x.id === m.id)) return prev
            // Notify everyone that a new member joined
            toast(`🎉 ${m.name} entrou na guilda!`)
            return [...prev, m]
          })
        }

        if (eventType === "UPDATE") {
          setMembers(prev => prev.map(x => x.id === (row as GuildMember).id ? row as GuildMember : x))
        }

        if (eventType === "DELETE") {
          setMembers(prev => prev.filter(x => x.id !== (old as GuildMember).id))
        }
      })
      .subscribe()

    // ── guild_chat: live messages ────────────────────────────────────────────
    const chatCh = supabase
      .channel(`chat:${gid}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "guild_chat", filter: `guild_id=eq.${gid}`,
      }, ({ new: row }) => {
        const msg = row as ChatMessage
        setChat(prev => {
          // Skip if we already added it optimistically (same id)
          if (prev.find(m => m.id === msg.id)) return prev
          return [...prev.slice(-49), msg]
        })
      })
      .subscribe()

    // ── guilds: live guild meta (level, xp, coins…) ──────────────────────────
    const guildCh = supabase
      .channel(`guild:${gid}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "guilds", filter: `id=eq.${gid}`,
      }, ({ new: row }) => {
        setGuild(row as Guild)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(membersCh)
      supabase.removeChannel(chatCh)
      supabase.removeChannel(guildCh)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guild?.id])

  // ── 3. Auto-scroll chat ────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat])

  // ── 4. Decode invite link from URL / localStorage ──────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    const tryDecode = (raw: string | null): Guild | null => {
      if (!raw) return null
      try { return JSON.parse(atob(raw)) as Guild } catch { return null }
    }
    const params  = new URLSearchParams(window.location.search)
    const decoded = tryDecode(params.get("gd"))
    if (decoded) {
      setInvitePayload(decoded)
      const url = new URL(window.location.href)
      url.searchParams.delete("gd"); url.searchParams.delete("ref")
      window.history.replaceState({}, "", url.toString())
      return
    }
    const stored = localStorage.getItem(LS_INVITE)
    if (stored) {
      const fromLS = tryDecode(stored)
      if (fromLS) setInvitePayload(fromLS)
      localStorage.removeItem(LS_INVITE)
    }
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGuildCreated = (g: Guild, me: GuildMember) => {
    setGuild(g); setMembers([me]); setChat([])
    setShowCreate(false); setView("main")
  }

  const handleAcceptInvite = async () => {
    if (!invitePayload) return
    const gid = invitePayload.id

    if (supabase) {
      // Ensure guild row exists
      const { data: existing } = await supabase
        .from("guilds").select("id").eq("id", gid).single()
      if (!existing) {
        await supabase.from("guilds").insert({
          id: gid, name: invitePayload.name, icon: invitePayload.icon,
          slogan: invitePayload.slogan, description: invitePayload.description,
          level: invitePayload.level, xp: invitePayload.xp,
          xp_to_next: invitePayload.xp_to_next,
          join_mode: invitePayload.join_mode, min_level: invitePayload.min_level,
          max_members: invitePayload.max_members, guild_coins: invitePayload.guild_coins,
          total_damage_today: 0, created_at: invitePayload.created_at,
        })
      }

      // Check if already a member
      const { data: already } = await supabase
        .from("guild_members").select("id").eq("id", myId).single()
      if (!already) {
        // Insert new member — Realtime will notify the leader automatically
        await supabase.from("guild_members").insert({
          id: myId, guild_id: gid,
          name: playerProfile.name, title: playerProfile.title ?? "",
          level: playerProfile.level ?? 1, avatar_url: playerProfile.avatarUrl,
          role: "member", last_online: Date.now(), weekly_contrib: 0,
        })
        // Welcome message — Realtime will deliver to everyone
        await supabase.from("guild_chat").insert({
          id: `sys-join-${Date.now()}`, guild_id: gid,
          author_id: "system", author_name: "Sistema", author_role: "leader",
          text: `🎉 ${playerProfile.name} entrou na guilda via convite!`,
          timestamp: Date.now(),
        })
      }

      // Fetch everything fresh
      const { data: gData } = await supabase.from("guilds").select("*").eq("id", gid).single()
      const { data: mData } = await supabase.from("guild_members").select("*").eq("guild_id", gid)
      const { data: cData } = await supabase.from("guild_chat").select("*")
        .eq("guild_id", gid).order("timestamp", { ascending: true }).limit(50)

      setGuild(gData as Guild)
      setMembers((mData ?? []) as GuildMember[])
      setChat((cData ?? []) as ChatMessage[])
    }

    localStorage.setItem(LS_GUILD_ID, gid)
    setInvitePayload(null)
    setView("main")
    toast(`🎉 Você entrou em "${invitePayload.name}"!`)
  }

  const handleSendChat = async () => {
    if (!chatInput.trim() || !guild || !myMember) return
    const msg: ChatMessage = {
      id: `m-${myId}-${Date.now()}`,
      guild_id: guild.id,
      author_id: myId,
      author_name: myMember.name,
      author_role: myRole,
      text: chatInput.trim(),
      timestamp: Date.now(),
    }
    // Optimistic: add immediately for sender
    setChat(prev => [...prev.slice(-49), msg])
    setChatInput("")

    if (supabase) {
      await supabase.from("guild_chat").insert({
        id: msg.id, guild_id: msg.guild_id,
        author_id: msg.author_id, author_name: msg.author_name,
        author_role: msg.author_role, text: msg.text, timestamp: msg.timestamp,
      })
      // Realtime INSERT will deliver msg to all OTHER members automatically
    }
  }

  const handleCopyInvite = () => {
    if (!guild) return
    const encoded = btoa(JSON.stringify(guild))
    const base    = typeof window !== "undefined" ? window.location.origin : ""
    const link    = `${base}/?gd=${encoded}&ref=${encodeURIComponent(myId)}`
    navigator.clipboard.writeText(link).catch(() => {
      const ta = document.createElement("textarea")
      ta.value = link; ta.style.cssText = "position:fixed;opacity:0"
      document.body.appendChild(ta); ta.select()
      document.execCommand("copy"); document.body.removeChild(ta)
    })
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    toast("🔗 Link copiado! Envie para seu amigo.")
  }

  const handleDailyCheckin = async () => {
    if (checkedIn || !guild) return
    const today = new Date().toDateString()
    localStorage.setItem(LS_CHECKIN, today)
    setCheckedIn(true)
    setCoins(coins + 50)
    toast("✅ Check-in diário! +50 Coins")
    if (supabase) {
      await supabase.from("guild_members")
        .update({ weekly_contrib: (myMember?.weekly_contrib ?? 0) + 10 })
        .eq("id", myId)
    }
  }

  const handleKick = async (memberId: string) => {
    if (!guild || !supabase) return
    await supabase.from("guild_members").delete().eq("id", memberId)
    // Realtime DELETE event will update everyone's member list
    toast("✅ Membro expulso.")
  }

  const handlePromote = async (memberId: string) => {
    if (!guild || !supabase) return
    await supabase.from("guild_members").update({ role: "officer" }).eq("id", memberId)
    toast("⬆️ Membro promovido a Oficial!")
  }

  const handleLeave = async () => {
    if (!guild) return
    if (myRole === "leader" && members.length > 1) {
      toast("⚠️ Passe o cargo de líder antes de sair!")
      setLeaveConfirm(false); return
    }
    if (supabase) {
      await supabase.from("guild_members").delete().eq("id", myId)
      if (members.length <= 1) {
        await supabase.from("guilds").delete().eq("id", guild.id)
      }
    }
    localStorage.removeItem(LS_GUILD_ID)
    setGuild(null); setMembers([]); setChat([])
    setLeaveConfirm(false); setView("browse")
    toast("Você saiu da guilda.")
  }

  const handleBossDuel = (deck: Deck) => {
    setShowDeckSel(false)
    if (onStartBossDuel) onStartBossDuel(deck.id)
    else toast("⚔️ Duelo contra o Chefão iniciado com: " + deck.name)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#020610,#050d1a)", fontFamily: "'Segoe UI',sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(139,92,246,0.2)", borderTop: "3px solid #8b5cf6", animation: "spin 0.9s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#475569", fontSize: 13 }}>Carregando guilda...</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#020610 0%,#050d1a 50%,#030a14 100%)",
      color: "#f1f5f9", fontFamily: "'Segoe UI',system-ui,sans-serif",
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
    }}>
      {/* BG glows */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 40% at 50% 0%,rgba(139,92,246,0.10) 0%,transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 30% at 80% 80%,rgba(6,182,212,0.06) 0%,transparent 55%)" }} />
      </div>

      {/* Toast */}
      {feedback && (
        <div style={{
          position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          background: "rgba(30,30,50,0.95)", border: "1px solid rgba(139,92,246,0.40)",
          borderRadius: 14, padding: "10px 22px", color: "#e2e8f0", fontWeight: 800, fontSize: 13,
          backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          animation: "fadeDown 0.25s ease", whiteSpace: "nowrap",
        }}>{feedback}</div>
      )}

      {/* ── Modals ── */}
      {invitePayload && (
        <InviteLinkModal
          inviteGuild={invitePayload}
          currentGuildId={guild?.id ?? null}
          onAccept={handleAcceptInvite}
          onDecline={() => setInvitePayload(null)}
        />
      )}
      {showCreate && (
        <CreateGuildModal
          onClose={() => setShowCreate(false)}
          onCreate={handleGuildCreated}
          coins={coins} setCoins={setCoins}
          playerId={myId} playerProfile={playerProfile}
        />
      )}
      {showDeckSel && (
        <DeckSelectorModal
          decks={decks ?? []}
          onSelect={handleBossDuel}
          onClose={() => setShowDeckSel(false)}
        />
      )}
      {leaveConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "linear-gradient(160deg,#0a0614,#0d0b20)", border: "1px solid rgba(239,68,68,0.30)", borderRadius: 24, padding: "24px 20px", maxWidth: 340, width: "100%", textAlign: "center", fontFamily: "'Segoe UI',sans-serif", color: "#f1f5f9" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚪</div>
            <h3 style={{ fontWeight: 900, fontSize: 17, margin: "0 0 8px" }}>Sair da Guilda?</h3>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>Você ficará sem guilda. Para voltar, precisará de um novo link de convite.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setLeaveConfirm(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 11, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#64748b", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleLeave} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#7f1d1d,#dc2626)", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(2,6,16,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 700, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "8px 10px", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={18} color="#8b5cf6" />
              <h1 style={{ fontWeight: 900, fontSize: 18, margin: 0 }}>Guilda</h1>
              {guild && <span style={{ fontSize: 12, background: "rgba(139,92,246,0.15)", color: "#c4b5fd", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>Lv.{guild.level}</span>}
            </div>
            <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>{guild ? guild.name : "Sem guilda"}</p>
          </div>
          {guild && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDailyCheckin} disabled={checkedIn} style={{
                background: checkedIn ? "rgba(255,255,255,0.04)" : "rgba(34,197,94,0.15)",
                border: `1px solid ${checkedIn ? "rgba(255,255,255,0.07)" : "rgba(34,197,94,0.35)"}`,
                borderRadius: 10, padding: "6px 12px",
                cursor: checkedIn ? "not-allowed" : "pointer",
                color: checkedIn ? "#334155" : "#22c55e", fontSize: 11, fontWeight: 800,
              }}>{checkedIn ? "✓ Check-in" : "🎁 Check-in"}</button>
              <button onClick={() => setView("settings")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
                <Settings size={16} />
              </button>
            </div>
          )}
        </div>

        {guild && (
          <div style={{ display: "flex", gap: 0, maxWidth: 700, margin: "10px auto 0", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, overflowX: "auto" }}>
            {([
              { id: "main",    label: "🏠 Início"  },
              { id: "members", label: "👥 Membros" },
              { id: "chat",    label: "💬 Chat"    },
              { id: "boss",    label: "💀 Chefão"  },
              { id: "war",     label: "⚔️ Guerra"  },
              { id: "shop",    label: "🛒 Loja"    },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setView(tab.id)} style={{
                flex: 1, padding: "7px 4px", borderRadius: 9, border: "none",
                cursor: "pointer", fontWeight: 800, fontSize: 11, whiteSpace: "nowrap",
                background: view === tab.id ? "linear-gradient(135deg,rgba(139,92,246,0.25),rgba(6,182,212,0.15))" : "transparent",
                color: view === tab.id ? "#e2e8f0" : "#475569", transition: "all 0.2s",
              }}>{tab.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 16px 100px" }}>

          {/* ══ BROWSE ══ */}
          {(!guild || view === "browse") && (
            <>
              <button onClick={() => setShowCreate(true)} style={{
                width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", color: "#fff",
                fontWeight: 900, fontSize: 14, cursor: "pointer",
                boxShadow: "0 4px 20px rgba(139,92,246,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20,
              }}>
                <Plus size={18} /> Criar Guilda
                <span style={{ fontSize: 11, opacity: 0.7 }}>({CREATE_COST}🪙)</span>
              </button>
              <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🏰</div>
                <p style={{ fontWeight: 800, fontSize: 15, color: "#475569", marginBottom: 8 }}>Você ainda não tem uma guilda</p>
                <div style={{ background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.18)", borderRadius: 14, padding: "14px 18px", display: "inline-block", textAlign: "left", maxWidth: 320 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: "#06b6d4", marginBottom: 4 }}>💡 Como entrar em uma guilda?</div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                    1. Peça ao líder a link de convite.<br />
                    2. Abra o link — o jogo perguntará se deseja entrar.<br />
                    3. Aceite e comece a jogar junto!
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══ MAIN ══ */}
          {guild && view === "main" && (
            <>
              {/* Guild card */}
              <div style={{ background: "linear-gradient(135deg,rgba(109,40,217,0.18),rgba(55,48,163,0.12))", border: "1px solid rgba(139,92,246,0.28)", borderRadius: 20, padding: "20px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <GuildIcon icon={guild.icon} size={60} borderRadius={16} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <h2 style={{ fontWeight: 900, fontSize: 18, margin: 0 }}>{guild.name}</h2>
                      <span style={{ fontSize: 9, fontWeight: 800, color: guild.join_mode === "open" ? "#22c55e" : "#f59e0b" }}>
                        {guild.join_mode === "open" ? "🔓" : "🔒"}
                      </span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: 12, margin: 0, fontStyle: "italic" }}>{guild.slogan}</p>
                  </div>
                </div>
                {/* XP bar */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Progresso da Guilda</span>
                    <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 800 }}>Lv.{guild.level} · {guild.xp}/{guild.xp_to_next} XP</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${guildXpPct}%`, background: "linear-gradient(90deg,#7c3aed,#a855f7)", boxShadow: "0 0 10px rgba(168,85,247,0.5)", transition: "width 0.6s" }} />
                  </div>
                </div>
                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {[
                    { label: "Membros", value: `${members.length}/${guild.max_members}`, icon: "👥" },
                    { label: "Moedas",  value: guild.guild_coins.toString(),              icon: "🪙" },
                    { label: "Vagas",   value: `${LEVEL_MAX_MEMBERS[Math.min(10, guild.level)]}`, icon: "📈" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px", textAlign: "center" }}>
                      <div style={{ fontSize: 16 }}>{s.icon}</div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: "#e2e8f0", margin: "2px 0" }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: "#475569" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite */}
              <div style={{ background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.18)", borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: "#06b6d4" }}>🔗 Link de Convite</div>
                  <div style={{ fontSize: 10, color: "#334155" }}>Ao abrir, o jogo perguntará se o amigo quer entrar na sua guilda em tempo real</div>
                </div>
                <button onClick={handleCopyInvite} style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.30)", borderRadius: 9, padding: "7px 14px", cursor: "pointer", color: "#06b6d4", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>

              {/* Activities */}
              <h3 style={{ fontWeight: 900, fontSize: 12, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Atividades</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  { icon: "💀", label: "Chefão da Guilda",  desc: "Duelo difícil vs. Boss",  color: "#f87171", action: () => setView("boss") },
                  { icon: "⚔️", label: "Guerra de Guildas", desc: "PVP em equipe",            color: "#60a5fa", action: () => setView("war")  },
                  { icon: "🎯", label: "Missão Coletiva",   desc: "Meta colaborativa",        color: "#34d399", action: () => toast("🎯 Meta: vençam 50 duelos juntos!") },
                  { icon: "🛒", label: "Loja da Guilda",    desc: "Troque moedas",            color: "#fbbf24", action: () => setView("shop") },
                ] as const).map(a => (
                  <button key={a.label} onClick={a.action} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{a.icon}</div>
                    <div style={{ fontWeight: 900, fontSize: 13, color: a.color }}>{a.label}</div>
                    <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{a.desc}</div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "12px 14px" }}>
                <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.6 }}>{guild.description}</p>
              </div>
            </>
          )}

          {/* ══ MEMBERS ══ */}
          {guild && view === "members" && (
            <>
              <h3 style={{ fontWeight: 900, fontSize: 14, margin: "0 0 14px" }}>
                👥 {members.length}/{guild.max_members} Membros
                <span style={{ fontSize: 11, color: "#22c55e", marginLeft: 8, fontWeight: 600 }}>● Tempo real</span>
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...members]
                  .sort((a, b) => {
                    const o: Record<GuildRole, number> = { leader: 0, officer: 1, member: 2 }
                    return o[a.role] - o[b.role] || b.weekly_contrib - a.weekly_contrib
                  })
                  .map(m => (
                    <MemberRow key={m.id} member={m} myRole={myRole}
                      onKick={m.id !== myId && (myRole === "leader" || myRole === "officer") ? () => handleKick(m.id) : undefined}
                      onPromote={m.id !== myId && myRole === "leader" && m.role === "member" ? () => handlePromote(m.id) : undefined}
                    />
                  ))}
              </div>
            </>
          )}

          {/* ══ CHAT ══ */}
          {guild && view === "chat" && (
            <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 195px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <h3 style={{ fontWeight: 900, fontSize: 14, margin: 0 }}>💬 Chat da Guilda</h3>
                <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>● Tempo real</span>
              </div>

              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 12 }}>
                {chat.length === 0 && (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#334155" }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
                    <p style={{ fontSize: 13 }}>Nenhuma mensagem ainda. Seja o primeiro!</p>
                  </div>
                )}
                {chat.map(msg => {
                  const isMe     = msg.author_id === myId
                  const isSystem = msg.author_id === "system"
                  const rl       = isSystem ? null : roleLabel(msg.author_role)
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      {!isMe && !isSystem && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, paddingLeft: 4 }}>
                          <span style={{ fontWeight: 800, fontSize: 11, color: "#94a3b8" }}>{msg.author_name}</span>
                          {rl && <span style={{ fontSize: 8, fontWeight: 800, color: rl.color, background: rl.bg, padding: "1px 5px", borderRadius: 4, textTransform: "uppercase" }}>{rl.text}</span>}
                        </div>
                      )}
                      <div style={{
                        maxWidth: "75%", padding: "9px 13px",
                        borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: isSystem ? "rgba(139,92,246,0.12)" : isMe ? "linear-gradient(135deg,#6d28d9,#8b5cf6)" : "rgba(255,255,255,0.07)",
                        border: isSystem ? "1px solid rgba(139,92,246,0.25)" : "none",
                      }}>
                        <p style={{ margin: 0, fontSize: 13, color: isSystem ? "#a78bfa" : "#f1f5f9", fontStyle: isSystem ? "italic" : undefined, lineHeight: 1.5 }}>{msg.text}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 9, color: "rgba(255,255,255,0.35)", textAlign: "right" }}>{timeAgo(msg.timestamp)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ display: "flex", gap: 8, paddingTop: 8, background: "rgba(2,6,16,0.95)" }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendChat()}
                  placeholder="Mensagem para a guilda..."
                  maxLength={200}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "11px 14px", color: "#e2e8f0", fontSize: 13 }}
                />
                <button onClick={handleSendChat} style={{ background: "linear-gradient(135deg,#6d28d9,#8b5cf6)", border: "none", borderRadius: 12, padding: "0 16px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <Send size={18} color="#fff" />
                </button>
              </div>
            </div>
          )}

          {/* ══ BOSS ══ */}
          {guild && view === "boss" && (
            <div>
              <div style={{ background: "linear-gradient(135deg,rgba(127,29,29,0.35),rgba(15,3,3,0.50))", border: "1px solid rgba(220,38,38,0.35)", borderRadius: 20, padding: "24px 20px", marginBottom: 20, textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%,rgba(220,38,38,0.12) 0%,transparent 60%)", pointerEvents: "none" }} />
                <div style={{ fontSize: 68, marginBottom: 8, filter: "drop-shadow(0 0 20px rgba(220,38,38,0.7))" }}>💀</div>
                <h2 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 6px", color: "#f87171" }}>Chefão da Guilda</h2>
                <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>
                  Enfrente o Chefão em um <strong style={{ color: "#f1f5f9" }}>duelo difícil de verdade</strong>.<br />
                  Escolha seu melhor deck e supere o desafio!
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                  {[
                    { faixa: "Derrota Honrosa",    recompensa: "25 🪙",           color: "#64748b" },
                    { faixa: "Vitória Rápida",      recompensa: "100 🪙 + Pack",   color: "#fbbf24" },
                    { faixa: "Vitória Perfeita",    recompensa: "200 🪙 + Pack SR", color: "#60a5fa" },
                    { faixa: "Lendário (sem dano)", recompensa: "500 🪙 + Pack LR", color: "#a855f7" },
                  ].map(r => (
                    <div key={r.faixa} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px" }}>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{r.faixa}</div>
                      <div style={{ fontWeight: 900, fontSize: 12, color: r.color, marginTop: 4 }}>{r.recompensa}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "rgba(220,38,38,0.10)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 20, textAlign: "left" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      <strong style={{ color: "#f87171" }}>Chefão Atual: Mefisto das Sombras</strong><br />
                      Nível: Extremo · 4.000 HP · Habilidades especiais ativas
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowDeckSel(true)} style={{
                  width: "100%", padding: "16px 0", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "#fff",
                  fontWeight: 900, fontSize: 16, cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(220,38,38,0.50)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}>
                  <Swords size={20} /> Escolher Deck e Batalhar
                </button>
              </div>
              {/* Ranking */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px" }}>
                <h4 style={{ fontWeight: 900, fontSize: 13, margin: "0 0 12px", color: "#94a3b8" }}>🏆 Ranking — Boss da Semana</h4>
                {[...members].slice(0, 5).map((m, i) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                    <span style={{ flex: 1, fontSize: 13, color: "#e2e8f0", fontWeight: 700 }}>{m.name}</span>
                    <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 800 }}>{m.weekly_contrib * 50 + 500} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ WAR ══ */}
          {guild && view === "war" && (
            <>
              <h3 style={{ fontWeight: 900, fontSize: 16, marginBottom: 16, color: "#60a5fa" }}>⚔️ Guerra de Guildas</h3>
              <div style={{ background: "rgba(37,99,235,0.10)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 16, padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🏟️</div>
                <p style={{ color: "#64748b", fontSize: 13 }}>Próxima Guerra começa em</p>
                <p style={{ fontWeight: 900, fontSize: 24, color: "#60a5fa", margin: "4px 0" }}>18:32:07</p>
                <p style={{ color: "#334155", fontSize: 11 }}>Enfrente outra guilda em duelos PVP. Ganha moedas ao vencer!</p>
              </div>
            </>
          )}

          {/* ══ SHOP ══ */}
          {guild && view === "shop" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontWeight: 900, fontSize: 16, margin: 0, color: "#fbbf24" }}>🛒 Loja da Guilda</h3>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24" }}>🪙 {guild.guild_coins}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { name: "Pack de Gacha Comum", cost: 50,  icon: "📦", desc: "1 pack comum"         },
                  { name: "100 Gacha Coins",      cost: 80,  icon: "🪙", desc: "Moedas do jogo"       },
                  { name: "Pack SR Garantido",    cost: 200, icon: "💎", desc: "Garante SR ou acima"  },
                  { name: "Título Exclusivo",     cost: 500, icon: "🏷️", desc: "Título de guilda"    },
                ].map(item => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px" }}>
                    <div style={{ fontSize: 28, width: 44, height: 44, background: "rgba(251,191,36,0.10)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#475569" }}>{item.desc}</div>
                    </div>
                    <button
                      onClick={() => guild.guild_coins >= item.cost ? toast(`✅ ${item.name} comprado!`) : toast("❌ Moedas insuficientes!")}
                      style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#92400e,#d97706)", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                      🪙 {item.cost}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══ SETTINGS ══ */}
          {guild && view === "settings" && (
            <>
              <h3 style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>⚙️ Configurações da Guilda</h3>
              {myRole === "leader" && (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px", marginBottom: 14 }}>
                  <h4 style={{ fontWeight: 900, fontSize: 13, margin: "0 0 12px", color: "#94a3b8" }}>👑 Opções do Líder</h4>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>Modo de entrada</span>
                    <button onClick={async () => {
                      const newMode: GuildJoinMode = guild.join_mode === "open" ? "approval" : "open"
                      setGuild(g => g ? { ...g, join_mode: newMode } : g)
                      if (supabase) await supabase.from("guilds").update({ join_mode: newMode }).eq("id", guild.id)
                    }} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 12px", cursor: "pointer", color: "#e2e8f0", fontSize: 12, fontWeight: 700 }}>
                      {guild.join_mode === "open" ? "🔓 Livre" : "🔒 Aprovação"}
                    </button>
                  </div>
                </div>
              )}
              <button onClick={() => setLeaveConfirm(true)} style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "1px solid rgba(239,68,68,0.30)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontWeight: 900, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <LogOut size={16} /> Sair da Guilda
              </button>
            </>
          )}

        </div>
      </div>

      <style>{`
        @keyframes fadeDown {
          from { opacity:0; transform:translateX(-50%) translateY(-10px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>
    </div>
  )
}
