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

  // ── SUPABASE NOT CONFIGURED ───────────────────────────────────────────────
  if (supabaseOk === false && !createClient()) {
    return (
      <div className="guild-screen">
        <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
          background:"radial-gradient(ellipse at 30% 50%,#1a0533 0%,#050010 60%)",
          fontFamily:"'Segoe UI',sans-serif", padding:24 }}>
          <div style={{ maxWidth:480, width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:64, marginBottom:16, filter:"drop-shadow(0 0 30px #f8717150)" }}>⚙️</div>
            <h2 style={{ fontWeight:900, fontSize:22, color:"#f87171", margin:"0 0 12px",
              letterSpacing:"0.02em" }}>Supabase não conectado</h2>
            <p style={{ color:"#64748b", fontSize:13, marginBottom:24, lineHeight:1.8 }}>
              Configure as variáveis de ambiente na Vercel para ativar as funcionalidades online.
            </p>
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:16, padding:"18px 20px", marginBottom:16, textAlign:"left" }}>
              {[
                ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
                ["NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
              ].map(([k, v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0",
                  borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color:"#64748b", fontFamily:"monospace", fontSize:11 }}>{k}</span>
                  <span style={{ fontWeight:800, fontSize:11, color: v ? "#22c55e" : "#f87171" }}>
                    {v ? "✅ OK" : "❌ Faltando"}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={onBack} style={{ width:"100%", padding:"13px", borderRadius:12,
              background:"rgba(139,92,246,0.15)", border:"1px solid rgba(139,92,246,0.35)",
              color:"#c4b5fd", fontWeight:800, fontSize:13, cursor:"pointer" }}>
              ← Voltar ao Menu
            </button>
          </div>
        </div>
        <GuildStyles/>
      </div>
    )
  }

  // ── KICKED ────────────────────────────────────────────────────────────────
  if (kicked) {
    return (
      <div className="guild-screen">
        <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
          background:"radial-gradient(ellipse at 50% 30%,#2d0a0a 0%,#050010 70%)",
          fontFamily:"'Segoe UI',sans-serif", padding:24 }}>
          <div style={{ textAlign:"center", maxWidth:400 }}>
            <div style={{ fontSize:80, marginBottom:20, animation:"kickedPulse 2s ease-in-out infinite" }}>🚫</div>
            <h2 style={{ fontWeight:900, fontSize:26, color:"#f87171", margin:"0 0 12px",
              letterSpacing:"0.02em", textShadow:"0 0 30px rgba(248,113,113,0.5)" }}>
              Você foi expulso
            </h2>
            <p style={{ color:"#64748b", fontSize:14, marginBottom:32, lineHeight:1.8 }}>
              O líder removeu você desta guilda.<br/>
              Entre em outra guilda ou crie a sua própria.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <button onClick={() => { localStorage.removeItem(LS_KICKED); setKicked(false); setView("browse") }}
                style={{ padding:"15px", borderRadius:14, border:"none",
                  background:"linear-gradient(135deg,#6d28d9,#8b5cf6,#6d28d9)",
                  backgroundSize:"200% 100%", color:"#fff", fontWeight:900, fontSize:15,
                  cursor:"pointer", boxShadow:"0 4px 24px rgba(139,92,246,0.50)",
                  letterSpacing:"0.04em" }}>
                🏰 Ver Guildas Disponíveis
              </button>
              <button onClick={onBack} style={{ padding:"13px", borderRadius:14,
                background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.10)",
                color:"#64748b", fontWeight:800, fontSize:13, cursor:"pointer" }}>
                ← Voltar ao Menu
              </button>
            </div>
          </div>
        </div>
        <GuildStyles/>
      </div>
    )
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="guild-screen">
        <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
          background:"radial-gradient(ellipse at 50% 40%,#0d0020 0%,#020008 100%)" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ position:"relative", width:64, height:64, margin:"0 auto 20px" }}>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%",
                border:"3px solid rgba(139,92,246,0.15)", borderTop:"3px solid #8b5cf6",
                animation:"spin 1s linear infinite" }}/>
              <div style={{ position:"absolute", inset:6, borderRadius:"50%",
                border:"2px solid rgba(251,191,36,0.10)", borderBottom:"2px solid #fbbf24",
                animation:"spin 1.5s linear infinite reverse" }}/>
              <div style={{ position:"absolute", inset:14, borderRadius:"50%",
                border:"2px solid rgba(6,182,212,0.10)", borderLeft:"2px solid #06b6d4",
                animation:"spin 0.8s linear infinite" }}/>
            </div>
            <p style={{ color:"#a78bfa", fontSize:13, fontWeight:700, letterSpacing:"0.15em",
              textTransform:"uppercase" }}>Carregando Guilda...</p>
          </div>
        </div>
        <GuildStyles/>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="guild-screen">
      <GuildStyles/>

      {/* ── Global ambient background ── */}
      <div className="guild-bg">
        <div className="guild-bg-orb orb1"/>
        <div className="guild-bg-orb orb2"/>
        <div className="guild-bg-orb orb3"/>
        <div className="guild-bg-grid"/>
      </div>

      {/* ── Toast ── */}
      {feedback && (
        <div className="guild-toast">
          <span>{feedback}</span>
        </div>
      )}

      {/* ── MODALS ── */}
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
        <div className="guild-modal-overlay">
          <div className="guild-modal-box" style={{ maxWidth:360 }}>
            <div style={{ fontSize:48, marginBottom:16, textAlign:"center" }}>🚪</div>
            <h3 style={{ fontWeight:900, fontSize:18, margin:"0 0 8px", textAlign:"center" }}>Sair da Guilda?</h3>
            <p style={{ color:"#64748b", fontSize:13, marginBottom:24, textAlign:"center", lineHeight:1.7 }}>
              {myRole === "leader" && members.length > 1
                ? "A liderança será passada automaticamente ao próximo membro."
                : "Você ficará sem guilda."}
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setLeaveConfirm(false)} className="guild-btn-secondary" style={{ flex:1 }}>Cancelar</button>
              <button onClick={handleLeave} className="guild-btn-danger" style={{ flex:1 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <header className="guild-header">
        <div className="guild-header-inner">
          <button onClick={onBack} className="guild-back-btn">
            <span style={{ fontSize:18 }}>←</span>
          </button>

          <div style={{ flex:1, display:"flex", alignItems:"center", gap:12 }}>
            {guild ? (
              <>
                <GuildIcon icon={guild.icon} size={40} borderRadius={10}/>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <h1 className="guild-header-name">{guild.name}</h1>
                    <span className="guild-level-badge">Lv.{guild.level}</span>
                    {guild.join_mode === "open"
                      ? <span className="guild-badge-open">Livre</span>
                      : <span className="guild-badge-lock">Aprovação</span>}
                  </div>
                  <p className="guild-header-sub">{members.length}/{guild.max_members} membros</p>
                </div>
              </>
            ) : (
              <div>
                <h1 className="guild-header-name">Guilda</h1>
                <p className="guild-header-sub">Sem guilda</p>
              </div>
            )}
          </div>

          {guild && (
            <div style={{ display:"flex", gap:8 }}>
              <button
                onClick={handleDailyCheckin}
                disabled={checkedIn}
                className={checkedIn ? "guild-btn-checked" : "guild-btn-checkin"}
              >
                {checkedIn ? "✓ Check-in" : "🎁 Check-in"}
              </button>
              <button onClick={() => setView("settings")} className="guild-btn-icon">⚙</button>
            </div>
          )}
        </div>

        {/* Nav tabs */}
        {guild && (
          <nav className="guild-nav">
            {([
              { id:"main",    icon:"🏠", label:"Início"  },
              { id:"members", icon:"👥", label:"Membros" },
              { id:"chat",    icon:"💬", label:"Chat"    },
              { id:"boss",    icon:"💀", label:"Chefão"  },
              { id:"war",     icon:"⚔️", label:"Guerra"  },
              { id:"shop",    icon:"🛒", label:"Loja"    },
              { id:"guilds",  icon:"🌐", label:"Guildas" },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={"guild-tab" + (view === tab.id ? " active" : "")}
              >
                <span className="guild-tab-icon">{tab.icon}</span>
                <span className="guild-tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          CONTENT
      ══════════════════════════════════════════════════════════════════════ */}
      <main className="guild-main">

        {/* ═══ BROWSE / NO GUILD ═══════════════════════════════════════════ */}
        {(!guild || view === "browse") && (
          <div className="guild-browse">
            {/* Hero section */}
            <div className="guild-browse-hero">
              <div className="guild-browse-runes"/>
              <div className="guild-browse-hero-content">
                <div style={{ fontSize:72, marginBottom:16, filter:"drop-shadow(0 0 40px rgba(139,92,246,0.8))",
                  animation:"heroFloat 4s ease-in-out infinite" }}>🏰</div>
                <h2 className="guild-browse-title">Junte-se a uma Guilda</h2>
                <p className="guild-browse-sub">Lute ao lado de aliados. Conquiste juntos.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="guild-browse-actions">
              <button onClick={() => setShowCreate(true)} className="guild-btn-create">
                <span style={{ fontSize:20 }}>⚔</span>
                <div>
                  <div style={{ fontWeight:900, fontSize:16 }}>Criar Guilda</div>
                  <div style={{ fontSize:12, opacity:0.75 }}>Custo: 300 🪙</div>
                </div>
              </button>
              <button onClick={() => setView("guilds")} className="guild-btn-browse">
                <span style={{ fontSize:20 }}>🌐</span>
                <div>
                  <div style={{ fontWeight:900, fontSize:16 }}>Ver Guildas</div>
                  <div style={{ fontSize:12, opacity:0.75 }}>{allGuilds.length} ativa{allGuilds.length !== 1 ? "s" : ""}</div>
                </div>
              </button>
            </div>

            {/* How to join steps */}
            <div className="guild-steps">
              <h3 className="guild-steps-title">Como entrar em uma guilda?</h3>
              <div className="guild-steps-grid">
                {[
                  { n:"01", icon:"🔗", text:"Peça o link de convite ao líder" },
                  { n:"02", icon:"🌐", text:"Abra o link — o jogo pergunta se quer entrar" },
                  { n:"03", icon:"🎉", text:"Aceite e comece a jogar junto!" },
                ].map(s => (
                  <div key={s.n} className="guild-step-card">
                    <div className="guild-step-num">{s.n}</div>
                    <div style={{ fontSize:28, marginBottom:8 }}>{s.icon}</div>
                    <p style={{ fontSize:13, color:"#94a3b8", lineHeight:1.6, margin:0 }}>{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ALL GUILDS LIST ═════════════════════════════════════════════ */}
        {view === "guilds" && (
          <div className="guild-content-pad">
            <div className="guild-section-header">
              <h2 className="guild-section-title">🌐 Todas as Guildas</h2>
              <span className="guild-realtime-dot">● Tempo real</span>
            </div>

            {allGuilds.length === 0 ? (
              <div className="guild-empty">
                <div style={{ fontSize:56, marginBottom:16 }}>🏰</div>
                <p style={{ color:"#475569", fontSize:15, fontWeight:700 }}>Nenhuma guilda criada ainda</p>
                <p style={{ color:"#334155", fontSize:13, marginTop:4 }}>Seja o primeiro a criar uma!</p>
              </div>
            ) : (
              <div className="guild-list">
                {allGuilds.map(g => {
                  const isMyGuild = guild?.id === g.id
                  const canJoin   = !guild && !isMyGuild
                  return (
                    <div key={g.id} className={"guild-list-card" + (isMyGuild ? " my-guild" : "")}>
                      <GuildIcon icon={g.icon} size={56} borderRadius={14}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                          <span className="guild-list-name">{g.name}</span>
                          {isMyGuild && <span className="guild-badge-mine">Sua Guilda</span>}
                          <span className="guild-list-level">Lv.{g.level}</span>
                        </div>
                        <p className="guild-list-slogan">{g.slogan}</p>
                        <div style={{ display:"flex", gap:12, marginTop:4 }}>
                          <span className="guild-list-meta">👥 {g.max_members} vagas</span>
                          <span className="guild-list-meta">
                            {g.join_mode === "open" ? "🔓 Livre" : "🔒 Aprovação"}
                          </span>
                        </div>
                      </div>
                      <div style={{ flexShrink:0 }}>
                        {isMyGuild && (
                          <button onClick={() => setView("main")} className="guild-btn-see">Ver →</button>
                        )}
                        {canJoin && (
                          <button
                            onClick={() => handleJoinPublicGuild(g)}
                            className={g.join_mode === "open" ? "guild-btn-join" : "guild-btn-request"}
                          >
                            {g.join_mode === "open" ? "⚔ Entrar" : "📩 Solicitar"}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ MAIN (in guild) ════════════════════════════════════════════ */}
        {guild && view === "main" && (
          <div className="guild-content-pad">
            {/* Guild hero card */}
            <div className="guild-hero-card">
              <div className="guild-hero-glow"/>
              <div style={{ display:"flex", alignItems:"center", gap:18, marginBottom:20, position:"relative" }}>
                <div className="guild-hero-icon-wrap">
                  <GuildIcon icon={guild.icon} size={72} borderRadius={18}/>
                  <div className="guild-hero-icon-ring"/>
                </div>
                <div style={{ flex:1 }}>
                  <h2 className="guild-hero-name">{guild.name}</h2>
                  <p className="guild-hero-slogan">{guild.slogan}</p>
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <span className="guild-level-badge">Lv.{guild.level}</span>
                    <span className={guild.join_mode === "open" ? "guild-badge-open" : "guild-badge-lock"}>
                      {guild.join_mode === "open" ? "🔓 Livre" : "🔒 Aprovação"}
                    </span>
                  </div>
                </div>
              </div>

              {/* XP bar */}
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em" }}>XP da Guilda</span>
                  <span style={{ fontSize:11, color:"#a78bfa", fontWeight:800 }}>{guild.xp} / {guild.xp_to_next}</span>
                </div>
                <div className="guild-xp-track">
                  <div className="guild-xp-fill" style={{ width:`${Math.min(100,(guild.xp/guild.xp_to_next)*100)}%` }}/>
                  <div className="guild-xp-shimmer"/>
                </div>
              </div>

              {/* Stats */}
              <div className="guild-stats-grid">
                {[
                  { icon:"👥", val:`${members.length}/${guild.max_members}`, lbl:"Membros" },
                  { icon:"🪙", val:guild.guild_coins, lbl:"Moedas" },
                  { icon:"⭐", val:guild.xp, lbl:"XP Total" },
                ].map(s => (
                  <div key={s.lbl} className="guild-stat-card">
                    <span style={{ fontSize:22, display:"block", marginBottom:6 }}>{s.icon}</span>
                    <span className="guild-stat-val">{s.val}</span>
                    <span className="guild-stat-lbl">{s.lbl}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite link */}
            <div className="guild-invite-bar">
              <div>
                <div style={{ fontWeight:800, fontSize:13, color:"#06b6d4", marginBottom:3 }}>🔗 Link de Convite</div>
                <div style={{ fontSize:11, color:"#334155" }}>Compartilhe com amigos para crescer sua guilda</div>
              </div>
              <button onClick={handleCopyInvite} className={"guild-copy-btn" + (copied ? " copied" : "")}>
                {copied ? "✓ Copiado!" : "Copiar"}
              </button>
            </div>

            {/* Activities grid */}
            <h3 className="guild-section-title" style={{ marginBottom:14 }}>Atividades</h3>
            <div className="guild-activities-grid">
              <button onClick={() => setView("boss")} className="guild-activity-card boss">
                <div className="guild-activity-bg"/>
                <span className="guild-activity-icon">💀</span>
                <div className="guild-activity-name">Chefão</div>
                <div className="guild-activity-desc">Duelo difícil vs. Boss</div>
                <div className="guild-activity-arrow">→</div>
              </button>
              <button onClick={() => setView("war")} className="guild-activity-card war">
                <div className="guild-activity-bg"/>
                <span className="guild-activity-icon">⚔️</span>
                <div className="guild-activity-name">Guerra</div>
                <div className="guild-activity-desc">PVP em equipe</div>
                <div className="guild-activity-arrow">→</div>
              </button>
              <button onClick={() => toast("🎯 Meta: vençam 50 duelos juntos!")} className="guild-activity-card mission">
                <div className="guild-activity-bg"/>
                <span className="guild-activity-icon">🎯</span>
                <div className="guild-activity-name">Missão</div>
                <div className="guild-activity-desc">Meta colaborativa</div>
                <div className="guild-activity-arrow">→</div>
              </button>
              <button onClick={() => setView("shop")} className="guild-activity-card shop">
                <div className="guild-activity-bg"/>
                <span className="guild-activity-icon">🛒</span>
                <div className="guild-activity-name">Loja</div>
                <div className="guild-activity-desc">Troque moedas</div>
                <div className="guild-activity-arrow">→</div>
              </button>
            </div>

            {guild.description && (
              <div className="guild-desc-card">{guild.description}</div>
            )}
          </div>
        )}

        {/* ═══ MEMBERS ════════════════════════════════════════════════════ */}
        {guild && view === "members" && (
          <div className="guild-content-pad">
            <div className="guild-section-header">
              <h2 className="guild-section-title">👥 {members.length}/{guild.max_members} Membros</h2>
              <span className="guild-realtime-dot">● Tempo real</span>
            </div>
            <div className="guild-members-list">
              {[...members]
                .sort((a,b) => {
                  const o: Record<GuildRole,number> = {leader:0,officer:1,member:2}
                  return o[a.role]-o[b.role] || b.weekly_contrib-a.weekly_contrib
                })
                .map(m => {
                  const rl = roleLabel(m.role)
                  const isOnline = Date.now() - m.last_online < 5*60000
                  const canManage = (myRole==="leader"||myRole==="officer") && m.role==="member" && m.id!==myId
                  return (
                    <div key={m.id} className={"guild-member-card" + (m.id===myId ? " is-me" : "")}>
                      <div style={{ position:"relative", flexShrink:0 }}>
                        <div className="guild-member-avatar">
                          {m.avatar_url
                            ? <img src={m.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt=""/>
                            : <span style={{ fontSize:20 }}>👤</span>}
                        </div>
                        <div className={"guild-online-dot" + (isOnline ? " online" : "")}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                          <span className="guild-member-name">{m.name}</span>
                          <span style={{ fontSize:9, fontWeight:800, color:rl.color,
                            background:rl.bg, padding:"2px 7px", borderRadius:5,
                            textTransform:"uppercase", letterSpacing:"0.06em" }}>{rl.text}</span>
                          {m.id === myId && <span style={{ fontSize:9, color:"#fbbf24" }}>Você</span>}
                        </div>
                        <div style={{ display:"flex", gap:10, fontSize:11, color:"#475569" }}>
                          <span>Lv.{m.level}</span>
                          <span>·</span>
                          <span>{isOnline ? "🟢 Online" : timeAgo(m.last_online)}</span>
                          <span>·</span>
                          <span style={{ color:"#06b6d4" }}>⚡{m.weekly_contrib}</span>
                        </div>
                      </div>
                      {canManage && (
                        <div style={{ display:"flex", gap:6 }}>
                          {myRole==="leader" && (
                            <button onClick={() => handlePromote(m.id)} className="guild-btn-promote">↑ Oficial</button>
                          )}
                          <button onClick={() => handleKick(m.id)} className="guild-btn-kick">Expulsar</button>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ═══ CHAT ══════════════════════════════════════════════════════ */}
        {guild && view === "chat" && (
          <div className="guild-chat-layout">
            <div className="guild-section-header" style={{ padding:"0 0 12px" }}>
              <h2 className="guild-section-title">💬 Chat da Guilda</h2>
              <span className="guild-realtime-dot">● Tempo real</span>
            </div>

            <div className="guild-chat-messages" ref={chatEndRef as any}>
              {chat.length === 0 && (
                <div className="guild-empty" style={{ padding:"40px 0" }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>💬</div>
                  <p style={{ color:"#475569", fontSize:13 }}>Nenhuma mensagem ainda. Seja o primeiro!</p>
                </div>
              )}
              {chat.map(msg => {
                const isMe     = msg.author_id === myId
                const isSystem = msg.author_id === "system"
                const isEmote  = msg.text.startsWith("__emote__")
                const rl       = isSystem ? null : roleLabel(msg.author_role)
                return (
                  <div key={msg.id} className={"guild-msg-row" + (isMe ? " me" : "") + (isSystem ? " system" : "")}>
                    {!isMe && !isSystem && (
                      <div className="guild-msg-meta">
                        <span className="guild-msg-author">{msg.author_name}</span>
                        {rl && <span style={{ fontSize:8, fontWeight:800, color:rl.color,
                          background:rl.bg, padding:"1px 5px", borderRadius:4,
                          textTransform:"uppercase" }}>{rl.text}</span>}
                      </div>
                    )}
                    {isEmote ? (() => {
                      const parts = msg.text.split("__").filter(Boolean)
                      return (
                        <div style={{ textAlign: isMe ? "right" : "left" }}>
                          <img src={parts[2]??""} alt={parts[3]??""} className="guild-emote-img"/>
                          <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{timeAgo(msg.timestamp)}</div>
                        </div>
                      )
                    })() : (
                      <div className={"guild-msg-bubble" + (isSystem ? " system" : isMe ? " me" : "")}>
                        <p style={{ margin:0, fontSize:13, lineHeight:1.5 }}>{msg.text}</p>
                        <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", marginTop:3, textAlign:"right" }}>
                          {timeAgo(msg.timestamp)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={chatEndRef}/>
            </div>

            {/* Chat error */}
            {chatError && (
              <div className="guild-chat-error">
                <span>🚫</span> {chatError}
              </div>
            )}

            {/* Emote picker */}
            {showEmotes && (
              <div className="guild-emote-picker">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:"#a78bfa",
                    textTransform:"uppercase", letterSpacing:"0.08em" }}>Emotes</span>
                  <button onClick={() => setShowEmotes(false)} style={{ background:"none", border:"none",
                    cursor:"pointer", color:"#475569", fontSize:16 }}>✕</button>
                </div>
                <div className="guild-emote-grid">
                  {GAME_EMOTES.map(emote => (
                    <button key={emote.id} onClick={() => handleSendEmote(emote)}
                      title={emote.name} className="guild-emote-btn">
                      <img src={emote.image} alt={emote.name} style={{ width:44, height:44, objectFit:"contain" }}
                        onError={e => { (e.target as HTMLImageElement).style.opacity="0.3" }}/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="guild-chat-input-row">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && handleSendChat()}
                placeholder="Mensagem para a guilda..."
                maxLength={200}
                className={"guild-chat-input" + (chatError ? " error" : "")}
              />
              <button onClick={() => setShowEmotes(v => !v)}
                className={"guild-emoji-btn" + (showEmotes ? " active" : "")}>😊</button>
              <button onClick={handleSendChat} className="guild-send-btn">
                <span style={{ fontSize:18 }}>➤</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══ BOSS ═══════════════════════════════════════════════════════ */}
        {guild && view === "boss" && (
          <div className="guild-content-pad">
            <div className="guild-boss-hero">
              <div className="guild-boss-aura"/>
              <div style={{ position:"relative", textAlign:"center", paddingTop:20 }}>
                <div className="guild-boss-skull">💀</div>
                <h2 className="guild-boss-title">Chefão da Guilda</h2>
                <p className="guild-boss-sub">
                  Enfrente o Chefão em um <strong style={{ color:"#f1f5f9" }}>duelo difícil de verdade</strong>.<br/>
                  Escolha seu melhor deck e supere o desafio!
                </p>
              </div>

              {/* Boss info */}
              <div className="guild-boss-info">
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:16 }}>⚠️</span>
                  <strong style={{ color:"#f87171", fontSize:14 }}>Mefisto das Sombras</strong>
                </div>
                <div style={{ fontSize:12, color:"#94a3b8" }}>
                  Nível: Extremo · 4.000 HP · Habilidades especiais ativas
                </div>
              </div>

              {/* Reward tiers */}
              <div className="guild-rewards-grid">
                {[
                  { label:"Derrota Honrosa",    reward:"25 🪙",           color:"#64748b", icon:"🛡" },
                  { label:"Vitória Rápida",      reward:"100 🪙 + Pack",   color:"#fbbf24", icon:"⚡" },
                  { label:"Vitória Perfeita",    reward:"200 🪙 + Pack SR", color:"#60a5fa", icon:"💫" },
                  { label:"Lendário (sem dano)", reward:"500 🪙 + Pack LR", color:"#a855f7", icon:"👑" },
                ].map(r => (
                  <div key={r.label} className="guild-reward-card">
                    <div style={{ fontSize:20, marginBottom:6 }}>{r.icon}</div>
                    <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>{r.label}</div>
                    <div style={{ fontWeight:900, fontSize:13, color:r.color }}>{r.reward}</div>
                  </div>
                ))}
              </div>

              <button onClick={() => setShowDeckSel(true)} className="guild-boss-btn">
                ⚔ Escolher Deck e Batalhar
              </button>
            </div>

            {/* Ranking */}
            <div className="guild-ranking-card">
              <h4 className="guild-section-title" style={{ marginBottom:16 }}>🏆 Ranking — Boss da Semana</h4>
              {[...members].slice(0,5).map((m,i) => (
                <div key={m.id} className="guild-rank-row">
                  <span className="guild-rank-medal">{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                  <div className="guild-member-avatar" style={{ width:32, height:32 }}>
                    {m.avatar_url
                      ? <img src={m.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt=""/>
                      : <span style={{ fontSize:14 }}>👤</span>}
                  </div>
                  <span style={{ flex:1, fontSize:13, color:"#e2e8f0", fontWeight:700 }}>{m.name}</span>
                  <span style={{ fontSize:13, color:"#fbbf24", fontWeight:900 }}>{m.weekly_contrib*50+500} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ WAR ════════════════════════════════════════════════════════ */}
        {guild && view === "war" && (
          <div className="guild-content-pad">
            <div className="guild-war-hero">
              <div className="guild-war-bg"/>
              <div style={{ position:"relative", textAlign:"center", padding:"30px 20px" }}>
                <h2 style={{ fontWeight:900, fontSize:22, color:"#60a5fa", margin:"0 0 8px",
                  textShadow:"0 0 30px rgba(96,165,250,0.6)" }}>⚔️ Guerra de Guildas</h2>
                <p style={{ color:"#64748b", fontSize:13, marginBottom:20 }}>Próxima guerra começa em</p>
                <div className="guild-war-timer">18:32:07</div>
                <p style={{ color:"#334155", fontSize:12, marginTop:12 }}>
                  Enfrente outra guilda em duelos PVP.<br/>Ganha moedas ao vencer!
                </p>
              </div>
              <div style={{ display:"flex", gap:10, padding:"0 20px 24px" }}>
                <button className="guild-btn-secondary" style={{ flex:1 }}>🛡 Preparar Defesa</button>
                <button className="guild-btn-war" style={{ flex:1 }}>⚔ Atacar</button>
              </div>
            </div>

            <div className="guild-ranking-card" style={{ marginTop:16 }}>
              <h4 className="guild-section-title" style={{ marginBottom:14 }}>📊 Últimas Guerras</h4>
              {[
                { oponente:"Dragões do Norte", resultado:"Vitória", pontos:"+120🪙" },
                { oponente:"Clã da Tempestade", resultado:"Derrota", pontos:"+30🪙" },
              ].map((w,i) => (
                <div key={i} className="guild-rank-row">
                  <span style={{ fontSize:16 }}>{w.resultado==="Vitória"?"🏆":"💔"}</span>
                  <span style={{ flex:1, fontSize:13, color:"#94a3b8" }}>vs {w.oponente}</span>
                  <span style={{ fontWeight:800, fontSize:12,
                    color:w.resultado==="Vitória"?"#22c55e":"#f87171" }}>{w.resultado}</span>
                  <span style={{ fontSize:12, color:"#fbbf24", marginLeft:8 }}>{w.pontos}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SHOP ═══════════════════════════════════════════════════════ */}
        {guild && view === "shop" && (
          <div className="guild-content-pad">
            <div className="guild-section-header">
              <h2 className="guild-section-title">🛒 Loja da Guilda</h2>
              <span style={{ fontSize:14, fontWeight:900, color:"#fbbf24" }}>🪙 {guild.guild_coins}</span>
            </div>
            <div className="guild-shop-grid">
              {[
                { name:"Pack de Gacha Comum", cost:50,  icon:"📦", desc:"1 pack comum",          hot:false },
                { name:"100 Gacha Coins",      cost:80,  icon:"🪙", desc:"Moedas do jogo",        hot:false },
                { name:"Pack SR Garantido",    cost:200, icon:"💎", desc:"Garante SR ou acima",   hot:true  },
                { name:"Título Exclusivo",     cost:500, icon:"🏷️", desc:"Título de guilda",     hot:true  },
              ].map(item => {
                const canBuy = (guild?.guild_coins ?? 0) >= item.cost
                return (
                  <div key={item.name} className={"guild-shop-card" + (item.hot ? " hot" : "")}>
                    {item.hot && <div className="guild-shop-hot-badge">⭐ Destaque</div>}
                    <div className="guild-shop-icon">{item.icon}</div>
                    <div className="guild-shop-name">{item.name}</div>
                    <div className="guild-shop-desc">{item.desc}</div>
                    <button
                      onClick={() => canBuy
                        ? toast("✅ " + item.name + " comprado!")
                        : toast("❌ Moedas insuficientes!")}
                      className={"guild-shop-btn" + (canBuy ? "" : " disabled")}
                    >
                      🪙 {item.cost}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ SETTINGS ════════════════════════════════════════════════════ */}
        {guild && view === "settings" && (
          <div className="guild-content-pad">
            <h2 className="guild-section-title" style={{ marginBottom:20 }}>⚙️ Configurações da Guilda</h2>
            {myRole === "leader" && (
              <div className="guild-settings-card">
                <h4 style={{ fontWeight:800, fontSize:12, color:"#94a3b8",
                  textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 14px" }}>👑 Opções do Líder</h4>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0",
                  borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color:"#94a3b8", fontSize:14 }}>Modo de entrada</span>
                  <button onClick={async () => {
                    const newMode: GuildJoinMode = guild.join_mode === "open" ? "approval" : "open"
                    setGuild(g => g ? { ...g, join_mode: newMode } : g)
                    await sbUpdate("guilds", "id=eq." + guild.id, { join_mode: newMode })
                  }} className="guild-btn-toggle">
                    {guild.join_mode === "open" ? "🔓 Livre" : "🔒 Aprovação"}
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => setLeaveConfirm(true)} className="guild-btn-leave">
              🚪 Sair da Guilda
            </button>
          </div>
        )}

      </main>

      {/* ── CSS ── */}
      <GuildStyles/>
    </div>
  )
}

// ─── Styles Component ─────────────────────────────────────────────────────────
function GuildStyles() {
  return (
    <style>{`
      /* ── Reset & Base ── */
      .guild-screen { min-height:100vh; font-family:'Segoe UI',system-ui,sans-serif; color:#f1f5f9; position:relative; overflow-x:hidden; background:#05000f; }

      /* ── Background ── */
      .guild-bg { position:fixed; inset:0; pointer-events:none; z-index:0; }
      .guild-bg-orb { position:absolute; border-radius:50%; filter:blur(80px); }
      .guild-bg-orb.orb1 { width:600px; height:600px; top:-200px; left:-100px; background:radial-gradient(circle,rgba(88,28,220,0.18) 0%,transparent 70%); animation:orbDrift1 12s ease-in-out infinite; }
      .guild-bg-orb.orb2 { width:500px; height:500px; bottom:-100px; right:-100px; background:radial-gradient(circle,rgba(6,182,212,0.10) 0%,transparent 70%); animation:orbDrift2 15s ease-in-out infinite; }
      .guild-bg-orb.orb3 { width:400px; height:400px; top:40%; left:50%; transform:translateX(-50%); background:radial-gradient(circle,rgba(251,191,36,0.06) 0%,transparent 70%); animation:orbDrift1 18s ease-in-out infinite reverse; }
      .guild-bg-grid { position:absolute; inset:0; opacity:0.025; background-image:linear-gradient(rgba(139,92,246,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.4) 1px,transparent 1px); background-size:48px 48px; }

      /* ── Toast ── */
      .guild-toast { position:fixed; top:80px; left:50%; transform:translateX(-50%); z-index:9999; background:rgba(15,5,35,0.95); border:1px solid rgba(139,92,246,0.45); border-radius:14px; padding:11px 24px; color:#e2e8f0; font-weight:800; font-size:13px; backdrop-filter:blur(16px); box-shadow:0 4px 30px rgba(0,0,0,0.5); white-space:nowrap; animation:toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1); }

      /* ── Header ── */
      .guild-header { position:sticky; top:0; z-index:50; background:rgba(5,0,15,0.90); backdrop-filter:blur(20px); border-bottom:1px solid rgba(139,92,246,0.15); }
      .guild-header-inner { display:flex; align-items:center; gap:12; padding:14px 18px; max-width:900px; margin:0 auto; }
      .guild-back-btn { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); border-radius:12px; padding:8px 12px; cursor:pointer; color:#94a3b8; transition:all 0.2s; flex-shrink:0; }
      .guild-back-btn:hover { background:rgba(255,255,255,0.10); color:#e2e8f0; }
      .guild-header-name { font-weight:900; font-size:18px; margin:0; background:linear-gradient(135deg,#e2e8f0,#c4b5fd); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
      .guild-header-sub { color:#475569; font-size:11px; margin:2px 0 0; }
      .guild-level-badge { background:linear-gradient(135deg,rgba(139,92,246,0.25),rgba(109,40,217,0.20)); color:#c4b5fd; font-size:10px; font-weight:800; padding:2px 8px; border-radius:6px; border:1px solid rgba(139,92,246,0.30); }
      .guild-badge-open { background:rgba(34,197,94,0.12); color:#22c55e; font-size:9px; font-weight:800; padding:2px 7px; border-radius:5px; border:1px solid rgba(34,197,94,0.25); }
      .guild-badge-lock { background:rgba(245,158,11,0.12); color:#f59e0b; font-size:9px; font-weight:800; padding:2px 7px; border-radius:5px; border:1px solid rgba(245,158,11,0.25); }
      .guild-badge-mine { background:rgba(139,92,246,0.20); color:#a78bfa; font-size:9px; font-weight:800; padding:2px 7px; border-radius:5px; }
      .guild-btn-checkin { background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.30); border-radius:10px; padding:7px 14px; cursor:pointer; color:#22c55e; font-size:11px; font-weight:800; transition:all 0.2s; white-space:nowrap; }
      .guild-btn-checkin:hover { background:rgba(34,197,94,0.22); }
      .guild-btn-checked { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:7px 14px; cursor:not-allowed; color:#334155; font-size:11px; font-weight:800; white-space:nowrap; }
      .guild-btn-icon { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); border-radius:10px; padding:7px 10px; cursor:pointer; color:#64748b; font-size:16px; line-height:1; transition:all 0.2s; }
      .guild-btn-icon:hover { background:rgba(255,255,255,0.10); color:#e2e8f0; }

      /* ── Nav ── */
      .guild-nav { display:flex; max-width:900px; margin:0 auto; padding:0 12px 8px; gap:2px; overflow-x:auto; }
      .guild-tab { flex:1; min-width:70px; display:flex; flex-direction:column; align-items:center; gap:3px; padding:8px 4px; background:transparent; border:none; border-radius:10px; cursor:pointer; transition:all 0.2s; color:#475569; }
      .guild-tab:hover { background:rgba(255,255,255,0.05); color:#94a3b8; }
      .guild-tab.active { background:linear-gradient(135deg,rgba(139,92,246,0.20),rgba(6,182,212,0.10)); color:#e2e8f0; box-shadow:inset 0 -2px 0 #8b5cf6; }
      .guild-tab-icon { font-size:16px; }
      .guild-tab-label { font-size:10px; font-weight:700; }

      /* ── Main content ── */
      .guild-main { flex:1; position:relative; z-index:1; overflow-y:auto; }
      .guild-content-pad { max-width:900px; margin:0 auto; padding:20px 18px 100px; }

      /* ── Section header ── */
      .guild-section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
      .guild-section-title { font-weight:900; font-size:16px; margin:0; background:linear-gradient(135deg,#f1f5f9,#c4b5fd); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
      .guild-realtime-dot { font-size:11px; color:#22c55e; font-weight:700; }

      /* ── Browse ── */
      .guild-browse { padding-bottom:60px; }
      .guild-browse-hero { position:relative; min-height:280px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
      .guild-browse-runes { position:absolute; inset:0; background:radial-gradient(ellipse 80% 60% at 50% 50%,rgba(88,28,220,0.20) 0%,transparent 70%); }
      .guild-browse-hero-content { position:relative; text-align:center; padding:40px 20px; }
      .guild-browse-title { font-weight:900; font-size:32px; margin:0 0 8px; background:linear-gradient(135deg,#f1f5f9,#c4b5fd,#67e8f9); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; letter-spacing:0.02em; }
      .guild-browse-sub { color:#64748b; font-size:15px; margin:0; }
      .guild-browse-actions { display:flex; gap:12px; padding:0 18px 24px; max-width:600px; margin:0 auto; }
      .guild-btn-create { flex:1; display:flex; align-items:center; gap:14px; padding:18px 20px; background:linear-gradient(135deg,#6d28d9,#8b5cf6); border:none; border-radius:16px; cursor:pointer; color:#fff; text-align:left; box-shadow:0 4px 24px rgba(139,92,246,0.45); transition:all 0.2s; }
      .guild-btn-create:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(139,92,246,0.60); }
      .guild-btn-browse { flex:1; display:flex; align-items:center; gap:14px; padding:18px 20px; background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.30); border-radius:16px; cursor:pointer; color:#06b6d4; text-align:left; transition:all 0.2s; }
      .guild-btn-browse:hover { background:rgba(6,182,212,0.15); transform:translateY(-2px); }
      .guild-steps { max-width:600px; margin:0 auto; padding:0 18px; }
      .guild-steps-title { font-weight:700; font-size:12px; color:#475569; text-transform:uppercase; letter-spacing:0.10em; margin:0 0 14px; }
      .guild-steps-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
      .guild-step-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:20px 14px; text-align:center; }
      .guild-step-num { font-size:10px; font-weight:900; color:#8b5cf6; letter-spacing:0.10em; margin-bottom:10px; }

      /* ── Guild list ── */
      .guild-list { display:flex; flex-direction:column; gap:10px; }
      .guild-list-card { display:flex; align-items:center; gap:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:14px 16px; transition:all 0.2s; }
      .guild-list-card:hover { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.12); }
      .guild-list-card.my-guild { background:rgba(139,92,246,0.10); border-color:rgba(139,92,246,0.30); }
      .guild-list-name { font-weight:900; font-size:15px; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .guild-list-level { font-size:9px; font-weight:800; color:#475569; }
      .guild-list-slogan { font-size:12px; color:#64748b; font-style:italic; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin:3px 0 0; }
      .guild-list-meta { font-size:11px; color:#334155; }
      .guild-btn-see { padding:8px 14px; border-radius:10px; border:none; background:linear-gradient(135deg,#6d28d9,#8b5cf6); color:#fff; font-weight:800; font-size:11px; cursor:pointer; }
      .guild-btn-join { padding:8px 14px; border-radius:10px; border:none; background:linear-gradient(135deg,#065f46,#059669); color:#fff; font-weight:800; font-size:12px; cursor:pointer; box-shadow:0 2px 12px rgba(5,150,105,0.40); transition:all 0.2s; }
      .guild-btn-join:hover { transform:scale(1.05); box-shadow:0 4px 18px rgba(5,150,105,0.55); }
      .guild-btn-request { padding:8px 14px; border-radius:10px; border:none; background:linear-gradient(135deg,#92400e,#d97706); color:#fff; font-weight:800; font-size:12px; cursor:pointer; box-shadow:0 2px 12px rgba(217,119,6,0.40); transition:all 0.2s; }

      /* ── Guild hero card ── */
      .guild-hero-card { background:linear-gradient(135deg,rgba(88,28,220,0.15),rgba(55,48,163,0.10)); border:1px solid rgba(139,92,246,0.25); border-radius:20px; padding:22px; margin-bottom:16px; position:relative; overflow:hidden; }
      .guild-hero-glow { position:absolute; inset:0; background:radial-gradient(ellipse 80% 50% at 20% 20%,rgba(139,92,246,0.08) 0%,transparent 60%); pointer-events:none; }
      .guild-hero-icon-wrap { position:relative; }
      .guild-hero-icon-ring { position:absolute; inset:-4px; border-radius:22px; border:2px solid rgba(139,92,246,0.40); animation:ringPulse 3s ease-in-out infinite; }
      .guild-hero-name { font-weight:900; font-size:22px; margin:0 0 4px; background:linear-gradient(135deg,#f1f5f9,#c4b5fd); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
      .guild-hero-slogan { font-size:13px; color:#64748b; font-style:italic; margin:0; }
      .guild-xp-track { height:8px; border-radius:99px; background:rgba(255,255,255,0.06); overflow:hidden; position:relative; }
      .guild-xp-fill { height:100%; border-radius:99px; background:linear-gradient(90deg,#7c3aed,#a855f7,#c084fc); box-shadow:0 0 12px rgba(168,85,247,0.6); transition:width 0.8s cubic-bezier(0.4,0,0.2,1); }
      .guild-xp-shimmer { position:absolute; top:0; left:-100%; width:100%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:shimmer 2.5s ease-in-out infinite; }
      .guild-stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
      .guild-stat-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:14px; text-align:center; }
      .guild-stat-val { display:block; font-weight:900; font-size:18px; color:#e2e8f0; margin-bottom:2px; }
      .guild-stat-lbl { font-size:11px; color:#475569; }

      /* ── Invite bar ── */
      .guild-invite-bar { background:rgba(6,182,212,0.06); border:1px solid rgba(6,182,212,0.18); border-radius:14px; padding:14px 16px; margin-bottom:20px; display:flex; align-items:center; gap:14px; }
      .guild-copy-btn { padding:9px 18px; border-radius:10px; border:1px solid rgba(6,182,212,0.35); background:rgba(6,182,212,0.12); color:#06b6d4; font-weight:800; font-size:12px; cursor:pointer; flex-shrink:0; transition:all 0.2s; }
      .guild-copy-btn:hover,.guild-copy-btn.copied { background:rgba(6,182,212,0.25); }
      .guild-copy-btn.copied { color:#67e8f9; border-color:rgba(6,182,212,0.55); }

      /* ── Activities ── */
      .guild-activities-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
      .guild-activity-card { position:relative; border-radius:16px; padding:18px; cursor:pointer; text-align:left; border:1px solid rgba(255,255,255,0.08); overflow:hidden; transition:all 0.2s; }
      .guild-activity-card:hover { transform:translateY(-2px); }
      .guild-activity-bg { position:absolute; inset:0; opacity:0.6; }
      .guild-activity-card.boss { background:rgba(127,29,29,0.25); border-color:rgba(220,38,38,0.20); }
      .guild-activity-card.boss .guild-activity-bg { background:radial-gradient(ellipse at 100% 0%,rgba(220,38,38,0.15) 0%,transparent 60%); }
      .guild-activity-card.boss:hover { border-color:rgba(220,38,38,0.40); }
      .guild-activity-card.war { background:rgba(29,78,216,0.15); border-color:rgba(59,130,246,0.20); }
      .guild-activity-card.war .guild-activity-bg { background:radial-gradient(ellipse at 100% 0%,rgba(59,130,246,0.15) 0%,transparent 60%); }
      .guild-activity-card.mission { background:rgba(5,78,50,0.15); border-color:rgba(52,211,153,0.20); }
      .guild-activity-card.mission .guild-activity-bg { background:radial-gradient(ellipse at 100% 0%,rgba(52,211,153,0.12) 0%,transparent 60%); }
      .guild-activity-card.shop { background:rgba(92,64,3,0.20); border-color:rgba(251,191,36,0.20); }
      .guild-activity-card.shop .guild-activity-bg { background:radial-gradient(ellipse at 100% 0%,rgba(251,191,36,0.12) 0%,transparent 60%); }
      .guild-activity-icon { font-size:28px; display:block; margin-bottom:8px; position:relative; }
      .guild-activity-name { font-weight:900; font-size:14px; color:#e2e8f0; position:relative; }
      .guild-activity-desc { font-size:11px; color:#475569; margin-top:3px; position:relative; }
      .guild-activity-arrow { position:absolute; right:14px; top:50%; transform:translateY(-50%); font-size:18px; color:rgba(255,255,255,0.15); }
      .guild-desc-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px 16px; color:#64748b; font-size:13px; line-height:1.7; }

      /* ── Members ── */
      .guild-members-list { display:flex; flex-direction:column; gap:8px; }
      .guild-member-card { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:12px 14px; transition:all 0.15s; }
      .guild-member-card.is-me { border-color:rgba(139,92,246,0.25); background:rgba(139,92,246,0.06); }
      .guild-member-avatar { width:40px; height:40px; border-radius:10px; background:linear-gradient(135deg,#1e3a5f,#0f2744); border:1px solid rgba(255,255,255,0.10); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; }
      .guild-online-dot { position:absolute; bottom:-2px; right:-2px; width:10px; height:10px; border-radius:50%; background:#374151; border:2px solid #05000f; }
      .guild-online-dot.online { background:#22c55e; }
      .guild-member-name { font-weight:800; font-size:14px; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .guild-btn-promote { background:rgba(96,165,250,0.12); border:1px solid rgba(96,165,250,0.25); border-radius:8px; padding:5px 10px; cursor:pointer; color:#60a5fa; font-size:10px; font-weight:800; }
      .guild-btn-kick { background:rgba(239,68,68,0.10); border:1px solid rgba(239,68,68,0.20); border-radius:8px; padding:5px 10px; cursor:pointer; color:#f87171; font-size:10px; font-weight:800; }

      /* ── Chat ── */
      .guild-chat-layout { max-width:900px; margin:0 auto; padding:16px 18px; display:flex; flex-direction:column; height:calc(100vh - 130px); }
      .guild-chat-messages { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding-bottom:12px; }
      .guild-msg-row { display:flex; flex-direction:column; }
      .guild-msg-row.me { align-items:flex-end; }
      .guild-msg-row.system { align-items:center; }
      .guild-msg-meta { display:flex; align-items:center; gap:6px; margin-bottom:4px; padding-left:4px; }
      .guild-msg-author { font-weight:800; font-size:11px; color:#94a3b8; }
      .guild-msg-bubble { max-width:75%; padding:10px 14px; border-radius:16px; }
      .guild-msg-bubble.me { background:linear-gradient(135deg,#6d28d9,#8b5cf6); border-radius:16px 16px 4px 16px; }
      .guild-msg-bubble:not(.me):not(.system) { background:rgba(255,255,255,0.07); border-radius:16px 16px 16px 4px; }
      .guild-msg-bubble.system { background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.22); border-radius:12px; color:#a78bfa; font-style:italic; font-size:12px; }
      .guild-emote-img { width:64px; height:64px; object-fit:contain; filter:drop-shadow(0 2px 8px rgba(0,0,0,0.5)); animation:emotePop 0.3s cubic-bezier(0.34,1.56,0.64,1); }
      .guild-chat-error { background:rgba(220,38,38,0.10); border:1px solid rgba(220,38,38,0.30); border-radius:10px; padding:9px 14px; margin-bottom:8px; font-size:12px; color:#fca5a5; font-weight:700; display:flex; gap:8px; align-items:center; }
      .guild-emote-picker { background:rgba(10,3,25,0.97); border:1px solid rgba(139,92,246,0.30); border-radius:16px; padding:14px; margin-bottom:10px; }
      .guild-emote-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; }
      .guild-emote-btn { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:6px; cursor:pointer; transition:all 0.15s; aspect-ratio:1; display:flex; align-items:center; justify-content:center; }
      .guild-emote-btn:hover { background:rgba(139,92,246,0.20); border-color:rgba(139,92,246,0.45); transform:scale(1.12); }
      .guild-chat-input-row { display:flex; gap:8px; padding-top:10px; }
      .guild-chat-input { flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:12px 16px; color:#e2e8f0; font-size:13px; outline:none; transition:border-color 0.2s; }
      .guild-chat-input:focus { border-color:rgba(139,92,246,0.50); }
      .guild-chat-input.error { border-color:rgba(220,38,38,0.60); }
      .guild-emoji-btn { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); border-radius:12px; padding:0 14px; cursor:pointer; font-size:20px; transition:all 0.15s; }
      .guild-emoji-btn:hover,.guild-emoji-btn.active { background:rgba(139,92,246,0.20); border-color:rgba(139,92,246,0.45); }
      .guild-send-btn { background:linear-gradient(135deg,#6d28d9,#8b5cf6); border:none; border-radius:12px; padding:0 18px; cursor:pointer; color:#fff; font-size:18px; transition:all 0.15s; }
      .guild-send-btn:hover { transform:scale(1.05); box-shadow:0 4px 16px rgba(139,92,246,0.50); }

      /* ── Boss ── */
      .guild-boss-hero { background:linear-gradient(160deg,rgba(100,5,5,0.35),rgba(50,0,0,0.50)); border:1px solid rgba(220,38,38,0.25); border-radius:20px; overflow:hidden; position:relative; margin-bottom:16px; }
      .guild-boss-aura { position:absolute; inset:0; background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(220,38,38,0.15) 0%,transparent 60%); pointer-events:none; }
      .guild-boss-skull { font-size:72px; display:block; filter:drop-shadow(0 0 30px rgba(220,38,38,0.8)); animation:bossFloat 3s ease-in-out infinite; margin-bottom:10px; }
      .guild-boss-title { font-weight:900; font-size:26px; margin:0 0 8px; color:#f87171; text-shadow:0 0 30px rgba(248,113,113,0.5); letter-spacing:0.02em; }
      .guild-boss-sub { font-size:13px; color:#64748b; line-height:1.7; margin:0 0 20px; }
      .guild-boss-info { background:rgba(220,38,38,0.08); border:1px solid rgba(220,38,38,0.20); border-radius:12px; padding:12px 16px; margin:0 20px 16px; }
      .guild-rewards-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 20px 16px; }
      .guild-reward-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:14px; text-align:center; }
      .guild-boss-btn { width:calc(100% - 40px); margin:0 20px 24px; padding:18px; border-radius:14px; border:none; background:linear-gradient(135deg,#dc2626,#ef4444,#dc2626); background-size:200% 100%; color:#fff; font-weight:900; font-size:16px; cursor:pointer; box-shadow:0 4px 28px rgba(220,38,38,0.55); display:flex; align-items:center; justify-content:center; gap:10px; animation:bossGlow 2s ease-in-out infinite; letter-spacing:0.04em; }
      .guild-boss-btn:hover { transform:scale(1.02); box-shadow:0 6px 36px rgba(220,38,38,0.70); }
      .guild-ranking-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:18px 20px; }
      .guild-rank-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
      .guild-rank-row:last-child { border-bottom:none; }
      .guild-rank-medal { font-size:18px; width:28px; text-align:center; }

      /* ── War ── */
      .guild-war-hero { background:linear-gradient(135deg,rgba(15,40,120,0.30),rgba(5,15,60,0.50)); border:1px solid rgba(59,130,246,0.20); border-radius:20px; overflow:hidden; position:relative; }
      .guild-war-bg { position:absolute; inset:0; background:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(59,130,246,0.12) 0%,transparent 60%); pointer-events:none; }
      .guild-war-timer { font-size:44px; font-weight:900; color:#60a5fa; text-shadow:0 0 30px rgba(96,165,250,0.6),0 0 60px rgba(96,165,250,0.3); letter-spacing:0.06em; font-variant-numeric:tabular-nums; }
      .guild-btn-war { padding:13px; border-radius:12px; border:none; background:linear-gradient(135deg,#1e40af,#3b82f6); color:#fff; font-weight:900; font-size:14px; cursor:pointer; box-shadow:0 4px 20px rgba(59,130,246,0.40); transition:all 0.2s; }
      .guild-btn-war:hover { transform:translateY(-1px); box-shadow:0 6px 28px rgba(59,130,246,0.55); }

      /* ── Shop ── */
      .guild-shop-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
      .guild-shop-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:18px; text-align:center; position:relative; transition:all 0.2s; overflow:hidden; }
      .guild-shop-card:hover { transform:translateY(-2px); border-color:rgba(255,255,255,0.14); }
      .guild-shop-card.hot { border-color:rgba(251,191,36,0.30); background:rgba(251,191,36,0.04); }
      .guild-shop-card.hot:hover { border-color:rgba(251,191,36,0.50); }
      .guild-shop-hot-badge { position:absolute; top:10px; right:10px; background:linear-gradient(135deg,#92400e,#d97706); color:#fff; font-size:9px; font-weight:900; padding:3px 8px; border-radius:6px; }
      .guild-shop-icon { font-size:36px; margin-bottom:10px; }
      .guild-shop-name { font-weight:900; font-size:14px; color:#e2e8f0; margin-bottom:6px; }
      .guild-shop-desc { font-size:11px; color:#475569; margin-bottom:14px; min-height:32px; }
      .guild-shop-btn { width:100%; padding:10px; border-radius:10px; border:none; background:linear-gradient(135deg,#92400e,#d97706); color:#fff; font-weight:800; font-size:13px; cursor:pointer; transition:all 0.2s; }
      .guild-shop-btn:hover { transform:scale(1.02); box-shadow:0 4px 14px rgba(217,119,6,0.40); }
      .guild-shop-btn.disabled { background:rgba(255,255,255,0.06); color:#334155; cursor:not-allowed; }

      /* ── Settings ── */
      .guild-settings-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:16px 18px; margin-bottom:14px; }
      .guild-btn-toggle { background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:6px 14px; cursor:pointer; color:#e2e8f0; font-size:12px; font-weight:700; transition:all 0.2s; }
      .guild-btn-toggle:hover { background:rgba(255,255,255,0.12); }
      .guild-btn-leave { width:100%; padding:14px; border-radius:14px; border:1px solid rgba(239,68,68,0.30); background:rgba(239,68,68,0.07); color:#f87171; font-weight:900; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; }
      .guild-btn-leave:hover { background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.50); }

      /* ── Modal ── */
      .guild-modal-overlay { position:fixed; inset:0; z-index:300; background:rgba(0,0,0,0.85); backdrop-filter:blur(16px); display:flex; align-items:center; justify-content:center; padding:20px; }
      .guild-modal-box { background:linear-gradient(160deg,#0a0320,#0d0a25); border:1px solid rgba(139,92,246,0.30); border-radius:24px; padding:28px 22px; width:100%; font-family:inherit; color:#f1f5f9; box-shadow:0 0 60px rgba(0,0,0,0.6); }
      .guild-btn-secondary { padding:12px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); color:#64748b; font-weight:800; font-size:13px; cursor:pointer; }
      .guild-btn-danger { padding:12px; border-radius:12px; border:none; background:linear-gradient(135deg,#7f1d1d,#dc2626); color:#fff; font-weight:900; font-size:13px; cursor:pointer; }

      /* ── Keyframes ── */
      @keyframes orbDrift1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-20px) scale(1.05)} 66%{transform:translate(-20px,30px) scale(0.97)} }
      @keyframes orbDrift2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-40px,20px) scale(1.08)} }
      @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(-12px) scale(0.95)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
      @keyframes heroFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.03)} }
      @keyframes ringPulse { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.04)} }
      @keyframes shimmer { 0%{left:-100%} 100%{left:200%} }
      @keyframes bossFloat { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-8px) rotate(1deg)} }
      @keyframes bossGlow { 0%,100%{box-shadow:0 4px 28px rgba(220,38,38,0.55)} 50%{box-shadow:0 6px 40px rgba(220,38,38,0.80),0 0 60px rgba(220,38,38,0.30)} }
      @keyframes spin { to{transform:rotate(360deg)} }
      @keyframes kickedPulse { 0%,100%{filter:drop-shadow(0 0 20px rgba(248,113,113,0.4))} 50%{filter:drop-shadow(0 0 40px rgba(248,113,113,0.8))} }
      @keyframes emotePop { 0%{transform:scale(0.4);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }

      /* ── Mobile ── */
      @media(max-width:600px){
        .guild-header-inner{padding:10px 12px;}
        .guild-header-name{font-size:16px;}
        .guild-tab-label{display:none;}
        .guild-tab{min-width:48px;}
        .guild-browse-title{font-size:24px;}
        .guild-browse-actions{flex-direction:column;}
        .guild-activities-grid{grid-template-columns:1fr 1fr;}
        .guild-steps-grid{grid-template-columns:1fr;}
        .guild-stats-grid{grid-template-columns:repeat(3,1fr);}
        .guild-shop-grid{grid-template-columns:1fr 1fr;}
        .guild-rewards-grid{grid-template-columns:1fr 1fr;}
        .guild-emote-grid{grid-template-columns:repeat(6,1fr);}
        .guild-boss-btn{font-size:14px;}
        .guild-war-timer{font-size:32px;}
      }

      /* ── Scrollbar ── */
      .guild-chat-messages::-webkit-scrollbar,.guild-main::-webkit-scrollbar{width:4px;}
      .guild-chat-messages::-webkit-scrollbar-track,.guild-main::-webkit-scrollbar-track{background:transparent;}
      .guild-chat-messages::-webkit-scrollbar-thumb,.guild-main::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.30);border-radius:2px;}
    `}</style>
  )
}
