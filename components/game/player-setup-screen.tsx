"use client"

import { useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, PROFILE_ICONS } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { User, Check, Sparkles } from "lucide-react"
import Image from "next/image"

interface PlayerSetupScreenProps {
  onComplete: () => void
}

export function PlayerSetupScreen({ onComplete }: PlayerSetupScreenProps) {
  const { t } = useLanguage()
  const { updatePlayerProfile, playerProfile } = useGame()
  const [step, setStep] = useState<"name" | "icon">("name")
  const [playerName, setPlayerName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const handleNameSubmit = () => {
    if (playerName.trim().length >= 2) {
      setStep("icon")
    }
  }

  const handleIconSelect = (iconImage: string) => {
    setSelectedIcon(iconImage)
  }

  const handleComplete = () => {
    if (!playerName.trim() || !selectedIcon) return

    setIsAnimating(true)
    
    setTimeout(() => {
      updatePlayerProfile({
        name: playerName.trim(),
        avatarUrl: selectedIcon,
        hasCompletedSetup: true,
      })
      onComplete()
    }, 1500)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 via-transparent to-cyan-900/20" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/40 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Completion animation overlay */}
      {isAnimating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center animate-pulse">
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-cyan-400 shadow-2xl shadow-cyan-500/50 mx-auto animate-bounce">
                <Image
                  src={selectedIcon || "/placeholder.svg"}
                  alt="Profile"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -inset-4 border-4 border-cyan-400/30 rounded-full animate-ping" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{playerName}</h2>
            <p className="text-cyan-400 text-lg flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Bem-vindo ao Gear Perks!
              <Sparkles className="w-5 h-5" />
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black tracking-tighter mb-2">
            <span className="bg-gradient-to-r from-cyan-300 via-white to-cyan-300 bg-clip-text text-transparent">
              GEAR
            </span>
            <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent ml-2">
              PERKS
            </span>
          </h1>
          <p className="text-slate-400 text-sm">{step === "name" ? "Crie seu perfil" : "Escolha seu avatar"}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step === "name" ? "text-cyan-400" : "text-green-400"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step === "name" ? "border-cyan-400 bg-cyan-400/20" : "border-green-400 bg-green-400/20"
            }`}>
              {step === "icon" ? <Check className="w-4 h-4" /> : "1"}
            </div>
            <span className="text-sm font-medium">Nome</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-700" />
          <div className={`flex items-center gap-2 ${step === "icon" ? "text-cyan-400" : "text-slate-500"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step === "icon" ? "border-cyan-400 bg-cyan-400/20" : "border-slate-600 bg-slate-800"
            }`}>
              2
            </div>
            <span className="text-sm font-medium">Avatar</span>
          </div>
        </div>

        {/* Name input step */}
        {step === "name" && (
          <div className="glass rounded-2xl p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Qual e o seu nome?</h2>
                <p className="text-slate-400 text-sm">Este nome sera visivel para outros jogadores</p>
              </div>
            </div>

            <Input
              type="text"
              placeholder="Digite seu nome..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className="bg-slate-800/50 border-slate-600 text-white text-lg h-14 mb-4 focus:border-cyan-400"
              onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
            />

            <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
              <span>Minimo 2 caracteres</span>
              <span>{playerName.length}/20</span>
            </div>

            <Button
              onClick={handleNameSubmit}
              disabled={playerName.trim().length < 2}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Icon selection step */}
        {step === "icon" && (
          <div className="glass rounded-2xl p-6 animate-fadeIn">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-2">Escolha seu avatar</h2>
              <p className="text-slate-400 text-sm">Selecione uma foto de perfil</p>
            </div>

            {/* Selected preview */}
            <div className="flex justify-center mb-6">
              <div className={`relative ${selectedIcon ? "scale-100" : "scale-90"} transition-transform duration-300`}>
                <div className={`w-24 h-24 rounded-full overflow-hidden border-4 ${
                  selectedIcon ? "border-cyan-400 shadow-lg shadow-cyan-500/50" : "border-slate-600"
                }`}>
                  {selectedIcon ? (
                    <Image
                      src={selectedIcon || "/placeholder.svg"}
                      alt="Selected"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      <User className="w-10 h-10 text-slate-500" />
                    </div>
                  )}
                </div>
                {selectedIcon && (
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-cyan-500 flex items-center justify-center border-2 border-slate-900">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Icon grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {PROFILE_ICONS.map((icon) => (
                <button
                  key={icon.id}
                  onClick={() => handleIconSelect(icon.image)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-[3px] transition-all duration-200 ${
                    selectedIcon === icon.image
                      ? "border-cyan-400 scale-105 shadow-lg shadow-cyan-500/40"
                      : "border-slate-600 hover:border-slate-400 hover:scale-[1.02]"
                  }`}
                >
                  <Image
                    src={icon.image || "/placeholder.svg"}
                    alt={icon.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                  {selectedIcon === icon.image && (
                    <div className="absolute inset-0 bg-cyan-400/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <p className="text-white text-xs font-medium text-center truncate">{icon.name}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setStep("name")}
                variant="outline"
                className="flex-1 h-12 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Voltar
              </Button>
              <Button
                onClick={handleComplete}
                disabled={!selectedIcon}
                className="flex-1 h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Comecar!
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
