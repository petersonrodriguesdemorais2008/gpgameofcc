"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Apple,
  Check,
  Chrome,
  Globe,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Wrench,
  X,
} from "lucide-react"
import { useGame } from "@/contexts/game-context"
import { useLanguage } from "@/contexts/language-context"

/** Versão exibida no canto da Title Screen. Atualize junto com cada release. */
export const GAME_VERSION = "v1.0.0"

export type TitlePanel = "account" | "repair" | "language" | "server"

export interface GameServer {
  id: string
  region: string
  name: string
}

/**
 * Regiões do jogo. Nenhuma delas carrega ping fixo: o número mostrado é sempre
 * medido em tempo real contra /api/ping. Só a região onde o deployment roda de
 * fato fica disponível — as outras aparecem como indisponíveis em vez de exibir
 * latência inventada.
 */
export const SERVERS: GameServer[] = [
  { id: "na1", region: "America", name: "Server 1" },
  { id: "sa1", region: "South America", name: "Server 1" },
  { id: "eu1", region: "Europe", name: "Server 1" },
  { id: "as1", region: "Asia", name: "Server 1" },
  { id: "jp1", region: "Japan", name: "Server 1" },
]

/** Mapeia a região real da Vercel (VERCEL_REGION) para a região do jogo. */
const VERCEL_REGION_TO_SERVER: Record<string, string> = {
  iad1: "na1",
  cle1: "na1",
  sfo1: "na1",
  pdx1: "na1",
  gru1: "sa1",
  fra1: "eu1",
  cdg1: "eu1",
  arn1: "eu1",
  dub1: "eu1",
  lhr1: "eu1",
  hnd1: "jp1",
  kix1: "jp1",
  sin1: "as1",
  bom1: "as1",
  hkg1: "as1",
  icn1: "as1",
  syd1: "as1",
}

export const SERVER_STORAGE_KEY = "gpgame_server"

export type PingStatus = "measuring" | "ok" | "offline"

export function getServerLabel(server: GameServer) {
  return `${server.region} - ${server.name}`
}

export function pingColor(ping: number | null) {
  if (ping === null) return "#94a3b8"
  if (ping < 80) return "#4ade80"
  if (ping < 150) return "#fbbf24"
  return "#f87171"
}

/**
 * Mede a latência real até o servidor do jogo.
 * O tempo é capturado quando os headers da resposta chegam (antes de ler o
 * corpo), e usamos a mediana de várias amostras para descartar picos.
 */
async function measurePing(samples = 3): Promise<{ ping: number; region: string } | null> {
  const times: number[] = []
  let region = "local"

  for (let i = 0; i < samples; i++) {
    const start = performance.now()
    try {
      const res = await fetch(`/api/ping?t=${Date.now()}-${i}`, { cache: "no-store" })
      const elapsed = performance.now() - start
      if (!res.ok) return null
      times.push(elapsed)
      const data = (await res.json().catch(() => null)) as { region?: string } | null
      if (data?.region) region = data.region
    } catch {
      return null
    }
  }

  if (times.length === 0) return null
  times.sort((a, b) => a - b)
  return { ping: Math.round(times[Math.floor(times.length / 2)]), region }
}

/**
 * Servidor escolhido + latência medida de verdade.
 * A escolha é salva no dispositivo, mas apenas a região realmente hospedada
 * pode ser selecionada.
 */
export function useSelectedServer() {
  const [serverId, setServerId] = useState<string>(SERVERS[0].id)
  const [liveServerId, setLiveServerId] = useState<string>(SERVERS[0].id)
  const [ping, setPing] = useState<number | null>(null)
  const [status, setStatus] = useState<PingStatus>("measuring")
  const running = useRef(false)

  const refresh = useCallback(async () => {
    if (running.current) return
    running.current = true
    setStatus("measuring")
    const result = await measurePing()
    if (result) {
      setPing(result.ping)
      setStatus("ok")
      const mapped = VERCEL_REGION_TO_SERVER[result.region]
      if (mapped) setLiveServerId(mapped)
    } else {
      setPing(null)
      setStatus("offline")
    }
    running.current = false
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SERVER_STORAGE_KEY)
      if (saved && SERVERS.some((s) => s.id === saved)) setServerId(saved)
    } catch {
      /* localStorage indisponível */
    }
    void refresh()
    // Remede periodicamente para o valor não ficar velho na tela
    const id = window.setInterval(() => void refresh(), 20000)
    return () => window.clearInterval(id)
  }, [refresh])

  // Se a escolha salva aponta para uma região que não está hospedada, volta
  // para a que realmente responde.
  useEffect(() => {
    if (status === "ok" && serverId !== liveServerId) {
      setServerId(liveServerId)
      try {
        localStorage.setItem(SERVER_STORAGE_KEY, liveServerId)
      } catch {
        /* localStorage indisponível */
      }
    }
  }, [status, liveServerId, serverId])

  const selectServer = useCallback((id: string) => {
    setServerId(id)
    try {
      localStorage.setItem(SERVER_STORAGE_KEY, id)
    } catch {
      /* localStorage indisponível */
    }
  }, [])

  const server = SERVERS.find((s) => s.id === serverId) ?? SERVERS[0]
  return { server, selectServer, ping, status, liveServerId, refresh }
}

/* ---------------------------------------------------------------- shell ---- */

const PANEL_META: Record<TitlePanel, { icon: typeof UserCog; titleKey: string }> = {
  account: { icon: UserCog, titleKey: "accountManagement" },
  repair: { icon: Wrench, titleKey: "repairTitle" },
  language: { icon: Globe, titleKey: "titleLanguage" },
  server: { icon: Globe, titleKey: "selectServerTitle" },
}

function PanelShell({
  panel,
  onClose,
  children,
}: {
  panel: TitlePanel
  onClose: () => void
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  const { icon: Icon, titleKey } = PANEL_META[panel]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(titleKey)}
      className="fixed inset-0 flex items-center justify-center px-4 cursor-default"
      style={{ zIndex: 120, background: "rgba(2,6,23,0.78)", animation: "panelFade 0.25s ease-out both" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(160deg, rgba(15,23,42,0.98) 0%, rgba(8,14,30,0.98) 100%)",
          border: "1px solid rgba(56,189,248,0.35)",
          boxShadow: "0 0 0 1px rgba(56,189,248,0.08), 0 30px 80px rgba(0,0,0,0.75), 0 0 60px rgba(56,189,248,0.12)",
          animation: "panelRise 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(to right, transparent, #38bdf8, transparent)" }}
        />

        <header className="flex items-center gap-3 border-b border-sky-400/15 px-5 py-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)" }}
          >
            <Icon className="h-5 w-5" style={{ color: "#7dd3fc" }} aria-hidden="true" />
          </span>
          <h2
            className="flex-1 text-sm font-semibold uppercase tracking-[0.18em] text-sky-100"
            style={{ textShadow: "0 0 18px rgba(56,189,248,0.5)" }}
          >
            {t(titleKey)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-sky-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="px-5 py-5">{children}</div>
      </div>

      <style>{`
        @keyframes panelFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes panelRise {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

const rowClass =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45"

const rowStyle: React.CSSProperties = {
  background: "rgba(148,163,184,0.06)",
  border: "1px solid rgba(148,163,184,0.16)",
  color: "#e2e8f0",
}

const activeRowStyle: React.CSSProperties = {
  background: "rgba(56,189,248,0.14)",
  border: "1px solid rgba(56,189,248,0.5)",
  color: "#e0f2fe",
  boxShadow: "0 0 24px rgba(56,189,248,0.18)",
}

/* --------------------------------------------------------------- account ---- */

function AccountPanel({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage()
  const { accountAuth, logoutAccount } = useGame()
  const isLoggedIn = Boolean(accountAuth?.isLoggedIn)

  const handleSignOut = () => {
    logoutAccount()
    onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          background: isLoggedIn ? "rgba(56,189,248,0.08)" : "rgba(251,191,36,0.08)",
          border: `1px solid ${isLoggedIn ? "rgba(56,189,248,0.28)" : "rgba(251,191,36,0.3)"}`,
        }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            background: isLoggedIn ? "rgba(56,189,248,0.16)" : "rgba(251,191,36,0.16)",
          }}
        >
          <UserCog
            className="h-5 w-5"
            style={{ color: isLoggedIn ? "#7dd3fc" : "#fbbf24" }}
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
            {isLoggedIn ? t("signedInAs") : t("playingAsGuest")}
          </p>
          <p className="truncate text-sm font-semibold text-sky-100">
            {isLoggedIn ? accountAuth?.playerName || accountAuth?.uniqueCode : t("playingAsGuest")}
          </p>
        </div>
      </div>

      {!isLoggedIn ? (
        <p className="text-xs leading-relaxed text-amber-200/75">{t("guestWarning")}</p>
      ) : accountAuth?.uniqueCode ? (
        <div className="flex items-center justify-between rounded-lg px-3 py-2" style={rowStyle}>
          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{t("playerCode")}</span>
          <span className="font-mono text-xs text-sky-200">{accountAuth.uniqueCode}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{t("linkAccount")}</p>
        {[
          { Icon: Chrome, label: "Google" },
          { Icon: Apple, label: "Apple" },
          { Icon: Mail, label: "E-mail" },
        ].map(({ Icon, label }) => (
          <button key={label} type="button" disabled className={rowClass} style={rowStyle}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 font-medium">{label}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{t("comingSoon")}</span>
          </button>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-slate-400">{t("accountFullOptions")}</p>

      {isLoggedIn ? (
        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
          <button type="button" onClick={handleSignOut} className={rowClass} style={rowStyle}>
            <UserCog className="h-4 w-4 shrink-0" style={{ color: "#7dd3fc" }} aria-hidden="true" />
            <span className="flex-1 font-medium">{t("switchUser")}</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className={rowClass}
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.32)",
              color: "#fecaca",
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 font-medium">{t("signOut")}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

/* ---------------------------------------------------------------- repair ---- */

/**
 * Chaves temporárias seguras de remover: são marcadores de "duelo em
 * andamento" — exatamente o que corrompe e trava o cliente ao reabrir.
 * NÃO inclui gpgame_pending_packs nem gpgame_pending_invite, que guardam
 * recompensas e convites reais do jogador.
 */
const TRANSIENT_KEYS = ["gpgame_story_battle_pending", "gpgame_event_battle_pending"]

type RepairItem = {
  key: string
  found: number
  cleared: number | null
}

function RepairPanel() {
  const { t } = useLanguage()
  const [items, setItems] = useState<RepairItem[] | null>(null)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)

  /** Conta o que realmente existe para limpar — sem inventar números. */
  const scan = useCallback(async (): Promise<RepairItem[]> => {
    let caches_ = 0
    let workers = 0
    let transient = 0

    try {
      if ("caches" in window) caches_ = (await caches.keys()).length
    } catch {
      /* ignora */
    }
    try {
      if ("serviceWorker" in navigator) workers = (await navigator.serviceWorker.getRegistrations()).length
    } catch {
      /* ignora */
    }
    try {
      transient = sessionStorage.length + TRANSIENT_KEYS.filter((k) => localStorage.getItem(k) !== null).length
    } catch {
      /* ignora */
    }

    return [
      { key: "repairStepCache", found: caches_, cleared: null },
      { key: "repairStepAssets", found: workers, cleared: null },
      { key: "repairStepTemp", found: transient, cleared: null },
    ]
  }, [])

  useEffect(() => {
    void scan().then(setItems)
  }, [scan])

  const runRepair = async () => {
    if (running || finished) return
    setRunning(true)

    let clearedCaches = 0
    let clearedWorkers = 0
    let clearedTransient = 0

    try {
      if ("caches" in window) {
        const keys = await caches.keys()
        const results = await Promise.all(keys.map((k) => caches.delete(k)))
        clearedCaches = results.filter(Boolean).length
      }
    } catch {
      /* segue o reparo mesmo se falhar */
    }

    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        const results = await Promise.all(regs.map((r) => r.unregister()))
        clearedWorkers = results.filter(Boolean).length
      }
    } catch {
      /* ignora */
    }

    try {
      clearedTransient = sessionStorage.length
      sessionStorage.clear()
      TRANSIENT_KEYS.forEach((k) => {
        if (localStorage.getItem(k) !== null) {
          localStorage.removeItem(k)
          clearedTransient += 1
        }
      })
    } catch {
      /* ignora */
    }

    setItems([
      { key: "repairStepCache", found: clearedCaches, cleared: clearedCaches },
      { key: "repairStepAssets", found: clearedWorkers, cleared: clearedWorkers },
      { key: "repairStepTemp", found: clearedTransient, cleared: clearedTransient },
    ])
    setRunning(false)
    setFinished(true)
  }

  const totalFound = items?.reduce((sum, i) => sum + i.found, 0) ?? 0
  const isHealthy = items !== null && !finished && totalFound === 0

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-slate-300">{t("repairDescription")}</p>

      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3"
        style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)" }}
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#4ade80" }} aria-hidden="true" />
        <p className="text-xs leading-relaxed text-emerald-200/80">{t("repairSafeNotice")}</p>
      </div>

      <ul className="flex flex-col gap-2" aria-live="polite">
        {items === null ? (
          <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("repairScanning")}
          </li>
        ) : (
          items.map((item) => {
            const hasWork = item.found > 0
            return (
              <li
                key={item.key}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: hasWork ? "rgba(56,189,248,0.08)" : "rgba(148,163,184,0.05)",
                  border: `1px solid ${hasWork ? "rgba(56,189,248,0.28)" : "rgba(148,163,184,0.12)"}`,
                  color: hasWork ? "#e0f2fe" : "#64748b",
                }}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {finished ? (
                    <Check className="h-4 w-4" style={{ color: "#4ade80" }} aria-hidden="true" />
                  ) : (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: hasWork ? "#38bdf8" : "#475569" }}
                    />
                  )}
                </span>
                <span className="flex-1">{t(item.key)}</span>
                <span className="font-mono text-[11px]">
                  {item.found === 0
                    ? t("repairNothingToClear")
                    : `${item.found} ${finished ? t("repairCleared") : t("repairItemsFound")}`}
                </span>
              </li>
            )
          })
        )}
      </ul>

      {isHealthy ? (
        <p className="text-xs leading-relaxed text-slate-400">
          {t("repairClientHealthy")} {t("repairNoServiceWorker")}
        </p>
      ) : null}

      {finished ? <p className="text-xs leading-relaxed text-emerald-200/80">{t("repairSummary")}</p> : null}

      <button
        type="button"
        onClick={finished ? () => window.location.reload() : runRepair}
        disabled={running || items === null}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold uppercase tracking-[0.14em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: finished
            ? "linear-gradient(to right, rgba(74,222,128,0.25), rgba(34,197,94,0.25))"
            : "linear-gradient(to right, rgba(56,189,248,0.25), rgba(168,85,247,0.25))",
          border: `1px solid ${finished ? "rgba(74,222,128,0.5)" : "rgba(56,189,248,0.5)"}`,
          color: finished ? "#bbf7d0" : "#e0f2fe",
          boxShadow: running ? "none" : "0 0 30px rgba(56,189,248,0.2)",
        }}
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : finished ? (
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Wrench className="h-4 w-4" aria-hidden="true" />
        )}
        {finished ? t("repairReloadNow") : running ? t("repairRunning") : t("repairStart")}
      </button>
    </div>
  )
}

/* -------------------------------------------------------------- language ---- */

const LANGUAGES = [
  { code: "pt" as const, tag: "PT", labelKey: "portuguese" },
  { code: "en" as const, tag: "EN", labelKey: "english" },
  { code: "ja" as const, tag: "JA", labelKey: "japanese" },
]

function LanguagePanel() {
  const { t, language, setLanguage } = useLanguage()

  return (
    <div className="flex flex-col gap-2">
      {LANGUAGES.map((lang) => {
        const isActive = language === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            aria-pressed={isActive}
            className={rowClass}
            style={isActive ? activeRowStyle : rowStyle}
          >
            <span
              className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold tracking-wider"
              style={{
                background: isActive ? "rgba(56,189,248,0.2)" : "rgba(148,163,184,0.1)",
                color: isActive ? "#7dd3fc" : "#94a3b8",
              }}
            >
              {lang.tag}
            </span>
            <span className="flex-1 font-medium">{t(lang.labelKey)}</span>
            {isActive ? <Check className="h-4 w-4 shrink-0" style={{ color: "#7dd3fc" }} aria-hidden="true" /> : null}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- server ---- */

function ServerPanel({
  currentServerId,
  liveServerId,
  ping,
  status,
  onRefresh,
  onSelectServer,
}: {
  currentServerId: string
  liveServerId: string
  ping: number | null
  status: PingStatus
  onRefresh: () => void
  onSelectServer: (id: string) => void
}) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {SERVERS.map((s) => {
          const isLive = s.id === liveServerId
          const isActive = s.id === currentServerId && isLive

          return (
            <button
              key={s.id}
              type="button"
              disabled={!isLive}
              onClick={() => isLive && onSelectServer(s.id)}
              aria-pressed={isActive}
              className={rowClass}
              style={isActive ? activeRowStyle : rowStyle}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={
                  isLive
                    ? { background: pingColor(ping), boxShadow: `0 0 8px ${pingColor(ping)}` }
                    : { background: "#475569" }
                }
                aria-hidden="true"
              />
              <span className="flex-1 font-medium">{getServerLabel(s)}</span>

              {isLive ? (
                <span className="font-mono text-[11px]" style={{ color: pingColor(ping) }}>
                  {status === "measuring"
                    ? `${t("serverMeasuring")}...`
                    : status === "offline"
                      ? t("serverOffline")
                      : `${ping}ms`}
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{t("serverUnavailable")}</span>
              )}

              {isActive ? (
                <span className="text-[10px] uppercase tracking-wider text-sky-300">{t("serverCurrent")}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="text-xs leading-relaxed text-slate-400">{t("serverRegionsNote")}</p>

      <button
        type="button"
        onClick={onRefresh}
        disabled={status === "measuring"}
        className="flex items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-sky-200 transition-colors hover:bg-white/5 disabled:opacity-50"
        style={{ border: "1px solid rgba(56,189,248,0.25)" }}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${status === "measuring" ? "animate-spin" : ""}`} aria-hidden="true" />
        {t("serverRemeasure")}
      </button>
    </div>
  )
}

/* ----------------------------------------------------------------- entry ---- */

export function TitleMenuPanel({
  panel,
  onClose,
  currentServerId,
  liveServerId,
  ping,
  status,
  onRefresh,
  onSelectServer,
}: {
  panel: TitlePanel
  onClose: () => void
  currentServerId: string
  liveServerId: string
  ping: number | null
  status: PingStatus
  onRefresh: () => void
  onSelectServer: (id: string) => void
}) {
  return (
    <PanelShell panel={panel} onClose={onClose}>
      {panel === "account" ? <AccountPanel onClose={onClose} /> : null}
      {panel === "repair" ? <RepairPanel /> : null}
      {panel === "language" ? <LanguagePanel /> : null}
      {panel === "server" ? (
        <ServerPanel
          currentServerId={currentServerId}
          liveServerId={liveServerId}
          ping={ping}
          status={status}
          onRefresh={onRefresh}
          onSelectServer={onSelectServer}
        />
      ) : null}
    </PanelShell>
  )
}
