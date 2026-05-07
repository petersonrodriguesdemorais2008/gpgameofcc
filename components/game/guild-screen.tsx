"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  ArrowLeft, Search, Plus, Crown, Shield, Users, Star,
  MessageCircle, Send, Trophy, Swords, Gift, ChevronRight,
  Settings, LogOut, Copy, Check, X, Zap, Lock, Unlock,
  TrendingUp, Heart, Bell, Sword,
} from "lucide-react"
import { useGame } from "@/contexts/game-context"
import type { Deck } from "@/contexts/game-context"

// ─── Types ────────────────────────────────────────────────────────────────────

type GuildRole = "leader" | "officer" | "member"
type GuildJoinMode = "open" | "approval"

interface GuildMember {
  id: string
  name: string
  title: string
  level: number
  avatarUrl?: string
  role: GuildRole
  lastOnline: number
  weeklyContrib: number
}

interface ChatMessage {
  id: string
  authorId: string
  authorName: string
  authorRole: GuildRole
  text: string
  timestamp: number
}

interface Guild {
  id: string
  name: string
  icon: string        // emoji OR image path (starts with "/" or "http")
  slogan: string
  level: number
  xp: number
  xpToNext: number
  joinMode: GuildJoinMode
  minLevel: number
  description: string
  maxMembers: number
  members: GuildMember[]
  chat: ChatMessage[]
  guildCoins: number
  totalDamageToday: number
  createdAt: number
}

interface GuildScreenProps {
  onBack: () => void
  /** Called when the player confirms starting the boss duel */
  onStartBossDuel?: (deckId: string) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GUILD_ICONS_EMOJI = [
  "⚔️","🛡️","🏆","🌟","🔥","💎","🦅","🐉","🌙","⚡",
  "🎯","🗡️","🔮","👑","🌊","🏰","🎭","🦁","🧿","💫",
]

// Guild icon images — coloque os arquivos em: public/images/guild-icons/
// Os arquivos são: 1b.png até 12b.png
const GUILD_ICONS_IMG: { path: string; label: string }[] = [
  { path: "/images/guild-icons/1b.png",  label: "Fênix de Fogo" },
  { path: "/images/guild-icons/2b.png",  label: "Lobo do Gelo" },
  { path: "/images/guild-icons/3b.png",  label: "Monstro das Sombras" },
  { path: "/images/guild-icons/4b.png",  label: "Tigre das Chamas" },
  { path: "/images/guild-icons/5b.png",  label: "Mefisto Esqueleto" },
  { path: "/images/guild-icons/6b.png",  label: "Kraken das Trevas" },
  { path: "/images/guild-icons/7b.png",  label: "Borboleta do Abismo" },
  { path: "/images/guild-icons/8b.png",  label: "Lobo do Trovão" },
  { path: "/images/guild-icons/9b.png",  label: "Titã de Ferro" },
  { path: "/images/guild-icons/10b.png", label: "Leão Solar" },
  { path: "/images/guild-icons/11b.png", label: "Demônio Arcano" },
  { path: "/images/guild-icons/12b.png", label: "Escorpião Dourado" },
]

const CREATE_COST = 300

const LEVEL_MAX_MEMBERS: Record<number, number> = {
  1:15, 2:17, 3:19, 4:20, 5:22, 6:23, 7:25, 8:27, 9:28, 10:30,
}

const XP_PER_LEVEL = 1000

const LS_KEY = "gpgame_guild_v2"
const LS_INVITE_KEY = "gpgame_pending_invite"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60000) return "agora"
  if (diff < 3600000) return `${Math.floor(diff/60000)}m`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h`
  return `${Math.floor(diff/86400000)}d`
}

function roleLabel(role: GuildRole) {
  if (role === "leader")  return { text: "Líder",    color: "#fbbf24", bg: "rgba(251,191,36,0.15)" }
  if (role === "officer") return { text: "Oficial",  color: "#60a5fa", bg: "rgba(96,165,250,0.15)" }
  return                         { text: "Membro",   color: "#94a3b8", bg: "rgba(148,163,184,0.10)" }
}

/** Renders either an emoji icon or an <img> icon */
function GuildIcon({ icon, size = 48, fontSize = 26, borderRadius = 12 }: {
  icon: string; size?: number; fontSize?: number; borderRadius?: number
}) {
  const isImage = icon.startsWith("/") || icon.startsWith("http")
  return (
    <div style={{
      width: size, height: size, borderRadius,
      background: "rgba(139,92,246,0.15)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, flexShrink: 0,
      border: "1px solid rgba(139,92,246,0.25)",
      overflow: "hidden",
    }}>
      {isImage
        ? <img src={icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : icon
      }
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MemberRow({ member, myRole, onKick, onPromote }: {
  member: GuildMember
  myRole: GuildRole
  onKick?: () => void
  onPromote?: () => void
}) {
  const rl = roleLabel(member.role)
  const canManage = (myRole === "leader" || myRole === "officer") && member.role === "member"
  const isOnline = Date.now() - member.lastOnline < 5 * 60000

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      background:"rgba(255,255,255,0.03)", borderRadius:12,
      padding:"10px 14px", border:"1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ position:"relative", flexShrink:0 }}>
        <div style={{
          width:38, height:38, borderRadius:10,
          background:"linear-gradient(135deg,#1e3a5f,#0f2744)",
          border:"1px solid rgba(255,255,255,0.10)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, overflow:"hidden",
        }}>
          {member.avatarUrl
            ? <img src={member.avatarUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" />
            : "👤"
          }
        </div>
        <div style={{
          position:"absolute", bottom:-2, right:-2,
          width:10, height:10, borderRadius:"50%",
          background: isOnline ? "#22c55e" : "#374151",
          border:"2px solid #0a0a12",
        }}/>
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ color:"#e2e8f0", fontWeight:800, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {member.name}
          </span>
          <span style={{
            fontSize:9, fontWeight:800, color:rl.color,
            background:rl.bg, padding:"1px 6px", borderRadius:5,
            letterSpacing:"0.06em", textTransform:"uppercase", flexShrink:0,
          }}>{rl.text}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:2 }}>
          <span style={{ color:"#475569", fontSize:11 }}>Lv.{member.level}</span>
          <span style={{ color:"#334155", fontSize:10 }}>·</span>
          <span style={{ color:"#334155", fontSize:10 }}>{isOnline ? "Online" : timeAgo(member.lastOnline)}</span>
          <span style={{ color:"#334155", fontSize:10 }}>·</span>
          <span style={{ color:"#06b6d4", fontSize:10 }}>⚡{member.weeklyContrib}</span>
        </div>
      </div>

      {canManage && (
        <div style={{ display:"flex", gap:6 }}>
          {myRole === "leader" && onPromote && (
            <button onClick={onPromote} style={{
              background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.25)",
              borderRadius:8, padding:"4px 8px", cursor:"pointer",
              color:"#60a5fa", fontSize:10, fontWeight:700,
            }}>↑ Oficial</button>
          )}
          {onKick && (
            <button onClick={onKick} style={{
              background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.20)",
              borderRadius:8, padding:"4px 8px", cursor:"pointer",
              color:"#f87171", fontSize:10, fontWeight:700,
            }}>Expulsar</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── DECK SELECTOR MODAL (for boss duel) ────────────────────────────────────

function DeckSelectorModal({
  decks,
  onSelect,
  onClose,
}: {
  decks: Deck[]
  onSelect: (deck: Deck) => void
  onClose: () => void
}) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:400,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(18px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20,
    }}>
      <div style={{
        background:"linear-gradient(160deg,#0a0614,#0d0b20)",
        border:"1px solid rgba(220,38,38,0.40)", borderRadius:24,
        padding:"24px 20px", maxWidth:420, width:"100%",
        fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f1f5f9",
        maxHeight:"85vh", overflowY:"auto",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <h2 style={{ fontWeight:900, fontSize:18, margin:0, color:"#f87171" }}>💀 Chefão da Guilda</h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:10, width:32, height:32, cursor:"pointer", color:"#64748b", fontSize:18 }}>✕</button>
        </div>
        <p style={{ color:"#64748b", fontSize:13, marginBottom:20 }}>
          Este é um duelo difícil contra o Chefão. Escolha seu deck para batalhar!
        </p>

        {decks.length === 0 ? (
          <div style={{ textAlign:"center", padding:"30px 0", color:"#475569" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🗃️</div>
            <p style={{ fontWeight:700 }}>Nenhum deck criado ainda.</p>
            <p style={{ fontSize:12, marginTop:4 }}>Crie um deck no Construtor de Decks primeiro!</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {decks.map(deck => (
              <button
                key={deck.id}
                onClick={() => onSelect(deck)}
                style={{
                  background:"rgba(220,38,38,0.07)", border:"1px solid rgba(220,38,38,0.22)",
                  borderRadius:14, padding:"14px 16px", cursor:"pointer",
                  textAlign:"left", transition:"all 0.2s",
                  display:"flex", alignItems:"center", gap:12,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,38,38,0.16)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(220,38,38,0.07)")}
              >
                <div style={{ fontSize:30 }}>⚔️</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:900, fontSize:14, color:"#f1f5f9" }}>{deck.name}</div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>
                    {deck.cards.length} cartas{deck.tapCards && deck.tapCards.length > 0 ? ` · ${deck.tapCards.length} TAP` : ""}
                  </div>
                </div>
                <div style={{ color:"#f87171", fontSize:12, fontWeight:800 }}>Selecionar →</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CREATE GUILD Modal ───────────────────────────────────────────────────────

function CreateGuildModal({
  onClose, onCreate, coins, setCoins, playerId, playerProfile,
}: {
  onClose: () => void
  onCreate: (g: Guild) => void
  coins: number
  setCoins: (n: number) => void
  playerId: string | null
  playerProfile: any
}) {
  const [icon, setIcon] = useState("⚔️")
  const [iconTab, setIconTab] = useState<"emoji"|"image">("emoji")
  const [name, setName] = useState("")
  const [slogan, setSlogan] = useState("")
  const [description, setDescription] = useState("")
  const [joinMode, setJoinMode] = useState<GuildJoinMode>("open")
  const [minLevel, setMinLevel] = useState(1)
  const [error, setError] = useState("")

  const canCreate = coins >= CREATE_COST && name.trim().length >= 3

  const handleCreate = () => {
    if (!canCreate) return
    if (name.trim().length < 3) { setError("Nome muito curto (mín. 3 caracteres)"); return }
    setCoins(coins - CREATE_COST)
    const guild: Guild = {
      id: `guild-${Date.now()}`,
      name: name.trim(),
      icon,
      slogan: slogan.trim() || "Juntos somos mais fortes!",
      level: 1,
      xp: 0,
      xpToNext: XP_PER_LEVEL,
      joinMode,
      minLevel,
      description: description.trim() || "Uma nova guilda começa aqui.",
      maxMembers: 15,
      members: [{
        id: playerId || "me",
        name: playerProfile.name,
        title: playerProfile.title,
        level: playerProfile.level,
        avatarUrl: playerProfile.avatarUrl,
        role: "leader",
        lastOnline: Date.now(),
        weeklyContrib: 0,
      }],
      chat: [{
        id: "sys-0",
        authorId: "system",
        authorName: "Sistema",
        authorRole: "leader",
        text: `🎉 Guilda "${name.trim()}" foi criada! Bem-vindos!`,
        timestamp: Date.now(),
      }],
      guildCoins: 0,
      totalDamageToday: 0,
      createdAt: Date.now(),
    }
    onCreate(guild)
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(14px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"linear-gradient(160deg,#0a0614,#0d0b20)", border:"1px solid rgba(139,92,246,0.30)", borderRadius:24, padding:"24px 20px", maxWidth:420, width:"100%", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f1f5f9", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h2 style={{ fontWeight:900, fontSize:18, margin:0 }}>🏰 Criar Guilda</h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:10, width:32, height:32, cursor:"pointer", color:"#64748b", fontSize:18 }}>✕</button>
        </div>

        <div style={{ background:"rgba(251,191,36,0.10)", border:"1px solid rgba(251,191,36,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:18, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>🪙</span>
          <div>
            <div style={{ fontWeight:800, fontSize:12, color:"#fbbf24" }}>Custo de criação: {CREATE_COST} Gacha Coins</div>
            <div style={{ fontSize:11, color:"#78716c" }}>Seu saldo: {coins} coins · {coins >= CREATE_COST ? "✅ Suficiente" : "❌ Insuficiente"}</div>
          </div>
        </div>

        {/* Icon picker — tabs: emoji / image */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:8 }}>Ícone da Guilda</label>
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            {(["emoji","image"] as const).map(tab => (
              <button key={tab} onClick={() => setIconTab(tab)} style={{
                padding:"5px 14px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:800, fontSize:11,
                background: iconTab === tab ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)",
                color: iconTab === tab ? "#c4b5fd" : "#475569",
                border: `1px solid ${iconTab === tab ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.08)"}`,
              }}>{tab === "emoji" ? "😀 Emojis" : "🖼️ Imagens"}</button>
            ))}
          </div>
          {iconTab === "emoji" ? (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {GUILD_ICONS_EMOJI.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)} style={{
                  width:40, height:40, borderRadius:10, fontSize:20,
                  background: icon === ic ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${icon === ic ? "#8b5cf6" : "rgba(255,255,255,0.08)"}`,
                  cursor:"pointer", transition:"all 0.15s",
                }}>{ic}</button>
              ))}
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {GUILD_ICONS_IMG.map(ic => (
                <button
                  key={ic.path}
                  onClick={() => setIcon(ic.path)}
                  title={ic.label}
                  style={{
                    position:"relative", aspectRatio:"1/1", borderRadius:12, padding:0,
                    overflow:"hidden", background:"rgba(255,255,255,0.04)",
                    border: `2px solid ${icon === ic.path ? "#8b5cf6" : "rgba(255,255,255,0.08)"}`,
                    cursor:"pointer", transition:"all 0.15s",
                    boxShadow: icon === ic.path ? "0 0 12px rgba(139,92,246,0.50)" : "none",
                  }}
                >
                  <img
                    src={ic.path}
                    alt={ic.label}
                    style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                    onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2" }}
                  />
                  {icon === ic.path && (
                    <div style={{
                      position:"absolute", inset:0,
                      background:"rgba(139,92,246,0.30)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <span style={{ fontSize:18 }}>✓</span>
                    </div>
                  )}
                  <div style={{
                    position:"absolute", bottom:0, left:0, right:0,
                    background:"linear-gradient(transparent,rgba(0,0,0,0.75))",
                    padding:"2px 4px 3px",
                  }}>
                    <p style={{ margin:0, fontSize:8, color:"#e2e8f0", textAlign:"center",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {ic.label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* Preview */}
          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:11, color:"#64748b" }}>Prévia:</span>
            <GuildIcon icon={icon} size={40} fontSize={22} borderRadius={10} />
          </div>
        </div>

        {[
          { label:"Nome da Guilda *", val:name, set:setName, placeholder:"Mínimo 3 caracteres", max:30 },
          { label:"Slogan", val:slogan, set:setSlogan, placeholder:"Frase de impacto da guilda", max:50 },
          { label:"Descrição", val:description, set:setDescription, placeholder:"Descreva sua guilda...", max:120 },
        ].map(f => (
          <div key={f.label} style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:6 }}>{f.label}</label>
            {f.label === "Descrição" ? (
              <textarea value={f.val} onChange={e => f.set(e.target.value)} maxLength={f.max}
                placeholder={f.placeholder} rows={2}
                style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"10px 12px", color:"#e2e8f0", fontSize:13, resize:"none", boxSizing:"border-box", fontFamily:"inherit" }}/>
            ) : (
              <input value={f.val} onChange={e => f.set(e.target.value)} maxLength={f.max}
                placeholder={f.placeholder}
                style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"10px 12px", color:"#e2e8f0", fontSize:13, boxSizing:"border-box" }}/>
            )}
          </div>
        ))}

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:8 }}>Entrada</label>
          <div style={{ display:"flex", gap:8 }}>
            {(["open","approval"] as GuildJoinMode[]).map(m => (
              <button key={m} onClick={() => setJoinMode(m)} style={{
                flex:1, padding:"9px 0", borderRadius:10, cursor:"pointer",
                background: joinMode === m ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)",
                color: joinMode === m ? "#c4b5fd" : "#475569",
                fontWeight:800, fontSize:12,
                border: `1px solid ${joinMode === m ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.08)"}`,
              }}>
                {m === "open" ? "🔓 Livre" : "🔒 Por Aprovação"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:6 }}>
            Nível mínimo: <span style={{ color:"#8b5cf6" }}>Lv.{minLevel}</span>
          </label>
          <input type="range" min={1} max={50} value={minLevel} onChange={e => setMinLevel(Number(e.target.value))}
            style={{ width:"100%", accentColor:"#8b5cf6" }}/>
        </div>

        {error && <div style={{ color:"#f87171", fontSize:12, marginBottom:12, fontWeight:700 }}>⚠️ {error}</div>}

        <button onClick={handleCreate} disabled={!canCreate} style={{
          width:"100%", padding:"14px 0", borderRadius:14, border:"none",
          background: canCreate ? "linear-gradient(135deg,#6d28d9,#8b5cf6)" : "rgba(255,255,255,0.05)",
          color: canCreate ? "#fff" : "#475569",
          fontWeight:900, fontSize:14, cursor: canCreate ? "pointer" : "not-allowed",
          boxShadow: canCreate ? "0 4px 20px rgba(139,92,246,0.35)" : "none",
        }}>
          🏰 Criar por {CREATE_COST} 🪙
        </button>
      </div>
    </div>
  )
}

// ─── INVITE LINK MODAL (shown when player arrives via invite link) ─────────────

function InviteLinkModal({
  inviteGuild,
  currentGuild,
  onAccept,
  onDecline,
}: {
  inviteGuild: Guild        // dados reais decodificados do link
  currentGuild: Guild | null
  onAccept: () => void
  onDecline: () => void
}) {
  const alreadyInGuild = currentGuild !== null
  const sameGuild = currentGuild?.id === inviteGuild.id
  const isImg = inviteGuild.icon.startsWith("/") || inviteGuild.icon.startsWith("http")

  // Já é membro — dispensa silenciosamente
  if (sameGuild) { onDecline(); return null }

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:500,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(20px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20,
    }}>
      <div style={{
        background:"linear-gradient(160deg,#0a0614,#0d0b20)",
        border:"1px solid rgba(139,92,246,0.40)", borderRadius:24,
        padding:"28px 22px", maxWidth:380, width:"100%", textAlign:"center",
        fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#f1f5f9",
        boxShadow:"0 0 60px rgba(139,92,246,0.15)",
      }}>
        {/* Guild icon */}
        <div style={{
          width:80, height:80, borderRadius:20, margin:"0 auto 14px",
          background:"rgba(139,92,246,0.15)", border:"2px solid rgba(139,92,246,0.35)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:40, overflow:"hidden",
        }}>
          {isImg
            ? <img src={inviteGuild.icon} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : inviteGuild.icon
          }
        </div>

        <h3 style={{ fontWeight:900, fontSize:20, margin:"0 0 4px" }}>
          {inviteGuild.name}
        </h3>
        <p style={{ color:"#64748b", fontSize:13, margin:"0 0 4px", fontStyle:"italic" }}>
          "{inviteGuild.slogan || "Juntos somos mais fortes!"}"
        </p>
        <div style={{ display:"flex", justifyContent:"center", gap:16, margin:"10px 0 20px", fontSize:12, color:"#475569" }}>
          <span>Lv.{inviteGuild.level}</span>
          <span>·</span>
          <span>👥 {inviteGuild.members.length}/{inviteGuild.maxMembers}</span>
          <span>·</span>
          <span>{inviteGuild.joinMode === "open" ? "🔓 Livre" : "🔒 Aprovação"}</span>
        </div>

        {alreadyInGuild ? (
          <>
            <div style={{
              background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.25)",
              borderRadius:14, padding:"12px 14px", marginBottom:20, textAlign:"left",
            }}>
              <p style={{ color:"#fbbf24", fontSize:13, margin:0, fontWeight:700 }}>
                ⚠️ Você já pertence à guilda <strong>"{currentGuild!.name}"</strong>
              </p>
              <p style={{ color:"#78716c", fontSize:12, margin:"4px 0 0" }}>
                Saia da sua guilda atual antes de aceitar este convite.
              </p>
            </div>
            <button onClick={onDecline} style={{
              width:"100%", padding:"12px 0", borderRadius:12, border:"none",
              background:"linear-gradient(135deg,#6d28d9,#8b5cf6)", color:"#fff",
              fontWeight:900, fontSize:14, cursor:"pointer",
            }}>Entendido</button>
          </>
        ) : (
          <>
            <p style={{ color:"#64748b", fontSize:13, marginBottom:20 }}>
              Você foi convidado para entrar nesta guilda. Deseja aceitar?
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onDecline} style={{
                flex:1, padding:"11px 0", borderRadius:11,
                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)",
                color:"#64748b", fontWeight:800, fontSize:13, cursor:"pointer",
              }}>Recusar</button>
              <button onClick={onAccept} style={{
                flex:1, padding:"11px 0", borderRadius:11, border:"none",
                background:"linear-gradient(135deg,#6d28d9,#8b5cf6)",
                color:"#fff", fontWeight:900, fontSize:13, cursor:"pointer",
                boxShadow:"0 4px 16px rgba(139,92,246,0.40)",
              }}>
                ✅ Entrar na Guilda
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── MAIN Guild Screen ────────────────────────────────────────────────────────

export default function GuildScreen({ onBack, onStartBossDuel }: GuildScreenProps) {
  const { playerProfile, playerId, coins, setCoins, decks } = useGame()

  const [guild, setGuild] = useState<Guild | null>(() => {
    if (typeof window === "undefined") return null
    try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null } catch { return null }
  })

  const [view, setView] = useState<"main"|"members"|"chat"|"boss"|"war"|"shop"|"settings"|"browse">(
    guild ? "main" : "browse"
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [showDeckSelector, setShowDeckSelector] = useState(false)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<string|null>(null)
  const [pendingJoin, setPendingJoin] = useState<null | { id:string; name:string; icon:string; joinMode:GuildJoinMode; minLevel:number }>(null)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  // invitePayload: dados REAIS da guilda decodificados do link de convite
  const [invitePayload, setInvitePayload] = useState<Guild | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Daily checkin
  const [checkedIn, setCheckedIn] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("gpgame_guild_checkin") === new Date().toDateString()
  })

  // ── Decodifica link de convite na montagem ───────────────────────────────
  // O link usa o parâmetro "gd" contendo os dados da guilda em base64 JSON.
  // Exemplo: /?gd=eyJpZCI6ImcxMjMiLCJuYW1lIjoiT3MgR3Vlcr...}
  // Assim o jogador convidado vê o nome/ícone REAL da guilda do amigo.
  useEffect(() => {
    if (typeof window === "undefined") return

    const tryDecode = (raw: string | null): Guild | null => {
      if (!raw) return null
      try { return JSON.parse(atob(raw)) as Guild }
      catch { return null }
    }

    const params = new URLSearchParams(window.location.search)
    const gdParam = params.get("gd")
    const decoded = tryDecode(gdParam)

    if (decoded) {
      setInvitePayload(decoded)
      const url = new URL(window.location.href)
      url.searchParams.delete("gd")
      url.searchParams.delete("ref")
      window.history.replaceState({}, "", url.toString())
      return
    }

    // Fallback: localStorage (salvo pelo game-wrapper ao inicializar)
    const stored = localStorage.getItem(LS_INVITE_KEY)
    if (stored) {
      const fromStorage = tryDecode(stored)
      if (fromStorage) setInvitePayload(fromStorage)
      localStorage.removeItem(LS_INVITE_KEY)
    }
  }, [])

  // Persist guild
  useEffect(() => {
    if (guild) localStorage.setItem(LS_KEY, JSON.stringify(guild))
    else localStorage.removeItem(LS_KEY)
  }, [guild])

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:"smooth" })
  }, [guild?.chat])

  const myMember = guild?.members.find(m => m.id === (playerId || "me"))
  const myRole = myMember?.role ?? "member"

  const showFeedback = (msg: string) => {
    setFeedback(msg); setTimeout(() => setFeedback(null), 2500)
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleDailyCheckin = () => {
    if (checkedIn || !guild) return
    setCoins(coins + 50)
    localStorage.setItem("gpgame_guild_checkin", new Date().toDateString())
    setCheckedIn(true)
    showFeedback("✅ Check-in diário! +50 Coins")
  }

  const handleSendChat = () => {
    if (!chatInput.trim() || !guild || !myMember) return
    const msg: ChatMessage = {
      id: `m-${Date.now()}`,
      authorId: myMember.id,
      authorName: myMember.name,
      authorRole: myRole,
      text: chatInput.trim(),
      timestamp: Date.now(),
    }
    setGuild(g => g ? { ...g, chat: [...g.chat.slice(-49), msg] } : g)
    setChatInput("")
  }

  const handleCopyInvite = () => {
    if (!guild) return
    // Serializa um snapshot da guilda em base64 para o link de convite.
    // O jogador convidado decodifica isso e vê os dados REAIS da guilda.
    // Campos sensíveis (chat) são removidos para manter o link compacto.
    const snapshot: Guild = {
      ...guild,
      chat: [], // não incluir histórico de chat no link
    }
    const encoded = btoa(JSON.stringify(snapshot))
    const base = typeof window !== "undefined" ? window.location.origin : "https://gpgameofcc.vercel.app"
    const link = `${base}/?gd=${encoded}&ref=${encodeURIComponent(playerId || "me")}`
    navigator.clipboard.writeText(link).catch(() => {
      // Fallback para browsers que bloqueiam clipboard sem HTTPS
      const ta = document.createElement("textarea")
      ta.value = link; ta.style.position = "fixed"; ta.style.opacity = "0"
      document.body.appendChild(ta); ta.select()
      document.execCommand("copy"); document.body.removeChild(ta)
    })
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    showFeedback("🔗 Link de convite copiado! Envie para seu amigo.")
  }

  const handleJoinGuild = (g: { id:string; name:string; icon:string; joinMode:GuildJoinMode; minLevel:number }) => {
    if (g.joinMode === "approval") {
      showFeedback("📩 Solicitação enviada! Aguarde aprovação do líder.")
      setPendingJoin(null)
      return
    }
    const newGuild: Guild = {
      id: g.id,
      name: g.name,
      icon: g.icon,
      slogan: "",
      level: 1,
      xp: 0,
      xpToNext: XP_PER_LEVEL,
      joinMode: g.joinMode,
      minLevel: g.minLevel,
      description: "",
      maxMembers: 15,
      members: [{
        id: playerId || "me",
        name: playerProfile.name,
        title: playerProfile.title,
        level: playerProfile.level,
        avatarUrl: playerProfile.avatarUrl,
        role: "member",
        lastOnline: Date.now(),
        weeklyContrib: 0,
      }],
      chat: [{ id:"sys", authorId:"system", authorName:"Sistema", authorRole:"leader", text:`🎉 ${playerProfile.name} entrou na guilda!`, timestamp:Date.now() }],
      guildCoins: 0,
      totalDamageToday: 0,
      createdAt: Date.now(),
    }
    setGuild(newGuild)
    setView("main")
    setPendingJoin(null)
    setInviteGuildId(null)
    showFeedback(`🎉 Você entrou em "${g.name}"!`)
  }

  const handleAcceptInvite = () => {
    if (!invitePayload) return

    // Adiciona o jogador atual à lista de membros da guilda real decodificada
    const me: GuildMember = {
      id: playerId || "me",
      name: playerProfile.name,
      title: playerProfile.title ?? "",
      level: playerProfile.level ?? 1,
      avatarUrl: playerProfile.avatarUrl,
      role: "member",
      lastOnline: Date.now(),
      weeklyContrib: 0,
    }

    // Evitar duplicata se o jogador já estava na lista (caso raro)
    const alreadyIn = invitePayload.members.some(m => m.id === me.id)
    const updatedMembers = alreadyIn
      ? invitePayload.members
      : [...invitePayload.members, me]

    const joinedGuild: Guild = {
      ...invitePayload,
      members: updatedMembers,
      chat: [
        // Restaura o chat vazio com mensagem de boas-vindas
        {
          id: `sys-join-${Date.now()}`,
          authorId: "system",
          authorName: "Sistema",
          authorRole: "leader",
          text: `🎉 ${playerProfile.name} entrou na guilda via link de convite!`,
          timestamp: Date.now(),
        },
      ],
    }

    setGuild(joinedGuild)
    setView("main")
    setInvitePayload(null)
    showFeedback(`🎉 Você entrou em "${invitePayload.name}"!`)
  }

  const handleKick = (memberId: string) => {
    if (!guild) return
    setGuild(g => g ? { ...g, members: g.members.filter(m => m.id !== memberId) } : g)
    showFeedback("✅ Membro expulso.")
  }

  const handlePromote = (memberId: string) => {
    if (!guild) return
    setGuild(g => g ? { ...g, members: g.members.map(m => m.id === memberId ? { ...m, role:"officer" as GuildRole } : m) } : g)
    showFeedback("⬆️ Membro promovido a Oficial!")
  }

  const handleLeave = () => {
    if (!guild) return
    if (myRole === "leader" && guild.members.length > 1) {
      showFeedback("⚠️ Passe o cargo antes de sair!")
      setLeaveConfirm(false)
      return
    }
    setGuild(null)
    setLeaveConfirm(false)
    setView("browse")
    showFeedback("Você saiu da guilda.")
  }

  // ── Boss duel ─────────────────────────────────────────────────────────────
  const handleBossStartDuel = (deck: Deck) => {
    setShowDeckSelector(false)
    if (onStartBossDuel) {
      onStartBossDuel(deck.id)
    } else {
      showFeedback("⚔️ Duelo contra o Chefão iniciado com: " + deck.name)
    }
  }

  const guildXpPct = guild ? Math.min(100, (guild.xp / guild.xpToNext) * 100) : 0
  const accentColor = "#8b5cf6"

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight:"100vh", background:"linear-gradient(160deg,#020610 0%,#050d1a 50%,#030a14 100%)",
      color:"#f1f5f9", fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex", flexDirection:"column", position:"relative", overflow:"hidden",
    }}>
      {/* BG glows */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 80% 40% at 50% 0%,rgba(139,92,246,0.10) 0%,transparent 60%)" }}/>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 50% 30% at 80% 80%,rgba(6,182,212,0.06) 0%,transparent 55%)" }}/>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div style={{ position:"fixed", top:72, left:"50%", transform:"translateX(-50%)", zIndex:9999,
          background:"rgba(30,30,50,0.95)", border:"1px solid rgba(139,92,246,0.40)",
          borderRadius:14, padding:"10px 22px", color:"#e2e8f0", fontWeight:800, fontSize:13,
          backdropFilter:"blur(12px)", boxShadow:"0 4px 24px rgba(0,0,0,0.4)",
          animation:"fadeDown 0.25s ease",
        }}>{feedback}</div>
      )}

      {/* ── Modals ── */}

      {/* Invite link modal — exibe dados reais da guilda decodificados do link */}
      {invitePayload && (
        <InviteLinkModal
          inviteGuild={invitePayload}
          currentGuild={guild}
          onAccept={handleAcceptInvite}
          onDecline={() => setInvitePayload(null)}
        />
      )}

      {showCreate && (
        <CreateGuildModal
          onClose={() => setShowCreate(false)}
          onCreate={g => { setGuild(g); setShowCreate(false); setView("main") }}
          coins={coins}
          setCoins={setCoins}
          playerId={playerId}
          playerProfile={playerProfile}
        />
      )}

      {/* Deck selector for boss duel */}
      {showDeckSelector && (
        <DeckSelectorModal
          decks={decks || []}
          onSelect={handleBossStartDuel}
          onClose={() => setShowDeckSelector(false)}
        />
      )}

      {/* Pending join confirm */}
      {pendingJoin && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(14px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"linear-gradient(160deg,#0a0614,#0d0b20)", border:"1px solid rgba(139,92,246,0.30)", borderRadius:24, padding:"24px 20px", maxWidth:360, width:"100%", textAlign:"center" }}>
            <GuildIcon icon={pendingJoin.icon} size={56} fontSize={30} borderRadius={16} />
            <h3 style={{ fontWeight:900, fontSize:18, margin:"12px 0 8px" }}>Entrar em "{pendingJoin.name}"?</h3>
            <p style={{ color:"#64748b", fontSize:13, marginBottom:20 }}>
              {pendingJoin.joinMode === "approval" ? "Esta guilda exige aprovação do líder." : "Entrada livre — você entra imediatamente."}
              {" "}Nível mínimo: <strong style={{ color:"#8b5cf6" }}>Lv.{pendingJoin.minLevel}</strong>
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setPendingJoin(null)} style={{ flex:1, padding:"11px 0", borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)", color:"#64748b", fontWeight:800, fontSize:13, cursor:"pointer" }}>Cancelar</button>
              <button onClick={() => handleJoinGuild(pendingJoin)} style={{ flex:1, padding:"11px 0", borderRadius:11, border:"none", background:"linear-gradient(135deg,#6d28d9,#8b5cf6)", color:"#fff", fontWeight:900, fontSize:13, cursor:"pointer", boxShadow:"0 4px 16px rgba(139,92,246,0.35)" }}>
                {pendingJoin.joinMode === "approval" ? "Solicitar Entrada" : "Entrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave confirm */}
      {leaveConfirm && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(14px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"linear-gradient(160deg,#0a0614,#0d0b20)", border:"1px solid rgba(239,68,68,0.30)", borderRadius:24, padding:"24px 20px", maxWidth:340, width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🚪</div>
            <h3 style={{ fontWeight:900, fontSize:17, margin:"0 0 8px" }}>Sair da Guilda?</h3>
            <p style={{ color:"#64748b", fontSize:13, marginBottom:20 }}>Você ficará sem guilda e terá um cooldown de 24h para entrar em outra.</p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setLeaveConfirm(false)} style={{ flex:1, padding:"11px 0", borderRadius:11, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)", color:"#64748b", fontWeight:800, fontSize:13, cursor:"pointer" }}>Cancelar</button>
              <button onClick={handleLeave} style={{ flex:1, padding:"11px 0", borderRadius:11, border:"none", background:"linear-gradient(135deg,#7f1d1d,#dc2626)", color:"#fff", fontWeight:900, fontSize:13, cursor:"pointer" }}>Confirmar Saída</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ position:"sticky", top:0, zIndex:50, background:"rgba(2,6,16,0.92)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, maxWidth:700, margin:"0 auto" }}>
          <button onClick={onBack} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)", borderRadius:12, padding:"8px 10px", cursor:"pointer", color:"#94a3b8", display:"flex", alignItems:"center" }}>
            <ArrowLeft size={18}/>
          </button>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Users size={18} color={accentColor}/>
              <h1 style={{ fontWeight:900, fontSize:18, margin:0 }}>Guilda</h1>
              {guild && <span style={{ fontSize:12, background:"rgba(139,92,246,0.15)", color:"#c4b5fd", padding:"2px 8px", borderRadius:6, fontWeight:700 }}>Lv.{guild.level}</span>}
            </div>
            <p style={{ color:"#475569", fontSize:11, margin:0 }}>{guild ? guild.name : "Sem guilda"}</p>
          </div>
          {guild && (
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={handleDailyCheckin} disabled={checkedIn} style={{
                background: checkedIn ? "rgba(255,255,255,0.04)" : "rgba(34,197,94,0.15)",
                border: `1px solid ${checkedIn ? "rgba(255,255,255,0.07)" : "rgba(34,197,94,0.35)"}`,
                borderRadius:10, padding:"6px 12px", cursor: checkedIn ? "not-allowed" : "pointer",
                color: checkedIn ? "#334155" : "#22c55e", fontSize:11, fontWeight:800,
              }}>
                {checkedIn ? "✓ Check-in" : "🎁 Check-in"}
              </button>
              <button onClick={() => setView("settings")} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)", borderRadius:10, padding:"6px 10px", cursor:"pointer", color:"#64748b", display:"flex", alignItems:"center" }}>
                <Settings size={16}/>
              </button>
            </div>
          )}
        </div>

        {guild && (
          <div style={{ display:"flex", gap:0, maxWidth:700, margin:"10px auto 0", background:"rgba(255,255,255,0.04)", borderRadius:12, padding:4, overflowX:"auto" }}>
            {[
              { id:"main", label:"🏠 Início" },
              { id:"members", label:"👥 Membros" },
              { id:"chat", label:"💬 Chat" },
              { id:"boss", label:"💀 Chefão" },
              { id:"war", label:"⚔️ Guerra" },
              { id:"shop", label:"🛒 Loja" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setView(tab.id as any)} style={{
                flex:1, padding:"7px 4px", borderRadius:9, border:"none",
                cursor:"pointer", fontWeight:800, fontSize:11, whiteSpace:"nowrap",
                background: view === tab.id ? "linear-gradient(135deg,rgba(139,92,246,0.25),rgba(6,182,212,0.15))" : "transparent",
                color: view === tab.id ? "#e2e8f0" : "#475569",
                transition:"all 0.2s",
              }}>{tab.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex:1, overflowY:"auto", position:"relative", zIndex:1 }}>
        <div style={{ maxWidth:700, margin:"0 auto", padding:"16px 16px 100px" }}>

          {/* ══ BROWSE / NO GUILD ══════════════════════════════════════════════ */}
          {(!guild || view === "browse") && (
            <>
              <div style={{ display:"flex", gap:10, marginBottom:20 }}>
                <button onClick={() => setShowCreate(true)} style={{ flex:1, padding:"14px 0", borderRadius:14, border:"none", background:"linear-gradient(135deg,#6d28d9,#8b5cf6)", color:"#fff", fontWeight:900, fontSize:14, cursor:"pointer", boxShadow:"0 4px 20px rgba(139,92,246,0.35)", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <Plus size={18}/> Criar Guilda <span style={{ fontSize:11, opacity:0.7 }}>({CREATE_COST}🪙)</span>
                </button>
              </div>

              {/* Search */}
              <div style={{ position:"relative", marginBottom:16 }}>
                <Search size={16} color="#475569" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)" }}/>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar guilda por nome..."
                  style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)", borderRadius:12, padding:"11px 14px 11px 40px", color:"#e2e8f0", fontSize:13, boxSizing:"border-box" }}/>
              </div>

              {/* Empty state — no fake bot guilds */}
              <h3 style={{ fontWeight:900, fontSize:12, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:12 }}>
                {searchQuery ? "Resultados" : "Guildas Disponíveis"}
              </h3>

              <div style={{ textAlign:"center", padding:"48px 0", color:"#334155" }}>
                <div style={{ fontSize:56, marginBottom:16 }}>🏰</div>
                <p style={{ fontWeight:800, fontSize:15, color:"#475569", marginBottom:8 }}>Nenhuma guilda pública no momento</p>
                <p style={{ fontSize:13, color:"#334155", marginBottom:24 }}>
                  Crie a sua própria guilda ou peça um link de convite a um amigo.
                </p>
                <div style={{ background:"rgba(6,182,212,0.07)", border:"1px solid rgba(6,182,212,0.18)", borderRadius:14, padding:"14px 18px", display:"inline-block", textAlign:"left", maxWidth:320 }}>
                  <div style={{ fontWeight:800, fontSize:12, color:"#06b6d4", marginBottom:4 }}>💡 Como entrar em uma guilda?</div>
                  <div style={{ fontSize:12, color:"#475569", lineHeight:1.7 }}>
                    1. Peça ao líder da guilda para copiar o link de convite.<br/>
                    2. Abra o link — o jogo vai perguntar se você quer entrar.<br/>
                    3. Aceite e comece a jogar junto!
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══ MAIN (in guild) ════════════════════════════════════════════════ */}
          {guild && view === "main" && (
            <>
              <div style={{ background:"linear-gradient(135deg,rgba(109,40,217,0.18),rgba(55,48,163,0.12))", border:"1px solid rgba(139,92,246,0.28)", borderRadius:20, padding:"20px", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
                  <GuildIcon icon={guild.icon} size={60} fontSize={32} borderRadius={16} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                      <h2 style={{ fontWeight:900, fontSize:18, margin:0 }}>{guild.name}</h2>
                      <span style={{ fontSize:9, fontWeight:800, color: guild.joinMode==="open"?"#22c55e":"#f59e0b" }}>{guild.joinMode==="open"?"🔓":"🔒"}</span>
                    </div>
                    <p style={{ color:"#64748b", fontSize:12, margin:0, fontStyle:"italic" }}>{guild.slogan}</p>
                  </div>
                </div>

                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:11, color:"#64748b" }}>Progresso da Guilda</span>
                    <span style={{ fontSize:11, color:"#a78bfa", fontWeight:800 }}>Lv.{guild.level} · {guild.xp}/{guild.xpToNext} XP</span>
                  </div>
                  <div style={{ height:7, borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:99, width:`${guildXpPct}%`, background:"linear-gradient(90deg,#7c3aed,#a855f7)", boxShadow:"0 0 10px rgba(168,85,247,0.5)", transition:"width 0.6s" }}/>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginTop:14 }}>
                  {[
                    { label:"Membros", value:`${guild.members.length}/${guild.maxMembers}`, icon:"👥" },
                    { label:"Moedas", value:guild.guildCoins.toString(), icon:"🪙" },
                    { label:"Vagas máx", value:`${LEVEL_MAX_MEMBERS[Math.min(10,guild.level)]}`, icon:"📈" },
                  ].map(s => (
                    <div key={s.label} style={{ background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"10px", textAlign:"center" }}>
                      <div style={{ fontSize:16 }}>{s.icon}</div>
                      <div style={{ fontWeight:900, fontSize:14, color:"#e2e8f0", margin:"2px 0" }}>{s.value}</div>
                      <div style={{ fontSize:10, color:"#475569" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite link */}
              <div style={{ background:"rgba(6,182,212,0.07)", border:"1px solid rgba(6,182,212,0.18)", borderRadius:14, padding:"12px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:12, color:"#06b6d4" }}>🔗 Link de Convite</div>
                  <div style={{ fontSize:10, color:"#334155" }}>Envie para amigos — ao abrir, o jogo perguntará se eles querem entrar</div>
                </div>
                <button onClick={handleCopyInvite} style={{ background:"rgba(6,182,212,0.15)", border:"1px solid rgba(6,182,212,0.30)", borderRadius:9, padding:"7px 14px", cursor:"pointer", color:"#06b6d4", fontSize:12, fontWeight:800, display:"flex", alignItems:"center", gap:6 }}>
                  {copied ? <Check size={14}/> : <Copy size={14}/>}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>

              {/* Quick actions */}
              <h3 style={{ fontWeight:900, fontSize:12, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Atividades</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { icon:"💀", label:"Chefão da Guilda", desc:"Duelo difícil vs. Boss", color:"#f87171", action:() => setView("boss") },
                  { icon:"⚔️", label:"Guerra de Guildas", desc:"PVP em equipe", color:"#60a5fa", action:() => setView("war") },
                  { icon:"🎯", label:"Missão Colaborativa", desc:"Meta coletiva", color:"#34d399", action:() => showFeedback("🎯 Nova missão: Vençam 50 duelos juntos!") },
                  { icon:"🛒", label:"Loja da Guilda", desc:"Troque moedas", color:"#fbbf24", action:() => setView("shop") },
                ].map(a => (
                  <button key={a.label} onClick={a.action} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"14px", cursor:"pointer", textAlign:"left", transition:"all 0.2s" }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{a.icon}</div>
                    <div style={{ fontWeight:900, fontSize:13, color:a.color }}>{a.label}</div>
                    <div style={{ fontSize:10, color:"#334155", marginTop:2 }}>{a.desc}</div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"12px 14px" }}>
                <p style={{ color:"#64748b", fontSize:12, margin:0, lineHeight:1.6 }}>{guild.description}</p>
              </div>
            </>
          )}

          {/* ══ MEMBERS ════════════════════════════════════════════════════════ */}
          {guild && view === "members" && (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <h3 style={{ fontWeight:900, fontSize:14, margin:0 }}>👥 {guild.members.length}/{guild.maxMembers} Membros</h3>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {guild.members.sort((a,b) => {
                  const rOrder = {leader:0,officer:1,member:2}
                  return rOrder[a.role]-rOrder[b.role] || b.weeklyContrib-a.weeklyContrib
                }).map(m => (
                  <MemberRow key={m.id} member={m} myRole={myRole}
                    onKick={m.id !== (playerId||"me") && (myRole==="leader"||myRole==="officer") ? () => handleKick(m.id) : undefined}
                    onPromote={m.id !== (playerId||"me") && myRole==="leader" && m.role==="member" ? () => handlePromote(m.id) : undefined}
                  />
                ))}
              </div>
            </>
          )}

          {/* ══ CHAT ═══════════════════════════════════════════════════════════ */}
          {guild && view === "chat" && (
            <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 180px)" }}>
              <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, paddingBottom:12 }}>
                {guild.chat.map(msg => {
                  const isMe = msg.authorId === (playerId||"me")
                  const rl = msg.authorId === "system" ? null : roleLabel(msg.authorRole)
                  return (
                    <div key={msg.id} style={{ display:"flex", flexDirection:"column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      {!isMe && (
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3, paddingLeft:4 }}>
                          <span style={{ fontWeight:800, fontSize:11, color:"#94a3b8" }}>{msg.authorName}</span>
                          {rl && <span style={{ fontSize:8, fontWeight:800, color:rl.color, background:rl.bg, padding:"1px 5px", borderRadius:4 }}>{rl.text}</span>}
                        </div>
                      )}
                      <div style={{
                        maxWidth:"75%", padding:"9px 13px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: msg.authorId==="system"
                          ? "rgba(139,92,246,0.12)"
                          : isMe
                          ? "linear-gradient(135deg,#6d28d9,#8b5cf6)"
                          : "rgba(255,255,255,0.07)",
                        border: msg.authorId==="system" ? "1px solid rgba(139,92,246,0.25)" : "none",
                      }}>
                        <p style={{ margin:0, fontSize:13, color: msg.authorId==="system" ? "#a78bfa" : "#f1f5f9", fontStyle: msg.authorId==="system" ? "italic" : undefined, lineHeight:1.5 }}>{msg.text}</p>
                        <p style={{ margin:"4px 0 0", fontSize:9, color:"rgba(255,255,255,0.35)", textAlign:"right" }}>{timeAgo(msg.timestamp)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef}/>
              </div>

              <div style={{ display:"flex", gap:8, position:"sticky", bottom:0, paddingTop:8, background:"rgba(2,6,16,0.95)" }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handleSendChat()}
                  placeholder="Mensagem para a guilda..."
                  maxLength={200}
                  style={{ flex:1, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12, padding:"11px 14px", color:"#e2e8f0", fontSize:13 }}/>
                <button onClick={handleSendChat} style={{ background:"linear-gradient(135deg,#6d28d9,#8b5cf6)", border:"none", borderRadius:12, padding:"0 16px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                  <Send size={18} color="#fff"/>
                </button>
              </div>
            </div>
          )}

          {/* ══ BOSS ═══════════════════════════════════════════════════════════ */}
          {guild && view === "boss" && (
            <div>
              {/* Boss hero card */}
              <div style={{
                background:"linear-gradient(135deg,rgba(127,29,29,0.35),rgba(15,3,3,0.50))",
                border:"1px solid rgba(220,38,38,0.35)", borderRadius:20,
                padding:"24px 20px", marginBottom:20, textAlign:"center",
                position:"relative", overflow:"hidden",
              }}>
                <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 0%,rgba(220,38,38,0.12) 0%,transparent 60%)", pointerEvents:"none" }}/>
                <div style={{ fontSize:68, marginBottom:8, filter:"drop-shadow(0 0 20px rgba(220,38,38,0.7))" }}>💀</div>
                <h2 style={{ fontWeight:900, fontSize:22, margin:"0 0 6px", color:"#f87171" }}>Chefão da Guilda</h2>
                <p style={{ color:"#64748b", fontSize:13, margin:"0 0 20px", lineHeight:1.6 }}>
                  Enfrente o Chefão em um <strong style={{ color:"#f1f5f9" }}>duelo difícil de verdade</strong>.<br/>
                  Escolha seu melhor deck e supere o desafio!
                </p>

                {/* Reward tiers */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
                  {[
                    { faixa:"Derrota Honrosa", recompensa:"25 🪙", color:"#64748b" },
                    { faixa:"Vitória Rápida", recompensa:"100 🪙 + Pack", color:"#fbbf24" },
                    { faixa:"Vitória Perfeita", recompensa:"200 🪙 + Pack SR", color:"#60a5fa" },
                    { faixa:"Lendário (sem dano)", recompensa:"500 🪙 + Pack LR", color:"#a855f7" },
                  ].map(r => (
                    <div key={r.faixa} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"12px" }}>
                      <div style={{ fontSize:11, color:"#64748b" }}>{r.faixa}</div>
                      <div style={{ fontWeight:900, fontSize:12, color:r.color, marginTop:4 }}>{r.recompensa}</div>
                    </div>
                  ))}
                </div>

                {/* Difficulty warning */}
                <div style={{ background:"rgba(220,38,38,0.10)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:20, textAlign:"left" }}>
                  <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                    <span style={{ fontSize:16 }}>⚠️</span>
                    <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.6 }}>
                      <strong style={{ color:"#f87171" }}>Chefão Atual: Mefisto das Sombras</strong><br/>
                      Nível de dificuldade: Extremo · 4.000 HP · Habilidades especiais ativas
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowDeckSelector(true)}
                  style={{
                    width:"100%", padding:"16px 0", borderRadius:14, border:"none",
                    background:"linear-gradient(135deg,#dc2626,#ef4444)",
                    color:"#fff", fontWeight:900, fontSize:16, cursor:"pointer",
                    boxShadow:"0 4px 24px rgba(220,38,38,0.50)",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                    transition:"all 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 6px 32px rgba(220,38,38,0.70)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 24px rgba(220,38,38,0.50)")}
                >
                  <Swords size={20}/> Escolher Deck e Batalhar
                </button>
              </div>

              {/* Best scores placeholder */}
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"16px" }}>
                <h4 style={{ fontWeight:900, fontSize:13, margin:"0 0 12px", color:"#94a3b8" }}>🏆 Ranking da Guilda — Boss da Semana</h4>
                {guild.members.slice(0,5).map((m, i) => (
                  <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span style={{ fontSize:16, width:24, textAlign:"center" }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                    <span style={{ flex:1, fontSize:13, color:"#e2e8f0", fontWeight:700 }}>{m.name}</span>
                    <span style={{ fontSize:12, color:"#fbbf24", fontWeight:800 }}>{Math.floor(Math.random()*3000+500)} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ WAR ════════════════════════════════════════════════════════════ */}
          {guild && view === "war" && (
            <>
              <h3 style={{ fontWeight:900, fontSize:16, marginBottom:16, color:"#60a5fa" }}>⚔️ Guerra de Guildas</h3>
              <div style={{ background:"rgba(37,99,235,0.10)", border:"1px solid rgba(37,99,235,0.25)", borderRadius:16, padding:"20px", marginBottom:14, textAlign:"center" }}>
                <div style={{ fontSize:48, marginBottom:8 }}>🏟️</div>
                <p style={{ color:"#64748b", fontSize:13 }}>Próxima Guerra começa em</p>
                <p style={{ fontWeight:900, fontSize:24, color:"#60a5fa", margin:"4px 0" }}>18:32:07</p>
                <p style={{ color:"#334155", fontSize:11 }}>Enfrente outra guilda em duelos PVP em tempo real. Ganha moedas ao vencer!</p>
              </div>
              <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px", marginBottom:10 }}>
                <h4 style={{ fontWeight:900, fontSize:13, margin:"0 0 10px", color:"#94a3b8" }}>📊 Últimas Guerras</h4>
                {[
                  { oponente:"Dragões do Norte", resultado:"Vitória", pontos:"+120🪙" },
                  { oponente:"Clã da Tempestade", resultado:"Derrota", pontos:"+30🪙" },
                ].map((w,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom: i===0?"1px solid rgba(255,255,255,0.05)":"none" }}>
                    <span style={{ color:"#94a3b8", fontSize:13 }}>vs {w.oponente}</span>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:800, color: w.resultado==="Vitória"?"#22c55e":"#f87171" }}>{w.resultado}</span>
                      <span style={{ fontSize:11, color:"#fbbf24" }}>{w.pontos}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══ SHOP ═══════════════════════════════════════════════════════════ */}
          {guild && view === "shop" && (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <h3 style={{ fontWeight:900, fontSize:16, margin:0, color:"#fbbf24" }}>🛒 Loja da Guilda</h3>
                <span style={{ fontSize:13, fontWeight:800, color:"#fbbf24" }}>🪙 {guild.guildCoins} moedas</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  { name:"Pack de Gacha Comum", cost:50, icon:"📦", desc:"1 pack comum" },
                  { name:"100 Gacha Coins", cost:80, icon:"🪙", desc:"Moedas do jogo" },
                  { name:"Pack de Gacha SR", cost:200, icon:"💎", desc:"Garante SR ou acima" },
                  { name:"Título Exclusivo", cost:500, icon:"🏷️", desc:"Título de guilda" },
                ].map(item => (
                  <div key={item.name} style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px" }}>
                    <div style={{ fontSize:28, width:44, height:44, background:"rgba(251,191,36,0.10)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>{item.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:900, fontSize:13 }}>{item.name}</div>
                      <div style={{ fontSize:11, color:"#475569" }}>{item.desc}</div>
                    </div>
                    <button
                      onClick={() => guild.guildCoins >= item.cost
                        ? showFeedback(`✅ ${item.name} comprado!`)
                        : showFeedback("❌ Moedas insuficientes!")}
                      style={{ padding:"8px 14px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#92400e,#d97706)", color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer" }}>
                      🪙 {item.cost}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ══ SETTINGS ═══════════════════════════════════════════════════════ */}
          {guild && view === "settings" && (
            <>
              <h3 style={{ fontWeight:900, fontSize:16, marginBottom:16 }}>⚙️ Configurações da Guilda</h3>
              {myRole === "leader" && (
                <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px", marginBottom:14 }}>
                  <h4 style={{ fontWeight:900, fontSize:13, margin:"0 0 12px", color:"#94a3b8" }}>👑 Opções do Líder</h4>
                  {[
                    { label:"Entrada", value:guild.joinMode==="open"?"🔓 Livre":"🔒 Aprovação",
                      action:() => setGuild(g => g ? {...g, joinMode: g.joinMode==="open"?"approval":"open"} : g) },
                    { label:"Nível mínimo", value:`Lv.${guild.minLevel}`, action:() => {} },
                  ].map(s => (
                    <div key={s.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ color:"#94a3b8", fontSize:13 }}>{s.label}</span>
                      <button onClick={s.action} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"4px 12px", cursor:"pointer", color:"#e2e8f0", fontSize:12, fontWeight:700 }}>{s.value}</button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setLeaveConfirm(true)} style={{ width:"100%", padding:"14px 0", borderRadius:14, border:"1px solid rgba(239,68,68,0.30)", background:"rgba(239,68,68,0.08)", color:"#f87171", fontWeight:900, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <LogOut size={16}/> Sair da Guilda
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
      `}</style>
    </div>
  )
}
