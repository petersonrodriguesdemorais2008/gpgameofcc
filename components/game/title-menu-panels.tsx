"use client"

import { useCallback, useEffect, useState } from "react"
import { Apple, Check, Chrome, Globe, Loader2, LogOut, Mail, ShieldCheck, UserCog, Wrench, X } from "lucide-react"
import { useGame } from "@/contexts/game-context"
import { useLanguage } from "@/contexts/language-context"

/** Versão exibida no canto da Title Screen. Atualize junto com cada release. */
export const GAME_VERSION = "v1.0.0"

export type TitlePanel = "account" | "repair" | "language" | "server"

export interface GameServer {
  id: string
  region: string
  name: string
  ping: number
}

export const SERVERS: GameServer[] = [
  { id: "na1", region: "America", name: "Server 1", ping: 32 },
  { id: "na2", region: "America", name: "Server 2", ping: 48 },
  { id: "eu1", region: "Europe", name: "Server 1", ping: 118 },
  { id: "as1", region: "Asia", name: "Server 1", ping: 164 },
  { id: "jp1", region: "Japan", name: "Server 1", ping: 187 },
]

export const SERVER_STORAGE_KEY = "gpgame_server"

export function getServerLabel(server: GameServer) {
  return `${server.region} - ${server.name}`
}

export function pingColor(ping: number) {
  if (ping < 80) return "#4ade80"
  if (ping < 150) return "#fbbf24"
  return "#f87171"
}

/** Lê/salva o servidor escolhido no dispositivo. */
export function useSelectedServer() {
  const [serverId, setServerId] = useState<string>(SERVERS[0].id)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SERVER_STORAGE_KEY)
      if (saved && SERVERS.some((s) => s.id === saved)) setServerId(saved)
    } catch {
      /* localStorage indisponível */
    }
  }, [])

  const selectServer = useCallback((id: string) => {
    setServerId(id)
    try {
      localStorage.setItem(SERVER_STORAGE_KEY, id)
    } catch {
      /* localStorage indisponível */
    }
  }, [])

  const server = SERVERS.find((s) => s.id === serverId) ?? SERVERS[0]
  return { server, selectServer }
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
  const isLoggedIn = accountAuth?.isLoggedIn ?? false

  const handleSignOut = () => {
    logoutAccount()
    onClose()
  }

  const handleSwitchUser = () => {
    logoutAccount()
    // Recarrega para o cliente reiniciar limpo no fluxo de login
    setTimeout(() => window.location.reload(), 150)
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-xl px-4 py-3"
        style={{
          background: isLoggedIn ? "rgba(74,222,128,0.08)" : "rgba(251,191,36,0.08)",
          border: `1px solid ${isLoggedIn ? "rgba(74,222,128,0.28)" : "rgba(251,191,36,0.28)"}`,
        }}
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
          {isLoggedIn ? t("signedInAs") : t("titleAccount")}
        </p>
        <p className="mt-1 truncate text-base font-semibold" style={{ color: isLoggedIn ? "#bbf7d0" : "#fde68a" }}>
          {isLoggedIn ? (accountAuth.email ?? accountAuth.uniqueCode ?? "—") : t("playingAsGuest")}
        </p>

        {isLoggedIn ? (
          <dl className="mt-3 flex flex-col gap-1 text-xs text-slate-400">
            {accountAuth.uniqueCode ? (
              <div className="flex items-center justify-between gap-3">
                <dt>{t("playerCode")}</dt>
                <dd className="font-mono tracking-widest text-sky-200">{accountAuth.uniqueCode}</dd>
              </div>
            ) : null}
            {accountAuth.lastSaved ? (
              <div className="flex items-center justify-between gap-3">
                <dt>{t("lastSync")}</dt>
                <dd className="text-slate-300">{new Date(accountAuth.lastSaved).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-amber-200/70">{t("guestWarning")}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="px-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">{t("linkAccount")}</p>

        <button type="button" className={rowClass} style={rowStyle} disabled>
          <Chrome className="h-4 w-4 shrink-0" style={{ color: "#7dd3fc" }} aria-hidden="true" />
          <span className="flex-1">Google</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">{t("comingSoon")}</span>
        </button>

        <button type="button" className={rowClass} style={rowStyle} disabled>
          <Apple className="h-4 w-4 shrink-0" style={{ color: "#7dd3fc" }} aria-hidden="true" />
          <span className="flex-1">Apple</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">{t("comingSoon")}</span>
        </button>

        <div className={rowClass} style={rowStyle}>
          <Mail className="h-4 w-4 shrink-0" style={{ color: "#7dd3fc" }} aria-hidden="true" />
          <span className="flex-1 text-xs leading-relaxed text-slate-400">{t("accountFullOptions")}</span>
        </div>
      </div>

      {isLoggedIn ? (
        <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={handleSwitchUser}
            className={rowClass}
            style={{ ...rowStyle, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.35)" }}
          >
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

const REPAIR_STEP_KEYS = ["repairStepCache", "repairStepAssets", "repairStepTemp", "repairStepRestart"] as const

/** Chaves temporárias/voláteis — seguras de remover, não contêm progresso. */
const TRANSIENT_KEYS = ["gpgame_story_battle_pending", "gpgame_event_battle_pending"]

function RepairPanel() {
  const { t } = useLanguage()
  const [step, setStep] = useState(-1)
  const [done, setDone] = useState(false)

  const runRepair = async () => {
    if (step >= 0) return

    // 1. Cache Storage (arquivos servidos pelo navegador/service worker)
    setStep(0)
    try {
      if ("caches" in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      /* segue o reparo mesmo se falhar */
    }
    await new Promise((r) => setTimeout(r, 550))

    // 2. Service workers (força o cliente a baixar assets novos)
    setStep(1)
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {
      /* ignora */
    }
    await new Promise((r) => setTimeout(r, 550))

    // 3. Dados temporários — progresso e conta são preservados
    setStep(2)
    try {
      sessionStorage.clear()
      TRANSIENT_KEYS.forEach((k) => localStorage.removeItem(k))
    } catch {
      /* ignora */
    }
    await new Promise((r) => setTimeout(r, 550))

    // 4. Reinicia o cliente
    setStep(3)
    setDone(true)
    await new Promise((r) => setTimeout(r, 900))
    window.location.reload()
  }

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

      <ol className="flex flex-col gap-2" aria-live="polite">
        {REPAIR_STEP_KEYS.map((key, i) => {
          const isActive = step === i && !done
          const isComplete = step > i || (done && step >= i)
          return (
            <li
              key={key}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-all duration-300"
              style={{
                background: isActive ? "rgba(56,189,248,0.1)" : "rgba(148,163,184,0.05)",
                border: `1px solid ${isActive ? "rgba(56,189,248,0.4)" : "rgba(148,163,184,0.12)"}`,
                color: isComplete ? "#bbf7d0" : isActive ? "#e0f2fe" : "#64748b",
              }}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {isComplete ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                )}
              </span>
              <span className="flex-1">{t(key)}</span>
            </li>
          )
        })}
      </ol>

      <button
        type="button"
        onClick={runRepair}
        disabled={step >= 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold uppercase tracking-[0.14em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: done
            ? "linear-gradient(to right, rgba(74,222,128,0.25), rgba(34,197,94,0.25))"
            : "linear-gradient(to right, rgba(56,189,248,0.25), rgba(168,85,247,0.25))",
          border: `1px solid ${done ? "rgba(74,222,128,0.5)" : "rgba(56,189,248,0.5)"}`,
          color: done ? "#bbf7d0" : "#e0f2fe",
          boxShadow: step >= 0 ? "none" : "0 0 30px rgba(56,189,248,0.2)",
        }}
      >
        <Wrench className="h-4 w-4" aria-hidden="true" />
        {done ? t("repairDone") : step >= 0 ? t("repairRunning") : t("repairStart")}
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
  onSelectServer,
}: {
  currentServerId: string
  onSelectServer: (id: string) => void
}) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-2">
      {SERVERS.map((s) => {
        const isActive = s.id === currentServerId
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectServer(s.id)}
            aria-pressed={isActive}
            className={rowClass}
            style={isActive ? activeRowStyle : rowStyle}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: pingColor(s.ping), boxShadow: `0 0 8px ${pingColor(s.ping)}` }}
              aria-hidden="true"
            />
            <span className="flex-1 font-medium">{getServerLabel(s)}</span>
            <span className="font-mono text-[11px]" style={{ color: pingColor(s.ping) }}>
              {s.ping}ms
            </span>
            {isActive ? (
              <span className="text-[10px] uppercase tracking-wider text-sky-300">{t("serverCurrent")}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------------------- entry ---- */

export function TitleMenuPanel({
  panel,
  onClose,
  currentServerId,
  onSelectServer,
}: {
  panel: TitlePanel
  onClose: () => void
  currentServerId: string
  onSelectServer: (id: string) => void
}) {
  return (
    <PanelShell panel={panel} onClose={onClose}>
      {panel === "account" ? <AccountPanel onClose={onClose} /> : null}
      {panel === "repair" ? <RepairPanel /> : null}
      {panel === "language" ? <LanguagePanel /> : null}
      {panel === "server" ? <ServerPanel currentServerId={currentServerId} onSelectServer={onSelectServer} /> : null}
    </PanelShell>
  )
}
