"use client"

import { useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame, PROFILE_ICONS } from "@/contexts/game-context"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Globe,
  User,
  Copy,
  Check,
  Edit2,
  Save,
  Mail,
  Lock,
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  Settings,
  Sparkles,
  Key,
  Hash,
  Gift,
  Trash2,
  AlertTriangle,
  Monitor,
  Smartphone,
  Home,
} from "lucide-react"

interface SettingsScreenProps {
  onBack: (message?: string) => void
  onReturnToTitle?: () => void
}

type TabType = "language" | "account" | "codes" | "display"

export default function SettingsScreen({ onBack, onReturnToTitle }: SettingsScreenProps) {
  const { t, language, setLanguage } = useLanguage()
  const {
    playerId,
    playerProfile,
    updatePlayerProfile,
    accountAuth,
    loginAccount,
    registerAccount,
    loginWithCode,
    registerWithCode,
    logoutAccount,
    saveProgressManually,
    redeemCode,
    redeemedCodes,
    deleteAccountData,
    mobileMode,
    setMobileMode,
  } = useGame()
  const [activeTab, setActiveTab] = useState<TabType>("language")
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(playerProfile.name)
  const [editTitle, setEditTitle] = useState(playerProfile.title)
  const [editAvatarUrl, setEditAvatarUrl] = useState(playerProfile.avatarUrl || "")
  const [showIconPicker, setShowIconPicker] = useState(false)

  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [authType, setAuthType] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [uniqueCode, setUniqueCode] = useState("")
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [authError, setAuthError] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  
  // Codes state
  const [codeInput, setCodeInput] = useState("")
  const [codeMessage, setCodeMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  
  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Mobile mode state
  const [showMobileConfirm, setShowMobileConfirm] = useState(false)
  const [detectedDevice, setDetectedDevice] = useState<"mobile" | "pc" | null>(null)
  
  // Return to title state
  const [showReturnToTitleConfirm, setShowReturnToTitleConfirm] = useState(false)

  const detectDevice = () => {
    if (typeof window === "undefined") return "pc"
    const ua = navigator.userAgent || ""
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
      (window.innerWidth <= 768)
    return isMobile ? "mobile" : "pc"
  }

  const handleMobileModeToggle = () => {
    if (mobileMode) {
      // Disable mobile mode directly
      setMobileMode(false)
      onBack("Modo de Jogo Mobile desativado")
      return
    }
    // Trying to enable: detect device first
    const device = detectDevice()
    setDetectedDevice(device)
    if (device === "mobile") {
      setShowMobileConfirm(true)
    } else {
      // PC detected - still show a message but allow enabling
      setShowMobileConfirm(true)
    }
  }

  const confirmMobileMode = () => {
    setMobileMode(true)
    setShowMobileConfirm(false)
    onBack("Modo de Jogo Mobile ativado")
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(playerId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveProfile = () => {
    updatePlayerProfile({ 
      name: editName, 
      title: editTitle,
      avatarUrl: editAvatarUrl || undefined
    })
    setIsEditing(false)
    setShowIconPicker(false)
  }

  const handleLogin = async () => {
    setAuthError("")
    setAuthLoading(true)
    const result = await loginAccount(email, password)
    setAuthLoading(false)
    if (!result.success) {
      setAuthError(result.error || "Erro ao fazer login")
    } else {
      setEmail("")
      setPassword("")
    }
  }

  const handleRegister = async () => {
    setAuthError("")
    if (password !== confirmPassword) {
      setAuthError("As senhas nao coincidem")
      return
    }
    setAuthLoading(true)
    const result = await registerAccount(email, password)
    setAuthLoading(false)
    if (!result.success) {
      setAuthError(result.error || "Erro ao registrar")
    } else {
      setEmail("")
      setPassword("")
      setConfirmPassword("")
    }
  }

  const handleLoginWithCode = async () => {
    setAuthError("")
    if (!uniqueCode.trim()) {
      setAuthError("Digite o codigo unico")
      return
    }
    setAuthLoading(true)
    const result = await loginWithCode(uniqueCode, password)
    setAuthLoading(false)
    if (!result.success) {
      setAuthError(result.error || "Erro ao fazer login")
    } else {
      setUniqueCode("")
      setPassword("")
    }
  }

  const handleRegisterWithCode = async () => {
    setAuthError("")
    if (password !== confirmPassword) {
      setAuthError("As senhas nao coincidem")
      return
    }
    if (password.length < 6) {
      setAuthError("Senha deve ter pelo menos 6 caracteres")
      return
    }
    setAuthLoading(true)
    const result = await registerWithCode(password)
    setAuthLoading(false)
    if (!result.success) {
      setAuthError(result.error || "Erro ao criar conta")
    } else {
      setGeneratedCode(result.code || null)
      setPassword("")
      setConfirmPassword("")
    }
  }

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }

  const formatCode = (code: string) => {
    // Format: XXXX-XXXX-XXXX
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "")
    const parts = []
    for (let i = 0; i < clean.length && i < 12; i += 4) {
      parts.push(clean.slice(i, i + 4))
    }
    return parts.join("-")
  }

  const handleManualSave = () => {
    saveProgressManually()
    setSaveMessage("Progresso salvo!")
    setTimeout(() => setSaveMessage(""), 3000)
  }
  
  const handleRedeemCode = () => {
    if (!codeInput.trim()) {
      setCodeMessage({ text: "Digite um codigo", type: "error" })
      return
    }
    setCodeLoading(true)
    const result = redeemCode(codeInput)
    setCodeLoading(false)
    setCodeMessage({ text: result.message, type: result.success ? "success" : "error" })
    if (result.success) {
      setCodeInput("")
    }
    setTimeout(() => setCodeMessage(null), 5000)
  }
  
  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    const result = await deleteAccountData()
    setDeleteLoading(false)
    if (result.success) {
      setShowDeleteConfirm(false)
      setSaveMessage("Dados da conta deletados com sucesso!")
      setTimeout(() => setSaveMessage(""), 3000)
    }
  }

  const formatLastSaved = (dateString: string | null) => {
    if (!dateString) return "Nunca"
    const date = new Date(dateString)
    return date.toLocaleString("pt-BR")
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{background:"linear-gradient(160deg,#050810 0%,#0a0d1a 40%,#060d18 100%)"}}>

      {/* Background depth layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 90% 50% at 50% -10%, rgba(6,182,212,0.10) 0%, transparent 60%)"}} />
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 40% at 95% 80%, rgba(251,191,36,0.06) 0%, transparent 50%)"}} />
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px, transparent 1px)",backgroundSize:"48px 48px"}} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(16)].map((_, i) => (
          <div key={i} className="absolute rounded-full animate-float"
            style={{width:`${1+i%2}px`,height:`${1+i%2}px`,
              left:`${(i*6.3)%100}%`,top:`${(i*8.7)%100}%`,
              background:i%3===0?"rgba(6,182,212,0.4)":i%3===1?"rgba(251,191,36,0.3)":"rgba(168,85,247,0.3)",
              animationDuration:`${5+i%5}s`,animationDelay:`${i*0.4}s`}} />
        ))}
      </div>

      {/* ── HEADER ── */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.07] backdrop-blur-md"
        style={{background:"rgba(5,8,16,0.85)"}}>
        <button onClick={() => onBack()}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">{t("back")}</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Settings className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="text-lg font-black tracking-widest bg-gradient-to-r from-cyan-300 via-white to-cyan-400 bg-clip-text text-transparent uppercase">
            {t("settings")}
          </h1>
        </div>

        <div className="w-20" />
      </div>

      {/* ── TABS ── */}
      <div className="relative z-10 flex gap-1 px-3 py-3 border-b border-white/[0.06]"
        style={{background:"rgba(5,8,16,0.6)", backdropFilter:"blur(12px)"}}>
        {([
          { id:"language", label:t("language"), icon:<Globe className="w-3.5 h-3.5" />, color:"from-cyan-500 to-blue-500", active:"text-cyan-400 border-cyan-500/50 bg-cyan-500/10" },
          { id:"account",  label:"Conta",       icon:<User className="w-3.5 h-3.5" />,  color:"from-amber-500 to-orange-500", active:"text-amber-400 border-amber-500/50 bg-amber-500/10" },
          { id:"codes",    label:"Códigos",     icon:<Gift className="w-3.5 h-3.5" />,  color:"from-emerald-500 to-teal-500", active:"text-emerald-400 border-emerald-500/50 bg-emerald-500/10" },
          { id:"display",  label:"Display",     icon:<Monitor className="w-3.5 h-3.5" />, color:"from-sky-500 to-indigo-500", active:"text-sky-400 border-sky-500/50 bg-sky-500/10" },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11px] font-bold transition-all duration-200 border ${
              activeTab === tab.id ? tab.active : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.04]"
            }`}>
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-5 space-y-4">

          {/* ═══ LANGUAGE TAB ═══ */}
          {activeTab === "language" && (
            <div>
              <SectionHeader icon={<Globe className="w-4 h-4" />} title={t("language")} color="cyan" />
              <div className="space-y-2 mt-4">
                {[
                  { code:"pt", flag:"🇧🇷", label:t("portuguese") },
                  { code:"en", flag:"🇺🇸", label:t("english") },
                  { code:"ja", flag:"🇯🇵", label:t("japanese") },
                ].map(lang => (
                  <button key={lang.code} onClick={() => setLanguage(lang.code as "pt"|"en"|"ja")}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 ${
                      language === lang.code
                        ? "bg-gradient-to-r from-cyan-600/30 to-blue-600/20 border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                        : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/15"
                    }`}>
                    <span className="text-2xl">{lang.flag}</span>
                    <span className={`flex-1 text-left font-semibold ${language===lang.code?"text-white":"text-slate-400"}`}>{lang.label}</span>
                    {language === lang.code && (
                      <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ ACCOUNT TAB ═══ */}
          {activeTab === "account" && (
            <>
              {/* Profile card */}
              <div>
                <SectionHeader icon={<User className="w-4 h-4" />} title="Perfil" color="amber" />
                <div className="mt-4 rounded-2xl border border-white/[0.08] overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}>
                  {/* Avatar + name row */}
                  <div className="flex items-center gap-4 p-4 border-b border-white/[0.06]">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-400/30 shadow-lg shadow-amber-500/10">
                        {playerProfile.avatarUrl ? (
                          <Image src={playerProfile.avatarUrl} alt="Avatar" width={64} height={64} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-amber-500/30 to-orange-600/30 flex items-center justify-center">
                            <User className="w-7 h-7 text-amber-400/60" />
                          </div>
                        )}
                      </div>
                      {!isEditing && (
                        <button onClick={() => setIsEditing(true)}
                          className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center justify-center shadow-lg transition-colors">
                          <Edit2 className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input value={editName} onChange={e => setEditName(e.target.value)}
                            placeholder="Nome" className="h-8 text-sm bg-black/40 border-amber-500/30 text-white" />
                          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                            placeholder="Título" className="h-8 text-sm bg-black/40 border-amber-500/30 text-white" />
                        </div>
                      ) : (
                        <>
                          <p className="text-white font-bold text-base truncate">{playerProfile.name}</p>
                          <p className="text-amber-400/70 text-xs truncate">{playerProfile.title}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Icon picker */}
                  {isEditing && (
                    <div className="p-4 border-b border-white/[0.06]">
                      <button onClick={() => setShowIconPicker(!showIconPicker)}
                        className="w-full text-xs text-slate-400 hover:text-white flex items-center gap-2 mb-3 transition-colors">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        {showIconPicker ? "Fechar seleção de ícone" : "Escolher ícone de perfil"}
                      </button>
                      {showIconPicker && (
                        <div className="grid grid-cols-5 gap-2">
                          {PROFILE_ICONS.map(icon => (
                            <button key={icon.id} onClick={() => setEditAvatarUrl(icon.url)}
                              className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                                editAvatarUrl===icon.url ? "border-amber-400 scale-110 shadow-lg shadow-amber-400/30" : "border-transparent hover:border-white/30"
                              }`}>
                              <Image src={icon.url} alt={icon.name} width={48} height={48} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Custom URL */}
                      <Input value={editAvatarUrl} onChange={e => setEditAvatarUrl(e.target.value)}
                        placeholder="URL do avatar..." className="mt-3 h-8 text-xs bg-black/40 border-slate-600 text-white" />
                    </div>
                  )}

                  {/* Player ID */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-500 text-xs">ID do Jogador</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-slate-300 text-xs font-mono">{playerId.slice(0,8)}...</code>
                      <button onClick={handleCopyId}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all ${
                          copied ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                        }`}>
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>

                  {/* Save / cancel edit */}
                  {isEditing && (
                    <div className="flex gap-2 p-4">
                      <button onClick={() => { setIsEditing(false); setShowIconPicker(false); setEditName(playerProfile.name); setEditTitle(playerProfile.title); setEditAvatarUrl(playerProfile.avatarUrl||"") }}
                        className="flex-1 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-colors hover:bg-white/5">
                        Cancelar
                      </button>
                      <button onClick={handleSaveProfile}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20">
                        <Save className="w-3.5 h-3.5" />
                        Salvar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cloud Save */}
              <div>
                <SectionHeader icon={accountAuth.isLoggedIn ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
                  title={accountAuth.isLoggedIn ? "Conta Conectada" : "Salvar na Nuvem"} color="emerald" />
                <div className="mt-4 rounded-2xl border border-white/[0.08] overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}>
                  {accountAuth.isLoggedIn ? (
                    <div className="p-4 space-y-3">
                      {/* Status badge */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow shadow-emerald-400/50" />
                        <span className="text-emerald-400 text-xs font-bold">Conta sincronizada</span>
                      </div>

                      {accountAuth.email && (
                        <InfoRow icon={<Mail className="w-3.5 h-3.5 text-emerald-400" />} label="Email" value={accountAuth.email} />
                      )}
                      {accountAuth.uniqueCode && (
                        <InfoRow icon={<Key className="w-3.5 h-3.5 text-emerald-400" />} label="Código Único"
                          value={<code className="text-emerald-300 font-mono text-sm tracking-wider">{formatCode(accountAuth.uniqueCode)}</code>} />
                      )}
                      <InfoRow icon={<Cloud className="w-3.5 h-3.5 text-slate-400" />} label="Último save"
                        value={<><span className="text-white">{formatLastSaved(accountAuth.lastSaved)}</span><span className="text-slate-600 text-[10px] ml-1">· auto a cada 30s</span></>} />

                      {saveMessage && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-xs">{saveMessage}</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button onClick={handleManualSave}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:from-emerald-500 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/15">
                          <Save className="w-3.5 h-3.5" />Salvar Agora
                        </button>
                        <button onClick={logoutAccount}
                          className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm flex items-center justify-center gap-1.5 transition-all">
                          <LogOut className="w-3.5 h-3.5" />Sair
                        </button>
                      </div>
                    </div>
                  ) : generatedCode ? (
                    <div className="p-4 space-y-4">
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-bold text-sm">Conta criada com sucesso!</span>
                        </div>
                        <p className="text-slate-400 text-xs mb-4">Guarde este código — você precisará dele para acessar sua conta.</p>
                        <div className="bg-black/50 rounded-xl p-4 border border-emerald-500/20 text-center">
                          <p className="text-slate-500 text-[10px] mb-1">Seu Código Único</p>
                          <code className="text-2xl font-mono text-emerald-300 tracking-widest">{formatCode(generatedCode)}</code>
                        </div>
                        <button onClick={handleCopyCode}
                          className={`w-full mt-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                            codeCopied ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                          }`}>
                          {codeCopied ? <><Check className="w-4 h-4" />Copiado!</> : <><Copy className="w-4 h-4" />Copiar Código</>}
                        </button>
                      </div>
                      <button onClick={() => setGeneratedCode(null)}
                        className="w-full py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-colors">
                        Fechar
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      <p className="text-slate-500 text-xs">Conecte sua conta para salvar seu progresso na nuvem.</p>

                      {/* Auth type toggle */}
                      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/30 border border-white/[0.07]">
                        {[{v:"email",icon:<Mail className="w-3.5 h-3.5" />,label:"Email"},{v:"code",icon:<Key className="w-3.5 h-3.5" />,label:"Código"}].map(t => (
                          <button key={t.v} onClick={() => { setAuthType(t.v as "email"|"code"); setAuthError("") }}
                            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                              authType===t.v ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-300"
                            }`}>
                            {t.icon}{t.label}
                          </button>
                        ))}
                      </div>

                      {/* Auth mode toggle */}
                      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/30 border border-white/[0.07]">
                        {[{v:"login",label:"Entrar"},{v:"register",label:"Registrar"}].map(m => (
                          <button key={m.v} onClick={() => { setAuthMode(m.v as "login"|"register"); setAuthError("") }}
                            className={`py-2 rounded-lg text-xs font-bold transition-all ${
                              authMode===m.v ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow" : "text-slate-500 hover:text-slate-300"
                            }`}>
                            {m.label}
                          </button>
                        ))}
                      </div>

                      {/* Forms */}
                      {authType === "email" ? (
                        <div className="space-y-2">
                          <AuthInput icon={<Mail className="w-3.5 h-3.5" />} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" />
                          <AuthInput icon={<Lock className="w-3.5 h-3.5" />} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" />
                          {authMode==="register" && <AuthInput icon={<Lock className="w-3.5 h-3.5" />} type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirmar senha" />}
                        </div>
                      ) : authMode==="login" ? (
                        <div className="space-y-2">
                          <AuthInput icon={<Key className="w-3.5 h-3.5" />} value={uniqueCode} onChange={e=>setUniqueCode(formatCode(e.target.value))} placeholder="XXXX-XXXX-XXXX" />
                          <AuthInput icon={<Lock className="w-3.5 h-3.5" />} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <AuthInput icon={<Lock className="w-3.5 h-3.5" />} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Crie uma senha" />
                          <AuthInput icon={<Lock className="w-3.5 h-3.5" />} type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirmar senha" />
                        </div>
                      )}

                      {authError && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          <span className="text-red-400 text-xs">{authError}</span>
                        </div>
                      )}

                      <button
                        onClick={authType==="email" ? (authMode==="login"?handleLogin:handleRegister) : (authMode==="login"?handleLoginWithCode:handleRegisterWithCode)}
                        disabled={authLoading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/15">
                        {authLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
                        {authMode==="login" ? "Entrar" : "Criar Conta"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Delete account */}
              {accountAuth.isLoggedIn && (
                <div>
                  <SectionHeader icon={<Trash2 className="w-4 h-4" />} title="Zona de Perigo" color="red" />
                  <div className="mt-4 rounded-2xl border border-red-500/20 overflow-hidden" style={{background:"rgba(239,68,68,0.04)"}}>
                    <div className="p-4">
                      <p className="text-slate-500 text-xs mb-3">Esta ação é permanente e não pode ser desfeita.</p>
                      <button onClick={() => setShowDeleteConfirm(true)}
                        className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-bold flex items-center justify-center gap-2 transition-all">
                        <Trash2 className="w-4 h-4" />Deletar Dados da Conta
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete confirm modal */}
              {showDeleteConfirm && (
                <ConfirmModal
                  icon={<Trash2 className="w-6 h-6 text-white" />}
                  iconBg="from-red-600 to-red-700"
                  title="Deletar Dados"
                  subtitle="Esta ação é irreversível"
                  body="Todos os dados da conta serão permanentemente deletados. Cartas, moedas e progresso serão perdidos."
                  confirmLabel={deleteLoading ? "Deletando..." : "Deletar"}
                  confirmClass="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border-red-400/30"
                  onCancel={() => setShowDeleteConfirm(false)}
                  onConfirm={handleDeleteAccount}
                />
              )}
            </>
          )}

          {/* ═══ CODES TAB ═══ */}
          {activeTab === "codes" && (
            <div>
              <SectionHeader icon={<Gift className="w-4 h-4" />} title="Resgatar Código" color="emerald" />
              <div className="mt-4 rounded-2xl border border-white/[0.08] overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}>
                <div className="p-4 space-y-3">
                  <p className="text-slate-500 text-xs">Insira um código promocional para receber recompensas.</p>
                  <div className="relative">
                    <Gift className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input value={codeInput} onChange={e=>setCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={e=>e.key==="Enter"&&handleRedeemCode()}
                      placeholder="GEAR-XXXX-XXXX"
                      className="pl-10 bg-black/40 border-emerald-500/20 text-white font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal" />
                  </div>

                  {codeMessage && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                      codeMessage.type==="success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                    }`}>
                      {codeMessage.type==="success" ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                      {codeMessage.text}
                    </div>
                  )}

                  <button onClick={handleRedeemCode} disabled={codeLoading||!codeInput.trim()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/15">
                    {codeLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Resgatar
                  </button>
                </div>

                {/* Redeemed codes */}
                {redeemedCodes && redeemedCodes.length > 0 && (
                  <div className="border-t border-white/[0.06] p-4">
                    <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-2">Códigos resgatados</p>
                    <div className="space-y-1">
                      {redeemedCodes.map((code, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02]">
                          <Check className="w-3 h-3 text-emerald-500/60 flex-shrink-0" />
                          <code className="text-slate-600 text-xs font-mono">{code}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ DISPLAY TAB ═══ */}
          {activeTab === "display" && (
            <>
              <div>
                <SectionHeader icon={<Monitor className="w-4 h-4" />} title="Modo de Exibição" color="sky" />
                <div className="mt-4 rounded-2xl border border-white/[0.08] overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}>
                  <div className="p-4 space-y-4">
                    <p className="text-slate-500 text-xs">Ajuste o layout do jogo para o seu dispositivo.</p>

                    {/* Status indicator */}
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        {mobileMode ? <Smartphone className="w-5 h-5 text-sky-400" /> : <Monitor className="w-5 h-5 text-slate-400" />}
                        <div>
                          <p className="text-white text-sm font-semibold">{mobileMode ? "Modo Mobile Ativo" : "Modo Desktop"}</p>
                          <p className="text-slate-500 text-xs">{mobileMode ? "Otimizado para celulares" : "Layout padrão para PC"}</p>
                        </div>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full transition-all ${mobileMode ? "bg-sky-400 shadow shadow-sky-400/50" : "bg-slate-600"}`} />
                    </div>

                    <button onClick={handleMobileModeToggle}
                      className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border ${
                        mobileMode
                          ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                          : "bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 border-sky-400/30 text-white shadow-lg shadow-sky-500/15"
                      }`}>
                      {mobileMode ? <><Monitor className="w-4 h-4" />Desativar Modo Mobile</> : <><Smartphone className="w-4 h-4" />Ativar Modo Mobile</>}
                    </button>
                  </div>
                </div>
              </div>

              {onReturnToTitle && (
                <div>
                  <SectionHeader icon={<Home className="w-4 h-4" />} title="Menu Inicial" color="indigo" />
                  <div className="mt-4 rounded-2xl border border-white/[0.08] overflow-hidden" style={{background:"rgba(255,255,255,0.03)"}}>
                    <div className="p-4 space-y-3">
                      <p className="text-slate-500 text-xs">Exibe a tela de introdução com o botão "Toque Para Começar" e a música de abertura.</p>
                      <button onClick={() => setShowReturnToTitleConfirm(true)}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 border border-indigo-400/30 transition-all shadow-lg shadow-indigo-500/15">
                        <Home className="w-4 h-4" />Voltar ao Menu Inicial
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Return to title confirm */}
              {showReturnToTitleConfirm && onReturnToTitle && (
                <ConfirmModal
                  icon={<Home className="w-6 h-6 text-white" />}
                  iconBg="from-indigo-500 to-purple-600"
                  title="Voltar ao Menu Inicial"
                  subtitle="Retornar à tela de introdução"
                  body="Você será levado de volta ao Menu Inicial. Nenhum dado será perdido — seu progresso está salvo automaticamente."
                  confirmLabel="Confirmar"
                  confirmClass="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-indigo-400/30"
                  onCancel={() => setShowReturnToTitleConfirm(false)}
                  onConfirm={() => { setShowReturnToTitleConfirm(false); onReturnToTitle() }}
                />
              )}

              {/* Mobile mode confirm */}
              {showMobileConfirm && (
                <ConfirmModal
                  icon={<Smartphone className="w-6 h-6 text-white" />}
                  iconBg="from-sky-500 to-cyan-600"
                  title="Ativar Modo Mobile"
                  subtitle={detectedDevice==="mobile" ? "Dispositivo móvel detectado" : "Dispositivo PC detectado"}
                  body={detectedDevice==="mobile"
                    ? "Ative o Modo Mobile para otimizar a resolução e a experiência de jogo no seu celular."
                    : "O Modo Mobile é projetado para celulares, mas pode ser ativado para testes. Deseja continuar?"}
                  confirmLabel="Confirmar"
                  confirmClass="bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 border-sky-400/30"
                  onCancel={() => setShowMobileConfirm(false)}
                  onConfirm={confirmMobileMode}
                />
              )}
            </>
          )}

          {/* Credits */}
          <div className="pt-4 pb-8 text-center">
            <p className="text-slate-700 text-[11px] font-medium">2025 Gear Perks Oficial Card Game</p>
            <p className="text-slate-800 text-[11px]">Made in BRAZIL</p>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Helper sub-components ───────────────────────────────────────────────────

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  const colors: Record<string, string> = {
    cyan:    "from-cyan-500 to-blue-600 shadow-cyan-500/25",
    amber:   "from-amber-500 to-orange-500 shadow-amber-500/25",
    emerald: "from-emerald-500 to-teal-500 shadow-emerald-500/25",
    sky:     "from-sky-500 to-indigo-500 shadow-sky-500/25",
    indigo:  "from-indigo-500 to-purple-600 shadow-indigo-500/25",
    red:     "from-red-600 to-rose-600 shadow-red-500/25",
  }
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${colors[color]||colors.cyan} flex items-center justify-center shadow-lg text-white flex-shrink-0`}>
        {icon}
      </div>
      <h2 className="text-base font-black text-white tracking-wide">{title}</h2>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/20 border border-white/[0.05]">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-slate-500 text-xs">{label}</span>
      </div>
      <div className="text-right text-sm">{value}</div>
    </div>
  )
}

function AuthInput({ icon, ...props }: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">{icon}</div>
      <input {...props}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
    </div>
  )
}

function ConfirmModal({ icon, iconBg, title, subtitle, body, confirmLabel, confirmClass, onCancel, onConfirm }: {
  icon: React.ReactNode; iconBg: string; title: string; subtitle: string; body: string
  confirmLabel: string; confirmClass: string; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.10] overflow-hidden shadow-2xl" style={{background:"linear-gradient(160deg,#0d1117,#0a0e1a)"}}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-lg flex-shrink-0`}>{icon}</div>
            <div>
              <h3 className="text-white font-black text-base">{title}</h3>
              <p className="text-slate-500 text-xs">{subtitle}</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mb-5 px-1">{body}</p>
          <div className="flex gap-2">
            <button onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-all">
              Cancelar
            </button>
            <button onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1.5 border transition-all ${confirmClass}`}>
              <Check className="w-4 h-4" />{confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
