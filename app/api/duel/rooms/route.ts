import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { duelRooms } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// Cria uma nova sala de duelo (host)
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisicao invalida" }, { status: 400 })
  }

  const rawHostId = typeof body.hostId === "string" ? body.hostId.trim() : ""
  const hostId = rawHostId.length > 0 && rawHostId.length <= 50 ? rawHostId : rawHostId.length > 50 ? rawHostId.slice(0, 50) : null
  const hostName = typeof body.hostName === "string" && body.hostName.trim() ? body.hostName.trim().slice(0, 100) : "Jogador"
  const hostAvatarUrl = typeof body.hostAvatarUrl === "string" ? body.hostAvatarUrl.slice(0, 2000) : null
  const hostDeck = body.hostDeck ?? null

  if (!hostId) {
    return NextResponse.json({ error: "hostId ausente" }, { status: 400 })
  }

  // Tenta até 5 vezes em caso de colisão de código de sala
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode()
    try {
      const [room] = await db
        .insert(duelRooms)
        .values({
          roomCode: code,
          hostId,
          hostName,
          hostAvatarUrl,
          hostDeck: hostDeck as any,
          status: "waiting",
          hostReady: false,
          guestReady: false,
        })
        .returning()

      return NextResponse.json({ room })
    } catch (error) {
      const isUnique = Boolean(error && typeof error === "object" && "code" in error && (error as any).code === "23505")
      if (!isUnique) {
        // error.message do drizzle geralmente é só o wrapper "Failed query: ...".
        // A causa real (erro de conexão, timeout, etc.) fica em error.cause.
        const cause = error instanceof Error ? (error.cause as Error | undefined) : undefined
        console.error("[duel/rooms] create error:", error, "cause:", cause)
        const details =
          cause?.message ?? (error instanceof Error ? error.message : "Falha desconhecida no banco de dados")
        return NextResponse.json(
          { error: "Não foi possível criar a sala.", details },
          { status: 500 },
        )
      }
      // colisão de room_code — tenta outro código
    }
  }

  return NextResponse.json({ error: "Erro ao gerar codigo de sala" }, { status: 500 })
}
