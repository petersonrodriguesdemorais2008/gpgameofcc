// app/api/stripe/webhook/route.ts
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { db } from "@/lib/db"
import { playerProfiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// Instanciado sob demanda: no build/preview as chaves da Stripe podem nao existir,
// e criar o client no escopo do modulo quebra o bundle inteiro.
function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return null
  // Sem apiVersion: usa a versao padrao do SDK instalado.
  return new Stripe(secretKey)
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripe || !webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET ausente")
    return NextResponse.json({ error: "Stripe nao configurado" }, { status: 503 })
  }

  const rawBody = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ error: "Sem assinatura Stripe" }, { status: 400 })
  }

  // 1. Verificar assinatura do webhook
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error("[Stripe Webhook] Assinatura invalida:", err.message)
    return NextResponse.json({ error: `Webhook invalido: ${err.message}` }, { status: 400 })
  }

  // 2. Processar pagamento concluído
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, warning: "Pagamento nao concluido" })
    }

    // client_reference_id = playerId (local) enviado pela gear-pass-screen
    const playerId = session.client_reference_id

    if (!playerId) {
      console.error("[Stripe Webhook] Sem client_reference_id:", session.id)
      return NextResponse.json({ received: true, warning: "Sem player_id" })
    }

    console.log("[Stripe Webhook] Pagamento confirmado para player_id:", playerId)

    const premiumExpiresAt = new Date()
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + 30)
    const now = new Date()

    try {
      // Upsert: cria o perfil se não existir, ou atualiza se já existir
      await db
        .insert(playerProfiles)
        .values({
          playerId,
          hasPremiumPass: true,
          premiumPassExpiresAt: premiumExpiresAt,
          premiumPassPurchasedAt: now,
          premiumStripeSessionId: session.id,
        })
        .onConflictDoUpdate({
          target: playerProfiles.playerId,
          set: {
            hasPremiumPass: true,
            premiumPassExpiresAt: premiumExpiresAt,
            premiumPassPurchasedAt: now,
            premiumStripeSessionId: session.id,
            updatedAt: now,
          },
        })

      console.log("[Stripe Webhook] Premium ativado para player_id:", playerId)
    } catch (error) {
      console.error("[Stripe Webhook] Erro ao ativar premium:", error)
      return NextResponse.json({ error: "Erro ao ativar premium" }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
