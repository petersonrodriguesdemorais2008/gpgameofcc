"use client"

import { useState, useEffect, useRef } from "react"
import { useGame } from "@/contexts/game-context"
import { PlayerSetupScreen } from "./player-setup-screen"
import MainMenu, { pauseMenuMusic, resumeMenuMusic } from "./main-menu"
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
import EventsScreen, { EVENT_BATTLE_KEY } from "./events-screen"
import MasterScreen from "./master-screen"
import LoadingScreen from "./loading-screen"
import { trackDailyLogin } from "@/lib/mission-tracker"
import DraftDuelScreen from "./draft-duel-screen"
import RoguelikeScreen from "./roguelike-screen"
import InventoryScreen from "./inventory-screen"
import CatastropheScreen from "./catastrophe-screen"
// ── TUTORIAL ──────────────────────────────────────────────────────────────────
import TutorialScreen, { TutorialGameOverlay, buildStarterDeckGrant, type TutorialMasterId } from "./tutorial-screen"
import { loadMastersFromStorage, saveMastersToStorage } from "@/lib/masters-data"
// ─────────────────────────────────────────────────────────────────────────────

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
  | "guild"
  | "masters"
  | "events"
  | "inventory"

export function GameWrapper() {
  const { playerProfile, mobileMode, addToCollection, saveDeck, coins, setCoins } = useGame()
  const [currentScreen, setCurrentScreen] = useState<GameScreen>("menu")
  const [duelMode, setDuelMode] = useState<"bot" | "player">("bot")
  const [showSetup, setShowSetup] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [menuMessage, setMenuMessage] = useState<string | null>(null)
  const [showTitle, setShowTitle] = useState(true)
  // Assets loading gate — shown before everything else
  const [assetsReady, setAssetsReady] = useState(false)
  // ── TUTORIAL ──────────────────────────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialOverlayActive, setTutorialOverlayActive] = useState(false)
  const [tutorialOverlayMaster, setTutorialOverlayMaster] = useState<TutorialMasterId | null>(null)
  /** true quando o overlay do tutorial navegou para o duelo real (duel-sim phase) */
  const [tutorialInDuel, setTutorialInDuel] = useState(false)
  /** true quando o jogador volta do duelo real — sinaliza o overlay para avançar para post-duel-menu */
  const [tutorialPostDuel, setTutorialPostDuel] = useState(false)
  // ─────────────────────────────────────────────────────────────────────────
  // ── RESET DE CONTA: detecta quando hasCompletedSetup vai de true → false
  //    NA MESMA sessão (ou seja, não é o boot normal de uma conta nova, é um
  //    "Apagar Dados" no meio do jogo) para mandar de volta pra Title Screen.
  const sawCompletedSetupRef = useRef(false)

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

  // ── TUTORIAL: defende contra a música do menu "ressuscitando" sozinha ──────
  // O main-menu.tsx mantém seu áudio em um objeto fora do ciclo de vida do
  // componente (por isso pauseMenuMusic()/resumeMenuMusic() funcionam mesmo
  // com <MainMenu/> desmontado). Se ele tiver sua própria lógica de
  // pausar/retomar ao trocar de aba (visibilitychange), essa lógica continua
  // ativa mesmo estando nós numa tela PRÉ-jogo (Title/Setup/Tutorial) — então
  // voltar pra aba pode "ressuscitar" a OST do menu bem no meio do Tutorial.
  // Aqui a gente reforça a pausa logo depois, só nessas telas pré-jogo.
  useEffect(() => {
    const isPreGameScreen = showTitle || showSetup || showTutorial
    if (!isPreGameScreen) return

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // pequeno atraso pra rodar DEPOIS de qualquer auto-resume interno
        setTimeout(() => pauseMenuMusic(), 60)
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [showTitle, showSetup, showTutorial])
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Wait for profile to load from localStorage
    const timer = setTimeout(() => {
      setIsLoaded(true)

      if (playerProfile.hasCompletedSetup) {
        // Conta com setup completo — lembra disso pra detectar um possível
        // reset mais tarde nesta mesma sessão.
        sawCompletedSetupRef.current = true

        // ── TUTORIAL: conta já tinha setup ANTES desta feature existir →
        // mostra o tutorial uma única vez "com efeito retroativo".
        // Escopado por playerProfile.id: cada conta (inclusive múltiplas
        // contas no mesmo navegador) tem sua própria chave independente.
        if (playerProfile.id) {
          const tutorialDone = !!localStorage.getItem(`gpgame_tutorial_done_${playerProfile.id}`)
          const tutorialStarted = !!localStorage.getItem(`gpgame_tutorial_started_${playerProfile.id}`)
          if (!tutorialDone) {
            if (tutorialStarted) {
              // O jogador já tinha ENTRADO na tela do tutorial (lore ou
              // seleção de Mestre) nesta conta, mas recarregou a página
              // ANTES de escolher um Mestre — showTutorial/showSetup são
              // estado local do React, então se perdem no recarregamento,
              // e sem essa checagem o jogador cairia direto no jogo sem
              // nunca ter recebido o Deck Inicial (só é concedido dentro de
              // handleTutorialComplete, ao escolher o Mestre). Em vez de
              // tentar retomar de onde parou, reseta por completo: volta
              // pro formulário de nome, do mesmo jeito que uma conta nova.
              setShowSetup(true)
            } else {
              setShowTutorial(true)
            }
          }
        }
      } else if (sawCompletedSetupRef.current) {
        // ── RESET DE CONTA: hasCompletedSetup acabou de virar false DEPOIS de
        // já ter sido true nesta sessão → o jogador apagou os dados da conta
        // agora mesmo (Configurações → Apagar Dados). Volta pra Title Screen
        // (não direto pro formulário de nome) e silencia a música do menu,
        // que continuaria tocando em segundo plano sem isso.
        sawCompletedSetupRef.current = false
        pauseMenuMusic()
        setShowSetup(true)   // fica pronto, mas só aparece depois da Title Screen
        setShowTitle(true)   // Title Screen tem prioridade de renderização
      } else {
        // Conta totalmente nova, primeiro boot — o jogador já passou pela
        // Title Screen no início desta sessão, então vai direto pro formulário.
        setShowSetup(true)
      }

      // Registra login diário para missões
      trackDailyLogin()
    }, 100)
    return () => clearTimeout(timer)
  }, [playerProfile.hasCompletedSetup, playerProfile.id])

  const navigateTo = (screen: GameScreen) => {
    // Mecânica de guilda removida. O botão "Guilda" em main-menu.tsx (arquivo
    // protegido, não editar) ainda chama onNavigate("guild") — em vez de deixar
    // o jogador numa tela em branco, isso vira um no-op seguro: a navegação nem
    // chega a acontecer, o jogador simplesmente continua no menu.
    if (screen === "guild") {
      return
    }

    // Resume menu music when returning to menu from duel
    if (screen === "menu") {
      resumeMenuMusic()
    }

    if (screen === "duel-bot") {
      setDuelMode("bot")
      setCurrentScreen("duel-bot")
    } else if (screen === "duel-player") {
      setDuelMode("player")
      setCurrentScreen("duel-player")
    } else if (screen === "duel-draft") {
      // DraftDuelScreen/RoguelikeScreen/CatastropheScreen não pausam a
      // música do menu sozinhas (diferente do duel-screen.tsx normal, que
      // já faz isso internamente em startGame()) — antes isso dependia de
      // um onBattleStart que nenhuma das três realmente declarava (prop
      // morta, sem efeito, só gerando erro de tipo). Centralizado aqui.
      pauseMenuMusic()
      setCurrentScreen("duel-draft")
    } else if (screen === "duel-roguelike") {
      pauseMenuMusic()
      setCurrentScreen("duel-roguelike")
    } else if (screen === "duel-catastrophe") {
      pauseMenuMusic()
      setCurrentScreen("duel-catastrophe")
    } else {
      setCurrentScreen(screen)
    }
  }

  const handleSetupComplete = () => {
    setShowSetup(false)
    // ── TUTORIAL: este callback SÓ dispara em duas situações: (a) conta
    // totalmente nova fazendo setup pela primeira vez, ou (b) conta que teve
    // os dados apagados (deleteAccountData zera hasCompletedSetup, então o
    // jogador refaz o setup). Em AMBOS os casos o tutorial deve aparecer —
    // por isso aqui não há checagem de flag, ele sempre dispara. Isso resolve
    // automaticamente o "tutorial não volta após apagar dados da conta",
    // sem precisar mexer no deleteAccountData() do game-context.
    setShowTutorial(true)
    // Marca que o jogador ENTROU na tela do tutorial (lore/seleção de
    // mestre), mas ainda não escolheu um Mestre — ver o useEffect de
    // carregamento abaixo, que usa isso pra detectar se a página foi
    // recarregada nesse meio-tempo. Limpo em handleTutorialComplete assim
    // que o Mestre é escolhido de verdade.
    if (playerProfile.id) {
      localStorage.setItem(`gpgame_tutorial_started_${playerProfile.id}`, "1")
    }
    // ─────────────────────────────────────────────────────────────────────────
  }

  // ── TUTORIAL: master foi escolhido → define master ativo, concede o Deck
  //    Inicial de verdade (cartas na Coleção + Deck salvo) e inicia o overlay ──
  const handleTutorialComplete = (selectedMasterId: TutorialMasterId) => {
    // 1. Define o Mestre escolhido como ativo
    try {
      const masters = loadMastersFromStorage()
      if (masters.length > 0) {
        const updated = masters.map(m => ({
          ...m,
          isActive: m.id.split("-")[0].toLowerCase() === selectedMasterId,
        }))
        saveMastersToStorage(updated)
      }
    } catch (err) {
      console.warn("Erro ao definir mestre ativo:", err)
    }

    // 2. Concede o Deck Inicial de verdade: as 22 cartas vão para a Coleção do
    //    jogador, e um Deck "Deck Inicial" (20 principais + 2 TAP) é salvo e
    //    automaticamente vira o deck ativo exibido no Main Menu (decks[0]).
    try {
      const { collectionCards, mainDeckCards, tapDeckCards } = buildStarterDeckGrant(selectedMasterId)
      addToCollection(collectionCards)
      saveDeck({
        id: "starter-deck",
        name: "Deck Inicial",
        cards: mainDeckCards,
        tapCards: tapDeckCards.length > 0 ? tapDeckCards : undefined,
        useGlobalPlaymat: true,
      })
    } catch (err) {
      console.warn("Erro ao conceder o Deck Inicial:", err)
    }

    // 3. Fecha tutorial standalone e abre overlay sobre o main menu real
    setShowTutorial(false)
    setTutorialOverlayMaster(selectedMasterId)
    setTutorialOverlayActive(true)
    // Mestre escolhido de verdade e Deck Inicial já concedido (passo 2
    // acima) — a partir daqui um recarregamento de página não perde mais
    // nada essencial, então essa marcação não é mais necessária.
    if (playerProfile.id) {
      localStorage.removeItem(`gpgame_tutorial_started_${playerProfile.id}`)
    }
    navigateTo("menu")
  }

  // ── TUTORIAL: overlay concluído → marca esta CONTA como tendo visto o
  //    tutorial. Escopado por playerProfile.id — então funciona corretamente
  //    com múltiplas contas no mesmo navegador, e se a conta for resetada
  //    (Configurações → Apagar Dados), o tutorial reaparece automaticamente
  //    via handleSetupComplete acima (que não depende desta flag), mesmo que
  //    esta flag antiga continue salva sob o id antigo.
  const handleTutorialOverlayComplete = () => {
    if (playerProfile.id) {
      localStorage.setItem(`gpgame_tutorial_done_${playerProfile.id}`, "1")
    }
    // Recompensa por completar (ou pular) o tutorial: 1500 Gacha Coins —
    // mesma moeda ("coins" do useGame()) que a gacha-screen.tsx gasta pra
    // puxar pacotes, o mesmo padrão já usado pelas recompensas de nível de
    // mestre do tipo "gacha_coins" em master-screen.tsx.
    setCoins(coins + 1500)
    setTutorialOverlayActive(false)
    setTutorialOverlayMaster(null)
    // Reset defensivo: normalmente já é false nesse ponto (a transição pro
    // post-duel-menu já reseta), mas se o jogador pular o tutorial ENQUANTO
    // ainda dentro do duelo real (antes dessa transição acontecer), esse
    // reset garante que nenhum duelo seguinte (fora do tutorial) herde por
    // engano o startingLP=20 do tutorial.
    setTutorialInDuel(false)
    navigateTo("menu")
  }
  // ─────────────────────────────────────────────────────────────────────────

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

  // ── TUTORIAL ───────────���──────────────────────────────────────────────────
  // 5️⃣ Tutorial standalone (Lore + Escolha de Mestre)
  if (showTutorial) {
    return (
      <TutorialScreen
        playerName={playerProfile.name || "Viajante"}
        onComplete={handleTutorialComplete}
      />
    )
  }
  // ─────────────────────────────────────────────────────────────────────────

  // 6️⃣ Telas do jogo
  return (
    <>
      {currentScreen === "menu" && <MainMenu onNavigate={navigateTo} statusMessage={menuMessage} onClearMessage={() => setMenuMessage(null)} />}
      {currentScreen === "gacha" && <GachaScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "collection" && <CollectionScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "deck-builder" && <DeckBuilderScreen onBack={() => navigateTo("menu")} />}
      {(currentScreen === "duel-bot" || currentScreen === "duel-player") && (
        <DuelScreen mode={duelMode} onBack={() => {
          // Se estamos no duelo do tutorial, avança o overlay para post-duel-menu
          if (tutorialOverlayActive && tutorialInDuel) {
            setTutorialInDuel(false)
            setTutorialPostDuel(true)
            navigateTo("menu")
            return
          }
          // If returning from a story battle, go back to story screen
          const storyBattle = (() => {
            try { const r = localStorage.getItem("gpgame_story_battle_pending"); return r ? JSON.parse(r) : null } catch { return null }
          })()
          // If returning from an event battle, go back to the events tab
          const eventBattle = (() => {
            try { const r = localStorage.getItem(EVENT_BATTLE_KEY); return r ? JSON.parse(r) : null } catch { return null }
          })()
          if (storyBattle) {
            navigateTo("story")
          } else if (eventBattle) {
            navigateTo("events")
          } else {
            navigateTo("menu")
          }
        }}
        startingLP={(() => {
          // Duelo do tutorial: sempre 20 LP (em vez do padrão 50) pra ser
          // mais rápido de completar na primeira batalha guiada.
          if (tutorialOverlayActive && tutorialInDuel) return 20
          try {
            const ev = localStorage.getItem(EVENT_BATTLE_KEY)
            if (ev) {
              const { lp } = JSON.parse(ev)
              if (lp) return lp
            }
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
      {currentScreen === "masters" && <MasterScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "inventory" && <InventoryScreen onBack={() => navigateTo("menu")} />}
      {currentScreen === "events" && (
        <EventsScreen
          onBack={() => navigateTo("menu")}
          onStartBattle={({ eventId, eventName, elementGroup, difficulty, lp, gacha, gear, fragments }) => {
            // Guarda a pendência: o duelo lê o elemento pra montar o deck do
            // oponente, a dificuldade da IA e o drop da fase (moedas + fragmentos).
            localStorage.setItem(EVENT_BATTLE_KEY,
              JSON.stringify({ eventId, eventName, elementGroup, difficulty, lp, gacha, gear, fragments, won: false }))
            setDuelMode("bot")
            navigateTo("duel-bot")
          }}
        />
      )}
      {currentScreen === "story" && (
        <StoryModeScreen
          onBack={() => navigateTo("menu")}
          onStartBattle={(mode, stageId) => {
            // Save the pending battle so story mode can handle the result
            localStorage.setItem("gpgame_story_battle_pending", JSON.stringify({ stageId, won: false, lp: mode === "story-boss" ? 30 : 20 }))
            setDuelMode("bot")
            navigateTo("duel-bot")
          }}
        />
      )}
      {/* ── TUTORIAL: overlay sobre telas reais (menu, duelo, gacha) ─────── */}
      {tutorialOverlayActive && tutorialOverlayMaster && (
        <TutorialGameOverlay
          masterId={tutorialOverlayMaster}
          onNavigate={(screen) => {
            // Roteia a navegação solicitada pelo overlay do tutorial
            if (screen === "duel") {
              // Inicia o duelo real (duel-screen.tsx) no modo bot
              setTutorialInDuel(true)
              setTutorialPostDuel(false)
              pauseMenuMusic()
              setDuelMode("bot")
              navigateTo("duel-bot")
            } else if (screen === "gacha") {
              navigateTo("gacha")
            } else if (screen === "menu") {
              navigateTo("menu")
            }
          }}
          postDuelReady={tutorialPostDuel}
          onComplete={handleTutorialOverlayComplete}
        />
      )}
      {/* ──────────────────────────────────────────────────────────────────── */}
    </>
  )
}

