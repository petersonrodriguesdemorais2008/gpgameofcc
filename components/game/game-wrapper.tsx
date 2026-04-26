"use client"

import { useState, useEffect } from "react"
import { useGame } from "@/contexts/game-context"
import { PlayerSetupScreen } from "./player-setup-screen"
import MainMenu from "./main-menu"
import GachaScreen from "./gacha-screen"
import CollectionScreen from "./collection-screen"
import DeckBuilderScreen from "./deck-builder-screen"
import DuelScreen from "./duel-screen"
import HistoryScreen from "./history-screen"
import SettingsScreen from "./settings-screen"
import FriendsScreen from "./friends-screen"
import TitleScreen from "./title-screen"
import ShopScreen from "./shop-screen"
import ProfileScreen from "./profile-screen"
import MissionsScreen from "./missions-screen"
import GearPassScreen from "./gear-pass-screen"
import StoryModeScreen from "./story-mode-screen"
import LoadingScreen from "./loading-screen"
import { trackDailyLogin } from "@/lib/mission-tracker"
import DraftDuelScreen from "./draft-duel-screen"
import RoguelikeScreen from "./roguelike-screen"
import CatastropheScreen from "./catastrophe-screen"

export type GameScreen =
  | "menu"
  | "gacha"
  | "collection"
  | "deck-builder"
  | "duel-bot"
  | "duel-player"
  | "duel-draft"
  | "duel-roguelike"
  | "duel-catastrophe"
  | "history"
  | "settings"
  | "create-room"
  | "join-room"
  | "friends"
  | "shop"
  | "profile"
  | "missions"
  | "gear-pass"
  | "story"

export function GameWrapper() {
  const { playerProfile, mobileMode } = useGame()
  const [currentScreen, setCurrentScreen] = useState<GameScreen>("menu")
  const [duelMode, setDuelMode] = useState<"bot" | "player">("bot")
  const [showSetup, setShowSetup] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [menuMessage, setMenuMessage] = useState<string | null>(null)
  const [showTitle, setShowTitle] = useState(true)
  // Assets loading gate — shown before everything else
  const [assetsReady, setAssetsReady] = useState(false)

  // Toggle mobile-mode class on html element
  useEffect(() => {
    const html = document.documentElement
    if (mobileMode) {
      html.classList.add("mobile-mode")
    } else {
      html.classList.remove("mobile-mode")
    }
    return () => html.classList.remove("mobile-mode")
  }, [mobileMode])

  useEffect(() => {
    // Wait for profile to load from localStorage
    const timer = setTimeout(() => {
      setIsLoaded(true)
      if (!playerProfile.hasCompletedSetup) {
        setShowSetup(true)
      }
      // Registra login diário para missões
      trackDailyLogin()
    }, 100)
    return () => clearTimeout(timer)
  }, [playerProfile.hasCompletedSetup])

  const navigateTo = (screen: GameScreen) => {
    if (screen === "duel-bot") {
      setDuelMode("bot")
      setCurrentScreen("duel-bot")
    } else if (screen === "duel-player") {
      setDuelMode("player")
      setCurrentScreen("duel-player")
    } else if (screen === "duel-draft") {
      setCurrentScreen("duel-draft")
    } else if (screen === "duel-roguelike") {
      setCurrentScreen("duel-roguelike")
    } else if (screen === "duel-catastrophe") {
      setCurrentScreen("duel-catastrophe")
    } else {
      setCurrentScreen(screen)
    }
  }

  const handleSetupComplete = () => {
    setShowSetup(false)
  }

  // 1️⃣ Loading screen first — precarrega todas as imagens do jogo
  if (!assetsReady) {
    return <LoadingScreen onComplete={() => setAssetsReady(true)} />
  }

  // 2️⃣ Tela de título
  if (showTitle) {
    return <TitleScreen onEnter={() => setShowTitle(false)} />
  }

  // 3️⃣ Estado mínimo de carregamento do perfil
  if (!isLoaded) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(160deg,#020610,#050d1a)" }}
        suppressHydrationWarning={true}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
          <p className="text-cyan-400/60 text-xs font-mono tracking-widest">CARREGANDO...</p>
        </div>
      </div>
    )
  }

  // 4️⃣ Setup de primeiro acesso
  if (showSetup) {
    return <PlayerSetupScreen onComplete={handleSetupComplete} />
  }

  // 5️⃣ Telas do jogo
  return (
    <>
      {currentScreen === "menu" && <MainMenu onNavigate={navigateTo} statusMessage={menuMessage} onClearMessage={() => setMenuMessage(null)} />}
      {currentScreen === "gacha" && <GachaScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "collection" && <CollectionScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "deck-builder" && <DeckBuilderScreen onBack={() => navigateTo("menu")} />}
      {(currentScreen === "duel-bot" || currentScreen === "duel-player") && (
        <DuelScreen mode={duelMode} onBack={() => {
          // If returning from a story battle, go back to story screen
          const storyBattle = (() => {
            try { const r = localStorage.getItem("gpgame_story_battle_pending"); return r ? JSON.parse(r) : null } catch { return null }
          })()
          if (storyBattle) {
            navigateTo("story")
          } else {
            navigateTo("menu")
          }
        }}
        startingLP={(() => {
          try {
            const r = localStorage.getItem("gpgame_story_battle_pending")
            if (!r) return undefined
            const { lp } = JSON.parse(r)
            return lp ?? undefined
          } catch { return undefined }
        })()}
        />
      )}
      {currentScreen === "duel-draft" && (
        <DraftDuelScreen onBack={() => navigateTo("menu")} />
      )}
      {currentScreen === "duel-roguelike" && (
        <RoguelikeScreen onBack={() => navigateTo("menu")} />
      )}
      {currentScreen === "duel-catastrophe" && (
        <CatastropheScreen onBack={() => navigateTo("menu")} />
      )}
      {currentScreen === "history" && <HistoryScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "settings" && <SettingsScreen
        onBack={(msg?: string) => {
          if (msg) setMenuMessage(msg)
          navigateTo("menu")
        }}
        onReturnToTitle={() => {
          setCurrentScreen("menu")
          setShowTitle(true)
        }}
      />}
      {currentScreen === "friends" && <FriendsScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "shop" && <ShopScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "profile" && <ProfileScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "missions" && <MissionsScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "gear-pass" && <GearPassScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "story" && (
        <StoryModeScreen
          onBack={() => navigateTo("menu")}
          onStartBattle={(mode, stageId) => {
            // Save the pending battle so story mode can handle the result
            localStorage.setItem("gpgame_story_battle_pending", JSON.stringify({ stageId, won: false }))
            setDuelMode("bot")
            navigateTo("duel-bot")
          }}
        />
      )}
    </>
  )
}

