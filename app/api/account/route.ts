import { NextResponse } from "next/server"
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "crypto"
import { db } from "@/lib/db"
import { gameAccounts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// ---------- Password hashing (scrypt com salt) ----------
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  // Compatibilidade: formato "salt:hash" (scrypt)
  const parts = stored.split(":")
  if (parts.length === 2) {
    const [salt, hash] = parts
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, "hex")
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  }
  return false
}

function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

function generateUniqueCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const bytes = randomBytes(12)
  let code = ""
  for (let i = 0; i < 12; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null
  const trimmed = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
  return trimmed
}

function normalizeCode(code: unknown): string | null {
  if (typeof code !== "string") return null
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (normalized.length !== 12) return null
  return normalized
}

function validPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 6 && password.length <= 200
}

// Limita o tamanho do progresso salvo (2 MB) para evitar abuso
function validProgress(progress: unknown): boolean {
  if (progress === null || progress === undefined) return true
  try {
    return JSON.stringify(progress).length <= 2_000_000
  } catch {
    return false
  }
}

// Código de erro do Postgres para violação de restrição única
function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505")
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    // sendBeacon envia como text/plain; fetch normal envia como application/json
    const contentType = request.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      body = await request.json()
    } else {
      // text/plain ou blob — tenta parsear o texto como JSON de qualquer forma
      const text = await request.text()
      body = JSON.parse(text)
    }
  } catch {
    return NextResponse.json({ success: false, error: "Requisicao invalida" }, { status: 400 })
  }

  const action = body.action

  try {
    // ---------- REGISTRAR COM EMAIL ----------
    if (action === "register") {
      const email = normalizeEmail(body.email)
      if (!email) {
        return NextResponse.json({ success: false, error: "Email invalido" }, { status: 400 })
      }
      if (!validPassword(body.password)) {
        return NextResponse.json(
          { success: false, error: "Senha deve ter pelo menos 6 caracteres" },
          { status: 400 },
        )
      }
      if (!validProgress(body.progress)) {
        return NextResponse.json({ success: false, error: "Progresso invalido" }, { status: 400 })
      }

      const [existing] = await db
        .select({ id: gameAccounts.id })
        .from(gameAccounts)
        .where(eq(gameAccounts.email, email))
        .limit(1)

      if (existing) {
        return NextResponse.json({ success: false, error: "Este email ja esta registrado" }, { status: 409 })
      }

      const token = generateSessionToken()
      const now = new Date()

      try {
        await db.insert(gameAccounts).values({
          id: randomUUID(),
          email,
          passwordHash: hashPassword(body.password),
          sessionToken: token,
          progress: (body.progress ?? null) as any,
          lastSaved: now,
        })
      } catch (error) {
        if (isUniqueViolation(error)) {
          return NextResponse.json({ success: false, error: "Este email ja esta registrado" }, { status: 409 })
        }
        console.error("[account] register error:", error)
        return NextResponse.json({ success: false, error: "Erro ao criar conta. Tente novamente." }, { status: 500 })
      }

      return NextResponse.json({ success: true, token, lastSaved: now.toISOString() })
    }

    // ---------- ENTRAR COM EMAIL ----------
    if (action === "login") {
      const email = normalizeEmail(body.email)
      if (!email || typeof body.password !== "string") {
        return NextResponse.json({ success: false, error: "Email ou senha invalidos" }, { status: 400 })
      }

      const [account] = await db
        .select({
          id: gameAccounts.id,
          passwordHash: gameAccounts.passwordHash,
          progress: gameAccounts.progress,
          lastSaved: gameAccounts.lastSaved,
        })
        .from(gameAccounts)
        .where(eq(gameAccounts.email, email))
        .limit(1)

      if (!account) {
        return NextResponse.json({ success: false, error: "Conta nao encontrada" }, { status: 404 })
      }
      if (!verifyPassword(body.password, account.passwordHash)) {
        return NextResponse.json({ success: false, error: "Senha incorreta" }, { status: 401 })
      }

      const token = generateSessionToken()
      await db.update(gameAccounts).set({ sessionToken: token }).where(eq(gameAccounts.id, account.id))

      return NextResponse.json({
        success: true,
        token,
        progress: account.progress,
        lastSaved: account.lastSaved,
      })
    }

    // ---------- REGISTRAR COM CÓDIGO ÚNICO ----------
    if (action === "register-code") {
      if (!validPassword(body.password)) {
        return NextResponse.json(
          { success: false, error: "Senha deve ter pelo menos 6 caracteres" },
          { status: 400 },
        )
      }
      if (!validProgress(body.progress)) {
        return NextResponse.json({ success: false, error: "Progresso invalido" }, { status: 400 })
      }

      const token = generateSessionToken()
      const now = new Date()
      const passwordHash = hashPassword(body.password)

      // Tenta até 5 vezes em caso de colisão de código (extremamente raro)
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateUniqueCode()
        try {
          await db.insert(gameAccounts).values({
            id: randomUUID(),
            uniqueCode: code,
            passwordHash,
            sessionToken: token,
            progress: (body.progress ?? null) as any,
            lastSaved: now,
          })
          return NextResponse.json({ success: true, token, code, lastSaved: now.toISOString() })
        } catch (error) {
          if (!isUniqueViolation(error)) {
            console.error("[account] register-code error:", error)
            return NextResponse.json(
              { success: false, error: "Erro ao criar conta. Tente novamente." },
              { status: 500 },
            )
          }
          // colisão de código único — tenta de novo com outro código
        }
      }
      return NextResponse.json({ success: false, error: "Erro ao gerar codigo. Tente novamente." }, { status: 500 })
    }

    // ---------- ENTRAR COM CÓDIGO ÚNICO ----------
    if (action === "login-code") {
      const code = normalizeCode(body.code)
      if (!code || typeof body.password !== "string") {
        return NextResponse.json({ success: false, error: "Codigo ou senha invalidos" }, { status: 400 })
      }

      const [account] = await db
        .select({
          id: gameAccounts.id,
          passwordHash: gameAccounts.passwordHash,
          progress: gameAccounts.progress,
          lastSaved: gameAccounts.lastSaved,
        })
        .from(gameAccounts)
        .where(eq(gameAccounts.uniqueCode, code))
        .limit(1)

      if (!account) {
        return NextResponse.json({ success: false, error: "Codigo nao encontrado" }, { status: 404 })
      }
      if (!verifyPassword(body.password, account.passwordHash)) {
        return NextResponse.json({ success: false, error: "Senha incorreta" }, { status: 401 })
      }

      const token = generateSessionToken()
      await db.update(gameAccounts).set({ sessionToken: token }).where(eq(gameAccounts.id, account.id))

      return NextResponse.json({
        success: true,
        token,
        progress: account.progress,
        lastSaved: account.lastSaved,
      })
    }

    // ---------- CARREGAR PROGRESSO (boot do jogo) ----------
    if (action === "load") {
      const token = body.token
      if (typeof token !== "string" || token.length < 32) {
        return NextResponse.json({ success: false, error: "Sessao invalida" }, { status: 401 })
      }

      const [account] = await db
        .select({
          email: gameAccounts.email,
          uniqueCode: gameAccounts.uniqueCode,
          progress: gameAccounts.progress,
          lastSaved: gameAccounts.lastSaved,
        })
        .from(gameAccounts)
        .where(eq(gameAccounts.sessionToken, token))
        .limit(1)

      if (!account) {
        return NextResponse.json({ success: false, error: "Sessao expirada. Entre novamente." }, { status: 401 })
      }

      return NextResponse.json({
        success: true,
        email: account.email,
        code: account.uniqueCode,
        progress: account.progress,
        lastSaved: account.lastSaved,
      })
    }

    // ---------- SALVAR PROGRESSO ----------
    if (action === "save") {
      const token = body.token
      if (typeof token !== "string" || token.length < 32) {
        return NextResponse.json({ success: false, error: "Sessao invalida" }, { status: 401 })
      }
      if (!validProgress(body.progress)) {
        return NextResponse.json({ success: false, error: "Progresso invalido" }, { status: 400 })
      }

      const now = new Date()
      let updatedId: string | null = null
      try {
        const rows = await db
          .update(gameAccounts)
          .set({ progress: (body.progress ?? null) as any, lastSaved: now })
          .where(eq(gameAccounts.sessionToken, token))
          .returning({ id: gameAccounts.id })
        updatedId = rows[0]?.id ?? null
      } catch (error) {
        console.error("[account] save error:", error)
        return NextResponse.json({ success: false, error: "Erro ao salvar. Tente novamente." }, { status: 500 })
      }
      if (!updatedId) {
        return NextResponse.json({ success: false, error: "Sessao expirada. Entre novamente." }, { status: 401 })
      }

      return NextResponse.json({ success: true, lastSaved: now.toISOString() })
    }

    return NextResponse.json({ success: false, error: "Acao desconhecida" }, { status: 400 })
  } catch (err) {
    console.error("[account] unexpected error:", err)
    return NextResponse.json({ success: false, error: "Erro interno. Tente novamente." }, { status: 500 })
  }
}
