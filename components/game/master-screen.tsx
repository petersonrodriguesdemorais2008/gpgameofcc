"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Check, Lock, ChevronRight, Swords, Trophy, Skull, Flag, Layers, Target, Star } from "lucide-react"
import { useGame } from "@/contexts/game-context"
import { PackOpeningOverlay } from "./pack-opening-overlay"
import {
  type Master,
  type MasterReward,
  loadMastersFromStorage,
  saveMastersToStorage,
  xpRequiredForLevel,
  rewardIconPath,
} from "@/lib/masters-data"

interface MasterScreenProps {
  onBack: () => void
}

// ─── Reward type colors ───────────────────────────────────────────────────────
function rewardColor(type: MasterReward["type"]): string {
  const map: Record<string, string> = {
    gear_coins:"#e8c96d", pack:"#60a5fa", gacha_coins:"#a78bfa",
    card_skin:"#fb923c", chest:"#cbd5e1", skip_ticket:"#34d399",
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
  if (r === "LR") return { color:"#f87171", bg:"rgba(248,113,113,0.14)", frame:"linear-gradient(135deg,#7f1d1d,#f87171,#fbbf24,#7f1d1d)" }
  if (r === "UR") return { color:"#fbbf24", bg:"rgba(251,191,36,0.14)",  frame:"linear-gradient(135deg,#78350f,#fbbf24,#fde68a,#78350f)" }
  if (r === "SR") return { color:"#a78bfa", bg:"rgba(167,139,250,0.14)", frame:"linear-gradient(135deg,#3b0764,#a78bfa,#c4b5fd,#3b0764)" }
  return { color:"#94a3b8", bg:"rgba(148,163,184,0.12)", frame:"linear-gradient(135deg,#334155,#94a3b8,#334155)" }
}

// ─── XP progress bar ──────────────────────────────────────────────────────────
function XPBar({ current, total, color, height = 7 }: { current: number; total: number; color: string; height?: number }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 100
  return (
    <div style={{
      height, borderRadius:99, background:"rgba(255,255,255,0.06)",
      overflow:"hidden", position:"relative",
      boxShadow:"inset 0 1px 3px rgba(0,0,0,0.5)",
    }}>
      {/* tick marks */}
      {[25,50,75].map(t => (
        <div key={t} style={{
          position:"absolute", left:`${t}%`, top:0, bottom:0, width:1,
          background:"rgba(0,0,0,0.45)", zIndex:2,
        }}/>
      ))}
      <div style={{
        height:"100%", borderRadius:99, width:`${pct}%`,
        background:`linear-gradient(90deg, ${color}70, ${color})`,
        boxShadow:`0 0 10px ${color}55`,
        transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)",
        position:"relative",
      }}>
        <div style={{
          position:"absolute", top:0, left:"-100%", width:"100%", height:"100%",
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)",
          animation:"gpShimmer 2.4s ease-in-out infinite",
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
        background:`linear-gradient(135deg,${color}28,rgba(8,6,10,0.9))`,
        border:`1.5px solid ${color}70`, borderRadius:10,
        boxShadow:`0 0 18px ${color}35, inset 0 0 12px ${color}15`,
      }}/>
      <div style={{
        position:"absolute", inset:5, transform:"rotate(45deg)",
        border:`1px solid ${color}30`, borderRadius:7,
      }}/>
      <div style={{ position:"relative", textAlign:"center", zIndex:1 }}>
        <div style={{ fontSize:size*0.13, fontWeight:800, color:`${color}cc`, letterSpacing:"0.14em", lineHeight:1 }}>NV</div>
        <div style={{ fontSize:size*0.36, fontWeight:900, color:"#f1f0ee", lineHeight:1.05, textShadow:`0 0 12px ${color}80` }}>{level}</div>
      </div>
    </div>
  )
}

// ─── Master card for selection grid ──────────────────────────────────────────
function MasterCard({ master, isSelected, onClick }: {
  master: Master; isSelected: boolean; onClick: () => void
}) {
  const el  = elementStyle(master.element)
  const rar = rarityStyle(master.rarity)
  const pct = master.xpToNext > 0
    ? Math.min(100, (master.currentXP / master.xpToNext) * 100) : 100

  return (
    <button onClick={onClick} className="gp-master-card" style={{
      position:"relative", padding:1.5, cursor:"pointer",
      background: isSelected ? rar.frame : "rgba(255,255,255,0.07)",
      border:"none", borderRadius:20, overflow:"hidden", textAlign:"left",
      boxShadow: isSelected
        ? `0 12px 40px ${master.accentColor}30, 0 0 0 1px ${master.accentColor}30`
        : "0 6px 24px rgba(0,0,0,0.45)",
      transition:"transform 0.3s cubic-bezier(0.34,1.3,0.64,1), box-shadow 0.3s",
    }}>
      <div style={{ background:"#0a080e", borderRadius:19, overflow:"hidden" }}>
        {/* art */}
        <div style={{
          height:210, position:"relative", overflow:"hidden",
          background:`radial-gradient(ellipse at 50% 115%, ${master.bgColor} 0%, #07060a 78%)`,
        }}>
          {/* elemental haze */}
          <div style={{
            position:"absolute", inset:0,
            background:`radial-gradient(ellipse 90% 55% at 50% 100%, ${master.accentColor}1c 0%, transparent 65%)`,
          }}/>
          <img
            src={master.artPath}
            alt={master.name}
            className="gp-master-art"
            style={{
              position:"absolute", inset:0, width:"100%", height:"100%",
              objectFit:"contain", objectPosition:"center top",
              transition:"transform 0.45s cubic-bezier(0.22,1,0.36,1)",
            }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
          />
          {/* bottom fade into info */}
          <div style={{
            position:"absolute", left:0, right:0, bottom:0, height:70,
            background:"linear-gradient(transparent, #0a080e)",
          }}/>
          {/* Active ribbon */}
          {master.isActive && (
            <div style={{
              position:"absolute", top:12, left:-34, transform:"rotate(-38deg)",
              background:"linear-gradient(90deg,#065f46,#10b981,#065f46)",
              color:"#eafff5", fontSize:9, fontWeight:900, letterSpacing:"0.18em",
              padding:"4px 40px", boxShadow:"0 2px 10px rgba(16,185,129,0.45)",
            }}>ATIVO</div>
          )}
          {/* Rarity */}
          <div style={{
            position:"absolute", top:10, right:10,
            background:"rgba(6,5,9,0.75)", color: rar.color,
            fontSize:10, fontWeight:900, letterSpacing:"0.12em",
            padding:"4px 9px", borderRadius:6,
            border:`1px solid ${rar.color}55`, backdropFilter:"blur(6px)",
          }}>{master.rarity}</div>
        </div>

        {/* info */}
        <div style={{ padding:"12px 15px 15px", position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
            <span style={{ fontWeight:900, fontSize:16, color:"#f1f0ee", letterSpacing:"0.01em" }}>{master.name}</span>
            <span style={{
              fontSize:9, fontWeight:800, letterSpacing:"0.10em", color: el.color, background: el.bg,
              padding:"2px 7px", borderRadius:4, textTransform:"uppercase",
            }}>{master.element}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:7 }}>
            <span style={{ fontSize:11, fontWeight:700, color: master.accentColor }}>Nível {master.currentLevel}</span>
            <span style={{ fontSize:10, color:"#565d6b", fontVariantNumeric:"tabular-nums" }}>
              {master.currentXP}/{master.xpToNext} XP
            </span>
          </div>
          <XPBar current={master.currentXP} total={master.xpToNext} color={master.accentColor} height={5}/>
        </div>
      </div>
    </button>
  )
}

// ─── Detail / progression view ────────────────────────────────────────────────
function MasterDetail({ master, onActivate, onClose, onClaimReward }: {
  master:        Master
  onActivate:    () => void
  onClose:       () => void
  onClaimReward: (level: number) => void
}) {
  const claimable = master.rewards.filter(r => r.level <= master.currentLevel && !r.claimed)

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      background:"rgba(2,1,4,0.92)", backdropFilter:"blur(22px)",
      display:"flex", overflow:"hidden", animation:"gpFadeIn 0.25s ease",
    }}>
      {/* Left panel — art + identity */}
      <div style={{
        width:330, flexShrink:0,
        background:`linear-gradient(165deg,${master.bgColor} 0%,#07050a 100%)`,
        borderRight:`1px solid ${master.accentColor}20`,
        display:"flex", flexDirection:"column", overflow:"hidden",
        position:"relative",
      }}>
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:`radial-gradient(ellipse 85% 55% at 50% 72%,${master.accentColor}14 0%,transparent 70%)`,
        }}/>

        {/* Art */}
        <div style={{ flex:1, display:"flex", alignItems:"flex-end", justifyContent:"center", overflow:"hidden", position:"relative" }}>
          <img
            src={master.artPath}
            alt={master.fullName}
            style={{ maxHeight:"88%", objectFit:"contain", objectPosition:"center bottom", position:"relative", zIndex:1 }}
          />
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(transparent,rgba(7,5,10,0.97) 82%)",
            padding:"56px 22px 18px", zIndex:2,
          }}>
            <div style={{
              display:"flex", alignItems:"center", gap:8, marginBottom:6,
            }}>
              <div style={{ height:1, width:22, background:`linear-gradient(90deg,transparent,${master.accentColor})` }}/>
              <div style={{
                fontSize:10, fontWeight:800, letterSpacing:"0.22em",
                textTransform:"uppercase", color: master.accentColor,
              }}>{master.element} · {master.rarity}</div>
            </div>
            <div style={{
              fontWeight:900, fontSize:27, lineHeight:1.08, letterSpacing:"-0.01em",
              color:"#f6f4f0", textShadow:`0 2px 24px ${master.accentColor}50`,
            }}>{master.fullName}</div>
            <div style={{ color:"#6d7482", fontSize:12, fontStyle:"italic", marginTop:7, lineHeight:1.55 }}>
              {master.quote}
            </div>
          </div>
        </div>

        {/* XP section */}
        <div style={{ padding:"16px 20px 18px", background:"rgba(0,0,0,0.38)", flexShrink:0, borderTop:`1px solid ${master.accentColor}15` }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:10 }}>
            <LevelMedallion level={master.currentLevel} color={master.accentColor} size={52}/>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.14em", color:"#565d6b", textTransform:"uppercase" }}>Experiência</span>
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

          {/* Passive — traço do mestre, desbloqueia no Lv.25 */}
          {master.passive && master.currentLevel >= 25 && (
            <div style={{
              background:`linear-gradient(135deg,${master.accentColor}14,${master.accentColor}06)`,
              border:`1px solid ${master.accentColor}30`, borderRadius:12,
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
              border:"1px dashed rgba(255,255,255,0.10)", borderRadius:12,
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

      {/* Right panel — info + rewards */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column", overflow:"hidden",
        background:"linear-gradient(165deg,#0a0812 0%,#060409 100%)",
      }}>
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", gap:12,
          padding:"15px 22px", borderBottom:"1px solid rgba(255,255,255,0.06)",
          flexShrink:0, background:"rgba(5,4,8,0.6)",
        }}>
          <button onClick={onClose} className="gp-icon-btn" style={{
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
            borderRadius:10, width:38, height:38, cursor:"pointer", color:"#8b93a1",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}><ArrowLeft size={17}/></button>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:900, fontSize:16, color:"#f1f0ee", letterSpacing:"0.01em" }}>{master.fullName}</div>
            <div style={{ fontSize:10, color:"#565d6b", letterSpacing:"0.16em", textTransform:"uppercase", fontWeight:700 }}>
              Trilha de Progressão
            </div>
          </div>

          {claimable.length > 0 && (
            <div style={{
              display:"flex", alignItems:"center", gap:7,
              background:"linear-gradient(135deg,#6d5310,#e8c96d)",
              color:"#0c0a06", fontWeight:900, fontSize:11.5,
              padding:"7px 14px", borderRadius:9,
              boxShadow:"0 3px 16px rgba(232,201,109,0.42)",
              animation:"gpBadgePop 0.3s ease",
            }}>
              <span style={{
                width:18, height:18, borderRadius:"50%", background:"rgba(12,10,6,0.22)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:10, fontWeight:900,
              }}>{claimable.length}</span>
              para receber
            </div>
          )}

          {!master.isActive ? (
            <button onClick={onActivate} className="gp-cta" style={{
              background:`linear-gradient(135deg,${master.accentColor}28,${master.accentColor}55)`,
              border:`1px solid ${master.accentColor}60`, borderRadius:11,
              padding:"9px 18px", cursor:"pointer", color:"#fff",
              fontWeight:900, fontSize:12.5, letterSpacing:"0.03em",
              boxShadow:`0 3px 16px ${master.accentColor}35`,
              textShadow:"0 1px 4px rgba(0,0,0,0.4)",
            }}>
              Definir como Ativo
            </button>
          ) : (
            <div style={{
              display:"flex", alignItems:"center", gap:6,
              background:"rgba(16,185,129,0.10)", border:"1px solid rgba(16,185,129,0.32)",
              borderRadius:11, padding:"9px 15px", color:"#34d399",
              fontWeight:800, fontSize:12,
            }}>
              <Check size={13}/> Mestre Ativo
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ padding:"15px 22px 0", flexShrink:0 }}>
          <p style={{ fontSize:12.5, color:"#7b8290", lineHeight:1.7, margin:0 }}>
            {master.description}
          </p>
        </div>

        {/* Rewards trail */}
        <div style={{ flex:1, overflowY:"auto", padding:"18px 22px 46px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <span style={{
              fontSize:10, fontWeight:800, color:"#6d7482",
              textTransform:"uppercase", letterSpacing:"0.18em",
            }}>Recompensas por Nível</span>
            <div style={{ flex:1, height:1, background:"linear-gradient(90deg,rgba(255,255,255,0.10),transparent)" }}/>
          </div>

          <div style={{ position:"relative" }}>
            {/* timeline spine */}
            <div style={{
              position:"absolute", left:19, top:8, bottom:8, width:2, borderRadius:2,
              background:`linear-gradient(180deg,${master.accentColor}45,rgba(255,255,255,0.05))`,
            }}/>

            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {master.rewards.map(reward => {
                const reached     = master.currentLevel >= reward.level
                const canClaim    = reached && !reward.claimed
                const rColor      = rewardColor(reward.type)
                const isNext      = reward.level === master.currentLevel + 1
                const isMilestone = reward.level % 10 === 0 || reward.level === 25

                return (
                  <div key={reward.level} style={{
                    display:"flex", alignItems:"center", gap:13,
                    background: canClaim
                      ? `linear-gradient(90deg,${rColor}0d,rgba(255,255,255,0.035))`
                      : isMilestone && !reached
                      ? "rgba(255,255,255,0.028)"
                      : "rgba(255,255,255,0.018)",
                    border: `1px solid ${
                      canClaim ? `${rColor}40` :
                      isNext ? "rgba(255,255,255,0.13)" :
                      isMilestone ? "rgba(255,255,255,0.07)" :
                      "rgba(255,255,255,0.045)"
                    }`,
                    borderRadius:12,
                    padding: isMilestone ? "12px 15px" : "9px 15px",
                    opacity: !reached && !isNext ? 0.5 : 1,
                    position:"relative",
                    boxShadow: canClaim ? `0 4px 20px ${rColor}18` : "none",
                    transition:"all 0.2s",
                  }}>
                    {/* Level node */}
                    <div style={{
                      width:38, height:38, borderRadius: isMilestone ? 12 : 10, flexShrink:0,
                      background: reached
                        ? `linear-gradient(135deg,${master.accentColor}25,${master.accentColor}45)`
                        : "rgba(10,8,14,0.9)",
                      border:`1.5px solid ${reached ? master.accentColor + "60" : "rgba(255,255,255,0.09)"}`,
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                      fontWeight:900, fontSize:12, position:"relative", zIndex:1,
                      color: reached ? "#f1f0ee" : "#3f4654",
                      boxShadow: reached ? `0 0 12px ${master.accentColor}30` : "none",
                    }}>
                      {reward.level}
                    </div>

                    {/* Reward icon */}
                    <div style={{
                      width: isMilestone ? 44 : 36, height: isMilestone ? 44 : 36, flexShrink:0,
                      borderRadius:10, background:`radial-gradient(circle,${rColor}14,rgba(0,0,0,0.35))`,
                      border:`1px solid ${rColor}28`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      overflow:"hidden",
                    }}>
                      <img
                        src={rewardIconPath(reward.type, reward.packId) || "/placeholder.svg"}
                        alt=""
                        style={{ width:"78%", height:"78%", objectFit:"contain" }}
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
                        {reward.label}
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
                        fontSize:11, color:"#3f4654", fontWeight:700,
                      }}><Check size={13}/> Recebido</span>
                    )}
                    {canClaim && (
                      <button
                        onClick={() => onClaimReward(reward.level)}
                        className="gp-cta"
                        style={{
                          background:`linear-gradient(135deg,${rColor}25,${rColor}50)`,
                          border:`1px solid ${rColor}60`, borderRadius:9,
                          padding:"7px 16px", cursor:"pointer", color:"#fff",
                          fontWeight:900, fontSize:11.5, flexShrink:0,
                          boxShadow:`0 3px 14px ${rColor}30`,
                          textShadow:"0 1px 3px rgba(0,0,0,0.5)",
                          letterSpacing:"0.02em",
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
      background:"rgba(2,1,4,0.88)", backdropFilter:"blur(12px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      animation:"gpFadeIn 0.3s ease",
    }} onClick={onClose}>
      <div style={{ textAlign:"center", pointerEvents:"none", position:"relative" }}>
        {/* radiant rings */}
        <div style={{
          position:"absolute", left:"50%", top:"38%", transform:"translate(-50%,-50%)",
          width:280, height:280, borderRadius:"50%",
          border:`1px solid ${master.accentColor}35`,
          animation:"gpRingPulse 2s ease-out infinite",
        }}/>
        <div style={{
          position:"absolute", left:"50%", top:"38%", transform:"translate(-50%,-50%)",
          width:200, height:200, borderRadius:"50%",
          background:`radial-gradient(circle,${master.accentColor}22 0%,transparent 70%)`,
          filter:"blur(6px)",
        }}/>
        <div style={{ position:"relative", animation:"gpLevelBounce 0.6s cubic-bezier(0.34,1.56,0.64,1)", marginBottom:18 }}>
          <LevelMedallion level={newLevel} color={master.accentColor} size={120}/>
        </div>
        <div style={{
          fontSize:13, fontWeight:800, color: master.accentColor,
          letterSpacing:"0.32em", textTransform:"uppercase", marginBottom:10,
        }}>Nível Alcançado</div>
        <div style={{ fontWeight:900, fontSize:24, color:"#f6f4f0", textShadow:`0 2px 24px ${master.accentColor}60` }}>
          {master.fullName}
        </div>
        <div style={{ color:"#565d6b", fontSize:12, marginTop:10, letterSpacing:"0.08em" }}>toque para continuar</div>
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
  { Icon: Swords, name:"Duelo PvE",  xp:"+50–100 XP" },
  { Icon: Trophy, name:"Duelo PvP",  xp:"+80–140 XP" },
  { Icon: Skull,  name:"Chefão",     xp:"+120–180 XP" },
  { Icon: Flag,   name:"Guerra",     xp:"+100–160 XP" },
  { Icon: Layers, name:"Draft",      xp:"+70–120 XP" },
  { Icon: Target, name:"Missões",    xp:"+30–80 XP" },
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

  // Simulate XP gain (dev helper — remove in production)
  const handleAddXP = (masterId: string, amount: number) => {
    setMasters(prev => {
      const next = prev.map(m => {
        if (m.id !== masterId) return m
        if (m.currentLevel >= m.maxLevel) {
          return { ...m, currentXP: m.xpToNext, currentLevel: m.maxLevel }
        }
        let xp    = m.currentXP + amount
        let level = m.currentLevel
        let leveled = false
        while (level < m.maxLevel) {
          const needed = xpRequiredForLevel(level)
          if (xp >= needed) { xp -= needed; level++; leveled = true }
          else break
        }
        if (level >= m.maxLevel) { level = m.maxLevel; xp = 0 }
        const updated: Master = { ...m, currentXP: xp, currentLevel: level, totalXP: m.totalXP + amount, xpToNext: xpRequiredForLevel(level) }
        if (leveled && level <= m.maxLevel) {
          setLevelUpData({ master: updated, newLevel: level })
        }
        return updated
      })
      saveMastersToStorage(next)
      return next
    })
  }

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

    } else if (reward.type === "chest" && reward.amount) {
      addChests({ void: reward.amount })
      showToast(`+${reward.amount} Baús do Vazio no inventário!`)

    } else if (reward.type === "skip_ticket" && reward.amount) {
      addSkipTickets(reward.amount)
      showToast(`+${reward.amount} Skip Tíquetes adicionados!`)

    } else if (reward.type === "stamina_bottle" && reward.amount) {
      addStaminaBottles(reward.amount)
      showToast(`+${reward.amount} Garrafas de Stamina adicionadas!`)

    } else if (reward.type === "card_skin") {
      // Unlock card skin — use exact skinId that deck-builder expects
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
      showToast(`${reward.label} desbloqueada!`)

    } else {
      showToast(`${reward.label} recebido!`)
    }
  }

  const el  = selectedMaster ? elementStyle(selectedMaster.element) : null
  const rar = selectedMaster ? rarityStyle(selectedMaster.rarity)   : null

  return (
    <div style={{
      minHeight:"100vh", background:"linear-gradient(165deg,#0a0712 0%,#060409 55%,#090612 100%)",
      color:"#f1f0ee", fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex", flexDirection:"column", position:"relative", overflow:"hidden",
    }}>
      {/* Ambient atmosphere */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", width:640, height:640, borderRadius:"50%", top:-240, left:-140, background:"radial-gradient(circle,rgba(88,28,220,0.09) 0%,transparent 70%)", filter:"blur(44px)" }}/>
        <div style={{ position:"absolute", width:520, height:520, borderRadius:"50%", bottom:-180, right:-120, background:"radial-gradient(circle,rgba(232,201,109,0.06) 0%,transparent 70%)", filter:"blur(44px)" }}/>
        {/* fine grid texture */}
        <div style={{
          position:"absolute", inset:0, opacity:0.35,
          backgroundImage:"linear-gradient(rgba(255,255,255,0.014) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.014) 1px,transparent 1px)",
          backgroundSize:"56px 56px",
          maskImage:"radial-gradient(ellipse 90% 70% at 50% 30%,black,transparent)",
          WebkitMaskImage:"radial-gradient(ellipse 90% 70% at 50% 30%,black,transparent)",
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
        />
      )}

      {/* ── Header ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:14, padding:"14px 20px",
        background:"rgba(7,5,10,0.90)", backdropFilter:"blur(18px)",
        borderBottom:"1px solid rgba(232,201,109,0.10)", position:"sticky", top:0, zIndex:50,
      }}>
        <button onClick={onBack} className="gp-icon-btn" style={{
          background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)",
          borderRadius:10, width:38, height:38, cursor:"pointer", color:"#8b93a1",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <h1 style={{
              fontWeight:900, fontSize:19, margin:0, letterSpacing:"0.06em",
              background:"linear-gradient(135deg,#f6f4f0,#e8c96d 70%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
              textTransform:"uppercase",
            }}>Mestres</h1>
            <div style={{ height:1, width:44, background:"linear-gradient(90deg,rgba(232,201,109,0.5),transparent)" }}/>
          </div>
          <p style={{ color:"#565d6b", fontSize:11, margin:0 }}>Escolha seu parceiro de batalha e evolua junto com ele</p>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex:1, overflowY:"auto", position:"relative", zIndex:1 }}>
        <div style={{ maxWidth:920, margin:"0 auto", padding:"22px 20px 80px" }}>

          {/* Active master hero */}
          {selectedMaster && (
            <div style={{
              position:"relative", borderRadius:22, marginBottom:26,
              padding:1.5, overflow:"hidden",
              background:`linear-gradient(135deg,${selectedMaster.accentColor}55,rgba(255,255,255,0.06) 45%,${selectedMaster.accentColor}25)`,
              boxShadow:`0 14px 52px ${selectedMaster.accentColor}18, 0 6px 24px rgba(0,0,0,0.5)`,
            }}>
              <div style={{
                background:`linear-gradient(120deg,${selectedMaster.bgColor}e8 0%,rgba(8,6,11,0.97) 62%)`,
                borderRadius:21, position:"relative", overflow:"hidden",
              }}>
                {/* glow + art backdrop on the right */}
                <div style={{
                  position:"absolute", inset:0, pointerEvents:"none",
                  background:`radial-gradient(ellipse 55% 90% at 88% 50%,${selectedMaster.accentColor}16 0%,transparent 65%)`,
                }}/>
                <img
                  src={selectedMaster.artPath || "/placeholder.svg"}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position:"absolute", right:-8, bottom:0, height:"118%",
                    objectFit:"contain", objectPosition:"right bottom",
                    opacity:0.9, pointerEvents:"none",
                    maskImage:"linear-gradient(90deg,transparent,black 35%)",
                    WebkitMaskImage:"linear-gradient(90deg,transparent,black 35%)",
                    filter:`drop-shadow(0 0 32px ${selectedMaster.accentColor}30)`,
                  }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                />

                <div style={{ position:"relative", padding:"22px 24px", paddingRight:180 }}>
                  {/* Badges */}
                  <div style={{ display:"flex", gap:7, marginBottom:10 }}>
                    <span style={{
                      fontSize:9, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase",
                      color: el!.color, background: el!.bg,
                      padding:"3px 9px", borderRadius:5, border:`1px solid ${el!.color}30`,
                    }}>{selectedMaster.element}</span>
                    <span style={{
                      fontSize:9, fontWeight:800, letterSpacing:"0.12em",
                      color: rar!.color, background: rar!.bg,
                      padding:"3px 9px", borderRadius:5, border:`1px solid ${rar!.color}30`,
                    }}>{selectedMaster.rarity}</span>
                    {selectedMaster.isActive && (
                      <span style={{
                        display:"flex", alignItems:"center", gap:4,
                        fontSize:9, fontWeight:800, letterSpacing:"0.12em", color:"#34d399",
                        background:"rgba(52,211,153,0.10)", padding:"3px 9px", borderRadius:5,
                        border:"1px solid rgba(52,211,153,0.28)",
                      }}><Check size={9}/> ATIVO</span>
                    )}
                  </div>

                  <h2 style={{
                    fontWeight:900, fontSize:26, margin:"0 0 5px", letterSpacing:"-0.01em",
                    color:"#f6f4f0", textShadow:`0 2px 28px ${selectedMaster.accentColor}55`,
                  }}>
                    {selectedMaster.fullName}
                  </h2>
                  <p style={{ fontSize:12, color:"#6d7482", fontStyle:"italic", margin:"0 0 16px", maxWidth:420 }}>
                    {selectedMaster.quote}
                  </p>

                  {/* XP row */}
                  <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                    <LevelMedallion level={selectedMaster.currentLevel} color={selectedMaster.accentColor} size={54}/>
                    <div style={{ flex:1, maxWidth:380 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.14em", color:"#565d6b", textTransform:"uppercase" }}>
                          Experiência
                        </span>
                        <span style={{ fontSize:11, color: selectedMaster.accentColor, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>
                          {selectedMaster.currentXP} / {selectedMaster.xpToNext} XP
                        </span>
                      </div>
                      <XPBar current={selectedMaster.currentXP} total={selectedMaster.xpToNext} color={selectedMaster.accentColor}/>
                      <div style={{ fontSize:10, color:"#4b5563", marginTop:5 }}>
                        {selectedMaster.maxLevel - selectedMaster.currentLevel} níveis até o máximo
                      </div>
                    </div>

                    <button onClick={() => setShowDetail(true)} className="gp-cta" style={{
                      display:"flex", alignItems:"center", gap:6,
                      background:`linear-gradient(135deg,${selectedMaster.accentColor}22,${selectedMaster.accentColor}45)`,
                      border:`1px solid ${selectedMaster.accentColor}55`,
                      borderRadius:12, padding:"11px 18px",
                      cursor:"pointer", color:"#fff",
                      fontWeight:900, fontSize:12.5, flexShrink:0, letterSpacing:"0.02em",
                      boxShadow:`0 4px 18px ${selectedMaster.accentColor}30`,
                      textShadow:"0 1px 4px rgba(0,0,0,0.4)",
                    }}>
                      Ver Progressão <ChevronRight size={14}/>
                    </button>
                  </div>
                </div>

                {/* Dev: add XP button (remove in production) */}
                <button
                  onClick={() => handleAddXP(selectedMaster.id, 2000)}
                  style={{
                    position:"absolute", bottom:12, right:14, zIndex:2,
                    background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:7, padding:"4px 10px", cursor:"pointer",
                    color:"#3f4654", fontSize:10, fontWeight:600,
                  }}>
                  +XP (teste)
                </button>
              </div>
            </div>
          )}

          {/* Masters grid */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <span style={{
              fontSize:10, fontWeight:800, color:"#6d7482",
              textTransform:"uppercase", letterSpacing:"0.18em",
            }}>Todos os Mestres</span>
            <div style={{ flex:1, height:1, background:"linear-gradient(90deg,rgba(255,255,255,0.09),transparent)" }}/>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
            {masters.map(m => (
              <MasterCard
                key={m.id}
                master={m}
                isSelected={selectedId === m.id}
                onClick={() => {
                  setSelectedId(m.id)
                  setShowDetail(true)
                }}
              />
            ))}
          </div>

          {/* XP guide */}
          <div style={{
            marginTop:28, borderRadius:18, overflow:"hidden",
            border:"1px solid rgba(232,201,109,0.14)",
            background:"linear-gradient(135deg,rgba(232,201,109,0.05),rgba(232,201,109,0.015))",
          }}>
            <div style={{
              display:"flex", alignItems:"center", gap:9,
              padding:"13px 18px 0",
            }}>
              <div style={{
                width:26, height:26, borderRadius:8, flexShrink:0,
                background:"rgba(232,201,109,0.12)", border:"1px solid rgba(232,201,109,0.28)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <Star size={13} color="#e8c96d"/>
              </div>
              <span style={{ fontWeight:800, fontSize:12, color:"#e8c96d", letterSpacing:"0.06em", textTransform:"uppercase" }}>
                Como ganhar XP de Mestre
              </span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9, padding:"13px 18px 17px" }}>
              {XP_SOURCES.map(({ Icon, name, xp }) => (
                <div key={name} style={{
                  display:"flex", alignItems:"center", gap:10,
                  background:"rgba(255,255,255,0.025)", borderRadius:11, padding:"10px 12px",
                  border:"1px solid rgba(255,255,255,0.045)",
                }}>
                  <div style={{
                    width:30, height:30, borderRadius:8, flexShrink:0,
                    background:"rgba(232,201,109,0.07)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <Icon size={14} color="#c9ad5c"/>
                  </div>
                  <div>
                    <div style={{ fontSize:11.5, color:"#aab2c0", fontWeight:700 }}>{name}</div>
                    <div style={{ fontSize:10, color:"#e8c96d", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{xp}</div>
                  </div>
                </div>
              ))}
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
        .gp-master-card:hover { transform:translateY(-5px) }
        .gp-master-card:hover .gp-master-art { transform:scale(1.05) }
        .gp-icon-btn { transition:background 0.2s, color 0.2s }
        .gp-icon-btn:hover { background:rgba(255,255,255,0.09) !important; color:#f1f0ee !important }
        .gp-cta { transition:filter 0.2s, transform 0.15s }
        .gp-cta:hover { filter:brightness(1.2) }
        .gp-cta:active { transform:scale(0.97) }
      `}</style>
    </div>
  )
}
