"use client"

import { useState, useEffect, useRef } from "react"
import {
  ArrowLeft, Check, Lock, ChevronRight, Swords, Trophy, Skull, Flag, Layers, Target, Star, Gift, Sparkles,
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
} from "@/lib/masters-data"
import { CHESTS } from "@/lib/chests"

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
      }}/>
    </button>
  )
}

// ─── Detail / progression view ────────────────────────────────────────────────
function MasterDetail({ master, onActivate, onClose, onClaimReward, onClaimAll }: {
  master:        Master
  onActivate:    () => void
  onClose:       () => void
  onClaimReward: (level: number) => void
  onClaimAll:    () => void
}) {
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
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.16em", color:"#565d6b", textTransform:"uppercase" }}>Experiência</span>
                <span style={{ fontSize:11, color: master.accentColor, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>
                  {master.currentXP} / {master.xpToNext}
                </span>
              </div>
              <XPBar current={master.currentXP} total={master.xpToNext} color={master.accentColor}/>
              <div style={{ fontSize:10, color:"#4b5563", marginTop:5 }}>
                {master.currentLevel >= master.maxLevel
                  ? "Nível máximo alcançado"
                  : `${master.maxLevel - master.currentLevel} níveis até o máximo`}
              </div>
            </div>
          </div>

          {/* Passive — desbloqueia no Nv.25 */}
          {master.passive && master.currentLevel >= 25 && (
            <div style={{
              background:`linear-gradient(135deg,${master.accentColor}16,${master.accentColor}06)`,
              border:`1px solid ${master.accentColor}32`,
              clipPath:"polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
              padding:"11px 13px",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <Star size={12} color={master.accentColor} fill={master.accentColor}/>
                <span style={{ fontWeight:800, fontSize:11.5, color: master.accentColor, letterSpacing:"0.04em" }}>
                  {master.passive.name}
                </span>
              </div>
              <div style={{ fontSize:10.5, color:"#7b8290", lineHeight:1.55 }}>
                {master.passive.description}
              </div>
            </div>
          )}
          {master.passive && master.currentLevel < 25 && (
            <div style={{
              background:"rgba(255,255,255,0.02)",
              border:"1px dashed rgba(255,255,255,0.10)",
              padding:"10px 13px", display:"flex", alignItems:"center", gap:8,
            }}>
              <Lock size={12} color="#4b5563"/>
              <span style={{ fontSize:10.5, color:"#4b5563" }}>
                Habilidade Passiva desbloqueia no Nível 25
              </span>
            </div>
          )}
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
            }}>
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
              {master.rewards.map(reward => {
                const reached     = master.currentLevel >= reward.level
                const canClaim    = reached && !reward.claimed
                const chestId     = elementToChestId(master.element)
                const rColor      = rewardColor(reward.type, CHESTS[chestId].color)
                const label       = rewardDisplayLabel(reward, master.element)
                const isNext      = reward.level === master.currentLevel + 1
                const isMilestone = reward.level % 10 === 0 || reward.level === 25

                return (
                  <div
                    key={reward.level}
                    ref={isNext ? nextRef : undefined}
                    style={{
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
                      color: reached ? "#f5f2ec" : "#3f4654",
                      boxShadow: reached ? `0 0 14px ${master.accentColor}32` : "none",
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
                        }}>
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

// ─── Level-up overlay ─────────────────────────────────────────────────────────
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
          width:200, height:200, borderRadius:"50%",
          background:`radial-gradient(circle,${master.accentColor}26 0%,transparent 70%)`,
          filter:"blur(6px)",
        }}/>
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
  const { coins, setCoins, setGearCoins, addChests, addSkipTickets, addStaminaBottles } = useGame()

  const [masters,      setMasters]      = useState<Master[]>([])
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [showDetail,   setShowDetail]   = useState(false)
  const [levelUpData,  setLevelUpData]  = useState<{ master: Master; newLevel: number } | null>(null)
  const [toast,        setToast]        = useState<string | null>(null)
  const [packToOpen,   setPackToOpen]   = useState<string | null>(null)
  const [heroKey,      setHeroKey]      = useState(0)

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

  // Sincroniza com XP ganho em duelos (evento disparado por grantMasterDuelXP)
  useEffect(() => {
    const onXP = (e: Event) => {
      const detail = (e as CustomEvent).detail as { leveledUp?: boolean; newLevel?: number } | undefined
      const reloaded = loadMastersFromStorage()
      setMasters(reloaded)
      if (detail?.leveledUp) {
        const active = reloaded.find(m => m.isActive)
        if (active) setLevelUpData({ master: active, newLevel: detail.newLevel ?? active.currentLevel })
      }
    }
    window.addEventListener("gpgame_master_xp", onXP)
    return () => window.removeEventListener("gpgame_master_xp", onXP)
  }, [])

  // Activate a master
  const handleActivate = (masterId: string) => {
    setMasters(prev => {
      const next = prev.map(m => ({ ...m, isActive: m.id === masterId }))
      saveMastersToStorage(next)
      return next
    })
    showToast("Mestre alterado com sucesso!")
    setShowDetail(false)
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

      {/* Detail overlay */}
      {showDetail && selectedMaster && (
        <MasterDetail
          master={selectedMaster}
          onActivate={() => handleActivate(selectedMaster.id)}
          onClose={() => setShowDetail(false)}
          onClaimReward={level => handleClaimReward(selectedMaster.id, level)}
          onClaimAll={() => handleClaimAll(selectedMaster.id)}
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
            </div>

            {/* Master art — right side */}
            <img
              src={selectedMaster.artPath || "/placeholder.svg"}
              alt={selectedMaster.fullName}
              style={{
                position:"absolute", right:"4%", bottom:0, height:"96%",
                maxWidth:"52%", objectFit:"contain", objectPosition:"right bottom",
                zIndex:2, pointerEvents:"none",
                filter:`drop-shadow(0 0 50px ${selectedMaster.accentColor}45) drop-shadow(0 18px 30px rgba(0,0,0,0.6))`,
                animation:"gpHeroIn 0.65s cubic-bezier(0.22,1,0.36,1) both",
              }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
            />
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
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:9.5, fontWeight:800, letterSpacing:"0.18em", color:"#565d6b", textTransform:"uppercase" }}>
                      Experiência
                    </span>
                    <span style={{ fontSize:11, color: selectedMaster.accentColor, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>
                      {selectedMaster.currentXP} / {selectedMaster.xpToNext} XP
                    </span>
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

              {/* Passive teaser */}
              {selectedMaster.passive && (
                <div style={{
                  display:"flex", alignItems:"center", gap:8, marginTop:16,
                  animation:"gpRiseIn 0.5s ease 0.34s both",
                }}>
                  {selectedMaster.currentLevel >= 25 ? (
                    <>
                      <Star size={11} color={selectedMaster.accentColor} fill={selectedMaster.accentColor}/>
                      <span style={{ fontSize:11, color: selectedMaster.accentColor, fontWeight:800 }}>
                        {selectedMaster.passive.name}
                      </span>
                      <span style={{ fontSize:10.5, color:"#565d6b" }}>— passiva ativa</span>
                    </>
                  ) : (
                    <>
                      <Lock size={11} color="#4b5563"/>
                      <span style={{ fontSize:10.5, color:"#4b5563" }}>
                        Passiva {'"'}{selectedMaster.passive.name}{'"'} desbloqueia no Nível 25
                      </span>
                    </>
                  )}
                </div>
              )}
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
                  <div key={name} style={{
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
        .gp-tile { transition:transform 0.3s cubic-bezier(0.34,1.3,0.64,1) }
        .gp-tile:hover { transform:translateY(-4px) }
        .gp-tile:hover .gp-tile-art { transform:scale(1.06) }
        .gp-icon-btn { transition:background 0.2s, color 0.2s }
        .gp-icon-btn:hover { background:rgba(255,255,255,0.09) !important; color:#f1f0ee !important }
        .gp-cta { transition:filter 0.2s, transform 0.15s }
        .gp-cta:hover { filter:brightness(1.2) }
        .gp-cta:active { transform:scale(0.97) }
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
