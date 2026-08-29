import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { duelRooms } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// Consulta o estado atual da sala (usado no polling do lobby e do duelo)
export async function GET(_request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  const [room] = await db.select().from(duelRooms).where(eq(duelRooms.id, roomId)).limit(1)

  if (!room) {
    return NextResponse.json({ error: "Sala nao encontrada" }, { status: 404 })
  }

  return NextResponse.json({ room })
}

// Atualiza campos da sala: ready state, decks, status, game_state, etc.
export async function PATCH(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisicao invalida" }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof body.hostReady === "boolean") updates.hostReady = body.hostReady
  if (typeof body.guestReady === "boolean") updates.guestReady = body.guestReady
  if (typeof body.status === "string") updates.status = body.status
  if (typeof body.currentTurn === "string" || body.currentTurn === null) updates.currentTurn = body.currentTurn
  if (typeof body.turnNumber === "number") updates.turnNumber = body.turnNumber
  if (typeof body.phase === "string") updates.phase = body.phase
  if (typeof body.winnerId === "string" || body.winnerId === null) updates.winnerId = body.winnerId
  if (body.gameState !== undefined) updates.gameState = body.gameState
  if (body.hostDeck !== undefined) updates.hostDeck = body.hostDeck
  if (body.guestDeck !== undefined) updates.guestDeck = body.guestDeck
  if (body.guestId === null) {
    // Remove o guest da sala (usado quando o guest sai)
    updates.guestId = null
    updates.guestName = null
    updates.guestAvatarUrl = null
    updates.guestDeck = null
    updates.guestReady = false
    updates.status = "waiting"
  }

  const [updated] = await db.update(duelRooms).set(updates as any).where(eq(duelRooms.id, roomId)).returning()

  if (!updated) {
    return NextResponse.json({ error: "Sala nao encontrada" }, { status: 404 })
  }

  // Se ambos estiverem prontos, inicia automaticamente o duelo
  if (updated.hostReady && updated.guestReady && updated.status === "lobby") {
    const [started] = await db
      .update(duelRooms)
      .set({ status: "playing", updatedAt: new Date() })
      .where(eq(duelRooms.id, roomId))
      .returning()
    return NextResponse.json({ room: started })
  }

  return NextResponse.json({ room: updated })
}

// Sai da sala: host apaga a sala, guest apenas se remove
export async function DELETE(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const { searchParams } = new URL(request.url)
  const isHost = searchParams.get("isHost") === "true"

  if (isHost) {
    await db.delete(duelRooms).where(eq(duelRooms.id, roomId))
  } else {
    await db
      .update(duelRooms)
      .set({
        guestId: null,
        guestName: null,
        guestAvatarUrl: null,
        guestDeck: null,
        guestReady: false,
        status: "waiting",
        updatedAt: new Date(),
      })
      .where(eq(duelRooms.id, roomId))
  }

  return NextResponse.json({ success: true })
}
