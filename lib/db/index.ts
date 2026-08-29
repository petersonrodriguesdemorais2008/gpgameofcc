import { drizzle } from "drizzle-orm/node-postgres"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// O driver `pg` cai silenciosamente em 127.0.0.1:5432 quando nenhuma string de
// conexão é encontrada — o que gera o erro "connect ECONNREFUSED 127.0.0.1:5432".
// Aqui procuramos todas as variáveis que o Neon pode expor e falhamos com uma
// mensagem clara caso nenhuma exista.
function resolveConnectionString(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_PRISMA_URL,
  ]
  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim()
  }
  return null
}

let cachedPool: Pool | null = null

function getPool(): Pool {
  if (cachedPool) return cachedPool

  const connectionString = resolveConnectionString()
  if (!connectionString) {
    throw new Error(
      "Banco de dados nao configurado: defina DATABASE_URL (integracao Neon) no projeto.",
    )
  }

  // Configuração resiliente para ambiente serverless: limita conexões simultâneas
  // por instância, libera conexões ociosas rapidamente e falha rápido em vez de
  // travar indefinidamente quando o Neon está sob carga ou "acordando" (cold start).
  cachedPool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  })

  cachedPool.on("error", (err) => {
    console.error("[db] erro inesperado no pool de conexoes:", err)
  })

  return cachedPool
}

let cachedDb: NodePgDatabase<typeof schema> | null = null

function getDb(): NodePgDatabase<typeof schema> {
  if (!cachedDb) cachedDb = drizzle(getPool(), { schema })
  return cachedDb
}

// Proxy para inicialização tardia: o pool só é criado na primeira query real,
// evitando que o build/prerender tente conectar (ou explodir) sem env vars.
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver)
  },
})

export { getPool }
