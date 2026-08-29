// app/api/stripe/check-premium/route.ts
// Chamado pelo gear-pass-screen para verificar se o jogador tem premium ativo
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { playerProfiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const playerId = searchParams.get("player_id")

  if (!playerId) {
    return NextResponse.json({ hasPremium: false, error: "player_id ausente" }, { status: 400 })
  }

  const [profile] = await db
    .select({
      hasPremiumPass: playerProfiles.hasPremiumPass,
      premiumPassExpiresAt: playerProfiles.premiumPassExpiresAt,
    })
    .from(playerProfiles)
    .where(eq(playerProfiles.playerId, playerId))
    .limit(1)

  if (!profile) {
    return NextResponse.json({ hasPremium: false })
  }

  // Verifica se o premium ainda está dentro da validade
  const isExpired = profile.premiumPassExpiresAt ? new Date(profile.premiumPassExpiresAt) < new Date() : false

  const hasPremium = profile.hasPremiumPass === true && !isExpired

  // Se expirou, marca como falso no banco automaticamente
  if (profile.hasPremiumPass && isExpired) {
    await db.update(playerProfiles).set({ hasPremiumPass: false }).where(eq(playerProfiles.playerId, playerId))
  }

  return NextResponse.json({
    hasPremium,
    expiresAt: profile.premiumPassExpiresAt ?? null,
  })
}
