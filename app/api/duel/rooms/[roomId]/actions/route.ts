import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { duelActions } from "@/lib/db/schema"
import { and, asc, eq, gt, ne } from "drizzle-orm"

// Lista ações da sala para polling. Aceita ?after=<cursorId> e ?excludePlayerId=<id>
// para retornar apenas ações novas de OUTROS jogadores (evita reprocessar as próprias).
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const { searchParams } = new URL(request.url)
  const after = searchParams.get("after")
  const excludePlayerId = searchParams.get("excludePlayerId")

  const conditions = [eq(duelActions.roomId, roomId)]
  if (after) {
    const cursor = Number(after)
    if (!Number.isNaN(cursor)) conditions.push(gt(duelActions.cursorId, cursor))
  }
  if (excludePlayerId) conditions.push(ne(duelActions.playerId, excludePlayerId))

  const rows = await db
    .select()
    .from(duelActions)
    .where(and(...conditions))
    .orderBy(asc(duelActions.cursorId))
    .limit(100)

  return NextResponse.json({ actions: rows })
}

// Envia uma ação de duelo (jogada, sync de campo, etc.)
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisicao invalida" }, { status: 400 })
  }

  const playerId = typeof body.playerId === "string" ? body.playerId : null
  const actionType = typeof body.actionType === "string" ? body.actionType : null
  const actionData = body.actionData ?? null
  const sequenceNumber = typeof body.sequenceNumber === "number" ? body.sequenceNumber : 1

  if (!playerId || !actionType) {
    return NextResponse.json({ error: "playerId e actionType sao obrigatorios" }, { status: 400 })
  }

  const [row] = await db
    .insert(duelActions)
    .values({
      roomId,
      playerId,
      actionType,
      actionData,
      sequenceNumber,
    })
    .returning()

  return NextResponse.json({ action: row })
}
