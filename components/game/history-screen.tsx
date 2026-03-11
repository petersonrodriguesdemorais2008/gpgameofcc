"use client"

import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Trophy, X, Swords, History } from "lucide-react"

interface HistoryScreenProps {
  onBack: () => void
}

export default function HistoryScreen({ onBack }: HistoryScreenProps) {
  const { t } = useLanguage()
  const { matchHistory } = useGame()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString()
  }

  const wins = matchHistory.filter((m) => m.result === "won").length
  const losses = matchHistory.filter((m) => m.result === "lost").length
  const winRate = matchHistory.length > 0 ? Math.round((wins / matchHistory.length) * 100) : 0

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-amber-900/10 to-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-amber-400/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-r from-black/80 via-amber-900/30 to-black/80 border-b border-amber-500/30 backdrop-blur-sm">
        <Button onClick={onBack} variant="ghost" className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">
          <ArrowLeft className="mr-2 h-5 w-5" />
          {t("back")}
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
          <History className="w-6 h-6 text-amber-400" />
          {t("matchHistory")}
        </h1>
        <div className="w-20" />
      </div>

      {/* Stats Summary */}
      <div className="relative z-10 p-4">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-2xl p-4 border border-green-500/30 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-3xl font-bold text-green-400">{wins}</p>
            <p className="text-sm text-green-300/70">Vitorias</p>
          </div>
          <div className="bg-gradient-to-br from-red-900/50 to-rose-900/50 rounded-2xl p-4 border border-red-500/30 text-center">
            <X className="w-8 h-8 mx-auto mb-2 text-red-400" />
            <p className="text-3xl font-bold text-red-400">{losses}</p>
            <p className="text-sm text-red-300/70">Derrotas</p>
          </div>
          <div className="bg-gradient-to-br from-amber-900/50 to-yellow-900/50 rounded-2xl p-4 border border-amber-500/30 text-center">
            <Swords className="w-8 h-8 mx-auto mb-2 text-amber-400" />
            <p className="text-3xl font-bold text-amber-400">{winRate}%</p>
            <p className="text-sm text-amber-300/70">Taxa de Vitoria</p>
          </div>
        </div>
      </div>

      {/* History list */}
      <div className="relative z-10 flex-1 p-4 overflow-y-auto">
        {matchHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Swords className="w-16 h-16 mb-4 opacity-30" />
            <p>Nenhuma partida registrada ainda.</p>
            <p className="text-sm mt-2">Jogue algumas partidas para ver seu historico!</p>
          </div>
        ) : (
          <div className="grid gap-3 max-w-2xl mx-auto">
            {matchHistory.map((match, index) => (
              <div
                key={match.id}
                className={`p-4 rounded-2xl flex items-center justify-between backdrop-blur-sm transition-all hover:scale-[1.02] ${
                  match.result === "won"
                    ? "bg-gradient-to-r from-green-900/60 to-emerald-900/60 border border-green-500/40 hover:border-green-400/60"
                    : "bg-gradient-to-r from-red-900/60 to-rose-900/60 border border-red-500/40 hover:border-red-400/60"
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                      match.result === "won"
                        ? "bg-gradient-to-br from-green-500 to-emerald-600"
                        : "bg-gradient-to-br from-red-500 to-rose-600"
                    }`}
                  >
                    {match.result === "won" ? (
                      <Trophy className="w-7 h-7 text-white" />
                    ) : (
                      <X className="w-7 h-7 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-white text-lg">{match.result === "won" ? t("won") : t("lost")}</div>
                    <div className="text-sm text-slate-400">{match.mode === "bot" ? t("vsBot2") : t("vsPlayer2")}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-300 font-medium">{match.deckUsed}</div>
                  <div className="text-xs text-slate-500">{formatDate(match.date)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
