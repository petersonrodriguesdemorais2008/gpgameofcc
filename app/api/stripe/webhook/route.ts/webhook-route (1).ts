// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

// ── Clientes ──────────────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
})

// Usa o service role key (não o anon key) para escrever no banco sem RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Desabilita o body parser do Next.js (Stripe precisa do raw body) ──────────
export const config = {
  api: { bodyParser: false },
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ error: "Sem assinatura Stripe" }, { status: 400 })
  }

  let event: Stripe.Event

  // ── 1. Verificar assinatura do webhook ────────────────────────────────────
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

  // ── 2. Processar evento de pagamento concluído ────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    // O playerId foi passado como client_reference_id na URL do Stripe
    const playerId = session.client_reference_id

    if (!playerId) {
      console.error("[Stripe Webhook] Sem client_reference_id na sessão:", session.id)
      // Retorna 200 mesmo assim para o Stripe não retentar
      return NextResponse.json({ received: true, warning: "Sem player_id" })
    }

    const paymentStatus = session.payment_status // "paid" | "unpaid" | "no_payment_required"

    if (paymentStatus !== "paid") {
      console.log("[Stripe Webhook] Pagamento não concluído, status:", paymentStatus)
      return NextResponse.json({ received: true, warning: "Pagamento não concluído" })
    }

    console.log("[Stripe Webhook] Pagamento confirmado para player:", playerId)

    // ── 3. Ativar Gear Pass Premium no Supabase ───────────────────────────
    const premiumExpiresAt = new Date()
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + 30) // 30 dias

    const { error } = await supabaseAdmin
      .from("player_profiles")
      .update({
        has_premium_pass: true,
        premium_pass_expires_at: premiumExpiresAt.toISOString(),
        premium_pass_purchased_at: new Date().toISOString(),
        premium_stripe_session_id: session.id,
      })
      .eq("player_id", playerId)

    if (error) {
      console.error("[Stripe Webhook] Erro ao atualizar Supabase:", error)
      // Retorna 500 para o Stripe retentar depois
      return NextResponse.json({ error: "Erro ao ativar premium" }, { status: 500 })
    }

    console.log("[Stripe Webhook] Premium ativado com sucesso para:", playerId)
  }

  // ── 4. Tratar expiração (opcional — para futuras renovações) ─────────────
  if (event.type === "customer.subscription.deleted") {
    // Reservado para futuros planos de assinatura recorrente
    console.log("[Stripe Webhook] Assinatura cancelada:", event.data.object)
  }

  return NextResponse.json({ received: true })
}
