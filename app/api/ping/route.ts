import { NextResponse } from "next/server"

// Endpoint deliberadamente minúsculo: o corpo precisa ser pequeno para que o
// tempo medido no cliente reflita latência de rede, não download de payload.
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  return new NextResponse(
    JSON.stringify({
      t: Date.now(),
      // Região real onde a função foi executada (definida pela Vercel em produção)
      region: process.env.VERCEL_REGION ?? "local",
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        // Sem cache: uma resposta cacheada mediria 0ms e mentiria
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    },
  )
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "cache-control": "no-store, no-cache, must-revalidate, max-age=0" },
  })
}
