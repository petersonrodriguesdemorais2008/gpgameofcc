"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, type Deck, type Card } from "@/contexts/game-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Copy, Check, Send, Users, MessageCircle, Loader2, Smile, X } from "lucide-react"
import Image from "next/image"

// Emotes oficiais do jogo
const GAME_EMOTES = [
  { id: "emote-1", name: "Chorando de Alegria", image: "/images/emotes/emote-1.png" },
  { id: "emote-2", name: "Confiante", image: "/images/emotes/emote-2.png" },
  { id: "emote-3", name: "Raiva", image: "/images/emotes/emote-3.png" },
  { id: "emote-4", name: "Feliz", image: "/images/emotes/emote-4.png" },
  { id: "emote-5", name: "Surpreso", image: "/images/emotes/emote-5.png" },
  { id: "emote-6", name: "Fogo", image: "/images/emotes/emote-6.png" },
]

interface MultiplayerLobbyProps {
  onBack: () => void
  onStartDuel: (roomData: RoomData) => void
}

interface RoomData {
  roomId: string
  roomCode: string
  isHost: boolean
  hostId: string
  hostName: string
  hostDeck: Deck | null
  hostAvatarUrl: string | null
  guestId: string | null
  guestName: string | null
  guestDeck: Deck | null
  guestAvatarUrl: string | null
  hostReady: boolean
  guestReady: boolean
}

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  message: string
  created_at: string
}

type LobbyScreen = "choice" | "create" | "join" | "waiting" | "lobby"

export function MultiplayerLobby({ onBack, onStartDuel }: MultiplayerLobbyProps) {
  const { t } = useLanguage()
  const { decks, playerProfile, playerId } = useGame()

  const [screen, setScreen] = useState<LobbyScreen>("choice")
  const [shouldStartDuel, setShouldStartDuel] = useState(false)
  const [roomCode, setRoomCode] = useState("")
  const [inputRoomCode, setInputRoomCode] = useState("")
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(decks[0] || null)
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [showEmotePicker, setShowEmotePicker] = useState(false)
  
  // Ready state
  const [isReady, setIsReady] = useState(false)

  // Polling fallback interval ref (declared early so it's available in createRoom)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Forward declaration for subscribeToChat (will be defined later)
  const subscribeToChatRef = useRef<(roomId: string) => void>(() => {})

  // Create a new room
  const createRoom = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Generate a valid UUID for the host if playerId is not a valid UUID
      const hostUUID = playerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId)
        ? playerId
        : crypto.randomUUID()

      const res = await fetch("/api/duel/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: hostUUID,
          hostName: playerProfile.name || "Jogador",
          hostAvatarUrl: playerProfile.avatarUrl || null,
          hostDeck: selectedDeck ?? null,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.room) {
        console.error("[v0] Error creating room:", json.error)
        setError(`Erro ao criar sala: ${json.error || "Tente novamente."}`)
        setIsLoading(false)
        return
      }

      const room = json.room

      setRoomCode(room.roomCode)
      setRoomData({
        roomId: room.id,
        roomCode: room.roomCode,
        isHost: true,
        hostId: hostUUID,
        hostName: playerProfile.name || "Jogador",
        hostAvatarUrl: playerProfile.avatarUrl || null,
        hostDeck: selectedDeck,
        guestId: null,
        guestName: null,
        guestDeck: null,
        guestAvatarUrl: null,
        hostReady: false,
        guestReady: false,
      })
      setScreen("waiting")

      // Start unified polling (handles guest-join, ready state, and duel start)
      startPolling(room.id)

    } catch (err) {
      console.error("[v0] Exception creating room:", err)
      setError(`Erro ao criar sala: ${err instanceof Error ? err.message : "Tente novamente."}`)
    }

    setIsLoading(false)
  }

  // Join an existing room
  const joinRoom = async () => {
    setIsLoading(true)
    setError(null)
    
    const codeToJoin = inputRoomCode.toUpperCase().trim()
    
    if (!codeToJoin || codeToJoin.length !== 6) {
      setError("Codigo invalido. Deve ter 6 caracteres.")
      setIsLoading(false)
      return
    }
    
    try {
      // Generate a valid UUID for the guest if playerId is not a valid UUID
      const guestUUID = playerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId)
        ? playerId
        : crypto.randomUUID()

      const res = await fetch("/api/duel/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: codeToJoin,
          guestId: guestUUID,
          guestName: playerProfile.name || "Jogador",
          guestAvatarUrl: playerProfile.avatarUrl || null,
          guestDeck: selectedDeck ?? null,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.room) {
        setError(json.error || "Erro ao entrar na sala. Tente novamente.")
        setIsLoading(false)
        return
      }

      const room = json.room

      // Parse host deck safely (JSONB já vem como objeto, mas cobrimos strings legadas)
      const parseD = (d: any) => {
        if (!d) return null
        try { return typeof d === "string" ? JSON.parse(d) : d } catch { return d }
      }

      setRoomCode(codeToJoin)
      setRoomData({
        roomId: room.id,
        roomCode: codeToJoin,
        isHost: false,
        hostId: room.hostId,
        hostName: room.hostName,
        hostAvatarUrl: room.hostAvatarUrl || null,
        hostDeck: parseD(room.hostDeck),
        guestId: guestUUID,
        guestName: playerProfile.name,
        guestAvatarUrl: playerProfile.avatarUrl || null,
        guestDeck: selectedDeck,
        hostReady: room.hostReady,
        guestReady: false,
      })
      setScreen("lobby")
      
      // Start polling for room state + chat
      startPolling(room.id)
      subscribeToChat(room.id)
      
    } catch (err) {
      setError("Erro ao entrar na sala. Tente novamente.")
    }
    
    setIsLoading(false)
  }

  // ─── Room polling (guaranteed sync every 1.5s) ──────────────────────────
  const startPolling = useCallback((roomId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)

    // Parse decks safely
    const parseD = (d: any) => {
      if (!d) return null
      try { return typeof d === "string" ? JSON.parse(d) : d } catch { return d }
    }

    const poll = async () => {
      const res = await fetch(`/api/duel/rooms/${roomId}`)
      if (!res.ok) return
      const { room } = await res.json()

      if (!room) return

      // Update roomData synchronously (no await inside setter)
      setRoomData(prev => {
        if (!prev) return prev
        const updated: RoomData = {
          ...prev,
          guestId:        room.guestId         ?? prev.guestId,
          guestName:      room.guestName       ?? prev.guestName,
          guestAvatarUrl: room.guestAvatarUrl  ?? prev.guestAvatarUrl,
          hostAvatarUrl:  room.hostAvatarUrl   ?? prev.hostAvatarUrl,
          guestDeck:      room.guestDeck ? parseD(room.guestDeck) : prev.guestDeck,
          hostDeck:       room.hostDeck  ? parseD(room.hostDeck)  : prev.hostDeck,
          hostReady:  room.hostReady,
          guestReady: room.guestReady,
        }

        // Host moves to lobby when guest joins
        if (prev.isHost && room.guestId && room.status === "lobby" && screen !== "lobby") {
          setScreen("lobby")
          subscribeToChatRef.current(roomId)
        }

        // Sync my own ready state
        setIsReady(prev.isHost ? room.hostReady : room.guestReady)

        return updated
      })

      // Both ready → fetch fresh data then start duel (async, outside setter)
      if (room.status === "playing") {
        const parseD2 = (d: any) => {
          if (!d) return null
          try {
            const parsed = typeof d === "string" ? JSON.parse(d) : d
            if (!parsed.cards || !Array.isArray(parsed.cards)) parsed.cards = []
            if (!parsed.tapCards) parsed.tapCards = []
            return parsed
          } catch { return null }
        }
        const freshRes = await fetch(`/api/duel/rooms/${roomId}`)
        const { room: freshRoom } = freshRes.ok ? await freshRes.json() : { room: null }
        if (freshRoom) {
          setRoomData(prev => {
            if (!prev) return prev
            return {
              ...prev,
              hostDeck:       parseD2(freshRoom.hostDeck)    ?? prev.hostDeck,
              guestDeck:      parseD2(freshRoom.guestDeck)   ?? prev.guestDeck,
              hostName:       freshRoom.hostName             ?? prev.hostName,
              guestName:      freshRoom.guestName            ?? prev.guestName,
              hostAvatarUrl:  freshRoom.hostAvatarUrl        ?? prev.hostAvatarUrl,
              guestAvatarUrl: freshRoom.guestAvatarUrl       ?? prev.guestAvatarUrl,
            }
          })
        }
        setShouldStartDuel(true)
      }
    }

    poll() // immediate first check
    pollingIntervalRef.current = setInterval(poll, 1500)
  }, [screen])

  // ─── Cleanup polling on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    }
  }, [])

  // ─── Start duel when both ready ──────────────────────────────────────────
  useEffect(() => {
    if (shouldStartDuel && roomData) onStartDuel(roomData)
  }, [shouldStartDuel, roomData, onStartDuel])

  // ─── Chat: polling every 2s via REST ──────────────────────────────────────
  const chatPollRef = useRef<NodeJS.Timeout | null>(null)
  const lastMsgTimeRef = useRef<string>("1970-01-01T00:00:00.000Z")

  const subscribeToChat = useCallback((roomId: string) => {
    if (chatPollRef.current) clearInterval(chatPollRef.current)

    // Load all existing messages once
    const loadAll = async () => {
      const res = await fetch(`/api/duel/rooms/${roomId}/chat`)
      if (!res.ok) return
      const { messages } = await res.json()
      if (messages && messages.length > 0) {
        setChatMessages(messages)
        lastMsgTimeRef.current = messages[messages.length - 1].createdAt ?? messages[messages.length - 1].created_at
      }
    }
    loadAll()

    // Poll for new messages every 2s
    const pollChat = async () => {
      const res = await fetch(`/api/duel/rooms/${roomId}/chat?since=${encodeURIComponent(lastMsgTimeRef.current)}`)
      if (!res.ok) return
      const { messages } = await res.json()
      if (messages && messages.length > 0) {
        setChatMessages(prev => {
          const ids = new Set(prev.map(m => m.id))
          const fresh = messages.filter((m: any) => !ids.has(m.id))
          if (fresh.length === 0) return prev
          const last = fresh[fresh.length - 1]
          lastMsgTimeRef.current = last.createdAt ?? last.created_at
          return [...prev, ...fresh]
        })
      }
    }
    chatPollRef.current = setInterval(pollChat, 2000)
  }, [])

  // Cleanup chat poll on unmount
  useEffect(() => {
    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current)
    }
  }, [])

  // Keep subscribeToChatRef in sync
  useEffect(() => {
    subscribeToChatRef.current = subscribeToChat
  }, [subscribeToChat])

  // Send chat message
  const sendMessage = async (messageText?: string) => {
    const message = messageText || chatInput.trim()
    if (!message || !roomData) return
    
    setChatInput("")
    setShowEmotePicker(false)
    
    // Generate a valid UUID for sender_id if playerId is not a valid UUID
    const senderUUID = playerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId)
      ? playerId
      : roomData.isHost ? roomData.hostId : (roomData.guestId || crypto.randomUUID())
    
    try {
      const res = await fetch(`/api/duel/rooms/${roomData.roomId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderId: senderUUID, senderName: playerProfile.name || "Jogador", message }) })
      if (!res.ok) throw new Error("Falha ao enviar mensagem")
    } catch (err) {
      console.error("[v0] Exception sending message:", err)
    }
  }
  
  // Send emote
  const sendEmote = (emoteId: string) => {
    const emote = GAME_EMOTES.find(e => e.id === emoteId)
    if (emote) {
      sendMessage(`[EMOTE:${emoteId}]`)
    }
  }

  // Toggle ready state
  const toggleReady = async () => {
    if (!roomData) return
    
    const newReadyState = !isReady
    setIsReady(newReadyState)
    
    try {
      const res = await fetch(`/api/duel/rooms/${roomData.roomId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(roomData.isHost ? { hostReady: newReadyState } : { guestReady: newReadyState }) })
      if (!res.ok) throw new Error("Falha ao atualizar prontidão")
    } catch (err) {
      console.error("[v0] Error updating ready state:", err)
      setIsReady(!newReadyState)
    }
  }

  // Copy room code to clipboard
  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Failed to copy
    }
  }

  // Leave room
  const leaveRoom = async () => {
    if (roomData) await fetch(`/api/duel/rooms/${roomData.roomId}?isHost=${roomData.isHost}`, { method: "DELETE" })
    onBack()
  }

  // Scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  // Render choice screen
  if (screen === "choice") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-white mb-6"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Duelo Online</h1>
            <p className="text-slate-400">Desafie outros jogadores em tempo real</p>
          </div>

          {/* Deck Selection */}
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Selecionar Deck</h3>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  onClick={() => setSelectedDeck(deck)}
                  className={`p-3 rounded-lg text-left transition-all ${
                    selectedDeck?.id === deck.id
                      ? "bg-amber-500/30 border-2 border-amber-500"
                      : "bg-slate-700/50 border border-slate-600 hover:bg-slate-700"
                  }`}
                >
                  <p className="text-white text-sm font-medium truncate">{deck.name}</p>
                  <p className="text-slate-400 text-xs">{deck.cards.length} cartas</p>
                </button>
              ))}
            </div>
            {decks.length === 0 && (
              <p className="text-slate-400 text-center py-4">
                Crie um deck primeiro para jogar online
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-4">
            <button
              onClick={() => setScreen("create")}
              disabled={!selectedDeck}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
            >
              <Users className="w-6 h-6" />
              Criar Sala Privada
            </button>

            <button
              onClick={() => setScreen("join")}
              disabled={!selectedDeck}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
            >
              <MessageCircle className="w-6 h-6" />
              Entrar com Codigo
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render create room screen
  if (screen === "create") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            onClick={() => setScreen("choice")}
            className="text-white mb-6"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Criar Sala</h1>
            <p className="text-slate-400">Crie uma sala e compartilhe o codigo</p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
            <p className="text-slate-300 mb-4">
              Deck selecionado: <span className="text-amber-400 font-semibold">{selectedDeck?.name}</span>
            </p>
            
            <Button
              onClick={createRoom}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 rounded-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Sala"
              )}
            </Button>

            {error && (
              <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render join room screen
  if (screen === "join") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            onClick={() => setScreen("choice")}
            className="text-white mb-6"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Entrar na Sala</h1>
            <p className="text-slate-400">Digite o codigo da sala para entrar</p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
            <p className="text-slate-300 mb-4">
              Deck selecionado: <span className="text-amber-400 font-semibold">{selectedDeck?.name}</span>
            </p>
            
            <Input
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
              placeholder="CODIGO"
              maxLength={6}
              className="text-center text-2xl font-mono tracking-widest bg-slate-700 border-slate-600 text-white mb-4"
            />
            
            <Button
              onClick={joinRoom}
              disabled={isLoading || inputRoomCode.length !== 6}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-4 rounded-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar na Sala"
              )}
            </Button>

            {error && (
              <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render waiting room screen (host waiting for guest)
  if (screen === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            onClick={leaveRoom}
            className="text-white mb-6"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Sair da Sala
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Aguardando Jogador</h1>
            <p className="text-slate-400">Compartilhe o codigo com seu oponente</p>
          </div>

          {/* Room Code Display */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
            <p className="text-slate-400 text-sm mb-2 text-center">Codigo da Sala</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-mono font-bold text-amber-400 tracking-widest">
                {roomCode}
              </span>
              <button
                onClick={copyRoomCode}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-slate-300" />
                )}
              </button>
            </div>
          </div>

          {/* Waiting Animation */}
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
            </div>
            <p className="text-white font-medium">Esperando outro jogador entrar...</p>
            <p className="text-slate-400 text-sm mt-2">
              Deck: {selectedDeck?.name}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Render lobby screen (both players present)
  if (screen === "lobby" && roomData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-lg mx-auto">
          <Button
            variant="ghost"
            onClick={leaveRoom}
            className="text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Sair da Sala
          </Button>

          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-white mb-1">Sala: {roomCode}</h1>
          </div>

          {/* Players Display */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Host */}
            <div className={`bg-slate-800/50 rounded-xl p-4 border-2 transition-colors ${
              roomData.hostReady ? "border-green-500" : "border-slate-700"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-12 h-12 rounded-full bg-amber-500/30 flex items-center justify-center overflow-hidden border-2 border-amber-500/50">
                  {roomData.hostAvatarUrl ? (
                    <Image 
                      src={roomData.hostAvatarUrl} 
                      alt={roomData.hostName} 
                      width={48} 
                      height={48} 
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-amber-400 font-bold text-lg">{roomData.hostName?.charAt(0)?.toUpperCase() || "H"}</span>
                  )}
                </div>
                <div>
                  <p className="text-white font-medium text-sm truncate">{roomData.hostName}</p>
                  <p className="text-xs text-slate-400">Anfitriao</p>
                </div>
              </div>
              {roomData.hostDeck && (
                <p className="text-xs text-slate-400 truncate">
                  Deck: {roomData.hostDeck.name}
                </p>
              )}
              <div className={`mt-2 py-1 px-2 rounded text-xs font-medium text-center ${
                roomData.hostReady 
                  ? "bg-green-500/30 text-green-400" 
                  : "bg-red-500/30 text-red-400"
              }`}>
                {roomData.hostReady ? "PRONTO!" : "ESPERANDO"}
              </div>
            </div>

            {/* Guest */}
            <div className={`bg-slate-800/50 rounded-xl p-4 border-2 transition-colors ${
              roomData.guestReady ? "border-green-500" : "border-slate-700"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-12 h-12 rounded-full bg-blue-500/30 flex items-center justify-center overflow-hidden border-2 border-blue-500/50">
                  {roomData.guestAvatarUrl ? (
                    <Image 
                      src={roomData.guestAvatarUrl} 
                      alt={roomData.guestName || "Guest"} 
                      width={48} 
                      height={48} 
                      className="object-cover w-full h-full"
                    />
                  ) : roomData.guestName ? (
                    <span className="text-blue-400 font-bold text-lg">{roomData.guestName.charAt(0).toUpperCase()}</span>
                  ) : (
                    <Users className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium text-sm truncate">
                    {roomData.guestName || "Aguardando..."}
                  </p>
                  <p className="text-xs text-slate-400">Convidado</p>
                </div>
              </div>
              {roomData.guestDeck && (
                <p className="text-xs text-slate-400 truncate">
                  Deck: {roomData.guestDeck.name}
                </p>
              )}
              {roomData.guestId && (
                <div className={`mt-2 py-1 px-2 rounded text-xs font-medium text-center ${
                  roomData.guestReady 
                    ? "bg-green-500/30 text-green-400" 
                    : "bg-red-500/30 text-red-400"
                }`}>
                  {roomData.guestReady ? "PRONTO!" : "ESPERANDO"}
                </div>
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 mb-4">
            <div className="p-3 border-b border-slate-700">
              <h3 className="text-white font-medium flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Chat
              </h3>
            </div>
            
            <div 
              ref={chatContainerRef}
              className="h-40 overflow-y-auto p-3 space-y-2"
            >
              {chatMessages.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">
                  Nenhuma mensagem ainda...
                </p>
              ) : (
                chatMessages.map((msg) => {
                  // Check if message is an emote
                  const emoteMatch = msg.message.match(/^\[EMOTE:(emote-\d+)\]$/)
                  const isEmote = !!emoteMatch
                  const emote = isEmote ? GAME_EMOTES.find(e => e.id === emoteMatch![1]) : null
                  
                  // Check if this is from the current player (compare with both playerId and room IDs)
                  const isCurrentPlayer = msg.sender_id === playerId || 
                    (roomData?.isHost && msg.sender_id === roomData.hostId) ||
                    (!roomData?.isHost && msg.sender_id === roomData?.guestId)
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isCurrentPlayer ? "items-end" : "items-start"
                      }`}
                    >
                      <span className="text-xs text-slate-500 mb-1">
                        {msg.sender_name}
                      </span>
                      {isEmote && emote ? (
                        <div className="relative w-24 h-24 bg-slate-800/50 rounded-xl p-1">
                          <Image
                            src={emote.image}
                            alt={emote.name}
                            fill
                            sizes="96px"
                            className="object-contain drop-shadow-lg"
                          />
                        </div>
                      ) : (
                        <div className={`max-w-[80%] px-3 py-2 rounded-lg ${
                          isCurrentPlayer
                            ? "bg-amber-500/30 text-amber-100"
                            : "bg-slate-700 text-slate-200"
                        }`}>
                          <p className="text-sm break-words">{msg.message}</p>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-700 relative">
              {/* Emote Picker */}
              {showEmotePicker && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 rounded-xl border border-slate-600 p-3 shadow-xl z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">Emotes</span>
                    <button 
                      onClick={() => setShowEmotePicker(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {GAME_EMOTES.map((emote) => (
                      <button
                        key={emote.id}
                        onClick={() => sendEmote(emote.id)}
                        className="w-16 h-16 rounded-xl bg-slate-700 hover:bg-slate-600 hover:scale-110 transition-all p-1 relative"
                        title={emote.name}
                      >
                        <Image
                          src={emote.image}
                          alt={emote.name}
                          fill
                          sizes="64px"
                          className="object-contain p-1"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage()
                }}
                className="flex gap-2"
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 bg-slate-700 border-slate-600 text-white text-sm"
                  maxLength={200}
                />
                <Button
                  type="button"
                  onClick={() => setShowEmotePicker(!showEmotePicker)}
                  className="bg-slate-600 hover:bg-slate-500 text-white"
                >
                  <Smile className="w-4 h-4" />
                </Button>
                <Button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Ready Button */}
          <button
            onClick={toggleReady}
            className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
              isReady
                ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                : "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white"
            }`}
          >
            {isReady ? "PRONTO!" : "ESPERANDO"}
          </button>

          {isReady && !otherPlayerReady && (
            <p className="text-slate-400 text-sm text-center mt-3">
              Aguardando o outro jogador ficar pronto...
            </p>
          )}

          {isReady && otherPlayerReady && (
            <div className="text-center mt-4">
              <Loader2 className="w-8 h-8 text-green-400 animate-spin mx-auto mb-2" />
              <p className="text-green-400 font-medium">Iniciando duelo...</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
