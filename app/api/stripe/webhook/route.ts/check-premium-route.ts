// app/api/stripe/check-premium/route.ts
// Chamado pelo gear-pass-screen para verificar se o jogador tem premium ativo
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const playerId = searchParams.get("player_id")

  if (!playerId) {
    return NextResponse.json({ hasPremium: false, error: "player_id ausente" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("player_profiles")
    .select("has_premium_pass, premium_pass_expires_at")
    .eq("player_id", playerId)
    .single()

  if (error || !data) {
    return NextResponse.json({ hasPremium: false })
  }

  // Verifica se o premium ainda está dentro da validade
  const isExpired = data.premium_pass_expires_at
    ? new Date(data.premium_pass_expires_at) < new Date()
    : false

  const hasPremium = data.has_premium_pass === true && !isExpired

  // Se expirou, marca como falso no banco automaticamente
  if (data.has_premium_pass && isExpired) {
    await supabaseAdmin
      .from("player_profiles")
      .update({ has_premium_pass: false })
      .eq("player_id", playerId)
  }

  return NextResponse.json({
    hasPremium,
    expiresAt: data.premium_pass_expires_at ?? null,
  })
}
