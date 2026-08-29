import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { duelRooms } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

// Entra em uma sala existente pelo código (guest)
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisicao invalida" }, { status: 400 })
  }

  const roomCode = typeof body.roomCode === "string" ? body.roomCode.toUpperCase().trim() : null
  const guestId = typeof body.guestId === "string" ? body.guestId : null
  const guestName = typeof body.guestName === "string" && body.guestName.trim() ? body.guestName.trim() : "Jogador"
  const guestAvatarUrl = typeof body.guestAvatarUrl === "string" ? body.guestAvatarUrl : null
  const guestDeck = body.guestDeck ?? null

  if (!roomCode || roomCode.length !== 6) {
    return NextResponse.json({ error: "Codigo invalido. Deve ter 6 caracteres." }, { status: 400 })
  }
  if (!guestId) {
    return NextResponse.json({ error: "guestId ausente" }, { status: 400 })
  }

  const [room] = await db
    .select()
    .from(duelRooms)
    .where(and(eq(duelRooms.roomCode, roomCode), eq(duelRooms.status, "waiting")))
    .limit(1)

  if (!room) {
    return NextResponse.json({ error: "Sala nao encontrada ou ja esta cheia." }, { status: 404 })
  }

  if (room.hostId === guestId) {
    return NextResponse.json({ error: "Voce nao pode entrar na sua propria sala." }, { status: 400 })
  }

  const [updated] = await db
    .update(duelRooms)
    .set({
      guestId,
      guestName,
      guestAvatarUrl,
      guestDeck: guestDeck as any,
      status: "lobby",
      updatedAt: new Date(),
    })
    .where(eq(duelRooms.id, room.id))
    .returning()

  return NextResponse.json({ room: updated })
}
