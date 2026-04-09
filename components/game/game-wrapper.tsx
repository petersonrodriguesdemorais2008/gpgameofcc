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
import LoadingScreen from "./loading-screen"

export type GameScreen =
  | "menu"
  | "gacha"
  | "collection"
  | "deck-builder"
  | "duel-bot"
  | "duel-player"
  | "history"
  | "settings"
  | "create-room"
  | "join-room"
  | "friends"
  | "shop"
  | "profile"
  | "missions"

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
        <DuelScreen mode={duelMode} onBack={() => navigateTo("menu")} />
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
    </>
  )
}

export type GameScreen =
  | "menu"
  | "gacha"
  | "collection"
  | "deck-builder"
  | "duel-bot"
  | "duel-player"
  | "history"
  | "settings"
  | "create-room"
  | "join-room"
  | "friends"
  | "shop"
  | "profile"
  | "missions"

export function GameWrapper() {
  const { playerProfile, mobileMode } = useGame()
  const [currentScreen, setCurrentScreen] = useState<GameScreen>("menu")
  const [duelMode, setDuelMode] = useState<"bot" | "player">("bot")
  const [showSetup, setShowSetup] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [menuMessage, setMenuMessage] = useState<string | null>(null)
  const [showTitle, setShowTitle] = useState(true)
  const [appReady, setAppReady] = useState(false)

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
      // Check if player has completed setup
      if (!playerProfile.hasCompletedSetup) {
        setShowSetup(true)
      }
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
    } else {
      setCurrentScreen(screen)
    }
  }

  const handleSetupComplete = () => {
    setShowSetup(false)
  }

  // Show title screen first
  if (showTitle) {
    return <TitleScreen onEnter={() => setShowTitle(false)} />
  }

  // Show loading state briefly
  if (!isLoaded) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
        suppressHydrationWarning={true}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 animate-pulse">Carregando...</p>
        </div>
      </div>
    )
  }

  // Show setup screen for first-time players
  if (showSetup) {
    return <PlayerSetupScreen onComplete={handleSetupComplete} />
  }

  return (
    <>
      {currentScreen === "menu" && <MainMenu onNavigate={navigateTo} statusMessage={menuMessage} onClearMessage={() => setMenuMessage(null)} />}
      {currentScreen === "gacha" && <GachaScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "collection" && <CollectionScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "deck-builder" && <DeckBuilderScreen onBack={() => navigateTo("menu")} />}
      {(currentScreen === "duel-bot" || currentScreen === "duel-player") && (
        <DuelScreen mode={duelMode} onBack={() => navigateTo("menu")} />
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
    </>
  )
}
