"use client"

import { useState, useEffect, useRef } from "react"
import {
  ArrowLeft, Check, Lock, ChevronRight, Swords, Trophy, Skull, Flag, Layers, Target, Gift, Sparkles,
  BookOpen, X, Minus, Plus,
} from "lucide-react"
import { useGame } from "@/contexts/game-context"
import { PackOpeningOverlay } from "./pack-opening-overlay"
import {
  type Master,
  type MasterReward,
  loadMastersFromStorage,
  saveMastersToStorage,
  rewardIconPath,
  rewardDisplayLabel,
  elementToChestId,
  grantMasterXPManual,
  xpRequiredForLevel,
} from "@/lib/masters-data"
import { CHESTS } from "@/lib/chests"
import { ALL_XP_BOOK_IDS, XP_BOOKS, type XPBookId } from "@/lib/xp-books"
import { getRuneProgress, loadUnlockedRunes } from "@/lib/runes"
import { RunesPanel } from "./runes-panel"
import { getSfxVolume, getMenuMusicMuted } from "./main-menu"

interface MasterScreenProps {
  onBack: () => void
}

const SERIF = "var(--font-serif), Georgia, serif"
const SANS  = "var(--font-sans), 'Inter', system-ui, sans-serif"

// ─── Reward type colors ───────────────────────────────────────────────────────
// Baús usam a cor do PRÓPRIO baú temático (pareado ao elemento do Mestre via
// `chestColor`), pois cada elemento tem uma identidade visual diferente.
function rewardColor(type: MasterReward["type"], chestColor?: string): string {
  if (type === "chest") return chestColor ?? "#cbd5e1"
  const map: Record<string, string> = {
    gear_coins:"#e8c96d", pack:"#60a5fa", gacha_coins:"#a78bfa",
    card_skin:"#fb923c", skip_ticket:"#34d399",
    stamina_bottle:"#f472b6",
  }
  return map[type] ?? "#94a3b8"
}

// ─── Element badge colors ─────────────────────────────────────────────────────
function elementStyle(el: string): { color: string; bg: string } {
  const map: Record<string, { color: string; bg: string }> = {
    "Aquos":   { color:"#38bdf8", bg:"rgba(56,189,248,0.12)" },
    "Darkus":  { color:"#a855f7", bg:"rgba(168,85,247,0.12)" },
    "Ventus":  { color:"#4ade80", bg:"rgba(74,222,128,0.12)" },
    "Pyrus":   { color:"#f87171", bg:"rgba(248,113,113,0.12)" },
    "Haos":    { color:"#fde68a", bg:"rgba(253,230,138,0.12)" },
    "Subterra":{ color:"#a16207", bg:"rgba(161,98,7,0.12)" },
    "Vazio":   { color:"#22d3ee", bg:"rgba(34,211,238,0.12)" },
    "Sombra":  { color:"#a855f7", bg:"rgba(168,85,247,0.12)" },
    "Vento":   { color:"#4ade80", bg:"rgba(74,222,128,0.12)" },
  }
  return map[el] ?? { color:"#94a3b8", bg:"rgba(148,163,184,0.10)" }
}

// ─── Rarity label colors ──────────────────────────────────────────────────────
function rarityStyle(r: string) {
  if (r === "LR") return { color:"#f87171", bg:"rgba(248,113,113,0.14)", label:"Lendário" }
  if (r === "UR") return { color:"#fbbf24", bg:"rgba(251,191,36,0.14)",  label:"Ultra Raro" }
  if (r === "SR") return { color:"#a78bfa", bg:"rgba(167,139,250,0.14)", label:"Super Raro" }
  return { color:"#94a3b8", bg:"rgba(148,163,184,0.12)", label:"Raro" }
}

// ─── Ornamental divider ───────────────────────────────────────────────────────
function Ornament({ color = "#e8c96d", width = 120 }: { color?: string; width?: number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, width }}>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg,transparent,${color}66)` }}/>
      <div style={{
        width:5, height:5, transform:"rotate(45deg)",
        background:`${color}aa`, boxShadow:`0 0 8px ${color}66`,
      }}/>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${color}66,transparent)` }}/>
    </div>
  )
}

// ─── XP progress bar ──────────────────────────────────────────────────────────
function XPBar({ current, total, color, height = 8 }: { current: number; total: number; color: string; height?: number }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 100
  return (
    <div style={{
      height, position:"relative",
      background:"rgba(255,255,255,0.05)",
      border:"1px solid rgba(255,255,255,0.07)",
      clipPath:"polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)",
      overflow:"hidden",
    }}>
      {[20,40,60,80].map(t => (
        <div key={t} style={{
          position:"absolute", left:`${t}%`, top:0, bottom:0, width:1,
          background:"rgba(0,0,0,0.5)", zIndex:2, transform:"skewX(-18deg)",
        }}/>
      ))}
      <div style={{
        height:"100%", width:`${pct}%`,
        background:`linear-gradient(90deg, ${color}55, ${color})`,
        boxShadow:`0 0 14px ${color}66`,
        transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)",
        position:"relative",
      }}>
        <div style={{
          position:"absolute", top:0, left:"-100%", width:"100%", height:"100%",
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)",
          animation:"gpShimmer 2.6s ease-in-out infinite",
        }}/>
      </div>
    </div>
  )
}

// ─── Level medallion ──────────────────────────────────────────────────────────
function LevelMedallion({ level, color, size = 58 }: { level: number; color: string; size?: number }) {
  return (
    <div style={{
      width:size, height:size, flexShrink:0, position:"relative",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div style={{
        position:"absolute", inset:0, transform:"rotate(45deg)",
        background:`linear-gradient(135deg,${color}28,rgba(8,6,10,0.92))`,
        border:`1.5px solid ${color}70`, borderRadius: size * 0.16,
        boxShadow:`0 0 20px ${color}38, inset 0 0 14px ${color}18`,
      }}/>
      <div style={{
        position:"absolute", inset: size * 0.09, transform:"rotate(45deg)",
        border:`1px solid ${color}35`, borderRadius: size * 0.11,
      }}/>
      <div style={{ position:"relative", textAlign:"center", zIndex:1 }}>
        <div style={{ fontSize:size*0.125, fontWeight:800, color:`${color}cc`, letterSpacing:"0.16em", lineHeight:1 }}>NV</div>
        <div style={{
          fontSize:size*0.37, fontWeight:900, color:"#f5f2ec", lineHeight:1.05,
          fontFamily:SERIF, textShadow:`0 0 14px ${color}90`,
        }}>{level}</div>
      </div>
    </div>
  )
}

// ─── Portrait tile in the selector rail ───────────────────────────────────────
function MasterTile({ master, isSelected, onClick }: {
  master: Master; isSelected: boolean; onClick: () => void
}) {
  const rar = rarityStyle(master.rarity)
  const claimable = master.rewards.filter(r => r.level <= master.currentLevel && !r.claimed).length
  const pct = master.xpToNext > 0
    ? Math.min(100, (master.currentXP / master.xpToNext) * 100) : 100

  return (
    <button
      onClick={onClick}
      className="gp-tile"
      aria-pressed={isSelected}
      style={{
        position:"relative", cursor:"pointer", border:"none", background:"none",
        padding:0, textAlign:"left", flexShrink:0, width:148,
        outline:"none",
      }}>
      <div style={{
        position:"relative", overflow:"hidden",
        clipPath:"polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
        background: isSelected
          ? `linear-gradient(160deg,${master.accentColor}50,${master.accentColor}14 40%,${master.accentColor}38)`
          : "rgba(255,255,255,0.07)",
        padding:1.5,
        transition:"background 0.3s",
      }}>
        <div style={{
          position:"relative", overflow:"hidden",
          clipPath:"polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)",
          background:"#0a080e",
        }}>
          {/* art */}
          <div style={{
            height:158, position:"relative", overflow:"hidden",
            background:`radial-gradient(ellipse at 50% 118%, ${master.bgColor} 0%, #07060a 80%)`,
          }}>
            <div style={{
              position:"absolute", inset:0,
              background:`radial-gradient(ellipse 95% 55% at 50% 105%, ${master.accentColor}22 0%, transparent 62%)`,
            }}/>
            <img
              src={master.artPath || "/placeholder.svg"}
              alt={master.name}
              className="gp-tile-art"
              style={{
                position:"absolute", inset:0, width:"100%", height:"100%",
                objectFit:"cover", objectPosition:"center top",
                filter: isSelected ? "saturate(1.08)" : "saturate(0.75) brightness(0.82)",
                transition:"transform 0.5s cubic-bezier(0.22,1,0.36,1), filter 0.3s",
              }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
            />
            <div style={{
              position:"absolute", left:0, right:0, bottom:0, height:64,
              background:"linear-gradient(transparent, #0a080e)",
            }}/>
            {/* rarity chip */}
            <div style={{
              position:"absolute", top:7, right:7,
              background:"rgba(6,5,9,0.8)", color: rar.color,
              fontSize:9, fontWeight:900, letterSpacing:"0.14em",
              padding:"3px 7px", border:`1px solid ${rar.color}50`,
              clipPath:"polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)",
              backdropFilter:"blur(6px)",
            }}>{master.rarity}</div>
            {/* active mark */}
            {master.isActive && (
              <div style={{
                position:"absolute", top:7, left:7,
                display:"flex", alignItems:"center", gap:4,
                background:"rgba(6,20,14,0.85)", color:"#34d399",
                fontSize:8.5, fontWeight:900, letterSpacing:"0.14em",
                padding:"3px 8px", border:"1px solid rgba(52,211,153,0.4)",
                clipPath:"polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)",
              }}><Check size={9}/> ATIVO</div>
            )}
            {/* claimable badge */}
            {claimable > 0 && (
              <div style={{
                position:"absolute", bottom:8, right:8,
                width:20, height:20, borderRadius:"50%",
                background:"linear-gradient(135deg,#a3742a,#e8c96d)",
                color:"#0c0a06", fontWeight:900, fontSize:10.5,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 0 12px rgba(232,201,109,0.6)",
                animation:"gpPulseSoft 2s ease-in-out infinite",
              }}>{claimable}</div>
            )}
          </div>

          {/* info */}
          <div style={{ padding:"9px 11px 11px" }}>
            <div style={{
              fontFamily:SERIF, fontWeight:700, fontSize:14, color: isSelected ? "#f5f2ec" : "#9aa1ad",
              letterSpacing:"0.03em", marginBottom:6, transition:"color 0.3s",
            }}>{master.name}</div>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{
                fontSize:9.5, fontWeight:800, color: isSelected ? master.accentColor : "#565d6b",
                letterSpacing:"0.06em", transition:"color 0.3s", flexShrink:0,
              }}>NV {master.currentLevel}</span>
              <div style={{ flex:1, height:3, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                <div style={{
                  height:"100%", width:`${pct}%`,
                  background: isSelected ? master.accentColor : "#3f4654",
                  transition:"background 0.3s",
                }}/>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* selection underline */}
      <div style={{
        height:2, marginTop:5,
        background: isSelected
          ? `linear-gradient(90deg,transparent,${master.accentColor},transparent)`
          : "transparent",
        boxShadow: isSelected ? `0 0 10px ${master.accentColor}80` : "none",
        transition:"all 0.3s",
        animation: isSelected ? "gpTileGlow 2.6s ease-in-out infinite" : undefined,
      }}/>
    </button>
  )
}

// ─── Detail / progression view ────────────────────────────────────────────────
function MasterDetail({ master, onActivate, onClose, onClaimReward, onClaimAll, onOpenRunes, onOpenXPBooks }: {
  master:        Master
  onActivate:    () => void
  onClose:       () => void
  onClaimReward: (level: number) => void
  onClaimAll:    () => void
  onOpenRunes:   () => void
  onOpenXPBooks: () => void
}) {
  // Livros de XP no inventário — só mostra o botão "Upar XP" se o jogador tiver ao menos 1
  const { xpBooks } = useGame()
  const hasXPBooks = ALL_XP_BOOK_IDS.some(id => (xpBooks[id] ?? 0) > 0)

  // Progresso da Rota de Runas — lido do armazenamento a cada abertura do painel
  const [unlockedRunes, setUnlockedRunes] = useState<string[]>([])
  useEffect(() => {
    const sync = () => setUnlockedRunes(loadUnlockedRunes()[master.id] ?? [])
    sync()
    window.addEventListener("gpgame_runes_changed", sync)
    return () => window.removeEventListener("gpgame_runes_changed", sync)
  }, [master.id])
  const runeProgress = getRuneProgress(master, unlockedRunes)
  const claimable = master.rewards.filter(r => r.level <= master.currentLevel && !r.claimed)
  const nextRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Scroll the trail to current progression point
    const t = setTimeout(() => {
      nextRef.current?.scrollIntoView({ block:"center", behavior:"smooth" })
    }, 150)
    return () => clearTimeout(t)
  }, [])

  const claimedCount = master.rewards.filter(r => r.claimed).length

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      background:"rgba(2,1,4,0.94)", backdropFilter:"blur(22px)",
      display:"flex", overflow:"hidden", animation:"gpFadeIn 0.25s ease",
    }}>
      {/* Left panel — art + identity */}
      <div className="gp-detail-left" style={{
        width:340, flexShrink:0,
        background:`linear-gradient(170deg,${master.bgColor} 0%,#06040a 100%)`,
        borderRight:`1px solid ${master.accentColor}22`,
        display:"flex", flexDirection:"column", overflow:"hidden",
        position:"relative",
        animation:"gpSlideRight 0.45s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        {/* light shaft */}
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:`linear-gradient(115deg,transparent 30%,${master.accentColor}0e 46%,transparent 62%)`,
        }}/>
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:`radial-gradient(ellipse 85% 55% at 50% 72%,${master.accentColor}16 0%,transparent 70%)`,
        }}/>

        {/* Art */}
        <div style={{ flex:1, display:"flex", alignItems:"flex-end", justifyContent:"center", overflow:"hidden", position:"relative" }}>
          <img
            src={master.artPath || "/placeholder.svg"}
            alt={master.fullName}
            style={{
              maxHeight:"90%", objectFit:"contain", objectPosition:"center bottom",
              position:"relative", zIndex:1,
              filter:`drop-shadow(0 0 44px ${master.accentColor}38)`,
              animation:"gpHeroIn 0.6s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(transparent,rgba(6,4,10,0.98) 84%)",
            padding:"64px 22px 18px", zIndex:2,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
              <div style={{ height:1, width:22, background:`linear-gradient(90deg,transparent,${master.accentColor})` }}/>
              <div style={{
                fontSize:10, fontWeight:800, letterSpacing:"0.24em",
                textTransform:"uppercase", color: master.accentColor,
              }}>{master.element} · {rarityStyle(master.rarity).label}</div>
            </div>
            <div style={{
              fontFamily:SERIF, fontWeight:800, fontSize:26, lineHeight:1.12,
              letterSpacing:"0.01em", color:"#f7f4ee",
              textShadow:`0 2px 26px ${master.accentColor}55`,
            }}>{master.fullName}</div>
            <div style={{ color:"#6d7482", fontSize:12, fontStyle:"italic", marginTop:7, lineHeight:1.55 }}>
              {master.quote}
            </div>
          </div>
        </div>

        {/* XP section */}
        <div style={{ padding:"16px 20px 18px", background:"rgba(0,0,0,0.42)", flexShrink:0, borderTop:`1px solid ${master.accentColor}18`, position:"relative", zIndex:2 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:12 }}>
            <LevelMedallion level={master.currentLevel} color={master.accentColor} size={52}/>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, gap:8 }}>
                <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.16em", color:"#565d6b", textTransform:"uppercase" }}>Experiência</span>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:11, color: master.accentColor, fontWeight:800, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>
                    {master.currentXP} / {master.xpToNext}
                  </span>
                  {hasXPBooks && master.currentLevel < master.maxLevel && (
                    <button onClick={onOpenXPBooks} className="gp-cta" style={{
                      display:"flex", alignItems:"center", gap:5, flexShrink:0,
                      background:"linear-gradient(135deg,rgba(74,222,128,0.18),rgba(74,222,128,0.34))",
                      border:"1px solid rgba(74,222,128,0.5)",
                      clipPath:"polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%)",
                      padding:"5px 11px", cursor:"pointer", color:"#eafff1",
                      fontWeight:900, fontSize:10.5, letterSpacing:"0.04em", textTransform:"uppercase",
                      boxShadow:"0 2px 10px rgba(74,222,128,0.22)",
                    }}>
                      <BookOpen size={11}/> Upar XP
                    </button>
                  )}
                </div>
              </div>
              <XPBar current={master.currentXP} total={master.xpToNext} color={master.accentColor}/>
              <div style={{ fontSize:10, color:"#4b5563", marginTop:5 }}>
                {master.currentLevel >= master.maxLevel
                  ? "Nível máximo alcançado"
                  : `${master.maxLevel - master.currentLevel} níveis até o máximo`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — trail */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column", overflow:"hidden",
        background:"linear-gradient(165deg,#0a0812 0%,#060409 100%)",
      }}>
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", gap:12,
          padding:"14px 22px", borderBottom:"1px solid rgba(255,255,255,0.06)",
          flexShrink:0, background:"rgba(5,4,8,0.6)",
        }}>
          <button onClick={onClose} aria-label="Voltar" className="gp-icon-btn" style={{
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
            borderRadius:10, width:38, height:38, cursor:"pointer", color:"#8b93a1",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
          }}><ArrowLeft size={17}/></button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily:SERIF, fontWeight:800, fontSize:16, color:"#f5f2ec", letterSpacing:"0.03em",
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
            }}>Trilha de Progressão</div>
            <div style={{ fontSize:10, color:"#565d6b", letterSpacing:"0.14em", textTransform:"uppercase", fontWeight:700 }}>
              {claimedCount}/{master.rewards.length} recompensas recebidas
            </div>
          </div>

          {/* Runas — mecânica paralela: gasta Gear Coins + fragmentos do elemento */}
          <button onClick={onOpenRunes} className="gp-cta" style={{
            display:"flex", alignItems:"center", gap:7,
            background:`linear-gradient(135deg,${master.accentColor}22,${master.accentColor}44)`,
            border:`1px solid ${master.accentColor}55`,
            clipPath:"polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
            padding:"9px 15px", cursor:"pointer", color:"#f4f1ea",
            fontWeight:900, fontSize:11.5, letterSpacing:"0.05em", textTransform:"uppercase",
            boxShadow:`0 3px 14px ${master.accentColor}2e`, flexShrink:0,
          }}>
            <Sparkles size={13}/>
            Runas
            <span style={{
              fontSize:10, fontWeight:800, color: master.accentColor,
              background:"rgba(0,0,0,0.32)", padding:"2px 6px",
              fontVariantNumeric:"tabular-nums",
            }}>{runeProgress.done}/{runeProgress.total}</span>
          </button>

          {claimable.length > 0 && (
            <button onClick={onClaimAll} className="gp-cta" style={{
              display:"flex", alignItems:"center", gap:7,
              background:"linear-gradient(135deg,#6d5310,#e8c96d)",
              border:"none", cursor:"pointer",
              color:"#0c0a06", fontWeight:900, fontSize:11.5,
              padding:"9px 16px",
              clipPath:"polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
              boxShadow:"0 3px 16px rgba(232,201,109,0.42)",
              animation:"gpBadgePop 0.3s ease",
              letterSpacing:"0.04em", textTransform:"uppercase",
              position:"relative", overflow:"hidden",
            }}>
              <span aria-hidden="true" style={{
                position:"absolute", top:0, left:"-80%", width:"55%", height:"100%",
                background:"linear-gradient(105deg,transparent,rgba(255,255,255,0.5),transparent)",
                animation:"gpBtnSheen 2.8s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
              <Gift size={13}/>
              Receber Tudo ({claimable.length})
            </button>
          )}

          {!master.isActive ? (
            <button onClick={onActivate} className="gp-cta" style={{
              background:`linear-gradient(135deg,${master.accentColor}30,${master.accentColor}58)`,
              border:`1px solid ${master.accentColor}66`,
              clipPath:"polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
              padding:"10px 20px", cursor:"pointer", color:"#fff",
              fontWeight:900, fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase",
              boxShadow:`0 3px 18px ${master.accentColor}38`,
              textShadow:"0 1px 4px rgba(0,0,0,0.4)",
            }}>
              Definir como Ativo
            </button>
          ) : (
            <div style={{
              display:"flex", alignItems:"center", gap:6,
              background:"rgba(16,185,129,0.10)", border:"1px solid rgba(16,185,129,0.32)",
              clipPath:"polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
              padding:"10px 16px", color:"#34d399",
              fontWeight:800, fontSize:11.5, letterSpacing:"0.04em",
            }}>
              <Check size={13}/> Mestre Ativo
            </div>
          )}
        </div>

        {/* Rewards trail */}
        <div style={{ flex:1, overflowY:"auto", padding:"18px 22px 46px" }}>
          <p style={{ fontSize:12.5, color:"#7b8290", lineHeight:1.7, margin:"0 0 18px" }}>
            {master.description}
          </p>

          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <span style={{
              fontSize:10, fontWeight:800, color:"#6d7482",
              textTransform:"uppercase", letterSpacing:"0.2em",
            }}>Recompensas por Nível</span>
            <div style={{ flex:1, height:1, background:"linear-gradient(90deg,rgba(255,255,255,0.10),transparent)" }}/>
          </div>

          <div style={{ position:"relative" }}>
            {/* timeline spine */}
            <div style={{
              position:"absolute", left:19, top:8, bottom:8, width:2,
              background:`linear-gradient(180deg,${master.accentColor}50,rgba(255,255,255,0.05))`,
            }}/>

            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {master.rewards.map((reward, idx) => {
                const reached     = master.currentLevel >= reward.level
                const canClaim    = reached && !reward.claimed
                const chestId     = elementToChestId(master.element)
                const rColor      = rewardColor(reward.type, CHESTS[chestId].color)
                const label       = rewardDisplayLabel(reward, master.element)
                const isNext      = reward.level === master.currentLevel + 1
                const isMilestone = reward.level % 10 === 0

                return (
                  <div
                    key={reward.level}
                    ref={isNext ? nextRef : undefined}
                    className="gp-trail-row"
                    style={{
                      animation:`gpRowIn 0.4s cubic-bezier(0.22,1,0.36,1) ${Math.min(idx * 0.028, 0.6)}s backwards`,
                      display:"flex", alignItems:"center", gap:13,
                      background: canClaim
                        ? `linear-gradient(90deg,${rColor}10,rgba(255,255,255,0.035))`
                        : isMilestone && !reached
                        ? "rgba(255,255,255,0.028)"
                        : "rgba(255,255,255,0.018)",
                      border: `1px solid ${
                        canClaim ? `${rColor}45` :
                        isNext ? "rgba(255,255,255,0.14)" :
                        isMilestone ? "rgba(255,255,255,0.07)" :
                        "rgba(255,255,255,0.045)"
                      }`,
                      clipPath:"polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                      padding: isMilestone ? "12px 15px" : "9px 15px",
                      opacity: !reached && !isNext ? 0.5 : 1,
                      position:"relative",
                      boxShadow: canClaim ? `0 4px 22px ${rColor}1c` : "none",
                      transition:"all 0.2s",
                    }}>
                    {/* Level node */}
                    <div style={{
                      width:38, height:38, flexShrink:0,
                      background: reached
                        ? `linear-gradient(135deg,${master.accentColor}28,${master.accentColor}48)`
                        : "rgba(10,8,14,0.9)",
                      border:`1.5px solid ${reached ? master.accentColor + "66" : "rgba(255,255,255,0.09)"}`,
                      clipPath: isMilestone
                        ? "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)"
                        : "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontWeight:900, fontSize:12.5, fontFamily:SERIF,
                      position:"relative", zIndex:1,
                      color: reached ? "#f5f2ec" : isNext ? "#9aa1ad" : "#3f4654",
                      boxShadow: reached ? `0 0 14px ${master.accentColor}32` : "none",
                      animation: isNext ? "gpNextNodePulse 2s ease-in-out infinite" : undefined,
                    }}>
                      {reward.level}
                    </div>

                    {/* Reward icon */}
                    <div style={{
                      width: isMilestone ? 44 : 36, height: isMilestone ? 44 : 36, flexShrink:0,
                      background:`radial-gradient(circle,${rColor}16,rgba(0,0,0,0.35))`,
                      border:`1px solid ${rColor}2c`,
                      clipPath:"polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      overflow:"hidden",
                    }}>
                      <img
                        src={rewardIconPath(reward.type, reward.packId, chestId) || "/placeholder.svg"}
                        alt=""
                        style={{ width:"76%", height:"76%", objectFit:"contain" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    </div>

                    {/* Label */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontWeight: isMilestone ? 800 : 700,
                        fontSize: isMilestone ? 13.5 : 12.5,
                        color: reached ? "#f1f0ee" : "#6d7482",
                      }}>
                        {label}
                      </div>
                      {isNext && (
                        <div style={{ fontSize:10, color: master.accentColor, fontWeight:700, marginTop:1 }}>
                          Próxima recompensa
                        </div>
                      )}
                      {isMilestone && !isNext && (
                        <div style={{ fontSize:9.5, color:"#4b5563", letterSpacing:"0.10em", textTransform:"uppercase", fontWeight:700, marginTop:1 }}>
                          Marco de progressão
                        </div>
                      )}
                    </div>

                    {/* State */}
                    {reward.claimed && (
                      <span style={{
                        display:"flex", alignItems:"center", gap:5,
                        fontSize:11, color:"#3f4654", fontWeight:700, flexShrink:0,
                      }}><Check size={13}/> Recebido</span>
                    )}
                    {canClaim && (
                      <button
                        onClick={() => onClaimReward(reward.level)}
                        className="gp-cta"
                        style={{
                          background:`linear-gradient(135deg,${rColor}28,${rColor}55)`,
                          border:`1px solid ${rColor}66`,
                          clipPath:"polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
                          padding:"8px 18px", cursor:"pointer", color:"#fff",
                          fontWeight:900, fontSize:11.5, flexShrink:0,
                          boxShadow:`0 3px 14px ${rColor}32`,
                          textShadow:"0 1px 3px rgba(0,0,0,0.5)",
                          letterSpacing:"0.04em",
                          position:"relative", overflow:"hidden",
                          animation:"gpClaimGlow 2.4s ease-in-out infinite",
                        }}>
                        <span aria-hidden="true" style={{
                          position:"absolute", top:0, left:"-80%", width:"60%", height:"100%",
                          background:"linear-gradient(105deg,transparent,rgba(255,255,255,0.35),transparent)",
                          animation:"gpBtnSheen 2.4s ease-in-out infinite",
                          pointerEvents:"none",
                        }}/>
                        Receber
                      </button>
                    )}
                    {!reached && !canClaim && !isNext && (
                      <Lock size={14} color="#272c36"/>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Level-up overlay ──────���──────────────────────────────────────────────────
function LevelUpOverlay({ master, newLevel, onClose }: {
  master: Master; newLevel: number; onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:500,
      background:"rgba(2,1,4,0.9)", backdropFilter:"blur(14px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      animation:"gpFadeIn 0.3s ease",
    }} onClick={onClose}>
      <div style={{ textAlign:"center", pointerEvents:"none", position:"relative" }}>
        <div style={{
          position:"absolute", left:"50%", top:"38%", transform:"translate(-50%,-50%)",
          width:290, height:290, borderRadius:"50%",
          border:`1px solid ${master.accentColor}38`,
          animation:"gpRingPulse 2s ease-out infinite",
        }}/>
        <div style={{
          position:"absolute", left:"50%", top:"38%", transform:"translate(-50%,-50%)",
          width:290, height:290, borderRadius:"50%",
          border:`1px solid ${master.accentColor}28`,
          animation:"gpRingPulse 2s ease-out 0.7s infinite",
        }}/>
        <div style={{
          position:"absolute", left:"50%", top:"38%", transform:"translate(-50%,-50%)",
          width:200, height:200, borderRadius:"50%",
          background:`radial-gradient(circle,${master.accentColor}26 0%,transparent 70%)`,
          filter:"blur(6px)",
        }}/>
        {/* raios de luz rotativos */}
        <div aria-hidden="true" style={{
          position:"absolute", left:"50%", top:"38%", transform:"translate(-50%,-50%)",
          width:440, height:440, borderRadius:"50%",
          background:`conic-gradient(from 0deg, transparent 0deg, ${master.accentColor}14 12deg, transparent 24deg, transparent 90deg, ${master.accentColor}10 102deg, transparent 114deg, transparent 180deg, ${master.accentColor}14 192deg, transparent 204deg, transparent 270deg, ${master.accentColor}10 282deg, transparent 294deg)`,
          animation:"gpRaysSpin 14s linear infinite",
          maskImage:"radial-gradient(circle, black 20%, transparent 72%)",
          WebkitMaskImage:"radial-gradient(circle, black 20%, transparent 72%)",
        }}/>
        {/* explosão de partículas */}
        {Array.from({ length: 14 }).map((_, i) => {
          const angle = (i / 14) * 360
          const dist  = 120 + (i % 3) * 44
          return (
            <div key={i} aria-hidden="true" style={{
              position:"absolute", left:"50%", top:"38%",
              width: i % 3 === 0 ? 5 : 3, height: i % 3 === 0 ? 5 : 3, borderRadius:"50%",
              background: i % 2 === 0 ? master.accentColor : "#e8c96d",
              boxShadow:`0 0 8px ${i % 2 === 0 ? master.accentColor : "#e8c96d"}`,
              transform:"translate(-50%,-50%)",
              ["--gp-tx" as string]:`${Math.cos(angle * Math.PI / 180) * dist}px`,
              ["--gp-ty" as string]:`${Math.sin(angle * Math.PI / 180) * dist}px`,
              animation:`gpBurst 1.1s cubic-bezier(0.16,1,0.3,1) ${0.12 + (i % 5) * 0.05}s both`,
            }}/>
          )
        })}
        <div style={{ position:"relative", animation:"gpLevelBounce 0.6s cubic-bezier(0.34,1.56,0.64,1)", marginBottom:20 }}>
          <LevelMedallion level={newLevel} color={master.accentColor} size={124}/>
        </div>
        <div style={{
          fontSize:12, fontWeight:800, color: master.accentColor,
          letterSpacing:"0.4em", textTransform:"uppercase", marginBottom:10,
        }}>Nível Alcançado</div>
        <div style={{
          fontFamily:SERIF, fontWeight:800, fontSize:26, color:"#f7f4ee",
          letterSpacing:"0.02em", textShadow:`0 2px 26px ${master.accentColor}70`,
        }}>
          {master.fullName}
        </div>
        <div style={{ margin:"14px auto 0", display:"flex", justifyContent:"center" }}>
          <Ornament color={master.accentColor} width={160}/>
        </div>
        <div style={{ color:"#565d6b", fontSize:11, marginTop:14, letterSpacing:"0.14em", textTransform:"uppercase" }}>
          toque para continuar
        </div>
      </div>
    </div>
  )
}

// ─── Upar XP — slider de quantidade "arraste para aumentar" ───────────────────
function XPBookQuantitySlider({ max, quantity, setQuantity, color }: {
  max: number; quantity: number; setQuantity: (n: number) => void; color: string
}) {
  const pct = max > 0 ? (quantity / max) * 100 : 0
  return (
    <div style={{ position:"relative", height:22, display:"flex", alignItems:"center" }}>
      <div style={{
        position:"absolute", left:0, right:0, top:"50%", transform:"translateY(-50%)", height:8,
        background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.09)",
        borderRadius:6, overflow:"hidden",
      }}>
        <div style={{
          height:"100%", width:`${pct}%`,
          background:`linear-gradient(90deg,${color}55,${color})`,
          boxShadow:`0 0 10px ${color}66`,
          transition:"width 0.12s ease",
        }}/>
      </div>
      <input
        type="range" min={0} max={Math.max(max, 0)} step={1} value={quantity}
        onChange={e => setQuantity(Number.parseInt(e.target.value, 10) || 0)}
        disabled={max <= 0}
        aria-label="Quantidade de Livros de XP a usar"
        style={{
          position:"absolute", inset:0, width:"100%", height:"100%",
          opacity:0, margin:0, cursor: max > 0 ? "pointer" : "default",
        }}
      />
      <div style={{
        position:"absolute", top:"50%", width:16, height:16, borderRadius:"50%",
        background:"#fff", border:`2px solid ${color}`, boxShadow:`0 0 8px ${color}aa`,
        left:`calc(${pct}% - 8px)`, transform:"translateY(-50%)", pointerEvents:"none",
        transition:"left 0.12s ease",
      }}/>
    </div>
  )
}

// ─── Upar XP — mini painel para usar Livros de XP no Mestre selecionado ───────
function XPBookModal({ master, onClose }: { master: Master; onClose: () => void }) {
  const { xpBooks, spendXPBooks } = useGame()
  const ownedBookIds = ALL_XP_BOOK_IDS.filter(id => (xpBooks[id] ?? 0) > 0)
  const [selectedBookId, setSelectedBookId] = useState<XPBookId>(ownedBookIds[0] ?? ALL_XP_BOOK_IDS[0])
  const [quantity, setQuantity] = useState(0)

  const max = xpBooks[selectedBookId] ?? 0
  const book = XP_BOOKS[selectedBookId]

  // Reajusta a quantidade se o jogador trocar de livro (não pode passar do que possui)
  useEffect(() => { setQuantity(q => Math.min(q, max)) }, [selectedBookId, max])

  if (ownedBookIds.length === 0) return null // guarda — o botão só aparece com livros no inventário

  const totalXp = quantity * book.xpAmount

  // Simulação de progressão — mesma regra de grantMasterXPManual, só para prévia
  let simLevel = master.currentLevel
  let simXP = master.currentXP + totalXp
  while (simLevel < master.maxLevel) {
    const needed = xpRequiredForLevel(simLevel)
    if (simXP >= needed) { simXP -= needed; simLevel++ }
    else break
  }
  if (simLevel >= master.maxLevel) { simLevel = master.maxLevel; if (totalXp > 0) simXP = 0 }
  const simXpToNext = xpRequiredForLevel(simLevel)
  const willLevelUp = simLevel > master.currentLevel

  const handleConfirm = () => {
    if (quantity <= 0) return
    const ok = spendXPBooks({ [selectedBookId]: quantity })
    if (!ok) return
    grantMasterXPManual(master.id, totalXp)
    onClose()
  }

  return (
    <div
      style={{
        position:"fixed", inset:0, zIndex:600,
        background:"rgba(2,1,4,0.85)", backdropFilter:"blur(14px)",
        display:"flex", alignItems:"center", justifyContent:"center",
        animation:"gpFadeIn 0.2s ease", padding:16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:"100%", maxWidth:420,
          background:"linear-gradient(170deg,#100c18 0%,#08060c 100%)",
          border:`1px solid ${master.accentColor}30`,
          borderRadius:18, padding:"22px 22px 24px",
          boxShadow:`0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${master.accentColor}14`,
          animation:"gpSlideRight 0.3s cubic-bezier(0.22,1,0.36,1) both",
          position:"relative",
        }}
      >
        <button onClick={onClose} aria-label="Fechar" style={{
          position:"absolute", top:14, right:14, width:30, height:30,
          background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:8, color:"#8b93a1", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}><X size={15}/></button>

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <BookOpen size={18} color="#4ade80"/>
          <h2 style={{ fontFamily:SERIF, fontWeight:800, fontSize:18, color:"#f5f2ec", margin:0 }}>
            Upar XP
          </h2>
        </div>
        <p style={{ fontSize:11.5, color:"#7b8290", margin:"0 0 18px", lineHeight:1.5 }}>
          Use Livros de XP para acelerar a progressão de{" "}
          <strong style={{ color: master.accentColor }}>{master.name}</strong>.
        </p>

        {/* Seleção de livro — só aparece se o jogador tiver os dois tipos */}
        {ownedBookIds.length > 1 && (
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {ownedBookIds.map(id => {
              const b = XP_BOOKS[id]
              const isSel = id === selectedBookId
              return (
                <button
                  key={id}
                  onClick={() => setSelectedBookId(id)}
                  style={{
                    flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                    padding:"10px 8px", borderRadius:10, cursor:"pointer",
                    background: isSel ? `${b.color}22` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSel ? `${b.color}70` : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <img src={b.image || "/placeholder.svg"} alt={b.name} style={{ width:34, height:34, objectFit:"contain" }}/>
                  <span style={{ fontSize:10.5, fontWeight:800, color: isSel ? b.color : "#8b93a1" }}>{b.name}</span>
                  <span style={{ fontSize:9.5, color:"#565d6b" }}>×{xpBooks[id] ?? 0}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Item selecionado */}
        <div style={{
          display:"flex", alignItems:"center", gap:12, marginBottom:16,
          background:`${book.color}12`, border:`1px solid ${book.color}30`,
          borderRadius:12, padding:"10px 14px",
        }}>
          <img
            src={book.image || "/placeholder.svg"}
            alt={book.name}
            style={{ width:42, height:42, objectFit:"contain", filter:`drop-shadow(0 0 8px ${book.color}70)` }}
          />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:13, color:"#f1f0ee" }}>{book.name}</div>
            <div style={{ fontSize:10.5, color:"#7b8290" }}>+{book.xpAmount} XP cada · possui {max}</div>
          </div>
        </div>

        {/* Quantidade — arraste o slider sobre a barra para aumentar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
          <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.14em", color:"#565d6b", textTransform:"uppercase" }}>
            Quantidade
          </span>
          <span style={{ fontSize:13, fontWeight:900, color: book.color, fontVariantNumeric:"tabular-nums" }}>
            {quantity} / {max}
          </span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <button
            onClick={() => setQuantity(q => Math.max(0, q - 1))}
            disabled={quantity <= 0}
            style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
              color: quantity <= 0 ? "#3f4654" : "#f1f0ee", cursor: quantity <= 0 ? "default" : "pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}
          ><Minus size={13}/></button>

          <div style={{ flex:1 }}>
            <XPBookQuantitySlider max={max} quantity={quantity} setQuantity={setQuantity} color={book.color}/>
          </div>

          <button
            onClick={() => setQuantity(q => Math.min(max, q + 1))}
            disabled={quantity >= max}
            style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
              color: quantity >= max ? "#3f4654" : "#f1f0ee", cursor: quantity >= max ? "default" : "pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}
          ><Plus size={13}/></button>
        </div>

        {/* Prévia de XP / nível resultante */}
        <div style={{
          background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:12, padding:"12px 14px", marginTop:14, marginBottom:18,
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.14em", color:"#565d6b", textTransform:"uppercase" }}>
              Prévia
            </span>
            <span style={{ fontSize:11, fontWeight:800, color:"#4ade80" }}>+{totalXp} XP</span>
          </div>
          <XPBar current={simXP} total={simXpToNext} color={master.accentColor}/>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            <span style={{ fontSize:10.5, color:"#7b8290" }}>Nível {master.currentLevel}</span>
            {willLevelUp && (
              <span style={{ fontSize:10.5, fontWeight:800, color:"#e8c96d" }}>→ Nível {simLevel}!</span>
            )}
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button
            onClick={onClose}
            style={{
              flex:1, padding:"11px 0", borderRadius:10, cursor:"pointer",
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
              color:"#8b93a1", fontWeight:800, fontSize:12, letterSpacing:"0.04em", textTransform:"uppercase",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={quantity <= 0}
            style={{
              flex:2, padding:"11px 0", borderRadius:10, cursor: quantity <= 0 ? "default" : "pointer",
              background: quantity <= 0
                ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg,rgba(74,222,128,0.35),rgba(74,222,128,0.55))",
              border: `1px solid ${quantity <= 0 ? "rgba(255,255,255,0.08)" : "rgba(74,222,128,0.65)"}`,
              color: quantity <= 0 ? "#3f4654" : "#eafff1",
              fontWeight:900, fontSize:12.5, letterSpacing:"0.04em", textTransform:"uppercase",
              boxShadow: quantity <= 0 ? "none" : "0 4px 18px rgba(74,222,128,0.3)",
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Activation ceremony ──────────────────────────────────────────────────────
// Falas de cada voz por Mestre. O texto aparece com typewriter cuja duração é
// derivada da duração REAL do áudio (metadata), então a legenda termina junto
// com a fala em vez de usar um tempo fixo.
const ACTIVATION_LINES: Record<string, { winduel: string; introduel: string }> = {
  fehnon: {
    winduel:   "Ah moleque! Essa foi uma vitória e tanto!",
    introduel: "Eu tô louco pra entrar nessa festa!",
  },
  calem: {
    winduel:   "Incrível! Nós conseguimos!",
    introduel: "Com meu poder, eu não tenho o que temer!",
  },
  morgana: {
    winduel:   "Radical! É isso que eu chamo de sinfonia épica!",
    introduel: "Vamos sentir a melodia de batalha!",
  },
  arthur: {
    winduel:   "Hahaha! Veja como um soberano é imponente!",
    introduel: "Tá na hora do Rei se posicionar aqui!",
  },
}

/** 75% de chance de `_voice_4_winduel`, 25% de `_voice_2_introduel`. */
function pickActivationVoice(masterId: string): { src: string; text: string } {
  const key = Math.random() < 0.75 ? "winduel" : "introduel"
  const suffix = key === "winduel" ? "_voice_4_winduel" : "_voice_2_introduel"
  const lines = ACTIVATION_LINES[masterId]
  return {
    src:  `/audio/masters/${masterId}${suffix}.mp3`,
    text: lines ? lines[key] : "",
  }
}

// Timeline (ms) — sigilo se forma, o Mestre entra, a fala dispara no impacto
const ACT_T_SEAL   = 620   // selo/onda de choque
const ACT_T_HERO   = 260   // Mestre surge
const ACT_T_VOICE  = 300   // instante do impacto → voz + legenda começam juntas
const ACT_T_TAIL   = 900   // respiro depois da fala antes de fechar

function ActivationOverlay({ master, onDone }: { master: Master; onDone: () => void }) {
  const [phase, setPhase] = useState<"seal" | "reveal" | "out">("seal")
  const [typed, setTyped] = useState("")

  const voiceRef  = useRef<HTMLAudioElement | null>(null)
  const timersRef = useRef<number[]>([])
  const rafRef    = useRef<number | null>(null)
  const doneRef   = useRef(false)
  // A voz é sorteada UMA vez por montagem — re-renders não trocam a fala
  const voice     = useRef(pickActivationVoice(master.id)).current

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    const a = voiceRef.current
    if (a) {
      try { a.pause(); a.currentTime = 0 } catch { /* ignore */ }
      voiceRef.current = null
    }
    onDone()
  }

  const closeOut = () => {
    if (doneRef.current) return
    setPhase("out")
    timersRef.current.push(window.setTimeout(finish, 340))
  }

  useEffect(() => {
    timersRef.current.push(window.setTimeout(() => setPhase("reveal"), ACT_T_SEAL))

    const audio = new Audio(voice.src)
    audio.volume = getSfxVolume()
    audio.muted  = getMenuMusicMuted()
    audio.preload = "auto"
    voiceRef.current = audio

    // Legenda escrita em sincronia com o tempo REAL do áudio: a cada frame o
    // progresso da fala (currentTime / duration) define quantos caracteres
    // estão visíveis, então voz e texto nunca desencontram.
    const startTyping = () => {
      const full = voice.text
      if (!full) return
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 2.6
      // A fala ocupa ~88% do áudio; o resto costuma ser cauda/silêncio
      const speech = dur * 0.88
      const t0 = performance.now()
      const tick = () => {
        const elapsed = audio.currentTime > 0
          ? audio.currentTime
          : (performance.now() - t0) / 1000
        const ratio = Math.min(1, elapsed / speech)
        setTyped(full.slice(0, Math.ceil(full.length * ratio)))
        if (ratio < 1 && !doneRef.current) rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    // Voz e legenda começam no MESMO instante do impacto visual
    timersRef.current.push(window.setTimeout(() => {
      audio.play().then(startTyping).catch(() => {
        // autoplay bloqueado — a legenda ainda roda no tempo estimado
        startTyping()
      })
    }, ACT_T_SEAL + ACT_T_VOICE))

    // Fecha quando a fala termina (ou num fallback, se o áudio não carregar)
    const onEnded = () => timersRef.current.push(window.setTimeout(closeOut, ACT_T_TAIL))
    audio.addEventListener("ended", onEnded)

    const fallback = window.setTimeout(closeOut, 6200)
    timersRef.current.push(fallback)

    return () => {
      doneRef.current = true
      audio.removeEventListener("ended", onEnded)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      try { audio.pause() } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [master.id])

  const revealed = phase !== "seal"

  return (
    <div
      role="presentation"
      onClick={closeOut}
      style={{
        position:"fixed", inset:0, zIndex:600, overflow:"hidden", cursor:"pointer",
        background:"radial-gradient(ellipse 90% 80% at 50% 55%, rgba(4,2,8,0.93), rgba(1,0,3,0.985))",
        backdropFilter:"blur(18px)",
        animation: phase === "out" ? "gpActFadeOut 0.34s ease forwards" : "gpFadeIn 0.22s ease",
      }}>

      {/* Onda de choque do selo */}
      {[0, 0.16, 0.32].map((d, i) => (
        <div key={i} aria-hidden="true" style={{
          position:"absolute", left:"50%", top:"50%", width:300, height:300,
          marginLeft:-150, marginTop:-150, borderRadius:"50%",
          border:`1.5px solid ${master.accentColor}${i === 0 ? "70" : "38"}`,
          animation:`gpActShock 1.5s cubic-bezier(0.16,1,0.3,1) ${d}s both`,
        }}/>
      ))}

      {/* Selo hexagonal girando */}
      <div aria-hidden="true" style={{
        position:"absolute", left:"50%", top:"50%", width:420, height:420,
        marginLeft:-210, marginTop:-210,
        animation:"gpActSealIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
      }}>
        <div style={{
          position:"absolute", inset:0, borderRadius:"50%",
          border:`1px dashed ${master.accentColor}2e`,
          animation:"gpAuraSpin 18s linear infinite",
        }}/>
        <div style={{
          position:"absolute", inset:44, borderRadius:"50%",
          border:`1px solid ${master.accentColor}22`,
          animation:"gpAuraSpinReverse 24s linear infinite",
        }}/>
        <div style={{
          position:"absolute", inset:0,
          background:`conic-gradient(from 0deg, transparent 0deg, ${master.accentColor}1a 14deg, transparent 30deg, transparent 120deg, ${master.accentColor}14 134deg, transparent 150deg, transparent 240deg, ${master.accentColor}1a 254deg, transparent 270deg)`,
          maskImage:"radial-gradient(circle, transparent 30%, black 52%, transparent 76%)",
          WebkitMaskImage:"radial-gradient(circle, transparent 30%, black 52%, transparent 76%)",
          animation:"gpRaysSpin 11s linear infinite",
        }}/>
      </div>

      {/* Explosão de partículas no impacto */}
      {revealed && Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * 360
        const dist  = 150 + (i % 4) * 52
        const c     = i % 3 === 0 ? "#e8c96d" : master.accentColor
        return (
          <div key={i} aria-hidden="true" style={{
            position:"absolute", left:"50%", top:"50%",
            width: i % 4 === 0 ? 5 : 3, height: i % 4 === 0 ? 5 : 3, borderRadius:"50%",
            background: c, boxShadow:`0 0 9px ${c}`,
            transform:"translate(-50%,-50%)",
            ["--gp-tx" as string]:`${Math.cos(angle * Math.PI / 180) * dist}px`,
            ["--gp-ty" as string]:`${Math.sin(angle * Math.PI / 180) * dist}px`,
            animation:`gpBurst 1.2s cubic-bezier(0.16,1,0.3,1) ${(i % 6) * 0.045}s both`,
          }}/>
        )
      })}

      {/* Varredura de luz */}
      {revealed && (
        <div aria-hidden="true" style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:`linear-gradient(105deg, transparent 34%, ${master.accentColor}1f 50%, transparent 66%)`,
          animation:"gpActSweep 1.1s cubic-bezier(0.22,1,0.36,1) both",
        }}/>
      )}

      {/* Conteúdo */}
      <div style={{
        position:"relative", zIndex:2, height:"100%",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        gap:0, padding:"24px", textAlign:"center", pointerEvents:"none",
      }}>
        {/* Arte do Mestre */}
        <div style={{
          position:"relative", height:"min(46vh, 330px)",
          display:"flex", alignItems:"flex-end", justifyContent:"center",
          opacity: revealed ? 1 : 0,
          animation: revealed ? `gpActHeroIn 0.66s cubic-bezier(0.16,1,0.3,1) ${ACT_T_HERO / 1000}s both` : undefined,
        }}>
          <div style={{
            position:"absolute", left:"50%", bottom:"6%", transform:"translateX(-50%)",
            width:"min(62vw, 380px)", aspectRatio:"1", borderRadius:"50%",
            background:`radial-gradient(circle, ${master.accentColor}2a 0%, transparent 66%)`,
            filter:"blur(4px)",
          }}/>
          <img
            src={master.artPath || "/placeholder.svg"}
            alt={master.fullName}
            style={{
              maxHeight:"100%", objectFit:"contain", objectPosition:"center bottom",
              position:"relative", zIndex:1,
              filter:`drop-shadow(0 12px 46px ${master.accentColor}55)`,
            }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        </div>

        {/* Faixa de título */}
        <div style={{
          marginTop:22,
          opacity: revealed ? 1 : 0,
          animation: revealed ? "gpRiseIn 0.5s ease 0.4s both" : undefined,
        }}>
          <div style={{
            fontSize:10.5, fontWeight:800, letterSpacing:"0.42em", textTransform:"uppercase",
            color: master.accentColor, marginBottom:10,
            textShadow:`0 0 20px ${master.accentColor}80`,
          }}>Novo Mestre Ativo</div>
          <div style={{
            fontFamily:SERIF, fontWeight:800, fontSize:"clamp(30px, 5.4vw, 52px)",
            lineHeight:1.06, letterSpacing:"0.01em", color:"#f7f4ee",
            textShadow:`0 2px 40px ${master.accentColor}70`,
            animation: revealed ? "gpActNameSlam 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.38s both" : undefined,
          }}>{master.fullName}</div>
          <div style={{ margin:"14px auto 0", display:"flex", justifyContent:"center" }}>
            <Ornament color={master.accentColor} width={190}/>
          </div>
          <div style={{
            marginTop:12, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          }}>
            <span style={{
              fontSize:9.5, fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase",
              color: elementStyle(master.element).color,
              background: elementStyle(master.element).bg,
              padding:"4px 11px", border:`1px solid ${elementStyle(master.element).color}35`,
              clipPath:"polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
            }}>{master.element}</span>
            <span style={{
              fontSize:9.5, fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase",
              color:"#34d399", background:"rgba(52,211,153,0.10)",
              padding:"4px 11px", border:"1px solid rgba(52,211,153,0.32)",
              clipPath:"polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
              display:"inline-flex", alignItems:"center", gap:4,
            }}><Check size={10}/> Ativo</span>
          </div>
        </div>

        {/* Legenda da fala — sincronizada ao áudio */}
        <div style={{ minHeight:52, marginTop:20, display:"flex", alignItems:"center" }}>
          {typed && (
            <div style={{
              maxWidth:560,
              background:"rgba(4,3,8,0.7)",
              border:`1px solid ${master.accentColor}30`,
              clipPath:"polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
              padding:"12px 20px",
              fontSize:14, lineHeight:1.55, color:"#e9e6df", fontStyle:"italic",
              textShadow:`0 0 18px ${master.accentColor}30`,
              animation:"gpFadeIn 0.2s ease",
            }}>
              {typed}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Mini master card for menu bar ───────────────────────────────────────────
export function MasterMenuCard({ onOpen }: { onOpen: () => void }) {
  const [masters, setMasters] = useState<Master[]>([])

  useEffect(() => {
    setMasters(loadMastersFromStorage())
  }, [])

  const active = masters.find(m => m.isActive)
  if (!active) return null

  const pct = active.xpToNext > 0
    ? Math.min(100, (active.currentXP / active.xpToNext) * 100) : 100

  return (
    <button onClick={onOpen} style={{
      display:"flex", alignItems:"center", gap:10,
      background:"rgba(0,0,0,0.55)", backdropFilter:"blur(10px)",
      border:`1px solid ${active.accentColor}40`,
      borderRadius:50, padding:"6px 14px 6px 6px",
      cursor:"pointer", boxShadow:`0 4px 16px rgba(0,0,0,0.4)`,
      transition:"all 0.2s",
    }}>
      <div style={{
        width:40, height:40, borderRadius:"50%", overflow:"hidden",
        border:`2px solid ${active.accentColor}`,
        background:`radial-gradient(circle,${active.bgColor},#08060a)`,
        flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <img src={active.iconPath || "/placeholder.svg"} alt={active.name}
          style={{ width:"100%", height:"100%", objectFit:"cover" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
          <span style={{ fontWeight:800, fontSize:13, color:"#f1f0ee", lineHeight:1 }}>
            {active.name}
          </span>
          <span style={{ fontSize:10, color: active.accentColor, fontWeight:700 }}>
            Lv.{active.currentLevel}
          </span>
        </div>
        <div style={{ width:100, height:5, borderRadius:99, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
          <div style={{
            height:"100%", borderRadius:99, width:`${pct}%`,
            background:`linear-gradient(90deg,${active.accentColor}70,${active.accentColor})`,
          }}/>
        </div>
      </div>
      <span style={{ fontSize:12, color:`${active.accentColor}80`, marginLeft:2 }}>▼</span>
    </button>
  )
}

// ─── XP sources data ──────────────────────────────────────────────────────────
const XP_SOURCES = [
  { Icon: Swords, name:"Duelo PvE",  xp:"+50–100" },
  { Icon: Trophy, name:"Duelo PvP",  xp:"+80–140" },
  { Icon: Skull,  name:"Chefão",     xp:"+120–180" },
  { Icon: Flag,   name:"Guerra",     xp:"+100–160" },
  { Icon: Layers, name:"Draft",      xp:"+70–120" },
  { Icon: Target, name:"Missões",    xp:"+30–80" },
]

// ─── MAIN MasterScreen ────────────────────────────────────────────────────────
export default function MasterScreen({ onBack }: MasterScreenProps) {
  const { coins, setCoins, setGearCoins, addChests, addSkipTickets, addStaminaBottles, xpBooks } = useGame()

  const [masters,      setMasters]      = useState<Master[]>([])
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [showDetail,   setShowDetail]   = useState(false)
  const [runesMaster,  setRunesMaster]  = useState<Master | null>(null)
  const [xpBooksMaster, setXpBooksMaster] = useState<Master | null>(null)
  const [levelUpData,  setLevelUpData]  = useState<{ master: Master; newLevel: number } | null>(null)
  const [toast,        setToast]        = useState<string | null>(null)
  const [packToOpen,   setPackToOpen]   = useState<string | null>(null)
  const [heroKey,      setHeroKey]      = useState(0)
  const [activating,   setActivating]   = useState<Master | null>(null)

  useEffect(() => {
    const loaded = loadMastersFromStorage()
    setMasters(loaded)
    const active = loaded.find(m => m.isActive)
    if (active) setSelectedId(active.id)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const selectedMaster = masters.find(m => m.id === selectedId) ?? null

  const selectMaster = (id: string) => {
    if (id === selectedId) { setShowDetail(true); return }
    setSelectedId(id)
    setHeroKey(k => k + 1)
  }

  // Sincroniza com XP ganho em duelos (grantMasterDuelXP) OU com Livros de XP
  // usados manualmente (grantMasterXPManual) — este último pode alvejar um
  // Mestre que não é o ativo, por isso preferimos o masterId do evento.
  useEffect(() => {
    const onXP = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        { masterId?: string; leveledUp?: boolean; newLevel?: number } | undefined
      const reloaded = loadMastersFromStorage()
      setMasters(reloaded)
      if (detail?.leveledUp) {
        const target = detail.masterId
          ? reloaded.find(m => m.id === detail.masterId)
          : reloaded.find(m => m.isActive)
        if (target) setLevelUpData({ master: target, newLevel: detail.newLevel ?? target.currentLevel })
      }
    }
    window.addEventListener("gpgame_master_xp", onXP)
    return () => window.removeEventListener("gpgame_master_xp", onXP)
  }, [])

  // Activate a master — troca o ativo e dispara a cerimônia (animação + voz)
  const handleActivate = (masterId: string) => {
    const target = masters.find(m => m.id === masterId)
    if (!target || target.isActive) return

    setMasters(prev => {
      const next = prev.map(m => ({ ...m, isActive: m.id === masterId }))
      saveMastersToStorage(next)
      return next
    })
    setShowDetail(false)
    setSelectedId(masterId)
    // A cerimônia sobe no MESMO instante da troca — a voz começa com ela
    setActivating({ ...target, isActive: true })
  }

  // Claim a reward — grants actual items to the player
  const handleClaimReward = (masterId: string, level: number) => {
    const master = masters.find(m => m.id === masterId)
    const reward = master?.rewards.find(r => r.level === level)
    if (!reward || reward.claimed) return

    // Mark as claimed in storage
    setMasters(prev => {
      const next = prev.map(m => {
        if (m.id !== masterId) return m
        return { ...m, rewards: m.rewards.map(r => r.level === level ? { ...r, claimed: true } : r) }
      })
      saveMastersToStorage(next)
      return next
    })

    // ── Actually grant the reward ──────────────────────────────────────────
    if (reward.type === "gear_coins" && reward.amount) {
      setGearCoins(prev => prev + reward.amount!)
      showToast(`+${reward.amount} Gear Coins adicionados!`)

    } else if (reward.type === "gacha_coins" && reward.amount) {
      const newTotal = coins + reward.amount
      setCoins(newTotal)
      try { localStorage.setItem("gearperks-coins", String(newTotal)) } catch {}
      showToast(`+${reward.amount} Gacha Coins adicionados!`)

    } else if (reward.type === "pack" && reward.packId) {
      // Full pack opening animation — overlay handles drawing & collection
      setPackToOpen(reward.packId!)

    } else if (reward.type === "chest" && reward.amount && master) {
      // O baú concedido casa com o elemento do próprio Mestre —
      // Fehnon (Aquos) dá Baú de Aquos, Calem (Vazio) dá Baú do Vazio, etc.
      const chestId = elementToChestId(master.element)
      addChests({ [chestId]: reward.amount })
      showToast(`+${reward.amount} ${CHESTS[chestId].name}${reward.amount > 1 ? "s" : ""} no inventário!`)

    } else if (reward.type === "skip_ticket" && reward.amount) {
      addSkipTickets(reward.amount)
      showToast(`+${reward.amount} Skip Tíquetes adicionados!`)

    } else if (reward.type === "stamina_bottle" && reward.amount) {
      addStaminaBottles(reward.amount)
      showToast(`+${reward.amount} Garrafas de Stamina adicionadas!`)

    } else if (reward.type === "card_skin") {
      unlockCardSkin(masterId, level)
      showToast(`${reward.label} desbloqueada!`)

    } else {
      showToast(`${reward.label} recebido!`)
    }
  }

  // Unlock card skin — use exact skinId that deck-builder expects
  const unlockCardSkin = (masterId: string, level: number) => {
    try {
      const raw = localStorage.getItem("gpgame_card_skins") ?? "[]"
      const skins: string[] = JSON.parse(raw)
      const skinIdMap: Record<string, Record<number, string>> = {
        fehnon:  { 40: "fehnon_skin_lv50",  50: "fehnon_skin_lv50"  },
        morgana: { 40: "morgana_skin_lv50", 50: "morgana_skin_lv50" },
        calem:   { 40: "calem_skin_lv50",   50: "calem_skin_lv50"   },
      }
      const skinId = skinIdMap[masterId]?.[level] ?? `master_${masterId}_lv${level}`
      if (!skins.includes(skinId)) skins.push(skinId)
      localStorage.setItem("gpgame_card_skins", JSON.stringify(skins))
      window.dispatchEvent(new CustomEvent("gpgame_skin_unlocked", { detail: { skinId } }))
    } catch {}
  }

  // Resgata todas as recompensas disponíveis de uma vez.
  // Packs têm animação de abertura própria — o primeiro é aberto agora,
  // os demais permanecem na trilha para serem abertos individualmente.
  const handleClaimAll = (masterId: string) => {
    const master = masters.find(m => m.id === masterId)
    if (!master) return
    const claimable = master.rewards.filter(r => r.level <= master.currentLevel && !r.claimed)
    if (claimable.length === 0) return

    const nonPack   = claimable.filter(r => r.type !== "pack")
    const firstPack = claimable.find(r => r.type === "pack")

    let gear = 0, gacha = 0, chestCount = 0, skips = 0, bottles = 0
    const claimedLevels: number[] = []

    nonPack.forEach(r => {
      claimedLevels.push(r.level)
      if      (r.type === "gear_coins"     && r.amount) gear       += r.amount
      else if (r.type === "gacha_coins"    && r.amount) gacha      += r.amount
      else if (r.type === "chest"          && r.amount) chestCount += r.amount
      else if (r.type === "skip_ticket"    && r.amount) skips      += r.amount
      else if (r.type === "stamina_bottle" && r.amount) bottles    += r.amount
      else if (r.type === "card_skin") unlockCardSkin(masterId, r.level)
    })

    if (gear)       setGearCoins(prev => prev + gear)
    if (gacha) {
      const newTotal = coins + gacha
      setCoins(newTotal)
      try { localStorage.setItem("gearperks-coins", String(newTotal)) } catch {}
    }
    if (chestCount) addChests({ [elementToChestId(master.element)]: chestCount })
    if (skips)      addSkipTickets(skips)
    if (bottles)    addStaminaBottles(bottles)

    if (firstPack?.packId) {
      claimedLevels.push(firstPack.level)
      setPackToOpen(firstPack.packId)
    }

    setMasters(prev => {
      const next = prev.map(m => {
        if (m.id !== masterId) return m
        return { ...m, rewards: m.rewards.map(r => claimedLevels.includes(r.level) ? { ...r, claimed: true } : r) }
      })
      saveMastersToStorage(next)
      return next
    })

    const remainingPacks = claimable.filter(r => r.type === "pack").length - (firstPack ? 1 : 0)
    showToast(remainingPacks > 0
      ? `${claimedLevels.length} recompensas recebidas! ${remainingPacks} pack${remainingPacks > 1 ? "s" : ""} aguardando abertura.`
      : `${claimedLevels.length} recompensa${claimedLevels.length > 1 ? "s" : ""} recebida${claimedLevels.length > 1 ? "s" : ""}!`)
  }

  const el  = selectedMaster ? elementStyle(selectedMaster.element) : null
  const rar = selectedMaster ? rarityStyle(selectedMaster.rarity)   : null
  const claimableCount = selectedMaster
    ? selectedMaster.rewards.filter(r => r.level <= selectedMaster.currentLevel && !r.claimed).length
    : 0

  return (
    <div style={{
      height:"100vh", background:"linear-gradient(170deg,#0a0712 0%,#060409 55%,#090612 100%)",
      color:"#f1f0ee", fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex", flexDirection:"column", position:"relative", overflow:"hidden",
    }}>
      {/* ── Ambient atmosphere ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0 }}>
        {/* master-tinted stage glow */}
        {selectedMaster && (
          <div key={`glow-${heroKey}`} style={{
            position:"absolute", inset:0,
            background:`radial-gradient(ellipse 70% 85% at 74% 55%, ${selectedMaster.accentColor}12 0%, transparent 60%)`,
            transition:"background 0.8s ease", animation:"gpFadeIn 0.8s ease",
          }}/>
        )}
        <div style={{ position:"absolute", width:640, height:640, borderRadius:"50%", top:-260, left:-160, background:"radial-gradient(circle,rgba(88,28,220,0.08) 0%,transparent 70%)", filter:"blur(44px)" }}/>
        {/* diagonal light shafts */}
        <div style={{
          position:"absolute", inset:0, opacity:0.5,
          background:"linear-gradient(112deg,transparent 42%,rgba(232,201,109,0.028) 50%,transparent 58%), linear-gradient(112deg,transparent 62%,rgba(255,255,255,0.015) 70%,transparent 78%)",
        }}/>
        {/* fine grid */}
        <div style={{
          position:"absolute", inset:0, opacity:0.3,
          backgroundImage:"linear-gradient(rgba(255,255,255,0.014) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.014) 1px,transparent 1px)",
          backgroundSize:"56px 56px",
          maskImage:"radial-gradient(ellipse 90% 70% at 50% 30%,black,transparent)",
          WebkitMaskImage:"radial-gradient(ellipse 90% 70% at 50% 30%,black,transparent)",
        }}/>
        {/* floating embers — tinted by the selected master's element */}
        {[
          { l:"12%", d:"0s",   s:3 }, { l:"28%", d:"3.5s", s:2 }, { l:"46%", d:"1.8s", s:2.5 },
          { l:"64%", d:"5s",   s:2 }, { l:"81%", d:"2.6s", s:3 }, { l:"92%", d:"4.2s", s:2 },
          { l:"37%", d:"6.4s", s:2 }, { l:"73%", d:"7.8s", s:2.5 },
        ].map((p, i) => {
          const tint = i % 2 === 0 && selectedMaster ? selectedMaster.accentColor : "#e8c96d"
          return (
            <div key={i} style={{
              position:"absolute", left:p.l, bottom:-8, width:p.s, height:p.s, borderRadius:"50%",
              background:`${tint}90`, boxShadow:`0 0 6px ${tint}cc`,
              animation:`gpEmber ${9 + i * 1.6}s linear ${p.d} infinite`,
              transition:"background 0.8s, box-shadow 0.8s",
            }}/>
          )
        })}
        {/* cinematic vignette */}
        <div style={{
          position:"absolute", inset:0,
          background:"radial-gradient(ellipse 120% 100% at 50% 45%, transparent 55%, rgba(2,1,4,0.55) 100%)",
        }}/>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", zIndex:9999,
          display:"flex", alignItems:"center", gap:8,
          background:"rgba(12,10,6,0.96)", border:"1px solid rgba(232,201,109,0.35)",
          borderRadius:11, padding:"10px 20px", color:"#e8c96d", fontWeight:700, fontSize:13,
          backdropFilter:"blur(16px)", boxShadow:"0 6px 28px rgba(0,0,0,0.55)",
          whiteSpace:"nowrap", animation:"gpToastIn 0.25s ease",
        }}>
          <Check size={14}/>
          {toast}
        </div>
      )}

      {/* Pack opening animation */}
      {packToOpen && (
        <PackOpeningOverlay
          packId={packToOpen}
          onClose={() => setPackToOpen(null)}
        />
      )}

      {levelUpData && (
        <LevelUpOverlay
          master={levelUpData.master}
          newLevel={levelUpData.newLevel}
          onClose={() => setLevelUpData(null)}
        />
      )}

      {/* Cerimônia de troca de Mestre */}
      {activating && (
        <ActivationOverlay
          key={activating.id}
          master={activating}
          onDone={() => {
            setActivating(null)
            setHeroKey(k => k + 1)
            showToast("Mestre alterado com sucesso!")
          }}
        />
      )}

      {/* Detail overlay */}
      {showDetail && selectedMaster && (
        <MasterDetail
          master={selectedMaster}
          onActivate={() => handleActivate(selectedMaster.id)}
          onClose={() => setShowDetail(false)}
          onClaimReward={level => handleClaimReward(selectedMaster.id, level)}
          onClaimAll={() => handleClaimAll(selectedMaster.id)}
          onOpenRunes={() => setRunesMaster(selectedMaster)}
          onOpenXPBooks={() => setXpBooksMaster(selectedMaster)}
        />
      )}

      {/* Rota de Runas do Mestre */}
      {runesMaster && (
        <RunesPanel
          master={runesMaster}
          onClose={() => setRunesMaster(null)}
        />
      )}

      {/* Upar XP — mini painel para usar Livros de XP no Mestre selecionado */}
      {xpBooksMaster && (
        <XPBookModal
          master={xpBooksMaster}
          onClose={() => setXpBooksMaster(null)}
        />
      )}

      {/* ── Header ── */}
      <header style={{
        display:"flex", alignItems:"center", gap:14, padding:"12px 20px",
        borderBottom:"1px solid rgba(232,201,109,0.10)",
        position:"relative", zIndex:50, flexShrink:0,
        background:"rgba(7,5,10,0.7)", backdropFilter:"blur(18px)",
      }}>
        <button onClick={onBack} aria-label="Voltar" className="gp-icon-btn" style={{
          background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
          borderRadius:10, width:38, height:38, cursor:"pointer", color:"#8b93a1",
          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
        }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ display:"flex", alignItems:"baseline", gap:14, flex:1, minWidth:0 }}>
          <h1 style={{
            fontFamily:SERIF, fontWeight:800, fontSize:20, margin:0, letterSpacing:"0.14em",
            color:"#f5f2ec", textTransform:"uppercase", whiteSpace:"nowrap",
            textShadow:"0 0 24px rgba(232,201,109,0.25)",
          }}>Salão dos Mestres</h1>
          <Ornament width={90}/>
          <p style={{
            color:"#565d6b", fontSize:11, margin:0, whiteSpace:"nowrap",
            overflow:"hidden", textOverflow:"ellipsis",
          }}>Escolha seu parceiro de batalha e evolua junto com ele</p>
        </div>
      </header>

      {/* ── Hero stage ── */}
      <div style={{ flex:1, position:"relative", zIndex:1, minHeight:0, display:"flex", flexDirection:"column" }}>
        {selectedMaster && (
          <div key={heroKey} style={{ flex:1, position:"relative", minHeight:0, overflow:"hidden" }}>

            {/* Giant ghost nameplate behind art */}
            <div aria-hidden="true" style={{
              position:"absolute", right:"-2%", top:"50%", transform:"translateY(-50%)",
              fontFamily:SERIF, fontWeight:800, fontSize:"clamp(90px, 17vw, 190px)",
              letterSpacing:"0.02em", lineHeight:0.9, whiteSpace:"nowrap",
              color:"transparent",
              WebkitTextStroke:`1px ${selectedMaster.accentColor}20`,
              userSelect:"none", pointerEvents:"none",
              animation:"gpGhostIn 0.9s ease both",
            }}>
              {selectedMaster.name.toUpperCase()}
            </div>

            {/* Slow-breathing aura behind the master */}
            <div aria-hidden="true" style={{
              position:"absolute", right:"8%", top:"50%", transform:"translateY(-46%)",
              width:"min(44vw, 420px)", aspectRatio:"1", zIndex:1, pointerEvents:"none",
              background:`radial-gradient(circle, ${selectedMaster.accentColor}1c 0%, transparent 62%)`,
              animation:"gpAuraBreathe 5s ease-in-out infinite",
            }}/>
            <div aria-hidden="true" style={{
              position:"absolute", right:"10%", top:"50%", transform:"translateY(-46%)",
              width:"min(38vw, 360px)", aspectRatio:"1", zIndex:1, pointerEvents:"none",
              borderRadius:"50%", border:`1px solid ${selectedMaster.accentColor}1e`,
              maskImage:"linear-gradient(180deg, black 40%, transparent 78%)",
              WebkitMaskImage:"linear-gradient(180deg, black 40%, transparent 78%)",
              animation:"gpAuraSpin 26s linear infinite",
            }}>
              <div style={{
                position:"absolute", top:-2, left:"50%", width:4, height:4, borderRadius:"50%",
                background: selectedMaster.accentColor, boxShadow:`0 0 10px ${selectedMaster.accentColor}`,
              }}/>
              <div style={{
                position:"absolute", bottom:"12%", right:"4%", width:3, height:3, borderRadius:"50%",
                background:`${selectedMaster.accentColor}cc`, boxShadow:`0 0 8px ${selectedMaster.accentColor}`,
              }}/>
            </div>
            {/* anel contra-rotativo externo, tracejado */}
            <div aria-hidden="true" style={{
              position:"absolute", right:"6.5%", top:"50%", transform:"translateY(-46%)",
              width:"min(44vw, 420px)", aspectRatio:"1", zIndex:1, pointerEvents:"none",
              borderRadius:"50%", border:`1px dashed ${selectedMaster.accentColor}16`,
              maskImage:"linear-gradient(180deg, black 32%, transparent 72%)",
              WebkitMaskImage:"linear-gradient(180deg, black 32%, transparent 72%)",
              animation:"gpAuraSpinReverse 40s linear infinite",
            }}>
              <div style={{
                position:"absolute", top:"8%", right:"12%", width:3, height:3, borderRadius:"50%",
                background:`${selectedMaster.accentColor}aa`, boxShadow:`0 0 8px ${selectedMaster.accentColor}99`,
              }}/>
            </div>

            {/* Master art — right side (entrada + flutuação idle) */}
            <div style={{
              position:"absolute", right:"4%", bottom:0, height:"96%",
              maxWidth:"52%", width:"52%", zIndex:2, pointerEvents:"none",
              display:"flex", alignItems:"flex-end", justifyContent:"flex-end",
              animation:"gpHeroIn 0.7s cubic-bezier(0.22,1,0.36,1) both",
            }}>
              <img
                src={selectedMaster.artPath || "/placeholder.svg"}
                alt={selectedMaster.fullName}
                style={{
                  height:"100%", maxWidth:"100%", objectFit:"contain", objectPosition:"right bottom",
                  filter:`drop-shadow(0 0 50px ${selectedMaster.accentColor}45) drop-shadow(0 18px 30px rgba(0,0,0,0.6))`,
                  animation:"gpHeroFloat 6.5s ease-in-out 0.9s infinite",
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            </div>

            {/* Varredura de luz cinematográfica na troca de Mestre */}
            <div aria-hidden="true" key={`sweep-${heroKey}`} style={{
              position:"absolute", inset:0, zIndex:4, pointerEvents:"none",
              background:`linear-gradient(105deg, transparent 30%, ${selectedMaster.accentColor}14 46%, rgba(255,255,255,0.10) 50%, ${selectedMaster.accentColor}14 54%, transparent 70%)`,
              transform:"translateX(-120%)",
              animation:"gpLightSweep 1.1s cubic-bezier(0.6,0,0.3,1) 0.1s forwards",
            }}/>

            {/* Molduras de canto — HUD */}
            {[
              { top:14, left:16,  bt:true,  bl:true  },
              { top:14, right:16, bt:true,  br:true  },
              { bottom:14, left:16,  bb:true, bl:true },
              { bottom:14, right:16, bb:true, br:true },
            ].map((c, i) => (
              <div key={i} aria-hidden="true" style={{
                position:"absolute", zIndex:3, pointerEvents:"none",
                width:26, height:26,
                top: c.top, bottom: c.bottom, left: c.left, right: c.right,
                borderTop:    c.bt ? `1px solid ${selectedMaster.accentColor}45` : "none",
                borderBottom: c.bb ? `1px solid ${selectedMaster.accentColor}45` : "none",
                borderLeft:   c.bl ? `1px solid ${selectedMaster.accentColor}45` : "none",
                borderRight:  c.br ? `1px solid ${selectedMaster.accentColor}45` : "none",
                transition:"border-color 0.8s ease",
                animation:`gpFadeIn 0.8s ease ${0.2 + i * 0.08}s both`,
              }}/>
            ))}
            {/* stage floor glow beneath the master */}
            <div style={{
              position:"absolute", right:"2%", bottom:-14, width:"46%", height:70, zIndex:1,
              background:`radial-gradient(ellipse 60% 100% at 50% 100%, ${selectedMaster.accentColor}30 0%, transparent 70%)`,
              filter:"blur(10px)", pointerEvents:"none",
              animation:"gpFadeIn 0.9s ease both",
            }}/>

            {/* Info column — left side */}
            <div style={{
              position:"relative", zIndex:3, height:"100%",
              display:"flex", flexDirection:"column", justifyContent:"center",
              padding:"20px 24px 20px 28px", maxWidth:"56%",
            }}>
              {/* badges */}
              <div style={{ display:"flex", gap:8, marginBottom:12, animation:"gpRiseIn 0.5s ease 0.05s both" }}>
                <span style={{
                  fontSize:9.5, fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase",
                  color: el!.color, background: el!.bg,
                  padding:"4px 11px", border:`1px solid ${el!.color}35`,
                  clipPath:"polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
                }}>{selectedMaster.element}</span>
                <span style={{
                  fontSize:9.5, fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase",
                  color: rar!.color, background: rar!.bg,
                  padding:"4px 11px", border:`1px solid ${rar!.color}35`,
                  clipPath:"polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
                }}>{rar!.label}</span>
                {selectedMaster.isActive && (
                  <span style={{
                    display:"flex", alignItems:"center", gap:4,
                    fontSize:9.5, fontWeight:800, letterSpacing:"0.16em", color:"#34d399",
                    background:"rgba(52,211,153,0.10)", padding:"4px 11px",
                    border:"1px solid rgba(52,211,153,0.3)",
                    clipPath:"polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
                  }}><Check size={10}/> ATIVO</span>
                )}
              </div>

              {/* name */}
              <h2 style={{
                fontFamily:SERIF, fontWeight:800, margin:"0 0 4px",
                fontSize:"clamp(28px, 4.6vw, 46px)", lineHeight:1.04, letterSpacing:"0.01em",
                color:"#f7f4ee", textShadow:`0 2px 34px ${selectedMaster.accentColor}60`,
                animation:"gpRiseIn 0.5s ease 0.1s both",
              }}>
                {selectedMaster.fullName}
              </h2>
              <p style={{
                fontSize:12.5, color:"#7b8290", fontStyle:"italic", margin:"6px 0 0",
                maxWidth:420, lineHeight:1.6, animation:"gpRiseIn 0.5s ease 0.16s both",
              }}>
                {selectedMaster.quote}
              </p>

              {/* Description */}
              <p className="gp-hero-desc" style={{
                fontSize:11.5, color:"#5b6270", margin:"10px 0 0",
                maxWidth:400, lineHeight:1.65, animation:"gpRiseIn 0.5s ease 0.19s both",
              }}>
                {selectedMaster.description}
              </p>

              {/* Stats strip */}
              <div style={{
                display:"flex", gap:0, marginTop:18, maxWidth:420,
                border:"1px solid rgba(255,255,255,0.07)",
                background:"rgba(0,0,0,0.32)", backdropFilter:"blur(8px)",
                clipPath:"polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                animation:"gpRiseIn 0.5s ease 0.21s both",
              }}>
                {[
                  { label:"XP Total", value: selectedMaster.totalXP.toLocaleString("pt-BR") },
                  { label:"Recompensas", value: `${selectedMaster.rewards.filter(r => r.claimed).length}/${selectedMaster.rewards.length}` },
                  { label:"Próx. Marco", value: selectedMaster.currentLevel >= selectedMaster.maxLevel
                      ? "MAX"
                      : `NV ${Math.min(Math.ceil((selectedMaster.currentLevel + 1) / 5) * 5, selectedMaster.maxLevel)}` },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    flex:1, padding:"9px 12px", textAlign:"center",
                    borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}>
                    <div style={{
                      fontSize:13.5, fontWeight:900, fontFamily:SERIF, color:"#e9e6df",
                      fontVariantNumeric:"tabular-nums", lineHeight:1.2,
                      textShadow:`0 0 12px ${selectedMaster.accentColor}30`,
                    }}>{s.value}</div>
                    <div style={{
                      fontSize:8.5, fontWeight:800, color:"#565d6b",
                      letterSpacing:"0.16em", textTransform:"uppercase", marginTop:2,
                    }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* XP block */}
              <div style={{
                display:"flex", alignItems:"center", gap:16, marginTop:22,
                animation:"gpRiseIn 0.5s ease 0.22s both",
              }}>
                <LevelMedallion level={selectedMaster.currentLevel} color={selectedMaster.accentColor} size={58}/>
                <div style={{ flex:1, maxWidth:340 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, gap:8 }}>
                    <span style={{ fontSize:9.5, fontWeight:800, letterSpacing:"0.18em", color:"#565d6b", textTransform:"uppercase", flexShrink:0 }}>
                      Experiência
                    </span>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:11, color: selectedMaster.accentColor, fontWeight:800, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>
                        {selectedMaster.currentXP} / {selectedMaster.xpToNext} XP
                      </span>
                      {ALL_XP_BOOK_IDS.some(id => (xpBooks[id] ?? 0) > 0) && selectedMaster.currentLevel < selectedMaster.maxLevel && (
                        <button onClick={() => setXpBooksMaster(selectedMaster)} className="gp-cta" style={{
                          display:"flex", alignItems:"center", gap:5, flexShrink:0,
                          background:"linear-gradient(135deg,rgba(74,222,128,0.18),rgba(74,222,128,0.34))",
                          border:"1px solid rgba(74,222,128,0.5)",
                          clipPath:"polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%)",
                          padding:"5px 11px", cursor:"pointer", color:"#eafff1",
                          fontWeight:900, fontSize:10.5, letterSpacing:"0.04em", textTransform:"uppercase",
                          boxShadow:"0 2px 10px rgba(74,222,128,0.22)",
                        }}>
                          <BookOpen size={11}/> Upar XP
                        </button>
                      )}
                    </div>
                  </div>
                  <XPBar current={selectedMaster.currentXP} total={selectedMaster.xpToNext} color={selectedMaster.accentColor}/>
                  <div style={{ fontSize:10, color:"#4b5563", marginTop:5 }}>
                    {selectedMaster.currentLevel >= selectedMaster.maxLevel
                      ? "Nível máximo alcançado"
                      : `${selectedMaster.maxLevel - selectedMaster.currentLevel} níveis até o máximo`}
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div style={{ display:"flex", gap:10, marginTop:20, animation:"gpRiseIn 0.5s ease 0.28s both" }}>
                <button onClick={() => setShowDetail(true)} className="gp-cta" style={{
                  display:"flex", alignItems:"center", gap:8,
                  background:`linear-gradient(135deg,${selectedMaster.accentColor}30,${selectedMaster.accentColor}58)`,
                  border:`1px solid ${selectedMaster.accentColor}66`,
                  clipPath:"polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)",
                  padding:"12px 24px", cursor:"pointer", color:"#fff",
                  fontWeight:900, fontSize:12.5, letterSpacing:"0.06em", textTransform:"uppercase",
                  boxShadow:`0 4px 22px ${selectedMaster.accentColor}38`,
                  textShadow:"0 1px 4px rgba(0,0,0,0.4)",
                  position:"relative",
                }}>
                  Trilha de Recompensas <ChevronRight size={14}/>
                  {claimableCount > 0 && (
                    <span style={{
                      position:"absolute", top:-8, right:-4,
                      minWidth:20, height:20, borderRadius:"50%", padding:"0 5px",
                      background:"linear-gradient(135deg,#a3742a,#e8c96d)",
                      color:"#0c0a06", fontWeight:900, fontSize:11,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow:"0 0 14px rgba(232,201,109,0.7)",
                      animation:"gpPulseSoft 2s ease-in-out infinite",
                    }}>{claimableCount}</span>
                  )}
          </button>
          <button onClick={() => setRunesMaster(selectedMaster)} className="gp-cta" style={{
            display:"flex", alignItems:"center", gap:8,
            background:"rgba(255,255,255,0.04)",
            border:`1px solid ${selectedMaster.accentColor}44`,
            clipPath:"polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)",
            padding:"12px 22px", cursor:"pointer", color:"#e7e4dd",
            fontWeight:900, fontSize:12.5, letterSpacing:"0.06em", textTransform:"uppercase",
          }}>
            <Sparkles size={14} color={selectedMaster.accentColor}/> Rota de Runas
          </button>
          {!selectedMaster.isActive && (
            <button onClick={() => handleActivate(selectedMaster.id)} className="gp-cta" style={{
                    display:"flex", alignItems:"center", gap:7,
                    background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.14)",
                    clipPath:"polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)",
                    padding:"12px 22px", cursor:"pointer", color:"#c8cdd6",
                    fontWeight:800, fontSize:12.5, letterSpacing:"0.06em", textTransform:"uppercase",
                  }}>
                    <Sparkles size={13}/> Definir como Ativo
                  </button>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ── Bottom dock: selector rail + XP guide ── */}
        <div style={{
          flexShrink:0, position:"relative", zIndex:5,
          borderTop:"1px solid rgba(232,201,109,0.10)",
          background:"linear-gradient(180deg,rgba(7,5,10,0.82),rgba(5,4,8,0.95))",
          backdropFilter:"blur(18px)",
          padding:"14px 24px 16px",
        }}>
          <div style={{ display:"flex", gap:24, alignItems:"stretch", flexWrap:"wrap" }}>
            {/* selector rail */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <span style={{
                  fontSize:9.5, fontWeight:800, color:"#6d7482",
                  textTransform:"uppercase", letterSpacing:"0.22em",
                }}>Mestres</span>
                <div style={{ width:52, height:1, background:"linear-gradient(90deg,rgba(232,201,109,0.4),transparent)" }}/>
              </div>
              <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:2 }}>
                {masters.map(m => (
                  <MasterTile
                    key={m.id}
                    master={m}
                    isSelected={selectedId === m.id}
                    onClick={() => selectMaster(m.id)}
                  />
                ))}
              </div>
            </div>

            {/* XP guide */}
            <div style={{ flex:1, minWidth:260, display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <span style={{
                  fontSize:9.5, fontWeight:800, color:"#6d7482",
                  textTransform:"uppercase", letterSpacing:"0.22em",
                }}>Como ganhar XP</span>
                <div style={{ width:52, height:1, background:"linear-gradient(90deg,rgba(232,201,109,0.4),transparent)" }}/>
              </div>
              <div style={{
                flex:1, display:"grid",
                gridTemplateColumns:"repeat(auto-fit, minmax(118px, 1fr))",
                gap:8, alignContent:"start",
              }}>
                {XP_SOURCES.map(({ Icon, name, xp }) => (
                  <div key={name} className="gp-xp-card" style={{
                    display:"flex", alignItems:"center", gap:9,
                    background:"rgba(255,255,255,0.025)",
                    border:"1px solid rgba(255,255,255,0.05)",
                    clipPath:"polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)",
                    padding:"9px 11px",
                  }}>
                    <div style={{
                      width:28, height:28, flexShrink:0,
                      background:"rgba(232,201,109,0.07)",
                      border:"1px solid rgba(232,201,109,0.14)",
                      clipPath:"polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <Icon size={13} color="#c9ad5c"/>
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:11, color:"#aab2c0", fontWeight:700, whiteSpace:"nowrap" }}>{name}</div>
                      <div style={{ fontSize:10, color:"#e8c96d", fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{xp} XP</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Cerimônia de ativação de Mestre ── */
        @keyframes gpActFadeOut { from{opacity:1} to{opacity:0} }
        @keyframes gpActShock {
          0%   { transform:scale(0.18); opacity:0 }
          22%  { opacity:1 }
          100% { transform:scale(2.5);  opacity:0 }
        }
        @keyframes gpActSealIn {
          from { transform:scale(0.55) rotate(-14deg); opacity:0 }
          to   { transform:scale(1)    rotate(0deg);   opacity:1 }
        }
        @keyframes gpActSweep {
          from { transform:translateX(-110%) }
          to   { transform:translateX(110%) }
        }
        @keyframes gpActHeroIn {
          0%   { transform:translateY(46px) scale(0.9); opacity:0; filter:brightness(2.4) }
          55%  { filter:brightness(1.25) }
          100% { transform:translateY(0)    scale(1);   opacity:1; filter:brightness(1) }
        }
        @keyframes gpActNameSlam {
          0%   { transform:scale(1.5);  opacity:0; letter-spacing:0.3em }
          60%  { opacity:1 }
          100% { transform:scale(1);    opacity:1; letter-spacing:0.01em }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gpActShock    { from{opacity:0} to{opacity:0} }
          @keyframes gpActSweep    { from{opacity:0} to{opacity:0} }
          @keyframes gpActHeroIn   { from{opacity:0} to{opacity:1} }
          @keyframes gpActNameSlam { from{opacity:0} to{opacity:1} }
        }
        @keyframes gpToastIn {
          from { opacity:0; transform:translateX(-50%) translateY(-8px) }
          to   { opacity:1; transform:translateX(-50%) translateY(0) }
        }
        @keyframes gpShimmer {
          0%  { left:-100% }
          100%{ left: 200% }
        }
        @keyframes gpFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes gpBadgePop {
          0%  { transform:scale(0.8); opacity:0 }
          70% { transform:scale(1.05) }
          100%{ transform:scale(1);   opacity:1 }
        }
        @keyframes gpLevelBounce {
          0%  { transform:scale(0.3) rotate(-14deg); opacity:0 }
          60% { transform:scale(1.15) rotate(4deg);  opacity:1 }
          100%{ transform:scale(1)    rotate(0deg);  opacity:1 }
        }
        @keyframes gpRingPulse {
          0%  { transform:translate(-50%,-50%) scale(0.7); opacity:0.9 }
          100%{ transform:translate(-50%,-50%) scale(1.5); opacity:0 }
        }
        @keyframes gpHeroIn {
          from { opacity:0; transform:translateX(26px) }
          to   { opacity:1; transform:translateX(0) }
        }
        @keyframes gpGhostIn {
          from { opacity:0; transform:translateY(-50%) translateX(50px) }
          to   { opacity:1; transform:translateY(-50%) translateX(0) }
        }
        @keyframes gpRiseIn {
          from { opacity:0; transform:translateY(14px) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes gpPulseSoft {
          0%,100% { transform:scale(1) }
          50%     { transform:scale(1.12) }
        }
        @keyframes gpEmber {
          0%   { transform:translateY(0);        opacity:0 }
          8%   { opacity:0.7 }
          85%  { opacity:0.4 }
          100% { transform:translateY(-105vh);   opacity:0 }
        }
        @keyframes gpAuraSpin {
          from { transform:translateY(-46%) rotate(0deg) }
          to   { transform:translateY(-46%) rotate(360deg) }
        }
        @keyframes gpAuraBreathe {
          0%,100% { opacity:0.65; transform:translateY(-46%) scale(1) }
          50%     { opacity:1;    transform:translateY(-46%) scale(1.07) }
        }
        @keyframes gpAuraSpinReverse {
          from { transform:translateY(-46%) rotate(360deg) }
          to   { transform:translateY(-46%) rotate(0deg) }
        }
        @keyframes gpHeroFloat {
          0%,100% { transform:translateY(0) }
          50%     { transform:translateY(-10px) }
        }
        @keyframes gpLightSweep {
          from { transform:translateX(-120%) }
          to   { transform:translateX(120%) }
        }
        @keyframes gpSlideRight {
          from { opacity:0; transform:translateX(-36px) }
          to   { opacity:1; transform:translateX(0) }
        }
        @keyframes gpRowIn {
          from { opacity:0; transform:translateY(12px) }
        }
        @keyframes gpClaimGlow {
          0%,100% { filter:brightness(1) }
          50%     { filter:brightness(1.22) }
        }
        @keyframes gpBtnSheen {
          0%      { left:-80% }
          55%,100%{ left:130% }
        }
        @keyframes gpNextNodePulse {
          0%,100% { box-shadow:0 0 0 0 rgba(255,255,255,0.14) }
          50%     { box-shadow:0 0 0 5px rgba(255,255,255,0.03) }
        }
        @keyframes gpRaysSpin {
          from { transform:translate(-50%,-50%) rotate(0deg) }
          to   { transform:translate(-50%,-50%) rotate(360deg) }
        }
        @keyframes gpBurst {
          from { opacity:1; transform:translate(-50%,-50%) }
          to   { opacity:0; transform:translate(calc(-50% + var(--gp-tx)), calc(-50% + var(--gp-ty))) scale(0.4) }
        }
        @keyframes gpTileGlow {
          0%,100% { opacity:0.55 }
          50%     { opacity:1 }
        }
        .gp-tile { transition:transform 0.3s cubic-bezier(0.34,1.3,0.64,1) }
        .gp-tile:hover { transform:translateY(-4px) }
        .gp-tile:hover .gp-tile-art { transform:scale(1.06) }
        .gp-icon-btn { transition:background 0.2s, color 0.2s }
        .gp-icon-btn:hover { background:rgba(255,255,255,0.09) !important; color:#f1f0ee !important }
        .gp-cta { transition:filter 0.2s, transform 0.15s }
        .gp-cta:hover { filter:brightness(1.2) }
        .gp-cta:active { transform:scale(0.97) }
        .gp-trail-row { transition:transform 0.2s ease, border-color 0.2s ease }
        .gp-trail-row:hover { transform:translateX(3px) }
        .gp-xp-card { transition:transform 0.25s cubic-bezier(0.34,1.3,0.64,1), background 0.25s, border-color 0.25s }
        .gp-xp-card:hover { transform:translateY(-2px); background:rgba(232,201,109,0.05) !important; border-color:rgba(232,201,109,0.22) !important }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration:0.01ms !important; animation-iteration-count:1 !important; transition-duration:0.01ms !important }
        }
        @media (max-width: 720px) {
          .gp-detail-left { width: 260px !important }
          .gp-hero-desc { display: none }
        }
        @media (max-height: 620px) {
          .gp-hero-desc { display: none }
        }
      `}</style>
    </div>
  )
}
