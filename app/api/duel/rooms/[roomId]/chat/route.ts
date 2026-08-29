import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { duelChat } from "@/lib/db/schema"
import { and, asc, eq, gt } from "drizzle-orm"

// Lista mensagens do chat da sala. Aceita ?since=<ISO date> para polling incremental.
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const { searchParams } = new URL(request.url)
  const since = searchParams.get("since")

  const conditions = since
    ? and(eq(duelChat.roomId, roomId), gt(duelChat.createdAt, new Date(since)))
    : eq(duelChat.roomId, roomId)

  const messages = await db.select().from(duelChat).where(conditions).orderBy(asc(duelChat.createdAt))

  return NextResponse.json({ messages })
}

// Envia uma mensagem no chat da sala
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requisicao invalida" }, { status: 400 })
  }

  const senderId = typeof body.senderId === "string" ? body.senderId : null
  const senderName = typeof body.senderName === "string" && body.senderName.trim() ? body.senderName.trim() : "Jogador"
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : null

  if (!senderId || !message) {
    return NextResponse.json({ error: "senderId e message sao obrigatorios" }, { status: 400 })
  }

  const [row] = await db
    .insert(duelChat)
    .values({ roomId, senderId, senderName, message })
    .returning()

  return NextResponse.json({ message: row })
}
