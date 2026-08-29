import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar, bigint } from "drizzle-orm/pg-core"

// Contas do jogo (login por e-mail+senha ou código único, sem provedor de auth externo)
export const gameAccounts = pgTable("game_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  uniqueCode: varchar("unique_code", { length: 12 }).unique(),
  passwordHash: text("password_hash").notNull(),
  sessionToken: text("session_token").unique(),
  progress: jsonb("progress"),
  premium: boolean("premium").default(false),
  stripeCustomerId: text("stripe_customer_id"),
  lastSaved: timestamp("last_saved", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Salas de duelo PVP
export const duelRooms = pgTable("duel_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomCode: varchar("room_code", { length: 6 }).notNull().unique(),
  hostId: varchar("host_id", { length: 50 }).notNull(),
  hostName: varchar("host_name", { length: 100 }).notNull(),
  hostDeck: jsonb("host_deck"),
  hostAvatarUrl: text("host_avatar_url"),
  guestId: varchar("guest_id", { length: 50 }),
  guestName: varchar("guest_name", { length: 100 }),
  guestDeck: jsonb("guest_deck"),
  guestAvatarUrl: text("guest_avatar_url"),
  hostReady: boolean("host_ready").default(false),
  guestReady: boolean("guest_ready").default(false),
  status: varchar("status", { length: 20 }).default("waiting"),
  gameState: jsonb("game_state"),
  currentTurn: varchar("current_turn", { length: 50 }),
  turnNumber: integer("turn_number").default(1),
  phase: varchar("phase", { length: 20 }).default("draw"),
  winnerId: varchar("winner_id", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// Chat dentro da sala de duelo
export const duelChat = pgTable("duel_chat", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").references(() => duelRooms.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id", { length: 50 }).notNull(),
  senderName: varchar("sender_name", { length: 100 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Status premium (gear pass) por playerId local, independente de login
export const playerProfiles = pgTable("player_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: varchar("player_id", { length: 64 }).notNull().unique(),
  hasPremiumPass: boolean("has_premium_pass").default(false),
  premiumPassExpiresAt: timestamp("premium_pass_expires_at", { withTimezone: true }),
  premiumPassPurchasedAt: timestamp("premium_pass_purchased_at", { withTimezone: true }),
  premiumStripeSessionId: text("premium_stripe_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// Ações de jogo sincronizadas entre os dois jogadores
export const duelActions = pgTable("duel_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").references(() => duelRooms.id, { onDelete: "cascade" }),
  // sequenceNumber é enviado pelo cliente mas não é estritamente sequencial;
  // cursorId (auto-incremento do banco) é o cursor real usado no polling.
  sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
  cursorId: bigint("cursor_id", { mode: "number" }),
  playerId: varchar("player_id", { length: 50 }).notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  actionData: jsonb("action_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
