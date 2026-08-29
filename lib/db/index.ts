import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

// Configuração resiliente para ambiente serverless: limita conexões simultâneas
// por instância, libera conexões ociosas rapidamente e falha rápido em vez de
// travar indefinidamente quando o Neon está sob carga ou "acordando" (cold start).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
})

pool.on("error", (err) => {
  console.error("[db] erro inesperado no pool de conexões:", err)
})

export const db = drizzle(pool, { schema })
