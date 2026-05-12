"use client"

import { useState, useEffect, useRef } from "react"
import {
  ArrowLeft, Plus, Users, Send, Smile, X as XIcon,
  Swords, Settings, LogOut, Copy, Check,
} from "lucide-react"
import { useGame } from "@/contexts/game-context"
import type { Deck } from "@/contexts/game-context"
import { createClient } from "@/lib/supabase/client"

// ─── Direct REST helpers for Supabase ────────────────────────────────────────
// Reads env vars at call time (not module load time) to ensure they're available.
// NEXT_PUBLIC_ vars are inlined by Next.js at build time — always available client-side.

function getSupaConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  const base = url.endsWith("/") ? url.slice(0, -1) : url
  return { base, key }
}

async function sbInsert(table: string, row: Record<string, unknown>): Promise<{ error: string | null }> {
  const { base, key } = getSupaConfig()
  if (!base || !key) return { error: "Supabase não configurado — verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel" }
  try {
    const res = await fetch(`${base}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        key,
        "Authorization": "Bearer " + key,
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify(row),
    })
    if (!res.ok) {
      const body = await res.text()
      return { error: "HTTP " + res.status + ": " + body }
    }
    return { error: null }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

async function sbSelect<T>(table: string, filter?: string): Promise<{ data: T[] | null; error: string | null }> {
  const { base, key } = getSupaConfig()
  if (!base || !key) return { data: null, error: "Supabase não configurado" }
  try {
    const url = base + "/rest/v1/" + table + (filter ? "?" + filter : "")
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "apikey":        key,
        "Authorization": "Bearer " + key,
        "Accept":        "application/json",
      },
    })
    if (!res.ok) {
      const body = await res.text()
      return { data: null, error: "HTTP " + res.status + ": " + body }
    }
    const data = await res.json()
    return { data: Array.isArray(data) ? data : [data], error: null }
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : String(e) }
  }
}

async function sbDelete(table: string, filter: string): Promise<{ error: string | null }> {
  const { base, key } = getSupaConfig()
  if (!base || !key) return { error: "Supabase não configurado" }
  try {
    const res = await fetch(base + "/rest/v1/" + table + "?" + filter, {
      method: "DELETE",
      headers: {
        "apikey":        key,
        "Authorization": "Bearer " + key,
        "Prefer":        "return=minimal",
      },
    })
    if (!res.ok) {
      const body = await res.text()
      return { error: "HTTP " + res.status + ": " + body }
    }
    return { error: null }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

async function sbUpdate(table: string, filter: string, row: Record<string, unknown>): Promise<{ error: string | null }> {
  const { base, key } = getSupaConfig()
  if (!base || !key) return { error: "Supabase não configurado" }
  try {
    const res = await fetch(base + "/rest/v1/" + table + "?" + filter, {
      method: "PATCH",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        key,
        "Authorization": "Bearer " + key,
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify(row),
    })
    if (!res.ok) {
      const body = await res.text()
      return { error: "HTTP " + res.status + ": " + body }
    }
    return { error: null }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

async function sbUpsert(table: string, row: Record<string, unknown>): Promise<{ error: string | null }> {
  const { base, key } = getSupaConfig()
  if (!base || !key) return { error: "Supabase não configurado" }
  try {
    const res = await fetch(base + "/rest/v1/" + table, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        key,
        "Authorization": "Bearer " + key,
        "Prefer":        "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    })
    if (!res.ok) {
      const body = await res.text()
      return { error: "HTTP " + res.status + ": " + body }
    }
    return { error: null }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

// ─── Auto-cleanup: delete guilds with no members ─────────────────────────────
async function cleanupEmptyGuilds(): Promise<void> {
  const { base, key } = getSupaConfig()
  if (!base || !key) return
  try {
    // Get all guild IDs
    const guildsRes = await fetch(base + "/rest/v1/guilds?select=id", {
      headers: { "apikey": key, "Authorization": "Bearer " + key, "Accept": "application/json" },
    })
    if (!guildsRes.ok) return
    const guilds: { id: string }[] = await guildsRes.json()
    if (!guilds.length) return

    // For each guild, check if it has members
    for (const g of guilds) {
      const membersRes = await fetch(
        base + "/rest/v1/guild_members?guild_id=eq." + g.id + "&select=id&limit=1",
        { headers: { "apikey": key, "Authorization": "Bearer " + key, "Accept": "application/json" } }
      )
      if (!membersRes.ok) continue
      const members: unknown[] = await membersRes.json()
      if (members.length === 0) {
        // No members — delete guild (cascade deletes chat too)
        await fetch(base + "/rest/v1/guilds?id=eq." + g.id, {
          method: "DELETE",
          headers: {
            "apikey": key, "Authorization": "Bearer " + key, "Prefer": "return=minimal",
          },
        })
        console.log("[Guild Cleanup] Deleted empty guild:", g.id)
      }
    }
  } catch (e) {
    console.warn("[Guild Cleanup] Error:", e)
  }
}

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
const LS_CHECKIN    = "gpgame_guild_checkin"
const LS_KICKED     = "gpgame_guild_kicked"
const LS_ALL_GUILDS = "gpgame_all_guilds"

// Emotes — mesmos do lobby multiplayer
const GAME_EMOTES = [
  { id: "emote-1", name: "Chorando de Alegria", image: "/images/emotes/emote-1.png" },
  { id: "emote-2", name: "Confiante",            image: "/images/emotes/emote-2.png" },
  { id: "emote-3", name: "Raiva",                image: "/images/emotes/emote-3.png" },
  { id: "emote-4", name: "Feliz",                image: "/images/emotes/emote-4.png" },
  { id: "emote-5", name: "Surpreso",             image: "/images/emotes/emote-5.png" },
  { id: "emote-6", name: "Fogo",                 image: "/images/emotes/emote-6.png" },
]

// ─── Filtro de palavrões ─────────────────────────────────────────────────────
// Lista de termos proibidos (português + inglês). A checagem ignora acentos e
// leetspeak básico, e usa regex de palavra inteira para evitar falsos positivos.
const BANNED_WORDS = [
  // ── Português ────────────────────────────────────────────────────────────
  "porra","caralho","merda","puta","putaria","putinha","putas",
  "viado","viadinho","viadao","viada","gay","gayzao",
  "cu","cuzao","cuzinho","bunda","bundao","bundinha",
  "buceta","bucetinha","xoxota","xota","piroca","pirocao","piroca",
  "pau","pauzao","pinto","pintinho","rola","rolao",
  "cacete","cacetao","caralho",
  "arrombado","arrombada","arrombamento",
  "fdp","f.d.p","filho da puta","filha da puta","filho de uma puta",
  "filha de uma puta","filho da p","fdp",
  "desgraca","desgraça","desgraçado","desgraçada",
  "vagabundo","vagabunda","vagabunda",
  "vadia","vadiagem","vadio",
  "idiota","imbecil","babaca","bababca",
  "retardado","retardada","retardo",
  "mongoloide","mongoloid","mongol",
  "corno","cornudo","corna",
  "bosta","bostinha","bostas",
  "otario","otária","otarios",
  "piranha","prostituta","prostituicao",
  "puta merda","vai se foder","vai tomar no cu","vai tomar","vsf","vtnc","vaf",
  "maldito","maldita","maldição",
  "safado","safada","safadeza",
  "canalha","escroto","escrotão","escrotona",
  "broxa","broxar","brocheur",
  "punheta","punhetas","punheteiro",
  "siririca","sirica",
  "foder","fodase","foda-se","foda se","se foda",
  "fuder","fudeu","fodeu",
  "cacete","caralho","porra",
  "lixo","lazaro","inutil",
  // ── Inglês ────────────────────────────────────────────────────────────────
  "fuck","fucking","fucked","fucker","fucks","wtf","stfu","gtfo",
  "shit","shits","shitty","bullshit","horseshit",
  "ass","asshole","asses","jackass","smartass","dumbass",
  "bitch","bitches","bitchy","son of a bitch","son of bitch","soab",
  "bastard","bastards",
  "damn","dammit","goddamn","goddammit",
  "crap","crappy",
  "dick","dicks","dickhead","dickface",
  "cock","cocks","cocksucker",
  "pussy","pussies",
  "whore","whores","whorish",
  "slut","sluts","slutty",
  "motherfucker","motherfucking","mofo","mf",
  "nigger","nigga","niggas","nig",
  "faggot","fag","fags",
  "retard","retarded","retards",
  "idiot","idiots","idiotic",
  "moron","morons","moronic",
  "cunt","cunts",
  "prick","pricks",
  "wanker","wankers","wank",
  "twat","twats",
  "arsehole","arse",
  "bollocks","bollock",
  "shag","shagging",
  "tosser","tossers",
  "piss","pissed","pisser",
  "cum","cumshot",
  "penis","vagina","anal","anus",
  // ── Espanhol ──────────────────────────────────────────────────────────────
  "puta","putas","putita","hijo de puta","hija de puta","hdp",
  "coño","cono","conyo",
  "mierda","mierdas",
  "joder","jodido","jodida",
  "cabron","cabrón","cabrona","cabronas",
  "polla","pollas","pollón",
  "culo","culos","culito",
  "pendejo","pendeja","pendejos",
  "chinga","chingada","chingado","chingar","hijo de la chingada",
  "pinche","pinches",
  "verga","vergon","vergón",
  "mamón","mamon","mamona",
  "idiota","imbecil","estupido","estupida",
  "zorra","zorras","zorron",
  "perico","maricon","maricón",
  "culero","culera","culeros",
  "carajo","carajos",
  "hostia","hostias",
  "gilipolla","gilipollas",
  "leche","lechazo",
  "follar","follando","follador",
  // ── Alemão ────────────────────────────────────────────────────────────────
  "scheiße","scheisse","scheißkerl","scheißkopf",
  "arsch","arschloch","arschkopf",
  "fick","ficken","gefickt","ficker",
  "wichser","wichsen","wichse",
  "hurensohn","hure","huren",
  "fotze","fotzen",
  "schwanz","schwanzlutscher",
  "schlampe","schlampen",
  "idiot","idioten","dummkopf","dumm",
  "bastard","bastarde","dreckssau",
  "verdammt","verdamme","verflucht",
  "kacke","kacken","kacker",
  "pisser","pissen","piss",
  "nutte","nutten",
  "missgeburt","blödmann","blödkopf",
  // ── Francês ───────────────────────────────────────────────────────────────
  "merde","merdes","merdique",
  "putain","putains","pute","putes",
  "connard","connards","connarde","con",
  "salope","salopes","salopard",
  "enculé","encule","enculer",
  "foutre","foutaise","va te faire foutre",
  "baiser","baiseur",
  "bite","bites","couille","couilles",
  "bordel","bordels",
  "chier","chieur","chiasse",
  "cul","culs","culot",
  "nique","niquer","niqué",
  "pd","pédé","pédés",
  "bâtard","batard","batards",
  "idiot","imbecile","cretin","crétine",
  // ── Italiano ──────────────────────────────────────────────────────────────
  "cazzo","cazzi","cazzata","cazzate",
  "stronzo","stronza","stronzate","stronzi",
  "vaffanculo","fanculo","fancul",
  "minchia","minkia","minchiate",
  "porco","porca","porcata","porcodio","porcamadonna",
  "figlio di puttana","figlia di puttana","fdp",
  "troia","troie","troiata",
  "bastardo","bastarda","bastardi",
  "idiota","idioti","imbecille","cretino","cretina",
  "merda","merde","merdoso",
  // ── Japonês (romaji) ─────────────────────────────────────────────────────
  "kuso","kusotare","kusoyaro",
  "chikusho","chikushome",
  "baka","bakayaro","bakatare",
  "aho","ahon","ahondara",
  "shine","shineyo","shinjimae",
  "kisama","temee","teme",
  "yaro","yarō","kichiku",
  "manko","chinko","chinpo","chinpoko",
  "unko","unkokora",
  "hentai","ecchi",
]

// Normaliza texto: remove acentos, lowercase, remove espaços duplos
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // remove acentos
    .replace(/[4@]/g, "a").replace(/3/g, "e")           // leetspeak básico
    .replace(/1/g, "i").replace(/0/g, "o").replace(/5/g, "s")
    .replace(/\s+/g, " ").trim()
}

function containsBannedWord(text: string): string | null {
  const norm = normalize(text)
  const padded = " " + norm + " "
  for (const word of BANNED_WORDS) {
    if (
      padded.includes(" " + word + " ") ||
      norm === word ||
      norm.startsWith(word + " ") ||
      norm.endsWith(" " + word)
    ) {
      return word
    }
  }
  return null
}

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

    // If supabase is null, env vars are missing
    if (!supabase) {
      setError("Supabase não configurado. Verifique as variáveis de ambiente na Vercel (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).")
      setSaving(false)
      return
    }

    const guildId = `guild-${Date.now()}`

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

    // Debug: log what URL and key are being used
    const { base: debugBase, key: debugKey } = (() => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
      return { base: url, key }
    })()
    console.log("[Guild Create] SUPABASE_URL:", debugBase || "EMPTY!")
    console.log("[Guild Create] ANON_KEY set:", debugKey ? "YES (" + debugKey.slice(0,20) + "...)" : "NO — EMPTY!")

    if (!debugBase) {
      setError("NEXT_PUBLIC_SUPABASE_URL está vazio. Verifique as variáveis de ambiente na Vercel e faça um novo deploy.")
      setSaving(false); return
    }
    if (!debugKey) {
      setError("NEXT_PUBLIC_SUPABASE_ANON_KEY está vazio. Verifique as variáveis de ambiente na Vercel e faça um novo deploy.")
      setSaving(false); return
    }

    // Use direct REST API — more reliable than @supabase/ssr in browser
    const { error: gErr } = await sbUpsert("guilds", {
      id: newGuild.id, name: newGuild.name, icon: newGuild.icon,
      slogan: newGuild.slogan, description: newGuild.description,
      level: 1, xp: 0, xp_to_next: XP_PER_LEVEL,
      join_mode: newGuild.join_mode, min_level: newGuild.min_level,
      max_members: 15, guild_coins: 0,
      total_damage_today: 0, created_at: newGuild.created_at,
    })
    if (gErr) {
      setError("Erro ao salvar guilda: " + gErr)
      setSaving(false); return
    }

    const { error: mErr } = await sbUpsert("guild_members", {
      id: newMember.id, guild_id: guildId,
      name: newMember.name, title: newMember.title,
      level: newMember.level, avatar_url: newMember.avatar_url,
      role: "leader", last_online: newMember.last_online, weekly_contrib: 0,
    })
    if (mErr) {
      setError("Erro ao salvar membro: " + mErr)
      setSaving(false); return
    }

    await sbInsert("guild_chat", {
      id: "sys-" + Date.now(), guild_id: guildId,
      author_id: "system", author_name: "Sistema", author_role: "leader",
      text: "🎉 Guilda [" + newGuild.name + "] foi criada! Bem-vindos!",
      timestamp: Date.now(),
    })

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

        {/* Text fields — written out explicitly to avoid Turbopack inference issues */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Nome da Guilda *</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={30}
            placeholder="Mínimo 3 caracteres"
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Slogan</label>
          <input value={slogan} onChange={e => setSlogan(e.target.value)} maxLength={50}
            placeholder="Frase de impacto"
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Descrição</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={120}
            placeholder="Descreva sua guilda..." rows={2}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>

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
  // Always create a fresh client reference (singleton is handled inside createClient)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = createClient()
  const myId = playerId || `anon-${Date.now()}`

  // ── State ──────────────────────────────────────────────────────────────────
  const [guild,         setGuild]         = useState<Guild | null>(null)
  const [members,       setMembers]       = useState<GuildMember[]>([])
  const [chat,          setChat]          = useState<ChatMessage[]>([])
  const [loading,       setLoading]       = useState(true)
  const [view,          setView]          = useState<"main"|"members"|"chat"|"boss"|"war"|"shop"|"settings"|"browse"|"guilds">("browse")
  const [showCreate,    setShowCreate]    = useState(false)
  const [showDeckSel,   setShowDeckSel]   = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [feedback,      setFeedback]      = useState<string | null>(null)
  const [leaveConfirm,  setLeaveConfirm]  = useState(false)
  const [chatInput,     setChatInput]     = useState("")
  const [invitePayload, setInvitePayload] = useState<Guild | null>(null)
  const [checkedIn,     setCheckedIn]     = useState(false)
  const [showEmotes,    setShowEmotes]    = useState(false)
  const [chatError,     setChatError]     = useState<string|null>(null)
  const [unreadChat,    setUnreadChat]    = useState(0)  // unread msg count when not on chat tab
  const [allGuilds,     setAllGuilds]     = useState<Guild[]>([])
  const [kicked,        setKicked]        = useState(false)   // true if kicked from a guild
  const [supabaseOk,    setSupabaseOk]    = useState<boolean | null>(null) // null = checking

  const chatEndRef = useRef<HTMLDivElement>(null)
  const myMember   = members.find(m => m.id === myId)
  const myRole     = myMember?.role ?? "member"
  const guildXpPct = guild ? Math.min(100, (guild.xp / guild.xp_to_next) * 100) : 0

  const toast = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2800)
  }

  // ── 0. Check Supabase client exists ──────────────────────────────────────────
  useEffect(() => {
    const sb = createClient()
    setSupabaseOk(sb !== null)
  }, [])

  // ── 1. Load guild on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const savedId    = localStorage.getItem(LS_GUILD_ID)
    const kickedFrom = localStorage.getItem(LS_KICKED)

    // If kicked, show kicked state immediately
    if (kickedFrom && kickedFrom === savedId) {
      setKicked(true)
      setLoading(false)
      return
    }

    // Debug: log connection status to browser console
    console.log("[Guild] supabase client:", supabase ? "OK" : "NULL")
    console.log("[Guild] SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "undefined")
    console.log("[Guild] ANON_KEY set:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

    if (!supabase) { setLoading(false); return }

    // Cleanup empty guilds first, then fetch all
    const loadAllGuilds = async () => {
      await cleanupEmptyGuilds()
      const { data } = await sbSelect<Guild>("guilds", "order=level.desc")
      if (data) setAllGuilds(data)
    }
    loadAllGuilds()

    if (!savedId) { setLoading(false); return }

    ;(async () => {
      const { data: gArr } = await sbSelect<Guild>("guilds", `id=eq.${savedId}&limit=1`)
      const gData = gArr?.[0] ?? null
      if (!gData) { localStorage.removeItem(LS_GUILD_ID); setLoading(false); return }

      // Verify I'm still a member (might have been kicked while offline)
      const { data: meArr } = await sbSelect<{id:string}>("guild_members", `id=eq.${myId}&guild_id=eq.${savedId}&select=id&limit=1`)
      if (!meArr || meArr.length === 0) {
        localStorage.setItem(LS_KICKED, savedId)
        localStorage.removeItem(LS_GUILD_ID)
        setKicked(true); setLoading(false); return
      }

      const { data: mData } = await sbSelect<GuildMember>("guild_members", `guild_id=eq.${savedId}`)
      const { data: cData } = await sbSelect<ChatMessage>("guild_chat", `guild_id=eq.${savedId}&order=timestamp.asc&limit=50`)

      setGuild(gData as Guild)
      setMembers((mData ?? []) as GuildMember[])
      setChat((cData ?? []) as ChatMessage[])
      setView("main")
      setCheckedIn(localStorage.getItem(LS_CHECKIN) === new Date().toDateString())
      setLoading(false)

      // Update my last_online ping
      await sbUpdate("guild_members", `id=eq.${myId}`, { last_online: Date.now() })
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
          const deletedId = (old as GuildMember).id
          // If I was the one deleted — I was kicked
          if (deletedId === myId) {
            localStorage.setItem(LS_KICKED, gid)
            localStorage.removeItem(LS_GUILD_ID)
            setGuild(null); setMembers([]); setChat([])
            setKicked(true); setView("browse")
          } else {
            setMembers(prev => prev.filter(x => x.id !== deletedId))
          }
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
        // Increment unread badge when user is NOT on chat tab and msg is from someone else
        if (msg.author_id !== myId) {
          setView(currentView => {
            if (currentView !== "chat") setUnreadChat(n => n + 1)
            return currentView
          })
        }
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

    // ── all guilds list: real-time updates ──────────────────────────────────
    const allGuildsCh = supabase
      .channel("all-guilds")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "guilds",
      }, async () => {
        // Re-fetch full list on any change
        const { data } = await sbSelect<Guild>("guilds", "order=level.desc")
        if (data) setAllGuilds(data)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(membersCh)
      supabase.removeChannel(chatCh)
      supabase.removeChannel(guildCh)
      supabase.removeChannel(allGuildsCh)
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

    // Ensure guild row exists
    const { data: existArr } = await sbSelect<{id:string}>("guilds", `id=eq.${gid}&select=id&limit=1`)
    if (!existArr || existArr.length === 0) {
      await sbInsert("guilds", {
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
    const { data: alreadyArr } = await sbSelect<{id:string}>("guild_members", `id=eq.${myId}&select=id&limit=1`)
    if (!alreadyArr || alreadyArr.length === 0) {
      await sbInsert("guild_members", {
        id: myId, guild_id: gid,
        name: playerProfile.name, title: playerProfile.title ?? "",
        level: playerProfile.level ?? 1, avatar_url: playerProfile.avatarUrl,
        role: "member", last_online: Date.now(), weekly_contrib: 0,
      })
      await sbInsert("guild_chat", {
        id: "sys-join-" + Date.now(), guild_id: gid,
        author_id: "system", author_name: "Sistema", author_role: "leader",
        text: "🎉 " + String(playerProfile.name) + " entrou na guilda via convite!",
        timestamp: Date.now(),
      })
    }

    // Fetch everything fresh
    const { data: gArr2 } = await sbSelect<Guild>("guilds", `id=eq.${gid}&limit=1`)
    const { data: mData  } = await sbSelect<GuildMember>("guild_members", `guild_id=eq.${gid}`)
    const { data: cData  } = await sbSelect<ChatMessage>("guild_chat", `guild_id=eq.${gid}&order=timestamp.asc&limit=50`)

    setGuild(gArr2?.[0] ?? null)
    setMembers(mData ?? [])
    setChat(cData ?? [])

    localStorage.setItem(LS_GUILD_ID, gid)
    setInvitePayload(null)
    setView("main")
    toast(`🎉 Você entrou em "${invitePayload.name}"!`)
  }

  const handleSendChat = async () => {
    const text = chatInput.trim()
    if (!text || !guild || !myMember) return

    // ── Filtro de palavrões ────────────────────────────────────────────────
    const banned = containsBannedWord(text)
    if (banned) {
      setChatError("🚫 Mensagem bloqueada — o chat da guilda deve ser respeitoso com todos os membros.")
      setTimeout(() => setChatError(null), 3500)
      return   // NÃO envia e NÃO limpa o input para o usuário poder corrigir
    }

    const msg: ChatMessage = {
      id:          `m-${myId}-${Date.now()}`,
      guild_id:    guild.id,
      author_id:   myId,
      author_name: myMember.name,
      author_role: myRole,
      text,
      timestamp:   Date.now(),
    }
    // Optimistic: add immediately for sender
    setChat(prev => [...prev.slice(-49), msg])
    setChatInput("")
    setChatError(null)

    await sbInsert("guild_chat", {
      id: msg.id, guild_id: msg.guild_id,
      author_id: msg.author_id, author_name: msg.author_name,
      author_role: msg.author_role, text: msg.text, timestamp: msg.timestamp,
    })
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
    await sbUpdate("guild_members", `id=eq.${myId}`, {
      weekly_contrib: (myMember?.weekly_contrib ?? 0) + 10,
    })
  }

  const handleKick = async (memberId: string) => {
    if (!guild || !supabase) return
    await sbDelete("guild_members", `id=eq.${memberId}`)
    // Realtime DELETE will update everyone's list in real time.
    // The kicked player's subscription will also fire and redirect them.
    toast("✅ Membro expulso.")
    // Cleanup if guild now empty
    setTimeout(() => cleanupEmptyGuilds(), 1500)
  }

  const handlePromote = async (memberId: string) => {
    if (!guild || !supabase) return
    await sbUpdate("guild_members", `id=eq.${memberId}`, { role: "officer" })
    toast("⬆️ Membro promovido a Oficial!")
  }

  const handleLeave = async () => {
    if (!guild) return

    // If leader and there are other members → pass leadership to next member
    if (myRole === "leader" && members.length > 1) {
      // Pick the member who joined right after the leader (second in list by insertion order)
      const others = members.filter(m => m.id !== myId)
      // Sort by last_online ascending to get the oldest member (closest to leader)
      const successor = others.sort((a, b) => a.last_online - b.last_online)[0]
      if (successor) {
        await sbUpdate("guild_members", "id=eq." + successor.id, { role: "leader" })
        await sbInsert("guild_chat", {
          id: "sys-leader-" + Date.now(), guild_id: guild.id,
          author_id: "system", author_name: "Sistema", author_role: "leader",
          text: "👑 " + successor.name + " é o novo líder da guilda!",
          timestamp: Date.now(),
        })
        toast("👑 Liderança passada para " + successor.name)
      }
    }

    // Remove self from guild
    await sbDelete("guild_members", "id=eq." + myId)

    // If was the last member — delete the guild too
    if (members.length <= 1) {
      await sbDelete("guilds", "id=eq." + guild.id)
    }

    localStorage.removeItem(LS_GUILD_ID)
    setGuild(null); setMembers([]); setChat([])
    setLeaveConfirm(false); setView("browse")
    toast("Você saiu da guilda.")
    setTimeout(() => cleanupEmptyGuilds(), 1000)
  }

  const handleSendEmote = async (emote: typeof GAME_EMOTES[0]) => {
    if (!guild || !myMember) return
    setShowEmotes(false)
    const msg: ChatMessage = {
      id:          `emote-${myId}-${Date.now()}`,
      guild_id:    guild.id,
      author_id:   myId,
      author_name: myMember.name,
      author_role: myRole,
      text:        `__emote__${emote.id}__${emote.image}__${emote.name}`,
      timestamp:   Date.now(),
    }
    // Optimistic
    setChat(prev => [...prev.slice(-49), msg])
    await sbInsert("guild_chat", {
      id: msg.id, guild_id: msg.guild_id,
      author_id: msg.author_id, author_name: msg.author_name,
      author_role: msg.author_role, text: msg.text, timestamp: msg.timestamp,
    })
  }

  const handleJoinPublicGuild = async (g: Guild) => {
    if (guild) { toast("⚠️ Você já pertence a uma guilda. Saia primeiro."); return }
    if (g.join_mode === "approval") {
      toast("📩 Solicitação enviada! Aguarde aprovação do líder.")
      return
    }
    // Join open guild directly
    const { error } = await sbUpsert("guild_members", {
      id: myId, guild_id: g.id,
      name: playerProfile.name, title: playerProfile.title ?? "",
      level: playerProfile.level ?? 1, avatar_url: playerProfile.avatarUrl,
      role: "member", last_online: Date.now(), weekly_contrib: 0,
    })
    if (error) { toast("❌ Erro ao entrar: " + error); return }

    await sbInsert("guild_chat", {
      id: "sys-join-" + Date.now(), guild_id: g.id,
      author_id: "system", author_name: "Sistema", author_role: "leader",
      text: "🎉 " + playerProfile.name + " entrou na guilda!",
      timestamp: Date.now(),
    })

    // Fetch fresh guild data
    const { data: gArr } = await sbSelect<Guild>("guilds", "id=eq." + g.id + "&limit=1")
    const { data: mData } = await sbSelect<GuildMember>("guild_members", "guild_id=eq." + g.id)
    const { data: cData } = await sbSelect<ChatMessage>("guild_chat", "guild_id=eq." + g.id + "&order=timestamp.asc&limit=50")

    localStorage.setItem(LS_GUILD_ID, g.id)
    setGuild(gArr?.[0] ?? g)
    setMembers(mData ?? [])
    setChat(cData ?? [])
    setView("main")
    toast("🎉 Você entrou em " + g.name + "!")
  }

  const handleBossDuel = (deck: Deck) => {
    setShowDeckSel(false)
    if (onStartBossDuel) onStartBossDuel(deck.id)
    else toast("⚔️ Duelo contra o Chefão iniciado com: " + deck.name)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // SUPABASE NOT CONFIGURED
  if (supabaseOk === false && !createClient()) {
    return (
      <GS.Root>
        <GS.Cfg>
          <div style={{fontSize:52,marginBottom:16}}>⚙️</div>
          <h2 style={{fontWeight:900,fontSize:20,color:"#e8c96d",margin:"0 0 10px"}}>Supabase não conectado</h2>
          <p style={{color:"#6b7280",fontSize:13,marginBottom:20,lineHeight:1.7}}>
            Configure as variáveis de ambiente na Vercel.
          </p>
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"14px 16px",marginBottom:20,width:"100%"}}>
            {[["NEXT_PUBLIC_SUPABASE_URL",process.env.NEXT_PUBLIC_SUPABASE_URL],["NEXT_PUBLIC_SUPABASE_ANON_KEY",process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <span style={{color:"#4b5563",fontFamily:"monospace",fontSize:11}}>{k}</span>
                <span style={{fontWeight:800,fontSize:11,color:v?"#4ade80":"#f87171"}}>{v?"✅ OK":"❌ Faltando"}</span>
              </div>
            ))}
          </div>
          <button onClick={onBack} style={{padding:"11px 24px",borderRadius:10,background:"rgba(232,201,109,0.10)",border:"1px solid rgba(232,201,109,0.25)",color:"#e8c96d",fontWeight:800,fontSize:13,cursor:"pointer"}}>
            ← Voltar
          </button>
        </GS.Cfg>
        <GlobalStyle/>
      </GS.Root>
    )
  }

  // KICKED
  if (kicked) {
    return (
      <GS.Root>
        <GS.Cfg>
          <div style={{fontSize:64,marginBottom:16,filter:"drop-shadow(0 0 24px rgba(248,113,113,0.6))"}}>🚫</div>
          <h2 style={{fontWeight:900,fontSize:22,color:"#f87171",margin:"0 0 10px",letterSpacing:"0.02em"}}>Expulso da Guilda</h2>
          <p style={{color:"#6b7280",fontSize:14,marginBottom:28,lineHeight:1.7}}>O líder removeu você desta guilda.</p>
          <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%"}}>
            <button onClick={()=>{localStorage.removeItem(LS_KICKED);setKicked(false);setView("browse")}}
              style={{padding:"13px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#92701a,#e8c96d)",color:"#0c0a06",fontWeight:900,fontSize:14,cursor:"pointer"}}>
              🏰 Ver Guildas
            </button>
            <button onClick={onBack} style={{padding:"11px",borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#6b7280",fontWeight:800,fontSize:13,cursor:"pointer"}}>
              ← Voltar ao Menu
            </button>
          </div>
        </GS.Cfg>
        <GlobalStyle/>
      </GS.Root>
    )
  }

  // LOADING
  if (loading) {
    return (
      <GS.Root>
        <GS.Cfg>
          <div style={{position:"relative",width:56,height:56,marginBottom:18}}>
            <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(232,201,109,0.15)",borderTop:"2px solid #e8c96d",animation:"spin 1s linear infinite"}}/>
            <div style={{position:"absolute",inset:8,borderRadius:"50%",border:"2px solid rgba(139,92,246,0.10)",borderBottom:"2px solid #8b5cf6",animation:"spin 1.6s linear infinite reverse"}}/>
          </div>
          <p style={{color:"#6b7280",fontSize:13,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase"}}>Carregando guilda</p>
        </GS.Cfg>
        <GlobalStyle/>
      </GS.Root>
    )
  }

  // ═══ MAIN ═══
  const tabList = guild
    ? ([
        {id:"main",    icon:"⌂",  label:"Início"},
        {id:"members", icon:"⚉",  label:"Membros"},
        {id:"chat",    icon:"⌨",  label:"Chat"},
        {id:"boss",    icon:"☠",  label:"Chefão"},
        {id:"war",     icon:"⚔",  label:"Guerra"},
        {id:"shop",    icon:"◈",  label:"Loja"},
        {id:"guilds",  icon:"⊕",  label:"Guildas"},
      ] as const)
    : []

  return (
    <GS.Root>
      <GlobalStyle/>

      {/* ── Ambient orbs ── */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",width:700,height:700,borderRadius:"50%",top:-200,left:-200,background:"radial-gradient(circle,rgba(232,201,109,0.04) 0%,transparent 70%)",filter:"blur(40px)"}}/>
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",bottom:-150,right:-100,background:"radial-gradient(circle,rgba(139,92,246,0.06) 0%,transparent 70%)",filter:"blur(40px)"}}/>
      </div>

      {/* ── Toast ── */}
      {feedback && (
        <div style={{position:"fixed",top:68,left:"50%",transform:"translateX(-50%)",zIndex:9999,
          background:"rgba(12,10,6,0.96)",border:"1px solid rgba(232,201,109,0.35)",
          borderRadius:10,padding:"9px 20px",color:"#e8c96d",fontWeight:700,fontSize:12,
          backdropFilter:"blur(16px)",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",whiteSpace:"nowrap",
          animation:"fadeSlide .25s ease"}}>
          {feedback}
        </div>
      )}

      {/* ── Modals ── */}
      {invitePayload && (
        <InviteLinkModal inviteGuild={invitePayload} currentGuildId={guild?.id??null}
          onAccept={handleAcceptInvite} onDecline={()=>setInvitePayload(null)}/>
      )}
      {showCreate && (
        <CreateGuildModal onClose={()=>setShowCreate(false)} onCreate={handleGuildCreated}
          coins={coins} setCoins={setCoins} playerId={myId} playerProfile={playerProfile}/>
      )}
      {showDeckSel && (
        <DeckSelectorModal decks={decks??[]} onSelect={handleBossDuel} onClose={()=>setShowDeckSel(false)}/>
      )}
      {leaveConfirm && (
        <GS.Overlay>
          <GS.Dialog>
            <div style={{fontSize:40,marginBottom:12,textAlign:"center"}}>🚪</div>
            <h3 style={{fontWeight:900,fontSize:17,margin:"0 0 8px",textAlign:"center",color:"#f1f0ee"}}>Sair da Guilda?</h3>
            <p style={{color:"#6b7280",fontSize:13,marginBottom:20,textAlign:"center",lineHeight:1.6}}>
              {myRole==="leader"&&members.length>1
                ?"A liderança será passada ao próximo membro."
                :"Você ficará sem guilda."}
            </p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setLeaveConfirm(false)} style={{flex:1,padding:"11px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#6b7280",fontWeight:700,fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleLeave} style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#7f1d1d,#dc2626)",color:"#fff",fontWeight:900,fontSize:13,cursor:"pointer"}}>Confirmar</button>
            </div>
          </GS.Dialog>
        </GS.Overlay>
      )}

      {/* ══════════ HEADER ══════════ */}
      <GS.Header>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,width:36,height:36,cursor:"pointer",color:"#9ca3af",fontSize:16,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>

        {guild ? (
          <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
            <GuildIcon icon={guild.icon} size={36} borderRadius={9}/>
            <div style={{minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontWeight:900,fontSize:16,color:"#f1f0ee",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{guild.name}</span>
                <span style={{fontSize:9,fontWeight:800,color:"#e8c96d",background:"rgba(232,201,109,0.12)",border:"1px solid rgba(232,201,109,0.20)",padding:"1px 6px",borderRadius:4}}>Lv.{guild.level}</span>
                <span style={{fontSize:9,fontWeight:700,color:guild.join_mode==="open"?"#4ade80":"#fb923c",background:guild.join_mode==="open"?"rgba(74,222,128,0.08)":"rgba(251,146,60,0.08)",padding:"1px 6px",borderRadius:4}}>
                  {guild.join_mode==="open"?"Livre":"Aprovação"}
                </span>
              </div>
              <div style={{fontSize:11,color:"#4b5563",marginTop:1}}>{members.length}/{guild.max_members} membros</div>
            </div>
          </div>
        ) : (
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:16,color:"#f1f0ee"}}>Guilda</div>
            <div style={{fontSize:11,color:"#4b5563"}}>Sem guilda</div>
          </div>
        )}

        {guild && (
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            <button onClick={handleDailyCheckin} disabled={checkedIn}
              style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${checkedIn?"rgba(255,255,255,0.06)":"rgba(74,222,128,0.30)"}`,
                background:checkedIn?"rgba(255,255,255,0.03)":"rgba(74,222,128,0.08)",
                color:checkedIn?"#374151":"#4ade80",fontSize:11,fontWeight:700,cursor:checkedIn?"not-allowed":"pointer",whiteSpace:"nowrap"}}>
              {checkedIn?"✓ Check-in":"🎁 Check-in"}
            </button>
            <button onClick={()=>setView("settings")}
              style={{width:34,height:34,borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",color:"#6b7280",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>⚙</button>
          </div>
        )}
      </GS.Header>

      {/* ══════════ TABS ══════════ */}
      {guild && (
        <GS.Tabs>
          {tabList.map(t=>(
            <button key={t.id} onClick={()=>{ setView(t.id as any); if(t.id==="chat") setUnreadChat(0); }}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 2px",
                background:view===t.id?"rgba(232,201,109,0.08)":"transparent",
                border:"none",borderBottom:`2px solid ${view===t.id?"#e8c96d":"transparent"}`,
                cursor:"pointer",color:view===t.id?"#e8c96d":"#4b5563",transition:"all .18s",minWidth:0}}>
              <span style={{fontSize:15}}>{t.icon}</span>
              <span style={{display:"flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,letterSpacing:"0.04em"}}>
                {t.label}
                {t.id==="chat" && unreadChat > 0 && (
                  <span style={{
                    display:"inline-flex",alignItems:"center",justifyContent:"center",
                    minWidth:16,height:16,borderRadius:99,
                    background:"#3b82f6",color:"#fff",
                    fontSize:9,fontWeight:900,padding:"0 4px",lineHeight:1,
                    boxShadow:"0 0 8px rgba(59,130,246,0.7)",
                    animation:"badgePop .25s cubic-bezier(0.34,1.56,0.64,1)",
                  }}>{unreadChat}</span>
                )}
              </span>
            </button>
          ))}
        </GS.Tabs>
      )}

      {/* ══════════ PAGE CONTENT (fills remaining height, no scroll) ══════════ */}
      <GS.Page>

        {/* ═══ BROWSE ═══ */}
        {(!guild||view==="browse") && (
          <GS.Fill style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",gap:20}}>
            {/* Logo / hero */}
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:56,filter:"drop-shadow(0 0 30px rgba(232,201,109,0.4))",marginBottom:10}}>🏰</div>
              <h2 style={{fontWeight:900,fontSize:26,margin:"0 0 6px",background:"linear-gradient(135deg,#f1f0ee,#e8c96d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                Junte-se a uma Guilda
              </h2>
              <p style={{color:"#4b5563",fontSize:13,margin:0}}>Lute ao lado de aliados. Conquiste juntos.</p>
            </div>

            {/* Action buttons */}
            <div style={{display:"flex",gap:12,width:"100%",maxWidth:480}}>
              <button onClick={()=>setShowCreate(true)}
                style={{flex:1,padding:"16px 12px",borderRadius:14,border:"none",
                  background:"linear-gradient(135deg,#7a5c0f,#e8c96d,#7a5c0f)",
                  backgroundSize:"200% 100%",color:"#0c0a06",fontWeight:900,fontSize:14,
                  cursor:"pointer",boxShadow:"0 4px 20px rgba(232,201,109,0.30)",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:22}}>⚔</span>
                <span>Criar Guilda</span>
                <span style={{fontSize:11,opacity:0.7}}>300 🪙</span>
              </button>
              <button onClick={()=>setView("guilds")}
                style={{flex:1,padding:"16px 12px",borderRadius:14,
                  background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.10)",
                  color:"#9ca3af",fontWeight:800,fontSize:14,cursor:"pointer",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <span style={{fontSize:22}}>🌐</span>
                <span>Ver Guildas</span>
                <span style={{fontSize:11,color:"#4b5563"}}>{allGuilds.length} ativa{allGuilds.length!==1?"s":""}</span>
              </button>
            </div>

            {/* Steps */}
            <div style={{width:"100%",maxWidth:480}}>
              <div style={{fontSize:10,fontWeight:700,color:"#374151",letterSpacing:"0.10em",textTransform:"uppercase",marginBottom:10}}>Como entrar em uma guilda</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                {[["🔗","Peça o link ao líder"],["🌐","Abra — o jogo pergunta"],["🎉","Aceite e jogue junto!"]].map(([ic,tx],i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 10px",textAlign:"center"}}>
                    <div style={{fontSize:24,marginBottom:8}}>{ic}</div>
                    <div style={{fontSize:10,fontWeight:600,color:"#4b5563",letterSpacing:"0.02em",lineHeight:1.5}}>0{i+1} · {tx}</div>
                  </div>
                ))}
              </div>
            </div>
          </GS.Fill>
        )}

        {/* ═══ ALL GUILDS ═══ */}
        {view==="guilds" && (
          <GS.Fill style={{display:"flex",flexDirection:"column",padding:"16px 20px",gap:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:900,fontSize:14,color:"#f1f0ee"}}>🌐 Todas as Guildas</span>
              <span style={{fontSize:11,color:"#22c55e",fontWeight:600}}>● Tempo real</span>
            </div>
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
              {allGuilds.length===0?(
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#374151"}}>
                  <div style={{fontSize:40,marginBottom:10}}>🏰</div>
                  <p style={{fontSize:14,fontWeight:700,color:"#4b5563",margin:"0 0 4px"}}>Nenhuma guilda criada</p>
                  <p style={{fontSize:12,color:"#374151",margin:0}}>Seja o primeiro!</p>
                </div>
              ):allGuilds.map(g=>{
                const isMe=guild?.id===g.id
                const canJoin=!guild&&!isMe
                return(
                  <div key={g.id} style={{display:"flex",alignItems:"center",gap:12,
                    background:isMe?"rgba(232,201,109,0.06)":"rgba(255,255,255,0.03)",
                    border:`1px solid ${isMe?"rgba(232,201,109,0.20)":"rgba(255,255,255,0.06)"}`,
                    borderRadius:12,padding:"11px 14px"}}>
                    <GuildIcon icon={g.icon} size={44} borderRadius={11}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{fontWeight:800,fontSize:13,color:"#f1f0ee",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.name}</span>
                        {isMe&&<span style={{fontSize:8,fontWeight:800,color:"#e8c96d",background:"rgba(232,201,109,0.12)",padding:"1px 5px",borderRadius:4,flexShrink:0}}>Sua</span>}
                        <span style={{fontSize:8,color:"#374151",flexShrink:0}}>Lv.{g.level}</span>
                      </div>
                      <div style={{fontSize:11,color:"#4b5563",fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.slogan}</div>
                      <div style={{display:"flex",gap:10,marginTop:2,fontSize:10,color:"#374151"}}>
                        <span>👥 {g.max_members} vagas</span>
                        <span>{g.join_mode==="open"?"🔓 Livre":"🔒 Aprovação"}</span>
                      </div>
                    </div>
                    {isMe&&<button onClick={()=>setView("main")} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#7a5c0f,#e8c96d)",color:"#0c0a06",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0}}>Ver →</button>}
                    {canJoin&&<button onClick={()=>handleJoinPublicGuild(g)} style={{padding:"7px 12px",borderRadius:8,border:"none",
                      background:g.join_mode==="open"?"linear-gradient(135deg,#064e3b,#059669)":"linear-gradient(135deg,#7c2d12,#ea580c)",
                      color:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",flexShrink:0}}>
                      {g.join_mode==="open"?"Entrar":"Solicitar"}
                    </button>}
                  </div>
                )
              })}
            </div>
            {!guild&&(
              <button onClick={()=>setShowCreate(true)}
                style={{padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#7a5c0f,#e8c96d)",color:"#0c0a06",fontWeight:900,fontSize:13,cursor:"pointer",boxShadow:"0 4px 16px rgba(232,201,109,0.25)"}}>
                ⚔ Criar Guilda (300 🪙)
              </button>
            )}
          </GS.Fill>
        )}

        {/* ═══ MAIN / INÍCIO ═══ */}
        {guild&&view==="main"&&(
          <GS.Fill style={{display:"grid",gridTemplateRows:"auto auto 1fr auto",gap:10,padding:"14px 18px"}}>

            {/* Guild card — compact */}
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(232,201,109,0.14)",borderRadius:14,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <GuildIcon icon={guild.icon} size={52} borderRadius={13}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:900,fontSize:18,color:"#f1f0ee",lineHeight:1}}>{guild.name}</div>
                  <div style={{fontSize:12,color:"#4b5563",fontStyle:"italic",marginTop:3}}>{guild.slogan}</div>
                </div>
                <button onClick={handleCopyInvite}
                  style={{padding:"7px 12px",borderRadius:9,background:copied?"rgba(74,222,128,0.12)":"rgba(232,201,109,0.08)",
                    border:`1px solid ${copied?"rgba(74,222,128,0.30)":"rgba(232,201,109,0.22)"}`,
                    color:copied?"#4ade80":"#e8c96d",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                  {copied?"✓ Copiado":"🔗 Convidar"}
                </button>
              </div>
              {/* XP */}
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#4b5563",marginBottom:4}}>
                  <span style={{textTransform:"uppercase",letterSpacing:"0.08em"}}>XP da Guilda</span>
                  <span style={{color:"#e8c96d",fontWeight:700}}>{guild.xp} / {guild.xp_to_next}</span>
                </div>
                <div style={{height:5,borderRadius:99,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:99,width:`${Math.min(100,(guild.xp/guild.xp_to_next)*100)}%`,background:"linear-gradient(90deg,#92701a,#e8c96d)",boxShadow:"0 0 8px rgba(232,201,109,0.5)",transition:"width .6s ease"}}/>
                </div>
              </div>
              {/* Stats row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[["👥",`${members.length}/${guild.max_members}`,"Membros"],["🪙",guild.guild_coins,"Moedas"],["✦",guild.level,"Nível"]].map(([ic,v,lb])=>(
                  <div key={lb as string} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,padding:"8px",textAlign:"center"}}>
                    <div style={{fontSize:14}}>{ic}</div>
                    <div style={{fontWeight:900,fontSize:15,color:"#f1f0ee"}}>{v}</div>
                    <div style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.06em"}}>{lb}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activities — 2x2 grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[
                {icon:"☠",name:"Chefão",desc:"Duelo vs. Boss",color:"#f87171",bg:"rgba(127,29,29,0.25)",border:"rgba(220,38,38,0.18)",tab:"boss"},
                {icon:"⚔",name:"Guerra",desc:"PVP em equipe",color:"#60a5fa",bg:"rgba(29,78,216,0.15)",border:"rgba(59,130,246,0.18)",tab:"war"},
                {icon:"🎯",name:"Missão",desc:"Meta coletiva",color:"#4ade80",bg:"rgba(5,78,50,0.15)",border:"rgba(52,211,153,0.18)",tab:null},
                {icon:"◈",name:"Loja",desc:"Trocar moedas",color:"#e8c96d",bg:"rgba(92,64,3,0.20)",border:"rgba(232,201,109,0.18)",tab:"shop"},
              ].map(a=>(
                <button key={a.name}
                  onClick={()=>a.tab?setView(a.tab as any):toast("🎯 Meta: vençam 50 duelos juntos!")}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",
                    background:a.bg,border:`1px solid ${a.border}`,borderRadius:12,
                    cursor:"pointer",textAlign:"left",transition:"all .15s"}}>
                  <span style={{fontSize:22}}>{a.icon}</span>
                  <div>
                    <div style={{fontWeight:800,fontSize:13,color:a.color}}>{a.name}</div>
                    <div style={{fontSize:10,color:"#4b5563",marginTop:1}}>{a.desc}</div>
                  </div>
                  <span style={{marginLeft:"auto",color:"rgba(255,255,255,0.12)",fontSize:14}}>›</span>
                </button>
              ))}
            </div>

            {/* Description */}
            {guild.description&&(
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 14px",color:"#4b5563",fontSize:12,lineHeight:1.6}}>
                {guild.description}
              </div>
            )}
          </GS.Fill>
        )}

        {/* ═══ MEMBERS ═══ */}
        {guild&&view==="members"&&(
          <GS.Fill style={{display:"flex",flexDirection:"column",padding:"14px 18px",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:800,fontSize:13,color:"#f1f0ee"}}>⚉ {members.length}/{guild.max_members} Membros</span>
              <span style={{fontSize:11,color:"#22c55e",fontWeight:600}}>● Tempo real</span>
            </div>
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:7}}>
              {[...members].sort((a,b)=>{const o:Record<GuildRole,number>={leader:0,officer:1,member:2};return o[a.role]-o[b.role]||b.weekly_contrib-a.weekly_contrib}).map(m=>{
                const rl=roleLabel(m.role)
                const isOnline=Date.now()-m.last_online<5*60000
                const canManage=(myRole==="leader"||myRole==="officer")&&m.role==="member"&&m.id!==myId
                return(
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,
                    background:m.id===myId?"rgba(232,201,109,0.05)":"rgba(255,255,255,0.03)",
                    border:`1px solid ${m.id===myId?"rgba(232,201,109,0.14)":"rgba(255,255,255,0.05)"}`,
                    borderRadius:11,padding:"10px 12px"}}>
                    <div style={{position:"relative",flexShrink:0}}>
                      <div style={{width:36,height:36,borderRadius:9,overflow:"hidden",background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {m.avatar_url?<img src={m.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<span style={{fontSize:16}}>👤</span>}
                      </div>
                      <div style={{position:"absolute",bottom:-1,right:-1,width:9,height:9,borderRadius:"50%",background:isOnline?"#22c55e":"#374151",border:"2px solid #0a0806"}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontWeight:800,fontSize:13,color:"#f1f0ee",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
                        <span style={{fontSize:8,fontWeight:800,color:rl.color,background:rl.bg,padding:"1px 5px",borderRadius:4,textTransform:"uppercase",flexShrink:0}}>{rl.text}</span>
                        {m.id===myId&&<span style={{fontSize:8,color:"#e8c96d",flexShrink:0}}>Você</span>}
                      </div>
                      <div style={{fontSize:10,color:"#4b5563",marginTop:2}}>
                        Lv.{m.level} · {isOnline?"Online":timeAgo(m.last_online)} · ⚡{m.weekly_contrib}
                      </div>
                    </div>
                    {canManage&&(
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        {myRole==="leader"&&<button onClick={()=>handlePromote(m.id)} style={{padding:"4px 8px",borderRadius:6,background:"rgba(96,165,250,0.10)",border:"1px solid rgba(96,165,250,0.22)",color:"#60a5fa",fontSize:9,fontWeight:700,cursor:"pointer"}}>↑ Oficial</button>}
                        <button onClick={()=>handleKick(m.id)} style={{padding:"4px 8px",borderRadius:6,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.18)",color:"#f87171",fontSize:9,fontWeight:700,cursor:"pointer"}}>Expulsar</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </GS.Fill>
        )}

        {/* ═══ CHAT ═══ */}
        {guild&&view==="chat"&&(
          <GS.Fill style={{display:"flex",flexDirection:"column",padding:"14px 18px",gap:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:800,fontSize:13,color:"#f1f0ee"}}>⌨ Chat da Guilda</span>
              <span style={{fontSize:11,color:"#22c55e",fontWeight:600}}>● Tempo real</span>
            </div>

            {/* Messages — flex-grow */}
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,minHeight:0}}>
              {chat.length===0&&(
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#374151"}}>
                  <div style={{fontSize:32,marginBottom:8}}>💬</div>
                  <p style={{fontSize:13,color:"#4b5563",margin:0}}>Nenhuma mensagem. Seja o primeiro!</p>
                </div>
              )}
              {chat.map(msg=>{
                const isMe=msg.author_id===myId
                const isSys=msg.author_id==="system"
                const isEmote=msg.text.startsWith("__emote__")
                const rl=isSys?null:roleLabel(msg.author_role)
                return(
                  <div key={msg.id} style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":isSys?"center":"flex-start"}}>
                    {!isMe&&!isSys&&(
                      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,paddingLeft:4}}>
                        <span style={{fontWeight:700,fontSize:10,color:"#6b7280"}}>{msg.author_name}</span>
                        {rl&&<span style={{fontSize:7,fontWeight:800,color:rl.color,background:rl.bg,padding:"1px 4px",borderRadius:3,textTransform:"uppercase"}}>{rl.text}</span>}
                      </div>
                    )}
                    {isEmote?(()=>{const p=msg.text.split("__").filter(Boolean);return(
                      <div style={{textAlign:isMe?"right":"left"}}>
                        <img src={p[2]??""} alt={p[3]??""} style={{width:52,height:52,objectFit:"contain",filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.4))",animation:"emotePop .25s ease"}}
                          onError={e=>{(e.target as HTMLImageElement).style.opacity="0.3"}}/>
                        <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",marginTop:1}}>{timeAgo(msg.timestamp)}</div>
                      </div>
                    )})():(
                      <div style={{maxWidth:"72%",padding:"8px 12px",
                        borderRadius:isMe?"13px 13px 3px 13px":"13px 13px 13px 3px",
                        background:isSys?"rgba(232,201,109,0.08)":isMe?"linear-gradient(135deg,#7a5c0f,#c9a84c)":"rgba(255,255,255,0.06)",
                        border:isSys?"1px solid rgba(232,201,109,0.18)":"none"}}>
                        <p style={{margin:0,fontSize:12,color:isSys?"#e8c96d":"#f1f0ee",fontStyle:isSys?"italic":undefined,lineHeight:1.5}}>{msg.text}</p>
                        <p style={{margin:"3px 0 0",fontSize:8,color:"rgba(255,255,255,0.25)",textAlign:"right"}}>{timeAgo(msg.timestamp)}</p>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={chatEndRef}/>
            </div>

            {/* Error */}
            {chatError&&<div style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.22)",borderRadius:8,padding:"7px 12px",fontSize:11,color:"#fca5a5",fontWeight:600,display:"flex",gap:6,alignItems:"center"}}>🚫 {chatError}</div>}

            {/* Emote picker */}
            {showEmotes&&(
              <div style={{background:"rgba(10,8,6,0.97)",border:"1px solid rgba(232,201,109,0.14)",borderRadius:14,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:10,fontWeight:700,color:"#e8c96d",textTransform:"uppercase",letterSpacing:"0.10em"}}>Emotes</span>
                  <button onClick={()=>setShowEmotes(false)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,cursor:"pointer",color:"#6b7280",fontSize:12,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
                  {GAME_EMOTES.map(e=>(
                    <button key={e.id} onClick={()=>handleSendEmote(e)} title={e.name}
                      style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"10px 6px",cursor:"pointer",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                      <img src={e.image} alt={e.name} style={{width:56,height:56,objectFit:"contain"}}
                        onError={ev=>{(ev.target as HTMLImageElement).style.opacity="0.3"}}/>
                      <span style={{fontSize:8,color:"#4b5563",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>{e.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input row */}
            <div style={{display:"flex",gap:7}}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleSendChat()}
                placeholder="Mensagem para a guilda..." maxLength={200}
                style={{flex:1,background:"rgba(255,255,255,0.04)",border:`1px solid ${chatError?"rgba(220,38,38,0.45)":"rgba(255,255,255,0.09)"}`,
                  borderRadius:10,padding:"10px 14px",color:"#f1f0ee",fontSize:13,outline:"none",transition:"border-color .2s"}}/>
              <button onClick={()=>setShowEmotes(v=>!v)}
                style={{width:40,height:40,borderRadius:10,background:showEmotes?"rgba(232,201,109,0.12)":"rgba(255,255,255,0.04)",
                  border:`1px solid ${showEmotes?"rgba(232,201,109,0.28)":"rgba(255,255,255,0.08)"}`,
                  cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>😊</button>
              <button onClick={handleSendChat}
                style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#7a5c0f,#e8c96d)",
                  border:"none",cursor:"pointer",color:"#0c0a06",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                  boxShadow:"0 2px 10px rgba(232,201,109,0.25)"}}>➤</button>
            </div>
          </GS.Fill>
        )}

        {/* ═══ BOSS ═══ */}
        {guild&&view==="boss"&&(
          <GS.Fill style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,padding:"14px 18px"}}>
            {/* Left: boss info */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{background:"linear-gradient(160deg,rgba(100,5,5,0.35),rgba(40,0,0,0.50))",border:"1px solid rgba(220,38,38,0.20)",borderRadius:14,padding:"16px",textAlign:"center",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
                <div style={{fontSize:56,filter:"drop-shadow(0 0 24px rgba(220,38,38,0.7))",animation:"bossFloat 3s ease-in-out infinite"}}>☠</div>
                <h2 style={{fontWeight:900,fontSize:20,margin:0,color:"#f87171",textShadow:"0 0 20px rgba(248,113,113,0.5)"}}>Chefão da Guilda</h2>
                <p style={{fontSize:12,color:"#6b7280",margin:0,lineHeight:1.5}}>Enfrente o Chefão em um <strong style={{color:"#f1f0ee"}}>duelo difícil de verdade</strong>. Escolha seu deck!</p>
              </div>
              <div style={{background:"rgba(220,38,38,0.07)",border:"1px solid rgba(220,38,38,0.18)",borderRadius:12,padding:"12px 14px"}}>
                <div style={{fontWeight:800,fontSize:12,color:"#f87171",marginBottom:4}}>⚠ Mefisto das Sombras</div>
                <div style={{fontSize:11,color:"#6b7280"}}>Extremo · 4.000 HP · Habilidades especiais ativas</div>
              </div>
              <button onClick={()=>setShowDeckSel(true)}
                style={{padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#7f1d1d,#dc2626,#7f1d1d)",backgroundSize:"200% 100%",
                  color:"#fff",fontWeight:900,fontSize:14,cursor:"pointer",
                  boxShadow:"0 4px 20px rgba(220,38,38,0.45)",animation:"bossGlow 2s ease-in-out infinite"}}>
                ⚔ Escolher Deck e Batalhar
              </button>
            </div>

            {/* Right: rewards + ranking */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:10,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em"}}>Recompensas</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {label:"Derrota",  reward:"25 🪙",          color:"#6b7280",icon:"🛡"},
                  {label:"Vitória",  reward:"100 🪙 + Pack",  color:"#e8c96d",icon:"⚡"},
                  {label:"Perfeita", reward:"200 🪙 + SR",    color:"#60a5fa",icon:"💫"},
                  {label:"Lendário", reward:"500 🪙 + LR",    color:"#c084fc",icon:"👑"},
                ].map(r=>(
                  <div key={r.label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px",textAlign:"center"}}>
                    <div style={{fontSize:18,marginBottom:4}}>{r.icon}</div>
                    <div style={{fontSize:10,color:"#4b5563",marginBottom:2}}>{r.label}</div>
                    <div style={{fontWeight:900,fontSize:11,color:r.color}}>{r.reward}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,padding:"12px",flex:1}}>
                <div style={{fontSize:10,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>🏆 Ranking Semanal</div>
                {[...members].slice(0,4).map((m,i)=>(
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<3?"1px solid rgba(255,255,255,0.04)":"none"}}>
                    <span style={{fontSize:14,width:20,textAlign:"center"}}>{["🥇","🥈","🥉","4️⃣"][i]}</span>
                    <span style={{flex:1,fontSize:12,color:"#f1f0ee",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
                    <span style={{fontSize:11,color:"#e8c96d",fontWeight:800}}>{m.weekly_contrib*50+500} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </GS.Fill>
        )}

        {/* ═══ WAR ═══ */}
        {guild&&view==="war"&&(
          <GS.Fill style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,padding:"14px 18px"}}>
            {/* Left: timer */}
            <div style={{background:"linear-gradient(160deg,rgba(15,40,120,0.30),rgba(5,15,60,0.50))",border:"1px solid rgba(59,130,246,0.18)",borderRadius:14,padding:"20px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
              <h2 style={{fontWeight:900,fontSize:18,color:"#60a5fa",margin:0,textShadow:"0 0 20px rgba(96,165,250,0.5)"}}>⚔ Guerra de Guildas</h2>
              <p style={{color:"#4b5563",fontSize:12,margin:0}}>Próxima guerra começa em</p>
              <div style={{fontWeight:900,fontSize:40,color:"#60a5fa",textShadow:"0 0 24px rgba(96,165,250,0.5)",letterSpacing:"0.06em",fontVariantNumeric:"tabular-nums"}}>18:32:07</div>
              <p style={{color:"#374151",fontSize:11,margin:0,textAlign:"center",lineHeight:1.5}}>Enfrente outra guilda em duelos PVP.<br/>Ganha moedas ao vencer!</p>
              <div style={{display:"flex",gap:8,width:"100%"}}>
                <button style={{flex:1,padding:"10px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#6b7280",fontWeight:700,fontSize:12,cursor:"pointer"}}>🛡 Defender</button>
                <button style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#1e40af,#3b82f6)",color:"#fff",fontWeight:900,fontSize:12,cursor:"pointer",boxShadow:"0 3px 14px rgba(59,130,246,0.40)"}}>⚔ Atacar</button>
              </div>
            </div>

            {/* Right: history */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:10,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em"}}>Histórico</div>
              {[
                {oponente:"Dragões do Norte",resultado:"Vitória",pontos:"+120🪙"},
                {oponente:"Clã da Tempestade",resultado:"Derrota",pontos:"+30🪙"},
              ].map((w,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:11,padding:"12px 14px"}}>
                  <span style={{fontSize:20}}>{w.resultado==="Vitória"?"🏆":"💔"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#f1f0ee",fontWeight:600}}>vs {w.oponente}</div>
                    <div style={{fontSize:10,color:w.resultado==="Vitória"?"#22c55e":"#f87171",marginTop:2}}>{w.resultado}</div>
                  </div>
                  <span style={{fontSize:12,color:"#e8c96d",fontWeight:800}}>{w.pontos}</span>
                </div>
              ))}
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,padding:"14px",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",gap:6}}>
                <div style={{fontSize:28}}>🏟</div>
                <div style={{fontWeight:700,fontSize:12,color:"#4b5563"}}>Sua guilda está pronta</div>
                <div style={{fontSize:11,color:"#374151"}}>Aguardando oponente...</div>
              </div>
            </div>
          </GS.Fill>
        )}

        {/* ═══ SHOP ═══ */}
        {guild&&view==="shop"&&(
          <GS.Fill style={{display:"flex",flexDirection:"column",padding:"14px 18px",gap:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:800,fontSize:13,color:"#f1f0ee"}}>◈ Loja da Guilda</span>
              <span style={{fontSize:13,fontWeight:900,color:"#e8c96d"}}>🪙 {guild.guild_coins}</span>
            </div>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:10}}>
              {[
                {name:"Pack Comum",    cost:50,  icon:"📦",desc:"1 pack comum",        hot:false},
                {name:"100 Coins",     cost:80,  icon:"🪙",desc:"Moedas do jogo",      hot:false},
                {name:"Pack SR",       cost:200, icon:"💎",desc:"Garante SR ou acima", hot:true},
                {name:"Título Exclusivo",cost:500,icon:"🏷",desc:"Título de guilda",   hot:true},
              ].map(item=>{
                const canBuy=(guild?.guild_coins??0)>=item.cost
                return(
                  <div key={item.name} style={{position:"relative",background:item.hot?"rgba(232,201,109,0.04)":"rgba(255,255,255,0.03)",
                    border:`1px solid ${item.hot?"rgba(232,201,109,0.18)":"rgba(255,255,255,0.06)"}`,
                    borderRadius:13,padding:"14px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",gap:6,textAlign:"center"}}>
                    {item.hot&&<div style={{position:"absolute",top:8,right:8,background:"linear-gradient(135deg,#7a5c0f,#e8c96d)",color:"#0c0a06",fontSize:8,fontWeight:900,padding:"2px 7px",borderRadius:5}}>⭐ Destaque</div>}
                    <div style={{fontSize:32}}>{item.icon}</div>
                    <div>
                      <div style={{fontWeight:800,fontSize:13,color:"#f1f0ee",marginBottom:3}}>{item.name}</div>
                      <div style={{fontSize:10,color:"#4b5563"}}>{item.desc}</div>
                    </div>
                    <button onClick={()=>canBuy?toast("✅ "+item.name+" comprado!"):toast("❌ Moedas insuficientes!")}
                      style={{width:"100%",padding:"8px",borderRadius:9,border:"none",
                        background:canBuy?"linear-gradient(135deg,#7a5c0f,#c9a84c)":"rgba(255,255,255,0.05)",
                        color:canBuy?"#0c0a06":"#374151",fontWeight:800,fontSize:12,cursor:canBuy?"pointer":"not-allowed"}}>
                      🪙 {item.cost}
                    </button>
                  </div>
                )
              })}
            </div>
          </GS.Fill>
        )}

        {/* ═══ SETTINGS ═══ */}
        {guild&&view==="settings"&&(
          <GS.Fill style={{display:"flex",flexDirection:"column",padding:"14px 18px",gap:14}}>
            <span style={{fontWeight:800,fontSize:13,color:"#f1f0ee"}}>⚙ Configurações</span>
            {myRole==="leader"&&(
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>👑 Líder</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
                  <span style={{color:"#9ca3af",fontSize:13}}>Modo de entrada</span>
                  <button onClick={async()=>{
                    const nm:GuildJoinMode=guild.join_mode==="open"?"approval":"open"
                    setGuild(g=>g?{...g,join_mode:nm}:g)
                    await sbUpdate("guilds","id=eq."+guild.id,{join_mode:nm})
                  }} style={{padding:"6px 12px",borderRadius:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",color:"#f1f0ee",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    {guild.join_mode==="open"?"🔓 Livre":"🔒 Aprovação"}
                  </button>
                </div>
              </div>
            )}
            <button onClick={()=>setLeaveConfirm(true)}
              style={{padding:"13px",borderRadius:12,border:"1px solid rgba(239,68,68,0.25)",background:"rgba(239,68,68,0.06)",color:"#f87171",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              🚪 Sair da Guilda
            </button>
          </GS.Fill>
        )}

      </GS.Page>
    </GS.Root>
  )
}

// ─── Styled shells ─────────────────────────────────────────────────────────────
const GS = {
  Root: ({children,style}:{children:React.ReactNode,style?:React.CSSProperties})=>(
    <div style={{minHeight:"100vh",height:"100vh",display:"flex",flexDirection:"column",background:"#0a0806",color:"#f1f0ee",fontFamily:"'Segoe UI',system-ui,sans-serif",position:"relative",overflow:"hidden",...style}}>
      {children}
    </div>
  ),
  Header: ({children}:{children:React.ReactNode})=>(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"rgba(10,8,6,0.92)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.06)",zIndex:50,flexShrink:0}}>
      {children}
    </div>
  ),
  Tabs: ({children}:{children:React.ReactNode})=>(
    <div style={{display:"flex",background:"rgba(255,255,255,0.015)",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0,overflowX:"auto"}}>
      {children}
    </div>
  ),
  Page: ({children}:{children:React.ReactNode})=>(
    <div style={{flex:1,overflow:"hidden",position:"relative",zIndex:1}}>
      {children}
    </div>
  ),
  Fill: ({children,style}:{children:React.ReactNode,style?:React.CSSProperties})=>(
    <div style={{position:"absolute",inset:0,...style}}>
      {children}
    </div>
  ),
  Overlay: ({children}:{children:React.ReactNode})=>(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.80)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      {children}
    </div>
  ),
  Dialog: ({children}:{children:React.ReactNode})=>(
    <div style={{background:"linear-gradient(160deg,#100c08,#0e0b18)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"24px 22px",maxWidth:340,width:"100%",fontFamily:"'Segoe UI',sans-serif",color:"#f1f0ee"}}>
      {children}
    </div>
  ),
  Cfg: ({children}:{children:React.ReactNode})=>(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,maxWidth:460,margin:"0 auto",width:"100%"}}>
      {children}
    </div>
  ),
}

function GlobalStyle(){return(
  <style>{`
    *{box-sizing:border-box;margin:0;padding:0;}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeSlide{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    @keyframes bossFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes bossGlow{0%,100%{box-shadow:0 4px 20px rgba(220,38,38,0.45)}50%{box-shadow:0 6px 32px rgba(220,38,38,0.75),0 0 50px rgba(220,38,38,0.20)}}
    @keyframes emotePop{0%{transform:scale(0.4);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
    @keyframes badgePop{0%{transform:scale(0);opacity:0}70%{transform:scale(1.3)}100%{transform:scale(1);opacity:1}}
    input,textarea,button{font-family:inherit;}
    ::-webkit-scrollbar{width:3px;height:3px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:rgba(232,201,109,0.20);border-radius:2px}
    @media(max-width:600px){
      .guild-boss-grid{grid-template-columns:1fr!important}
      .guild-war-grid{grid-template-columns:1fr!important}
    }
  `}</style>
)}
