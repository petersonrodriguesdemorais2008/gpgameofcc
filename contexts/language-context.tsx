"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Language = "pt" | "en" | "ja"

interface Translations {
  [key: string]: {
    pt: string
    en: string
    ja: string
  }
}

const translations: Translations = {
  // Menu
  play: { pt: "JOGAR", en: "PLAY", ja: "プレイ" },
  vsBot: { pt: "VS BOT", en: "VS BOT", ja: "VS BOT" },
  vsPlayer: { pt: "VS JOGADOR", en: "VS PLAYER", ja: "VS プレイヤー" },
  createRoom: { pt: "CRIAR SALA", en: "CREATE ROOM", ja: "ルーム作成" },
  joinRoom: { pt: "ENTRAR NA SALA", en: "JOIN ROOM", ja: "ルーム参加" },
  gacha: { pt: "GACHA", en: "GACHA", ja: "ガチャ" },
  collection: { pt: "COLEÇÃO", en: "COLLECTION", ja: "コレクション" },
  deckBuilder: { pt: "CONSTRUIR DECK", en: "BUILD DECK", ja: "デッキ構築" },
  history: { pt: "HISTÓRICO", en: "HISTORY", ja: "履歴" },
  settings: { pt: "CONFIGURAÇÕES", en: "SETTINGS", ja: "設定" },
  back: { pt: "VOLTAR", en: "BACK", ja: "戻る" },

  // Gacha
  gacha1: { pt: "GACHA x1", en: "GACHA x1", ja: "ガチャ x1" },
  gacha10: { pt: "GACHA x10", en: "GACHA x10", ja: "ガチャ x10" },
  coins: { pt: "Moedas", en: "Coins", ja: "コイン" },
  packOpening: { pt: "Abrindo Pack...", en: "Opening Pack...", ja: "パック開封中..." },

  // Collection
  filterByName: { pt: "Filtrar por nome", en: "Filter by name", ja: "名前でフィルター" },
  ascending: { pt: "Crescente", en: "Ascending", ja: "昇順" },
  descending: { pt: "Decrescente", en: "Descending", ja: "降順" },
  allRarities: { pt: "Todas Raridades", en: "All Rarities", ja: "全レアリティ" },
  allTypes: { pt: "Todos Tipos", en: "All Types", ja: "全タイプ" },
  unit: { pt: "Unidade", en: "Unit", ja: "ユニット" },
  magic: { pt: "Magia", en: "Magic", ja: "魔法" },
  action: { pt: "Action", en: "Action", ja: "アクション" },
  ultimateGear: { pt: "Ultimate Gear", en: "Ultimate Gear", ja: "アルティメットギア" },
  item: { pt: "Item", en: "Item", ja: "アイテム" },

  // Deck Builder
  newDeck: { pt: "Novo Deck", en: "New Deck", ja: "新しいデッキ" },
  saveDeck: { pt: "Salvar Deck", en: "Save Deck", ja: "デッキ保存" },
  deleteDeck: { pt: "Deletar Deck", en: "Delete Deck", ja: "デッキ削除" },
  deckName: { pt: "Nome do Deck", en: "Deck Name", ja: "デッキ名" },
  cards: { pt: "cartas", en: "cards", ja: "枚" },
  minCards: { pt: "Mínimo 10 cartas", en: "Minimum 10 cards", ja: "最低10枚" },
  maxCards: { pt: "Máximo 20 cartas", en: "Maximum 20 cards", ja: "最大20枚" },
  maxCopies: { pt: "Máximo 4 cópias por carta", en: "Maximum 4 copies per card", ja: "カード毎に最大4枚" },

  // Duel
  yourTurn: { pt: "SEU TURNO", en: "YOUR TURN", ja: "あなたのターン" },
  enemyTurn: { pt: "TURNO INIMIGO", en: "ENEMY TURN", ja: "敵のターン" },
  drawPhase: { pt: "Fase de Compra", en: "Draw Phase", ja: "ドローフェイズ" },
  mainPhase: { pt: "Fase Principal", en: "Main Phase", ja: "メインフェイズ" },
  battlePhase: { pt: "Fase de Batalha", en: "Battle Phase", ja: "バトルフェイズ" },
  endPhase: { pt: "Fase Final", en: "End Phase", ja: "エンドフェイズ" },
  endTurn: { pt: "Finalizar Turno", en: "End Turn", ja: "ターン終了" },
  surrender: { pt: "Desistir", en: "Surrender", ja: "降参" },
  victory: { pt: "VITÓRIA!", en: "VICTORY!", ja: "勝利！" },
  defeat: { pt: "DERROTA!", en: "DEFEAT!", ja: "敗北！" },
  life: { pt: "VIDA", en: "LIFE", ja: "ライフ" },
  turn: { pt: "Turno", en: "Turn", ja: "ターン" },
  hand: { pt: "Mão", en: "Hand", ja: "手札" },
  deck: { pt: "Deck", en: "Deck", ja: "デッキ" },
  graveyard: { pt: "Cemitério", en: "Graveyard", ja: "墓地" },
  unitZone: { pt: "Zona de Unidades", en: "Unit Zone", ja: "ユニットゾーン" },
  functionZone: { pt: "Zona de Funções", en: "Function Zone", ja: "ファンクションゾーン" },
  phase: { pt: "Fase", en: "Phase", ja: "フェイズ" },
  drawCard: { pt: "Comprar Carta", en: "Draw Card", ja: "カードを引く" },
  toBattle: { pt: "Ir para Batalha", en: "Go to Battle", ja: "バトルへ" },
  dragToAttack: { pt: "Arraste!", en: "Drag!", ja: "ドラッグ!" },
  canAttackTurn: { pt: "Ataca no turno", en: "Attacks on turn", ja: "ターンに攻撃" },

  // History
  matchHistory: { pt: "Histórico de Partidas", en: "Match History", ja: "対戦履歴" },
  won: { pt: "Vitória", en: "Won", ja: "勝利" },
  lost: { pt: "Derrota", en: "Lost", ja: "敗北" },
  vsBot2: { pt: "vs Bot", en: "vs Bot", ja: "vs Bot" },
  vsPlayer2: { pt: "vs Jogador", en: "vs Player", ja: "vs プレイヤー" },

  // Settings
  language: { pt: "Idioma", en: "Language", ja: "言語" },
  portuguese: { pt: "Português", en: "Portuguese", ja: "ポルトガル語" },
  english: { pt: "Inglês", en: "English", ja: "英語" },
  japanese: { pt: "Japonês", en: "Japanese", ja: "日本語" },

  // Room / Multiplayer
  roomCode: { pt: "Código da Sala", en: "Room Code", ja: "ルームコード" },
  enterCode: { pt: "Digite o código", en: "Enter code", ja: "コードを入力" },
  waiting: { pt: "Aguardando oponente...", en: "Waiting for opponent...", ja: "対戦相手を待っています..." },
  join: { pt: "Entrar", en: "Join", ja: "参加" },
  create: { pt: "Criar", en: "Create", ja: "作成" },
  
  // Multiplayer Lobby
  multiplayerMode: { pt: "MODO MULTIPLAYER", en: "MULTIPLAYER MODE", ja: "マルチプレイヤーモード" },
  createPrivateRoom: { pt: "CRIAR SALA PRIVADA", en: "CREATE PRIVATE ROOM", ja: "プライベートルーム作成" },
  joinWithCode: { pt: "ENTRAR COM CÓDIGO", en: "JOIN WITH CODE", ja: "コードで参加" },
  selectDeck: { pt: "Selecione seu Deck", en: "Select your Deck", ja: "デッキを選択" },
  creatingRoom: { pt: "Criando sala...", en: "Creating room...", ja: "ルーム作成中..." },
  joiningRoom: { pt: "Entrando na sala...", en: "Joining room...", ja: "ルーム参加中..." },
  roomCreated: { pt: "Sala Criada!", en: "Room Created!", ja: "ルーム作成完了！" },
  shareCode: { pt: "Compartilhe este código com seu amigo:", en: "Share this code with your friend:", ja: "このコードを友達と共有してください：" },
  waitingForOpponent: { pt: "Aguardando oponente entrar...", en: "Waiting for opponent to join...", ja: "対戦相手の参加を待っています..." },
  copied: { pt: "Copiado!", en: "Copied!", ja: "コピーしました！" },
  copyCode: { pt: "Copiar Código", en: "Copy Code", ja: "コードをコピー" },
  invalidCode: { pt: "Código inválido ou sala não encontrada", en: "Invalid code or room not found", ja: "無効なコードまたはルームが見つかりません" },
  roomFull: { pt: "Sala já está cheia", en: "Room is already full", ja: "ルームは満員です" },
  player1: { pt: "Jogador 1", en: "Player 1", ja: "プレイヤー1" },
  player2: { pt: "Jogador 2", en: "Player 2", ja: "プレイヤー2" },
  host: { pt: "(Anfitrião)", en: "(Host)", ja: "(ホスト)" },
  guest: { pt: "(Convidado)", en: "(Guest)", ja: "(ゲスト)" },
  waitingPlayer: { pt: "Esperando...", en: "Waiting...", ja: "待機中..." },
  readyButton: { pt: "PRONTO!", en: "READY!", ja: "準備完了！" },
  notReadyButton: { pt: "ESPERANDO", en: "WAITING", ja: "待機中" },
  bothPlayersReady: { pt: "Ambos jogadores prontos! Iniciando duelo...", en: "Both players ready! Starting duel...", ja: "両プレ��ヤー準備完了！デュエル開始..." },
  chat: { pt: "Chat", en: "Chat", ja: "チャット" },
  typeMessage: { pt: "Digite uma mensagem...", en: "Type a message...", ja: "メッセージを入力..." },
  send: { pt: "Enviar", en: "Send", ja: "送信" },
  lobby: { pt: "Lobby", en: "Lobby", ja: "ロビー" },
  leaveRoom: { pt: "Sair da Sala", en: "Leave Room", ja: "ルームを退出" },
  opponentLeft: { pt: "Oponente saiu da sala", en: "Opponent left the room", ja: "対戦相手が退出しました" },
  connectionError: { pt: "Erro de conexão", en: "Connection error", ja: "接続エラー" },
  onlineDuel: { pt: "DUELO ONLINE", en: "ONLINE DUEL", ja: "オンラインデュエル" },
  opponentTurn: { pt: "TURNO DO OPONENTE", en: "OPPONENT'S TURN", ja: "相手のターン" },
  waitingOpponentAction: { pt: "Aguardando ação do oponente...", en: "Waiting for opponent's action...", ja: "相手のアクションを待っています..." },
  youWon: { pt: "VOCÊ VENCEU!", en: "YOU WON!", ja: "あなたの勝ち！" },
  youLost: { pt: "VOCÊ PERDEU!", en: "YOU LOST!", ja: "あなたの負け！" },
  opponentSurrendered: { pt: "Oponente desistiu!", en: "Opponent surrendered!", ja: "相手が降参しました！" },
  opponentDisconnected: { pt: "Oponente desconectou", en: "Opponent disconnected", ja: "相手が切断しました" },
  returnToMenu: { pt: "Voltar ao Menu", en: "Return to Menu", ja: "メニューに戻る" },
  noDeckSelected: { pt: "Nenhum deck selecionado", en: "No deck selected", ja: "デッキが選択されていません" },
  selectDeckFirst: { pt: "Selecione um deck primeiro", en: "Select a deck first", ja: "まずデッキを選択してください" },

  // Title screen
  tapToStart: { pt: "Toque para Começar", en: "Tap to Start", ja: "タップしてスタート" },
  titleAccount: { pt: "Conta", en: "Account", ja: "アカウント" },
  titleRepair: { pt: "Reparar Cliente", en: "Repair Client", ja: "クライアント修復" },
  titleLanguage: { pt: "Idioma", en: "Language", ja: "言語" },
  titleServer: { pt: "Servidor", en: "Server", ja: "サーバー" },
  close: { pt: "Fechar", en: "Close", ja: "閉じる" },
  comingSoon: { pt: "Em breve", en: "Coming soon", ja: "近日公開" },

  // Account panel
  accountManagement: { pt: "Gerenciamento de Conta", en: "Account Management", ja: "アカウント管理" },
  signedInAs: { pt: "Conectado como", en: "Signed in as", ja: "ログイン中" },
  playingAsGuest: { pt: "Jogando como Convidado", en: "Playing as Guest", ja: "ゲストとしてプレイ中" },
  guestWarning: {
    pt: "Seu progresso está salvo apenas neste dispositivo. Vincule uma conta para não perder nada.",
    en: "Your progress is saved only on this device. Link an account so you don't lose anything.",
    ja: "進行状況はこの端末にのみ保存されます。アカウントを連携して失わないようにしましょう。",
  },
  playerCode: { pt: "Código do Jogador", en: "Player Code", ja: "プレイヤーコード" },
  lastSync: { pt: "Última sincronização", en: "Last sync", ja: "最終同期" },
  linkAccount: { pt: "Vincular Conta", en: "Link Account", ja: "アカウント連携" },
  signOut: { pt: "Sair da Conta", en: "Sign Out", ja: "ログアウト" },
  switchUser: { pt: "Trocar de Usuário", en: "Switch User", ja: "ユーザー切替" },
  accountFullOptions: {
    pt: "Entre no jogo e abra Configurações › Conta para login, registro e sincronização completa.",
    en: "Enter the game and open Settings › Account for login, sign up and full sync.",
    ja: "ゲームに入り、設定 › アカウントでログイン・登録・完全同期を行えます。",
  },

  // Repair panel
  repairTitle: { pt: "Limpar Cache / Reparar Cliente", en: "Clear Cache / Repair Client", ja: "キャッシュ削除 / クライアント修復" },
  repairDescription: {
    pt: "Corrige arquivos corrompidos durante atualizações sem reinstalar o jogo.",
    en: "Fixes files corrupted during updates without reinstalling the game.",
    ja: "更新中に破損したファイルを、再インストールせずに修復します。",
  },
  repairSafeNotice: {
    pt: "Seu progresso, cartas e conta NÃO serão apagados.",
    en: "Your progress, cards and account will NOT be deleted.",
    ja: "進行状況・カード・アカウントは削除されません。",
  },
  repairStepCache: { pt: "Cache de arquivos", en: "File cache", ja: "ファイルキャッシュ" },
  repairStepAssets: { pt: "Service workers", en: "Service workers", ja: "サービスワーカー" },
  repairStepTemp: { pt: "Dados temporários", en: "Temporary data", ja: "一時データ" },
  repairStart: { pt: "Iniciar Reparo", en: "Start Repair", ja: "修復を開始" },
  repairRunning: { pt: "Reparando...", en: "Repairing...", ja: "修復中..." },
  repairScanning: { pt: "Verificando cliente...", en: "Scanning client...", ja: "クライアントを確認中..." },
  repairItemsFound: { pt: "item(ns)", en: "item(s)", ja: "件" },
  repairNothingToClear: { pt: "nada a limpar", en: "nothing to clear", ja: "削除対象なし" },
  repairCleared: { pt: "removido(s)", en: "cleared", ja: "削除済み" },
  repairClientHealthy: {
    pt: "Nada corrompido encontrado — seu cliente já está íntegro. Reiniciar ainda pode resolver travamentos da sessão atual.",
    en: "Nothing corrupted found — your client is already healthy. Restarting can still fix glitches in the current session.",
    ja: "破損は見つかりませんでした。クライアントは正常です。再起動は現在のセッションの不具合には有効です。",
  },
  repairSummary: {
    pt: "Reparo concluído. Reinicie o cliente para aplicar.",
    en: "Repair complete. Restart the client to apply.",
    ja: "修復が完了しました。適用するにはクライアントを再起動してください。",
  },
  repairReloadNow: { pt: "Reiniciar Cliente", en: "Restart Client", ja: "クライアントを再起動" },
  repairNoServiceWorker: {
    pt: "Este cliente roda direto do navegador (sem cache offline), então normalmente não há arquivos de cache a reparar.",
    en: "This client runs straight from the browser (no offline cache), so there are usually no cached files to repair.",
    ja: "このクライアントはブラウザから直接動作するため（オフラインキャッシュなし）、通常は修復対象のキャッシュはありません。",
  },

  // Server panel
  selectServerTitle: { pt: "Seleção de Servidor", en: "Server Selection", ja: "サーバー選択" },
  serverPing: { pt: "ping", en: "ping", ja: "ping" },
  serverCurrent: { pt: "Atual", en: "Current", ja: "現在" },
  serverOnline: { pt: "Online", en: "Online", ja: "オンライン" },
  serverUnavailable: { pt: "Indisponível", en: "Unavailable", ja: "利用不可" },
  serverMeasuring: { pt: "medindo", en: "measuring", ja: "測定中" },
  serverOffline: { pt: "sem conexão", en: "offline", ja: "接続なし" },
  serverRegionsNote: {
    pt: "O ping é medido de verdade na sua conexão. As outras regiões ainda não foram abertas.",
    en: "Ping is really measured on your connection. The other regions are not open yet.",
    ja: "pingは実際にあなたの接続で測定されています。他のリージョンは未開放です。",
  },
  serverRemeasure: { pt: "Medir novamente", en: "Measure again", ja: "再測定" },
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const LANGUAGE_STORAGE_KEY = "gpgame_language"

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt")

  // Restore the saved language after mount (keeps SSR output deterministic)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (saved === "pt" || saved === "en" || saved === "ja") setLanguageState(saved)
    } catch {
      /* localStorage unavailable */
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    } catch {
      /* localStorage unavailable */
    }
  }

  const t = (key: string): string => {
    return translations[key]?.[language] || key
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }
  return context
}
