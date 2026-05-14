"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowLeft } from "lucide-react"
import {
  type Master,
  type MasterReward,
  loadMastersFromStorage,
  saveMastersToStorage,
  xpRequiredForLevel,
  rewardIcon,
  calcMasterXP,
} from "./masters-data"

interface MasterScreenProps {
  onBack: () => void
}

// ─── Reward type colors ───────────────────────────────────────────────────────
function rewardColor(type: MasterReward["type"]): string {
  const map: Record<string, string> = {
    coins:"#e8c96d", pack:"#60a5fa", gems:"#a78bfa",
    title:"#f97316", frame:"#34d399", emote:"#f472b6",
    skin:"#fb923c", passive:"#facc15",
  }
  return map[type] ?? "#94a3b8"
}

// ─── Element badge colors ─────────────────────────────────────────────────────
function elementStyle(el: string): { color: string; bg: string } {
  const map: Record<string, { color: string; bg: string }> = {
    "Vazio":   { color:"#38bdf8", bg:"rgba(56,189,248,0.12)" },
    "Sombra":  { color:"#a855f7", bg:"rgba(168,85,247,0.12)" },
    "Vento":   { color:"#4ade80", bg:"rgba(74,222,128,0.12)" },
    "Fogo":    { color:"#f87171", bg:"rgba(248,113,113,0.12)" },
    "Água":    { color:"#22d3ee", bg:"rgba(34,211,238,0.12)" },
    "Trovão":  { color:"#facc15", bg:"rgba(250,204,21,0.12)" },
    "Terra":   { color:"#a16207", bg:"rgba(161,98,7,0.12)" },
    "Luz":     { color:"#fde68a", bg:"rgba(253,230,138,0.12)" },
  }
  return map[el] ?? { color:"#94a3b8", bg:"rgba(148,163,184,0.10)" }
}

// ─── Rarity label colors ──────────────────────────────────────────────────────
function rarityStyle(r: string) {
  if (r === "LR") return { color:"#f87171", bg:"rgba(248,113,113,0.15)" }
  if (r === "UR") return { color:"#fbbf24", bg:"rgba(251,191,36,0.15)" }
  if (r === "SR") return { color:"#a78bfa", bg:"rgba(167,139,250,0.15)" }
  return { color:"#94a3b8", bg:"rgba(148,163,184,0.12)" }
}

// ─── XP progress bar ──────────────────────────────────────────────────────────
function XPBar({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0
  return (
    <div style={{ height:6, borderRadius:99, background:"rgba(255,255,255,0.06)", overflow:"hidden", position:"relative" }}>
      <div style={{
        height:"100%", borderRadius:99, width:`${pct}%`,
        background:`linear-gradient(90deg, ${color}88, ${color})`,
        boxShadow:`0 0 8px ${color}60`,
        transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)",
        position:"relative",
      }}>
        {/* shimmer */}
        <div style={{
          position:"absolute", top:0, left:"-100%", width:"100%", height:"100%",
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)",
          animation:"shimmer 2s ease-in-out infinite",
        }}/>
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
    <button onClick={onClick} style={{
      position:"relative", background:"rgba(255,255,255,0.03)",
      border:`2px solid ${isSelected ? master.accentColor : "rgba(255,255,255,0.07)"}`,
      borderRadius:18, padding:0, cursor:"pointer", overflow:"hidden",
      boxShadow: isSelected ? `0 0 24px ${master.accentColor}50, inset 0 0 24px ${master.accentColor}08` : "none",
      transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",
      transform: isSelected ? "scale(1.03)" : "scale(1)",
    }}>
      {/* colored top strip */}
      <div style={{
        height:4, background:`linear-gradient(90deg,${master.accentColor}00,${master.accentColor},${master.accentColor}00)`,
      }}/>

      {/* art placeholder / image */}
      <div style={{
        height:200, display:"flex", alignItems:"center", justifyContent:"center",
        background:`radial-gradient(ellipse at 50% 100%, ${master.bgColor} 0%, #080608 80%)`,
        overflow:"hidden", position:"relative",
      }}>
        <img
          src={master.artPath}
          alt={master.name}
          style={{ height:"100%", objectFit:"contain", objectPosition:"center top" }}
          onError={e => {
            // fallback: show initial letter
            const t = e.target as HTMLImageElement
            t.style.display = "none"
          }}
        />
        {/* fallback silhouette */}
        <div style={{
          position:"absolute", inset:0, display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:72, opacity:0.08,
          color: master.accentColor,
        }}>
          {master.name[0]}
        </div>
        {/* Active badge */}
        {master.isActive && (
          <div style={{
            position:"absolute", top:10, left:10,
            background:"linear-gradient(135deg,#065f46,#059669)",
            color:"#fff", fontSize:9, fontWeight:900,
            padding:"3px 8px", borderRadius:6,
            boxShadow:"0 2px 8px rgba(5,150,105,0.5)",
          }}>✦ ATIVO</div>
        )}
        {/* Rarity */}
        <div style={{
          position:"absolute", top:10, right:10,
          background: rar.bg, color: rar.color,
          fontSize:9, fontWeight:900, padding:"3px 7px", borderRadius:5,
          border:`1px solid ${rar.color}40`,
        }}>{master.rarity}</div>
      </div>

      {/* Info section */}
      <div style={{ padding:"12px 14px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <span style={{ fontWeight:900, fontSize:15, color:"#f1f0ee" }}>{master.name}</span>
          <span style={{
            fontSize:9, fontWeight:800, color: el.color, background: el.bg,
            padding:"1px 6px", borderRadius:4,
          }}>{master.element}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <span style={{ fontSize:11, color:"#6b7280" }}>Lv.{master.currentLevel} / {master.maxLevel}</span>
          <span style={{ fontSize:10, color: master.accentColor, fontWeight:700 }}>
            {master.currentXP} / {master.xpToNext} XP
          </span>
        </div>
        <XPBar current={master.currentXP} total={master.xpToNext} color={master.accentColor}/>
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
  const el  = elementStyle(master.element)
  const rar = rarityStyle(master.rarity)
  const pct = master.xpToNext > 0
    ? Math.min(100, (master.currentXP / master.xpToNext) * 100) : 100

  // Claimable rewards
  const claimable = master.rewards.filter(
    r => r.level <= master.currentLevel && !r.claimed
  )

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.90)", backdropFilter:"blur(20px)",
      display:"flex", overflow:"hidden",
    }}>
      {/* Left panel — art + identity */}
      <div style={{
        width:320, flexShrink:0,
        background:`linear-gradient(160deg,${master.bgColor} 0%,#08060a 100%)`,
        borderRight:"1px solid rgba(255,255,255,0.06)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        position:"relative",
      }}>
        {/* Accent glow */}
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:`radial-gradient(ellipse 80% 60% at 50% 70%,${master.accentColor}10 0%,transparent 70%)`,
        }}/>

        {/* Art */}
        <div style={{ flex:1, display:"flex", alignItems:"flex-end", justifyContent:"center", overflow:"hidden", position:"relative" }}>
          <img
            src={master.artPath}
            alt={master.fullName}
            style={{ maxHeight:"85%", objectFit:"contain", objectPosition:"center bottom", position:"relative", zIndex:1 }}
            onError={() => {}}
          />
          {/* name watermark */}
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(transparent,rgba(8,6,10,0.95))",
            padding:"40px 20px 20px", zIndex:2,
          }}>
            <div style={{
              fontSize:11, fontWeight:800, letterSpacing:"0.14em",
              textTransform:"uppercase", color: master.accentColor, marginBottom:4,
            }}>{master.element} · {master.rarity}</div>
            <div style={{
              fontWeight:900, fontSize:26, lineHeight:1.1,
              background:`linear-gradient(135deg,#f1f0ee,${master.accentColor})`,
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              backgroundClip:"text",
            }}>{master.fullName}</div>
            <div style={{ color:"#4b5563", fontSize:12, fontStyle:"italic", marginTop:6, lineHeight:1.5 }}>
              {master.quote}
            </div>
          </div>
        </div>

        {/* XP section */}
        <div style={{ padding:"16px 20px", background:"rgba(0,0,0,0.3)", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontWeight:900, fontSize:18, color:"#f1f0ee" }}>Lv.{master.currentLevel}</span>
            <span style={{ fontSize:12, color: master.accentColor, fontWeight:700 }}>
              {master.currentXP} / {master.xpToNext} XP
            </span>
          </div>
          <XPBar current={master.currentXP} total={master.xpToNext} color={master.accentColor}/>
          <div style={{ fontSize:10, color:"#4b5563", marginTop:6, textAlign:"center" }}>
            {master.maxLevel - master.currentLevel} níveis até o máximo
          </div>

          {/* Passive */}
          {master.passive && master.currentLevel >= 25 && (
            <div style={{
              marginTop:12, background:`${master.accentColor}10`,
              border:`1px solid ${master.accentColor}25`, borderRadius:10,
              padding:"10px 12px",
            }}>
              <div style={{ fontWeight:800, fontSize:11, color: master.accentColor, marginBottom:3 }}>
                {master.passive.icon} {master.passive.name}
              </div>
              <div style={{ fontSize:10, color:"#6b7280", lineHeight:1.5 }}>
                {master.passive.description}
              </div>
            </div>
          )}
          {master.passive && master.currentLevel < 25 && (
            <div style={{
              marginTop:12, background:"rgba(255,255,255,0.02)",
              border:"1px solid rgba(255,255,255,0.07)", borderRadius:10,
              padding:"10px 12px", opacity:0.5,
            }}>
              <div style={{ fontSize:10, color:"#4b5563" }}>
                🔒 Passiva desbloqueada no Lv.25
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — info + rewards */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column", overflow:"hidden",
        background:"linear-gradient(160deg,#09070f 0%,#060408 100%)",
      }}>
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", gap:12,
          padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)",
          flexShrink:0,
        }}>
          <button onClick={onClose} style={{
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:8, width:36, height:36, cursor:"pointer", color:"#6b7280",
            fontSize:16, display:"flex", alignItems:"center", justifyContent:"center",
          }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:900, fontSize:16, color:"#f1f0ee" }}>{master.fullName}</div>
            <div style={{ fontSize:11, color:"#4b5563" }}>Trilha de Progressão</div>
          </div>

          {/* Claimable badge */}
          {claimable.length > 0 && (
            <div style={{
              background:"linear-gradient(135deg,#7a5c0f,#e8c96d)",
              color:"#0c0a06", fontWeight:900, fontSize:11,
              padding:"6px 12px", borderRadius:8,
              boxShadow:"0 2px 12px rgba(232,201,109,0.40)",
              animation:"badgePop 0.3s ease",
            }}>
              🎁 {claimable.length} para receber
            </div>
          )}

          {/* Activate button */}
          {!master.isActive && (
            <button onClick={onActivate} style={{
              background:`linear-gradient(135deg,${master.accentColor}30,${master.accentColor}60)`,
              border:`1px solid ${master.accentColor}50`, borderRadius:10,
              padding:"8px 18px", cursor:"pointer", color: master.accentColor,
              fontWeight:900, fontSize:13,
              boxShadow:`0 2px 12px ${master.accentColor}30`,
            }}>
              ✦ Definir como Ativo
            </button>
          )}
          {master.isActive && (
            <div style={{
              background:"rgba(5,150,105,0.12)", border:"1px solid rgba(5,150,105,0.30)",
              borderRadius:10, padding:"8px 16px", color:"#34d399",
              fontWeight:800, fontSize:12,
            }}>✦ Mestre Ativo</div>
          )}
        </div>

        {/* Description */}
        <div style={{ padding:"16px 20px 0", flexShrink:0 }}>
          <p style={{ fontSize:13, color:"#6b7280", lineHeight:1.7, margin:0 }}>
            {master.description}
          </p>
        </div>

        {/* Rewards trail */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px 40px" }}>
          <div style={{
            fontSize:10, fontWeight:700, color:"#4b5563",
            textTransform:"uppercase", letterSpacing:"0.10em", marginBottom:14,
          }}>Recompensas por Nível</div>

          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {master.rewards.map((reward, idx) => {
              const reached   = master.currentLevel >= reward.level
              const claimable = reached && !reward.claimed
              const rColor    = rewardColor(reward.type)
              const isNext    = reward.level === master.currentLevel + 1

              return (
                <div key={reward.level} style={{
                  display:"flex", alignItems:"center", gap:12,
                  background: claimable
                    ? `linear-gradient(90deg,${rColor}08,rgba(255,255,255,0.04))`
                    : reached && reward.claimed
                    ? "rgba(255,255,255,0.015)"
                    : "rgba(255,255,255,0.025)",
                  border: `1px solid ${
                    claimable ? `${rColor}30` :
                    isNext ? "rgba(255,255,255,0.10)" :
                    "rgba(255,255,255,0.04)"
                  }`,
                  borderRadius:10, padding:"9px 14px",
                  opacity: !reached && !isNext ? 0.45 : 1,
                  transition:"all 0.2s",
                }}>
                  {/* Level number */}
                  <div style={{
                    width:32, height:32, borderRadius:8, flexShrink:0,
                    background: reached
                      ? `linear-gradient(135deg,${master.accentColor}20,${master.accentColor}40)`
                      : "rgba(255,255,255,0.04)",
                    border:`1px solid ${reached ? master.accentColor + "40" : "rgba(255,255,255,0.06)"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:900, fontSize:11,
                    color: reached ? master.accentColor : "#374151",
                  }}>{reward.level}</div>

                  {/* Icon */}
                  <span style={{ fontSize:18, flexShrink:0 }}>{rewardIcon(reward.type)}</span>

                  {/* Label */}
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color: reached ? "#f1f0ee" : "#6b7280" }}>
                      {reward.label}
                    </div>
                    {isNext && (
                      <div style={{ fontSize:10, color: master.accentColor, marginTop:1 }}>
                        Próxima recompensa
                      </div>
                    )}
                  </div>

                  {/* State */}
                  {reward.claimed && (
                    <span style={{ fontSize:11, color:"#374151", fontWeight:600 }}>✓ Recebido</span>
                  )}
                  {claimable && (
                    <button
                      onClick={() => onClaimReward(reward.level)}
                      style={{
                        background:`linear-gradient(135deg,${rColor}20,${rColor}40)`,
                        border:`1px solid ${rColor}50`, borderRadius:8,
                        padding:"5px 12px", cursor:"pointer", color: rColor,
                        fontWeight:800, fontSize:11, flexShrink:0,
                        boxShadow:`0 2px 8px ${rColor}25`,
                      }}>
                      Receber
                    </button>
                  )}
                  {!reached && !claimable && !isNext && (
                    <span style={{ fontSize:14, color:"#1f2937" }}>🔒</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%  { left:-100% }
          100%{ left: 200% }
        }
        @keyframes badgePop {
          0%  { transform:scale(0.8); opacity:0 }
          70% { transform:scale(1.05) }
          100%{ transform:scale(1);   opacity:1 }
        }
      `}</style>
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
      background:"rgba(0,0,0,0.85)", backdropFilter:"blur(10px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      animation:"fadeIn 0.3s ease",
    }} onClick={onClose}>
      <div style={{ textAlign:"center", pointerEvents:"none" }}>
        <div style={{
          fontSize:80, marginBottom:12,
          filter:`drop-shadow(0 0 40px ${master.accentColor})`,
          animation:"levelUpBounce 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        }}>⭐</div>
        <div style={{
          fontSize:14, fontWeight:700, color: master.accentColor,
          letterSpacing:"0.20em", textTransform:"uppercase", marginBottom:8,
        }}>Nível Alcançado!</div>
        <div style={{
          fontWeight:900, fontSize:56, lineHeight:1,
          background:`linear-gradient(135deg,#f1f0ee,${master.accentColor})`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          backgroundClip:"text", marginBottom:12,
        }}>Lv.{newLevel}</div>
        <div style={{ fontWeight:800, fontSize:18, color:"#f1f0ee" }}>{master.fullName}</div>
        <div style={{ color:"#6b7280", fontSize:13, marginTop:6 }}>Toque para continuar</div>
      </div>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes levelUpBounce {
          0%  { transform:scale(0.3) rotate(-20deg); opacity:0 }
          60% { transform:scale(1.2) rotate(5deg);  opacity:1 }
          100%{ transform:scale(1)   rotate(0deg);  opacity:1 }
        }
      `}</style>
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
      {/* Avatar */}
      <div style={{
        width:40, height:40, borderRadius:"50%", overflow:"hidden",
        border:`2px solid ${active.accentColor}`,
        background:`radial-gradient(circle,${active.bgColor},#08060a)`,
        flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <img src={active.iconPath} alt={active.name}
          style={{ width:"100%", height:"100%", objectFit:"cover" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none" }}/>
      </div>
      {/* Info */}
      <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
          <span style={{ fontWeight:800, fontSize:13, color:"#f1f0ee", lineHeight:1 }}>
            {active.name}
          </span>
          <span style={{ fontSize:10, color: active.accentColor, fontWeight:700 }}>
            Lv.{active.currentLevel}
          </span>
        </div>
        {/* XP bar mini */}
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

// ─── MAIN MasterScreen ────────────────────────────────────────────────────────
export default function MasterScreen({ onBack }: MasterScreenProps) {
  const [masters,      setMasters]      = useState<Master[]>([])
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [showDetail,   setShowDetail]   = useState(false)
  const [levelUpData,  setLevelUpData]  = useState<{ master: Master; newLevel: number } | null>(null)
  const [toast,        setToast]        = useState<string | null>(null)

  // Load on mount
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
        let xp    = m.currentXP + amount
        let level = m.currentLevel
        let leveled = false
        while (level < m.maxLevel) {
          const needed = xpRequiredForLevel(level)
          if (xp >= needed) { xp -= needed; level++; leveled = true }
          else break
        }
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
    showToast("✦ Mestre alterado com sucesso!")
    setShowDetail(false)
  }

  // Claim a reward
  const handleClaimReward = (masterId: string, level: number) => {
    setMasters(prev => {
      const next = prev.map(m => {
        if (m.id !== masterId) return m
        return {
          ...m,
          rewards: m.rewards.map(r =>
            r.level === level ? { ...r, claimed: true } : r
          ),
        }
      })
      saveMastersToStorage(next)
      return next
    })
    const reward = masters.find(m => m.id === masterId)?.rewards.find(r => r.level === level)
    if (reward) showToast(`🎁 ${reward.label} recebido!`)
  }

  const el  = selectedMaster ? elementStyle(selectedMaster.element) : null
  const rar = selectedMaster ? rarityStyle(selectedMaster.rarity)   : null

  return (
    <div style={{
      minHeight:"100vh", background:"linear-gradient(160deg,#090610 0%,#060408 60%,#080610 100%)",
      color:"#f1f0ee", fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex", flexDirection:"column", position:"relative", overflow:"hidden",
    }}>
      {/* Ambient glow */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", width:600, height:600, borderRadius:"50%", top:-200, left:-100, background:"radial-gradient(circle,rgba(88,28,220,0.08) 0%,transparent 70%)", filter:"blur(40px)" }}/>
        <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", bottom:-150, right:-100, background:"radial-gradient(circle,rgba(232,201,109,0.05) 0%,transparent 70%)", filter:"blur(40px)" }}/>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", top:70, left:"50%", transform:"translateX(-50%)", zIndex:9999,
          background:"rgba(12,10,6,0.96)", border:"1px solid rgba(232,201,109,0.35)",
          borderRadius:10, padding:"9px 20px", color:"#e8c96d", fontWeight:700, fontSize:13,
          backdropFilter:"blur(16px)", boxShadow:"0 4px 24px rgba(0,0,0,0.5)",
          whiteSpace:"nowrap", animation:"toastIn 0.25s ease",
        }}>{toast}</div>
      )}

      {/* Level-up overlay */}
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
        display:"flex", alignItems:"center", gap:12, padding:"14px 18px",
        background:"rgba(8,6,10,0.92)", backdropFilter:"blur(16px)",
        borderBottom:"1px solid rgba(255,255,255,0.06)", position:"sticky", top:0, zIndex:50,
      }}>
        <button onClick={onBack} style={{
          background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:8, width:36, height:36, cursor:"pointer", color:"#9ca3af",
          fontSize:16, display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <ArrowLeft size={18}/>
        </button>
        <div>
          <h1 style={{ fontWeight:900, fontSize:18, margin:0,
            background:"linear-gradient(135deg,#f1f0ee,#e8c96d)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
            Mestres
          </h1>
          <p style={{ color:"#4b5563", fontSize:11, margin:0 }}>Escolha seu parceiro de batalha</p>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex:1, overflowY:"auto", position:"relative", zIndex:1 }}>
        <div style={{ maxWidth:900, margin:"0 auto", padding:"20px 18px 80px" }}>

          {/* Active master hero */}
          {selectedMaster && (
            <div style={{
              background:`linear-gradient(135deg,${selectedMaster.bgColor}cc,rgba(8,6,10,0.95))`,
              border:`1px solid ${selectedMaster.accentColor}25`,
              borderRadius:20, padding:"20px", marginBottom:24,
              position:"relative", overflow:"hidden",
              boxShadow:`0 8px 40px ${selectedMaster.accentColor}10`,
            }}>
              {/* Glow */}
              <div style={{
                position:"absolute", inset:0, pointerEvents:"none",
                background:`radial-gradient(ellipse 60% 80% at 80% 50%,${selectedMaster.accentColor}08 0%,transparent 70%)`,
              }}/>

              <div style={{ display:"flex", alignItems:"center", gap:16, position:"relative" }}>
                {/* Art thumbnail */}
                <div style={{
                  width:90, height:90, borderRadius:16, overflow:"hidden",
                  background:`radial-gradient(circle,${selectedMaster.bgColor},#08060a)`,
                  border:`2px solid ${selectedMaster.accentColor}40`, flexShrink:0,
                  display:"flex", alignItems:"flex-end", justifyContent:"center",
                }}>
                  <img src={selectedMaster.artPath} alt={selectedMaster.name}
                    style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom" }}
                    onError={() => {}}/>
                </div>

                <div style={{ flex:1 }}>
                  {/* Badges */}
                  <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                    <span style={{
                      fontSize:9, fontWeight:800, color: el!.color, background: el!.bg,
                      padding:"2px 7px", borderRadius:4,
                    }}>{selectedMaster.element}</span>
                    <span style={{
                      fontSize:9, fontWeight:800, color: rar!.color, background: rar!.bg,
                      padding:"2px 7px", borderRadius:4,
                    }}>{selectedMaster.rarity}</span>
                    {selectedMaster.isActive && (
                      <span style={{
                        fontSize:9, fontWeight:800, color:"#34d399",
                        background:"rgba(52,211,153,0.12)", padding:"2px 7px", borderRadius:4,
                      }}>✦ ATIVO</span>
                    )}
                  </div>

                  <h2 style={{ fontWeight:900, fontSize:20, margin:"0 0 4px",
                    background:`linear-gradient(135deg,#f1f0ee,${selectedMaster.accentColor})`,
                    WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                    {selectedMaster.fullName}
                  </h2>
                  <p style={{ fontSize:12, color:"#4b5563", fontStyle:"italic", margin:"0 0 10px" }}>
                    {selectedMaster.quote}
                  </p>

                  {/* XP */}
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:11, color:"#6b7280" }}>
                      Lv.{selectedMaster.currentLevel} · {selectedMaster.currentXP}/{selectedMaster.xpToNext} XP
                    </span>
                    <span style={{ fontSize:11, color: selectedMaster.accentColor, fontWeight:700 }}>
                      {selectedMaster.maxLevel - selectedMaster.currentLevel} níveis restantes
                    </span>
                  </div>
                  <XPBar current={selectedMaster.currentXP} total={selectedMaster.xpToNext} color={selectedMaster.accentColor}/>
                </div>

                {/* Detail button */}
                <button onClick={() => setShowDetail(true)} style={{
                  background:`${selectedMaster.accentColor}15`,
                  border:`1px solid ${selectedMaster.accentColor}35`,
                  borderRadius:12, padding:"10px 16px",
                  cursor:"pointer", color: selectedMaster.accentColor,
                  fontWeight:800, fontSize:13, flexShrink:0,
                  boxShadow:`0 2px 12px ${selectedMaster.accentColor}20`,
                  transition:"all 0.2s",
                }}>
                  Ver Progressão →
                </button>
              </div>

              {/* Dev: add XP button (remove in production) */}
              <button
                onClick={() => handleAddXP(selectedMaster.id, 200)}
                style={{
                  position:"absolute", bottom:14, right:16,
                  background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:7, padding:"4px 10px", cursor:"pointer",
                  color:"#374151", fontSize:10, fontWeight:600,
                }}>
                +200 XP (teste)
              </button>
            </div>
          )}

          {/* Masters grid */}
          <div style={{
            fontSize:10, fontWeight:700, color:"#374151",
            textTransform:"uppercase", letterSpacing:"0.10em", marginBottom:14,
          }}>Todos os Mestres</div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
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

          {/* Info box */}
          <div style={{
            marginTop:24, background:"rgba(232,201,109,0.04)",
            border:"1px solid rgba(232,201,109,0.12)", borderRadius:14,
            padding:"14px 16px",
          }}>
            <div style={{ fontWeight:800, fontSize:12, color:"#e8c96d", marginBottom:8 }}>
              💡 Como ganhar XP de Mestre?
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                ["⚔️", "Duelo PvE",   "+50–100 XP"],
                ["🏆", "Duelo PvP",   "+80–140 XP"],
                ["💀", "Chefão",       "+120–180 XP"],
                ["⚔", "Guerra",        "+100–160 XP"],
                ["🃏", "Draft",        "+70–120 XP"],
                ["🎯", "Missões",      "+30–80 XP"],
              ].map(([ic, name, xp]) => (
                <div key={name as string} style={{
                  display:"flex", alignItems:"center", gap:8,
                  background:"rgba(255,255,255,0.02)", borderRadius:10, padding:"8px 10px",
                }}>
                  <span style={{ fontSize:18 }}>{ic}</span>
                  <div>
                    <div style={{ fontSize:11, color:"#9ca3af", fontWeight:600 }}>{name}</div>
                    <div style={{ fontSize:10, color:"#e8c96d" }}>{xp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity:0; transform:translateX(-50%) translateY(-8px) }
          to   { opacity:1; transform:translateX(-50%) translateY(0) }
        }
        @keyframes shimmer {
          0%  { left:-100% }
          100%{ left: 200% }
        }
      `}</style>
    </div>
  )
}
