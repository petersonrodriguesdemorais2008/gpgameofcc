"use client"

import { useMemo } from "react"

// Premium floating particles background
export function PremiumParticles({ 
  count = 30,
  colors = ["#38bdf8", "#a855f7", "#fbbf24", "#22d3ee", "#f472b6"],
  className = ""
}: { 
  count?: number
  colors?: string[]
  className?: string 
}) {
  const particles = useMemo(() => 
    Array.from({ length: count }, (_, i) => {
      const colorIndex = i % colors.length
      return {
        id: i,
        size: 2 + (i % 4),
        x: (i * 3.3) % 100,
        y: (i * 7.1) % 100,
        color: colors[colorIndex],
        duration: 8 + (i % 8) * 2,
        delay: (i * 0.5) % 6,
      }
    }),
  [count, colors])

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-particle-float"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}, 0 0 ${p.size * 8}px ${p.color}50`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

// Cinematic light rays effect
export function LightRays({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          background: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 100px,
              rgba(56, 189, 248, 0.1) 100px,
              rgba(56, 189, 248, 0.1) 101px
            )
          `,
          animation: "lightRayShift 20s linear infinite",
        }}
      />
      <div 
        className="absolute top-0 left-1/4 w-96 h-full opacity-[0.04]"
        style={{
          background: "linear-gradient(180deg, rgba(168, 85, 247, 0.3) 0%, transparent 70%)",
          filter: "blur(60px)",
          transform: "skewX(-15deg)",
        }}
      />
      <div 
        className="absolute top-0 right-1/4 w-80 h-full opacity-[0.03]"
        style={{
          background: "linear-gradient(180deg, rgba(251, 191, 36, 0.3) 0%, transparent 60%)",
          filter: "blur(50px)",
          transform: "skewX(10deg)",
        }}
      />
    </div>
  )
}

// Premium gradient background with aurora effect
export function AuroraBackground({ variant = "default" }: { variant?: "default" | "warm" | "cool" | "purple" }) {
  const gradients = {
    default: {
      base: "from-slate-950 via-slate-900 to-slate-950",
      aurora1: "rgba(56, 189, 248, 0.12)",
      aurora2: "rgba(168, 85, 247, 0.10)",
      aurora3: "rgba(251, 191, 36, 0.06)",
    },
    warm: {
      base: "from-slate-950 via-amber-950/30 to-slate-950",
      aurora1: "rgba(251, 191, 36, 0.15)",
      aurora2: "rgba(249, 115, 22, 0.10)",
      aurora3: "rgba(168, 85, 247, 0.05)",
    },
    cool: {
      base: "from-slate-950 via-cyan-950/30 to-slate-950",
      aurora1: "rgba(34, 211, 238, 0.12)",
      aurora2: "rgba(56, 189, 248, 0.10)",
      aurora3: "rgba(168, 85, 247, 0.06)",
    },
    purple: {
      base: "from-slate-950 via-purple-950/30 to-slate-950",
      aurora1: "rgba(168, 85, 247, 0.15)",
      aurora2: "rgba(139, 92, 246, 0.10)",
      aurora3: "rgba(56, 189, 248, 0.05)",
    },
  }

  const g = gradients[variant]

  return (
    <div className="fixed inset-0">
      <div className={`absolute inset-0 bg-gradient-to-br ${g.base}`} />
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 60% at 50% -10%, ${g.aurora1} 0%, transparent 60%),
            radial-gradient(ellipse 80% 50% at 80% 110%, ${g.aurora2} 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 10% 90%, ${g.aurora3} 0%, transparent 40%)
          `,
        }}
      />
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 1px, transparent 1px),
            radial-gradient(circle at 75% 75%, rgba(255,255,255,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px, 90px 90px",
        }}
      />
    </div>
  )
}

// Premium glass panel with depth
export function GlassPanel({ 
  children, 
  className = "",
  intensity = "medium",
  glow = false,
  glowColor = "cyan"
}: { 
  children: React.ReactNode
  className?: string
  intensity?: "light" | "medium" | "strong"
  glow?: boolean
  glowColor?: "cyan" | "gold" | "purple" | "pink"
}) {
  const intensityStyles = {
    light: "bg-white/[0.03] border-white/[0.08]",
    medium: "bg-white/[0.06] border-white/[0.12]",
    strong: "bg-white/[0.10] border-white/[0.18]",
  }

  const glowColors = {
    cyan: "shadow-cyan-500/20",
    gold: "shadow-amber-500/20",
    purple: "shadow-purple-500/20",
    pink: "shadow-pink-500/20",
  }

  return (
    <div 
      className={`
        backdrop-blur-xl border rounded-2xl
        ${intensityStyles[intensity]}
        ${glow ? `shadow-xl ${glowColors[glowColor]}` : "shadow-xl shadow-black/20"}
        ${className}
      `}
      style={{
        boxShadow: glow 
          ? `0 8px 32px rgba(0,0,0,0.3), 0 0 60px ${glowColor === "cyan" ? "rgba(34, 211, 238, 0.15)" : glowColor === "gold" ? "rgba(251, 191, 36, 0.15)" : glowColor === "purple" ? "rgba(168, 85, 247, 0.15)" : "rgba(236, 72, 153, 0.15)"}`
          : "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {children}
    </div>
  )
}

// Premium button with multiple variants
export function PremiumButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  onClick,
  icon,
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "gold" | "danger" | "ghost"
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
  disabled?: boolean
  onClick?: () => void
  icon?: React.ReactNode
}) {
  const variants = {
    primary: "bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50",
    secondary: "bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/20 hover:shadow-slate-500/30",
    gold: "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-amber-950 shadow-lg shadow-amber-500/40 hover:shadow-amber-500/60",
    danger: "bg-gradient-to-r from-red-600 via-rose-500 to-red-600 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50",
    ghost: "bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20",
  }

  const sizes = {
    sm: "h-9 px-4 text-sm rounded-lg",
    md: "h-11 px-6 text-base rounded-xl",
    lg: "h-14 px-8 text-lg rounded-xl",
    xl: "h-16 px-10 text-xl rounded-2xl",
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden font-semibold transition-all duration-300
        ${variants[variant]}
        ${sizes[size]}
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"}
        ${className}
      `}
      style={{
        backgroundSize: "200% 100%",
        animation: disabled ? "none" : "shimmerBg 3s ease infinite",
      }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {icon}
        {children}
      </span>
      {!disabled && (
        <div 
          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
            transform: "skewX(-15deg) translateX(-100%)",
            animation: "shineSlide 2s ease-in-out infinite",
          }}
        />
      )}
    </button>
  )
}

// Animated border glow effect
export function GlowBorder({ 
  children, 
  className = "",
  color = "cyan",
  animated = true
}: { 
  children: React.ReactNode
  className?: string
  color?: "cyan" | "gold" | "purple" | "rainbow"
  animated?: boolean
}) {
  const colorStyles = {
    cyan: "from-cyan-500 via-blue-500 to-cyan-500",
    gold: "from-amber-500 via-yellow-400 to-amber-500",
    purple: "from-purple-500 via-pink-500 to-purple-500",
    rainbow: "from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500",
  }

  return (
    <div className={`relative p-[2px] rounded-2xl ${className}`}>
      <div 
        className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${colorStyles[color]} opacity-75`}
        style={{
          backgroundSize: animated ? "200% 200%" : "100% 100%",
          animation: animated ? "gradientShift 3s ease infinite" : "none",
        }}
      />
      <div className="relative bg-slate-900/95 rounded-2xl backdrop-blur-sm">
        {children}
      </div>
    </div>
  )
}

// Rarity badge with premium styling
export function RarityBadge({ 
  rarity, 
  size = "md" 
}: { 
  rarity: "R" | "SR" | "UR" | "LR"
  size?: "sm" | "md" | "lg"
}) {
  const styles = {
    R: "bg-slate-500/80 text-slate-100 shadow-slate-500/30",
    SR: "bg-purple-500/80 text-purple-100 shadow-purple-500/40",
    UR: "bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 shadow-amber-500/50",
    LR: "bg-gradient-to-r from-red-500 via-rose-400 to-pink-500 text-white shadow-red-500/50 animate-pulse",
  }

  const sizes = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-3 py-1.5",
  }

  return (
    <span 
      className={`
        font-bold rounded-md shadow-lg
        ${styles[rarity]}
        ${sizes[size]}
      `}
    >
      {rarity}
    </span>
  )
}

// Add required keyframe animations to the component
export function PremiumAnimationStyles() {
  return (
    <style jsx global>{`
      @keyframes particle-float {
        0%, 100% {
          transform: translateY(0) translateX(0) scale(1);
          opacity: 0.4;
        }
        25% {
          transform: translateY(-30px) translateX(10px) scale(1.1);
          opacity: 0.8;
        }
        50% {
          transform: translateY(-50px) translateX(-5px) scale(1.2);
          opacity: 0.6;
        }
        75% {
          transform: translateY(-30px) translateX(15px) scale(1.1);
          opacity: 0.8;
        }
      }
      
      .animate-particle-float {
        animation: particle-float 8s ease-in-out infinite;
      }
      
      @keyframes lightRayShift {
        0% { transform: translateX(-100px); }
        100% { transform: translateX(100px); }
      }
      
      @keyframes shimmerBg {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      @keyframes shineSlide {
        0% { transform: skewX(-15deg) translateX(-200%); }
        100% { transform: skewX(-15deg) translateX(200%); }
      }
      
      @keyframes gradientShift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
    `}</style>
  )
}
