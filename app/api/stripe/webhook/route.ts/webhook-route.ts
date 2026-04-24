// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
})

// Service role key — bypassa RLS, só usar no servidor
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ error: "Sem assinatura Stripe" }, { status: 400 })
  }

  // 1. Verificar assinatura do webhook
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error("[Stripe Webhook] Assinatura inválida:", err.message)
    return NextResponse.json({ error: `Webhook inválido: ${err.message}` }, { status: 400 })
  }

  // 2. Processar pagamento concluído
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, warning: "Pagamento não concluído" })
    }

    // client_reference_id = user_id (UUID) enviado pela gear-pass-screen
    const userId = session.client_reference_id

    if (!userId) {
      console.error("[Stripe Webhook] Sem client_reference_id:", session.id)
      return NextResponse.json({ received: true, warning: "Sem user_id" })
    }

    console.log("[Stripe Webhook] Pagamento confirmado para user_id:", userId)

    const premiumExpiresAt = new Date()
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + 30)

    // 3a. Tenta atualizar direto por player_id
    const { error: directError } = await supabaseAdmin
      .from("player_profiles")
      .update({
        has_premium_pass: true,
        premium_pass_expires_at: premiumExpiresAt.toISOString(),
        premium_pass_purchased_at: new Date().toISOString(),
        premium_stripe_session_id: session.id,
        player_id: userId,
      })
      .eq("player_id", userId)

    if (!directError) {
      console.log("[Stripe Webhook] Premium ativado via player_id:", userId)
      return NextResponse.json({ received: true })
    }

    // 3b. Fallback: busca user_code via unique_codes
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from("unique_codes")
      .select("code")
      .eq("user_id", userId)
      .single()

    if (codeError || !codeData) {
      console.error("[Stripe Webhook] user_id não encontrado:", userId)
      return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from("player_profiles")
      .update({
        has_premium_pass: true,
        premium_pass_expires_at: premiumExpiresAt.toISOString(),
        premium_pass_purchased_at: new Date().toISOString(),
        premium_stripe_session_id: session.id,
        player_id: userId,
      })
      .eq("user_code", codeData.code)

    if (updateError) {
      console.error("[Stripe Webhook] Erro ao ativar premium:", updateError)
      return NextResponse.json({ error: "Erro ao ativar premium" }, { status: 500 })
    }

    console.log("[Stripe Webhook] Premium ativado via user_code:", userId)
  }

  return NextResponse.json({ received: true })
}
